# Production Deployment Guide

This guide covers deploying the NestJS Ecommerce API to production using Docker Compose.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2.0+
- Server with minimum 2GB RAM, 2 CPU cores, 20GB disk space
- Domain name with DNS configured (for production)
- SSL/TLS certificates (recommended for production)

## Quick Start

### 1. Prepare Environment Configuration

Copy the production environment template:

```bash
cp .env.production.template .env
```

Edit `.env` and replace all placeholder values with actual production secrets:

```bash
# Generate secure secrets
openssl rand -base64 32  # Use for ACCESS_TOKEN_SECRET
openssl rand -base64 32  # Use for REFRESH_TOKEN_SECRET
openssl rand -base64 32  # Use for SECRET_API_KEY
openssl rand -base64 24  # Use for POSTGRES_PASSWORD
openssl rand -base64 24  # Use for REDIS_PASSWORD
```

**Required Variables** (deployment will fail if missing):

- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis authentication password
- `ACCESS_TOKEN_SECRET` - JWT access token secret (min 32 chars)
- `REFRESH_TOKEN_SECRET` - JWT refresh token secret (min 32 chars)
- `SECRET_API_KEY` - API secret key (min 32 chars)
- `ADMIN_PASSWORD` - Admin user password
- `API_URL` - Public API URL (e.g., https://api.yourdomain.com)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### 2. Verify Configuration

Validate that all required environment variables are set:

```bash
# Check for required variables
docker-compose -f docker-compose.prod.yml config
```

If any required variable is missing, you'll see an error message.

### 3. Deploy Services

Start all services in production mode:

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services in detached mode
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Run Database Migrations

After services are running, apply database migrations:

```bash
docker-compose -f docker-compose.prod.yml exec api pnpm prisma migrate deploy
```

### 5. Verify Deployment

Check service health:

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","services":{...}}
```

## Configuration Details

### Resource Limits

Each service has defined resource limits to prevent resource exhaustion:

| Service    | CPU Limit | Memory Limit | CPU Reserved | Memory Reserved |
| ---------- | --------- | ------------ | ------------ | --------------- |
| API        | 1.0 cores | 1GB          | 0.5 cores    | 512MB           |
| PostgreSQL | 1.0 cores | 1GB          | 0.25 cores   | 512MB           |
| Redis      | 0.5 cores | 256MB        | 0.1 cores    | 128MB           |

Adjust these limits in `docker-compose.prod.yml` based on your workload.

### Health Checks

All services include health checks for monitoring:

- **PostgreSQL**: `pg_isready` check every 10s
- **Redis**: `redis-cli ping` with authentication every 10s
- **API**: HTTP GET `/health` endpoint every 30s

Unhealthy containers will be automatically restarted.

### Restart Policies

All services use `restart: unless-stopped` policy:

- Containers restart automatically on failure
- Containers don't restart if manually stopped
- Containers restart on system reboot

### Logging Configuration

Logs use JSON format with rotation:

- Driver: `json-file`
- Max size per file: 10MB
- Max files retained: 3
- Total max log size: 30MB per service

View logs:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api
```

### Redis Authentication

Redis is configured with password authentication:

```bash
# Redis connection format
redis://:PASSWORD@redis:6379

# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_REDIS_PASSWORD ping
```

The API automatically uses the authenticated connection via `REDIS_URL` environment variable.

## Security Best Practices

### 1. Secret Management

- **Never commit `.env` files** to version control
- Use strong, randomly generated passwords (min 16 characters)
- Rotate secrets every 90 days
- Use different secrets for each environment (dev, staging, prod)
- Consider using external secret management (AWS Secrets Manager, HashiCorp Vault)

### 2. Network Security

- Services communicate via internal Docker network
- Only expose necessary ports to host
- Use firewall rules to restrict external access
- Enable SSL/TLS for public endpoints
- Configure CORS with specific allowed origins (no wildcards)

### 3. Database Security

- Use strong database password
- Limit database user permissions
- Enable SSL for database connections (if using external database)
- Regular database backups
- Keep PostgreSQL updated

### 4. Container Security

- Containers run with resource limits
- Health checks enable automatic recovery
- Logs are rotated to prevent disk exhaustion
- Use official Alpine-based images (smaller attack surface)

## Monitoring and Maintenance

### Check Service Status

```bash
# View running containers
docker-compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats

# View service health
docker inspect ecom-api-prod | grep -A 10 Health
```

### Database Backup

```bash
# Backup PostgreSQL database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U ecom_user ecom_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ecom_user ecom_db < backup_20260311_120000.sql
```

### Update Application

```bash
# Pull latest code
git pull origin master

# Rebuild and restart API service
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec api pnpm prisma migrate deploy
```

### Scale Services

```bash
# Scale API to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Note: Requires load balancer configuration
```

## Troubleshooting

### Service Won't Start

Check logs for errors:

```bash
docker-compose -f docker-compose.prod.yml logs api
```

Common issues:

- Missing required environment variables
- Database connection failure
- Port already in use
- Insufficient resources

### Database Connection Errors

Verify database is healthy:

```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U ecom_user
```

Check connection string:

```bash
docker-compose -f docker-compose.prod.yml exec api env | grep DATABASE_URL
```

### Redis Connection Errors

Test Redis authentication:

```bash
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_REDIS_PASSWORD ping
```

Verify REDIS_URL format:

```bash
# Correct format: redis://:password@redis:6379
docker-compose -f docker-compose.prod.yml exec api env | grep REDIS_URL
```

### Health Check Failures

Check health endpoint directly:

```bash
curl -v http://localhost:3000/health
```

If health check fails:

1. Check database connectivity
2. Check Redis connectivity
3. Review application logs
4. Verify all required services are running

### Out of Memory

If containers are killed due to OOM:

1. Check resource usage: `docker stats`
2. Increase memory limits in `docker-compose.prod.yml`
3. Optimize application memory usage
4. Add swap space to host

### Disk Space Issues

Check disk usage:

```bash
# Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes
```

Rotate logs manually:

```bash
docker-compose -f docker-compose.prod.yml logs --no-log-prefix > /dev/null
```

## Rollback Procedure

If deployment fails:

```bash
# Stop new deployment
docker-compose -f docker-compose.prod.yml down

# Restore previous database backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ecom_user ecom_db < backup_previous.sql

# Checkout previous version
git checkout <previous-commit-sha>

# Rebuild and start
docker-compose -f docker-compose.prod.yml up -d --build
```

## Production Checklist

Before deploying to production:

- [ ] All required environment variables configured in `.env`
- [ ] Strong, unique passwords generated for all secrets
- [ ] Database backup strategy implemented
- [ ] SSL/TLS certificates configured (if applicable)
- [ ] CORS origins configured with actual domain names
- [ ] Firewall rules configured to restrict access
- [ ] Monitoring and alerting configured
- [ ] Log aggregation configured (optional)
- [ ] Tested deployment in staging environment
- [ ] Rollback procedure documented and tested
- [ ] Team trained on deployment and troubleshooting

## Advanced Configuration

### Using External Database

To use an external PostgreSQL database instead of the containerized one:

1. Remove `postgres` service from `docker-compose.prod.yml`
2. Set `DATABASE_URL` directly in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@external-host:5432/database?schema=public
   ```
3. Update API service `depends_on` to remove postgres dependency

### Using External Redis

To use an external Redis instance:

1. Remove `redis` service from `docker-compose.prod.yml`
2. Set `REDIS_URL` directly in `.env`:
   ```
   REDIS_URL=redis://:password@external-redis-host:6379
   ```
3. Update API service `depends_on` to remove redis dependency

### SSL/TLS Configuration

For production, use a reverse proxy (Nginx, Traefik, Caddy) to handle SSL/TLS:

```yaml
# Example Nginx configuration
server {
listen 443 ssl http2;
server_name api.yourdomain.com;

ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;

location / {
proxy_pass http://localhost:3000;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
}
}
```

## Support

For issues and questions:

- Check application logs: `docker-compose -f docker-compose.prod.yml logs`
- Review this documentation
- Check GitHub issues
- Contact development team

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [NestJS Documentation](https://docs.nestjs.com/)
