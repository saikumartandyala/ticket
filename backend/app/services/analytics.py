"""
Analytics helpers: who (anonymously) is visiting, from what device, and the
product events that matter. Raw IP addresses are never stored — only a
salted hash, which is enough to count unique visitors.
"""
import hashlib
import re
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models import AnalyticsEvent

log = get_logger("analytics")

BOT_RE = re.compile(r"bot|crawl|spider|slurp|preview|monitor|curl|wget|python-requests|httpx|headless", re.I)


def parse_user_agent(ua: str) -> dict[str, Optional[str]]:
    ua = ua or ""
    if not ua:
        return {"device_type": None, "browser": None, "os": None}
    if BOT_RE.search(ua):
        device = "bot"
    elif re.search(r"iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))", ua, re.I):
        device = "tablet"
    elif re.search(r"Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile", ua, re.I):
        device = "mobile"
    else:
        device = "desktop"

    if re.search(r"Edg/", ua):
        browser = "Edge"
    elif re.search(r"OPR/|Opera", ua):
        browser = "Opera"
    elif re.search(r"SamsungBrowser", ua):
        browser = "Samsung Internet"
    elif re.search(r"Firefox/|FxiOS", ua):
        browser = "Firefox"
    elif re.search(r"Chrome/|CriOS", ua):
        browser = "Chrome"
    elif re.search(r"Safari/", ua):
        browser = "Safari"
    else:
        browser = "Other"

    if re.search(r"Windows", ua):
        os_name = "Windows"
    elif re.search(r"Android", ua):
        os_name = "Android"
    elif re.search(r"iPhone|iPad|iPod", ua):
        os_name = "iOS"
    elif re.search(r"Mac OS X|Macintosh", ua):
        os_name = "macOS"
    elif re.search(r"Linux", ua):
        os_name = "Linux"
    else:
        os_name = "Other"
    return {"device_type": device, "browser": browser, "os": os_name}


def client_ip(request: Request) -> str:
    """
    The caller's IP. Forwarding headers are only believed when the app sits
    behind a proxy that overwrites them (TRUST_PROXY_HEADERS, e.g. Vercel);
    otherwise anyone could spoof them to dodge rate limits.
    """
    if settings.TRUST_PROXY_HEADERS:
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def hash_ip(ip: str) -> Optional[str]:
    if not ip:
        return None
    return hashlib.sha256(f"{settings.SECRET_KEY}:{ip}".encode()).hexdigest()[:32]


def user_id_from_request(request: Request) -> Optional[str]:
    """Best-effort: who is calling, without hitting the database. Never raises."""
    from app.api.deps import get_request_token
    from app.core.security import decode_access_token

    claims = decode_access_token(get_request_token(request))
    return claims["sub"] if claims else None


def track(db: AsyncSession, event_type: str, user_id: Optional[str] = None, properties: Optional[dict[str, Any]] = None) -> None:
    """
    Record a server-side product event in the caller's transaction.
    It is saved when the route commits, so it only exists if the action succeeded.
    """
    db.add(AnalyticsEvent(event_type=event_type, source="server", user_id=user_id, properties=properties or None))
    log.info("event %s user=%s %s", event_type, (user_id or "-")[:8], properties or "")
