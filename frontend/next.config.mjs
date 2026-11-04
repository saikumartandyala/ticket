/**
 * Browser security headers for every page.
 *
 * - HTTPS only: upgrade-insecure-requests + HSTS (HSTS in production only,
 *   so it never sticks to "localhost" in your browser).
 * - CSP: scripts, styles and fonts only from this site; network calls only to
 *   this site and the API over https:// / wss://; no plugins, no framing.
 *   'unsafe-inline' scripts are needed for Next's inline bootstrap and the
 *   theme no-flash script; 'unsafe-eval' only in development (hot reload).
 */
const isDev = process.env.NODE_ENV !== 'production';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:8000/api/v1';

if (!isDev && apiUrl && !apiUrl.startsWith('https://') && !apiUrl.startsWith('/')) {
  throw new Error(`NEXT_PUBLIC_API_URL must use https:// (got ${apiUrl})`);
}

let apiOrigin = '';
let wsOrigin = '';
try {
  const u = new URL(apiUrl);
  apiOrigin = u.origin;
  wsOrigin = `wss://${u.host}`;
} catch {
  // Relative API URL: same origin as the site.
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Ticket photos live in Supabase Storage in production.
  `img-src 'self' data: blob: ${apiOrigin} https://*.supabase.co`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin}`.trim(),
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Admin pages are never cached by the browser or proxies.
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
