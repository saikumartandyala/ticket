"""
Admin API. Every route requires an authenticated user with `is_admin`.
Every state-changing route writes an AdminAuditLog row.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.timeutil import LOCAL_TZ, UTC, as_utc, utcnow
from app.models import (
    AdminAuditLog, AnalyticsEvent, Category, ErrorLog, Match, Message, Notification, Review, SeekerAlert, TicketListing, User,
)

router = APIRouter()


# ------------------------------------------------------------------ helpers

def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _num(v: Any) -> float:
    if v is None:
        return 0.0
    return float(v) if isinstance(v, (Decimal, int, float)) else float(str(v))


def _user(u: Optional[User]) -> Optional[dict]:
    if u is None:
        return None
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "email_verified": bool(u.email_verified),
        "phone_verified": bool(u.phone_verified),
        "is_admin": bool(u.is_admin),
        "is_banned": bool(u.is_banned),
        "is_active": bool(u.is_active),
        "avg_rating": _num(u.avg_rating),
        "rating_count": u.rating_count or 0,
        "total_listings": u.total_listings or 0,
        "total_matches": u.total_matches or 0,
        "last_active_at": _iso(u.last_active_at),
        "created_at": _iso(u.created_at),
    }


def _listing(l: TicketListing) -> dict:
    return {
        "id": l.id,
        "title": l.title,
        "status": l.status,
        "is_featured": bool(l.is_featured),
        "category": {"id": l.category.id, "slug": l.category.slug, "name": l.category.name} if l.category else None,
        "origin_city": l.origin_city,
        "destination_city": l.destination_city,
        "venue_name": l.venue_name,
        "venue_city": l.venue_city,
        "event_date": l.event_date.isoformat() if l.event_date else None,
        "departure_time": l.departure_time.isoformat() if l.departure_time else None,
        "asking_price": _num(l.asking_price),
        "original_price": _num(l.original_price),
        "seat_count": l.seat_count,
        "view_count": l.view_count or 0,
        "interest_count": l.interest_count or 0,
        "expires_at": _iso(l.expires_at),
        "created_at": _iso(l.created_at),
        "owner": _user(l.owner) if "owner" in l.__dict__ else None,
    }


def _match(m: Match) -> dict:
    return {
        "id": m.id,
        "status": m.status,
        "seeker_note": m.seeker_note,
        "created_at": _iso(m.created_at),
        "updated_at": _iso(m.updated_at),
        "contact_revealed_at": _iso(m.contact_revealed_at),
        "transfer_confirmed_at": _iso(m.transfer_confirmed_at),
        "listing": {"id": m.listing.id, "title": m.listing.title, "asking_price": _num(m.listing.asking_price), "status": m.listing.status}
        if m.listing else None,
        "seeker": _user(m.seeker),
        "transferor": _user(m.transferor),
    }


async def _page(db: AsyncSession, stmt, page: int, size: int):
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset((page - 1) * size).limit(size))).scalars().all()
    return rows, total


async def _audit(db: AsyncSession, admin: User, action: str, target_type: str, target_id: Optional[str], summary: str, data: Optional[dict] = None):
    db.add(AdminAuditLog(admin_id=admin.id, action=action, target_type=target_type, target_id=target_id, summary=summary, data=data))


def _like(col, q: str):
    return func.lower(col).contains(q.lower())


MATCH_LOAD = (
    selectinload(Match.listing),
    selectinload(Match.seeker),
    selectinload(Match.transferor),
)


# ------------------------------------------------------------------ overview

@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    now = utcnow()
    week_ago = now - timedelta(days=7)

    async def count(stmt) -> int:
        return (await db.execute(stmt)).scalar_one() or 0

    users_total = await count(select(func.count(User.id)))
    users_new_7d = await count(select(func.count(User.id)).where(User.created_at >= week_ago))
    users_banned = await count(select(func.count(User.id)).where(User.is_banned == True))  # noqa: E712
    admins = await count(select(func.count(User.id)).where(User.is_admin == True))  # noqa: E712

    listing_status = dict((await db.execute(select(TicketListing.status, func.count(TicketListing.id)).group_by(TicketListing.status))).all())
    live_listings = await count(
        select(func.count(TicketListing.id)).where(TicketListing.status == "active", TicketListing.expires_at > now)
    )
    listings_new_7d = await count(select(func.count(TicketListing.id)).where(TicketListing.created_at >= week_ago))
    featured = await count(select(func.count(TicketListing.id)).where(TicketListing.is_featured == True))  # noqa: E712

    match_status = dict((await db.execute(select(Match.status, func.count(Match.id)).group_by(Match.status))).all())
    transferred_value = (
        await db.execute(
            select(func.coalesce(func.sum(TicketListing.asking_price), 0))
            .select_from(Match)
            .join(TicketListing, TicketListing.id == Match.listing_id)
            .where(Match.status == "transferred")
        )
    ).scalar_one()
    saved_value = (
        await db.execute(
            select(func.coalesce(func.sum(TicketListing.original_price - TicketListing.asking_price), 0))
            .select_from(Match)
            .join(TicketListing, TicketListing.id == Match.listing_id)
            .where(Match.status == "transferred")
        )
    ).scalar_one()

    messages = await count(select(func.count(Message.id)))
    alerts_active = await count(select(func.count(SeekerAlert.id)).where(SeekerAlert.is_active == True))  # noqa: E712
    reviews_total = await count(select(func.count(Review.id)))
    reviews_avg = (await db.execute(select(func.avg(Review.rating)))).scalar_one()

    by_category = (
        await db.execute(
            select(Category.id, Category.name, Category.slug, func.count(TicketListing.id))
            .select_from(Category)
            .outerjoin(TicketListing, TicketListing.category_id == Category.id)
            .group_by(Category.id, Category.name, Category.slug)
            .order_by(Category.sort_order)
        )
    ).all()

    total_matches = sum(match_status.values())
    transfers = match_status.get("transferred", 0)

    return {
        "users": {"total": users_total, "new_7d": users_new_7d, "banned": users_banned, "admins": admins},
        "listings": {
            "total": sum(listing_status.values()),
            "live": live_listings,
            "new_7d": listings_new_7d,
            "featured": featured,
            "by_status": listing_status,
        },
        "matches": {
            "total": total_matches,
            "by_status": match_status,
            "transferred": transfers,
            "conversion": round(transfers / total_matches, 4) if total_matches else 0,
            "value_transferred": _num(transferred_value),
            "buyer_savings": _num(saved_value),
        },
        "messages": messages,
        "alerts_active": alerts_active,
        "reviews": {"total": reviews_total, "avg": round(_num(reviews_avg), 2) if reviews_avg else None},
        "by_category": [{"id": r[0], "name": r[1], "slug": r[2], "listings": r[3]} for r in by_category],
        "traffic": {
            "visitors_today": await count(select(func.count(func.distinct(AnalyticsEvent.visitor_id))).where(
                AnalyticsEvent.source == "web", AnalyticsEvent.created_at >= datetime.now(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0))),
            "page_views_7d": await count(select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.source == "web", AnalyticsEvent.event_type == "page_view", AnalyticsEvent.created_at >= week_ago)),
        },
        "attention": {
            "open_errors": await count(select(func.count(ErrorLog.id)).where(ErrorLog.is_resolved == False)),  # noqa: E712
            "flagged_listings": listing_status.get("flagged", 0),
            "disputed_transfers": match_status.get("disputed", 0),
            "pending_requests": match_status.get("pending", 0),
        },
    }


@router.get("/activity")
async def activity(days: int = Query(14, ge=7, le=90), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    """Per-day counts for the last N days (UTC). Bucketed in Python so it works on SQLite and Postgres alike."""
    local_start = datetime.now(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    start = local_start.astimezone(UTC)
    keys = [(local_start + timedelta(days=i)).date().isoformat() for i in range(days)]
    series: dict[str, dict[str, int]] = {k: {"signups": 0, "listings": 0, "requests": 0, "transfers": 0} for k in keys}

    async def bucket(col, metric: str, *where):
        rows = (await db.execute(select(col).where(col >= start, *where))).scalars().all()
        for d in rows:
            k = as_utc(d).astimezone(LOCAL_TZ).date().isoformat()
            if k in series:
                series[k][metric] += 1

    await bucket(User.created_at, "signups")
    await bucket(TicketListing.created_at, "listings")
    await bucket(Match.created_at, "requests")
    await bucket(Match.transfer_confirmed_at, "transfers", Match.transfer_confirmed_at.isnot(None))

    return [{"date": k, **v} for k, v in series.items()]


@router.get("/recent")
async def recent(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    """A merged feed of the latest platform events."""
    users = (await db.execute(select(User).order_by(User.created_at.desc()).limit(8))).scalars().all()
    listings = (
        await db.execute(select(TicketListing).options(selectinload(TicketListing.owner)).order_by(TicketListing.created_at.desc()).limit(8))
    ).scalars().all()
    matches = (await db.execute(select(Match).options(*MATCH_LOAD).order_by(Match.updated_at.desc()).limit(8))).scalars().all()

    feed = []
    for u in users:
        feed.append({"type": "signup", "at": _iso(u.created_at), "text": f"{u.name or u.email or 'Someone'} joined", "ref": u.id})
    for l in listings:
        who = l.owner.name if l.owner and l.owner.name else "A seller"
        feed.append({"type": "listing", "at": _iso(l.created_at), "text": f"{who} listed {l.title}", "ref": l.id})
    for m in matches:
        title = m.listing.title if m.listing else "a ticket"
        seeker = m.seeker.name if m.seeker and m.seeker.name else "A buyer"
        verb = {
            "pending": "requested",
            "accepted": "was accepted for",
            "contact_revealed": "is in contact about",
            "transferred": "completed the transfer of",
            "declined": "was declined for",
            "disputed": "raised a dispute on",
        }.get(m.status, f"({m.status})")
        feed.append({"type": f"match.{m.status}", "at": _iso(m.updated_at), "text": f"{seeker} {verb} {title}", "ref": m.id})
    feed.sort(key=lambda x: x["at"] or "", reverse=True)
    return feed[:14]


# ------------------------------------------------------------------ users

@router.get("/users")
async def list_users(
    q: str = "",
    filter: Literal["all", "admins", "banned", "inactive"] = "all",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        stmt = stmt.where(or_(_like(User.name, q), _like(User.email, q), _like(User.phone, q)))
    if filter == "admins":
        stmt = stmt.where(User.is_admin == True)  # noqa: E712
    elif filter == "banned":
        stmt = stmt.where(User.is_banned == True)  # noqa: E712
    elif filter == "inactive":
        stmt = stmt.where(User.is_active == False)  # noqa: E712
    rows, total = await _page(db, stmt, page, size)
    return {"items": [_user(u) for u in rows], "total": total, "page": page, "size": size}


@router.get("/users/{user_id}")
async def user_detail(user_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    listings = (
        await db.execute(
            select(TicketListing).options(selectinload(TicketListing.category))
            .where(TicketListing.user_id == user_id).order_by(TicketListing.created_at.desc()).limit(50)
        )
    ).scalars().all()
    matches = (
        await db.execute(
            select(Match).options(*MATCH_LOAD)
            .where(or_(Match.seeker_id == user_id, Match.transferor_id == user_id))
            .order_by(Match.updated_at.desc()).limit(50)
        )
    ).scalars().all()
    reviews = (
        await db.execute(select(Review).where(Review.reviewee_id == user_id).order_by(Review.created_at.desc()).limit(50))
    ).scalars().all()
    return {
        "user": _user(u),
        "listings": [_listing(l) for l in listings],
        "matches": [_match(m) for m in matches],
        "reviews": [{"id": r.id, "rating": r.rating, "comment": r.comment, "created_at": _iso(r.created_at)} for r in reviews],
    }


class UserPatch(BaseModel):
    is_banned: Optional[bool] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id and (body.is_banned or body.is_active is False or body.is_admin is False):
        raise HTTPException(400, "You can't ban, deactivate or remove admin rights from your own account")

    changes = []
    if body.is_banned is not None and body.is_banned != bool(u.is_banned):
        u.is_banned = body.is_banned
        changes.append("banned" if body.is_banned else "unbanned")
        if body.is_banned:
            # Take a banned user's open listings off the board.
            live = (await db.execute(select(TicketListing).where(TicketListing.user_id == u.id, TicketListing.status == "active"))).scalars().all()
            for l in live:
                l.status = "flagged"
            if live:
                changes.append(f"{len(live)} listing(s) flagged")
    if body.is_active is not None and body.is_active != bool(u.is_active):
        u.is_active = body.is_active
        changes.append("reactivated" if body.is_active else "deactivated")
    if body.is_admin is not None and body.is_admin != bool(u.is_admin):
        u.is_admin = body.is_admin
        changes.append("made admin" if body.is_admin else "admin removed")

    if changes:
        await _audit(db, admin, "user.update", "user", u.id, f"{u.name or u.email}: {', '.join(changes)}", body.model_dump(exclude_none=True))
    await db.commit()
    await db.refresh(u)
    return _user(u)


# ------------------------------------------------------------------ listings

@router.get("/listings")
async def list_listings(
    q: str = "",
    status: str = "",
    category_id: Optional[int] = None,
    featured: Optional[bool] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    stmt = select(TicketListing).options(selectinload(TicketListing.owner), selectinload(TicketListing.category)).order_by(TicketListing.created_at.desc())
    if q:
        stmt = stmt.where(or_(
            _like(TicketListing.title, q), _like(TicketListing.origin_city, q), _like(TicketListing.destination_city, q),
            _like(TicketListing.venue_name, q), _like(TicketListing.venue_city, q), _like(TicketListing.event_name, q),
        ))
    if status:
        stmt = stmt.where(TicketListing.status == status)
    if category_id:
        stmt = stmt.where(TicketListing.category_id == category_id)
    if featured is not None:
        stmt = stmt.where(TicketListing.is_featured == featured)
    rows, total = await _page(db, stmt, page, size)
    return {"items": [_listing(l) for l in rows], "total": total, "page": page, "size": size}


class ListingPatch(BaseModel):
    status: Optional[Literal["active", "flagged", "cancelled", "expired"]] = None
    is_featured: Optional[bool] = None


@router.patch("/listings/{listing_id}")
async def update_listing(listing_id: str, body: ListingPatch, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    l = (
        await db.execute(select(TicketListing).options(selectinload(TicketListing.owner), selectinload(TicketListing.category)).where(TicketListing.id == listing_id))
    ).scalar_one_or_none()
    if not l:
        raise HTTPException(404, "Listing not found")
    if l.status == "transferred" and body.status:
        raise HTTPException(400, "A transferred listing can't change status")

    changes = []
    if body.status and body.status != l.status:
        changes.append(f"status {l.status} → {body.status}")
        l.status = body.status
        if body.status != "active":
            from app.services import search_service
            try:
                await search_service.delete_listing_from_index(l.id)
            except Exception:
                pass
    if body.is_featured is not None and body.is_featured != bool(l.is_featured):
        l.is_featured = body.is_featured
        changes.append("featured" if body.is_featured else "unfeatured")

    if changes:
        await _audit(db, admin, "listing.update", "listing", l.id, f"{l.title}: {', '.join(changes)}", body.model_dump(exclude_none=True))
    await db.commit()
    await db.refresh(l)
    return _listing(l)


# ------------------------------------------------------------------ transfers (matches)

@router.get("/matches")
async def list_matches(
    status: str = "",
    q: str = "",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    stmt = select(Match).options(*MATCH_LOAD).order_by(Match.updated_at.desc())
    if status:
        stmt = stmt.where(Match.status == status)
    if q:
        stmt = stmt.join(TicketListing, TicketListing.id == Match.listing_id).where(_like(TicketListing.title, q))
    rows, total = await _page(db, stmt, page, size)
    return {"items": [_match(m) for m in rows], "total": total, "page": page, "size": size}


@router.get("/matches/{match_id}/messages")
async def match_messages(match_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    m = (await db.execute(select(Match).options(*MATCH_LOAD).where(Match.id == match_id))).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Transfer not found")
    msgs = (await db.execute(select(Message).where(Message.match_id == match_id).order_by(Message.created_at))).scalars().all()
    # Reading private chats is sensitive — record it.
    await _audit(db, admin, "match.view_chat", "match", match_id, f"Viewed chat for {m.listing.title if m.listing else match_id}")
    await db.commit()
    return {
        "match": _match(m),
        "messages": [{"id": x.id, "sender_id": x.sender_id, "content": x.content, "created_at": _iso(x.created_at)} for x in msgs],
    }


class MatchPatch(BaseModel):
    status: Literal["cancelled", "disputed", "accepted", "contact_revealed"]


@router.patch("/matches/{match_id}")
async def update_match(match_id: str, body: MatchPatch, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    m = (await db.execute(select(Match).options(*MATCH_LOAD).where(Match.id == match_id))).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Transfer not found")
    if m.status == "transferred":
        raise HTTPException(400, "Completed transfers can't be changed")
    old = m.status
    m.status = body.status
    m.updated_at = utcnow()
    for uid in {m.seeker_id, m.transferor_id}:
        db.add(Notification(
            user_id=uid,
            title="Transfer updated by TickOrbit",
            content=f"Our team changed the status of '{m.listing.title if m.listing else 'your transfer'}' to {body.status.replace('_', ' ')}.",
            notif_type="admin",
            data={"match_id": m.id},
        ))
    await _audit(db, admin, "match.update", "match", m.id, f"{m.listing.title if m.listing else m.id}: {old} → {body.status}")
    await db.commit()
    await db.refresh(m)
    return _match(m)


# ------------------------------------------------------------------ reviews

@router.get("/reviews")
async def list_reviews(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    stmt = select(Review).order_by(Review.created_at.desc())
    rows, total = await _page(db, stmt, page, size)
    ids = {r.reviewer_id for r in rows} | {r.reviewee_id for r in rows}
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return {
        "items": [
            {
                "id": r.id, "match_id": r.match_id, "rating": r.rating, "comment": r.comment, "created_at": _iso(r.created_at),
                "reviewer": _user(users.get(r.reviewer_id)), "reviewee": _user(users.get(r.reviewee_id)),
            }
            for r in rows
        ],
        "total": total, "page": page, "size": size,
    }


@router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    r = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Review not found")
    reviewee_id = r.reviewee_id
    await db.delete(r)
    await db.flush()
    # Recompute the reviewee's rating without this review.
    agg = (await db.execute(select(func.avg(Review.rating), func.count(Review.id)).where(Review.reviewee_id == reviewee_id))).one()
    reviewee = (await db.execute(select(User).where(User.id == reviewee_id))).scalar_one_or_none()
    if reviewee:
        reviewee.avg_rating = round(_num(agg[0]), 2) if agg[1] else 0
        reviewee.rating_count = agg[1] or 0
    await _audit(db, admin, "review.delete", "review", review_id, f"Removed a {r.rating}★ review", {"comment": r.comment})
    await db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ categories

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    rows = (
        await db.execute(
            select(Category, func.count(TicketListing.id))
            .outerjoin(TicketListing, TicketListing.category_id == Category.id)
            .group_by(Category.id).order_by(Category.sort_order)
        )
    ).all()
    return [
        {"id": c.id, "slug": c.slug, "name": c.name, "is_active": bool(c.is_active), "sort_order": c.sort_order, "listings": n}
        for c, n in rows
    ]


class CategoryPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


@router.patch("/categories/{category_id}")
async def update_category(category_id: int, body: CategoryPatch, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    c = (await db.execute(select(Category).where(Category.id == category_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Category not found")
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(c, k, v)
    if data:
        await _audit(db, admin, "category.update", "category", str(c.id), f"{c.name}: {', '.join(f'{k}={v}' for k, v in data.items())}", data)
    await db.commit()
    return {"id": c.id, "slug": c.slug, "name": c.name, "is_active": bool(c.is_active), "sort_order": c.sort_order}


# ------------------------------------------------------------------ broadcast

class Broadcast(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    content: str = Field(..., min_length=3, max_length=500)
    audience: Literal["all", "sellers", "buyers"] = "all"


@router.post("/broadcast")
async def broadcast(body: Broadcast, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    stmt = select(User.id).where(User.is_banned == False, User.is_active == True)  # noqa: E712
    if body.audience == "sellers":
        stmt = stmt.where(User.total_listings > 0)
    elif body.audience == "buyers":
        stmt = stmt.where(User.id.in_(select(Match.seeker_id)))
    ids = (await db.execute(stmt)).scalars().all()
    for uid in ids:
        db.add(Notification(user_id=uid, title=body.title, content=body.content, notif_type="announcement", data={"from": "admin"}))
    await _audit(db, admin, "broadcast.send", "broadcast", None, f"“{body.title}” to {len(ids)} {body.audience} users", body.model_dump())
    await db.commit()
    return {"sent": len(ids)}


# ------------------------------------------------------------------ audit log

@router.get("/audit")
async def audit_log(page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=100), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    stmt = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    rows, total = await _page(db, stmt, page, size)
    ids = {r.admin_id for r in rows if r.admin_id}
    admins = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()} if ids else {}
    return {
        "items": [
            {
                "id": r.id, "action": r.action, "target_type": r.target_type, "target_id": r.target_id, "summary": r.summary,
                "created_at": _iso(r.created_at),
                "admin": {"id": r.admin_id, "name": admins[r.admin_id].name if r.admin_id in admins else None,
                          "email": admins[r.admin_id].email if r.admin_id in admins else None},
            }
            for r in rows
        ],
        "total": total, "page": page, "size": size,
    }
