import type { CategoryDef } from '../../lib/categories';
import { dayLabel, fullDate, hhmm, money, toNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

export interface StubData {
  id?: string;
  category: CategoryDef;
  title: string;
  operator?: string | null;
  operatorCode?: string | null;
  from?: string | null;
  to?: string | null;
  venue?: string | null;
  city?: string | null;
  date?: string | null;
  departure?: string | null;
  arrival?: string | null;
  seat?: string | null;
  seats?: number;
  pnrLast4?: string | null;
  asking?: number | string | null;
  face?: number | string | null;
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-medium leading-snug text-ink num">{value || '—'}</div>
    </div>
  );
}

/** Split city name from a trailing station code, e.g. "New Delhi (NDLS)". */
function splitStation(s?: string | null): { name: string; code?: string } {
  const v = (s || '').trim();
  const m = v.match(/^(.*?)\s*\(([A-Z0-9]{2,6})\)$/);
  return m ? { name: m[1], code: m[2] } : { name: v };
}

/**
 * Printed-ticket rendering of a listing: main body + tear-off price stub,
 * separated by a perforation with notches cut into the edges.
 */
export function TicketStub({
  data,
  placeholder = false,
  stacked = false,
  className,
}: {
  data: StubData;
  placeholder?: boolean;
  /** Force the vertical layout (used in narrow sidebars). */
  stacked?: boolean;
  className?: string;
}) {
  const Icon = data.category.icon;
  const isRoute = data.category.kind === 'route';
  const asking = toNumber(data.asking);
  const face = toNumber(data.face);
  const off = face > 0 && asking > 0 ? Math.max(0, Math.round((1 - asking / face) * 100)) : 0;
  const from = splitStation(data.from);
  const to = splitStation(data.to);
  const serial = data.id ? data.id.replace(/-/g, '').slice(0, 8).toUpperCase() : 'PREVIEW';
  const dim = placeholder ? 'text-ink-3' : 'text-ink';

  return (
    <div className={cn('stub-wrap', className)}>
      <div className={cn('relative flex flex-col overflow-hidden rounded-lg bg-surface', !stacked && 'sm:stub sm:flex-row sm:[--cut:70%]')}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        {/* Main */}
        <div className={cn('min-w-0 flex-1 p-5', !stacked && 'sm:basis-[70%] sm:p-7')}>
          <div className="flex items-center gap-2 text-ink-2">
            <Icon className="h-4 w-4" aria-hidden />
            <span className="eyebrow !text-ink-2">
              {[data.category.name, data.operator, data.operatorCode].filter(Boolean).join(' · ')}
            </span>
          </div>

          {isRoute ? (
            <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4">
              <div className="min-w-0">
                <div className="eyebrow">From</div>
                <div className={cn('mt-1 break-words text-[22px] font-semibold leading-[1.1] tracking-[-0.02em]', !stacked && 'sm:text-[26px]', dim)}>{from.name || 'Origin'}</div>
                <div className="mt-1 font-mono text-[13px] text-ink-3 num">{[from.code, hhmm(data.departure)].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <div className="flex items-center pt-[30px] text-ink-3" aria-hidden>
                <span className="h-px w-6 bg-line-strong sm:w-12" />
                <span className="ml-0.5 text-xs">▶</span>
              </div>
              <div className="min-w-0 text-right">
                <div className="eyebrow">To</div>
                <div className={cn('mt-1 break-words text-[22px] font-semibold leading-[1.1] tracking-[-0.02em]', !stacked && 'sm:text-[26px]', dim)}>{to.name || 'Destination'}</div>
                <div className="mt-1 font-mono text-[13px] text-ink-3 num">{[to.code, hhmm(data.arrival)].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className={cn('text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]', dim)}>{data.title || 'Event name'}</div>
              <div className="mt-1.5 text-sm text-ink-2">{[data.venue, data.city].filter(Boolean).join(', ') || 'Venue, city'}</div>
            </div>
          )}

          <div className={cn('mt-6 grid grid-cols-2 gap-x-4 gap-y-4', !stacked && 'sm:grid-cols-4')}>
            <Fact label="Date" value={data.date ? (placeholder ? fullDate(data.date) : dayLabel(data.date)) : null} />
            <Fact label={isRoute ? 'Departs' : 'Starts'} value={hhmm(data.departure)} />
            <Fact label="Seat" value={data.seat} />
            <Fact label={data.pnrLast4 ? 'PNR' : 'Admits'} value={data.pnrLast4 ? `•••• ${data.pnrLast4}` : data.seats ? String(data.seats) : null} />
          </div>
        </div>

        {/* Perforation */}
        <div className={cn('perf-h mx-5', !stacked && 'sm:hidden')} />
        {!stacked && <div className="perf-v hidden self-stretch sm:my-4 sm:block" />}

        {/* Stub */}
        <div className={cn('flex flex-col justify-between gap-6 p-5', !stacked && 'sm:basis-[30%] sm:p-7')}>
          <div>
            <div className="eyebrow">Asking</div>
            <div className={cn('mt-1 font-mono text-[28px] font-medium leading-none tracking-[-0.02em] num', asking ? 'text-ink' : 'text-ink-3')}>
              {asking ? money(asking) : '₹ —'}
            </div>
            {face > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[13px]">
                <span className="font-mono text-ink-3 line-through num">{money(face)}</span>
                {off > 0 && <span className="font-medium text-good">−{off}%</span>}
              </div>
            )}
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="eyebrow">Admit</div>
              <div className="mt-1 font-mono text-sm font-medium num">{String(data.seats || 1).padStart(2, '0')}</div>
            </div>
            <div className="font-mono text-[11px] tracking-[0.12em] text-ink-3">№ {serial}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
