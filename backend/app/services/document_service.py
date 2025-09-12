"""
Document service layer for database operations
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.document import Document
from app.models.document_history import DocumentHistory
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.services.document_comparison_service import DocumentComparisonService
import uuid


class DocumentService:
    """Service layer for document operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_document(self, document_data: DocumentCreate, created_by: Optional[str] = None) -> Document:
        """Create a new document with optimized database operations"""
        # Generate UUID if not provided
        document_id = str(uuid.uuid4())
        
        # Create document instance with optimized field access
        db_document = Document(
            id=document_id,
            title=document_data.title,
            content=document_data.content,
            document_type=document_data.document_type,
            placeholders=document_data.placeholders,
            created_by=created_by,
            version=1  # New documents start at version 1
        )
        
        # Optimized database operations
        self.db.add(db_document)
        
        # Use flush instead of commit for better performance in bulk operations
        # commit() synchronizes to disk, flush() just sends to database
        self.db.flush()
        
        # Create initial history entry
        self._create_history_entry(
            document_id=document_id,
            version_number=1,
            title=document_data.title,
            content=document_data.content,
            document_type=document_data.document_type,
            placeholders=document_data.placeholders,
            change_summary="Initial document creation",
            created_by=created_by
        )
        
        # Only commit at the end to reduce I/O overhead
        self.db.commit()
        
        # Avoid refresh unless necessary - return the object as-is
        # refresh() causes an additional SELECT query
        return db_document
    
    def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID"""
        return self.db.query(Document).filter(Document.id == document_id).first()
    
    def get_documents(
        self, 
        skip: int = 0, 
        limit: int = 100,
        document_type: Optional[str] = None
    ) -> List[Document]:
        """Get documents with optional filtering"""
        query = self.db.query(Document)
        
        if document_type:
            query = query.filter(Document.document_type == document_type)
        
        return query.order_by(desc(Document.updated_at)).offset(skip).limit(limit).all()
    
    def update_document(self, document_id: str, document_data: DocumentUpdate, updated_by: Optional[str] = None) -> Optional[Document]:
        """Update a document"""
        db_document = self.get_document(document_id)
        if not db_document:
            return None
        
        # Store original state for history
        original_version = db_document.version
        original_content = db_document.content
        original_title = db_document.title
        
        # Update fields
        update_data = document_data.model_dump(exclude_unset=True)
        
        # Increment version when updating content or title
        version_incremented = False
        if "content" in update_data or "title" in update_data:
            db_document.version += 1
            version_incremented = True
        
        # Apply updates
        for field, value in update_data.items():
            if field != "version":  # Skip version field as we handle it above
                setattr(db_document, field, value)
        
        # Create history entry if version was incremented
        if version_incremented:
            # Generate change summary
            change_summary = self._generate_change_summary(
                original_content, 
                db_document.content,
                original_title,
                db_document.title
            )
            
            self._create_history_entry(
                document_id=document_id,
                version_number=db_document.version,
                title=db_document.title,
                content=db_document.content,
                document_type=db_document.document_type,
                placeholders=db_document.placeholders,
                change_summary=change_summary,
                parent_version=original_version,
                created_by=updated_by
            )
        
        self.db.commit()
        self.db.refresh(db_document)
        
        return db_document
    
    def delete_document(self, document_id: str) -> bool:
        """Delete a document"""
        db_document = self.get_document(document_id)
        if not db_document:
            return False
        
        self.db.delete(db_document)
        self.db.commit()
        
        return True
    
    def search_documents(self, query: str) -> List[Document]:
        """Search documents by title or content"""
        return (
            self.db.query(Document)
            .filter(Document.title.contains(query))
            .order_by(desc(Document.updated_at))
            .all()
        )
    
    def get_documents_by_type(self, document_type: str) -> List[Document]:
        """Get all documents of a specific type"""
        return (
            self.db.query(Document)
            .filter(Document.document_type == document_type)
            .order_by(desc(Document.updated_at))
            .all()
        )
    
    def extract_placeholders_from_content(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Extract placeholder metadata from Quill Delta content"""
        placeholders = {
            "signatures": [],
            "longResponses": [],
            "lineSegments": [],
            "versionTables": []
        }
        
        if not isinstance(content, dict) or "ops" not in content:
            return placeholders
        
        position = 0
        for op in content["ops"]:
            if isinstance(op.get("insert"), dict):
                insert_obj = op["insert"]
                
                # Handle signature placeholders
                if "signature" in insert_obj:
                    sig_data = insert_obj["signature"]
                    placeholders["signatures"].append({
                        "id": f"sig-{len(placeholders['signatures']) + 1}",
                        "label": sig_data.get("label", "Signature"),
                        "includeTitle": sig_data.get("includeTitle", False),
                        "position": position
                    })
                
                # Handle long response placeholders
                elif "longResponse" in insert_obj:
                    resp_data = insert_obj["longResponse"]
                    placeholders["longResponses"].append({
                        "id": f"resp-{len(placeholders['longResponses']) + 1}",
                        "label": resp_data.get("label", "Response Area"),
                        "lines": resp_data.get("lines", 5),
                        "position": position
                    })
                
                # Handle line segment placeholders
                elif "lineSegment" in insert_obj:
                    line_data = insert_obj["lineSegment"]
                    placeholders["lineSegments"].append({
                        "id": f"line-{len(placeholders['lineSegments']) + 1}",
                        "type": line_data.get("type", "short"),
                        "label": line_data.get("label", ""),
                        "position": position
                    })
                
                # Handle version table placeholders
                elif "versionTable" in insert_obj:
                    table_data = insert_obj["versionTable"]
                    placeholders["versionTables"].append({
                        "id": f"version-{len(placeholders['versionTables']) + 1}",
                        "immutable": table_data.get("immutable", True),
                        "position": position
                    })
            
            # Update position based on insert content
            if isinstance(op.get("insert"), str):
                position += len(op["insert"])
            else:
                position += 1  # For embedded objects
        
        return placeholders
    
    def _create_history_entry(
        self,
        document_id: str,
        version_number: int,
        title: str,
        content: Dict[str, Any],
        document_type: str,
        placeholders: Optional[Dict[str, Any]] = None,
        change_summary: Optional[str] = None,
        parent_version: Optional[int] = None,
        created_by: Optional[str] = None
    ) -> DocumentHistory:
        """Create a document history entry"""
        
        history_entry = DocumentHistory(
            document_id=document_id,
            version_number=version_number,
            title=title,
            content=content,
            document_type=document_type,
            placeholders=placeholders,
            change_summary=change_summary,
            parent_version=parent_version,
            created_by=created_by
        )
        
        self.db.add(history_entry)
        return history_entry
    
    def _generate_change_summary(
        self,
        old_content: Dict[str, Any],
        new_content: Dict[str, Any],
        old_title: str,
        new_title: str
    ) -> str:
        """Generate a human-readable summary of changes"""
        
        changes = []
        
        # Check title changes
        if old_title != new_title:
            changes.append(f"Title updated from '{old_title}' to '{new_title}'")
        
        # Use comparison service to analyze content changes
        try:
            comparison_service = DocumentComparisonService()
            comparison_result = comparison_service.compare_documents(old_content, new_content)
            
            if comparison_result.total_changes > 0:
                change_parts = []
                if comparison_result.added_text > 0:
                    change_parts.append(f"{comparison_result.added_text} characters added")
                if comparison_result.deleted_text > 0:
                    change_parts.append(f"{comparison_result.deleted_text} characters removed")
                if comparison_result.modified_text > 0:
                    change_parts.append(f"{comparison_result.modified_text} characters modified")
                
                if change_parts:
                    changes.append(f"Content changes: {', '.join(change_parts)}")
                
                # Add similarity score
                similarity_pct = int(comparison_result.similarity_score * 100)
                changes.append(f"Document similarity: {similarity_pct}%")
        
        except Exception as e:
            # Fallback to simple change detection
            changes.append("Content updated")
        
        return "; ".join(changes) if changes else "Document updated"