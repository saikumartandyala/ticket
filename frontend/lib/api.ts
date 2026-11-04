/**
 * Single source of truth for the backend origin.
 *
 * Every request goes over HTTPS (and chat over WSS) — plain http:// / ws://
 * endpoints are refused here, before anything leaves the browser.
 *
 * Auth is the API's HttpOnly session cookie, sent with `credentials: 'include'`.
 * No token is ever readable from JavaScript, so a script injected into the
 * page can't steal a session.
 *
 * NEXT_PUBLIC_* vars are inlined at build time. Locally the API runs on
 * https://localhost:8000 (see README for the dev certificate).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:8000/api/v1';

/** Origin that serves backend-relative asset paths like `/api/v1/static/...`. */
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

function isSecureUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('/');
}

/** wss:// base for the chat socket (derived from the API URL when not set). */
export function wsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  if (API_BASE.startsWith('https://')) return API_BASE.replace(/^https:/, 'wss:');
  if (API_BASE.startsWith('/') && typeof window !== 'undefined') return `wss://${window.location.host}${API_BASE}`;
  return '';
}

export function assetUrl(path: string): string {
  if (!path) return path;
  if (/^https:\/\//.test(path)) return path;
  if (!path.startsWith('/')) return '';
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';
const INSECURE_ERROR = 'Blocked an insecure (non-HTTPS) request. The API must be served over https://.';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  } catch {}
  if (res.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  return fallback;
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  fallbackError?: string;
  keepalive?: boolean;
};

/**
 * Thin fetch wrapper: JSON in/out, cookie auth, and readable error messages
 * pulled from FastAPI's `detail` field. Throws ApiError on any failure.
 */
export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  if (!isSecureUrl(url)) throw new ApiError(INSECURE_ERROR, 0);

  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
      referrerPolicy: 'strict-origin-when-cross-origin',
      keepalive: opts.keepalive,
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  if (!res.ok) {
    throw new ApiError(await readError(res, opts.fallbackError || 'Something went wrong. Please try again.'), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json().catch(() => undefined as T);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
