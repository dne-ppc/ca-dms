"""
Actionable Items Service
Business logic for user-specific actionable items aggregation and prioritization
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


class ActionableItemsService:
    """Service for managing user-specific actionable items and prioritization"""

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
            'user_actionable_items': 180,  # 3 minutes
            'pending_approvals': 120,      # 2 minutes
            'draft_documents': 300,        # 5 minutes
            'overdue_reviews': 60,         # 1 minute (time-sensitive)
            'workflow_assignments': 180,   # 3 minutes
            'priority_score': 300,         # 5 minutes
        }

    async def get_user_actionable_items(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive actionable items for a specific user

        Args:
            user_id: User ID to get actionable items for

        Returns:
            Dictionary with user's actionable items and priority information
        """
        if not user_id:
            return self._get_error_response("Invalid user ID")

        cache_key = f"user_actionable_items_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            logger.info(f"Returning cached actionable items for user {user_id}")
            return self.cache[cache_key]['data']

        try:
            # Get all actionable item types in parallel
            pending_approvals = await self.get_pending_approvals(user_id)
            draft_documents = await self.get_draft_documents(user_id)
            overdue_reviews = await self.get_overdue_reviews(user_id)
            workflow_assignments = await self.get_workflow_assignments(user_id)
            priority_score = await self.calculate_priority_score(user_id)

            # Count urgent items
            urgent_items_count = self._count_urgent_items(
                pending_approvals, draft_documents, overdue_reviews, workflow_assignments
            )

            actionable_items = {
                'user_id': user_id,
                'pending_approvals': pending_approvals,
                'draft_documents': draft_documents,
                'overdue_reviews': overdue_reviews,
                'workflow_assignments': workflow_assignments,
                'urgent_items_count': urgent_items_count,
                'priority_score': priority_score,
                'last_updated': datetime.utcnow().isoformat(),
                'response_time_ms': 0,  # Will be set by caller
                'data_source': 'database'
            }

            # Cache the result
            self._cache_data(cache_key, actionable_items)
            logger.info(f"Actionable items retrieved and cached for user {user_id}")
            return actionable_items

        except SQLAlchemyError as e:
            logger.error(f"Database error getting actionable items for user {user_id}: {e}")
            return self._get_error_response(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting actionable items for user {user_id}: {e}")
            return self._get_error_response(str(e))

    async def get_pending_approvals(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get pending approval items for a specific user

        Args:
            user_id: User ID to get pending approvals for

        Returns:
            List of pending approval items
        """
        cache_key = f"pending_approvals_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query pending approvals assigned to user
                approvals = db.execute(text("""
                    SELECT
                        wsi.id as workflow_step_id,
                        wsi.workflow_instance_id,
                        wi.document_id,
                        d.title as document_title,
                        d.document_type,
                        wsi.step_name,
                        wsi.assigned_date,
                        wsi.due_date,
                        CASE
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now') THEN 'urgent'
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now', '+1 day') THEN 'high'
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now', '+3 days') THEN 'medium'
                            ELSE 'low'
                        END as priority,
                        wsi.created_at,
                        julianday('now') - julianday(wsi.assigned_date) as days_assigned
                    FROM workflow_step_instances wsi
                    JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
                    JOIN documents d ON d.id = wi.document_id
                    WHERE wsi.assigned_to = :user_id
                    AND wsi.status = 'pending'
                    ORDER BY
                        CASE wsi.due_date
                            WHEN NULL THEN 1
                            ELSE 0
                        END,
                        wsi.due_date ASC,
                        wsi.created_at ASC
                    LIMIT 50
                """), {"user_id": user_id}).fetchall()

                pending_approvals = []
                for approval in approvals:
                    pending_approvals.append({
                        'workflow_step_id': approval.workflow_step_id,
                        'workflow_instance_id': approval.workflow_instance_id,
                        'document_id': approval.document_id,
                        'document_title': approval.document_title,
                        'document_type': approval.document_type,
                        'step_name': approval.step_name,
                        'assigned_date': approval.assigned_date,
                        'due_date': approval.due_date,
                        'priority': approval.priority,
                        'created_at': approval.created_at,
                        'days_assigned': int(approval.days_assigned or 0)
                    })

                # Cache the result
                self._cache_data(cache_key, pending_approvals)
                return pending_approvals

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting pending approvals for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting pending approvals for user {user_id}: {e}")
            return []

    async def get_draft_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get draft documents for a specific user

        Args:
            user_id: User ID to get draft documents for

        Returns:
            List of draft documents
        """
        cache_key = f"draft_documents_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query user's draft documents
                drafts = db.execute(text("""
                    SELECT
                        d.id as document_id,
                        d.title,
                        d.document_type,
                        d.updated_at as last_modified,
                        d.created_at,
                        CASE
                            WHEN LENGTH(COALESCE(d.content, '')) > 1000 THEN 75
                            WHEN LENGTH(COALESCE(d.content, '')) > 500 THEN 50
                            WHEN LENGTH(COALESCE(d.content, '')) > 100 THEN 25
                            ELSE 10
                        END as completion_percentage,
                        julianday('now') - julianday(d.updated_at) as days_since_modified
                    FROM documents d
                    WHERE d.created_by = :user_id
                    AND d.status = 'draft'
                    ORDER BY d.updated_at DESC
                    LIMIT 25
                """), {"user_id": user_id}).fetchall()

                draft_documents = []
                for draft in drafts:
                    draft_documents.append({
                        'document_id': draft.document_id,
                        'title': draft.title,
                        'document_type': draft.document_type,
                        'last_modified': draft.last_modified,
                        'created_at': draft.created_at,
                        'completion_percentage': draft.completion_percentage,
                        'days_since_modified': int(draft.days_since_modified or 0)
                    })

                # Cache the result
                self._cache_data(cache_key, draft_documents)
                return draft_documents

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting draft documents for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting draft documents for user {user_id}: {e}")
            return []

    async def get_overdue_reviews(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get overdue review items for a specific user

        Args:
            user_id: User ID to get overdue reviews for

        Returns:
            List of overdue review items
        """
        cache_key = f"overdue_reviews_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query overdue reviews for documents the user is involved with
                overdue_items = db.execute(text("""
                    SELECT
                        d.id as document_id,
                        d.title as document_title,
                        d.document_type,
                        'periodic_review' as review_type,
                        d.next_review_date as due_date,
                        julianday('now') - julianday(d.next_review_date) as days_overdue,
                        d.updated_at as last_activity
                    FROM documents d
                    WHERE (d.created_by = :user_id OR d.id IN (
                        SELECT DISTINCT wi.document_id
                        FROM workflow_instances wi
                        JOIN workflow_step_instances wsi ON wsi.workflow_instance_id = wi.id
                        WHERE wsi.assigned_to = :user_id
                    ))
                    AND d.status = 'active'
                    AND d.next_review_date IS NOT NULL
                    AND datetime(d.next_review_date) < datetime('now')

                    UNION ALL

                    SELECT
                        d.id as document_id,
                        d.title as document_title,
                        d.document_type,
                        'workflow_overdue' as review_type,
                        wsi.due_date,
                        julianday('now') - julianday(wsi.due_date) as days_overdue,
                        wsi.updated_at as last_activity
                    FROM documents d
                    JOIN workflow_instances wi ON wi.document_id = d.id
                    JOIN workflow_step_instances wsi ON wsi.workflow_instance_id = wi.id
                    WHERE wsi.assigned_to = :user_id
                    AND wsi.status = 'pending'
                    AND wsi.due_date IS NOT NULL
                    AND datetime(wsi.due_date) < datetime('now')

                    ORDER BY days_overdue DESC
                    LIMIT 20
                """), {"user_id": user_id}).fetchall()

                overdue_reviews = []
                for item in overdue_items:
                    overdue_reviews.append({
                        'document_id': item.document_id,
                        'document_title': item.document_title,
                        'document_type': item.document_type,
                        'review_type': item.review_type,
                        'due_date': item.due_date,
                        'days_overdue': int(item.days_overdue or 0),
                        'last_activity': item.last_activity
                    })

                # Cache the result
                self._cache_data(cache_key, overdue_reviews)
                return overdue_reviews

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting overdue reviews for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting overdue reviews for user {user_id}: {e}")
            return []

    async def get_workflow_assignments(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get workflow assignments for a specific user

        Args:
            user_id: User ID to get workflow assignments for

        Returns:
            List of workflow assignments
        """
        cache_key = f"workflow_assignments_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Query active workflow assignments
                assignments = db.execute(text("""
                    SELECT
                        wsi.id as workflow_step_id,
                        wsi.workflow_instance_id,
                        wi.workflow_id,
                        w.name as workflow_name,
                        d.id as document_id,
                        d.title as document_title,
                        d.document_type,
                        wsi.step_name,
                        wsi.assigned_date,
                        wsi.due_date,
                        wsi.status,
                        CASE
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now') THEN 'urgent'
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now', '+1 day') THEN 'high'
                            WHEN wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now', '+3 days') THEN 'medium'
                            ELSE 'low'
                        END as priority,
                        wi.initiated_by,
                        wi.created_at as workflow_created_at
                    FROM workflow_step_instances wsi
                    JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
                    JOIN workflows w ON w.id = wi.workflow_id
                    JOIN documents d ON d.id = wi.document_id
                    WHERE wsi.assigned_to = :user_id
                    AND wsi.status IN ('pending', 'in_progress')
                    ORDER BY
                        CASE wsi.due_date
                            WHEN NULL THEN 1
                            ELSE 0
                        END,
                        wsi.due_date ASC,
                        wsi.assigned_date ASC
                    LIMIT 30
                """), {"user_id": user_id}).fetchall()

                workflow_assignments = []
                for assignment in assignments:
                    workflow_assignments.append({
                        'workflow_step_id': assignment.workflow_step_id,
                        'workflow_instance_id': assignment.workflow_instance_id,
                        'workflow_id': assignment.workflow_id,
                        'workflow_name': assignment.workflow_name,
                        'document_id': assignment.document_id,
                        'document_title': assignment.document_title,
                        'document_type': assignment.document_type,
                        'step_name': assignment.step_name,
                        'assigned_date': assignment.assigned_date,
                        'due_date': assignment.due_date,
                        'status': assignment.status,
                        'priority': assignment.priority,
                        'initiated_by': assignment.initiated_by,
                        'workflow_created_at': assignment.workflow_created_at
                    })

                # Cache the result
                self._cache_data(cache_key, workflow_assignments)
                return workflow_assignments

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting workflow assignments for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting workflow assignments for user {user_id}: {e}")
            return []

    async def calculate_priority_score(self, user_id: str) -> float:
        """
        Calculate overall priority score for user's actionable items (0-100)

        Args:
            user_id: User ID to calculate priority score for

        Returns:
            Priority score as float between 0 and 100
        """
        cache_key = f"priority_score_{user_id}"

        # Check cache first
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Get priority metrics
                priority_metrics = db.execute(text("""
                    SELECT
                        COUNT(*) FILTER (WHERE wsi.status = 'pending' AND wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now')) as overdue_approvals,
                        COUNT(*) FILTER (WHERE wsi.status = 'pending' AND wsi.due_date IS NOT NULL AND datetime(wsi.due_date) < datetime('now', '+1 day')) as urgent_approvals,
                        COUNT(*) FILTER (WHERE wsi.status = 'pending') as total_pending,
                        COUNT(*) FILTER (WHERE d.status = 'draft' AND julianday('now') - julianday(d.updated_at) > 7) as stale_drafts,
                        COUNT(*) FILTER (WHERE d.status = 'draft') as total_drafts
                    FROM workflow_step_instances wsi
                    LEFT JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
                    LEFT JOIN documents d ON d.id = wi.document_id OR d.created_by = :user_id
                    WHERE wsi.assigned_to = :user_id OR d.created_by = :user_id
                """), {"user_id": user_id}).fetchone()

                if not priority_metrics:
                    priority_score = 0.0
                else:
                    # Calculate priority components (0-100 scale)
                    overdue_penalty = min(40, priority_metrics.overdue_approvals * 15)  # Max 40 points penalty
                    urgent_pressure = min(30, priority_metrics.urgent_approvals * 10)  # Max 30 points pressure
                    workload_pressure = min(20, priority_metrics.total_pending * 2)    # Max 20 points workload
                    draft_neglect = min(10, priority_metrics.stale_drafts * 5)         # Max 10 points neglect

                    # Base score starts at 50 (neutral)
                    base_score = 50

                    # Add pressure and penalties
                    priority_score = base_score + overdue_penalty + urgent_pressure + workload_pressure + draft_neglect

                    # Clamp to 0-100 range
                    priority_score = max(0, min(100, priority_score))

                # Cache the result
                self._cache_data(cache_key, priority_score)
                logger.info(f"Priority score calculated for user {user_id}: {priority_score:.2f}")
                return priority_score

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error calculating priority score for user {user_id}: {e}")
            return 50.0  # Default neutral priority
        except Exception as e:
            logger.error(f"Unexpected error calculating priority score for user {user_id}: {e}")
            return 50.0

    def _count_urgent_items(self, pending_approvals: List, draft_documents: List,
                          overdue_reviews: List, workflow_assignments: List) -> int:
        """Count urgent items across all categories"""
        urgent_count = 0

        # Count urgent/overdue approvals
        urgent_count += len([item for item in pending_approvals if item.get('priority') in ['urgent', 'high']])

        # Count overdue reviews (all are urgent by definition)
        urgent_count += len(overdue_reviews)

        # Count urgent workflow assignments
        urgent_count += len([item for item in workflow_assignments if item.get('priority') in ['urgent', 'high']])

        # Count stale drafts (not modified in 7+ days)
        urgent_count += len([item for item in draft_documents if item.get('days_since_modified', 0) >= 7])

        return urgent_count

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False

        cache_entry = self.cache[cache_key]
        # Extract the cache type from the key
        cache_type = cache_key.split('_')[0] if '_' in cache_key else cache_key
        ttl = self.cache_ttl.get(cache_type, 300)
        age = (datetime.utcnow() - cache_entry['timestamp']).total_seconds()

        return age < ttl

    def _cache_data(self, cache_key: str, data: Any) -> None:
        """Cache data with timestamp"""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.utcnow()
        }

    def _get_error_response(self, error: str) -> Dict[str, Any]:
        """Get error response for actionable items"""
        return {
            'user_id': None,
            'pending_approvals': [],
            'draft_documents': [],
            'overdue_reviews': [],
            'workflow_assignments': [],
            'urgent_items_count': 0,
            'priority_score': 0.0,
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }