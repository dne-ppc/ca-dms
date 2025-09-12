"""
Notification service for CA-DMS
Handles email, SMS, and integration notifications
"""
import smtplib
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Union
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from jinja2 import Template
import json

from sqlalchemy.orm import Session
from app.models.notification import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationStatus, NotificationType, NotificationPriority, NotificationLog
)
from app.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for handling all notification operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_notification(
        self,
        user_id: Union[str, int],
        template_name: str,
        template_variables: Dict[str, Any],
        notification_type: NotificationType,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        scheduled_at: Optional[datetime] = None,
        context_data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Create a new notification"""
        
        # Get the template
        template = self.db.query(NotificationTemplate).filter(
            NotificationTemplate.name == template_name,
            NotificationTemplate.type == notification_type,
            NotificationTemplate.is_active == True
        ).first()
        
        if not template:
            raise ValueError(f"Template '{template_name}' not found for type {notification_type}")
        
        # Get user and preferences
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        # Check if user has notifications enabled for this type
        if not self._should_send_notification(user_id, notification_type, context_data):
            logger.info(f"Notification skipped for user {user_id} - preferences disabled")
            return None
        
        # Render template content
        subject, content = self._render_template(template, template_variables)
        
        # Determine recipient
        recipient = self._get_recipient_address(user, notification_type)
        
        # Create notification record
        notification = Notification(
            template_id=template.id,
            user_id=user_id,
            type=notification_type,
            priority=priority,
            subject=subject,
            content=content,
            recipient=recipient,
            context_data=context_data,
            template_variables=template_variables,
            scheduled_at=scheduled_at or datetime.utcnow(),
            status=NotificationStatus.PENDING
        )
        
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        
        # Log the creation
        self._log_notification_event(notification.id, "created", {"template": template_name})
        
        return notification
    
    def send_notification(self, notification_id: int) -> bool:
        """Send a specific notification"""
        
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id
        ).first()
        
        if not notification:
            logger.error(f"Notification {notification_id} not found")
            return False
        
        if notification.status != NotificationStatus.PENDING:
            logger.warning(f"Notification {notification_id} is not pending (status: {notification.status})")
            return False
        
        try:
            # Send based on type
            success = False
            if notification.type == NotificationType.EMAIL:
                success = self._send_email(notification)
            elif notification.type == NotificationType.SMS:
                success = self._send_sms(notification)
            elif notification.type == NotificationType.SLACK:
                success = self._send_slack(notification)
            elif notification.type == NotificationType.TEAMS:
                success = self._send_teams(notification)
            else:
                logger.error(f"Unsupported notification type: {notification.type}")
                success = False
            
            # Update notification status
            if success:
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.utcnow()
                self._log_notification_event(notification.id, "sent")
            else:
                notification.status = NotificationStatus.FAILED
                notification.retry_count += 1
                self._log_notification_event(notification.id, "failed", {
                    "retry_count": notification.retry_count
                })
            
            self.db.commit()
            return success
            
        except Exception as e:
            logger.error(f"Error sending notification {notification_id}: {str(e)}")
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(e)
            notification.retry_count += 1
            self.db.commit()
            
            self._log_notification_event(notification.id, "error", {
                "error": str(e),
                "retry_count": notification.retry_count
            })
            
            return False
    
    def send_pending_notifications(self, limit: int = 100) -> int:
        """Send all pending notifications"""
        
        pending_notifications = self.db.query(Notification).filter(
            Notification.status == NotificationStatus.PENDING,
            Notification.scheduled_at <= datetime.utcnow(),
            Notification.retry_count < Notification.max_retries
        ).limit(limit).all()
        
        sent_count = 0
        for notification in pending_notifications:
            if self.send_notification(notification.id):
                sent_count += 1
        
        return sent_count
    
    def _should_send_notification(
        self, 
        user_id: Union[str, int], 
        notification_type: NotificationType,
        context_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if notification should be sent based on user preferences"""
        
        prefs = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
            NotificationPreference.is_active == True
        ).first()
        
        if not prefs:
            # Default to allowing notifications if no preferences set
            return True
        
        # Check specific event preferences based on context
        if context_data:
            event_type = context_data.get("event_type")
            if event_type == "workflow_assigned":
                return prefs.workflow_assigned
            elif event_type == "workflow_completed":
                return prefs.workflow_completed
            elif event_type == "workflow_rejected":
                return prefs.workflow_rejected
            elif event_type == "document_shared":
                return prefs.document_shared
            elif event_type == "document_updated":
                return prefs.document_updated
            # Add more event types as needed
        
        return True
    
    def _get_recipient_address(self, user: User, notification_type: NotificationType) -> str:
        """Get the recipient address based on notification type"""
        
        # Check for custom addresses in preferences
        prefs = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user.id,
            NotificationPreference.notification_type == notification_type
        ).first()
        
        if prefs:
            if notification_type == NotificationType.EMAIL and prefs.email_address:
                return prefs.email_address
            elif notification_type == NotificationType.SMS and prefs.phone_number:
                return prefs.phone_number
            elif notification_type == NotificationType.SLACK and prefs.slack_user_id:
                return prefs.slack_user_id
            elif notification_type == NotificationType.TEAMS and prefs.teams_user_id:
                return prefs.teams_user_id
        
        # Default addresses
        if notification_type == NotificationType.EMAIL:
            return user.email
        elif notification_type == NotificationType.SMS:
            return user.phone or ""
        else:
            return user.email  # Fallback
    
    def _render_template(self, template: NotificationTemplate, variables: Dict[str, Any]) -> tuple[str, str]:
        """Render template with variables"""
        
        try:
            # Render subject (for email)
            subject = ""
            if template.subject_template:
                subject_template = Template(template.subject_template)
                subject = subject_template.render(**variables)
            
            # Render content
            content_template = Template(template.content_template)
            content = content_template.render(**variables)
            
            return subject, content
            
        except Exception as e:
            logger.error(f"Error rendering template {template.name}: {str(e)}")
            raise
    
    def _send_email(self, notification: Notification) -> bool:
        """Send email notification"""
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = notification.subject
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = notification.recipient
            
            # Add content
            if notification.content.startswith('<'):
                # HTML content
                part = MIMEText(notification.content, 'html')
            else:
                # Plain text
                part = MIMEText(notification.content, 'plain')
            
            msg.attach(part)
            
            # Send email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {notification.recipient}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {notification.recipient}: {str(e)}")
            return False
    
    def _send_sms(self, notification: Notification) -> bool:
        """Send SMS notification (placeholder - integrate with SMS service)"""
        # This would integrate with a service like Twilio, AWS SNS, etc.
        logger.info(f"SMS notification would be sent to {notification.recipient}: {notification.content[:50]}...")
        return True  # Simulated success
    
    def _send_slack(self, notification: Notification) -> bool:
        """Send Slack notification (placeholder - integrate with Slack API)"""
        # This would integrate with Slack Web API
        logger.info(f"Slack notification would be sent to {notification.recipient}: {notification.content[:50]}...")
        return True  # Simulated success
    
    def _send_teams(self, notification: Notification) -> bool:
        """Send Teams notification (placeholder - integrate with Teams API)"""
        # This would integrate with Microsoft Teams API
        logger.info(f"Teams notification would be sent to {notification.recipient}: {notification.content[:50]}...")
        return True  # Simulated success
    
    def _log_notification_event(self, notification_id: int, event_type: str, event_data: Optional[Dict] = None):
        """Log notification event"""
        
        log_entry = NotificationLog(
            notification_id=notification_id,
            event_type=event_type,
            event_data=event_data or {}
        )
        
        self.db.add(log_entry)
        self.db.commit()
    
    # Template management methods
    
    def create_template(
        self,
        name: str,
        notification_type: NotificationType,
        content_template: str,
        subject_template: Optional[str] = None,
        variables: Optional[List[str]] = None
    ) -> NotificationTemplate:
        """Create a new notification template"""
        
        template = NotificationTemplate(
            name=name,
            type=notification_type,
            content_template=content_template,
            subject_template=subject_template,
            variables=variables or []
        )
        
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        
        return template
    
    def get_templates(self, notification_type: Optional[NotificationType] = None) -> List[NotificationTemplate]:
        """Get notification templates"""
        
        query = self.db.query(NotificationTemplate).filter(
            NotificationTemplate.is_active == True
        )
        
        if notification_type:
            query = query.filter(NotificationTemplate.type == notification_type)
        
        return query.all()
    
    # User preference management
    
    def update_user_preferences(
        self,
        user_id: Union[str, int],
        preferences: Dict[str, Any]
    ) -> List[NotificationPreference]:
        """Update user notification preferences"""
        
        updated_prefs = []
        
        for notif_type, settings in preferences.items():
            try:
                notification_type = NotificationType(notif_type)
                
                # Get or create preference record
                pref = self.db.query(NotificationPreference).filter(
                    NotificationPreference.user_id == user_id,
                    NotificationPreference.notification_type == notification_type
                ).first()
                
                if not pref:
                    pref = NotificationPreference(
                        user_id=user_id,
                        notification_type=notification_type
                    )
                    self.db.add(pref)
                
                # Update settings
                for setting_name, value in settings.items():
                    if hasattr(pref, setting_name):
                        setattr(pref, setting_name, value)
                
                updated_prefs.append(pref)
                
            except ValueError:
                logger.warning(f"Invalid notification type: {notif_type}")
                continue
        
        self.db.commit()
        return updated_prefs
    
    def get_user_preferences(self, user_id: Union[str, int]) -> List[NotificationPreference]:
        """Get user notification preferences"""
        
        return self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).all()


# Convenience functions for common notification scenarios

def notify_workflow_assignment(
    db: Session,
    user_id: Union[str, int],
    document_title: str,
    workflow_type: str,
    due_date: Optional[datetime] = None,
    assigned_by: str = "System"
) -> Optional[Notification]:
    """Send workflow assignment notification"""
    
    service = NotificationService(db)
    
    return service.create_notification(
        user_id=user_id,
        template_name="workflow_assigned",
        template_variables={
            "document_title": document_title,
            "workflow_type": workflow_type,
            "due_date": due_date.strftime("%B %d, %Y") if due_date else "No due date",
            "assigned_by": assigned_by
        },
        notification_type=NotificationType.EMAIL,
        priority=NotificationPriority.HIGH,
        context_data={
            "event_type": "workflow_assigned",
            "document_title": document_title
        }
    )


def notify_document_shared(
    db: Session,
    user_id: Union[str, int],
    document_title: str,
    shared_by: str,
    access_level: str = "view"
) -> Optional[Notification]:
    """Send document sharing notification"""
    
    service = NotificationService(db)
    
    return service.create_notification(
        user_id=user_id,
        template_name="document_shared",
        template_variables={
            "document_title": document_title,
            "shared_by": shared_by,
            "access_level": access_level
        },
        notification_type=NotificationType.EMAIL,
        context_data={
            "event_type": "document_shared",
            "document_title": document_title
        }
    )