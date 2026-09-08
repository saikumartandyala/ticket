'use client';

import React, { useState, useEffect, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { API_BASE } from '../../lib/api';

const ACCENT: Record<string, string> = {
  train: '#38bdf8', bus: '#fbbf24', ipl: '#a855f7', cricket: '#34d399', concert: '#f472b6', event: '#c084fc',
};

export default function DashboardPage() {
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

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#9d90b6' }}>Loading your dashboard…</div>;

  const initials = user?.name ? user.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() : 'U';
  const stats = [
    { value: String(listings.length), label: 'Active listings' },
    { value: String(matches.length), label: 'Open matches' },
    { value: String(matches.filter((m) => m.status === 'transferred').length), label: 'Completed' },
    { value: String(user?.avg_rating || '5.0'), label: 'Your rating' },
  ];

  // Rows per tab, mapped from real data
  let rows: any[] = [];
  if (tab === 'My Listings') {
    rows = listings.map((l) => ({
      accent: ACCENT[l.category?.slug] || '#c084fc',
      title: l.title,
      sub: `${l.event_date || ''}${l.departure_time ? ' · ' + String(l.departure_time).slice(0, 5) : ''}`,
      price: '₹' + Math.round(parseFloat(l.asking_price || 0)).toLocaleString('en-IN'),
      status: cap(l.status || 'active'),
    }));
  } else if (tab === 'Matches') {
    rows = matches.map((m) => {
      const isSeller = m.transferor_id === user?.id;
      const other = isSeller ? m.seeker : m.transferor;
      return {
        id: m.id, isSeller, matchStatus: m.status,
        accent: ACCENT[m.listing?.category?.slug] || '#c084fc',
        title: other?.name || (isSeller ? 'Seeker' : 'Seller'),
        sub: `${m.listing?.title || 'Ticket'}${m.seeker_note ? ' · “' + m.seeker_note + '”' : ''}`,
        price: '₹' + Math.round(parseFloat(m.listing?.asking_price || 0)).toLocaleString('en-IN'),
        status: cap(m.status),
        chatId: m.id,
      };
    });
  } else {
    rows = alerts.map((a) => ({
      id: a.id, isAlert: true,
      accent: ACCENT[a.category_id ? '' : ''] || '#c084fc',
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
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(145deg,#c084fc,#7c3aed)', display: 'grid', placeItems: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: 24, color: '#fff', boxShadow: '0 12px 34px rgba(124,58,237,.55)' }}>{initials}</div>
        <div style={{ flex: '1 1 200px' }}>
          <h1 className="font-display" style={{ fontWeight: 700, fontSize: 30, color: '#fff', letterSpacing: '-.03em', margin: 0 }}>{user?.name || 'Your account'}</h1>
          <div style={{ color: '#9d90b6', fontSize: 14, marginTop: 5 }}>★ {user?.avg_rating || '5.0'} · {user?.total_matches || 0} successful transfers</div>
        </div>
        <button onClick={() => router.push('/post')} className="btn-violet" style={{ padding: '12px 22px', borderRadius: 999, fontSize: 14 }}>+ New listing</button>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ position: 'relative', padding: 22, borderRadius: 22, border: '1px solid rgba(168,85,247,.22)', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 60px rgba(124,58,237,.18)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -24, bottom: -24, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,85,247,.4),transparent 70%)', filter: 'blur(10px)', animation: 'lmpPulse 4s ease-in-out infinite' }} />
            <div className="font-display" style={{ fontWeight: 700, fontSize: 32, color: '#fff', letterSpacing: '-.03em' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#9d90b6', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 999, border: '1px solid rgba(168,85,247,.2)', background: 'rgba(255,255,255,.035)', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', marginBottom: 22 }}>
        {(['My Listings', 'Matches', 'Alerts'] as const).map((t) => {
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13.5, whiteSpace: 'nowrap', background: active ? 'linear-gradient(140deg,#a855f7,#7c3aed)' : 'transparent', color: active ? '#fff' : '#a99cc0', boxShadow: active ? '0 8px 22px rgba(124,58,237,.45)' : 'none' }}>{t}</button>
          );
        })}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8b7fa3', border: '1px dashed rgba(168,85,247,.25)', borderRadius: 20 }}>Nothing here yet.</div>
        )}
        {rows.map((r, idx) => (
          <div key={r.id || idx} className="dash-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '20px 22px', borderRadius: 20, border: '1px solid rgba(168,85,247,.18)', background: 'rgba(255,255,255,.035)', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: 10, height: 40, borderRadius: 99, background: r.accent, boxShadow: `0 0 18px ${r.accent}` }} />
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div className="font-display" style={{ fontWeight: 600, fontSize: 16.5, color: '#fff' }}>{r.title}</div>
              <div style={{ fontSize: 13, color: '#9d90b6', marginTop: 4 }}>{r.sub}</div>
            </div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>{r.price}</div>

            {/* Actions */}
            {tab === 'Matches' && r.isSeller && r.matchStatus === 'pending' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDecline(r.id)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(251,113,133,.35)', background: 'rgba(244,63,94,.08)', color: '#fda4af', fontSize: 12.5, cursor: 'pointer' }}>Decline</button>
                <button onClick={() => handleAccept(r.id)} className="btn-violet" style={{ padding: '8px 16px', borderRadius: 999, fontSize: 12.5 }}>Accept</button>
              </div>
            ) : tab === 'Matches' && (r.matchStatus === 'accepted' || r.matchStatus === 'contact_revealed') ? (
              <button onClick={() => router.push(`/chat/${r.chatId}`)} className="btn-violet" style={{ padding: '8px 16px', borderRadius: 999, fontSize: 12.5 }}>Open chat</button>
            ) : tab === 'Alerts' ? (
              <button onClick={() => handleDeleteAlert(r.id)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(251,113,133,.3)', background: 'transparent', color: '#fda4af', fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
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
  return { padding: '6px 13px', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap', border: `1px solid ${closed ? 'rgba(255,255,255,.14)' : 'rgba(168,85,247,.35)'}`, background: closed ? 'rgba(255,255,255,.04)' : 'rgba(168,85,247,.14)', color: closed ? '#8b7fa3' : '#d8c9ff' };
}
