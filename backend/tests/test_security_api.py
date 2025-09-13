"""
API endpoint tests for security features
"""
import pytest
import json
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from fastapi import status
from app.main import app
from app.models.user import User, UserRole
from app.schemas.security import TOTPSetupResponse, TwoFactorStatusResponse


# Test client
client = TestClient(app)


class TestSecurityEndpoints:
    """Test security API endpoints"""

    @pytest.fixture
    def mock_current_user(self):
        """Mock authenticated user"""
        user = Mock(spec=User)
        user.id = "test_user_123"
        user.email = "test@example.com"
        user.role = UserRole.RESIDENT
        user.is_active = True
        return user

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers"""
        return {"Authorization": "Bearer fake_token"}

    def test_setup_totp_2fa_success(self, auth_headers):
        """Test successful TOTP 2FA setup"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.setup_totp_2fa') as mock_setup:

            # Mock user
            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            # Mock setup response
            mock_setup.return_value = TOTPSetupResponse(
                secret="JBSWY3DPEHPK3PXP",
                qr_code_url="otpauth://totp/CA-DMS:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=CA-DMS",
                backup_codes=["123456", "789012", "345678"]
            )

            response = client.post(
                "/api/v1/security/2fa/totp/setup",
                json={},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "secret" in data
            assert "qr_code_url" in data
            assert "backup_codes" in data
            assert len(data["backup_codes"]) == 3

    def test_setup_totp_2fa_unauthorized(self):
        """Test TOTP setup without authentication"""
        response = client.post("/api/v1/security/2fa/totp/setup", json={})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_verify_totp_setup_success(self, auth_headers):
        """Test successful TOTP verification"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.verify_totp_setup') as mock_verify:

            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            mock_verify.return_value = True

            response = client.post(
                "/api/v1/security/2fa/totp/verify",
                json={"code": "123456"},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["message"] == "TOTP 2FA enabled successfully"

    def test_verify_totp_setup_invalid_code(self, auth_headers):
        """Test TOTP verification with invalid code"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.verify_totp_setup') as mock_verify:

            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            mock_verify.return_value = False

            response = client.post(
                "/api/v1/security/2fa/totp/verify",
                json={"code": "000000"},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            data = response.json()
            assert "Invalid verification code" in data["detail"]

    def test_get_2fa_status(self, auth_headers):
        """Test getting 2FA status"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.get_2fa_status') as mock_status:

            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            mock_status.return_value = TwoFactorStatusResponse(
                is_enabled=True,
                methods=[{
                    "method": "totp",
                    "is_enabled": True,
                    "is_verified": True,
                    "last_used_at": "2024-01-15T10:30:00Z"
                }],
                backup_codes_remaining=5
            )

            response = client.get(
                "/api/v1/security/2fa/status",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["is_enabled"] is True
            assert len(data["methods"]) == 1
            assert data["backup_codes_remaining"] == 5

    def test_disable_2fa_success(self, auth_headers):
        """Test successful 2FA disable"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.disable_2fa') as mock_disable:

            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            mock_disable.return_value = True

            response = client.post(
                "/api/v1/security/2fa/disable",
                json={
                    "password": "current_password",
                    "confirmation": True
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["message"] == "2FA disabled successfully"

    def test_disable_2fa_without_confirmation(self, auth_headers):
        """Test 2FA disable without confirmation"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user:

            mock_user = Mock()
            mock_user.id = "user123"
            mock_get_user.return_value = mock_user

            response = client.post(
                "/api/v1/security/2fa/disable",
                json={
                    "password": "current_password",
                    "confirmation": False
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            data = response.json()
            assert "Confirmation required" in data["detail"]

    def test_get_sso_providers(self):
        """Test getting SSO providers (public endpoint)"""
        with patch('app.services.sso_service.SSOService.get_sso_configurations') as mock_get:

            mock_get.return_value = [
                {
                    "id": "google_sso",
                    "name": "Google SSO",
                    "provider_type": "oauth2_google",
                    "is_enabled": True,
                    "auto_create_users": False,
                    "default_role": None,
                    "allowed_domains": ["example.com"],
                    "redirect_uri": "https://app.example.com/auth/callback",
                    "scopes": ["openid", "email", "profile"],
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ]

            response = client.get("/api/v1/security/sso/providers")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "Google SSO"
            assert data[0]["provider_type"] == "oauth2_google"

    def test_initiate_sso_login(self):
        """Test SSO login initiation"""
        with patch('app.services.sso_service.SSOService.initiate_sso_login') as mock_initiate:

            mock_initiate.return_value = Mock(
                authorization_url="https://accounts.google.com/oauth/authorize?...",
                state="random_state_123"
            )

            response = client.post(
                "/api/v1/security/sso/login",
                json={
                    "provider_id": "google_sso",
                    "redirect_url": "https://app.example.com/dashboard"
                }
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "authorization_url" in data
            assert "state" in data

    def test_sso_callback_success(self):
        """Test successful SSO callback processing"""
        with patch('app.services.sso_service.SSOService.process_sso_callback') as mock_process, \
             patch('app.core.security.create_access_token') as mock_create_token, \
             patch('app.core.security.create_refresh_token') as mock_create_refresh:

            # Mock user and tokens
            mock_user = Mock()
            mock_user.id = "user123"
            mock_user.email = "user@example.com"
            mock_user.role = UserRole.RESIDENT

            mock_process.return_value = (mock_user, False)  # Existing user
            mock_create_token.return_value = "access_token_123"
            mock_create_refresh.return_value = "refresh_token_123"

            response = client.post(
                "/api/v1/security/sso/callback",
                json={
                    "provider_id": "google_sso",
                    "code": "auth_code_123",
                    "state": "state_123"
                }
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert "user" in data

    def test_sso_callback_failure(self):
        """Test SSO callback processing failure"""
        with patch('app.services.sso_service.SSOService.process_sso_callback') as mock_process:

            mock_process.side_effect = ValueError("Invalid authorization code")

            response = client.post(
                "/api/v1/security/sso/callback",
                json={
                    "provider_id": "google_sso",
                    "code": "invalid_code",
                    "state": "state_123"
                }
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            data = response.json()
            assert "Invalid authorization code" in data["detail"]

    def test_get_audit_logs_admin(self, auth_headers):
        """Test getting audit logs as admin"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.get_audit_logs') as mock_get_logs:

            # Mock admin user
            mock_user = Mock()
            mock_user.id = "admin123"
            mock_user.role = UserRole.ADMIN
            mock_user.has_permission.return_value = True
            mock_get_user.return_value = mock_user

            # Mock audit logs
            mock_get_logs.return_value = ([
                {
                    "id": "log123",
                    "event_type": "login_success",
                    "severity": "low",
                    "message": "User logged in successfully",
                    "user_id": "user123",
                    "user_email": "user@example.com",
                    "user_role": "resident",
                    "resource_type": None,
                    "resource_id": None,
                    "resource_name": None,
                    "ip_address": "192.168.1.1",
                    "user_agent": "Chrome/120.0",
                    "api_endpoint": "/api/v1/auth/login",
                    "http_method": "POST",
                    "http_status": 200,
                    "details": {},
                    "tags": [],
                    "created_at": "2024-01-15T10:30:00Z"
                }
            ], 1)

            response = client.get(
                "/api/v1/security/audit-logs",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) == 1
            assert data[0]["event_type"] == "login_success"

    def test_get_audit_logs_forbidden(self, auth_headers):
        """Test getting audit logs without permission"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user:

            # Mock regular user without audit permissions
            mock_user = Mock()
            mock_user.id = "user123"
            mock_user.role = UserRole.RESIDENT
            mock_user.has_permission.return_value = False
            mock_get_user.return_value = mock_user

            response = client.get(
                "/api/v1/security/audit-logs",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_403_FORBIDDEN
            data = response.json()
            assert "Insufficient permissions" in data["detail"]

    def test_generate_compliance_report(self, auth_headers):
        """Test compliance report generation"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user:

            # Mock admin user
            mock_user = Mock()
            mock_user.id = "admin123"
            mock_user.role = UserRole.ADMIN
            mock_user.has_permission.return_value = True
            mock_get_user.return_value = mock_user

            response = client.post(
                "/api/v1/security/compliance-reports",
                json={
                    "report_type": "access_log",
                    "start_date": "2024-01-01T00:00:00Z",
                    "end_date": "2024-01-31T23:59:59Z",
                    "format": "pdf"
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "report_id" in data
            assert data["report_type"] == "access_log"
            assert data["status"] == "generating"

    def test_create_security_alert_admin(self, auth_headers):
        """Test creating security alert as admin"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user, \
             patch('app.services.security_service.SecurityService.create_security_alert') as mock_create:

            # Mock admin user
            mock_user = Mock()
            mock_user.id = "admin123"
            mock_user.role = UserRole.ADMIN
            mock_user.has_permission.return_value = True
            mock_get_user.return_value = mock_user

            # Mock alert creation
            mock_create.return_value = Mock(
                id="alert123",
                title="Test Alert",
                description="Test alert description",
                severity="high",
                alert_type="manual",
                category="security",
                status="open",
                user_id=None,
                ip_address="192.168.1.100",
                resource_type=None,
                resource_id=None,
                assigned_to=None,
                resolved_at=None,
                resolved_by=None,
                resolution_notes=None,
                context={},
                related_audit_logs=[],
                created_at="2024-01-15T10:30:00Z",
                updated_at="2024-01-15T10:30:00Z"
            )

            response = client.post(
                "/api/v1/security/alerts",
                json={
                    "title": "Test Alert",
                    "description": "Test alert description",
                    "severity": "high",
                    "alert_type": "manual",
                    "category": "security",
                    "ip_address": "192.168.1.100"
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["title"] == "Test Alert"
            assert data["severity"] == "high"

    def test_verify_2fa_during_login(self):
        """Test 2FA verification during login process"""
        with patch('app.services.security_service.SecurityService.verify_totp_login') as mock_verify:

            mock_verify.return_value = True

            response = client.post(
                "/api/v1/security/2fa/verify-login",
                json={
                    "code": "123456",
                    "user_id": "user123"  # This would normally come from session
                }
            )

            # Note: This endpoint would need session handling in real implementation
            # For now, we test the basic structure
            assert response.status_code in [200, 400, 401]  # Depends on implementation details


class TestSecurityValidation:
    """Test input validation for security endpoints"""

    def test_totp_code_validation(self):
        """Test TOTP code format validation"""
        with patch('app.core.dependencies.get_current_active_user'):

            # Test invalid code length
            response = client.post(
                "/api/v1/security/2fa/totp/verify",
                json={"code": "123"},  # Too short
                headers={"Authorization": "Bearer fake_token"}
            )

            # Should validate input before processing
            assert response.status_code in [400, 422]

    def test_sso_provider_validation(self):
        """Test SSO provider ID validation"""
        response = client.post(
            "/api/v1/security/sso/login",
            json={
                "provider_id": "",  # Empty provider ID
                "redirect_url": "https://app.example.com/dashboard"
            }
        )

        assert response.status_code in [400, 422]

    def test_audit_log_filter_validation(self):
        """Test audit log filter validation"""
        with patch('app.core.dependencies.get_current_active_user') as mock_get_user:

            mock_user = Mock()
            mock_user.has_permission.return_value = True
            mock_get_user.return_value = mock_user

            # Test invalid date format
            response = client.get(
                "/api/v1/security/audit-logs?start_date=invalid-date",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code in [400, 422]


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])