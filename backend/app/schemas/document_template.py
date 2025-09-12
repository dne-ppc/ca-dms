"""
Pydantic schemas for document templates
"""
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, validator, Field
from app.models.document_template import TemplateCategory, TemplateAccessLevel, TemplateStatus


# Template Field Schemas

class TemplateFieldBase(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=100)
    field_label: str = Field(..., min_length=1, max_length=255)
    field_type: str = Field(..., regex="^(text|number|date|select|textarea|checkbox|radio|email|url|tel)$")
    field_description: Optional[str] = None
    is_required: bool = False
    default_value: Optional[str] = None
    field_options: Optional[Dict[str, Any]] = None
    field_order: int = 0
    field_group: Optional[str] = None
    validation_rules: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class TemplateFieldCreate(TemplateFieldBase):
    pass


class TemplateFieldUpdate(BaseModel):
    field_name: Optional[str] = Field(None, min_length=1, max_length=100)
    field_label: Optional[str] = Field(None, min_length=1, max_length=255)
    field_type: Optional[str] = Field(None, regex="^(text|number|date|select|textarea|checkbox|radio|email|url|tel)$")
    field_description: Optional[str] = None
    is_required: Optional[bool] = None
    default_value: Optional[str] = None
    field_options: Optional[Dict[str, Any]] = None
    field_order: Optional[int] = None
    field_group: Optional[str] = None
    validation_rules: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class TemplateField(TemplateFieldBase):
    id: str
    template_id: str
    
    class Config:
        from_attributes = True


# Template Collaborator Schemas

class TemplateCollaboratorBase(BaseModel):
    user_id: str
    can_view: bool = True
    can_edit: bool = False
    can_manage: bool = False
    can_publish: bool = False


class TemplateCollaboratorCreate(TemplateCollaboratorBase):
    pass


class TemplateCollaboratorUpdate(BaseModel):
    can_view: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_manage: Optional[bool] = None
    can_publish: Optional[bool] = None


class TemplateCollaborator(TemplateCollaboratorBase):
    id: str
    template_id: str
    invited_by: Optional[str] = None
    invited_at: datetime
    accepted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Template Review Schemas

class TemplateReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = None


class TemplateReviewCreate(TemplateReviewBase):
    pass


class TemplateReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = None


class TemplateReview(TemplateReviewBase):
    id: str
    template_id: str
    user_id: str
    helpful_votes: int = 0
    total_votes: int = 0
    is_verified: bool = False
    is_featured: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Document Template Schemas

class DocumentTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: TemplateCategory
    content: Dict[str, Any]  # Quill Delta format
    placeholders: Optional[Dict[str, Any]] = None
    default_title_pattern: Optional[str] = Field(None, max_length=255)
    required_fields: Optional[List[str]] = None
    field_validations: Optional[Dict[str, Any]] = None
    access_level: TemplateAccessLevel = TemplateAccessLevel.ORGANIZATION
    tags: Optional[List[str]] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)


class DocumentTemplateCreate(DocumentTemplateBase):
    fields: Optional[List[TemplateFieldCreate]] = None


class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[TemplateCategory] = None
    content: Optional[Dict[str, Any]] = None
    placeholders: Optional[Dict[str, Any]] = None
    default_title_pattern: Optional[str] = Field(None, max_length=255)
    required_fields: Optional[List[str]] = None
    field_validations: Optional[Dict[str, Any]] = None
    access_level: Optional[TemplateAccessLevel] = None
    status: Optional[TemplateStatus] = None
    tags: Optional[List[str]] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)


class DocumentTemplate(DocumentTemplateBase):
    id: str
    status: TemplateStatus
    version: int
    parent_template_id: Optional[str] = None
    is_system_template: bool = False
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    preview_content: Optional[str] = None
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentTemplateWithDetails(DocumentTemplate):
    fields: List[TemplateField] = []
    collaborators: List[TemplateCollaborator] = []
    reviews_summary: Optional[Dict[str, Any]] = None  # Average rating, count, etc.
    
    class Config:
        from_attributes = True


# Template Usage and Analytics Schemas

class TemplateUsageLogCreate(BaseModel):
    action_type: str = Field(..., regex="^(used|previewed|downloaded|shared)$")
    document_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TemplateUsageLog(BaseModel):
    id: str
    template_id: str
    user_id: str
    document_id: Optional[str] = None
    action_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TemplateAnalytics(BaseModel):
    template_id: str
    total_usage: int
    usage_by_month: Dict[str, int]
    usage_by_action: Dict[str, int]
    top_users: List[Dict[str, Any]]
    average_rating: Optional[float] = None
    total_reviews: int = 0


# Search and Filter Schemas

class TemplateSearchFilters(BaseModel):
    category: Optional[TemplateCategory] = None
    access_level: Optional[TemplateAccessLevel] = None
    status: Optional[TemplateStatus] = None
    created_by: Optional[str] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    is_system_template: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class TemplateSearchRequest(BaseModel):
    query: Optional[str] = None
    filters: Optional[TemplateSearchFilters] = None
    sort_by: str = Field("usage_count", regex="^(name|created_at|updated_at|usage_count|rating)$")
    sort_order: str = Field("desc", regex="^(asc|desc)$")
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)


class TemplateSearchResponse(BaseModel):
    templates: List[DocumentTemplate]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


# Template Creation from Document

class CreateTemplateFromDocumentRequest(BaseModel):
    document_id: str
    template_name: str = Field(..., min_length=1, max_length=255)
    template_description: Optional[str] = None
    category: TemplateCategory
    access_level: TemplateAccessLevel = TemplateAccessLevel.ORGANIZATION
    extract_fields: bool = True  # Whether to auto-extract template fields
    tags: Optional[List[str]] = None


# Template Instance (Document Creation) Schemas

class TemplateInstanceRequest(BaseModel):
    template_id: str
    document_title: Optional[str] = None
    field_values: Optional[Dict[str, Any]] = None  # Values for template fields
    document_type: str = "governance"


class TemplateInstanceResponse(BaseModel):
    document_id: str
    document_title: str
    template_id: str
    template_name: str
    created_at: datetime


# Batch Operations

class BulkTemplateAction(BaseModel):
    template_ids: List[str] = Field(..., min_items=1, max_items=100)
    action: str = Field(..., regex="^(publish|archive|delete|duplicate)$")
    target_category: Optional[TemplateCategory] = None  # For bulk category change
    target_access_level: Optional[TemplateAccessLevel] = None  # For bulk access change


class BulkTemplateResponse(BaseModel):
    succeeded: List[str]
    failed: List[Dict[str, str]]  # template_id -> error_message
    total_processed: int


# Template Import/Export

class TemplateExportRequest(BaseModel):
    template_ids: List[str] = Field(..., min_items=1, max_items=50)
    include_reviews: bool = False
    include_analytics: bool = False
    export_format: str = Field("json", regex="^(json|zip)$")


class TemplateImportRequest(BaseModel):
    templates_data: Dict[str, Any]  # JSON structure with templates
    import_mode: str = Field("create_new", regex="^(create_new|update_existing|create_or_update)$")
    default_access_level: TemplateAccessLevel = TemplateAccessLevel.PRIVATE
    preserve_ids: bool = False