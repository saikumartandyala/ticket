'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Plus, Search, Ticket } from 'lucide-react';
import { api } from '../lib/api';
import type { Listing } from '../lib/types';
import { useCategories } from '../lib/useCategories';
import { hhmm, money, parseLocal } from '../lib/format';
import { ListingRow, ListingRowSkeleton } from '../components/tickets/ListingRow';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { CountUp, FlipText, Marquee, RotatingWord } from '../components/motion';
import { cn } from '../lib/cn';

const WORDS = ['train ticket', 'bus seat', 'IPL pass', 'concert ticket', 'match ticket'];
const QUICK = ['Mumbai', 'Bengaluru', 'Delhi', 'Chennai', 'Wankhede'];

const SELL_STEPS = [
  ['List it', 'Pick a category, add the route or event, set a price within the fair band. Takes about a minute.'],
  ['Review requests', 'People who need the ticket send a request. You choose who to accept.'],
  ['Hand it over', 'Chat privately, swap numbers when you’re both ready, and settle over UPI or cash.'],
];

const BUY_STEPS = [
  ['Find a seat', 'Search the board by city, route or event. Listings close automatically at departure.'],
  ['Request it', 'Send a short note to the seller. Nothing is charged — there’s nothing to pay us.'],
  ['Meet & confirm', 'Once accepted, verify the ticket before paying, then mark the transfer complete.'],
];

const FACTS = [
  ['₹0', 'Fees', 'Listing, browsing and chatting are free. We never touch the money.'],
  ['30–90%', 'Fair price band', 'Asking prices must sit between 30% and 90% of face value. No scalping.'],
  ['2-WAY', 'Consent to share', 'Phone numbers are revealed only after the seller accepts a request.'],
  ['1–5', 'Rated both sides', 'Buyers and sellers rate each other after every completed handover.'],
];

const FAQS = [
  ['Do you take a cut?', 'No. TickOrbit doesn’t process payments, so there’s nothing to take a cut of. You agree a price within the fair band and settle directly with the other person.'],
  ['Is transferring my ticket allowed?', 'It depends on the operator or venue. Many event tickets and some travel bookings allow a name change or transfer; others don’t. Check your booking’s terms before listing — if the ticket is non-transferable, please don’t list it.'],
  ['How do I know the other person is genuine?', 'Every account verifies its email. Profiles show a rating and the number of completed transfers, and you can chat before sharing any contact details. Always check the PNR or barcode before paying.'],
  ['What happens if the handover falls through?', 'Nothing is charged, so there’s nothing to refund. The seller’s listing stays open until it closes at departure time, and both sides can rate the experience.'],
  ['When does my listing disappear?', 'Automatically at the departure or start time you enter. You can also cancel it any time from your dashboard.'],
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-line">
      <button onClick={onToggle} aria-expanded={open} className="group flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] font-medium">
        <span className="transition-colors group-hover:text-accent">{q}</span>
        <span className={cn('relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong transition-all duration-500 ease-out-expo', open && 'rotate-45 border-accent bg-accent text-accent-ink')} aria-hidden>
          <span className="absolute h-px w-3 bg-current" />
          <span className="absolute h-3 w-px bg-current" />
        </span>
      </button>
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const categories = useCategories();

  const load = useCallback(() => {
    setFailed(false);
    setListings(null);
    api<Listing[]>('/listings')
      .then((data) => setListings(Array.isArray(data) ? data : []))
      .catch(() => { setFailed(true); setListings([]); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const soonest = (listings || [])
    .slice()
    .sort((a, b) => parseLocal(a.expires_at).getTime() - parseLocal(b.expires_at).getTime())
    .slice(0, 6);

  const countBy = (slug: string) => (listings || []).filter((l) => l.category?.slug === slug).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = q.trim();
    router.push(s ? `/tickets?query=${encodeURIComponent(s)}` : '/tickets');
  };

  return (
    <>
      {/* Hero */}
      <section className="relative -mt-14 overflow-hidden pt-14">
        <div className="aurora" aria-hidden />
        <div className="grid-fade" aria-hidden />

        <div className="container-page relative grid items-center gap-10 pb-10 pt-8 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-12 lg:pt-14">
          <div className="flex flex-col justify-center">
            <div data-reveal className="w-fit">
              <Link
                href="/tickets"
                className="group inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface/70 py-1 pl-1.5 pr-3 text-[13px] text-ink-2 shadow-card backdrop-blur transition-colors hover:border-ink-3 hover:text-ink"
              >
                <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  LIVE
                </span>
                {listings && listings.length > 0 ? (
                  <span><CountUp value={listings.length} className="font-medium text-ink num" /> tickets on the board right now</span>
                ) : (
                  <span>Peer-to-peer ticket transfers in India</span>
                )}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <h1 className="mt-6 text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[58px] lg:text-[66px]">
              <span data-reveal style={{ ['--d' as any]: 1 }} className="block">Can&apos;t make it?</span>
              <span data-reveal style={{ ['--d' as any]: 2 }} className="block text-ink-3">
                Hand your
                <span className="block"><RotatingWord words={WORDS} className="text-accent" /></span>
              </span>
              <span data-reveal style={{ ['--d' as any]: 3 }} className="block text-ink-3">to someone who can.</span>
            </h1>

            <p data-reveal style={{ ['--d' as any]: 4 }} className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
              A live board for train, bus, match and concert tickets that would otherwise go to waste. Sellers recover part of
              the fare, buyers get a seat today — and you settle directly, with no fees.
            </p>

            <form
              data-reveal
              style={{ ['--d' as any]: 5 }}
              onSubmit={submit}
              role="search"
              className="mt-8 flex max-w-[540px] items-center gap-1.5 rounded-xl border border-line-strong bg-surface/80 p-1.5 shadow-lift backdrop-blur-xl transition-[border-color,box-shadow] duration-300 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10"
            >
              <label className="relative flex-1">
                <span className="sr-only">Search tickets</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="City, route or event"
                  className="h-11 w-full bg-transparent pl-10 pr-2 text-[15px] placeholder:text-ink-3 focus:outline-none"
                />
              </label>
              <Button type="submit" size="md" className="h-11 px-5">
                Search <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5" />
              </Button>
            </form>
            <div data-reveal style={{ ['--d' as any]: 6 }} className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-3">
              <span>Try</span>
              {QUICK.map((c) => (
                <Link
                  key={c}
                  href={`/tickets?query=${encodeURIComponent(c)}`}
                  className="rounded-full border border-line bg-surface/50 px-2.5 py-1 text-ink-2 transition-all duration-200 hover:-translate-y-px hover:border-ink-3 hover:text-ink"
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>

          {/* Live board */}
          <div data-reveal style={{ ['--d' as any]: 3 }} className="relative self-center">
            <div aria-hidden className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br from-accent/20 via-transparent to-warn/10 opacity-70 blur-2xl" />
            <div className="spotlight overflow-hidden rounded-xl border border-line bg-surface/90 shadow-lift backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="text-sm font-semibold">Closing soon</span>
                  {listings && listings.length > 0 && (
                    <span className="rounded-full bg-subtle px-2 py-0.5 font-mono text-[11px] text-ink-2 num">{listings.length} live</span>
                  )}
                </div>
                <Link href="/tickets" className="group flex items-center gap-1 text-[13px] text-ink-2 transition-colors hover:text-ink">
                  View all <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </div>

              {listings === null ? (
                Array.from({ length: 5 }).map((_, i) => <ListingRowSkeleton key={i} compact />)
              ) : failed ? (
                <EmptyState
                  title="Couldn’t load the board"
                  body="The server didn’t respond. Check your connection and try again."
                  action={<Button variant="secondary" size="sm" onClick={load}>Try again</Button>}
                />
              ) : soonest.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="The board is quiet right now"
                  body="Listings appear here the moment someone posts one. Have a ticket you can’t use?"
                  action={<ButtonLink href="/post" size="sm"><Plus className="h-4 w-4" />List a ticket</ButtonLink>}
                />
              ) : (
                soonest.map((l, i) => <ListingRow key={l.id} listing={l} compact index={i} />)
              )}
            </div>
          </div>
        </div>

        {/* Ticker */}
        {listings && listings.length > 0 && (
          <div className="relative border-y border-line bg-surface/50 py-3 backdrop-blur">
            <Marquee seconds={Math.max(28, listings.length * 7)}>
              {listings.map((l) => (
                <Link key={l.id} href={`/tickets/${l.id}`} data-track={`Ticker: ${l.title}`} className="group mx-6 flex shrink-0 items-center gap-3 text-[13px]">
                  <span className="font-mono text-ink-3 num">{hhmm(l.departure_time) || '——'}</span>
                  <span className="font-medium text-ink-2 transition-colors group-hover:text-ink">{l.title}</span>
                  <span className="font-mono text-ink num">{money(l.asking_price)}</span>
                  <span className="ml-3 h-1 w-1 rounded-full bg-line-strong" />
                </Link>
              ))}
            </Marquee>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="container-page mt-12">
        <div data-reveal className="mb-6 flex items-end justify-between">
          <div>
            <div className="eyebrow">Categories</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Every kind of ticket</h2>
          </div>
          <Link href="/tickets" className="link-u hidden text-sm text-ink-2 hover:text-ink sm:block">Browse all</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c, i) => {
            const Icon = c.icon;
            const n = countBy(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/tickets?category=${c.slug}`}
                data-track={`Category tile: ${c.name}`}
                data-reveal
                style={{ ['--d' as any]: i }}
                className="spotlight group flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-bg text-ink-2 transition-all duration-500 ease-out-expo group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 -translate-x-1 translate-y-1 text-ink-3 opacity-0 transition-all duration-500 ease-out-expo group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-medium">{c.name}</span>
                    {listings !== null && <span className="font-mono text-xs text-ink-3 num">{n}</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-3">{c.hint}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container-page mt-20 scroll-mt-20">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
          <div data-reveal className="lg:sticky lg:top-24 lg:self-start">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
              Two people, one ticket, no middleman.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              We match people and keep the conversation private until both sides are ready. The money and the handover
              stay between you.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[['If you’re selling', SELL_STEPS], ['If you need a ticket', BUY_STEPS]].map(([title, steps], col) => (
              <div key={title as string} data-reveal style={{ ['--d' as any]: col + 1 }} className="spotlight rounded-lg border border-line bg-surface p-6 shadow-card sm:p-7">
                <h3 className="text-[15px] font-semibold">{title as string}</h3>
                <ol className="relative mt-7 space-y-7">
                  <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-accent/60 via-line-strong to-transparent" />
                  {(steps as string[][]).map(([t, b], i) => (
                    <li key={t} className="relative grid grid-cols-[28px_1fr] gap-4">
                      <span className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[11px] text-ink-2 num">0{i + 1}</span>
                      <div className="pt-0.5">
                        <div className="text-[15px] font-medium">{t}</div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-2">{b}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair by design */}
      <section className="container-page mt-20">
        <div data-reveal className="mb-6">
          <div className="eyebrow">Fair by design</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Rules the board enforces for you</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(([fig, t, b], i) => (
            <div
              key={t}
              data-reveal
              style={{ ['--d' as any]: i }}
              className="spotlight group rounded-lg border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="font-mono text-[34px] font-medium leading-none tracking-[-0.03em] num">
                <FlipText text={fig} delay={i * 120} speed={40} />
              </div>
              <div className="mt-5 text-[15px] font-medium">{t}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-page mt-20 scroll-mt-20">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
          <div data-reveal>
            <div className="eyebrow">Questions</div>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">Before you start</h2>
          </div>
          <div data-reveal style={{ ['--d' as any]: 1 }} className="border-t border-line">
            {FAQS.map(([qq, a], i) => (
              <FaqItem key={qq} q={qq} a={a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page mt-20">
        <div data-reveal className="relative isolate overflow-hidden rounded-xl bg-inverse px-6 py-14 text-inverse-ink shadow-lift sm:px-12">
          <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-accent/40 blur-[90px]" />
          <div aria-hidden className="absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-warn/20 blur-[90px]" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.08]"
            style={{
              backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 60% 80% at 80% 50%, #000, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 80% at 80% 50%, #000, transparent)',
            }}
          />
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Got a ticket you can&apos;t use?</h2>
              <p className="mt-3 max-w-md text-[15px] opacity-70">List it in about a minute. It closes on its own at departure time, and people with matching alerts hear about it instantly.</p>
            </div>
            <ButtonLink href="/post" variant="accent" size="lg" className="self-start sm:self-auto">
              List a ticket <ArrowRight className="h-4 w-4 group-hover:translate-x-1" />
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
