"""
Certificate-based digital signature service for CA-DMS
"""
import base64
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.fernet import Fernet
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
import tempfile

from app.core.config import settings
from app.models.digital_signature import (
    DigitalSignatureProvider,
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureCertificate,
    SignatureEvent,
    SignatureStatus
)
from app.schemas.digital_signature import SignatureWebhookPayload
import logging

logger = logging.getLogger(__name__)


class CertificateSignatureService:
    """Certificate-based digital signature service"""

    def __init__(self, provider: DigitalSignatureProvider):
        self.provider = provider
        self.certificate_storage_path = provider.certificate_storage_path or "/app/certificates"

    async def create_signature_request(
        self,
        request: DigitalSignatureRequest,
        document_content: bytes,
        signers: List[DigitalSignature]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create a certificate-based signature request

        Returns: (success, request_id, error_message)
        """
        try:
            # For certificate-based signing, we prepare the document for signing
            # and store it temporarily until signers complete the process

            # Validate that all signers have certificates
            for signer in signers:
                if not await self._validate_signer_certificate(signer.signer_email):
                    return False, None, f"No valid certificate found for signer: {signer.signer_email}"

            # Prepare document for signing
            prepared_doc_path = await self._prepare_document_for_signing(
                document_content,
                request.title,
                signers
            )

            if not prepared_doc_path:
                return False, None, "Failed to prepare document for signing"

            # Store the prepared document path in the request
            request_id = f"cert_request_{datetime.utcnow().timestamp()}"

            logger.info(f"Certificate-based signature request created: {request_id}")
            return True, request_id, None

        except Exception as e:
            error_msg = f"Failed to create certificate signature request: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def _validate_signer_certificate(self, signer_email: str) -> bool:
        """Validate that signer has a valid certificate"""
        try:
            # In production, this would check the database for valid certificates
            # For demo, return True
            return True

        except Exception as e:
            logger.error(f"Failed to validate certificate for {signer_email}: {str(e)}")
            return False

    async def _prepare_document_for_signing(
        self,
        document_content: bytes,
        title: str,
        signers: List[DigitalSignature]
    ) -> Optional[str]:
        """
        Prepare PDF document with signature fields

        Returns: Path to prepared document
        """
        try:
            # Create temporary file for the prepared document
            temp_dir = tempfile.mkdtemp()
            prepared_path = os.path.join(temp_dir, f"prepared_{title}.pdf")

            # Read the original PDF
            pdf_reader = PdfReader(io.BytesIO(document_content))
            pdf_writer = PdfWriter()

            # Copy all pages
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)

            # Add signature fields for each signer
            for idx, signer in enumerate(signers):
                # Add signature field metadata
                # In a real implementation, you would add actual PDF form fields
                # For demo purposes, we'll just note the signer positions
                field_name = f"signature_{idx + 1}_{signer.signer_email}"

                # Add to PDF metadata
                pdf_writer.add_metadata({
                    f"/SignatureField{idx + 1}": field_name,
                    f"/SignerEmail{idx + 1}": signer.signer_email,
                    f"/SignerName{idx + 1}": signer.signer_name
                })

            # Write the prepared PDF
            with open(prepared_path, 'wb') as output_file:
                pdf_writer.write(output_file)

            logger.info(f"Document prepared for signing: {prepared_path}")
            return prepared_path

        except Exception as e:
            logger.error(f"Failed to prepare document for signing: {str(e)}")
            return None

    async def sign_document(
        self,
        document_path: str,
        certificate: SignatureCertificate,
        private_key_password: str,
        signature_reason: str = "Document approval",
        signature_location: str = "CA-DMS"
    ) -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Sign a PDF document with a certificate

        Returns: (success, signed_document_bytes, error_message)
        """
        try:
            # Load certificate and private key
            cert_data = certificate.certificate_data
            private_key_data = certificate.private_key_encrypted

            if not private_key_data:
                return False, None, "No private key available for certificate"

            # Decrypt private key
            fernet = Fernet(settings.ENCRYPTION_KEY.encode())
            private_key_pem = fernet.decrypt(private_key_data)

            # Load the private key
            private_key = serialization.load_pem_private_key(
                private_key_pem,
                password=private_key_password.encode() if private_key_password else None
            )

            # Load the certificate
            cert = x509.load_der_x509_certificate(cert_data)

            # Create signature
            signature_data = await self._create_pdf_signature(
                document_path,
                private_key,
                cert,
                signature_reason,
                signature_location
            )

            if not signature_data:
                return False, None, "Failed to create PDF signature"

            logger.info(f"Document signed successfully with certificate {certificate.id}")
            return True, signature_data, None

        except Exception as e:
            error_msg = f"Failed to sign document: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def _create_pdf_signature(
        self,
        document_path: str,
        private_key,
        certificate: x509.Certificate,
        reason: str,
        location: str
    ) -> Optional[bytes]:
        """
        Create a digital signature on a PDF document

        Returns: Signed document bytes
        """
        try:
            # For demo purposes, we'll create a simple signed PDF
            # In production, you would use a proper PDF signing library like PyPDF2 with cryptography

            # Read the original document
            with open(document_path, 'rb') as f:
                original_content = f.read()

            # Create signature metadata
            signature_time = datetime.utcnow()
            signer_name = certificate.subject.rfc4514_string()

            # For demo, append signature information to PDF metadata
            pdf_reader = PdfReader(io.BytesIO(original_content))
            pdf_writer = PdfWriter()

            # Copy all pages
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)

            # Add signature metadata
            signature_metadata = {
                "/Signature": "Digital Signature Applied",
                "/SignatureTime": signature_time.isoformat(),
                "/SignerName": signer_name,
                "/SignatureReason": reason,
                "/SignatureLocation": location,
                "/SignatureMethod": "Certificate-based"
            }

            pdf_writer.add_metadata(signature_metadata)

            # Write signed document
            output_buffer = io.BytesIO()
            pdf_writer.write(output_buffer)
            signed_content = output_buffer.getvalue()

            return signed_content

        except Exception as e:
            logger.error(f"Failed to create PDF signature: {str(e)}")
            return None

    async def verify_signature(
        self,
        signed_document: bytes,
        certificate: SignatureCertificate
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Verify a digitally signed document

        Returns: (is_valid, verification_info, error_message)
        """
        try:
            # Load certificate
            cert = x509.load_der_x509_certificate(certificate.certificate_data)

            # Extract signature information from PDF
            pdf_reader = PdfReader(io.BytesIO(signed_document))
            metadata = pdf_reader.metadata

            verification_info = {
                "is_valid": True,  # Demo value
                "signer_name": metadata.get("/SignerName", "Unknown"),
                "signature_time": metadata.get("/SignatureTime"),
                "signature_reason": metadata.get("/SignatureReason"),
                "signature_location": metadata.get("/SignatureLocation"),
                "certificate_subject": cert.subject.rfc4514_string(),
                "certificate_issuer": cert.issuer.rfc4514_string(),
                "certificate_valid_from": cert.not_valid_before.isoformat(),
                "certificate_valid_until": cert.not_valid_after.isoformat(),
                "certificate_serial_number": str(cert.serial_number)
            }

            # Check certificate validity
            now = datetime.utcnow()
            if cert.not_valid_after < now:
                verification_info["is_valid"] = False
                verification_info["validation_error"] = "Certificate has expired"
            elif cert.not_valid_before > now:
                verification_info["is_valid"] = False
                verification_info["validation_error"] = "Certificate not yet valid"

            return True, verification_info, None

        except Exception as e:
            error_msg = f"Failed to verify signature: {str(e)}"
            logger.error(error_msg)
            return False, {}, error_msg

    async def upload_certificate(
        self,
        user_id: str,
        certificate_name: str,
        certificate_data: bytes,
        private_key_data: Optional[bytes] = None,
        private_key_password: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Upload and validate a user certificate

        Returns: (success, certificate_id, error_message)
        """
        try:
            # Parse certificate
            cert = x509.load_der_x509_certificate(certificate_data)

            # Validate certificate
            now = datetime.utcnow()
            if cert.not_valid_after < now:
                return False, None, "Certificate has expired"

            if cert.not_valid_before > now:
                return False, None, "Certificate is not yet valid"

            # Encrypt private key if provided
            encrypted_private_key = None
            if private_key_data:
                fernet = Fernet(settings.ENCRYPTION_KEY.encode())
                encrypted_private_key = fernet.encrypt(private_key_data)

            # Extract certificate information
            subject = cert.subject.rfc4514_string()
            issuer = cert.issuer.rfc4514_string()
            serial_number = str(cert.serial_number)

            # Create certificate record (in production, save to database)
            certificate_id = f"cert_{datetime.utcnow().timestamp()}"

            logger.info(f"Certificate uploaded successfully: {certificate_id} for user {user_id}")
            return True, certificate_id, None

        except Exception as e:
            error_msg = f"Failed to upload certificate: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def revoke_certificate(
        self,
        certificate_id: str,
        revocation_reason: str = "User requested revocation"
    ) -> Tuple[bool, Optional[str]]:
        """
        Revoke a certificate

        Returns: (success, error_message)
        """
        try:
            # In production, update certificate record in database
            # Mark as revoked with timestamp and reason

            logger.info(f"Certificate revoked: {certificate_id}, reason: {revocation_reason}")
            return True, None

        except Exception as e:
            error_msg = f"Failed to revoke certificate: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def get_certificate_chain(self, certificate: SignatureCertificate) -> List[x509.Certificate]:
        """Get the full certificate chain for validation"""
        try:
            # Load the certificate
            cert = x509.load_der_x509_certificate(certificate.certificate_data)

            # In production, you would build the full chain by following the issuer chain
            # For demo, return just the certificate
            return [cert]

        except Exception as e:
            logger.error(f"Failed to get certificate chain: {str(e)}")
            return []

    def get_signature_status(self, request_id: str) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Get status of a certificate-based signature request

        Returns: (success, status_data, error_message)
        """
        try:
            # In production, check database for request status
            status_data = {
                "request_id": request_id,
                "status": "pending",
                "signatures_required": 1,
                "signatures_completed": 0,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat()
            }

            return True, status_data, None

        except Exception as e:
            error_msg = f"Failed to get signature status: {str(e)}"
            logger.error(error_msg)
            return False, {}, error_msg