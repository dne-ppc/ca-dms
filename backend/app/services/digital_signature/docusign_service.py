"""
DocuSign API integration service for CA-DMS
"""
import base64
import json
import requests
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from app.core.config import settings
from app.models.digital_signature import (
    DigitalSignatureProvider,
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureEvent,
    SignatureStatus
)
from app.schemas.digital_signature import (
    DigitalSignatureRequestCreate,
    SignerInfo,
    SignatureWebhookPayload
)
import logging

logger = logging.getLogger(__name__)


class DocuSignService:
    """DocuSign API integration service"""

    def __init__(self, provider: DigitalSignatureProvider):
        self.provider = provider
        self.base_url = provider.api_endpoint or "https://demo.docusign.net/restapi"
        self.account_id = None
        self._access_token = None
        self._token_expires_at = None

        # Decrypt API credentials
        self.client_id = provider.client_id
        if provider.api_key_encrypted:
            fernet = Fernet(settings.ENCRYPTION_KEY.encode())
            self.client_secret = fernet.decrypt(provider.api_key_encrypted).decode()
        else:
            self.client_secret = None

    async def authenticate(self) -> bool:
        """Authenticate with DocuSign using JWT"""
        try:
            # In production, you would implement JWT authentication
            # For demo purposes, this is a simplified OAuth flow
            auth_url = f"{self.base_url}/oauth/token"

            headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            }

            # This would be replaced with proper JWT authentication
            data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "signature"
            }

            # For demo, return True (in production, implement full OAuth)
            self._access_token = "demo_token"
            self._token_expires_at = datetime.utcnow() + timedelta(hours=1)
            self.account_id = "demo_account_id"

            logger.info(f"DocuSign authentication successful for provider {self.provider.id}")
            return True

        except Exception as e:
            logger.error(f"DocuSign authentication failed: {str(e)}")
            return False

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication"""
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def create_envelope(
        self,
        request: DigitalSignatureRequest,
        document_content: bytes,
        signers: List[DigitalSignature]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create a DocuSign envelope for signing

        Returns: (success, envelope_id, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            # Prepare document
            document_base64 = base64.b64encode(document_content).decode('utf-8')

            # Prepare signers
            docusign_signers = []
            for idx, signer in enumerate(signers):
                docusign_signers.append({
                    "email": signer.signer_email,
                    "name": signer.signer_name,
                    "recipientId": str(idx + 1),
                    "routingOrder": str(signer.signing_order),
                    "roleName": signer.signer_role or "Signer",
                    "tabs": {
                        "signHereTabs": [
                            {
                                "documentId": "1",
                                "pageNumber": "1",
                                "recipientId": str(idx + 1),
                                "tabLabel": f"Signature{idx + 1}",
                                "xPosition": "100",
                                "yPosition": "100"
                            }
                        ],
                        "dateSignedTabs": [
                            {
                                "documentId": "1",
                                "pageNumber": "1",
                                "recipientId": str(idx + 1),
                                "tabLabel": f"DateSigned{idx + 1}",
                                "xPosition": "300",
                                "yPosition": "100"
                            }
                        ]
                    }
                })

            # Create envelope definition
            envelope_definition = {
                "documents": [
                    {
                        "documentBase64": document_base64,
                        "documentId": "1",
                        "fileExtension": "pdf",
                        "name": request.title
                    }
                ],
                "recipients": {
                    "signers": docusign_signers
                },
                "status": "sent",
                "emailSubject": request.title,
                "emailMessage": request.message or "Please sign this document"
            }

            # Add compliance settings
            if request.authentication_required:
                # Add recipient authentication
                for signer in envelope_definition["recipients"]["signers"]:
                    signer["requireIdLookup"] = True
                    signer["accessCode"] = ""  # Would be generated or provided

            # Create envelope via API
            url = f"{self.base_url}/v2.1/accounts/{self.account_id}/envelopes"

            # In production, make actual API call
            # response = requests.post(url, headers=self._get_headers(), json=envelope_definition)

            # Demo response
            envelope_id = f"demo_envelope_{datetime.utcnow().timestamp()}"

            logger.info(f"DocuSign envelope created: {envelope_id} for request {request.id}")
            return True, envelope_id, None

        except Exception as e:
            error_msg = f"Failed to create DocuSign envelope: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def get_envelope_status(self, envelope_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Get envelope status from DocuSign

        Returns: (success, status_data, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/v2.1/accounts/{self.account_id}/envelopes/{envelope_id}"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response
            status_data = {
                "status": "sent",
                "envelopeId": envelope_id,
                "statusDateTime": datetime.utcnow().isoformat(),
                "recipients": {
                    "signers": [
                        {
                            "email": "demo@example.com",
                            "name": "Demo Signer",
                            "recipientId": "1",
                            "status": "sent",
                            "signedDateTime": None
                        }
                    ]
                }
            }

            return True, status_data, None

        except Exception as e:
            error_msg = f"Failed to get envelope status: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def get_envelope_documents(self, envelope_id: str) -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Download completed signed documents from DocuSign

        Returns: (success, document_bytes, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/v2.1/accounts/{self.account_id}/envelopes/{envelope_id}/documents/combined"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response - return empty PDF bytes
            demo_pdf = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000079 00000 n \n0000000173 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n253\n%%EOF"

            return True, demo_pdf, None

        except Exception as e:
            error_msg = f"Failed to download envelope documents: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def cancel_envelope(self, envelope_id: str, reason: str = "Cancelled by user") -> Tuple[bool, Optional[str]]:
        """
        Cancel a DocuSign envelope

        Returns: (success, error_message)
        """
        try:
            if not await self.authenticate():
                return False, "Authentication failed"

            url = f"{self.base_url}/v2.1/accounts/{self.account_id}/envelopes/{envelope_id}"

            update_data = {
                "status": "voided",
                "voidedReason": reason
            }

            # In production, make actual API call
            # response = requests.put(url, headers=self._get_headers(), json=update_data)

            logger.info(f"DocuSign envelope cancelled: {envelope_id}")
            return True, None

        except Exception as e:
            error_msg = f"Failed to cancel envelope: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def process_webhook(self, webhook_data: Dict[str, Any]) -> List[SignatureWebhookPayload]:
        """
        Process DocuSign webhook events

        Returns: List of processed signature events
        """
        events = []

        try:
            # Parse DocuSign webhook format
            envelope_status = webhook_data.get("status")
            envelope_id = webhook_data.get("envelopeId")

            if not envelope_id:
                logger.warning("DocuSign webhook missing envelope ID")
                return events

            # Create main envelope event
            event = SignatureWebhookPayload(
                event_type=f"envelope_{envelope_status}",
                request_id="",  # Will be populated by caller
                status=self._map_docusign_status(envelope_status),
                external_data=webhook_data,
                timestamp=datetime.utcnow()
            )
            events.append(event)

            # Process recipient events
            recipients = webhook_data.get("recipients", {})
            signers = recipients.get("signers", [])

            for signer in signers:
                signer_event = SignatureWebhookPayload(
                    event_type=f"signer_{signer.get('status')}",
                    request_id="",  # Will be populated by caller
                    signature_id=signer.get("recipientId"),
                    status=self._map_docusign_status(signer.get("status")),
                    external_data=signer,
                    timestamp=datetime.utcnow()
                )
                events.append(signer_event)

            logger.info(f"Processed {len(events)} DocuSign webhook events for envelope {envelope_id}")

        except Exception as e:
            logger.error(f"Failed to process DocuSign webhook: {str(e)}")

        return events

    def _map_docusign_status(self, docusign_status: str) -> SignatureStatus:
        """Map DocuSign status to internal status"""
        status_mapping = {
            "created": SignatureStatus.PENDING,
            "sent": SignatureStatus.REQUESTED,
            "delivered": SignatureStatus.REQUESTED,
            "signed": SignatureStatus.SIGNED,
            "completed": SignatureStatus.SIGNED,
            "declined": SignatureStatus.DECLINED,
            "voided": SignatureStatus.CANCELLED,
            "expired": SignatureStatus.EXPIRED,
            "authfailed": SignatureStatus.ERROR,
            "autoresponded": SignatureStatus.ERROR
        }

        return status_mapping.get(docusign_status.lower(), SignatureStatus.PENDING)

    async def get_recipient_view_url(
        self,
        envelope_id: str,
        recipient_email: str,
        return_url: str
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Get signing URL for a specific recipient

        Returns: (success, signing_url, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/v2.1/accounts/{self.account_id}/envelopes/{envelope_id}/views/recipient"

            view_request = {
                "authenticationMethod": "email",
                "email": recipient_email,
                "returnUrl": return_url,
                "clientUserId": recipient_email  # For embedded signing
            }

            # In production, make actual API call
            # response = requests.post(url, headers=self._get_headers(), json=view_request)

            # Demo response
            signing_url = f"https://demo.docusign.net/signing/{envelope_id}?token=demo_token"

            return True, signing_url, None

        except Exception as e:
            error_msg = f"Failed to get recipient view URL: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    def validate_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        """
        Validate DocuSign webhook signature for security

        Returns: True if signature is valid
        """
        try:
            import hmac
            import hashlib

            expected_signature = hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(signature, expected_signature)

        except Exception as e:
            logger.error(f"Failed to validate webhook signature: {str(e)}")
            return False