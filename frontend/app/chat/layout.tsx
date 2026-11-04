import type { Metadata } from 'next';
import { privateMetadata } from '../../lib/seo';

// Private conversations between two users. Not for search engines: noindex, and no canonical to the home page.
export const metadata: Metadata = { ...privateMetadata('Chat'), alternates: { canonical: null } };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
