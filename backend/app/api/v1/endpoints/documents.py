from typing import List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from datetime import datetime
import uuid
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

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


def generate_pdf_from_document(document: Document) -> bytes:
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


@router.get("/{document_id}/pdf")
def generate_document_pdf(document_id: str):
    """Generate PDF for a specific document"""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents_db[document_id]
    
    try:
        pdf_bytes = generate_pdf_from_document(document)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=\"{document.title}.pdf\""
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")