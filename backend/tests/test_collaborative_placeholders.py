"""
Tests for collaborative placeholder management system
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock
from app.services.collaborative_placeholder_service import CollaborativePlaceholderService, PlaceholderUpdate
from app.core.websocket_manager import WebSocketManager
from app.models.user import User


class TestCollaborativePlaceholderService:
    """Test collaborative placeholder management functionality"""
    
    @pytest.fixture
    def websocket_manager(self) -> WebSocketManager:
        """Create mock WebSocket manager for testing"""
        manager = Mock(spec=WebSocketManager)
        manager.send_to_document_room = AsyncMock()
        return manager
    
    @pytest.fixture
    def placeholder_service(self, websocket_manager: WebSocketManager) -> CollaborativePlaceholderService:
        """Create collaborative placeholder service for testing"""
        return CollaborativePlaceholderService(websocket_manager)
    
    @pytest.fixture
    def sample_user(self) -> User:
        """Create sample user for testing"""
        user = Mock(spec=User)
        user.id = "user-123"
        user.email = "test@example.com"
        user.full_name = "Test User"
        return user
    
    @pytest.fixture
    def sample_user2(self) -> User:
        """Create second sample user for testing"""
        user = Mock(spec=User)
        user.id = "user-456"
        user.email = "test2@example.com"
        user.full_name = "Test User 2"
        return user

    def test_create_signature_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating a signature placeholder"""
        document_id = "doc-123"
        placeholder_data = {
            "label": "Board President",
            "includeTitle": True,
            "includeDate": True,
            "required": True
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            placeholder_data,
            sample_user.id,
            position=150
        )
        
        assert placeholder_id is not None
        assert placeholder_id.startswith("signature_")
        
        # Check stored data
        placeholders = placeholder_service.get_document_placeholders(document_id)
        assert placeholder_id in placeholders
        
        stored_data = placeholders[placeholder_id]
        assert stored_data["type"] == "signature"
        assert stored_data["label"] == "Board President"
        assert stored_data["created_by"] == sample_user.id
        assert stored_data["position"] == 150

    def test_create_long_response_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating a long response placeholder"""
        document_id = "doc-123"
        placeholder_data = {
            "lines": 5,
            "label": "Committee Response"
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "long_response",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is not None
        assert placeholder_id.startswith("long_response_")
        
        # Check stored data
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["lines"] == 5
        assert stored_data["label"] == "Committee Response"
        assert stored_data["placeholder_text"] == "Enter your response here..."  # Default

    def test_create_line_segment_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating a line segment placeholder"""
        document_id = "doc-123"
        placeholder_data = {
            "length": "medium",
            "label": "Name"
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "line_segment",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is not None
        assert placeholder_id.startswith("line_segment_")
        
        # Check stored data
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["length"] == "medium"
        assert stored_data["label"] == "Name"

    def test_create_version_table_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating a version table placeholder"""
        document_id = "doc-123"
        placeholder_data = {
            "version": 1
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "version_table",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is not None
        assert placeholder_id.startswith("version_table_")
        
        # Check stored data
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["version"] == 1
        assert stored_data["immutable"] is True
        assert stored_data["protected"] is True

    def test_create_invalid_placeholder_type(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating placeholder with invalid type"""
        document_id = "doc-123"
        placeholder_data = {"label": "Test"}
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "invalid_type",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is None

    def test_create_signature_placeholder_missing_required_field(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating signature placeholder without required fields"""
        document_id = "doc-123"
        placeholder_data = {
            "includeTitle": True  # Missing required "label" field
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is None

    def test_update_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test updating a placeholder"""
        document_id = "doc-123"
        
        # Create placeholder first
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "Original Label"},
            sample_user.id
        )
        
        # Update placeholder
        updates = {"label": "Updated Label", "includeTitle": False}
        success = placeholder_service.update_placeholder(
            document_id,
            placeholder_id,
            updates,
            sample_user.id
        )
        
        assert success is True
        
        # Check updated data
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["label"] == "Updated Label"
        assert stored_data["includeTitle"] is False
        assert stored_data["updated_by"] == sample_user.id

    def test_update_nonexistent_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test updating a placeholder that doesn't exist"""
        success = placeholder_service.update_placeholder(
            "doc-123",
            "nonexistent-placeholder",
            {"label": "Test"},
            sample_user.id
        )
        
        assert success is False

    def test_update_version_table_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test that version table placeholders cannot be updated"""
        document_id = "doc-123"
        
        # Create version table placeholder
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "version_table",
            {"version": 1},
            sample_user.id
        )
        
        # Try to update it (should fail)
        success = placeholder_service.update_placeholder(
            document_id,
            placeholder_id,
            {"version": 2},
            sample_user.id
        )
        
        assert success is False

    def test_delete_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test deleting a placeholder"""
        document_id = "doc-123"
        
        # Create placeholder first
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "To Delete"},
            sample_user.id
        )
        
        # Delete placeholder
        success = placeholder_service.delete_placeholder(
            document_id,
            placeholder_id,
            sample_user.id
        )
        
        assert success is True
        
        # Check that it's gone
        placeholders = placeholder_service.get_document_placeholders(document_id)
        assert placeholder_id not in placeholders

    def test_delete_version_table_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test that version table placeholders cannot be deleted"""
        document_id = "doc-123"
        
        # Create version table placeholder
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "version_table",
            {"version": 1},
            sample_user.id
        )
        
        # Try to delete it (should fail)
        success = placeholder_service.delete_placeholder(
            document_id,
            placeholder_id,
            sample_user.id
        )
        
        assert success is False

    def test_lock_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test locking a placeholder"""
        document_id = "doc-123"
        
        # Create placeholder first
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "To Lock"},
            sample_user.id
        )
        
        # Lock placeholder
        success = placeholder_service.lock_placeholder(
            document_id,
            placeholder_id,
            sample_user.id
        )
        
        assert success is True
        
        # Check lock status
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["locked_by"] == sample_user.id
        assert stored_data["is_locked"] is True

    def test_lock_already_locked_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User, sample_user2: User):
        """Test locking a placeholder that's already locked by another user"""
        document_id = "doc-123"
        
        # Create and lock placeholder
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "To Lock"},
            sample_user.id
        )
        placeholder_service.lock_placeholder(document_id, placeholder_id, sample_user.id)
        
        # Try to lock with different user (should fail)
        success = placeholder_service.lock_placeholder(
            document_id,
            placeholder_id,
            sample_user2.id
        )
        
        assert success is False

    def test_unlock_placeholder(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test unlocking a placeholder"""
        document_id = "doc-123"
        
        # Create and lock placeholder
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "To Unlock"},
            sample_user.id
        )
        placeholder_service.lock_placeholder(document_id, placeholder_id, sample_user.id)
        
        # Unlock placeholder
        success = placeholder_service.unlock_placeholder(
            document_id,
            placeholder_id,
            sample_user.id
        )
        
        assert success is True
        
        # Check lock status
        placeholders = placeholder_service.get_document_placeholders(document_id)
        stored_data = placeholders[placeholder_id]
        assert stored_data["locked_by"] is None
        assert stored_data["is_locked"] is False

    def test_unlock_placeholder_wrong_user(self, placeholder_service: CollaborativePlaceholderService, sample_user: User, sample_user2: User):
        """Test unlocking a placeholder with wrong user"""
        document_id = "doc-123"
        
        # Create and lock placeholder with user1
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "Locked"},
            sample_user.id
        )
        placeholder_service.lock_placeholder(document_id, placeholder_id, sample_user.id)
        
        # Try to unlock with user2 (should fail)
        success = placeholder_service.unlock_placeholder(
            document_id,
            placeholder_id,
            sample_user2.id
        )
        
        assert success is False

    def test_update_locked_placeholder_by_different_user(self, placeholder_service: CollaborativePlaceholderService, sample_user: User, sample_user2: User):
        """Test that locked placeholders can't be updated by different users"""
        document_id = "doc-123"
        
        # Create and lock placeholder with user1
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "Locked"},
            sample_user.id
        )
        placeholder_service.lock_placeholder(document_id, placeholder_id, sample_user.id)
        
        # Try to update with user2 (should fail)
        success = placeholder_service.update_placeholder(
            document_id,
            placeholder_id,
            {"label": "Updated"},
            sample_user2.id
        )
        
        assert success is False

    def test_get_document_placeholders(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test getting all placeholders in a document"""
        document_id = "doc-123"
        
        # Create multiple placeholders
        id1 = placeholder_service.create_placeholder(document_id, "signature", {"label": "Sig1"}, sample_user.id)
        id2 = placeholder_service.create_placeholder(document_id, "line_segment", {"length": "short"}, sample_user.id)
        
        placeholders = placeholder_service.get_document_placeholders(document_id)
        
        assert len(placeholders) == 2
        assert id1 in placeholders
        assert id2 in placeholders
        assert placeholders[id1]["type"] == "signature"
        assert placeholders[id2]["type"] == "line_segment"

    def test_get_placeholder_updates_since(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test getting placeholder updates since a timestamp"""
        document_id = "doc-123"
        
        # Create placeholder
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "signature",
            {"label": "Test"},
            sample_user.id
        )
        
        # Get updates since beginning of time
        since = datetime.utcnow() - timedelta(hours=1)
        updates = placeholder_service.get_placeholder_updates_since(document_id, since)
        
        assert len(updates) == 1
        assert updates[0]["placeholder_id"] == placeholder_id
        assert updates[0]["operation"] == "create"
        assert updates[0]["user_id"] == sample_user.id

    @pytest.mark.asyncio
    async def test_broadcast_placeholder_update(self, placeholder_service: CollaborativePlaceholderService):
        """Test broadcasting placeholder updates"""
        await placeholder_service.broadcast_placeholder_update(
            "doc-123",
            "placeholder-456",
            "update",
            "user-789",
            {"label": "Updated"},
            exclude_user="user-789"
        )
        
        # Check that websocket manager was called
        placeholder_service.websocket_manager.send_to_document_room.assert_called_once()
        call_args = placeholder_service.websocket_manager.send_to_document_room.call_args
        
        assert call_args[0][0] == "doc-123"  # document_id
        message = call_args[0][1]
        assert message["type"] == "placeholder_update"
        assert message["placeholder_id"] == "placeholder-456"
        assert message["operation"] == "update"
        assert call_args[1]["exclude_user"] == "user-789"

    def test_placeholder_id_generation(self, placeholder_service: CollaborativePlaceholderService):
        """Test placeholder ID generation"""
        # Test multiple calls to ensure uniqueness
        id1 = placeholder_service._generate_placeholder_id("signature")
        id2 = placeholder_service._generate_placeholder_id("signature")
        
        assert id1 != id2
        assert id1.startswith("signature_")
        assert id2.startswith("signature_")
        
        # Test different types
        sig_id = placeholder_service._generate_placeholder_id("signature")
        resp_id = placeholder_service._generate_placeholder_id("long_response")
        
        assert sig_id.startswith("signature_")
        assert resp_id.startswith("long_response_")

    def test_invalid_line_segment_length(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating line segment with invalid length"""
        document_id = "doc-123"
        placeholder_data = {
            "length": "invalid_length"  # Should be short, medium, or long
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "line_segment",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is None

    def test_invalid_long_response_lines(self, placeholder_service: CollaborativePlaceholderService, sample_user: User):
        """Test creating long response with invalid lines value"""
        document_id = "doc-123"
        placeholder_data = {
            "lines": 0  # Should be >= 1
        }
        
        placeholder_id = placeholder_service.create_placeholder(
            document_id,
            "long_response",
            placeholder_data,
            sample_user.id
        )
        
        assert placeholder_id is None