import os
from fastapi import FastAPI

from app.core.logging import get_logger, setup_logging

# Configure terminal logging before anything else logs.
setup_logging()
log = get_logger("startup")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base, async_session_maker
from app.api.v1.router import api_router
from app.core import http_security, observability
from app.models import Category

# Static upload path setup
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _add_missing_columns(sync_conn):
    """Tiny forward-only migration for columns added after a DB was created
    (create_all never alters existing tables)."""
    from sqlalchemy import inspect, text
    cols = {c["name"] for c in inspect(sync_conn).get_columns("users")}
    if "is_admin" not in cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
    if "token_version" not in cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Auto create tables and insert seed data
    db_kind = engine.url.get_backend_name()
    log.info("Starting %s (%s) - database: %s, timezone: %s, log level: %s",
             settings.PROJECT_NAME, settings.ENVIRONMENT, db_kind, settings.APP_TIMEZONE, settings.LOG_LEVEL.upper())
    log.info("HTTPS required: %s, allowed origins: %s", settings.FORCE_HTTPS, ", ".join(settings.frontend_origins))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
    log.info("Database schema ready (%d tables)", len(Base.metadata.tables))
        
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

        # Promote configured admin emails.
        admin_emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
        if admin_emails:
            from sqlalchemy import update, func
            from app.models import User
            await db.execute(update(User).where(func.lower(User.email).in_(admin_emails)).values(is_admin=True))
            await db.commit()

        from app.services.admin_bootstrap import ensure_admin_account
        await ensure_admin_account(db)

    log.info("API ready at %s", settings.API_V1_STR)
            
    yield
    # Shutdown actions
    log.info("Shutting down")
    await engine.dispose()

# Interactive API docs only in development: production doesn't advertise its surface.
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=None if settings.is_production else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

# Request logging, error capture and X-Request-ID on every response.
observability.install(app)

# HTTPS enforcement + security headers on every response.
http_security.install(app)

# CORS: only our own frontend origins may call the API with the session cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
    max_age=600,
)

# Mount static folder for ticket uploads
app.mount("/api/v1/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include main API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "TickOrbit API", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, server_header=False,
                ssl_keyfile="../certs/localhost-key.pem", ssl_certfile="../certs/localhost.pem")

