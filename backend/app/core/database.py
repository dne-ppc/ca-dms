"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create database engine
engine = None
SessionLocal = None

# Create base class for models
Base = declarative_base()


def init_db():
    """Initialize database connection"""
    global engine, SessionLocal
    
    # For now, use SQLite for development if no DATABASE_URL is provided
    database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
    
    engine = create_engine(
        database_url,
        # SQLite specific settings
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
    )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Import models to ensure they are registered
    from app.models import document, user  # noqa
    
    # Create all tables
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session"""
    if SessionLocal is None:
        init_db()
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()