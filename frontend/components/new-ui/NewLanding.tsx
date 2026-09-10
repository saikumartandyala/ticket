'use client';

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

const DISPLAY = "'Bricolage Grotesque', sans-serif";

// NEW-UI (light blue) accent per category slug.
const ACCENT: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#2563eb', cricket: '#34d399', concert: '#f472b6', event: '#7c3aed',
};

const money = (n: number) => '₹' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');

const CATEGORIES = ['Train', 'Bus', 'IPL', 'Cricket', 'Concert', 'Event'];

const FLOW = [
  { handle: 'rajdhani.3a', kind: 'Train · Indian Railways', big: 'NDLS→BCT', meta: 'Tonight 20:45 · ₹1,850', accent: '#38bdf8', art: 'linear-gradient(200deg,#0b2a3d,#123b52 40%,#061621)' },
  { handle: 'volvo.sleeper', kind: 'Bus · VRL A/C', big: 'BLR→HYD', meta: 'Tonight 22:15 · ₹899', accent: '#fbbf24', art: 'linear-gradient(200deg,#3a2a08,#5a3f10 40%,#1a1205)' },
  { handle: 'wankhede.north', kind: 'IPL · Wankhede Stadium', big: 'MI vs CSK', meta: 'Sat 19:30 · ₹3,200', accent: '#2563eb', art: 'linear-gradient(200deg,#111f4a,#1e40af 45%,#080f26)' },
  { handle: 'eden.blockd', kind: 'Cricket · Eden Gardens', big: 'IND vs AUS', meta: 'Sun 13:30 · ₹2,750', accent: '#34d399', art: 'linear-gradient(200deg,#08301f,#0f4a30 45%,#04180f)' },
  { handle: 'diljit.gold', kind: 'Concert · Ambience Arena', big: 'Diljit', meta: 'Tonight 20:00 · ₹5,500', accent: '#f472b6', art: 'linear-gradient(200deg,#3f0f2c,#6b1746 45%,#1d0715)' },
  { handle: 'techsparks.pass', kind: 'Event · Jio World Centre', big: 'Summit', meta: 'Tomorrow 09:00 · ₹2,100', accent: '#7c3aed', art: 'linear-gradient(200deg,#241844,#4c2a8f 45%,#0f0a1e)' },
];

// Fallback sample feed (the design's LISTINGS) used when the live request is empty/fails.
const SAMPLE_LISTINGS = [
  { id: 1, category: 'Train', operator: 'Rajdhani Express', title: 'NDLS → BCT', sub: 'Tonight 20:45 · 3A · Seat 42', price: 1850, face: 2450, seller: 'Aarav S.', rating: 4.9, hours: 3 },
  { id: 2, category: 'IPL', operator: 'Wankhede Stadium', title: 'MI vs CSK', sub: 'Sat 19:30 · North Stand · 2 seats', price: 3200, face: 4000, seller: 'Priya M.', rating: 4.8, hours: 6 },
  { id: 3, category: 'Concert', operator: 'Ambience Arena', title: 'Diljit Dosanjh Live', sub: 'Tonight 20:00 · Gold · 1 pass', price: 5500, face: 7000, seller: 'Rohan K.', rating: 4.7, hours: 26 },
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

const FOOTER_COLS = [
  { title: 'Product', items: ['Browse tickets', 'List a ticket', 'Route alerts', 'Pricing'] },
  { title: 'Trust', items: ['Safety guide', 'Community rules', 'Report a user', 'Transfer rules'] },
  { title: 'Company', items: ['About', 'Careers', 'Press', 'Contact'] },
];

// Normalizes both the live API shape and the design's sample shape.
function decorate(l: any) {
  const slug = String(l.category?.slug ?? l.category ?? 'event').toLowerCase();
  const accent = ACCENT[slug] || '#7c3aed';
  const price = parseFloat(l.asking_price ?? l.price);
  const face = parseFloat(l.original_price ?? l.face);
  const hours = l.hours ?? (l.expires_at ? Math.max(1, Math.round((new Date(l.expires_at).getTime() - Date.now()) / 3.6e6)) : 24);
  const urgent = hours <= 6;
  const sub = l.sub || (l.origin_city && l.destination_city
    ? `${l.origin_city} → ${l.destination_city}`
    : `${l.venue_name || ''}${l.venue_city ? ', ' + l.venue_city : ''}`);
  return {
    id: l.id,
    accent,
    category: l.category?.name || (typeof l.category === 'string' ? l.category : 'Ticket'),
    title: l.title,
    sub,
    price: money(price),
    face: money(face),
    savings: face > 0 ? Math.round((1 - price / face) * 100) + '%' : '',
    expires: hours < 24 ? `${hours}h left` : `${Math.round(hours / 24)}d left`,
    rating: l.owner?.avg_rating ?? l.rating ?? '5.0',
    seller: l.owner?.name ?? l.seller ?? 'Seller',
    urgent,
  };
}

type SS = Record<string, string>;
function hover(over: SS, base: SS) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => Object.assign(e.currentTarget.style, over),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => Object.assign(e.currentTarget.style, base),
  };
}

export function NewLanding() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<any[]>(SAMPLE_LISTINGS);
  const [flowIndex, setFlowIndex] = useState(2);
  const [openFaq, setOpenFaq] = useState<number>(0);

  const heroInner = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // Live feed → fall back to the design's sample listings on failure/empty.
  useEffect(() => {
    fetch(`${API_BASE}/listings`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (Array.isArray(data) && data.length) setListings(data.slice(0, 3)); })
      .catch(() => {});
  }, []);

  // Hero 3D mouse-tilt (design's mousemove handler).
  useEffect(() => {
    const el = heroInner.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = (e.clientY / window.innerHeight) * 2 - 1;
      el.style.transform = `rotateY(${mx * 11}deg) rotateX(${-my * 8}deg)`;
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  // Flow carousel drag + horizontal wheel.
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    let downX: number | null = null;
    let lock = 0;
    const move = (d: number) => setFlowIndex((i) => (i + d + FLOW.length) % FLOW.length);
    const down = (e: PointerEvent) => { downX = e.clientX; el.style.cursor = 'grabbing'; };
    const up = (e: PointerEvent) => {
      if (downX == null) return;
      const dx = e.clientX - downX; downX = null; el.style.cursor = 'grab';
      if (Math.abs(dx) > 45) move(dx < 0 ? 1 : -1);
    };
    const wheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!d) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lock < 420) return;
      lock = now; move(d > 0 ? 1 : -1);
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
        <div style={{ animation: 'lmpRise .7s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(37,99,235,.35)', background: 'rgba(37,99,235,.09)', fontSize: 12.5, color: '#1e40af', marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#4ade80', boxShadow: '0 0 10px #4ade80', animation: 'lmpPulse 2s infinite' }} />
            Free to list · Free to search · No commission
          </div>
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(40px,6.4vw,74px)', lineHeight: 1.02, letterSpacing: '-.035em', margin: '0 0 20px', color: '#0f172a' }}>
            Last Minute Tickets.<br />
            <span style={{ background: 'linear-gradient(100deg,#2563eb,#1e40af 45%,#172554)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Real Connections.</span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#5b6478', maxWidth: 520, margin: '0 0 30px' }}>
            Plans changed? Pass your train, bus, IPL or concert ticket to someone who needs it tonight. We connect the two of you directly — no commission, no checkout, no middleman.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10, borderRadius: 20, border: '1px solid rgba(37,99,235,.25)', background: '#ffffff', backdropFilter: 'blur(20px)', boxShadow: '0 0 60px rgba(37,99,235,.08) inset, 0 20px 50px rgba(15,23,42,.12)', maxWidth: 560 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goBrowse()}
              placeholder="Search route, match or artist — e.g. Delhi → Mumbai"
              style={{ flex: '1 1 220px', minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#0f172a', fontSize: 15, padding: '12px 14px' }}
            />
            <button
              onClick={goBrowse}
              style={{ padding: '12px 26px', borderRadius: 14, border: '1px solid rgba(255,255,255,.5)', background: 'linear-gradient(140deg,#2563eb,#1e40af)', color: '#ffffff', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 10px 30px rgba(30,64,175,.5)', transition: 'transform .2s ease, box-shadow .2s ease' }}
              {...hover({ transform: 'translateY(-1px)', boxShadow: '0 14px 38px rgba(37,99,235,.65)' }, { transform: 'translateY(0)', boxShadow: '0 10px 30px rgba(30,64,175,.5)' })}
            >Find tickets</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 20 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/tickets?category=${c.toLowerCase()}`)}
                style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(15,23,42,.1)', background: '#ffffff', color: '#42506b', fontSize: 13, cursor: 'pointer', transition: 'all .2s ease' }}
                {...hover({ borderColor: 'rgba(147,197,253,.6)', color: '#0f172a', background: 'rgba(37,99,235,.14)' }, { borderColor: 'rgba(15,23,42,.1)', color: '#42506b', background: '#ffffff' })}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* 3D floating ticket hero */}
        <div style={{ position: 'relative', height: 'clamp(360px,44vw,520px)', perspective: 1400 }}>
          <div ref={heroInner} style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transition: 'transform .25s ease-out' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 'min(360px,80%)', marginLeft: 'min(-180px,-40%)', marginTop: -115, height: 230, zIndex: 5, transform: 'translateZ(60px) rotateZ(-7deg)', animation: 'lmpDrift 8s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', inset: -30, borderRadius: 40, background: 'radial-gradient(circle,rgba(37,99,235,.3),transparent 65%)', filter: 'blur(28px)' }} />
              <div style={{ position: 'relative', height: '100%', borderRadius: 26, padding: 24, background: 'linear-gradient(150deg,#2563eb,#1e40af 55%,#172554)', border: '1px solid rgba(191,219,254,.45)', backdropFilter: 'blur(16px)', boxShadow: '0 40px 90px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.6), inset 0 -30px 60px rgba(30,64,175,.28)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '.22em', color: '#cfe0fb', textTransform: 'uppercase' }}>Rajdhani Express</div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 27, color: '#ffffff', marginTop: 8, letterSpacing: '-.02em' }}>NDLS → BCT</div>
                  </div>
                  <div style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', fontSize: 11, color: '#ffffff' }}>3A · Seat 42</div>
                </div>
                <div style={{ height: 1, background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.45) 0 6px,transparent 6px 12px)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#cfe0fb' }}>Tonight · 20:45</div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, color: '#ffffff' }}>₹1,850</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#cfe0fb', textDecoration: 'line-through' }}>₹2,450</div>
                    <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>24% below face</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ position: 'absolute', left: '2%', top: '8%', width: 200, height: 120, transform: 'translateZ(-90px) rotateZ(-14deg)', animation: 'lmpDriftB 11s ease-in-out infinite', borderRadius: 18, padding: 16, background: 'linear-gradient(160deg,#1e293b,#0f1a33)', border: '1px solid rgba(37,99,235,.32)', backdropFilter: 'blur(10px)', boxShadow: '0 24px 60px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.35)' }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#b9c9e8', textTransform: 'uppercase' }}>IPL · Wankhede</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: '#ffffff', marginTop: 8 }}>MI vs CSK</div>
              <div style={{ fontSize: 12, color: '#9fb3cc', marginTop: 6 }}>2 seats · ₹3,200</div>
            </div>

            <div style={{ position: 'absolute', right: '0%', bottom: '6%', width: 214, height: 126, transform: 'translateZ(20px) rotateZ(9deg)', animation: 'lmpDrift 9.5s ease-in-out infinite', borderRadius: 18, padding: 16, background: 'linear-gradient(160deg,#1e293b,#0f1a33)', border: '1px solid rgba(37,99,235,.3)', backdropFilter: 'blur(10px)', boxShadow: '0 24px 60px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.4)' }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#b9c9e8', textTransform: 'uppercase' }}>Concert · Gurugram</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: '#ffffff', marginTop: 8 }}>Diljit Dosanjh</div>
              <div style={{ fontSize: 12, color: '#9fb3cc', marginTop: 6 }}>Tonight 8 PM · ₹5,500</div>
            </div>

            <div style={{ position: 'absolute', left: '12%', bottom: '2%', width: 150, height: 150, borderRadius: '50%', border: '1px dashed rgba(37,99,235,.3)', animation: 'lmpSpin 26s linear infinite' }} />
          </div>
        </div>
      </section>

      {/* ============ FLOW CAROUSEL ============ */}
      <section style={{ padding: '36px 0 70px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: 0, color: '#0f172a' }}>Every kind of ticket</h2>
            <p style={{ color: '#6b7488', margin: '8px 0 0', fontSize: 15 }}>Drag, scroll or use the arrows.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => moveFlow(-1)} style={arrowStyle} {...hover({ background: 'rgba(37,99,235,.18)', color: '#0f172a' }, { background: '#ffffff', color: '#1e40af' })}>←</button>
            <button onClick={() => moveFlow(1)} style={arrowStyle} {...hover({ background: 'rgba(37,99,235,.18)', color: '#0f172a' }, { background: '#ffffff', color: '#1e40af' })}>→</button>
          </div>
        </div>

        <div ref={flowRef} style={{ position: 'relative', height: 'clamp(300px,38vw,400px)', perspective: 1600, touchAction: 'pan-y', cursor: 'grab', userSelect: 'none' }}>
          <div style={{ position: 'absolute', left: '50%', bottom: '6%', width: 'min(820px,86vw)', height: 120, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at center, rgba(37,99,235,.16), transparent 70%)', filter: 'blur(34px)' }} />
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
              transform: `translate(-50%,-50%) translateX(${x}%) translateZ(${depth}px) rotateY(${off * -13}deg) scale(${active ? 1 : 0.93 - a * 0.02})`,
              transition: 'transform .6s cubic-bezier(.22,1,.36,1), opacity .6s ease, filter .6s ease',
              opacity: a > 3 ? 0 : active ? 1 : 0.9 - a * 0.05,
              filter: active ? 'none' : 'blur(1.2px)',
              zIndex: 20 - a, cursor: 'pointer', pointerEvents: a > 3 ? 'none' : 'auto',
            };
            const card: CSSProperties = {
              height: '100%', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
              background: 'linear-gradient(165deg,#ffffff,#f6f9ff)',
              border: `1px solid ${active ? 'rgba(37,99,235,.9)' : 'rgba(37,99,235,.22)'}`,
              boxShadow: active
                ? '0 0 0 1px rgba(37,99,235,.35), 0 18px 44px rgba(37,99,235,.22), 0 30px 70px rgba(15,23,42,.14)'
                : '0 14px 34px rgba(15,23,42,.09)',
            };
            return (
              <div key={c.handle} onClick={() => setFlowIndex(i)} style={wrap}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, color: '#0f172a', letterSpacing: '-.02em' }}>{c.handle}</div>
                      <div style={{ fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: '#5b6478', marginTop: 5 }}>{c.kind}</div>
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: 9, background: c.accent, boxShadow: `0 6px 18px ${c.accent}77` }} />
                  </div>
                  <div style={{ position: 'relative', flex: 1, borderRadius: 18, overflow: 'hidden', background: c.art }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(5,3,8,.85))' }} />
                    <div style={{ position: 'absolute', left: 16, bottom: 12, right: 16 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 'clamp(26px,3vw,38px)', color: '#ffffff', letterSpacing: '-.035em', lineHeight: 1 }}>{c.big}</div>
                      <div style={{ fontSize: 12.5, color: '#b9c9e8', marginTop: 7 }}>{c.meta}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 26 }}>
          {FLOW.map((c, i) => (
            <button key={c.handle} onClick={() => setFlowIndex(i)} style={{ width: i === flowIndex ? 26 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all .4s ease', background: i === flowIndex ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : 'rgba(15,23,42,.14)', boxShadow: i === flowIndex ? '0 0 14px rgba(37,99,235,.8)' : 'none' }} />
          ))}
        </div>
      </section>

      {/* ============ LIVE RIGHT NOW ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: 0, color: '#0f172a' }}>Live right now</h2>
            <p style={{ color: '#6b7488', margin: '8px 0 0', fontSize: 15 }}>Tickets expiring in the next few hours.</p>
          </div>
          <button
            onClick={() => router.push('/tickets')}
            style={{ padding: '10px 20px', borderRadius: 999, border: '1px solid rgba(37,99,235,.35)', background: 'rgba(37,99,235,.1)', color: '#1e40af', fontSize: 13.5, cursor: 'pointer', transition: 'all .2s ease' }}
            {...hover({ background: 'rgba(37,99,235,.2)', color: '#0f172a' }, { background: 'rgba(37,99,235,.1)', color: '#1e40af' })}
          >Browse all →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 18 }}>
          {featured.map((l) => (
            <div
              key={l.id}
              onClick={() => router.push(`/tickets/${l.id}`)}
              style={cardStyle(l.urgent)}
              {...hover(
                { transform: 'translateY(-6px)', borderColor: 'rgba(37,99,235,.5)' },
                { transform: 'translateY(0)', borderColor: l.urgent ? 'rgba(225,29,72,.35)' : 'rgba(15,23,42,.09)' },
              )}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: l.accent, opacity: 0.9 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5b6478' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: l.accent }} />{l.category}
                </div>
                <div style={urgencyStyle(l.urgent)}>{l.expires}</div>
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, color: '#0f172a', marginTop: 14, letterSpacing: '-.02em' }}>{l.title}</div>
              <div style={{ fontSize: 13, color: '#6b7488', marginTop: 5 }}>{l.sub}</div>
              <div style={{ margin: '16px 0', height: 1, background: 'repeating-linear-gradient(90deg,rgba(37,99,235,.35) 0 5px,transparent 5px 11px)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, color: '#0f172a' }}>{l.price}</div>
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
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 60px' }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: '0 0 8px', color: '#0f172a' }}>How it works</h2>
        <p style={{ color: '#6b7488', margin: '0 0 28px', fontSize: 15 }}>Three steps. No payment ever passes through us.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {STEPS.map((st) => (
            <div key={st.num} style={{ position: 'relative', padding: '28px 24px', borderRadius: 24, border: '1px solid rgba(15,23,42,.09)', background: 'linear-gradient(160deg,#ffffff,#fbfcfe)', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 0 60px rgba(37,99,235,.06), 0 20px 50px rgba(15,23,42,.09)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.35),transparent 70%)', filter: 'blur(14px)' }} />
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 13, color: '#2563eb', letterSpacing: '.2em' }}>{st.num}</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21, color: '#0f172a', marginTop: 12, letterSpacing: '-.02em' }}>{st.title}</div>
              <p style={{ color: '#5b6478', fontSize: 14.5, lineHeight: 1.6, margin: '10px 0 0' }}>{st.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ BENTO / TRUST ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
          <div style={{ gridColumn: 'span 2', minWidth: 0, padding: 32, borderRadius: 26, border: '1px solid rgba(37,99,235,.24)', background: 'linear-gradient(150deg,#edf3ff,#ffffff)', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 80px rgba(37,99,235,.08), 0 24px 60px rgba(15,23,42,.1)' }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: '#0f172a', letterSpacing: '-.02em' }}>Zero commission. Forever.</div>
            <p style={{ color: '#5b6478', fontSize: 15, lineHeight: 1.65, margin: '12px 0 0', maxWidth: 540 }}>We never touch the money. Listing is free, searching is free, and you settle directly with the other person over UPI or cash — exactly like you would with a friend.</p>
          </div>
          {BENTO.map((b) => (
            <div key={b.title} style={{ padding: 26, borderRadius: 26, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 50px rgba(37,99,235,.05)' }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: '#0f172a' }}>{b.title}</div>
              <p style={{ color: '#6b7488', fontSize: 14, lineHeight: 1.6, margin: '9px 0 0' }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 80px' }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-.03em', margin: '0 0 24px', color: '#0f172a' }}>Questions, answered</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div
                key={f.q}
                onClick={() => setOpenFaq(open ? -1 : i)}
                style={{ padding: '20px 22px', borderRadius: 18, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff', cursor: 'pointer', transition: 'border-color .2s ease' }}
                {...hover({ borderColor: 'rgba(147,197,253,.6)' }, { borderColor: 'rgba(15,23,42,.09)' })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16.5, color: '#0f172a' }}>{f.q}</span>
                  <span style={{ color: '#2563eb', fontSize: 20, lineHeight: 1 }}>{open ? '−' : '+'}</span>
                </div>
                {open && <p style={{ color: '#5b6478', fontSize: 14.5, lineHeight: 1.65, margin: '12px 0 0' }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{ borderTop: '1px solid rgba(15,23,42,.08)', background: 'rgba(248,250,253,.85)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '44px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 28 }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, color: '#0f172a' }}>LastMinutePass</div>
            <p style={{ color: '#6b7488', fontSize: 13.5, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 260 }}>A connection layer for unused tickets in India. We are not a ticketing agent and we do not process payments.</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 12 }}>{col.title}</div>
              {col.items.map((it) => (
                <div key={it} style={{ fontSize: 14, color: '#6b7488', padding: '5px 0', cursor: 'pointer', transition: 'color .2s ease' }} {...hover({ color: '#0f172a' }, { color: '#6b7488' })}>{it}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '18px 20px', textAlign: 'center', color: '#5b6478', fontSize: 12.5 }}>© 2026 LastMinutePass · Made in India</div>
      </footer>
    </div>
  );
}

const arrowStyle: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: '1px solid rgba(37,99,235,.3)', background: '#ffffff', color: '#1e40af', fontSize: 17, cursor: 'pointer', transition: 'all .2s ease' };

function cardStyle(urgent: boolean): CSSProperties {
  return {
    position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 22,
    border: `1px solid ${urgent ? 'rgba(225,29,72,.35)' : 'rgba(15,23,42,.09)'}`,
    background: 'linear-gradient(160deg,#ffffff,#fbfcfe)', backdropFilter: 'blur(16px)',
    boxShadow: urgent
      ? '0 0 0 1px rgba(225,29,72,.14), 0 10px 28px rgba(225,29,72,.1), 0 18px 44px rgba(15,23,42,.08)'
      : 'inset 0 0 60px rgba(37,99,235,.06), 0 20px 50px rgba(15,23,42,.1)',
    cursor: 'pointer', transition: 'transform .25s ease, border-color .25s ease',
  };
}

function urgencyStyle(urgent: boolean): CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 999, fontSize: 11.5, whiteSpace: 'nowrap',
    border: `1px solid ${urgent ? 'rgba(251,113,133,.45)' : 'rgba(37,99,235,.28)'}`,
    background: urgent ? 'rgba(244,63,94,.14)' : 'rgba(37,99,235,.1)',
    color: urgent ? '#b91c1c' : '#1e40af',
  };
}

export default NewLanding;
