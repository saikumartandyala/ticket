import asyncio
from app.workers.celery_app import celery_app
from app.core.database import async_session_maker
from app.services.matching_service import check_seeker_alerts_for_listing


async def _run(listing_id: str) -> None:
    async with async_session_maker() as db:
        await check_seeker_alerts_for_listing(listing_id, db)


@celery_app.task(name="app.workers.match_worker.check_seeker_alerts")
def check_seeker_alerts(listing_id: str) -> None:
    """
    Runs after a new listing is created (dispatched from the listings API).
    Each Celery worker process runs this in its own event loop — reuses the
    same async matching logic the app uses inline when Celery isn't configured.
    """
    asyncio.run(_run(listing_id))
