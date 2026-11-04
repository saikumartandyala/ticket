"""
Ticket photo storage.

Uploads are never trusted: the bytes must decode as a real JPEG/PNG/WebP
image within size limits, and are then re-encoded from pixels. That strips
EXIF metadata (GPS location, device serial) and any payload hidden in the
file, and the stored name/extension come from us, never from the client.
"""
import io
import os
import uuid

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    with open(os.path.join(UPLOAD_DIR, name), "wb") as fh:
        fh.write(out.getvalue())
    return f"/api/v1/static/uploads/{name}"
