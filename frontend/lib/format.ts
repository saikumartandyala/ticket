import type { Listing } from './types';

export function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export function money(v: unknown): string {
  return '₹' + Math.round(toNumber(v)).toLocaleString('en-IN');
}

/** Backend timestamps from utcnow() are naive ISO strings — treat them as UTC. */
export function parseUtc(s?: string | null): Date {
  if (!s) return new Date(NaN);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
}

/**
 * expires_at is a real UTC instant from the API ("…Z" / "+00:00").
 * Older rows without a timezone were stored as local wall-clock time.
 */
export function parseLocal(s?: string | null): Date {
  if (!s) return new Date(NaN);
  return new Date(s);
}

export function initials(name?: string | null): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function firstName(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

export function hhmm(t?: string | null): string {
  return t ? String(t).slice(0, 5) : '';
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Tomorrow", or "Sat 8 Nov" */
export function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Time remaining until the listing closes. */
export function timeLeft(expiresAt: string): { label: string; urgent: boolean; ms: number } {
  const ms = parseLocal(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return { label: 'Closed', urgent: false, ms: 0 };
  const mins = Math.floor(ms / 6e4);
  const h = Math.floor(mins / 60);
  const d = Math.floor(h / 24);
  let label: string;
  if (mins < 60) label = `${mins}m`;
  else if (h < 24) label = `${h}h ${mins % 60}m`;
  else label = `${d}d ${h % 24}h`;
  return { label, urgent: h < 6, ms };
}

export function relativeTime(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function discountPct(l: Pick<Listing, 'asking_price' | 'original_price'>): number {
  const face = toNumber(l.original_price);
  const ask = toNumber(l.asking_price);
  if (face <= 0) return 0;
  return Math.max(0, Math.round((1 - ask / face) * 100));
}

/** One-line place descriptor: route, or venue + city. */
export function placeLine(l: Partial<Listing>): string {
  if (l.origin_city && l.destination_city) return `${l.origin_city} → ${l.destination_city}`;
  return [l.venue_name, l.venue_city].filter(Boolean).join(', ');
}

export function seatLine(l: Partial<Listing>): string {
  const sd = l.seat_details || {};
  const parts = [
    sd.coach || sd.class,
    l.section,
    l.row_number ? `Row ${l.row_number}` : '',
    sd.seat ? (/^seat/i.test(String(sd.seat)) ? sd.seat : `Seat ${sd.seat}`) : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/** "New Delhi (NDLS)" -> "New Delhi" */
export function stationName(s?: string | null): string {
  return (s || '').replace(/\s*\([A-Z0-9]{2,6}\)\s*$/, '').trim();
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function stripEmoji(s: string): string {
  return s.replace(new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D]', 'gu'), '').replace(/\s+([!.,])/g, '$1').trim();
}
