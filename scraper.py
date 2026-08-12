import os
import requests
from lxml import etree
import re
from datetime import datetime
from models import db, Fixture

class TrumbaScraper:
    def __init__(self, url=None):
        self.url = url or os.getenv('TRUMBA_XML_URL')
        if not self.url:
            raise ValueError("TRUMBA_XML_URL must be provided or set in environment variables")
        self.ns = {'atom': 'http://www.w3.org/2005/Atom'}

    def _parse_date_time(self, content_html):
        """
        Parses the date and time from the Trumba HTML content block.
        """
        # 1. Clean the HTML
        # Trumba uses &ndash; (–) and &nbsp;
        clean_text = content_html.replace('&nbsp;', ' ').replace('&ndash;', '–').replace('&mdash;', '—')
        clean_text = re.sub('<[^<]+?>', ' ', clean_text)
        clean_text = ' '.join(clean_text.split()) # collapse whitespace

        # 2. Find the date/time segment.
        # It usually looks like: "Saturday, August 15, 2026, 7–8:30am"
        # We'll look for a pattern: Weekday, Month Day, Year, Time
        # Regex: (Month) (Day), (Year), (Time Segment)
        date_pattern = r'([A-Z][a-z]+ \d{1,2}, \d{4}),\s*([^<]+)'
        match = re.search(date_pattern, clean_text)

        if not match:
            # Fallback: try to find just the date part if weekday is missing
            date_pattern = r'([A-Z][a-z]+ \d{1,2}, \d{4}, [^<]+)'
            match = re.search(date_pattern, clean_text)
            if not match:
                return None

            # If we only got the date part, we might need to split it manually
            full_match = match.group(1)
            parts = full_match.split(',')
            if len(parts) < 3: return None
            date_part = f"{parts[1].strip()} {parts[2].strip()}"
            time_part = parts[3].strip() if len(parts) > 3 else ""
        else:
            date_part = match.group(1)
            time_part = match.group(2)

        # 3. Parse the time part. It might be "7–8:30am" or "7am"
        # We take the start time.
        # Split by en-dash, em-dash, or hyphen
        time_segment = re.split(r'[–\-\—]', time_part)[0].strip()

        # Ensure there's a space before am/pm for strptime
        time_segment = re.sub(r'([ap]m)', r' \1', time_segment, flags=re.IGNORECASE).strip()

        # Handle "7" -> "7:00"
        if ':' not in time_segment:
            # Check if it's just "7am" or "7"
            match_hour = re.search(r'(\d{1,2})', time_segment)
            if match_hour:
                hour = match_hour.group(1)
                suffix = ""
                if "am" in time_segment.lower(): suffix = " am"
                elif "pm" in time_segment.lower(): suffix = " pm"
                time_segment = f"{hour}:00{suffix}"

        try:
            # Combine and parse
            # We use %p for AM/PM. strptime needs a space before it.
            # We'll normalize the string to "August 15, 2026 7:00 am"
            final_str = f"{date_part} {time_segment}"
            # Standardize am/pm to lowercase and ensure space
            final_str = re.sub(r'([ap]m)', r' \1', final_str, flags=re.IGNORECASE).strip()
            # Remove any double spaces
            final_str = ' '.join(final_str.split())

            # Try common formats
            for fmt in ("%B %d, %Y %I:%M %p", "%B %d, %Y %I %p", "%B %d, %Y %H:%M"):
                try:
                    return datetime.strptime(final_str, fmt)
                except ValueError:
                    continue

            # If all fail, try a last ditch effort with a more flexible parser if available,
            # but we'll stick to datetime for now.
            print(f"Failed to parse datetime: {final_str}")
            return None
        except Exception as e:
            print(f"Datetime error: {e}")
            return None

    def _extract_metadata(self, content_html):
        """
        Extracts Sport, Opposition, Team, and Location using safer label-based parsing.
        """
        metadata = {
            "sport": None,
            "opposition": None,
            "team": None,
            "location": None
        }

        # 1. Clean HTML
        clean_text = content_html.replace('&nbsp;', ' ').replace('&ndash;', '–').replace('&mdash;', '—')
        clean_text = re.sub('<[^<]+?>', ' ', clean_text)
        clean_text = ' '.join(clean_text.split())

        # 2. Extract Location (usually before the date)
        # Look for the first sequence of text before a weekday/date pattern
        loc_match = re.split(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|, [A-Z][a-z]+ \d{1,2},)', clean_text, flags=re.IGNORECASE)
        if loc_match and len(loc_match) > 0:
            loc = loc_match[0].strip()
            if loc:
                metadata["location"] = loc

        # 3. Extract Sport, Opposition, Team using labels and lookahead for boundaries
        # We look for 'Label: Value' where Value ends at the next Label or end of string
        patterns = {
            "sport": r'Sport\s*:\s*(.*?)(?=\s*(?:Opposition|Team|Location|Location:|$))',
            "opposition": r'Opposition\s*:\s*(.*?)(?=\s*(?:Sport|Team|Location|Location:|$))',
            "team": r'Team\s*:\s*(.*?)(?=\s*(?:Sport|Opposition|Location|Location:|$))'
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, clean_text, re.IGNORECASE | re.DOTALL)
            if match:
                val = match.group(1).strip()
                # Clean up any trailing commas or extra spaces
                val = re.sub(r'^[,.\s]+|[,.\s]+$', '', val)
                metadata[key] = val

        return metadata

    def scrape(self):
        print(f"Starting scrape from {self.url}...")
        try:
            response = requests.get(self.url, timeout=30)
            response.raise_for_status()
        except Exception as e:
            print(f"Request failed: {e}")
            raise

        root = etree.fromstring(response.content)
        entries = root.xpath('//atom:entry', namespaces=self.ns)
        print(f"Found {len(entries)} entries in XML.")

        new_count = 0
        updated_count = 0

        for entry in entries:
            try:
                # Use xpath to get text safely
                ext_id_list = entry.xpath('atom:id/text()', namespaces=self.ns)
                if not ext_id_list: continue
                external_id = ext_id_list[0]

                title_list = entry.xpath('atom:title/text()', namespaces=self.ns)
                if not title_list: continue
                title = title_list[0]

                content_list = entry.xpath('atom:content/text()', namespaces=self.ns)
                if not content_list: continue
                content_html = content_list[0]

                dt = self._parse_date_time(content_html)
                if not dt:
                    # print(f"Skipping {external_id}: Date parse failed")
                    continue

                metadata = self._extract_metadata(content_html)

                # Upsert logic
                fixture = Fixture.query.filter_by(external_id=external_id).first()

                if fixture:
                    fixture.title = title
                    fixture.location = metadata["location"]
                    fixture.event_date = dt.date()
                    fixture.event_time = dt.time()
                    fixture.sport = metadata["sport"]
                    fixture.opposition = metadata["opposition"]
                    fixture.team = metadata["team"]
                    fixture.raw_content = content_html
                    updated_count += 1
                else:
                    new_fixture = Fixture(
                        external_id=external_id,
                        title=title,
                        location=metadata["location"],
                        event_date=dt.date(),
                        event_time=dt.time(),
                        sport=metadata["sport"],
                        opposition=metadata["opposition"],
                        team=metadata["team"],
                        raw_content=content_html
                    )
                    db.session.add(new_fixture)
                    new_count += 1
            except Exception as e:
                print(f"Error processing entry {external_id if 'external_id' in locals() else 'unknown'}: {e}")
                continue

        db.session.commit()
        print(f"Scrape complete. New: {new_count}, Updated: {updated_count}")
        return new_count, updated_count
