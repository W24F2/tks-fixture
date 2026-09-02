# Fix Favourites Logic and Improve UI

## Context
The user reported that the favourites feature is buggy: a single favourite can interfere with other teams (likely due to loose name matching), and the overall frontend UI needs improvement.

**LATEST UPDATE**: The user wants to move the single star icon to the **top-right** of each fixture card and change the underlying logic from "favouriting a team" to "**favouriting a specific fixture**" (using `fixture_id`). This ensures that favouriting a match does not highlight every other match involving that team.

## Implementation Plan

### Phase 1: Refactor Favourites to Fixture-Based Logic

#### 1. Backend Improvements (`app.py` & `models.py`)
- **Update Model (`models.py`)**: Modify the `Favourite` model to store `fixture_id` (integer) instead of `team_name` (string).
- **Update Routes (`app.py`)**:
    - Refactor `add_favourite` to accept `fixture_id` in the JSON body.
    - Refactor `delete_favourite` to accept `fixture_id` via the URL path.
    - Ensure `get_favourites` returns a list of `fixture_id`s.

#### 2. Frontend Logic Fixes (`static/app.js`)
- **State Management**: Update `favourites` state to hold an array of `fixture_id`s.
- **Rendering Logic**:
    - Update `renderFixtureCard` to determine `isFav` by checking if `fixture.id` exists in the `favourites` list.
    - Update `getFavouriteGroups` to filter fixtures based on whether their `id` is in the `favourites` list.
- **Event Handling**:
    - Update the click event listener for `.fav-btn` to extract `fixture.id` from the card's dataset.
    - Update `toggleFavourite` to use `fixture_id` in the API calls.
- **Caching**: Ensure `localStorage` cache for favourites uses the new `fixture_id` structure.

### Phase 2: UI/UX Enhancements

#### 1. Visual Styling (`static/style.css`)
- **Star Positioning**: Move `.fav-btn` from `top: 1rem; left: 1rem;` to `top: 1rem; right: 1rem;`.
- **Favourites Section**: Add a subtle glowing border or background to the "Your Favourites" section to make it stand out as a special area.
- **Card Enhancements**: 
    - Improve the `fixture-teams` layout for better readability.
    - Add a smooth transition/scale effect for the star button.
- **Typography & Spacing**: Refine the `accent-header` and general spacing in the dashboard.

#### 2. Template Tweaks (`templates/index.html`)
- Ensure the structure supports the new CSS classes and improved layout.

## Critical Files to Modify
- `app.py`
- `models.py`
- `static/app.js`
- `static/style.css`
- `templates/index.html`

## Verification Plan
1. **Test Favourites**: 
    - Add a fixture to favourites.
    - Verify only that specific fixture is highlighted and appears in "Your Favourites".
    - Add another fixture.
    - Verify both appear.
    - Unfavourite a fixture and ensure it correctly removes only that fixture.
2. **Visual Audit**:
    - Check that the star icon is in the top-right corner.
    - Check responsiveness on desktop, tablet, and mobile.
    - Verify the "Favourites" section looks visually distinct and high-end.
    - Check star button animations and toast notifications.
