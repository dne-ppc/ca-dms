"""
Comprehensive tests for caching functionality in CA-DMS

Tests Redis caching, document caching, cache invalidation,
cache warming, and monitoring services.
"""

import pytest
import asyncio
import time
import unittest.mock
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
from typing import Dict, Any

from app.services.cache_service import cache_service, CacheStats
from app.services.cached_document_service import CachedDocumentService
from app.services.cache_invalidation_service import (
    cache_invalidation_service,
    InvalidationTrigger,
    InvalidationStrategy
)
from app.services.cache_warming_service import (
    cache_warming_service,
    WarmingPriority,
    WarmingStrategy
)
from app.services.cache_monitoring_service import (
    cache_monitoring_service,
    MetricType,
    AlertLevel
)
from app.models.document import Document


class TestRedisCache:
    """Test Redis cache service functionality"""

    @pytest.fixture
    async def mock_redis(self):
        """Mock Redis client"""
        with patch('app.services.cache_service.redis') as mock_redis:
            mock_client = AsyncMock()
            mock_redis.Redis.return_value = mock_client
            mock_client.ping.return_value = True
            yield mock_client

    @pytest.mark.asyncio
    async def test_cache_connection(self, mock_redis):
        """Test Redis cache connection"""
        # Test successful connection
        connected = await cache_service.connect()
        assert connected is True
        mock_redis.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_set_get(self, mock_redis):
        """Test basic cache set and get operations"""
        # Mock Redis responses
        mock_redis.setex.return_value = True
        mock_redis.get.return_value = '{"data": {"id": "test", "title": "Test Doc"}, "created_at": "2024-01-01T00:00:00"}'

        # Test cache set
        success = await cache_service.set("document", "test_key", {"id": "test", "title": "Test Doc"})
        assert success is True

        # Test cache get
        result = await cache_service.get("document", "test_key")
        assert result is not None
        assert result["id"] == "test"

    @pytest.mark.asyncio
    async def test_cache_delete(self, mock_redis):
        """Test cache deletion"""
        mock_redis.delete.return_value = 1

        success = await cache_service.delete("document", "test_key")
        assert success is True

    @pytest.mark.asyncio
    async def test_cache_delete_pattern(self, mock_redis):
        """Test pattern-based cache deletion"""
        mock_redis.keys.return_value = ["ca_dms:doc:key1", "ca_dms:doc:key2"]
        mock_redis.delete.return_value = 2

        deleted = await cache_service.delete_pattern("document", "doc:*")
        assert deleted == 2

    @pytest.mark.asyncio
    async def test_cache_stats(self, mock_redis):
        """Test cache statistics retrieval"""
        mock_info = {
            'keyspace_hits': 100,
            'keyspace_misses': 20,
            'used_memory_human': '1.5MB',
            'uptime_in_seconds': 86400,
            'db0': {'keys': 150}
        }
        mock_redis.info.return_value = mock_info

        stats = await cache_service.get_stats()
        assert stats is not None
        assert stats.hits == 100
        assert stats.misses == 20
        assert stats.hit_rate == 83.33  # 100/(100+20) * 100

    @pytest.mark.asyncio
    async def test_cache_ttl_handling(self, mock_redis):
        """Test TTL (Time To Live) handling"""
        mock_redis.setex.return_value = True

        # Test with custom TTL
        success = await cache_service.set("document", "test_key", {"data": "test"}, ttl=300)
        assert success is True

        # Verify setex was called with correct TTL
        mock_redis.setex.assert_called_with(
            "ca_dms:document:test_key",
            300,
            unittest.mock.ANY
        )


class TestDocumentCaching:
    """Test cached document service functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()

    @pytest.fixture
    def cached_service(self, mock_db):
        """Create cached document service instance"""
        return CachedDocumentService(mock_db)

    @pytest.fixture
    def sample_document(self):
        """Sample document for testing"""
        doc = Document()
        doc.id = "test-doc-id"
        doc.title = "Test Document"
        doc.content = {"ops": [{"insert": "Test content"}]}
        doc.document_type = "governance"
        doc.version = 1
        doc.created_by = "user-1"
        doc.status = "draft"
        return doc

    @pytest.mark.asyncio
    async def test_document_cache_hit(self, cached_service, sample_document):
        """Test document cache hit scenario"""
        with patch.object(cache_service, 'get') as mock_get:
            # Mock cache hit
            mock_get.return_value = {
                "id": "test-doc-id",
                "title": "Test Document",
                "content": {"ops": [{"insert": "Test content"}]},
                "document_type": "governance",
                "version": 1,
                "created_by": "user-1",
                "status": "draft"
            }

            result = await cached_service.get_document_cached("test-doc-id")

            assert result is not None
            assert result.id == "test-doc-id"
            assert result.title == "Test Document"
            mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_document_cache_miss(self, cached_service, sample_document, mock_db):
        """Test document cache miss scenario"""
        with patch.object(cache_service, 'get') as mock_get, \
             patch.object(cache_service, 'set') as mock_set, \
             patch.object(cached_service, 'get_document') as mock_get_doc:

            # Mock cache miss
            mock_get.return_value = None
            mock_get_doc.return_value = sample_document
            mock_set.return_value = True

            result = await cached_service.get_document_cached("test-doc-id")

            assert result is not None
            assert result.id == "test-doc-id"
            mock_get.assert_called_once()
            mock_set.assert_called_once()

    @pytest.mark.asyncio
    async def test_document_create_invalidation(self, cached_service, sample_document):
        """Test cache invalidation on document creation"""
        with patch.object(cached_service, 'create_document') as mock_create, \
             patch.object(cache_service, 'set') as mock_set, \
             patch.object(cached_service, '_invalidate_document_lists') as mock_invalidate:

            mock_create.return_value = sample_document
            mock_set.return_value = True

            result = await cached_service.create_document_cached(
                Mock(title="Test", content={"ops": []}, document_type="governance", placeholders={}),
                "user-1"
            )

            assert result is not None
            mock_invalidate.assert_called_once()

    @pytest.mark.asyncio
    async def test_document_update_invalidation(self, cached_service, sample_document):
        """Test cache invalidation on document update"""
        with patch.object(cached_service, 'update_document') as mock_update, \
             patch.object(cache_service, 'set') as mock_set, \
             patch.object(cached_service, '_invalidate_related_caches') as mock_invalidate:

            mock_update.return_value = sample_document
            mock_set.return_value = True

            result = await cached_service.update_document_cached(
                "test-doc-id",
                Mock(title="Updated Title"),
                "user-1"
            )

            assert result is not None
            mock_invalidate.assert_called_once()


class TestCacheInvalidation:
    """Test cache invalidation functionality"""

    @pytest.mark.asyncio
    async def test_invalidation_rule_registration(self):
        """Test invalidation rule registration"""
        initial_count = len(cache_invalidation_service.invalidation_rules[InvalidationTrigger.DOCUMENT_CREATED])

        # Should have at least one default rule
        assert initial_count > 0

    @pytest.mark.asyncio
    async def test_document_invalidation_trigger(self):
        """Test document invalidation trigger"""
        with patch.object(cache_service, 'delete_pattern') as mock_delete_pattern:
            mock_delete_pattern.return_value = 5

            await cache_invalidation_service.trigger_invalidation(
                InvalidationTrigger.DOCUMENT_UPDATED,
                {"document_id": "test-doc", "document_type": "governance"}
            )

            # Should have called delete_pattern for various cache patterns
            assert mock_delete_pattern.call_count > 0

    @pytest.mark.asyncio
    async def test_delayed_invalidation(self):
        """Test delayed invalidation strategy"""
        from app.services.cache_invalidation_service import CacheInvalidationRule

        # Create a delayed invalidation rule
        rule = CacheInvalidationRule(
            trigger=InvalidationTrigger.SEARCH_INDEX_UPDATED,
            cache_patterns=["search:*"],
            strategy=InvalidationStrategy.DELAYED,
            delay_seconds=1  # Short delay for testing
        )

        cache_invalidation_service.add_rule(rule)

        with patch.object(cache_service, 'delete_pattern') as mock_delete_pattern:
            mock_delete_pattern.return_value = 3

            # Trigger delayed invalidation
            await cache_invalidation_service.trigger_invalidation(
                InvalidationTrigger.SEARCH_INDEX_UPDATED
            )

            # Wait for delayed execution
            await asyncio.sleep(1.5)

            # Should eventually call delete_pattern
            assert mock_delete_pattern.call_count > 0

    @pytest.mark.asyncio
    async def test_manual_invalidation(self):
        """Test manual cache invalidation"""
        with patch.object(cache_service, 'delete_pattern') as mock_delete_pattern:
            mock_delete_pattern.return_value = 2

            result = await cache_invalidation_service.manual_invalidation(
                cache_patterns=["document:docs:*", "search:*"],
                strategy=InvalidationStrategy.IMMEDIATE
            )

            assert result["success"] is True
            assert mock_delete_pattern.call_count >= 2

    @pytest.mark.asyncio
    async def test_invalidation_stats(self):
        """Test invalidation statistics"""
        stats = await cache_invalidation_service.get_invalidation_stats()

        assert "total_invalidations" in stats
        assert "successful_invalidations" in stats
        assert "trigger_counts" in stats
        assert "strategy_counts" in stats


class TestCacheWarming:
    """Test cache warming functionality"""

    @pytest.mark.asyncio
    async def test_warming_rule_registration(self):
        """Test warming rule registration"""
        assert len(cache_warming_service.warming_rules) > 0
        assert "recent_documents" in cache_warming_service.warming_rules

    @pytest.mark.asyncio
    async def test_warm_by_rule(self):
        """Test warming cache by specific rule"""
        with patch.object(cache_warming_service, '_fetch_recent_documents') as mock_fetch, \
             patch.object(cache_service, 'set') as mock_set:

            # Mock data
            mock_docs = [Mock(id="doc1"), Mock(id="doc2")]
            mock_fetch.return_value = mock_docs
            mock_set.return_value = True

            task = await cache_warming_service.warm_cache_by_rule("recent_documents")

            assert task.status == "completed"
            assert task.items_warmed > 0

    @pytest.mark.asyncio
    async def test_warm_by_priority(self):
        """Test warming cache by priority level"""
        with patch.object(cache_warming_service, 'warm_cache_by_rule') as mock_warm_rule:
            from app.services.cache_warming_service import WarmingTask, WarmingRule

            # Mock successful task
            mock_task = WarmingTask(
                rule=WarmingRule(
                    name="test_rule",
                    strategy=WarmingStrategy.RECENT_ACCESS,
                    priority=WarmingPriority.HIGH,
                    data_fetcher=Mock(),
                    cache_type="document",
                    key_generator=Mock()
                ),
                scheduled_at=datetime.utcnow()
            )
            mock_task.status = "completed"
            mock_task.items_warmed = 10
            mock_warm_rule.return_value = mock_task

            tasks = await cache_warming_service.warm_cache_by_priority(WarmingPriority.HIGH)

            assert len(tasks) > 0
            assert all(task.status == "completed" for task in tasks)

    @pytest.mark.asyncio
    async def test_predictive_warming(self):
        """Test predictive cache warming"""
        # Record some access patterns
        cache_warming_service.record_access_pattern("document", "doc:test1")
        cache_warming_service.record_access_pattern("document", "doc:test2")

        task = await cache_warming_service.predictive_warming()

        assert task.status in ["completed", "failed"]
        assert hasattr(task, "items_warmed")

    @pytest.mark.asyncio
    async def test_warming_schedule(self):
        """Test warming schedule generation"""
        schedule = await cache_warming_service.get_warming_schedule()

        assert isinstance(schedule, dict)
        assert len(schedule) > 0

        for rule_name, schedule_info in schedule.items():
            assert "strategy" in schedule_info
            assert "priority" in schedule_info
            assert "next_execution" in schedule_info

    @pytest.mark.asyncio
    async def test_warming_stats(self):
        """Test warming statistics"""
        stats = await cache_warming_service.get_warming_stats()

        assert "total_tasks" in stats
        assert "successful_tasks" in stats
        assert "strategy_counts" in stats
        assert "total_rules" in stats


class TestCacheMonitoring:
    """Test cache monitoring functionality"""

    @pytest.mark.asyncio
    async def test_metrics_collection(self):
        """Test metrics collection"""
        with patch.object(cache_service, 'get_stats') as mock_get_stats:
            mock_stats = CacheStats(
                total_keys=100,
                hits=80,
                misses=20,
                hit_rate=80.0,
                memory_usage="2.5MB",
                uptime="1:00:00"
            )
            mock_get_stats.return_value = mock_stats

            await cache_monitoring_service.collect_all_metrics()

            # Check that metrics were stored
            assert len(cache_monitoring_service.metrics) > 0

    @pytest.mark.asyncio
    async def test_alert_generation(self):
        """Test alert generation for threshold violations"""
        # Set low thresholds for testing
        await cache_monitoring_service.update_alert_thresholds(
            MetricType.HIT_RATE, 90.0, 70.0  # warning: 90%, critical: 70%
        )

        with patch.object(cache_service, 'get_stats') as mock_get_stats:
            # Mock low hit rate
            mock_stats = CacheStats(
                total_keys=100,
                hits=60,
                misses=40,
                hit_rate=60.0,  # Below critical threshold
                memory_usage="1MB",
                uptime="1:00:00"
            )
            mock_get_stats.return_value = mock_stats

            await cache_monitoring_service.collect_all_metrics()

            # Check that alert was generated
            active_alerts = await cache_monitoring_service.get_active_alerts()
            assert len(active_alerts) > 0

    @pytest.mark.asyncio
    async def test_performance_report(self):
        """Test performance report generation"""
        report = await cache_monitoring_service.get_performance_report()

        assert "health_score" in report
        assert "health_status" in report
        assert "metrics_summary" in report
        assert "active_alerts" in report
        assert "recommendations" in report

    @pytest.mark.asyncio
    async def test_operation_recording(self):
        """Test cache operation recording"""
        # Record some operations
        cache_monitoring_service.record_cache_operation("document", "get", 50.0, True)
        cache_monitoring_service.record_cache_operation("document", "set", 75.0, True)
        cache_monitoring_service.record_cache_operation("document", "get", 200.0, False)

        # Check that operations were recorded
        assert len(cache_monitoring_service.operation_counters) > 0
        assert len(cache_monitoring_service.response_times) > 0
        assert len(cache_monitoring_service.error_counters) > 0

    @pytest.mark.asyncio
    async def test_alert_resolution(self):
        """Test alert resolution"""
        from app.services.cache_monitoring_service import CacheAlert

        # Create a test alert
        alert = CacheAlert(
            alert_id="test_alert",
            level=AlertLevel.WARNING,
            metric_type=MetricType.HIT_RATE,
            message="Test alert",
            threshold=80.0,
            current_value=75.0,
            cache_type="redis",
            timestamp=datetime.utcnow()
        )

        cache_monitoring_service.alerts.append(alert)

        # Resolve the alert
        success = await cache_monitoring_service.resolve_alert("test_alert")
        assert success is True
        assert alert.resolved is True

    @pytest.mark.asyncio
    async def test_metrics_export(self):
        """Test metrics data export"""
        # Add some test metrics
        from app.services.cache_monitoring_service import CacheMetric

        metric = CacheMetric(
            metric_type=MetricType.HIT_RATE,
            value=85.0,
            timestamp=datetime.utcnow(),
            cache_type="redis"
        )

        cache_monitoring_service._store_metric(metric)

        # Export metrics
        exported = await cache_monitoring_service.export_metrics("json")
        assert isinstance(exported, str)
        assert "redis:hit_rate" in exported


class TestCacheIntegration:
    """Integration tests for cache system components"""

    @pytest.mark.asyncio
    async def test_end_to_end_caching_flow(self):
        """Test complete caching flow from document creation to monitoring"""
        # This would be a comprehensive integration test
        # involving multiple cache service interactions
        pass

    @pytest.mark.asyncio
    async def test_cache_performance_under_load(self):
        """Test cache performance under simulated load"""
        # Simulate multiple concurrent cache operations
        tasks = []
        for i in range(50):
            task = asyncio.create_task(
                cache_service.set("test", f"key_{i}", {"data": f"value_{i}"})
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful operations
        successful = sum(1 for result in results if result is True)
        assert successful > 40  # Allow for some failures

    @pytest.mark.asyncio
    async def test_cache_invalidation_cascade(self):
        """Test cascading cache invalidation"""
        # Set up cache dependencies
        cache_invalidation_service.add_dependency("document:list", "document:doc1")
        cache_invalidation_service.add_dependency("search:results", "document:doc1")

        with patch.object(cache_service, 'delete_pattern') as mock_delete, \
             patch.object(cache_service, 'delete') as mock_delete_single:

            mock_delete.return_value = 2
            mock_delete_single.return_value = True

            # Trigger cascade invalidation
            from app.services.cache_invalidation_service import CacheInvalidationRule

            rule = CacheInvalidationRule(
                trigger=InvalidationTrigger.DOCUMENT_UPDATED,
                cache_patterns=["document:doc1"],
                strategy=InvalidationStrategy.DEPENDENCY_CASCADE
            )

            task = {
                'rule': rule,
                'patterns': ["document:doc1"],
                'context': {},
                'scheduled_at': datetime.utcnow()
            }

            await cache_invalidation_service._execute_cascade_invalidation(task)

            # Should have invalidated dependent caches
            assert task['status'] == 'completed'


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])