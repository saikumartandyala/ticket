import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger("lastminutepass.search")

INDEX_NAME = "listings"
_client = None


def _get_client():
    """Lazily creates the MeiliSearch client. Returns None when MeiliSearch
    isn't configured — every function below then becomes a no-op so the app
    works identically with or without it, same pattern as REDIS_URL."""
    global _client
    if not settings.MEILISEARCH_URL:
        return None
    if _client is None:
        import meilisearch

        _client = meilisearch.Client(settings.MEILISEARCH_URL, settings.MEILISEARCH_MASTER_KEY)
        try:
            _client.index(INDEX_NAME).update_filterable_attributes(
                ["category_id", "status", "origin_city", "destination_city", "event_date", "asking_price"]
            )
        except Exception as e:
            logger.warning(f"MeiliSearch filterable attribute setup failed: {e}")
    return _client


def _serialize(listing) -> dict:
    return {
        "id": listing.id,
        "user_id": listing.user_id,
        "category_id": listing.category_id,
        "title": listing.title,
        "description": listing.description,
        "origin_city": listing.origin_city,
        "destination_city": listing.destination_city,
        "operator_name": listing.operator_name,
        "event_name": listing.event_name,
        "venue_name": listing.venue_name,
        "venue_city": listing.venue_city,
        "event_date": listing.event_date.isoformat() if isinstance(listing.event_date, date) else listing.event_date,
        "asking_price": float(listing.asking_price) if isinstance(listing.asking_price, Decimal) else listing.asking_price,
        "status": listing.status,
        "expires_at": listing.expires_at.isoformat() if isinstance(listing.expires_at, datetime) else listing.expires_at,
    }


async def index_listing(listing) -> None:
    client = _get_client()
    if not client:
        return
    doc = _serialize(listing)
    await run_in_threadpool(client.index(INDEX_NAME).add_documents, [doc], "id")


async def delete_listing_from_index(listing_id: str) -> None:
    client = _get_client()
    if not client:
        return
    await run_in_threadpool(client.index(INDEX_NAME).delete_document, listing_id)


async def search_listings(query: str, limit: int = 20) -> Optional[list]:
    """
    Returns MeiliSearch hits, or None if MeiliSearch isn't configured — the
    caller (api/v1/search.py) falls back to a plain DB LIKE-query in that case.
    """
    client = _get_client()
    if not client:
        return None
    result = await run_in_threadpool(
        client.index(INDEX_NAME).search, query, {"limit": limit, "filter": 'status = "active"'}
    )
    return result.get("hits", [])
