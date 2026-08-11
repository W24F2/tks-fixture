# Sports Fixtures Dashboard - Claude Code Instructions

## Project Overview
This is a sports fixtures dashboard that downloads, parses, and displays sports fixture data from an XML feed using Python, Flask, and SQLite.

## Architecture
XML feed → Python XML downloader → XML parser → SQLite → Flask/Jinja2 → HTML/CSS → Browser

## Key Requirements
- Use only Python 3, Flask, sqlite3, Jinja2
- No frontend frameworks (React, Vue, Angular)
- No external databases (only SQLite)
- No npm, TypeScript, Tailwind, Bootstrap
- No REST APIs or external services

## Features
- Download sports fixtures from XML feed
- Parse XML and store in SQLite
- Display fixtures with dashboard view
- Search and filter functionality
- Auto-refresh capability
- Responsive design (mobile-first)
- Dark theme UI

## Technology Stack
- Python 3
- Flask
- SQLite (via sqlite3)
- Jinja2 templates
- HTML/CSS
- Vanilla JavaScript (minimal)
- lxml for XML parsing
- httpx for HTTP requests
- APScheduler for scheduling

## File Structure
```
sports-dashboard/
├── app.py
├── database.py
├── xml_parser.py
├── scraper.py
├── scheduler.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
│
├── data/
│   └── sports.db
│
├── tests/
│   ├── sample.xml
│   ├── test_database.py
│   ├── test_xml_parser.py
│   └── test_app.py
│
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── fixtures.html
│   └── fixture.html
│
└── static/
    ├── style.css
    └── app.js
```