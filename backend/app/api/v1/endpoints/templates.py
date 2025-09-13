"""
Template management API endpoints
"""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.template_service import TemplateService
from app.schemas.document_template import (
    DocumentTemplateCreate,
    DocumentTemplateUpdate,
    DocumentTemplate,
    DocumentTemplateWithDetails,
    TemplateSearchRequest,
    TemplateSearchResponse,
    TemplateSearchFilters,
    TemplateCollaboratorCreate,
    TemplateCollaborator,
    TemplateReviewCreate,
    TemplateReview,
    TemplateAnalytics,
    TemplateUsageLogCreate,
    CreateTemplateFromDocumentRequest,
    TemplateInstanceRequest,
    TemplateInstanceResponse,
    BulkTemplateAction,
    BulkTemplateResponse,
    TemplateExportRequest,
    TemplateImportRequest,
    TemplateFieldCreate
)
from app.models.document_template import TemplateCategory, TemplateAccessLevel, TemplateStatus
from app.models.document_template import TemplateCategory as ModelTemplateCategory
from datetime import datetime
import math

router = APIRouter()


@router.post("/", response_model=DocumentTemplate, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: DocumentTemplateCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new document template"""
    template_service = TemplateService(db)
    
    try:
        template = template_service.create_template(template_data, current_user["id"])
        return template
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create template: {str(e)}"
        )


@router.get("/", response_model=TemplateSearchResponse)
async def search_templates(
    query: Optional[str] = Query(None, description="Search query for template name, description, or content"),
    category: Optional[TemplateCategory] = Query(None, description="Filter by template category"),
    access_level: Optional[TemplateAccessLevel] = Query(None, description="Filter by access level"),
    status: Optional[TemplateStatus] = Query(None, description="Filter by template status"),
    created_by: Optional[str] = Query(None, description="Filter by creator user ID"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags to filter by"),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0, description="Minimum average rating"),
    is_system_template: Optional[bool] = Query(None, description="Filter system templates"),
    sort_by: str = Query("usage_count", pattern="^(name|created_at|updated_at|usage_count|rating)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search and list templates with filtering and pagination"""
    template_service = TemplateService(db)
    
    # Build filters
    filters = TemplateSearchFilters(
        category=category,
        access_level=access_level,
        status=status,
        created_by=created_by,
        tags=tags.split(",") if tags else None,
        min_rating=min_rating,
        is_system_template=is_system_template
    )
    
    # Build search request
    search_request = TemplateSearchRequest(
        query=query,
        filters=filters,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit
    )
    
    try:
        templates, total = template_service.search_templates(
            search_request, 
            current_user["id"] if current_user else None
        )
        
        # Calculate pagination info
        total_pages = math.ceil(total / limit)
        has_next = page < total_pages
        has_prev = page > 1
        
        return TemplateSearchResponse(
            templates=templates,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/categories", response_model=List[Dict[str, str]])
async def get_template_categories():
    """Get available template categories"""
    categories = [
        {"value": category.value, "label": category.value.replace("_", " ").title()}
        for category in ModelTemplateCategory
    ]
    return categories


@router.get("/{template_id}", response_model=DocumentTemplateWithDetails)
async def get_template(
    template_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific template with details"""
    template_service = TemplateService(db)
    
    template = template_service.get_template_with_details(
        template_id, 
        current_user["id"] if current_user else None
    )
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied"
        )
    
    return template


@router.put("/{template_id}", response_model=DocumentTemplate)
async def update_template(
    template_id: str,
    template_data: DocumentTemplateUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a template"""
    template_service = TemplateService(db)
    
    template = template_service.update_template(template_id, template_data, current_user["id"])
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or insufficient permissions"
        )
    
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a template (archives it)"""
    template_service = TemplateService(db)
    
    success = template_service.delete_template(template_id, current_user["id"])
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or insufficient permissions"
        )


@router.post("/{template_id}/publish", response_model=DocumentTemplate)
async def publish_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Publish a template"""
    template_service = TemplateService(db)
    
    template = template_service.publish_template(template_id, current_user["id"])
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or insufficient permissions"
        )
    
    return template


@router.post("/{template_id}/collaborators", response_model=TemplateCollaborator, status_code=status.HTTP_201_CREATED)
async def add_template_collaborator(
    template_id: str,
    collaborator_data: TemplateCollaboratorCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a collaborator to a template"""
    template_service = TemplateService(db)
    
    collaborator = template_service.add_collaborator(
        template_id, 
        collaborator_data, 
        current_user["id"]
    )
    
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to add collaborator. Template not found, insufficient permissions, or collaborator already exists."
        )
    
    return collaborator


@router.post("/{template_id}/reviews", response_model=TemplateReview, status_code=status.HTTP_201_CREATED)
async def add_template_review(
    template_id: str,
    review_data: TemplateReviewCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add or update a review for a template"""
    template_service = TemplateService(db)
    
    review = template_service.add_review(template_id, review_data, current_user["id"])
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return review


@router.get("/{template_id}/analytics", response_model=TemplateAnalytics)
async def get_template_analytics(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics data for a template"""
    template_service = TemplateService(db)
    
    analytics = template_service.get_template_analytics(template_id, current_user["id"])
    
    if not analytics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or insufficient permissions"
        )
    
    return analytics


@router.post("/{template_id}/usage", status_code=status.HTTP_204_NO_CONTENT)
async def log_template_usage(
    template_id: str,
    usage_data: TemplateUsageLogCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log template usage for analytics"""
    template_service = TemplateService(db)
    
    # Verify template exists and user has access
    template = template_service.get_template(template_id, current_user["id"])
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied"
        )
    
    # Log the usage
    template_service._log_template_usage(
        template_id,
        current_user["id"],
        usage_data.action_type,
        usage_data.document_id
    )
    
    # Update template usage count if this was actual usage
    if usage_data.action_type == "used":
        template.usage_count += 1
        template.last_used_at = datetime.utcnow()
        db.commit()


@router.post("/{template_id}/create-document", response_model=TemplateInstanceResponse)
async def create_document_from_template(
    template_id: str,
    request: TemplateInstanceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new document from a template"""
    from app.services.document_service import DocumentService
    from app.schemas.document import DocumentCreate
    from datetime import datetime
    
    template_service = TemplateService(db)
    document_service = DocumentService(db)
    
    # Set template ID in request
    request.template_id = template_id
    
    # Get processed document data from template
    template_result = template_service.create_document_from_template(request, current_user["id"])
    
    if not template_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or access denied"
        )
    
    # Create the actual document
    document_data = DocumentCreate(**template_result["document_data"])
    document = document_service.create_document(document_data, current_user["id"])
    
    return TemplateInstanceResponse(
        document_id=document.id,
        document_title=document.title,
        template_id=template_result["template_id"],
        template_name=template_result["template_name"],
        created_at=datetime.utcnow()
    )


@router.post("/from-document", response_model=DocumentTemplate, status_code=status.HTTP_201_CREATED)
async def create_template_from_document(
    request: CreateTemplateFromDocumentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a template from an existing document"""
    from app.services.document_service import DocumentService
    
    document_service = DocumentService(db)
    template_service = TemplateService(db)
    
    # Get the source document
    document = document_service.get_document(request.document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    # Create template data from document
    template_data = DocumentTemplateCreate(
        name=request.template_name,
        description=request.template_description,
        category=request.category,
        content=document.content,
        placeholders=document.placeholders,
        access_level=request.access_level,
        tags=request.tags
    )
    
    # Extract fields if requested
    if request.extract_fields:
        # This would implement field extraction logic
        # For now, we'll just extract placeholders as fields
        if document.placeholders:
            template_data.fields = []
            for placeholder_type, placeholders in document.placeholders.items():
                for placeholder in placeholders:
                    if isinstance(placeholder, dict) and "label" in placeholder:
                        field_data = TemplateFieldCreate(
                            field_name=placeholder.get("id", "field"),
                            field_label=placeholder.get("label", "Field"),
                            field_type="text",  # Default type
                            is_required=False
                        )
                        template_data.fields.append(field_data)
    
    # Create the template
    template = template_service.create_template(template_data, current_user["id"])
    
    return template


@router.post("/bulk-action", response_model=BulkTemplateResponse)
async def bulk_template_action(
    action_data: BulkTemplateAction,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Perform bulk actions on multiple templates"""
    template_service = TemplateService(db)
    
    result = template_service.bulk_template_action(action_data, current_user["id"])
    
    return result


@router.post("/export")
async def export_templates(
    export_request: TemplateExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export templates"""
    # This would implement template export functionality
    # For now, return a placeholder response
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Template export functionality will be implemented in a future version"
    )


@router.post("/import")
async def import_templates(
    import_request: TemplateImportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import templates"""
    # This would implement template import functionality
    # For now, return a placeholder response
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Template import functionality will be implemented in a future version"
    )