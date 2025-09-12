"""
Pydantic schemas for presence awareness endpoints
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class JoinDocumentRequest(BaseModel):
    """Request schema for joining a document"""
    # No additional data needed beyond document_id in path and user from auth
    pass


class UserPresenceData(BaseModel):
    """Schema for user presence data"""
    user_id: str
    user_name: str
    document_id: str
    cursor_position: Optional[int] = None
    selection_range: Optional[Dict[str, int]] = None
    last_seen: Optional[str] = None
    color: str
    is_active: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user-123",
                "user_name": "John Doe",
                "document_id": "doc-456",
                "cursor_position": 150,
                "selection_range": {"start": 100, "end": 200},
                "last_seen": "2023-12-01T10:00:00Z",
                "color": "#FF6B6B",
                "is_active": True
            }
        }


class JoinDocumentResponse(BaseModel):
    """Response schema for joining a document"""
    success: bool
    user_presence: UserPresenceData
    collaborators: List[UserPresenceData]
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_presence": {
                    "user_id": "user-123",
                    "user_name": "John Doe",
                    "document_id": "doc-456",
                    "cursor_position": None,
                    "selection_range": None,
                    "last_seen": "2023-12-01T10:00:00Z",
                    "color": "#FF6B6B",
                    "is_active": True
                },
                "collaborators": [
                    {
                        "user_id": "user-789",
                        "user_name": "Jane Smith",
                        "document_id": "doc-456",
                        "cursor_position": 75,
                        "selection_range": None,
                        "last_seen": "2023-12-01T09:58:00Z",
                        "color": "#4ECDC4",
                        "is_active": True
                    }
                ],
                "message": "Successfully joined document for collaboration"
            }
        }


class LeaveDocumentResponse(BaseModel):
    """Response schema for leaving a document"""
    success: bool
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Successfully left document"
            }
        }


class CursorUpdateRequest(BaseModel):
    """Request schema for updating cursor position"""
    cursor_position: int = Field(..., description="Current cursor position in document")
    selection_range: Optional[Dict[str, int]] = Field(
        None, 
        description="Selection range with start and end positions"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "cursor_position": 150,
                "selection_range": {
                    "start": 100,
                    "end": 200
                }
            }
        }


class CursorUpdateResponse(BaseModel):
    """Response schema for cursor position update"""
    success: bool
    user_presence: Optional[UserPresenceData] = None
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_presence": {
                    "user_id": "user-123",
                    "user_name": "John Doe",
                    "document_id": "doc-456",
                    "cursor_position": 150,
                    "selection_range": {"start": 100, "end": 200},
                    "last_seen": "2023-12-01T10:00:00Z",
                    "color": "#FF6B6B",
                    "is_active": True
                },
                "message": "Cursor position updated successfully"
            }
        }


class DocumentPresenceResponse(BaseModel):
    """Response schema for document presence information"""
    document_id: str
    collaborators: List[UserPresenceData]
    active_count: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc-456",
                "collaborators": [
                    {
                        "user_id": "user-123",
                        "user_name": "John Doe",
                        "document_id": "doc-456",
                        "cursor_position": 150,
                        "selection_range": None,
                        "last_seen": "2023-12-01T10:00:00Z",
                        "color": "#FF6B6B",
                        "is_active": True
                    },
                    {
                        "user_id": "user-789",
                        "user_name": "Jane Smith",
                        "document_id": "doc-456",
                        "cursor_position": 75,
                        "selection_range": {"start": 50, "end": 100},
                        "last_seen": "2023-12-01T09:58:00Z",
                        "color": "#4ECDC4",
                        "is_active": True
                    }
                ],
                "active_count": 2
            }
        }


class UserPresenceResponse(BaseModel):
    """Response schema for user presence information"""
    user_presence: UserPresenceData
    is_active: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_presence": {
                    "user_id": "user-123",
                    "user_name": "John Doe",
                    "document_id": "doc-456",
                    "cursor_position": 150,
                    "selection_range": {"start": 100, "end": 200},
                    "last_seen": "2023-12-01T10:00:00Z",
                    "color": "#FF6B6B",
                    "is_active": True
                },
                "is_active": True
            }
        }


class DocumentStatsData(BaseModel):
    """Schema for per-document presence statistics"""
    active_users: int
    total_users: int


class PresenceStatsResponse(BaseModel):
    """Response schema for presence service statistics"""
    total_documents: int = Field(..., description="Total number of documents with presence")
    total_active_users: int = Field(..., description="Total number of active users")
    document_stats: Dict[str, DocumentStatsData] = Field(
        ..., 
        description="Per-document presence statistics"
    )
    cleanup_candidates: int = Field(..., description="Number of users eligible for cleanup")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_documents": 5,
                "total_active_users": 12,
                "document_stats": {
                    "doc-123": {
                        "active_users": 3,
                        "total_users": 3
                    },
                    "doc-456": {
                        "active_users": 2,
                        "total_users": 4
                    }
                },
                "cleanup_candidates": 2
            }
        }


class PresenceWebSocketMessage(BaseModel):
    """Schema for WebSocket presence messages"""
    type: str = Field(..., description="Message type (presence_update, user_joined, user_left)")
    document_id: str
    user_id: str
    timestamp: str
    user_name: Optional[str] = None
    presence: Optional[UserPresenceData] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "presence_update",
                "document_id": "doc-456",
                "user_id": "user-123",
                "timestamp": "2023-12-01T10:00:00Z",
                "presence": {
                    "user_id": "user-123",
                    "user_name": "John Doe",
                    "document_id": "doc-456",
                    "cursor_position": 150,
                    "selection_range": {"start": 100, "end": 200},
                    "last_seen": "2023-12-01T10:00:00Z",
                    "color": "#FF6B6B",
                    "is_active": True
                }
            }
        }