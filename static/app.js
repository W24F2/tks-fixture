document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const statTotal = document.getElementById('stat-total');
    const statUpdated = document.getElementById('stat-updated');

    // Ensure Lucide icons are initialized on load and after any dynamic updates
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Initial data load (refresh stats from the API)
    updateStats();

    async function updateStats() {
        try {
            const response = await fetch('/api/fixtures');
            const fixtures = await response.json();

            if (statTotal) {
                statTotal.textContent = fixtures.length;
            }

            if (fixtures.length > 0) {
                // Note: last_updated might need to be implemented in models.py if not present
                // For now, we'll use a placeholder or handle gracefully.
                if (fixtures[0].last_updated) {
                    const lastUpdated = new Date(fixtures[0].last_updated);
                    if (statUpdated) {
                        statUpdated.textContent = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                } else {
                    if (statUpdated) statUpdated.textContent = 'Active';
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
});
