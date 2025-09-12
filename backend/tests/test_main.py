import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_read_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "CA-DMS API is running"
    assert data["version"] == "1.0.0"


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_get_documents_empty():
    """Test getting documents when database is empty"""
    response = client.get("/api/v1/documents/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert "documents" in data
    assert isinstance(data["documents"], list)
    # Note: Database may not be empty due to previous tests


def test_create_and_get_document():
    """Test creating and retrieving a document"""
    document_data = {
        "title": "Test Governance Document",
        "content": {
            "ops": [
                {"insert": "This is a test document\n"}
            ]
        },
        "document_type": "governance"
    }
    
    # Create document
    response = client.post("/api/v1/documents/", json=document_data)
    assert response.status_code == 200
    
    created_doc = response.json()
    assert created_doc["title"] == document_data["title"]
    assert created_doc["content"] == document_data["content"]
    assert created_doc["document_type"] == document_data["document_type"]
    assert "id" in created_doc
    assert "created_at" in created_doc
    assert "updated_at" in created_doc
    assert created_doc["version"] == 1
    
    # Get the document
    doc_id = created_doc["id"]
    response = client.get(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 200
    
    retrieved_doc = response.json()
    assert retrieved_doc == created_doc


def test_update_document():
    """Test updating a document"""
    # Create a document first
    document_data = {
        "title": "Original Title",
        "content": {"ops": [{"insert": "Original content\n"}]},
        "document_type": "governance"
    }
    
    response = client.post("/api/v1/documents/", json=document_data)
    created_doc = response.json()
    doc_id = created_doc["id"]
    
    # Update the document
    updated_data = {
        "title": "Updated Title",
        "content": {"ops": [{"insert": "Updated content\n"}]},
        "document_type": "policy"
    }
    
    response = client.put(f"/api/v1/documents/{doc_id}", json=updated_data)
    assert response.status_code == 200
    
    updated_doc = response.json()
    assert updated_doc["title"] == updated_data["title"]
    assert updated_doc["content"] == updated_data["content"]
    assert updated_doc["document_type"] == updated_data["document_type"]
    assert updated_doc["version"] == 2


def test_delete_document():
    """Test deleting a document"""
    # Create a document first
    document_data = {
        "title": "Document to Delete",
        "content": {"ops": [{"insert": "Content to delete\n"}]},
        "document_type": "governance"
    }
    
    response = client.post("/api/v1/documents/", json=document_data)
    created_doc = response.json()
    doc_id = created_doc["id"]
    
    # Delete the document
    response = client.delete(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Document deleted successfully"
    
    # Verify document is deleted
    response = client.get(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 404


def test_get_nonexistent_document():
    """Test getting a document that doesn't exist"""
    response = client.get("/api/v1/documents/nonexistent-id")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Document not found"


def test_generate_pdf_for_document():
    """Test generating PDF for a document"""
    # Create a document first
    document_data = {
        "title": "PDF Test Document",
        "content": {
            "ops": [
                {"insert": "This document will be converted to PDF\n"},
                {"insert": "Second line of content\n"}
            ]
        },
        "document_type": "governance"
    }
    
    response = client.post("/api/v1/documents/", json=document_data)
    created_doc = response.json()
    doc_id = created_doc["id"]
    
    # Generate PDF for the document
    response = client.get(f"/api/v1/documents/{doc_id}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0  # PDF should have content
    

def test_generate_pdf_for_nonexistent_document():
    """Test generating PDF for a document that doesn't exist"""
    response = client.get("/api/v1/documents/nonexistent-id/pdf")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Document not found"


def test_pdf_generation_with_placeholders():
    """Test PDF generation with placeholder objects in content"""
    document_data = {
        "title": "Document with Placeholders",
        "content": {
            "ops": [
                {"insert": "This document has placeholders:\n"},
                {
                    "insert": {
                        "version-table": {
                            "data": {
                                "version": "1.0",
                                "date": "2024-01-01",
                                "author": "Test Author"
                            }
                        }
                    }
                },
                {"insert": "\n"},
                {
                    "insert": {
                        "signature": {
                            "label": "Board President Signature",
                            "includeTitle": True
                        }
                    }
                },
                {"insert": "\n"}
            ]
        },
        "document_type": "governance"
    }
    
    response = client.post("/api/v1/documents/", json=document_data)
    created_doc = response.json()
    doc_id = created_doc["id"]
    
    # Generate PDF for the document
    response = client.get(f"/api/v1/documents/{doc_id}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0