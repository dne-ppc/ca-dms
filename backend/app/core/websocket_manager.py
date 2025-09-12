"""
WebSocket connection management for real-time collaboration
"""
from typing import Dict, List, Set, Optional
import json
import asyncio
import logging
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from app.models.user import User

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time collaboration"""
    
    def __init__(self):
        # Map user_id to WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Map document_id to set of user_ids in that document
        self.document_rooms: Dict[str, Set[str]] = {}
        
        # Map user_id to set of document_ids they're subscribed to
        self.user_subscriptions: Dict[str, Set[str]] = {}
        
        # Connection metadata
        self.connection_timestamps: Dict[str, datetime] = {}
        
        # Heartbeat tracking
        self.last_ping: Dict[str, datetime] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        """Accept WebSocket connection for a user"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.connection_timestamps[user_id] = datetime.utcnow()
        self.last_ping[user_id] = datetime.utcnow()
        
        logger.info(f"WebSocket connected for user {user_id}")
        
        # Send connection confirmation (don't disconnect on failure during initial connection)
        try:
            await websocket.send_text(json.dumps({
                "type": "connection_established",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            }))
        except Exception as e:
            logger.warning(f"Failed to send connection confirmation to user {user_id}: {e}")
            # Don't disconnect on initial message failure
    
    def disconnect(self, websocket: WebSocket) -> Optional[str]:
        """Remove WebSocket connection and clean up user data"""
        # Find user_id for this websocket
        user_id = None
        for uid, ws in self.active_connections.items():
            if ws == websocket:
                user_id = uid
                break
        
        if not user_id:
            return None
        
        # Remove from active connections
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Clean up timestamps
        if user_id in self.connection_timestamps:
            del self.connection_timestamps[user_id]
        
        if user_id in self.last_ping:
            del self.last_ping[user_id]
        
        # Remove from all document rooms
        if user_id in self.user_subscriptions:
            for document_id in self.user_subscriptions[user_id].copy():
                self.leave_document_room(user_id, document_id)
            del self.user_subscriptions[user_id]
        
        logger.info(f"WebSocket disconnected for user {user_id}")
        return user_id
    
    def get_user_connection(self, user_id: str) -> Optional[WebSocket]:
        """Get WebSocket connection for a user"""
        return self.active_connections.get(user_id)
    
    def get_active_connections_count(self) -> int:
        """Get count of active connections"""
        return len(self.active_connections)
    
    def is_user_connected(self, user_id: str) -> bool:
        """Check if user is currently connected"""
        return user_id in self.active_connections
    
    async def send_to_user(self, user_id: str, message: dict) -> bool:
        """Send message to specific user"""
        websocket = self.active_connections.get(user_id)
        
        # Use 'is None' check instead of boolean evaluation for mock compatibility
        if websocket is None:
            logger.warning(f"No websocket found for user {user_id}")
            return False
        
        try:
            await websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {e}")
            # Remove problematic connection
            if user_id in self.active_connections:
                self.disconnect(websocket)
            return False
    
    async def broadcast_message(self, message: dict, exclude_user: Optional[str] = None) -> int:
        """Broadcast message to all connected users"""
        successful_sends = 0
        failed_connections = []
        
        for user_id, websocket in self.active_connections.items():
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                await websocket.send_text(json.dumps(message))
                successful_sends += 1
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {e}")
                failed_connections.append(websocket)
        
        # Clean up failed connections
        for websocket in failed_connections:
            self.disconnect(websocket)
        
        return successful_sends
    
    def join_document_room(self, user_id: str, document_id: str) -> bool:
        """Add user to a document room for collaborative editing"""
        if user_id not in self.active_connections:
            return False
        
        # Add user to document room
        if document_id not in self.document_rooms:
            self.document_rooms[document_id] = set()
        self.document_rooms[document_id].add(user_id)
        
        # Add document to user subscriptions
        if user_id not in self.user_subscriptions:
            self.user_subscriptions[user_id] = set()
        self.user_subscriptions[user_id].add(document_id)
        
        logger.info(f"User {user_id} joined document room {document_id}")
        return True
    
    def leave_document_room(self, user_id: str, document_id: str) -> bool:
        """Remove user from a document room"""
        # Remove from document room
        if document_id in self.document_rooms:
            self.document_rooms[document_id].discard(user_id)
            # Clean up empty rooms
            if not self.document_rooms[document_id]:
                del self.document_rooms[document_id]
        
        # Remove from user subscriptions
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].discard(document_id)
        
        logger.info(f"User {user_id} left document room {document_id}")
        return True
    
    async def send_to_document_room(self, document_id: str, message: dict, exclude_user: Optional[str] = None) -> int:
        """Send message to all users in a document room"""
        if document_id not in self.document_rooms:
            return 0
        
        successful_sends = 0
        users_in_room = self.document_rooms[document_id].copy()
        
        for user_id in users_in_room:
            if exclude_user and user_id == exclude_user:
                continue
            
            success = await self.send_to_user(user_id, message)
            if success:
                successful_sends += 1
        
        return successful_sends
    
    def get_document_room_users(self, document_id: str) -> List[str]:
        """Get list of users currently in a document room"""
        return list(self.document_rooms.get(document_id, set()))
    
    def get_user_document_rooms(self, user_id: str) -> List[str]:
        """Get list of document rooms a user is subscribed to"""
        return list(self.user_subscriptions.get(user_id, set()))
    
    async def send_ping(self, user_id: str) -> bool:
        """Send ping to user for heartbeat check"""
        success = await self.send_to_user(user_id, {"type": "ping"})
        if success:
            self.last_ping[user_id] = datetime.utcnow()
        return success
    
    async def handle_pong(self, user_id: str) -> None:
        """Handle pong response from user"""
        self.last_ping[user_id] = datetime.utcnow()
        logger.debug(f"Received pong from user {user_id}")
    
    async def cleanup_stale_connections(self, timeout_minutes: int = 30) -> int:
        """Clean up connections that haven't responded to pings"""
        current_time = datetime.utcnow()
        stale_connections = []
        
        for user_id, last_ping_time in self.last_ping.items():
            time_diff = (current_time - last_ping_time).total_seconds() / 60
            if time_diff > timeout_minutes:
                stale_connections.append(user_id)
        
        # Clean up stale connections
        for user_id in stale_connections:
            websocket = self.active_connections.get(user_id)
            if websocket:
                try:
                    await websocket.close()
                except:
                    pass
                self.disconnect(websocket)
        
        return len(stale_connections)
    
    def get_connection_info(self) -> dict:
        """Get summary information about connections"""
        return {
            "active_connections": len(self.active_connections),
            "document_rooms": len(self.document_rooms),
            "total_subscriptions": sum(len(subs) for subs in self.user_subscriptions.values()),
            "room_details": {
                doc_id: len(users) for doc_id, users in self.document_rooms.items()
            }
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()