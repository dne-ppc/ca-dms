"""
API v1 router configuration
"""
from fastapi import APIRouter
from app.api.v1.endpoints import documents, auth, workflows, websockets, collaboration

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