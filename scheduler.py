from apscheduler.schedulers.background import BackgroundScheduler
import os
from scraper import fetch_xml
from xml_parser import parse_xml

def schedule_background_tasks():
    # Create a scheduler
    scheduler = BackgroundScheduler()

    # Get polling interval from environment variable
    polling_interval = int(os.getenv('POLL_INTERVAL_SECONDS', 60))

    # Add job to fetch and parse XML periodically
    scheduler.add_job(fetch_and_parse_xml, 'interval', seconds=polling_interval)

    # Start the scheduler
    scheduler.start()

def fetch_and_parse_xml():
    # Fetch XML content
    xml_content = fetch_xml()

    # Parse XML content
    parse_xml(xml_content)