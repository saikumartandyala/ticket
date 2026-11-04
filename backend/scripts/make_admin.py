"""
Grant (or revoke) admin rights for an existing account.

Usage, from backend/:
    ../venv/Scripts/python.exe scripts/make_admin.py you@example.com
    ../venv/Scripts/python.exe scripts/make_admin.py you@example.com --revoke

In production you can instead set ADMIN_EMAILS=you@example.com in the
environment; listed accounts are promoted every time the API starts.
"""

import asyncio
import os
import sys

from sqlalchemy import func, select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session_maker, engine, Base  # noqa: E402
from app.main import _add_missing_columns  # noqa: E402
from app.models import User  # noqa: E402


async def main(email: str, revoke: bool) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
    async with async_session_maker() as db:
        user = (await db.execute(select(User).where(func.lower(User.email) == email.lower()))).scalar_one_or_none()
        if not user:
            print(f"No account with email {email}. Sign up on the site first, then run this again.")
            sys.exit(1)
        user.is_admin = not revoke
        await db.commit()
        print(f"{user.email}: admin = {user.is_admin}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], "--revoke" in sys.argv))
