import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Tag, Clock, ArrowRight, Star, ShieldCheck } from 'lucide-react';
import BorderGlow from './react-bits/BorderGlow';

interface Listing {
  id: string;
  title: string;
  description?: string;
  category_id: number;
  origin_city?: string;
  destination_city?: string;
  event_name?: string;
  venue_name?: string;
  venue_city?: string;
  event_date: string;
  departure_time?: string;
  original_price: string;
  asking_price: string;
  ticket_photos?: string[];
  status: string;
  view_count: number;
  interest_count: number;
  expires_at: string;
  owner: {
    name: string;
    avg_rating: number;
    phone_verified: boolean;
  };
  category: {
    slug: string;
    name: string;
    icon: string;
    color_hex: string;
  };
}

interface TicketCardProps {
  listing: Listing;
}

export const TicketCard: React.FC<TicketCardProps> = ({ listing }) => {
  const savings = parseFloat(listing.original_price) - parseFloat(listing.asking_price);
  const savingsPct = Math.round((savings / parseFloat(listing.original_price)) * 100);

  // Expiry parsing
  const expDate = new Date(listing.expires_at);
  const isUrgent = (expDate.getTime() - Date.now()) < 2 * 60 * 60 * 1000; // < 2 hours

  return (
    <BorderGlow
      backgroundColor="#0d1117"
      borderRadius={16}
      glowRadius={28}
      colors={isUrgent ? ['#f59e0b', '#ef4444', '#f59e0b'] : ['#3b82f6', '#8b5cf6', '#22d3ee']}
      glowColor={isUrgent ? '38 92 60' : '217 91 60'}
      className={isUrgent ? 'animate-pulse' : ''}
    >
      <div className="relative rounded-2xl flex flex-col justify-between h-[360px] select-none">
      {/* Category Indicator Top Bar */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: listing.category.color_hex || '#3b82f6' }}
      />

      <div className="p-5 flex-1 flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur px-2.5 py-1 rounded-full border border-white/5 text-xs text-slate-300">
            <span>{listing.category.icon}</span>
            <span className="font-semibold uppercase tracking-wider text-[10px]">{listing.category.name}</span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Asking Price</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">₹{Math.round(parseFloat(listing.asking_price))}</span>
            <span className="text-[10px] text-slate-500 line-through">₹{Math.round(parseFloat(listing.original_price))}</span>
          </div>
        </div>

        {/* Journey or Event Details */}
        <div className="my-4">
          {listing.category.slug === 'train' || listing.category.slug === 'bus' ? (
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{listing.origin_city}</h3>
                <span className="text-xs text-slate-400">Origin</span>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-500 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-slate-100">{listing.destination_city}</h3>
                <span className="text-xs text-slate-400">Destination</span>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-slate-100 line-clamp-1">{listing.event_name}</h3>
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span className="line-clamp-1">{listing.venue_name}, {listing.venue_city}</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider dotted line simulation for ticket look */}
        <div className="relative my-3 flex items-center justify-between">
          <div className="absolute -left-7 w-4 h-4 bg-[#030510] rounded-full border-r border-white/5" />
          <div className="w-full border-t border-dashed border-white/10" />
          <div className="absolute -right-7 w-4 h-4 bg-[#030510] rounded-full border-l border-white/5" />
        </div>

        {/* Date and Time Details */}
        <div className="flex justify-between items-center text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>{listing.event_date}</span>
          </div>
          {listing.departure_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{listing.departure_time.substring(0, 5)}</span>
            </div>
          )}
        </div>

        {/* Footer: Seller details + savings tag */}
        <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium">{listing.owner.name}</span>
              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                <Star className="w-3 h-3 fill-current" />
                <span>{listing.owner.avg_rating || '5.0'}</span>
                {listing.owner.phone_verified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-0.5 fill-current" />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              Save {savingsPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Click overlay */}
      <Link href={`/tickets/${listing.id}`} className="absolute inset-0 z-10" />
      </div>
    </BorderGlow>
  );
};
