from unittest.mock import MagicMock, patch


class TestAppEndpoints:
    def test_health_check(self, client):
        response = client.get('/api/health')
        assert response.status_code == 200
        assert response.json['status'] == 'healthy'

    def test_get_fixtures_empty(self, client):
        response = client.get('/api/fixtures')
        assert response.status_code == 200
        assert response.json == []

    @patch('app.TrumbaScraper')
    def test_refresh_fixtures(self, mock_scraper_class, client):
        mock_scraper = MagicMock()
        # The real method is `scrape()` and returns (new_count, updated_count).
        mock_scraper.scrape.return_value = (5, 2)
        mock_scraper_class.return_value = mock_scraper

        response = client.post('/api/fixtures/refresh')
        assert response.status_code == 200
        assert response.json['new'] == 5
        assert response.json['updated'] == 2
        assert 'Refreshed fixtures' in response.json['message']

    @patch('app.TrumbaScraper')
    def test_refresh_fixtures_error(self, mock_scraper_class, client):
        import requests
        mock_scraper = MagicMock()
        mock_scraper.scrape.side_effect = requests.RequestException("Scrape failed")
        mock_scraper_class.return_value = mock_scraper

        response = client.post('/api/fixtures/refresh')
        assert response.status_code == 500

    @patch('app.TrumbaScraper')
    def test_refresh_fixtures_is_debounced(self, mock_scraper_class, client):
        """A second refresh inside the cooldown must not hit the upstream feed."""
        mock_scraper = MagicMock()
        mock_scraper.scrape.return_value = (3, 1)
        mock_scraper_class.return_value = mock_scraper

        first = client.post('/api/fixtures/refresh')
        assert first.status_code == 200
        assert first.json['new'] == 3

        second = client.post('/api/fixtures/refresh')
        assert second.status_code == 200
        assert second.json['message'] == 'Data is up to date'
        # The upstream scraper was only contacted once.
        assert mock_scraper.scrape.call_count == 1

    def test_404_error_handler(self, client):
        response = client.get('/api/nonexistent')
        assert response.status_code == 404
        assert response.json['error'] == 'Not found'