"""
User model for CA-DMS with authentication support
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.core.database import Base


class UserRole(enum.Enum):
    """User roles for RBAC"""
    ADMIN = "admin"
    BOARD_MEMBER = "board_member"
    MANAGER = "manager"
    RESIDENT = "resident"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    
    # Profile information
    full_name = Column(String(255), nullable=True)
    title = Column(String(100), nullable=True)  # e.g., "Board President", "Property Manager"
    phone = Column(String(50), nullable=True)
    
    # Role and permissions
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.RESIDENT)
    permissions = Column(JSON, nullable=True)  # Additional granular permissions
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Password reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Email verification
    verification_token = Column(String, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role.value})>"
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission"""
        if self.is_superuser:
            return True
        
        # Check role-based permissions
        role_permissions = {
            UserRole.ADMIN: ["all"],
            UserRole.BOARD_MEMBER: ["create", "read", "update", "delete", "approve"],
            UserRole.MANAGER: ["create", "read", "update"],
            UserRole.RESIDENT: ["read", "create_own"],
            UserRole.VIEWER: ["read"]
        }
        
        if "all" in role_permissions.get(self.role, []):
            return True
        
        if permission in role_permissions.get(self.role, []):
            return True
        
        # Check additional granular permissions
        if self.permissions and permission in self.permissions:
            return True
        
        return False
    
    def can_edit_document(self, document_id: str, created_by: str) -> bool:
        """Check if user can edit a specific document"""
        if self.is_superuser:
            return True
        
        if self.role in [UserRole.ADMIN, UserRole.BOARD_MEMBER]:
            return True
        
        if self.role == UserRole.MANAGER:
            return True
        
        # Users can edit their own documents
        if created_by == self.id and self.has_permission("create_own"):
            return True
        
        return False