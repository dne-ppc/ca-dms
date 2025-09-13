"""
Compliance models for GDPR/CCPA and privacy management
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, JSON, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.core.database import Base


class ConsentType(enum.Enum):
    """Types of user consent"""
    DATA_PROCESSING = "data_processing"  # Basic data processing consent
    MARKETING = "marketing"  # Marketing communications
    ANALYTICS = "analytics"  # Usage analytics and tracking
    THIRD_PARTY_SHARING = "third_party_sharing"  # Sharing data with third parties
    COOKIES = "cookies"  # Cookie usage consent
    NOTIFICATIONS = "notifications"  # Email/SMS notifications


class ConsentStatus(enum.Enum):
    """Consent status options"""
    GRANTED = "granted"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    PENDING = "pending"


class ConsentMethod(enum.Enum):
    """How consent was obtained"""
    EXPLICIT_FORM = "explicit_form"  # User explicitly filled out consent form
    CHECKBOX = "checkbox"  # Checkbox during registration
    EMAIL_CONFIRMATION = "email_confirmation"  # Email confirmation link
    VERBAL = "verbal"  # Phone or in-person consent
    IMPLIED = "implied"  # Implied consent from actions
    UPDATED_TERMS = "updated_terms"  # Updated terms acceptance


class UserConsent(Base):
    """Track user consent for various data processing activities"""
    __tablename__ = "user_consents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Consent details
    consent_type = Column(SQLEnum(ConsentType), nullable=False)
    status = Column(SQLEnum(ConsentStatus), nullable=False)
    method = Column(SQLEnum(ConsentMethod), nullable=False)

    # Purpose and scope
    purpose = Column(String(500), nullable=False)  # Why data is being processed
    data_categories = Column(JSON, nullable=True)  # What data categories are covered
    processing_activities = Column(JSON, nullable=True)  # Specific processing activities

    # Legal basis (GDPR Article 6)
    legal_basis = Column(String(100), nullable=True)  # e.g., "consent", "contract", "legitimate_interest"
    lawful_basis_explanation = Column(Text, nullable=True)

    # Timing and validity
    granted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)

    # Context
    consent_version = Column(String(20), nullable=False)  # Version of privacy policy/terms
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    # Additional metadata
    consent_metadata = Column(JSON, nullable=True)  # Additional context data

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<UserConsent(id={self.id}, user_id={self.user_id}, type={self.consent_type.value}, status={self.status.value})>"


class DataRetentionPolicy(Base):
    """Data retention policies for different types of data"""
    __tablename__ = "data_retention_policies"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Policy identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Scope
    data_category = Column(String(100), nullable=False)  # e.g., "documents", "audit_logs", "user_data"
    resource_type = Column(String(100), nullable=False)  # Database table or resource type

    # Retention rules
    retention_period_days = Column(Integer, nullable=False)  # How long to keep data
    grace_period_days = Column(Integer, default=30, nullable=False)  # Additional grace period before deletion

    # Conditions for retention
    conditions = Column(JSON, nullable=True)  # Additional conditions for applying this policy

    # Legal requirements
    legal_basis = Column(String(255), nullable=True)  # Legal reason for retention period
    jurisdiction = Column(String(100), nullable=True)  # Legal jurisdiction (e.g., "EU", "US", "CA")

    # Automation settings
    auto_delete_enabled = Column(Boolean, default=False, nullable=False)
    notification_before_days = Column(Integer, default=30, nullable=False)  # Notify before deletion

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=False)
    effective_until = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<DataRetentionPolicy(id={self.id}, name={self.name}, category={self.data_category})>"


class DataDeletionRequest(Base):
    """Track data deletion requests (Right to be Forgotten)"""
    __tablename__ = "data_deletion_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Request details
    request_type = Column(String(50), nullable=False)  # "user_requested", "retention_policy", "manual"
    email = Column(String(255), nullable=False)  # Email for verification

    # Scope of deletion
    data_categories = Column(JSON, nullable=False)  # What data to delete
    reason = Column(String(500), nullable=True)  # Reason for deletion

    # Verification
    verification_token = Column(String(255), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Processing
    status = Column(String(50), default="pending", nullable=False)  # pending, verified, processing, completed, failed
    processed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)

    # Results
    deleted_data_summary = Column(JSON, nullable=True)  # Summary of what was deleted
    errors = Column(JSON, nullable=True)  # Any errors encountered

    # Legal and compliance
    legal_basis = Column(String(255), nullable=True)  # Legal basis for deletion
    retention_override = Column(Boolean, default=False, nullable=False)  # Override retention policies
    override_reason = Column(Text, nullable=True)  # Reason for override

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    verified_user = relationship("User", foreign_keys=[verified_by])
    processed_user = relationship("User", foreign_keys=[processed_by])

    def __repr__(self):
        return f"<DataDeletionRequest(id={self.id}, email={self.email}, status={self.status})>"


class PrivacyImpactAssessment(Base):
    """Privacy Impact Assessments (PIAs) for high-risk processing"""
    __tablename__ = "privacy_impact_assessments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Assessment identification
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    # Scope and context
    processing_purpose = Column(Text, nullable=False)
    data_categories = Column(JSON, nullable=False)  # Categories of personal data
    data_subjects = Column(JSON, nullable=False)  # Categories of data subjects

    # Risk assessment
    necessity_justification = Column(Text, nullable=False)  # Why processing is necessary
    proportionality_assessment = Column(Text, nullable=False)  # Why processing is proportionate

    # Data flow
    data_sources = Column(JSON, nullable=True)  # Where data comes from
    data_recipients = Column(JSON, nullable=True)  # Who receives data
    third_country_transfers = Column(JSON, nullable=True)  # International transfers

    # Rights and safeguards
    individual_rights_impact = Column(Text, nullable=True)
    safeguards_implemented = Column(JSON, nullable=True)

    # Risk analysis
    identified_risks = Column(JSON, nullable=False)  # List of identified risks
    risk_likelihood = Column(String(20), nullable=False)  # low, medium, high
    risk_impact = Column(String(20), nullable=False)  # low, medium, high
    overall_risk_level = Column(String(20), nullable=False)  # low, medium, high

    # Mitigation measures
    mitigation_measures = Column(JSON, nullable=False)
    residual_risk_level = Column(String(20), nullable=False)

    # Consultation
    dpo_consulted = Column(Boolean, default=False, nullable=False)
    dpo_consultation_date = Column(DateTime(timezone=True), nullable=True)
    dpo_opinion = Column(Text, nullable=True)

    data_subjects_consulted = Column(Boolean, default=False, nullable=False)
    consultation_summary = Column(Text, nullable=True)

    # Approval and review
    status = Column(String(50), default="draft", nullable=False)  # draft, review, approved, rejected
    approved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Review schedule
    review_date = Column(DateTime(timezone=True), nullable=False)
    last_reviewed = Column(DateTime(timezone=True), nullable=True)
    next_review_due = Column(DateTime(timezone=True), nullable=False)

    # Monitoring
    monitoring_plan = Column(JSON, nullable=True)
    effectiveness_review = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    approver = relationship("User", foreign_keys=[approved_by])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<PrivacyImpactAssessment(id={self.id}, title={self.title}, status={self.status})>"


class ComplianceReport(Base):
    """Generated compliance reports"""
    __tablename__ = "compliance_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Report identification
    title = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)  # "gdpr_audit", "retention_review", "consent_status"

    # Scope and period
    reporting_period_start = Column(DateTime(timezone=True), nullable=False)
    reporting_period_end = Column(DateTime(timezone=True), nullable=False)
    scope = Column(JSON, nullable=True)  # What's included in the report

    # Report content
    summary = Column(Text, nullable=True)
    findings = Column(JSON, nullable=False)  # Key findings and metrics
    recommendations = Column(JSON, nullable=True)  # Recommendations for improvement

    # Status and approval
    status = Column(String(50), default="draft", nullable=False)  # draft, review, final, published
    generated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    reviewed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Files and attachments
    report_file_path = Column(String(500), nullable=True)  # Path to generated report file
    file_size = Column(Integer, nullable=True)
    file_hash = Column(String(128), nullable=True)  # For integrity verification

    # Distribution
    distribution_list = Column(JSON, nullable=True)  # Who should receive this report
    published_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    generator = relationship("User", foreign_keys=[generated_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return f"<ComplianceReport(id={self.id}, title={self.title}, type={self.report_type})>"


class DataProcessingActivity(Base):
    """Register of Processing Activities (GDPR Article 30)"""
    __tablename__ = "data_processing_activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Activity identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    # Controller/Processor details
    controller_name = Column(String(255), nullable=False)
    controller_contact = Column(JSON, nullable=False)  # Contact details
    joint_controllers = Column(JSON, nullable=True)  # If joint processing

    # Data Protection Officer
    dpo_contact = Column(JSON, nullable=True)

    # Processing details
    purposes = Column(JSON, nullable=False)  # Purposes of processing
    legal_basis = Column(JSON, nullable=False)  # Legal basis for each purpose
    data_categories = Column(JSON, nullable=False)  # Categories of personal data
    data_subjects = Column(JSON, nullable=False)  # Categories of data subjects

    # Recipients and transfers
    recipients = Column(JSON, nullable=True)  # Categories of recipients
    third_country_transfers = Column(JSON, nullable=True)  # International transfers
    transfer_safeguards = Column(JSON, nullable=True)  # Safeguards for transfers

    # Retention
    retention_schedule = Column(JSON, nullable=False)  # Retention periods by data category

    # Security measures
    security_measures = Column(JSON, nullable=False)  # Technical and organizational measures

    # Source and accuracy
    data_sources = Column(JSON, nullable=False)  # Where data comes from
    accuracy_measures = Column(JSON, nullable=True)  # How accuracy is ensured

    # Status and review
    status = Column(String(50), default="active", nullable=False)  # active, inactive, under_review
    last_reviewed = Column(DateTime(timezone=True), nullable=True)
    next_review_due = Column(DateTime(timezone=True), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<DataProcessingActivity(id={self.id}, name={self.name}, status={self.status})>"