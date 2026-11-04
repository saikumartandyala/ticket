/**
 * Single source of truth for SEO: site identity, per-page metadata with
 * canonical URLs, and JSON-LD structured data.
 *
 * Every public route builds its <head> through `pageMetadata()`, so titles,
 * descriptions, canonicals, Open Graph and Twitter cards stay consistent and
 * new pages inherit the right defaults. Private routes use `privateMetadata()`
 * (noindex). Nothing here renders visible UI.
 */
import type { Metadata } from 'next';

/** Canonical origin. Always https and non-www (www redirects here at Vercel). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tickorbit.in').replace(/\/+$/, '');
export const SITE_NAME = 'TickOrbit';
export const TAGLINE = 'Every ticket deserves a destination';
export const DEFAULT_DESCRIPTION =
  'TickOrbit is a free peer-to-peer board for unused tickets in India. Pass on concert, event, match and bus tickets you can’t use at a fair price, capped below what you paid, and chat privately to hand them over.';

/** Server-side API base (the same value the browser uses). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:8000/api/v1';

/** Only the production deployment may be indexed (never previews or local dev). */
export const IS_INDEXABLE_DEPLOYMENT =
  process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.NODE_ENV === 'production';

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

type PageSeo = {
  /** Page title without the brand; the root template appends " · TickOrbit". */
  title: string;
  description: string;
  /** Path of the canonical URL, e.g. "/tickets". */
  path: string;
  /** Use the title as-is (no brand suffix), e.g. for the home page. */
  absoluteTitle?: boolean;
  noindex?: boolean;
  images?: { url: string; width?: number; height?: number; alt?: string }[];
};

/** Default social share image (app/opengraph-image.png). */
export const DEFAULT_OG_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: `${SITE_NAME}: ${TAGLINE}` };

/** Metadata for an indexable public page. */
export function pageMetadata({ title, description, path, absoluteTitle, noindex, images = [DEFAULT_OG_IMAGE] }: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    // Absolute so nested layouts can't drop or double the brand suffix.
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_IN',
      url,
      title: fullTitle,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: images.map((i) => i.url),
    },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

/** Metadata for signed-in / private pages: never indexed, links still followed. */
export function privateMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: true, nocache: true, googleBot: { index: false, follow: true } },
  };
}

/* ------------------------------------------------------------------ structured data */

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl('/brand/tickorbit-logo.png'),
  },
  slogan: TAGLINE,
  areaServed: { '@type': 'Country', name: 'India' },
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  inLanguage: 'en-IN',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** Serialize JSON-LD safely for a <script> tag (no "</script>" breakout). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/* ------------------------------------------------------------------ server-side data */

export type PublicListing = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  event_date: string;
  departure_time: string | null;
  expires_at: string;
  created_at: string;
  asking_price: string | number;
  original_price: string | number;
  origin_city: string | null;
  destination_city: string | null;
  event_name: string | null;
  venue_name: string | null;
  venue_city: string | null;
  category?: { slug: string; name: string } | null;
};

/** Fetch public JSON from the API on the server, cached briefly. Never throws. */
export async function fetchPublic<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
