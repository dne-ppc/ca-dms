"""
Escalation Service for CA-DMS

Handles automated escalation of workflow steps with custom triggers and conditions.
Supports business hours, priority-based escalation, and multi-level escalation chains.
"""

import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.workflow_conditions import (
    EscalationRule, EscalationInstance, WorkflowConditionGroup, 
    ConditionType, LogicalOperator
)
from app.models.workflow import (
    WorkflowInstance, WorkflowStepInstance, StepInstanceStatus
)
from app.models.user import User
from app.services.notification_service import NotificationService
from app.services.workflow_condition_service import WorkflowConditionService
import logging

logger = logging.getLogger(__name__)


class EscalationError(Exception):
    """Exception raised during escalation processing"""
    pass


class EscalationService:
    """Service for managing automated workflow escalations"""

    def __init__(self, db: Session):
        self.db = db
        self.notification_service = NotificationService(db)
        self.condition_service = WorkflowConditionService(db)

    # =========================================================================
    # Main Escalation Processing
    # =========================================================================

    def process_escalations(self) -> Dict[str, Any]:
        """
        Process all pending escalations across all workflows.
        This should be called periodically (e.g., every 15 minutes) by a scheduler.
        """
        results = {
            "processed_escalations": 0,
            "new_escalations": 0,
            "resolved_escalations": 0,
            "errors": []
        }

        try:
            # Find step instances that may need escalation
            pending_steps = self._get_escalation_candidates()
            
            for step_instance in pending_steps:
                try:
                    escalation_result = self._evaluate_step_for_escalation(step_instance)
                    
                    if escalation_result["action"] == "escalate":
                        self._trigger_escalation(step_instance, escalation_result["rule"])
                        results["new_escalations"] += 1
                        
                    elif escalation_result["action"] == "continue":
                        self._continue_escalation(step_instance, escalation_result["instance"])
                        results["processed_escalations"] += 1
                        
                    elif escalation_result["action"] == "resolve":
                        self._resolve_escalation(escalation_result["instance"])
                        results["resolved_escalations"] += 1
                        
                except Exception as e:
                    error_msg = f"Error processing escalation for step {step_instance.id}: {str(e)}"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)

        except Exception as e:
            error_msg = f"Error in escalation processing: {str(e)}"
            logger.error(error_msg)
            results["errors"].append(error_msg)

        return results

    def _get_escalation_candidates(self) -> List[WorkflowStepInstance]:
        """Get step instances that are candidates for escalation"""
        
        # Find step instances that are pending or in progress
        return self.db.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.status.in_([StepInstanceStatus.PENDING, StepInstanceStatus.IN_PROGRESS]),
            WorkflowStepInstance.started_at.isnot(None)  # Only steps that have been started
        ).all()

    def _evaluate_step_for_escalation(self, step_instance: WorkflowStepInstance) -> Dict[str, Any]:
        """Evaluate if a step instance needs escalation"""
        
        # Check for existing active escalation
        existing_escalation = self.db.query(EscalationInstance).filter(
            EscalationInstance.step_instance_id == step_instance.id,
            EscalationInstance.status == "active"
        ).first()

        # Get escalation rules for this step
        escalation_rules = self._get_applicable_escalation_rules(step_instance)
        
        if existing_escalation:
            # Check if escalation should continue
            return self._evaluate_existing_escalation(existing_escalation)
        else:
            # Check if escalation should be triggered
            for rule in escalation_rules:
                if self._should_trigger_escalation(step_instance, rule):
                    return {"action": "escalate", "rule": rule}
                    
        return {"action": "none"}

    def _should_trigger_escalation(self, step_instance: WorkflowStepInstance, rule: EscalationRule) -> bool:
        """Determine if escalation should be triggered for a step"""
        
        # Time-based trigger
        if rule.trigger_after_hours:
            time_elapsed = datetime.utcnow() - step_instance.started_at
            hours_elapsed = time_elapsed.total_seconds() / 3600
            
            if hours_elapsed >= rule.trigger_after_hours:
                # Check business hours restriction
                if rule.business_hours_only and not self._is_business_hours():
                    return False
                    
                # Check weekend restriction
                if rule.exclude_weekends and self._is_weekend():
                    return False
                    
                return True

        # Condition-based trigger
        if rule.trigger_conditions:
            workflow_instance = step_instance.workflow_instance
            context = {
                "step_started_at": step_instance.started_at.isoformat(),
                "hours_elapsed": (datetime.utcnow() - step_instance.started_at).total_seconds() / 3600,
                "step_status": step_instance.status.value,
                "assigned_to": step_instance.assigned_to
            }
            
            # Evaluate custom trigger conditions
            return self._evaluate_trigger_conditions(rule.trigger_conditions, workflow_instance, context)

        return False

    def _evaluate_trigger_conditions(
        self, 
        trigger_conditions: Dict[str, Any], 
        workflow_instance: WorkflowInstance,
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate complex trigger conditions"""
        
        # Simple condition evaluation - can be extended
        condition_type = trigger_conditions.get("type", "time")
        
        if condition_type == "time":
            hours_threshold = trigger_conditions.get("hours", 24)
            hours_elapsed = context.get("hours_elapsed", 0)
            return hours_elapsed >= hours_threshold
            
        elif condition_type == "document_value":
            field_path = trigger_conditions.get("field_path")
            expected_value = trigger_conditions.get("expected_value")
            
            if field_path:
                document = workflow_instance.document
                actual_value = self._get_document_field_value(document, field_path)
                return actual_value == expected_value
                
        elif condition_type == "approval_count":
            required_count = trigger_conditions.get("required_count", 1)
            actual_count = self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.workflow_instance_id == workflow_instance.id,
                WorkflowStepInstance.decision == "approved"
            ).count()
            return actual_count < required_count
            
        return False

    # =========================================================================
    # Escalation Execution
    # =========================================================================

    def _trigger_escalation(self, step_instance: WorkflowStepInstance, rule: EscalationRule) -> None:
        """Trigger a new escalation for a step instance"""
        
        logger.info(f"Triggering escalation for step {step_instance.id} using rule {rule.name}")
        
        # Create escalation instance
        escalation_instance = EscalationInstance(
            escalation_rule_id=rule.id,
            workflow_instance_id=step_instance.workflow_instance_id,
            step_instance_id=step_instance.id,
            current_level=0,
            status="active",
            escalation_reason=f"Escalation triggered by rule: {rule.name}",
            escalation_history=[]
        )
        
        self.db.add(escalation_instance)
        self.db.flush()  # Get the ID
        
        # Execute first level escalation
        self._execute_escalation_level(escalation_instance, rule)
        
        self.db.commit()

    def _continue_escalation(self, step_instance: WorkflowStepInstance, escalation_instance: EscalationInstance) -> None:
        """Continue an existing escalation to the next level"""
        
        rule = escalation_instance.escalation_rule
        
        # Check if we can escalate to next level
        if escalation_instance.current_level < rule.max_escalation_levels - 1:
            escalation_instance.current_level += 1
            self._execute_escalation_level(escalation_instance, rule)
            self.db.commit()
            
            logger.info(f"Escalated step {step_instance.id} to level {escalation_instance.current_level}")
        else:
            # Max escalation reached
            if rule.auto_approve_after_escalation:
                self._auto_approve_step(step_instance)
                self._resolve_escalation(escalation_instance)
                logger.info(f"Auto-approved step {step_instance.id} after max escalation")
            else:
                logger.warning(f"Max escalation reached for step {step_instance.id}")

    def _execute_escalation_level(self, escalation_instance: EscalationInstance, rule: EscalationRule) -> None:
        """Execute escalation for a specific level"""
        
        level = escalation_instance.current_level
        escalation_chain = rule.escalation_chain
        
        if not isinstance(escalation_chain, list) or level >= len(escalation_chain):
            raise EscalationError(f"Invalid escalation chain or level {level}")
            
        escalation_target = escalation_chain[level]
        
        # Update escalation instance
        escalation_instance.last_escalated_at = datetime.utcnow()
        
        # Record escalation in history
        history_entry = {
            "level": level,
            "escalated_at": datetime.utcnow().isoformat(),
            "target": escalation_target,
            "reason": f"Escalation level {level}"
        }
        
        current_history = escalation_instance.escalation_history or []
        current_history.append(history_entry)
        escalation_instance.escalation_history = current_history
        
        # Execute escalation action
        if isinstance(escalation_target, dict):
            if escalation_target.get("type") == "user":
                self._escalate_to_user(escalation_instance, escalation_target["user_id"])
            elif escalation_target.get("type") == "role":
                self._escalate_to_role(escalation_instance, escalation_target["role"])
            elif escalation_target.get("type") == "manager":
                self._escalate_to_manager(escalation_instance)
        elif isinstance(escalation_target, str):
            # Assume it's a user ID
            self._escalate_to_user(escalation_instance, escalation_target)
            
        # Send escalation notification
        self._send_escalation_notification(escalation_instance, escalation_target)
        
        # Apply priority multiplier if specified
        if rule.priority_multiplier != 1.0:
            workflow_instance = escalation_instance.workflow_instance
            current_priority = workflow_instance.priority or 0
            new_priority = int(current_priority * rule.priority_multiplier)
            workflow_instance.priority = min(new_priority, 10)  # Cap at 10

    def _escalate_to_user(self, escalation_instance: EscalationInstance, user_id: str) -> None:
        """Escalate step to a specific user"""
        
        step_instance = escalation_instance.step_instance
        
        # Update step assignment
        step_instance.assigned_to = user_id
        step_instance.escalated = True
        step_instance.escalated_at = datetime.utcnow()
        step_instance.escalated_to = user_id
        
        # Update escalation instance
        escalation_instance.escalated_to = user_id
        
        logger.info(f"Escalated step {step_instance.id} to user {user_id}")

    def _escalate_to_role(self, escalation_instance: EscalationInstance, role: str) -> None:
        """Escalate step to any user with a specific role"""
        
        # Find users with the specified role
        users_with_role = self.db.query(User).filter(User.role == role).all()
        
        if not users_with_role:
            raise EscalationError(f"No users found with role {role}")
            
        # Select the first available user (could be enhanced with load balancing)
        selected_user = users_with_role[0]
        
        self._escalate_to_user(escalation_instance, selected_user.id)
        
        logger.info(f"Escalated step {escalation_instance.step_instance_id} to role {role} (user {selected_user.id})")

    def _escalate_to_manager(self, escalation_instance: EscalationInstance) -> None:
        """Escalate step to the manager of current assignee"""
        
        step_instance = escalation_instance.step_instance
        
        if not step_instance.assigned_to:
            raise EscalationError("Cannot escalate to manager: no current assignee")
            
        # Get current assignee
        current_assignee = self.db.query(User).filter(User.id == step_instance.assigned_to).first()
        
        if not current_assignee or not current_assignee.manager_id:
            raise EscalationError("Cannot escalate to manager: manager not found")
            
        self._escalate_to_user(escalation_instance, current_assignee.manager_id)
        
        logger.info(f"Escalated step {step_instance.id} to manager {current_assignee.manager_id}")

    def _send_escalation_notification(
        self, 
        escalation_instance: EscalationInstance, 
        escalation_target: Dict[str, Any]
    ) -> None:
        """Send notification about escalation"""
        
        step_instance = escalation_instance.step_instance
        workflow_instance = escalation_instance.workflow_instance
        
        # Prepare notification data
        notification_data = {
            "escalation_level": escalation_instance.current_level,
            "step_name": step_instance.step.name,
            "document_title": workflow_instance.document.title,
            "workflow_name": workflow_instance.workflow.name,
            "escalation_reason": escalation_instance.escalation_reason,
            "original_due_date": step_instance.due_date.isoformat() if step_instance.due_date else None,
            "escalated_at": escalation_instance.last_escalated_at.isoformat()
        }
        
        # Send notification to escalated user
        if escalation_instance.escalated_to:
            self.notification_service.send_notification(
                user_id=escalation_instance.escalated_to,
                notification_type="workflow_escalation",
                title="Workflow Step Escalated",
                message=f"Step '{step_instance.step.name}' has been escalated to you",
                data=notification_data
            )

    # =========================================================================
    # Escalation Resolution
    # =========================================================================

    def _resolve_escalation(self, escalation_instance: EscalationInstance) -> None:
        """Resolve an active escalation"""
        
        escalation_instance.status = "resolved"
        escalation_instance.resolved_at = datetime.utcnow()
        escalation_instance.resolution_method = "step_completed"
        
        logger.info(f"Resolved escalation {escalation_instance.id}")

    def _auto_approve_step(self, step_instance: WorkflowStepInstance) -> None:
        """Auto-approve a step after maximum escalation"""
        
        step_instance.status = StepInstanceStatus.APPROVED
        step_instance.decision = "approved"
        step_instance.completed_at = datetime.utcnow()
        step_instance.comments = "Auto-approved after escalation timeout"
        
        logger.info(f"Auto-approved step {step_instance.id} after escalation")

    def _evaluate_existing_escalation(self, escalation_instance: EscalationInstance) -> Dict[str, Any]:
        """Evaluate an existing escalation to determine next action"""
        
        rule = escalation_instance.escalation_rule
        step_instance = escalation_instance.step_instance
        
        # Check if step has been completed
        if step_instance.status in [StepInstanceStatus.APPROVED, StepInstanceStatus.REJECTED]:
            return {"action": "resolve", "instance": escalation_instance}
            
        # Check if it's time for next escalation level
        if escalation_instance.last_escalated_at:
            notification_intervals = rule.notification_intervals or [24, 48, 72]  # Default intervals in hours
            level = escalation_instance.current_level
            
            if level < len(notification_intervals):
                hours_since_escalation = (datetime.utcnow() - escalation_instance.last_escalated_at).total_seconds() / 3600
                
                if hours_since_escalation >= notification_intervals[level]:
                    return {"action": "continue", "instance": escalation_instance}
                    
        return {"action": "none", "instance": escalation_instance}

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _get_applicable_escalation_rules(self, step_instance: WorkflowStepInstance) -> List[EscalationRule]:
        """Get escalation rules applicable to a step instance"""
        
        workflow_instance = step_instance.workflow_instance
        
        return self.db.query(EscalationRule).filter(
            EscalationRule.is_active == True,
            or_(
                and_(
                    EscalationRule.workflow_id == workflow_instance.workflow_id,
                    EscalationRule.step_id.is_(None)
                ),
                EscalationRule.step_id == step_instance.step_id
            )
        ).all()

    def _is_business_hours(self) -> bool:
        """Check if current time is within business hours (9 AM - 5 PM, Mon-Fri UTC)"""
        now = datetime.utcnow()
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        hour = now.hour
        
        return weekday < 5 and 9 <= hour < 17

    def _is_weekend(self) -> bool:
        """Check if current day is weekend"""
        now = datetime.utcnow()
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        return weekday >= 5

    def _get_document_field_value(self, document, field_path: str) -> Any:
        """Get value from document field using path notation"""
        
        if field_path.startswith("metadata."):
            field_name = field_path.split(".", 1)[1]
            return getattr(document, field_name, None)
        elif field_path.startswith("content."):
            content = document.content or {}
            path_parts = field_path.split(".")[1:]
            
            current = content
            for part in path_parts:
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    return None
            return current
        else:
            return getattr(document, field_path, None)

    # =========================================================================
    # Public API Methods
    # =========================================================================

    def create_escalation_rule(
        self,
        workflow_id: str,
        step_id: Optional[str],
        rule_data: Dict[str, Any]
    ) -> EscalationRule:
        """Create a new escalation rule"""
        
        escalation_rule = EscalationRule(
            workflow_id=workflow_id,
            step_id=step_id,
            name=rule_data["name"],
            description=rule_data.get("description"),
            trigger_after_hours=rule_data.get("trigger_after_hours"),
            trigger_conditions=rule_data.get("trigger_conditions"),
            escalation_chain=rule_data["escalation_chain"],
            notification_intervals=rule_data.get("notification_intervals"),
            max_escalation_levels=rule_data.get("max_escalation_levels", 3),
            business_hours_only=rule_data.get("business_hours_only", False),
            exclude_weekends=rule_data.get("exclude_weekends", False),
            auto_approve_after_escalation=rule_data.get("auto_approve_after_escalation", False),
            priority_multiplier=rule_data.get("priority_multiplier", 1.0)
        )
        
        self.db.add(escalation_rule)
        self.db.commit()
        
        return escalation_rule

    def get_escalation_statistics(self, workflow_id: Optional[str] = None) -> Dict[str, Any]:
        """Get escalation statistics for monitoring"""
        
        base_query = self.db.query(EscalationInstance)
        
        if workflow_id:
            base_query = base_query.join(WorkflowInstance).filter(
                WorkflowInstance.workflow_id == workflow_id
            )
            
        total_escalations = base_query.count()
        active_escalations = base_query.filter(EscalationInstance.status == "active").count()
        resolved_escalations = base_query.filter(EscalationInstance.status == "resolved").count()
        
        # Average escalation resolution time
        resolved_instances = base_query.filter(
            EscalationInstance.status == "resolved",
            EscalationInstance.resolved_at.isnot(None)
        ).all()
        
        if resolved_instances:
            total_resolution_time = sum([
                (inst.resolved_at - inst.triggered_at).total_seconds()
                for inst in resolved_instances
            ])
            avg_resolution_hours = (total_resolution_time / len(resolved_instances)) / 3600
        else:
            avg_resolution_hours = 0
            
        return {
            "total_escalations": total_escalations,
            "active_escalations": active_escalations,
            "resolved_escalations": resolved_escalations,
            "resolution_rate": resolved_escalations / total_escalations if total_escalations > 0 else 0,
            "average_resolution_hours": round(avg_resolution_hours, 2)
        }