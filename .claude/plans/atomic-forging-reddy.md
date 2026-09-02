# Implement "FINISHED" section in Frontend

## Context
The user wants to move finished matches into a dedicated section labeled "FINISHED - [date]". The backend and scraper are already prepared to provide `event_end_time` and the correct `status`.

## Implementation Plan

### 1. Update `static/app.js`

#### `renderAll`
- Split the `filtered` array into two sets based on `fixture.status`:
  - `activeFixtures`: `status !== 'Finished'`
  - `finishedFixtures`: `status === 'Finished'`
- Generate `activeGroups` and `finishedGroups` using the existing `groupFixturesByDate` function.
- Call `renderDashboard` with the new arguments: `favouriteGroups`, `activeGroups`, `finishedGroups`, and `allFixtures.length > 0`.

#### `renderDashboard`
- Update signature to: `renderDashboard(favouriteGroups, activeGroups, finishedGroups, hasFixtures)`.
- **Section 1: Favourites** (unchanged logic).
- **Section 2: Active Matches**
  - Iterate `activeGroups` and render them using standard date headers.
- **Section 3: Finished Matches**
  - Iterate `finishedGroups` and render them with a header prefixed with `FINISHED - ` (e.g., `FINISHED - Saturday, August 15, 2026`).
  - Use `accent-header` for the finished section to make it distinct and "better".
- **Empty States**:
  - If all groups (favourites, active, finished) are empty:
    - If `hasFixtures` is true: show "No matches found for your search."
    - If `hasFixtures` is false: show "No fixtures available at the moment."

## Critical Files
- `static/app.js`

## Verification Plan
1. **Live Test**: Verify that matches with status "Live" or "Scheduled" appear in the standard date sections.
2. **Finished Test**: Verify that matches with status "Finished" appear in the "FINISHED - [date]" section.
3. **Search Test**: Search for a finished match and ensure it appears in the "FINISHED" section.
4. **Empty State Test**: Clear search or simulate empty DB to verify the correct empty message appears.
