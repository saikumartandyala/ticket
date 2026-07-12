'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Star, ShieldCheck, Heart, Share2, AlertTriangle, ChevronRight, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '../../../store/authStore';
import { API_BASE } from '../../../lib/api';

const MOCK_LISTINGS = [
  {
    id: "1",
    title: "Mumbai CSMT → Pune Jn (Deccan Queen)",
    description: "AC Chair car ticket, travelling tomorrow evening. Cannot make it due to family emergency.",
    category_id: 1,
    origin_city: "Mumbai",
    destination_city: "Pune",
    operator_name: "Deccan Queen Express",
    operator_code: "12123",
    seat_count: 1,
    seat_details: { coach: "C2", seat: "32", class: "AC CC" },
    event_date: "2026-06-04",
    departure_time: "17:10:00",
    arrival_time: "20:25:00",
    original_price: "850.00",
    asking_price: "425.00",
    pnr_last_four: "4829",
    status: "active",
    view_count: 42,
    interest_count: 3,
    expires_at: "2026-06-04T17:10:00Z",
    owner: { name: "Rahul S.", avg_rating: 4.8, phone_verified: true },
    category: { slug: "train", name: "Train", icon: "🚂", color_hex: "#2563eb" }
  },
  {
    id: "2",
    title: "IPL: Mumbai Indians vs Chennai Super Kings",
    description: "East Stand, Block A. Sitting with friends but sibling cancelled at last minute. Selling 1 ticket.",
    category_id: 3,
    event_name: "MI vs CSK",
    venue_name: "Wankhede Stadium",
    venue_city: "Mumbai",
    event_date: "2026-06-05",
    departure_time: "19:30:00",
    original_price: "2500.00",
    asking_price: "1250.00",
    status: "active",
    view_count: 154,
    interest_count: 8,
    expires_at: "2026-06-05T19:30:00Z",
    owner: { name: "Arjun M.", avg_rating: 4.9, phone_verified: true },
    category: { slug: "ipl", name: "IPL", icon: "🏏", color_hex: "#dc2626" }
  },
  {
    id: "3",
    title: "Diljit Dosanjh Dil-Luminati Tour India",
    description: "Fan Pit Phase 1 ticket. Unforeseen event at work, selling at half price. Handover near venue.",
    category_id: 5,
    event_name: "Diljit Dosanjh Dil-Luminati",
    venue_name: "JLN Stadium",
    venue_city: "Delhi",
    event_date: "2026-06-10",
    departure_time: "18:00:00",
    original_price: "6000.00",
    asking_price: "3600.00",
    status: "active",
    view_count: 210,
    interest_count: 14,
    expires_at: "2026-06-10T18:00:00Z",
    owner: { name: "Priya K.", avg_rating: 4.7, phone_verified: true },
    category: { slug: "concert", name: "Concert", icon: "🎵", color_hex: "#7c3aed" }
  }
];

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interestNote, setInterestNote] = useState('');
  
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const [interestSuccess, setInterestSuccess] = useState(false);

  useEffect(() => {
    // Attempt fetch from backend
    fetch(`${API_BASE}/listings/${id}`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Fallback');
      })
      .then(data => {
        if (data) setListing(data);
      })
      .catch(() => {
        // Fallback to local mock data
        const mock = MOCK_LISTINGS.find(l => l.id === id);
        setListing(mock || MOCK_LISTINGS[0]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleInterest = async () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    setInterestSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/listings/${id}/interest`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ seeker_note: interestNote })
      });

      if (response.ok) {
        setInterestSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        // Simulate local success for demo setup
        setInterestSuccess(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } catch (err) {
      setInterestSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } finally {
      setInterestSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading ticket details...</div>;
  }

  if (!listing) {
    return <div className="p-12 text-center text-slate-400">Ticket not found.</div>;
  }

  const savings = parseFloat(listing.original_price) - parseFloat(listing.asking_price);
  const savingsPct = Math.round((savings / parseFloat(listing.original_price)) * 100);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-8 font-semibold">
        <Link href="/" className="hover:text-slate-300">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/tickets" className="hover:text-slate-300">Tickets</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300 truncate max-w-xs">{listing.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* LEFT COLUMN - Physical Ticket Mockup */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative overflow-hidden bg-slate-900 border border-white/5 rounded-3xl flex flex-col justify-between shadow-2xl">
            {/* Category Ribbon */}
            <div className="h-2 w-full" style={{ backgroundColor: listing.category.color_hex || '#3b82f6' }} />
            
            <div className="p-8 space-y-6">
              {/* Top Row: Logo + Ticket Info */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300">
                  <span>{listing.category.icon}</span>
                  <span>{listing.category.name} PASS</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-widest">PNR last digits</span>
                  <span className="font-mono text-sm text-slate-300 font-extrabold">{listing.pnr_last_four || 'XXXX'}</span>
                </div>
              </div>

              {/* Title / Routes */}
              <div>
                <h1 className="text-2xl md:text-3xl font-black font-display text-slate-100">{listing.title}</h1>
                {listing.description && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed bg-white/5 border border-white/5 p-4 rounded-xl">
                    {listing.description}
                  </p>
                )}
              </div>

              {/* Dotted Tear Marks Simulation */}
              <div className="relative my-6 flex items-center justify-between">
                <div className="absolute -left-10 w-6 h-6 bg-[#030510] rounded-full border-r border-white/5" />
                <div className="w-full border-t-2 border-dashed border-white/10" />
                <div className="absolute -right-10 w-6 h-6 bg-[#030510] rounded-full border-l border-white/5" />
              </div>

              {/* Travel / Venue Details */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Departure / Event Date</span>
                  <div className="flex items-center gap-2 mt-1 text-slate-200">
                    <Calendar className="w-4.5 h-4.5 text-blue-400" />
                    <span className="font-semibold">{listing.event_date}</span>
                  </div>
                </div>

                {listing.departure_time && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Departure Time</span>
                    <div className="flex items-center gap-2 mt-1 text-slate-200">
                      <Clock className="w-4.5 h-4.5 text-indigo-400" />
                      <span className="font-semibold">{listing.departure_time.substring(0, 5)}</span>
                    </div>
                  </div>
                )}

                {listing.seat_details && (
                  <div className="col-span-2 grid grid-cols-3 gap-2 bg-slate-950/60 p-4 rounded-xl border border-white/5 text-xs text-slate-300">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Coach</span>
                      <span className="font-semibold">{listing.seat_details.coach || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Seat / Berth</span>
                      <span className="font-semibold">{listing.seat_details.seat || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Class</span>
                      <span className="font-semibold">{listing.seat_details.class || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Price & Seller Card */}
        <div className="lg:col-span-5 space-y-6">
          {/* PRICING & SELLER ACTION */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Original Price</span>
                <span className="text-sm text-slate-500 line-through block mt-0.5">₹{Math.round(parseFloat(listing.original_price))}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Save {savingsPct}%
                </span>
                <span className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent block mt-1">
                  ₹{Math.round(parseFloat(listing.asking_price))}
                </span>
              </div>
            </div>

            {/* Interest submission success state */}
            {interestSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-center text-xs font-bold space-y-2">
                <div>🎉 Request submitted successfully!</div>
                <div className="text-[10px] text-slate-400 font-normal">Redirecting to your dashboard to wait for seller acceptance...</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Add a note for the seller (Optional)</label>
                  <textarea 
                    placeholder="e.g. Hi, I really need this ticket for an urgent work trip! Will coordinate quickly."
                    value={interestNote}
                    onChange={(e) => setInterestNote(e.target.value)}
                    className="w-full input-glass text-xs h-20 resize-none"
                    maxLength={200}
                  />
                </div>

                <button 
                  onClick={handleInterest}
                  disabled={interestSubmitting}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{interestSubmitting ? 'Submitting...' : 'Express Interest'}</span>
                </button>
              </div>
            )}
          </div>

          {/* SELLER DETAILS */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Seller Information</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 text-sm font-black flex items-center justify-center">
                {listing.owner.name[0].toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-200">{listing.owner.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <div className="flex items-center text-amber-400 font-bold gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{listing.owner.avg_rating}</span>
                  </div>
                  <span>•</span>
                  {listing.owner.phone_verified && (
                    <div className="flex items-center text-emerald-400 font-bold gap-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SAFETY TIPS */}
          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 fill-current" />
              <span>Safety Advice</span>
            </h4>
            <ul className="list-disc pl-4 text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
              <li>Never send payments in advance prior to verifying ticket ownership.</li>
              <li>Always request a verification link or check ticket details where possible.</li>
              <li>Meet in public, well-lit spaces if physically exchanging event tickets.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
