from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "CA-DMS API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Encryption for sensitive data (2FA secrets, etc.)
    ENCRYPTION_KEY: Optional[str] = None

    # Redis Cache
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None
    CACHE_EXPIRE_SECONDS: int = 3600  # 1 hour default

    # CDN Configuration
    CDN_BASE_URL: Optional[str] = None
    STATIC_CDN_ENABLED: bool = False

    # Development
    DEBUG: bool = True
    
    model_config = {
        "env_file": ".env",
        "extra": "ignore"  # Ignore extra fields in Pydantic v2
    }


settings = Settings()