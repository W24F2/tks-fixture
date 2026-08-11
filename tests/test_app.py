import unittest
from app import app

class TestApp(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_home_page(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_fixtures_page(self):
        response = self.app.get('/fixtures')
        self.assertEqual(response.status_code, 200)

    def test_fixture_detail_page(self):
        response = self.app.get('/fixture/1')
        self.assertEqual(response.status_code, 200)

    def test_search_page(self):
        response = self.app.get('/search')
        self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()