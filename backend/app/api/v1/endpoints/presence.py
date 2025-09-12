"""
Presence awareness endpoints for real-time collaborative editing
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.websocket_manager import WebSocketManager
from app.services.presence_service import PresenceService
from app.models.user import User
from app.schemas.presence import (
    JoinDocumentRequest,
    JoinDocumentResponse,
    LeaveDocumentResponse,
    CursorUpdateRequest,
    CursorUpdateResponse,
    DocumentPresenceResponse,
    UserPresenceResponse,
    PresenceStatsResponse
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global instances (in production, use dependency injection)
websocket_manager = WebSocketManager()
presence_service = PresenceService(websocket_manager)


def get_presence_service() -> PresenceService:
    """Get presence service instance"""
    return presence_service


@router.post("/join/{document_id}", response_model=JoinDocumentResponse)
async def join_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Join a document for collaborative editing with presence awareness"""
    try:
        # Add user to document presence
        user_presence = presence_service.join_document(current_user, document_id)
        
        # Join WebSocket room for real-time updates
        websocket_manager.join_document_room(current_user.id, document_id)
        
        # Get all current collaborators
        all_collaborators = presence_service.get_document_presence(document_id)
        
        # Broadcast user joined to other collaborators
        background_tasks.add_task(
            presence_service.broadcast_user_joined,
            current_user.id,
            document_id,
            user_presence.user_name
        )
        
        return JoinDocumentResponse(
            success=True,
            user_presence=user_presence.to_dict(),
            collaborators=all_collaborators,
            message="Successfully joined document for collaboration"
        )
        
    except Exception as e:
        logger.error(f"Error joining document {document_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leave/{document_id}", response_model=LeaveDocumentResponse)
async def leave_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Leave a document and remove from presence tracking"""
    try:
        # Remove user from presence tracking
        success = presence_service.leave_document(current_user.id, document_id)
        
        # Leave WebSocket room
        websocket_manager.leave_document_room(current_user.id, document_id)
        
        # Broadcast user left to other collaborators
        if success:
            background_tasks.add_task(
                presence_service.broadcast_user_left,
                current_user.id,
                document_id,
                current_user.full_name or current_user.email
            )
        
        return LeaveDocumentResponse(
            success=success,
            message="Successfully left document" if success else "User was not in document"
        )
        
    except Exception as e:
        logger.error(f"Error leaving document {document_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cursor/{document_id}", response_model=CursorUpdateResponse)
async def update_cursor_position(
    document_id: str,
    cursor_update: CursorUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Update user's cursor position and selection in document"""
    try:
        # Update cursor position
        success = presence_service.update_cursor_position(
            current_user.id,
            document_id,
            cursor_update.cursor_position,
            cursor_update.selection_range
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="User not found in document or document not found"
            )
        
        # Get updated presence data
        user_presence = presence_service.get_user_presence(current_user.id, document_id)
        
        # Broadcast cursor update to other collaborators
        if user_presence:
            background_tasks.add_task(
                presence_service.broadcast_presence_update,
                current_user.id,
                document_id,
                user_presence,
                current_user.id  # exclude self from broadcast
            )
        
        return CursorUpdateResponse(
            success=True,
            user_presence=user_presence,
            message="Cursor position updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cursor for user {current_user.id} in document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/document/{document_id}", response_model=DocumentPresenceResponse)
async def get_document_presence(
    document_id: str,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Get all active users in a document"""
    try:
        collaborators = presence_service.get_document_presence(document_id)
        
        return DocumentPresenceResponse(
            document_id=document_id,
            collaborators=collaborators,
            active_count=len(collaborators)
        )
        
    except Exception as e:
        logger.error(f"Error getting document presence for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{document_id}", response_model=UserPresenceResponse)
async def get_user_presence(
    document_id: str,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Get current user's presence in a document"""
    try:
        user_presence = presence_service.get_user_presence(current_user.id, document_id)
        
        if not user_presence:
            raise HTTPException(
                status_code=404,
                detail="User presence not found in document"
            )
        
        return UserPresenceResponse(
            user_presence=user_presence,
            is_active=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user presence for {current_user.id} in {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=PresenceStatsResponse)
async def get_presence_statistics(
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Get presence service statistics (admin endpoint)"""
    try:
        # In production, add role-based access control for admin endpoints
        stats = presence_service.get_presence_statistics()
        
        return PresenceStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Error getting presence statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup")
async def cleanup_inactive_users(
    timeout_minutes: int = 5,
    current_user: User = Depends(get_current_user),
    presence_service: PresenceService = Depends(get_presence_service)
):
    """Manually trigger cleanup of inactive users (admin endpoint)"""
    try:
        # In production, add role-based access control for admin endpoints
        cleaned_count = presence_service.cleanup_inactive_users(timeout_minutes)
        
        return {
            "success": True,
            "cleaned_users": cleaned_count,
            "timeout_minutes": timeout_minutes,
            "message": f"Cleaned up {cleaned_count} inactive users"
        }
        
    except Exception as e:
        logger.error(f"Error during manual cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))