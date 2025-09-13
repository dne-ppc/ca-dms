"""
API endpoints for horizontal scaling management
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.database_sharded import get_sharded_db
from app.services.auto_scaling_service import get_auto_scaling_service, MetricThresholds
from app.schemas.scaling import (
    ScalingStatus,
    ScalingHistory,
    ShardStatistics,
    AutoScalingConfig,
    SystemMetrics as SystemMetricsSchema
)
from app.models.user import User
from app.core.dependencies import get_current_user
import asyncio

router = APIRouter()


@router.get("/status", response_model=ScalingStatus)
async def get_scaling_status(
    current_user: User = Depends(get_current_user)
):
    """Get current auto-scaling status"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()
    status = scaling_service.get_current_status()

    return ScalingStatus(**status)


@router.get("/metrics", response_model=SystemMetricsSchema)
async def get_current_metrics(
    current_user: User = Depends(get_current_user)
):
    """Get current system metrics"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()
    metrics = await scaling_service.collect_metrics()

    return SystemMetricsSchema(
        cpu_usage=metrics.cpu_usage,
        memory_usage=metrics.memory_usage,
        disk_usage=metrics.disk_usage,
        network_io=metrics.network_io,
        active_connections=metrics.active_connections,
        response_time_avg=metrics.response_time_avg,
        error_rate=metrics.error_rate,
        queue_length=metrics.queue_length,
        timestamp=metrics.timestamp
    )


@router.get("/history", response_model=List[ScalingHistory])
async def get_scaling_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get scaling event history"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()
    history = scaling_service.get_scaling_history(limit)

    return [
        ScalingHistory(
            timestamp=event.timestamp,
            action=event.action.value,
            service=event.service,
            instances_before=event.instances_before,
            instances_after=event.instances_after,
            reason=event.reason,
            cpu_usage=event.metrics.cpu_usage,
            memory_usage=event.metrics.memory_usage,
            response_time=event.metrics.response_time_avg
        )
        for event in history
    ]


@router.get("/shards/statistics", response_model=Dict[str, ShardStatistics])
async def get_shard_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get statistics for all database shards"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    db_service = get_sharded_db()
    stats = db_service.get_shard_statistics()

    result = {}
    for shard_id, shard_stats in stats.items():
        if "error" not in shard_stats:
            result[shard_id] = ShardStatistics(
                shard_id=shard_stats["shard_id"],
                document_count=shard_stats["document_count"],
                user_count=shard_stats["user_count"],
                database_size=shard_stats["database_size"],
                table_sizes=shard_stats["table_sizes"]
            )

    return result


@router.get("/shards/health")
async def get_shard_health(
    current_user: User = Depends(get_current_user)
):
    """Get health status of all database shards"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    db_service = get_sharded_db()
    health_stats = db_service.check_shard_health()

    return health_stats


@router.get("/shards/rebalance-check")
async def check_rebalance_needed(
    current_user: User = Depends(get_current_user)
):
    """Check if database shards need rebalancing"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    db_service = get_sharded_db()
    rebalance_info = db_service.rebalance_check()

    return rebalance_info


@router.post("/start")
async def start_auto_scaling(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Start auto-scaling service"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()

    if scaling_service.is_running:
        raise HTTPException(status_code=400, detail="Auto-scaling is already running")

    # Start monitoring in background
    background_tasks.add_task(scaling_service.start_monitoring)

    return {"message": "Auto-scaling service started"}


@router.post("/stop")
async def stop_auto_scaling(
    current_user: User = Depends(get_current_user)
):
    """Stop auto-scaling service"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()

    if not scaling_service.is_running:
        raise HTTPException(status_code=400, detail="Auto-scaling is not running")

    scaling_service.stop_monitoring()

    return {"message": "Auto-scaling service stopped"}


@router.put("/config", response_model=AutoScalingConfig)
async def update_scaling_config(
    config: AutoScalingConfig,
    current_user: User = Depends(get_current_user)
):
    """Update auto-scaling configuration"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()

    # Update thresholds
    threshold_updates = {
        "cpu_scale_up": config.cpu_scale_up,
        "cpu_scale_down": config.cpu_scale_down,
        "memory_scale_up": config.memory_scale_up,
        "memory_scale_down": config.memory_scale_down,
        "response_time_scale_up": config.response_time_scale_up,
        "connections_scale_up": config.connections_scale_up,
        "connections_scale_down": config.connections_scale_down,
        "min_instances": config.min_instances,
        "max_instances": config.max_instances,
        "scale_cooldown": config.scale_cooldown
    }

    await scaling_service.update_thresholds(threshold_updates)

    return config


@router.get("/config", response_model=AutoScalingConfig)
async def get_scaling_config(
    current_user: User = Depends(get_current_user)
):
    """Get current auto-scaling configuration"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()
    thresholds = scaling_service.thresholds

    return AutoScalingConfig(
        cpu_scale_up=thresholds.cpu_scale_up,
        cpu_scale_down=thresholds.cpu_scale_down,
        memory_scale_up=thresholds.memory_scale_up,
        memory_scale_down=thresholds.memory_scale_down,
        response_time_scale_up=thresholds.response_time_scale_up,
        connections_scale_up=thresholds.connections_scale_up,
        connections_scale_down=thresholds.connections_scale_down,
        min_instances=thresholds.min_instances,
        max_instances=thresholds.max_instances,
        scale_cooldown=thresholds.scale_cooldown
    )


@router.post("/manual-scale/{service}")
async def manual_scale_service(
    service: str,
    instances: int,
    current_user: User = Depends(get_current_user)
):
    """Manually scale a specific service"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    valid_services = ["backend", "frontend", "worker"]
    if service not in valid_services:
        raise HTTPException(status_code=400, detail=f"Service must be one of: {valid_services}")

    if instances < 1 or instances > 20:
        raise HTTPException(status_code=400, detail="Instances must be between 1 and 20")

    scaling_service = get_auto_scaling_service()

    try:
        await scaling_service._scale_service(service, instances)
        return {"message": f"Manually scaled {service} to {instances} instances"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scale service: {str(e)}")


@router.get("/recommendations")
async def get_scaling_recommendations(
    current_user: User = Depends(get_current_user)
):
    """Get scaling recommendations based on current metrics"""
    if not current_user.has_permission("admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    scaling_service = get_auto_scaling_service()
    metrics = await scaling_service.collect_metrics()
    decisions = await scaling_service.analyze_scaling_needs(metrics)

    recommendations = []
    for service, decision in decisions.items():
        current_instances = await scaling_service._get_current_instances(service)

        if decision.value != "none":
            if decision.value == "up":
                recommended_instances = min(current_instances + 1, scaling_service.thresholds.max_instances)
                reason = "High resource usage detected"
            else:
                recommended_instances = max(current_instances - 1, scaling_service.thresholds.min_instances)
                reason = "Low resource usage detected"

            recommendations.append({
                "service": service,
                "current_instances": current_instances,
                "recommended_instances": recommended_instances,
                "action": decision.value,
                "reason": reason,
                "confidence": "high" if abs(current_instances - recommended_instances) == 1 else "medium"
            })

    return {
        "recommendations": recommendations,
        "current_metrics": {
            "cpu_usage": metrics.cpu_usage,
            "memory_usage": metrics.memory_usage,
            "response_time": metrics.response_time_avg,
            "active_connections": metrics.active_connections,
            "queue_length": metrics.queue_length
        }
    }