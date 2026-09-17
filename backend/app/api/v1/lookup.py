from fastapi import APIRouter, Query
from app.services.lookup_service import search_cities, search_stations

router = APIRouter()

# These are intentionally public (no auth): they're used by the "List a ticket"
# form's From/To autocomplete, which a user fills in before publishing/logging in.
# The upstream credentials stay server-side (see lookup_service).


@router.get("/lookup/cities")
async def lookup_cities(q: str = Query("", description="Search text (city/town)")):
    q = q.strip()
    if len(q) < 2:
        return {"success": True, "data": []}
    return {"success": True, "data": await search_cities(q)}


@router.get("/lookup/stations")
async def lookup_stations(q: str = Query("", description="Search text (railway station)")):
    q = q.strip()
    if len(q) < 2:
        return {"success": True, "data": []}
    return {"success": True, "data": await search_stations(q)}
