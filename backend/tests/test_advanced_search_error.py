"""
Test for advanced search error - TDD approach
RED: This test should fail initially, showing the 500 error
GREEN: Fix the implementation to make the test pass
"""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_advanced_search_should_not_return_500_error():
    """Test that advanced search with filters doesn't return 500 error"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # This should not return 500 error
        response = await ac.get(
            "/api/v1/documents/advanced-search",
            params={
                "document_type": "governance",
                "include_stats": "true",
                "limit": 5
            }
        )
        
        # Should not be 500 (internal server error)
        assert response.status_code != 500, f"Got 500 error: {response.text}"
        
        # Should be successful
        assert response.status_code == 200
        
        # Should return valid JSON response
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert "statistics" in data