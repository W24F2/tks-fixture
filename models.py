import os
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class Fixture(db.Model):
    __tablename__ = 'fixtures'

    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255))
    event_date = db.Column(db.DateTime, nullable=False)
    event_time = db.Column(db.Time)
    sport = db.Column(db.String(100))
    opposition = db.Column(db.String(255))
    team = db.Column(db.String(100))
    raw_content = db.Column(db.Text)  # Store original HTML for fallback/debugging
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "external_id": self.external_id,
            "title": self.title,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "event_time": self.event_time.isoformat() if self.event_time else None,
            "sport": self.sport,
            "opposition": self.opposition,
            "team": self.team,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None
        }
