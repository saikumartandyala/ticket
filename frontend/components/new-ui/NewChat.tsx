'use client';

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE, WS_BASE } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const SAFETY = [
  'Meet in a public, well-lit place near the venue or station.',
  'Verify the ticket PNR or barcode before paying anything.',
  'Never share OTPs — no genuine transfer needs one.',
  'Report anyone who asks you to pay outside the agreed amount.',
];

export function NewChat() {
  const { matchId } = useParams();
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();

  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [otherPhone, setOtherPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth'); return; }

    fetch(`${API_BASE}/matches/${matchId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setMatch(data);
        if (data.status === 'contact_revealed' || data.status === 'transferred') {
          setRevealed(true);
          const other = data.seeker_id === user?.id ? data.transferor : data.seeker;
          setOtherPhone(other?.phone || '');
        }
      })
      .catch(() => setMatch({ id: matchId, listing: { title: 'Ticket', asking_price: '0' }, seeker_id: 's', transferor_id: 't', seeker: { name: 'Seeker' }, transferor: { name: 'Seller' }, status: 'accepted' }));

    fetch(`${API_BASE}/matches/${matchId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setMessages(data))
      .catch(() => setMessages([]));

    const ws = new WebSocket(`${WS_BASE}/ws/chat/${matchId}?token=${token}`);
    socketRef.current = ws;
    ws.onmessage = (e) => { try { setMessages((p) => [...p, JSON.parse(e.data)]); } catch {} };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isAuthenticated]);

  const send = () => {
    const t = draft.trim(); if (!t) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ content: t }));
    } else {
      setMessages((p) => [...p, { id: `m-${Date.now()}`, sender_id: user?.id, content: t, created_at: new Date().toISOString() }]);
    }
    setDraft('');
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') send(); };

  const reveal = async () => {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/reveal`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const other = data.seeker_id === user?.id ? data.transferor : data.seeker;
        setOtherPhone(other?.phone || '');
      }
    } catch {}
    setRevealed(true);
  };

  const confirmTransfer = async () => {
    try { await fetch(`${API_BASE}/matches/${matchId}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {}
    router.push('/dashboard');
  };

  const copy = () => { navigator.clipboard.writeText(otherPhone); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (!match) return <div style={{ padding: 48, textAlign: 'center', color: '#5b6478' }}>Loading chat…</div>;

  const other = match.seeker_id === user?.id ? match.transferor : match.seeker;
  const otherName = other?.name || 'Partner';
  const otherInitials = otherName.split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase();

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 20px 60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 20, alignItems: 'start' }}>
      {/* Chat panel */}
      <div style={{ gridColumn: 'span 2', minWidth: 0, display: 'flex', flexDirection: 'column', height: 'min(74vh,640px)', borderRadius: 26, border: '1px solid rgba(15,23,42,.1)', background: '#ffffff', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 70px rgba(37,99,235,.05)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(145deg,#2563eb,#1e3a8a)', display: 'grid', placeItems: 'center', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, color: '#ffffff', fontSize: 15 }}>{otherInitials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 600, fontSize: 16, color: '#0f172a' }}>{otherName}</div>
            <div style={{ fontSize: 12.5, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />online now</div>
          </div>
          {match.status !== 'transferred' && (
            <button onClick={confirmTransfer} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(21,128,61,.3)', fontSize: 11.5, color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap' }}>Confirm transfer</button>
          )}
          <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(37,99,235,.12)', border: '1px solid rgba(37,99,235,.3)', fontSize: 12, color: '#1e40af', whiteSpace: 'nowrap' }}>{match.listing?.title} · ₹{Math.round(parseFloat(match.listing?.asking_price || 0))}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => {
            const me = m.sender_id === user?.id;
            const row: CSSProperties = { display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' };
            const bubble: CSSProperties = {
              maxWidth: '78%', padding: '12px 15px', fontSize: 14.5, lineHeight: 1.5,
              borderRadius: me ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              ...(me ? { background: 'linear-gradient(140deg,#1e40af,#2563eb)', color: '#0f172a', boxShadow: '0 10px 26px rgba(30,64,175,.4)' } : { background: '#eef2f9', border: '1px solid rgba(37,99,235,.16)', color: '#1f2937' }),
            };
            return (
              <div key={m.id || i} style={row}>
                <div style={bubble}>{m.content}
                  <div style={{ fontSize: 11, marginTop: 6, color: me ? 'rgba(255,255,255,.7)' : '#6b7488' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid rgba(15,23,42,.08)' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder="Write a message…" style={{ flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 14, border: '1px solid rgba(37,99,235,.28)', background: '#f6f8fd', color: '#0f172a', fontSize: 14.5, outline: 'none' }} />
          <button onClick={send} style={{ padding: '13px 22px', borderRadius: 14, border: '1px solid rgba(191,219,254,.45)', background: 'linear-gradient(140deg,#2563eb,#1e40af)', color: '#ffffff', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 26px rgba(30,64,175,.45)' }}>Send</button>
        </div>
      </div>

      {/* Aside */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 24, borderRadius: 24, border: '1px solid rgba(37,99,235,.24)', background: 'linear-gradient(160deg,#edf3ff,#ffffff)', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 70px rgba(37,99,235,.07)' }}>
          <div style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17, color: '#0f172a' }}>Contact details</div>
          <p style={{ fontSize: 13.5, color: '#5b6478', lineHeight: 1.6, margin: '10px 0 16px' }}>Both of you agreed to transfer. Numbers are revealed to each other only.</p>
          {revealed ? (
            <div style={{ padding: 16, borderRadius: 16, background: '#f6f8fd', border: '1px solid rgba(37,99,235,.3)' }}>
              <div style={{ fontSize: 12, color: '#2563eb', letterSpacing: '.14em', textTransform: 'uppercase' }}>Phone</div>
              <div style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 20, color: '#0f172a', marginTop: 6 }}>{otherPhone || 'Shared in chat'}</div>
              <div style={{ fontSize: 12.5, color: '#6b7488', marginTop: 10 }}>Settle over UPI or cash — LastMinutePass never handles money.</div>
              {otherPhone && <button onClick={copy} style={{ marginTop: 10, background: 'transparent', border: 'none', color: '#2563eb', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>{copied ? 'Copied ✓' : 'Copy number'}</button>}
            </div>
          ) : (
            <button onClick={reveal} style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid rgba(191,219,254,.5)', color: '#ffffff', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', background: 'linear-gradient(100deg,#1e40af,#2563eb,#60a5fa,#1e40af)', backgroundSize: '200% 100%', animation: 'lmpShimmer 6s linear infinite' }}>Reveal contact</button>
          )}
        </div>
        <div style={{ padding: 22, borderRadius: 24, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff' }}>
          <div style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 10 }}>Before you meet</div>
          {SAFETY.map((t) => (
            <div key={t} style={{ display: 'flex', gap: 9, padding: '6px 0', fontSize: 13.5, color: '#5b6478', lineHeight: 1.55 }}><span style={{ color: '#2563eb' }}>◆</span>{t}</div>
          ))}
        </div>
      </aside>
    </section>
  );
}
