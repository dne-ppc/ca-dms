"""
Notification management endpoints
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.notification import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationStatus, NotificationType, NotificationPriority
)
from app.schemas.notification import (
    NotificationCreate, NotificationUpdate, Notification as NotificationSchema,
    NotificationWithTemplate, NotificationSendRequest, NotificationSendResponse,
    NotificationStatsResponse, NotificationHistoryResponse,
    NotificationTemplate as NotificationTemplateSchema,
    NotificationTemplateCreate, NotificationTemplateUpdate,
    NotificationPreference as NotificationPreferenceSchema,
    NotificationPreferenceUpdate, UserNotificationPreferencesUpdate,
    UserNotificationPreferencesResponse, BulkNotificationCreate,
    BulkNotificationResponse, NotificationTemplateTest,
    NotificationTemplateTestResponse
)
from app.services.notification_service import NotificationService

router = APIRouter()


# Notification CRUD operations

@router.post("/", response_model=NotificationSchema)
def create_notification(
    notification_data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new notification"""
    
    # Check if current user can create notifications for the target user
    if not current_user.has_permission("create") and notification_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    
    try:
        notification = service.create_notification(
            user_id=notification_data.user_id,
            template_name=notification_data.template_name,
            template_variables=notification_data.template_variables,
            notification_type=notification_data.notification_type,
            priority=notification_data.priority,
            scheduled_at=notification_data.scheduled_at,
            context_data=notification_data.context_data
        )
        
        if not notification:
            raise HTTPException(status_code=400, detail="Notification not created (user preferences disabled)")
        
        return notification
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating notification: {str(e)}")


@router.get("/", response_model=NotificationHistoryResponse)
def get_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[NotificationStatus] = None,
    notification_type: Optional[NotificationType] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications with filtering and pagination"""
    
    # Build query
    query = db.query(Notification)
    
    # Apply filters based on user permissions
    if not current_user.has_permission("read"):
        query = query.filter(Notification.user_id == current_user.id)
    elif user_id:
        query = query.filter(Notification.user_id == user_id)
    
    if status:
        query = query.filter(Notification.status == status)
    
    if notification_type:
        query = query.filter(Notification.type == notification_type)
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    notifications = query.order_by(desc(Notification.created_at)).offset(
        (page - 1) * per_page
    ).limit(per_page).all()
    
    return NotificationHistoryResponse(
        notifications=notifications,
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/{notification_id}", response_model=NotificationWithTemplate)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific notification"""
    
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check permissions
    if not current_user.has_permission("read") and notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    return notification


@router.patch("/{notification_id}", response_model=NotificationSchema)
def update_notification(
    notification_id: int,
    notification_update: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a notification"""
    
    if not current_user.has_permission("update"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Update fields
    update_data = notification_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notification, field, value)
    
    notification.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(notification)
    
    return notification


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    
    if not current_user.has_permission("delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted successfully"}


# Notification sending operations

@router.post("/send", response_model=NotificationSendResponse)
def send_notifications(
    send_request: NotificationSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send specific notifications"""
    
    if not current_user.has_permission("update"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    sent_count = 0
    failed_count = 0
    errors = []
    
    for notification_id in send_request.notification_ids:
        try:
            if service.send_notification(notification_id):
                sent_count += 1
            else:
                failed_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"Notification {notification_id}: {str(e)}")
    
    return NotificationSendResponse(
        sent_count=sent_count,
        failed_count=failed_count,
        errors=errors
    )


@router.post("/send-pending", response_model=NotificationSendResponse)
def send_pending_notifications(
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send all pending notifications"""
    
    if not current_user.has_permission("update"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    
    try:
        sent_count = service.send_pending_notifications(limit)
        
        return NotificationSendResponse(
            sent_count=sent_count,
            failed_count=0,
            errors=[]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending notifications: {str(e)}")


# Bulk operations

@router.post("/bulk", response_model=BulkNotificationResponse)
def create_bulk_notifications(
    bulk_data: BulkNotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create notifications for multiple users"""
    
    if not current_user.has_permission("create"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    created_count = 0
    failed_count = 0
    notification_ids = []
    errors = []
    
    for user_id in bulk_data.user_ids:
        try:
            notification = service.create_notification(
                user_id=user_id,
                template_name=bulk_data.template_name,
                template_variables=bulk_data.template_variables,
                notification_type=bulk_data.notification_type,
                priority=bulk_data.priority,
                scheduled_at=bulk_data.scheduled_at,
                context_data=bulk_data.context_data
            )
            
            if notification:
                created_count += 1
                notification_ids.append(notification.id)
            else:
                failed_count += 1
                
        except Exception as e:
            failed_count += 1
            errors.append(f"User {user_id}: {str(e)}")
    
    return BulkNotificationResponse(
        created_count=created_count,
        failed_count=failed_count,
        notification_ids=notification_ids,
        errors=errors
    )


# Statistics

@router.get("/stats/overview", response_model=NotificationStatsResponse)
def get_notification_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notification statistics"""
    
    if not current_user.has_permission("read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Date filter
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Build base query
    query = db.query(Notification).filter(Notification.created_at >= start_date)
    
    # Get counts
    total_notifications = query.count()
    pending_notifications = query.filter(Notification.status == NotificationStatus.PENDING).count()
    sent_notifications = query.filter(Notification.status == NotificationStatus.SENT).count()
    failed_notifications = query.filter(Notification.status == NotificationStatus.FAILED).count()
    
    # Calculate delivery rate
    delivery_rate = 0.0
    if total_notifications > 0:
        delivery_rate = (sent_notifications / total_notifications) * 100
    
    return NotificationStatsResponse(
        total_notifications=total_notifications,
        pending_notifications=pending_notifications,
        sent_notifications=sent_notifications,
        failed_notifications=failed_notifications,
        delivery_rate=round(delivery_rate, 2)
    )


# User preferences

@router.get("/preferences/me", response_model=UserNotificationPreferencesResponse)
def get_my_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's notification preferences"""
    
    service = NotificationService(db)
    preferences = service.get_user_preferences(current_user.id)
    
    # Group preferences by type
    pref_dict = {}
    for pref in preferences:
        pref_dict[pref.notification_type.value] = pref
    
    return UserNotificationPreferencesResponse(
        user_id=current_user.id,
        preferences=pref_dict
    )


@router.patch("/preferences/me", response_model=UserNotificationPreferencesResponse)
def update_my_notification_preferences(
    preferences_update: UserNotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's notification preferences"""
    
    service = NotificationService(db)
    
    # Convert to service format
    prefs_data = {}
    update_dict = preferences_update.dict(exclude_unset=True)
    
    for notif_type, settings in update_dict.items():
        if settings is not None:
            prefs_data[notif_type] = settings.dict(exclude_unset=True)
    
    try:
        updated_prefs = service.update_user_preferences(current_user.id, prefs_data)
        
        # Return updated preferences
        all_preferences = service.get_user_preferences(current_user.id)
        pref_dict = {}
        for pref in all_preferences:
            pref_dict[pref.notification_type.value] = pref
        
        return UserNotificationPreferencesResponse(
            user_id=current_user.id,
            preferences=pref_dict
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating preferences: {str(e)}")


# Template management (admin only)

@router.get("/templates/", response_model=List[NotificationTemplateSchema])
def get_notification_templates(
    notification_type: Optional[NotificationType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notification templates"""
    
    if not current_user.has_permission("read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    templates = service.get_templates(notification_type)
    
    return templates


@router.post("/templates/", response_model=NotificationTemplateSchema)
def create_notification_template(
    template_data: NotificationTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a notification template"""
    
    if not current_user.has_permission("create"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    
    try:
        template = service.create_template(
            name=template_data.name,
            notification_type=template_data.type,
            content_template=template_data.content_template,
            subject_template=template_data.subject_template,
            variables=template_data.variables
        )
        
        return template
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating template: {str(e)}")


@router.post("/templates/test", response_model=NotificationTemplateTestResponse)
def test_notification_template(
    test_data: NotificationTemplateTest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test a notification template with sample data"""
    
    if not current_user.has_permission("read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = NotificationService(db)
    
    try:
        # Get template
        template = db.query(NotificationTemplate).filter(
            NotificationTemplate.name == test_data.template_name,
            NotificationTemplate.type == test_data.notification_type
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Render template
        subject, content = service._render_template(template, test_data.template_variables)
        
        return NotificationTemplateTestResponse(
            subject=subject,
            content=content,
            rendered_successfully=True,
            errors=[]
        )
        
    except Exception as e:
        return NotificationTemplateTestResponse(
            subject="",
            content="",
            rendered_successfully=False,
            errors=[str(e)]
        )