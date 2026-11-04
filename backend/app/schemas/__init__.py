import re
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import List, Optional, Any, Dict, Literal
from datetime import date, time, datetime
from decimal import Decimal

Channel = Literal["phone", "email"]

def _validate_identifier(identifier: str, channel: str) -> str:
    if channel == "phone":
        # E.164 international format: + followed by country code and number,
        # 8-15 digits total, first digit non-zero. Not India-specific.
        if not re.match(r"^\+[1-9]\d{7,14}$", identifier):
            raise ValueError("Enter a valid phone number with country code, e.g. +14155552671")
    else:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", identifier):
            raise ValueError("Enter a valid email address")
    return identifier


def _normalize_identifier(identifier: str, channel: str) -> str:
    identifier = (identifier or "").strip()
    if channel == "email":
        identifier = identifier.lower()
    if len(identifier) > 254:
        raise ValueError("That looks too long to be valid")
    return _validate_identifier(identifier, channel)


# Only files we stored ourselves (see services/storage_service.py) may be referenced:
# a local dev upload, or a file in our public Supabase Storage bucket.
def _upload_re() -> "re.Pattern[str]":
    from app.core.config import settings
    name = r"[0-9a-f]{32}\.(jpg|png|webp)"
    prefixes = [re.escape("/api/v1/static/uploads/")]
    if settings.uses_cloud_storage:
        prefixes.append(re.escape(settings.storage_public_prefix))
    return re.compile(rf"^(?:{'|'.join(prefixes)}){name}$")


UPLOAD_PATH_RE = _upload_re()
OTP_PATTERN = r"^\d{6}$"


class IdentifiedRequest(BaseModel):
    """Phone/email requests: trimmed, emails lowercased, format checked."""
    identifier: str = Field(..., max_length=254)
    channel: Channel

    @model_validator(mode="after")
    def _normalize(self):
        self.identifier = _normalize_identifier(self.identifier, self.channel)
        return self

# --- AUTH SCHEMAS ---
class OTPSendRequest(IdentifiedRequest):
    """Phone number (E.164, e.g. +14155552671) or email address."""

class OTPVerifyRequest(IdentifiedRequest):
    otp: str = Field(..., pattern=OTP_PATTERN)

class CheckAccountRequest(IdentifiedRequest):
    pass

class CheckAccountResponse(BaseModel):
    exists: bool
    has_password: bool

class PasswordLoginRequest(IdentifiedRequest):
    password: str = Field(..., min_length=1, max_length=128)

class SetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., max_length=128)
    # Required when the account already has a password.
    current_password: Optional[str] = Field(None, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "SetPasswordRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

class ResetPasswordRequest(IdentifiedRequest):
    otp: str = Field(..., pattern=OTP_PATTERN)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

class Token(BaseModel):
    """Sign-in result. The session itself is only ever in the HttpOnly cookie."""
    is_new_user: bool = False
    has_password: bool = False

# --- USER SCHEMAS ---
class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = Field(None, max_length=200)
    notification_prefs: Optional[Dict[Literal["sms", "email", "push"], bool]] = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v is not None else v

    @field_validator("avatar_url")
    @classmethod
    def _own_upload(cls, v: Optional[str]) -> Optional[str]:
        if v and not UPLOAD_PATH_RE.match(v):
            raise ValueError("Upload the picture first, then use the returned link")
        return v

class UserPublic(BaseModel):
    """What anyone can see about a user. Never includes contact details."""
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


class UserContact(UserPublic):
    """A user plus phone/email: only for themselves, or a counterpart after contact is revealed."""
    phone: Optional[str] = None
    email: Optional[str] = None


class UserMe(UserContact):
    """The signed-in user's own profile — includes fields not shown to others."""
    is_admin: bool = False

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
    category_id: int = Field(..., ge=1)
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

    # Route info (train/bus)
    origin_city: Optional[str] = Field(None, max_length=100)
    destination_city: Optional[str] = Field(None, max_length=100)
    operator_name: Optional[str] = Field(None, max_length=100)
    operator_code: Optional[str] = Field(None, max_length=20)

    # Event info
    event_name: Optional[str] = Field(None, max_length=200)
    venue_name: Optional[str] = Field(None, max_length=200)
    venue_city: Optional[str] = Field(None, max_length=100)
    section: Optional[str] = Field(None, max_length=50)
    row_number: Optional[str] = Field(None, max_length=20)

    seat_count: int = Field(1, ge=1, le=10)
    seat_details: Optional[Dict[str, Any]] = None

    event_date: date
    departure_time: Optional[time] = None
    arrival_time: Optional[time] = None

    original_price: Decimal = Field(..., gt=0, le=1_000_000)
    asking_price: Decimal = Field(..., gt=0, le=1_000_000)
    pnr_last_four: Optional[str] = Field(None, pattern=r"^\d{4}$")
    booking_ref: Optional[str] = Field(None, max_length=40)
    ticket_photos: List[str] = Field(default_factory=list, max_length=3)

    @field_validator("seat_details")
    @classmethod
    def _small_seat_details(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if v is None:
            return v
        if len(v) > 10 or any(
            len(str(k)) > 30 or not isinstance(val, (str, int, float, bool, type(None))) or len(str(val)) > 100
            for k, val in v.items()
        ):
            raise ValueError("Seat details are too long")
        return v

    @field_validator("ticket_photos")
    @classmethod
    def _own_uploads(cls, v: List[str]) -> List[str]:
        if any(not UPLOAD_PATH_RE.match(p) for p in v):
            raise ValueError("Upload ticket photos through the form")
        return v

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
        from app.core.timeutil import local_today
        if v < local_today():
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
    seeker: Optional[UserContact] = None
    transferor: Optional[UserContact] = None

    @model_validator(mode="after")
    def _hide_contact_until_revealed(self) -> "MatchResponse":
        if self.status not in ("contact_revealed", "transferred"):
            for party in (self.seeker, self.transferor):
                if party is not None:
                    party.phone = None
                    party.email = None
        return self

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
