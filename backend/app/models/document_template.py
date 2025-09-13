"""
Document template models for CA-DMS
"""
from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, ForeignKey, Boolean, Index, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.core.database import Base


class TemplateCategory(enum.Enum):
    """Template categories for organization"""
    GOVERNANCE = "governance"
    POLICY = "policy"
    PROCEDURE = "procedure"
    REPORT = "report"
    MEETING = "meeting"
    LEGAL = "legal"
    FINANCIAL = "financial"
    CUSTOM = "custom"


class TemplateAccessLevel(enum.Enum):
    """Template access levels"""
    PUBLIC = "public"  # Available to all users
    ORGANIZATION = "organization"  # Available to organization members
    PRIVATE = "private"  # Only accessible by creator and collaborators


class TemplateStatus(enum.Enum):
    """Template status"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class DocumentTemplate(Base):
    """Document templates for creating standardized documents"""
    __tablename__ = "document_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(Enum(TemplateCategory), nullable=False, index=True)
    
    # Template content - Quill Delta format
    content = Column(JSON, nullable=False)
    placeholders = Column(JSON, nullable=True)  # Placeholder metadata
    
    # Template configuration
    default_title_pattern = Column(String(255), nullable=True)  # e.g., "Meeting Minutes - {date}"
    required_fields = Column(JSON, nullable=True)  # Fields that must be filled
    field_validations = Column(JSON, nullable=True)  # Validation rules for template fields
    
    # Access control
    access_level = Column(Enum(TemplateAccessLevel), default=TemplateAccessLevel.ORGANIZATION)
    is_system_template = Column(Boolean, default=False)  # System-provided templates
    
    # Status and versioning
    status = Column(Enum(TemplateStatus), default=TemplateStatus.DRAFT)
    version = Column(Integer, nullable=False, default=1)
    parent_template_id = Column(String, ForeignKey("document_templates.id"), nullable=True)
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    tags = Column(JSON, nullable=True)  # Searchable tags
    thumbnail_url = Column(String(500), nullable=True)  # Template preview image
    preview_content = Column(Text, nullable=True)  # Plain text preview for search
    
    # User tracking
    created_by = Column(String, nullable=False, index=True)
    updated_by = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    parent_template = relationship("DocumentTemplate", remote_side=[id], back_populates="child_templates")
    child_templates = relationship("DocumentTemplate", back_populates="parent_template", cascade="all, delete-orphan")
    collaborators = relationship("TemplateCollaborator", back_populates="template", cascade="all, delete-orphan")
    reviews = relationship("TemplateReview", back_populates="template", cascade="all, delete-orphan")
    usage_logs = relationship("TemplateUsageLog", back_populates="template", cascade="all, delete-orphan")
    
    # Performance indexes
    __table_args__ = (
        Index('ix_templates_category_status', 'category', 'status'),
        Index('ix_templates_created_by_category', 'created_by', 'category'),
        Index('ix_templates_access_status', 'access_level', 'status'),
        Index('ix_templates_usage_count_desc', usage_count.desc()),
        Index('ix_templates_created_at_desc', created_at.desc()),
    )
    
    def __repr__(self):
        return f"<DocumentTemplate(id={self.id}, name={self.name}, category={self.category.value})>"


class TemplateCollaborator(Base):
    """Template collaborators and permissions"""
    __tablename__ = "template_collaborators"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("document_templates.id"), nullable=False)
    user_id = Column(String, nullable=False)  # Will be enhanced with User FK later
    
    # Permissions
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_manage = Column(Boolean, default=False)  # Can manage other collaborators
    can_publish = Column(Boolean, default=False)
    
    # Metadata
    invited_by = Column(String, nullable=True)
    invited_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    template = relationship("DocumentTemplate", back_populates="collaborators")
    
    # Indexes
    __table_args__ = (
        Index('ix_collaborators_template_user', 'template_id', 'user_id'),
        Index('ix_collaborators_user_permissions', 'user_id', 'can_edit', 'can_manage'),
    )
    
    def __repr__(self):
        return f"<TemplateCollaborator(template_id={self.template_id}, user_id={self.user_id})>"


class TemplateReview(Base):
    """Template reviews and ratings"""
    __tablename__ = "template_reviews"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("document_templates.id"), nullable=False)
    user_id = Column(String, nullable=False)
    
    # Review content
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)
    
    # Helpful votes
    helpful_votes = Column(Integer, default=0)
    total_votes = Column(Integer, default=0)
    
    # Status
    is_verified = Column(Boolean, default=False)  # Verified reviewer
    is_featured = Column(Boolean, default=False)  # Featured review
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    template = relationship("DocumentTemplate", back_populates="reviews")
    
    # Indexes
    __table_args__ = (
        Index('ix_reviews_template_rating', 'template_id', 'rating'),
        Index('ix_reviews_user_template', 'user_id', 'template_id'),
        Index('ix_reviews_helpful_desc', helpful_votes.desc()),
    )
    
    def __repr__(self):
        return f"<TemplateReview(template_id={self.template_id}, rating={self.rating})>"


class TemplateUsageLog(Base):
    """Track template usage for analytics"""
    __tablename__ = "template_usage_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("document_templates.id"), nullable=False)
    
    # Usage details
    user_id = Column(String, nullable=False)
    document_id = Column(String, nullable=True)  # Created document (if available)
    action_type = Column(String(50), nullable=False)  # 'used', 'previewed', 'downloaded'
    
    # Context
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    session_id = Column(String(100), nullable=True)
    
    # Usage metadata
    usage_metadata = Column(JSON, nullable=True)  # Additional context data
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    template = relationship("DocumentTemplate", back_populates="usage_logs")
    
    # Indexes
    __table_args__ = (
        Index('ix_usage_logs_template_date', 'template_id', 'created_at'),
        Index('ix_usage_logs_user_date', 'user_id', 'created_at'),
        Index('ix_usage_logs_action_type', 'action_type', 'created_at'),
    )
    
    def __repr__(self):
        return f"<TemplateUsageLog(template_id={self.template_id}, action={self.action_type})>"


class TemplateField(Base):
    """Template field definitions for dynamic forms"""
    __tablename__ = "template_fields"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("document_templates.id"), nullable=False)
    
    # Field definition
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, number, date, select, etc.
    field_description = Column(Text, nullable=True)
    
    # Field configuration
    is_required = Column(Boolean, default=False)
    default_value = Column(Text, nullable=True)
    field_options = Column(JSON, nullable=True)  # For select fields, validation rules, etc.
    
    # Position and grouping
    field_order = Column(Integer, default=0)
    field_group = Column(String(100), nullable=True)
    
    # Validation
    validation_rules = Column(JSON, nullable=True)
    error_message = Column(String(500), nullable=True)
    
    # Relationships
    template = relationship("DocumentTemplate")
    
    # Indexes
    __table_args__ = (
        Index('ix_template_fields_template_order', 'template_id', 'field_order'),
        Index('ix_template_fields_group', 'template_id', 'field_group'),
    )
    
    def __repr__(self):
        return f"<TemplateField(template_id={self.template_id}, name={self.field_name})>"