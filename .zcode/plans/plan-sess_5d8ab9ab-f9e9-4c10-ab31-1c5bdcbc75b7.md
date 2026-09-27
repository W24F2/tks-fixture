Optimization pass across backend, frontend, bundle, and dead code. Organized by impact; each phase independently verifiable.

## Phase 1 — Backend request path (highest server impact)

1. **Memoize `/api/fixtures`** (app.py:156-183): cache `(payload_string, etag)` keyed on `(COUNT(*), MAX(last_updated), minute-bucket-of-now)`. The minute bucket is required because `to_dict` computes live/upcoming status from wall-clock time. On an unchanged key, serve the cached string (or 304) with zero table load/serialization. Build 200s from the cached `json.dumps` string via `Response(payload, mimetype="application/json")` instead of `jsonify(data)` — kills the double serialization. Safe because `last_updated` has `onupdate=utcnow`, so any row change bumps the key.
2. **models.py**: hoist `ZoneInfo("Australia/Sydney")` to a module-level constant (currently constructed per row per request); add optional `now` parameter to `to_dict()` so the route computes "now" once; replace `print` with `logging` (models.py:63).
3. **Cache the Vite manifest** (app.py:35-44): read once and invalidate by file mtime instead of per-request disk reads.
4. **Cross-process refresh debounce** (app.py:247-261): replace the module-global `_LAST_REFRESH` with a DB staleness check — skip scraping if `MAX(last_updated)` is under 60s old. Correct under multiple Gunicorn workers.
5. **Small fixes**: append to (not overwrite) the `Vary` header (app.py:125); raise the default rate limit from 200/day (a single page load burns ~5 requests; school NATs share IPs) to ~2000/day, keep 50/min; make `/api/health` do a cheap `SELECT 1` DB ping.
6. **SQLite WAL**: enable `journal_mode=WAL` + `busy_timeout` via a SQLAlchemy connect event when the backend is SQLite (database.py) — multiple gunicorn workers + scraper process currently risk "database is locked".

## Phase 2 — Frontend runtime

1. **timezone.ts**: hoist the `Intl.DateTimeFormat` to a module-level constant; `getFixtureStatusInSydney(fixture, now?)` takes an optional shared "now"; use `event_end_time` when present (currently ignored despite the comment claiming support — models.py:81 already sends it; keep the 3h fallback).
2. **App.tsx**: compute `now = getSydneyNow()` once per `mergedFixtures` pass (replacing the dead `new Date()` at line 71) and pass it down; precompute sort keys in the map step instead of `new Date(...)` parsing inside the comparator (lines 88-90); delete the `setFixtures(prev => [...prev])` invalidation hack (line 46 — `favouriteIds` is already a memo dep); collapse the 3 count filters (lines 181-184) into one pass; compute `pastGroups` only when `filter === "all"`; drop unused imports (`clearCache`, `isFavourite`).
3. **Card re-render scope**: reuse the previous merged fixture object (by id) when its derived fields (`is_favourite`/`status`/`is_new`) are unchanged, and wrap `FixtureCard` in `React.memo` with a comparator that ignores `index` (index shifts on favourites-first resort; it only feeds the one-time entrance stagger delay). Net effect: toggling a favourite re-renders ~1 card instead of all.
4. **api.ts**: delete the redundant favourites re-sort in `groupFixturesWithFavouritesFirst` (lines 108-112 — the input is already favourites-first/date-sorted from `mergedFixtures`); remove unused exports `formatTime`, `healthCheck`, `getAuthHeaders`.
5. **FixtureCard.tsx**: replace the infinite `animate-ping` on the favourite star (lines 152-154) with a bounded ~3-iteration pulse defined in `index.css` (with a `prefers-reduced-motion` guard) — stops permanent compositor work per favourited card.

## Phase 3 — Bundle & assets

1. **Lazy-load `LegalNotice`** via `React.lazy` + Suspense (355 lines of static legal text; only rendered on the first-visit gate or footer review).
2. **Split vendor chunks** in `vite.config.ts` via `manualChunks` (react/react-dom, framer-motion) for long-term caching. Target: meaningful drop from the single 380 KB chunk.
3. **Favicon**: run the 62 KB `FS.svg` through SVGO; keep the copies in sync; fix `manifest.json` icon paths so they resolve consistently in dev and prod.
4. **Fonts**: audit which of the 8 weights are actually used; self-host via `@fontsource/inter` + `@fontsource/space-grotesk` (subset to used weights) and drop the Google Fonts links from `index.html` and `templates/spa.html` — removes two third-party round trips.
5. **Delete unused frontend files/exports**: `ui/Tooltip.tsx`, `ui/Separator.tsx`, `tailwind.config.js` (unused under Tailwind v4 CSS-first config — verify postcss setup first), unused `motion.ts` variants, unused `Card.tsx` sub-exports.

## Phase 4 — Scraper & reliability

1. **Fix the circular import** (scraper_worker.py:23): `from app import create_app` → `from database import create_app` — `create_app` lives in database.py; the current import re-executes the entire app module whenever `app.py __main__` imports the worker (double app construction).
2. **scraper.py**: use a `requests.Session` with `HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=[502,503,504]))`; convert the per-entry SELECT + savepoint upsert into a bulk upsert (one query preloading `external_id → Fixture`, update in memory, single commit) — also removes the duplicated IntegrityError retry block; deduplicate the two time-normalization helpers; parse XML with a hardened parser (`resolve_entities=False, no_network=True`).
3. **Logging**: replace remaining `print()` in `app.py` with `logging` for consistency.

## Phase 5 — Dead code & hygiene

1. Remove unused Flask-Caching setup (app.py:47-54) and drop `flask-caching` + `redis` from requirements.txt (rate limiter stays, memory-backed).
2. Delete legacy templates: `base.html`, `index.html`, `404.html`, `rate_limit.html` (only `spa.html` is ever rendered).
3. Delete `.github/workflows/deploy.yml` — it races `ci-cd.yml` on every push to main and restarts services (`fixtures`, `fixtures-dev`) that don't exist (the real unit is `fixtures-app`).
4. Remove `CRON_SECRET` references (written to server `.env` in CI but never read by any code).
5. **Remove the server-side favourites API** (3 endpoints, `Favourite` model, `FavouriteResponse` type, `device.ts`) — the frontend is localStorage-only and never calls it; this also eliminates its N+1 query problem. *Judgment call: if you want to keep the API for future use, I'll fix its N+1 with `selectinload` instead — say so before/at implementation.*
6. **Service worker**: `static/sw.js` is never registered and its precache list references deleted files. Replace with a ~30-line runtime-only SW (stale-while-revalidate for `/api/`, cache-first for immutable `/static/dist/`, no precache) and register it in `main.tsx` — makes the existing PWA claim in the README true and adds offline resilience.
7. README accuracy: APScheduler → systemd timer, drop the date-fns mention, align the Python version with CI (3.11).
8. Add minimum version bounds to requirements.txt deps.

## Verification

- Backend: `ruff check .`, `pytest` (29 existing tests), then a smoke run — start `python app.py`, `curl /api/fixtures` twice (expect 200 then 304 with a fresh ETag only when data/time bucket changes), `POST /api/fixtures/refresh` twice (expect debounce on second), `/api/health` shows DB check.
- Frontend: `npm run build` (tsc + vite), `oxlint`, compare dist chunk sizes before/after; browser smoke test — load page, toggle favourites (verify only affected card re-renders), first-visit legal gate, refresh flow.
- All changes verified locally; deployment config changes (deploy.yml removal) noted in the final summary since they take effect on next push.

Notes/out of scope: no fixture purging (the Past Matches tab implies history is wanted); no list virtualization (school-scale data); no auto-polling (feature, not optimization — can add visibility-gated polling later if wanted).