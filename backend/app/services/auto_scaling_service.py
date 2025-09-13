"""
Auto-scaling service for CA-DMS horizontal scaling
Monitors system metrics and automatically scales resources based on usage patterns
"""
import asyncio
import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import docker
import psutil
import redis
from sqlalchemy import text
from app.core.config import settings
from app.core.database_sharded import get_sharded_db
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


class ScaleDirection(Enum):
    UP = "up"
    DOWN = "down"
    NONE = "none"


@dataclass
class MetricThresholds:
    """Thresholds for auto-scaling decisions"""
    cpu_scale_up: float = 80.0      # Scale up if CPU > 80%
    cpu_scale_down: float = 30.0    # Scale down if CPU < 30%
    memory_scale_up: float = 85.0   # Scale up if Memory > 85%
    memory_scale_down: float = 40.0 # Scale down if Memory < 40%
    response_time_scale_up: float = 1000.0  # Scale up if avg response > 1000ms
    connections_scale_up: int = 80  # Scale up if connections > 80% of max
    connections_scale_down: int = 20  # Scale down if connections < 20% of max
    min_instances: int = 2          # Minimum number of instances
    max_instances: int = 10         # Maximum number of instances
    scale_cooldown: int = 300       # Cooldown period in seconds (5 minutes)


@dataclass
class SystemMetrics:
    """Current system metrics"""
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, float]
    active_connections: int
    response_time_avg: float
    error_rate: float
    queue_length: int
    timestamp: float


@dataclass
class ScalingEvent:
    """Record of a scaling event"""
    timestamp: float
    action: ScaleDirection
    service: str
    instances_before: int
    instances_after: int
    reason: str
    metrics: SystemMetrics


class AutoScalingService:
    """Handles automatic scaling of CA-DMS services"""

    def __init__(self, thresholds: MetricThresholds = None):
        self.thresholds = thresholds or MetricThresholds()
        self.docker_client = docker.from_env()
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL or "redis://localhost:6379")
        self.scaling_history: List[ScalingEvent] = []
        self.last_scale_time: Dict[str, float] = {}
        self.is_running = False

    async def start_monitoring(self):
        """Start the auto-scaling monitoring loop"""
        self.is_running = True
        logger.info("Auto-scaling service started")

        while self.is_running:
            try:
                metrics = await self.collect_metrics()
                scaling_decisions = await self.analyze_scaling_needs(metrics)

                for service, decision in scaling_decisions.items():
                    if decision != ScaleDirection.NONE:
                        await self.execute_scaling(service, decision, metrics)

                # Wait before next check (30 seconds)
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Error in auto-scaling loop: {e}")
                await asyncio.sleep(60)  # Wait longer on error

    def stop_monitoring(self):
        """Stop the auto-scaling monitoring"""
        self.is_running = False
        logger.info("Auto-scaling service stopped")

    async def collect_metrics(self) -> SystemMetrics:
        """Collect current system metrics"""
        try:
            # System-level metrics
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            net_io = psutil.net_io_counters()

            # Application-level metrics
            active_connections = await self._get_active_connections()
            response_time_avg = await self._get_average_response_time()
            error_rate = await self._get_error_rate()
            queue_length = await self._get_queue_length()

            return SystemMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory.percent,
                disk_usage=(disk.used / disk.total) * 100,
                network_io={
                    "bytes_sent": net_io.bytes_sent,
                    "bytes_recv": net_io.bytes_recv,
                    "packets_sent": net_io.packets_sent,
                    "packets_recv": net_io.packets_recv
                },
                active_connections=active_connections,
                response_time_avg=response_time_avg,
                error_rate=error_rate,
                queue_length=queue_length,
                timestamp=time.time()
            )

        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return SystemMetrics(
                cpu_usage=0, memory_usage=0, disk_usage=0,
                network_io={}, active_connections=0,
                response_time_avg=0, error_rate=0, queue_length=0,
                timestamp=time.time()
            )

    async def _get_active_connections(self) -> int:
        """Get number of active database connections"""
        try:
            db_service = get_sharded_db()
            health_stats = db_service.check_shard_health()

            total_connections = 0
            for shard_stats in health_stats.values():
                if "active_connections" in shard_stats:
                    total_connections += shard_stats["active_connections"]

            return total_connections
        except Exception:
            return 0

    async def _get_average_response_time(self) -> float:
        """Get average response time from cache metrics"""
        try:
            # Get response time metrics from Redis
            response_times = await cache_service.get("metrics:response_times")
            if response_times:
                return sum(response_times) / len(response_times)
            return 0.0
        except Exception:
            return 0.0

    async def _get_error_rate(self) -> float:
        """Get current error rate percentage"""
        try:
            # Get error rate from cache metrics
            error_rate = await cache_service.get("metrics:error_rate")
            return error_rate or 0.0
        except Exception:
            return 0.0

    async def _get_queue_length(self) -> int:
        """Get current queue length for background tasks"""
        try:
            # Check Redis queue length
            queue_length = self.redis_client.llen("task_queue")
            return queue_length
        except Exception:
            return 0

    async def analyze_scaling_needs(self, metrics: SystemMetrics) -> Dict[str, ScaleDirection]:
        """Analyze metrics and determine scaling needs"""
        decisions = {}

        # Check each service type
        services = ["backend", "frontend", "worker"]

        for service in services:
            current_instances = await self._get_current_instances(service)
            decision = ScaleDirection.NONE

            # Check if we're in cooldown period
            last_scale = self.last_scale_time.get(service, 0)
            if time.time() - last_scale < self.thresholds.scale_cooldown:
                decisions[service] = ScaleDirection.NONE
                continue

            # Scale up conditions
            should_scale_up = (
                metrics.cpu_usage > self.thresholds.cpu_scale_up or
                metrics.memory_usage > self.thresholds.memory_scale_up or
                metrics.response_time_avg > self.thresholds.response_time_scale_up or
                metrics.active_connections > self.thresholds.connections_scale_up or
                metrics.queue_length > 50  # High queue length
            )

            # Scale down conditions
            should_scale_down = (
                metrics.cpu_usage < self.thresholds.cpu_scale_down and
                metrics.memory_usage < self.thresholds.memory_scale_down and
                metrics.response_time_avg < 200 and  # Good response time
                metrics.active_connections < self.thresholds.connections_scale_down and
                metrics.queue_length < 5  # Low queue length
            )

            if should_scale_up and current_instances < self.thresholds.max_instances:
                decision = ScaleDirection.UP
            elif should_scale_down and current_instances > self.thresholds.min_instances:
                decision = ScaleDirection.DOWN

            decisions[service] = decision

        return decisions

    async def execute_scaling(self, service: str, direction: ScaleDirection, metrics: SystemMetrics) -> bool:
        """Execute scaling action for a service"""
        try:
            # Check cooldown period first
            last_scale = self.last_scale_time.get(service, 0)
            if time.time() - last_scale < self.thresholds.scale_cooldown:
                logger.info(f"Scaling {service} blocked by cooldown period")
                return False

            current_instances = await self._get_current_instances(service)

            if direction == ScaleDirection.UP:
                new_instances = min(current_instances + 1, self.thresholds.max_instances)
                if new_instances == current_instances:
                    return False  # Already at max
                await self._scale_service(service, new_instances)
                reason = f"High resource usage: CPU={metrics.cpu_usage}%, Memory={metrics.memory_usage}%, Response={metrics.response_time_avg}ms"

            elif direction == ScaleDirection.DOWN:
                new_instances = max(current_instances - 1, self.thresholds.min_instances)
                if new_instances == current_instances:
                    return False  # Already at min
                await self._scale_service(service, new_instances)
                reason = f"Low resource usage: CPU={metrics.cpu_usage}%, Memory={metrics.memory_usage}%"

            else:
                return False

            # Record scaling event
            event = ScalingEvent(
                timestamp=time.time(),
                action=direction,
                service=service,
                instances_before=current_instances,
                instances_after=new_instances,
                reason=reason,
                metrics=metrics
            )

            self.scaling_history.append(event)
            self.last_scale_time[service] = time.time()

            logger.info(f"Scaled {service} {direction.value}: {current_instances} -> {new_instances}. Reason: {reason}")
            return True

        except Exception as e:
            logger.error(f"Error executing scaling for {service}: {e}")
            return False

    async def _get_current_instances(self, service: str) -> int:
        """Get current number of instances for a service"""
        try:
            containers = self.docker_client.containers.list(
                filters={"label": f"service={service}"}
            )
            return len(containers)
        except Exception:
            return 0  # Default to 0 if we can't determine (Docker unavailable)

    async def _scale_service(self, service: str, target_instances: int):
        """Scale a service to target number of instances"""
        try:
            current_instances = await self._get_current_instances(service)

            if target_instances > current_instances:
                # Scale up - start new instances
                for i in range(target_instances - current_instances):
                    await self._start_new_instance(service)

            elif target_instances < current_instances:
                # Scale down - stop instances
                containers = self.docker_client.containers.list(
                    filters={"label": f"service={service}"}
                )

                # Stop the excess containers (newest first)
                containers_to_stop = containers[target_instances:]
                for container in containers_to_stop:
                    container.stop(timeout=30)
                    logger.info(f"Stopped {service} container: {container.id[:12]}")

        except Exception as e:
            logger.error(f"Error scaling {service}: {e}")

    async def _start_new_instance(self, service: str) -> bool:
        """Start a new instance of a service"""
        try:
            # Get base configuration from existing container
            existing_containers = self.docker_client.containers.list(
                filters={"label": f"service={service}"},
                limit=1
            )

            if not existing_containers:
                logger.error(f"No existing {service} containers found for template")
                return False

            base_container = existing_containers[0]
            image = base_container.image

            # Create new container with same configuration
            new_container = self.docker_client.containers.run(
                image=image.id,
                detach=True,
                labels={
                    "service": service,
                    "auto_scaled": "true",
                    "created_at": str(time.time())
                },
                environment=base_container.attrs["Config"]["Env"],
                network_mode=base_container.attrs["HostConfig"]["NetworkMode"],
                restart_policy={"Name": "unless-stopped"}
            )

            logger.info(f"Started new {service} instance: {new_container.id[:12]}")
            return True

        except Exception as e:
            logger.error(f"Error starting new {service} instance: {e}")
            return False

    def get_scaling_history(self, limit: int = 50) -> List[ScalingEvent]:
        """Get recent scaling history"""
        return self.scaling_history[-limit:]

    def get_current_status(self) -> Dict[str, Any]:
        """Get current auto-scaling status"""
        return {
            "is_running": self.is_running,
            "thresholds": {
                "cpu_scale_up": self.thresholds.cpu_scale_up,
                "cpu_scale_down": self.thresholds.cpu_scale_down,
                "memory_scale_up": self.thresholds.memory_scale_up,
                "memory_scale_down": self.thresholds.memory_scale_down,
                "min_instances": self.thresholds.min_instances,
                "max_instances": self.thresholds.max_instances,
                "scale_cooldown": self.thresholds.scale_cooldown
            },
            "last_scale_times": self.last_scale_time,
            "total_scaling_events": len(self.scaling_history),
            "recent_events": self.get_scaling_history(5)  # Last 5 events
        }

    async def update_thresholds(self, new_thresholds: Dict[str, Any]):
        """Update scaling thresholds"""
        for key, value in new_thresholds.items():
            if hasattr(self.thresholds, key):
                setattr(self.thresholds, key, value)
                logger.info(f"Updated threshold {key} to {value}")


# Global auto-scaling service instance
auto_scaling_service: Optional[AutoScalingService] = None


def get_auto_scaling_service() -> AutoScalingService:
    """Get the global auto-scaling service instance"""
    global auto_scaling_service
    if auto_scaling_service is None:
        auto_scaling_service = AutoScalingService()
    return auto_scaling_service