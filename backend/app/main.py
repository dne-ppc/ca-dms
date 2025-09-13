from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.api import api_router
# from app.graphql.schema import graphql_app  # Temporarily disabled
from app.core.config import settings
from app.core.database import get_db
from app.core.notification_templates import create_default_templates
from app.services.cache_service import cache_service
from app.services.cache_monitoring_service import cache_monitoring_service
from app.middleware.rate_limiting import rate_limit_middleware, init_rate_limiting
import os

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Community Association Document Management System API",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
app.middleware("http")(rate_limit_middleware)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Include GraphQL endpoint
# app.include_router(graphql_app, prefix="/api/v1", tags=["GraphQL"])  # Temporarily disabled

# Mount static files for asset serving (when CDN is disabled)
static_dir = os.path.join(os.getcwd(), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    # Initialize Redis cache service
    await cache_service.connect()

    # Initialize rate limiting
    # await init_rate_limiting()  # Temporarily disabled

    # Create default notification templates
    db = next(get_db())
    create_default_templates(db)
    db.close()

    # Start cache monitoring
    cache_monitoring_service.start_background_monitoring()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    cache_monitoring_service.stop_background_monitoring()
    await cache_service.disconnect()


@app.get("/")
def read_root():
    return {"message": "CA-DMS API is running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}