# Favourites Feature Design Specification

**Date**: 2026-08-14
**Status**: Draft
**Author**: Claude

## 1. Overview
This feature allows users to "follow" specific sports teams. Favourited teams will be highlighted, and a dedicated "Your Favourites" section will appear at the top of the fixture list, providing quick access to matches involving those teams.

To ensure persistence on Vercel without a full user account system, we will use a **Device ID** approach. A unique identifier will be stored in the user's `localStorage` and sent to the backend with every request related to favourites.

## 2. Architecture & Data Flow

### 2.1 Data Model (`models.py`)
A new SQLAlchemy model `Favourite` will be added to the database.

| Field | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Primary key |
| `device_id` | String(36) | Unique identifier (UUID) from client `localStorage` |
| `team_name` | String(100) | The name of the team being followed |
| `created_at` | DateTime | Timestamp of when the team was added |

**Constraints**: A combination of `device_id` and `team_name` must be unique to prevent duplicate entries for the same team on one device.

### 2.2 API Endpoints (`app.py`)

| Method | Endpoint | Description | Payload |
|---|---|---|---|
| `GET` | `/api/favourites/<device_id>` | Fetch all favourited teams for a device | N/A |
| `POST` | `/api/favourites` | Add a new team to favourites | `{ "device_id": "...", "team_name": "..." }` |
| `DELETE` | `/api/favourites/<device_id>/<team_name>` | Remove a team from favourites | N/A |

### 2.3 Frontend Logic (`static/app.js`)

**Device ID Management**:
- On startup, check `localStorage.getItem('sf_device_id')`.
- If null, generate a new UUID and save it: `localStorage.setItem('sf_device_id', uuid)`.

**Rendering Flow**:
1. Fetch all fixtures via `/api/fixtures`.
2. Fetch favourited teams via `/api/favourites/<device_id>`.
3. **Filtering**: Identify all fixtures where `fixture.team` OR `fixture.opposition` is in the `favourites` list.
4. **Grouping**:
    - Create a special `favourites_group` containing these matches.
    - Group the remaining fixtures by date as currently implemented.
5. **DOM Injection**:
    - If `favourites_group` is not empty, render it first with a special header: `<h2 class="date-header accent-header">Your Favourites</h2>`.
    - Follow with the standard date-based sections.

**User Interaction**:
- Each fixture card will feature a "star" icon.
- If the team is already a favourite, the star is filled (using Lucide `star` icon).
- Clicking a star toggles the favourite status via the API and updates the local state/UI.

## 3. UI/UX Design

### 3.1 Visual Identity
- **The "Favourites" Header**: To differentiate "Your Favourites" from standard date headers, we will use a gradient text effect:
  ```css
  .accent-header {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
  }
  ```
- **Star Icon**: Use Lucide `star` for unselected and `star` (filled) for selected.

### 3.2 Layout
- The "Your Favourites" section will use the same `.fixtures-container` grid as other sections to maintain layout consistency.

## 4. Error Handling & Edge Cases
- **API Failure**: If the favourites API fails, the app will fallback to showing only standard date-based fixtures and show a toast notification.
- **Empty Favourites**: If no teams are favourited, the special section will not be rendered.
- **Team Name Mismatch**: We will use exact string matching. (Note: Future improvement could involve case-insensitive or fuzzy matching).

## 5. Implementation Roadmap
1. Update `models.py` and run migrations (or recreate DB for dev).
2. Implement API endpoints in `app.py`.
3. Update `app.js` to handle Device ID, fetching favourites, and the new rendering logic.
4. Add CSS for `.accent-header`.
5. Update `index.html` (if necessary) to support new icon states.
