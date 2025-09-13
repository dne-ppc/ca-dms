"""
TDD-Driven Testing for Auto-Scaling Service

Following the RED-GREEN-REFACTOR cycle to discover and fix issues
in the Auto-Scaling Service. Each test drives the implementation.
"""
import pytest
import asyncio
import time
from unittest.mock import Mock, patch, MagicMock, AsyncMock
import docker
import redis
import psutil

from app.services.auto_scaling_service import (
    AutoScalingService, MetricThresholds, SystemMetrics,
    ScalingEvent, ScaleDirection, get_auto_scaling_service
)


class TestAutoScalingServiceTDD:
    """TDD-driven tests for Auto-Scaling Service discovery"""

    @pytest.fixture
    def service(self):
        """Create service instance with default thresholds"""
        thresholds = MetricThresholds(
            cpu_scale_up=80.0,
            cpu_scale_down=30.0,
            memory_scale_up=85.0,
            memory_scale_down=40.0,
            min_instances=2,
            max_instances=10,
            scale_cooldown=300
        )
        return AutoScalingService(thresholds)

    @pytest.fixture
    def sample_metrics(self):
        """Create sample system metrics for testing"""
        return SystemMetrics(
            cpu_usage=50.0,
            memory_usage=60.0,
            disk_usage=70.0,
            network_io={
                "bytes_sent": 1000000,
                "bytes_recv": 2000000,
                "packets_sent": 1000,
                "packets_recv": 2000
            },
            active_connections=25,
            response_time_avg=200.0,
            error_rate=1.5,
            queue_length=5,
            timestamp=time.time()
        )

    # =============================================================================
    # TASK 1.1: System Metrics Collection
    # RED PHASE: Discover metric collection issues
    # =============================================================================

    @pytest.mark.asyncio
    async def test_collect_metrics_basic_functionality(self, service):
        """
        RED: Test basic system metrics collection

        This test will likely reveal issues with:
        - psutil mocking requirements
        - Async database/Redis calls
        - External dependency handling
        """
        # Mock external dependencies
        with patch('psutil.cpu_percent', return_value=45.0), \
             patch('psutil.virtual_memory') as mock_memory, \
             patch('psutil.disk_usage') as mock_disk, \
             patch('psutil.net_io_counters') as mock_net, \
             patch.object(service, '_get_active_connections', return_value=10), \
             patch.object(service, '_get_average_response_time', return_value=150.0), \
             patch.object(service, '_get_error_rate', return_value=0.5), \
             patch.object(service, '_get_queue_length', return_value=3):

            # Mock psutil objects
            mock_memory.return_value = Mock(percent=60.0)
            mock_disk.return_value = Mock(total=1000000000, used=600000000)
            mock_net.return_value = Mock(
                bytes_sent=5000000, bytes_recv=8000000,
                packets_sent=5000, packets_recv=8000
            )

            metrics = await service.collect_metrics()

            # Test the expected behavior
            assert isinstance(metrics, SystemMetrics)
            assert 0 <= metrics.cpu_usage <= 100
            assert 0 <= metrics.memory_usage <= 100
            assert 0 <= metrics.disk_usage <= 100
            assert metrics.timestamp > 0
            assert isinstance(metrics.network_io, dict)
            assert metrics.active_connections == 10
            assert metrics.response_time_avg == 150.0

    @pytest.mark.asyncio
    async def test_collect_metrics_external_dependency_failures(self, service):
        """
        RED: Test metric collection when external dependencies fail

        This will reveal error handling robustness.
        """
        # Mock psutil failures
        with patch('psutil.cpu_percent', side_effect=Exception("psutil failure")), \
             patch('psutil.virtual_memory', side_effect=Exception("memory error")), \
             patch('psutil.disk_usage', side_effect=Exception("disk error")), \
             patch('psutil.net_io_counters', side_effect=Exception("network error")), \
             patch.object(service, '_get_active_connections', side_effect=Exception("db error")), \
             patch.object(service, '_get_average_response_time', side_effect=Exception("cache error")), \
             patch.object(service, '_get_error_rate', side_effect=Exception("analytics error")), \
             patch.object(service, '_get_queue_length', side_effect=Exception("queue error")):

            # Should not crash, should return default/safe values
            metrics = await service.collect_metrics()

            assert isinstance(metrics, SystemMetrics)
            # Should have safe defaults when collection fails
            assert metrics.cpu_usage == 0
            assert metrics.memory_usage == 0
            assert metrics.active_connections == 0

    # =============================================================================
    # TASK 1.2: Database Connection Monitoring
    # RED PHASE: Test database integration accuracy
    # =============================================================================

    @pytest.mark.asyncio
    async def test_get_active_connections_accuracy(self, service):
        """
        GREEN: Test accurate database connection counting

        Fixed to match actual ShardedDatabaseService interface
        """
        # Mock get_sharded_db import in the auto_scaling_service module
        with patch('app.services.auto_scaling_service.get_sharded_db') as mock_get_db:
            mock_service = Mock()
            mock_service.check_shard_health.return_value = {
                'shard_1': {'active_connections': 20},
                'shard_2': {'active_connections': 22}
            }
            mock_get_db.return_value = mock_service

            count = await service._get_active_connections()

            assert count == 42  # 20 + 22
            mock_service.check_shard_health.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_active_connections_database_error(self, service):
        """
        RED: Test database connection monitoring when database is unavailable
        """
        with patch('app.core.database_sharded.get_sharded_db') as mock_get_db:
            # Simulate database connection error
            mock_get_db.side_effect = Exception("Database connection failed")

            count = await service._get_active_connections()

            # Should return safe default, not crash
            assert count == 0

    # =============================================================================
    # TASK 1.3: Response Time Monitoring
    # RED PHASE: Test cache integration and calculations
    # =============================================================================

    @pytest.mark.asyncio
    async def test_get_average_response_time_calculation(self, service):
        """
        RED: Test average response time calculation from cache

        This will reveal:
        - Cache data format assumptions
        - Calculation accuracy
        - Error handling when cache is empty
        """
        # Mock cache service
        with patch('app.services.auto_scaling_service.cache_service') as mock_cache_service:
            # Mock async response time data from cache
            async def mock_get(key):
                return [100, 200, 300, 150, 250]

            mock_cache_service.get = mock_get

            avg_time = await service._get_average_response_time()

            assert avg_time == 200.0  # Average of sample data

    @pytest.mark.asyncio
    async def test_get_average_response_time_cache_failure(self, service):
        """
        RED: Test response time calculation when cache is unavailable
        """
        with patch('app.services.auto_scaling_service.cache_service') as mock_cache_service:
            # Simulate Redis connection failure
            mock_cache_service.get.side_effect = redis.ConnectionError("Connection refused")

            avg_time = await service._get_average_response_time()

            # Should return safe default when cache unavailable
            assert avg_time == 0.0

    @pytest.mark.asyncio
    async def test_get_average_response_time_empty_cache(self, service):
        """
        RED: Test response time calculation with empty cache
        """
        with patch('app.services.auto_scaling_service.cache_service') as mock_cache_service:
            # Empty cache
            mock_cache_service.get.return_value = None

            avg_time = await service._get_average_response_time()

            assert avg_time == 0.0

    # =============================================================================
    # TASK 2.1: Scale-Up Decision Making
    # RED PHASE: Test scaling decision logic
    # =============================================================================

    @pytest.mark.asyncio
    async def test_analyze_scaling_needs_scale_up_cpu(self, service):
        """
        RED: Test scaling decision when CPU usage is high

        This will reveal:
        - Decision algorithm correctness
        - Multi-metric interaction logic
        - Service-specific scaling rules
        """
        high_cpu_metrics = SystemMetrics(
            cpu_usage=85.0,  # Above threshold (80%)
            memory_usage=50.0,
            disk_usage=60.0,
            network_io={},
            active_connections=30,
            response_time_avg=500.0,
            error_rate=1.0,
            queue_length=10,
            timestamp=time.time()
        )

        decisions = await service.analyze_scaling_needs(high_cpu_metrics)

        assert isinstance(decisions, dict)
        # Should recommend scaling up due to high CPU
        # Real services are: backend, frontend, worker
        assert 'backend' in decisions
        assert 'frontend' in decisions
        assert 'worker' in decisions
        # At least one service should scale up
        scale_up_recommended = any(
            direction == ScaleDirection.UP
            for direction in decisions.values()
        )
        assert scale_up_recommended

    @pytest.mark.asyncio
    async def test_analyze_scaling_needs_scale_up_memory(self, service):
        """
        RED: Test scaling decision when memory usage is high
        """
        high_memory_metrics = SystemMetrics(
            cpu_usage=40.0,
            memory_usage=90.0,  # Above threshold (85%)
            disk_usage=60.0,
            network_io={},
            active_connections=30,
            response_time_avg=500.0,
            error_rate=1.0,
            queue_length=10,
            timestamp=time.time()
        )

        decisions = await service.analyze_scaling_needs(high_memory_metrics)

        # Should recommend scaling up due to high memory
        scale_up_recommended = any(
            direction == ScaleDirection.UP
            for direction in decisions.values()
        )
        assert scale_up_recommended

    @pytest.mark.asyncio
    async def test_analyze_scaling_needs_multiple_thresholds(self, service):
        """
        RED: Test scaling decision when multiple metrics exceed thresholds
        """
        high_all_metrics = SystemMetrics(
            cpu_usage=85.0,  # Above CPU threshold
            memory_usage=90.0,  # Above memory threshold
            disk_usage=95.0,
            network_io={},
            active_connections=30,
            response_time_avg=1500.0,  # Above response time threshold
            error_rate=5.0,
            queue_length=20,
            timestamp=time.time()
        )

        decisions = await service.analyze_scaling_needs(high_all_metrics)

        # Should definitely recommend scaling up
        scale_up_count = sum(
            1 for direction in decisions.values()
            if direction == ScaleDirection.UP
        )
        assert scale_up_count > 0

    # =============================================================================
    # TASK 2.2: Scale-Down Safety
    # RED PHASE: Test safety mechanisms
    # =============================================================================

    @pytest.mark.asyncio
    async def test_analyze_scaling_needs_scale_down_safety(self, service):
        """
        RED: Test that scaling down respects minimum instances

        This will reveal:
        - Safety mechanism implementation
        - Current instance counting accuracy
        - Minimum/maximum boundary enforcement
        """
        low_usage_metrics = SystemMetrics(
            cpu_usage=15.0,  # Well below threshold (30%)
            memory_usage=20.0,  # Well below threshold (40%)
            disk_usage=30.0,
            network_io={},
            active_connections=5,
            response_time_avg=100.0,
            error_rate=0.1,
            queue_length=1,
            timestamp=time.time()
        )

        # Mock current instances at minimum
        with patch.object(service, '_get_current_instances', return_value=2):
            decisions = await service.analyze_scaling_needs(low_usage_metrics)

            # Should NOT scale down below minimum
            scale_down_count = sum(
                1 for direction in decisions.values()
                if direction == ScaleDirection.DOWN
            )
            assert scale_down_count == 0  # No scale down when at minimum

    @pytest.mark.asyncio
    async def test_analyze_scaling_needs_scale_up_maximum_safety(self, service):
        """
        RED: Test that scaling up respects maximum instances
        """
        high_usage_metrics = SystemMetrics(
            cpu_usage=95.0,  # Very high CPU
            memory_usage=95.0,  # Very high memory
            disk_usage=95.0,
            network_io={},
            active_connections=90,
            response_time_avg=2000.0,
            error_rate=10.0,
            queue_length=50,
            timestamp=time.time()
        )

        # Mock current instances at maximum
        with patch.object(service, '_get_current_instances', return_value=10):
            decisions = await service.analyze_scaling_needs(high_usage_metrics)

            # Should NOT scale up above maximum
            scale_up_count = sum(
                1 for direction in decisions.values()
                if direction == ScaleDirection.UP
            )
            assert scale_up_count == 0  # No scale up when at maximum

    # =============================================================================
    # TASK 2.3: Cooldown Period Enforcement
    # RED PHASE: Test cooldown mechanisms
    # =============================================================================

    @pytest.mark.asyncio
    async def test_execute_scaling_cooldown_enforcement(self, service, sample_metrics):
        """
        GREEN: Test that scaling respects cooldown periods

        Fixed ScalingEvent structure to match real implementation
        """
        # Add recent scaling event to history
        recent_event = ScalingEvent(
            service='backend',  # Use real service name
            action=ScaleDirection.UP,  # Use correct field name
            instances_before=2,
            instances_after=3,
            timestamp=time.time() - 60,  # 1 minute ago (within cooldown)
            reason="High CPU usage",
            metrics=sample_metrics
        )
        service.scaling_history.append(recent_event)
        service.last_scale_time['backend'] = time.time() - 60  # Set last scale time

        metrics = SystemMetrics(
            cpu_usage=90.0,  # High CPU should trigger scaling
            memory_usage=90.0,  # High Memory should trigger scaling
            disk_usage=60.0,
            network_io={},
            active_connections=80,
            response_time_avg=1500.0,
            error_rate=5.0,
            queue_length=30,
            timestamp=time.time()
        )

        # Mock Docker operations
        with patch.object(service, '_get_current_instances', return_value=3), \
             patch.object(service, '_start_new_instance', return_value=True):

            # Should not scale due to cooldown
            result = await service.execute_scaling('backend', ScaleDirection.UP, metrics)

            assert result is False  # Scaling blocked by cooldown

    @pytest.mark.asyncio
    async def test_execute_scaling_after_cooldown_period(self, service):
        """
        RED: Test that scaling works after cooldown period expires
        """
        # Create sample metrics for the old event
        sample_metrics = SystemMetrics(
            cpu_usage=70.0, memory_usage=60.0, disk_usage=50.0,
            network_io={}, active_connections=30, response_time_avg=500.0,
            error_rate=1.0, queue_length=10, timestamp=time.time() - 400
        )

        # Add old scaling event to history
        old_event = ScalingEvent(
            service='api',
            action=ScaleDirection.UP,
            instances_before=2,
            instances_after=3,
            timestamp=time.time() - 400,  # 400 seconds ago (past cooldown)
            reason="Test scaling event",
            metrics=sample_metrics
        )
        service.scaling_history.append(old_event)

        metrics = SystemMetrics(
            cpu_usage=90.0,
            memory_usage=90.0,
            disk_usage=60.0,
            network_io={},
            active_connections=80,
            response_time_avg=1500.0,
            error_rate=5.0,
            queue_length=30,
            timestamp=time.time()
        )

        # Mock Docker operations
        with patch.object(service, '_get_current_instances', return_value=3), \
             patch.object(service, '_start_new_instance', return_value=True):

            # Should scale because cooldown has expired
            result = await service.execute_scaling('api', ScaleDirection.UP, metrics)

            assert result is True  # Scaling should succeed

    # =============================================================================
    # TASK 3.1: Container Instance Management
    # RED PHASE: Test Docker integration
    # =============================================================================

    @pytest.mark.asyncio
    async def test_get_current_instances_docker_integration(self, service):
        """
        RED: Test accurate container instance counting

        This will reveal:
        - Docker client initialization
        - Container filtering logic
        - Service name matching patterns
        """
        # Mock Docker client with containers that have proper labels
        # Real implementation uses labels, not names for filtering

        def mock_containers_list(filters=None):
            if filters and 'label' in filters:
                service_label = filters['label']  # "service=backend" format
                service_name = service_label.split('=')[1]

                if service_name == 'backend':
                    return [Mock(), Mock()]  # 2 backend containers
                elif service_name == 'worker':
                    return [Mock()]  # 1 worker container
            return []

        with patch.object(service, 'docker_client') as mock_docker:
            mock_docker.containers.list.side_effect = mock_containers_list

            backend_count = await service._get_current_instances('backend')
            worker_count = await service._get_current_instances('worker')

            assert backend_count == 2  # 2 backend containers
            assert worker_count == 1  # 1 worker container

    @pytest.mark.asyncio
    async def test_get_current_instances_docker_client_error(self, service):
        """
        RED: Test instance counting when Docker client fails
        """
        with patch.object(service, 'docker_client') as mock_docker:
            # Simulate Docker daemon connection error
            mock_docker.containers.list.side_effect = docker.errors.DockerException("Cannot connect to Docker daemon")

            count = await service._get_current_instances('api')

            # Should return safe default when Docker is unavailable
            assert count == 0

    # =============================================================================
    # TASK 3.2: Container Scaling Operations
    # RED PHASE: Test Docker operations
    # =============================================================================

    @pytest.mark.asyncio
    async def test_start_new_instance_docker_operations(self, service):
        """
        RED: Test Docker container creation

        This will reveal:
        - Docker API integration correctness
        - Container configuration handling
        - Resource allocation parameters
        """
        with patch.object(service, 'docker_client') as mock_docker:
            # Mock existing container to use as template
            mock_existing = Mock()
            mock_existing.image.id = 'test-image-id'
            mock_existing.attrs = {
                'Config': {'Env': ['ENV=test']},
                'HostConfig': {'NetworkMode': 'bridge'}
            }

            # Mock containers.list to return existing container
            mock_docker.containers.list.return_value = [mock_existing]

            # Mock successful container start
            mock_new_container = Mock()
            mock_new_container.id = 'new-container-id'
            mock_docker.containers.run.return_value = mock_new_container

            result = await service._start_new_instance('api')

            assert result is True
            # Verify Docker API was called correctly
            mock_docker.containers.run.assert_called_once()
            call_args = mock_docker.containers.run.call_args
            # Should run in detached mode
            assert call_args.kwargs.get('detach') is True

    @pytest.mark.asyncio
    async def test_start_new_instance_docker_failure(self, service):
        """
        RED: Test container creation when Docker operations fail
        """
        with patch.object(service, 'docker_client') as mock_docker:
            # Simulate Docker operation failure
            mock_docker.containers.run.side_effect = docker.errors.APIError("Failed to start container")

            result = await service._start_new_instance('api')

            assert result is False

    # =============================================================================
    # TASK 4.1: Redis Cache Failures
    # RED PHASE: Test external dependency resilience
    # =============================================================================

    @pytest.mark.asyncio
    async def test_get_error_rate_redis_failure(self, service):
        """
        RED: Test error rate calculation when Redis cache is unavailable
        """
        with patch('app.services.auto_scaling_service.cache_service') as mock_cache_service:
            # Simulate Redis connection failure
            mock_cache_service.get.side_effect = redis.ConnectionError("Connection refused")

            error_rate = await service._get_error_rate()

            # Should return safe default when cache unavailable
            assert error_rate == 0.0

    @pytest.mark.asyncio
    async def test_get_queue_length_redis_failure(self, service):
        """
        RED: Test queue length monitoring when Redis is unavailable
        """
        with patch('app.services.auto_scaling_service.cache_service') as mock_cache_service:
            # Simulate Redis connection failure
            mock_cache_service.get.side_effect = redis.ConnectionError("Connection refused")

            queue_length = await service._get_queue_length()

            # Should return safe default when cache unavailable
            assert queue_length == 0

    # =============================================================================
    # TASK 5.1: Performance Testing
    # RED PHASE: Test performance characteristics
    # =============================================================================

    @pytest.mark.asyncio
    async def test_collect_metrics_performance(self, service):
        """
        RED: Test metric collection performance under load

        This will reveal:
        - Concurrent metric collection efficiency
        - Resource contention issues
        - Thread safety concerns
        """
        # Mock all external dependencies for consistent timing
        with patch('psutil.cpu_percent', return_value=50.0), \
             patch('psutil.virtual_memory', return_value=Mock(percent=60.0)), \
             patch('psutil.disk_usage', return_value=Mock(total=1000, used=600)), \
             patch('psutil.net_io_counters', return_value=Mock(bytes_sent=1000, bytes_recv=2000, packets_sent=10, packets_recv=20)), \
             patch.object(service, '_get_active_connections', return_value=10), \
             patch.object(service, '_get_average_response_time', return_value=200.0), \
             patch.object(service, '_get_error_rate', return_value=1.0), \
             patch.object(service, '_get_queue_length', return_value=5):

            # Collect metrics rapidly
            start_time = time.time()

            tasks = [service.collect_metrics() for _ in range(10)]
            results = await asyncio.gather(*tasks)

            duration = time.time() - start_time

            # Should complete within reasonable time
            assert duration < 1.0  # 10 collections in under 1 second
            assert len(results) == 10
            assert all(isinstance(r, SystemMetrics) for r in results)

    # =============================================================================
    # Service Initialization and Configuration Tests
    # =============================================================================

    def test_service_initialization_default_thresholds(self):
        """
        RED: Test service initialization with default thresholds
        """
        service = AutoScalingService()

        assert service.thresholds is not None
        assert service.scaling_history == []
        assert service.is_running is False
        # Should have docker client initialized (or at least attempted)
        assert hasattr(service, 'docker_client')

    def test_service_initialization_custom_thresholds(self):
        """
        RED: Test service initialization with custom thresholds
        """
        custom_thresholds = MetricThresholds(
            cpu_scale_up=75.0,
            memory_scale_up=80.0,
            min_instances=3,
            max_instances=15
        )

        service = AutoScalingService(custom_thresholds)

        assert service.thresholds.cpu_scale_up == 75.0
        assert service.thresholds.memory_scale_up == 80.0
        assert service.thresholds.min_instances == 3
        assert service.thresholds.max_instances == 15

    @pytest.mark.asyncio
    async def test_update_thresholds(self, service):
        """
        RED: Test dynamic threshold updating
        """
        new_thresholds = {
            'cpu_scale_up': 85.0,
            'memory_scale_up': 90.0,
            'min_instances': 3
        }

        await service.update_thresholds(new_thresholds)

        assert service.thresholds.cpu_scale_up == 85.0
        assert service.thresholds.memory_scale_up == 90.0
        assert service.thresholds.min_instances == 3

    def test_get_scaling_history(self, service):
        """
        RED: Test scaling history retrieval
        """
        # Create sample metrics for events
        sample_metrics = SystemMetrics(
            cpu_usage=70.0, memory_usage=60.0, disk_usage=50.0,
            network_io={}, active_connections=30, response_time_avg=500.0,
            error_rate=1.0, queue_length=10, timestamp=time.time()
        )

        # Add some mock events
        event1 = ScalingEvent(
            service='api',
            action=ScaleDirection.UP,
            instances_before=2,
            instances_after=3,
            timestamp=time.time() - 100,
            reason='High CPU usage',
            metrics=sample_metrics
        )
        event2 = ScalingEvent(
            service='worker',
            action=ScaleDirection.DOWN,
            instances_before=4,
            instances_after=3,
            timestamp=time.time() - 50,
            reason='Low resource usage',
            metrics=sample_metrics
        )

        service.scaling_history.extend([event1, event2])

        history = service.get_scaling_history(limit=10)

        assert len(history) == 2
        # History returns events in order they were added (not by timestamp)
        assert history[0].service == 'api'  # event1 was added first
        assert history[0].action == ScaleDirection.UP
        assert history[1].service == 'worker'  # event2 was added second
        assert history[1].action == ScaleDirection.DOWN

    def test_get_current_status(self, service):
        """
        RED: Test current status reporting
        """
        status = service.get_current_status()

        assert isinstance(status, dict)
        assert 'is_running' in status
        assert 'thresholds' in status
        assert 'recent_events' in status
        assert status['is_running'] == service.is_running

    def test_get_auto_scaling_service_singleton(self):
        """
        RED: Test singleton service retrieval
        """
        service1 = get_auto_scaling_service()
        service2 = get_auto_scaling_service()

        assert service1 is service2  # Should return same instance