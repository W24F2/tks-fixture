import xml.etree.ElementTree as ET
from database import insert_fixture
from datetime import datetime
import re

def parse_xml(xml_content):
    """Parse XML content and insert fixtures into database."""
    if not xml_content:
        print("No XML content to parse")
        return []

    try:
        # Parse XML content
        root = ET.fromstring(xml_content)
        print(f"Successfully parsed XML with root element: {root.tag}")

        # Handle Atom feed structure - find entries properly
        fixtures = []

        # Find all entry elements in the feed
        entries = []
        for child in root:
            if child.tag.endswith('entry') or child.tag.endswith('Entry'):
                entries.append(child)

        print(f"Found {len(entries)} entries")

        # Process each entry
        for i, entry in enumerate(entries):
            try:
                # Get all child elements
                children = list(entry)

                # Extract title and content from entry
                title = ""
                content = ""
                league = ""
                sport = ""
                opposition = ""
                team = ""
                start_time = "TBD"

                # Look through children to find title and content
                for child in children:
                    if child.tag.endswith('title') or child.tag.endswith('Title'):
                        title = child.text if child.text else ""
                    elif child.tag.endswith('content') or child.tag.endswith('Content'):
                        content = child.text if child.text else ""
                    elif child.tag.endswith('category') or child.tag.endswith('Category'):
                        league = child.text if child.text else ""

                # If we found title, let's extract more data from it
                if title:
                    # Extract sport from title
                    sport = extract_sport_from_title(title)

                    # Extract team from title
                    team = extract_team_from_title(title)

                    # Extract opposition from content if available
                    if content:
                        # Parse the structured content to extract sport, opposition, team
                        parsed_data = parse_html_content(content)
                        if parsed_data:
                            sport = parsed_data.get('sport', sport)
                            opposition = parsed_data.get('opposition', '')
                            team = parsed_data.get('team', team)
                            start_time = parsed_data.get('start_time', 'TBD')

                        # Also try to extract time from content
                        start_time = extract_start_time_from_content(content)

                # Clean up extracted data
                sport = sport.strip()
                team = team.strip()
                opposition = opposition.strip()

                # If we have all required information, insert into database
                if sport and team and opposition:
                    # Insert or update fixture in database
                    insert_fixture(sport, league, team, opposition, start_time, 'upcoming', '')
                    fixtures.append({
                        'sport': sport,
                        'team': team,
                        'opposition': opposition,
                        'start_time': start_time,
                        'league': league,
                        'status': 'upcoming'
                    })
                else:
                    print(f"Could not extract full fixture info from: {title}")

            except Exception as e:
                print(f"Error processing entry: {e}")
                continue

        print(f"Successfully processed {len(fixtures)} fixtures")
        return fixtures
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return []

def parse_html_content(content):
    """Parse HTML content to extract structured information."""
    if not content:
        return None

    result = {}

    # Look for structured data in HTML
    # Extract sport, opposition, team from HTML content
    # Pattern like: <b>Sport</b>:&nbsp;Badminton
    if '<b>Sport</b>:' in content:
        start = content.find('<b>Sport</b>:')
        if start != -1:
            # Find the start position of the value
            start_pos = content.find('&nbsp;', start)
            if start_pos != -1:
                # Find end position of the sport value
                end_pos = content.find('<', start_pos)
                if end_pos != -1:
                    sport_value = content[start_pos+6:end_pos].strip()
                    result['sport'] = sport_value

    # Look for opposition
    if '<b>Opposition</b>:' in content:
        start = content.find('<b>Opposition</b>:')
        if start != -1:
            start_pos = content.find('&nbsp;', start)
            if start_pos != -1:
                end_pos = content.find('<', start_pos)
                if end_pos != -1:
                    opposition_value = content[start_pos+6:end_pos].strip()
                    result['opposition'] = opposition_value

    # Look for team
    if '<b>Team</b>:' in content:
        start = content.find('<b>Team</b>:')
        if start != -1:
            start_pos = content.find('&nbsp;', start)
            if start_pos != -1:
                end_pos = content.find('<', start_pos)
                if end_pos != -1:
                    team_value = content[start_pos+6:end_pos].strip()
                    result['team'] = team_value

    # Look for time pattern in content
    # Pattern like: Saturday, August 15, 2026, 8&nbsp;&ndash;&nbsp;9:30am
    time_pattern = r'\w+,\s+\w+\s+\d+,\s+\d+&nbsp;&ndash;&nbsp;\d+:\d+'
    matches = re.findall(time_pattern, content)
    if matches:
        # Extract just the time part
        time_part = matches[0]
        # Extract time from pattern
        time_match = re.search(r'\d+&nbsp;&ndash;&nbsp;\d+', time_part)
        if time_match:
            result['start_time'] = time_match.group(0).replace('&nbsp;', ' ').replace('&ndash;', '-').strip()

    return result

def extract_sport_from_title(title):
    """Extract sport from title string."""
    if not title:
        return ''

    # Common sports patterns - case insensitive
    sports = [
        'Badminton', 'Football', 'Rugby', 'Volleyball', 'Mountain Biking',
        'Multisports', 'Pickleball', 'Cross Country', 'Basketball', 'Tennis',
        'Netball', 'Swimming', 'Athletics', 'Gymnastics', 'Cricket', 'Hockey',
        'Lacrosse', 'Soccer', 'Water Polo', 'Table Tennis', 'Baseball',
        'Ice Hockey', 'American Football', 'Rugby League', 'Rugby Union',
        'Boxing', 'Martial Arts', 'Cycling', 'Triathlon', 'Marathon',
        'Skiing', 'Snowboarding', 'Surfing', 'Skateboarding', 'Rock Climbing'
    ]

    # Check for any sports in the title (case insensitive)
    for sport in sports:
        if sport.lower() in title.lower():
            return sport

    # Default to first sport found or generic
    return 'Sports' if title else ''

def extract_team_from_title(title):
    """Extract team name from title string."""
    if not title:
        return ''

    # Try to extract team names based on patterns
    # Look for 'vs' pattern in title
    if 'vs' in title.lower():
        parts = title.split('vs')
        if len(parts) > 1:
            return parts[1].strip()

    # Try to extract team name from parentheses
    paren_pattern = r'\(([^)]+)\)'
    matches = re.findall(paren_pattern, title)
    if matches:
        return matches[0].strip()

    # If no 'vs' pattern, return first word or phrase
    words = title.split()
    if len(words) > 0:
        return words[0].strip()

    return 'Team' if title else ''

def extract_opponent_from_content(content):
    """Extract opponent team from content."""
    if not content:
        return ''

    # Look for opponent teams in content
    if 'vs' in content.lower():
        parts = content.split('vs')
        if len(parts) > 1:
            return parts[1].strip()

    return 'Opponent' if content else ''

def extract_start_time(title):
    """Extract start time from title."""
    if not title:
        return ''

    # Look for time patterns
    time_patterns = [
        r'\d{1,2}:\d{2}\s*(?:[AP][M]|\w+)',  # Time format like 12:30 PM
        r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s*\d{1,2}:\d{2}',  # Date-time format
        r'\d{1,2}\s+(?:AM|PM)',  # Simple time format
    ]

    for pattern in time_patterns:
        match = re.search(pattern, title)
        if match:
            return match.group(0)

    return 'TBD'

def extract_start_time_from_content(content):
    """Extract start time from content."""
    if not content:
        return 'TBD'

    # Look for time pattern like: Saturday, August 15, 2026, 8&nbsp;&ndash;&nbsp;9:30am
    time_pattern = r'\w+,\s+\w+\s+\d+,\s+\d+&nbsp;&ndash;&nbsp;\d+:\d+'
    matches = re.findall(time_pattern, content)
    if matches:
        # Extract just the time part
        time_part = matches[0]
        # Extract time from pattern
        time_match = re.search(r'\d+&nbsp;&ndash;&nbsp;\d+', time_part)
        if time_match:
            return time_match.group(0).replace('&nbsp;', ' ').replace('&ndash;', '-').strip()

    return 'TBD'

def extract_league_from_content(content):
    """Extract league from content."""
    if not content:
        return ''

    # Common league patterns
    leagues = [
        'Premier League', 'Championship', 'League One', 'League Two',
        'NBA', 'NFL', 'MLB', 'NHL', 'Premiership', 'Division One',
        'Championship', 'League', 'Tournament', 'Cup', 'Series',
        'International', 'National', 'Regional', 'Local', 'School',
        'College', 'University', 'Club', 'Team', 'Competition'
    ]

    for league in leagues:
        if league in content:
            return league

    return 'League' if content else ''