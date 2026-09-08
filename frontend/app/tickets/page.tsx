'use client';

import React, { useState, useEffect, Suspense, CSSProperties } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

const ACCENT: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#a855f7', cricket: '#34d399', concert: '#f472b6', event: '#c084fc',
};
const money = (n: number) => '₹' + n.toLocaleString('en-IN');
const CATS = ['Train', 'Bus', 'IPL', 'Cricket', 'Concert', 'Event'];
const TIME_OPTS = ['Next 6 hours', 'Today', 'Next 3 days', 'Anytime'];

const MOCK = [
  { id: '1', category: { slug: 'train', name: 'Train' }, title: 'NDLS → BCT', origin_city: 'New Delhi', destination_city: 'Mumbai', asking_price: '1850', original_price: '2450', owner: { name: 'Aarav S.', avg_rating: 4.9 }, expires_at: new Date(Date.now() + 3 * 3.6e6).toISOString() },
  { id: '2', category: { slug: 'ipl', name: 'IPL' }, title: 'MI vs CSK', venue_name: 'Wankhede', venue_city: 'Mumbai', asking_price: '3200', original_price: '4000', owner: { name: 'Priya M.', avg_rating: 4.8 }, expires_at: new Date(Date.now() + 6 * 3.6e6).toISOString() },
  { id: '3', category: { slug: 'concert', name: 'Concert' }, title: 'Diljit Dosanjh Live', venue_name: 'Ambience Arena', venue_city: 'Gurugram', asking_price: '5500', original_price: '7000', owner: { name: 'Rohan K.', avg_rating: 4.7 }, expires_at: new Date(Date.now() + 26 * 3.6e6).toISOString() },
  { id: '4', category: { slug: 'bus', name: 'Bus' }, title: 'Bengaluru → Hyderabad', origin_city: 'Bengaluru', destination_city: 'Hyderabad', asking_price: '899', original_price: '1200', owner: { name: 'Sneha R.', avg_rating: 4.9 }, expires_at: new Date(Date.now() + 5 * 3.6e6).toISOString() },
  { id: '5', category: { slug: 'cricket', name: 'Cricket' }, title: 'IND vs AUS · ODI', venue_name: 'Eden Gardens', venue_city: 'Kolkata', asking_price: '2750', original_price: '3500', owner: { name: 'Vikram J.', avg_rating: 4.6 }, expires_at: new Date(Date.now() + 44 * 3.6e6).toISOString() },
  { id: '6', category: { slug: 'event', name: 'Event' }, title: 'TechSparks Summit', venue_name: 'Jio World Centre', venue_city: 'Mumbai', asking_price: '2100', original_price: '3000', owner: { name: 'Ananya D.', avg_rating: 5.0 }, expires_at: new Date(Date.now() + 8 * 3.6e6).toISOString() },
];

function decorate(l: any) {
  const slug = l.category?.slug || 'event';
  const accent = ACCENT[slug] || '#c084fc';
  const price = parseFloat(l.asking_price);
  const face = parseFloat(l.original_price);
  const hours = Math.max(1, Math.round((new Date(l.expires_at).getTime() - Date.now()) / 3.6e6));
  const urgent = hours <= 6;
  const sub = l.origin_city && l.destination_city ? `${l.origin_city} → ${l.destination_city}` : `${l.venue_name || ''}${l.venue_city ? ', ' + l.venue_city : ''}`;
  return {
    id: l.id, accent, category: l.category?.name || 'Ticket', title: l.title, sub,
    price: money(price), face: money(face),
    savings: face > 0 ? Math.round((1 - price / face) * 100) + '%' : '',
    expires: hours < 24 ? `${hours}h left` : `${Math.round(hours / 24)}d left`,
    rating: l.owner?.avg_rating || '5.0', seller: l.owner?.name || 'Seller', urgent,
    price_num: price, slug,
  };
}

function urgencyStyle(urgent: boolean): CSSProperties {
  return { padding: '5px 10px', borderRadius: 999, fontSize: 11.5, whiteSpace: 'nowrap', border: `1px solid ${urgent ? 'rgba(251,113,133,.45)' : 'rgba(168,85,247,.28)'}`, background: urgent ? 'rgba(244,63,94,.14)' : 'rgba(168,85,247,.1)', color: urgent ? '#fda4af' : '#c9b8e8' };
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [listings, setListings] = useState<any[]>(MOCK);
  const [filter, setFilter] = useState<string>(searchParams.get('category') ? cap(searchParams.get('category')!) : 'All');
  const [maxPrice, setMaxPrice] = useState<number>(8000);
  const query = searchParams.get('query') || '';

  useEffect(() => {
    let url = `${API_BASE}/listings`;
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (params.toString()) url += `?${params.toString()}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (Array.isArray(data) && data.length) setListings(data); })
      .catch(() => {});
  }, [query]);

  const decorated = listings.map(decorate);
  const visible = decorated.filter((l) => (filter === 'All' || l.category === filter) && l.price_num <= maxPrice);

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 80px' }}>
      <h1 className="font-display" style={{ fontWeight: 800, fontSize: 'clamp(30px,4.4vw,46px)', letterSpacing: '-.035em', margin: '0 0 6px', color: '#fff' }}>Browse tickets</h1>
      <p style={{ color: '#9d90b6', margin: '0 0 28px', fontSize: 15 }}>{visible.length} live listings across India · updated seconds ago</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22, alignItems: 'start' }}>
        {/* Filter sidebar */}
        <aside className="glass" style={{ position: 'sticky', top: 86, maxWidth: 300, padding: 24 }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 16 }}>Filters</div>
          <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 10 }}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {['All', ...CATS].map((c) => {
              const active = filter === c;
              return (
                <button key={c} onClick={() => setFilter(c)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', border: `1px solid ${active ? 'rgba(192,132,252,.6)' : 'rgba(168,85,247,.22)'}`, background: active ? 'rgba(168,85,247,.2)' : 'rgba(255,255,255,.04)', color: active ? '#fff' : '#b7abcc' }}>{c}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 10 }}>Max price</div>
          <input type="range" min={500} max={8000} step={100} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} style={{ width: '100%', accentColor: '#a855f7' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#9d90b6', margin: '6px 0 22px' }}><span>₹500</span><span style={{ color: '#fff' }}>{money(maxPrice)}</span></div>
          <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 10 }}>Departs within</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIME_OPTS.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#b7abcc', cursor: 'pointer' }}><input type="radio" name="within" style={{ accentColor: '#a855f7' }} />{t}</label>
            ))}
          </div>
          <button onClick={() => { setFilter('All'); setMaxPrice(8000); }} style={{ width: '100%', marginTop: 22, padding: 11, borderRadius: 12, border: '1px solid rgba(168,85,247,.3)', background: 'transparent', color: '#c9b8e8', fontSize: 13.5, cursor: 'pointer' }}>Reset filters</button>
        </aside>

        {/* Grid */}
        <div style={{ gridColumn: 'span 2', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
          {visible.map((l) => (
            <div key={l.id} onClick={() => router.push(`/tickets/${l.id}`)} className="ticket-card" style={l.urgent ? { boxShadow: 'inset 0 0 70px rgba(251,113,133,.14), 0 0 34px rgba(244,63,94,.22), 0 20px 50px rgba(0,0,0,.45)' } : undefined}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: l.accent }} />
              <div style={{ position: 'absolute', left: -7, top: '52%', width: 14, height: 14, borderRadius: '50%', background: '#050308' }} />
              <div style={{ position: 'absolute', right: -7, top: '52%', width: 14, height: 14, borderRadius: '50%', background: '#050308' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c4b1e8' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: l.accent }} />{l.category}
                </div>
                <div style={urgencyStyle(l.urgent)}>{l.expires}</div>
              </div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 19, color: '#fff', marginTop: 14, letterSpacing: '-.02em' }}>{l.title}</div>
              <div style={{ fontSize: 13, color: '#9d90b6', marginTop: 5 }}>{l.sub}</div>
              <div className="ticket-divider" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 21, color: '#fff' }}>{l.price}</div>
                  <div style={{ fontSize: 12, color: '#8b7fa3', textDecoration: 'line-through' }}>{l.face}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>{l.savings} off</div>
                  <div style={{ fontSize: 12, color: '#9d90b6', marginTop: 4 }}>★ {l.rating} · {l.seller}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function BrowseTicketsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#9d90b6' }}>Loading listings…</div>}>
      <BrowseContent />
    </Suspense>
  );
}
