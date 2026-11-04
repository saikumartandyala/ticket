'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight, ArrowUpRight, Ban, Flag, IndianRupee, OctagonAlert, RefreshCw, Star, Ticket, TrendingUp, Users,
} from 'lucide-react';
import { AreaChart, BarList } from '../../components/admin/charts';
import { AdminHeader, Panel, Segmented, useAdmin } from '../../components/admin/ui';
import { CountUp } from '../../components/motion';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/misc';
import { parseUtc, relativeTime } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Stats {
  users: { total: number; new_7d: number; banned: number; admins: number };
  listings: { total: number; live: number; new_7d: number; featured: number; by_status: Record<string, number> };
  matches: { total: number; by_status: Record<string, number>; transferred: number; conversion: number; value_transferred: number; buyer_savings: number };
  messages: number;
  alerts_active: number;
  reviews: { total: number; avg: number | null };
  by_category: { id: number; name: string; slug: string; listings: number }[];
  attention: { flagged_listings: number; disputed_transfers: number; pending_requests: number; open_errors: number };
  traffic: { visitors_today: number; page_views_7d: number };
}
type Day = { date: string; signups: number; listings: number; requests: number; transfers: number };
type Metric = 'signups' | 'listings' | 'requests' | 'transfers';
type FeedItem = { type: string; at: string; text: string; ref: string };

const METRICS: { value: Metric; label: string }[] = [
  { value: 'signups', label: 'Sign-ups' },
  { value: 'listings', label: 'Listings' },
  { value: 'requests', label: 'Requests' },
  { value: 'transfers', label: 'Transfers' },
];

function Kpi({ icon: Icon, label, value, prefix, decimals, sub, href, i }: {
  icon: typeof Users; label: string; value: number; prefix?: string; decimals?: number; sub?: React.ReactNode; href?: string; i: number;
}) {
  const body = (
    <div
      style={{ animationDelay: `${i * 60}ms` }}
      className="spotlight group h-full animate-row-in rounded-lg border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg text-ink-3 transition-colors group-hover:border-accent/40 group-hover:text-accent">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 font-mono text-[28px] font-medium leading-none tracking-[-0.02em] num">
        <CountUp value={value} prefix={prefix} decimals={decimals} />
      </div>
      {sub && <div className="mt-2 text-xs text-ink-3">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

const FEED_DOT: Record<string, string> = {
  signup: 'bg-good',
  listing: 'bg-accent',
  'match.transferred': 'bg-ink',
  'match.disputed': 'bg-danger',
};

export default function AdminOverview() {
  const [days, setDays] = useState<'14' | '30'>('14');
  const [metric, setMetric] = useState<Metric>('listings');
  const stats = useAdmin<Stats>('/stats');
  const activity = useAdmin<Day[]>(`/activity?days=${days}`);
  const feed = useAdmin<FeedItem[]>('/recent');

  const s = stats.data;
  const refresh = () => { stats.reload(); activity.reload(); feed.reload(); };

  const series = (activity.data || []).map((d) => ({ x: d.date, y: d[metric] }));
  const periodTotal = series.reduce((a, b) => a + b.y, 0);
  const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const funnel = s
    ? [
        { label: 'Requests sent', value: s.matches.total },
        { label: 'Accepted', value: (s.matches.by_status.accepted || 0) + (s.matches.by_status.contact_revealed || 0) + (s.matches.by_status.transferred || 0) },
        { label: 'In contact', value: (s.matches.by_status.contact_revealed || 0) + (s.matches.by_status.transferred || 0) },
        { label: 'Transferred', value: s.matches.transferred },
      ]
    : [];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Overview"
        description={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<Button variant="secondary" size="sm" onClick={refresh}><RefreshCw className={cn('h-4 w-4', (stats.loading || activity.loading) && 'animate-spin')} />Refresh</Button>}
      />

      {stats.error && <Panel><div className="px-5 py-4 text-sm text-danger">{stats.error}</div></Panel>}

      {/* KPIs */}
      {!s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-lg" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi i={0} icon={Users} label="Users" value={s.users.total} sub={<><span className="text-good">+{s.users.new_7d}</span> this week · {s.users.admins} admin{s.users.admins === 1 ? '' : 's'}</>} href="/admin/users" />
          <Kpi i={1} icon={Ticket} label="Live listings" value={s.listings.live} sub={<><span className="text-good">+{s.listings.new_7d}</span> this week · {s.listings.total} all-time</>} href="/admin/listings?status=active" />
          <Kpi i={2} icon={ArrowLeftRight} label="Transfers completed" value={s.matches.transferred} sub={`${Math.round(s.matches.conversion * 100)}% of ${s.matches.total} requests`} href="/admin/transfers?status=transferred" />
          <Kpi i={3} icon={IndianRupee} label="Value transferred" value={s.matches.value_transferred} prefix="₹" sub={<>Buyers saved <span className="text-good">₹{Math.round(s.matches.buyer_savings).toLocaleString('en-IN')}</span></>} />
          <Kpi i={4} icon={TrendingUp} label="Pending requests" value={s.attention.pending_requests} sub="Waiting on sellers" href="/admin/transfers?status=pending" />
          <Kpi i={5} icon={Users} label="Visitors today" value={s.traffic.visitors_today} sub={`${s.traffic.page_views_7d} page views this week`} href="/admin/analytics" />
          <Kpi i={6} icon={Star} label="Average rating" value={s.reviews.avg || 0} decimals={1} sub={`${s.reviews.total} review${s.reviews.total === 1 ? '' : 's'}`} href="/admin/reviews" />
          <Kpi i={7} icon={Ban} label="Banned users" value={s.users.banned} sub="Blocked from signing in" href="/admin/users?filter=banned" />
        </div>
      )}

      {/* Attention */}
      {s && (s.attention.flagged_listings > 0 || s.attention.disputed_transfers > 0 || s.attention.open_errors > 0) && (
        <div className="flex animate-row-in flex-col gap-3 rounded-lg border border-danger/30 bg-danger/[0.05] p-4 sm:flex-row sm:items-center">
          <OctagonAlert className="h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-ink">Needs attention: </span>
            <span className="text-ink-2">
              {[
                s.attention.flagged_listings > 0 && `${s.attention.flagged_listings} flagged listing${s.attention.flagged_listings === 1 ? '' : 's'}`,
                s.attention.disputed_transfers > 0 && `${s.attention.disputed_transfers} disputed transfer${s.attention.disputed_transfers === 1 ? '' : 's'}`,
                s.attention.open_errors > 0 && `${s.attention.open_errors} open error${s.attention.open_errors === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className="flex gap-2">
            {s.attention.flagged_listings > 0 && <Link href="/admin/listings?status=flagged" className="flex items-center gap-1 text-[13px] font-medium text-danger hover:underline"><Flag className="h-3.5 w-3.5" />Review listings</Link>}
            {s.attention.open_errors > 0 && <Link href="/admin/errors" className="flex items-center gap-1 text-[13px] font-medium text-danger hover:underline"><OctagonAlert className="h-3.5 w-3.5" />View errors</Link>}
            {s.attention.disputed_transfers > 0 && <Link href="/admin/transfers?status=disputed" className="flex items-center gap-1 text-[13px] font-medium text-danger hover:underline"><ArrowLeftRight className="h-3.5 w-3.5" />Review disputes</Link>}
          </div>
        </div>
      )}

      {/* Activity + categories */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title={
            <span className="flex items-baseline gap-2">
              Activity
              <span className="font-mono text-xs font-normal text-ink-3 num">{periodTotal} {METRICS.find((m) => m.value === metric)?.label.toLowerCase()} · last {days} days</span>
            </span>
          }
          action={<Segmented value={days} onChange={setDays} options={[{ value: '14', label: '14d' }, { value: '30', label: '30d' }]} />}
        >
          <div className="px-5 pt-4">
            <Segmented value={metric} onChange={setMetric} options={METRICS} />
          </div>
          <div className="px-3 pb-3 pt-2">
            {activity.data ? <AreaChart data={series} formatX={fmtDay} /> : <Skeleton className="m-2 h-[200px] rounded-md" />}
          </div>
        </Panel>

        <Panel title="Listings by category" action={<Link href="/admin/categories" className="text-xs text-ink-3 hover:text-ink">Manage</Link>} bodyClass="p-5">
          {s ? (
            <BarList items={s.by_category.map((c) => ({ label: c.name, value: c.listings }))} />
          ) : (
            <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
          )}
        </Panel>
      </div>

      {/* Funnel + statuses + feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Transfer funnel" bodyClass="p-5">
          {s ? <BarList items={funnel.map((f, i) => ({ ...f, hint: i > 0 && funnel[0].value ? `${Math.round((f.value / funnel[0].value) * 100)}%` : undefined }))} /> : <Skeleton className="h-40" />}
        </Panel>

        <Panel title="Listing status" bodyClass="p-2">
          {s ? (
            <ul>
              {['active', 'transferred', 'flagged', 'cancelled', 'expired'].map((k) => (
                <li key={k}>
                  <Link href={`/admin/listings?status=${k}`} className="group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-subtle/60">
                    <span className="flex items-center gap-2.5 capitalize text-ink-2 group-hover:text-ink">
                      <span className={cn('h-2 w-2 rounded-full', { active: 'bg-good', transferred: 'bg-ink', flagged: 'bg-danger', cancelled: 'bg-line-strong', expired: 'bg-ink-3' }[k])} />
                      {k}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-ink num">
                      {s.listings.by_status[k] || 0}
                      <ArrowUpRight className="h-3.5 w-3.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Skeleton className="m-3 h-40" />}
        </Panel>

        <Panel title="Latest activity" bodyClass="max-h-[300px] overflow-y-auto">
          {!feed.data ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : feed.data.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-3">Nothing yet.</div>
          ) : (
            <ol className="relative px-5 py-4">
              <span aria-hidden className="absolute bottom-4 left-[23px] top-4 w-px bg-line" />
              {feed.data.map((f, i) => (
                <li key={i} style={{ animationDelay: `${i * 40}ms` }} className="relative flex animate-row-in gap-3 pb-3.5 last:pb-0">
                  <span className={cn('relative z-[1] mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-surface', FEED_DOT[f.type] || 'bg-ink-3')} />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-ink-2">{f.text}</p>
                    <p className="mt-0.5 text-[11px] text-ink-3">{relativeTime(parseUtc(f.at))}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
