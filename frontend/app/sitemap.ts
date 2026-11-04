import type { MetadataRoute } from 'next';
import { absoluteUrl, fetchPublic, type PublicListing } from '../lib/seo';

// Rebuilt at most every 10 minutes; open listings come and go quickly.
export const revalidate = 600;

/**
 * /sitemap.xml: only canonical, indexable URLs. Private pages (admin,
 * dashboard, chat, sign-in, sell form) are never listed; closed listings drop
 * out automatically because the public feed only contains open ones.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/tickets'), lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
  ];
  const open = (await fetchPublic<PublicListing[]>('/listings', 600)) ?? [];
  for (const l of open.slice(0, 5000)) {
    pages.push({
      url: absoluteUrl(`/tickets/${l.id}`),
      lastModified: new Date(l.created_at),
      changeFrequency: 'hourly',
      priority: 0.6,
    });
  }
  return pages;
}
