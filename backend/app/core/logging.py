"""
Terminal logging for the whole backend.

Every log line looks like:
    2026-11-04 14:02:11 IST | INFO     | http      | GET /api/v1/listings 200 12.4ms  req=3f9c…

Uvicorn's own loggers are routed through the same handler so the
terminal has a single, consistent format. Set LOG_LEVEL=DEBUG for more.
"""
import logging
import logging.config
import sys
from datetime import datetime

from app.core.config import settings

COLORS = {
    "DEBUG": "\033[90m",
    "INFO": "\033[36m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[1;31m",
}
RESET = "\033[0m"


class TerminalFormatter(logging.Formatter):
    def __init__(self, color: bool):
        super().__init__()
        self.color = color

    def format(self, record: logging.LogRecord) -> str:
        from app.core.timeutil import LOCAL_TZ

        ts = datetime.fromtimestamp(record.created, LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S %Z")
        level = record.levelname
        # uvicorn's general logger is confusingly called "uvicorn.error"; it's not an error.
        name = "server" if record.name.startswith("uvicorn") else record.name.replace("app.", "")[:9]
        msg = record.getMessage()
        if self.color:
            level_txt = f"{COLORS.get(level, '')}{level:<8}{RESET}"
        else:
            level_txt = f"{level:<8}"
        line = f"{ts} | {level_txt} | {name:<9} | {msg}"
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


def setup_logging() -> None:
    level = settings.LOG_LEVEL.upper()
    color = sys.stderr.isatty()
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"terminal": {"()": TerminalFormatter, "color": color}},
        "handlers": {"stderr": {"class": "logging.StreamHandler", "formatter": "terminal", "stream": "ext://sys.stderr"}},
        "root": {"handlers": ["stderr"], "level": level},
        "loggers": {
            # Route uvicorn through our formatter; our middleware logs requests,
            # so uvicorn's own access log would just duplicate them.
            "uvicorn": {"handlers": ["stderr"], "level": level, "propagate": False},
            "uvicorn.error": {"handlers": ["stderr"], "level": level, "propagate": False},
            "uvicorn.access": {"handlers": [], "level": "WARNING", "propagate": False},
            "sqlalchemy.engine": {"level": "WARNING"},
            "httpx": {"level": "WARNING"},
        },
    })


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"app.{name}")
