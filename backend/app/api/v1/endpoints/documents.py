from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.core.database import get_db
from app.services.document_service import DocumentService
from app.schemas.document import (
    DocumentCreate, 
    DocumentUpdate, 
    DocumentResponse, 
    DocumentList,
    DocumentSearchQuery,
    DocumentSearchResponse
)

router = APIRouter()


def convert_quill_delta_to_pdf_content(delta_content: dict) -> List[str]:
    """Convert Quill Delta content to plain text for PDF generation"""
    paragraphs = []
    current_text = ""
    
    for op in delta_content.get("ops", []):
        if isinstance(op.get("insert"), str):
            text = op["insert"]
            if text.endswith("\n"):
                # End of paragraph
                current_text += text.rstrip("\n")
                if current_text.strip():
                    paragraphs.append(current_text.strip())
                current_text = ""
            else:
                current_text += text
        elif isinstance(op.get("insert"), dict):
            # Handle placeholder objects
            placeholder = op["insert"]
            if "version-table" in placeholder:
                version_data = placeholder["version-table"]["data"]
                table_text = f"Version: {version_data.get('version', 'N/A')} | Date: {version_data.get('date', 'N/A')} | Author: {version_data.get('author', 'N/A')}"
                paragraphs.append(f"[VERSION TABLE: {table_text}]")
            elif "signature" in placeholder:
                sig_data = placeholder["signature"]
                sig_text = f"Signature: {sig_data.get('label', 'Signature')}"
                if sig_data.get('includeTitle'):
                    sig_text += " (with title)"
                paragraphs.append(f"[{sig_text}]")
            elif "long-response" in placeholder:
                response_data = placeholder["long-response"]
                lines = response_data.get('lines', 5)
                paragraphs.append(f"[RESPONSE AREA: {lines} lines]")
            elif "line-segment" in placeholder:
                segment_data = placeholder["line-segment"]
                length = segment_data.get('length', 'medium')
                paragraphs.append(f"[LINE SEGMENT: {length}]")
    
    # Add any remaining text
    if current_text.strip():
        paragraphs.append(current_text.strip())
    
    return paragraphs if paragraphs else [""]


def generate_pdf_from_document(document: DocumentResponse) -> bytes:
    """Generate a PDF from a document"""
    buffer = io.BytesIO()
    
    # Create the PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=1*inch,
        bottomMargin=1*inch,
        leftMargin=1*inch,
        rightMargin=1*inch
    )
    
    # Build content
    content = []
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=20,
        alignment=1  # Center alignment
    )
    
    # Add title
    title = Paragraph(document.title, title_style)
    content.append(title)
    content.append(Spacer(1, 20))
    
    # Convert Delta content to paragraphs
    text_content = convert_quill_delta_to_pdf_content(document.content)
    
    # Add content paragraphs
    for paragraph_text in text_content:
        if paragraph_text.startswith("[") and paragraph_text.endswith("]"):
            # Special formatting for placeholders
            placeholder_style = ParagraphStyle(
                'Placeholder',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.grey,
                leftIndent=20,
                rightIndent=20,
                spaceAfter=12
            )
            paragraph = Paragraph(paragraph_text, placeholder_style)
        else:
            # Regular paragraph
            paragraph = Paragraph(paragraph_text, styles['Normal'])
        
        content.append(paragraph)
        content.append(Spacer(1, 12))
    
    # Add document metadata footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=1  # Center alignment
    )
    
    content.append(Spacer(1, 30))
    footer_text = f"Document ID: {document.id} | Version: {document.version} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    footer = Paragraph(footer_text, footer_style)
    content.append(footer)
    
    # Build the PDF
    doc.build(content)
    
    # Get the PDF bytes
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


@router.get("/", response_model=DocumentList)
def get_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    document_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Get all documents with optional filtering"""
    service = DocumentService(db)
    documents = service.get_documents(skip=skip, limit=limit, document_type=document_type)
    
    # Convert SQLAlchemy models to Pydantic models
    document_responses = [DocumentResponse.model_validate(doc) for doc in documents]
    
    return DocumentList(
        documents=document_responses,
        total=len(document_responses),  # TODO: Implement proper count query
        skip=skip,
        limit=limit
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get a specific document by ID"""
    service = DocumentService(db)
    document = service.get_document(document_id)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse.model_validate(document)


@router.post("/", response_model=DocumentResponse)
def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    """Create a new document"""
    service = DocumentService(db)
    
    # Extract placeholders from content if not provided
    if not document.placeholders:
        document.placeholders = service.extract_placeholders_from_content(document.content)
    
    new_document = service.create_document(document)
    return DocumentResponse.model_validate(new_document)


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(document_id: str, document_update: DocumentUpdate, db: Session = Depends(get_db)):
    """Update a document"""
    service = DocumentService(db)
    
    # Extract placeholders from content if provided and not already set
    if document_update.content and not document_update.placeholders:
        document_update.placeholders = service.extract_placeholders_from_content(document_update.content)
    
    updated_document = service.update_document(document_id, document_update)
    
    if not updated_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse.model_validate(updated_document)


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document"""
    service = DocumentService(db)
    
    if not service.delete_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/pdf")
def generate_document_pdf(document_id: str, db: Session = Depends(get_db)):
    """Generate PDF for a specific document"""
    service = DocumentService(db)
    document = service.get_document(document_id)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        document_response = DocumentResponse.model_validate(document)
        pdf_bytes = generate_pdf_from_document(document_response)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=\"{document.title}.pdf\""
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


@router.get("/search/", response_model=DocumentSearchResponse)
def search_documents(
    query: str = Query(..., min_length=1),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Search documents by title"""
    service = DocumentService(db)
    documents = service.search_documents(query)
    
    # Limit results
    limited_documents = documents[:limit]
    document_responses = [DocumentResponse.model_validate(doc) for doc in limited_documents]
    
    return DocumentSearchResponse(
        documents=document_responses,
        query=query,
        total=len(document_responses)
    )