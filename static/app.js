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

function setCache(key, data) {
    const cacheData = {
        timestamp: Date.now(),
        data: data
    };
    localStorage.setItem(`sf_cache_${key}`, JSON.stringify(cacheData));
}

function getCache(key) {
    const cached = localStorage.getItem(`sf_cache_${key}`);
    if (!cached) return null;

    try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_EXPIRY) {
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[System] Initializing Sports Fetcher...');

    await initDeviceId();
    await fetchFavourites();
    await fetchFixtures();

    setupEventListeners();
    renderAll();

    // Register Service Worker for PWA support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
          .then(reg => console.log('SW registered!', reg))
          .catch(err => console.log('SW registration failed!', err));
      });
    }
});

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
    const cached = getCache('fixtures');
    if (cached) {
        console.log('[System] Loading fixtures from cache');
        allFixtures = cached;
        updateStats();
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/fixtures`);
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        allFixtures = await response.json();
        setCache('fixtures', allFixtures);
        updateStats();
    } catch (error) {
        console.error('[Error] Fetching fixtures:', error);
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
        const cached = getCache(`favourites_${deviceId}`);
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
        setCache(`favourites_${deviceId}`, favourites);
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
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Filter fixtures based on search term
    const filtered = allFixtures.filter(f => {
        const matchTeam = f.team.toLowerCase().includes(searchTerm) ||
                          f.opposition.toLowerCase().includes(searchTerm);
        const matchTitle = f.title.toLowerCase().includes(searchTerm);
        return matchTeam || matchTitle;
    });

    // Group by date for rendering
    const grouped = groupFixturesByDate(filtered);

    // Get favourites group
    const favouriteGroups = getFavouriteGroups(filtered);

    renderDashboard(favouriteGroups, grouped);
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
function renderDashboard(favouriteGroups, dateGroups) {
    const container = document.getElementById('fixtures-list');
    if (!container) return;

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

    // 2. Render Standard Date Sections
    if (dateGroups.length > 0) {
        dateGroups.forEach(group => {
            html += `<div class="date-section">
                <h2 class="date-header">${formatDate(group.date)}</h2>
                <div class="fixtures-container">
                    ${group.items.map(f => renderFixtureCard(f)).join('')}
                </div >
            </div >`;
        });
    } else if (allFixtures.length > 0) {
        // If search returned nothing but there are fixtures
        html += `<div class="empty-state">
            <i data-lucide="search" class="empty-icon"></i>
            <p class="empty-text">No matches found for your search.</p>
        </div >`;
    } else {
        // Truly empty state
        html += `<div class="empty-state">
            <i data-lucide="calendar" class="empty-icon"></i>
            <p class="empty-text">No fixtures available at the moment.</p>
        </div >`;
    }

    container.innerHTML = html;
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
                <span class="fixture-status">Scheduled</span>
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
            // Immediately update local state and cache to ensure instant UI feedback
            await fetchFavourites(true);
            renderAll();
            showToast(`Updated favourite status`, 'success');
        } else {
            const err = await response.json();
            if (err.status === 'already_exists') {
                await fetchFavourites();
                renderAll();
            } else {
                throw new Error(err.error || 'Failed to update favourite');
            }
        }
    } catch (error) {
        console.error('[Error] Toggling favourite:', error);
        showToast(`Failed to update favourites: ${error.message}`, 'error');
    }
}
