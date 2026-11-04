"""
Recompute every listing's `expires_at` from its event_date + departure_time.

Listings created before the timezone fix stored the departure as India
wall-clock time labelled UTC, so they stayed on the board 5h30m too long.
The correct value is fully determined by event_date/departure_time, so this
is safe to run any number of times.

    ../venv/Scripts/python.exe scripts/fix_listing_expiry.py
"""
import asyncio
import os
import sys

from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session_maker, engine  # noqa: E402
from app.core.timeutil import local_to_utc  # noqa: E402
from app.models import TicketListing  # noqa: E402


async def main() -> None:
    changed = 0
    async with async_session_maker() as db:
        rows = (await db.execute(select(TicketListing))).scalars().all()
        for l in rows:
            correct = local_to_utc(l.event_date, l.departure_time)
            if l.expires_at != correct:
                l.expires_at = correct
                changed += 1
        await db.commit()
    await engine.dispose()
    print(f"Checked {len(rows)} listings, corrected {changed}.")


if __name__ == "__main__":
    asyncio.run(main())
