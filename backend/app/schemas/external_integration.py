"""
Pydantic schemas for external integration API requests and responses
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from app.models.external_integration import IntegrationType, IntegrationStatus


# Base schemas
class ExternalIntegrationBase(BaseModel):
    """Base schema for external integrations"""
    integration_type: IntegrationType
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sync_enabled: bool = True
    auto_sync_interval: str = Field(default="24h", pattern=r"^\d+[mhd]$")


class ExternalIntegrationCreate(ExternalIntegrationBase):
    """Schema for creating external integrations"""
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)
    redirect_uri: str = Field(..., min_length=1)
    scope: str = Field(..., min_length=1)
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ExternalIntegrationUpdate(BaseModel):
    """Schema for updating external integrations"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    sync_enabled: Optional[bool] = None
    auto_sync_interval: Optional[str] = Field(None, pattern=r"^\d+[mhd]$")
    settings: Optional[Dict[str, Any]] = None


class ExternalIntegrationResponse(ExternalIntegrationBase):
    """Schema for external integration responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    status: IntegrationStatus
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Exclude sensitive fields
    redirect_uri: str
    scope: str
    settings: Dict[str, Any]


class ExternalIntegrationListResponse(BaseModel):
    """Schema for paginated integration list"""
    integrations: List[ExternalIntegrationResponse]
    total: int
    page: int
    size: int
    has_next: bool
    has_prev: bool


# OAuth Flow schemas
class OAuthAuthorizationRequest(BaseModel):
    """Schema for OAuth authorization request"""
    integration_type: IntegrationType
    client_id: str
    redirect_uri: str
    scope: str
    state: Optional[str] = None


class OAuthAuthorizationResponse(BaseModel):
    """Schema for OAuth authorization response"""
    authorization_url: str
    state: str


class OAuthTokenExchange(BaseModel):
    """Schema for OAuth token exchange"""
    integration_id: str
    authorization_code: str
    state: str


class OAuthTokenResponse(BaseModel):
    """Schema for OAuth token response"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "Bearer"


# Sync operation schemas
class SyncOperationRequest(BaseModel):
    """Schema for sync operation requests"""
    operation: str = Field(..., pattern=r"^(upload|download|sync|delete)$")
    document_ids: Optional[List[str]] = None
    external_paths: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SyncOperationResponse(BaseModel):
    """Schema for sync operation responses"""
    operation_id: str
    status: str
    message: str
    files_queued: int


class IntegrationSyncLogResponse(BaseModel):
    """Schema for sync log responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str
    operation: str
    direction: str
    document_id: Optional[str] = None
    external_file_id: Optional[str] = None
    external_file_path: Optional[str] = None
    status: str
    files_processed: int
    files_succeeded: int
    files_failed: int
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    metadata: Dict[str, Any]


class IntegrationSyncLogListResponse(BaseModel):
    """Schema for paginated sync log list"""
    logs: List[IntegrationSyncLogResponse]
    total: int
    page: int
    size: int
    has_next: bool
    has_prev: bool


# File operation schemas
class ExternalFileInfo(BaseModel):
    """Schema for external file information"""
    id: str
    name: str
    path: str
    size: Optional[int] = None
    modified_at: Optional[datetime] = None
    mime_type: Optional[str] = None
    download_url: Optional[str] = None
    is_folder: bool = False
    parent_id: Optional[str] = None


class ExternalFileListResponse(BaseModel):
    """Schema for external file list"""
    files: List[ExternalFileInfo]
    total: int
    has_next: bool
    next_token: Optional[str] = None


class FileUploadRequest(BaseModel):
    """Schema for file upload requests"""
    document_id: str
    destination_path: str
    overwrite: bool = False
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class FileDownloadRequest(BaseModel):
    """Schema for file download requests"""
    external_file_id: str
    destination_document_id: Optional[str] = None
    create_new_document: bool = True


# Webhook schemas
class IntegrationWebhookCreate(BaseModel):
    """Schema for creating integration webhooks"""
    webhook_url: str = Field(..., min_length=1)
    secret: Optional[str] = None
    events: List[str] = Field(default_factory=list)


class IntegrationWebhookResponse(BaseModel):
    """Schema for webhook responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str
    webhook_url: str
    events: List[str]
    is_active: bool
    last_triggered_at: Optional[datetime] = None
    total_triggers: int
    created_at: datetime
    updated_at: datetime


# Status and health schemas
class IntegrationStatusResponse(BaseModel):
    """Schema for integration status responses"""
    integration_id: str
    status: IntegrationStatus
    is_connected: bool
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    sync_stats: Dict[str, Any]


class IntegrationHealthResponse(BaseModel):
    """Schema for integration health check responses"""
    integration_id: str
    integration_type: IntegrationType
    name: str
    is_healthy: bool
    status: IntegrationStatus
    last_check: datetime
    issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


# Bulk operation schemas
class BulkSyncRequest(BaseModel):
    """Schema for bulk sync requests"""
    integration_ids: List[str]
    operation: str = Field(..., pattern=r"^(sync|health_check|refresh_tokens)$")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class BulkSyncResponse(BaseModel):
    """Schema for bulk sync responses"""
    operation_id: str
    integration_count: int
    status: str
    results: List[Dict[str, Any]] = Field(default_factory=list)


# API Key schemas
class APIKeyCreate(BaseModel):
    """Schema for creating API keys"""
    name: str = Field(..., min_length=1, max_length=255)
    permissions: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    """Schema for API key responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    key_prefix: str
    permissions: List[str]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    usage_count: int


class APIKeyUpdate(BaseModel):
    """Schema for updating API keys"""
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None


# Webhook schemas
class WebhookCreate(BaseModel):
    """Schema for creating webhooks"""
    name: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl
    events: List[str] = Field(..., min_items=1)
    secret: Optional[str] = None
    timeout_seconds: int = Field(default=30, ge=5, le=120)


class WebhookResponse(BaseModel):
    """Schema for webhook responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    url: str
    events: List[str]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    success_count: int
    failure_count: int
    timeout_seconds: int


class WebhookUpdate(BaseModel):
    """Schema for updating webhooks"""
    name: Optional[str] = None
    url: Optional[HttpUrl] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    is_active: Optional[bool] = None
    timeout_seconds: Optional[int] = Field(None, ge=5, le=120)


class WebhookDeliveryResponse(BaseModel):
    """Schema for webhook delivery log responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    webhook_id: str
    event_type: str
    payload: Dict[str, Any]
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    error_message: Optional[str] = None
    delivered_at: datetime
    duration_ms: Optional[int] = None


# Rate Limiting schemas
class RateLimitRuleCreate(BaseModel):
    """Schema for creating rate limit rules"""
    name: str = Field(..., min_length=1, max_length=255)
    endpoint_pattern: str = Field(..., min_length=1, max_length=500)
    method: Optional[str] = None
    requests_per_minute: int = Field(default=60, ge=1, le=10000)
    requests_per_hour: int = Field(default=1000, ge=1, le=100000)
    requests_per_day: int = Field(default=10000, ge=1, le=1000000)


class RateLimitRuleResponse(BaseModel):
    """Schema for rate limit rule responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    endpoint_pattern: str
    method: Optional[str] = None
    requests_per_minute: int
    requests_per_hour: int
    requests_per_day: int
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class RateLimitRuleUpdate(BaseModel):
    """Schema for updating rate limit rules"""
    name: Optional[str] = None
    endpoint_pattern: Optional[str] = None
    method: Optional[str] = None
    requests_per_minute: Optional[int] = Field(None, ge=1, le=10000)
    requests_per_hour: Optional[int] = Field(None, ge=1, le=100000)
    requests_per_day: Optional[int] = Field(None, ge=1, le=1000000)
    is_active: Optional[bool] = None


class RateLimitUsageResponse(BaseModel):
    """Schema for rate limit usage responses"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    identifier: str
    identifier_type: str
    endpoint: str
    method: str
    requests_count: int
    window_start: datetime
    window_end: datetime
    window_type: str


class WebhookEventPayload(BaseModel):
    """Schema for webhook event payloads"""
    event_type: str
    timestamp: datetime
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


# Available webhook events
WEBHOOK_EVENTS = [
    "document.created",
    "document.updated",
    "document.deleted",
    "document.approved",
    "document.rejected",
    "workflow.started",
    "workflow.completed",
    "workflow.step_completed",
    "template.created",
    "template.updated",
    "user.created",
    "user.updated"
]


# Available API permissions
API_PERMISSIONS = [
    "documents:read",
    "documents:write",
    "documents:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "workflows:read",
    "workflows:write",
    "workflows:delete",
    "users:read",
    "users:write",
    "webhooks:read",
    "webhooks:write",
    "api_keys:read",
    "api_keys:write",
    "analytics:read",
    "admin:all"
]