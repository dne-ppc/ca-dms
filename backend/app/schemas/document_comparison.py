"""
Pydantic schemas for document comparison functionality
"""
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# Change tracking schemas

class DeltaChangeSchema(BaseModel):
    """Schema for representing a change in Delta content"""
    type: str = Field(..., description="Type of change: insert, delete, modify, retain")
    old_op: Optional[Dict[str, Any]] = Field(None, description="Original operation")
    new_op: Optional[Dict[str, Any]] = Field(None, description="New operation")
    position: int = Field(0, description="Position in the document")
    length: int = Field(0, description="Length of the change")
    attributes_changed: Optional[List[str]] = Field(None, description="List of changed attributes")


class ComparisonResultSchema(BaseModel):
    """Schema for document comparison results"""
    changes: List[DeltaChangeSchema] = Field(..., description="List of changes between documents")
    added_text: int = Field(0, description="Amount of text added")
    deleted_text: int = Field(0, description="Amount of text deleted")
    modified_text: int = Field(0, description="Amount of text modified")
    total_changes: int = Field(0, description="Total number of changes")
    similarity_score: float = Field(0.0, description="Similarity score between 0.0 and 1.0")


class PlaceholderChangeSchema(BaseModel):
    """Schema for placeholder-specific changes"""
    type: str = Field(..., description="Type of change: added, deleted, modified")
    placeholder_type: str = Field(..., description="Type of placeholder")
    old_data: Optional[Dict[str, Any]] = Field(None, description="Original placeholder data")
    new_data: Optional[Dict[str, Any]] = Field(None, description="New placeholder data")
    position: int = Field(0, description="Position in document")


# API request/response schemas

class DocumentCompareRequest(BaseModel):
    """Request schema for comparing two document versions"""
    document_id: str = Field(..., description="Document ID")
    old_version: int = Field(..., description="Version number of the original document")
    new_version: int = Field(..., description="Version number of the new document")
    include_placeholders: bool = Field(True, description="Include placeholder-specific analysis")
    generate_diff_delta: bool = Field(True, description="Generate diff Delta for visualization")


class DocumentCompareResponse(BaseModel):
    """Response schema for document comparison"""
    document_id: str
    old_version: int
    new_version: int
    comparison_result: ComparisonResultSchema
    diff_delta: Optional[Dict[str, Any]] = Field(None, description="Delta representing differences")
    placeholder_changes: Dict[str, List[PlaceholderChangeSchema]] = Field(default_factory=dict)
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentMergeRequest(BaseModel):
    """Request schema for three-way document merge"""
    document_id: str = Field(..., description="Document ID")
    base_version: int = Field(..., description="Base version for merge")
    left_version: int = Field(..., description="Left version to merge")
    right_version: int = Field(..., description="Right version to merge")


class MergeConflictSchema(BaseModel):
    """Schema for merge conflicts"""
    id: str
    document_id: str
    conflict_type: str = Field(..., description="Type of conflict")
    conflict_position: int = Field(..., description="Position of conflict")
    conflict_length: int = Field(0, description="Length of conflict")
    base_content: Optional[Dict[str, Any]] = None
    left_content: Optional[Dict[str, Any]] = None
    right_content: Optional[Dict[str, Any]] = None
    is_resolved: bool = False
    resolved_content: Optional[Dict[str, Any]] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentMergeResponse(BaseModel):
    """Response schema for document merge"""
    document_id: str
    base_version: int
    left_version: int
    right_version: int
    merged_content: Dict[str, Any] = Field(..., description="Merged document content")
    conflicts: List[MergeConflictSchema] = Field(default_factory=list)
    auto_merged_changes: int = Field(0, description="Number of changes automatically merged")
    requires_manual_resolution: bool = Field(False, description="Whether manual resolution is needed")


class ConflictResolutionRequest(BaseModel):
    """Request schema for resolving merge conflicts"""
    conflict_id: str = Field(..., description="ID of the conflict to resolve")
    resolved_content: Dict[str, Any] = Field(..., description="Content chosen to resolve the conflict")
    resolution_strategy: str = Field("manual", description="Strategy used: manual, left, right, base")


# Document history schemas

class DocumentHistoryBase(BaseModel):
    """Base schema for document history"""
    document_id: str
    version_number: int
    title: str
    content: Dict[str, Any]
    document_type: str
    placeholders: Optional[Dict[str, Any]] = None
    change_summary: Optional[str] = None
    change_details: Optional[Dict[str, Any]] = None
    parent_version: Optional[int] = None
    is_major_version: bool = False
    tags: Optional[List[str]] = None


class DocumentHistoryCreate(DocumentHistoryBase):
    """Schema for creating document history records"""
    created_by: Optional[str] = None


class DocumentHistoryUpdate(BaseModel):
    """Schema for updating document history records"""
    change_summary: Optional[str] = None
    is_major_version: Optional[bool] = None
    tags: Optional[List[str]] = None


class DocumentHistoryResponse(DocumentHistoryBase):
    """Schema for document history responses"""
    id: str
    created_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentVersionListResponse(BaseModel):
    """Response schema for listing document versions"""
    document_id: str
    current_version: int
    versions: List[DocumentHistoryResponse]
    total_versions: int


# Diff visualization schemas

class DiffVisualizationRequest(BaseModel):
    """Request schema for generating diff visualization"""
    document_id: str
    old_version: int
    new_version: int
    format: str = Field("unified", description="Diff format: unified, side-by-side, inline")
    context_lines: int = Field(3, description="Number of context lines to show")
    show_placeholders: bool = Field(True, description="Include placeholder changes in visualization")


class DiffVisualizationResponse(BaseModel):
    """Response schema for diff visualization"""
    document_id: str
    old_version: int
    new_version: int
    format: str
    diff_content: str = Field(..., description="Formatted diff content")
    diff_delta: Dict[str, Any] = Field(..., description="Delta with diff highlighting")
    statistics: ComparisonResultSchema


# Statistics schemas

class DocumentComparisonStatsResponse(BaseModel):
    """Response schema for comparison statistics"""
    document_id: str
    total_comparisons: int
    average_similarity: float
    most_common_change_types: Dict[str, int]
    version_activity: Dict[int, int]  # version -> number of comparisons
    recent_comparisons: List[DocumentCompareResponse]


class SystemComparisonStatsResponse(BaseModel):
    """Response schema for system-wide comparison statistics"""
    total_documents_compared: int
    total_comparisons_performed: int
    average_document_similarity: float
    most_active_documents: List[Dict[str, Any]]
    comparison_activity_by_day: Dict[str, int]
    popular_comparison_features: Dict[str, int]