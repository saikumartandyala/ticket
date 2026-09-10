'use client';

import React, { useState, useEffect, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const bri = "'Bricolage Grotesque', system-ui, sans-serif";

// Category accent colours from the NEW-UI design (blue theme). Keyed by the
// real backend's category *name*; the slug map is a fallback for either shape.
const ACCENT: Record<string, string> = {
  Train: '#38bdf8', Bus: '#fbbf24', IPL: '#2563eb', Cricket: '#34d399', Concert: '#f472b6', Event: '#7c3aed',
};
const ACCENT_SLUG: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#2563eb', cricket: '#34d399', concert: '#f472b6', event: '#7c3aed',
};
function accentFor(cat: any): string {
  return (cat && (ACCENT[cat.name] || ACCENT_SLUG[cat.slug])) || '#7c3aed';
}

const money = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function NewDashboard() {
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();
  const [tab, setTab] = useState<'My Listings' | 'Matches' | 'Alerts'>('My Listings');

  const [listings, setListings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const listingsRes = await fetch(`${API_BASE}/listings`);
      const allListings = listingsRes.ok ? await listingsRes.json() : [];
      setListings(allListings.filter((l: any) => l.user_id === user?.id));
      const matchesRes = await fetch(`${API_BASE}/matches`, { headers: { Authorization: `Bearer ${token}` } });
      setMatches(matchesRes.ok ? await matchesRes.json() : []);
      const alertsRes = await fetch(`${API_BASE}/alerts`, { headers: { Authorization: `Bearer ${token}` } });
      setAlerts(alertsRes.ok ? await alertsRes.json() : []);
    } catch {
      /* keep empty on failure */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth'); return; }
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleAccept = async (id: string) => {
    try { await fetch(`${API_BASE}/matches/${id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); fetchDashboardData(); }
    catch { setMatches((p) => p.map((m) => (m.id === id ? { ...m, status: 'accepted' } : m))); }
  };
  const handleDecline = async (id: string) => {
    try { await fetch(`${API_BASE}/matches/${id}/decline`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); fetchDashboardData(); }
    catch { setMatches((p) => p.filter((m) => m.id !== id)); }
  };
  const handleDeleteAlert = async (id: string) => {
    try { await fetch(`${API_BASE}/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchDashboardData(); }
    catch { setAlerts((p) => p.filter((a) => a.id !== id)); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7488' }}>Loading your dashboard…</div>;

  const initials = user?.name ? user.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() : 'U';

  // Real stat tiles computed from the user's listings/matches/profile.
  const completedValue = matches
    .filter((m) => m.status === 'transferred')
    .reduce((sum, m) => sum + (parseFloat(m.listing?.asking_price) || 0), 0);
  const stats = [
    { value: String(listings.length), label: 'Active listings' },
    { value: String(matches.length), label: 'Open matches' },
    { value: money(completedValue), label: 'Value passed on' },
    { value: String(user?.avg_rating || '5.0'), label: 'Your rating' },
  ];

  // Rows per tab, mapped from real data into the design's row markup.
  let rows: any[] = [];
  if (tab === 'My Listings') {
    rows = listings.map((l) => ({
      accent: accentFor(l.category),
      title: l.title,
      sub: `${l.event_date || ''}${l.departure_time ? ' · ' + String(l.departure_time).slice(0, 5) : ''}`,
      price: money(parseFloat(l.asking_price || 0)),
      status: cap(l.status || 'active'),
    }));
  } else if (tab === 'Matches') {
    rows = matches.map((m) => {
      const isSeller = m.transferor_id === user?.id;
      const other = isSeller ? m.seeker : m.transferor;
      return {
        id: m.id, isSeller, matchStatus: m.status, chatId: m.id,
        accent: accentFor(m.listing?.category),
        title: other?.name || (isSeller ? 'Seeker' : 'Seller'),
        sub: `${m.listing?.title || 'Ticket'}${m.seeker_note ? ' · “' + m.seeker_note + '”' : ''}`,
        price: money(parseFloat(m.listing?.asking_price || 0)),
        status: cap(m.status),
      };
    });
  } else {
    rows = alerts.map((a) => ({
      id: a.id, isAlert: true,
      accent: '#7c3aed',
      title: a.origin_city && a.destination_city ? `${a.origin_city} → ${a.destination_city}` : 'Ticket alert',
      sub: a.max_price ? `Max ₹${a.max_price}` : 'Any price · notify instantly',
      price: '—',
      status: a.is_active ? 'Active' : 'Off',
    }));
  }

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Profile header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', marginBottom: 28 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(145deg,#2563eb,#1e3a8a)', display: 'grid', placeItems: 'center', fontFamily: bri, fontWeight: 700, fontSize: 24, color: '#ffffff', boxShadow: '0 12px 34px rgba(30,64,175,.55)' }}>{initials}</div>
        <div style={{ flex: '1 1 200px' }}>
          <h1 style={{ fontFamily: bri, fontWeight: 700, fontSize: 30, color: '#0f172a', letterSpacing: '-.03em', margin: 0 }}>{user?.name || 'Your account'}</h1>
          <div style={{ color: '#6b7488', fontSize: 14, marginTop: 5 }}>★ {user?.avg_rating || '5.0'} · {user?.total_matches || 0} successful transfers</div>
        </div>
        <button onClick={() => router.push('/post')} style={{ padding: '12px 22px', borderRadius: 999, border: '1px solid rgba(255,255,255,.5)', background: 'linear-gradient(140deg,#2563eb,#1e40af)', color: '#ffffff', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 30px rgba(30,64,175,.45)' }}>+ New listing</button>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ position: 'relative', padding: 22, borderRadius: 22, border: '1px solid rgba(15,23,42,.1)', background: '#ffffff', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 60px rgba(37,99,235,.07)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -24, bottom: -24, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.4),transparent 70%)', filter: 'blur(10px)', animation: 'lmpPulse 4s ease-in-out infinite' }} />
            <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 32, color: '#0f172a', letterSpacing: '-.03em' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#6b7488', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 999, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', marginBottom: 22 }}>
        {(['My Listings', 'Matches', 'Alerts'] as const).map((t) => {
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13.5, whiteSpace: 'nowrap', background: active ? 'linear-gradient(140deg,#2563eb,#1e40af)' : 'transparent', color: active ? '#ffffff' : '#5b6478', boxShadow: active ? '0 8px 22px rgba(30,64,175,.45)' : 'none' }}>{t}</button>
          );
        })}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#6b7488', border: '1px dashed rgba(37,99,235,.25)', borderRadius: 20 }}>Nothing here yet.</div>
        )}
        {rows.map((r, idx) => (
          <div key={r.id || idx} className="dash-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '20px 22px', borderRadius: 20, border: '1px solid rgba(15,23,42,.09)', background: '#ffffff', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: 10, height: 40, borderRadius: 99, background: r.accent, boxShadow: `0 0 18px ${r.accent}` }} />
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontFamily: bri, fontWeight: 600, fontSize: 16.5, color: '#0f172a' }}>{r.title}</div>
              <div style={{ fontSize: 13, color: '#6b7488', marginTop: 4 }}>{r.sub}</div>
            </div>
            <div style={{ fontFamily: bri, fontWeight: 700, fontSize: 17, color: '#0f172a' }}>{r.price}</div>

            {/* Actions — wired to the real handlers, styled for the NEW (blue) UI */}
            {tab === 'Matches' && r.isSeller && r.matchStatus === 'pending' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDecline(r.id)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(225,29,72,.35)', background: 'rgba(244,63,94,.08)', color: '#b91c1c', fontSize: 12.5, cursor: 'pointer' }}>Decline</button>
                <button onClick={() => handleAccept(r.id)} style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.5)', background: 'linear-gradient(140deg,#2563eb,#1e40af)', color: '#ffffff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 8px 22px rgba(30,64,175,.45)' }}>Accept</button>
              </div>
            ) : tab === 'Matches' && (r.matchStatus === 'accepted' || r.matchStatus === 'contact_revealed') ? (
              <Link href={`/chat/${r.chatId}`} style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.5)', background: 'linear-gradient(140deg,#2563eb,#1e40af)', color: '#ffffff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 8px 22px rgba(30,64,175,.45)', textDecoration: 'none' }}>Open chat</Link>
            ) : tab === 'Alerts' ? (
              <button onClick={() => handleDeleteAlert(r.id)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(225,29,72,.3)', background: 'transparent', color: '#b91c1c', fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
            ) : (
              <div style={statusStyle(r.status)}>{r.status}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function statusStyle(status: string): CSSProperties {
  const closed = status === 'Closed' || status === 'Off' || status === 'Cancelled' || status === 'Expired';
  return { padding: '6px 13px', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap', border: `1px solid ${closed ? 'rgba(15,23,42,.12)' : 'rgba(37,99,235,.35)'}`, background: closed ? '#f1f4f8' : 'rgba(37,99,235,.14)', color: closed ? '#6b7488' : '#1e40af' };
}

export default NewDashboard;
