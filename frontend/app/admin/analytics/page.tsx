'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeftRight, Eye, Globe, LogIn, Monitor, MousePointerClick, Search, Smartphone, Tablet, Ticket, TrendingDown, TrendingUp, UserPlus, Users,
} from 'lucide-react';
import { AreaChart, BarList } from '../../../components/admin/charts';
import { AdminHeader, Panel, Segmented, td, th, useAdmin } from '../../../components/admin/ui';
import { CountUp } from '../../../components/motion';
import { Skeleton } from '../../../components/ui/misc';
import { parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

type RangeKey = '24h' | '7d' | '30d' | '90d';
type Metric = 'visitors' | 'page_views' | 'clicks' | 'signups';
interface Kpis {
  visitors: number; sessions: number; page_views: number; clicks: number; searches: number;
  pages_per_session: number; bounce_rate: number;
  signup: number; login: number; listing_created: number; request_sent: number; request_accepted: number; transfer_completed: number; review_left: number;
}
interface Analytics {
  range: RangeKey; granularity: 'hour' | 'day';
  current: Kpis; previous: Kpis;
  timeseries: { t: string; visitors: number; page_views: number; clicks: number; signups: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  top_clicks: { element: string; path: string; clicks: number }[];
  top_searches: { label: string; value: number }[];
  referrers: { label: string; value: number }[];
  utm_sources: { label: string; value: number }[];
  devices: { label: string; value: number }[];
  browsers: { label: string; value: number }[];
  os: { label: string; value: number }[];
  funnel: { label: string; value: number }[];
}
interface Live {
  active_visitors: number;
  active_pages: { path: string; visitors: number }[];
  events: { id: string; type: string; source: string; path: string | null; element: string | null; device: string | null; browser: string | null; os: string | null; visitor: string; at: string; properties: Record<string, unknown> | null }[];
}

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '24h', label: '24h' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' },
];
const METRICS: { value: Metric; label: string }[] = [
  { value: 'visitors', label: 'Visitors' }, { value: 'page_views', label: 'Page views' }, { value: 'clicks', label: 'Clicks' }, { value: 'signups', label: 'Sign-ups' },
];

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return <span className="text-ink-3">no change</span>;
  if (!before) return <span className="text-good">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="text-ink-3">same as before</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1', good ? 'text-good' : 'text-danger')}>
      <Icon className="h-3.5 w-3.5" />{Math.abs(pct)}%
    </span>
  );
}

function Stat({ icon: Icon, label, value, prev, decimals = 0, suffix = '', invert = false, i }: {
  icon: typeof Users; label: string; value: number; prev: number; decimals?: number; suffix?: string; invert?: boolean; i: number;
}) {
  return (
    <div style={{ animationDelay: `${i * 50}ms` }} className="spotlight animate-row-in rounded-lg border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between text-[13px] text-ink-3">
        {label}
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-mono text-[28px] font-medium leading-none tracking-[-0.02em] num">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="mt-2 text-xs"><Delta now={value} before={prev} invert={invert} /> <span className="text-ink-3">vs previous period</span></div>
    </div>
  );
}

const EVENT_STYLE: Record<string, { label: string; dot: string; icon: typeof Eye }> = {
  page_view: { label: 'Viewed', dot: 'bg-ink-3', icon: Eye },
  click: { label: 'Clicked', dot: 'bg-accent', icon: MousePointerClick },
  search: { label: 'Searched', dot: 'bg-warn', icon: Search },
  signup: { label: 'Signed up', dot: 'bg-good', icon: UserPlus },
  login: { label: 'Signed in', dot: 'bg-good', icon: LogIn },
  listing_created: { label: 'Listed a ticket', dot: 'bg-accent', icon: Ticket },
  request_sent: { label: 'Sent a request', dot: 'bg-accent', icon: ArrowLeftRight },
  request_accepted: { label: 'Accepted a request', dot: 'bg-good', icon: ArrowLeftRight },
  transfer_completed: { label: 'Completed a transfer', dot: 'bg-ink', icon: ArrowLeftRight },
  review_left: { label: 'Left a review', dot: 'bg-warn', icon: UserPlus },
};

const DEVICE_ICON: Record<string, typeof Monitor> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [metric, setMetric] = useState<Metric>('visitors');
  const data = useAdmin<Analytics>(`/analytics?range=${range}`);
  const live = useAdmin<Live>('/analytics/live');

  // Keep the live panel fresh.
  useEffect(() => {
    const t = setInterval(() => live.reload(), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = data.data;
  const fmt = (t: string) =>
    a?.granularity === 'hour'
      ? t.slice(11, 16)
      : new Date(t + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Analytics"
        description="How many people visit, what they look at and click, where they come from, and how many become customers."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] shadow-card">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
              </span>
              <span className="font-mono font-medium num">{live.data?.active_visitors ?? '–'}</span>
              <span className="text-ink-3">online now</span>
            </span>
            <Segmented value={range} onChange={setRange} options={RANGES} />
          </div>
        }
      />

      {data.error && <Panel><div className="px-5 py-4 text-sm text-danger">{data.error}</div></Panel>}

      {!a ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-lg" />)}</div>
      ) : (
        <div className={cn('grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4', data.loading && 'opacity-60')}>
          <Stat i={0} icon={Users} label="Unique visitors" value={a.current.visitors} prev={a.previous.visitors} />
          <Stat i={1} icon={Eye} label="Page views" value={a.current.page_views} prev={a.previous.page_views} />
          <Stat i={2} icon={MousePointerClick} label="Clicks" value={a.current.clicks} prev={a.previous.clicks} />
          <Stat i={3} icon={Globe} label="Visits (sessions)" value={a.current.sessions} prev={a.previous.sessions} />
          <Stat i={4} icon={TrendingDown} label="Bounce rate" value={Math.round(a.current.bounce_rate * 100)} prev={Math.round(a.previous.bounce_rate * 100)} suffix="%" invert />
          <Stat i={5} icon={Eye} label="Pages per visit" value={a.current.pages_per_session} prev={a.previous.pages_per_session} decimals={1} />
          <Stat i={6} icon={UserPlus} label="Sign-ups" value={a.current.signup} prev={a.previous.signup} />
          <Stat i={7} icon={ArrowLeftRight} label="Requests sent" value={a.current.request_sent} prev={a.previous.request_sent} />
        </div>
      )}

      <Panel
        title="Traffic over time"
        action={<Segmented value={metric} onChange={setMetric} options={METRICS} />}
        bodyClass="px-3 pb-3 pt-4"
      >
        {a ? <AreaChart data={a.timeseries.map((p) => ({ x: p.t, y: p[metric] }))} formatX={fmt} height={240} /> : <Skeleton className="m-2 h-[220px] rounded-md" />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top pages" bodyClass="p-0">
          {!a ? <Skeleton className="m-4 h-48" /> : a.top_pages.length === 0 ? <Empty /> : (
            <table className="w-full border-separate border-spacing-0">
              <thead><tr><th className={th}>Page</th><th className={cn(th, 'text-right')}>Views</th><th className={cn(th, 'text-right')}>Visitors</th></tr></thead>
              <tbody>
                {a.top_pages.map((p) => (
                  <tr key={p.path} className="transition-colors hover:bg-subtle/40">
                    <td className={cn(td, 'max-w-[260px] truncate font-mono text-[13px]')}>{p.path}</td>
                    <td className={cn(td, 'text-right font-mono num')}>{p.views}</td>
                    <td className={cn(td, 'text-right font-mono text-ink-2 num')}>{p.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Most clicked" bodyClass="p-0">
          {!a ? <Skeleton className="m-4 h-48" /> : a.top_clicks.length === 0 ? <Empty /> : (
            <table className="w-full border-separate border-spacing-0">
              <thead><tr><th className={th}>Button / link</th><th className={th}>On page</th><th className={cn(th, 'text-right')}>Clicks</th></tr></thead>
              <tbody>
                {a.top_clicks.map((c, i) => (
                  <tr key={i} className="transition-colors hover:bg-subtle/40">
                    <td className={cn(td, 'max-w-[220px] truncate font-medium')}>{c.element}</td>
                    <td className={cn(td, 'max-w-[160px] truncate font-mono text-xs text-ink-3')}>{c.path}</td>
                    <td className={cn(td, 'text-right font-mono num')}>{c.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Where visitors come from" bodyClass="p-5">
          {!a ? <Skeleton className="h-40" /> : a.referrers.length === 0 ? <Empty /> : <BarList items={a.referrers} />}
          {a && a.utm_sources.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">Campaigns (utm_source)</div>
              <BarList items={a.utm_sources} />
            </div>
          )}
        </Panel>
        <Panel title="Devices" bodyClass="p-5">
          {!a ? <Skeleton className="h-40" /> : a.devices.length === 0 ? <Empty /> : (
            <>
              <div className="mb-5 grid grid-cols-3 gap-2">
                {['desktop', 'mobile', 'tablet'].map((d) => {
                  const Icon = DEVICE_ICON[d];
                  const v = a.devices.find((x) => x.label === d)?.value || 0;
                  const total = a.devices.reduce((s, x) => s + x.value, 0) || 1;
                  return (
                    <div key={d} className="rounded-md border border-line bg-bg p-3 text-center">
                      <Icon className="mx-auto h-5 w-5 text-ink-3" />
                      <div className="mt-2 font-mono text-lg font-medium num">{Math.round((v / total) * 100)}%</div>
                      <div className="text-xs capitalize text-ink-3">{d}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">Browsers</div>
              <BarList items={a.browsers} />
              <div className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-ink-3">Operating systems</div>
              <BarList items={a.os} />
            </>
          )}
        </Panel>
        <Panel title="Conversion funnel" bodyClass="p-5">
          {!a ? <Skeleton className="h-40" /> : (
            <BarList items={a.funnel.map((f, i) => ({
              ...f,
              hint: i > 0 && a.funnel[0].value ? `${Math.round((f.value / a.funnel[0].value) * 100)}%` : undefined,
            }))} />
          )}
          {a && (
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">What people search for</div>
              {a.top_searches.length === 0 ? <p className="text-[13px] text-ink-3">No searches yet.</p> : <BarList items={a.top_searches} />}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title={<span className="flex items-center gap-2">Live activity <span className="h-1.5 w-1.5 animate-blink rounded-full bg-good" /></span>}
          action={<span className="text-xs text-ink-3">refreshes every 10s</span>}
          bodyClass="max-h-[420px] overflow-y-auto"
        >
          {!live.data ? <Skeleton className="m-4 h-40" /> : live.data.events.length === 0 ? <Empty /> : (
            <ul className="divide-y divide-line">
              {live.data.events.map((e) => {
                const st = EVENT_STYLE[e.type] || { label: e.type, dot: 'bg-ink-3', icon: Eye };
                const Icon = st.icon;
                return (
                  <li key={e.id} className="flex animate-row-in items-center gap-3 px-5 py-2.5 text-[13px]">
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-bg', e.source === 'server' ? 'text-accent' : 'text-ink-3')}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{st.label}</span>{' '}
                      <span className="text-ink-2">
                        {e.type === 'click' && e.element ? `“${e.element}”` : e.type === 'search' && e.element ? `“${e.element}”` : ''}
                        {e.path ? <span className="font-mono text-xs text-ink-3"> {e.path}</span> : null}
                      </span>
                    </div>
                    <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">{[e.device, e.browser].filter(Boolean).join(' · ') || (e.source === 'server' ? 'server' : '')}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-ink-3">{relativeTime(parseUtc(e.at))}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="On the site right now" bodyClass="p-5">
          {!live.data ? <Skeleton className="h-24" /> : live.data.active_pages.length === 0 ? (
            <p className="text-[13px] text-ink-3">Nobody in the last 5 minutes.</p>
          ) : <BarList items={live.data.active_pages.map((p) => ({ label: p.path, value: p.visitors }))} />}
          <p className="mt-5 text-xs leading-relaxed text-ink-3">
            Visitors are anonymous: a random id per browser, IP addresses are hashed, and nothing typed into forms is recorded. Admin pages are not tracked.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="px-5 py-8 text-center text-[13px] text-ink-3">No data for this period yet.</p>;
}
