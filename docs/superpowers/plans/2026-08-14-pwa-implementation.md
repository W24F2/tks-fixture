# PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Flask web application into a production-ready Progressive Web App (PWA) compatible with Vercel.

**Architecture:** Use a standard web manifest (`manifest.json`) and a Service Worker (`sw.js`) to enable installation and offline caching of static assets.

**Tech Stack:** HTML5, JavaScript, Flask (for serving assets), Service Workers.

## Global Constraints

- Deployment: Vercel
- Manifest: Must be served with `application/manifest+json`
- Service Worker: Must be registered from the root scope to control all pages

---

### Task 1: Create Web Manifest

**Files:**
- Create: `static/manifest.json`

**Interfaces:**
- Consumes: App branding (name, short_name, colors)
- Produces: A manifest file that the browser uses to install the app.

- [ ] **Step 1: Write the manifest file**

```json
{
  "name": "Sports Fetcher",
  "short_name": "Sports",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/static/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/static/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Run test/Verify**
  - Check that `static/manifest.json` exists and is valid JSON.

- [ ] **Step 3: Commit**
```bash
git add static/manifest.json
git commit -m "feat: add web manifest for PWA"
```

---

### Task 2: Implement Service Worker

**Files:**
- Create: `static/sw.js`

**Interfaces:**
- Consumes: Static assets list (`/static/style.css`, `/static/app.js`, etc.)
- Produces: An active Service Worker that manages a cache.

- [ ] **Step 1: Write the service worker implementation**

```javascript
const CACHE_NAME = 'sports-fetcher-cache-v1';
const ASSETS = [
  '/',
  '/static/style.css',
  '/static/app.js',
  // Add other core assets here
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event (Cache First, falling back to network)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

- [ ] **Step 2: Commit**
```bash
git add static/sw.js
git commit -m "feat: add service worker for PWA"
```

---

### Task 3: Integrate PWA into Frontend

**Files:**
- Modify: `templates/base.html` (Needs to be created or identified)
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `manifest.json` and `sw.js`
- Produces: Registered Service Worker and linked Manifest.

- [ ] **Step 1: Identify or create `templates/base.html`**
  - Ensure it contains the `<link rel="manifest" href="/static/manifest.json">` and registration logic.

- [ ] **Step 2: Register Service Worker in `static/app.js`**

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js')
      .then(reg => console.log('SW registered!', reg))
      .catch(err => console.log('SW registration failed!', err));
  });
}
```

- [ ] **Step 3: Commit**
```bash
git add templates/base.html static/app.js
git commit -m "feat: integrate PWA into frontend"
```

---

### Task 4: Final Verification & Assets

**Files:**
- Create: `static/icons/icon-192x192.png`
- Create: `static/icons/icon-512x512.png`

- [ ] **Step 1: Provide placeholder icons** (Since I cannot generate images, I will use a placeholder script or instruct the user to add them).

- [ ] **Step 2: Verify PWA installation via Chrome DevTools (Lighthouse/Application tab)**

- [ ] **Step 3: Final Commit**

