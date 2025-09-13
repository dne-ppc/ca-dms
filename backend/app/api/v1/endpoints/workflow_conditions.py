"""
API endpoints for conditional workflow logic in CA-DMS
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.workflow_conditions import (
    WorkflowConditionGroup, WorkflowCondition, WorkflowConditionalAction,
    EscalationRule, EscalationInstance, ConditionEvaluation, ActionExecution,
    ConditionType, OperatorType, ActionType, LogicalOperator
)
from app.models.workflow import WorkflowInstance, WorkflowStepInstance
from app.schemas.workflow_conditions import (
    WorkflowConditionGroupCreate, WorkflowConditionGroupUpdate, WorkflowConditionGroupResponse,
    WorkflowConditionCreate, WorkflowConditionUpdate, WorkflowConditionResponse,
    WorkflowConditionalActionCreate, WorkflowConditionalActionUpdate, WorkflowConditionalActionResponse,
    EscalationRuleCreate, EscalationRuleUpdate, EscalationRuleResponse,
    EscalationInstanceResponse, ConditionEvaluationResponse, ActionExecutionResponse,
    WorkflowConditionEvaluationRequest, WorkflowConditionEvaluationResponse
)
from app.services.workflow_condition_service import WorkflowConditionService
from app.services.escalation_service import EscalationService
from app.core.dependencies import get_current_user
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# =========================================================================
# Condition Group Endpoints
# =========================================================================

@router.post("/condition-groups", response_model=WorkflowConditionGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_condition_group(
    group_data: WorkflowConditionGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow condition group"""
    
    condition_group = WorkflowConditionGroup(
        workflow_id=group_data.workflow_id,
        step_id=group_data.step_id,
        name=group_data.name,
        description=group_data.description,
        logical_operator=group_data.logical_operator,
        evaluation_order=group_data.evaluation_order,
        is_active=group_data.is_active,
        stop_on_first_match=group_data.stop_on_first_match,
        created_by=current_user.id
    )
    
    db.add(condition_group)
    db.commit()
    db.refresh(condition_group)
    
    logger.info(f"Created condition group {condition_group.id} by user {current_user.id}")
    return condition_group


@router.get("/condition-groups", response_model=List[WorkflowConditionGroupResponse])
async def list_condition_groups(
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    step_id: Optional[str] = Query(None, description="Filter by step ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List workflow condition groups with optional filtering"""
    
    query = db.query(WorkflowConditionGroup)
    
    if workflow_id:
        query = query.filter(WorkflowConditionGroup.workflow_id == workflow_id)
    
    if step_id:
        query = query.filter(WorkflowConditionGroup.step_id == step_id)
        
    if is_active is not None:
        query = query.filter(WorkflowConditionGroup.is_active == is_active)
    
    condition_groups = query.order_by(
        WorkflowConditionGroup.evaluation_order,
        WorkflowConditionGroup.created_at
    ).offset(skip).limit(limit).all()
    
    return condition_groups


@router.get("/condition-groups/{group_id}", response_model=WorkflowConditionGroupResponse)
async def get_condition_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific condition group by ID"""
    
    condition_group = db.query(WorkflowConditionGroup).filter(
        WorkflowConditionGroup.id == group_id
    ).first()
    
    if not condition_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Condition group not found"
        )
    
    return condition_group


@router.put("/condition-groups/{group_id}", response_model=WorkflowConditionGroupResponse)
async def update_condition_group(
    group_id: str,
    group_data: WorkflowConditionGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a condition group"""
    
    condition_group = db.query(WorkflowConditionGroup).filter(
        WorkflowConditionGroup.id == group_id
    ).first()
    
    if not condition_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Condition group not found"
        )
    
    # Update fields
    for field, value in group_data.dict(exclude_unset=True).items():
        setattr(condition_group, field, value)
    
    condition_group.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(condition_group)
    
    logger.info(f"Updated condition group {group_id} by user {current_user.id}")
    return condition_group


@router.delete("/condition-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_condition_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a condition group"""
    
    condition_group = db.query(WorkflowConditionGroup).filter(
        WorkflowConditionGroup.id == group_id
    ).first()
    
    if not condition_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Condition group not found"
        )
    
    db.delete(condition_group)
    db.commit()
    
    logger.info(f"Deleted condition group {group_id} by user {current_user.id}")


# =========================================================================
# Condition Endpoints
# =========================================================================

@router.post("/conditions", response_model=WorkflowConditionResponse, status_code=status.HTTP_201_CREATED)
async def create_condition(
    condition_data: WorkflowConditionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow condition"""
    
    condition = WorkflowCondition(
        condition_group_id=condition_data.condition_group_id,
        name=condition_data.name,
        description=condition_data.description,
        condition_type=condition_data.condition_type,
        operator=condition_data.operator,
        field_path=condition_data.field_path,
        expected_value=condition_data.expected_value,
        comparison_value=condition_data.comparison_value,
        case_sensitive=condition_data.case_sensitive,
        weight=condition_data.weight,
        is_required=condition_data.is_required,
        negate_result=condition_data.negate_result,
        custom_function=condition_data.custom_function,
        function_parameters=condition_data.function_parameters,
        evaluation_order=condition_data.evaluation_order,
        is_active=condition_data.is_active
    )
    
    db.add(condition)
    db.commit()
    db.refresh(condition)
    
    logger.info(f"Created condition {condition.id} by user {current_user.id}")
    return condition


@router.get("/conditions", response_model=List[WorkflowConditionResponse])
async def list_conditions(
    condition_group_id: Optional[str] = Query(None, description="Filter by condition group ID"),
    condition_type: Optional[ConditionType] = Query(None, description="Filter by condition type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List workflow conditions with optional filtering"""
    
    query = db.query(WorkflowCondition)
    
    if condition_group_id:
        query = query.filter(WorkflowCondition.condition_group_id == condition_group_id)
    
    if condition_type:
        query = query.filter(WorkflowCondition.condition_type == condition_type)
        
    if is_active is not None:
        query = query.filter(WorkflowCondition.is_active == is_active)
    
    conditions = query.order_by(
        WorkflowCondition.evaluation_order,
        WorkflowCondition.created_at
    ).offset(skip).limit(limit).all()
    
    return conditions


@router.put("/conditions/{condition_id}", response_model=WorkflowConditionResponse)
async def update_condition(
    condition_id: str,
    condition_data: WorkflowConditionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a workflow condition"""
    
    condition = db.query(WorkflowCondition).filter(
        WorkflowCondition.id == condition_id
    ).first()
    
    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Condition not found"
        )
    
    # Update fields
    for field, value in condition_data.dict(exclude_unset=True).items():
        setattr(condition, field, value)
    
    condition.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(condition)
    
    logger.info(f"Updated condition {condition_id} by user {current_user.id}")
    return condition


# =========================================================================
# Conditional Action Endpoints
# =========================================================================

@router.post("/conditional-actions", response_model=WorkflowConditionalActionResponse, status_code=status.HTTP_201_CREATED)
async def create_conditional_action(
    action_data: WorkflowConditionalActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new conditional action"""
    
    action = WorkflowConditionalAction(
        condition_group_id=action_data.condition_group_id,
        name=action_data.name,
        description=action_data.description,
        action_type=action_data.action_type,
        execution_order=action_data.execution_order,
        target_step_id=action_data.target_step_id,
        target_user_id=action_data.target_user_id,
        target_role=action_data.target_role,
        action_parameters=action_data.action_parameters,
        notification_template=action_data.notification_template,
        webhook_url=action_data.webhook_url,
        is_async=action_data.is_async,
        retry_count=action_data.retry_count,
        timeout_seconds=action_data.timeout_seconds,
        execute_on_match=action_data.execute_on_match,
        execute_on_no_match=action_data.execute_on_no_match
    )
    
    db.add(action)
    db.commit()
    db.refresh(action)
    
    logger.info(f"Created conditional action {action.id} by user {current_user.id}")
    return action


# =========================================================================
# Escalation Rule Endpoints
# =========================================================================

@router.post("/escalation-rules", response_model=EscalationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_escalation_rule(
    rule_data: EscalationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new escalation rule"""
    
    escalation_service = EscalationService(db)
    
    escalation_rule = escalation_service.create_escalation_rule(
        workflow_id=rule_data.workflow_id,
        step_id=rule_data.step_id,
        rule_data=rule_data.dict()
    )
    
    logger.info(f"Created escalation rule {escalation_rule.id} by user {current_user.id}")
    return escalation_rule


@router.get("/escalation-rules", response_model=List[EscalationRuleResponse])
async def list_escalation_rules(
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    step_id: Optional[str] = Query(None, description="Filter by step ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List escalation rules with optional filtering"""
    
    query = db.query(EscalationRule)
    
    if workflow_id:
        query = query.filter(EscalationRule.workflow_id == workflow_id)
    
    if step_id:
        query = query.filter(EscalationRule.step_id == step_id)
        
    if is_active is not None:
        query = query.filter(EscalationRule.is_active == is_active)
    
    escalation_rules = query.order_by(EscalationRule.created_at.desc()).offset(skip).limit(limit).all()
    
    return escalation_rules


@router.put("/escalation-rules/{rule_id}", response_model=EscalationRuleResponse)
async def update_escalation_rule(
    rule_id: str,
    rule_data: EscalationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an escalation rule"""
    
    escalation_rule = db.query(EscalationRule).filter(
        EscalationRule.id == rule_id
    ).first()
    
    if not escalation_rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation rule not found"
        )
    
    # Update fields
    for field, value in rule_data.dict(exclude_unset=True).items():
        setattr(escalation_rule, field, value)
    
    escalation_rule.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(escalation_rule)
    
    logger.info(f"Updated escalation rule {rule_id} by user {current_user.id}")
    return escalation_rule


# =========================================================================
# Workflow Evaluation Endpoints
# =========================================================================

@router.post("/evaluate-workflow", response_model=WorkflowConditionEvaluationResponse)
async def evaluate_workflow_conditions(
    evaluation_request: WorkflowConditionEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Evaluate all conditions for a workflow instance"""
    
    workflow_instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.id == evaluation_request.workflow_instance_id
    ).first()
    
    if not workflow_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found"
        )
    
    step_instance = None
    if evaluation_request.step_instance_id:
        step_instance = db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.id == evaluation_request.step_instance_id
        ).first()
        
        if not step_instance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Step instance not found"
            )
    
    condition_service = WorkflowConditionService(db)
    
    results = condition_service.evaluate_workflow_conditions(
        workflow_instance=workflow_instance,
        step_instance=step_instance,
        context_data=evaluation_request.context_data
    )
    
    logger.info(f"Evaluated workflow conditions for instance {workflow_instance.id} by user {current_user.id}")
    
    return WorkflowConditionEvaluationResponse(
        workflow_instance_id=workflow_instance.id,
        step_instance_id=step_instance.id if step_instance else None,
        evaluation_results=results,
        evaluated_at=datetime.utcnow()
    )


@router.get("/condition-evaluations", response_model=List[ConditionEvaluationResponse])
async def list_condition_evaluations(
    workflow_instance_id: Optional[str] = Query(None, description="Filter by workflow instance ID"),
    step_instance_id: Optional[str] = Query(None, description="Filter by step instance ID"),
    condition_group_id: Optional[str] = Query(None, description="Filter by condition group ID"),
    result: Optional[bool] = Query(None, description="Filter by evaluation result"),
    start_date: Optional[datetime] = Query(None, description="Filter evaluations after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter evaluations before this date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List condition evaluations with optional filtering"""
    
    query = db.query(ConditionEvaluation)
    
    if workflow_instance_id:
        query = query.filter(ConditionEvaluation.workflow_instance_id == workflow_instance_id)
    
    if step_instance_id:
        query = query.filter(ConditionEvaluation.step_instance_id == step_instance_id)
        
    if condition_group_id:
        query = query.filter(ConditionEvaluation.condition_group_id == condition_group_id)
    
    if result is not None:
        query = query.filter(ConditionEvaluation.result == result)
        
    if start_date:
        query = query.filter(ConditionEvaluation.evaluation_time >= start_date)
        
    if end_date:
        query = query.filter(ConditionEvaluation.evaluation_time <= end_date)
    
    evaluations = query.order_by(ConditionEvaluation.evaluation_time.desc()).offset(skip).limit(limit).all()
    
    return evaluations


# =========================================================================
# Escalation Management Endpoints
# =========================================================================

@router.post("/process-escalations")
async def process_escalations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger escalation processing"""
    
    escalation_service = EscalationService(db)
    
    results = escalation_service.process_escalations()
    
    logger.info(f"Processed escalations by user {current_user.id}: {results}")
    
    return {
        "message": "Escalation processing completed",
        "results": results,
        "processed_at": datetime.utcnow()
    }


@router.get("/escalation-instances", response_model=List[EscalationInstanceResponse])
async def list_escalation_instances(
    workflow_instance_id: Optional[str] = Query(None, description="Filter by workflow instance ID"),
    step_instance_id: Optional[str] = Query(None, description="Filter by step instance ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    escalation_rule_id: Optional[str] = Query(None, description="Filter by escalation rule ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List escalation instances with optional filtering"""
    
    query = db.query(EscalationInstance)
    
    if workflow_instance_id:
        query = query.filter(EscalationInstance.workflow_instance_id == workflow_instance_id)
    
    if step_instance_id:
        query = query.filter(EscalationInstance.step_instance_id == step_instance_id)
        
    if status:
        query = query.filter(EscalationInstance.status == status)
        
    if escalation_rule_id:
        query = query.filter(EscalationInstance.escalation_rule_id == escalation_rule_id)
    
    escalation_instances = query.order_by(EscalationInstance.triggered_at.desc()).offset(skip).limit(limit).all()
    
    return escalation_instances


@router.get("/escalation-statistics")
async def get_escalation_statistics(
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get escalation statistics for monitoring"""
    
    escalation_service = EscalationService(db)
    
    statistics = escalation_service.get_escalation_statistics(workflow_id)
    
    return {
        "statistics": statistics,
        "generated_at": datetime.utcnow(),
        "workflow_id": workflow_id
    }


# =========================================================================
# Utility Endpoints
# =========================================================================

@router.get("/condition-types")
async def get_condition_types():
    """Get available condition types"""
    return [{"value": ct.value, "label": ct.value.replace("_", " ").title()} for ct in ConditionType]


@router.get("/operators")
async def get_operators():
    """Get available operators"""
    return [{"value": op.value, "label": op.value.replace("_", " ").title()} for op in OperatorType]


@router.get("/action-types")
async def get_action_types():
    """Get available action types"""
    return [{"value": at.value, "label": at.value.replace("_", " ").title()} for at in ActionType]


@router.get("/logical-operators")
async def get_logical_operators():
    """Get available logical operators"""
    return [{"value": lo.value, "label": lo.value.upper()} for lo in LogicalOperator]