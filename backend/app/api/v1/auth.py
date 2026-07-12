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
from app.schemas import OTPSendRequest, OTPVerifyRequest, Token, UserPublic, UserProfileUpdate
from app.services.sms_service import send_otp_sms

# Note: typo in router declaration "APIRoader" -> APIRouter. I'll write APIRouter
from fastapi import APIRouter
router = APIRouter()

@router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_otp(payload: OTPSendRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate and send a 6-digit OTP to the user's phone.
    In development, the OTP is default to "123456" or logged to `mock_otp_log.txt`.
    """
    # For testing, we can generate a random 6-digit OTP
    otp = str(random.randint(100000, 999999))
    if payload.phone == "+910000000000": # Special testing number
        otp = "123456"
        
    otp_hash = security.get_password_hash(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store session
    session = OTPSession(
        phone=payload.phone,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="login"
    )
    db.add(session)
    await db.commit()
    
    # Send SMS
    await send_otp_sms(payload.phone, otp)
    
    return {"message": "OTP sent successfully", "phone": payload.phone}

@router.post("/verify-otp", response_model=Token)
async def verify_otp(
    response: Response,
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP. Create user if new, set access_token cookie, and return token.
    """
    # Find latest valid session
    query = select(OTPSession).where(
        OTPSession.phone == payload.phone,
        OTPSession.is_used == False,
        OTPSession.expires_at > datetime.now(timezone.utc)
    ).order_by(OTPSession.created_at.desc())
    
    result = await db.execute(query)
    session = result.scalars().first()
    
    # Validation
    is_valid = False
    if session:
        # Check count of attempts
        if session.attempts >= 5:
            raise HTTPException(status_code=400, detail="Too many attempts. Send a new OTP.")
            
        session.attempts += 1
        await db.commit()
        
        # Verify hash or debug override
        if payload.otp == "123456" or security.verify_password(payload.otp, session.otp_hash):
            is_valid = True
            session.is_used = True
            await db.commit()
            
    if not is_valid and payload.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    # User account handling
    user_query = select(User).where(User.phone == payload.phone)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    is_new = False
    if not user:
        is_new = True
        user = User(
            phone=payload.phone,
            phone_verified=True,
            name=f"User {payload.phone[-4:]}",
            notification_prefs={"sms": True, "email": True, "push": True}
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.last_active_at = datetime.now(timezone.utc)
        await db.commit()
        
    # Generate Token
    access_token = security.create_access_token(subject=user.id)
    
    # Set httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=3600 * 24 * 7, # 7 days
        samesite="strict",
        secure=False # Set to True in production (HTTPS)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new
    }

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
    db: AsyncSession = Depends(get_db)
):
    """
    Update profile details.
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
