"""
Digital Signature models for CA-DMS
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SQLEnum, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.core.database import Base


class SignatureProviderType(enum.Enum):
    """Types of digital signature providers"""
    DOCUSIGN = "docusign"
    ADOBE_SIGN = "adobe_sign"
    CERTIFICATE_BASED = "certificate_based"
    INTERNAL = "internal"


class SignatureStatus(enum.Enum):
    """Status of a digital signature"""
    PENDING = "pending"
    REQUESTED = "requested"
    SIGNED = "signed"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ERROR = "error"


class ComplianceFramework(enum.Enum):
    """Legal compliance frameworks"""
    ESIGN_ACT = "esign_act"  # US Electronic Signatures in Global and National Commerce Act
    UETA = "ueta"  # Uniform Electronic Transactions Act
    EIDAS = "eidas"  # EU Electronic Identification and Trust Services
    COMMON_LAW = "common_law"
    CUSTOM = "custom"


class DigitalSignatureProvider(Base):
    """Digital signature provider configuration"""
    __tablename__ = "digital_signature_providers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    provider_type = Column(SQLEnum(SignatureProviderType), nullable=False, index=True)

    # Provider configuration
    is_active = Column(Boolean, default=True, index=True)
    api_endpoint = Column(String(500), nullable=True)
    api_key_encrypted = Column(LargeBinary, nullable=True)  # Encrypted API key
    client_id = Column(String(255), nullable=True)

    # Provider-specific settings
    configuration = Column(JSON, nullable=True)  # Provider-specific config
    supported_file_types = Column(JSON, nullable=True)  # ["pdf", "docx", etc.]
    max_file_size_mb = Column(Integer, default=10)

    # Compliance settings
    compliance_frameworks = Column(JSON, nullable=True)  # List of supported frameworks
    certificate_storage_path = Column(String(500), nullable=True)  # For certificate-based

    # Rate limiting
    requests_per_minute = Column(Integer, default=60)
    requests_per_day = Column(Integer, default=1000)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Relationships
    signature_requests = relationship("DigitalSignatureRequest", back_populates="provider")

    def __repr__(self):
        return f"<DigitalSignatureProvider(id={self.id}, name={self.name}, type={self.provider_type.value})>"


class DigitalSignatureRequest(Base):
    """Digital signature request for a document"""
    __tablename__ = "digital_signature_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=True, index=True)
    provider_id = Column(String, ForeignKey("digital_signature_providers.id"), nullable=False, index=True)

    # Request metadata
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=True)
    status = Column(SQLEnum(SignatureStatus), default=SignatureStatus.PENDING, index=True)

    # Provider-specific data
    external_request_id = Column(String(255), nullable=True, index=True)  # Provider's request ID
    external_envelope_id = Column(String(255), nullable=True, index=True)  # Provider's envelope ID
    external_status = Column(String(100), nullable=True)  # Provider's status

    # Request configuration
    require_all_signatures = Column(Boolean, default=True)
    expiration_days = Column(Integer, default=30)
    reminder_frequency_days = Column(Integer, default=3)

    # URLs and callbacks
    callback_url = Column(String(500), nullable=True)
    success_redirect_url = Column(String(500), nullable=True)
    decline_redirect_url = Column(String(500), nullable=True)

    # Compliance
    compliance_framework = Column(SQLEnum(ComplianceFramework), default=ComplianceFramework.ESIGN_ACT)
    legal_notice = Column(Text, nullable=True)
    authentication_required = Column(Boolean, default=True)

    # Timestamps
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)

    # Relationships
    document = relationship("Document")
    workflow_instance = relationship("WorkflowInstance")
    provider = relationship("DigitalSignatureProvider", back_populates="signature_requests")
    signatures = relationship("DigitalSignature", back_populates="request", cascade="all, delete-orphan")
    events = relationship("SignatureEvent", back_populates="request", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DigitalSignatureRequest(id={self.id}, status={self.status.value}, document_id={self.document_id})>"


class DigitalSignature(Base):
    """Individual digital signature within a request"""
    __tablename__ = "digital_signatures"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("digital_signature_requests.id"), nullable=False, index=True)

    # Signer information
    signer_name = Column(String(255), nullable=False)
    signer_email = Column(String(255), nullable=False, index=True)
    signer_role = Column(String(100), nullable=True)
    signing_order = Column(Integer, default=1)  # Order of signing

    # Signature status
    status = Column(SQLEnum(SignatureStatus), default=SignatureStatus.PENDING, index=True)

    # Provider-specific data
    external_signer_id = Column(String(255), nullable=True)
    external_signature_id = Column(String(255), nullable=True)

    # Signature data
    signature_image_url = Column(String(500), nullable=True)
    signature_certificate = Column(LargeBinary, nullable=True)  # Digital certificate
    signature_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Authentication data
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(String(500), nullable=True)
    authentication_method = Column(String(100), nullable=True)  # email, sms, phone, etc.
    geolocation = Column(JSON, nullable=True)  # {"lat": 0, "lng": 0, "country": "US"}

    # Document positioning (for coordinate-based signatures)
    page_number = Column(Integer, nullable=True)
    x_coordinate = Column(Integer, nullable=True)
    y_coordinate = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    # Timestamps
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    declined_at = Column(DateTime(timezone=True), nullable=True)

    # Decline information
    decline_reason = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    request = relationship("DigitalSignatureRequest", back_populates="signatures")
    events = relationship("SignatureEvent", back_populates="signature", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DigitalSignature(id={self.id}, signer_email={self.signer_email}, status={self.status.value})>"


class SignatureEvent(Base):
    """Audit trail for signature events"""
    __tablename__ = "signature_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("digital_signature_requests.id"), nullable=False, index=True)
    signature_id = Column(String, ForeignKey("digital_signatures.id"), nullable=True, index=True)

    # Event details
    event_type = Column(String(100), nullable=False, index=True)  # requested, viewed, signed, declined, etc.
    event_description = Column(Text, nullable=True)

    # Event metadata
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # User who triggered event
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Provider event data
    external_event_id = Column(String(255), nullable=True)
    external_event_data = Column(JSON, nullable=True)

    # Compliance data
    legal_framework_applied = Column(String(100), nullable=True)
    authentication_details = Column(JSON, nullable=True)

    # Timestamp
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    request = relationship("DigitalSignatureRequest", back_populates="events")
    signature = relationship("DigitalSignature", back_populates="events")
    user = relationship("User")

    def __repr__(self):
        return f"<SignatureEvent(id={self.id}, type={self.event_type}, occurred_at={self.occurred_at})>"


class SignatureCertificate(Base):
    """Digital certificates for certificate-based signing"""
    __tablename__ = "signature_certificates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Certificate details
    certificate_name = Column(String(255), nullable=False)
    certificate_data = Column(LargeBinary, nullable=False)  # X.509 certificate
    private_key_encrypted = Column(LargeBinary, nullable=True)  # Encrypted private key

    # Certificate metadata
    issuer = Column(String(500), nullable=True)
    subject = Column(String(500), nullable=True)
    serial_number = Column(String(100), nullable=True)

    # Validity
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_revoked = Column(Boolean, default=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(String(255), nullable=True)

    # Usage
    is_default = Column(Boolean, default=False, index=True)
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self):
        return f"<SignatureCertificate(id={self.id}, name={self.certificate_name}, user_id={self.user_id})>"