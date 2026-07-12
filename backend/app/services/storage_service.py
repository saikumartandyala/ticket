import os
import uuid
import shutil
from fastapi import UploadFile
from app.core.config import settings

# Create a local directory for uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def upload_ticket_photo(file: UploadFile) -> str:
    """
    Saves uploaded file to local disk under static/uploads, 
    and returns a public URL relative path or full URL.
    In production, this would upload to Cloudflare R2 / AWS S3.
    """
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save the file locally
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return the accessible API URL path
    return f"/api/v1/static/uploads/{unique_filename}"
