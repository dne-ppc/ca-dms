"""
External Integration Models for third-party service connections
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from enum import Enum
import uuid
from datetime import datetime


class IntegrationType(str, Enum):
    """Supported external integration types"""
    SHAREPOINT = "sharepoint"
    ONEDRIVE = "onedrive"
    GOOGLE_DRIVE = "google_drive"
    GOOGLE_WORKSPACE = "google_workspace"
    BOX = "box"
    DROPBOX = "dropbox"


class IntegrationStatus(str, Enum):
    """Integration connection status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    EXPIRED = "expired"
    PENDING = "pending"


class ExternalIntegration(Base):
    """
    External service integration configurations and credentials
    """
    __tablename__ = "external_integrations"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    integration_type = Column(String, nullable=False)  # IntegrationType enum
    name = Column(String, nullable=False)  # User-friendly name
    description = Column(Text)

    # OAuth configuration
    client_id = Column(String)
    client_secret = Column(String)  # Encrypted
    redirect_uri = Column(String)
    scope = Column(String)

    # Token storage (encrypted)
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime)

    # Integration settings
    settings = Column(JSON, default=dict)  # Integration-specific settings
    sync_enabled = Column(Boolean, default=True)
    auto_sync_interval = Column(String, default="24h")  # "15m", "1h", "24h", etc.

    # Status and metadata
    status = Column(String, default=IntegrationStatus.PENDING)
    last_sync_at = Column(DateTime)
    last_error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="integrations")
    sync_logs = relationship("IntegrationSyncLog", back_populates="integration", cascade="all, delete-orphan")


class IntegrationSyncLog(Base):
    """
    Log of synchronization activities for external integrations
    """
    __tablename__ = "integration_sync_logs"

    id = Column(String, primary_key=True)
    integration_id = Column(String, ForeignKey("external_integrations.id"), nullable=False)

    # Sync operation details
    operation = Column(String, nullable=False)  # "upload", "download", "sync", "delete"
    direction = Column(String, nullable=False)  # "to_external", "from_external", "bidirectional"
    document_id = Column(String, ForeignKey("documents.id"))
    external_file_id = Column(String)  # ID in external system
    external_file_path = Column(String)  # Path in external system

    # Results
    status = Column(String, nullable=False)  # "success", "error", "partial"
    files_processed = Column(String, default="0")
    files_succeeded = Column(String, default="0")
    files_failed = Column(String, default="0")
    error_message = Column(Text)

    # Timing
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
    duration_ms = Column(String)

    # Metadata
    sync_metadata = Column(JSON, default=dict)

    # Relationships
    integration = relationship("ExternalIntegration", back_populates="sync_logs")
    document = relationship("Document")


class IntegrationWebhook(Base):
    """
    Webhook configurations for external service notifications
    """
    __tablename__ = "integration_webhooks"

    id = Column(String, primary_key=True)
    integration_id = Column(String, ForeignKey("external_integrations.id"), nullable=False)

    # Webhook configuration
    webhook_url = Column(String, nullable=False)
    secret = Column(String)  # Webhook verification secret
    events = Column(JSON, default=list)  # List of events to listen for

    # Status
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime)
    total_triggers = Column(String, default="0")

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    integration = relationship("ExternalIntegration")


class APIKey(Base):
    """API Key model for external access"""
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    key_value = Column(String(255), nullable=False, unique=True)
    key_prefix = Column(String(10), nullable=False)  # First 8 chars for display
    permissions = Column(JSON, nullable=False, default=list)  # List of allowed endpoints/actions
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0, nullable=False)

    def __repr__(self):
        return f"<APIKey {self.name} ({self.key_prefix}...)>"


class Webhook(Base):
    """Webhook model for external integrations"""
    __tablename__ = "webhooks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    events = Column(JSON, nullable=False, default=list)  # List of events to trigger on
    secret = Column(String(255), nullable=True)  # For webhook signature verification
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_triggered_at = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    timeout_seconds = Column(Integer, default=30, nullable=False)

    def __repr__(self):
        return f"<Webhook {self.name} -> {self.url}>"


class WebhookDelivery(Base):
    """Webhook delivery log for tracking webhook calls"""
    __tablename__ = "webhook_deliveries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    webhook_id = Column(String, nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    delivered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    duration_ms = Column(Integer, nullable=True)  # Response time in milliseconds

    def __repr__(self):
        return f"<WebhookDelivery {self.event_type} -> {self.response_status}>"


class RateLimitRule(Base):
    """Rate limiting rules for API access"""
    __tablename__ = "rate_limit_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    endpoint_pattern = Column(String(500), nullable=False)  # Regex pattern for endpoints
    method = Column(String(10), nullable=True)  # HTTP method (GET, POST, etc.) or NULL for all
    requests_per_minute = Column(Integer, nullable=False, default=60)
    requests_per_hour = Column(Integer, nullable=False, default=1000)
    requests_per_day = Column(Integer, nullable=False, default=10000)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<RateLimitRule {self.name}: {self.requests_per_minute}/min>"


class RateLimitUsage(Base):
    """Rate limit usage tracking"""
    __tablename__ = "rate_limit_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    identifier = Column(String(255), nullable=False)  # IP address, API key, or user ID
    identifier_type = Column(String(50), nullable=False)  # 'ip', 'api_key', or 'user'
    endpoint = Column(String(500), nullable=False)
    method = Column(String(10), nullable=False)
    requests_count = Column(Integer, default=1, nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    window_type = Column(String(20), nullable=False)  # 'minute', 'hour', 'day'

    def __repr__(self):
        return f"<RateLimitUsage {self.identifier}: {self.requests_count} requests>"