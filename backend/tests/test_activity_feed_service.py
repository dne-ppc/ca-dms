"""
Test suite for activity feed service - TDD Red Phase
Testing business logic for user activity feed aggregation and timeline management
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


class TestActivityFeedService:
    """Test activity feed service business logic"""

    def test_activity_feed_service_exists(self):
        """Test that ActivityFeedService class exists"""
        # GREEN: This should pass now as service exists
        from app.services.activity_feed_service import ActivityFeedService
        assert ActivityFeedService is not None

    def test_get_user_activity_feed_method_exists(self):
        """Test that get_user_activity_feed method exists"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        assert hasattr(service, 'get_user_activity_feed')

    async def test_get_user_activity_feed_returns_correct_structure(self, db_session, sample_user_id):
        """Test that get_user_activity_feed returns correct data structure"""
        # GREEN: Should pass - service and method exist
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        result = await service.get_user_activity_feed(sample_user_id)

        # Expected structure
        assert 'user_id' in result
        assert 'activities' in result
        assert 'total_count' in result
        assert 'has_more' in result
        assert 'last_updated' in result
        assert 'next_page_token' in result
        assert isinstance(result['activities'], list)

    async def test_get_user_activity_feed_performance(self, db_session, sample_user_id):
        """Test that get_user_activity_feed completes within performance target"""
        # GREEN: Should pass - service exists and performance is optimized
        import time
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        start_time = time.time()
        result = await service.get_user_activity_feed(sample_user_id, limit=20)
        response_time = (time.time() - start_time) * 1000

        # Target: <150ms for activity feed queries with pagination
        assert response_time < 150, f"Activity feed took {response_time:.2f}ms, target is <150ms"
        assert result is not None

    def test_get_document_activities_method_exists(self):
        """Test that get_document_activities method exists"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        assert hasattr(service, 'get_document_activities')

    async def test_get_document_activities_returns_data(self, db_session, sample_user_id):
        """Test that get_document_activities returns document activity items"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        activities = await service.get_document_activities(sample_user_id, limit=10)

        # Expected document activity structure
        assert isinstance(activities, list)
        # Activities may be empty for test user, which is valid
        if activities:  # If there's data
            assert 'activity_id' in activities[0]
            assert 'activity_type' in activities[0]
            assert 'document_id' in activities[0]
            assert 'document_title' in activities[0]
            assert 'user_id' in activities[0]
            assert 'timestamp' in activities[0]
            assert 'metadata' in activities[0]

    def test_get_workflow_activities_method_exists(self):
        """Test that get_workflow_activities method exists"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        assert hasattr(service, 'get_workflow_activities')

    async def test_get_workflow_activities_returns_data(self, db_session, sample_user_id):
        """Test that get_workflow_activities returns workflow activity items"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        activities = await service.get_workflow_activities(sample_user_id, limit=10)

        # Expected workflow activity structure
        assert isinstance(activities, list)
        # Activities may be empty for test user, which is valid
        if activities:  # If there's data
            assert 'activity_id' in activities[0]
            assert 'activity_type' in activities[0]
            assert 'workflow_instance_id' in activities[0]
            assert 'document_title' in activities[0]
            assert 'user_id' in activities[0]
            assert 'timestamp' in activities[0]
            assert 'step_name' in activities[0]

    def test_get_system_activities_method_exists(self):
        """Test that get_system_activities method exists"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        assert hasattr(service, 'get_system_activities')

    async def test_get_system_activities_returns_data(self, db_session, sample_user_id):
        """Test that get_system_activities returns system activity items"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        activities = await service.get_system_activities(sample_user_id, limit=5)

        # Expected system activity structure
        assert isinstance(activities, list)
        # Activities may be empty for test user, which is valid
        if activities:  # If there's data
            assert 'activity_id' in activities[0]
            assert 'activity_type' in activities[0]
            assert 'user_id' in activities[0]
            assert 'timestamp' in activities[0]
            assert 'description' in activities[0]

    def test_format_activity_item_method_exists(self):
        """Test that format_activity_item method exists"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()
        assert hasattr(service, 'format_activity_item')

    def test_format_activity_item_returns_formatted_data(self):
        """Test that format_activity_item returns properly formatted activity"""
        # GREEN: Should pass - method exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Mock activity data
        raw_activity = {
            'activity_type': 'document_created',
            'user_id': 'test-user',
            'timestamp': datetime.utcnow(),
            'document_title': 'Test Document',
            'metadata': {'test': 'data'}
        }

        formatted = service.format_activity_item(raw_activity)

        # Should have formatted structure
        assert 'activity_type' in formatted
        assert 'display_text' in formatted
        assert 'timestamp' in formatted
        assert 'user_id' in formatted
        assert 'icon' in formatted
        assert 'color' in formatted

    async def test_activity_pagination_works(self, db_session, sample_user_id):
        """Test that activity feed pagination works correctly"""
        # GREEN: Should pass - pagination exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Get first page
        page1 = await service.get_user_activity_feed(sample_user_id, limit=5)
        assert 'has_more' in page1
        assert 'next_page_token' in page1
        assert len(page1['activities']) <= 5

        # If there are more activities, test next page
        if page1['has_more'] and page1['next_page_token']:
            page2 = await service.get_user_activity_feed(
                sample_user_id, limit=5, page_token=page1['next_page_token']
            )
            assert isinstance(page2['activities'], list)
            assert len(page2['activities']) <= 5

    async def test_activity_filtering_by_type(self, db_session, sample_user_id):
        """Test that activity feed can be filtered by activity type"""
        # GREEN: Should pass - filtering exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Test document activities only
        doc_activities = await service.get_user_activity_feed(
            sample_user_id, activity_types=['document_created', 'document_updated'], limit=10
        )
        assert isinstance(doc_activities['activities'], list)

        # Test workflow activities only
        workflow_activities = await service.get_user_activity_feed(
            sample_user_id, activity_types=['workflow_started', 'workflow_completed'], limit=10
        )
        assert isinstance(workflow_activities['activities'], list)

    async def test_activity_date_range_filtering(self, db_session, sample_user_id):
        """Test that activity feed can be filtered by date range"""
        # GREEN: Should pass - date filtering exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Test last 7 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        recent_activities = await service.get_user_activity_feed(
            sample_user_id, start_date=start_date, end_date=end_date, limit=20
        )
        assert isinstance(recent_activities['activities'], list)
        assert 'total_count' in recent_activities

    async def test_activity_feed_caching_works(self, db_session, sample_user_id):
        """Test that activity feed caching works correctly"""
        # GREEN: Should pass - caching exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # First call should hit database
        result1 = await service.get_user_activity_feed(sample_user_id, limit=10)

        # Second call should hit cache (faster)
        import time
        start_time = time.time()
        result2 = await service.get_user_activity_feed(sample_user_id, limit=10)
        cache_time = (time.time() - start_time) * 1000

        # Cached result should be fast (<75ms for activity feed cache)
        assert cache_time < 75, f"Cached result took {cache_time:.2f}ms, should be <75ms"
        assert result1['user_id'] == result2['user_id']

    async def test_activity_aggregation_works(self, db_session, sample_user_id):
        """Test that similar activities are aggregated correctly"""
        # GREEN: Should pass - aggregation exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        result = await service.get_user_activity_feed(sample_user_id, aggregate_similar=True, limit=20)

        # Should have aggregated activities
        assert isinstance(result['activities'], list)

        # Check for aggregation markers
        for activity in result['activities']:
            if 'aggregated_count' in activity:
                assert isinstance(activity['aggregated_count'], int)
                assert activity['aggregated_count'] >= 1

    async def test_activity_privacy_filtering(self, db_session, sample_user_id):
        """Test that activity feed respects privacy and access controls"""
        # GREEN: Should pass - privacy filtering exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        result = await service.get_user_activity_feed(sample_user_id)

        # Should only return activities the user has access to
        assert result is not None
        assert result['user_id'] == sample_user_id

        # All activities should be accessible to the user
        for activity in result['activities']:
            # Privacy check - user should have access to this activity
            assert 'user_id' in activity
            assert activity.get('is_private', False) == False or activity['user_id'] == sample_user_id

    async def test_real_time_activity_updates(self, db_session, sample_user_id):
        """Test that activity feed includes recent real-time updates"""
        # GREEN: Should pass - real-time updates exist
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Get current timestamp for comparison
        current_time = datetime.utcnow()

        result = await service.get_user_activity_feed(sample_user_id, include_real_time=True)

        # Should have real-time timestamp
        assert 'last_updated' in result
        assert isinstance(result['last_updated'], str)

        # Should be very recent
        last_updated = datetime.fromisoformat(result['last_updated'].replace('Z', '+00:00').replace('+00:00', ''))
        time_diff = (current_time - last_updated).total_seconds()
        assert time_diff < 10  # Should be within 10 seconds

    async def test_error_handling_for_invalid_user(self, db_session):
        """Test that service handles invalid users gracefully"""
        # GREEN: Should pass - error handling exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        # Test with None user ID
        result = await service.get_user_activity_feed(None)

        # Should handle gracefully, not crash
        assert result is not None
        assert 'error' in result or result['activities'] == []

    async def test_empty_activity_feed_handling(self, db_session, sample_user_id):
        """Test that service handles users with no activities"""
        # GREEN: Should pass - empty feed handling exists
        from app.services.activity_feed_service import ActivityFeedService
        service = ActivityFeedService()

        result = await service.get_user_activity_feed(sample_user_id)

        # Should return valid structure even with no activities
        assert result is not None
        assert result['user_id'] == sample_user_id
        assert isinstance(result['activities'], list)
        assert result['total_count'] >= 0
        assert isinstance(result['has_more'], bool)
        assert 'last_updated' in result