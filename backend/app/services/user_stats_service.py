"""
User Statistics Service
Business logic for user-specific statistics aggregation, productivity scoring, and activity tracking
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings

logger = logging.getLogger(__name__)


class UserStatsService:
    """Service for managing user-specific statistics and activity tracking"""

    def __init__(self):
        # Create database connection
        database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
        self.engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
            echo=False
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # Cache configuration for user-specific data
        self.cache = {}  # Simple in-memory cache (could be replaced with Redis)
        self.cache_ttl = {
            'user_statistics': 180,    # 3 minutes
            'user_documents': 120,     # 2 minutes
            'user_workflows': 90,      # 1.5 minutes
            'productivity_score': 300, # 5 minutes
            'activity_timeline': 60,   # 1 minute
        }

    async def get_user_statistics(self, user_id: str, time_range: str = '30d') -> Dict[str, Any]:
        """
        Get comprehensive user statistics with activity metrics

        Args:
            user_id: User identifier
            time_range: Time range for statistics ('7d', '30d', '90d', 'all')

        Returns:
            Dictionary with user statistics
        """
        if not user_id:
            return self._get_default_user_stats_with_error("Invalid user ID")

        cache_key = f"user_statistics_{user_id}_{time_range}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            logger.info(f"Returning cached user statistics for {user_id}")
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query user activity statistics view
                result = db.execute(text("""
                    SELECT
                        user_id,
                        email,
                        full_name,
                        role,
                        documents_created,
                        documents_updated_month,
                        documents_created_week,
                        workflows_initiated,
                        workflows_completed,
                        workflows_pending,
                        last_activity,
                        productivity_score,
                        last_updated
                    FROM user_activity_stats
                    WHERE user_id = :user_id
                """), {"user_id": user_id}).fetchone()

                if result:
                    # Get temporal document stats based on time range
                    temporal_docs = await self._get_temporal_document_stats(db, user_id, time_range)

                    # Get recent documents list
                    recent_docs = await self._get_recent_documents(db, user_id, limit=5)

                    user_stats = {
                        'user_id': result.user_id,
                        'email': result.email,
                        'full_name': result.full_name,
                        'role': result.role,
                        'documents_created': result.documents_created or 0,
                        'documents_collaborated': result.documents_updated_month or 0,
                        'workflows_initiated': result.workflows_initiated or 0,
                        'workflows_completed': result.workflows_completed or 0,
                        'workflows_pending': result.workflows_pending or 0,
                        'productivity_score': float(result.productivity_score or 0),
                        'last_activity': result.last_activity,
                        'recent_documents': recent_docs,
                        'temporal_stats': temporal_docs,
                        'time_range': time_range,
                        'last_updated': result.last_updated,
                        'data_source': 'database'
                    }
                else:
                    # User not found in view, return default stats
                    user_stats = self._get_default_user_stats(user_id, time_range)

                # Cache the result
                self._cache_data(cache_key, user_stats)
                logger.info(f"User statistics retrieved and cached for {user_id}")
                return user_stats

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting user statistics for {user_id}: {e}")
            return self._get_default_user_stats_with_error(f"Database error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error getting user statistics for {user_id}: {e}")
            return self._get_default_user_stats_with_error(f"Unexpected error: {str(e)}")

    async def get_user_document_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get detailed document statistics for a specific user

        Args:
            user_id: User identifier

        Returns:
            Dictionary with document statistics
        """
        if not user_id:
            return self._get_default_document_stats_with_error("Invalid user ID")

        cache_key = f"user_documents_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get document statistics
                doc_stats = db.execute(text("""
                    SELECT
                        COUNT(*) as documents_created,
                        COUNT(*) FILTER (WHERE datetime(updated_at) > datetime('now', '-30 days')) as documents_updated,
                        COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-7 days')) as documents_this_week,
                        COUNT(*) FILTER (WHERE datetime(created_at) > datetime('now', '-30 days')) as documents_this_month,
                        MAX(updated_at) as last_document_activity
                    FROM documents
                    WHERE created_by = :user_id
                """), {"user_id": user_id}).fetchone()

                # Get document types distribution
                doc_types = db.execute(text("""
                    SELECT document_type, COUNT(*) as count
                    FROM documents
                    WHERE created_by = :user_id
                    GROUP BY document_type
                    ORDER BY count DESC
                """), {"user_id": user_id}).fetchall()

                # Get collaboration statistics (documents where user is not creator but has updated)
                collaboration_stats = db.execute(text("""
                    SELECT
                        COUNT(*) as documents_collaborated,
                        COUNT(DISTINCT created_by) as unique_collaborators
                    FROM documents
                    WHERE updated_by = :user_id AND created_by != :user_id
                """), {"user_id": user_id}).fetchone()

                # Get recent activity timeline
                recent_activity = db.execute(text("""
                    SELECT
                        date(updated_at) as activity_date,
                        COUNT(*) as document_updates,
                        COUNT(*) FILTER (WHERE created_by = :user_id) as documents_created,
                        COUNT(*) FILTER (WHERE updated_by = :user_id AND created_by != :user_id) as documents_updated
                    FROM documents
                    WHERE (created_by = :user_id OR updated_by = :user_id)
                    AND datetime(updated_at) > datetime('now', '-14 days')
                    GROUP BY date(updated_at)
                    ORDER BY activity_date DESC
                """), {"user_id": user_id}).fetchall()

                document_statistics = {
                    'documents_created': doc_stats.documents_created if doc_stats else 0,
                    'documents_updated': doc_stats.documents_updated if doc_stats else 0,
                    'documents_this_week': doc_stats.documents_this_week if doc_stats else 0,
                    'documents_this_month': doc_stats.documents_this_month if doc_stats else 0,
                    'last_document_activity': doc_stats.last_document_activity if doc_stats else None,
                    'documents_by_type': [{'type': row.document_type, 'count': row.count} for row in doc_types],
                    'collaboration_stats': {
                        'documents_collaborated': collaboration_stats.documents_collaborated if collaboration_stats else 0,
                        'unique_collaborators': collaboration_stats.unique_collaborators if collaboration_stats else 0
                    },
                    'recent_activity': [
                        {
                            'date': row.activity_date,
                            'document_updates': row.document_updates,
                            'documents_created': row.documents_created,
                            'documents_updated': row.documents_updated
                        } for row in recent_activity
                    ],
                    'last_updated': datetime.utcnow().isoformat(),
                    'data_source': 'database'
                }

                # Cache the result
                self._cache_data(cache_key, document_statistics)
                return document_statistics

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting user document stats for {user_id}: {e}")
            return self._get_default_document_stats_with_error(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting user document stats for {user_id}: {e}")
            return self._get_default_document_stats_with_error(str(e))

    async def get_user_workflow_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get detailed workflow statistics for a specific user

        Args:
            user_id: User identifier

        Returns:
            Dictionary with workflow statistics
        """
        if not user_id:
            return self._get_default_workflow_stats_with_error("Invalid user ID")

        cache_key = f"user_workflows_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get workflow initiation statistics
                workflow_initiated = db.execute(text("""
                    SELECT
                        COUNT(*) as workflows_initiated,
                        COUNT(*) FILTER (WHERE status = 'completed') as workflows_completed,
                        COUNT(*) FILTER (WHERE status = 'pending') as workflows_pending,
                        COUNT(*) FILTER (WHERE status = 'rejected') as workflows_rejected,
                        AVG(CASE WHEN status = 'completed' THEN
                            (julianday(updated_at) - julianday(created_at)) * 24
                        END) as avg_completion_hours
                    FROM workflow_instances
                    WHERE initiated_by = :user_id
                    AND datetime(created_at) > datetime('now', '-90 days')
                """), {"user_id": user_id}).fetchone()

                # Get workflow assignment statistics
                workflow_assigned = db.execute(text("""
                    SELECT
                        COUNT(*) as workflows_assigned,
                        COUNT(*) FILTER (WHERE status = 'approved') as approvals_completed,
                        COUNT(*) FILTER (WHERE status = 'pending') as pending_approvals,
                        COUNT(*) FILTER (WHERE status = 'rejected') as approvals_rejected,
                        AVG(CASE WHEN status IN ('approved', 'rejected') THEN
                            (julianday(updated_at) - julianday(created_at)) * 24
                        END) as avg_response_hours
                    FROM workflow_step_instances
                    WHERE assigned_to = :user_id
                    AND datetime(created_at) > datetime('now', '-90 days')
                """), {"user_id": user_id}).fetchone()

                # Get workflow types distribution
                workflow_types = db.execute(text("""
                    SELECT
                        wi.workflow_id,
                        COUNT(*) as instances_initiated,
                        COUNT(*) FILTER (WHERE wi.status = 'completed') as instances_completed
                    FROM workflow_instances wi
                    WHERE wi.initiated_by = :user_id
                    AND datetime(wi.created_at) > datetime('now', '-90 days')
                    GROUP BY wi.workflow_id
                    ORDER BY instances_initiated DESC
                    LIMIT 10
                """), {"user_id": user_id}).fetchall()

                # Get recent workflow activity
                recent_workflow_activity = db.execute(text("""
                    SELECT
                        date(updated_at) as activity_date,
                        COUNT(*) FILTER (WHERE initiated_by = :user_id) as workflows_initiated,
                        COUNT(*) FILTER (WHERE assigned_to = :user_id) as approvals_processed
                    FROM (
                        SELECT updated_at, initiated_by, NULL as assigned_to FROM workflow_instances
                        WHERE initiated_by = :user_id AND datetime(updated_at) > datetime('now', '-14 days')
                        UNION ALL
                        SELECT updated_at, NULL as initiated_by, assigned_to FROM workflow_step_instances
                        WHERE assigned_to = :user_id AND datetime(updated_at) > datetime('now', '-14 days')
                    )
                    GROUP BY date(updated_at)
                    ORDER BY activity_date DESC
                """), {"user_id": user_id}).fetchall()

                workflow_statistics = {
                    'workflows_initiated': workflow_initiated.workflows_initiated if workflow_initiated else 0,
                    'workflows_assigned': workflow_assigned.workflows_assigned if workflow_assigned else 0,
                    'workflows_completed': workflow_initiated.workflows_completed if workflow_initiated else 0,
                    'pending_approvals': workflow_assigned.pending_approvals if workflow_assigned else 0,
                    'avg_response_time': float(workflow_assigned.avg_response_hours or 0) if workflow_assigned else 0,
                    'completion_rate': round(
                        (workflow_initiated.workflows_completed / max(1, workflow_initiated.workflows_initiated)) * 100, 2
                    ) if workflow_initiated and workflow_initiated.workflows_initiated > 0 else 0,
                    'approval_rate': round(
                        (workflow_assigned.approvals_completed / max(1, workflow_assigned.workflows_assigned)) * 100, 2
                    ) if workflow_assigned and workflow_assigned.workflows_assigned > 0 else 0,
                    'workflow_types': [
                        {
                            'workflow_id': row.workflow_id,
                            'instances_initiated': row.instances_initiated,
                            'instances_completed': row.instances_completed,
                            'completion_rate': round((row.instances_completed / row.instances_initiated) * 100, 2)
                        } for row in workflow_types
                    ],
                    'recent_activity': [
                        {
                            'date': row.activity_date,
                            'workflows_initiated': row.workflows_initiated or 0,
                            'approvals_processed': row.approvals_processed or 0
                        } for row in recent_workflow_activity
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
            logger.error(f"Database error getting user workflow stats for {user_id}: {e}")
            return self._get_default_workflow_stats_with_error(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting user workflow stats for {user_id}: {e}")
            return self._get_default_workflow_stats_with_error(str(e))

    async def calculate_productivity_score(self, user_id: str) -> float:
        """
        Calculate user productivity score (0-100) based on activity metrics

        Args:
            user_id: User identifier

        Returns:
            Productivity score as float between 0 and 100
        """
        if not user_id:
            return 0.0

        cache_key = f"productivity_score_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get comprehensive activity metrics for scoring
                activity_metrics = db.execute(text("""
                    SELECT
                        COUNT(DISTINCT d.id) as documents_created,
                        COUNT(DISTINCT d.id) FILTER (WHERE datetime(d.created_at) > datetime('now', '-7 days')) as recent_documents,
                        COUNT(DISTINCT wi.id) FILTER (WHERE wi.initiated_by = :user_id) as workflows_initiated,
                        COUNT(DISTINCT wsi.id) FILTER (WHERE wsi.assigned_to = :user_id AND wsi.status = 'approved') as approvals_completed,
                        COUNT(DISTINCT wsi.id) FILTER (WHERE wsi.assigned_to = :user_id AND wsi.status = 'pending') as pending_approvals,
                        MAX(GREATEST(
                            COALESCE(d.updated_at, datetime('1900-01-01')),
                            COALESCE(wi.updated_at, datetime('1900-01-01')),
                            COALESCE(wsi.updated_at, datetime('1900-01-01'))
                        )) as last_activity
                    FROM users u
                    LEFT JOIN documents d ON d.created_by = u.id
                    LEFT JOIN workflow_instances wi ON wi.initiated_by = u.id
                    LEFT JOIN workflow_step_instances wsi ON wsi.assigned_to = u.id
                    WHERE u.id = :user_id
                """), {"user_id": user_id}).fetchone()

                if not activity_metrics:
                    return 0.0

                # Calculate productivity components
                doc_score = min(25, activity_metrics.documents_created * 2)  # Max 25 points
                recent_activity_score = min(20, activity_metrics.recent_documents * 5)  # Max 20 points
                workflow_score = min(20, activity_metrics.workflows_initiated * 3)  # Max 20 points
                approval_score = min(25, activity_metrics.approvals_completed * 2)  # Max 25 points

                # Penalty for pending approvals (encourages responsiveness)
                pending_penalty = min(10, activity_metrics.pending_approvals * 2)

                # Recency bonus
                recency_bonus = 0
                if activity_metrics.last_activity:
                    last_activity = datetime.fromisoformat(activity_metrics.last_activity.replace('Z', '+00:00'))
                    days_since_activity = (datetime.utcnow() - last_activity.replace(tzinfo=None)).days
                    if days_since_activity <= 1:
                        recency_bonus = 10
                    elif days_since_activity <= 7:
                        recency_bonus = 5

                # Calculate final score
                productivity_score = (
                    doc_score +
                    recent_activity_score +
                    workflow_score +
                    approval_score +
                    recency_bonus -
                    pending_penalty
                )

                productivity_score = max(0, min(100, productivity_score))

                # Cache the result
                self._cache_data(cache_key, productivity_score)
                logger.info(f"Productivity score calculated for {user_id}: {productivity_score:.2f}")
                return productivity_score

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error calculating productivity score for {user_id}: {e}")
            return 50.0  # Default neutral score
        except Exception as e:
            logger.error(f"Unexpected error calculating productivity score for {user_id}: {e}")
            return 50.0

    async def get_user_activity_timeline(self, user_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """
        Get user activity timeline for the specified number of days

        Args:
            user_id: User identifier
            days: Number of days to include in timeline

        Returns:
            List of daily activity summaries
        """
        if not user_id:
            return []

        cache_key = f"activity_timeline_{user_id}_{days}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get daily activity timeline
                timeline = db.execute(text("""
                    SELECT
                        activity_date,
                        SUM(document_activity) as document_activity,
                        SUM(workflow_activity) as workflow_activity,
                        SUM(approval_activity) as approval_activity
                    FROM (
                        SELECT
                            date(created_at) as activity_date,
                            COUNT(*) as document_activity,
                            0 as workflow_activity,
                            0 as approval_activity
                        FROM documents
                        WHERE created_by = :user_id
                        AND datetime(created_at) > datetime('now', '-' || :days || ' days')
                        GROUP BY date(created_at)

                        UNION ALL

                        SELECT
                            date(created_at) as activity_date,
                            0 as document_activity,
                            COUNT(*) as workflow_activity,
                            0 as approval_activity
                        FROM workflow_instances
                        WHERE initiated_by = :user_id
                        AND datetime(created_at) > datetime('now', '-' || :days || ' days')
                        GROUP BY date(created_at)

                        UNION ALL

                        SELECT
                            date(updated_at) as activity_date,
                            0 as document_activity,
                            0 as workflow_activity,
                            COUNT(*) as approval_activity
                        FROM workflow_step_instances
                        WHERE assigned_to = :user_id
                        AND status IN ('approved', 'rejected')
                        AND datetime(updated_at) > datetime('now', '-' || :days || ' days')
                        GROUP BY date(updated_at)
                    )
                    GROUP BY activity_date
                    ORDER BY activity_date DESC
                """), {"user_id": user_id, "days": days}).fetchall()

                activity_timeline = [
                    {
                        'date': row.activity_date,
                        'document_activity': row.document_activity or 0,
                        'workflow_activity': row.workflow_activity or 0,
                        'approval_activity': row.approval_activity or 0,
                        'total_activity': (row.document_activity or 0) + (row.workflow_activity or 0) + (row.approval_activity or 0)
                    } for row in timeline
                ]

                # Cache the result
                self._cache_data(cache_key, activity_timeline)
                return activity_timeline

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting activity timeline for {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting activity timeline for {user_id}: {e}")
            return []

    async def get_bulk_user_statistics(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Get statistics for multiple users efficiently

        Args:
            user_ids: List of user identifiers

        Returns:
            Dictionary mapping user_id to their statistics
        """
        if not user_ids:
            return {}

        # Filter out invalid user IDs
        valid_user_ids = [uid for uid in user_ids if uid]
        if not valid_user_ids:
            return {}

        results = {}

        try:
            db = self.SessionLocal()
            try:
                # Get bulk user statistics from view
                bulk_results = db.execute(text("""
                    SELECT
                        user_id,
                        documents_created,
                        workflows_initiated,
                        workflows_completed,
                        productivity_score,
                        last_activity
                    FROM user_activity_stats
                    WHERE user_id IN ({})
                """.format(','.join([f"'{uid}'" for uid in valid_user_ids])))).fetchall()

                # Process results
                for row in bulk_results:
                    results[row.user_id] = {
                        'user_id': row.user_id,
                        'documents_created': row.documents_created or 0,
                        'workflows_initiated': row.workflows_initiated or 0,
                        'workflows_completed': row.workflows_completed or 0,
                        'productivity_score': float(row.productivity_score or 0),
                        'last_activity': row.last_activity,
                        'data_source': 'database'
                    }

                # Add default entries for users not found
                for user_id in valid_user_ids:
                    if user_id not in results:
                        results[user_id] = self._get_default_user_stats(user_id)

                return results

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting bulk user statistics: {e}")
            # Return default stats for all users on error
            return {uid: self._get_default_user_stats(uid) for uid in valid_user_ids}
        except Exception as e:
            logger.error(f"Unexpected error getting bulk user statistics: {e}")
            return {uid: self._get_default_user_stats(uid) for uid in valid_user_ids}

    async def _get_temporal_document_stats(self, db, user_id: str, time_range: str) -> Dict[str, int]:
        """Get document statistics for specific time range"""
        range_mapping = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            'all': 3650  # ~10 years
        }
        days = range_mapping.get(time_range, 30)

        result = db.execute(text("""
            SELECT
                COUNT(*) as documents_in_range,
                COUNT(*) FILTER (WHERE datetime(updated_at) > datetime('now', '-7 days')) as updated_recently
            FROM documents
            WHERE created_by = :user_id
            AND datetime(created_at) > datetime('now', '-' || :days || ' days')
        """), {"user_id": user_id, "days": days}).fetchone()

        return {
            'documents_in_range': result.documents_in_range if result else 0,
            'updated_recently': result.updated_recently if result else 0
        }

    async def _get_recent_documents(self, db, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get list of recent documents for user"""
        results = db.execute(text("""
            SELECT id, title, document_type, updated_at
            FROM documents
            WHERE created_by = :user_id
            ORDER BY updated_at DESC
            LIMIT :limit
        """), {"user_id": user_id, "limit": limit}).fetchall()

        return [
            {
                'id': row.id,
                'title': row.title,
                'document_type': row.document_type,
                'updated_at': row.updated_at
            } for row in results
        ]

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False

        cache_entry = self.cache[cache_key]
        cache_type = cache_key.split('_')[0] + '_' + cache_key.split('_')[1]
        ttl = self.cache_ttl.get(cache_type, 180)
        age = (datetime.utcnow() - cache_entry['timestamp']).total_seconds()

        return age < ttl

    def _cache_data(self, cache_key: str, data: Any) -> None:
        """Cache data with timestamp"""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.utcnow()
        }

    def _get_default_user_stats(self, user_id: str, time_range: str = '30d') -> Dict[str, Any]:
        """Get default user statistics for non-existent users"""
        return {
            'user_id': user_id,
            'email': None,
            'full_name': None,
            'role': None,
            'documents_created': 0,
            'documents_collaborated': 0,
            'workflows_initiated': 0,
            'workflows_completed': 0,
            'workflows_pending': 0,
            'productivity_score': 0.0,
            'last_activity': None,
            'recent_documents': [],
            'temporal_stats': {'documents_in_range': 0, 'updated_recently': 0},
            'time_range': time_range,
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'default'
        }

    def _get_default_user_stats_with_error(self, error: str) -> Dict[str, Any]:
        """Get default user statistics with error information"""
        default = self._get_default_user_stats("unknown")
        default['error'] = error
        default['data_source'] = 'error_fallback'
        return default

    def _get_default_document_stats_with_error(self, error: str) -> Dict[str, Any]:
        """Get default document stats with error information"""
        return {
            'documents_created': 0,
            'documents_updated': 0,
            'documents_this_week': 0,
            'documents_this_month': 0,
            'last_document_activity': None,
            'documents_by_type': [],
            'collaboration_stats': {'documents_collaborated': 0, 'unique_collaborators': 0},
            'recent_activity': [],
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }

    def _get_default_workflow_stats_with_error(self, error: str) -> Dict[str, Any]:
        """Get default workflow stats with error information"""
        return {
            'workflows_initiated': 0,
            'workflows_assigned': 0,
            'workflows_completed': 0,
            'pending_approvals': 0,
            'avg_response_time': 0.0,
            'completion_rate': 0.0,
            'approval_rate': 0.0,
            'workflow_types': [],
            'recent_activity': [],
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }