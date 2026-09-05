"""
Scheduled Scraper Worker for Sports Fetcher.
Runs every 15 minutes from 04:45 AM to 04:15 PM Sydney time, Tuesday through Saturday.
Automatically catches up on first launch / stale data / empty database.
"""
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

try:
    import zoneinfo
except (KeyError, OSError):
    from backports import zoneinfo  # type: ignore[attr-defined,no-redef,import-untyped]

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app import create_app
from models import Fixture  # Import model to check DB state
from scraper import TrumbaScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_scheduled_time():
    """
    Check if current time is within the optimized window:
    Tuesday (1) through Saturday (5), 04:45 AM to 04:15 PM Sydney time.
    """
    try:
        sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
    except (KeyError, OSError):
        sydney_tz = timezone.utc

    now = datetime.now(sydney_tz)
    
    # Monday=0, Tuesday=1, ..., Saturday=5, Sunday=6
    if now.weekday() < 1 or now.weekday() > 5:
        return False

    minutes_since_midnight = now.hour * 60 + now.minute
    
    # 04:45 AM = 285 min, 04:15 PM = 975 min
    return 285 <= minutes_since_midnight <= 975


def needs_catch_up_scrape(app):
    """
    Determine if an immediate scrape is needed:
    - Table is empty (fresh deploy / new DB)
    - Data is stale (> 24 hours since last update)
    """
    with app.app_context():
        try:
            # Check if any fixtures exist
            count = Fixture.query.count()
            if count == 0:
                logger.info("Database empty — triggering initial catch-up scrape.")
                return True

            # Check freshness of latest record
            latest = Fixture.query.order_by(Fixture.last_updated.desc()).first()
            if latest and latest.last_updated:
                # Ensure timezone awareness for comparison
                latest_update = latest.last_updated
                if latest_update.tzinfo is None:
                    latest_update = latest_update.replace(tzinfo=timezone.utc)
                
                age = datetime.now(timezone.utc) - latest_update
                if age > timedelta(hours=24):
                    logger.warning(f"Data stale ({age} old) — triggering catch-up scrape.")
                    return True
            
            return False
        except (OperationalError, SQLAlchemyError) as e:
            # If DB not ready or schema missing, assume we need to scrape
            logger.warning(f"DB check failed ({e}) — assuming catch-up needed.")
            return True


def run_scheduled_scrape():
    """Run a single scrape cycle."""
    logger.info("Starting scrape cycle...")
    
    app = create_app()
    
    with app.app_context():
        try:
            trumba_url = os.getenv('TRUMBA_XML_URL')
            if not trumba_url:
                logger.error("TRUMBA_XML_URL not set in environment")
                return False
            
            scraper = TrumbaScraper(trumba_url)
            new_count, updated_count = scraper.scrape()
            
            # Invalidate cache after successful scrape
            cache = app.extensions.get('cache')
            if cache:
                cache.delete('api_fixtures')
                cache.delete('index_page')
            else:
                logger.warning("Cache not available in app extensions; skipping invalidation")
            
            logger.info(f"Scrape completed. New: {new_count}, Updated: {updated_count}")
            return True
            
        except (requests.RequestException, ValueError, RuntimeError, SQLAlchemyError) as e:
            logger.error(f"Scrape failed: {e}")
            return False


def main():
    """Main entry point for the scraper worker."""
    logger.info("=== Sports Fetcher Scraper Worker Started ===")
    
    app = create_app()
    
    # 1. SELF-HEALING: Run immediately if DB empty or data stale (>24h)
    # This covers: new deploys, failed scrapes, manual resets, first run.
    if needs_catch_up_scrape(app):
        logger.info("Catch-up condition met — running immediate scrape.")
        run_scheduled_scrape()
        # After catch-up, we still respect schedule for *subsequent* runs
        # (systemd timer will re-invoke us in 15 min if in window)
        return

    # 2. SCHEDULED: Only run if within optimized window (Tue-Sat 04:45-16:15)
    if is_scheduled_time():
        run_scheduled_scrape()
    else:
        logger.info("Outside schedule window (Tue-Sat 04:45-16:15 Sydney) and data is fresh. Exiting.")


if __name__ == "__main__":
    main()