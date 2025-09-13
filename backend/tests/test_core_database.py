"""
Comprehensive tests for core database functionality
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db, init_db
from app.core.config import settings


class TestDatabaseCore:
    """Tests for core database functionality"""

    def test_get_engine_default(self):
        """Test getting database engine with default settings"""
        with patch('app.core.database.create_engine') as mock_create_engine:
            mock_engine = Mock()
            mock_create_engine.return_value = mock_engine

            engine = get_engine()

            assert engine == mock_engine
            mock_create_engine.assert_called_once()

    def test_get_engine_custom_url(self):
        """Test getting database engine with custom URL"""
        with patch('app.core.database.create_engine') as mock_create_engine:
            mock_engine = Mock()
            mock_create_engine.return_value = mock_engine

            custom_url = "postgresql://test:test@localhost/test_db"
            engine = get_engine(custom_url)

            assert engine == mock_engine
            mock_create_engine.assert_called_once_with(
                custom_url,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=3600
            )

    def test_get_session_factory(self):
        """Test getting session factory"""
        with patch('app.core.database.sessionmaker') as mock_sessionmaker:
            mock_engine = Mock()
            mock_factory = Mock()
            mock_sessionmaker.return_value = mock_factory

            factory = get_session_factory(mock_engine)

            assert factory == mock_factory
            mock_sessionmaker.assert_called_once_with(
                autocommit=False,
                autoflush=False,
                bind=mock_engine
            )

    def test_get_db_session_lifecycle(self):
        """Test database session lifecycle"""
        with patch('app.core.database.SessionLocal') as mock_session_local:
            mock_session = Mock()
            mock_session_local.return_value = mock_session

            # Test session creation and cleanup
            db_gen = get_db()
            db_session = next(db_gen)

            assert db_session == mock_session

            # Test cleanup on normal completion
            try:
                next(db_gen)
            except StopIteration:
                pass

            mock_session.close.assert_called_once()

    def test_get_db_session_exception_handling(self):
        """Test database session exception handling"""
        with patch('app.core.database.SessionLocal') as mock_session_local:
            mock_session = Mock()
            mock_session_local.return_value = mock_session

            # Test session cleanup on exception
            db_gen = get_db()
            db_session = next(db_gen)

            try:
                db_gen.throw(Exception("Test exception"))
            except Exception:
                pass

            mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_init_db(self):
        """Test database initialization"""
        with patch('app.core.database.get_engine') as mock_get_engine, \
             patch('app.core.database.Base') as mock_base:

            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine

            await init_db()

            mock_get_engine.assert_called_once()
            mock_base.metadata.create_all.assert_called_once_with(bind=mock_engine)

    @pytest.mark.asyncio
    async def test_check_connection_success(self):
        """Test successful database connection check"""
        with patch('app.core.database.get_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_connection = Mock()
            mock_result = Mock()

            mock_engine.connect.return_value.__enter__.return_value = mock_connection
            mock_connection.execute.return_value.scalar.return_value = 1
            mock_get_engine.return_value = mock_engine

            result = await check_connection()

            assert result is True
            mock_connection.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_connection_failure(self):
        """Test failed database connection check"""
        with patch('app.core.database.get_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_engine.connect.side_effect = Exception("Connection failed")
            mock_get_engine.return_value = mock_engine

            result = await check_connection()

            assert result is False

    @pytest.mark.asyncio
    async def test_get_db_health_healthy(self):
        """Test database health check when healthy"""
        with patch('app.core.database.check_connection') as mock_check, \
             patch('app.core.database.get_engine') as mock_get_engine:

            mock_check.return_value = True
            mock_engine = Mock()
            mock_connection = Mock()
            mock_result = Mock()

            # Mock active connections query
            mock_connection.execute.return_value.scalar.return_value = 5
            mock_engine.connect.return_value.__enter__.return_value = mock_connection
            mock_get_engine.return_value = mock_engine

            health = await get_db_health()

            assert health["status"] == "healthy"
            assert health["connection_active"] is True
            assert health["active_connections"] == 5
            assert "response_time_ms" in health
            assert health["response_time_ms"] >= 0

    @pytest.mark.asyncio
    async def test_get_db_health_unhealthy(self):
        """Test database health check when unhealthy"""
        with patch('app.core.database.check_connection') as mock_check:
            mock_check.return_value = False

            health = await get_db_health()

            assert health["status"] == "unhealthy"
            assert health["connection_active"] is False
            assert health["active_connections"] == 0
            assert "error" in health

    def test_base_metadata(self):
        """Test Base metadata configuration"""
        # Verify Base is properly configured
        assert hasattr(Base, 'metadata')
        assert hasattr(Base, 'registry')

    def test_database_url_configuration(self):
        """Test database URL configuration"""
        # Test that settings are properly used
        with patch('app.core.database.settings') as mock_settings:
            mock_settings.DATABASE_URL = "postgresql://test"

            with patch('app.core.database.create_engine') as mock_create:
                get_engine()
                mock_create.assert_called_once()


class TestDatabaseIntegration:
    """Integration tests for database functionality"""

    @pytest.fixture
    def in_memory_engine(self):
        """Create in-memory SQLite engine for testing"""
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        return engine

    @pytest.fixture
    def session_factory(self, in_memory_engine):
        """Create session factory for testing"""
        return sessionmaker(bind=in_memory_engine)

    def test_session_creation_and_cleanup(self, session_factory):
        """Test actual session creation and cleanup"""
        session = session_factory()

        # Test basic query
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1

        session.close()

    def test_transaction_rollback(self, session_factory):
        """Test transaction rollback behavior"""
        session = session_factory()

        try:
            # Start transaction
            session.begin()

            # Simulate some work
            session.execute(text("SELECT 1"))

            # Force rollback
            session.rollback()

        finally:
            session.close()

    def test_connection_pooling(self, in_memory_engine):
        """Test connection pooling behavior"""
        # Test multiple connections
        connections = []

        for i in range(3):
            conn = in_memory_engine.connect()
            result = conn.execute(text("SELECT 1")).scalar()
            assert result == 1
            connections.append(conn)

        # Close all connections
        for conn in connections:
            conn.close()

    @pytest.mark.asyncio
    async def test_concurrent_sessions(self, session_factory):
        """Test concurrent session handling"""
        import asyncio

        async def create_session_and_query():
            session = session_factory()
            try:
                result = session.execute(text("SELECT 1")).scalar()
                return result
            finally:
                session.close()

        # Run multiple concurrent sessions
        tasks = [create_session_and_query() for _ in range(5)]
        results = await asyncio.gather(*tasks)

        assert all(result == 1 for result in results)


class TestDatabaseErrors:
    """Tests for database error handling"""

    def test_connection_error_handling(self):
        """Test handling of connection errors"""
        with patch('app.core.database.create_engine') as mock_create:
            mock_create.side_effect = Exception("Database unavailable")

            with pytest.raises(Exception):
                get_engine()

    @pytest.mark.asyncio
    async def test_health_check_timeout_handling(self):
        """Test handling of health check timeouts"""
        with patch('app.core.database.get_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_engine.connect.side_effect = TimeoutError("Connection timeout")
            mock_get_engine.return_value = mock_engine

            health = await get_db_health()

            assert health["status"] == "unhealthy"
            assert "timeout" in health.get("error", "").lower()

    def test_session_error_recovery(self):
        """Test session error recovery"""
        with patch('app.core.database.SessionLocal') as mock_session_local:
            mock_session = Mock()
            mock_session.execute.side_effect = Exception("Query failed")
            mock_session_local.return_value = mock_session

            db_gen = get_db()
            db_session = next(db_gen)

            # Session should still be returned even if it will fail later
            assert db_session == mock_session

            # Cleanup should still work
            try:
                next(db_gen)
            except StopIteration:
                pass

            mock_session.close.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])