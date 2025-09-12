# CA-DMS Deployment Guide

This guide covers the deployment and DevOps setup for the Community Association Document Management System (CA-DMS).

## 🏗️ Architecture Overview

CA-DMS is deployed as a containerized microservices application with the following components:

- **Frontend**: React + TypeScript application served by Nginx
- **Backend**: FastAPI Python application
- **Database**: PostgreSQL with persistent storage
- **Cache**: Redis for session management and caching
- **Load Balancer**: Nginx for production load balancing
- **Monitoring**: Health checks and logging

## 📋 Prerequisites

### Development Environment
- Docker >= 20.10
- Docker Compose >= 2.0
- Git
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)

### Production Environment
- Docker Swarm or Kubernetes cluster
- SSL certificates
- Domain name with DNS configuration
- SMTP server for email notifications
- Backup storage solution

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/ca-dms.git
cd ca-dms

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Deploy with Script
```bash
# Development deployment
./scripts/deploy.sh development

# Staging deployment
./scripts/deploy.sh staging

# Production deployment
./scripts/deploy.sh production
```

### 3. Access Application
- Frontend: http://localhost:8080
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📁 Directory Structure

```
ca-dms/
├── .github/workflows/      # CI/CD pipelines
├── backend/               # FastAPI backend
│   ├── app/              # Application code
│   ├── tests/            # Test suites
│   ├── Dockerfile        # Backend container
│   └── requirements.txt  # Python dependencies
├── frontend/             # React frontend
│   ├── src/              # Application code
│   ├── Dockerfile        # Frontend container
│   ├── nginx.conf        # Frontend nginx config
│   └── package.json      # Node.js dependencies
├── nginx/                # Load balancer configuration
├── scripts/              # Deployment and maintenance scripts
├── docker-compose.yml    # Multi-container orchestration
└── .env.example         # Environment configuration template
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_postgres_password
DATABASE_URL=postgresql://ca_dms_user:password@postgres:5432/ca_dms

# Backend API
SECRET_KEY=your-super-secret-key-minimum-32-characters-long
API_V1_STR=/api/v1

# External Services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Docker Configuration

The application uses Docker Compose profiles for different environments:

- **Development**: Basic setup with hot-reload
- **Staging**: Production-like setup for testing
- **Production**: Full production setup with scaling

## 🔧 Deployment Scripts

### Deploy Script (`scripts/deploy.sh`)
```bash
./scripts/deploy.sh [environment] [version]

# Examples:
./scripts/deploy.sh development latest
./scripts/deploy.sh production v1.0.0
```

Features:
- Environment-specific deployments
- Health checks and rollback
- Database migration
- Service scaling
- Build optimization

### Backup Script (`scripts/backup.sh`)
```bash
./scripts/backup.sh [retention_days]

# Example:
./scripts/backup.sh 30  # Keep backups for 30 days
```

Features:
- Database dumps
- File system backups
- Automated cleanup
- Compression

### Monitoring Script (`scripts/monitor.sh`)
```bash
./scripts/monitor.sh
```

Features:
- Service health checks
- Resource usage monitoring
- Log analysis
- Alert notifications
- Health reports

## 📊 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline (``.github/workflows/ci-cd.yml`) includes:

1. **Backend Testing**
   - Python dependencies
   - Database migrations
   - Unit and integration tests
   - Code quality checks (linting, formatting)
   - Test coverage reporting

2. **Frontend Testing**
   - Node.js dependencies
   - TypeScript compilation
   - Unit tests with coverage
   - E2E tests with Playwright
   - Build optimization

3. **Security Scanning**
   - Dependency vulnerability scans
   - Code analysis with CodeQL
   - Container security scanning

4. **Build & Package**
   - Multi-stage Docker builds
   - Image optimization
   - Registry publishing

5. **Integration Testing**
   - End-to-end system validation
   - Multi-service integration
   - Real-world scenario testing

6. **Deployment**
   - Staging deployment (develop branch)
   - Production deployment (main branch)
   - Health verification
   - Automatic rollback on failure

### Required Secrets

Configure these secrets in your GitHub repository:

```
DOCKER_USERNAME=your_docker_hub_username
DOCKER_PASSWORD=your_docker_hub_password
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SMTP_PASSWORD=your_email_password
```

## 🐳 Docker Configuration

### Backend Dockerfile
- Multi-stage build for optimization
- Non-root user security
- Health checks
- Production-ready uvicorn server

### Frontend Dockerfile
- Node.js build stage
- Nginx serving stage
- Static asset optimization
- Security headers

### Docker Compose Services
- **postgres**: Database with persistent storage
- **redis**: Cache and session management
- **backend**: API server with auto-scaling
- **frontend**: Web application
- **nginx**: Load balancer (production only)

## 🔒 Security

### Container Security
- Non-root user execution
- Minimal base images
- Regular security updates
- Vulnerability scanning

### Network Security
- Service isolation
- TLS/SSL encryption
- Rate limiting
- CORS configuration

### Data Security
- Database encryption at rest
- Backup encryption
- Secure secret management
- Audit logging

## 📈 Monitoring & Logging

### Health Checks
- Service endpoints: `/health`
- Database connectivity
- External service availability
- Resource usage monitoring

### Logging
- Structured JSON logging
- Centralized log aggregation
- Error tracking and alerting
- Performance monitoring

### Metrics
- Application performance
- Business metrics
- Infrastructure metrics
- User analytics

## 🔄 Backup & Recovery

### Automated Backups
```bash
# Daily backups (add to crontab)
0 2 * * * /path/to/ca-dms/scripts/backup.sh 7

# Weekly full backups
0 3 * * 0 /path/to/ca-dms/scripts/backup.sh 30
```

### Recovery Procedures
1. Stop services: `docker-compose down`
2. Restore database: `docker-compose exec postgres psql -U ca_dms_user -d ca_dms < backup.sql`
3. Restore files: `tar -xzf backup.tar.gz`
4. Restart services: `docker-compose up -d`

## 🚨 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check logs
docker-compose logs [service_name]

# Check health
./scripts/monitor.sh

# Restart services
docker-compose restart
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U ca_dms_user

# Reset database
docker-compose down -v
docker-compose up -d postgres
./scripts/deploy.sh development
```

#### Performance Issues
```bash
# Monitor resources
docker stats

# Check service health
./scripts/monitor.sh

# Scale services
docker-compose up -d --scale backend=3
```

### Emergency Procedures

#### Rollback Deployment
```bash
# Automatic rollback (if within deployment script)
# Script will automatically rollback on health check failure

# Manual rollback
docker-compose down
export IMAGE_TAG=previous_version
docker-compose up -d
```

#### Service Recovery
```bash
# Restart specific service
docker-compose restart [service_name]

# Rebuild and restart
docker-compose build [service_name]
docker-compose up -d [service_name]
```

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🤝 Support

For deployment issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Run monitoring script for diagnostics
4. Contact the development team

---

**Remember**: Always test deployments in staging before production, and maintain regular backups of your data.