"""
Notification schemas for request/response validation
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, validator
from app.models.notification import NotificationType, NotificationStatus, NotificationPriority


# Base schemas

class NotificationTemplateBase(BaseModel):
    name: str
    type: NotificationType
    subject_template: Optional[str] = None
    content_template: str
    variables: Optional[List[str]] = None
    is_active: bool = True


class NotificationTemplateCreate(NotificationTemplateBase):
    pass


class NotificationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject_template: Optional[str] = None
    content_template: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None


class NotificationTemplate(NotificationTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Notification Preference schemas

class NotificationPreferenceBase(BaseModel):
    user_id: str
    notification_type: NotificationType
    workflow_assigned: bool = True
    workflow_completed: bool = True
    workflow_rejected: bool = True
    workflow_escalated: bool = True
    document_shared: bool = True
    document_updated: bool = False
    document_commented: bool = True
    system_maintenance: bool = True
    security_alerts: bool = True
    email_address: Optional[str] = None
    phone_number: Optional[str] = None
    slack_user_id: Optional[str] = None
    teams_user_id: Optional[str] = None
    is_active: bool = True


class NotificationPreferenceCreate(NotificationPreferenceBase):
    pass


class NotificationPreferenceUpdate(BaseModel):
    workflow_assigned: Optional[bool] = None
    workflow_completed: Optional[bool] = None
    workflow_rejected: Optional[bool] = None
    workflow_escalated: Optional[bool] = None
    document_shared: Optional[bool] = None
    document_updated: Optional[bool] = None
    document_commented: Optional[bool] = None
    system_maintenance: Optional[bool] = None
    security_alerts: Optional[bool] = None
    email_address: Optional[str] = None
    phone_number: Optional[str] = None
    slack_user_id: Optional[str] = None
    teams_user_id: Optional[str] = None
    is_active: Optional[bool] = None


class NotificationPreference(NotificationPreferenceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Notification schemas

class NotificationBase(BaseModel):
    user_id: str
    type: NotificationType
    priority: NotificationPriority = NotificationPriority.NORMAL
    subject: Optional[str] = None
    content: str
    recipient: str
    context_data: Optional[Dict[str, Any]] = None
    template_variables: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None


class NotificationCreate(BaseModel):
    user_id: str
    template_name: str
    template_variables: Dict[str, Any]
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    context_data: Optional[Dict[str, Any]] = None


class NotificationUpdate(BaseModel):
    status: Optional[NotificationStatus] = None
    scheduled_at: Optional[datetime] = None
    priority: Optional[NotificationPriority] = None


class Notification(NotificationBase):
    id: int
    template_id: Optional[int] = None
    status: NotificationStatus
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationWithTemplate(Notification):
    template: Optional[NotificationTemplate] = None


# Request/Response schemas

class NotificationSendRequest(BaseModel):
    notification_ids: List[int]


class NotificationSendResponse(BaseModel):
    sent_count: int
    failed_count: int
    errors: List[str] = []


class NotificationStatsResponse(BaseModel):
    total_notifications: int
    pending_notifications: int
    sent_notifications: int
    failed_notifications: int
    delivery_rate: float


class UserNotificationPreferencesUpdate(BaseModel):
    email: Optional[NotificationPreferenceUpdate] = None
    sms: Optional[NotificationPreferenceUpdate] = None
    push: Optional[NotificationPreferenceUpdate] = None
    slack: Optional[NotificationPreferenceUpdate] = None
    teams: Optional[NotificationPreferenceUpdate] = None

    @validator('*', pre=True)
    def parse_notification_type(cls, v):
        """Convert string keys to proper format"""
        if isinstance(v, dict):
            return v
        return v


class UserNotificationPreferencesResponse(BaseModel):
    user_id: str
    preferences: Dict[str, NotificationPreference]


class NotificationHistoryResponse(BaseModel):
    notifications: List[NotificationWithTemplate]
    total: int
    page: int
    per_page: int


# Bulk operations

class BulkNotificationCreate(BaseModel):
    user_ids: List[str]
    template_name: str
    template_variables: Dict[str, Any]
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    context_data: Optional[Dict[str, Any]] = None


class BulkNotificationResponse(BaseModel):
    created_count: int
    failed_count: int
    notification_ids: List[int]
    errors: List[str] = []


# Template testing

class NotificationTemplateTest(BaseModel):
    template_name: str
    template_variables: Dict[str, Any]
    notification_type: NotificationType


class NotificationTemplateTestResponse(BaseModel):
    subject: str
    content: str
    rendered_successfully: bool
    errors: List[str] = []