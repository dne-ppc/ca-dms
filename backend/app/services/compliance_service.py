"""
Compliance service for GDPR/CCPA features and data retention automation
"""
import json
import zipfile
import tempfile
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from fastapi import HTTPException

from app.models.compliance import (
    UserConsent, DataRetentionPolicy, DataDeletionRequest,
    PrivacyImpactAssessment, ComplianceReport, DataProcessingActivity
)
from app.models.user import User
from app.models.document import Document
from app.models.security import AuditLog, AuditEventType, AuditSeverity
from app.models.workflow import WorkflowInstance
from app.models.notification import Notification
from app.schemas.compliance import (
    UserDataExportRequest, UserDataExport, ConsentBatchOperation,
    ConsentBatchResult, ComplianceMetrics, ComplianceDashboard
)
from app.core.logging import logger


class DataRetentionService:
    """Service for managing data retention policies and automated deletion"""

    def __init__(self, db: Session):
        self.db = db

    def get_applicable_policies(self, data_category: str, resource_type: str) -> List[DataRetentionPolicy]:
        """Get all applicable retention policies for given data category and resource type"""
        return self.db.query(DataRetentionPolicy).filter(
            and_(
                DataRetentionPolicy.is_active == True,
                DataRetentionPolicy.data_category == data_category,
                DataRetentionPolicy.resource_type == resource_type,
                DataRetentionPolicy.effective_from <= datetime.utcnow(),
                or_(
                    DataRetentionPolicy.effective_until.is_(None),
                    DataRetentionPolicy.effective_until >= datetime.utcnow()
                )
            )
        ).all()

    def calculate_retention_date(self, created_at: datetime, policies: List[DataRetentionPolicy]) -> datetime:
        """Calculate the retention date based on applicable policies"""
        if not policies:
            # Default retention: 7 years if no policy specified
            return created_at + timedelta(days=7*365)

        # Use the most restrictive (shortest) retention period
        min_days = min(policy.retention_period_days for policy in policies)
        return created_at + timedelta(days=min_days)

    def get_expired_data(self, data_category: str, resource_type: str) -> List[Dict[str, Any]]:
        """Get data that has exceeded its retention period"""
        policies = self.get_applicable_policies(data_category, resource_type)

        if not policies:
            return []

        # Calculate cutoff date
        max_retention_days = max(policy.retention_period_days + policy.grace_period_days
                               for policy in policies)
        cutoff_date = datetime.utcnow() - timedelta(days=max_retention_days)

        expired_items = []

        if resource_type == "documents":
            expired_docs = self.db.query(Document).filter(
                Document.created_at < cutoff_date
            ).all()
            expired_items.extend([{
                'id': doc.id,
                'type': 'document',
                'title': doc.title,
                'created_at': doc.created_at,
                'retention_date': self.calculate_retention_date(doc.created_at, policies)
            } for doc in expired_docs])

        elif resource_type == "audit_logs":
            # Handle audit logs with their own retention_until field
            expired_logs = self.db.query(AuditLog).filter(
                or_(
                    and_(AuditLog.retention_until.is_(None), AuditLog.created_at < cutoff_date),
                    AuditLog.retention_until < datetime.utcnow()
                )
            ).all()
            expired_items.extend([{
                'id': log.id,
                'type': 'audit_log',
                'event_type': log.event_type.value,
                'created_at': log.created_at,
                'retention_date': log.retention_until or self.calculate_retention_date(log.created_at, policies)
            } for log in expired_logs])

        elif resource_type == "notifications":
            expired_notifications = self.db.query(Notification).filter(
                Notification.created_at < cutoff_date
            ).all()
            expired_items.extend([{
                'id': notif.id,
                'type': 'notification',
                'title': notif.title,
                'created_at': notif.created_at,
                'retention_date': self.calculate_retention_date(notif.created_at, policies)
            } for notif in expired_notifications])

        return expired_items

    def create_retention_notification(self, expired_items: List[Dict[str, Any]],
                                    policy: DataRetentionPolicy) -> bool:
        """Create notifications before automatic deletion"""
        if not expired_items:
            return True

        # Create audit log for retention notification
        audit_log = AuditLog(
            event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
            severity=AuditSeverity.MEDIUM,
            message=f"Data retention notification created for {len(expired_items)} items",
            resource_type="retention_policy",
            resource_id=policy.id,
            details={
                "policy_name": policy.name,
                "expired_items_count": len(expired_items),
                "data_category": policy.data_category,
                "retention_period_days": policy.retention_period_days
            }
        )
        self.db.add(audit_log)

        logger.info(f"Created retention notification for {len(expired_items)} items under policy {policy.name}")
        return True

    def execute_automated_deletion(self, policy: DataRetentionPolicy) -> Dict[str, Any]:
        """Execute automated deletion based on retention policy"""
        if not policy.auto_delete_enabled:
            return {"status": "skipped", "reason": "Auto-delete not enabled"}

        expired_items = self.get_expired_data(policy.data_category, policy.resource_type)

        if not expired_items:
            return {"status": "completed", "deleted_count": 0}

        deleted_count = 0
        errors = []

        try:
            for item in expired_items:
                try:
                    if item['type'] == 'document':
                        doc = self.db.query(Document).get(item['id'])
                        if doc:
                            self.db.delete(doc)
                            deleted_count += 1

                    elif item['type'] == 'audit_log':
                        log = self.db.query(AuditLog).get(item['id'])
                        if log and not log.is_sensitive:  # Don't delete sensitive logs without review
                            self.db.delete(log)
                            deleted_count += 1

                    elif item['type'] == 'notification':
                        notif = self.db.query(Notification).get(item['id'])
                        if notif:
                            self.db.delete(notif)
                            deleted_count += 1

                except Exception as e:
                    errors.append(f"Failed to delete {item['type']} {item['id']}: {str(e)}")
                    logger.error(f"Retention deletion error: {e}")

            self.db.commit()

            # Create audit log for deletion
            audit_log = AuditLog(
                event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
                severity=AuditSeverity.HIGH,
                message=f"Automated retention deletion completed: {deleted_count} items deleted",
                resource_type="retention_policy",
                resource_id=policy.id,
                details={
                    "policy_name": policy.name,
                    "deleted_count": deleted_count,
                    "error_count": len(errors),
                    "errors": errors[:10]  # Limit error details
                }
            )
            self.db.add(audit_log)
            self.db.commit()

            return {
                "status": "completed",
                "deleted_count": deleted_count,
                "error_count": len(errors),
                "errors": errors
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"Retention deletion failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "deleted_count": deleted_count
            }


class ConsentManagementService:
    """Service for managing user consent and GDPR compliance"""

    def __init__(self, db: Session):
        self.db = db

    def record_consent(self, user_id: str, consent_data: Dict[str, Any],
                      ip_address: str = None, user_agent: str = None) -> UserConsent:
        """Record user consent with metadata"""
        consent = UserConsent(
            user_id=user_id,
            **consent_data,
            ip_address=ip_address,
            user_agent=user_agent,
            granted_at=datetime.utcnow() if consent_data.get('status') == 'granted' else None
        )

        self.db.add(consent)
        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.USER_UPDATED,
            severity=AuditSeverity.LOW,
            message=f"User consent recorded for {consent_data['consent_type']}",
            user_id=user_id,
            resource_type="consent",
            resource_id=consent.id,
            details={
                "consent_type": consent_data['consent_type'],
                "status": consent_data['status'],
                "method": consent_data['method']
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return consent

    def withdraw_consent(self, user_id: str, consent_id: str, reason: str = None) -> UserConsent:
        """Withdraw user consent"""
        consent = self.db.query(UserConsent).filter(
            and_(UserConsent.id == consent_id, UserConsent.user_id == user_id)
        ).first()

        if not consent:
            raise HTTPException(status_code=404, detail="Consent not found")

        consent.status = "withdrawn"
        consent.withdrawn_at = datetime.utcnow()
        if reason:
            consent.consent_metadata = consent.consent_metadata or {}
            consent.consent_metadata['withdrawal_reason'] = reason

        self.db.commit()

        # Create audit log
        audit_log = AuditLog(
            event_type=AuditEventType.USER_UPDATED,
            severity=AuditSeverity.MEDIUM,
            message=f"User consent withdrawn for {consent.consent_type.value}",
            user_id=user_id,
            resource_type="consent",
            resource_id=consent.id,
            details={
                "consent_type": consent.consent_type.value,
                "withdrawal_reason": reason
            }
        )
        self.db.add(audit_log)
        self.db.commit()

        return consent

    def get_user_consents(self, user_id: str, consent_type: str = None) -> List[UserConsent]:
        """Get user's consent records"""
        query = self.db.query(UserConsent).filter(UserConsent.user_id == user_id)

        if consent_type:
            query = query.filter(UserConsent.consent_type == consent_type)

        return query.order_by(UserConsent.created_at.desc()).all()

    def batch_consent_operation(self, operation: ConsentBatchOperation,
                               current_user_id: str) -> ConsentBatchResult:
        """Perform batch consent operations"""
        started_at = datetime.utcnow()
        processed_count = 0
        success_count = 0
        error_count = 0
        errors = []

        try:
            if operation.user_ids:
                users = self.db.query(User).filter(User.id.in_(operation.user_ids)).all()
            else:
                users = self.db.query(User).filter(User.is_active == True).all()

            for user in users:
                processed_count += 1
                try:
                    for consent_type in operation.consent_types:
                        if operation.operation == "grant":
                            # Create or update consent
                            existing = self.db.query(UserConsent).filter(
                                and_(
                                    UserConsent.user_id == user.id,
                                    UserConsent.consent_type == consent_type
                                )
                            ).first()

                            if existing:
                                existing.status = "granted"
                                existing.granted_at = datetime.utcnow()
                            else:
                                consent = UserConsent(
                                    user_id=user.id,
                                    consent_type=consent_type,
                                    status="granted",
                                    method="explicit_form",
                                    purpose=f"Batch {operation.operation} operation",
                                    consent_version="1.0",
                                    granted_at=datetime.utcnow(),
                                    consent_metadata=operation.metadata
                                )
                                self.db.add(consent)

                        elif operation.operation == "withdraw":
                            consents = self.db.query(UserConsent).filter(
                                and_(
                                    UserConsent.user_id == user.id,
                                    UserConsent.consent_type == consent_type,
                                    UserConsent.status == "granted"
                                )
                            ).all()

                            for consent in consents:
                                consent.status = "withdrawn"
                                consent.withdrawn_at = datetime.utcnow()

                    success_count += 1

                except Exception as e:
                    error_count += 1
                    errors.append({
                        "user_id": user.id,
                        "error": str(e)
                    })

            self.db.commit()

            # Create audit log
            audit_log = AuditLog(
                event_type=AuditEventType.SYSTEM_CONFIG_CHANGED,
                severity=AuditSeverity.HIGH,
                message=f"Batch consent {operation.operation} completed",
                user_id=current_user_id,
                resource_type="consent_batch",
                details={
                    "operation": operation.operation,
                    "processed_count": processed_count,
                    "success_count": success_count,
                    "error_count": error_count,
                    "consent_types": [ct.value for ct in operation.consent_types]
                }
            )
            self.db.add(audit_log)
            self.db.commit()

        except Exception as e:
            self.db.rollback()
            error_count = processed_count
            success_count = 0
            errors = [{"general_error": str(e)}]

        return ConsentBatchResult(
            operation=operation.operation,
            processed_count=processed_count,
            success_count=success_count,
            error_count=error_count,
            errors=errors,
            started_at=started_at,
            completed_at=datetime.utcnow()
        )


class DataExportService:
    """Service for GDPR data export (Right to Data Portability)"""

    def __init__(self, db: Session):
        self.db = db

    def export_user_data(self, request: UserDataExportRequest) -> UserDataExport:
        """Export all user data for GDPR compliance"""
        user = self.db.query(User).get(request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Generate export ID
        export_id = hashlib.sha256(f"{request.user_id}_{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16]

        # Create temporary directory for export
        with tempfile.TemporaryDirectory() as temp_dir:
            export_data = {}
            data_categories = []

            # Export user profile data
            if not request.data_categories or "profile" in request.data_categories:
                export_data["profile"] = {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "full_name": user.full_name,
                    "title": user.title,
                    "phone": user.phone,
                    "role": user.role.value,
                    "is_active": user.is_active,
                    "is_verified": user.is_verified,
                    "created_at": user.created_at.isoformat(),
                    "updated_at": user.updated_at.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "verified_at": user.verified_at.isoformat() if user.verified_at else None
                }
                data_categories.append("profile")

            # Export user documents
            if not request.data_categories or "documents" in request.data_categories:
                documents = self.db.query(Document).filter(Document.created_by == user.id).all()
                export_data["documents"] = []
                for doc in documents:
                    doc_data = {
                        "id": doc.id,
                        "title": doc.title,
                        "document_type": doc.document_type,
                        "version": doc.version,
                        "created_at": doc.created_at.isoformat(),
                        "updated_at": doc.updated_at.isoformat(),
                        "created_by": doc.created_by,
                        "updated_by": doc.updated_by
                    }
                    if request.include_metadata:
                        doc_data["content"] = doc.content
                        doc_data["placeholders"] = doc.placeholders
                    export_data["documents"].append(doc_data)
                data_categories.append("documents")

            # Export consent records
            if not request.data_categories or "consents" in request.data_categories:
                consents = self.db.query(UserConsent).filter(UserConsent.user_id == user.id).all()
                export_data["consents"] = []
                for consent in consents:
                    consent_data = {
                        "id": consent.id,
                        "consent_type": consent.consent_type.value,
                        "status": consent.status.value,
                        "method": consent.method.value,
                        "purpose": consent.purpose,
                        "data_categories": consent.data_categories,
                        "processing_activities": consent.processing_activities,
                        "legal_basis": consent.legal_basis,
                        "consent_version": consent.consent_version,
                        "granted_at": consent.granted_at.isoformat() if consent.granted_at else None,
                        "withdrawn_at": consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
                        "expires_at": consent.expires_at.isoformat() if consent.expires_at else None,
                        "created_at": consent.created_at.isoformat(),
                        "updated_at": consent.updated_at.isoformat()
                    }
                    if request.include_metadata:
                        consent_data["consent_metadata"] = consent.consent_metadata
                        consent_data["ip_address"] = consent.ip_address if not request.anonymize_sensitive else "***"
                        consent_data["user_agent"] = consent.user_agent if not request.anonymize_sensitive else "***"
                    export_data["consents"].append(consent_data)
                data_categories.append("consents")

            # Export audit logs (limited to user's own actions)
            if not request.data_categories or "audit_logs" in request.data_categories:
                audit_logs = self.db.query(AuditLog).filter(AuditLog.user_id == user.id).all()
                export_data["audit_logs"] = []
                for log in audit_logs:
                    log_data = {
                        "id": log.id,
                        "event_type": log.event_type.value,
                        "severity": log.severity.value,
                        "message": log.message,
                        "resource_type": log.resource_type,
                        "resource_id": log.resource_id,
                        "resource_name": log.resource_name,
                        "created_at": log.created_at.isoformat()
                    }
                    if request.include_metadata:
                        log_data["details"] = log.details
                        log_data["ip_address"] = log.ip_address if not request.anonymize_sensitive else "***"
                        log_data["user_agent"] = log.user_agent if not request.anonymize_sensitive else "***"
                    export_data["audit_logs"].append(log_data)
                data_categories.append("audit_logs")

            # Create export file
            export_filename = f"user_data_export_{export_id}.{request.format}"
            export_path = Path(temp_dir) / export_filename

            if request.format == "json":
                with open(export_path, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, indent=2, ensure_ascii=False)

            elif request.format == "csv":
                # Create a zip file with separate CSV files for each data category
                import csv
                zip_path = export_path.with_suffix('.zip')
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for category, data in export_data.items():
                        if isinstance(data, list) and data:
                            csv_filename = f"{category}.csv"
                            csv_path = Path(temp_dir) / csv_filename

                            # Get all unique keys for CSV header
                            all_keys = set()
                            for item in data:
                                if isinstance(item, dict):
                                    all_keys.update(item.keys())

                            with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                                writer = csv.DictWriter(csvfile, fieldnames=sorted(all_keys))
                                writer.writeheader()
                                for item in data:
                                    if isinstance(item, dict):
                                        writer.writerow(item)

                            zipf.write(csv_path, csv_filename)
                export_path = zip_path

            # Calculate file size and hash
            file_size = export_path.stat().st_size
            file_hash = hashlib.sha256()
            with open(export_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    file_hash.update(chunk)

            # Move file to final location (in a real app, this would be cloud storage)
            final_export_path = f"/tmp/exports/{export_filename}"
            Path("/tmp/exports").mkdir(exist_ok=True)
            export_path.rename(final_export_path)

            # Create audit log
            audit_log = AuditLog(
                event_type=AuditEventType.USER_UPDATED,
                severity=AuditSeverity.MEDIUM,
                message=f"User data exported for GDPR compliance",
                user_id=user.id,
                resource_type="data_export",
                resource_id=export_id,
                details={
                    "export_format": request.format,
                    "data_categories": data_categories,
                    "file_size": file_size,
                    "anonymized": request.anonymize_sensitive
                }
            )
            self.db.add(audit_log)
            self.db.commit()

            return UserDataExport(
                user_id=user.id,
                export_id=export_id,
                format=request.format,
                file_path=final_export_path,
                file_size=file_size,
                data_categories=data_categories,
                export_summary={
                    "total_records": sum(len(data) if isinstance(data, list) else 1 for data in export_data.values()),
                    "categories": data_categories,
                    "file_hash": file_hash.hexdigest(),
                    "anonymized": request.anonymize_sensitive,
                    "include_metadata": request.include_metadata
                },
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=30)  # Export files expire after 30 days
            )


class ComplianceMetricsService:
    """Service for generating compliance metrics and reports"""

    def __init__(self, db: Session):
        self.db = db

    def generate_compliance_metrics(self) -> ComplianceMetrics:
        """Generate comprehensive compliance metrics"""
        current_time = datetime.utcnow()

        # Consent statistics
        consent_stats = {
            "total_users": self.db.query(User).filter(User.is_active == True).count(),
            "users_with_consent": self.db.query(UserConsent.user_id).distinct().count(),
            "consent_by_type": {},
            "recent_withdrawals": self.db.query(UserConsent).filter(
                and_(
                    UserConsent.status == "withdrawn",
                    UserConsent.withdrawn_at >= current_time - timedelta(days=30)
                )
            ).count()
        }

        # Consent by type statistics
        for consent_type in ["data_processing", "marketing", "analytics", "third_party_sharing", "cookies", "notifications"]:
            granted = self.db.query(UserConsent).filter(
                and_(UserConsent.consent_type == consent_type, UserConsent.status == "granted")
            ).count()
            denied = self.db.query(UserConsent).filter(
                and_(UserConsent.consent_type == consent_type, UserConsent.status == "denied")
            ).count()
            consent_stats["consent_by_type"][consent_type] = {
                "granted": granted,
                "denied": denied,
                "total": granted + denied
            }

        # Retention compliance
        retention_stats = {
            "active_policies": self.db.query(DataRetentionPolicy).filter(
                DataRetentionPolicy.is_active == True
            ).count(),
            "items_pending_deletion": 0,  # Would need to calculate based on policies
            "automated_deletions_last_30_days": 0  # Would track in audit logs
        }

        # PIA status
        pia_stats = {
            "total_pias": self.db.query(PrivacyImpactAssessment).count(),
            "draft": self.db.query(PrivacyImpactAssessment).filter(
                PrivacyImpactAssessment.status == "draft"
            ).count(),
            "approved": self.db.query(PrivacyImpactAssessment).filter(
                PrivacyImpactAssessment.status == "approved"
            ).count(),
            "overdue_reviews": self.db.query(PrivacyImpactAssessment).filter(
                PrivacyImpactAssessment.next_review_due < current_time
            ).count()
        }

        # Deletion requests
        deletion_stats = {
            "pending": self.db.query(DataDeletionRequest).filter(
                DataDeletionRequest.status.in_(["pending", "verified"])
            ).count(),
            "completed_last_30_days": self.db.query(DataDeletionRequest).filter(
                and_(
                    DataDeletionRequest.status == "completed",
                    DataDeletionRequest.processing_completed_at >= current_time - timedelta(days=30)
                )
            ).count(),
            "average_processing_time_days": 0  # Would calculate from completed requests
        }

        # Data exports (GDPR)
        export_stats = {
            "requests_last_30_days": 0,  # Would track export requests
            "average_export_size_mb": 0,  # Would calculate from export logs
            "most_requested_categories": []
        }

        # Audit summary
        audit_stats = {
            "total_events_last_30_days": self.db.query(AuditLog).filter(
                AuditLog.created_at >= current_time - timedelta(days=30)
            ).count(),
            "security_events_last_30_days": self.db.query(AuditLog).filter(
                and_(
                    AuditLog.severity.in_(["high", "critical"]),
                    AuditLog.created_at >= current_time - timedelta(days=30)
                )
            ).count(),
            "compliance_events_last_30_days": self.db.query(AuditLog).filter(
                and_(
                    AuditLog.resource_type.in_(["consent", "data_export", "retention_policy"]),
                    AuditLog.created_at >= current_time - timedelta(days=30)
                )
            ).count()
        }

        return ComplianceMetrics(
            consent_statistics=consent_stats,
            retention_compliance=retention_stats,
            pia_status=pia_stats,
            deletion_requests=deletion_stats,
            data_exports=export_stats,
            audit_summary=audit_stats,
            generated_at=current_time
        )

    def generate_compliance_dashboard(self) -> ComplianceDashboard:
        """Generate compliance dashboard with metrics and recommendations"""
        metrics = self.generate_compliance_metrics()
        current_time = datetime.utcnow()

        # Calculate compliance score (0-100)
        score_factors = {
            "consent_coverage": min(100, (metrics.consent_statistics["users_with_consent"] /
                                        max(1, metrics.consent_statistics["total_users"]) * 100)),
            "pia_completion": 100 if metrics.pia_status["overdue_reviews"] == 0 else 80,
            "deletion_processing": 100 if metrics.deletion_requests["pending"] == 0 else
                                 max(50, 100 - (metrics.deletion_requests["pending"] * 10)),
            "retention_automation": 100 if metrics.retention_compliance["active_policies"] > 0 else 60
        }

        compliance_score = sum(score_factors.values()) / len(score_factors)

        # Generate pending tasks
        pending_tasks = []

        if metrics.pia_status["overdue_reviews"] > 0:
            pending_tasks.append({
                "type": "pia_review",
                "priority": "high",
                "description": f"{metrics.pia_status['overdue_reviews']} PIAs need review",
                "due_date": current_time.isoformat()
            })

        if metrics.deletion_requests["pending"] > 0:
            pending_tasks.append({
                "type": "deletion_request",
                "priority": "medium",
                "description": f"{metrics.deletion_requests['pending']} deletion requests pending",
                "due_date": (current_time + timedelta(days=7)).isoformat()
            })

        # Generate recent activities
        recent_activities = [
            {
                "type": "consent_withdrawal",
                "description": f"{metrics.consent_statistics['recent_withdrawals']} consent withdrawals in last 30 days",
                "timestamp": current_time.isoformat(),
                "status": "info"
            },
            {
                "type": "audit_events",
                "description": f"{metrics.audit_summary['compliance_events_last_30_days']} compliance events logged",
                "timestamp": current_time.isoformat(),
                "status": "info"
            }
        ]

        # Generate recommendations
        recommendations = []

        if score_factors["consent_coverage"] < 80:
            recommendations.append("Improve consent collection processes to increase user coverage")

        if metrics.retention_compliance["active_policies"] == 0:
            recommendations.append("Implement data retention policies for GDPR compliance")

        if metrics.pia_status["draft"] > metrics.pia_status["approved"]:
            recommendations.append("Complete pending Privacy Impact Assessments")

        # Generate alerts
        alerts = []

        if metrics.pia_status["overdue_reviews"] > 0:
            alerts.append({
                "type": "overdue_reviews",
                "severity": "warning",
                "message": f"{metrics.pia_status['overdue_reviews']} PIAs require review",
                "created_at": current_time.isoformat()
            })

        if metrics.deletion_requests["pending"] > 5:
            alerts.append({
                "type": "pending_deletions",
                "severity": "warning",
                "message": f"{metrics.deletion_requests['pending']} deletion requests pending processing",
                "created_at": current_time.isoformat()
            })

        return ComplianceDashboard(
            metrics=metrics,
            pending_tasks=pending_tasks,
            recent_activities=recent_activities,
            compliance_score=compliance_score,
            recommendations=recommendations,
            alerts=alerts
        )