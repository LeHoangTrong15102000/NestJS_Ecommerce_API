# GitHub Secrets Setup Guide

This guide provides step-by-step instructions for configuring all required GitHub Secrets for the CI/CD pipeline.

## Prerequisites

- GitHub repository with admin access
- Staging and production servers with SSH access
- Docker and Docker Compose installed on deployment servers

## Quick Setup Checklist

- [ ] Generate SSH key pairs for deployments
- [ ] Add public keys to deployment servers
- [ ] Configure GitHub repository secrets
- [ ] Set up GitHub environments (staging, production)
- [ ] Configure branch protection rules
- [ ] Test SSH connectivity
- [ ] Verify server prerequisites

## Step 1: Generate SSH Keys

Generate separate SSH key pairs for staging and production deployments.

### For Staging

```bash
# Generate staging SSH key (no passphrase for CI/CD automation)
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/github_actions_staging -N ""

# This creates two files:
# - ~/.ssh/github_actions_staging (private key)
# - ~/.ssh/github_actions_staging.pub (public key)
```

### For Production

```bash
# Generate production SSH key (no passphrase for CI/CD automation)
ssh-keygen -t ed25519 -C "github-actions-production" -f ~/.ssh/github_actions_production -N ""

# This creates two files:
# - ~/.ssh/github_actions_production (private key)
# - ~/.ssh/github_actions_production.pub (public key)
```

## Step 2: Add Public Keys to Servers

### Staging Server

```bash
# Display the public key
cat ~/.ssh/github_actions_staging.pub

# SSH to staging server
ssh your-user@staging.example.com

# Add the public key to authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

### Production Server

```bash
# Display the public key
cat ~/.ssh/github_actions_production.pub

# SSH to production server
ssh your-user@prod.example.com

# Add the public key to authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

## Step 3: Test SSH Connectivity

Verify that the SSH keys work before adding them to GitHub.

```bash
# Test staging connection
ssh -i ~/.ssh/github_actions_staging your-user@staging.example.com "echo 'Staging SSH works!'"

# Test production connection
ssh -i ~/.ssh/github_actions_production your-user@prod.example.com "echo 'Production SSH works!'"
```

If both commands succeed without password prompts, proceed to the next step.

## Step 4: Configure GitHub Repository Secrets

### Navigate to Secrets Settings

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Add Staging Secrets

#### STAGING_SSH_KEY

```bash
# Copy the private key content
cat ~/.ssh/github_actions_staging
```

- **Name:** `STAGING_SSH_KEY`
- **Value:** Paste the entire private key content (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines)

#### STAGING_HOST

- **Name:** `STAGING_HOST`
- **Value:** Your staging server hostname or IP address
- **Example:** `staging.example.com` or `192.168.1.100`

#### STAGING_USER

- **Name:** `STAGING_USER`
- **Value:** SSH username for staging server
- **Example:** `deploy` or `ubuntu` or `ec2-user`

#### STAGING_URL

- **Name:** `STAGING_URL`
- **Value:** Public URL of your staging API
- **Example:** `https://staging-api.example.com`

### Add Production Secrets

#### PROD_SSH_KEY

```bash
# Copy the private key content
cat ~/.ssh/github_actions_production
```

- **Name:** `PROD_SSH_KEY`
- **Value:** Paste the entire private key content (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines)

#### PROD_HOST

- **Name:** `PROD_HOST`
- **Value:** Your production server hostname or IP address
- **Example:** `prod.example.com` or `203.0.113.10`

#### PROD_USER

- **Name:** `PROD_USER`
- **Value:** SSH username for production server
- **Example:** `deploy` or `ubuntu` or `ec2-user`

#### PRODUCTION_URL

- **Name:** `PRODUCTION_URL`
- **Value:** Public URL of your production API
- **Example:** `https://api.example.com`

### Add Optional Secrets

#### CODECOV_TOKEN (Optional)

If you want to upload test coverage to Codecov:

1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. Copy the upload token

- **Name:** `CODECOV_TOKEN`
- **Value:** Your Codecov upload token

## Step 5: Configure GitHub Environments

Environments provide additional protection and approval workflows for deployments.

### Create Staging Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `staging`
4. Click **Configure environment**
5. **Protection rules:** Leave empty (auto-deploy)
6. **Environment secrets:** None needed (uses repository secrets)
7. **Deployment branches:** Select "Selected branches" → Add `master` or `main`
8. Click **Save protection rules**

### Create Production Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. Click **Configure environment**
5. **Protection rules:**
   - ✅ Check **Required reviewers**
   - Add team members who can approve production deployments
   - Optionally set **Wait timer** (e.g., 5 minutes)
6. **Environment secrets:** None needed (uses repository secrets)
7. **Deployment branches:** Select "Selected branches" → Add `master` or `main`
8. Click **Save protection rules**

## Step 6: Configure Branch Protection

Protect your main branch to ensure code quality.

1. Go to **Settings** → **Branches**
2. Click **Add rule** (or edit existing rule)
3. **Branch name pattern:** `master` or `main`
4. Enable the following:
   - ✅ **Require a pull request before merging**
     - Require approvals: 1
   - ✅ **Require status checks to pass before merging**
     - Search and add: `lint`
     - Search and add: `test`
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**
5. Click **Create** or **Save changes**

## Step 7: Prepare Deployment Servers

Each deployment server needs proper setup before the first deployment.

### Install Docker and Docker Compose

```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Create Application Directory

```bash
# Create application directory
sudo mkdir -p /opt/ecommerce-api
sudo chown $USER:$USER /opt/ecommerce-api
cd /opt/ecommerce-api

# Create necessary subdirectories
mkdir -p uploads prisma
```

### Copy Configuration Files

```bash
# Copy docker-compose.prod.yml from your repository
# You can use scp or git clone

# Option 1: Using scp from your local machine
scp docker-compose.prod.yml your-user@server:/opt/ecommerce-api/

# Option 2: Using git clone
cd /opt/ecommerce-api
git clone https://github.com/your-org/your-repo.git .
```

### Create Environment File

```bash
cd /opt/ecommerce-api

# Copy example and edit
cp .env.example .env
nano .env

# Fill in all required values:
# - Database credentials
# - Redis password
# - JWT secrets (generate with: openssl rand -base64 32)
# - Admin password
# - API keys
# - CORS origins
```

### Test Docker Login to GitHub Container Registry

```bash
# Create a GitHub Personal Access Token with read:packages scope
# Go to: Settings → Developer settings → Personal access tokens → Tokens (classic)
# Generate new token with 'read:packages' scope

# Test login
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify
docker pull ghcr.io/your-org/your-repo:latest
```

## Step 8: Verify Setup

### Test Pipeline Locally

Before pushing to GitHub, test the workflow locally:

```bash
# Install act (GitHub Actions local runner)
# macOS: brew install act
# Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run lint job
act -j lint

# Run test job (requires Docker)
act -j test
```

### Test First Deployment

1. Create a test branch:
   ```bash
   git checkout -b test-ci-cd
   git push origin test-ci-cd
   ```

2. Create a pull request to `master`/`main`

3. Verify that:
   - ✅ Lint job runs and passes
   - ✅ Test job runs and passes
   - ✅ Status checks appear on the PR

4. Merge the PR

5. Verify that:
   - ✅ Build job runs and creates Docker image
   - ✅ Security scan completes
   - ✅ Staging deployment succeeds
   - ✅ Production deployment waits for approval

6. Approve production deployment (if configured)

7. Verify deployment:
   ```bash
   # Check staging
   curl https://staging-api.example.com/health

   # Check production (after approval)
   curl https://api.example.com/health
   ```

## Troubleshooting

### SSH Connection Fails

**Error:** `Permission denied (publickey)`

**Solution:**
1. Verify public key is in `~/.ssh/authorized_keys` on server
2. Check file permissions: `chmod 600 ~/.ssh/authorized_keys`
3. Verify private key is correctly added to GitHub Secrets
4. Test SSH manually: `ssh -i ~/.ssh/github_actions_staging user@host`

### Docker Login Fails

**Error:** `unauthorized: authentication required`

**Solution:**
1. Verify GitHub token has `write:packages` permission
2. Check token hasn't expired
3. Ensure repository visibility matches token scope (public/private)

### Health Check Fails

**Error:** `curl: (7) Failed to connect to localhost port 3000`

**Solution:**
1. Check if container is running: `docker ps`
2. Check container logs: `docker logs ecom-api-prod`
3. Verify .env file has correct configuration
4. Check if port 3000 is exposed: `docker port ecom-api-prod`

### Migration Fails

**Error:** `Prisma migrate deploy failed`

**Solution:**
1. Check database connectivity from container
2. Verify DATABASE_URL is correct
3. Check if database user has migration permissions
4. Review migration files for syntax errors

## Security Best Practices

1. **Rotate SSH Keys Regularly**
   - Generate new keys every 90 days
   - Update GitHub Secrets and server authorized_keys

2. **Use Separate Keys for Each Environment**
   - Never reuse staging keys for production
   - Limit key permissions on servers

3. **Restrict SSH Access**
   - Use firewall rules to limit SSH access
   - Consider using bastion hosts for production

4. **Monitor Secret Usage**
   - Review GitHub Actions logs regularly
   - Set up alerts for failed deployments

5. **Audit Deployments**
   - Keep deployment logs
   - Track who approved production deployments

## Next Steps

After completing this setup:

1. ✅ Test the full CI/CD pipeline with a sample change
2. ✅ Set up monitoring and alerting for deployments
3. ✅ Document rollback procedures for your team
4. ✅ Schedule regular security audits
5. ✅ Train team members on the deployment process

## Support

If you encounter issues:

1. Check GitHub Actions logs for detailed error messages
2. Review server logs: `docker-compose logs`
3. Verify all secrets are correctly configured
4. Test SSH connectivity manually
5. Consult the main README.md in `.github/workflows/`

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [SSH Key Generation Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
