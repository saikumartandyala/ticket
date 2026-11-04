import type { Metadata } from 'next';
import { privateMetadata } from '../../lib/seo';

// Sell form; requires sign-in. Not for search engines: noindex, and no canonical to the home page.
export const metadata: Metadata = { ...privateMetadata('Sell a ticket'), alternates: { canonical: null } };

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
