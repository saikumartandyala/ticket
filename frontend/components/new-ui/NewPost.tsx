'use client';

import React, { useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { API_BASE } from '../../lib/api';

const bri = "'Bricolage Grotesque', system-ui, sans-serif";

// NEW-UI accent palette (from the design's ACCENT map — note IPL/Event differ from classic).
const ACCENT: Record<string, string> = {
  Train: '#38bdf8', Bus: '#fbbf24', IPL: '#2563eb', Cricket: '#34d399', Concert: '#f472b6', Event: '#7c3aed',
};
const CAT_ID: Record<string, number> = { Train: 1, Bus: 2, IPL: 3, Cricket: 4, Concert: 5, Event: 6 };
// [label, hint, icon path d] — the design's exact category SVG stroke icons.
const CAT_CARDS: [string, string, string][] = [
  ['Train', 'PNR or e-ticket', 'M5 15V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Zm0-6h14M9 21l1.5-2m4.5 2-1.5-2M9.5 13h.01m4.99 0h.01'],
  ['Bus', 'Seat or sleeper', 'M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16h16M4 16v2h3v-2m10 0v2h3v-2M6 8h12v4H6zM7.5 19.5h.01m8.99 0h.01'],
  ['IPL', 'Stadium entry', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-6.4 2.6c2 1.4 3.2 3.7 3.2 6.4s-1.2 5-3.2 6.4m12.8-12.8c-2 1.4-3.2 3.7-3.2 6.4s1.2 5 3.2 6.4'],
  ['Cricket', 'Intl. or domestic', 'M15.5 4.5 19.5 8.5M14 6l4 4M5.5 18.5 13 11m-7.5 7.5-1.5 3 3-1.5M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  ['Concert', 'Live music pass', 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM9 9l10-2'],
  ['Event', 'Conference, expo', 'M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3.5 7.5h.01M12 13.5h.01m3.49 0h.01M8.5 17h.01M12 17h.01'],
];

const inputBase: CSSProperties = {
  width: '100%', padding: '14px 15px', borderRadius: 14, border: '1px solid rgba(37,99,235,.28)',
  background: '#f6f8fd', color: '#0f172a', fontSize: 14.5, outline: 'none',
  transition: 'border-color .2s ease, box-shadow .2s ease',
};
const focusIn = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = '#2563eb';
  e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.2)';
};
const focusOut = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'rgba(37,99,235,.28)';
  e.target.style.boxShadow = 'none';
};

export const NewPost: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();

  const [postStep, setPostStep] = useState(0);
  const [category, setCategory] = useState('Train');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  // form fields
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [datetime, setDatetime] = useState('');
  const [seat, setSeat] = useState('');
  const [face, setFace] = useState('');
  const [asking, setAsking] = useState('');
  const [operator, setOperator] = useState('');

  const isRoute = category === 'Train' || category === 'Bus';

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API_BASE}/listings/upload-photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { setError('Photo upload failed.'); return; }
      const data = await res.json(); setPhotoUrl(data.url);
    } catch { setError('Could not reach the server to upload.'); }
    finally { setUploading(false); }
  };

  const publish = async () => {
    if (!isAuthenticated) { router.push('/auth'); return; }
    setLoading(true); setError('');
    const title = isRoute ? `${from} → ${to}` : (operator || from || 'Ticket');
    const eventDate = new Date(Date.now() + 3 * 3.6e6).toISOString().slice(0, 10); // fallback today+ if not parseable
    const payload: any = {
      category_id: CAT_ID[category],
      title,
      origin_city: isRoute ? from || null : null,
      destination_city: isRoute ? to || null : null,
      event_name: !isRoute ? (from || null) : null,
      venue_name: !isRoute ? (operator || null) : null,
      operator_name: isRoute ? (operator || null) : null,
      event_date: eventDate,
      seat_details: { seat },
      original_price: parseFloat(face) || 0,
      asking_price: parseFloat(asking) || 0,
      ticket_photos: photoUrl ? [photoUrl] : [],
      description: datetime || null,
    };
    try {
      const res = await fetch(`${API_BASE}/listings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (res.ok) { router.push('/dashboard'); }
      else {
        const d = await res.json().catch(() => null);
        const det = d?.detail;
        setError(typeof det === 'string' ? det : Array.isArray(det) && det[0]?.msg ? det[0].msg : 'Could not publish. Please check your details.');
      }
    } catch { setError('Could not reach the server.'); }
    finally { setLoading(false); }
  };

  const next = () => { setError(''); if (postStep < 2) setPostStep(postStep + 1); else publish(); };
  const back = () => { setError(''); setPostStep(Math.max(0, postStep - 1)); };

  const fields: [string, string, string, (v: string) => void, string][] = isRoute
    ? [['From', 'New Delhi (NDLS)', from, setFrom, 'text'], ['To', 'Mumbai Central (BCT)', to, setTo, 'text'], ['Operator', 'Rajdhani Express', operator, setOperator, 'text'], ['Date & time', 'Tonight · 20:45', datetime, setDatetime, 'text'], ['Class / seat', '3A · Seat 42', seat, setSeat, 'text'], ['Face value', '2450', face, setFace, 'number'], ['Your asking price', '1850', asking, setAsking, 'number']]
    : [['Event name', 'MI vs CSK', from, setFrom, 'text'], ['Venue', 'Wankhede Stadium', operator, setOperator, 'text'], ['Date & time', 'Sat · 19:30', datetime, setDatetime, 'text'], ['Section / seat', 'North Stand · 2', seat, setSeat, 'text'], ['Face value', '4000', face, setFace, 'number'], ['Your asking price', '3200', asking, setAsking, 'number']];

  return (
    <section style={{ maxWidth: 920, margin: '0 auto', padding: '40px 20px 80px' }}>
      <h1 style={{ fontFamily: bri, fontWeight: 800, fontSize: 'clamp(30px,4.4vw,44px)', letterSpacing: '-.035em', margin: '0 0 6px', color: '#0f172a' }}>List your ticket</h1>
      <p style={{ color: '#6b7488', margin: '0 0 28px', fontSize: 15 }}>Free, always. Takes about 40 seconds.</p>

      {/* step pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 30, flexWrap: 'wrap' }}>
        {['1 · Category', '2 · Details', '3 · Review'].map((label, i) => {
          const done = i <= postStep;
          return <div key={label} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 13, border: `1px solid ${done ? 'rgba(37,99,235,.55)' : 'rgba(37,99,235,.18)'}`, background: done ? 'rgba(37,99,235,.16)' : '#f2f5f9', color: done ? '#1e40af' : '#6b7488' }}>{label}</div>;
        })}
      </div>

      {error && <div style={{ marginBottom: 20, padding: '12px 16px', fontSize: 13, background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)', color: '#b91c1c', borderRadius: 14 }}>{error}</div>}

      {/* Step 0: category */}
      {postStep === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
          {CAT_CARDS.map(([label, hint, icon]) => {
            const selected = category === label;
            return (
              <div key={label} onClick={() => setCategory(label)} style={{ padding: 24, borderRadius: 22, cursor: 'pointer', border: `1px solid ${selected ? ACCENT[label] + '80' : 'rgba(15,23,42,.09)'}`, background: 'linear-gradient(160deg,#ffffff,#fbfcfe)', backdropFilter: 'blur(14px)', boxShadow: selected ? `inset 0 0 60px ${ACCENT[label]}14, 0 18px 44px ${ACCENT[label]}33` : 'inset 0 0 60px rgba(37,99,235,.06), 0 18px 44px rgba(15,23,42,.1)', transition: 'transform .25s ease', transformStyle: 'preserve-3d' }}>
                <div style={{ width: 46, height: 46, borderRadius: 999, background: ACCENT[label] + '14', border: `1px solid ${ACCENT[label] + '38'}`, display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={ACCENT[label]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon} />
                  </svg>
                </div>
                <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 18, color: '#0f172a', marginTop: 16 }}>{label}</div>
                <div style={{ fontSize: 12.5, color: '#6b7488', marginTop: 5 }}>{hint}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1: details */}
      {postStep === 1 && (
        <div style={{ padding: 28, borderRadius: 26, border: '1px solid rgba(15,23,42,.1)', background: '#ffffff', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 70px rgba(37,99,235,.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          {fields.map(([label, ph, val, setter, type]) => (
            <div key={label}>
              <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 8 }}>{label}</div>
              <input type={type} placeholder={ph} value={val} onChange={(e) => setter(e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputBase} />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 8 }}>Ticket screenshot (optional)</div>
            {photoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#15803d' }}>✓ Uploaded <button onClick={() => setPhotoUrl('')} style={{ background: 'transparent', border: 'none', color: '#e11d48', cursor: 'pointer', fontSize: 12 }}>Remove</button></div>
            ) : (
              <label style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 12, border: '1px dashed rgba(37,99,235,.4)', color: '#1e40af', fontSize: 13, cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : 'Click to upload · max 5MB'}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Step 2: review */}
      {postStep === 2 && (
        <div style={{ padding: 30, borderRadius: 26, border: '1px solid rgba(37,99,235,.28)', background: 'linear-gradient(150deg,#2563eb,#1e40af)', backdropFilter: 'blur(20px)', boxShadow: 'inset 0 0 90px rgba(37,99,235,.08), 0 30px 70px rgba(15,23,42,.12)' }}>
          <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#cfe0fb' }}>Preview · {category}</div>
          <div style={{ fontFamily: bri, fontWeight: 800, fontSize: 30, color: '#ffffff', marginTop: 10, letterSpacing: '-.03em' }}>{isRoute ? `${from || 'From'} → ${to || 'To'}` : (from || 'Event')}</div>
          <div style={{ color: '#cfe0fb', fontSize: 14, marginTop: 8 }}>{[datetime, seat, asking && '₹' + asking].filter(Boolean).join(' · ') || 'Your ticket details'}</div>
          <div style={{ margin: '24px 0', height: 1, background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.5) 0 6px,transparent 6px 13px)' }} />
          <p style={{ color: '#cfe0fb', fontSize: 14, lineHeight: 1.65, margin: 0 }}>Seekers nearby will be alerted instantly. You&apos;ll get a chat request — no money passes through LastMinutePass.</p>
        </div>
      )}

      {/* nav */}
      <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
        <button onClick={back} disabled={postStep === 0} style={{ padding: '14px 26px', borderRadius: 14, border: '1px solid rgba(37,99,235,.3)', background: 'transparent', color: '#1e40af', fontSize: 14.5, cursor: postStep === 0 ? 'not-allowed' : 'pointer', opacity: postStep === 0 ? 0.5 : 1 }}>Back</button>
        <button onClick={next} disabled={loading || uploading} style={{ flex: '1 1 200px', padding: '14px 26px', borderRadius: 14, border: '1px solid rgba(191,219,254,.5)', color: '#ffffff', fontWeight: 600, fontSize: 15, cursor: loading || uploading ? 'not-allowed' : 'pointer', background: 'linear-gradient(100deg,#1e40af,#2563eb,#60a5fa,#1e40af)', backgroundSize: '200% 100%', animation: 'lmpShimmer 6s linear infinite', boxShadow: '0 12px 34px rgba(30,64,175,.45)' }}>
          {loading ? 'Publishing…' : ['Continue to details', 'Review listing', 'Publish listing — free'][postStep]}
        </button>
      </div>
    </section>
  );
};

export default NewPost;
