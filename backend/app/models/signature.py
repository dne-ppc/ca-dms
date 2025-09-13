"""
Signature models for TDD Cycle 1 - Digital Signature Integration
Following the test specifications exactly for proper TDD methodology.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.core.database import Base


# Enums as defined in the test specifications
class SignatureStatus(enum.Enum):
    """Status of a signature request"""
    DRAFT = "draft"
    SENT = "sent"
    PENDING = "pending"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class ParticipantRole(enum.Enum):
    """Role of a signature participant"""
    SIGNER = "signer"
    APPROVER = "approver"
    WITNESS = "witness"
    CC = "cc"


class ParticipantStatus(enum.Enum):
    """Status of a signature participant"""
    PENDING = "pending"
    SIGNED = "signed"
    DECLINED = "declined"
    VIEWED = "viewed"


class FieldType(enum.Enum):
    """Type of signature field"""
    SIGNATURE = "signature"
    DATE = "date"
    TEXT = "text"
    CHECKBOX = "checkbox"
    INITIAL = "initial"
    EMAIL = "email"


class AuditEventType(enum.Enum):
    """Type of audit event"""
    REQUEST_CREATED = "request_created"
    REQUEST_SENT = "request_sent"
    DOCUMENT_SIGNED = "document_signed"
    REQUEST_COMPLETED = "request_completed"
    REQUEST_DECLINED = "request_declined"
    REQUEST_CANCELLED = "request_cancelled"
    REMINDER_SENT = "reminder_sent"
    DEADLINE_UPDATED = "deadline_updated"


class SignatureProvider(Base):
    """Signature provider configuration"""
    __tablename__ = "signature_providers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    config = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True, index=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<SignatureProvider(id={self.id}, name={self.name}, enabled={self.enabled})>"


class SignatureRequest(Base):
    """Signature request for a document"""
    __tablename__ = "signature_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    provider = Column(String(255), nullable=False, index=True)
    status = Column(SQLEnum(SignatureStatus), nullable=False, default=SignatureStatus.DRAFT, index=True)
    envelope_id = Column(String(255), nullable=True, index=True)
    created_by = Column(String, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    document = relationship("Document", back_populates="signature_requests")
    participants = relationship("SignatureParticipant", back_populates="request", cascade="all, delete-orphan")
    fields = relationship("SignatureField", back_populates="request", cascade="all, delete-orphan")
    audit_logs = relationship("SignatureAuditLog", back_populates="request", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SignatureRequest(id={self.id}, status={self.status.value}, provider={self.provider})>"


class SignatureParticipant(Base):
    """Participant in a signature request"""
    __tablename__ = "signature_participants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("signature_requests.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(SQLEnum(ParticipantRole), nullable=False, index=True)
    signing_order = Column(Integer, nullable=False, default=1)
    status = Column(SQLEnum(ParticipantStatus), nullable=False, default=ParticipantStatus.PENDING, index=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    decline_reason = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    request = relationship("SignatureRequest", back_populates="participants")
    fields = relationship("SignatureField", back_populates="participant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SignatureParticipant(id={self.id}, email={self.email}, role={self.role.value})>"


class SignatureField(Base):
    """Signature field positioning in a document"""
    __tablename__ = "signature_fields"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("signature_requests.id"), nullable=False, index=True)
    participant_id = Column(String, ForeignKey("signature_participants.id"), nullable=False, index=True)
    field_type = Column(SQLEnum(FieldType), nullable=False, index=True)
    page = Column(Integer, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    required = Column(Boolean, nullable=False, default=True)
    tab_label = Column(String(255), nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    request = relationship("SignatureRequest", back_populates="fields")
    participant = relationship("SignatureParticipant", back_populates="fields")

    def __repr__(self):
        return f"<SignatureField(id={self.id}, type={self.field_type.value}, page={self.page})>"


class SignatureAuditLog(Base):
    """Audit log for signature events"""
    __tablename__ = "signature_audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("signature_requests.id"), nullable=False, index=True)
    event_type = Column(SQLEnum(AuditEventType), nullable=False, index=True)
    actor = Column(String, nullable=False)
    actor_type = Column(String(100), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(JSON, nullable=True, default=dict)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    request = relationship("SignatureRequest", back_populates="audit_logs")

    def __repr__(self):
        return f"<SignatureAuditLog(id={self.id}, event_type={self.event_type.value}, actor={self.actor})>"