'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BellRing, Plus, Search, SearchX, Ticket, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { categoryBySlug } from '../../lib/categories';
import { useCategories } from '../../lib/useCategories';
import { discountPct, parseLocal, parseUtc, toNumber } from '../../lib/format';
import { BoardHeader, ListingRow, ListingRowSkeleton } from '../../components/tickets/ListingRow';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { EmptyState, PageHeader } from '../../components/ui/misc';
import { breadcrumbJsonLd, jsonLdString } from '../../lib/seo';
import { cn } from '../../lib/cn';
import { trackSearch } from '../../lib/analytics';

const SORTS = {
  soonest: { label: 'Closing soonest', fn: (a: Listing, b: Listing) => parseLocal(a.expires_at).getTime() - parseLocal(b.expires_at).getTime() },
  cheapest: { label: 'Lowest price', fn: (a: Listing, b: Listing) => toNumber(a.asking_price) - toNumber(b.asking_price) },
  saving: { label: 'Biggest saving', fn: (a: Listing, b: Listing) => discountPct(b) - discountPct(a) },
  newest: { label: 'Newest', fn: (a: Listing, b: Listing) => parseUtc(b.created_at).getTime() - parseUtc(a.created_at).getTime() },
} as const;
type SortKey = keyof typeof SORTS;

const PRICES = [
  ['', 'Any price'],
  ['1000', 'Under ₹1,000'],
  ['2500', 'Under ₹2,500'],
  ['5000', 'Under ₹5,000'],
  ['10000', 'Under ₹10,000'],
];

function BrowseInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = params.get('query') || '';
  const category = categoryBySlug(params.get('category'))?.slug || '';
  const sort: SortKey = (params.get('sort') as SortKey) in SORTS ? (params.get('sort') as SortKey) : 'soonest';
  const max = params.get('max') || '';

  const [draft, setDraft] = useState(query);
  const categories = useCategories();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => setDraft(query), [query]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounce typing into the URL.
  useEffect(() => {
    if (draft.trim() === query) return;
    const t = setTimeout(() => setParam('query', draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft, query, setParam]);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (query) qs.set('query', query);
    if (max) qs.set('max_price', max);
    setListings(null);
    setFailed(false);
    api<Listing[]>(`/listings${qs.toString() ? `?${qs}` : ''}`)
      .then((d) => setListings(Array.isArray(d) ? d : []))
      .catch(() => { setFailed(true); setListings([]); });
  }, [query, max]);

  useEffect(() => { load(); }, [load]);

  // Record what people search for (once per distinct query).
  useEffect(() => { if (query) trackSearch(query, { category: category || null, max_price: max || null }); }, [query, category, max]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (listings || []).forEach((l) => { const s = l.category?.slug; if (s) c[s] = (c[s] || 0) + 1; });
    return c;
  }, [listings]);

  const visible = useMemo(
    () => (listings || []).filter((l) => !category || l.category?.slug === category).sort(SORTS[sort].fn),
    [listings, category, sort],
  );

  const hasFilters = !!(query || category || max);
  const clearAll = () => { setDraft(''); router.replace(pathname, { scroll: false }); };
  const catName = categoryBySlug(category)?.name;

  return (
    <div className="container-page pt-10">
      <PageHeader
        eyebrow="Marketplace"
        title={catName ? `${catName} tickets` : 'Browse tickets'}
        description={
          listings === null
            ? 'Loading the board…'
            : `${visible.length} ${visible.length === 1 ? 'listing' : 'listings'} open${query ? ` matching “${query}”` : ''}. Each one closes at its departure or start time.`
        }
      />

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by city, route, venue or event"
            className="h-11 w-full rounded-md border border-line-strong bg-surface pl-9 pr-9 text-[15px] placeholder:text-ink-3 transition-[border-color,box-shadow] duration-200 focus:border-accent/70 focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
          {draft && (
            <button aria-label="Clear search" onClick={() => setDraft('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3 lg:w-[400px]">
          <Select aria-label="Sort" value={sort} onChange={(e) => setParam('sort', e.target.value === 'soonest' ? '' : e.target.value)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select aria-label="Maximum price" value={max} onChange={(e) => setParam('max', e.target.value)}>
            {PRICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {/* Category tabs */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[{ slug: '', name: 'All' }, ...categories].map((c) => {
          const active = category === c.slug;
          const n = c.slug ? counts[c.slug] || 0 : listings?.length || 0;
          return (
            <button
              key={c.slug || 'all'}
              data-track={`Category filter: ${c.name}`}
              onClick={() => setParam('category', c.slug)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-all duration-300 ease-out-expo active:scale-95',
                active ? 'border-ink bg-inverse text-inverse-ink shadow-[0_6px_16px_-6px_rgb(0_0_0/0.4)]' : 'border-line-strong bg-surface/60 text-ink-2 hover:-translate-y-px hover:border-ink-3 hover:text-ink',
              )}
            >
              {c.name}
              {listings !== null && <span className={cn('font-mono text-[11px] num', active ? 'opacity-70' : 'text-ink-3')}>{n}</span>}
            </button>
          );
        })}
        {hasFilters && (
          <button onClick={clearAll} className="ml-1 flex h-9 shrink-0 items-center gap-1 px-2 text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Board */}
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {listings === null ? (
          <>
            <BoardHeader />
            {Array.from({ length: 6 }).map((_, i) => <ListingRowSkeleton key={i} />)}
          </>
        ) : failed ? (
          <EmptyState
            title="Couldn’t load listings"
            body="The server didn’t respond. Check your connection and try again."
            action={<Button variant="secondary" size="sm" onClick={load}>Try again</Button>}
          />
        ) : visible.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No tickets match"
              body="Try a nearby city, a broader search or a higher price. Or set an alert and we’ll notify you when one is listed."
              action={
                <>
                  <Button variant="secondary" size="sm" onClick={clearAll}>Clear filters</Button>
                  <ButtonLink href="/dashboard?tab=alerts" size="sm"><BellRing className="h-4 w-4" />Create an alert</ButtonLink>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={Ticket}
              title="No tickets listed yet"
              body="Be the first. Listing is free and takes about a minute."
              action={<ButtonLink href="/post" size="sm"><Plus className="h-4 w-4" />List a ticket</ButtonLink>}
            />
          )
        ) : (
          <>
            <BoardHeader />
            {visible.map((l, i) => <ListingRow key={l.id} listing={l} index={Math.min(i, 12)} />)}
          </>
        )}
      </div>

      {listings !== null && visible.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Not finding the right one?</span>
          <Link href="/dashboard?tab=alerts" className="flex items-center gap-1.5 font-medium text-ink underline-offset-4 hover:underline">
            <BellRing className="h-4 w-4" /> Get alerted when it’s listed
          </Link>
        </div>
      )}
    </div>
  );
}

const BROWSE_BREADCRUMB = jsonLdString(breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Tickets', path: '/tickets' }]));

// The Suspense fallback is the same header the page shows while the board
// loads, so the server HTML (what search engines and slow phones see first)
// isn't an empty shell.
export default function BrowsePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: BROWSE_BREADCRUMB }} />
      <Suspense
        fallback={
          <div className="container-page pt-10">
            <PageHeader eyebrow="Marketplace" title="Browse tickets" description="Loading the board…" />
          </div>
        }
      >
        <BrowseInner />
      </Suspense>
    </>
  );
}
