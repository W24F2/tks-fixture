let allFixtures = [];
let currentSearchQuery = '';

let loadingOverlay, fixturesList, searchInput;

document.addEventListener('DOMContentLoaded', () => {
    loadingOverlay = document.getElementById('loading-overlay');
    fixturesList = document.getElementById('fixtures-list');
    searchInput = document.getElementById('search-input');

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    fetchAndRender();
});

async function fetchAndRender() {
    try {
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');

        const response = await fetch('/api/fixtures');
        if (!response.ok) throw new Error('Failed to fetch fixtures');

        allFixtures = await response.json();
        updateStats(allFixtures);
        applyFilters();

        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    } catch (error) {
        console.error('Error loading fixtures:', error);
        showToast('Failed to load fixtures', 'error');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

function updateStats(fixtures) {
    const totalEl = document.getElementById('stat-total');
    const updatedEl = document.getElementById('stat-updated');
    if (totalEl) totalEl.textContent = fixtures.length;

    if (updatedEl) {
        let latest = null;
        fixtures.forEach(f => {
            if (f.last_updated) {
                const d = new Date(f.last_updated);
                if (!latest || d > latest) latest = d;
            }
        });

        if (latest) {
            updatedEl.textContent = latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC';
        } else {
            updatedEl.textContent = 'Just now (UTC)';
        }
    }
}

function handleSearch(e) {
    currentSearchQuery = e.target.value.toLowerCase();
    applyFilters();
}

function applyFilters() {
    const filtered = allFixtures.filter(fixture => {
        const matchesSearch = !currentSearchQuery ||
                             (fixture.title && fixture.title.toLowerCase().includes(currentSearchQuery)) ||
                             (fixture.team && fixture.team.toLowerCase().includes(currentSearchQuery)) ||
                             (fixture.opposition && fixture.opposition.toLowerCase().includes(currentSearchQuery)) ||
                             (fixture.location && fixture.location.toLowerCase().includes(currentSearchQuery));

        return matchesSearch;
    });

    const grouped = [];
    const sortedFixtures = [...filtered].sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        return (a.event_time || '').localeCompare(b.event_time || '');
    });

    const groups = {};
    sortedFixtures.forEach(f => {
        const dateStr = f.event_date.split('T')[0];
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(f);
    });

    Object.keys(groups).forEach(dateStr => {
        const dateObj = new Date(dateStr + 'T00:00:00');
        grouped.push({
            date: dateObj,
            fixtures: groups[dateStr]
        });
    });

    renderFixtures(grouped);
}

function renderFixtures(groupedFixtures) {
    if (!fixturesList) return;

    if (groupedFixtures.length === 0) {
        fixturesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i data-lucide="calendar-off" style="width: 64px; height: 64px;"></i>
                </div>
                <h2 class="empty-text">No fixtures match your criteria</h2>
                <p>Try adjusting your search.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    fixturesList.innerHTML = groupedFixtures.map(({ date, fixtures }) => `
        <div class="date-section">
            <h2 class="date-header">${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
            <div class="fixtures-container">
                ${fixtures.map(fixture => `
                    <div class="fixture-card" data-sport="${fixture.sport?.toLowerCase() || 'general'}" data-title="${fixture.title?.toLowerCase() || ''}" data-location="${fixture.location?.toLowerCase() || ''}">
                        <div class="fixture-header">
                            <span class="fixture-sport">${fixture.sport || 'General'}</span>
                            <span class="fixture-status">Scheduled</span>
                        </div>
                        <div class="fixture-body">
                            <h3 class="fixture-title">${fixture.title}</h3>
                            <div class="fixture-details">
                                <p><i data-lucide="map-pin" class="icon-muted"></i> ${fixture.location || 'TBD'}</p>
                                <p><i data-lucide="calendar" class="icon-muted"></i> ${fixture.event_date.split('T')[0]}</p>
                                <p><i data-lucide="clock" class="icon-muted"></i> ${fixture.event_time || 'TBD'}</p>
                            </div>
                            <div class="fixture-teams">
                                <div class="team">
                                    <span class="team-name">${fixture.team || 'Home'}</span>
                                </div>
                                <span class="vs">vs</span>
                                <div class="team">
                                    <span class="team-name">${fixture.opposition || 'Away'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}
