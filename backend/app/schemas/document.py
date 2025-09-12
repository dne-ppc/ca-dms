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


class SearchHighlight(BaseModel):
    """Schema for search result highlights"""
    field: str = Field(..., description="Field name (title or content)")
    content: str = Field(..., description="Highlighted content with markup")


class AdvancedSearchResult(BaseModel):
    """Schema for advanced search result with metadata"""
    document: DocumentResponse
    relevance_score: float = Field(default=0.0, ge=0.0)
    highlights: List[SearchHighlight] = Field(default_factory=list)
    preview: Optional[str] = Field(None, description="Context preview around matches")


class SearchStatistics(BaseModel):
    """Schema for search result statistics"""
    total_matches: int
    search_time_ms: float
    document_type_breakdown: Dict[str, int]
    query: Optional[str]
    timestamp: str


class AdvancedSearchQuery(BaseModel):
    """Schema for advanced search queries"""
    query: Optional[str] = Field(None, description="Search query text")
    document_type: Optional[str] = Field(None, description="Filter by document type")
    created_by: Optional[str] = Field(None, description="Filter by author")
    created_after: Optional[str] = Field(None, description="Filter by creation date (ISO format)")
    created_before: Optional[str] = Field(None, description="Filter by creation date (ISO format)")
    sort_by: str = Field(default="relevance", description="Sort field: relevance, created_at, title")
    sort_order: str = Field(default="desc", description="Sort order: asc, desc")
    limit: int = Field(default=50, ge=1, le=100, description="Maximum results to return")
    offset: int = Field(default=0, ge=0, description="Number of results to skip")
    include_highlights: bool = Field(default=False, description="Include highlighted matches")
    context_length: int = Field(default=50, ge=0, le=200, description="Characters of context around matches")
    search_placeholders: bool = Field(default=True, description="Include placeholder content in search")
    fuzzy: bool = Field(default=False, description="Enable fuzzy matching for typos")
    include_stats: bool = Field(default=False, description="Include search statistics")


class AdvancedSearchResponse(BaseModel):
    """Schema for advanced search responses"""
    results: List[AdvancedSearchResult]
    total: int
    query: Optional[str]
    statistics: Optional[SearchStatistics] = None
    offset: int
    limit: int