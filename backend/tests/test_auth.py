"""
Tests for authentication system
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db, Base
from app.services.user_service import UserService
from app.schemas.user import UserCreate
from app.models.user import UserRole


# Create test database
TEST_DATABASE_URL = "sqlite:///./test_auth.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Create and drop tables for each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_user_registration():
    """Test user registration endpoint"""
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["username"] == user_data["username"]
    assert data["full_name"] == user_data["full_name"]
    assert data["role"] == "resident"
    assert data["is_active"] is True
    assert data["is_verified"] is False
    assert "id" in data


def test_user_registration_duplicate_email():
    """Test user registration with duplicate email"""
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    # Create first user
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Try to create user with same email
    user_data["username"] = "different_username"
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


def test_user_registration_duplicate_username():
    """Test user registration with duplicate username"""
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    # Create first user
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Try to create user with same username
    user_data["email"] = "different@example.com"
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 400
    assert "Username already taken" in response.json()["detail"]


def test_user_login():
    """Test user login endpoint"""
    # Create user first
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Login with email
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert "expires_in" in data
    assert "user" in data
    assert data["user"]["email"] == user_data["email"]


def test_user_login_invalid_credentials():
    """Test user login with invalid credentials"""
    login_data = {
        "email": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_user_login_form():
    """Test OAuth2 form login"""
    # Create user first
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Login with form data using email
    form_data = {
        "username": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login/form", data=form_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    
    # Login with form data using username
    form_data = {
        "username": "testuser",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login/form", data=form_data)
    assert response.status_code == 200


def test_protected_endpoint():
    """Test protected endpoint access"""
    # Create user first
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Login to get token
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Access protected endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["email"] == user_data["email"]


def test_protected_endpoint_invalid_token():
    """Test protected endpoint with invalid token"""
    headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


def test_protected_endpoint_no_token():
    """Test protected endpoint without token"""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_token_refresh():
    """Test token refresh endpoint"""
    # Create user and login
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    refresh_token = response.json()["refresh_token"]
    
    # Refresh token
    refresh_data = {"refresh_token": refresh_token}
    response = client.post("/api/v1/auth/refresh", json=refresh_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_token_refresh_invalid():
    """Test token refresh with invalid token"""
    refresh_data = {"refresh_token": "invalid_token"}
    response = client.post("/api/v1/auth/refresh", json=refresh_data)
    assert response.status_code == 401


def test_change_password():
    """Test password change endpoint"""
    # Create user and login
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "oldpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    login_data = {
        "email": "test@example.com",
        "password": "oldpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Change password
    headers = {"Authorization": f"Bearer {token}"}
    password_data = {
        "current_password": "oldpassword123",
        "new_password": "newpassword456"
    }
    
    response = client.post("/api/v1/auth/change-password", json=password_data, headers=headers)
    assert response.status_code == 200
    
    # Verify old password doesn't work
    login_data["password"] = "oldpassword123"
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    
    # Verify new password works
    login_data["password"] = "newpassword456"
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200


def test_change_password_wrong_current():
    """Test password change with wrong current password"""
    # Create user and login
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Try to change password with wrong current password
    headers = {"Authorization": f"Bearer {token}"}
    password_data = {
        "current_password": "wrongpassword",
        "new_password": "newpassword456"
    }
    
    response = client.post("/api/v1/auth/change-password", json=password_data, headers=headers)
    assert response.status_code == 400


def test_logout():
    """Test logout endpoint"""
    # Create user and login
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Logout
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 200


def test_user_permissions():
    """Test user permission system"""
    db = TestingSessionLocal()
    user_service = UserService(db)
    
    # Create users with different roles
    admin_data = UserCreate(
        email="admin@example.com",
        username="admin",
        password="password123",
        full_name="Admin User",
        role=UserRole.ADMIN
    )
    
    board_member_data = UserCreate(
        email="board@example.com",
        username="board",
        password="password123",
        full_name="Board Member",
        role=UserRole.BOARD_MEMBER
    )
    
    resident_data = UserCreate(
        email="resident@example.com",
        username="resident",
        password="password123",
        full_name="Resident User",
        role=UserRole.RESIDENT
    )
    
    admin_user = user_service.create_user(admin_data)
    board_user = user_service.create_user(board_member_data)
    resident_user = user_service.create_user(resident_data)
    
    # Test admin permissions
    assert admin_user.has_permission("create")
    assert admin_user.has_permission("read")
    assert admin_user.has_permission("update")
    assert admin_user.has_permission("delete")
    assert admin_user.has_permission("approve")
    
    # Test board member permissions
    assert board_user.has_permission("create")
    assert board_user.has_permission("read")
    assert board_user.has_permission("update")
    assert board_user.has_permission("delete")
    assert board_user.has_permission("approve")
    
    # Test resident permissions
    assert not resident_user.has_permission("create")
    assert not resident_user.has_permission("update")
    assert not resident_user.has_permission("delete")
    assert not resident_user.has_permission("approve")
    assert resident_user.has_permission("create_own")
    
    # Test document editing permissions
    assert admin_user.can_edit_document("doc1", "other_user")
    assert board_user.can_edit_document("doc1", "other_user")
    assert not resident_user.can_edit_document("doc1", "other_user")
    assert resident_user.can_edit_document("doc1", resident_user.id)
    
    db.close()