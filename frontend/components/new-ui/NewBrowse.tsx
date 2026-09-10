'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';

const bri = "'Bricolage Grotesque', system-ui, sans-serif";

// NEW UI accent palette (light-blue theme), keyed by backend category slug.
const ACCENT: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#2563eb', cricket: '#34d399', concert: '#f472b6', event: '#7c3aed',
};
const money = (n: number) => '₹' + n.toLocaleString('en-IN');
const CATS = ['Train', 'Bus', 'IPL', 'Cricket', 'Concert', 'Event'];
const TIME_OPTS = ['Next 6 hours', 'Today', 'Next 3 days', 'Anytime'];

// Mock fallback — used when the API is empty/unreachable (mirrors the classic page).
const MOCK = [
  { id: '1', category: { slug: 'train', name: 'Train' }, title: 'NDLS → BCT', origin_city: 'New Delhi', destination_city: 'Mumbai', asking_price: '1850', original_price: '2450', owner: { name: 'Aarav S.', avg_rating: 4.9 }, expires_at: new Date(Date.now() + 3 * 3.6e6).toISOString() },
  { id: '2', category: { slug: 'ipl', name: 'IPL' }, title: 'MI vs CSK', venue_name: 'Wankhede', venue_city: 'Mumbai', asking_price: '3200', original_price: '4000', owner: { name: 'Priya M.', avg_rating: 4.8 }, expires_at: new Date(Date.now() + 6 * 3.6e6).toISOString() },
  { id: '3', category: { slug: 'concert', name: 'Concert' }, title: 'Diljit Dosanjh Live', venue_name: 'Ambience Arena', venue_city: 'Gurugram', asking_price: '5500', original_price: '7000', owner: { name: 'Rohan K.', avg_rating: 4.7 }, expires_at: new Date(Date.now() + 26 * 3.6e6).toISOString() },
  { id: '4', category: { slug: 'bus', name: 'Bus' }, title: 'Bengaluru → Hyderabad', origin_city: 'Bengaluru', destination_city: 'Hyderabad', asking_price: '899', original_price: '1200', owner: { name: 'Sneha R.', avg_rating: 4.9 }, expires_at: new Date(Date.now() + 5 * 3.6e6).toISOString() },
  { id: '5', category: { slug: 'cricket', name: 'Cricket' }, title: 'IND vs AUS · ODI', venue_name: 'Eden Gardens', venue_city: 'Kolkata', asking_price: '2750', original_price: '3500', owner: { name: 'Vikram J.', avg_rating: 4.6 }, expires_at: new Date(Date.now() + 44 * 3.6e6).toISOString() },
  { id: '6', category: { slug: 'event', name: 'Event' }, title: 'TechSparks Summit', venue_name: 'Jio World Centre', venue_city: 'Mumbai', asking_price: '2100', original_price: '3000', owner: { name: 'Ananya D.', avg_rating: 5.0 }, expires_at: new Date(Date.now() + 8 * 3.6e6).toISOString() },
];

// Map a backend listing object onto the design's card fields.
function decorate(l: any) {
  const slug = l.category?.slug || 'event';
  const accent = ACCENT[slug] || '#7c3aed';
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

// design cardStyle() + urgent modifier.
function cardStyle(urgent: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 22,
    border: '1px solid rgba(15,23,42,.09)',
    background: 'linear-gradient(160deg,#ffffff,#fbfcfe)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: 'inset 0 0 60px rgba(37,99,235,.06), 0 20px 50px rgba(15,23,42,.1)',
    cursor: 'pointer', transition: 'transform .25s ease, border-color .25s ease',
  };
  if (!urgent) return base;
  return { ...base, boxShadow: '0 0 0 1px rgba(225,29,72,.14), 0 10px 28px rgba(225,29,72,.1), 0 18px 44px rgba(15,23,42,.08)', borderColor: 'rgba(225,29,72,.35)' };
}

function urgencyStyle(urgent: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 999, fontSize: 11.5, whiteSpace: 'nowrap',
    border: `1px solid ${urgent ? 'rgba(251,113,133,.45)' : 'rgba(37,99,235,.28)'}`,
    background: urgent ? 'rgba(244,63,94,.14)' : 'rgba(37,99,235,.1)',
    color: urgent ? '#b91c1c' : '#1e40af',
  };
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const label: React.CSSProperties = { fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 10 };

function NewBrowseContent() {
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

  const clearFilters = () => { setFilter('All'); setMaxPrice(8000); };

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 80px' }}>
      <style>{`
        .nb-card:hover { transform: translateY(-6px) !important; border-color: rgba(37,99,235,.5) !important; }
        .nb-reset:hover { background: rgba(37,99,235,.14) !important; color: #0f172a !important; }
      `}</style>

      <h1 style={{ fontFamily: bri, fontWeight: 800, fontSize: 'clamp(30px,4.4vw,46px)', letterSpacing: '-.035em', margin: '0 0 6px', color: '#0f172a' }}>Browse tickets</h1>
      <p style={{ color: '#6b7488', margin: '0 0 28px', fontSize: 15 }}>{visible.length} live listings across India · updated seconds ago</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22, alignItems: 'start' }}>
        {/* Filter sidebar */}
        <aside style={{ position: 'sticky', top: 86, maxWidth: 300, padding: 24, borderRadius: 24, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 60px rgba(37,99,235,.06)' }}>
          <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 16 }}>Filters</div>

          <div style={label}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {['All', ...CATS].map((c) => {
              const active = filter === c;
              return (
                <button key={c} onClick={() => setFilter(c)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', border: `1px solid ${active ? 'rgba(147,197,253,.6)' : 'rgba(37,99,235,.22)'}`, background: active ? 'rgba(37,99,235,.2)' : '#f1f4f8', color: active ? '#ffffff' : '#5b6478' }}>{c}</button>
              );
            })}
          </div>

          <div style={label}>Max price</div>
          <input type="range" min={500} max={8000} step={100} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} style={{ width: '100%', accentColor: '#2563eb' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#6b7488', margin: '6px 0 22px' }}><span>₹500</span><span style={{ color: '#0f172a' }}>{money(maxPrice)}</span></div>

          <div style={label}>Departs within</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIME_OPTS.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#5b6478', cursor: 'pointer' }}><input type="radio" name="within" style={{ accentColor: '#2563eb' }} />{t}</label>
            ))}
          </div>

          <button className="nb-reset" onClick={clearFilters} style={{ width: '100%', marginTop: 22, padding: 11, borderRadius: 12, border: '1px solid rgba(37,99,235,.3)', background: 'transparent', color: '#1e40af', fontSize: 13.5, cursor: 'pointer', transition: 'background .2s ease, color .2s ease' }}>Reset filters</button>
        </aside>

        {/* Results grid */}
        <div style={{ gridColumn: 'span 2', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
          {visible.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '56px 28px', textAlign: 'center', borderRadius: 24, border: '1px dashed rgba(37,99,235,.3)', background: 'linear-gradient(160deg,#ffffff,#fbfcfe)', boxShadow: 'inset 0 0 60px rgba(37,99,235,.06)' }}>
              <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 20, color: '#0f172a', marginBottom: 8 }}>No tickets match your filters</div>
              <p style={{ color: '#6b7488', fontSize: 14.5, margin: '0 0 20px' }}>Try widening your price range or clearing the category filter.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={clearFilters} style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(37,99,235,.3)', background: 'rgba(37,99,235,.14)', color: '#1e40af', fontSize: 13.5, cursor: 'pointer' }}>Reset filters</button>
                <Link href="/post" style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,.55)', background: 'linear-gradient(140deg,#1e40af,#2563eb)', color: '#ffffff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>List a ticket</Link>
              </div>
            </div>
          ) : visible.map((l) => (
            <div key={l.id} className="nb-card" onClick={() => router.push(`/tickets/${l.id}`)} style={cardStyle(l.urgent)}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: l.accent }} />
              <div style={{ position: 'absolute', left: -7, top: '52%', width: 14, height: 14, borderRadius: '50%', background: '#f4f6fb' }} />
              <div style={{ position: 'absolute', right: -7, top: '52%', width: 14, height: 14, borderRadius: '50%', background: '#f4f6fb' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5b6478' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: l.accent }} />{l.category}
                </div>
                <div style={urgencyStyle(l.urgent)}>{l.expires}</div>
              </div>
              <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 19, color: '#0f172a', marginTop: 14, letterSpacing: '-.02em' }}>{l.title}</div>
              <div style={{ fontSize: 13, color: '#6b7488', marginTop: 5 }}>{l.sub}</div>
              <div style={{ margin: '16px 0', height: 1, background: 'repeating-linear-gradient(90deg,rgba(37,99,235,.35) 0 5px,transparent 5px 11px)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 21, color: '#0f172a' }}>{l.price}</div>
                  <div style={{ fontSize: 12, color: '#6b7488', textDecoration: 'line-through' }}>{l.face}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{l.savings} off</div>
                  <div style={{ fontSize: 12, color: '#6b7488', marginTop: 4 }}>★ {l.rating} · {l.seller}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const NewBrowse: React.FC = () => (
  <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#6b7488' }}>Loading listings…</div>}>
    <NewBrowseContent />
  </Suspense>
);

export default NewBrowse;
