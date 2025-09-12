"""
API v1 router configuration
"""
from fastapi import APIRouter
from app.api.v1.endpoints import documents, auth, workflows, websockets, collaboration, presence, collaborative_placeholders, notifications, document_comparison, templates, workflow_conditions

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