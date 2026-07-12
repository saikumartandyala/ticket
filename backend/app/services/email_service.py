import logging
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

async def send_otp_email(email: str, otp: str) -> bool:
    """
    Sends an OTP code via email.
    If SendGrid isn't configured, logs to console (and a local file) so OTPs
    are easy to retrieve during local/staging testing — same pattern as
    sms_service.send_otp_sms.
    """
    subject = "Your LastMinutePass verification code"
    body = f"Your LastMinutePass OTP is: {otp}. Valid for 10 minutes."

    if not settings.SENDGRID_API_KEY:
        logger.warning(f"--- [EMAIL MOCK] Sending OTP to {email}: {body} ---")
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Email: {email} | OTP: {otp}\n")
        except Exception:
            pass
        return True

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.EMAIL_FROM,
            to_emails=email,
            subject=subject,
            plain_text_content=body,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"SendGrid error: {str(e)}")
        return False
