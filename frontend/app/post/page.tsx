'use client';

import React, { useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { API_BASE } from '../../lib/api';

const ACCENT: Record<string, string> = {
  Train: '#38bdf8', Bus: '#fbbf24', IPL: '#a855f7', Cricket: '#34d399', Concert: '#f472b6', Event: '#c084fc',
};
const CAT_ID: Record<string, number> = { Train: 1, Bus: 2, IPL: 3, Cricket: 4, Concert: 5, Event: 6 };
const CAT_CARDS = [
  ['Train', 'PNR or e-ticket'], ['Bus', 'Seat or sleeper'], ['IPL', 'Stadium entry'],
  ['Cricket', 'Intl. or domestic'], ['Concert', 'Live music pass'], ['Event', 'Conference, expo'],
] as const;

export default function PostPage() {
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
      <h1 className="font-display" style={{ fontWeight: 800, fontSize: 'clamp(30px,4.4vw,44px)', letterSpacing: '-.035em', margin: '0 0 6px', color: '#fff' }}>List your ticket</h1>
      <p style={{ color: '#9d90b6', margin: '0 0 28px', fontSize: 15 }}>Free, always. Takes about 40 seconds.</p>

      {/* step pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 30, flexWrap: 'wrap' }}>
        {['1 · Category', '2 · Details', '3 · Review'].map((label, i) => {
          const done = i <= postStep;
          return <div key={label} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 13, border: `1px solid ${done ? 'rgba(192,132,252,.5)' : 'rgba(168,85,247,.18)'}`, background: done ? 'rgba(168,85,247,.16)' : 'rgba(255,255,255,.03)', color: done ? '#fff' : '#8b7fa3' }}>{label}</div>;
        })}
      </div>

      {error && <div style={{ marginBottom: 20, padding: '12px 16px', fontSize: 13, background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.25)', color: '#fda4af', borderRadius: 14 }}>{error}</div>}

      {/* Step 0: category */}
      {postStep === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
          {CAT_CARDS.map(([label, hint]) => {
            const selected = category === label;
            return (
              <div key={label} onClick={() => setCategory(label)} className="cat-card" style={{ padding: 24, borderRadius: 22, cursor: 'pointer', border: `1px solid ${selected ? 'rgba(192,132,252,.7)' : 'rgba(168,85,247,.2)'}`, background: 'linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', backdropFilter: 'blur(14px)', boxShadow: selected ? '0 0 40px rgba(168,85,247,.35), inset 0 0 60px rgba(124,58,237,.16)' : 'inset 0 0 60px rgba(124,58,237,.16), 0 18px 44px rgba(0,0,0,.45)', transformStyle: 'preserve-3d' }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(145deg,${ACCENT[label]},#7c3aed)`, boxShadow: `0 10px 26px ${ACCENT[label]}66, inset 0 1px 0 rgba(255,255,255,.5)` }} />
                <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 16 }}>{label}</div>
                <div style={{ fontSize: 12.5, color: '#9d90b6', marginTop: 5 }}>{hint}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1: details */}
      {postStep === 1 && (
        <div className="glass" style={{ padding: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          {fields.map(([label, ph, val, setter, type]) => (
            <div key={label}>
              <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 8 }}>{label}</div>
              <input className="field" type={type} placeholder={ph} value={val} onChange={(e) => setter(e.target.value)} style={{ padding: '14px 15px', fontSize: 14.5 }} />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c084fc', marginBottom: 8 }}>Ticket screenshot (optional)</div>
            {photoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#86efac' }}>✓ Uploaded <button onClick={() => setPhotoUrl('')} style={{ background: 'transparent', border: 'none', color: '#fda4af', cursor: 'pointer', fontSize: 12 }}>Remove</button></div>
            ) : (
              <label style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 12, border: '1px dashed rgba(168,85,247,.4)', color: '#c9b8e8', fontSize: 13, cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : 'Click to upload · max 5MB'}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Step 2: review */}
      {postStep === 2 && (
        <div className="glass-strong" style={{ padding: 30 }}>
          <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#dcccff' }}>Preview · {category}</div>
          <div className="font-display" style={{ fontWeight: 800, fontSize: 30, color: '#fff', marginTop: 10, letterSpacing: '-.03em' }}>{isRoute ? `${from || 'From'} → ${to || 'To'}` : (from || 'Event')}</div>
          <div style={{ color: '#cbb9f0', fontSize: 14, marginTop: 8 }}>{[datetime, seat, asking && '₹' + asking].filter(Boolean).join(' · ') || 'Your ticket details'}</div>
          <div className="ticket-divider-bright" style={{ margin: '24px 0' }} />
          <p style={{ color: '#c3b2e4', fontSize: 14, lineHeight: 1.65, margin: 0 }}>Seekers nearby will be alerted instantly. You&apos;ll get a chat request — no money passes through LastMinutePass.</p>
        </div>
      )}

      {/* nav */}
      <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
        <button onClick={back} disabled={postStep === 0} style={{ padding: '14px 26px', borderRadius: 14, border: '1px solid rgba(168,85,247,.3)', background: 'transparent', color: '#c9b8e8', fontSize: 14.5, cursor: postStep === 0 ? 'not-allowed' : 'pointer', opacity: postStep === 0 ? 0.5 : 1 }}>Back</button>
        <button onClick={next} disabled={loading || uploading} className="btn-shimmer" style={{ flex: '1 1 200px', padding: '14px 26px', borderRadius: 14, fontSize: 15 }}>
          {loading ? 'Publishing…' : ['Continue to details', 'Review listing', 'Publish listing — free'][postStep]}
        </button>
      </div>
    </section>
  );
}
