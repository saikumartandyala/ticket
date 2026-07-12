# 🏗️ LastMinutePass — System Architecture & Application Flow
### Complete Technical Blueprint

---

## 1. 🗺️ High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENTS LAYER                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐│
│  │  Web Browser   │  │  Mobile PWA    │  │  (Future) React Native App     ││
│  │  (Next.js SSR) │  │  (Same Build)  │  │                                ││
│  └───────┬────────┘  └───────┬────────┘  └────────────────┬───────────────┘│
└──────────┼───────────────────┼─────────────────────────────┼───────────────┘
           │ HTTPS             │ HTTPS                        │ HTTPS
           └───────────────────┼─────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────────┐
│                         CDN + EDGE LAYER                                   │
│                  Cloudflare (CDN, WAF, DDoS protection)                    │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────────┐
│                         REVERSE PROXY                                      │
│                      Nginx (SSL Termination, Rate Limiting)                │
└──────────────┬───────────────────────────────┬────────────────────────────┘
               │                               │
┌──────────────▼──────────────┐  ┌────────────▼─────────────────────────────┐
│      FRONTEND SERVER        │  │           BACKEND API SERVER              │
│  Next.js (Port 3000)        │  │    FastAPI + Uvicorn (Port 8000)          │
│  - SSR Pages                │  │    - REST API                             │
│  - Static Assets            │  │    - WebSocket Server                     │
│  - API Routes (thin)        │  │    - Background Task Manager              │
└─────────────────────────────┘  └────────────┬─────────────────────────────┘
                                              │
              ┌───────────────────────────────┼────────────────────────────┐
              │                               │                            │
┌─────────────▼──────────┐    ┌──────────────▼───────────┐  ┌────────────▼──────────┐
│      PostgreSQL         │    │          Redis            │  │      MeiliSearch       │
│  (Primary Database)     │    │  (Cache + Queue + PubSub) │  │  (Full-text search)   │
│  Port: 5432             │    │  Port: 6379               │  │  Port: 7700            │
└────────────────────────┘    └──────────────────────────┘  └────────────────────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │       Celery Workers         │
                               │  (Background Job Processing) │
                               │  - Matching Engine Worker    │
                               │  - Notification Worker       │
                               │  - Expiry/Cleanup Worker     │
                               └──────────────┬──────────────┘
                                              │
              ┌───────────────────────────────┼────────────────────────────┐
              │                               │                            │
┌─────────────▼──────────┐    ┌──────────────▼───────────┐  ┌────────────▼──────────┐
│      SMS Gateway        │    │     Email Service         │  │    Push Notifications  │
│   MSG91 / Fast2SMS      │    │  SendGrid / AWS SES       │  │  Firebase Cloud Msg    │
│   (OTP + Alerts)        │    │  (Transactional emails)   │  │  (Browser/PWA push)   │
└────────────────────────┘    └──────────────────────────┘  └────────────────────────┘

              ┌────────────────────────────────────────────────────────────┐
              │                    STORAGE LAYER                            │
              │     AWS S3 / Cloudflare R2 (Ticket Photos + Avatars)       │
              └────────────────────────────────────────────────────────────┘
```

---

## 2. 🗃️ Database Schema (PostgreSQL)

### Table: users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    name            VARCHAR(100),
    avatar_url      TEXT,
    
    -- Verification Status
    phone_verified  BOOLEAN DEFAULT FALSE,
    email_verified  BOOLEAN DEFAULT FALSE,
    aadhaar_verified BOOLEAN DEFAULT FALSE,
    
    -- Profile Stats
    total_listings  INTEGER DEFAULT 0,
    total_matches   INTEGER DEFAULT 0,
    avg_rating      DECIMAL(3,2) DEFAULT 0.00,
    rating_count    INTEGER DEFAULT 0,
    
    -- Settings
    notification_prefs JSONB DEFAULT '{"sms": true, "email": true, "push": true}',
    
    -- Metadata
    is_active       BOOLEAN DEFAULT TRUE,
    is_banned       BOOLEAN DEFAULT FALSE,
    last_active_at  TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
```

### Table: otp_sessions
```sql
CREATE TABLE otp_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       VARCHAR(15) NOT NULL,
    otp_hash    VARCHAR(255) NOT NULL,    -- bcrypt hashed OTP
    purpose     VARCHAR(50) NOT NULL,     -- 'login', 'verify', 'reset'
    attempts    INTEGER DEFAULT 0,
    is_used     BOOLEAN DEFAULT FALSE,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_sessions(phone, is_used, expires_at);
```

### Table: categories
```sql
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50) UNIQUE NOT NULL,   -- 'train', 'bus', 'ipl', 'concert', 'event'
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(10),                   -- emoji
    color_hex   VARCHAR(7),
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0
);

INSERT INTO categories (slug, name, icon, color_hex) VALUES
('train',   'Train',   '🚂', '#2563eb'),
('bus',     'Bus',     '🚌', '#059669'),
('ipl',     'IPL',     '🏏', '#dc2626'),
('cricket', 'Cricket', '🏟️', '#16a34a'),
('concert', 'Concert', '🎵', '#7c3aed'),
('event',   'Event',   '🎭', '#a855f7');
```

### Table: ticket_listings
```sql
CREATE TABLE ticket_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id     INTEGER REFERENCES categories(id),
    
    -- Event / Journey Details
    title           VARCHAR(200) NOT NULL,       -- auto-generated or custom
    description     TEXT,
    
    -- Route Info (Train/Bus)
    origin_city     VARCHAR(100),
    destination_city VARCHAR(100),
    operator_name   VARCHAR(200),               -- "Rajdhani Express", "KSRTC"
    operator_code   VARCHAR(50),                -- "12951"
    
    -- Event Info (IPL/Concert)
    event_name      VARCHAR(200),
    venue_name      VARCHAR(200),
    venue_city      VARCHAR(100),
    section         VARCHAR(50),                -- "Stand A", "VIP"
    row_number      VARCHAR(20),
    
    -- Seat Info (common)
    seat_count      INTEGER DEFAULT 1,
    seat_details    JSONB,                      -- {"coach": "S4", "seat": "32", "class": "SL"}
    
    -- Date & Time
    event_date      DATE NOT NULL,
    departure_time  TIME,
    arrival_time    TIME,
    
    -- Pricing
    original_price  DECIMAL(10,2) NOT NULL,
    asking_price    DECIMAL(10,2) NOT NULL,
    
    -- Verification
    pnr_last_four   VARCHAR(4),                 -- last 4 digits only, for display
    booking_ref     VARCHAR(50),                -- internal reference
    
    -- Media
    ticket_photos   TEXT[],                     -- S3 URLs array
    
    -- Status
    status          VARCHAR(30) DEFAULT 'active',
    -- 'active' | 'matched' | 'transferred' | 'expired' | 'cancelled' | 'flagged'
    
    -- Matching
    matched_user_id UUID REFERENCES users(id),
    matched_at      TIMESTAMP,
    
    -- Engagement
    view_count      INTEGER DEFAULT 0,
    interest_count  INTEGER DEFAULT 0,          -- number of seekers interested
    
    -- Auto-expiry
    expires_at      TIMESTAMP NOT NULL,         -- = event_date + departure_time
    
    -- Metadata
    is_featured     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_listings_status       ON ticket_listings(status, expires_at);
CREATE INDEX idx_listings_category     ON ticket_listings(category_id, status);
CREATE INDEX idx_listings_event_date   ON ticket_listings(event_date, status);
CREATE INDEX idx_listings_origin_dest  ON ticket_listings(origin_city, destination_city);
CREATE INDEX idx_listings_user         ON ticket_listings(user_id, status);
CREATE INDEX idx_listings_created      ON ticket_listings(created_at DESC);

-- Full-text search (PostgreSQL built-in)
ALTER TABLE ticket_listings ADD COLUMN search_vector TSVECTOR;
CREATE INDEX idx_listings_search ON ticket_listings USING GIN(search_vector);
```

### Table: seeker_alerts
```sql
CREATE TABLE seeker_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Search criteria (alert fires when a matching listing is posted)
    category_id     INTEGER REFERENCES categories(id),
    origin_city     VARCHAR(100),
    destination_city VARCHAR(100),
    event_name      VARCHAR(200),
    venue_city      VARCHAR(100),
    date_from       DATE,
    date_to         DATE,
    max_price       DECIMAL(10,2),
    
    -- Status
    is_active       BOOLEAN DEFAULT TRUE,
    last_fired_at   TIMESTAMP,
    fire_count      INTEGER DEFAULT 0,
    
    created_at      TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP                   -- auto-expire with event date
);
```

### Table: matches
```sql
CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID REFERENCES ticket_listings(id) ON DELETE CASCADE,
    seeker_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    transferor_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status flow
    status          VARCHAR(30) DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'contact_revealed' | 'transferred' | 'cancelled' | 'disputed'
    
    -- Contact reveal tracking
    contact_revealed_at   TIMESTAMP,
    
    -- Transfer confirmation
    transfer_confirmed_at TIMESTAMP,
    confirmed_by          UUID REFERENCES users(id),
    
    -- Notes
    seeker_note     TEXT,
    
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matches_listing   ON matches(listing_id, status);
CREATE INDEX idx_matches_seeker    ON matches(seeker_id, status);
CREATE INDEX idx_matches_transferor ON matches(transferor_id, status);
CREATE UNIQUE INDEX idx_matches_unique ON matches(listing_id, seeker_id) 
    WHERE status NOT IN ('cancelled');
```

### Table: messages (In-app chat)
```sql
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID REFERENCES matches(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    
    content     TEXT NOT NULL,
    msg_type    VARCHAR(20) DEFAULT 'text',    -- 'text' | 'image' | 'system'
    
    is_read     BOOLEAN DEFAULT FALSE,
    read_at     TIMESTAMP,
    
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_match    ON messages(match_id, created_at);
CREATE INDEX idx_messages_sender   ON messages(sender_id);
CREATE INDEX idx_messages_unread   ON messages(match_id, is_read) WHERE is_read = FALSE;
```

### Table: reviews
```sql
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
    reviewer_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewed_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    
    -- Review type
    review_type     VARCHAR(20),    -- 'transferor_to_seeker' | 'seeker_to_transferor'
    
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_reviews_unique ON reviews(match_id, reviewer_id);
```

### Table: reports
```sql
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID REFERENCES users(id),
    listing_id      UUID REFERENCES ticket_listings(id),
    reported_user_id UUID REFERENCES users(id),
    
    reason          VARCHAR(50),    -- 'fake_ticket' | 'fraud' | 'spam' | 'inappropriate'
    description     TEXT,
    status          VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'reviewed' | 'resolved'
    
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### Table: notifications
```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    type        VARCHAR(50),    -- 'match_found' | 'message' | 'expiring' | 'review_request'
    
    -- Link data
    entity_type VARCHAR(50),   -- 'listing' | 'match' | 'review'
    entity_id   UUID,
    
    is_read     BOOLEAN DEFAULT FALSE,
    read_at     TIMESTAMP,
    
    -- Delivery status
    sent_sms    BOOLEAN DEFAULT FALSE,
    sent_email  BOOLEAN DEFAULT FALSE,
    sent_push   BOOLEAN DEFAULT FALSE,
    
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read, created_at DESC);
```

---

## 3. 🔌 API Design (FastAPI REST + WebSocket)

### Base URL
```
Production:  https://api.lastminutepass.in/v1
Development: http://localhost:8000/v1
```

### Authentication
```
All protected routes require:
Authorization: Bearer <JWT_TOKEN>

JWT Payload:
{
  "sub": "<user_id>",
  "phone": "+919876543210",
  "verified": true,
  "exp": <timestamp>
}
```

### API Endpoints

#### Auth
```
POST   /auth/send-otp          Send OTP to phone
POST   /auth/verify-otp        Verify OTP → return JWT token
POST   /auth/refresh            Refresh JWT token
DELETE /auth/logout             Invalidate token
GET    /auth/me                 Get current user profile
```

#### Users
```
GET    /users/{id}              Get public profile
PUT    /users/me                Update profile (name, email, avatar)
POST   /users/me/avatar         Upload avatar photo
DELETE /users/me                Deactivate account
GET    /users/me/stats          Dashboard stats
```

#### Listings
```
GET    /listings                Browse listings (with filters & pagination)
  Query params:
  - category: train|bus|ipl|cricket|concert|event
  - origin: city name
  - destination: city name
  - date: YYYY-MM-DD
  - date_from: YYYY-MM-DD
  - date_to: YYYY-MM-DD
  - max_price: number
  - sort: newest|price_asc|price_desc|expiring_soon
  - page: number (default 1)
  - limit: number (default 20, max 50)

POST   /listings                Create new listing
GET    /listings/{id}           Get listing details
PUT    /listings/{id}           Update listing (owner only)
DELETE /listings/{id}           Delete/cancel listing (owner only)
POST   /listings/{id}/view      Increment view count
POST   /listings/{id}/interest  Express interest (creates match request)
POST   /listings/{id}/confirm   Confirm transfer completed (owner only)
GET    /listings/me             My listings (authenticated)
```

#### Search
```
GET    /search                  Full-text search
  Query params:
  - q: search query string
  - ...same filters as /listings

GET    /search/suggestions      Autocomplete suggestions for cities/events
GET    /search/popular-routes   Popular routes (cached)
GET    /search/trending-events  Trending events
```

#### Matches
```
GET    /matches                 Get my matches (as transferor or seeker)
GET    /matches/{id}            Get match details
PUT    /matches/{id}/accept     Transferor accepts seeker interest
PUT    /matches/{id}/decline    Decline match
POST   /matches/{id}/reveal     Reveal contact info (logs the action)
POST   /matches/{id}/confirm    Confirm transfer completed
POST   /matches/{id}/cancel     Cancel match
```

#### Messages
```
GET    /messages/{match_id}     Get conversation for a match
POST   /messages/{match_id}     Send message
PUT    /messages/{match_id}/read Mark all as read
```

#### Alerts (Seeker Alerts)
```
GET    /alerts                  Get my seeker alerts
POST   /alerts                  Create new seeker alert
PUT    /alerts/{id}             Update alert
DELETE /alerts/{id}             Delete alert
```

#### Reviews
```
POST   /reviews                 Submit review for a completed match
GET    /reviews/user/{id}       Get reviews for a user
```

#### Categories
```
GET    /categories              Get all categories (cached)
```

#### Admin (Protected — admin role)
```
GET    /admin/dashboard         Platform stats
GET    /admin/reports           Pending reports
PUT    /admin/reports/{id}      Resolve a report
PUT    /admin/users/{id}/ban    Ban a user
PUT    /admin/listings/{id}/flag Flag a listing
GET    /admin/listings          All listings with filters
```

#### WebSocket
```
WS     /ws/notifications/{user_id}    Real-time notification channel
WS     /ws/chat/{match_id}            Real-time chat channel
WS     /ws/listings/live              Live listing feed (new listings stream)
```

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 238,
    "pages": 12
  },
  "message": "Listings retrieved successfully"
}

// Error Response:
{
  "success": false,
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "The requested listing does not exist or has expired",
    "details": null
  }
}
```

---

## 4. 🔄 Application Flow Diagrams

### Flow 1: Transferor Posts a Ticket
```
User opens app
    │
    ▼
[Is Logged In?] ──No──► [OTP Login Flow] ──► [Login Success]
    │ Yes                                           │
    │◄──────────────────────────────────────────────┘
    ▼
Click "Post Ticket"
    │
    ▼
Step 1: Select Category (Train/Bus/IPL/Concert/Event)
    │
    ▼
Step 2: Enter Ticket Details
  - For Train: PNR last 4, From, To, Date, Time, Class, Coach, Seat
  - For Events: Event name, Venue, Date, Section, Row, Seat
    │
    ▼
Step 3: Upload Photo (Required)
  → Image compressed client-side → Uploaded to S3
  → URL stored in ticket_listings.ticket_photos[]
    │
    ▼
Step 4: Set Asking Price
  - Original price input
  - Asking price (default 50%)
    │
    ▼
Step 5: Preview & Submit
    │
    ▼
Backend: POST /listings
  → Create ticket_listing record (status: 'active')
  → Calculate expires_at from event_date + departure_time
  → Index in MeiliSearch
  → Update PostgreSQL search_vector
  → Trigger: MATCH_CHECK_JOB (Celery task)
    │
    ▼
Celery Match Check Job:
  → Query seeker_alerts WHERE criteria matches new listing
  → For each matching alert:
      → Create notification record
      → Send SMS to seeker (MSG91)
      → Send push notification (FCM)
      → Emit WebSocket event to seeker (if online)
    │
    ▼
Success Screen:
  → Show listing card preview
  → Share link option
  → "You'll be notified when someone is interested"
```

### Flow 2: Seeker Finds a Ticket
```
User opens app (any page)
    │
    ▼
[Landing Page] → Search bar or Category Pill
    │
    ▼
Enter Search: [Origin] [Destination] [Date] → Click Search
    │
    ▼
GET /listings?origin=Delhi&destination=Mumbai&date=2025-06-03
    │
    ▼
[Results Page] — Shows matching ticket cards
    │
    ▼
User clicks a Ticket Card
    │
    ▼
[Ticket Detail Page / Modal]
  → View full details
  → See seller info (name, rating, verified status)
  → View ticket photo
    │
    ▼
Click "I'm Interested" button
    │
    ▼
[Is Logged In?] ──No──► [OTP Login Flow]
    │ Yes
    ▼
POST /listings/{id}/interest
  → Create matches record (status: 'pending')
  → Notify transferor:
      → Push notification + SMS: "Someone is interested in your ticket!"
      → WebSocket event to transferor (if online)
    │
    ▼
Seeker sees: "Interest registered! Waiting for seller to respond."
    │
    ▼
[Transferor's Turn → See Flow 3]
    │
    ▼
[Transferor Accepts] → Seeker notified
    │
    ▼
PUT /matches/{id}/accept (by transferor)
  → match.status = 'accepted'
  → Notify seeker: "Seller accepted! You can now connect."
    │
    ▼
Seeker sees chat and contact reveal option:
  → [💬 Open Chat] — in-app messaging
  → [📞 Reveal Phone] — shows seller's phone
    │
    ▼
Both parties connect → Transfer happens offline/directly
    │
    ▼
Either party clicks "Mark as Transferred"
  → match.status = 'transferred'
  → listing.status = 'transferred'
  → Both get "Leave a Review" prompt
```

### Flow 3: Matching Engine (Celery Background Job)
```
TRIGGER: New listing created
         OR
         New seeker_alert created
    │
    ▼
Celery Task: run_match_check(listing_id OR alert_id)
    │
    ▼
If triggered by new listing:
  → Find all seeker_alerts where:
      - category matches (or alert.category is NULL = any)
      - origin matches (fuzzy) OR origin is NULL
      - destination matches (fuzzy) OR destination is NULL
      - date_from <= listing.event_date <= date_to
      - max_price >= listing.asking_price (or NULL = any)
      - alert.is_active = TRUE
      - alert.user_id != listing.user_id (can't match with self)
    │
If triggered by new seeker_alert:
  → Find all active listings where:
      - Same criteria as above, reversed
    │
    ▼
For each match found:
  → Create notification
  → Send SMS (MSG91 API)
  → Send email (SendGrid)
  → Send push (FCM)
  → Emit WebSocket event
    │
    ▼
Celery Beat Job (runs every 30 minutes):
  → Find listings where expires_at < NOW() AND status = 'active'
  → Update status to 'expired'
  → Sync MeiliSearch index
  → Send expiry notification to listing owner

Celery Beat Job (runs every hour):
  → Find listings expiring in 2 hours
  → Send "Your listing expires soon" notification to owner
```

### Flow 4: OTP Authentication
```
User enters phone number (+91XXXXXXXXXX)
    │
    ▼
POST /auth/send-otp { phone: "+919876543210" }
    │
    ▼
Backend:
  → Rate limit check (max 3 OTPs per phone per 15min)
  → Generate 6-digit OTP
  → Hash OTP with bcrypt
  → Store in otp_sessions table (expires in 10 min)
  → Send SMS via MSG91 API
    │
    ▼
User receives SMS: "Your LastMinutePass OTP is 482951. Valid for 10 minutes."
    │
    ▼
User enters OTP in UI (6 individual digit boxes, auto-advance)
    │
    ▼
POST /auth/verify-otp { phone: "...", otp: "482951" }
    │
    ▼
Backend:
  → Find matching otp_session (not used, not expired, phone matches)
  → bcrypt.verify(input_otp, stored_hash)
  → Mark otp_session as used
  → [User exists?]
      ── Yes ──► Update last_active_at → Return JWT token
      ── No  ──► Create new user record → Return JWT token + "new_user": true
    │
    ▼
Frontend:
  → Store JWT in httpOnly cookie (not localStorage - security!)
  → If new_user: redirect to profile completion
  → Else: redirect to dashboard or intended page
```

### Flow 5: Real-Time Notifications (WebSocket)
```
User logs in → Frontend connects:
WS: /ws/notifications/{user_id}?token={jwt}
    │
    ▼
Server:
  → Validate JWT
  → Add user to Redis PubSub channel: "user:{user_id}:notifications"
  → Send any unread notifications from DB
    │
    ▼
When any event occurs (match found, message, etc.):
  Celery Worker → Redis PubSub PUBLISH "user:{user_id}:notifications" {event}
                       │
                       ▼
              WebSocket Server subscribes
                       │
                       ▼
              Server pushes to client
                       │
                       ▼
              Frontend handles event:
                - Show toast notification
                - Update notification bell count
                - Update relevant UI sections
```

---

## 5. 📦 Microservices Breakdown (Future Phase)

```
Phase 1 (MVP - Monolith):
  └── Single FastAPI app handles everything

Phase 2 (Modular Monolith):
  ├── Auth Service       (auth/ module)
  ├── Listings Service   (listings/ module)
  ├── Matching Service   (matching/ module)
  ├── Messaging Service  (chat/ module)
  └── Notification Service (notifications/ module)

Phase 3 (Microservices - when scaling):
  ├── API Gateway (Kong or custom FastAPI gateway)
  ├── Auth Microservice (Port 8001)
  ├── Listings Microservice (Port 8002)
  ├── Matching Microservice (Port 8003) — CPU intensive
  ├── Chat Microservice (Port 8004) — WebSocket heavy
  ├── Notification Microservice (Port 8005)
  └── Admin Microservice (Port 8006)
```

---

## 6. 🔐 Security Architecture

### Authentication & Authorization
```
- JWT tokens: 15min access + 7day refresh
- Tokens stored in httpOnly Secure SameSite=Strict cookies
- CSRF protection on all state-changing endpoints
- Role-based access: user | verified_user | admin | super_admin
```

### Rate Limiting (Redis-backed)
```
Endpoint                   Limit
────────────────────────── ──────────────────
POST /auth/send-otp        3 per 15min per IP + 3 per phone
POST /listings             10 per hour per user
GET  /listings             100 per min per IP (generous for browsing)
GET  /search               60 per min per IP
POST /matches/{id}/reveal  5 per hour per user (contact reveals)
POST /messages/{match_id}  30 per min per match
```

### Data Privacy
```
- PNR numbers: Store only last 4 digits (for display)
- Phone numbers: Not shown until contact reveal (logged)
- Ticket photos: Watermarked with listing ID
- User data: GDPR-compliant deletion on request
- Passwords: None (OTP-only auth)
```

### Input Validation
```
- All inputs validated via Pydantic v2 (strict mode)
- SQL injection: Prevented by SQLAlchemy ORM (parameterized queries)
- XSS: Content Security Policy headers + input sanitization
- File uploads: Type check (JPEG/PNG/WEBP), max 5MB, malware scan
- CORS: Whitelist only production frontend domain
```

---

## 7. 🏗️ Folder Structure (Complete)

### Backend (FastAPI)
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app entry, middleware, CORS, routes
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                # Dependency injection (get_db, get_current_user)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # Include all v1 routers
│   │       ├── auth.py            # /auth endpoints
│   │       ├── users.py           # /users endpoints
│   │       ├── listings.py        # /listings endpoints
│   │       ├── search.py          # /search endpoints
│   │       ├── matches.py         # /matches endpoints
│   │       ├── messages.py        # /messages endpoints
│   │       ├── alerts.py          # /alerts endpoints
│   │       ├── reviews.py         # /reviews endpoints
│   │       ├── categories.py      # /categories endpoints
│   │       ├── notifications.py   # /notifications endpoints
│   │       ├── admin.py           # /admin endpoints
│   │       └── websocket.py       # WebSocket routes
│   │
│   ├── core/
│   │   ├── config.py              # Settings via pydantic-settings
│   │   ├── database.py            # SQLAlchemy async engine, session factory
│   │   ├── security.py            # JWT, OTP generation/validation
│   │   ├── middleware.py          # Rate limiting, request logging, CORS
│   │   └── exceptions.py          # Custom exception handlers
│   │
│   ├── models/                    # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── base.py                # Base model with common fields
│   │   ├── user.py
│   │   ├── otp_session.py
│   │   ├── category.py
│   │   ├── ticket_listing.py
│   │   ├── seeker_alert.py
│   │   ├── match.py
│   │   ├── message.py
│   │   ├── review.py
│   │   ├── report.py
│   │   └── notification.py
│   │
│   ├── schemas/                   # Pydantic schemas (request/response)
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── listing.py
│   │   ├── match.py
│   │   ├── message.py
│   │   ├── review.py
│   │   ├── alert.py
│   │   └── common.py              # Pagination, Response wrappers
│   │
│   ├── services/                  # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py        # OTP logic, JWT creation
│   │   ├── listing_service.py     # CRUD + business rules for listings
│   │   ├── matching_service.py    # Core matching algorithm
│   │   ├── notification_service.py # Dispatch notifications (SMS/email/push/WS)
│   │   ├── search_service.py      # MeiliSearch integration
│   │   ├── storage_service.py     # S3/R2 file operations
│   │   ├── sms_service.py         # MSG91 SMS gateway
│   │   ├── email_service.py       # SendGrid email
│   │   └── push_service.py        # Firebase FCM push
│   │
│   ├── workers/                   # Celery tasks
│   │   ├── __init__.py
│   │   ├── celery_app.py          # Celery configuration
│   │   ├── match_worker.py        # Run matching on new listings/alerts
│   │   ├── notification_worker.py # Send queued notifications
│   │   ├── expiry_worker.py       # Expire old listings (Beat schedule)
│   │   └── cleanup_worker.py      # Delete expired OTPs, old sessions
│   │
│   └── utils/
│       ├── __init__.py
│       ├── pagination.py
│       ├── image_processing.py    # Pillow-based resizing, watermark
│       ├── validators.py          # Custom validators (PNR format, phone)
│       └── helpers.py
│
├── alembic/                       # Database migrations
│   ├── versions/
│   │   └── 001_initial_schema.py
│   ├── env.py
│   └── alembic.ini
│
├── tests/
│   ├── conftest.py                # pytest fixtures
│   ├── test_auth.py
│   ├── test_listings.py
│   ├── test_matching.py
│   └── test_search.py
│
├── .env.example
├── .env
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── requirements.txt
```

### Frontend (Next.js 14)
```
frontend/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout with Providers
│   │   ├── page.tsx               # Landing page
│   │   ├── tickets/
│   │   │   ├── page.tsx           # Browse listings
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Ticket detail
│   │   ├── post/
│   │   │   └── page.tsx           # Post a ticket (multi-step)
│   │   ├── dashboard/
│   │   │   └── page.tsx           # User dashboard
│   │   ├── chat/
│   │   │   └── [matchId]/
│   │   │       └── page.tsx       # Chat interface
│   │   ├── profile/
│   │   │   ├── page.tsx           # My profile
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Public profile
│   │   ├── auth/
│   │   │   └── page.tsx           # Login/Register
│   │   ├── admin/
│   │   │   └── page.tsx           # Admin panel (protected)
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── BottomNav.tsx
│   │   │
│   │   ├── home/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── CategoryPills.tsx
│   │   │   ├── LiveTicker.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── FeaturedListings.tsx
│   │   │   ├── StatsCounter.tsx
│   │   │   └── Testimonials.tsx
│   │   │
│   │   ├── tickets/
│   │   │   ├── TicketCard.tsx
│   │   │   ├── TicketGrid.tsx
│   │   │   ├── TicketDetail.tsx
│   │   │   ├── TicketVisual.tsx   # Styled like real ticket
│   │   │   ├── FilterSidebar.tsx
│   │   │   ├── FilterDrawer.tsx   # Mobile filters
│   │   │   ├── SortDropdown.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   ├── post/
│   │   │   ├── PostForm.tsx       # Multi-step container
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── CategoryStep.tsx
│   │   │   ├── DetailsStep.tsx
│   │   │   ├── PhotoStep.tsx
│   │   │   ├── PricingStep.tsx
│   │   │   └── PreviewStep.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsBar.tsx
│   │   │   ├── ListingsTabs.tsx
│   │   │   ├── MyListingCard.tsx
│   │   │   ├── MatchAlerts.tsx
│   │   │   └── AlertList.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── PhoneInput.tsx
│   │   │   ├── OtpInput.tsx
│   │   │   └── ProfileSetup.tsx
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ContactReveal.tsx
│   │   │
│   │   └── ui/                    # Base UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx
│   │       ├── Modal.tsx
│   │       ├── Drawer.tsx
│   │       ├── Toast.tsx
│   │       ├── Skeleton.tsx
│   │       ├── Avatar.tsx
│   │       ├── StarRating.tsx
│   │       ├── Countdown.tsx
│   │       ├── PriceSlider.tsx
│   │       ├── DatePicker.tsx
│   │       ├── ImageUpload.tsx
│   │       └── Spinner.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── useNotifications.ts
│   │   ├── useListings.ts
│   │   ├── useSearch.ts
│   │   ├── useChat.ts
│   │   └── useInfiniteScroll.ts
│   │
│   ├── lib/
│   │   ├── api.ts                 # Axios client with interceptors
│   │   ├── queryClient.ts         # React Query configuration
│   │   ├── socket.ts              # Socket.IO client setup
│   │   └── utils.ts               # Helper functions
│   │
│   ├── store/                     # Zustand stores
│   │   ├── authStore.ts
│   │   ├── notificationStore.ts
│   │   └── searchStore.ts
│   │
│   └── types/
│       ├── listing.ts
│       ├── user.ts
│       ├── match.ts
│       └── api.ts
│
├── public/
│   ├── manifest.json
│   ├── sw.js                      # Service Worker
│   └── icons/
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. 🐳 Docker Compose (Development)

```yaml
version: '3.9'

services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend:/app"]
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/lastminutepass
      - REDIS_URL=redis://redis:6379/0
      - MEILISEARCH_URL=http://meilisearch:7700
    depends_on: [db, redis, meilisearch]
    command: uvicorn app.main:app --reload --host 0.0.0.0

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/v1
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000
    command: npm run dev

  celery_worker:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info
    depends_on: [db, redis]

  celery_beat:
    build: ./backend
    command: celery -A app.workers.celery_app beat --loglevel=info
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: lastminutepass
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: ["postgres_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  meilisearch:
    image: getmeili/meilisearch:v1.7
    ports: ["7700:7700"]
    environment:
      MEILI_MASTER_KEY: "masterkey_dev_only"
    volumes: ["meili_data:/meili_data"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]
    depends_on: [backend, frontend]

volumes:
  postgres_data:
  meili_data:
```

---

## 9. 🌐 Environment Variables

```env
# === App ===
APP_NAME=LastMinutePass
APP_ENV=development          # development | staging | production
DEBUG=true
SECRET_KEY=your-super-secret-jwt-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
FRONTEND_URL=http://localhost:3000

# === Database ===
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/lastminutepass
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# === Redis ===
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_DB=1
REDIS_RATE_LIMIT_DB=2

# === MeiliSearch ===
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=masterkey_dev_only

# === SMS (MSG91) ===
MSG91_API_KEY=your_msg91_api_key
MSG91_TEMPLATE_ID=your_template_id
MSG91_SENDER_ID=LMPASS

# === Email (SendGrid) ===
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@lastminutepass.in
EMAIL_FROM_NAME=LastMinutePass

# === Push (Firebase) ===
FIREBASE_PROJECT_ID=lastminutepass
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json

# === Storage (AWS S3 / Cloudflare R2) ===
S3_BUCKET_NAME=lastminutepass-uploads
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT_URL=                    # Leave empty for AWS, set for R2

# === Rate Limiting ===
RATE_LIMIT_OTP_PER_15MIN=3
RATE_LIMIT_LISTINGS_PER_HOUR=10

# === Features ===
ENABLE_AADHAAR_VERIFY=false
ENABLE_ADMIN_PANEL=true
MAX_PHOTOS_PER_LISTING=5
MAX_LISTING_PRICE=5000
```
