"""
Comprehensive tests for compliance features
"""
import pytest
import json
import tempfile
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, UserRole
from app.models.compliance import (
    UserConsent, ConsentType, ConsentStatus, ConsentMethod,
    DataRetentionPolicy, DataDeletionRequest, PrivacyImpactAssessment,
    ComplianceReport, DataProcessingActivity
)
from app.models.document import Document
from app.models.security import AuditLog, AuditEventType
from app.services.compliance_service import (
    DataRetentionService, ConsentManagementService, DataExportService,
    ComplianceMetricsService
)
from app.services.pia_service import PIAWorkflowService
from app.schemas.compliance import (
    UserConsentCreate, DataRetentionPolicyCreate, PrivacyImpactAssessmentCreate,
    UserDataExportRequest, ConsentBatchOperation
)
from tests.conftest import TestingSessionLocal


client = TestClient(app)


class TestUserConsent:
    """Test user consent management"""

    def test_create_user_consent(self, db: Session, test_user: User):
        """Test creating user consent"""
        service = ConsentManagementService(db)

        consent_data = {
            "consent_type": ConsentType.DATA_PROCESSING,
            "status": ConsentStatus.GRANTED,
            "method": ConsentMethod.EXPLICIT_FORM,
            "purpose": "Document management and storage",
            "consent_version": "1.0"
        }

        consent = service.record_consent(
            user_id=test_user.id,
            consent_data=consent_data,
            ip_address="192.168.1.1",
            user_agent="TestAgent/1.0"
        )

        assert consent.user_id == test_user.id
        assert consent.consent_type == ConsentType.DATA_PROCESSING
        assert consent.status == ConsentStatus.GRANTED
        assert consent.purpose == "Document management and storage"
        assert consent.ip_address == "192.168.1.1"
        assert consent.granted_at is not None

    def test_withdraw_consent(self, db: Session, test_user: User):
        """Test withdrawing user consent"""
        service = ConsentManagementService(db)

        # Create consent first
        consent_data = {
            "consent_type": ConsentType.MARKETING,
            "status": ConsentStatus.GRANTED,
            "method": ConsentMethod.CHECKBOX,
            "purpose": "Marketing communications",
            "consent_version": "1.0"
        }

        consent = service.record_consent(test_user.id, consent_data)

        # Withdraw consent
        withdrawn_consent = service.withdraw_consent(
            test_user.id,
            consent.id,
            "User requested withdrawal"
        )

        assert withdrawn_consent.status == ConsentStatus.WITHDRAWN
        assert withdrawn_consent.withdrawn_at is not None
        assert "withdrawal_reason" in withdrawn_consent.consent_metadata

    def test_get_user_consents(self, db: Session, test_user: User):
        """Test retrieving user consents"""
        service = ConsentManagementService(db)

        # Create multiple consents
        consent_types = [ConsentType.DATA_PROCESSING, ConsentType.ANALYTICS, ConsentType.COOKIES]

        for consent_type in consent_types:
            consent_data = {
                "consent_type": consent_type,
                "status": ConsentStatus.GRANTED,
                "method": ConsentMethod.EXPLICIT_FORM,
                "purpose": f"Purpose for {consent_type.value}",
                "consent_version": "1.0"
            }
            service.record_consent(test_user.id, consent_data)

        # Get all consents
        all_consents = service.get_user_consents(test_user.id)
        assert len(all_consents) == 3

        # Get specific consent type
        analytics_consents = service.get_user_consents(test_user.id, ConsentType.ANALYTICS.value)
        assert len(analytics_consents) == 1
        assert analytics_consents[0].consent_type == ConsentType.ANALYTICS

    def test_batch_consent_operation(self, db: Session, test_user: User, admin_user: User):
        """Test batch consent operations"""
        service = ConsentManagementService(db)

        operation = ConsentBatchOperation(
            operation="grant",
            consent_types=[ConsentType.DATA_PROCESSING, ConsentType.ANALYTICS],
            user_ids=[test_user.id],
            reason="Batch grant for testing"
        )

        result = service.batch_consent_operation(operation, admin_user.id)

        assert result.operation == "grant"
        assert result.processed_count == 1
        assert result.success_count == 1
        assert result.error_count == 0

        # Verify consents were created
        consents = service.get_user_consents(test_user.id)
        assert len(consents) == 2


class TestDataRetentionService:
    """Test data retention policy automation"""

    def test_create_retention_policy(self, db: Session):
        """Test creating data retention policy"""
        policy_data = {
            "name": "Document Retention Policy",
            "description": "Retain documents for 7 years",
            "data_category": "documents",
            "resource_type": "documents",
            "retention_period_days": 2555,  # 7 years
            "grace_period_days": 30,
            "legal_basis": "Legal requirement for document retention",
            "jurisdiction": "US",
            "auto_delete_enabled": True,
            "effective_from": datetime.utcnow()
        }

        policy = DataRetentionPolicy(**policy_data)
        db.add(policy)
        db.commit()

        assert policy.name == "Document Retention Policy"
        assert policy.retention_period_days == 2555
        assert policy.auto_delete_enabled is True

    def test_get_applicable_policies(self, db: Session):
        """Test getting applicable retention policies"""
        service = DataRetentionService(db)

        # Create test policy
        policy = DataRetentionPolicy(
            name="Test Policy",
            data_category="documents",
            resource_type="documents",
            retention_period_days=365,
            effective_from=datetime.utcnow() - timedelta(days=30),
            is_active=True
        )
        db.add(policy)
        db.commit()

        policies = service.get_applicable_policies("documents", "documents")
        assert len(policies) == 1
        assert policies[0].name == "Test Policy"

    def test_calculate_retention_date(self, db: Session):
        """Test retention date calculation"""
        service = DataRetentionService(db)

        policy = DataRetentionPolicy(
            name="Test Policy",
            data_category="documents",
            resource_type="documents",
            retention_period_days=365,
            effective_from=datetime.utcnow()
        )

        created_at = datetime.utcnow() - timedelta(days=100)
        retention_date = service.calculate_retention_date(created_at, [policy])

        expected_date = created_at + timedelta(days=365)
        assert retention_date.date() == expected_date.date()

    def test_get_expired_data(self, db: Session, test_user: User):
        """Test getting expired data"""
        service = DataRetentionService(db)

        # Create retention policy with very short retention period
        policy = DataRetentionPolicy(
            name="Short Retention",
            data_category="documents",
            resource_type="documents",
            retention_period_days=1,
            grace_period_days=0,
            effective_from=datetime.utcnow() - timedelta(days=10),
            is_active=True
        )
        db.add(policy)

        # Create old document
        old_doc = Document(
            title="Old Document",
            content={"ops": [{"insert": "Old content"}]},
            created_by=test_user.id,
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(old_doc)
        db.commit()

        expired_items = service.get_expired_data("documents", "documents")
        assert len(expired_items) == 1
        assert expired_items[0]["type"] == "document"
        assert expired_items[0]["title"] == "Old Document"

    def test_execute_automated_deletion(self, db: Session, test_user: User):
        """Test automated deletion execution"""
        service = DataRetentionService(db)

        # Create policy
        policy = DataRetentionPolicy(
            name="Auto Delete Policy",
            data_category="documents",
            resource_type="documents",
            retention_period_days=1,
            grace_period_days=0,
            auto_delete_enabled=True,
            effective_from=datetime.utcnow() - timedelta(days=10),
            is_active=True
        )
        db.add(policy)

        # Create old document
        old_doc = Document(
            title="Document to Delete",
            content={"ops": [{"insert": "Content to delete"}]},
            created_by=test_user.id,
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(old_doc)
        db.commit()

        doc_id = old_doc.id

        result = service.execute_automated_deletion(policy)

        assert result["status"] == "completed"
        assert result["deleted_count"] == 1

        # Verify document was deleted
        deleted_doc = db.query(Document).get(doc_id)
        assert deleted_doc is None


class TestDataExportService:
    """Test GDPR data export functionality"""

    def test_export_user_data_json(self, db: Session, test_user: User):
        """Test exporting user data in JSON format"""
        service = DataExportService(db)

        # Create test data
        document = Document(
            title="Test Document",
            content={"ops": [{"insert": "Test content"}]},
            created_by=test_user.id
        )
        db.add(document)

        consent = UserConsent(
            user_id=test_user.id,
            consent_type=ConsentType.DATA_PROCESSING,
            status=ConsentStatus.GRANTED,
            method=ConsentMethod.EXPLICIT_FORM,
            purpose="Testing",
            consent_version="1.0"
        )
        db.add(consent)
        db.commit()

        # Export data
        export_request = UserDataExportRequest(
            user_id=test_user.id,
            format="json",
            include_metadata=True
        )

        with patch('tempfile.TemporaryDirectory'), \
             patch('builtins.open', create=True) as mock_open, \
             patch('pathlib.Path.stat') as mock_stat, \
             patch('pathlib.Path.rename') as mock_rename:

            mock_stat.return_value.st_size = 1024
            mock_open.return_value.__enter__.return_value.read.return_value = b"test data"

            export = service.export_user_data(export_request)

            assert export.user_id == test_user.id
            assert export.format == "json"
            assert "profile" in export.data_categories
            assert "documents" in export.data_categories
            assert "consents" in export.data_categories

    def test_export_user_data_csv(self, db: Session, test_user: User):
        """Test exporting user data in CSV format"""
        service = DataExportService(db)

        export_request = UserDataExportRequest(
            user_id=test_user.id,
            format="csv",
            anonymize_sensitive=True
        )

        with patch('tempfile.TemporaryDirectory'), \
             patch('zipfile.ZipFile'), \
             patch('builtins.open', create=True), \
             patch('pathlib.Path.stat') as mock_stat, \
             patch('pathlib.Path.rename'):

            mock_stat.return_value.st_size = 2048

            export = service.export_user_data(export_request)

            assert export.format == "csv"
            assert export.file_size == 2048


class TestPIAWorkflowService:
    """Test Privacy Impact Assessment workflows"""

    def test_create_pia(self, db: Session, test_user: User):
        """Test creating a new PIA"""
        service = PIAWorkflowService(db)

        pia_data = PrivacyImpactAssessmentCreate(
            title="Document Management PIA",
            description="PIA for document management system",
            processing_purpose="Store and manage governance documents",
            data_categories=["user_data", "document_content"],
            data_subjects=["board_members", "residents"],
            necessity_justification="Required for governance documentation",
            proportionality_assessment="Proportionate to governance needs",
            identified_risks=[{"risk": "Unauthorized access", "impact": "medium"}],
            risk_likelihood="medium",
            risk_impact="medium",
            overall_risk_level="medium",
            mitigation_measures=[{"measure": "Access controls", "effectiveness": "high"}],
            residual_risk_level="low",
            review_date=datetime.utcnow() + timedelta(days=30),
            next_review_due=datetime.utcnow() + timedelta(days=365)
        )

        pia = service.create_pia(pia_data, test_user.id)

        assert pia.title == "Document Management PIA"
        assert pia.status == "draft"
        assert pia.created_by == test_user.id
        assert pia.overall_risk_level == "medium"

    def test_submit_pia_for_review(self, db: Session, test_user: User):
        """Test submitting PIA for review"""
        service = PIAWorkflowService(db)

        # Create PIA first
        pia_data = PrivacyImpactAssessmentCreate(
            title="Test PIA",
            description="Test PIA for review",
            processing_purpose="Testing",
            data_categories=["test_data"],
            data_subjects=["test_subjects"],
            necessity_justification="Required for testing",
            proportionality_assessment="Proportionate for testing",
            identified_risks=[{"risk": "Test risk", "impact": "low"}],
            risk_likelihood="low",
            risk_impact="low",
            overall_risk_level="low",
            mitigation_measures=[{"measure": "Test mitigation", "effectiveness": "high"}],
            residual_risk_level="low",
            review_date=datetime.utcnow() + timedelta(days=30),
            next_review_due=datetime.utcnow() + timedelta(days=365)
        )

        pia = service.create_pia(pia_data, test_user.id)

        # Submit for review
        reviewed_pia = service.submit_for_review(pia.id, test_user.id)

        assert reviewed_pia.status == "review"

    def test_approve_pia(self, db: Session, test_user: User, admin_user: User):
        """Test approving a PIA"""
        service = PIAWorkflowService(db)

        # Create and submit PIA
        pia_data = PrivacyImpactAssessmentCreate(
            title="Approval Test PIA",
            description="PIA for approval testing",
            processing_purpose="Testing approval",
            data_categories=["test_data"],
            data_subjects=["test_subjects"],
            necessity_justification="Required for testing",
            proportionality_assessment="Proportionate for testing",
            identified_risks=[{"risk": "Test risk", "impact": "low"}],
            risk_likelihood="low",
            risk_impact="low",
            overall_risk_level="low",
            mitigation_measures=[{"measure": "Test mitigation", "effectiveness": "high"}],
            residual_risk_level="low",
            review_date=datetime.utcnow() + timedelta(days=30),
            next_review_due=datetime.utcnow() + timedelta(days=365)
        )

        pia = service.create_pia(pia_data, test_user.id)
        service.submit_for_review(pia.id, test_user.id)

        # Approve PIA
        approved_pia = service.approve_pia(pia.id, admin_user.id, "Approved for testing")

        assert approved_pia.status == "approved"
        assert approved_pia.approved_by == admin_user.id
        assert approved_pia.approved_at is not None

    def test_get_overdue_pias(self, db: Session, test_user: User, admin_user: User):
        """Test getting overdue PIAs"""
        service = PIAWorkflowService(db)

        # Create and approve PIA with past review date
        pia_data = PrivacyImpactAssessmentCreate(
            title="Overdue PIA",
            description="PIA that's overdue",
            processing_purpose="Testing overdue",
            data_categories=["test_data"],
            data_subjects=["test_subjects"],
            necessity_justification="Required",
            proportionality_assessment="Proportionate",
            identified_risks=[{"risk": "Test risk", "impact": "low"}],
            risk_likelihood="low",
            risk_impact="low",
            overall_risk_level="low",
            mitigation_measures=[{"measure": "Test mitigation", "effectiveness": "high"}],
            residual_risk_level="low",
            review_date=datetime.utcnow() - timedelta(days=10),
            next_review_due=datetime.utcnow() - timedelta(days=5)  # Overdue
        )

        pia = service.create_pia(pia_data, test_user.id)
        service.submit_for_review(pia.id, test_user.id)
        service.approve_pia(pia.id, admin_user.id)

        overdue_pias = service.get_overdue_pias()
        assert len(overdue_pias) == 1
        assert overdue_pias[0].title == "Overdue PIA"

    def test_generate_pia_template(self, db: Session):
        """Test PIA template generation"""
        service = PIAWorkflowService(db)

        template = service.generate_pia_template("document_management")

        assert "title" in template
        assert "processing_purpose" in template
        assert "data_categories" in template
        assert "common_risks" in template
        assert "mitigation_measures" in template
        assert template["title"] == "Document Management System PIA"


class TestComplianceMetrics:
    """Test compliance metrics and dashboard"""

    def test_generate_compliance_metrics(self, db: Session, test_user: User):
        """Test generating compliance metrics"""
        service = ComplianceMetricsService(db)

        # Create test data
        consent = UserConsent(
            user_id=test_user.id,
            consent_type=ConsentType.DATA_PROCESSING,
            status=ConsentStatus.GRANTED,
            method=ConsentMethod.EXPLICIT_FORM,
            purpose="Testing",
            consent_version="1.0"
        )
        db.add(consent)

        policy = DataRetentionPolicy(
            name="Test Policy",
            data_category="documents",
            resource_type="documents",
            retention_period_days=365,
            effective_from=datetime.utcnow(),
            is_active=True
        )
        db.add(policy)
        db.commit()

        metrics = service.generate_compliance_metrics()

        assert "consent_statistics" in metrics.__dict__
        assert "retention_compliance" in metrics.__dict__
        assert "pia_status" in metrics.__dict__
        assert metrics.retention_compliance["active_policies"] == 1

    def test_generate_compliance_dashboard(self, db: Session, test_user: User):
        """Test generating compliance dashboard"""
        service = ComplianceMetricsService(db)

        dashboard = service.generate_compliance_dashboard()

        assert hasattr(dashboard, 'metrics')
        assert hasattr(dashboard, 'pending_tasks')
        assert hasattr(dashboard, 'recent_activities')
        assert hasattr(dashboard, 'compliance_score')
        assert hasattr(dashboard, 'recommendations')
        assert hasattr(dashboard, 'alerts')
        assert 0 <= dashboard.compliance_score <= 100


class TestComplianceAPI:
    """Test compliance API endpoints"""

    def test_create_user_consent_api(self, test_user: User):
        """Test creating user consent via API"""
        # Login as test user
        login_data = {"username": test_user.email, "password": "testpassword"}
        login_response = client.post("/api/v1/auth/login", data=login_data)
        token = login_response.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}

        consent_data = {
            "consent_type": "data_processing",
            "status": "granted",
            "method": "explicit_form",
            "purpose": "Document management",
            "consent_version": "1.0"
        }

        response = client.post("/api/v1/compliance/consent", json=consent_data, headers=headers)
        assert response.status_code == 200

        result = response.json()
        assert result["consent_type"] == "data_processing"
        assert result["status"] == "granted"

    def test_get_compliance_dashboard_api(self, admin_user: User):
        """Test getting compliance dashboard via API"""
        # Login as admin
        login_data = {"username": admin_user.email, "password": "adminpassword"}
        login_response = client.post("/api/v1/auth/login", data=login_data)
        token = login_response.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}

        response = client.get("/api/v1/compliance/dashboard", headers=headers)
        assert response.status_code == 200

        result = response.json()
        assert "metrics" in result
        assert "compliance_score" in result
        assert "pending_tasks" in result

    def test_create_pia_api(self, test_user: User):
        """Test creating PIA via API"""
        # Login as test user
        login_data = {"username": test_user.email, "password": "testpassword"}
        login_response = client.post("/api/v1/auth/login", data=login_data)
        token = login_response.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}

        pia_data = {
            "title": "API Test PIA",
            "description": "PIA created via API",
            "processing_purpose": "Testing API",
            "data_categories": ["test_data"],
            "data_subjects": ["test_subjects"],
            "necessity_justification": "Required for API testing",
            "proportionality_assessment": "Proportionate for testing",
            "identified_risks": [{"risk": "API test risk", "impact": "low"}],
            "risk_likelihood": "low",
            "risk_impact": "low",
            "overall_risk_level": "low",
            "mitigation_measures": [{"measure": "API test mitigation", "effectiveness": "high"}],
            "residual_risk_level": "low",
            "review_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "next_review_due": (datetime.utcnow() + timedelta(days=365)).isoformat()
        }

        response = client.post("/api/v1/compliance/pia", json=pia_data, headers=headers)
        assert response.status_code == 200

        result = response.json()
        assert result["title"] == "API Test PIA"
        assert result["status"] == "draft"


class TestComplianceValidation:
    """Test compliance validation and error handling"""

    def test_consent_validation(self, db: Session, test_user: User):
        """Test consent data validation"""
        service = ConsentManagementService(db)

        # Test invalid consent type
        with pytest.raises(ValueError):
            invalid_data = {
                "consent_type": "invalid_type",
                "status": ConsentStatus.GRANTED,
                "method": ConsentMethod.EXPLICIT_FORM,
                "purpose": "Testing",
                "consent_version": "1.0"
            }
            service.record_consent(test_user.id, invalid_data)

    def test_pia_validation(self, db: Session, test_user: User):
        """Test PIA validation for submission"""
        service = PIAWorkflowService(db)

        # Create incomplete PIA
        incomplete_pia = PrivacyImpactAssessment(
            title="Incomplete PIA",
            description="Missing required fields",
            created_by=test_user.id,
            status="draft"
        )
        db.add(incomplete_pia)
        db.commit()

        # Should fail validation
        with pytest.raises(Exception):  # HTTPException in real scenario
            service.submit_for_review(incomplete_pia.id, test_user.id)

    def test_retention_policy_validation(self, db: Session):
        """Test retention policy validation"""
        # Test negative retention period
        with pytest.raises(Exception):
            invalid_policy = DataRetentionPolicy(
                name="Invalid Policy",
                data_category="documents",
                resource_type="documents",
                retention_period_days=-30,  # Invalid
                effective_from=datetime.utcnow()
            )
            db.add(invalid_policy)
            db.commit()


class TestComplianceIntegration:
    """Test compliance feature integration"""

    def test_audit_log_integration(self, db: Session, test_user: User):
        """Test that compliance actions create audit logs"""
        service = ConsentManagementService(db)

        initial_log_count = db.query(AuditLog).count()

        consent_data = {
            "consent_type": ConsentType.DATA_PROCESSING,
            "status": ConsentStatus.GRANTED,
            "method": ConsentMethod.EXPLICIT_FORM,
            "purpose": "Testing audit integration",
            "consent_version": "1.0"
        }

        service.record_consent(test_user.id, consent_data)

        final_log_count = db.query(AuditLog).count()
        assert final_log_count > initial_log_count

        # Check audit log details
        latest_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
        assert latest_log.user_id == test_user.id
        assert latest_log.resource_type == "consent"

    def test_document_retention_integration(self, db: Session, test_user: User):
        """Test retention policy integration with documents"""
        retention_service = DataRetentionService(db)

        # Create document
        document = Document(
            title="Retention Test Document",
            content={"ops": [{"insert": "Test content"}]},
            created_by=test_user.id,
            created_at=datetime.utcnow() - timedelta(days=100)
        )
        db.add(document)

        # Create retention policy
        policy = DataRetentionPolicy(
            name="Document Retention",
            data_category="documents",
            resource_type="documents",
            retention_period_days=30,
            grace_period_days=0,
            auto_delete_enabled=True,
            effective_from=datetime.utcnow() - timedelta(days=50),
            is_active=True
        )
        db.add(policy)
        db.commit()

        # Check expired items
        expired_items = retention_service.get_expired_data("documents", "documents")
        assert len(expired_items) > 0

        # Execute deletion
        result = retention_service.execute_automated_deletion(policy)
        assert result["status"] == "completed"
        assert result["deleted_count"] > 0

    def test_pia_risk_assessment_workflow(self, db: Session, test_user: User, admin_user: User):
        """Test complete PIA workflow from creation to approval"""
        service = PIAWorkflowService(db)

        # Create high-risk PIA
        pia_data = PrivacyImpactAssessmentCreate(
            title="High Risk PIA",
            description="PIA with high risk level",
            processing_purpose="High-risk data processing",
            data_categories=["sensitive_data", "personal_identifiers"],
            data_subjects=["data_subjects"],
            necessity_justification="Business requirement",
            proportionality_assessment="Necessary and proportionate",
            identified_risks=[
                {"risk": "Data breach", "impact": "high", "likelihood": "medium"},
                {"risk": "Unauthorized access", "impact": "high", "likelihood": "low"}
            ],
            risk_likelihood="high",
            risk_impact="high",
            overall_risk_level="high",
            mitigation_measures=[
                {"measure": "Encryption", "effectiveness": "high"},
                {"measure": "Access controls", "effectiveness": "medium"}
            ],
            residual_risk_level="medium",
            dpo_consulted=True,
            dpo_consultation_date=datetime.utcnow(),
            dpo_opinion="Requires additional safeguards",
            review_date=datetime.utcnow() + timedelta(days=30),
            next_review_due=datetime.utcnow() + timedelta(days=180)  # More frequent for high risk
        )

        # Create PIA
        pia = service.create_pia(pia_data, test_user.id)
        assert pia.overall_risk_level == "high"

        # Submit for review
        submitted_pia = service.submit_for_review(pia.id, test_user.id)
        assert submitted_pia.status == "review"

        # Approve PIA
        approved_pia = service.approve_pia(pia.id, admin_user.id, "Approved with conditions")
        assert approved_pia.status == "approved"
        assert approved_pia.approved_by == admin_user.id

        # Conduct review
        review_data = {
            "effectiveness_review": "Controls are effective",
            "overall_risk_level": "medium",  # Risk reduced
            "next_review_due": datetime.utcnow() + timedelta(days=180)
        }

        reviewed_pia = service.conduct_pia_review(pia.id, admin_user.id, review_data)
        assert reviewed_pia.overall_risk_level == "medium"
        assert reviewed_pia.last_reviewed is not None


@pytest.fixture
def test_user(db: Session) -> User:
    """Create a test user"""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password="hashedpassword",
        full_name="Test User",
        role=UserRole.RESIDENT,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db: Session) -> User:
    """Create an admin user"""
    user = User(
        email="admin@example.com",
        username="adminuser",
        hashed_password="hashedpassword",
        full_name="Admin User",
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def db() -> Session:
    """Create a test database session"""
    session = TestingSessionLocal()
    yield session
    session.close()