"""
Comprehensive tests for horizontal scaling features
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from app.core.sharding import ShardManager, ShardingConfig, ShardConfig, ShardAwareSession
from app.core.database_sharded import ShardedDatabaseService
from app.services.auto_scaling_service import AutoScalingService, MetricThresholds, SystemMetrics, ScaleDirection
from app.schemas.scaling import AutoScalingConfig
import time


class TestShardManager:
    """Tests for database sharding functionality"""

    def test_shard_manager_initialization(self):
        """Test shard manager initialization"""
        config = ShardingConfig(
            shards=[
                ShardConfig(shard_id="shard_001", database_url="postgresql://test1"),
                ShardConfig(shard_id="shard_002", database_url="postgresql://test2")
            ],
            default_shard="shard_001"
        )

        with patch('app.core.sharding.create_engine'):
            manager = ShardManager(config)
            assert len(manager.config.shards) == 2
            assert manager.config.default_shard == "shard_001"

    def test_hash_based_routing_consistency(self):
        """Test that hash-based routing is consistent"""
        config = ShardingConfig(
            shards=[
                ShardConfig(shard_id="shard_001", database_url="postgresql://test1"),
                ShardConfig(shard_id="shard_002", database_url="postgresql://test2")
            ],
            default_shard="shard_001"
        )

        with patch('app.core.sharding.create_engine'):
            manager = ShardManager(config)

            # Same document ID should always route to same shard
            doc_id = "test-document-123"
            shard1 = manager.get_shard_for_document(doc_id)
            shard2 = manager.get_shard_for_document(doc_id)
            assert shard1 == shard2

    def test_shard_distribution(self):
        """Test that documents are distributed across shards"""
        config = ShardingConfig(
            shards=[
                ShardConfig(shard_id="shard_001", database_url="postgresql://test1"),
                ShardConfig(shard_id="shard_002", database_url="postgresql://test2"),
                ShardConfig(shard_id="shard_003", database_url="postgresql://test3")
            ],
            default_shard="shard_001"
        )

        with patch('app.core.sharding.create_engine'):
            manager = ShardManager(config)

            # Test with multiple document IDs
            shard_counts = {}
            for i in range(100):
                doc_id = f"doc-{i}"
                shard = manager.get_shard_for_document(doc_id)
                shard_counts[shard] = shard_counts.get(shard, 0) + 1

            # Should have documents on all shards
            assert len(shard_counts) == 3

            # Distribution should be reasonably balanced (no shard should have > 60% of docs)
            for count in shard_counts.values():
                assert count <= 60

    def test_range_based_routing(self):
        """Test range-based routing strategy"""
        config = ShardingConfig(
            strategy="range_based",
            shards=[
                ShardConfig(shard_id="shard_001", database_url="postgresql://test1"),
                ShardConfig(shard_id="shard_002", database_url="postgresql://test2")
            ],
            default_shard="shard_001"
        )

        with patch('app.core.sharding.create_engine'):
            manager = ShardManager(config)

            # Test with UUID-like strings
            doc_id1 = "00000000-1111-2222-3333-444444444444"
            doc_id2 = "ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb"

            shard1 = manager.get_shard_for_document(doc_id1)
            shard2 = manager.get_shard_for_document(doc_id2)

            # Different ranges should potentially route to different shards
            assert shard1 in ["shard_001", "shard_002"]
            assert shard2 in ["shard_001", "shard_002"]


class TestShardedDatabaseService:
    """Tests for sharded database service"""

    @patch('app.core.database_sharded.get_shard_manager')
    def test_document_session_routing(self, mock_get_manager):
        """Test document session routing"""
        mock_manager = Mock()
        mock_manager.get_shard_for_document.return_value = "shard_001"
        mock_get_manager.return_value = mock_manager

        service = ShardedDatabaseService()

        with patch.object(ShardAwareSession, '__enter__') as mock_session:
            mock_session.return_value = Mock()
            session = service.get_document_session("test-doc-123")
            assert mock_session.called

    @patch('app.core.database_sharded.get_shard_manager')
    def test_cross_shard_query_execution(self, mock_get_manager):
        """Test cross-shard query execution"""
        mock_manager = Mock()
        mock_manager.get_all_shards.return_value = ["shard_001", "shard_002"]
        mock_manager.execute_on_all_shards.return_value = {
            "shard_001": {"count": 50},
            "shard_002": {"count": 75}
        }
        mock_get_manager.return_value = mock_manager

        service = ShardedDatabaseService()

        def test_query(session):
            return {"count": 50}

        results = service.execute_cross_shard_query(test_query)
        assert "shard_001" in results
        assert "shard_002" in results

    @patch('app.core.database_sharded.get_shard_manager')
    def test_shard_health_check(self, mock_get_manager):
        """Test shard health checking"""
        mock_manager = Mock()
        mock_manager.get_all_shards.return_value = ["shard_001"]

        mock_session = Mock()
        mock_session.execute.return_value.scalar.return_value = 1
        mock_manager.get_session.return_value = mock_session

        mock_get_manager.return_value = mock_manager

        service = ShardedDatabaseService()
        health_stats = service.check_shard_health()

        assert "shard_001" in health_stats
        assert health_stats["shard_001"]["status"] == "healthy"

    @patch('app.core.database_sharded.get_shard_manager')
    def test_rebalance_check(self, mock_get_manager):
        """Test rebalance check logic"""
        mock_manager = Mock()
        mock_get_manager.return_value = mock_manager

        service = ShardedDatabaseService()

        # Mock statistics showing imbalanced shards
        with patch.object(service, 'get_shard_statistics') as mock_stats:
            mock_stats.return_value = {
                "shard_001": {"document_count": 100},
                "shard_002": {"document_count": 200}  # 100% more documents
            }

            rebalance_info = service.rebalance_check()
            assert rebalance_info["needs_rebalancing"] == True
            assert rebalance_info["max_documents"] == 200
            assert rebalance_info["min_documents"] == 100


class TestAutoScalingService:
    """Tests for auto-scaling service"""

    def test_auto_scaling_service_initialization(self):
        """Test auto-scaling service initialization"""
        thresholds = MetricThresholds(
            cpu_scale_up=70.0,
            memory_scale_up=80.0,
            min_instances=1,
            max_instances=5
        )

        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService(thresholds)
            assert service.thresholds.cpu_scale_up == 70.0
            assert service.thresholds.max_instances == 5

    @pytest.mark.asyncio
    async def test_metrics_collection(self):
        """Test system metrics collection"""
        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'), \
             patch('app.services.auto_scaling_service.psutil.cpu_percent', return_value=45.0), \
             patch('app.services.auto_scaling_service.psutil.virtual_memory') as mock_memory, \
             patch('app.services.auto_scaling_service.psutil.disk_usage') as mock_disk, \
             patch('app.services.auto_scaling_service.psutil.net_io_counters') as mock_net:

            mock_memory.return_value.percent = 60.0
            mock_disk.return_value.used = 500 * 1024**3  # 500GB
            mock_disk.return_value.total = 1000 * 1024**3  # 1TB
            mock_net.return_value.bytes_sent = 1000000
            mock_net.return_value.bytes_recv = 2000000

            service = AutoScalingService()

            with patch.object(service, '_get_active_connections', return_value=25), \
                 patch.object(service, '_get_average_response_time', return_value=150.0), \
                 patch.object(service, '_get_error_rate', return_value=2.5), \
                 patch.object(service, '_get_queue_length', return_value=10):

                metrics = await service.collect_metrics()

                assert metrics.cpu_usage == 45.0
                assert metrics.memory_usage == 60.0
                assert metrics.disk_usage == 50.0
                assert metrics.active_connections == 25
                assert metrics.response_time_avg == 150.0
                assert metrics.error_rate == 2.5
                assert metrics.queue_length == 10

    @pytest.mark.asyncio
    async def test_scaling_decision_scale_up(self):
        """Test scaling decision for scale up scenario"""
        thresholds = MetricThresholds(
            cpu_scale_up=80.0,
            memory_scale_up=85.0,
            response_time_scale_up=1000.0,
            max_instances=5
        )

        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService(thresholds)

            # Mock high CPU usage
            metrics = SystemMetrics(
                cpu_usage=90.0,  # Above threshold
                memory_usage=60.0,
                disk_usage=50.0,
                network_io={},
                active_connections=50,
                response_time_avg=500.0,
                error_rate=1.0,
                queue_length=5,
                timestamp=time.time()
            )

            with patch.object(service, '_get_current_instances', return_value=2):
                decisions = await service.analyze_scaling_needs(metrics)

                assert decisions["backend"] == ScaleDirection.UP
                assert decisions["frontend"] == ScaleDirection.UP

    @pytest.mark.asyncio
    async def test_scaling_decision_scale_down(self):
        """Test scaling decision for scale down scenario"""
        thresholds = MetricThresholds(
            cpu_scale_down=30.0,
            memory_scale_down=40.0,
            min_instances=2
        )

        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService(thresholds)

            # Mock low resource usage
            metrics = SystemMetrics(
                cpu_usage=20.0,  # Below threshold
                memory_usage=25.0,  # Below threshold
                disk_usage=30.0,
                network_io={},
                active_connections=10,  # Low connections
                response_time_avg=100.0,  # Good response time
                error_rate=0.1,
                queue_length=2,  # Low queue
                timestamp=time.time()
            )

            with patch.object(service, '_get_current_instances', return_value=4):
                decisions = await service.analyze_scaling_needs(metrics)

                assert decisions["backend"] == ScaleDirection.DOWN

    @pytest.mark.asyncio
    async def test_scaling_cooldown_period(self):
        """Test that scaling cooldown period is respected"""
        thresholds = MetricThresholds(
            cpu_scale_up=80.0,
            scale_cooldown=300  # 5 minutes
        )

        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService(thresholds)

            # Set recent scaling time
            service.last_scale_time["backend"] = time.time() - 60  # 1 minute ago

            metrics = SystemMetrics(
                cpu_usage=90.0,  # Above threshold
                memory_usage=60.0,
                disk_usage=50.0,
                network_io={},
                active_connections=50,
                response_time_avg=500.0,
                error_rate=1.0,
                queue_length=5,
                timestamp=time.time()
            )

            with patch.object(service, '_get_current_instances', return_value=2):
                decisions = await service.analyze_scaling_needs(metrics)

                # Should not scale due to cooldown
                assert decisions["backend"] == ScaleDirection.NONE

    @pytest.mark.asyncio
    async def test_scaling_execution(self):
        """Test scaling execution"""
        with patch('app.services.auto_scaling_service.docker.from_env') as mock_docker, \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):

            mock_client = Mock()
            mock_docker.return_value = mock_client

            service = AutoScalingService()

            metrics = SystemMetrics(
                cpu_usage=90.0,
                memory_usage=60.0,
                disk_usage=50.0,
                network_io={},
                active_connections=50,
                response_time_avg=500.0,
                error_rate=1.0,
                queue_length=5,
                timestamp=time.time()
            )

            with patch.object(service, '_get_current_instances', return_value=2), \
                 patch.object(service, '_scale_service') as mock_scale:

                await service.execute_scaling("backend", ScaleDirection.UP, metrics)

                mock_scale.assert_called_once_with("backend", 3)
                assert len(service.scaling_history) == 1
                assert service.scaling_history[0].action == ScaleDirection.UP

    def test_scaling_history_tracking(self):
        """Test scaling history tracking"""
        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService()

            # Get history (should be empty initially)
            history = service.get_scaling_history()
            assert len(history) == 0

            # Add some mock history
            metrics = SystemMetrics(
                cpu_usage=90.0, memory_usage=60.0, disk_usage=50.0,
                network_io={}, active_connections=50, response_time_avg=500.0,
                error_rate=1.0, queue_length=5, timestamp=time.time()
            )

            from app.services.auto_scaling_service import ScalingEvent
            event = ScalingEvent(
                timestamp=time.time(),
                action=ScaleDirection.UP,
                service="backend",
                instances_before=2,
                instances_after=3,
                reason="High CPU usage",
                metrics=metrics
            )

            service.scaling_history.append(event)

            history = service.get_scaling_history()
            assert len(history) == 1
            assert history[0].action == ScaleDirection.UP

    def test_scaling_status_reporting(self):
        """Test scaling status reporting"""
        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService()

            status = service.get_current_status()

            assert "is_running" in status
            assert "thresholds" in status
            assert "last_scale_times" in status
            assert "total_scaling_events" in status

            assert status["is_running"] == False  # Not started
            assert status["total_scaling_events"] == 0

    @pytest.mark.asyncio
    async def test_threshold_updates(self):
        """Test updating scaling thresholds"""
        with patch('app.services.auto_scaling_service.docker.from_env'), \
             patch('app.services.auto_scaling_service.redis.Redis.from_url'):
            service = AutoScalingService()

            original_cpu_threshold = service.thresholds.cpu_scale_up

            new_thresholds = {
                "cpu_scale_up": 75.0,
                "memory_scale_up": 90.0
            }

            await service.update_thresholds(new_thresholds)

            assert service.thresholds.cpu_scale_up == 75.0
            assert service.thresholds.memory_scale_up == 90.0


class TestScalingAPI:
    """Tests for scaling API endpoints"""

    def test_auto_scaling_config_validation(self):
        """Test auto-scaling configuration validation"""
        # Valid configuration
        valid_config = AutoScalingConfig(
            cpu_scale_up=80.0,
            cpu_scale_down=30.0,
            memory_scale_up=85.0,
            memory_scale_down=40.0,
            min_instances=2,
            max_instances=10,
            scale_cooldown=300
        )

        assert valid_config.cpu_scale_up == 80.0
        assert valid_config.min_instances == 2

        # Test validation boundaries
        with pytest.raises(ValueError):
            # CPU threshold too high
            AutoScalingConfig(cpu_scale_up=150.0)

        with pytest.raises(ValueError):
            # Negative instances
            AutoScalingConfig(min_instances=-1)

    def test_scaling_recommendation_logic(self):
        """Test scaling recommendation generation"""
        # This would be tested with the actual API endpoint
        # but we can test the logic here

        metrics = SystemMetrics(
            cpu_usage=85.0,  # High CPU
            memory_usage=60.0,
            disk_usage=50.0,
            network_io={},
            active_connections=50,
            response_time_avg=1200.0,  # High response time
            error_rate=1.0,
            queue_length=5,
            timestamp=time.time()
        )

        thresholds = MetricThresholds()

        # Based on metrics, should recommend scaling up
        should_scale_up = (
            metrics.cpu_usage > thresholds.cpu_scale_up or
            metrics.response_time_avg > thresholds.response_time_scale_up
        )

        assert should_scale_up == True

    def test_shard_statistics_format(self):
        """Test shard statistics format"""
        from app.schemas.scaling import ShardStatistics, TableSize

        table_sizes = [
            TableSize(table="documents", size="100 MB"),
            TableSize(table="users", size="50 MB")
        ]

        stats = ShardStatistics(
            shard_id="shard_001",
            document_count=1000,
            user_count=50,
            database_size="150 MB",
            table_sizes=table_sizes
        )

        assert stats.shard_id == "shard_001"
        assert stats.document_count == 1000
        assert len(stats.table_sizes) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])