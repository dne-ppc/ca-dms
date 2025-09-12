"""
Template service layer for document template operations
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, and_, or_
from datetime import datetime, timedelta
import uuid

from app.models.document_template import (
    DocumentTemplate, 
    TemplateField,
    TemplateCollaborator,
    TemplateReview,
    TemplateUsageLog,
    TemplateCategory,
    TemplateAccessLevel,
    TemplateStatus
)
from app.models.document import Document
from app.schemas.document_template import (
    DocumentTemplateCreate,
    DocumentTemplateUpdate,
    TemplateSearchFilters,
    TemplateSearchRequest,
    TemplateFieldCreate,
    TemplateCollaboratorCreate,
    TemplateReviewCreate,
    TemplateUsageLogCreate,
    CreateTemplateFromDocumentRequest,
    TemplateInstanceRequest,
    BulkTemplateAction
)


class TemplateService:
    """Service layer for document template operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_template(
        self, 
        template_data: DocumentTemplateCreate, 
        created_by: str
    ) -> DocumentTemplate:
        """Create a new document template"""
        template_id = str(uuid.uuid4())
        
        # Create main template
        db_template = DocumentTemplate(
            id=template_id,
            name=template_data.name,
            description=template_data.description,
            category=template_data.category,
            content=template_data.content,
            placeholders=template_data.placeholders,
            default_title_pattern=template_data.default_title_pattern,
            required_fields=template_data.required_fields,
            field_validations=template_data.field_validations,
            access_level=template_data.access_level,
            tags=template_data.tags,
            thumbnail_url=template_data.thumbnail_url,
            status=TemplateStatus.DRAFT,
            version=1,
            created_by=created_by
        )
        
        self.db.add(db_template)
        self.db.flush()
        
        # Create template fields if provided
        if template_data.fields:
            for field_data in template_data.fields:
                field = TemplateField(
                    id=str(uuid.uuid4()),
                    template_id=template_id,
                    field_name=field_data.field_name,
                    field_label=field_data.field_label,
                    field_type=field_data.field_type,
                    field_description=field_data.field_description,
                    is_required=field_data.is_required,
                    default_value=field_data.default_value,
                    field_options=field_data.field_options,
                    field_order=field_data.field_order,
                    field_group=field_data.field_group,
                    validation_rules=field_data.validation_rules,
                    error_message=field_data.error_message
                )
                self.db.add(field)
        
        # Generate preview content for search
        db_template.preview_content = self._generate_preview_content(template_data.content)
        
        self.db.commit()
        self.db.refresh(db_template)
        
        return db_template
    
    def get_template(self, template_id: str, user_id: Optional[str] = None) -> Optional[DocumentTemplate]:
        """Get a template by ID with access control"""
        query = self.db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id)
        template = query.first()
        
        if not template:
            return None
        
        # Check access permissions
        if not self._check_template_access(template, user_id, "view"):
            return None
        
        return template
    
    def get_template_with_details(self, template_id: str, user_id: Optional[str] = None) -> Optional[DocumentTemplate]:
        """Get template with all related data"""
        query = self.db.query(DocumentTemplate).options(
            joinedload(DocumentTemplate.collaborators),
            joinedload(DocumentTemplate.reviews)
        ).filter(DocumentTemplate.id == template_id)
        
        template = query.first()
        
        if not template:
            return None
        
        # Check access permissions
        if not self._check_template_access(template, user_id, "view"):
            return None
        
        return template
    
    def update_template(
        self, 
        template_id: str, 
        template_data: DocumentTemplateUpdate, 
        updated_by: str
    ) -> Optional[DocumentTemplate]:
        """Update a template with version control"""
        template = self.get_template(template_id)
        if not template:
            return None
        
        # Check edit permissions
        if not self._check_template_access(template, updated_by, "edit"):
            return None
        
        # Update fields
        update_data = template_data.model_dump(exclude_unset=True)
        
        # If content changed, increment version
        version_changed = False
        if "content" in update_data and update_data["content"] != template.content:
            template.version += 1
            version_changed = True
        
        # Apply updates
        for field, value in update_data.items():
            setattr(template, field, value)
        
        template.updated_by = updated_by
        
        # Update preview content if content changed
        if "content" in update_data:
            template.preview_content = self._generate_preview_content(update_data["content"])
        
        self.db.commit()
        self.db.refresh(template)
        
        return template
    
    def delete_template(self, template_id: str, user_id: str) -> bool:
        """Delete a template (soft delete by archiving)"""
        template = self.get_template(template_id)
        if not template:
            return False
        
        # Check manage permissions
        if not self._check_template_access(template, user_id, "manage"):
            return False
        
        # Soft delete by archiving
        template.status = TemplateStatus.ARCHIVED
        template.updated_by = user_id
        
        self.db.commit()
        return True
    
    def search_templates(
        self, 
        search_request: TemplateSearchRequest, 
        user_id: Optional[str] = None
    ) -> Tuple[List[DocumentTemplate], int]:
        """Search templates with filtering and pagination"""
        query = self.db.query(DocumentTemplate)
        
        # Apply access control
        query = self._apply_access_filter(query, user_id)
        
        # Apply text search
        if search_request.query:
            search_term = f"%{search_request.query}%"
            query = query.filter(
                or_(
                    DocumentTemplate.name.ilike(search_term),
                    DocumentTemplate.description.ilike(search_term),
                    DocumentTemplate.preview_content.ilike(search_term),
                    DocumentTemplate.tags.contains([search_request.query])
                )
            )
        
        # Apply filters
        if search_request.filters:
            query = self._apply_search_filters(query, search_request.filters)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply sorting
        query = self._apply_sorting(query, search_request.sort_by, search_request.sort_order)
        
        # Apply pagination
        offset = (search_request.page - 1) * search_request.limit
        templates = query.offset(offset).limit(search_request.limit).all()
        
        return templates, total
    
    def publish_template(self, template_id: str, user_id: str) -> Optional[DocumentTemplate]:
        """Publish a template"""
        template = self.get_template(template_id)
        if not template:
            return None
        
        # Check publish permissions
        if not self._check_template_access(template, user_id, "publish"):
            return None
        
        template.status = TemplateStatus.PUBLISHED
        template.published_at = datetime.utcnow()
        template.updated_by = user_id
        
        self.db.commit()
        self.db.refresh(template)
        
        return template
    
    def create_document_from_template(
        self, 
        request: TemplateInstanceRequest, 
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Create a new document from a template"""
        template = self.get_template(request.template_id)
        if not template:
            return None
        
        # Check template access
        if not self._check_template_access(template, user_id, "view"):
            return None
        
        # Generate document title
        document_title = request.document_title
        if not document_title and template.default_title_pattern:
            document_title = self._generate_document_title(template.default_title_pattern, request.field_values)
        if not document_title:
            document_title = f"Document from {template.name}"
        
        # Process template content with field values
        processed_content = self._process_template_content(template.content, request.field_values)
        
        # Create document (this would integrate with the existing document service)
        document_data = {
            "title": document_title,
            "content": processed_content,
            "document_type": request.document_type,
            "placeholders": template.placeholders,
            "template_id": template.id
        }
        
        # Log template usage
        self._log_template_usage(template.id, user_id, "used", None)
        
        # Update template usage statistics
        template.usage_count += 1
        template.last_used_at = datetime.utcnow()
        self.db.commit()
        
        return {
            "document_data": document_data,
            "template_id": template.id,
            "template_name": template.name
        }
    
    def add_collaborator(
        self, 
        template_id: str, 
        collaborator_data: TemplateCollaboratorCreate, 
        invited_by: str
    ) -> Optional[TemplateCollaborator]:
        """Add a collaborator to a template"""
        template = self.get_template(template_id)
        if not template:
            return None
        
        # Check manage permissions
        if not self._check_template_access(template, invited_by, "manage"):
            return None
        
        # Check if collaborator already exists
        existing = self.db.query(TemplateCollaborator).filter(
            and_(
                TemplateCollaborator.template_id == template_id,
                TemplateCollaborator.user_id == collaborator_data.user_id
            )
        ).first()
        
        if existing:
            return None
        
        collaborator = TemplateCollaborator(
            id=str(uuid.uuid4()),
            template_id=template_id,
            user_id=collaborator_data.user_id,
            can_view=collaborator_data.can_view,
            can_edit=collaborator_data.can_edit,
            can_manage=collaborator_data.can_manage,
            can_publish=collaborator_data.can_publish,
            invited_by=invited_by
        )
        
        self.db.add(collaborator)
        self.db.commit()
        self.db.refresh(collaborator)
        
        return collaborator
    
    def add_review(
        self, 
        template_id: str, 
        review_data: TemplateReviewCreate, 
        user_id: str
    ) -> Optional[TemplateReview]:
        """Add a review to a template"""
        template = self.get_template(template_id)
        if not template:
            return None
        
        # Check if user already reviewed
        existing = self.db.query(TemplateReview).filter(
            and_(
                TemplateReview.template_id == template_id,
                TemplateReview.user_id == user_id
            )
        ).first()
        
        if existing:
            # Update existing review
            for field, value in review_data.model_dump().items():
                setattr(existing, field, value)
            
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # Create new review
        review = TemplateReview(
            id=str(uuid.uuid4()),
            template_id=template_id,
            user_id=user_id,
            rating=review_data.rating,
            title=review_data.title,
            comment=review_data.comment
        )
        
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        
        return review
    
    def get_template_analytics(self, template_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get analytics data for a template"""
        template = self.get_template(template_id)
        if not template:
            return None
        
        # Check view permissions
        if not self._check_template_access(template, user_id, "view"):
            return None
        
        # Get usage statistics
        usage_logs = self.db.query(TemplateUsageLog).filter(
            TemplateUsageLog.template_id == template_id
        ).all()
        
        # Calculate metrics
        total_usage = len(usage_logs)
        usage_by_action = {}
        usage_by_month = {}
        top_users = {}
        
        for log in usage_logs:
            # By action
            action = log.action_type
            usage_by_action[action] = usage_by_action.get(action, 0) + 1
            
            # By month
            month_key = log.created_at.strftime("%Y-%m")
            usage_by_month[month_key] = usage_by_month.get(month_key, 0) + 1
            
            # Top users
            user = log.user_id
            top_users[user] = top_users.get(user, 0) + 1
        
        # Get review statistics
        reviews = self.db.query(TemplateReview).filter(
            TemplateReview.template_id == template_id
        ).all()
        
        total_reviews = len(reviews)
        average_rating = None
        if total_reviews > 0:
            average_rating = sum(r.rating for r in reviews) / total_reviews
        
        # Sort top users
        sorted_users = sorted(top_users.items(), key=lambda x: x[1], reverse=True)[:10]
        top_users_list = [{"user_id": user, "usage_count": count} for user, count in sorted_users]
        
        return {
            "template_id": template_id,
            "total_usage": total_usage,
            "usage_by_month": usage_by_month,
            "usage_by_action": usage_by_action,
            "top_users": top_users_list,
            "average_rating": average_rating,
            "total_reviews": total_reviews
        }
    
    def bulk_template_action(
        self, 
        action_data: BulkTemplateAction, 
        user_id: str
    ) -> Dict[str, Any]:
        """Perform bulk actions on templates"""
        succeeded = []
        failed = []
        
        for template_id in action_data.template_ids:
            try:
                template = self.get_template(template_id)
                if not template:
                    failed.append({"template_id": template_id, "error": "Template not found"})
                    continue
                
                # Check permissions based on action
                required_permission = "manage" if action_data.action in ["delete", "archive"] else "edit"
                if not self._check_template_access(template, user_id, required_permission):
                    failed.append({"template_id": template_id, "error": "Insufficient permissions"})
                    continue
                
                # Perform action
                if action_data.action == "publish":
                    template.status = TemplateStatus.PUBLISHED
                    template.published_at = datetime.utcnow()
                elif action_data.action == "archive":
                    template.status = TemplateStatus.ARCHIVED
                elif action_data.action == "delete":
                    template.status = TemplateStatus.ARCHIVED  # Soft delete
                elif action_data.action == "duplicate":
                    # Create duplicate (simplified)
                    new_template = DocumentTemplate(
                        id=str(uuid.uuid4()),
                        name=f"{template.name} (Copy)",
                        description=template.description,
                        category=template.category,
                        content=template.content,
                        placeholders=template.placeholders,
                        access_level=template.access_level,
                        status=TemplateStatus.DRAFT,
                        version=1,
                        created_by=user_id,
                        parent_template_id=template.id
                    )
                    self.db.add(new_template)
                
                # Apply bulk changes
                if action_data.target_category:
                    template.category = action_data.target_category
                if action_data.target_access_level:
                    template.access_level = action_data.target_access_level
                
                template.updated_by = user_id
                succeeded.append(template_id)
                
            except Exception as e:
                failed.append({"template_id": template_id, "error": str(e)})
        
        self.db.commit()
        
        return {
            "succeeded": succeeded,
            "failed": failed,
            "total_processed": len(action_data.template_ids)
        }
    
    def _check_template_access(self, template: DocumentTemplate, user_id: Optional[str], permission: str) -> bool:
        """Check if user has permission to access template"""
        if not user_id:
            return template.access_level == TemplateAccessLevel.PUBLIC
        
        # Template creator has all permissions
        if template.created_by == user_id:
            return True
        
        # Check access level
        if template.access_level == TemplateAccessLevel.PUBLIC:
            return True
        
        if template.access_level == TemplateAccessLevel.PRIVATE:
            # Check collaborator permissions
            collaborator = self.db.query(TemplateCollaborator).filter(
                and_(
                    TemplateCollaborator.template_id == template.id,
                    TemplateCollaborator.user_id == user_id
                )
            ).first()
            
            if not collaborator:
                return False
            
            # Check specific permission
            if permission == "view":
                return collaborator.can_view
            elif permission == "edit":
                return collaborator.can_edit
            elif permission == "manage":
                return collaborator.can_manage
            elif permission == "publish":
                return collaborator.can_publish
        
        # For organization level, assume user has access if they're in the same org
        # This would integrate with the user/organization system
        return True
    
    def _apply_access_filter(self, query, user_id: Optional[str]):
        """Apply access control filters to template query"""
        if not user_id:
            return query.filter(DocumentTemplate.access_level == TemplateAccessLevel.PUBLIC)
        
        # Show public templates, user's own templates, and templates they collaborate on
        public_filter = DocumentTemplate.access_level == TemplateAccessLevel.PUBLIC
        owned_filter = DocumentTemplate.created_by == user_id
        
        # Collaborator templates (subquery)
        collaborator_template_ids = self.db.query(TemplateCollaborator.template_id).filter(
            TemplateCollaborator.user_id == user_id
        ).subquery()
        
        collaborator_filter = DocumentTemplate.id.in_(
            self.db.query(collaborator_template_ids.c.template_id)
        )
        
        return query.filter(or_(public_filter, owned_filter, collaborator_filter))
    
    def _apply_search_filters(self, query, filters: TemplateSearchFilters):
        """Apply search filters to query"""
        if filters.category:
            query = query.filter(DocumentTemplate.category == filters.category)
        
        if filters.access_level:
            query = query.filter(DocumentTemplate.access_level == filters.access_level)
        
        if filters.status:
            query = query.filter(DocumentTemplate.status == filters.status)
        
        if filters.created_by:
            query = query.filter(DocumentTemplate.created_by == filters.created_by)
        
        if filters.tags:
            for tag in filters.tags:
                query = query.filter(DocumentTemplate.tags.contains([tag]))
        
        if filters.is_system_template is not None:
            query = query.filter(DocumentTemplate.is_system_template == filters.is_system_template)
        
        if filters.date_from:
            query = query.filter(DocumentTemplate.created_at >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(DocumentTemplate.created_at <= filters.date_to)
        
        if filters.min_rating:
            # This would require a more complex query with review aggregation
            pass
        
        return query
    
    def _apply_sorting(self, query, sort_by: str, sort_order: str):
        """Apply sorting to query"""
        if sort_order == "desc":
            if sort_by == "name":
                return query.order_by(desc(DocumentTemplate.name))
            elif sort_by == "created_at":
                return query.order_by(desc(DocumentTemplate.created_at))
            elif sort_by == "updated_at":
                return query.order_by(desc(DocumentTemplate.updated_at))
            elif sort_by == "usage_count":
                return query.order_by(desc(DocumentTemplate.usage_count))
            else:  # Default to usage_count desc
                return query.order_by(desc(DocumentTemplate.usage_count))
        else:  # asc
            if sort_by == "name":
                return query.order_by(DocumentTemplate.name)
            elif sort_by == "created_at":
                return query.order_by(DocumentTemplate.created_at)
            elif sort_by == "updated_at":
                return query.order_by(DocumentTemplate.updated_at)
            elif sort_by == "usage_count":
                return query.order_by(DocumentTemplate.usage_count)
            else:
                return query.order_by(DocumentTemplate.name)
    
    def _generate_preview_content(self, content: Dict[str, Any]) -> str:
        """Generate plain text preview from Quill Delta content"""
        if not isinstance(content, dict) or "ops" not in content:
            return ""
        
        preview_parts = []
        for op in content["ops"]:
            if isinstance(op.get("insert"), str):
                preview_parts.append(op["insert"])
            elif isinstance(op.get("insert"), dict):
                # Handle placeholder objects
                insert_obj = op["insert"]
                if "signature" in insert_obj:
                    preview_parts.append("[Signature Field]")
                elif "longResponse" in insert_obj:
                    preview_parts.append("[Response Area]")
                elif "lineSegment" in insert_obj:
                    preview_parts.append("[Line Segment]")
                elif "versionTable" in insert_obj:
                    preview_parts.append("[Version Table]")
        
        return " ".join(preview_parts)[:500]  # Limit preview length
    
    def _generate_document_title(self, title_pattern: str, field_values: Optional[Dict[str, Any]]) -> str:
        """Generate document title from pattern and field values"""
        if not field_values:
            return title_pattern
        
        # Simple template substitution
        title = title_pattern
        for key, value in field_values.items():
            placeholder = f"{{{key}}}"
            if placeholder in title:
                title = title.replace(placeholder, str(value))
        
        # Replace date placeholder
        if "{date}" in title:
            title = title.replace("{date}", datetime.now().strftime("%Y-%m-%d"))
        
        return title
    
    def _process_template_content(self, content: Dict[str, Any], field_values: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Process template content by replacing field placeholders"""
        if not field_values:
            return content
        
        # This is a simplified implementation
        # In practice, you'd want more sophisticated content processing
        processed_content = content.copy()
        
        # Process content operations for field substitutions
        if "ops" in processed_content:
            for op in processed_content["ops"]:
                if isinstance(op.get("insert"), str):
                    text = op["insert"]
                    for key, value in field_values.items():
                        placeholder = f"{{{key}}}"
                        if placeholder in text:
                            op["insert"] = text.replace(placeholder, str(value))
        
        return processed_content
    
    def _log_template_usage(
        self, 
        template_id: str, 
        user_id: str, 
        action_type: str, 
        document_id: Optional[str] = None
    ) -> None:
        """Log template usage for analytics"""
        usage_log = TemplateUsageLog(
            id=str(uuid.uuid4()),
            template_id=template_id,
            user_id=user_id,
            document_id=document_id,
            action_type=action_type
        )
        
        self.db.add(usage_log)