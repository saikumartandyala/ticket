'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { TicketCard } from '../components/TicketCard';
import DotField from '../components/react-bits/DotField';
import GlassSurface from '../components/react-bits/GlassSurface';
import MagicBento, { type BentoCard } from '../components/react-bits/MagicBento';

// Rich Mock Data for fallback when API is not running
const MOCK_LISTINGS = [
  {
    id: "1",
    title: "Mumbai CSMT → Pune Jn (Deccan Queen)",
    description: "AC Chair car ticket, travelling tomorrow evening. Cannot make it due to family emergency.",
    category_id: 1,
    origin_city: "Mumbai",
    destination_city: "Pune",
    event_date: "2026-06-04",
    departure_time: "17:10:00",
    original_price: "850.00",
    asking_price: "425.00",
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

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<any[]>(MOCK_LISTINGS);
  const [activeTab, setActiveTab] = useState('all');
  
  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    // Attempt to fetch listings from backend
    fetch('http://localhost:8000/api/v1/listings')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not running');
      })
      .then(data => {
        if (data && data.length > 0) setListings(data);
      })
      .catch(() => {
        // Fallback to mock data
      });
  }, []);

  const filteredListings = activeTab === 'all' 
    ? listings 
    : listings.filter(l => l.category.slug === activeTab);

  const trustCards: BentoCard[] = [
    { label: 'Trust', title: 'Verified Sellers', description: 'Every user logs in via verified mobile OTP for identity checks.' },
    { label: 'Fairness', title: 'Anti-Scalping Guardrails', description: 'Price limits prevent tickets from being resold above 90% of original value.' },
    { label: 'Speed', title: 'Instant Seeker Alerts', description: 'Get SMS + push notifications the second a matching ticket goes live.' },
    { label: 'Free', title: '12,000+ Listings', description: 'Successful listings posted by transferors across India.' },
    { label: 'Matches', title: '9,000+ Matched Resales', description: 'Tickets successfully transferred between real people.' },
    { label: 'Rating', title: '4.9★ Average Rating', description: 'Based on real, completed transfer reviews.' },
  ];

  const faqs = [
    { q: "Is LastMinutePass free?", a: "Yes, it is completely free to browse, list, and express interest in tickets. We do not charge transaction or listing fees." },
    { q: "How do I pay for the ticket?", a: "We do not process payments. Once you are matched and reveal contacts, you and the other party coordinate directly to complete the ticket transfer and payment (via UPI, cash, etc.)." },
    { q: "How do you verify the tickets are genuine?", a: "Every listing requires the seller to upload a photo of the ticket. Additionally, sellers must have verified phone numbers. However, we always advise buyers to review ticket photos and meet in safe environments before transferring money." },
    { q: "What is the anti-scalping price rule?", a: "To prevent ticket hoarding and scalping, listings must be priced between 30% and 90% of the original face value. You can never list a ticket above its face value." }
  ];

  return (
    <div className="relative min-h-screen pb-16 overflow-hidden">
      {/* Interactive dot-field background */}
      <div className="absolute top-0 left-0 right-0 h-[900px] -z-10">
        <DotField
          dotRadius={1.3}
          dotSpacing={26}
          cursorRadius={160}
          cursorForce={0.35}
          bulgeOnly={false}
          bulgeStrength={80}
          glowRadius={140}
          sparkle={false}
          waveAmplitude={0}
          gradientFrom="rgba(120, 70, 200, 0.16)"
          gradientTo="rgba(120, 100, 170, 0.08)"
          glowColor="#120F17"
        />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#030510]" />
      </div>

      {/* HERO SECTION */}
      <section className="px-6 md:px-12 pt-16 pb-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3.5 py-1 rounded-full text-xs text-blue-400 font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Ticket Resale Portal</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black font-display tracking-tight leading-[1.1] text-slate-100">
            Last Minute Tickets.<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Real Connections.</span>
          </h1>
          
          <p className="text-base md:text-lg text-slate-400 max-w-xl font-medium">
            Plans change. Someone cancels. You need a ticket today. We connect transferors and seekers directly, fairly, and completely free.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/tickets" className="btn-primary flex items-center gap-2 text-sm">
              <span>Find a Ticket</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/post" className="btn-secondary text-sm">
              List My Ticket (Free)
            </Link>
          </div>

          {/* Activity Ticker */}
          <div className="pt-8 border-t border-white/5 max-w-xl">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Live Feed</p>
            <div className="overflow-hidden relative h-6 w-full text-xs text-slate-400">
              <div className="absolute flex gap-8 whitespace-nowrap animate-[marquee_20s_linear_infinite]">
                <span>🔴 Rahul posted Pune → Mumbai train ticket · ₹250</span>
                <span>🟢 Priya accepted ticket match for IPL Match</span>
                <span>🔴 Vivek listed Diljit Concert fanpit · ₹3000</span>
                <span>🟢 Anil transferred Bus ticket to Bangalore</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating cards on Right (Desktop) */}
        <div className="hidden lg:col-span-5 relative h-[420px] flex items-center justify-center">
          <div className="absolute top-0 right-12 w-[300px] transform -rotate-6 scale-95 opacity-60 pointer-events-none">
            <TicketCard listing={MOCK_LISTINGS[2] as any} />
          </div>
          <div className="absolute top-8 left-4 w-[300px] transform rotate-3 z-10 shadow-2xl">
            <TicketCard listing={MOCK_LISTINGS[1] as any} />
          </div>
        </div>
      </section>

      {/* SEARCH BAR SECTION */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto -mt-6 mb-16 relative z-20">
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={20}
          backgroundOpacity={0.4}
          distortionScale={-60}
          displace={1}
          className="p-4 shadow-xl"
        >
          <div className="flex flex-col md:flex-row items-center gap-3 w-full">
            <div className="flex items-center gap-2 flex-grow w-full md:w-auto bg-slate-900/60 rounded-xl px-4 py-3 border border-white/5">
              <Search className="w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by route, event, or city (e.g. Pune, Wankhede)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder-slate-500 w-full"
              />
            </div>
            <Link
              href={`/tickets?query=${encodeURIComponent(searchQuery)}`}
              className="btn-primary w-full md:w-auto px-8 py-3 text-sm h-full"
            >
              Find Tickets
            </Link>
          </div>
        </GlassSurface>

        {/* Category quick selectors */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {['all', 'train', 'bus', 'ipl', 'concert', 'event'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all ${
                activeTab === cat 
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' 
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-300 hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? '🔍 All Categories' : cat}
            </button>
          ))}
        </div>
      </section>

      {/* LIVE LISTINGS GRID */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto mb-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black font-display">🔴 Live Tickets Right Now</h2>
            <p className="text-sm text-slate-400 mt-1">Updates in real-time. Direct peer-to-peer contact verification.</p>
          </div>
          <Link href="/tickets" className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.slice(0, 3).map((listing) => (
            <TicketCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 md:px-12 py-16 bg-[#090d16]/50 border-y border-white/5 mb-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-black font-display">How It Works</h2>
            <p className="text-sm text-slate-400 mt-2">Connect in 3 simple steps. No middlemen, no commissions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-xl font-bold">1</div>
              <h3 className="font-bold text-lg">List or Browse</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Transferors list unwanted tickets at 30-90% of value. Seekers search by date and route.
              </p>
            </div>
            
            <div className="glass-card p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-xl font-bold">2</div>
              <h3 className="font-bold text-lg">Express Interest</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seekers click &quot;I&apos;m Interested&quot;. Sellers review credentials and accept the match.
              </p>
            </div>

            <div className="glass-card p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto text-xl font-bold">3</div>
              <h3 className="font-bold text-lg">Chat & Transfer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use our real-time messaging to verify and exchange ticket files and payments directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & ADVANTAGES */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto mb-20">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-3xl font-black font-display leading-tight">Why LastMinutePass?</h2>
          <p className="text-sm text-slate-400 mt-2">
            We prioritize safety, fairness, and speed above everything else to deliver a trustworthy experience.
          </p>
        </div>

        <MagicBento
          cardData={trustCards}
          textAutoHide
          enableStars
          enableSpotlight
          enableBorderGlow
          enableTilt={false}
          enableMagnetism
          clickEffect
          spotlightRadius={280}
          particleCount={10}
          glowColor="59, 130, 246"
        />
      </section>

      {/* FAQ SECTION */}
      <section className="px-6 md:px-12 max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl md:text-3xl font-black font-display text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index} 
                className="glass-card p-5 cursor-pointer select-none"
                onClick={() => setOpenFaq(isOpen ? null : index)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-200">{faq.q}</h3>
                  <span className="text-slate-400 font-bold">{isOpen ? '−' : '+'}</span>
                </div>
                {isOpen && (
                  <p className="text-xs text-slate-400 leading-relaxed mt-3 border-t border-white/5 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-xs text-slate-500 mt-20 pt-8 border-t border-white/5">
        <p>Made with ❤️ in India for last-minute travelers.</p>
        <p className="mt-2">© 2026 LastMinutePass. All rights reserved.</p>
      </footer>
    </div>
  );
}
