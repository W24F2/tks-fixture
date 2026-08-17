import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from models import db
from sqlalchemy import text, inspect

def create_app():
    app = Flask(__name__)

    # Database Configuration
    # Priority: POSTGRES_URL (Vercel/Neon), 2. DATABASE_URL, 3. local sqlite
    database_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:///sports_fixtures.db"

    # Handle sqlite prefix if needed (for some providers)
    if database_url.startswith("sqlite:///"):
        # Ensure it's a relative path for local dev
        pass
    elif database_url.startswith("postgres://"):
        # Vercel/Heroku often use postgres:// but SQLAlchemy requires postgresql://
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-12345")

    db.init_app(app)

    with app.app_context():
        db.create_all()
        # Simple auto-migration for missing columns
        try:
            inspector = inspect(db.engine)
            if inspector.has_table('fixtures'):
                columns = [c['name'] for c in inspector.get_columns('fixtures')]
                if 'event_end_time' not in columns:
                    print("[System] Adding missing column 'event_end_time' to 'fixtures' table...")
                    db.session.execute(text("ALTER TABLE fixtures ADD COLUMN event_end_time TIME"))
                    db.session.commit()
        except Exception as e:
            print(f"[System] Auto-migration failed: {e}")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
