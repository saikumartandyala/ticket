import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_

from app.workers.celery_app import celery_app
from app.core.database import async_session_maker
from app.models import TicketListing, User, Notification
from app.services.sms_service import send_match_notification


async def _expire_old_listings() -> int:
    now = datetime.now(timezone.utc)
    async with async_session_maker() as db:
        result = await db.execute(
            select(TicketListing).where(
                and_(TicketListing.status == "active", TicketListing.expires_at < now)
            )
        )
        listings = result.scalars().all()
        for listing in listings:
            listing.status = "expired"
        await db.commit()
        return len(listings)


async def _send_expiry_warnings() -> int:
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=2)
    async with async_session_maker() as db:
        result = await db.execute(
            select(TicketListing).where(
                and_(
                    TicketListing.status == "active",
                    TicketListing.expires_at > now,
                    TicketListing.expires_at <= window_end,
                )
            )
        )
        listings = result.scalars().all()

        for listing in listings:
            user_res = await db.execute(select(User).where(User.id == listing.user_id))
            user = user_res.scalar_one_or_none()
            if not user:
                continue

            notif = Notification(
                user_id=user.id,
                title="Listing Expiring Soon ⏰",
                content=f"Your listing '{listing.title}' expires in under 2 hours.",
                notif_type="expiring",
                data={"listing_id": listing.id},
            )
            db.add(notif)

            if user.notification_prefs.get("sms", True):
                await send_match_notification(
                    phone=user.phone,
                    title="LastMinutePass Listing Expiring",
                    content=f"Your listing '{listing.title}' expires in under 2 hours. Manage it in the app.",
                )

        await db.commit()
        return len(listings)


@celery_app.task(name="app.workers.expiry_worker.expire_old_listings")
def expire_old_listings() -> int:
    """Beat schedule: every 30 minutes — mark past-due active listings as expired."""
    return asyncio.run(_expire_old_listings())


@celery_app.task(name="app.workers.expiry_worker.send_expiry_warnings")
def send_expiry_warnings() -> int:
    """Beat schedule: every hour — notify owners of listings expiring within 2 hours."""
    return asyncio.run(_send_expiry_warnings())
