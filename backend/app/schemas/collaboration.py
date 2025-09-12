"""
Pydantic schemas for collaboration endpoints
"""
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime


class DocumentOperationRequest(BaseModel):
    """Request schema for applying document operations"""
    operation: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
                "operation": {
                    "type": "delta",
                    "ops": [
                        {"retain": 10},
                        {"insert": " new text"}
                    ]
                }
            }
        }


class DocumentOperationResponse(BaseModel):
    """Response schema for document operations"""
    success: bool
    version: int
    message: str
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "version": 5,
                "message": "Operation applied successfully"
            }
        }


class DocumentStateResponse(BaseModel):
    """Response schema for document state"""
    document_id: str
    version: int
    content: Optional[Dict[str, Any]]
    last_modified: Optional[str]
    
    class Config:
        schema_extra = {
            "example": {
                "document_id": "doc-123",
                "version": 5,
                "content": {
                    "ops": [
                        {"insert": "Document content here\n"}
                    ]
                },
                "last_modified": "2023-12-01T10:00:00Z"
            }
        }


class OperationsSinceRequest(BaseModel):
    """Request schema for getting operations since a version"""
    since_version: int
    
    class Config:
        schema_extra = {
            "example": {
                "since_version": 3
            }
        }


class OperationsSinceResponse(BaseModel):
    """Response schema for operations since a version"""
    document_id: str
    operations: List[Dict[str, Any]]
    
    class Config:
        schema_extra = {
            "example": {
                "document_id": "doc-123",
                "operations": [
                    {
                        "operation_id": "op-456",
                        "operation": {
                            "type": "delta",
                            "ops": [{"insert": "text"}]
                        },
                        "user_id": "user-789",
                        "version": 4,
                        "timestamp": "2023-12-01T10:00:00Z"
                    }
                ]
            }
        }


class ConflictResolutionRequest(BaseModel):
    """Request schema for conflict resolution"""
    operations: List[Dict[str, Any]]
    
    class Config:
        schema_extra = {
            "example": {
                "operations": [
                    {
                        "type": "delta",
                        "ops": [{"retain": 5}, {"insert": " first"}],
                        "timestamp": "2023-12-01T10:00:00Z"
                    },
                    {
                        "type": "delta", 
                        "ops": [{"retain": 5}, {"insert": " second"}],
                        "timestamp": "2023-12-01T10:00:01Z"
                    }
                ]
            }
        }


class ConflictResolutionResponse(BaseModel):
    """Response schema for conflict resolution"""
    document_id: str
    resolved_operations: List[Dict[str, Any]]
    
    class Config:
        schema_extra = {
            "example": {
                "document_id": "doc-123",
                "resolved_operations": [
                    {
                        "type": "delta",
                        "ops": [{"retain": 5}, {"insert": " first"}]
                    },
                    {
                        "type": "delta",
                        "ops": [{"retain": 11}, {"insert": " second"}]
                    }
                ]
            }
        }


class DocumentSnapshotResponse(BaseModel):
    """Response schema for document snapshots"""
    snapshot_id: str
    document_id: str
    version: int
    content: Dict[str, Any]
    created_at: str
    operations_count: int
    
    class Config:
        schema_extra = {
            "example": {
                "snapshot_id": "snap-123",
                "document_id": "doc-456",
                "version": 10,
                "content": {
                    "ops": [{"insert": "Document content\n"}]
                },
                "created_at": "2023-12-01T10:00:00Z",
                "operations_count": 25
            }
        }


class CollaborationStatsResponse(BaseModel):
    """Response schema for collaboration statistics"""
    document_id: str
    total_operations: int
    active_collaborators: int
    collaborator_ids: List[str]
    current_version: int
    user_activity: Dict[str, int]
    last_activity: Optional[str]
    
    class Config:
        schema_extra = {
            "example": {
                "document_id": "doc-123",
                "total_operations": 50,
                "active_collaborators": 3,
                "collaborator_ids": ["user-1", "user-2", "user-3"],
                "current_version": 15,
                "user_activity": {
                    "user-1": 20,
                    "user-2": 15,
                    "user-3": 15
                },
                "last_activity": "2023-12-01T10:00:00Z"
            }
        }


class UndoRedoRequest(BaseModel):
    """Request schema for undo/redo operations"""
    pass  # No additional data needed, user is from auth


class UndoRedoResponse(BaseModel):
    """Response schema for undo/redo operations"""
    success: bool
    message: str
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Operation undone successfully"
            }
        }