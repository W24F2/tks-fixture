import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from models import db

def create_app():
    app = Flask(__name__)

    # Database Configuration
    # Priority: 1. DATABASE_URL from env, 2. local sqlite
    database_url = os.getenv("DATABASE_URL", "sqlite:///sports_fixtures.db")

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

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
