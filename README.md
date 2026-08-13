# Sports Fetcher

A high-performance, real-time sports fixture dashboard designed with a premium "Midnight Stadium" aesthetic. This application automatically scrapes upcoming sports fixtures and presents them in a beautiful, responsive, and searchable interface.

**Live Demo:** [tks-sport.vercel.app](https://tks-sport.vercel.app)

![License](https://shields.io/badge/license-Apache%202-blue)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Deployment](https://img.shields.io/badge/deployed%20on-Vercel-black.svg)

## Features

- **Automated Updates**: Uses Vercel Cron Jobs to automatically refresh fixture data every 15 minutes.
- **Smart Discovery**: Instant search and dynamic filtering by sport, team, or location.
- **Premium Aesthetic**: A custom-designed "Midnight Stadium" dark theme featuring glassmorphism, smooth animations, and high-contrast typography.
- **Live Statistics**: Real-time tracking of total fixtures and the last successful update.
- **Responsive Design**: A seamless experience across desktop, tablet, and mobile devices.
- **High Performance**: Optimized for fast loading and smooth interaction using lightweight modern CSS and an optimized Python backend.

## Getting Started

### Prerequisites

- Python 3.9+
- `pip` (Python package installer)

### Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/W24F2/tks-fixture.git
   cd tks-fixture
   ```

2. **Set up a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=sqlite:///sports_fixtures.db
   TRUMBA_XML_URL=https://www.trumba.com/calendars/senior-fixtures.xml
   SECRET_KEY=your_super_secret_key
   ```

5. **Run the application**
   ```bash
   python app.py
   ```
   The app will be available at `http://127.0.0.1:5000`.

## Deployment to Vercel

This project is optimized for Vercel's serverless architecture.

1. **Push your code to GitHub.**
2. **Connect your repository to Vercel.**
3. **Configure Environment Variables** in the Vercel dashboard:
   - `DATABASE_URL`: Your production database connection string (e.g., Neon/Postgres).
   - `TRUMBA_XML_URL`: The source XML URL.
   - `CRON_SECRET`: A secret token to secure your cron refresh endpoint.
4. **Vercel will automatically detect the configuration** and deploy your app.

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

Information provided by this application may not always be accurate. Please cross-reference with official sources (such as Kingsnet) for the most up-to-date and definitive information.
