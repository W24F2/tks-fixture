"""
Locust load test for Sports Fixtures Dashboard
Run: locust -f locustfile.py --host=https://fixture.kings.dpdns.org
Web UI: http://localhost:8089
"""

from locust import HttpUser, between, task


class FixtureUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Run once per user on start"""
        self.client.headers.update({
            "User-Agent": "LocustLoadTest/1.0",
            "Accept": "application/json",
        })
    
    @task(10)
    def view_homepage(self):
        """Load the main SPA page"""
        with self.client.get("/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(8)
    def get_fixtures(self):
        """Fetch all fixtures from API"""
        with self.client.get("/api/fixtures", catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        response.success()
                    else:
                        response.failure("Response is not a list")
                except Exception:
                    response.failure("Response is not JSON (likely Cloudflare challenge)")
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(5)
    def get_fixtures_cached(self):
        """Repeat request to test ETag caching (should return 304)"""
        # First request to get ETag
        resp = self.client.get("/api/fixtures")
        etag = resp.headers.get("ETag")
        
        if etag:
            headers = {"If-None-Match": etag}
            with self.client.get("/api/fixtures", headers=headers, catch_response=True) as response:
                if response.status_code == 304:
                    response.success()
                elif response.status_code == 200:
                    response.success()  # Cache miss, still OK
                else:
                    response.failure(f"Status: {response.status_code}")
    
    @task(3)
    def health_check(self):
        """Health check endpoint"""
        with self.client.get("/api/health", catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("status") == "healthy":
                        response.success()
                    else:
                        response.failure(f"Unhealthy: {data}")
                except Exception:
                    response.failure("Response is not JSON (likely Cloudflare challenge)")
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(2)
    def refresh_fixtures(self):
        """Trigger manual refresh (rate limited)"""
        with self.client.post("/api/fixtures/refresh", catch_response=True) as response:
            # May return 429 (rate limited) or 200/500
            if response.status_code in (200, 429):
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(1)
    def static_assets(self):
        """Test static asset serving via nginx"""
        # Try to get the manifest to find asset names
        resp = self.client.get("/static/dist/.vite/manifest.json")
        if resp.status_code == 200:
            try:
                manifest = resp.json()
                if "index.html" in manifest:
                    css_file = manifest["index.html"].get("css", [None])[0]
                    js_file = manifest["index.html"].get("file")
                    if css_file:
                        self.client.get(f"/static/dist/{css_file}", name="/static/dist/[css]")
                    if js_file:
                        self.client.get(f"/static/dist/{js_file}", name="/static/dist/[js]")
            except Exception:
                pass  # Not JSON, skip


class MobileUser(FixtureUser):
    """Simulate mobile user with different headers"""
    wait_time = between(2, 5)
    
    def on_start(self):
        super().on_start()
        self.client.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        })
    
    @task(5)
    def mobile_homepage(self):
        self.view_homepage()
    
    @task(3)
    def mobile_fixtures(self):
        self.get_fixtures()


class ApiOnlyUser(FixtureUser):
    """API-only client (e.g. external integrations)"""
    wait_time = between(0.5, 2)
    
    @task(20)
    def api_fixtures(self):
        self.get_fixtures()
    
    @task(5)
    def api_health(self):
        self.health_check()
    
    @task(1)
    def api_refresh(self):
        self.refresh_fixtures()