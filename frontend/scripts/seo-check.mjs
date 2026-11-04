#!/usr/bin/env node
/**
 * SEO regression check. Crawls robots.txt, the sitemap and every URL in it,
 * plus the private pages that must stay out of search, and fails (exit 1) on
 * anything Google would penalise.
 *
 *   npm run seo:check                       # https://tickorbit.in
 *   npm run seo:check -- https://localhost:3000 --api https://localhost:8000
 *
 * No dependencies: Node 18+ fetch and regular expressions.
 */
const args = process.argv.slice(2);
const SITE = (args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--api')) || 'https://tickorbit.in').replace(/\/+$/, '');
const API = (args.includes('--api') ? args[args.indexOf('--api') + 1] : SITE.replace('://', '://api.')).replace(/\/+$/, '');
// Canonical (public) origin. Pages fetched from a local/preview SITE must still point here.
const ORIGIN = (args.includes('--origin') ? args[args.indexOf('--origin') + 1] : 'https://tickorbit.in').replace(/\/+$/, '');
const PRIVATE = ['/auth', '/dashboard', '/post', '/chat/00000000-0000-0000-0000-000000000000', '/admin', '/admin/login'];

let failures = 0;
let warnings = 0;
const fail = (where, msg) => { failures++; console.log(`  FAIL  ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`  warn  ${where}: ${msg}`); };
const ok = (where, msg) => console.log(`  ok    ${where}: ${msg}`);

async function get(url) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'TickOrbitSEOCheck/1.0 (+https://tickorbit.in)' } });
  return { status: res.status, headers: res.headers, text: res.status < 300 ? await res.text() : '' };
}

const attr = (html, re) => (html.match(re) || [])[1]?.trim();
const meta = (html, name) =>
  attr(html, new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, 'i')) ??
  attr(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`, 'i'));

function decode(s = '') {
  return s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function checkPage(url, canonicalUrl, seenTitles) {
  const path = url.replace(SITE, '') || '/';
  const before = failures;
  const r = await get(url);
  if (r.status !== 200) return fail(path, `HTTP ${r.status} (sitemap URLs must return 200)`);
  const html = r.text;
  const title = decode(attr(html, /<title>([^<]*)<\/title>/i));
  const desc = decode(meta(html, 'description'));
  const canonical = attr(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const robots = meta(html, 'robots') || '';
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const jsonld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

  if (!title) fail(path, 'missing <title>');
  else if (title.length > 70) warn(path, `title is ${title.length} chars (Google shows ~60): "${title}"`);
  if (title && seenTitles.has(title)) fail(path, `duplicate title also used by ${seenTitles.get(title)}`);
  if (title) seenTitles.set(title, path);
  if (!desc) fail(path, 'missing meta description');
  else if (desc.length < 50 || desc.length > 300) warn(path, `description is ${desc.length} chars`);
  if (!canonical) fail(path, 'missing canonical');
  else if (canonical.replace(/\/$/, '') !== canonicalUrl.replace(/\/$/, '')) fail(path, `canonical ${canonical} != ${canonicalUrl}`);
  if (/noindex/i.test(robots)) fail(path, `listed in sitemap but robots="${robots}"`);
  if (!meta(html, 'og:title') || !meta(html, 'og:image')) fail(path, 'missing og:title / og:image');
  if (!meta(html, 'twitter:card')) warn(path, 'missing twitter:card');
  if (h1 !== 1) warn(path, `${h1} <h1> in server HTML (expected 1)`);
  for (const block of jsonld) {
    try { JSON.parse(block); } catch { fail(path, 'invalid JSON-LD'); }
  }
  if (failures === before) ok(path, `"${title}"`);
}

async function main() {
  console.log(`SEO check for ${SITE} (API ${API})\n`);

  console.log('robots.txt');
  const robots = await get(`${SITE}/robots.txt`);
  if (robots.status !== 200) fail('/robots.txt', `HTTP ${robots.status}`);
  else {
    if (!/Sitemap:\s*\S+/i.test(robots.text)) fail('/robots.txt', 'no Sitemap: line');
    if (/^Disallow:\s*\/\s*$/m.test(robots.text)) warn('/robots.txt', 'blocks the whole site (expected only on preview/local)');
    else ok('/robots.txt', 'allows crawling, lists the sitemap');
  }

  console.log('\nsitemap.xml');
  const sm = await get(`${SITE}/sitemap.xml`);
  const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (sm.status !== 200 || urls.length === 0) fail('/sitemap.xml', `HTTP ${sm.status}, ${urls.length} URLs`);
  else ok('/sitemap.xml', `${urls.length} URLs`);
  for (const u of urls) {
    if (!u.startsWith(ORIGIN)) fail('/sitemap.xml', `URL not on ${ORIGIN}: ${u}`);
    if (PRIVATE.some((p) => new URL(u).pathname.startsWith(p))) fail('/sitemap.xml', `private URL listed: ${u}`);
  }

  console.log('\nindexable pages (from the sitemap)');
  const titles = new Map();
  for (const u of urls) await checkPage(u.replace(ORIGIN, SITE), u, titles);

  console.log('\nprivate pages (must be noindex)');
  for (const p of PRIVATE) {
    const r = await get(`${SITE}${p}`);
    const robotsMeta = meta(r.text, 'robots') || '';
    if (r.status === 200 && !/noindex/i.test(robotsMeta)) fail(p, 'indexable! add noindex');
    else ok(p, r.status === 200 ? `robots="${robotsMeta}"` : `HTTP ${r.status}`);
  }

  console.log('\nstatus codes');
  const nf = await get(`${SITE}/this-page-does-not-exist-${Date.now()}`);
  nf.status === 404 ? ok('unknown URL', '404') : fail('unknown URL', `HTTP ${nf.status} (soft 404)`);

  console.log('\nAPI host');
  try {
    const ar = await get(`${API}/robots.txt`);
    /Disallow:\s*\/\s*$/m.test(ar.text) ? ok(`${API}/robots.txt`, 'blocks crawling') : fail(`${API}/robots.txt`, `HTTP ${ar.status}, not blocking`);
    const ah = await get(`${API}/api/v1/categories`);
    /noindex/i.test(ah.headers.get('x-robots-tag') || '') ? ok('API responses', 'X-Robots-Tag: noindex') : fail('API responses', 'no X-Robots-Tag: noindex');
  } catch (e) {
    warn('API host', `unreachable (${e.message})`);
  }

  console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
