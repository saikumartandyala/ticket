"""
One place for time handling.

Rules used across the app:
- Every timestamp is stored and compared in UTC.
- Python code only ever sees timezone-aware datetimes (tzinfo=UTC).
- Wall-clock inputs from users (a train's departure date + time) are
  interpreted in APP_TIMEZONE (India by default) and converted to UTC.
"""
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.types import DateTime, TypeDecorator

from app.core.config import settings

UTC = timezone.utc
LOCAL_TZ = ZoneInfo(settings.APP_TIMEZONE)


def utcnow() -> datetime:
    """Current time, timezone-aware, in UTC."""
    return datetime.now(UTC)


def as_utc(dt: datetime | None) -> datetime | None:
    """Normalise any datetime to aware UTC. Naive values are assumed to already be UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def local_to_utc(d: date, t: time | None, default_time: time = time(23, 59, 59)) -> datetime:
    """A wall-clock date/time in APP_TIMEZONE (e.g. a departure) -> aware UTC."""
    return datetime.combine(d, t or default_time, tzinfo=LOCAL_TZ).astimezone(UTC)


def local_today() -> date:
    return datetime.now(LOCAL_TZ).date()


class UTCDateTime(TypeDecorator):
    """
    DateTime column that always round-trips aware UTC datetimes.

    Postgres: stored as TIMESTAMPTZ.
    SQLite:   stored as a naive UTC string (SQLite has no timezone type) and
              re-tagged as UTC on the way out, so both databases behave the same.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        value = as_utc(value)
        if dialect.name == "sqlite":
            return value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        return as_utc(value)
