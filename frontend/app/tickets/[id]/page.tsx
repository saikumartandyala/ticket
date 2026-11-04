'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Eye, MessageSquare, Star, TicketX, Users } from 'lucide-react';
import { api, assetUrl, errorMessage } from '../../../lib/api';
import type { Listing, Match } from '../../../lib/types';
import { categoryFor } from '../../../lib/categories';
import { money, parseUtc, placeLine, relativeTime, seatLine, timeLeft, toNumber } from '../../../lib/format';
import { useAuthStore } from '../../../store/authStore';
import { toast } from '../../../store/toastStore';
import { TicketStub } from '../../../components/tickets/TicketStub';
import { TimeLeft } from '../../../components/tickets/ListingRow';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Field';
import { Avatar, Badge, Card, EmptyState, Notice, Skeleton } from '../../../components/ui/misc';
import { Tilt } from '../../../components/motion';

const SAFETY = [
  'Check the PNR, booking ID or barcode with the operator before paying.',
  'Meet somewhere public — near the station, gate or box office.',
  'Never share an OTP. A genuine transfer never needs one.',
  'Pay only the agreed amount, and only once the ticket is in your name or hands.',
];

const MATCH_COPY: Record<string, string> = {
  pending: 'Request sent. The seller will accept or decline — you’ll get a notification either way.',
  accepted: 'The seller accepted your request. Continue in the chat.',
  contact_revealed: 'You’re in touch with the seller. Continue in the chat.',
  transferred: 'This transfer is complete.',
  declined: 'The seller declined this request.',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hydrated, isAuthenticated, user } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [myMatch, setMyMatch] = useState<Match | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api<Listing>(`/listings/${id}`)
      .then((d) => { setListing(d); setState('ok'); })
      .catch((e) => setState(e?.status === 404 ? 'missing' : 'error'));
  }, [id]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    api<Match[]>('/matches')
      .then((ms) => setMyMatch(ms.find((m) => m.listing_id === id && m.seeker_id === user?.id && m.status !== 'cancelled') || null))
      .catch(() => {});
  }, [hydrated, isAuthenticated, id, user?.id]);

  const requestTicket = async () => {
    if (!isAuthenticated) { router.push(`/auth?next=/tickets/${id}`); return; }
    setSubmitting(true);
    setError('');
    try {
      const m = await api<Match>(`/listings/${id}/interest`, { method: 'POST', body: { seeker_note: note.trim() || null } });
      setMyMatch(m);
      toast('Request sent', 'We’ve let the seller know. You’ll be notified when they respond.', 'success');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelListing = async () => {
    setCancelling(true);
    try {
      await api(`/listings/${id}`, { method: 'DELETE' });
      toast('Listing cancelled', 'It’s no longer visible on the board.', 'success');
      router.push('/dashboard');
    } catch (e) {
      setError(errorMessage(e));
      setCancelling(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="container-page pt-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-6 h-9 w-2/3 max-w-md" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[260px] rounded-lg" />
          <Skeleton className="h-[260px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (state !== 'ok' || !listing) {
    return (
      <div className="container-page pt-16">
        <EmptyState
          icon={TicketX}
          title={state === 'missing' ? 'This listing isn’t available' : 'Couldn’t load this ticket'}
          body={state === 'missing' ? 'It may have been transferred, cancelled, or closed at departure time.' : 'The server didn’t respond. Check your connection and try again.'}
          action={<ButtonLink href="/tickets" variant="secondary" size="sm">Browse other tickets</ButtonLink>}
        />
      </div>
    );
  }

  const cat = categoryFor(listing);
  const isOwner = !!user && user.id === listing.user_id;
  const closed = listing.status !== 'active' || timeLeft(listing.expires_at).ms <= 0;
  const asking = toNumber(listing.asking_price);
  const face = toNumber(listing.original_price);
  const seller = listing.owner;
  const place = placeLine(listing);

  return (
    <div className="container-page pt-8">
      <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All tickets
      </Link>

      <div className="mt-5 flex animate-row-in flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">{listing.title}</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {[cat.name, listing.operator_name, cat.kind === 'venue' && place !== listing.title ? place : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {closed ? <Badge>Closed</Badge> : <TimeLeft expiresAt={listing.expires_at} className="text-[13px]" />}
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left */}
        <div className="min-w-0 space-y-8">
          <Tilt max={5} className="animate-print motion-reduce:animate-none">
          <TicketStub
            data={{
              id: listing.id,
              category: cat,
              title: listing.event_name || listing.title,
              operator: listing.operator_name,
              operatorCode: listing.operator_code,
              from: listing.origin_city,
              to: listing.destination_city,
              venue: listing.venue_name,
              city: listing.venue_city,
              date: listing.event_date,
              departure: listing.departure_time,
              arrival: listing.arrival_time,
              seat: seatLine(listing),
              seats: listing.seat_count,
              pnrLast4: listing.pnr_last_four,
              asking: listing.asking_price,
              face: listing.original_price,
            }}
          />
          </Tilt>

          {listing.description && (
            <section data-reveal>
              <h2 className="text-[15px] font-semibold">Seller’s note</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{listing.description}</p>
            </section>
          )}

          {listing.ticket_photos?.length > 0 && (
            <section data-reveal>
              <h2 className="text-[15px] font-semibold">Ticket photo</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {listing.ticket_photos.map((p) => (
                  <a key={p} href={assetUrl(p)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(p)} alt="Ticket photo uploaded by the seller" className="h-40 w-auto object-cover blur-[2px] transition hover:blur-0" />
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-ink-3">Sensitive details may be partly hidden by the seller.</p>
            </section>
          )}

          <section data-reveal className="border-t border-line pt-8">
            <h2 className="text-[15px] font-semibold">Before you pay</h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-2">
              {SAFETY.map((s, i) => (
                <li key={s} className="grid grid-cols-[28px_1fr] text-sm leading-relaxed text-ink-2">
                  <span className="font-mono text-[13px] text-ink-3 num">0{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="animate-row-in p-5 [animation-delay:150ms]">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[30px] font-medium leading-none tracking-[-0.02em] num">{money(asking)}</div>
              {face > asking && <div className="text-[13px] text-good">You save {money(face - asking)}</div>}
            </div>
            <div className="mt-1.5 text-[13px] text-ink-3">
              {listing.seat_count > 1 ? `For ${listing.seat_count} seats · ` : ''}Face value <span className="font-mono line-through num">{money(face)}</span>
            </div>

            <div className="mt-5 border-t border-line pt-5">
              {isOwner ? (
                <div className="space-y-4">
                  <Notice title="This is your listing">
                    {listing.interest_count > 0
                      ? `${listing.interest_count} ${listing.interest_count === 1 ? 'person has' : 'people have'} requested it.`
                      : 'No requests yet. You’ll get a notification when someone asks.'}
                  </Notice>
                  <ButtonLink href="/dashboard?tab=requests" className="w-full">Review requests</ButtonLink>
                  {!closed && (
                    confirmCancel ? (
                      <div className="flex gap-2">
                        <Button variant="danger" className="flex-1" loading={cancelling} onClick={cancelListing}>Yes, cancel it</Button>
                        <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" className="w-full" onClick={() => setConfirmCancel(true)}>Cancel listing</Button>
                    )
                  )}
                </div>
              ) : myMatch ? (
                <div className="space-y-4">
                  <Notice tone={myMatch.status === 'declined' ? 'info' : 'success'}>{MATCH_COPY[myMatch.status] || 'Request sent.'}</Notice>
                  {['accepted', 'contact_revealed', 'transferred'].includes(myMatch.status) ? (
                    <ButtonLink href={`/chat/${myMatch.id}`} className="w-full"><MessageSquare className="h-4 w-4" />Open chat</ButtonLink>
                  ) : (
                    <ButtonLink href="/dashboard?tab=requests" variant="secondary" className="w-full">View in dashboard</ButtonLink>
                  )}
                </div>
              ) : closed ? (
                <Notice>This listing is closed and no longer accepting requests.</Notice>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="note" className="block text-[13px] font-medium">
                    Message to {seller?.name?.split(' ')[0] || 'the seller'} <span className="font-normal text-ink-3">· optional</span>
                  </label>
                  <Textarea
                    id="note"
                    value={note}
                    maxLength={200}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. I’m near the station and can meet in 30 minutes."
                    className="min-h-[76px] text-sm"
                  />
                  <div className="text-right font-mono text-[11px] text-ink-3 num">{note.length}/200</div>
                  {error && <Notice tone="error">{error}</Notice>}
                  <Button size="lg" className="w-full" loading={submitting} onClick={requestTicket}>
                    {isAuthenticated ? 'Request this ticket' : 'Sign in to request'}
                  </Button>
                  <p className="text-center text-[13px] leading-snug text-ink-3">
                    Free and non-binding. If the seller accepts, a private chat opens.
                  </p>
                </div>
              )}
              {isOwner && error && <Notice tone="error" className="mt-3">{error}</Notice>}
            </div>
          </Card>

          <Card className="animate-row-in p-5 [animation-delay:280ms]">
            <div className="eyebrow">Seller</div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={seller?.name} size={40} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{seller?.name || 'Seller'}</div>
                <div className="flex items-center gap-1 text-[13px] text-ink-2">
                  {seller && seller.rating_count > 0 ? (
                    <>
                      <Star className="h-3.5 w-3.5 fill-current text-ink" />
                      <span className="num">{seller.avg_rating.toFixed(1)}</span>
                      <span className="text-ink-3">· {seller.rating_count} {seller.rating_count === 1 ? 'rating' : 'ratings'}</span>
                    </>
                  ) : (
                    <span className="text-ink-3">No ratings yet</span>
                  )}
                </div>
              </div>
            </div>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Completed transfers</dt><dd className="font-mono num">{seller?.total_matches ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Listings posted</dt><dd className="font-mono num">{seller?.total_listings ?? 0}</dd></div>
            </dl>
            {(seller?.email_verified || seller?.phone_verified) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {seller.email_verified && <Badge tone="good"><BadgeCheck className="h-3.5 w-3.5" />Email verified</Badge>}
                {seller.phone_verified && <Badge tone="good"><BadgeCheck className="h-3.5 w-3.5" />Phone verified</Badge>}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between px-1 text-[13px] text-ink-3">
            <span>Listed {relativeTime(parseUtc(listing.created_at))}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /><span className="num">{listing.view_count}</span></span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /><span className="num">{listing.interest_count}</span></span>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
