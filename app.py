import os
import threading
import time
from flask import Flask, jsonify, render_template, request
from database import create_app
from models import db, Fixture
from scraper import TrumbaScraper
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

app = create_app()

# Rate limiting setup
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per minute"],
    storage_uri="memory://"
)

# Configuration
TRUMBA_XML_URL = os.getenv('TRUMBA_XML_URL')
CRON_SECRET = os.getenv("CRON_SECRET")

from itertools import groupby

def run_background_scraper(app_instance):
    """Background task to scrape data every 15 minutes."""
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
    for date, group in groupby(fixtures, key=lambda x: x.event_date.date()):
        grouped_fixtures.append((date, list(group)))

    return render_template('index.html', grouped_fixtures=grouped_fixtures, last_updated=last_updated)

@app.route('/api/fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    return jsonify([f.to_dict() for f in fixtures])

@app.route('/api/cron/refresh', methods=['GET'])
def cron_refresh():
    """
    Endpoint for Vercel Cron Jobs.
    Securely triggered by Vercel every 15 minutes.
    """
    auth_token = request.args.get("token") or request.headers.get("X-Cron-Token")

    # On local development, allow refresh without token
    is_local = os.getenv("FLASK_ENV") == "development" or os.getenv("DEBUG") == "True"

    if not is_local:
        if not CRON_SECRET or auth_token != CRON_SECRET:
            app.logger.warning("Unauthorized attempt to trigger cron refresh.")
            return jsonify({"error": "Unauthorized"}), 401

    try:
        scraper = TrumbaScraper(TRUMBA_XML_URL)
        new_count, updated_count = scraper.scrape()
        return jsonify({
            "status": "success",
            "new_fixtures": new_count,
            "updated_fixtures": updated_count
        }), 200
    except Exception as e:
        app.logger.error(f"Cron scrape failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({"status": "healthy"}), 200

# Custom Error Handlers
@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(429)
def ratelimit_handler(e):
    return render_template('rate_limit.html'), 429

if __name__ == "__main__":
    # 1. Start the background scraper thread ONLY when running locally
    # We check WERKZEUG_RUN_MAIN to prevent the thread from starting twice in debug mode
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('FLASK_DEBUG'):
        scraper_thread = threading.Thread(target=run_background_scraper, args=(app,), daemon=True)
        scraper_thread.start()
        print("[System] Background scraper thread started (15m interval).")

    app.run(debug=True, port=5001)
