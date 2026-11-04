"""
Sign-in: email/phone OTP, optional password, password reset.

Security model
- The session is an HttpOnly, Secure, SameSite=Strict `__Host-` cookie. The
  token is never returned in a response body, so page scripts can't read it.
- OTPs come from the OS CSPRNG, are stored bcrypt-hashed, expire after 10
  minutes, allow 5 guesses each, and sending a new one voids the old ones.
- Sends are capped per identifier in the database and per IP in memory;
  guesses and password attempts are capped per IP and per identifier.
- Only *verified* phone numbers / emails can be used to sign in, so nobody
  can pre-claim someone else's email on their own account.
- users.token_version is bumped on sign-out, password change and reset, which
  invalidates every older session everywhere.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_token, user_from_token
from app.core import ratelimit, security
from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.timeutil import utcnow
from app.models import OTPSession, User
from app.schemas import (
    CheckAccountRequest, CheckAccountResponse, OTPSendRequest, OTPVerifyRequest, PasswordLoginRequest,
    ResetPasswordRequest, SetPasswordRequest, Token, UserMe, UserProfileUpdate,
)
from app.services.analytics import track
from app.services.email_service import send_otp_email
from app.services.sms_service import send_otp_sms

router = APIRouter()
log = get_logger("auth")

OTP_TTL_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
OTP_SENDS_PER_HOUR = 5
OTP_RESEND_SECONDS = 30
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _mask(identifier: str) -> str:
    """For logs: 'pr***@gmail.com', '+91******3210'."""
    if "@" in identifier:
        name, _, domain = identifier.partition("@")
        return f"{name[:2]}***@{domain}"
    return identifier[:3] + "*" * max(len(identifier) - 7, 0) + identifier[-4:]


async def _get_user_by_identifier(db: AsyncSession, identifier: str, channel: str) -> User | None:
    """The account that has *verified* this phone/email."""
    if channel == "phone":
        stmt = select(User).where(User.phone == identifier, User.phone_verified == True)  # noqa: E712
    else:
        stmt = select(User).where(func.lower(User.email) == identifier, User.email_verified == True)  # noqa: E712
    return (await db.execute(stmt)).scalars().first()


async def _release_unverified(db: AsyncSession, identifier: str, channel: str) -> None:
    """Free an identifier someone typed into their profile without verifying it."""
    if channel == "phone":
        await db.execute(update(User).where(User.phone == identifier, User.phone_verified == False).values(phone=None))  # noqa: E712
    else:
        await db.execute(update(User).where(func.lower(User.email) == identifier, User.email_verified == False).values(email=None))  # noqa: E712


async def _dispatch_otp(identifier: str, channel: str, otp: str) -> bool:
    if channel == "phone":
        return await send_otp_sms(identifier, otp)
    return await send_otp_email(identifier, otp)


def _set_session_cookie(response: Response, user: User) -> None:
    token = security.create_access_token(subject=user.id, version=user.token_version or 0)
    response.set_cookie(
        key=security.SESSION_COOKIE,
        value=token,
        max_age=COOKIE_MAX_AGE,
        path="/",
        httponly=True,
        secure=True,
        samesite="strict",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(security.SESSION_COOKIE, path="/", secure=True, httponly=True, samesite="strict")


async def _create_otp(request: Request, db: AsyncSession, identifier: str, channel: str, purpose: str) -> str:
    """Rate-limit, void older codes, store a new hashed code and return it."""
    ratelimit.enforce(request, f"otp-send-ip", 10, 600)
    now = utcnow()
    recent = (await db.execute(
        select(func.count(), func.max(OTPSession.created_at)).where(
            OTPSession.identifier == identifier,
            OTPSession.channel == channel,
            OTPSession.created_at > now - timedelta(hours=1),
        )
    )).one()
    count, last = recent
    if count >= OTP_SENDS_PER_HOUR:
        log.warning("OTP send limit reached for %s", _mask(identifier))
        raise HTTPException(429, "Too many codes requested. Please try again in an hour.", headers={"Retry-After": "3600"})
    if last is not None:
        from app.core.timeutil import as_utc
        wait = OTP_RESEND_SECONDS - int((now - as_utc(last)).total_seconds())
        if wait > 0:
            raise HTTPException(429, f"Please wait {wait}s before requesting another code.", headers={"Retry-After": str(wait)})

    await db.execute(
        update(OTPSession)
        .where(OTPSession.identifier == identifier, OTPSession.channel == channel,
               OTPSession.purpose == purpose, OTPSession.is_used == False)  # noqa: E712
        .values(is_used=True)
    )
    otp = security.generate_otp()
    db.add(OTPSession(
        identifier=identifier, channel=channel, purpose=purpose,
        otp_hash=await security.aget_password_hash(otp),
        expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
    ))
    await db.commit()
    return otp


async def _consume_otp(request: Request, db: AsyncSession, identifier: str, channel: str, purpose: str, code: str) -> None:
    """Check a code against the newest live one; raises 400 on any failure."""
    ratelimit.enforce(request, "otp-verify-ip", 30, 600)
    session = (await db.execute(
        select(OTPSession)
        .where(
            OTPSession.identifier == identifier,
            OTPSession.channel == channel,
            OTPSession.purpose == purpose,
            OTPSession.is_used == False,  # noqa: E712
            OTPSession.expires_at > utcnow(),
        )
        .order_by(OTPSession.created_at.desc())
    )).scalars().first()

    if not session:
        raise HTTPException(400, "Invalid or expired code")
    if session.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(400, "Too many attempts. Request a new code.")

    session.attempts += 1
    if not await security.averify_password(code, session.otp_hash):
        if session.attempts >= MAX_OTP_ATTEMPTS:
            session.is_used = True
        await db.commit()
        log.warning("Wrong %s code for %s (attempt %d)", purpose, _mask(identifier), session.attempts)
        raise HTTPException(400, "Invalid or expired code")

    session.is_used = True
    await db.commit()


@router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_otp(payload: OTPSendRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit sign-in code to a phone or email."""
    otp = await _create_otp(request, db, payload.identifier, payload.channel, "login")
    if not await _dispatch_otp(payload.identifier, payload.channel, otp):
        raise HTTPException(502, "Could not send the code right now. Please try again in a moment.")
    return {"message": "OTP sent successfully", "channel": payload.channel}


@router.post("/verify-otp", response_model=Token)
async def verify_otp(payload: OTPVerifyRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Verify a sign-in code. Creates the account on first sign-in."""
    await _consume_otp(request, db, payload.identifier, payload.channel, "login", payload.otp)

    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    is_new = user is None
    if is_new:
        await _release_unverified(db, payload.identifier, payload.channel)
        user = User(notification_prefs={"sms": True, "email": True, "push": True})
        if payload.channel == "phone":
            user.phone, user.phone_verified = payload.identifier, True
        else:
            user.email, user.email_verified = payload.identifier, True
        db.add(user)
        await db.flush()
        track(db, "signup", user.id, {"channel": payload.channel})
    else:
        if not user.is_active or user.is_banned:
            raise HTTPException(403, "This account has been suspended. Contact support.")
        user.last_active_at = utcnow()
        track(db, "login", user.id, {"method": "otp"})
    await db.commit()
    await db.refresh(user)

    ratelimit.reset(f"login-id:{payload.identifier}")
    _set_session_cookie(response, user)
    return {"is_new_user": is_new, "has_password": bool(user.password_hash)}


@router.post("/check-account", response_model=CheckAccountResponse)
async def check_account(payload: CheckAccountRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Lets the sign-in form show a password field or start the OTP flow."""
    ratelimit.enforce(request, "check-account-ip", 30, 600)
    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    if not user:
        return {"exists": False, "has_password": False}
    return {"exists": True, "has_password": bool(user.password_hash)}


@router.post("/login-password", response_model=Token)
async def login_password(payload: PasswordLoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Email/phone + password sign-in for accounts that set one."""
    ratelimit.enforce(request, "login-ip", 20, 900)
    ratelimit.enforce(request, "login-id", 8, 900, subject=payload.identifier)

    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    if not await security.averify_password(payload.password, user.password_hash if user else None):
        log.warning("Failed password sign-in for %s", _mask(payload.identifier))
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active or user.is_banned:
        raise HTTPException(403, "This account has been suspended. Contact support.")

    ratelimit.reset(f"login-id:{payload.identifier}")
    if security.password_needs_rehash(user.password_hash):
        user.password_hash = await security.aget_password_hash(payload.password)  # upgrade legacy hash in place
    user.last_active_at = utcnow()
    track(db, "login", user.id, {"method": "password"})
    await db.commit()

    _set_session_cookie(response, user)
    return {"is_new_user": False, "has_password": True}


@router.post("/set-password", status_code=status.HTTP_200_OK)
async def set_password(
    payload: SetPasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a password (first time), or change it with the current one."""
    if current_user.password_hash:
        ratelimit.enforce(request, "change-password", 5, 900, subject=current_user.id)
        if not payload.current_password or not await security.averify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(400, "Your current password is incorrect")
    current_user.password_hash = await security.aget_password_hash(payload.password)
    current_user.token_version = (current_user.token_version or 0) + 1
    await db.commit()
    _set_session_cookie(response, current_user)  # this device stays signed in, others are signed out
    return {"message": "Password set successfully"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(payload: OTPSendRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Send a reset code. Same reply whether or not the account exists."""
    otp = await _create_otp(request, db, payload.identifier, payload.channel, "reset")
    if await _get_user_by_identifier(db, payload.identifier, payload.channel):
        if not await _dispatch_otp(payload.identifier, payload.channel, otp):
            raise HTTPException(502, "Could not send the reset code right now. Please try again in a moment.")
    return {"message": "If that account exists, a reset code is on its way"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Verify a reset code, set a new password and sign out every device."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    await _consume_otp(request, db, payload.identifier, payload.channel, "reset", payload.otp)
    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    if not user:
        raise HTTPException(400, "Invalid or expired code")
    user.password_hash = await security.aget_password_hash(payload.new_password)
    user.token_version = (user.token_version or 0) + 1
    await db.commit()
    log.info("Password reset for %s", _mask(payload.identifier))
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserMe)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserMe)
async def update_me(payload: UserProfileUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update name, avatar, notification prefs, or add an (unverified) email."""
    if payload.name is not None:
        current_user.name = payload.name or None
    if payload.email is not None:
        email = payload.email.strip().lower()
        if email != (current_user.email or "").lower():
            if current_user.email_verified:
                raise HTTPException(400, "Your sign-in email can't be changed here")
            taken = (await db.execute(
                select(User.id).where(func.lower(User.email) == email, User.id != current_user.id)
            )).first()
            if taken:
                raise HTTPException(409, "That email is already used by another account")
            current_user.email = email
            current_user.email_verified = False
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url or None
    if payload.notification_prefs is not None:
        current_user.notification_prefs = {**(current_user.notification_prefs or {}), **payload.notification_prefs}
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Sign out: void every session token for this account and clear the cookie."""
    user = await user_from_token(db, get_request_token(request))
    if user:
        user.token_version = (user.token_version or 0) + 1
        await db.commit()
    _clear_session_cookie(response)
    return {"message": "Logged out successfully"}
