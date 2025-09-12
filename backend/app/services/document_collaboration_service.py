"""
Document collaboration service for real-time collaborative editing
"""
import json
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.document import Document
from app.models.user import User
from app.core.websocket_manager import WebSocketManager
from app.schemas.document import DocumentUpdate
import uuid
import logging

logger = logging.getLogger(__name__)


class DocumentOperation:
    """Represents a document operation for collaborative editing"""
    
    def __init__(
        self, 
        operation_id: str,
        document_id: str,
        user_id: str,
        operation: Dict[str, Any],
        timestamp: datetime,
        version: int
    ):
        self.operation_id = operation_id
        self.document_id = document_id
        self.user_id = user_id
        self.operation = operation
        self.timestamp = timestamp
        self.version = version


class DocumentCollaborationService:
    """Service for managing real-time document collaboration"""
    
    def __init__(self, db: Session, websocket_manager: WebSocketManager):
        self.db = db
        self.websocket_manager = websocket_manager
        
        # In-memory storage for operations (in production, use Redis or similar)
        self.operation_history: Dict[str, List[DocumentOperation]] = {}
        self.document_versions: Dict[str, int] = {}
        self.operation_queues: Dict[str, Dict[str, List[DocumentOperation]]] = {}
        self.document_snapshots: Dict[str, List[Dict[str, Any]]] = {}
        self.user_operation_stacks: Dict[str, Dict[str, List[DocumentOperation]]] = {}  # For undo/redo
    
    def get_document(self, document_id: str) -> Optional[Document]:
        """Get document by ID"""
        return self.db.query(Document).filter(Document.id == document_id).first()
    
    def get_document_version(self, document_id: str) -> int:
        """Get current version of document"""
        return self.document_versions.get(document_id, 0)
    
    def get_document_state(self, document_id: str) -> Dict[str, Any]:
        """Get current document state with version"""
        document = self.get_document(document_id)
        if not document:
            return {"version": 0, "content": None}
        
        return {
            "version": self.get_document_version(document_id),
            "content": document.content,
            "last_modified": document.updated_at.isoformat() if document.updated_at else None
        }
    
    def apply_delta_operation(self, document_id: str, operation: Dict[str, Any], user_id: str) -> bool:
        """Apply a Delta operation to the document"""
        try:
            document = self.get_document(document_id)
            if not document:
                logger.error(f"Document {document_id} not found")
                return False
            
            # Create operation record
            current_version = self.get_document_version(document_id)
            operation_id = str(uuid.uuid4())
            
            doc_operation = DocumentOperation(
                operation_id=operation_id,
                document_id=document_id,
                user_id=user_id,
                operation=operation,
                timestamp=datetime.utcnow(),
                version=current_version + 1
            )
            
            # Apply the Delta operation to document content
            new_content = self._apply_delta_to_content(document.content, operation)
            if new_content is None:
                logger.error(f"Failed to apply Delta operation to document {document_id}")
                return False
            
            # Update document
            document.content = new_content
            document.updated_at = datetime.utcnow()
            
            # Increment version
            self.document_versions[document_id] = current_version + 1
            
            # Store operation in history
            if document_id not in self.operation_history:
                self.operation_history[document_id] = []
            self.operation_history[document_id].append(doc_operation)
            
            # Store in user's operation stack for undo/redo
            if user_id not in self.user_operation_stacks:
                self.user_operation_stacks[user_id] = {}
            if document_id not in self.user_operation_stacks[user_id]:
                self.user_operation_stacks[user_id][document_id] = []
            self.user_operation_stacks[user_id][document_id].append(doc_operation)
            
            # Commit to database
            self.db.commit()
            
            logger.info(f"Applied Delta operation to document {document_id} by user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error applying Delta operation: {e}")
            self.db.rollback()
            return False
    
    def _apply_delta_to_content(self, current_content: Dict[str, Any], operation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Apply Delta operation to document content"""
        try:
            if operation.get("type") != "delta":
                return None
            
            ops = operation.get("ops", [])
            if not ops:
                return current_content
            
            # Get current ops from content
            current_ops = current_content.get("ops", [])
            
            # Apply Delta operations
            result_ops = self._compose_deltas(current_ops, ops)
            
            return {"ops": result_ops}
            
        except Exception as e:
            logger.error(f"Error applying Delta to content: {e}")
            return None
    
    def _compose_deltas(self, base_ops: List[Dict], new_ops: List[Dict]) -> List[Dict]:
        """Compose two sets of Delta operations"""
        # This is a simplified Delta composition - in production, use a proper Delta library like quill-delta-python
        try:
            # Convert to text, apply changes, convert back (simplified approach)
            base_text = self._ops_to_text(base_ops)
            modified_text = self._apply_ops_to_text(base_text, new_ops)
            
            # Convert back to ops (simplified)
            return [{"insert": modified_text}] if modified_text else []
            
        except Exception as e:
            logger.error(f"Error composing deltas: {e}")
            return base_ops
    
    def _ops_to_text(self, ops: List[Dict]) -> str:
        """Convert Delta ops to plain text (simplified)"""
        text = ""
        for op in ops:
            if "insert" in op:
                text += str(op["insert"])
        return text
    
    def _apply_ops_to_text(self, text: str, ops: List[Dict]) -> str:
        """Apply Delta ops to text (simplified)"""
        result = text
        position = 0
        
        for op in ops:
            if "retain" in op:
                position += op["retain"]
            elif "insert" in op:
                insert_text = str(op["insert"])
                result = result[:position] + insert_text + result[position:]
                position += len(insert_text)
            elif "delete" in op:
                delete_count = op["delete"]
                result = result[:position] + result[position + delete_count:]
        
        return result
    
    def extract_text_from_delta(self, content: Dict[str, Any]) -> str:
        """Extract plain text from Delta content"""
        if not content or "ops" not in content:
            return ""
        
        return self._ops_to_text(content["ops"])
    
    async def _broadcast_operation(self, operation: DocumentOperation, exclude_user: Optional[str] = None):
        """Broadcast operation to other collaborators"""
        try:
            message = {
                "type": "document_operation",
                "document_id": operation.document_id,
                "operation_id": operation.operation_id,
                "operation": operation.operation,
                "user_id": operation.user_id,
                "version": operation.version,
                "timestamp": operation.timestamp.isoformat()
            }
            
            await self.websocket_manager.send_to_document_room(
                operation.document_id,
                message,
                exclude_user=exclude_user
            )
            
        except Exception as e:
            logger.error(f"Error broadcasting operation: {e}")
    
    def get_operations_since(self, document_id: str, since_version: int) -> List[Dict[str, Any]]:
        """Get operations since a specific version"""
        operations = self.operation_history.get(document_id, [])
        
        result = []
        for op in operations:
            if op.version > since_version:
                result.append({
                    "operation_id": op.operation_id,
                    "operation": op.operation,
                    "user_id": op.user_id,
                    "version": op.version,
                    "timestamp": op.timestamp.isoformat()
                })
        
        return result
    
    def resolve_conflicts(self, operations: List[Dict[str, Any]], document_id: str) -> List[Dict[str, Any]]:
        """Resolve conflicts using Operational Transform (simplified)"""
        try:
            if len(operations) <= 1:
                return operations
            
            # For this implementation, we'll use a simple "last writer wins" approach
            # In a production system, you'd implement proper Operational Transform
            
            # Sort by timestamp to ensure consistent ordering
            sorted_ops = sorted(operations, key=lambda op: op.get("timestamp", ""))
            
            # Transform operations to avoid conflicts
            resolved_ops = []
            for i, op in enumerate(sorted_ops):
                # Simple transformation: adjust retain positions for previous insertions
                transformed_op = self._transform_operation(op, resolved_ops)
                resolved_ops.append(transformed_op)
            
            return resolved_ops
            
        except Exception as e:
            logger.error(f"Error resolving conflicts: {e}")
            return operations
    
    def _transform_operation(self, operation: Dict[str, Any], previous_ops: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Transform an operation based on previous operations (simplified OT)"""
        try:
            if operation.get("type") != "delta":
                return operation
            
            transformed_ops = []
            ops = operation.get("ops", [])
            
            # Calculate offset from previous insertions
            total_offset = 0
            for prev_op in previous_ops:
                if prev_op.get("type") == "delta":
                    for prev_delta in prev_op.get("ops", []):
                        if "insert" in prev_delta:
                            total_offset += len(str(prev_delta["insert"]))
            
            # Apply offset to retain operations
            for op in ops:
                if "retain" in op and total_offset > 0:
                    transformed_ops.append({"retain": op["retain"] + total_offset})
                    total_offset = 0  # Only apply offset once
                else:
                    transformed_ops.append(op)
            
            return {
                **operation,
                "ops": transformed_ops
            }
            
        except Exception as e:
            logger.error(f"Error transforming operation: {e}")
            return operation
    
    def queue_operation(self, document_id: str, operation: Dict[str, Any], user_id: str) -> bool:
        """Queue an operation for later processing"""
        try:
            if document_id not in self.operation_queues:
                self.operation_queues[document_id] = {}
            
            if user_id not in self.operation_queues[document_id]:
                self.operation_queues[document_id][user_id] = []
            
            doc_operation = DocumentOperation(
                operation_id=str(uuid.uuid4()),
                document_id=document_id,
                user_id=user_id,
                operation=operation,
                timestamp=datetime.utcnow(),
                version=self.get_document_version(document_id) + 1
            )
            
            self.operation_queues[document_id][user_id].append(doc_operation)
            return True
            
        except Exception as e:
            logger.error(f"Error queuing operation: {e}")
            return False
    
    def get_queued_operations(self, document_id: str, user_id: str) -> List[DocumentOperation]:
        """Get queued operations for a user"""
        return self.operation_queues.get(document_id, {}).get(user_id, [])
    
    def process_operation_queue(self, document_id: str, user_id: str) -> bool:
        """Process queued operations for a user"""
        try:
            queued_ops = self.get_queued_operations(document_id, user_id)
            
            for operation in queued_ops:
                success = self.apply_delta_operation(
                    document_id, 
                    operation.operation, 
                    user_id
                )
                if not success:
                    logger.warning(f"Failed to process queued operation {operation.operation_id}")
            
            # Clear queue after processing
            if document_id in self.operation_queues and user_id in self.operation_queues[document_id]:
                self.operation_queues[document_id][user_id] = []
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing operation queue: {e}")
            return False
    
    def create_document_snapshot(self, document_id: str) -> Dict[str, Any]:
        """Create a snapshot of the current document state"""
        try:
            document = self.get_document(document_id)
            if not document:
                return {}
            
            snapshot = {
                "snapshot_id": str(uuid.uuid4()),
                "document_id": document_id,
                "version": self.get_document_version(document_id),
                "content": document.content,
                "created_at": datetime.utcnow().isoformat(),
                "operations_count": len(self.operation_history.get(document_id, []))
            }
            
            # Store snapshot
            if document_id not in self.document_snapshots:
                self.document_snapshots[document_id] = []
            self.document_snapshots[document_id].append(snapshot)
            
            # Keep only last 10 snapshots
            if len(self.document_snapshots[document_id]) > 10:
                self.document_snapshots[document_id] = self.document_snapshots[document_id][-10:]
            
            return snapshot
            
        except Exception as e:
            logger.error(f"Error creating document snapshot: {e}")
            return {}
    
    def undo_operation(self, document_id: str, user_id: str) -> bool:
        """Undo the last operation by a user"""
        try:
            user_ops = self.user_operation_stacks.get(user_id, {}).get(document_id, [])
            
            if not user_ops:
                return False
            
            # Get the last operation
            last_operation = user_ops.pop()
            
            # Create inverse operation (simplified)
            inverse_op = self._create_inverse_operation(last_operation.operation)
            if not inverse_op:
                # Re-add the operation if we can't create inverse
                user_ops.append(last_operation)
                return False
            
            # Apply inverse operation
            success = self.apply_delta_operation(document_id, inverse_op, user_id)
            
            if not success:
                # Re-add the operation if inverse failed
                user_ops.append(last_operation)
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error undoing operation: {e}")
            return False
    
    def redo_operation(self, document_id: str, user_id: str) -> bool:
        """Redo the last undone operation by a user"""
        try:
            # For this simplified implementation, we'll store undone operations separately
            # In a production system, you'd have a more sophisticated undo/redo stack
            
            # This is a simplified implementation - proper redo would require
            # maintaining separate undo and redo stacks
            return False  # Not implemented in this simplified version
            
        except Exception as e:
            logger.error(f"Error redoing operation: {e}")
            return False
    
    def _create_inverse_operation(self, operation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create an inverse operation (simplified)"""
        try:
            if operation.get("type") != "delta":
                return None
            
            ops = operation.get("ops", [])
            inverse_ops = []
            
            for op in ops:
                if "insert" in op:
                    # Insert becomes delete
                    text = str(op["insert"])
                    inverse_ops.append({"delete": len(text)})
                elif "delete" in op:
                    # Delete becomes insert (we'd need to know what was deleted)
                    # This is simplified - proper implementation needs more context
                    inverse_ops.append({"insert": "DELETED_TEXT"})
                elif "retain" in op:
                    # Retain operations don't need inverses
                    inverse_ops.append(op)
            
            return {
                "type": "delta",
                "ops": inverse_ops
            }
            
        except Exception as e:
            logger.error(f"Error creating inverse operation: {e}")
            return None
    
    def get_active_collaborators(self, document_id: str) -> List[str]:
        """Get list of users currently collaborating on document"""
        return self.websocket_manager.get_document_room_users(document_id)
    
    def get_collaboration_statistics(self, document_id: str) -> Dict[str, Any]:
        """Get collaboration statistics for a document"""
        try:
            operations = self.operation_history.get(document_id, [])
            active_collaborators = self.get_active_collaborators(document_id)
            
            # User activity stats
            user_activity = {}
            for op in operations:
                if op.user_id not in user_activity:
                    user_activity[op.user_id] = 0
                user_activity[op.user_id] += 1
            
            return {
                "document_id": document_id,
                "total_operations": len(operations),
                "active_collaborators": len(active_collaborators),
                "collaborator_ids": active_collaborators,
                "current_version": self.get_document_version(document_id),
                "user_activity": user_activity,
                "last_activity": operations[-1].timestamp.isoformat() if operations else None
            }
            
        except Exception as e:
            logger.error(f"Error getting collaboration statistics: {e}")
            return {}