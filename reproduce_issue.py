import re
from lxml import html
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TrumbaScraper:
    def __init__(self, url=None):
        self.url = url
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
        print(f"DEBUG: clean_text = '{clean_text}'")

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
        print(f"DEBUG: date_part = '{date_part}'")
        print(f"DEBUG: time_part = '{time_part}'")

        # 2. Parse the time part.
        # Handle ranges like "7–8:30am" by taking the first part.
        time_segment = re.split(r'[–\-\—]', time_part)[0].strip()
        print(f"DEBUG: time_segment (after split) = '{time_segment}'")

        # BUG FIX: If the time_segment (e.g. "7") doesn't have am/pm,
        # but the whole time_part (e.g. "7-8:30pm") does,
        # we should apply the am/pm to the time_segment.
        if not re.search(r'[ap]m', time_segment, re.IGNORECASE) and re.search(r'[ap]m', time_part, re.IGNORECASE):
            suffix_match = re.search(r'([ap]m)', time_part, re.IGNORECASE)
            if suffix_match:
                time_segment = f"{time_segment} {suffix_match.group(1)}"
        
        print(f"DEBUG: time_segment (after am/pm check) = '{time_segment}'")

        # Normalize time segment: ensure space before am/pm (e.g., "7am" -> "7 am")
        time_segment = re.sub(r'([ap]m)', r' \1', time_segment, flags=re.IGNORECASE).strip()
        print(f"DEBUG: time_segment (after normalization) = '{time_segment}'")

        # If no colon is present (e.g., "7 am"), add ":00"
        if ':' not in time_segment:
            match_hour = re.search(r'(\d{1,2})', time_segment)
            if match_hour:
                hour = match_hour.group(1)
                suffix = ""
                if "am" in time_segment.lower(): suffix = " AM"
                elif "pm" in time_segment.lower(): suffix = " PM"
                time_segment = f"{hour}:00{suffix}"
        
        print(f"DEBUG: time_segment (after colon check) = '{time_segment}'")

        try:
            final_str = f"{date_part} {time_segment}"
            # Clean up any extra whitespace
            final_str = ' '.join(final_str.split())
            print(f"DEBUG: final_str = '{final_str}'")

            # 3. Try various datetime formats to match the cleaned string
            formats = [
                "%A, %B %d, %Y %I:%M %p", # Saturday, August 15, 2026 7:00 AM
                "%B %d, %Y %I:%M %p",    # August 15, 2026 7:00 AM
                "%A, %B %d, %Y %I %p",   # Saturday, August 15, 2026 7 AM
                "%B %d, %Y %I %p",       # August 15, 2026 7 AM
                "%A, %B %d, %Y %H:%M",   # Saturday, August 15, 2026 19:00
                "%B %d, %Y %H:%M",       # August 15, 2026 19:00
                "%B %d, %Y %I:%M%p",    # August 15, 2026 7:00AM
                "%B %d, %Y %I%p",        # August 15, 2026 7AM
            ]

            for fmt in formats:
                try:
                    dt = datetime.strptime(final_str, fmt)
                    print(f"DEBUG: Matched format '{fmt}' -> {dt}")
                    return dt
                except ValueError:
                    continue

            logger.warning(f"Failed to parse datetime string: '{final_str}' using available formats.")
            return None
        except Exception as e:
            logger.error(f"Datetime error: {e}")
            return None

if __name__ == "__main__":
    sample_xml = 'WS Friend Gym <br/>Saturday, August 15, 2026, 7&nbsp;&ndash;&nbsp;8:30am <br/><br/><b>Sport</b>'
    scraper = TrumbaScraper()
    print(f"Testing with: {sample_xml}")
    result = scraper._parse_date_time(sample_xml)
    if result:
        print(f"SUCCESS: Parsed datetime is {result}")
    else:
        print("FAILURE: Could not parse datetime")
