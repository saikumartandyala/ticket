import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, OTPSession
from app.schemas import (
    OTPSendRequest, OTPVerifyRequest, Token, UserPublic, UserProfileUpdate,
    CheckAccountRequest, CheckAccountResponse, PasswordLoginRequest,
    SetPasswordRequest, ResetPasswordRequest,
)
from app.services.sms_service import send_otp_sms
from app.services.email_service import send_otp_email

router = APIRouter()

OTP_TTL_MINUTES = 10
COOKIE_MAX_AGE = 3600 * 24 * 7  # 7 days
MAX_OTP_ATTEMPTS = 5


async def _get_user_by_identifier(db: AsyncSession, identifier: str, channel: str) -> User | None:
    column = User.phone if channel == "phone" else User.email
    result = await db.execute(select(User).where(column == identifier))
    return result.scalar_one_or_none()


async def _dispatch_otp(identifier: str, channel: str, otp: str) -> bool:
    if channel == "phone":
        return await send_otp_sms(identifier, otp)
    return await send_otp_email(identifier, otp)


def _issue_session_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=COOKIE_MAX_AGE,
        samesite="strict",
        secure=False,  # flip to True once served over HTTPS in production
    )


@router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_otp(payload: OTPSendRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate and dispatch a 6-digit OTP to the given phone or email.
    """
    otp = str(random.randint(100000, 999999))
    otp_hash = security.get_password_hash(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)

    session = OTPSession(
        identifier=payload.identifier,
        channel=payload.channel,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="login",
    )
    db.add(session)
    await db.commit()

    if not await _dispatch_otp(payload.identifier, payload.channel, otp):
        raise HTTPException(
            status_code=502,
            detail="Could not send the OTP right now. Please try again in a moment.",
        )

    return {"message": "OTP sent successfully", "identifier": payload.identifier, "channel": payload.channel}


@router.post("/verify-otp", response_model=Token)
async def verify_otp(
    response: Response,
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify OTP. Creates the user on first verification, issues a real JWT.
    """
    query = (
        select(OTPSession)
        .where(
            OTPSession.identifier == payload.identifier,
            OTPSession.channel == payload.channel,
            OTPSession.purpose == "login",
            OTPSession.is_used == False,  # noqa: E712
            OTPSession.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPSession.created_at.desc())
    )
    result = await db.execute(query)
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if session.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many attempts. Send a new OTP.")

    session.attempts += 1
    await db.commit()

    if not security.verify_password(payload.otp, session.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    session.is_used = True
    await db.commit()

    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)

    is_new = False
    if not user:
        is_new = True
        user_kwargs = {"notification_prefs": {"sms": True, "email": True, "push": True}}
        if payload.channel == "phone":
            user_kwargs["phone"] = payload.identifier
            user_kwargs["phone_verified"] = True
        else:
            user_kwargs["email"] = payload.identifier
            user_kwargs["email_verified"] = True
        user = User(**user_kwargs)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if payload.channel == "phone":
            user.phone_verified = True
        else:
            user.email_verified = True
        user.last_active_at = datetime.now(timezone.utc)
        await db.commit()

    access_token = security.create_access_token(subject=user.id)
    _issue_session_cookie(response, access_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new,
        "has_password": bool(user.password_hash),
    }


@router.post("/check-account", response_model=CheckAccountResponse)
async def check_account(payload: CheckAccountRequest, db: AsyncSession = Depends(get_db)):
    """
    Lets the frontend decide whether to show a password field (existing
    account with a password already set) or kick off the OTP flow.
    """
    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    if not user:
        return {"exists": False, "has_password": False}
    return {"exists": True, "has_password": bool(user.password_hash)}


@router.post("/login-password", response_model=Token)
async def login_password(
    response: Response,
    payload: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Direct phone/email + password login for accounts that already set one —
    skips OTP for routine logins.
    """
    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)

    if not user or not user.password_hash or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="User is banned")

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    access_token = security.create_access_token(subject=user.id)
    _issue_session_cookie(response, access_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": False,
        "has_password": True,
    }


@router.post("/set-password", status_code=status.HTTP_200_OK)
async def set_password(
    payload: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sets (or changes) the password for the currently authenticated user —
    used right after OTP verification during registration.
    """
    current_user.password_hash = security.get_password_hash(payload.password)
    await db.commit()
    return {"message": "Password set successfully"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(payload: OTPSendRequest, db: AsyncSession = Depends(get_db)):
    """
    Sends a password-reset OTP to the given phone or email. Same channel
    dispatch as /send-otp, tagged with purpose='reset' so it can't be reused
    to bypass a normal login OTP or vice versa.
    """
    otp = str(random.randint(100000, 999999))
    otp_hash = security.get_password_hash(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)

    session = OTPSession(
        identifier=payload.identifier,
        channel=payload.channel,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="reset",
    )
    db.add(session)
    await db.commit()

    if not await _dispatch_otp(payload.identifier, payload.channel, otp):
        raise HTTPException(
            status_code=502,
            detail="Could not send the reset code right now. Please try again in a moment.",
        )

    return {"message": "Password reset OTP sent"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Verifies a reset OTP and sets a new password — no existing password
    or login required, since the OTP itself proves ownership of the
    phone/email.
    """
    query = (
        select(OTPSession)
        .where(
            OTPSession.identifier == payload.identifier,
            OTPSession.channel == payload.channel,
            OTPSession.purpose == "reset",
            OTPSession.is_used == False,  # noqa: E712
            OTPSession.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OTPSession.created_at.desc())
    )
    result = await db.execute(query)
    session = result.scalars().first()

    if not session or session.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    session.attempts += 1
    await db.commit()

    if not security.verify_password(payload.otp, session.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    session.is_used = True

    user = await _get_user_by_identifier(db, payload.identifier, payload.channel)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    user.password_hash = security.get_password_hash(payload.new_password)
    await db.commit()

    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user profile.
    """
    return current_user


@router.put("/me", response_model=UserPublic)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update profile details (name, email, avatar, notification prefs).
    """
    if payload.name is not None:
        current_user.name = payload.name
    if payload.email is not None:
        current_user.email = payload.email
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    if payload.notification_prefs is not None:
        current_user.notification_prefs = payload.notification_prefs

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/logout")
async def logout(response: Response):
    """
    Log out user by clearing cookies.
    """
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}
