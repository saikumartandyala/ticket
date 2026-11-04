'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BellRing, Inbox, MessageSquare, Plus, Star, Ticket, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Alert, Listing, Match, User } from '../../lib/types';
import { categoryById, categoryFor } from '../../lib/categories';
import { useCategories } from '../../lib/useCategories';
import { dayLabel, firstName, hhmm, money, parseUtc, relativeTime, toNumber } from '../../lib/format';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import Autocomplete from '../../components/Autocomplete';
import { TimeLeft } from '../../components/tickets/ListingRow';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Avatar, Badge, EmptyState, Notice, Skeleton } from '../../components/ui/misc';
import { cn } from '../../lib/cn';
import { CountUp } from '../../components/motion';

type Tab = 'listings' | 'requests' | 'alerts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'listings', label: 'My listings' },
  { key: 'requests', label: 'Requests' },
  { key: 'alerts', label: 'Alerts' },
];

function statusBadge(m: Match, isSeller: boolean) {
  switch (m.status) {
    case 'pending': return isSeller ? <Badge tone="accent">Needs your reply</Badge> : <Badge tone="warn">Awaiting seller</Badge>;
    case 'accepted': return <Badge tone="good">Accepted</Badge>;
    case 'contact_revealed': return <Badge tone="good">In contact</Badge>;
    case 'transferred': return <Badge tone="solid">Completed</Badge>;
    case 'declined': return <Badge>Declined</Badge>;
    default: return <Badge>{m.status.charAt(0).toUpperCase() + m.status.slice(1)}</Badge>;
  }
}

function alertTitle(a: Alert): string {
  const cat = categoryById(a.category_id)?.name;
  if (a.origin_city || a.destination_city) return `${a.origin_city || 'Anywhere'} → ${a.destination_city || 'Anywhere'}`;
  if (a.event_name) return a.event_name;
  if (a.venue_city) return `${cat || 'Tickets'} in ${a.venue_city}`;
  return cat ? `Any ${cat.toLowerCase()} ticket` : 'Any ticket';
}

function DashboardInner() {
  const { ready, user } = useRequireAuth();
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const explicitTab = (['listings', 'requests', 'alerts'] as Tab[]).includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : null;

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoadError('');
    try {
      const [me, all, ms, al] = await Promise.all([
        api<User>('/auth/me'),
        api<Listing[]>('/listings'),
        api<Match[]>('/matches'),
        api<Alert[]>('/alerts'),
      ]);
      updateUser(me);
      setListings(all.filter((l) => l.user_id === me.id));
      setMatches(ms);
      setAlerts(al.filter((a) => a.is_active));
    } catch (e: any) {
      if (e?.status === 401) { logout(); router.replace('/auth?next=/dashboard'); return; }
      setLoadError(errorMessage(e));
      setListings((x) => x || []); setMatches((x) => x || []); setAlerts((x) => x || []);
    }
  }, [ready, updateUser, logout, router]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabBar, setTabBar] = useState({ left: 0, width: 0 });
  const tabKey: Tab = explicitTab || (listings && listings.length === 0 && matches && matches.length > 0 ? 'requests' : 'listings');
  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tabKey}"]`);
    if (el) setTabBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tabKey, listings, matches]);

  const act = async (id: string, fn: () => Promise<unknown>, success: string, body?: string) => {
    setBusy(id);
    try {
      await fn();
      toast(success, body, 'success');
      await load();
    } catch (e) {
      toast('That didn’t work', errorMessage(e), 'error');
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  };

  if (!ready || listings === null || matches === null || alerts === null) {
    return (
      <div className="container-page pt-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-48" />
        <Skeleton className="mt-8 h-24 rounded-lg" />
        <Skeleton className="mt-8 h-64 rounded-lg" />
      </div>
    );
  }

  // Without an explicit tab, open wherever there's something to look at.
  const tab: Tab = explicitTab || (listings.length === 0 && matches.length > 0 ? 'requests' : 'listings');
  const selling = matches.filter((m) => m.transferor_id === user?.id);
  const buying = matches.filter((m) => m.seeker_id === user?.id);
  const needsReply = selling.filter((m) => m.status === 'pending').length;

  const stats: { label: string; value: string; num?: number; dec?: number; hot?: boolean; sub?: string }[] = [
    { label: 'Active listings', value: String(listings.length), num: listings.length },
    { label: 'Waiting on you', value: String(needsReply), num: needsReply, hot: needsReply > 0 },
    { label: 'Completed transfers', value: String(user?.total_matches ?? 0), num: user?.total_matches ?? 0 },
    {
      label: 'Your rating',
      value: user && user.rating_count > 0 ? user.avg_rating.toFixed(1) : '—',
      num: user && user.rating_count > 0 ? Number(user.avg_rating) : undefined,
      dec: 1,
      sub: user && user.rating_count > 0 ? `${user.rating_count} ${user.rating_count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet',
    },
  ];
  const counts: Record<Tab, number> = { listings: listings.length, requests: matches.length, alerts: alerts.length };

  return (
    <div className="container-page pt-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name || user?.email} size={52} />
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">
              {user?.name ? `Hi, ${firstName(user.name)}` : 'Your dashboard'}
            </h1>
            <p className="mt-0.5 truncate text-sm text-ink-3">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 70}ms` }}
            className="spotlight animate-row-in rounded-lg border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="text-[13px] text-ink-3">{s.label}</div>
            <div className={cn('mt-3 flex items-baseline gap-2 font-mono text-[30px] font-medium leading-none tracking-[-0.02em] num', s.hot && 'text-accent')}>
              {s.num !== undefined ? <CountUp value={s.num} decimals={s.dec || 0} /> : s.value}
              {s.label === 'Your rating' && s.value !== '—' && <Star className="h-4 w-4 fill-current" />}
            </div>
            {s.sub && <div className="mt-1.5 text-xs text-ink-3">{s.sub}</div>}
          </div>
        ))}
      </div>

      {loadError && <Notice tone="error" className="mt-6">{loadError}</Notice>}

      {/* Tabs */}
      <div ref={tabsRef} className="relative mt-10 flex gap-6 border-b border-line" role="tablist">
        <span
          aria-hidden
          className="absolute -bottom-px h-[2px] rounded-full bg-accent transition-[left,width] duration-500 ease-out-expo"
          style={{ left: tabBar.left, width: tabBar.width }}
        />
        {TABS.map((t) => (
          <button
            key={t.key}
            data-tab={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative flex items-center gap-2 pb-3 text-sm transition-colors duration-200',
              tab === t.key ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            <span className="font-mono text-xs text-ink-3 num">{counts[t.key]}</span>
            {t.key === 'requests' && needsReply > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div key={tab} className="mt-6 animate-page-in">
        {tab === 'listings' && (
          listings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong">
              <EmptyState
                icon={Ticket}
                title="No active listings"
                body="Tickets you list appear here while they’re open. They close automatically at departure time."
                action={<ButtonLink href="/post" size="sm"><Plus className="h-4 w-4" />List a ticket</ButtonLink>}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              {listings.map((l, idx) => {
                const cat = categoryFor(l);
                const Icon = cat.icon;
                const pending = selling.filter((m) => m.listing_id === l.id && m.status === 'pending').length;
                return (
                  <div key={l.id} style={{ animationDelay: `${idx * 50}ms` }} className="flex animate-row-in flex-col gap-3 border-b border-line px-5 py-4 transition-colors duration-300 last:border-b-0 hover:bg-subtle/50 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                      <div className="min-w-0">
                        <Link href={`/tickets/${l.id}`} className="block truncate text-[15px] font-medium hover:underline">{l.title}</Link>
                        <div className="mt-0.5 text-[13px] text-ink-2">
                          {dayLabel(l.event_date)}{l.departure_time ? ` · ${hhmm(l.departure_time)}` : ''} · <span className="font-mono num">{money(l.asking_price)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-7 sm:pl-0">
                      {pending > 0 ? (
                        <button onClick={() => setTab('requests')} className="text-[13px] font-medium text-accent hover:underline">
                          {pending} new {pending === 1 ? 'request' : 'requests'}
                        </button>
                      ) : (
                        <span className="text-[13px] text-ink-3">{l.interest_count} {l.interest_count === 1 ? 'request' : 'requests'}</span>
                      )}
                      <TimeLeft expiresAt={l.expires_at} />
                      <div className="ml-auto flex gap-1 sm:ml-0">
                        {confirmId === l.id ? (
                          <>
                            <Button size="sm" variant="danger" loading={busy === l.id} onClick={() => act(l.id, () => api(`/listings/${l.id}`, { method: 'DELETE' }), 'Listing cancelled')}>Cancel listing</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Keep</Button>
                          </>
                        ) : (
                          <>
                            <ButtonLink href={`/tickets/${l.id}`} size="sm" variant="secondary">View</ButtonLink>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(l.id)}>Cancel</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'requests' && (
          matches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong">
              <EmptyState
                icon={Inbox}
                title="No requests yet"
                body="Requests people send for your tickets, and requests you send to sellers, show up here."
                action={<ButtonLink href="/tickets" size="sm" variant="secondary">Browse tickets</ButtonLink>}
              />
            </div>
          ) : (
            <div className="space-y-10">
              {[
                { title: 'On your tickets', items: selling, isSeller: true, empty: 'No one has requested your tickets yet.' },
                { title: 'Tickets you’ve requested', items: buying, isSeller: false, empty: 'You haven’t requested any tickets yet.' },
              ].map((g) => (
                <section key={g.title}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    {g.title} <span className="font-mono text-xs font-normal text-ink-3 num">{g.items.length}</span>
                  </h2>
                  {g.items.length === 0 ? (
                    <p className="rounded-lg border border-line px-5 py-6 text-sm text-ink-3">{g.empty}</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                      {g.items.map((m, idx) => {
                        const other = g.isSeller ? m.seeker : m.transferor;
                        const chatOpen = ['accepted', 'contact_revealed', 'transferred'].includes(m.status);
                        return (
                          <div key={m.id} style={{ animationDelay: `${idx * 50}ms` }} className="flex animate-row-in flex-col gap-3 border-b border-line px-5 py-4 transition-colors duration-300 last:border-b-0 hover:bg-subtle/50 sm:flex-row sm:items-center sm:gap-5">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <Avatar name={other?.name} size={36} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-[15px] font-medium">{other?.name || (g.isSeller ? 'A buyer' : 'Seller')}</span>
                                  {statusBadge(m, g.isSeller)}
                                </div>
                                <div className="mt-0.5 truncate text-[13px] text-ink-2">
                                  {m.listing ? (
                                    <Link href={`/tickets/${m.listing_id}`} className="hover:underline">{m.listing.title}</Link>
                                  ) : 'Ticket'}
                                  {m.listing && <> · <span className="font-mono num">{money(toNumber(m.listing.asking_price))}</span></>}
                                  <span className="text-ink-3"> · {relativeTime(parseUtc(m.updated_at || m.created_at))}</span>
                                </div>
                                {m.seeker_note && (
                                  <p className="mt-2 border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-2">{m.seeker_note}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
                              {g.isSeller && m.status === 'pending' ? (
                                <>
                                  <Button size="sm" variant="ghost" disabled={busy === m.id} onClick={() => act(m.id, () => api(`/matches/${m.id}/decline`, { method: 'POST' }), 'Request declined')}>Decline</Button>
                                  <Button size="sm" loading={busy === m.id} onClick={() => act(m.id, () => api(`/matches/${m.id}/accept`, { method: 'POST' }), 'Request accepted', 'A private chat is now open.')}>Accept</Button>
                                </>
                              ) : chatOpen ? (
                                <ButtonLink href={`/chat/${m.id}`} size="sm" variant={m.status === 'transferred' ? 'secondary' : 'primary'}>
                                  <MessageSquare className="h-4 w-4" />{m.status === 'transferred' ? 'View chat' : 'Open chat'}
                                </ButtonLink>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )
        )}

        {tab === 'alerts' && <AlertsTab alerts={alerts} onChange={load} />}
      </div>
    </div>
  );
}

function AlertsTab({ alerts, onChange }: { alerts: Alert[]; onChange: () => Promise<void> }) {
  const categories = useCategories();
  const [catId, setCatId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [eventName, setEventName] = useState('');
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const cat = categoryById(Number(catId));
  const isRoute = !cat || cat.kind === 'route';

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const body = {
      category_id: cat?.id ?? null,
      origin_city: isRoute ? from.trim() || null : null,
      destination_city: isRoute ? to.trim() || null : null,
      event_name: !isRoute ? eventName.trim() || null : null,
      venue_city: !isRoute ? city.trim() || null : null,
      max_price: toNumber(maxPrice) > 0 ? toNumber(maxPrice) : null,
    };
    if (!body.category_id && !body.origin_city && !body.destination_city && !body.event_name && !body.venue_city) {
      setError('Add at least a category, a city or an event so the alert isn’t too broad.');
      return;
    }
    setSaving(true);
    try {
      await api('/alerts', { method: 'POST', body });
      toast('Alert created', 'We’ll notify you when a matching ticket is listed.', 'success');
      setFrom(''); setTo(''); setEventName(''); setCity(''); setMaxPrice('');
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await api(`/alerts/${id}`, { method: 'DELETE' });
      toast('Alert removed');
      await onChange();
    } catch (err) {
      toast('Couldn’t remove alert', errorMessage(err), 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong">
            <EmptyState
              icon={BellRing}
              title="No alerts yet"
              body="Tell us the route or event you’re after. The moment someone lists a match, you’ll get a notification."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {alerts.map((a) => {
              const c = categoryById(a.category_id);
              const Icon = c?.icon || BellRing;
              return (
                <div key={a.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
                  <Icon className="h-4 w-4 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{alertTitle(a)}</div>
                    <div className="mt-0.5 text-[13px] text-ink-2">
                      {[c?.name || 'Any category', a.max_price ? `up to ${money(a.max_price)}` : 'any price', a.fire_count > 0 ? `matched ${a.fire_count}×` : 'no matches yet'].join(' · ')}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Delete alert" loading={deleting === a.id} onClick={() => remove(a.id)}>
                    {deleting !== a.id && <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={create} className="spotlight rounded-lg border border-line bg-surface p-5 shadow-card" noValidate>
        <h2 className="text-[15px] font-semibold">New alert</h2>
        <p className="mt-1 text-[13px] text-ink-3">Get notified the moment a matching ticket is listed.</p>
        <div className="mt-5 space-y-4">
          <Field label="Category">
            {(p) => (
              <Select {...p} value={catId} onChange={(e) => setCatId(e.target.value)}>
                <option value="">Any category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
          {isRoute ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" optional>{(p) => <Autocomplete {...p} kind="city" value={from} onChange={setFrom} placeholder="Delhi" />}</Field>
              <Field label="To" optional>{(p) => <Autocomplete {...p} kind="city" value={to} onChange={setTo} placeholder="Mumbai" />}</Field>
            </div>
          ) : (
            <>
              <Field label="Event" optional>{(p) => <Input {...p} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="MI vs CSK" />}</Field>
              <Field label="City" optional>{(p) => <Autocomplete {...p} kind="city" value={city} onChange={setCity} placeholder="Mumbai" />}</Field>
            </>
          )}
          <Field label="Max price (₹)" optional>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="3000" className="font-mono" />}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" className="w-full" loading={saving}><BellRing className="h-4 w-4" />Create alert</Button>
        </div>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="container-page pt-10" />}>
      <DashboardInner />
    </Suspense>
  );
}
