"""
Document comparison service for Delta format content
Provides diff, merge, and comparison utilities for Quill documents
"""
from typing import List, Dict, Any, Tuple, Optional, Set
from dataclasses import dataclass
from difflib import SequenceMatcher
import json
import re


@dataclass
class DeltaChange:
    """Represents a change between two Delta operations"""
    type: str  # 'insert', 'delete', 'modify', 'retain'
    old_op: Optional[Dict[str, Any]] = None
    new_op: Optional[Dict[str, Any]] = None
    position: int = 0
    length: int = 0
    attributes_changed: List[str] = None


@dataclass
class ComparisonResult:
    """Result of comparing two Delta documents"""
    changes: List[DeltaChange]
    added_text: int
    deleted_text: int
    modified_text: int
    total_changes: int
    similarity_score: float


class DocumentComparisonService:
    """Service for comparing Quill Delta documents"""
    
    def __init__(self):
        self.placeholder_types = {
            'signature', 'longResponse', 'lineSegment', 'versionTable'
        }
    
    def compare_documents(
        self, 
        old_content: Dict[str, Any], 
        new_content: Dict[str, Any]
    ) -> ComparisonResult:
        """
        Compare two Delta documents and return detailed change information
        
        Args:
            old_content: Original document Delta
            new_content: Modified document Delta
            
        Returns:
            ComparisonResult with detailed change analysis
        """
        # Normalize Delta content
        old_ops = self._normalize_delta(old_content)
        new_ops = self._normalize_delta(new_content)
        
        # Extract text content for high-level comparison
        old_text = self._extract_text(old_ops)
        new_text = self._extract_text(new_ops)
        
        # Perform detailed operation-level comparison
        changes = self._compare_operations(old_ops, new_ops)
        
        # Calculate statistics
        added_text = sum(len(self._get_text_content(change.new_op)) 
                        for change in changes if change.type == 'insert')
        deleted_text = sum(len(self._get_text_content(change.old_op)) 
                          for change in changes if change.type == 'delete')
        modified_text = sum(change.length for change in changes if change.type == 'modify')
        
        # Calculate similarity score using text content
        similarity_score = self._calculate_similarity(old_text, new_text)
        
        return ComparisonResult(
            changes=changes,
            added_text=added_text,
            deleted_text=deleted_text,
            modified_text=modified_text,
            total_changes=len(changes),
            similarity_score=similarity_score
        )
    
    def generate_diff_delta(
        self, 
        old_content: Dict[str, Any], 
        new_content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a Delta that represents the differences between two documents
        This can be used to visualize changes in the editor
        """
        comparison = self.compare_documents(old_content, new_content)
        diff_ops = []
        
        old_ops = self._normalize_delta(old_content)
        new_ops = self._normalize_delta(new_content)
        
        # Build diff operations with change annotations
        position = 0
        
        for change in comparison.changes:
            if change.type == 'retain':
                # Keep unchanged content
                if change.old_op and 'insert' in change.old_op:
                    diff_ops.append(change.old_op)
                    
            elif change.type == 'delete':
                # Mark deleted content with red background
                if change.old_op and 'insert' in change.old_op:
                    deleted_op = change.old_op.copy()
                    if 'attributes' not in deleted_op:
                        deleted_op['attributes'] = {}
                    deleted_op['attributes']['background'] = '#ffebee'  # Light red
                    deleted_op['attributes']['strike'] = True
                    diff_ops.append(deleted_op)
                    
            elif change.type == 'insert':
                # Mark inserted content with green background
                if change.new_op and 'insert' in change.new_op:
                    inserted_op = change.new_op.copy()
                    if 'attributes' not in inserted_op:
                        inserted_op['attributes'] = {}
                    inserted_op['attributes']['background'] = '#e8f5e8'  # Light green
                    diff_ops.append(inserted_op)
                    
            elif change.type == 'modify':
                # Mark modified content with yellow background
                if change.new_op and 'insert' in change.new_op:
                    modified_op = change.new_op.copy()
                    if 'attributes' not in modified_op:
                        modified_op['attributes'] = {}
                    modified_op['attributes']['background'] = '#fff3e0'  # Light orange
                    diff_ops.append(modified_op)
        
        return {'ops': diff_ops}
    
    def merge_documents(
        self,
        base_content: Dict[str, Any],
        left_content: Dict[str, Any],
        right_content: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Perform a three-way merge of documents
        
        Args:
            base_content: Common ancestor document
            left_content: First modified version
            right_content: Second modified version
            
        Returns:
            Tuple of (merged_document, conflicts)
        """
        # Compare both versions against the base
        left_comparison = self.compare_documents(base_content, left_content)
        right_comparison = self.compare_documents(base_content, right_content)
        
        # Identify conflicts (changes to same locations)
        conflicts = self._find_conflicts(left_comparison.changes, right_comparison.changes)
        
        # Build merged document
        merged_ops = self._merge_operations(
            base_content, left_content, right_content, conflicts
        )
        
        return {'ops': merged_ops}, conflicts
    
    def extract_placeholder_changes(
        self, 
        old_content: Dict[str, Any], 
        new_content: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract changes specific to placeholder objects
        
        Returns:
            Dictionary with placeholder type as key and list of changes as value
        """
        old_placeholders = self._extract_placeholders(old_content)
        new_placeholders = self._extract_placeholders(new_content)
        
        placeholder_changes = {
            'signature': [],
            'longResponse': [],
            'lineSegment': [],
            'versionTable': []
        }
        
        # Compare placeholders of each type
        for placeholder_type in self.placeholder_types:
            old_items = old_placeholders.get(placeholder_type, [])
            new_items = new_placeholders.get(placeholder_type, [])
            
            changes = self._compare_placeholder_lists(old_items, new_items, placeholder_type)
            placeholder_changes[placeholder_type] = changes
        
        return placeholder_changes
    
    def _normalize_delta(self, content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Normalize Delta content to a list of operations"""
        if not isinstance(content, dict) or 'ops' not in content:
            return []
        
        ops = content['ops']
        if not isinstance(ops, list):
            return []
        
        return ops
    
    def _extract_text(self, ops: List[Dict[str, Any]]) -> str:
        """Extract plain text content from Delta operations"""
        text = ""
        for op in ops:
            if isinstance(op.get('insert'), str):
                text += op['insert']
            elif isinstance(op.get('insert'), dict):
                # Handle placeholders as special markers
                insert_obj = op['insert']
                if any(placeholder in insert_obj for placeholder in self.placeholder_types):
                    text += f"[{list(insert_obj.keys())[0].upper()}]"
        
        return text
    
    def _compare_operations(
        self, 
        old_ops: List[Dict[str, Any]], 
        new_ops: List[Dict[str, Any]]
    ) -> List[DeltaChange]:
        """Compare operations between two Delta documents"""
        changes = []
        
        # Use sequence matcher for high-level alignment
        matcher = SequenceMatcher(None, old_ops, new_ops)
        
        position = 0
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                # Operations are identical - retain
                for k in range(i1, i2):
                    changes.append(DeltaChange(
                        type='retain',
                        old_op=old_ops[k],
                        new_op=new_ops[j1 + (k - i1)] if j1 + (k - i1) < j2 else None,
                        position=position,
                        length=self._get_op_length(old_ops[k])
                    ))
                    position += self._get_op_length(old_ops[k])
                    
            elif tag == 'delete':
                # Operations were deleted
                for k in range(i1, i2):
                    changes.append(DeltaChange(
                        type='delete',
                        old_op=old_ops[k],
                        position=position,
                        length=self._get_op_length(old_ops[k])
                    ))
                    position += self._get_op_length(old_ops[k])
                    
            elif tag == 'insert':
                # Operations were inserted
                for k in range(j1, j2):
                    changes.append(DeltaChange(
                        type='insert',
                        new_op=new_ops[k],
                        position=position,
                        length=self._get_op_length(new_ops[k])
                    ))
                    
            elif tag == 'replace':
                # Operations were modified
                for k in range(max(i2 - i1, j2 - j1)):
                    old_op = old_ops[i1 + k] if i1 + k < i2 else None
                    new_op = new_ops[j1 + k] if j1 + k < j2 else None
                    
                    if old_op and new_op:
                        # Check if it's a modification or replacement
                        attrs_changed = self._compare_attributes(old_op, new_op)
                        changes.append(DeltaChange(
                            type='modify',
                            old_op=old_op,
                            new_op=new_op,
                            position=position,
                            length=self._get_op_length(old_op),
                            attributes_changed=attrs_changed
                        ))
                        position += self._get_op_length(old_op)
                    elif old_op:
                        changes.append(DeltaChange(
                            type='delete',
                            old_op=old_op,
                            position=position,
                            length=self._get_op_length(old_op)
                        ))
                        position += self._get_op_length(old_op)
                    elif new_op:
                        changes.append(DeltaChange(
                            type='insert',
                            new_op=new_op,
                            position=position,
                            length=self._get_op_length(new_op)
                        ))
        
        return changes
    
    def _get_op_length(self, op: Dict[str, Any]) -> int:
        """Get the length of a Delta operation"""
        if isinstance(op.get('insert'), str):
            return len(op['insert'])
        elif isinstance(op.get('insert'), dict):
            return 1  # Embedded objects count as 1 character
        elif 'retain' in op:
            return op['retain']
        elif 'delete' in op:
            return op['delete']
        return 0
    
    def _get_text_content(self, op: Optional[Dict[str, Any]]) -> str:
        """Get text content from an operation"""
        if not op:
            return ""
        
        if isinstance(op.get('insert'), str):
            return op['insert']
        
        return ""
    
    def _compare_attributes(
        self, 
        old_op: Dict[str, Any], 
        new_op: Dict[str, Any]
    ) -> List[str]:
        """Compare attributes between two operations"""
        old_attrs = old_op.get('attributes', {})
        new_attrs = new_op.get('attributes', {})
        
        changed_attrs = []
        
        # Check for added/modified attributes
        for attr, value in new_attrs.items():
            if attr not in old_attrs or old_attrs[attr] != value:
                changed_attrs.append(attr)
        
        # Check for removed attributes
        for attr in old_attrs:
            if attr not in new_attrs:
                changed_attrs.append(attr)
        
        return changed_attrs
    
    def _calculate_similarity(self, old_text: str, new_text: str) -> float:
        """Calculate similarity score between two text strings"""
        if not old_text and not new_text:
            return 1.0
        
        if not old_text or not new_text:
            return 0.0
        
        matcher = SequenceMatcher(None, old_text, new_text)
        return matcher.ratio()
    
    def _extract_placeholders(self, content: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract all placeholder objects from Delta content"""
        placeholders = {
            'signature': [],
            'longResponse': [],
            'lineSegment': [],
            'versionTable': []
        }
        
        ops = self._normalize_delta(content)
        position = 0
        
        for op in ops:
            if isinstance(op.get('insert'), dict):
                insert_obj = op['insert']
                
                for placeholder_type in self.placeholder_types:
                    if placeholder_type in insert_obj:
                        placeholders[placeholder_type].append({
                            'data': insert_obj[placeholder_type],
                            'position': position
                        })
            
            position += self._get_op_length(op)
        
        return placeholders
    
    def _compare_placeholder_lists(
        self, 
        old_items: List[Dict[str, Any]], 
        new_items: List[Dict[str, Any]], 
        placeholder_type: str
    ) -> List[Dict[str, Any]]:
        """Compare lists of placeholder objects"""
        changes = []
        
        # Simple comparison for now - can be enhanced for more sophisticated matching
        max_len = max(len(old_items), len(new_items))
        
        for i in range(max_len):
            old_item = old_items[i] if i < len(old_items) else None
            new_item = new_items[i] if i < len(new_items) else None
            
            if old_item and new_item:
                # Compare placeholder data
                if old_item['data'] != new_item['data']:
                    changes.append({
                        'type': 'modified',
                        'placeholder_type': placeholder_type,
                        'old_data': old_item['data'],
                        'new_data': new_item['data'],
                        'position': new_item['position']
                    })
            elif old_item:
                changes.append({
                    'type': 'deleted',
                    'placeholder_type': placeholder_type,
                    'old_data': old_item['data'],
                    'position': old_item['position']
                })
            elif new_item:
                changes.append({
                    'type': 'added',
                    'placeholder_type': placeholder_type,
                    'new_data': new_item['data'],
                    'position': new_item['position']
                })
        
        return changes
    
    def _find_conflicts(
        self, 
        left_changes: List[DeltaChange], 
        right_changes: List[DeltaChange]
    ) -> List[Dict[str, Any]]:
        """Find conflicts between two sets of changes"""
        conflicts = []
        
        # Simple conflict detection based on overlapping positions
        for left_change in left_changes:
            for right_change in right_changes:
                if self._changes_conflict(left_change, right_change):
                    conflicts.append({
                        'type': 'content_conflict',
                        'left_change': left_change,
                        'right_change': right_change,
                        'position': left_change.position
                    })
        
        return conflicts
    
    def _changes_conflict(self, left: DeltaChange, right: DeltaChange) -> bool:
        """Check if two changes conflict with each other"""
        # Changes conflict if they overlap in position
        left_end = left.position + left.length
        right_end = right.position + right.length
        
        return not (left_end <= right.position or right_end <= left.position)
    
    def _merge_operations(
        self,
        base_content: Dict[str, Any],
        left_content: Dict[str, Any],
        right_content: Dict[str, Any],
        conflicts: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge operations from three documents, handling conflicts"""
        # This is a simplified merge - in practice, you'd want more sophisticated merging
        base_ops = self._normalize_delta(base_content)
        left_ops = self._normalize_delta(left_content)
        right_ops = self._normalize_delta(right_content)
        
        # For conflicts, we'll mark them as unresolved and require manual resolution
        merged_ops = []
        
        # Start with left changes and merge in right changes where possible
        for op in left_ops:
            # Check if this operation conflicts
            is_conflicted = any(
                self._op_in_conflict_range(op, conflict) 
                for conflict in conflicts
            )
            
            if is_conflicted:
                # Mark as conflict needing resolution
                conflict_op = op.copy()
                if 'attributes' not in conflict_op:
                    conflict_op['attributes'] = {}
                conflict_op['attributes']['background'] = '#ffe0e0'  # Light red for conflicts
                merged_ops.append(conflict_op)
            else:
                merged_ops.append(op)
        
        return merged_ops
    
    def _op_in_conflict_range(self, op: Dict[str, Any], conflict: Dict[str, Any]) -> bool:
        """Check if an operation falls within a conflict range"""
        # Simplified check - would need more sophisticated position tracking
        return False  # Placeholder implementation