"""
External Integrations API endpoints
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.external_integration import IntegrationType, IntegrationStatus
from app.services.external_integration_service import ExternalIntegrationService
from app.services.integrations.sharepoint_service import SharePointService
from app.services.integrations.google_service import GoogleService
from app.services.integrations.box_service import BoxService
from app.services.integrations.dropbox_service import DropboxService
from app.schemas.external_integration import (
    ExternalIntegrationCreate,
    ExternalIntegrationUpdate,
    ExternalIntegrationResponse,
    ExternalIntegrationListResponse,
    OAuthAuthorizationRequest,
    OAuthAuthorizationResponse,
    OAuthTokenExchange,
    SyncOperationRequest,
    SyncOperationResponse,
    IntegrationSyncLogListResponse,
    ExternalFileListResponse,
    FileUploadRequest,
    FileDownloadRequest,
    IntegrationStatusResponse,
    IntegrationHealthResponse,
    BulkSyncRequest,
    BulkSyncResponse
)

router = APIRouter()


def get_integration_service(integration_type: IntegrationType, db: Session) -> ExternalIntegrationService:
    """Get appropriate integration service based on type"""
    services = {
        IntegrationType.SHAREPOINT: SharePointService,
        IntegrationType.ONEDRIVE: SharePointService,
        IntegrationType.GOOGLE_DRIVE: GoogleService,
        IntegrationType.GOOGLE_WORKSPACE: GoogleService,
        IntegrationType.BOX: BoxService,
        IntegrationType.DROPBOX: DropboxService
    }

    service_class = services.get(integration_type)
    if not service_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported integration type: {integration_type}"
        )

    return service_class(db)


# Integration Management Endpoints
@router.post("/", response_model=ExternalIntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    integration_data: ExternalIntegrationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new external integration"""
    service = get_integration_service(integration_data.integration_type, db)

    try:
        integration = await service.create_integration(current_user.id, integration_data)
        return ExternalIntegrationResponse.model_validate(integration)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=ExternalIntegrationListResponse)
async def list_integrations(
    integration_type: Optional[IntegrationType] = Query(None),
    status_filter: Optional[IntegrationStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's external integrations"""
    service = ExternalIntegrationService(db)

    integrations, total = await service.get_user_integrations(
        current_user.id,
        integration_type=integration_type,
        status=status_filter,
        page=page,
        size=size
    )

    return ExternalIntegrationListResponse(
        integrations=[ExternalIntegrationResponse.model_validate(i) for i in integrations],
        total=total,
        page=page,
        size=size,
        has_next=(page * size) < total,
        has_prev=page > 1
    )


@router.get("/{integration_id}", response_model=ExternalIntegrationResponse)
async def get_integration(
    integration_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get integration by ID"""
    service = ExternalIntegrationService(db)

    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    return ExternalIntegrationResponse.model_validate(integration)


@router.put("/{integration_id}", response_model=ExternalIntegrationResponse)
async def update_integration(
    integration_id: str,
    update_data: ExternalIntegrationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update integration settings"""
    service = ExternalIntegrationService(db)

    integration = await service.update_integration(integration_id, current_user.id, update_data)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    return ExternalIntegrationResponse.model_validate(integration)


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete integration"""
    service = ExternalIntegrationService(db)

    success = await service.delete_integration(integration_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )


# OAuth Flow Endpoints
@router.post("/oauth/authorize", response_model=OAuthAuthorizationResponse)
async def get_oauth_authorization_url(
    auth_request: OAuthAuthorizationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get OAuth authorization URL"""
    service = get_integration_service(auth_request.integration_type, db)

    try:
        auth_url = await service.generate_oauth_url(
            auth_request.integration_type,
            auth_request.client_id,
            auth_request.redirect_uri,
            auth_request.scope,
            auth_request.state
        )

        return OAuthAuthorizationResponse(
            authorization_url=auth_url,
            state=auth_request.state or "generated"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/oauth/token", status_code=status.HTTP_200_OK)
async def exchange_oauth_token(
    token_exchange: OAuthTokenExchange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Exchange OAuth authorization code for tokens"""
    service = ExternalIntegrationService(db)

    success = await service.exchange_oauth_code(
        token_exchange.integration_id,
        current_user.id,
        token_exchange.authorization_code
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token exchange failed"
        )

    return {"message": "Integration authorized successfully"}


@router.post("/{integration_id}/oauth/refresh", status_code=status.HTTP_200_OK)
async def refresh_oauth_token(
    integration_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Refresh OAuth access token"""
    service = ExternalIntegrationService(db)

    success = await service.refresh_access_token(integration_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token refresh failed"
        )

    return {"message": "Token refreshed successfully"}


# File Operations Endpoints
@router.get("/{integration_id}/files", response_model=ExternalFileListResponse)
async def list_external_files(
    integration_id: str,
    folder_path: str = Query("/", alias="path"),
    page_token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List files in external service"""
    service = ExternalIntegrationService(db)

    # Get integration to determine service type
    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    specific_service = get_integration_service(integration.integration_type, db)

    try:
        files = await specific_service.list_external_files(
            integration_id,
            current_user.id,
            folder_path,
            page_token
        )

        return ExternalFileListResponse(
            files=files,
            total=len(files),
            has_next=False,  # Simplified - would need service-specific pagination
            next_token=None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{integration_id}/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    integration_id: str,
    upload_request: FileUploadRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload document to external service"""
    service = ExternalIntegrationService(db)

    # Get integration to determine service type
    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    specific_service = get_integration_service(integration.integration_type, db)

    try:
        external_file_id = await specific_service.upload_document(
            integration_id,
            current_user.id,
            upload_request
        )

        return {"external_file_id": external_file_id, "message": "File uploaded successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{integration_id}/download", status_code=status.HTTP_201_CREATED)
async def download_file(
    integration_id: str,
    download_request: FileDownloadRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download file from external service"""
    service = ExternalIntegrationService(db)

    # Get integration to determine service type
    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    specific_service = get_integration_service(integration.integration_type, db)

    try:
        document_id = await specific_service.download_file(
            integration_id,
            current_user.id,
            download_request
        )

        return {"document_id": document_id, "message": "File downloaded successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Sync Operations Endpoints
@router.post("/{integration_id}/sync", response_model=SyncOperationResponse)
async def sync_documents(
    integration_id: str,
    sync_request: SyncOperationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Perform sync operation"""
    service = ExternalIntegrationService(db)

    # Get integration to determine service type
    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    specific_service = get_integration_service(integration.integration_type, db)

    try:
        operation_id = await specific_service.sync_documents(
            integration_id,
            current_user.id,
            sync_request
        )

        files_queued = 0
        if sync_request.document_ids:
            files_queued += len(sync_request.document_ids)
        if sync_request.external_paths:
            files_queued += len(sync_request.external_paths)

        return SyncOperationResponse(
            operation_id=operation_id,
            status="queued",
            message="Sync operation started",
            files_queued=files_queued
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{integration_id}/sync-logs", response_model=IntegrationSyncLogListResponse)
async def get_sync_logs(
    integration_id: str,
    operation: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sync logs for integration"""
    service = ExternalIntegrationService(db)

    logs, total = await service.get_sync_logs(
        integration_id,
        current_user.id,
        operation=operation,
        status=status_filter,
        page=page,
        size=size
    )

    return IntegrationSyncLogListResponse(
        logs=[log for log in logs],  # Pydantic will handle conversion
        total=total,
        page=page,
        size=size,
        has_next=(page * size) < total,
        has_prev=page > 1
    )


# Health and Status Endpoints
@router.get("/{integration_id}/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    integration_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get integration status"""
    service = ExternalIntegrationService(db)

    integration = await service.get_integration(integration_id, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    # Get sync statistics (simplified)
    sync_stats = {
        "total_syncs": 0,
        "successful_syncs": 0,
        "failed_syncs": 0,
        "last_sync_duration": None
    }

    return IntegrationStatusResponse(
        integration_id=integration.id,
        status=integration.status,
        is_connected=integration.status == IntegrationStatus.ACTIVE,
        last_sync_at=integration.last_sync_at,
        last_error=integration.last_error,
        token_expires_at=integration.token_expires_at,
        sync_stats=sync_stats
    )


@router.get("/{integration_id}/health", response_model=IntegrationHealthResponse)
async def check_integration_health(
    integration_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check integration health"""
    service = ExternalIntegrationService(db)

    health_data = await service.check_integration_health(integration_id, current_user.id)

    if "error" in health_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=health_data["error"]
        )

    return IntegrationHealthResponse(**health_data)


# Bulk Operations
@router.post("/bulk/sync", response_model=BulkSyncResponse)
async def bulk_sync_integrations(
    bulk_request: BulkSyncRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Perform bulk operations on multiple integrations"""
    service = ExternalIntegrationService(db)

    # Verify all integrations belong to user
    integrations = []
    for integration_id in bulk_request.integration_ids:
        integration = await service.get_integration(integration_id, current_user.id)
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration not found: {integration_id}"
            )
        integrations.append(integration)

    operation_id = str(uuid.uuid4())
    results = []

    for integration in integrations:
        try:
            if bulk_request.operation == "sync":
                # Perform sync operation (simplified)
                result = {"integration_id": integration.id, "status": "queued"}
            elif bulk_request.operation == "health_check":
                # Perform health check
                health_data = await service.check_integration_health(integration.id, current_user.id)
                result = {"integration_id": integration.id, "status": "healthy" if health_data["is_healthy"] else "unhealthy"}
            elif bulk_request.operation == "refresh_tokens":
                # Refresh tokens
                success = await service.refresh_access_token(integration.id, current_user.id)
                result = {"integration_id": integration.id, "status": "success" if success else "failed"}
            else:
                result = {"integration_id": integration.id, "status": "unsupported_operation"}

            results.append(result)
        except Exception as e:
            results.append({"integration_id": integration.id, "status": "error", "error": str(e)})

    return BulkSyncResponse(
        operation_id=operation_id,
        integration_count=len(integrations),
        status="completed",
        results=results
    )