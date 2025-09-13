"""
Security models for 2FA, MFA, SSO, and audit logging
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, JSON, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.core.database import Base


class TwoFactorMethod(enum.Enum):
    """Two-factor authentication methods"""
    TOTP = "totp"  # Time-based One-Time Password (Google Authenticator, etc.)
    SMS = "sms"    # SMS verification
    EMAIL = "email"  # Email verification
    BACKUP_CODES = "backup_codes"  # Backup recovery codes


class UserTwoFactor(Base):
    """Two-factor authentication settings for users"""
    __tablename__ = "user_two_factor"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # 2FA method configuration
    method = Column(SQLEnum(TwoFactorMethod), nullable=False)
    is_enabled = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # TOTP specific fields
    totp_secret = Column(String(255), nullable=True)  # Encrypted TOTP secret
    totp_backup_codes = Column(JSON, nullable=True)   # Encrypted backup codes

    # SMS/Email specific fields
    phone_number = Column(String(50), nullable=True)  # For SMS 2FA
    email_address = Column(String(255), nullable=True)  # For email 2FA (if different from login email)

    # Recovery and usage tracking
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    failed_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="two_factor_settings")

    def __repr__(self):
        return f"<UserTwoFactor(id={self.id}, user_id={self.user_id}, method={self.method.value})>"


class SSOProvider(enum.Enum):
    """Single Sign-On provider types"""
    SAML = "saml"
    OAUTH2_GOOGLE = "oauth2_google"
    OAUTH2_MICROSOFT = "oauth2_microsoft"
    OAUTH2_GITHUB = "oauth2_github"
    OIDC = "oidc"  # OpenID Connect


class SSOConfiguration(Base):
    """SSO provider configuration"""
    __tablename__ = "sso_configurations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)  # Display name
    provider_type = Column(SQLEnum(SSOProvider), nullable=False)

    # Provider configuration
    client_id = Column(String(255), nullable=True)
    client_secret = Column(Text, nullable=True)  # Encrypted
    redirect_uri = Column(String(500), nullable=True)
    scopes = Column(JSON, nullable=True)  # List of OAuth scopes

    # SAML specific configuration
    saml_metadata_url = Column(String(500), nullable=True)
    saml_entity_id = Column(String(255), nullable=True)
    saml_acs_url = Column(String(500), nullable=True)  # Assertion Consumer Service URL

    # Domain restrictions
    allowed_domains = Column(JSON, nullable=True)  # List of allowed email domains

    # Status and settings
    is_enabled = Column(Boolean, default=False, nullable=False)
    auto_create_users = Column(Boolean, default=False, nullable=False)
    default_role = Column(String(50), nullable=True)  # Default role for auto-created users

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<SSOConfiguration(id={self.id}, name={self.name}, provider={self.provider_type.value})>"


class UserSSOAccount(Base):
    """Link between users and their SSO accounts"""
    __tablename__ = "user_sso_accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sso_config_id = Column(String, ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)

    # SSO account details
    sso_user_id = Column(String(255), nullable=False)  # User ID from SSO provider
    sso_username = Column(String(255), nullable=True)
    sso_email = Column(String(255), nullable=True)
    sso_display_name = Column(String(255), nullable=True)

    # Additional profile data from SSO
    profile_data = Column(JSON, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="sso_accounts")
    sso_config = relationship("SSOConfiguration")

    def __repr__(self):
        return f"<UserSSOAccount(id={self.id}, user_id={self.user_id}, sso_user_id={self.sso_user_id})>"


class AuditEventType(enum.Enum):
    """Types of audit events"""
    # Authentication events
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"

    # 2FA events
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    MFA_SUCCESS = "mfa_success"
    MFA_FAILURE = "mfa_failure"

    # SSO events
    SSO_LOGIN = "sso_login"
    SSO_ACCOUNT_LINKED = "sso_account_linked"
    SSO_ACCOUNT_UNLINKED = "sso_account_unlinked"

    # User management events
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_ACTIVATED = "user_activated"
    USER_DEACTIVATED = "user_deactivated"
    ROLE_CHANGED = "role_changed"

    # Document events
    DOCUMENT_CREATED = "document_created"
    DOCUMENT_VIEWED = "document_viewed"
    DOCUMENT_UPDATED = "document_updated"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_SHARED = "document_shared"

    # Workflow events
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_APPROVED = "workflow_approved"
    WORKFLOW_REJECTED = "workflow_rejected"
    WORKFLOW_COMPLETED = "workflow_completed"

    # System events
    SYSTEM_CONFIG_CHANGED = "system_config_changed"
    BACKUP_CREATED = "backup_created"
    BACKUP_RESTORED = "backup_restored"

    # Security events
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    PERMISSION_DENIED = "permission_denied"


class AuditSeverity(enum.Enum):
    """Audit event severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditLog(Base):
    """Comprehensive audit logging for compliance and security"""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Event details
    event_type = Column(SQLEnum(AuditEventType), nullable=False, index=True)
    severity = Column(SQLEnum(AuditSeverity), nullable=False, default=AuditSeverity.LOW)
    message = Column(Text, nullable=False)

    # Actor information (who performed the action)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)  # Store email even if user is deleted
    user_role = Column(String(50), nullable=True)
    session_id = Column(String(255), nullable=True)

    # Target information (what was acted upon)
    resource_type = Column(String(100), nullable=True)  # e.g., "document", "user", "workflow"
    resource_id = Column(String, nullable=True)
    resource_name = Column(String(255), nullable=True)

    # Technical details
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    api_endpoint = Column(String(255), nullable=True)
    http_method = Column(String(10), nullable=True)
    http_status = Column(Integer, nullable=True)

    # Additional context
    details = Column(JSON, nullable=True)  # Additional structured data
    before_state = Column(JSON, nullable=True)  # State before change
    after_state = Column(JSON, nullable=True)  # State after change

    # Metadata
    correlation_id = Column(String(255), nullable=True)  # For tracking related events
    tags = Column(JSON, nullable=True)  # For categorization and filtering

    # Compliance fields
    retention_until = Column(DateTime(timezone=True), nullable=True)  # When this log can be deleted
    is_sensitive = Column(Boolean, default=False, nullable=False)  # Contains PII or sensitive data

    # Timestamp (immutable)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<AuditLog(id={self.id}, event_type={self.event_type.value}, user_id={self.user_id})>"


class SecurityAlert(Base):
    """Security alerts and incidents"""
    __tablename__ = "security_alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Alert details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(SQLEnum(AuditSeverity), nullable=False)

    # Classification
    alert_type = Column(String(100), nullable=False)  # e.g., "failed_login_attempts", "suspicious_ip"
    category = Column(String(50), nullable=False)  # e.g., "authentication", "authorization", "data_access"

    # Target information
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String, nullable=True)

    # Status
    status = Column(String(20), nullable=False, default="open")  # open, investigating, resolved, false_positive
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Context
    context = Column(JSON, nullable=True)  # Additional alert context
    related_audit_logs = Column(JSON, nullable=True)  # IDs of related audit log entries

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assigned_user = relationship("User", foreign_keys=[assigned_to])
    resolved_user = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self):
        return f"<SecurityAlert(id={self.id}, title={self.title}, severity={self.severity.value})>"