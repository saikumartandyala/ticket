from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func
from app.models import SeekerAlert, TicketListing, Notification
from app.services.sms_service import send_match_notification

async def check_seeker_alerts_for_listing(listing_id: str, db: AsyncSession) -> None:
    """
    Checks if a newly created ticket listing matches any active seeker alerts.
    Fires notifications to those seekers if matched.
    """
    # Fetch listing
    result = await db.execute(select(TicketListing).where(TicketListing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        return
        
    # Query matching alerts
    # Alerts must be active, not owned by listing poster, date ranges must cover listing event_date
    query = select(SeekerAlert).where(
        and_(
            SeekerAlert.is_active == True,
            SeekerAlert.user_id != listing.user_id,
            or_(
                SeekerAlert.category_id == None,
                SeekerAlert.category_id == listing.category_id
            ),
            or_(
                SeekerAlert.origin_city == None,
                func.lower(SeekerAlert.origin_city) == func.lower(listing.origin_city)
            ),
            or_(
                SeekerAlert.destination_city == None,
                func.lower(SeekerAlert.destination_city) == func.lower(listing.destination_city)
            ),
            or_(
                SeekerAlert.event_name == None,
                func.lower(SeekerAlert.event_name) == func.lower(listing.event_name)
            ),
            or_(
                SeekerAlert.date_from == None,
                SeekerAlert.date_from <= listing.event_date
            ),
            or_(
                SeekerAlert.date_to == None,
                SeekerAlert.date_to >= listing.event_date
            ),
            or_(
                SeekerAlert.max_price == None,
                SeekerAlert.max_price >= listing.asking_price
            ),
            or_(
                SeekerAlert.expires_at == None,
                SeekerAlert.expires_at > datetime.now(timezone.utc)
            )
        )
    )
    
    alerts_result = await db.execute(query)
    alerts = alerts_result.scalars().all()
    
    for alert in alerts:
        # Create In-App Notification
        notif = Notification(
            user_id=alert.user_id,
            title="Ticket Match Found! ⚡",
            content=f"A new ticket matching your alert '{listing.title}' was listed for ₹{listing.asking_price}!",
            notif_type="match",
            data={"listing_id": listing.id, "alert_id": alert.id}
        )
        db.add(notif)
        
        # Fire SMS alert (mocked or real)
        # Fetch user phone number
        from app.models import User
        user_res = await db.execute(select(User).where(User.id == alert.user_id))
        user = user_res.scalar_one_or_none()
        if user and user.notification_prefs.get("sms", True):
            await send_match_notification(
                phone=user.phone,
                title="LastMinutePass Match",
                content=f"Ticket Match Found! {listing.title} is available for ₹{listing.asking_price}. Open LastMinutePass app to grab it!"
            )
            
        # Update alert firing metrics
        alert.last_fired_at = datetime.now(timezone.utc)
        alert.fire_count += 1
        
    await db.commit()
