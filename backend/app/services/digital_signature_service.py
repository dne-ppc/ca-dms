"""
Main digital signature service for CA-DMS
Coordinates between different signature providers and compliance validation
"""
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.models.digital_signature import (
    DigitalSignatureProvider,
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureEvent,
    SignatureCertificate,
    SignatureProviderType,
    SignatureStatus,
    ComplianceFramework
)
from app.models.document import Document
from app.models.workflow import WorkflowInstance
from app.schemas.digital_signature import (
    DigitalSignatureProviderCreate,
    DigitalSignatureProviderUpdate,
    DigitalSignatureRequestCreate,
    DigitalSignatureRequestUpdate,
    SignatureEventCreate,
    SignatureWebhookPayload,
    SignatureStatistics,
    SignatureProviderStats
)
from app.services.digital_signature.docusign_service import DocuSignService
from app.services.digital_signature.adobe_sign_service import AdobeSignService
from app.services.digital_signature.certificate_service import CertificateSignatureService
from app.services.digital_signature.compliance_service import LegalComplianceService, ComplianceLevel
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class DigitalSignatureService:
    """Main service for managing digital signatures"""

    def __init__(self, db: Session):
        self.db = db
        self.compliance_service = LegalComplianceService()
        self.notification_service = NotificationService(db)

    def get_provider_service(self, provider: DigitalSignatureProvider):
        """Get the appropriate service for a signature provider"""
        service_mapping = {
            SignatureProviderType.DOCUSIGN: DocuSignService,
            SignatureProviderType.ADOBE_SIGN: AdobeSignService,
            SignatureProviderType.CERTIFICATE_BASED: CertificateSignatureService,
            SignatureProviderType.INTERNAL: CertificateSignatureService  # Use certificate service for internal
        }

        service_class = service_mapping.get(provider.provider_type)
        if service_class:
            return service_class(provider)
        else:
            raise ValueError(f"Unsupported provider type: {provider.provider_type}")

    # Provider Management
    async def create_provider(self, provider_data: DigitalSignatureProviderCreate, user_id: str) -> DigitalSignatureProvider:
        """Create a new signature provider"""
        # Comprehensive input validation
        if not provider_data.name or provider_data.name.strip() == "":
            raise ValueError("Provider name cannot be empty")

        # Validate provider type specific requirements
        if provider_data.provider_type == SignatureProviderType.DOCUSIGN:
            if not provider_data.api_key:
                raise ValueError("API key required for DocuSign provider")

        try:
            # Encrypt API key if provided
            encrypted_api_key = None
            if provider_data.api_key:
                from cryptography.fernet import Fernet
                from app.core.config import settings
                fernet = Fernet(settings.ENCRYPTION_KEY.encode())
                encrypted_api_key = fernet.encrypt(provider_data.api_key.encode())

            provider = DigitalSignatureProvider(
                name=provider_data.name,
                provider_type=provider_data.provider_type,
                is_active=provider_data.is_active,
                api_endpoint=provider_data.api_endpoint,
                api_key_encrypted=encrypted_api_key,
                client_id=provider_data.client_id,
                configuration=provider_data.configuration,
                supported_file_types=provider_data.supported_file_types,
                max_file_size_mb=provider_data.max_file_size_mb,
                compliance_frameworks=provider_data.compliance_frameworks,
                certificate_storage_path=provider_data.certificate_storage_path,
                requests_per_minute=provider_data.requests_per_minute,
                requests_per_day=provider_data.requests_per_day,
                created_by=user_id
            )

            self.db.add(provider)
            self.db.commit()
            self.db.refresh(provider)

            logger.info(f"Digital signature provider created: {provider.id} by user {user_id}")
            return provider

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create provider: {str(e)}")
            raise

    def _decrypt_api_key(self, encrypted_key: bytes) -> str:
        """Decrypt an encrypted API key"""
        try:
            from cryptography.fernet import Fernet
            from app.core.config import settings
            fernet = Fernet(settings.ENCRYPTION_KEY.encode())
            return fernet.decrypt(encrypted_key).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt API key: {e}")
            raise ValueError("Failed to decrypt API key")

    async def update_provider(
        self,
        provider_id: str,
        provider_data: DigitalSignatureProviderUpdate,
        user_id: str
    ) -> Optional[DigitalSignatureProvider]:
        """Update an existing signature provider"""
        try:
            provider = self.db.query(DigitalSignatureProvider).filter(
                DigitalSignatureProvider.id == provider_id
            ).first()

            if not provider:
                return None

            # Update fields
            for field, value in provider_data.dict(exclude_unset=True).items():
                if field == "api_key" and value:
                    # Encrypt new API key
                    from cryptography.fernet import Fernet
                    from app.core.config import settings
                    fernet = Fernet(settings.ENCRYPTION_KEY.encode())
                    provider.api_key_encrypted = fernet.encrypt(value.encode())
                elif field != "api_key":
                    setattr(provider, field, value)

            self.db.commit()
            self.db.refresh(provider)

            logger.info(f"Digital signature provider updated: {provider.id} by user {user_id}")
            return provider

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update provider: {str(e)}")
            raise

    def get_active_providers(self) -> List[DigitalSignatureProvider]:
        """Get all active signature providers"""
        return self.db.query(DigitalSignatureProvider).filter(
            DigitalSignatureProvider.is_active == True
        ).all()

    # Signature Request Management
    async def create_signature_request(
        self,
        request_data: DigitalSignatureRequestCreate,
        user_id: str
    ) -> Tuple[bool, Optional[DigitalSignatureRequest], Optional[str]]:
        """Create a new signature request"""
        try:
            # Validate document exists
            document = self.db.query(Document).filter(Document.id == request_data.document_id).first()
            if not document:
                return False, None, "Document not found"

            # Validate provider exists and is active
            provider = self.db.query(DigitalSignatureProvider).filter(
                and_(
                    DigitalSignatureProvider.id == request_data.provider_id,
                    DigitalSignatureProvider.is_active == True
                )
            ).first()

            if not provider:
                return False, None, "Provider not found or inactive"

            # Create signature request
            signature_request = DigitalSignatureRequest(
                document_id=request_data.document_id,
                workflow_instance_id=request_data.workflow_instance_id,
                provider_id=request_data.provider_id,
                title=request_data.title,
                message=request_data.message,
                require_all_signatures=request_data.require_all_signatures,
                expiration_days=request_data.expiration_days,
                reminder_frequency_days=request_data.reminder_frequency_days,
                compliance_framework=request_data.compliance_framework,
                legal_notice=request_data.legal_notice,
                authentication_required=request_data.authentication_required,
                success_redirect_url=request_data.success_redirect_url,
                decline_redirect_url=request_data.decline_redirect_url,
                expires_at=datetime.utcnow() + timedelta(days=request_data.expiration_days),
                created_by=user_id
            )

            self.db.add(signature_request)
            self.db.flush()  # Get the ID

            # Create individual signatures for each signer
            signatures = []
            for signer_info in request_data.signers:
                signature = DigitalSignature(
                    request_id=signature_request.id,
                    signer_name=signer_info.name,
                    signer_email=signer_info.email,
                    signer_role=signer_info.role,
                    signing_order=signer_info.signing_order
                )
                signatures.append(signature)
                self.db.add(signature)

            self.db.commit()
            self.db.refresh(signature_request)

            # Run compliance validation
            compliance_result = await self.compliance_service.validate_signature_request(
                signature_request, signatures, ComplianceLevel.STANDARD
            )

            # Log compliance validation
            await self._log_signature_event(
                signature_request.id,
                "compliance_validation",
                f"Compliance validation completed: {compliance_result.framework.value} - Score: {compliance_result.score:.2f}",
                user_id,
                external_event_data={
                    "compliance_score": compliance_result.score,
                    "is_compliant": compliance_result.is_compliant,
                    "violations": compliance_result.violations,
                    "requirements_met": compliance_result.requirements_met
                }
            )

            # If not compliant and strict mode, reject the request
            if not compliance_result.is_compliant and len(compliance_result.violations) > 3:
                logger.warning(f"Signature request {signature_request.id} failed compliance validation")
                # Continue anyway but log the issues

            # Send to external provider
            success, external_id, error = await self._send_to_provider(
                signature_request, signatures, document
            )

            if success and external_id:
                # Update request with external ID
                signature_request.external_request_id = external_id
                signature_request.status = SignatureStatus.REQUESTED
                self.db.commit()

                # Send notifications
                await self._send_signature_notifications(signature_request, signatures)

                logger.info(f"Signature request created successfully: {signature_request.id}")
                return True, signature_request, None
            else:
                # Mark as error
                signature_request.status = SignatureStatus.ERROR
                self.db.commit()
                return False, signature_request, error or "Failed to send to provider"

        except Exception as e:
            self.db.rollback()
            error_msg = f"Failed to create signature request: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def _send_to_provider(
        self,
        request: DigitalSignatureRequest,
        signatures: List[DigitalSignature],
        document: Document
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """Send signature request to the appropriate provider"""
        try:
            provider = self.db.query(DigitalSignatureProvider).filter(
                DigitalSignatureProvider.id == request.provider_id
            ).first()

            if not provider:
                return False, None, "Provider not found"

            # Get provider service
            provider_service = self.get_provider_service(provider)

            # Get document content (simplified - in production, get from storage)
            document_content = b"Demo PDF content for signature"

            # Send to provider
            if provider.provider_type == SignatureProviderType.DOCUSIGN:
                return await provider_service.create_envelope(request, document_content, signatures)
            elif provider.provider_type == SignatureProviderType.ADOBE_SIGN:
                return await provider_service.create_agreement(request, document_content, signatures)
            elif provider.provider_type in [SignatureProviderType.CERTIFICATE_BASED, SignatureProviderType.INTERNAL]:
                return await provider_service.create_signature_request(request, document_content, signatures)
            else:
                return False, None, f"Unsupported provider type: {provider.provider_type}"

        except Exception as e:
            logger.error(f"Failed to send to provider: {str(e)}")
            return False, None, str(e)

    async def _send_signature_notifications(
        self,
        request: DigitalSignatureRequest,
        signatures: List[DigitalSignature]
    ):
        """Send notifications to signers"""
        try:
            for signature in signatures:
                # Send email notification
                await self.notification_service.send_signature_request_notification(
                    signature.signer_email,
                    signature.signer_name,
                    request.title,
                    request.message or "Please review and sign the attached document."
                )

            logger.info(f"Signature notifications sent for request {request.id}")

        except Exception as e:
            logger.error(f"Failed to send signature notifications: {str(e)}")

    # Webhook Processing
    async def process_webhook(
        self,
        provider_id: str,
        webhook_data: Dict[str, Any],
        signature: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Process webhook from signature provider"""
        try:
            provider = self.db.query(DigitalSignatureProvider).filter(
                DigitalSignatureProvider.id == provider_id
            ).first()

            if not provider:
                return False, "Provider not found"

            # Validate webhook signature if provided
            if signature:
                provider_service = self.get_provider_service(provider)
                webhook_secret = provider.configuration.get("webhook_secret", "") if provider.configuration else ""

                if hasattr(provider_service, 'validate_webhook_signature'):
                    if not provider_service.validate_webhook_signature(
                        str(webhook_data), signature, webhook_secret
                    ):
                        return False, "Invalid webhook signature"

            # Process webhook events
            provider_service = self.get_provider_service(provider)
            events = await provider_service.process_webhook(webhook_data)

            for event in events:
                await self._process_signature_event(event, provider_id)

            logger.info(f"Processed {len(events)} webhook events from provider {provider_id}")
            return True, None

        except Exception as e:
            error_msg = f"Failed to process webhook: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def _process_signature_event(self, event: SignatureWebhookPayload, provider_id: str):
        """Process a single signature event"""
        try:
            # Find the signature request by external ID
            request = self.db.query(DigitalSignatureRequest).filter(
                and_(
                    DigitalSignatureRequest.provider_id == provider_id,
                    DigitalSignatureRequest.external_request_id.isnot(None)
                )
            ).first()

            if not request:
                logger.warning(f"No matching request found for webhook event: {event.event_type}")
                return

            # Update request status
            if event.status:
                request.status = event.status
                if event.status == SignatureStatus.SIGNED:
                    request.completed_at = datetime.utcnow()

            # Update individual signature if signature_id provided
            if event.signature_id:
                signature = self.db.query(DigitalSignature).filter(
                    and_(
                        DigitalSignature.request_id == request.id,
                        DigitalSignature.external_signature_id == event.signature_id
                    )
                ).first()

                if signature and event.status:
                    signature.status = event.status
                    if event.status == SignatureStatus.SIGNED:
                        signature.signed_at = datetime.utcnow()

            # Log the event
            await self._log_signature_event(
                request.id,
                event.event_type,
                f"Webhook event processed: {event.event_type}",
                None,  # System event
                external_event_data=event.external_data
            )

            # Send notifications for status changes
            if event.status in [SignatureStatus.SIGNED, SignatureStatus.DECLINED, SignatureStatus.EXPIRED]:
                await self._send_status_notifications(request, event)

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to process signature event: {str(e)}")

    async def _send_status_notifications(self, request: DigitalSignatureRequest, event: SignatureWebhookPayload):
        """Send notifications for signature status changes"""
        try:
            if event.status == SignatureStatus.SIGNED:
                await self.notification_service.send_signature_completed_notification(
                    request.created_by,
                    request.title,
                    "Document has been successfully signed by all parties."
                )
            elif event.status == SignatureStatus.DECLINED:
                await self.notification_service.send_signature_declined_notification(
                    request.created_by,
                    request.title,
                    "Document signature was declined."
                )

        except Exception as e:
            logger.error(f"Failed to send status notifications: {str(e)}")

    async def _send_status_notification(self, request_id: str, status: str) -> bool:
        """Send status notification to users"""
        try:
            # Get the request to find the user
            request = self.get_signature_request(request_id)
            if not request:
                return False

            await self.notification_service.send_notification(
                user_id=request.created_by,
                message=f"Signature request status updated: {status}",
                notification_type="signature_status"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False

    # Event Logging
    async def _log_signature_event(
        self,
        request_id: str,
        event_type: str,
        description: str,
        user_id: Optional[str] = None,
        signature_id: Optional[str] = None,
        external_event_data: Optional[Dict[str, Any]] = None
    ):
        """Log a signature event"""
        try:
            event = SignatureEvent(
                request_id=request_id,
                signature_id=signature_id,
                event_type=event_type,
                event_description=description,
                user_id=user_id,
                external_event_data=external_event_data
            )

            self.db.add(event)
            self.db.commit()

        except Exception as e:
            logger.error(f"Failed to log signature event: {str(e)}")

    # Statistics and Reporting
    def get_signature_statistics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> SignatureStatistics:
        """Get signature statistics"""
        try:
            query = self.db.query(DigitalSignatureRequest)

            if start_date:
                query = query.filter(DigitalSignatureRequest.created_at >= start_date)
            if end_date:
                query = query.filter(DigitalSignatureRequest.created_at <= end_date)

            all_requests = query.all()

            total_requests = len(all_requests)
            pending_requests = len([r for r in all_requests if r.status == SignatureStatus.PENDING])
            completed_requests = len([r for r in all_requests if r.status == SignatureStatus.SIGNED])
            declined_requests = len([r for r in all_requests if r.status == SignatureStatus.DECLINED])
            expired_requests = len([r for r in all_requests if r.status == SignatureStatus.EXPIRED])

            # Calculate average completion time
            completed = [r for r in all_requests if r.completed_at and r.requested_at]
            avg_completion_time = None
            if completed:
                total_hours = sum(
                    (r.completed_at - r.requested_at).total_seconds() / 3600
                    for r in completed
                )
                avg_completion_time = total_hours / len(completed)

            completion_rate = completed_requests / total_requests if total_requests > 0 else 0.0

            return SignatureStatistics(
                total_requests=total_requests,
                pending_requests=pending_requests,
                completed_requests=completed_requests,
                declined_requests=declined_requests,
                expired_requests=expired_requests,
                average_completion_time_hours=avg_completion_time,
                completion_rate=completion_rate
            )

        except Exception as e:
            logger.error(f"Failed to get signature statistics: {str(e)}")
            return SignatureStatistics(
                total_requests=0,
                pending_requests=0,
                completed_requests=0,
                declined_requests=0,
                expired_requests=0,
                completion_rate=0.0
            )

    def get_provider_statistics(self) -> List[SignatureProviderStats]:
        """Get statistics for each provider"""
        try:
            providers = self.get_active_providers()
            stats = []

            for provider in providers:
                requests = self.db.query(DigitalSignatureRequest).filter(
                    DigitalSignatureRequest.provider_id == provider.id
                ).all()

                total_requests = len(requests)
                successful_requests = len([r for r in requests if r.status == SignatureStatus.SIGNED])
                success_rate = successful_requests / total_requests if total_requests > 0 else 0.0

                last_used = None
                if requests:
                    last_used = max(r.created_at for r in requests)

                stats.append(SignatureProviderStats(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    total_requests=total_requests,
                    success_rate=success_rate,
                    last_used=last_used
                ))

            return stats

        except Exception as e:
            logger.error(f"Failed to get provider statistics: {str(e)}")
            return []

    # Request Management
    def get_signature_request(self, request_id: str) -> Optional[DigitalSignatureRequest]:
        """Get a signature request by ID"""
        return self.db.query(DigitalSignatureRequest).filter(
            DigitalSignatureRequest.id == request_id
        ).first()

    def get_user_signature_requests(
        self,
        user_id: str,
        status: Optional[SignatureStatus] = None
    ) -> List[DigitalSignatureRequest]:
        """Get signature requests for a user"""
        query = self.db.query(DigitalSignatureRequest).filter(
            DigitalSignatureRequest.created_by == user_id
        )

        if status:
            query = query.filter(DigitalSignatureRequest.status == status)

        return query.order_by(DigitalSignatureRequest.created_at.desc()).all()

    async def cancel_signature_request(
        self,
        request_id: str,
        user_id: str,
        reason: str = "Cancelled by user"
    ) -> Tuple[bool, Optional[str]]:
        """Cancel a signature request"""
        try:
            request = self.get_signature_request(request_id)
            if not request:
                return False, "Request not found"

            if request.created_by != user_id:
                return False, "Unauthorized to cancel this request"

            if request.status in [SignatureStatus.SIGNED, SignatureStatus.CANCELLED]:
                return False, f"Cannot cancel request with status: {request.status.value}"

            # Cancel with provider
            provider = self.db.query(DigitalSignatureProvider).filter(
                DigitalSignatureProvider.id == request.provider_id
            ).first()

            if provider and request.external_request_id:
                provider_service = self.get_provider_service(provider)

                if hasattr(provider_service, 'cancel_envelope'):
                    await provider_service.cancel_envelope(request.external_request_id, reason)
                elif hasattr(provider_service, 'cancel_agreement'):
                    await provider_service.cancel_agreement(request.external_request_id, reason)

            # Update status
            request.status = SignatureStatus.CANCELLED
            self.db.commit()

            # Log cancellation
            await self._log_signature_event(
                request_id,
                "request_cancelled",
                f"Request cancelled by user: {reason}",
                user_id
            )

            logger.info(f"Signature request cancelled: {request_id} by user {user_id}")
            return True, None

        except Exception as e:
            self.db.rollback()
            error_msg = f"Failed to cancel signature request: {str(e)}"
            logger.error(error_msg)
            return False, error_msg