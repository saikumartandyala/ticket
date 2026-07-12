# 🎨 LastMinutePass — UI/UX & Frontend Design Specification
### Complete Design System for a Billion-Dollar Web Application

---

## 1. 🧭 Design Philosophy & Vision

### Brand Identity
- **Name**: LastMinutePass
- **Tagline**: *"Your seat, their second chance."*
- **Personality**: Trustworthy, Fast, Modern, Indian-at-heart, Premium
- **Feeling**: The app should feel like **Zomato meets Airbnb** — local warmth + global polish
- **Tone**: Friendly but professional. Urgent but calm.

### Design Principles
1. **Speed First** — Every action should feel instant. Optimistic UI updates everywhere.
2. **Trust by Design** — Verification badges, ratings, and transparency at every touchpoint.
3. **Mobile-First** — 80%+ users will be on mobile. Design mobile, enhance for desktop.
4. **Urgency Without Anxiety** — Use urgency cues (countdowns, live counts) but never feel overwhelming.
5. **Accessibility** — WCAG 2.1 AA compliance. Works for all users.

---

## 2. 🎨 Design System — Color Palette

### Primary Brand Colors
```css
/* Core Brand */
--color-primary-50:  #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;   /* Primary Blue */
--color-primary-600: #2563eb;   /* CTA Blue */
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;

/* Accent — Electric Violet (energy, urgency, excitement) */
--color-accent-400:  #a78bfa;
--color-accent-500:  #8b5cf6;   /* Main Accent */
--color-accent-600:  #7c3aed;
--color-accent-700:  #6d28d9;

/* Success Green */
--color-success-400: #34d399;
--color-success-500: #10b981;
--color-success-600: #059669;

/* Warning Amber */
--color-warning-400: #fbbf24;
--color-warning-500: #f59e0b;
--color-warning-600: #d97706;

/* Danger Red */
--color-danger-400:  #f87171;
--color-danger-500:  #ef4444;
--color-danger-600:  #dc2626;
```

### Dark Theme (Primary — Default)
```css
/* Dark Mode Background Layers */
--bg-base:       #050714;   /* Deepest background — almost black with blue tint */
--bg-surface-1:  #0d1117;   /* Card backgrounds */
--bg-surface-2:  #161b27;   /* Elevated cards, modals */
--bg-surface-3:  #1e2535;   /* Hover states, active states */
--bg-surface-4:  #252d40;   /* Borders, dividers */

/* Text */
--text-primary:    #f0f4ff;   /* Main text */
--text-secondary:  #94a3b8;   /* Subtext */
--text-muted:      #4b5563;   /* Disabled, placeholders */
--text-accent:     #60a5fa;   /* Links, highlights */

/* Border */
--border-subtle:  rgba(255,255,255,0.06);
--border-default: rgba(255,255,255,0.10);
--border-strong:  rgba(255,255,255,0.18);
```

### Light Theme (Secondary)
```css
--bg-base:       #f8faff;
--bg-surface-1:  #ffffff;
--bg-surface-2:  #f1f5fd;
--bg-surface-3:  #e8eef8;
--text-primary:  #0f172a;
--text-secondary:#475569;
--text-muted:    #94a3b8;
--border-default:rgba(0,0,0,0.08);
```

### Gradient Definitions
```css
/* Hero Gradient */
--gradient-hero: linear-gradient(135deg, #050714 0%, #0d1b4b 50%, #050714 100%);

/* Brand Gradient */
--gradient-brand: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);

/* Card Glow (used on featured/urgent tickets) */
--gradient-card-glow: radial-gradient(ellipse at top left, rgba(59,130,246,0.15) 0%, transparent 70%);

/* Ticket Category Gradients */
--gradient-train:   linear-gradient(135deg, #1e3a5f, #2563eb);
--gradient-bus:     linear-gradient(135deg, #1a3a2a, #059669);
--gradient-ipl:     linear-gradient(135deg, #3b1f1f, #dc2626);
--gradient-cricket: linear-gradient(135deg, #1a2a1a, #16a34a);
--gradient-concert: linear-gradient(135deg, #2d1b4e, #7c3aed);
--gradient-event:   linear-gradient(135deg, #2a1b3d, #a855f7);

/* Aurora Effect (hero section) */
--gradient-aurora: 
  radial-gradient(ellipse 80% 50% at 20% 40%, rgba(120, 119, 198, 0.3) 0%, transparent 60%),
  radial-gradient(ellipse 60% 70% at 80% 30%, rgba(59, 130, 246, 0.2) 0%, transparent 60%),
  radial-gradient(ellipse 40% 80% at 50% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 60%);
```

---

## 3. ✍️ Typography System

### Font Stack
```css
/* Primary — Display & UI */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

/* Secondary — Brand numbers/stats (feels premium) */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

/* Mono — PNR codes, ticket IDs */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --font-sans:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-display: 'Outfit', 'Inter', sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale
```css
/* Display — Hero headlines */
--text-display-2xl: clamp(3rem,   6vw, 5rem);     /* 80px — Hero */
--text-display-xl:  clamp(2.25rem,4vw, 3.75rem);  /* 60px — Section titles */
--text-display-lg:  clamp(1.875rem,3vw,3rem);     /* 48px */
--text-display-md:  clamp(1.5rem,  2.5vw,2.25rem);/* 36px */
--text-display-sm:  clamp(1.25rem, 2vw, 1.875rem);/* 30px */

/* Body */
--text-xl:  1.25rem;  /* 20px — Large body */
--text-lg:  1.125rem; /* 18px — Body */
--text-md:  1rem;     /* 16px — Default */
--text-sm:  0.875rem; /* 14px — Small */
--text-xs:  0.75rem;  /* 12px — Caption */
--text-2xs: 0.625rem; /* 10px — Badge */
```

---

## 4. 📐 Spacing & Layout System

```css
/* Spacing Scale (4px base) */
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */

/* Border Radius */
--radius-sm:   0.375rem;  /* 6px — Inputs, small chips */
--radius-md:   0.75rem;   /* 12px — Cards */
--radius-lg:   1rem;      /* 16px — Large cards */
--radius-xl:   1.5rem;    /* 24px — Modals, panels */
--radius-2xl:  2rem;      /* 32px — Hero cards */
--radius-full: 9999px;    /* Pills, avatars */

/* Container */
--container-sm:  640px;
--container-md:  768px;
--container-lg:  1024px;
--container-xl:  1280px;
--container-2xl: 1440px;
```

---

## 5. ✨ Visual Effects & Animations

### Glassmorphism Cards
```css
.glass-card {
  background: rgba(13, 17, 23, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 6px -1px rgba(0,0,0,0.4),
    0 2px 4px -2px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.05);
}

.glass-card:hover {
  border-color: rgba(59, 130, 246, 0.25);
  box-shadow: 
    0 20px 40px -10px rgba(0,0,0,0.5),
    0 0 0 1px rgba(59,130,246,0.1),
    0 0 30px rgba(59,130,246,0.05);
  transform: translateY(-2px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Glow Effects
```css
.glow-blue   { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
.glow-violet { box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); }
.glow-green  { box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
.glow-red    { box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }

/* Text glow */
.text-glow-blue {
  text-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
}
```

### Animation Library
```css
/* Fade In Up — for cards loading */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Pulse — for live indicators */
@keyframes pulse-ring {
  0%   { transform: scale(0.8); opacity: 1; }
  80%  { transform: scale(2.0); opacity: 0; }
  100% { transform: scale(2.0); opacity: 0; }
}

/* Shimmer — for skeleton loaders */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Ticker scroll — for live activity feed */
@keyframes ticker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Countdown urgency pulse */
@keyframes urgency-pulse {
  0%, 100% { color: #ef4444; }
  50%       { color: #fbbf24; }
}

/* Float animation — hero elements */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-12px); }
}

/* Gradient shift — hero background */
@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Transition Standards
```css
--transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base:   250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring: 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## 6. 🧩 Component Library (Detailed)

### 6.1 Navigation Bar
```
Structure:
┌─────────────────────────────────────────────────────────────────┐
│ [Logo: ⚡LastMinutePass]  [Explore][How it Works]  [Login][Post]│
└─────────────────────────────────────────────────────────────────┘

Behavior:
- Transparent on hero → Frosted glass on scroll (backdrop-filter: blur(20px))
- Height: 64px desktop, 56px mobile
- Logo: Gradient text (blue→violet) + lightning bolt icon
- "Post a Ticket" CTA: Gradient button (primary → accent) with subtle glow
- Mobile: Hamburger → Full-screen overlay menu with slide animation
- Active route: Underline with gradient bar
- Notification bell with red dot badge for logged-in users
```

### 6.2 Hero Section
```
Layout:
┌──────────────────────────────────────────────────────────────┐
│  [Aurora gradient background + floating particles]            │
│                                                               │
│   LAST MINUTE TICKETS.              [Floating ticket cards]   │
│   REAL CONNECTIONS.                  🚂 Delhi → Mumbai        │
│   [Badge: 🟢 1,247 Live Listings]    ₹350 · 2h left          │
│                                                               │
│   [Search Bar — full width, glass morphism]                   │
│   [ 🔍 Train, Bus, IPL, Concerts... ] [🗓️ Today] [Search →]  │
│                                                               │
│   ── OR BROWSE BY ──                                          │
│   [🚂 Train] [🚌 Bus] [🏏 IPL] [🎵 Concert] [🏟️ Events]     │
│                                                               │
│   [Live Ticker: "Rahul just posted Delhi→Agra · ₹280"]       │
└──────────────────────────────────────────────────────────────┘

Key Elements:
- Background: Animated aurora gradient (CSS only, no images)
- Particles: 20-30 small floating dots (canvas or pure CSS)
- Search bar: 72px height, glass card, prominent
- Category pills: Icon + label, hover glow, scroll horizontally on mobile
- Live ticker: Horizontal scrolling marquee of real activity
- Floating ticket cards (right side): Animate in with stagger delay
- CTA: Two buttons — "Find a Ticket" (primary) + "List My Ticket" (ghost)
```

### 6.3 Search & Filter Bar
```
Desktop:
┌──────────────────────────────────────────────────────────────┐
│ [Category ▼] [From...] [→] [To...] [📅 Date] [Search]        │
└──────────────────────────────────────────────────────────────┘

Mobile (expandable):
┌───────────────────┐
│ 🔍 Search tickets │  ← tap to expand
└───────────────────┘
         ↓
Full-screen search overlay with filters

Filter Chips (below search bar, scrollable):
[🚂 Train ×] [Today ×] [₹0-₹500 ×] [Delhi ×] [Sort: Newest ▼]

Advanced Filters Drawer (right slide-in):
- Price range slider (₹0 — ₹5000)
- Date range picker
- Category multi-select
- Route (from/to with autocomplete)
- Seat type (for trains: SL, 3A, 2A, 1A)
- Posted within (last 1hr, 3hr, 6hr, 24hr)
- Verified sellers only toggle
```

### 6.4 Ticket Card (The Core Component)
```
┌─────────────────────────────────────────────────────────┐
│ [Category Badge: 🚂 TRAIN]              [⏱️ 3h 22m left] │
│                                                          │
│  NEW DELHI                 MUMBAI CENTRAL               │
│  ━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━                 │
│  06:15 AM    ◄─────────── 16h 45m ─────────►  11:00 PM  │
│  Jun 3                                    Jun 4         │
│                                                          │
│  Rajdhani Express · 12951      Coach S4 · Seat 32        │
│  ─────────────────────────────────────────────────────── │
│  [👤 Arjun S. ⭐4.8 · ✅ Verified]     [🔴 URGENT]       │
│                                                          │
│  Original: ~~₹1,250~~    Asking: ₹625          [Grab →] │
└─────────────────────────────────────────────────────────┘

States:
- Normal: Default glass card
- Urgent (< 2hr left): Red glow border + pulsing "URGENT" badge
- Hot (5+ people viewing): Orange "🔥 5 viewing" badge
- Verified: Green checkmark on seller avatar
- New (< 30 min posted): Blue "NEW" chip
- Expiring Soon: Countdown timer turns red + pulses

Hover Effect:
- Lift: translateY(-4px)
- Border: Glows with category color
- Shadow: Deep drop shadow
- "Quick View" overlay appears

Mobile Card: Condensed, swipeable in some views
```

### 6.5 Listing Detail Page / Quick View Modal
```
Layout (Modal on desktop, full page on mobile):
┌──────────────────────────────────────────────────┐
│ ← Back          TICKET DETAILS         [Share 🔗] │
├──────────────────────────────────────────────────┤
│                                                   │
│  [TICKET VISUAL — styled like real ticket]        │
│  ┌─────────────────────────────────────────┐     │
│  │ ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  │     │
│  │ RAJDHANI EXPRESS · 12951                │     │
│  │ NEW DELHI → MUMBAI CENTRAL             │     │
│  │ Date: Jun 3, 2025 · 06:15 AM           │     │
│  │ Class: 3A · Berth: Lower · Coach: B3   │     │
│  │ PNR: 2xxxxxxx (last 4 hidden)          │     │
│  ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  │     │
│  └─────────────────────────────────────────┘     │
│                                                   │
│  [Ticket Photo uploaded by seller]               │
│                                                   │
│  👤 About the Seller                             │
│  Arjun Singh · ⭐ 4.8 (12 reviews) · ✅ Phone   │
│  Verified · 🟢 Online now                        │
│                                                   │
│  💬 [Message Seller]    📞 [Reveal Contact]      │
│                                                   │
│  ──── Safety Tips ────                           │
│  ✓ Always verify ticket before transfer          │
│  ✓ Meet in public or use official channels       │
│  ✓ Report suspicious listings                    │
│                                                   │
│  [🚨 Report Listing]                             │
└──────────────────────────────────────────────────┘
```

### 6.6 Post a Ticket Form (Multi-Step)
```
Step Indicator:
[1 Category] ──● [2 Details] ───○ [3 Pricing] ───○ [4 Preview] ───○ [5 Done]

Step 1 — Select Category (Visual card selection):
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│   🚂   │ │   🚌   │ │   🏏   │ │   🎵   │ │   🎭   │
│ Train  │ │  Bus   │ │  IPL   │ │Concert │ │ Event  │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
(selected card gets gradient border + check mark)

Step 2 — Ticket Details:
- For Train: PNR number field (with format validation), From/To stations (autocomplete), Date, Train name/number, Class, Coach, Seat/Berth
- For Bus: Operator name, Route (From/To), Date, Time, Seat number, Ticket type
- For Events: Event name, Venue, Date, Section/Stand, Row, Seat number
- Ticket photo upload (drag & drop + camera capture)

Step 3 — Pricing:
- Original price input
- Asking price (auto-fills 50%, user can adjust)
  - Visual slider with min (40%) and max (80%) guardrails
  - "Fair Price" badge shown when near 50%
- Quick description textarea (optional)

Step 4 — Preview:
- Shows rendered ticket card exactly as it will appear
- Checklist of required items
- Agreement checkbox

Step 5 — Success:
- Animated checkmark (Lottie or CSS)
- Share listing link
- "Set Alert" for when someone is interested

Form UX:
- Auto-save draft every 30 seconds
- Progress bar shows completion %
- Inline validation (no form submission errors)
- Keyboard-friendly (Tab through all fields)
```

### 6.7 Dashboard (Logged-in User)
```
Tabs: [My Listings] [My Requests] [Matches] [History]

My Listings:
┌─────────────────────────────────────────────────┐
│ [Active] [Matched] [Expired] [Closed]    [+ Post]│
├─────────────────────────────────────────────────┤
│ Compact ticket card with:                        │
│ - Status badge (Active/Matched/Expired)          │
│ - 👁️ 12 views · 🤝 3 interested                 │
│ - [Edit] [Delete] [Mark as Transferred]         │
└─────────────────────────────────────────────────┘

Match Alerts Panel:
┌────────────────────────────────────────────────────┐
│ 🎉 New Match!                          [View →]     │
│ Priya needs your Delhi→Agra ticket today           │
│ She's verified · ⭐ 5.0 · 2 min ago               │
└────────────────────────────────────────────────────┘

Stats Bar (top of dashboard):
[🎟️ 3 Active] [✅ 8 Matched] [⭐ 4.9 Rating] [👁️ 47 Views]
```

### 6.8 Profile & Verification
```
Profile Header:
┌──────────────────────────────────────────────────┐
│        [Avatar — initials fallback]               │
│               Arjun Singh                        │
│         ✅ Phone · ✅ Email · ⭐ 4.8              │
│   Member since Jun 2024 · 15 successful matches  │
│   [Edit Profile]  [Share Profile]                │
└──────────────────────────────────────────────────┘

Verification Badges:
- 📱 Phone Verified (OTP)
- 📧 Email Verified
- 🪪 Aadhaar Verified (optional, shows "Trusted" badge)
- ✅ Bank Account Linked (future)

Reviews Section:
- Star rating breakdown (visual bar chart)
- Individual review cards
- "Leave a Review" after each successful match
```

### 6.9 Notification System
```
Types:
1. 🎉 Match Found — "Someone wants your ticket!" → Push + In-app
2. 📩 New Message — In-app chat notification
3. ⏰ Listing Expiring — "Your listing expires in 2 hours"
4. ✅ Transfer Confirmed — "Priya confirmed receipt"
5. ⭐ Review Request — "Rate your experience with Arjun"

Notification Bell Dropdown:
┌──────────────────────────────────┐
│ Notifications            Mark all│
│ ──────────────────────────────── │
│ 🎉 Match! Priya wants your...  2m │
│ ⏰ Listing expires in 1hr      1h │
│ ✅ Transfer confirmed by Raj   3h │
└──────────────────────────────────┘

Toast Notifications (bottom-right, mobile bottom-center):
- Success: Green with checkmark
- Error: Red with X
- Info: Blue with info icon
- Warning: Amber with warning icon
- Auto-dismiss: 4 seconds
- Stack up to 3 toasts
```

### 6.10 In-App Chat / Contact Reveal
```
Chat Interface (triggered after match):
┌──────────────────────────────────────────────┐
│ ← Arjun Singh · 🟢 Online · ✅ Verified      │
│ Regarding: Delhi→Mumbai · Jun 3              │
│ ──────────────────────────────────────────── │
│                                              │
│  [System: Match confirmed! You can now...]   │
│                                              │
│  [Arjun]: Hi! The ticket is valid, PNR is..  │
│                           [You]: Great!      │
│                                              │
│ ──────────────────────────────────────────── │
│ [📎] [Type a message...]          [Send →]   │
└──────────────────────────────────────────────┘

Contact Reveal (alternative flow):
- Button: "Reveal Phone Number" 
- Confirm dialog with safety tips
- Shows: +91 98XXX XXXXX (phone number)
- Log the reveal event for safety audit
```

---

## 7. 📱 Page-by-Page UX Map

### 7.1 Landing Page (/)
```
Sections (top → bottom):
1. Navbar (transparent → glass on scroll)
2. Hero (Aurora BG + Search + Category Pills + Live Ticker)
3. How It Works (3 steps with animated icons)
   - Step 1: Someone cancels → lists ticket
   - Step 2: You search → find a match
   - Step 3: Connect → transfer happens
4. Live Listings Showcase (horizontal scroll of real cards, auto-refresh)
5. Category Deep Dive (tabs: Train / Bus / IPL / Concert)
6. Trust Section ("Why LastMinutePass?")
   - 🔒 Verified Sellers
   - ⭐ Review System  
   - 🚀 Instant Match Alerts
   - 0 Hidden Fees
7. Stats Counter (animated on scroll)
   - 12,430+ Tickets Listed
   - 8,920+ Successful Matches
   - 4.8/5 Average Rating
   - 50+ Cities
8. Testimonials (auto-playing carousel)
9. FAQ (accordion)
10. Footer
```

### 7.2 Browse/Search Page (/tickets)
```
Layout:
┌──────────────────────────────────────────────────────────┐
│ [Search + Filter Bar]                                     │
├──────────────┬───────────────────────────────────────────┤
│              │                                            │
│  Filter      │  Results Grid (2-col desktop, 1-col mobile)│
│  Sidebar     │                                            │
│  (desktop)   │  [Sort: Newest ▼] [238 results]           │
│              │                                            │
│  Category    │  [Ticket Card] [Ticket Card]              │
│  Price Range │  [Ticket Card] [Ticket Card]              │
│  Date        │  [Ticket Card] [Ticket Card]              │
│  Route       │  ...                                       │
│  Seat Type   │                                            │
│  Verified    │  [Load More / Infinite Scroll]            │
│              │                                            │
└──────────────┴───────────────────────────────────────────┘

Empty State:
- Illustration of empty seat
- "No tickets found for your search"
- [Set up an Alert] — notify when match posted
- [Modify Search] button
```

### 7.3 Ticket Detail Page (/tickets/[id])
```
- Breadcrumb nav
- Large ticket visual
- Full details
- Seller card with ratings
- Quick chat / contact reveal
- Map showing route (for trains/buses)
- Similar listings (horizontal scroll)
- Safety guidelines
- Report button
```

### 7.4 Post a Ticket (/post)
```
- Multi-step form (as detailed in 6.6)
- Sticky progress indicator
- Mobile-friendly keyboard navigation
- Draft auto-save
```

### 7.5 Auth Pages (/login, /register)
```
Design: Split screen (desktop) / Single panel (mobile)
Left: Brand visual with floating ticket cards (desktop only)
Right: Auth form

Phone OTP Flow:
1. Enter phone number
2. OTP input (6 digits, auto-focus each digit, auto-submit on fill)
3. Resend OTP (30s countdown)
4. Name + Email (on first login = registration)

Social login: Google OAuth (optional, Phase 2)
```

### 7.6 Dashboard (/dashboard)
```
- Stats overview bar
- Tabs: Active, Matched, History
- Notifications panel
- Quick post button (FAB on mobile)
```

---

## 8. 📱 Mobile UX Specifics

### Bottom Navigation Bar (Mobile)
```
┌──────────────────────────────────────────────────┐
│                                                   │
│  [🏠 Home] [🔍 Search] [➕ Post] [💬 Chat] [👤 Me]│
└──────────────────────────────────────────────────┘

- "Post" button: Elevated, gradient, larger
- Active state: Icon fills + label appears
- Chat badge: Red dot for unread
```

### PWA Configuration
```json
{
  "name": "LastMinutePass",
  "short_name": "LMPass",
  "theme_color": "#050714",
  "background_color": "#050714",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512" }
  ]
}
```

### Gestures & Interactions
- Swipe right on listing card → Quick save/bookmark
- Pull to refresh on listings
- Long press on ticket card → Quick share
- Swipe down to close modal
- Double tap hero → scroll to listings

---

## 9. 🎭 Micro-Interactions & Delight

| Interaction | Effect |
|------------|--------|
| Like/Save ticket | Heart animation (like Twitter like) |
| Successful match | Confetti burst (canvas confetti) |
| OTP filled | Green checkmark sweep animation |
| Form submission | Button morphs to loader → checkmark |
| New notification | Bell rings (CSS transform) |
| Card hover | 3D tilt effect (mouse tracking) |
| Copy link | "Copied!" tooltip flash |
| Stars rating | Stars fill left-to-right with glow |
| Countdown < 1hr | Numbers turn red with pulse |
| Page transition | Slide + fade (Next.js layout animations) |

---

## 10. 🧪 Accessibility Standards

- All interactive elements: minimum 44×44px touch target
- Color contrast ratio: ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- All images: meaningful alt text
- Forms: Labels associated with inputs, error messages linked via aria-describedby
- Modals: Focus trap, Escape to close, ARIA roles
- Keyboard navigation: Full tab order, visible focus rings
- Screen reader: Semantic HTML + ARIA landmarks
- Motion: `prefers-reduced-motion` media query respected
- Language: `lang="en"` on `<html>`, regional support for Hindi (i18n ready)

---

## 11. 🌐 Responsive Breakpoints

```css
/* Mobile First */
--bp-sm:  480px;   /* Large phone */
--bp-md:  768px;   /* Tablet */
--bp-lg:  1024px;  /* Small laptop */
--bp-xl:  1280px;  /* Desktop */
--bp-2xl: 1536px;  /* Large desktop */

/* Grid Columns by breakpoint */
/* Mobile: 4 columns */
/* Tablet: 8 columns */
/* Desktop: 12 columns */

/* Ticket Grid */
/* Mobile: 1 column */
/* Tablet: 2 columns */
/* Desktop: 3 columns */
/* Wide: 4 columns */
```

---

## 12. 🚀 Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |
| Total JS Bundle (gzipped) | < 200KB |
| Images | WebP format, lazy loaded |
| Fonts | Preloaded, font-display: swap |

### Optimization Techniques
- Image lazy loading with blur placeholder
- Code splitting per route (Next.js automatic)
- Static generation for homepage
- ISR (Incremental Static Regeneration) for listing pages
- React Query for smart caching + background refetch
- Virtual scrolling for large listing results (react-window)
- Service Worker for offline support (PWA)
