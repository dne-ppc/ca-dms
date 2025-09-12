"""
Document history model for tracking document versions and changes
"""
from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class DocumentHistory(Base):
    """Store historical versions of documents for comparison and rollback"""
    __tablename__ = "document_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    
    # Content snapshot at this version
    title = Column(String(255), nullable=False)
    content = Column(JSON, nullable=False)  # Complete Quill Delta at this version
    document_type = Column(String(50), nullable=False)
    placeholders = Column(JSON, nullable=True)
    
    # Change tracking
    change_summary = Column(Text, nullable=True)  # Human-readable summary of changes
    change_details = Column(JSON, nullable=True)  # Detailed change analysis
    parent_version = Column(Integer, nullable=True)  # Previous version number
    
    # User and timestamp information
    created_by = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Metadata
    is_major_version = Column(Boolean, default=False)  # Mark significant versions
    tags = Column(JSON, nullable=True)  # Version tags like 'approved', 'draft', etc.
    
    # Relationships
    document = relationship("Document", back_populates="history")
    
    # Performance indexes
    __table_args__ = (
        Index('ix_document_history_doc_version', 'document_id', 'version_number'),
        Index('ix_document_history_created_desc', created_at.desc()),
        Index('ix_document_history_major_versions', 'document_id', 'is_major_version'),
    )
    
    def __repr__(self):
        return f"<DocumentHistory(id={self.id}, document_id={self.document_id}, version={self.version_number})>"


class DocumentComparison(Base):
    """Store comparison results between document versions"""
    __tablename__ = "document_comparisons"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    
    # Versions being compared
    old_version = Column(Integer, nullable=False)
    new_version = Column(Integer, nullable=False)
    
    # Comparison results
    comparison_result = Column(JSON, nullable=False)  # Full ComparisonResult object
    diff_delta = Column(JSON, nullable=True)  # Delta representing the differences
    
    # Statistics
    added_text = Column(Integer, default=0)
    deleted_text = Column(Integer, default=0)
    modified_text = Column(Integer, default=0)
    similarity_score = Column(Integer, default=0)  # Stored as percentage (0-100)
    
    # Placeholder-specific changes
    placeholder_changes = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_by = Column(String, nullable=True)
    
    # Performance indexes
    __table_args__ = (
        Index('ix_document_comparisons_versions', 'document_id', 'old_version', 'new_version'),
        Index('ix_document_comparisons_similarity', 'similarity_score'),
    )
    
    def __repr__(self):
        return f"<DocumentComparison(document_id={self.document_id}, v{self.old_version}->v{self.new_version})>"


class MergeConflict(Base):
    """Track merge conflicts that need resolution"""
    __tablename__ = "merge_conflicts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    
    # Merge information
    base_version = Column(Integer, nullable=False)
    left_version = Column(Integer, nullable=False)
    right_version = Column(Integer, nullable=False)
    
    # Conflict details
    conflict_type = Column(String(50), nullable=False)  # 'content', 'placeholder', 'attribute'
    conflict_position = Column(Integer, nullable=False)
    conflict_length = Column(Integer, default=0)
    
    # Conflict data
    base_content = Column(JSON, nullable=True)
    left_content = Column(JSON, nullable=True)
    right_content = Column(JSON, nullable=True)
    
    # Resolution
    is_resolved = Column(Boolean, default=False)
    resolved_content = Column(JSON, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_by = Column(String, nullable=True)
    
    # Relationships
    document = relationship("Document")
    
    # Performance indexes
    __table_args__ = (
        Index('ix_merge_conflicts_unresolved', 'document_id', 'is_resolved'),
        Index('ix_merge_conflicts_position', 'document_id', 'conflict_position'),
    )
    
    def __repr__(self):
        return f"<MergeConflict(document_id={self.document_id}, type={self.conflict_type}, resolved={self.is_resolved})>"