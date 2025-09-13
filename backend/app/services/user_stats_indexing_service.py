"""
User Statistics Indexing Service
Manages advanced indexing strategies for user-specific intro page queries
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings

logger = logging.getLogger(__name__)


class UserStatsIndexingService:
    """Service for managing user statistics indexing optimization"""

    def __init__(self):
        self.migrations_path = Path(__file__).parent.parent / "db" / "migrations"

        # Create database connection
        database_url = settings.DATABASE_URL or "sqlite:///./ca_dms.db"
        self.engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
            echo=False
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    async def create_user_stats_indexes(self) -> bool:
        """
        Create advanced indexes for user statistics optimization
        Returns True if successful, False otherwise
        """
        try:
            migration_file = self.migrations_path / "create_user_stats_indexes.sql"

            if not migration_file.exists():
                logger.error(f"Migration file not found: {migration_file}")
                return False

            # Read migration SQL
            with open(migration_file, 'r') as f:
                migration_sql = f.read()

            # Execute migration
            db = self.SessionLocal()
            try:
                # Split SQL into individual statements and clean up
                statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]

                # Combine multiline CREATE INDEX statements
                cleaned_statements = []
                current_statement = ""

                for stmt in statements:
                    # Remove comment lines
                    lines = [line for line in stmt.split('\n') if not line.strip().startswith('--')]
                    cleaned_stmt = '\n'.join(lines).strip()

                    if cleaned_stmt:
                        if 'CREATE INDEX' in cleaned_stmt.upper():
                            cleaned_statements.append(cleaned_stmt)
                        elif 'ANALYZE' in cleaned_stmt.upper():
                            cleaned_statements.append(cleaned_stmt)

                for statement in cleaned_statements:
                    if statement:
                        logger.info(f"Executing: {statement[:100].replace(chr(10), ' ')}...")
                        db.execute(text(statement))

                db.commit()
                logger.info("User statistics indexes created successfully")
                return True
            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error creating user stats indexes: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error creating user stats indexes: {e}")
            return False

    async def verify_user_stats_indexes(self) -> Dict[str, bool]:
        """
        Verify that all user statistics indexes exist
        Returns dictionary with verification results
        """
        results = {}

        expected_indexes = [
            "idx_user_documents_performance",
            "idx_user_workflow_performance",
            "idx_documents_temporal_user",
            "idx_user_activity_covering",
            "idx_workflow_step_assignee_temporal",
            "idx_documents_user_type_temporal",
            "idx_workflow_status_temporal",
            "idx_users_role_activity",
            "idx_documents_user_version",
            "idx_workflow_step_decision",
            "idx_user_stats_view_optimization",
            "idx_workflow_performance_covering",
            "idx_documents_collaboration",
            "idx_workflow_steps_active",
            "idx_documents_recent_activity"
        ]

        try:
            db = self.SessionLocal()
            try:
                for index_name in expected_indexes:
                    index_exists = db.execute(text("""
                        SELECT name FROM sqlite_master
                        WHERE type = 'index'
                        AND name = :index_name
                    """), {"index_name": index_name}).fetchone()

                    results[index_name] = index_exists is not None

                return results

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error verifying user stats indexes: {e}")
            return results
        except Exception as e:
            logger.error(f"Unexpected error verifying user stats indexes: {e}")
            return results

    async def analyze_index_performance(self) -> Dict[str, float]:
        """
        Analyze performance impact of user statistics indexes
        Returns timing results for key query patterns
        """
        performance_results = {}

        try:
            db = self.SessionLocal()
            try:
                import time

                # Test user document aggregation query
                start_time = time.time()
                result = db.execute(text("""
                    SELECT
                        u.id,
                        COUNT(DISTINCT d.id) as doc_count,
                        COUNT(DISTINCT wi.id) as workflow_count
                    FROM users u
                    LEFT JOIN documents d ON d.created_by = u.id
                    LEFT JOIN workflow_instances wi ON wi.initiated_by = u.id
                    WHERE u.is_active = 1
                    GROUP BY u.id
                    LIMIT 10
                """)).fetchall()
                performance_results["user_aggregation_query_ms"] = (time.time() - start_time) * 1000

                # Test temporal document query
                start_time = time.time()
                result = db.execute(text("""
                    SELECT COUNT(*) FROM documents d
                    WHERE d.created_by IS NOT NULL
                    AND datetime(d.created_at) > datetime('now', '-30 days')
                """)).fetchone()
                performance_results["temporal_document_query_ms"] = (time.time() - start_time) * 1000

                # Test workflow assignment query
                start_time = time.time()
                result = db.execute(text("""
                    SELECT COUNT(*) FROM workflow_step_instances wsi
                    WHERE wsi.assigned_to IS NOT NULL
                    AND wsi.status = 'pending'
                """)).fetchone()
                performance_results["workflow_assignment_query_ms"] = (time.time() - start_time) * 1000

                # Test user activity stats view query
                start_time = time.time()
                result = db.execute(text("""
                    SELECT * FROM user_activity_stats
                    WHERE productivity_score > 50
                    LIMIT 5
                """)).fetchall()
                performance_results["user_activity_view_query_ms"] = (time.time() - start_time) * 1000

                # Test recent document activity query
                start_time = time.time()
                result = db.execute(text("""
                    SELECT d.created_by, COUNT(*) as recent_docs
                    FROM documents d
                    WHERE datetime(d.updated_at) > datetime('now', '-7 days')
                    GROUP BY d.created_by
                    LIMIT 10
                """)).fetchall()
                performance_results["recent_activity_query_ms"] = (time.time() - start_time) * 1000

                return performance_results

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error testing performance: {e}")
            return {"error": str(e)}
        except Exception as e:
            logger.error(f"Unexpected error testing performance: {e}")
            return {"error": str(e)}

    async def analyze_query_plans(self) -> Dict[str, List[str]]:
        """
        Analyze query execution plans to verify index usage
        Returns query plans for key user statistics queries
        """
        query_plans = {}

        try:
            db = self.SessionLocal()
            try:
                # Analyze user aggregation query plan
                result = db.execute(text("""
                    EXPLAIN QUERY PLAN
                    SELECT COUNT(*) FROM user_activity_stats
                    WHERE user_id = 'test-user'
                """)).fetchall()
                query_plans["user_activity_lookup"] = [row[3] for row in result]

                # Analyze temporal document query plan
                result = db.execute(text("""
                    EXPLAIN QUERY PLAN
                    SELECT COUNT(*) FROM documents d
                    WHERE d.created_by = 'test-user'
                    AND datetime(d.created_at) > datetime('now', '-30 days')
                """)).fetchall()
                query_plans["temporal_document_lookup"] = [row[3] for row in result]

                # Analyze workflow assignment query plan
                result = db.execute(text("""
                    EXPLAIN QUERY PLAN
                    SELECT * FROM workflow_step_instances wsi
                    WHERE wsi.assigned_to = 'test-user'
                    AND wsi.status = 'pending'
                """)).fetchall()
                query_plans["workflow_assignment_lookup"] = [row[3] for row in result]

                # Analyze user covering index usage
                result = db.execute(text("""
                    EXPLAIN QUERY PLAN
                    SELECT id, role, last_login FROM users
                    WHERE is_active = 1
                    ORDER BY last_login DESC
                    LIMIT 10
                """)).fetchall()
                query_plans["user_covering_index"] = [row[3] for row in result]

                return query_plans

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error analyzing query plans: {e}")
            return {"error": str(e)}
        except Exception as e:
            logger.error(f"Unexpected error analyzing query plans: {e}")
            return {"error": str(e)}

    async def get_index_statistics(self) -> Dict[str, Dict]:
        """
        Get statistics about index usage and effectiveness
        Returns detailed index statistics
        """
        index_stats = {}

        try:
            db = self.SessionLocal()
            try:
                # Get SQLite index statistics
                result = db.execute(text("""
                    SELECT name, sql FROM sqlite_master
                    WHERE type = 'index'
                    AND name LIKE 'idx_user_%'
                    OR name LIKE 'idx_documents_%'
                    OR name LIKE 'idx_workflow_%'
                """)).fetchall()

                for row in result:
                    index_name, index_sql = row
                    index_stats[index_name] = {
                        "sql": index_sql,
                        "type": "user_statistics" if "user" in index_name else "performance",
                        "exists": True
                    }

                # Get table statistics after ANALYZE
                result = db.execute(text("""
                    SELECT name FROM sqlite_master
                    WHERE type = 'table'
                    AND name IN ('documents', 'users', 'workflow_instances', 'workflow_step_instances')
                """)).fetchall()

                table_info = {}
                for row in result:
                    table_name = row[0]
                    count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).fetchone()
                    table_info[table_name] = {
                        "row_count": count_result[0] if count_result else 0
                    }

                index_stats["table_statistics"] = table_info
                return index_stats

            finally:
                db.close()

        except SQLAlchemyError as e:
            logger.error(f"Database error getting index statistics: {e}")
            return {"error": str(e)}
        except Exception as e:
            logger.error(f"Unexpected error getting index statistics: {e}")
            return {"error": str(e)}

    async def optimize_user_queries(self) -> Dict[str, str]:
        """
        Provide optimization recommendations for user-specific queries
        Returns optimization suggestions
        """
        recommendations = {}

        try:
            # Analyze current performance
            performance = await self.analyze_index_performance()

            # Provide recommendations based on performance
            for query_type, time_ms in performance.items():
                if "error" in query_type:
                    continue

                if "user_aggregation" in query_type:
                    if time_ms > 50:
                        recommendations[query_type] = f"Consider adding LIMIT clause or pagination - current: {time_ms:.1f}ms"
                    else:
                        recommendations[query_type] = f"Performance optimal - {time_ms:.1f}ms"

                elif "temporal" in query_type:
                    if time_ms > 20:
                        recommendations[query_type] = f"Consider date range optimization - current: {time_ms:.1f}ms"
                    else:
                        recommendations[query_type] = f"Temporal queries optimized - {time_ms:.1f}ms"

                elif "assignment" in query_type:
                    if time_ms > 15:
                        recommendations[query_type] = f"Consider status filtering optimization - current: {time_ms:.1f}ms"
                    else:
                        recommendations[query_type] = f"Assignment queries optimized - {time_ms:.1f}ms"

            return recommendations

        except Exception as e:
            logger.error(f"Error generating optimization recommendations: {e}")
            return {"error": str(e)}