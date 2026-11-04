import { TrainFront, BusFront, Trophy, CircleDot, Music, CalendarDays, type LucideIcon } from 'lucide-react';

export type CategoryKind = 'route' | 'venue';

export interface CategoryDef {
  id: number;
  slug: string;
  name: string;
  hint: string;
  kind: CategoryKind;
  icon: LucideIcon;
}

/** Mirrors the backend's seeded categories (GET /categories). */
export const CATEGORIES: CategoryDef[] = [
  { id: 1, slug: 'train', name: 'Train', hint: 'Confirmed berths & seats', kind: 'route', icon: TrainFront },
  { id: 2, slug: 'bus', name: 'Bus', hint: 'Sleeper & seater', kind: 'route', icon: BusFront },
  { id: 3, slug: 'ipl', name: 'IPL', hint: 'Stadium entry', kind: 'venue', icon: Trophy },
  { id: 4, slug: 'cricket', name: 'Cricket', hint: 'International & domestic', kind: 'venue', icon: CircleDot },
  { id: 5, slug: 'concert', name: 'Concert', hint: 'Gigs & live shows', kind: 'venue', icon: Music },
  { id: 6, slug: 'event', name: 'Event', hint: 'Conferences, expos, more', kind: 'venue', icon: CalendarDays },
];

export function categoryBySlug(slug?: string | null): CategoryDef | undefined {
  if (!slug) return undefined;
  return CATEGORIES.find((c) => c.slug === slug.toLowerCase());
}

export function categoryById(id?: number | null): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryFor(listing: { category?: { slug?: string } | null; category_id?: number }): CategoryDef {
  return categoryBySlug(listing.category?.slug) || categoryById(listing.category_id) || CATEGORIES[5];
}
