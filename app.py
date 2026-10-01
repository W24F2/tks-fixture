import hashlib
import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from flask import (
    Response,
    jsonify,
    make_response,
    render_template,
    request,
    send_from_directory,
)
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from database import create_app
from models import SYDNEY_TZ, Fixture, db
from scraper import TrumbaScraper

# --- Initialization ---

logger = logging.getLogger(__name__)

# Load environment variables from .env for local development
load_dotenv()

app = create_app()

# Vite manifest for cache-busted assets. Re-reading it from disk on every
# request is wasteful — cache it and invalidate on mtime change (rebuild/deploy).
_vite_manifest_cache: dict = {"mtime": None, "manifest": {}}


def load_vite_manifest():
    manifest_path = os.path.join(app.static_folder, 'dist', '.vite', 'manifest.json')
    try:
        mtime = os.path.getmtime(manifest_path)
    except OSError:
        return {}
    if _vite_manifest_cache["mtime"] != mtime:
        with open(manifest_path) as f:
            manifest = json.load(f)
        _vite_manifest_cache["mtime"] = mtime
        _vite_manifest_cache["manifest"] = manifest
    return _vite_manifest_cache["manifest"]

@app.context_processor
def inject_vite_assets():
    return {"vite_manifest": load_vite_manifest()}

# Response compression — prefer Brotli, fall back to gzip.
# Brotli yields ~15-20% smaller payloads than gzip for JSON/HTML/JS/CSS.
app.config["COMPRESS_ALGORITHM"] = ["br", "gzip"]
app.config["COMPRESS_BR_LEVEL"] = 6  # balance speed vs ratio
app.config["COMPRESS_MIN_SIZE"] = 500  # skip tiny responses
Compress(app)

# Rate limiting setup (Redis for production, memory for dev).
# NOTE: a single page load burns several requests (HTML + JS + CSS + API +
# favicon), and school networks share NAT IPs — the daily allowance must be
# generous enough for that.
limiter_storage = os.getenv("REDIS_URL") or "memory://"
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["2000 per day", "50 per minute"],
    storage_uri=limiter_storage
)

# Configuration variables read from environment or local context
TRUMBA_XML_URL = os.getenv('TRUMBA_XML_URL')


# --- Serve React SPA ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React SPA for all non-API routes.

    SECURITY: return proper 404 for obviously dangerous/inspect paths,
    instead of serving the SPA for everything. Unknown SPA client-side routes
    still fall through to the SPA.
    """
    # Let API routes handle themselves
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404

    # Block hidden/secret paths early — do not leak SPA HTML for them.
    insecure_prefixes = (
        '.git', '.env', '.well-known', '.aws', '.ssh',
        'admin', 'config', 'secrets', 'phpmyadmin', '.htaccess',
    )
    if any(str(path).split('/')[0].lower().startswith(p) for p in insecure_prefixes):
        return jsonify({"error": "Not found"}), 404
    if path.startswith('static/'):
        rel = path[7:]
        full = os.path.join(app.static_folder, rel)
        if os.path.exists(full) and os.path.isfile(full):
            resp = send_from_directory(app.static_folder, rel, conditional=True)
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp

    # Direct path to a real file at the static root (e.g. /manifest.json, /FS.svg)
    if path and not path.endswith('/'):
        full = os.path.join(app.static_folder, path)
        if os.path.exists(full) and os.path.isfile(full):
            resp = send_from_directory(app.static_folder, path, conditional=True)
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp

    # SPA entry — must NOT be cached so new deploys are picked up immediately.
    resp = make_response(render_template('spa.html'))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


# Defensive headers on every response (security + SEO).
# Per OWASP, we remove X-XSS-Protection (deprecated) and add CSP, HSTS,
# Permissions Policy, and a more precise Vary handling.
@app.after_request
def add_security_headers(resp):
    # Stop MIME sniffing (defeats polyglot/upload attacks).
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    # Disallow framing by other origins (clickjacking protection).
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    # Limit referrer leakage to same-origin/trusted.
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # Declare content language for better a11y/SEO.
    resp.headers.setdefault("Content-Language", "en-AU")
    # Permissions-Policy: restrict unnecessary browser features.
    resp.headers.setdefault(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    )
    # HSTS: force HTTPS for 1 year, include subdomains, preload-ready.
    # NOTE: ensure the domain is permanently HTTPS before enabling preload.
    if request.scheme == "https":
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
    
    # TTFB optimization: Disable nginx buffering for API responses to send first byte faster
    if request.path.startswith('/api/'):
        resp.headers.setdefault("X-Accel-Buffering", "no")
        # Add early hints for preloading critical resources
        if request.path == '/api/fixtures':
            # Preload fonts and critical CSS for the SPA
            link_headers = [
                '<https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap>; rel=preload; as=style',
                '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
            ]
            if 'Link' in resp.headers:
                resp.headers['Link'] = resp.headers['Link'] + ', ' + ', '.join(link_headers)
            else:
                resp.headers['Link'] = ', '.join(link_headers)

    # Content-Security-Policy: strict default-src, allow self-origin scripts/styles,
    # Google Fonts, and Vite inline module preload.
    resp.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
    )

    # Ensure negotiated (gzip/brotli) and ETag responses aren't wrongly shared.
    vary = {"Accept-Encoding", "If-None-Match"}
    existing = resp.headers.get("Vary")
    if existing:
        vary.update(v.strip() for v in existing.split(",") if v.strip())
    resp.headers["Vary"] = ", ".join(sorted(vary))
    return resp


# --- SEO: robots.txt + sitemap.xml (helps crawlers index efficiently) ---
@app.route('/robots.txt')
def robots_txt():
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {request.url_root}sitemap.xml\n"
    )
    return Response(body, mimetype="text/plain")


@app.route('/sitemap.xml')
def sitemap_xml():
    # Single-page SPA: only the canonical root URL is indexable.
    loc = request.url_root.rstrip('/') + '/'
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{loc}</loc><changefreq>hourly</changefreq>'
        f'<priority>1.0</priority></url>\n'
        '</urlset>\n'
    )
    return Response(body, mimetype="application/xml")


# --- API Routes ---

# PERF: serializing every fixture (incl. per-row status math) is the most
# expensive work this app does per request — and 304 revalidations used to pay
# it in full too. The serialized payload only changes when the table changes
# (COUNT + MAX(last_updated)) or when a status boundary passes, so we memoize
# (payload, etag) on that key. last_updated has onupdate=utcnow, so any row
# change bumps the key automatically — no manual invalidation needed.
_FIXTURES_CACHE: dict = {"key": None, "payload": "", "etag": ""}


@app.route('/api/fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format.

    PERF: content-based ETag + HTTP 304 + payload memoization.
    The frontend (api.ts) sends If-None-Match on every poll. When the fixture
    set is unchanged we reply 304 with an empty body; when only the minute
    bucket advanced we re-serialize but skip nothing else visible to clients.
    """
    start_time = time.monotonic()
    
    row = db.session.execute(
        select(func.count(Fixture.id), func.max(Fixture.last_updated))
    ).one()
    # Statuses are wall-clock dependent, so the minute bucket is part of the key.
    version_key = (row[0], row[1], int(time.time() // 60))

    if _FIXTURES_CACHE["key"] != version_key:
        # Use yield_per for streaming query results to reduce memory pressure
        fixtures_query = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc())
        fixtures = fixtures_query.yield_per(100).all()
        now = datetime.now(SYDNEY_TZ)
        data = []
        # Process fixtures in chunks to allow earlier response flushing
        chunk_size = 50
        chunk = []
        for i, fixture in enumerate(fixtures, 1):
            chunk.append(fixture.to_dict(now=now))
            if i % chunk_size == 0:
                data.extend(chunk)
                chunk = []
        if chunk:
            data.extend(chunk)

        # Stable, order-independent fingerprint of the payload. The same string
        # doubles as the 200 response body — jsonify would serialize it again.
        payload = json.dumps(data, separators=(",", ":"), sort_keys=True)
        _FIXTURES_CACHE["key"] = version_key
        _FIXTURES_CACHE["payload"] = payload
        _FIXTURES_CACHE["etag"] = hashlib.sha1(payload.encode("utf-8")).hexdigest()

    etag = _FIXTURES_CACHE["etag"]

    # 304: client already has this exact version -> save bandwidth.
    if request.headers.get("If-None-Match") == etag:
        resp = Response(status=304)
        resp.headers["ETag"] = etag
        resp.headers["Cache-Control"] = "public, max-age=30"
        resp.headers["X-Accel-Buffering"] = "no"
        resp.headers["Server-Timing"] = f"total;dur={(time.monotonic() - start_time) * 1000:.2f}"
        return resp

    resp = Response(_FIXTURES_CACHE["payload"], mimetype="application/json")
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=300"
    resp.headers["X-Accel-Buffering"] = "no"
    resp.headers["Server-Timing"] = f"dbcache;dur=0,total;dur={(time.monotonic() - start_time) * 1000:.2f}"
    return resp


# Module-level guard so a burst of refresh clicks can't hammer the upstream feed.
# Fast path only: the authoritative cross-process check is DB-based (below),
# because a module global is per-Gunicorn-worker.
_LAST_REFRESH = 0.0
REFRESH_COOLDOWN = 60  # seconds


def _fixtures_freshly_written():
    """True if any fixture row was written within REFRESH_COOLDOWN seconds.

    Unlike the module-level `_LAST_REFRESH` guard this holds across all
    Gunicorn workers, since every worker sees the same table. It misses the
    rare "scrape ran but changed nothing" case — the module guard covers that
    within a single worker, which bounds the worst case fine.
    """
    latest = db.session.query(func.max(Fixture.last_updated)).scalar()
    if latest is None:
        return False
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - latest < timedelta(seconds=REFRESH_COOLDOWN)


@app.route('/api/fixtures/refresh', methods=['POST'])
def refresh_fixtures():
    """Trigger a fixture refresh.

    SECURITY/PERF: a debounce guard prevents clients from abusing this endpoint
    to DDoS the external Trumba XML feed. If a scrape happened within
    REFRESH_COOLDOWN seconds (any worker) we skip the (expensive) network call
    and just tell the client the data is current — the scheduled worker still
    refreshes on time.
    """
    global _LAST_REFRESH
    if time.monotonic() - _LAST_REFRESH < REFRESH_COOLDOWN or _fixtures_freshly_written():
        return jsonify({"message": "Data is up to date"}), 200

    try:
        scraper = TrumbaScraper()
        # FIX: the real method is `scrape()` (returns (new_count, updated_count));
        # `scrape_and_store()` never existed, so the endpoint 500'd. We surface both
        # counts so the UI can report what changed.
        new_count, updated_count = scraper.scrape()
        _LAST_REFRESH = time.monotonic()
        return jsonify({
            "message": f"Refreshed fixtures (new: {new_count}, updated: {updated_count})",
            "new": new_count,
            "updated": updated_count,
        }), 200
    except (ValueError, RuntimeError, requests.RequestException) as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring — verifies DB connectivity."""
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy"}), 200
    except SQLAlchemyError as e:
        logger.error("Health check DB ping failed: %s", e)
        return jsonify({"status": "unhealthy"}), 503


# --- Custom Error Handlers ---

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Rate limit exceeded"}), 429


# --- Cache Invalidation Helper ---
# NOTE: removed the old `invalidate_fixture_cache()` helper. The /api/fixtures
# response now carries a content-based ETag, so the frontend simply revalidates
# with If-None-Match on every poll — no server-side cache key to invalidate.


# --- Local Execution Entry Point ---
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("\n===============================================================")
    print("!!! WARNING !!! Running this file directly is only for local development.")
    print("For production, use Gunicorn with gunicorn.conf.py")
    print("Run scraper separately via: python scraper_worker.py")
    print("===============================================================\n")

    with app.app_context():
        from models import Fixture
        from scraper_worker import run_scheduled_scrape
        fixture_count = Fixture.query.count()
        if fixture_count == 0:
            logger.info("No fixtures found, fetching from XML...")
            try:
                count = run_scheduled_scrape()
                logger.info("Scraped %s fixtures from XML", count)
            except Exception as e:
                logger.error("Initial scrape failed: %s", e)

    # Start the background scraper thread ONLY when running locally
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('FLASK_DEBUG'):
        from scraper_worker import is_scheduled_time, run_scheduled_scrape
        if is_scheduled_time():
            scraper_thread = threading.Thread(target=lambda: run_scheduled_scrape() or None, daemon=True)
            scraper_thread.start()
            logger.info("Background scraper thread started (respects schedule).")
        else:
            logger.info("Outside scheduled hours - scraper not started.")

    # Run the web application using a dedicated port for local testing
    app.run(debug=True, port=5001)