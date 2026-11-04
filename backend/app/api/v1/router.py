from fastapi import APIRouter, Depends

from app.api.v1 import auth, listings, matches, websocket, search, lookup, admin, admin_monitoring, events
from app.core.ratelimit import limiter

api_router = APIRouter()

# Per-IP ceilings on public endpoints (auth routes have tighter ones inside).
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(listings.router, prefix="/listings", tags=["listings"],
                          dependencies=[Depends(limiter("listings-ip", 300, 60))])
api_router.include_router(matches.router, tags=["matches_alerts_reviews"],
                          dependencies=[Depends(limiter("matches-ip", 300, 60))])
api_router.include_router(websocket.router, tags=["websockets"])
api_router.include_router(search.router, prefix="/search", tags=["search"],
                          dependencies=[Depends(limiter("search-ip", 60, 60))])
api_router.include_router(lookup.router, tags=["lookup"],
                          dependencies=[Depends(limiter("lookup-ip", 60, 60))])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(admin_monitoring.router, prefix="/admin", tags=["admin-monitoring"])
api_router.include_router(events.router, tags=["analytics"],
                          dependencies=[Depends(limiter("events-ip", 120, 60))])
