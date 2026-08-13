# Plan: Frontend UI and UX Improvement

## Context
The current frontend is functional but lacks interactivity and advanced navigation features like searching or filtering. The user experience can be significantly improved by adding these capabilities and refining the visual presentation.

## Proposed Changes

### 1. Templates (`templates/index.html`)
- Add a **Search Bar** for fixture titles.
- Add **Sport Filters** (buttons or a dropdown) to filter the displayed list.
- Add a **Refresh Button** in the header or navbar to trigger a manual update.
- Add a **Toast Notification Container** for user feedback.

### 2. Styling (`static/style.css`)
- Design and implement styles for:
    - Search input (glassmorphism style).
    - Filter buttons (active/inactive states).
    - Refresh button (with loading state).
    - Toast notifications (entry/exit animations).
    - Refined `fixture-card` layout (better spacing, typography).
    - Enhanced `empty-state` design.

### 3. Client-side Logic (`static/app.js`)
- Implement **client-side filtering and searching** for immediate feedback.
- Implement the **manual refresh logic** that calls `/api/cron/refresh` and updates the DOM.
- Implement **Toast notification system**.
- Manage the **loading overlay** more effectively during refreshes.

### 4. Backend (`app.py`)
- (Optional) If client-side filtering becomes too heavy with many items, I will implement server-side filtering in the `/api/fixtures` endpoint. For now, I'll stick to client-side for speed and responsiveness.

## Verification Plan
- **Visual Check:** Verify all new UI elements (search, filters, toast, refresh) appear correctly and match the "Liquid Glass" theme.
- **Search Test:** Type in the search bar and ensure the fixture list filters correctly.
- **Filter Test:** Click on a sport filter and verify only matching fixtures are shown.
- **Refresh Test:** Click the refresh button, observe the loading overlay, and verify the UI updates after the API call.
- **Responsiveness:** Test on different browser widths to ensure the layout remains clean.
