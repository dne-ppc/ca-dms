"""
System Statistics Service
Business logic for system-wide statistics aggregation, caching, and health monitoring
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings

logger = logging.getLogger(__name__)


class SystemStatsService:
    """Service for managing system-wide statistics and health monitoring"""

    def __init__(self):
        # Create database connection
        database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
        self.engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
            echo=False
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # Cache configuration
        self.cache = {}  # Simple in-memory cache (could be replaced with Redis)
        self.cache_ttl = {
            'system_overview': 300,  # 5 minutes
            'document_stats': 180,   # 3 minutes
            'workflow_stats': 120,   # 2 minutes
            'system_health': 600,    # 10 minutes
        }

    async def get_system_overview(self, force_refresh: bool = False, use_cache: bool = True) -> Dict[str, Any]:
        """
        Get comprehensive system overview with key metrics

        Args:
            force_refresh: Force fresh data from database
            use_cache: Allow cached data if available

        Returns:
            Dictionary with system overview data
        """
        cache_key = "system_overview"

        # Check cache first (unless force refresh)
        if use_cache and not force_refresh and self._is_cache_valid(cache_key):
            logger.info("Returning cached system overview")
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query system statistics view
                result = db.execute(text("""
                    SELECT
                        total_documents,
                        active_users,
                        documents_today,
                        documents_this_week,
                        documents_this_month,
                        total_workflows,
                        pending_workflows,
                        completed_workflows,
                        completed_workflows_today,
                        avg_workflow_completion_hours,
                        system_health_score,
                        last_updated
                    FROM system_stats
                """)).fetchone()

                if result:
                    overview_data = {
                        'total_documents': result.total_documents or 0,
                        'active_users': result.active_users or 0,
                        'documents_today': result.documents_today or 0,
                        'documents_this_week': result.documents_this_week or 0,
                        'documents_this_month': result.documents_this_month or 0,
                        'total_workflows': result.total_workflows or 0,
                        'pending_workflows': result.pending_workflows or 0,
                        'completed_workflows': result.completed_workflows or 0,
                        'completed_workflows_today': result.completed_workflows_today or 0,
                        'avg_workflow_completion_hours': float(result.avg_workflow_completion_hours or 0),
                        'system_health_score': float(result.system_health_score or 50),
                        'last_updated': result.last_updated,
                        'response_time_ms': 0,  # Will be set by caller
                        'data_source': 'database'
                    }
                else:
                    overview_data = self._get_default_overview()

                # Cache the result
                self._cache_data(cache_key, overview_data)
                logger.info("System overview retrieved and cached")
                return overview_data

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting system overview: {e}")
            return self._get_default_overview_with_error(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting system overview: {e}")
            return self._get_default_overview_with_error(str(e))

    async def calculate_system_health(self) -> float:
        """
        Calculate system health score (0-100)

        Returns:
            Health score as float between 0 and 100
        """
        cache_key = "system_health"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get basic system metrics for health calculation
                doc_stats = db.execute(text("""
                    SELECT COUNT(*) as total_docs,
                           COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-7 days')) as recent_docs
                    FROM documents
                """)).fetchone()

                workflow_stats = db.execute(text("""
                    SELECT COUNT(*) as total_workflows,
                           COUNT(*) FILTER (WHERE status = 'completed') as completed_workflows
                    FROM workflow_instances
                    WHERE datetime(created_at) > datetime('now', '-30 days')
                """)).fetchone()

                user_stats = db.execute(text("""
                    SELECT COUNT(*) as total_users,
                           COUNT(*) FILTER (WHERE datetime(last_login) > datetime('now', '-7 days')) as active_users
                    FROM users
                    WHERE is_active = 1
                """)).fetchone()

                # Calculate health components
                doc_growth = 50  # Base score
                if doc_stats and doc_stats.total_docs > 0:
                    doc_growth = min(100, 50 + (doc_stats.recent_docs * 10))

                workflow_health = 50
                if workflow_stats and workflow_stats.total_workflows > 0:
                    completion_rate = workflow_stats.completed_workflows / workflow_stats.total_workflows
                    workflow_health = completion_rate * 100

                user_activity = 50
                if user_stats and user_stats.total_users > 0:
                    activity_rate = (user_stats.active_users or 0) / user_stats.total_users
                    user_activity = activity_rate * 100

                # Weighted health score
                health_score = (
                    doc_growth * 0.3 +
                    workflow_health * 0.4 +
                    user_activity * 0.3
                )

                health_score = max(0, min(100, health_score))  # Clamp to 0-100

                # Cache the result
                self._cache_data(cache_key, health_score)
                logger.info(f"System health calculated: {health_score:.2f}")
                return health_score

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error calculating system health: {e}")
            return 50.0  # Default neutral health
        except Exception as e:
            logger.error(f"Unexpected error calculating system health: {e}")
            return 50.0

    async def get_document_statistics(self) -> Dict[str, Any]:
        """
        Get detailed document statistics and trends

        Returns:
            Dictionary with document statistics
        """
        cache_key = "document_stats"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get document statistics
                doc_stats = db.execute(text("""
                    SELECT
                        COUNT(*) as total_documents,
                        COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-1 day')) as documents_today,
                        COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-7 days')) as documents_this_week,
                        COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-30 days')) as documents_this_month,
                        COUNT(DISTINCT created_by) as contributing_users
                    FROM documents
                """)).fetchone()

                # Get document types distribution
                doc_types = db.execute(text("""
                    SELECT document_type, COUNT(*) as count
                    FROM documents
                    GROUP BY document_type
                    ORDER BY count DESC
                """)).fetchall()

                # Get recent activity trend
                activity_trend = db.execute(text("""
                    SELECT
                        date(created_at) as activity_date,
                        COUNT(*) as document_count
                    FROM documents
                    WHERE datetime(created_at) > datetime('now', '-7 days')
                    GROUP BY date(created_at)
                    ORDER BY activity_date DESC
                """)).fetchall()

                doc_statistics = {
                    'total_documents': doc_stats.total_documents if doc_stats else 0,
                    'documents_today': doc_stats.documents_today if doc_stats else 0,
                    'documents_this_week': doc_stats.documents_this_week if doc_stats else 0,
                    'documents_this_month': doc_stats.documents_this_month if doc_stats else 0,
                    'contributing_users': doc_stats.contributing_users if doc_stats else 0,
                    'document_types': [{'type': row.document_type, 'count': row.count} for row in doc_types],
                    'activity_trend': [{'date': row.activity_date, 'count': row.document_count} for row in activity_trend],
                    'last_updated': datetime.utcnow().isoformat(),
                    'data_source': 'database'
                }

                # Cache the result
                self._cache_data(cache_key, doc_statistics)
                return doc_statistics

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting document statistics: {e}")
            return self._get_default_document_stats_with_error(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting document statistics: {e}")
            return self._get_default_document_stats_with_error(str(e))

    async def get_workflow_statistics(self) -> Dict[str, Any]:
        """
        Get detailed workflow performance statistics

        Returns:
            Dictionary with workflow statistics
        """
        cache_key = "workflow_stats"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get workflow statistics
                workflow_stats = db.execute(text("""
                    SELECT
                        COUNT(*) as total_workflows,
                        COUNT(*) FILTER (WHERE status = 'pending') as pending_workflows,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed_workflows,
                        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_workflows,
                        AVG(CASE WHEN status = 'completed' THEN
                            (julianday(updated_at) - julianday(created_at)) * 24
                        END) as avg_completion_hours
                    FROM workflow_instances
                    WHERE datetime(created_at) > datetime('now', '-30 days')
                """)).fetchone()

                # Get workflow performance by type
                workflow_performance = db.execute(text("""
                    SELECT
                        wi.workflow_id,
                        COUNT(*) as total_instances,
                        COUNT(*) FILTER (WHERE wi.status = 'completed') as completed_instances,
                        AVG(CASE WHEN wi.status = 'completed' THEN
                            (julianday(wi.updated_at) - julianday(wi.created_at)) * 24
                        END) as avg_completion_hours
                    FROM workflow_instances wi
                    WHERE datetime(wi.created_at) > datetime('now', '-30 days')
                    GROUP BY wi.workflow_id
                    ORDER BY total_instances DESC
                    LIMIT 10
                """)).fetchall()

                # Calculate completion rate
                completion_rate = 0
                if workflow_stats and workflow_stats.total_workflows > 0:
                    completion_rate = (workflow_stats.completed_workflows / workflow_stats.total_workflows) * 100

                workflow_statistics = {
                    'total_workflows': workflow_stats.total_workflows if workflow_stats else 0,
                    'pending_workflows': workflow_stats.pending_workflows if workflow_stats else 0,
                    'completed_workflows': workflow_stats.completed_workflows if workflow_stats else 0,
                    'rejected_workflows': workflow_stats.rejected_workflows if workflow_stats else 0,
                    'avg_completion_time': float(workflow_stats.avg_completion_hours or 0) if workflow_stats else 0,
                    'completion_rate': round(completion_rate, 2),
                    'workflow_performance': [
                        {
                            'workflow_id': row.workflow_id,
                            'total_instances': row.total_instances,
                            'completed_instances': row.completed_instances,
                            'avg_completion_hours': float(row.avg_completion_hours or 0)
                        } for row in workflow_performance
                    ],
                    'last_updated': datetime.utcnow().isoformat(),
                    'data_source': 'database'
                }

                # Cache the result
                self._cache_data(cache_key, workflow_statistics)
                return workflow_statistics

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting workflow statistics: {e}")
            return self._get_default_workflow_stats_with_error(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting workflow statistics: {e}")
            return self._get_default_workflow_stats_with_error(str(e))

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False

        cache_entry = self.cache[cache_key]
        ttl = self.cache_ttl.get(cache_key, 300)
        age = (datetime.utcnow() - cache_entry['timestamp']).total_seconds()

        return age < ttl

    def _cache_data(self, cache_key: str, data: Any) -> None:
        """Cache data with timestamp"""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.utcnow()
        }

    def _get_default_overview(self) -> Dict[str, Any]:
        """Get default system overview for empty database"""
        return {
            'total_documents': 0,
            'active_users': 0,
            'documents_today': 0,
            'documents_this_week': 0,
            'documents_this_month': 0,
            'total_workflows': 0,
            'pending_workflows': 0,
            'completed_workflows': 0,
            'completed_workflows_today': 0,
            'avg_workflow_completion_hours': 0.0,
            'system_health_score': 50.0,
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'default'
        }

    def _get_default_overview_with_error(self, error: str) -> Dict[str, Any]:
        """Get default system overview with error information"""
        default = self._get_default_overview()
        default['error'] = error
        default['data_source'] = 'error_fallback'
        return default

    def _get_default_document_stats_with_error(self, error: str) -> Dict[str, Any]:
        """Get default document stats with error information"""
        return {
            'total_documents': 0,
            'documents_today': 0,
            'documents_this_week': 0,
            'documents_this_month': 0,
            'contributing_users': 0,
            'document_types': [],
            'activity_trend': [],
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }

    def _get_default_workflow_stats_with_error(self, error: str) -> Dict[str, Any]:
        """Get default workflow stats with error information"""
        return {
            'total_workflows': 0,
            'pending_workflows': 0,
            'completed_workflows': 0,
            'rejected_workflows': 0,
            'avg_completion_time': 0.0,
            'completion_rate': 0.0,
            'workflow_performance': [],
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }