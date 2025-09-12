"""
Pydantic schemas for document operations
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    """Base document schema"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Dict[str, Any] = Field(..., description="Quill Delta format content")
    document_type: str = Field(default="governance", max_length=50)
    placeholders: Optional[Dict[str, Any]] = Field(None, description="Placeholder metadata")


class DocumentCreate(DocumentBase):
    """Schema for creating a new document"""
    pass


class DocumentUpdate(BaseModel):
    """Schema for updating an existing document"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[Dict[str, Any]] = Field(None, description="Quill Delta format content")
    document_type: Optional[str] = Field(None, max_length=50)
    placeholders: Optional[Dict[str, Any]] = Field(None, description="Placeholder metadata")


class DocumentResponse(DocumentBase):
    """Schema for document responses"""
    id: str
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    """Schema for document list responses"""
    documents: List[DocumentResponse]
    total: int
    skip: int
    limit: int


class PlaceholderMetadata(BaseModel):
    """Schema for placeholder metadata"""
    signatures: List[Dict[str, Any]] = Field(default_factory=list)
    longResponses: List[Dict[str, Any]] = Field(default_factory=list)
    lineSegments: List[Dict[str, Any]] = Field(default_factory=list)
    versionTables: List[Dict[str, Any]] = Field(default_factory=list)


class DocumentSearchQuery(BaseModel):
    """Schema for document search queries"""
    query: str = Field(..., min_length=1)
    document_type: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)


class DocumentSearchResponse(BaseModel):
    """Schema for document search results"""
    documents: List[DocumentResponse]
    query: str
    total: int