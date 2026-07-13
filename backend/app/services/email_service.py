import logging
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

async def send_otp_email(email: str, otp: str) -> bool:
    """
    Sends an OTP code via email through MSG91's OTP API (same account/authkey
    as SMS, different template) — pass `email` instead of `mobile` to route
    the OTP to the email channel.
    If MSG91 isn't configured, logs to console (and a local file) so OTPs
    are easy to retrieve during local/staging testing.
    """
    msg = f"Your LastMinutePass OTP is: {otp}. Valid for 10 minutes."

    if not settings.MSG91_API_KEY or not settings.MSG91_EMAIL_TEMPLATE_ID:
        logger.warning(f"--- [EMAIL MOCK] Sending OTP to {email}: {msg} ---")
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Email: {email} | OTP: {otp}\n")
        except Exception:
            pass
        return True

    import httpx
    url = "https://api.msg91.com/api/v5/otp"
    params = {
        "template_id": settings.MSG91_EMAIL_TEMPLATE_ID,
        "email": email,
        "authkey": settings.MSG91_API_KEY,
        "otp": otp,
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, params=params)
            if response.status_code == 200:
                return True
            logger.error(f"MSG91 email OTP failed: {response.text}")
    except Exception as e:
        logger.error(f"MSG91 email OTP error: {str(e)}")

    return False
