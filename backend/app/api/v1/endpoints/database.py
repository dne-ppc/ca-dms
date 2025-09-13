"""
Database Management and Optimization API Endpoints

Provides endpoints for database performance monitoring, optimization,
and maintenance operations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.services.database_optimization_service import (
    db_optimization_service,
    get_optimization_service,
    DatabaseOptimizationService
)


router = APIRouter()


class DatabaseStatsResponse(BaseModel):
    """Database statistics response model"""
    query_performance: Dict[str, Any]
    table_info: Dict[str, Dict[str, Any]]
    connection_info: Dict[str, Any]
    cache_stats: Dict[str, Any]


class OptimizationRequest(BaseModel):
    """Optimization request model"""
    tables: Optional[List[str]] = None
    create_indexes: bool = True
    vacuum_analyze: bool = True
    analyze_only: bool = False


class OptimizationResponse(BaseModel):
    """Optimization response model"""
    success: bool
    message: str
    results: Dict[str, Any]


class TableAnalysisResponse(BaseModel):
    """Table analysis response model"""
    table_name: str
    row_count: int
    table_size: Optional[int]
    index_usage: Dict[str, Any]
    missing_indexes: List[str]
    query_patterns: Dict[str, Any]


@router.get("/stats", response_model=DatabaseStatsResponse)
async def get_database_stats(
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Get comprehensive database performance statistics"""
    try:
        stats = await optimization_service.get_database_statistics(db)

        if 'error' in stats:
            raise HTTPException(status_code=500, detail=stats['error'])

        return DatabaseStatsResponse(
            query_performance=stats.get('query_performance', {}),
            table_info=stats.get('table_info', {}),
            connection_info=stats.get('connection_info', {}),
            cache_stats=stats.get('cache_stats', {})
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get database stats: {str(e)}")


@router.get("/performance/queries/slow")
async def get_slow_queries(
    limit: int = 10,
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Get slowest database queries"""
    try:
        slow_queries = optimization_service.performance_monitor.get_slow_queries(limit)

        return {
            "slow_queries": slow_queries,
            "total_slow_queries": len([q for q in optimization_service.performance_monitor.query_log if q['is_slow']]),
            "threshold_seconds": optimization_service.performance_monitor.slow_query_threshold
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get slow queries: {str(e)}")


@router.post("/performance/queries/threshold")
async def set_slow_query_threshold(
    threshold_seconds: float,
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Set threshold for slow query detection"""
    try:
        if threshold_seconds <= 0:
            raise HTTPException(status_code=400, detail="Threshold must be positive")

        old_threshold = optimization_service.performance_monitor.slow_query_threshold
        optimization_service.performance_monitor.slow_query_threshold = threshold_seconds

        return {
            "success": True,
            "message": f"Slow query threshold updated from {old_threshold}s to {threshold_seconds}s",
            "old_threshold": old_threshold,
            "new_threshold": threshold_seconds
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set threshold: {str(e)}")


@router.get("/analyze/table/{table_name}")
async def analyze_table(
    table_name: str,
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Analyze performance of a specific table"""
    try:
        analysis = await optimization_service.analyze_table_performance(db)

        if table_name not in analysis:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")

        table_analysis = analysis[table_name]

        return TableAnalysisResponse(
            table_name=table_name,
            row_count=table_analysis.get('row_count', 0),
            table_size=table_analysis.get('table_size'),
            index_usage=table_analysis.get('index_usage', {}),
            missing_indexes=table_analysis.get('missing_indexes', []),
            query_patterns=table_analysis.get('query_patterns', {})
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table analysis failed: {str(e)}")


@router.get("/analyze/all")
async def analyze_all_tables(
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Analyze performance of all tables"""
    try:
        analysis = await optimization_service.analyze_table_performance(db)

        return {
            "total_tables": len(analysis),
            "analysis": analysis,
            "summary": {
                "tables_needing_indexes": len([t for t, data in analysis.items() if data.get('missing_indexes', [])]),
                "tables_with_unused_indexes": len([t for t, data in analysis.items() if data.get('index_usage', {}).get('unused_indexes', [])]),
                "total_suggestions": sum(len(data.get('missing_indexes', [])) for data in analysis.values())
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database analysis failed: {str(e)}")


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_database(
    request: OptimizationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Optimize database performance"""
    try:
        if request.analyze_only:
            # Only analyze, don't make changes
            analysis = await optimization_service.analyze_table_performance(db)
            return OptimizationResponse(
                success=True,
                message="Database analysis completed",
                results={"analysis": analysis}
            )

        optimization_results = {}

        # Handle specific tables or all tables
        tables_to_optimize = request.tables or ['documents', 'users', 'workflow_instances', 'document_history']

        # Create indexes
        if request.create_indexes:
            for table_name in tables_to_optimize:
                background_tasks.add_task(
                    optimization_service.optimize_table_indexes,
                    db,
                    table_name
                )

        # Run VACUUM ANALYZE
        if request.vacuum_analyze:
            background_tasks.add_task(
                optimization_service.vacuum_analyze_tables,
                db,
                tables_to_optimize
            )

        return OptimizationResponse(
            success=True,
            message=f"Database optimization started for {len(tables_to_optimize)} tables",
            results={
                "tables": tables_to_optimize,
                "operations": {
                    "create_indexes": request.create_indexes,
                    "vacuum_analyze": request.vacuum_analyze
                }
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database optimization failed: {str(e)}")


@router.post("/optimize/table/{table_name}")
async def optimize_table(
    table_name: str,
    background_tasks: BackgroundTasks,
    create_indexes: bool = True,
    vacuum_analyze: bool = True,
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Optimize a specific table"""
    try:
        optimization_tasks = []

        if create_indexes:
            optimization_tasks.append("index_optimization")
            background_tasks.add_task(
                optimization_service.optimize_table_indexes,
                db,
                table_name
            )

        if vacuum_analyze:
            optimization_tasks.append("vacuum_analyze")
            background_tasks.add_task(
                optimization_service.vacuum_analyze_tables,
                db,
                [table_name]
            )

        return {
            "success": True,
            "message": f"Optimization started for table '{table_name}'",
            "table": table_name,
            "operations": optimization_tasks
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table optimization failed: {str(e)}")


@router.get("/maintenance/plan")
async def get_maintenance_plan(
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Get recommended database maintenance plan"""
    try:
        plan = await optimization_service.create_maintenance_plan()

        return {
            "maintenance_plan": plan,
            "next_recommended_action": "Run daily VACUUM ANALYZE on high-activity tables",
            "estimated_time": "10-30 minutes depending on database size"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create maintenance plan: {str(e)}")


@router.post("/vacuum")
async def vacuum_tables(
    background_tasks: BackgroundTasks,
    tables: Optional[List[str]] = None,
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Run VACUUM ANALYZE on specified tables"""
    try:
        background_tasks.add_task(
            optimization_service.vacuum_analyze_tables,
            db,
            tables
        )

        table_count = len(tables) if tables else "all"

        return {
            "success": True,
            "message": f"VACUUM ANALYZE started for {table_count} tables",
            "tables": tables,
            "estimated_time": f"{len(tables or []) * 2}+ minutes"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VACUUM operation failed: {str(e)}")


@router.get("/indexes/suggestions")
async def get_index_suggestions(
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Get index optimization suggestions for all tables"""
    try:
        analysis = await optimization_service.analyze_table_performance(db)

        suggestions = {}
        total_suggestions = 0

        for table_name, table_data in analysis.items():
            missing_indexes = table_data.get('missing_indexes', [])
            if missing_indexes:
                suggestions[table_name] = missing_indexes
                total_suggestions += len(missing_indexes)

        return {
            "total_suggestions": total_suggestions,
            "suggestions_by_table": suggestions,
            "priority_tables": sorted(
                suggestions.keys(),
                key=lambda x: len(suggestions[x]),
                reverse=True
            )[:5] if suggestions else []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index suggestions: {str(e)}")


@router.get("/health")
async def database_health_check(
    db: Session = Depends(get_db),
    optimization_service: DatabaseOptimizationService = Depends(get_optimization_service)
):
    """Check database health and performance"""
    try:
        stats = await optimization_service.get_database_statistics(db)

        # Determine health status
        cache_hit_ratio = stats.get('cache_stats', {}).get('cache_hit_ratio', 0)
        query_stats = stats.get('query_performance', {})
        slow_query_percentage = query_stats.get('slow_query_percentage', 0)

        health_status = "healthy"
        issues = []

        if cache_hit_ratio < 0.95:
            health_status = "warning"
            issues.append(f"Cache hit ratio is {cache_hit_ratio:.2%} (should be >95%)")

        if slow_query_percentage > 10:
            health_status = "warning"
            issues.append(f"Slow queries represent {slow_query_percentage:.1f}% of total queries")

        if slow_query_percentage > 25:
            health_status = "critical"

        return {
            "health_status": health_status,
            "issues": issues,
            "recommendations": [
                "Run VACUUM ANALYZE on active tables",
                "Review and optimize slow queries",
                "Consider adding missing indexes"
            ] if issues else ["Database performance is optimal"],
            "stats_summary": {
                "cache_hit_ratio": f"{cache_hit_ratio:.2%}",
                "slow_query_percentage": f"{slow_query_percentage:.1f}%",
                "total_queries_monitored": query_stats.get('total_queries', 0)
            }
        }

    except Exception as e:
        return {
            "health_status": "error",
            "error": str(e),
            "recommendations": ["Check database connectivity and permissions"]
        }