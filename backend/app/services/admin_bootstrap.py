"""
Make sure the admin account described by ADMIN_EMAIL / ADMIN_PASSWORD exists.

Runs on every API start. The environment is the source of truth:
- no account with that email  -> create it (verified, admin)
- account exists              -> ensure it's an admin, active and unbanned,
                                 and reset its password if ADMIN_PASSWORD changed
"""
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.models import User

logger = logging.getLogger(__name__)


async def ensure_admin_account(db: AsyncSession) -> None:
    email = (settings.ADMIN_EMAIL or "").strip().lower()
    password = settings.ADMIN_PASSWORD or ""
    if not email or not password:
        return
    if len(password) < 8:
        logger.warning("ADMIN_PASSWORD is shorter than 8 characters; admin account not configured.")
        return

    user = (await db.execute(select(User).where(func.lower(User.email) == email))).scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            name=settings.ADMIN_NAME or "TickOrbit Admin",
            email_verified=True,
            password_hash=security.get_password_hash(password),
            is_admin=True,
        )
        db.add(user)
        logger.info("Created admin account %s", email)
    else:
        user.is_admin = True
        user.is_active = True
        user.is_banned = False
        user.email_verified = True
        if not user.password_hash or not security.verify_password(password, user.password_hash):
            user.password_hash = security.get_password_hash(password)
            user.token_version = (user.token_version or 0) + 1  # old admin sessions end
            logger.info("Updated admin password for %s from environment", email)
        elif security.password_needs_rehash(user.password_hash):
            user.password_hash = security.get_password_hash(password)
            logger.info("Upgraded admin password hash to PBKDF2-SHA256")
    await db.commit()
