import os
import requests
import logging
import re
from datetime import datetime
from lxml import etree, html
from sqlalchemy.exc import IntegrityError
from models import db, Fixture

# Configure logging
logger = logging.getLogger(__name__)

class TrumbaScraper:
    def __init__(self, url=None):
        self.url = url or os.getenv('TRUMBA_XML_URL')
        if not self.url:
            raise ValueError("TRUMBA_XML_URL must be provided or set in environment variables")
        self.ns = {'atom': 'http://www.w3.org/2005/Atom'}

    def _clean_html(self, content_html):
        """
        Cleans HTML content and returns plain text.
        """
        try:
            # Use lxml to parse and extract text
            tree = html.fromstring(content_html)
            text = tree.text_content()
            # Replace common HTML entities/whitespace issues
            text = text.replace('\xa0', ' ')
            return ' '.join(text.split())
        except Exception as e:
            logger.debug(f"lxml cleaning failed, falling back to regex: {e}")
            # Fallback to regex-based cleaning
            clean_text = re.sub('<[^<]+?>', ' ', content_html)
            return ' '.join(clean_text.split())

    def _parse_date_time(self, content_html):
        """
        Parses the date and time from the Trumba HTML content block.
        """
        clean_text = self._clean_html(content_html)

        # 2. Find the date/time segment.
        # It usually looks like: "Saturday, August 15, 2026, 7–8:30am"
        # Regex: (Month) (Day), (Year), (Time Segment)
        date_pattern = r'([A-Z][a-z]+ \d{1,2}, \d{4}),\s*([^<]+)'
        match = re.search(date_pattern, clean_text)

        if not match:
            # Fallback: try to find just the date part if weekday is missing
            date_pattern = r'([A-Z][a-z]+ \d{1,2}, \d{4}, [^<]+)'
            match = re.search(date_pattern, clean_text)
            if not match:
                return None

            full_match = match.group(1)
            parts = full_match.split(',')
            if len(parts) < 3: return None
            date_part = f"{parts[1].strip()} {parts[2].strip()}"
            time_part = parts[3].strip() if len(parts) > 3 else ""
        else:
            date_part = match.group(1)
            time_part = match.group(2)

        # 3. Parse the time part.
        time_segment = re.split(r'[–\-\—]', time_part)[0].strip()
        time_segment = re.sub(r'([ap]m)', r' \1', time_segment, flags=re.IGNORECASE).strip()

        if ':' not in time_segment:
            match_hour = re.search(r'(\d{1,2})', time_segment)
            if match_hour:
                hour = match_hour.group(1)
                suffix = ""
                if "am" in time_segment.lower(): suffix = " am"
                elif "pm" in time_segment.lower(): suffix = " pm"
                time_segment = f"{hour}:00{suffix}"

        try:
            final_str = f"{date_part} {time_segment}"
            final_str = re.sub(r'([ap]m)', r' \1', final_str, flags=re.IGNORECASE).strip()
            final_str = ' '.join(final_str.split())

            for fmt in ("%B %d, %Y %I:%M %p", "%B %d, %Y %I %p", "%B %d, %Y %H:%M"):
                try:
                    return datetime.strptime(final_str, fmt)
                except ValueError:
                    continue

            logger.warning(f"Failed to parse datetime: {final_str}")
            return None
        except Exception as e:
            logger.error(f"Datetime error: {e}")
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

        clean_text = self._clean_html(content_html)

        # 2. Extract Location (usually before the date)
        loc_match = re.split(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|, [A-Z][a-z]+ \d{1,2},)', clean_text, flags=re.IGNORECASE)
        if loc_match and len(loc_match) > 0:
            loc = loc_match[0].strip()
            if loc:
                metadata["location"] = loc

        # 3. Extract Sport, Opposition, Team
        patterns = {
            "sport": r'Sport\s*:\s*(.*?)(?=\s*(?:Opposition|Team|Location|Location:|$))',
            "opposition": r'Opposition\s*:\s*(.*?)(?=\s*(?:Sport|Team|Location|Location:|$))',
            "team": r'Team\s*:\s*(.*?)(?=\s*(?:Sport|Opposition|Location|Location:|$))'
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, clean_text, re.IGNORECASE | re.DOTALL)
            if match:
                val = match.group(1).strip()
                val = re.sub(r'^[,.\s]+|[,.\s]+$', '', val)
                metadata[key] = val

        return metadata

    def scrape(self):
        logger.info(f"Starting scrape from {self.url}...")
        try:
            response = requests.get(self.url, timeout=30)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Request failed: {e}")
            raise

        root = etree.fromstring(response.content)
        entries = root.xpath('//atom:entry', namespaces=self.ns)
        logger.info(f"Found {len(entries)} entries in XML.")

        new_count = 0
        updated_count = 0

        for entry in entries:
            external_id = None
            try:
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
                    logger.warning(f"Skipping entry {external_id}: Date parse failed")
                    continue

                metadata = self._extract_metadata(content_html)

                try:
                    with db.session.begin_nested():
                        fixture = Fixture.query.filter_by(external_id=external_id).first()

                        if fixture:
                            fixture.title = title
                            fixture.location = metadata["location"]
                            fixture.event_date = dt
                            fixture.event_time = dt.time()
                            fixture.sport = metadata["sport"]
                            fixture.opposition = metadata["opposition"]
                            fixture.team = metadata["team"]
                            fixture.raw_content = content_html
                            fixture.last_updated = datetime.utcnow()
                            updated_count += 1
                        else:
                            new_fixture = Fixture(
                                external_id=external_id,
                                title=title,
                                location=metadata["location"],
                                event_date=dt,
                                event_time=dt.time(),
                                sport=metadata["sport"],
                                opposition=metadata["opposition"],
                                team=metadata["team"],
                                raw_content=content_html
                            )
                            db.session.add(new_fixture)
                            new_count += 1
                except IntegrityError:
                    db.session.rollback()
                    logger.info(f"Race condition: Entry {external_id} was inserted concurrently. Retrying as update.")
                    # Retry as update
                    fixture = Fixture.query.filter_by(external_id=external_id).first()
                    if fixture:
                        fixture.title = title
                        fixture.location = metadata["location"]
                        fixture.event_date = dt
                        fixture.event_time = dt.time()
                        fixture.sport = metadata["sport"]
                        fixture.opposition = metadata["opposition"]
                        fixture.team = metadata["team"]
                        fixture.raw_content = content_html
                        fixture.last_updated = datetime.utcnow()
                        updated_count += 1
                    else:
                        logger.error(f"Failed to retry update for {external_id} after IntegrityError")

            except Exception as e:
                logger.error(f"Error processing entry {external_id if external_id else 'unknown'}: {e}")
                continue

        db.session.commit()
        logger.info(f"Scrape complete. New: {new_count}, Updated: {updated_count}")
        return new_count, updated_count
