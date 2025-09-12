"""
Tests for database models and operations
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.document import Document
from datetime import datetime


@pytest.fixture(scope="function")
def db_session():
    """Create a test database session"""
    # Create an in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()


def test_create_document(db_session):
    """Test creating a document in the database"""
    document_data = {
        "title": "Test Document",
        "content": {
            "ops": [
                {"insert": "Hello World!\n"}
            ]
        },
        "document_type": "governance"
    }
    
    # Create document
    document = Document(**document_data)
    db_session.add(document)
    db_session.commit()
    
    # Verify document was created
    assert document.id is not None
    assert document.title == "Test Document"
    assert document.content == document_data["content"]
    assert document.document_type == "governance"
    assert document.version == 1
    assert document.created_at is not None
    assert document.updated_at is not None


def test_document_with_placeholders(db_session):
    """Test creating a document with placeholder metadata"""
    document_data = {
        "title": "Document with Placeholders",
        "content": {
            "ops": [
                {"insert": "Document content\n"},
                {
                    "insert": {
                        "signature": {
                            "label": "Board President",
                            "includeTitle": True
                        }
                    }
                }
            ]
        },
        "document_type": "governance",
        "placeholders": {
            "signatures": [
                {
                    "id": "sig-1",
                    "label": "Board President",
                    "includeTitle": True,
                    "position": 1
                }
            ]
        }
    }
    
    document = Document(**document_data)
    db_session.add(document)
    db_session.commit()
    
    # Verify placeholder metadata is stored
    assert document.placeholders is not None
    assert "signatures" in document.placeholders
    assert len(document.placeholders["signatures"]) == 1
    assert document.placeholders["signatures"][0]["label"] == "Board President"


def test_document_version_increment(db_session):
    """Test that document version increments correctly"""
    # Create initial document
    document = Document(
        title="Versioned Document",
        content={"ops": [{"insert": "Version 1\n"}]},
        document_type="governance"
    )
    db_session.add(document)
    db_session.commit()
    
    original_id = document.id
    assert document.version == 1
    
    # Create a new version (simulating update)
    updated_document = Document(
        id=original_id,  # Same ID for versioning
        title="Versioned Document",
        content={"ops": [{"insert": "Version 2\n"}]},
        document_type="governance",
        version=2
    )
    
    # In a real scenario, we would merge/update, but for testing we create new
    db_session.merge(updated_document)
    db_session.commit()
    
    # Verify version was updated
    retrieved = db_session.query(Document).filter(Document.id == original_id).first()
    assert retrieved.version == 2


def test_query_documents_by_type(db_session):
    """Test querying documents by type"""
    # Create documents of different types
    doc1 = Document(title="Governance Doc", content={"ops": []}, document_type="governance")
    doc2 = Document(title="Policy Doc", content={"ops": []}, document_type="policy")
    doc3 = Document(title="Another Governance Doc", content={"ops": []}, document_type="governance")
    
    db_session.add_all([doc1, doc2, doc3])
    db_session.commit()
    
    # Query by type
    governance_docs = db_session.query(Document).filter(Document.document_type == "governance").all()
    policy_docs = db_session.query(Document).filter(Document.document_type == "policy").all()
    
    assert len(governance_docs) == 2
    assert len(policy_docs) == 1
    assert governance_docs[0].document_type == "governance"
    assert policy_docs[0].document_type == "policy"


def test_document_timestamps(db_session):
    """Test that timestamps are set correctly"""
    document = Document(
        title="Timestamp Test",
        content={"ops": []},
        document_type="governance"
    )
    
    db_session.add(document)
    db_session.commit()
    
    # Check that timestamps are set
    assert document.created_at is not None
    assert document.updated_at is not None
    assert isinstance(document.created_at, datetime)
    assert isinstance(document.updated_at, datetime)


def test_document_search_by_title(db_session):
    """Test searching documents by title"""
    # Create test documents
    doc1 = Document(title="Board Meeting Minutes", content={"ops": []}, document_type="governance")
    doc2 = Document(title="Policy Update", content={"ops": []}, document_type="policy")
    doc3 = Document(title="Board Resolution", content={"ops": []}, document_type="governance")
    
    db_session.add_all([doc1, doc2, doc3])
    db_session.commit()
    
    # Search for documents with "Board" in title
    board_docs = db_session.query(Document).filter(Document.title.contains("Board")).all()
    
    assert len(board_docs) == 2
    titles = [doc.title for doc in board_docs]
    assert "Board Meeting Minutes" in titles
    assert "Board Resolution" in titles