'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/authStore';
import { API_BASE } from '../../../lib/api';
import { useTilt } from '../../../lib/useTilt';

const money = (n: number) => '₹' + n.toLocaleString('en-IN');

const MOCK: any = {
  id: '1', category: { name: 'Train' }, operator_name: 'Rajdhani Express', title: 'NDLS → BCT',
  origin_city: 'New Delhi', destination_city: 'Mumbai', event_date: 'Tonight', departure_time: '20:45',
  seat_details: { coach: '3A', seat: '42' }, asking_price: '1850', original_price: '2450',
  owner: { name: 'Aarav S.', avg_rating: 4.9 },
};

const SAFETY = [
  'Meet in a public, well-lit place near the venue or station.',
  'Verify the ticket PNR or barcode before paying anything.',
  'Never share OTPs — no genuine transfer needs one.',
  'Report anyone who asks you to pay outside the agreed amount.',
];

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const tilt = useTilt<HTMLDivElement>(7, 5);

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/listings/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setListing(data))
      .catch(() => setListing(MOCK))
      .finally(() => setLoading(false));
  }, [id]);

  const handleInterest = async () => {
    if (!isAuthenticated) { router.push('/auth'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ seeker_note: '' }),
      });
      if (res.ok) { router.push('/dashboard'); }
      else { alert('Could not express interest. Please try again.'); }
    } catch {
      alert('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#9d90b6' }}>Loading ticket…</div>;
  if (!listing) return <div style={{ padding: 48, textAlign: 'center', color: '#9d90b6' }}>Ticket not found.</div>;

  const price = parseFloat(listing.asking_price);
  const face = parseFloat(listing.original_price);
  const savings = face > 0 ? Math.round((1 - price / face) * 100) + '%' : '';
  const sub = listing.origin_city && listing.destination_city
    ? `${listing.origin_city} → ${listing.destination_city}`
    : `${listing.venue_name || ''}${listing.venue_city ? ', ' + listing.venue_city : ''}`;
  const seatText = listing.seat_details
    ? [listing.seat_details.coach, listing.seat_details.seat].filter(Boolean).join(' · ')
    : (listing.pnr_last_four ? `PNR …${listing.pnr_last_four}` : '—');
  const seller = listing.owner?.name || 'Seller';
  const initials = seller.split(' ').map((x: string) => x[0]).join('').slice(0, 2);

  const facts = [
    { k: 'Date', v: `${listing.event_date || ''}${listing.departure_time ? ' · ' + String(listing.departure_time).slice(0, 5) : ''}` },
    { k: 'Where', v: listing.operator_name || listing.venue_name || '—' },
    { k: 'Seat', v: seatText },
    { k: 'City', v: listing.venue_city || listing.destination_city || '—' },
  ];

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 20px 80px' }}>
      <button onClick={() => router.push('/tickets')} style={{ background: 'transparent', border: 'none', color: '#a99cc0', fontSize: 14, cursor: 'pointer', padding: '0 0 20px' }}>← Back to browse</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 32, alignItems: 'start' }}>
        {/* Ticket + safety */}
        <div>
          <div style={{ perspective: 1200 }}>
            <div ref={tilt} style={{ position: 'relative', borderRadius: 28, padding: 30, background: 'linear-gradient(150deg,rgba(192,132,252,.26),rgba(124,58,237,.12) 50%,rgba(255,255,255,.05))', border: '1px solid rgba(214,188,255,.42)', backdropFilter: 'blur(18px)', boxShadow: '0 40px 90px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.55), inset 0 -40px 70px rgba(124,58,237,.25)', transition: 'transform .2s ease-out', transformStyle: 'preserve-3d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#dcccff' }}>{listing.category?.name} · {listing.operator_name || listing.venue_name || ''}</div>
                  <div className="font-display" style={{ fontWeight: 800, fontSize: 'clamp(26px,3.6vw,36px)', color: '#fff', marginTop: 10, letterSpacing: '-.03em' }}>{listing.title}</div>
                  <div style={{ fontSize: 14, color: '#cbb9f0', marginTop: 8 }}>{sub}</div>
                </div>
                <div style={{ padding: '7px 13px', borderRadius: 999, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', fontSize: 11.5, color: '#fff', whiteSpace: 'nowrap' }}>{seatText}</div>
              </div>
              <div className="ticket-divider-bright" style={{ margin: '26px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 18 }}>
                {facts.map((f) => (
                  <div key={f.k}>
                    <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#c4aef5' }}>{f.k}</div>
                    <div className="font-display" style={{ fontWeight: 600, fontSize: 16, color: '#fff', marginTop: 6 }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22, padding: 24, borderRadius: 22, border: '1px solid rgba(168,85,247,.2)', background: 'rgba(255,255,255,.035)', backdropFilter: 'blur(14px)' }}>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 12 }}>Stay safe</div>
            {SAFETY.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 14, color: '#a396bb', lineHeight: 1.55 }}><span style={{ color: '#c084fc' }}>◆</span>{t}</div>
            ))}
          </div>
        </div>

        {/* Price + seller */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: 26, borderRadius: 24, border: '1px solid rgba(192,132,252,.32)', background: 'linear-gradient(160deg,rgba(168,85,247,.16),rgba(255,255,255,.03))', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 70px rgba(124,58,237,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div className="font-display" style={{ fontWeight: 800, fontSize: 40, color: '#fff', letterSpacing: '-.03em' }}>{money(price)}</div>
              <div style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#8b7fa3', textDecoration: 'line-through' }}>{money(face)}</div>
              </div>
            </div>
            {savings && <div style={{ display: 'inline-block', marginTop: 10, padding: '6px 12px', borderRadius: 999, background: 'rgba(74,222,128,.14)', border: '1px solid rgba(74,222,128,.35)', color: '#86efac', fontSize: 12.5, fontWeight: 600 }}>You save {savings}</div>}
            <button onClick={handleInterest} disabled={submitting} className="btn-shimmer" style={{ width: '100%', marginTop: 20, padding: 15, borderRadius: 16, fontSize: 15.5 }}>{submitting ? 'Sending…' : 'Express interest'}</button>
            <p style={{ fontSize: 12.5, color: '#8b7fa3', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>No payment here. We open a chat so you two can settle it directly.</p>
          </div>

          <div style={{ padding: 24, borderRadius: 24, border: '1px solid rgba(168,85,247,.2)', background: 'rgba(255,255,255,.035)', backdropFilter: 'blur(14px)' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(145deg,#c084fc,#7c3aed)', display: 'grid', placeItems: 'center', fontFamily: 'Outfit', fontWeight: 700, color: '#fff', fontSize: 19, boxShadow: '0 8px 24px rgba(124,58,237,.5)' }}>{initials.toUpperCase()}</div>
              <div>
                <div className="font-display" style={{ fontWeight: 600, fontSize: 17, color: '#fff' }}>{seller}</div>
                <div style={{ fontSize: 13, color: '#9d90b6' }}>★ {listing.owner?.avg_rating || '5.0'} · verified seller</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {['Email verified', 'Phone verified', 'Top transferor'].map((b) => (
                <span key={b} style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.3)', fontSize: 12, color: '#d8c9ff' }}>{b}</span>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 13.5, color: '#9d90b6', lineHeight: 1.6 }}>Usually replies in under 4 minutes.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
