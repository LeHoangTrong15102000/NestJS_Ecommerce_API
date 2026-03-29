# CI/CD Pipeline Quick Reference

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐                                │
│  │   Lint   │     │   Test   │  ← Run in parallel             │
│  └────┬─────┘     └────┬─────┘                                │
│       │                │                                        │
│       └────────┬───────┘                                        │
│                ↓                                                │
│         ┌──────────────┐                                        │
│         │    Build     │  ← Only on main branch                │
│         └──────┬───────┘                                        │
│                ↓                                                │
│         ┌──────────────┐                                        │
│         │ Security Scan│  ← Trivy vulnerability scan           │
│         └──────┬───────┘                                        │
│                ↓                                                │
│         ┌──────────────┐                                        │
│         │Deploy Staging│  ← Automatic deployment               │
│         └──────┬───────┘                                        │
│                ↓                                                │
│         ┌──────────────┐                                        │
│         │Deploy Prod   │  ← Requires manual approval           │
│         └──────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Trigger Conditions

| Event | Lint | Test | Build | Security | Deploy Staging | Deploy Prod |
|-------|------|------|-------|----------|----------------|-------------|
| Push to feature branch | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pull request to main | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Push to main branch | ✅ | ✅ | ✅ | ✅ | ✅ | ⏸️ (manual) |

## Required Secrets

### Container Registry
- `GITHUB_TOKEN` - Auto-provided by GitHub Actions

### Staging Environment
- `STAGING_SSH_KEY` - Private SSH key for staging server
- `STAGING_HOST` - Staging server hostname/IP
- `STAGING_USER` - SSH username for staging
- `STAGING_URL` - Public staging API URL

### Production Environment
- `PROD_SSH_KEY` - Private SSH key for production server
- `PROD_HOST` - Production server hostname/IP
- `PROD_USER` - SSH username for production
- `PRODUCTION_URL` - Public production API URL

### Optional
- `CODECOV_TOKEN` - For test coverage reporting

## Job Details

### 1. Lint (2-3 minutes)

**Purpose:** Code quality checks

**Steps:**
- Checkout code
- Setup Node.js 20.x and pnpm
- Install dependencies (cached)
- Run ESLint
- Check Prettier formatting

**Failure Reasons:**
- ESLint errors
- Prettier formatting issues
- Dependency installation fails

**Fix:**
```bash
pnpm run lint
pnpm exec prettier --write "src/**/*.ts" "test/**/*.ts"
```

### 2. Test (4-6 minutes)

**Purpose:** Run unit and integration tests

**Services:**
- PostgreSQL 17 (test database)
- Redis 7 (test cache)

**Steps:**
- Checkout code
- Setup Node.js 20.x and pnpm
- Install dependencies (cached)
- Generate Prisma client
- Run database migrations
- Execute tests with coverage
- Upload coverage to Codecov

**Failure Reasons:**
- Test failures
- Database connection issues
- Redis connection issues
- Migration failures

**Fix:**
```bash
# Run tests locally
docker-compose up -d postgres redis
export DATABASE_URL="postgresql://test_user:test_password@localhost:5432/test_db"
pnpm run test:cov
```

### 3. Build (3-5 minutes)

**Purpose:** Build and push Docker image

**Triggers:** Only on push to main branch

**Steps:**
- Checkout code
- Setup Docker Buildx
- Login to GitHub Container Registry
- Extract metadata (tags, labels)
- Build multi-stage Docker image
- Push to ghcr.io with multiple tags

**Image Tags:**
- `latest` - Latest build from main
- `main-<sha>` - Specific commit
- `v0.0.1` - Semantic version

**Failure Reasons:**
- Docker build errors
- Registry authentication fails
- Insufficient permissions

**Fix:**
```bash
# Test build locally
docker build -t test-image --target production .
docker run --rm test-image node --version
```

### 4. Security Scan (2-3 minutes)

**Purpose:** Scan Docker image for vulnerabilities

**Triggers:** Only after successful build

**Tool:** Trivy by Aqua Security

**Scans For:**
- OS package vulnerabilities
- Application dependency vulnerabilities
- Misconfigurations
- Exposed secrets

**Severity Levels:**
- `CRITICAL` - Blocks deployment
- `HIGH` - Blocks deployment
- `MEDIUM` - Warning only
- `LOW` - Informational

**Outputs:**
- SARIF report to GitHub Security tab
- Table format in Actions logs

**Failure Reasons:**
- Critical vulnerabilities found
- High severity vulnerabilities found

**Fix:**
```bash
# Update dependencies
pnpm update

# Update base image in Dockerfile
# FROM node:20-alpine (use latest patch version)
```

### 5. Deploy Staging (2-4 minutes)

**Purpose:** Deploy to staging environment

**Triggers:** Only after successful security scan

**Environment:** `staging` (no approval required)

**Steps:**
- Setup SSH key
- Add host to known_hosts
- SSH to staging server
- Pull latest Docker image
- Run database migrations
- Restart API container (zero-downtime)
- Wait for health check
- Cleanup old images
- Verify deployment via health endpoint

**Failure Reasons:**
- SSH connection fails
- Docker pull fails
- Migration fails
- Health check fails
- Server out of disk space

**Fix:**
```bash
# SSH to staging server
ssh deploy@staging.example.com

# Check logs
cd /opt/ecommerce-api
docker-compose -f docker-compose.prod.yml logs api

# Check disk space
df -h

# Manual deployment
docker pull ghcr.io/your-org/your-repo:latest
docker-compose -f docker-compose.prod.yml up -d --no-deps api
```

### 6. Deploy Production (2-4 minutes)

**Purpose:** Deploy to production environment

**Triggers:** Only after successful staging deployment

**Environment:** `production` (requires manual approval)

**Approval Required:**
- Designated team members must approve
- Optional wait timer (e.g., 5 minutes)

**Steps:**
- Wait for manual approval
- Setup SSH key
- Add host to known_hosts
- SSH to production server
- Pull latest Docker image
- Run database migrations
- Restart API container (zero-downtime)
- Wait for health check
- Cleanup old images
- Verify deployment via health endpoint
- Create deployment tag

**Failure Reasons:**
- Same as staging deployment
- Approval timeout
- Approval rejected

**Fix:**
- Same as staging deployment
- Review approval requirements
- Check production server health

## Common Commands

### View Pipeline Status
```bash
# Via GitHub CLI
gh run list
gh run view <run-id>
gh run watch
```

### Manual Deployment
```bash
# SSH to server
ssh deploy@prod.example.com
cd /opt/ecommerce-api

# Pull and deploy
docker pull ghcr.io/your-org/your-repo:latest
docker-compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker-compose -f docker-compose.prod.yml up -d --no-deps api

# Verify
curl http://localhost:3000/health
```

### Rollback Deployment
```bash
# SSH to server
ssh deploy@prod.example.com
cd /opt/ecommerce-api

# Find previous image
docker images | grep ghcr.io/your-org/your-repo

# Use previous tag
export IMAGE_TAG="main-previous-sha"
docker-compose -f docker-compose.prod.yml up -d --no-deps api

# Verify
curl http://localhost:3000/health
```

### View Logs
```bash
# GitHub Actions logs
gh run view <run-id> --log

# Server logs
ssh deploy@prod.example.com
docker-compose -f docker-compose.prod.yml logs -f api
```

### Re-run Failed Job
```bash
# Via GitHub CLI
gh run rerun <run-id>

# Re-run only failed jobs
gh run rerun <run-id> --failed
```

## Performance Benchmarks

| Job | Expected Duration | Timeout |
|-----|------------------|---------|
| Lint | 2-3 minutes | 10 minutes |
| Test | 4-6 minutes | 15 minutes |
| Build | 3-5 minutes | 20 minutes |
| Security Scan | 2-3 minutes | 10 minutes |
| Deploy Staging | 2-4 minutes | 10 minutes |
| Deploy Production | 2-4 minutes | 10 minutes |
| **Total Pipeline** | **15-25 minutes** | **75 minutes** |

## Caching Strategy

### pnpm Dependencies
- **Cache Key:** `pnpm-lock.yaml` hash
- **Cache Location:** `~/.pnpm-store`
- **Hit Rate:** ~95% (only misses on dependency updates)

### Docker Layers
- **Cache Type:** GitHub Actions cache (`type=gha`)
- **Cache Scope:** Per branch
- **Max Size:** 10 GB
- **Hit Rate:** ~80% (misses on Dockerfile changes)

### Prisma Client
- **Generated During:** Build stage
- **Included In:** Docker image
- **No Separate Cache:** Regenerated on each build

## Monitoring

### Health Checks

**Staging:**
```bash
curl https://staging-api.example.com/health
```

**Production:**
```bash
curl https://api.example.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "up", "responseTime": 5 },
    "redis": { "status": "up", "responseTime": 2 },
    "application": { "status": "up" }
  },
  "uptime": 3600,
  "version": "0.0.1"
}
```

### Container Status
```bash
# Check running containers
docker ps

# Check resource usage
docker stats

# Check logs
docker-compose logs -f api
```

### GitHub Actions Metrics
- View in repository **Insights** → **Actions**
- Track success rate, duration, and failures
- Set up notifications for failed runs

## Notifications

### Setup Slack Notifications (Optional)

Add to workflow:
```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Deployment failed: ${{ github.repository }} - ${{ github.ref }}"
      }
```

### Setup Email Notifications

1. Go to **Settings** → **Notifications**
2. Enable **Actions** notifications
3. Choose notification preferences

## Best Practices

1. **Always create PRs for changes**
   - Never push directly to main
   - Ensure tests pass before merging

2. **Monitor deployment health**
   - Check health endpoint after deployment
   - Review logs for errors

3. **Keep dependencies updated**
   - Run `pnpm update` regularly
   - Review security advisories

4. **Test locally before pushing**
   - Run `pnpm run lint`
   - Run `pnpm run test:cov`
   - Build Docker image locally

5. **Document deployment issues**
   - Create issues for failed deployments
   - Update runbooks with solutions

## Troubleshooting Checklist

- [ ] Check GitHub Actions logs for error messages
- [ ] Verify all secrets are configured correctly
- [ ] Test SSH connectivity to servers
- [ ] Check server disk space and resources
- [ ] Verify Docker and Docker Compose versions
- [ ] Check .env file on servers
- [ ] Review recent code changes
- [ ] Check database connectivity
- [ ] Verify Redis connectivity
- [ ] Review security scan results

## Support

For issues with the CI/CD pipeline:

1. Check this quick reference
2. Review detailed README in `.github/workflows/`
3. Check GitHub Actions logs
4. Test deployment steps manually
5. Contact DevOps team

## Additional Resources

- [Full CI/CD Documentation](.github/workflows/README.md)
- [Secrets Setup Guide](.github/SECRETS_SETUP.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
