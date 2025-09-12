"""
Document comparison and merge API endpoints
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.document import Document
from app.models.document_history import DocumentHistory, DocumentComparison, MergeConflict
from app.schemas.document_comparison import (
    DocumentCompareRequest, DocumentCompareResponse, DocumentMergeRequest,
    DocumentMergeResponse, ConflictResolutionRequest, DocumentHistoryResponse,
    DocumentVersionListResponse, DiffVisualizationRequest, DiffVisualizationResponse,
    DocumentComparisonStatsResponse, MergeConflictSchema, ComparisonResultSchema,
    DeltaChangeSchema, PlaceholderChangeSchema
)
from app.services.document_comparison_service import DocumentComparisonService

router = APIRouter()


# Document version history endpoints

@router.get("/{document_id}/versions", response_model=DocumentVersionListResponse)
def get_document_versions(
    document_id: str,
    include_details: bool = Query(False, description="Include full version details"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get version history for a document"""
    
    # Check if document exists and user has access
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # For now, we'll allow all authenticated users to view versions
    # Later we can add more granular permissions
    
    # Get version history
    query = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id
    ).order_by(desc(DocumentHistory.version_number))
    
    if limit:
        query = query.limit(limit)
    
    versions = query.all()
    
    return DocumentVersionListResponse(
        document_id=document_id,
        current_version=document.version,
        versions=versions,
        total_versions=len(versions)
    )


@router.get("/{document_id}/versions/{version_number}", response_model=DocumentHistoryResponse)
def get_document_version(
    document_id: str,
    version_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific version of a document"""
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the specific version
    version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == version_number
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return version


# Document comparison endpoints

@router.post("/{document_id}/compare", response_model=DocumentCompareResponse)
def compare_document_versions(
    document_id: str,
    compare_request: DocumentCompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Compare two versions of a document"""
    
    if compare_request.document_id != document_id:
        raise HTTPException(status_code=400, detail="Document ID mismatch")
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the versions to compare
    old_version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == compare_request.old_version
    ).first()
    
    new_version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == compare_request.new_version
    ).first()
    
    # If comparing with current version, use document content
    if compare_request.new_version == document.version and not new_version:
        new_content = document.content
    elif not new_version:
        raise HTTPException(status_code=404, detail="New version not found")
    else:
        new_content = new_version.content
    
    if not old_version:
        raise HTTPException(status_code=404, detail="Old version not found")
    
    # Check if comparison already exists
    existing_comparison = db.query(DocumentComparison).filter(
        DocumentComparison.document_id == document_id,
        DocumentComparison.old_version == compare_request.old_version,
        DocumentComparison.new_version == compare_request.new_version
    ).first()
    
    if existing_comparison:
        # Return cached comparison
        comparison_result = ComparisonResultSchema(**existing_comparison.comparison_result)
        placeholder_changes = existing_comparison.placeholder_changes or {}
        
        return DocumentCompareResponse(
            document_id=document_id,
            old_version=compare_request.old_version,
            new_version=compare_request.new_version,
            comparison_result=comparison_result,
            diff_delta=existing_comparison.diff_delta,
            placeholder_changes=placeholder_changes,
            created_at=existing_comparison.created_at
        )
    
    # Perform comparison
    comparison_service = DocumentComparisonService()
    
    try:
        comparison_result = comparison_service.compare_documents(
            old_version.content, new_content
        )
        
        # Generate diff delta if requested
        diff_delta = None
        if compare_request.generate_diff_delta:
            diff_delta = comparison_service.generate_diff_delta(
                old_version.content, new_content
            )
        
        # Extract placeholder changes if requested
        placeholder_changes = {}
        if compare_request.include_placeholders:
            placeholder_changes = comparison_service.extract_placeholder_changes(
                old_version.content, new_content
            )
        
        # Store comparison results
        db_comparison = DocumentComparison(
            document_id=document_id,
            old_version=compare_request.old_version,
            new_version=compare_request.new_version,
            comparison_result={
                'changes': [
                    {
                        'type': change.type,
                        'old_op': change.old_op,
                        'new_op': change.new_op,
                        'position': change.position,
                        'length': change.length,
                        'attributes_changed': change.attributes_changed
                    }
                    for change in comparison_result.changes
                ],
                'added_text': comparison_result.added_text,
                'deleted_text': comparison_result.deleted_text,
                'modified_text': comparison_result.modified_text,
                'total_changes': comparison_result.total_changes,
                'similarity_score': comparison_result.similarity_score
            },
            diff_delta=diff_delta,
            added_text=comparison_result.added_text,
            deleted_text=comparison_result.deleted_text,
            modified_text=comparison_result.modified_text,
            similarity_score=int(comparison_result.similarity_score * 100),
            placeholder_changes=placeholder_changes,
            created_by=current_user.id
        )
        
        db.add(db_comparison)
        db.commit()
        db.refresh(db_comparison)
        
        # Convert to response schema
        comparison_result_schema = ComparisonResultSchema(
            changes=[
                DeltaChangeSchema(**change_dict) 
                for change_dict in db_comparison.comparison_result['changes']
            ],
            added_text=comparison_result.added_text,
            deleted_text=comparison_result.deleted_text,
            modified_text=comparison_result.modified_text,
            total_changes=comparison_result.total_changes,
            similarity_score=comparison_result.similarity_score
        )
        
        return DocumentCompareResponse(
            document_id=document_id,
            old_version=compare_request.old_version,
            new_version=compare_request.new_version,
            comparison_result=comparison_result_schema,
            diff_delta=diff_delta,
            placeholder_changes=placeholder_changes,
            created_at=db_comparison.created_at
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.get("/{document_id}/comparisons", response_model=List[DocumentCompareResponse])
def get_document_comparisons(
    document_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comparison history for a document"""
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get comparisons
    comparisons = db.query(DocumentComparison).filter(
        DocumentComparison.document_id == document_id
    ).order_by(desc(DocumentComparison.created_at)).limit(limit).all()
    
    responses = []
    for comp in comparisons:
        comparison_result = ComparisonResultSchema(**comp.comparison_result)
        responses.append(DocumentCompareResponse(
            document_id=comp.document_id,
            old_version=comp.old_version,
            new_version=comp.new_version,
            comparison_result=comparison_result,
            diff_delta=comp.diff_delta,
            placeholder_changes=comp.placeholder_changes or {},
            created_at=comp.created_at
        ))
    
    return responses


# Document merge endpoints

@router.post("/{document_id}/merge", response_model=DocumentMergeResponse)
def merge_document_versions(
    document_id: str,
    merge_request: DocumentMergeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Perform a three-way merge of document versions"""
    
    if merge_request.document_id != document_id:
        raise HTTPException(status_code=400, detail="Document ID mismatch")
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get all three versions
    base_version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == merge_request.base_version
    ).first()
    
    left_version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == merge_request.left_version
    ).first()
    
    right_version = db.query(DocumentHistory).filter(
        DocumentHistory.document_id == document_id,
        DocumentHistory.version_number == merge_request.right_version
    ).first()
    
    if not base_version:
        raise HTTPException(status_code=404, detail="Base version not found")
    if not left_version:
        raise HTTPException(status_code=404, detail="Left version not found")
    if not right_version:
        raise HTTPException(status_code=404, detail="Right version not found")
    
    # Perform merge
    comparison_service = DocumentComparisonService()
    
    try:
        merged_content, conflicts = comparison_service.merge_documents(
            base_version.content,
            left_version.content,
            right_version.content
        )
        
        # Store merge conflicts in database
        db_conflicts = []
        for conflict_data in conflicts:
            db_conflict = MergeConflict(
                document_id=document_id,
                base_version=merge_request.base_version,
                left_version=merge_request.left_version,
                right_version=merge_request.right_version,
                conflict_type=conflict_data.get('type', 'content_conflict'),
                conflict_position=conflict_data.get('position', 0),
                conflict_length=conflict_data.get('length', 0),
                base_content=conflict_data.get('base_content'),
                left_content=conflict_data.get('left_content'),
                right_content=conflict_data.get('right_content'),
                created_by=current_user.id
            )
            
            db.add(db_conflict)
            db_conflicts.append(db_conflict)
        
        db.commit()
        
        # Refresh all conflicts to get their IDs
        for conflict in db_conflicts:
            db.refresh(conflict)
        
        conflict_schemas = [MergeConflictSchema.from_orm(c) for c in db_conflicts]
        
        return DocumentMergeResponse(
            document_id=document_id,
            base_version=merge_request.base_version,
            left_version=merge_request.left_version,
            right_version=merge_request.right_version,
            merged_content=merged_content,
            conflicts=conflict_schemas,
            auto_merged_changes=0,  # TODO: Calculate this
            requires_manual_resolution=len(conflicts) > 0
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")


@router.get("/{document_id}/conflicts", response_model=List[MergeConflictSchema])
def get_merge_conflicts(
    document_id: str,
    resolved: Optional[bool] = Query(None, description="Filter by resolution status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get merge conflicts for a document"""
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    query = db.query(MergeConflict).filter(MergeConflict.document_id == document_id)
    
    if resolved is not None:
        query = query.filter(MergeConflict.is_resolved == resolved)
    
    conflicts = query.order_by(desc(MergeConflict.created_at)).all()
    
    return [MergeConflictSchema.from_orm(c) for c in conflicts]


@router.post("/conflicts/{conflict_id}/resolve", response_model=MergeConflictSchema)
def resolve_merge_conflict(
    conflict_id: str,
    resolution_request: ConflictResolutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resolve a merge conflict"""
    
    if resolution_request.conflict_id != conflict_id:
        raise HTTPException(status_code=400, detail="Conflict ID mismatch")
    
    conflict = db.query(MergeConflict).filter(MergeConflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    
    if conflict.is_resolved:
        raise HTTPException(status_code=400, detail="Conflict already resolved")
    
    # Update conflict resolution
    conflict.is_resolved = True
    conflict.resolved_content = resolution_request.resolved_content
    conflict.resolved_by = current_user.id
    conflict.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(conflict)
    
    return MergeConflictSchema.from_orm(conflict)


# Diff visualization endpoints

@router.post("/{document_id}/diff", response_model=DiffVisualizationResponse)
def generate_diff_visualization(
    document_id: str,
    diff_request: DiffVisualizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a visual diff between document versions"""
    
    # For now, we'll use the existing comparison functionality
    # In the future, this could generate more sophisticated visualizations
    
    compare_request = DocumentCompareRequest(
        document_id=document_id,
        old_version=diff_request.old_version,
        new_version=diff_request.new_version,
        generate_diff_delta=True,
        include_placeholders=diff_request.show_placeholders
    )
    
    comparison = compare_document_versions(document_id, compare_request, db, current_user)
    
    # Generate textual diff representation
    diff_content = f"--- Version {diff_request.old_version}\n"
    diff_content += f"+++ Version {diff_request.new_version}\n"
    diff_content += f"@@ Changes: +{comparison.comparison_result.added_text} -{comparison.comparison_result.deleted_text} @@\n"
    
    # Add basic change summary
    for i, change in enumerate(comparison.comparison_result.changes[:10]):  # Limit to first 10 changes
        if change.type == 'insert':
            diff_content += f"+{change.position}: {change.type}\n"
        elif change.type == 'delete':
            diff_content += f"-{change.position}: {change.type}\n"
        elif change.type == 'modify':
            diff_content += f"~{change.position}: {change.type}\n"
    
    if len(comparison.comparison_result.changes) > 10:
        diff_content += f"... and {len(comparison.comparison_result.changes) - 10} more changes\n"
    
    return DiffVisualizationResponse(
        document_id=document_id,
        old_version=diff_request.old_version,
        new_version=diff_request.new_version,
        format=diff_request.format,
        diff_content=diff_content,
        diff_delta=comparison.diff_delta or {},
        statistics=comparison.comparison_result
    )


# Statistics endpoints

@router.get("/{document_id}/comparison-stats", response_model=DocumentComparisonStatsResponse)
def get_document_comparison_stats(
    document_id: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comparison statistics for a document"""
    
    # Check if document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get comparison statistics
    comparisons = db.query(DocumentComparison).filter(
        DocumentComparison.document_id == document_id
    ).all()
    
    if not comparisons:
        return DocumentComparisonStatsResponse(
            document_id=document_id,
            total_comparisons=0,
            average_similarity=0.0,
            most_common_change_types={},
            version_activity={},
            recent_comparisons=[]
        )
    
    total_comparisons = len(comparisons)
    average_similarity = sum(c.similarity_score for c in comparisons) / total_comparisons / 100.0
    
    # Analyze change types (simplified)
    change_types = {}
    version_activity = {}
    
    for comp in comparisons:
        # Track version activity
        version_activity[comp.new_version] = version_activity.get(comp.new_version, 0) + 1
        
        # Count change types
        for change in comp.comparison_result.get('changes', []):
            change_type = change.get('type', 'unknown')
            change_types[change_type] = change_types.get(change_type, 0) + 1
    
    # Get recent comparisons
    recent_comparisons = db.query(DocumentComparison).filter(
        DocumentComparison.document_id == document_id
    ).order_by(desc(DocumentComparison.created_at)).limit(5).all()
    
    recent_responses = []
    for comp in recent_comparisons:
        comparison_result = ComparisonResultSchema(**comp.comparison_result)
        recent_responses.append(DocumentCompareResponse(
            document_id=comp.document_id,
            old_version=comp.old_version,
            new_version=comp.new_version,
            comparison_result=comparison_result,
            diff_delta=comp.diff_delta,
            placeholder_changes=comp.placeholder_changes or {},
            created_at=comp.created_at
        ))
    
    return DocumentComparisonStatsResponse(
        document_id=document_id,
        total_comparisons=total_comparisons,
        average_similarity=average_similarity,
        most_common_change_types=change_types,
        version_activity=version_activity,
        recent_comparisons=recent_responses
    )