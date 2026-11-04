'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Flag, RotateCcw, Sparkles, Star, XCircle } from 'lucide-react';
import {
  AdminHeader, ConfirmButton, EmptyRow, ErrorRow, Pagination, Panel, Paged, SearchBox, Segmented, StatusBadge, Table, TableSkeleton, td, th, useAdmin, useAdminAction,
} from '../../../components/admin/ui';
import { Select } from '../../../components/ui/Field';
import { Avatar } from '../../../components/ui/misc';
import { CATEGORIES, categoryById } from '../../../lib/categories';
import { dayLabel, hhmm, money, parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

type Status = '' | 'active' | 'flagged' | 'transferred' | 'cancelled' | 'expired';
interface AdminListing {
  id: string; title: string; status: string; is_featured: boolean;
  category: { id: number; slug: string; name: string } | null;
  origin_city: string | null; destination_city: string | null; venue_name: string | null; venue_city: string | null;
  event_date: string | null; departure_time: string | null;
  asking_price: number; original_price: number; seat_count: number; view_count: number; interest_count: number;
  expires_at: string | null; created_at: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
}

function ListingsInner() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>((params.get('status') as Status) || '');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ q, status, page: String(page), size: '20', ...(cat ? { category_id: cat } : {}) }).toString();
  const { data, error, loading, reload, setData } = useAdmin<Paged<AdminListing>>(`/listings?${qs}`);
  const { run, busy } = useAdminAction();

  const onSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const patch = async (l: AdminListing, body: Partial<AdminListing>, msg: string) => {
    const updated = await run<AdminListing>(l.id + JSON.stringify(body), `/listings/${l.id}`, 'PATCH', body, msg);
    if (updated && data) setData({ ...data, items: data.items.map((x) => (x.id === l.id ? { ...x, ...updated } : x)) });
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Listings" description="Moderate tickets on the board: feature good ones, flag suspicious ones, take down rule-breakers." />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'flagged', label: 'Flagged' },
              { value: 'transferred', label: 'Transferred' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'expired', label: 'Expired' },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-44">
              <Select aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }} className="h-9 text-sm">
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <SearchBox value={q} onChange={onSearch} placeholder="Search title, city or venue" />
          </div>
        </div>

        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={7} /> : data && data.items.length === 0 ? <EmptyRow text="No listings match these filters." /> : data && (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Ticket</th>
                  <th className={th}>Seller</th>
                  <th className={cn(th, 'text-right')}>Price</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, 'text-right')}>Views · Req.</th>
                  <th className={th}>Departs</th>
                  <th className={cn(th, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody className={cn('transition-opacity', loading && 'opacity-50')}>
                {data.items.map((l, i) => {
                  const Icon = categoryById(l.category?.id)?.icon;
                  const place = l.origin_city && l.destination_city ? `${l.origin_city} → ${l.destination_city}` : [l.venue_name, l.venue_city].filter(Boolean).join(', ');
                  const off = l.original_price > 0 ? Math.round((1 - l.asking_price / l.original_price) * 100) : 0;
                  return (
                    <tr key={l.id} style={{ animationDelay: `${i * 25}ms` }} className="animate-row-in transition-colors hover:bg-subtle/40">
                      <td className={td}>
                        <div className="flex items-start gap-2.5">
                          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />}
                          <div className="min-w-0 max-w-[280px]">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{l.title}</span>
                              {l.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" aria-label="Featured" />}
                            </div>
                            <div className="truncate text-xs text-ink-3">{[l.category?.name, place].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <Avatar name={l.owner?.name || l.owner?.email} size={24} />
                          <span className="max-w-[140px] truncate text-ink-2">{l.owner?.name || l.owner?.email || '—'}</span>
                        </div>
                      </td>
                      <td className={cn(td, 'text-right')}>
                        <div className="font-mono num">{money(l.asking_price)}</div>
                        {off > 0 && <div className="text-xs text-good">−{off}%</div>}
                      </td>
                      <td className={td}><StatusBadge status={l.status} /></td>
                      <td className={cn(td, 'text-right font-mono text-ink-2 num')}>{l.view_count} · {l.interest_count}</td>
                      <td className={cn(td, 'whitespace-nowrap text-ink-2')}>
                        {l.event_date ? dayLabel(l.event_date) : '—'}{l.departure_time ? ` ${hhmm(l.departure_time)}` : ''}
                        <div className="text-xs text-ink-3">listed {l.created_at ? relativeTime(parseUtc(l.created_at)) : ''}</div>
                      </td>
                      <td className={cn(td, 'text-right')}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/tickets/${l.id}`} target="_blank" title="Open on site" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          {l.status === 'active' && (
                            <button
                              title={l.is_featured ? 'Unfeature' : 'Feature'}
                              onClick={() => patch(l, { is_featured: !l.is_featured }, l.is_featured ? 'Unfeatured' : 'Featured')}
                              className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md transition-all hover:bg-subtle active:scale-90', l.is_featured ? 'text-accent' : 'text-ink-3 hover:text-ink')}
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                          )}
                          {l.status === 'active' && (
                            <ConfirmButton variant="ghost" danger confirmLabel="Flag it" onConfirm={() => patch(l, { status: 'flagged' }, 'Listing flagged and hidden')}>
                              <Flag className="h-4 w-4" />Flag
                            </ConfirmButton>
                          )}
                          {(l.status === 'flagged' || l.status === 'cancelled') && (
                            <ConfirmButton variant="ghost" confirmLabel="Restore" onConfirm={() => patch(l, { status: 'active' }, 'Listing restored')}>
                              <RotateCcw className="h-4 w-4" />Restore
                            </ConfirmButton>
                          )}
                          {(l.status === 'active' || l.status === 'flagged') && (
                            <ConfirmButton variant="ghost" danger confirmLabel="Take down" loading={busy?.startsWith(l.id) || false} onConfirm={() => patch(l, { status: 'cancelled' }, 'Listing taken down')}>
                              <XCircle className="h-4 w-4" />
                            </ConfirmButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}

export default function AdminListingsPage() {
  return <Suspense fallback={null}><ListingsInner /></Suspense>;
}
