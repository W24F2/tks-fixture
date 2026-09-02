import os
import threading
import time
from flask import Flask, jsonify, render_template, request
from database import create_app
from models import db, Fixture, Favourite
from scraper import TrumbaScraper
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv


# --- Initialization ---

# Load environment variables from .env for local development
load_dotenv()

app = create_app()

# Rate limiting setup (Keep this for API protection)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per minute"],
    storage_uri="memory://" # IMPORTANT: Use 'redis://...' in production!
)

# Configuration variables read from environment or local context
TRUMBA_XML_URL = os.getenv('TRUMBA_XML_URL')


def run_background_scraper(app_instance):
    """Background task to scrape data periodically."""
    print("--- WARNING: Background Scraper Worker Started ---")
    # NOTE: In a real deployment (e.g., on Oracle VM), this function must be run 
    # as a SEPARATE SERVICE/WORKER, not within the web server process, 
    # to prevent worker restarts from stopping the scraper.
    with app_instance.app_context():
        while True:
            try:
                print("\n[Background Task] Starting scheduled refresh...")
                scraper = TrumbaScraper(TRUMBA_XML_URL)
                new_count, updated_count = scraper.scrape()
                print(f"[Background Task] Success. New: {new_count}, Updated: {updated_count}\n")
            except Exception as e:
                print(f"\n[Background Task] Error: {e}\n")
            # Sleep for 15 minutes (900 seconds)
            time.sleep(900)

# --- Routes ---

@app.route('/')
def index():
    """Main dashboard view."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()

    # Get the most recent update time from any fixture
    last_updated = None
    if fixtures:
        last_updated = max(f.last_updated for f in fixtures)

    # Group fixtures by date
    grouped_fixtures = []
    from itertools import groupby
    for date, group in groupby(sorted(fixtures, key=lambda x: x.event_date)):
        grouped_fixtures.append((date, list(group)))

    return render_template('index.html', grouped_fixtures=grouped_fixtures, last_updated=last_updated)


@app.route('/api/fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    return jsonify([f.to_dict() for f in fixtures])

@app.route('/api/favourites/<device_id>', methods=['GET'])
def get_favourites(device_id):
    """Fetch all favourited teams for a device."""
    favourites = Favourite.query.filter_by(device_id=device_id).all()
    return jsonify([f.to_dict() for f in favourites])

@app.route('/api/favourites', methods=['POST'])
def add_favourite():
    """Add a new fixture to favourites."""
    data = request.get_json()
    if not data or 'device_id' not in data or 'fixture_id' not in data:
        return jsonify({"error": "Missing device_id or fixture_id"}), 400

    device_id = data['device_id']
    fixture_id = data['fixture_id']

    try:
        new_favourite = Favourite(device_id=device_id, fixture_id=fixture_id)
        db.session.add(new_favourite)
        db.session.commit()
        return jsonify({"status": "success"}), 201
    except Exception as e:
        db.session.rollback()
        # Catch unique constraint errors from multiple database types (Oracle, MySQL, PgSQL)
        err_msg = str(e).lower()
        if 'unique constraint failed' in err_msg or 'duplicate key value' in err_msg or 'integrity error' in err_msg:
            return jsonify({"status": "already_exists"}), 200
        return jsonify({"error": str(e)}), 500

@app.route('/api/favourites/<device_id>/<int:fixture_id>', methods=['DELETE'])
def delete_favourite(device_id, fixture_id):
    """Remove a fixture from favourites."""
    try:
        favourite = Favourite.query.filter_by(device_id=device_id, fixture_id=fixture_id).first()
        if not favourite:
            return jsonify({"error": "Favourite not found"}), 404

        db.session.delete(favourite)
        db.session.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({"status": "healthy"}), 200


# --- Custom Error Handlers ---

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(429)
def ratelimit_handler(e):
    return render_template('rate_limit.html'), 429


# --- Local Execution Entry Point ---
if __name__ == "__main__":
    print("\n===============================================================")
    print("!!! WARNING !!! Running this file directly is only for local development.")
    print("For production, use Gunicorn/Waitress for the web API and a separate worker script (e.g., scraper_worker.py) for background tasks.")
    print("===============================================================\n")

    # Start the background scraper thread ONLY when running locally
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('FLASK_DEBUG'):
        scraper_thread = threading.Thread(target=run_background_scraper, args=(app,), daemon=True)
        scraper_thread.start()
        print("[System] Background scraper thread started (15m interval).")

    # Run the web application using a dedicated port for local testing
    app.run(debug=True, port=5001)