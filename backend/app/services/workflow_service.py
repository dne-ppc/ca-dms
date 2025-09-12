"""
Workflow service layer for managing approval workflows
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from app.models.workflow import (
    Workflow, 
    WorkflowStep, 
    WorkflowInstance, 
    WorkflowStepInstance,
    WorkflowStatus,
    WorkflowInstanceStatus,
    StepInstanceStatus,
    WorkflowStepType
)
from app.models.user import User, UserRole
from app.models.document import Document
from app.schemas.workflow import (
    WorkflowCreate, 
    WorkflowUpdate,
    WorkflowInstanceCreate,
    ApprovalAction
)
import uuid


class WorkflowService:
    """Service layer for workflow operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # Workflow Definition Management
    def create_workflow(self, workflow_data: WorkflowCreate, created_by: str) -> Workflow:
        """Create a new workflow definition"""
        # Create workflow
        workflow = Workflow(
            id=str(uuid.uuid4()),
            name=workflow_data.name,
            description=workflow_data.description,
            document_type=workflow_data.document_type,
            trigger_conditions=workflow_data.trigger_conditions,
            status=workflow_data.status,
            is_default=workflow_data.is_default,
            created_by=created_by
        )
        
        self.db.add(workflow)
        self.db.flush()  # Get the workflow ID
        
        # Create workflow steps
        for step_data in workflow_data.steps:
            step = WorkflowStep(
                id=str(uuid.uuid4()),
                workflow_id=workflow.id,
                name=step_data.name,
                description=step_data.description,
                step_type=step_data.step_type,
                step_order=step_data.step_order,
                required_role=step_data.required_role,
                required_users=step_data.required_users,
                required_approvals=step_data.required_approvals,
                allow_delegation=step_data.allow_delegation,
                is_parallel=step_data.is_parallel,
                timeout_hours=step_data.timeout_hours,
                escalation_users=step_data.escalation_users,
                auto_approve_conditions=step_data.auto_approve_conditions,
                instructions=step_data.instructions,
                form_fields=step_data.form_fields
            )
            self.db.add(step)
        
        self.db.commit()
        self.db.refresh(workflow)
        return workflow
    
    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a workflow by ID"""
        return self.db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    def get_workflows(
        self, 
        skip: int = 0, 
        limit: int = 100,
        document_type: Optional[str] = None,
        status: Optional[WorkflowStatus] = None
    ) -> List[Workflow]:
        """Get workflows with optional filtering"""
        query = self.db.query(Workflow)
        
        if document_type:
            query = query.filter(Workflow.document_type == document_type)
        
        if status:
            query = query.filter(Workflow.status == status)
        
        return query.order_by(desc(Workflow.created_at)).offset(skip).limit(limit).all()
    
    def get_default_workflow(self, document_type: str) -> Optional[Workflow]:
        """Get the default workflow for a document type"""
        return self.db.query(Workflow).filter(
            and_(
                Workflow.document_type == document_type,
                Workflow.is_default == True,
                Workflow.status == WorkflowStatus.ACTIVE
            )
        ).first()
    
    def update_workflow(self, workflow_id: str, workflow_data: WorkflowUpdate, updated_by: str) -> Optional[Workflow]:
        """Update a workflow definition"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return None
        
        # Update workflow fields
        update_data = workflow_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(workflow, field, value)
        
        workflow.updated_by = updated_by
        workflow.version += 1
        
        self.db.commit()
        self.db.refresh(workflow)
        return workflow
    
    def activate_workflow(self, workflow_id: str, updated_by: str) -> bool:
        """Activate a workflow"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return False
        
        workflow.status = WorkflowStatus.ACTIVE
        workflow.updated_by = updated_by
        
        self.db.commit()
        return True
    
    # Workflow Execution Engine
    def start_workflow(self, document_id: str, workflow_id: Optional[str] = None, initiated_by: str = None, **kwargs) -> Optional[WorkflowInstance]:
        """Start a workflow for a document"""
        # Get document
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return None
        
        # Get workflow (use default if not specified)
        if workflow_id:
            workflow = self.get_workflow(workflow_id)
        else:
            workflow = self.get_default_workflow(document.document_type)
        
        if not workflow or workflow.status != WorkflowStatus.ACTIVE:
            return None
        
        # Create workflow instance
        instance = WorkflowInstance(
            id=str(uuid.uuid4()),
            workflow_id=workflow.id,
            document_id=document_id,
            initiated_by=initiated_by or document.created_by,
            status=WorkflowInstanceStatus.PENDING,
            context_data=kwargs.get('context_data'),
            priority=kwargs.get('priority', 0),
            due_date=kwargs.get('due_date'),
            notes=kwargs.get('notes')
        )
        
        self.db.add(instance)
        self.db.flush()  # Get instance ID
        
        # Create step instances for the first step(s)
        first_steps = [step for step in workflow.steps if step.step_order == 1]
        
        for step in first_steps:
            self._create_step_instance(instance.id, step)
        
        # Update instance status to in progress
        instance.status = WorkflowInstanceStatus.IN_PROGRESS
        
        self.db.commit()
        self.db.refresh(instance)
        return instance
    
    def _create_step_instance(self, workflow_instance_id: str, step: WorkflowStep) -> WorkflowStepInstance:
        """Create a step instance and assign it"""
        step_instance = WorkflowStepInstance(
            id=str(uuid.uuid4()),
            workflow_instance_id=workflow_instance_id,
            step_id=step.id,
            status=StepInstanceStatus.PENDING
        )
        
        # Assign step based on configuration
        assignee = self._get_step_assignee(step)
        if assignee:
            step_instance.assigned_to = assignee
            step_instance.status = StepInstanceStatus.IN_PROGRESS
            step_instance.started_at = datetime.utcnow()
        
        # Set due date if timeout is configured
        if step.timeout_hours:
            step_instance.due_date = datetime.utcnow() + timedelta(hours=step.timeout_hours)
        
        self.db.add(step_instance)
        return step_instance
    
    def _get_step_assignee(self, step: WorkflowStep) -> Optional[str]:
        """Determine who should be assigned to a step"""
        # If specific users are required, assign to first available
        if step.required_users:
            # TODO: Add logic to find available user or round-robin assignment
            return step.required_users[0] if step.required_users else None
        
        # If role is required, find users with that role
        if step.required_role:
            user = self.db.query(User).filter(
                and_(User.role == step.required_role, User.is_active == True)
            ).first()
            return user.id if user else None
        
        return None
    
    def process_approval(self, step_instance_id: str, action: ApprovalAction, user_id: str) -> bool:
        """Process an approval action"""
        step_instance = self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.id == step_instance_id
        ).first()
        
        if not step_instance or step_instance.assigned_to != user_id:
            return False
        
        # Update step instance
        step_instance.decision = action.action
        step_instance.comments = action.comments
        step_instance.form_data = action.form_data
        step_instance.attachments = action.attachments
        step_instance.completed_at = datetime.utcnow()
        
        if action.action == "approve":
            step_instance.status = StepInstanceStatus.APPROVED
            self._advance_workflow(step_instance.workflow_instance_id)
        elif action.action == "reject":
            step_instance.status = StepInstanceStatus.REJECTED
            self._reject_workflow(step_instance.workflow_instance_id, action.comments)
        elif action.action == "delegate":
            if action.delegate_to:
                step_instance.delegated_to = action.delegate_to
                step_instance.delegated_at = datetime.utcnow()
                step_instance.delegation_reason = action.delegation_reason
                step_instance.assigned_to = action.delegate_to
                # Keep status as IN_PROGRESS for new assignee
        
        self.db.commit()
        return True
    
    def _advance_workflow(self, workflow_instance_id: str):
        """Advance workflow to next step"""
        instance = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.id == workflow_instance_id
        ).first()
        
        if not instance:
            return
        
        # Check if current step is complete
        current_steps = self.db.query(WorkflowStepInstance).filter(
            and_(
                WorkflowStepInstance.workflow_instance_id == workflow_instance_id,
                WorkflowStepInstance.step.has(WorkflowStep.step_order == instance.current_step_order)
            )
        ).all()
        
        # Check if all current steps are approved
        all_approved = all(step.status == StepInstanceStatus.APPROVED for step in current_steps)
        
        if not all_approved:
            return
        
        # Get next steps
        next_step_order = instance.current_step_order + 1
        next_steps = self.db.query(WorkflowStep).filter(
            and_(
                WorkflowStep.workflow_id == instance.workflow_id,
                WorkflowStep.step_order == next_step_order
            )
        ).all()
        
        if not next_steps:
            # Workflow is complete
            instance.status = WorkflowInstanceStatus.COMPLETED
            instance.completed_at = datetime.utcnow()
        else:
            # Create next step instances
            for step in next_steps:
                self._create_step_instance(instance.id, step)
            instance.current_step_order = next_step_order
        
        self.db.commit()
    
    def _reject_workflow(self, workflow_instance_id: str, rejection_reason: Optional[str]):
        """Reject a workflow"""
        instance = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.id == workflow_instance_id
        ).first()
        
        if instance:
            instance.status = WorkflowInstanceStatus.REJECTED
            instance.completed_at = datetime.utcnow()
            instance.rejection_reason = rejection_reason
            self.db.commit()
    
    # Query and Monitoring
    def get_workflow_instance(self, instance_id: str) -> Optional[WorkflowInstance]:
        """Get a workflow instance by ID"""
        return self.db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    def get_user_pending_approvals(self, user_id: str) -> List[WorkflowStepInstance]:
        """Get pending approvals for a user"""
        return self.db.query(WorkflowStepInstance).filter(
            and_(
                WorkflowStepInstance.assigned_to == user_id,
                WorkflowStepInstance.status == StepInstanceStatus.IN_PROGRESS
            )
        ).all()
    
    def get_document_workflows(self, document_id: str) -> List[WorkflowInstance]:
        """Get all workflow instances for a document"""
        return self.db.query(WorkflowInstance).filter(
            WorkflowInstance.document_id == document_id
        ).order_by(desc(WorkflowInstance.created_at)).all()
    
    def get_workflow_instances(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[WorkflowInstanceStatus] = None,
        initiated_by: Optional[str] = None
    ) -> List[WorkflowInstance]:
        """Get workflow instances with filtering"""
        query = self.db.query(WorkflowInstance)
        
        if status:
            query = query.filter(WorkflowInstance.status == status)
        
        if initiated_by:
            query = query.filter(WorkflowInstance.initiated_by == initiated_by)
        
        return query.order_by(desc(WorkflowInstance.created_at)).offset(skip).limit(limit).all()
    
    def get_overdue_approvals(self) -> List[WorkflowStepInstance]:
        """Get overdue approval items"""
        now = datetime.utcnow()
        return self.db.query(WorkflowStepInstance).filter(
            and_(
                WorkflowStepInstance.status == StepInstanceStatus.IN_PROGRESS,
                WorkflowStepInstance.due_date < now
            )
        ).all()
    
    def escalate_overdue_approvals(self):
        """Escalate overdue approvals"""
        overdue_items = self.get_overdue_approvals()
        
        for step_instance in overdue_items:
            if step_instance.step.escalation_users and not step_instance.escalated:
                # Escalate to first escalation user
                escalation_user = step_instance.step.escalation_users[0]
                step_instance.escalated = True
                step_instance.escalated_at = datetime.utcnow()
                step_instance.escalated_to = escalation_user
                step_instance.assigned_to = escalation_user
        
        self.db.commit()
    
    def get_workflow_analytics(self) -> Dict[str, Any]:
        """Get workflow analytics data"""
        total_workflows = self.db.query(Workflow).count()
        active_workflows = self.db.query(Workflow).filter(Workflow.status == WorkflowStatus.ACTIVE).count()
        
        completed_instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED
        ).count()
        
        # Calculate average completion time
        completed = self.db.query(WorkflowInstance).filter(
            and_(
                WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED,
                WorkflowInstance.completed_at.isnot(None)
            )
        ).all()
        
        if completed:
            completion_times = []
            for instance in completed:
                duration = instance.completed_at - instance.initiated_at
                completion_times.append(duration.total_seconds() / 3600)  # hours
            
            avg_completion_time = sum(completion_times) / len(completion_times)
        else:
            avg_completion_time = 0
        
        return {
            "total_workflows": total_workflows,
            "active_workflows": active_workflows,
            "completed_instances": completed_instances,
            "average_completion_time": avg_completion_time,
            "approval_rates": {},  # TODO: Implement detailed approval rates
            "bottleneck_steps": [],  # TODO: Implement bottleneck analysis
            "user_performance": []  # TODO: Implement user performance metrics
        }