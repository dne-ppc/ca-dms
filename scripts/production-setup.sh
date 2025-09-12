#!/bin/bash

# CA-DMS Production Environment Setup Script
# This script prepares a production server for CA-DMS deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOMAIN=${1:-example.com}
EMAIL=${2:-admin@example.com}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log_info "Please run as a regular user with sudo privileges"
        exit 1
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    
    sudo apt-get update -y
    sudo apt-get upgrade -y
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        software-properties-common \
        ufw \
        fail2ban \
        unattended-upgrades \
        logrotate \
        htop \
        git \
        vim \
        wget \
        zip \
        unzip
        
    log_success "System packages updated"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    # Remove old versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    log_info "Installing Docker Compose..."
    
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    # Download Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_success "Docker Compose installed: ${DOCKER_COMPOSE_VERSION}"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Reset UFW to defaults
    sudo ufw --force reset
    
    # Set default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow specific application ports (if needed for development)
    # sudo ufw allow 8000/tcp  # Backend API
    # sudo ufw allow 8080/tcp  # Frontend
    
    # Enable UFW
    sudo ufw --force enable
    
    log_success "Firewall configured"
}

# Configure Fail2Ban
configure_fail2ban() {
    log_info "Configuring Fail2Ban..."
    
    # Create local configuration
    sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF
    
    # Restart Fail2Ban
    sudo systemctl restart fail2ban
    sudo systemctl enable fail2ban
    
    log_success "Fail2Ban configured"
}

# Configure automatic security updates
configure_auto_updates() {
    log_info "Configuring automatic security updates..."
    
    # Configure unattended-upgrades
    sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
    
    # Enable automatic updates
    sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
    
    log_success "Automatic security updates configured"
}

# Setup SSL certificates with Let's Encrypt
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    # Install Certbot
    sudo apt-get install -y snapd
    sudo snap install core; sudo snap refresh core
    sudo snap install --classic certbot
    
    # Create symlink
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    
    # Create SSL directory
    sudo mkdir -p /etc/nginx/ssl
    
    log_info "SSL setup prepared. After deployment, run:"
    log_info "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email"
    
    log_success "SSL certificates preparation completed"
}

# Create data directories
create_directories() {
    log_info "Creating application directories..."
    
    # Create data directories
    sudo mkdir -p /data/{postgres,redis,nginx,uploads,backups}
    sudo mkdir -p /var/log/ca-dms
    
    # Set permissions
    sudo chown -R $USER:$USER /data
    sudo chown -R $USER:$USER /var/log/ca-dms
    
    # Create application user (optional, for better security)
    sudo useradd -r -s /bin/false -d /nonexistent ca-dms 2>/dev/null || true
    
    log_success "Directories created"
}

# Configure log rotation
configure_logrotate() {
    log_info "Configuring log rotation..."
    
    sudo tee /etc/logrotate.d/ca-dms > /dev/null << EOF
/var/log/ca-dms/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}

/data/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        docker kill -s USR1 \$(docker ps -q --filter ancestor=nginx) 2>/dev/null || true
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up basic monitoring..."
    
    # Create monitoring script
    tee ~/monitor-ca-dms.sh > /dev/null << EOF
#!/bin/bash
# Basic CA-DMS monitoring script

cd $PROJECT_ROOT
./scripts/monitor.sh

# Check disk space
df -h | grep -E '^/dev/' | awk '{ print \$5 " " \$1 }' | while read output;
do
    usage=\$(echo \$output | awk '{ print \$1}' | cut -d'%' -f1)
    partition=\$(echo \$output | awk '{ print \$2 }')
    if [ \$usage -ge 90 ]; then
        echo "Running out of space: \"\$partition (\$usage%)\" on \$(hostname) as on \$(date)"
    fi
done
EOF
    
    chmod +x ~/monitor-ca-dms.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/15 * * * * $HOME/monitor-ca-dms.sh") | crontab -
    
    log_success "Basic monitoring setup completed"
}

# Setup backup schedule
setup_backup_schedule() {
    log_info "Setting up backup schedule..."
    
    # Add backup jobs to crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * cd $PROJECT_ROOT && ./scripts/backup.sh 7") | crontab -
    (crontab -l 2>/dev/null; echo "0 3 * * 0 cd $PROJECT_ROOT && ./scripts/backup.sh 30") | crontab -
    
    log_success "Backup schedule configured"
}

# Generate production configuration
generate_production_config() {
    log_info "Generating production configuration..."
    
    # Create production environment file
    tee $PROJECT_ROOT/.env.production > /dev/null << EOF
# CA-DMS Production Environment Configuration
# Generated on $(date)

# Database Configuration
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DATABASE_URL=postgresql://ca_dms_user:\${POSTGRES_PASSWORD}@postgres:5432/ca_dms

# Redis Configuration  
REDIS_PASSWORD=$(openssl rand -base64 32)
REDIS_URL=redis://:\${REDIS_PASSWORD}@redis:6379/0

# Backend API Configuration
SECRET_KEY=$(openssl rand -base64 64)
API_V1_STR=/api/v1
PROJECT_NAME=CA-DMS
ENVIRONMENT=production

# CORS Origins
BACKEND_CORS_ORIGINS=["https://$DOMAIN", "https://www.$DOMAIN"]

# Frontend Configuration
PRODUCTION_FRONTEND_URL=https://$DOMAIN
PRODUCTION_BACKEND_URL=https://$DOMAIN/api
PRODUCTION_WS_URL=wss://$DOMAIN/ws

# SSL Configuration
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/private.key

# Email Configuration (Update with your SMTP settings)
SMTP_TLS=true
SMTP_PORT=587
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@$DOMAIN
SMTP_PASSWORD=your_email_password

# Monitoring
GRAFANA_PASSWORD=$(openssl rand -base64 32)
ALERT_EMAIL=$EMAIL
EOF
    
    log_success "Production configuration generated: .env.production"
    log_warning "Please review and update .env.production with your actual SMTP and other service credentials"
}

# Final security hardening
security_hardening() {
    log_info "Applying security hardening..."
    
    # Disable root login via SSH (optional)
    # sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    
    # Disable password authentication (if using SSH keys)
    # sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
    
    # Set secure kernel parameters
    sudo tee -a /etc/sysctl.conf > /dev/null << EOF

# CA-DMS Security Settings
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
EOF
    
    # Apply sysctl settings
    sudo sysctl -p
    
    log_success "Security hardening applied"
}

# Main setup function
main() {
    log_info "Starting CA-DMS Production Environment Setup"
    log_info "Domain: $DOMAIN"
    log_info "Admin Email: $EMAIL"
    
    echo
    log_warning "This script will configure a production server for CA-DMS"
    log_warning "Make sure you have:"
    log_warning "1. A clean Ubuntu 20.04+ server"
    log_warning "2. SSH access with sudo privileges"
    log_warning "3. Domain DNS pointing to this server"
    echo
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Setup cancelled"
        exit 0
    fi
    
    check_root
    update_system
    install_docker
    install_docker_compose
    configure_firewall
    configure_fail2ban
    configure_auto_updates
    setup_ssl
    create_directories
    configure_logrotate
    setup_monitoring
    setup_backup_schedule
    generate_production_config
    security_hardening
    
    log_success "🎉 Production environment setup completed!"
    echo
    log_info "Next steps:"
    log_info "1. Review and update .env.production with your credentials"
    log_info "2. Clone your CA-DMS repository to this server"
    log_info "3. Copy .env.production to .env in the project directory"
    log_info "4. Run: ./scripts/deploy.sh production"
    log_info "5. Setup SSL certificates: sudo certbot --nginx -d $DOMAIN"
    echo
    log_warning "Important: Please reboot the server to ensure all changes take effect"
    log_warning "After reboot, log back in to complete the deployment"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi