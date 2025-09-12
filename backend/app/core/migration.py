"""
Database migration utilities for CA-DMS
"""
import os
import logging
from pathlib import Path
from sqlalchemy import create_engine, text
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_migration_files():
    """Get all migration files in order"""
    migrations_dir = Path(__file__).parent.parent.parent / "migrations"
    if not migrations_dir.exists():
        return []
    
    migration_files = []
    for file_path in migrations_dir.glob("*.sql"):
        migration_files.append(file_path)
    
    return sorted(migration_files)


def create_migration_table(engine):
    """Create the migrations tracking table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
    
    with engine.connect() as conn:
        conn.execute(text(create_table_sql))
        conn.commit()


def get_applied_migrations(engine):
    """Get list of applied migration versions"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version FROM schema_migrations ORDER BY version"))
            return [row[0] for row in result]
    except Exception:
        # Table might not exist yet
        return []


def apply_migration(engine, migration_file: Path):
    """Apply a single migration file"""
    migration_name = migration_file.stem
    
    logger.info(f"Applying migration: {migration_name}")
    
    # Read migration file
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    # Apply migration
    with engine.connect() as conn:
        # Execute migration
        conn.execute(text(migration_sql))
        
        # Record migration as applied
        conn.execute(
            text("INSERT INTO schema_migrations (version) VALUES (:version)"),
            {"version": migration_name}
        )
        
        conn.commit()
    
    logger.info(f"Successfully applied migration: {migration_name}")


def run_migrations():
    """Run all pending migrations"""
    # Create database engine
    database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
    engine = create_engine(database_url)
    
    # Create migrations table
    create_migration_table(engine)
    
    # Get applied migrations
    applied_migrations = get_applied_migrations(engine)
    
    # Get all migration files
    migration_files = get_migration_files()
    
    if not migration_files:
        logger.info("No migration files found")
        return
    
    # Apply pending migrations
    pending_migrations = []
    for migration_file in migration_files:
        migration_name = migration_file.stem
        if migration_name not in applied_migrations:
            pending_migrations.append(migration_file)
    
    if not pending_migrations:
        logger.info("No pending migrations")
        return
    
    logger.info(f"Found {len(pending_migrations)} pending migrations")
    
    for migration_file in pending_migrations:
        try:
            apply_migration(engine, migration_file)
        except Exception as e:
            logger.error(f"Failed to apply migration {migration_file.stem}: {e}")
            raise
    
    logger.info("All migrations applied successfully")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()