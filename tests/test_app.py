from datetime import datetime, time, timezone
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

    def test_get_favourites_empty(self, client):
        response = client.get('/api/favourites/test-device')
        assert response.status_code == 200
        assert response.json == []

    def test_add_favourite(self, client, app):
        from models import Fixture, db

        with app.app_context():
            fixture = Fixture(
                external_id="test-fav-1",
                title="Test Fixture",
                location="Test",
                event_date=datetime(2026, 8, 15, 19, 0, tzinfo=timezone.utc),
                event_time=time(19, 0)
            )
            db.session.add(fixture)
            db.session.commit()
            fixture_id = fixture.id

        response = client.post('/api/favourites', json={
            'device_id': 'test-device',
            'fixture_id': fixture_id
        })
        assert response.status_code == 201
        assert response.json['fixture_id'] == fixture_id
        assert 'id' in response.json
        assert 'fixture' in response.json
        assert 'created_at' in response.json
        assert response.json['device_id'] == 'test-device'

    def test_add_favourite_duplicate(self, client, app):
        from models import Favourite, Fixture, db

        with app.app_context():
            fixture = Fixture(
                external_id="test-fav-2",
                title="Test Fixture 2",
                location="Test",
                event_date=datetime(2026, 8, 15, 19, 0, tzinfo=timezone.utc),
                event_time=time(19, 0)
            )
            db.session.add(fixture)
            db.session.commit()

            fav = Favourite(fixture_id=fixture.id, device_id="test-device")
            db.session.add(fav)
            db.session.commit()
            fixture_id = fixture.id

        response = client.post('/api/favourites', json={
            'device_id': 'test-device',
            'fixture_id': fixture_id
        })
        assert response.status_code == 200
        assert response.json['fixture_id'] == fixture_id
        assert 'id' in response.json
        assert 'fixture' in response.json
        assert 'created_at' in response.json

    def test_delete_favourite(self, client, app):
        from models import Favourite, Fixture, db

        with app.app_context():
            fixture = Fixture(
                external_id="test-fav-3",
                title="Test Fixture 3",
                location="Test",
                event_date=datetime(2026, 8, 15, 19, 0, tzinfo=timezone.utc),
                event_time=time(19, 0)
            )
            db.session.add(fixture)
            db.session.commit()

            fav = Favourite(fixture_id=fixture.id, device_id="test-device")
            db.session.add(fav)
            db.session.commit()
            fixture_id = fixture.id

        response = client.delete(f'/api/favourites/test-device/{fixture_id}')
        assert response.status_code == 200
        assert response.json['status'] == 'success'

    def test_delete_favourite_not_found(self, client):
        response = client.delete('/api/favourites/test-device/99999')
        assert response.status_code == 404

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