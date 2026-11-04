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

# Local photo storage (development only; production uses Supabase Storage).
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
if not settings.uses_cloud_storage:
    os.makedirs(UPLOAD_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Auto create tables and insert seed data
    db_kind = engine.url.get_backend_name()
    log.info("Starting %s (%s) - database: %s, timezone: %s, log level: %s",
             settings.PROJECT_NAME, settings.ENVIRONMENT, db_kind, settings.APP_TIMEZONE, settings.LOG_LEVEL.upper())
    log.info("HTTPS required: %s, allowed origins: %s", settings.FORCE_HTTPS, ", ".join(settings.frontend_origins))
    from app.core.startup import run_startup
    await run_startup()
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

# Serve locally stored ticket photos (development only).
if not settings.uses_cloud_storage:
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

