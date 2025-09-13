"""
Single Sign-On (SSO) service for OAuth2 and SAML integration
"""
import json
import secrets
import base64
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode, parse_qs
import requests
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.security import SSOConfiguration, UserSSOAccount, SSOProvider
from app.models.user import User, UserRole
from app.services.security_service import SecurityService
from app.schemas.security import SSOLoginResponse, SSOConfigurationResponse
from app.core.config import settings


class OAuth2Service:
    """OAuth2 provider integration service"""

    def __init__(self, db: Session):
        self.db = db
        self.security_service = SecurityService(db)

    def get_authorization_url(self, config: SSOConfiguration, state: str, redirect_uri: str) -> str:
        """Generate OAuth2 authorization URL"""

        provider_configs = {
            SSOProvider.OAUTH2_GOOGLE: {
                "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "default_scopes": ["openid", "email", "profile"]
            },
            SSOProvider.OAUTH2_MICROSOFT: {
                "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "default_scopes": ["openid", "email", "profile"]
            },
            SSOProvider.OAUTH2_GITHUB: {
                "auth_url": "https://github.com/login/oauth/authorize",
                "default_scopes": ["user:email", "read:user"]
            }
        }

        provider_config = provider_configs.get(config.provider_type)
        if not provider_config:
            raise ValueError(f"Unsupported OAuth2 provider: {config.provider_type}")

        scopes = config.scopes or provider_config["default_scopes"]

        params = {
            "client_id": config.client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(scopes),
            "state": state,
            "response_type": "code"
        }

        # Microsoft-specific parameters
        if config.provider_type == SSOProvider.OAUTH2_MICROSOFT:
            params["response_mode"] = "query"

        return f"{provider_config['auth_url']}?{urlencode(params)}"

    def exchange_code_for_token(self, config: SSOConfiguration, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""

        token_urls = {
            SSOProvider.OAUTH2_GOOGLE: "https://oauth2.googleapis.com/token",
            SSOProvider.OAUTH2_MICROSOFT: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            SSOProvider.OAUTH2_GITHUB: "https://github.com/login/oauth/access_token"
        }

        token_url = token_urls.get(config.provider_type)
        if not token_url:
            raise ValueError(f"Unsupported OAuth2 provider: {config.provider_type}")

        data = {
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }

        headers = {"Accept": "application/json"}

        response = requests.post(token_url, data=data, headers=headers)
        response.raise_for_status()

        return response.json()

    def get_user_info(self, config: SSOConfiguration, access_token: str) -> Dict[str, Any]:
        """Get user information from OAuth2 provider"""

        user_info_urls = {
            SSOProvider.OAUTH2_GOOGLE: "https://www.googleapis.com/oauth2/v2/userinfo",
            SSOProvider.OAUTH2_MICROSOFT: "https://graph.microsoft.com/v1.0/me",
            SSOProvider.OAUTH2_GITHUB: "https://api.github.com/user"
        }

        user_info_url = user_info_urls.get(config.provider_type)
        if not user_info_url:
            raise ValueError(f"Unsupported OAuth2 provider: {config.provider_type}")

        headers = {"Authorization": f"Bearer {access_token}"}

        response = requests.get(user_info_url, headers=headers)
        response.raise_for_status()

        user_data = response.json()

        # Normalize user data across providers
        normalized_data = self._normalize_user_data(config.provider_type, user_data)

        # Get email if not in main user data (GitHub specific)
        if config.provider_type == SSOProvider.OAUTH2_GITHUB and not normalized_data.get("email"):
            email_response = requests.get("https://api.github.com/user/emails", headers=headers)
            if email_response.status_code == 200:
                emails = email_response.json()
                primary_email = next((e["email"] for e in emails if e["primary"]), None)
                if primary_email:
                    normalized_data["email"] = primary_email

        return normalized_data

    def _normalize_user_data(self, provider_type: SSOProvider, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize user data from different OAuth2 providers"""

        if provider_type == SSOProvider.OAUTH2_GOOGLE:
            return {
                "id": user_data.get("id"),
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "given_name": user_data.get("given_name"),
                "family_name": user_data.get("family_name"),
                "picture": user_data.get("picture"),
                "verified_email": user_data.get("verified_email", False)
            }

        elif provider_type == SSOProvider.OAUTH2_MICROSOFT:
            return {
                "id": user_data.get("id"),
                "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                "name": user_data.get("displayName"),
                "given_name": user_data.get("givenName"),
                "family_name": user_data.get("surname"),
                "picture": None,  # Would need separate Graph API call
                "verified_email": True  # Microsoft emails are considered verified
            }

        elif provider_type == SSOProvider.OAUTH2_GITHUB:
            return {
                "id": str(user_data.get("id")),
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "username": user_data.get("login"),
                "picture": user_data.get("avatar_url"),
                "verified_email": True  # GitHub emails in API are verified
            }

        return user_data


class SAMLService:
    """SAML provider integration service"""

    def __init__(self, db: Session):
        self.db = db
        self.security_service = SecurityService(db)

    def get_authentication_request(self, config: SSOConfiguration, relay_state: str) -> str:
        """Generate SAML authentication request"""
        # This is a simplified SAML implementation
        # In production, use a library like python3-saml

        import uuid
        from datetime import datetime

        request_id = str(uuid.uuid4())
        issue_instant = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Create SAML AuthnRequest XML
        authn_request = f"""
        <samlp:AuthnRequest
            xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
            xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
            ID="{request_id}"
            Version="2.0"
            IssueInstant="{issue_instant}"
            Destination="{config.saml_metadata_url}"
            AssertionConsumerServiceURL="{config.saml_acs_url}">
            <saml:Issuer>{config.saml_entity_id}</saml:Issuer>
        </samlp:AuthnRequest>
        """

        # Encode the request
        encoded_request = base64.b64encode(authn_request.encode()).decode()

        return encoded_request

    def process_saml_response(self, config: SSOConfiguration, saml_response: str) -> Dict[str, Any]:
        """Process SAML response and extract user data"""
        # This is a simplified implementation
        # In production, use a proper SAML library for validation and parsing

        try:
            # Decode SAML response
            decoded_response = base64.b64decode(saml_response).decode()

            # Parse XML and extract user attributes
            # This would use proper XML parsing and validation in production
            user_data = {
                "id": "saml_user_id",
                "email": "user@example.com",
                "name": "SAML User",
                "attributes": {}
            }

            return user_data

        except Exception as e:
            raise ValueError(f"Invalid SAML response: {str(e)}")


class SSOService:
    """Main SSO service orchestrating OAuth2 and SAML"""

    def __init__(self, db: Session):
        self.db = db
        self.oauth2_service = OAuth2Service(db)
        self.saml_service = SAMLService(db)
        self.security_service = SecurityService(db)

    def initiate_sso_login(self, provider_id: str, redirect_url: Optional[str] = None) -> SSOLoginResponse:
        """Initiate SSO login process"""
        config = self.db.query(SSOConfiguration).filter(
            and_(SSOConfiguration.id == provider_id, SSOConfiguration.is_enabled == True)
        ).first()

        if not config:
            raise ValueError("SSO provider not found or disabled")

        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)

        # Store state in cache/session (simplified - use Redis in production)
        # For now, we'll include it in the response

        if config.provider_type in [SSOProvider.OAUTH2_GOOGLE, SSOProvider.OAUTH2_MICROSOFT, SSOProvider.OAUTH2_GITHUB]:
            authorization_url = self.oauth2_service.get_authorization_url(
                config, state, config.redirect_uri
            )
        elif config.provider_type == SSOProvider.SAML:
            # For SAML, we would generate and redirect to IdP
            authorization_url = f"{config.saml_metadata_url}?SAMLRequest={self.saml_service.get_authentication_request(config, state)}"
        else:
            raise ValueError(f"Unsupported SSO provider type: {config.provider_type}")

        return SSOLoginResponse(
            authorization_url=authorization_url,
            state=state
        )

    def process_sso_callback(
        self,
        provider_id: str,
        code: Optional[str] = None,
        state: Optional[str] = None,
        saml_response: Optional[str] = None
    ) -> Tuple[User, bool]:
        """Process SSO callback and authenticate/create user"""
        config = self.db.query(SSOConfiguration).filter(
            and_(SSOConfiguration.id == provider_id, SSOConfiguration.is_enabled == True)
        ).first()

        if not config:
            raise ValueError("SSO provider not found or disabled")

        # Validate state parameter (CSRF protection)
        # In production, validate against stored state in cache/session

        user_data = None

        if config.provider_type in [SSOProvider.OAUTH2_GOOGLE, SSOProvider.OAUTH2_MICROSOFT, SSOProvider.OAUTH2_GITHUB]:
            if not code:
                raise ValueError("Authorization code required for OAuth2")

            # Exchange code for token
            token_data = self.oauth2_service.exchange_code_for_token(config, code, config.redirect_uri)
            access_token = token_data.get("access_token")

            if not access_token:
                raise ValueError("Failed to obtain access token")

            # Get user information
            user_data = self.oauth2_service.get_user_info(config, access_token)

        elif config.provider_type == SSOProvider.SAML:
            if not saml_response:
                raise ValueError("SAML response required")

            user_data = self.saml_service.process_saml_response(config, saml_response)

        if not user_data or not user_data.get("email"):
            raise ValueError("Unable to retrieve user email from SSO provider")

        # Check domain restrictions
        if config.allowed_domains:
            email_domain = user_data["email"].split("@")[1].lower()
            if email_domain not in [d.lower() for d in config.allowed_domains]:
                raise ValueError(f"Email domain {email_domain} not allowed for this SSO provider")

        # Find or create user
        user, is_new_user = self._find_or_create_user(config, user_data)

        # Create or update SSO account link
        self._link_sso_account(config, user, user_data)

        # Log SSO login
        self.security_service.log_audit_event(
            event_type="sso_login",
            user_id=user.id,
            severity="low",
            message=f"SSO login successful for {user.email} via {config.name}",
            details={
                "provider": config.provider_type.value,
                "provider_name": config.name,
                "is_new_user": is_new_user
            }
        )

        return user, is_new_user

    def _find_or_create_user(self, config: SSOConfiguration, user_data: Dict[str, Any]) -> Tuple[User, bool]:
        """Find existing user or create new one"""
        email = user_data["email"]

        # First, check for existing user with this email
        existing_user = self.db.query(User).filter(User.email == email).first()

        if existing_user:
            return existing_user, False

        # Check if auto-creation is enabled
        if not config.auto_create_users:
            raise ValueError("User not found and auto-creation is disabled")

        # Create new user
        from app.services.user_service import UserService
        user_service = UserService(self.db)

        # Generate a random password (user will need to set up proper auth later)
        import secrets
        random_password = secrets.token_urlsafe(32)

        # Determine role
        role = UserRole(config.default_role) if config.default_role else UserRole.RESIDENT

        # Create user data
        user_create_data = {
            "email": email,
            "username": user_data.get("username") or email.split("@")[0],
            "password": random_password,
            "full_name": user_data.get("name"),
            "role": role,
            "is_verified": True  # SSO emails are considered verified
        }

        try:
            user = user_service.create_user_from_dict(user_create_data)

            # Log user creation
            self.security_service.log_audit_event(
                event_type="user_created",
                user_id=user.id,
                severity="medium",
                message=f"User auto-created via SSO: {email}",
                details={
                    "sso_provider": config.provider_type.value,
                    "auto_created": True
                }
            )

            return user, True

        except Exception as e:
            raise ValueError(f"Failed to create user: {str(e)}")

    def _link_sso_account(self, config: SSOConfiguration, user: User, user_data: Dict[str, Any]):
        """Link or update SSO account for user"""
        sso_account = self.db.query(UserSSOAccount).filter(
            and_(
                UserSSOAccount.user_id == user.id,
                UserSSOAccount.sso_config_id == config.id
            )
        ).first()

        if not sso_account:
            sso_account = UserSSOAccount(
                user_id=user.id,
                sso_config_id=config.id,
                sso_user_id=user_data["id"]
            )
            self.db.add(sso_account)

            # Log account linking
            self.security_service.log_audit_event(
                event_type="sso_account_linked",
                user_id=user.id,
                severity="medium",
                message=f"SSO account linked for {user.email}",
                details={
                    "provider": config.provider_type.value,
                    "provider_name": config.name
                }
            )

        # Update account information
        sso_account.sso_username = user_data.get("username")
        sso_account.sso_email = user_data.get("email")
        sso_account.sso_display_name = user_data.get("name")
        sso_account.profile_data = user_data
        sso_account.last_login = datetime.utcnow()
        sso_account.is_active = True

        self.db.commit()

    def get_sso_configurations(self, include_secrets: bool = False) -> list[SSOConfigurationResponse]:
        """Get all enabled SSO configurations"""
        configs = self.db.query(SSOConfiguration).filter(
            SSOConfiguration.is_enabled == True
        ).all()

        responses = []
        for config in configs:
            response_data = SSOConfigurationResponse.model_validate(config)

            # Remove secrets if not requested
            if not include_secrets:
                response_data.client_secret = None

            responses.append(response_data)

        return responses

    def unlink_sso_account(self, user_id: str, provider_id: str) -> bool:
        """Unlink SSO account from user"""
        sso_account = self.db.query(UserSSOAccount).filter(
            and_(
                UserSSOAccount.user_id == user_id,
                UserSSOAccount.sso_config_id == provider_id
            )
        ).first()

        if not sso_account:
            return False

        self.db.delete(sso_account)
        self.db.commit()

        # Log account unlinking
        self.security_service.log_audit_event(
            event_type="sso_account_unlinked",
            user_id=user_id,
            severity="medium",
            message=f"SSO account unlinked",
            details={"provider_id": provider_id}
        )

        return True