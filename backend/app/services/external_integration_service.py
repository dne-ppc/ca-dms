"""
External Integration Service for managing third-party service connections
"""
import uuid
import json
import asyncio
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from cryptography.fernet import Fernet
from app.models.external_integration import (
    ExternalIntegration,
    IntegrationSyncLog,
    IntegrationWebhook,
    IntegrationType,
    IntegrationStatus
)
from app.models.document import Document
from app.schemas.external_integration import (
    ExternalIntegrationCreate,
    ExternalIntegrationUpdate,
    OAuthTokenExchange,
    SyncOperationRequest,
    FileUploadRequest,
    FileDownloadRequest,
    ExternalFileInfo
)
from app.core.config import settings


class ExternalIntegrationService:
    """Service for managing external integrations"""

    def __init__(self, db: Session):
        self.db = db
        self._encryption_key = settings.SECRET_KEY.encode()[:32].ljust(32, b'0')
        self._cipher = Fernet(Fernet.generate_key())

    # Integration Management
    async def create_integration(
        self,
        user_id: str,
        integration_data: ExternalIntegrationCreate
    ) -> ExternalIntegration:
        """Create a new external integration"""
        integration_id = str(uuid.uuid4())

        # Encrypt sensitive data
        encrypted_client_secret = self._encrypt_data(integration_data.client_secret)

        integration = ExternalIntegration(
            id=integration_id,
            user_id=user_id,
            integration_type=integration_data.integration_type,
            name=integration_data.name,
            description=integration_data.description,
            client_id=integration_data.client_id,
            client_secret=encrypted_client_secret,
            redirect_uri=integration_data.redirect_uri,
            scope=integration_data.scope,
            settings=integration_data.settings or {},
            sync_enabled=integration_data.sync_enabled,
            auto_sync_interval=integration_data.auto_sync_interval,
            status=IntegrationStatus.PENDING
        )

        self.db.add(integration)
        self.db.commit()
        self.db.refresh(integration)

        return integration

    async def get_integration(self, integration_id: str, user_id: str) -> Optional[ExternalIntegration]:
        """Get integration by ID and user"""
        return self.db.query(ExternalIntegration).filter(
            and_(
                ExternalIntegration.id == integration_id,
                ExternalIntegration.user_id == user_id
            )
        ).first()

    async def get_user_integrations(
        self,
        user_id: str,
        integration_type: Optional[IntegrationType] = None,
        status: Optional[IntegrationStatus] = None,
        page: int = 1,
        size: int = 20
    ) -> Tuple[List[ExternalIntegration], int]:
        """Get user's integrations with pagination"""
        query = self.db.query(ExternalIntegration).filter(
            ExternalIntegration.user_id == user_id
        )

        if integration_type:
            query = query.filter(ExternalIntegration.integration_type == integration_type)

        if status:
            query = query.filter(ExternalIntegration.status == status)

        total = query.count()

        integrations = query.order_by(desc(ExternalIntegration.created_at)).offset(
            (page - 1) * size
        ).limit(size).all()

        return integrations, total

    async def update_integration(
        self,
        integration_id: str,
        user_id: str,
        update_data: ExternalIntegrationUpdate
    ) -> Optional[ExternalIntegration]:
        """Update integration settings"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(integration, field, value)

        integration.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(integration)

        return integration

    async def delete_integration(self, integration_id: str, user_id: str) -> bool:
        """Delete integration and all related data"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration:
            return False

        # Delete sync logs and webhooks (cascade will handle this)
        self.db.delete(integration)
        self.db.commit()

        return True

    # OAuth Flow Management
    async def generate_oauth_url(
        self,
        integration_type: IntegrationType,
        client_id: str,
        redirect_uri: str,
        scope: str,
        state: Optional[str] = None
    ) -> str:
        """Generate OAuth authorization URL"""
        state = state or str(uuid.uuid4())

        # Integration-specific OAuth URLs
        oauth_urls = {
            IntegrationType.SHAREPOINT: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            IntegrationType.ONEDRIVE: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            IntegrationType.GOOGLE_DRIVE: "https://accounts.google.com/o/oauth2/v2/auth",
            IntegrationType.GOOGLE_WORKSPACE: "https://accounts.google.com/o/oauth2/v2/auth",
            IntegrationType.BOX: "https://account.box.com/api/oauth2/authorize",
            IntegrationType.DROPBOX: "https://www.dropbox.com/oauth2/authorize"
        }

        base_url = oauth_urls.get(integration_type)
        if not base_url:
            raise ValueError(f"Unsupported integration type: {integration_type}")

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "state": state,
            "response_type": "code"
        }

        # Add integration-specific parameters
        if integration_type in [IntegrationType.SHAREPOINT, IntegrationType.ONEDRIVE]:
            params["response_mode"] = "query"

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query_string}"

    async def exchange_oauth_code(
        self,
        integration_id: str,
        user_id: str,
        authorization_code: str
    ) -> bool:
        """Exchange OAuth authorization code for tokens"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration:
            return False

        try:
            # Get integration-specific token exchange implementation
            token_response = await self._exchange_code_for_tokens(
                integration.integration_type,
                integration.client_id,
                self._decrypt_data(integration.client_secret),
                integration.redirect_uri,
                authorization_code
            )

            # Store encrypted tokens
            integration.access_token = self._encrypt_data(token_response["access_token"])
            if token_response.get("refresh_token"):
                integration.refresh_token = self._encrypt_data(token_response["refresh_token"])

            if token_response.get("expires_in"):
                integration.token_expires_at = datetime.utcnow() + timedelta(
                    seconds=token_response["expires_in"]
                )

            integration.status = IntegrationStatus.ACTIVE
            integration.last_error = None
            integration.updated_at = datetime.utcnow()

            self.db.commit()
            return True

        except Exception as e:
            integration.status = IntegrationStatus.ERROR
            integration.last_error = str(e)
            self.db.commit()
            return False

    async def refresh_access_token(
        self,
        integration_id: str,
        user_id: str
    ) -> bool:
        """Refresh expired access token"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration or not integration.refresh_token:
            return False

        try:
            # Get integration-specific token refresh implementation
            token_response = await self._refresh_access_token(
                integration.integration_type,
                integration.client_id,
                self._decrypt_data(integration.client_secret),
                self._decrypt_data(integration.refresh_token)
            )

            # Update tokens
            integration.access_token = self._encrypt_data(token_response["access_token"])
            if token_response.get("refresh_token"):
                integration.refresh_token = self._encrypt_data(token_response["refresh_token"])

            if token_response.get("expires_in"):
                integration.token_expires_at = datetime.utcnow() + timedelta(
                    seconds=token_response["expires_in"]
                )

            integration.status = IntegrationStatus.ACTIVE
            integration.last_error = None
            integration.updated_at = datetime.utcnow()

            self.db.commit()
            return True

        except Exception as e:
            integration.status = IntegrationStatus.ERROR
            integration.last_error = str(e)
            self.db.commit()
            return False

    # File Operations
    async def list_external_files(
        self,
        integration_id: str,
        user_id: str,
        folder_path: str = "/",
        page_token: Optional[str] = None
    ) -> List[ExternalFileInfo]:
        """List files in external service"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration or integration.status != IntegrationStatus.ACTIVE:
            raise ValueError("Integration not active")

        # Ensure valid access token
        await self._ensure_valid_token(integration)

        # Get integration-specific file listing implementation
        return await self._list_files(integration, folder_path, page_token)

    async def upload_document(
        self,
        integration_id: str,
        user_id: str,
        upload_request: FileUploadRequest
    ) -> str:
        """Upload document to external service"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration or integration.status != IntegrationStatus.ACTIVE:
            raise ValueError("Integration not active")

        # Get document
        document = self.db.query(Document).filter(
            Document.id == upload_request.document_id
        ).first()
        if not document:
            raise ValueError("Document not found")

        # Log sync operation
        sync_log = await self._create_sync_log(
            integration.id,
            "upload",
            "to_external",
            document_id=upload_request.document_id,
            external_file_path=upload_request.destination_path
        )

        try:
            # Ensure valid access token
            await self._ensure_valid_token(integration)

            # Upload file using integration-specific implementation
            external_file_id = await self._upload_file(
                integration,
                document,
                upload_request.destination_path,
                upload_request.overwrite,
                upload_request.metadata
            )

            # Update sync log
            await self._complete_sync_log(
                sync_log.id,
                "success",
                external_file_id=external_file_id,
                files_processed=1,
                files_succeeded=1
            )

            return external_file_id

        except Exception as e:
            await self._complete_sync_log(
                sync_log.id,
                "error",
                error_message=str(e),
                files_processed=1,
                files_failed=1
            )
            raise

    async def download_file(
        self,
        integration_id: str,
        user_id: str,
        download_request: FileDownloadRequest
    ) -> str:
        """Download file from external service"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration or integration.status != IntegrationStatus.ACTIVE:
            raise ValueError("Integration not active")

        # Log sync operation
        sync_log = await self._create_sync_log(
            integration.id,
            "download",
            "from_external",
            external_file_id=download_request.external_file_id
        )

        try:
            # Ensure valid access token
            await self._ensure_valid_token(integration)

            # Download file using integration-specific implementation
            document_id = await self._download_file(
                integration,
                download_request.external_file_id,
                download_request.destination_document_id,
                download_request.create_new_document
            )

            # Update sync log
            await self._complete_sync_log(
                sync_log.id,
                "success",
                document_id=document_id,
                files_processed=1,
                files_succeeded=1
            )

            return document_id

        except Exception as e:
            await self._complete_sync_log(
                sync_log.id,
                "error",
                error_message=str(e),
                files_processed=1,
                files_failed=1
            )
            raise

    # Sync Operations
    async def sync_documents(
        self,
        integration_id: str,
        user_id: str,
        sync_request: SyncOperationRequest
    ) -> str:
        """Perform bidirectional sync between CA-DMS and external service"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration or integration.status != IntegrationStatus.ACTIVE:
            raise ValueError("Integration not active")

        operation_id = str(uuid.uuid4())

        # Start async sync operation
        asyncio.create_task(self._perform_sync_operation(
            integration,
            sync_request,
            operation_id
        ))

        return operation_id

    # Sync Logs
    async def get_sync_logs(
        self,
        integration_id: str,
        user_id: str,
        operation: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        size: int = 20
    ) -> Tuple[List[IntegrationSyncLog], int]:
        """Get sync logs for integration"""
        # Verify integration ownership
        integration = await self.get_integration(integration_id, user_id)
        if not integration:
            return [], 0

        query = self.db.query(IntegrationSyncLog).filter(
            IntegrationSyncLog.integration_id == integration_id
        )

        if operation:
            query = query.filter(IntegrationSyncLog.operation == operation)

        if status:
            query = query.filter(IntegrationSyncLog.status == status)

        total = query.count()

        logs = query.order_by(desc(IntegrationSyncLog.started_at)).offset(
            (page - 1) * size
        ).limit(size).all()

        return logs, total

    # Health Check
    async def check_integration_health(
        self,
        integration_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Check integration health and connectivity"""
        integration = await self.get_integration(integration_id, user_id)
        if not integration:
            return {"error": "Integration not found"}

        health_data = {
            "integration_id": integration_id,
            "integration_type": integration.integration_type,
            "name": integration.name,
            "is_healthy": False,
            "status": integration.status,
            "last_check": datetime.utcnow(),
            "issues": [],
            "recommendations": []
        }

        try:
            # Check token validity
            if not integration.access_token:
                health_data["issues"].append("No access token available")
                health_data["recommendations"].append("Complete OAuth authorization")
                return health_data

            # Check token expiration
            if integration.token_expires_at and integration.token_expires_at <= datetime.utcnow():
                health_data["issues"].append("Access token expired")
                health_data["recommendations"].append("Refresh access token")

                # Try to refresh token
                if await self.refresh_access_token(integration_id, user_id):
                    health_data["recommendations"].append("Token refreshed successfully")
                else:
                    return health_data

            # Test API connectivity
            await self._test_api_connectivity(integration)
            health_data["is_healthy"] = True

        except Exception as e:
            health_data["issues"].append(f"API connectivity failed: {str(e)}")
            health_data["recommendations"].append("Check network connectivity and credentials")

        return health_data

    # Private helper methods
    def _encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self._cipher.encrypt(data.encode()).decode()

    def _decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self._cipher.decrypt(encrypted_data.encode()).decode()

    async def _ensure_valid_token(self, integration: ExternalIntegration) -> None:
        """Ensure integration has valid access token"""
        if integration.token_expires_at and integration.token_expires_at <= datetime.utcnow():
            success = await self.refresh_access_token(integration.id, integration.user_id)
            if not success:
                raise ValueError("Failed to refresh access token")

    async def _create_sync_log(
        self,
        integration_id: str,
        operation: str,
        direction: str,
        document_id: Optional[str] = None,
        external_file_id: Optional[str] = None,
        external_file_path: Optional[str] = None
    ) -> IntegrationSyncLog:
        """Create sync log entry"""
        log = IntegrationSyncLog(
            id=str(uuid.uuid4()),
            integration_id=integration_id,
            operation=operation,
            direction=direction,
            document_id=document_id,
            external_file_id=external_file_id,
            external_file_path=external_file_path,
            status="running",
            started_at=datetime.utcnow()
        )

        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        return log

    async def _complete_sync_log(
        self,
        log_id: str,
        status: str,
        external_file_id: Optional[str] = None,
        document_id: Optional[str] = None,
        files_processed: int = 0,
        files_succeeded: int = 0,
        files_failed: int = 0,
        error_message: Optional[str] = None
    ) -> None:
        """Complete sync log entry"""
        log = self.db.query(IntegrationSyncLog).filter(
            IntegrationSyncLog.id == log_id
        ).first()

        if log:
            log.status = status
            log.completed_at = datetime.utcnow()
            log.duration_ms = str(int((log.completed_at - log.started_at).total_seconds() * 1000))
            log.files_processed = str(files_processed)
            log.files_succeeded = str(files_succeeded)
            log.files_failed = str(files_failed)
            log.error_message = error_message

            if external_file_id:
                log.external_file_id = external_file_id
            if document_id:
                log.document_id = document_id

            self.db.commit()

    # Integration-specific implementations (to be implemented by specific connectors)
    async def _exchange_code_for_tokens(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        authorization_code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _refresh_access_token(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        refresh_token: str
    ) -> Dict[str, Any]:
        """Refresh access token - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _list_files(
        self,
        integration: ExternalIntegration,
        folder_path: str,
        page_token: Optional[str]
    ) -> List[ExternalFileInfo]:
        """List files - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _upload_file(
        self,
        integration: ExternalIntegration,
        document: Document,
        destination_path: str,
        overwrite: bool,
        metadata: Dict[str, Any]
    ) -> str:
        """Upload file - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _download_file(
        self,
        integration: ExternalIntegration,
        external_file_id: str,
        destination_document_id: Optional[str],
        create_new_document: bool
    ) -> str:
        """Download file - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _test_api_connectivity(self, integration: ExternalIntegration) -> None:
        """Test API connectivity - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")

    async def _perform_sync_operation(
        self,
        integration: ExternalIntegration,
        sync_request: SyncOperationRequest,
        operation_id: str
    ) -> None:
        """Perform sync operation - integration specific"""
        raise NotImplementedError("Implement in specific integration connector")