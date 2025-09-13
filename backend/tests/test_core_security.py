"""
Comprehensive tests for core security functionality
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from jose import jwt
from passlib.context import CryptContext

from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    verify_token, get_current_user_from_token, TokenData
)
from app.core.config import settings


class TestPasswordHashing:
    """Tests for password hashing functionality"""

    def test_password_hashing_and_verification(self):
        """Test password hashing and verification"""
        password = "test_password_123"

        # Hash password
        hashed = get_password_hash(password)

        # Verify password is hashed (not plain text)
        assert hashed != password
        assert len(hashed) > 50  # Bcrypt hashes are long

        # Verify correct password
        assert verify_password(password, hashed) is True

        # Verify incorrect password
        assert verify_password("wrong_password", hashed) is False

    def test_password_hash_uniqueness(self):
        """Test that same password produces different hashes (due to salt)"""
        password = "same_password"

        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Hashes should be different due to random salt
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    def test_empty_password_handling(self):
        """Test handling of empty passwords"""
        # Empty password should still hash
        hashed = get_password_hash("")
        assert hashed != ""
        assert verify_password("", hashed) is True

    def test_special_characters_password(self):
        """Test password with special characters"""
        password = "P@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?"

        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_unicode_password(self):
        """Test password with unicode characters"""
        password = "пароль123αβγ密码"

        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True


class TestJWTTokens:
    """Tests for JWT token functionality"""

    def test_create_access_token_default_expiry(self):
        """Test creating access token with default expiry"""
        data = {"sub": "user123", "email": "test@example.com"}

        token = create_access_token(data)

        # Token should be a string
        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are long

        # Decode and verify token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == "user123"
        assert payload["email"] == "test@example.com"
        assert "exp" in payload

    def test_create_access_token_custom_expiry(self):
        """Test creating access token with custom expiry"""
        data = {"sub": "user123"}
        expires_delta = timedelta(minutes=5)

        token = create_access_token(data, expires_delta)

        # Decode and check expiry
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp_time = datetime.fromtimestamp(payload["exp"])
        expected_time = datetime.utcnow() + expires_delta

        # Should be approximately correct (within 5 seconds)
        time_diff = abs((exp_time - expected_time).total_seconds())
        assert time_diff < 5

    def test_create_token_with_additional_claims(self):
        """Test creating token with additional claims"""
        data = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "admin",
            "permissions": ["read", "write"]
        }

        token = create_access_token(data)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        assert payload["sub"] == "user123"
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]

    def test_verify_token_valid(self):
        """Test verifying valid token"""
        data = {"sub": "user123", "email": "test@example.com"}
        token = create_access_token(data)

        payload = verify_token(token)

        assert payload is not None
        assert payload["sub"] == "user123"
        assert payload["email"] == "test@example.com"

    def test_verify_token_invalid(self):
        """Test verifying invalid token"""
        invalid_token = "invalid.token.here"

        payload = verify_token(invalid_token)

        assert payload is None

    def test_verify_token_expired(self):
        """Test verifying expired token"""
        data = {"sub": "user123"}
        # Create token that expires in 1 second
        expires_delta = timedelta(seconds=-1)  # Already expired

        token = create_access_token(data, expires_delta)

        payload = verify_token(token)

        assert payload is None

    def test_verify_token_wrong_secret(self):
        """Test verifying token with wrong secret"""
        data = {"sub": "user123"}

        # Create token with current secret
        token = create_access_token(data)

        # Try to verify with wrong secret
        with patch('app.core.security.settings') as mock_settings:
            mock_settings.SECRET_KEY = "wrong_secret"
            mock_settings.ALGORITHM = settings.ALGORITHM

            payload = verify_token(token)
            assert payload is None


class TestTokenData:
    """Tests for TokenData class"""

    def test_token_data_creation(self):
        """Test TokenData creation"""
        token_data = TokenData(username="testuser")

        assert token_data.username == "testuser"

    def test_token_data_none_username(self):
        """Test TokenData with None username"""
        token_data = TokenData(username=None)

        assert token_data.username is None

    def test_token_data_validation(self):
        """Test TokenData validation"""
        # Valid data
        token_data = TokenData(username="valid_user")
        assert token_data.username == "valid_user"

        # Empty string should be valid
        token_data = TokenData(username="")
        assert token_data.username == ""


class TestUserAuthentication:
    """Tests for user authentication functions"""

    @pytest.mark.asyncio
    async def test_get_current_user_from_token_valid(self):
        """Test getting current user from valid token"""
        user_data = {"sub": "user123", "email": "test@example.com"}
        token = create_access_token(user_data)

        with patch('app.core.security.get_user_by_username') as mock_get_user:
            mock_user = Mock()
            mock_user.id = "user123"
            mock_user.email = "test@example.com"
            mock_user.is_active = True
            mock_get_user.return_value = mock_user

            # Mock database session
            mock_db = Mock()

            user = await get_current_user_from_token(token, mock_db)

            assert user == mock_user
            mock_get_user.assert_called_once_with(mock_db, "user123")

    @pytest.mark.asyncio
    async def test_get_current_user_from_token_invalid(self):
        """Test getting current user from invalid token"""
        invalid_token = "invalid.token"
        mock_db = Mock()

        with pytest.raises(Exception):  # Should raise authentication exception
            await get_current_user_from_token(invalid_token, mock_db)

    @pytest.mark.asyncio
    async def test_get_current_user_from_token_user_not_found(self):
        """Test getting current user when user not found in database"""
        user_data = {"sub": "nonexistent_user"}
        token = create_access_token(user_data)

        with patch('app.core.security.get_user_by_username') as mock_get_user:
            mock_get_user.return_value = None
            mock_db = Mock()

            with pytest.raises(Exception):  # Should raise authentication exception
                await get_current_user_from_token(token, mock_db)

    @pytest.mark.asyncio
    async def test_get_current_user_from_token_inactive_user(self):
        """Test getting current user when user is inactive"""
        user_data = {"sub": "inactive_user"}
        token = create_access_token(user_data)

        with patch('app.core.security.get_user_by_username') as mock_get_user:
            mock_user = Mock()
            mock_user.is_active = False
            mock_get_user.return_value = mock_user
            mock_db = Mock()

            with pytest.raises(Exception):  # Should raise authentication exception
                await get_current_user_from_token(token, mock_db)


class TestSecurityConfiguration:
    """Tests for security configuration"""

    def test_password_context_configuration(self):
        """Test password context is properly configured"""
        from app.core.security import pwd_context

        assert isinstance(pwd_context, CryptContext)

        # Test hashing works
        password = "test_password"
        hashed = pwd_context.hash(password)
        assert pwd_context.verify(password, hashed)

    def test_jwt_algorithm_configuration(self):
        """Test JWT algorithm configuration"""
        # Should use HS256 by default
        assert settings.ALGORITHM == "HS256"

    def test_token_expiry_configuration(self):
        """Test token expiry configuration"""
        # Should have reasonable default expiry
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES <= 1440  # Not more than 24 hours


class TestSecurityEdgeCases:
    """Tests for security edge cases and error conditions"""

    def test_malformed_jwt_token(self):
        """Test handling of malformed JWT tokens"""
        malformed_tokens = [
            "",
            "not.a.token",
            "header.payload",  # Missing signature
            "header.payload.signature.extra",  # Too many parts
            "invalid_base64.invalid_base64.invalid_base64"
        ]

        for token in malformed_tokens:
            payload = verify_token(token)
            assert payload is None

    def test_token_with_missing_claims(self):
        """Test token verification with missing required claims"""
        # Create token without 'sub' claim
        import jose.jwt

        payload = {"email": "test@example.com", "exp": datetime.utcnow() + timedelta(hours=1)}
        token = jose.jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        # Should still decode but might fail user lookup
        decoded = verify_token(token)
        assert decoded is not None
        assert "sub" not in decoded

    def test_password_hash_verification_timing(self):
        """Test password verification timing consistency"""
        import time

        password = "test_password"
        hashed = get_password_hash(password)

        # Measure time for correct password
        start_time = time.time()
        verify_password(password, hashed)
        correct_time = time.time() - start_time

        # Measure time for incorrect password
        start_time = time.time()
        verify_password("wrong_password", hashed)
        incorrect_time = time.time() - start_time

        # Times should be similar (within 50% difference) to prevent timing attacks
        time_ratio = max(correct_time, incorrect_time) / min(correct_time, incorrect_time)
        assert time_ratio < 2.0  # Less than 2x difference

    def test_token_blacklist_simulation(self):
        """Test token blacklist functionality simulation"""
        # This would test token blacklisting if implemented
        data = {"sub": "user123"}
        token = create_access_token(data)

        # Token should be valid initially
        payload = verify_token(token)
        assert payload is not None

        # In a real implementation, you would blacklist the token here
        # For now, just verify the token structure supports blacklisting
        assert "jti" not in payload  # Token ID would be needed for blacklisting


if __name__ == "__main__":
    pytest.main([__file__, "-v"])