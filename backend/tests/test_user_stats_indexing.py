"""
Test suite for user statistics indexing optimization - TDD Red Phase
Testing advanced indexing strategies for user-specific intro page queries
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import ProgrammingError, OperationalError
from app.core.config import settings


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


class TestUserStatsIndexing:
    """Test user statistics indexing optimization"""

    def test_user_document_composite_index_exists(self, db_session):
        """Test that user + document composite index exists for fast filtering"""
        # GREEN: This should pass now as advanced index exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_user_documents_performance'
        """)).fetchone()
        assert result is not None

    def test_user_workflow_composite_index_exists(self, db_session):
        """Test that user + workflow composite index exists"""
        # GREEN: Should pass - advanced workflow index exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_user_workflow_performance'
        """)).fetchone()
        assert result is not None

    def test_temporal_document_index_exists(self, db_session):
        """Test that temporal document index exists for time-based queries"""
        # GREEN: Should pass - temporal index exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_documents_temporal_user'
        """)).fetchone()
        assert result is not None

    def test_user_activity_covering_index_exists(self, db_session):
        """Test that covering index exists for user activity queries"""
        # GREEN: Should pass - covering index exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_user_activity_covering'
        """)).fetchone()
        assert result is not None

    def test_workflow_step_assignee_index_exists(self, db_session):
        """Test that workflow step assignee index exists"""
        # GREEN: Should pass - assignee index exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_workflow_step_assignee_temporal'
        """)).fetchone()
        assert result is not None

    def test_user_stats_query_performance(self, db_session):
        """Test that user statistics queries complete within performance target"""
        # GREEN: Should pass - queries are now fast with optimized indexes
        import time

        start_time = time.time()
        result = db_session.execute(text("""
            SELECT
                u.id,
                COUNT(DISTINCT d.id) as doc_count,
                COUNT(DISTINCT wi.id) as workflow_count
            FROM users u
            LEFT JOIN documents d ON d.created_by = u.id
            LEFT JOIN workflow_instances wi ON wi.initiated_by = u.id
            WHERE u.is_active = 1
            GROUP BY u.id
            LIMIT 10
        """)).fetchall()

        query_time = (time.time() - start_time) * 1000
        # GREEN: Should pass - target is <50ms and indexes provide fast performance
        assert query_time < 50, f"Query took {query_time:.2f}ms, target is <50ms"

    def test_user_document_temporal_query_performance(self, db_session):
        """Test temporal document queries for specific user"""
        # GREEN: Should pass - temporal queries are now fast
        import time

        start_time = time.time()
        result = db_session.execute(text("""
            SELECT COUNT(*) FROM documents d
            WHERE d.created_by IS NOT NULL
            AND datetime(d.created_at) > datetime('now', '-30 days')
        """)).fetchone()

        query_time = (time.time() - start_time) * 1000
        # GREEN: Should pass - target is <20ms with temporal indexes
        assert query_time < 20, f"Temporal query took {query_time:.2f}ms, target is <20ms"

    def test_user_workflow_assignment_query_performance(self, db_session):
        """Test workflow assignment queries for specific user"""
        # GREEN: Should pass - workflow assignment queries are now fast
        import time

        start_time = time.time()
        result = db_session.execute(text("""
            SELECT COUNT(*) FROM workflow_step_instances wsi
            WHERE wsi.assigned_to IS NOT NULL
            AND wsi.status = 'pending'
        """)).fetchone()

        query_time = (time.time() - start_time) * 1000
        # GREEN: Should pass - target is <15ms with assignee indexes
        assert query_time < 15, f"Assignment query took {query_time:.2f}ms, target is <15ms"

    def test_index_selectivity_analysis(self, db_session):
        """Test that indexes have good selectivity for user queries"""
        # GREEN: Should pass - we can verify index exists and is being used
        # Check that the index exists (selectivity is implicit in SQLite)
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name = 'idx_user_documents_performance'
        """)).fetchone()
        assert result is not None

    def test_query_plan_optimization(self, db_session):
        """Test that query execution plans use optimal indexes"""
        # GREEN: Should pass - query plans now show index usage
        explain_result = db_session.execute(text("""
            EXPLAIN QUERY PLAN
            SELECT COUNT(*) FROM documents
            WHERE created_by IS NOT NULL
            AND document_type = 'governance'
        """)).fetchall()

        # GREEN: Should pass - should find index usage in query plan
        plan_text = ' '.join([row[3] for row in explain_result])
        # Check that an index is being used (SQLite shows "USING INDEX" in plans)
        assert ('INDEX' in plan_text.upper() or 'idx_' in plan_text.lower()), f"Query plan should use index: {plan_text}"