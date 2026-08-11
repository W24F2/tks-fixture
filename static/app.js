// Default JavaScript for Sports Fixtures Dashboard
function refreshFixtures() {
    fetch('/refresh')
        .then(response => response.json())
        .then(data => {
            console.log('Refreshed fixtures:', data);
        })
        .catch(error => {
            console.error('Error refreshing fixtures:', error);
        });
}

// Auto-refresh every 60 seconds
setInterval(refreshFixtures, 60000);