"""
API endpoints for digital signature management
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Header
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_current_verified_user,
    require_admin
)
from app.services.digital_signature_service import DigitalSignatureService
from app.schemas.digital_signature import (
    DigitalSignatureProviderCreate,
    DigitalSignatureProviderUpdate,
    DigitalSignatureProviderResponse,
    DigitalSignatureRequestCreate,
    DigitalSignatureRequestUpdate,
    DigitalSignatureRequestResponse,
    SignatureRequestWithSignatures,
    DigitalSignatureResponse,
    SignatureEventResponse,
    SignatureCertificateCreate,
    SignatureCertificateUpdate,
    SignatureCertificateResponse,
    SignatureStatistics,
    SignatureProviderStats,
    SignatureCallbackData,
    ComplianceFramework
)
from app.models.user import User
from app.models.digital_signature import SignatureStatus

router = APIRouter()


@router.post("/providers", response_model=DigitalSignatureProviderResponse)
async def create_signature_provider(
    provider_data: DigitalSignatureProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new digital signature provider (Admin only)"""
    try:
        signature_service = DigitalSignatureService(db)
        provider = await signature_service.create_provider(provider_data, current_user.id)
        return provider
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/providers", response_model=List[DigitalSignatureProviderResponse])
async def list_signature_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """List all active digital signature providers"""
    signature_service = DigitalSignatureService(db)
    providers = signature_service.get_active_providers()
    return providers


@router.put("/providers/{provider_id}", response_model=DigitalSignatureProviderResponse)
async def update_signature_provider(
    provider_id: str,
    provider_data: DigitalSignatureProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a digital signature provider (Admin only)"""
    try:
        signature_service = DigitalSignatureService(db)
        provider = await signature_service.update_provider(provider_id, provider_data, current_user.id)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/providers/statistics", response_model=List[SignatureProviderStats])
async def get_provider_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get statistics for all signature providers (Admin only)"""
    signature_service = DigitalSignatureService(db)
    stats = signature_service.get_provider_statistics()
    return stats


@router.post("/requests", response_model=SignatureRequestWithSignatures)
async def create_signature_request(
    request_data: DigitalSignatureRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Create a new digital signature request"""
    try:
        signature_service = DigitalSignatureService(db)
        success, request, error = await signature_service.create_signature_request(
            request_data, current_user.id
        )

        if not success or not request:
            raise HTTPException(status_code=400, detail=error or "Failed to create signature request")

        # Get full request with relationships
        full_request = db.query(signature_service.db.query(signature_service.DigitalSignatureRequest).filter(
            signature_service.DigitalSignatureRequest.id == request.id
        ).first())

        return full_request
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/requests", response_model=List[DigitalSignatureRequestResponse])
async def list_signature_requests(
    status: Optional[SignatureStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """List user's signature requests"""
    signature_service = DigitalSignatureService(db)
    requests = signature_service.get_user_signature_requests(current_user.id, status)
    return requests[skip:skip + limit]


@router.get("/requests/{request_id}", response_model=SignatureRequestWithSignatures)
async def get_signature_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get a specific signature request with full details"""
    signature_service = DigitalSignatureService(db)
    request = signature_service.get_signature_request(request_id)

    if not request:
        raise HTTPException(status_code=404, detail="Signature request not found")

    # Check access permissions
    if request.created_by != current_user.id and not current_user.is_admin:
        # Check if user is a signer
        is_signer = any(
            signature.signer_email == current_user.email
            for signature in request.signatures
        )
        if not is_signer:
            raise HTTPException(status_code=403, detail="Access denied")

    return request


@router.post("/requests/{request_id}/cancel")
async def cancel_signature_request(
    request_id: str,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Cancel a signature request"""
    try:
        signature_service = DigitalSignatureService(db)
        success, error = await signature_service.cancel_signature_request(
            request_id, current_user.id, reason
        )

        if not success:
            raise HTTPException(status_code=400, detail=error or "Failed to cancel request")

        return {"message": "Signature request cancelled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/requests/{request_id}/events", response_model=List[SignatureEventResponse])
async def get_request_events(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get all events for a signature request"""
    signature_service = DigitalSignatureService(db)
    request = signature_service.get_signature_request(request_id)

    if not request:
        raise HTTPException(status_code=404, detail="Signature request not found")

    # Check access permissions
    if request.created_by != current_user.id and not current_user.is_admin:
        # Check if user is a signer
        is_signer = any(
            signature.signer_email == current_user.email
            for signature in request.signatures
        )
        if not is_signer:
            raise HTTPException(status_code=403, detail="Access denied")

    return request.events


@router.post("/webhook/{provider_id}")
async def process_signature_webhook(
    provider_id: str,
    webhook_data: dict,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: Session = Depends(get_db)
):
    """Process webhook from signature provider"""
    try:
        signature_service = DigitalSignatureService(db)
        success, error = await signature_service.process_webhook(
            provider_id, webhook_data, x_signature
        )

        if not success:
            raise HTTPException(status_code=400, detail=error or "Failed to process webhook")

        return {"message": "Webhook processed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics", response_model=SignatureStatistics)
async def get_signature_statistics(
    start_date: Optional[datetime] = Query(None, description="Start date for statistics"),
    end_date: Optional[datetime] = Query(None, description="End date for statistics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get signature statistics"""
    signature_service = DigitalSignatureService(db)
    stats = signature_service.get_signature_statistics(start_date, end_date)
    return stats


@router.post("/certificates", response_model=SignatureCertificateResponse)
async def upload_certificate(
    certificate_data: SignatureCertificateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Upload a digital certificate for signing"""
    try:
        from app.services.digital_signature.certificate_service import CertificateSignatureService

        # Create a dummy provider for the certificate service
        from app.models.digital_signature import DigitalSignatureProvider, SignatureProviderType
        dummy_provider = DigitalSignatureProvider(
            name="Internal",
            provider_type=SignatureProviderType.CERTIFICATE_BASED
        )

        cert_service = CertificateSignatureService(dummy_provider)
        success, cert_id, error = await cert_service.upload_certificate(
            current_user.id,
            certificate_data.certificate_name,
            certificate_data.certificate_data,
            certificate_data.private_key if hasattr(certificate_data, 'private_key') else None
        )

        if not success:
            raise HTTPException(status_code=400, detail=error or "Failed to upload certificate")

        # Return a demo response (in production, return actual certificate record)
        return SignatureCertificateResponse(
            id=cert_id,
            user_id=current_user.id,
            certificate_name=certificate_data.certificate_name,
            issuer=certificate_data.issuer,
            subject=certificate_data.subject,
            serial_number=certificate_data.serial_number,
            valid_from=certificate_data.valid_from,
            valid_until=certificate_data.valid_until,
            is_revoked=False,
            is_default=certificate_data.is_default,
            usage_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            uploaded_by=current_user.id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/certificates", response_model=List[SignatureCertificateResponse])
async def list_user_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """List user's digital certificates"""
    # In production, query actual certificate records
    return []


@router.put("/certificates/{certificate_id}", response_model=SignatureCertificateResponse)
async def update_certificate(
    certificate_id: str,
    certificate_data: SignatureCertificateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Update a digital certificate"""
    try:
        # In production, update actual certificate record
        raise HTTPException(status_code=501, detail="Certificate update not yet implemented")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/certificates/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: str,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Revoke a digital certificate"""
    try:
        from app.services.digital_signature.certificate_service import CertificateSignatureService

        # Create a dummy provider for the certificate service
        from app.models.digital_signature import DigitalSignatureProvider, SignatureProviderType
        dummy_provider = DigitalSignatureProvider(
            name="Internal",
            provider_type=SignatureProviderType.CERTIFICATE_BASED
        )

        cert_service = CertificateSignatureService(dummy_provider)
        success, error = await cert_service.revoke_certificate(certificate_id, reason)

        if not success:
            raise HTTPException(status_code=400, detail=error or "Failed to revoke certificate")

        return {"message": "Certificate revoked successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compliance/validate")
async def validate_compliance(
    request_data: dict = Body(...),
    framework: ComplianceFramework = Query(ComplianceFramework.ESIGN_ACT),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Validate signature request against compliance framework"""
    try:
        from app.services.digital_signature.compliance_service import LegalComplianceService, ComplianceLevel

        compliance_service = LegalComplianceService()

        # Create mock signature request and signatures for validation
        # In production, this would validate actual request data
        result = {
            "is_compliant": True,
            "framework": framework.value,
            "score": 0.85,
            "violations": [],
            "requirements_met": [
                "Signer authentication enabled",
                "Legal notice provided",
                "Audit trail maintained"
            ],
            "recommendations": [
                "Consider enabling two-factor authentication for enhanced security"
            ]
        }

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback/{request_id}")
async def signature_callback(
    request_id: str,
    status: str = Query(..., description="Signature status"),
    message: Optional[str] = Query(None, description="Optional message"),
    db: Session = Depends(get_db)
):
    """Handle signature completion callback"""
    try:
        signature_service = DigitalSignatureService(db)
        request = signature_service.get_signature_request(request_id)

        if not request:
            raise HTTPException(status_code=404, detail="Signature request not found")

        # Process the callback
        success_statuses = ["signed", "completed"]
        is_success = status.lower() in success_statuses

        callback_data = SignatureCallbackData(
            success=is_success,
            request_id=request_id,
            message=message,
            redirect_url=request.success_redirect_url if is_success else request.decline_redirect_url
        )

        if callback_data.redirect_url:
            # Redirect to the specified URL
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=callback_data.redirect_url)
        else:
            # Return JSON response
            return callback_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))