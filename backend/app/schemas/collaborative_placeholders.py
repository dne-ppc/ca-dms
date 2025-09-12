"""
Pydantic schemas for collaborative placeholder management endpoints
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class CreatePlaceholderRequest(BaseModel):
    """Request schema for creating a placeholder"""
    placeholder_type: str = Field(..., description="Type of placeholder (signature, long_response, line_segment, version_table)")
    data: Dict[str, Any] = Field(..., description="Placeholder-specific data")
    position: Optional[int] = Field(None, description="Position in document where placeholder is inserted")
    
    class Config:
        json_schema_extra = {
            "example": {
                "placeholder_type": "signature",
                "data": {
                    "label": "Board President",
                    "includeTitle": True,
                    "includeDate": True,
                    "required": True
                },
                "position": 150
            }
        }


class CreatePlaceholderResponse(BaseModel):
    """Response schema for placeholder creation"""
    success: bool
    placeholder_id: str
    placeholder_data: Dict[str, Any]
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "placeholder_id": "signature_20231201120000_a1b2c3d4",
                "placeholder_data": {
                    "id": "signature_20231201120000_a1b2c3d4",
                    "type": "signature",
                    "label": "Board President",
                    "includeTitle": True,
                    "includeDate": True,
                    "required": True,
                    "created_by": "user-123",
                    "created_at": "2023-12-01T12:00:00Z",
                    "position": 150,
                    "locked_by": None,
                    "is_locked": False
                },
                "message": "Placeholder created successfully"
            }
        }


class UpdatePlaceholderRequest(BaseModel):
    """Request schema for updating a placeholder"""
    updates: Dict[str, Any] = Field(..., description="Updates to apply to the placeholder")
    
    class Config:
        json_schema_extra = {
            "example": {
                "updates": {
                    "label": "Updated Board President",
                    "includeTitle": False
                }
            }
        }


class UpdatePlaceholderResponse(BaseModel):
    """Response schema for placeholder update"""
    success: bool
    placeholder_data: Dict[str, Any]
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "placeholder_data": {
                    "id": "signature_20231201120000_a1b2c3d4",
                    "type": "signature",
                    "label": "Updated Board President",
                    "includeTitle": False,
                    "includeDate": True,
                    "required": True,
                    "created_by": "user-123",
                    "created_at": "2023-12-01T12:00:00Z",
                    "updated_by": "user-123",
                    "updated_at": "2023-12-01T12:05:00Z",
                    "position": 150,
                    "locked_by": None,
                    "is_locked": False
                },
                "message": "Placeholder updated successfully"
            }
        }


class DeletePlaceholderResponse(BaseModel):
    """Response schema for placeholder deletion"""
    success: bool
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Placeholder deleted successfully"
            }
        }


class LockPlaceholderResponse(BaseModel):
    """Response schema for placeholder locking"""
    success: bool
    locked_by: str
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "locked_by": "user-123",
                "message": "Placeholder locked successfully"
            }
        }


class UnlockPlaceholderResponse(BaseModel):
    """Response schema for placeholder unlocking"""
    success: bool
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Placeholder unlocked successfully"
            }
        }


class DocumentPlaceholdersResponse(BaseModel):
    """Response schema for document placeholders"""
    document_id: str
    placeholders: Dict[str, Dict[str, Any]]
    count: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc-123",
                "placeholders": {
                    "signature_20231201120000_a1b2c3d4": {
                        "id": "signature_20231201120000_a1b2c3d4",
                        "type": "signature",
                        "label": "Board President",
                        "includeTitle": True,
                        "includeDate": True,
                        "required": True,
                        "created_by": "user-123",
                        "created_at": "2023-12-01T12:00:00Z",
                        "position": 150,
                        "locked_by": None,
                        "is_locked": False
                    },
                    "long_response_20231201120100_b2c3d4e5": {
                        "id": "long_response_20231201120100_b2c3d4e5",
                        "type": "long_response",
                        "label": "Committee Response",
                        "lines": 5,
                        "placeholder_text": "Enter your response here...",
                        "created_by": "user-456",
                        "created_at": "2023-12-01T12:01:00Z",
                        "position": 300,
                        "locked_by": "user-789",
                        "is_locked": True
                    }
                },
                "count": 2
            }
        }


class PlaceholderUpdatesRequest(BaseModel):
    """Request schema for getting placeholder updates"""
    since_timestamp: str = Field(..., description="ISO timestamp to get updates since")
    
    class Config:
        json_schema_extra = {
            "example": {
                "since_timestamp": "2023-12-01T12:00:00Z"
            }
        }


class PlaceholderUpdateData(BaseModel):
    """Schema for placeholder update data"""
    update_id: str
    placeholder_id: str
    placeholder_type: str
    user_id: str
    operation: str  # create, update, delete, lock, unlock
    data: Dict[str, Any]
    timestamp: str
    position: Optional[int] = None


class PlaceholderUpdatesResponse(BaseModel):
    """Response schema for placeholder updates"""
    document_id: str
    updates: List[PlaceholderUpdateData]
    count: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc-123",
                "updates": [
                    {
                        "update_id": "update-789",
                        "placeholder_id": "signature_20231201120000_a1b2c3d4",
                        "placeholder_type": "signature",
                        "user_id": "user-123",
                        "operation": "update",
                        "data": {
                            "label": "Updated Board President"
                        },
                        "timestamp": "2023-12-01T12:05:00Z",
                        "position": None
                    }
                ],
                "count": 1
            }
        }


class PlaceholderStatsResponse(BaseModel):
    """Response schema for placeholder statistics"""
    total_documents: int
    total_placeholders: int
    total_locks: int
    type_distribution: Dict[str, int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_documents": 15,
                "total_placeholders": 45,
                "total_locks": 3,
                "type_distribution": {
                    "signature": 20,
                    "long_response": 15,
                    "line_segment": 8,
                    "version_table": 2
                }
            }
        }


class PlaceholderWebSocketMessage(BaseModel):
    """Schema for WebSocket placeholder messages"""
    type: str = Field(..., description="Message type (placeholder_update)")
    document_id: str
    placeholder_id: str
    operation: str  # create, update, delete, lock, unlock
    user_id: str
    data: Dict[str, Any]
    timestamp: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "placeholder_update",
                "document_id": "doc-123",
                "placeholder_id": "signature_20231201120000_a1b2c3d4",
                "operation": "update",
                "user_id": "user-123",
                "data": {
                    "label": "Updated Board President",
                    "includeTitle": False
                },
                "timestamp": "2023-12-01T12:05:00Z"
            }
        }


# Specific placeholder type schemas for validation

class SignaturePlaceholderData(BaseModel):
    """Schema for signature placeholder data"""
    label: str = Field(..., description="Label for the signature field")
    includeTitle: bool = Field(True, description="Whether to include title field")
    includeDate: bool = Field(True, description="Whether to include date field")
    required: bool = Field(True, description="Whether signature is required")


class LongResponsePlaceholderData(BaseModel):
    """Schema for long response placeholder data"""
    lines: int = Field(..., ge=1, description="Number of lines for response area")
    label: str = Field("Response", description="Label for the response area")
    placeholder_text: str = Field("Enter your response here...", description="Placeholder text")


class LineSegmentPlaceholderData(BaseModel):
    """Schema for line segment placeholder data"""
    length: str = Field(..., pattern="^(short|medium|long)$", description="Length of the line segment")
    label: str = Field("Input", description="Label for the line segment")


class VersionTablePlaceholderData(BaseModel):
    """Schema for version table placeholder data"""
    version: int = Field(1, ge=1, description="Version number")
    immutable: bool = Field(True, description="Whether the version table is immutable")
    protected: bool = Field(True, description="Whether the version table is protected from deletion")