-- Migration: Create System Statistics Views and Indexes
-- Purpose: Implement materialized views for high-performance system statistics aggregation
-- Target: Sub-200ms response times for intro page system overview

-- Create performance indexes (SQLite compatible)
CREATE INDEX IF NOT EXISTS idx_documents_created_status
    ON documents(created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_documents_created_by_date
    ON documents(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_status_date
    ON workflow_instances(status, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_assignee_status
    ON workflow_instances(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_users_active_login
    ON users(is_active, last_login DESC);

-- Create system health calculation function
CREATE OR REPLACE FUNCTION calculate_system_health_score()
RETURNS NUMERIC(5,2) AS $$
DECLARE
    health_score NUMERIC(5,2) := 0;
    doc_growth_rate NUMERIC;
    workflow_completion_rate NUMERIC;
    user_activity_rate NUMERIC;
    error_rate NUMERIC;
BEGIN
    -- Document growth rate (30% weight)
    SELECT
        CASE
            WHEN COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') > 0
            THEN LEAST(100, (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::NUMERIC /
                            NULLIF(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days'), 0)) * 50)
            ELSE 50
        END
    INTO doc_growth_rate
    FROM documents
    WHERE deleted_at IS NULL;

    -- Workflow completion rate (40% weight)
    SELECT
        COALESCE(
            COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
            NULLIF(COUNT(*), 0) * 100,
            75
        )
    INTO workflow_completion_rate
    FROM workflow_instances
    WHERE created_at > NOW() - INTERVAL '30 days';

    -- User activity rate (20% weight)
    SELECT
        COALESCE(
            COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days')::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_active = true), 0) * 100,
            50
        )
    INTO user_activity_rate
    FROM users;

    -- Calculate weighted score
    health_score := (doc_growth_rate * 0.3) + (workflow_completion_rate * 0.4) + (user_activity_rate * 0.2) + 10; -- 10 base points

    RETURN LEAST(100, GREATEST(0, health_score));
END;
$$ LANGUAGE plpgsql STABLE;

-- Create workflow performance aggregation function
CREATE OR REPLACE FUNCTION calculate_avg_workflow_completion_time()
RETURNS INTERVAL AS $$
BEGIN
    RETURN (
        SELECT AVG(updated_at - created_at)
        FROM workflow_instances
        WHERE status = 'completed'
        AND updated_at > NOW() - INTERVAL '30 days'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create system statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS system_stats AS
SELECT
    -- Document statistics
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT d.id) FILTER (WHERE d.created_at > NOW() - INTERVAL '1 day') as documents_today,
    COUNT(DISTINCT d.id) FILTER (WHERE d.created_at > NOW() - INTERVAL '7 days') as documents_this_week,
    COUNT(DISTINCT d.id) FILTER (WHERE d.created_at > NOW() - INTERVAL '30 days') as documents_this_month,

    -- User statistics
    COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = true) as active_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.last_login > NOW() - INTERVAL '1 day') as users_active_today,
    COUNT(DISTINCT u.id) FILTER (WHERE u.last_login > NOW() - INTERVAL '7 days') as users_active_week,

    -- Workflow statistics
    COUNT(DISTINCT w.id) as total_workflows,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'pending') as pending_workflows,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'completed') as completed_workflows,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'completed' AND w.updated_at > NOW() - INTERVAL '1 day') as completed_workflows_today,

    -- Performance metrics
    calculate_avg_workflow_completion_time() as avg_workflow_completion_time,
    calculate_system_health_score() as system_health_score,

    -- Metadata
    NOW() as last_updated,
    '1.0' as version

FROM documents d
CROSS JOIN users u
CROSS JOIN workflow_instances w
WHERE d.deleted_at IS NULL
  AND u.is_active = true;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_stats_version ON system_stats(version);

-- Create user activity statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_stats AS
SELECT
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,

    -- Document activity
    COUNT(DISTINCT d.id) as documents_created,
    COUNT(DISTINCT d.id) FILTER (WHERE d.updated_at > NOW() - INTERVAL '30 days') as documents_updated_month,
    COUNT(DISTINCT d.id) FILTER (WHERE d.created_at > NOW() - INTERVAL '7 days') as documents_created_week,

    -- Workflow activity
    COUNT(DISTINCT wi.id) FILTER (WHERE wi.created_by = u.id) as workflows_initiated,
    COUNT(DISTINCT wi.id) FILTER (WHERE wi.assigned_to = u.id AND wi.status = 'completed') as workflows_completed,
    COUNT(DISTINCT wi.id) FILTER (WHERE wi.assigned_to = u.id AND wi.status = 'pending') as workflows_pending,

    -- Activity metrics
    GREATEST(u.last_login, MAX(d.updated_at), MAX(wi.updated_at)) as last_activity,

    -- Productivity score (0-100)
    CASE
        WHEN COUNT(DISTINCT d.id) + COUNT(DISTINCT wi.id) = 0 THEN 0
        ELSE LEAST(100,
            (COUNT(DISTINCT d.id) * 2 +
             COUNT(DISTINCT wi.id) FILTER (WHERE wi.status = 'completed') * 3 +
             COUNT(DISTINCT d.id) FILTER (WHERE d.created_at > NOW() - INTERVAL '7 days') * 5) / 2
        )
    END as productivity_score,

    NOW() as last_updated

FROM users u
LEFT JOIN documents d ON d.created_by = u.id AND d.deleted_at IS NULL
LEFT JOIN workflow_instances wi ON (wi.created_by = u.id OR wi.assigned_to = u.id)
WHERE u.is_active = true
GROUP BY u.id, u.email, u.full_name, u.role, u.last_login;

-- Create index for user activity stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_stats_user_id ON user_activity_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_productivity ON user_activity_stats(productivity_score DESC);

-- Create workflow performance statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS workflow_performance_stats AS
SELECT
    wi.workflow_template_id,
    COUNT(*) as total_instances,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_instances,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_instances,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_instances,

    -- Performance metrics
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status = 'completed') as avg_completion_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status = 'completed') as median_completion_hours,

    -- Recent activity
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as instances_this_week,
    COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '7 days') as completed_this_week,

    NOW() as last_updated

FROM workflow_instances wi
GROUP BY wi.workflow_template_id;

-- Create index for workflow performance stats
CREATE INDEX IF NOT EXISTS idx_workflow_performance_template ON workflow_performance_stats(workflow_template_id);

-- Create refresh function for all materialized views
CREATE OR REPLACE FUNCTION refresh_system_stats()
RETURNS BOOLEAN AS $$
BEGIN
    -- Refresh all materialized views concurrently for better performance
    REFRESH MATERIALIZED VIEW CONCURRENTLY system_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_performance_stats;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE WARNING 'Error refreshing system stats: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled refresh job (requires pg_cron extension)
-- This will refresh stats every 15 minutes
-- SELECT cron.schedule('refresh-system-stats', '*/15 * * * *', 'SELECT refresh_system_stats();');

-- Grant appropriate permissions
GRANT SELECT ON system_stats TO PUBLIC;
GRANT SELECT ON user_activity_stats TO PUBLIC;
GRANT SELECT ON workflow_performance_stats TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_system_health_score() TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_avg_workflow_completion_time() TO PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_system_stats() TO PUBLIC;