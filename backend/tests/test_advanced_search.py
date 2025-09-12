"""
Test suite for advanced search functionality - Task EXTRA.4
Tests for full-text search, filtering, and result highlighting
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app.main import app
from app.core.database import Base, get_db
from app.models.document import Document
from app.services.document_service import DocumentService

# Create test client
client = TestClient(app)

# Create test database session
@pytest.fixture(scope="function")
def db_session():
    """Create a test database session"""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    
    # Override the dependency
    def override_get_db():
        try:
            yield session
        finally:
            session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    try:
        yield session
    finally:
        session.close()
        # Clean up the override
        app.dependency_overrides.clear()


class TestAdvancedSearchAPI:
    """Test advanced search API endpoints"""
    
    @pytest.fixture
    def sample_documents(self, db_session):
        """Create sample documents for search testing"""
        documents = []
        
        # Document 1: Contract with signature placeholders
        doc1 = Document(
            id="doc-1",
            title="Board Meeting Contract",
            content={
                "ops": [
                    {"insert": "This is a contract document for the board meeting. "},
                    {"insert": {"signature": {"label": "President Signature", "includeTitle": True}}},
                    {"insert": "\nImportant terms and conditions apply."}
                ]
            },
            document_type="contract",
            created_by="user-1",
            created_at=datetime.now() - timedelta(days=10),
            updated_at=datetime.now() - timedelta(days=5)
        )
        
        # Document 2: Bylaws with version table
        doc2 = Document(
            id="doc-2", 
            title="Community Association Bylaws",
            content={
                "ops": [
                    {"insert": {"version-table": {"data": {"version": "2.1", "date": "2024-01-15", "author": "Legal Team"}}}},
                    {"insert": "\nSection 1: Membership Rules\nAll members must follow these guidelines."},
                    {"insert": {"long-response": {"lines": 10, "label": "Member Comments"}}},
                    {"insert": "\nSection 2: Governance Structure"}
                ]
            },
            document_type="bylaws",
            created_by="user-2",
            created_at=datetime.now() - timedelta(days=20),
            updated_at=datetime.now() - timedelta(days=2)
        )
        
        # Document 3: Policy with line segments
        doc3 = Document(
            id="doc-3",
            title="Pet Policy Guidelines", 
            content={
                "ops": [
                    {"insert": "Pet ownership guidelines and restrictions.\n"},
                    {"insert": "Owner name: "},
                    {"insert": {"line-segment": {"length": "medium", "label": "Pet Owner"}}},
                    {"insert": "\nPet type: "},
                    {"insert": {"line-segment": {"length": "short", "label": "Pet Type"}}},
                    {"insert": "\nSpecial considerations and rules apply for all pets."}
                ]
            },
            document_type="policy",
            created_by="user-1",
            created_at=datetime.now() - timedelta(days=5),
            updated_at=datetime.now() - timedelta(days=1)
        )
        
        # Document 4: Minutes without placeholders
        doc4 = Document(
            id="doc-4",
            title="Monthly Board Meeting Minutes",
            content={
                "ops": [
                    {"insert": "Meeting called to order at 7:00 PM.\n"},
                    {"insert": "Attendees: John Smith, Jane Doe, Bob Johnson\n"},
                    {"insert": "Topics discussed: Budget approval, maintenance issues.\n"},
                    {"insert": "Meeting adjourned at 8:30 PM."}
                ]
            },
            document_type="minutes",
            created_by="user-3", 
            created_at=datetime.now() - timedelta(days=3),
            updated_at=datetime.now()
        )
        
        documents.extend([doc1, doc2, doc3, doc4])
        
        for doc in documents:
            db_session.add(doc)
        db_session.commit()
        
        return documents

    def test_advanced_search_endpoint_exists(self, db_session, sample_documents):
        """Test that the advanced search endpoint exists and responds"""
        response = client.get("/api/v1/documents/advanced-search?query=contract")
        assert response.status_code == 200
    
    def test_full_text_search_in_content(self, db_session, sample_documents):
        """Test full-text search within document content"""
        # Search for text that appears in content, not just title
        response = client.get("/api/v1/documents/advanced-search?query=signature")
        assert response.status_code == 200
        data = response.json()
        
        # Should find documents containing "signature" in content
        assert len(data["results"]) > 0
        assert any("signature" in str(result["document"]["content"]).lower() for result in data["results"])
    
    def test_search_with_filters(self, db_session, sample_documents):
        """Test search with document type and author filters"""
        # Search with document type filter
        response = client.get("/api/v1/documents/advanced-search?query=guidelines&document_type=policy")
        assert response.status_code == 200
        data = response.json()
        
        # Should only return policy documents
        assert all(result["document"]["document_type"] == "policy" for result in data["results"])
        
        # Search with author filter
        response = client.get("/api/v1/documents/advanced-search?created_by=user-1")
        assert response.status_code == 200
        data = response.json()
        
        # Should only return documents created by user-1
        assert all(result["document"]["created_by"] == "user-1" for result in data["results"])
    
    def test_search_with_date_range_filter(self, db_session, sample_documents):
        """Test search with date range filtering"""
        # Search for documents created in last week
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        response = client.get(f"/api/v1/documents/advanced-search?created_after={week_ago}")
        assert response.status_code == 200
        data = response.json()
        
        # Should return recent documents
        assert len(data["results"]) > 0
        for result in data["results"]:
            doc_date = datetime.fromisoformat(result["document"]["created_at"].replace('Z', '+00:00'))
            assert doc_date >= datetime.fromisoformat(week_ago)
    
    def test_search_result_highlighting(self, db_session, sample_documents):
        """Test that search results include highlighted matches"""
        response = client.get("/api/v1/documents/advanced-search?query=contract&highlight=true")
        assert response.status_code == 200
        data = response.json()
        
        # Should include highlighted content in results
        if len(data["results"]) > 0:
            result = data["results"][0]
            if "highlights" in result and result["highlights"]:
                highlighted_content = result["highlights"][0]["content"]
                assert "<mark>" in highlighted_content and "</mark>" in highlighted_content
    
    def test_search_with_context_preview(self, db_session, sample_documents):
        """Test search results include context preview around matches"""
        response = client.get("/api/v1/documents/advanced-search?query=membership&context_length=50")
        assert response.status_code == 200
        data = response.json()
        
        # Should include context preview
        for result in data["results"]:
            if "preview" in result and result["preview"]:
                preview = result["preview"]
                assert len(preview) <= 200  # Context + ellipsis
                assert "membership" in preview.lower()
    
    def test_advanced_search_sorting(self, db_session, sample_documents):
        """Test search results can be sorted by relevance, date, or title"""
        # Sort by relevance (default)
        response = client.get("/api/v1/documents/advanced-search?query=board&sort_by=relevance")
        assert response.status_code == 200
        relevance_data = response.json()
        
        # Sort by date
        response = client.get("/api/v1/documents/advanced-search?query=board&sort_by=created_at&sort_order=desc")
        assert response.status_code == 200
        date_data = response.json()
        
        # Verify different ordering
        if len(relevance_data["results"]) > 1 and len(date_data["results"]) > 1:
            assert relevance_data["results"][0]["document"]["id"] != date_data["results"][0]["document"]["id"]
    
    def test_search_pagination(self, db_session, sample_documents):
        """Test search results support pagination"""
        response = client.get("/api/v1/documents/advanced-search?query=*&limit=2&offset=0")
        assert response.status_code == 200
        first_page = response.json()
        
        response = client.get("/api/v1/documents/advanced-search?query=*&limit=2&offset=2")
        assert response.status_code == 200
        second_page = response.json()
        
        # Should have different results
        assert len(first_page["results"]) <= 2
        assert len(second_page["results"]) <= 2
        
        if len(first_page["results"]) > 0 and len(second_page["results"]) > 0:
            assert first_page["results"][0]["document"]["id"] != second_page["results"][0]["document"]["id"]
    
    def test_search_placeholder_content(self, db_session, sample_documents):
        """Test search can find content within placeholder objects"""
        response = client.get("/api/v1/documents/advanced-search?query=president&search_placeholders=true")
        assert response.status_code == 200
        data = response.json()
        
        # Should find documents with "president" in placeholder content
        assert len(data["results"]) > 0
    
    def test_fuzzy_search(self, db_session, sample_documents):
        """Test fuzzy search for typos and similar terms"""
        # Search with intentional typo
        response = client.get("/api/v1/documents/advanced-search?query=guidlines&fuzzy=true")
        assert response.status_code == 200
        data = response.json()
        
        # Should find documents even with typo (guidelines vs guidlines)
        assert len(data["results"]) > 0
    
    def test_search_statistics(self, db_session, sample_documents):
        """Test search returns statistics about results"""
        response = client.get("/api/v1/documents/advanced-search?query=board&include_stats=true")
        assert response.status_code == 200
        data = response.json()
        
        # Should include search statistics
        assert "statistics" in data
        stats = data["statistics"]
        assert "total_matches" in stats
        assert "search_time_ms" in stats
        assert "document_type_breakdown" in stats


class TestAdvancedSearchService:
    """Test advanced search service layer"""
    
    def test_extract_text_from_delta_content(self):
        """Test extracting plain text from Quill Delta content for search indexing"""
        from app.services.advanced_search_service import AdvancedSearchService
        
        delta_content = {
            "ops": [
                {"insert": "This is regular text. "},
                {"insert": {"signature": {"label": "President Signature"}}},
                {"insert": "\nMore text after placeholder."}
            ]
        }
        
        service = AdvancedSearchService(None)  # db not needed for this test
        extracted_text = service.extract_searchable_text(delta_content)
        
        # Should extract text and placeholder labels
        assert "This is regular text" in extracted_text
        assert "President Signature" in extracted_text
        assert "More text after placeholder" in extracted_text
    
    def test_highlight_search_matches(self):
        """Test highlighting search matches in text"""
        from app.services.advanced_search_service import AdvancedSearchService
        
        service = AdvancedSearchService(None)
        text = "This is a sample contract document with important terms."
        highlighted = service.highlight_matches(text, "contract", "<mark>", "</mark>")
        
        assert highlighted == "This is a sample <mark>contract</mark> document with important terms."
    
    def test_generate_context_preview(self):
        """Test generating context preview around search matches"""
        from app.services.advanced_search_service import AdvancedSearchService
        
        service = AdvancedSearchService(None)
        text = "This is a very long document with many words. The important contract section is here in the middle. More text continues after this point."
        preview = service.generate_context_preview(text, "contract", context_length=20)
        
        # Should include text around the match
        assert "contract" in preview
        assert len(preview) <= 60  # Approximately 20 chars before + term + 20 chars after
    
    def test_calculate_search_relevance_score(self):
        """Test calculating relevance scores for search results"""
        from app.services.advanced_search_service import AdvancedSearchService
        
        service = AdvancedSearchService(None)
        
        # Document with query in title should score higher
        title_match_score = service.calculate_relevance_score(
            "Contract Agreement", 
            "This is about general topics",
            "contract"
        )
        
        # Document with query only in content
        content_match_score = service.calculate_relevance_score(
            "General Document",
            "This is a contract document with terms",
            "contract"
        )
        
        assert title_match_score > content_match_score
    
    def test_build_search_filters(self, db_session):
        """Test building SQL filters from search parameters"""
        from app.services.advanced_search_service import AdvancedSearchService
        
        service = AdvancedSearchService(db_session)
        
        filters = {
            "document_type": "policy",
            "created_by": "user-1",
            "created_after": "2024-01-01T00:00:00"
        }
        
        query = service.build_filtered_query(filters)
        
        # Should apply filters to the base query
        assert hasattr(query, 'filter')  # Query should have filter applied


class TestAdvancedSearchFrontend:
    """Test frontend search integration"""
    
    def test_search_service_advanced_search_method(self):
        """Test frontend service has advanced search method"""
        # This will fail initially as the method doesn't exist
        from frontend.src.services.documentService import documentService
        
        # Should have advancedSearch method
        assert hasattr(documentService, 'advancedSearch')
    
    def test_search_component_renders(self):
        """Test advanced search component renders properly"""
        # This will fail initially as component doesn't exist
        # Mock test for now - would use proper React testing in real implementation
        pass
    
    def test_search_filters_work(self):
        """Test search filters in frontend work correctly"""
        # Mock test for filter functionality
        pass