'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { Ticket, User, MessageSquare, Bell, Heart, Star, ShieldCheck, Mail, Phone, Plus, MessageCircle, RefreshCw, Trash } from 'lucide-react';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'listings' | 'interests' | 'matches' | 'alerts'>('listings');

  // Dashboard datasets
  const [listings, setListings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      // 1. Fetch user's listings
      const listingsRes = await fetch(`${API_BASE}/listings`);
      const allListings = listingsRes.ok ? await listingsRes.json() : [];
      // Filter ones created by user
      const userListings = allListings.filter((l: any) => l.user_id === user?.id);
      setListings(userListings);

      // 2. Fetch matches
      const matchesRes = await fetch(`${API_BASE}/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userMatches = matchesRes.ok ? await matchesRes.json() : [];
      setMatches(userMatches);

      // 3. Fetch alerts
      const alertsRes = await fetch(`${API_BASE}/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userAlerts = alertsRes.ok ? await alertsRes.json() : [];
      setAlerts(userAlerts);
    } catch (err) {
      // Load mock fallback for development demo
      setListings([
        { id: "1", title: "Mumbai CSMT → Pune Jn", original_price: "850.00", asking_price: "425.00", status: "active", view_count: 24, interest_count: 1, event_date: "2026-06-04" }
      ]);
      setMatches([
        {
          id: "m-1",
          listing: { id: "1", title: "Mumbai CSMT → Pune Jn", original_price: "850.00", asking_price: "425.00" },
          seeker: { id: "s-1", name: "Priya Sharma", avg_rating: 4.8 },
          transferor: { id: "dev-user-id", name: "Rahul S." },
          status: "pending",
          seeker_note: "Need it urgently for travel today."
        }
      ]);
      setAlerts([
        { id: "a-1", origin_city: "Delhi", destination_city: "Mumbai", max_price: "2000.00", is_active: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated]);

  // Decline Interest
  const handleDeclineMatch = async (matchId: string) => {
    try {
      await fetch(`${API_BASE}/matches/${matchId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (e) {
      // Offline fallback
      setMatches(prev => prev.filter(m => m.id !== matchId));
    }
  };

  // Accept Interest
  const handleAcceptMatch = async (matchId: string) => {
    try {
      await fetch(`${API_BASE}/matches/${matchId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (e) {
      // Offline fallback
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted' } : m));
    }
  };

  // Delete Alert
  const handleDeleteAlert = async (alertId: string) => {
    try {
      await fetch(`${API_BASE}/alerts/${alertId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (e) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading your profile dashboard...</div>;
  }

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 h-[500px] hero-beam" />
      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* PROFILE SIDEBAR SUMMARY */}
      <aside className="lg:col-span-4 space-y-6">
        <div className="glow-card p-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-violet-600/20 border-2 border-violet-500/40 text-violet-300 text-3xl font-black flex items-center justify-center mx-auto">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-lg font-black font-display text-slate-200">{user?.name || 'User'}</h2>
            <div className="flex justify-center items-center gap-1.5 text-xs text-slate-400 mt-1">
              <div className="flex items-center text-amber-400 font-bold gap-0.5">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{user?.avg_rating || '5.0'}</span>
              </div>
              <span>•</span>
              <div className="flex items-center text-emerald-400 font-bold gap-0.5">
                <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                <span>Verified phone</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-xs">
            <div className="text-center bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-500 font-bold uppercase tracking-wider block">Listings</span>
              <span className="text-xl font-extrabold text-violet-400 mt-1 block">{listings.length}</span>
            </div>
            <div className="text-center bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-500 font-bold uppercase tracking-wider block">Matches</span>
              <span className="text-xl font-extrabold text-fuchsia-400 mt-1 block">{matches.filter(m=>m.status==='transferred').length}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* DASHBOARD DETAILS & SECTIONS */}
      <main className="lg:col-span-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 pb-2 gap-4 overflow-x-auto text-xs font-semibold uppercase tracking-wider">
          <button 
            onClick={() => setActiveTab('listings')}
            className={`pb-2 transition-all ${activeTab === 'listings' ? 'text-violet-400 border-b-2 border-violet-500 font-bold' : 'text-slate-500'}`}
          >
            My Listings ({listings.length})
          </button>
          
          <button 
            onClick={() => setActiveTab('matches')}
            className={`pb-2 transition-all ${activeTab === 'matches' ? 'text-fuchsia-400 border-b-2 border-fuchsia-500 font-bold' : 'text-slate-500'}`}
          >
            My Matches ({matches.length})
          </button>

          <button 
            onClick={() => setActiveTab('alerts')}
            className={`pb-2 transition-all ${activeTab === 'alerts' ? 'text-emerald-400 border-b-2 border-emerald-500 font-bold' : 'text-slate-500'}`}
          >
            My Alerts ({alerts.length})
          </button>
        </div>

        {/* LISTINGS TAB CONTENT */}
        {activeTab === 'listings' && (
          <div className="space-y-4">
            {listings.length > 0 ? (
              listings.map((l) => (
                <div key={l.id} className="glow-card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">{l.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-semibold mt-1">
                      <span>Date: {l.event_date}</span>
                      <span>•</span>
                      <span>Price: ₹{l.asking_price}</span>
                      <span>•</span>
                      <span className="text-violet-400">👁 {l.view_count || 0} Views</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-3 py-1 rounded-full uppercase font-extrabold">{l.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-white/5 border-dashed rounded-2xl">
                You have not listed any tickets yet.
              </div>
            )}
          </div>
        )}

        {/* MATCHES & INTEREST REQUESTS TAB */}
        {activeTab === 'matches' && (
          <div className="space-y-4">
            {matches.length > 0 ? (
              matches.map((m) => {
                const isSeller = m.transferor_id === user?.id;
                return (
                  <div key={m.id} className="glow-card p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{m.listing.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {isSeller ? `Seeker: ${m.seeker.name}` : `Seller: ${m.transferor.name}`}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                        m.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        m.status === 'accepted' || m.status === 'contact_revealed' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    {m.seeker_note && (
                      <p className="text-xs text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
                        &ldquo;{m.seeker_note}&rdquo;
                      </p>
                    )}

                    {/* Actions based on match status */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                      {isSeller && m.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleDeclineMatch(m.id)}
                            className="px-4 py-2 border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold rounded-full transition"
                          >
                            Decline
                          </button>
                          <button 
                            onClick={() => handleAcceptMatch(m.id)}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-full transition"
                          >
                            Accept Seeker
                          </button>
                        </>
                      )}

                      {(m.status === 'accepted' || m.status === 'contact_revealed') && (
                        <Link 
                          href={`/chat/${m.id}`}
                          className="px-5 py-2 btn-primary text-xs flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Open Chat Room</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-white/5 border-dashed rounded-2xl">
                No interest requests or matches found.
              </div>
            )}
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-slate-400">Manage Your Ticket Notification Alerts</h3>
            </div>
            
            {alerts.length > 0 ? (
              alerts.map((a) => (
                <div key={a.id} className="glow-card p-5 flex justify-between items-center gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-200">
                      {a.origin_city && a.destination_city ? `${a.origin_city} → ${a.destination_city}` : 'Ticket Alert'}
                    </h4>
                    {a.max_price && <p className="text-[10px] text-slate-500 mt-1">Max Budget limit: ₹{a.max_price}</p>}
                  </div>
                  
                  <button 
                    onClick={() => handleDeleteAlert(a.id)}
                    className="p-2 border border-rose-500/20 text-rose-400 hover:bg-rose-500/5 rounded-full transition"
                    title="Delete Alert"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-white/5 border-dashed rounded-2xl">
                No active notification alerts configured.
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
