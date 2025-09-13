from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
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
    description="""
    # Community Association Document Management System API

    A comprehensive microservices-based web application for managing governance documents
    with rich editing capabilities, approval workflows, and automated PDF generation.

    ## Key Features

    * **Enhanced Document Editor** - Rich text editing with custom placeholder objects
    * **Immutable Version Tables** - Fixed document version tracking at document top
    * **Custom Placeholder Objects** - Specialized governance document elements
    * **PDF Generation** - Automatic conversion with fillable form field mapping
    * **Approval Workflows** - Configurable multi-step approval processes
    * **Real-time Collaboration** - Multi-user editing with conflict resolution
    * **Comprehensive Audit** - Complete tracking of all document changes

    ## API Organization

    This API is organized into logical groups:

    * **Authentication** - User authentication and authorization
    * **Documents** - Document CRUD operations and management
    * **Templates** - Document template management
    * **Workflows** - Approval process management
    * **Collaboration** - Real-time collaboration features
    * **Notifications** - User notification system
    * **Security** - 2FA, SSO, and audit features
    * **External Integrations** - Third-party service integrations
    * **Intro Page** - Dashboard and analytics with comprehensive user insights

    ## Getting Started

    1. Authenticate using the `/api/v1/auth/login` endpoint
    2. Use the returned JWT token in the `Authorization: Bearer <token>` header
    3. Access documents, templates, and workflows using the respective endpoints
    4. View the intro page dashboard for user analytics and system overview

    ## Rate Limiting

    All endpoints are rate-limited to ensure fair usage:
    * Standard endpoints: 100 requests per minute
    * Intensive operations: 10 requests per minute

    Rate limit headers are included in all responses.
    """,
    version="1.0.0",
    contact={
        "name": "CA-DMS Development Team",
        "url": "https://github.com/yourusername/ca-dms",
        "email": "support@ca-dms.example.com"
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    },
    terms_of_service="https://ca-dms.example.com/terms",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "User authentication, registration, and JWT token management"
        },
        {
            "name": "Documents",
            "description": "Document CRUD operations, version control, and content management"
        },
        {
            "name": "Templates",
            "description": "Document template creation, management, and placeholder configuration"
        },
        {
            "name": "Workflows",
            "description": "Approval workflow configuration and process management"
        },
        {
            "name": "Workflow Conditions",
            "description": "Conditional logic and rules for workflow automation"
        },
        {
            "name": "Collaboration",
            "description": "Real-time collaborative editing and presence tracking"
        },
        {
            "name": "Presence",
            "description": "User presence tracking and real-time status updates"
        },
        {
            "name": "Collaborative Placeholders",
            "description": "Shared placeholder management for collaborative documents"
        },
        {
            "name": "Notifications",
            "description": "User notification system and delivery management"
        },
        {
            "name": "Document Comparison",
            "description": "Document version comparison and diff visualization"
        },
        {
            "name": "Security",
            "description": "Two-factor authentication, SSO, and security audit features"
        },
        {
            "name": "API Enhancements",
            "description": "GraphQL endpoints, webhooks, API key management, and rate limiting"
        },
        {
            "name": "Cache Management",
            "description": "Redis cache operations and performance optimization"
        },
        {
            "name": "Asset Management",
            "description": "File upload, CDN integration, and media asset handling"
        },
        {
            "name": "External Integrations",
            "description": "Third-party service integrations and API connections"
        },
        {
            "name": "Database Management",
            "description": "Database operations, migrations, and data management"
        },
        {
            "name": "Horizontal Scaling",
            "description": "Load balancing, auto-scaling, and performance monitoring"
        },
        {
            "name": "Intro Page",
            "description": "Main dashboard and intro page data coordination"
        },
        {
            "name": "Individual Services",
            "description": "Granular access to individual service components"
        },
        {
            "name": "WebSockets",
            "description": "Real-time WebSocket connections for live collaboration"
        }
    ]
)


def custom_openapi():
    """Generate custom OpenAPI schema with enhanced documentation"""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        contact=app.contact,
        license_info=app.license_info,
        terms_of_service=app.terms_of_service,
    )

    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token obtained from login endpoint. Use format: `Bearer <token>`"
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key for service-to-service authentication"
        }
    }

    # Add global security requirement
    openapi_schema["security"] = [{"bearerAuth": []}]

    # Add servers information
    openapi_schema["servers"] = [
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        },
        {
            "url": "https://api.ca-dms.example.com",
            "description": "Production server"
        },
        {
            "url": "https://staging-api.ca-dms.example.com",
            "description": "Staging server"
        }
    ]

    # Add external documentation
    openapi_schema["externalDocs"] = {
        "description": "Find more info and examples in our documentation",
        "url": "https://docs.ca-dms.example.com"
    }

    # Enhance info section
    openapi_schema["info"]["x-logo"] = {
        "url": "https://ca-dms.example.com/logo.png",
        "altText": "CA-DMS Logo"
    }

    # Add tags definition for API organization
    openapi_schema["tags"] = [
        {
            "name": "Authentication",
            "description": "User authentication, registration, and JWT token management"
        },
        {
            "name": "Documents",
            "description": "Document CRUD operations, version control, and content management"
        },
        {
            "name": "Templates",
            "description": "Document template creation, management, and placeholder configuration"
        },
        {
            "name": "Workflows",
            "description": "Approval workflow configuration and process management"
        },
        {
            "name": "Workflow Conditions",
            "description": "Conditional logic and rules for workflow automation"
        },
        {
            "name": "Collaboration",
            "description": "Real-time collaborative editing and presence tracking"
        },
        {
            "name": "Presence",
            "description": "User presence tracking and real-time status updates"
        },
        {
            "name": "Collaborative Placeholders",
            "description": "Shared placeholder management for collaborative documents"
        },
        {
            "name": "Notifications",
            "description": "User notification system and delivery management"
        },
        {
            "name": "Document Comparison",
            "description": "Document version comparison and diff visualization"
        },
        {
            "name": "Security",
            "description": "Two-factor authentication, SSO, and security audit features"
        },
        {
            "name": "API Enhancements",
            "description": "GraphQL endpoints, webhooks, API key management, and rate limiting"
        },
        {
            "name": "Cache Management",
            "description": "Redis cache operations and performance optimization"
        },
        {
            "name": "Asset Management",
            "description": "File upload, CDN integration, and media asset handling"
        },
        {
            "name": "External Integrations",
            "description": "Third-party service integrations and API connections"
        },
        {
            "name": "Database Management",
            "description": "Database operations, migrations, and data management"
        },
        {
            "name": "Horizontal Scaling",
            "description": "Load balancing, auto-scaling, and performance monitoring"
        },
        {
            "name": "Intro Page",
            "description": "Main dashboard and intro page data coordination"
        },
        {
            "name": "Individual Services",
            "description": "Granular access to individual service components"
        },
        {
            "name": "WebSockets",
            "description": "Real-time WebSocket connections for live collaboration"
        }
    ]

    # Add custom extensions for better documentation
    openapi_schema["x-tagGroups"] = [
        {
            "name": "Core Operations",
            "tags": ["Authentication", "Documents", "Templates"]
        },
        {
            "name": "Workflow Management",
            "tags": ["Workflows", "Workflow Conditions"]
        },
        {
            "name": "Collaboration",
            "tags": ["Collaboration", "Presence", "Collaborative Placeholders", "WebSockets"]
        },
        {
            "name": "System Features",
            "tags": ["Notifications", "Security", "Cache Management"]
        },
        {
            "name": "Data & Analytics",
            "tags": ["Document Comparison", "Intro Page", "Individual Services"]
        },
        {
            "name": "Infrastructure",
            "tags": ["API Enhancements", "Asset Management", "External Integrations", "Database Management", "Horizontal Scaling"]
        }
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

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


@app.get("/api/v1/health")
def api_health_check():
    """API v1 health check endpoint for testing infrastructure"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": "2025-09-13T10:45:23.123Z",
        "api_version": "v1"
    }