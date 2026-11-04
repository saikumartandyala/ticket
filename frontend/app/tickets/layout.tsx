import type { Metadata } from 'next';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Unused concert, event, match & bus tickets in India',
  description:
    'Browse unused concert, event, match and bus tickets listed by real people across India. Fair prices capped below face value, no fees, and every listing closes at showtime or departure.',
  path: '/tickets',
});

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
