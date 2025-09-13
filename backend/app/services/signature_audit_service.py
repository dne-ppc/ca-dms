"""
Comprehensive audit trail service for digital signature events
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
import json
import hashlib
from dataclasses import dataclass

from app.models.digital_signature import (
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureEvent,
    DigitalSignatureProvider
)
from app.models.user import User
from app.models.document import Document
from app.schemas.digital_signature import SignatureEventCreate
import logging

logger = logging.getLogger(__name__)


@dataclass
class AuditEventSummary:
    """Summary of audit events for reporting"""
    total_events: int
    event_types: Dict[str, int]
    date_range: Tuple[datetime, datetime]
    users_involved: int
    documents_affected: int
    compliance_score: float


@dataclass
class SecurityAlert:
    """Security alert based on audit analysis"""
    alert_type: str
    severity: str  # low, medium, high, critical
    description: str
    affected_entities: List[str]
    recommended_actions: List[str]
    timestamp: datetime


class SignatureAuditService:
    """Service for comprehensive audit trail management and analysis"""

    def __init__(self, db: Session):
        self.db = db

    # Event Logging Methods
    async def log_signature_event(
        self,
        request_id: str,
        event_type: str,
        description: str,
        user_id: Optional[str] = None,
        signature_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        external_event_data: Optional[Dict[str, Any]] = None,
        legal_framework_applied: Optional[str] = None,
        authentication_details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log a comprehensive signature event"""
        try:
            event = SignatureEvent(
                request_id=request_id,
                signature_id=signature_id,
                event_type=event_type,
                event_description=description,
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent,
                external_event_data=external_event_data,
                legal_framework_applied=legal_framework_applied,
                authentication_details=authentication_details,
                occurred_at=datetime.utcnow()
            )

            self.db.add(event)
            self.db.commit()

            # Perform real-time security analysis
            await self._analyze_event_for_security_alerts(event)

            logger.info(f"Signature event logged: {event_type} for request {request_id}")
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to log signature event: {str(e)}")
            return False

    async def log_authentication_event(
        self,
        request_id: str,
        signature_id: str,
        auth_method: str,
        auth_result: str,
        auth_details: Dict[str, Any],
        ip_address: str,
        user_agent: str
    ) -> bool:
        """Log authentication-specific events"""
        return await self.log_signature_event(
            request_id=request_id,
            signature_id=signature_id,
            event_type=f"authentication_{auth_result}",
            description=f"Authentication via {auth_method}: {auth_result}",
            ip_address=ip_address,
            user_agent=user_agent,
            authentication_details={
                "method": auth_method,
                "result": auth_result,
                "timestamp": datetime.utcnow().isoformat(),
                **auth_details
            }
        )

    async def log_compliance_validation(
        self,
        request_id: str,
        compliance_framework: str,
        validation_result: Dict[str, Any],
        user_id: str
    ) -> bool:
        """Log compliance validation events"""
        return await self.log_signature_event(
            request_id=request_id,
            event_type="compliance_validation",
            description=f"Compliance validation against {compliance_framework}",
            user_id=user_id,
            legal_framework_applied=compliance_framework,
            external_event_data=validation_result
        )

    async def log_document_access(
        self,
        request_id: str,
        document_id: str,
        access_type: str,
        user_id: str,
        ip_address: str,
        user_agent: str
    ) -> bool:
        """Log document access events"""
        return await self.log_signature_event(
            request_id=request_id,
            event_type=f"document_{access_type}",
            description=f"Document {access_type} by user",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            external_event_data={
                "document_id": document_id,
                "access_type": access_type
            }
        )

    # Audit Trail Retrieval Methods
    def get_signature_audit_trail(
        self,
        request_id: str,
        include_system_events: bool = True
    ) -> List[SignatureEvent]:
        """Get complete audit trail for a signature request"""
        try:
            query = self.db.query(SignatureEvent).filter(
                SignatureEvent.request_id == request_id
            )

            if not include_system_events:
                query = query.filter(SignatureEvent.user_id.isnot(None))

            events = query.order_by(SignatureEvent.occurred_at).all()

            logger.info(f"Retrieved {len(events)} audit events for request {request_id}")
            return events

        except Exception as e:
            logger.error(f"Failed to get audit trail: {str(e)}")
            return []

    def get_user_signature_activity(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[SignatureEvent]:
        """Get signature activity for a specific user"""
        try:
            query = self.db.query(SignatureEvent).filter(
                SignatureEvent.user_id == user_id
            )

            if start_date:
                query = query.filter(SignatureEvent.occurred_at >= start_date)
            if end_date:
                query = query.filter(SignatureEvent.occurred_at <= end_date)

            events = query.order_by(desc(SignatureEvent.occurred_at)).all()

            logger.info(f"Retrieved {len(events)} signature events for user {user_id}")
            return events

        except Exception as e:
            logger.error(f"Failed to get user activity: {str(e)}")
            return []

    def get_document_signature_history(self, document_id: str) -> List[Dict[str, Any]]:
        """Get complete signature history for a document"""
        try:
            # Get all signature requests for the document
            requests = self.db.query(DigitalSignatureRequest).filter(
                DigitalSignatureRequest.document_id == document_id
            ).all()

            history = []

            for request in requests:
                # Get events for this request
                events = self.get_signature_audit_trail(request.id)

                # Get signatures
                signatures = self.db.query(DigitalSignature).filter(
                    DigitalSignature.request_id == request.id
                ).all()

                history.append({
                    "request": {
                        "id": request.id,
                        "title": request.title,
                        "status": request.status.value,
                        "created_at": request.created_at,
                        "completed_at": request.completed_at
                    },
                    "signatures": [
                        {
                            "id": sig.id,
                            "signer_name": sig.signer_name,
                            "signer_email": sig.signer_email,
                            "status": sig.status.value,
                            "signed_at": sig.signed_at
                        }
                        for sig in signatures
                    ],
                    "events": [
                        {
                            "id": event.id,
                            "event_type": event.event_type,
                            "description": event.event_description,
                            "occurred_at": event.occurred_at,
                            "user_id": event.user_id
                        }
                        for event in events
                    ]
                })

            logger.info(f"Retrieved signature history for document {document_id}: {len(history)} requests")
            return history

        except Exception as e:
            logger.error(f"Failed to get document signature history: {str(e)}")
            return []

    # Security Analysis Methods
    async def _analyze_event_for_security_alerts(self, event: SignatureEvent):
        """Analyze events for potential security issues"""
        try:
            alerts = []

            # Check for suspicious IP patterns
            if event.ip_address:
                suspicious_ips = await self._check_suspicious_ip_activity(event.ip_address, event.user_id)
                alerts.extend(suspicious_ips)

            # Check for unusual authentication patterns
            if event.authentication_details:
                auth_alerts = await self._check_authentication_anomalies(event)
                alerts.extend(auth_alerts)

            # Check for rapid-fire events (potential automation)
            timing_alerts = await self._check_event_timing_anomalies(event.request_id, event.event_type)
            alerts.extend(timing_alerts)

            # Log any alerts found
            for alert in alerts:
                await self._log_security_alert(alert)

        except Exception as e:
            logger.error(f"Failed to analyze event for security alerts: {str(e)}")

    async def _check_suspicious_ip_activity(
        self,
        ip_address: str,
        user_id: Optional[str]
    ) -> List[SecurityAlert]:
        """Check for suspicious IP address activity"""
        alerts = []

        try:
            # Check for multiple users from same IP in short time
            recent_events = self.db.query(SignatureEvent).filter(
                and_(
                    SignatureEvent.ip_address == ip_address,
                    SignatureEvent.occurred_at >= datetime.utcnow() - timedelta(hours=1),
                    SignatureEvent.user_id.isnot(None)
                )
            ).all()

            unique_users = set(event.user_id for event in recent_events if event.user_id)

            if len(unique_users) > 3:
                alerts.append(SecurityAlert(
                    alert_type="suspicious_ip_activity",
                    severity="medium",
                    description=f"Multiple users ({len(unique_users)}) from same IP {ip_address} in 1 hour",
                    affected_entities=[ip_address] + list(unique_users),
                    recommended_actions=[
                        "Review IP address reputation",
                        "Verify user identities",
                        "Consider additional authentication"
                    ],
                    timestamp=datetime.utcnow()
                ))

            # Check for unusual geographic patterns (if geolocation data available)
            # This would require integration with IP geolocation service

        except Exception as e:
            logger.error(f"Failed to check suspicious IP activity: {str(e)}")

        return alerts

    async def _check_authentication_anomalies(self, event: SignatureEvent) -> List[SecurityAlert]:
        """Check for authentication anomalies"""
        alerts = []

        try:
            if not event.authentication_details:
                return alerts

            auth_result = event.authentication_details.get("result")
            auth_method = event.authentication_details.get("method")

            # Check for repeated failed authentications
            if auth_result == "failed":
                recent_failures = self.db.query(SignatureEvent).filter(
                    and_(
                        SignatureEvent.user_id == event.user_id,
                        SignatureEvent.event_type.like("authentication_failed%"),
                        SignatureEvent.occurred_at >= datetime.utcnow() - timedelta(minutes=30)
                    )
                ).count()

                if recent_failures >= 3:
                    alerts.append(SecurityAlert(
                        alert_type="repeated_auth_failures",
                        severity="high",
                        description=f"Multiple authentication failures for user in 30 minutes",
                        affected_entities=[event.user_id] if event.user_id else [],
                        recommended_actions=[
                            "Lock user account temporarily",
                            "Require password reset",
                            "Investigate potential brute force attack"
                        ],
                        timestamp=datetime.utcnow()
                    ))

        except Exception as e:
            logger.error(f"Failed to check authentication anomalies: {str(e)}")

        return alerts

    async def _check_event_timing_anomalies(
        self,
        request_id: str,
        event_type: str
    ) -> List[SecurityAlert]:
        """Check for unusual event timing patterns"""
        alerts = []

        try:
            # Check for rapid-fire events (possible automation)
            recent_events = self.db.query(SignatureEvent).filter(
                and_(
                    SignatureEvent.request_id == request_id,
                    SignatureEvent.event_type == event_type,
                    SignatureEvent.occurred_at >= datetime.utcnow() - timedelta(minutes=5)
                )
            ).count()

            if recent_events > 10:
                alerts.append(SecurityAlert(
                    alert_type="rapid_fire_events",
                    severity="medium",
                    description=f"Unusual number of {event_type} events in 5 minutes",
                    affected_entities=[request_id],
                    recommended_actions=[
                        "Review event patterns",
                        "Check for automated tools",
                        "Implement rate limiting"
                    ],
                    timestamp=datetime.utcnow()
                ))

        except Exception as e:
            logger.error(f"Failed to check timing anomalies: {str(e)}")

        return alerts

    async def _log_security_alert(self, alert: SecurityAlert):
        """Log security alert as audit event"""
        try:
            await self.log_signature_event(
                request_id="system",
                event_type=f"security_alert_{alert.alert_type}",
                description=alert.description,
                external_event_data={
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "affected_entities": alert.affected_entities,
                    "recommended_actions": alert.recommended_actions
                }
            )

            logger.warning(f"Security alert logged: {alert.alert_type} - {alert.description}")

        except Exception as e:
            logger.error(f"Failed to log security alert: {str(e)}")

    # Reporting and Analytics Methods
    def generate_audit_summary(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> AuditEventSummary:
        """Generate summary of audit events for a date range"""
        try:
            # Get all events in date range
            events = self.db.query(SignatureEvent).filter(
                and_(
                    SignatureEvent.occurred_at >= start_date,
                    SignatureEvent.occurred_at <= end_date
                )
            ).all()

            # Count event types
            event_types = {}
            users_involved = set()
            request_ids = set()

            for event in events:
                event_types[event.event_type] = event_types.get(event.event_type, 0) + 1
                if event.user_id:
                    users_involved.add(event.user_id)
                request_ids.add(event.request_id)

            # Get documents affected
            documents_affected = self.db.query(DigitalSignatureRequest.document_id).filter(
                DigitalSignatureRequest.id.in_(request_ids)
            ).distinct().count()

            # Calculate compliance score (simplified)
            compliance_events = sum(1 for event in events if "compliance" in event.event_type)
            compliance_score = min(1.0, compliance_events / max(1, len(events) * 0.1))

            return AuditEventSummary(
                total_events=len(events),
                event_types=event_types,
                date_range=(start_date, end_date),
                users_involved=len(users_involved),
                documents_affected=documents_affected,
                compliance_score=compliance_score
            )

        except Exception as e:
            logger.error(f"Failed to generate audit summary: {str(e)}")
            return AuditEventSummary(
                total_events=0,
                event_types={},
                date_range=(start_date, end_date),
                users_involved=0,
                documents_affected=0,
                compliance_score=0.0
            )

    def get_compliance_report(
        self,
        framework: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate compliance report for specific framework"""
        try:
            # Get compliance-related events
            compliance_events = self.db.query(SignatureEvent).filter(
                and_(
                    SignatureEvent.legal_framework_applied == framework,
                    SignatureEvent.occurred_at >= start_date,
                    SignatureEvent.occurred_at <= end_date
                )
            ).all()

            # Analyze compliance metrics
            validation_events = [e for e in compliance_events if "validation" in e.event_type]
            violations = []
            requirements_met = []

            for event in validation_events:
                if event.external_event_data:
                    violations.extend(event.external_event_data.get("violations", []))
                    requirements_met.extend(event.external_event_data.get("requirements_met", []))

            # Get affected requests
            request_ids = set(event.request_id for event in compliance_events)
            total_requests = len(request_ids)

            compliant_requests = len([
                rid for rid in request_ids
                if not any(
                    "violation" in event.event_type
                    for event in compliance_events
                    if event.request_id == rid
                )
            ])

            compliance_rate = compliant_requests / max(1, total_requests)

            return {
                "framework": framework,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "metrics": {
                    "total_requests": total_requests,
                    "compliant_requests": compliant_requests,
                    "compliance_rate": compliance_rate,
                    "total_events": len(compliance_events),
                    "validation_events": len(validation_events)
                },
                "violations": {
                    "total": len(violations),
                    "unique": len(set(violations)),
                    "common": self._get_most_common(violations, 5)
                },
                "requirements": {
                    "total_met": len(requirements_met),
                    "unique_met": len(set(requirements_met)),
                    "common": self._get_most_common(requirements_met, 5)
                },
                "recommendations": self._generate_compliance_recommendations(
                    violations, requirements_met, compliance_rate
                )
            }

        except Exception as e:
            logger.error(f"Failed to generate compliance report: {str(e)}")
            return {
                "framework": framework,
                "error": str(e),
                "metrics": {
                    "total_requests": 0,
                    "compliant_requests": 0,
                    "compliance_rate": 0.0
                }
            }

    def _get_most_common(self, items: List[str], count: int) -> List[Dict[str, Any]]:
        """Get most common items from a list"""
        from collections import Counter
        counter = Counter(items)
        return [
            {"item": item, "count": count}
            for item, count in counter.most_common(count)
        ]

    def _generate_compliance_recommendations(
        self,
        violations: List[str],
        requirements_met: List[str],
        compliance_rate: float
    ) -> List[str]:
        """Generate compliance improvement recommendations"""
        recommendations = []

        if compliance_rate < 0.8:
            recommendations.append("Implement mandatory compliance training for all users")

        if "authentication" in " ".join(violations).lower():
            recommendations.append("Strengthen authentication requirements")

        if "legal notice" in " ".join(violations).lower():
            recommendations.append("Review and update legal notice templates")

        if compliance_rate < 0.5:
            recommendations.append("Consider implementing stricter compliance validation")

        if len(violations) > len(requirements_met):
            recommendations.append("Focus on addressing most common violations")

        return recommendations

    # Data Integrity Methods
    def verify_audit_integrity(self, request_id: str) -> Dict[str, Any]:
        """Verify integrity of audit trail for a request"""
        try:
            events = self.get_signature_audit_trail(request_id)

            # Check for gaps in timeline
            timeline_gaps = []
            for i in range(1, len(events)):
                time_diff = (events[i].occurred_at - events[i-1].occurred_at).total_seconds()
                if time_diff > 86400:  # More than 24 hours
                    timeline_gaps.append({
                        "after_event": events[i-1].id,
                        "before_event": events[i].id,
                        "gap_hours": time_diff / 3600
                    })

            # Check for required events
            required_events = ["request_created", "signatures_requested"]
            missing_events = []
            existing_event_types = set(event.event_type for event in events)

            for required in required_events:
                if required not in existing_event_types:
                    missing_events.append(required)

            # Calculate integrity score
            integrity_score = 1.0
            if timeline_gaps:
                integrity_score -= 0.1 * len(timeline_gaps)
            if missing_events:
                integrity_score -= 0.2 * len(missing_events)

            integrity_score = max(0.0, integrity_score)

            return {
                "request_id": request_id,
                "total_events": len(events),
                "timeline_gaps": timeline_gaps,
                "missing_events": missing_events,
                "integrity_score": integrity_score,
                "verified_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to verify audit integrity: {str(e)}")
            return {
                "request_id": request_id,
                "error": str(e),
                "integrity_score": 0.0
            }