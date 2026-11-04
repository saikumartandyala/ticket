'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, Ban, ExternalLink, Power, PowerOff, Shield, ShieldOff, Star, UserCheck } from 'lucide-react';
import {
  AdminHeader, ConfirmButton, Drawer, EmptyRow, ErrorRow, Pagination, Panel, Paged, SearchBox, Segmented, StatusBadge, Table, TableSkeleton, td, th, useAdmin, useAdminAction,
} from '../../../components/admin/ui';
import { Avatar, Badge, Skeleton } from '../../../components/ui/misc';
import { money, parseUtc, relativeTime } from '../../../lib/format';
import { useAuthStore } from '../../../store/authStore';
import { cn } from '../../../lib/cn';

type Filter = 'all' | 'admins' | 'banned' | 'inactive';
export interface AdminUser {
  id: string; name: string | null; email: string | null; phone: string | null;
  email_verified: boolean; phone_verified: boolean; is_admin: boolean; is_banned: boolean; is_active: boolean;
  avg_rating: number; rating_count: number; total_listings: number; total_matches: number;
  last_active_at: string | null; created_at: string | null;
}
interface Detail {
  user: AdminUser;
  listings: { id: string; title: string; status: string; asking_price: number; created_at: string }[];
  matches: { id: string; status: string; listing: { title: string } | null; seeker: AdminUser | null; transferor: AdminUser | null; updated_at: string }[];
  reviews: { id: string; rating: number; comment: string | null; created_at: string }[];
}

function UserBadges({ u }: { u: AdminUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.is_admin && <Badge tone="accent"><Shield className="h-3 w-3" />Admin</Badge>}
      {u.is_banned && <Badge tone="danger"><Ban className="h-3 w-3" />Banned</Badge>}
      {!u.is_active && <Badge><PowerOff className="h-3 w-3" />Inactive</Badge>}
      {!u.is_admin && !u.is_banned && u.is_active && <Badge tone="good">Active</Badge>}
    </span>
  );
}

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (u: AdminUser) => void }) {
  const me = useAuthStore((s) => s.user);
  const { data, loading, reload, setData } = useAdmin<Detail>(`/users/${id}`);
  const { run, busy } = useAdminAction();
  const isSelf = me?.id === id;

  const patch = async (key: string, body: Partial<AdminUser>, msg: string) => {
    const u = await run<AdminUser>(key, `/users/${id}`, 'PATCH', body, msg);
    if (u && data) { setData({ ...data, user: u }); onChanged(u); if (body.is_banned) reload(); }
  };

  const u = data?.user;
  return (
    <Drawer open onClose={onClose} title={u ? (u.name || u.email || 'User') : 'User'}>
      {loading || !u ? (
        <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={u.name || u.email} size={56} />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{u.name || 'No name'}</div>
              <div className="truncate text-sm text-ink-2">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
              <div className="mt-1.5"><UserBadges u={u} /></div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm sm:grid-cols-4">
            {[
              ['Listings', u.total_listings],
              ['Transfers', u.total_matches],
              ['Rating', u.rating_count ? `${u.avg_rating.toFixed(1)}★` : '—'],
              ['Reviews', u.rating_count],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-surface p-3">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="mt-1 font-mono text-base font-medium num">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-1.5 text-[13px] text-ink-2">
            <div>Joined {u.created_at ? parseUtc(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
            <div>Last active {u.last_active_at ? relativeTime(parseUtc(u.last_active_at)) : 'never'}</div>
            <div className="flex items-center gap-1.5">{u.email_verified ? <><BadgeCheck className="h-3.5 w-3.5 text-good" />Email verified</> : 'Email not verified'}</div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 text-sm font-semibold">Actions</div>
            {isSelf && <p className="mb-3 text-[13px] text-ink-3">This is your account — you can&apos;t ban or demote yourself.</p>}
            <div className="flex flex-wrap gap-2">
              {u.is_banned ? (
                <ConfirmButton confirmLabel="Confirm unban" loading={busy === 'ban'} onConfirm={() => patch('ban', { is_banned: false }, 'User unbanned')}>
                  <UserCheck className="h-4 w-4" />Unban
                </ConfirmButton>
              ) : (
                !isSelf && (
                  <ConfirmButton danger confirmLabel="Ban & flag listings" loading={busy === 'ban'} onConfirm={() => patch('ban', { is_banned: true }, 'User banned')}>
                    <Ban className="h-4 w-4" />Ban user
                  </ConfirmButton>
                )
              )}
              {!isSelf && (u.is_active ? (
                <ConfirmButton confirmLabel="Confirm deactivate" loading={busy === 'active'} onConfirm={() => patch('active', { is_active: false }, 'Account deactivated')}>
                  <PowerOff className="h-4 w-4" />Deactivate
                </ConfirmButton>
              ) : (
                <ConfirmButton confirmLabel="Confirm reactivate" loading={busy === 'active'} onConfirm={() => patch('active', { is_active: true }, 'Account reactivated')}>
                  <Power className="h-4 w-4" />Reactivate
                </ConfirmButton>
              ))}
              {!isSelf && (u.is_admin ? (
                <ConfirmButton danger confirmLabel="Remove admin" loading={busy === 'admin'} onConfirm={() => patch('admin', { is_admin: false }, 'Admin rights removed')}>
                  <ShieldOff className="h-4 w-4" />Remove admin
                </ConfirmButton>
              ) : (
                <ConfirmButton confirmLabel="Grant admin" loading={busy === 'admin'} onConfirm={() => patch('admin', { is_admin: true }, 'Admin rights granted')}>
                  <Shield className="h-4 w-4" />Make admin
                </ConfirmButton>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-3">Banning blocks sign-in immediately and flags the user&apos;s live listings. Every action is recorded in the audit log.</p>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Listings <span className="font-mono text-xs font-normal text-ink-3">{data.listings.length}</span></h3>
            {data.listings.length === 0 ? <p className="text-[13px] text-ink-3">No listings.</p> : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {data.listings.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    <span className="font-mono text-xs num">{money(l.asking_price)}</span>
                    <StatusBadge status={l.status} />
                    <Link href={`/tickets/${l.id}`} target="_blank" className="text-ink-3 hover:text-ink" aria-label="Open listing"><ExternalLink className="h-3.5 w-3.5" /></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Transfers <span className="font-mono text-xs font-normal text-ink-3">{data.matches.length}</span></h3>
            {data.matches.length === 0 ? <p className="text-[13px] text-ink-3">No transfers.</p> : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {data.matches.map((m) => {
                  const selling = m.transferor?.id === id;
                  const other = selling ? m.seeker : m.transferor;
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className={cn('w-12 shrink-0 font-mono text-[11px] uppercase', selling ? 'text-accent' : 'text-ink-3')}>{selling ? 'Sell' : 'Buy'}</span>
                      <span className="min-w-0 flex-1 truncate">{m.listing?.title || 'Ticket'} <span className="text-ink-3">· {other?.name || other?.email}</span></span>
                      <StatusBadge status={m.status} kind="match" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.reviews.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Reviews received</h3>
              <ul className="space-y-2">
                {data.reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
                    <div className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-3.5 w-3.5', i < r.rating ? 'fill-ink text-ink' : 'text-line-strong')} />)}</div>
                    {r.comment && <p className="mt-1.5 text-ink-2">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function UsersInner() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>((params.get('filter') as Filter) || 'all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ q, filter, page: String(page), size: '20' }).toString();
  const { data, error, loading, reload, setData } = useAdmin<Paged<AdminUser>>(`/users?${qs}`);

  const onSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  return (
    <div className="space-y-5">
      <AdminHeader title="Users" description="Everyone with an account. Open a user to see their activity and manage access." />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            value={filter}
            onChange={(v) => { setFilter(v); setPage(1); }}
            options={[{ value: 'all', label: 'All' }, { value: 'admins', label: 'Admins' }, { value: 'banned', label: 'Banned' }, { value: 'inactive', label: 'Inactive' }]}
          />
          <SearchBox value={q} onChange={onSearch} placeholder="Search name, email or phone" />
        </div>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && data.items.length === 0 ? <EmptyRow text="No users match." /> : data && (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, 'text-right')}>Listings</th>
                  <th className={cn(th, 'text-right')}>Transfers</th>
                  <th className={cn(th, 'text-right')}>Rating</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Last active</th>
                </tr>
              </thead>
              <tbody className={cn('transition-opacity', loading && 'opacity-50')}>
                {data.items.map((u, i) => (
                  <tr key={u.id} onClick={() => setOpen(u.id)} style={{ animationDelay: `${i * 25}ms` }} className="group animate-row-in cursor-pointer transition-colors hover:bg-subtle/50">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name || u.email} size={32} />
                        <div className="min-w-0">
                          <div className="truncate font-medium group-hover:text-accent">{u.name || '—'}</div>
                          <div className="truncate text-xs text-ink-3">{u.email || u.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}><UserBadges u={u} /></td>
                    <td className={cn(td, 'text-right font-mono num')}>{u.total_listings}</td>
                    <td className={cn(td, 'text-right font-mono num')}>{u.total_matches}</td>
                    <td className={cn(td, 'text-right font-mono num')}>{u.rating_count ? `${u.avg_rating.toFixed(1)}★` : '—'}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-2')}>{u.created_at ? parseUtc(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-2')}>{u.last_active_at ? relativeTime(parseUtc(u.last_active_at)) : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      {open && (
        <UserDrawer
          id={open}
          onClose={() => setOpen(null)}
          onChanged={(u) => data && setData({ ...data, items: data.items.map((x) => (x.id === u.id ? u : x)) })}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return <Suspense fallback={null}><UsersInner /></Suspense>;
}
