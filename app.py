import hashlib
import json
import os
import threading
import time

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
from flask_caching import Cache
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import SQLAlchemyError

from database import create_app
from models import Favourite, Fixture, db
from scraper import TrumbaScraper

# --- Initialization ---

# Load environment variables from .env for local development
load_dotenv()

app = create_app()

# Vite manifest for cache-busted assets
def load_vite_manifest():
    manifest_path = os.path.join(app.static_folder, 'dist', '.vite', 'manifest.json')
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            return json.load(f)
    return {}

@app.context_processor
def inject_vite_assets():
    return {"vite_manifest": load_vite_manifest()}

# Cache configuration (Redis for production, SimpleCache for dev)
cache_config = {
    "CACHE_TYPE": "RedisCache" if os.getenv("REDIS_URL") else "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 60,
}
if os.getenv("REDIS_URL"):
    cache_config["CACHE_REDIS_URL"] = os.getenv("REDIS_URL")  # type: ignore[assignment]

cache = Cache(app, config=cache_config)

# Response compression — prefer Brotli, fall back to gzip.
# Brotli yields ~15-20% smaller payloads than gzip for JSON/HTML/JS/CSS.
app.config["COMPRESS_ALGORITHM"] = ["br", "gzip"]
app.config["COMPRESS_BR_LEVEL"] = 6  # balance speed vs ratio
app.config["COMPRESS_MIN_SIZE"] = 500  # skip tiny responses
Compress(app)

# Rate limiting setup (Redis for production, memory for dev)
limiter_storage = os.getenv("REDIS_URL") or "memory://"
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per minute"],
    storage_uri=limiter_storage
)

# Configuration variables read from environment or local context
TRUMBA_XML_URL = os.getenv('TRUMBA_XML_URL')


# --- Serve React SPA ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React SPA for all non-API routes."""
    # Let API routes handle themselves
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404

    # Serve static assets directly (Vite emits content-hashed filenames).
    # Hashed assets are immutable: cache for a year and answer 304s via conditional.
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
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# --- Defensive headers on every response (security + SEO) ---
@app.after_request
def add_security_headers(resp):
    """SECURITY/SEO: attach defensive headers to all responses."""
    # Stop MIME sniffing (defeats polyglot/upload attacks).
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    # Disallow framing by other origins (clickjacking protection).
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    # Limit referrer leakage to same-origin/trusted.
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # Legacy XSS auditor hint (harmless on modern browsers).
    resp.headers.setdefault("X-XSS-Protection", "1; mode=block")
    # Declare content language for better a11y/SEO.
    resp.headers.setdefault("Content-Language", "en-AU")
    # Ensure negotiated (gzip/brotli) and ETag responses aren't wrongly shared.
    resp.headers["Vary"] = "Accept-Encoding, If-None-Match"
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

@app.route('/api/fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format.

    PERF: content-based ETag + HTTP 304.
    The frontend (api.ts) sends If-None-Match on every poll. When the fixture
    set is unchanged we reply 304 with an empty body instead of re-sending the
    full JSON payload. This finally delivers the "stale-while-revalidate"
    behaviour the README promises but the old @cache.cached decorator never did.
    """
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    data = [f.to_dict() for f in fixtures]

    # Stable, order-independent fingerprint of the payload.
    payload = json.dumps(data, separators=(",", ":"), sort_keys=True)
    etag = hashlib.sha1(payload.encode("utf-8")).hexdigest()

    # 304: client already has this exact version -> save bandwidth.
    if request.headers.get("If-None-Match") == etag:
        return Response(
            status=304,
            headers={"ETag": etag, "Cache-Control": "public, max-age=30"},
        )

    resp = jsonify(data)
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "public, max-age=30"
    return resp


@app.route('/api/favourites/<device_id>', methods=['GET'])
def get_favourites(device_id):
    """Fetch all favourites for a device."""
    favourites = Favourite.query.filter_by(device_id=device_id).all()
    return jsonify([f.to_dict() for f in favourites])


@app.route('/api/favourites', methods=['POST'])
def add_favourite():
    """Add a fixture to favourites for a device."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request"}), 400

        device_id = data.get('device_id')
        fixture_id = data.get('fixture_id')

        if not device_id or not fixture_id:
            return jsonify({"error": "device_id and fixture_id are required"}), 400

        # Check if already favourited
        favourite = Favourite.query.filter_by(device_id=device_id, fixture_id=fixture_id).first()

        if favourite:
            # Already favourited, return existing
            return jsonify(favourite.to_dict()), 200

        # Add to favourites
        new_favourite = Favourite(device_id=device_id, fixture_id=fixture_id)
        db.session.add(new_favourite)
        db.session.commit()
        # Return full favourite object with fixture data
        return jsonify(new_favourite.to_dict()), 201

    except (SQLAlchemyError, ValueError, KeyError) as e:
        db.session.rollback()
        err_msg = str(e).lower()
        if 'unique constraint failed' in err_msg or 'duplicate key value' in err_msg or 'integrity error' in err_msg:
            return jsonify({"status": "already_exists"}), 200
        return jsonify({"error": str(e)}), 500


@app.route('/api/favourites/<device_id>/<int:fixture_id>', methods=['DELETE'])
def delete_favourite(device_id, fixture_id):
    """Remove a fixture from favourites for a device."""
    try:
        favourite = Favourite.query.filter_by(device_id=device_id, fixture_id=fixture_id).first()
        if not favourite:
            return jsonify({"error": "Favourite not found"}), 404

        db.session.delete(favourite)
        db.session.commit()

        return jsonify({"status": "success"}), 200
    except (SQLAlchemyError, ValueError) as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Module-level guard so a burst of refresh clicks can't hammer the upstream feed.
_LAST_REFRESH = 0.0

@app.route('/api/fixtures/refresh', methods=['POST'])
def refresh_fixtures():
    """Trigger a fixture refresh.

    SECURITY/PERF: a debounce guard prevents clients from abusing this endpoint
    to DDoS the external Trumba XML feed. If a scrape happened within
    REFRESH_COOLDOWN seconds we skip the (expensive) network call and just tell
    the client the data is current — the scheduled worker still refreshes on time.
    """
    global _LAST_REFRESH
    REFRESH_COOLDOWN = 60  # seconds
    if time.monotonic() - _LAST_REFRESH < REFRESH_COOLDOWN:
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
    """Health check endpoint for monitoring."""
    return jsonify({"status": "healthy"}), 200


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
            print("[System] No fixtures found, fetching from XML...")
            try:
                count = run_scheduled_scrape()
                print(f"[System] Scraped {count} fixtures from XML")
            except Exception as e:
                print(f"[System] Initial scrape failed: {e}")

    # Start the background scraper thread ONLY when running locally
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('FLASK_DEBUG'):
        from scraper_worker import is_scheduled_time, run_scheduled_scrape
        if is_scheduled_time():
            scraper_thread = threading.Thread(target=lambda: run_scheduled_scrape() or None, daemon=True)
            scraper_thread.start()
            print("[System] Background scraper thread started (respects schedule).")
        else:
            print("[System] Outside scheduled hours - scraper not started.")

    # Run the web application using a dedicated port for local testing
    app.run(debug=True, port=5001)