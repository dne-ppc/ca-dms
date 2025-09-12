"""
Enhanced workflow models with conditional logic support for CA-DMS
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.core.database import Base


class ConditionType(enum.Enum):
    """Types of workflow conditions"""
    DOCUMENT_FIELD = "document_field"           # Based on document content/metadata
    PLACEHOLDER_VALUE = "placeholder_value"     # Based on placeholder field values
    WORKFLOW_DATA = "workflow_data"            # Based on workflow context data
    USER_ROLE = "user_role"                    # Based on user roles/permissions
    DATE_TIME = "date_time"                    # Based on date/time conditions
    APPROVAL_COUNT = "approval_count"          # Based on number of approvals
    DOCUMENT_SIZE = "document_size"            # Based on document complexity
    CUSTOM_FUNCTION = "custom_function"        # Custom evaluation function


class OperatorType(enum.Enum):
    """Comparison operators for conditions"""
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


class ActionType(enum.Enum):
    """Types of conditional actions"""
    ROUTE_TO_STEP = "route_to_step"           # Route to specific step
    SKIP_STEP = "skip_step"                   # Skip current/specified step
    ASSIGN_TO_USER = "assign_to_user"         # Assign to specific user
    ASSIGN_TO_ROLE = "assign_to_role"         # Assign to user with role
    SET_PRIORITY = "set_priority"             # Set workflow priority
    SET_DUE_DATE = "set_due_date"            # Set step due date
    SEND_NOTIFICATION = "send_notification"   # Send custom notification
    AUTO_APPROVE = "auto_approve"             # Automatically approve step
    ESCALATE = "escalate"                     # Escalate immediately
    REQUIRE_ADDITIONAL_APPROVAL = "require_additional_approval"  # Add extra approval
    SET_CONTEXT_DATA = "set_context_data"     # Set workflow context variables
    TRIGGER_WEBHOOK = "trigger_webhook"       # Trigger external webhook
    PAUSE_WORKFLOW = "pause_workflow"         # Pause workflow execution


class LogicalOperator(enum.Enum):
    """Logical operators for combining conditions"""
    AND = "and"
    OR = "or"
    NOT = "not"


class WorkflowConditionGroup(Base):
    """Groups of conditions with logical operators"""
    __tablename__ = "workflow_condition_groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    step_id = Column(String, ForeignKey("workflow_steps.id"), nullable=True, index=True)
    
    # Group configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logical_operator = Column(SQLEnum(LogicalOperator), default=LogicalOperator.AND)
    evaluation_order = Column(Integer, default=0)  # Order of evaluation
    
    # Group behavior
    is_active = Column(Boolean, default=True)
    stop_on_first_match = Column(Boolean, default=False)  # Stop evaluating after first match
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    workflow = relationship("Workflow")
    step = relationship("WorkflowStep")
    conditions = relationship("WorkflowCondition", back_populates="condition_group", cascade="all, delete-orphan")
    actions = relationship("WorkflowConditionalAction", back_populates="condition_group", cascade="all, delete-orphan")
    evaluations = relationship("ConditionEvaluation", back_populates="condition_group")

    def __repr__(self):
        return f"<WorkflowConditionGroup(id={self.id}, name={self.name})>"


class WorkflowCondition(Base):
    """Individual conditions for workflow logic"""
    __tablename__ = "workflow_conditions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    condition_group_id = Column(String, ForeignKey("workflow_condition_groups.id"), nullable=False, index=True)
    
    # Condition configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    condition_type = Column(SQLEnum(ConditionType), nullable=False)
    operator = Column(SQLEnum(OperatorType), nullable=False)
    
    # Condition data
    field_path = Column(String(500), nullable=True)  # JSON path or field identifier
    expected_value = Column(JSON, nullable=True)     # Expected value(s) for comparison
    comparison_value = Column(JSON, nullable=True)   # Secondary value for range comparisons
    
    # Advanced condition settings
    case_sensitive = Column(Boolean, default=True)
    weight = Column(Float, default=1.0)             # Weight for scoring conditions
    is_required = Column(Boolean, default=False)     # Must evaluate to true
    negate_result = Column(Boolean, default=False)   # Invert the condition result
    
    # Custom evaluation
    custom_function = Column(String(255), nullable=True)  # Name of custom evaluation function
    function_parameters = Column(JSON, nullable=True)     # Parameters for custom function
    
    # Condition metadata
    evaluation_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    condition_group = relationship("WorkflowConditionGroup", back_populates="conditions")
    evaluations = relationship("ConditionEvaluation", back_populates="condition")

    def __repr__(self):
        return f"<WorkflowCondition(id={self.id}, name={self.name}, type={self.condition_type.value})>"


class WorkflowConditionalAction(Base):
    """Actions to take when conditions are met"""
    __tablename__ = "workflow_conditional_actions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    condition_group_id = Column(String, ForeignKey("workflow_condition_groups.id"), nullable=False, index=True)
    
    # Action configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    action_type = Column(SQLEnum(ActionType), nullable=False)
    execution_order = Column(Integer, default=0)
    
    # Action parameters
    target_step_id = Column(String, ForeignKey("workflow_steps.id"), nullable=True)  # For step routing
    target_user_id = Column(String, ForeignKey("users.id"), nullable=True)         # For user assignment
    target_role = Column(String(50), nullable=True)                                # For role assignment
    
    # Action data
    action_parameters = Column(JSON, nullable=True)  # Generic parameters for action
    notification_template = Column(String(255), nullable=True)  # Notification template ID
    webhook_url = Column(String(500), nullable=True)           # Webhook URL for triggers
    
    # Action behavior
    is_async = Column(Boolean, default=False)        # Execute asynchronously
    retry_count = Column(Integer, default=0)         # Number of retries on failure
    timeout_seconds = Column(Integer, default=300)   # Action timeout
    
    # Conditions for action execution
    execute_on_match = Column(Boolean, default=True)     # Execute when conditions match
    execute_on_no_match = Column(Boolean, default=False) # Execute when conditions don't match
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    condition_group = relationship("WorkflowConditionGroup", back_populates="actions")
    target_step = relationship("WorkflowStep", foreign_keys=[target_step_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    executions = relationship("ActionExecution", back_populates="action", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WorkflowConditionalAction(id={self.id}, name={self.name}, type={self.action_type.value})>"


class ConditionEvaluation(Base):
    """Record of condition evaluations during workflow execution"""
    __tablename__ = "condition_evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    step_instance_id = Column(String, ForeignKey("workflow_step_instances.id"), nullable=True, index=True)
    condition_group_id = Column(String, ForeignKey("workflow_condition_groups.id"), nullable=False, index=True)
    condition_id = Column(String, ForeignKey("workflow_conditions.id"), nullable=True, index=True)
    
    # Evaluation results
    result = Column(Boolean, nullable=False)          # Final evaluation result
    actual_value = Column(JSON, nullable=True)        # Actual value that was evaluated
    evaluation_details = Column(JSON, nullable=True)  # Detailed evaluation information
    
    # Evaluation metadata
    evaluation_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    execution_time_ms = Column(Integer, nullable=True)  # Time taken to evaluate
    error_message = Column(Text, nullable=True)         # Error if evaluation failed
    
    # Context
    context_snapshot = Column(JSON, nullable=True)    # Snapshot of context at evaluation time
    
    # Relationships
    workflow_instance = relationship("WorkflowInstance")
    step_instance = relationship("WorkflowStepInstance")
    condition_group = relationship("WorkflowConditionGroup", back_populates="evaluations")
    condition = relationship("WorkflowCondition", back_populates="evaluations")

    def __repr__(self):
        return f"<ConditionEvaluation(id={self.id}, result={self.result})>"


class ActionExecution(Base):
    """Record of conditional action executions"""
    __tablename__ = "action_executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    step_instance_id = Column(String, ForeignKey("workflow_step_instances.id"), nullable=True, index=True)
    action_id = Column(String, ForeignKey("workflow_conditional_actions.id"), nullable=False, index=True)
    
    # Execution results
    status = Column(String(20), nullable=False)       # "success", "failed", "pending"
    result_data = Column(JSON, nullable=True)         # Action result data
    error_message = Column(Text, nullable=True)       # Error if action failed
    
    # Execution metadata
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    retry_attempt = Column(Integer, default=0)
    
    # Context
    input_parameters = Column(JSON, nullable=True)    # Parameters passed to action
    context_snapshot = Column(JSON, nullable=True)    # Context at execution time
    
    # Relationships
    workflow_instance = relationship("WorkflowInstance")
    step_instance = relationship("WorkflowStepInstance")
    action = relationship("WorkflowConditionalAction", back_populates="executions")

    def __repr__(self):
        return f"<ActionExecution(id={self.id}, status={self.status})>"


class EscalationRule(Base):
    """Advanced escalation rules with conditions"""
    __tablename__ = "escalation_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    step_id = Column(String, ForeignKey("workflow_steps.id"), nullable=True, index=True)
    
    # Rule configuration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Trigger conditions
    trigger_after_hours = Column(Integer, nullable=True)     # Time-based trigger
    trigger_conditions = Column(JSON, nullable=True)         # Complex condition triggers
    max_escalation_levels = Column(Integer, default=3)       # Maximum escalation levels
    
    # Escalation behavior
    escalation_chain = Column(JSON, nullable=False)          # Chain of users/roles to escalate to
    notification_intervals = Column(JSON, nullable=True)     # Notification frequency at each level
    auto_approve_after_escalation = Column(Boolean, default=False)
    
    # Advanced features
    business_hours_only = Column(Boolean, default=False)     # Only escalate during business hours
    exclude_weekends = Column(Boolean, default=False)        # Skip weekends
    priority_multiplier = Column(Float, default=1.0)         # Priority adjustment on escalation
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    workflow = relationship("Workflow")
    step = relationship("WorkflowStep")
    escalation_instances = relationship("EscalationInstance", back_populates="escalation_rule", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<EscalationRule(id={self.id}, name={self.name})>"


class EscalationInstance(Base):
    """Active escalation instances"""
    __tablename__ = "escalation_instances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    escalation_rule_id = Column(String, ForeignKey("escalation_rules.id"), nullable=False, index=True)
    workflow_instance_id = Column(String, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    step_instance_id = Column(String, ForeignKey("workflow_step_instances.id"), nullable=False, index=True)
    
    # Escalation state
    current_level = Column(Integer, default=0)
    escalated_to = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="active")  # "active", "resolved", "cancelled"
    
    # Timing
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_escalated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Escalation data
    escalation_reason = Column(Text, nullable=True)
    resolution_method = Column(String(50), nullable=True)  # How escalation was resolved
    escalation_history = Column(JSON, nullable=True)       # History of escalation actions
    
    # Relationships
    escalation_rule = relationship("EscalationRule", back_populates="escalation_instances")
    workflow_instance = relationship("WorkflowInstance")
    step_instance = relationship("WorkflowStepInstance")
    escalated_user = relationship("User", foreign_keys=[escalated_to])

    def __repr__(self):
        return f"<EscalationInstance(id={self.id}, level={self.current_level}, status={self.status})>"


# Import existing models to extend relationships
from app.models.workflow import Workflow, WorkflowStep, WorkflowInstance, WorkflowStepInstance

# Extend existing models with conditional logic relationships
Workflow.condition_groups = relationship("WorkflowConditionGroup", cascade="all, delete-orphan")
Workflow.escalation_rules = relationship("EscalationRule", cascade="all, delete-orphan")

WorkflowStep.condition_groups = relationship("WorkflowConditionGroup", cascade="all, delete-orphan")
WorkflowStep.escalation_rules = relationship("EscalationRule", cascade="all, delete-orphan")

WorkflowInstance.condition_evaluations = relationship("ConditionEvaluation", cascade="all, delete-orphan")
WorkflowInstance.action_executions = relationship("ActionExecution", cascade="all, delete-orphan")
WorkflowInstance.escalation_instances = relationship("EscalationInstance", cascade="all, delete-orphan")

WorkflowStepInstance.condition_evaluations = relationship("ConditionEvaluation", cascade="all, delete-orphan")
WorkflowStepInstance.action_executions = relationship("ActionExecution", cascade="all, delete-orphan")
WorkflowStepInstance.escalation_instances = relationship("EscalationInstance", cascade="all, delete-orphan")