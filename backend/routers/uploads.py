"""Image/file uploads to Emergent Object Storage (admin retreat photos, etc.)."""
import os
import uuid
import logging
import requests
from fastapi import Request, UploadFile, File, HTTPException, Response
from starlette.concurrency import run_in_threadpool

from core import api, db, now_utc, gen_id, require_role

_logger = logging.getLogger("tony-yoga.uploads")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "tony-yoga"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        # dead cached key — mint a fresh one and retry once
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@api.post("/admin/uploads")
async def upload_image(request: Request, file: UploadFile = File(...)):
    """Admin uploads an image; returns a public URL under /api/files/{path}."""
    await require_role(request, ["admin"])
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin").lower()
    if ext not in MIME_TYPES:
        raise HTTPException(400, "Only image files (jpg, png, gif, webp) are allowed.")
    content_type = MIME_TYPES[ext]
    path = f"{APP_NAME}/retreats/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Image too large — max {MAX_UPLOAD_BYTES // (1024*1024)} MB.")
    try:
        result = await run_in_threadpool(_put_object, path, data, content_type)
    except Exception as e:
        _logger.error(f"upload failed: {e}")
        raise HTTPException(502, "Upload failed — please try again.")
    stored_path = result["path"]
    await db.uploaded_files.insert_one({
        "id": gen_id(),
        "storage_path": stored_path,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size"),
        "is_deleted": False,
        "created_at": now_utc().isoformat(),
    })
    return {"url": f"/api/files/{stored_path}", "path": stored_path}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    """Public serve — retreat photos are public marketing content."""
    record = await db.uploaded_files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    try:
        data, content_type = await run_in_threadpool(_get_object, path)
    except Exception as e:
        _logger.error(f"serve failed for {path}: {e}")
        raise HTTPException(502, "Could not load file")
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Cache-Control": "public, max-age=86400"},
    )
