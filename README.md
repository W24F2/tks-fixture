# Sports Fixtures

A modern, high-performance sports fixture tracking application with automated data ingestion from Trumba XML feeds, a polished React frontend, and a production-ready Flask backend.

**Live Demo:** [https://fixture.kings.dpdns.org/](https://fixture.kings.dpdns.org/)

![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

📖 **Full documentation:** [Docs / Wiki](docs/wiki.md)

## Architecture

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

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Flask 3 | Lightweight WSGI framework |
| Server | Gunicorn | Production WSGI server (gthread workers) |
| ORM | Flask-SQLAlchemy | Database abstraction with connection pooling |
| Caching | Flask-Caching | Redis (prod) / SimpleCache (dev) |
| Rate Limiting | Flask-Limiter | Redis-backed rate limiting |
| Compression | Flask-Compress | Gzip/Brotli response compression |
| Database | SQLAlchemy | SQLite (dev), MySQL/Oracle (prod) |

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
| Service Mgmt | systemd | App + scraper services + timer |
| Reverse Proxy | Nginx | Static file serving + API proxy |

## Features

### Data & Display
- **Automated Data Ingestion** - Scheduled scraper pulls fixtures from Trumba XML (Tue-Sat, 04:45–16:15 Sydney time)
- **Real-time Fixture Display** - Grouped by date, sortable, filterable (All/Upcoming/Live/Past/Favourites)
- **Live Status Badges** - Upcoming / Live / Completed / Cancelled with accurate Sydney time calculation
- **Past Matches Tab** - Collapsible section showing historical matches

### User Experience
- **Favourites System** - Stored in localStorage, instant sync across tabs, works offline
- **Sydney Timezone Support** - All times and statuses calculated in Australia/Sydney (AEDT/AEST)
- **New Events Indicator** - Toast notification + "NEW" badges when fresh fixtures arrive
- **Search** - Deferred search across team, location, sport, and title

### Performance
- **Smart Caching** - ETag-based stale-while-revalidate (30s) with auto-invalidation
- **Smooth Animations** - Shared motion tokens, staggered entrance, morphing icons (GPU-composited)
- **First-Visit Legal Gate** - Versioned disclaimer + Terms of Service, stored in localStorage

### Reliability
- **Auto-migration** - Schema changes applied on startup (e.g., new columns)
- **Self-healing Scraper** - Catch-up scrape on empty/stale DB, respects schedule windows
- **Rate Limiting** - Debounce guard on refresh endpoint, client-side rate limiting
- **Responsive Design** - Mobile-first with native UI on all screen sizes

### Quality
- **SEO & Accessibility** - Semantic HTML, skip-to-content link, ARIA attributes, visible focus rings
- **Security Headers** - X-Content-Type-Options, X-Frame-Options, Referrer-Policy, XSS protection
- **Compression** - Brotli (preferred) / gzip response compression

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Git

### Local Development

```bash
# Clone and enter
git clone https://github.com/W24F2/tks-fixture.git
cd tks-fixture

# One-command setup (installs deps, builds frontend)
make install && make build

# Start development server (Flask on :5001)
# On first run, automatically fetches fixtures from Trumba XML if DB is empty
make dev
```

Or run separately:
```bash
# Terminal 1: Frontend dev server with API proxy
make dev-frontend

# Terminal 2: Flask backend (auto-fetches XML on first run)
python app.py
```

**Note:** On first local run (`python app.py`), if the database is empty, the app automatically fetches real fixtures from the Trumba XML feed. No manual scraping needed.

For environment configuration, see the [Environment Configuration](#environment-configuration) section below.

## Production Deployment

### Server Requirements
- Ubuntu 22.04+ / Debian 12+
- Python 3.12+, Node.js 20+
- 1GB+ RAM, 2+ vCPUs
- Nginx (reverse proxy) + SSL (Let's Encrypt)

### Deploy with systemd

```bash
# On server: clone to /opt/fixtures/app
sudo mkdir -p /opt/fixtures/app
sudo chown $USER:$USER /opt/fixtures/app
git clone https://github.com/W24F2/tks-fixture.git /opt/fixtures/app
cd /opt/fixtures/app

# Create virtual environment and install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Build frontend
cd frontend && npm ci && npm run build && cd ..

# Configure environment
cp .env.example .env
# Edit .env with production values

# Install systemd services + nginx config
sudo cp fixtures.service fixtures-scraper.service fixtures-scraper.timer nginx.conf /etc/systemd/system/
sudo ln -sf /etc/systemd/system/nginx.conf /etc/nginx/sites-available/fixtures
sudo ln -sf /etc/nginx/sites-available/fixtures /etc/nginx/sites-enabled/fixtures
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload
sudo systemctl enable --now fixtures-app fixtures-scraper.timer
```

### Nginx Reverse Proxy (deployed config)

```nginx
server {
    listen 80;
    server_name _;

    # Static files served directly by nginx
    location /static/ {
        alias /opt/fixtures/app/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA and API routes proxied to gunicorn
    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Health check endpoint (no auth)
    location /api/health {
        proxy_pass http://127.0.0.1:5002;
        access_log off;
    }
}
```

### GitHub Actions CI/CD

Add these repository secrets:
- `OCI_HOST` - Server IP/hostname
- `OCI_USER` - SSH username (e.g., `ubuntu`)
- `OCI_SSH_KEY` - Private key for SSH access
- `SECRET_KEY` - Flask secret key
- `CRON_SECRET` - Secret for scheduled scraper

On push to any branch, the workflow:
1. Runs linters (Ruff, Oxlint) and type checkers (TypeScript)
2. Runs tests (pytest)
3. Builds frontend (Vite production build)
4. **Non-main branches**: Deploys to dev server, reloads systemd services
5. **Main branch**: Deploys to production server

## Project Structure

```
tks-fixture/
├── app.py                    # Flask application factory + routes
├── database.py               # DB configuration + auto-migration
├── models.py                 # SQLAlchemy models (Fixture, Favourite)
├── scraper.py                # Trumba XML parsing logic
├── scraper_worker.py         # Scheduled scraper with self-healing
├── gunicorn.conf.py          # Production server config
├── requirements.txt          # Python dependencies
├── requirements-locust.txt   # Load testing dependencies
├── Makefile                  # Build automation
├── nginx.conf                # Nginx reverse proxy config
├── .env.example              # Environment variable template
├── locustfile.py             # Locust load testing script
│
├── fixtures.service          # systemd service (app)
├── fixtures-scraper.service  # systemd service (scraper)
├── fixtures-scraper.timer    # systemd timer (scraper scheduler)
│
├── frontend/                 # React + Vite + TypeScript SPA
│   ├── index.html            # SPA entry HTML
│   ├── package.json          # Node dependencies
│   ├── vite.config.ts        # Vite build config → ../static/dist
│   ├── tailwind.config.js    # Tailwind theme config
│   ├── tsconfig.json         # TypeScript config
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── App.tsx           # Root component (state, routing, layout)
│   │   ├── components/
│   │   │   ├── ui/           # Base UI primitives
│   │   │   │   ├── Button.tsx    # 6 variants, 4 sizes
│   │   │   │   ├── Card.tsx      # Card + CardHeader/Footer/Content
│   │   │   │   ├── Badge.tsx     # Status badges
│   │   │   │   ├── Input.tsx     # Styled text input
│   │   │   │   ├── Skeleton.tsx  # Loading placeholders
│   │   │   │   ├── Separator.tsx # Visual dividers
│   │   │   │   └── Tooltip.tsx   # Hover tooltips
│   │   │   ├── Header.tsx        # Navigation, search, filter tabs
│   │   │   ├── FixtureCard.tsx   # Individual fixture display
│   │   │   ├── FixtureList.tsx   # Grouped fixture list
│   │   │   ├── LoadingScreen.tsx # Skeleton loading UI
│   │   │   └── LegalNotice.tsx   # Terms/disclaimer modal
│   │   ├── lib/
│   │   │   ├── api.ts        # API client, ETag caching, grouping
│   │   │   ├── favourites.ts # localStorage favourites (add/remove/toggle)
│   │   │   ├── consent.ts    # Legal consent (versioned acceptance)
│   │   │   ├── device.ts     # Device ID (UUID v4, localStorage)
│   │   │   ├── timezone.ts   # Sydney timezone helpers (optimized)
│   │   │   ├── motion.ts     # Shared animation tokens
│   │   │   └── utils.ts      # cn() class merge utility
│   │   └── types/
│   │       └── fixture.ts    # Fixture, FixtureGroup, ApiResponse
│   └── public/               # Static assets (manifest.json, icons)
│
├── static/
│   └── dist/                 # Built frontend assets (gitignored)
│
├── templates/                # Jinja2 templates
│   ├── spa.html              # React SPA shell (Vite manifest injection)
│   ├── base.html             # Legacy template (unused)
│   ├── 404.html              # Custom 404 page
│   └── rate_limit.html       # Custom 429 page
│
├── instance/                 # SQLite database (gitignored)
│   └── app.db
│
├── tests/                    # Pytest test suite
│   ├── conftest.py           # Fixtures
│   ├── test_app.py           # Route tests
│   ├── test_models.py        # Model tests
│   ├── test_scraper.py       # Scraper parsing tests
│   └── test_scraper_worker.py  # Worker schedule tests
│
├── .github/workflows/        # CI/CD pipelines
│   ├── ci-cd.yml             # Lint, type-check, build, test
│   └── deploy.yml            # Multi-branch deploy
│
├── docs/                     # Documentation
│   └── wiki.md               # Full project wiki
│
├── LICENSE                   # Apache 2.0
└── README.md                 # This file
```

## Frontend Architecture

```
App (state manager)
├── Header
│   ├── Logo + Title
│   ├── Search Bar (deferred)
│   ├── Refresh Button (animated spin)
│   └── Filter Tabs (All/Upcoming/Live/Favourites/Past)
├── Main Content
│   ├── LoadingScreen (initial load)
│   ├── Error Banner (with retry)
│   ├── FixtureList
│   │   └── FixtureCard (×N, staggered entrance)
│   └── Past Matches (collapsible section)
├── New Events Toast (bottom-right, dismissible)
├── Footer (stats + terms link)
└── LegalNotice Modal (overlay, focus-trapped)
```

## Data Flow

```
User Opens App
    │
    ▼
┌──────────────────┐
│ Check consent    │── No ──▶ Show LegalNotice ──▶ User accepts ──▶ Store in localStorage
└────────┬─────────┘   Yes (or already accepted)
         │
         ▼
┌──────────────────┐
│ Fetch fixtures   │── GET /api/fixtures ──▶ Flask ──▶ SQLite/MySQL/Oracle
└────────┬─────────┘         │
         │                   ▼ (response with ETag + Cache-Control)
         │            ┌──────────────┐
         │            │ Browser Cache │── 304 Not Modified ──▶ Use cached data
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
│  + Tailwind CSS) │── New event badges, collapsible past matches
└──────────────────┘
```

## API Documentation

### Health Check

```
GET /api/health
```

**Response `200 OK`:**
```json
{ "status": "healthy" }
```

### Get Fixtures

```
GET /api/fixtures
```

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "external_id": "trumba-entry-12345",
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

**Caching:** Content-based ETag (`SHA-1` of payload). Send `If-None-Match: <etag>` for `304 Not Modified` (no body) — saves bandwidth on repeated polls.

**Sort order:** `event_date ASC, event_time ASC`

### Refresh Fixtures

```
POST /api/fixtures/refresh
```

**Response `200 OK`:**
```json
{
  "message": "Refreshed fixtures (new: 3, updated: 1)",
  "new": 3,
  "updated": 1
}
```

**Cooldown:** 60-second debounce guard. Subsequent calls within the window return `{"message": "Data is up to date"}` without hitting the upstream feed.

### Favourites (Legacy)

> **Note:** The frontend uses localStorage for favourites. These endpoints exist but are not actively used by the UI.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/favourites/<device_id>` | Fetch device favourites |
| POST | `/api/favourites` | Add a favourite |
| DELETE | `/api/favourites/<device_id>/<fixture_id>` | Remove a favourite |

## Error Responses

| Status | Response | Description |
|--------|----------|-------------|
| 400 | `{ "error": "Invalid request" }` | Bad request body |
| 404 | `{ "error": "Not found" }` | Resource not found |
| 429 | `{ "error": "Rate limit exceeded" }` | Too many requests |
| 500 | `{ "error": "<message>" }` | Server error |

## Database Models

### Fixture

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | PK, auto-increment | Primary key |
| `external_id` | String(100) | Unique, NOT NULL | Trumba calendar entry ID |
| `title` | String(255) | NOT NULL | Event title |
| `location` | String(255) | Nullable | Venue/field name |
| `event_date` | DateTime | NOT NULL, indexed | Event date (Sydney time) |
| `event_time` | Time | Nullable | Start time |
| `event_end_time` | Time | Nullable | End time (if available) |
| `sport` | String(100) | Nullable | Sport category |
| `opposition` | String(255) | Nullable | Opposing team |
| `team` | String(100) | Nullable | Our team |
| `raw_content` | Text | Nullable | Original HTML from Trumba |
| `last_updated` | DateTime | Default: now, onupdate | Last scrape timestamp |

### Favourite

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | PK, auto-increment | Primary key |
| `device_id` | String(36) | NOT NULL | Client-generated UUID |
| `fixture_id` | Integer | FK → fixtures.id, NOT NULL | Referenced fixture |
| `created_at` | DateTime | Default: now | Creation timestamp |

**Unique constraint:** `(device_id, fixture_id)` — prevents duplicate favourites per device.

## Scraper System

### TrumbaScraper (`scraper.py`)

Parses Trumba XML (Atom format) feeds:

1. **Fetch** XML from `TRUMBA_XML_URL` (30s timeout)
2. **Parse** Atom entries via XPath (`//atom:entry`)
3. **For each entry:**
   - Extract `external_id`, `title`, HTML `content`
   - **Parse date/time** from HTML content using regex (handles flexible Trumba formats)
   - **Extract metadata** (sport, opposition, team, location) via label-based patterns
   - **Upsert** into database (insert new or update by `external_id`)

### Scheduled Worker (`scraper_worker.py`)

Runs via systemd timer or standalone.

**Schedule:** Tuesday–Saturday, 04:45–16:15 Sydney time, every 15 minutes.

**Self-healing:**
```
Process starts
    │
    ├── Is DB empty OR data stale (>24h)?
    │       │ Yes
    │       └──▶ Immediate catch-up scrape
    │
    └── Is within scheduled window?
            │ Yes ──▶ Scrape
            │ No  ──▶ Exit (data is fresh)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty fixtures after `python app.py` | Check `TRUMBA_XML_URL` is correct; verify network access to Trumba |
| Scraper not running in dev | Ensure time is within Tue–Sat 04:45–16:15 Sydney window |
| Stale data after refresh | Clear browser cache + reload; ETag cache lives in `api.ts` memory |
| Auto-migration fails | Check DB credentials; manual migration may be needed for complex changes |
| Frontend not hot-reloading | Ensure `npm run dev` is running; check Vite dev server on port 5173 |
| Rate limit errors (429) | Wait 60 seconds after manual refresh calls |
| Favourites not persisting | Private mode blocks localStorage; try incognito-off |
| Timezone display wrong | App uses Sydney wall-clock for status; local time is for display only |

## Environment Configuration

Create `.env` from example:

```bash
cp .env.example .env
```

### Required Variables

```env
# Database (choose one)
DATABASE_URL=sqlite:///instance/app.db          # Development
# DATABASE_URL=mysql+pymysql://user:pass@host:3306/dbname  # MySQL
# DATABASE_URL=oracle+oracledb://user:pass@host:1521/?service_name=XE  # Oracle

# Trumba XML feed (required)
TRUMBA_XML_URL=https://www.trumba.com/calendars/senior-fixtures.xml

# Flask secret key (required, change in production)
SECRET_KEY=your-super-secret-key-change-in-production
```

### Optional Variables

```env
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

## Scripts

```bash
make install        # Install all dependencies (Python + Node)
make build          # Build frontend for production
make dev            # Full dev environment (builds frontend + Flask on :5001)
make dev-frontend   # Vite dev server only (port 5173, proxies /api to :5001)
make clean          # Remove build artifacts and node_modules
```

## Testing

```bash
# Run pytest
pytest

# Frontend linting
cd frontend && npm run lint

# Frontend type checking
cd frontend && npm run typecheck

# Load testing (requires extra deps)
pip install -r requirements-locust.txt
locust -f locustfile.py
```

## License

Apache License 2.0 - see [LICENSE](LICENSE)

## Disclaimer

Fixture data is sourced from Trumba feeds and may not always be accurate. Cross-reference with official sources (e.g., Kingsnet) for definitive schedules.

The full Disclaimer and Terms of Service are presented to first-time visitors in an in-app dialog (`frontend/src/components/LegalNotice.tsx`, acceptance persisted by `frontend/src/lib/consent.ts`). The app is an unofficial, independent service and is not affiliated with any club, league, or venue.

## See Also

- **[Full Wiki](docs/wiki.md)** — Complete technical documentation
- **[Architecture Diagram](#architecture)** — System design overview
- **[Data Flow](#data-flow)** — End-to-end request lifecycle