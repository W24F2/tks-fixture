from flask import Flask, render_template, request
from database import init_db, get_fixtures, search_fixtures
from scraper import scrape_fixtures

# Initialize database
init_db()

app = Flask(__name__)

@app.route('/')
def dashboard():
    """Render the main dashboard."""
    fixtures = get_fixtures()
    return render_template('dashboard.html', fixtures=fixtures)

@app.route('/fixtures')
def fixtures_page():
    """Render the fixtures page."""
    fixtures = get_fixtures()
    return render_template('fixtures.html', fixtures=fixtures)

@app.route('/refresh')
def refresh():
    """Refresh the fixtures."""
    try:
        # Force refresh by scraping new data
        fixtures = scrape_fixtures()
        return render_template('fixtures.html', fixtures=fixtures)
    except Exception as e:
        return f"Error refreshing: {e}"

@app.route('/search')
def search():
    """Search fixtures."""
    query = request.args.get('q', '')
    results = search_fixtures(query)
    return render_template('search_results.html', results=results, query=query)

@app.route('/fixture/<int:id>')
def fixture_detail(id):
    """Render a specific fixture detail."""
    # Get fixture by ID
    from database import get_fixture_by_id
    fixture = get_fixture_by_id(id)
    if fixture:
        return render_template('fixture.html', fixture=fixture)
    else:
        return "Fixture not found", 404

if __name__ == '__main__':
    app.run(debug=True)