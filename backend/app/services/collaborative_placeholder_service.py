"""
Collaborative placeholder management service for real-time synchronization of Quill placeholder objects
"""
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from app.core.websocket_manager import WebSocketManager
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class PlaceholderUpdate:
    """Represents a placeholder update operation"""
    
    def __init__(
        self,
        update_id: str,
        placeholder_id: str,
        placeholder_type: str,
        document_id: str,
        user_id: str,
        operation: str,  # create, update, delete
        data: Dict[str, Any],
        timestamp: datetime,
        position: Optional[int] = None
    ):
        self.update_id = update_id
        self.placeholder_id = placeholder_id
        self.placeholder_type = placeholder_type
        self.document_id = document_id
        self.user_id = user_id
        self.operation = operation
        self.data = data
        self.timestamp = timestamp
        self.position = position


class CollaborativePlaceholderService:
    """Service for managing collaborative placeholder object synchronization"""
    
    def __init__(self, websocket_manager: WebSocketManager):
        self.websocket_manager = websocket_manager
        
        # Document placeholder state: {document_id: {placeholder_id: PlaceholderData}}
        self.document_placeholders: Dict[str, Dict[str, Dict[str, Any]]] = {}
        
        # Placeholder update history: {document_id: [PlaceholderUpdate]}
        self.update_history: Dict[str, List[PlaceholderUpdate]] = {}
        
        # User placeholder locks: {document_id: {placeholder_id: user_id}}
        self.placeholder_locks: Dict[str, Dict[str, str]] = {}
        
        # Placeholder type handlers
        self.placeholder_handlers = {
            "signature": self._handle_signature_placeholder,
            "long_response": self._handle_long_response_placeholder,
            "line_segment": self._handle_line_segment_placeholder,
            "version_table": self._handle_version_table_placeholder
        }
    
    def create_placeholder(
        self,
        document_id: str,
        placeholder_type: str,
        placeholder_data: Dict[str, Any],
        user_id: str,
        position: Optional[int] = None
    ) -> Optional[str]:
        """Create a new placeholder object"""
        try:
            # Generate placeholder ID
            placeholder_id = self._generate_placeholder_id(placeholder_type)
            
            # Validate placeholder type
            if placeholder_type not in self.placeholder_handlers:
                logger.error(f"Unknown placeholder type: {placeholder_type}")
                return None
            
            # Initialize document placeholders if needed
            if document_id not in self.document_placeholders:
                self.document_placeholders[document_id] = {}
            
            # Create placeholder data
            complete_data = {
                "id": placeholder_id,
                "type": placeholder_type,
                "created_by": user_id,
                "created_at": datetime.utcnow().isoformat(),
                "position": position,
                **placeholder_data
            }
            
            # Validate and process placeholder data
            processed_data = self.placeholder_handlers[placeholder_type](
                complete_data, "create"
            )
            
            if not processed_data:
                logger.error(f"Failed to process {placeholder_type} placeholder")
                return None
            
            # Store placeholder
            self.document_placeholders[document_id][placeholder_id] = processed_data
            
            # Record update
            self._record_update(
                document_id,
                placeholder_id,
                placeholder_type,
                user_id,
                "create",
                processed_data,
                position
            )
            
            logger.info(f"Created {placeholder_type} placeholder {placeholder_id} in document {document_id}")
            return placeholder_id
            
        except Exception as e:
            logger.error(f"Error creating placeholder: {e}")
            return None
    
    def update_placeholder(
        self,
        document_id: str,
        placeholder_id: str,
        updates: Dict[str, Any],
        user_id: str
    ) -> bool:
        """Update an existing placeholder object"""
        try:
            # Check if document and placeholder exist
            if document_id not in self.document_placeholders:
                logger.error(f"Document {document_id} not found")
                return False
            
            if placeholder_id not in self.document_placeholders[document_id]:
                logger.error(f"Placeholder {placeholder_id} not found in document {document_id}")
                return False
            
            # Check if placeholder is locked by another user
            if self._is_placeholder_locked(document_id, placeholder_id, user_id):
                logger.warning(f"Placeholder {placeholder_id} is locked by another user")
                return False
            
            # Get current placeholder data
            current_data = self.document_placeholders[document_id][placeholder_id].copy()
            placeholder_type = current_data.get("type")
            
            # Apply updates
            current_data.update(updates)
            current_data["updated_by"] = user_id
            current_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Process update using type handler
            if placeholder_type in self.placeholder_handlers:
                processed_data = self.placeholder_handlers[placeholder_type](
                    current_data, "update"
                )
                
                if not processed_data:
                    logger.error(f"Failed to process {placeholder_type} placeholder update")
                    return False
                
                # Update stored data
                self.document_placeholders[document_id][placeholder_id] = processed_data
            else:
                # Fallback for unknown types
                self.document_placeholders[document_id][placeholder_id] = current_data
            
            # Record update
            self._record_update(
                document_id,
                placeholder_id,
                placeholder_type or "unknown",
                user_id,
                "update",
                updates
            )
            
            logger.info(f"Updated placeholder {placeholder_id} in document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating placeholder: {e}")
            return False
    
    def delete_placeholder(
        self,
        document_id: str,
        placeholder_id: str,
        user_id: str
    ) -> bool:
        """Delete a placeholder object"""
        try:
            # Check if document and placeholder exist
            if document_id not in self.document_placeholders:
                logger.error(f"Document {document_id} not found")
                return False
            
            if placeholder_id not in self.document_placeholders[document_id]:
                logger.error(f"Placeholder {placeholder_id} not found in document {document_id}")
                return False
            
            # Check if placeholder is locked by another user
            if self._is_placeholder_locked(document_id, placeholder_id, user_id):
                logger.warning(f"Placeholder {placeholder_id} is locked by another user")
                return False
            
            # Get placeholder data before deletion
            placeholder_data = self.document_placeholders[document_id][placeholder_id]
            placeholder_type = placeholder_data.get("type", "unknown")
            
            # Check if placeholder can be deleted (e.g., version tables might be protected)
            if placeholder_type == "version_table":
                logger.warning(f"Cannot delete version table placeholder {placeholder_id}")
                return False
            
            # Delete placeholder
            del self.document_placeholders[document_id][placeholder_id]
            
            # Release any locks
            if document_id in self.placeholder_locks:
                if placeholder_id in self.placeholder_locks[document_id]:
                    del self.placeholder_locks[document_id][placeholder_id]
            
            # Clean up empty document
            if not self.document_placeholders[document_id]:
                del self.document_placeholders[document_id]
            
            # Record deletion
            self._record_update(
                document_id,
                placeholder_id,
                placeholder_type,
                user_id,
                "delete",
                placeholder_data
            )
            
            logger.info(f"Deleted placeholder {placeholder_id} from document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting placeholder: {e}")
            return False
    
    def lock_placeholder(
        self,
        document_id: str,
        placeholder_id: str,
        user_id: str
    ) -> bool:
        """Lock a placeholder for exclusive editing"""
        try:
            # Check if placeholder exists
            if not self._placeholder_exists(document_id, placeholder_id):
                return False
            
            # Initialize locks if needed
            if document_id not in self.placeholder_locks:
                self.placeholder_locks[document_id] = {}
            
            # Check if already locked
            if placeholder_id in self.placeholder_locks[document_id]:
                current_lock_user = self.placeholder_locks[document_id][placeholder_id]
                if current_lock_user != user_id:
                    logger.warning(f"Placeholder {placeholder_id} already locked by user {current_lock_user}")
                    return False
                # Already locked by same user
                return True
            
            # Lock the placeholder
            self.placeholder_locks[document_id][placeholder_id] = user_id
            
            logger.info(f"Locked placeholder {placeholder_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error locking placeholder: {e}")
            return False
    
    def unlock_placeholder(
        self,
        document_id: str,
        placeholder_id: str,
        user_id: str
    ) -> bool:
        """Unlock a placeholder"""
        try:
            if document_id not in self.placeholder_locks:
                return True  # Already unlocked
            
            if placeholder_id not in self.placeholder_locks[document_id]:
                return True  # Already unlocked
            
            current_lock_user = self.placeholder_locks[document_id][placeholder_id]
            
            # Only the lock owner can unlock (or system cleanup)
            if current_lock_user != user_id:
                logger.warning(f"User {user_id} cannot unlock placeholder owned by {current_lock_user}")
                return False
            
            # Remove lock
            del self.placeholder_locks[document_id][placeholder_id]
            
            # Clean up empty document locks
            if not self.placeholder_locks[document_id]:
                del self.placeholder_locks[document_id]
            
            logger.info(f"Unlocked placeholder {placeholder_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error unlocking placeholder: {e}")
            return False
    
    def get_document_placeholders(self, document_id: str) -> Dict[str, Any]:
        """Get all placeholders in a document"""
        try:
            if document_id not in self.document_placeholders:
                return {}
            
            placeholders = self.document_placeholders[document_id].copy()
            
            # Add lock information
            for placeholder_id, placeholder_data in placeholders.items():
                locked_by = None
                if (document_id in self.placeholder_locks and 
                    placeholder_id in self.placeholder_locks[document_id]):
                    locked_by = self.placeholder_locks[document_id][placeholder_id]
                
                placeholder_data["locked_by"] = locked_by
                placeholder_data["is_locked"] = locked_by is not None
            
            return placeholders
            
        except Exception as e:
            logger.error(f"Error getting document placeholders: {e}")
            return {}
    
    def get_placeholder_updates_since(
        self,
        document_id: str,
        since_timestamp: datetime
    ) -> List[Dict[str, Any]]:
        """Get placeholder updates since a specific timestamp"""
        try:
            if document_id not in self.update_history:
                return []
            
            updates = []
            for update in self.update_history[document_id]:
                if update.timestamp > since_timestamp:
                    updates.append({
                        "update_id": update.update_id,
                        "placeholder_id": update.placeholder_id,
                        "placeholder_type": update.placeholder_type,
                        "user_id": update.user_id,
                        "operation": update.operation,
                        "data": update.data,
                        "timestamp": update.timestamp.isoformat(),
                        "position": update.position
                    })
            
            return updates
            
        except Exception as e:
            logger.error(f"Error getting placeholder updates: {e}")
            return []
    
    async def broadcast_placeholder_update(
        self,
        document_id: str,
        placeholder_id: str,
        operation: str,
        user_id: str,
        data: Dict[str, Any],
        exclude_user: Optional[str] = None
    ):
        """Broadcast placeholder update to document collaborators"""
        try:
            message = {
                "type": "placeholder_update",
                "document_id": document_id,
                "placeholder_id": placeholder_id,
                "operation": operation,
                "user_id": user_id,
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.websocket_manager.send_to_document_room(
                document_id,
                message,
                exclude_user=exclude_user
            )
            
        except Exception as e:
            logger.error(f"Error broadcasting placeholder update: {e}")
    
    def _generate_placeholder_id(self, placeholder_type: str) -> str:
        """Generate a unique placeholder ID"""
        import uuid
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"{placeholder_type}_{timestamp}_{unique_id}"
    
    def _record_update(
        self,
        document_id: str,
        placeholder_id: str,
        placeholder_type: str,
        user_id: str,
        operation: str,
        data: Dict[str, Any],
        position: Optional[int] = None
    ):
        """Record a placeholder update in history"""
        try:
            import uuid
            
            update = PlaceholderUpdate(
                update_id=str(uuid.uuid4()),
                placeholder_id=placeholder_id,
                placeholder_type=placeholder_type,
                document_id=document_id,
                user_id=user_id,
                operation=operation,
                data=data,
                timestamp=datetime.utcnow(),
                position=position
            )
            
            if document_id not in self.update_history:
                self.update_history[document_id] = []
            
            self.update_history[document_id].append(update)
            
            # Keep only last 1000 updates per document
            if len(self.update_history[document_id]) > 1000:
                self.update_history[document_id] = self.update_history[document_id][-1000:]
                
        except Exception as e:
            logger.error(f"Error recording placeholder update: {e}")
    
    def _placeholder_exists(self, document_id: str, placeholder_id: str) -> bool:
        """Check if a placeholder exists"""
        return (document_id in self.document_placeholders and 
                placeholder_id in self.document_placeholders[document_id])
    
    def _is_placeholder_locked(self, document_id: str, placeholder_id: str, user_id: str) -> bool:
        """Check if placeholder is locked by another user"""
        if document_id not in self.placeholder_locks:
            return False
        
        if placeholder_id not in self.placeholder_locks[document_id]:
            return False
        
        lock_owner = self.placeholder_locks[document_id][placeholder_id]
        return lock_owner != user_id
    
    # Placeholder type handlers
    
    def _handle_signature_placeholder(self, data: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
        """Handle signature placeholder operations"""
        required_fields = ["label"]
        optional_fields = ["includeTitle", "includeDate", "required"]
        
        # Validate required fields
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field '{field}' for signature placeholder")
                return None
        
        # Set defaults for optional fields
        if "includeTitle" not in data:
            data["includeTitle"] = True
        if "includeDate" not in data:
            data["includeDate"] = True
        if "required" not in data:
            data["required"] = True
        
        return data
    
    def _handle_long_response_placeholder(self, data: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
        """Handle long response area placeholder operations"""
        required_fields = ["lines"]
        optional_fields = ["label", "placeholder_text"]
        
        # Validate required fields
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field '{field}' for long response placeholder")
                return None
        
        # Validate lines value
        if not isinstance(data["lines"], int) or data["lines"] < 1:
            logger.error("Lines must be a positive integer for long response placeholder")
            return None
        
        # Set defaults
        if "label" not in data:
            data["label"] = "Response"
        if "placeholder_text" not in data:
            data["placeholder_text"] = "Enter your response here..."
        
        return data
    
    def _handle_line_segment_placeholder(self, data: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
        """Handle line segment placeholder operations"""
        required_fields = ["length"]
        valid_lengths = ["short", "medium", "long"]
        
        # Validate required fields
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field '{field}' for line segment placeholder")
                return None
        
        # Validate length value
        if data["length"] not in valid_lengths:
            logger.error(f"Invalid length '{data['length']}' for line segment. Must be one of: {valid_lengths}")
            return None
        
        # Set defaults
        if "label" not in data:
            data["label"] = "Input"
        
        return data
    
    def _handle_version_table_placeholder(self, data: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
        """Handle version table placeholder operations"""
        # Version tables are immutable once created
        if operation == "update":
            logger.warning("Version table placeholders cannot be updated after creation")
            return None
        
        # Set version table data
        if operation == "create":
            data["immutable"] = True
            data["protected"] = True
            if "version" not in data:
                data["version"] = 1
        
        return data