"""
Security endpoints for 2FA, SSO, and audit logging
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_active_user
from app.services.security_service import SecurityService
from app.services.sso_service import SSOService
from app.schemas.security import (
    TOTPSetupRequest, TOTPSetupResponse, TOTPVerifyRequest,
    SMSSetupRequest, SMSVerifyRequest, TwoFactorStatusResponse,
    TwoFactorDisableRequest, AuditLogResponse, AuditLogFilter,
    ComplianceReportRequest, ComplianceReportResponse,
    SecurityAlertCreate, SecurityAlertResponse, SecurityAlertUpdate,
    SSOLoginRequest, SSOLoginResponse, SSOCallbackRequest,
    SSOConfigurationResponse
)
from app.models.user import User

router = APIRouter()


def get_client_ip(request: Request) -> str:
    """Extract client IP address from request"""
    # Check for forwarded IP first (proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct connection IP
    return request.client.host if request.client else "unknown"


# 2FA Endpoints
@router.post("/2fa/totp/setup", response_model=TOTPSetupResponse)
def setup_totp_2fa(
    setup_request: TOTPSetupRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Setup TOTP 2FA for the current user"""
    security_service = SecurityService(db)

    try:
        response = security_service.setup_totp_2fa(current_user.id)

        # Log audit event with IP address
        security_service.log_audit_event(
            event_type="mfa_setup_initiated",
            user_id=current_user.id,
            severity="medium",
            message=f"TOTP 2FA setup initiated by user {current_user.email}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/2fa/totp/setup",
            http_method="POST"
        )

        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/2fa/totp/verify")
def verify_totp_setup(
    verify_request: TOTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Verify TOTP setup and enable 2FA"""
    security_service = SecurityService(db)

    success = security_service.verify_totp_setup(current_user.id, verify_request.code)

    if not success:
        # Log failed verification
        security_service.log_audit_event(
            event_type="mfa_setup_failure",
            user_id=current_user.id,
            severity="medium",
            message=f"TOTP 2FA setup verification failed for user {current_user.email}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/2fa/totp/verify",
            http_method="POST"
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    return {"message": "TOTP 2FA enabled successfully"}


@router.post("/2fa/sms/setup")
def setup_sms_2fa(
    setup_request: SMSSetupRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Setup SMS 2FA for the current user"""
    # This would integrate with SMS service (Twilio, AWS SNS, etc.)
    # For now, return a placeholder
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SMS 2FA not yet implemented"
    )


@router.get("/2fa/status", response_model=TwoFactorStatusResponse)
def get_2fa_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's 2FA status"""
    security_service = SecurityService(db)
    return security_service.get_2fa_status(current_user.id)


@router.post("/2fa/disable")
def disable_2fa(
    disable_request: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Disable 2FA for the current user"""
    security_service = SecurityService(db)

    if not disable_request.confirmation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation required to disable 2FA"
        )

    success = security_service.disable_2fa(current_user.id, disable_request.password)

    if not success:
        # Log failed attempt
        security_service.log_audit_event(
            event_type="mfa_disable_failure",
            user_id=current_user.id,
            severity="medium",
            message=f"Failed attempt to disable 2FA for user {current_user.email}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/2fa/disable",
            http_method="POST"
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )

    return {"message": "2FA disabled successfully"}


# Audit Logging Endpoints
@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    event_types: Optional[str] = None,
    severities: Optional[str] = None,
    user_ids: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get audit logs (admin only)"""
    # Check if user has admin permissions
    if not current_user.has_permission("audit_read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access audit logs"
        )

    security_service = SecurityService(db)

    # Parse filter parameters
    filters = AuditLogFilter()
    if event_types:
        filters.event_types = event_types.split(",")
    if severities:
        filters.severities = severities.split(",")
    if user_ids:
        filters.user_ids = user_ids.split(",")
    if search:
        filters.search = search

    # Parse dates if provided
    if start_date:
        try:
            from datetime import datetime
            filters.start_date = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            )

    if end_date:
        try:
            from datetime import datetime
            filters.end_date = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            )

    logs, total = security_service.get_audit_logs(filters, page, page_size)

    # Add pagination info to response headers
    # In a real implementation, you might use a different approach
    return logs


@router.post("/compliance-reports", response_model=ComplianceReportResponse)
def generate_compliance_report(
    report_request: ComplianceReportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate compliance report (admin only)"""
    # Check if user has admin permissions
    if not current_user.has_permission("compliance_reports"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to generate compliance reports"
        )

    # This would typically be handled by a background task
    # For now, return a placeholder response
    import uuid

    security_service = SecurityService(db)

    # Log report generation
    security_service.log_audit_event(
        event_type="compliance_report_generated",
        user_id=current_user.id,
        severity="medium",
        message=f"Compliance report generated by {current_user.email}",
        details={
            "report_type": report_request.report_type,
            "start_date": report_request.start_date.isoformat(),
            "end_date": report_request.end_date.isoformat(),
            "format": report_request.format
        }
    )

    return ComplianceReportResponse(
        report_id=str(uuid.uuid4()),
        report_type=report_request.report_type,
        status="generating",
        created_at=datetime.utcnow()
    )


# Security Alert Endpoints
@router.post("/alerts", response_model=SecurityAlertResponse)
def create_security_alert(
    alert_data: SecurityAlertCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a security alert (admin only)"""
    # Check if user has admin permissions
    if not current_user.has_permission("security_alerts"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create security alerts"
        )

    security_service = SecurityService(db)
    return security_service.create_security_alert(alert_data)


@router.get("/alerts", response_model=List[SecurityAlertResponse])
def get_security_alerts(
    status_filter: Optional[str] = None,
    severity: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get security alerts (admin only)"""
    # Check if user has admin permissions
    if not current_user.has_permission("security_alerts"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view security alerts"
        )

    # This would implement filtering and pagination
    # For now, return empty list
    return []


@router.put("/alerts/{alert_id}", response_model=SecurityAlertResponse)
def update_security_alert(
    alert_id: str,
    alert_update: SecurityAlertUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a security alert (admin only)"""
    # Check if user has admin permissions
    if not current_user.has_permission("security_alerts"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update security alerts"
        )

    # This would implement alert updating
    # For now, raise not implemented
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Alert updating not yet implemented"
    )


# Endpoint for verifying 2FA during login (used by auth service)
@router.post("/2fa/verify-login")
def verify_2fa_login(
    verify_request: TOTPVerifyRequest,
    user_id: str,
    db: Session = Depends(get_db),
    request: Request = None
):
    """Verify 2FA code during login process"""
    security_service = SecurityService(db)

    success = security_service.verify_totp_login(user_id, verify_request.code)

    if not success:
        # Log failed verification with IP address
        security_service.log_audit_event(
            event_type="mfa_login_failure",
            user_id=user_id,
            severity="medium",
            message=f"2FA login verification failed",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/2fa/verify-login",
            http_method="POST"
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code"
        )

    return {"message": "2FA verification successful"}


# SSO Endpoints
@router.get("/sso/providers", response_model=List[SSOConfigurationResponse])
def get_sso_providers(db: Session = Depends(get_db)):
    """Get available SSO providers"""
    sso_service = SSOService(db)
    return sso_service.get_sso_configurations(include_secrets=False)


@router.post("/sso/login", response_model=SSOLoginResponse)
def initiate_sso_login(
    login_request: SSOLoginRequest,
    db: Session = Depends(get_db),
    request: Request = None
):
    """Initiate SSO login process"""
    sso_service = SSOService(db)

    try:
        response = sso_service.initiate_sso_login(
            login_request.provider_id,
            login_request.redirect_url
        )

        # Log SSO login initiation
        sso_service.security_service.log_audit_event(
            event_type="sso_login_initiated",
            severity="low",
            message=f"SSO login initiated for provider {login_request.provider_id}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/sso/login",
            http_method="POST",
            details={"provider_id": login_request.provider_id}
        )

        return response

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/sso/callback")
def process_sso_callback(
    callback_request: SSOCallbackRequest,
    db: Session = Depends(get_db),
    request: Request = None
):
    """Process SSO callback and authenticate user"""
    from app.core.security import create_access_token, create_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES
    from app.schemas.user import UserLoginResponse, UserResponse
    from datetime import timedelta

    sso_service = SSOService(db)

    try:
        user, is_new_user = sso_service.process_sso_callback(
            callback_request.provider_id,
            callback_request.code,
            callback_request.state,
            callback_request.saml_response
        )

        # Create tokens
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role.value},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(data={"sub": user.id})

        # Log successful SSO authentication
        sso_service.security_service.log_audit_event(
            event_type="login_success",
            user_id=user.id,
            severity="low",
            message=f"SSO login successful for {user.email}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/sso/callback",
            http_method="POST",
            details={
                "provider_id": callback_request.provider_id,
                "is_new_user": is_new_user,
                "auth_method": "sso"
            }
        )

        return UserLoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user)
        )

    except ValueError as e:
        # Log failed SSO authentication
        sso_service.security_service.log_audit_event(
            event_type="login_failure",
            severity="medium",
            message=f"SSO login failed: {str(e)}",
            ip_address=get_client_ip(request),
            api_endpoint="/api/v1/security/sso/callback",
            http_method="POST",
            details={
                "provider_id": callback_request.provider_id,
                "error": str(e),
                "auth_method": "sso"
            }
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/sso/accounts/{provider_id}")
def unlink_sso_account(
    provider_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unlink SSO account from current user"""
    sso_service = SSOService(db)

    success = sso_service.unlink_sso_account(current_user.id, provider_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO account not found"
        )

    return {"message": "SSO account unlinked successfully"}