# TickOrbit SEO report & playbook

Status as of 2026-11-05. Covers the audit, what was implemented, how to verify
it, and what to do next. Everything here was built additively: no UI, flow,
API contract or database change.

- Sitemap: https://tickorbit.in/sitemap.xml
- Robots: https://tickorbit.in/robots.txt
- Check anything at any time: `cd frontend && npm run seo:check`

---

## 1. Audit (before)

| Area | Finding | Impact |
|---|---|---|
| robots.txt / sitemap | Both returned **404** | Google had no crawl guidance and no list of pages |
| Titles & descriptions | **Same title and description on every page** | Duplicate titles, no per-page relevance |
| Canonicals | None anywhere | Duplicate-URL risk (query params, www) |
| Social cards | Open Graph without image or URL, no Twitter card | Bare link previews on WhatsApp / X / LinkedIn |
| Private pages | `/auth`, `/dashboard`, `/post`, `/chat` were **indexable** | Thin/private pages could appear in search |
| `/tickets` server HTML | Empty shell (378 chars, **no H1**) until JavaScript ran | Weak first-crawl signal for the main browse page |
| Listing pages | Generic title, rendered only in the browser, not in any sitemap | Listings effectively invisible to search |
| Structured data | None | No Organization / WebSite / Breadcrumb understanding |
| API host | `api.tickorbit.in` had no robots rules, JSON indexable | Junk results on the brand query |
| Performance | Header logos 226 KB per page (light + dark), images ~8× larger than displayed | Slower LCP on mobile |
| Already good | HTTPS + HSTS, www→apex 308, http→https 308, real 404s, mobile-responsive layout, self-hosted fonts with `display: swap`, ~103–124 KB JS per route | — |

**Rendering model:** Next.js 15 App Router. Most pages are client components
that Next pre-renders to HTML at build time; data (listings) loads in the
browser. Metadata, sitemap, robots and structured data are now generated on the
server, so they don't depend on JavaScript.

## 2. What was implemented

| Change | Files | Why it matters |
|---|---|---|
| Central SEO module: site URL, `pageMetadata()` (title, description, canonical, OG, Twitter, robots), `privateMetadata()`, JSON-LD builders | `frontend/lib/seo.ts` (new) | One place to keep every page consistent; new pages inherit it |
| Site-wide metadata: `metadataBase`, title template, canonical, OG + Twitter with image, robots (index only on production), `formatDetection`, optional Search Console tag | `frontend/app/layout.tsx` | Correct absolute URLs and rich link previews everywhere |
| Organization + WebSite JSON-LD (no ratings, reviews or invented details) | `frontend/app/layout.tsx` | Helps Google understand the brand and site |
| Per-route metadata layouts (render `children` only, no UI) | `app/tickets/layout.tsx`, `app/tickets/[id]/layout.tsx`, `app/auth|dashboard|post|chat/layout.tsx` (new), `app/admin/layout.tsx` | Unique titles; private pages `noindex`; no page inherits the home canonical |
| Listing pages: server-generated title, description, canonical, BreadcrumbList; **closed or unknown listings are `noindex`** | `app/tickets/[id]/layout.tsx` | Each open listing is a findable page; expired ones never pollute results |
| Listing data read from the public feed, **not** `GET /listings/{id}` | `app/tickets/[id]/layout.tsx` | That endpoint counts a view; crawlers and server renders must not inflate sellers' view counts (verified: 0 → 0) |
| `/sitemap.xml` (home, browse, every open listing; revalidated every 10 min) | `app/sitemap.ts` (new) | Fast discovery; only canonical, indexable URLs |
| `/robots.txt` (production: allow, block endless `?query=/?sort=/?max=` URLs; preview/local: block all) | `app/robots.ts` (new) | Crawl budget on real pages; staging never indexed |
| Web app manifest + 512 px icon | `app/manifest.ts`, `public/brand/tickorbit-icon-512.png` (new) | "Add to home screen", consistent app identity |
| Share image 1200×630 (OG + X) | `app/opengraph-image.png`, `app/twitter-image.png` (+ alt text) | Branded previews when links are shared |
| `/tickets` loading state renders the same header as the page | `app/tickets/page.tsx` | Server HTML now has the H1 and intro; final UI identical |
| Brand images re-exported at 3× display size | `design/make_brand.py`, `public/brand/*.png`, `components/site/Logo.tsx` (intrinsic sizes) | 226 KB → 67 KB per page for header logos (-70%), visually identical |
| Brand images cached 1 day + background refresh | `frontend/next.config.mjs` | Faster repeat visits |
| API host: `X-Robots-Tag: noindex, nofollow` on every response + `robots.txt` blocking all | `backend/app/core/http_security.py`, `backend/app/main.py` | Keeps raw JSON out of Google; no API data change |
| SEO regression checker | `frontend/scripts/seo-check.mjs`, `npm run seo:check` | Catches missing titles, wrong canonicals, accidental noindex, private URLs in sitemap, soft 404s |

## 3. Files

**Created:** `frontend/lib/seo.ts`, `frontend/app/robots.ts`,
`frontend/app/sitemap.ts`, `frontend/app/manifest.ts`,
`frontend/app/opengraph-image.png`, `frontend/app/twitter-image.png` (+ `.alt.txt`),
`frontend/app/tickets/layout.tsx`, `frontend/app/tickets/[id]/layout.tsx`,
`frontend/app/{auth,dashboard,post,chat}/layout.tsx`,
`frontend/public/brand/tickorbit-icon-512.png`, `frontend/scripts/seo-check.mjs`,
`docs/SEO.md`.

**Modified:** `frontend/app/layout.tsx`, `frontend/app/admin/layout.tsx`,
`frontend/app/tickets/page.tsx`, `frontend/components/site/Logo.tsx`,
`frontend/next.config.mjs`, `frontend/package.json`,
`frontend/public/brand/*.png`, `design/make_brand.py`,
`backend/app/core/http_security.py`, `backend/app/main.py`.

**Not touched:** database models/migrations, API endpoints and payloads,
authentication, business logic, components' markup and styles.

## 4. Technical SEO checklist

- [x] HTTPS only, HSTS, http→https and www→apex permanent redirects
- [x] Unique `<title>` and meta description on every indexable page
- [x] Absolute canonical on every indexable page; none on private pages
- [x] Open Graph + Twitter cards with a 1200×630 image
- [x] `robots` meta: index on production public pages, `noindex` on private pages, everything `noindex` on previews/local
- [x] `/robots.txt` with sitemap; private pages left crawlable so Google can see their `noindex`
- [x] `/sitemap.xml` with only canonical, indexable, 200-status URLs
- [x] Real 404 status for unknown URLs; closed listings `noindex`
- [x] Organization, WebSite, BreadcrumbList JSON-LD (valid JSON, no fabricated data)
- [x] One H1 in the server HTML of `/` and `/tickets`
- [x] Viewport, `lang`, theme colour, manifest, icons
- [x] API host excluded from search
- [ ] Listing pages render their *content* (not only metadata) on the server (see §10)
- [ ] Category landing pages (see §6)
- [ ] Search Console property + sitemap submission (needs you, see §7)

## 5. Keyword strategy

### What TickOrbit is (from the product, not assumptions)
A free peer-to-peer board in India where people who can't use a ticket list it
below face value (30–90%), buyers request it, and both sides chat privately to
hand it over and settle directly. No payments through the platform, no fees.

### Compliance first (affects which keywords we target)
- **Train tickets:** Indian Railways allows transferring a confirmed ticket
  only to specified **family members**, through its official name-change
  process; selling it to a stranger isn't permitted.
  ([The News Minute](https://www.thenewsminute.com/news/now-you-can-transfer-your-train-ticket-someone-else-conditions-apply-77767),
  [Passengers (Change of Name) Rules, 1990](https://saral.vidhilegalpolicy.in/docs/saral-resources/saral-laws/transport/SARAL_Railways%20(Passengers_%20Change%20of%20Name)%20Rules,%201990.pdf))
- **IPL / cricket:** organisers restrict resale and may cancel tickets resold
  for profit; reported crackdowns on illegal resale.
  ([Free Press Journal](https://www.freepressjournal.in/sports/bcci-announces-ipl-2026-playoffs-ticket-sale-rupay-priority-may-20-22-open-sales-may-21-23),
  [UNI](https://test.uniindia.com/news/sports/sports-ksca-ipl-ticket-scam/3834722.html))
- **So we do NOT target** "buy train ticket from someone", "IPL tickets
  resale", "tatkal ticket for sale" or similar. They would attract rule-breaking
  traffic and invite takedown/legal risk. **Get a legal review of the train and
  IPL categories before promoting them.** Search engines reward trust; this is
  also the strongest positioning against grey-market sellers.

### Keyword clusters (no search-volume figures are claimed; validate in Search Console / Google Keyword Planner after launch)

| Cluster | Example queries | Intent | Target page | Suggested title | Suggested description |
|---|---|---|---|---|---|
| Core (commercial) | unused tickets India, sell unused concert ticket, can't attend concert sell ticket | Transactional | `/` | TickOrbit — Every ticket deserves a destination | (current site description) |
| Browse (commercial) | concert tickets last minute, event tickets below face value, last minute match tickets | Transactional | `/tickets` | Unused concert, event, match & bus tickets in India | Browse unused tickets listed by real people… |
| City + category (long-tail) | concert tickets Bengaluru tonight, event tickets Mumbai this weekend | Transactional, local | future `/tickets/<category>/<city>` | Unused concert tickets in Bengaluru | Fair-priced tickets from people who can't go… |
| Bus (check operator rules) | transfer bus ticket to another person, sell bus ticket I can't use | Transactional/informational | `/tickets?category=bus` → future landing | Unused bus tickets from people who can't travel | … |
| Safety (informational) | is it safe to buy tickets from strangers, ticket resale scam India, how to verify a ticket QR code | Informational | Blog | How to buy a second-hand ticket safely in India | … |
| How-to (informational, high trust) | how to transfer train ticket to family member, IRCTC name change, cancel vs transfer ticket refund | Informational | Blog | How to transfer a train ticket to a family member (official process) | … |
| Brand | tickorbit, tick orbit | Navigational | `/` | (home) | (home) |

Rules: one primary cluster per page, natural language, no stuffing.

## 6. Recommended landing content (for your approval, not published)

**Category landing pages** (`/tickets/concert`, `/tickets/event`, `/tickets/bus`, later city pages):
H1 "Unused concert tickets in India"; 2–3 sentence intro (what it is, the
30–90% fair-price rule, safety); the live listings for that category (already
built); a short "How it works" (3 steps); 3–5 category FAQs (visible on the
page); links to related categories and safety guides. Each needs a unique
title/description from §5 and goes into the sitemap. *Requires new routes, so
it's listed here for approval.*

**Home additions (copy only):** a short "Why fair prices" paragraph and a
visible link to the safety guide once the blog exists.

## 7. Google Search Console & Analytics (needs you)

1. **Add a Domain property** at https://search.google.com/search-console for
   `tickorbit.in` (covers https, http, www and api).
2. Google shows a **TXT record**. In GoDaddy → DNS → Add → Type `TXT`, Name `@`,
   Value = the text Google gives you. Save, wait a few minutes, click **Verify**.
   (Alternative: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` on the Vercel
   website project to the HTML-tag code and redeploy. The code reads it; no ID
   is hard-coded.)
3. **Sitemaps** → submit `https://tickorbit.in/sitemap.xml`.
4. **URL inspection** → enter `https://tickorbit.in/` → **Request indexing**;
   repeat for `/tickets`.
5. Monitor weekly: **Pages** (indexing errors, "Excluded by noindex" should only
   show private pages), **Performance** (queries, impressions, CTR, position),
   **Core Web Vitals**, **Enhancements → Breadcrumbs**.
6. **GA4 (optional, not installed):** adding Google Analytics needs your
   measurement ID, a cookie-consent banner, and CSP changes for
   `googletagmanager.com`. TickOrbit already has privacy-friendly first-party
   analytics in the admin dashboard; add GA4 only if you need Google Ads
   integration. Tell me the ID and I'll wire it with consent.

Validate structured data any time:
[Rich Results Test](https://search.google.com/test/rich-results) and
[Schema Markup Validator](https://validator.schema.org/) with
`https://tickorbit.in/` and any open listing URL.

## 8. Core Web Vitals notes

- Static HTML for all public routes, served from Vercel's CDN; fonts
  self-hosted with `display: swap`; 103 KB shared JS.
- Header logos now 67 KB total (was 226 KB). Both theme variants still
  download (hidden one included); a future `<picture>`-based switch could halve
  that, but it needs a small markup change, so it's left for approval.
- Animations use CSS transforms/opacity (no layout shift). Measure real-user
  CWV in Search Console → Core Web Vitals after ~28 days of traffic.

## 9. Competitor landscape (observations)

- **Primary sellers** (BookMyShow, District by Zomato, Paytm Insider, team/IPL
  sites) dominate "buy X tickets" queries. Don't compete there.
- **Informal resale** happens on social media groups, classifieds and
  messaging apps, with frequent scam reports. TickOrbit's angle: verified sign-in,
  fair-price cap, private chat with fraud warnings, listings that auto-close.
- **Global resale marketplaces** (viagogo, StubHub, TicketSwap) rank for generic
  resale terms but carry above-face-value pricing and fees. TickOrbit's angle:
  no fees, capped below face value, local.
- **Winning strategy:** own the *safety* and *fair-price* topics (guides,
  scam-awareness content, how-to-transfer explainers that link to official
  processes), plus local long-tail category/city pages. Earn links from
  student communities, city event blogs and consumer-safety writers, never
  from paid link schemes.

## 10. Remaining issues (need approval or input)

1. **Listing page content is rendered in the browser.** Metadata and
   breadcrumbs are server-rendered, but the listing body isn't. Server-rendering
   it means restructuring that page (same look), so it needs your approval.
2. **Home H1 contains every rotating word** ("…train ticket concert ticket IPL
   pass…") because the animation keeps them all in the DOM. Fixing it changes
   that component's markup, so it needs approval.
3. Category/city landing pages and a blog (new routes).
4. Legal review of train and IPL categories (see §5).
5. GA4 / consent (see §7).
6. Vercel Hobby is non-commercial; upgrade to Pro before monetising.

## 11. Deployment checklist

- [x] `npm run build` passes (type-check + lint + 28 routes)
- [x] Backend regression suite passes (69/69)
- [x] Visual check: home, browse, listing, sign-in, sell form, admin unchanged; no console errors
- [x] `npm run seo:check` against the production build passes
- [ ] After deploy: `npm run seo:check` against https://tickorbit.in
- [ ] Search Console: verify domain, submit sitemap (§7)
- [ ] Re-run `npm run seo:check` after any routing or layout change

## 12. 90-day roadmap

**Days 1–14: foundation.** Verify Search Console, submit the sitemap, request
indexing for `/` and `/tickets`. Decide on §10 items 1–2. Legal review of
categories.

**Days 15–45: landing pages + first content.** Build concert/event/bus
category pages (§6). Publish 6–8 articles from the calendar below, starting
with the safety and how-to pieces. Add internal links: home → categories →
guides → listings.

**Days 46–90: authority + iteration.** Publish 2 articles a week. Use Search
Console queries with impressions but low CTR to rewrite titles/descriptions.
Add city pages for the 3 cities with the most listings. Outreach to student
groups, city event pages and consumer-safety writers for genuine mentions.
Track: indexed pages, impressions, clicks, listings created from organic visits
(admin → Analytics → referrers).

### Content calendar: 20 article ideas (drafts need your approval before publishing)

1. How to transfer a train ticket to a family member (official Indian Railways process)
2. Can't attend a concert? Your options, from refunds to passing the ticket on fairly
3. How to spot a fake event ticket: QR codes, booking IDs and red flags
4. Ticket scams in India: the 7 most common tricks and how to avoid them
5. Is it legal to resell tickets in India? What organisers' terms usually say
6. Refund vs transfer: what to do when plans change last minute
7. How to safely meet someone to hand over a ticket
8. Never pay an advance: why "token amounts" are the #1 ticket scam
9. How to check if a bus ticket can be transferred (by operator)
10. What happens to an unused ticket after the event (and why listing early helps)
11. Fair price, explained: why TickOrbit caps resale at 90% of face value
12. Concert season guide: Bengaluru venues and how entry works
13. Concert season guide: Mumbai venues and how entry works
14. How e-tickets work: transferable vs name-locked tickets
15. Buying a ticket from someone: a 5-step safety checklist
16. What to do if a ticket you bought doesn't work at the gate
17. Group plans fell through? Splitting and passing on multiple tickets
18. Festival tickets: wristbands, transfers and organiser rules
19. Student guide: finding last-minute event tickets on a budget, safely
20. Why "no fees" matters: comparing ticket marketplaces' costs

Each article: one search intent, an H1 matching it, H2/H3 structure, links to
the relevant category page and the safety checklist, and citations to official
sources (operators, organisers, government rules). Write from real experience
and verified rules, not filler.
