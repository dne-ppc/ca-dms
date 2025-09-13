"""
Enhanced database service with sharding support for horizontal scaling
"""
from typing import Generator, Optional, Dict, Any, List
from contextlib import contextmanager
from sqlalchemy import create_engine, Engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.core.sharding import get_shard_manager, ShardAwareSession
import logging
import time

logger = logging.getLogger(__name__)


class ShardedDatabaseService:
    """Database service with built-in sharding support"""

    def __init__(self):
        self.shard_manager = get_shard_manager()
        self._connection_pools: Dict[str, sessionmaker] = {}

    def get_document_session(self, document_id: str) -> Session:
        """Get database session for a specific document"""
        return ShardAwareSession(document_id, "document").__enter__()

    def get_user_session(self, user_id: str) -> Session:
        """Get database session for a specific user"""
        return ShardAwareSession(user_id, "user").__enter__()

    @contextmanager
    def get_document_db(self, document_id: str) -> Generator[Session, None, None]:
        """Context manager for document database operations"""
        with ShardAwareSession(document_id, "document") as session:
            yield session

    @contextmanager
    def get_user_db(self, user_id: str) -> Generator[Session, None, None]:
        """Context manager for user database operations"""
        with ShardAwareSession(user_id, "user") as session:
            yield session

    def execute_cross_shard_query(self, query_func, *args, **kwargs) -> Dict[str, Any]:
        """Execute a query across all shards and aggregate results"""
        return self.shard_manager.execute_on_all_shards(query_func, *args, **kwargs)

    def get_shard_statistics(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all shards"""
        stats = {}

        def collect_stats(session: Session, shard_id: str) -> Dict[str, Any]:
            try:
                # Get document count
                doc_count = session.execute(text("SELECT COUNT(*) FROM documents")).scalar()

                # Get user count
                user_count = session.execute(text("SELECT COUNT(*) FROM users")).scalar()

                # Get database size
                db_size = session.execute(text("""
                    SELECT pg_size_pretty(pg_database_size(current_database()))
                """)).scalar()

                # Get table sizes
                table_sizes = session.execute(text("""
                    SELECT
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
                    FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """)).fetchall()

                return {
                    "document_count": doc_count,
                    "user_count": user_count,
                    "database_size": db_size,
                    "table_sizes": [{"table": row[1], "size": row[2]} for row in table_sizes],
                    "shard_id": shard_id
                }
            except Exception as e:
                logger.error(f"Error collecting stats for shard {shard_id}: {e}")
                return {"error": str(e), "shard_id": shard_id}

        for shard_id in self.shard_manager.get_all_shards():
            session = self.shard_manager.get_session(shard_id)
            try:
                stats[shard_id] = collect_stats(session, shard_id)
            finally:
                session.close()

        return stats

    def check_shard_health(self) -> Dict[str, Dict[str, Any]]:
        """Check health status of all shards"""
        health_stats = {}

        for shard_id in self.shard_manager.get_all_shards():
            session = self.shard_manager.get_session(shard_id)
            start_time = time.time()

            try:
                # Simple connectivity test
                session.execute(text("SELECT 1")).scalar()
                response_time = time.time() - start_time

                # Check for long-running queries
                long_queries = session.execute(text("""
                    SELECT count(*)
                    FROM pg_stat_activity
                    WHERE state = 'active'
                    AND query_start < now() - interval '30 seconds'
                    AND query NOT LIKE '%pg_stat_activity%'
                """)).scalar()

                # Check connection count
                connection_count = session.execute(text("""
                    SELECT count(*) FROM pg_stat_activity
                """)).scalar()

                health_stats[shard_id] = {
                    "status": "healthy",
                    "response_time_ms": round(response_time * 1000, 2),
                    "long_running_queries": long_queries,
                    "active_connections": connection_count,
                    "timestamp": time.time()
                }

            except Exception as e:
                health_stats[shard_id] = {
                    "status": "unhealthy",
                    "error": str(e),
                    "timestamp": time.time()
                }
            finally:
                session.close()

        return health_stats

    def rebalance_check(self) -> Dict[str, Any]:
        """Check if shards need rebalancing"""
        stats = self.get_shard_statistics()

        if not stats:
            return {"needs_rebalancing": False, "reason": "No shard statistics available"}

        # Calculate document distribution
        doc_counts = [s.get("document_count", 0) for s in stats.values() if "error" not in s]

        if not doc_counts:
            return {"needs_rebalancing": False, "reason": "No valid document counts"}

        avg_docs = sum(doc_counts) / len(doc_counts)
        max_docs = max(doc_counts)
        min_docs = min(doc_counts)

        # Check if imbalance exceeds threshold (30% deviation from average)
        imbalance_threshold = 0.3
        max_deviation = max(abs(max_docs - avg_docs), abs(avg_docs - min_docs)) / avg_docs if avg_docs > 0 else 0

        needs_rebalancing = max_deviation > imbalance_threshold

        return {
            "needs_rebalancing": needs_rebalancing,
            "average_documents": avg_docs,
            "max_documents": max_docs,
            "min_documents": min_docs,
            "imbalance_ratio": max_deviation,
            "threshold": imbalance_threshold,
            "shard_distribution": {
                shard_id: stats[shard_id].get("document_count", 0)
                for shard_id in stats.keys()
                if "error" not in stats[shard_id]
            }
        }


# Global sharded database service instance
sharded_db_service: Optional[ShardedDatabaseService] = None


def get_sharded_db() -> ShardedDatabaseService:
    """Get the global sharded database service"""
    global sharded_db_service
    if sharded_db_service is None:
        sharded_db_service = ShardedDatabaseService()
    return sharded_db_service


# Convenience functions for backward compatibility
def get_document_db(document_id: str):
    """Get database session for document operations"""
    return get_sharded_db().get_document_db(document_id)


def get_user_db(user_id: str):
    """Get database session for user operations"""
    return get_sharded_db().get_user_db(user_id)