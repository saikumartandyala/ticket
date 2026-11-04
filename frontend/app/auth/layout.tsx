import type { Metadata } from 'next';
import { privateMetadata } from '../../lib/seo';

// Sign-in / registration form. Not for search engines: noindex, and no canonical to the home page.
export const metadata: Metadata = { ...privateMetadata('Sign in'), alternates: { canonical: null } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
