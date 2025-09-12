"""
Pydantic schemas for workflow operations
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.workflow import (
    WorkflowStatus, 
    WorkflowStepType, 
    WorkflowInstanceStatus, 
    StepInstanceStatus
)


class WorkflowStepBase(BaseModel):
    """Base workflow step schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    step_type: WorkflowStepType
    step_order: int = Field(..., ge=1)
    required_role: Optional[str] = Field(None, max_length=50)
    required_users: Optional[List[str]] = None
    required_approvals: int = Field(default=1, ge=1)
    allow_delegation: bool = False
    is_parallel: bool = False
    timeout_hours: Optional[int] = Field(None, ge=1, le=720)  # Max 30 days
    escalation_users: Optional[List[str]] = None
    auto_approve_conditions: Optional[Dict[str, Any]] = None
    instructions: Optional[str] = None
    form_fields: Optional[Dict[str, Any]] = None


class WorkflowStepCreate(WorkflowStepBase):
    """Schema for creating workflow steps"""
    pass


class WorkflowStepUpdate(BaseModel):
    """Schema for updating workflow steps"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    step_type: Optional[WorkflowStepType] = None
    step_order: Optional[int] = Field(None, ge=1)
    required_role: Optional[str] = Field(None, max_length=50)
    required_users: Optional[List[str]] = None
    required_approvals: Optional[int] = Field(None, ge=1)
    allow_delegation: Optional[bool] = None
    is_parallel: Optional[bool] = None
    timeout_hours: Optional[int] = Field(None, ge=1, le=720)
    escalation_users: Optional[List[str]] = None
    auto_approve_conditions: Optional[Dict[str, Any]] = None
    instructions: Optional[str] = None
    form_fields: Optional[Dict[str, Any]] = None


class WorkflowStepResponse(WorkflowStepBase):
    """Schema for workflow step responses"""
    id: str
    workflow_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowBase(BaseModel):
    """Base workflow schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    document_type: str = Field(..., max_length=50)
    trigger_conditions: Optional[Dict[str, Any]] = None
    status: WorkflowStatus = WorkflowStatus.DRAFT
    is_default: bool = False


class WorkflowCreate(WorkflowBase):
    """Schema for creating workflows"""
    steps: List[WorkflowStepCreate] = Field(..., min_items=1)


class WorkflowUpdate(BaseModel):
    """Schema for updating workflows"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    document_type: Optional[str] = Field(None, max_length=50)
    trigger_conditions: Optional[Dict[str, Any]] = None
    status: Optional[WorkflowStatus] = None
    is_default: Optional[bool] = None


class WorkflowResponse(WorkflowBase):
    """Schema for workflow responses"""
    id: str
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    steps: List[WorkflowStepResponse] = []

    model_config = {"from_attributes": True}


class WorkflowList(BaseModel):
    """Schema for workflow list responses"""
    workflows: List[WorkflowResponse]
    total: int
    skip: int
    limit: int


class WorkflowStepInstanceBase(BaseModel):
    """Base workflow step instance schema"""
    decision: Optional[str] = Field(None, max_length=20)
    comments: Optional[str] = None
    form_data: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None


class WorkflowStepInstanceCreate(WorkflowStepInstanceBase):
    """Schema for creating step instances (usually automatic)"""
    assigned_to: Optional[str] = None


class WorkflowStepInstanceUpdate(WorkflowStepInstanceBase):
    """Schema for updating step instances (approvals)"""
    pass


class WorkflowStepInstanceResponse(WorkflowStepInstanceBase):
    """Schema for step instance responses"""
    id: str
    workflow_instance_id: str
    step_id: str
    status: StepInstanceStatus
    assigned_to: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    delegated_to: Optional[str] = None
    delegated_at: Optional[datetime] = None
    delegation_reason: Optional[str] = None
    escalated: bool
    escalated_at: Optional[datetime] = None
    escalated_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowInstanceBase(BaseModel):
    """Base workflow instance schema"""
    context_data: Optional[Dict[str, Any]] = None
    priority: int = Field(default=0, ge=0, le=10)
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class WorkflowInstanceCreate(WorkflowInstanceBase):
    """Schema for creating workflow instances"""
    workflow_id: str
    document_id: str


class WorkflowInstanceUpdate(BaseModel):
    """Schema for updating workflow instances"""
    context_data: Optional[Dict[str, Any]] = None
    priority: Optional[int] = Field(None, ge=0, le=10)
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class WorkflowInstanceResponse(WorkflowInstanceBase):
    """Schema for workflow instance responses"""
    id: str
    workflow_id: str
    document_id: str
    status: WorkflowInstanceStatus
    current_step_order: int
    initiated_by: str
    initiated_at: datetime
    completed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    step_instances: List[WorkflowStepInstanceResponse] = []

    model_config = {"from_attributes": True}


class WorkflowInstanceList(BaseModel):
    """Schema for workflow instance list responses"""
    instances: List[WorkflowInstanceResponse]
    total: int
    skip: int
    limit: int


class WorkflowDashboard(BaseModel):
    """Schema for workflow dashboard data"""
    pending_approvals: List[WorkflowStepInstanceResponse]
    my_workflows: List[WorkflowInstanceResponse]
    recent_completions: List[WorkflowInstanceResponse]
    overdue_items: List[WorkflowStepInstanceResponse]
    workflow_stats: Dict[str, int]


class ApprovalAction(BaseModel):
    """Schema for approval actions"""
    action: str = Field(..., pattern="^(approve|reject|delegate)$")
    comments: Optional[str] = None
    form_data: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    delegate_to: Optional[str] = None  # Required if action is "delegate"
    delegation_reason: Optional[str] = None


class WorkflowExecutionRequest(BaseModel):
    """Schema for triggering workflow execution"""
    document_id: str
    workflow_id: Optional[str] = None  # Use default workflow if not specified
    context_data: Optional[Dict[str, Any]] = None
    priority: int = Field(default=0, ge=0, le=10)
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class WorkflowTemplate(BaseModel):
    """Schema for workflow templates"""
    name: str
    description: str
    document_type: str
    template_data: Dict[str, Any]
    is_builtin: bool = False


class WorkflowAnalytics(BaseModel):
    """Schema for workflow analytics"""
    total_workflows: int
    active_workflows: int
    completed_instances: int
    average_completion_time: float  # hours
    approval_rates: Dict[str, float]
    bottleneck_steps: List[Dict[str, Any]]
    user_performance: List[Dict[str, Any]]