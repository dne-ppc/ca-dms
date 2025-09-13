"""
Comprehensive test suite for digital signature services
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.orm import Session

from app.services.digital_signature_service import DigitalSignatureService
from app.services.digital_signature.docusign_service import DocuSignService
from app.services.digital_signature.adobe_sign_service import AdobeSignService
from app.services.digital_signature.certificate_service import CertificateSignatureService
from app.services.digital_signature.compliance_service import (
    LegalComplianceService,
    ComplianceLevel,
    ValidationResult
)
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
from app.models.user import User
from app.schemas.digital_signature import (
    DigitalSignatureProviderCreate,
    DigitalSignatureRequestCreate,
    SignerInfo
)


class TestDigitalSignatureService:
    """Test suite for DigitalSignatureService"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def signature_service(self, mock_db):
        """Create DigitalSignatureService instance"""
        return DigitalSignatureService(mock_db)

    @pytest.fixture
    def mock_provider(self):
        """Mock signature provider"""
        return DigitalSignatureProvider(
            id="test-provider-id",
            name="Test DocuSign",
            provider_type=SignatureProviderType.DOCUSIGN,
            is_active=True,
            api_endpoint="https://demo.docusign.net/restapi",
            client_id="test-client-id",
            api_key_encrypted=b"encrypted-key-data",
            max_file_size_mb=10,
            requests_per_minute=60,
            requests_per_day=1000
        )

    @pytest.fixture
    def mock_document(self):
        """Mock document"""
        return Document(
            id="test-doc-id",
            title="Test Document",
            content={"ops": [{"insert": "Test content"}]},
            status="published"
        )

    @pytest.fixture
    def mock_user(self):
        """Mock user"""
        return User(
            id="test-user-id",
            email="test@example.com",
            first_name="Test",
            last_name="User"
        )

    async def test_create_provider(self, signature_service, mock_db):
        """Test creating a signature provider"""
        provider_data = DigitalSignatureProviderCreate(
            name="Test Provider",
            provider_type=SignatureProviderType.DOCUSIGN,
            api_key="test-api-key",
            client_id="test-client-id",
            max_file_size_mb=10,
            requests_per_minute=60,
            requests_per_day=1000
        )

        # Mock database operations
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()

        with patch('app.services.digital_signature_service.Fernet') as mock_fernet:
            mock_fernet_instance = Mock()
            mock_fernet.return_value = mock_fernet_instance
            mock_fernet_instance.encrypt.return_value = b"encrypted-api-key"

            provider = await signature_service.create_provider(provider_data, "user-id")

            assert provider.name == "Test Provider"
            assert provider.provider_type == SignatureProviderType.DOCUSIGN
            assert provider.created_by == "user-id"
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    async def test_create_signature_request_docusign(
        self, signature_service, mock_db, mock_provider, mock_document, mock_user
    ):
        """Test creating a DocuSign signature request"""
        request_data = DigitalSignatureRequestCreate(
            document_id="test-doc-id",
            provider_id="test-provider-id",
            title="Test Signature Request",
            message="Please sign this document",
            signers=[
                SignerInfo(
                    name="John Doe",
                    email="john@example.com",
                    role="Signer",
                    signing_order=1
                )
            ],
            expiration_days=30,
            compliance_framework=ComplianceFramework.ESIGN_ACT
        )

        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_document,  # Document query
            mock_provider   # Provider query
        ]
        mock_db.add = Mock()
        mock_db.flush = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()

        # Mock provider service
        with patch.object(signature_service, 'get_provider_service') as mock_get_service, \
             patch.object(signature_service, '_send_to_provider', new_callable=AsyncMock) as mock_send, \
             patch.object(signature_service, '_send_signature_notifications', new_callable=AsyncMock) as mock_notify, \
             patch.object(signature_service.compliance_service, 'validate_signature_request', new_callable=AsyncMock) as mock_validate:

            # Setup mocks
            mock_send.return_value = (True, "envelope-123", None)
            mock_validate.return_value = ValidationResult(True, ComplianceFramework.ESIGN_ACT, ComplianceLevel.STANDARD)

            success, request, error = await signature_service.create_signature_request(
                request_data, "user-id"
            )

            assert success is True
            assert request is not None
            assert error is None
            assert request.title == "Test Signature Request"
            assert request.status == SignatureStatus.REQUESTED
            assert request.external_request_id == "envelope-123"

            mock_send.assert_called_once()
            mock_notify.assert_called_once()
            mock_validate.assert_called_once()

    async def test_create_signature_request_validation_failure(
        self, signature_service, mock_db
    ):
        """Test signature request creation with validation failure"""
        request_data = DigitalSignatureRequestCreate(
            document_id="nonexistent-doc",
            provider_id="test-provider-id",
            title="Test Request",
            signers=[
                SignerInfo(
                    name="John Doe",
                    email="john@example.com",
                    signing_order=1
                )
            ]
        )

        # Mock document not found
        mock_db.query.return_value.filter.return_value.first.return_value = None

        success, request, error = await signature_service.create_signature_request(
            request_data, "user-id"
        )

        assert success is False
        assert request is None
        assert error == "Document not found"

    async def test_process_webhook_docusign(self, signature_service, mock_db, mock_provider):
        """Test processing DocuSign webhook"""
        webhook_data = {
            "status": "completed",
            "envelopeId": "envelope-123",
            "recipients": {
                "signers": [
                    {
                        "email": "john@example.com",
                        "name": "John Doe",
                        "recipientId": "1",
                        "status": "completed",
                        "signedDateTime": "2023-12-01T10:00:00Z"
                    }
                ]
            }
        }

        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_provider,  # Provider query
            Mock(id="request-123", provider_id="test-provider-id", external_request_id="envelope-123")  # Request query
        ]

        mock_db.add = Mock()
        mock_db.commit = Mock()

        with patch.object(signature_service, 'get_provider_service') as mock_get_service, \
             patch.object(signature_service, '_process_signature_event', new_callable=AsyncMock) as mock_process:

            mock_service = Mock()
            mock_service.process_webhook = AsyncMock(return_value=[
                Mock(
                    event_type="envelope_completed",
                    status=SignatureStatus.SIGNED,
                    signature_id=None,
                    external_data=webhook_data
                )
            ])
            mock_get_service.return_value = mock_service

            success, error = await signature_service.process_webhook(
                "test-provider-id", webhook_data
            )

            assert success is True
            assert error is None
            mock_process.assert_called_once()

    async def test_cancel_signature_request(self, signature_service, mock_db):
        """Test cancelling a signature request"""
        mock_request = Mock(
            id="request-123",
            created_by="user-id",
            status=SignatureStatus.REQUESTED,
            provider_id="provider-id",
            external_request_id="envelope-123"
        )

        mock_provider = Mock(
            id="provider-id",
            provider_type=SignatureProviderType.DOCUSIGN
        )

        # Mock database queries
        signature_service.get_signature_request = Mock(return_value=mock_request)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_provider
        mock_db.commit = Mock()

        with patch.object(signature_service, 'get_provider_service') as mock_get_service, \
             patch.object(signature_service, '_log_signature_event', new_callable=AsyncMock) as mock_log:

            mock_service = Mock()
            mock_service.cancel_envelope = AsyncMock(return_value=(True, None))
            mock_get_service.return_value = mock_service

            success, error = await signature_service.cancel_signature_request(
                "request-123", "user-id", "Test cancellation"
            )

            assert success is True
            assert error is None
            assert mock_request.status == SignatureStatus.CANCELLED
            mock_service.cancel_envelope.assert_called_once_with("envelope-123", "Test cancellation")
            mock_log.assert_called_once()

    def test_get_signature_statistics(self, signature_service, mock_db):
        """Test getting signature statistics"""
        mock_requests = [
            Mock(status=SignatureStatus.SIGNED, completed_at=datetime.utcnow(), requested_at=datetime.utcnow() - timedelta(hours=24)),
            Mock(status=SignatureStatus.PENDING, completed_at=None, requested_at=datetime.utcnow()),
            Mock(status=SignatureStatus.DECLINED, completed_at=None, requested_at=datetime.utcnow()),
            Mock(status=SignatureStatus.EXPIRED, completed_at=None, requested_at=datetime.utcnow())
        ]

        mock_db.query.return_value.all.return_value = mock_requests

        stats = signature_service.get_signature_statistics()

        assert stats.total_requests == 4
        assert stats.pending_requests == 1
        assert stats.completed_requests == 1
        assert stats.declined_requests == 1
        assert stats.expired_requests == 1
        assert stats.completion_rate == 0.25
        assert stats.average_completion_time_hours == 24.0


class TestDocuSignService:
    """Test suite for DocuSignService"""

    @pytest.fixture
    def mock_provider(self):
        """Mock DocuSign provider"""
        return DigitalSignatureProvider(
            id="docusign-provider",
            name="DocuSign",
            provider_type=SignatureProviderType.DOCUSIGN,
            api_endpoint="https://demo.docusign.net/restapi",
            client_id="test-client-id",
            api_key_encrypted=b"encrypted-key"
        )

    @pytest.fixture
    def docusign_service(self, mock_provider):
        """Create DocuSignService instance"""
        return DocuSignService(mock_provider)

    async def test_authenticate(self, docusign_service):
        """Test DocuSign authentication"""
        success = await docusign_service.authenticate()
        assert success is True
        assert docusign_service._access_token == "demo_token"
        assert docusign_service.account_id == "demo_account_id"

    async def test_create_envelope(self, docusign_service):
        """Test creating DocuSign envelope"""
        mock_request = Mock(
            id="request-123",
            title="Test Document",
            message="Please sign"
        )

        mock_signers = [
            Mock(
                signer_email="john@example.com",
                signer_name="John Doe",
                signing_order=1,
                signer_role="Signer"
            )
        ]

        document_content = b"PDF content"

        with patch.object(docusign_service, 'authenticate', new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = True

            success, envelope_id, error = await docusign_service.create_envelope(
                mock_request, document_content, mock_signers
            )

            assert success is True
            assert envelope_id.startswith("demo_envelope_")
            assert error is None

    async def test_get_envelope_status(self, docusign_service):
        """Test getting DocuSign envelope status"""
        with patch.object(docusign_service, 'authenticate', new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = True

            success, status_data, error = await docusign_service.get_envelope_status("envelope-123")

            assert success is True
            assert status_data is not None
            assert status_data["status"] == "sent"
            assert status_data["envelopeId"] == "envelope-123"
            assert error is None

    async def test_process_webhook(self, docusign_service):
        """Test processing DocuSign webhook"""
        webhook_data = {
            "status": "completed",
            "envelopeId": "envelope-123",
            "recipients": {
                "signers": [
                    {
                        "email": "john@example.com",
                        "status": "signed",
                        "recipientId": "1"
                    }
                ]
            }
        }

        events = await docusign_service.process_webhook(webhook_data)

        assert len(events) == 2  # Envelope event + signer event
        assert events[0].event_type == "envelope_completed"
        assert events[1].event_type == "signer_signed"


class TestAdobeSignService:
    """Test suite for AdobeSignService"""

    @pytest.fixture
    def mock_provider(self):
        """Mock Adobe Sign provider"""
        return DigitalSignatureProvider(
            id="adobe-provider",
            name="Adobe Sign",
            provider_type=SignatureProviderType.ADOBE_SIGN,
            api_endpoint="https://api.na1.adobesign.com/api/rest/v6",
            client_id="test-client-id",
            api_key_encrypted=b"encrypted-key"
        )

    @pytest.fixture
    def adobe_service(self, mock_provider):
        """Create AdobeSignService instance"""
        return AdobeSignService(mock_provider)

    async def test_authenticate(self, adobe_service):
        """Test Adobe Sign authentication"""
        success = await adobe_service.authenticate()
        assert success is True
        assert adobe_service._access_token == "demo_adobe_token"

    async def test_create_agreement(self, adobe_service):
        """Test creating Adobe Sign agreement"""
        mock_request = Mock(
            id="request-123",
            title="Test Agreement",
            message="Please sign this agreement",
            expiration_days=30,
            reminder_frequency_days=3
        )

        mock_signers = [
            Mock(
                signer_email="jane@example.com",
                signer_name="Jane Doe",
                signing_order=1
            )
        ]

        document_content = b"PDF content"

        with patch.object(adobe_service, 'authenticate', new_callable=AsyncMock) as mock_auth, \
             patch.object(adobe_service, '_upload_document', new_callable=AsyncMock) as mock_upload:

            mock_auth.return_value = True
            mock_upload.return_value = (True, "library-doc-123", None)

            success, agreement_id, error = await adobe_service.create_agreement(
                mock_request, document_content, mock_signers
            )

            assert success is True
            assert agreement_id.startswith("demo_agreement_")
            assert error is None

    async def test_upload_document(self, adobe_service):
        """Test uploading document to Adobe Sign"""
        document_content = b"PDF content"
        document_name = "Test Document"

        with patch.object(adobe_service, 'authenticate', new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = True

            success, document_id, error = await adobe_service._upload_document(
                document_content, document_name
            )

            assert success is True
            assert document_id.startswith("demo_library_")
            assert error is None


class TestCertificateSignatureService:
    """Test suite for CertificateSignatureService"""

    @pytest.fixture
    def mock_provider(self):
        """Mock certificate provider"""
        return DigitalSignatureProvider(
            id="cert-provider",
            name="Certificate-based",
            provider_type=SignatureProviderType.CERTIFICATE_BASED,
            certificate_storage_path="/test/certificates"
        )

    @pytest.fixture
    def cert_service(self, mock_provider):
        """Create CertificateSignatureService instance"""
        return CertificateSignatureService(mock_provider)

    @pytest.fixture
    def mock_certificate(self):
        """Mock signature certificate"""
        return SignatureCertificate(
            id="cert-123",
            user_id="user-123",
            certificate_name="Test Certificate",
            certificate_data=b"certificate-data",
            private_key_encrypted=b"encrypted-private-key"
        )

    async def test_create_signature_request(self, cert_service):
        """Test creating certificate-based signature request"""
        mock_request = Mock(
            id="request-123",
            title="Test Document"
        )

        mock_signers = [
            Mock(signer_email="signer@example.com")
        ]

        document_content = b"PDF content"

        with patch.object(cert_service, '_validate_signer_certificate', new_callable=AsyncMock) as mock_validate, \
             patch.object(cert_service, '_prepare_document_for_signing', new_callable=AsyncMock) as mock_prepare:

            mock_validate.return_value = True
            mock_prepare.return_value = "/tmp/prepared_document.pdf"

            success, request_id, error = await cert_service.create_signature_request(
                mock_request, document_content, mock_signers
            )

            assert success is True
            assert request_id.startswith("cert_request_")
            assert error is None

    async def test_upload_certificate(self, cert_service):
        """Test uploading a certificate"""
        certificate_data = b"certificate-data"
        private_key_data = b"private-key-data"

        with patch('app.services.digital_signature.certificate_service.x509') as mock_x509:
            mock_cert = Mock()
            mock_cert.not_valid_after = datetime.utcnow() + timedelta(days=365)
            mock_cert.not_valid_before = datetime.utcnow() - timedelta(days=1)
            mock_cert.subject.rfc4514_string.return_value = "CN=Test User"
            mock_cert.issuer.rfc4514_string.return_value = "CN=Test CA"
            mock_cert.serial_number = 12345

            mock_x509.load_der_x509_certificate.return_value = mock_cert

            success, cert_id, error = await cert_service.upload_certificate(
                "user-123",
                "Test Certificate",
                certificate_data,
                private_key_data
            )

            assert success is True
            assert cert_id.startswith("cert_")
            assert error is None

    async def test_sign_document(self, cert_service, mock_certificate):
        """Test signing a document with certificate"""
        document_path = "/tmp/test_document.pdf"
        private_key_password = "password"

        with patch('app.services.digital_signature.certificate_service.serialization') as mock_serialization, \
             patch('app.services.digital_signature.certificate_service.x509') as mock_x509, \
             patch.object(cert_service, '_create_pdf_signature', new_callable=AsyncMock) as mock_create_sig:

            mock_private_key = Mock()
            mock_serialization.load_pem_private_key.return_value = mock_private_key

            mock_cert = Mock()
            mock_x509.load_der_x509_certificate.return_value = mock_cert

            mock_create_sig.return_value = b"signed-pdf-content"

            success, signed_content, error = await cert_service.sign_document(
                document_path,
                mock_certificate,
                private_key_password
            )

            assert success is True
            assert signed_content == b"signed-pdf-content"
            assert error is None


class TestLegalComplianceService:
    """Test suite for LegalComplianceService"""

    @pytest.fixture
    def compliance_service(self):
        """Create LegalComplianceService instance"""
        return LegalComplianceService()

    @pytest.fixture
    def mock_request(self):
        """Mock signature request"""
        return DigitalSignatureRequest(
            id="request-123",
            title="Test Document",
            message="Please sign this document",
            compliance_framework=ComplianceFramework.ESIGN_ACT,
            authentication_required=True,
            legal_notice="Electronic signature consent notice",
            expiration_days=30
        )

    @pytest.fixture
    def mock_signers(self):
        """Mock signers"""
        return [
            DigitalSignature(
                id="sig-1",
                signer_name="John Doe",
                signer_email="john@example.com",
                signer_role="Signer"
            ),
            DigitalSignature(
                id="sig-2",
                signer_name="Jane Smith",
                signer_email="jane@example.com",
                signer_role="Witness"
            )
        ]

    async def test_validate_esign_act_compliance(
        self, compliance_service, mock_request, mock_signers
    ):
        """Test ESIGN Act compliance validation"""
        result = await compliance_service.validate_signature_request(
            mock_request, mock_signers, ComplianceLevel.STANDARD
        )

        assert result.is_compliant is True
        assert result.framework == ComplianceFramework.ESIGN_ACT
        assert result.score > 0.5
        assert len(result.violations) == 0
        assert len(result.requirements_met) > 0

    async def test_validate_ueta_compliance(
        self, compliance_service, mock_request, mock_signers
    ):
        """Test UETA compliance validation"""
        mock_request.compliance_framework = ComplianceFramework.UETA

        result = await compliance_service.validate_signature_request(
            mock_request, mock_signers, ComplianceLevel.ENHANCED
        )

        assert result.framework == ComplianceFramework.UETA
        assert isinstance(result.score, float)
        assert 0.0 <= result.score <= 1.0

    async def test_validate_eidas_compliance(
        self, compliance_service, mock_request, mock_signers
    ):
        """Test eIDAS compliance validation"""
        mock_request.compliance_framework = ComplianceFramework.EIDAS

        result = await compliance_service.validate_signature_request(
            mock_request, mock_signers, ComplianceLevel.STRICT
        )

        assert result.framework == ComplianceFramework.EIDAS
        assert isinstance(result.score, float)

    async def test_compliance_violation_detection(
        self, compliance_service, mock_request, mock_signers
    ):
        """Test detection of compliance violations"""
        # Remove legal notice to create violation
        mock_request.legal_notice = None
        mock_request.authentication_required = False

        result = await compliance_service.validate_signature_request(
            mock_request, mock_signers, ComplianceLevel.STANDARD
        )

        assert len(result.violations) > 0
        assert any("legal notice" in violation.lower() for violation in result.violations)

    def test_generate_compliance_report(self, compliance_service):
        """Test compliance report generation"""
        result = ValidationResult(True, ComplianceFramework.ESIGN_ACT, ComplianceLevel.STANDARD)
        result.score = 0.85
        result.requirements_met = ["Authentication enabled", "Legal notice provided"]
        result.violations = []
        result.recommendations = ["Consider 2FA for enhanced security"]

        report = compliance_service.generate_compliance_report(result)

        assert report["compliance_summary"]["is_compliant"] is True
        assert report["compliance_summary"]["framework"] == "esign_act"
        assert report["compliance_summary"]["score"] == 0.85
        assert report["requirements_analysis"]["requirements_met"] == 2
        assert report["requirements_analysis"]["violations_found"] == 0
        assert len(report["details"]["requirements_met"]) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])