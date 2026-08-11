import os
import sqlite3
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import xml.etree.ElementTree as ET
from datetime import datetime
import httpx
from apscheduler.schedulers.background import BackgroundScheduler

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration from environment variables
XML_FEED_URL = os.getenv('XML_FEED_URL')
XML_API_KEY = os.getenv('XML_API_KEY')
XML_USERNAME = os.getenv('XML_USERNAME')
XML_PASSWORD = os.getenv('XML_PASSWORD')
POLL_INTERVAL_SECONDS = int(os.getenv('POLL_INTERVAL_SECONDS', 60))

# Initialize database
def init_db():
    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()

    # Create fixtures table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fixtures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT,
            home_team TEXT,
            away_team TEXT,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT,
            start_time TEXT,
            venue TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Function to fetch and parse XML data
def fetch_xml_data():
    if not XML_FEED_URL:
        return []

    try:
        headers = {}
        if XML_API_KEY:
            headers['Authorization'] = f'Bearer {XML_API_KEY}'
        if XML_USERNAME and XML_PASSWORD:
            auth = (XML_USERNAME, XML_PASSWORD)
        else:
            auth = None

        response = httpx.get(XML_FEED_URL, headers=headers, auth=auth)
        response.raise_for_status()

        # Parse XML
        root = ET.fromstring(response.text)

        # Extract fixtures
        fixtures = []
        for fixture in root.findall('.//fixture'):
            # Extract fixture data
            sport = fixture.find('sport')
            home_team = fixture.find('home_team')
            away_team = fixture.find('away_team')
            home_score = fixture.find('home_score')
            away_score = fixture.find('away_score')
            status = fixture.find('status')
            start_time = fixture.find('start_time')
            venue = fixture.find('venue')

            # Convert to dict
            fixture_dict = {
                'sport': sport.text if sport is not None else '',
                'home_team': home_team.text if home_team is not None else '',
                'away_team': away_team.text if away_team is not None else '',
                'home_score': int(home_score.text) if home_score is not None and home_score.text.isdigit() else 0,
                'away_score': int(away_score.text) if away_score is not None and away_score.text.isdigit() else 0,
                'status': status.text if status is not None else 'unknown',
                'start_time': start_time.text if start_time is not None else '',
                'venue': venue.text if venue is not None else ''
            }

            fixtures.append(fixture_dict)

        return fixtures
    except Exception as e:
        print(f"Error fetching XML data: {e}")
        return []

# Function to import fixtures into database
def import_fixtures():
    fixtures = fetch_xml_data()

    if not fixtures:
        return

    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()

    for fixture in fixtures:
        # Check if fixture already exists
        cursor.execute('''
            SELECT id FROM fixtures
            WHERE sport = ? AND home_team = ? AND away_team = ? AND start_time = ?
        ''', (fixture['sport'], fixture['home_team'], fixture['away_team'], fixture['start_time']))

        existing = cursor.fetchone()

        if existing:
            # Update existing fixture
            cursor.execute('''
                UPDATE fixtures
                SET home_score = ?, away_score = ?, status = ?, updated_at = ?
                WHERE id = ?
            ''', (fixture['home_score'], fixture['away_score'], fixture['status'], datetime.now(), existing[0]))
        else:
            # Insert new fixture
            cursor.execute('''
                INSERT INTO fixtures (sport, home_team, away_team, home_score, away_score, status, start_time, venue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (fixture['sport'], fixture['home_team'], fixture['away_team'], fixture['home_score'], fixture['away_score'], fixture['status'], fixture['start_time'], fixture['venue']))

    conn.commit()
    conn.close()

# Schedule background tasks
scheduler = BackgroundScheduler()
scheduler.add_job(import_fixtures, 'interval', seconds=POLL_INTERVAL_SECONDS)
scheduler.start()

# Routes
@app.route('/')
def home():
    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures ORDER BY start_time')
    fixtures = cursor.fetchall()
    conn.close()
    return render_template('index.html', fixtures=fixtures)

@app.route('/fixtures')
def fixtures():
    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures ORDER BY start_time')
    fixtures = cursor.fetchall()
    conn.close()
    return render_template('fixtures.html', fixtures=fixtures)

@app.route('/fixture/<int:fixture_id>')
def fixture_detail(fixture_id):
    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures WHERE id = ?', (fixture_id,))
    fixture = cursor.fetchone()
    conn.close()
    return render_template('fixture_detail.html', fixture=fixture)

@app.route('/search')
def search():
    search_query = request.args.get('q', '')
    conn = sqlite3.connect('sports_fixtures.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM fixtures
        WHERE home_team LIKE ? OR away_team LIKE ? OR sport LIKE ?
        ORDER BY start_time
    ''', (f'%{search_query}%', f'%{search_query}%', f'%{search_query}%'))
    fixtures = cursor.fetchall()
    conn.close()
    return render_template('search_results.html', fixtures=fixtures, query=search_query)

@app.route('/refresh', methods=['POST'])
def refresh():
    try:
        import_fixtures()
        return jsonify({'success': True, 'message': 'Data refreshed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True)