"""
Privacy Impact Assessment (PIA) workflow service
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from fastapi import HTTPException

from app.models.compliance import PrivacyImpactAssessment
from app.models.user import User
from app.models.security import AuditLog, AuditEventType, AuditSeverity
from app.schemas.compliance import (
    PrivacyImpactAssessmentCreate, PrivacyImpactAssessmentUpdate
)
from app.core.logging import logger


class PIAWorkflowService:
    """Service for managing Privacy Impact Assessment workflows"""

    def __init__(self, db: Session):
        self.db = db

    def create_pia(self, pia_data: PrivacyImpactAssessmentCreate,
                   created_by: str) -> PrivacyImpactAssessment:
        """Create a new Privacy Impact Assessment"""
        pia = PrivacyImpactAssessment(
            **pia_data.dict(),
            created_by=created_by,
            status="draft"
        )

        self.db.add(pia)
        self.db.commit()
        self.db.refresh(pia)

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
            severity=AuditSeverity.MEDIUM,
            message=f"Privacy Impact Assessment created: {pia.title}",
            user_id=created_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "title": pia.title,
                "overall_risk_level": pia.overall_risk_level,
                "data_categories": pia.data_categories,
                "processing_purpose": pia.processing_purpose[:200] + "..." if len(pia.processing_purpose) > 200 else pia.processing_purpose
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        logger.info(f"Created PIA: {pia.title} (ID: {pia.id})")
        return pia

    def update_pia(self, pia_id: str, pia_data: PrivacyImpactAssessmentUpdate,
                   updated_by: str) -> PrivacyImpactAssessment:
        """Update a Privacy Impact Assessment"""
        pia = self.db.query(PrivacyImpactAssessment).get(pia_id)
        if not pia:
            raise HTTPException(status_code=404, detail="PIA not found")

        # Store old values for audit
        old_status = pia.status
        old_risk_level = pia.overall_risk_level

        # Update fields
        update_data = pia_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pia, field, value)

        self.db.commit()
        self.db.refresh(pia)

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
            severity=AuditSeverity.MEDIUM,
            message=f"Privacy Impact Assessment updated: {pia.title}",
            user_id=updated_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "updated_fields": list(update_data.keys()),
                "old_status": old_status,
                "new_status": pia.status,
                "old_risk_level": old_risk_level,
                "new_risk_level": pia.overall_risk_level
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return pia

    def submit_for_review(self, pia_id: str, submitted_by: str) -> PrivacyImpactAssessment:
        """Submit PIA for review"""
        pia = self.db.query(PrivacyImpactAssessment).get(pia_id)
        if not pia:
            raise HTTPException(status_code=404, detail="PIA not found")

        if pia.status != "draft":
            raise HTTPException(status_code=400, detail="PIA must be in draft status to submit for review")

        # Validate required fields for submission
        self._validate_pia_for_submission(pia)

        pia.status = "review"
        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.WORKFLOW_STARTED,
            severity=AuditSeverity.MEDIUM,
            message=f"PIA submitted for review: {pia.title}",
            user_id=submitted_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "risk_level": pia.overall_risk_level,
                "residual_risk_level": pia.residual_risk_level,
                "dpo_consulted": pia.dpo_consulted
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return pia

    def approve_pia(self, pia_id: str, approved_by: str,
                    approval_notes: str = None) -> PrivacyImpactAssessment:
        """Approve a Privacy Impact Assessment"""
        pia = self.db.query(PrivacyImpactAssessment).get(pia_id)
        if not pia:
            raise HTTPException(status_code=404, detail="PIA not found")

        if pia.status != "review":
            raise HTTPException(status_code=400, detail="PIA must be in review status to approve")

        pia.status = "approved"
        pia.approved_by = approved_by
        pia.approved_at = datetime.utcnow()

        if approval_notes:
            pia.effectiveness_review = approval_notes

        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.WORKFLOW_APPROVED,
            severity=AuditSeverity.HIGH,
            message=f"PIA approved: {pia.title}",
            user_id=approved_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "approval_notes": approval_notes,
                "risk_level": pia.overall_risk_level,
                "next_review_due": pia.next_review_due.isoformat()
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return pia

    def reject_pia(self, pia_id: str, rejected_by: str,
                   rejection_reason: str) -> PrivacyImpactAssessment:
        """Reject a Privacy Impact Assessment"""
        pia = self.db.query(PrivacyImpactAssessment).get(pia_id)
        if not pia:
            raise HTTPException(status_code=404, detail="PIA not found")

        if pia.status != "review":
            raise HTTPException(status_code=400, detail="PIA must be in review status to reject")

        pia.status = "rejected"
        pia.effectiveness_review = rejection_reason

        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.WORKFLOW_REJECTED,
            severity=AuditSeverity.MEDIUM,
            message=f"PIA rejected: {pia.title}",
            user_id=rejected_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "rejection_reason": rejection_reason,
                "risk_level": pia.overall_risk_level
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return pia

    def conduct_pia_review(self, pia_id: str, reviewed_by: str,
                          review_data: Dict[str, Any]) -> PrivacyImpactAssessment:
        """Conduct periodic review of approved PIA"""
        pia = self.db.query(PrivacyImpactAssessment).get(pia_id)
        if not pia:
            raise HTTPException(status_code=404, detail="PIA not found")

        if pia.status != "approved":
            raise HTTPException(status_code=400, detail="PIA must be approved to conduct review")

        # Update review fields
        pia.last_reviewed = datetime.utcnow()
        pia.effectiveness_review = review_data.get("effectiveness_review", pia.effectiveness_review)

        # Update next review date
        if "next_review_due" in review_data:
            pia.next_review_due = review_data["next_review_due"]
        else:
            # Default: review annually
            pia.next_review_due = pia.last_reviewed + timedelta(days=365)

        # Update risk levels if provided
        if "overall_risk_level" in review_data:
            pia.overall_risk_level = review_data["overall_risk_level"]
        if "residual_risk_level" in review_data:
            pia.residual_risk_level = review_data["residual_risk_level"]

        # Update mitigation measures if provided
        if "mitigation_measures" in review_data:
            pia.mitigation_measures = review_data["mitigation_measures"]

        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
            severity=AuditSeverity.MEDIUM,
            message=f"PIA review conducted: {pia.title}",
            user_id=reviewed_by,
            resource_type="pia",
            resource_id=pia.id,
            resource_name=pia.title,
            details={
                "review_date": pia.last_reviewed.isoformat(),
                "next_review_due": pia.next_review_due.isoformat(),
                "risk_level": pia.overall_risk_level,
                "residual_risk_level": pia.residual_risk_level
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return pia

    def get_overdue_pias(self) -> List[PrivacyImpactAssessment]:
        """Get PIAs that are overdue for review"""
        current_time = datetime.utcnow()
        return self.db.query(PrivacyImpactAssessment).filter(
            and_(
                PrivacyImpactAssessment.status == "approved",
                PrivacyImpactAssessment.next_review_due < current_time
            )
        ).order_by(PrivacyImpactAssessment.next_review_due).all()

    def get_pias_by_risk_level(self, risk_level: str) -> List[PrivacyImpactAssessment]:
        """Get PIAs by risk level"""
        return self.db.query(PrivacyImpactAssessment).filter(
            PrivacyImpactAssessment.overall_risk_level == risk_level
        ).order_by(PrivacyImpactAssessment.created_at.desc()).all()

    def get_pia_statistics(self) -> Dict[str, Any]:
        """Get PIA statistics for dashboard"""
        total_pias = self.db.query(PrivacyImpactAssessment).count()

        status_counts = self.db.query(
            PrivacyImpactAssessment.status,
            func.count(PrivacyImpactAssessment.id)
        ).group_by(PrivacyImpactAssessment.status).all()

        risk_level_counts = self.db.query(
            PrivacyImpactAssessment.overall_risk_level,
            func.count(PrivacyImpactAssessment.id)
        ).group_by(PrivacyImpactAssessment.overall_risk_level).all()

        overdue_count = len(self.get_overdue_pias())

        # Recent activity
        recent_pias = self.db.query(PrivacyImpactAssessment).filter(
            PrivacyImpactAssessment.created_at >= datetime.utcnow() - timedelta(days=30)
        ).count()

        upcoming_reviews = self.db.query(PrivacyImpactAssessment).filter(
            and_(
                PrivacyImpactAssessment.status == "approved",
                PrivacyImpactAssessment.next_review_due >= datetime.utcnow(),
                PrivacyImpactAssessment.next_review_due <= datetime.utcnow() + timedelta(days=30)
            )
        ).count()

        return {
            "total_pias": total_pias,
            "status_breakdown": dict(status_counts),
            "risk_level_breakdown": dict(risk_level_counts),
            "overdue_reviews": overdue_count,
            "recent_pias": recent_pias,
            "upcoming_reviews": upcoming_reviews,
            "completion_rate": (dict(status_counts).get("approved", 0) / max(1, total_pias)) * 100
        }

    def _validate_pia_for_submission(self, pia: PrivacyImpactAssessment) -> None:
        """Validate PIA has required fields for submission"""
        errors = []

        if not pia.processing_purpose:
            errors.append("Processing purpose is required")

        if not pia.data_categories:
            errors.append("Data categories are required")

        if not pia.data_subjects:
            errors.append("Data subjects are required")

        if not pia.necessity_justification:
            errors.append("Necessity justification is required")

        if not pia.proportionality_assessment:
            errors.append("Proportionality assessment is required")

        if not pia.identified_risks:
            errors.append("Risk identification is required")

        if not pia.mitigation_measures:
            errors.append("Mitigation measures are required")

        if pia.overall_risk_level == "high" and not pia.dpo_consulted:
            errors.append("DPO consultation is required for high-risk processing")

        if errors:
            raise HTTPException(status_code=400, detail={
                "message": "PIA validation failed",
                "errors": errors
            })

    def generate_pia_template(self, processing_type: str) -> Dict[str, Any]:
        """Generate PIA template based on processing type"""
        templates = {
            "document_management": {
                "title": "Document Management System PIA",
                "processing_purpose": "Store, organize, and manage governance documents for community association",
                "data_categories": [
                    "User account information",
                    "Document content and metadata",
                    "Access logs and audit trails"
                ],
                "data_subjects": [
                    "Board members",
                    "Property managers",
                    "Residents",
                    "External stakeholders"
                ],
                "common_risks": [
                    {"risk": "Unauthorized access to sensitive documents", "likelihood": "medium", "impact": "high"},
                    {"risk": "Data breach through system vulnerabilities", "likelihood": "low", "impact": "high"},
                    {"risk": "Accidental disclosure through sharing", "likelihood": "medium", "impact": "medium"}
                ],
                "mitigation_measures": [
                    {"measure": "Role-based access control", "effectiveness": "high"},
                    {"measure": "Encryption at rest and in transit", "effectiveness": "high"},
                    {"measure": "Regular security audits", "effectiveness": "medium"},
                    {"measure": "User training on data handling", "effectiveness": "medium"}
                ]
            },
            "user_analytics": {
                "title": "User Analytics and Tracking PIA",
                "processing_purpose": "Analyze user behavior to improve system performance and user experience",
                "data_categories": [
                    "Usage patterns and statistics",
                    "IP addresses and session data",
                    "Performance metrics"
                ],
                "data_subjects": [
                    "All system users"
                ],
                "common_risks": [
                    {"risk": "Re-identification of users through analytics", "likelihood": "low", "impact": "medium"},
                    {"risk": "Profiling without consent", "likelihood": "medium", "impact": "medium"}
                ],
                "mitigation_measures": [
                    {"measure": "Data anonymization techniques", "effectiveness": "high"},
                    {"measure": "Purpose limitation and data minimization", "effectiveness": "high"},
                    {"measure": "Consent mechanisms", "effectiveness": "medium"}
                ]
            },
            "third_party_integration": {
                "title": "Third-Party Integration PIA",
                "processing_purpose": "Integrate with external services for enhanced functionality",
                "data_categories": [
                    "User credentials for SSO",
                    "Document content for cloud storage",
                    "User preferences and settings"
                ],
                "data_subjects": [
                    "Users with integrated accounts"
                ],
                "common_risks": [
                    {"risk": "Unauthorized access by third-party", "likelihood": "medium", "impact": "high"},
                    {"risk": "Data transfer to insecure jurisdiction", "likelihood": "low", "impact": "high"},
                    {"risk": "Loss of control over data", "likelihood": "medium", "impact": "medium"}
                ],
                "mitigation_measures": [
                    {"measure": "Data processing agreements", "effectiveness": "high"},
                    {"measure": "Regular third-party security assessments", "effectiveness": "medium"},
                    {"measure": "Encryption for data in transit", "effectiveness": "high"},
                    {"measure": "Data localization requirements", "effectiveness": "medium"}
                ]
            }
        }

        template = templates.get(processing_type, templates["document_management"])

        # Add standard fields
        template.update({
            "review_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "next_review_due": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            "risk_likelihood": "medium",
            "risk_impact": "medium",
            "overall_risk_level": "medium",
            "residual_risk_level": "low"
        })

        return template