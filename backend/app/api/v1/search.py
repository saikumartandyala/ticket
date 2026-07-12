from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import search_service
from app.api.v1.listings import get_listings
from app.schemas import ListingResponse

router = APIRouter()


@router.get("")
async def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search via MeiliSearch when configured; falls back to the same
    DB LIKE-query filter that /listings?query= already uses otherwise.
    """
    hits = await search_service.search_listings(q, limit)
    if hits is not None:
        return {"source": "meilisearch", "results": hits}

    # get_listings returns raw ORM objects — must serialize through
    # ListingResponse, same as /listings does via response_model, or this
    # leaks internal user fields (password_hash, is_banned, etc.) straight
    # from the User/TicketListing tables.
    orm_results = await get_listings(query=q, db=db)
    results = [ListingResponse.model_validate(r) for r in orm_results[:limit]]
    return {"source": "database", "results": results}
