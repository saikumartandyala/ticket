"""
Transport and browser hardening for every API response.

- HTTPS only: plain-HTTP requests get 403 (APIs should fail loudly, not
  redirect, so a misconfigured client is noticed instead of leaking data).
  Behind a proxy (Vercel), the original scheme comes from X-Forwarded-Proto.
- HSTS in production, so browsers refuse to ever talk to us over HTTP.
- Locked-down headers: the API serves JSON and images, never pages, so it
  denies framing, scripts, sniffing and caching of private data.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("security")

DOC_PATHS = ("/docs", "/redoc", "/api/v1/openapi.json")
STATIC_PREFIX = "/api/v1/static/"

BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    # Images may be embedded by our own site (tickorbit.in <-> api.tickorbit.in are same-site).
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Permitted-Cross-Domain-Policies": "none",
    # The API is data, not pages: keep api.tickorbit.in out of search results.
    "X-Robots-Tag": "noindex, nofollow",
}
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
HSTS = "max-age=63072000; includeSubDomains"


def request_scheme(scheme: str, headers) -> str:
    """The scheme the client actually used, honouring a trusted proxy."""
    if settings.TRUST_PROXY_HEADERS:
        forwarded = (headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
        if forwarded:
            return forwarded
    return scheme


def is_secure(scheme: str, headers) -> bool:
    return request_scheme(scheme, headers) in ("https", "wss")


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        path = request.url.path
        if settings.FORCE_HTTPS and not is_secure(request.url.scheme, request.headers):
            log.warning("Refused plain-HTTP request %s %s", request.method, path)
            response = JSONResponse({"detail": "HTTPS is required. Use https:// for every request."}, status_code=403)
        else:
            response = await call_next(request)

        for name, value in BASE_HEADERS.items():
            response.headers.setdefault(name, value)
        if not path.startswith(DOC_PATHS):
            response.headers.setdefault("Content-Security-Policy", API_CSP)
        if path.startswith(STATIC_PREFIX):
            # Random, never-reused file names: safe to cache, never executable.
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers.setdefault("Cache-Control", "no-store")
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = HSTS
        return response
