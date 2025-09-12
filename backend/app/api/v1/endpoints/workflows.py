"""
Workflow management API endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import (
    get_current_verified_user,
    require_admin,
    require_board_member,
    require_manager
)
from app.services.workflow_service import WorkflowService
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowList,
    WorkflowInstanceCreate,
    WorkflowInstanceUpdate,
    WorkflowInstanceResponse,
    WorkflowInstanceList,
    WorkflowStepInstanceResponse,
    ApprovalAction,
    WorkflowExecutionRequest,
    WorkflowDashboard,
    WorkflowAnalytics
)
from app.models.workflow import WorkflowStatus, WorkflowInstanceStatus
from app.models.user import User

router = APIRouter()


# Workflow Definition Management
@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    workflow_data: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new workflow definition (Admin only)"""
    workflow_service = WorkflowService(db)
    
    try:
        workflow = workflow_service.create_workflow(workflow_data, current_user.id)
        return WorkflowResponse.model_validate(workflow)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create workflow: {str(e)}"
        )


@router.get("/", response_model=WorkflowList)
def get_workflows(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    document_type: Optional[str] = Query(default=None),
    status_filter: Optional[WorkflowStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Get workflow definitions with filtering (Manager+ access)"""
    workflow_service = WorkflowService(db)
    workflows = workflow_service.get_workflows(
        skip=skip, 
        limit=limit, 
        document_type=document_type,
        status=status_filter
    )
    
    workflow_responses = [WorkflowResponse.model_validate(wf) for wf in workflows]
    
    return WorkflowList(
        workflows=workflow_responses,
        total=len(workflow_responses),
        skip=skip,
        limit=limit
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Get a specific workflow definition (Manager+ access)"""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_workflow(workflow_id)
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    return WorkflowResponse.model_validate(workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: str,
    workflow_data: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a workflow definition (Admin only)"""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.update_workflow(workflow_id, workflow_data, current_user.id)
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    return WorkflowResponse.model_validate(workflow)


@router.post("/{workflow_id}/activate")
def activate_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Activate a workflow (Admin only)"""
    workflow_service = WorkflowService(db)
    success = workflow_service.activate_workflow(workflow_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    return {"message": "Workflow activated successfully"}


@router.get("/document-types/{document_type}/default", response_model=WorkflowResponse)
def get_default_workflow(
    document_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get the default workflow for a document type"""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_default_workflow(document_type)
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No default workflow found for document type: {document_type}"
        )
    
    return WorkflowResponse.model_validate(workflow)


# Workflow Execution
@router.post("/execute", response_model=WorkflowInstanceResponse)
def start_workflow(
    request: WorkflowExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Start a workflow for a document"""
    workflow_service = WorkflowService(db)
    
    instance = workflow_service.start_workflow(
        document_id=request.document_id,
        workflow_id=request.workflow_id,
        initiated_by=current_user.id,
        context_data=request.context_data,
        priority=request.priority,
        due_date=request.due_date,
        notes=request.notes
    )
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to start workflow. Check document exists and workflow is active."
        )
    
    return WorkflowInstanceResponse.model_validate(instance)


# Workflow Instance Management
@router.get("/instances", response_model=WorkflowInstanceList)
def get_workflow_instances(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    status_filter: Optional[WorkflowInstanceStatus] = Query(default=None, alias="status"),
    initiated_by: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get workflow instances with filtering"""
    workflow_service = WorkflowService(db)
    
    # Non-admins can only see workflows they initiated or are assigned to
    if not current_user.has_permission("read"):
        initiated_by = current_user.id
    
    instances = workflow_service.get_workflow_instances(
        skip=skip,
        limit=limit,
        status=status_filter,
        initiated_by=initiated_by
    )
    
    instance_responses = [WorkflowInstanceResponse.model_validate(inst) for inst in instances]
    
    return WorkflowInstanceList(
        instances=instance_responses,
        total=len(instance_responses),
        skip=skip,
        limit=limit
    )


@router.get("/instances/{instance_id}", response_model=WorkflowInstanceResponse)
def get_workflow_instance(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get a specific workflow instance"""
    workflow_service = WorkflowService(db)
    instance = workflow_service.get_workflow_instance(instance_id)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found"
        )
    
    # Check access permissions
    if not current_user.has_permission("read") and instance.initiated_by != current_user.id:
        # Check if user is assigned to any step
        user_assigned = any(
            step.assigned_to == current_user.id 
            for step in instance.step_instances
        )
        if not user_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return WorkflowInstanceResponse.model_validate(instance)


@router.put("/instances/{instance_id}", response_model=WorkflowInstanceResponse)
def update_workflow_instance(
    instance_id: str,
    update_data: WorkflowInstanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Update workflow instance (Manager+ access)"""
    workflow_service = WorkflowService(db)
    instance = workflow_service.get_workflow_instance(instance_id)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found"
        )
    
    # Update instance fields (this would need to be implemented in service)
    # For now, return a simple response
    return WorkflowInstanceResponse.model_validate(instance)


@router.get("/documents/{document_id}/instances", response_model=WorkflowInstanceList)
def get_document_workflows(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get all workflow instances for a document"""
    workflow_service = WorkflowService(db)
    instances = workflow_service.get_document_workflows(document_id)
    
    # Filter based on user permissions
    if not current_user.has_permission("read"):
        instances = [
            inst for inst in instances 
            if inst.initiated_by == current_user.id or 
            any(step.assigned_to == current_user.id for step in inst.step_instances)
        ]
    
    instance_responses = [WorkflowInstanceResponse.model_validate(inst) for inst in instances]
    
    return WorkflowInstanceList(
        instances=instance_responses,
        total=len(instance_responses),
        skip=0,
        limit=len(instance_responses)
    )


# Approval Management
@router.get("/approvals/pending", response_model=List[WorkflowStepInstanceResponse])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get pending approvals for current user"""
    workflow_service = WorkflowService(db)
    pending_steps = workflow_service.get_user_pending_approvals(current_user.id)
    
    return [WorkflowStepInstanceResponse.model_validate(step) for step in pending_steps]


@router.post("/approvals/{step_instance_id}/action")
def process_approval(
    step_instance_id: str,
    action: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Process an approval action (approve/reject/delegate)"""
    workflow_service = WorkflowService(db)
    
    success = workflow_service.process_approval(step_instance_id, action, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to process approval. Check permissions and step status."
        )
    
    return {"message": f"Approval {action.action} processed successfully"}


@router.get("/approvals/overdue", response_model=List[WorkflowStepInstanceResponse])
def get_overdue_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Get overdue approval items (Manager+ access)"""
    workflow_service = WorkflowService(db)
    overdue_steps = workflow_service.get_overdue_approvals()
    
    return [WorkflowStepInstanceResponse.model_validate(step) for step in overdue_steps]


@router.post("/approvals/escalate-overdue")
def escalate_overdue_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Escalate overdue approvals (Admin only)"""
    workflow_service = WorkflowService(db)
    workflow_service.escalate_overdue_approvals()
    
    return {"message": "Overdue approvals escalated successfully"}


# Dashboard and Analytics
@router.get("/dashboard", response_model=WorkflowDashboard)
def get_workflow_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Get workflow dashboard data for current user"""
    workflow_service = WorkflowService(db)
    
    # Get pending approvals
    pending_approvals = workflow_service.get_user_pending_approvals(current_user.id)
    
    # Get user's workflow instances
    my_workflows = workflow_service.get_workflow_instances(
        limit=10,
        initiated_by=current_user.id
    )
    
    # Get recent completions (if user has read permission)
    recent_completions = []
    if current_user.has_permission("read"):
        recent_completions = workflow_service.get_workflow_instances(
            limit=5,
            status=WorkflowInstanceStatus.COMPLETED
        )
    
    # Get overdue items (if user is manager+)
    overdue_items = []
    if current_user.has_permission("update"):
        overdue_items = workflow_service.get_overdue_approvals()[:5]
    
    # Basic stats
    workflow_stats = {
        "pending_approvals": len(pending_approvals),
        "my_workflows": len(my_workflows),
        "recent_completions": len(recent_completions),
        "overdue_items": len(overdue_items)
    }
    
    return WorkflowDashboard(
        pending_approvals=[WorkflowStepInstanceResponse.model_validate(step) for step in pending_approvals],
        my_workflows=[WorkflowInstanceResponse.model_validate(inst) for inst in my_workflows],
        recent_completions=[WorkflowInstanceResponse.model_validate(inst) for inst in recent_completions],
        overdue_items=[WorkflowStepInstanceResponse.model_validate(step) for step in overdue_items],
        workflow_stats=workflow_stats
    )


@router.get("/analytics", response_model=WorkflowAnalytics)
def get_workflow_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Get workflow analytics (Manager+ access)"""
    workflow_service = WorkflowService(db)
    analytics = workflow_service.get_workflow_analytics()
    
    return WorkflowAnalytics(
        total_workflows=analytics["total_workflows"],
        active_workflows=analytics["active_workflows"],
        completed_instances=analytics["completed_instances"],
        average_completion_time=analytics["average_completion_time"],
        approval_rates=analytics["approval_rates"],
        bottleneck_steps=analytics["bottleneck_steps"],
        user_performance=analytics["user_performance"]
    )


# Workflow Templates (Future enhancement)
@router.get("/templates")
def get_workflow_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get workflow templates (Admin only) - Future implementation"""
    return {"message": "Workflow templates feature coming soon"}


# Health check for workflow system
@router.get("/health")
def workflow_health_check():
    """Check workflow system health"""
    return {
        "status": "healthy",
        "service": "workflow_management",
        "features": [
            "workflow_definitions",
            "workflow_execution", 
            "approval_processing",
            "escalation_system",
            "analytics_engine"
        ]
    }