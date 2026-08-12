import xml.etree.ElementTree as ET
import httpx
from xml_parser import parse_xml
from database import init_db, get_fixtures
import time
import logging

# Initialize database
init_db()

def fetch_and_parse_xml():
    """Fetch and parse XML feed from Trumba."""
    xml_feed_url = 'https://www.trumba.com/calendars/senior-fixtures.xml'

    try:
        print(f"Fetching XML from {xml_feed_url}")

        # Fetch the XML content with timeout
        response = httpx.get(xml_feed_url, timeout=30.0)
        response.raise_for_status()

        xml_content = response.content
        print(f"Successfully fetched {len(xml_content)} bytes of XML data")

        # Parse XML content
        parsed_fixtures = parse_xml(xml_content)
        print(f"Successfully parsed {len(parsed_fixtures)} fixtures")

        return parsed_fixtures
    except Exception as e:
        print(f"Error fetching/parsing XML: {e}")
        return []

def scrape_fixtures():
    """Main scraping function."""
    try:
        print("Starting to scrape fixtures...")
        fixtures = fetch_and_parse_xml()

        if fixtures:
            print(f"Successfully scraped {len(fixtures)} fixtures")
            return fixtures
        else:
            print("No fixtures found")
            return []

    except Exception as e:
        print(f"Error in scraping: {e}")
        return []

# Test the scraper
if __name__ == "__main__":
    scrape_fixtures()