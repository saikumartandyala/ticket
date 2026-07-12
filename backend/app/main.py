import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base, async_session_maker
from app.api.v1.router import api_router
from app.models import Category

# Static upload path setup
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Auto create tables and insert seed data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session_maker() as db:
        # Check if categories already exist
        from sqlalchemy import select
        res = await db.execute(select(Category))
        categories = res.scalars().all()
        if not categories:
            seed_data = [
                Category(slug="train", name="Train", icon="🚂", color_hex="#2563eb", sort_order=1),
                Category(slug="bus", name="Bus", icon="🚌", color_hex="#059669", sort_order=2),
                Category(slug="ipl", name="IPL", icon="🏏", color_hex="#dc2626", sort_order=3),
                Category(slug="cricket", name="Cricket", icon="🏟️", color_hex="#16a34a", sort_order=4),
                Category(slug="concert", name="Concert", icon="🎵", color_hex="#7c3aed", sort_order=5),
                Category(slug="event", name="Event", icon="🎭", color_hex="#a855f7", sort_order=6)
            ]
            db.add_all(seed_data)
            await db.commit()
            
    yield
    # Shutdown actions
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Accept all origins for development testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static folder for ticket uploads
app.mount("/api/v1/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include main API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "Welcome to LastMinutePass P2P Resale Ticket API", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

