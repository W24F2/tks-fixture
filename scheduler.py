import time
from apscheduler.schedulers.background import BackgroundScheduler
from scraper import scrape_fixtures
from database import init_db, get_fixtures
import logging

# Initialize database
init_db()

def refresh_fixtures():
    """Refresh fixtures from the XML feed."""
    try:
        print("Refreshing fixtures...")
        fixtures = scrape_fixtures()

        if fixtures:
            print(f"Successfully refreshed {len(fixtures)} fixtures")
        else:
            print("No fixtures to refresh")

        return fixtures
    except Exception as e:
        print(f"Error refreshing fixtures: {e}")
        return []

def start_scheduler():
    """Start the scheduler for automatic refresh."""
    scheduler = BackgroundScheduler()

    # Add job to refresh every 30 minutes
    scheduler.add_job(refresh_fixtures, 'interval', minutes=30)

    # Start the scheduler
    scheduler.start()

    print("Scheduler started - refreshing every 30 minutes")

    try:
        # Keep the scheduler running
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("Scheduler shutdown")

    return scheduler

if __name__ == "__main__":
    start_scheduler()