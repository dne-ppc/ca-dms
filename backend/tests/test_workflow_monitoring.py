"""
Tests for workflow monitoring and reporting functionality
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.services.workflow_service import WorkflowService
from app.models.workflow import (
    Workflow, WorkflowStep, WorkflowInstance, WorkflowStepInstance,
    WorkflowStatus, WorkflowInstanceStatus, StepInstanceStatus, WorkflowStepType
)
from app.models.user import User, UserRole
from app.models.document import Document
from app.schemas.workflow import WorkflowCreate, WorkflowStepCreate


class TestWorkflowMonitoring:
    """Test workflow monitoring and reporting features"""
    
    @pytest.fixture
    def workflow_service(self, db_session: Session) -> WorkflowService:
        """Create workflow service for testing"""
        return WorkflowService(db_session)
    
    @pytest.fixture
    def sample_workflow_data(self) -> WorkflowCreate:
        """Create sample workflow data"""
        return WorkflowCreate(
            name="Sample Approval Workflow",
            description="Test workflow for monitoring",
            document_type="bylaw",
            steps=[
                WorkflowStepCreate(
                    name="Initial Review",
                    description="First review step",
                    step_type=WorkflowStepType.APPROVAL,
                    step_order=1,
                    required_role=UserRole.MANAGER,
                    required_approvals=1,
                    timeout_hours=24
                ),
                WorkflowStepCreate(
                    name="Final Approval",
                    description="Final approval step",
                    step_type=WorkflowStepType.APPROVAL,
                    step_order=2,
                    required_role=UserRole.ADMIN,
                    required_approvals=1,
                    timeout_hours=48
                )
            ]
        )

    def test_get_workflow_performance_metrics(
        self, 
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test workflow performance metrics collection"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need to implement performance metrics
        metrics = workflow_service.get_workflow_performance_metrics(workflow.id)
        
        assert "completion_rate" in metrics
        assert "average_completion_time" in metrics
        assert "bottleneck_steps" in metrics
        assert "step_performance" in metrics

    def test_get_approval_rate_analytics(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test approval rate analytics calculation"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need approval rate analytics
        approval_rates = workflow_service.get_approval_rate_analytics()
        
        assert "overall_approval_rate" in approval_rates
        assert "rejection_rate" in approval_rates
        assert "delegation_rate" in approval_rates
        assert "step_approval_rates" in approval_rates

    def test_get_bottleneck_analysis(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test bottleneck identification and analysis"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need bottleneck analysis
        bottlenecks = workflow_service.get_bottleneck_analysis()
        
        assert "slow_steps" in bottlenecks
        assert "overdue_frequency" in bottlenecks
        assert "escalation_patterns" in bottlenecks
        assert "performance_recommendations" in bottlenecks

    def test_get_user_performance_metrics(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test user performance metrics collection"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need user performance metrics
        user_metrics = workflow_service.get_user_performance_metrics()
        
        assert "approval_speed" in user_metrics
        assert "approval_quality" in user_metrics
        assert "workload_distribution" in user_metrics
        assert "delegation_patterns" in user_metrics

    def test_get_workflow_health_metrics(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test workflow system health metrics"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need health metrics
        health_metrics = workflow_service.get_workflow_health_metrics()
        
        assert "active_instances" in health_metrics
        assert "overdue_instances" in health_metrics
        assert "error_rate" in health_metrics
        assert "system_load" in health_metrics

    def test_get_time_based_analytics(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test time-based workflow analytics"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need time-based analytics
        time_analytics = workflow_service.get_time_based_analytics(days=30)
        
        assert "daily_completion_trends" in time_analytics
        assert "peak_usage_hours" in time_analytics
        assert "seasonal_patterns" in time_analytics
        assert "performance_trends" in time_analytics

    def test_get_document_type_analytics(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test document type specific analytics"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need document type analytics
        doc_analytics = workflow_service.get_document_type_analytics()
        
        assert "completion_rates_by_type" in doc_analytics
        assert "processing_time_by_type" in doc_analytics
        assert "approval_patterns_by_type" in doc_analytics
        assert "most_efficient_types" in doc_analytics

    def test_generate_workflow_report(
        self,
        workflow_service: WorkflowService,
        sample_workflow_data: WorkflowCreate,
        db_session: Session
    ):
        """Test comprehensive workflow report generation"""
        # Create test workflow
        workflow = workflow_service.create_workflow(sample_workflow_data, "test-user-id")
        
        # This test should fail initially - we need report generation
        report = workflow_service.generate_workflow_report(
            start_date=datetime.now() - timedelta(days=30),
            end_date=datetime.now(),
            include_recommendations=True
        )
        
        assert "executive_summary" in report
        assert "performance_metrics" in report
        assert "bottleneck_analysis" in report
        assert "user_insights" in report
        assert "recommendations" in report
        assert "trend_analysis" in report