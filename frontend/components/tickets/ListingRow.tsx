import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Listing } from '../../lib/types';
import { categoryFor } from '../../lib/categories';
import { dayLabel, discountPct, hhmm, money, placeLine, seatLine, timeLeft } from '../../lib/format';
import { cn } from '../../lib/cn';
import { FlipText } from '../motion';

export function TimeLeft({ expiresAt, className, bare = false }: { expiresAt: string; className?: string; bare?: boolean }) {
  const t = timeLeft(expiresAt);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs num',
        t.urgent ? 'text-accent' : 'text-ink-3',
        className,
      )}
      title="Time until this listing closes"
    >
      {t.urgent && <span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent" />}
      {t.label === 'Closed' || bare ? t.label : `${t.label} left`}
    </span>
  );
}

/** One line of the departure board. Grid on desktop, compact stack on mobile. */
export function ListingRow({ listing, compact = false, index = 0 }: { listing: Listing; compact?: boolean; index?: number }) {
  const cat = categoryFor(listing);
  const Icon = cat.icon;
  const off = discountPct(listing);
  const time = hhmm(listing.departure_time);
  const place = placeLine(listing);
  const seat = seatLine(listing);

  return (
    <Link
      href={`/tickets/${listing.id}`}
      data-track={`Listing: ${listing.title}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        'group relative grid animate-row-in items-center gap-x-4 border-b border-line px-4 py-3.5 transition-colors duration-300 last:border-b-0 hover:bg-subtle/60 sm:px-5',
        'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:origin-center before:scale-y-0 before:rounded-r-full before:bg-accent before:transition-transform before:duration-300 before:ease-out-expo hover:before:scale-y-100',
        compact
          ? 'grid-cols-[64px_minmax(0,1fr)_auto]'
          : 'grid-cols-[64px_minmax(0,1fr)_auto] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,180px)_110px_96px]',
      )}
    >
      {/* When */}
      <div className="leading-tight">
        <div className="font-mono text-[15px] font-medium text-ink num">
          {time ? <FlipText text={time} delay={150 + index * 70} /> : '——'}
        </div>
        <div className="mt-0.5 text-xs text-ink-3">{dayLabel(listing.event_date)}</div>
      </div>

      {/* What */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="line-clamp-2 text-[15px] font-medium leading-snug text-ink transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5 md:line-clamp-1">{listing.title}</span>
        </div>
        <div className="mt-0.5 truncate text-[13px] text-ink-2">
          {[cat.name, listing.operator_name, cat.kind === 'venue' && place !== listing.title ? place : ''].filter(Boolean).join(' · ')}
        </div>
        {(!compact) && (
          <div className="mt-1 md:hidden">
            <TimeLeft expiresAt={listing.expires_at} />
          </div>
        )}
      </div>

      {/* Seat (desktop) */}
      {!compact && (
        <div className="hidden min-w-0 truncate text-[13px] text-ink-2 md:block">
          {seat || (listing.seat_count > 1 ? `${listing.seat_count} seats` : '—')}
        </div>
      )}

      {/* Price */}
      <div className="text-right leading-tight">
        <div className="font-mono text-[15px] font-medium text-ink num">{money(listing.asking_price)}</div>
        {off > 0 && (
          <div className="mt-0.5 text-xs text-ink-3">
            <span className="line-through">{money(listing.original_price)}</span>
            <span className="ml-1.5 text-good">−{off}%</span>
          </div>
        )}
      </div>

      {/* Time left (desktop) */}
      {!compact && (
        <div className="hidden items-center justify-end gap-2 md:flex">
          <TimeLeft expiresAt={listing.expires_at} bare />
          <ArrowUpRight className="h-4 w-4 -translate-x-1 translate-y-1 text-accent opacity-0 transition-all duration-300 ease-out-expo group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>
      )}
    </Link>
  );
}

export function ListingRowSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'grid items-center gap-x-4 border-b border-line px-4 py-4 last:border-b-0 sm:px-5',
        compact ? 'grid-cols-[64px_minmax(0,1fr)_auto]' : 'grid-cols-[64px_minmax(0,1fr)_auto] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,180px)_110px_96px]',
      )}
    >
      <div className="space-y-1.5"><div className="skeleton h-4 w-12" /><div className="skeleton h-3 w-14" /></div>
      <div className="space-y-1.5"><div className="skeleton h-4 w-3/5" /><div className="skeleton h-3 w-2/5" /></div>
      {!compact && <div className="skeleton hidden h-3 w-24 md:block" />}
      <div className="flex flex-col items-end space-y-1.5"><div className="skeleton h-4 w-16" /><div className="skeleton h-3 w-12" /></div>
      {!compact && <div className="skeleton hidden h-3 w-16 justify-self-end md:block" />}
    </div>
  );
}

export function BoardHeader({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <div className="hidden grid-cols-[84px_minmax(0,1fr)_minmax(0,180px)_110px_96px] gap-x-4 border-b border-line bg-subtle/40 px-5 py-2.5 md:grid">
      <span className="eyebrow">Departs</span>
      <span className="eyebrow">Ticket</span>
      <span className="eyebrow">Seat</span>
      <span className="eyebrow text-right">Price</span>
      <span className="eyebrow text-right">Closes in</span>
    </div>
  );
}
