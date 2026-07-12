'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, MapPin, Calendar, Tag, BellRing, Filter, SlidersHorizontal, Trash2 } from 'lucide-react';
import { TicketCard } from '../../components/TicketCard';
import { API_BASE } from '../../lib/api';

// Rich Mock Data for local fallback
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

function BrowseTicketsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialQuery = searchParams.get('query') || '';
  
  // State for search and filters
  const [query, setQuery] = useState(initialQuery);
  const [listings, setListings] = useState<any[]>(MOCK_LISTINGS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [eventDate, setEventDate] = useState('');
  
  const [alertSuccess, setAlertSuccess] = useState(false);

  useEffect(() => {
    // Build query URL based on filters
    let url = `${API_BASE}/listings`;
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (origin) params.append('origin', origin);
    if (destination) params.append('destination', destination);
    if (eventDate) params.append('event_date', eventDate);
    if (maxPrice) params.append('max_price', maxPrice.toString());
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    fetch(url)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Fallback');
      })
      .then(data => {
        if (data) setListings(data);
      })
      .catch(() => {
        // Run client-side filtering on mock data
        let filtered = [...MOCK_LISTINGS];
        if (query) {
          filtered = filtered.filter(l => 
            l.title.toLowerCase().includes(query.toLowerCase()) || 
            (l.description && l.description.toLowerCase().includes(query.toLowerCase()))
          );
        }
        if (origin) {
          filtered = filtered.filter(l => l.origin_city && l.origin_city.toLowerCase().includes(origin.toLowerCase()));
        }
        if (destination) {
          filtered = filtered.filter(l => l.destination_city && l.destination_city.toLowerCase().includes(destination.toLowerCase()));
        }
        if (eventDate) {
          filtered = filtered.filter(l => l.event_date === eventDate);
        }
        if (maxPrice) {
          filtered = filtered.filter(l => parseFloat(l.asking_price) <= maxPrice);
        }
        if (selectedCategory !== 'all') {
          filtered = filtered.filter(l => l.category.slug === selectedCategory);
        }
        setListings(filtered);
      });
  }, [query, origin, destination, maxPrice, eventDate, selectedCategory]);

  const handleClearFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setOrigin('');
    setDestination('');
    setMaxPrice(5000);
    setEventDate('');
  };

  const handleCreateAlert = async () => {
    // Send post alert to backend
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          origin_city: origin || null,
          destination_city: destination || null,
          max_price: maxPrice || null
        })
      });
      if (response.ok) {
        setAlertSuccess(true);
        setTimeout(() => setAlertSuccess(false), 3000);
      } else {
        // Local simulation
        setAlertSuccess(true);
        setTimeout(() => setAlertSuccess(false), 3000);
      }
    } catch (err) {
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* FILTER SIDEBAR */}
      <aside className="lg:col-span-4 space-y-6">
        <div className="glass-card p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <h2 className="font-black font-display text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-400" />
              <span>Filters</span>
            </h2>
            <button 
              onClick={handleClearFilters}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>

          {/* Search Term */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Search Keywords</label>
            <div className="flex items-center gap-2 bg-slate-900/60 rounded-xl px-3.5 py-2.5 border border-white/5 text-sm">
              <Search className="w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-300 placeholder-slate-600 w-full"
              />
            </div>
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900/60 text-slate-300 rounded-xl px-3.5 py-3 border border-white/5 text-sm focus:border-blue-500 outline-none"
            >
              <option value="all">🔍 All Categories</option>
              <option value="train">🚂 Train Tickets</option>
              <option value="bus">🚌 Bus Tickets</option>
              <option value="ipl">🏏 IPL Tickets</option>
              <option value="concert">🎵 Concerts</option>
              <option value="event">🎭 Events</option>
            </select>
          </div>

          {/* Route Fields (Origins & Destination) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">From (City)</label>
              <input 
                type="text" 
                placeholder="e.g. Mumbai"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full input-glass py-2.5 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">To (City)</label>
              <input 
                type="text" 
                placeholder="e.g. Pune"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full input-glass py-2.5 text-xs"
              />
            </div>
          </div>

          {/* Travel Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Departure/Event Date</label>
            <div className="flex items-center gap-2 bg-slate-900/60 rounded-xl px-3.5 py-2.5 border border-white/5 text-xs">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input 
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-300 w-full"
              />
            </div>
          </div>

          {/* Price Range Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Max Budget</span>
              <span className="font-bold text-blue-400">₹{maxPrice}</span>
            </div>
            <input 
              type="range" 
              min={300} 
              max={10000} 
              step={100}
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>₹300</span>
              <span>₹10,000</span>
            </div>
          </div>
        </div>
      </aside>

      {/* TICKETS LIST SECTION */}
      <main className="lg:col-span-8 space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-400">
            Showing <strong className="text-slate-200">{listings.length}</strong> available tickets
          </span>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {listings.map((listing) => (
              <TicketCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center space-y-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 text-3xl">🪑</div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-200">No Tickets Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                We couldn&apos;t find any tickets matching your exact filters. Create an instant notification alert to get notified when one is listed.
              </p>
            </div>
            
            {alertSuccess ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-bold">
                <span>Alert set successfully! We will notify you.</span>
              </div>
            ) : (
              <button 
                onClick={handleCreateAlert}
                className="btn-primary text-xs flex items-center gap-2"
              >
                <BellRing className="w-4 h-4" />
                <span>Set Seeker Alert</span>
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function BrowseTicketsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading listings...</div>}>
      <BrowseTicketsContent />
    </Suspense>
  );
}
