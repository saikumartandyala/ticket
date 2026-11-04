"""
Admin monitoring: visitor analytics, live activity, error log and a
browsable view of the database schema. All routes are admin-only.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import Base, get_db
from app.core.timeutil import LOCAL_TZ, UTC, as_utc, utcnow
from app.models import AdminAuditLog, AnalyticsEvent as E, ErrorLog, User

router = APIRouter()

Range = Literal["24h", "7d", "30d", "90d"]
RANGE_DELTA = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90)}
SERVER_EVENTS = ["signup", "login", "listing_created", "request_sent", "request_accepted", "transfer_completed", "review_left"]


def _iso(d: Optional[datetime]) -> Optional[str]:
    d = as_utc(d)
    return d.isoformat() if d else None


async def _scalar(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def _kpis(db: AsyncSession, start: datetime, end: datetime) -> dict:
    web = and_(E.source == "web", E.created_at >= start, E.created_at < end)
    pv = and_(web, E.event_type == "page_view")
    visitors = await _scalar(db, select(func.count(distinct(E.visitor_id))).where(pv))
    sessions = await _scalar(db, select(func.count(distinct(E.session_id))).where(pv))
    page_views = await _scalar(db, select(func.count(E.id)).where(pv))
    clicks = await _scalar(db, select(func.count(E.id)).where(web, E.event_type == "click"))
    searches = await _scalar(db, select(func.count(E.id)).where(web, E.event_type == "search"))
    single = select(E.session_id).where(pv).group_by(E.session_id).having(func.count(E.id) == 1).subquery()
    bounced = await _scalar(db, select(func.count()).select_from(single))
    server = dict((await db.execute(
        select(E.event_type, func.count(E.id)).where(E.source == "server", E.created_at >= start, E.created_at < end).group_by(E.event_type)
    )).all())
    return {
        "visitors": visitors,
        "sessions": sessions,
        "page_views": page_views,
        "clicks": clicks,
        "searches": searches,
        "pages_per_session": round(page_views / sessions, 2) if sessions else 0,
        "bounce_rate": round(bounced / sessions, 4) if sessions else 0,
        **{k: int(server.get(k, 0)) for k in SERVER_EVENTS},
    }


@router.get("/analytics")
async def analytics(
    period: Range = Query("7d", alias="range"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    end = utcnow()
    delta = RANGE_DELTA[period]
    start = end - delta
    current = await _kpis(db, start, end)
    previous = await _kpis(db, start - delta, start)

    web = and_(E.source == "web", E.created_at >= start)
    pv = and_(web, E.event_type == "page_view")

    # Time series — hourly for 24h, daily otherwise (bucketed in local time).
    hourly = period == "24h"
    if hourly:
        first = end.astimezone(LOCAL_TZ).replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)
        keys = [(first + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(24)]
    else:
        days = delta.days
        first = end.astimezone(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
        keys = [(first + timedelta(days=i)).date().isoformat() for i in range(days)]
    series = {k: {"visitors": set(), "page_views": 0, "clicks": 0, "signups": 0} for k in keys}
    rows = (await db.execute(
        select(E.created_at, E.event_type, E.visitor_id, E.source).where(E.created_at >= first.astimezone(UTC))
    )).all()
    for created, etype, vid, source in rows:
        local = as_utc(created).astimezone(LOCAL_TZ)
        k = local.strftime("%Y-%m-%dT%H:00") if hourly else local.date().isoformat()
        b = series.get(k)
        if b is None:
            continue
        if source == "web" and etype == "page_view":
            b["page_views"] += 1
            if vid:
                b["visitors"].add(vid)
        elif source == "web" and etype == "click":
            b["clicks"] += 1
        elif etype == "signup":
            b["signups"] += 1
    timeseries = [{"t": k, "visitors": len(v["visitors"]), "page_views": v["page_views"], "clicks": v["clicks"], "signups": v["signups"]} for k, v in series.items()]

    async def group(col, where, limit=8, distinct_visitors=False):
        metric = func.count(distinct(E.visitor_id)) if distinct_visitors else func.count(E.id)
        res = await db.execute(select(col, metric).where(where, col.isnot(None)).group_by(col).order_by(metric.desc()).limit(limit))
        return [{"label": r[0], "value": int(r[1])} for r in res.all()]

    top_pages = (await db.execute(
        select(E.path, func.count(E.id), func.count(distinct(E.visitor_id)))
        .where(pv, E.path.isnot(None)).group_by(E.path).order_by(func.count(E.id).desc()).limit(10)
    )).all()
    top_clicks = (await db.execute(
        select(E.element, E.path, func.count(E.id))
        .where(web, E.event_type == "click", E.element.isnot(None))
        .group_by(E.element, E.path).order_by(func.count(E.id).desc()).limit(10)
    )).all()
    top_searches = await group(E.element, and_(web, E.event_type == "search"), 8)

    referrers = await group(E.referrer, pv, 8, distinct_visitors=True)
    direct = await _scalar(db, select(func.count(distinct(E.visitor_id))).where(pv, E.referrer.is_(None)))
    if direct:
        referrers = [{"label": "Direct / none", "value": direct}] + referrers

    # Funnel: visited -> opened a ticket -> sent a request -> completed a transfer
    viewed_ticket = await _scalar(db, select(func.count(distinct(E.visitor_id))).where(pv, E.path.like("/tickets/%")))
    funnel = [
        {"label": "Visited the site", "value": current["visitors"]},
        {"label": "Opened a ticket", "value": viewed_ticket},
        {"label": "Sent a request", "value": await _scalar(db, select(func.count(distinct(E.user_id))).where(E.source == "server", E.event_type == "request_sent", E.created_at >= start))},
        {"label": "Completed a transfer", "value": await _scalar(db, select(func.count(E.id)).where(E.source == "server", E.event_type == "transfer_completed", E.created_at >= start))},
    ]

    return {
        "range": period,
        "granularity": "hour" if hourly else "day",
        "current": current,
        "previous": previous,
        "timeseries": timeseries,
        "top_pages": [{"path": r[0], "views": int(r[1]), "visitors": int(r[2])} for r in top_pages],
        "top_clicks": [{"element": r[0], "path": r[1], "clicks": int(r[2])} for r in top_clicks],
        "top_searches": top_searches,
        "referrers": referrers,
        "utm_sources": await group(E.utm_source, pv, 8, distinct_visitors=True),
        "devices": await group(E.device_type, pv, 5, distinct_visitors=True),
        "browsers": await group(E.browser, pv, 6, distinct_visitors=True),
        "os": await group(E.os, pv, 6, distinct_visitors=True),
        "funnel": funnel,
    }


@router.get("/analytics/live")
async def live(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    now = utcnow()
    active = await _scalar(db, select(func.count(distinct(E.visitor_id))).where(E.source == "web", E.created_at >= now - timedelta(minutes=5)))
    pages_now = (await db.execute(
        select(E.path, func.count(distinct(E.visitor_id)))
        .where(E.source == "web", E.event_type == "page_view", E.created_at >= now - timedelta(minutes=5))
        .group_by(E.path).order_by(func.count(distinct(E.visitor_id)).desc()).limit(6)
    )).all()
    recent = (await db.execute(select(E).order_by(E.created_at.desc()).limit(25))).scalars().all()
    return {
        "active_visitors": active,
        "active_pages": [{"path": p, "visitors": int(n)} for p, n in pages_now],
        "events": [
            {
                "id": e.id, "type": e.event_type, "source": e.source, "path": e.path, "element": e.element,
                "device": e.device_type, "browser": e.browser, "os": e.os, "visitor": (e.visitor_id or "")[:8],
                "user_id": e.user_id, "properties": e.properties, "at": _iso(e.created_at),
            }
            for e in recent
        ],
    }


# ------------------------------------------------------------------ errors

@router.get("/errors")
async def list_errors(
    source: Literal["", "server", "client"] = "",
    status: Literal["open", "resolved", "all"] = "open",
    q: str = "",
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    stmt = select(ErrorLog).order_by(ErrorLog.created_at.desc())
    if source:
        stmt = stmt.where(ErrorLog.source == source)
    if status != "all":
        stmt = stmt.where(ErrorLog.is_resolved == (status == "resolved"))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(ErrorLog.message).like(like), func.lower(ErrorLog.path).like(like), func.lower(ErrorLog.error_type).like(like)))
    total = await _scalar(db, select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = (await db.execute(stmt.offset((page - 1) * size).limit(size))).scalars().all()
    counts = dict((await db.execute(select(ErrorLog.source, func.count(ErrorLog.id)).where(ErrorLog.is_resolved == False).group_by(ErrorLog.source))).all())  # noqa: E712
    last_24h = await _scalar(db, select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= utcnow() - timedelta(hours=24)))
    return {
        "items": [
            {
                "id": e.id, "source": e.source, "level": e.level, "request_id": e.request_id, "method": e.method, "path": e.path,
                "status_code": e.status_code, "error_type": e.error_type, "message": e.message, "stack": e.stack,
                "user_id": e.user_id, "user_agent": e.user_agent, "is_resolved": e.is_resolved, "created_at": _iso(e.created_at),
            }
            for e in rows
        ],
        "total": total, "page": page, "size": size,
        "open": {"server": int(counts.get("server", 0)), "client": int(counts.get("client", 0))},
        "last_24h": last_24h,
    }


class ErrorPatch(BaseModel):
    is_resolved: bool


@router.patch("/errors/{error_id}")
async def resolve_error(error_id: str, body: ErrorPatch, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    e = (await db.execute(select(ErrorLog).where(ErrorLog.id == error_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Error not found")
    e.is_resolved = body.is_resolved
    db.add(AdminAuditLog(admin_id=admin.id, action="error.resolve" if body.is_resolved else "error.reopen", target_type="error",
                         target_id=e.id, summary=f"{'Resolved' if body.is_resolved else 'Reopened'} {e.error_type or 'error'} on {e.path or '?'}"))
    await db.commit()
    return {"id": e.id, "is_resolved": e.is_resolved}


@router.post("/errors/resolve-all")
async def resolve_all(source: Literal["", "server", "client"] = "", db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    from sqlalchemy import update
    stmt = update(ErrorLog).where(ErrorLog.is_resolved == False)  # noqa: E712
    if source:
        stmt = stmt.where(ErrorLog.source == source)
    res = await db.execute(stmt.values(is_resolved=True))
    db.add(AdminAuditLog(admin_id=admin.id, action="error.resolve_all", target_type="error", summary=f"Resolved {res.rowcount} {source or 'all'} errors"))
    await db.commit()
    return {"resolved": res.rowcount}


# ------------------------------------------------------------------ schema

@router.get("/schema")
async def schema(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    tables = []
    for t in Base.metadata.sorted_tables:
        try:
            rows = await _scalar(db, select(func.count()).select_from(t))
        except Exception:
            rows = None
        tables.append({
            "name": t.name,
            "comment": t.comment,
            "rows": rows,
            "columns": [
                {
                    "name": c.name,
                    "type": str(c.type.impl if hasattr(c.type, "impl") else c.type).replace("DATETIME", "TIMESTAMP"),
                    "nullable": bool(c.nullable),
                    "primary_key": bool(c.primary_key),
                    "unique": bool(c.unique),
                    "indexed": bool(c.index) or any(c.name in [col.name for col in ix.columns] for ix in t.indexes),
                    "foreign_key": next((f"{fk.column.table.name}.{fk.column.name}" for fk in c.foreign_keys), None),
                    "comment": c.comment,
                }
                for c in t.columns
            ],
        })
    return {"dialect": db.bind.dialect.name if db.bind else None, "tables": tables}
