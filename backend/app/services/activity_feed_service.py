"""
Activity Feed Service
Business logic for user activity feed aggregation, timeline management, and real-time updates
"""
import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Union
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings

logger = logging.getLogger(__name__)


class ActivityFeedService:
    """Service for managing user activity feeds and timeline aggregation"""

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
            'user_activity_feed': 120,     # 2 minutes
            'document_activities': 180,    # 3 minutes
            'workflow_activities': 150,    # 2.5 minutes
            'system_activities': 300,      # 5 minutes
        }

        # Activity type configuration
        self.activity_icons = {
            'document_created': '📄',
            'document_updated': '✏️',
            'document_published': '📢',
            'document_deleted': '🗑️',
            'workflow_started': '🚀',
            'workflow_completed': '✅',
            'workflow_rejected': '❌',
            'workflow_assigned': '👤',
            'user_login': '🔑',
            'user_profile_updated': '👥',
            'system_backup': '💾',
            'system_maintenance': '🔧'
        }

        self.activity_colors = {
            'document_created': '#4CAF50',
            'document_updated': '#2196F3',
            'document_published': '#FF9800',
            'document_deleted': '#F44336',
            'workflow_started': '#9C27B0',
            'workflow_completed': '#4CAF50',
            'workflow_rejected': '#F44336',
            'workflow_assigned': '#607D8B',
            'user_login': '#3F51B5',
            'user_profile_updated': '#795548',
            'system_backup': '#009688',
            'system_maintenance': '#FF5722'
        }

    async def get_user_activity_feed(self, user_id: str, limit: int = 25, page_token: Optional[str] = None,
                                   activity_types: Optional[List[str]] = None, start_date: Optional[datetime] = None,
                                   end_date: Optional[datetime] = None, aggregate_similar: bool = False,
                                   include_real_time: bool = True) -> Dict[str, Any]:
        """
        Get comprehensive activity feed for a specific user

        Args:
            user_id: User ID to get activity feed for
            limit: Maximum number of activities to return
            page_token: Token for pagination
            activity_types: Filter by specific activity types
            start_date: Start date for filtering activities
            end_date: End date for filtering activities
            aggregate_similar: Whether to aggregate similar activities
            include_real_time: Whether to include real-time updates

        Returns:
            Dictionary with user's activity feed and pagination info
        """
        if not user_id:
            return self._get_error_response("Invalid user ID")

        # Create cache key based on parameters
        cache_key = self._generate_cache_key('user_activity_feed', user_id, {
            'limit': limit,
            'page_token': page_token,
            'activity_types': activity_types,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'aggregate_similar': aggregate_similar
        })

        # Check cache first (skip cache for real-time updates)
        if not include_real_time and self._is_cache_valid(cache_key):
            logger.info(f"Returning cached activity feed for user {user_id}")
            return self.cache[cache_key]['data']

        try:
            # Get activities from different sources
            document_activities = await self.get_document_activities(
                user_id, limit=limit//2, activity_types=activity_types,
                start_date=start_date, end_date=end_date
            )

            workflow_activities = await self.get_workflow_activities(
                user_id, limit=limit//3, activity_types=activity_types,
                start_date=start_date, end_date=end_date
            )

            system_activities = await self.get_system_activities(
                user_id, limit=limit//6, activity_types=activity_types,
                start_date=start_date, end_date=end_date
            )

            # Combine and sort all activities
            all_activities = document_activities + workflow_activities + system_activities

            # Sort by timestamp (most recent first)
            all_activities.sort(key=lambda x: x.get('timestamp', datetime.min), reverse=True)

            # Apply pagination
            offset = self._decode_page_token(page_token) if page_token else 0
            paginated_activities = all_activities[offset:offset + limit]

            # Format activities
            formatted_activities = [
                self.format_activity_item(activity) for activity in paginated_activities
            ]

            # Aggregate similar activities if requested
            if aggregate_similar:
                formatted_activities = self._aggregate_similar_activities(formatted_activities)

            # Generate next page token
            has_more = len(all_activities) > offset + limit
            next_page_token = self._encode_page_token(offset + limit) if has_more else None

            activity_feed = {
                'user_id': user_id,
                'activities': formatted_activities,
                'total_count': len(all_activities),
                'has_more': has_more,
                'next_page_token': next_page_token,
                'last_updated': datetime.utcnow().isoformat(),
                'response_time_ms': 0,  # Will be set by caller
                'data_source': 'database'
            }

            # Cache the result (if not real-time)
            if not include_real_time:
                self._cache_data(cache_key, activity_feed)

            logger.info(f"Activity feed retrieved for user {user_id}: {len(formatted_activities)} items")
            return activity_feed

        except SQLAlchemyError as e:
            logger.error(f"Database error getting activity feed for user {user_id}: {e}")
            return self._get_error_response(str(e))
        except Exception as e:
            logger.error(f"Unexpected error getting activity feed for user {user_id}: {e}")
            return self._get_error_response(str(e))

    async def get_document_activities(self, user_id: str, limit: int = 15,
                                    activity_types: Optional[List[str]] = None,
                                    start_date: Optional[datetime] = None,
                                    end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get document-related activities for a specific user

        Args:
            user_id: User ID to get document activities for
            limit: Maximum number of activities to return
            activity_types: Filter by specific activity types
            start_date: Start date for filtering
            end_date: End date for filtering

        Returns:
            List of document activity items
        """
        cache_key = f"document_activities_{user_id}_{limit}"

        # Check cache first
        if not (start_date or end_date or activity_types) and self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Build activity type filter
                type_filter = ""
                if activity_types:
                    doc_types = [t for t in activity_types if t.startswith('document_')]
                    if doc_types:
                        quoted_types = ','.join([f"'{t}'" for t in doc_types])
                        type_filter = f"AND activity_type IN ({quoted_types})"

                # Build date filter
                date_filter = ""
                if start_date:
                    date_filter += f" AND datetime(timestamp) >= datetime('{start_date.isoformat()}')"
                if end_date:
                    date_filter += f" AND datetime(timestamp) <= datetime('{end_date.isoformat()}')"

                # Query document activities
                activities = db.execute(text(f"""
                    SELECT
                        'doc_' || d.id || '_' || strftime('%s', d.updated_at) as activity_id,
                        CASE
                            WHEN d.created_at = d.updated_at THEN 'document_created'
                            WHEN d.status = 'published' THEN 'document_published'
                            ELSE 'document_updated'
                        END as activity_type,
                        d.id as document_id,
                        d.title as document_title,
                        d.document_type,
                        d.created_by as user_id,
                        d.updated_at as timestamp,
                        json_object(
                            'document_type', d.document_type,
                            'status', d.status,
                            'version', COALESCE(d.version, 1)
                        ) as metadata
                    FROM documents d
                    WHERE (d.created_by = :user_id OR d.id IN (
                        SELECT DISTINCT wi.document_id
                        FROM workflow_instances wi
                        JOIN workflow_step_instances wsi ON wsi.workflow_instance_id = wi.id
                        WHERE wsi.assigned_to = :user_id
                    ))
                    {type_filter}
                    {date_filter}
                    ORDER BY d.updated_at DESC
                    LIMIT :limit
                """), {"user_id": user_id, "limit": limit}).fetchall()

                document_activities = []
                for activity in activities:
                    try:
                        metadata = json.loads(activity.metadata) if activity.metadata else {}
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}

                    document_activities.append({
                        'activity_id': activity.activity_id,
                        'activity_type': activity.activity_type,
                        'document_id': activity.document_id,
                        'document_title': activity.document_title,
                        'document_type': activity.document_type,
                        'user_id': activity.user_id,
                        'timestamp': activity.timestamp,
                        'metadata': metadata,
                        'is_private': False  # Document activities are generally visible
                    })

                # Cache the result (only if no filters)
                if not (start_date or end_date or activity_types):
                    self._cache_data(cache_key, document_activities)

                return document_activities

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting document activities for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting document activities for user {user_id}: {e}")
            return []

    async def get_workflow_activities(self, user_id: str, limit: int = 10,
                                    activity_types: Optional[List[str]] = None,
                                    start_date: Optional[datetime] = None,
                                    end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get workflow-related activities for a specific user

        Args:
            user_id: User ID to get workflow activities for
            limit: Maximum number of activities to return
            activity_types: Filter by specific activity types
            start_date: Start date for filtering
            end_date: End date for filtering

        Returns:
            List of workflow activity items
        """
        cache_key = f"workflow_activities_{user_id}_{limit}"

        # Check cache first
        if not (start_date or end_date or activity_types) and self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Build activity type filter
                type_filter = ""
                if activity_types:
                    wf_types = [t for t in activity_types if t.startswith('workflow_')]
                    if wf_types:
                        quoted_types = ','.join([f"'{t}'" for t in wf_types])
                        type_filter = f"AND activity_type IN ({quoted_types})"

                # Build date filter
                date_filter = ""
                if start_date:
                    date_filter += f" AND datetime(timestamp) >= datetime('{start_date.isoformat()}')"
                if end_date:
                    date_filter += f" AND datetime(timestamp) <= datetime('{end_date.isoformat()}')"

                # Query workflow activities
                activities = db.execute(text(f"""
                    SELECT
                        'wf_' || wi.id || '_' || strftime('%s', wi.updated_at) as activity_id,
                        CASE
                            WHEN wi.status = 'completed' THEN 'workflow_completed'
                            WHEN wi.status = 'rejected' THEN 'workflow_rejected'
                            WHEN wi.created_at = wi.updated_at THEN 'workflow_started'
                            ELSE 'workflow_updated'
                        END as activity_type,
                        wi.id as workflow_instance_id,
                        wi.workflow_id,
                        d.title as document_title,
                        d.document_type,
                        wi.initiated_by as user_id,
                        wi.updated_at as timestamp,
                        wsi.step_name,
                        wsi.assigned_to,
                        json_object(
                            'workflow_name', w.name,
                            'status', wi.status,
                            'step_count', (SELECT COUNT(*) FROM workflow_step_instances WHERE workflow_instance_id = wi.id)
                        ) as metadata
                    FROM workflow_instances wi
                    JOIN documents d ON d.id = wi.document_id
                    JOIN workflows w ON w.id = wi.workflow_id
                    LEFT JOIN workflow_step_instances wsi ON wsi.workflow_instance_id = wi.id AND wsi.assigned_to = :user_id
                    WHERE wi.initiated_by = :user_id OR wsi.assigned_to = :user_id
                    {type_filter}
                    {date_filter}
                    ORDER BY wi.updated_at DESC
                    LIMIT :limit
                """), {"user_id": user_id, "limit": limit}).fetchall()

                workflow_activities = []
                for activity in activities:
                    try:
                        metadata = json.loads(activity.metadata) if activity.metadata else {}
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}

                    workflow_activities.append({
                        'activity_id': activity.activity_id,
                        'activity_type': activity.activity_type,
                        'workflow_instance_id': activity.workflow_instance_id,
                        'workflow_id': activity.workflow_id,
                        'document_title': activity.document_title,
                        'document_type': activity.document_type,
                        'user_id': activity.user_id,
                        'timestamp': activity.timestamp,
                        'step_name': activity.step_name,
                        'assigned_to': activity.assigned_to,
                        'metadata': metadata,
                        'is_private': False  # Workflow activities are visible to participants
                    })

                # Cache the result (only if no filters)
                if not (start_date or end_date or activity_types):
                    self._cache_data(cache_key, workflow_activities)

                return workflow_activities

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting workflow activities for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting workflow activities for user {user_id}: {e}")
            return []

    async def get_system_activities(self, user_id: str, limit: int = 5,
                                  activity_types: Optional[List[str]] = None,
                                  start_date: Optional[datetime] = None,
                                  end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get system-related activities for a specific user

        Args:
            user_id: User ID to get system activities for
            limit: Maximum number of activities to return
            activity_types: Filter by specific activity types
            start_date: Start date for filtering
            end_date: End date for filtering

        Returns:
            List of system activity items
        """
        cache_key = f"system_activities_{user_id}_{limit}"

        # Check cache first
        if not (start_date or end_date or activity_types) and self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            db = self.SessionLocal()
            try:
                # Build activity type filter
                type_filter = ""
                if activity_types:
                    sys_types = [t for t in activity_types if not t.startswith(('document_', 'workflow_'))]
                    if sys_types:
                        quoted_types = ','.join([f"'{t}'" for t in sys_types])
                        type_filter = f"AND activity_type IN ({quoted_types})"

                # Build date filter
                date_filter = ""
                if start_date:
                    date_filter += f" AND datetime(timestamp) >= datetime('{start_date.isoformat()}')"
                if end_date:
                    date_filter += f" AND datetime(timestamp) <= datetime('{end_date.isoformat()}')"

                # Query system activities (simulated from user activities)
                activities = db.execute(text(f"""
                    SELECT
                        'sys_' || u.id || '_' || strftime('%s', u.last_login) as activity_id,
                        'user_login' as activity_type,
                        u.id as user_id,
                        u.last_login as timestamp,
                        'User logged in' as description,
                        json_object(
                            'ip_address', 'xxx.xxx.xxx.xxx',
                            'user_agent', 'Browser'
                        ) as metadata
                    FROM users u
                    WHERE u.id = :user_id
                    AND u.last_login IS NOT NULL
                    {type_filter}
                    {date_filter}

                    UNION ALL

                    SELECT
                        'sys_profile_' || u.id || '_' || strftime('%s', u.updated_at) as activity_id,
                        'user_profile_updated' as activity_type,
                        u.id as user_id,
                        u.updated_at as timestamp,
                        'Profile updated' as description,
                        json_object(
                            'fields_updated', 'profile'
                        ) as metadata
                    FROM users u
                    WHERE u.id = :user_id
                    AND u.updated_at != u.created_at
                    {type_filter}
                    {date_filter}

                    ORDER BY timestamp DESC
                    LIMIT :limit
                """), {"user_id": user_id, "limit": limit}).fetchall()

                system_activities = []
                for activity in activities:
                    try:
                        metadata = json.loads(activity.metadata) if activity.metadata else {}
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}

                    system_activities.append({
                        'activity_id': activity.activity_id,
                        'activity_type': activity.activity_type,
                        'user_id': activity.user_id,
                        'timestamp': activity.timestamp,
                        'description': activity.description,
                        'metadata': metadata,
                        'is_private': True  # System activities are private to the user
                    })

                # Cache the result (only if no filters)
                if not (start_date or end_date or activity_types):
                    self._cache_data(cache_key, system_activities)

                return system_activities

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting system activities for user {user_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting system activities for user {user_id}: {e}")
            return []

    def format_activity_item(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format activity item for display

        Args:
            activity: Raw activity data

        Returns:
            Formatted activity item
        """
        activity_type = activity.get('activity_type', 'unknown')

        # Generate display text based on activity type
        display_text = self._generate_display_text(activity)

        # Get icon and color
        icon = self.activity_icons.get(activity_type, '📋')
        color = self.activity_colors.get(activity_type, '#666666')

        formatted = {
            'activity_id': activity.get('activity_id'),
            'activity_type': activity_type,
            'display_text': display_text,
            'timestamp': activity.get('timestamp'),
            'user_id': activity.get('user_id'),
            'icon': icon,
            'color': color,
            'metadata': activity.get('metadata', {}),
            'is_private': activity.get('is_private', False)
        }

        # Add type-specific fields
        if 'document_title' in activity:
            formatted['document_title'] = activity['document_title']
            formatted['document_id'] = activity.get('document_id')

        if 'workflow_instance_id' in activity:
            formatted['workflow_instance_id'] = activity['workflow_instance_id']
            formatted['step_name'] = activity.get('step_name')

        return formatted

    def _generate_display_text(self, activity: Dict[str, Any]) -> str:
        """Generate human-readable display text for activity"""
        activity_type = activity.get('activity_type', 'unknown')

        if activity_type == 'document_created':
            return f"Created document '{activity.get('document_title', 'Untitled')}'"
        elif activity_type == 'document_updated':
            return f"Updated document '{activity.get('document_title', 'Untitled')}'"
        elif activity_type == 'document_published':
            return f"Published document '{activity.get('document_title', 'Untitled')}'"
        elif activity_type == 'workflow_started':
            return f"Started workflow for '{activity.get('document_title', 'Untitled')}'"
        elif activity_type == 'workflow_completed':
            return f"Completed workflow for '{activity.get('document_title', 'Untitled')}'"
        elif activity_type == 'workflow_assigned':
            return f"Assigned to '{activity.get('step_name', 'Unknown Step')}'"
        elif activity_type == 'user_login':
            return "Logged in to the system"
        elif activity_type == 'user_profile_updated':
            return "Updated profile information"
        else:
            return activity.get('description', f"Performed {activity_type}")

    def _aggregate_similar_activities(self, activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Aggregate similar activities together"""
        aggregated = []
        i = 0

        while i < len(activities):
            current = activities[i]
            similar_count = 1

            # Look ahead for similar activities
            j = i + 1
            while j < len(activities) and j < i + 5:  # Look at next 5 activities max
                if (activities[j]['activity_type'] == current['activity_type'] and
                    activities[j]['user_id'] == current['user_id'] and
                    self._activities_similar(current, activities[j])):
                    similar_count += 1
                    j += 1
                else:
                    break

            # Add aggregation info if we found similar activities
            if similar_count > 1:
                current['aggregated_count'] = similar_count
                current['display_text'] = f"{current['display_text']} (and {similar_count - 1} more)"

            aggregated.append(current)
            i = j if similar_count > 1 else i + 1

        return aggregated

    def _activities_similar(self, activity1: Dict[str, Any], activity2: Dict[str, Any]) -> bool:
        """Check if two activities are similar enough to aggregate"""
        # Activities are similar if they're the same type by the same user within 1 hour
        if activity1['activity_type'] != activity2['activity_type']:
            return False

        if activity1['user_id'] != activity2['user_id']:
            return False

        # Check time difference
        try:
            time1 = datetime.fromisoformat(str(activity1['timestamp']).replace('Z', '+00:00').replace('+00:00', ''))
            time2 = datetime.fromisoformat(str(activity2['timestamp']).replace('Z', '+00:00').replace('+00:00', ''))
            time_diff = abs((time1 - time2).total_seconds())
            return time_diff < 3600  # 1 hour
        except (ValueError, TypeError):
            return False

    def _generate_cache_key(self, prefix: str, user_id: str, params: Dict[str, Any]) -> str:
        """Generate cache key from parameters"""
        # Create a hash of the parameters for a consistent cache key
        param_str = json.dumps(params, sort_keys=True, default=str)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
        return f"{prefix}_{user_id}_{param_hash}"

    def _encode_page_token(self, offset: int) -> str:
        """Encode pagination offset as token"""
        import base64
        return base64.b64encode(str(offset).encode()).decode()

    def _decode_page_token(self, token: str) -> int:
        """Decode pagination token to offset"""
        try:
            import base64
            return int(base64.b64decode(token.encode()).decode())
        except (ValueError, TypeError):
            return 0

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False

        cache_entry = self.cache[cache_key]
        # Extract the cache type from the key
        cache_type = cache_key.split('_')[0] if '_' in cache_key else cache_key
        ttl = self.cache_ttl.get(cache_type, 180)
        age = (datetime.utcnow() - cache_entry['timestamp']).total_seconds()

        return age < ttl

    def _cache_data(self, cache_key: str, data: Any) -> None:
        """Cache data with timestamp"""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.utcnow()
        }

    def _get_error_response(self, error: str) -> Dict[str, Any]:
        """Get error response for activity feed"""
        return {
            'user_id': None,
            'activities': [],
            'total_count': 0,
            'has_more': False,
            'next_page_token': None,
            'last_updated': datetime.utcnow().isoformat(),
            'data_source': 'error_fallback',
            'error': error
        }