"""
Presence awareness service for real-time collaborative editing
"""
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from app.core.websocket_manager import WebSocketManager
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class UserPresence:
    """Represents user presence information"""
    
    def __init__(
        self,
        user_id: str,
        user_name: str,
        document_id: str,
        cursor_position: Optional[int] = None,
        selection_range: Optional[Dict[str, int]] = None,
        last_seen: Optional[datetime] = None,
        color: Optional[str] = None
    ):
        self.user_id = user_id
        self.user_name = user_name
        self.document_id = document_id
        self.cursor_position = cursor_position
        self.selection_range = selection_range
        self.last_seen = last_seen or datetime.utcnow()
        self.color = color or self._generate_user_color()
    
    def _generate_user_color(self) -> str:
        """Generate a consistent color for the user based on their ID"""
        colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
            "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
        ]
        # Use hash of user_id to get consistent color
        color_index = hash(self.user_id) % len(colors)
        return colors[color_index]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert presence to dictionary for API responses"""
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "document_id": self.document_id,
            "cursor_position": self.cursor_position,
            "selection_range": self.selection_range,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "color": self.color,
            "is_active": self.is_active()
        }
    
    def is_active(self, timeout_minutes: int = 5) -> bool:
        """Check if user is considered active (within timeout period)"""
        if not self.last_seen:
            return False
        return datetime.utcnow() - self.last_seen < timedelta(minutes=timeout_minutes)


class PresenceService:
    """Service for managing user presence in documents"""
    
    def __init__(self, websocket_manager: WebSocketManager):
        self.websocket_manager = websocket_manager
        
        # Document presence tracking: {document_id: {user_id: UserPresence}}
        self.document_presence: Dict[str, Dict[str, UserPresence]] = {}
        
        # User activity timestamps for cleanup
        self.user_activity: Dict[str, datetime] = {}
        
        # Presence update debouncing
        self.presence_debounce: Dict[str, datetime] = {}
    
    def join_document(self, user: User, document_id: str) -> UserPresence:
        """User joins a document for collaborative editing"""
        try:
            user_presence = UserPresence(
                user_id=user.id,
                user_name=user.full_name or user.email,
                document_id=document_id
            )
            
            # Initialize document presence if needed
            if document_id not in self.document_presence:
                self.document_presence[document_id] = {}
            
            # Add user to document presence
            self.document_presence[document_id][user.id] = user_presence
            self.user_activity[user.id] = datetime.utcnow()
            
            logger.info(f"User {user.id} joined document {document_id}")
            return user_presence
            
        except Exception as e:
            logger.error(f"Error adding user {user.id} to document {document_id}: {e}")
            raise
    
    def leave_document(self, user_id: str, document_id: str) -> bool:
        """User leaves a document"""
        try:
            if document_id in self.document_presence:
                if user_id in self.document_presence[document_id]:
                    del self.document_presence[document_id][user_id]
                    
                    # Clean up empty document presence
                    if not self.document_presence[document_id]:
                        del self.document_presence[document_id]
                    
                    # Clean up user activity
                    if user_id in self.user_activity:
                        del self.user_activity[user_id]
                    
                    logger.info(f"User {user_id} left document {document_id}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error removing user {user_id} from document {document_id}: {e}")
            return False
    
    def update_cursor_position(
        self, 
        user_id: str, 
        document_id: str, 
        cursor_position: int,
        selection_range: Optional[Dict[str, int]] = None
    ) -> bool:
        """Update user's cursor position and selection"""
        try:
            if document_id not in self.document_presence:
                logger.warning(f"Document {document_id} not found in presence tracking")
                return False
            
            if user_id not in self.document_presence[document_id]:
                logger.warning(f"User {user_id} not found in document {document_id} presence")
                return False
            
            # Check debounce to avoid too frequent updates
            debounce_key = f"{user_id}:{document_id}"
            now = datetime.utcnow()
            if debounce_key in self.presence_debounce:
                if now - self.presence_debounce[debounce_key] < timedelta(milliseconds=100):
                    return True  # Skip update but don't fail
            
            # Update presence
            presence = self.document_presence[document_id][user_id]
            presence.cursor_position = cursor_position
            presence.selection_range = selection_range
            presence.last_seen = now
            
            # Update activity and debounce
            self.user_activity[user_id] = now
            self.presence_debounce[debounce_key] = now
            
            logger.debug(f"Updated cursor position for user {user_id} in document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating cursor position for user {user_id}: {e}")
            return False
    
    def get_document_presence(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all active users in a document"""
        try:
            if document_id not in self.document_presence:
                return []
            
            active_users = []
            for user_id, presence in self.document_presence[document_id].items():
                if presence.is_active():
                    active_users.append(presence.to_dict())
            
            return active_users
            
        except Exception as e:
            logger.error(f"Error getting document presence for {document_id}: {e}")
            return []
    
    def get_user_presence(self, user_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        """Get specific user's presence in a document"""
        try:
            if document_id in self.document_presence:
                if user_id in self.document_presence[document_id]:
                    presence = self.document_presence[document_id][user_id]
                    if presence.is_active():
                        return presence.to_dict()
            return None
            
        except Exception as e:
            logger.error(f"Error getting user presence for {user_id} in {document_id}: {e}")
            return None
    
    async def broadcast_presence_update(
        self, 
        user_id: str, 
        document_id: str,
        presence_data: Dict[str, Any],
        exclude_user: Optional[str] = None
    ):
        """Broadcast presence update to document collaborators"""
        try:
            message = {
                "type": "presence_update",
                "document_id": document_id,
                "user_id": user_id,
                "presence": presence_data,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.websocket_manager.send_to_document_room(
                document_id,
                message,
                exclude_user=exclude_user
            )
            
        except Exception as e:
            logger.error(f"Error broadcasting presence update: {e}")
    
    async def broadcast_user_joined(self, user_id: str, document_id: str, user_name: str):
        """Broadcast that a user joined the document"""
        try:
            message = {
                "type": "user_joined",
                "document_id": document_id,
                "user_id": user_id,
                "user_name": user_name,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.websocket_manager.send_to_document_room(
                document_id,
                message,
                exclude_user=user_id
            )
            
        except Exception as e:
            logger.error(f"Error broadcasting user joined: {e}")
    
    async def broadcast_user_left(self, user_id: str, document_id: str, user_name: str):
        """Broadcast that a user left the document"""
        try:
            message = {
                "type": "user_left",
                "document_id": document_id,
                "user_id": user_id,
                "user_name": user_name,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.websocket_manager.send_to_document_room(
                document_id,
                message,
                exclude_user=user_id
            )
            
        except Exception as e:
            logger.error(f"Error broadcasting user left: {e}")
    
    def cleanup_inactive_users(self, timeout_minutes: int = 5):
        """Remove inactive users from presence tracking"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
            inactive_users = []
            
            # Find inactive users
            for document_id, users in self.document_presence.items():
                for user_id, presence in list(users.items()):
                    if not presence.is_active(timeout_minutes):
                        inactive_users.append((user_id, document_id))
                        del users[user_id]
                
                # Clean up empty documents
                if not users:
                    del self.document_presence[document_id]
            
            # Clean up user activity
            for user_id in list(self.user_activity.keys()):
                if self.user_activity[user_id] < cutoff_time:
                    del self.user_activity[user_id]
            
            # Clean up debounce tracking
            for key in list(self.presence_debounce.keys()):
                if self.presence_debounce[key] < cutoff_time:
                    del self.presence_debounce[key]
            
            if inactive_users:
                logger.info(f"Cleaned up {len(inactive_users)} inactive users from presence tracking")
            
            return len(inactive_users)
            
        except Exception as e:
            logger.error(f"Error cleaning up inactive users: {e}")
            return 0
    
    def get_presence_statistics(self) -> Dict[str, Any]:
        """Get presence service statistics"""
        try:
            total_documents = len(self.document_presence)
            total_active_users = sum(
                len([p for p in users.values() if p.is_active()]) 
                for users in self.document_presence.values()
            )
            
            document_stats = {}
            for doc_id, users in self.document_presence.items():
                active_count = len([p for p in users.values() if p.is_active()])
                document_stats[doc_id] = {
                    "active_users": active_count,
                    "total_users": len(users)
                }
            
            return {
                "total_documents": total_documents,
                "total_active_users": total_active_users,
                "document_stats": document_stats,
                "cleanup_candidates": len([
                    u for u in self.user_activity.values() 
                    if datetime.utcnow() - u > timedelta(minutes=5)
                ])
            }
            
        except Exception as e:
            logger.error(f"Error getting presence statistics: {e}")
            return {}