"""
WebSocket authentication utilities
"""
from typing import Optional
from fastapi import HTTPException, status
from jose import JWTError, jwt
from app.core.config import settings
from app.models.user import User
from app.core.database import SessionLocal


async def authenticate_websocket_token(token: str) -> Optional[User]:
    """
    Authenticate WebSocket connection using JWT token
    """
    try:
        # Decode JWT token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        
        # Get user from database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            return user
        finally:
            db.close()
            
    except JWTError:
        return None


async def get_user_from_websocket_token(token: Optional[str]) -> Optional[User]:
    """
    Extract and validate user from WebSocket token parameter
    """
    if not token:
        return None
    
    return await authenticate_websocket_token(token)