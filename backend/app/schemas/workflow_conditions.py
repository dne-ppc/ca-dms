"""
Pydantic schemas for conditional workflow logic in CA-DMS
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum

from app.models.workflow_conditions import (
    ConditionType, OperatorType, ActionType, LogicalOperator
)


# =========================================================================
# Base Schemas
# =========================================================================

class ConditionTypeEnum(str, Enum):
    DOCUMENT_FIELD = "document_field"
    PLACEHOLDER_VALUE = "placeholder_value"
    WORKFLOW_DATA = "workflow_data"
    USER_ROLE = "user_role"
    DATE_TIME = "date_time"
    APPROVAL_COUNT = "approval_count"
    DOCUMENT_SIZE = "document_size"
    CUSTOM_FUNCTION = "custom_function"


class OperatorTypeEnum(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_EQUAL = "greater_equal"
    LESS_EQUAL = "less_equal"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IN_LIST = "in_list"
    NOT_IN_LIST = "not_in_list"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    REGEX_MATCH = "regex_match"
    DATE_BEFORE = "date_before"
    DATE_AFTER = "date_after"
    DATE_BETWEEN = "date_between"


class ActionTypeEnum(str, Enum):
    ROUTE_TO_STEP = "route_to_step"
    SKIP_STEP = "skip_step"
    ASSIGN_TO_USER = "assign_to_user"
    ASSIGN_TO_ROLE = "assign_to_role"
    SET_PRIORITY = "set_priority"
    SET_DUE_DATE = "set_due_date"
    SEND_NOTIFICATION = "send_notification"
    AUTO_APPROVE = "auto_approve"
    ESCALATE = "escalate"
    REQUIRE_ADDITIONAL_APPROVAL = "require_additional_approval"
    SET_CONTEXT_DATA = "set_context_data"
    TRIGGER_WEBHOOK = "trigger_webhook"
    PAUSE_WORKFLOW = "pause_workflow"


class LogicalOperatorEnum(str, Enum):
    AND = "and"
    OR = "or"
    NOT = "not"


# =========================================================================
# WorkflowConditionGroup Schemas
# =========================================================================

class WorkflowConditionGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the condition group")
    description: Optional[str] = Field(None, description="Description of the condition group")
    logical_operator: LogicalOperatorEnum = Field(LogicalOperatorEnum.AND, description="Logical operator for combining conditions")
    evaluation_order: int = Field(0, ge=0, description="Order of evaluation for this group")
    is_active: bool = Field(True, description="Whether this condition group is active")
    stop_on_first_match: bool = Field(False, description="Stop evaluating after first match")


class WorkflowConditionGroupCreate(WorkflowConditionGroupBase):
    workflow_id: str = Field(..., description="ID of the workflow this condition group belongs to")
    step_id: Optional[str] = Field(None, description="ID of the step this condition group applies to")


class WorkflowConditionGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    logical_operator: Optional[LogicalOperatorEnum] = None
    evaluation_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    stop_on_first_match: Optional[bool] = None


class WorkflowConditionGroupResponse(WorkflowConditionGroupBase):
    id: str
    workflow_id: str
    step_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    
    class Config:
        from_attributes = True


# =========================================================================
# WorkflowCondition Schemas
# =========================================================================

class WorkflowConditionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the condition")
    description: Optional[str] = Field(None, description="Description of the condition")
    condition_type: ConditionTypeEnum = Field(..., description="Type of condition")
    operator: OperatorTypeEnum = Field(..., description="Comparison operator")
    field_path: Optional[str] = Field(None, max_length=500, description="Field path for value extraction")
    expected_value: Optional[Any] = Field(None, description="Expected value for comparison")
    comparison_value: Optional[Any] = Field(None, description="Secondary value for range comparisons")
    case_sensitive: bool = Field(True, description="Whether string comparisons are case sensitive")
    weight: float = Field(1.0, ge=0.0, le=10.0, description="Weight for scoring conditions")
    is_required: bool = Field(False, description="Whether this condition must evaluate to true")
    negate_result: bool = Field(False, description="Invert the condition result")
    custom_function: Optional[str] = Field(None, max_length=255, description="Name of custom evaluation function")
    function_parameters: Optional[Dict[str, Any]] = Field(None, description="Parameters for custom function")
    evaluation_order: int = Field(0, ge=0, description="Order of evaluation within the group")
    is_active: bool = Field(True, description="Whether this condition is active")

    @validator('field_path')
    def validate_field_path(cls, v, values):
        """Validate field path based on condition type"""
        if not v and values.get('condition_type') in ['document_field', 'placeholder_value', 'workflow_data']:
            raise ValueError('field_path is required for this condition type')
        return v

    @validator('expected_value')
    def validate_expected_value(cls, v, values):
        """Validate expected value based on operator"""
        operator = values.get('operator')
        if operator in ['is_empty', 'is_not_empty'] and v is not None:
            raise ValueError('expected_value should be None for empty/not_empty operators')
        return v


class WorkflowConditionCreate(WorkflowConditionBase):
    condition_group_id: str = Field(..., description="ID of the condition group this condition belongs to")


class WorkflowConditionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    condition_type: Optional[ConditionTypeEnum] = None
    operator: Optional[OperatorTypeEnum] = None
    field_path: Optional[str] = Field(None, max_length=500)
    expected_value: Optional[Any] = None
    comparison_value: Optional[Any] = None
    case_sensitive: Optional[bool] = None
    weight: Optional[float] = Field(None, ge=0.0, le=10.0)
    is_required: Optional[bool] = None
    negate_result: Optional[bool] = None
    custom_function: Optional[str] = Field(None, max_length=255)
    function_parameters: Optional[Dict[str, Any]] = None
    evaluation_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class WorkflowConditionResponse(WorkflowConditionBase):
    id: str
    condition_group_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# =========================================================================
# WorkflowConditionalAction Schemas
# =========================================================================

class WorkflowConditionalActionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the action")
    description: Optional[str] = Field(None, description="Description of the action")
    action_type: ActionTypeEnum = Field(..., description="Type of action to execute")
    execution_order: int = Field(0, ge=0, description="Order of execution for this action")
    target_step_id: Optional[str] = Field(None, description="Target step ID for routing actions")
    target_user_id: Optional[str] = Field(None, description="Target user ID for assignment actions")
    target_role: Optional[str] = Field(None, max_length=50, description="Target role for role assignment actions")
    action_parameters: Optional[Dict[str, Any]] = Field(None, description="Generic parameters for action")
    notification_template: Optional[str] = Field(None, max_length=255, description="Notification template ID")
    webhook_url: Optional[str] = Field(None, max_length=500, description="Webhook URL for triggers")
    is_async: bool = Field(False, description="Execute asynchronously")
    retry_count: int = Field(0, ge=0, le=5, description="Number of retries on failure")
    timeout_seconds: int = Field(300, ge=1, le=3600, description="Action timeout in seconds")
    execute_on_match: bool = Field(True, description="Execute when conditions match")
    execute_on_no_match: bool = Field(False, description="Execute when conditions don't match")

    @validator('target_step_id')
    def validate_target_step(cls, v, values):
        """Validate target_step_id for routing actions"""
        if values.get('action_type') == 'route_to_step' and not v:
            raise ValueError('target_step_id is required for route_to_step action')
        return v

    @validator('target_user_id')
    def validate_target_user(cls, v, values):
        """Validate target_user_id for user assignment actions"""
        if values.get('action_type') == 'assign_to_user' and not v:
            raise ValueError('target_user_id is required for assign_to_user action')
        return v

    @validator('target_role')
    def validate_target_role(cls, v, values):
        """Validate target_role for role assignment actions"""
        if values.get('action_type') == 'assign_to_role' and not v:
            raise ValueError('target_role is required for assign_to_role action')
        return v


class WorkflowConditionalActionCreate(WorkflowConditionalActionBase):
    condition_group_id: str = Field(..., description="ID of the condition group this action belongs to")


class WorkflowConditionalActionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    action_type: Optional[ActionTypeEnum] = None
    execution_order: Optional[int] = Field(None, ge=0)
    target_step_id: Optional[str] = None
    target_user_id: Optional[str] = None
    target_role: Optional[str] = Field(None, max_length=50)
    action_parameters: Optional[Dict[str, Any]] = None
    notification_template: Optional[str] = Field(None, max_length=255)
    webhook_url: Optional[str] = Field(None, max_length=500)
    is_async: Optional[bool] = None
    retry_count: Optional[int] = Field(None, ge=0, le=5)
    timeout_seconds: Optional[int] = Field(None, ge=1, le=3600)
    execute_on_match: Optional[bool] = None
    execute_on_no_match: Optional[bool] = None


class WorkflowConditionalActionResponse(WorkflowConditionalActionBase):
    id: str
    condition_group_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# =========================================================================
# EscalationRule Schemas
# =========================================================================

class EscalationRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the escalation rule")
    description: Optional[str] = Field(None, description="Description of the escalation rule")
    is_active: bool = Field(True, description="Whether this escalation rule is active")
    trigger_after_hours: Optional[int] = Field(None, ge=1, description="Time-based trigger in hours")
    trigger_conditions: Optional[Dict[str, Any]] = Field(None, description="Complex condition triggers")
    max_escalation_levels: int = Field(3, ge=1, le=10, description="Maximum escalation levels")
    escalation_chain: List[Any] = Field(..., description="Chain of users/roles to escalate to")
    notification_intervals: Optional[List[int]] = Field(None, description="Notification frequency at each level")
    auto_approve_after_escalation: bool = Field(False, description="Auto-approve after max escalation")
    business_hours_only: bool = Field(False, description="Only escalate during business hours")
    exclude_weekends: bool = Field(False, description="Skip weekends for escalation")
    priority_multiplier: float = Field(1.0, ge=0.1, le=10.0, description="Priority adjustment on escalation")

    @validator('escalation_chain')
    def validate_escalation_chain(cls, v):
        """Validate escalation chain structure"""
        if not v or len(v) == 0:
            raise ValueError('escalation_chain must contain at least one escalation target')
        return v

    @validator('notification_intervals')
    def validate_notification_intervals(cls, v, values):
        """Validate notification intervals"""
        if v and len(v) > values.get('max_escalation_levels', 3):
            raise ValueError('notification_intervals cannot exceed max_escalation_levels')
        return v


class EscalationRuleCreate(EscalationRuleBase):
    workflow_id: str = Field(..., description="ID of the workflow this escalation rule belongs to")
    step_id: Optional[str] = Field(None, description="ID of the step this escalation rule applies to")


class EscalationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    trigger_after_hours: Optional[int] = Field(None, ge=1)
    trigger_conditions: Optional[Dict[str, Any]] = None
    max_escalation_levels: Optional[int] = Field(None, ge=1, le=10)
    escalation_chain: Optional[List[Any]] = None
    notification_intervals: Optional[List[int]] = None
    auto_approve_after_escalation: Optional[bool] = None
    business_hours_only: Optional[bool] = None
    exclude_weekends: Optional[bool] = None
    priority_multiplier: Optional[float] = Field(None, ge=0.1, le=10.0)


class EscalationRuleResponse(EscalationRuleBase):
    id: str
    workflow_id: str
    step_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    
    class Config:
        from_attributes = True


# =========================================================================
# Evaluation and Execution Schemas
# =========================================================================

class ConditionEvaluationResponse(BaseModel):
    id: str
    workflow_instance_id: str
    step_instance_id: Optional[str]
    condition_group_id: str
    condition_id: Optional[str]
    result: bool
    actual_value: Optional[Any]
    evaluation_details: Optional[Dict[str, Any]]
    evaluation_time: datetime
    execution_time_ms: Optional[int]
    error_message: Optional[str]
    context_snapshot: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True


class ActionExecutionResponse(BaseModel):
    id: str
    workflow_instance_id: str
    step_instance_id: Optional[str]
    action_id: str
    status: str
    result_data: Optional[Dict[str, Any]]
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    execution_time_ms: Optional[int]
    retry_attempt: int
    input_parameters: Optional[Dict[str, Any]]
    context_snapshot: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True


class EscalationInstanceResponse(BaseModel):
    id: str
    escalation_rule_id: str
    workflow_instance_id: str
    step_instance_id: str
    current_level: int
    escalated_to: Optional[str]
    status: str
    triggered_at: datetime
    last_escalated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    escalation_reason: Optional[str]
    resolution_method: Optional[str]
    escalation_history: Optional[List[Dict[str, Any]]]
    
    class Config:
        from_attributes = True


# =========================================================================
# Request/Response Schemas for Operations
# =========================================================================

class WorkflowConditionEvaluationRequest(BaseModel):
    workflow_instance_id: str = Field(..., description="ID of the workflow instance to evaluate")
    step_instance_id: Optional[str] = Field(None, description="ID of the step instance to evaluate")
    context_data: Optional[Dict[str, Any]] = Field(None, description="Additional context data for evaluation")


class WorkflowConditionEvaluationResponse(BaseModel):
    workflow_instance_id: str
    step_instance_id: Optional[str]
    evaluation_results: Dict[str, Any]
    evaluated_at: datetime


# =========================================================================
# Utility Schemas
# =========================================================================

class ConditionTypeOption(BaseModel):
    value: str
    label: str
    description: Optional[str] = None


class OperatorOption(BaseModel):
    value: str
    label: str
    description: Optional[str] = None


class ActionTypeOption(BaseModel):
    value: str
    label: str
    description: Optional[str] = None


class LogicalOperatorOption(BaseModel):
    value: str
    label: str
    description: Optional[str] = None


# =========================================================================
# Complex Configuration Schemas
# =========================================================================

class ConditionalWorkflowConfiguration(BaseModel):
    """Complete configuration for conditional workflow logic"""
    workflow_id: str
    condition_groups: List[WorkflowConditionGroupCreate]
    escalation_rules: List[EscalationRuleCreate]
    description: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "workflow_id": "workflow-123",
                "description": "Conditional logic for document approval workflow",
                "condition_groups": [
                    {
                        "name": "High Priority Documents",
                        "description": "Route high priority documents to executives",
                        "workflow_id": "workflow-123",
                        "logical_operator": "and",
                        "conditions": [
                            {
                                "name": "Check Priority Level",
                                "condition_type": "workflow_data",
                                "operator": "greater_than",
                                "field_path": "priority",
                                "expected_value": 7
                            }
                        ],
                        "actions": [
                            {
                                "name": "Route to Executive",
                                "action_type": "assign_to_role",
                                "target_role": "executive"
                            }
                        ]
                    }
                ],
                "escalation_rules": [
                    {
                        "name": "24 Hour Escalation",
                        "workflow_id": "workflow-123",
                        "trigger_after_hours": 24,
                        "escalation_chain": [
                            {"type": "role", "role": "manager"},
                            {"type": "role", "role": "executive"}
                        ],
                        "business_hours_only": True
                    }
                ]
            }
        }