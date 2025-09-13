"""
User service layer for authentication and user management
"""
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password, create_verification_token, create_reset_token
import uuid


class UserService:
    """Service layer for user operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        # Check if email or username already exists
        existing_user = self.db.query(User).filter(
            or_(User.email == user_data.email, User.username == user_data.username)
        ).first()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise ValueError("Email already registered")
            else:
                raise ValueError("Username already taken")
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user instance
        db_user = User(
            id=str(uuid.uuid4()),
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            title=user_data.title,
            phone=user_data.phone,
            role=user_data.role or UserRole.RESIDENT,
            verification_token=create_verification_token(user_data.email)
        )
        
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        
        return db_user
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password"""
        user = self.get_user_by_email(email)
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.commit()
        
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get a user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username"""
        return self.db.query(User).filter(User.username == username).first()
    
    def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        role: Optional[UserRole] = None,
        active_only: bool = True
    ) -> List[User]:
        """Get users with optional filtering"""
        query = self.db.query(User)
        
        if active_only:
            query = query.filter(User.is_active == True)
        
        if role:
            query = query.filter(User.role == role)
        
        return query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()
    
    def update_user(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update a user"""
        db_user = self.get_user(user_id)
        if not db_user:
            return None
        
        # Check for email/username conflicts
        update_data = user_data.model_dump(exclude_unset=True)
        
        if "email" in update_data and update_data["email"] != db_user.email:
            existing_user = self.get_user_by_email(update_data["email"])
            if existing_user and existing_user.id != user_id:
                raise ValueError("Email already registered")
        
        if "username" in update_data and update_data["username"] != db_user.username:
            existing_user = self.get_user_by_username(update_data["username"])
            if existing_user and existing_user.id != user_id:
                raise ValueError("Username already taken")
        
        # Update fields
        for field, value in update_data.items():
            setattr(db_user, field, value)
        
        self.db.commit()
        self.db.refresh(db_user)
        
        return db_user
    
    def deactivate_user(self, user_id: str) -> bool:
        """Deactivate a user (soft delete)"""
        db_user = self.get_user(user_id)
        if not db_user:
            return False
        
        db_user.is_active = False
        self.db.commit()
        
        return True
    
    def verify_email(self, email: str) -> bool:
        """Mark user email as verified"""
        user = self.get_user_by_email(email)
        if not user:
            return False
        
        user.is_verified = True
        user.verified_at = datetime.utcnow()
        user.verification_token = None
        self.db.commit()
        
        return True
    
    def initiate_password_reset(self, email: str) -> Optional[str]:
        """Initiate password reset process"""
        user = self.get_user_by_email(email)
        if not user or not user.is_active:
            return None
        
        reset_token = create_reset_token(email)
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        
        self.db.commit()
        
        return reset_token
    
    def reset_password(self, email: str, new_password: str) -> bool:
        """Reset user password"""
        user = self.get_user_by_email(email)
        if not user or not user.is_active:
            return False
        
        # Check if reset token is still valid
        if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
            return False
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        user.reset_token = None
        user.reset_token_expires = None
        
        self.db.commit()
        
        return True
    
    def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """Change user password"""
        user = self.get_user(user_id)
        if not user or not user.is_active:
            return False
        
        # Verify current password
        if not verify_password(current_password, user.hashed_password):
            return False
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
        
        return True
    
    def create_admin_user(self, email: str, username: str, password: str, full_name: str) -> User:
        """Create an admin user (for initial setup)"""
        user_data = UserCreate(
            email=email,
            username=username,
            password=password,
            full_name=full_name,
            role=UserRole.ADMIN
        )
        
        user = self.create_user(user_data)
        
        # Auto-verify admin users
        user.is_verified = True
        user.is_superuser = True
        user.verified_at = datetime.utcnow()
        user.verification_token = None
        
        self.db.commit()
        self.db.refresh(user)

        return user

    def create_user_from_dict(self, user_data: dict) -> User:
        """Create user from dictionary data (used by SSO)"""
        # Check if email or username already exists
        existing_user = self.db.query(User).filter(
            or_(User.email == user_data["email"], User.username == user_data["username"])
        ).first()

        if existing_user:
            if existing_user.email == user_data["email"]:
                raise ValueError("Email already registered")
            else:
                raise ValueError("Username already taken")

        # Hash password
        hashed_password = get_password_hash(user_data["password"])

        # Create user instance
        db_user = User(
            id=str(uuid.uuid4()),
            email=user_data["email"],
            username=user_data["username"],
            hashed_password=hashed_password,
            full_name=user_data.get("full_name"),
            title=user_data.get("title"),
            phone=user_data.get("phone"),
            role=user_data.get("role", UserRole.RESIDENT),
            is_verified=user_data.get("is_verified", False)
        )

        # Set verification token if not already verified
        if not db_user.is_verified:
            db_user.verification_token = create_verification_token(user_data["email"])
        else:
            db_user.verified_at = datetime.utcnow()

        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)

        return db_user

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Internal method to verify password (for security service)"""
        return verify_password(plain_password, hashed_password)