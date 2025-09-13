"""
Tests for API enhancements including GraphQL, webhooks, API keys, and rate limiting
"""
import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from httpx import AsyncClient
from fastapi import status

from app.main import app
from app.models.external_integration import APIKey, Webhook, WebhookDelivery, RateLimitRule
from app.models.user import User
from app.services.webhook_service import WebhookService, WebhookEvents
from app.middleware.rate_limiting import RateLimitService
from app.schemas.external_integration import (
    APIKeyCreate, WebhookCreate, WebhookEventPayload,
    RateLimitRuleCreate, WEBHOOK_EVENTS, API_PERMISSIONS
)


class TestAPIKeys:
    """Test API Key management"""

    @pytest.mark.asyncio
    async def test_create_api_key(self, async_client: AsyncClient, test_user, test_db):
        """Test creating an API key"""
        api_key_data = {
            "name": "Test API Key",
            "permissions": ["documents:read", "templates:read"],
            "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat()
        }

        response = await async_client.post(
            "/api/v1/api-enhancements/api-keys",
            json=api_key_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Test API Key"
        assert data["permissions"] == ["documents:read", "templates:read"]
        assert "key_value" in data  # Should only be shown on creation
        assert len(data["key_prefix"]) == 8

    @pytest.mark.asyncio
    async def test_create_api_key_invalid_permissions(self, async_client: AsyncClient, test_user):
        """Test creating API key with invalid permissions"""
        api_key_data = {
            "name": "Invalid API Key",
            "permissions": ["invalid:permission"]
        }

        response = await async_client.post(
            "/api/v1/api-enhancements/api-keys",
            json=api_key_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid permissions specified" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_api_keys(self, async_client: AsyncClient, test_user, test_api_key):
        """Test listing API keys"""
        response = await async_client.get(
            "/api/v1/api-enhancements/api-keys",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == test_api_key.name
        assert "key_value" not in data[0]  # Should not be shown in list

    @pytest.mark.asyncio
    async def test_update_api_key(self, async_client: AsyncClient, test_user, test_api_key):
        """Test updating an API key"""
        update_data = {
            "name": "Updated API Key",
            "permissions": ["documents:read", "documents:write"]
        }

        response = await async_client.put(
            f"/api/v1/api-enhancements/api-keys/{test_api_key.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated API Key"
        assert data["permissions"] == ["documents:read", "documents:write"]

    @pytest.mark.asyncio
    async def test_delete_api_key(self, async_client: AsyncClient, test_user, test_api_key):
        """Test deleting an API key"""
        response = await async_client.delete(
            f"/api/v1/api-enhancements/api-keys/{test_api_key.id}",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestWebhooks:
    """Test webhook management"""

    @pytest.mark.asyncio
    async def test_create_webhook(self, async_client: AsyncClient, test_user):
        """Test creating a webhook"""
        webhook_data = {
            "name": "Test Webhook",
            "url": "https://example.com/webhook",
            "events": ["document.created", "document.updated"],
            "secret": "test-secret",
            "timeout_seconds": 30
        }

        response = await async_client.post(
            "/api/v1/api-enhancements/webhooks",
            json=webhook_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Test Webhook"
        assert data["url"] == "https://example.com/webhook"
        assert data["events"] == ["document.created", "document.updated"]
        assert data["timeout_seconds"] == 30

    @pytest.mark.asyncio
    async def test_create_webhook_invalid_events(self, async_client: AsyncClient, test_user):
        """Test creating webhook with invalid events"""
        webhook_data = {
            "name": "Invalid Webhook",
            "url": "https://example.com/webhook",
            "events": ["invalid.event"]
        }

        response = await async_client.post(
            "/api/v1/api-enhancements/webhooks",
            json=webhook_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid event types specified" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_webhooks(self, async_client: AsyncClient, test_user, test_webhook):
        """Test listing webhooks"""
        response = await async_client.get(
            "/api/v1/api-enhancements/webhooks",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == test_webhook.name

    @pytest.mark.asyncio
    async def test_update_webhook(self, async_client: AsyncClient, test_user, test_webhook):
        """Test updating a webhook"""
        update_data = {
            "name": "Updated Webhook",
            "events": ["document.created", "document.deleted"]
        }

        response = await async_client.put(
            f"/api/v1/api-enhancements/webhooks/{test_webhook.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Webhook"
        assert data["events"] == ["document.created", "document.deleted"]

    @pytest.mark.asyncio
    async def test_test_webhook(self, async_client: AsyncClient, test_user, test_webhook):
        """Test sending a test webhook"""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_response.is_success = True
            mock_post.return_value = mock_response

            response = await async_client.post(
                f"/api/v1/api-enhancements/webhooks/{test_webhook.id}/test",
                headers={"Authorization": f"Bearer {test_user['access_token']}"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "Test webhook sent" in data["message"]
            assert data["result"]["success"] is True

    @pytest.mark.asyncio
    async def test_get_webhook_deliveries(self, async_client: AsyncClient, test_user, test_webhook, test_webhook_delivery):
        """Test getting webhook delivery history"""
        response = await async_client.get(
            f"/api/v1/api-enhancements/webhooks/{test_webhook.id}/deliveries",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["webhook_id"] == str(test_webhook.id)

    @pytest.mark.asyncio
    async def test_get_webhook_stats(self, async_client: AsyncClient, test_user, test_webhook):
        """Test getting webhook statistics"""
        response = await async_client.get(
            f"/api/v1/api-enhancements/webhooks/{test_webhook.id}/stats",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["webhook_id"] == str(test_webhook.id)
        assert "total_success" in data
        assert "total_failure" in data


class TestWebhookService:
    """Test webhook service functionality"""

    @pytest.mark.asyncio
    async def test_trigger_webhooks(self, test_db, test_webhook):
        """Test triggering webhooks for an event"""
        webhook_service = WebhookService(test_db)

        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_response.is_success = True
            mock_post.return_value = mock_response

            # Trigger webhooks for document.created event
            delivery_ids = await webhook_service.trigger_webhooks(
                WebhookEvents.DOCUMENT_CREATED,
                {"document_id": "test-doc", "title": "Test Document"},
                {"user_id": "test-user"}
            )

            assert len(delivery_ids) >= 1
            mock_post.assert_called()

    @pytest.mark.asyncio
    async def test_webhook_signature(self, test_db, test_webhook_with_secret):
        """Test webhook signature generation"""
        webhook_service = WebhookService(test_db)

        payload = WebhookEventPayload(
            event_type="test.event",
            timestamp=datetime.utcnow(),
            data={"test": "data"}
        )

        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "OK"
            mock_response.is_success = True
            mock_post.return_value = mock_response

            await webhook_service._deliver_webhook(test_webhook_with_secret, payload)

            # Check that signature header was added
            call_args = mock_post.call_args
            headers = call_args.kwargs['headers']
            assert 'X-Webhook-Signature' in headers
            assert headers['X-Webhook-Signature'].startswith('sha256=')

    @pytest.mark.asyncio
    async def test_webhook_failure_handling(self, test_db, test_webhook):
        """Test webhook failure handling"""
        webhook_service = WebhookService(test_db)

        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.side_effect = Exception("Connection failed")

            delivery_ids = await webhook_service.trigger_webhooks(
                WebhookEvents.DOCUMENT_CREATED,
                {"document_id": "test-doc"}
            )

            assert len(delivery_ids) >= 1

            # Check that failure was recorded
            test_db.refresh(test_webhook)
            assert test_webhook.failure_count > 0


class TestRateLimiting:
    """Test rate limiting functionality"""

    @pytest.mark.asyncio
    async def test_create_rate_limit_rule(self, async_client: AsyncClient, test_user):
        """Test creating a rate limit rule"""
        rule_data = {
            "name": "API Rate Limit",
            "endpoint_pattern": "/api/v1/.*",
            "method": "GET",
            "requests_per_minute": 100,
            "requests_per_hour": 1000,
            "requests_per_day": 10000
        }

        response = await async_client.post(
            "/api/v1/api-enhancements/rate-limits",
            json=rule_data,
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "API Rate Limit"
        assert data["endpoint_pattern"] == "/api/v1/.*"
        assert data["requests_per_minute"] == 100

    @pytest.mark.asyncio
    async def test_list_rate_limit_rules(self, async_client: AsyncClient, test_user, test_rate_limit_rule):
        """Test listing rate limit rules"""
        response = await async_client.get(
            "/api/v1/api-enhancements/rate-limits",
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == test_rate_limit_rule.name

    @pytest.mark.asyncio
    async def test_rate_limit_enforcement(self, test_db, test_rate_limit_rule):
        """Test rate limit enforcement logic"""
        rate_limit_service = RateLimitService()

        # Mock request
        mock_request = Mock()
        mock_request.url.path = "/api/v1/documents"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.state = Mock()

        # Simulate multiple requests
        for i in range(5):
            allowed = await rate_limit_service.check_rate_limit(mock_request)
            assert allowed is True  # Should be allowed under normal limits

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, test_db):
        """Test rate limit exceeded scenario"""
        # Create a very restrictive rate limit rule
        rule = RateLimitRule(
            name="Strict Limit",
            endpoint_pattern="/api/v1/test",
            requests_per_minute=1,
            requests_per_hour=1,
            requests_per_day=1,
            is_active=True,
            created_by="test-user"
        )
        test_db.add(rule)
        test_db.commit()

        rate_limit_service = RateLimitService()

        mock_request = Mock()
        mock_request.url.path = "/api/v1/test"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.state = Mock()

        # First request should be allowed
        allowed = await rate_limit_service.check_rate_limit(mock_request)
        assert allowed is True

        # Second request should be rate limited
        allowed = await rate_limit_service.check_rate_limit(mock_request)
        assert allowed is False


class TestGraphQL:
    """Test GraphQL API functionality"""

    @pytest.mark.asyncio
    async def test_graphql_documents_query(self, async_client: AsyncClient, test_user, test_document):
        """Test GraphQL documents query"""
        query = """
        query {
            documents(filter: {}, pagination: {limit: 10}) {
                id
                title
                status
                created_at
            }
        }
        """

        response = await async_client.post(
            "/api/v1/graphql",
            json={"query": query},
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert "documents" in data["data"]
        assert len(data["data"]["documents"]) >= 1

    @pytest.mark.asyncio
    async def test_graphql_search_query(self, async_client: AsyncClient, test_user, test_document):
        """Test GraphQL universal search"""
        query = """
        query {
            search(query: "test", types: ["documents"]) {
                total_count
                documents {
                    id
                    title
                }
            }
        }
        """

        response = await async_client.post(
            "/api/v1/graphql",
            json={"query": query},
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert "search" in data["data"]
        assert data["data"]["search"]["total_count"] >= 0

    @pytest.mark.asyncio
    async def test_graphql_create_document_mutation(self, async_client: AsyncClient, test_user):
        """Test GraphQL document creation mutation"""
        mutation = """
        mutation {
            createDocument(input: {
                title: "GraphQL Test Document"
                content: {"ops": [{"insert": "Test content"}]}
                tags: ["graphql", "test"]
            }) {
                id
                title
                status
                tags
            }
        }
        """

        response = await async_client.post(
            "/api/v1/graphql",
            json={"query": mutation},
            headers={"Authorization": f"Bearer {test_user['access_token']}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert "createDocument" in data["data"]
        document = data["data"]["createDocument"]
        assert document["title"] == "GraphQL Test Document"
        assert document["status"] == "draft"
        assert document["tags"] == ["graphql", "test"]


class TestAPIKeyAuthentication:
    """Test API key authentication"""

    @pytest.mark.asyncio
    async def test_api_key_authentication(self, async_client: AsyncClient, test_api_key):
        """Test authentication using API key"""
        response = await async_client.get(
            "/api/v1/documents",
            headers={"X-API-Key": test_api_key.key_value}
        )

        # Should work if API key has documents:read permission
        if "documents:read" in test_api_key.permissions:
            assert response.status_code == status.HTTP_200_OK
        else:
            assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_invalid_api_key(self, async_client: AsyncClient):
        """Test authentication with invalid API key"""
        response = await async_client.get(
            "/api/v1/documents",
            headers={"X-API-Key": "invalid-key"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_expired_api_key(self, async_client: AsyncClient, test_expired_api_key):
        """Test authentication with expired API key"""
        response = await async_client.get(
            "/api/v1/documents",
            headers={"X-API-Key": test_expired_api_key.key_value}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestUtilityEndpoints:
    """Test utility endpoints"""

    @pytest.mark.asyncio
    async def test_get_webhook_events(self, async_client: AsyncClient):
        """Test getting available webhook events"""
        response = await async_client.get("/api/v1/api-enhancements/webhook-events")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "events" in data
        assert "document.created" in data["events"]
        assert len(data["events"]) == len(WEBHOOK_EVENTS)

    @pytest.mark.asyncio
    async def test_get_api_permissions(self, async_client: AsyncClient):
        """Test getting available API permissions"""
        response = await async_client.get("/api/v1/api-enhancements/api-permissions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "permissions" in data
        assert "documents:read" in data["permissions"]
        assert len(data["permissions"]) == len(API_PERMISSIONS)


# Fixtures for tests
@pytest.fixture
async def test_api_key(test_db, test_user):
    """Create a test API key"""
    api_key = APIKey(
        name="Test API Key",
        key_value="test-api-key-12345678901234567890",
        key_prefix="test-api",
        permissions=["documents:read", "templates:read"],
        is_active=True,
        created_by=test_user["user"].id,
        usage_count=0
    )
    test_db.add(api_key)
    test_db.commit()
    test_db.refresh(api_key)
    return api_key


@pytest.fixture
async def test_expired_api_key(test_db, test_user):
    """Create an expired API key"""
    api_key = APIKey(
        name="Expired API Key",
        key_value="expired-api-key-12345678901234567890",
        key_prefix="expired",
        permissions=["documents:read"],
        is_active=True,
        created_by=test_user["user"].id,
        expires_at=datetime.utcnow() - timedelta(days=1),
        usage_count=0
    )
    test_db.add(api_key)
    test_db.commit()
    test_db.refresh(api_key)
    return api_key


@pytest.fixture
async def test_webhook(test_db, test_user):
    """Create a test webhook"""
    webhook = Webhook(
        name="Test Webhook",
        url="https://example.com/webhook",
        events=["document.created", "document.updated"],
        is_active=True,
        created_by=test_user["user"].id,
        success_count=0,
        failure_count=0,
        timeout_seconds=30
    )
    test_db.add(webhook)
    test_db.commit()
    test_db.refresh(webhook)
    return webhook


@pytest.fixture
async def test_webhook_with_secret(test_db, test_user):
    """Create a test webhook with secret"""
    webhook = Webhook(
        name="Test Webhook with Secret",
        url="https://example.com/webhook",
        events=["document.created"],
        secret="test-secret-key",
        is_active=True,
        created_by=test_user["user"].id,
        success_count=0,
        failure_count=0,
        timeout_seconds=30
    )
    test_db.add(webhook)
    test_db.commit()
    test_db.refresh(webhook)
    return webhook


@pytest.fixture
async def test_webhook_delivery(test_db, test_webhook):
    """Create a test webhook delivery"""
    delivery = WebhookDelivery(
        webhook_id=test_webhook.id,
        event_type="document.created",
        payload={"document_id": "test-doc", "title": "Test Document"},
        response_status=200,
        response_body="OK",
        delivered_at=datetime.utcnow(),
        duration_ms=150
    )
    test_db.add(delivery)
    test_db.commit()
    test_db.refresh(delivery)
    return delivery


@pytest.fixture
async def test_rate_limit_rule(test_db, test_user):
    """Create a test rate limit rule"""
    rule = RateLimitRule(
        name="Test Rate Limit",
        endpoint_pattern="/api/v1/.*",
        method="GET",
        requests_per_minute=100,
        requests_per_hour=1000,
        requests_per_day=10000,
        is_active=True,
        created_by=test_user["user"].id
    )
    test_db.add(rule)
    test_db.commit()
    test_db.refresh(rule)
    return rule