"""
Pydantic schemas for security features (2FA, SSO, audit logging)
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# 2FA Schemas
class TwoFactorMethodEnum(str, Enum):
    TOTP = "totp"
    SMS = "sms"
    EMAIL = "email"
    BACKUP_CODES = "backup_codes"


class TOTPSetupRequest(BaseModel):
    """Request to setup TOTP 2FA"""
    pass


class TOTPSetupResponse(BaseModel):
    """Response with TOTP setup details"""
    secret: str = Field(..., description="Base32 encoded TOTP secret")
    qr_code_url: str = Field(..., description="QR code URL for authenticator apps")
    backup_codes: List[str] = Field(..., description="One-time backup codes")


class TOTPVerifyRequest(BaseModel):
    """Request to verify TOTP code"""
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class SMSSetupRequest(BaseModel):
    """Request to setup SMS 2FA"""
    phone_number: str = Field(..., description="Phone number for SMS 2FA")

    @field_validator('phone_number')
    @classmethod
    def validate_phone_number(cls, v):
        # Basic phone number validation - should be enhanced with proper phone validation
        if not v.startswith('+'):
            raise ValueError('Phone number must include country code (e.g., +1234567890)')
        return v


class SMSVerifyRequest(BaseModel):
    """Request to verify SMS code"""
    code: str = Field(..., min_length=4, max_length=8, description="SMS verification code")


class TwoFactorStatusResponse(BaseModel):
    """Response with user's 2FA status"""
    is_enabled: bool = Field(..., description="Whether 2FA is enabled")
    methods: List[Dict[str, Any]] = Field(..., description="List of configured 2FA methods")
    backup_codes_remaining: int = Field(0, description="Number of unused backup codes")


class TwoFactorDisableRequest(BaseModel):
    """Request to disable 2FA"""
    password: str = Field(..., description="User's current password")
    confirmation: bool = Field(..., description="Confirmation that user wants to disable 2FA")


# SSO Schemas
class SSOProviderEnum(str, Enum):
    SAML = "saml"
    OAUTH2_GOOGLE = "oauth2_google"
    OAUTH2_MICROSOFT = "oauth2_microsoft"
    OAUTH2_GITHUB = "oauth2_github"
    OIDC = "oidc"


class SSOConfigurationCreate(BaseModel):
    """Create SSO configuration"""
    name: str = Field(..., min_length=1, max_length=100)
    provider_type: SSOProviderEnum
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    scopes: Optional[List[str]] = None

    # SAML specific
    saml_metadata_url: Optional[str] = None
    saml_entity_id: Optional[str] = None
    saml_acs_url: Optional[str] = None

    # Settings
    allowed_domains: Optional[List[str]] = None
    auto_create_users: bool = False
    default_role: Optional[str] = None


class SSOConfigurationUpdate(BaseModel):
    """Update SSO configuration"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_enabled: Optional[bool] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    scopes: Optional[List[str]] = None

    # SAML specific
    saml_metadata_url: Optional[str] = None
    saml_entity_id: Optional[str] = None
    saml_acs_url: Optional[str] = None

    # Settings
    allowed_domains: Optional[List[str]] = None
    auto_create_users: Optional[bool] = None
    default_role: Optional[str] = None


class SSOConfigurationResponse(BaseModel):
    """SSO configuration response"""
    id: str
    name: str
    provider_type: SSOProviderEnum
    is_enabled: bool
    auto_create_users: bool
    default_role: Optional[str]
    allowed_domains: Optional[List[str]]
    redirect_uri: Optional[str]
    scopes: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SSOLoginRequest(BaseModel):
    """SSO login initiation request"""
    provider_id: str = Field(..., description="SSO provider configuration ID")
    redirect_url: Optional[str] = Field(None, description="URL to redirect after successful login")


class SSOLoginResponse(BaseModel):
    """SSO login response"""
    authorization_url: str = Field(..., description="URL to redirect user for SSO login")
    state: str = Field(..., description="State parameter for CSRF protection")


class SSOCallbackRequest(BaseModel):
    """SSO callback processing request"""
    provider_id: str = Field(..., description="SSO provider configuration ID")
    code: Optional[str] = None  # OAuth2 authorization code
    state: Optional[str] = None  # CSRF state
    saml_response: Optional[str] = None  # SAML response


# Audit Logging Schemas
class AuditEventTypeEnum(str, Enum):
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    MFA_SUCCESS = "mfa_success"
    MFA_FAILURE = "mfa_failure"
    SSO_LOGIN = "sso_login"
    SSO_ACCOUNT_LINKED = "sso_account_linked"
    SSO_ACCOUNT_UNLINKED = "sso_account_unlinked"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_ACTIVATED = "user_activated"
    USER_DEACTIVATED = "user_deactivated"
    ROLE_CHANGED = "role_changed"
    DOCUMENT_CREATED = "document_created"
    DOCUMENT_VIEWED = "document_viewed"
    DOCUMENT_UPDATED = "document_updated"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_SHARED = "document_shared"
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_APPROVED = "workflow_approved"
    WORKFLOW_REJECTED = "workflow_rejected"
    WORKFLOW_COMPLETED = "workflow_completed"
    SYSTEM_CONFIG_CHANGED = "system_config_changed"
    BACKUP_CREATED = "backup_created"
    BACKUP_RESTORED = "backup_restored"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    PERMISSION_DENIED = "permission_denied"


class AuditSeverityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditLogCreate(BaseModel):
    """Create audit log entry"""
    event_type: AuditEventTypeEnum
    severity: AuditSeverityEnum = AuditSeverityEnum.LOW
    message: str

    # Target information
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None

    # Technical details
    api_endpoint: Optional[str] = None
    http_method: Optional[str] = None
    http_status: Optional[int] = None

    # Additional context
    details: Optional[Dict[str, Any]] = None
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    correlation_id: Optional[str] = None
    tags: Optional[List[str]] = None


class AuditLogResponse(BaseModel):
    """Audit log entry response"""
    id: str
    event_type: AuditEventTypeEnum
    severity: AuditSeverityEnum
    message: str

    # Actor information
    user_id: Optional[str]
    user_email: Optional[str]
    user_role: Optional[str]

    # Target information
    resource_type: Optional[str]
    resource_id: Optional[str]
    resource_name: Optional[str]

    # Technical details
    ip_address: Optional[str]
    user_agent: Optional[str]
    api_endpoint: Optional[str]
    http_method: Optional[str]
    http_status: Optional[int]

    # Additional context
    details: Optional[Dict[str, Any]]
    tags: Optional[List[str]]

    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogFilter(BaseModel):
    """Audit log filtering parameters"""
    event_types: Optional[List[AuditEventTypeEnum]] = None
    severities: Optional[List[AuditSeverityEnum]] = None
    user_ids: Optional[List[str]] = None
    resource_types: Optional[List[str]] = None
    ip_addresses: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    search: Optional[str] = None  # Full-text search in message and details


class ComplianceReportRequest(BaseModel):
    """Request for compliance report generation"""
    report_type: str = Field(..., description="Type of compliance report")
    start_date: datetime = Field(..., description="Report start date")
    end_date: datetime = Field(..., description="Report end date")
    filters: Optional[AuditLogFilter] = None
    format: str = Field("pdf", description="Report format (pdf, csv, json)")


class ComplianceReportResponse(BaseModel):
    """Compliance report response"""
    report_id: str = Field(..., description="Unique report identifier")
    report_type: str = Field(..., description="Type of report generated")
    status: str = Field(..., description="Report generation status")
    download_url: Optional[str] = Field(None, description="URL to download completed report")
    created_at: datetime = Field(..., description="Report creation timestamp")
    expires_at: Optional[datetime] = Field(None, description="Report expiration timestamp")


# Security Alert Schemas
class SecurityAlertCreate(BaseModel):
    """Create security alert"""
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    severity: AuditSeverityEnum
    alert_type: str = Field(..., description="Type of security alert")
    category: str = Field(..., description="Alert category")

    # Target information
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None

    # Context
    context: Optional[Dict[str, Any]] = None
    related_audit_logs: Optional[List[str]] = None


class SecurityAlertUpdate(BaseModel):
    """Update security alert"""
    status: Optional[str] = Field(None, description="Alert status (open, investigating, resolved, false_positive)")
    assigned_to: Optional[str] = Field(None, description="User ID of assigned investigator")
    resolution_notes: Optional[str] = None


class SecurityAlertResponse(BaseModel):
    """Security alert response"""
    id: str
    title: str
    description: str
    severity: AuditSeverityEnum
    alert_type: str
    category: str
    status: str

    # Target information
    user_id: Optional[str]
    ip_address: Optional[str]
    resource_type: Optional[str]
    resource_id: Optional[str]

    # Assignment and resolution
    assigned_to: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]

    # Context
    context: Optional[Dict[str, Any]]
    related_audit_logs: Optional[List[str]]

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}