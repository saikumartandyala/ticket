import logging
from datetime import datetime
from email.message import EmailMessage
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

async def send_otp_email(email: str, otp: str) -> bool:
    """
    Sends an OTP code via Gmail SMTP.
    If SMTP credentials aren't configured, logs to console (and a local
    file) so OTPs are easy to retrieve during local/staging testing.
    """
    subject = "Your LastMinutePass verification code"
    body = f"Your LastMinutePass OTP is: {otp}. Valid for 10 minutes."

    if not settings.EMAIL_USER or not settings.EMAIL_PASS:
        logger.warning(f"--- [EMAIL MOCK] Sending OTP to {email}: {body} ---")
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Email: {email} | OTP: {otp}\n")
        except Exception:
            pass
        return True

    try:
        import aiosmtplib

        message = EmailMessage()
        message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_USER}>"
        message["To"] = email
        message["Subject"] = subject
        message.set_content(body)

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.EMAIL_USER,
            password=settings.EMAIL_PASS,
            start_tls=True,
        )
        return True
    except Exception as e:
        logger.error(f"Gmail SMTP error: {str(e)}")
        return False
