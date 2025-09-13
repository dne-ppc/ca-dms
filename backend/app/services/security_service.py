"""
Security service for 2FA, SSO, audit logging, and security monitoring
"""
import secrets
import base64
import json
import hashlib
import hmac
import time
import math
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from cryptography.fernet import Fernet
from app.models.security import (
    UserTwoFactor, TwoFactorMethod, SSOConfiguration, UserSSOAccount,
    AuditLog, AuditEventType, AuditSeverity, SecurityAlert
)
from app.models.user import User
from app.schemas.security import (
    TOTPSetupResponse, TwoFactorStatusResponse, AuditLogCreate,
    AuditLogResponse, AuditLogFilter, SecurityAlertCreate, SecurityAlertResponse
)
from app.core.config import settings


class CryptoService:
    """Encryption/decryption service for sensitive data"""

    def __init__(self):
        # In production, this should be from environment variables
        if hasattr(settings, 'ENCRYPTION_KEY') and settings.ENCRYPTION_KEY:
            self.encryption_key = settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY
        else:
            self.encryption_key = Fernet.generate_key()
        self.cipher = Fernet(self.encryption_key)

    def encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()


class TOTPService:
    """Time-based One-Time Password service"""

    @staticmethod
    def generate_secret() -> str:
        """Generate a random base32 secret for TOTP"""
        return base64.b32encode(secrets.token_bytes(20)).decode('utf-8')

    @staticmethod
    def generate_qr_code_url(secret: str, user_email: str, issuer: str = "CA-DMS") -> str:
        """Generate QR code URL for authenticator apps with security validation"""
        import urllib.parse
        import re

        # Validate inputs to prevent injection attacks
        if not secret or not isinstance(secret, str):
            raise ValueError("Secret must be a non-empty string")
        if not user_email or not isinstance(user_email, str):
            raise ValueError("User email must be a non-empty string")
        if not issuer or not isinstance(issuer, str):
            raise ValueError("Issuer must be a non-empty string")

        # Validate email format to prevent injection
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, user_email):
            raise ValueError("Invalid email format")

        # Sanitize inputs by URL encoding to prevent XSS
        safe_email = urllib.parse.quote(user_email, safe='@.')
        safe_issuer = urllib.parse.quote(issuer, safe='')
        safe_secret = urllib.parse.quote(secret, safe='')

        # Additional security: block dangerous protocols
        if any(proto in user_email.lower() for proto in ['javascript:', 'data:', 'vbscript:']):
            raise ValueError("Invalid characters in email")
        if any(proto in issuer.lower() for proto in ['javascript:', 'data:', 'vbscript:']):
            raise ValueError("Invalid characters in issuer")

        return f"otpauth://totp/{safe_issuer}:{safe_email}?secret={safe_secret}&issuer={safe_issuer}"

    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """Generate backup recovery codes with input validation"""
        # Validate count parameter
        if not isinstance(count, int) or count < 1 or count > 50:
            raise ValueError("Count must be integer between 1 and 50")

        return [f"{secrets.randbelow(999999):06d}" for _ in range(count)]

    @staticmethod
    def verify_totp(secret: str, token: str, window: int = 1) -> bool:
        """Verify TOTP token with comprehensive input validation"""
        # Validate token format
        if not token or not isinstance(token, str):
            raise ValueError("Token must be a non-empty string")

        # Token must be exactly 6 digits
        if not token.isdigit() or len(token) != 6:
            raise ValueError("Token must be exactly 6 digits")

        # Validate secret format
        if not secret or not isinstance(secret, str):
            raise ValueError("Secret must be a non-empty string")

        try:
            # Validate base32 secret format by attempting decode
            base64.b32decode(secret)
        except Exception:
            raise ValueError("Invalid base32 secret format")

        # Validate window parameter
        if not isinstance(window, int) or window < 0 or window > 10:
            raise ValueError("Window must be integer between 0 and 10")

        # Proceed with verification using constant-time comparison
        current_time = int(time.time()) // 30

        for i in range(-window, window + 1):
            time_step = current_time + i
            expected_token = TOTPService._generate_token(secret, time_step)
            if hmac.compare_digest(token, expected_token):
                return True

        return False

    @staticmethod
    def _generate_token(secret: str, time_step: int) -> str:
        """Generate TOTP token for given time step with input validation"""
        # Validate secret format
        if not secret or not isinstance(secret, str):
            raise ValueError("Secret must be a non-empty string")

        # Validate time_step parameter
        if not isinstance(time_step, int) or time_step < 0:
            raise ValueError("Time step must be a non-negative integer")

        try:
            # Decode base32 secret with validation
            key = base64.b32decode(secret)
        except Exception:
            raise ValueError("Invalid base32 secret format")

        # Convert time step to bytes
        msg = time_step.to_bytes(8, byteorder='big')

        # Generate HMAC-SHA1 hash
        digest = hmac.new(key, msg, hashlib.sha1).digest()

        # Dynamic truncation
        offset = digest[-1] & 0x0f
        truncated = digest[offset:offset + 4]
        code = int.from_bytes(truncated, byteorder='big') & 0x7fffffff

        # Generate 6-digit token
        return f"{code % 1000000:06d}"


class SecurityService:
    """Main security service for 2FA, SSO, and audit logging"""

    def __init__(self, db: Session):
        self.db = db
        self.crypto = CryptoService()
        self.totp = TOTPService()

    # 2FA Methods
    def setup_totp_2fa(self, user_id: str) -> TOTPSetupResponse:
        """Setup TOTP 2FA for user"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        # Generate secret and backup codes
        secret = self.totp.generate_secret()
        backup_codes = self.totp.generate_backup_codes()

        # Create or update 2FA record
        two_factor = self.db.query(UserTwoFactor).filter(
            and_(UserTwoFactor.user_id == user_id, UserTwoFactor.method == TwoFactorMethod.TOTP)
        ).first()

        if not two_factor:
            two_factor = UserTwoFactor(
                user_id=user_id,
                method=TwoFactorMethod.TOTP
            )
            self.db.add(two_factor)

        # Encrypt and store secret and backup codes
        two_factor.totp_secret = self.crypto.encrypt(secret)
        two_factor.totp_backup_codes = [self.crypto.encrypt(code) for code in backup_codes]
        two_factor.is_enabled = False  # Will be enabled after verification
        two_factor.is_verified = False

        self.db.commit()

        # Generate QR code URL
        qr_url = self.totp.generate_qr_code_url(secret, user.email)

        # Log audit event
        self.log_audit_event(
            event_type=AuditEventType.MFA_ENABLED,
            user_id=user_id,
            severity=AuditSeverity.MEDIUM,
            message=f"TOTP 2FA setup initiated for user {user.email}",
            details={"method": "totp"}
        )

        return TOTPSetupResponse(
            secret=secret,
            qr_code_url=qr_url,
            backup_codes=backup_codes
        )

    def verify_totp_setup(self, user_id: str, code: str) -> bool:
        """Verify TOTP setup and enable 2FA"""
        two_factor = self.db.query(UserTwoFactor).filter(
            and_(
                UserTwoFactor.user_id == user_id,
                UserTwoFactor.method == TwoFactorMethod.TOTP,
                UserTwoFactor.totp_secret.isnot(None)
            )
        ).first()

        if not two_factor:
            return False

        # Decrypt secret and verify code
        secret = self.crypto.decrypt(two_factor.totp_secret)
        if not self.totp.verify_totp(secret, code):
            # Log failed verification
            self.log_audit_event(
                event_type=AuditEventType.MFA_FAILURE,
                user_id=user_id,
                severity=AuditSeverity.MEDIUM,
                message=f"TOTP verification failed for user during setup",
                details={"method": "totp", "action": "setup_verification"}
            )
            return False

        # Enable 2FA
        two_factor.is_enabled = True
        two_factor.is_verified = True
        two_factor.last_used_at = datetime.utcnow()
        self.db.commit()

        # Log successful setup
        self.log_audit_event(
            event_type=AuditEventType.MFA_ENABLED,
            user_id=user_id,
            severity=AuditSeverity.MEDIUM,
            message=f"TOTP 2FA successfully enabled for user",
            details={"method": "totp"}
        )

        return True

    def verify_totp_login(self, user_id: str, code: str) -> bool:
        """Verify TOTP code during login"""
        two_factor = self.db.query(UserTwoFactor).filter(
            and_(
                UserTwoFactor.user_id == user_id,
                UserTwoFactor.method == TwoFactorMethod.TOTP,
                UserTwoFactor.is_enabled == True,
                UserTwoFactor.is_verified == True
            )
        ).first()

        if not two_factor:
            return False

        # Check if account is locked
        if two_factor.locked_until and two_factor.locked_until > datetime.utcnow():
            self.log_audit_event(
                event_type=AuditEventType.MFA_FAILURE,
                user_id=user_id,
                severity=AuditSeverity.HIGH,
                message=f"TOTP verification attempted on locked account",
                details={"method": "totp", "locked_until": two_factor.locked_until.isoformat()}
            )
            return False

        # Try backup codes first
        if code in [self.crypto.decrypt(bc) for bc in (two_factor.totp_backup_codes or [])]:
            # Remove used backup code
            encrypted_codes = two_factor.totp_backup_codes or []
            two_factor.totp_backup_codes = [
                bc for bc in encrypted_codes if self.crypto.decrypt(bc) != code
            ]
            two_factor.last_used_at = datetime.utcnow()
            two_factor.failed_attempts = 0  # Reset failed attempts
            self.db.commit()

            self.log_audit_event(
                event_type=AuditEventType.MFA_SUCCESS,
                user_id=user_id,
                severity=AuditSeverity.LOW,
                message=f"Backup code used for 2FA verification",
                details={"method": "backup_code"}
            )
            return True

        # Verify TOTP code
        secret = self.crypto.decrypt(two_factor.totp_secret)
        if self.totp.verify_totp(secret, code):
            two_factor.last_used_at = datetime.utcnow()
            two_factor.failed_attempts = 0  # Reset failed attempts
            self.db.commit()

            self.log_audit_event(
                event_type=AuditEventType.MFA_SUCCESS,
                user_id=user_id,
                severity=AuditSeverity.LOW,
                message=f"TOTP 2FA verification successful",
                details={"method": "totp"}
            )
            return True

        # Handle failed attempt
        two_factor.failed_attempts += 1

        # Lock account after 5 failed attempts
        if two_factor.failed_attempts >= 5:
            two_factor.locked_until = datetime.utcnow() + timedelta(minutes=30)
            self.log_audit_event(
                event_type=AuditEventType.ACCOUNT_LOCKED,
                user_id=user_id,
                severity=AuditSeverity.HIGH,
                message=f"Account locked due to repeated 2FA failures",
                details={"method": "totp", "failed_attempts": two_factor.failed_attempts}
            )
        else:
            self.log_audit_event(
                event_type=AuditEventType.MFA_FAILURE,
                user_id=user_id,
                severity=AuditSeverity.MEDIUM,
                message=f"TOTP 2FA verification failed",
                details={"method": "totp", "failed_attempts": two_factor.failed_attempts}
            )

        self.db.commit()
        return False

    def get_2fa_status(self, user_id: str) -> TwoFactorStatusResponse:
        """Get user's 2FA status"""
        two_factor_methods = self.db.query(UserTwoFactor).filter(
            UserTwoFactor.user_id == user_id
        ).all()

        methods = []
        backup_codes_remaining = 0
        is_enabled = False

        for method in two_factor_methods:
            if method.is_enabled:
                is_enabled = True

            method_info = {
                "method": method.method.value,
                "is_enabled": method.is_enabled,
                "is_verified": method.is_verified,
                "last_used_at": method.last_used_at.isoformat() if method.last_used_at else None
            }

            if method.method == TwoFactorMethod.TOTP and method.totp_backup_codes:
                backup_codes_remaining = len(method.totp_backup_codes)

            methods.append(method_info)

        return TwoFactorStatusResponse(
            is_enabled=is_enabled,
            methods=methods,
            backup_codes_remaining=backup_codes_remaining
        )

    def disable_2fa(self, user_id: str, password: str) -> bool:
        """Disable 2FA for user after password verification"""
        from app.services.user_service import UserService
        user_service = UserService(self.db)

        # Verify password
        user = user_service.get_user(user_id)
        if not user or not user_service._verify_password(password, user.hashed_password):
            return False

        # Disable all 2FA methods
        two_factor_methods = self.db.query(UserTwoFactor).filter(
            UserTwoFactor.user_id == user_id
        ).all()

        for method in two_factor_methods:
            method.is_enabled = False

        self.db.commit()

        # Log audit event
        self.log_audit_event(
            event_type=AuditEventType.MFA_DISABLED,
            user_id=user_id,
            severity=AuditSeverity.MEDIUM,
            message=f"2FA disabled for user {user.email}",
            details={"methods": [m.method.value for m in two_factor_methods]}
        )

        return True

    # Audit Logging Methods
    def log_audit_event(
        self,
        event_type: AuditEventType,
        message: str,
        user_id: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.LOW,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        api_endpoint: Optional[str] = None,
        http_method: Optional[str] = None,
        http_status: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> str:
        """Log an audit event"""

        # Get user information if user_id provided
        user_email = None
        user_role = None
        if user_id:
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                user_email = user.email
                user_role = user.role.value

        # Calculate retention period based on event type and severity
        retention_days = self._get_retention_days(event_type, severity)
        retention_until = datetime.utcnow() + timedelta(days=retention_days)

        # Create audit log entry
        audit_log = AuditLog(
            event_type=event_type,
            severity=severity,
            message=message,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            ip_address=ip_address,
            user_agent=user_agent,
            api_endpoint=api_endpoint,
            http_method=http_method,
            http_status=http_status,
            details=details,
            before_state=before_state,
            after_state=after_state,
            correlation_id=correlation_id,
            tags=tags,
            retention_until=retention_until,
            is_sensitive=self._is_sensitive_event(event_type)
        )

        self.db.add(audit_log)
        self.db.commit()

        # Check for security alerts
        self._check_security_patterns(audit_log)

        return audit_log.id

    def get_audit_logs(
        self,
        filters: Optional[AuditLogFilter] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[AuditLogResponse], int]:
        """Get audit logs with filtering and pagination"""
        query = self.db.query(AuditLog)

        if filters:
            if filters.event_types:
                query = query.filter(AuditLog.event_type.in_(filters.event_types))

            if filters.severities:
                query = query.filter(AuditLog.severity.in_(filters.severities))

            if filters.user_ids:
                query = query.filter(AuditLog.user_id.in_(filters.user_ids))

            if filters.resource_types:
                query = query.filter(AuditLog.resource_type.in_(filters.resource_types))

            if filters.ip_addresses:
                query = query.filter(AuditLog.ip_address.in_(filters.ip_addresses))

            if filters.start_date:
                query = query.filter(AuditLog.created_at >= filters.start_date)

            if filters.end_date:
                query = query.filter(AuditLog.created_at <= filters.end_date)

            if filters.tags:
                for tag in filters.tags:
                    query = query.filter(AuditLog.tags.contains([tag]))

            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        AuditLog.message.ilike(search_term),
                        AuditLog.details.astext.ilike(search_term)
                    )
                )

        # Get total count
        total = query.count()

        # Apply pagination and ordering
        audit_logs = query.order_by(desc(AuditLog.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        # Convert to response format
        responses = [AuditLogResponse.model_validate(log) for log in audit_logs]

        return responses, total

    def create_security_alert(self, alert_data: SecurityAlertCreate) -> SecurityAlertResponse:
        """Create a security alert"""
        alert = SecurityAlert(
            title=alert_data.title,
            description=alert_data.description,
            severity=alert_data.severity,
            alert_type=alert_data.alert_type,
            category=alert_data.category,
            user_id=alert_data.user_id,
            ip_address=alert_data.ip_address,
            resource_type=alert_data.resource_type,
            resource_id=alert_data.resource_id,
            context=alert_data.context,
            related_audit_logs=alert_data.related_audit_logs
        )

        self.db.add(alert)
        self.db.commit()

        # Log audit event for alert creation
        self.log_audit_event(
            event_type=AuditEventType.SUSPICIOUS_ACTIVITY,
            severity=alert_data.severity,
            message=f"Security alert created: {alert_data.title}",
            details={
                "alert_id": alert.id,
                "alert_type": alert_data.alert_type,
                "category": alert_data.category
            }
        )

        return SecurityAlertResponse.model_validate(alert)

    def _get_retention_days(self, event_type: AuditEventType, severity: AuditSeverity) -> int:
        """Get retention period for audit logs based on type and severity"""
        # Default retention periods
        severity_retention = {
            AuditSeverity.LOW: 90,
            AuditSeverity.MEDIUM: 180,
            AuditSeverity.HIGH: 365,
            AuditSeverity.CRITICAL: 2555  # 7 years
        }

        # Special retention for specific event types
        event_retention = {
            AuditEventType.LOGIN_SUCCESS: 30,
            AuditEventType.LOGIN_FAILURE: 365,
            AuditEventType.PASSWORD_CHANGE: 365,
            AuditEventType.ROLE_CHANGED: 2555,  # 7 years
            AuditEventType.DOCUMENT_DELETED: 2555,  # 7 years
            AuditEventType.SYSTEM_CONFIG_CHANGED: 2555,  # 7 years
        }

        # Use event-specific retention if available, otherwise use severity-based
        return event_retention.get(event_type, severity_retention[severity])

    def _is_sensitive_event(self, event_type: AuditEventType) -> bool:
        """Check if event type contains sensitive information"""
        sensitive_events = {
            AuditEventType.PASSWORD_CHANGE,
            AuditEventType.PASSWORD_RESET,
            AuditEventType.MFA_ENABLED,
            AuditEventType.MFA_DISABLED,
            AuditEventType.SSO_ACCOUNT_LINKED,
            AuditEventType.SSO_ACCOUNT_UNLINKED,
        }

        return event_type in sensitive_events

    def _check_security_patterns(self, audit_log: AuditLog):
        """Check for security patterns and create alerts if needed"""
        # Check for repeated failed login attempts
        if audit_log.event_type == AuditEventType.LOGIN_FAILURE:
            self._check_failed_login_pattern(audit_log)

        # Check for suspicious IP addresses
        if audit_log.ip_address:
            self._check_suspicious_ip_pattern(audit_log)

        # Check for unusual activity patterns
        if audit_log.user_id:
            self._check_unusual_activity_pattern(audit_log)

    def _check_failed_login_pattern(self, audit_log: AuditLog):
        """Check for patterns of failed login attempts"""
        # Count failed logins in last 15 minutes
        cutoff_time = datetime.utcnow() - timedelta(minutes=15)

        failed_count = self.db.query(AuditLog).filter(
            and_(
                AuditLog.event_type == AuditEventType.LOGIN_FAILURE,
                AuditLog.ip_address == audit_log.ip_address,
                AuditLog.created_at >= cutoff_time
            )
        ).count()

        if failed_count >= 5:
            # Create security alert
            self.create_security_alert(SecurityAlertCreate(
                title=f"Multiple failed login attempts from IP {audit_log.ip_address}",
                description=f"Detected {failed_count} failed login attempts in 15 minutes",
                severity=AuditSeverity.HIGH,
                alert_type="failed_login_attempts",
                category="authentication",
                ip_address=audit_log.ip_address,
                context={
                    "failed_count": failed_count,
                    "time_window": "15_minutes",
                    "threshold": 5
                }
            ))

    def _check_suspicious_ip_pattern(self, audit_log: AuditLog):
        """Check for suspicious IP address patterns"""
        # This would integrate with threat intelligence feeds in production
        # For now, we'll check for basic patterns

        # Check for access from multiple countries in short time
        # This would require IP geolocation service integration
        pass

    def _check_unusual_activity_pattern(self, audit_log: AuditLog):
        """Check for unusual user activity patterns"""
        # Check for activity outside normal hours
        current_hour = datetime.utcnow().hour

        # Activity between 2 AM and 6 AM might be unusual
        if 2 <= current_hour <= 6:
            # Get user's typical activity hours from historical data
            # This is a simplified check - production would use ML models
            pass