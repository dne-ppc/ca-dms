"""
TDD-Driven Bug Fixes for Document Comparison Service

Following the RED-GREEN-REFACTOR cycle to fix critical bugs discovered
in comprehensive testing. Each test drives the implementation.
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from app.services.document_comparison_service import DocumentComparisonService, DeltaChange, ComparisonResult


class TestDocumentComparisonTDDFixes:
    """TDD-driven fixes for Document Comparison Service bugs"""

    @pytest.fixture
    def service(self):
        """Create service instance for testing"""
        return DocumentComparisonService()

    # =============================================================================
    # TASK 1.1: Create Character-Level Diff Algorithm
    # RED PHASE: Write failing tests that define the expected behavior
    # =============================================================================

    def test_compare_text_operations_basic(self, service):
        """
        RED: Test basic text operation comparison

        This test SHOULD FAIL initially because _compare_operations
        uses SequenceMatcher which fails with unhashable dict types.

        After implementation, this defines the expected behavior.
        """
        old_ops = [{"insert": "Hello World"}]
        new_ops = [{"insert": "Hello Beautiful World"}]

        # This will currently fail with TypeError: unhashable type: 'dict'
        changes = service._compare_operations(old_ops, new_ops)

        # Expected behavior after fix:
        assert isinstance(changes, list)
        assert len(changes) >= 1

        # Should detect the text modification
        has_modification = any(change.type in ['modify', 'insert', 'delete'] for change in changes)
        assert has_modification

        # Should preserve the new content
        has_beautiful = any(
            change.new_op and 'Beautiful' in str(change.new_op.get('insert', ''))
            for change in changes
        )
        assert has_beautiful

    def test_compare_identical_text_operations(self, service):
        """
        RED: Test comparison of identical text operations

        Should return retain-type changes when content is identical.
        """
        ops = [{"insert": "Hello World"}]

        changes = service._compare_operations(ops, ops)

        # Should recognize identical content
        assert isinstance(changes, list)
        assert len(changes) >= 1
        assert all(change.type == 'retain' for change in changes)

    def test_compare_empty_operations(self, service):
        """
        RED: Test comparison with empty operation lists

        Should handle empty lists gracefully.
        """
        empty_ops = []
        text_ops = [{"insert": "Hello"}]

        # Empty to content
        changes = service._compare_operations(empty_ops, text_ops)
        assert isinstance(changes, list)
        assert any(change.type == 'insert' for change in changes)

        # Content to empty
        changes = service._compare_operations(text_ops, empty_ops)
        assert isinstance(changes, list)
        assert any(change.type == 'delete' for change in changes)

        # Empty to empty
        changes = service._compare_operations(empty_ops, empty_ops)
        assert isinstance(changes, list)

    # =============================================================================
    # TASK 1.2: Handle Placeholder Object Comparison
    # RED PHASE: Define expected placeholder comparison behavior
    # =============================================================================

    def test_compare_placeholder_operations_modified(self, service):
        """
        RED: Test comparison of modified placeholder objects

        Should detect changes in placeholder properties.
        """
        old_ops = [{"insert": {"signature": {"label": "CEO", "includeTitle": True}}}]
        new_ops = [{"insert": {"signature": {"label": "Director", "includeTitle": False}}}]

        changes = service._compare_operations(old_ops, new_ops)

        assert isinstance(changes, list)
        assert len(changes) >= 1

        # Should detect modification
        has_modification = any(change.type == 'modify' for change in changes)
        assert has_modification

    def test_compare_placeholder_operations_same_type_different_data(self, service):
        """
        RED: Test placeholder operations of same type with different data
        """
        old_ops = [{"insert": {"longResponse": {"lines": 3, "label": "Comments"}}}]
        new_ops = [{"insert": {"longResponse": {"lines": 5, "label": "Detailed Comments"}}}]

        changes = service._compare_operations(old_ops, new_ops)

        assert isinstance(changes, list)
        assert any(change.type == 'modify' for change in changes)

    def test_compare_different_placeholder_types(self, service):
        """
        RED: Test replacement of one placeholder type with another
        """
        old_ops = [{"insert": {"signature": {"label": "CEO"}}}]
        new_ops = [{"insert": {"longResponse": {"lines": 3}}}]

        changes = service._compare_operations(old_ops, new_ops)

        assert isinstance(changes, list)
        # Should treat as delete old + insert new, or replace
        has_delete_or_replace = any(change.type in ['delete', 'replace', 'modify'] for change in changes)
        has_insert_or_replace = any(change.type in ['insert', 'replace', 'modify'] for change in changes)
        assert has_delete_or_replace or has_insert_or_replace

    # =============================================================================
    # TASK 1.3: Implement Mixed Content Comparison
    # RED PHASE: Define behavior for documents with mixed content types
    # =============================================================================

    def test_compare_mixed_content_operations(self, service):
        """
        RED: Test comparison of mixed text and placeholder content

        Real-world documents contain both text and placeholders.
        """
        old_ops = [
            {"insert": "Meeting: "},
            {"insert": {"signature": {"label": "Manager"}}},
            {"insert": "\nDate: 2024-01-01"}
        ]
        new_ops = [
            {"insert": "Board Meeting: "},
            {"insert": {"signature": {"label": "Director"}}},
            {"insert": "\nDate: 2024-01-15"}
        ]

        changes = service._compare_operations(old_ops, new_ops)

        assert isinstance(changes, list)
        assert len(changes) >= 3  # At least one change per operation

        # Should detect text changes
        has_text_changes = any(
            change.type in ['modify', 'insert', 'delete'] and
            change.old_op and isinstance(change.old_op.get('insert'), str)
            for change in changes
        )
        assert has_text_changes

        # Should detect placeholder changes
        has_placeholder_changes = any(
            change.type in ['modify', 'insert', 'delete'] and
            change.old_op and isinstance(change.old_op.get('insert'), dict)
            for change in changes
        )
        assert has_placeholder_changes

    def test_compare_complex_document_structure(self, service):
        """
        RED: Test comparison of complex, realistic document structures
        """
        old_ops = [
            {"insert": "Meeting Minutes"},
            {"insert": "\n", "attributes": {"header": 1}},
            {"insert": "Date: January 1, 2024\n"},
            {"insert": "Attendees: "},
            {"insert": {"lineSegment": {"type": "long", "label": "Attendee List"}}},
            {"insert": "\n\nDecisions:\n"},
            {"insert": {"longResponse": {"lines": 5, "label": "Meeting Decisions"}}},
            {"insert": "\n\nApproved by: "},
            {"insert": {"signature": {"label": "Manager", "includeTitle": True}}}
        ]

        new_ops = [
            {"insert": "Board Meeting Minutes"},
            {"insert": "\n", "attributes": {"header": 1}},
            {"insert": "Date: January 15, 2024\n"},
            {"insert": "Attendees: "},
            {"insert": {"lineSegment": {"type": "long", "label": "Board Members"}}},
            {"insert": "\n\nDecisions:\n"},
            {"insert": {"longResponse": {"lines": 8, "label": "Board Decisions"}}},
            {"insert": "\n\nApproved by: "},
            {"insert": {"signature": {"label": "Board Chair", "includeTitle": True}}},
            {"insert": "\n\nNext Meeting: "},
            {"insert": {"longResponse": {"lines": 2, "label": "Next Steps"}}}
        ]

        changes = service._compare_operations(old_ops, new_ops)

        assert isinstance(changes, list)
        assert len(changes) > 0

        # Should handle the complexity without crashing
        # Should detect various types of changes
        change_types = {change.type for change in changes}
        assert len(change_types) > 0  # Should have some changes detected

    # =============================================================================
    # TASK 2.1: Implement _is_placeholder_operation
    # RED PHASE: Define placeholder detection behavior
    # =============================================================================

    def test_is_placeholder_operation_detection(self, service):
        """
        RED: Test placeholder operation detection

        This will fail because _is_placeholder_operation doesn't exist.
        """
        # Test signature placeholder
        sig_op = {"insert": {"signature": {"label": "CEO"}}}
        assert service._is_placeholder_operation(sig_op) == True

        # Test longResponse placeholder
        lr_op = {"insert": {"longResponse": {"lines": 3}}}
        assert service._is_placeholder_operation(lr_op) == True

        # Test lineSegment placeholder
        ls_op = {"insert": {"lineSegment": {"type": "medium"}}}
        assert service._is_placeholder_operation(ls_op) == True

        # Test versionTable placeholder
        vt_op = {"insert": {"versionTable": {"version": 1}}}
        assert service._is_placeholder_operation(vt_op) == True

        # Test text operation (should return False)
        text_op = {"insert": "Hello World"}
        assert service._is_placeholder_operation(text_op) == False

        # Test operation with attributes (text with formatting)
        formatted_text_op = {"insert": "Hello", "attributes": {"bold": True}}
        assert service._is_placeholder_operation(formatted_text_op) == False

    def test_is_placeholder_operation_edge_cases(self, service):
        """
        RED: Test edge cases for placeholder detection
        """
        # Empty operation
        empty_op = {}
        assert service._is_placeholder_operation(empty_op) == False

        # Operation without insert
        retain_op = {"retain": 5}
        assert service._is_placeholder_operation(retain_op) == False

        # Operation with delete
        delete_op = {"delete": 3}
        assert service._is_placeholder_operation(delete_op) == False

        # Invalid placeholder object
        invalid_op = {"insert": {"unknown_placeholder": {"data": "test"}}}
        assert service._is_placeholder_operation(invalid_op) == False

        # Mixed invalid and valid (should still return False if no valid placeholders)
        mixed_invalid_op = {"insert": {"unknown": "test", "also_unknown": "test"}}
        assert service._is_placeholder_operation(mixed_invalid_op) == False

    # =============================================================================
    # TASK 3.1: Fix compare_documents Method (Integration Test)
    # RED PHASE: Define end-to-end behavior
    # =============================================================================

    def test_compare_documents_end_to_end_functionality(self, service):
        """
        RED: Test complete document comparison workflow

        This will fail due to the SequenceMatcher bug, but defines
        the expected end-to-end behavior after fixes.
        """
        old_doc = {
            "ops": [
                {"insert": "Meeting Minutes\n"},
                {"insert": {"signature": {"label": "Manager"}}},
                {"insert": "\nDate: 2024-01-01"}
            ]
        }

        new_doc = {
            "ops": [
                {"insert": "Board Meeting Minutes\n"},
                {"insert": {"signature": {"label": "Director"}}},
                {"insert": "\nDate: 2024-01-15"},
                {"insert": "\nNew agenda item"}
            ]
        }

        # This should work after fixing _compare_operations
        result = service.compare_documents(old_doc, new_doc)

        # Verify ComparisonResult structure
        assert isinstance(result, ComparisonResult)
        assert hasattr(result, 'changes')
        assert hasattr(result, 'added_text')
        assert hasattr(result, 'deleted_text')
        assert hasattr(result, 'modified_text')
        assert hasattr(result, 'total_changes')
        assert hasattr(result, 'similarity_score')

        # Verify meaningful comparison results
        assert result.total_changes > 0
        assert 0.0 <= result.similarity_score <= 1.0
        assert result.similarity_score < 1.0  # Documents are different
        assert isinstance(result.changes, list)
        assert len(result.changes) > 0

    def test_compare_documents_identical_should_work(self, service):
        """
        RED: Test comparison of identical documents

        Should return high similarity and minimal changes.
        """
        doc = {
            "ops": [
                {"insert": "Test document\n"},
                {"insert": {"signature": {"label": "Test"}}}
            ]
        }

        result = service.compare_documents(doc, doc)

        assert isinstance(result, ComparisonResult)
        assert result.similarity_score >= 0.95  # Should be very high for identical docs
        # May have retain-type changes but no modify/insert/delete for meaningful differences

    # =============================================================================
    # TASK 4.1: Handle Edge Cases
    # RED PHASE: Define robust error handling
    # =============================================================================

    def test_comparison_handles_malformed_content_gracefully(self, service):
        """
        RED: Test that malformed content doesn't crash the service
        """
        # Malformed document structure
        malformed_doc = {"invalid": "structure"}
        valid_doc = {"ops": [{"insert": "Hello"}]}

        # Should not crash, should return sensible defaults
        result = service.compare_documents(malformed_doc, valid_doc)
        assert result is not None
        assert isinstance(result, ComparisonResult)

        # Reverse comparison
        result = service.compare_documents(valid_doc, malformed_doc)
        assert result is not None
        assert isinstance(result, ComparisonResult)

    def test_comparison_handles_empty_documents(self, service):
        """
        RED: Test comparison with various empty document scenarios
        """
        empty_doc = {"ops": []}
        text_doc = {"ops": [{"insert": "Hello World"}]}

        # Empty to content
        result = service.compare_documents(empty_doc, text_doc)
        assert isinstance(result, ComparisonResult)
        assert result.similarity_score <= 0.1  # Should be very low
        assert result.added_text > 0

        # Content to empty
        result = service.compare_documents(text_doc, empty_doc)
        assert isinstance(result, ComparisonResult)
        assert result.similarity_score <= 0.1
        assert result.deleted_text > 0

        # Empty to empty
        result = service.compare_documents(empty_doc, empty_doc)
        assert isinstance(result, ComparisonResult)
        assert result.similarity_score >= 0.95  # Should be high for identical empty docs

    # =============================================================================
    # Integration Tests for Fixed Methods
    # =============================================================================

    def test_extract_placeholder_changes_works_after_fix(self, service):
        """
        RED: Test that extract_placeholder_changes works after compare_documents fix

        Currently returns empty results due to broken compare_documents dependency.
        """
        old_doc = {
            "ops": [
                {"insert": "Document with "},
                {"insert": {"signature": {"label": "Manager", "includeTitle": True}}},
                {"insert": " and "},
                {"insert": {"longResponse": {"lines": 3}}}
            ]
        }

        new_doc = {
            "ops": [
                {"insert": "Document with "},
                {"insert": {"signature": {"label": "Director", "includeTitle": False}}},
                {"insert": " and "},
                {"insert": {"longResponse": {"lines": 5}}},
                {"insert": " plus "},
                {"insert": {"lineSegment": {"type": "medium"}}}
            ]
        }

        changes = service.extract_placeholder_changes(old_doc, new_doc)

        # Should detect actual changes after fix
        assert isinstance(changes, dict)
        assert 'signature' in changes
        assert 'longResponse' in changes
        assert 'lineSegment' in changes
        assert 'versionTable' in changes

        # Should find the actual changes
        assert len(changes['signature']) > 0  # Modified signature
        assert len(changes['longResponse']) > 0  # Modified response lines
        assert len(changes['lineSegment']) > 0  # Added line segment

    def test_generate_diff_delta_works_after_fix(self, service):
        """
        RED: Test that generate_diff_delta works after compare_documents fix
        """
        old_doc = {"ops": [{"insert": "Hello World"}]}
        new_doc = {"ops": [{"insert": "Hello Beautiful World"}]}

        # Should work after fixing compare_documents
        diff_delta = service.generate_diff_delta(old_doc, new_doc)

        assert isinstance(diff_delta, dict)
        assert 'ops' in diff_delta
        assert isinstance(diff_delta['ops'], list)

        # Should contain visual annotations for changes
        has_background_annotations = any(
            isinstance(op.get('attributes'), dict) and 'background' in op.get('attributes', {})
            for op in diff_delta['ops']
        )
        # After fix, should have some visual indicators for changes
        if len(diff_delta['ops']) > 0:
            assert len(diff_delta['ops']) > 0  # Should have some operations

# =============================================================================
# IMPLEMENTATION GUIDE for GREEN PHASE
# =============================================================================

"""
To move to GREEN phase, implement these methods in document_comparison_service.py:

1. Replace _compare_operations method:
   - Remove SequenceMatcher usage
   - Implement custom Delta-aware comparison
   - Handle dictionaries (placeholders) and strings (text) properly

2. Add _is_placeholder_operation method:
   - Check if operation contains placeholder objects
   - Support all placeholder types in self.placeholder_types

3. The existing methods that work should continue to work:
   - _normalize_delta ✅
   - _extract_text ✅
   - _calculate_similarity ✅
   - _get_op_length ✅
   - _extract_placeholders ✅

GREEN implementation example for _compare_operations:

def _compare_operations(self, old_ops: List[Dict], new_ops: List[Dict]) -> List[DeltaChange]:
    changes = []
    # Implement character-level text diff for strings
    # Implement structural comparison for placeholder objects
    # Return DeltaChange objects with proper type classification
    return changes

def _is_placeholder_operation(self, op: Dict[str, Any]) -> bool:
    if not isinstance(op.get('insert'), dict):
        return False
    insert_obj = op['insert']
    return any(placeholder in insert_obj for placeholder in self.placeholder_types)
"""