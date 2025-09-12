"""
Workflow Condition Service for CA-DMS

Handles evaluation and execution of conditional workflow logic including:
- IF/THEN branching
- Dynamic approval routing  
- Automated escalation rules
- Custom condition evaluation
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_

from app.models.workflow_conditions import (
    WorkflowConditionGroup, WorkflowCondition, WorkflowConditionalAction,
    ConditionEvaluation, ActionExecution, EscalationRule, EscalationInstance,
    ConditionType, OperatorType, ActionType, LogicalOperator
)
from app.models.workflow import WorkflowInstance, WorkflowStepInstance
from app.models.document import Document
from app.models.user import User
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class ConditionEvaluationError(Exception):
    """Exception raised during condition evaluation"""
    pass


class ActionExecutionError(Exception):
    """Exception raised during action execution"""
    pass


class WorkflowConditionService:
    """Service for managing conditional workflow logic"""

    def __init__(self, db: Session):
        self.db = db
        self.notification_service = NotificationService(db)

    # =========================================================================
    # Condition Evaluation Methods
    # =========================================================================

    def evaluate_workflow_conditions(
        self, 
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance] = None,
        context_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate all conditions for a workflow instance and execute actions
        
        Returns:
            Dict containing evaluation results and executed actions
        """
        results = {
            "evaluated_groups": [],
            "executed_actions": [],
            "errors": []
        }

        try:
            # Get condition groups for this workflow/step
            condition_groups = self._get_condition_groups(workflow_instance, step_instance)
            
            # Merge context data
            full_context = self._build_evaluation_context(workflow_instance, step_instance, context_data)
            
            for group in condition_groups:
                try:
                    group_result = self._evaluate_condition_group(
                        group, workflow_instance, step_instance, full_context
                    )
                    results["evaluated_groups"].append(group_result)
                    
                    # Execute actions if conditions are met
                    if group_result["result"]:
                        action_results = self._execute_group_actions(
                            group, workflow_instance, step_instance, full_context
                        )
                        results["executed_actions"].extend(action_results)
                        
                except Exception as e:
                    error_msg = f"Error evaluating condition group {group.id}: {str(e)}"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)

        except Exception as e:
            error_msg = f"Error in workflow condition evaluation: {str(e)}"
            logger.error(error_msg)
            results["errors"].append(error_msg)

        return results

    def _evaluate_condition_group(
        self,
        group: WorkflowConditionGroup,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate a single condition group"""
        
        start_time = datetime.utcnow()
        condition_results = []
        
        # Evaluate individual conditions
        for condition in sorted(group.conditions, key=lambda c: c.evaluation_order):
            if not condition.is_active:
                continue
                
            condition_result = self._evaluate_single_condition(
                condition, workflow_instance, step_instance, context
            )
            condition_results.append(condition_result)
            
            # Record individual condition evaluation
            self._record_condition_evaluation(
                condition, workflow_instance, step_instance, condition_result
            )

        # Combine results using logical operator
        final_result = self._combine_condition_results(condition_results, group.logical_operator)
        
        # Record group evaluation
        group_evaluation = ConditionEvaluation(
            workflow_instance_id=workflow_instance.id,
            step_instance_id=step_instance.id if step_instance else None,
            condition_group_id=group.id,
            result=final_result,
            evaluation_details={
                "condition_count": len(condition_results),
                "individual_results": condition_results,
                "logical_operator": group.logical_operator.value,
                "stop_on_first_match": group.stop_on_first_match
            },
            execution_time_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
            context_snapshot=context
        )
        
        self.db.add(group_evaluation)
        self.db.commit()

        return {
            "group_id": group.id,
            "group_name": group.name,
            "result": final_result,
            "condition_results": condition_results,
            "execution_time_ms": group_evaluation.execution_time_ms
        }

    def _evaluate_single_condition(
        self,
        condition: WorkflowCondition,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate a single condition"""
        
        start_time = datetime.utcnow()
        
        try:
            # Get actual value based on condition type
            actual_value = self._get_condition_value(condition, workflow_instance, step_instance, context)
            
            # Perform comparison
            result = self._compare_values(actual_value, condition.expected_value, condition.operator)
            
            # Apply negation if specified
            if condition.negate_result:
                result = not result
                
            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            return {
                "condition_id": condition.id,
                "condition_name": condition.name,
                "result": result,
                "actual_value": actual_value,
                "expected_value": condition.expected_value,
                "operator": condition.operator.value,
                "negated": condition.negate_result,
                "execution_time_ms": execution_time,
                "weight": condition.weight
            }
            
        except Exception as e:
            error_msg = f"Error evaluating condition {condition.name}: {str(e)}"
            logger.error(error_msg)
            
            return {
                "condition_id": condition.id,
                "condition_name": condition.name,
                "result": False,
                "error": error_msg,
                "execution_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000)
            }

    def _get_condition_value(
        self,
        condition: WorkflowCondition,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Any:
        """Extract the actual value for condition evaluation"""
        
        if condition.condition_type == ConditionType.DOCUMENT_FIELD:
            return self._get_document_field_value(condition, workflow_instance)
            
        elif condition.condition_type == ConditionType.PLACEHOLDER_VALUE:
            return self._get_placeholder_value(condition, workflow_instance)
            
        elif condition.condition_type == ConditionType.WORKFLOW_DATA:
            return self._get_workflow_data_value(condition, workflow_instance, context)
            
        elif condition.condition_type == ConditionType.USER_ROLE:
            return self._get_user_role_value(condition, workflow_instance)
            
        elif condition.condition_type == ConditionType.DATE_TIME:
            return self._get_datetime_value(condition)
            
        elif condition.condition_type == ConditionType.APPROVAL_COUNT:
            return self._get_approval_count_value(condition, workflow_instance)
            
        elif condition.condition_type == ConditionType.DOCUMENT_SIZE:
            return self._get_document_size_value(condition, workflow_instance)
            
        elif condition.condition_type == ConditionType.CUSTOM_FUNCTION:
            return self._evaluate_custom_function(condition, workflow_instance, step_instance, context)
            
        else:
            raise ConditionEvaluationError(f"Unsupported condition type: {condition.condition_type}")

    def _get_document_field_value(self, condition: WorkflowCondition, workflow_instance: WorkflowInstance) -> Any:
        """Get value from document field using JSON path"""
        document = workflow_instance.document
        
        if not condition.field_path:
            raise ConditionEvaluationError("Field path is required for document field conditions")
        
        # Handle different field paths
        if condition.field_path.startswith("metadata."):
            field_name = condition.field_path.split(".", 1)[1]
            return getattr(document, field_name, None)
            
        elif condition.field_path.startswith("content."):
            # Navigate JSON content using dot notation
            content = document.content or {}
            path_parts = condition.field_path.split(".")[1:]  # Remove "content" prefix
            
            current = content
            for part in path_parts:
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    return None
            return current
            
        else:
            # Direct document attribute
            return getattr(document, condition.field_path, None)

    def _get_placeholder_value(self, condition: WorkflowCondition, workflow_instance: WorkflowInstance) -> Any:
        """Get value from document placeholder fields"""
        document = workflow_instance.document
        content = document.content or {}
        
        # Look for placeholder values in document content
        if "placeholders" in content:
            placeholders = content["placeholders"]
            for placeholder in placeholders:
                if placeholder.get("id") == condition.field_path:
                    return placeholder.get("value")
                    
        return None

    def _get_workflow_data_value(
        self, 
        condition: WorkflowCondition, 
        workflow_instance: WorkflowInstance, 
        context: Dict[str, Any]
    ) -> Any:
        """Get value from workflow context data"""
        if condition.field_path.startswith("context."):
            field_name = condition.field_path.split(".", 1)[1]
            return context.get(field_name)
        elif condition.field_path.startswith("instance."):
            field_name = condition.field_path.split(".", 1)[1]
            return getattr(workflow_instance, field_name, None)
        else:
            return workflow_instance.context_data.get(condition.field_path) if workflow_instance.context_data else None

    def _get_user_role_value(self, condition: WorkflowCondition, workflow_instance: WorkflowInstance) -> Any:
        """Get user role information"""
        if condition.field_path == "initiator.role":
            initiator = self.db.query(User).filter(User.id == workflow_instance.initiated_by).first()
            return initiator.role if initiator else None
        elif condition.field_path == "current_assignee.role":
            # Get current step assignee role
            current_step = self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.workflow_instance_id == workflow_instance.id,
                WorkflowStepInstance.status.in_(["pending", "in_progress"])
            ).first()
            if current_step and current_step.assigned_to:
                assignee = self.db.query(User).filter(User.id == current_step.assigned_to).first()
                return assignee.role if assignee else None
        return None

    def _get_datetime_value(self, condition: WorkflowCondition) -> datetime:
        """Get current datetime for time-based conditions"""
        return datetime.utcnow()

    def _get_approval_count_value(self, condition: WorkflowCondition, workflow_instance: WorkflowInstance) -> int:
        """Get approval count for workflow"""
        if condition.field_path == "total_approvals":
            return self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.workflow_instance_id == workflow_instance.id,
                WorkflowStepInstance.decision == "approved"
            ).count()
        elif condition.field_path == "pending_approvals":
            return self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.workflow_instance_id == workflow_instance.id,
                WorkflowStepInstance.status.in_(["pending", "in_progress"])
            ).count()
        return 0

    def _get_document_size_value(self, condition: WorkflowCondition, workflow_instance: WorkflowInstance) -> int:
        """Get document size metrics"""
        document = workflow_instance.document
        
        if condition.field_path == "content_length":
            content_str = json.dumps(document.content) if document.content else ""
            return len(content_str)
        elif condition.field_path == "placeholder_count":
            content = document.content or {}
            return len(content.get("placeholders", []))
        elif condition.field_path == "word_count":
            # Simple word count from content
            content_str = json.dumps(document.content) if document.content else ""
            return len(content_str.split())
        return 0

    def _evaluate_custom_function(
        self,
        condition: WorkflowCondition,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Any:
        """Evaluate custom function (placeholder for extensibility)"""
        # This would be extended with actual custom function implementations
        if condition.custom_function == "business_hours_check":
            return self._is_business_hours()
        elif condition.custom_function == "document_complexity_score":
            return self._calculate_document_complexity(workflow_instance.document)
        else:
            logger.warning(f"Unknown custom function: {condition.custom_function}")
            return None

    def _compare_values(self, actual: Any, expected: Any, operator: OperatorType) -> bool:
        """Compare actual and expected values using the specified operator"""
        
        if operator == OperatorType.EQUALS:
            return actual == expected
        elif operator == OperatorType.NOT_EQUALS:
            return actual != expected
        elif operator == OperatorType.GREATER_THAN:
            return actual > expected if actual is not None else False
        elif operator == OperatorType.LESS_THAN:
            return actual < expected if actual is not None else False
        elif operator == OperatorType.GREATER_EQUAL:
            return actual >= expected if actual is not None else False
        elif operator == OperatorType.LESS_EQUAL:
            return actual <= expected if actual is not None else False
        elif operator == OperatorType.CONTAINS:
            return expected in str(actual) if actual is not None else False
        elif operator == OperatorType.NOT_CONTAINS:
            return expected not in str(actual) if actual is not None else True
        elif operator == OperatorType.STARTS_WITH:
            return str(actual).startswith(str(expected)) if actual is not None else False
        elif operator == OperatorType.ENDS_WITH:
            return str(actual).endswith(str(expected)) if actual is not None else False
        elif operator == OperatorType.IN_LIST:
            return actual in expected if isinstance(expected, list) else False
        elif operator == OperatorType.NOT_IN_LIST:
            return actual not in expected if isinstance(expected, list) else True
        elif operator == OperatorType.IS_EMPTY:
            return actual is None or actual == "" or (isinstance(actual, (list, dict)) and len(actual) == 0)
        elif operator == OperatorType.IS_NOT_EMPTY:
            return actual is not None and actual != "" and (not isinstance(actual, (list, dict)) or len(actual) > 0)
        elif operator == OperatorType.REGEX_MATCH:
            return bool(re.match(str(expected), str(actual))) if actual is not None else False
        elif operator == OperatorType.DATE_BEFORE:
            if isinstance(actual, datetime) and isinstance(expected, str):
                expected_date = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                return actual < expected_date
            return False
        elif operator == OperatorType.DATE_AFTER:
            if isinstance(actual, datetime) and isinstance(expected, str):
                expected_date = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                return actual > expected_date
            return False
        else:
            raise ConditionEvaluationError(f"Unsupported operator: {operator}")

    def _combine_condition_results(
        self, 
        results: List[Dict[str, Any]], 
        logical_operator: LogicalOperator
    ) -> bool:
        """Combine individual condition results using logical operator"""
        
        if not results:
            return True
            
        condition_values = [r["result"] for r in results]
        
        if logical_operator == LogicalOperator.AND:
            return all(condition_values)
        elif logical_operator == LogicalOperator.OR:
            return any(condition_values)
        elif logical_operator == LogicalOperator.NOT:
            # NOT operates on the first condition only
            return not condition_values[0] if condition_values else True
        else:
            raise ConditionEvaluationError(f"Unsupported logical operator: {logical_operator}")

    # =========================================================================
    # Action Execution Methods  
    # =========================================================================

    def _execute_group_actions(
        self,
        group: WorkflowConditionGroup,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Execute all actions for a condition group"""
        
        results = []
        
        # Sort actions by execution order
        sorted_actions = sorted(group.actions, key=lambda a: a.execution_order)
        
        for action in sorted_actions:
            if action.execute_on_match:  # Execute on condition match
                result = self._execute_single_action(action, workflow_instance, step_instance, context)
                results.append(result)
                
        return results

    def _execute_single_action(
        self,
        action: WorkflowConditionalAction,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single conditional action"""
        
        start_time = datetime.utcnow()
        
        # Create execution record
        execution = ActionExecution(
            workflow_instance_id=workflow_instance.id,
            step_instance_id=step_instance.id if step_instance else None,
            action_id=action.id,
            status="pending",
            started_at=start_time,
            input_parameters=action.action_parameters,
            context_snapshot=context
        )
        
        try:
            result = self._perform_action(action, workflow_instance, step_instance, context)
            
            execution.status = "success"
            execution.result_data = result
            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = int((execution.completed_at - start_time).total_seconds() * 1000)
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error executing action {action.name}: {error_msg}")
            
            execution.status = "failed"
            execution.error_message = error_msg
            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = int((execution.completed_at - start_time).total_seconds() * 1000)
            
            result = {"error": error_msg}
            
        self.db.add(execution)
        self.db.commit()
        
        return {
            "action_id": action.id,
            "action_name": action.name,
            "action_type": action.action_type.value,
            "status": execution.status,
            "result": result,
            "execution_time_ms": execution.execution_time_ms
        }

    def _perform_action(
        self,
        action: WorkflowConditionalAction,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform the actual action based on action type"""
        
        if action.action_type == ActionType.ROUTE_TO_STEP:
            return self._action_route_to_step(action, workflow_instance)
            
        elif action.action_type == ActionType.SKIP_STEP:
            return self._action_skip_step(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.ASSIGN_TO_USER:
            return self._action_assign_to_user(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.ASSIGN_TO_ROLE:
            return self._action_assign_to_role(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.SET_PRIORITY:
            return self._action_set_priority(action, workflow_instance)
            
        elif action.action_type == ActionType.SET_DUE_DATE:
            return self._action_set_due_date(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.SEND_NOTIFICATION:
            return self._action_send_notification(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.AUTO_APPROVE:
            return self._action_auto_approve(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.ESCALATE:
            return self._action_escalate(action, workflow_instance, step_instance)
            
        elif action.action_type == ActionType.SET_CONTEXT_DATA:
            return self._action_set_context_data(action, workflow_instance, context)
            
        else:
            raise ActionExecutionError(f"Unsupported action type: {action.action_type}")

    def _action_route_to_step(self, action: WorkflowConditionalAction, workflow_instance: WorkflowInstance) -> Dict[str, Any]:
        """Route workflow to a specific step"""
        if not action.target_step_id:
            raise ActionExecutionError("Target step ID is required for routing action")
            
        # Update workflow instance to point to new step
        target_step = self.db.query(WorkflowStep).filter(WorkflowStep.id == action.target_step_id).first()
        if not target_step:
            raise ActionExecutionError(f"Target step {action.target_step_id} not found")
            
        workflow_instance.current_step_order = target_step.step_order
        self.db.commit()
        
        return {"routed_to_step": target_step.name, "step_order": target_step.step_order}

    def _action_skip_step(
        self, 
        action: WorkflowConditionalAction, 
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance]
    ) -> Dict[str, Any]:
        """Skip current or specified step"""
        if step_instance:
            step_instance.status = StepInstanceStatus.SKIPPED
            step_instance.completed_at = datetime.utcnow()
            step_instance.decision = "skipped"
            self.db.commit()
            
            return {"skipped_step": step_instance.step.name}
        return {"result": "no_step_to_skip"}

    def _action_assign_to_user(
        self, 
        action: WorkflowConditionalAction, 
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance]
    ) -> Dict[str, Any]:
        """Assign step to specific user"""
        if not action.target_user_id:
            raise ActionExecutionError("Target user ID is required for user assignment")
            
        if step_instance:
            step_instance.assigned_to = action.target_user_id
            self.db.commit()
            
            user = self.db.query(User).filter(User.id == action.target_user_id).first()
            return {"assigned_to_user": user.email if user else action.target_user_id}
        return {"result": "no_step_to_assign"}

    def _action_set_priority(self, action: WorkflowConditionalAction, workflow_instance: WorkflowInstance) -> Dict[str, Any]:
        """Set workflow priority"""
        new_priority = action.action_parameters.get("priority", 5) if action.action_parameters else 5
        workflow_instance.priority = new_priority
        self.db.commit()
        
        return {"new_priority": new_priority}

    def _action_send_notification(
        self, 
        action: WorkflowConditionalAction, 
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance]
    ) -> Dict[str, Any]:
        """Send custom notification"""
        template = action.notification_template or "conditional_action_notification"
        recipients = action.action_parameters.get("recipients", []) if action.action_parameters else []
        
        # Send notification using notification service
        notification_data = {
            "workflow_instance_id": workflow_instance.id,
            "action_name": action.name,
            "custom_message": action.action_parameters.get("message", "") if action.action_parameters else ""
        }
        
        # This would integrate with the actual notification service
        return {"notification_sent": True, "template": template, "recipients": recipients}

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _get_condition_groups(
        self, 
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance] = None
    ) -> List[WorkflowConditionGroup]:
        """Get applicable condition groups for workflow/step"""
        
        query = self.db.query(WorkflowConditionGroup).filter(
            WorkflowConditionGroup.workflow_id == workflow_instance.workflow_id,
            WorkflowConditionGroup.is_active == True
        )
        
        if step_instance:
            query = query.filter(
                or_(
                    WorkflowConditionGroup.step_id == step_instance.step_id,
                    WorkflowConditionGroup.step_id.is_(None)  # Workflow-level conditions
                )
            )
        else:
            query = query.filter(WorkflowConditionGroup.step_id.is_(None))
            
        return query.order_by(WorkflowConditionGroup.evaluation_order).all()

    def _build_evaluation_context(
        self,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        additional_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Build comprehensive context for condition evaluation"""
        
        context = {
            "workflow_instance_id": workflow_instance.id,
            "document_id": workflow_instance.document_id,
            "current_step_order": workflow_instance.current_step_order,
            "workflow_status": workflow_instance.status.value,
            "initiated_at": workflow_instance.initiated_at.isoformat(),
            "initiated_by": workflow_instance.initiated_by,
            "priority": workflow_instance.priority or 0,
            "evaluation_time": datetime.utcnow().isoformat()
        }
        
        if step_instance:
            context.update({
                "step_instance_id": step_instance.id,
                "step_id": step_instance.step_id,
                "step_status": step_instance.status.value,
                "assigned_to": step_instance.assigned_to
            })
            
        if workflow_instance.context_data:
            context.update(workflow_instance.context_data)
            
        if additional_context:
            context.update(additional_context)
            
        return context

    def _record_condition_evaluation(
        self,
        condition: WorkflowCondition,
        workflow_instance: WorkflowInstance,
        step_instance: Optional[WorkflowStepInstance],
        result: Dict[str, Any]
    ) -> None:
        """Record individual condition evaluation result"""
        
        evaluation = ConditionEvaluation(
            workflow_instance_id=workflow_instance.id,
            step_instance_id=step_instance.id if step_instance else None,
            condition_id=condition.id,
            condition_group_id=condition.condition_group_id,
            result=result["result"],
            actual_value=result.get("actual_value"),
            evaluation_details=result,
            execution_time_ms=result.get("execution_time_ms", 0),
            error_message=result.get("error")
        )
        
        self.db.add(evaluation)

    def _is_business_hours(self) -> bool:
        """Check if current time is within business hours"""
        now = datetime.utcnow()
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        hour = now.hour
        
        # Business hours: Monday-Friday, 9 AM to 5 PM UTC
        return weekday < 5 and 9 <= hour < 17

    def _calculate_document_complexity(self, document: Document) -> int:
        """Calculate document complexity score"""
        score = 0
        
        if document.content:
            content_str = json.dumps(document.content)
            score += len(content_str) // 100  # Length factor
            
            content = document.content
            if "placeholders" in content:
                score += len(content["placeholders"]) * 5  # Placeholder factor
                
        return score

    # Import required models after class definition
    from app.models.workflow import WorkflowStep
    from app.models.workflow_conditions import StepInstanceStatus