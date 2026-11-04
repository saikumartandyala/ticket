"""
Seed the local dev database with two demo accounts and a handful of listings
so every screen has realistic data to show.

Usage (from the backend/ directory, with the API running on :8000):

    ../venv/Scripts/python.exe scripts/seed_demo.py

Users are inserted directly (no OTP email is sent); listings are created
through the real API so price guardrails, expiry and alert matching all run.
Safe to re-run: existing demo users are reused.

Demo accounts (local development only):
    seller  demo.seller@example.test
    buyer   demo.buyer@example.test
    password for both: DemoPass123
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session_maker  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models import User  # noqa: E402

API = os.environ.get("SEED_API", "https://localhost:8000/api/v1")
# Trust the local dev CA (scripts/dev_certs.py) instead of disabling TLS checks.
CA = os.environ.get("SEED_CA", os.path.join(os.path.dirname(__file__), "..", "..", "certs", "tickorbit-dev-ca.pem"))
PASSWORD = "DemoPass123"
USERS = [
    ("demo.seller@example.test", "Aarav Sharma"),
    ("demo.buyer@example.test", "Priya Nair"),
]


async def ensure_users() -> None:
    async with async_session_maker() as db:
        for email, name in USERS:
            existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if existing:
                continue
            db.add(User(email=email, name=name, email_verified=True, password_hash=get_password_hash(PASSWORD)))
        await db.commit()


def login(email: str) -> str:
    """Sign in and return the session token from the HttpOnly cookie (sent back as a Bearer header)."""
    from app.core.security import SESSION_COOKIE
    r = httpx.post(f"{API}/auth/login-password", json={"identifier": email, "channel": "email", "password": PASSWORD}, verify=CA)
    r.raise_for_status()
    return r.cookies[SESSION_COOKIE]


def listings():
    now = datetime.now()

    def at(hours: float):
        t = now + timedelta(hours=hours)
        return t.date().isoformat(), t.strftime("%H:%M:00")

    d1, t1 = at(4.5)
    d2, t2 = at(9)
    d3, t3 = at(20)
    d4, t4 = at(43)
    d5, t5 = at(70)
    d6, t6 = at(5.2)
    return [
        dict(category_id=1, title="New Delhi → Mumbai Central", origin_city="New Delhi (NDLS)", destination_city="Mumbai Central (BCT)",
             operator_name="Rajdhani Express", operator_code="12951", event_date=d1, departure_time=t1, arrival_time="08:35:00",
             seat_details={"coach": "3A · B4", "seat": "42"}, seat_count=1, pnr_last_four="4821", original_price=2450, asking_price=1850,
             description="Work trip got cancelled. Happy to meet at NDLS gate 1 or do the name change online — your choice."),
        dict(category_id=2, title="Bengaluru → Hyderabad", origin_city="Bengaluru", destination_city="Hyderabad",
             operator_name="VRL Travels", event_date=d2, departure_time=t2, seat_details={"coach": "Sleeper, lower", "seat": "L7"},
             seat_count=1, original_price=1200, asking_price=899),
        dict(category_id=3, title="MI vs CSK", event_name="MI vs CSK", venue_name="Wankhede Stadium", venue_city="Mumbai",
             section="North Stand, Level 2", row_number="K", event_date=d3, departure_time=t3, seat_details={"seat": "14, 15"},
             seat_count=2, original_price=8000, asking_price=6400,
             description="Two seats together. Tickets are on the District app — I'll transfer them to your account."),
        dict(category_id=5, title="Prateek Kuhad — Silhouettes Tour", event_name="Prateek Kuhad — Silhouettes Tour",
             venue_name="Phoenix Marketcity", venue_city="Bengaluru", section="Gold", event_date=d4, departure_time=t4,
             seat_count=1, original_price=3500, asking_price=2600),
        dict(category_id=4, title="IND vs AUS · 2nd ODI", event_name="IND vs AUS · 2nd ODI", venue_name="Eden Gardens",
             venue_city="Kolkata", section="Block D", event_date=d5, departure_time=t5, seat_count=1, original_price=3000, asking_price=2100),
        dict(category_id=6, title="Bengaluru Tech Summit", event_name="Bengaluru Tech Summit", venue_name="BIEC",
             venue_city="Bengaluru", event_date=d6, departure_time=t6, seat_count=1, original_price=4000, asking_price=1500,
             description="Full delegate pass, all three days."),
    ]


def main() -> None:
    asyncio.run(ensure_users())
    seller = login(USERS[0][0])
    buyer = login(USERS[1][0])
    with httpx.Client(timeout=20, verify=CA) as client:
        created = []
        for payload in listings():
            r = client.post(f"{API}/listings", json=payload, headers={"Authorization": f"Bearer {seller}"})
            if r.status_code >= 400:
                print("listing failed:", r.status_code, r.text)
                continue
            created.append(r.json())
        print(f"created {len(created)} listings")
        if created:
            r = client.post(
                f"{API}/listings/{created[0]['id']}/interest",
                json={"seeker_note": "Hi! I'm near the station and can meet 45 minutes before departure."},
                headers={"Authorization": f"Bearer {buyer}"},
            )
            print("buyer request:", r.status_code)


if __name__ == "__main__":
    main()
