from datetime import datetime, time, date, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, TicketListing, Category, Match, Notification
from app.schemas import ListingCreate, ListingResponse, ExpressInterestRequest, MatchResponse
from app.services.storage_service import upload_ticket_photo
from app.services.matching_service import check_seeker_alerts_for_listing
from app.services import search_service

router = APIRouter()

# ListingResponse serializes listing.owner and listing.category — with an
# async session those relationships MUST be eager-loaded here, or Pydantic
# crashes trying to lazy-load them outside the request's async context
# (SQLAlchemy MissingGreenlet error).
LISTING_EAGER_LOAD = (selectinload(TicketListing.owner), selectinload(TicketListing.category))

@router.get("", response_model=List[ListingResponse])
async def get_listings(
    category_id: Optional[int] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    event_date: Optional[date] = None,
    max_price: Optional[Decimal] = None,
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active, non-expired listings with optional filtering.
    """
    now = datetime.now(timezone.utc)
    stmt = select(TicketListing).options(*LISTING_EAGER_LOAD).where(
        TicketListing.status == "active",
        TicketListing.expires_at > now
    )
    
    if category_id:
        stmt = stmt.where(TicketListing.category_id == category_id)
    if origin:
        stmt = stmt.where(func.lower(TicketListing.origin_city).contains(origin.lower()))
    if destination:
        stmt = stmt.where(func.lower(TicketListing.destination_city).contains(destination.lower()))
    if event_date:
        stmt = stmt.where(TicketListing.event_date == event_date)
    if max_price:
        stmt = stmt.where(TicketListing.asking_price <= max_price)
    if query:
        # Simple string matching — covers both route-based listings
        # (train/bus: origin/destination) and venue-based listings
        # (IPL/concert/event: venue_name/venue_city), since only one set is
        # ever populated depending on category.
        search_filter = or_(
            func.lower(TicketListing.title).contains(query.lower()),
            func.lower(TicketListing.description).contains(query.lower()),
            func.lower(TicketListing.origin_city).contains(query.lower()),
            func.lower(TicketListing.destination_city).contains(query.lower()),
            func.lower(TicketListing.event_name).contains(query.lower()),
            func.lower(TicketListing.venue_name).contains(query.lower()),
            func.lower(TicketListing.venue_city).contains(query.lower())
        )
        stmt = stmt.where(search_filter)
        
    stmt = stmt.order_by(TicketListing.created_at.desc())
    result = await db.execute(stmt)
    listings = result.scalars().all()
    return listings

@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new ticket listing. Enforces price rules, generates expiration, indexes alerts.
    """
    # Expiry calculation: default to event_date + 23:59:59 if no departure time is set
    dep_time = payload.departure_time or time(23, 59, 59)
    expires_dt = datetime.combine(payload.event_date, dep_time)
    
    # Auto-generate title if empty
    title = payload.title
    if not title:
        category_res = await db.execute(select(Category).where(Category.id == payload.category_id))
        category = category_res.scalar_one_or_none()
        cat_name = category.name if category else "Ticket"
        if payload.origin_city and payload.destination_city:
            title = f"{payload.origin_city} → {payload.destination_city} ({cat_name})"
        elif payload.event_name:
            title = f"{payload.event_name} Ticket"
        else:
            title = f"Last-Minute {cat_name} Ticket"

    new_listing = TicketListing(
        user_id=current_user.id,
        category_id=payload.category_id,
        title=title,
        description=payload.description,
        origin_city=payload.origin_city,
        destination_city=payload.destination_city,
        operator_name=payload.operator_name,
        operator_code=payload.operator_code,
        event_name=payload.event_name,
        venue_name=payload.venue_name,
        venue_city=payload.venue_city,
        section=payload.section,
        row_number=payload.row_number,
        seat_count=payload.seat_count,
        seat_details=payload.seat_details,
        event_date=payload.event_date,
        departure_time=payload.departure_time,
        arrival_time=payload.arrival_time,
        original_price=payload.original_price,
        asking_price=payload.asking_price,
        pnr_last_four=payload.pnr_last_four,
        booking_ref=payload.booking_ref,
        ticket_photos=payload.ticket_photos,
        expires_at=expires_dt,
        status="active"
    )
    
    db.add(new_listing)
    
    # Increment user listings counter
    current_user.total_listings += 1
    
    await db.commit()
    await db.refresh(new_listing)

    # Fire off background matching check — via Celery when a broker is
    # configured (production/full stack), otherwise run inline so local dev
    # without Redis still gets alerts matched synchronously.
    if settings.REDIS_URL:
        from app.workers.match_worker import check_seeker_alerts
        check_seeker_alerts.delay(new_listing.id)
    else:
        await check_seeker_alerts_for_listing(new_listing.id, db)

    # Index into MeiliSearch when configured (no-op otherwise)
    await search_service.index_listing(new_listing)

    # Query with relations to return full schema representation
    result = await db.execute(
        select(TicketListing).options(*LISTING_EAGER_LOAD).where(TicketListing.id == new_listing.id)
    )
    return result.scalar_one()

@router.get("/{id}", response_model=ListingResponse)
async def get_listing(id: str, db: AsyncSession = Depends(get_db)):
    """
    Get a single ticket listing details.
    """
    result = await db.execute(select(TicketListing).options(*LISTING_EAGER_LOAD).where(TicketListing.id == id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
        
    # Increment view counter
    listing.view_count += 1
    await db.commit()
    
    return listing

@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_listing(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel or delete an owned active ticket listing.
    """
    result = await db.execute(select(TicketListing).where(TicketListing.id == id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this listing")
        
    listing.status = "cancelled"
    await db.commit()

    await search_service.delete_listing_from_index(id)

    return {"message": "Listing cancelled successfully"}

@router.post("/{id}/interest", response_model=MatchResponse)
async def express_interest(
    id: str,
    payload: ExpressInterestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Seeker expresses interest in an active listing, starting the match flow.
    """
    listing_res = await db.execute(select(TicketListing).where(TicketListing.id == id))
    listing = listing_res.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != "active":
        raise HTTPException(status_code=400, detail="Listing is no longer active")
    if listing.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot buy your own ticket")
        
    # Check if interest already exists
    existing_res = await db.execute(
        select(Match).where(
            Match.listing_id == id,
            Match.seeker_id == current_user.id,
            Match.status != "cancelled"
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already expressed interest in this ticket")
        
    # Create Match
    match = Match(
        listing_id=listing.id,
        seeker_id=current_user.id,
        transferor_id=listing.user_id,
        seeker_note=payload.seeker_note,
        status="pending"
    )
    db.add(match)
    
    # Increment listing metrics
    listing.interest_count += 1
    
    # Create notification for owner
    notif = Notification(
        user_id=listing.user_id,
        title="New Interest Received! 🤝",
        content=f"{current_user.name or 'A seeker'} expressed interest in your ticket '{listing.title}'",
        notif_type="interest",
        data={"listing_id": listing.id, "seeker_id": current_user.id}
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(match)

    # Query with relations — MatchResponse nests listing (which itself nests
    # owner/category) plus seeker/transferor, all must be eager-loaded.
    res = await db.execute(
        select(Match)
        .options(
            selectinload(Match.listing).selectinload(TicketListing.owner),
            selectinload(Match.listing).selectinload(TicketListing.category),
            selectinload(Match.seeker),
            selectinload(Match.transferor),
        )
        .where(Match.id == match.id)
    )
    return res.scalar_one()

@router.post("/upload-photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a ticket photo to local disk and return public relative URL.
    """
    url = await upload_ticket_photo(file)
    return {"url": url}
