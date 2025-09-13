"""
Digital Signature schemas for CA-DMS
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class SignatureProviderType(str, Enum):
    DOCUSIGN = "docusign"
    ADOBE_SIGN = "adobe_sign"
    CERTIFICATE_BASED = "certificate_based"
    INTERNAL = "internal"


class SignatureStatus(str, Enum):
    PENDING = "pending"
    REQUESTED = "requested"
    SIGNED = "signed"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ERROR = "error"


class ComplianceFramework(str, Enum):
    ESIGN_ACT = "esign_act"
    UETA = "ueta"
    EIDAS = "eidas"
    COMMON_LAW = "common_law"
    CUSTOM = "custom"


# Digital Signature Provider Schemas
class DigitalSignatureProviderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider_type: SignatureProviderType
    is_active: bool = True
    api_endpoint: Optional[str] = Field(None, max_length=500)
    client_id: Optional[str] = Field(None, max_length=255)
    configuration: Optional[Dict[str, Any]] = None
    supported_file_types: Optional[List[str]] = None
    max_file_size_mb: int = Field(10, ge=1, le=100)
    compliance_frameworks: Optional[List[ComplianceFramework]] = None
    certificate_storage_path: Optional[str] = Field(None, max_length=500)
    requests_per_minute: int = Field(60, ge=1, le=1000)
    requests_per_day: int = Field(1000, ge=1, le=100000)


class DigitalSignatureProviderCreate(DigitalSignatureProviderBase):
    api_key: Optional[str] = Field(None, min_length=1)  # Will be encrypted on storage


class DigitalSignatureProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    api_endpoint: Optional[str] = Field(None, max_length=500)
    client_id: Optional[str] = Field(None, max_length=255)
    configuration: Optional[Dict[str, Any]] = None
    supported_file_types: Optional[List[str]] = None
    max_file_size_mb: Optional[int] = Field(None, ge=1, le=100)
    compliance_frameworks: Optional[List[ComplianceFramework]] = None
    certificate_storage_path: Optional[str] = Field(None, max_length=500)
    requests_per_minute: Optional[int] = Field(None, ge=1, le=1000)
    requests_per_day: Optional[int] = Field(None, ge=1, le=100000)
    api_key: Optional[str] = Field(None, min_length=1)


class DigitalSignatureProviderResponse(DigitalSignatureProviderBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# Digital Signature Request Schemas
class SignerInfo(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    role: Optional[str] = Field(None, max_length=100)
    signing_order: int = Field(1, ge=1, le=100)


class DigitalSignatureRequestBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    message: Optional[str] = None
    require_all_signatures: bool = True
    expiration_days: int = Field(30, ge=1, le=365)
    reminder_frequency_days: int = Field(3, ge=1, le=30)
    compliance_framework: ComplianceFramework = ComplianceFramework.ESIGN_ACT
    legal_notice: Optional[str] = None
    authentication_required: bool = True


class DigitalSignatureRequestCreate(DigitalSignatureRequestBase):
    document_id: str = Field(..., min_length=1)
    provider_id: str = Field(..., min_length=1)
    workflow_instance_id: Optional[str] = None
    signers: List[SignerInfo] = Field(..., min_items=1, max_items=50)
    success_redirect_url: Optional[str] = Field(None, max_length=500)
    decline_redirect_url: Optional[str] = Field(None, max_length=500)

    @validator('signers')
    def validate_signers(cls, v):
        # Check for duplicate emails
        emails = [signer.email for signer in v]
        if len(emails) != len(set(emails)):
            raise ValueError('Duplicate signer emails are not allowed')

        # Check for duplicate signing orders
        orders = [signer.signing_order for signer in v]
        if len(orders) != len(set(orders)):
            raise ValueError('Duplicate signing orders are not allowed')

        return v


class DigitalSignatureRequestUpdate(BaseModel):
    status: Optional[SignatureStatus] = None
    external_request_id: Optional[str] = Field(None, max_length=255)
    external_envelope_id: Optional[str] = Field(None, max_length=255)
    external_status: Optional[str] = Field(None, max_length=100)
    completed_at: Optional[datetime] = None


class DigitalSignatureRequestResponse(DigitalSignatureRequestBase):
    id: str
    document_id: str
    workflow_instance_id: Optional[str] = None
    provider_id: str
    status: SignatureStatus
    external_request_id: Optional[str] = None
    external_envelope_id: Optional[str] = None
    external_status: Optional[str] = None
    callback_url: Optional[str] = None
    success_redirect_url: Optional[str] = None
    decline_redirect_url: Optional[str] = None
    requested_at: datetime
    expires_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True


# Digital Signature Schemas
class DigitalSignatureBase(BaseModel):
    signer_name: str = Field(..., min_length=1, max_length=255)
    signer_email: EmailStr
    signer_role: Optional[str] = Field(None, max_length=100)
    signing_order: int = Field(1, ge=1, le=100)


class DigitalSignatureCreate(DigitalSignatureBase):
    request_id: str = Field(..., min_length=1)


class DigitalSignatureUpdate(BaseModel):
    status: Optional[SignatureStatus] = None
    external_signer_id: Optional[str] = Field(None, max_length=255)
    external_signature_id: Optional[str] = Field(None, max_length=255)
    signature_image_url: Optional[str] = Field(None, max_length=500)
    signature_timestamp: Optional[datetime] = None
    ip_address: Optional[str] = Field(None, max_length=45)
    user_agent: Optional[str] = Field(None, max_length=500)
    authentication_method: Optional[str] = Field(None, max_length=100)
    geolocation: Optional[Dict[str, Any]] = None
    page_number: Optional[int] = Field(None, ge=1)
    x_coordinate: Optional[int] = Field(None, ge=0)
    y_coordinate: Optional[int] = Field(None, ge=0)
    width: Optional[int] = Field(None, ge=1)
    height: Optional[int] = Field(None, ge=1)
    signed_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    decline_reason: Optional[str] = None


class DigitalSignatureResponse(DigitalSignatureBase):
    id: str
    request_id: str
    status: SignatureStatus
    external_signer_id: Optional[str] = None
    external_signature_id: Optional[str] = None
    signature_image_url: Optional[str] = None
    signature_timestamp: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    authentication_method: Optional[str] = None
    geolocation: Optional[Dict[str, Any]] = None
    page_number: Optional[int] = None
    x_coordinate: Optional[int] = None
    y_coordinate: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    requested_at: datetime
    signed_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    decline_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Signature Event Schemas
class SignatureEventBase(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    event_description: Optional[str] = None
    ip_address: Optional[str] = Field(None, max_length=45)
    user_agent: Optional[str] = Field(None, max_length=500)
    external_event_id: Optional[str] = Field(None, max_length=255)
    external_event_data: Optional[Dict[str, Any]] = None
    legal_framework_applied: Optional[str] = Field(None, max_length=100)
    authentication_details: Optional[Dict[str, Any]] = None


class SignatureEventCreate(SignatureEventBase):
    request_id: str = Field(..., min_length=1)
    signature_id: Optional[str] = None
    user_id: Optional[str] = None


class SignatureEventResponse(SignatureEventBase):
    id: str
    request_id: str
    signature_id: Optional[str] = None
    user_id: Optional[str] = None
    occurred_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# Certificate Schemas
class SignatureCertificateBase(BaseModel):
    certificate_name: str = Field(..., min_length=1, max_length=255)
    issuer: Optional[str] = Field(None, max_length=500)
    subject: Optional[str] = Field(None, max_length=500)
    serial_number: Optional[str] = Field(None, max_length=100)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_default: bool = False


class SignatureCertificateCreate(SignatureCertificateBase):
    certificate_data: bytes = Field(..., description="X.509 certificate in DER format")
    private_key: Optional[bytes] = Field(None, description="Private key in PEM format")


class SignatureCertificateUpdate(BaseModel):
    certificate_name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_default: Optional[bool] = None
    is_revoked: Optional[bool] = None
    revocation_reason: Optional[str] = Field(None, max_length=255)


class SignatureCertificateResponse(SignatureCertificateBase):
    id: str
    user_id: str
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    usage_count: int
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    uploaded_by: Optional[str] = None

    class Config:
        from_attributes = True


# Comprehensive Response Schemas
class SignatureRequestWithSignatures(DigitalSignatureRequestResponse):
    signatures: List[DigitalSignatureResponse] = []
    events: List[SignatureEventResponse] = []
    provider: DigitalSignatureProviderResponse


class SignatureStatistics(BaseModel):
    total_requests: int
    pending_requests: int
    completed_requests: int
    declined_requests: int
    expired_requests: int
    average_completion_time_hours: Optional[float] = None
    completion_rate: float


class SignatureProviderStats(BaseModel):
    provider_id: str
    provider_name: str
    total_requests: int
    success_rate: float
    average_response_time_seconds: Optional[float] = None
    last_used: Optional[datetime] = None


# Webhook and Callback Schemas
class SignatureWebhookPayload(BaseModel):
    event_type: str
    request_id: str
    signature_id: Optional[str] = None
    status: SignatureStatus
    external_data: Optional[Dict[str, Any]] = None
    timestamp: datetime


class SignatureCallbackData(BaseModel):
    success: bool
    request_id: str
    message: Optional[str] = None
    redirect_url: Optional[str] = None