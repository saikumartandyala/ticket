import type { Metadata } from 'next';
import { privateMetadata } from '../../lib/seo';

// Signed-in user's own dashboard. Not for search engines: noindex, and no canonical to the home page.
export const metadata: Metadata = { ...privateMetadata('Your dashboard'), alternates: { canonical: null } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
