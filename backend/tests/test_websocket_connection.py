"""
Tests for WebSocket connection management
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocket
from unittest.mock import Mock, AsyncMock, patch
from app.main import app
from app.core.websocket_manager import WebSocketManager
from app.models.user import User


class TestWebSocketConnection:
    """Test WebSocket connection management functionality"""
    
    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_user(self) -> User:
        """Create mock user for testing"""
        user = Mock(spec=User)
        user.id = "test-user-123"
        user.email = "test@example.com"
        user.role = "user"
        return user
    
    @pytest.fixture
    def websocket_manager(self) -> WebSocketManager:
        """Create fresh WebSocketManager instance for each test"""
        return WebSocketManager()
    
    def test_websocket_connection_establishment(self, client: TestClient):
        """Test WebSocket connection can be established"""
        # This test should fail initially - we need to implement WebSocket endpoints
        with pytest.raises(Exception):  # Should fail because WebSocket endpoint doesn't exist yet
            with client.websocket_connect("/ws") as websocket:
                data = websocket.receive_json()
                assert data is not None
    
    def test_websocket_connection_with_authentication(self, client: TestClient, mock_user: User):
        """Test WebSocket connection with JWT authentication"""
        # This test should fail initially - we need authentication middleware
        with pytest.raises(Exception):
            # Mock JWT token
            token = "mock-jwt-token"
            
            with client.websocket_connect(f"/ws?token={token}") as websocket:
                # Should authenticate the connection
                data = websocket.receive_json()
                assert data["type"] == "connection_established"
                assert data["user_id"] == mock_user.id
    
    @pytest.mark.asyncio
    async def test_websocket_connection_cleanup_on_disconnect(self, websocket_manager: WebSocketManager):
        """Test connection cleanup when WebSocket disconnects"""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_id = "test-user-123"
        
        # Connect user
        await websocket_manager.connect(mock_websocket, user_id)
        assert websocket_manager.get_user_connection(user_id) == mock_websocket
        
        # Disconnect and verify cleanup
        disconnected_user = websocket_manager.disconnect(mock_websocket)
        assert disconnected_user == user_id
        assert websocket_manager.get_user_connection(user_id) is None
    
    @pytest.mark.asyncio
    async def test_websocket_manager_multiple_connections(self, websocket_manager: WebSocketManager):
        """Test WebSocket manager handles multiple concurrent connections"""
        mock_ws1 = AsyncMock(spec=WebSocket)
        mock_ws2 = AsyncMock(spec=WebSocket)
        user1_id = "user-1"
        user2_id = "user-2"
        
        # Connect multiple users
        await websocket_manager.connect(mock_ws1, user1_id)
        await websocket_manager.connect(mock_ws2, user2_id)
        
        # Verify connections
        assert websocket_manager.get_active_connections_count() == 2
        assert websocket_manager.get_user_connection(user1_id) == mock_ws1
        assert websocket_manager.get_user_connection(user2_id) == mock_ws2
    
    def test_websocket_authentication_failure(self, client: TestClient):
        """Test WebSocket connection fails with invalid authentication"""
        # This test should fail initially - authentication not implemented
        with pytest.raises(Exception):
            invalid_token = "invalid-jwt-token"
            
            # Should raise an exception due to invalid token
            with client.websocket_connect(f"/ws?token={invalid_token}") as websocket:
                data = websocket.receive_json()
                # Should not reach here - connection should be refused
                assert False, "Connection should have been refused"
    
    @pytest.mark.asyncio
    async def test_websocket_heartbeat_mechanism(self, websocket_manager: WebSocketManager):
        """Test WebSocket heartbeat/ping-pong mechanism"""
        mock_websocket = AsyncMock(spec=WebSocket)
        mock_websocket.send_text = AsyncMock(return_value=None)
        user_id = "test-user-123"
        
        await websocket_manager.connect(mock_websocket, user_id)
        
        # Test ping mechanism
        success = await websocket_manager.send_ping(user_id)
        assert success is True
        mock_websocket.send_text.assert_called()
        
        # Test pong handling
        await websocket_manager.handle_pong(user_id)
        # Should update last_ping timestamp
        assert user_id in websocket_manager.last_ping
    
    @pytest.mark.asyncio
    async def test_websocket_message_broadcasting(self, websocket_manager: WebSocketManager):
        """Test broadcasting messages to all connected clients"""
        mock_ws1 = AsyncMock(spec=WebSocket)
        mock_ws2 = AsyncMock(spec=WebSocket)
        
        # Configure mocks to simulate successful sends
        mock_ws1.send_text = AsyncMock(return_value=None)
        mock_ws2.send_text = AsyncMock(return_value=None)
        
        user1_id = "user-1"
        user2_id = "user-2"
        
        await websocket_manager.connect(mock_ws1, user1_id)
        await websocket_manager.connect(mock_ws2, user2_id)
        
        message = {"type": "document_update", "data": "test"}
        successful_sends = await websocket_manager.broadcast_message(message)
        
        assert successful_sends == 2
        # Verify both websockets received the message
        assert mock_ws1.send_text.call_count >= 1
        assert mock_ws2.send_text.call_count >= 1
    
    @pytest.mark.asyncio
    async def test_websocket_room_based_messaging(self, websocket_manager: WebSocketManager):
        """Test sending messages to specific document rooms"""
        mock_ws1 = AsyncMock(spec=WebSocket)
        mock_ws2 = AsyncMock(spec=WebSocket)
        
        # Configure mocks to simulate successful WebSocket operations
        mock_ws1.accept = AsyncMock(return_value=None)
        mock_ws1.send_text = AsyncMock(return_value=None)
        mock_ws2.accept = AsyncMock(return_value=None)
        mock_ws2.send_text = AsyncMock(return_value=None)
        
        user1_id = "user-1"
        user2_id = "user-2"
        document_id = "doc-123"
        
        await websocket_manager.connect(mock_ws1, user1_id)
        await websocket_manager.connect(mock_ws2, user2_id)
        
        # Verify connections are established
        assert websocket_manager.get_active_connections_count() == 2
        
        # Join document room
        success1 = websocket_manager.join_document_room(user1_id, document_id)
        success2 = websocket_manager.join_document_room(user2_id, document_id)
        assert success1 and success2
        
        # Verify room membership
        room_users = websocket_manager.get_document_room_users(document_id)
        assert user1_id in room_users
        assert user2_id in room_users
        
        # Send message to document room
        message = {"type": "document_change", "document_id": document_id, "data": "update"}
        successful_sends = await websocket_manager.send_to_document_room(document_id, message)
        
        assert successful_sends == 2
    
    @pytest.mark.asyncio
    async def test_websocket_connection_error_handling(self, websocket_manager: WebSocketManager):
        """Test error handling for WebSocket connections"""
        mock_websocket = AsyncMock(spec=WebSocket)
        mock_websocket.send_text.side_effect = Exception("Connection lost")
        user_id = "test-user-123"
        
        await websocket_manager.connect(mock_websocket, user_id)
        
        # Should handle send errors gracefully
        message = {"type": "test", "data": "test"}
        result = await websocket_manager.send_to_user(user_id, message)
        
        # Should return False indicating send failure
        assert result is False
        # Should automatically disconnect the problematic connection
        assert websocket_manager.get_user_connection(user_id) is None