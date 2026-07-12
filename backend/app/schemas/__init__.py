from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Any, Dict
from datetime import date, time, datetime
from decimal import Decimal

# --- AUTH SCHEMAS ---
class OTPSendRequest(BaseModel):
    phone: str = Field(..., description="Indian phone number with country code, e.g. +919876543210")

    @field_validator("phone")
    @classmethod
    def validate_indian_phone(cls, v: str) -> str:
        import re
        if not re.match(r"^\+91\d{10}$", v):
            raise ValueError("Phone number must be in the format +91XXXXXXXXXX (Indian country code + 10 digits)")
        return v

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str = Field(..., min_length=6, max_length=6)

class Token(BaseModel):
    access_token: str
    token_type: str
    is_new_user: bool = False

# --- USER SCHEMAS ---
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    notification_prefs: Optional[Dict[str, bool]] = None

class UserPublic(BaseModel):
    id: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_verified: bool
    email_verified: bool
    avg_rating: float
    rating_count: int
    total_listings: int
    total_matches: int

    class Config:
        from_attributes = True

# --- CATEGORY SCHEMAS ---
class CategoryBase(BaseModel):
    id: int
    slug: str
    name: str
    icon: Optional[str]
    color_hex: Optional[str]

    class Config:
        from_attributes = True

# --- LISTING SCHEMAS ---
class ListingCreate(BaseModel):
    category_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    
    # Route info (train/bus)
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    operator_name: Optional[str] = None
    operator_code: Optional[str] = None
    
    # Event info
    event_name: Optional[str] = None
    venue_name: Optional[str] = None
    venue_city: Optional[str] = None
    section: Optional[str] = None
    row_number: Optional[str] = None
    
    seat_count: int = 1
    seat_details: Optional[Dict[str, Any]] = None
    
    event_date: date
    departure_time: Optional[time] = None
    arrival_time: Optional[time] = None
    
    original_price: Decimal
    asking_price: Decimal
    pnr_last_four: Optional[str] = None
    booking_ref: Optional[str] = None
    ticket_photos: List[str] = Field(default_factory=list)

    @field_validator("asking_price")
    @classmethod
    def validate_price_guardrails(cls, v: Decimal, info: Any) -> Decimal:
        original = info.data.get("original_price")
        if original is not None:
            min_price = original * Decimal("0.30")
            max_price = original * Decimal("0.90")
            if v > max_price:
                raise ValueError("Asking price exceeds 90% anti-scalping limit of original price")
            if v < min_price:
                raise ValueError("Asking price is below 30% minimum limit of original price")
        return v

    @field_validator("event_date")
    @classmethod
    def validate_future_date(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Event/travel date cannot be in the past")
        return v

class ListingResponse(BaseModel):
    id: str
    user_id: str
    category_id: int
    title: str
    description: Optional[str]
    origin_city: Optional[str]
    destination_city: Optional[str]
    operator_name: Optional[str]
    operator_code: Optional[str]
    event_name: Optional[str]
    venue_name: Optional[str]
    venue_city: Optional[str]
    section: Optional[str]
    row_number: Optional[str]
    seat_count: int
    seat_details: Optional[Dict[str, Any]]
    event_date: date
    departure_time: Optional[time]
    arrival_time: Optional[time]
    original_price: Decimal
    asking_price: Decimal
    pnr_last_four: Optional[str]
    ticket_photos: List[str]
    status: str
    view_count: int
    interest_count: int
    expires_at: datetime
    created_at: datetime
    owner: UserPublic
    category: CategoryBase

    class Config:
        from_attributes = True

# --- MATCH SCHEMAS ---
class ExpressInterestRequest(BaseModel):
    seeker_note: Optional[str] = Field(None, max_length=200)

class MatchResponse(BaseModel):
    id: str
    listing_id: str
    seeker_id: str
    transferor_id: str
    status: str
    seeker_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    listing: Optional[ListingResponse] = None
    seeker: Optional[UserPublic] = None
    transferor: Optional[UserPublic] = None

    class Config:
        from_attributes = True

# --- MESSAGING SCHEMAS ---
class MessageCreate(BaseModel):
    content: str = Field(..., max_length=500)

class MessageResponse(BaseModel):
    id: str
    match_id: str
    sender_id: str
    content: str
    msg_type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- SEEKER ALERT SCHEMAS ---
class SeekerAlertCreate(BaseModel):
    category_id: Optional[int] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    event_name: Optional[str] = None
    venue_city: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    max_price: Optional[Decimal] = None

class SeekerAlertResponse(BaseModel):
    id: str
    user_id: str
    category_id: Optional[int]
    origin_city: Optional[str]
    destination_city: Optional[str]
    event_name: Optional[str]
    venue_city: Optional[str]
    date_from: Optional[date]
    date_to: Optional[date]
    max_price: Optional[Decimal]
    is_active: bool
    fire_count: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- REVIEW SCHEMAS ---
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=300)

class ReviewResponse(BaseModel):
    id: str
    match_id: str
    reviewer_id: str
    reviewee_id: str
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
