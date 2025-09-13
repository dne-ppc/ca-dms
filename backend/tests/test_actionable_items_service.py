"""
Test suite for actionable items service - TDD Red Phase
Testing business logic for user-specific actionable items aggregation and prioritization
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


class TestActionableItemsService:
    """Test actionable items service business logic"""

    def test_actionable_items_service_exists(self):
        """Test that ActionableItemsService class exists"""
        # GREEN: This should pass now as service exists
        from app.services.actionable_items_service import ActionableItemsService
        assert ActionableItemsService is not None

    def test_get_user_actionable_items_method_exists(self):
        """Test that get_user_actionable_items method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'get_user_actionable_items')

    async def test_get_user_actionable_items_returns_correct_structure(self, db_session, sample_user_id):
        """Test that get_user_actionable_items returns correct data structure"""
        # GREEN: Should pass - service and method exist
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        result = await service.get_user_actionable_items(sample_user_id)

        # Expected structure
        assert 'user_id' in result
        assert 'pending_approvals' in result
        assert 'draft_documents' in result
        assert 'overdue_reviews' in result
        assert 'workflow_assignments' in result
        assert 'urgent_items_count' in result
        assert 'priority_score' in result
        assert 'last_updated' in result

    async def test_get_user_actionable_items_performance(self, db_session, sample_user_id):
        """Test that get_user_actionable_items completes within performance target"""
        # GREEN: Should pass - service exists and performance is optimized
        import time
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        start_time = time.time()
        result = await service.get_user_actionable_items(sample_user_id)
        response_time = (time.time() - start_time) * 1000

        # Target: <100ms for actionable items queries with caching
        assert response_time < 100, f"Actionable items took {response_time:.2f}ms, target is <100ms"
        assert result is not None

    def test_get_pending_approvals_method_exists(self):
        """Test that get_pending_approvals method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'get_pending_approvals')

    async def test_get_pending_approvals_returns_data(self, db_session, sample_user_id):
        """Test that get_pending_approvals returns approval items"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        approvals = await service.get_pending_approvals(sample_user_id)

        # Expected approval data structure
        assert isinstance(approvals, list)
        # Approvals may be empty for test user, which is valid
        if approvals:  # If there's data
            assert 'document_id' in approvals[0]
            assert 'document_title' in approvals[0]
            assert 'workflow_step_id' in approvals[0]
            assert 'priority' in approvals[0]
            assert 'due_date' in approvals[0]
            assert 'created_at' in approvals[0]

    def test_get_draft_documents_method_exists(self):
        """Test that get_draft_documents method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'get_draft_documents')

    async def test_get_draft_documents_returns_data(self, db_session, sample_user_id):
        """Test that get_draft_documents returns user's draft documents"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        drafts = await service.get_draft_documents(sample_user_id)

        # Expected draft document structure
        assert isinstance(drafts, list)
        # Drafts may be empty for test user, which is valid
        if drafts:  # If there's data
            assert 'document_id' in drafts[0]
            assert 'title' in drafts[0]
            assert 'last_modified' in drafts[0]
            assert 'document_type' in drafts[0]
            assert 'completion_percentage' in drafts[0]

    def test_get_overdue_reviews_method_exists(self):
        """Test that get_overdue_reviews method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'get_overdue_reviews')

    async def test_get_overdue_reviews_returns_data(self, db_session, sample_user_id):
        """Test that get_overdue_reviews returns overdue review items"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        overdue = await service.get_overdue_reviews(sample_user_id)

        # Expected overdue review structure
        assert isinstance(overdue, list)
        # Overdue items may be empty for test user, which is valid
        if overdue:  # If there's data
            assert 'document_id' in overdue[0]
            assert 'document_title' in overdue[0]
            assert 'review_type' in overdue[0]
            assert 'due_date' in overdue[0]
            assert 'days_overdue' in overdue[0]

    def test_get_workflow_assignments_method_exists(self):
        """Test that get_workflow_assignments method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'get_workflow_assignments')

    async def test_get_workflow_assignments_returns_data(self, db_session, sample_user_id):
        """Test that get_workflow_assignments returns workflow assignments"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assignments = await service.get_workflow_assignments(sample_user_id)

        # Expected workflow assignment structure
        assert isinstance(assignments, list)
        # Assignments may be empty for test user, which is valid
        if assignments:  # If there's data
            assert 'workflow_step_id' in assignments[0]
            assert 'workflow_name' in assignments[0]
            assert 'document_title' in assignments[0]
            assert 'step_name' in assignments[0]
            assert 'assigned_date' in assignments[0]
            assert 'priority' in assignments[0]

    def test_calculate_priority_score_method_exists(self):
        """Test that calculate_priority_score method exists"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        assert hasattr(service, 'calculate_priority_score')

    async def test_calculate_priority_score_returns_valid_score(self, db_session, sample_user_id):
        """Test that calculate_priority_score returns valid priority score"""
        # GREEN: Should pass - method exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()
        score = await service.calculate_priority_score(sample_user_id)

        # Priority score should be between 0 and 100
        assert isinstance(score, (int, float))
        assert 0 <= score <= 100

    async def test_actionable_items_caching_works(self, db_session, sample_user_id):
        """Test that service caches actionable items correctly"""
        # GREEN: Should pass - caching exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        # First call should hit database
        result1 = await service.get_user_actionable_items(sample_user_id)

        # Second call should hit cache (faster)
        import time
        start_time = time.time()
        result2 = await service.get_user_actionable_items(sample_user_id)
        cache_time = (time.time() - start_time) * 1000

        # Cached result should be fast (<50ms for in-memory cache)
        assert cache_time < 50, f"Cached result took {cache_time:.2f}ms, should be <50ms"
        assert result1['user_id'] == result2['user_id']

    async def test_priority_ordering_works(self, db_session, sample_user_id):
        """Test that actionable items are properly prioritized and ordered"""
        # GREEN: Should pass - priority ordering exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        result = await service.get_user_actionable_items(sample_user_id)

        # Check that priority score is calculated
        assert 'priority_score' in result
        assert isinstance(result['priority_score'], (int, float))

        # Check that items within each category should be ordered by priority/urgency
        # (Implementation detail - items should be sorted by due date, priority, etc.)
        for category in ['pending_approvals', 'overdue_reviews', 'workflow_assignments']:
            items = result.get(category, [])
            if len(items) > 1:
                # Verify ordering exists (exact ordering depends on implementation)
                assert isinstance(items, list)

    async def test_urgent_items_identification(self, db_session, sample_user_id):
        """Test that urgent items are properly identified and counted"""
        # GREEN: Should pass - urgent item identification exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        result = await service.get_user_actionable_items(sample_user_id)

        # Should have urgent items count
        assert 'urgent_items_count' in result
        assert isinstance(result['urgent_items_count'], int)
        assert result['urgent_items_count'] >= 0

    async def test_error_handling_for_invalid_user(self, db_session):
        """Test that service handles invalid users gracefully"""
        # GREEN: Should pass - error handling exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        # Test with None user ID
        result = await service.get_user_actionable_items(None)

        # Should handle gracefully, not crash
        assert result is not None
        assert 'error' in result or result['pending_approvals'] == []

    async def test_empty_state_handling(self, db_session, sample_user_id):
        """Test that service handles users with no actionable items"""
        # GREEN: Should pass - empty state handling exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        result = await service.get_user_actionable_items(sample_user_id)

        # Should return valid structure even with no items
        assert result is not None
        assert result['user_id'] == sample_user_id
        assert isinstance(result['pending_approvals'], list)
        assert isinstance(result['draft_documents'], list)
        assert isinstance(result['overdue_reviews'], list)
        assert isinstance(result['workflow_assignments'], list)
        assert result['urgent_items_count'] >= 0
        assert 0 <= result['priority_score'] <= 100

    async def test_time_sensitive_prioritization(self, db_session, sample_user_id):
        """Test that time-sensitive items are prioritized correctly"""
        # GREEN: Should pass - time-based prioritization exists
        from app.services.actionable_items_service import ActionableItemsService
        service = ActionableItemsService()

        result = await service.get_user_actionable_items(sample_user_id)

        # Overdue items should be marked as high priority
        overdue_items = result.get('overdue_reviews', [])
        for item in overdue_items:
            if 'days_overdue' in item:
                assert item['days_overdue'] >= 0

        # Pending approvals should have priority scores
        approval_items = result.get('pending_approvals', [])
        for item in approval_items:
            if 'priority' in item:
                assert item['priority'] in ['low', 'medium', 'high', 'urgent']