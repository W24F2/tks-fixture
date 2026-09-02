---
name: fix-github-icon-and-optimize-mobile-desktop
description: Fix the missing GitHub icon and improve responsiveness for mobile and desktop screens.
metadata:
  type: project
---

# Context
The user reported that the GitHub icon is not displaying and the website has layout issues on mobile and desktop (incorrect width, weirdly positioned elements).

# Goals
1. Fix the GitHub icon visibility issue.
2. Optimize the layout for mobile (correct width, responsive elements).
3. Optimize the layout for desktop (consistent and clean design).

# Implementation Plan

## Phase 1: Investigation
- [ ] Search for where the GitHub icon is used in the HTML/templates.
- [ ] Check the CSS for icon styling or visibility issues.
- [ ] Inspect the current responsive design implementation (media queries, viewport meta tag).
- [ ] Check for any missing assets or incorrect file paths for icons.

## Phase 2: Fix GitHub Icon
- [ ] Locate the broken icon reference.
- [ ] Fix the path or implement a reliable icon solution (e.g., FontAwesome, SVG, or local asset).
- [ ] Verify the icon displays correctly.

## Phase 3: Responsive Optimization
- [ ] Verify the `<meta name="viewport">` tag is correctly set in `templates/index.html`.
- [ ] Identify elements causing layout breaks on mobile.
- [ ] Update `static/style.css` with appropriate media queries to:
    - Fix mobile width issues.
    - Adjust element positioning/sizing for mobile vs. desktop.
    - Improve general responsiveness.
- [ ] Test and refine the layout.

## Phase 4: Verification
- [ ] Confirm the GitHub icon is visible.
- [ ] Verify responsiveness on simulated mobile and desktop views.
