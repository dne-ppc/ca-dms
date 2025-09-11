from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter()


# Pydantic models for API
class DocumentBase(BaseModel):
    title: str
    content: dict  # Quill Delta format
    document_type: str = "governance"


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase):
    id: str
    created_at: datetime
    updated_at: datetime
    version: int = 1

    class Config:
        from_attributes = True


# Temporary in-memory storage for development
documents_db = {}


@router.get("/", response_model=List[Document])
def get_documents():
    """Get all documents"""
    return list(documents_db.values())


@router.get("/{document_id}", response_model=Document)
def get_document(document_id: str):
    """Get a specific document by ID"""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    return documents_db[document_id]


@router.post("/", response_model=Document)
def create_document(document: DocumentCreate):
    """Create a new document"""
    doc_id = str(uuid.uuid4())
    now = datetime.now()
    
    new_doc = Document(
        id=doc_id,
        title=document.title,
        content=document.content,
        document_type=document.document_type,
        created_at=now,
        updated_at=now,
        version=1
    )
    
    documents_db[doc_id] = new_doc
    return new_doc


@router.put("/{document_id}", response_model=Document)
def update_document(document_id: str, document_update: DocumentCreate):
    """Update a document"""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    
    existing_doc = documents_db[document_id]
    updated_doc = Document(
        id=document_id,
        title=document_update.title,
        content=document_update.content,
        document_type=document_update.document_type,
        created_at=existing_doc.created_at,
        updated_at=datetime.now(),
        version=existing_doc.version + 1
    )
    
    documents_db[document_id] = updated_doc
    return updated_doc


@router.delete("/{document_id}")
def delete_document(document_id: str):
    """Delete a document"""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    
    del documents_db[document_id]
    return {"message": "Document deleted successfully"}