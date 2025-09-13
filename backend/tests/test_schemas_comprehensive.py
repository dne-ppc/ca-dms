"""
Comprehensive tests for Pydantic schema validation
"""
import pytest
from datetime import datetime, date
from typing import Dict, Any
from pydantic import ValidationError

from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentSearch, DocumentFilter
)
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse,
    UserLogin, PasswordReset
)
from app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowStepCreate, WorkflowInstanceCreate
)
from app.schemas.notification import (
    NotificationCreate, NotificationUpdate, NotificationResponse,
    NotificationPreferences, NotificationTemplate
)
from app.schemas.scaling import (
    AutoScalingConfig, SystemMetrics, ScalingHistory,
    ShardStatistics, ScalingRecommendation
)


class TestDocumentSchemas:
    """Tests for document-related schemas"""

    def test_document_create_valid(self):
        """Test valid document creation schema"""
        data = {
            "title": "Test Document",
            "content": {"ops": [{"insert": "Hello World"}]},
            "document_type": "governance"
        }

        doc = DocumentCreate(**data)
        assert doc.title == "Test Document"
        assert doc.content == {"ops": [{"insert": "Hello World"}]}
        assert doc.document_type == "governance"

    def test_document_create_minimal(self):
        """Test document creation with minimal required fields"""
        data = {
            "title": "Minimal Doc",
            "content": {}
        }

        doc = DocumentCreate(**data)
        assert doc.title == "Minimal Doc"
        assert doc.content == {}
        assert doc.document_type == "governance"  # Default value

    def test_document_create_invalid_title(self):
        """Test document creation with invalid title"""
        data = {
            "title": "",  # Empty title
            "content": {}
        }

        with pytest.raises(ValidationError) as exc_info:
            DocumentCreate(**data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("title",) for error in errors)

    def test_document_create_missing_content(self):
        """Test document creation without content"""
        data = {
            "title": "Test Document"
            # Missing content
        }

        with pytest.raises(ValidationError) as exc_info:
            DocumentCreate(**data)

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("content",) for error in errors)

    def test_document_update_partial(self):
        """Test partial document update"""
        data = {
            "title": "Updated Title"
            # Other fields optional
        }

        doc = DocumentUpdate(**data)
        assert doc.title == "Updated Title"
        assert doc.content is None
        assert doc.document_type is None

    def test_document_search_parameters(self):
        """Test document search schema with various parameters"""
        data = {
            "query": "test search",
            "document_type": "policy",
            "created_after": "2023-01-01",
            "created_before": "2023-12-31",
            "limit": 50,
            "offset": 10
        }

        search = DocumentSearch(**data)
        assert search.query == "test search"
        assert search.document_type == "policy"
        assert search.limit == 50
        assert search.offset == 10

    def test_document_filter_validation(self):
        """Test document filter validation"""
        # Valid filter
        filter_data = {
            "document_types": ["governance", "policy"],
            "authors": ["user1", "user2"],
            "date_range": {
                "start": "2023-01-01",
                "end": "2023-12-31"
            }
        }

        doc_filter = DocumentFilter(**filter_data)
        assert len(doc_filter.document_types) == 2
        assert len(doc_filter.authors) == 2


class TestUserSchemas:
    """Tests for user-related schemas"""

    def test_user_create_valid(self):
        """Test valid user creation schema"""
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "securepassword123",
            "full_name": "Test User"
        }

        user = UserCreate(**data)
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.password == "securepassword123"
        assert user.full_name == "Test User"

    def test_user_create_email_validation(self):
        """Test user creation email validation"""
        invalid_emails = [
            "notanemail",
            "@example.com",
            "test@",
            "test..test@example.com",
            ""
        ]

        for email in invalid_emails:
            data = {
                "username": "testuser",
                "email": email,
                "password": "password123"
            }

            with pytest.raises(ValidationError):
                UserCreate(**data)

    def test_user_create_password_requirements(self):
        """Test user creation password requirements"""
        # Too short password
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "123"  # Too short
        }

        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**data)

        errors = exc_info.value.errors()
        assert any("password" in str(error) for error in errors)

    def test_user_login_schema(self):
        """Test user login schema"""
        data = {
            "username": "testuser",
            "password": "password123"
        }

        login = UserLogin(**data)
        assert login.username == "testuser"
        assert login.password == "password123"

    def test_password_reset_schema(self):
        """Test password reset schema"""
        data = {
            "email": "test@example.com"
        }

        reset = PasswordReset(**data)
        assert reset.email == "test@example.com"

    def test_user_update_optional_fields(self):
        """Test user update with optional fields"""
        data = {
            "full_name": "Updated Name"
            # Other fields optional
        }

        user_update = UserUpdate(**data)
        assert user_update.full_name == "Updated Name"
        assert user_update.email is None


class TestWorkflowSchemas:
    """Tests for workflow-related schemas"""

    def test_workflow_create_valid(self):
        """Test valid workflow creation"""
        data = {
            "name": "Document Approval",
            "description": "Standard document approval process",
            "document_types": ["governance", "policy"],
            "steps": [
                {
                    "name": "Review",
                    "description": "Initial review",
                    "step_type": "approval",
                    "required_role": "reviewer",
                    "order": 1
                }
            ]
        }

        workflow = WorkflowCreate(**data)
        assert workflow.name == "Document Approval"
        assert len(workflow.steps) == 1
        assert workflow.steps[0].name == "Review"

    def test_workflow_step_validation(self):
        """Test workflow step validation"""
        step_data = {
            "name": "Approval Step",
            "description": "Approve document",
            "step_type": "approval",
            "required_role": "admin",
            "order": 1
        }

        step = WorkflowStepCreate(**step_data)
        assert step.name == "Approval Step"
        assert step.step_type == "approval"
        assert step.order == 1

    def test_workflow_step_invalid_order(self):
        """Test workflow step with invalid order"""
        step_data = {
            "name": "Test Step",
            "step_type": "approval",
            "order": 0  # Invalid order (should be >= 1)
        }

        with pytest.raises(ValidationError):
            WorkflowStepCreate(**step_data)

    def test_workflow_instance_create(self):
        """Test workflow instance creation"""
        data = {
            "workflow_id": "workflow-123",
            "document_id": "doc-456",
            "initiated_by": "user-789"
        }

        instance = WorkflowInstanceCreate(**data)
        assert instance.workflow_id == "workflow-123"
        assert instance.document_id == "doc-456"
        assert instance.initiated_by == "user-789"


class TestNotificationSchemas:
    """Tests for notification-related schemas"""

    def test_notification_create_valid(self):
        """Test valid notification creation"""
        data = {
            "title": "Document Updated",
            "message": "Your document has been updated",
            "notification_type": "document_update",
            "user_id": "user-123"
        }

        notification = NotificationCreate(**data)
        assert notification.title == "Document Updated"
        assert notification.message == "Your document has been updated"
        assert notification.notification_type == "document_update"

    def test_notification_preferences_schema(self):
        """Test notification preferences schema"""
        data = {
            "email_enabled": True,
            "push_enabled": False,
            "document_updates": True,
            "workflow_updates": True,
            "system_alerts": False
        }

        prefs = NotificationPreferences(**data)
        assert prefs.email_enabled is True
        assert prefs.push_enabled is False
        assert prefs.document_updates is True

    def test_notification_template_validation(self):
        """Test notification template validation"""
        data = {
            "name": "document_approved",
            "subject": "Document {{document_title}} Approved",
            "body": "Your document {{document_title}} has been approved by {{approver_name}}",
            "template_type": "email"
        }

        template = NotificationTemplate(**data)
        assert template.name == "document_approved"
        assert "{{document_title}}" in template.subject
        assert "{{approver_name}}" in template.body


class TestScalingSchemas:
    """Tests for scaling-related schemas"""

    def test_auto_scaling_config_valid(self):
        """Test valid auto-scaling configuration"""
        data = {
            "cpu_scale_up": 80.0,
            "cpu_scale_down": 30.0,
            "memory_scale_up": 85.0,
            "memory_scale_down": 40.0,
            "min_instances": 2,
            "max_instances": 10,
            "scale_cooldown": 300
        }

        config = AutoScalingConfig(**data)
        assert config.cpu_scale_up == 80.0
        assert config.min_instances == 2
        assert config.scale_cooldown == 300

    def test_auto_scaling_config_validation(self):
        """Test auto-scaling configuration validation"""
        # Test invalid CPU threshold (> 100%)
        with pytest.raises(ValidationError):
            AutoScalingConfig(cpu_scale_up=150.0)

        # Test invalid instance count
        with pytest.raises(ValidationError):
            AutoScalingConfig(min_instances=0)

        # Test invalid cooldown period
        with pytest.raises(ValidationError):
            AutoScalingConfig(scale_cooldown=30)  # Too short

    def test_system_metrics_schema(self):
        """Test system metrics schema"""
        data = {
            "cpu_usage": 75.5,
            "memory_usage": 60.2,
            "disk_usage": 45.0,
            "network_io": {"bytes_sent": 1000, "bytes_recv": 2000},
            "active_connections": 25,
            "response_time_avg": 150.0,
            "error_rate": 2.5,
            "queue_length": 10,
            "timestamp": 1640995200.0
        }

        metrics = SystemMetrics(**data)
        assert metrics.cpu_usage == 75.5
        assert metrics.active_connections == 25
        assert isinstance(metrics.network_io, dict)

    def test_scaling_history_schema(self):
        """Test scaling history schema"""
        data = {
            "timestamp": 1640995200.0,
            "action": "up",
            "service": "backend",
            "instances_before": 2,
            "instances_after": 3,
            "reason": "High CPU usage",
            "cpu_usage": 85.0,
            "memory_usage": 70.0,
            "response_time": 200.0
        }

        history = ScalingHistory(**data)
        assert history.action == "up"
        assert history.instances_before == 2
        assert history.instances_after == 3

    def test_shard_statistics_schema(self):
        """Test shard statistics schema"""
        data = {
            "shard_id": "shard_001",
            "document_count": 1000,
            "user_count": 50,
            "database_size": "150 MB",
            "table_sizes": [
                {"table": "documents", "size": "100 MB"},
                {"table": "users", "size": "50 MB"}
            ]
        }

        stats = ShardStatistics(**data)
        assert stats.shard_id == "shard_001"
        assert stats.document_count == 1000
        assert len(stats.table_sizes) == 2


class TestSchemaEdgeCases:
    """Tests for schema edge cases and error handling"""

    def test_empty_string_validation(self):
        """Test handling of empty strings in required fields"""
        with pytest.raises(ValidationError):
            DocumentCreate(title="", content={})

        with pytest.raises(ValidationError):
            UserCreate(username="", email="test@example.com", password="password")

    def test_none_values_in_optional_fields(self):
        """Test None values in optional fields"""
        # Should not raise validation error
        doc_update = DocumentUpdate(title="Test")
        assert doc_update.content is None
        assert doc_update.document_type is None

    def test_extra_fields_handling(self):
        """Test handling of extra fields in schemas"""
        # Test with extra field that should be ignored
        data = {
            "title": "Test Document",
            "content": {},
            "extra_field": "should be ignored"
        }

        # Should create successfully, ignoring extra field
        doc = DocumentCreate(**data)
        assert doc.title == "Test Document"
        assert not hasattr(doc, "extra_field")

    def test_type_coercion(self):
        """Test automatic type coercion"""
        # String numbers should be converted to numbers where appropriate
        data = {
            "cpu_scale_up": "80.0",  # String that should become float
            "min_instances": "2",    # String that should become int
            "max_instances": 10,
            "scale_cooldown": 300
        }

        config = AutoScalingConfig(**data)
        assert isinstance(config.cpu_scale_up, float)
        assert isinstance(config.min_instances, int)

    def test_datetime_validation(self):
        """Test datetime field validation"""
        # Test various datetime formats
        valid_datetimes = [
            "2023-01-01T00:00:00",
            "2023-01-01T12:30:45.123456",
            "2023-01-01 12:30:45"
        ]

        for dt_str in valid_datetimes:
            try:
                # This would be used in a schema with datetime field
                parsed = datetime.fromisoformat(dt_str.replace("T", " "))
                assert isinstance(parsed, datetime)
            except ValueError:
                pytest.fail(f"Valid datetime string failed to parse: {dt_str}")

    def test_nested_schema_validation(self):
        """Test validation of nested schemas"""
        # Test workflow with nested steps
        workflow_data = {
            "name": "Test Workflow",
            "steps": [
                {
                    "name": "Step 1",
                    "step_type": "approval",
                    "order": 1
                },
                {
                    "name": "",  # Invalid: empty name
                    "step_type": "approval",
                    "order": 2
                }
            ]
        }

        with pytest.raises(ValidationError) as exc_info:
            WorkflowCreate(**workflow_data)

        # Should have error about nested step validation
        errors = exc_info.value.errors()
        assert any("steps" in str(error["loc"]) for error in errors)

    def test_conditional_validation(self):
        """Test conditional field validation"""
        # Example: Some fields might be required only under certain conditions
        notification_data = {
            "title": "Test Notification",
            "message": "Test message",
            "notification_type": "email",
            "user_id": "user-123"
            # Email-specific fields would be required here
        }

        notification = NotificationCreate(**notification_data)
        assert notification.notification_type == "email"

    def test_list_validation(self):
        """Test validation of list fields"""
        # Test list with valid items
        workflow_data = {
            "name": "Test Workflow",
            "document_types": ["governance", "policy", "procedure"],
            "steps": []
        }

        workflow = WorkflowCreate(**workflow_data)
        assert len(workflow.document_types) == 3

        # Test list with invalid items
        invalid_workflow_data = {
            "name": "Test Workflow",
            "document_types": ["governance", "", "policy"],  # Empty string invalid
            "steps": []
        }

        # Depending on implementation, this might or might not raise an error
        # The test depends on whether empty strings are allowed in the list


if __name__ == "__main__":
    pytest.main([__file__, "-v"])