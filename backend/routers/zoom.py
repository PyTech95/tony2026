"""Zoom Server-to-Server OAuth: create meetings for live classes + attach cloud
recordings with a limited replay window.

Credentials live in app_settings (zoom_account_id / zoom_client_id /
zoom_client_secret / zoom_host_user_id) with env fallback. When credentials are
absent the module degrades gracefully to deterministic MOCK data so the whole
booking → join → recording flow is testable without a real Zoom account.
"""
import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from core import api, db, now_utc, logger, get_current_user, require_role
from routers.settings import get_setting

# Cached access token (S2S tokens live ~1h, no refresh token).
_token: Dict[str, Any] = {"value": None, "expires_at": None}


async def _creds() -> Optional[Dict[str, str]]:
    account_id = await get_setting("zoom_account_id")
    client_id = await get_setting("zoom_client_id")
    client_secret = await get_setting("zoom_client_secret")
    if not (account_id and client_id and client_secret):
        return None
    host = await get_setting("zoom_host_user_id")
    return {
        "account_id": account_id, "client_id": client_id,
        "client_secret": client_secret, "host": host or "me",
    }


async def zoom_configured() -> bool:
    return (await _creds()) is not None


async def _access_token() -> Optional[str]:
    creds = await _creds()
    if not creds:
        return None
    now = datetime.now(timezone.utc)
    if _token["value"] and _token["expires_at"] and _token["expires_at"] > now + timedelta(seconds=30):
        return _token["value"]
    basic = base64.b64encode(f'{creds["client_id"]}:{creds["client_secret"]}'.encode()).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://zoom.us/oauth/token",
            params={"grant_type": "account_credentials", "account_id": creds["account_id"]},
            headers={"Authorization": f"Basic {basic}"},
        )
    if resp.is_error:
        raise HTTPException(502, "Zoom token request failed — check Account ID / Client ID / Secret.")
    data = resp.json()
    _token["value"] = data["access_token"]
    _token["expires_at"] = now + timedelta(seconds=int(data.get("expires_in", 3600)))
    return _token["value"]


async def _zoom_request(method: str, path: str, **kwargs) -> Dict[str, Any]:
    token = await _access_token()
    if not token:
        return {"mock": True}
    async with httpx.AsyncClient(base_url="https://api.zoom.us/v2", timeout=30) as client:
        resp = await client.request(
            method, path,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            **kwargs,
        )
    if resp.is_error:
        logger.warning(f"Zoom API {method} {path} -> {resp.status_code}")
        raise HTTPException(resp.status_code, "Zoom API request failed.")
    return resp.json()


async def create_meeting_for_instance(instance: dict) -> Optional[dict]:
    """Create a scheduled Zoom meeting for a class instance. MOCK when unconfigured.
    Returns {zoom_meeting_id, zoom_join_url, zoom_start_url, zoom_mock}."""
    creds = await _creds()
    topic = instance.get("title") or "Tony Yoga live class"
    start_iso = instance.get("start_time")
    duration = int(instance.get("duration_minutes") or 60)
    if not creds:
        mid = f"mock-{instance.get('id', '')[:8]}"
        return {
            "zoom_meeting_id": mid,
            "zoom_join_url": f"https://zoom.us/j/{mid}",
            "zoom_start_url": f"https://zoom.us/s/{mid}",
            "zoom_mock": True,
        }
    payload = {
        "topic": topic, "type": 2, "start_time": start_iso,
        "duration": duration, "timezone": "UTC",
        "settings": {"join_before_host": False, "waiting_room": True},
    }
    result = await _zoom_request("POST", f"/users/{creds['host']}/meetings", json=payload)
    return {
        "zoom_meeting_id": str(result.get("id")),
        "zoom_join_url": result.get("join_url"),
        "zoom_start_url": result.get("start_url"),
        "zoom_mock": False,
    }


async def _fetch_recording_url(meeting_id: str) -> Optional[str]:
    """Best-effort: pull the first playable cloud recording URL for a meeting."""
    if not meeting_id or meeting_id.startswith("mock-"):
        return None
    try:
        result = await _zoom_request("GET", f"/meetings/{meeting_id}/recordings")
    except HTTPException:
        return None
    for f in result.get("recording_files", []) or []:
        if f.get("status") == "completed" and (f.get("play_url") or f.get("download_url")):
            return f.get("play_url") or f.get("download_url")
    return result.get("share_url")


# ---------------- Admin: connection ----------------
@api.get("/admin/zoom/status")
async def zoom_status(request: Request):
    await require_role(request, ["admin"])
    configured = await zoom_configured()
    return {"configured": configured, "mode": "live" if configured else "mock"}


@api.post("/admin/zoom/verify")
async def zoom_verify(request: Request):
    await require_role(request, ["admin"])
    if not await zoom_configured():
        return {"ok": False, "error": "Zoom is not configured. Add Account ID, Client ID and Secret."}
    try:
        token = await _access_token()
        return {"ok": bool(token), "message": "Zoom connected." if token else "No token returned."}
    except HTTPException as e:
        return {"ok": False, "error": e.detail}


# ---------------- Admin: per-class meeting + recording ----------------
@api.post("/admin/class-instances/{instance_id}/zoom-meeting")
async def create_class_meeting(instance_id: str, request: Request):
    await require_role(request, ["admin", "instructor"])
    inst = await db.class_instances.find_one({"id": instance_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Class not found")
    meeting = await create_meeting_for_instance(inst)
    await db.class_instances.update_one({"id": instance_id}, {"$set": meeting})
    return {"ok": True, **meeting}


class RecordingIn(BaseModel):
    recording_url: Optional[str] = None
    replay_days: int = 3


@api.post("/admin/class-instances/{instance_id}/recording")
async def attach_recording(instance_id: str, payload: RecordingIn, request: Request):
    """Attach a cloud-recording link with a limited replay window. If no URL is
    given and the meeting is a real Zoom meeting, we try to pull it from Zoom."""
    await require_role(request, ["admin", "instructor"])
    inst = await db.class_instances.find_one({"id": instance_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Class not found")
    url = (payload.recording_url or "").strip()
    if not url:
        url = await _fetch_recording_url(inst.get("zoom_meeting_id", "")) or ""
    if not url:
        raise HTTPException(400, "No recording URL provided and none available from Zoom yet.")
    days = max(1, min(60, int(payload.replay_days or 3)))
    now = now_utc()
    update = {
        "recording_url": url,
        "recording_available_at": now.isoformat(),
        "recording_expires_at": (now + timedelta(days=days)).isoformat(),
        "recording_replay_days": days,
        "is_recorded": True,
    }
    await db.class_instances.update_one({"id": instance_id}, {"$set": update})
    # Notify booked students (best-effort push).
    try:
        from routers.push import notify_user
        bookings = await db.bookings.find(
            {"class_instance_id": instance_id, "status": {"$in": ["confirmed", "waitlist"]}},
            {"_id": 0, "user_id": 1},
        ).to_list(1000)
        for b in bookings:
            await notify_user(
                b["user_id"], "Class recording is ready",
                f"{inst.get('title', 'Your class')} — available for {days} day(s).",
                f"/schedule/{instance_id}",
            )
    except Exception as e:
        logger.warning(f"recording notify failed: {e}")
    return {"ok": True, **update}


@api.delete("/admin/class-instances/{instance_id}/recording")
async def remove_recording(instance_id: str, request: Request):
    await require_role(request, ["admin", "instructor"])
    await db.class_instances.update_one(
        {"id": instance_id},
        {"$unset": {"recording_url": "", "recording_available_at": "",
                    "recording_expires_at": "", "recording_replay_days": ""}},
    )
    return {"ok": True}


# ---------------- Student: gated join + recording ----------------
def _parse(dt) -> Optional[datetime]:
    if not dt:
        return None
    try:
        return datetime.fromisoformat(str(dt).replace("Z", "+00:00"))
    except Exception:
        return None


@api.get("/class-instances/{instance_id}/recording")
async def get_recording(instance_id: str, user: dict = Depends(get_current_user)):
    inst = await db.class_instances.find_one({"id": instance_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Class not found")
    is_staff = user.get("role") in ("admin", "instructor")
    if not is_staff:
        booked = await db.bookings.find_one(
            {"class_instance_id": instance_id, "user_id": user["id"], "status": {"$in": ["confirmed", "waitlist"]}})
        member = await db.subscriptions.find_one({"user_id": user["id"], "status": {"$in": ["active", "trialing"]}})
        if not (booked or member):
            raise HTTPException(403, "Recordings are available to students who booked this class.")
    url = inst.get("recording_url")
    if not url:
        return {"available": False, "reason": "not_ready"}
    expires = _parse(inst.get("recording_expires_at"))
    now = datetime.now(timezone.utc)
    if expires and now > expires and not is_staff:
        return {"available": False, "reason": "expired", "expired_at": inst.get("recording_expires_at")}
    return {
        "available": True,
        "url": url,
        "expires_at": inst.get("recording_expires_at"),
        "replay_days": inst.get("recording_replay_days"),
    }


async def _attach_recording_internal(inst: dict, url: str, days: int):
    from datetime import timedelta
    now = now_utc()
    await db.class_instances.update_one(
        {"id": inst["id"]},
        {"$set": {
            "recording_url": url,
            "recording_available_at": now.isoformat(),
            "recording_expires_at": (now + timedelta(days=days)).isoformat(),
            "recording_replay_days": days,
            "is_recorded": True,
        }},
    )
    try:
        from routers.push import notify_user
        bookings = await db.bookings.find(
            {"class_instance_id": inst["id"], "status": {"$in": ["confirmed", "waitlist"]}},
            {"_id": 0, "user_id": 1},
        ).to_list(1000)
        for b in bookings:
            await notify_user(b["user_id"], "Class recording is ready",
                              f"{inst.get('title', 'Your class')} — available for {days} day(s).",
                              f"/schedule/{inst['id']}")
    except Exception as e:
        logger.warning(f"auto-recording notify failed: {e}")


async def zoom_recording_poll_tick():
    """Auto-pull Zoom cloud recordings for classes that recently ended and don't
    have a recording yet. No-op in mock mode (no real meetings)."""
    if not await zoom_configured():
        return 0
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=24)).isoformat()
    candidates = await db.class_instances.find(
        {
            "location_type": "online",
            "end_time": {"$lte": now.isoformat(), "$gte": since},
            "recording_url": {"$in": [None, ""]},
            "zoom_meeting_id": {"$nin": [None, ""]},
        },
        {"_id": 0},
    ).to_list(200)
    default_days = 3
    try:
        default_days = int(await get_setting("recording_replay_days") or 3)
    except Exception:
        pass
    pulled = 0
    for inst in candidates:
        mid = inst.get("zoom_meeting_id", "")
        if not mid or mid.startswith("mock-"):
            continue
        url = await _fetch_recording_url(mid)
        if url:
            await _attach_recording_internal(inst, url, default_days)
            pulled += 1
            logger.info(f"Auto-pulled Zoom recording for class {inst['id']}")
    return pulled


@api.post("/webhook/zoom")
async def zoom_webhook(request: Request):
    """Zoom 'recording.completed' webhook. Also answers Zoom's endpoint URL
    validation challenge. Best-effort: attaches the recording to the class."""
    body = await request.json()
    event = body.get("event")
    payload = body.get("payload", {}) or {}
    # Zoom endpoint validation handshake
    if event == "endpoint.url_validation":
        import hashlib, hmac
        plain = (payload.get("plainToken") or "")
        secret = await get_setting("zoom_client_secret") or ""
        enc = hmac.new(secret.encode(), plain.encode(), hashlib.sha256).hexdigest() if secret else ""
        return {"plainToken": plain, "encryptedToken": enc}
    if event == "recording.completed":
        obj = payload.get("object", {}) or {}
        mid = str(obj.get("id") or "")
        files = obj.get("recording_files", []) or []
        url = ""
        for f in files:
            if f.get("play_url") or f.get("download_url"):
                url = f.get("play_url") or f.get("download_url")
                break
        inst = await db.class_instances.find_one({"zoom_meeting_id": mid}, {"_id": 0})
        if inst and url:
            days = 3
            try:
                days = int(await get_setting("recording_replay_days") or 3)
            except Exception:
                pass
            await _attach_recording_internal(inst, url, days)
    return {"received": True}
