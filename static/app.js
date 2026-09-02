/**
 * Sports Fetcher - Frontend Logic
 * Handles: Data fetching, rendering, search, filtering, and favourites.
 */

// --- Configuration & State ---

const API_BASE = '/api';
let allFixtures = [];
let favourites = [];
let deviceId = null;

// --- Caching Helpers ---
const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes
const FAVOURITES_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function setCache(key, data, expiry = CACHE_EXPIRY) {
    const cacheData = {
        timestamp: Date.now(),
        data: data
    };
    localStorage.setItem(`sf_cache_${key}`, JSON.stringify(cacheData));
}

function getCache(key, expiry = CACHE_EXPIRY) {
    const cached = localStorage.getItem(`sf_cache_${key}`);
    if (!cached) return null;

    try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > expiry) {
            localStorage.removeItem(`sf_cache_${key}`);
            return null;
        }
        return data;
    } catch (e) {
        console.error('[Error] Parsing cache:', e);
        return null;
    }
}

// --- Initialization ---

async function initializeApp() {
    console.log('[DEBUG] initializeApp() called');
    console.log('[DEBUG] document.readyState:', document.readyState);

    try {
        console.log('[DEBUG] Calling initDeviceId()');
        await initDeviceId();
        console.log('[DEBUG] initDeviceId() done, deviceId:', deviceId);

        console.log('[DEBUG] Calling fetchFavourites()');
        await fetchFavourites();
        console.log('[DEBUG] fetchFavourites() done, favourites:', favourites);

        console.log('[DEBUG] Calling fetchFixtures()');
        await fetchFixtures();
        console.log('[DEBUG] fetchFixtures() done, allFixtures length:', allFixtures.length);

        console.log('[DEBUG] Calling setupEventListeners()');
        setupEventListeners();
        console.log('[DEBUG] setupEventListeners() done');

        console.log('[DEBUG] Calling renderAll()');
        renderAll();
        console.log('[DEBUG] renderAll() done');

        // Register Service Worker for PWA support
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/static/sw.js')
                    .then(reg => console.log('SW registered!', reg))
                    .catch(err => console.log('SW registration failed!', err));
            });
        }
    } catch (e) {
        console.error('[FATAL] initializeApp() crashed:', e);
        showToast('App initialization failed: ' + e.message, 'error');
    }
}

// Run on DOMContentLoaded, or immediately if DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

/**
 * Ensures a unique device ID exists in localStorage.
 */
async function initDeviceId() {
    deviceId = localStorage.getItem('sf_device_id');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('sf_device_id', deviceId);
        console.log(`[System] Generated new Device ID: ${deviceId}`);
    } else {
        console.log(`[System] Using existing Device ID: ${deviceId}`);
    }
}

/**
 * Fetches all fixtures from the backend, using cache if available.
 */
async function fetchFixtures() {
    console.log('[DEBUG] fetchFixtures() started');
    const cached = getCache('fixtures');
    if (cached) {
        console.log('[DEBUG] Loading fixtures from cache, count:', cached.length);
        allFixtures = cached;
        updateStats();
        return;
    }

    showLoading(true);
    try {
        console.log('[DEBUG] Fetching from API: /api/fixtures');
        const response = await fetch(`${API_BASE}/fixtures`);
        console.log('[DEBUG] API response status:', response.status);
        if (!response.ok) throw new Error('Failed to fetch fixtures: ' + response.status);
        allFixtures = await response.json();
        console.log('[DEBUG] Got fixtures from API, count:', allFixtures.length);
        console.log('[DEBUG] First fixture:', allFixtures[0]);
        setCache('fixtures', allFixtures);
        updateStats();
    } catch (error) {
        console.error('[ERROR] Fetching fixtures:', error);
        showToast('Failed to load fixtures.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Fetches favourited fixtures for the current device, using cache if available.
 */
async function fetchFavourites(bypassCache = false) {
    if (!deviceId) return;

    if (!bypassCache) {
        const cached = getCache(`favourites_${deviceId}`, FAVOURITES_CACHE_EXPIRY);
        if (cached) {
            console.log('[System] Loading favourites from cache');
            favourites = cached;
            return;
        }
    }

    try {
        const response = await fetch(`${API_BASE}/favourites/${deviceId}`);
        if (!response.ok) throw new Error('Failed to fetch favourites');
        favourites = await response.json();
        setCache(`favourites_${deviceId}`, favourites, FAVOURITES_CACHE_EXPIRY);
        console.log('[System] Favourites loaded:', favourites);
    } catch (error) {
        console.error('[Error] Fetching favourites:', error);
        showToast('Failed to load favourites.', 'warning');
    }
}

// --- Core Rendering Logic ---

/**
 * Orchestrates the complete rendering of the dashboard.
 */
function renderAll() {
    console.log('[DEBUG] renderAll() called, allFixtures length:', allFixtures.length);
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Filter fixtures based on search term
    const filtered = allFixtures.filter(f => {
        const team = (f.team || '').toLowerCase();
        const opposition = (f.opposition || '').toLowerCase();
        const title = (f.title || '').toLowerCase();
        const matchTeam = team.includes(searchTerm) || opposition.includes(searchTerm);
        const matchTitle = title.includes(searchTerm);
        return matchTeam || matchTitle;
    });
    console.log('[DEBUG] Filtered fixtures count:', filtered.length);

    // Split into active and finished fixtures
    const activeFixtures = filtered.filter(f => f.status !== 'Finished');
    const finishedFixtures = filtered.filter(f => f.status === 'Finished');
    console.log('[DEBUG] Active:', activeFixtures.length, 'Finished:', finishedFixtures.length);

    // Group by date for rendering
    const activeGroups = groupFixturesByDate(activeFixtures);
    const finishedGroups = groupFixturesByDate(finishedFixtures);

    // Get favourites group
    const favouriteGroups = getFavouriteGroups(filtered);

    console.log('[DEBUG] Calling renderDashboard with:', {
        favouriteGroups: favouriteGroups.length,
        activeGroups: activeGroups.length,
        finishedGroups: finishedGroups.length,
        hasFixtures: allFixtures.length > 0
    });
    renderDashboard(favouriteGroups, activeGroups, finishedGroups, allFixtures.length > 0);
}

/**
 * Groups an array of fixtures by their event date.
 */
function groupFixturesByDate(fixtures) {
    const map = new Map();

    // Sort by date and time first
    const sorted = [...fixtures].sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        return (a.event_time || '').localeCompare(b.event_time || '');
    });

    for (const f of sorted) {
        const dateStr = f.event_date.split('T')[0];
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr).push(f);
    }

    const groups = [];
    for (const [date, group] of map.entries()) {
        groups.push({ date, items: group });
    }
    return groups;
}

/**
 * Identifies fixtures that are favourited by checking if their fixture.id
 * is in the favourites array (which now contains fixture_ids).
 */
function getFavouriteGroups(fixtures) {
    if (favourites.length === 0) return [];

    const favFixtureIds = favourites.map(f => Number(f.fixture_id));
    const favFixtures = fixtures.filter(f => favFixtureIds.includes(Number(f.id)));

    if (favFixtures.length === 0) return [];

    // Group favourites by date as well, to maintain consistent structure
    const map = new Map();
    for (const f of favFixtures) {
        const dateStr = f.event_date.split('T')[0];
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr).push(f);
    }

    const groups = [];
    for (const [date, group] of map.entries()) {
        groups.push({ date, items: group, isFavourite: true });
    }
    return groups;
}

/**
 * Injects the HTML into the main container.
 */
function renderDashboard(favouriteGroups, activeGroups, finishedGroups, hasFixtures) {
    console.log('[DEBUG] renderDashboard() called');
    const container = document.getElementById('fixtures-list');
    console.log('[DEBUG] Container found:', !!container);
    if (!container) {
        console.error('[ERROR] #fixtures-list container not found!');
        return;
    }

    let html = '';

    // 1. Render Favourites Section first
    if (favouriteGroups.length > 0) {
        html += `<h2 class="date-header accent-header" style="text-align: center; margin: 2rem 0 1rem;">Your Favourites</h2>`;
        favouriteGroups.forEach(group => {
            html += `<div class="date-section favourite-section">
                <h2 class="date-header">${formatDate(group.date)}</h2>
                <div class="fixtures-container">
                    ${group.items.map(f => renderFixtureCard(f)).join('')}
                </div >
            </div >`;
        });
    }

    // 2. Render Standard Date Sections (Active Matches)
    if (activeGroups.length > 0) {
        activeGroups.forEach(group => {
            html += `<div class="date-section">
                <h2 class="date-header">${formatDate(group.date)}</h2>
                <div class="fixtures-container">
                    ${group.items.map(f => renderFixtureCard(f)).join('')}
                </div >
            </div >`;
        });
    }

    // 3. Render Finished Matches Section
    if (finishedGroups.length > 0) {
        finishedGroups.forEach(group => {
            html += `<div class="date-section">
                <h2 class="date-header accent-header">FINISHED - ${formatDate(group.date)}</h2>
                <div class="fixtures-container">
                    ${group.items.map(f => renderFixtureCard(f)).join('')}
                </div >
            </div >`;
        });
    }

    // Empty States
    if (favouriteGroups.length === 0 && activeGroups.length === 0 && finishedGroups.length === 0) {
        if (hasFixtures) {
            html += `<div class="empty-state">
                <i data-lucide="search" class="empty-icon"></i>
                <p class="empty-text">No matches found for your search.</p>
            </div >`;
        } else {
            html += `<div class="empty-state">
                <i data-lucide="calendar" class="empty-icon"></i>
                <p class="empty-text">No fixtures available at the moment.</p>
            </div >`;
        }
    }

    console.log('[DEBUG] Generated HTML length:', html.length);
    console.log('[DEBUG] Container before:', container.innerHTML.substring(0, 100));
    container.innerHTML = html;
    console.log('[DEBUG] Container after:', container.innerHTML.substring(0, 100));
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Renders a single fixture card.
 * Uses fixture.id to check for favourite status.
 */
function renderFixtureCard(fixture) {
    const isFav = favourites.some(f => Number(f.fixture_id) === Number(fixture.id));

    return `
        <div class="fixture-card" data-id="${fixture.id}">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-fixture-id="${fixture.id}">
                <i data-lucide="star"></i>
            </button>
            <div class="fixture-header">
                <span class="fixture-sport">${fixture.sport || 'Sport'}</span>
                <span class="fixture-status status-${fixture.status?.toLowerCase() || 'scheduled'}">${fixture.status || 'Scheduled'}</span>
            </div >
            <div class="fixture-body">
                <div class="fixture-title">${fixture.title}</div >
                <div class="fixture-details">
                    <p><i data-lucide="map-pin" class="icon-muted"></i> ${fixture.location || 'TBD'}</p>
                    <p><i data-lucide="clock" class="icon-muted"></i> ${formatTime(fixture.event_date, fixture.event_time)}</p>
                </div >
                <div class="fixture-teams">
                    <div class="team-group">
                        <span class="team-name">${fixture.team}</span>
                    </div >
                    <span class="vs">vs</span>
                    <div class="team-group">
                        <span class="team-name">${fixture.opposition}</span>
                    </div >
                </div >
            </div >
        </div >
    `;
}

// --- Helpers ---

function formatDate(dateStr) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
}

function formatTime(eventDate, timeStr) {
    if (!timeStr) return 'TBD';
    try {
        // Create a date object using the event date and the time part
        const date = new Date(eventDate);
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);

        date.setHours(hours, minutes || 0, seconds || 0, 0);

        return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
    } catch (e) {
        console.error('[Error] Formatting time:', e);
        return timeStr;
    }
}

function updateStats() {
    const totalEl = document.getElementById('stat-total');
    const updatedEl = document.getElementById('stat-updated');
    if (totalEl) totalEl.textContent = allFixtures.length;
    if (updatedEl && allFixtures.length > 0) {
        // Find the fixture with the most recent last_updated timestamp
        const latestFixture = allFixtures.reduce((prev, current) => {
            const prevTs = new Date(prev.last_updated).getTime();
            const currentTs = new Date(current.last_updated).getTime();
            return currentTs > prevTs ? current : prev;
        });

        let ts = latestFixture.last_updated;
        // Ensure we treat the timestamp as UTC if no timezone is provided
        if (typeof ts === 'string' && !ts.match(/[Zz]|[+-]\d{2}:?\d{2}$/)) {
            ts += 'Z';
        }
        const last = new Date(ts);

        try {
            const formatter = new Intl.DateTimeFormat('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Australia/Sydney'
            });
            const sydneyTime = formatter.format(last);
            updatedEl.textContent = `${sydneyTime} (Sydney Time)`;
        } catch (e) {
            console.error('[Error] Formatting Sydney time:', e);
            updatedEl.textContent = last.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' (Local Time)';
        }
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Events & Interactions ---

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAll();
        });
    }

    // Favourites Toggle (Event Delegation)
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.fav-btn');
        if (!btn) return;

        const fixtureId = Number(btn.dataset.fixtureId);
        if (isNaN(fixtureId)) {
            console.error("[Error] Invalid fixtureId on fav-btn click:", btn.dataset.fixtureId);
            return;
        }

        // Check if this fixture is currently favourited by comparing IDs as numbers
        const isCurrentlyFav = favourites.some(f => Number(f.fixture_id) === fixtureId);

        if (isCurrentlyFav) {
            await toggleFavourite(fixtureId, 'DELETE');
        } else {
            await toggleFavourite(fixtureId, 'POST');
        }
    });
}

async function toggleFavourite(fixtureId, method) {
    // Optimistic Update
    const originalFavourites = [...favourites];
    let optimisticFav = null;

    if (method === 'POST') {
        // Create an optimistic object that matches the API response format
        // The API returns { "id": ..., "device_id": ..., "fixture_id": ..., "created_at": ... }
        // But the frontend uses Number(f.fixture_id) to match.
        optimisticFav = {
            fixture_id: fixtureId,
            device_id: deviceId,
            id: Date.now() // Temporary ID for UI
        };
        favourites.push(optimisticFav);
    } else {
        favourites = favourites.filter(f => Number(f.fixture_id) !== fixtureId);
    }

    renderAll();

    try {
        let response;
        if (method === 'POST') {
            response = await fetch(`${API_BASE}/favourites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: deviceId, fixture_id: fixtureId })
            });
        } else {
            response = await fetch(`${API_BASE}/favourites/${deviceId}/${fixtureId}`, {
                method: 'DELETE'
            });
        }

        if (response.ok) {
            // Success! Update cache and ensure the local state is perfectly synced with the server
            // We don't call fetchFavourites(true) anymore to avoid unnecessary network load,
            // instead we just update the cache with our current (now correct) state.
            // Actually, the API POST returns 201 and DELETE returns 200, but they don't return the full object.
            // For a more robust sync, we might want the API to return the full object.
            // For now, let's just update the cache.
            setCache(`favourites_${deviceId}`, favourites, FAVOURITES_CACHE_EXPIRY);
            showToast(`Updated favourite status`, 'success');
        } else {
            const err = await response.json();
            if (err.status === 'already_exists') {
                // This is actually a success case for the user (they clicked twice fast)
                // Just ensure state is clean
                favourites = originalFavourites;
                // This shouldn't happen with optimistic updates if we're careful
                // but we'll reset to be safe.
                // However, if it already exists, the 'POST' was successful in effect.
                // Let's re-fetch to be absolutely sure.
                await fetchFavourites(true);
                renderAll();
            } else {
                throw new Error(err.error || 'Failed to update favourite');
            }
        }
    } catch (error) {
        console.error('[Error] Toggling favourite:', error);
        // Rollback on error
        favourites = originalFavourites;
        renderAll();
        showToast(`Failed to update favourites: ${error.message}`, 'error');
    }
}