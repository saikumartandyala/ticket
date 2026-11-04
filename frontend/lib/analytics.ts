'use client';

/**
 * Lightweight first-party analytics.
 *
 * - visitor id: random, kept in localStorage (identifies a browser, not a person)
 * - session id: random, renewed after 30 minutes of inactivity
 * - events are batched and sent every 5s, and flushed when the tab is hidden
 * - clicks record the button/link label only — never what people type
 * - JS errors are reported to /events/error so admins can see them
 */
import { API_BASE } from './api';

type EventType = 'page_view' | 'click' | 'search';
interface QueuedEvent {
  type: EventType;
  path?: string;
  element?: string;
  target_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  screen?: string;
  properties?: Record<string, unknown>;
}

const VISITOR_KEY = 'to_vid';
const SESSION_KEY = 'to_sid';
const SESSION_SEEN_KEY = 'to_sid_seen';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 5000;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let firstPageView = true;

const isBrowser = () => typeof window !== 'undefined';

function rid(): string {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function visitorId(): string {
  const s = store();
  let v = s?.getItem(VISITOR_KEY);
  if (!v) { v = rid(); s?.setItem(VISITOR_KEY, v); }
  return v;
}

function sessionId(): string {
  const s = store();
  const now = Date.now();
  let id = s?.getItem(SESSION_KEY);
  const seen = Number(s?.getItem(SESSION_SEEN_KEY) || 0);
  if (!id || now - seen > SESSION_IDLE_MS) {
    id = rid();
    s?.setItem(SESSION_KEY, id);
    firstPageView = true;
  }
  s?.setItem(SESSION_SEEN_KEY, String(now));
  return id;
}

function excluded(path: string) {
  return path.startsWith('/admin');
}

export function flush(keepalive = false) {
  if (!isBrowser() || queue.length === 0 || !API_BASE.startsWith('https://')) return;
  const events = queue.splice(0, 50);
  const body = JSON.stringify({ visitor_id: visitorId(), session_id: sessionId(), events });
  fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive,
    credentials: 'include',
  }).catch(() => {
    // Network hiccup: put them back once, they'll go with the next flush.
    if (queue.length < 200) queue.unshift(...events);
  });
  if (queue.length) schedule();
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
}

function push(e: QueuedEvent) {
  if (!isBrowser() || excluded(e.path || location.pathname)) return;
  queue.push(e);
  if (queue.length >= 20) flush();
  else schedule();
}

export function trackPageView(path: string) {
  if (!isBrowser()) return;
  const e: QueuedEvent = { type: 'page_view', path, screen: `${window.innerWidth}x${window.innerHeight}` };
  sessionId(); // may start a new session and reset firstPageView
  if (firstPageView) {
    // Source attribution only on the first page of a visit.
    e.referrer = document.referrer || undefined;
    const q = new URLSearchParams(location.search);
    e.utm_source = q.get('utm_source') || undefined;
    e.utm_medium = q.get('utm_medium') || undefined;
    e.utm_campaign = q.get('utm_campaign') || undefined;
    firstPageView = false;
  }
  push(e);
}

export function trackSearch(query: string, properties?: Record<string, unknown>) {
  const q = query.trim().slice(0, 160);
  if (q) push({ type: 'search', path: location.pathname, element: q, properties });
}

function labelFor(el: HTMLElement): string {
  const explicit = el.getAttribute('data-track') || el.getAttribute('aria-label') || el.getAttribute('title');
  const text = explicit || el.innerText || el.textContent || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 80) || el.tagName.toLowerCase();
}

function onClick(ev: MouseEvent) {
  const t = ev.target as HTMLElement | null;
  const el = t?.closest?.('a, button, [role="button"], [data-track]') as HTMLElement | null;
  if (!el || el.closest('[data-no-track]')) return;
  let target_url: string | undefined;
  if (el instanceof HTMLAnchorElement && el.href) {
    try {
      const u = new URL(el.href);
      target_url = u.origin === location.origin ? u.pathname + u.search : u.href;
    } catch {}
  }
  push({ type: 'click', path: location.pathname, element: labelFor(el), target_url });
}

/* -------------------------------------------------------------- errors */

const reported = new Map<string, number>();
let reportedCount = 0;

export function reportError(message: string, stack?: string, kind: 'error' | 'unhandledrejection' | 'react' = 'error') {
  if (!isBrowser() || !message) return;
  const key = message.slice(0, 200);
  const now = Date.now();
  if ((reported.get(key) || 0) > now - 10000 || reportedCount >= 20) return;
  reported.set(key, now);
  reportedCount += 1;
  fetch(`${API_BASE}/events/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ message: message.slice(0, 2000), stack: stack?.slice(0, 10000), path: location.pathname, kind }),
    keepalive: true,
  }).catch(() => {});
}

function onError(ev: ErrorEvent) {
  // Ignore noise from extensions and cross-origin scripts.
  if (!ev.message || ev.message === 'Script error.') return;
  reportError(ev.message, ev.error?.stack);
}

function onRejection(ev: PromiseRejectionEvent) {
  const r = ev.reason;
  const message = r instanceof Error ? `${r.name}: ${r.message}` : typeof r === 'string' ? r : 'Unhandled promise rejection';
  reportError(message, r instanceof Error ? r.stack : undefined, 'unhandledrejection');
}

let installed = false;

/** Call once on app start. Returns a cleanup function. */
export function installAnalytics(): () => void {
  if (!isBrowser() || installed) return () => {};
  installed = true;
  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
  document.addEventListener('click', onClick, { capture: true });
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => flush(true));
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    installed = false;
    document.removeEventListener('click', onClick, { capture: true });
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
