#!/bin/bash

# CA-DMS Monitoring Script
# Monitors system health and sends alerts
# Usage: ./monitor.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
WEBHOOK_URL="${WEBHOOK_URL:-}"

# Check service health
check_service_health() {
    local service=$1
    local url=$2
    local name=$3
    
    log_info "Checking $name health..."
    
    if curl -f -s --max-time 10 "$url" > /dev/null; then
        log_success "$name is healthy"
        return 0
    else
        log_error "$name is unhealthy (URL: $url)"
        return 1
    fi
}

# Check Docker services
check_docker_services() {
    log_info "Checking Docker services status..."
    
    cd "$PROJECT_ROOT"
    
    # Get service status
    local services=$(docker-compose ps --services)
    local unhealthy_services=""
    
    for service in $services; do
        local status=$(docker-compose ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
        
        case $status in
            "healthy")
                log_success "$service: healthy"
                ;;
            "unhealthy")
                log_error "$service: unhealthy"
                unhealthy_services="$unhealthy_services $service"
                ;;
            "starting")
                log_warning "$service: starting"
                ;;
            *)
                log_warning "$service: $status"
                ;;
        esac
    done
    
    if [[ -n "$unhealthy_services" ]]; then
        return 1
    fi
    
    return 0
}

# Check resource usage
check_resource_usage() {
    log_info "Checking resource usage..."
    
    # Memory usage
    local memory_usage=$(free | awk '/^Mem:/{printf "%.1f", $3/$2 * 100.0}')
    log_info "Memory usage: ${memory_usage}%"
    
    if (( $(echo "$memory_usage > 85" | bc -l) )); then
        log_warning "High memory usage detected: ${memory_usage}%"
    fi
    
    # Disk usage
    local disk_usage=$(df / | awk 'NR==2{printf "%.1f", $5}' | sed 's/%//')
    log_info "Disk usage: ${disk_usage}%"
    
    if (( $(echo "$disk_usage > 85" | bc -l) )); then
        log_warning "High disk usage detected: ${disk_usage}%"
    fi
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | xargs)
    log_info "Load average: $load_avg"
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    cd "$PROJECT_ROOT"
    
    if docker-compose exec -T postgres pg_isready -U ca_dms_user -d ca_dms > /dev/null 2>&1; then
        log_success "Database is accessible"
        
        # Check database size
        local db_size=$(docker-compose exec -T postgres psql -U ca_dms_user -d ca_dms -t -c "SELECT pg_size_pretty(pg_database_size('ca_dms'));" | xargs)
        log_info "Database size: $db_size"
        
        return 0
    else
        log_error "Database is not accessible"
        return 1
    fi
}

# Check log errors
check_logs() {
    log_info "Checking recent logs for errors..."
    
    cd "$PROJECT_ROOT"
    
    # Check for errors in backend logs (last 100 lines)
    local backend_errors=$(docker-compose logs --tail=100 backend 2>/dev/null | grep -i error | wc -l)
    log_info "Backend errors in recent logs: $backend_errors"
    
    if [[ $backend_errors -gt 10 ]]; then
        log_warning "High number of backend errors detected: $backend_errors"
    fi
    
    # Check for errors in frontend logs
    local frontend_errors=$(docker-compose logs --tail=100 frontend 2>/dev/null | grep -i error | wc -l)
    log_info "Frontend errors in recent logs: $frontend_errors"
    
    if [[ $frontend_errors -gt 5 ]]; then
        log_warning "High number of frontend errors detected: $frontend_errors"
    fi
}

# Send alert
send_alert() {
    local message=$1
    local severity=${2:-WARNING}
    
    log_info "Sending $severity alert: $message"
    
    # Send email alert (if configured)
    if command -v mail &> /dev/null && [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "CA-DMS $severity Alert" "$ALERT_EMAIL"
    fi
    
    # Send webhook alert (if configured)
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"CA-DMS $severity: $message\"}" \
            --silent --max-time 10 || true
    fi
}

# Generate health report
generate_report() {
    local report_file="/tmp/ca_dms_health_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "CA-DMS Health Report - $(date)"
        echo "=========================================="
        echo
        echo "Service Status:"
        check_docker_services 2>&1 | grep -E "(SUCCESS|ERROR|WARNING)"
        echo
        echo "Resource Usage:"
        check_resource_usage 2>&1 | grep -E "Memory usage|Disk usage|Load average"
        echo
        echo "Database Status:"
        check_database 2>&1 | grep -E "(SUCCESS|ERROR|Database size)"
        echo
        echo "Recent Error Counts:"
        check_logs 2>&1 | grep -E "errors in recent logs"
        echo
    } > "$report_file"
    
    log_info "Health report generated: $report_file"
    
    # Show summary
    cat "$report_file"
}

# Main monitoring function
main() {
    log_info "Starting CA-DMS health monitoring"
    
    local issues=0
    
    # Run health checks
    if ! check_service_health "backend" "http://localhost:8000/health" "Backend API"; then
        send_alert "Backend API is not responding" "ERROR"
        ((issues++))
    fi
    
    if ! check_service_health "frontend" "http://localhost:8080/health" "Frontend App"; then
        send_alert "Frontend application is not responding" "ERROR"
        ((issues++))
    fi
    
    if ! check_docker_services; then
        send_alert "One or more Docker services are unhealthy" "ERROR"
        ((issues++))
    fi
    
    if ! check_database; then
        send_alert "Database connectivity issues detected" "ERROR"
        ((issues++))
    fi
    
    # Resource checks (warnings only)
    check_resource_usage
    check_logs
    
    # Generate report
    generate_report
    
    if [[ $issues -eq 0 ]]; then
        log_success "All health checks passed"
    else
        log_error "$issues critical issues detected"
        exit 1
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi