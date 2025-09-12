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
    
    # Optimized engine configuration for performance
    if "sqlite" in database_url:
        engine = create_engine(
            database_url,
            # SQLite optimizations for concurrent access
            connect_args={
                "check_same_thread": False,
                "timeout": 10,  # 10 second timeout for database locks
                "isolation_level": None  # Use autocommit mode for better concurrency
            },
            # Connection pooling optimized for SQLite
            pool_size=5,   # Smaller pool size for SQLite to reduce contention
            max_overflow=10,  # Limited overflow for SQLite
            pool_pre_ping=True,  # Verify connections are alive
            pool_recycle=3600,  # Recycle connections every hour
            echo=False  # Disable SQL logging for performance
        )
    else:
        engine = create_engine(
            database_url,
            # PostgreSQL/other database optimizations
            pool_size=20,
            max_overflow=50,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Import models to ensure they are registered
    from app.models import document, user, workflow  # noqa
    
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