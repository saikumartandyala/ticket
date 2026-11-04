import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION, SITE_NAME } from '../lib/seo';

/** Web app manifest: name, colours and icons for "Add to home screen". */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: unused tickets, fair prices`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f3ee',
    theme_color: '#f5f3ee',
    lang: 'en-IN',
    categories: ['shopping', 'travel', 'entertainment'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/brand/tickorbit-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
