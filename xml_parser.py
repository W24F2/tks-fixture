from lxml import etree
import sqlite3
from database import insert_fixture

def parse_xml(xml_content):
    root = etree.fromstring(xml_content)

    # Parse XML content and extract fixture data
    for fixture in root.xpath('//fixture'):
        sport = fixture.get('sport')
        league = fixture.get('league')
        home_team = fixture.find('home_team').text if fixture.find('home_team') is not None else ''
        away_team = fixture.find('away_team').text if fixture.find('away_team') is not None else ''
        start_time = fixture.find('start_time').text if fixture.find('start_time') is not None else ''
        status = fixture.find('status').text if fixture.find('status') is not None else ''
        score = fixture.find('score').text if fixture.find('score') is not None else ''

        insert_fixture(sport, league, home_team, away_team, start_time, status, score)