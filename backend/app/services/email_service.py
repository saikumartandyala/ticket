"""
Sign-in codes by email, sent through Brevo's transactional email API.

- Production: Brevo is required (no silent mock). A failed send returns False
  so the API answers 502 and the user sees "try again".
- Development without BREVO_API_KEY: the code is printed to the terminal and
  appended to mock_otp_log.txt so you can sign in locally.
- Logs never contain full email addresses or codes.
"""
import asyncio
from datetime import datetime
from html import escape

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("email")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
SITE_URL = "https://tickorbit.in"


def mask_email(email: str) -> str:
    name, _, domain = (email or "").partition("@")
    return f"{name[:2]}***@{domain}" if domain else "***"


def _otp_html(otp: str) -> str:
    code = escape(otp)
    return f"""\
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f3ee;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:460px;background:#ffffff;border:1px solid #e7e4dc;border-radius:16px;
                      font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17160f;">
          <tr><td style="padding:28px 32px 0;">
            <img src="{SITE_URL}/brand/tickorbit-mark.png" width="40" height="32" alt="" style="display:inline-block;vertical-align:middle;border:0;">
            <img src="{SITE_URL}/brand/tickorbit-wordmark.png" width="99" height="22" alt="TickOrbit" style="display:inline-block;vertical-align:middle;border:0;margin-left:4px;">
          </td></tr>
          <tr><td style="padding:24px 32px 0;">
            <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:600;">Your sign-in code</h1>
            <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:#55534a;">
              Enter this code on TickOrbit to continue. It expires in 10 minutes.
            </p>
          </td></tr>
          <tr><td style="padding:20px 32px 0;">
            <div style="font-family:SFMono-Regular,Consolas,Menlo,monospace;font-size:32px;font-weight:600;
                        letter-spacing:10px;text-align:center;background:#f5f3ee;border:1px solid #e7e4dc;
                        border-radius:12px;padding:16px 0;color:#17160f;">{code}</div>
          </td></tr>
          <tr><td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#8a877c;">
              Never share this code. TickOrbit will never ask for it by phone or chat.
              If you didn't try to sign in, you can safely ignore this email.
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#8a877c;">
          TickOrbit &middot; Every ticket deserves a destination
        </p>
      </td></tr>
    </table>
  </body>
</html>"""


async def send_otp_email(email: str, otp: str) -> bool:
    subject = f"{otp} is your TickOrbit sign-in code"
    text_body = (
        f"Your TickOrbit sign-in code is {otp}. It expires in 10 minutes.\n\n"
        "Never share this code. If you didn't try to sign in, ignore this email."
    )

    if not settings.BREVO_API_KEY:
        if settings.is_production:
            # Never pretend to deliver (or write codes to disk) on a live server.
            logger.error("OTP delivery is not configured - set BREVO_API_KEY in the environment")
            return False
        logger.warning("[EMAIL MOCK] Sign-in code for %s: %s", email, otp)
        try:
            with open("mock_otp_log.txt", "a") as f:
                f.write(f"[{datetime.now().isoformat()}] Email: {email} | OTP: {otp}\n")
        except OSError:
            pass
        return True

    payload = {
        "sender": {"email": settings.BREVO_FROM_EMAIL, "name": settings.EMAIL_FROM_NAME},
        "to": [{"email": email}],
        "subject": subject,
        "htmlContent": _otp_html(otp),
        "textContent": text_body,
        "tags": ["otp"],
    }
    headers = {"api-key": settings.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json"}

    for attempt in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(BREVO_API_URL, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.error("Brevo unreachable (attempt %d): %s", attempt, type(exc).__name__)
            if attempt == 1:
                await asyncio.sleep(0.5)
                continue
            return False

        if resp.status_code in (200, 201, 202):
            try:
                message_id = resp.json().get("messageId")
            except ValueError:
                message_id = None
            logger.info("Sign-in code emailed to %s (Brevo messageId=%s)", mask_email(email), message_id)
            return True

        body = resp.text[:500]
        if resp.status_code == 401 and "IP address" in body:
            logger.error("Brevo blocked this server's IP. Turn off IP blocking at "
                         "https://app.brevo.com/security/authorised_ips - %s", body)
            return False
        if resp.status_code >= 500 and attempt == 1:
            logger.warning("Brevo error %s, retrying once", resp.status_code)
            await asyncio.sleep(0.5)
            continue
        logger.error("Brevo rejected the email [%s]: %s", resp.status_code, body)
        return False
    return False
