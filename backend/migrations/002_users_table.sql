-- Add users table for authentication
-- Generated: 2025-01-12

-- Create user role enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        CREATE TYPE userrole AS ENUM ('admin', 'board_member', 'manager', 'resident', 'viewer');
    END IF;
END
$$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR(255),
    title VARCHAR(100),
    phone VARCHAR(50),
    role userrole NOT NULL DEFAULT 'resident',
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    reset_token VARCHAR,
    reset_token_expires TIMESTAMPTZ,
    verification_token VARCHAR,
    verified_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a default admin user (password: admin123 - should be changed immediately)
INSERT INTO users (
    id, 
    email, 
    username, 
    hashed_password, 
    full_name, 
    role, 
    is_active, 
    is_verified, 
    is_superuser,
    verified_at
) VALUES (
    'admin-user-id-001',
    'admin@ca-dms.local',
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- admin123
    'System Administrator',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    NOW()
) ON CONFLICT (email) DO NOTHING;