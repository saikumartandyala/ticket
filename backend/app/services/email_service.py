import logging
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger("lastminutepass.services")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _otp_html(otp: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h2 style="margin:0 0 8px;color:#7c3aed;">LastMinutePass</h2>
      <p style="margin:0 0 24px;color:#555;">Your verification code</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;
                  background:#f4f0ff;color:#4c1d95;padding:16px;border-radius:10px;">
        {otp}
      </div>
      <p style="margin:24px 0 0;color:#777;font-size:14px;">
        This code is valid for 10 minutes. If you didn't request it, you can ignore this email.
      </p>
    </div>
  </body>
</html>"""


async def send_otp_email(email: str, otp: str) -> bool:
    """
    Sends an OTP code via the Brevo (Sendinblue) transactional email API.
    If BREVO_API_KEY isn't configured, logs to console (and a local file) so
    OTPs are easy to retrieve during local/staging testing.
    """
    subject = "Your LastMinutePass verification code"
    text_body = f"Your LastMinutePass OTP is: {otp}. Valid for 10 minutes."

    if not settings.BREVO_API_KEY:
        logger.warning(f"--- [EMAIL MOCK] Sending OTP to {email}: {text_body} ---")
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Email: {email} | OTP: {otp}\n")
        except Exception:
            pass
        return True

    import httpx

    payload = {
        "sender": {"email": settings.BREVO_FROM_EMAIL, "name": settings.EMAIL_FROM_NAME},
        "to": [{"email": email}],
        "subject": subject,
        "htmlContent": _otp_html(otp),
        "textContent": text_body,
    }
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(BREVO_API_URL, json=payload, headers=headers)

        if resp.status_code in (200, 201):
            try:
                message_id = resp.json().get("messageId")
            except Exception:
                message_id = None
            logger.info(f"Brevo email sent to {email} (messageId={message_id})")
            return True

        logger.error(f"Brevo API failed [{resp.status_code}]: {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Brevo error: {str(e)}")
        return False
