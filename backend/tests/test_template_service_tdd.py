"""
Comprehensive TDD Test Suite for Template Service
Following "Failing Tests Are Good!" methodology to discover implementation gaps
"""
import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.services.template_service import TemplateService
from app.models.document_template import (
    DocumentTemplate, TemplateField, TemplateCollaborator,
    TemplateReview, TemplateUsageLog, TemplateCategory,
    TemplateAccessLevel, TemplateStatus
)
from app.schemas.document_template import (
    DocumentTemplateCreate, DocumentTemplateUpdate, TemplateSearchRequest,
    TemplateSearchFilters, TemplateFieldCreate, TemplateCollaboratorCreate,
    TemplateReviewCreate, CreateTemplateFromDocumentRequest,
    TemplateInstanceRequest, BulkTemplateAction
)


# =============================================================================
# 1. ACCESS CONTROL SECURITY TESTS (CRITICAL)
# =============================================================================

class TestTemplateServiceAccessControlTDD:
    """Test access control security - expect failures revealing permission bypasses"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    @pytest.fixture
    def sample_template(self):
        """Sample template for access control testing"""
        return DocumentTemplate(
            id="template-123",
            title="Test Template",
            description="Test Description",
            created_by="user-creator",
            access_level=TemplateAccessLevel.PRIVATE,
            status=TemplateStatus.DRAFT,
            content={"ops": [{"insert": "Test content"}]},
            created_at=datetime.utcnow()
        )

    def test_private_template_unauthorized_access_prevention(self, template_service, sample_template):
        """Test that unauthorized users cannot access private templates"""
        # Setup: Private template owned by user-creator
        template_service.db.query.return_value.filter.return_value.first.return_value = sample_template

        # Test: Different user trying to access private template
        unauthorized_user = "user-unauthorized"

        # Should raise exception or return None for unauthorized access
        with pytest.raises(Exception):  # Expect permission denied
            template_service.get_template("template-123", unauthorized_user)

    def test_permission_matrix_validation(self, template_service, sample_template):
        """Test all permission combinations across access levels"""
        permission_matrix = [
            ("view", TemplateAccessLevel.PUBLIC, "user-external", True),
            ("edit", TemplateAccessLevel.PUBLIC, "user-external", False),
            ("manage", TemplateAccessLevel.PUBLIC, "user-external", False),
            ("publish", TemplateAccessLevel.PUBLIC, "user-external", False),
            ("view", TemplateAccessLevel.ORGANIZATION, "user-same-org", True),
            ("edit", TemplateAccessLevel.ORGANIZATION, "user-different-org", False),
            ("view", TemplateAccessLevel.PRIVATE, "user-external", False),
        ]

        for permission, access_level, user_id, expected_access in permission_matrix:
            sample_template.access_level = access_level
            template_service.db.query.return_value.filter.return_value.first.return_value = sample_template

            result = template_service._check_template_access(sample_template, user_id, permission)
            assert result == expected_access, f"Permission {permission} for {access_level} by {user_id} failed"

    def test_collaborator_permission_escalation_prevention(self, template_service, sample_template):
        """Test that collaborators cannot exceed their granted permissions"""
        # Setup: User with VIEW permission trying to perform EDIT action
        collaborator = TemplateCollaborator(
            template_id="template-123",
            user_id="user-collaborator",
            permission_level="view",
            status="active"
        )

        template_service.db.query.return_value.filter.return_value.first.return_value = collaborator

        # Test: VIEW collaborator trying to update template
        update_data = DocumentTemplateUpdate(title="Unauthorized Update")

        with pytest.raises(Exception):  # Should prevent permission escalation
            template_service.update_template("template-123", update_data, "user-collaborator")

    def test_search_results_access_control_filtering(self, template_service):
        """Test that search results properly filter based on user permissions"""
        # Setup: Mix of public, organization, and private templates
        templates = [
            Mock(access_level=TemplateAccessLevel.PUBLIC, created_by="user-1"),
            Mock(access_level=TemplateAccessLevel.PRIVATE, created_by="user-2"),
            Mock(access_level=TemplateAccessLevel.ORGANIZATION, created_by="user-3"),
        ]

        template_service.db.query.return_value.all.return_value = templates

        # Test: External user should only see public templates
        search_request = TemplateSearchRequest(query="test")
        results = template_service.search_templates(search_request, "user-external")

        # Should only return public templates
        assert len(results.templates) == 1
        assert results.templates[0].access_level == TemplateAccessLevel.PUBLIC

    def test_bulk_operation_individual_permission_validation(self, template_service):
        """Test that bulk operations validate permissions for each template individually"""
        # Setup: Mix of templates with different permissions
        template_ids = ["template-1", "template-2", "template-3"]
        templates = [
            Mock(id="template-1", created_by="user-requester"),  # Should succeed
            Mock(id="template-2", created_by="user-other"),      # Should fail
            Mock(id="template-3", created_by="user-requester"),  # Should succeed
        ]

        def mock_get_template(template_id, user_id):
            for template in templates:
                if template.id == template_id:
                    if template.created_by == user_id:
                        return template
            raise Exception("Access denied")

        template_service.get_template = mock_get_template

        # Test: Bulk delete operation
        bulk_action = BulkTemplateAction(
            action="delete",
            template_ids=template_ids,
            data={}
        )

        result = template_service.bulk_template_action(bulk_action, "user-requester")

        # Should have mixed results: some success, some failures
        assert len(result["successful"]) == 2
        assert len(result["failed"]) == 1
        assert result["failed"][0]["template_id"] == "template-2"


# =============================================================================
# 2. TEMPLATE CRUD OPERATIONS TESTS
# =============================================================================

class TestTemplateServiceCRUDTDD:
    """Test template CRUD operations - expect failures in validation and business logic"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_template_creation_comprehensive_validation(self, template_service):
        """Test template creation with comprehensive input validation"""
        # Test cases that should reveal validation gaps
        invalid_template_data = [
            # Missing required fields
            DocumentTemplateCreate(title="", description="Test"),
            # Invalid category
            DocumentTemplateCreate(title="Test", category="INVALID_CATEGORY"),
            # Malformed content
            DocumentTemplateCreate(title="Test", content={"invalid": "structure"}),
            # Invalid access level
            DocumentTemplateCreate(title="Test", access_level="INVALID_ACCESS"),
        ]

        for invalid_data in invalid_template_data:
            with pytest.raises(Exception):  # Should validate input
                template_service.create_template(invalid_data, "user-123")

    def test_template_update_version_control_logic(self, template_service):
        """Test template update version control and content change detection"""
        # Setup: Existing template
        original_template = Mock(
            id="template-123",
            version=1,
            content={"ops": [{"insert": "Original content"}]},
            preview_content="Original preview"
        )
        template_service.db.query.return_value.filter.return_value.first.return_value = original_template

        # Test: Content change should increment version
        update_data = DocumentTemplateUpdate(
            content={"ops": [{"insert": "Updated content"}]}
        )

        updated = template_service.update_template("template-123", update_data, "user-123")

        # Should increment version and regenerate preview
        assert updated.version == 2
        assert updated.preview_content != "Original preview"

    def test_template_deletion_soft_delete_logic(self, template_service):
        """Test template deletion preserves data integrity through soft delete"""
        # Setup: Template with usage history and collaborators
        template = Mock(id="template-123", status=TemplateStatus.PUBLISHED)
        usage_logs = [Mock(), Mock()]  # Has usage history
        collaborators = [Mock()]       # Has collaborators

        template_service.db.query.return_value.filter.return_value.first.return_value = template
        template_service.db.query.return_value.filter.return_value.all.return_value = usage_logs

        # Test: Delete should archive, not destroy
        result = template_service.delete_template("template-123", "user-creator")

        # Should change status to ARCHIVED, not delete record
        assert template.status == TemplateStatus.ARCHIVED
        # Usage logs and collaborators should remain
        template_service.db.delete.assert_not_called()

    def test_template_publishing_business_rule_validation(self, template_service):
        """Test template publishing validates business rules before status change"""
        # Setup: Template missing required components for publishing
        incomplete_template = Mock(
            id="template-123",
            status=TemplateStatus.DRAFT,
            content=None,  # Missing content
            category=None,  # Missing category
            description=""  # Empty description
        )
        template_service.db.query.return_value.filter.return_value.first.return_value = incomplete_template

        # Test: Should validate template completeness before publishing
        with pytest.raises(Exception):  # Should enforce business rules
            template_service.publish_template("template-123", "user-creator")


# =============================================================================
# 3. COMPLEX SEARCH & FILTERING TESTS
# =============================================================================

class TestTemplateServiceSearchTDD:
    """Test complex search and filtering - expect failures in query construction"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_text_search_across_multiple_fields(self, template_service):
        """Test text search functionality across title, description, and content"""
        # Setup: Search query that should match multiple fields
        search_request = TemplateSearchRequest(
            query="governance",
            filters=TemplateSearchFilters()
        )

        # Mock templates with governance content in different fields
        templates = [
            Mock(title="Governance Policy", description="Standard", content="{}"),
            Mock(title="Standard", description="Corporate Governance Rules", content="{}"),
            Mock(title="Template", description="Standard", content='{"ops":[{"insert":"governance"}]}'),
        ]

        template_service.db.query.return_value.filter.return_value.offset.return_value.limit.return_value.all.return_value = templates
        template_service.db.query.return_value.filter.return_value.count.return_value = 3

        # Test: Should find all three templates with "governance" content
        results = template_service.search_templates(search_request, "user-123")

        assert len(results.templates) == 3
        assert results.total_count == 3

    def test_complex_filter_combinations(self, template_service):
        """Test complex combinations of search filters"""
        # Setup: Complex search with multiple filters
        complex_filters = TemplateSearchFilters(
            categories=[TemplateCategory.GOVERNANCE, TemplateCategory.LEGAL],
            access_levels=[TemplateAccessLevel.PUBLIC, TemplateAccessLevel.ORGANIZATION],
            statuses=[TemplateStatus.PUBLISHED],
            created_date_start=datetime.now() - timedelta(days=30),
            created_date_end=datetime.now(),
            min_usage_count=5
        )

        search_request = TemplateSearchRequest(
            query="policy",
            filters=complex_filters,
            sort_by="usage_count",
            sort_order="desc",
            page=1,
            page_size=10
        )

        # Test: Should properly construct complex query with all filters
        results = template_service.search_templates(search_request, "user-123")

        # Should call query builder with all filter parameters
        assert template_service.db.query.called
        # Should apply sorting and pagination
        assert template_service.db.query.return_value.order_by.called

    def test_search_pagination_accuracy(self, template_service):
        """Test search pagination calculations and total count accuracy"""
        # Setup: Large result set
        total_templates = 157
        page_size = 10
        page = 3  # Should return items 21-30

        template_service.db.query.return_value.filter.return_value.count.return_value = total_templates
        template_service.db.query.return_value.filter.return_value.offset.return_value.limit.return_value.all.return_value = [Mock() for _ in range(page_size)]

        search_request = TemplateSearchRequest(
            query="test",
            page=page,
            page_size=page_size
        )

        # Test: Pagination calculations
        results = template_service.search_templates(search_request, "user-123")

        assert results.total_count == total_templates
        assert results.current_page == page
        assert results.total_pages == 16  # ceil(157/10)
        assert len(results.templates) == page_size

    def test_search_performance_with_large_datasets(self, template_service):
        """Test search performance with large template datasets"""
        # Setup: Large dataset simulation
        template_service.db.query.return_value.filter.return_value.count.return_value = 10000

        search_request = TemplateSearchRequest(
            query="performance test",
            filters=TemplateSearchFilters(categories=[TemplateCategory.GOVERNANCE])
        )

        # Test: Should handle large datasets efficiently
        start_time = datetime.now()
        results = template_service.search_templates(search_request, "user-123")
        end_time = datetime.now()

        # Should complete within reasonable time (mocked, but tests query structure)
        processing_time = (end_time - start_time).total_seconds()
        assert processing_time < 1.0  # Should be fast with proper indexing


# =============================================================================
# 4. CONTENT PROCESSING & FIELD SUBSTITUTION TESTS
# =============================================================================

class TestTemplateServiceContentProcessingTDD:
    """Test content processing and field substitution - expect failures in edge cases"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_quill_delta_parsing_validation(self, template_service):
        """Test Quill Delta parsing with various content structures"""
        # Test cases that should reveal parsing issues
        content_test_cases = [
            # Missing ops array
            {"invalid": "structure"},
            # Malformed ops
            {"ops": "not_an_array"},
            # Invalid op structure
            {"ops": [{"invalid": "op"}]},
            # Empty content
            {},
            None,
        ]

        field_values = {"field1": "value1"}

        for invalid_content in content_test_cases:
            with pytest.raises(Exception):  # Should validate content structure
                template_service._process_template_content(invalid_content, field_values)

    def test_field_substitution_comprehensive_scenarios(self, template_service):
        """Test field substitution with comprehensive scenarios"""
        # Setup: Complex template content with various field types
        template_content = {
            "ops": [
                {"insert": "Hello {{employee_name}}, "},
                {"insert": "your start date is {{start_date}} "},
                {"insert": "and salary is {{salary|currency}}. "},
                {"insert": {"field": {"id": "signature", "type": "signature"}}},
                {"insert": "Missing field: {{undefined_field}}"}
            ]
        }

        field_values = {
            "employee_name": "John Doe",
            "start_date": "2024-01-15",
            "salary": "75000",
            "signature": "signature_data_here"
        }

        # Test: Should handle all field substitution scenarios
        processed = template_service._process_template_content(template_content, field_values)

        # Should substitute all defined fields
        content_text = "".join([op.get("insert", "") for op in processed["ops"] if isinstance(op.get("insert"), str)])
        assert "John Doe" in content_text
        assert "2024-01-15" in content_text
        assert "{{undefined_field}}" in content_text  # Should preserve undefined fields

    def test_preview_content_generation_accuracy(self, template_service):
        """Test preview content generation from complex Quill Delta"""
        # Setup: Rich content with formatting and custom blots
        complex_content = {
            "ops": [
                {"insert": "Executive Summary\n", "attributes": {"header": 1}},
                {"insert": "This document outlines "},
                {"insert": "important", "attributes": {"bold": True}},
                {"insert": " governance policies.\n\n"},
                {"insert": {"field": {"id": "policy_name", "type": "text"}}},
                {"insert": "\n"},
                {"insert": "Effective Date: "},
                {"insert": {"field": {"id": "effective_date", "type": "date"}}},
            ]
        }

        # Test: Should extract clean text for search indexing
        preview = template_service._generate_preview_content(complex_content)

        # Should contain text without formatting
        assert "Executive Summary" in preview
        assert "important governance policies" in preview
        assert "Effective Date:" in preview
        # Should include placeholder indicators
        assert "[policy_name]" in preview or "{{policy_name}}" in preview

    def test_document_title_generation_patterns(self, template_service):
        """Test document title generation with various patterns and field values"""
        # Setup: Different title patterns
        title_patterns = [
            "{{document_type}} - {{date|format:YYYY-MM-DD}}",
            "{{client_name}} {{document_type}}",
            "{{prefix}} - {{counter|format:0000}} - {{suffix}}",
            "Static Title",  # No fields
            "",  # Empty pattern
        ]

        field_values = {
            "document_type": "Policy",
            "date": "2024-01-15",
            "client_name": "ACME Corp",
            "prefix": "DOC",
            "counter": 42,
            "suffix": "FINAL"
        }

        for pattern in title_patterns:
            # Test: Should handle all title pattern scenarios
            title = template_service._generate_document_title(pattern, field_values)

            if pattern:
                assert title is not None
                assert len(title) > 0
            else:
                assert title == "Untitled Document"  # Default for empty pattern


# =============================================================================
# 5. TEMPLATE-TO-DOCUMENT GENERATION TESTS
# =============================================================================

class TestTemplateServiceDocumentGenerationTDD:
    """Test template-to-document generation workflow - expect integration failures"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    @pytest.fixture
    def sample_template_with_fields(self):
        """Sample template with field definitions"""
        template = Mock(
            id="template-123",
            title="Employee Contract",
            content={"ops": [{"insert": "Employee: {{employee_name}}"}]},
            fields=[
                Mock(id="field-1", name="employee_name", type="text", required=True),
                Mock(id="field-2", name="start_date", type="date", required=True),
                Mock(id="field-3", name="department", type="choice", required=False)
            ]
        )
        return template

    def test_document_generation_field_validation(self, template_service, sample_template_with_fields):
        """Test document generation validates required fields"""
        # Setup: Template access
        template_service.db.query.return_value.filter.return_value.first.return_value = sample_template_with_fields

        # Test: Missing required fields should fail
        incomplete_request = TemplateInstanceRequest(
            template_id="template-123",
            field_values={
                "employee_name": "John Doe"
                # Missing required start_date
            },
            title_pattern="{{employee_name}} Contract"
        )

        with pytest.raises(Exception):  # Should validate required fields
            template_service.create_document_from_template(incomplete_request, "user-123")

    def test_document_generation_content_processing_pipeline(self, template_service, sample_template_with_fields):
        """Test complete content processing pipeline from template to document"""
        # Setup: Complete field values
        template_service.db.query.return_value.filter.return_value.first.return_value = sample_template_with_fields

        complete_request = TemplateInstanceRequest(
            template_id="template-123",
            field_values={
                "employee_name": "Jane Smith",
                "start_date": "2024-02-01",
                "department": "Engineering"
            },
            title_pattern="{{employee_name}} - {{department}} Contract"
        )

        # Mock document service integration
        with patch('app.services.document_service.DocumentService') as mock_doc_service:
            mock_doc_service.return_value.create_document.return_value = Mock(id="doc-456")

            # Test: Should process complete pipeline
            result = template_service.create_document_from_template(complete_request, "user-123")

            # Should call document service with processed content
            mock_doc_service.return_value.create_document.assert_called_once()
            call_args = mock_doc_service.return_value.create_document.call_args[0][0]

            assert "Jane Smith" in call_args.title
            assert "Engineering" in call_args.title

    def test_document_generation_usage_logging(self, template_service, sample_template_with_fields):
        """Test that document generation properly logs template usage"""
        # Setup: Successful document creation
        template_service.db.query.return_value.filter.return_value.first.return_value = sample_template_with_fields

        request = TemplateInstanceRequest(
            template_id="template-123",
            field_values={"employee_name": "Test User", "start_date": "2024-01-01"}
        )

        with patch('app.services.document_service.DocumentService') as mock_doc_service:
            mock_doc_service.return_value.create_document.return_value = Mock(id="doc-789")

            # Test: Should log usage after successful creation
            template_service.create_document_from_template(request, "user-123")

            # Should create usage log entry
            template_service.db.add.assert_called()
            # Should update template usage statistics
            assert sample_template_with_fields.usage_count == 1

    def test_document_generation_concurrent_access(self, template_service, sample_template_with_fields):
        """Test document generation under concurrent access scenarios"""
        # Setup: Multiple users creating documents simultaneously
        template_service.db.query.return_value.filter.return_value.first.return_value = sample_template_with_fields

        requests = [
            TemplateInstanceRequest(
                template_id="template-123",
                field_values={"employee_name": f"User {i}", "start_date": "2024-01-01"}
            )
            for i in range(5)
        ]

        with patch('app.services.document_service.DocumentService') as mock_doc_service:
            mock_doc_service.return_value.create_document.return_value = Mock(id="doc-concurrent")

            # Test: Should handle concurrent document creation
            for request in requests:
                result = template_service.create_document_from_template(request, f"user-{request.field_values['employee_name']}")
                assert result is not None

            # Usage count should be properly incremented
            assert sample_template_with_fields.usage_count == 5


# =============================================================================
# 6. COLLABORATION SYSTEM TESTS
# =============================================================================

class TestTemplateServiceCollaborationTDD:
    """Test collaboration system - expect failures in permission and workflow logic"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_collaborator_invitation_workflow(self, template_service):
        """Test collaborator invitation and permission assignment"""
        # Setup: Template owner adding collaborator
        template = Mock(id="template-123", created_by="owner-user")
        template_service.db.query.return_value.filter.return_value.first.return_value = template

        collaborator_data = TemplateCollaboratorCreate(
            user_id="collaborator-user",
            permission_level="edit",
            invite_message="Please help with this template"
        )

        # Test: Should create collaborator with proper workflow
        result = template_service.add_collaborator("template-123", collaborator_data, "owner-user")

        # Should create collaborator record
        template_service.db.add.assert_called()
        # Should have proper status and permissions
        assert result.status == "pending"  # Awaiting acceptance
        assert result.permission_level == "edit"

    def test_collaborator_permission_boundaries(self, template_service):
        """Test that collaborators cannot exceed permission boundaries"""
        # Setup: Collaborator with VIEW permission
        template = Mock(id="template-123", created_by="owner-user")
        collaborator = Mock(
            template_id="template-123",
            user_id="view-collaborator",
            permission_level="view",
            status="active"
        )

        template_service.db.query.return_value.filter.return_value.first.return_value = collaborator

        # Test: VIEW collaborator trying to add another collaborator (MANAGE permission required)
        new_collaborator_data = TemplateCollaboratorCreate(
            user_id="new-user",
            permission_level="edit"
        )

        with pytest.raises(Exception):  # Should prevent unauthorized collaboration management
            template_service.add_collaborator("template-123", new_collaborator_data, "view-collaborator")

    def test_template_review_system_integrity(self, template_service):
        """Test template review system maintains data integrity"""
        # Setup: Multiple reviews from different users
        template = Mock(id="template-123", created_by="owner-user")
        existing_review = Mock(
            template_id="template-123",
            user_id="reviewer-1",
            rating=4,
            comment="Good template"
        )

        template_service.db.query.return_value.filter.return_value.first.return_value = existing_review

        # Test: User updating their existing review
        updated_review_data = TemplateReviewCreate(
            rating=5,
            comment="Excellent template after updates",
            criteria_scores={"clarity": 5, "usefulness": 5}
        )

        result = template_service.add_review("template-123", updated_review_data, "reviewer-1")

        # Should update existing review, not create duplicate
        assert result.rating == 5
        assert result.comment == "Excellent template after updates"

    def test_collaboration_notification_integration(self, template_service):
        """Test collaboration events trigger proper notifications"""
        # Setup: Template with collaborators
        template = Mock(id="template-123", created_by="owner-user")
        template_service.db.query.return_value.filter.return_value.first.return_value = template

        # Test: Should integrate with notification service
        with patch('app.services.notification_service.NotificationService') as mock_notif_service:
            collaborator_data = TemplateCollaboratorCreate(
                user_id="new-collaborator",
                permission_level="edit"
            )

            template_service.add_collaborator("template-123", collaborator_data, "owner-user")

            # Should send invitation notification
            mock_notif_service.return_value.send_notification.assert_called_once()


# =============================================================================
# 7. ANALYTICS & USAGE TRACKING TESTS
# =============================================================================

class TestTemplateServiceAnalyticsTDD:
    """Test analytics and usage tracking - expect failures in aggregation logic"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_usage_statistics_accuracy(self, template_service):
        """Test usage statistics calculation accuracy"""
        # Setup: Template with usage logs
        template = Mock(id="template-123", usage_count=10)
        usage_logs = [
            Mock(action_type="document_created", created_at=datetime.now() - timedelta(days=1)),
            Mock(action_type="document_created", created_at=datetime.now() - timedelta(days=5)),
            Mock(action_type="template_viewed", created_at=datetime.now() - timedelta(days=2)),
        ]

        template_service.db.query.return_value.filter.return_value.first.return_value = template
        template_service.db.query.return_value.filter.return_value.all.return_value = usage_logs

        # Test: Should calculate accurate usage statistics
        analytics = template_service.get_template_analytics("template-123", "owner-user")

        assert analytics.total_usage == 10
        assert analytics.recent_usage_7_days == 3
        assert analytics.documents_created == 2  # Only document_created actions

    def test_analytics_aggregation_by_time_period(self, template_service):
        """Test analytics aggregation by various time periods"""
        # Setup: Usage logs spanning multiple months
        template = Mock(id="template-123")
        monthly_usage_logs = [
            Mock(created_at=datetime(2024, 1, 15), action_type="document_created"),
            Mock(created_at=datetime(2024, 1, 20), action_type="document_created"),
            Mock(created_at=datetime(2024, 2, 10), action_type="document_created"),
            Mock(created_at=datetime(2024, 3, 5), action_type="template_viewed"),
        ]

        template_service.db.query.return_value.filter.return_value.first.return_value = template
        template_service.db.query.return_value.filter.return_value.all.return_value = monthly_usage_logs

        # Test: Should aggregate by month correctly
        analytics = template_service.get_template_analytics("template-123", "owner-user")

        # Should have monthly breakdown
        assert len(analytics.monthly_usage) == 3
        assert analytics.monthly_usage["2024-01"] == 2
        assert analytics.monthly_usage["2024-02"] == 1
        assert analytics.monthly_usage["2024-03"] == 1

    def test_review_metrics_calculation(self, template_service):
        """Test review metrics calculation with various scenarios"""
        # Setup: Template with multiple reviews
        template = Mock(id="template-123")
        reviews = [
            Mock(rating=5, criteria_scores={"clarity": 5, "usefulness": 4}),
            Mock(rating=4, criteria_scores={"clarity": 4, "usefulness": 5}),
            Mock(rating=3, criteria_scores={"clarity": 3, "usefulness": 3}),
        ]

        template_service.db.query.return_value.filter.return_value.first.return_value = template
        template_service.db.query.return_value.filter.return_value.all.return_value = reviews

        # Test: Should calculate accurate review metrics
        analytics = template_service.get_template_analytics("template-123", "owner-user")

        assert analytics.average_rating == 4.0  # (5+4+3)/3
        assert analytics.total_reviews == 3
        assert analytics.criteria_averages["clarity"] == 4.0  # (5+4+3)/3
        assert analytics.criteria_averages["usefulness"] == 4.0  # (4+5+3)/3

    def test_usage_log_data_integrity(self, template_service):
        """Test usage logging maintains data integrity"""
        # Test: Should log complete usage information
        template_service._log_template_usage(
            template_id="template-123",
            user_id="user-456",
            action_type="document_created",
            document_id="doc-789"
        )

        # Should create proper usage log entry
        template_service.db.add.assert_called()
        usage_log_call = template_service.db.add.call_args[0][0]

        assert usage_log_call.template_id == "template-123"
        assert usage_log_call.user_id == "user-456"
        assert usage_log_call.action_type == "document_created"
        assert usage_log_call.document_id == "doc-789"
        assert usage_log_call.created_at is not None


# =============================================================================
# 8. BULK OPERATIONS TESTS
# =============================================================================

class TestTemplateServiceBulkOperationsTDD:
    """Test bulk operations - expect failures in transaction safety and error handling"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_bulk_operation_transaction_atomicity(self, template_service):
        """Test bulk operations maintain transaction atomicity"""
        # Setup: Bulk operation with one failing template
        template_ids = ["template-1", "template-2", "template-3"]

        def mock_get_template(template_id, user_id):
            if template_id == "template-2":
                raise Exception("Access denied")
            return Mock(id=template_id, created_by=user_id)

        template_service.get_template = mock_get_template

        bulk_action = BulkTemplateAction(
            action="publish",
            template_ids=template_ids,
            data={}
        )

        # Test: Should handle partial failures correctly
        result = template_service.bulk_template_action(bulk_action, "user-123")

        # Should have mixed results
        assert len(result["successful"]) == 2
        assert len(result["failed"]) == 1
        assert result["failed"][0]["template_id"] == "template-2"

    def test_bulk_operation_performance_limits(self, template_service):
        """Test bulk operations handle large batches efficiently"""
        # Setup: Large batch of templates
        large_batch_ids = [f"template-{i}" for i in range(100)]

        template_service.get_template = lambda tid, uid: Mock(id=tid, created_by=uid)

        bulk_action = BulkTemplateAction(
            action="archive",
            template_ids=large_batch_ids,
            data={}
        )

        # Test: Should handle large batches without timeout
        result = template_service.bulk_template_action(bulk_action, "user-123")

        assert result["total_processed"] == 100
        assert len(result["successful"]) == 100

    def test_bulk_operation_error_reporting_detail(self, template_service):
        """Test bulk operations provide detailed error reporting"""
        # Setup: Templates with different failure reasons
        def mock_get_template_with_errors(template_id, user_id):
            error_map = {
                "template-1": "Access denied",
                "template-2": "Template not found",
                "template-3": "Invalid template status"
            }
            if template_id in error_map:
                raise Exception(error_map[template_id])
            return Mock(id=template_id)

        template_service.get_template = mock_get_template_with_errors

        bulk_action = BulkTemplateAction(
            action="delete",
            template_ids=["template-1", "template-2", "template-3", "template-4"],
            data={}
        )

        # Test: Should provide detailed error information
        result = template_service.bulk_template_action(bulk_action, "user-123")

        assert len(result["failed"]) == 3
        error_messages = [error["error"] for error in result["failed"]]
        assert "Access denied" in error_messages
        assert "Template not found" in error_messages
        assert "Invalid template status" in error_messages

    def test_bulk_operation_concurrent_access_safety(self, template_service):
        """Test bulk operations safely handle concurrent access"""
        # Setup: Simulate concurrent bulk operations
        template_ids = ["shared-template-1", "shared-template-2"]

        # Mock database transaction behavior
        template_service.db.begin = Mock()
        template_service.db.commit = Mock()
        template_service.db.rollback = Mock()

        bulk_action = BulkTemplateAction(
            action="update_category",
            template_ids=template_ids,
            data={"category": "GOVERNANCE"}
        )

        # Test: Should use proper transaction management
        template_service.bulk_template_action(bulk_action, "user-123")

        # Should handle transactions properly
        template_service.db.begin.assert_called()
        template_service.db.commit.assert_called()


# =============================================================================
# 9. VERSION CONTROL & STATE MANAGEMENT TESTS
# =============================================================================

class TestTemplateServiceVersionControlTDD:
    """Test version control and state management - expect failures in concurrent scenarios"""

    @pytest.fixture
    def template_service(self):
        mock_db = Mock(spec=Session)
        return TemplateService(mock_db)

    def test_concurrent_template_update_handling(self, template_service):
        """Test handling of concurrent template updates"""
        # Setup: Template being updated by multiple users
        template = Mock(
            id="template-123",
            version=1,
            content={"ops": [{"insert": "Original"}]},
            last_modified_at=datetime.now() - timedelta(minutes=5)
        )

        template_service.db.query.return_value.filter.return_value.first.return_value = template

        # Test: Concurrent updates should be handled properly
        update_data_1 = DocumentTemplateUpdate(
            content={"ops": [{"insert": "Update 1"}]},
            version=1  # Based on version 1
        )

        update_data_2 = DocumentTemplateUpdate(
            content={"ops": [{"insert": "Update 2"}]},
            version=1  # Also based on version 1 - conflict!
        )

        # First update should succeed
        result_1 = template_service.update_template("template-123", update_data_1, "user-1")
        assert result_1.version == 2

        # Second update should detect conflict
        with pytest.raises(Exception):  # Should detect version conflict
            template_service.update_template("template-123", update_data_2, "user-2")

    def test_template_status_transition_validation(self, template_service):
        """Test template status transitions follow business rules"""
        # Setup: Template in various states
        status_transitions = [
            (TemplateStatus.DRAFT, TemplateStatus.PUBLISHED, True),
            (TemplateStatus.PUBLISHED, TemplateStatus.DEPRECATED, True),
            (TemplateStatus.DEPRECATED, TemplateStatus.PUBLISHED, False),  # Invalid
            (TemplateStatus.ARCHIVED, TemplateStatus.PUBLISHED, False),    # Invalid
        ]

        for current_status, target_status, should_succeed in status_transitions:
            template = Mock(id="template-123", status=current_status)
            template_service.db.query.return_value.filter.return_value.first.return_value = template

            if should_succeed:
                # Should allow valid transitions
                if target_status == TemplateStatus.PUBLISHED:
                    result = template_service.publish_template("template-123", "user-123")
                    assert result.status == TemplateStatus.PUBLISHED
            else:
                # Should prevent invalid transitions
                with pytest.raises(Exception):
                    if target_status == TemplateStatus.PUBLISHED:
                        template_service.publish_template("template-123", "user-123")

    def test_version_history_preservation(self, template_service):
        """Test that version history is properly preserved"""
        # Setup: Template with multiple versions
        template = Mock(
            id="template-123",
            version=3,
            content={"ops": [{"insert": "Version 3"}]}
        )

        version_history = [
            Mock(version=1, content={"ops": [{"insert": "Version 1"}]}),
            Mock(version=2, content={"ops": [{"insert": "Version 2"}]}),
            Mock(version=3, content={"ops": [{"insert": "Version 3"}]}),
        ]

        template_service.db.query.return_value.filter.return_value.first.return_value = template
        template_service.db.query.return_value.filter.return_value.order_by.return_value.all.return_value = version_history

        # Test: Should maintain complete version history
        result = template_service.get_template_with_details("template-123", "user-123")

        # Should include version history
        assert len(result.version_history) == 3
        assert result.version_history[0].version == 1
        assert result.version_history[-1].version == 3

    def test_preview_content_synchronization(self, template_service):
        """Test preview content stays synchronized with main content"""
        # Setup: Template update that changes content
        template = Mock(
            id="template-123",
            content={"ops": [{"insert": "Old content"}]},
            preview_content="Old content preview"
        )

        template_service.db.query.return_value.filter.return_value.first.return_value = template

        # Test: Content update should regenerate preview
        new_content = {"ops": [{"insert": "New complex content with {{fields}}"}]}
        update_data = DocumentTemplateUpdate(content=new_content)

        result = template_service.update_template("template-123", update_data, "user-123")

        # Should regenerate preview content
        assert result.preview_content != "Old content preview"
        assert "New complex content" in result.preview_content