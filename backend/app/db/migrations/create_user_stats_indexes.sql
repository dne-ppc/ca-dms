-- Migration: Advanced User Statistics Indexing
-- Purpose: Optimize indexes for user-specific intro page queries
-- Target: <50ms user aggregation queries, <20ms temporal queries, <15ms assignment queries

-- Advanced composite index for user document queries
-- Optimizes: user-specific document counts and temporal filtering
CREATE INDEX IF NOT EXISTS idx_user_documents_performance
    ON documents(created_by, created_at DESC, document_type);

-- Composite index for user workflow performance
-- Optimizes: workflow initiation and completion tracking
CREATE INDEX IF NOT EXISTS idx_user_workflow_performance
    ON workflow_instances(initiated_by, status, created_at DESC);

-- Temporal document index for time-based filtering
-- Optimizes: "documents created in last X days" queries
CREATE INDEX IF NOT EXISTS idx_documents_temporal_user
    ON documents(created_at DESC, created_by, updated_at DESC);

-- Covering index for user activity queries
-- Includes commonly queried columns to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_user_activity_covering
    ON users(id, is_active, last_login, role, email);

-- Workflow step assignee temporal index
-- Optimizes: pending assignments and assignment history
CREATE INDEX IF NOT EXISTS idx_workflow_step_assignee_temporal
    ON workflow_step_instances(assigned_to, status, created_at DESC, updated_at DESC);

-- Document type and user composite index
-- Optimizes: document type filtering per user
CREATE INDEX IF NOT EXISTS idx_documents_user_type_temporal
    ON documents(created_by, document_type, created_at DESC);

-- Workflow instance status temporal index
-- Optimizes: workflow status filtering with time ordering
CREATE INDEX IF NOT EXISTS idx_workflow_status_temporal
    ON workflow_instances(status, updated_at DESC, created_at DESC);

-- User role and activity index
-- Optimizes: role-based user filtering
CREATE INDEX IF NOT EXISTS idx_users_role_activity
    ON users(role, is_active, last_login DESC);

-- Document version and user index
-- Optimizes: document version tracking per user
CREATE INDEX IF NOT EXISTS idx_documents_user_version
    ON documents(created_by, version DESC, updated_at DESC);

-- Workflow step instance decision index
-- Optimizes: decision tracking and approval history
CREATE INDEX IF NOT EXISTS idx_workflow_step_decision
    ON workflow_step_instances(assigned_to, decision, completed_at DESC);

-- Composite index for user statistics view optimization
-- Optimizes: the user_activity_stats view queries
CREATE INDEX IF NOT EXISTS idx_user_stats_view_optimization
    ON users(id, is_active, role);

-- Additional covering index for workflow performance
-- Includes key fields for workflow performance calculations
CREATE INDEX IF NOT EXISTS idx_workflow_performance_covering
    ON workflow_instances(workflow_id, status, created_at, updated_at, initiated_by);

-- Index for document collaboration tracking
-- Optimizes: shared document and collaboration queries
CREATE INDEX IF NOT EXISTS idx_documents_collaboration
    ON documents(updated_by, updated_at DESC, created_by);

-- Index for active workflow steps
-- Optimizes: active/pending workflow step queries
CREATE INDEX IF NOT EXISTS idx_workflow_steps_active
    ON workflow_step_instances(status, assigned_to, due_date);

-- Temporal index for recent document activity
-- Optimizes: "recent activity" queries for intro page
CREATE INDEX IF NOT EXISTS idx_documents_recent_activity
    ON documents(updated_at DESC, created_by, document_type);

-- ANALYZE tables to update SQLite statistics
-- This helps the query planner choose optimal indexes
ANALYZE documents;
ANALYZE users;
ANALYZE workflow_instances;
ANALYZE workflow_step_instances;