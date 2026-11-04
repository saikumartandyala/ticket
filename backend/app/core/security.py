"""
Passwords, one-time codes and session tokens.

Passwords (and OTP codes) are stored as salted PBKDF2-HMAC-SHA256:

    pbkdf2_sha256$<iterations>$<salt, base64>$<hash, base64>

- SHA-256 is the hash function; PBKDF2 runs it 600,000 times (OWASP 2023
  recommendation) so each guess is expensive for an attacker.
- Every password gets its own random 16-byte salt from the OS CSPRNG, so two
  users with the same password get different hashes and rainbow tables fail.
- Comparison is constant-time.
- Older bcrypt hashes still verify and are upgraded to this format the next
  time that user signs in.

Session tokens are short JWTs (HS256, PyJWT) that carry the user id and the
user's `token_version`. Bumping `users.token_version` (sign-out, password
change, ban) instantly invalidates every token issued before it.
"""
import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt

from app.core.config import settings

PASSWORD_SCHEME = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 16

_ISSUER = "tickorbit-api"

# "__Host-" makes the browser enforce Secure, Path=/ and no Domain, so the
# session cookie only ever travels over HTTPS to this exact API host.
SESSION_COOKIE = "__Host-tickorbit_session"


def create_access_token(subject: Any, version: int = 0, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    claims = {"sub": str(subject), "ver": int(version or 0), "iat": now, "exp": expire, "iss": _ISSUER}
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Return the claims of a valid, unexpired token, or None. Never raises."""
    if not token or len(token) > 2048:
        return None
    try:
        claims = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            issuer=_ISSUER,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
    except jwt.PyJWTError:
        return None
    return claims if isinstance(claims.get("sub"), str) else None


def generate_otp() -> str:
    """6-digit code from the OS CSPRNG (never `random`)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text + "=" * (-len(text) % 4))


def _pbkdf2(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def get_password_hash(password: str) -> str:
    """Salted PBKDF2-HMAC-SHA256 hash, safe to store in the database."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = _pbkdf2(password, salt, PBKDF2_ITERATIONS)
    return f"{PASSWORD_SCHEME}${PBKDF2_ITERATIONS}${_b64(salt)}${_b64(digest)}"


# Used when an account doesn't exist, so a failed login takes as long as a real
# one and response timing can't reveal which emails are registered. Built on
# first use (not at import) so cold starts don't pay for it.
_dummy_hash: Optional[str] = None


def _get_dummy_hash() -> str:
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = get_password_hash(secrets.token_urlsafe(16))
    return _dummy_hash


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Constant-time check of a password against a stored hash. Never raises."""
    if not hashed_password:
        verify_password(plain_password, _get_dummy_hash())
        return False
    try:
        if hashed_password.startswith(PASSWORD_SCHEME + "$"):
            _, iterations, salt, expected = hashed_password.split("$")
            actual = _pbkdf2(plain_password, _unb64(salt), int(iterations))
            return hmac.compare_digest(actual, _unb64(expected))
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):  # legacy bcrypt
            return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("ascii"))
    except (ValueError, TypeError):
        return False
    return False


def password_needs_rehash(hashed_password: Optional[str]) -> bool:
    """True for legacy (bcrypt) or weaker-than-current hashes."""
    if not hashed_password or not hashed_password.startswith(PASSWORD_SCHEME + "$"):
        return True
    try:
        return int(hashed_password.split("$")[1]) < PBKDF2_ITERATIONS
    except (IndexError, ValueError):
        return True


# --- Async wrappers -----------------------------------------------------------
# PBKDF2 takes ~0.25 s of CPU on purpose. Running it on a worker thread keeps
# the event loop free, so other requests on the same instance aren't frozen.

async def averify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(verify_password, plain_password, hashed_password)


async def aget_password_hash(password: str) -> str:
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(get_password_hash, password)
