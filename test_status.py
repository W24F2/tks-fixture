import zoneinfo
from datetime import datetime, timezone, timedelta, time

# Mocking the Fixture class
class MockFixture:
    def __init__(self, event_date, event_time=None, event_end_time=None):
        self.event_date = event_date
        self.event_time = event_time
        self.event_end_time = event_end_time

    def to_dict(self):
        status = "Scheduled"
        if self.event_date:
            try:
                sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
            except Exception:
                sydney_tz = timezone.utc

            now = datetime.now(sydney_tz)

            try:
                if self.event_time:
                    event_dt = datetime.combine(self.event_date.date(), self.event_time).replace(tzinfo=sydney_tz)
                else:
                    event_dt = self.event_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=sydney_tz)

                if self.event_end_time:
                    event_end_dt = datetime.combine(self.event_date.date(), self.event_end_time).replace(tzinfo=sydney_tz)
                else:
                    event_end_dt = event_dt + timedelta(hours=2)

                print(f"DEBUG: now={now}")
                print(f"DEBUG: event_dt={event_dt}")
                print(f"DEBUG: event_end_dt={event_end_dt}")

                if now < event_dt:
                    status = "Scheduled"
                elif event_dt <= now <= event_end_dt:
                    status = "Live"
                else:
                    status = "Finished"
            except Exception as e:
                print(f"[Error] Status calculation failed: {e}")
                status = "Scheduled"

        return {"status": status}

# Test cases
sydney_tz = zoneinfo.ZoneInfo("Australia/Sydney")
now = datetime.now(sydney_tz)

print("--- Case 1: Scheduled (Future) ---")
future_date = (now + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
f1 = MockFixture(future_date, time(10, 0))
print(f1.to_dict())

print("\n--- Case 2: Live (Now) ---")
# Set event_dt to now
f2 = MockFixture(now, now.time(), (now + timedelta(hours=1)).time())
print(f2.to_dict())

print("\n--- Case 3: Finished (Past) ---")
past_date = (now - timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
f3 = MockFixture(past_date, time(10, 0), time(11, 0))
print(f3.to_dict())

print("\n--- Case 4: No end time (Default 2h) ---")
# Start 1 hour ago, end time not provided. Should be Live.
start_time = now - timedelta(hours=1)
f4 = MockFixture(start_time, start_time.time())
print(f4.to_dict())

# Should be Finished if it started 3 hours ago.
start_time_old = now - timedelta(hours=3)
f5 = MockFixture(start_time_old, start_time_old.time())
print(f5.to_dict())
