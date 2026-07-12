from fastapi import APIRouter
from app.api.v1 import auth, listings, matches, websocket

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(listings.router, prefix="/listings", tags=["listings"])
api_router.include_router(matches.router, tags=["matches_alerts_reviews"])
api_router.include_router(websocket.router, tags=["websockets"])
