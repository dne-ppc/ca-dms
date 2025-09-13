"""
Pydantic schemas for compliance features
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class ConsentTypeEnum(str, Enum):
    DATA_PROCESSING = "data_processing"
    MARKETING = "marketing"
    ANALYTICS = "analytics"
    THIRD_PARTY_SHARING = "third_party_sharing"
    COOKIES = "cookies"
    NOTIFICATIONS = "notifications"


class ConsentStatusEnum(str, Enum):
    GRANTED = "granted"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    PENDING = "pending"


class ConsentMethodEnum(str, Enum):
    EXPLICIT_FORM = "explicit_form"
    CHECKBOX = "checkbox"
    EMAIL_CONFIRMATION = "email_confirmation"
    VERBAL = "verbal"
    IMPLIED = "implied"
    UPDATED_TERMS = "updated_terms"


# Base schemas
class UserConsentBase(BaseModel):
    consent_type: ConsentTypeEnum
    status: ConsentStatusEnum
    method: ConsentMethodEnum
    purpose: str = Field(..., max_length=500)
    data_categories: Optional[List[str]] = None
    processing_activities: Optional[List[str]] = None
    legal_basis: Optional[str] = Field(None, max_length=100)
    lawful_basis_explanation: Optional[str] = None
    expires_at: Optional[datetime] = None
    consent_version: str = Field(..., max_length=20)
    metadata: Optional[Dict[str, Any]] = None


class UserConsentCreate(UserConsentBase):
    pass


class UserConsentUpdate(BaseModel):
    status: Optional[ConsentStatusEnum] = None
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class UserConsent(UserConsentBase):
    id: str
    user_id: str
    granted_at: Optional[datetime] = None
    withdrawn_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Data Retention Policy schemas
class DataRetentionPolicyBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    data_category: str = Field(..., max_length=100)
    resource_type: str = Field(..., max_length=100)
    retention_period_days: int = Field(..., gt=0)
    grace_period_days: int = Field(30, ge=0)
    conditions: Optional[Dict[str, Any]] = None
    legal_basis: Optional[str] = Field(None, max_length=255)
    jurisdiction: Optional[str] = Field(None, max_length=100)
    auto_delete_enabled: bool = False
    notification_before_days: int = Field(30, ge=0)
    effective_from: datetime
    effective_until: Optional[datetime] = None


class DataRetentionPolicyCreate(DataRetentionPolicyBase):
    pass


class DataRetentionPolicyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    retention_period_days: Optional[int] = Field(None, gt=0)
    grace_period_days: Optional[int] = Field(None, ge=0)
    conditions: Optional[Dict[str, Any]] = None
    legal_basis: Optional[str] = Field(None, max_length=255)
    jurisdiction: Optional[str] = Field(None, max_length=100)
    auto_delete_enabled: Optional[bool] = None
    notification_before_days: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    effective_until: Optional[datetime] = None


class DataRetentionPolicy(DataRetentionPolicyBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Data Deletion Request schemas
class DataDeletionRequestBase(BaseModel):
    email: str = Field(..., max_length=255)
    data_categories: List[str]
    reason: Optional[str] = Field(None, max_length=500)


class DataDeletionRequestCreate(DataDeletionRequestBase):
    request_type: str = Field("user_requested", max_length=50)


class DataDeletionRequestUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    verified_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    deleted_data_summary: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    legal_basis: Optional[str] = Field(None, max_length=255)
    retention_override: Optional[bool] = None
    override_reason: Optional[str] = None


class DataDeletionRequest(DataDeletionRequestBase):
    id: str
    user_id: Optional[str] = None
    request_type: str
    verification_token: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    status: str
    processed_by: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    deleted_data_summary: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    legal_basis: Optional[str] = None
    retention_override: bool
    override_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Privacy Impact Assessment schemas
class PrivacyImpactAssessmentBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    processing_purpose: str
    data_categories: List[str]
    data_subjects: List[str]
    necessity_justification: str
    proportionality_assessment: str
    data_sources: Optional[List[str]] = None
    data_recipients: Optional[List[str]] = None
    third_country_transfers: Optional[List[Dict[str, Any]]] = None
    individual_rights_impact: Optional[str] = None
    safeguards_implemented: Optional[List[str]] = None
    identified_risks: List[Dict[str, Any]]
    risk_likelihood: str = Field(..., regex="^(low|medium|high)$")
    risk_impact: str = Field(..., regex="^(low|medium|high)$")
    overall_risk_level: str = Field(..., regex="^(low|medium|high)$")
    mitigation_measures: List[Dict[str, Any]]
    residual_risk_level: str = Field(..., regex="^(low|medium|high)$")
    dpo_consulted: bool = False
    dpo_consultation_date: Optional[datetime] = None
    dpo_opinion: Optional[str] = None
    data_subjects_consulted: bool = False
    consultation_summary: Optional[str] = None
    review_date: datetime
    next_review_due: datetime
    monitoring_plan: Optional[Dict[str, Any]] = None


class PrivacyImpactAssessmentCreate(PrivacyImpactAssessmentBase):
    pass


class PrivacyImpactAssessmentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    processing_purpose: Optional[str] = None
    data_categories: Optional[List[str]] = None
    data_subjects: Optional[List[str]] = None
    necessity_justification: Optional[str] = None
    proportionality_assessment: Optional[str] = None
    data_sources: Optional[List[str]] = None
    data_recipients: Optional[List[str]] = None
    third_country_transfers: Optional[List[Dict[str, Any]]] = None
    individual_rights_impact: Optional[str] = None
    safeguards_implemented: Optional[List[str]] = None
    identified_risks: Optional[List[Dict[str, Any]]] = None
    risk_likelihood: Optional[str] = Field(None, regex="^(low|medium|high)$")
    risk_impact: Optional[str] = Field(None, regex="^(low|medium|high)$")
    overall_risk_level: Optional[str] = Field(None, regex="^(low|medium|high)$")
    mitigation_measures: Optional[List[Dict[str, Any]]] = None
    residual_risk_level: Optional[str] = Field(None, regex="^(low|medium|high)$")
    dpo_consulted: Optional[bool] = None
    dpo_consultation_date: Optional[datetime] = None
    dpo_opinion: Optional[str] = None
    data_subjects_consulted: Optional[bool] = None
    consultation_summary: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    approved_at: Optional[datetime] = None
    review_date: Optional[datetime] = None
    last_reviewed: Optional[datetime] = None
    next_review_due: Optional[datetime] = None
    monitoring_plan: Optional[Dict[str, Any]] = None
    effectiveness_review: Optional[str] = None


class PrivacyImpactAssessment(PrivacyImpactAssessmentBase):
    id: str
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    last_reviewed: Optional[datetime] = None
    effectiveness_review: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# Compliance Report schemas
class ComplianceReportBase(BaseModel):
    title: str = Field(..., max_length=255)
    report_type: str = Field(..., max_length=100)
    reporting_period_start: datetime
    reporting_period_end: datetime
    scope: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    findings: Dict[str, Any]
    recommendations: Optional[List[str]] = None
    distribution_list: Optional[List[str]] = None


class ComplianceReportCreate(ComplianceReportBase):
    pass


class ComplianceReportUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None
    status: Optional[str] = Field(None, max_length=50)
    reviewed_by: Optional[str] = None
    distribution_list: Optional[List[str]] = None
    published_at: Optional[datetime] = None


class ComplianceReport(ComplianceReportBase):
    id: str
    status: str
    generated_by: str
    reviewed_by: Optional[str] = None
    report_file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Data Processing Activity schemas
class DataProcessingActivityBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: str
    controller_name: str = Field(..., max_length=255)
    controller_contact: Dict[str, Any]
    joint_controllers: Optional[List[Dict[str, Any]]] = None
    dpo_contact: Optional[Dict[str, Any]] = None
    purposes: List[str]
    legal_basis: List[str]
    data_categories: List[str]
    data_subjects: List[str]
    recipients: Optional[List[str]] = None
    third_country_transfers: Optional[List[Dict[str, Any]]] = None
    transfer_safeguards: Optional[List[str]] = None
    retention_schedule: Dict[str, Any]
    security_measures: List[str]
    data_sources: List[str]
    accuracy_measures: Optional[List[str]] = None
    next_review_due: datetime


class DataProcessingActivityCreate(DataProcessingActivityBase):
    pass


class DataProcessingActivityUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    controller_name: Optional[str] = Field(None, max_length=255)
    controller_contact: Optional[Dict[str, Any]] = None
    joint_controllers: Optional[List[Dict[str, Any]]] = None
    dpo_contact: Optional[Dict[str, Any]] = None
    purposes: Optional[List[str]] = None
    legal_basis: Optional[List[str]] = None
    data_categories: Optional[List[str]] = None
    data_subjects: Optional[List[str]] = None
    recipients: Optional[List[str]] = None
    third_country_transfers: Optional[List[Dict[str, Any]]] = None
    transfer_safeguards: Optional[List[str]] = None
    retention_schedule: Optional[Dict[str, Any]] = None
    security_measures: Optional[List[str]] = None
    data_sources: Optional[List[str]] = None
    accuracy_measures: Optional[List[str]] = None
    status: Optional[str] = Field(None, max_length=50)
    last_reviewed: Optional[datetime] = None
    next_review_due: Optional[datetime] = None


class DataProcessingActivity(DataProcessingActivityBase):
    id: str
    status: str
    last_reviewed: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# Data export schemas for GDPR compliance
class UserDataExportRequest(BaseModel):
    user_id: str
    data_categories: Optional[List[str]] = None  # If None, export all data
    format: str = Field("json", regex="^(json|csv|xml)$")
    include_metadata: bool = True
    anonymize_sensitive: bool = False


class UserDataExport(BaseModel):
    user_id: str
    export_id: str
    format: str
    file_path: str
    file_size: int
    data_categories: List[str]
    export_summary: Dict[str, Any]
    created_at: datetime
    expires_at: datetime
    download_count: int = 0
    last_downloaded: Optional[datetime] = None


# Consent management batch operations
class ConsentBatchOperation(BaseModel):
    operation: str = Field(..., regex="^(grant|deny|withdraw|update)$")
    consent_types: List[ConsentTypeEnum]
    user_ids: Optional[List[str]] = None  # If None, applies to all users
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ConsentBatchResult(BaseModel):
    operation: str
    processed_count: int
    success_count: int
    error_count: int
    errors: List[Dict[str, Any]]
    started_at: datetime
    completed_at: datetime


# Compliance metrics and statistics
class ComplianceMetrics(BaseModel):
    consent_statistics: Dict[str, Any]
    retention_compliance: Dict[str, Any]
    pia_status: Dict[str, Any]
    deletion_requests: Dict[str, Any]
    data_exports: Dict[str, Any]
    audit_summary: Dict[str, Any]
    generated_at: datetime


# Compliance dashboard summary
class ComplianceDashboard(BaseModel):
    metrics: ComplianceMetrics
    pending_tasks: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]
    compliance_score: float = Field(..., ge=0, le=100)
    recommendations: List[str]
    alerts: List[Dict[str, Any]]