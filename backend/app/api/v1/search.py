from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import search_service
from app.api.v1.listings import get_listings

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

    results = await get_listings(query=q, db=db)
    return {"source": "database", "results": results}
