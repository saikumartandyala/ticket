"""
Sliding-window rate limits for abuse-prone endpoints (OTP, login, public writes).

In-process memory: exact on a single server; with several serverless
instances each one enforces its own window, which still caps abuse. OTP sends
are additionally capped per identifier in the database (see auth.py), which
holds across instances.
"""
import time
from collections import deque
from typing import Deque, Dict

from fastapi import HTTPException, Request

from app.core.logging import get_logger
from app.services.analytics import client_ip, hash_ip

log = get_logger("security")

_buckets: Dict[str, Deque[float]] = {}
_MAX_KEYS = 50_000


def _prune(now: float) -> None:
    if len(_buckets) < _MAX_KEYS:
        return
    for key in [k for k, q in _buckets.items() if not q or q[-1] < now - 3600]:
        _buckets.pop(key, None)


def hit(key: str, limit: int, window_s: int) -> bool:
    """Record one hit; False if `key` already used `limit` hits in the window."""
    now = time.monotonic()
    _prune(now)
    q = _buckets.setdefault(key, deque())
    while q and q[0] <= now - window_s:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def reset(key: str) -> None:
    _buckets.pop(key, None)


def enforce(request: Request, scope: str, limit: int, window_s: int, subject: str = "") -> None:
    """Raise 429 when this client (and optional subject, e.g. an email) is over the limit."""
    who = subject.lower() if subject else (hash_ip(client_ip(request)) or "unknown")
    if not hit(f"{scope}:{who}", limit, window_s):
        log.warning("Rate limit hit: %s (%d per %ds) %s %s", scope, limit, window_s, request.method, request.url.path)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a few minutes and try again.",
            headers={"Retry-After": str(window_s)},
        )


def limiter(scope: str, limit: int, window_s: int):
    """Per-IP limit as a route dependency: `dependencies=[Depends(limiter(...))]`."""
    def _dep(request: Request) -> None:
        enforce(request, scope, limit, window_s)
    return _dep


def enforce_user(user_id: str, scope: str, limit: int, window_s: int) -> None:
    """Per-account limit for signed-in actions (posting, uploading, requesting)."""
    if not hit(f"{scope}:user:{user_id}", limit, window_s):
        log.warning("Rate limit hit: %s for user %s", scope, user_id)
        raise HTTPException(
            status_code=429,
            detail="You're doing that too often. Please try again later.",
            headers={"Retry-After": str(window_s)},
        )
