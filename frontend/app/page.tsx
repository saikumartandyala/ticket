'use client';

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../lib/api';
import { useTilt } from '../lib/useTilt';
import { useUiStore } from '../store/uiStore';
import { NewLanding } from '../components/new-ui/NewLanding';

const ACCENT: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#a855f7', cricket: '#34d399', concert: '#f472b6', event: '#c084fc',
};
const money = (n: number) => '₹' + n.toLocaleString('en-IN');

const CATEGORIES = ['Train', 'Bus', 'IPL', 'Cricket', 'Concert', 'Event'];

const FLOW = [
  { handle: 'rajdhani.3a', kind: 'Train · Indian Railways', big: 'NDLS→BCT', meta: 'Tonight 20:45 · ₹1,850', accent: '#38bdf8', art: 'linear-gradient(200deg,#0b2a3d,#123b52 40%,#061621)' },
  { handle: 'volvo.sleeper', kind: 'Bus · VRL A/C', big: 'BLR→HYD', meta: 'Tonight 22:15 · ₹899', accent: '#fbbf24', art: 'linear-gradient(200deg,#3a2a08,#5a3f10 40%,#1a1205)' },
  { handle: 'wankhede.north', kind: 'IPL · Wankhede Stadium', big: 'MI vs CSK', meta: 'Sat 19:30 · ₹3,200', accent: '#a855f7', art: 'linear-gradient(200deg,#2c1450,#4c1d95 45%,#150a26)' },
  { handle: 'eden.blockd', kind: 'Cricket · Eden Gardens', big: 'IND vs AUS', meta: 'Sun 13:30 · ₹2,750', accent: '#34d399', art: 'linear-gradient(200deg,#08301f,#0f4a30 45%,#04180f)' },
  { handle: 'diljit.gold', kind: 'Concert · Ambience Arena', big: 'Diljit', meta: 'Tonight 20:00 · ₹5,500', accent: '#f472b6', art: 'linear-gradient(200deg,#3f0f2c,#6b1746 45%,#1d0715)' },
  { handle: 'techsparks.pass', kind: 'Event · Jio World Centre', big: 'Summit', meta: 'Tomorrow 09:00 · ₹2,100', accent: '#c084fc', art: 'linear-gradient(200deg,#2a1a45,#3f2a6b 45%,#130c22)' },
];

const MOCK_LISTINGS = [
  { id: '1', category: { slug: 'train', name: 'Train' }, title: 'NDLS → BCT', sub: 'Tonight 20:45 · 3A · Seat 42', asking_price: '1850', original_price: '2450', owner: { name: 'Aarav S.', avg_rating: 4.9 }, hours: 3 },
  { id: '2', category: { slug: 'ipl', name: 'IPL' }, title: 'MI vs CSK', sub: 'Sat 19:30 · North Stand · 2 seats', asking_price: '3200', original_price: '4000', owner: { name: 'Priya M.', avg_rating: 4.8 }, hours: 6 },
  { id: '3', category: { slug: 'concert', name: 'Concert' }, title: 'Diljit Dosanjh Live', sub: 'Tonight 20:00 · Gold · 1 pass', asking_price: '5500', original_price: '7000', owner: { name: 'Rohan K.', avg_rating: 4.7 }, hours: 26 },
];

const STEPS = [
  { num: 'STEP 01', title: 'List in 40 seconds', body: 'Pick a category, drop the route or event, set your asking price. No verification queue, no fees.' },
  { num: 'STEP 02', title: 'Get matched instantly', body: 'Seekers watching that route or event get a live alert the moment your listing goes up.' },
  { num: 'STEP 03', title: 'Talk and transfer', body: 'Chat opens, contact is revealed, and you settle it directly — UPI, cash, whatever suits you both.' },
];

const BENTO = [
  { title: 'Verified identity', body: 'Email plus phone verification on every profile, with a public transfer history.' },
  { title: 'Urgency-aware feed', body: 'Listings glow and rank higher as departure approaches, so nothing goes to waste.' },
  { title: 'Route alerts', body: 'Save a route or artist and get pinged the second a matching ticket appears.' },
  { title: 'Rated on both sides', body: 'Transferors and seekers rate each other after every completed handover.' },
];

const FAQS = [
  { q: 'Do you take a cut of the ticket price?', a: 'No. Listing and searching are free and we never process the payment. You settle directly with the other person.' },
  { q: 'Is it legal to transfer my ticket?', a: 'It depends on the operator or venue. We show the transfer rules for each category and ask both parties to confirm them before meeting.' },
  { q: 'How do I know the other person is real?', a: 'Every account is email and phone verified, carries a public rating and shows the number of completed transfers.' },
  { q: 'What if the transfer falls through?', a: 'Reopen the listing with one tap and rate the experience. Repeated no-shows lose their ability to list.' },
];

function decorate(l: any) {
  const slug = l.category?.slug || 'event';
  const accent = ACCENT[slug] || '#c084fc';
  const price = parseFloat(l.asking_price);
  const face = parseFloat(l.original_price);
  const hours = l.hours ?? Math.max(1, Math.round((new Date(l.expires_at).getTime() - Date.now()) / 3.6e6));
  const urgent = hours <= 6;
  const sub = l.sub || (l.origin_city && l.destination_city ? `${l.origin_city} → ${l.destination_city}` : `${l.venue_name || ''}${l.venue_city ? ', ' + l.venue_city : ''}`);
  return {
    id: l.id,
    accent,
    category: l.category?.name || 'Ticket',
    title: l.title,
    sub,
    price: money(price),
    face: money(face),
    savings: face > 0 ? Math.round((1 - price / face) * 100) + '%' : '',
    expires: hours < 24 ? `${hours}h left` : `${Math.round(hours / 24)}d left`,
    rating: l.owner?.avg_rating || '5.0',
    seller: l.owner?.name || 'Seller',
    urgent,
  };
}

function ClassicLanding() {
  const router = useRouter();
  const heroInner = useTilt<HTMLDivElement>(11, 8);

  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<any[]>(MOCK_LISTINGS);
  const [flowIndex, setFlowIndex] = useState(2);
  const [openFaq, setOpenFaq] = useState<number>(0);

  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/listings`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (Array.isArray(data) && data.length) setListings(data.slice(0, 3)); })
      .catch(() => {});
  }, []);

  // Flow carousel drag + wheel
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    let downX: number | null = null;
    let lock = 0;
    const moveFlow = (d: number) => setFlowIndex((i) => (i + d + FLOW.length) % FLOW.length);
    const down = (e: PointerEvent) => { downX = e.clientX; el.style.cursor = 'grabbing'; };
    const up = (e: PointerEvent) => {
      if (downX == null) return;
      const dx = e.clientX - downX; downX = null; el.style.cursor = 'grab';
      if (Math.abs(dx) > 45) moveFlow(dx < 0 ? 1 : -1);
    };
    const wheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!d) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lock < 420) return;
      lock = now; moveFlow(d > 0 ? 1 : -1);
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, []);

  const moveFlow = (d: number) => setFlowIndex((i) => (i + d + FLOW.length) % FLOW.length);
  const goBrowse = () => router.push(query ? `/tickets?query=${encodeURIComponent(query)}` : '/tickets');
  const featured = listings.map(decorate);

  return (
    <div>
      {/* ============ HERO ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 20px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 48, alignItems: 'center' }}>
        <div className="anim-rise">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(168,85,247,.35)', background: 'rgba(168,85,247,.09)', fontSize: 12.5, color: '#d8c9ff', marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} className="anim-pulse" />
            Free to list · Free to search · No commission
          </div>
          <h1 className="font-display" style={{ fontWeight: 800, fontSize: 'clamp(40px,6.4vw,74px)', lineHeight: 1.02, letterSpacing: '-.035em', margin: '0 0 20px', color: '#fff' }}>
            Last Minute Tickets.<br />
            <span style={{ background: 'linear-gradient(100deg,#c084fc,#a855f7 45%,#7c3aed)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Real Connections.</span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#a99cc0', maxWidth: 520, margin: '0 0 30px' }}>
            Plans changed? Pass your train, bus, IPL or concert ticket to someone who needs it tonight. We connect the two of you directly — no commission, no checkout, no middleman.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10, borderRadius: 20, border: '1px solid rgba(168,85,247,.25)', background: 'rgba(255,255,255,.045)', backdropFilter: 'blur(20px)', boxShadow: '0 0 60px rgba(124,58,237,.22) inset, 0 20px 50px rgba(0,0,0,.5)', maxWidth: 560 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goBrowse()}
              placeholder="Search route, match or artist — e.g. Delhi → Mumbai"
              style={{ flex: '1 1 220px', minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, padding: '12px 14px' }}
            />
            <button onClick={goBrowse} className="btn-violet" style={{ padding: '12px 26px', fontSize: 14.5 }}>Find tickets</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 20 }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => router.push(`/tickets?category=${c.toLowerCase()}`)} className="cat-pill" style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(168,85,247,.22)', background: 'rgba(255,255,255,.04)', color: '#cbbfe0', fontSize: 13, cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
        </div>

        {/* 3D floating ticket hero */}
        <div style={{ position: 'relative', height: 'clamp(360px,44vw,520px)', perspective: 1400 }}>
          <div ref={heroInner} style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transition: 'transform .25s ease-out' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 'min(360px,80%)', marginLeft: 'min(-180px,-40%)', marginTop: -115, height: 230, transform: 'translateZ(60px) rotateZ(-7deg)', animation: 'lmpDrift 8s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', inset: -30, borderRadius: 40, background: 'radial-gradient(circle,rgba(168,85,247,.5),transparent 65%)', filter: 'blur(28px)' }} />
              <div style={{ position: 'relative', height: '100%', borderRadius: 26, padding: 24, background: 'linear-gradient(150deg,rgba(192,132,252,.28),rgba(124,58,237,.14) 45%,rgba(255,255,255,.05))', border: '1px solid rgba(214,188,255,.45)', backdropFilter: 'blur(16px)', boxShadow: '0 40px 90px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.6), inset 0 -30px 60px rgba(124,58,237,.28)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '.22em', color: '#d9c8ff', textTransform: 'uppercase' }}>Rajdhani Express</div>
                    <div className="font-display" style={{ fontWeight: 700, fontSize: 27, color: '#fff', marginTop: 8, letterSpacing: '-.02em' }}>NDLS → BCT</div>
                  </div>
                  <div style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', fontSize: 11, color: '#fff' }}>3A · Seat 42</div>
                </div>
                <div className="ticket-divider-bright" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#c9b6f0' }}>Tonight · 20:45</div>
                    <div className="font-display" style={{ fontWeight: 700, fontSize: 24, color: '#fff' }}>₹1,850</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#c9b6f0', textDecoration: 'line-through' }}>₹2,450</div>
                    <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>24% below face</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ position: 'absolute', left: '2%', top: '8%', width: 200, height: 120, transform: 'translateZ(-90px) rotateZ(-14deg)', animation: 'lmpDriftB 11s ease-in-out infinite', borderRadius: 18, padding: 16, background: 'linear-gradient(150deg,rgba(255,255,255,.1),rgba(124,58,237,.1))', border: '1px solid rgba(168,85,247,.32)', backdropFilter: 'blur(10px)', boxShadow: '0 24px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.35)' }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#c4b1e8', textTransform: 'uppercase' }}>IPL · Wankhede</div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 8 }}>MI vs CSK</div>
              <div style={{ fontSize: 12, color: '#9d90b6', marginTop: 6 }}>2 seats · ₹3,200</div>
            </div>

            <div style={{ position: 'absolute', right: '0%', bottom: '6%', width: 214, height: 126, transform: 'translateZ(20px) rotateZ(9deg)', animation: 'lmpDrift 9.5s ease-in-out infinite', borderRadius: 18, padding: 16, background: 'linear-gradient(150deg,rgba(255,255,255,.12),rgba(168,85,247,.12))', border: '1px solid rgba(192,132,252,.38)', backdropFilter: 'blur(10px)', boxShadow: '0 24px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.4)' }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#c4b1e8', textTransform: 'uppercase' }}>Concert · Gurugram</div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 8 }}>Diljit Dosanjh</div>
              <div style={{ fontSize: 12, color: '#9d90b6', marginTop: 6 }}>Tonight 8 PM · ₹5,500</div>
            </div>

            <div style={{ position: 'absolute', left: '12%', bottom: '2%', width: 150, height: 150, borderRadius: '50%', border: '1px dashed rgba(168,85,247,.3)', animation: 'lmpSpin 26s linear infinite' }} />
          </div>
        </div>
      </section>

      {/* ============ FLOW CAROUSEL ============ */}
      <section style={{ padding: '36px 0 70px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 className="font-display" style={{ fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: 0, color: '#fff' }}>Every kind of ticket</h2>
            <p style={{ color: '#9d90b6', margin: '8px 0 0', fontSize: 15 }}>Drag, scroll or use the arrows.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => moveFlow(-1)} className="flow-arrow" style={arrowStyle}>←</button>
            <button onClick={() => moveFlow(1)} className="flow-arrow" style={arrowStyle}>→</button>
          </div>
        </div>

        <div ref={flowRef} style={{ position: 'relative', height: 'clamp(300px,38vw,400px)', perspective: 1600, touchAction: 'pan-y', cursor: 'grab', userSelect: 'none' }}>
          <div style={{ position: 'absolute', left: '50%', bottom: '6%', width: 'min(820px,86vw)', height: 120, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at center, rgba(124,58,237,.35), transparent 70%)', filter: 'blur(34px)' }} />
          {FLOW.map((c, i) => {
            const n = FLOW.length;
            let off = i - flowIndex;
            if (off > n / 2) off -= n;
            if (off < -n / 2) off += n;
            const active = off === 0;
            const a = Math.abs(off);
            const depth = -Math.min(a, 3) * 190;
            const x = off * (a > 2 ? 58 : 68);
            const wrap: CSSProperties = {
              position: 'absolute', left: '50%', top: '50%', width: 'min(320px,74vw)', height: 'clamp(250px,32vw,330px)',
              transform: `translate(-50%,-50%) translateX(${x}%) translateZ(${depth}px) rotateY(${off * -13}deg) scale(${active ? 1 : 0.96})`,
              transition: 'transform .6s cubic-bezier(.22,1,.36,1), opacity .6s ease, filter .6s ease',
              opacity: a > 3 ? 0 : active ? 1 : 0.6 - a * 0.1,
              filter: active ? 'none' : 'brightness(.42) saturate(.5)',
              zIndex: 20 - a, cursor: 'pointer', pointerEvents: a > 3 ? 'none' : 'auto',
            };
            const card: CSSProperties = {
              height: '100%', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
              background: 'linear-gradient(165deg,#120a1d,#08050e)',
              border: `1px solid ${active ? 'rgba(192,132,252,.85)' : 'rgba(168,85,247,.22)'}`,
              boxShadow: active ? '0 0 0 1px rgba(168,85,247,.5), 0 0 60px rgba(168,85,247,.55), 0 40px 90px rgba(0,0,0,.75)' : '0 26px 60px rgba(0,0,0,.6)',
            };
            return (
              <div key={c.handle} onClick={() => setFlowIndex(i)} style={wrap}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div className="font-display" style={{ fontWeight: 600, fontSize: 19, color: '#fff', letterSpacing: '-.02em' }}>{c.handle}</div>
                      <div style={{ fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: '#a99cc0', marginTop: 5 }}>{c.kind}</div>
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: 9, background: c.accent, boxShadow: `0 6px 18px ${c.accent}77` }} />
                  </div>
                  <div style={{ position: 'relative', flex: 1, borderRadius: 18, overflow: 'hidden', background: c.art }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(5,3,8,.85))' }} />
                    <div style={{ position: 'absolute', left: 16, bottom: 12, right: 16 }}>
                      <div className="font-display" style={{ fontWeight: 800, fontSize: 'clamp(26px,3vw,38px)', color: '#fff', letterSpacing: '-.035em', lineHeight: 1 }}>{c.big}</div>
                      <div style={{ fontSize: 12.5, color: '#c9b8e8', marginTop: 7 }}>{c.meta}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 26 }}>
          {FLOW.map((c, i) => (
            <button key={c.handle} onClick={() => setFlowIndex(i)} style={{ width: i === flowIndex ? 26 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all .4s ease', background: i === flowIndex ? 'linear-gradient(90deg,#a855f7,#c084fc)' : 'rgba(255,255,255,.16)', boxShadow: i === flowIndex ? '0 0 14px rgba(168,85,247,.8)' : 'none' }} />
          ))}
        </div>
      </section>

      {/* ============ LIVE RIGHT NOW ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h2 className="font-display" style={{ fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: 0, color: '#fff' }}>Live right now</h2>
            <p style={{ color: '#9d90b6', margin: '8px 0 0', fontSize: 15 }}>Tickets expiring in the next few hours.</p>
          </div>
          <button onClick={() => router.push('/tickets')} className="btn-ghost" style={{ padding: '10px 20px', fontSize: 13.5 }}>Browse all →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 18 }}>
          {featured.map((l) => (
            <div key={l.id} onClick={() => router.push(`/tickets/${l.id}`)} className="ticket-card" style={l.urgent ? { boxShadow: 'inset 0 0 70px rgba(251,113,133,.14), 0 0 34px rgba(244,63,94,.22), 0 20px 50px rgba(0,0,0,.45)' } : undefined}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: l.accent, opacity: 0.9 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c4b1e8' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: l.accent }} />{l.category}
                </div>
                <div style={urgencyStyle(l.urgent)}>{l.expires}</div>
              </div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginTop: 14, letterSpacing: '-.02em' }}>{l.title}</div>
              <div style={{ fontSize: 13, color: '#9d90b6', marginTop: 5 }}>{l.sub}</div>
              <div className="ticket-divider" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 22, color: '#fff' }}>{l.price}</div>
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
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 60px' }}>
        <h2 className="font-display" style={{ fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: '0 0 8px', color: '#fff' }}>How it works</h2>
        <p style={{ color: '#9d90b6', margin: '0 0 28px', fontSize: 15 }}>Three steps. No payment ever passes through us.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {STEPS.map((st) => (
            <div key={st.num} style={{ position: 'relative', padding: '28px 24px', borderRadius: 24, border: '1px solid rgba(168,85,247,.2)', background: 'linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 0 60px rgba(124,58,237,.16), 0 20px 50px rgba(0,0,0,.4)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,85,247,.35),transparent 70%)', filter: 'blur(14px)' }} />
              <div className="font-display" style={{ fontWeight: 800, fontSize: 13, color: '#c084fc', letterSpacing: '.2em' }}>{st.num}</div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 21, color: '#fff', marginTop: 12, letterSpacing: '-.02em' }}>{st.title}</div>
              <p style={{ color: '#a396bb', fontSize: 14.5, lineHeight: 1.6, margin: '10px 0 0' }}>{st.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ BENTO ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
          <div style={{ gridColumn: 'span 2', minWidth: 0, padding: 32, borderRadius: 26, border: '1px solid rgba(192,132,252,.3)', background: 'linear-gradient(150deg,rgba(168,85,247,.16),rgba(255,255,255,.03))', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 80px rgba(124,58,237,.22), 0 24px 60px rgba(0,0,0,.45)' }}>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: '-.02em' }}>Zero commission. Forever.</div>
            <p style={{ color: '#a396bb', fontSize: 15, lineHeight: 1.65, margin: '12px 0 0', maxWidth: 540 }}>We never touch the money. Listing is free, searching is free, and you settle directly with the other person over UPI or cash — exactly like you would with a friend.</p>
          </div>
          {BENTO.map((b) => (
            <div key={b.title} style={{ padding: 26, borderRadius: 26, border: '1px solid rgba(168,85,247,.18)', background: 'rgba(255,255,255,.035)', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 50px rgba(124,58,237,.13)' }}>
              <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>{b.title}</div>
              <p style={{ color: '#9d90b6', fontSize: 14, lineHeight: 1.6, margin: '9px 0 0' }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 80px' }}>
        <h2 className="font-display" style={{ fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: '0 0 24px', color: '#fff' }}>Questions, answered</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q} onClick={() => setOpenFaq(open ? -1 : i)} style={{ padding: '20px 22px', borderRadius: 18, border: '1px solid rgba(168,85,247,.18)', background: 'rgba(255,255,255,.035)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <span className="font-display" style={{ fontWeight: 600, fontSize: 16.5, color: '#fff' }}>{f.q}</span>
                  <span style={{ color: '#c084fc', fontSize: 20, lineHeight: 1 }}>{open ? '−' : '+'}</span>
                </div>
                {open && <p style={{ color: '#a396bb', fontSize: 14.5, lineHeight: 1.65, margin: '12px 0 0' }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{ borderTop: '1px solid rgba(168,85,247,.16)', background: 'rgba(8,5,14,.6)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '44px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 28 }}>
          <div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>LastMinutePass</div>
            <p style={{ color: '#8b7fa3', fontSize: 13.5, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 260 }}>A connection layer for unused tickets in India. We are not a ticketing agent and we do not process payments.</p>
          </div>
          {[
            { title: 'Product', items: ['Browse tickets', 'List a ticket', 'Route alerts', 'Pricing'] },
            { title: 'Trust', items: ['Safety guide', 'Community rules', 'Report a user', 'Transfer rules'] },
            { title: 'Company', items: ['About', 'Careers', 'Press', 'Contact'] },
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 12 }}>{col.title}</div>
              {col.items.map((it) => (
                <div key={it} style={{ fontSize: 14, color: '#9d90b6', padding: '5px 0', cursor: 'pointer' }}>{it}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '18px 20px', textAlign: 'center', color: '#6f6485', fontSize: 12.5 }}>© 2026 LastMinutePass · Made in India</div>
      </footer>
    </div>
  );
}

export default function Page() {
  const mode = useUiStore((s) => s.mode);
  return mode === 'new' ? <NewLanding /> : <ClassicLanding />;
}

const arrowStyle: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: '1px solid rgba(168,85,247,.3)', background: 'rgba(255,255,255,.04)', color: '#d8c9ff', fontSize: 17, cursor: 'pointer' };
function urgencyStyle(urgent: boolean): CSSProperties {
  return { padding: '5px 10px', borderRadius: 999, fontSize: 11.5, whiteSpace: 'nowrap', border: `1px solid ${urgent ? 'rgba(251,113,133,.45)' : 'rgba(168,85,247,.28)'}`, background: urgent ? 'rgba(244,63,94,.14)' : 'rgba(168,85,247,.1)', color: urgent ? '#fda4af' : '#c9b8e8' };
}
