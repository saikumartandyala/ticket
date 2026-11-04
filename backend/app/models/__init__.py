"""
TickOrbit database schema.

Conventions
-----------
- Primary keys: UUID strings (`id`), except `categories.id` (small integer).
- Timestamps: `UTCDateTime` — always stored in UTC, always timezone-aware in
  Python. Columns ending in `_at` are timestamps; `event_date` / `*_time` are
  the user's wall-clock values in APP_TIMEZONE.
- Money: NUMERIC(10, 2) in Indian rupees.
- Status columns are short lowercase strings; allowed values are listed in
  each column's comment.
- Every table and column carries a `comment` so the schema is self-describing
  in Postgres tools (Supabase table editor, psql \\d+, etc.).

Tables
------
  users               people with an account
  otp_sessions        one-time codes sent for sign-up / password reset
  categories          ticket types (Train, Bus, IPL, ...)
  ticket_listings     tickets offered on the board
  seeker_alerts       saved searches that notify a buyer
  matches             a buyer's request for a listing, through to handover
  messages            chat messages inside a match
  reviews             ratings left after a completed transfer
  notifications       in-app notification bell items
  admin_audit_logs    every change made from the admin console
  analytics_events    page views, clicks and product events (visitors)
  error_logs          server and browser errors, for monitoring
"""
import uuid

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Column, Date, ForeignKey, Index, Integer, Numeric, String, Text, Time,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import UTCDateTime, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


def created_at_col(**kw):
    return Column(UTCDateTime, nullable=False, default=utcnow, comment="When the row was created (UTC)", **kw)


def updated_at_col():
    return Column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow, comment="When the row was last changed (UTC)")


# ============================================================ accounts

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("phone IS NOT NULL OR email IS NOT NULL", name="ck_user_identifier_required"),
        {"comment": "People with a TickOrbit account (buyers, sellers and admins)."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    # A user registers with phone or email (or both); at least one is required.
    phone = Column(String(15), unique=True, nullable=True, index=True, comment="E.164 phone number, e.g. +919876543210")
    email = Column(String(255), unique=True, nullable=True, index=True, comment="Login email (lowercase)")
    password_hash = Column(String(255), nullable=True, comment="Salted PBKDF2-HMAC-SHA256 hash: pbkdf2_sha256$iterations$salt$hash (never the password itself); NULL until the user sets one")
    name = Column(String(100), nullable=True, comment="Display name shown on listings and in chat")
    avatar_url = Column(Text, nullable=True, comment="Profile picture URL")

    phone_verified = Column(Boolean, default=False, comment="Phone confirmed by OTP")
    email_verified = Column(Boolean, default=False, comment="Email confirmed by OTP")

    total_listings = Column(Integer, default=0, comment="Count of listings ever created")
    total_matches = Column(Integer, default=0, comment="Count of completed transfers (as buyer or seller)")
    avg_rating = Column(Numeric(3, 2), default=0.00, comment="Average review rating received, 0–5")
    rating_count = Column(Integer, default=0, comment="Number of reviews received")

    notification_prefs = Column(JSON, default=lambda: {"sms": True, "email": True, "push": True}, comment="Channel opt-ins")

    is_active = Column(Boolean, default=True, comment="FALSE = deactivated by an admin; cannot sign in")
    is_banned = Column(Boolean, default=False, index=True, comment="TRUE = banned by an admin; cannot sign in")
    is_admin = Column(Boolean, default=False, nullable=False, comment="Can access the admin console")
    token_version = Column(Integer, default=0, nullable=False, server_default="0",
                           comment="Bumped on sign-out, password change or ban; invalidates every older session token")
    last_active_at = Column(UTCDateTime, nullable=True, comment="Last successful sign-in (UTC)")
    created_at = created_at_col(index=True)
    updated_at = updated_at_col()

    listings = relationship("TicketListing", foreign_keys="[TicketListing.user_id]", back_populates="owner")
    alerts = relationship("SeekerAlert", back_populates="user")
    sent_messages = relationship("Message", back_populates="sender")


class OTPSession(Base):
    __tablename__ = "otp_sessions"
    __table_args__ = {"comment": "One-time codes sent by email/SMS for sign-up and password reset."}

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    identifier = Column(String(255), nullable=False, index=True, comment="Phone number or email the code was sent to")
    channel = Column(String(10), nullable=False, default="phone", comment="phone | email")
    otp_hash = Column(String(255), nullable=False, comment="Salted PBKDF2-HMAC-SHA256 hash of the 6-digit code (never stored in plain text)")
    purpose = Column(String(50), default="login", comment="login | reset")
    attempts = Column(Integer, default=0, comment="Wrong guesses so far")
    is_used = Column(Boolean, default=False, comment="TRUE once the code has been redeemed")
    expires_at = Column(UTCDateTime, nullable=False, comment="Code stops working after this (UTC)")
    created_at = created_at_col()


# ============================================================ marketplace

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = {"comment": "Ticket types shown on the board. Hidden categories (is_active = FALSE) disappear from the site."}

    id = Column(Integer, primary_key=True, autoincrement=True, comment="Small integer id")
    slug = Column(String(50), unique=True, nullable=False, comment="URL-safe key, e.g. train")
    name = Column(String(100), nullable=False, comment="Display name, e.g. Train")
    icon = Column(String(10), nullable=True, comment="Legacy emoji icon (the UI uses its own icons)")
    color_hex = Column(String(7), nullable=True, comment="Legacy accent colour")
    is_active = Column(Boolean, default=True, comment="FALSE = hidden from the site, no new listings")
    sort_order = Column(Integer, default=0, comment="Display order, ascending")


class TicketListing(Base):
    __tablename__ = "ticket_listings"
    __table_args__ = (
        Index("ix_listings_status_expires", "status", "expires_at"),
        {"comment": "Tickets offered for transfer. Visible on the board while status = active and expires_at is in the future."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="Seller (users.id)")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True, comment="categories.id")

    title = Column(String(200), nullable=False, comment="Headline, e.g. 'New Delhi → Mumbai Central'")
    description = Column(Text, nullable=True, comment="Seller's note to buyers")

    # Route tickets (train / bus)
    origin_city = Column(String(100), nullable=True, comment="Route start (train/bus)")
    destination_city = Column(String(100), nullable=True, comment="Route end (train/bus)")
    operator_name = Column(String(200), nullable=True, comment="Train or bus operator name")
    operator_code = Column(String(50), nullable=True, comment="Train number / bus number")

    # Venue tickets (matches, concerts, events)
    event_name = Column(String(200), nullable=True, comment="Event name (venue categories)")
    venue_name = Column(String(200), nullable=True, comment="Venue, e.g. Wankhede Stadium")
    venue_city = Column(String(100), nullable=True, comment="Venue city")
    section = Column(String(50), nullable=True, comment="Stand / section")
    row_number = Column(String(20), nullable=True, comment="Row")

    seat_count = Column(Integer, default=1, comment="Number of seats included")
    seat_details = Column(JSON, nullable=True, comment='Free-form seat info, e.g. {"coach": "3A · B4", "seat": "42"}')

    event_date = Column(Date, nullable=False, comment="Travel / event date (local, APP_TIMEZONE)")
    departure_time = Column(Time, nullable=True, comment="Departure / start time (local, APP_TIMEZONE)")
    arrival_time = Column(Time, nullable=True, comment="Arrival time (local, APP_TIMEZONE)")

    original_price = Column(Numeric(10, 2), nullable=False, comment="Face value in ₹")
    asking_price = Column(Numeric(10, 2), nullable=False, comment="Seller's price in ₹ (30–90% of face value)")

    pnr_last_four = Column(String(4), nullable=True, comment="Last 4 of PNR/booking id, for buyer verification")
    booking_ref = Column(String(50), nullable=True, comment="Private booking reference (not shown publicly)")

    ticket_photos = Column(JSON, default=list, comment="List of uploaded photo URLs")

    status = Column(String(30), default="active", index=True, comment="active | matched | transferred | expired | cancelled | flagged")

    matched_user_id = Column(String, ForeignKey("users.id"), nullable=True, comment="Buyer once accepted (users.id)")
    matched_at = Column(UTCDateTime, nullable=True, comment="When a buyer was accepted (UTC)")

    view_count = Column(Integer, default=0, comment="Detail page views")
    interest_count = Column(Integer, default=0, comment="Requests received")

    expires_at = Column(UTCDateTime, nullable=False, comment="Listing closes at this moment (UTC) = event_date + departure_time in APP_TIMEZONE")
    is_featured = Column(Boolean, default=False, comment="Highlighted by an admin")

    created_at = created_at_col(index=True)
    updated_at = updated_at_col()

    owner = relationship("User", foreign_keys=[user_id], back_populates="listings")
    category = relationship("Category")
    matched_user = relationship("User", foreign_keys=[matched_user_id])


class SeekerAlert(Base):
    __tablename__ = "seeker_alerts"
    __table_args__ = {"comment": "Saved searches. When a new listing matches, the owner is notified."}

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="Alert owner (users.id)")

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, comment="Limit to a category (NULL = any)")
    origin_city = Column(String(100), nullable=True, comment="Route start to match")
    destination_city = Column(String(100), nullable=True, comment="Route end to match")
    event_name = Column(String(200), nullable=True, comment="Event name to match")
    venue_city = Column(String(100), nullable=True, comment="Venue city to match")
    date_from = Column(Date, nullable=True, comment="Earliest event date")
    date_to = Column(Date, nullable=True, comment="Latest event date")
    max_price = Column(Numeric(10, 2), nullable=True, comment="Maximum asking price in ₹")

    is_active = Column(Boolean, default=True, comment="FALSE = deleted by the user")
    last_fired_at = Column(UTCDateTime, nullable=True, comment="Last time it matched a listing (UTC)")
    fire_count = Column(Integer, default=0, comment="How many listings it has matched")

    created_at = created_at_col()
    expires_at = Column(UTCDateTime, nullable=True, comment="Stop matching after this (UTC); NULL = never")

    user = relationship("User", back_populates="alerts")
    category = relationship("Category")


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = {"comment": "A buyer's request for a listing and its lifecycle up to the handover."}

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    listing_id = Column(String, ForeignKey("ticket_listings.id", ondelete="CASCADE"), nullable=False, index=True, comment="ticket_listings.id")
    seeker_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="Buyer (users.id)")
    transferor_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="Seller (users.id)")

    status = Column(String(30), default="pending", index=True,
                    comment="pending | accepted | declined | contact_revealed | transferred | cancelled | disputed")

    contact_revealed_at = Column(UTCDateTime, nullable=True, comment="When contact details were shared (UTC)")
    transfer_confirmed_at = Column(UTCDateTime, nullable=True, comment="When the handover was confirmed (UTC)")
    confirmed_by = Column(String, ForeignKey("users.id"), nullable=True, comment="Who confirmed the handover (users.id)")

    seeker_note = Column(Text, nullable=True, comment="Buyer's note sent with the request")

    created_at = created_at_col(index=True)
    updated_at = updated_at_col()

    listing = relationship("TicketListing", foreign_keys=[listing_id])
    seeker = relationship("User", foreign_keys=[seeker_id])
    transferor = relationship("User", foreign_keys=[transferor_id])


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_match_created", "match_id", "created_at"),
        {"comment": "Chat messages between buyer and seller inside a match."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, comment="matches.id")
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="Author (users.id)")

    content = Column(Text, nullable=False, comment="Message text (max 500 chars)")
    msg_type = Column(String(20), default="text", comment="text | image | system")
    is_read = Column(Boolean, default=False, comment="Read by the recipient")
    read_at = Column(UTCDateTime, nullable=True, comment="When it was read (UTC)")

    created_at = created_at_col()

    match = relationship("Match")
    sender = relationship("User", back_populates="sent_messages")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating_range"),
        {"comment": "Ratings left after a completed transfer, one per reviewer per match."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True, comment="matches.id")
    reviewer_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="Who wrote it (users.id)")
    reviewee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="Who it's about (users.id)")

    rating = Column(Integer, nullable=False, comment="1–5 stars")
    comment = Column(Text, nullable=True, comment="Optional text (max 300 chars)")
    created_at = created_at_col()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        {"comment": "Items in a user's notification bell."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="Recipient (users.id)")
    title = Column(String(200), nullable=False, comment="Headline")
    content = Column(Text, nullable=False, comment="Body text")
    notif_type = Column(String(50), nullable=False, comment="interest | accept | decline | reveal | confirm | alert | admin | announcement")
    is_read = Column(Boolean, default=False, comment="Seen by the user")
    data = Column(JSON, nullable=True, comment='Links for the UI, e.g. {"match_id": "…"}')
    created_at = created_at_col()


# ============================================================ admin & monitoring

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    __table_args__ = {"comment": "Every change made from the admin console, and every private chat an admin opened."}

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    admin_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment="Acting admin (users.id)")
    action = Column(String(60), nullable=False, comment="e.g. user.update, listing.update, match.view_chat, broadcast.send")
    target_type = Column(String(30), nullable=False, comment="user | listing | match | review | category | broadcast")
    target_id = Column(String, nullable=True, comment="id of the affected row")
    summary = Column(Text, nullable=True, comment="Human-readable description")
    data = Column(JSON, nullable=True, comment="Request payload / extra detail")
    created_at = created_at_col(index=True)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_type_created", "event_type", "created_at"),
        Index("ix_analytics_visitor_created", "visitor_id", "created_at"),
        {"comment": "Visitor activity: page views and clicks from the browser, plus key product events recorded by the API."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    event_type = Column(String(40), nullable=False,
                        comment="page_view | click | search | signup | login | listing_created | request_sent | request_accepted | transfer_completed | review_left")
    source = Column(String(10), nullable=False, default="web", comment="web = sent by the browser, server = recorded by the API")

    visitor_id = Column(String(64), nullable=True, comment="Anonymous browser id (persists across visits)")
    session_id = Column(String(64), nullable=True, index=True, comment="Anonymous visit id (resets after 30 min idle)")
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True, comment="Signed-in user, if any")

    path = Column(String(300), nullable=True, comment="Page path, e.g. /tickets")
    element = Column(String(160), nullable=True, comment="For clicks: button/link label")
    target_url = Column(String(500), nullable=True, comment="For clicks on links: destination")
    referrer = Column(String(500), nullable=True, comment="Where the visitor came from (external referrer host/URL)")
    utm_source = Column(String(100), nullable=True, comment="Campaign source (utm_source)")
    utm_medium = Column(String(100), nullable=True, comment="Campaign medium (utm_medium)")
    utm_campaign = Column(String(100), nullable=True, comment="Campaign name (utm_campaign)")

    device_type = Column(String(10), nullable=True, comment="desktop | mobile | tablet | bot")
    browser = Column(String(40), nullable=True, comment="Browser family, e.g. Chrome")
    os = Column(String(40), nullable=True, comment="Operating system, e.g. Android")
    screen = Column(String(20), nullable=True, comment="Viewport size, e.g. 390x844")
    ip_hash = Column(String(64), nullable=True, comment="Salted SHA-256 of the IP (raw IPs are never stored)")

    properties = Column(JSON, nullable=True, comment="Extra event data, e.g. listing_id, query")
    created_at = created_at_col(index=True)


class ErrorLog(Base):
    __tablename__ = "error_logs"
    __table_args__ = (
        Index("ix_errors_created", "created_at"),
        {"comment": "Unhandled server errors and browser JavaScript errors, for the admin console."},
    )

    id = Column(String, primary_key=True, default=_uuid, comment="UUID")
    source = Column(String(10), nullable=False, comment="server | client")
    level = Column(String(10), nullable=False, default="error", comment="error | warning")
    request_id = Column(String(40), nullable=True, index=True, comment="X-Request-ID, matches the terminal log line")
    method = Column(String(10), nullable=True, comment="HTTP method (server errors)")
    path = Column(String(300), nullable=True, comment="API path or page path")
    status_code = Column(Integer, nullable=True, comment="HTTP status returned")
    error_type = Column(String(120), nullable=True, comment="Exception class, e.g. ValueError")
    message = Column(Text, nullable=True, comment="Error message")
    stack = Column(Text, nullable=True, comment="Traceback / JS stack trace")
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment="Signed-in user, if known")
    user_agent = Column(String(300), nullable=True, comment="Browser user agent")
    is_resolved = Column(Boolean, nullable=False, default=False, comment="Marked resolved by an admin")
    created_at = created_at_col()
