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
from app.services.notification_service import (
    NotificationService, 
    notify_workflow_assignment,
    notify_document_shared
)
from app.models.notification import NotificationType, NotificationPriority
import uuid


class WorkflowService:
    """Service layer for workflow operations"""
    
    def __init__(self, db: Session):
        if db is None:
            raise ValueError("Database session cannot be None")
        self.db = db
    
    # Workflow Definition Management
    def create_workflow(self, workflow_data: WorkflowCreate, created_by: str) -> Workflow:
        """Create a new workflow definition"""
        # Validate workflow name
        if not workflow_data.name or workflow_data.name.strip() == "":
            raise ValueError("Workflow name cannot be empty")

        # Check for duplicate name
        existing = self.db.query(Workflow).filter(Workflow.name == workflow_data.name).first()
        if existing:
            raise ValueError("Workflow definition with this name already exists")

        try:
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
        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to create workflow: {e}")
    
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
        
        # Send workflow assignment notifications
        self._send_workflow_notifications(instance.id, "started")
        
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
            self._send_workflow_notifications(step_instance.workflow_instance_id, "approved", step_instance)
        elif action.action == "reject":
            step_instance.status = StepInstanceStatus.REJECTED
            self._reject_workflow(step_instance.workflow_instance_id, action.comments)
            self._send_workflow_notifications(step_instance.workflow_instance_id, "rejected", step_instance)
        elif action.action == "delegate":
            if action.delegate_to:
                step_instance.delegated_to = action.delegate_to
                step_instance.delegated_at = datetime.utcnow()
                step_instance.delegation_reason = action.delegation_reason
                step_instance.assigned_to = action.delegate_to
                self._send_workflow_notifications(step_instance.workflow_instance_id, "delegated", step_instance)
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
            self._send_workflow_notifications(workflow_instance_id, "completed")
        else:
            # Create next step instances
            for step in next_steps:
                self._create_step_instance(instance.id, step)
            instance.current_step_order = next_step_order
            self._send_workflow_notifications(workflow_instance_id, "advanced")
        
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
                
                # Send escalation notification
                self._send_workflow_notifications(step_instance.workflow_instance_id, "escalated", step_instance)
        
        self.db.commit()
    
    # Enhanced Monitoring and Reporting Methods
    def get_workflow_performance_metrics(self, workflow_id: str) -> Dict[str, Any]:
        """Get performance metrics for a specific workflow"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return {}
        
        instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.workflow_id == workflow_id
        ).all()
        
        if not instances:
            return {
                "completion_rate": 0,
                "average_completion_time": 0,
                "bottleneck_steps": [],
                "step_performance": {}
            }
        
        completed = [i for i in instances if i.status == WorkflowInstanceStatus.COMPLETED]
        completion_rate = len(completed) / len(instances) * 100
        
        # Calculate average completion time
        if completed:
            completion_times = []
            for instance in completed:
                if instance.completed_at:
                    duration = instance.completed_at - instance.initiated_at
                    completion_times.append(duration.total_seconds() / 3600)
            avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0
        else:
            avg_completion_time = 0
        
        # Analyze step performance
        step_performance = {}
        for step in workflow.steps:
            step_instances = []
            for instance in instances:
                step_inst = next((si for si in instance.step_instances if si.step_id == step.id), None)
                if step_inst:
                    step_instances.append(step_inst)
            
            if step_instances:
                completed_steps = [s for s in step_instances if s.status == StepInstanceStatus.APPROVED]
                avg_step_time = 0
                if completed_steps:
                    step_times = []
                    for s in completed_steps:
                        if s.completed_at and s.started_at:
                            duration = s.completed_at - s.started_at
                            step_times.append(duration.total_seconds() / 3600)
                    avg_step_time = sum(step_times) / len(step_times) if step_times else 0
                
                step_performance[step.name] = {
                    "completion_rate": len(completed_steps) / len(step_instances) * 100,
                    "average_time": avg_step_time,
                    "total_instances": len(step_instances)
                }
        
        return {
            "completion_rate": completion_rate,
            "average_completion_time": avg_completion_time,
            "bottleneck_steps": self._identify_bottleneck_steps(workflow_id),
            "step_performance": step_performance
        }
    
    def get_approval_rate_analytics(self) -> Dict[str, Any]:
        """Get comprehensive approval rate analytics"""
        all_step_instances = self.db.query(WorkflowStepInstance).all()
        
        if not all_step_instances:
            return {
                "overall_approval_rate": 0,
                "rejection_rate": 0,
                "delegation_rate": 0,
                "step_approval_rates": {}
            }
        
        completed_steps = [s for s in all_step_instances if s.status in [
            StepInstanceStatus.APPROVED, StepInstanceStatus.REJECTED
        ]]
        
        if not completed_steps:
            return {
                "overall_approval_rate": 0,
                "rejection_rate": 0,
                "delegation_rate": 0,
                "step_approval_rates": {}
            }
        
        approved = len([s for s in completed_steps if s.status == StepInstanceStatus.APPROVED])
        rejected = len([s for s in completed_steps if s.status == StepInstanceStatus.REJECTED])
        delegated = len([s for s in all_step_instances if s.escalated])
        
        overall_approval_rate = approved / len(completed_steps) * 100
        rejection_rate = rejected / len(completed_steps) * 100
        delegation_rate = delegated / len(all_step_instances) * 100
        
        # Step-specific approval rates
        step_approval_rates = {}
        step_groups = {}
        for step_instance in completed_steps:
            if step_instance.step:
                step_name = step_instance.step.name
                if step_name not in step_groups:
                    step_groups[step_name] = []
                step_groups[step_name].append(step_instance)
        
        for step_name, instances in step_groups.items():
            approved_count = len([s for s in instances if s.status == StepInstanceStatus.APPROVED])
            step_approval_rates[step_name] = approved_count / len(instances) * 100
        
        return {
            "overall_approval_rate": overall_approval_rate,
            "rejection_rate": rejection_rate,
            "delegation_rate": delegation_rate,
            "step_approval_rates": step_approval_rates
        }
    
    def get_bottleneck_analysis(self) -> Dict[str, Any]:
        """Get bottleneck identification and analysis"""
        # Get all active and recently completed workflow instances
        recent_date = datetime.utcnow() - timedelta(days=30)
        instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.initiated_at >= recent_date
        ).all()
        
        slow_steps = []
        overdue_frequency = {}
        escalation_patterns = []
        
        # Analyze step performance to identify bottlenecks
        step_times = {}
        for instance in instances:
            for step_instance in instance.step_instances:
                if step_instance.step and step_instance.completed_at and step_instance.started_at:
                    step_name = step_instance.step.name
                    duration = step_instance.completed_at - step_instance.started_at
                    duration_hours = duration.total_seconds() / 3600
                    
                    if step_name not in step_times:
                        step_times[step_name] = []
                    step_times[step_name].append(duration_hours)
        
        # Identify slow steps (above 75th percentile)
        for step_name, times in step_times.items():
            if len(times) > 1:
                times.sort()
                p75_index = int(len(times) * 0.75)
                p75_time = times[p75_index]
                avg_time = sum(times) / len(times)
                
                if avg_time > 24:  # More than 24 hours average
                    slow_steps.append({
                        "step_name": step_name,
                        "average_time_hours": avg_time,
                        "p75_time_hours": p75_time,
                        "instance_count": len(times)
                    })
        
        # Analyze overdue frequency
        overdue_steps = self.get_overdue_approvals()
        for step in overdue_steps:
            if step.step:
                step_name = step.step.name
                overdue_frequency[step_name] = overdue_frequency.get(step_name, 0) + 1
        
        # Analyze escalation patterns
        escalated_steps = self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.escalated == True
        ).all()
        
        escalation_counts = {}
        for step in escalated_steps:
            if step.step:
                step_name = step.step.name
                escalation_counts[step_name] = escalation_counts.get(step_name, 0) + 1
        
        for step_name, count in escalation_counts.items():
            escalation_patterns.append({
                "step_name": step_name,
                "escalation_count": count,
                "pattern": "high" if count > 5 else "moderate" if count > 2 else "low"
            })
        
        # Generate recommendations
        recommendations = []
        for step in slow_steps:
            recommendations.append(f"Consider optimizing '{step['step_name']}' - average time {step['average_time_hours']:.1f} hours")
        
        for step_name, freq in overdue_frequency.items():
            if freq > 3:
                recommendations.append(f"Review timeout settings for '{step_name}' - {freq} overdue instances")
        
        return {
            "slow_steps": slow_steps,
            "overdue_frequency": overdue_frequency,
            "escalation_patterns": escalation_patterns,
            "performance_recommendations": recommendations
        }
    
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
        
        # Get detailed approval rates
        approval_rates = self.get_approval_rate_analytics()
        
        # Get bottleneck analysis
        bottleneck_analysis = self.get_bottleneck_analysis()
        
        # Get user performance summary
        user_performance = self.get_user_performance_metrics()
        
        return {
            "total_workflows": total_workflows,
            "active_workflows": active_workflows,
            "completed_instances": completed_instances,
            "average_completion_time": avg_completion_time,
            "approval_rates": approval_rates,
            "bottleneck_steps": bottleneck_analysis.get("slow_steps", []),
            "user_performance": user_performance
        }
    
    def get_user_performance_metrics(self) -> Dict[str, Any]:
        """Get user performance metrics"""
        # Get recent step instances (last 30 days)
        recent_date = datetime.utcnow() - timedelta(days=30)
        recent_steps = self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.started_at >= recent_date
        ).all()
        
        user_metrics = {}
        approval_speed = {}
        approval_quality = {}
        workload_distribution = {}
        delegation_patterns = {}
        
        # Group by user
        user_steps = {}
        for step in recent_steps:
            if step.assigned_to:
                if step.assigned_to not in user_steps:
                    user_steps[step.assigned_to] = []
                user_steps[step.assigned_to].append(step)
        
        for user_id, steps in user_steps.items():
            completed_steps = [s for s in steps if s.status == StepInstanceStatus.APPROVED]
            
            # Calculate approval speed
            if completed_steps:
                completion_times = []
                for step in completed_steps:
                    if step.completed_at and step.started_at:
                        duration = step.completed_at - step.started_at
                        completion_times.append(duration.total_seconds() / 3600)
                
                avg_speed = sum(completion_times) / len(completion_times) if completion_times else 0
                approval_speed[user_id] = avg_speed
            
            # Calculate approval quality (approval rate)
            total_decisions = len([s for s in steps if s.status in [
                StepInstanceStatus.APPROVED, StepInstanceStatus.REJECTED
            ]])
            approvals = len([s for s in steps if s.status == StepInstanceStatus.APPROVED])
            
            if total_decisions > 0:
                approval_quality[user_id] = approvals / total_decisions * 100
            
            # Workload distribution
            workload_distribution[user_id] = len(steps)
            
            # Delegation patterns
            delegated = len([s for s in steps if s.escalated])
            delegation_patterns[user_id] = {
                "delegated_count": delegated,
                "delegation_rate": delegated / len(steps) * 100 if steps else 0
            }
        
        return {
            "approval_speed": approval_speed,
            "approval_quality": approval_quality,
            "workload_distribution": workload_distribution,
            "delegation_patterns": delegation_patterns
        }
    
    def get_workflow_health_metrics(self) -> Dict[str, Any]:
        """Get workflow system health metrics"""
        now = datetime.utcnow()
        
        active_instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.status == WorkflowInstanceStatus.IN_PROGRESS
        ).count()
        
        overdue_instances = len(self.get_overdue_approvals())
        
        # Calculate error rate (rejected workflows)
        total_recent = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.initiated_at >= now - timedelta(days=7)
        ).count()
        
        rejected_recent = self.db.query(WorkflowInstance).filter(
            and_(
                WorkflowInstance.initiated_at >= now - timedelta(days=7),
                WorkflowInstance.status == WorkflowInstanceStatus.REJECTED
            )
        ).count()
        
        error_rate = rejected_recent / total_recent * 100 if total_recent > 0 else 0
        
        # System load (pending approvals per active user)
        pending_approvals = self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.status == StepInstanceStatus.IN_PROGRESS
        ).count()
        
        # Get unique assigned users
        assigned_users = set()
        active_steps = self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.status == StepInstanceStatus.IN_PROGRESS
        ).all()
        
        for step in active_steps:
            if step.assigned_to:
                assigned_users.add(step.assigned_to)
        
        system_load = pending_approvals / len(assigned_users) if assigned_users else 0
        
        return {
            "active_instances": active_instances,
            "overdue_instances": overdue_instances,
            "error_rate": error_rate,
            "system_load": system_load,
            "pending_approvals": pending_approvals,
            "active_users": len(assigned_users)
        }
    
    def get_time_based_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get time-based workflow analytics"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get instances in time range
        instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.initiated_at >= start_date
        ).all()
        
        # Daily completion trends
        daily_completions = {}
        daily_initiations = {}
        
        for instance in instances:
            init_date = instance.initiated_at.date()
            daily_initiations[str(init_date)] = daily_initiations.get(str(init_date), 0) + 1
            
            if instance.completed_at and instance.status == WorkflowInstanceStatus.COMPLETED:
                comp_date = instance.completed_at.date()
                daily_completions[str(comp_date)] = daily_completions.get(str(comp_date), 0) + 1
        
        # Peak usage hours analysis
        hourly_activity = {}
        for instance in instances:
            hour = instance.initiated_at.hour
            hourly_activity[hour] = hourly_activity.get(hour, 0) + 1
        
        peak_hours = sorted(hourly_activity.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Performance trends (completion times over time)
        weekly_performance = {}
        for instance in instances:
            if instance.completed_at and instance.status == WorkflowInstanceStatus.COMPLETED:
                week = instance.initiated_at.isocalendar()[1]
                duration = instance.completed_at - instance.initiated_at
                duration_hours = duration.total_seconds() / 3600
                
                if week not in weekly_performance:
                    weekly_performance[week] = []
                weekly_performance[week].append(duration_hours)
        
        # Calculate average for each week
        weekly_avg_performance = {}
        for week, times in weekly_performance.items():
            weekly_avg_performance[week] = sum(times) / len(times)
        
        return {
            "daily_completion_trends": daily_completions,
            "daily_initiation_trends": daily_initiations,
            "peak_usage_hours": [h[0] for h in peak_hours],
            "hourly_activity": hourly_activity,
            "weekly_performance_trends": weekly_avg_performance,
            "seasonal_patterns": self._analyze_seasonal_patterns(instances),
            "performance_trends": self._calculate_performance_trends(instances)
        }
    
    def get_document_type_analytics(self) -> Dict[str, Any]:
        """Get document type specific analytics"""
        # Group workflows by document type
        workflows_by_type = {}
        all_workflows = self.db.query(Workflow).all()
        
        for workflow in all_workflows:
            doc_type = workflow.document_type
            if doc_type not in workflows_by_type:
                workflows_by_type[doc_type] = []
            workflows_by_type[doc_type].append(workflow)
        
        type_analytics = {}
        
        for doc_type, workflows in workflows_by_type.items():
            # Get all instances for this document type
            workflow_ids = [w.id for w in workflows]
            instances = self.db.query(WorkflowInstance).filter(
                WorkflowInstance.workflow_id.in_(workflow_ids)
            ).all()
            
            if not instances:
                continue
            
            completed = [i for i in instances if i.status == WorkflowInstanceStatus.COMPLETED]
            completion_rate = len(completed) / len(instances) * 100
            
            # Average processing time
            processing_times = []
            for instance in completed:
                if instance.completed_at:
                    duration = instance.completed_at - instance.initiated_at
                    processing_times.append(duration.total_seconds() / 3600)
            
            avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
            
            # Approval patterns
            total_steps = sum(len(i.step_instances) for i in instances)
            approved_steps = sum(
                len([s for s in i.step_instances if s.status == StepInstanceStatus.APPROVED]) 
                for i in instances
            )
            
            approval_rate = approved_steps / total_steps * 100 if total_steps > 0 else 0
            
            type_analytics[doc_type] = {
                "completion_rate": completion_rate,
                "average_processing_time": avg_processing_time,
                "approval_rate": approval_rate,
                "total_instances": len(instances),
                "efficiency_score": (completion_rate + approval_rate) / 2
            }
        
        # Identify most efficient types
        sorted_types = sorted(
            type_analytics.items(), 
            key=lambda x: x[1]['efficiency_score'], 
            reverse=True
        )
        
        return {
            "completion_rates_by_type": {k: v['completion_rate'] for k, v in type_analytics.items()},
            "processing_time_by_type": {k: v['average_processing_time'] for k, v in type_analytics.items()},
            "approval_patterns_by_type": {k: v['approval_rate'] for k, v in type_analytics.items()},
            "most_efficient_types": [t[0] for t in sorted_types[:3]],
            "detailed_analytics": type_analytics
        }
    
    def generate_workflow_report(
        self, 
        start_date: datetime, 
        end_date: datetime, 
        include_recommendations: bool = True
    ) -> Dict[str, Any]:
        """Generate comprehensive workflow report"""
        # Get instances in date range
        instances = self.db.query(WorkflowInstance).filter(
            and_(
                WorkflowInstance.initiated_at >= start_date,
                WorkflowInstance.initiated_at <= end_date
            )
        ).all()
        
        # Executive summary
        total_instances = len(instances)
        completed_instances = len([i for i in instances if i.status == WorkflowInstanceStatus.COMPLETED])
        completion_rate = completed_instances / total_instances * 100 if total_instances > 0 else 0
        
        # Performance metrics
        performance_metrics = self.get_workflow_analytics()
        
        # Bottleneck analysis
        bottleneck_analysis = self.get_bottleneck_analysis()
        
        # User insights
        user_insights = self.get_user_performance_metrics()
        
        # Trend analysis
        days_in_period = (end_date - start_date).days
        trend_analysis = self.get_time_based_analytics(days_in_period)
        
        # Generate recommendations
        recommendations = []
        if include_recommendations:
            recommendations.extend(bottleneck_analysis.get('performance_recommendations', []))
            
            # Add more recommendations based on analysis
            if completion_rate < 80:
                recommendations.append("Consider reviewing workflow designs - completion rate is below 80%")
            
            if performance_metrics.get('average_completion_time', 0) > 72:
                recommendations.append("Review timeout settings - average completion time exceeds 72 hours")
            
            overdue_count = len(self.get_overdue_approvals())
            if overdue_count > 10:
                recommendations.append(f"Address {overdue_count} overdue approvals to improve system efficiency")
        
        return {
            "executive_summary": {
                "reporting_period": f"{start_date.date()} to {end_date.date()}",
                "total_instances": total_instances,
                "completed_instances": completed_instances,
                "completion_rate": completion_rate,
                "average_completion_time": performance_metrics.get('average_completion_time', 0)
            },
            "performance_metrics": performance_metrics,
            "bottleneck_analysis": bottleneck_analysis,
            "user_insights": user_insights,
            "trend_analysis": trend_analysis,
            "recommendations": recommendations,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    # Helper methods
    def _identify_bottleneck_steps(self, workflow_id: str) -> List[str]:
        """Identify bottleneck steps in a specific workflow"""
        instances = self.db.query(WorkflowInstance).filter(
            WorkflowInstance.workflow_id == workflow_id
        ).all()
        
        step_times = {}
        for instance in instances:
            for step_instance in instance.step_instances:
                if step_instance.step and step_instance.completed_at and step_instance.started_at:
                    step_name = step_instance.step.name
                    duration = step_instance.completed_at - step_instance.started_at
                    duration_hours = duration.total_seconds() / 3600
                    
                    if step_name not in step_times:
                        step_times[step_name] = []
                    step_times[step_name].append(duration_hours)
        
        # Return steps with average time > 24 hours
        bottlenecks = []
        for step_name, times in step_times.items():
            avg_time = sum(times) / len(times)
            if avg_time > 24:  # More than 24 hours
                bottlenecks.append(step_name)
        
        return bottlenecks
    
    def _analyze_seasonal_patterns(self, instances: List[WorkflowInstance]) -> Dict[str, Any]:
        """Analyze seasonal patterns in workflow data"""
        monthly_activity = {}
        
        for instance in instances:
            month = instance.initiated_at.month
            monthly_activity[month] = monthly_activity.get(month, 0) + 1
        
        # Identify peak and low months
        if monthly_activity:
            peak_month = max(monthly_activity.items(), key=lambda x: x[1])
            low_month = min(monthly_activity.items(), key=lambda x: x[1])
            
            return {
                "monthly_distribution": monthly_activity,
                "peak_month": peak_month[0],
                "peak_activity": peak_month[1],
                "low_month": low_month[0],
                "low_activity": low_month[1]
            }
        
        return {"monthly_distribution": {}, "peak_month": None, "low_month": None}
    
    def _calculate_performance_trends(self, instances: List[WorkflowInstance]) -> Dict[str, Any]:
        """Calculate performance trends over time"""
        completed = [i for i in instances if i.status == WorkflowInstanceStatus.COMPLETED and i.completed_at]
        
        if len(completed) < 2:
            return {"trend": "insufficient_data", "improvement": 0}
        
        # Sort by completion date
        completed.sort(key=lambda x: x.completed_at)
        
        # Calculate completion times for first and last halves
        mid_point = len(completed) // 2
        first_half = completed[:mid_point]
        second_half = completed[mid_point:]
        
        def avg_completion_time(instances_list):
            times = []
            for instance in instances_list:
                duration = instance.completed_at - instance.initiated_at
                times.append(duration.total_seconds() / 3600)
            return sum(times) / len(times) if times else 0
        
        first_half_avg = avg_completion_time(first_half)
        second_half_avg = avg_completion_time(second_half)
        
        improvement = first_half_avg - second_half_avg
        trend = "improving" if improvement > 0 else "declining" if improvement < 0 else "stable"
        
        return {
            "trend": trend,
            "improvement_hours": improvement,
            "first_half_avg": first_half_avg,
            "second_half_avg": second_half_avg
        }
    
    def _send_workflow_notifications(
        self, 
        workflow_instance_id: str, 
        event_type: str, 
        step_instance: Optional[WorkflowStepInstance] = None
    ):
        """Send notifications for workflow events"""
        try:
            instance = self.db.query(WorkflowInstance).filter(
                WorkflowInstance.id == workflow_instance_id
            ).first()
            
            if not instance:
                return
            
            document = instance.document
            if not document:
                return
            
            notification_service = NotificationService(self.db)
            
            if event_type == "started":
                # Notify all assigned users for first steps
                first_steps = self.db.query(WorkflowStepInstance).filter(
                    and_(
                        WorkflowStepInstance.workflow_instance_id == workflow_instance_id,
                        WorkflowStepInstance.assigned_to.isnot(None)
                    )
                ).all()
                
                for step in first_steps:
                    self._create_assignment_notification(
                        notification_service, step.assigned_to, document, instance, step
                    )
            
            elif event_type == "approved" and step_instance:
                # Notify workflow initiator of approval
                self._create_status_notification(
                    notification_service, instance.initiated_by, document, instance, 
                    "approved", f"Step '{step_instance.step.name}' was approved"
                )
            
            elif event_type == "rejected" and step_instance:
                # Notify workflow initiator of rejection
                self._create_status_notification(
                    notification_service, instance.initiated_by, document, instance,
                    "rejected", f"Step '{step_instance.step.name}' was rejected"
                )
            
            elif event_type == "delegated" and step_instance:
                # Notify new assignee of delegation
                if step_instance.delegated_to:
                    self._create_assignment_notification(
                        notification_service, step_instance.delegated_to, document, instance, step_instance
                    )
            
            elif event_type == "escalated" and step_instance:
                # Notify escalation target
                if step_instance.escalated_to:
                    self._create_escalation_notification(
                        notification_service, step_instance.escalated_to, document, instance, step_instance
                    )
            
            elif event_type == "completed":
                # Notify workflow initiator of completion
                self._create_status_notification(
                    notification_service, instance.initiated_by, document, instance,
                    "completed", "Workflow has been completed successfully"
                )
            
            elif event_type == "advanced":
                # Notify newly assigned users for next steps
                current_steps = self.db.query(WorkflowStepInstance).filter(
                    and_(
                        WorkflowStepInstance.workflow_instance_id == workflow_instance_id,
                        WorkflowStepInstance.status == StepInstanceStatus.IN_PROGRESS,
                        WorkflowStepInstance.assigned_to.isnot(None)
                    )
                ).all()
                
                for step in current_steps:
                    if step.started_at and (datetime.utcnow() - step.started_at).seconds < 300:  # New within 5 minutes
                        self._create_assignment_notification(
                            notification_service, step.assigned_to, document, instance, step
                        )
                        
        except Exception as e:
            # Log error but don't break workflow execution
            print(f"Error sending workflow notifications: {str(e)}")
    
    def _create_assignment_notification(
        self, 
        notification_service: NotificationService,
        user_id: str,
        document: Document,
        instance: WorkflowInstance,
        step_instance: WorkflowStepInstance
    ):
        """Create workflow assignment notification"""
        try:
            notification_service.create_notification(
                user_id=user_id,
                template_name="workflow_assigned",
                template_variables={
                    "document_title": document.title,
                    "workflow_type": instance.workflow.name,
                    "step_name": step_instance.step.name,
                    "due_date": step_instance.due_date.strftime("%B %d, %Y") if step_instance.due_date else "No due date",
                    "assigned_by": instance.initiated_by,
                    "instructions": step_instance.step.instructions or "Please review and approve"
                },
                notification_type=NotificationType.EMAIL,
                priority=NotificationPriority.HIGH,
                context_data={
                    "event_type": "workflow_assigned",
                    "document_title": document.title,
                    "workflow_instance_id": instance.id,
                    "step_instance_id": step_instance.id
                }
            )
        except Exception as e:
            print(f"Error creating assignment notification: {str(e)}")
    
    def _create_status_notification(
        self,
        notification_service: NotificationService,
        user_id: str,
        document: Document,
        instance: WorkflowInstance,
        status: str,
        message: str
    ):
        """Create workflow status notification"""
        try:
            template_name = f"workflow_{status}"
            priority = NotificationPriority.HIGH if status == "rejected" else NotificationPriority.NORMAL
            
            notification_service.create_notification(
                user_id=user_id,
                template_name=template_name,
                template_variables={
                    "document_title": document.title,
                    "workflow_type": instance.workflow.name,
                    "message": message,
                    "status": status.title()
                },
                notification_type=NotificationType.EMAIL,
                priority=priority,
                context_data={
                    "event_type": f"workflow_{status}",
                    "document_title": document.title,
                    "workflow_instance_id": instance.id
                }
            )
        except Exception as e:
            print(f"Error creating status notification: {str(e)}")
    
    def _create_escalation_notification(
        self,
        notification_service: NotificationService,
        user_id: str,
        document: Document,
        instance: WorkflowInstance,
        step_instance: WorkflowStepInstance
    ):
        """Create workflow escalation notification"""
        try:
            notification_service.create_notification(
                user_id=user_id,
                template_name="workflow_escalated",
                template_variables={
                    "document_title": document.title,
                    "workflow_type": instance.workflow.name,
                    "step_name": step_instance.step.name,
                    "original_assignee": step_instance.delegated_to or "Previous assignee",
                    "escalation_reason": "Overdue approval",
                    "due_date": step_instance.due_date.strftime("%B %d, %Y") if step_instance.due_date else "No due date"
                },
                notification_type=NotificationType.EMAIL,
                priority=NotificationPriority.HIGH,
                context_data={
                    "event_type": "workflow_escalated",
                    "document_title": document.title,
                    "workflow_instance_id": instance.id,
                    "step_instance_id": step_instance.id
                }
            )
        except Exception as e:
            print(f"Error creating escalation notification: {str(e)}")