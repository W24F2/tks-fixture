import httpx
import os
from dotenv import load_dotenv

load_dotenv()

def fetch_xml():
    # Get XML feed URL from environment variable
    xml_feed_url = os.getenv('XML_FEED_URL', 'https://example.com/sports-fixtures.xml')

    # Get API key, username, and password if available
    api_key = os.getenv('XML_API_KEY', '')
    username = os.getenv('XML_USERNAME', '')
    password = os.getenv('XML_PASSWORD', '')

    # Make HTTP request to fetch XML
    if api_key:
        headers = {'Authorization': f'Bearer {api_key}'}
        response = httpx.get(xml_feed_url, headers=headers)
    elif username and password:
        response = httpx.get(xml_feed_url, auth=(username, password))
    else:
        response = httpx.get(xml_feed_url)

    # Return XML content
    return response.content