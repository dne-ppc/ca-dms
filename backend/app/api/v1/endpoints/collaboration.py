"""
Collaboration endpoints for real-time document editing
"""
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.websocket_manager import WebSocketManager
from app.services.document_collaboration_service import DocumentCollaborationService
from app.models.user import User
from app.schemas.collaboration import (
    DocumentOperationRequest,
    DocumentOperationResponse,
    DocumentStateResponse,
    OperationsSinceRequest,
    OperationsSinceResponse,
    ConflictResolutionRequest,
    ConflictResolutionResponse,
    DocumentSnapshotResponse,
    CollaborationStatsResponse,
    UndoRedoRequest,
    UndoRedoResponse
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global WebSocket manager instance (in production, use dependency injection or singleton pattern)
websocket_manager = WebSocketManager()


def get_collaboration_service(db: Session = Depends(get_db)) -> DocumentCollaborationService:
    """Get document collaboration service instance"""
    return DocumentCollaborationService(db, websocket_manager)


@router.post("/apply-operation/{document_id}", response_model=DocumentOperationResponse)
async def apply_document_operation(
    document_id: str,
    operation_request: DocumentOperationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Apply a Delta operation to a document and broadcast to collaborators"""
    try:
        # Apply the operation
        result = collaboration_service.apply_delta_operation(
            document_id,
            operation_request.operation,
            current_user.id
        )
        
        if not result:
            raise HTTPException(status_code=400, detail="Failed to apply operation")
        
        # Get updated document state
        document_state = collaboration_service.get_document_state(document_id)
        
        # Broadcast operation to other collaborators in the background
        background_tasks.add_task(
            broadcast_operation_to_collaborators,
            document_id,
            operation_request.operation,
            current_user.id,
            document_state["version"]
        )
        
        return DocumentOperationResponse(
            success=True,
            version=document_state["version"],
            message="Operation applied successfully"
        )
        
    except Exception as e:
        logger.error(f"Error applying operation to document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def broadcast_operation_to_collaborators(
    document_id: str,
    operation: Dict[str, Any],
    user_id: str,
    version: int
):
    """Background task to broadcast operation to collaborators"""
    try:
        message = {
            "type": "document_operation",
            "document_id": document_id,
            "operation": operation,
            "user_id": user_id,
            "version": version
        }
        
        await websocket_manager.send_to_document_room(
            document_id,
            message,
            exclude_user=user_id
        )
        
    except Exception as e:
        logger.error(f"Error broadcasting operation: {e}")


@router.get("/state/{document_id}", response_model=DocumentStateResponse)
async def get_document_state(
    document_id: str,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Get current document state for collaboration"""
    try:
        document_state = collaboration_service.get_document_state(document_id)
        
        return DocumentStateResponse(
            document_id=document_id,
            version=document_state["version"],
            content=document_state["content"],
            last_modified=document_state["last_modified"]
        )
        
    except Exception as e:
        logger.error(f"Error getting document state for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/operations-since/{document_id}", response_model=OperationsSinceResponse)
async def get_operations_since(
    document_id: str,
    request: OperationsSinceRequest,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Get operations since a specific version for synchronization"""
    try:
        operations = collaboration_service.get_operations_since(document_id, request.since_version)
        
        return OperationsSinceResponse(
            document_id=document_id,
            operations=operations
        )
        
    except Exception as e:
        logger.error(f"Error getting operations since version {request.since_version} for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resolve-conflicts/{document_id}", response_model=ConflictResolutionResponse)
async def resolve_conflicts(
    document_id: str,
    request: ConflictResolutionRequest,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Resolve conflicts using Operational Transform"""
    try:
        resolved_operations = collaboration_service.resolve_conflicts(request.operations, document_id)
        
        return ConflictResolutionResponse(
            document_id=document_id,
            resolved_operations=resolved_operations
        )
        
    except Exception as e:
        logger.error(f"Error resolving conflicts for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/snapshot/{document_id}", response_model=DocumentSnapshotResponse)
async def create_document_snapshot(
    document_id: str,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Create a snapshot of current document state"""
    try:
        snapshot = collaboration_service.create_document_snapshot(document_id)
        
        if not snapshot:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return DocumentSnapshotResponse(**snapshot)
        
    except Exception as e:
        logger.error(f"Error creating snapshot for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{document_id}", response_model=CollaborationStatsResponse)
async def get_collaboration_statistics(
    document_id: str,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Get collaboration statistics for a document"""
    try:
        stats = collaboration_service.get_collaboration_statistics(document_id)
        
        if not stats:
            raise HTTPException(status_code=404, detail="Document not found or no statistics available")
        
        return CollaborationStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Error getting collaboration statistics for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/undo/{document_id}", response_model=UndoRedoResponse)
async def undo_operation(
    document_id: str,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Undo the last operation by current user"""
    try:
        result = collaboration_service.undo_operation(document_id, current_user.id)
        
        return UndoRedoResponse(
            success=result,
            message="Operation undone successfully" if result else "No operation to undo"
        )
        
    except Exception as e:
        logger.error(f"Error undoing operation for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/redo/{document_id}", response_model=UndoRedoResponse)
async def redo_operation(
    document_id: str,
    current_user: User = Depends(get_current_user),
    collaboration_service: DocumentCollaborationService = Depends(get_collaboration_service)
):
    """Redo the last undone operation by current user"""
    try:
        result = collaboration_service.redo_operation(document_id, current_user.id)
        
        return UndoRedoResponse(
            success=result,
            message="Operation redone successfully" if result else "No operation to redo or redo not implemented"
        )
        
    except Exception as e:
        logger.error(f"Error redoing operation for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))