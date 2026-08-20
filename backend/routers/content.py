"""Programs, videos, lessons, progress, favorites, shop, memberships, announcements."""
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, Request
from core import api, db, now_utc, gen_id, get_current_user, get_optional_user, require_role
from models import (
    ProgramCreate, ProgramUpdate, VideoCreate, VideoUpdate,
    ProgramLesson, ProgramLessonUpdate, ProductCreate,
    MembershipPlanCreate, AnnouncementCreate,
    LessonUpsert, LessonPatch, LessonReorder, LessonBulk,
)


def _yt_id(url: str) -> Optional[str]:
    """Extract an 11-char YouTube video id from any common YouTube URL form."""
    if not url:
        return None
    s = str(url).strip()
    patterns = [
        r"youtube\.com/watch\?v=([\w-]{11})",
        r"youtu\.be/([\w-]{11})",
        r"youtube\.com/embed/([\w-]{11})",
        r"youtube\.com/shorts/([\w-]{11})",
        r"youtube\.com/live/([\w-]{11})",
    ]
    for p in patterns:
        m = re.search(p, s)
        if m:
            return m.group(1)
    if re.fullmatch(r"[\w-]{11}", s):
        return s
    return None


async def _user_owns_program(user: Optional[dict], program_id: str) -> bool:
    if not user: return False
    # paid via Stripe (transaction)
    txn = await db.payment_transactions.find_one({
        "user_id": user["id"], "item_type": "program", "item_id": program_id, "payment_status": "paid",
    })
    if txn: return True
    # direct enrollment record
    enr = await db.program_enrollments.find_one({"user_id": user["id"], "program_id": program_id})
    return bool(enr)


async def _user_has_active_membership(user: Optional[dict]) -> bool:
    if not user: return False
    sub = await db.subscriptions.find_one({"user_id": user["id"], "status": "active"})
    return bool(sub)


def _parse_dt(val) -> Optional[datetime]:
    if not val: return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None


async def _program_access_since(user: Optional[dict], program_id: str) -> Optional[datetime]:
    """Earliest moment the user got access to the program (drives drip scheduling)."""
    if not user: return None
    dates = []
    txn = await db.payment_transactions.find_one(
        {"user_id": user["id"], "item_type": "program", "item_id": program_id, "payment_status": "paid"})
    if txn: dates.append(_parse_dt(txn.get("created_at")))
    enr = await db.program_enrollments.find_one({"user_id": user["id"], "program_id": program_id})
    if enr: dates.append(_parse_dt(enr.get("created_at")))
    if not any(dates):
        sub = await db.subscriptions.find_one({"user_id": user["id"], "status": "active"})
        if sub: dates.append(_parse_dt(sub.get("created_at")))
    dates = [d for d in dates if d]
    return min(dates) if dates else None


def _drip_status(program: dict, order_index: int, access_since: Optional[datetime]):
    """Returns (locked, available_on_iso). Lesson N unlocks N*interval days after access."""
    if not program or not program.get("drip_enabled"):
        return (False, None)
    if access_since is None:
        return (False, None)  # can't compute enrollment date → don't block
    interval = int(program.get("drip_interval_days") or 7)
    unlock_dt = access_since + timedelta(days=int(order_index) * interval)
    if datetime.now(timezone.utc) >= unlock_dt:
        return (False, None)
    return (True, unlock_dt.isoformat())


async def _can_play(user: Optional[dict], video: dict, lesson: Optional[dict], program: Optional[dict]) -> bool:
    if not video: return False
    if video.get("visibility") == "free": return True
    if lesson and lesson.get("is_free_preview"): return True
    if not user: return False
    if user.get("role") in ("admin", "instructor"): return True
    # Program access
    if program:
        is_free = program.get("price_model") == "free"
        membership_ok = program.get("price_model") == "membership" and await _user_has_active_membership(user)
        owns = await _user_owns_program(user, program["id"])
        if is_free or membership_ok or owns:
            if program.get("drip_enabled") and lesson and not is_free:
                access_since = await _program_access_since(user, program["id"])
                locked, _ = _drip_status(program, lesson.get("order_index", 0), access_since)
                if locked:
                    return False
            return True
    # Library generic gate: video.visibility "members" → requires active sub
    if video.get("visibility") == "members" and await _user_has_active_membership(user):
        return True
    return False


# ---------- Programs & Videos ----------
@api.post("/admin/programs")
async def create_program(payload: ProgramCreate, request: Request):
    await require_role(request, ["admin", "instructor"])
    doc = {**payload.model_dump(), "id": gen_id(), "created_at": now_utc().isoformat(), "rating": 0, "review_count": 0}
    await db.programs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/programs/{program_id}")
async def update_program(program_id: str, payload: ProgramUpdate, request: Request):
    await require_role(request, ["admin", "instructor"])
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.programs.update_one({"id": program_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Program not found")
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    return program


@api.get("/programs")
async def list_programs(level: Optional[str] = None, style: Optional[str] = None):
    query: Dict[str, Any] = {}
    if level: query["level"] = level
    if style: query["style"] = style
    return await db.programs.find(query, {"_id": 0}).to_list(500)


@api.get("/programs/{program_id}")
async def get_program(program_id: str, user: Optional[dict] = Depends(get_optional_user)):
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(404, "Program not found")
    lessons = await db.program_lessons.find({"program_id": program_id}, {"_id": 0}).sort("order_index", 1).to_list(500)
    video_ids = [l["video_id"] for l in lessons]
    videos = {v["id"]: v for v in await db.videos.find({"id": {"$in": video_ids}}, {"_id": 0}).to_list(500)}

    user_owns = await _user_owns_program(user, program_id)
    user_member = await _user_has_active_membership(user)
    is_staff = bool(user and user.get("role") in ("admin", "instructor"))
    is_free_program = program.get("price_model") == "free"
    has_program_access = is_staff or user_owns or is_free_program or (program.get("price_model") == "membership" and user_member)

    # Fetch best score per lesson for this user (drives progressive unlock).
    best_by_lesson: dict = {}
    if user and has_program_access:
        rows = await db.assignment_submissions.find(
            {"user_id": user["id"], "program_id": program_id, "score": {"$ne": None}},
            {"_id": 0, "lesson_id": 1, "score": 1, "id": 1, "feedback": 1, "status": 1},
        ).to_list(2000)
        for r in rows:
            cur = best_by_lesson.get(r["lesson_id"])
            if cur is None or (r.get("score") or 0) > cur["score"]:
                best_by_lesson[r["lesson_id"]] = {
                    "score": r.get("score") or 0,
                    "submission_id": r.get("id"),
                    "status": r.get("status"),
                    "feedback": r.get("feedback"),
                }

    prev_passed = True  # the first lesson is always reachable when the user has program access
    access_since = await _program_access_since(user, program_id) if (has_program_access and not is_staff) else None
    for idx, l in enumerate(lessons):
        v = videos.get(l["video_id"])
        if not v:
            l["video"] = None
            l["is_unlocked"] = False
            l["my_submission"] = None
            l["drip_locked"] = False
            l["available_on"] = None
            continue
        # Base content gate
        if is_staff:
            content_unlocked = True
        elif l.get("is_free_preview") or v.get("visibility") == "free":
            content_unlocked = True
        elif has_program_access:
            # Progressive unlock: this lesson opens only if the PREVIOUS lesson was
            # passed (or didn't require a submission). prev_passed starts True so
            # lesson 0 is always reachable.
            content_unlocked = prev_passed
        elif v.get("visibility") == "members" and user_member:
            content_unlocked = True
        else:
            content_unlocked = False

        # Drip schedule: gate owned/member lessons by time since access (independent of assignment gate)
        drip_locked, available_on = False, None
        if has_program_access and not is_staff and not (l.get("is_free_preview") or v.get("visibility") == "free"):
            drip_locked, available_on = _drip_status(program, idx, access_since)
        if drip_locked:
            content_unlocked = False

        v_view = {**v}
        if not content_unlocked:
            v_view.pop("video_url", None)
            v_view.pop("source_url", None)
            v_view.pop("youtube_id", None)
        l["video"] = v_view
        l["is_unlocked"] = content_unlocked
        l["drip_locked"] = drip_locked
        l["available_on"] = available_on
        l["my_submission"] = best_by_lesson.get(l["id"])
        # Whether the NEXT lesson should unlock depends on this lesson's threshold + best score
        threshold = int(l.get("pass_threshold") or 60)
        my_score = (l["my_submission"] or {}).get("score") or 0
        if not l.get("requires_submission", False):
            prev_passed = True
        else:
            prev_passed = is_staff or my_score >= threshold

    program["lessons"] = lessons
    program["viewer"] = {
        "owns_program": user_owns,
        "has_active_membership": user_member,
        "is_authenticated": bool(user),
        "is_staff": is_staff,
    }
    return program


@api.post("/admin/videos")
async def create_video(payload: VideoCreate, request: Request):
    await require_role(request, ["admin", "instructor"])
    doc = {**payload.model_dump(), "id": gen_id(), "views": 0, "created_at": now_utc().isoformat()}
    await db.videos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/videos/{video_id}")
async def update_video(video_id: str, payload: VideoUpdate, request: Request):
    await require_role(request, ["admin", "instructor"])
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.videos.update_one({"id": video_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Video not found")
    v = await db.videos.find_one({"id": video_id}, {"_id": 0})
    return v


@api.get("/videos")
async def list_videos(visibility: Optional[str] = None, style: Optional[str] = None, level: Optional[str] = None):
    query: Dict[str, Any] = {}
    if visibility: query["visibility"] = visibility
    if style: query["style"] = style
    if level: query["level"] = level
    return await db.videos.find(query, {"_id": 0}).to_list(500)


@api.get("/videos/{video_id}")
async def get_video(video_id: str, user: Optional[dict] = Depends(get_optional_user)):
    v = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    program = None
    lesson = None
    if v.get("program_id"):
        program = await db.programs.find_one({"id": v["program_id"]}, {"_id": 0})
        lesson = await db.program_lessons.find_one({"program_id": v["program_id"], "video_id": video_id}, {"_id": 0})
    unlocked = await _can_play(user, v, lesson, program)
    if not unlocked:
        v = {**v}
        v.pop("video_url", None)
        v.pop("source_url", None)
        v.pop("youtube_id", None)
    v["is_unlocked"] = unlocked
    return v


@api.post("/admin/program-lessons")
async def add_lesson(payload: ProgramLesson, request: Request):
    await require_role(request, ["admin", "instructor"])
    doc = {**payload.model_dump(), "id": gen_id(), "is_free_preview": False}
    await db.program_lessons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/program-lessons/{lesson_id}")
async def update_lesson(lesson_id: str, payload: ProgramLessonUpdate, request: Request):
    await require_role(request, ["admin", "instructor"])
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.program_lessons.update_one({"id": lesson_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Lesson not found")
    return await db.program_lessons.find_one({"id": lesson_id}, {"_id": 0})


# ---------- Progress & Favorites ----------
@api.post("/progress")
async def save_progress(body: dict, user: dict = Depends(get_current_user)):
    video_id = body.get("video_id")
    seconds = float(body.get("seconds", 0))
    completed = bool(body.get("completed", False))
    if not video_id:
        raise HTTPException(400, "video_id required")
    await db.watch_progress.update_one(
        {"user_id": user["id"], "video_id": video_id},
        {"$set": {"user_id": user["id"], "video_id": video_id, "seconds": seconds,
                  "completed": completed, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    # Auto-log practice when the user has watched at least 5 minutes of a video today
    if seconds >= 300:
        try:
            from routers.streaks import record_practice
            await record_practice(user["id"], source="video", ref_id=video_id)
        except Exception:
            pass
    return {"ok": True}


@api.get("/progress/mine")
async def get_progress(user: dict = Depends(get_current_user)):
    return await db.watch_progress.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)


@api.post("/favorites/toggle")
async def toggle_favorite(body: dict, user: dict = Depends(get_current_user)):
    target_type = body.get("target_type"); target_id = body.get("target_id")
    existing = await db.favorites.find_one({"user_id": user["id"], "target_type": target_type, "target_id": target_id})
    if existing:
        await db.favorites.delete_one({"id": existing["id"]})
        return {"favorited": False}
    await db.favorites.insert_one({
        "id": gen_id(), "user_id": user["id"],
        "target_type": target_type, "target_id": target_id,
        "created_at": now_utc().isoformat(),
    })
    return {"favorited": True}


@api.get("/favorites/mine")
async def list_favorites(user: dict = Depends(get_current_user)):
    return await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)


# ---------- Shop ----------
@api.post("/admin/products")
async def create_product(payload: ProductCreate, request: Request):
    await require_role(request, ["admin"])
    doc = {**payload.model_dump(), "id": gen_id(), "created_at": now_utc().isoformat(), "rating": 0}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/products")
async def list_products(category: Optional[str] = None):
    query: Dict[str, Any] = {}
    if category: query["category"] = category
    return await db.products.find(query, {"_id": 0}).to_list(500)


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Product not found")
    return p


# ---------- Memberships ----------
@api.post("/admin/membership-plans")
async def create_plan(payload: MembershipPlanCreate, request: Request):
    await require_role(request, ["admin"])
    doc = {**payload.model_dump(), "id": gen_id(), "is_active": True, "created_at": now_utc().isoformat()}
    await db.membership_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/membership-plans")
async def list_plans():
    return await db.membership_plans.find({"is_active": True}, {"_id": 0}).to_list(100)


@api.get("/subscriptions/mine")
async def my_subscription(user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    if sub:
        plan = await db.membership_plans.find_one({"id": sub["plan_id"]}, {"_id": 0})
        sub["plan"] = plan
    return sub


# ---------- Announcements ----------
@api.post("/admin/announcements")
async def create_announcement(payload: AnnouncementCreate, request: Request):
    admin = await require_role(request, ["admin"])
    doc = {**payload.model_dump(), "id": gen_id(), "created_at": now_utc().isoformat(), "author": admin["name"]}
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/announcements")
async def list_announcements():
    return await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)


# ---------- Continue learning + Certificates ----------
async def _accessible_program_ids(user: dict) -> set:
    ids = set()
    for t in await db.payment_transactions.find(
            {"user_id": user["id"], "item_type": "program", "payment_status": "paid"}, {"_id": 0, "item_id": 1}).to_list(500):
        ids.add(t["item_id"])
    for e in await db.program_enrollments.find({"user_id": user["id"]}, {"_id": 0, "program_id": 1}).to_list(500):
        ids.add(e["program_id"])
    if await _user_has_active_membership(user):
        for p in await db.programs.find({"price_model": "membership"}, {"_id": 0, "id": 1}).to_list(500):
            ids.add(p["id"])
    return ids


@api.get("/me/continue")
async def continue_learning(user: dict = Depends(get_current_user)):
    """Programs the user is enrolled in, each with its next unfinished lesson + progress."""
    ids = await _accessible_program_ids(user)
    if not ids:
        return []
    programs = await db.programs.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(500)
    prog_map = {p["video_id"]: p for p in await db.watch_progress.find({"user_id": user["id"]}, {"_id": 0}).to_list(4000)}
    out = []
    for prog in programs:
        lessons = await db.program_lessons.find({"program_id": prog["id"]}, {"_id": 0}).sort("order_index", 1).to_list(500)
        if not lessons:
            continue
        vids = {v["id"]: v for v in await db.videos.find(
            {"id": {"$in": [l["video_id"] for l in lessons]}}, {"_id": 0}).to_list(500)}
        total = len(lessons)
        completed = 0
        next_lesson = None
        last_activity = None
        for l in lessons:
            wp = prog_map.get(l["video_id"])
            if wp and wp.get("completed"):
                completed += 1
            elif next_lesson is None:
                v = vids.get(l["video_id"]) or {}
                next_lesson = {
                    "video_id": l["video_id"], "title": v.get("title", "Lesson"),
                    "cover_image": v.get("cover_image"), "resume_seconds": (wp or {}).get("seconds", 0),
                }
            if wp and wp.get("updated_at") and (last_activity is None or wp["updated_at"] > last_activity):
                last_activity = wp["updated_at"]
        if completed >= total:
            next_lesson = None
        out.append({
            "program_id": prog["id"], "program_title": prog["title"], "cover_image": prog.get("cover_image"),
            "total": total, "completed": completed,
            "percent": round(completed * 100 / total) if total else 0,
            "next_lesson": next_lesson, "last_activity": last_activity,
        })
    out = [o for o in out if o["completed"] > 0 or o["next_lesson"]]
    out.sort(key=lambda o: (o["last_activity"] or ""), reverse=True)
    return out


@api.post("/programs/{program_id}/certificate/claim")
async def claim_certificate(program_id: str, user: dict = Depends(get_current_user)):
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(404, "Program not found")
    lessons = await db.program_lessons.find({"program_id": program_id}, {"_id": 0}).to_list(500)
    if not lessons:
        raise HTTPException(400, "This course has no lessons yet.")
    video_ids = [l["video_id"] for l in lessons]
    done = await db.watch_progress.find(
        {"user_id": user["id"], "video_id": {"$in": video_ids}, "completed": True}, {"_id": 0, "video_id": 1}).to_list(2000)
    done_ids = {d["video_id"] for d in done}
    if not all(vid in done_ids for vid in video_ids):
        return {"eligible": False, "completed": len(done_ids), "total": len(video_ids)}
    existing = await db.certificates.find_one({"user_id": user["id"], "program_id": program_id}, {"_id": 0})
    if existing:
        return {"eligible": True, "certificate": existing}
    cert = {
        "id": gen_id(), "code": gen_id()[:8].upper(),
        "user_id": user["id"], "user_name": user.get("name") or "Student",
        "program_id": program_id, "program_title": program["title"],
        "lessons_count": len(video_ids), "issued_at": now_utc().isoformat(),
    }
    await db.certificates.insert_one(cert)
    cert.pop("_id", None)
    return {"eligible": True, "certificate": cert}


@api.get("/certificate/{code}")
async def get_certificate(code: str):
    cert = await db.certificates.find_one({"code": code.upper()}, {"_id": 0})
    if not cert:
        raise HTTPException(404, "Certificate not found")
    return cert


@api.get("/admin/certificates/export.csv")
async def export_certificates_csv(request: Request):
    """CSV of every issued certificate for reporting. Admin-only."""
    import io
    import csv
    from fastapi.responses import Response
    await require_role(request, ["admin", "support"])
    certs = await db.certificates.find({}, {"_id": 0}).sort("issued_at", -1).to_list(5000)
    emails = {u["id"]: u.get("email", "") for u in await db.users.find(
        {"id": {"$in": [c.get("user_id") for c in certs]}}, {"_id": 0, "id": 1, "email": 1}).to_list(5000)}
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["code", "student_name", "student_email", "program_title", "lessons_count", "issued_at", "verify_url"])
    frontend_url = os.environ.get("FRONTEND_URL", "")
    for c in certs:
        writer.writerow([
            c.get("code", ""), c.get("user_name", ""), emails.get(c.get("user_id"), ""),
            c.get("program_title", ""), c.get("lessons_count", ""), c.get("issued_at", ""),
            f"{frontend_url}/certificate/{c.get('code','')}",
        ])
    return Response(
        content=buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="certificates.csv"'},
    )


# ---------- Course lesson editor (admin/instructor) ----------
# Each lesson is backed by a `videos` row. A single long YouTube video can be
# sliced into many lessons by giving each a different start/end timestamp.
def _build_lesson_video(program: dict, payload: LessonUpsert) -> dict:
    yid = _yt_id(payload.youtube_url)
    if not yid:
        raise HTTPException(400, "Not a valid YouTube link.")
    start = int(payload.start_seconds or 0)
    end = int(payload.end_seconds) if payload.end_seconds else None
    if end is not None and end <= start:
        raise HTTPException(400, "End time must be after start time.")
    dur = payload.duration_minutes
    if not dur and end is not None:
        dur = max(1, round((end - start) / 60))
    return {
        "id": gen_id(),
        "title": payload.title,
        "description": payload.description or payload.title,
        "duration_minutes": int(dur or 30),
        "level": payload.level or program.get("level", "all"),
        "style": payload.style or program.get("style", "Yoga"),
        "tags": [(program.get("style") or "").lower(), "lesson"],
        "video_url": f"https://www.youtube.com/watch?v={yid}",
        "source_type": "youtube",
        "source_url": payload.youtube_url,
        "youtube_id": yid,
        "start_seconds": start,
        "end_seconds": end,
        "is_private": bool(payload.is_private),
        "visibility": "program",
        "program_id": program["id"],
        "instructor_id": program.get("instructor_id"),
        "cover_image": payload.cover_image or f"https://img.youtube.com/vi/{yid}/hqdefault.jpg",
        "views": 0,
        "created_at": now_utc().isoformat(),
    }


@api.get("/admin/programs/{program_id}/lessons")
async def admin_list_lessons(program_id: str, request: Request):
    await require_role(request, ["admin", "instructor"])
    lessons = await db.program_lessons.find({"program_id": program_id}, {"_id": 0}).sort("order_index", 1).to_list(500)
    vids = {v["id"]: v for v in await db.videos.find(
        {"id": {"$in": [l["video_id"] for l in lessons]}}, {"_id": 0}).to_list(500)}
    for l in lessons:
        l["video"] = vids.get(l["video_id"])
    return lessons


@api.post("/admin/programs/{program_id}/lessons")
async def admin_add_lesson(program_id: str, payload: LessonUpsert, request: Request):
    await require_role(request, ["admin", "instructor"])
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(404, "Program not found")
    video_doc = _build_lesson_video(program, payload)
    await db.videos.insert_one(video_doc)
    last = await db.program_lessons.find({"program_id": program_id}).sort("order_index", -1).to_list(1)
    nxt = (last[0]["order_index"] + 1) if last else 0
    lesson_doc = {
        "id": gen_id(), "program_id": program_id, "video_id": video_doc["id"],
        "order_index": nxt, "is_free_preview": bool(payload.is_free_preview),
        "requires_submission": bool(payload.requires_submission) if payload.requires_submission is not None else False,
        "assignment_prompt": payload.assignment_prompt or None,
        "pass_threshold": int(payload.pass_threshold) if payload.pass_threshold is not None else 60,
        "max_attempts": int(payload.max_attempts) if payload.max_attempts is not None else 0,
    }
    await db.program_lessons.insert_one(lesson_doc)
    lesson_doc.pop("_id", None)
    video_doc.pop("_id", None)
    lesson_doc["video"] = video_doc
    return lesson_doc


@api.patch("/admin/lessons/{lesson_id}")
async def admin_update_lesson(lesson_id: str, payload: LessonPatch, request: Request):
    await require_role(request, ["admin", "instructor"])
    lesson = await db.program_lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    lesson_updates: Dict[str, Any] = {}
    if payload.is_free_preview is not None:
        lesson_updates["is_free_preview"] = payload.is_free_preview
    if payload.order_index is not None:
        lesson_updates["order_index"] = payload.order_index
    if payload.requires_submission is not None:
        lesson_updates["requires_submission"] = bool(payload.requires_submission)
    if payload.assignment_prompt is not None:
        lesson_updates["assignment_prompt"] = payload.assignment_prompt or None
    if payload.pass_threshold is not None:
        lesson_updates["pass_threshold"] = int(payload.pass_threshold)
    if payload.max_attempts is not None:
        lesson_updates["max_attempts"] = max(0, int(payload.max_attempts))
    if lesson_updates:
        await db.program_lessons.update_one({"id": lesson_id}, {"$set": lesson_updates})

    video_updates: Dict[str, Any] = {}
    if payload.title is not None:
        video_updates["title"] = payload.title
    if payload.description is not None:
        video_updates["description"] = payload.description
    if payload.is_private is not None:
        video_updates["is_private"] = bool(payload.is_private)
    if payload.cover_image is not None:
        video_updates["cover_image"] = payload.cover_image
    if payload.duration_minutes is not None:
        video_updates["duration_minutes"] = int(payload.duration_minutes)
    if payload.start_seconds is not None:
        video_updates["start_seconds"] = int(payload.start_seconds)
    if payload.end_seconds is not None:
        video_updates["end_seconds"] = int(payload.end_seconds)
    if payload.youtube_url is not None:
        yid = _yt_id(payload.youtube_url)
        if not yid:
            raise HTTPException(400, "Not a valid YouTube link.")
        video_updates.update({
            "video_url": f"https://www.youtube.com/watch?v={yid}",
            "source_type": "youtube", "source_url": payload.youtube_url, "youtube_id": yid,
        })
        if payload.cover_image is None:
            video_updates["cover_image"] = f"https://img.youtube.com/vi/{yid}/hqdefault.jpg"
    # If both timestamps known after update, keep duration in sync when not explicitly set
    if "start_seconds" in video_updates or "end_seconds" in video_updates:
        cur = await db.videos.find_one({"id": lesson["video_id"]}, {"_id": 0})
        s = video_updates.get("start_seconds", (cur or {}).get("start_seconds") or 0)
        e = video_updates.get("end_seconds", (cur or {}).get("end_seconds"))
        if e is not None and e <= s:
            raise HTTPException(400, "End time must be after start time.")
        if e is not None and payload.duration_minutes is None:
            video_updates["duration_minutes"] = max(1, round((e - s) / 60))
    if video_updates:
        await db.videos.update_one({"id": lesson["video_id"]}, {"$set": video_updates})

    fresh = await db.program_lessons.find_one({"id": lesson_id}, {"_id": 0})
    fresh["video"] = await db.videos.find_one({"id": lesson["video_id"]}, {"_id": 0})
    return fresh


@api.delete("/admin/lessons/{lesson_id}")
async def admin_delete_lesson(lesson_id: str, request: Request):
    await require_role(request, ["admin", "instructor"])
    lesson = await db.program_lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    await db.program_lessons.delete_one({"id": lesson_id})
    await db.videos.delete_one({"id": lesson["video_id"]})
    return {"ok": True}


@api.post("/admin/programs/{program_id}/lessons/reorder")
async def admin_reorder_lessons(program_id: str, payload: LessonReorder, request: Request):
    await require_role(request, ["admin", "instructor"])
    for idx, lid in enumerate(payload.lesson_ids):
        await db.program_lessons.update_one(
            {"id": lid, "program_id": program_id}, {"$set": {"order_index": idx}})
    return {"ok": True}


@api.post("/admin/programs/{program_id}/lessons/bulk")
async def admin_bulk_lessons(program_id: str, payload: LessonBulk, request: Request):
    """Auto-chapters: slice ONE YouTube video into many lessons from a timestamp list.
    Each chapter's end defaults to the next chapter's start."""
    await require_role(request, ["admin", "instructor"])
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(404, "Program not found")
    yid = _yt_id(payload.youtube_url)
    if not yid:
        raise HTTPException(400, "Not a valid YouTube link.")
    chapters = sorted(payload.chapters, key=lambda c: c.start_seconds)
    if not chapters:
        raise HTTPException(400, "Add at least one chapter (timestamp + title).")

    last = await db.program_lessons.find({"program_id": program_id}).sort("order_index", -1).to_list(1)
    nxt = (last[0]["order_index"] + 1) if last else 0
    thumb = f"https://img.youtube.com/vi/{yid}/hqdefault.jpg"
    created = []
    for i, ch in enumerate(chapters):
        start = int(ch.start_seconds or 0)
        end = int(ch.end_seconds) if ch.end_seconds else (
            int(chapters[i + 1].start_seconds) if i + 1 < len(chapters) else None)
        if end is not None and end <= start:
            end = None
        dur = max(1, round((end - start) / 60)) if end else 30
        video_doc = {
            "id": gen_id(),
            "title": ch.title.strip() or f"Lesson {nxt + i + 1}",
            "description": ch.title.strip(),
            "duration_minutes": int(dur),
            "level": program.get("level", "all"),
            "style": program.get("style", "Yoga"),
            "tags": [(program.get("style") or "").lower(), "lesson"],
            "video_url": f"https://www.youtube.com/watch?v={yid}",
            "source_type": "youtube", "source_url": payload.youtube_url, "youtube_id": yid,
            "start_seconds": start, "end_seconds": end,
            "is_private": bool(payload.is_private),
            "visibility": "program", "program_id": program_id,
            "instructor_id": program.get("instructor_id"),
            "cover_image": thumb, "views": 0, "created_at": now_utc().isoformat(),
        }
        await db.videos.insert_one(video_doc)
        lesson_doc = {
            "id": gen_id(), "program_id": program_id, "video_id": video_doc["id"],
            "order_index": nxt + i,
            "is_free_preview": bool(payload.free_preview_first and i == 0),
        }
        await db.program_lessons.insert_one(lesson_doc)
        lesson_doc.pop("_id", None)
        video_doc.pop("_id", None)
        lesson_doc["video"] = video_doc
        created.append(lesson_doc)
    return {"created": len(created), "lessons": created}
