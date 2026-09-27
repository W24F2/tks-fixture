import logging
import os

from flask import Flask
from sqlalchemy import event, inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from models import db

logger = logging.getLogger(__name__)


def _configure_sqlite(engine):
    """Tune SQLite for multi-process access (gunicorn workers + scraper).

    WAL lets readers proceed while the scraper writes; busy_timeout makes
    lock contention wait instead of erroring; NORMAL sync is the recommended
    WAL companion (fast, and cannot corrupt the DB on crash).
    """

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=5000")
        finally:
            cursor.close()


def create_app():
    app = Flask(__name__)

    db_url = None

    # Oracle Database
    if os.getenv("ORACLE_USER") and os.getenv("ORACLE_PASSWORD") and os.getenv("ORACLE_DSN"):
        user = os.getenv("ORACLE_USER")
        password = os.getenv("ORACLE_PASSWORD")
        dsn = os.getenv("ORACLE_DSN")
        db_url = f"oracle+oracledb://{user}:{password}@{dsn}"

    # MySQL HeatWave
    elif os.getenv("DB_HOST") and os.getenv("DB_USER"):
        host = os.getenv("DB_HOST")
        port = int(os.getenv("DB_PORT", "3306"))
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
        if database_url.startswith("sqlite"):
            _configure_sqlite(db.engine)

        db.create_all()

        try:
            inspector = inspect(db.engine)

            if inspector.has_table("fixtures"):
                columns = [c["name"] for c in inspector.get_columns("fixtures")]

                if "event_end_time" not in columns:
                    logger.info(
                        "Adding missing column 'event_end_time' to 'fixtures' table..."
                    )

                    db.session.execute(
                        text(
                            "ALTER TABLE fixtures "
                            "ADD COLUMN event_end_time TIME"
                        )
                    )
                    db.session.commit()

        except (OperationalError, ProgrammingError, SQLAlchemyError) as e:
            logger.error("Auto-migration failed: %s", e)

        # Auto-create push_subscriptions table if missing
        try:
            if not inspector.has_table("push_subscriptions"):
                print("[System] Creating push_subscriptions table...")
                db.session.execute(text("""
                    CREATE TABLE push_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        device_id VARCHAR(36) NOT NULL,
                        endpoint VARCHAR(500) NOT NULL,
                        p256dh VARCHAR(255) NOT NULL,
                        auth VARCHAR(255) NOT NULL,
                        platform VARCHAR(50),
                        alerts VARCHAR(20) DEFAULT 'all',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(device_id, endpoint)
                    )
                """))
                db.session.commit()
        except (OperationalError, ProgrammingError, SQLAlchemyError) as e:
            print(f"[System] Auto-migration (push_subscriptions) skipped: {e}")

    return app