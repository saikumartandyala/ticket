from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import SESSION_COOKIE, decode_access_token
from app.models import User


def get_request_token(request: Request) -> str:
    """
    Session token for this request. An explicit `Authorization: Bearer` header
    wins (scripts / API clients); browsers use the HttpOnly session cookie.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return request.cookies.get(SESSION_COOKIE, "")


# Kept for older imports.
get_token_from_cookie_or_header = get_request_token

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in to continue",
    headers={"WWW-Authenticate": "Bearer"},
)


async def user_from_token(db: AsyncSession, token: str) -> Optional[User]:
    """The active, non-banned user a token belongs to, or None."""
    claims = decode_access_token(token)
    if not claims:
        return None
    user = (await db.execute(select(User).where(User.id == claims["sub"]))).scalar_one_or_none()
    if user is None or claims.get("ver", 0) != (user.token_version or 0):
        return None
    if not user.is_active or user.is_banned:
        return None
    return user


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = get_request_token(request)
    if not token:
        raise _UNAUTHORIZED
    user = await user_from_token(db, token)
    if user is None:
        raise _UNAUTHORIZED
    request.state.user_id = user.id
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        # Same answer as a missing route, so the admin API isn't advertised.
        raise HTTPException(status_code=404, detail="Not Found")
    return user
