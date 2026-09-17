import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

# secure.geonames.org has a valid HTTPS cert (plain api.geonames.org does not).
GEONAMES_URL = "https://secure.geonames.org/searchJSON"
RAILRADAR_URL = "https://api.railradar.in/v1/lookup/search/stations"


async def search_cities(q: str, limit: int = 8) -> list[dict]:
    """City/town suggestions in India via GeoNames. Returns [] when the
    username isn't configured or the upstream call fails (graceful degrade)."""
    if not settings.GEONAMES_USERNAME:
        return []
    params = {
        "name_startsWith": q,
        "country": "IN",
        "featureClass": "P",          # populated places (cities/towns/villages)
        "maxRows": limit,
        "orderby": "population",       # biggest, most relevant places first
        "username": settings.GEONAMES_USERNAME,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GEONAMES_URL, params=params)
        data = resp.json()
        results: list[dict] = []
        for g in data.get("geonames", []):
            name = g.get("name")
            if not name:
                continue
            state = g.get("adminName1") or ""
            results.append({
                "name": name,
                "state": state,
                "label": f"{name}, {state}" if state else name,
                "lat": g.get("lat"),
                "lng": g.get("lng"),
                "population": g.get("population"),
            })
        return results
    except Exception as e:
        logger.error(f"GeoNames lookup error: {e}")
        return []


async def search_stations(q: str, limit: int = 10) -> list[dict]:
    """Railway station suggestions via RailRadar. Filters out inactive
    sidings/depots. Returns [] when the key isn't configured or the call fails."""
    if not settings.RAILRADAR_API_KEY:
        return []
    headers = {"Authorization": f"Bearer {settings.RAILRADAR_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(RAILRADAR_URL, params={"q": q}, headers=headers)
        data = resp.json()
        results: list[dict] = []
        for s in (data.get("data") or []):
            if not s.get("isActive"):
                continue
            code = s.get("code")
            name = s.get("name")
            if not name:
                continue
            results.append({
                "code": code,
                "name": name,
                "city": s.get("city"),
                "popularity": s.get("popularity") or 0,
                "label": f"{name} ({code})" if code else name,
            })
        # Most popular active stations first (RailRadar's own order otherwise).
        results.sort(key=lambda r: r["popularity"], reverse=True)
        return results[:limit]
    except Exception as e:
        logger.error(f"RailRadar lookup error: {e}")
        return []
