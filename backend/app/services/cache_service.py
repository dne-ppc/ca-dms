"""
Redis Caching Service for CA-DMS

Provides Redis caching functionality for frequently accessed documents,
user sessions, and other data to improve performance.
"""

import json
import pickle
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
import asyncio
import logging

import redis.asyncio as redis
from redis.asyncio import ConnectionPool
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheStats(BaseModel):
    """Cache statistics model"""
    total_keys: int
    hits: int
    misses: int
    hit_rate: float
    memory_usage: str
    uptime: str


class CacheEntry(BaseModel):
    """Cache entry model with metadata"""
    data: Any
    created_at: datetime
    expires_at: Optional[datetime] = None
    access_count: int = 0
    last_accessed: Optional[datetime] = None


class RedisCacheService:
    """Redis caching service with advanced features"""

    def __init__(self):
        self._redis_client: Optional[redis.Redis] = None
        self._connection_pool: Optional[ConnectionPool] = None
        self._is_connected = False

        # Cache prefixes for different data types
        self.PREFIXES = {
            'document': 'doc:',
            'user': 'user:',
            'template': 'tpl:',
            'workflow': 'wf:',
            'search': 'search:',
            'session': 'session:',
            'analytics': 'analytics:',
            'metadata': 'meta:'
        }

        # Default TTL values (in seconds)
        self.TTL_VALUES = {
            'document': 3600,      # 1 hour
            'user': 1800,         # 30 minutes
            'template': 7200,     # 2 hours
            'workflow': 1800,     # 30 minutes
            'search': 600,        # 10 minutes
            'session': 86400,     # 24 hours
            'analytics': 3600,    # 1 hour
            'metadata': 1800      # 30 minutes
        }

    async def connect(self) -> bool:
        """Initialize Redis connection"""
        try:
            # Use Redis URL if provided, otherwise build from components
            if settings.REDIS_URL:
                self._connection_pool = ConnectionPool.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
            else:
                self._connection_pool = ConnectionPool(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    password=settings.REDIS_PASSWORD,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20
                )

            self._redis_client = redis.Redis(connection_pool=self._connection_pool)

            # Test connection
            await self._redis_client.ping()
            self._is_connected = True

            logger.info("Redis cache service connected successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._is_connected = False
            return False

    async def disconnect(self):
        """Close Redis connection"""
        if self._redis_client:
            await self._redis_client.close()
        if self._connection_pool:
            await self._connection_pool.disconnect()
        self._is_connected = False
        logger.info("Redis cache service disconnected")

    def _build_key(self, cache_type: str, identifier: str) -> str:
        """Build cache key with appropriate prefix"""
        prefix = self.PREFIXES.get(cache_type, 'general:')
        return f"ca_dms:{prefix}{identifier}"

    async def set(
        self,
        cache_type: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set cache value with optional TTL"""
        if not self._is_connected or not self._redis_client:
            return False

        try:
            cache_key = self._build_key(cache_type, key)
            ttl = ttl or self.TTL_VALUES.get(cache_type, settings.CACHE_EXPIRE_SECONDS)

            # Create cache entry with metadata
            cache_entry = CacheEntry(
                data=value,
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(seconds=ttl) if ttl else None,
                access_count=0
            )

            # Serialize data
            if isinstance(value, (dict, list)):
                serialized_data = json.dumps(cache_entry.dict())
            else:
                serialized_data = pickle.dumps(cache_entry.dict())

            await self._redis_client.setex(cache_key, ttl, serialized_data)

            logger.debug(f"Cache set: {cache_key} with TTL {ttl}s")
            return True

        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False

    async def get(self, cache_type: str, key: str) -> Optional[Any]:
        """Get cache value and update access metadata"""
        if not self._is_connected or not self._redis_client:
            return None

        try:
            cache_key = self._build_key(cache_type, key)
            cached_data = await self._redis_client.get(cache_key)

            if not cached_data:
                logger.debug(f"Cache miss: {cache_key}")
                return None

            # Deserialize data
            try:
                cache_entry_dict = json.loads(cached_data)
            except json.JSONDecodeError:
                cache_entry_dict = pickle.loads(cached_data.encode())

            cache_entry = CacheEntry(**cache_entry_dict)

            # Update access metadata
            cache_entry.access_count += 1
            cache_entry.last_accessed = datetime.utcnow()

            # Update cache with new metadata (fire and forget)
            asyncio.create_task(self._update_access_metadata(cache_key, cache_entry))

            logger.debug(f"Cache hit: {cache_key}")
            return cache_entry.data

        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None

    async def _update_access_metadata(self, cache_key: str, cache_entry: CacheEntry):
        """Update cache entry access metadata"""
        try:
            ttl = await self._redis_client.ttl(cache_key)
            if ttl > 0:
                serialized_data = json.dumps(cache_entry.dict()) if isinstance(cache_entry.data, (dict, list)) else pickle.dumps(cache_entry.dict())
                await self._redis_client.setex(cache_key, ttl, serialized_data)
        except Exception as e:
            logger.debug(f"Failed to update access metadata: {e}")

    async def delete(self, cache_type: str, key: str) -> bool:
        """Delete cache entry"""
        if not self._is_connected or not self._redis_client:
            return False

        try:
            cache_key = self._build_key(cache_type, key)
            deleted = await self._redis_client.delete(cache_key)

            logger.debug(f"Cache delete: {cache_key} ({'success' if deleted else 'not found'})")
            return bool(deleted)

        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False

    async def delete_pattern(self, cache_type: str, pattern: str) -> int:
        """Delete multiple cache entries by pattern"""
        if not self._is_connected or not self._redis_client:
            return 0

        try:
            cache_pattern = self._build_key(cache_type, pattern)
            keys = await self._redis_client.keys(cache_pattern)

            if keys:
                deleted = await self._redis_client.delete(*keys)
                logger.debug(f"Cache bulk delete: {deleted} keys matching {cache_pattern}")
                return deleted

            return 0

        except Exception as e:
            logger.error(f"Cache bulk delete error for pattern {pattern}: {e}")
            return 0

    async def exists(self, cache_type: str, key: str) -> bool:
        """Check if cache key exists"""
        if not self._is_connected or not self._redis_client:
            return False

        try:
            cache_key = self._build_key(cache_type, key)
            exists = await self._redis_client.exists(cache_key)
            return bool(exists)

        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
            return False

    async def set_many(self, cache_type: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Set multiple cache values at once"""
        if not self._is_connected or not self._redis_client:
            return False

        try:
            ttl = ttl or self.TTL_VALUES.get(cache_type, settings.CACHE_EXPIRE_SECONDS)

            # Prepare pipeline for batch operations
            pipe = self._redis_client.pipeline()

            for key, value in data.items():
                cache_key = self._build_key(cache_type, key)
                cache_entry = CacheEntry(
                    data=value,
                    created_at=datetime.utcnow(),
                    expires_at=datetime.utcnow() + timedelta(seconds=ttl) if ttl else None,
                    access_count=0
                )

                serialized_data = json.dumps(cache_entry.dict()) if isinstance(value, (dict, list)) else pickle.dumps(cache_entry.dict())
                pipe.setex(cache_key, ttl, serialized_data)

            await pipe.execute()

            logger.debug(f"Cache bulk set: {len(data)} keys with TTL {ttl}s")
            return True

        except Exception as e:
            logger.error(f"Cache bulk set error: {e}")
            return False

    async def get_many(self, cache_type: str, keys: List[str]) -> Dict[str, Any]:
        """Get multiple cache values at once"""
        if not self._is_connected or not self._redis_client:
            return {}

        try:
            cache_keys = [self._build_key(cache_type, key) for key in keys]
            cached_values = await self._redis_client.mget(cache_keys)

            result = {}
            for i, (original_key, cached_data) in enumerate(zip(keys, cached_values)):
                if cached_data:
                    try:
                        cache_entry_dict = json.loads(cached_data)
                    except json.JSONDecodeError:
                        cache_entry_dict = pickle.loads(cached_data.encode())

                    cache_entry = CacheEntry(**cache_entry_dict)
                    result[original_key] = cache_entry.data

            logger.debug(f"Cache bulk get: {len(result)}/{len(keys)} hits")
            return result

        except Exception as e:
            logger.error(f"Cache bulk get error: {e}")
            return {}

    async def increment(self, cache_type: str, key: str, amount: int = 1) -> Optional[int]:
        """Increment a numeric cache value"""
        if not self._is_connected or not self._redis_client:
            return None

        try:
            cache_key = self._build_key(cache_type, key)
            new_value = await self._redis_client.incrby(cache_key, amount)

            logger.debug(f"Cache increment: {cache_key} by {amount} = {new_value}")
            return new_value

        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {e}")
            return None

    async def get_stats(self) -> Optional[CacheStats]:
        """Get Redis cache statistics"""
        if not self._is_connected or not self._redis_client:
            return None

        try:
            info = await self._redis_client.info()

            # Calculate hit rate
            hits = info.get('keyspace_hits', 0)
            misses = info.get('keyspace_misses', 0)
            total_commands = hits + misses
            hit_rate = (hits / total_commands * 100) if total_commands > 0 else 0

            stats = CacheStats(
                total_keys=info.get('db0', {}).get('keys', 0) if isinstance(info.get('db0'), dict) else 0,
                hits=hits,
                misses=misses,
                hit_rate=round(hit_rate, 2),
                memory_usage=info.get('used_memory_human', 'N/A'),
                uptime=str(timedelta(seconds=info.get('uptime_in_seconds', 0)))
            )

            return stats

        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return None

    async def clear_all(self) -> bool:
        """Clear all cache data (use with caution)"""
        if not self._is_connected or not self._redis_client:
            return False

        try:
            await self._redis_client.flushdb()
            logger.warning("Cache cleared: all data removed")
            return True

        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False

    async def warm_cache(self, cache_type: str, data_fetcher, keys: List[str], ttl: Optional[int] = None):
        """Warm cache with fresh data"""
        try:
            logger.info(f"Starting cache warming for {cache_type} with {len(keys)} keys")

            # Fetch data in batches to avoid overwhelming the data source
            batch_size = 10
            for i in range(0, len(keys), batch_size):
                batch_keys = keys[i:i + batch_size]

                # Fetch fresh data
                fresh_data = await data_fetcher(batch_keys)

                # Cache the fresh data
                await self.set_many(cache_type, fresh_data, ttl)

                # Small delay between batches
                await asyncio.sleep(0.1)

            logger.info(f"Cache warming completed for {cache_type}")

        except Exception as e:
            logger.error(f"Cache warming error for {cache_type}: {e}")


# Global cache service instance
cache_service = RedisCacheService()


# Dependency for FastAPI
async def get_cache_service() -> RedisCacheService:
    """Dependency to get cache service instance"""
    if not cache_service._is_connected:
        await cache_service.connect()
    return cache_service


# Cache decorators for common use cases
def cached(cache_type: str, key_func=None, ttl: Optional[int] = None):
    """Decorator for caching function results"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Try to get from cache
            cached_result = await cache_service.get(cache_type, cache_key)
            if cached_result is not None:
                return cached_result

            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_service.set(cache_type, cache_key, result, ttl)

            return result
        return wrapper
    return decorator