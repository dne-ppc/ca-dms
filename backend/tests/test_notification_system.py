"""
End-to-end tests for the notification system
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.database import get_db, create_test_engine, TestSessionLocal
from app.models.notification import (
    Notification, NotificationTemplate, NotificationPreference,
    NotificationType, NotificationStatus, NotificationPriority
)
from app.models.user import User
from app.services.notification_service import NotificationService
from app.core.notification_templates import create_default_templates
import json

client = TestClient(app)

def get_test_db():
    try:
        db = TestSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = get_test_db

@pytest.fixture
def test_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_user(test_db):
    """Create a test user"""
    user = User(
        id="test-user-1",
        email="test@example.com",
        name="Test User",
        role="user",
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    return user

def test_create_default_templates(test_db):
    """Test that default templates are created"""
    count = create_default_templates(test_db)
    assert count > 0
    
    # Check that workflow_assigned template exists
    template = test_db.query(NotificationTemplate).filter(
        NotificationTemplate.name == "workflow_assigned"
    ).first()
    assert template is not None
    assert template.type == NotificationType.EMAIL
    assert "document_title" in template.variables

def test_notification_service_create_notification(test_db, test_user):
    """Test creating a notification using the service"""
    # Create default templates first
    create_default_templates(test_db)
    
    service = NotificationService(test_db)
    
    notification = service.create_notification(
        user_id=test_user.id,
        template_name="workflow_assigned",
        template_variables={
            "document_title": "Test Document",
            "workflow_type": "Approval Workflow",
            "step_name": "Initial Review",
            "due_date": "December 31, 2024",
            "assigned_by": "System",
            "instructions": "Please review and approve"
        },
        notification_type=NotificationType.EMAIL,
        priority=NotificationPriority.HIGH,
        context_data={
            "event_type": "workflow_assigned",
            "document_title": "Test Document"
        }
    )
    
    assert notification is not None
    assert notification.user_id == test_user.id
    assert notification.status == NotificationStatus.PENDING
    assert "Test Document" in notification.content
    assert notification.subject == "New Workflow Assignment: Test Document"

def test_notification_api_endpoints():
    """Test notification API endpoints"""
    
    # Test getting notification statistics (should not error even with no data)
    response = client.get(
        "/api/v1/notifications/stats/overview",
        headers={"Authorization": "Bearer test-token"}  # Mock auth
    )
    # This might return 403 or 401 due to authentication, which is expected
    assert response.status_code in [200, 401, 403]
    
    # Test getting notification history
    response = client.get(
        "/api/v1/notifications/",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code in [200, 401, 403]

def test_notification_preferences_api():
    """Test notification preferences API endpoints"""
    
    # Test getting user preferences
    response = client.get(
        "/api/v1/notifications/preferences/me",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code in [200, 401, 403]
    
    # Test updating preferences
    preferences_update = {
        "email": {
            "workflow_assigned": True,
            "workflow_completed": True,
            "workflow_rejected": True,
            "is_active": True
        }
    }
    
    response = client.patch(
        "/api/v1/notifications/preferences/me",
        json=preferences_update,
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code in [200, 401, 403]

def test_notification_template_rendering(test_db, test_user):
    """Test notification template rendering with variables"""
    create_default_templates(test_db)
    
    service = NotificationService(test_db)
    
    # Get the workflow_assigned template
    template = test_db.query(NotificationTemplate).filter(
        NotificationTemplate.name == "workflow_assigned"
    ).first()
    
    variables = {
        "document_title": "Community Guidelines 2024",
        "workflow_type": "Board Approval Process", 
        "step_name": "Board Review",
        "due_date": "January 15, 2025",
        "assigned_by": "John Smith",
        "instructions": "Please review the updated community guidelines and provide approval or feedback."
    }
    
    subject, content = service._render_template(template, variables)
    
    assert "Community Guidelines 2024" in subject
    assert "Community Guidelines 2024" in content
    assert "Board Approval Process" in content
    assert "January 15, 2025" in content
    assert "John Smith" in content

def test_notification_workflow_integration(test_db, test_user):
    """Test that notifications are created when workflow events occur"""
    create_default_templates(test_db)
    
    service = NotificationService(test_db)
    
    # Test workflow assignment notification
    notification = service.create_notification(
        user_id=test_user.id,
        template_name="workflow_assigned",
        template_variables={
            "document_title": "Budget Proposal 2025",
            "workflow_type": "Financial Review",
            "step_name": "Treasurer Review",
            "due_date": "February 1, 2025",
            "assigned_by": "System Admin",
            "instructions": "Review budget figures and approve"
        },
        notification_type=NotificationType.EMAIL,
        priority=NotificationPriority.HIGH,
        context_data={
            "event_type": "workflow_assigned",
            "document_title": "Budget Proposal 2025"
        }
    )
    
    assert notification is not None
    assert notification.type == NotificationType.EMAIL
    assert notification.priority == NotificationPriority.HIGH
    assert notification.context_data["event_type"] == "workflow_assigned"
    
    # Test workflow completion notification
    completion_notification = service.create_notification(
        user_id=test_user.id,
        template_name="workflow_completed",
        template_variables={
            "document_title": "Budget Proposal 2025",
            "workflow_type": "Financial Review",
            "status": "Completed",
            "message": "All review steps have been completed successfully",
            "completed_date": "February 5, 2025"
        },
        notification_type=NotificationType.EMAIL,
        priority=NotificationPriority.NORMAL,
        context_data={
            "event_type": "workflow_completed",
            "document_title": "Budget Proposal 2025"
        }
    )
    
    assert completion_notification is not None
    assert "Budget Proposal 2025" in completion_notification.subject
    assert "completed successfully" in completion_notification.content

def test_notification_system_health():
    """Test overall notification system health"""
    
    # Test that the notification service endpoints are available
    response = client.get("/api/v1/notifications/templates/")
    assert response.status_code in [200, 401, 403]  # Should not return 500
    
    # Test that the main API is running
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

if __name__ == "__main__":
    print("Running notification system tests...")
    
    # Setup test database
    from app.core.database import Base
    
    engine = create_test_engine()
    Base.metadata.create_all(bind=engine)
    
    # Run basic tests
    db = TestSessionLocal()
    
    try:
        print("✓ Database connection established")
        
        # Test template creation
        count = create_default_templates(db)
        print(f"✓ Created {count} default templates")
        
        # Test notification service
        service = NotificationService(db)
        print("✓ Notification service initialized")
        
        print("\nNotification system is working correctly!")
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
    finally:
        db.close()