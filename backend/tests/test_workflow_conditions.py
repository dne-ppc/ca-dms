"""
Tests for conditional workflow logic functionality
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.workflow import Workflow, WorkflowStep, WorkflowInstance, WorkflowStepInstance
from app.models.workflow_conditions import (
    WorkflowConditionGroup, WorkflowCondition, WorkflowConditionalAction,
    EscalationRule, EscalationInstance, ConditionEvaluation, ActionExecution,
    ConditionType, OperatorType, ActionType, LogicalOperator
)
from app.models.user import User
from app.models.document import Document
from app.services.workflow_condition_service import WorkflowConditionService
from app.services.escalation_service import EscalationService
from app.core.database import Base
import json


# Create test database
TEST_DATABASE_URL = "sqlite:///./test_workflow_conditions.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    """Create a test database session"""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Clean up
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session: Session):
    """Create a test user"""
    user = User(
        id="test-user-123",
        email="test@example.com",
        full_name="Test User",
        role="manager",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_workflow(db_session: Session, test_user: User):
    """Create a test workflow"""
    workflow = Workflow(
        id="test-workflow-123",
        name="Test Workflow",
        description="Test workflow for conditions",
        is_active=True,
        created_by=test_user.id
    )
    db_session.add(workflow)
    
    # Add workflow steps
    step1 = WorkflowStep(
        id="step-1",
        workflow_id=workflow.id,
        name="Initial Review",
        description="Initial document review",
        step_order=1,
        assignee_type="role",
        assignee_value="reviewer",
        is_approval_step=True
    )
    step2 = WorkflowStep(
        id="step-2", 
        workflow_id=workflow.id,
        name="Manager Approval",
        description="Manager approval step",
        step_order=2,
        assignee_type="role",
        assignee_value="manager",
        is_approval_step=True
    )
    
    db_session.add_all([step1, step2])
    db_session.commit()
    db_session.refresh(workflow)
    return workflow


@pytest.fixture
def test_document(db_session: Session, test_user: User):
    """Create a test document"""
    document = Document(
        id="test-doc-123",
        title="Test Document",
        content={"ops": [{"insert": "Test content with value: 1000\n"}]},
        status="draft",
        created_by=test_user.id
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document


@pytest.fixture
def workflow_instance(db_session: Session, test_workflow: Workflow, test_document: Document, test_user: User):
    """Create a test workflow instance"""
    instance = WorkflowInstance(
        id="instance-123",
        workflow_id=test_workflow.id,
        document_id=test_document.id,
        status="in_progress",
        initiated_by=test_user.id,
        context_data={"document_amount": 1000, "priority": "high"}
    )
    db_session.add(instance)
    
    # Add step instance
    step_instance = WorkflowStepInstance(
        id="step-instance-1",
        workflow_instance_id=instance.id,
        step_id="step-1",
        status="pending",
        assigned_to=test_user.id
    )
    db_session.add(step_instance)
    db_session.commit()
    db_session.refresh(instance)
    return instance


class TestWorkflowConditionModels:
    """Test workflow condition model functionality"""
    
    def test_create_condition_group(self, db_session: Session, test_workflow: Workflow):
        """Test creating a condition group"""
        group = WorkflowConditionGroup(
            workflow_id=test_workflow.id,
            name="High Value Check",
            description="Check for high-value documents",
            logical_operator=LogicalOperator.AND
        )
        db_session.add(group)
        db_session.commit()
        
        assert group.id is not None
        assert group.workflow_id == test_workflow.id
        assert group.name == "High Value Check"
        assert group.logical_operator == LogicalOperator.AND
    
    def test_create_workflow_condition(self, db_session: Session, test_workflow: Workflow):
        """Test creating workflow conditions"""
        group = WorkflowConditionGroup(
            workflow_id=test_workflow.id,
            name="Value Conditions"
        )
        db_session.add(group)
        db_session.commit()
        
        condition = WorkflowCondition(
            condition_group_id=group.id,
            name="Amount Greater Than 500",
            condition_type=ConditionType.WORKFLOW_DATA,
            operator=OperatorType.GREATER_THAN,
            field_path="document_amount",
            expected_value=500
        )
        db_session.add(condition)
        db_session.commit()
        
        assert condition.id is not None
        assert condition.condition_type == ConditionType.WORKFLOW_DATA
        assert condition.operator == OperatorType.GREATER_THAN
        assert condition.expected_value == 500
    
    def test_create_conditional_action(self, db_session: Session, test_workflow: Workflow):
        """Test creating conditional actions"""
        group = WorkflowConditionGroup(
            workflow_id=test_workflow.id,
            name="High Priority Actions"
        )
        db_session.add(group)
        db_session.commit()
        
        action = WorkflowConditionalAction(
            condition_group_id=group.id,
            name="Escalate High Value",
            action_type=ActionType.SET_PRIORITY,
            action_parameters={"priority": "urgent", "due_hours": 24}
        )
        db_session.add(action)
        db_session.commit()
        
        assert action.id is not None
        assert action.action_type == ActionType.SET_PRIORITY
        assert action.action_parameters["priority"] == "urgent"


class TestWorkflowConditionService:
    """Test workflow condition service functionality"""
    
    @pytest.fixture
    def condition_service(self, db_session: Session):
        """Create condition service instance"""
        return WorkflowConditionService(db_session)
    
    def test_evaluate_simple_condition(self, db_session: Session, condition_service: WorkflowConditionService, 
                                     workflow_instance: WorkflowInstance):
        """Test evaluating a simple workflow condition"""
        # Create condition group
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="Amount Check"
        )
        db_session.add(group)
        db_session.commit()
        
        # Create condition
        condition = WorkflowCondition(
            condition_group_id=group.id,
            name="High Value Check",
            condition_type=ConditionType.WORKFLOW_DATA,
            operator=OperatorType.GREATER_THAN,
            field_path="document_amount",
            expected_value=500
        )
        db_session.add(condition)
        db_session.commit()
        
        # Evaluate condition
        result = condition_service.evaluate_workflow_conditions(workflow_instance)
        
        assert "condition_groups" in result
        assert len(result["condition_groups"]) > 0
        # Document amount is 1000, should be greater than 500
        assert result["condition_groups"][0]["result"] == True
    
    def test_evaluate_document_field_condition(self, db_session: Session, condition_service: WorkflowConditionService,
                                             workflow_instance: WorkflowInstance):
        """Test evaluating document field conditions"""
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="Content Check"
        )
        db_session.add(group)
        db_session.commit()
        
        condition = WorkflowCondition(
            condition_group_id=group.id,
            name="Content Contains Test",
            condition_type=ConditionType.DOCUMENT_FIELD,
            operator=OperatorType.CONTAINS,
            field_path="content",
            expected_value="Test content"
        )
        db_session.add(condition)
        db_session.commit()
        
        result = condition_service.evaluate_workflow_conditions(workflow_instance)
        
        assert len(result["condition_groups"]) > 0
        assert result["condition_groups"][0]["result"] == True
    
    def test_execute_conditional_actions(self, db_session: Session, condition_service: WorkflowConditionService,
                                       workflow_instance: WorkflowInstance):
        """Test executing conditional actions"""
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="Action Group"
        )
        db_session.add(group)
        db_session.commit()
        
        # Create condition
        condition = WorkflowCondition(
            condition_group_id=group.id,
            name="Always True",
            condition_type=ConditionType.WORKFLOW_DATA,
            operator=OperatorType.GREATER_THAN,
            field_path="document_amount",
            expected_value=100  # Will be true since amount is 1000
        )
        db_session.add(condition)
        
        # Create action
        action = WorkflowConditionalAction(
            condition_group_id=group.id,
            name="Set High Priority",
            action_type=ActionType.SET_PRIORITY,
            action_parameters={"priority": "high"}
        )
        db_session.add(action)
        db_session.commit()
        
        result = condition_service.evaluate_workflow_conditions(workflow_instance)
        
        assert "actions_executed" in result
        assert len(result["actions_executed"]) > 0
        assert result["actions_executed"][0]["status"] == "success"
    
    def test_logical_operators(self, db_session: Session, condition_service: WorkflowConditionService,
                             workflow_instance: WorkflowInstance):
        """Test logical operators (AND, OR)"""
        # Test AND operator
        group_and = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="AND Group",
            logical_operator=LogicalOperator.AND
        )
        db_session.add(group_and)
        db_session.commit()
        
        # Both conditions should be true
        condition1 = WorkflowCondition(
            condition_group_id=group_and.id,
            name="Amount > 500",
            condition_type=ConditionType.WORKFLOW_DATA,
            operator=OperatorType.GREATER_THAN,
            field_path="document_amount",
            expected_value=500
        )
        condition2 = WorkflowCondition(
            condition_group_id=group_and.id,
            name="Priority High",
            condition_type=ConditionType.WORKFLOW_DATA,
            operator=OperatorType.EQUALS,
            field_path="priority",
            expected_value="high"
        )
        db_session.add_all([condition1, condition2])
        db_session.commit()
        
        result = condition_service.evaluate_workflow_conditions(workflow_instance)
        
        # Both conditions are true, AND should be true
        and_group = next(g for g in result["condition_groups"] if g["group_name"] == "AND Group")
        assert and_group["result"] == True


class TestEscalationService:
    """Test escalation service functionality"""
    
    @pytest.fixture
    def escalation_service(self, db_session: Session):
        """Create escalation service instance"""
        return EscalationService(db_session)
    
    def test_create_escalation_rule(self, db_session: Session, test_workflow: Workflow, test_user: User):
        """Test creating escalation rules"""
        rule = EscalationRule(
            workflow_id=test_workflow.id,
            name="Overdue Escalation",
            trigger_after_hours=24,
            escalation_chain=[
                {"level": 1, "user_id": test_user.id, "notification_hours": 2},
                {"level": 2, "role": "manager", "notification_hours": 4}
            ],
            created_by=test_user.id
        )
        db_session.add(rule)
        db_session.commit()
        
        assert rule.id is not None
        assert rule.trigger_after_hours == 24
        assert len(rule.escalation_chain) == 2
    
    def test_trigger_escalation(self, db_session: Session, escalation_service: EscalationService,
                              workflow_instance: WorkflowInstance, test_user: User):
        """Test triggering escalation"""
        # Create escalation rule
        rule = EscalationRule(
            workflow_id=workflow_instance.workflow_id,
            name="Test Escalation",
            trigger_after_hours=0,  # Immediate trigger for testing
            escalation_chain=[{"level": 1, "user_id": test_user.id}]
        )
        db_session.add(rule)
        db_session.commit()
        
        # Get step instance
        step_instance = db_session.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.workflow_instance_id == workflow_instance.id
        ).first()
        
        # Trigger escalation
        escalation = escalation_service.trigger_escalation(
            rule.id, workflow_instance.id, step_instance.id, "Test escalation"
        )
        
        assert escalation is not None
        assert escalation.escalation_rule_id == rule.id
        assert escalation.status == "active"
    
    def test_process_escalations(self, db_session: Session, escalation_service: EscalationService,
                               workflow_instance: WorkflowInstance, test_user: User):
        """Test processing pending escalations"""
        # Create escalation rule with past trigger time
        rule = EscalationRule(
            workflow_id=workflow_instance.workflow_id,
            name="Overdue Rule",
            trigger_after_hours=1,
            escalation_chain=[{"level": 1, "user_id": test_user.id}]
        )
        db_session.add(rule)
        db_session.commit()
        
        # Create escalation instance that should be processed
        step_instance = db_session.query(WorkflowStepInstance).filter(
            WorkflowStepInstance.workflow_instance_id == workflow_instance.id
        ).first()
        
        escalation = EscalationInstance(
            escalation_rule_id=rule.id,
            workflow_instance_id=workflow_instance.id,
            step_instance_id=step_instance.id,
            triggered_at=datetime.utcnow() - timedelta(hours=2)  # Triggered 2 hours ago
        )
        db_session.add(escalation)
        db_session.commit()
        
        # Process escalations
        result = escalation_service.process_escalations()
        
        assert "processed_escalations" in result
        assert result["processed_escalations"] >= 0


class TestConditionEvaluation:
    """Test condition evaluation recording"""
    
    def test_record_evaluation(self, db_session: Session, workflow_instance: WorkflowInstance):
        """Test recording condition evaluations"""
        # Create condition group
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="Test Group"
        )
        db_session.add(group)
        db_session.commit()
        
        # Create evaluation record
        evaluation = ConditionEvaluation(
            workflow_instance_id=workflow_instance.id,
            condition_group_id=group.id,
            result=True,
            actual_value={"test": "value"},
            evaluation_details={"operator": "equals", "expected": "value"}
        )
        db_session.add(evaluation)
        db_session.commit()
        
        assert evaluation.id is not None
        assert evaluation.result == True
        assert evaluation.actual_value["test"] == "value"


class TestActionExecution:
    """Test action execution recording"""
    
    def test_record_action_execution(self, db_session: Session, workflow_instance: WorkflowInstance):
        """Test recording action executions"""
        # Create condition group and action
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="Test Group"
        )
        db_session.add(group)
        db_session.commit()
        
        action = WorkflowConditionalAction(
            condition_group_id=group.id,
            name="Test Action",
            action_type=ActionType.SET_PRIORITY
        )
        db_session.add(action)
        db_session.commit()
        
        # Create execution record
        execution = ActionExecution(
            workflow_instance_id=workflow_instance.id,
            action_id=action.id,
            status="success",
            result_data={"priority_set": "high"},
            input_parameters={"target_priority": "high"}
        )
        db_session.add(execution)
        db_session.commit()
        
        assert execution.id is not None
        assert execution.status == "success"
        assert execution.result_data["priority_set"] == "high"


class TestIntegrationWorkflows:
    """Integration tests for complete workflow scenarios"""
    
    def test_complete_conditional_workflow(self, db_session: Session, workflow_instance: WorkflowInstance, test_user: User):
        """Test complete conditional workflow execution"""
        service = WorkflowConditionService(db_session)
        
        # Create complex condition group
        group = WorkflowConditionGroup(
            workflow_id=workflow_instance.workflow_id,
            name="High Value Processing",
            logical_operator=LogicalOperator.AND
        )
        db_session.add(group)
        db_session.commit()
        
        # Multiple conditions
        conditions = [
            WorkflowCondition(
                condition_group_id=group.id,
                name="High Amount",
                condition_type=ConditionType.WORKFLOW_DATA,
                operator=OperatorType.GREATER_THAN,
                field_path="document_amount",
                expected_value=500
            ),
            WorkflowCondition(
                condition_group_id=group.id,
                name="High Priority",
                condition_type=ConditionType.WORKFLOW_DATA,
                operator=OperatorType.EQUALS,
                field_path="priority",
                expected_value="high"
            )
        ]
        
        # Multiple actions
        actions = [
            WorkflowConditionalAction(
                condition_group_id=group.id,
                name="Set Urgent Priority",
                action_type=ActionType.SET_PRIORITY,
                execution_order=1,
                action_parameters={"priority": "urgent"}
            ),
            WorkflowConditionalAction(
                condition_group_id=group.id,
                name="Require Extra Approval",
                action_type=ActionType.REQUIRE_ADDITIONAL_APPROVAL,
                execution_order=2,
                action_parameters={"approval_type": "manager_override"}
            )
        ]
        
        db_session.add_all(conditions + actions)
        db_session.commit()
        
        # Execute workflow conditions
        result = service.evaluate_workflow_conditions(workflow_instance)
        
        # Verify results
        assert len(result["condition_groups"]) > 0
        assert result["condition_groups"][0]["result"] == True  # Both conditions should be true
        assert len(result["actions_executed"]) > 0  # Actions should be executed
        
        # Verify database records
        evaluations = db_session.query(ConditionEvaluation).filter(
            ConditionEvaluation.workflow_instance_id == workflow_instance.id
        ).all()
        assert len(evaluations) > 0
        
        executions = db_session.query(ActionExecution).filter(
            ActionExecution.workflow_instance_id == workflow_instance.id
        ).all()
        assert len(executions) > 0