"""
Integration tests for critical workflows in CA-DMS
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import asyncio
import json


class TestDocumentLifecycleWorkflow:
    """Integration tests for complete document lifecycle"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def mock_user(self):
        """Mock authenticated user"""
        user = Mock()
        user.id = "user-123"
        user.email = "test@example.com"
        user.role = "board_member"
        user.is_active = True
        return user

    @pytest.mark.asyncio
    async def test_complete_document_creation_workflow(self, mock_db, mock_user):
        """Test complete document creation workflow"""
        from app.services.document_service import DocumentService
        from app.services.workflow_service import WorkflowService
        from app.services.notification_service import NotificationService
        from app.services.cache_service import cache_service

        document_service = DocumentService()
        workflow_service = WorkflowService()
        notification_service = NotificationService()

        # Mock document creation
        with patch.object(document_service, 'create_document') as mock_create_doc, \
             patch.object(workflow_service, 'start_workflow_instance') as mock_start_workflow, \
             patch.object(notification_service, 'send_notification') as mock_send_notification, \
             patch.object(cache_service, 'delete') as mock_cache_delete:

            mock_document = Mock()
            mock_document.id = "doc-123"
            mock_document.title = "Test Document"
            mock_document.document_type = "governance"
            mock_create_doc.return_value = mock_document

            mock_workflow_instance = Mock()
            mock_workflow_instance.id = "workflow-instance-456"
            mock_start_workflow.return_value = mock_workflow_instance

            mock_notification = Mock()
            mock_send_notification.return_value = mock_notification

            # Step 1: Create document
            document_data = {
                "title": "Test Governance Document",
                "content": {"ops": [{"insert": "Document content"}]},
                "document_type": "governance"
            }

            document = document_service.create_document(mock_db, document_data, mock_user.id)

            # Step 2: Start approval workflow
            workflow_instance = workflow_service.start_workflow_instance(
                mock_db, "approval-workflow-789", document.id, mock_user.id
            )

            # Step 3: Send notification to reviewers
            notification = await notification_service.send_notification(mock_db, {
                "user_id": "reviewer-user",
                "title": "Document Review Required",
                "message": f"Document '{document.title}' requires your review",
                "notification_type": "workflow_assignment"
            })

            # Step 4: Invalidate cache
            await cache_service.delete(f"document:{document.id}")

            # Verify all steps were executed
            assert document == mock_document
            assert workflow_instance == mock_workflow_instance
            assert notification == mock_notification

            mock_create_doc.assert_called_once()
            mock_start_workflow.assert_called_once()
            mock_send_notification.assert_called_once()
            mock_cache_delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_document_approval_workflow(self, mock_db, mock_user):
        """Test document approval workflow"""
        from app.services.workflow_service import WorkflowService
        from app.services.document_service import DocumentService
        from app.services.notification_service import NotificationService

        workflow_service = WorkflowService()
        document_service = DocumentService()
        notification_service = NotificationService()

        with patch.object(workflow_service, 'get_workflow_instance') as mock_get_instance, \
             patch.object(workflow_service, 'advance_workflow_step') as mock_advance, \
             patch.object(document_service, 'update_document_status') as mock_update_status, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            # Mock workflow instance in review state
            mock_instance = Mock()
            mock_instance.id = "instance-123"
            mock_instance.current_step = 1
            mock_instance.status = "in_review"
            mock_instance.document_id = "doc-456"
            mock_get_instance.return_value = mock_instance

            mock_updated_instance = Mock()
            mock_updated_instance.status = "approved"
            mock_advance.return_value = mock_updated_instance

            # Step 1: Get workflow instance
            workflow_instance = workflow_service.get_workflow_instance(mock_db, "instance-123")

            # Step 2: Approve step
            updated_instance = workflow_service.advance_workflow_step(
                mock_db, workflow_instance.id, mock_user.id, "approved"
            )

            # Step 3: Update document status
            document_service.update_document_status(
                mock_db, workflow_instance.document_id, "approved"
            )

            # Step 4: Notify document creator
            await notification_service.send_notification(mock_db, {
                "user_id": "creator-user",
                "title": "Document Approved",
                "message": "Your document has been approved",
                "notification_type": "workflow_completed"
            })

            # Verify workflow progression
            assert workflow_instance == mock_instance
            assert updated_instance.status == "approved"

            mock_get_instance.assert_called_once()
            mock_advance.assert_called_once()
            mock_update_status.assert_called_once()
            mock_send_notification.assert_called_once()

    @pytest.mark.asyncio
    async def test_document_rejection_workflow(self, mock_db, mock_user):
        """Test document rejection workflow"""
        from app.services.workflow_service import WorkflowService
        from app.services.document_service import DocumentService
        from app.services.notification_service import NotificationService

        workflow_service = WorkflowService()
        document_service = DocumentService()
        notification_service = NotificationService()

        with patch.object(workflow_service, 'reject_workflow_step') as mock_reject, \
             patch.object(document_service, 'update_document_status') as mock_update_status, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            mock_rejected_instance = Mock()
            mock_rejected_instance.status = "rejected"
            mock_rejected_instance.document_id = "doc-789"
            mock_reject.return_value = mock_rejected_instance

            # Reject workflow step with feedback
            rejection_data = {
                "reason": "Document needs more detail in section 3",
                "feedback": "Please provide more specific examples"
            }

            rejected_instance = workflow_service.reject_workflow_step(
                mock_db, "instance-456", mock_user.id, rejection_data
            )

            # Update document status
            document_service.update_document_status(
                mock_db, rejected_instance.document_id, "rejected"
            )

            # Notify creator with feedback
            await notification_service.send_notification(mock_db, {
                "user_id": "creator-user",
                "title": "Document Rejected",
                "message": f"Document rejected: {rejection_data['reason']}",
                "notification_type": "workflow_rejected"
            })

            assert rejected_instance.status == "rejected"
            mock_reject.assert_called_once()
            mock_update_status.assert_called_once()
            mock_send_notification.assert_called_once()


class TestUserAuthenticationWorkflow:
    """Integration tests for user authentication workflows"""

    @pytest.mark.asyncio
    async def test_complete_user_registration_workflow(self):
        """Test complete user registration workflow"""
        from app.services.user_service import UserService
        from app.services.notification_service import NotificationService
        from app.core.security import create_access_token

        user_service = UserService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(user_service, 'create_user') as mock_create_user, \
             patch.object(user_service, 'generate_verification_token') as mock_gen_token, \
             patch.object(notification_service, 'send_email_notification') as mock_send_email:

            mock_user = Mock()
            mock_user.id = "user-123"
            mock_user.email = "newuser@example.com"
            mock_user.is_verified = False
            mock_create_user.return_value = mock_user

            mock_token = "verification-token-abc123"
            mock_gen_token.return_value = mock_token

            # Step 1: Create user account
            user_data = {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "securepassword123",
                "full_name": "New User"
            }

            user = user_service.create_user(mock_db, user_data)

            # Step 2: Generate verification token
            verification_token = user_service.generate_verification_token(mock_db, user.id)

            # Step 3: Send verification email
            await notification_service.send_email_notification({
                "email": user.email,
                "subject": "Verify Your Account",
                "template_name": "email_verification",
                "template_data": {
                    "user_name": user.full_name,
                    "verification_token": verification_token
                }
            })

            # Verify registration workflow
            assert user == mock_user
            assert verification_token == mock_token

            mock_create_user.assert_called_once()
            mock_gen_token.assert_called_once()
            mock_send_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_user_login_workflow(self):
        """Test user login workflow"""
        from app.services.user_service import UserService
        from app.core.security import create_access_token, verify_password
        from app.services.cache_service import cache_service

        user_service = UserService()
        mock_db = Mock()

        with patch.object(user_service, 'authenticate_user') as mock_authenticate, \
             patch('app.core.security.create_access_token') as mock_create_token, \
             patch.object(cache_service, 'set') as mock_cache_set:

            mock_user = Mock()
            mock_user.id = "user-123"
            mock_user.email = "user@example.com"
            mock_user.is_active = True
            mock_authenticate.return_value = mock_user

            mock_token = "jwt-token-xyz789"
            mock_create_token.return_value = mock_token

            # Step 1: Authenticate user
            user = user_service.authenticate_user(
                mock_db, "user@example.com", "password123"
            )

            # Step 2: Create access token
            access_token = create_access_token({"sub": user.id, "email": user.email})

            # Step 3: Cache user session
            await cache_service.set(f"session:{user.id}", {
                "user_id": user.id,
                "token": access_token,
                "login_time": datetime.utcnow().isoformat()
            }, ttl=3600)

            # Verify login workflow
            assert user == mock_user
            assert access_token == mock_token

            mock_authenticate.assert_called_once()
            mock_create_token.assert_called_once()
            mock_cache_set.assert_called_once()

    @pytest.mark.asyncio
    async def test_password_reset_workflow(self):
        """Test password reset workflow"""
        from app.services.user_service import UserService
        from app.services.notification_service import NotificationService

        user_service = UserService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(user_service, 'get_user_by_email') as mock_get_user, \
             patch.object(user_service, 'generate_reset_token') as mock_gen_reset_token, \
             patch.object(notification_service, 'send_email_notification') as mock_send_email:

            mock_user = Mock()
            mock_user.id = "user-123"
            mock_user.email = "user@example.com"
            mock_get_user.return_value = mock_user

            mock_reset_token = "reset-token-def456"
            mock_gen_reset_token.return_value = mock_reset_token

            # Step 1: Find user by email
            user = user_service.get_user_by_email(mock_db, "user@example.com")

            # Step 2: Generate reset token
            reset_token = user_service.generate_reset_token(mock_db, user.id)

            # Step 3: Send reset email
            await notification_service.send_email_notification({
                "email": user.email,
                "subject": "Password Reset Request",
                "template_name": "password_reset",
                "template_data": {
                    "reset_token": reset_token,
                    "expiry_hours": 24
                }
            })

            # Verify password reset workflow
            assert user == mock_user
            assert reset_token == mock_reset_token

            mock_get_user.assert_called_once()
            mock_gen_reset_token.assert_called_once()
            mock_send_email.assert_called_once()


class TestTemplateWorkflow:
    """Integration tests for template-based workflows"""

    @pytest.mark.asyncio
    async def test_template_to_document_workflow(self):
        """Test creating document from template workflow"""
        from app.services.template_service import TemplateService
        from app.services.document_service import DocumentService
        from app.services.workflow_service import WorkflowService

        template_service = TemplateService()
        document_service = DocumentService()
        workflow_service = WorkflowService()
        mock_db = Mock()

        with patch.object(template_service, 'get_template_by_id') as mock_get_template, \
             patch.object(document_service, 'create_from_template') as mock_create_from_template, \
             patch.object(workflow_service, 'start_workflow_instance') as mock_start_workflow:

            # Mock template
            mock_template = Mock()
            mock_template.id = "template-123"
            mock_template.name = "Meeting Minutes Template"
            mock_template.content = {"ops": [{"insert": "Meeting Date: {{date}}"}]}
            mock_template.default_workflow_id = "workflow-456"
            mock_get_template.return_value = mock_template

            # Mock document created from template
            mock_document = Mock()
            mock_document.id = "doc-789"
            mock_document.title = "Board Meeting Minutes - 2023-12-01"
            mock_create_from_template.return_value = mock_document

            # Mock workflow instance
            mock_workflow_instance = Mock()
            mock_workflow_instance.id = "instance-321"
            mock_start_workflow.return_value = mock_workflow_instance

            # Step 1: Get template
            template = template_service.get_template_by_id(mock_db, "template-123")

            # Step 2: Create document from template
            template_data = {
                "date": "December 1, 2023",
                "title": "Board Meeting Minutes - 2023-12-01"
            }
            document = document_service.create_from_template(
                mock_db, template.id, template_data, "user-123"
            )

            # Step 3: Start associated workflow
            workflow_instance = workflow_service.start_workflow_instance(
                mock_db, template.default_workflow_id, document.id, "user-123"
            )

            # Verify template workflow
            assert template == mock_template
            assert document == mock_document
            assert workflow_instance == mock_workflow_instance

            mock_get_template.assert_called_once()
            mock_create_from_template.assert_called_once()
            mock_start_workflow.assert_called_once()

    @pytest.mark.asyncio
    async def test_template_collaboration_workflow(self):
        """Test template collaboration workflow"""
        from app.services.template_service import TemplateService
        from app.services.notification_service import NotificationService

        template_service = TemplateService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(template_service, 'share_template') as mock_share_template, \
             patch.object(template_service, 'add_collaborator') as mock_add_collaborator, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            mock_shared_template = Mock()
            mock_shared_template.id = "template-456"
            mock_shared_template.access_level = "organization"
            mock_share_template.return_value = mock_shared_template

            mock_collaboration = Mock()
            mock_collaboration.template_id = "template-456"
            mock_collaboration.user_id = "collaborator-789"
            mock_add_collaborator.return_value = mock_collaboration

            # Step 1: Share template with organization
            shared_template = template_service.share_template(
                mock_db, "template-456", "organization", "user-123"
            )

            # Step 2: Add specific collaborator
            collaboration = template_service.add_collaborator(
                mock_db, shared_template.id, "collaborator-789", "edit"
            )

            # Step 3: Notify collaborator
            await notification_service.send_notification(mock_db, {
                "user_id": "collaborator-789",
                "title": "Template Shared",
                "message": "A template has been shared with you for collaboration",
                "notification_type": "template_shared"
            })

            # Verify collaboration workflow
            assert shared_template == mock_shared_template
            assert collaboration == mock_collaboration

            mock_share_template.assert_called_once()
            mock_add_collaborator.assert_called_once()
            mock_send_notification.assert_called_once()


class TestScalingWorkflow:
    """Integration tests for auto-scaling workflows"""

    @pytest.mark.asyncio
    async def test_auto_scaling_trigger_workflow(self):
        """Test auto-scaling trigger workflow"""
        from app.services.auto_scaling_service import AutoScalingService
        from app.services.notification_service import NotificationService

        scaling_service = AutoScalingService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(scaling_service, 'collect_metrics') as mock_collect_metrics, \
             patch.object(scaling_service, 'analyze_scaling_needs') as mock_analyze, \
             patch.object(scaling_service, 'execute_scaling') as mock_execute, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            # Mock high resource usage metrics
            mock_metrics = Mock()
            mock_metrics.cpu_usage = 85.0
            mock_metrics.memory_usage = 90.0
            mock_metrics.response_time_avg = 1200.0
            mock_collect_metrics.return_value = mock_metrics

            # Mock scaling decision
            mock_scaling_decisions = {"backend": "up", "frontend": "up"}
            mock_analyze.return_value = mock_scaling_decisions

            # Step 1: Collect system metrics
            metrics = await scaling_service.collect_metrics()

            # Step 2: Analyze scaling needs
            scaling_decisions = await scaling_service.analyze_scaling_needs(metrics)

            # Step 3: Execute scaling for each service
            for service, decision in scaling_decisions.items():
                if decision == "up":
                    await scaling_service.execute_scaling(service, decision, metrics)

            # Step 4: Notify administrators
            if any(decision != "none" for decision in scaling_decisions.values()):
                await notification_service.send_notification(mock_db, {
                    "user_id": "admin-user",
                    "title": "Auto-Scaling Event",
                    "message": f"Services scaled: {scaling_decisions}",
                    "notification_type": "system_alert"
                })

            # Verify scaling workflow
            assert metrics == mock_metrics
            assert scaling_decisions == mock_scaling_decisions

            mock_collect_metrics.assert_called_once()
            mock_analyze.assert_called_once()
            assert mock_execute.call_count == 2  # Called for each service
            mock_send_notification.assert_called_once()


class TestSecurityWorkflow:
    """Integration tests for security workflows"""

    @pytest.mark.asyncio
    async def test_two_factor_authentication_setup_workflow(self):
        """Test 2FA setup workflow"""
        from app.services.security_service import SecurityService
        from app.services.user_service import UserService
        from app.services.notification_service import NotificationService

        security_service = SecurityService()
        user_service = UserService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(security_service, 'generate_totp_secret') as mock_gen_secret, \
             patch.object(security_service, 'generate_qr_code') as mock_gen_qr, \
             patch.object(user_service, 'enable_two_factor') as mock_enable_2fa, \
             patch.object(notification_service, 'send_email_notification') as mock_send_email:

            mock_secret = "JBSWY3DPEHPK3PXP"
            mock_gen_secret.return_value = mock_secret

            mock_qr_code = "data:image/png;base64,iVBORw0KGgoAAAANSU..."
            mock_gen_qr.return_value = mock_qr_code

            # Step 1: Generate TOTP secret
            totp_secret = security_service.generate_totp_secret()

            # Step 2: Generate QR code for authenticator app
            qr_code = security_service.generate_qr_code("user@example.com", totp_secret)

            # Step 3: User confirms setup with TOTP code
            # (This would be verified in a separate step)

            # Step 4: Enable 2FA for user
            user_service.enable_two_factor(mock_db, "user-123", totp_secret)

            # Step 5: Send confirmation email
            await notification_service.send_email_notification({
                "email": "user@example.com",
                "subject": "Two-Factor Authentication Enabled",
                "template_name": "2fa_enabled",
                "template_data": {"enable_time": datetime.utcnow().isoformat()}
            })

            # Verify 2FA setup workflow
            assert totp_secret == mock_secret
            assert qr_code == mock_qr_code

            mock_gen_secret.assert_called_once()
            mock_gen_qr.assert_called_once()
            mock_enable_2fa.assert_called_once()
            mock_send_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_security_audit_workflow(self):
        """Test security audit workflow"""
        from app.services.security_service import SecurityService
        from app.services.notification_service import NotificationService

        security_service = SecurityService()
        notification_service = NotificationService()
        mock_db = Mock()

        with patch.object(security_service, 'detect_suspicious_activity') as mock_detect, \
             patch.object(security_service, 'create_security_alert') as mock_create_alert, \
             patch.object(notification_service, 'send_notification') as mock_send_notification:

            # Mock suspicious activity detection
            mock_suspicious_events = [
                {"type": "multiple_failed_logins", "user_id": "user-123", "count": 5},
                {"type": "unusual_access_pattern", "user_id": "user-456", "location": "Unknown"}
            ]
            mock_detect.return_value = mock_suspicious_events

            mock_alert = Mock()
            mock_alert.id = "alert-789"
            mock_alert.severity = "high"
            mock_create_alert.return_value = mock_alert

            # Step 1: Detect suspicious activity
            suspicious_events = security_service.detect_suspicious_activity(mock_db)

            # Step 2: Create security alerts
            alerts = []
            for event in suspicious_events:
                alert = security_service.create_security_alert(mock_db, event)
                alerts.append(alert)

            # Step 3: Notify security team
            for alert in alerts:
                await notification_service.send_notification(mock_db, {
                    "user_id": "security-admin",
                    "title": "Security Alert",
                    "message": f"Security alert {alert.id} requires attention",
                    "notification_type": "security_alert"
                })

            # Verify security audit workflow
            assert len(suspicious_events) == 2
            assert len(alerts) == 2

            mock_detect.assert_called_once()
            assert mock_create_alert.call_count == 2
            assert mock_send_notification.call_count == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])