"""
Test suite for external integration API endpoints
"""
import pytest
import uuid
from unittest.mock import patch, Mock, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.external_integration import (
    ExternalIntegration,
    IntegrationType,
    IntegrationStatus
)
from app.models.user import User, UserRole
from app.models.document import Document


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def test_user(db_session: Session):
    """Create test user"""
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        role=UserRole.USER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User):
    """Create auth headers with mock JWT"""
    # In real tests, you'd generate a proper JWT token
    token = "mock_jwt_token"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_integration(db_session: Session, test_user: User):
    """Create test integration"""
    integration = ExternalIntegration(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        integration_type=IntegrationType.SHAREPOINT,
        name="Test SharePoint Integration",
        description="Test integration",
        client_id="test_client_id",
        client_secret="encrypted_secret",
        redirect_uri="http://localhost:3000/oauth/callback",
        scope="https://graph.microsoft.com/.default",
        status=IntegrationStatus.ACTIVE,
        sync_enabled=True,
        auto_sync_interval="24h"
    )
    db_session.add(integration)
    db_session.commit()
    db_session.refresh(integration)
    return integration


class TestIntegrationEndpoints:
    """Test integration management endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    def test_create_integration(self, mock_get_user, client: TestClient, test_user: User, auth_headers: dict):
        """Test creating new integration"""
        mock_get_user.return_value = test_user

        integration_data = {
            "integration_type": "sharepoint",
            "name": "Test SharePoint",
            "description": "Test integration",
            "client_id": "test_client_id",
            "client_secret": "test_secret",
            "redirect_uri": "http://localhost:3000/oauth/callback",
            "scope": "https://graph.microsoft.com/.default",
            "sync_enabled": True,
            "auto_sync_interval": "24h"
        }

        response = client.post(
            "/api/v1/external-integrations/",
            json=integration_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["integration_type"] == "sharepoint"
        assert data["name"] == "Test SharePoint"
        assert data["status"] == "pending"

    @patch('app.core.dependencies.get_current_active_user')
    def test_list_integrations(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test listing user integrations"""
        mock_get_user.return_value = test_user

        response = client.get(
            "/api/v1/external-integrations/",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "integrations" in data
        assert len(data["integrations"]) >= 1
        assert data["total"] >= 1

    @patch('app.core.dependencies.get_current_active_user')
    def test_list_integrations_with_filters(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test listing integrations with filters"""
        mock_get_user.return_value = test_user

        response = client.get(
            "/api/v1/external-integrations/?integration_type=sharepoint&status=active",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "integrations" in data

    @patch('app.core.dependencies.get_current_active_user')
    def test_get_integration(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test getting specific integration"""
        mock_get_user.return_value = test_user

        response = client.get(
            f"/api/v1/external-integrations/{test_integration.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_integration.id
        assert data["name"] == test_integration.name

    @patch('app.core.dependencies.get_current_active_user')
    def test_get_integration_not_found(self, mock_get_user, client: TestClient, test_user: User, auth_headers: dict):
        """Test getting non-existent integration"""
        mock_get_user.return_value = test_user

        fake_id = str(uuid.uuid4())
        response = client.get(
            f"/api/v1/external-integrations/{fake_id}",
            headers=auth_headers
        )

        assert response.status_code == 404

    @patch('app.core.dependencies.get_current_active_user')
    def test_update_integration(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test updating integration"""
        mock_get_user.return_value = test_user

        update_data = {
            "name": "Updated Integration Name",
            "sync_enabled": False
        }

        response = client.put(
            f"/api/v1/external-integrations/{test_integration.id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Integration Name"
        assert data["sync_enabled"] is False

    @patch('app.core.dependencies.get_current_active_user')
    def test_delete_integration(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test deleting integration"""
        mock_get_user.return_value = test_user

        response = client.delete(
            f"/api/v1/external-integrations/{test_integration.id}",
            headers=auth_headers
        )

        assert response.status_code == 204


class TestOAuthEndpoints:
    """Test OAuth flow endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    def test_get_oauth_authorization_url(self, mock_get_user, client: TestClient, test_user: User, auth_headers: dict):
        """Test getting OAuth authorization URL"""
        mock_get_user.return_value = test_user

        auth_request = {
            "integration_type": "sharepoint",
            "client_id": "test_client_id",
            "redirect_uri": "http://localhost:3000/oauth/callback",
            "scope": "https://graph.microsoft.com/.default",
            "state": "test_state"
        }

        response = client.post(
            "/api/v1/external-integrations/oauth/authorize",
            json=auth_request,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "authorization_url" in data
        assert data["authorization_url"].startswith("https://login.microsoftonline.com")

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.exchange_oauth_code')
    def test_exchange_oauth_token(self, mock_exchange, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test OAuth token exchange"""
        mock_get_user.return_value = test_user
        mock_exchange.return_value = True

        token_exchange = {
            "integration_id": test_integration.id,
            "authorization_code": "test_auth_code",
            "state": "test_state"
        }

        response = client.post(
            "/api/v1/external-integrations/oauth/token",
            json=token_exchange,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.refresh_access_token')
    def test_refresh_oauth_token(self, mock_refresh, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test OAuth token refresh"""
        mock_get_user.return_value = test_user
        mock_refresh.return_value = True

        response = client.post(
            f"/api/v1/external-integrations/{test_integration.id}/oauth/refresh",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestFileOperationEndpoints:
    """Test file operation endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.get_integration')
    @patch('app.api.v1.endpoints.external_integrations.get_integration_service')
    def test_list_external_files(self, mock_get_service, mock_get_integration, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test listing external files"""
        mock_get_user.return_value = test_user
        mock_get_integration.return_value = test_integration

        mock_service = Mock()
        mock_service.list_external_files = AsyncMock(return_value=[
            {"id": "file1", "name": "test1.pdf", "path": "/test1.pdf", "is_folder": False},
            {"id": "file2", "name": "test2.pdf", "path": "/test2.pdf", "is_folder": False}
        ])
        mock_get_service.return_value = mock_service

        response = client.get(
            f"/api/v1/external-integrations/{test_integration.id}/files",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert len(data["files"]) == 2

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.get_integration')
    @patch('app.api.v1.endpoints.external_integrations.get_integration_service')
    def test_upload_document(self, mock_get_service, mock_get_integration, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test uploading document"""
        mock_get_user.return_value = test_user
        mock_get_integration.return_value = test_integration

        mock_service = Mock()
        mock_service.upload_document = AsyncMock(return_value="external_file_id_123")
        mock_get_service.return_value = mock_service

        upload_request = {
            "document_id": str(uuid.uuid4()),
            "destination_path": "/uploads",
            "overwrite": True
        }

        response = client.post(
            f"/api/v1/external-integrations/{test_integration.id}/upload",
            json=upload_request,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert "external_file_id" in data

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.get_integration')
    @patch('app.api.v1.endpoints.external_integrations.get_integration_service')
    def test_download_file(self, mock_get_service, mock_get_integration, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test downloading file"""
        mock_get_user.return_value = test_user
        mock_get_integration.return_value = test_integration

        mock_service = Mock()
        mock_service.download_file = AsyncMock(return_value="document_id_123")
        mock_get_service.return_value = mock_service

        download_request = {
            "external_file_id": "external_file_123",
            "create_new_document": True
        }

        response = client.post(
            f"/api/v1/external-integrations/{test_integration.id}/download",
            json=download_request,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert "document_id" in data


class TestSyncEndpoints:
    """Test sync operation endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.get_integration')
    @patch('app.api.v1.endpoints.external_integrations.get_integration_service')
    def test_sync_documents(self, mock_get_service, mock_get_integration, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test syncing documents"""
        mock_get_user.return_value = test_user
        mock_get_integration.return_value = test_integration

        mock_service = Mock()
        mock_service.sync_documents = AsyncMock(return_value="operation_id_123")
        mock_get_service.return_value = mock_service

        sync_request = {
            "operation": "sync",
            "document_ids": [str(uuid.uuid4())],
            "external_paths": ["/sync_folder"]
        }

        response = client.post(
            f"/api/v1/external-integrations/{test_integration.id}/sync",
            json=sync_request,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "operation_id" in data
        assert data["status"] == "queued"

    @patch('app.core.dependencies.get_current_active_user')
    def test_get_sync_logs(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test getting sync logs"""
        mock_get_user.return_value = test_user

        response = client.get(
            f"/api/v1/external-integrations/{test_integration.id}/sync-logs",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data


class TestStatusEndpoints:
    """Test status and health endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    def test_get_integration_status(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test getting integration status"""
        mock_get_user.return_value = test_user

        response = client.get(
            f"/api/v1/external-integrations/{test_integration.id}/status",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "integration_id" in data
        assert "status" in data
        assert "is_connected" in data

    @patch('app.core.dependencies.get_current_active_user')
    @patch('app.services.external_integration_service.ExternalIntegrationService.check_integration_health')
    def test_check_integration_health(self, mock_health_check, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test checking integration health"""
        mock_get_user.return_value = test_user
        mock_health_check.return_value = {
            "integration_id": test_integration.id,
            "integration_type": "sharepoint",
            "name": "Test Integration",
            "is_healthy": True,
            "status": "active",
            "last_check": "2024-01-01T00:00:00Z",
            "issues": [],
            "recommendations": []
        }

        response = client.get(
            f"/api/v1/external-integrations/{test_integration.id}/health",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_healthy"] is True
        assert data["integration_id"] == test_integration.id


class TestBulkOperations:
    """Test bulk operation endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    def test_bulk_sync_integrations(self, mock_get_user, client: TestClient, test_user: User, test_integration: ExternalIntegration, auth_headers: dict):
        """Test bulk sync operations"""
        mock_get_user.return_value = test_user

        bulk_request = {
            "integration_ids": [test_integration.id],
            "operation": "health_check"
        }

        response = client.post(
            "/api/v1/external-integrations/bulk/sync",
            json=bulk_request,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "operation_id" in data
        assert "integration_count" in data
        assert "results" in data


class TestErrorHandling:
    """Test error handling in API endpoints"""

    @patch('app.core.dependencies.get_current_active_user')
    def test_unauthorized_access(self, mock_get_user, client: TestClient):
        """Test access without authentication"""
        response = client.get("/api/v1/external-integrations/")
        assert response.status_code == 401

    @patch('app.core.dependencies.get_current_active_user')
    def test_invalid_integration_type(self, mock_get_user, client: TestClient, test_user: User, auth_headers: dict):
        """Test creating integration with invalid type"""
        mock_get_user.return_value = test_user

        integration_data = {
            "integration_type": "invalid_type",
            "name": "Test Integration",
            "client_id": "test_id",
            "client_secret": "test_secret",
            "redirect_uri": "http://localhost:3000/oauth/callback",
            "scope": "test_scope"
        }

        response = client.post(
            "/api/v1/external-integrations/",
            json=integration_data,
            headers=auth_headers
        )

        assert response.status_code == 422  # Validation error

    @patch('app.core.dependencies.get_current_active_user')
    def test_missing_required_fields(self, mock_get_user, client: TestClient, test_user: User, auth_headers: dict):
        """Test creating integration with missing fields"""
        mock_get_user.return_value = test_user

        integration_data = {
            "integration_type": "sharepoint",
            "name": "Test Integration"
            # Missing required fields
        }

        response = client.post(
            "/api/v1/external-integrations/",
            json=integration_data,
            headers=auth_headers
        )

        assert response.status_code == 422  # Validation error