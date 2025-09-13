"""
Rate limiting middleware for API endpoints
"""
import re
import time
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.external_integration import RateLimitRule, RateLimitUsage, APIKey
from app.services.cache_service import cache_service


class RateLimitService:
    """Service for managing rate limiting"""

    def __init__(self):
        self._rules_cache = {}
        self._cache_timestamp = 0
        self._cache_ttl = 300  # 5 minutes

    def _get_rate_limit_rules(self, db: Session) -> List[RateLimitRule]:
        """Get active rate limit rules with caching"""
        current_time = time.time()

        # Check cache validity
        if (current_time - self._cache_timestamp) > self._cache_ttl:
            rules = db.query(RateLimitRule).filter(
                RateLimitRule.is_active == True
            ).all()
            self._rules_cache = {rule.id: rule for rule in rules}
            self._cache_timestamp = current_time

        return list(self._rules_cache.values())

    def _find_matching_rule(
        self,
        endpoint: str,
        method: str,
        rules: List[RateLimitRule]
    ) -> Optional[RateLimitRule]:
        """Find the most specific matching rate limit rule"""
        matching_rules = []

        for rule in rules:
            # Check if endpoint matches pattern
            if re.match(rule.endpoint_pattern, endpoint):
                # Check if method matches (None means all methods)
                if rule.method is None or rule.method.upper() == method.upper():
                    matching_rules.append(rule)

        # Return the most specific rule (longest pattern)
        if matching_rules:
            return max(matching_rules, key=lambda r: len(r.endpoint_pattern))

        return None

    def _get_identifier(self, request: Request) -> Tuple[str, str]:
        """Get rate limiting identifier (API key, user ID, or IP)"""
        # Check for API key in headers
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return api_key, "api_key"

        # Check for authenticated user
        user = getattr(request.state, "user", None)
        if user:
            return str(user.id), "user"

        # Fall back to IP address
        ip_address = get_remote_address(request)
        return ip_address, "ip"

    async def _get_usage_count(
        self,
        identifier: str,
        endpoint: str,
        method: str,
        window_type: str,
        window_start: datetime
    ) -> int:
        """Get current usage count for the time window"""
        # Try cache first
        cache_key = f"rate_limit:{identifier}:{endpoint}:{method}:{window_type}:{window_start.isoformat()}"
        cached_count = await cache_service.get('analytics', cache_key)
        if cached_count:
            return int(cached_count)

        # Fall back to database
        db = next(get_db())
        usage = db.query(RateLimitUsage).filter(
            RateLimitUsage.identifier == identifier,
            RateLimitUsage.endpoint == endpoint,
            RateLimitUsage.method == method,
            RateLimitUsage.window_type == window_type,
            RateLimitUsage.window_start == window_start
        ).first()

        return usage.requests_count if usage else 0

    async def _increment_usage(
        self,
        identifier: str,
        identifier_type: str,
        endpoint: str,
        method: str,
        window_type: str,
        window_start: datetime,
        window_end: datetime
    ) -> int:
        """Increment usage count and return new count"""
        cache_key = f"rate_limit:{identifier}:{endpoint}:{method}:{window_type}:{window_start.isoformat()}"

        # Try to increment in cache
        new_count = await cache_service.increment('analytics', cache_key, 1)
        if new_count:
            # Set expiration for the cache key
            ttl = int((window_end - window_start).total_seconds()) + 60
            await cache_service.set('analytics', cache_key, str(new_count), ttl)

            # Update database in background for persistence
            self._update_database_usage(
                identifier, identifier_type, endpoint, method,
                window_type, window_start, window_end, new_count
            )
            return new_count

        # Fall back to database
        return self._update_database_usage(
            identifier, identifier_type, endpoint, method,
            window_type, window_start, window_end
        )

    def _update_database_usage(
        self,
        identifier: str,
        identifier_type: str,
        endpoint: str,
        method: str,
        window_type: str,
        window_start: datetime,
        window_end: datetime,
        count: Optional[int] = None
    ) -> int:
        """Update database usage record"""
        db = next(get_db())

        usage = db.query(RateLimitUsage).filter(
            RateLimitUsage.identifier == identifier,
            RateLimitUsage.endpoint == endpoint,
            RateLimitUsage.method == method,
            RateLimitUsage.window_type == window_type,
            RateLimitUsage.window_start == window_start
        ).first()

        if usage:
            if count is not None:
                usage.requests_count = count
            else:
                usage.requests_count += 1
        else:
            usage = RateLimitUsage(
                identifier=identifier,
                identifier_type=identifier_type,
                endpoint=endpoint,
                method=method,
                requests_count=count or 1,
                window_start=window_start,
                window_end=window_end,
                window_type=window_type
            )
            db.add(usage)

        db.commit()
        return usage.requests_count

    def _get_time_windows(self, now: datetime) -> Dict[str, Tuple[datetime, datetime]]:
        """Get time windows for rate limiting"""
        return {
            "minute": (
                now.replace(second=0, microsecond=0),
                now.replace(second=59, microsecond=999999)
            ),
            "hour": (
                now.replace(minute=0, second=0, microsecond=0),
                now.replace(minute=59, second=59, microsecond=999999)
            ),
            "day": (
                now.replace(hour=0, minute=0, second=0, microsecond=0),
                now.replace(hour=23, minute=59, second=59, microsecond=999999)
            )
        }

    async def check_rate_limit(self, request: Request) -> bool:
        """
        Check if request should be rate limited

        Returns True if request should be allowed, False if rate limited
        """
        # Get database session
        db = next(get_db())

        # Get rate limit rules
        rules = self._get_rate_limit_rules(db)
        if not rules:
            return True  # No rules configured, allow request

        # Get endpoint and method
        endpoint = str(request.url.path)
        method = request.method

        # Find matching rule
        rule = self._find_matching_rule(endpoint, method, rules)
        if not rule:
            return True  # No matching rule, allow request

        # Get identifier
        identifier, identifier_type = self._get_identifier(request)

        # Get current time windows
        now = datetime.utcnow()
        windows = self._get_time_windows(now)

        # Check each time window
        limits = {
            "minute": rule.requests_per_minute,
            "hour": rule.requests_per_hour,
            "day": rule.requests_per_day
        }

        for window_type, limit in limits.items():
            window_start, window_end = windows[window_type]

            # Get current usage
            current_usage = await self._get_usage_count(
                identifier, endpoint, method, window_type, window_start
            )

            # Check if limit exceeded
            if current_usage >= limit:
                # Add rate limit headers for debugging
                request.state.rate_limit_exceeded = True
                request.state.rate_limit_rule = rule.name
                request.state.rate_limit_window = window_type
                request.state.rate_limit_limit = limit
                request.state.rate_limit_usage = current_usage
                request.state.rate_limit_reset = window_end
                return False

        # Increment usage counters
        for window_type in windows:
            window_start, window_end = windows[window_type]
            await self._increment_usage(
                identifier, identifier_type, endpoint, method,
                window_type, window_start, window_end
            )

        return True


# Global rate limit service instance
rate_limit_service = RateLimitService()


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware"""
    # Check rate limit
    allowed = await rate_limit_service.check_rate_limit(request)

    if not allowed:
        # Get rate limit info from request state
        rule_name = getattr(request.state, "rate_limit_rule", "Unknown")
        window = getattr(request.state, "rate_limit_window", "unknown")
        limit = getattr(request.state, "rate_limit_limit", 0)
        usage = getattr(request.state, "rate_limit_usage", 0)
        reset = getattr(request.state, "rate_limit_reset", datetime.utcnow())

        # Create rate limit exceeded response
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "rule": rule_name,
                "window": window,
                "limit": limit,
                "usage": usage,
                "reset_at": reset.isoformat()
            },
            headers={
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": str(max(0, limit - usage)),
                "X-RateLimit-Reset": str(int(reset.timestamp())),
                "Retry-After": str(int((reset - datetime.utcnow()).total_seconds()))
            }
        )

    # Process request
    response = await call_next(request)

    return response


# Initialize rate limiting service
async def init_rate_limiting():
    """Initialize rate limiting service"""
    await rate_limit_service.connect_redis()