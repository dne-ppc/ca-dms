"""
API v1 router configuration
"""
from fastapi import APIRouter
from app.api.v1.endpoints import documents, auth, workflows, websockets, collaboration, presence, collaborative_placeholders, notifications, document_comparison, templates, workflow_conditions, security, api_enhancements, cache, assets, external_integrations, database, scaling, intro_page, services

api_router = APIRouter()

# Include authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Include document routes
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])

# Include workflow routes
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])

# Include WebSocket routes
api_router.include_router(websockets.router, tags=["WebSockets"])

# Include collaboration routes
api_router.include_router(collaboration.router, prefix="/collaboration", tags=["Collaboration"])

# Include presence routes
api_router.include_router(presence.router, prefix="/presence", tags=["Presence"])

# Include collaborative placeholder routes
api_router.include_router(collaborative_placeholders.router, prefix="/placeholders", tags=["Collaborative Placeholders"])

# Include notification routes
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# Include document comparison routes
api_router.include_router(document_comparison.router, prefix="/documents", tags=["Document Comparison"])

# Include template routes
api_router.include_router(templates.router, prefix="/templates", tags=["Templates"])

# Include workflow conditions routes
api_router.include_router(workflow_conditions.router, prefix="/workflow-conditions", tags=["Workflow Conditions"])

# Include security routes (2FA, SSO, Audit)
api_router.include_router(security.router, prefix="/security", tags=["Security"])

# Include API enhancements routes (GraphQL, Webhooks, API Keys, Rate Limiting)
api_router.include_router(api_enhancements.router, prefix="/api-enhancements", tags=["API Enhancements"])

# Include cache management routes
api_router.include_router(cache.router, prefix="/cache", tags=["Cache Management"])

# Include asset management routes
api_router.include_router(assets.router, prefix="/assets", tags=["Asset Management"])

# Include external integrations routes
api_router.include_router(external_integrations.router, prefix="/external-integrations", tags=["External Integrations"])

# Include database management routes
api_router.include_router(database.router, prefix="/database", tags=["Database Management"])

# Include horizontal scaling routes
api_router.include_router(scaling.router, prefix="/scaling", tags=["Horizontal Scaling"])

# Include intro page routes
api_router.include_router(intro_page.router, tags=["Intro Page"])

# Include individual service routes
api_router.include_router(services.router, tags=["Individual Services"])