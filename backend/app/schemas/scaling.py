"""
Pydantic schemas for horizontal scaling API
"""
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SystemMetrics(BaseModel):
    """Current system metrics schema"""
    cpu_usage: float = Field(..., description="CPU usage percentage")
    memory_usage: float = Field(..., description="Memory usage percentage")
    disk_usage: float = Field(..., description="Disk usage percentage")
    network_io: Dict[str, float] = Field(..., description="Network I/O statistics")
    active_connections: int = Field(..., description="Number of active database connections")
    response_time_avg: float = Field(..., description="Average response time in milliseconds")
    error_rate: float = Field(..., description="Error rate percentage")
    queue_length: int = Field(..., description="Background task queue length")
    timestamp: float = Field(..., description="Unix timestamp of metrics collection")


class ScalingStatus(BaseModel):
    """Auto-scaling service status"""
    is_running: bool = Field(..., description="Whether auto-scaling is active")
    thresholds: Dict[str, Any] = Field(..., description="Current scaling thresholds")
    last_scale_times: Dict[str, float] = Field(..., description="Last scaling time for each service")
    total_scaling_events: int = Field(..., description="Total number of scaling events")


class ScalingHistory(BaseModel):
    """Scaling event history item"""
    timestamp: float = Field(..., description="Unix timestamp of scaling event")
    action: str = Field(..., description="Scaling action (up/down)")
    service: str = Field(..., description="Service that was scaled")
    instances_before: int = Field(..., description="Number of instances before scaling")
    instances_after: int = Field(..., description="Number of instances after scaling")
    reason: str = Field(..., description="Reason for scaling decision")
    cpu_usage: float = Field(..., description="CPU usage at time of scaling")
    memory_usage: float = Field(..., description="Memory usage at time of scaling")
    response_time: float = Field(..., description="Response time at time of scaling")


class TableSize(BaseModel):
    """Database table size information"""
    table: str = Field(..., description="Table name")
    size: str = Field(..., description="Human-readable table size")


class ShardStatistics(BaseModel):
    """Database shard statistics"""
    shard_id: str = Field(..., description="Shard identifier")
    document_count: int = Field(..., description="Number of documents in shard")
    user_count: int = Field(..., description="Number of users in shard")
    database_size: str = Field(..., description="Human-readable database size")
    table_sizes: List[TableSize] = Field(..., description="Sizes of individual tables")


class ShardHealth(BaseModel):
    """Database shard health status"""
    status: str = Field(..., description="Health status (healthy/unhealthy)")
    response_time_ms: Optional[float] = Field(None, description="Response time in milliseconds")
    long_running_queries: Optional[int] = Field(None, description="Number of long-running queries")
    active_connections: Optional[int] = Field(None, description="Number of active connections")
    error: Optional[str] = Field(None, description="Error message if unhealthy")
    timestamp: float = Field(..., description="Unix timestamp of health check")


class AutoScalingConfig(BaseModel):
    """Auto-scaling configuration"""
    cpu_scale_up: float = Field(80.0, ge=0, le=100, description="CPU threshold for scaling up (%)")
    cpu_scale_down: float = Field(30.0, ge=0, le=100, description="CPU threshold for scaling down (%)")
    memory_scale_up: float = Field(85.0, ge=0, le=100, description="Memory threshold for scaling up (%)")
    memory_scale_down: float = Field(40.0, ge=0, le=100, description="Memory threshold for scaling down (%)")
    response_time_scale_up: float = Field(1000.0, ge=0, description="Response time threshold for scaling up (ms)")
    connections_scale_up: int = Field(80, ge=0, description="Connection threshold for scaling up")
    connections_scale_down: int = Field(20, ge=0, description="Connection threshold for scaling down")
    min_instances: int = Field(2, ge=1, le=50, description="Minimum number of instances")
    max_instances: int = Field(10, ge=1, le=50, description="Maximum number of instances")
    scale_cooldown: int = Field(300, ge=60, le=3600, description="Cooldown period in seconds")

    class Config:
        schema_extra = {
            "example": {
                "cpu_scale_up": 80.0,
                "cpu_scale_down": 30.0,
                "memory_scale_up": 85.0,
                "memory_scale_down": 40.0,
                "response_time_scale_up": 1000.0,
                "connections_scale_up": 80,
                "connections_scale_down": 20,
                "min_instances": 2,
                "max_instances": 10,
                "scale_cooldown": 300
            }
        }


class ScalingRecommendation(BaseModel):
    """Scaling recommendation"""
    service: str = Field(..., description="Service name")
    current_instances: int = Field(..., description="Current number of instances")
    recommended_instances: int = Field(..., description="Recommended number of instances")
    action: str = Field(..., description="Recommended action (up/down/none)")
    reason: str = Field(..., description="Reason for recommendation")
    confidence: str = Field(..., description="Confidence level (high/medium/low)")


class ScalingRecommendationsResponse(BaseModel):
    """Response containing scaling recommendations"""
    recommendations: List[ScalingRecommendation] = Field(..., description="List of scaling recommendations")
    current_metrics: Dict[str, Any] = Field(..., description="Current system metrics")


class ManualScaleRequest(BaseModel):
    """Request for manual scaling"""
    service: str = Field(..., description="Service to scale")
    instances: int = Field(..., ge=1, le=20, description="Target number of instances")


class RebalanceCheck(BaseModel):
    """Database rebalancing check result"""
    needs_rebalancing: bool = Field(..., description="Whether rebalancing is needed")
    average_documents: float = Field(..., description="Average documents per shard")
    max_documents: int = Field(..., description="Maximum documents in any shard")
    min_documents: int = Field(..., description="Minimum documents in any shard")
    imbalance_ratio: float = Field(..., description="Imbalance ratio (0-1)")
    threshold: float = Field(..., description="Imbalance threshold")
    shard_distribution: Dict[str, int] = Field(..., description="Document count per shard")
    reason: Optional[str] = Field(None, description="Reason if rebalancing not needed")


class ShardingConfig(BaseModel):
    """Database sharding configuration"""
    strategy: str = Field(..., description="Sharding strategy (hash_based/range_based/directory_based)")
    shard_count: int = Field(..., description="Number of active shards")
    replication_factor: int = Field(..., description="Replication factor")
    default_shard: str = Field(..., description="Default shard ID")


class LoadBalancerStats(BaseModel):
    """Load balancer statistics"""
    total_requests: int = Field(..., description="Total number of requests")
    requests_per_second: float = Field(..., description="Requests per second")
    average_response_time: float = Field(..., description="Average response time in ms")
    error_rate: float = Field(..., description="Error rate percentage")
    active_connections: int = Field(..., description="Number of active connections")
    backend_status: Dict[str, str] = Field(..., description="Status of each backend server")


class ServiceStatus(BaseModel):
    """Individual service status"""
    service: str = Field(..., description="Service name")
    instances: int = Field(..., description="Number of running instances")
    status: str = Field(..., description="Overall service status")
    cpu_usage: float = Field(..., description="Average CPU usage across instances")
    memory_usage: float = Field(..., description="Average memory usage across instances")
    last_scaled: Optional[float] = Field(None, description="Unix timestamp of last scaling event")


class ClusterStatus(BaseModel):
    """Overall cluster status"""
    total_services: int = Field(..., description="Total number of services")
    total_instances: int = Field(..., description="Total number of instances")
    services: List[ServiceStatus] = Field(..., description="Status of individual services")
    auto_scaling_enabled: bool = Field(..., description="Whether auto-scaling is enabled")
    cluster_health: str = Field(..., description="Overall cluster health (healthy/degraded/unhealthy)")
    last_updated: float = Field(..., description="Unix timestamp of last status update")