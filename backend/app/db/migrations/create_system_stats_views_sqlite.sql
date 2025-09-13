-- Migration: Create System Statistics Views and Indexes (SQLite Compatible)
-- Purpose: Implement views for high-performance system statistics aggregation
-- Target: Sub-200ms response times for intro page system overview

-- Create performance indexes (SQLite compatible)
CREATE INDEX IF NOT EXISTS idx_documents_created_type
    ON documents(created_at DESC, document_type);

CREATE INDEX IF NOT EXISTS idx_documents_created_by_date
    ON documents(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_status_date
    ON workflow_instances(status, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_step_instances_assignee_status
    ON workflow_step_instances(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_users_active_login
    ON users(is_active, last_login DESC);

-- Create system statistics view (SQLite compatible)
CREATE VIEW IF NOT EXISTS system_stats AS
SELECT
    -- Document statistics
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-1 day') THEN d.id END) as documents_today,
    COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-7 days') THEN d.id END) as documents_this_week,
    COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-30 days') THEN d.id END) as documents_this_month,

    -- User statistics
    COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.id END) as active_users,
    COUNT(DISTINCT CASE WHEN u.last_login IS NOT NULL AND datetime(u.last_login) > datetime('now', '-1 day') THEN u.id END) as users_active_today,
    COUNT(DISTINCT CASE WHEN u.last_login IS NOT NULL AND datetime(u.last_login) > datetime('now', '-7 days') THEN u.id END) as users_active_week,

    -- Workflow statistics
    COUNT(DISTINCT w.id) as total_workflows,
    COUNT(DISTINCT CASE WHEN w.status = 'pending' THEN w.id END) as pending_workflows,
    COUNT(DISTINCT CASE WHEN w.status = 'completed' THEN w.id END) as completed_workflows,
    COUNT(DISTINCT CASE WHEN w.status = 'completed' AND datetime(w.updated_at) > datetime('now', '-1 day') THEN w.id END) as completed_workflows_today,

    -- Performance metrics (simplified for SQLite)
    AVG(CASE WHEN w.status = 'completed' THEN
        (julianday(w.updated_at) - julianday(w.created_at)) * 24
        ELSE NULL END) as avg_workflow_completion_hours,

    -- System health score (simplified calculation)
    CASE
        WHEN COUNT(DISTINCT d.id) = 0 THEN 50.0
        ELSE MIN(100.0,
            50.0 +
            (COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-7 days') THEN d.id END) * 5.0) +
            (COUNT(DISTINCT CASE WHEN w.status = 'completed' THEN w.id END) * 1.0 / MAX(1, COUNT(DISTINCT w.id)) * 30.0) +
            (COUNT(DISTINCT CASE WHEN u.last_login IS NOT NULL AND datetime(u.last_login) > datetime('now', '-7 days') THEN u.id END) * 2.0)
        )
    END as system_health_score,

    -- Metadata
    datetime('now') as last_updated,
    '1.0' as version

FROM
    (SELECT DISTINCT id, created_at, document_type FROM documents) d
CROSS JOIN
    (SELECT DISTINCT id, is_active, last_login FROM users WHERE is_active = 1) u
CROSS JOIN
    (SELECT DISTINCT id, status, created_at, updated_at FROM workflow_instances) w;

-- Create user activity statistics view (SQLite compatible)
CREATE VIEW IF NOT EXISTS user_activity_stats AS
SELECT
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,

    -- Document activity
    COUNT(DISTINCT d.id) as documents_created,
    COUNT(DISTINCT CASE WHEN datetime(d.updated_at) > datetime('now', '-30 days') THEN d.id END) as documents_updated_month,
    COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-7 days') THEN d.id END) as documents_created_week,

    -- Workflow activity
    COUNT(DISTINCT CASE WHEN wi.initiated_by = u.id THEN wi.id END) as workflows_initiated,
    COUNT(DISTINCT CASE WHEN wsi.assigned_to = u.id AND wsi.status = 'approved' THEN wsi.id END) as workflows_completed,
    COUNT(DISTINCT CASE WHEN wsi.assigned_to = u.id AND wsi.status = 'pending' THEN wsi.id END) as workflows_pending,

    -- Activity metrics
    COALESCE(MAX(u.last_login), MAX(d.updated_at), MAX(wi.updated_at), MAX(wsi.updated_at)) as last_activity,

    -- Productivity score (0-100, simplified for SQLite)
    CASE
        WHEN COUNT(DISTINCT d.id) + COUNT(DISTINCT wi.id) + COUNT(DISTINCT wsi.id) = 0 THEN 0
        ELSE MIN(100,
            (COUNT(DISTINCT d.id) * 2 +
             COUNT(DISTINCT CASE WHEN wsi.status = 'approved' THEN wsi.id END) * 3 +
             COUNT(DISTINCT CASE WHEN datetime(d.created_at) > datetime('now', '-7 days') THEN d.id END) * 5) / 2
        )
    END as productivity_score,

    datetime('now') as last_updated

FROM users u
LEFT JOIN documents d ON d.created_by = u.id
LEFT JOIN workflow_instances wi ON wi.initiated_by = u.id
LEFT JOIN workflow_step_instances wsi ON wsi.assigned_to = u.id
WHERE u.is_active = 1
GROUP BY u.id, u.email, u.full_name, u.role, u.last_login;

-- Create workflow performance statistics view (SQLite compatible)
CREATE VIEW IF NOT EXISTS workflow_performance_stats AS
SELECT
    wi.workflow_id,
    COUNT(*) as total_instances,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_instances,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_instances,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_instances,

    -- Performance metrics (SQLite compatible)
    AVG(CASE WHEN status = 'completed' THEN
        (julianday(updated_at) - julianday(created_at)) * 24
        ELSE NULL END) as avg_completion_hours,

    -- Recent activity
    COUNT(CASE WHEN datetime(created_at) > datetime('now', '-7 days') THEN 1 END) as instances_this_week,
    COUNT(CASE WHEN status = 'completed' AND datetime(updated_at) > datetime('now', '-7 days') THEN 1 END) as completed_this_week,

    datetime('now') as last_updated

FROM workflow_instances wi
GROUP BY wi.workflow_id;