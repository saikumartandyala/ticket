export interface User {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  avg_rating: number;
  rating_count: number;
  total_listings: number;
  total_matches: number;
  is_admin?: boolean;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
}

export interface Listing {
  id: string;
  user_id: string;
  category_id: number;
  title: string;
  description?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  operator_name?: string | null;
  operator_code?: string | null;
  event_name?: string | null;
  venue_name?: string | null;
  venue_city?: string | null;
  section?: string | null;
  row_number?: string | null;
  seat_count: number;
  seat_details?: Record<string, any> | null;
  event_date: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  original_price: string | number;
  asking_price: string | number;
  pnr_last_four?: string | null;
  ticket_photos: string[];
  status: string;
  view_count: number;
  interest_count: number;
  expires_at: string;
  created_at: string;
  owner: User;
  category: Category;
}

export type MatchStatus = 'pending' | 'accepted' | 'declined' | 'contact_revealed' | 'transferred' | 'cancelled' | 'expired';

export interface Match {
  id: string;
  listing_id: string;
  seeker_id: string;
  transferor_id: string;
  status: MatchStatus | string;
  seeker_note?: string | null;
  created_at: string;
  updated_at: string;
  listing?: Listing | null;
  seeker?: User | null;
  transferor?: User | null;
}

export interface Message {
  id: string;
  match_id?: string;
  sender_id: string;
  content: string;
  msg_type?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  category_id?: number | null;
  origin_city?: string | null;
  destination_city?: string | null;
  event_name?: string | null;
  venue_city?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  max_price?: string | number | null;
  is_active: boolean;
  fire_count: number;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  notif_type: string;
  is_read: boolean;
  data?: Record<string, any> | null;
  created_at: string;
}
