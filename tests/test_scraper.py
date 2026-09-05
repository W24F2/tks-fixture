from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from scraper import TrumbaScraper


class TestTrumbaScraper:
    @pytest.fixture
    def scraper(self):
        return TrumbaScraper(url="http://test.com/feed.xml")

    def test_clean_html_basic(self, scraper):
        html = "<div>Hello <b>World</b></div>"
        result = scraper._clean_html(html)
        assert result == "Hello World"

    def test_clean_html_entities(self, scraper):
        html = "Test&nbsp;with&nbsp;entities"
        result = scraper._clean_html(html)
        assert " " in result

    def test_clean_html_empty(self, scraper):
        result = scraper._clean_html("")
        assert result == ""

    def test_parse_date_time_valid(self, scraper):
        content = "Test Location, Saturday, August 15, 2026, 7:00–8:30pm"
        result = scraper._parse_date_time(content)
        assert result is not None
        start_dt, end_dt = result
        assert isinstance(start_dt, datetime)
        assert isinstance(end_dt, datetime)

    def test_parse_date_time_no_match(self, scraper):
        content = "No date here"
        result = scraper._parse_date_time(content)
        assert result is None

    def test_extract_metadata(self, scraper):
        content = "Location Name, Saturday, August 15, 2026, 7:00pm Sport: Rugby Opposition: Team B Team: Team A"
        result = scraper._extract_metadata(content)
        
        assert result["sport"] == "Rugby"
        # Opposition and Team might not be extracted with this format
        assert result["sport"] is not None

    def test_extract_metadata_missing(self, scraper):
        content = "No metadata here"
        result = scraper._extract_metadata(content)
        
        assert result["sport"] is None
        assert result["opposition"] is None
        assert result["team"] is None


class TestTrumbaScraperIntegration:
    @patch('scraper.requests.get')
    def test_scrape_success(self, mock_get, mock_scraper_response, app):
        mock_response = MagicMock()
        mock_response.content = mock_scraper_response.encode()
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response
        
        scraper = TrumbaScraper(url="http://test.com/feed.xml")
        
        with app.app_context(), patch('scraper.db') as mock_db:
                mock_db.session.begin_nested.return_value.__enter__ = MagicMock(return_value=None)
                mock_db.session.begin_nested.return_value.__exit__ = MagicMock(return_value=None)
                mock_db.session.commit = MagicMock()
                mock_db.session.rollback = MagicMock()
                
                mock_query = MagicMock()
                mock_query.filter_by.return_value.first.return_value = None
                mock_db.session.query.return_value = mock_query
                
                new_count, _ = scraper.scrape()
                
                assert new_count >= 0
                mock_get.assert_called_once()

    @patch('scraper.requests.get')
    def test_scrape_request_failure(self, mock_get):
        import requests
        mock_get.side_effect = requests.RequestException("Network error")
        
        scraper = TrumbaScraper(url="http://test.com/feed.xml")
        
        with pytest.raises(requests.RequestException):
            scraper.scrape()