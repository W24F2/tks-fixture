import unittest
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db

class TestDatabase(unittest.TestCase):
    def setUp(self):
        # Create a temporary database file for testing
        self.test_db = 'test_database.db'
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def tearDown(self):
        # Clean up test database
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_database_init(self):
        # Test that database initialization works
        init_db()
        # Check that the database file exists
        self.assertTrue(os.path.exists('data/sports.db'))

if __name__ == '__main__':
    unittest.main()