from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _async_url(url: str) -> str:
    """Accept the plain `postgresql://` string Supabase gives you."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url


DATABASE_URL = _async_url(settings.DATABASE_URL)
engine_kwargs: dict = {}

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    local = any(h in DATABASE_URL for h in ("@localhost", "@127.0.0.1"))
    # Supabase's pooler (PgBouncer, transaction mode on port 6543) can't keep
    # prepared statements between transactions, and serverless instances must
    # not hold idle connections: let the pooler do the pooling.
    engine_kwargs["poolclass"] = NullPool
    engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        # Encrypt the connection to the database (always, except a local Postgres).
        **({} if local else {"ssl": "require"}),
        "server_settings": {"application_name": "tickorbit-api"},
    }

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    # Never print bound values (emails, hashes) inside SQL error messages.
    hide_parameters=settings.is_production,
    **engine_kwargs,
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
