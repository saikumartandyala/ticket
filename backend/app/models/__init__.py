import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, Numeric, DateTime,
    ForeignKey, JSON, Text, Date, Time, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("phone IS NOT NULL OR email IS NOT NULL", name="ck_user_identifier_required"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # A user can register with either phone or email (or both) — at least
    # one is required, enforced by the CheckConstraint above.
    phone = Column(String(15), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=True)
    avatar_url = Column(Text, nullable=True)

    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)

    total_listings = Column(Integer, default=0)
    total_matches = Column(Integer, default=0)
    avg_rating = Column(Numeric(3, 2), default=0.00)
    rating_count = Column(Integer, default=0)

    notification_prefs = Column(JSON, default=lambda: {"sms": True, "email": True, "push": True})

    is_active = Column(Boolean, default=True)
    is_banned = Column(Boolean, default=False)
    last_active_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    listings = relationship("TicketListing", foreign_keys="[TicketListing.user_id]", back_populates="owner")
    alerts = relationship("SeekerAlert", back_populates="user")
    sent_messages = relationship("Message", back_populates="sender")

class OTPSession(Base):
    __tablename__ = "otp_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Holds either a phone number or an email address, depending on channel.
    identifier = Column(String(255), nullable=False, index=True)
    channel = Column(String(10), nullable=False, default="phone")  # 'phone' | 'email'
    otp_hash = Column(String(255), nullable=False)
    purpose = Column(String(50), default="login")  # 'login' | 'reset'
    attempts = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(10), nullable=True)  # emoji
    color_hex = Column(String(7), nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

class TicketListing(Base):
    __tablename__ = "ticket_listings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    origin_city = Column(String(100), nullable=True)
    destination_city = Column(String(100), nullable=True)
    operator_name = Column(String(200), nullable=True)
    operator_code = Column(String(50), nullable=True)
    
    event_name = Column(String(200), nullable=True)
    venue_name = Column(String(200), nullable=True)
    venue_city = Column(String(100), nullable=True)
    section = Column(String(50), nullable=True)
    row_number = Column(String(20), nullable=True)
    
    seat_count = Column(Integer, default=1)
    seat_details = Column(JSON, nullable=True)
    
    event_date = Column(Date, nullable=False)
    departure_time = Column(Time, nullable=True)
    arrival_time = Column(Time, nullable=True)
    
    original_price = Column(Numeric(10, 2), nullable=False)
    asking_price = Column(Numeric(10, 2), nullable=False)
    
    pnr_last_four = Column(String(4), nullable=True)
    booking_ref = Column(String(50), nullable=True)
    
    ticket_photos = Column(JSON, default=list)  # Stored as list of URLs
    
    status = Column(String(30), default="active")  # 'active', 'matched', 'transferred', 'expired', 'cancelled', 'flagged'
    
    matched_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    matched_at = Column(DateTime, nullable=True)
    
    view_count = Column(Integer, default=0)
    interest_count = Column(Integer, default=0)
    
    expires_at = Column(DateTime, nullable=False)
    is_featured = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    owner = relationship("User", foreign_keys=[user_id], back_populates="listings")
    category = relationship("Category")
    matched_user = relationship("User", foreign_keys=[matched_user_id])

class SeekerAlert(Base):
    __tablename__ = "seeker_alerts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    origin_city = Column(String(100), nullable=True)
    destination_city = Column(String(100), nullable=True)
    event_name = Column(String(200), nullable=True)
    venue_city = Column(String(100), nullable=True)
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)
    max_price = Column(Numeric(10, 2), nullable=True)
    
    is_active = Column(Boolean, default=True)
    last_fired_at = Column(DateTime, nullable=True)
    fire_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    category = relationship("Category")

class Match(Base):
    __tablename__ = "matches"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id = Column(String, ForeignKey("ticket_listings.id", ondelete="CASCADE"), nullable=False)
    seeker_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transferor_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(String(30), default="pending")  # 'pending', 'accepted', 'contact_revealed', 'transferred', 'cancelled', 'disputed'
    
    contact_revealed_at = Column(DateTime, nullable=True)
    transfer_confirmed_at = Column(DateTime, nullable=True)
    confirmed_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    seeker_note = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    listing = relationship("TicketListing", foreign_keys=[listing_id])
    seeker = relationship("User", foreign_keys=[seeker_id])
    transferor = relationship("User", foreign_keys=[transferor_id])

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    content = Column(Text, nullable=False)
    msg_type = Column(String(20), default="text")  # 'text', 'image', 'system'
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    match = relationship("Match")
    sender = relationship("User", back_populates="sent_messages")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1 to 5 stars
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    notif_type = Column(String(50), nullable=False)  # e.g., 'match', 'interest', 'message'
    is_read = Column(Boolean, default=False)
    data = Column(JSON, nullable=True)  # structured extra payload
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
