#!/bin/bash

# CA-DMS Backup Script
# Creates backups of database and uploaded files
# Usage: ./backup.sh [retention_days]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RETENTION_DAYS=${1:-7}
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
backup_database() {
    log_info "Creating database backup..."
    
    DB_BACKUP_FILE="$BACKUP_DIR/ca_dms_db_$TIMESTAMP.sql"
    
    # Get database credentials from environment
    source "$PROJECT_ROOT/.env" 2>/dev/null || {
        log_error "Could not source .env file"
        exit 1
    }
    
    # Create database dump
    docker-compose exec -T postgres pg_dump \
        -U ca_dms_user \
        -d ca_dms \
        --clean --if-exists --create > "$DB_BACKUP_FILE"
    
    # Compress backup
    gzip "$DB_BACKUP_FILE"
    
    log_info "Database backup created: ${DB_BACKUP_FILE}.gz"
}

# Files backup
backup_files() {
    log_info "Creating files backup..."
    
    FILES_BACKUP_FILE="$BACKUP_DIR/ca_dms_files_$TIMESTAMP.tar.gz"
    
    # Backup uploaded files and other important data
    tar -czf "$FILES_BACKUP_FILE" \
        -C "$PROJECT_ROOT" \
        --exclude=node_modules \
        --exclude=venv \
        --exclude=.git \
        --exclude=backups \
        --exclude='*.log' \
        backend/uploads/ \
        .env 2>/dev/null || log_warning "Some files may not exist yet"
    
    log_info "Files backup created: $FILES_BACKUP_FILE"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -type f -name "ca_dms_*" -mtime +$RETENTION_DAYS -delete
    
    log_info "Old backups cleaned up"
}

# Main backup function
main() {
    log_info "Starting CA-DMS backup process"
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        log_error "CA-DMS services are not running"
        exit 1
    fi
    
    backup_database
    backup_files
    cleanup_old_backups
    
    # Show backup summary
    log_info "Backup completed successfully"
    log_info "Backup location: $BACKUP_DIR"
    log_info "Available backups:"
    ls -lh "$BACKUP_DIR"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi