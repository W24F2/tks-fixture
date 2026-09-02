---
name: investigation-plan
description: Plan to investigate why Scheduled fixtures are missing
metadata:
  type: project
---

# Investigation Plan: Missing "Scheduled" Fixtures

## Context
Users report that only "Finished" fixtures are being displayed on the dashboard. "Scheduled" fixtures are missing from the UI.

## Hypothesis
1.  **Backend Issue**: The `to_dict` method in `models.py` is incorrectly calculating the status as "Finished" for upcoming events.
2.  **Frontend Issue**: `static/app.js` is filtering out fixtures with status "Scheduled" during the rendering process.
3.  **Data Issue**: The scraper is not correctly populating `event_date` or `event_time`, causing status calculation to fail or default to an incorrect value.

## Execution Steps

### Phase 1: Backend Verification
- [ ] Inspect `models.py` `to_dict` logic carefully.
- [ ] Create a reproduction script `reproduce_issue.py` that simulates the `Fixture` object and checks the `to_dict` output.

### Phase 2: Frontend Verification
- [ ] Inspect `static/app.js` `renderAll` and `renderDashboard` functions for filtering logic.
- [ ] Verify how `activeFixtures` and `finishedFixtures` are separated.

### Phase 3: API Verification
- [ ] If possible, inspect the actual API response via a small script or by examining existing code that might log it.

## Expected Outcome
Identify whether the bug resides in the status calculation (backend) or the rendering/filtering logic (frontend), then provide a fix.
