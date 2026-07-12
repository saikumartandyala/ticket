from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, TicketListing, Match, Notification, SeekerAlert, Review, Category, Message
from app.schemas import (
    MatchResponse, SeekerAlertCreate, SeekerAlertResponse, 
    ReviewCreate, ReviewResponse, CategoryBase, MessageResponse
)

router = APIRouter()

# ==========================================
# MATCHES ENDPOINTS
# ==========================================

@router.get("/matches", response_model=List[MatchResponse])
async def get_matches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all matches where current user is either seeker or transferor.
    """
    stmt = select(Match).where(
        or_(
            Match.seeker_id == current_user.id,
            Match.transferor_id == current_user.id
        )
    ).order_by(Match.updated_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/matches/{id}", response_model=MatchResponse)
async def get_match(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a match.
    """
    result = await db.execute(select(Match).where(Match.id == id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.seeker_id != current_user.id and match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this match")
        
    return match

@router.post("/matches/{id}/accept", response_model=MatchResponse)
async def accept_match(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Transferor accepts a seeker's interest. Sets status to 'accepted'.
    """
    result = await db.execute(select(Match).where(Match.id == id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the ticket seller can accept interest")
        
    if match.status != "pending":
        raise HTTPException(status_code=400, detail=f"Match is in state {match.status}, cannot accept")
        
    match.status = "accepted"
    match.updated_at = datetime.now(timezone.utc)
    
    # Update parent listing to matched
    listing_res = await db.execute(select(TicketListing).where(TicketListing.id == match.listing_id))
    listing = listing_res.scalar_one_or_none()
    if listing:
        listing.status = "matched"
        listing.matched_user_id = match.seeker_id
        listing.matched_at = datetime.now(timezone.utc)
        
    # Notify seeker
    notif = Notification(
        user_id=match.seeker_id,
        title="Interest Accepted! 🥳",
        content=f"Rahul accepted your interest in '{listing.title if listing else 'Ticket'}'! Open chat now.",
        notif_type="accept",
        data={"match_id": match.id}
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(match)
    return match

@router.post("/matches/{id}/decline", response_model=MatchResponse)
async def decline_match(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Transferor declines a seeker's interest.
    """
    result = await db.execute(select(Match).where(Match.id == id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seller can decline interest")
        
    if match.status != "pending":
        raise HTTPException(status_code=400, detail="Can only decline pending interest")
        
    match.status = "cancelled"
    match.updated_at = datetime.now(timezone.utc)
    
    # Notify seeker
    notif = Notification(
        user_id=match.seeker_id,
        title="Interest Declined",
        content="The seller declined your interest request.",
        notif_type="decline",
        data={"match_id": match.id}
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(match)
    return match

@router.post("/matches/{id}/reveal", response_model=MatchResponse)
async def reveal_contact(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reveal contact details. Both parties can see it once match is in 'accepted' or 'contact_revealed'.
    """
    result = await db.execute(select(Match).where(Match.id == id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.seeker_id != current_user.id and match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if match.status not in ("accepted", "contact_revealed"):
        raise HTTPException(status_code=400, detail="Cannot reveal contact details at this stage")
        
    match.status = "contact_revealed"
    if not match.contact_revealed_at:
        match.contact_revealed_at = datetime.now(timezone.utc)
        
    # Notify other party
    other_party_id = match.seeker_id if current_user.id == match.transferor_id else match.transferor_id
    notif = Notification(
        user_id=other_party_id,
        title="Contact Info Revealed 📞",
        content=f"{current_user.name} has revealed their phone number for communication.",
        notif_type="reveal",
        data={"match_id": match.id}
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(match)
    return match

@router.post("/matches/{id}/confirm", response_model=MatchResponse)
async def confirm_transfer(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm that the physical ticket transfer has completed successfully.
    """
    result = await db.execute(select(Match).where(Match.id == id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.seeker_id != current_user.id and match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if match.status not in ("accepted", "contact_revealed"):
        raise HTTPException(status_code=400, detail="Cannot confirm transfer at this stage")
        
    match.status = "transferred"
    match.transfer_confirmed_at = datetime.now(timezone.utc)
    match.confirmed_by = current_user.id
    match.updated_at = datetime.now(timezone.utc)
    
    # Update parent listing to transferred
    listing_res = await db.execute(select(TicketListing).where(TicketListing.id == match.listing_id))
    listing = listing_res.scalar_one_or_none()
    if listing:
        listing.status = "transferred"
        
    # Increment user counters
    seeker_res = await db.execute(select(User).where(User.id == match.seeker_id))
    seeker = seeker_res.scalar_one_or_none()
    if seeker:
        seeker.total_matches += 1
        
    seller_res = await db.execute(select(User).where(User.id == match.transferor_id))
    seller = seller_res.scalar_one_or_none()
    if seller:
        seller.total_matches += 1
        
    # Notify other party
    other_party_id = match.seeker_id if current_user.id == match.transferor_id else match.transferor_id
    notif = Notification(
        user_id=other_party_id,
        title="Transfer Confirmed! ✅",
        content="Ticket transfer marked completed! Please leave a review.",
        notif_type="confirm",
        data={"match_id": match.id}
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(match)
    return match


# ==========================================
# SEEKER ALERTS ENDPOINTS
# ==========================================

@router.get("/alerts", response_model=List[SeekerAlertResponse])
async def get_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's active seeker alerts.
    """
    stmt = select(SeekerAlert).where(
        SeekerAlert.user_id == current_user.id,
        SeekerAlert.is_active == True
    ).order_by(SeekerAlert.created_at.desc())
    
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/alerts", response_model=SeekerAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: SeekerAlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new seeker alert for notifications.
    """
    alert = SeekerAlert(
        user_id=current_user.id,
        category_id=payload.category_id,
        origin_city=payload.origin_city,
        destination_city=payload.destination_city,
        event_name=payload.event_name,
        venue_city=payload.venue_city,
        date_from=payload.date_from,
        date_to=payload.date_to,
        max_price=payload.max_price
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert

@router.delete("/alerts/{id}", status_code=status.HTTP_200_OK)
async def delete_alert(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Turn off or delete an alert.
    """
    result = await db.execute(select(SeekerAlert).where(SeekerAlert.id == id))
    alert = result.scalar_one_or_none()
    if not alert or alert.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.is_active = False
    await db.commit()
    return {"message": "Alert deleted successfully"}


# ==========================================
# REVIEWS ENDPOINTS
# ==========================================

@router.post("/reviews/{match_id}", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    match_id: str,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Leave a star rating and comment for the other party of a completed match.
    """
    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.status != "transferred":
        raise HTTPException(status_code=400, detail="Reviews can only be left for completed transfers")
        
    if match.seeker_id != current_user.id and match.transferor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to review this match")
        
    # Check if review already exists
    existing = await db.execute(
        select(Review).where(
            Review.match_id == match_id,
            Review.reviewer_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already submitted a review for this match")
        
    reviewee_id = match.transferor_id if current_user.id == match.seeker_id else match.seeker_id
    
    review = Review(
        match_id=match_id,
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(review)
    
    # Recalculate reviewee average rating
    reviewee_res = await db.execute(select(User).where(User.id == reviewee_id))
    reviewee = reviewee_res.scalar_one_or_none()
    if reviewee:
        total_rating = float(reviewee.avg_rating) * reviewee.rating_count
        reviewee.rating_count += 1
        reviewee.avg_rating = (total_rating + payload.rating) / reviewee.rating_count
        
    await db.commit()
    await db.refresh(review)
    return review


# ==========================================
# CATEGORIES ENDPOINTS
# ==========================================

@router.get("/categories", response_model=List[CategoryBase])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """
    Get all active categories.
    """
    res = await db.execute(select(Category).where(Category.is_active == True).order_by(Category.sort_order))
    return res.scalars().all()


# ==========================================
# NOTIFICATIONS ENDPOINTS
# ==========================================

@router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user notifications (last 50).
    """
    res = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return res.scalars().all()

@router.post("/notifications/read")
async def mark_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark all user notifications as read.
    """
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Notifications marked as read"}

@router.get("/matches/{id}/messages", response_model=List[MessageResponse])
async def get_match_messages(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get message history for a given match.
    """
    # Verify user is part of the match
    match_res = await db.execute(select(Match).where(Match.id == id))
    match = match_res.scalar_one_or_none()
    if not match or (match.seeker_id != current_user.id and match.transferor_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access these messages")
        
    res = await db.execute(
        select(Message)
        .where(Message.match_id == id)
        .order_by(Message.created_at.asc())
    )
    return res.scalars().all()

