"""
Database operations for sports fixtures
"""
import sqlite3
from datetime import datetime

def init_db():
    """Initialize the database and create tables"""
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()

    # Create fixtures table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fixtures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competition TEXT NOT NULL,
            team1 TEXT NOT NULL,
            team2 TEXT NOT NULL,
            score1 INTEGER,
            score2 INTEGER,
            venue TEXT,
            date_time TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

def insert_fixtures(fixtures):
    """Insert fixtures into the database"""
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()

    for fixture in fixtures:
        cursor.execute('''
            INSERT OR REPLACE INTO fixtures
            (competition, team1, team2, score1, score2, venue, date_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            fixture['competition'],
            fixture['team1'],
            fixture['team2'],
            fixture['score1'],
            fixture['score2'],
            fixture['venue'],
            fixture['date_time'],
            fixture['status']
        ))

    conn.commit()
    conn.close()

def get_fixtures, search_fixtures()():
    """Get all fixtures from the database"""
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures ORDER BY date_time')
    fixtures = cursor.fetchall()
    conn.close()
    return fixtures

def get_fixture_by_id(fixture_id):
    """Get a specific fixture by ID"""
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures WHERE id = ?', (fixture_id,))
    fixture = cursor.fetchone()
    conn.close()
    return fixture