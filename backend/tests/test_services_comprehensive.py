"""
Comprehensive tests for service modules with low coverage
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
import asyncio

from app.services.user_service import UserService
from app.services.notification_service import NotificationService
from app.services.workflow_service import WorkflowService
from app.services.template_service import TemplateService
from app.services.cache_service import cache_service


class TestUserService:
    """Tests for user service functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def user_service(self):
        """User service instance"""
        return UserService()

    def test_create_user_success(self, user_service, mock_db):
        """Test successful user creation"""
        with patch('app.services.user_service.get_password_hash') as mock_hash, \
             patch('app.services.user_service.User') as mock_user_class:

            mock_hash.return_value = "hashed_password"
            mock_user = Mock()
            mock_user.id = "user-123"
            mock_user.email = "test@example.com"
            mock_user_class.return_value = mock_user

            user_data = {
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
                "full_name": "Test User"
            }

            result = user_service.create_user(mock_db, user_data)

            assert result == mock_user
            mock_hash.assert_called_once_with("password123")
            mock_db.add.assert_called_once_with(mock_user)
            mock_db.commit.assert_called_once()

    def test_get_user_by_email_found(self, user_service, mock_db):
        """Test getting user by email when user exists"""
        mock_user = Mock()
        mock_user.email = "test@example.com"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        result = user_service.get_user_by_email(mock_db, "test@example.com")

        assert result == mock_user
        mock_db.query.assert_called_once()

    def test_get_user_by_email_not_found(self, user_service, mock_db):
        """Test getting user by email when user doesn't exist"""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = user_service.get_user_by_email(mock_db, "nonexistent@example.com")

        assert result is None

    def test_authenticate_user_success(self, user_service, mock_db):
        """Test successful user authentication"""
        with patch('app.services.user_service.verify_password') as mock_verify:
            mock_verify.return_value = True
            mock_user = Mock()
            mock_user.hashed_password = "hashed_password"
            mock_user.is_active = True

            # Mock get_user_by_email to return user
            user_service.get_user_by_email = Mock(return_value=mock_user)

            result = user_service.authenticate_user(mock_db, "test@example.com", "password123")

            assert result == mock_user
            mock_verify.assert_called_once_with("password123", "hashed_password")

    def test_authenticate_user_wrong_password(self, user_service, mock_db):
        """Test authentication with wrong password"""
        with patch('app.services.user_service.verify_password') as mock_verify:
            mock_verify.return_value = False
            mock_user = Mock()
            mock_user.hashed_password = "hashed_password"

            user_service.get_user_by_email = Mock(return_value=mock_user)

            result = user_service.authenticate_user(mock_db, "test@example.com", "wrong_password")

            assert result is None

    def test_authenticate_user_inactive(self, user_service, mock_db):
        """Test authentication with inactive user"""
        mock_user = Mock()
        mock_user.is_active = False

        user_service.get_user_by_email = Mock(return_value=mock_user)

        result = user_service.authenticate_user(mock_db, "test@example.com", "password123")

        assert result is None

    def test_update_user_profile(self, user_service, mock_db):
        """Test updating user profile"""
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        update_data = {
            "full_name": "Updated Name",
            "title": "Updated Title"
        }

        result = user_service.update_user_profile(mock_db, "user-123", update_data)

        assert result == mock_user
        assert mock_user.full_name == "Updated Name"
        assert mock_user.title == "Updated Title"
        mock_db.commit.assert_called_once()


class TestNotificationService:
    """Tests for notification service functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def notification_service(self):
        """Notification service instance"""
        return NotificationService()

    @pytest.mark.asyncio
    async def test_send_notification_success(self, notification_service, mock_db):
        """Test successful notification sending"""
        with patch('app.services.notification_service.Notification') as mock_notification_class:
            mock_notification = Mock()
            mock_notification.id = "notif-123"
            mock_notification_class.return_value = mock_notification

            notification_data = {
                "user_id": "user-123",
                "title": "Test Notification",
                "message": "Test message",
                "notification_type": "info"
            }

            result = await notification_service.send_notification(mock_db, notification_data)

            assert result == mock_notification
            mock_db.add.assert_called_once_with(mock_notification)
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_email_notification(self, notification_service):
        """Test sending email notification"""
        with patch('app.services.notification_service.send_email') as mock_send_email:
            mock_send_email.return_value = True

            notification_data = {
                "email": "test@example.com",
                "subject": "Test Subject",
                "body": "Test message body",
                "template_name": "default"
            }

            result = await notification_service.send_email_notification(notification_data)

            assert result is True
            mock_send_email.assert_called_once()

    def test_get_user_notifications(self, notification_service, mock_db):
        """Test getting user notifications"""
        mock_notifications = [Mock(), Mock(), Mock()]
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.offset.return_value.all.return_value = mock_notifications

        result = notification_service.get_user_notifications(mock_db, "user-123", limit=10, offset=0)

        assert result == mock_notifications
        mock_db.query.assert_called_once()

    def test_mark_notification_read(self, notification_service, mock_db):
        """Test marking notification as read"""
        mock_notification = Mock()
        mock_notification.id = "notif-123"
        mock_notification.is_read = False
        mock_db.query.return_value.filter.return_value.first.return_value = mock_notification

        result = notification_service.mark_notification_read(mock_db, "notif-123")

        assert result == mock_notification
        assert mock_notification.is_read is True
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_bulk_send_notifications(self, notification_service, mock_db):
        """Test bulk sending notifications"""
        user_ids = ["user-1", "user-2", "user-3"]
        notification_data = {
            "title": "Bulk Notification",
            "message": "Test bulk message",
            "notification_type": "announcement"
        }

        with patch.object(notification_service, 'send_notification') as mock_send:
            mock_send.return_value = Mock()

            results = await notification_service.bulk_send_notifications(mock_db, user_ids, notification_data)

            assert len(results) == 3
            assert mock_send.call_count == 3


class TestWorkflowService:
    """Tests for workflow service functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def workflow_service(self):
        """Workflow service instance"""
        return WorkflowService()

    def test_create_workflow_success(self, workflow_service, mock_db):
        """Test successful workflow creation"""
        with patch('app.services.workflow_service.Workflow') as mock_workflow_class:
            mock_workflow = Mock()
            mock_workflow.id = "workflow-123"
            mock_workflow_class.return_value = mock_workflow

            workflow_data = {
                "name": "Test Workflow",
                "description": "Test workflow description",
                "document_types": ["governance"]
            }

            result = workflow_service.create_workflow(mock_db, workflow_data)

            assert result == mock_workflow
            mock_db.add.assert_called_once_with(mock_workflow)
            mock_db.commit.assert_called_once()

    def test_get_workflow_by_id(self, workflow_service, mock_db):
        """Test getting workflow by ID"""
        mock_workflow = Mock()
        mock_workflow.id = "workflow-123"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_workflow

        result = workflow_service.get_workflow_by_id(mock_db, "workflow-123")

        assert result == mock_workflow

    def test_start_workflow_instance(self, workflow_service, mock_db):
        """Test starting workflow instance"""
        with patch('app.services.workflow_service.WorkflowInstance') as mock_instance_class:
            mock_instance = Mock()
            mock_instance.id = "instance-123"
            mock_instance_class.return_value = mock_instance

            result = workflow_service.start_workflow_instance(
                mock_db, "workflow-123", "document-456", "user-789"
            )

            assert result == mock_instance
            mock_db.add.assert_called_once_with(mock_instance)
            mock_db.commit.assert_called_once()

    def test_advance_workflow_step(self, workflow_service, mock_db):
        """Test advancing workflow to next step"""
        mock_instance = Mock()
        mock_instance.current_step = 1
        mock_instance.status = "in_progress"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_instance

        result = workflow_service.advance_workflow_step(mock_db, "instance-123", "user-123", "approved")

        assert result == mock_instance
        mock_db.commit.assert_called_once()

    def test_get_user_workflow_tasks(self, workflow_service, mock_db):
        """Test getting user's workflow tasks"""
        mock_tasks = [Mock(), Mock()]
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = mock_tasks

        result = workflow_service.get_user_workflow_tasks(mock_db, "user-123")

        assert result == mock_tasks

    @pytest.mark.asyncio
    async def test_process_workflow_automation(self, workflow_service, mock_db):
        """Test processing workflow automation"""
        mock_instances = [Mock(), Mock()]
        mock_db.query.return_value.filter.return_value.all.return_value = mock_instances

        with patch.object(workflow_service, 'check_automation_conditions') as mock_check:
            mock_check.return_value = True

            await workflow_service.process_workflow_automation(mock_db)

            assert mock_check.call_count == 2


class TestTemplateService:
    """Tests for template service functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def template_service(self):
        """Template service instance"""
        return TemplateService()

    def test_create_template_success(self, template_service, mock_db):
        """Test successful template creation"""
        with patch('app.services.template_service.DocumentTemplate') as mock_template_class:
            mock_template = Mock()
            mock_template.id = "template-123"
            mock_template_class.return_value = mock_template

            template_data = {
                "name": "Test Template",
                "description": "Test template description",
                "category": "governance",
                "content": {"ops": [{"insert": "Template content"}]},
                "created_by": "user-123"
            }

            result = template_service.create_template(mock_db, template_data)

            assert result == mock_template
            mock_db.add.assert_called_once_with(mock_template)
            mock_db.commit.assert_called_once()

    def test_get_template_by_id(self, template_service, mock_db):
        """Test getting template by ID"""
        mock_template = Mock()
        mock_template.id = "template-123"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_template

        result = template_service.get_template_by_id(mock_db, "template-123")

        assert result == mock_template

    def test_search_templates(self, template_service, mock_db):
        """Test searching templates"""
        mock_templates = [Mock(), Mock()]
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.offset.return_value.all.return_value = mock_templates

        result = template_service.search_templates(mock_db, query="test", category="governance")

        assert result == mock_templates

    def test_duplicate_template(self, template_service, mock_db):
        """Test duplicating template"""
        mock_original = Mock()
        mock_original.name = "Original Template"
        mock_original.content = {"ops": [{"insert": "Original content"}]}
        mock_db.query.return_value.filter.return_value.first.return_value = mock_original

        with patch('app.services.template_service.DocumentTemplate') as mock_template_class:
            mock_new_template = Mock()
            mock_template_class.return_value = mock_new_template

            result = template_service.duplicate_template(mock_db, "template-123", "user-456")

            assert result == mock_new_template
            mock_db.add.assert_called_once_with(mock_new_template)
            mock_db.commit.assert_called_once()

    def test_get_template_usage_stats(self, template_service, mock_db):
        """Test getting template usage statistics"""
        mock_stats = {
            "usage_count": 10,
            "last_used": datetime.utcnow(),
            "users_count": 5
        }

        with patch.object(template_service, '_calculate_usage_stats') as mock_calc:
            mock_calc.return_value = mock_stats

            result = template_service.get_template_usage_stats(mock_db, "template-123")

            assert result == mock_stats

    def test_update_template_version(self, template_service, mock_db):
        """Test updating template version"""
        mock_template = Mock()
        mock_template.version = 1
        mock_db.query.return_value.filter.return_value.first.return_value = mock_template

        update_data = {
            "content": {"ops": [{"insert": "Updated content"}]},
            "change_notes": "Updated template content"
        }

        result = template_service.update_template_version(mock_db, "template-123", update_data)

        assert result == mock_template
        assert mock_template.version == 2
        mock_db.commit.assert_called_once()


class TestCacheService:
    """Tests for cache service functionality"""

    @pytest.mark.asyncio
    async def test_cache_get_set(self):
        """Test basic cache get/set operations"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.get.return_value = b'"test_value"'
            mock_redis.set.return_value = True

            # Test set
            await cache_service.set("test_key", "test_value", ttl=3600)
            mock_redis.set.assert_called_once()

            # Test get
            result = await cache_service.get("test_key")
            assert result == "test_value"
            mock_redis.get.assert_called_once_with("test_key")

    @pytest.mark.asyncio
    async def test_cache_delete(self):
        """Test cache delete operation"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.delete.return_value = 1

            result = await cache_service.delete("test_key")
            assert result is True
            mock_redis.delete.assert_called_once_with("test_key")

    @pytest.mark.asyncio
    async def test_cache_exists(self):
        """Test cache key existence check"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.exists.return_value = 1

            result = await cache_service.exists("test_key")
            assert result is True
            mock_redis.exists.assert_called_once_with("test_key")

    @pytest.mark.asyncio
    async def test_cache_clear_pattern(self):
        """Test clearing cache by pattern"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.keys.return_value = [b"user:123", b"user:456"]
            mock_redis.delete.return_value = 2

            result = await cache_service.clear_pattern("user:*")
            assert result == 2
            mock_redis.keys.assert_called_once_with("user:*")
            mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_increment(self):
        """Test cache increment operation"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.incr.return_value = 5

            result = await cache_service.increment("counter_key")
            assert result == 5
            mock_redis.incr.assert_called_once_with("counter_key")

    @pytest.mark.asyncio
    async def test_cache_connection_error_handling(self):
        """Test cache service error handling"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.get.side_effect = ConnectionError("Redis connection failed")

            # Should handle connection errors gracefully
            result = await cache_service.get("test_key")
            assert result is None

    @pytest.mark.asyncio
    async def test_cache_health_check(self):
        """Test cache health check"""
        with patch.object(cache_service, 'redis_client') as mock_redis:
            mock_redis.ping.return_value = True
            mock_redis.info.return_value = {
                "used_memory": 1024,
                "connected_clients": 5
            }

            health = await cache_service.get_health()
            assert health["status"] == "healthy"
            assert health["connected_clients"] == 5


class TestServiceIntegration:
    """Integration tests for service interactions"""

    @pytest.mark.asyncio
    async def test_user_notification_workflow(self):
        """Test integration between user service and notification service"""
        mock_db = Mock()
        user_service = UserService()
        notification_service = NotificationService()

        # Mock user creation
        with patch.object(user_service, 'create_user') as mock_create_user, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            mock_user = Mock()
            mock_user.id = "user-123"
            mock_create_user.return_value = mock_user

            mock_notification = Mock()
            mock_send_notification.return_value = mock_notification

            # Create user
            user = user_service.create_user(mock_db, {
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123"
            })

            # Send welcome notification
            notification = await notification_service.send_notification(mock_db, {
                "user_id": user.id,
                "title": "Welcome!",
                "message": "Welcome to CA-DMS",
                "notification_type": "welcome"
            })

            assert user == mock_user
            assert notification == mock_notification
            mock_create_user.assert_called_once()
            mock_send_notification.assert_called_once()

    @pytest.mark.asyncio
    async def test_workflow_template_integration(self):
        """Test integration between workflow and template services"""
        mock_db = Mock()
        workflow_service = WorkflowService()
        template_service = TemplateService()

        with patch.object(template_service, 'get_template_by_id') as mock_get_template, \
             patch.object(workflow_service, 'start_workflow_instance') as mock_start_workflow:

            mock_template = Mock()
            mock_template.workflow_id = "workflow-123"
            mock_get_template.return_value = mock_template

            mock_instance = Mock()
            mock_start_workflow.return_value = mock_instance

            # Get template and start associated workflow
            template = template_service.get_template_by_id(mock_db, "template-456")
            workflow_instance = workflow_service.start_workflow_instance(
                mock_db, template.workflow_id, "document-789", "user-123"
            )

            assert template == mock_template
            assert workflow_instance == mock_instance
            mock_get_template.assert_called_once_with(mock_db, "template-456")
            mock_start_workflow.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])