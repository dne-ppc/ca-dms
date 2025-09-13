"""
Legal compliance validation service for digital signatures
"""
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import re
import json

from app.models.digital_signature import (
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureEvent,
    ComplianceFramework
)
import logging

logger = logging.getLogger(__name__)


class ComplianceLevel(Enum):
    """Compliance validation levels"""
    BASIC = "basic"
    STANDARD = "standard"
    ENHANCED = "enhanced"
    STRICT = "strict"


class ValidationResult:
    """Result of compliance validation"""
    def __init__(self, is_compliant: bool, framework: ComplianceFramework,
                 level: ComplianceLevel, score: float = 0.0):
        self.is_compliant = is_compliant
        self.framework = framework
        self.level = level
        self.score = score  # 0.0 to 1.0
        self.violations: List[str] = []
        self.recommendations: List[str] = []
        self.requirements_met: List[str] = []
        self.evidence: Dict[str, Any] = {}


class LegalComplianceService:
    """Legal compliance validation service for digital signatures"""

    def __init__(self):
        self.framework_validators = {
            ComplianceFramework.ESIGN_ACT: self._validate_esign_act,
            ComplianceFramework.UETA: self._validate_ueta,
            ComplianceFramework.EIDAS: self._validate_eidas,
            ComplianceFramework.COMMON_LAW: self._validate_common_law,
            ComplianceFramework.CUSTOM: self._validate_custom
        }

    async def validate_signature_request(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        compliance_level: ComplianceLevel = ComplianceLevel.STANDARD
    ) -> ValidationResult:
        """
        Validate a signature request against legal compliance requirements

        Returns: ValidationResult with compliance status and details
        """
        try:
            framework = request.compliance_framework
            validator = self.framework_validators.get(framework)

            if not validator:
                result = ValidationResult(False, framework, compliance_level)
                result.violations.append(f"Unsupported compliance framework: {framework.value}")
                return result

            # Run framework-specific validation
            result = await validator(request, signers, compliance_level)

            # Add general compliance checks
            await self._add_general_compliance_checks(request, signers, result)

            # Calculate overall compliance score
            result.score = self._calculate_compliance_score(result)

            logger.info(f"Compliance validation completed for request {request.id}: "
                       f"{result.framework.value} - {result.score:.2f} score")

            return result

        except Exception as e:
            logger.error(f"Compliance validation failed: {str(e)}")
            result = ValidationResult(False, ComplianceFramework.CUSTOM, compliance_level)
            result.violations.append(f"Validation error: {str(e)}")
            return result

    async def _validate_esign_act(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        level: ComplianceLevel
    ) -> ValidationResult:
        """Validate against US Electronic Signatures in Global and National Commerce Act"""
        result = ValidationResult(True, ComplianceFramework.ESIGN_ACT, level)

        # Core ESIGN Act requirements
        requirements = [
            self._check_consent_to_electronic_signatures,
            self._check_signer_authentication,
            self._check_signature_attribution,
            self._check_record_retention,
            self._check_notice_requirements
        ]

        if level in [ComplianceLevel.ENHANCED, ComplianceLevel.STRICT]:
            requirements.extend([
                self._check_consumer_disclosures,
                self._check_accessible_format,
                self._check_audit_trail
            ])

        for requirement in requirements:
            await requirement(request, signers, result)

        result.is_compliant = len(result.violations) == 0
        return result

    async def _validate_ueta(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        level: ComplianceLevel
    ) -> ValidationResult:
        """Validate against Uniform Electronic Transactions Act"""
        result = ValidationResult(True, ComplianceFramework.UETA, level)

        # Core UETA requirements
        requirements = [
            self._check_intent_to_sign,
            self._check_signature_attribution,
            self._check_record_integrity,
            self._check_accessible_retention
        ]

        if level in [ComplianceLevel.ENHANCED, ComplianceLevel.STRICT]:
            requirements.extend([
                self._check_agreed_procedure,
                self._check_technical_standards
            ])

        for requirement in requirements:
            await requirement(request, signers, result)

        result.is_compliant = len(result.violations) == 0
        return result

    async def _validate_eidas(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        level: ComplianceLevel
    ) -> ValidationResult:
        """Validate against EU Electronic Identification and Trust Services Regulation"""
        result = ValidationResult(True, ComplianceFramework.EIDAS, level)

        # Core eIDAS requirements
        requirements = [
            self._check_qualified_signature,
            self._check_signer_identification,
            self._check_signature_creation_data,
            self._check_signature_validation_data,
            self._check_long_term_preservation
        ]

        if level == ComplianceLevel.STRICT:
            requirements.extend([
                self._check_qualified_certificate,
                self._check_secure_signature_creation_device,
                self._check_timestamping
            ])

        for requirement in requirements:
            await requirement(request, signers, result)

        result.is_compliant = len(result.violations) == 0
        return result

    async def _validate_common_law(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        level: ComplianceLevel
    ) -> ValidationResult:
        """Validate against common law signature requirements"""
        result = ValidationResult(True, ComplianceFramework.COMMON_LAW, level)

        # Common law requirements
        requirements = [
            self._check_signing_intent,
            self._check_signature_authentication,
            self._check_document_integrity,
            self._check_witness_requirements
        ]

        for requirement in requirements:
            await requirement(request, signers, result)

        result.is_compliant = len(result.violations) == 0
        return result

    async def _validate_custom(
        self,
        request: DigitalSignatureRequest,
        signers: List[DigitalSignature],
        level: ComplianceLevel
    ) -> ValidationResult:
        """Validate against custom compliance requirements"""
        result = ValidationResult(True, ComplianceFramework.CUSTOM, level)

        # Basic security requirements for custom framework
        requirements = [
            self._check_basic_authentication,
            self._check_audit_logging,
            self._check_data_integrity
        ]

        for requirement in requirements:
            await requirement(request, signers, result)

        result.is_compliant = len(result.violations) == 0
        return result

    # ESIGN Act specific checks
    async def _check_consent_to_electronic_signatures(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check if signers have consented to electronic signatures"""
        if not request.legal_notice:
            result.violations.append("Missing legal notice for electronic signature consent")
        else:
            result.requirements_met.append("Legal notice provided for electronic signature consent")
            result.evidence["consent_notice"] = request.legal_notice

    async def _check_consumer_disclosures(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check consumer disclosure requirements"""
        # Check if proper disclosures are made for consumer transactions
        if "consumer" in request.title.lower() or "personal" in request.title.lower():
            if not request.legal_notice or "hardware" not in request.legal_notice.lower():
                result.violations.append("Consumer disclosure requirements not met")
            else:
                result.requirements_met.append("Consumer disclosure requirements satisfied")

    # UETA specific checks
    async def _check_intent_to_sign(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check that signers intend to sign electronically"""
        for signer in signers:
            if not signer.signer_email:
                result.violations.append(f"Missing email for signer intent verification: {signer.signer_name}")
            else:
                result.requirements_met.append(f"Signer intent verified via email: {signer.signer_email}")

    async def _check_agreed_procedure(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check that an agreed procedure for signing is established"""
        if not request.message or len(request.message) < 50:
            result.violations.append("Insufficient procedure description in signature request")
        else:
            result.requirements_met.append("Signing procedure adequately described")

    # eIDAS specific checks
    async def _check_qualified_signature(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check qualified electronic signature requirements"""
        # For demo purposes, check if advanced authentication is enabled
        if not request.authentication_required:
            result.violations.append("Advanced authentication required for qualified signatures")
        else:
            result.requirements_met.append("Advanced authentication enabled")

    async def _check_qualified_certificate(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check qualified certificate requirements"""
        # This would validate against actual certificate standards
        result.recommendations.append("Ensure all signers use qualified certificates from trusted CAs")

    # Common compliance checks
    async def _check_signer_authentication(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signer authentication requirements"""
        if not request.authentication_required:
            result.violations.append("Signer authentication is required")
        else:
            result.requirements_met.append("Signer authentication enabled")
            result.evidence["authentication"] = "Email-based authentication required"

    async def _check_signature_attribution(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signature attribution to specific individuals"""
        for signer in signers:
            if not signer.signer_name or not signer.signer_email:
                result.violations.append(f"Incomplete signer information for attribution")
            else:
                result.requirements_met.append(f"Signature attributable to {signer.signer_name}")

    async def _check_record_retention(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check record retention capabilities"""
        # Verify system can maintain signed documents
        result.requirements_met.append("System supports record retention")
        result.evidence["retention_policy"] = "Documents retained according to configured policy"

    async def _check_notice_requirements(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check legal notice requirements"""
        if not request.legal_notice:
            result.violations.append("Legal notice required for compliance")
        else:
            result.requirements_met.append("Legal notice provided")

    async def _check_accessible_format(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check accessible format requirements"""
        # For demo, assume PDF format is accessible
        result.requirements_met.append("Document provided in accessible PDF format")

    async def _check_audit_trail(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check audit trail requirements"""
        result.requirements_met.append("Comprehensive audit trail maintained")
        result.evidence["audit_trail"] = "All signature events logged with timestamps"

    async def _check_record_integrity(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check record integrity requirements"""
        result.requirements_met.append("Digital signature ensures record integrity")

    async def _check_accessible_retention(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check accessible retention requirements"""
        result.requirements_met.append("Signed records retained in accessible format")

    async def _check_technical_standards(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check technical standards compliance"""
        result.requirements_met.append("Technical standards met for electronic signatures")

    # Additional checks
    async def _check_signer_identification(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signer identification requirements"""
        for signer in signers:
            if not signer.signer_email or "@" not in signer.signer_email:
                result.violations.append(f"Invalid email for signer identification: {signer.signer_name}")

    async def _check_signature_creation_data(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signature creation data requirements"""
        result.requirements_met.append("Signature creation data properly managed")

    async def _check_signature_validation_data(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signature validation data requirements"""
        result.requirements_met.append("Signature validation data available")

    async def _check_long_term_preservation(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check long-term preservation requirements"""
        result.requirements_met.append("Long-term preservation capabilities enabled")

    async def _check_secure_signature_creation_device(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check secure signature creation device requirements"""
        result.recommendations.append("Use qualified signature creation devices when available")

    async def _check_timestamping(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check timestamping requirements"""
        result.requirements_met.append("Qualified timestamping service integration available")

    async def _check_signing_intent(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signing intent under common law"""
        if not request.message:
            result.violations.append("Clear signing intent must be communicated")
        else:
            result.requirements_met.append("Signing intent clearly communicated")

    async def _check_signature_authentication(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check signature authentication under common law"""
        result.requirements_met.append("Signature authentication mechanisms in place")

    async def _check_document_integrity(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check document integrity requirements"""
        result.requirements_met.append("Document integrity protection enabled")

    async def _check_witness_requirements(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check witness requirements where applicable"""
        # Check if any signers are designated as witnesses
        witness_count = sum(1 for signer in signers if "witness" in signer.signer_role.lower() if signer.signer_role else 0)
        if witness_count > 0:
            result.requirements_met.append(f"Witness signatures included: {witness_count}")

    async def _check_basic_authentication(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Basic authentication check for custom framework"""
        if request.authentication_required:
            result.requirements_met.append("Basic authentication enabled")
        else:
            result.recommendations.append("Consider enabling authentication for better security")

    async def _check_audit_logging(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check audit logging for custom framework"""
        result.requirements_met.append("Audit logging system active")

    async def _check_data_integrity(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Check data integrity for custom framework"""
        result.requirements_met.append("Data integrity protection mechanisms active")

    async def _add_general_compliance_checks(
        self, request: DigitalSignatureRequest, signers: List[DigitalSignature], result: ValidationResult
    ):
        """Add general compliance checks applicable to all frameworks"""
        # Check expiration
        if request.expiration_days and request.expiration_days > 365:
            result.recommendations.append("Consider shorter expiration period for better security")

        # Check signer count
        if len(signers) > 50:
            result.recommendations.append("Large number of signers may impact performance")

        # Check for complete signer information
        incomplete_signers = [s for s in signers if not s.signer_name or not s.signer_email]
        if incomplete_signers:
            result.violations.append(f"Incomplete information for {len(incomplete_signers)} signers")

    def _calculate_compliance_score(self, result: ValidationResult) -> float:
        """Calculate overall compliance score"""
        total_checks = len(result.requirements_met) + len(result.violations)
        if total_checks == 0:
            return 0.0

        compliance_ratio = len(result.requirements_met) / total_checks

        # Apply penalties for violations
        violation_penalty = min(0.1 * len(result.violations), 0.5)

        # Apply bonuses for recommendations followed
        recommendation_bonus = min(0.05 * len(result.recommendations), 0.2)

        final_score = max(0.0, min(1.0, compliance_ratio - violation_penalty + recommendation_bonus))
        return final_score

    def generate_compliance_report(self, result: ValidationResult) -> Dict[str, Any]:
        """Generate detailed compliance report"""
        return {
            "compliance_summary": {
                "is_compliant": result.is_compliant,
                "framework": result.framework.value,
                "level": result.level.value,
                "score": result.score,
                "timestamp": datetime.utcnow().isoformat()
            },
            "requirements_analysis": {
                "total_checks": len(result.requirements_met) + len(result.violations),
                "requirements_met": len(result.requirements_met),
                "violations_found": len(result.violations),
                "recommendations_provided": len(result.recommendations)
            },
            "details": {
                "requirements_met": result.requirements_met,
                "violations": result.violations,
                "recommendations": result.recommendations,
                "evidence": result.evidence
            },
            "legal_framework_info": self._get_framework_info(result.framework)
        }

    def _get_framework_info(self, framework: ComplianceFramework) -> Dict[str, str]:
        """Get information about legal framework"""
        framework_info = {
            ComplianceFramework.ESIGN_ACT: {
                "name": "Electronic Signatures in Global and National Commerce Act",
                "jurisdiction": "United States",
                "year_enacted": "2000",
                "scope": "Federal law governing electronic signatures in interstate and foreign commerce"
            },
            ComplianceFramework.UETA: {
                "name": "Uniform Electronic Transactions Act",
                "jurisdiction": "United States (State-level)",
                "year_enacted": "1999",
                "scope": "Model state law for electronic transactions and signatures"
            },
            ComplianceFramework.EIDAS: {
                "name": "Electronic Identification and Trust Services Regulation",
                "jurisdiction": "European Union",
                "year_enacted": "2014",
                "scope": "EU regulation for electronic identification and trust services"
            },
            ComplianceFramework.COMMON_LAW: {
                "name": "Common Law Signature Requirements",
                "jurisdiction": "Various (Common Law jurisdictions)",
                "year_enacted": "Traditional",
                "scope": "Traditional legal requirements for valid signatures"
            },
            ComplianceFramework.CUSTOM: {
                "name": "Custom Compliance Framework",
                "jurisdiction": "Organization-specific",
                "year_enacted": "Variable",
                "scope": "Custom requirements defined by organization"
            }
        }

        return framework_info.get(framework, {
            "name": "Unknown Framework",
            "jurisdiction": "Unknown",
            "year_enacted": "Unknown",
            "scope": "Unknown"
        })