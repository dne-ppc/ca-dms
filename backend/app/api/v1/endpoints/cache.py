"""
Cache Management API Endpoints

Provides endpoints for cache monitoring, management, and warming operations.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.services.cache_service import cache_service, CacheStats
from app.services.cached_document_service import CachedDocumentService, warm_document_cache_batch
from app.services.cache_invalidation_service import (
    cache_invalidation_service,
    InvalidationStrategy,
    InvalidationTrigger
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


router = APIRouter()


class CacheWarmRequest(BaseModel):
    """Request model for cache warming"""
    document_ids: Optional[List[str]] = None
    document_types: Optional[List[str]] = None
    batch_size: int = 50


class CacheInvalidateRequest(BaseModel):
    """Request model for cache invalidation"""
    cache_type: str
    keys: Optional[List[str]] = None
    patterns: Optional[List[str]] = None


class ManualInvalidationRequest(BaseModel):
    """Request model for manual cache invalidation"""
    cache_patterns: List[str]
    strategy: str = "immediate"
    context: Optional[Dict[str, Any]] = None


class TriggerInvalidationRequest(BaseModel):
    """Request model for triggering invalidation by event"""
    trigger: str
    context: Optional[Dict[str, Any]] = None


class WarmByRuleRequest(BaseModel):
    """Request model for warming cache by rule"""
    rule_name: str


class WarmByPriorityRequest(BaseModel):
    """Request model for warming cache by priority"""
    priority: str


class UpdateThresholdsRequest(BaseModel):
    """Request model for updating alert thresholds"""
    metric_type: str
    warning: float
    critical: float


class CacheResponse(BaseModel):
    """Standard cache operation response"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


@router.get("/stats", response_model=Dict[str, Any])
async def get_cache_stats():
    """Get comprehensive cache statistics"""
    try:
        stats = await cache_service.get_stats()
        if not stats:
            raise HTTPException(status_code=503, detail="Cache service unavailable")

        return {
            "redis_stats": stats.dict(),
            "cache_status": "connected" if cache_service._is_connected else "disconnected",
            "cache_types": list(cache_service.PREFIXES.keys()),
            "default_ttl_values": cache_service.TTL_VALUES
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")


@router.post("/warm", response_model=CacheResponse)
async def warm_cache(
    request: CacheWarmRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Warm cache with documents"""
    try:
        cached_service = CachedDocumentService(db)

        # Warm specific documents if provided
        if request.document_ids:
            background_tasks.add_task(cached_service.warm_document_cache, request.document_ids)
            message = f"Warming cache for {len(request.document_ids)} specific documents"

        # Warm by document types
        elif request.document_types:
            async def warm_by_types():
                for doc_type in request.document_types:
                    documents = await cached_service.get_documents_by_type_cached(doc_type)
                    doc_ids = [doc.id for doc in documents[:request.batch_size]]
                    if doc_ids:
                        await cached_service.warm_document_cache(doc_ids)

            background_tasks.add_task(warm_by_types)
            message = f"Warming cache for document types: {', '.join(request.document_types)}"

        # Default: warm most recent documents
        else:
            background_tasks.add_task(warm_document_cache_batch, cached_service, request.batch_size)
            message = f"Warming cache for {request.batch_size} recent documents"

        return CacheResponse(
            success=True,
            message=message,
            data={"batch_size": request.batch_size}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache warming failed: {str(e)}")


@router.post("/invalidate", response_model=CacheResponse)
async def invalidate_cache(request: CacheInvalidateRequest):
    """Invalidate cache entries"""
    try:
        invalidated_count = 0

        # Invalidate specific keys
        if request.keys:
            for key in request.keys:
                if await cache_service.delete(request.cache_type, key):
                    invalidated_count += 1

        # Invalidate by patterns
        if request.patterns:
            for pattern in request.patterns:
                count = await cache_service.delete_pattern(request.cache_type, pattern)
                invalidated_count += count

        return CacheResponse(
            success=True,
            message=f"Invalidated {invalidated_count} cache entries",
            data={"invalidated_count": invalidated_count}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache invalidation failed: {str(e)}")


@router.delete("/clear", response_model=CacheResponse)
async def clear_cache():
    """Clear all cache data (use with extreme caution)"""
    try:
        success = await cache_service.clear_all()

        if success:
            return CacheResponse(
                success=True,
                message="All cache data cleared successfully"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to clear cache")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {str(e)}")


@router.get("/health", response_model=CacheResponse)
async def cache_health_check():
    """Check cache service health"""
    try:
        is_connected = cache_service._is_connected

        if not is_connected:
            # Try to reconnect
            is_connected = await cache_service.connect()

        return CacheResponse(
            success=is_connected,
            message="Cache service is healthy" if is_connected else "Cache service is unavailable",
            data={
                "connected": is_connected,
                "redis_host": cache_service._connection_pool.connection_kwargs.get("host") if cache_service._connection_pool else None,
                "redis_port": cache_service._connection_pool.connection_kwargs.get("port") if cache_service._connection_pool else None
            }
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Cache health check failed: {str(e)}"
        )


@router.get("/keys/{cache_type}", response_model=Dict[str, Any])
async def get_cache_keys(cache_type: str, pattern: str = "*"):
    """Get cache keys for a specific cache type"""
    try:
        # Note: This uses Redis KEYS command which can be slow
        # In production, consider maintaining separate key indexes
        full_pattern = cache_service._build_key(cache_type, pattern)

        # This would need to be implemented in cache_service
        # For now, return a placeholder response
        return {
            "cache_type": cache_type,
            "pattern": pattern,
            "message": "Key listing requires Redis KEYS command implementation",
            "warning": "Use with caution in production environments"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache keys: {str(e)}")


@router.get("/memory", response_model=Dict[str, Any])
async def get_cache_memory_usage():
    """Get detailed cache memory usage information"""
    try:
        stats = await cache_service.get_stats()
        if not stats:
            raise HTTPException(status_code=503, detail="Cache service unavailable")

        return {
            "memory_usage": stats.memory_usage,
            "total_keys": stats.total_keys,
            "hit_rate": stats.hit_rate,
            "uptime": stats.uptime,
            "cache_efficiency": "High" if stats.hit_rate > 80 else "Medium" if stats.hit_rate > 60 else "Low"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get memory usage: {str(e)}")


@router.post("/test", response_model=CacheResponse)
async def test_cache_operations():
    """Test basic cache operations"""
    try:
        test_key = "cache_test"
        test_value = {"test": True, "timestamp": "2024-01-01T00:00:00"}

        # Test set
        set_success = await cache_service.set("test", test_key, test_value, ttl=60)
        if not set_success:
            raise Exception("Cache set operation failed")

        # Test get
        retrieved_value = await cache_service.get("test", test_key)
        if retrieved_value != test_value:
            raise Exception("Cache get operation failed")

        # Test delete
        delete_success = await cache_service.delete("test", test_key)
        if not delete_success:
            raise Exception("Cache delete operation failed")

        return CacheResponse(
            success=True,
            message="All cache operations completed successfully",
            data={
                "set": set_success,
                "get": retrieved_value == test_value,
                "delete": delete_success
            }
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Cache test failed: {str(e)}"
        )


@router.post("/invalidate/manual", response_model=CacheResponse)
async def manual_cache_invalidation(request: ManualInvalidationRequest):
    """Manually trigger cache invalidation"""
    try:
        # Convert string strategy to enum
        strategy_mapping = {
            "immediate": InvalidationStrategy.IMMEDIATE,
            "delayed": InvalidationStrategy.DELAYED,
            "cascade": InvalidationStrategy.DEPENDENCY_CASCADE,
            "lazy": InvalidationStrategy.LAZY
        }

        strategy = strategy_mapping.get(request.strategy.lower(), InvalidationStrategy.IMMEDIATE)

        result = await cache_invalidation_service.manual_invalidation(
            cache_patterns=request.cache_patterns,
            strategy=strategy,
            context=request.context
        )

        return CacheResponse(
            success=result['success'],
            message=f"Manual invalidation completed for {len(request.cache_patterns)} patterns",
            data=result
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Manual invalidation failed: {str(e)}"
        )


@router.post("/invalidate/trigger", response_model=CacheResponse)
async def trigger_cache_invalidation(request: TriggerInvalidationRequest):
    """Trigger cache invalidation by event"""
    try:
        # Convert string trigger to enum
        trigger_mapping = {trigger.value: trigger for trigger in InvalidationTrigger}

        trigger = trigger_mapping.get(request.trigger.lower())
        if not trigger:
            available_triggers = list(trigger_mapping.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Invalid trigger '{request.trigger}'. Available: {available_triggers}"
            )

        await cache_invalidation_service.trigger_invalidation(
            trigger=trigger,
            context=request.context
        )

        return CacheResponse(
            success=True,
            message=f"Cache invalidation triggered for event: {trigger.value}",
            data={"trigger": trigger.value, "context": request.context}
        )

    except HTTPException:
        raise
    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Trigger invalidation failed: {str(e)}"
        )


@router.get("/invalidation/stats")
async def get_invalidation_stats():
    """Get cache invalidation statistics"""
    try:
        stats = await cache_invalidation_service.get_invalidation_stats()

        return {
            "invalidation_stats": stats,
            "cache_service_connected": cache_service._is_connected
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get invalidation stats: {str(e)}")


@router.get("/invalidation/pending")
async def get_pending_invalidations():
    """Get pending cache invalidations"""
    try:
        pending = await cache_invalidation_service.get_pending_invalidations()

        return {
            "pending_invalidations": pending,
            "count": len(pending)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending invalidations: {str(e)}")


@router.get("/invalidation/rules")
async def get_invalidation_rules():
    """Get all cache invalidation rules"""
    try:
        rules_by_trigger = {}

        for trigger, rules in cache_invalidation_service.invalidation_rules.items():
            rules_by_trigger[trigger.value] = [
                {
                    "cache_patterns": rule.cache_patterns,
                    "strategy": rule.strategy.value,
                    "delay_seconds": rule.delay_seconds,
                    "cascade_dependencies": rule.cascade_dependencies,
                    "created_at": rule.created_at.isoformat()
                }
                for rule in rules
            ]

        return {
            "invalidation_rules": rules_by_trigger,
            "total_rules": sum(len(rules) for rules in cache_invalidation_service.invalidation_rules.values()),
            "available_triggers": [trigger.value for trigger in InvalidationTrigger],
            "available_strategies": [strategy.value for strategy in InvalidationStrategy]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get invalidation rules: {str(e)}")


@router.post("/invalidation/dependency")
async def add_cache_dependency(dependent_key: str, dependency_key: str):
    """Add a cache dependency relationship"""
    try:
        cache_invalidation_service.add_dependency(dependent_key, dependency_key)

        return {
            "success": True,
            "message": f"Added dependency: {dependent_key} depends on {dependency_key}",
            "dependent_key": dependent_key,
            "dependency_key": dependency_key
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add dependency: {str(e)}")


@router.delete("/invalidation/dependency")
async def remove_cache_dependency(dependent_key: str, dependency_key: str):
    """Remove a cache dependency relationship"""
    try:
        cache_invalidation_service.remove_dependency(dependent_key, dependency_key)

        return {
            "success": True,
            "message": f"Removed dependency: {dependent_key} no longer depends on {dependency_key}",
            "dependent_key": dependent_key,
            "dependency_key": dependency_key
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove dependency: {str(e)}")


# Cache Warming Endpoints

@router.post("/warm/rule", response_model=CacheResponse)
async def warm_cache_by_rule(request: WarmByRuleRequest):
    """Warm cache using a specific warming rule"""
    try:
        task = await cache_warming_service.warm_cache_by_rule(request.rule_name)

        return CacheResponse(
            success=task.status == "completed",
            message=f"Cache warming {'completed' if task.status == 'completed' else 'failed'} for rule: {request.rule_name}",
            data={
                "rule_name": request.rule_name,
                "items_warmed": task.items_warmed,
                "execution_time": task.execution_time,
                "status": task.status,
                "error": task.error_message
            }
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Cache warming failed: {str(e)}"
        )


@router.post("/warm/priority", response_model=CacheResponse)
async def warm_cache_by_priority(request: WarmByPriorityRequest):
    """Warm cache for all rules of a specific priority"""
    try:
        # Convert string priority to enum
        priority_mapping = {
            "low": WarmingPriority.LOW,
            "medium": WarmingPriority.MEDIUM,
            "high": WarmingPriority.HIGH,
            "critical": WarmingPriority.CRITICAL
        }

        priority = priority_mapping.get(request.priority.lower())
        if not priority:
            available_priorities = list(priority_mapping.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Invalid priority '{request.priority}'. Available: {available_priorities}"
            )

        tasks = await cache_warming_service.warm_cache_by_priority(priority)

        total_items = sum(task.items_warmed for task in tasks)
        successful_tasks = len([t for t in tasks if t.status == "completed"])

        return CacheResponse(
            success=len(tasks) > 0,
            message=f"Cache warming completed for {len(tasks)} rules with priority: {priority.value}",
            data={
                "priority": priority.value,
                "rules_executed": len(tasks),
                "successful_rules": successful_tasks,
                "total_items_warmed": total_items,
                "task_details": [
                    {
                        "rule_name": task.rule.name,
                        "items_warmed": task.items_warmed,
                        "status": task.status,
                        "execution_time": task.execution_time
                    }
                    for task in tasks
                ]
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Priority cache warming failed: {str(e)}"
        )


@router.post("/warm/all", response_model=CacheResponse)
async def warm_all_caches():
    """Warm all caches using all enabled rules"""
    try:
        results = await cache_warming_service.warm_all_caches()

        total_tasks = sum(len(tasks) for tasks in results.values())
        total_items = sum(
            task.items_warmed
            for tasks in results.values()
            for task in tasks
        )

        priority_summary = {}
        for priority, tasks in results.items():
            successful = len([t for t in tasks if t.status == "completed"])
            priority_summary[priority.value] = {
                "total_rules": len(tasks),
                "successful_rules": successful,
                "items_warmed": sum(t.items_warmed for t in tasks)
            }

        return CacheResponse(
            success=total_tasks > 0,
            message=f"Cache warming completed for {total_tasks} rules, {total_items} items warmed",
            data={
                "total_rules_executed": total_tasks,
                "total_items_warmed": total_items,
                "by_priority": priority_summary
            }
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Full cache warming failed: {str(e)}"
        )


@router.post("/warm/predictive", response_model=CacheResponse)
async def warm_cache_predictive():
    """Execute predictive cache warming based on access patterns"""
    try:
        task = await cache_warming_service.predictive_warming()

        return CacheResponse(
            success=task.status == "completed",
            message=f"Predictive cache warming {'completed' if task.status == 'completed' else 'failed'}",
            data={
                "items_warmed": task.items_warmed,
                "execution_time": task.execution_time,
                "status": task.status,
                "error": task.error_message
            }
        )

    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Predictive warming failed: {str(e)}"
        )


@router.post("/warm/due")
async def execute_due_warming_tasks():
    """Execute all warming tasks that are due"""
    try:
        tasks = await cache_warming_service.execute_due_warming_tasks()

        successful_tasks = len([t for t in tasks if t.status == "completed"])
        total_items = sum(t.items_warmed for t in tasks)

        return {
            "success": True,
            "message": f"Executed {len(tasks)} due warming tasks",
            "total_tasks": len(tasks),
            "successful_tasks": successful_tasks,
            "total_items_warmed": total_items,
            "task_details": [
                {
                    "rule_name": task.rule.name,
                    "status": task.status,
                    "items_warmed": task.items_warmed,
                    "execution_time": task.execution_time
                }
                for task in tasks
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute due warming tasks: {str(e)}")


@router.get("/warming/stats")
async def get_warming_stats():
    """Get cache warming statistics"""
    try:
        stats = await cache_warming_service.get_warming_stats()

        return {
            "warming_stats": stats,
            "cache_service_connected": cache_service._is_connected
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warming stats: {str(e)}")


@router.get("/warming/schedule")
async def get_warming_schedule():
    """Get warming schedule for all rules"""
    try:
        schedule = await cache_warming_service.get_warming_schedule()

        return {
            "warming_schedule": schedule,
            "total_rules": len(schedule),
            "due_rules": len([s for s in schedule.values() if s["is_due"]]),
            "next_execution": min(
                (s["next_execution"] for s in schedule.values()),
                default=None
            )
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warming schedule: {str(e)}")


@router.get("/warming/rules")
async def get_warming_rules():
    """Get all cache warming rules"""
    try:
        rules_info = {}

        for rule_name, rule in cache_warming_service.warming_rules.items():
            rules_info[rule_name] = {
                "strategy": rule.strategy.value,
                "priority": rule.priority.value,
                "cache_type": rule.cache_type,
                "batch_size": rule.batch_size,
                "frequency_hours": rule.frequency_hours,
                "ttl": rule.ttl,
                "enabled": rule.enabled,
                "created_at": rule.created_at.isoformat()
            }

        return {
            "warming_rules": rules_info,
            "total_rules": len(rules_info),
            "enabled_rules": len([r for r in cache_warming_service.warming_rules.values() if r.enabled]),
            "available_strategies": [strategy.value for strategy in WarmingStrategy],
            "available_priorities": [priority.value for priority in WarmingPriority]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warming rules: {str(e)}")


@router.post("/warming/rule/{rule_name}/enable")
async def enable_warming_rule(rule_name: str):
    """Enable a warming rule"""
    try:
        success = cache_warming_service.enable_rule(rule_name)

        if success:
            return {
                "success": True,
                "message": f"Warming rule '{rule_name}' enabled",
                "rule_name": rule_name
            }
        else:
            raise HTTPException(status_code=404, detail=f"Warming rule '{rule_name}' not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enable warming rule: {str(e)}")


@router.post("/warming/rule/{rule_name}/disable")
async def disable_warming_rule(rule_name: str):
    """Disable a warming rule"""
    try:
        success = cache_warming_service.disable_rule(rule_name)

        if success:
            return {
                "success": True,
                "message": f"Warming rule '{rule_name}' disabled",
                "rule_name": rule_name
            }
        else:
            raise HTTPException(status_code=404, detail=f"Warming rule '{rule_name}' not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disable warming rule: {str(e)}")


@router.get("/warming/patterns")
async def get_access_patterns():
    """Get recorded access patterns for predictive warming"""
    try:
        patterns = dict(cache_warming_service.access_patterns)

        # Get predictive candidates
        candidates = cache_warming_service.get_predictive_warming_candidates()

        return {
            "access_patterns": patterns,
            "total_patterns": len(patterns),
            "predictive_candidates": candidates,
            "candidate_count": len(candidates)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get access patterns: {str(e)}")


# Cache Monitoring Endpoints

@router.get("/monitoring/health")
async def get_cache_health():
    """Get cache health status"""
    try:
        from app.services.cache_monitoring_service import get_cache_health
        health = await get_cache_health()
        return health
    except Exception as e:
        return {
            "healthy": False,
            "error": str(e)
        }


@router.get("/monitoring/metrics")
async def get_cache_metrics(time_window_hours: int = 24):
    """Get cache metrics summary"""
    try:
        metrics = await cache_monitoring_service.get_metrics_summary(time_window_hours)

        return {
            "metrics": metrics,
            "time_window_hours": time_window_hours,
            "total_metric_types": len(metrics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache metrics: {str(e)}")


@router.get("/monitoring/alerts")
async def get_cache_alerts():
    """Get active cache alerts"""
    try:
        alerts = await cache_monitoring_service.get_active_alerts()

        return {
            "active_alerts": alerts,
            "alert_count": len(alerts),
            "critical_count": len([a for a in alerts if a["level"] == "critical"]),
            "warning_count": len([a for a in alerts if a["level"] == "warning"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache alerts: {str(e)}")


@router.post("/monitoring/alerts/{alert_id}/resolve")
async def resolve_cache_alert(alert_id: str):
    """Resolve a cache alert"""
    try:
        success = await cache_monitoring_service.resolve_alert(alert_id)

        if success:
            return {
                "success": True,
                "message": f"Alert {alert_id} resolved successfully",
                "alert_id": alert_id
            }
        else:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found or already resolved")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


@router.get("/monitoring/report")
async def get_performance_report():
    """Get comprehensive cache performance report"""
    try:
        report = await cache_monitoring_service.get_performance_report()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate performance report: {str(e)}")


@router.post("/monitoring/thresholds", response_model=CacheResponse)
async def update_alert_thresholds(request: UpdateThresholdsRequest):
    """Update alert thresholds for a metric type"""
    try:
        # Convert string to enum
        metric_type_mapping = {metric_type.value: metric_type for metric_type in MetricType}

        metric_type = metric_type_mapping.get(request.metric_type.lower())
        if not metric_type:
            available_types = list(metric_type_mapping.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Invalid metric type '{request.metric_type}'. Available: {available_types}"
            )

        await cache_monitoring_service.update_alert_thresholds(
            metric_type, request.warning, request.critical
        )

        return CacheResponse(
            success=True,
            message=f"Alert thresholds updated for {metric_type.value}",
            data={
                "metric_type": metric_type.value,
                "warning": request.warning,
                "critical": request.critical
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        return CacheResponse(
            success=False,
            message=f"Failed to update thresholds: {str(e)}"
        )


@router.post("/monitoring/enable")
async def enable_monitoring():
    """Enable cache monitoring"""
    try:
        cache_monitoring_service.enable_monitoring()

        return {
            "success": True,
            "message": "Cache monitoring enabled",
            "status": "enabled"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enable monitoring: {str(e)}")


@router.post("/monitoring/disable")
async def disable_monitoring():
    """Disable cache monitoring"""
    try:
        cache_monitoring_service.disable_monitoring()

        return {
            "success": True,
            "message": "Cache monitoring disabled",
            "status": "disabled"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disable monitoring: {str(e)}")


@router.get("/monitoring/export")
async def export_metrics(format: str = "json"):
    """Export cache metrics data"""
    try:
        if format not in ["json"]:
            raise HTTPException(status_code=400, detail="Only 'json' format is currently supported")

        exported_data = await cache_monitoring_service.export_metrics(format)

        from fastapi.responses import Response
        return Response(
            content=exported_data,
            media_type="application/json" if format == "json" else "text/plain",
            headers={"Content-Disposition": f"attachment; filename=cache_metrics.{format}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export metrics: {str(e)}")


@router.get("/monitoring/thresholds")
async def get_alert_thresholds():
    """Get current alert thresholds"""
    try:
        thresholds = {}
        for metric_type, threshold_values in cache_monitoring_service.alert_thresholds.items():
            thresholds[metric_type.value] = threshold_values

        return {
            "alert_thresholds": thresholds,
            "available_metric_types": [metric_type.value for metric_type in MetricType],
            "available_alert_levels": [level.value for level in AlertLevel]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alert thresholds: {str(e)}")


@router.get("/monitoring/status")
async def get_monitoring_status():
    """Get cache monitoring system status"""
    try:
        return {
            "monitoring_enabled": cache_monitoring_service.monitoring_enabled,
            "last_collection": cache_monitoring_service.last_collection_time.isoformat(),
            "collection_interval_seconds": cache_monitoring_service.collection_interval_seconds,
            "total_metrics_collected": sum(len(queue) for queue in cache_monitoring_service.metrics.values()),
            "total_alerts": len(cache_monitoring_service.alerts),
            "active_alerts": len([a for a in cache_monitoring_service.alerts if not a.resolved])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get monitoring status: {str(e)}")