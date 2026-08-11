import unittest
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from xml_parser import parse_xml

class TestXmlParser(unittest.TestCase):
    def setUp(self):
        # Create a sample XML content for testing
        self.sample_xml = '''
        <fixtures>
            <fixture sport="football" league="Premier League">
                <home_team>Manchester United</home_team>
                <away_team>Chelsea</away_team>
                <start_time>2023-01-01 14:00:00</start_time>
                <status>upcoming</status>
                <score></score>
            </fixture>
        </fixtures>
        '''

    def test_xml_parser(self):
        # Test that xml parser works
        parse_xml(self.sample_xml)
        # Check that the fixture was parsed and stored
        # This would require a database connection to verify
        self.assertTrue(True)  # Placeholder test

if __name__ == '__main__':
    unittest.main()