"""
Digital Signature Provider Interface
TDD Cycle 2: Provider Interface and Abstract Classes - GREEN Phase

Implements the abstract interface and data classes for signature providers
following the test specifications exactly for proper TDD methodology.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import re
import enum


class SignatureStatus(enum.Enum):
    """Status of a signature envelope"""
    DRAFT = "draft"
    SENT = "sent"
    PENDING = "pending"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# Custom exceptions for provider errors
class ProviderError(Exception):
    """Base exception for signature provider errors"""

    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


class EnvelopeNotFoundError(ProviderError):
    """Exception raised when envelope is not found"""

    def __init__(self, envelope_id: str):
        self.envelope_id = envelope_id
        super().__init__(f"Envelope not found: {envelope_id}", "ENVELOPE_NOT_FOUND")


class InvalidParticipantError(ProviderError):
    """Exception raised when participant data is invalid"""

    def __init__(self, email: str, reason: str):
        self.email = email
        self.reason = reason
        super().__init__(f"Invalid participant {email}: {reason}", "INVALID_PARTICIPANT")


@dataclass
class SignatureParticipant:
    """Data class representing a signature participant"""
    email: str
    name: str
    role: str
    signing_order: int
    external_id: Optional[str] = None

    def __post_init__(self):
        """Validate participant data after initialization"""
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, self.email):
            raise ValueError(f"Invalid email format: {self.email}")


@dataclass
class SignatureField:
    """Data class representing a signature field in a document"""
    field_type: str
    page: int
    x: float
    y: float
    width: float
    height: float
    participant_email: str
    required: bool = True
    tab_label: Optional[str] = None

    def __post_init__(self):
        """Validate field coordinates after initialization"""
        # Validate coordinates are not negative
        if self.x < 0 or self.y < 0:
            raise ValueError("Field coordinates cannot be negative")
        if self.width <= 0 or self.height <= 0:
            raise ValueError("Field dimensions must be positive")


@dataclass
class SignatureEnvelope:
    """Data class representing a signature envelope"""
    id: str
    title: str
    status: SignatureStatus
    document_content: bytes
    participants: List[SignatureParticipant] = field(default_factory=list)
    fields: List[SignatureField] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


class SignatureProviderInterface(ABC):
    """
    Abstract interface for digital signature providers.

    This interface defines the common methods that all signature providers
    (DocuSign, Adobe Sign, etc.) must implement.
    """

    @abstractmethod
    def create_envelope(self, document_content: bytes, title: str) -> str:
        """
        Create a new signature envelope.

        Args:
            document_content: PDF document content as bytes
            title: Title for the signature request

        Returns:
            str: Envelope ID from the provider

        Raises:
            ProviderError: If envelope creation fails
        """
        pass

    @abstractmethod
    def send_envelope(self, envelope_id: str) -> bool:
        """
        Send an envelope for signature.

        Args:
            envelope_id: ID of the envelope to send

        Returns:
            bool: True if envelope was sent successfully

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            ProviderError: If sending fails
        """
        pass

    @abstractmethod
    def get_envelope_status(self, envelope_id: str) -> SignatureStatus:
        """
        Get the current status of an envelope.

        Args:
            envelope_id: ID of the envelope

        Returns:
            SignatureStatus: Current status of the envelope

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            ProviderError: If status check fails
        """
        pass

    @abstractmethod
    def cancel_envelope(self, envelope_id: str) -> bool:
        """
        Cancel a signature envelope.

        Args:
            envelope_id: ID of the envelope to cancel

        Returns:
            bool: True if envelope was cancelled successfully

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            ProviderError: If cancellation fails
        """
        pass

    @abstractmethod
    def download_completed_document(self, envelope_id: str) -> bytes:
        """
        Download the completed signed document.

        Args:
            envelope_id: ID of the completed envelope

        Returns:
            bytes: Signed document content

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            ProviderError: If document is not completed or download fails
        """
        pass

    @abstractmethod
    def add_participant(self, envelope_id: str, participant: SignatureParticipant) -> str:
        """
        Add a participant to an envelope.

        Args:
            envelope_id: ID of the envelope
            participant: Participant to add

        Returns:
            str: Participant ID from the provider

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            InvalidParticipantError: If participant data is invalid
            ProviderError: If adding participant fails
        """
        pass

    @abstractmethod
    def add_signature_field(self, envelope_id: str, field: SignatureField) -> str:
        """
        Add a signature field to an envelope.

        Args:
            envelope_id: ID of the envelope
            field: Signature field to add

        Returns:
            str: Field ID from the provider

        Raises:
            EnvelopeNotFoundError: If envelope doesn't exist
            ProviderError: If adding field fails
        """
        pass

    @abstractmethod
    def validate_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Validate provider configuration.

        Args:
            config: Configuration dictionary to validate

        Returns:
            bool: True if configuration is valid

        Raises:
            ProviderError: If configuration is invalid
        """
        pass


class SignatureProviderRegistry:
    """
    Registry for managing signature provider implementations.

    Allows registration and retrieval of signature provider classes.
    """

    def __init__(self):
        self._providers: Dict[str, type] = {}

    def register(self, name: str, provider_class: type) -> None:
        """
        Register a signature provider class.

        Args:
            name: Name of the provider (e.g., "docusign", "adobe_sign")
            provider_class: Class that implements SignatureProviderInterface

        Raises:
            ValueError: If provider class doesn't implement the interface
        """
        if not issubclass(provider_class, SignatureProviderInterface):
            raise ValueError(f"Provider class must implement SignatureProviderInterface")

        self._providers[name] = provider_class

    def get_provider_class(self, name: str) -> type:
        """
        Get a registered provider class.

        Args:
            name: Name of the provider

        Returns:
            type: Provider class

        Raises:
            ValueError: If provider is not registered
        """
        if name not in self._providers:
            raise ValueError(f"Provider '{name}' is not registered")

        return self._providers[name]

    def list_providers(self) -> List[str]:
        """
        List all registered provider names.

        Returns:
            List[str]: List of registered provider names
        """
        return list(self._providers.keys())

    def create_provider(self, name: str, config: Dict[str, Any]) -> SignatureProviderInterface:
        """
        Create an instance of a registered provider.

        Args:
            name: Name of the provider
            config: Configuration for the provider

        Returns:
            SignatureProviderInterface: Provider instance

        Raises:
            ValueError: If provider is not registered
            ProviderError: If provider creation fails
        """
        provider_class = self.get_provider_class(name)
        return provider_class(config)


# Global registry instance
provider_registry = SignatureProviderRegistry()