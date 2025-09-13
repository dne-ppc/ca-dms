"""
Individual Service Endpoints - GREEN Phase Implementation
Individual API endpoints for each service supporting the intro page system
"""
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import logging

# Import dependencies
try:
    from app.services.user_stats_service import UserStatsService
    from app.services.system_stats_service import SystemStatsService
    from app.services.actionable_items_service import ActionableItemsService
    from app.services.activity_feed_service import ActivityFeedService
    from app.services.personalization_service import PersonalizationService
    from app.core.auth import get_current_user
    from app.core.cache import cache_manager
    from app.schemas.intro_page import UserStatistics, SystemOverview, ActionableItems, ActivityFeed, Personalization
except ImportError:
    # Mock dependencies for development
    class UserStatsService:
        async def get_user_statistics(self, user_id: str):
            return {
                "user_id": user_id,
                "documents": 42,
                "templates": 8,
                "recent_documents": [
                    {"id": "doc-123", "title": "Board Meeting", "updated_at": datetime.now().isoformat()}
                ],
                "document_types": {"meeting_minutes": 15, "policies": 12, "notices": 15}
            }

    class SystemStatsService:
        async def get_system_overview(self):
            return {
                "total_users": 150,
                "active_documents": 1250,
                "documents_today": 8,
                "documents_this_week": 45,
                "total_workflows": 25,
                "system_health_score": 98.5
            }

    class ActionableItemsService:
        async def get_user_actionable_items(self, user_id: str, priority: str = None, limit: int = 10, offset: int = 0):
            items = [
                {
                    "id": "approval-456",
                    "type": "document_approval",
                    "title": "Budget Proposal Review",
                    "priority": "high",
                    "due_date": (datetime.now() + timedelta(days=3)).isoformat()
                }
            ]

            if priority:
                items = [item for item in items if item.get('priority') == priority]

            return {
                "user_id": user_id,
                "pending_approvals": 3,
                "urgent_tasks": 1,
                "overdue_items": 0,
                "items": items[offset:offset+limit],
                "pagination": {
                    "total": len(items),
                    "limit": limit,
                    "offset": offset
                }
            }

    class ActivityFeedService:
        async def get_user_activity_feed(self, user_id: str, since: str = None, limit: int = 10, real_time: bool = False):
            activities = [
                {
                    "id": "activity-789",
                    "type": "document_created",
                    "title": "New policy document created",
                    "timestamp": datetime.now().isoformat()
                }
            ]

            if since:
                filter_date = datetime.fromisoformat(since)
                activities = [a for a in activities if datetime.fromisoformat(a['timestamp']) >= filter_date]

            result = {
                "user_id": user_id,
                "activities": activities[:limit],
                "recent_activities": ["document_created", "approval_pending"],
                "unread_count": 2,
                "last_updated": datetime.now().isoformat()
            }

            if real_time:
                result.update({
                    "real_time": True,
                    "websocket_url": f"/ws/activity-feed/{user_id}"
                })

            return result

    class PersonalizationService:
        async def get_user_personalization(self, user_id: str):
            return {
                "user_id": user_id,
                "theme": "light",
                "dashboard_layout": "standard",
                "notifications": {"email": True, "push": False, "in_app": True},
                "widgets": ["recent_documents", "pending_tasks", "system_health"]
            }

        async def update_user_personalization(self, user_id: str, settings: dict):
            return {
                "user_id": user_id,
                "theme": settings.get("theme", "light"),
                "dashboard_layout": settings.get("dashboard_layout", "standard"),
                "notifications": settings.get("notifications", {}),
                "widgets": settings.get("widgets", []),
                "updated_at": datetime.now().isoformat()
            }

    async def get_current_user(token: str = None):
        return {"user_id": "test-user", "username": "testuser"}

    class CacheManager:
        async def get(self, key: str): return None
        async def set(self, key: str, value: Any, ttl: int = 300): pass

    cache_manager = CacheManager()

    # Mock schema classes
    class UserStatistics(BaseModel):
        user_id: str
        documents: int
        templates: int

    class SystemOverview(BaseModel):
        total_users: int
        active_documents: int

    class ActionableItems(BaseModel):
        user_id: str
        pending_approvals: int

    class ActivityFeed(BaseModel):
        user_id: str
        activities: list

    class Personalization(BaseModel):
        theme: str
        dashboard_layout: str


# Router configuration
router = APIRouter(prefix="/services", tags=["services"])
logger = logging.getLogger(__name__)

# Initialize services
user_stats_service = UserStatsService()
system_stats_service = SystemStatsService()
actionable_items_service = ActionableItemsService()
activity_feed_service = ActivityFeedService()
personalization_service = PersonalizationService()


# Request/Response Models
class PersonalizationUpdate(BaseModel):
    """Model for updating personalization settings"""
    theme: Optional[str] = Field(None, description="User theme preference")
    dashboard_layout: Optional[str] = Field(None, description="Dashboard layout preference")
    notifications: Optional[Dict[str, bool]] = Field(None, description="Notification preferences")
    widgets: Optional[List[str]] = Field(None, description="Enabled widgets")


class HealthStatus(BaseModel):
    """Health status response model"""
    status: str = Field(..., description="Service health status")
    timestamp: str = Field(..., description="Health check timestamp")
    response_time_ms: float = Field(..., description="Health check response time")
    service_name: str = Field(..., description="Name of the service")


# User Statistics Service Endpoints
@router.get(
    "/user-stats/{user_id}",
    summary="Get User Statistics",
    description="Retrieve comprehensive statistics for a specific user",
    response_description="User statistics including documents, templates, and activity metrics"
)
async def get_user_statistics(
    user_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Get user statistics"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Check cache first
        cache_key = f"user_stats:{user_id}"
        cached_data = await cache_manager.get(cache_key)

        if cached_data:
            response.headers["X-Cache-Status"] = "HIT"
        else:
            # Get fresh data
            stats_data = await user_stats_service.get_user_statistics(user_id)
            await cache_manager.set(cache_key, stats_data, ttl=300)
            response.headers["X-Cache-Status"] = "MISS"
            cached_data = stats_data

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        cached_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "user_stats",
            "request_id": request_id
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "user-stats"
        response.headers["Cache-Control"] = "private, max-age=300"

        return cached_data

    except Exception as e:
        logger.error(f"User statistics error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user statistics")


@router.get(
    "/user-stats/health",
    response_model=HealthStatus,
    summary="User Stats Service Health Check"
)
async def user_stats_health() -> HealthStatus:
    """Health check for user statistics service"""

    start_time = time.time()

    try:
        # Test service connectivity
        await user_stats_service.get_user_statistics("health-check-user")

        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="user_stats"
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="user_stats"
        )


# System Statistics Service Endpoints
@router.get(
    "/system-stats",
    summary="Get System Statistics",
    description="Retrieve system-wide statistics and health metrics",
    response_description="System overview including user counts, document metrics, and health scores"
)
async def get_system_statistics(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Get system statistics"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Check cache first (system stats can be cached longer)
        cache_key = "system_stats"
        cached_data = await cache_manager.get(cache_key)

        if cached_data:
            response.headers["X-Cache-Status"] = "HIT"
        else:
            # Get fresh data
            stats_data = await system_stats_service.get_system_overview()
            await cache_manager.set(cache_key, stats_data, ttl=600)  # 10 minutes
            response.headers["X-Cache-Status"] = "MISS"
            cached_data = stats_data

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        cached_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "system_stats",
            "request_id": request_id
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "system-stats"
        response.headers["Cache-Control"] = "public, max-age=600"
        response.headers["ETag"] = f'"{hash(str(cached_data))}"'

        return cached_data

    except Exception as e:
        logger.error(f"System statistics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system statistics")


@router.get(
    "/system-stats/health",
    response_model=HealthStatus,
    summary="System Stats Service Health Check"
)
async def system_stats_health() -> HealthStatus:
    """Health check for system statistics service"""

    start_time = time.time()

    try:
        # Test service connectivity
        await system_stats_service.get_system_overview()

        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="system_stats"
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="system_stats"
        )


# Actionable Items Service Endpoints
@router.get(
    "/actionable-items/{user_id}",
    summary="Get Actionable Items",
    description="Retrieve actionable items requiring user attention",
    response_description="List of pending approvals, tasks, and items requiring action"
)
async def get_actionable_items(
    user_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    priority: Optional[str] = Query(None, description="Filter by priority (low, medium, high, urgent)"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Get actionable items for a user"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Check cache (shorter TTL for actionable items)
        cache_key = f"actionable_items:{user_id}:{priority}:{limit}:{offset}"
        cached_data = await cache_manager.get(cache_key)

        if cached_data:
            response.headers["X-Cache-Status"] = "HIT"
        else:
            # Get fresh data
            items_data = await actionable_items_service.get_user_actionable_items(
                user_id, priority=priority, limit=limit, offset=offset
            )
            await cache_manager.set(cache_key, items_data, ttl=120)  # 2 minutes
            response.headers["X-Cache-Status"] = "MISS"
            cached_data = items_data

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        cached_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "actionable_items",
            "request_id": request_id
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "actionable-items"
        response.headers["Cache-Control"] = "private, max-age=120"

        return cached_data

    except Exception as e:
        logger.error(f"Actionable items error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve actionable items")


@router.get(
    "/actionable-items/health",
    response_model=HealthStatus,
    summary="Actionable Items Service Health Check"
)
async def actionable_items_health() -> HealthStatus:
    """Health check for actionable items service"""

    start_time = time.time()

    try:
        # Test service connectivity
        await actionable_items_service.get_user_actionable_items("health-check-user")

        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="actionable_items"
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="actionable_items"
        )


# Activity Feed Service Endpoints
@router.get(
    "/activity-feed/{user_id}",
    summary="Get Activity Feed",
    description="Retrieve user activity feed with recent activities and updates",
    response_description="Activity feed with recent activities, notifications, and real-time capabilities"
)
async def get_activity_feed(
    user_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    since: Optional[str] = Query(None, description="Filter activities since this timestamp (ISO format)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of activities to return"),
    real_time: bool = Query(False, description="Enable real-time updates"),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Get activity feed for a user"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Check cache (very short TTL for activity feed)
        cache_key = f"activity_feed:{user_id}:{since}:{limit}:{real_time}"
        cached_data = await cache_manager.get(cache_key)

        if cached_data and not real_time:
            response.headers["X-Cache-Status"] = "HIT"
        else:
            # Get fresh data
            feed_data = await activity_feed_service.get_user_activity_feed(
                user_id, since=since, limit=limit, real_time=real_time
            )

            if not real_time:
                await cache_manager.set(cache_key, feed_data, ttl=60)  # 1 minute
                response.headers["X-Cache-Status"] = "MISS"
            else:
                response.headers["X-Cache-Status"] = "BYPASS"

            cached_data = feed_data

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        cached_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "activity_feed",
            "request_id": request_id
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "activity-feed"

        if real_time:
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "private, max-age=60"

        return cached_data

    except Exception as e:
        logger.error(f"Activity feed error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity feed")


@router.get(
    "/activity-feed/health",
    response_model=HealthStatus,
    summary="Activity Feed Service Health Check"
)
async def activity_feed_health() -> HealthStatus:
    """Health check for activity feed service"""

    start_time = time.time()

    try:
        # Test service connectivity
        await activity_feed_service.get_user_activity_feed("health-check-user")

        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="activity_feed"
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="activity_feed"
        )


# Personalization Service Endpoints
@router.get(
    "/personalization/{user_id}",
    summary="Get Personalization Settings",
    description="Retrieve user personalization settings and preferences",
    response_description="User personalization including theme, layout, notifications, and widget preferences"
)
async def get_personalization(
    user_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Get user personalization settings"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Check cache
        cache_key = f"personalization:{user_id}"
        cached_data = await cache_manager.get(cache_key)

        if cached_data:
            response.headers["X-Cache-Status"] = "HIT"
        else:
            # Get fresh data
            personalization_data = await personalization_service.get_user_personalization(user_id)
            await cache_manager.set(cache_key, personalization_data, ttl=900)  # 15 minutes
            response.headers["X-Cache-Status"] = "MISS"
            cached_data = personalization_data

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        cached_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "personalization",
            "request_id": request_id
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "personalization"
        response.headers["Cache-Control"] = "private, max-age=900"

        return cached_data

    except Exception as e:
        logger.error(f"Personalization error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve personalization settings")


@router.put(
    "/personalization/{user_id}",
    summary="Update Personalization Settings",
    description="Update user personalization settings and preferences",
    response_description="Updated personalization settings"
)
async def update_personalization(
    user_id: str,
    settings: PersonalizationUpdate,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
) -> Dict[str, Any]:
    """Update user personalization settings"""

    start_time = time.time()
    request_id = x_request_id or str(uuid.uuid4())

    try:
        # Update settings
        updated_data = await personalization_service.update_user_personalization(
            user_id, settings.dict(exclude_none=True)
        )

        # Invalidate cache
        cache_key = f"personalization:{user_id}"
        await cache_manager.set(cache_key, updated_data, ttl=900)

        # Add performance metrics
        response_time = (time.time() - start_time) * 1000
        updated_data["performance_metrics"] = {
            "response_time_ms": response_time,
            "service_name": "personalization",
            "request_id": request_id,
            "operation": "update"
        }

        # Set headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service-Name"] = "personalization"
        response.headers["Cache-Control"] = "no-cache"

        return updated_data

    except Exception as e:
        logger.error(f"Personalization update error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update personalization settings")


@router.get(
    "/personalization/health",
    response_model=HealthStatus,
    summary="Personalization Service Health Check"
)
async def personalization_health() -> HealthStatus:
    """Health check for personalization service"""

    start_time = time.time()

    try:
        # Test service connectivity
        await personalization_service.get_user_personalization("health-check-user")

        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="personalization"
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000

        return HealthStatus(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            response_time_ms=response_time,
            service_name="personalization"
        )