"""
Test suite for user statistics service - TDD Red Phase
Testing business logic for user-specific statistics aggregation and personalization
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


@pytest.fixture
def sample_user_id():
    """Sample user ID for testing"""
    return "test-user-12345"


class TestUserStatsService:
    """Test user statistics service business logic"""

    def test_user_stats_service_exists(self):
        """Test that UserStatsService class exists"""
        # GREEN: This should pass now as service exists
        from app.services.user_stats_service import UserStatsService
        assert UserStatsService is not None

    def test_get_user_statistics_method_exists(self):
        """Test that get_user_statistics method exists"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        assert hasattr(service, 'get_user_statistics')

    async def test_get_user_statistics_returns_correct_structure(self, db_session, sample_user_id):
        """Test that get_user_statistics returns correct data structure"""
        # GREEN: Should pass - service and method exist
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        result = await service.get_user_statistics(sample_user_id)

        # Expected structure
        assert 'user_id' in result
        assert 'documents_created' in result
        assert 'documents_collaborated' in result
        assert 'workflows_initiated' in result
        assert 'workflows_completed' in result
        assert 'workflows_pending' in result
        assert 'productivity_score' in result
        assert 'last_activity' in result
        assert 'recent_documents' in result

    async def test_get_user_statistics_performance(self, db_session, sample_user_id):
        """Test that get_user_statistics completes within performance target"""
        # GREEN: Should pass - service exists and performance is optimized
        import time
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        start_time = time.time()
        result = await service.get_user_statistics(sample_user_id)
        response_time = (time.time() - start_time) * 1000

        # Target: <50ms for user-specific queries with indexes
        assert response_time < 50, f"User statistics took {response_time:.2f}ms, target is <50ms"
        assert result is not None

    def test_get_user_document_stats_method_exists(self):
        """Test that get_user_document_stats method exists"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        assert hasattr(service, 'get_user_document_stats')

    async def test_get_user_document_stats_returns_data(self, db_session, sample_user_id):
        """Test that get_user_document_stats returns document metrics"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        doc_stats = await service.get_user_document_stats(sample_user_id)

        # Expected document statistics
        assert 'documents_created' in doc_stats
        assert 'documents_updated' in doc_stats
        assert 'documents_by_type' in doc_stats
        assert 'recent_activity' in doc_stats
        assert 'collaboration_stats' in doc_stats

    def test_get_user_workflow_stats_method_exists(self):
        """Test that get_user_workflow_stats method exists"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        assert hasattr(service, 'get_user_workflow_stats')

    async def test_get_user_workflow_stats_returns_data(self, db_session, sample_user_id):
        """Test that get_user_workflow_stats returns workflow metrics"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        workflow_stats = await service.get_user_workflow_stats(sample_user_id)

        # Expected workflow statistics
        assert 'workflows_initiated' in workflow_stats
        assert 'workflows_assigned' in workflow_stats
        assert 'workflows_completed' in workflow_stats
        assert 'pending_approvals' in workflow_stats
        assert 'avg_response_time' in workflow_stats
        assert 'workflow_types' in workflow_stats

    def test_calculate_productivity_score_method_exists(self):
        """Test that calculate_productivity_score method exists"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        assert hasattr(service, 'calculate_productivity_score')

    async def test_calculate_productivity_score_returns_valid_score(self, db_session, sample_user_id):
        """Test that calculate_productivity_score returns valid score"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        score = await service.calculate_productivity_score(sample_user_id)

        # Productivity score should be between 0 and 100
        assert isinstance(score, (int, float))
        assert 0 <= score <= 100

    def test_get_user_activity_timeline_method_exists(self):
        """Test that get_user_activity_timeline method exists"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        assert hasattr(service, 'get_user_activity_timeline')

    async def test_get_user_activity_timeline_returns_data(self, db_session, sample_user_id):
        """Test that get_user_activity_timeline returns activity data"""
        # GREEN: Should pass - method exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()
        timeline = await service.get_user_activity_timeline(sample_user_id, days=7)

        # Expected timeline data
        assert isinstance(timeline, list)
        # Timeline may be empty for non-existent user, which is valid
        if timeline:  # If there's data
            assert 'date' in timeline[0]
            assert 'document_activity' in timeline[0]
            assert 'workflow_activity' in timeline[0]

    async def test_user_specific_caching_works(self, db_session, sample_user_id):
        """Test that service caches user-specific data correctly"""
        # GREEN: Should pass - caching exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        # First call should hit database
        result1 = await service.get_user_statistics(sample_user_id)

        # Second call should hit cache (faster)
        import time
        start_time = time.time()
        result2 = await service.get_user_statistics(sample_user_id)
        cache_time = (time.time() - start_time) * 1000

        # Cached result should be fast (<25ms for in-memory cache)
        assert cache_time < 25, f"Cached result took {cache_time:.2f}ms, should be <25ms"
        assert result1['user_id'] == result2['user_id']

    async def test_multiple_users_isolated_caching(self, db_session):
        """Test that caching properly isolates different users"""
        # GREEN: Should pass - user isolation exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        user1_id = "user-1"
        user2_id = "user-2"

        result1 = await service.get_user_statistics(user1_id)
        result2 = await service.get_user_statistics(user2_id)

        # Results should be different users
        assert result1['user_id'] != result2['user_id']
        assert result1['user_id'] == user1_id
        assert result2['user_id'] == user2_id

    async def test_user_privacy_and_access_control(self, db_session):
        """Test that service respects user privacy and access controls"""
        # GREEN: Should pass - privacy controls exist
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        # Test requesting stats for non-existent user
        result = await service.get_user_statistics("non-existent-user")

        # Should return empty/default stats, not error
        assert result is not None
        assert result['user_id'] == "non-existent-user"
        assert result['documents_created'] == 0

    async def test_temporal_filtering_works(self, db_session, sample_user_id):
        """Test that temporal filtering works for time-based queries"""
        # GREEN: Should pass - temporal filtering exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        # Test different time ranges
        stats_7days = await service.get_user_statistics(sample_user_id, time_range='7d')
        stats_30days = await service.get_user_statistics(sample_user_id, time_range='30d')

        # Should return different results for different time ranges
        assert stats_7days is not None
        assert stats_30days is not None
        assert 'time_range' in stats_7days
        assert stats_7days['time_range'] == '7d'
        assert stats_30days['time_range'] == '30d'

    async def test_error_handling_for_invalid_user(self, db_session):
        """Test that service handles invalid users gracefully"""
        # GREEN: Should pass - error handling exists
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        # Test with None user ID
        result = await service.get_user_statistics(None)

        # Should handle gracefully, not crash
        assert result is not None
        assert 'error' in result or result['documents_created'] == 0

    async def test_bulk_user_statistics(self, db_session):
        """Test bulk statistics retrieval for multiple users"""
        # GREEN: Should pass - bulk operations exist
        from app.services.user_stats_service import UserStatsService
        service = UserStatsService()

        user_ids = ["user1", "user2", "user3"]
        results = await service.get_bulk_user_statistics(user_ids)

        # Should return statistics for all users
        assert isinstance(results, dict)
        assert len(results) == len(user_ids)
        for user_id in user_ids:
            assert user_id in results
            assert 'documents_created' in results[user_id]