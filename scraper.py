import logging
import os
import re
from datetime import datetime, timezone

import requests
from lxml import etree, html
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from models import Fixture, db

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
        except (etree.Error, AttributeError) as e:
            logger.debug(f"lxml cleaning failed, falling back to regex: {e}")
            # Fallback to regex-based cleaning
            clean_text = re.sub('<[^<]+?>', ' ', content_html)
            return ' '.join(clean_text.split())

    def _parse_date_time(self, content_html):
        """
        Parses the date and time from the Trumba HTML content block.
        """
        clean_text = self._clean_html(content_html)

        # 1. Find the date/time segment.
        # It usually looks like: "Saturday, August 15, 2026, 7–8:30am"
        # Regex: (Month) (Day), (Year), (Time Segment)
        date_time_pattern = r'([A-Z][a-z]+(?:, [A-Z][a-z]+)? \d{1,2}, \d{4}),\s*(.*)'
        match = re.search(date_time_pattern, clean_text)

        if not match:
            logger.warning(f"Could not find date/time pattern in text: {clean_text[:100]}...")
            return None

        date_part = match.group(1).strip()
        time_part = match.group(2).strip()

        # 2. Parse the time part.
        # Handle ranges like "7–8:30am" by taking both parts.
        time_parts = re.split(r'[–\-\—]', time_part)

        # We need both start and end times for accurate status.
        # time_parts[0] is start, time_parts[1] (if exists) is end.

        start_time_str = time_parts[0].strip()
        end_time_str = time_parts[1].strip() if len(time_parts) > 1 else None

        # Apply am/pm to both if not present
        def apply_suffix(t_str, full_part):
            if not re.search(r'[ap]m', t_str, re.IGNORECASE) and re.search(r'[ap]m', full_part, re.IGNORECASE):
                suffix_match = re.search(r'([ap]m)', full_part, re.IGNORECASE)
                if suffix_match:
                    return f"{t_str} {suffix_match.group(1)}"
            return t_str

        start_time_str = apply_suffix(start_time_str, time_part)
        if end_time_str:
            end_time_str = apply_suffix(end_time_str, time_part)

        # Normalize time segments: ensure space before am/pm (e.g., "7am" -> "7 am")
        start_time_str = re.sub(r'([ap]m)', r' \1', start_time_str, flags=re.IGNORECASE).strip()
        if end_time_str:
            end_time_str = re.sub(r'([ap]m)', r' \1', end_time_str, flags=re.IGNORECASE).strip()

        # If no colon is present (e.g., "7 am"), add ":00"
        def add_minutes(t_str):
            if ':' not in t_str:
                match_hour = re.search(r'(\d{1,2})', t_str)
                if match_hour:
                    hour = match_hour.group(1)
                    suffix = ""
                    if "am" in t_str.lower(): suffix = " AM"
                    elif "pm" in t_str.lower(): suffix = " PM"
                    return f"{hour}:00{suffix}"
            return t_str

        start_time_str = add_minutes(start_time_str)
        if end_time_str:
            end_time_str = add_minutes(end_time_str)

        def parse_to_datetime(d_part, t_part):
            if not t_part: return None
            # Normalize time segment: ensure space before am/pm (e.g., "7am" -> "7 am")
            t_part = re.sub(r'([ap]m)', r' \1', t_part, flags=re.IGNORECASE).strip()
            # If no colon is present (e.g., "7 am"), add ":00"
            if ':' not in t_part:
                match_hour = re.search(r'(\d{1,2})', t_part)
                if match_hour:
                    hour = match_hour.group(1)
                    suffix = ""
                    if "am" in t_part.lower(): suffix = " AM"
                    elif "pm" in t_part.lower(): suffix = " PM"
                    t_part = f"{hour}:00{suffix}"

            final_str = f"{d_part} {t_part}"
            final_str = ' '.join(final_str.split())
            formats = [
                "%A, %B %d, %Y %I:%M %p", # Saturday, August 15, 2026 7:00 AM
                "%B %d, %Y %I:%M %p",    # August 15, 2026 7:00 AM
                "%A, %B %d, %Y %I %p",   # Saturday, August 15, 2026 7 AM
                "%B %d, %Y %I %p",       # August 15, 2026 7 AM
                "%A, %B %d, %Y %H:%M",   # Saturday, August 15, 2026 19:00
                "%B %d, %Y %H:%M",       # August 15, 2026 19:00
                "%A, %B %d, %Y %I:%M%p",    # August 15, 2026 7:00AM
                "%A, %B %d, %Y %I%p",        # August 15, 2026 7AM
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(final_str, fmt)  # noqa: DTZ007
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
            return None

        start_dt = parse_to_datetime(date_part, start_time_str)
        if not start_dt:
            return None

        end_dt = None
        if end_time_str:
            end_dt = parse_to_datetime(date_part, end_time_str)

        return start_dt, end_dt

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

                dt_res = self._parse_date_time(content_html)
                if not dt_res:
                    logger.warning(f"Skipping entry {external_id}: Date parse failed")
                    continue

                start_dt, end_dt = dt_res

                metadata = self._extract_metadata(content_html)

                try:
                    with db.session.begin_nested():
                        fixture = Fixture.query.filter_by(external_id=external_id).first()

                        if fixture:
                            fixture.title = title
                            fixture.location = metadata["location"]
                            fixture.event_date = start_dt
                            fixture.event_time = start_dt.time()
                            if end_dt:
                                fixture.event_end_time = end_dt.time()
                            fixture.sport = metadata["sport"]
                            fixture.opposition = metadata["opposition"]
                            fixture.team = metadata["team"]
                            fixture.raw_content = content_html
                            fixture.last_updated = datetime.now(timezone.utc)
                            updated_count += 1
                        else:
                            new_fixture = Fixture(
                                external_id=external_id,
                                title=title,
                                location=metadata["location"],
                                event_date=start_dt,
                                event_time=start_dt.time(),
                                event_end_time=end_dt.time() if end_dt else None,
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
                        fixture.event_date = start_dt
                        fixture.event_time = start_dt.time()
                        if end_dt:
                            fixture.event_end_time = end_dt.time()
                        fixture.sport = metadata["sport"]
                        fixture.opposition = metadata["opposition"]
                        fixture.team = metadata["team"]
                        fixture.raw_content = content_html
                        fixture.last_updated = datetime.now(timezone.utc)
                        updated_count += 1
                    else:
                        logger.error(f"Failed to retry update for {external_id} after IntegrityError")

            except (SQLAlchemyError, ValueError, KeyError) as e:
                logger.error(f"Error processing entry {external_id if external_id else 'unknown'}: {e}")
                continue

        db.session.commit()
        logger.info(f"Scrape complete. New: {new_count}, Updated: {updated_count}")
        return new_count, updated_count
