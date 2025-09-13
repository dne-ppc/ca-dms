"""
Test suite for external integrations functionality
"""
import pytest
import uuid
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.external_integration import (
    ExternalIntegration,
    IntegrationSyncLog,
    IntegrationType,
    IntegrationStatus
)
from app.models.user import User, UserRole
from app.models.document import Document
from app.services.external_integration_service import ExternalIntegrationService
from app.services.integrations.sharepoint_service import SharePointService
from app.services.integrations.google_service import GoogleService
from app.services.integrations.box_service import BoxService
from app.services.integrations.dropbox_service import DropboxService
from app.schemas.external_integration import (
    ExternalIntegrationCreate,
    ExternalIntegrationUpdate,
    SyncOperationRequest,
    FileUploadRequest,
    FileDownloadRequest
)


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
def test_document(db_session: Session, test_user: User):
    """Create test document"""
    document = Document(
        id=str(uuid.uuid4()),
        title="Test Document",
        content={"ops": [{"insert": "Test content"}]},
        created_by=test_user.id,
        updated_by=test_user.id
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document


@pytest.fixture
def integration_create_data():
    """Create integration data for testing"""
    return ExternalIntegrationCreate(
        integration_type=IntegrationType.SHAREPOINT,
        name="Test SharePoint Integration",
        description="Test integration for unit tests",
        client_id="test_client_id",
        client_secret="test_client_secret",
        redirect_uri="http://localhost:3000/oauth/callback",
        scope="https://graph.microsoft.com/.default",
        sync_enabled=True,
        auto_sync_interval="24h"
    )


class TestExternalIntegrationService:
    """Test external integration service"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = ExternalIntegrationService(db_session)
        self.db = db_session

    async def test_create_integration(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test creating an external integration"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        assert integration is not None
        assert integration.user_id == test_user.id
        assert integration.integration_type == IntegrationType.SHAREPOINT
        assert integration.name == integration_create_data.name
        assert integration.status == IntegrationStatus.PENDING
        assert integration.sync_enabled == integration_create_data.sync_enabled

    async def test_get_integration(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test getting integration by ID"""
        created_integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        retrieved_integration = await self.service.get_integration(
            created_integration.id,
            test_user.id
        )

        assert retrieved_integration is not None
        assert retrieved_integration.id == created_integration.id
        assert retrieved_integration.name == created_integration.name

    async def test_get_integration_unauthorized(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test getting integration with wrong user ID"""
        created_integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        wrong_user_id = str(uuid.uuid4())
        retrieved_integration = await self.service.get_integration(
            created_integration.id,
            wrong_user_id
        )

        assert retrieved_integration is None

    async def test_get_user_integrations(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test getting user's integrations with pagination"""
        # Create multiple integrations
        for i in range(3):
            integration_data = integration_create_data.model_copy()
            integration_data.name = f"Test Integration {i + 1}"
            await self.service.create_integration(test_user.id, integration_data)

        integrations, total = await self.service.get_user_integrations(
            test_user.id,
            page=1,
            size=2
        )

        assert len(integrations) == 2
        assert total == 3

    async def test_update_integration(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test updating integration settings"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        update_data = ExternalIntegrationUpdate(
            name="Updated Integration Name",
            sync_enabled=False,
            auto_sync_interval="1h"
        )

        updated_integration = await self.service.update_integration(
            integration.id,
            test_user.id,
            update_data
        )

        assert updated_integration is not None
        assert updated_integration.name == "Updated Integration Name"
        assert updated_integration.sync_enabled is False
        assert updated_integration.auto_sync_interval == "1h"

    async def test_delete_integration(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test deleting integration"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        success = await self.service.delete_integration(
            integration.id,
            test_user.id
        )

        assert success is True

        # Verify integration is deleted
        deleted_integration = await self.service.get_integration(
            integration.id,
            test_user.id
        )
        assert deleted_integration is None

    @patch('app.services.external_integration_service.httpx.AsyncClient')
    async def test_generate_oauth_url(self, mock_client):
        """Test OAuth URL generation"""
        oauth_url = await self.service.generate_oauth_url(
            IntegrationType.SHAREPOINT,
            "test_client_id",
            "http://localhost:3000/oauth/callback",
            "https://graph.microsoft.com/.default",
            "test_state"
        )

        assert oauth_url.startswith("https://login.microsoftonline.com")
        assert "client_id=test_client_id" in oauth_url
        assert "state=test_state" in oauth_url

    async def test_create_sync_log(self, test_user: User, integration_create_data: ExternalIntegrationCreate, test_document: Document):
        """Test creating sync log"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        sync_log = await self.service._create_sync_log(
            integration.id,
            "upload",
            "to_external",
            document_id=test_document.id,
            external_file_path="/test/path"
        )

        assert sync_log is not None
        assert sync_log.integration_id == integration.id
        assert sync_log.operation == "upload"
        assert sync_log.direction == "to_external"
        assert sync_log.document_id == test_document.id
        assert sync_log.external_file_path == "/test/path"
        assert sync_log.status == "running"

    async def test_complete_sync_log(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test completing sync log"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        sync_log = await self.service._create_sync_log(
            integration.id,
            "download",
            "from_external"
        )

        await self.service._complete_sync_log(
            sync_log.id,
            "success",
            files_processed=5,
            files_succeeded=4,
            files_failed=1
        )

        # Refresh from database
        self.db.refresh(sync_log)

        assert sync_log.status == "success"
        assert sync_log.files_processed == "5"
        assert sync_log.files_succeeded == "4"
        assert sync_log.files_failed == "1"
        assert sync_log.completed_at is not None
        assert sync_log.duration_ms is not None

    async def test_get_sync_logs(self, test_user: User, integration_create_data: ExternalIntegrationCreate):
        """Test getting sync logs"""
        integration = await self.service.create_integration(
            test_user.id,
            integration_create_data
        )

        # Create multiple sync logs
        for i in range(3):
            await self.service._create_sync_log(
                integration.id,
                "sync",
                "bidirectional"
            )

        logs, total = await self.service.get_sync_logs(
            integration.id,
            test_user.id,
            page=1,
            size=2
        )

        assert len(logs) == 2
        assert total == 3


class TestSharePointService:
    """Test SharePoint integration service"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = SharePointService(db_session)

    @patch('app.services.integrations.sharepoint_service.httpx.AsyncClient')
    async def test_exchange_code_for_tokens(self, mock_client):
        """Test OAuth code exchange for SharePoint"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600
        }
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        result = await self.service._exchange_code_for_tokens(
            IntegrationType.SHAREPOINT,
            "client_id",
            "client_secret",
            "redirect_uri",
            "auth_code"
        )

        assert result["access_token"] == "test_access_token"
        assert result["refresh_token"] == "test_refresh_token"
        assert result["expires_in"] == 3600

    @patch('app.services.integrations.sharepoint_service.httpx.AsyncClient')
    async def test_refresh_access_token(self, mock_client):
        """Test refreshing SharePoint access token"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "expires_in": 3600
        }
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        result = await self.service._refresh_access_token(
            IntegrationType.SHAREPOINT,
            "client_id",
            "client_secret",
            "refresh_token"
        )

        assert result["access_token"] == "new_access_token"
        assert result["expires_in"] == 3600

    @patch('app.services.integrations.sharepoint_service.httpx.AsyncClient')
    async def test_test_api_connectivity(self, mock_client, test_user: User):
        """Test SharePoint API connectivity"""
        mock_response = Mock()
        mock_response.json.return_value = {"id": "test_user_id"}
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        # Create mock integration
        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.SHAREPOINT,
            name="Test Integration",
            access_token=self.service._encrypt_data("test_token"),
            status=IntegrationStatus.ACTIVE
        )

        # Should not raise exception
        await self.service._test_api_connectivity(integration)


class TestGoogleService:
    """Test Google Drive/Workspace integration service"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = GoogleService(db_session)

    @patch('app.services.integrations.google_service.httpx.AsyncClient')
    async def test_exchange_code_for_tokens(self, mock_client):
        """Test OAuth code exchange for Google"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600
        }
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        result = await self.service._exchange_code_for_tokens(
            IntegrationType.GOOGLE_DRIVE,
            "client_id",
            "client_secret",
            "redirect_uri",
            "auth_code"
        )

        assert result["access_token"] == "test_access_token"
        assert result["refresh_token"] == "test_refresh_token"

    @patch('app.services.integrations.google_service.httpx.AsyncClient')
    async def test_test_api_connectivity(self, mock_client, test_user: User):
        """Test Google API connectivity"""
        mock_response = Mock()
        mock_response.json.return_value = {"user": {"emailAddress": "test@example.com"}}
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.GOOGLE_DRIVE,
            name="Test Integration",
            access_token=self.service._encrypt_data("test_token"),
            status=IntegrationStatus.ACTIVE
        )

        await self.service._test_api_connectivity(integration)


class TestBoxService:
    """Test Box integration service"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = BoxService(db_session)

    @patch('app.services.integrations.box_service.httpx.AsyncClient')
    async def test_exchange_code_for_tokens(self, mock_client):
        """Test OAuth code exchange for Box"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600
        }
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        result = await self.service._exchange_code_for_tokens(
            IntegrationType.BOX,
            "client_id",
            "client_secret",
            "redirect_uri",
            "auth_code"
        )

        assert result["access_token"] == "test_access_token"

    @patch('app.services.integrations.box_service.httpx.AsyncClient')
    async def test_test_api_connectivity(self, mock_client, test_user: User):
        """Test Box API connectivity"""
        mock_response = Mock()
        mock_response.json.return_value = {"id": "12345", "name": "Test User"}
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.BOX,
            name="Test Integration",
            access_token=self.service._encrypt_data("test_token"),
            status=IntegrationStatus.ACTIVE
        )

        await self.service._test_api_connectivity(integration)


class TestDropboxService:
    """Test Dropbox integration service"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = DropboxService(db_session)

    @patch('app.services.integrations.dropbox_service.httpx.AsyncClient')
    async def test_exchange_code_for_tokens(self, mock_client):
        """Test OAuth code exchange for Dropbox"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600
        }
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        result = await self.service._exchange_code_for_tokens(
            IntegrationType.DROPBOX,
            "client_id",
            "client_secret",
            "redirect_uri",
            "auth_code"
        )

        assert result["access_token"] == "test_access_token"

    @patch('app.services.integrations.dropbox_service.httpx.AsyncClient')
    async def test_test_api_connectivity(self, mock_client, test_user: User):
        """Test Dropbox API connectivity"""
        mock_response = Mock()
        mock_response.json.return_value = {"account_id": "test_id", "name": {"given_name": "Test"}}
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.DROPBOX,
            name="Test Integration",
            access_token=self.service._encrypt_data("test_token"),
            status=IntegrationStatus.ACTIVE
        )

        await self.service._test_api_connectivity(integration)


class TestIntegrationHealthCheck:
    """Test integration health check functionality"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = ExternalIntegrationService(db_session)

    async def test_health_check_no_integration(self, test_user: User):
        """Test health check for non-existent integration"""
        fake_id = str(uuid.uuid4())
        health_data = await self.service.check_integration_health(fake_id, test_user.id)

        assert "error" in health_data
        assert health_data["error"] == "Integration not found"

    async def test_health_check_no_token(self, test_user: User, db_session: Session):
        """Test health check for integration without access token"""
        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.SHAREPOINT,
            name="Test Integration",
            status=IntegrationStatus.PENDING
        )
        db_session.add(integration)
        db_session.commit()

        health_data = await self.service.check_integration_health(integration.id, test_user.id)

        assert health_data["is_healthy"] is False
        assert "No access token available" in health_data["issues"]

    async def test_health_check_expired_token(self, test_user: User, db_session: Session):
        """Test health check for integration with expired token"""
        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.SHAREPOINT,
            name="Test Integration",
            access_token=self.service._encrypt_data("expired_token"),
            token_expires_at=datetime.utcnow() - timedelta(hours=1),
            status=IntegrationStatus.EXPIRED
        )
        db_session.add(integration)
        db_session.commit()

        health_data = await self.service.check_integration_health(integration.id, test_user.id)

        assert health_data["is_healthy"] is False
        assert "Access token expired" in health_data["issues"]


class TestSyncOperations:
    """Test sync operation functionality"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = ExternalIntegrationService(db_session)

    async def test_sync_operation_request_creation(self, test_user: User, db_session: Session, test_document: Document):
        """Test creating sync operation request"""
        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.SHAREPOINT,
            name="Test Integration",
            access_token=self.service._encrypt_data("test_token"),
            status=IntegrationStatus.ACTIVE
        )
        db_session.add(integration)
        db_session.commit()

        sync_request = SyncOperationRequest(
            operation="sync",
            document_ids=[test_document.id],
            options={"destination_path": "/test"}
        )

        # Mock the specific service method
        with patch.object(self.service, '_perform_sync_operation', new_callable=AsyncMock) as mock_sync:
            operation_id = await self.service.sync_documents(
                integration.id,
                test_user.id,
                sync_request
            )

            assert operation_id is not None
            assert len(operation_id) > 0
            mock_sync.assert_called_once()


# Integration tests with mocked external APIs
class TestIntegrationEndToEnd:
    """End-to-end integration tests with mocked APIs"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        self.service = SharePointService(db_session)

    @patch('app.services.integrations.sharepoint_service.httpx.AsyncClient')
    async def test_full_sharepoint_flow(self, mock_client, test_user: User, test_document: Document):
        """Test complete SharePoint integration flow"""
        # Mock OAuth token exchange
        token_response = Mock()
        token_response.json.return_value = {
            "access_token": "test_token",
            "refresh_token": "test_refresh",
            "expires_in": 3600
        }
        token_response.raise_for_status = Mock()

        # Mock file upload
        upload_response = Mock()
        upload_response.json.return_value = {"id": "uploaded_file_id"}
        upload_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=token_response)
        mock_client.return_value.__aenter__.return_value.put = AsyncMock(return_value=upload_response)

        # Test token exchange
        tokens = await self.service._exchange_code_for_tokens(
            IntegrationType.SHAREPOINT,
            "client_id",
            "client_secret",
            "redirect_uri",
            "auth_code"
        )

        assert tokens["access_token"] == "test_token"

        # Create integration
        integration = ExternalIntegration(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            integration_type=IntegrationType.SHAREPOINT,
            name="Test Integration",
            access_token=self.service._encrypt_data(tokens["access_token"]),
            status=IntegrationStatus.ACTIVE
        )

        # Mock additional API calls for upload
        drive_response = Mock()
        drive_response.json.return_value = {"id": "drive_id"}
        drive_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=drive_response)

        # Test file upload
        upload_request = FileUploadRequest(
            document_id=test_document.id,
            destination_path="/test",
            overwrite=True
        )

        file_id = await self.service._upload_file(
            integration,
            test_document,
            "/test",
            True,
            {}
        )

        assert file_id == "uploaded_file_id"