document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statTotal = document.getElementById('stat-total');
    const statUpdated = document.getElementById('stat-updated');

    // Ensure Lucide icons are initialized on load and after any dynamic updates
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Initial data load (refresh stats from the API)
    updateStats();

    refreshBtn.addEventListener('click', async () => {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }

        try {
            const response = await fetch('/api/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Instead of a generic alert, we could implement a toast,
                // but for now we stick to the reload.
                window.location.reload();
            } else if (response.status === 429) {
                // If rate limited, we can handle it gracefully if we weren't already redirected
                window.location.href = '/';
            } else {
                alert(`Error: ${data.error || 'Failed to refresh data'}`);
            }
        } catch (error) {
            console.error('Refresh error:', error);
            alert('Failed to connect to the server.');
        } finally {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }
    });

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
