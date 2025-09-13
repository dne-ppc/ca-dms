"""
Intro Page Response Schemas
Pydantic models for intro page API responses
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class UserStatistics(BaseModel):
    """User statistics section of intro page"""
    user_id: str = Field(..., description="User identifier")
    documents: int = Field(0, description="Number of documents")
    templates: int = Field(0, description="Number of templates")
    recent_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Recent documents")
    document_types: Dict[str, int] = Field(default_factory=dict, description="Document type counts")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")
    message: Optional[str] = Field(None, description="Status or error message")


class SystemOverview(BaseModel):
    """System overview section of intro page"""
    total_users: int = Field(0, description="Total number of users")
    active_documents: int = Field(0, description="Number of active documents")
    documents_today: int = Field(0, description="Documents created today")
    documents_this_week: int = Field(0, description="Documents created this week")
    system_health_score: float = Field(100.0, description="System health score")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")
    message: Optional[str] = Field(None, description="Status or error message")


class ActionableItems(BaseModel):
    """Actionable items section of intro page"""
    user_id: str = Field(..., description="User identifier")
    pending_approvals: int = Field(0, description="Number of pending approvals")
    urgent_tasks: int = Field(0, description="Number of urgent tasks")
    overdue_items: int = Field(0, description="Number of overdue items")
    items: List[Dict[str, Any]] = Field(default_factory=list, description="List of actionable items")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")
    message: Optional[str] = Field(None, description="Status or error message")


class ActivityFeed(BaseModel):
    """Activity feed section of intro page"""
    user_id: str = Field(..., description="User identifier")
    recent_activities: List[str] = Field(default_factory=list, description="Recent activity list")
    activities: List[Dict[str, Any]] = Field(default_factory=list, description="Detailed activity items")
    unread_count: int = Field(0, description="Number of unread activities")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")
    message: Optional[str] = Field(None, description="Status or error message")


class Personalization(BaseModel):
    """Personalization settings section of intro page"""
    theme: str = Field("default", description="User's theme preference")
    dashboard_layout: str = Field("standard", description="Dashboard layout preference")
    notifications: Dict[str, bool] = Field(default_factory=dict, description="Notification preferences")
    widgets: List[str] = Field(default_factory=list, description="Enabled widgets")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")
    message: Optional[str] = Field(None, description="Status or error message")


class PerformanceMetrics(BaseModel):
    """Performance metrics section of intro page"""
    coordination_time_ms: float = Field(..., description="Time taken to coordinate services")
    data_sources: List[str] = Field(default_factory=list, description="Data sources used")
    cache_hit_rate: Optional[float] = Field(None, description="Cache hit rate percentage")
    service_response_times: Dict[str, float] = Field(default_factory=dict, description="Individual service response times")
    request_id: Optional[str] = Field(None, description="Request tracking ID")
    trace_id: Optional[str] = Field(None, description="Distributed tracing ID")
    fallback: Optional[bool] = Field(None, description="Indicates if fallback data is used")


class IntroPageResponse(BaseModel):
    """Complete intro page response model"""
    user_id: str = Field(..., description="User identifier")
    user_statistics: UserStatistics = Field(..., description="User statistics and metrics")
    system_overview: SystemOverview = Field(..., description="System-wide overview and health")
    actionable_items: ActionableItems = Field(..., description="Items requiring user attention")
    activity_feed: ActivityFeed = Field(..., description="Recent user and system activities")
    personalization: Personalization = Field(..., description="User personalization settings")
    performance_metrics: PerformanceMetrics = Field(..., description="Response performance metrics")
    last_updated: str = Field(..., description="ISO timestamp of last data update")
    data_sources: List[str] = Field(default_factory=list, description="Sources used for data assembly")
    fallback_mode: Optional[bool] = Field(None, description="Indicates if operating in fallback mode")
    message: Optional[str] = Field(None, description="Overall status or informational message")

    class Config:
        schema_extra = {
            "example": {
                "user_id": "user-12345",
                "user_statistics": {
                    "user_id": "user-12345",
                    "documents": 42,
                    "templates": 8,
                    "recent_documents": [
                        {
                            "id": "doc-123",
                            "title": "Board Meeting Minutes",
                            "updated_at": "2025-09-12T10:30:00Z"
                        }
                    ],
                    "document_types": {
                        "meeting_minutes": 15,
                        "policies": 12,
                        "notices": 15
                    }
                },
                "system_overview": {
                    "total_users": 150,
                    "active_documents": 1250,
                    "documents_today": 8,
                    "documents_this_week": 45,
                    "system_health_score": 98.5
                },
                "actionable_items": {
                    "user_id": "user-12345",
                    "pending_approvals": 3,
                    "urgent_tasks": 1,
                    "overdue_items": 0,
                    "items": [
                        {
                            "id": "approval-456",
                            "type": "document_approval",
                            "title": "Budget Proposal Review",
                            "due_date": "2025-09-15T17:00:00Z"
                        }
                    ]
                },
                "activity_feed": {
                    "user_id": "user-12345",
                    "recent_activities": [
                        "document_created",
                        "approval_pending",
                        "workflow_completed"
                    ],
                    "activities": [
                        {
                            "id": "activity-789",
                            "type": "document_created",
                            "title": "New policy document created",
                            "timestamp": "2025-09-12T09:15:00Z"
                        }
                    ],
                    "unread_count": 2
                },
                "personalization": {
                    "theme": "dark",
                    "dashboard_layout": "compact",
                    "notifications": {
                        "email": True,
                        "push": False,
                        "in_app": True
                    },
                    "widgets": ["recent_documents", "pending_tasks", "system_health"]
                },
                "performance_metrics": {
                    "coordination_time_ms": 234.5,
                    "data_sources": ["database", "cache", "real-time"],
                    "cache_hit_rate": 85.2,
                    "service_response_times": {
                        "user_stats": 45.2,
                        "system_stats": 67.8,
                        "actionable_items": 89.1,
                        "activity_feed": 32.4
                    },
                    "request_id": "req-abc123",
                    "trace_id": "trace-def456"
                },
                "last_updated": "2025-09-12T10:45:23.123Z",
                "data_sources": ["database", "cache", "real-time"]
            }
        }