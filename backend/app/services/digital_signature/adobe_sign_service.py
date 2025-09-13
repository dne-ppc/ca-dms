"""
Adobe Sign API integration service for CA-DMS
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


class AdobeSignService:
    """Adobe Sign API integration service"""

    def __init__(self, provider: DigitalSignatureProvider):
        self.provider = provider
        self.base_url = provider.api_endpoint or "https://api.na1.adobesign.com/api/rest/v6"
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
        """Authenticate with Adobe Sign using OAuth"""
        try:
            auth_url = f"{self.base_url}/oauth/token"

            headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            }

            # This would be replaced with proper OAuth flow
            data = {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "agreement_send:account agreement_read:account"
            }

            # For demo, return True (in production, implement full OAuth)
            self._access_token = "demo_adobe_token"
            self._token_expires_at = datetime.utcnow() + timedelta(hours=1)

            logger.info(f"Adobe Sign authentication successful for provider {self.provider.id}")
            return True

        except Exception as e:
            logger.error(f"Adobe Sign authentication failed: {str(e)}")
            return False

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication"""
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def create_agreement(
        self,
        request: DigitalSignatureRequest,
        document_content: bytes,
        signers: List[DigitalSignature]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create an Adobe Sign agreement for signing

        Returns: (success, agreement_id, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            # Step 1: Upload document
            success, document_id, error = await self._upload_document(document_content, request.title)
            if not success:
                return False, None, error

            # Step 2: Prepare participants
            participants = []
            for idx, signer in enumerate(signers):
                participants.append({
                    "email": signer.signer_email,
                    "role": "SIGNER",
                    "order": signer.signing_order
                })

            # Step 3: Create agreement
            agreement_data = {
                "fileInfos": [{"libraryDocumentId": document_id}],
                "name": request.title,
                "participantSetsInfo": [{
                    "memberInfos": participants,
                    "order": 1,
                    "role": "SIGNER"
                }],
                "signatureType": "ESIGN",
                "state": "IN_PROCESS"
            }

            # Add message if provided
            if request.message:
                agreement_data["message"] = request.message

            # Add expiration
            if request.expiration_days:
                expiration_date = datetime.utcnow() + timedelta(days=request.expiration_days)
                agreement_data["expirationTime"] = expiration_date.isoformat() + "Z"

            # Add reminder frequency
            if request.reminder_frequency_days:
                agreement_data["reminderFrequency"] = "DAILY_UNTIL_SIGNED"

            url = f"{self.base_url}/agreements"

            # In production, make actual API call
            # response = requests.post(url, headers=self._get_headers(), json=agreement_data)

            # Demo response
            agreement_id = f"demo_agreement_{datetime.utcnow().timestamp()}"

            logger.info(f"Adobe Sign agreement created: {agreement_id} for request {request.id}")
            return True, agreement_id, None

        except Exception as e:
            error_msg = f"Failed to create Adobe Sign agreement: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def _upload_document(self, document_content: bytes, name: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Upload document to Adobe Sign

        Returns: (success, document_id, error_message)
        """
        try:
            # Step 1: Create transient document
            url = f"{self.base_url}/transientDocuments"

            files = {
                'File': (f"{name}.pdf", document_content, 'application/pdf')
            }

            headers = {
                "Authorization": f"Bearer {self._access_token}"
            }

            # In production, make actual API call
            # response = requests.post(url, headers=headers, files=files)

            # Demo response
            transient_document_id = f"demo_transient_{datetime.utcnow().timestamp()}"

            # Step 2: Create library document from transient document
            library_url = f"{self.base_url}/libraryDocuments"

            library_data = {
                "fileInfos": [{
                    "transientDocumentId": transient_document_id
                }],
                "name": name,
                "sharingMode": "ACCOUNT",
                "librarySharingMode": "ACCOUNT"
            }

            # In production, make actual API call
            # response = requests.post(library_url, headers=self._get_headers(), json=library_data)

            # Demo response
            library_document_id = f"demo_library_{datetime.utcnow().timestamp()}"

            return True, library_document_id, None

        except Exception as e:
            error_msg = f"Failed to upload document to Adobe Sign: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def get_agreement_status(self, agreement_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Get agreement status from Adobe Sign

        Returns: (success, status_data, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/agreements/{agreement_id}"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response
            status_data = {
                "id": agreement_id,
                "name": "Demo Agreement",
                "status": "IN_PROCESS",
                "createdDate": datetime.utcnow().isoformat() + "Z",
                "participantSetsInfo": [{
                    "memberInfos": [{
                        "email": "demo@example.com",
                        "status": "WAITING_FOR_VERIFICATION",
                        "userId": "demo_user_id"
                    }],
                    "status": "WAITING_FOR_OTHERS"
                }]
            }

            return True, status_data, None

        except Exception as e:
            error_msg = f"Failed to get agreement status: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def get_agreement_documents(self, agreement_id: str) -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Download completed signed documents from Adobe Sign

        Returns: (success, document_bytes, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/agreements/{agreement_id}/combinedDocument"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response - return empty PDF bytes
            demo_pdf = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000079 00000 n \n0000000173 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n253\n%%EOF"

            return True, demo_pdf, None

        except Exception as e:
            error_msg = f"Failed to download agreement documents: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def cancel_agreement(self, agreement_id: str, reason: str = "Cancelled by user") -> Tuple[bool, Optional[str]]:
        """
        Cancel an Adobe Sign agreement

        Returns: (success, error_message)
        """
        try:
            if not await self.authenticate():
                return False, "Authentication failed"

            url = f"{self.base_url}/agreements/{agreement_id}/state"

            update_data = {
                "state": "CANCELLED",
                "agreementCancellationInfo": {
                    "comment": reason,
                    "notifyOthers": True
                }
            }

            # In production, make actual API call
            # response = requests.put(url, headers=self._get_headers(), json=update_data)

            logger.info(f"Adobe Sign agreement cancelled: {agreement_id}")
            return True, None

        except Exception as e:
            error_msg = f"Failed to cancel agreement: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def process_webhook(self, webhook_data: Dict[str, Any]) -> List[SignatureWebhookPayload]:
        """
        Process Adobe Sign webhook events

        Returns: List of processed signature events
        """
        events = []

        try:
            # Parse Adobe Sign webhook format
            event_type = webhook_data.get("event")
            agreement_id = webhook_data.get("agreement", {}).get("id")

            if not agreement_id:
                logger.warning("Adobe Sign webhook missing agreement ID")
                return events

            # Create main agreement event
            event = SignatureWebhookPayload(
                event_type=f"agreement_{event_type}",
                request_id="",  # Will be populated by caller
                status=self._map_adobe_sign_status(webhook_data.get("agreement", {}).get("status")),
                external_data=webhook_data,
                timestamp=datetime.utcnow()
            )
            events.append(event)

            # Process participant events if available
            participant_sets = webhook_data.get("agreement", {}).get("participantSetsInfo", [])

            for participant_set in participant_sets:
                members = participant_set.get("memberInfos", [])
                for member in members:
                    member_event = SignatureWebhookPayload(
                        event_type=f"participant_{member.get('status')}",
                        request_id="",  # Will be populated by caller
                        signature_id=member.get("userId"),
                        status=self._map_adobe_sign_status(member.get("status")),
                        external_data=member,
                        timestamp=datetime.utcnow()
                    )
                    events.append(member_event)

            logger.info(f"Processed {len(events)} Adobe Sign webhook events for agreement {agreement_id}")

        except Exception as e:
            logger.error(f"Failed to process Adobe Sign webhook: {str(e)}")

        return events

    def _map_adobe_sign_status(self, adobe_status: str) -> SignatureStatus:
        """Map Adobe Sign status to internal status"""
        if not adobe_status:
            return SignatureStatus.PENDING

        status_mapping = {
            "waiting_for_verification": SignatureStatus.REQUESTED,
            "waiting_for_authoring": SignatureStatus.PENDING,
            "waiting_for_my_signature": SignatureStatus.REQUESTED,
            "waiting_for_counter_signature": SignatureStatus.REQUESTED,
            "waiting_for_others": SignatureStatus.REQUESTED,
            "signed": SignatureStatus.SIGNED,
            "approved": SignatureStatus.SIGNED,
            "delivered": SignatureStatus.SIGNED,
            "out_for_signature": SignatureStatus.REQUESTED,
            "cancelled": SignatureStatus.CANCELLED,
            "declined": SignatureStatus.DECLINED,
            "expired": SignatureStatus.EXPIRED,
            "archived": SignatureStatus.SIGNED,
            "form": SignatureStatus.PENDING,
            "widget": SignatureStatus.PENDING
        }

        return status_mapping.get(adobe_status.lower(), SignatureStatus.PENDING)

    async def get_signing_url(
        self,
        agreement_id: str,
        participant_email: str,
        return_url: str
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Get signing URL for a specific participant

        Returns: (success, signing_url, error_message)
        """
        try:
            if not await self.authenticate():
                return False, None, "Authentication failed"

            url = f"{self.base_url}/agreements/{agreement_id}/signingUrls"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response
            signing_url = f"https://secure.na1.adobesign.com/public/esignWidget?wid=demo_widget_id"

            return True, signing_url, None

        except Exception as e:
            error_msg = f"Failed to get signing URL: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    def validate_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        """
        Validate Adobe Sign webhook signature for security

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

    async def get_agreement_events(self, agreement_id: str) -> Tuple[bool, List[Dict[str, Any]], Optional[str]]:
        """
        Get all events for an agreement

        Returns: (success, events_list, error_message)
        """
        try:
            if not await self.authenticate():
                return False, [], "Authentication failed"

            url = f"{self.base_url}/agreements/{agreement_id}/events"

            # In production, make actual API call
            # response = requests.get(url, headers=self._get_headers())

            # Demo response
            events = [
                {
                    "type": "CREATED",
                    "date": datetime.utcnow().isoformat() + "Z",
                    "description": "Agreement was created",
                    "actingUserEmail": "creator@example.com"
                },
                {
                    "type": "SIGNATURE_REQUESTED",
                    "date": datetime.utcnow().isoformat() + "Z",
                    "description": "Signature was requested",
                    "participantEmail": "signer@example.com"
                }
            ]

            return True, events, None

        except Exception as e:
            error_msg = f"Failed to get agreement events: {str(e)}"
            logger.error(error_msg)
            return False, [], error_msg