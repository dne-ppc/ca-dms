"""
Integration test to validate frontend-backend compatibility for advanced search
"""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_advanced_search_response_format_matches_frontend_expectations():
    """Test that advanced search response format matches frontend expectations"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Test the exact same request that frontend makes
        response = await ac.get(
            "/api/v1/documents/advanced-search",
            params={
                "sort_by": "relevance",
                "sort_order": "desc", 
                "limit": 20,
                "highlight": "true",
                "context_length": 100,
                "search_placeholders": "true",
                "include_stats": "true"
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response has expected structure that frontend expects
        assert "results" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data
        
        # Verify results structure
        assert isinstance(data["results"], list)
        
        # If there are results, verify structure
        if data["results"]:
            result = data["results"][0]
            assert "document" in result
            assert "relevance_score" in result
            assert "highlights" in result
            
            # Verify document structure
            doc = result["document"]
            assert "id" in doc
            assert "title" in doc
            assert "document_type" in doc
            # Either created_at or createdAt should be present for date handling
            assert "created_at" in doc or "createdAt" in doc


@pytest.mark.asyncio
async def test_advanced_search_with_filters():
    """Test advanced search with document type filter"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/documents/advanced-search",
            params={
                "document_type": "governance",
                "include_stats": "true",
                "limit": 5
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "statistics" in data
        
        # If there are governance documents, verify they all have correct type
        if data["results"]:
            for result in data["results"]:
                assert result["document"]["document_type"] == "governance"


@pytest.mark.asyncio 
async def test_advanced_search_statistics_structure():
    """Test that statistics have expected structure for frontend"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/documents/advanced-search",
            params={
                "include_stats": "true",
                "limit": 1
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Statistics should be present
        if "statistics" in data and data["statistics"]:
            stats = data["statistics"]
            assert "total_matches" in stats
            assert "search_time_ms" in stats
            assert "document_type_breakdown" in stats
            assert "timestamp" in stats
            
            # Verify document type breakdown is a dict
            assert isinstance(stats["document_type_breakdown"], dict)