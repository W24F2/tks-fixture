import os
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta
try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo

db = SQLAlchemy()

class Fixture(db.Model):
    __tablename__ = 'fixtures'

    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255))
    event_date = db.Column(db.DateTime, nullable=False, index=True)
    event_time = db.Column(db.Time)
    event_end_time = db.Column(db.Time)
    sport = db.Column(db.String(100))
    opposition = db.Column(db.String(255))
    team = db.Column(db.String(100))
    raw_content = db.Column(db.Text)  # Store original HTML for fallback/debugging
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_fixtures_event_date', 'event_date'),
    )

    def to_dict(self):
        # Determine status based on current time in Sydney
        status = "Scheduled"
        if self.event_date:
            try:
                sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
            except Exception:
                # Fallback if zoneinfo fails
                sydney_tz = timezone.utc

            now = datetime.now(sydney_tz)

            # Combine date and time for comparison
            # We assume the event_date/time stored in DB are in Sydney time
            try:
                if self.event_time:
                    event_dt = datetime.combine(self.event_date.date(), self.event_time).replace(tzinfo=sydney_tz)
                else:
                    event_dt = self.event_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=sydney_tz)

                # Use event_end_time if available, otherwise fall back to 2 hours after start
                if self.event_end_time:
                    event_end_dt = datetime.combine(self.event_date.date(), self.event_end_time).replace(tzinfo=sydney_tz)
                else:
                    event_end_dt = event_dt + timedelta(hours=2)

                if now < event_dt:
                    status = "Scheduled"
                elif event_dt <= now <= event_end_dt:
                    status = "Live"
                else:
                    status = "Finished"
            except Exception as e:
                print(f"[Error] Status calculation failed: {e}")
                status = "Scheduled"

        return {
            "id": self.id,
            "external_id": self.external_id,
            "title": self.title,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "event_time": self.event_time.isoformat() if self.event_time else None,
            "event_end_time": self.event_end_time.isoformat() if self.event_end_time else None,
            "sport": self.sport,
            "opposition": self.opposition,
            "team": self.team,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "status": status
        }

class Favourite(db.Model):
    __tablename__ = 'favourites'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(36), nullable=True)
    fixture_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('device_id', 'fixture_id', name='uix_device_fixture'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "fixture_id": self.fixture_id,
            "created_at": self.created_at.isoformat()
        }
