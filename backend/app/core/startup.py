"""
Startup tasks, kept fast for serverless cold starts.

A fresh instance used to re-inspect every table and re-hash the admin
password on boot (~0.5 s each time). Now it reads two rows from `app_meta`:

- schema_version  - when it matches SCHEMA_VERSION the schema is current, so
                    create_all / column migrations / category seeding are skipped.
- admin_settings  - an HMAC of the ADMIN_* settings; when it matches, the admin
                    account is already in sync and its password isn't re-hashed.

Bump SCHEMA_VERSION whenever models or migrations change.
"""
import hashlib
import hmac

from sqlalchemy import func, inspect, select, text, update

from app.core.config import settings
from app.core.database import async_session_maker, engine, Base
from app.core.logging import get_logger
from app.core.timeutil import utcnow

log = get_logger("startup")

SCHEMA_VERSION = "2026-11-05.1"

DEFAULT_CATEGORIES = [
    dict(slug="train", name="Train", icon="🚂", color_hex="#2563eb", sort_order=1),
    dict(slug="bus", name="Bus", icon="🚌", color_hex="#059669", sort_order=2),
    dict(slug="ipl", name="IPL", icon="🏏", color_hex="#dc2626", sort_order=3),
    dict(slug="cricket", name="Cricket", icon="🏟️", color_hex="#16a34a", sort_order=4),
    dict(slug="concert", name="Concert", icon="🎵", color_hex="#7c3aed", sort_order=5),
    dict(slug="event", name="Event", icon="🎭", color_hex="#a855f7", sort_order=6),
]


def _admin_fingerprint() -> str:
    material = "\n".join([settings.ADMIN_EMAIL.strip().lower(), settings.ADMIN_PASSWORD, settings.ADMIN_NAME,
                          settings.ADMIN_EMAILS.strip().lower()])
    return hmac.new(settings.SECRET_KEY.encode(), material.encode(), hashlib.sha256).hexdigest()


def _add_missing_columns(sync_conn) -> None:
    """Forward-only migrations for columns added after a database was created."""
    cols = {c["name"] for c in inspect(sync_conn).get_columns("users")}
    if "is_admin" not in cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
    if "token_version" not in cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))


async def _read_meta() -> dict:
    try:
        async with engine.connect() as conn:
            rows = (await conn.execute(text("SELECT key, value FROM app_meta"))).all()
        return {k: v for k, v in rows}
    except Exception:  # table missing on a brand-new or older database
        return {}


async def _write_meta(db, key: str, value: str) -> None:
    from app.models import AppMeta
    row = await db.get(AppMeta, key)
    if row:
        row.value, row.updated_at = value, utcnow()
    else:
        db.add(AppMeta(key=key, value=value))


async def run_startup() -> None:
    from app.models import Category, User
    from app.services.admin_bootstrap import ensure_admin_account

    meta = await _read_meta()
    schema_current = meta.get("schema_version") == SCHEMA_VERSION
    admin_current = meta.get("admin_settings") == _admin_fingerprint()

    if not schema_current:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(_add_missing_columns)
        log.info("Database schema created/updated (%d tables)", len(Base.metadata.tables))

    if schema_current and admin_current:
        log.info("Database schema current (v%s), admin in sync - fast start", SCHEMA_VERSION)
        return

    async with async_session_maker() as db:
        if not schema_current:
            if not (await db.execute(select(func.count()).select_from(Category))).scalar():
                db.add_all([Category(**c) for c in DEFAULT_CATEGORIES])
            await _write_meta(db, "schema_version", SCHEMA_VERSION)
            await db.commit()
        if not admin_current:
            emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
            if emails:
                await db.execute(update(User).where(func.lower(User.email).in_(emails)).values(is_admin=True))
            await ensure_admin_account(db)
            await _write_meta(db, "admin_settings", _admin_fingerprint())
            await db.commit()
            log.info("Admin account synced from environment")
