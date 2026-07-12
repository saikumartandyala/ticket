import logging
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

async def send_otp_sms(phone: str, otp: str) -> bool:
    """
    Sends an OTP code via SMS. 
    If MSG91 API key is not configured, logs to console (and dummy file) for easy local testing.
    """
    msg = f"Your LastMinutePass OTP is: {otp}. Valid for 10 minutes."
    
    if not settings.MSG91_API_KEY:
        logger.warning(f"--- [SMS MOCK] Sending OTP to {phone}: {msg} ---")
        # Save to a local file inside the workspace for easy retrieval by developers
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Phone: {phone} | OTP: {otp}\n")
        except Exception:
            pass
        return True
        
    # Real MSG91 integration if configured
    import httpx
    url = "https://api.msg91.com/api/v5/otp"
    params = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "mobile": phone,
        "authkey": settings.MSG91_API_KEY,
        "otp": otp
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, params=params)
            if response.status_code == 200:
                return True
            logger.error(f"MSG91 API failed: {response.text}")
    except Exception as e:
        logger.error(f"MSG91 error: {str(e)}")
        
    return False

async def send_match_notification(phone: str, title: str, content: str) -> None:
    """
    Sends match or interest alert notifications. Fallback to console log.
    """
    if not settings.MSG91_API_KEY:
        logger.warning(f"--- [SMS ALERT MOCK] To: {phone} | Title: {title} | Content: {content} ---")
        return
        
    # Can expand this to send real bulk SMS alerts if needed
    pass
