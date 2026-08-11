import sqlite3
from datetime import datetime

def init_db():
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fixtures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT,
            league TEXT,
            home_team TEXT,
            away_team TEXT,
            start_time TEXT,
            status TEXT,
            score TEXT,
            updated_at TEXT
        )
    ''')

    conn.commit()
    conn.close()

def insert_fixture(sport, league, home_team, away_team, start_time, status, score):
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO fixtures (sport, league, home_team, away_team, start_time, status, score, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (sport, league, home_team, away_team, start_time, status, score, datetime.now()))

    conn.commit()
    conn.close()

def get_fixtures():
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures ORDER BY start_time')
    fixtures = cursor.fetchall()
    conn.close()
    return fixtures

def get_fixture_by_id(fixture_id):
    conn = sqlite3.connect('data/sports.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM fixtures WHERE id = ?', (fixture_id,))
    fixture = cursor.fetchone()
    conn.close()
    return fixture