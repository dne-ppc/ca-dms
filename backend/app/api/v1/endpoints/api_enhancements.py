"""
API enhancement endpoints for webhooks, API keys, and rate limiting
"""
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.external_integration import APIKey, Webhook, WebhookDelivery, RateLimitRule
from app.schemas.external_integration import (
    APIKeyCreate, APIKeyResponse, APIKeyUpdate,
    WebhookCreate, WebhookResponse, WebhookUpdate, WebhookDeliveryResponse,
    RateLimitRuleCreate, RateLimitRuleResponse, RateLimitRuleUpdate,
    WEBHOOK_EVENTS, API_PERMISSIONS
)
from app.services.webhook_service import WebhookService

router = APIRouter()


# API Key endpoints
@router.post("/api-keys", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    api_key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key"""
    # Validate permissions
    if not all(perm in API_PERMISSIONS for perm in api_key_data.permissions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid permissions specified"
        )

    # Generate API key
    key_value = secrets.token_urlsafe(32)
    key_prefix = key_value[:8]

    # Create API key record
    api_key = APIKey(
        name=api_key_data.name,
        key_value=key_value,
        key_prefix=key_prefix,
        permissions=api_key_data.permissions,
        is_active=True,
        created_by=current_user.id,
        expires_at=api_key_data.expires_at
    )

    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    # Return response with full key value only once
    response = APIKeyResponse.from_orm(api_key)
    response.key_value = key_value  # Only shown on creation
    return response


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False
):
    """List all API keys for the current user"""
    query = db.query(APIKey).filter(APIKey.created_by == current_user.id)

    if not include_inactive:
        query = query.filter(APIKey.is_active == True)

    api_keys = query.order_by(APIKey.created_at.desc()).all()
    return [APIKeyResponse.from_orm(key) for key in api_keys]


@router.get("/api-keys/{api_key_id}", response_model=APIKeyResponse)
async def get_api_key(
    api_key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get an API key by ID"""
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.created_by == current_user.id
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    return APIKeyResponse.from_orm(api_key)


@router.put("/api-keys/{api_key_id}", response_model=APIKeyResponse)
async def update_api_key(
    api_key_id: str,
    update_data: APIKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an API key"""
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.created_by == current_user.id
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    # Validate permissions if provided
    if update_data.permissions:
        if not all(perm in API_PERMISSIONS for perm in update_data.permissions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid permissions specified"
            )

    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(api_key, field, value)

    db.commit()
    db.refresh(api_key)

    return APIKeyResponse.from_orm(api_key)


@router.delete("/api-keys/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    api_key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key"""
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.created_by == current_user.id
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    db.delete(api_key)
    db.commit()


# Webhook endpoints
@router.post("/webhooks", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new webhook"""
    # Validate events
    if not all(event in WEBHOOK_EVENTS for event in webhook_data.events):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event types specified"
        )

    # Create webhook record
    webhook = Webhook(
        name=webhook_data.name,
        url=str(webhook_data.url),
        events=webhook_data.events,
        secret=webhook_data.secret,
        timeout_seconds=webhook_data.timeout_seconds,
        is_active=True,
        created_by=current_user.id,
        success_count=0,
        failure_count=0
    )

    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return WebhookResponse.from_orm(webhook)


@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False
):
    """List all webhooks for the current user"""
    query = db.query(Webhook).filter(Webhook.created_by == current_user.id)

    if not include_inactive:
        query = query.filter(Webhook.is_active == True)

    webhooks = query.order_by(Webhook.created_at.desc()).all()
    return [WebhookResponse.from_orm(webhook) for webhook in webhooks]


@router.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a webhook by ID"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    return WebhookResponse.from_orm(webhook)


@router.put("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    update_data: WebhookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a webhook"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Validate events if provided
    if update_data.events:
        if not all(event in WEBHOOK_EVENTS for event in update_data.events):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid event types specified"
            )

    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "url" and value:
            value = str(value)
        setattr(webhook, field, value)

    db.commit()
    db.refresh(webhook)

    return WebhookResponse.from_orm(webhook)


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a webhook"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    db.delete(webhook)
    db.commit()


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a test webhook delivery"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Test webhook in background
    webhook_service = WebhookService(db)
    result = await webhook_service.test_webhook(webhook_id)

    return {
        "message": "Test webhook sent",
        "result": result
    }


@router.get("/webhooks/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse])
async def get_webhook_deliveries(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get webhook delivery history"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    webhook_service = WebhookService(db)
    deliveries = webhook_service.get_webhook_deliveries(webhook_id, limit, offset)

    return [WebhookDeliveryResponse.from_orm(delivery) for delivery in deliveries]


@router.get("/webhooks/{webhook_id}/stats")
async def get_webhook_stats(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get webhook delivery statistics"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.created_by == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    webhook_service = WebhookService(db)
    stats = webhook_service.get_webhook_stats(webhook_id)

    return stats


# Rate limiting endpoints
@router.post("/rate-limits", response_model=RateLimitRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rate_limit_rule(
    rule_data: RateLimitRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new rate limit rule"""
    # Create rate limit rule
    rule = RateLimitRule(
        name=rule_data.name,
        endpoint_pattern=rule_data.endpoint_pattern,
        method=rule_data.method,
        requests_per_minute=rule_data.requests_per_minute,
        requests_per_hour=rule_data.requests_per_hour,
        requests_per_day=rule_data.requests_per_day,
        is_active=True,
        created_by=current_user.id
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return RateLimitRuleResponse.from_orm(rule)


@router.get("/rate-limits", response_model=List[RateLimitRuleResponse])
async def list_rate_limit_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False
):
    """List all rate limit rules"""
    query = db.query(RateLimitRule)

    if not include_inactive:
        query = query.filter(RateLimitRule.is_active == True)

    rules = query.order_by(RateLimitRule.created_at.desc()).all()
    return [RateLimitRuleResponse.from_orm(rule) for rule in rules]


@router.get("/rate-limits/{rule_id}", response_model=RateLimitRuleResponse)
async def get_rate_limit_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a rate limit rule by ID"""
    rule = db.query(RateLimitRule).filter(RateLimitRule.id == rule_id).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate limit rule not found"
        )

    return RateLimitRuleResponse.from_orm(rule)


@router.put("/rate-limits/{rule_id}", response_model=RateLimitRuleResponse)
async def update_rate_limit_rule(
    rule_id: str,
    update_data: RateLimitRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a rate limit rule"""
    rule = db.query(RateLimitRule).filter(RateLimitRule.id == rule_id).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate limit rule not found"
        )

    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)

    return RateLimitRuleResponse.from_orm(rule)


@router.delete("/rate-limits/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rate_limit_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a rate limit rule"""
    rule = db.query(RateLimitRule).filter(RateLimitRule.id == rule_id).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate limit rule not found"
        )

    db.delete(rule)
    db.commit()


# Utility endpoints
@router.get("/webhook-events")
async def get_available_webhook_events():
    """Get list of available webhook events"""
    return {"events": WEBHOOK_EVENTS}


@router.get("/api-permissions")
async def get_available_api_permissions():
    """Get list of available API permissions"""
    return {"permissions": API_PERMISSIONS}