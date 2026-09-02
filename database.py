import os
from flask import Flask
from models import db
from sqlalchemy import text, inspect


def create_app():
    app = Flask(__name__)

    db_url = None

    # MySQL HeatWave
    if os.getenv("DB_HOST") and os.getenv("DB_USER"):
        host = os.getenv("DB_HOST")
        port = int(os.getenv("DB_PORT", 3306))
        user = os.getenv("DB_USER")
        password = os.getenv("DB_PASSWORD")
        database = os.getenv("DB_NAME")

        if user and password and host and database:
            db_url = (
                f"mysql+mysqlconnector://{user}:{password}"
                f"@{host}:{port}/{database}"
            )

    # Explicit DATABASE_URL override
    if not db_url and os.getenv("DATABASE_URL"):
        db_url = os.getenv("DATABASE_URL")

    # Local development fallback
    if not db_url:
        database_url = "sqlite:///sports_fixtures.db"
    else:
        database_url = db_url

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-12345")

    if not database_url.startswith("sqlite"):
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_size": 10,
            "max_overflow": 20,
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "pool_timeout": 30,
        }

    db.init_app(app)

    with app.app_context():
        db.create_all()

        try:
            inspector = inspect(db.engine)

            if inspector.has_table("fixtures"):
                columns = [c["name"] for c in inspector.get_columns("fixtures")]

                if "event_end_time" not in columns:
                    print(
                        "[System] Adding missing column "
                        "'event_end_time' to 'fixtures' table..."
                    )

                    db.session.execute(
                        text(
                            "ALTER TABLE fixtures "
                            "ADD COLUMN event_end_time TIME"
                        )
                    )
                    db.session.commit()

        except Exception as e:
            print(f"[System] Auto-migration failed: {e}")

    return app