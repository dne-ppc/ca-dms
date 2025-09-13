"""
Document model for CA-DMS
"""
from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, index=True)
    content = Column(JSON, nullable=False)  # Quill Delta format
    document_type = Column(String(50), nullable=False, default="governance", index=True)
    version = Column(Integer, nullable=False, default=1)
    
    # Metadata for placeholder objects
    placeholders = Column(JSON, nullable=True)  # Extracted placeholder metadata
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)  # Index for sorting/filtering
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, index=True)
    
    # User tracking (will be enhanced with user management later)
    created_by = Column(String, nullable=True, index=True)  # Index for user filtering
    updated_by = Column(String, nullable=True)
    
    # Relationships
    history = relationship("DocumentHistory", back_populates="document", cascade="all, delete-orphan")
    signature_requests = relationship("SignatureRequest", back_populates="document", cascade="all, delete-orphan")
    
    # Performance indexes for common queries
    __table_args__ = (
        Index('ix_documents_created_by_type', 'created_by', 'document_type'),  # Composite index for user + type queries
        Index('ix_documents_created_at_type', 'created_at', 'document_type'),  # Composite index for time + type queries
        Index('ix_documents_updated_at_desc', updated_at.desc()),  # Descending index for recent updates
    )
    
    def __repr__(self):
        return f"<Document(id={self.id}, title={self.title}, version={self.version})>"