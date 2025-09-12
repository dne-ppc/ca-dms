"""
Workflow models for CA-DMS approval system
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.core.database import Base


class WorkflowStatus(enum.Enum):
    """Workflow definition status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class WorkflowStepType(enum.Enum):
    """Types of workflow steps"""
    APPROVAL = "approval"
    REVIEW = "review"
    NOTIFICATION = "notification"
    AUTOMATIC = "automatic"


class WorkflowInstanceStatus(enum.Enum):
    """Workflow instance execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class StepInstanceStatus(enum.Enum):
    """Individual step execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class Workflow(Base):
    """Workflow definition model"""
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Workflow configuration
    document_type = Column(String(50), nullable=False, index=True)  # Which document types this applies to
    trigger_conditions = Column(JSON, nullable=True)  # Conditions that trigger this workflow
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, index=True)
    
    # Workflow metadata
    version = Column(Integer, default=1, nullable=False)
    is_default = Column(Boolean, default=False, index=True)  # Default workflow for document type
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStep.step_order")
    instances = relationship("WorkflowInstance", back_populates="workflow")

    def __repr__(self):
        return f"<Workflow(id={self.id}, name={self.name}, status={self.status.value})>"


class WorkflowStep(Base):
    """Individual step in a workflow"""
    __tablename__ = "workflow_steps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    
    # Step configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    step_type = Column(SQLEnum(WorkflowStepType), nullable=False)
    step_order = Column(Integer, nullable=False)  # Order of execution
    
    # Approval configuration
    required_role = Column(String(50), nullable=True)  # Required user role for approval
    required_users = Column(JSON, nullable=True)  # Specific users who can approve
    required_approvals = Column(Integer, default=1)  # Number of approvals needed
    allow_delegation = Column(Boolean, default=False)  # Can approver delegate to others
    
    # Step behavior
    is_parallel = Column(Boolean, default=False)  # Can execute in parallel with other steps
    timeout_hours = Column(Integer, nullable=True)  # Auto-escalation timeout
    escalation_users = Column(JSON, nullable=True)  # Users to escalate to on timeout
    auto_approve_conditions = Column(JSON, nullable=True)  # Conditions for auto-approval
    
    # Step metadata
    instructions = Column(Text, nullable=True)  # Instructions for approvers
    form_fields = Column(JSON, nullable=True)  # Additional form fields for this step
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="steps")
    step_instances = relationship("WorkflowStepInstance", back_populates="step")

    def __repr__(self):
        return f"<WorkflowStep(id={self.id}, name={self.name}, order={self.step_order})>"


class WorkflowInstance(Base):
    """Instance of a workflow execution for a specific document"""
    __tablename__ = "workflow_instances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    
    # Instance state
    status = Column(SQLEnum(WorkflowInstanceStatus), default=WorkflowInstanceStatus.PENDING, index=True)
    current_step_order = Column(Integer, default=1)  # Current step being executed
    
    # Instance metadata
    initiated_by = Column(String, ForeignKey("users.id"), nullable=False)
    initiated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Instance data
    context_data = Column(JSON, nullable=True)  # Additional context for workflow execution
    priority = Column(Integer, default=0)  # Workflow priority (higher = more urgent)
    due_date = Column(DateTime(timezone=True), nullable=True)  # Expected completion date
    
    # Comments and notes
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="instances")
    document = relationship("Document", back_populates="workflow_instances")
    step_instances = relationship("WorkflowStepInstance", back_populates="workflow_instance", cascade="all, delete-orphan")
    
    # User relationships
    initiator = relationship("User", foreign_keys=[initiated_by])

    def __repr__(self):
        return f"<WorkflowInstance(id={self.id}, status={self.status.value}, document_id={self.document_id})>"


class WorkflowStepInstance(Base):
    """Instance of a workflow step execution"""
    __tablename__ = "workflow_step_instances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    step_id = Column(String, ForeignKey("workflow_steps.id"), nullable=False, index=True)
    
    # Step instance state
    status = Column(SQLEnum(StepInstanceStatus), default=StepInstanceStatus.PENDING, index=True)
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    # Execution metadata
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Approval data
    decision = Column(String(20), nullable=True)  # "approved", "rejected", "delegated"
    comments = Column(Text, nullable=True)
    form_data = Column(JSON, nullable=True)  # Data from approval form
    attachments = Column(JSON, nullable=True)  # File attachments
    
    # Delegation
    delegated_to = Column(String, ForeignKey("users.id"), nullable=True)
    delegated_at = Column(DateTime(timezone=True), nullable=True)
    delegation_reason = Column(Text, nullable=True)
    
    # Escalation
    escalated = Column(Boolean, default=False)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    escalated_to = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    workflow_instance = relationship("WorkflowInstance", back_populates="step_instances")
    step = relationship("WorkflowStep", back_populates="step_instances")
    
    # User relationships
    assignee = relationship("User", foreign_keys=[assigned_to])
    delegate = relationship("User", foreign_keys=[delegated_to])
    escalated_user = relationship("User", foreign_keys=[escalated_to])

    def __repr__(self):
        return f"<WorkflowStepInstance(id={self.id}, status={self.status.value}, step_id={self.step_id})>"


# Add workflow relationship to Document model
from app.models.document import Document
Document.workflow_instances = relationship("WorkflowInstance", back_populates="document")