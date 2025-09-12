from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class NotificationType(enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    SLACK = "slack"
    TEAMS = "teams"


class NotificationStatus(enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NotificationPriority(enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationTemplate(Base):
    """Email and notification templates"""
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    subject_template = Column(String(255))  # For email templates
    content_template = Column(Text, nullable=False)  # HTML/text content
    variables = Column(JSON)  # Available template variables
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    notifications = relationship("Notification", back_populates="template")


class NotificationPreference(Base):
    """User notification preferences"""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    
    # Workflow events
    workflow_assigned = Column(Boolean, default=True)
    workflow_completed = Column(Boolean, default=True)
    workflow_rejected = Column(Boolean, default=True)
    workflow_escalated = Column(Boolean, default=True)
    
    # Document events
    document_shared = Column(Boolean, default=True)
    document_updated = Column(Boolean, default=False)
    document_commented = Column(Boolean, default=True)
    
    # System events
    system_maintenance = Column(Boolean, default=True)
    security_alerts = Column(Boolean, default=True)
    
    # Contact information
    email_address = Column(String(255))  # Override user email
    phone_number = Column(String(20))    # For SMS
    slack_user_id = Column(String(50))   # Slack user ID
    teams_user_id = Column(String(50))   # Teams user ID
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="notification_preferences")


class Notification(Base):
    """Individual notification records"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("notification_templates.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification details
    type = Column(Enum(NotificationType), nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    
    # Content
    subject = Column(String(255))
    content = Column(Text, nullable=False)
    recipient = Column(String(255), nullable=False)  # Email, phone, etc.
    
    # Metadata
    context_data = Column(JSON)  # Document ID, workflow ID, etc.
    template_variables = Column(JSON)  # Variables used in template
    
    # Delivery tracking
    scheduled_at = Column(DateTime)
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    template = relationship("NotificationTemplate", back_populates="notifications")
    user = relationship("User", back_populates="notifications")


class NotificationLog(Base):
    """Audit log for notification events"""
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # created, sent, delivered, failed
    event_data = Column(JSON)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    notification = relationship("Notification")