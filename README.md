# Sports Fixtures Dashboard

## Project Structure

This is a sports fixtures dashboard built with Python, Flask, and SQLite.

## Features

- Download sports fixtures from XML feed
- Parse XML and store in SQLite database
- Display fixtures with dashboard view
- Search and filter functionality
- Auto-refresh capability
- Responsive design (mobile-first)
- Dark theme UI

## Requirements

- Python 3
- Flask
- SQLite (via sqlite3)
- lxml for XML parsing
- httpx for HTTP requests
- APScheduler for background tasks

## Installation

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Environment Configuration

Create a `.env` file based on `.env.example`:
- `XML_FEED_URL` - URL of the XML feed
- `XML_API_KEY` - API key for authentication (optional)
- `XML_USERNAME` - Username for authentication (optional)
- `XML_PASSWORD` - Password for authentication (optional)
- `POLL_INTERVAL_SECONDS` - Polling interval in seconds (default: 60)
- `SECRET_KEY` - Secret key for Flask app (default: change-this)

## Database Initialization

The database is initialized automatically when the app runs for the first time.

## Running the Application

```bash
flask --app app run --debug
```

## Running Tests

```bash
pytest tests/
```

## XML Feed Configuration

Configure your XML feed URL in the environment variables. The application will automatically download and parse the XML feed.

## Troubleshooting

- If you encounter database connection issues, check that the database file exists and has proper permissions
- If XML parsing fails, verify that the feed URL is correct and accessible
- For HTTP errors, check network connectivity and authentication credentials

## License

MIT License