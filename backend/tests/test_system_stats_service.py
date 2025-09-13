"""
Test suite for system statistics service - TDD Red Phase
Testing business logic for system-wide statistics aggregation and caching
"""
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Mark all async tests in this module
pytestmark = pytest.mark.asyncio


@pytest.fixture
def db_session():
    """Create database session for testing"""
    database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class TestSystemStatsService:
    """Test system statistics service business logic"""

    def test_system_stats_service_exists(self):
        """Test that SystemStatsService class exists"""
        # GREEN: This should pass now as service exists
        from app.services.system_stats_service import SystemStatsService
        assert SystemStatsService is not None

    def test_get_system_overview_method_exists(self):
        """Test that get_system_overview method exists"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        assert hasattr(service, 'get_system_overview')

    async def test_get_system_overview_returns_correct_structure(self, db_session):
        """Test that get_system_overview returns correct data structure"""
        # GREEN: Should pass - service and method exist
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        result = await service.get_system_overview()

        # Expected structure
        assert 'total_documents' in result
        assert 'active_users' in result
        assert 'documents_today' in result
        assert 'system_health_score' in result
        assert 'last_updated' in result

    async def test_get_system_overview_performance(self, db_session):
        """Test that get_system_overview completes within performance target"""
        # GREEN: Should pass - service exists and performance is optimized
        import time
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()

        start_time = time.time()
        result = await service.get_system_overview()
        response_time = (time.time() - start_time) * 1000

        # Target: <500ms for fresh calculations (first call)
        assert response_time < 500, f"System overview took {response_time:.2f}ms, target is <500ms"
        assert result is not None

    def test_calculate_system_health_method_exists(self):
        """Test that calculate_system_health method exists"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        assert hasattr(service, 'calculate_system_health')

    async def test_calculate_system_health_returns_score(self, db_session):
        """Test that calculate_system_health returns valid health score"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        health_score = await service.calculate_system_health()

        # Health score should be between 0 and 100
        assert isinstance(health_score, (int, float))
        assert 0 <= health_score <= 100

    def test_get_document_statistics_method_exists(self):
        """Test that get_document_statistics method exists"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        assert hasattr(service, 'get_document_statistics')

    async def test_get_document_statistics_returns_data(self, db_session):
        """Test that get_document_statistics returns document metrics"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        doc_stats = await service.get_document_statistics()

        # Expected document statistics
        assert 'total_documents' in doc_stats
        assert 'documents_today' in doc_stats
        assert 'documents_this_week' in doc_stats
        assert 'documents_this_month' in doc_stats
        assert 'document_types' in doc_stats

    def test_get_workflow_statistics_method_exists(self):
        """Test that get_workflow_statistics method exists"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        assert hasattr(service, 'get_workflow_statistics')

    async def test_get_workflow_statistics_returns_data(self, db_session):
        """Test that get_workflow_statistics returns workflow metrics"""
        # GREEN: Should pass - method exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()
        workflow_stats = await service.get_workflow_statistics()

        # Expected workflow statistics
        assert 'total_workflows' in workflow_stats
        assert 'pending_workflows' in workflow_stats
        assert 'completed_workflows' in workflow_stats
        assert 'avg_completion_time' in workflow_stats
        assert 'completion_rate' in workflow_stats

    async def test_caching_integration_works(self, db_session):
        """Test that service integrates with caching layer"""
        # GREEN: Should pass - caching integration exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()

        # First call should hit database
        result1 = await service.get_system_overview()

        # Second call should hit cache (faster)
        import time
        start_time = time.time()
        result2 = await service.get_system_overview()
        cache_time = (time.time() - start_time) * 1000

        # Cached result should be fast (<50ms for in-memory cache)
        assert cache_time < 50, f"Cached result took {cache_time:.2f}ms, should be <50ms"
        # Note: exact equality may vary due to timestamps, check key fields
        assert result1['total_documents'] == result2['total_documents']

    async def test_error_handling_for_database_failures(self, db_session):
        """Test that service handles database failures gracefully"""
        # GREEN: Should pass - error handling exists
        from app.services.system_stats_service import SystemStatsService

        # Mock database failure at the engine level
        service = SystemStatsService()

        # Patch the SessionLocal to simulate connection failure
        with patch.object(service, 'SessionLocal') as mock_session:
            mock_session.side_effect = Exception("Database connection failed")

            result = await service.get_system_overview()

            # Should return default values on failure, not crash
            assert result is not None
            assert 'error' in result or 'total_documents' in result
            assert result['data_source'] == 'error_fallback'

    async def test_real_time_data_freshness(self, db_session):
        """Test that service provides configurable data freshness"""
        # GREEN: Should pass - freshness configuration exists
        from app.services.system_stats_service import SystemStatsService
        service = SystemStatsService()

        # Should be able to force fresh data
        result = await service.get_system_overview(force_refresh=True)
        assert result is not None
        assert 'total_documents' in result

        # Should be able to get cached data
        result = await service.get_system_overview(use_cache=True)
        assert result is not None
        assert 'total_documents' in result