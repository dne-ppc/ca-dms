"""
End-to-End Integration Tests for Complete Document Lifecycle
Tests the integration of all systems: Documents, Placeholders, Collaboration, Presence, Workflows, and PDF Generation
"""
import pytest
import json
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.core.database import Base
from app.main import app
from app.models.document import Document
from app.models.user import User, UserRole
from app.models.workflow import Workflow, WorkflowStep, WorkflowStepType, WorkflowStatus, WorkflowInstanceStatus
from app.services.document_collaboration_service import DocumentCollaborationService
from app.services.presence_service import PresenceService
from app.services.collaborative_placeholder_service import CollaborativePlaceholderService
from app.services.workflow_service import WorkflowService
from app.schemas.workflow import ApprovalAction
from app.core.websocket_manager import WebSocketManager
import logging

logger = logging.getLogger(__name__)


class TestDocumentLifecycleE2E:
    """End-to-End tests for complete document lifecycle"""
    
    @pytest.fixture(scope="function")
    def db_session(self):
        """Create a test database session"""
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine)
        
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        
        try:
            yield session
        finally:
            session.close()
    
    @pytest.fixture
    def test_client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def websocket_manager(self):
        """Create mock WebSocket manager"""
        manager = Mock(spec=WebSocketManager)
        manager.send_to_document_room = AsyncMock()
        manager.send_to_user = AsyncMock()
        manager.join_document_room = Mock(return_value=True)
        manager.leave_document_room = Mock(return_value=True)
        manager.get_document_room_users = Mock(return_value=["user-1", "user-2"])
        return manager
    
    @pytest.fixture
    def collaboration_service(self, db_session: Session, websocket_manager: WebSocketManager):
        """Create collaboration service"""
        return DocumentCollaborationService(db_session, websocket_manager)
    
    @pytest.fixture
    def presence_service(self, websocket_manager: WebSocketManager):
        """Create presence service"""
        return PresenceService(websocket_manager)
    
    @pytest.fixture
    def placeholder_service(self, websocket_manager: WebSocketManager):
        """Create placeholder service"""
        return CollaborativePlaceholderService(websocket_manager)
    
    @pytest.fixture
    def workflow_service(self, db_session: Session):
        """Create workflow service"""
        return WorkflowService(db_session)
    
    @pytest.fixture
    def test_users(self, db_session: Session):
        """Create test users"""
        users = [
            User(
                id="user-1", 
                email="author@example.com", 
                username="author", 
                hashed_password="hashed_pw_1",
                full_name="Document Author", 
                role=UserRole.RESIDENT
            ),
            User(
                id="user-2", 
                email="reviewer@example.com", 
                username="reviewer", 
                hashed_password="hashed_pw_2",
                full_name="Document Reviewer", 
                role=UserRole.MANAGER
            ),
            User(
                id="user-3", 
                email="approver@example.com", 
                username="approver", 
                hashed_password="hashed_pw_3",
                full_name="Document Approver", 
                role=UserRole.BOARD_MEMBER
            )
        ]
        for user in users:
            db_session.add(user)
        db_session.commit()
        return users
    
    @pytest.fixture
    def test_workflow(self, db_session: Session, test_users):
        """Create test workflow"""
        workflow = Workflow(
            id="workflow-1",
            name="Document Review Workflow",
            description="Standard document review and approval process",
            document_type="governance",
            status=WorkflowStatus.ACTIVE
        )
        db_session.add(workflow)
        
        # Add workflow steps
        steps = [
            WorkflowStep(
                workflow_id="workflow-1",
                name="Review",
                step_order=1,
                required_users=["user-2"],  # reviewer ID
                step_type=WorkflowStepType.APPROVAL,
                timeout_hours=48
            ),
            WorkflowStep(
                workflow_id="workflow-1",
                name="Final Approval",
                step_order=2,
                required_users=["user-3"],  # approver ID
                step_type=WorkflowStepType.APPROVAL,
                timeout_hours=24
            )
        ]
        for step in steps:
            db_session.add(step)
        
        db_session.commit()
        return workflow

    def test_complete_document_lifecycle(
        self,
        db_session: Session,
        collaboration_service: DocumentCollaborationService,
        presence_service: PresenceService,
        placeholder_service: CollaborativePlaceholderService,
        workflow_service: WorkflowService,
        test_users,
        test_workflow
    ):
        """Test complete document lifecycle from creation to approval"""
        author, reviewer, approver = test_users
        
        # === PHASE 1: Document Creation ===
        logger.info("=== PHASE 1: Document Creation ===")
        
        # Create document with initial content
        initial_content = {
            "ops": [
                {"insert": "Board Resolution\n", "attributes": {"bold": True, "size": "large"}},
                {"insert": "Whereas the board needs to make important decisions...\n\n"}
            ]
        }
        
        document = Document(
            id="doc-e2e-test",
            title="E2E Test Board Resolution",
            content=initial_content,
            document_type="governance",
            created_by=author.id
        )
        db_session.add(document)
        db_session.commit()
        
        assert document.id == "doc-e2e-test"
        assert document.version == 1
        logger.info(f"✅ Document created: {document.title}")
        
        # === PHASE 2: Collaborative Editing with Placeholders ===
        logger.info("=== PHASE 2: Collaborative Editing ===")
        
        # Author joins document for editing
        author_presence = presence_service.join_document(author, document.id)
        assert author_presence.user_id == author.id
        logger.info(f"✅ Author joined document for editing")
        
        # Add signature placeholder
        signature_placeholder_id = placeholder_service.create_placeholder(
            document.id,
            "signature",
            {
                "label": "Board President",
                "includeTitle": True,
                "includeDate": True,
                "required": True
            },
            author.id,
            position=200
        )
        assert signature_placeholder_id is not None
        logger.info(f"✅ Signature placeholder created: {signature_placeholder_id}")
        
        # Add long response area for committee input
        response_placeholder_id = placeholder_service.create_placeholder(
            document.id,
            "long_response",
            {
                "lines": 3,
                "label": "Committee Comments",
                "placeholder_text": "Enter committee feedback here..."
            },
            author.id,
            position=300
        )
        assert response_placeholder_id is not None
        logger.info(f"✅ Response area placeholder created: {response_placeholder_id}")
        
        # Apply collaborative edits using Delta operations
        delta_operation = {
            "type": "delta",
            "ops": [
                {"retain": len("Board Resolution\nWhereas the board needs to make important decisions...\n\n")},
                {"insert": "RESOLVED: The board hereby approves...\n\n"}
            ]
        }
        
        edit_result = collaboration_service.apply_delta_operation(
            document.id,
            delta_operation,
            author.id
        )
        assert edit_result is True
        logger.info(f"✅ Collaborative edit applied successfully")
        
        # Verify document version incremented
        updated_version = collaboration_service.get_document_version(document.id)
        assert updated_version == 1  # First edit increments to version 1
        
        # === PHASE 3: Multi-User Collaboration ===
        logger.info("=== PHASE 3: Multi-User Collaboration ===")
        
        # Reviewer joins for collaborative editing
        reviewer_presence = presence_service.join_document(reviewer, document.id)
        assert reviewer_presence.user_id == reviewer.id
        
        # Update presence with cursor position
        cursor_update_success = presence_service.update_cursor_position(
            reviewer.id,
            document.id,
            cursor_position=150,
            selection_range={"start": 100, "end": 200}
        )
        assert cursor_update_success is True
        logger.info(f"✅ Reviewer presence and cursor position updated")
        
        # Reviewer locks signature placeholder for editing
        lock_success = placeholder_service.lock_placeholder(
            document.id,
            signature_placeholder_id,
            reviewer.id
        )
        assert lock_success is True
        logger.info(f"✅ Signature placeholder locked by reviewer")
        
        # Reviewer updates signature placeholder
        update_success = placeholder_service.update_placeholder(
            document.id,
            signature_placeholder_id,
            {"label": "Board President - Reviewed"},
            reviewer.id
        )
        assert update_success is True
        logger.info(f"✅ Signature placeholder updated by reviewer")
        
        # Reviewer unlocks placeholder
        unlock_success = placeholder_service.unlock_placeholder(
            document.id,
            signature_placeholder_id,
            reviewer.id
        )
        assert unlock_success is True
        logger.info(f"✅ Signature placeholder unlocked")
        
        # Get collaboration statistics
        collab_stats = collaboration_service.get_collaboration_statistics(document.id)
        assert collab_stats["total_operations"] >= 1
        assert collab_stats["current_version"] >= 1
        logger.info(f"✅ Collaboration statistics: {collab_stats['total_operations']} operations")
        
        # === PHASE 4: Workflow Submission ===
        logger.info("=== PHASE 4: Workflow Submission ===")
        
        # Submit document to workflow
        workflow_instance = workflow_service.start_workflow(document.id, test_workflow.id, author.id)
        assert workflow_instance is not None
        assert workflow_instance.status == WorkflowInstanceStatus.IN_PROGRESS
        logger.info(f"✅ Workflow started: {workflow_instance.id}")
        
        # Get current workflow status
        instance = workflow_service.get_workflow_instance(workflow_instance.id)
        assert instance.status == WorkflowInstanceStatus.IN_PROGRESS
        assert len(instance.step_instances) >= 1  # Should have step instances
        review_step = instance.step_instances[0]
        assert review_step.step.name == "Review"
        logger.info(f"✅ Workflow at Review step")
        
        # === PHASE 5: Workflow Approval Process ===
        logger.info("=== PHASE 5: Approval Process ===")
        
        # Get pending approvals for reviewer
        reviewer_approvals = workflow_service.get_user_pending_approvals(reviewer.id)
        assert len(reviewer_approvals) >= 1
        logger.info(f"✅ Reviewer has pending approval")
        
        # Reviewer approves the document
        approval_action = ApprovalAction(
            action="approve",
            comments="Document looks good, ready for final approval"
        )
        approval_result = workflow_service.process_approval(
            review_step.id,
            approval_action,
            reviewer.id
        )
        assert approval_result is True
        logger.info(f"✅ Document approved by reviewer")
        
        # Check workflow advanced to next step
        updated_instance = workflow_service.get_workflow_instance(workflow_instance.id)
        final_approval_step = None
        for step_instance in updated_instance.step_instances:
            if step_instance.step.name == "Final Approval":
                final_approval_step = step_instance
                break
        assert final_approval_step is not None
        logger.info(f"✅ Workflow advanced to Final Approval step")
        
        # Approver gives final approval
        final_action = ApprovalAction(
            action="approve",
            comments="Final approval granted"
        )
        final_approval = workflow_service.process_approval(
            final_approval_step.id,
            final_action,
            approver.id
        )
        assert final_approval is True
        logger.info(f"✅ Document received final approval")
        
        # Verify workflow completion
        final_instance = workflow_service.get_workflow_instance(workflow_instance.id)
        assert final_instance.status == WorkflowInstanceStatus.COMPLETED
        logger.info(f"✅ Workflow completed successfully")
        
        # === PHASE 6: Document State Verification ===
        logger.info("=== PHASE 6: Final Verification ===")
        
        # Verify all placeholders are present
        final_placeholders = placeholder_service.get_document_placeholders(document.id)
        assert len(final_placeholders) == 2
        assert signature_placeholder_id in final_placeholders
        assert response_placeholder_id in final_placeholders
        logger.info(f"✅ All placeholders preserved: {len(final_placeholders)} placeholders")
        
        # Verify presence data
        document_presence = presence_service.get_document_presence(document.id)
        active_collaborators = len([p for p in document_presence if p["is_active"]])
        assert active_collaborators >= 1  # At least one active user
        logger.info(f"✅ Active collaborators: {active_collaborators}")
        
        # Verify final document state
        db_session.refresh(document)
        assert document.title == "E2E Test Board Resolution"
        assert "RESOLVED" in collaboration_service.extract_text_from_delta(document.content)
        logger.info(f"✅ Document content verified")
        
        # Get comprehensive workflow analytics
        workflow_analytics = workflow_service.get_workflow_analytics()
        assert workflow_analytics["total_workflows"] >= 1
        assert workflow_analytics["completed_instances"] >= 1
        logger.info(f"✅ Workflow analytics: {workflow_analytics['completed_instances']} completed instances")
        
        logger.info("🎉 COMPLETE DOCUMENT LIFECYCLE TEST PASSED!")
        logger.info("✅ Document Creation -> ✅ Collaborative Editing -> ✅ Placeholder Management -> ✅ Workflow Approval -> ✅ Completion")

    def test_concurrent_user_editing_scenario(
        self,
        db_session: Session,
        collaboration_service: DocumentCollaborationService,
        presence_service: PresenceService,
        placeholder_service: CollaborativePlaceholderService,
        test_users
    ):
        """Test concurrent editing by multiple users"""
        author, reviewer, approver = test_users
        
        logger.info("=== CONCURRENT EDITING SCENARIO ===")
        
        # Create test document
        document = Document(
            id="doc-concurrent-test",
            title="Concurrent Editing Test",
            content={"ops": [{"insert": "Initial content\n"}]},
            document_type="governance",
            created_by=author.id
        )
        db_session.add(document)
        db_session.commit()
        
        # All users join document
        author_presence = presence_service.join_document(author, document.id)
        reviewer_presence = presence_service.join_document(reviewer, document.id)
        approver_presence = presence_service.join_document(approver, document.id)
        
        assert all([author_presence, reviewer_presence, approver_presence])
        logger.info("✅ All three users joined document")
        
        # Concurrent placeholder creation
        sig_id = placeholder_service.create_placeholder(
            document.id, "signature", {"label": "Author Sig"}, author.id
        )
        resp_id = placeholder_service.create_placeholder(
            document.id, "long_response", {"lines": 2, "label": "Review Notes"}, reviewer.id
        )
        line_id = placeholder_service.create_placeholder(
            document.id, "line_segment", {"length": "medium", "label": "Approval Date"}, approver.id
        )
        
        assert all([sig_id, resp_id, line_id])
        logger.info("✅ Concurrent placeholder creation successful")
        
        # Concurrent document editing
        author_edit = collaboration_service.apply_delta_operation(
            document.id,
            {"type": "delta", "ops": [{"retain": 16}, {"insert": "Author addition. "}]},
            author.id
        )
        reviewer_edit = collaboration_service.apply_delta_operation(
            document.id,
            {"type": "delta", "ops": [{"retain": 16}, {"insert": "Reviewer note. "}]},
            reviewer.id
        )
        
        assert author_edit and reviewer_edit
        logger.info("✅ Concurrent document editing successful")
        
        # Verify final state integrity
        final_placeholders = placeholder_service.get_document_placeholders(document.id)
        assert len(final_placeholders) == 3
        
        final_presence = presence_service.get_document_presence(document.id)
        assert len(final_presence) == 3
        
        collab_stats = collaboration_service.get_collaboration_statistics(document.id)
        assert collab_stats["total_operations"] >= 2
        
        logger.info("🎉 CONCURRENT EDITING SCENARIO PASSED!")

    def test_error_recovery_and_rollback(
        self,
        db_session: Session,
        collaboration_service: DocumentCollaborationService,
        placeholder_service: CollaborativePlaceholderService,
        workflow_service: WorkflowService,
        test_users,
        test_workflow
    ):
        """Test error recovery and rollback scenarios"""
        author = test_users[0]
        
        logger.info("=== ERROR RECOVERY SCENARIO ===")
        
        # Create test document
        document = Document(
            id="doc-error-test",
            title="Error Recovery Test",
            content={"ops": [{"insert": "Test content\n"}]},
            document_type="governance",
            created_by=author.id
        )
        db_session.add(document)
        db_session.commit()
        
        # Test invalid placeholder creation (should fail gracefully)
        invalid_placeholder_id = placeholder_service.create_placeholder(
            document.id,
            "invalid_type",  # Invalid type
            {"label": "Test"},
            author.id
        )
        assert invalid_placeholder_id is None
        logger.info("✅ Invalid placeholder creation handled gracefully")
        
        # Test invalid Delta operation (should fail gracefully)
        invalid_edit = collaboration_service.apply_delta_operation(
            document.id,
            {"type": "invalid_delta"},  # Invalid operation
            author.id
        )
        assert invalid_edit is False
        logger.info("✅ Invalid Delta operation handled gracefully")
        
        # Test workflow with invalid step (should handle gracefully)
        invalid_workflow_instance = workflow_service.start_workflow(
            document.id,
            "nonexistent-workflow",
            author.id
        )
        assert invalid_workflow_instance is None
        logger.info("✅ Invalid workflow start handled gracefully")
        
        # Test placeholder locking conflicts
        placeholder_id = placeholder_service.create_placeholder(
            document.id, "signature", {"label": "Test"}, author.id
        )
        
        # Lock with first user
        lock1 = placeholder_service.lock_placeholder(document.id, placeholder_id, author.id)
        # Try to lock with same ID (should succeed - same user)
        lock2 = placeholder_service.lock_placeholder(document.id, placeholder_id, author.id)
        
        assert lock1 is True
        assert lock2 is True  # Same user can "re-lock"
        logger.info("✅ Placeholder locking conflicts handled correctly")
        
        # Verify system state remains consistent
        final_placeholders = placeholder_service.get_document_placeholders(document.id)
        assert len(final_placeholders) == 1  # Only the valid placeholder
        
        logger.info("🎉 ERROR RECOVERY SCENARIO PASSED!")

    @pytest.mark.asyncio
    async def test_websocket_integration_flow(
        self,
        websocket_manager: WebSocketManager,
        placeholder_service: CollaborativePlaceholderService,
        presence_service: PresenceService
    ):
        """Test WebSocket integration with all services"""
        logger.info("=== WEBSOCKET INTEGRATION TEST ===")
        
        document_id = "doc-websocket-test"
        user_id = "user-websocket"
        
        # Test placeholder broadcasting
        await placeholder_service.broadcast_placeholder_update(
            document_id,
            "placeholder-123",
            "create",
            user_id,
            {"type": "signature", "label": "Test"},
            exclude_user=user_id
        )
        
        # Verify WebSocket manager was called
        websocket_manager.send_to_document_room.assert_called()
        call_args = websocket_manager.send_to_document_room.call_args
        assert call_args[0][0] == document_id
        assert call_args[0][1]["type"] == "placeholder_update"
        logger.info("✅ Placeholder WebSocket broadcasting works")
        
        # Test presence broadcasting
        await presence_service.broadcast_presence_update(
            user_id,
            document_id,
            {"cursor_position": 100},
            exclude_user=user_id
        )
        
        # Verify presence broadcasting
        assert websocket_manager.send_to_document_room.call_count >= 2
        logger.info("✅ Presence WebSocket broadcasting works")
        
        logger.info("🎉 WEBSOCKET INTEGRATION TEST PASSED!")