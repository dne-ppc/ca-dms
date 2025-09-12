"""
Tests for presence awareness system
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock
from app.services.presence_service import PresenceService, UserPresence
from app.core.websocket_manager import WebSocketManager
from app.models.user import User


class TestPresenceService:
    """Test presence awareness functionality"""
    
    @pytest.fixture
    def websocket_manager(self) -> WebSocketManager:
        """Create mock WebSocket manager for testing"""
        manager = Mock(spec=WebSocketManager)
        manager.send_to_document_room = AsyncMock()
        manager.join_document_room = Mock(return_value=True)
        manager.leave_document_room = Mock(return_value=True)
        return manager
    
    @pytest.fixture
    def presence_service(self, websocket_manager: WebSocketManager) -> PresenceService:
        """Create presence service for testing"""
        return PresenceService(websocket_manager)
    
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

    def test_user_presence_initialization(self):
        """Test UserPresence object initialization"""
        presence = UserPresence(
            user_id="user-123",
            user_name="Test User",
            document_id="doc-456"
        )
        
        assert presence.user_id == "user-123"
        assert presence.user_name == "Test User"
        assert presence.document_id == "doc-456"
        assert presence.cursor_position is None
        assert presence.selection_range is None
        assert presence.color is not None  # Should have generated color
        assert presence.is_active() is True
    
    def test_user_presence_color_generation(self):
        """Test that user colors are consistently generated"""
        presence1 = UserPresence("user-123", "Test User", "doc-456")
        presence2 = UserPresence("user-123", "Test User", "doc-789")  # Same user, different doc
        
        # Same user should get same color
        assert presence1.color == presence2.color
        
        # Test that color is always valid
        assert presence1.color.startswith("#")
        assert len(presence1.color) == 7  # #RRGGBB format
        
        # Test color consistency for multiple instances of same user
        presence3 = UserPresence("user-123", "Test User", "doc-abc")
        assert presence3.color == presence1.color
    
    def test_user_presence_activity_check(self):
        """Test active user detection"""
        # Recent activity
        recent_time = datetime.utcnow()
        presence = UserPresence("user-123", "Test User", "doc-456", last_seen=recent_time)
        assert presence.is_active() is True
        
        # Old activity
        old_time = datetime.utcnow() - timedelta(minutes=10)
        presence.last_seen = old_time
        assert presence.is_active() is False
        
        # Custom timeout
        assert presence.is_active(timeout_minutes=15) is True

    def test_join_document(self, presence_service: PresenceService, sample_user: User):
        """Test user joining a document"""
        document_id = "doc-123"
        
        user_presence = presence_service.join_document(sample_user, document_id)
        
        assert user_presence.user_id == sample_user.id
        assert user_presence.user_name == sample_user.full_name
        assert user_presence.document_id == document_id
        assert user_presence.is_active() is True
        
        # Check document presence tracking
        assert document_id in presence_service.document_presence
        assert sample_user.id in presence_service.document_presence[document_id]
        
        # Check user activity tracking
        assert sample_user.id in presence_service.user_activity

    def test_leave_document(self, presence_service: PresenceService, sample_user: User):
        """Test user leaving a document"""
        document_id = "doc-123"
        
        # First join the document
        presence_service.join_document(sample_user, document_id)
        assert document_id in presence_service.document_presence
        
        # Then leave
        result = presence_service.leave_document(sample_user.id, document_id)
        
        assert result is True
        assert document_id not in presence_service.document_presence  # Should be cleaned up
        assert sample_user.id not in presence_service.user_activity

    def test_leave_document_not_found(self, presence_service: PresenceService):
        """Test leaving a document when user is not present"""
        result = presence_service.leave_document("nonexistent-user", "nonexistent-doc")
        assert result is False

    def test_update_cursor_position(self, presence_service: PresenceService, sample_user: User):
        """Test updating user cursor position"""
        document_id = "doc-123"
        
        # Join document first
        presence_service.join_document(sample_user, document_id)
        
        # Update cursor position
        result = presence_service.update_cursor_position(
            sample_user.id,
            document_id,
            cursor_position=150,
            selection_range={"start": 100, "end": 200}
        )
        
        assert result is True
        
        # Check updated presence
        presence = presence_service.document_presence[document_id][sample_user.id]
        assert presence.cursor_position == 150
        assert presence.selection_range == {"start": 100, "end": 200}

    def test_update_cursor_position_not_found(self, presence_service: PresenceService):
        """Test updating cursor position for user not in document"""
        result = presence_service.update_cursor_position(
            "nonexistent-user",
            "nonexistent-doc",
            cursor_position=150
        )
        assert result is False

    def test_get_document_presence(self, presence_service: PresenceService, sample_user: User, sample_user2: User):
        """Test getting all users present in a document"""
        document_id = "doc-123"
        
        # Join multiple users
        presence_service.join_document(sample_user, document_id)
        presence_service.join_document(sample_user2, document_id)
        
        collaborators = presence_service.get_document_presence(document_id)
        
        assert len(collaborators) == 2
        user_ids = [c["user_id"] for c in collaborators]
        assert sample_user.id in user_ids
        assert sample_user2.id in user_ids

    def test_get_document_presence_empty(self, presence_service: PresenceService):
        """Test getting presence for document with no users"""
        collaborators = presence_service.get_document_presence("nonexistent-doc")
        assert collaborators == []

    def test_get_user_presence(self, presence_service: PresenceService, sample_user: User):
        """Test getting specific user presence"""
        document_id = "doc-123"
        
        # Join document and update cursor
        presence_service.join_document(sample_user, document_id)
        presence_service.update_cursor_position(sample_user.id, document_id, 150)
        
        user_presence = presence_service.get_user_presence(sample_user.id, document_id)
        
        assert user_presence is not None
        assert user_presence["user_id"] == sample_user.id
        assert user_presence["cursor_position"] == 150
        assert user_presence["is_active"] is True

    def test_get_user_presence_not_found(self, presence_service: PresenceService):
        """Test getting presence for user not in document"""
        user_presence = presence_service.get_user_presence("nonexistent-user", "nonexistent-doc")
        assert user_presence is None

    @pytest.mark.asyncio
    async def test_broadcast_presence_update(self, presence_service: PresenceService):
        """Test broadcasting presence updates"""
        await presence_service.broadcast_presence_update(
            "user-123",
            "doc-456",
            {"cursor_position": 150},
            exclude_user="user-123"
        )
        
        # Check that websocket manager was called
        presence_service.websocket_manager.send_to_document_room.assert_called_once()
        call_args = presence_service.websocket_manager.send_to_document_room.call_args
        
        assert call_args[0][0] == "doc-456"  # document_id
        message = call_args[0][1]
        assert message["type"] == "presence_update"
        assert message["user_id"] == "user-123"
        assert call_args[1]["exclude_user"] == "user-123"

    @pytest.mark.asyncio
    async def test_broadcast_user_joined(self, presence_service: PresenceService):
        """Test broadcasting user joined event"""
        await presence_service.broadcast_user_joined("user-123", "doc-456", "Test User")
        
        presence_service.websocket_manager.send_to_document_room.assert_called_once()
        call_args = presence_service.websocket_manager.send_to_document_room.call_args
        
        message = call_args[0][1]
        assert message["type"] == "user_joined"
        assert message["user_id"] == "user-123"
        assert message["user_name"] == "Test User"

    @pytest.mark.asyncio
    async def test_broadcast_user_left(self, presence_service: PresenceService):
        """Test broadcasting user left event"""
        await presence_service.broadcast_user_left("user-123", "doc-456", "Test User")
        
        presence_service.websocket_manager.send_to_document_room.assert_called_once()
        call_args = presence_service.websocket_manager.send_to_document_room.call_args
        
        message = call_args[0][1]
        assert message["type"] == "user_left"
        assert message["user_id"] == "user-123"
        assert message["user_name"] == "Test User"

    def test_cleanup_inactive_users(self, presence_service: PresenceService, sample_user: User, sample_user2: User):
        """Test cleaning up inactive users"""
        document_id = "doc-123"
        
        # Add users
        presence_service.join_document(sample_user, document_id)
        presence_service.join_document(sample_user2, document_id)
        
        # Make one user inactive by setting old timestamp
        old_time = datetime.utcnow() - timedelta(minutes=10)
        presence_service.document_presence[document_id][sample_user.id].last_seen = old_time
        presence_service.user_activity[sample_user.id] = old_time
        
        # Clean up with 5-minute timeout
        cleaned_count = presence_service.cleanup_inactive_users(timeout_minutes=5)
        
        assert cleaned_count == 1
        assert sample_user.id not in presence_service.document_presence[document_id]
        assert sample_user2.id in presence_service.document_presence[document_id]  # Should remain
        assert sample_user.id not in presence_service.user_activity

    def test_get_presence_statistics(self, presence_service: PresenceService, sample_user: User, sample_user2: User):
        """Test getting presence service statistics"""
        # Add users to multiple documents
        presence_service.join_document(sample_user, "doc-123")
        presence_service.join_document(sample_user2, "doc-123")
        presence_service.join_document(sample_user, "doc-456")
        
        stats = presence_service.get_presence_statistics()
        
        assert stats["total_documents"] == 2
        assert stats["total_active_users"] == 3  # user1 in 2 docs + user2 in 1 doc
        assert "doc-123" in stats["document_stats"]
        assert "doc-456" in stats["document_stats"]
        assert stats["document_stats"]["doc-123"]["active_users"] == 2
        assert stats["document_stats"]["doc-456"]["active_users"] == 1

    def test_cursor_update_debouncing(self, presence_service: PresenceService, sample_user: User):
        """Test that cursor updates are debounced to avoid spam"""
        document_id = "doc-123"
        
        # Join document
        presence_service.join_document(sample_user, document_id)
        
        # Multiple rapid updates
        result1 = presence_service.update_cursor_position(sample_user.id, document_id, 100)
        result2 = presence_service.update_cursor_position(sample_user.id, document_id, 101)  # Immediate
        result3 = presence_service.update_cursor_position(sample_user.id, document_id, 102)  # Immediate
        
        # All should succeed (debouncing doesn't fail, just skips)
        assert result1 is True
        assert result2 is True
        assert result3 is True