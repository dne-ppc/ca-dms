"""
Compliance API endpoints for GDPR/CCPA features
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.compliance import (
    UserConsent, DataRetentionPolicy, DataDeletionRequest,
    PrivacyImpactAssessment, ComplianceReport, DataProcessingActivity
)
from app.schemas.compliance import (
    UserConsent as UserConsentSchema,
    UserConsentCreate, UserConsentUpdate,
    DataRetentionPolicy as DataRetentionPolicySchema,
    DataRetentionPolicyCreate, DataRetentionPolicyUpdate,
    DataDeletionRequest as DataDeletionRequestSchema,
    DataDeletionRequestCreate, DataDeletionRequestUpdate,
    PrivacyImpactAssessment as PrivacyImpactAssessmentSchema,
    PrivacyImpactAssessmentCreate, PrivacyImpactAssessmentUpdate,
    ComplianceReport as ComplianceReportSchema,
    ComplianceReportCreate, ComplianceReportUpdate,
    DataProcessingActivity as DataProcessingActivitySchema,
    DataProcessingActivityCreate, DataProcessingActivityUpdate,
    UserDataExportRequest, UserDataExport,
    ConsentBatchOperation, ConsentBatchResult,
    ComplianceMetrics, ComplianceDashboard
)
from app.services.compliance_service import (
    DataRetentionService, ConsentManagementService, DataExportService,
    ComplianceMetricsService
)
from app.services.pia_service import PIAWorkflowService
from app.core.logging import logger

router = APIRouter()


# User Consent Endpoints
@router.post("/consent", response_model=UserConsentSchema)
async def create_user_consent(
    consent_data: UserConsentCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new user consent record"""
    service = ConsentManagementService(db)

    consent_dict = consent_data.dict()
    ip_address = request.client.host
    user_agent = request.headers.get("user-agent")

    return service.record_consent(
        user_id=current_user.id,
        consent_data=consent_dict,
        ip_address=ip_address,
        user_agent=user_agent
    )


@router.get("/consent", response_model=List[UserConsentSchema])
async def get_user_consents(
    consent_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's consent records"""
    service = ConsentManagementService(db)
    return service.get_user_consents(current_user.id, consent_type)


@router.put("/consent/{consent_id}/withdraw")
async def withdraw_consent(
    consent_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Withdraw user consent"""
    service = ConsentManagementService(db)
    return service.withdraw_consent(current_user.id, consent_id, reason)


@router.post("/consent/batch", response_model=ConsentBatchResult)
async def batch_consent_operation(
    operation: ConsentBatchOperation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Perform batch consent operations (admin only)"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    service = ConsentManagementService(db)
    return service.batch_consent_operation(operation, current_user.id)


# Data Retention Policy Endpoints
@router.post("/retention-policies", response_model=DataRetentionPolicySchema)
async def create_retention_policy(
    policy_data: DataRetentionPolicyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new data retention policy (admin only)"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    policy = DataRetentionPolicy(**policy_data.dict())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/retention-policies", response_model=List[DataRetentionPolicySchema])
async def get_retention_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=100),
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get retention policies"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    query = db.query(DataRetentionPolicy)
    if active_only:
        query = query.filter(DataRetentionPolicy.is_active == True)

    return query.offset(skip).limit(limit).all()


@router.put("/retention-policies/{policy_id}", response_model=DataRetentionPolicySchema)
async def update_retention_policy(
    policy_id: str,
    policy_data: DataRetentionPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a retention policy (admin only)"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    policy = db.query(DataRetentionPolicy).get(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    update_data = policy_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)

    db.commit()
    db.refresh(policy)
    return policy


@router.post("/retention-policies/{policy_id}/execute")
async def execute_retention_policy(
    policy_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute retention policy automation (admin only)"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    policy = db.query(DataRetentionPolicy).get(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    service = DataRetentionService(db)

    # Execute in background to avoid timeout
    background_tasks.add_task(service.execute_automated_deletion, policy)

    return {"message": "Retention policy execution started", "policy_id": policy_id}


@router.get("/retention-policies/{policy_id}/preview")
async def preview_retention_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview items that would be affected by retention policy"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    policy = db.query(DataRetentionPolicy).get(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    service = DataRetentionService(db)
    expired_items = service.get_expired_data(policy.data_category, policy.resource_type)

    return {
        "policy": policy,
        "expired_items_count": len(expired_items),
        "expired_items": expired_items[:20],  # Limit preview
        "preview_generated_at": datetime.utcnow()
    }


# Data Deletion Request Endpoints
@router.post("/deletion-requests", response_model=DataDeletionRequestSchema)
async def create_deletion_request(
    request_data: DataDeletionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a data deletion request"""
    deletion_request = DataDeletionRequest(
        user_id=current_user.id,
        **request_data.dict(),
        status="pending"
    )
    db.add(deletion_request)
    db.commit()
    db.refresh(deletion_request)
    return deletion_request


@router.get("/deletion-requests", response_model=List[DataDeletionRequestSchema])
async def get_deletion_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get deletion requests (admin sees all, users see their own)"""
    query = db.query(DataDeletionRequest)

    if not current_user.has_permission("admin"):
        query = query.filter(DataDeletionRequest.user_id == current_user.id)

    if status:
        query = query.filter(DataDeletionRequest.status == status)

    return query.order_by(DataDeletionRequest.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/deletion-requests/{request_id}", response_model=DataDeletionRequestSchema)
async def update_deletion_request(
    request_id: str,
    update_data: DataDeletionRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update deletion request status (admin only)"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    request_obj = db.query(DataDeletionRequest).get(request_id)
    if not request_obj:
        raise HTTPException(status_code=404, detail="Deletion request not found")

    update_fields = update_data.dict(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(request_obj, field, value)

    db.commit()
    db.refresh(request_obj)
    return request_obj


# Data Export Endpoints (GDPR Right to Portability)
@router.post("/data-export", response_model=UserDataExport)
async def request_data_export(
    export_request: UserDataExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request user data export for GDPR compliance"""
    # Users can only export their own data unless admin
    if export_request.user_id != current_user.id and not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Can only export your own data")

    service = DataExportService(db)

    # Process export in background to avoid timeout
    return service.export_user_data(export_request)


@router.get("/data-export/{export_id}")
async def download_data_export(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download exported data file"""
    # In a real implementation, this would return the actual file
    # For now, return export metadata
    return {"message": "Export download endpoint", "export_id": export_id}


# Privacy Impact Assessment Endpoints
@router.post("/pia", response_model=PrivacyImpactAssessmentSchema)
async def create_pia(
    pia_data: PrivacyImpactAssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new Privacy Impact Assessment"""
    if not current_user.has_permission("create"):
        raise HTTPException(status_code=403, detail="Create permission required")

    service = PIAWorkflowService(db)
    return service.create_pia(pia_data, current_user.id)


@router.get("/pia", response_model=List[PrivacyImpactAssessmentSchema])
async def get_pias(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Privacy Impact Assessments"""
    if not current_user.has_permission("read"):
        raise HTTPException(status_code=403, detail="Read permission required")

    query = db.query(PrivacyImpactAssessment)

    if status:
        query = query.filter(PrivacyImpactAssessment.status == status)

    if risk_level:
        query = query.filter(PrivacyImpactAssessment.overall_risk_level == risk_level)

    return query.order_by(PrivacyImpactAssessment.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/pia/{pia_id}", response_model=PrivacyImpactAssessmentSchema)
async def get_pia(
    pia_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific Privacy Impact Assessment"""
    if not current_user.has_permission("read"):
        raise HTTPException(status_code=403, detail="Read permission required")

    pia = db.query(PrivacyImpactAssessment).get(pia_id)
    if not pia:
        raise HTTPException(status_code=404, detail="PIA not found")

    return pia


@router.put("/pia/{pia_id}", response_model=PrivacyImpactAssessmentSchema)
async def update_pia(
    pia_id: str,
    pia_data: PrivacyImpactAssessmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a Privacy Impact Assessment"""
    service = PIAWorkflowService(db)
    return service.update_pia(pia_id, pia_data, current_user.id)


@router.post("/pia/{pia_id}/submit")
async def submit_pia_for_review(
    pia_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit PIA for review"""
    service = PIAWorkflowService(db)
    return service.submit_for_review(pia_id, current_user.id)


@router.post("/pia/{pia_id}/approve")
async def approve_pia(
    pia_id: str,
    approval_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a Privacy Impact Assessment (admin/board member only)"""
    if not current_user.has_permission("approve"):
        raise HTTPException(status_code=403, detail="Approval permission required")

    service = PIAWorkflowService(db)
    return service.approve_pia(pia_id, current_user.id, approval_notes)


@router.post("/pia/{pia_id}/reject")
async def reject_pia(
    pia_id: str,
    rejection_reason: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a Privacy Impact Assessment (admin/board member only)"""
    if not current_user.has_permission("approve"):
        raise HTTPException(status_code=403, detail="Approval permission required")

    service = PIAWorkflowService(db)
    return service.reject_pia(pia_id, current_user.id, rejection_reason)


@router.post("/pia/{pia_id}/review")
async def conduct_pia_review(
    pia_id: str,
    review_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Conduct periodic PIA review"""
    if not current_user.has_permission("approve"):
        raise HTTPException(status_code=403, detail="Approval permission required")

    service = PIAWorkflowService(db)
    return service.conduct_pia_review(pia_id, current_user.id, review_data)


@router.get("/pia/overdue", response_model=List[PrivacyImpactAssessmentSchema])
async def get_overdue_pias(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get PIAs that are overdue for review"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    service = PIAWorkflowService(db)
    return service.get_overdue_pias()


@router.get("/pia/template/{processing_type}")
async def get_pia_template(
    processing_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get PIA template for specific processing type"""
    if not current_user.has_permission("create"):
        raise HTTPException(status_code=403, detail="Create permission required")

    service = PIAWorkflowService(db)
    return service.generate_pia_template(processing_type)


# Data Processing Activities (GDPR Article 30)
@router.post("/processing-activities", response_model=DataProcessingActivitySchema)
async def create_processing_activity(
    activity_data: DataProcessingActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new data processing activity record"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    activity = DataProcessingActivity(
        **activity_data.dict(),
        created_by=current_user.id
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/processing-activities", response_model=List[DataProcessingActivitySchema])
async def get_processing_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get data processing activities"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    query = db.query(DataProcessingActivity)

    if status:
        query = query.filter(DataProcessingActivity.status == status)

    return query.order_by(DataProcessingActivity.created_at.desc()).offset(skip).limit(limit).all()


# Compliance Metrics and Dashboard
@router.get("/metrics", response_model=ComplianceMetrics)
async def get_compliance_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance metrics"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    service = ComplianceMetricsService(db)
    return service.generate_compliance_metrics()


@router.get("/dashboard", response_model=ComplianceDashboard)
async def get_compliance_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance dashboard"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    service = ComplianceMetricsService(db)
    return service.generate_compliance_dashboard()


@router.get("/pia/statistics")
async def get_pia_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get PIA statistics for dashboard"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    service = PIAWorkflowService(db)
    return service.get_pia_statistics()


# Compliance Reports
@router.post("/reports", response_model=ComplianceReportSchema)
async def generate_compliance_report(
    report_data: ComplianceReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate compliance report"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    report = ComplianceReport(
        **report_data.dict(),
        generated_by=current_user.id,
        status="draft"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Generate report content in background
    # background_tasks.add_task(generate_report_content, report.id)

    return report


@router.get("/reports", response_model=List[ComplianceReportSchema])
async def get_compliance_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=50),
    report_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance reports"""
    if not current_user.has_permission("audit_read"):
        raise HTTPException(status_code=403, detail="Audit read permission required")

    query = db.query(ComplianceReport)

    if report_type:
        query = query.filter(ComplianceReport.report_type == report_type)

    return query.order_by(ComplianceReport.created_at.desc()).offset(skip).limit(limit).all()