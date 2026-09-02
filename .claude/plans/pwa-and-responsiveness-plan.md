---
name: pwa-and-responsiveness-plan
description: Plan for implementing PWA features and ensuring mobile/desktop responsiveness.
metadata:
  type: project
---

# PWA and Responsiveness Implementation Plan

## Context
The project currently has basic PWA structure (`manifest.json`, `sw.js`, service worker registration in `app.js`) and some responsive CSS. The goal is to fully implement PWA capabilities (making it installable and reliable offline) and ensure a seamless experience across mobile and desktop.

## Objectives
1.  **Full PWA Implementation**:
    *   Enhance `manifest.json` with additional metadata and icon configurations.
    *   Refine `sw.js` to handle service worker updates and caching more robustly.
    *   Ensure `base.html` contains all necessary meta tags for iOS and Android installation.
2.  **Responsive Optimization**:
    *   Review and improve the `navbar` layout for small screens.
    *   Optimize the `disclaimer-bar` to avoid overlapping interactive content on mobile.
    *   Ensure the search bar and fixture cards are well-spaced and legible on all device widths.

## Proposed Tasks

### Phase 1: PWA Strengthening
- [ ] **Enhance `static/manifest.json`**: Add `description`, `id`, `categories`, and ensure icons cover all required sizes.
- [ ] **Refine `static/sw.js`**: Implement a versioning mechanism to force updates when assets change and improve the fetch strategy if necessary.
- [ ] **Update `templates/base.html`**: Add iOS-specific meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, etc.).

### Phase 2: Responsive UI/UX
- [ ] **Optimize `navbar` in `static/style.css`**: Adjust layout for mobile (e.g., hide stats or simplify the navbar to prevent overflow).
- [ ] **Fix `disclaimer-bar` overlap**: Add padding to the bottom of `main.container` or adjust the bar's positioning/height for mobile.
- [ ] **Review `fixture-card` and `fixture-teams`**: Ensure text doesn't overflow or look cramped on very narrow screens.

## Verification Plan
- [ ] **PWA Audit**: Use Chrome DevTools 'Lighthouse' or 'Application' tab to verify 'Installability' and 'Service Worker' status.
- [ ] **Responsive Testing**: Use browser responsive mode (mobile emulation) to check different breakpoints (iPhone SE, iPad, Desktop).
- [ ] **Offline Test**: Toggle 'Offline' in DevTools and ensure cached content loads correctly.
