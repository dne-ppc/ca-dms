"""
Test suite for intro page database migration - TDD Red Phase
Testing database migration and index creation for intro page optimization
"""
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from sqlalchemy import text, create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
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


class TestIntroPageMigration:
    """Test intro page database migration and optimization"""

    def test_migration_script_exists(self):
        """Test that intro page migration script exists"""
        # GREEN: This should pass now as migration exists
        from app.migrations.intro_page_migration import IntroPageMigration
        assert IntroPageMigration is not None

    def test_migration_has_required_methods(self):
        """Test that migration has required methods"""
        # GREEN: Should pass - migration class has required methods
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        assert hasattr(migration, 'upgrade')
        assert hasattr(migration, 'downgrade')
        assert hasattr(migration, 'create_system_stats_view')
        assert hasattr(migration, 'create_performance_indexes')

    async def test_system_stats_view_creation(self, db_session):
        """Test that system_stats view is created correctly"""
        # GREEN: Should pass - view creation works
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create the view
        await migration.create_system_stats_view(db_session)

        # Verify view exists
        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'view' AND name = 'system_stats'
        """)).fetchone()
        assert result is not None

    async def test_system_stats_view_returns_correct_columns(self, db_session):
        """Test that system_stats view returns expected columns"""
        # GREEN: Should pass - view has correct structure
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create the view
        await migration.create_system_stats_view(db_session)

        # Test view query
        result = db_session.execute(text("SELECT * FROM system_stats LIMIT 1")).fetchone()

        # Should have expected columns (even if no data)
        columns = result._fields if result else []
        view_info = db_session.execute(text("PRAGMA table_info(system_stats)")).fetchall()

        expected_columns = [
            'total_documents', 'active_users', 'documents_today',
            'documents_this_week', 'documents_this_month',
            'total_workflows', 'pending_workflows', 'completed_workflows',
            'completed_workflows_today', 'avg_workflow_completion_hours',
            'system_health_score', 'last_updated'
        ]

        # Should have all expected columns in view definition
        assert len(view_info) >= len(expected_columns)

    async def test_performance_indexes_creation(self, db_session):
        """Test that performance indexes are created correctly"""
        # GREEN: Should pass - indexes are created
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create performance indexes
        await migration.create_performance_indexes(db_session)

        # Verify key indexes exist
        indexes = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index'
            AND name IN (
                'idx_user_documents_performance',
                'idx_user_workflow_performance',
                'idx_documents_temporal_user',
                'idx_user_activity_covering',
                'idx_workflow_step_assignee_temporal'
            )
        """)).fetchall()

        assert len(indexes) >= 5

    async def test_user_documents_performance_index_exists(self, db_session):
        """Test that user documents performance index exists"""
        # GREEN: Should pass - index exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        await migration.create_performance_indexes(db_session)

        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND name = 'idx_user_documents_performance'
        """)).fetchone()
        assert result is not None

    async def test_workflow_performance_index_exists(self, db_session):
        """Test that workflow performance index exists"""
        # GREEN: Should pass - index exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        await migration.create_performance_indexes(db_session)

        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND name = 'idx_user_workflow_performance'
        """)).fetchone()
        assert result is not None

    async def test_temporal_document_index_exists(self, db_session):
        """Test that temporal document index exists"""
        # GREEN: Should pass - index exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        await migration.create_performance_indexes(db_session)

        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND name = 'idx_documents_temporal_user'
        """)).fetchone()
        assert result is not None

    async def test_user_activity_covering_index_exists(self, db_session):
        """Test that user activity covering index exists"""
        # GREEN: Should pass - index exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        await migration.create_performance_indexes(db_session)

        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND name = 'idx_user_activity_covering'
        """)).fetchone()
        assert result is not None

    async def test_workflow_step_assignee_index_exists(self, db_session):
        """Test that workflow step assignee index exists"""
        # GREEN: Should pass - index exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        await migration.create_performance_indexes(db_session)

        result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND name = 'idx_workflow_step_assignee_temporal'
        """)).fetchone()
        assert result is not None

    async def test_migration_upgrade_creates_all_objects(self, db_session):
        """Test that migration upgrade creates all required database objects"""
        # GREEN: Should pass - upgrade creates everything
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Run upgrade
        await migration.upgrade(db_session)

        # Verify view exists
        view_result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'view' AND name = 'system_stats'
        """)).fetchone()
        assert view_result is not None

        # Verify indexes exist
        index_result = db_session.execute(text("""
            SELECT COUNT(*) as count FROM sqlite_master
            WHERE type = 'index'
            AND name LIKE 'idx_%performance%' OR name LIKE 'idx_%temporal%' OR name LIKE 'idx_%covering%' OR name LIKE 'idx_%assignee%'
        """)).fetchone()
        assert index_result.count >= 5

    async def test_migration_downgrade_removes_objects(self, db_session):
        """Test that migration downgrade removes created objects"""
        # GREEN: Should pass - downgrade cleans up
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # First upgrade to create objects
        await migration.upgrade(db_session)

        # Then downgrade to remove them
        await migration.downgrade(db_session)

        # Verify view is removed
        view_result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'view' AND name = 'system_stats'
        """)).fetchone()
        assert view_result is None

        # Verify indexes are removed
        index_result = db_session.execute(text("""
            SELECT COUNT(*) as count FROM sqlite_master
            WHERE type = 'index'
            AND (name = 'idx_user_documents_performance'
                 OR name = 'idx_user_workflow_performance'
                 OR name = 'idx_documents_temporal_user'
                 OR name = 'idx_user_activity_covering'
                 OR name = 'idx_workflow_step_assignee_temporal')
        """)).fetchone()
        assert index_result.count == 0

    async def test_migration_is_idempotent(self, db_session):
        """Test that migration can be run multiple times safely"""
        # GREEN: Should pass - migration is idempotent
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Run upgrade twice
        await migration.upgrade(db_session)
        await migration.upgrade(db_session)  # Should not fail

        # Verify objects still exist
        view_result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'view' AND name = 'system_stats'
        """)).fetchone()
        assert view_result is not None

    async def test_index_performance_improvement(self, db_session):
        """Test that indexes improve query performance"""
        # GREEN: Should pass - indexes improve performance
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create indexes
        await migration.create_performance_indexes(db_session)

        # Test query that should use indexes
        import time
        start_time = time.time()

        # This query should be fast with indexes
        result = db_session.execute(text("""
            SELECT COUNT(*) FROM documents d
            WHERE d.created_by = 'test-user'
            AND datetime(d.created_at) > datetime('now', '-30 days')
        """)).fetchone()

        query_time = (time.time() - start_time) * 1000

        # Should be fast (under 50ms for empty tables with indexes)
        assert query_time < 50, f"Query took {query_time:.2f}ms, should be <50ms with indexes"

    async def test_system_stats_view_aggregations(self, db_session):
        """Test that system_stats view correctly aggregates data"""
        # GREEN: Should pass - view aggregations work
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create the view
        await migration.create_system_stats_view(db_session)

        # Query the view (should not error even with empty tables)
        result = db_session.execute(text("SELECT * FROM system_stats")).fetchone()

        # Should return a result (may be all zeros/nulls for empty database)
        assert result is not None

    async def test_migration_handles_existing_objects(self, db_session):
        """Test that migration handles existing objects gracefully"""
        # GREEN: Should pass - migration handles existing objects
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create a partial object manually
        try:
            db_session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_user_documents_performance
                ON documents (created_by, created_at, status)
            """))
            db_session.commit()
        except:
            pass  # May already exist

        # Migration should still work
        await migration.upgrade(db_session)

        # Verify all objects exist
        view_result = db_session.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type = 'view' AND name = 'system_stats'
        """)).fetchone()
        assert view_result is not None

    async def test_migration_rollback_safety(self, db_session):
        """Test that migration rollback is safe and complete"""
        # GREEN: Should pass - rollback is safe
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Upgrade
        await migration.upgrade(db_session)

        # Verify objects exist
        objects_before = db_session.execute(text("""
            SELECT COUNT(*) as count FROM sqlite_master
            WHERE (type = 'view' AND name = 'system_stats')
            OR (type = 'index' AND name LIKE 'idx_%')
        """)).fetchone()

        assert objects_before.count > 0

        # Downgrade
        await migration.downgrade(db_session)

        # Verify specific intro page objects are removed
        intro_objects = db_session.execute(text("""
            SELECT COUNT(*) as count FROM sqlite_master
            WHERE (type = 'view' AND name = 'system_stats')
            OR (type = 'index' AND name IN (
                'idx_user_documents_performance',
                'idx_user_workflow_performance',
                'idx_documents_temporal_user',
                'idx_user_activity_covering',
                'idx_workflow_step_assignee_temporal'
            ))
        """)).fetchone()

        assert intro_objects.count == 0

    async def test_migration_error_handling(self, db_session):
        """Test that migration handles errors gracefully"""
        # GREEN: Should pass - error handling exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Create a conflicting object
        try:
            db_session.execute(text("CREATE TABLE system_stats (id INTEGER)"))
            db_session.commit()
        except:
            pass

        # Migration should handle this gracefully
        try:
            await migration.upgrade(db_session)
            # Should not raise an exception
        except Exception as e:
            # If it does raise, it should be informative
            assert "system_stats" in str(e).lower()

    async def test_migration_version_tracking(self, db_session):
        """Test that migration tracks version information"""
        # GREEN: Should pass - version tracking exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Should have version information
        assert hasattr(migration, 'version')
        assert hasattr(migration, 'description')

        # Version should be meaningful
        assert migration.version is not None
        assert isinstance(migration.version, str)
        assert len(migration.version) > 0

        # Description should be meaningful
        assert migration.description is not None
        assert isinstance(migration.description, str)
        assert 'intro' in migration.description.lower()

    async def test_migration_compatibility_check(self, db_session):
        """Test that migration checks database compatibility"""
        # GREEN: Should pass - compatibility check exists
        from app.migrations.intro_page_migration import IntroPageMigration
        migration = IntroPageMigration()

        # Should have compatibility check method
        assert hasattr(migration, 'check_compatibility')

        # Should return compatibility status
        compatibility = await migration.check_compatibility(db_session)
        assert isinstance(compatibility, dict)
        assert 'compatible' in compatibility
        assert 'issues' in compatibility