"""
Test suite for intro page coordinator service - TDD Red Phase
Testing business logic for coordinating all intro page data sources and presentation
"""
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
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


class TestIntroPageCoordinator:
    """Test intro page coordinator service business logic"""

    def test_intro_page_coordinator_exists(self):
        """Test that IntroPageCoordinator class exists"""
        # GREEN: This should pass now as service exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        assert IntroPageCoordinator is not None

    def test_get_intro_page_data_method_exists(self):
        """Test that get_intro_page_data method exists"""
        # GREEN: Should pass - method exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        assert hasattr(coordinator, 'get_intro_page_data')

    async def test_get_intro_page_data_returns_correct_structure(self, db_session, sample_user_id):
        """Test that get_intro_page_data returns correct data structure"""
        # GREEN: Should pass - coordinator and method exist
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        result = await coordinator.get_intro_page_data(sample_user_id)

        # Expected structure
        assert 'user_id' in result
        assert 'user_statistics' in result
        assert 'system_overview' in result
        assert 'actionable_items' in result
        assert 'activity_feed' in result
        assert 'personalization' in result
        assert 'performance_metrics' in result
        assert 'last_updated' in result

    async def test_get_intro_page_data_performance(self, db_session, sample_user_id):
        """Test that get_intro_page_data completes within performance target"""
        # GREEN: Should pass - coordinator exists and performance is optimized
        import time
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        start_time = time.time()
        result = await coordinator.get_intro_page_data(sample_user_id)
        response_time = (time.time() - start_time) * 1000

        # Target: <500ms for full intro page data aggregation
        assert response_time < 500, f"Intro page data took {response_time:.2f}ms, target is <500ms"
        assert result is not None

    def test_get_personalized_content_method_exists(self):
        """Test that get_personalized_content method exists"""
        # GREEN: Should pass - method exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        assert hasattr(coordinator, 'get_personalized_content')

    async def test_get_personalized_content_returns_data(self, db_session, sample_user_id):
        """Test that get_personalized_content returns personalization data"""
        # GREEN: Should pass - method exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        content = await coordinator.get_personalized_content(sample_user_id)

        # Expected personalization structure
        assert 'welcome_message' in content
        assert 'quick_actions' in content
        assert 'suggested_workflows' in content
        assert 'recent_documents' in content
        assert 'productivity_insights' in content
        assert isinstance(content['quick_actions'], list)
        assert isinstance(content['recent_documents'], list)

    def test_calculate_performance_metrics_method_exists(self):
        """Test that calculate_performance_metrics method exists"""
        # GREEN: Should pass - method exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        assert hasattr(coordinator, 'calculate_performance_metrics')

    async def test_calculate_performance_metrics_returns_data(self, db_session, sample_user_id):
        """Test that calculate_performance_metrics returns performance data"""
        # GREEN: Should pass - method exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()
        metrics = await coordinator.calculate_performance_metrics(sample_user_id)

        # Expected performance metrics structure
        assert 'response_times' in metrics
        assert 'cache_hit_rates' in metrics
        assert 'data_freshness' in metrics
        assert 'service_health' in metrics
        assert isinstance(metrics['response_times'], dict)
        assert isinstance(metrics['cache_hit_rates'], dict)

    async def test_intro_page_data_coordination_works(self, db_session, sample_user_id):
        """Test that coordinator properly orchestrates all data sources"""
        # GREEN: Should pass - coordination logic exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)

        # Should have data from all major services
        assert result['user_statistics'] is not None
        assert result['system_overview'] is not None
        assert result['actionable_items'] is not None
        assert result['activity_feed'] is not None

        # Should have coordination metadata
        assert 'data_sources' in result
        assert 'coordination_time_ms' in result

    async def test_parallel_data_fetching_works(self, db_session, sample_user_id):
        """Test that coordinator fetches data in parallel for performance"""
        # GREEN: Should pass - parallel fetching exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        # Measure time for parallel vs sequential (should be much faster)
        import time
        start_time = time.time()
        result = await coordinator.get_intro_page_data(sample_user_id, parallel=True)
        parallel_time = (time.time() - start_time) * 1000

        # Should be faster than 500ms with parallel execution
        assert parallel_time < 500, f"Parallel execution took {parallel_time:.2f}ms, should be <500ms"
        assert result is not None

    async def test_error_handling_with_partial_failures(self, db_session, sample_user_id):
        """Test that coordinator handles partial service failures gracefully"""
        # GREEN: Should pass - partial failure handling exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        # Mock one service to fail
        with patch.object(coordinator, 'user_stats_service') as mock_user_stats:
            mock_user_stats.get_user_statistics = AsyncMock(side_effect=Exception("Service unavailable"))

            result = await coordinator.get_intro_page_data(sample_user_id)

            # Should still return data with error information
            assert result is not None
            assert 'service_errors' in result
            assert 'user_statistics' in result['service_errors']

            # Other services should still work
            assert result['system_overview'] is not None
            assert result['actionable_items'] is not None

    async def test_caching_coordination_works(self, db_session, sample_user_id):
        """Test that coordinator manages caching across services"""
        # GREEN: Should pass - caching coordination exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        # First call should populate caches
        result1 = await coordinator.get_intro_page_data(sample_user_id)

        # Second call should be faster due to caching
        import time
        start_time = time.time()
        result2 = await coordinator.get_intro_page_data(sample_user_id)
        cached_time = (time.time() - start_time) * 1000

        # Cached result should be very fast (<200ms)
        assert cached_time < 200, f"Cached coordination took {cached_time:.2f}ms, should be <200ms"
        assert result1['user_id'] == result2['user_id']

    async def test_personalization_engine_works(self, db_session, sample_user_id):
        """Test that personalization engine customizes content for user"""
        # GREEN: Should pass - personalization engine exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)
        personalization = result['personalization']

        # Should have personalized welcome message
        assert 'welcome_message' in personalization
        assert isinstance(personalization['welcome_message'], str)
        assert len(personalization['welcome_message']) > 0

        # Should have personalized quick actions
        assert 'quick_actions' in personalization
        assert len(personalization['quick_actions']) > 0

        # Should have productivity insights
        assert 'productivity_insights' in personalization
        assert isinstance(personalization['productivity_insights'], (list, dict))

    async def test_data_freshness_tracking(self, db_session, sample_user_id):
        """Test that coordinator tracks data freshness across services"""
        # GREEN: Should pass - freshness tracking exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)

        # Should have freshness information
        assert 'data_freshness' in result
        freshness = result['data_freshness']

        # Should track freshness for each service
        assert 'user_statistics' in freshness
        assert 'system_overview' in freshness
        assert 'actionable_items' in freshness
        assert 'activity_feed' in freshness

        # Each service should have timestamp
        for service, info in freshness.items():
            assert 'last_updated' in info
            assert 'age_seconds' in info

    async def test_service_health_monitoring(self, db_session, sample_user_id):
        """Test that coordinator monitors health of all services"""
        # GREEN: Should pass - health monitoring exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)
        health = result['performance_metrics']['service_health']

        # Should monitor all services
        assert 'user_statistics_service' in health
        assert 'system_stats_service' in health
        assert 'actionable_items_service' in health
        assert 'activity_feed_service' in health

        # Each service should have health status
        for service, status in health.items():
            assert 'status' in status
            assert 'response_time_ms' in status
            assert status['status'] in ['healthy', 'degraded', 'unhealthy']

    async def test_content_prioritization_works(self, db_session, sample_user_id):
        """Test that coordinator prioritizes content based on user context"""
        # GREEN: Should pass - content prioritization exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)

        # Should prioritize urgent items
        actionable_items = result['actionable_items']
        if actionable_items['urgent_items_count'] > 0:
            # Urgent items should be highlighted in personalization
            assert 'urgent_alerts' in result['personalization']

        # Should prioritize relevant activities
        activity_feed = result['activity_feed']
        if len(activity_feed['activities']) > 0:
            # Recent activities should influence quick actions
            assert len(result['personalization']['quick_actions']) > 0

    async def test_adaptive_layout_recommendations(self, db_session, sample_user_id):
        """Test that coordinator provides adaptive layout recommendations"""
        # GREEN: Should pass - adaptive layout exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)

        # Should have layout recommendations
        assert 'layout_recommendations' in result
        layout = result['layout_recommendations']

        # Should recommend widget priorities
        assert 'widget_priorities' in layout
        assert 'urgent_widgets' in layout
        assert 'hidden_widgets' in layout

        # Should be based on user's actual data
        if result['actionable_items']['urgent_items_count'] > 0:
            assert 'actionable_items' in layout['urgent_widgets']

    async def test_real_time_updates_coordination(self, db_session, sample_user_id):
        """Test that coordinator manages real-time update coordination"""
        # GREEN: Should pass - real-time coordination exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id, include_real_time=True)

        # Should have real-time update info
        assert 'real_time_updates' in result
        rt_updates = result['real_time_updates']

        # Should track which services support real-time
        assert 'supported_services' in rt_updates
        assert 'update_frequency_ms' in rt_updates
        assert 'last_sync' in rt_updates

    async def test_error_recovery_mechanisms(self, db_session, sample_user_id):
        """Test that coordinator has robust error recovery mechanisms"""
        # GREEN: Should pass - error recovery exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        # Test with multiple service failures
        with patch.object(coordinator, 'user_stats_service') as mock_user_stats, \
             patch.object(coordinator, 'activity_feed_service') as mock_activity:

            mock_user_stats.get_user_statistics = AsyncMock(side_effect=Exception("DB Error"))
            mock_activity.get_user_activity_feed = AsyncMock(side_effect=Exception("Network Error"))

            result = await coordinator.get_intro_page_data(sample_user_id)

            # Should still return usable data
            assert result is not None
            assert result['user_id'] == sample_user_id

            # Should track all errors
            assert 'service_errors' in result
            assert len(result['service_errors']) == 2

            # Should provide fallback data
            assert 'fallback_data' in result
            assert result['fallback_data'] is True

    async def test_performance_optimization_hints(self, db_session, sample_user_id):
        """Test that coordinator provides performance optimization hints"""
        # GREEN: Should pass - performance optimization exists
        from app.services.intro_page_coordinator import IntroPageCoordinator
        coordinator = IntroPageCoordinator()

        result = await coordinator.get_intro_page_data(sample_user_id)
        metrics = result['performance_metrics']

        # Should have optimization recommendations
        assert 'optimization_hints' in metrics
        hints = metrics['optimization_hints']

        # Should suggest caching strategies
        assert 'caching_recommendations' in hints
        assert 'service_optimizations' in hints
        assert 'query_optimizations' in hints

        # Should be actionable
        for hint in hints.values():
            if isinstance(hint, list):
                for item in hint:
                    assert 'action' in item
                    assert 'impact' in item