"""
Database Optimization Service

Provides database performance monitoring, query optimization,
and automated indexing recommendations for CA-DMS.
"""

import time
import logging
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy import text, inspect, MetaData, Table
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
from datetime import datetime, timedelta
import json

from app.core.database import get_db, engine
from app.models.document import Document
from app.models.user import User
from app.models.workflow import WorkflowInstance
from app.models.document_history import DocumentHistory


logger = logging.getLogger(__name__)


class QueryPerformanceMonitor:
    """Monitor and analyze database query performance"""

    def __init__(self):
        self.slow_query_threshold = 1.0  # seconds
        self.query_log = []
        self.max_log_size = 1000

    def log_query(self, query: str, execution_time: float, params: Optional[Dict] = None):
        """Log query execution for performance analysis"""
        log_entry = {
            'query': query,
            'execution_time': execution_time,
            'params': params,
            'timestamp': datetime.utcnow(),
            'is_slow': execution_time > self.slow_query_threshold
        }

        self.query_log.append(log_entry)

        # Keep log size manageable
        if len(self.query_log) > self.max_log_size:
            self.query_log = self.query_log[-self.max_log_size:]

        if log_entry['is_slow']:
            logger.warning(f"Slow query detected ({execution_time:.2f}s): {query[:100]}...")

    def get_slow_queries(self, limit: int = 10) -> List[Dict]:
        """Get slowest queries"""
        slow_queries = [q for q in self.query_log if q['is_slow']]
        return sorted(slow_queries, key=lambda x: x['execution_time'], reverse=True)[:limit]

    def get_query_stats(self) -> Dict[str, Any]:
        """Get query performance statistics"""
        if not self.query_log:
            return {'total_queries': 0}

        execution_times = [q['execution_time'] for q in self.query_log]
        slow_queries = [q for q in self.query_log if q['is_slow']]

        return {
            'total_queries': len(self.query_log),
            'slow_queries': len(slow_queries),
            'avg_execution_time': sum(execution_times) / len(execution_times),
            'max_execution_time': max(execution_times),
            'min_execution_time': min(execution_times),
            'slow_query_percentage': (len(slow_queries) / len(self.query_log)) * 100
        }


class DatabaseOptimizationService:
    """Comprehensive database optimization service"""

    def __init__(self):
        self.performance_monitor = QueryPerformanceMonitor()

    async def analyze_table_performance(self, db: Session) -> Dict[str, Any]:
        """Analyze performance characteristics of all tables"""
        try:
            analysis = {}

            # Get table sizes and row counts
            tables_info = await self._get_table_info(db)

            for table_name, info in tables_info.items():
                analysis[table_name] = {
                    'row_count': info['row_count'],
                    'table_size': info['table_size'],
                    'index_usage': await self._analyze_index_usage(db, table_name),
                    'missing_indexes': await self._suggest_missing_indexes(db, table_name),
                    'query_patterns': await self._analyze_query_patterns(table_name)
                }

            return analysis

        except Exception as e:
            logger.error(f"Table performance analysis failed: {e}")
            return {}

    async def _get_table_info(self, db: Session) -> Dict[str, Dict]:
        """Get basic information about all tables"""
        table_info = {}

        try:
            # Get list of tables
            inspector = inspect(db.bind)
            table_names = inspector.get_table_names()

            for table_name in table_names:
                try:
                    # Get row count
                    result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    row_count = result.scalar()

                    # Try to get table size (PostgreSQL specific)
                    try:
                        size_result = db.execute(text(f"SELECT pg_total_relation_size('{table_name}')"))
                        table_size = size_result.scalar()
                    except:
                        table_size = None

                    table_info[table_name] = {
                        'row_count': row_count,
                        'table_size': table_size
                    }

                except Exception as e:
                    logger.warning(f"Could not get info for table {table_name}: {e}")
                    table_info[table_name] = {'row_count': 0, 'table_size': None}

            return table_info

        except Exception as e:
            logger.error(f"Failed to get table info: {e}")
            return {}

    async def _analyze_index_usage(self, db: Session, table_name: str) -> Dict[str, Any]:
        """Analyze index usage for a specific table"""
        try:
            # PostgreSQL specific query for index usage
            index_query = text("""
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes
                WHERE tablename = :table_name
            """)

            result = db.execute(index_query, {'table_name': table_name})
            indexes = result.fetchall()

            index_analysis = []
            for index in indexes:
                index_analysis.append({
                    'index_name': index.indexname,
                    'scans': index.idx_scan,
                    'tuples_read': index.idx_tup_read,
                    'tuples_fetched': index.idx_tup_fetch,
                    'efficiency': index.idx_tup_fetch / max(index.idx_tup_read, 1) if index.idx_tup_read else 0
                })

            return {
                'indexes': index_analysis,
                'unused_indexes': [idx for idx in index_analysis if idx['scans'] == 0],
                'inefficient_indexes': [idx for idx in index_analysis if idx['efficiency'] < 0.5]
            }

        except Exception as e:
            logger.warning(f"Index analysis failed for {table_name}: {e}")
            return {'indexes': [], 'unused_indexes': [], 'inefficient_indexes': []}

    async def _suggest_missing_indexes(self, db: Session, table_name: str) -> List[str]:
        """Suggest missing indexes based on common query patterns"""
        suggestions = []

        # Table-specific index suggestions
        if table_name == 'documents':
            suggestions.extend([
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_documents_status_created_at ON documents(status, created_at DESC)",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_documents_content_gin ON documents USING gin(content)",  # For JSON queries
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_documents_full_text ON documents USING gin(to_tsvector('english', title || ' ' || COALESCE(content->>'ops', '')))"  # Full-text search
            ])

        elif table_name == 'users':
            suggestions.extend([
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_role_active ON users(role, is_active)",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_last_login ON users(last_login DESC)"
            ])

        elif table_name == 'workflow_instances':
            suggestions.extend([
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_workflow_instances_status_priority ON workflow_instances(status, priority)",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_workflow_instances_assignee_status ON workflow_instances(assigned_to, status)"
            ])

        elif table_name == 'document_history':
            suggestions.extend([
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_document_history_created_by_date ON document_history(created_by, created_at DESC)",
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_document_history_major_recent ON document_history(document_id, is_major_version, created_at DESC)"
            ])

        return suggestions

    async def _analyze_query_patterns(self, table_name: str) -> Dict[str, Any]:
        """Analyze query patterns from the performance monitor"""
        table_queries = [
            q for q in self.performance_monitor.query_log
            if table_name.lower() in q['query'].lower()
        ]

        if not table_queries:
            return {'total_queries': 0}

        # Analyze common patterns
        patterns = {
            'select_patterns': [],
            'where_clauses': [],
            'order_by_clauses': [],
            'join_patterns': []
        }

        for query in table_queries:
            query_lower = query['query'].lower()

            # Extract WHERE clauses
            if 'where' in query_lower:
                where_part = query_lower.split('where')[1].split('order')[0].split('group')[0].split('limit')[0]
                patterns['where_clauses'].append(where_part.strip())

            # Extract ORDER BY clauses
            if 'order by' in query_lower:
                order_part = query_lower.split('order by')[1].split('limit')[0].split('offset')[0]
                patterns['order_by_clauses'].append(order_part.strip())

        return {
            'total_queries': len(table_queries),
            'avg_execution_time': sum(q['execution_time'] for q in table_queries) / len(table_queries),
            'patterns': patterns,
            'slow_queries': len([q for q in table_queries if q['is_slow']])
        }

    async def optimize_table_indexes(self, db: Session, table_name: str) -> Dict[str, Any]:
        """Apply optimization recommendations for a specific table"""
        try:
            optimization_results = {
                'applied_indexes': [],
                'failed_indexes': [],
                'performance_gain': None
            }

            # Get missing index suggestions
            missing_indexes = await self._suggest_missing_indexes(db, table_name)

            for index_sql in missing_indexes:
                try:
                    # Execute index creation
                    start_time = time.time()
                    db.execute(text(index_sql))
                    db.commit()
                    execution_time = time.time() - start_time

                    optimization_results['applied_indexes'].append({
                        'sql': index_sql,
                        'creation_time': execution_time
                    })

                    logger.info(f"Created index for {table_name}: {index_sql}")

                except Exception as e:
                    optimization_results['failed_indexes'].append({
                        'sql': index_sql,
                        'error': str(e)
                    })
                    logger.error(f"Failed to create index: {index_sql}, Error: {e}")

            return optimization_results

        except Exception as e:
            logger.error(f"Table optimization failed for {table_name}: {e}")
            return {'error': str(e)}

    async def vacuum_analyze_tables(self, db: Session, table_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run VACUUM ANALYZE on specified tables or all tables"""
        try:
            if table_names is None:
                # Get all table names
                inspector = inspect(db.bind)
                table_names = inspector.get_table_names()

            results = {}

            for table_name in table_names:
                try:
                    start_time = time.time()

                    # Run VACUUM ANALYZE
                    db.execute(text(f"VACUUM ANALYZE {table_name}"))
                    db.commit()

                    execution_time = time.time() - start_time
                    results[table_name] = {
                        'success': True,
                        'execution_time': execution_time
                    }

                    logger.info(f"VACUUM ANALYZE completed for {table_name} in {execution_time:.2f}s")

                except Exception as e:
                    results[table_name] = {
                        'success': False,
                        'error': str(e)
                    }
                    logger.error(f"VACUUM ANALYZE failed for {table_name}: {e}")

            return results

        except Exception as e:
            logger.error(f"VACUUM ANALYZE operation failed: {e}")
            return {'error': str(e)}

    async def get_database_statistics(self, db: Session) -> Dict[str, Any]:
        """Get comprehensive database statistics"""
        try:
            stats = {
                'query_performance': self.performance_monitor.get_query_stats(),
                'table_info': await self._get_table_info(db),
                'connection_info': await self._get_connection_info(db),
                'cache_stats': await self._get_cache_stats(db)
            }

            return stats

        except Exception as e:
            logger.error(f"Database statistics collection failed: {e}")
            return {'error': str(e)}

    async def _get_connection_info(self, db: Session) -> Dict[str, Any]:
        """Get database connection information"""
        try:
            # PostgreSQL specific queries
            result = db.execute(text("""
                SELECT
                    count(*) as total_connections,
                    count(*) FILTER (WHERE state = 'active') as active_connections,
                    count(*) FILTER (WHERE state = 'idle') as idle_connections
                FROM pg_stat_activity
            """))

            conn_stats = result.fetchone()

            return {
                'total_connections': conn_stats.total_connections,
                'active_connections': conn_stats.active_connections,
                'idle_connections': conn_stats.idle_connections
            }

        except Exception as e:
            logger.warning(f"Could not get connection info: {e}")
            return {}

    async def _get_cache_stats(self, db: Session) -> Dict[str, Any]:
        """Get database cache statistics"""
        try:
            # PostgreSQL buffer cache stats
            result = db.execute(text("""
                SELECT
                    sum(heap_blks_read) as heap_read,
                    sum(heap_blks_hit) as heap_hit,
                    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
                FROM pg_statio_user_tables
            """))

            cache_stats = result.fetchone()

            return {
                'heap_blocks_read': cache_stats.heap_read,
                'heap_blocks_hit': cache_stats.heap_hit,
                'cache_hit_ratio': float(cache_stats.cache_hit_ratio) if cache_stats.cache_hit_ratio else 0
            }

        except Exception as e:
            logger.warning(f"Could not get cache stats: {e}")
            return {}

    async def create_maintenance_plan(self) -> Dict[str, Any]:
        """Create automated database maintenance plan"""
        return {
            'daily_tasks': [
                'VACUUM ANALYZE on frequently updated tables',
                'Update table statistics',
                'Check for slow queries'
            ],
            'weekly_tasks': [
                'Full database VACUUM',
                'Index usage analysis',
                'Performance review'
            ],
            'monthly_tasks': [
                'Comprehensive index optimization',
                'Historical data archiving',
                'Storage optimization'
            ],
            'suggested_monitoring': [
                'Query execution times > 1s',
                'Cache hit ratio < 95%',
                'Table size growth > 20%/month',
                'Unused indexes'
            ]
        }


# Global optimization service instance
db_optimization_service = DatabaseOptimizationService()


# Query performance monitoring decorator
def monitor_query_performance(func):
    """Decorator to monitor query performance"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Log performance
            db_optimization_service.performance_monitor.log_query(
                query=func.__name__,
                execution_time=execution_time
            )

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            db_optimization_service.performance_monitor.log_query(
                query=func.__name__,
                execution_time=execution_time,
                params={'error': str(e)}
            )
            raise

    return wrapper


# Utility function for database dependency injection
async def get_optimization_service() -> DatabaseOptimizationService:
    """Dependency to get database optimization service"""
    return db_optimization_service