import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

@pytest.fixture
def app():
    os.environ['TRUMBA_XML_URL'] = 'http://test.com/feed.xml'
    os.environ['SECRET_KEY'] = 'test-secret'
    os.environ['REDIS_URL'] = ''
    
    import app as app_module
    from models import db
    
    test_app = app_module.app
    test_app.config['TESTING'] = True
    test_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with test_app.app_context():
        db.create_all()
        yield test_app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_scraper_response():
    return """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>test-123</id>
    <title>Test Fixture</title>
    <content type="html"><![CDATA[
      <div>Test Location<br/>
      Saturday, August 15, 2026, 7:00–8:30pm<br/>
      Sport: Rugby<br/>
      Opposition: Team B<br/>
      Team: Team A
      </div>
    ]]></content>
  </entry>
</feed>"""