document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const statTotal = document.getElementById('stat-total');
    const statUpdated = document.getElementById('stat-updated');
    const searchInput = document.getElementById('search-input');
    const filterWrapper = document.getElementById('filter-wrapper');
    const fixturesList = document.getElementById('fixtures-list');
    const toastContainer = document.getElementById('toast-container');

    let allFixtures = [];
    let currentFilter = 'all';
    let currentSearchQuery = '';

    // Ensure Lucide icons are initialized on load and after any dynamic updates
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Initial data load
    fetchAndRender();

    // Event Listeners
    searchInput?.addEventListener('input', handleSearch);

    // Use event delegation for dynamic filter buttons
    filterWrapper?.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (btn) {
            filterWrapper.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilters();
        }
    });

    async function fetchAndRender() {
        try {
            if (loadingOverlay) loadingOverlay.classList.remove('hidden');

            const response = await fetch('/api/fixtures');
            if (!response.ok) throw new Error('Failed to fetch fixtures');

            allFixtures = await response.json();
            updateStats(allFixtures);
            renderFilterButtons(allFixtures);
            applyFilters();

            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        } catch (error) {
            console.error('Error loading fixtures:', error);
            showToast('Failed to load fixtures', 'error');
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }

    function renderFilterButtons(fixtures) {
        if (!filterWrapper) return;

        // Extract unique sports
        const sports = new Set(['all']);
        fixtures.forEach(f => {
            if (f.sport) {
                sports.add(f.sport.toLowerCase());
            }
        });

        // Clear current buttons
        filterWrapper.innerHTML = '';

        // Create new buttons
        sports.forEach(sport => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${sport === 'all' ? 'active' : ''}`;
            btn.dataset.filter = sport;
            btn.textContent = sport.charAt(0).toUpperCase() + sport.slice(1);
            filterWrapper.appendChild(btn);
        });
    }

    function handleSearch(e) {
        currentSearchQuery = e.target.value.toLowerCase();
        applyFilters();
    }

    function applyFilters() {
        const filtered = allFixtures.filter(fixture => {
            const matchesFilter = currentFilter === 'all' ||
                                 (fixture.sport && fixture.sport.toLowerCase() === currentFilter);

            const matchesSearch = !currentSearchQuery ||
                                 fixture.title.toLowerCase().includes(currentSearchQuery) ||
                                 (fixture.team && fixture.team.toLowerCase().includes(currentSearchQuery)) ||
                                 (fixture.opposition && fixture.opposition.toLowerCase().includes(currentSearchQuery)) ||
                                 (fixture.location && fixture.location.toLowerCase().includes(currentSearchQuery));

            return matchesFilter && matchesSearch;
        });

        renderFixtures(filtered);
    }

    function renderFixtures(fixtures) {
        if (!fixturesList) return;

        if (fixtures.length === 0) {
            fixturesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i data-lucide="calendar-off" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h2 class="empty-text">No fixtures match your criteria</h2>
                    <p>Try adjusting your search or filters.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        fixturesList.innerHTML = fixtures.map(fixture => `
            <div class="fixture-card" data-sport="${fixture.sport?.toLowerCase() || 'general'}" data-title="${fixture.title?.toLowerCase() || ''}" data-location="${fixture.location?.toLowerCase() || ''}">
                <div class="fixture-header">
                    <span class="fixture-sport">${fixture.sport || 'General'}</span>
                    <span class="fixture-status">Scheduled</span>
                </div>
                <div class="fixture-body">
                    <h3 class="fixture-title">${fixture.title}</h3>
                    <div class="fixture-details">
                        <p><i data-lucide="map-pin" class="icon-muted"></i> ${fixture.location || 'TBD'}</p>
                        <p><i data-lucide="calendar" class="icon-muted"></i> ${fixture.event_date}</p>
                        <p><i data-lucide="clock" class="icon-muted"></i> ${fixture.event_time}</p>
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
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function updateStats(fixtures) {
        if (statTotal) statTotal.textContent = fixtures.length;

        if (fixtures.length > 0) {
            const lastUpdated = fixtures[0].last_updated;
            if (statUpdated) {
                if (lastUpdated) {
                    const date = new Date(lastUpdated);
                    statUpdated.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    statUpdated.textContent = 'Active';
                }
            }
        }
    }

    function showToast(message, type = 'info') {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconName = type === 'success' ? 'check-circle' :
                        type === 'error' ? 'alert-circle' : 'info';

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="icon-sm"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }
}).catch(err => console.error("Critical error during initialization:", err));
