"""
API Key Authentication Middleware
"""
from datetime import datetime
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.external_integration import APIKey
from app.models.user import User
from app.services.cache_service import cache_service


class APIKeyBearer(HTTPBearer):
    """API Key authentication scheme"""

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        # Check for API key in X-API-Key header
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return HTTPAuthorizationCredentials(scheme="ApiKey", credentials=api_key)

        # Fall back to Authorization header
        return await super().__call__(request)


api_key_bearer = APIKeyBearer(auto_error=False)


async def get_api_key_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(api_key_bearer),
    db: Session = Depends(get_db)
) -> Optional[tuple[User, APIKey]]:
    """
    Get user from API key authentication

    Returns:
        Tuple of (User, APIKey) if authenticated, None otherwise
    """
    if not credentials:
        return None

    api_key_value = credentials.credentials

    # Try cache first
    cache_key = f"api_key_auth:{api_key_value[:8]}"
    cached_data = await cache_service.get_json(cache_key)

    if cached_data:
        # Verify cache is still valid
        if datetime.fromisoformat(cached_data["expires_at"]) > datetime.utcnow():
            # Get full objects from database
            api_key = db.query(APIKey).filter(APIKey.id == cached_data["api_key_id"]).first()
            user = db.query(User).filter(User.id == cached_data["user_id"]).first()

            if api_key and user and api_key.is_active and user.is_active:
                # Update last used timestamp
                api_key.last_used_at = datetime.utcnow()
                api_key.usage_count += 1
                db.commit()

                return user, api_key

    # Lookup in database
    api_key = db.query(APIKey).filter(
        APIKey.key_value == api_key_value,
        APIKey.is_active == True
    ).first()

    if not api_key:
        return None

    # Check expiration
    if api_key.expires_at and api_key.expires_at < datetime.utcnow():
        return None

    # Get associated user
    user = db.query(User).filter(
        User.id == api_key.created_by,
        User.is_active == True
    ).first()

    if not user:
        return None

    # Update usage statistics
    api_key.last_used_at = datetime.utcnow()
    api_key.usage_count += 1
    db.commit()

    # Cache the result for future lookups
    cache_data = {
        "api_key_id": str(api_key.id),
        "user_id": str(user.id),
        "expires_at": (api_key.expires_at or datetime(2099, 12, 31)).isoformat(),
        "permissions": api_key.permissions
    }
    await cache_service.set_json(cache_key, cache_data, ttl=1800)  # 30 minutes

    return user, api_key


async def require_api_key_permission(
    permission: str,
    auth_result: Optional[tuple[User, APIKey]] = Depends(get_api_key_user)
) -> tuple[User, APIKey]:
    """
    Require specific API key permission

    Args:
        permission: Required permission (e.g., "documents:read")
        auth_result: API key authentication result

    Returns:
        Tuple of (User, APIKey)

    Raises:
        HTTPException: If authentication fails or permission is missing
    """
    if not auth_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid API key required",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    user, api_key = auth_result

    # Check if API key has the required permission
    if permission not in api_key.permissions and "admin:all" not in api_key.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key does not have permission: {permission}"
        )

    return user, api_key


# Permission dependency factories
def require_documents_read():
    """Require documents:read permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("documents:read", auth_result)
    return Depends(dependency)


def require_documents_write():
    """Require documents:write permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("documents:write", auth_result)
    return Depends(dependency)


def require_templates_read():
    """Require templates:read permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("templates:read", auth_result)
    return Depends(dependency)


def require_templates_write():
    """Require templates:write permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("templates:write", auth_result)
    return Depends(dependency)


def require_workflows_read():
    """Require workflows:read permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("workflows:read", auth_result)
    return Depends(dependency)


def require_workflows_write():
    """Require workflows:write permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("workflows:write", auth_result)
    return Depends(dependency)


def require_admin():
    """Require admin:all permission"""
    async def dependency(auth_result=Depends(get_api_key_user)):
        return await require_api_key_permission("admin:all", auth_result)
    return Depends(dependency)