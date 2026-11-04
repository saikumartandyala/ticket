import type { Metadata } from 'next';
import {
  breadcrumbJsonLd, fetchPublic, jsonLdString, pageMetadata, privateMetadata, type PublicListing,
} from '../../../lib/seo';

type Params = { params: Promise<{ id: string }> };

const ID_RE = /^[0-9a-f-]{36}$/i;

function inr(v: string | number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : '';
}

function niceDate(d: string, withYear = true) {
  const dt = new Date(`${d}T00:00:00+05:30`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Asia/Kolkata' });
}

/**
 * Read from the public feed of open listings (cached 2 min). Deliberately not
 * GET /listings/{id}: that endpoint counts a view, and server renders or
 * crawlers must never inflate a seller's view count. Listings that aren't open
 * aren't in the feed, so they get noindex, which is what we want.
 */
async function getListing(id: string) {
  if (!ID_RE.test(id)) return null;
  const open = await fetchPublic<PublicListing[]>('/listings', 120);
  return open?.find((l) => l.id === id) ?? null;
}

/** Per-listing title, description and canonical. Closed or missing listings are noindex. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) return { ...privateMetadata('Ticket not found'), alternates: { canonical: null } };

  const what = l.category?.name ? `${l.category.name} ticket` : 'Ticket';
  const where = l.origin_city && l.destination_city
    ? `${l.origin_city} to ${l.destination_city}`
    : [l.event_name || l.title, l.venue_city].filter(Boolean).join(', ');
  const when = niceDate(l.event_date);
  const price = inr(l.asking_price);
  const face = inr(l.original_price);
  const open = l.status === 'active' && new Date(l.expires_at).getTime() > Date.now();

  return pageMetadata({
    // e.g. "IND vs AUS · 2nd ODI, Kolkata · 6 Nov · ₹2,100" (+ " · TickOrbit")
    title: [where, niceDate(l.event_date, false), price].filter(Boolean).join(' · '),
    description: `${what} for ${where} on ${when}: ${price}${face ? ` (face value ${face})` : ''}. Request it free on TickOrbit and chat privately with the seller to hand it over.`,
    path: `/tickets/${l.id}`,
    noindex: !open,
  });
}

export default async function TicketLayout({ children, params }: { children: React.ReactNode } & Params) {
  const { id } = await params;
  const l = await getListing(id);
  return (
    <>
      {l && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Tickets', path: '/tickets' },
              { name: l.title, path: `/tickets/${l.id}` },
            ])),
          }}
        />
      )}
      {children}
    </>
  );
}
