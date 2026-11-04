"""
Request logging and error capture.

- Every HTTP request prints one line to the terminal:
      GET /api/v1/listings 200 12.4ms req=3f9c0a1b2c4d ip=1a2b… ua=Chrome/Windows
  4xx lines are WARNING, 5xx are ERROR, slow requests (>1s) are flagged.
- Unhandled exceptions print a full traceback, are stored in `error_logs`,
  and the client receives a clean 500 with the request id to quote.
- Every response carries an `X-Request-ID` header.
"""
import re
import traceback
import uuid
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.database import async_session_maker
from app.core.logging import get_logger
from app.models import ErrorLog
from app.services.analytics import client_ip, hash_ip, parse_user_agent, user_id_from_request

http_log = get_logger("http")
err_log = get_logger("error")

SLOW_MS = 1000
_RID_RE = re.compile(r"^[A-Za-z0-9-]{6,64}$")
_SECRET_QS = re.compile(r"(?i)\b(token|access_token|otp|code|password|secret|key)=[^&]*")


def _safe_query(query: str) -> str:
    """Query string for logs, with anything credential-like masked."""
    return _SECRET_QS.sub(lambda m: f"{m.group(1)}=***", query)[:120] if query else ""
QUIET_PATHS = ("/api/v1/static/", "/favicon", "/docs", "/openapi.json", "/redoc")


async def save_error(**fields) -> None:
    """Persist an error row; never let logging failures break the request."""
    try:
        async with async_session_maker() as db:
            db.add(ErrorLog(**fields))
            await db.commit()
    except Exception:
        err_log.exception("Could not store error log")


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_logger(request: Request, call_next):
        incoming = request.headers.get("x-request-id") or ""
        rid = incoming if _RID_RE.match(incoming) else uuid.uuid4().hex[:12]
        request.state.request_id = rid
        start = perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:  # anything not turned into an HTTP response by FastAPI
            ms = (perf_counter() - start) * 1000
            stack = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__, chain=False))
            err_log.error(
                "%s %s 500 %.1fms req=%s - %s: %s\n%s", request.method, request.url.path, ms, rid, type(exc).__name__, exc, stack.rstrip(),
            )
            await save_error(
                source="server", level="error", request_id=rid, method=request.method, path=request.url.path[:300],
                status_code=500, error_type=type(exc).__name__[:120], message=str(exc)[:4000],
                stack=stack[-20000:],
                user_id=user_id_from_request(request), user_agent=(request.headers.get("user-agent") or "")[:300],
            )
            return JSONResponse(
                {"detail": "Something went wrong on our side. Please try again.", "request_id": rid},
                status_code=500, headers={"X-Request-ID": rid},
            )

        ms = (perf_counter() - start) * 1000
        path = request.url.path
        status = response.status_code
        response.headers["X-Request-ID"] = rid
        if request.method == "OPTIONS" or path.startswith(QUIET_PATHS):
            http_log.debug("%s %s %s %.1fms", request.method, path, status, ms)
            return response

        ua = parse_user_agent(request.headers.get("user-agent") or "")
        query = f"?{_safe_query(request.url.query)}" if request.url.query else ""
        line = "%s %s%s %s %.1fms req=%s ip=%s ua=%s/%s%s" % (
            request.method, path, query, status, ms, rid, (hash_ip(client_ip(request)) or "-")[:8],
            ua["browser"] or "-", ua["os"] or "-", "  SLOW" if ms > SLOW_MS else "",
        )
        if status >= 500:
            http_log.error(line)
        elif status >= 400 or ms > SLOW_MS:
            http_log.warning(line)
        else:
            http_log.info(line)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        summary = "; ".join(f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg')}" for e in errors[:5])
        err_log.warning("422 %s %s - %s", request.method, request.url.path, summary)
        # Same shape FastAPI normally returns, so the frontend's error parsing keeps working.
        safe = [{k: v for k, v in e.items() if k in ("loc", "msg", "type")} for e in errors]
        return JSONResponse({"detail": safe}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if exc.status_code >= 500:
            rid = getattr(request.state, "request_id", None)
            err_log.error("%s %s %s - %s", request.method, request.url.path, exc.status_code, exc.detail)
            await save_error(
                source="server", level="error", request_id=rid, method=request.method, path=request.url.path[:300],
                status_code=exc.status_code, error_type="HTTPException", message=str(exc.detail)[:4000],
                user_id=user_id_from_request(request), user_agent=(request.headers.get("user-agent") or "")[:300],
            )
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))
