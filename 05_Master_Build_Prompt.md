# 🤖 LastMinutePass — Master Build Prompt
### Complete Prompt for AI Agent / CLI to Build Application from Scratch

---

## CONTEXT & MISSION

You are building **LastMinutePass** — a billion-dollar quality P2P (peer-to-peer) last-minute ticket transfer platform.

**Core Concept**: This platform acts as a BRIDGE between:
- **Transferors**: People who want to cancel train/bus/event tickets and recover ~50% of their money
- **Seekers**: People who urgently need last-minute tickets on the same day

**CRITICAL RULES**:
- We do NOT sell tickets ourselves
- We do NOT process any payments
- We simply connect transferors and seekers
- Listing tickets is FREE (Phase 1)
- Searching tickets is FREE (Phase 1)
- No flight tickets (only Train, Bus, IPL, Cricket, Concerts, Events)

---

## TECHNOLOGY STACK (MANDATORY — DO NOT DEVIATE)

```
Backend:   Python 3.11+ + FastAPI + SQLAlchemy (async) + Alembic
Database:  PostgreSQL 16 (primary) + Redis 7 (cache/queue/pubsub)
Search:    MeiliSearch v1.7
Queue:     Celery + Redis broker
Frontend:  Next.js 14 (App Router) + TypeScript + Tailwind CSS
State:     Zustand + React Query (TanStack Query v5)
Real-time: WebSockets (FastAPI native)
Storage:   AWS S3 or Cloudflare R2
SMS:       MSG91 API (OTP delivery)
Email:     SendGrid
Push:      Firebase Cloud Messaging
Auth:      Phone OTP → JWT (httpOnly cookies)
Deploy:    Docker + Docker Compose
```

---

## PHASE 1: BACKEND — FastAPI Application

### STEP 1: Project Initialization

Create the following directory structure EXACTLY:

```
lastminutepass/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── listings.py
│   │   │       ├── search.py
│   │   │       ├── matches.py
│   │   │       ├── messages.py
│   │   │       ├── alerts.py
│   │   │       ├── reviews.py
│   │   │       ├── categories.py
│   │   │       ├── notifications.py
│   │   │       ├── admin.py
│   │   │       └── websocket.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   ├── middleware.py
│   │   │   └── exceptions.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── user.py
│   │   │   ├── otp_session.py
│   │   │   ├── category.py
│   │   │   ├── ticket_listing.py
│   │   │   ├── seeker_alert.py
│   │   │   ├── match.py
│   │   │   ├── message.py
│   │   │   ├── review.py
│   │   │   ├── report.py
│   │   │   └── notification.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── listing.py
│   │   │   ├── match.py
│   │   │   ├── message.py
│   │   │   ├── review.py
│   │   │   ├── alert.py
│   │   │   └── common.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── listing_service.py
│   │   │   ├── matching_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── search_service.py
│   │   │   ├── storage_service.py
│   │   │   ├── sms_service.py
│   │   │   ├── email_service.py
│   │   │   └── push_service.py
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── match_worker.py
│   │   │   ├── notification_worker.py
│   │   │   └── expiry_worker.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── pagination.py
│   │       ├── image_processing.py
│   │       ├── validators.py
│   │       └── helpers.py
│   ├── alembic/
│   │   └── versions/
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── [Next.js project]
└── docker-compose.yml
```

### STEP 2: Core Configuration (app/core/config.py)

Create a Settings class using pydantic-settings that reads from environment variables:

```python
# Required settings:
DATABASE_URL: str          # postgresql+asyncpg://...
REDIS_URL: str             # redis://...
SECRET_KEY: str            # JWT secret (min 32 chars)
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
REFRESH_TOKEN_EXPIRE_DAYS: int = 7
MEILISEARCH_URL: str
MEILISEARCH_MASTER_KEY: str
S3_BUCKET_NAME: str
S3_REGION: str
AWS_ACCESS_KEY_ID: str
AWS_SECRET_ACCESS_KEY: str
MSG91_API_KEY: str
MSG91_TEMPLATE_ID: str
SENDGRID_API_KEY: str
EMAIL_FROM: str
FIREBASE_CREDENTIALS_PATH: str
FRONTEND_URL: str
ALLOWED_ORIGINS: list[str]
```

### STEP 3: Database Models (Complete Schema)

Build ALL models with async SQLAlchemy using these specifications:

**users table**:
- id: UUID (PK, auto-generated)
- phone: VARCHAR(15) UNIQUE NOT NULL
- email: VARCHAR(255) UNIQUE nullable
- name: VARCHAR(100) nullable
- avatar_url: TEXT nullable
- phone_verified: BOOLEAN DEFAULT FALSE
- email_verified: BOOLEAN DEFAULT FALSE
- total_listings: INTEGER DEFAULT 0
- total_matches: INTEGER DEFAULT 0
- avg_rating: DECIMAL(3,2) DEFAULT 0.00
- rating_count: INTEGER DEFAULT 0
- notification_prefs: JSONB DEFAULT '{"sms": true, "email": true, "push": true}'
- is_active: BOOLEAN DEFAULT TRUE
- is_banned: BOOLEAN DEFAULT FALSE
- last_active_at: TIMESTAMP nullable
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW() (auto-update trigger)

**ticket_listings table**:
- id: UUID PK
- user_id: UUID FK users.id CASCADE DELETE
- category_id: INTEGER FK categories.id
- title: VARCHAR(200) NOT NULL
- description: TEXT nullable
- origin_city: VARCHAR(100) nullable
- destination_city: VARCHAR(100) nullable
- operator_name: VARCHAR(200) nullable
- operator_code: VARCHAR(50) nullable
- event_name: VARCHAR(200) nullable
- venue_name: VARCHAR(200) nullable
- venue_city: VARCHAR(100) nullable
- section: VARCHAR(50) nullable
- row_number: VARCHAR(20) nullable
- seat_count: INTEGER DEFAULT 1
- seat_details: JSONB nullable
- event_date: DATE NOT NULL
- departure_time: TIME nullable
- arrival_time: TIME nullable
- original_price: DECIMAL(10,2) NOT NULL
- asking_price: DECIMAL(10,2) NOT NULL
- pnr_last_four: VARCHAR(4) nullable
- ticket_photos: ARRAY(TEXT) DEFAULT []
- status: VARCHAR(30) DEFAULT 'active'
  CHECK status IN ('active','matched','transferred','expired','cancelled','flagged')
- matched_user_id: UUID FK users.id nullable
- matched_at: TIMESTAMP nullable
- view_count: INTEGER DEFAULT 0
- interest_count: INTEGER DEFAULT 0
- expires_at: TIMESTAMP NOT NULL
- is_featured: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

Add GIN index on search_vector TSVECTOR column.

### STEP 4: Authentication System (OTP-based)

**OTP Flow**:
1. POST /v1/auth/send-otp { phone: "+91XXXXXXXXXX" }
   - Validate phone number format (Indian: +91 followed by 10 digits)
   - Rate limit: 3 OTPs per phone per 15 minutes (Redis counter)
   - Generate 6-digit OTP
   - Hash OTP with bcrypt (10 rounds)
   - Store in otp_sessions table (expires 10 minutes)
   - Send SMS via MSG91 API
   - Return: { message: "OTP sent successfully" }

2. POST /v1/auth/verify-otp { phone: "...", otp: "123456" }
   - Find latest valid otp_session for phone
   - Check: not used, not expired, attempts < 5
   - Verify OTP hash (bcrypt)
   - Mark otp_session as used
   - If user exists: update last_active_at, return JWT
   - If new user: create user record, return JWT + { is_new_user: true }
   - JWT payload: { sub: user_id, phone: phone, exp: ... }
   - Set JWT in httpOnly, Secure, SameSite=Strict cookie named "access_token"
   - Also return JWT in response body for mobile clients

3. POST /v1/auth/refresh
   - Read refresh token from cookie
   - Validate refresh token
   - Issue new access token

4. DELETE /v1/auth/logout
   - Clear cookies

### STEP 5: Listings API (Complete CRUD)

**GET /v1/listings** — Browse with filtering:
```python
Query params:
- category: Optional[str]       # category slug
- origin: Optional[str]         # origin city (case-insensitive contains)
- destination: Optional[str]    # destination city
- date: Optional[date]          # exact date
- date_from: Optional[date]     # date range start
- date_to: Optional[date]       # date range end
- max_price: Optional[Decimal]  # maximum asking price
- sort: str = "newest"          # newest|price_asc|price_desc|expiring_soon
- page: int = 1
- limit: int = 20               # max 50

Response: PaginatedResponse[ListingCard]
- Only show listings where status='active' AND expires_at > NOW()
- Include seller's name, avg_rating, phone_verified status
- Include view_count, interest_count
```

**POST /v1/listings** — Create listing:
```python
# Require authentication
# Validate:
#   - asking_price <= original_price * 0.90 (anti-scalping)
#   - asking_price >= original_price * 0.30 (minimum)
#   - event_date >= today
#   - At least 1 ticket_photo required
#   - Rate limit: max 10 listings per user per hour
# Auto-compute:
#   - title: auto-generate if not provided (e.g., "Delhi → Mumbai · Jun 3")
#   - expires_at: event_date + departure_time (or event_date + 23:59 if no time)
# After creation:
#   - Index in MeiliSearch
#   - Trigger Celery task: check_seeker_alerts(listing_id)
#   - Increment user.total_listings
```

**POST /v1/listings/{id}/interest** — Seeker expresses interest:
```python
# Require authentication (must be different user than listing owner)
# Check listing is still active
# Check seeker hasn't already expressed interest (unique constraint)
# Create match record: { listing_id, seeker_id, transferor_id, status: 'pending' }
# Increment listing.interest_count
# Create notification for transferor
# Trigger: notify_transferor Celery task (SMS + push)
# Trigger: WebSocket event to transferor (if connected)
```

### STEP 6: Matching Service (Core Algorithm)

```python
# matching_service.py

async def check_seeker_alerts_for_listing(listing_id: UUID, db: AsyncSession):
    """
    When a new listing is posted, find all seeker alerts that match it
    and notify those seekers.
    """
    listing = await get_listing(listing_id, db)
    
    # Build query for matching alerts
    alerts = await db.execute(
        select(SeekerAlert).where(
            and_(
                SeekerAlert.is_active == True,
                SeekerAlert.user_id != listing.user_id,  # no self-match
                or_(
                    SeekerAlert.category_id == None,     # any category
                    SeekerAlert.category_id == listing.category_id
                ),
                or_(
                    SeekerAlert.origin_city == None,
                    func.lower(SeekerAlert.origin_city).contains(
                        func.lower(listing.origin_city)
                    )
                ),
                or_(
                    SeekerAlert.destination_city == None,
                    func.lower(SeekerAlert.destination_city).contains(
                        func.lower(listing.destination_city)
                    )
                ),
                or_(
                    SeekerAlert.date_from == None,
                    SeekerAlert.date_from <= listing.event_date
                ),
                or_(
                    SeekerAlert.date_to == None,
                    SeekerAlert.date_to >= listing.event_date
                ),
                or_(
                    SeekerAlert.max_price == None,
                    SeekerAlert.max_price >= listing.asking_price
                ),
                # Alert not expired
                or_(
                    SeekerAlert.expires_at == None,
                    SeekerAlert.expires_at > func.now()
                )
            )
        )
    )
    
    for alert in alerts.scalars():
        # Send notification to seeker
        await notification_service.send_match_alert(
            user_id=alert.user_id,
            listing=listing,
            alert=alert
        )
        
        # Update alert
        alert.last_fired_at = datetime.utcnow()
        alert.fire_count += 1
    
    await db.commit()
```

### STEP 7: WebSocket Server

```python
# websocket.py

# Connection manager using Redis PubSub for horizontal scaling
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        # Subscribe to Redis channel for this user
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        self.active_connections[user_id].remove(websocket)
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for ws in self.active_connections[user_id]:
                await ws.send_json(message)
        # Also publish to Redis for other server instances

# Route:
@router.websocket("/ws/notifications/{user_id}")
async def notification_ws(websocket: WebSocket, user_id: str, token: str):
    # Validate JWT token from query param
    # Connect user
    # Listen for Redis PubSub messages
    # Forward to WebSocket
    pass

@router.websocket("/ws/chat/{match_id}")
async def chat_ws(websocket: WebSocket, match_id: str, token: str):
    # Validate JWT
    # Verify user is part of this match
    # Real-time message delivery
    pass
```

### STEP 8: Celery Workers

```python
# celery_app.py
from celery import Celery
from celery.schedules import crontab

app = Celery("lastminutepass")
app.config_from_object("app.core.config")

app.conf.beat_schedule = {
    # Run every 30 minutes: expire old listings
    "expire-listings": {
        "task": "app.workers.expiry_worker.expire_old_listings",
        "schedule": 1800.0,  # 30 minutes
    },
    # Run every hour: send expiry warnings
    "expiry-warnings": {
        "task": "app.workers.expiry_worker.send_expiry_warnings",
        "schedule": 3600.0,  # 1 hour
    },
    # Run every 6 hours: cleanup old OTP sessions
    "cleanup-otps": {
        "task": "app.workers.cleanup_worker.cleanup_expired_otps",
        "schedule": 21600.0,  # 6 hours
    },
}

# Tasks:
# match_worker.py
@celery_app.task
def check_seeker_alerts(listing_id: str):
    """Run after new listing created"""
    pass

# expiry_worker.py
@celery_app.task
def expire_old_listings():
    """Mark all listings past their expires_at as 'expired'"""
    pass

@celery_app.task
def send_expiry_warnings():
    """Notify transferors whose listings expire in 2 hours"""
    pass

# notification_worker.py
@celery_app.task
def send_sms_notification(phone: str, message: str):
    pass

@celery_app.task
def send_email_notification(email: str, subject: str, html: str):
    pass

@celery_app.task
def send_push_notification(fcm_token: str, title: str, body: str, data: dict):
    pass
```

---

## PHASE 2: FRONTEND — Next.js Application

### STEP 9: Next.js Project Setup

Initialize with Next.js 14 App Router, TypeScript, Tailwind CSS.

### STEP 10: Design System Implementation

Implement the complete design system in `globals.css` and `tailwind.config.ts`:

**Color Palette** (Dark theme primary):
```css
:root {
  /* Backgrounds */
  --bg-base: #050714;
  --bg-surface-1: #0d1117;
  --bg-surface-2: #161b27;
  --bg-surface-3: #1e2535;
  
  /* Brand */
  --primary: #3b82f6;      /* Blue */
  --accent: #8b5cf6;       /* Violet */
  --success: #10b981;      /* Green */
  --warning: #f59e0b;      /* Amber */
  --danger: #ef4444;       /* Red */
  
  /* Text */
  --text-primary: #f0f4ff;
  --text-secondary: #94a3b8;
  --text-muted: #4b5563;
  
  /* Borders */
  --border: rgba(255,255,255,0.08);
  
  /* Fonts */
  --font-sans: 'Inter', sans-serif;
  --font-display: 'Outfit', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

**Glass Card Component** (Use everywhere for cards):
```css
.glass-card {
  background: rgba(13, 17, 23, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}
```

**Gradient Button**:
```css
.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 9999px;
  padding: 12px 28px;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 0 20px rgba(59,130,246,0.3);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 30px rgba(59,130,246,0.5);
}
```

### STEP 11: Page-by-Page Implementation

#### Page 1: Landing Page (/) — MOST IMPORTANT

Build a stunning landing page with these EXACT sections:

**Section 1: Hero**
```
Background: Animated aurora gradient (CSS animated radial-gradients in deep blue/violet)
- Multiple animated blobs using @keyframes that shift slowly
- Subtle floating particle effect (small white dots, 20-30)

Left Side Content:
- Small pill badge: "🟢 Live · 1,247 tickets available"
- Headline (display font, large): "Last Minute Tickets." + "Real Connections."
  - Word "Tickets" has gradient text (blue→violet)
- Sub-headline: "Someone canceled. You need a seat. We connect you instantly — free."
- Two CTA buttons:
  1. "Find a Ticket →" (gradient button, primary)
  2. "List My Ticket" (ghost/outline button)

Right Side: (desktop only)
- 3 floating ticket cards with stagger animation (float up-down infinite)
- Each card shows: route, price, time remaining countdown
- Cards have glass morphism style with category color borders

Center (below):
- Large search bar (glass morphism, 72px height)
  - Icon: 🔍
  - Placeholder: "Search by route, event, or city..."
  - Date picker button
  - "Search" button (gradient)
- Category pills below search:
  [🚂 Train] [🚌 Bus] [🏏 IPL] [🎵 Concert] [🎭 Event]
  - Each pill: glass card, hover glow with category color

Bottom of hero:
- Live activity ticker (horizontal scrolling marquee):
  "🔴 Rahul listed Delhi→Mumbai · ₹625" ... "🟢 Priya found a ticket to Pune" ...
```

**Section 2: How It Works**
```
Title: "How It Works"
Sub: "Three simple steps to find or transfer your ticket"

3 cards in a row:
1. 🎫 "List or Browse"
   Icon: large animated icon
   Text: "Transferors post tickets. Seekers search by route, date, or event."

2. 🤝 "Get Matched"  
   Icon: animated connecting dots
   Text: "Our system instantly alerts the right people. Real-time notifications."

3. ✅ "Connect & Transfer"
   Icon: animated checkmark
   Text: "Chat directly. Share contact. Transfer happens between you — we stay out of the way."

Cards: glass morphism, gradient top border, number badge
Animation: Fade in on scroll (Intersection Observer)
```

**Section 3: Live Listings**
```
Title: "🔴 Live Tickets Right Now"
Sub badge: "Updates in real-time"

Horizontal scroll of 6-8 TicketCard components
Auto-refreshes every 30 seconds
"View All →" link
```

**Section 4: Category Showcase**
```
Tabs: [Train] [Bus] [IPL] [Concerts] [Events]
Content switches based on active tab
Shows 4 cards per tab in a 2x2 grid
Tab switching has smooth fade animation
```

**Section 5: Trust Section**
```
"Why LastMinutePass?"
4 feature cards in 2x2 grid:
1. 🔒 Verified Sellers — "Every seller has a verified phone number"
2. ⭐ Honest Reviews — "Real ratings from real transfers"
3. ⚡ Instant Alerts — "Get notified the second a matching ticket appears"
4. 💸 Zero Fees — "Completely free to list and search. Always."
```

**Section 6: Animated Stats Counter**
```
4 numbers that count up when scrolled into view:
- "12,430+" Tickets Listed
- "8,920+" Successful Matches
- "4.8/5" Average Rating
- "50+" Cities Covered
```

**Section 7: Testimonials**
```
Auto-scrolling carousel (3 second interval, smooth)
Each card: Avatar, Name, City, Rating, Quote
Glass morphism cards
```

**Section 8: FAQ**
```
Accordion: 6-8 common questions
Smooth animation on expand/collapse
```

**Footer**:
```
Dark background, subtle
- Logo + tagline
- Links: About, How it works, Safety, Terms, Privacy
- Social icons
- "Made with ❤️ in India"
- Copyright
```

#### Page 2: Browse Tickets (/tickets)

```
Layout: Sidebar (desktop) + Main content

Sticky filter sidebar (desktop):
- Category checkboxes with colored icons
- Price range slider (₹0-₹5000)
- Date range picker
- Origin city autocomplete input
- Destination city autocomplete input
- "Verified sellers only" toggle
- "Posted within" radio group

Main content:
- Search bar (compact version)
- Filter chips showing active filters (with × to remove)
- Sort dropdown + result count
- Ticket grid (responsive: 1→2→3 columns)
- Infinite scroll or "Load More" button
- Loading skeleton cards (shimmer animation)

Empty State:
- SVG illustration of empty seat
- "No tickets found matching your search"
- "Set an Alert" button (creates seeker_alert)

Mobile:
- Filter button → Right drawer with all filters
- Full-width card layout
```

#### Page 3: Ticket Detail (/tickets/[id])

```
Layout: Two-column (desktop), single column (mobile)

Left Column:
- Breadcrumb: Home > Train Tickets > Delhi → Mumbai
- Large Ticket Visual Component (styled like real physical ticket)
  - Category icon + name badge
  - Route with arrow and divider line
  - Times and dates
  - Train/Bus/Event details
  - Class, Coach, Seat info
  - Subtle tear marks on edges (CSS)
- Ticket photos gallery (lightbox on click)
- Status badge (Active / URGENT if < 2hr)
- Description text

Right Column (sticky on desktop):
- Seller card:
  - Avatar + name
  - Rating stars + count
  - Verification badges
  - "Online now" / "Active X hours ago"
- Pricing:
  - Original price (strikethrough)
  - Asking price (large, gradient text)
  - Savings badge: "Save ₹625"
- CTA buttons:
  - "💚 I'm Interested" (primary gradient)
  - "💬 Message" (secondary)
  - "🔗 Share" (ghost)
- Countdown timer if < 24h to event
- Safety tips accordion

Below main content:
- Similar listings (horizontal scroll)
- Report listing link (subtle, at bottom)
```

#### Page 4: Post a Ticket (/post)

Multi-step form with beautiful UI:

```
Sticky progress bar at top showing steps

Step 1 — Category Selection:
- Title: "What type of ticket are you listing?"
- Large visual cards (3 cols desktop, 2 cols mobile):
  [🚂 Train] [🚌 Bus] [🏏 IPL]
  [🎵 Concert] [🏟️ Cricket] [🎭 Event]
- Hover: scale up, glow border
- Selected: gradient border, checkmark, filled background

Step 2 — Ticket Details:
- Conditional fields based on category selected
- TRAIN fields:
  * From (city autocomplete)
  * To (city autocomplete)
  * Travel Date (date picker)
  * Departure Time
  * Train Name/Number
  * Class (SL/3A/2A/1A) — button group selector
  * Coach (optional)
  * Berth/Seat (optional)
  * PNR last 4 digits (optional, with helper text about privacy)
- EVENTS fields:
  * Event Name
  * Venue Name
  * City
  * Event Date
  * Event Time
  * Section/Stand (optional)
  * Row (optional)
  * Seat Number (optional)
- All fields: glass morphism inputs, floating labels
- Inline validation with green checkmark / red error

Step 3 — Photo Upload:
- Title: "Upload ticket photo (Required)"
- Large drag-and-drop zone:
  "Drop ticket photo here or click to browse"
  Accepts: JPEG, PNG, WebP · Max 5MB each
- Shows preview thumbnails after upload
- Remove button on each preview
- Progress bar during upload
- Compression notice: "Photos are compressed for privacy"

Step 4 — Pricing:
- "What did you originally pay?" — number input (₹)
- "What are you asking?" 
  - Default: 50% of original
  - Interactive slider: 30% ─────●───── 90%
  - Live preview of price as slider moves
  - Badge: "Fair Price ✓" when near 50%
  - Warning if above 80%: "Asking near face value may reduce interest"
- Show: "Seeker saves: ₹625"
- Optional description textarea (max 300 chars)

Step 5 — Preview & Submit:
- Shows the TicketCard exactly as it will appear to seekers
- Checklist:
  ✅ Category selected
  ✅ Route/event details added
  ✅ Photo uploaded (X photos)
  ✅ Price set
- Agreement text + checkbox:
  "I confirm this ticket is genuine and I am the original booker."
- "Post Ticket" button (large gradient)

Step 6 — Success:
- Confetti animation (canvas-confetti)
- Large checkmark animation
- "Your ticket is live! 🎉"
- "Share your listing:" + copy link button
- "Set up a price alert?" — optional
- "View My Listing →" button
- "Post Another Ticket" link
```

#### Page 5: Authentication (/auth)

```
Desktop: Split screen
Left: Brand panel
  - Gradient background
  - Logo
  - "Your seat, their second chance."
  - 3 floating ticket card illustrations
  
Right: Auth form

Mobile: Single centered card

Phone OTP Flow:
Step 1 — Phone Input:
  - "Enter your mobile number"
  - Flag + phone input (react-phone-input-2, pre-select India)
  - "Send OTP" gradient button
  - "We'll send a 6-digit code to this number"

Step 2 — OTP Input:
  - "Enter OTP sent to +91 98XXX XXXXX"
  - 6 individual digit boxes (auto-advance, auto-submit on complete)
  - Resend countdown: "Resend in 28s"
  - Back button to change number
  - Numbers auto-move focus

Step 3 (new users only) — Profile Setup:
  - "Welcome! Tell us a bit about yourself"
  - Name input
  - Email input (optional)
  - "Complete Setup" button
```

#### Page 6: Dashboard (/dashboard)

```
Protected route (redirect to /auth if not logged in)

Stats row at top:
┌────────────┬────────────┬────────────┬────────────┐
│  3 Active  │  8 Matched │  47 Views  │  ⭐ 4.9   │
│  Listings  │  Transfers │  This Week │  Rating    │
└────────────┴────────────┴────────────┴────────────┘
Each stat: glass card, animated count-up, colored icon

Main Content Tabs:
[My Listings] [Interested In] [Matches] [Alerts] [Reviews]

My Listings tab:
- Sub-tabs: [Active] [Matched] [Expired] [All]
- My listing card (compact version of TicketCard):
  - Status badge
  - 👁️ 12 views · 🤝 3 interested
  - "3 people interested" link → opens list
  - [Edit] [Delete] [Mark Transferred] buttons
  - Countdown if expiring soon

Matches tab:
- List of match cards
- For transferor: shows seeker name, rating, note, [Accept] [Decline] buttons
- For seeker: shows listing + status + [Open Chat] button
- Status indicators with colored badges

Alerts tab:
- List of seeker alerts with filter criteria
- Toggle on/off switch
- Delete button
- "Create New Alert" button

Floating Action Button (mobile only):
- Bottom right: ➕ gradient circle button → /post
```

#### Page 7: Chat (/chat/[matchId])

```
Full-screen chat layout:

Header:
- Back arrow
- Other user's avatar + name + verification badge
- "Regarding: Delhi→Mumbai ticket"
- Online status

Messages area (scrollable, overflow):
- System messages (centered, muted):
  "Match confirmed! You can now chat."
  "Priya revealed Rahul's contact."
- User messages:
  - Own: Right-aligned, blue gradient bubble
  - Other: Left-aligned, dark glass bubble
  - Timestamps below each message (relative: "2m ago")
  - Seen indicator (✓✓)

Sticky bottom actions:
- If contact not revealed: "📞 Reveal Phone Number" banner above input
- If contact revealed: Shows phone number with copy button

Chat input:
- Text area (auto-resize)
- 📎 attach button
- Send button (gradient)

Safety notice (shown once):
- Orange box: "⚠️ Never send money in advance. Verify ticket before paying."
```

### STEP 12: Reusable Components

Build these reusable components:

```typescript
// TicketCard.tsx
// Props: listing (TicketListing), variant ("full" | "compact" | "preview")
// Features:
// - Category-specific gradient left border
// - URGENT badge + pulsing border if expires < 2 hours
// - 🔥 HOT badge if interest_count > 5
// - NEW badge if created < 30 minutes ago
// - Countdown timer component
// - Seller mini-profile with rating
// - Hover: lift animation + reveal "Quick View" overlay
// - Price display: strikethrough original, bold asking price

// Countdown.tsx
// Takes: expires_at (timestamp)
// Shows: "Xh Xm" or "Xm Xs" when < 1hr
// Colors: green > 24hr, yellow 2-24hr, red < 2hr
// Pulses when < 1hr

// SkeletonCard.tsx
// Shimmer loading state matching TicketCard dimensions
// Used during data fetching

// LiveBadge.tsx
// Pulsing green dot + "Live" text
// Used to indicate real-time data

// StarRating.tsx
// Interactive or display mode
// Hover to preview rating
// Animated fill

// OtpInput.tsx
// 6 individual inputs
// Auto-advance on input
// Auto-backspace handling
// Paste support (splits across boxes)
// Auto-submit when last digit entered
```

### STEP 13: State Management

```typescript
// authStore.ts (Zustand)
interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

// notificationStore.ts (Zustand)
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  wsConnected: boolean;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

// searchStore.ts (Zustand)
interface SearchStore {
  filters: SearchFilters;
  setFilter: (key: keyof SearchFilters, value: any) => void;
  clearFilters: () => void;
  recentSearches: string[];
}
```

---

## PHASE 3: INFRASTRUCTURE

### STEP 14: Docker Compose

Create a complete docker-compose.yml with services:
- backend (FastAPI + Uvicorn)
- frontend (Next.js)
- celery_worker
- celery_beat
- flower (Celery monitoring on port 5555)
- postgres
- redis
- meilisearch
- nginx

Include health checks for postgres and redis.
Include volume mounts for development hot-reload.

### STEP 15: Nginx Configuration

```nginx
server {
    listen 80;
    server_name localhost;
    
    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket
    location /ws/ {
        proxy_pass http://backend:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
    
    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### STEP 16: Database Migration (Alembic)

Create initial migration that:
1. Creates all tables in correct dependency order
2. Adds all indexes
3. Inserts seed data for categories
4. Creates PostgreSQL functions for updated_at trigger

---

## QUALITY REQUIREMENTS

### Every Page Must:
- Score 90+ on Lighthouse (Performance, Accessibility, Best Practices, SEO)
- Work perfectly on: iPhone SE (375px), iPad (768px), Desktop (1440px)
- Load content within 2 seconds on 4G
- Work without JavaScript for static content (SSR)
- Have proper meta tags (title, description, og:image)

### Every API Endpoint Must:
- Return proper HTTP status codes
- Include error messages in standardized format
- Be documented with FastAPI auto-docs (include description, examples)
- Have input validation via Pydantic
- Log errors to Sentry

### Security Requirements:
- JWT in httpOnly cookies ONLY (not localStorage)
- CSRF protection on all POST/PUT/DELETE endpoints
- Rate limiting on all auth endpoints
- Input sanitization on all user-generated content
- File uploads validated by magic bytes (not just extension)
- PNR numbers: NEVER store complete PNR, only last 4 digits

### Code Quality:
- TypeScript strict mode in frontend (no `any` types)
- Python type hints on all functions
- 80%+ test coverage on critical business logic (auth, matching, listings)
- All async functions properly awaited
- Database queries use proper indexes

---

## FINAL DELIVERABLE CHECKLIST

When complete, the application must have:

**Backend (FastAPI)**:
- [ ] All 14 database tables created with proper indexes
- [ ] OTP authentication flow (send + verify + refresh + logout)
- [ ] Complete Listings CRUD API with filtering/pagination
- [ ] Search endpoint (MeiliSearch integration)
- [ ] Match flow (interest → accept → reveal → confirm)
- [ ] In-app messaging API
- [ ] Seeker alerts CRUD
- [ ] Review system
- [ ] Notification system (in-app + SMS + push)
- [ ] WebSocket server (notifications + chat)
- [ ] Admin endpoints
- [ ] Celery workers (matching + expiry + notifications)
- [ ] S3 file upload endpoint
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] Sentry integration
- [ ] Alembic migrations

**Frontend (Next.js)**:
- [ ] Landing page (hero + all sections)
- [ ] Browse/search page (with filters)
- [ ] Ticket detail page
- [ ] Post ticket form (5-step)
- [ ] Auth page (OTP flow)
- [ ] User dashboard (all tabs)
- [ ] Chat interface
- [ ] Profile pages
- [ ] Notification system (bell + toasts + WebSocket)
- [ ] PWA manifest + service worker
- [ ] Dark/light theme toggle
- [ ] Mobile bottom navigation
- [ ] Full responsive design
- [ ] Loading skeletons throughout
- [ ] Empty states throughout

**Infrastructure**:
- [ ] Docker Compose (all services)
- [ ] Nginx configuration
- [ ] Environment variable templates
- [ ] Database seed data (categories)
- [ ] README with setup instructions

---

## SEED DATA

Insert this data on first run:

```sql
INSERT INTO categories (slug, name, icon, color_hex, sort_order) VALUES
('train',   'Train',   '🚂', '#2563eb', 1),
('bus',     'Bus',     '🚌', '#059669', 2),
('ipl',     'IPL',     '🏏', '#dc2626', 3),
('cricket', 'Cricket', '🏟️', '#16a34a', 4),
('concert', 'Concert', '🎵', '#7c3aed', 5),
('event',   'Event',   '🎭', '#a855f7', 6);
```

Also create a demo admin user and 10 sample listings for development testing.

---

## IMPORTANT NOTES FOR BUILDER

1. **This is an Indian product** — Use Indian cities, INR currency (₹), Indian phone format (+91), Indian train/bus terminology

2. **Mobile-first** — 70%+ users will use phones. Every interaction must feel native on mobile.

3. **Speed is critical** — Train/bus travelers need quick info. No unnecessary loading states.

4. **Trust is the product** — Every UI decision should reinforce trust: verification badges, ratings, reviews, safety tips.

5. **Dark theme is primary** — The app ships in dark mode. Light theme is secondary/optional.

6. **No payment UI** — Do NOT build any payment forms, wallet UI, or banking integration. We explicitly do not process payments.

7. **Listing is FREE** — Remove any UI that implies a listing fee. The word "Free" should appear prominently.

8. **Anti-scalping** — Enforce the 90% price cap in BOTH frontend validation AND backend validation. Show warning messages for high prices.
