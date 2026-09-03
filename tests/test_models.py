from datetime import datetime, time, timezone

from models import Favourite, Fixture


class TestFixture:
    def test_fixture_creation(self):
        fixture = Fixture(
            external_id="test-123",
            title="Test Match",
            location="Test Stadium",
            event_date=datetime(2026, 8, 15, 19, 0, tzinfo=timezone.utc),
            event_time=time(19, 0),
            sport="Rugby",
            opposition="Team B",
            team="Team A"
        )
        
        assert fixture.external_id == "test-123"
        assert fixture.title == "Test Match"
        assert fixture.location == "Test Stadium"
        assert fixture.sport == "Rugby"

    def test_fixture_to_dict(self):
        fixture = Fixture(
            external_id="test-123",
            title="Test Match",
            location="Test Stadium",
            event_date=datetime(2026, 8, 15, 19, 0, tzinfo=timezone.utc),
            event_time=time(19, 0),
            event_end_time=time(21, 0),
            sport="Rugby",
            opposition="Team B",
            team="Team A"
        )
        
        result = fixture.to_dict()
        
        assert result["id"] is None
        assert result["external_id"] == "test-123"
        assert result["title"] == "Test Match"
        assert result["sport"] == "Rugby"
        assert result["status"] in ["Scheduled", "Live", "Finished"]


class TestFavourite:
    def test_favourite_creation(self):
        fav = Favourite(
            device_id="device-123",
            fixture_id=1
        )
        
        assert fav.device_id == "device-123"
        assert fav.fixture_id == 1

    def test_favourite_to_dict(self):
        from datetime import datetime, timezone
        fav = Favourite(
            id=1,
            device_id="device-123",
            fixture_id=42,
            created_at=datetime.now(timezone.utc)
        )
        
        result = fav.to_dict()
        
        assert result["id"] == 1
        assert result["device_id"] == "device-123"
        assert result["fixture_id"] == 42
        assert "created_at" in result