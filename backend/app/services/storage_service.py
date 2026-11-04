"""
Ticket photo storage.

Uploads are never trusted: the bytes must decode as a real JPEG/PNG/WebP
image within size limits, and are then re-encoded from pixels. That strips
EXIF metadata (GPS location, device serial) and any payload hidden in the
file, and the stored name/extension come from us, never from the client.

Where files go:
- Supabase Storage (public bucket) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  are set - required on Vercel, whose filesystem is read-only.
- backend/static/uploads otherwise (local development).
"""
import io
import os
import uuid

import httpx
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("storage")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")
CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}

MAX_BYTES = 8 * 1024 * 1024        # 8 MB upload
MAX_PIXELS = 40_000_000            # ~40 MP; blocks decompression bombs
MAX_SIDE = 2400                    # stored images are downscaled to this
ALLOWED = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def _bad(msg: str) -> HTTPException:
    return HTTPException(status_code=400, detail=msg)


async def upload_ticket_photo(file: UploadFile) -> str:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large (max 8 MB)")
    if not data:
        raise _bad("That file is empty")

    try:
        with Image.open(io.BytesIO(data), formats=list(ALLOWED)) as img:
            fmt = img.format
            if img.width * img.height > MAX_PIXELS:
                raise _bad("Photo dimensions are too large")
            img.load()
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            ext = ALLOWED[fmt]
            if ext == "jpg" and img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            out = io.BytesIO()
            save_kwargs = {"quality": 88, "optimize": True} if ext in ("jpg", "webp") else {"optimize": True}
            img.save(out, format=fmt, **save_kwargs)  # no exif= argument -> metadata dropped
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError):
        raise _bad("Upload a JPG, PNG or WebP photo")

    name = f"{uuid.uuid4().hex}.{ext}"
    if settings.uses_cloud_storage:
        return await _store_supabase(name, out.getvalue(), CONTENT_TYPES[ext])
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, name), "wb") as fh:
        fh.write(out.getvalue())
    return f"/api/v1/static/uploads/{name}"


async def _store_supabase(name: str, data: bytes, content_type: str) -> str:
    base = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    url = f"{base}/storage/v1/object/{settings.SUPABASE_BUCKET}/{name}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(url, content=data, headers={
                "Authorization": f"Bearer {key}",
                "apikey": key,
                "Content-Type": content_type,
                "Cache-Control": "public, max-age=31536000, immutable",
                "x-upsert": "false",
            })
    except httpx.HTTPError as exc:
        log.error("Photo upload to Supabase failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Couldn't save the photo right now. Please try again.")
    if res.status_code >= 300:
        log.error("Photo upload to Supabase failed: HTTP %s %s", res.status_code, res.text[:200])
        raise HTTPException(status_code=502, detail="Couldn't save the photo right now. Please try again.")
    return settings.storage_public_prefix + name
