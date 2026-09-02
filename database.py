import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from models import db
from sqlalchemy import text, inspect


def create_app():
    app = Flask(__name__)

    # Database Configuration Priority Check
    db_url = None

    # 1. Check for generic/user-defined variables (like the user's example)
    if os.getenv("DB_HOST") and os.getenv("DB_USER"):
        try:
            host = os.getenv("DB_HOST")
            port = int(os.getenv("DB_PORT", 5432))
            user = os.getenv("DB_USER")
            password = os.getenv("DB_PASSWORD")
            database = os.getenv("DB_NAME")
            if user and password and host and database:
                db_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        except ValueError:
            pass

    # 2. Check for dedicated Oracle variables (Best practice for cloud/Oracle)
    if not db_url and os.getenv("ORACLE_USER") and os.getenv("ORACLE_PASSWORD") and os.getenv("ORACLE_HOST"):
        db_type = "oracle+oracledb"
        user = os.getenv("ORACLE_USER")
        password = os.getenv("ORACLE_PASSWORD")
        host = os.getenv("ORACLE_HOST")
        port = os.getenv("ORACLE_PORT", 1521)
        service_name = os.getenv("ORACLE_SERVICE_NAME") or os.getenv("ORACLE_SID")
        db_url = f"{db_type}://{user}:{password}@{host}:{port}/?sid={service_name}"

    # 3. Check for standard cloud variables
    elif not db_url and os.getenv("POSTGRES_URL"):
        db_url = os.getenv("POSTGRES_URL")
    elif not db_url and os.getenv("DATABASE_URL"):
        db_url = os.getenv("DATABASE_URL")

    # 4. Local development fallback (SQLite)
    if not db_url:
        database_url = "sqlite:///sports_fixtures.db"
    else:
        database_url = db_url

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-12345")

    # Connection Pooling for production (100 concurrent users)
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