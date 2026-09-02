#!/usr/bin/env python3
"""
Scheduled Scraper Worker for Sports Fetcher.
Runs every 15 minutes from Tuesday to Saturday until 8:00 PM.
Designed to be run via systemd timer or cron.
"""
import os
import sys
import logging
from datetime import datetime, timezone, timedelta
try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from scraper import TrumbaScraper
from flask_caching import Cache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_scheduled_time():
    """
    Check if current time is within the scheduled window:
    Tuesday (1) to Saturday (5), until 20:00 (8 PM) Sydney time.
    """
    # Use Sydney timezone for scheduling
    try:
        sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
    except Exception:
        sydney_tz = timezone.utc

    now = datetime.now(sydney_tz)
    
    # Monday=0, Tuesday=1, ..., Saturday=5, Sunday=6
    # Run Tuesday (1) through Saturday (5)
    if now.weekday() < 1 or now.weekday() > 5:
        logger.info(f"Outside scheduled days (weekday={now.weekday()}). Skipping.")
        return False
    
    # Stop after 8:00 PM (20:00)
    if now.hour >= 20:
        logger.info(f"After 8 PM ({now.hour}:00). Skipping.")
        return False
    
    return True


def run_scheduled_scrape():
    """Run a single scrape cycle."""
    logger.info("Starting scheduled scrape...")
    
    app = create_app()
    
    # Create cache instance for this app
    cache_config = {
        "CACHE_TYPE": "RedisCache" if os.getenv("REDIS_URL") else "SimpleCache",
        "CACHE_DEFAULT_TIMEOUT": 60,
    }
    if os.getenv("REDIS_URL"):
        cache_config["CACHE_REDIS_URL"] = os.getenv("REDIS_URL")
    
    cache = Cache(app, config=cache_config)
    
    with app.app_context():
        try:
            trumba_url = os.getenv('TRUMBA_XML_URL')
            if not trumba_url:
                logger.error("TRUMBA_XML_URL not set in environment")
                return False
            
            scraper = TrumbaScraper(trumba_url)
            new_count, updated_count = scraper.scrape()
            
            # Invalidate cache after successful scrape
            cache.delete('api_fixtures')
            cache.delete('index_page')
            
            logger.info(f"Scrape completed successfully. New: {new_count}, Updated: {updated_count}")
            return True
            
        except Exception as e:
            logger.error(f"Scrape failed: {e}")
            return False


def main():
    """Main entry point for the scraper worker."""
    logger.info("=== Sports Fetcher Scraper Worker Started ===")
    
    if not is_scheduled_time():
        logger.info("Not within scheduled time window. Exiting.")
        sys.exit(0)
    
    success = run_scheduled_scrape()
    
    if success:
        logger.info("Scraper worker completed successfully.")
        sys.exit(0)
    else:
        logger.error("Scraper worker failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()