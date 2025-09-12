"""
WebSocket endpoints for real-time collaboration
"""
import json
import asyncio
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from app.core.websocket_manager import websocket_manager
from app.core.websocket_auth import get_user_from_websocket_token
from app.services.presence_service import PresenceService
from app.services.collaborative_placeholder_service import CollaborativePlaceholderService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global service instances
presence_service = PresenceService(websocket_manager)
placeholder_service = CollaborativePlaceholderService(websocket_manager)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Main WebSocket endpoint for real-time collaboration
    """
    user = None
    
    try:
        # Authenticate user
        user = await get_user_from_websocket_token(token)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Connect user
        await websocket_manager.connect(websocket, user.id)
        
        # Start heartbeat task
        heartbeat_task = asyncio.create_task(heartbeat_loop(user.id))
        
        try:
            while True:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_websocket_message(user.id, message)
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {user.id}")
        except Exception as e:
            logger.error(f"WebSocket error for user {user.id}: {e}")
        finally:
            # Cancel heartbeat and cleanup
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
    
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        # Clean up connection
        if user:
            websocket_manager.disconnect(websocket)


async def handle_websocket_message(user_id: str, message: dict):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")
    
    if message_type == "join_document":
        document_id = message.get("document_id")
        if document_id:
            success = websocket_manager.join_document_room(user_id, document_id)
            
            # Notify other users in the room
            if success:
                await websocket_manager.send_to_document_room(
                    document_id,
                    {
                        "type": "user_joined",
                        "user_id": user_id,
                        "document_id": document_id
                    },
                    exclude_user=user_id
                )
                
                # Send current room members to joining user
                room_users = websocket_manager.get_document_room_users(document_id)
                await websocket_manager.send_to_user(user_id, {
                    "type": "room_members",
                    "document_id": document_id,
                    "users": room_users
                })
    
    elif message_type == "leave_document":
        document_id = message.get("document_id")
        if document_id:
            success = websocket_manager.leave_document_room(user_id, document_id)
            
            # Notify other users in the room
            if success:
                await websocket_manager.send_to_document_room(
                    document_id,
                    {
                        "type": "user_left",
                        "user_id": user_id,
                        "document_id": document_id
                    },
                    exclude_user=user_id
                )
    
    elif message_type == "pong":
        await websocket_manager.handle_pong(user_id)
    
    elif message_type == "document_operation":
        # Handle document operations (will be expanded in Task 4.1.2)
        document_id = message.get("document_id")
        operation = message.get("operation")
        
        if document_id and operation:
            # Broadcast operation to other users in the document room
            await websocket_manager.send_to_document_room(
                document_id,
                {
                    "type": "document_operation",
                    "document_id": document_id,
                    "operation": operation,
                    "user_id": user_id
                },
                exclude_user=user_id
            )
    
    elif message_type == "cursor_position":
        # Handle cursor position updates with presence awareness
        document_id = message.get("document_id")
        position = message.get("position")
        selection_range = message.get("selection_range")
        
        if document_id is not None and position is not None:
            # Update cursor position in presence service
            success = presence_service.update_cursor_position(
                user_id,
                document_id,
                position,
                selection_range
            )
            
            if success:
                # Get updated presence data
                user_presence = presence_service.get_user_presence(user_id, document_id)
                
                # Broadcast presence update to other users
                if user_presence:
                    await websocket_manager.send_to_document_room(
                        document_id,
                        {
                            "type": "presence_update",
                            "document_id": document_id,
                            "user_id": user_id,
                            "presence": user_presence
                        },
                        exclude_user=user_id
                    )
    
    elif message_type == "placeholder_lock":
        # Handle placeholder locking via WebSocket
        document_id = message.get("document_id")
        placeholder_id = message.get("placeholder_id")
        
        if document_id and placeholder_id:
            success = placeholder_service.lock_placeholder(
                document_id,
                placeholder_id,
                user_id
            )
            
            if success:
                # Broadcast lock to other users
                await placeholder_service.broadcast_placeholder_update(
                    document_id,
                    placeholder_id,
                    "lock",
                    user_id,
                    {"locked_by": user_id},
                    exclude_user=user_id
                )
            
            # Send response to requesting user
            await websocket_manager.send_to_user(user_id, {
                "type": "placeholder_lock_response",
                "document_id": document_id,
                "placeholder_id": placeholder_id,
                "success": success
            })
    
    elif message_type == "placeholder_unlock":
        # Handle placeholder unlocking via WebSocket
        document_id = message.get("document_id")
        placeholder_id = message.get("placeholder_id")
        
        if document_id and placeholder_id:
            success = placeholder_service.unlock_placeholder(
                document_id,
                placeholder_id,
                user_id
            )
            
            if success:
                # Broadcast unlock to other users
                await placeholder_service.broadcast_placeholder_update(
                    document_id,
                    placeholder_id,
                    "unlock",
                    user_id,
                    {"locked_by": None},
                    exclude_user=user_id
                )
            
            # Send response to requesting user
            await websocket_manager.send_to_user(user_id, {
                "type": "placeholder_unlock_response",
                "document_id": document_id,
                "placeholder_id": placeholder_id,
                "success": success
            })
    
    else:
        logger.warning(f"Unknown message type: {message_type} from user {user_id}")


async def heartbeat_loop(user_id: str):
    """Send periodic heartbeat pings to maintain connection"""
    try:
        while True:
            await asyncio.sleep(30)  # Send ping every 30 seconds
            success = await websocket_manager.send_ping(user_id)
            if not success:
                break  # Connection lost
    except asyncio.CancelledError:
        pass


@router.get("/ws/status")
async def get_websocket_status():
    """Get WebSocket connection status (for monitoring)"""
    return websocket_manager.get_connection_info()


@router.post("/ws/cleanup")
async def cleanup_stale_connections():
    """Clean up stale WebSocket connections (admin endpoint)"""
    cleaned_count = await websocket_manager.cleanup_stale_connections()
    return {
        "message": f"Cleaned up {cleaned_count} stale connections",
        "cleaned_connections": cleaned_count
    }