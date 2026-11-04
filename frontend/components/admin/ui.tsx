'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { Badge, Skeleton } from '../ui/misc';
import { Button, IconButton } from '../ui/Button';
import { cn } from '../../lib/cn';

/* ------------------------------------------------------------------ data */

/**
 * Admin data with stale-while-revalidate caching: a section you've already
 * opened renders instantly from memory while fresh data loads in the
 * background, so switching between sections never shows an empty skeleton.
 */
const adminCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function fetchAdmin<T>(path: string): Promise<T> {
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = api<T>(`/admin${path}`)
    .then((d) => { adminCache.set(path, d); return d; })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

/** Warm the cache for sections the admin is likely to open next. */
export function prefetchAdmin(paths: string[]) {
  for (const p of paths) if (!adminCache.has(p)) fetchAdmin(p).catch(() => {});
}

export function useAdmin<T>(path: string | null) {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const [data, setDataState] = useState<T | null>(() => (path ? ((adminCache.get(path) as T) ?? null) : null));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const setData = useCallback((d: T | null) => {
    if (path) { if (d === null) adminCache.delete(path); else adminCache.set(path, d); }
    setDataState(d);
  }, [path]);

  const load = useCallback(async () => {
    if (!path || !signedIn) return;
    const cached = adminCache.get(path) as T | undefined;
    if (cached !== undefined) setDataState(cached);
    setLoading(true);
    setError('');
    try {
      setDataState(await fetchAdmin<T>(path));
    } catch (e) {
      if (cached === undefined) setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path, signedIn]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useAdminAction() {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, success?: string): Promise<T | null> => {
      setBusy(key);
      try {
        const res = await api<T>(`/admin${path}`, { method: method as any, body });
        if (success) toast(success, undefined, 'success');
        return res;
      } catch (e) {
        toast('Action failed', errorMessage(e), 'error');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [signedIn],
  );
  return { run, busy };
}

export interface Paged<T> { items: T[]; total: number; page: number; size: number }

/* ------------------------------------------------------------------ layout bits */

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, className, children, bodyClass }: { title?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode; bodyClass?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-line bg-surface shadow-card', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), 300);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-8 text-sm placeholder:text-ink-3 transition-[border-color,box-shadow] focus:border-accent/70 focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
      {draft && (
        <button aria-label="Clear" onClick={() => { setDraft(''); onChange(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

/** Pill tabs with a sliding background. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-v="${value}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div ref={ref} className="no-scrollbar relative flex max-w-full overflow-x-auto rounded-md border border-line bg-subtle/60 p-0.5">
      <span aria-hidden className="absolute bottom-0.5 top-0.5 rounded-[7px] bg-surface shadow-card transition-[left,width] duration-300 ease-out-expo" style={pill} />
      {options.map((o) => (
        <button
          key={o.value}
          data-v={o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative z-[1] flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13px] transition-colors', value === o.value ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink')}
        >
          {o.label}
          {o.count !== undefined && <span className="font-mono text-[11px] text-ink-3 num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export const th = 'whitespace-nowrap border-b border-line bg-subtle/50 px-4 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-ink-3';
export const td = 'border-b border-line px-4 py-3 align-middle text-sm';

/**
 * Horizontal scroller for wide content. On narrow screens it shows a visible
 * scrollbar, fades the edge that has more content, and a one-line
 * "swipe" hint, so it's obvious the table continues sideways.
 */
export function ScrollX({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);
  return (
    <div className={cn('relative', className)}>
      {(edges.right || edges.left) && (
        <div className="flex items-center justify-end gap-1 border-b border-line px-4 py-1.5 font-mono text-[11px] text-ink-3 lg:hidden" aria-hidden>
          Swipe to see more <ChevronRight className="h-3 w-3" />
        </div>
      )}
      <div ref={ref} className="scroll-x overflow-x-auto overscroll-x-contain">{children}</div>
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface to-transparent transition-opacity', edges.left ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent transition-opacity', edges.right ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

/** Admin data table: scrolls sideways on small screens with the first column pinned. */
export function Table({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <ScrollX>
      <table className="admin-table w-full border-separate border-spacing-0" style={{ minWidth }}>{children}</table>
    </ScrollX>
  );
}

export function TableSkeleton({ cols = 6, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-48' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-3">
      <span className="num">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-8 w-8 disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <span className="px-2 font-mono text-xs num">{page} / {pages}</span>
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-8 w-8 disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ status */

const LISTING_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  active: 'good', flagged: 'danger', cancelled: 'neutral', expired: 'neutral', transferred: 'solid', matched: 'accent',
};
const MATCH_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  pending: 'warn', accepted: 'good', contact_revealed: 'good', transferred: 'solid', declined: 'neutral', cancelled: 'neutral', disputed: 'danger', expired: 'neutral',
};

export function StatusBadge({ status, kind = 'listing' }: { status: string; kind?: 'listing' | 'match' }) {
  const tone = (kind === 'listing' ? LISTING_TONE : MATCH_TONE)[status] || 'neutral';
  const label = status === 'contact_revealed' ? 'In contact' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge tone={tone}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', (status === 'pending' || status === 'flagged' || status === 'disputed') && 'animate-blink')} />
      {label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ drawer */

export function Drawer({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full animate-drawer-in flex-col border-l border-line bg-bg shadow-pop" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 text-[15px] font-semibold">{title}</div>
          <IconButton label="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ confirm */

/** Two-step button: first click arms it, second click runs it. */
export function ConfirmButton({
  children,
  confirmLabel = 'Confirm',
  onConfirm,
  variant = 'secondary',
  danger,
  loading,
  size = 'sm',
  className,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: 'secondary' | 'ghost' | 'primary';
  danger?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (armed) {
    return (
      <Button
        size={size}
        variant={danger ? 'danger' : 'primary'}
        loading={loading}
        className={cn('animate-pop-in', className)}
        onClick={() => { setArmed(false); onConfirm(); }}
      >
        {confirmLabel}
      </Button>
    );
  }
  return (
    <Button size={size} variant={variant} className={cn(danger && 'hover:text-danger', className)} onClick={() => setArmed(true)} loading={loading}>
      {children}
    </Button>
  );
}

export function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-6 text-sm text-danger">
      {message}
      <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="px-5 py-12 text-center text-sm text-ink-3">{text}</div>;
}
