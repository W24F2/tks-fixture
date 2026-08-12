import os
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
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Configuration
TRUMBA_XML_URL = os.getenv('TRUMBA_XML_URL', "https://www.trumba.com/calendars/senior-fixtures.xml")

@app.route('/')
def index():
    """Main dashboard view."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    return render_template('index.html', fixtures=fixtures)

@app.route('/api/fixtures')
def get_fixtures():
    """API endpoint to get fixtures in JSON format."""
    fixtures = Fixture.query.order_by(Fixture.event_date.asc(), Fixture.event_time.asc()).all()
    return jsonify([f.to_dict() for f in fixtures])

@app.route('/api/refresh', methods=['POST'])
@limiter.limit("5 per hour")  # Restrict intensive scraping
def refresh_data():
    """
    Endpoint to trigger the scraper.
    """
    auth_token = request.headers.get("X-Refresh-Token")
    expected_token = os.getenv("REFRESH_TOKEN")

    if expected_token and auth_token != expected_token:
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
        app.logger.error(f"Scrape failed: {e}")
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
    app.run(debug=True, port=5000)
