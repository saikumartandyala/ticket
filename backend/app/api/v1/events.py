"""
Public intake for browser analytics and browser errors.

The site batches events (page views, clicks, searches) and sends them here
every few seconds or when the tab is hidden. No raw IPs or form values are
stored; visitors are identified by random ids generated in their browser.
"""
from typing import Any, List, Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.observability import save_error
from app.models import AnalyticsEvent
from app.services.analytics import client_ip, hash_ip, parse_user_agent, user_id_from_request

router = APIRouter()
log = get_logger("events")
client_err_log = get_logger("client")


class WebEvent(BaseModel):
    type: Literal["page_view", "click", "search"]
    path: Optional[str] = Field(None, max_length=300)
    element: Optional[str] = Field(None, max_length=160)
    target_url: Optional[str] = Field(None, max_length=500)
    referrer: Optional[str] = Field(None, max_length=500)
    utm_source: Optional[str] = Field(None, max_length=100)
    utm_medium: Optional[str] = Field(None, max_length=100)
    utm_campaign: Optional[str] = Field(None, max_length=100)
    screen: Optional[str] = Field(None, max_length=20)
    properties: Optional[dict[str, Any]] = None


class EventBatch(BaseModel):
    visitor_id: str = Field(..., min_length=8, max_length=64)
    session_id: str = Field(..., min_length=8, max_length=64)
    events: List[WebEvent] = Field(..., max_length=50)


def _external_referrer(ref: Optional[str], host: str) -> Optional[str]:
    """Keep only referrers from other sites (internal navigation isn't a source)."""
    if not ref:
        return None
    try:
        h = urlparse(ref).hostname or ""
    except Exception:
        return None
    if not h or h == host or h in ("localhost", "127.0.0.1"):
        return None
    return h[:500]


@router.post("/events", status_code=204)
async def collect(batch: EventBatch, request: Request, db: AsyncSession = Depends(get_db)):
    ua = parse_user_agent(request.headers.get("user-agent") or "")
    if ua["device_type"] == "bot":
        return Response(status_code=204)
    uid = user_id_from_request(request)
    iph = hash_ip(client_ip(request))
    site_host = urlparse(request.headers.get("origin") or "").hostname or ""

    for e in batch.events:
        props = e.properties or None
        if props and len(str(props)) > 2000:
            props = {"truncated": True}
        db.add(AnalyticsEvent(
            event_type=e.type, source="web", visitor_id=batch.visitor_id, session_id=batch.session_id, user_id=uid,
            path=e.path, element=e.element, target_url=e.target_url,
            referrer=_external_referrer(e.referrer, site_host),
            utm_source=e.utm_source, utm_medium=e.utm_medium, utm_campaign=e.utm_campaign,
            device_type=ua["device_type"], browser=ua["browser"], os=ua["os"], screen=e.screen, ip_hash=iph,
            properties=props,
        ))
    await db.commit()
    log.debug("stored %d web events visitor=%s", len(batch.events), batch.visitor_id[:8])
    return Response(status_code=204)


class ClientError(BaseModel):
    message: str = Field(..., max_length=2000)
    stack: Optional[str] = Field(None, max_length=10000)
    path: Optional[str] = Field(None, max_length=300)
    kind: Literal["error", "unhandledrejection", "react"] = "error"


@router.post("/events/error", status_code=204)
async def client_error(err: ClientError, request: Request):
    ua = request.headers.get("user-agent") or ""
    if parse_user_agent(ua)["device_type"] == "bot":
        return Response(status_code=204)
    client_err_log.error("browser %s on %s - %s", err.kind, err.path or "?", err.message[:300])
    await save_error(
        source="client", level="error", path=err.path, error_type=err.kind, message=err.message, stack=err.stack,
        user_id=user_id_from_request(request), user_agent=ua[:300],
    )
    return Response(status_code=204)
