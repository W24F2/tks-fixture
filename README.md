# Sports Fixtures Dashboard

A modern, high-performance sports fixture tracking application with automated data ingestion, a polished React frontend, and production-ready Flask backend.

![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

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
- **Flask 3** - Lightweight WSGI framework
- **Gunicorn** - Production WSGI server (gthread workers)
- **Flask-SQLAlchemy** - ORM with connection pooling
- **Flask-Caching** - Redis (prod) / SimpleCache (dev)
- **Flask-Limiter** - Rate limiting (Redis-backed)
- **Flask-Compress** - Gzip/Brotli response compression
- **APScheduler** - Background scraping scheduler
- **SQLAlchemy** - Database abstraction (supports SQLite, MySQL, Oracle)

### Frontend
- **React 19** + **TypeScript** - Type-safe component architecture
- **Vite 6** - Lightning-fast build tool with HMR
- **Tailwind CSS v4** - Utility-first styling with CSS variables
- **Framer Motion** - Production-grade animations
- **Lucide React** - Clean, consistent icon system
- **date-fns** - Lightweight date formatting

### DevOps
- **GitHub Actions** - CI/CD pipeline (lint, type-check, build, deploy)
- **systemd** - Service management (app + scraper)
- **Make** - Build automation

## Features

- **Automated Data Ingestion** - Scheduled scraper pulls fixtures from Trumba XML
- **Real-time Fixture Display** - Grouped by date, sortable, filterable
- **Favourites System** - Persisted server-side, instant UI feedback
- **Live Status Badges** - Upcoming / Live / Completed / Cancelled
- **Smooth Animations** - Staggered lists, morphing heart icons, page transitions
- **Responsive Design** - Mobile-first, works on all screen sizes
- **PWA Ready** - Manifest, icons, offline-capable service worker
- **Performance Optimized** - Code-split, minified, compressed, cache-busted assets

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
make dev
```

Or run separately:
```bash
# Terminal 1: Frontend dev server with API proxy
make dev-frontend

# Terminal 2: Flask backend
python app.py
```

### Environment Variables

Create `.env` from example:
```bash
cp .env.example .env
```

Required variables:
```env
# Database (SQLite for dev, MySQL/Oracle for prod)
DATABASE_URL=sqlite:///instance/app.db

# Trumba XML feed URL (required for scraping)
TRUMBA_XML_URL=https://your-trumba-feed.xml

# Flask secret for sessions
SECRET_KEY=your-secure-random-string

# Optional: Redis for caching/rate-limiting
REDIS_URL=redis://localhost:6379/0
```

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

# Install systemd services
sudo cp fixtures.service fixtures-scraper.service fixtures-scraper.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fixtures-app fixtures-scraper.timer
```

### Nginx Reverse Proxy (example)

```nginx
server {
    listen 80;
    server_name fixtures.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /opt/fixtures/app/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### GitHub Actions CI/CD

Add these repository secrets:
- `SSH_HOST` - Server IP/hostname
- `SSH_USER` - SSH username (e.g., `ubuntu`)
- `SSH_PRIVATE_KEY` - Private key for SSH access
- `SSH_PORT` - SSH port (default 22)

On push to `dev` or `main`, the workflow:
1. Runs linters (Ruff, Oxlint) and type checkers (MyPy)
2. Builds frontend (Vite production build)
3. Deploys via SSH, reloads systemd services
4. Verifies health endpoint

## Project Structure

```
tks-fixture/
├── app.py                 # Flask application factory + routes
├── database.py            # DB configuration + connection pooling
├── models.py              # SQLAlchemy models (Fixture, Favourite)
├── scraper.py             # Trumba XML parsing logic
├── scraper_worker.py      # APScheduler background job
├── gunicorn.conf.py       # Production server config
├── requirements.txt       # Python dependencies
├── Makefile               # Build automation
├── .github/workflows/     # CI/CD pipeline
├── frontend/              # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/        # Base UI primitives (Button, Card, Badge...)
│   │   │   ├── FixtureCard.tsx
│   │   │   ├── FixtureList.tsx
│   │   │   └── Header.tsx
│   │   ├── lib/api.ts     # API client + utilities
│   │   ├── types/         # TypeScript interfaces
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── public/            # Static assets (FS.svg, manifest.json)
│   ├── vite.config.ts     # Vite config (outputs to ../static/dist)
│   └── tailwind.config.js # Tailwind theme config
├── static/
│   └── dist/              # Built frontend assets (gitignored)
├── templates/
│   ├── spa.html           # React SPA entry template
│   └── base.html          # Legacy template (unused)
└── instance/              # SQLite database (gitignored)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/fixtures` | All fixtures (cached 30s) |
| GET | `/api/favourites` | All favourites |
| POST | `/api/favourites/<fixture_id>` | Toggle favourite |
| DELETE | `/api/favourites/<id>` | Remove favourite |
| POST | `/api/fixtures/refresh` | Trigger manual scrape |

## Scripts

```bash
make install        # Install all dependencies
make build          # Build frontend for production
make dev            # Full dev environment
make dev-frontend   # Vite dev server only
make clean          # Remove build artifacts
```

## License

Apache License 2.0 - see [LICENSE](LICENSE)

## Disclaimer

Fixture data is sourced from Trumba feeds and may not always be accurate. Cross-reference with official sources (e.g., Kingsnet) for definitive schedules.