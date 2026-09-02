# Implement Match Status Display

## Context
The user wants to replace the static "Scheduled" status on fixture cards with a dynamic status that indicates whether a match is "Scheduled", "In Progress", or "Finished".

## Implementation Plan

### 1. Backend / Model Update
- The `Fixture` model in `models.py` currently doesn't have a way to store or determine status beyond the `event_date` and `event_time`.
- **Option A**: Add a `status` column to the `Fixture` model (e.g., `scheduled`, `live`, `finished`). This would require updating the scraper to populate this field.
- **Option B**: Calculate status on-the-fly in the `to_dict` method or via a property based on the current time compared to `event_date` and `event_time`.
- **Decision**: For now, since I don't have control over the scraper's complexity in this turn, I will implement logic in `models.py` (via `to_dict`) or `app.py` that calculates the status based on the current time. This is safer and doesn't require a database migration immediately.

### 2. Frontend Update (`static/app.js`)
- Update the `renderFixtureCard` function to use the new status field instead of the hardcoded `Scheduled` text.
- The status text will be passed from the API.

### 3. Styling (`static/style.css`)
- Add color variations for the status badge:
    - `Scheduled`: Default (e.g., neutral/muted)
    - `Live`: Green/Accent (to grab attention)
    - `Finished`: Gray/Muted

## Critical Files
- `models.py`: Add logic to determine status.
- `static/app.js`: Update `renderFixtureCard` to use the dynamic status.
- `static/style.css`: Add status-specific styles.

## Verification Plan
1. **Simulated Live Match**: Set a fixture's time to be current and verify it shows "Live".
2. **Simulated Finished Match**: Set a fixture's time to be in the past and verify it shows "Finished".
3. **Scheduled Match**: Set a fixture's time to the future and verify it shows "Scheduled".
