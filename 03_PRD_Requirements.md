# 📋 LastMinutePass — Product Requirements Document (PRD)
### Version 1.0 | Last-Minute Ticket Transfer Platform

---

## 1. 📌 Executive Summary

### Problem Statement
Every day in India, thousands of people cancel train tickets, bus seats, and event tickets at the last minute. Under current systems:
- **Canceling users** lose 50-75% of their ticket value to cancellation fees
- **Last-minute travelers** cannot find tickets because official channels show "sold out"
- **No reliable marketplace** exists to connect these two groups safely and quickly

### Solution
**LastMinutePass** is a P2P (peer-to-peer) ticket transfer marketplace that acts as a **bridge** between:
- **Transferors**: People who want to transfer their tickets (and recover partial value)
- **Seekers**: People who urgently need tickets at short notice

> ⚠️ We do NOT sell tickets. We do NOT process payments. We connect people.

### Business Model (Phase 1 — Free)
- **FREE** to list tickets
- **FREE** to search and browse
- **FREE** to express interest and connect

*(Monetization introduced in Phase 2 via optional premium features)*

---

## 2. 👥 User Personas

### Persona 1: The Transferor — "Rahul"
- Age: 28, Software Engineer, Pune
- Books train tickets in advance, plans change unexpectedly
- Pain: Loses ₹400-800 on cancellation fees every time
- Goal: Recover at least 50% of ticket cost
- Behavior: Will use any app if it's trustworthy and fast

### Persona 2: The Seeker — "Priya"
- Age: 24, College student, Delhi
- Often needs last-minute tickets for family emergencies, work trips
- Pain: Official sites show no availability 24-48 hours before travel
- Goal: Get a valid ticket at reasonable price, quickly
- Behavior: Mobile-first user, trusts verified sellers, needs quick response

### Persona 3: The Event-Goer — "Arjun"
- Age: 32, Marketing Manager, Mumbai
- Bought IPL tickets months ago, last-minute cancellation
- Pain: No official resale platform, stuck with useless tickets
- Goal: Sell ticket to someone who will actually attend
- Behavior: Checks reviews, wants verified buyers

---

## 3. 🎯 Goals & Success Metrics

### Business Goals
| Goal | Metric | Target (6 months) |
|------|--------|-------------------|
| User Acquisition | Registered users | 10,000 |
| Engagement | Listings posted per day | 500+ |
| Conversion | Match rate (listings that get matched) | >40% |
| Trust | Average seller rating | >4.5/5 |
| Retention | 30-day return rate | >35% |
| Coverage | Cities covered | 25+ |

### Technical Goals
| Metric | Target |
|--------|--------|
| API response time (p99) | < 200ms |
| WebSocket connection latency | < 50ms |
| System uptime | 99.5% |
| LCP (Largest Contentful Paint) | < 2.5s |
| Mobile Lighthouse score | > 90 |

---

## 4. 🧩 Feature Requirements

### 4.1 User Registration & Authentication

#### FR-AUTH-001: Phone OTP Registration/Login
- **Priority**: P0 (Must Have)
- Users register and log in using phone number + OTP only
- No password required
- Phone-first approach (email is optional)
- OTP: 6 digits, valid 10 minutes, maximum 3 resends per 15 minutes
- JWT tokens stored in httpOnly cookies
- Auto-login if token is valid

#### FR-AUTH-002: Profile Setup
- **Priority**: P0
- After first login, prompt for: name, email (optional)
- Avatar: Upload photo or use initials-based auto-avatar
- Profile completeness indicator

#### FR-AUTH-003: Phone Verification Badge
- **Priority**: P0
- Phone verified automatically upon OTP login
- Display "✅ Phone Verified" badge on public profiles

#### FR-AUTH-004: Email Verification
- **Priority**: P1
- Optional email verification for additional trust badge
- Sends verification email via SendGrid

---

### 4.2 Ticket Listing (Transferor Flow)

#### FR-LIST-001: Multi-Category Ticket Listing
- **Priority**: P0
- Supported categories: Train, Bus, IPL, Cricket, Concert, Event
- **NOT supported**: Flights

#### FR-LIST-002: Train Ticket Listing Fields
- **Priority**: P0
- Required: Origin city, Destination city, Travel date, Class (SL/3A/2A/1A), Seat count
- Optional: Train name, Train number, Coach, Berth number, PNR (last 4 digits only)
- Required: At least 1 ticket photo upload

#### FR-LIST-003: Bus Ticket Listing Fields
- **Priority**: P0
- Required: Operator name, Origin city, Destination city, Travel date, Departure time
- Optional: Seat number, Bus type

#### FR-LIST-004: Event/IPL/Concert Ticket Fields
- **Priority**: P0
- Required: Event name, Venue, City, Event date
- Optional: Section/Stand, Row, Seat number

#### FR-LIST-005: Pricing
- **Priority**: P0
- Original price (what they paid)
- Asking price: Default auto-filled to 50% of original
- Price guardrails: Min 30%, Max 90% of original price
- Cannot list above original face value (anti-scalping)

#### FR-LIST-006: Ticket Photo Upload
- **Priority**: P0
- Required: At least 1 clear photo of the ticket
- Accepted formats: JPEG, PNG, WebP
- Max file size: 5MB per photo
- Max photos: 5 per listing
- Client-side compression before upload
- Server-side watermark with listing ID

#### FR-LIST-007: Auto-Expiry
- **Priority**: P0
- Listing automatically expires at event date + departure time
- Celery Beat job runs every 30 minutes to expire listings
- Expiry reminder notification sent 2 hours before expiry
- Expired listings archived (not deleted) for 30 days

#### FR-LIST-008: Listing Management
- **Priority**: P0
- Owner can edit listing details (until matched)
- Owner can delete/cancel listing at any time
- Owner can mark as "Already Transferred" (closes listing)
- Draft auto-save every 30 seconds during form filling

#### FR-LIST-009: Listing Visibility Controls
- **Priority**: P1
- Listing visible to all users (logged-in or not) for browsing
- Contact information hidden until match + reveal action
- PNR hidden (only last 4 shown)

---

### 4.3 Search & Discovery (Seeker Flow)

#### FR-SEARCH-001: Basic Search
- **Priority**: P0
- Search by: category, origin city, destination city, event name, venue
- Filter by: date, price range, seat type
- Sort by: Newest, Price (low→high), Price (high→low), Expiring Soon

#### FR-SEARCH-002: Advanced Filters
- **Priority**: P1
- Price range slider (₹0 — ₹5000)
- Date range picker
- Category multi-select
- Verified sellers only toggle
- Posted within: 1hr, 3hr, 6hr, 24hr

#### FR-SEARCH-003: Full-Text Search (MeiliSearch)
- **Priority**: P0
- Typo-tolerant search ("mubai" finds "Mumbai")
- Instant results as user types (debounced 300ms)
- Search across: city names, event names, train names, operator names

#### FR-SEARCH-004: City Autocomplete
- **Priority**: P0
- Autocomplete for origin/destination city fields
- Prioritize Indian cities (pre-seeded list of 500+ cities)
- Show recent searches (stored in browser localStorage)

#### FR-SEARCH-005: Browse by Category
- **Priority**: P0
- Category landing pages: /tickets/train, /tickets/bus, etc.
- Category-specific filters and layout

#### FR-SEARCH-006: Live Listings Feed
- **Priority**: P1
- Homepage shows a live feed of recently posted listings
- WebSocket-powered: new listings appear automatically without refresh
- "New listing!" indicator on cards posted in last 30 minutes

#### FR-SEARCH-007: Empty State & Seeker Alerts
- **Priority**: P1
- When no results found, offer "Set Alert" option
- Alert: Notify when a ticket matching search criteria is posted
- Alert channels: SMS + push notification
- User can manage/delete alerts from dashboard

#### FR-SEARCH-008: Trending & Popular
- **Priority**: P2
- "Popular Routes Today" section
- "Trending Events" section
- Cached and refreshed every 15 minutes

---

### 4.4 Matching System

#### FR-MATCH-001: Express Interest
- **Priority**: P0
- Seeker clicks "I'm Interested" on a listing
- Requires login (redirect to OTP login if not logged in)
- Creates a match record (status: pending)
- Notifies transferor immediately (SMS + push + in-app)
- Seeker can add a note (max 200 chars)

#### FR-MATCH-002: Transferor Accepts/Declines
- **Priority**: P0
- Transferor sees interested seekers in dashboard
- Can view seeker's profile (name, avatar, rating, verification status)
- Can accept one interest (others remain pending or are declined)
- Can decline with optional reason

#### FR-MATCH-003: Automated Match Alerting
- **Priority**: P0
- When new listing posted → Check all active seeker alerts → Notify matches
- Celery background task runs immediately on new listing creation
- Notification channels: SMS + push + in-app + WebSocket (if online)

#### FR-MATCH-004: Contact Reveal
- **Priority**: P0
- After transferor accepts → Both parties can see a chat channel
- "Reveal Phone Number" button shows transferor's phone to seeker
- Contact reveal is logged (for safety audit trail)
- Transferor can also choose to reveal their contact directly

#### FR-MATCH-005: Transfer Confirmation
- **Priority**: P0
- Either party marks transfer as "Completed"
- System records confirmation
- Triggers review request for both parties
- Listing status changes to "Transferred"

#### FR-MATCH-006: Match Cancellation
- **Priority**: P0
- Either party can cancel a match before transfer
- Listing returns to "Active" status if transferor cancels
- Seeker can cancel their interest at any time

#### FR-MATCH-007: Multiple Seekers per Listing
- **Priority**: P1
- Multiple seekers can express interest in the same listing
- Transferor sees all interested seekers and picks one
- Declined seekers are notified

---

### 4.5 In-App Messaging

#### FR-CHAT-001: Direct Messages per Match
- **Priority**: P1
- Each match gets a dedicated chat thread
- Real-time messaging via WebSocket
- Max 500 characters per message
- Image sharing in chat (for ticket photo clarification)

#### FR-CHAT-002: System Messages
- **Priority**: P0
- Automated system messages in chat timeline:
  - "Match confirmed! You can now chat."
  - "Priya revealed your contact."
  - "Transfer confirmed by Rahul."

#### FR-CHAT-003: Message Read Receipts
- **Priority**: P2
- "Seen" indicator when message is read
- Unread count badge on chat icon

#### FR-CHAT-004: Chat History
- **Priority**: P1
- Full chat history stored and accessible
- Messages retained for 30 days after match completion

---

### 4.6 Review & Rating System

#### FR-REVIEW-001: Post-Transfer Reviews
- **Priority**: P0
- After transfer confirmed → Both parties get "Leave a Review" prompt
- Rating: 1-5 stars
- Comment: Optional, max 300 chars
- Reviews visible on public profile
- One review per match per user (cannot edit after submission)

#### FR-REVIEW-002: Rating Aggregation
- **Priority**: P0
- Average rating calculated and displayed on profile
- Rating displayed on listing cards (seller rating)
- Ratings affect "Verified Seller" status threshold

#### FR-REVIEW-003: Review Moderation
- **Priority**: P1
- Admin can remove reviews that violate guidelines
- Users can report a review

---

### 4.7 User Dashboard

#### FR-DASH-001: My Listings
- **Priority**: P0
- View all listings: Active, Matched, Expired, Transferred, Cancelled
- Quick actions: Edit, Delete, Mark Transferred
- Engagement metrics: View count, Interest count per listing

#### FR-DASH-002: My Matches
- **Priority**: P0
- View all matches (as seeker or transferor)
- Status: Pending, Accepted, Transferred, Cancelled
- Quick action: Open chat, View listing, Confirm transfer

#### FR-DASH-003: My Alerts
- **Priority**: P1
- View and manage all active seeker alerts
- Toggle alert on/off
- Delete alerts
- See history of alert-triggered notifications

#### FR-DASH-004: Dashboard Stats
- **Priority**: P1
- Total listings posted
- Total successful matches
- Total views received on listings
- Average rating

---

### 4.8 Notifications

#### FR-NOTIF-001: In-App Notifications
- **Priority**: P0
- Real-time notification bell in navbar
- Notification types: match found, interest received, message, expiring listing, review request
- Mark as read (individual or all)
- Notification history (last 50)

#### FR-NOTIF-002: SMS Notifications
- **Priority**: P0
- Critical events only: Match found, Interest received
- Provider: MSG91 or Fast2SMS
- User can opt out via dashboard settings

#### FR-NOTIF-003: Push Notifications (PWA)
- **Priority**: P1
- Browser push via Firebase Cloud Messaging
- Requires user permission (opt-in prompt)
- Sent for: all notification types
- Works when browser is open in background

#### FR-NOTIF-004: Email Notifications
- **Priority**: P2
- Weekly digest of activity
- Match notifications (backup to SMS/push)
- Welcome email on registration

---

### 4.9 Trust & Safety

#### FR-TRUST-001: Listing Reporting
- **Priority**: P0
- "Report Listing" button on every listing
- Report reasons: Fake ticket, Fraud, Spam, Inappropriate content, Price gouging
- Report goes to admin queue

#### FR-TRUST-002: User Reporting
- **Priority**: P1
- "Report User" option on public profile
- After chat interaction, option to report

#### FR-TRUST-003: Admin Moderation Panel
- **Priority**: P0
- View pending reports
- Review reported listings (approve / remove)
- Ban users
- Flag/unflag listings
- Platform statistics dashboard

#### FR-TRUST-004: Safety Guidelines
- **Priority**: P0
- Displayed on ticket detail page
- Displayed in chat before contact reveal
- Tips: verify before paying, meet in safe place, use official channels for transfer

#### FR-TRUST-005: Anti-Scalping Rules
- **Priority**: P0
- Maximum asking price: 90% of original price (enforced in backend)
- Listings above face value automatically rejected
- Warning message shown if price seems high

---

### 4.10 Non-Functional Requirements

#### NFR-001: Performance
- API response time (p95): < 150ms for listing queries
- Search results: < 100ms (MeiliSearch)
- Page load LCP: < 2.5 seconds on 4G connection
- Support 1,000 concurrent WebSocket connections

#### NFR-002: Scalability
- Application should handle 100,000 registered users
- 10,000 active listings at any time
- Horizontal scaling via Docker container orchestration

#### NFR-003: Availability
- Target uptime: 99.5% (allows ~43 hours downtime per year)
- Graceful degradation: App works (read-only) even if Redis is down
- Database connection pooling for burst traffic

#### NFR-004: Security
- OWASP Top 10 compliance
- All data encrypted in transit (TLS 1.3)
- Sensitive data encrypted at rest (PostgreSQL pgcrypto)
- Regular dependency security audits (pip-audit, npm audit)
- No storage of complete PNR numbers

#### NFR-005: Privacy
- GDPR-compliant user data deletion on request
- Phone numbers masked in UI (shown only after contact reveal)
- Ticket photos watermarked with listing ID
- Data retention policy: 90 days after account deletion

#### NFR-006: Accessibility
- WCAG 2.1 AA compliance
- Screen reader compatible (semantic HTML + ARIA)
- Keyboard fully navigable
- Color contrast ratios met for all text

#### NFR-007: Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- iOS Safari 14+ (PWA support)
- Android Chrome 90+ (PWA support)

---

## 5. 🗺️ User Stories

### Transferor Stories
```
US-T-001: As a transferor, I want to list my train ticket in under 3 minutes
          so that I can quickly find someone to take it.

US-T-002: As a transferor, I want to upload a photo of my ticket
          so that seekers can verify it is genuine.

US-T-003: As a transferor, I want to see who is interested in my ticket
          including their ratings, so that I can choose a trustworthy seeker.

US-T-004: As a transferor, I want to receive an SMS when someone is interested
          so that I can respond quickly even when not on the app.

US-T-005: As a transferor, I want my listing to automatically expire after the
          event time so that I don't have to manually manage it.

US-T-006: As a transferor, I want to chat with the interested seeker
          before revealing my contact details, for privacy.
```

### Seeker Stories
```
US-S-001: As a seeker, I want to search for available tickets by route and date
          so that I can find what I need quickly.

US-S-002: As a seeker, I want to see clear ticket details including seat info
          and photos, so that I can assess if the ticket is genuine.

US-S-003: As a seeker, I want to see the seller's rating and verification badges
          so that I can decide if the seller is trustworthy.

US-S-004: As a seeker, I want to set an alert for a route/event
          so that I am notified the moment a matching ticket is listed.

US-S-005: As a seeker, I want to express interest with one tap
          so that I can quickly secure the listing before others.

US-S-006: As a seeker, I want to chat with the seller and eventually get their
          contact, so that we can complete the transfer.
```

---

## 6. 🚫 Out of Scope (MVP)

The following are explicitly NOT in scope for MVP:
- Flight tickets
- Payment processing or escrow
- Official IRCTC API integration (PNR verification)
- Aadhaar verification
- Group ticket listings (MVP: single tickets only)
- Ticket resale above face value (blocked by price cap)
- Native iOS / Android apps (PWA covers this in Phase 1)
- International tickets
- Inter-country travel
- Corporate/bulk ticket handling
- Subscription plans (Phase 2)
- Platform fees (Phase 2)

---

## 7. 📅 MVP Milestones

| Milestone | Scope | Timeline |
|-----------|-------|----------|
| M1: Foundation | Auth, DB setup, basic listing CRUD | Week 1-4 |
| M2: Core Flow | Search, Browse, Express Interest, Match | Week 5-8 |
| M3: Communication | In-app chat, contact reveal, WebSocket | Week 9-11 |
| M4: Trust | Reviews, reporting, admin panel | Week 12-13 |
| M5: Polish | Notifications, PWA, performance, testing | Week 14-16 |
| M6: Launch | Beta with 100 users, monitoring | Week 17-18 |
