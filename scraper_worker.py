#!/usr/bin/env python3
"""
Scheduled Scraper Worker for Sports Fetcher.
Runs every 15 minutes from 04:45 AM to 04:15 PM Sydney time, Tuesday through Saturday.
Optimized for user activity hours (5 AM - 4 PM work shift).
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
    Covers user activity: 5 AM shift start through 4 PM finish.
    """
    try:
        sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
    except Exception:
        sydney_tz = timezone.utc

    now = datetime.now(sydney_tz)
    
    # Monday=0, Tuesday=1, ..., Saturday=5, Sunday=6
    # Run Tuesday (1) through Saturday (5)
    if now.weekday() < 1 or now.weekday() > 5:
        return False

    # Start window: 04:45 AM (4 * 60 + 45 = 285 minutes past midnight)
    # End window: 04:15 PM (16 * 60 + 15 = 975 minutes past midnight)
    minutes_since_midnight = now.hour * 60 + now.minute
    
    if minutes_since_midnight < 285:
        return False
    if minutes_since_midnight > 975:
        return False

    return True


def run_scheduled_scrape():
    """Run a single scrape cycle."""
    logger.info("Starting scheduled scrape...")
    
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
            from app import cache
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
    
    # 1. Initial Sync Check: Force scrape if flag is set (post-deployment)
    if os.getenv('FORCE_INITIAL_SYNC') == 'true':
        logger.warning("!!! INITIAL SYNC REQUIRED !!! Running scrape immediately to populate data.")
        run_scheduled_scrape()
    else:
        # 2. Scheduled Check: Run only if within optimized window (Tue-Sat, 04:45-16:15)
        if is_scheduled_time():
            run_scheduled_scrape()
        else:
            logger.info("Outside optimized schedule window (Tue-Sat 04:45-16:15 Sydney). Exiting.")


if __name__ == "__main__":
    main()