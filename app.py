import json
import os
import threading

import requests
from dotenv import load_dotenv
from flask import jsonify, render_template, send_from_directory
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

vite_manifest = load_vite_manifest()

@app.context_processor
def inject_vite_assets():
    return {"vite_manifest": vite_manifest}

# Cache configuration (Redis for production, SimpleCache for dev)
cache_config = {
    "CACHE_TYPE": "RedisCache" if os.getenv("REDIS_URL") else "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 60,
}
if os.getenv("REDIS_URL"):
    cache_config["CACHE_REDIS_URL"] = os.getenv("REDIS_URL")

cache = Cache(app, config=cache_config)

# Response compression
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
    
    # Serve static files directly
    static_file_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_file_path) and os.path.isfile(static_file_path):
        return send_from_directory(app.static_folder, path)
    
    # Serve React index.html for all other routes (SPA routing)
    return render_template('spa.html')


# --- API Routes ---

@app.route('/api/fixtures')
@cache.cached(timeout=30, key_prefix='api_fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format with caching."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    return jsonify([f.to_dict() for f in fixtures])


@app.route('/api/favourites', methods=['GET'])
def get_favourites():
    """Fetch all favourites."""
    favourites = Favourite.query.all()
    return jsonify([f.to_dict() for f in favourites])


@app.route('/api/favourites/<int:fixture_id>', methods=['POST'])
def toggle_favourite(fixture_id):
    """Add or remove a fixture from favourites."""
    try:
        favourite = Favourite.query.filter_by(fixture_id=fixture_id).first()
        
        if favourite:
            # Remove from favourites
            db.session.delete(favourite)
            db.session.commit()
            return jsonify({"status": "removed", "fixture_id": fixture_id}), 200
        else:
            # Add to favourites
            new_favourite = Favourite(fixture_id=fixture_id)
            db.session.add(new_favourite)
            db.session.commit()
            return jsonify({"status": "added", "fixture_id": fixture_id, "id": new_favourite.id}), 201
            
    except (SQLAlchemyError, ValueError, KeyError) as e:
        db.session.rollback()
        err_msg = str(e).lower()
        if 'unique constraint failed' in err_msg or 'duplicate key value' in err_msg or 'integrity error' in err_msg:
            return jsonify({"status": "already_exists"}), 200
        return jsonify({"error": str(e)}), 500


@app.route('/api/favourites/<int:favourite_id>', methods=['DELETE'])
def delete_favourite(favourite_id):
    """Remove a fixture from favourites by favourite ID."""
    try:
        favourite = Favourite.query.get(favourite_id)
        if not favourite:
            return jsonify({"error": "Favourite not found"}), 404

        db.session.delete(favourite)
        db.session.commit()
        
        return jsonify({"status": "success"}), 200
    except (SQLAlchemyError, ValueError) as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/fixtures/refresh', methods=['POST'])
def refresh_fixtures():
    """Trigger a fixture refresh."""
    try:
        scraper = TrumbaScraper()
        count = scraper.scrape_and_store()
        return jsonify({"message": f"Refreshed {count} fixtures"}), 200
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

def invalidate_fixture_cache():
    """Call this after scraping to clear cached data."""
    cache.delete('api_fixtures')


# --- Local Execution Entry Point ---
if __name__ == "__main__":
    print("\n===============================================================")
    print("!!! WARNING !!! Running this file directly is only for local development.")
    print("For production, use Gunicorn with gunicorn.conf.py")
    print("Run scraper separately via: python scraper_worker.py")
    print("===============================================================\n")

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