# 📦 LastMinutePass — Complete Dependencies & Libraries Reference
### requirements.txt + package.json + DevOps Dependencies

---

## 🐍 Python Backend (requirements.txt)

```txt
# ============================================================
# LASTMINUTEPASS — Python Backend Dependencies
# Python Version: 3.11+
# Generated for: FastAPI + PostgreSQL + Redis + Celery stack
# ============================================================

# ─── Core Web Framework ───────────────────────────────────
fastapi==0.111.1              # Modern async Python web framework
uvicorn[standard]==0.29.0     # ASGI server (includes websockets + httptools)
python-multipart==0.0.9       # Required for file uploads in FastAPI

# ─── Database (PostgreSQL) ────────────────────────────────
sqlalchemy[asyncio]==2.0.30   # ORM with async support
asyncpg==0.29.0               # Async PostgreSQL driver (required for async SA)
psycopg2-binary==2.9.9        # Sync driver (for Alembic migrations)
alembic==1.13.1               # Database migration tool

# ─── Data Validation & Settings ───────────────────────────
pydantic==2.7.4               # Data validation (used by FastAPI)
pydantic[email]==2.7.4        # Email validation support
pydantic-settings==2.3.3      # Settings management from .env files
python-dotenv==1.0.1          # Load .env variables

# ─── Authentication & Security ────────────────────────────
python-jose[cryptography]==3.3.0  # JWT creation and validation
passlib[bcrypt]==1.7.4            # Password/OTP hashing (bcrypt)
cryptography==42.0.8              # Cryptographic operations (required by jose)
itsdangerous==2.2.0               # Secure token signing

# ─── Caching & Message Queue (Redis) ─────────────────────
redis[hiredis]==5.0.7         # Redis client with C extension (hiredis = faster)
aioredis==2.0.1               # Async Redis client (for FastAPI async contexts)

# ─── Background Task Processing (Celery) ─────────────────
celery[redis]==5.4.0          # Distributed task queue
celery[gevent]==5.4.0         # Gevent concurrency for IO-bound tasks
kombu==5.3.7                  # Messaging library used by Celery
billiard==4.2.0               # Multiprocessing for Celery
flower==2.0.1                 # Real-time Celery monitoring dashboard

# ─── HTTP Client (for external APIs) ─────────────────────
httpx==0.27.2                 # Modern async HTTP client (replaces requests)
aiohttp==3.9.5                # Alternative async HTTP (for some integrations)
requests==2.32.3              # Sync HTTP client (backup, scripts)

# ─── Search (MeiliSearch) ─────────────────────────────────
meilisearch-python==0.31.4    # MeiliSearch Python client
meilisearch-python-sdk==2.10.4 # Alternative SDK with async support

# ─── File Handling & Image Processing ─────────────────────
pillow==10.4.0                # Image processing (resize, watermark, compress)
python-magic==0.4.27          # File type detection by magic bytes (security)
aiofiles==23.2.1              # Async file I/O
python-multipart==0.0.9       # Multipart form data handling

# ─── Cloud Storage (AWS S3 / Cloudflare R2) ───────────────
boto3==1.34.144               # AWS SDK (works with R2 via S3-compatible API)
botocore==1.34.144            # Core AWS SDK (dependency of boto3)

# ─── SMS Gateway (MSG91) ─────────────────────────────────
# Note: MSG91 uses HTTP REST API via httpx/requests
# No official Python package; we call their API directly
# Alternatively:
twilio==9.2.3                 # Twilio SMS (backup option, more reliable)

# ─── Email (SendGrid) ─────────────────────────────────────
sendgrid==6.11.0              # SendGrid Python SDK for transactional email

# ─── Push Notifications (Firebase) ────────────────────────
firebase-admin==6.5.0         # Firebase Admin SDK (for FCM push notifications)

# ─── WebSockets ───────────────────────────────────────────
websockets==12.0              # WebSocket protocol implementation
python-socketio==5.11.3       # Socket.IO server (if using Socket.IO protocol)

# ─── Rate Limiting ────────────────────────────────────────
slowapi==0.1.9                # Rate limiting for FastAPI (uses limits library)
limits==3.12.0                # Storage backends for rate limiting

# ─── CORS & Middleware ────────────────────────────────────
# CORS: Built into FastAPI (starlette.middleware.cors)
# Additional middleware:
starlette==0.37.2             # ASGI framework (FastAPI is built on this)
asgiref==3.8.1                # ASGI utilities

# ─── Logging & Monitoring ─────────────────────────────────
sentry-sdk[fastapi]==2.6.0    # Error tracking (Sentry)
loguru==0.7.2                 # Beautiful structured logging
structlog==24.2.0             # Structured logging (JSON format)
python-json-logger==2.0.7     # JSON log formatter for Python logging

# ─── Date & Time ─────────────────────────────────────────
python-dateutil==2.9.0        # Advanced date parsing
pytz==2024.1                  # Timezone handling
arrow==1.3.0                  # Better datetime library (human-friendly)

# ─── Utilities ────────────────────────────────────────────
shortuuid==1.0.13             # Short unique ID generation (for share links)
phonenumbers==8.13.40         # Phone number parsing & validation (Indian numbers)
email-validator==2.2.0        # Email validation
ujson==5.10.0                 # Ultra-fast JSON (performance boost)
orjson==3.10.7                # Alternative fast JSON serializer
python-slugify==8.0.4         # URL-safe slug generation
bleach==6.1.0                 # HTML sanitization (user input)
Markdown==3.6                 # Markdown to HTML conversion (for content)

# ─── Testing ─────────────────────────────────────────────
pytest==8.2.2                 # Test runner
pytest-asyncio==0.23.7        # Async test support
pytest-cov==5.0.0             # Code coverage
httpx==0.27.2                 # HTTP client for testing FastAPI
factory-boy==3.3.0            # Test data factories
faker==25.9.2                 # Fake data generation for tests
anyio==4.4.0                  # Async testing utilities

# ─── Code Quality ────────────────────────────────────────
ruff==0.5.0                   # Fast Python linter + formatter (replaces flake8)
mypy==1.10.1                  # Static type checking
black==24.4.2                 # Code formatter (backup to ruff)

# ─── Environment & Config ────────────────────────────────
python-decouple==3.8          # 12-factor config management
dynaconf==3.2.6               # Advanced config with environments

# ─── Security Auditing ────────────────────────────────────
pip-audit==2.7.3              # Check dependencies for known vulnerabilities
bandit==1.7.9                 # Security linting for Python code
safety==3.2.4                 # Checks for insecure packages

# ─── Database Tooling ────────────────────────────────────
pgcli==4.1.0                  # PostgreSQL CLI with autocomplete (dev tool)
```

---

## 📦 Frontend Package.json (Node.js / Next.js)

```json
{
  "name": "lastminutepass-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "analyze": "ANALYZE=true next build"
  },
  "dependencies": {
    "__CORE__": "── Core Framework ──────────────────────────────",
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "typescript": "5.5.4",

    "__STYLING__": "── Styling ──────────────────────────────────",
    "tailwindcss": "3.4.6",
    "@tailwindcss/typography": "0.5.13",
    "@tailwindcss/forms": "0.5.7",
    "clsx": "2.1.1",
    "tailwind-merge": "2.4.0",
    "class-variance-authority": "0.7.0",

    "__STATE__": "── State Management ─────────────────────────",
    "zustand": "4.5.4",
    "@tanstack/react-query": "5.51.21",
    "@tanstack/react-query-devtools": "5.51.21",
    "immer": "10.1.1",

    "__HTTP__": "── HTTP & API ────────────────────────────────",
    "axios": "1.7.3",
    "ky": "1.5.0",

    "__REALTIME__": "── Real-time / WebSocket ────────────────",
    "socket.io-client": "4.7.5",

    "__FORMS__": "── Forms & Validation ───────────────────────",
    "react-hook-form": "7.52.2",
    "zod": "3.23.8",
    "@hookform/resolvers": "3.9.0",

    "__ANIMATION__": "── Animations ────────────────────────────",
    "framer-motion": "11.3.8",
    "auto-animate": "0.8.2",
    "canvas-confetti": "1.9.3",
    "@formkit/auto-animate": "0.8.2",
    "react-spring": "9.7.4",

    "__UI_PRIMITIVES__": "── UI Primitives ────────────────────",
    "@radix-ui/react-dialog": "1.1.1",
    "@radix-ui/react-dropdown-menu": "2.1.1",
    "@radix-ui/react-popover": "1.1.1",
    "@radix-ui/react-select": "2.1.1",
    "@radix-ui/react-slider": "1.2.0",
    "@radix-ui/react-switch": "1.1.0",
    "@radix-ui/react-tabs": "1.1.0",
    "@radix-ui/react-toast": "1.2.1",
    "@radix-ui/react-tooltip": "1.1.2",
    "@radix-ui/react-avatar": "1.1.0",
    "@radix-ui/react-checkbox": "1.1.1",
    "@radix-ui/react-label": "2.1.0",
    "@radix-ui/react-separator": "1.1.0",
    "@radix-ui/react-scroll-area": "1.1.0",

    "__ICONS__": "── Icons ─────────────────────────────────────",
    "lucide-react": "0.408.0",
    "react-icons": "5.3.0",

    "__DATES__": "── Date/Time ─────────────────────────────────",
    "date-fns": "3.6.0",
    "react-day-picker": "9.1.3",

    "__UPLOADS__": "── File Uploads ──────────────────────────",
    "react-dropzone": "14.2.10",
    "browser-image-compression": "2.0.2",
    "react-image-crop": "11.0.5",

    "__MAPS__": "── Maps (optional) ──────────────────────────",
    "leaflet": "1.9.4",
    "react-leaflet": "4.2.1",

    "__NOTIFICATIONS__": "── Notifications ─────────────────",
    "react-hot-toast": "2.4.1",
    "sonner": "1.5.0",

    "__VIRTUALIZATION__": "── Performance ──────────────────",
    "react-window": "1.8.10",
    "react-intersection-observer": "9.13.0",
    "@tanstack/react-virtual": "3.8.4",

    "__UTILS__": "── Utilities ────────────────────────────────",
    "dayjs": "1.11.12",
    "lodash-es": "4.17.21",
    "nanoid": "5.0.7",
    "copy-to-clipboard": "3.3.3",
    "react-share": "5.1.0",
    "use-debounce": "10.0.3",
    "react-use": "17.5.0",

    "__CHARTS__": "── Charts & Data Viz ─────────────────────",
    "recharts": "2.12.7",

    "__SEO__": "── SEO ───────────────────────────────────────",
    "next-seo": "6.6.0",
    "next-sitemap": "4.2.3",

    "__PWA__": "── PWA Support ──────────────────────────────",
    "next-pwa": "5.6.0",

    "__ANALYTICS__": "── Analytics ─────────────────────────",
    "@vercel/analytics": "1.3.1",
    "posthog-js": "1.148.0",

    "__PHONE__": "── Phone Input ───────────────────────────",
    "react-phone-input-2": "2.15.1",
    "libphonenumber-js": "1.11.4",

    "__EDITOR__": "── Rich Text (chat/descriptions) ────────",
    "@tiptap/react": "2.5.0",
    "@tiptap/starter-kit": "2.5.0"
  },
  "devDependencies": {
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5",
    "prettier": "3.3.3",
    "prettier-plugin-tailwindcss": "0.6.5",
    "@types/node": "20.14.12",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@types/leaflet": "1.9.12",
    "@types/canvas-confetti": "1.9.0",
    "@types/lodash-es": "4.17.12",
    "@types/react-window": "1.8.8",
    "jest": "29.7.0",
    "@testing-library/react": "16.0.0",
    "@testing-library/jest-dom": "6.4.6",
    "@testing-library/user-event": "14.5.2",
    "jest-environment-jsdom": "29.7.0",
    "@next/bundle-analyzer": "14.2.5",
    "autoprefixer": "10.4.19",
    "postcss": "8.4.40"
  }
}
```

---

## 🐳 DevOps & Infrastructure

### Docker Images Used
```yaml
# Production Stack
postgres:16-alpine            # PostgreSQL database
redis:7-alpine                # Redis cache + queue
getmeili/meilisearch:v1.7     # Full-text search engine
nginx:alpine                  # Reverse proxy
python:3.11-slim              # Backend base image
node:20-alpine                # Frontend base image

# Monitoring Stack (Optional Phase 2)
grafana/grafana:latest         # Metrics dashboards
prom/prometheus:latest         # Metrics collection
sentry/sentry:latest           # Error tracking (self-hosted)
minio/minio:latest             # S3-compatible local storage (dev)
```

### Nginx Configuration Libraries
```nginx
# nginx.conf dependencies
# - ngx_http_ssl_module (SSL)
# - ngx_http_proxy_module (reverse proxy)
# - ngx_http_gzip_module (compression)
# - ngx_http_limit_req_module (rate limiting)
# - ngx_http_headers_module (security headers)
```

### GitHub Actions (CI/CD)
```yaml
# .github/workflows/ci.yml
actions/checkout@v4
actions/setup-python@v5
actions/setup-node@v4
docker/build-push-action@v6
docker/login-action@v3
```

---

## 📋 Python Version Pinning (pyproject.toml)

```toml
[tool.poetry]
name = "lastminutepass-backend"
version = "1.0.0"
description = "LastMinutePass P2P Ticket Transfer Platform"
authors = ["LastMinutePass Team"]
python = "^3.11"

[tool.poetry.dependencies]
python = "^3.11"

[tool.ruff]
target-version = "py311"
line-length = 88
select = ["E", "W", "F", "I", "N", "UP", "ANN", "S", "B", "A", "C4", "RET"]
ignore = ["ANN101", "ANN102"]

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*", "alembic/*"]
```

---

## 🔧 Development Tools (Global Installs)

```bash
# Python tools (install globally or in venv)
pip install --upgrade pip
pip install uv                 # Ultra-fast pip replacement
pip install pre-commit         # Git pre-commit hooks
pip install detect-secrets     # Detect secrets in code

# Node tools (install globally)
npm install -g pnpm            # Fast npm alternative
npm install -g vercel          # Deployment CLI
npm install -g typescript      # TypeScript compiler

# Database tools
# PostgreSQL client (psql)
# Redis CLI (redis-cli)
# DBeaver or TablePlus (GUI)
```

---

## 📱 Third-Party API Dependencies

### SMS Provider: MSG91
```
Base URL: https://api.msg91.com/api/v5/
Auth: authkey header
Key endpoints:
  POST /otp/send     - Send OTP
  POST /otp/verify   - Verify OTP
  POST /otp/resend   - Resend OTP
Cost: ~₹0.15-0.25 per SMS in India
```

### Alternative SMS: Fast2SMS
```
Base URL: https://www.fast2sms.com/dev/bulkV2
Auth: authorization header
Cost: ~₹0.10 per SMS
Better for: bulk SMS, cheaper rates
```

### Email: SendGrid
```
Base URL: https://api.sendgrid.com/v3/
Auth: Bearer token
Key endpoints:
  POST /mail/send    - Send transactional email
Free tier: 100 emails/day
Paid: $19.95/month for 50,000 emails
```

### Push: Firebase Cloud Messaging (Free)
```
SDK: firebase-admin (Python), firebase (JS)
Cost: Free (unlimited push notifications)
Setup: Firebase project + service account JSON
```

### Storage: Cloudflare R2 (Recommended over S3)
```
Cost: Free egress (unlike S3's expensive egress)
Free tier: 10GB storage, 1M Class A ops/month
SDK: boto3 (S3-compatible endpoint)
Endpoint: https://<account-id>.r2.cloudflarestorage.com
```

### Monitoring: Sentry (Free tier)
```
Free tier: 5,000 errors/month
SDK: sentry-sdk[fastapi] (Python), @sentry/nextjs (JS)
Features: Error tracking, performance monitoring, session replay
```
