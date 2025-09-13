"""
Webhook service for triggering external integrations
"""
import asyncio
import json
import hmac
import hashlib
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx
from sqlalchemy.orm import Session

from app.models.external_integration import Webhook, WebhookDelivery
from app.schemas.external_integration import WebhookEventPayload


class WebhookService:
    """Service for managing and triggering webhooks"""

    def __init__(self, db: Session):
        self.db = db

    async def trigger_webhooks(
        self,
        event_type: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Trigger all active webhooks for a specific event type

        Args:
            event_type: The type of event (e.g., "document.created")
            data: Event data payload
            metadata: Optional metadata

        Returns:
            List of webhook delivery IDs
        """
        # Get all active webhooks that listen for this event
        webhooks = self.db.query(Webhook).filter(
            Webhook.is_active == True,
            Webhook.events.contains([event_type])
        ).all()

        if not webhooks:
            return []

        # Create event payload
        payload = WebhookEventPayload(
            event_type=event_type,
            timestamp=datetime.utcnow(),
            data=data,
            metadata=metadata or {}
        )

        # Trigger webhooks asynchronously
        delivery_ids = []
        tasks = []

        for webhook in webhooks:
            task = self._deliver_webhook(webhook, payload)
            tasks.append(task)

        # Execute all webhook deliveries concurrently
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            delivery_ids = [
                result for result in results
                if isinstance(result, str) and not isinstance(result, Exception)
            ]

        return delivery_ids

    async def _deliver_webhook(
        self,
        webhook: Webhook,
        payload: WebhookEventPayload
    ) -> str:
        """
        Deliver a single webhook

        Args:
            webhook: Webhook configuration
            payload: Event payload

        Returns:
            Delivery ID
        """
        start_time = time.time()
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=payload.event_type,
            payload=payload.dict(),
            delivered_at=datetime.utcnow()
        )

        try:
            # Prepare request data
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "CA-DMS-Webhook/1.0"
            }

            # Add signature if secret is configured
            payload_json = json.dumps(payload.dict(), default=str)
            if webhook.secret:
                signature = self._generate_signature(payload_json, webhook.secret)
                headers["X-Webhook-Signature"] = signature

            # Make HTTP request
            async with httpx.AsyncClient(timeout=webhook.timeout_seconds) as client:
                response = await client.post(
                    str(webhook.url),
                    content=payload_json,
                    headers=headers
                )

                # Record response
                delivery.response_status = response.status_code
                delivery.response_body = response.text[:10000]  # Limit response body size
                delivery.duration_ms = int((time.time() - start_time) * 1000)

                # Update webhook statistics
                if response.is_success:
                    webhook.success_count += 1
                else:
                    webhook.failure_count += 1
                    delivery.error_message = f"HTTP {response.status_code}: {response.text[:1000]}"

        except Exception as e:
            # Record error
            delivery.error_message = str(e)[:1000]
            delivery.duration_ms = int((time.time() - start_time) * 1000)
            webhook.failure_count += 1

        # Update webhook last triggered time
        webhook.last_triggered_at = datetime.utcnow()

        # Save delivery log
        self.db.add(delivery)
        self.db.commit()
        self.db.refresh(delivery)

        return str(delivery.id)

    def _generate_signature(self, payload: str, secret: str) -> str:
        """
        Generate HMAC signature for webhook payload

        Args:
            payload: JSON payload string
            secret: Webhook secret

        Returns:
            HMAC signature
        """
        signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"

    def get_webhook_deliveries(
        self,
        webhook_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[WebhookDelivery]:
        """
        Get webhook delivery history

        Args:
            webhook_id: Webhook ID
            limit: Maximum number of deliveries to return
            offset: Number of deliveries to skip

        Returns:
            List of webhook deliveries
        """
        return self.db.query(WebhookDelivery).filter(
            WebhookDelivery.webhook_id == webhook_id
        ).order_by(
            WebhookDelivery.delivered_at.desc()
        ).offset(offset).limit(limit).all()

    def get_webhook_stats(self, webhook_id: str) -> Dict[str, Any]:
        """
        Get webhook delivery statistics

        Args:
            webhook_id: Webhook ID

        Returns:
            Webhook statistics
        """
        webhook = self.db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            return {}

        # Get recent delivery stats (last 7 days)
        from datetime import timedelta
        seven_days_ago = datetime.utcnow() - timedelta(days=7)

        recent_deliveries = self.db.query(WebhookDelivery).filter(
            WebhookDelivery.webhook_id == webhook_id,
            WebhookDelivery.delivered_at >= seven_days_ago
        ).all()

        recent_success = len([d for d in recent_deliveries if d.response_status and 200 <= d.response_status < 300])
        recent_failure = len([d for d in recent_deliveries if d.error_message or (d.response_status and d.response_status >= 400)])

        # Calculate average response time
        successful_deliveries = [d for d in recent_deliveries if d.duration_ms and not d.error_message]
        avg_response_time = (
            sum(d.duration_ms for d in successful_deliveries) / len(successful_deliveries)
            if successful_deliveries else 0
        )

        return {
            "webhook_id": webhook_id,
            "total_success": webhook.success_count,
            "total_failure": webhook.failure_count,
            "recent_success": recent_success,
            "recent_failure": recent_failure,
            "average_response_time_ms": round(avg_response_time, 2),
            "last_triggered_at": webhook.last_triggered_at,
            "is_active": webhook.is_active
        }

    async def test_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """
        Send a test webhook delivery

        Args:
            webhook_id: Webhook ID

        Returns:
            Test result
        """
        webhook = self.db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            raise ValueError("Webhook not found")

        # Create test payload
        test_payload = WebhookEventPayload(
            event_type="webhook.test",
            timestamp=datetime.utcnow(),
            data={"message": "This is a test webhook delivery"},
            metadata={"test": True, "webhook_id": webhook_id}
        )

        # Deliver test webhook
        delivery_id = await self._deliver_webhook(webhook, test_payload)

        # Get delivery result
        delivery = self.db.query(WebhookDelivery).filter(
            WebhookDelivery.id == delivery_id
        ).first()

        return {
            "delivery_id": delivery_id,
            "success": delivery.response_status and 200 <= delivery.response_status < 300,
            "status_code": delivery.response_status,
            "duration_ms": delivery.duration_ms,
            "error_message": delivery.error_message
        }


# Event type constants
class WebhookEvents:
    """Constants for webhook event types"""

    # Document events
    DOCUMENT_CREATED = "document.created"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"
    DOCUMENT_APPROVED = "document.approved"
    DOCUMENT_REJECTED = "document.rejected"

    # Workflow events
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_STEP_COMPLETED = "workflow.step_completed"

    # Template events
    TEMPLATE_CREATED = "template.created"
    TEMPLATE_UPDATED = "template.updated"

    # User events
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"

    # System events
    WEBHOOK_TEST = "webhook.test"


# Utility function for triggering webhooks from other services
async def trigger_webhook_event(
    db: Session,
    event_type: str,
    data: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None
) -> List[str]:
    """
    Utility function to trigger webhook events from other services

    Args:
        db: Database session
        event_type: Event type
        data: Event data
        metadata: Optional metadata

    Returns:
        List of delivery IDs
    """
    webhook_service = WebhookService(db)
    return await webhook_service.trigger_webhooks(event_type, data, metadata)