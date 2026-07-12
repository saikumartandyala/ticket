/**
 * Single source of truth for the backend origin.
 *
 * In production (behind nginx, same origin as the frontend) both of these
 * are built as empty strings, so every call below resolves as a relative
 * path (`/api/v1/...`) against the page's own origin — no domain baked in.
 *
 * In local dev (no nginx in front) they default to the backend dev server
 * on :8000, matching how this app has always been run outside Docker.
 *
 * NEXT_PUBLIC_* vars are inlined at build time, so the production Docker
 * build sets them to '' explicitly via build args — see frontend/Dockerfile.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/api/v1';
