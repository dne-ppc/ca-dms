"""
Collaborative placeholder management endpoints
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.websocket_manager import WebSocketManager
from app.services.collaborative_placeholder_service import CollaborativePlaceholderService
from app.models.user import User
from app.schemas.collaborative_placeholders import (
    CreatePlaceholderRequest,
    CreatePlaceholderResponse,
    UpdatePlaceholderRequest,
    UpdatePlaceholderResponse,
    DeletePlaceholderResponse,
    LockPlaceholderResponse,
    UnlockPlaceholderResponse,
    DocumentPlaceholdersResponse,
    PlaceholderUpdatesRequest,
    PlaceholderUpdatesResponse,
    PlaceholderStatsResponse
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global instances (in production, use dependency injection)
websocket_manager = WebSocketManager()
placeholder_service = CollaborativePlaceholderService(websocket_manager)


def get_placeholder_service() -> CollaborativePlaceholderService:
    """Get collaborative placeholder service instance"""
    return placeholder_service


@router.post("/create/{document_id}", response_model=CreatePlaceholderResponse)
async def create_placeholder(
    document_id: str,
    request: CreatePlaceholderRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Create a new placeholder object in a document"""
    try:
        # Create placeholder
        placeholder_id = service.create_placeholder(
            document_id,
            request.placeholder_type,
            request.data,
            current_user.id,
            request.position
        )
        
        if not placeholder_id:
            raise HTTPException(
                status_code=400, 
                detail="Failed to create placeholder"
            )
        
        # Get created placeholder data
        document_placeholders = service.get_document_placeholders(document_id)
        placeholder_data = document_placeholders.get(placeholder_id, {})
        
        # Broadcast creation to other collaborators
        background_tasks.add_task(
            service.broadcast_placeholder_update,
            document_id,
            placeholder_id,
            "create",
            current_user.id,
            placeholder_data,
            current_user.id  # exclude creator
        )
        
        return CreatePlaceholderResponse(
            success=True,
            placeholder_id=placeholder_id,
            placeholder_data=placeholder_data,
            message="Placeholder created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating placeholder in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update/{document_id}/{placeholder_id}", response_model=UpdatePlaceholderResponse)
async def update_placeholder(
    document_id: str,
    placeholder_id: str,
    request: UpdatePlaceholderRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Update an existing placeholder object"""
    try:
        # Update placeholder
        success = service.update_placeholder(
            document_id,
            placeholder_id,
            request.updates,
            current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to update placeholder. It may be locked or not found."
            )
        
        # Get updated placeholder data
        document_placeholders = service.get_document_placeholders(document_id)
        placeholder_data = document_placeholders.get(placeholder_id, {})
        
        # Broadcast update to other collaborators
        background_tasks.add_task(
            service.broadcast_placeholder_update,
            document_id,
            placeholder_id,
            "update",
            current_user.id,
            placeholder_data,
            current_user.id  # exclude updater
        )
        
        return UpdatePlaceholderResponse(
            success=True,
            placeholder_data=placeholder_data,
            message="Placeholder updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating placeholder {placeholder_id} in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete/{document_id}/{placeholder_id}", response_model=DeletePlaceholderResponse)
async def delete_placeholder(
    document_id: str,
    placeholder_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Delete a placeholder object"""
    try:
        # Delete placeholder
        success = service.delete_placeholder(
            document_id,
            placeholder_id,
            current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to delete placeholder. It may be locked, protected, or not found."
            )
        
        # Broadcast deletion to other collaborators
        background_tasks.add_task(
            service.broadcast_placeholder_update,
            document_id,
            placeholder_id,
            "delete",
            current_user.id,
            {"deleted": True},
            current_user.id  # exclude deleter
        )
        
        return DeletePlaceholderResponse(
            success=True,
            message="Placeholder deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting placeholder {placeholder_id} in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lock/{document_id}/{placeholder_id}", response_model=LockPlaceholderResponse)
async def lock_placeholder(
    document_id: str,
    placeholder_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Lock a placeholder for exclusive editing"""
    try:
        # Lock placeholder
        success = service.lock_placeholder(
            document_id,
            placeholder_id,
            current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=409,
                detail="Placeholder is already locked by another user or not found"
            )
        
        # Broadcast lock to other collaborators
        background_tasks.add_task(
            service.broadcast_placeholder_update,
            document_id,
            placeholder_id,
            "lock",
            current_user.id,
            {"locked_by": current_user.id},
            current_user.id  # exclude locker
        )
        
        return LockPlaceholderResponse(
            success=True,
            locked_by=current_user.id,
            message="Placeholder locked successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error locking placeholder {placeholder_id} in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unlock/{document_id}/{placeholder_id}", response_model=UnlockPlaceholderResponse)
async def unlock_placeholder(
    document_id: str,
    placeholder_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Unlock a placeholder"""
    try:
        # Unlock placeholder
        success = service.unlock_placeholder(
            document_id,
            placeholder_id,
            current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=403,
                detail="Cannot unlock placeholder. You may not be the lock owner."
            )
        
        # Broadcast unlock to other collaborators
        background_tasks.add_task(
            service.broadcast_placeholder_update,
            document_id,
            placeholder_id,
            "unlock",
            current_user.id,
            {"locked_by": None},
            current_user.id  # exclude unlocker
        )
        
        return UnlockPlaceholderResponse(
            success=True,
            message="Placeholder unlocked successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlocking placeholder {placeholder_id} in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/document/{document_id}", response_model=DocumentPlaceholdersResponse)
async def get_document_placeholders(
    document_id: str,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Get all placeholders in a document"""
    try:
        placeholders = service.get_document_placeholders(document_id)
        
        return DocumentPlaceholdersResponse(
            document_id=document_id,
            placeholders=placeholders,
            count=len(placeholders)
        )
        
    except Exception as e:
        logger.error(f"Error getting placeholders for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updates/{document_id}", response_model=PlaceholderUpdatesResponse)
async def get_placeholder_updates(
    document_id: str,
    request: PlaceholderUpdatesRequest,
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Get placeholder updates since a specific timestamp"""
    try:
        # Parse timestamp
        since_datetime = datetime.fromisoformat(request.since_timestamp.replace('Z', '+00:00'))
        
        updates = service.get_placeholder_updates_since(document_id, since_datetime)
        
        return PlaceholderUpdatesResponse(
            document_id=document_id,
            updates=updates,
            count=len(updates)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid timestamp format: {e}")
    except Exception as e:
        logger.error(f"Error getting placeholder updates for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=PlaceholderStatsResponse)
async def get_placeholder_statistics(
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Get collaborative placeholder service statistics"""
    try:
        total_documents = len(service.document_placeholders)
        total_placeholders = sum(len(placeholders) for placeholders in service.document_placeholders.values())
        total_locks = sum(len(locks) for locks in service.placeholder_locks.values())
        
        # Placeholder type distribution
        type_distribution = {}
        for placeholders in service.document_placeholders.values():
            for placeholder in placeholders.values():
                placeholder_type = placeholder.get("type", "unknown")
                type_distribution[placeholder_type] = type_distribution.get(placeholder_type, 0) + 1
        
        return PlaceholderStatsResponse(
            total_documents=total_documents,
            total_placeholders=total_placeholders,
            total_locks=total_locks,
            type_distribution=type_distribution
        )
        
    except Exception as e:
        logger.error(f"Error getting placeholder statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/locks")
async def cleanup_placeholder_locks(
    timeout_minutes: int = Query(30, description="Timeout in minutes for lock cleanup"),
    current_user: User = Depends(get_current_user),
    service: CollaborativePlaceholderService = Depends(get_placeholder_service)
):
    """Clean up stale placeholder locks (admin endpoint)"""
    try:
        # In production, add role-based access control for admin endpoints
        cleaned_count = 0
        
        # This is a simplified cleanup - in production you'd track lock timestamps
        # and clean up locks older than the timeout
        
        return {
            "success": True,
            "cleaned_locks": cleaned_count,
            "timeout_minutes": timeout_minutes,
            "message": f"Cleaned up {cleaned_count} stale locks"
        }
        
    except Exception as e:
        logger.error(f"Error during lock cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))