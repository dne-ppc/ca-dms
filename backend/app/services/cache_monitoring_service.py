"""
Cache Monitoring and Metrics Service

Provides comprehensive monitoring, metrics collection, and alerting
for cache performance across the CA-DMS application.
"""

import time
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum
import asyncio

from app.services.cache_service import cache_service


logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of cache metrics"""
    HIT_RATE = "hit_rate"
    MISS_RATE = "miss_rate"
    RESPONSE_TIME = "response_time"
    MEMORY_USAGE = "memory_usage"
    CONNECTION_COUNT = "connection_count"
    OPERATIONS_PER_SECOND = "operations_per_second"
    ERROR_RATE = "error_rate"
    CACHE_SIZE = "cache_size"


class AlertLevel(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class CacheMetric:
    """Represents a single cache metric data point"""
    metric_type: MetricType
    value: float
    timestamp: datetime
    cache_type: str
    additional_data: Dict[str, Any] = None

    def __post_init__(self):
        if self.additional_data is None:
            self.additional_data = {}


@dataclass
class CacheAlert:
    """Represents a cache performance alert"""
    alert_id: str
    level: AlertLevel
    metric_type: MetricType
    message: str
    threshold: float
    current_value: float
    cache_type: str
    timestamp: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class CacheMonitoringService:
    """Comprehensive cache monitoring and metrics service"""

    def __init__(self):
        # Metrics storage (in production, this would use a time-series database)
        self.metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.alerts: List[CacheAlert] = []
        self.max_alerts = 100

        # Performance counters
        self.operation_counters: Dict[str, int] = defaultdict(int)
        self.error_counters: Dict[str, int] = defaultdict(int)
        self.response_times: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

        # Alert thresholds
        self.alert_thresholds = {
            MetricType.HIT_RATE: {"warning": 80.0, "critical": 60.0},  # Percentage
            MetricType.MISS_RATE: {"warning": 20.0, "critical": 40.0},  # Percentage
            MetricType.RESPONSE_TIME: {"warning": 100.0, "critical": 500.0},  # Milliseconds
            MetricType.MEMORY_USAGE: {"warning": 80.0, "critical": 90.0},  # Percentage
            MetricType.ERROR_RATE: {"warning": 5.0, "critical": 10.0},  # Percentage
            MetricType.CONNECTION_COUNT: {"warning": 80, "critical": 95}  # Count
        }

        # Monitoring state
        self.monitoring_enabled = True
        self.last_collection_time = datetime.utcnow()
        self.collection_interval_seconds = 60  # Collect metrics every minute

        # Background monitoring task (started explicitly)
        self._background_task = None

    def start_background_monitoring(self):
        """Start background metric collection"""
        if self._background_task is None:
            try:
                loop = asyncio.get_running_loop()
                self._background_task = loop.create_task(self._background_metrics_collector())
            except RuntimeError:
                # No event loop running, monitoring will be started when one exists
                logger.info("No event loop running, background monitoring will start when available")

    def stop_background_monitoring(self):
        """Stop background metric collection"""
        if self._background_task:
            self._background_task.cancel()
            self._background_task = None

    async def _background_metrics_collector(self):
        """Background task for periodic metrics collection"""
        while self.monitoring_enabled:
            try:
                await self.collect_all_metrics()
                await asyncio.sleep(self.collection_interval_seconds)
            except Exception as e:
                logger.error(f"Background metrics collection failed: {e}")
                await asyncio.sleep(30)  # Retry after 30 seconds on error

    async def collect_all_metrics(self):
        """Collect all cache metrics"""
        if not self.monitoring_enabled:
            return

        try:
            # Collect Redis metrics
            await self._collect_redis_metrics()

            # Collect application-level cache metrics
            await self._collect_application_metrics()

            # Check alert conditions
            await self._check_alert_conditions()

            self.last_collection_time = datetime.utcnow()

        except Exception as e:
            logger.error(f"Metrics collection failed: {e}")

    async def _collect_redis_metrics(self):
        """Collect Redis-specific metrics"""
        try:
            stats = await cache_service.get_stats()
            if not stats:
                return

            current_time = datetime.utcnow()

            # Hit rate metric
            hit_rate_metric = CacheMetric(
                metric_type=MetricType.HIT_RATE,
                value=stats.hit_rate,
                timestamp=current_time,
                cache_type="redis"
            )
            self._store_metric(hit_rate_metric)

            # Miss rate metric
            miss_rate = 100.0 - stats.hit_rate
            miss_rate_metric = CacheMetric(
                metric_type=MetricType.MISS_RATE,
                value=miss_rate,
                timestamp=current_time,
                cache_type="redis"
            )
            self._store_metric(miss_rate_metric)

            # Memory usage metric
            try:
                # Parse memory usage (e.g., "1.5MB" -> 1.5)
                memory_str = stats.memory_usage.replace('MB', '').replace('KB', '').replace('GB', '')
                if 'MB' in stats.memory_usage:
                    memory_mb = float(memory_str)
                elif 'KB' in stats.memory_usage:
                    memory_mb = float(memory_str) / 1024
                elif 'GB' in stats.memory_usage:
                    memory_mb = float(memory_str) * 1024
                else:
                    memory_mb = float(memory_str)

                # Assume a reasonable max memory limit for percentage calculation
                max_memory_mb = 1024  # 1GB default
                memory_percentage = (memory_mb / max_memory_mb) * 100

                memory_metric = CacheMetric(
                    metric_type=MetricType.MEMORY_USAGE,
                    value=memory_percentage,
                    timestamp=current_time,
                    cache_type="redis",
                    additional_data={"memory_mb": memory_mb, "memory_str": stats.memory_usage}
                )
                self._store_metric(memory_metric)

            except (ValueError, AttributeError):
                logger.debug("Could not parse memory usage from Redis stats")

            # Cache size metric
            cache_size_metric = CacheMetric(
                metric_type=MetricType.CACHE_SIZE,
                value=stats.total_keys,
                timestamp=current_time,
                cache_type="redis"
            )
            self._store_metric(cache_size_metric)

        except Exception as e:
            logger.error(f"Redis metrics collection failed: {e}")

    async def _collect_application_metrics(self):
        """Collect application-level cache metrics"""
        try:
            current_time = datetime.utcnow()

            # Calculate operations per second
            total_operations = sum(self.operation_counters.values())
            time_window = self.collection_interval_seconds
            ops_per_second = total_operations / time_window if time_window > 0 else 0

            ops_metric = CacheMetric(
                metric_type=MetricType.OPERATIONS_PER_SECOND,
                value=ops_per_second,
                timestamp=current_time,
                cache_type="application"
            )
            self._store_metric(ops_metric)

            # Calculate error rate
            total_errors = sum(self.error_counters.values())
            error_rate = (total_errors / max(total_operations, 1)) * 100

            error_rate_metric = CacheMetric(
                metric_type=MetricType.ERROR_RATE,
                value=error_rate,
                timestamp=current_time,
                cache_type="application"
            )
            self._store_metric(error_rate_metric)

            # Calculate average response time across all cache types
            all_response_times = []
            for cache_type, times in self.response_times.items():
                all_response_times.extend(times)

            if all_response_times:
                avg_response_time = sum(all_response_times) / len(all_response_times)
                response_time_metric = CacheMetric(
                    metric_type=MetricType.RESPONSE_TIME,
                    value=avg_response_time,
                    timestamp=current_time,
                    cache_type="application"
                )
                self._store_metric(response_time_metric)

            # Reset counters for next collection period
            self.operation_counters.clear()
            self.error_counters.clear()
            for times_queue in self.response_times.values():
                times_queue.clear()

        except Exception as e:
            logger.error(f"Application metrics collection failed: {e}")

    def _store_metric(self, metric: CacheMetric):
        """Store a metric data point"""
        metric_key = f"{metric.cache_type}:{metric.metric_type.value}"
        self.metrics[metric_key].append(metric)

    async def _check_alert_conditions(self):
        """Check if any metrics exceed alert thresholds"""
        try:
            for metric_key, metric_queue in self.metrics.items():
                if not metric_queue:
                    continue

                # Get the most recent metric
                latest_metric = metric_queue[-1]
                metric_type = latest_metric.metric_type

                if metric_type not in self.alert_thresholds:
                    continue

                thresholds = self.alert_thresholds[metric_type]
                current_value = latest_metric.value

                # Check critical threshold
                if current_value > thresholds.get("critical", float('inf')):
                    await self._create_alert(
                        AlertLevel.CRITICAL,
                        metric_type,
                        f"Critical threshold exceeded for {metric_type.value}",
                        thresholds["critical"],
                        current_value,
                        latest_metric.cache_type
                    )
                # Check warning threshold
                elif current_value > thresholds.get("warning", float('inf')):
                    await self._create_alert(
                        AlertLevel.WARNING,
                        metric_type,
                        f"Warning threshold exceeded for {metric_type.value}",
                        thresholds["warning"],
                        current_value,
                        latest_metric.cache_type
                    )

                # Special handling for low hit rate (reverse threshold)
                if metric_type == MetricType.HIT_RATE:
                    if current_value < thresholds.get("critical", 0):
                        await self._create_alert(
                            AlertLevel.CRITICAL,
                            metric_type,
                            f"Hit rate critically low: {current_value:.2f}%",
                            thresholds["critical"],
                            current_value,
                            latest_metric.cache_type
                        )
                    elif current_value < thresholds.get("warning", 0):
                        await self._create_alert(
                            AlertLevel.WARNING,
                            metric_type,
                            f"Hit rate below recommended threshold: {current_value:.2f}%",
                            thresholds["warning"],
                            current_value,
                            latest_metric.cache_type
                        )

        except Exception as e:
            logger.error(f"Alert condition checking failed: {e}")

    async def _create_alert(
        self,
        level: AlertLevel,
        metric_type: MetricType,
        message: str,
        threshold: float,
        current_value: float,
        cache_type: str
    ):
        """Create a new alert"""
        alert_id = f"{cache_type}_{metric_type.value}_{int(time.time())}"

        # Check if similar alert already exists and is unresolved
        existing_alert = None
        for alert in self.alerts:
            if (alert.cache_type == cache_type and
                alert.metric_type == metric_type and
                not alert.resolved):
                existing_alert = alert
                break

        if existing_alert:
            # Update existing alert
            existing_alert.current_value = current_value
            existing_alert.timestamp = datetime.utcnow()
            existing_alert.message = message
        else:
            # Create new alert
            alert = CacheAlert(
                alert_id=alert_id,
                level=level,
                metric_type=metric_type,
                message=message,
                threshold=threshold,
                current_value=current_value,
                cache_type=cache_type,
                timestamp=datetime.utcnow()
            )

            self.alerts.append(alert)

            # Keep alerts list manageable
            if len(self.alerts) > self.max_alerts:
                self.alerts = self.alerts[-self.max_alerts:]

            logger.warning(f"Cache alert created: {level.value} - {message}")

    def record_cache_operation(self, cache_type: str, operation: str, response_time_ms: float, success: bool):
        """Record cache operation metrics"""
        if not self.monitoring_enabled:
            return

        # Increment operation counter
        self.operation_counters[f"{cache_type}:{operation}"] += 1

        # Record response time
        self.response_times[cache_type].append(response_time_ms)

        # Record errors
        if not success:
            self.error_counters[f"{cache_type}:{operation}"] += 1

    async def get_metrics_summary(self, time_window_hours: int = 24) -> Dict[str, Any]:
        """Get summary of cache metrics"""
        cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        summary = {}

        for metric_key, metric_queue in self.metrics.items():
            # Filter metrics within time window
            recent_metrics = [m for m in metric_queue if m.timestamp >= cutoff_time]

            if not recent_metrics:
                continue

            # Calculate statistics
            values = [m.value for m in recent_metrics]
            summary[metric_key] = {
                "current_value": recent_metrics[-1].value,
                "average": sum(values) / len(values),
                "min": min(values),
                "max": max(values),
                "count": len(recent_metrics),
                "trend": self._calculate_trend(values)
            }

        return summary

    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction for metric values"""
        if len(values) < 2:
            return "stable"

        # Compare first and last quartile
        quarter = len(values) // 4
        if quarter == 0:
            return "stable"

        first_quarter_avg = sum(values[:quarter]) / quarter
        last_quarter_avg = sum(values[-quarter:]) / quarter

        difference = last_quarter_avg - first_quarter_avg
        threshold = first_quarter_avg * 0.1  # 10% threshold

        if difference > threshold:
            return "increasing"
        elif difference < -threshold:
            return "decreasing"
        else:
            return "stable"

    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get list of active (unresolved) alerts"""
        active_alerts = [alert for alert in self.alerts if not alert.resolved]

        return [
            {
                "alert_id": alert.alert_id,
                "level": alert.level.value,
                "metric_type": alert.metric_type.value,
                "message": alert.message,
                "threshold": alert.threshold,
                "current_value": alert.current_value,
                "cache_type": alert.cache_type,
                "timestamp": alert.timestamp.isoformat(),
                "age_minutes": (datetime.utcnow() - alert.timestamp).total_seconds() / 60
            }
            for alert in active_alerts
        ]

    async def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert by ID"""
        for alert in self.alerts:
            if alert.alert_id == alert_id and not alert.resolved:
                alert.resolved = True
                alert.resolved_at = datetime.utcnow()
                logger.info(f"Resolved cache alert: {alert_id}")
                return True
        return False

    async def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive cache performance report"""
        metrics_summary = await self.get_metrics_summary()
        active_alerts = await self.get_active_alerts()

        # Calculate overall health score (0-100)
        health_score = 100
        for alert in active_alerts:
            if alert["level"] == "critical":
                health_score -= 20
            elif alert["level"] == "warning":
                health_score -= 5

        health_score = max(0, health_score)

        # Get recommendations
        recommendations = self._generate_recommendations(metrics_summary, active_alerts)

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "health_score": health_score,
            "health_status": self._determine_health_status(health_score),
            "metrics_summary": metrics_summary,
            "active_alerts": active_alerts,
            "alert_counts": {
                "critical": len([a for a in active_alerts if a["level"] == "critical"]),
                "warning": len([a for a in active_alerts if a["level"] == "warning"]),
                "total": len(active_alerts)
            },
            "recommendations": recommendations,
            "monitoring_status": {
                "enabled": self.monitoring_enabled,
                "last_collection": self.last_collection_time.isoformat(),
                "collection_interval_seconds": self.collection_interval_seconds
            }
        }

    def _determine_health_status(self, health_score: int) -> str:
        """Determine overall health status from score"""
        if health_score >= 90:
            return "excellent"
        elif health_score >= 75:
            return "good"
        elif health_score >= 60:
            return "warning"
        else:
            return "critical"

    def _generate_recommendations(self, metrics_summary: Dict[str, Any], active_alerts: List[Dict[str, Any]]) -> List[str]:
        """Generate performance improvement recommendations"""
        recommendations = []

        # Check for low hit rates
        for metric_key, stats in metrics_summary.items():
            if "hit_rate" in metric_key and stats["current_value"] < 80:
                recommendations.append(
                    f"Consider improving cache warming strategies - current hit rate is {stats['current_value']:.1f}%"
                )

        # Check for high response times
        for metric_key, stats in metrics_summary.items():
            if "response_time" in metric_key and stats["current_value"] > 100:
                recommendations.append(
                    f"Optimize cache operations - average response time is {stats['current_value']:.1f}ms"
                )

        # Check for high memory usage
        for metric_key, stats in metrics_summary.items():
            if "memory_usage" in metric_key and stats["current_value"] > 80:
                recommendations.append(
                    f"Consider increasing cache memory or implementing cache eviction policies - memory usage is {stats['current_value']:.1f}%"
                )

        # Alert-specific recommendations
        critical_alerts = [a for a in active_alerts if a["level"] == "critical"]
        if critical_alerts:
            recommendations.append("Address critical alerts immediately to prevent performance degradation")

        # General recommendations
        if len(recommendations) == 0:
            recommendations.append("Cache performance is optimal - continue monitoring")

        return recommendations

    async def update_alert_thresholds(self, metric_type: MetricType, warning: float, critical: float):
        """Update alert thresholds for a metric type"""
        self.alert_thresholds[metric_type] = {
            "warning": warning,
            "critical": critical
        }
        logger.info(f"Updated alert thresholds for {metric_type.value}: warning={warning}, critical={critical}")

    def enable_monitoring(self):
        """Enable metrics monitoring"""
        self.monitoring_enabled = True
        logger.info("Cache monitoring enabled")

    def disable_monitoring(self):
        """Disable metrics monitoring"""
        self.monitoring_enabled = False
        logger.info("Cache monitoring disabled")

    async def export_metrics(self, format: str = "json") -> str:
        """Export metrics data in specified format"""
        if format == "json":
            import json
            metrics_data = {}
            for metric_key, metric_queue in self.metrics.items():
                metrics_data[metric_key] = [
                    {
                        "value": m.value,
                        "timestamp": m.timestamp.isoformat(),
                        "additional_data": m.additional_data
                    }
                    for m in metric_queue
                ]
            return json.dumps(metrics_data, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {format}")


# Global cache monitoring service instance
cache_monitoring_service = CacheMonitoringService()


# Decorator for monitoring cache operations
def monitor_cache_operation(cache_type: str, operation: str):
    """Decorator to monitor cache operation performance"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                raise
            finally:
                end_time = time.time()
                response_time_ms = (end_time - start_time) * 1000
                cache_monitoring_service.record_cache_operation(
                    cache_type, operation, response_time_ms, success
                )
        return wrapper
    return decorator


# Utility functions
async def get_cache_health() -> Dict[str, Any]:
    """Get basic cache health information"""
    try:
        performance_report = await cache_monitoring_service.get_performance_report()
        return {
            "healthy": performance_report["health_score"] > 60,
            "health_score": performance_report["health_score"],
            "status": performance_report["health_status"],
            "active_alerts": len(performance_report["active_alerts"])
        }
    except Exception as e:
        return {
            "healthy": False,
            "error": str(e)
        }