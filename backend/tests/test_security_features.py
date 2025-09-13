"""
Comprehensive tests for security features (2FA, SSO, audit logging)
"""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from app.services.security_service import SecurityService, TOTPService, CryptoService
from app.services.sso_service import SSOService, OAuth2Service
from app.models.security import (
    UserTwoFactor, TwoFactorMethod, SSOConfiguration, UserSSOAccount,
    AuditLog, AuditEventType, AuditSeverity, SecurityAlert, SSOProvider
)
from app.models.user import User, UserRole
from app.schemas.security import (
    TOTPSetupResponse, TwoFactorStatusResponse, AuditLogCreate,
    SecurityAlertCreate, SSOLoginResponse
)


class TestCryptoService:
    """Test encryption/decryption service"""

    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption and decryption work correctly"""
        crypto = CryptoService()
        original_data = "sensitive_secret_key_123"

        # Encrypt
        encrypted = crypto.encrypt(original_data)
        assert encrypted != original_data
        assert isinstance(encrypted, str)

        # Decrypt
        decrypted = crypto.decrypt(encrypted)
        assert decrypted == original_data

    def test_encrypt_different_outputs(self):
        """Test that encryption produces different outputs for same input"""
        crypto = CryptoService()
        data = "test_data"

        encrypted1 = crypto.encrypt(data)
        encrypted2 = crypto.encrypt(data)

        # Should be different due to random IV in Fernet
        assert encrypted1 != encrypted2

        # But both should decrypt to same value
        assert crypto.decrypt(encrypted1) == data
        assert crypto.decrypt(encrypted2) == data


class TestTOTPService:
    """Test TOTP (Time-based One-Time Password) service"""

    def test_generate_secret(self):
        """Test TOTP secret generation"""
        secret = TOTPService.generate_secret()

        assert isinstance(secret, str)
        assert len(secret) == 32  # Base32 encoded 20 bytes
        assert secret.isalnum()  # Should be alphanumeric

    def test_generate_qr_code_url(self):
        """Test QR code URL generation"""
        secret = "JBSWY3DPEHPK3PXP"
        email = "test@example.com"
        issuer = "CA-DMS"

        url = TOTPService.generate_qr_code_url(secret, email, issuer)

        assert url.startswith("otpauth://totp/")
        assert f"{issuer}:{email}" in url
        assert f"secret={secret}" in url
        assert f"issuer={issuer}" in url

    def test_generate_backup_codes(self):
        """Test backup code generation"""
        codes = TOTPService.generate_backup_codes(5)

        assert len(codes) == 5
        assert all(len(code) == 6 for code in codes)
        assert all(code.isdigit() for code in codes)
        assert len(set(codes)) == 5  # All codes should be unique

    @patch('time.time')
    def test_verify_totp_valid_token(self, mock_time):
        """Test TOTP verification with valid token"""
        # Mock current time
        mock_time.return_value = 1609459200  # 2021-01-01 00:00:00 UTC

        secret = "JBSWY3DPEHPK3PXP"

        # Generate token for current time step
        time_step = int(mock_time.return_value) // 30
        expected_token = TOTPService._generate_token(secret, time_step)

        # Verify the token
        assert TOTPService.verify_totp(secret, expected_token)

    @patch('time.time')
    def test_verify_totp_invalid_token(self, mock_time):
        """Test TOTP verification with invalid token"""
        mock_time.return_value = 1609459200

        secret = "JBSWY3DPEHPK3PXP"
        invalid_token = "000000"

        assert not TOTPService.verify_totp(secret, invalid_token)

    @patch('time.time')
    def test_verify_totp_time_window(self, mock_time):
        """Test TOTP verification within time window"""
        mock_time.return_value = 1609459200

        secret = "JBSWY3DPEHPK3PXP"

        # Generate token for previous time step
        prev_time_step = (int(mock_time.return_value) // 30) - 1
        prev_token = TOTPService._generate_token(secret, prev_time_step)

        # Should be valid within window
        assert TOTPService.verify_totp(secret, prev_token, window=1)

        # Should be invalid outside window
        assert not TOTPService.verify_totp(secret, prev_token, window=0)


class TestSecurityService:
    """Test main security service"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def mock_user(self):
        """Mock user for testing"""
        user = Mock(spec=User)
        user.id = "user123"
        user.email = "test@example.com"
        user.role = UserRole.RESIDENT
        return user

    @pytest.fixture
    def security_service(self, mock_db):
        """Security service with mocked database"""
        return SecurityService(mock_db)

    def test_setup_totp_2fa_success(self, security_service, mock_db, mock_user):
        """Test successful TOTP 2FA setup"""
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        # Mock no existing 2FA record
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_user, None]

        with patch.object(security_service.totp, 'generate_secret', return_value='SECRET123'), \
             patch.object(security_service.totp, 'generate_backup_codes', return_value=['123456', '789012']), \
             patch.object(security_service.crypto, 'encrypt', side_effect=lambda x: f"encrypted_{x}"):

            result = security_service.setup_totp_2fa("user123")

            assert isinstance(result, TOTPSetupResponse)
            assert result.secret == 'SECRET123'
            assert len(result.backup_codes) == 2
            assert result.qr_code_url.startswith('otpauth://totp/')

            # Verify database operations
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    def test_verify_totp_setup_success(self, security_service, mock_db):
        """Test successful TOTP setup verification"""
        # Mock existing 2FA record
        mock_2fa = Mock(spec=UserTwoFactor)
        mock_2fa.totp_secret = "encrypted_secret"
        mock_2fa.is_enabled = False
        mock_2fa.is_verified = False

        mock_db.query.return_value.filter.return_value.first.return_value = mock_2fa

        with patch.object(security_service.crypto, 'decrypt', return_value='SECRET123'), \
             patch.object(security_service.totp, 'verify_totp', return_value=True):

            result = security_service.verify_totp_setup("user123", "123456")

            assert result is True
            assert mock_2fa.is_enabled is True
            assert mock_2fa.is_verified is True
            mock_db.commit.assert_called_once()

    def test_verify_totp_setup_invalid_code(self, security_service, mock_db):
        """Test TOTP setup verification with invalid code"""
        mock_2fa = Mock(spec=UserTwoFactor)
        mock_2fa.totp_secret = "encrypted_secret"

        mock_db.query.return_value.filter.return_value.first.return_value = mock_2fa

        with patch.object(security_service.crypto, 'decrypt', return_value='SECRET123'), \
             patch.object(security_service.totp, 'verify_totp', return_value=False):

            result = security_service.verify_totp_setup("user123", "000000")

            assert result is False

    def test_verify_totp_login_success(self, security_service, mock_db):
        """Test successful TOTP login verification"""
        mock_2fa = Mock(spec=UserTwoFactor)
        mock_2fa.totp_secret = "encrypted_secret"
        mock_2fa.is_enabled = True
        mock_2fa.is_verified = True
        mock_2fa.locked_until = None
        mock_2fa.failed_attempts = 0

        mock_db.query.return_value.filter.return_value.first.return_value = mock_2fa

        with patch.object(security_service.crypto, 'decrypt', return_value='SECRET123'), \
             patch.object(security_service.totp, 'verify_totp', return_value=True):

            result = security_service.verify_totp_login("user123", "123456")

            assert result is True
            assert mock_2fa.failed_attempts == 0
            mock_db.commit.assert_called_once()

    def test_verify_totp_login_account_locked(self, security_service, mock_db):
        """Test TOTP login verification with locked account"""
        mock_2fa = Mock(spec=UserTwoFactor)
        mock_2fa.locked_until = datetime.utcnow() + timedelta(minutes=30)
        mock_2fa.is_enabled = True
        mock_2fa.is_verified = True

        mock_db.query.return_value.filter.return_value.first.return_value = mock_2fa

        result = security_service.verify_totp_login("user123", "123456")

        assert result is False

    def test_get_2fa_status(self, security_service, mock_db):
        """Test getting 2FA status"""
        mock_totp = Mock(spec=UserTwoFactor)
        mock_totp.method = TwoFactorMethod.TOTP
        mock_totp.is_enabled = True
        mock_totp.is_verified = True
        mock_totp.last_used_at = datetime.utcnow()
        mock_totp.totp_backup_codes = ["encrypted1", "encrypted2"]

        mock_db.query.return_value.filter.return_value.all.return_value = [mock_totp]

        result = security_service.get_2fa_status("user123")

        assert isinstance(result, TwoFactorStatusResponse)
        assert result.is_enabled is True
        assert len(result.methods) == 1
        assert result.backup_codes_remaining == 2

    def test_log_audit_event(self, security_service, mock_db, mock_user):
        """Test audit event logging"""
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        audit_id = security_service.log_audit_event(
            event_type=AuditEventType.LOGIN_SUCCESS,
            message="User logged in successfully",
            user_id="user123",
            severity=AuditSeverity.LOW,
            ip_address="192.168.1.1"
        )

        assert isinstance(audit_id, str)
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_create_security_alert(self, security_service, mock_db):
        """Test security alert creation"""
        alert_data = SecurityAlertCreate(
            title="Suspicious Activity",
            description="Multiple failed login attempts",
            severity=AuditSeverity.HIGH,
            alert_type="failed_login_attempts",
            category="authentication",
            ip_address="192.168.1.100"
        )

        result = security_service.create_security_alert(alert_data)

        assert hasattr(result, 'title')
        assert result.title == "Suspicious Activity"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


class TestOAuth2Service:
    """Test OAuth2 service for SSO"""

    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)

    @pytest.fixture
    def oauth2_service(self, mock_db):
        return OAuth2Service(mock_db)

    @pytest.fixture
    def mock_google_config(self):
        config = Mock(spec=SSOConfiguration)
        config.provider_type = SSOProvider.OAUTH2_GOOGLE
        config.client_id = "google_client_id"
        config.client_secret = "google_client_secret"
        config.scopes = ["openid", "email", "profile"]
        return config

    def test_get_authorization_url_google(self, oauth2_service, mock_google_config):
        """Test Google OAuth2 authorization URL generation"""
        state = "random_state"
        redirect_uri = "https://app.example.com/auth/callback"

        url = oauth2_service.get_authorization_url(mock_google_config, state, redirect_uri)

        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
        assert f"client_id={mock_google_config.client_id}" in url
        assert f"redirect_uri={redirect_uri}" in url
        assert f"state={state}" in url
        assert "scope=openid%20email%20profile" in url

    @patch('requests.post')
    def test_exchange_code_for_token_success(self, mock_post, oauth2_service, mock_google_config):
        """Test successful OAuth2 code exchange"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "access_token_123",
            "token_type": "Bearer",
            "expires_in": 3600
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = oauth2_service.exchange_code_for_token(
            mock_google_config, "auth_code", "https://app.example.com/callback"
        )

        assert result["access_token"] == "access_token_123"
        mock_post.assert_called_once()

    @patch('requests.get')
    def test_get_user_info_google(self, mock_get, oauth2_service, mock_google_config):
        """Test getting user info from Google"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "id": "google_user_123",
            "email": "user@example.com",
            "name": "John Doe",
            "given_name": "John",
            "family_name": "Doe",
            "picture": "https://example.com/photo.jpg",
            "verified_email": True
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = oauth2_service.get_user_info(mock_google_config, "access_token_123")

        assert result["id"] == "google_user_123"
        assert result["email"] == "user@example.com"
        assert result["name"] == "John Doe"
        assert result["verified_email"] is True


class TestSSOService:
    """Test main SSO service"""

    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)

    @pytest.fixture
    def sso_service(self, mock_db):
        return SSOService(mock_db)

    @pytest.fixture
    def mock_sso_config(self):
        config = Mock(spec=SSOConfiguration)
        config.id = "sso_config_123"
        config.provider_type = SSOProvider.OAUTH2_GOOGLE
        config.name = "Google SSO"
        config.is_enabled = True
        config.client_id = "google_client_id"
        config.redirect_uri = "https://app.example.com/auth/callback"
        config.allowed_domains = ["example.com"]
        config.auto_create_users = True
        config.default_role = "resident"
        return config

    def test_initiate_sso_login(self, sso_service, mock_db, mock_sso_config):
        """Test SSO login initiation"""
        mock_db.query.return_value.filter.return_value.first.return_value = mock_sso_config

        with patch.object(sso_service.oauth2_service, 'get_authorization_url',
                         return_value="https://accounts.google.com/oauth/authorize?..."):

            result = sso_service.initiate_sso_login("sso_config_123")

            assert isinstance(result, SSOLoginResponse)
            assert result.authorization_url.startswith("https://accounts.google.com")
            assert isinstance(result.state, str)

    def test_process_sso_callback_existing_user(self, sso_service, mock_db, mock_sso_config):
        """Test SSO callback processing with existing user"""
        # Mock existing user
        mock_user = Mock(spec=User)
        mock_user.id = "user123"
        mock_user.email = "user@example.com"

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_sso_config,  # SSO config query
            mock_user         # User query
        ]

        user_data = {
            "id": "google_user_123",
            "email": "user@example.com",
            "name": "John Doe"
        }

        with patch.object(sso_service.oauth2_service, 'exchange_code_for_token',
                         return_value={"access_token": "token123"}), \
             patch.object(sso_service.oauth2_service, 'get_user_info',
                         return_value=user_data):

            user, is_new = sso_service.process_sso_callback(
                "sso_config_123", code="auth_code", state="state123"
            )

            assert user == mock_user
            assert is_new is False

    def test_process_sso_callback_new_user(self, sso_service, mock_db, mock_sso_config):
        """Test SSO callback processing with new user creation"""
        # Mock no existing user
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_sso_config,  # SSO config query
            None              # No existing user
        ]

        user_data = {
            "id": "google_user_123",
            "email": "newuser@example.com",
            "name": "New User"
        }

        mock_new_user = Mock(spec=User)
        mock_new_user.id = "new_user_123"
        mock_new_user.email = "newuser@example.com"

        with patch.object(sso_service.oauth2_service, 'exchange_code_for_token',
                         return_value={"access_token": "token123"}), \
             patch.object(sso_service.oauth2_service, 'get_user_info',
                         return_value=user_data), \
             patch('app.services.user_service.UserService') as mock_user_service:

            mock_user_service.return_value.create_user_from_dict.return_value = mock_new_user

            user, is_new = sso_service.process_sso_callback(
                "sso_config_123", code="auth_code", state="state123"
            )

            assert user == mock_new_user
            assert is_new is True

    def test_process_sso_callback_domain_restriction(self, sso_service, mock_db, mock_sso_config):
        """Test SSO callback with domain restrictions"""
        mock_db.query.return_value.filter.return_value.first.return_value = mock_sso_config

        user_data = {
            "id": "google_user_123",
            "email": "user@unauthorized.com",  # Not in allowed domains
            "name": "Unauthorized User"
        }

        with patch.object(sso_service.oauth2_service, 'exchange_code_for_token',
                         return_value={"access_token": "token123"}), \
             patch.object(sso_service.oauth2_service, 'get_user_info',
                         return_value=user_data):

            with pytest.raises(ValueError, match="Email domain"):
                sso_service.process_sso_callback(
                    "sso_config_123", code="auth_code", state="state123"
                )


class TestSecurityIntegration:
    """Integration tests for security features"""

    def test_full_2fa_workflow(self):
        """Test complete 2FA setup and verification workflow"""
        # This would be an integration test with real database
        # Testing the full workflow from setup to verification
        pass

    def test_full_sso_workflow(self):
        """Test complete SSO workflow"""
        # Integration test for SSO login flow
        pass

    def test_audit_log_retention(self):
        """Test audit log retention policies"""
        # Test that old audit logs are properly handled
        pass

    def test_security_alert_generation(self):
        """Test automatic security alert generation"""
        # Test that security patterns trigger alerts
        pass


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])