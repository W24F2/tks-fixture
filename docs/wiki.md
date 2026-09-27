# Sports Fixtures - Project Wiki

A modern, high-performance sports fixture tracking application with automated data ingestion, a polished React frontend, and production-ready Flask backend.

**Live Demo:** [https://fixture.kings.dpdns.org/](https://fixture.kings.dpdns.org/)

**License:** Apache License 2.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Backend](#4-backend)
5. [Frontend](#5-frontend)
6. [Database Models](#6-database-models)
7. [API Documentation](#7-api-documentation)
8. [Scraper System](#8-scraper-system)
9. [Environment Configuration](#9-environment-configuration)
10. [Deployment](#10-deployment)
11. [Development Guide](#11-development-guide)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Performance Optimizations](#13-performance-optimizations)
14. [Accessibility Features](#14-accessibility-features)

---

## 1. Architecture Overview

The application follows a clean separation between data ingestion, backend API, and frontend presentation layers.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Trumba XML    │────▶│   Scraper       │────▶│   SQLite/       │
│   (External)    │     │   (APScheduler) │     │   MySQL/Oracle  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                     ┌─────────────────┐                 │
                     │   React SPA     │◀────────────────┤
                     │   (Vite + TS)   │   REST API      │
                     └────────┬────────┘                 │
                              │                          │
                     ┌────────▼────────┐                 │
                     │   Flask +       │◀────────────────┘
                     │   Gunicorn      │
                     └─────────────────┘
```

### Key Design Principles

- **Automated Data Ingestion:** Scheduled scraper pulls fixtures from Trumba XML feed (Tue-Sat, 6am-8pm Sydney time)
- **Real-time Fixture Display:** Grouped by date, sortable, filterable (All/Upcoming/Live/Past/Favourites)
- **Offline-capable Favourites:** Stored in localStorage, instant sync across tabs
- **Sydney Timezone:** All times and statuses calculated in Australia/Sydney (AEDT/AEST)
- **Smart Caching:** ETag-based stale-while-revalidate (30s) with auto-invalidation
- **Production-hardened:** Rate limiting, response compression, security headers, health checks

---

## 2. Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Flask 3 | Lightweight WSGI framework |
| Server | Gunicorn | Production WSGI server (gthread workers) |
| ORM | Flask-SQLAlchemy | Database abstraction with connection pooling |
| Caching | Flask-Caching | Redis (prod) / SimpleCache (dev) |
| Rate Limiting | Flask-Limiter | Redis-backed rate limiting |
| Compression | Flask-Compress | Gzip/Brotli response compression |
| Scheduling | APScheduler | Background scraping scheduler |
| Database | SQLAlchemy | Supports SQLite, MySQL, Oracle |

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 19 + TypeScript | Type-safe component architecture |
| Build Tool | Vite 6 | Lightning-fast build with HMR |
| Styling | Tailwind CSS v4 | Utility-first styling with CSS variables |
| Animations | Framer Motion | Production-grade animations |
| Icons | Lucide React | Clean, consistent icon system |
| Utilities | clsx + tailwind-merge | Dynamic class composition |

### DevOps

| Component | Technology | Purpose |
|-----------|------------|---------|
| CI/CD | GitHub Actions | Lint, type-check, build, deploy |
| Service Mgmt | systemd | Application + scraper services |
| Reverse Proxy | Nginx | Static file serving + API proxy |
| Build Automation | Make | Unified build commands |

---

## 3. Project Structure

```
tks-fixture/
├── app.py                    # Flask application factory + routes
├── database.py               # DB configuration + connection pooling
├── models.py                 # SQLAlchemy models (Fixture, Favourite)
├── scraper.py                # Trumba XML parsing logic
├── scraper_worker.py         # APScheduler background job
├── gunicorn.conf.py          # Production server config
├── requirements.txt          # Python dependencies
├── Makefile                  # Build automation
├── nginx.conf                # Nginx reverse proxy config
├── .env.example              # Environment variable template
├── locustfile.py             # Load testing script
├── fixtures.service          # systemd service (app)
├── fixtures-scraper.service  # systemd service (scraper)
├── fixtures-scraper.timer    # systemd timer (scraper scheduler)
│
├── frontend/                 # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Base UI primitives
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   ├── Separator.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── App.tsx       # Main app container
│   │   │   ├── Header.tsx    # Navigation + search + filters
│   │   │   ├── FixtureCard.tsx  # Individual fixture display
│   │   │   ├── FixtureList.tsx  # Grouped fixture list
│   │   │   ├── LoadingScreen.tsx  # Loading state UI
│   │   │   └── LegalNotice.tsx    # Terms & disclaimer modal
│   │   ├── lib/
│   │   │   ├── api.ts        # API client + utilities
│   │   │   ├── favourites.ts # localStorage favourites logic
│   │   │   ├── consent.ts    # Legal consent management
│   │   │   ├── device.ts     # Device ID generation
│   │   │   ├── timezone.ts   # Sydney timezone helpers
│   │   │   ├── motion.ts     # Animation tokens
│   │   │   └── utils.ts      # Utility functions
│   │   ├── types/
│   │   │   └── fixture.ts    # TypeScript interfaces
│   │   ├── main.tsx          # Entry point
│   │   └── App.tsx           # Root component
│   ├── public/               # Static assets
│   ├── vite.config.ts        # Vite build config
│   ├── tailwind.config.js    # Tailwind theme config
│   ├── tsconfig.json         # TypeScript config
│   └── package.json
│
├── static/
│   └── dist/                 # Built frontend assets (gitignored)
│
├── templates/                # Jinja2 templates
│   ├── spa.html              # React SPA entry template
│   └── base.html             # Legacy template (unused)
│
├── instance/                 # SQLite database (gitignored)
│   └── app.db
│
├── tests/                    # Test suite
│
└── docs/
    └── wiki.md               # This document
```

---

## 4. Backend

### 4.1 Application Factory (`database.py`)

The `create_app()` function serves as the application factory:

- **Database Detection Order:**
  1. Oracle (if `ORACLE_USER` and `ORACLE_PASSWORD` and `ORACLE_DSN` set)
  2. MySQL/HeatWave (if `DB_HOST` and `DB_USER` set)
  3. Explicit `DATABASE_URL` override
  4. SQLite fallback (`sports_fixtures.db`)

- **Connection Pooling** (non-SQLite only):
  - `pool_size`: 10
  - `max_overflow`: 20
  - `pool_pre_ping`: True
  - `pool_recycle`: 300s
  - `pool_timeout`: 30s

- **Auto-migration:** On startup, checks for missing columns (e.g., `event_end_time`) and adds them automatically.

### 4.2 Routes (`app.py`)

#### SPA Serving

- `GET /` and `GET /<path:path>` - Serves React SPA with Vite manifest injection
- Static assets served with 1-year immutable cache
- SPA entry point uses `no-cache` for zero-downtime deploys

#### Defensive Headers

Every response includes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `Content-Language: en-AU`
- `Vary: Accept-Encoding, If-None-Match`

#### SEO

- `/robots.txt` - Allows all crawlers, points to sitemap
- `/sitemap.xml` - Single-page SPA sitemap with hourly changefreq

### 4.3 Configuration

```python
# Cache: Redis (prod) or SimpleCache (dev), 60s default timeout
# Compression: Brotli (level 6) > gzip, min 500 bytes
# Rate limiting: 200/day, 50/minute (Redis or memory storage)
```

---

## 5. Frontend

### 5.1 Component Hierarchy

```
App
├── Header
│   ├── Logo + Title
│   ├── Search Bar
│   ├── Refresh Button
│   └── Filter Tabs (All/Upcoming/Live/Favourites/Past)
├── Main Content
│   ├── LoadingScreen (initial load)
│   ├── Error Banner (with retry)
│   ├── FixtureList
│   │   └── FixtureCard (xN)
│   └── Past Matches (collapsible section)
├── New Events Toast (bottom-right)
├── Footer (stats + terms link)
└── LegalNotice Modal (overlay)
```

### 5.2 State Management

| State | Storage | Scope |
|-------|---------|-------|
| Fixtures | React state | Component-level, fetched from API |
| Favourites | localStorage (`sf_favourites`) | Device-level, synced via `storage` event |
| Legal Consent | localStorage (`sf_legal_consent`) | Device-level, versioned |
| Device ID | localStorage (`sf_device_id`) | Device-level, UUID v4 |
| Search Query | React state | Component-level, deferred with `useDeferredValue` |
| Filter Tab | React state | Component-level |

### 5.3 Key Libraries

#### Framer Motion (`framer-motion`)
- Staggered card entrances (`viewport: { once: true }`)
- Page transitions (first-load only)
- Heart icon morphing animations
- Collapsible past matches section
- Spinning refresh button

#### Sydney Timezone (`lib/timezone.ts`)
- **Optimized approach:** Uses `Intl.DateTimeFormat` with `timeZone` to extract wall-clock fields
- Avoids slow parse/format round-trips of the old approach
- Status calculation: `upcoming` / `live` / `completed` based on Sydney wall-clock comparison

#### API Client (`lib/api.ts`)
- In-memory cache with 30s TTL
- ETag-based validation (If-None-Match header)
- HTTP 304 responses for unchanged data
- Request deduplication for repeated polls

### 5.4 UI Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Button` | variant, size, isLoading | 6 variants (default, destructive, outline, secondary, ghost, link), 4 sizes |
| `Card` | className, children | Base card with rounded-xl border, shadow-sm |
| `Badge` | variant | Status badges with color coding |
| `Input` | type, placeholder, value | Styled text input with search variant |
| `Skeleton` | className, children | Loading placeholder with animation |
| `Tooltip` | content, children | Hover tooltip for accessibility |

### 5.5 Animation Tokens (`lib/motion.ts`)

```typescript
// Easings (cubic-bezier curves)
EASE        = [0.16, 1, 0.3, 1]     // expo-out: fast start, gentle settle
EASE_IN_OUT = [0.65, 0, 0.35, 1]    // symmetric: state changes

// Durations (seconds)
fast  = 0.2s   // micro-interactions
base  = 0.35s  // standard entrances
slow  = 0.5s   // footer, large sections

// Stagger
STAGGER = 0.05s  // between sibling items
```

---

## 6. Database Models

### 6.1 Fixture

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Integer | Primary Key | Auto-increment ID |
| `external_id` | String(100) | Unique, Not Null | Trumba calendar entry ID |
| `title` | String(255) | Not Null | Event title |
| `location` | String(255) | Nullable | Venue/field name |
| `event_date` | DateTime | Not Null, Indexed | Event date (Sydney time) |
| `event_time` | Time | Nullable | Start time |
| `event_end_time` | Time | Nullable | End time (if available) |
| `sport` | String(100) | Nullable | Sport category |
| `opposition` | String(255) | Nullable | Opposing team |
| `team` | String(100) | Nullable | Our team |
| `raw_content` | Text | Nullable | Original HTML from Trumba |
| `last_updated` | DateTime | Default: now, onupdate | Last scrape timestamp |

**Status Mapping (to frontend):**
- `Scheduled` → `upcoming`
- `Live` → `live`
- `Finished` → `completed`

### 6.2 Favourite

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Integer | Primary Key | Auto-increment ID |
| `device_id` | String(36) | Not Null | Client-generated UUID |
| `fixture_id` | Integer | Foreign Key → fixtures.id, Not Null | Referenced fixture |
| `created_at` | DateTime | Default: now | Favourite creation timestamp |

**Unique Constraint:** `(device_id, fixture_id)` - prevents duplicate favourites per device

**Note:** Favourites are primarily stored in localStorage (client-side). The database-backed API exists but is not the primary storage mechanism.

---

## 7. API Documentation

### 7.1 Endpoints

#### Health Check
```
GET /api/health
```
**Response:**
```json
{ "status": "healthy" }
```
**Purpose:** Monitoring/heartbeat, no auth required.

#### Get Fixtures
```
GET /api/fixtures
```
**Response (200):**
```json
[
  {
    "id": 1,
    "external_id": "trumba-12345",
    "title": "Senior A: Football vs Sydney FC",
    "location": "Leichhardt Oval",
    "event_date": "2026-09-20T00:00:00",
    "event_time": "07:00:00",
    "event_end_time": "09:00:00",
    "sport": "Football",
    "opposition": "Sydney FC",
    "team": "Kingsgrove SC",
    "last_updated": "2026-09-17T09:00:00Z",
    "status": "upcoming"
  }
]
```
**Caching:**
- `Cache-Control: public, max-age=30`
- `ETag: <sha1-hex-digest>` - content-based, order-independent

**Conditional Request:**
```
If-None-Match: <etag-from-previous-response>
```
**Response (304):** Empty body (use cached data)

**Sort Order:** `event_date ASC, event_time ASC`

#### Refresh Fixtures
```
POST /api/fixtures/refresh
```
**Response (200):**
```json
{
  "message": "Refreshed fixtures (new: 3, updated: 1)",
  "new": 3,
  "updated": 1
}
```
**Cooldown:** 60-second debounce guard prevents rapid successive calls.

**Error Response (500):**
```json
{ "error": "Failed to fetch from Trumba" }
```

#### Favourites (Legacy/Unused)

The frontend primarily uses localStorage for favourites. These endpoints exist but are not actively used by the UI.

```
GET    /api/favourites/<device_id>
POST   /api/favourites
DELETE /api/favourites/<device_id>/<fixture_id>
```

### 7.2 Error Handling

| Status | Response |
|--------|----------|
| 404 | `{ "error": "Not found" }` |
| 429 | `{ "error": "Rate limit exceeded" }` |
| 500 | `{ "error": "<message>" }` |

---

## 8. Scraper System

### 8.1 TrumbaScraper (`scraper.py`)

Parses Trumba XML (Atom format) feeds to extract fixture data.

#### Parsing Pipeline

1. **Fetch XML** from `TRUMBA_XML_URL` (30s timeout)
2. **Parse Atom entries** via XPath (`//atom:entry`)
3. **For each entry:**
   - Extract `external_id`, `title`, `content` (HTML)
   - Parse date/time from HTML content using regex patterns
   - Extract metadata (sport, opposition, team, location) via label-based patterns
   - Upsert into database (insert or update by `external_id`)

#### Date/Time Parsing

The scraper handles flexible Trumba date formats:
- Full format: `Saturday, August 15, 2026, 7:30-8:30am`
- Partial time: `Saturday, August 15, 2026, 7am` (no minutes → padded with `:00`)
- Time ranges: `7:30-8:30am` → extracts both start and end times
- AM/PM suffix propagation: `7–8:30am` → both times get `am`

**Supported formats:**
```
%A, %B %d, %Y %I:%M %p    # Saturday, August 15, 2026 7:00 AM
%B %d, %Y %I:%M %p        # August 15, 2026 7:00 AM
%B %d, %Y %H:%M            # August 15, 2026 19:00 (24-hour)
...
```

#### Metadata Extraction

Uses label-based regex patterns for robust parsing:
```
Sport\s*:\s*(.*?)(?=\s*(?:Opposition|Team|Location|$))
Opposition\s*:\s*(.*?)(?=\s*(?:Sport|Team|Location|$))
Team\s*:\s*(.*?)(?=\s*(?:Sport|Opposition|Location|$))
```

#### Error Handling

- `IntegrityError` → Retry as update (handles concurrent insert race condition)
- Failed date parse → Skip entry with warning log
- Malformed HTML → Fallback to regex-based cleaning

### 8.2 Scheduled Worker (`scraper_worker.py`)

Runs as a systemd timer or standalone process.

#### Schedule

- **Days:** Tuesday (1) through Saturday (5)
- **Hours:** 04:45 AM to 04:15 PM Sydney time
- **Frequency:** Every 15 minutes (via systemd timer)

#### Self-Healing Logic

```
┌──────────────────────────┐
│ Scraper Process Starts   │
└─────────┬────────────────┘
          │
          ▼
┌──────────────────────────────┐
│ Is DB empty OR data stale    │  ← Check: last_updated > 24h?
│ (>24 hours old)?             │
└──────┬───────────────────┬───┘
       │ Yes                │ No
       ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│ Immediate    │   │ Is within        │
│ scrape       │   │ schedule window? │
└──────────────┘   └──────┬───────────┘
                          │ Yes       │ No
                          ▼           ▼
                   ┌──────────┐ ┌──────────┐
                   │ Scrape   │ │ Exit     │
                   └──────────┘ └──────────┘
```

#### Key Functions

| Function | Description |
|----------|-------------|
| `is_scheduled_time()` | Check if current time falls within Tue-Sat 04:45-16:15 Sydney window |
| `needs_catch_up_scrape()` | Check if DB is empty or data is stale (>24h) |
| `run_scheduled_scrape()` | Execute a full scrape cycle |
| `main()` | Entry point: catch-up or scheduled run |

---

## 9. Environment Configuration

### 9.1 Required Variables

```bash
# Database (choose one)
DATABASE_URL=sqlite:///instance/app.db          # Development
# DATABASE_URL=mysql+pymysql://user:pass@host:3306/dbname
# DATABASE_URL=oracle+oracledb://user:pass@host:1521/?service_name=XE

# Trumba XML feed (required)
TRUMBA_XML_URL=https://www.trumba.com/calendars/senior-fixtures.xml

# Flask secret key (required, change in production)
SECRET_KEY=your-super-secret-key-change-in-production
```

### 9.2 Optional Variables

```bash
# Redis for caching/rate limiting (recommended for production)
REDIS_URL=redis://localhost:6379/0

# Oracle (alternative to DATABASE_URL)
ORACLE_USER=...
ORACLE_PASSWORD=...
ORACLE_DSN=...

# MySQL (alternative to DATABASE_URL)
DB_HOST=...
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...

# Gunicorn (production server)
GUNICORN_BIND=127.0.0.1:5002
GUNICORN_WORKERS=5
GUNICORN_THREADS=4
```

### 9.3 Setup

```bash
# Copy example and customize
cp .env.example .env
# Edit .env with your values
```

---

## 10. Deployment

### 10.1 Server Requirements

- **OS:** Ubuntu 22.04+ / Debian 12+
- **Runtime:** Python 3.12+, Node.js 20+
- **Resources:** 1GB+ RAM, 2+ vCPUs
- **Web Server:** Nginx + SSL (Let's Encrypt)

### 10.2 Deployment Steps

```bash
# 1. Clone repository
sudo mkdir -p /opt/fixtures/app
git clone https://github.com/W24F2/tks-fixture.git /opt/fixtures/app
cd /opt/fixtures/app

# 2. Install Python dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Build frontend
cd frontend && npm ci && npm run build && cd ..

# 4. Configure environment
cp .env.example .env
# Edit .env with production values

# 5. Install systemd services
sudo cp fixtures.service fixtures-scraper.service \
       fixtures-scraper.timer nginx.conf /etc/systemd/system/
sudo ln -sf /etc/systemd/system/nginx.conf \
       /etc/nginx/sites-available/fixtures
sudo ln -sf /etc/nginx/sites-available/fixtures \
       /etc/nginx/sites-enabled/fixtures
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Enable and start services
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload
sudo systemctl enable --now fixtures-app fixtures-scraper.timer
```

### 10.3 Nginx Configuration

```nginx
server {
    listen 80;

    # Static files - 1 year immutable cache
    location /static/ {
        alias /opt/fixtures/app/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA and API - proxied to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Health check - no logging
    location /api/health {
        proxy_pass http://127.0.0.1:5002;
        access_log off;
    }
}
```

### 10.4 Gunicorn Configuration

```python
# Workers: (2 * CPU cores) + 1
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gthread"
threads = 4

# Memory: Recycle workers exceeding 200MB
max_worker_memory = 200  # MB
max_requests = 1000
max_requests_jitter = 50

# Timeouts: 30s read/write
timeout = 30
graceful_timeout = 30
```

---

## 11. Development Guide

### 11.1 Quick Start

```bash
# One-command setup
make install && make build

# Start development server (Flask on :5001)
make dev

# Or run separately
make dev-frontend    # Vite on :5173 (with API proxy)
python app.py        # Flask on :5001
```

### 11.2 Available Commands

```bash
make install        # Install Python + Node dependencies
make build          # Build frontend for production
make dev            # Full dev environment (builds frontend + Flask)
make dev-frontend   # Vite dev server only
make clean          # Remove build artifacts and node_modules
```

### 11.3 Local Development Flow

1. **First run:** App auto-fetches fixtures from Trumba XML if DB is empty
2. **Background scraper:** Starts automatically in dev mode (respects schedule)
3. **Frontend hot reload:** Vite HMR updates React components instantly
4. **Auto-fetch on change:** Any DB schema changes trigger auto-migration

### 11.4 Testing

```bash
# Run tests (if pytest configured)
pytest

# Frontend linting
cd frontend && npm run lint

# Frontend type checking
cd frontend && npm run typecheck
```

### 11.5 Load Testing

```bash
# Install load testing dependencies
pip install -r requirements-locust.txt

# Run Locust
locust -f locustfile.py
```

---

## 12. CI/CD Pipeline

### 12.1 GitHub Actions

**Trigger:** Push to any branch

**Steps:**
1. **Linting:** Ruff (Python), Oxlint (TypeScript)
2. **Type Checking:** TypeScript compiler
3. **Testing:** pytest
4. **Build:** Vite production build
5. **Deploy:**
   - **Main branch:** Production server
   - **Other branches:** Dev server

### 12.2 Required Repository Secrets

| Secret | Description |
|--------|-------------|
| `OCI_HOST` | Server IP/hostname |
| `OCI_USER` | SSH username (e.g., `ubuntu`) |
| `OCI_SSH_KEY` | Private key for SSH access |
| `SECRET_KEY` | Flask secret key |
| `CRON_SECRET` | Secret for scheduled scraper endpoint |

---

## 13. Performance Optimizations

### 13.1 Caching Strategy

| Layer | Mechanism | Duration |
|-------|-----------|----------|
| Browser | In-memory cache (`api.ts`) | 30s |
| HTTP | ETag + If-None-Match | Content-based |
| HTTP | Cache-Control: public, max-age=30 | 30s |
| Server | Flask-Caching (Redis/SimpleCache) | 60s |
| Static Assets | Nginx: immutable + 1-year cache | 1 year |

### 13.2 Response Compression

- **Preferred:** Brotli (level 6) - ~15-20% smaller than gzip
- **Fallback:** gzip
- **Minimum size:** 500 bytes (skip tiny responses)
- **Applied to:** JSON, HTML, JS, CSS

### 13.3 Frontend Optimizations

- **Deferred search:** `useDeferredValue` keeps input responsive during filtering
- **Viewport-triggered animations:** Cards animate once on scroll (never replay)
- **GPU-composited animations:** Only opacity/transform (no layout/paint)
- **Code splitting:** Vite automatic chunking
- **Tree shaking:** Unused imports eliminated at build time

### 13.4 Database Optimizations

- **Indexed columns:** `event_date` for fast sorting
- **Connection pooling:** 10 base + 20 overflow (non-SQLite)
- **Nested transactions:** `begin_nested()` for per-row atomicity
- **Race condition handling:** IntegrityError → retry as update

---

## 14. Accessibility Features

### 14.1 Keyboard Navigation

- **Skip to content link:** `focus:not-sr-only` pattern
- **Visible focus rings:** All interactive controls have `focus-visible:ring-2`
- **Focus trapping:** Legal modal traps tab focus within dialog
- **Escape handling:** ESC closes review mode, does nothing in gate mode

### 14.2 ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| Main content | `role` | `main` |
| Search input | `aria-label` | `"Search fixtures"` |
| Favourite button | `aria-label` | Dynamic ("Add/Remove from favourites") |
| Favourite button | `aria-pressed` | `true/false` |
| Error banner | `role` | `"alert"` |
| New events toast | `role` | `"status"`, `aria-live="polite"` |
| Legal modal | `role` | `"dialog"`, `aria-modal="true"` |
| Filter tabs | `role` | `"group"` |
| Filter tabs | `aria-current` | `"true"` on active tab |
| Past matches toggle | `aria-expanded` | Dynamic |
| Past matches toggle | `aria-controls` | `"past-matches"` |

### 14.3 Reduced Motion

- Legal modal: Animates only on open (not on close) to avoid issues with reduced-motion preferences
- All animations use GPU-composited properties (opacity/transform)

### 14.4 Semantic HTML

- `<header>`, `<main>`, `<footer>`, `<article>`, `<section>`
- `<time>` elements with `dateTime` attributes
- Proper heading hierarchy (`h1` → `h3`)
- Descriptive `aria-label` on icon-only buttons

---

## Appendix A: File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `app.py` | Flask app + routes + security headers | ~334 |
| `database.py` | App factory + DB config + auto-migration | 87 |
| `models.py` | Fixture + Favourite ORM models | 110 |
| `scraper.py` | Trumba XML parser | 280 |
| `scraper_worker.py` | Scheduled scraper with self-healing | 143 |
| `gunicorn.conf.py` | Production server config | 75 |
| `Makefile` | Build automation | 21 |
| `frontend/src/App.tsx` | Main React component | 472 |
| `frontend/src/components/Header.tsx` | Navigation + filters | 181 |
| `frontend/src/components/FixtureCard.tsx` | Fixture display card | 169 |
| `frontend/src/components/FixtureList.tsx` | Grouped fixture list | 128 |
| `frontend/src/components/LegalNotice.tsx` | Terms/disclaimer modal | 355 |
| `frontend/src/lib/api.ts` | API client + caching | 156 |
| `frontend/src/lib/timezone.ts` | Sydney timezone helpers | 91 |
| `frontend/src/lib/motion.ts` | Animation tokens | 60 |

## Appendix B: Data Flow

```
User Opens App
    │
    ▼
┌──────────────────┐
│ Check consent    │── No ──▶ Show LegalNotice ──▶ User accepts ──▶ Store in localStorage
└────────┬─────────┘   Yes
         │
         ▼
┌──────────────────┐
│ Fetch fixtures   │── GET /api/fixtures ──▶ Flask ──▶ SQLite/MySQL/Oracle
└────────┬─────────┘         │
         │                   ▼
         │            ┌──────────────┐
         │            │ Parse + Map  │
         │            │ status       │
         │            └──────────────┘
         │
         ▼
┌──────────────────┐
│ Merge with favs  │── Read localStorage favorites
│ & compute status │── Compute "upcoming/live/completed" in Sydney time
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Render UI        │── Grouped by date, favs first
│ (Framer Motion   │── Animated entrances, search filter, tab filter
│  + Tailwind CSS) │
└──────────────────┘
```

## Appendix C: Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Empty fixtures after `python app.py` | Check `TRUMBA_XML_URL` is correct; verify network access to Trumba |
| Scraper not running in dev | Ensure time is within Tue-Sat 04:45-16:15 Sydney window |
| Stale data after refresh | Clear browser cache + reload; check ETag cache in `api.ts` |
| Auto-migration fails | Check DB credentials; manual migration may be needed for complex schema changes |
| Frontend not hot-reloading | Ensure `npm run dev` is running; check Vite dev server port |
| Rate limit errors | Wait 60 seconds after manual refresh calls |
| Favourites not persisting | Check browser storage permissions (private mode blocks localStorage) |
| Timezone display wrong | Verify device timezone; app uses Sydney wall-clock for status, local display |

---

*This wiki was generated from the project source code. Last updated: September 2026.*
