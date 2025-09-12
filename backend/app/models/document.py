"""
Document model for CA-DMS
"""
from sqlalchemy import Column, String, DateTime, Integer, Text, JSON
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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # User tracking (will be enhanced with user management later)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    
    def __repr__(self):
        return f"<Document(id={self.id}, title={self.title}, version={self.version})>"