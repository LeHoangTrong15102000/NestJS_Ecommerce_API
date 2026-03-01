# 🐳 Docker Workflow Trong Thực Tế - Giải Thích Chi Tiết

## Mục Lục

1. [Tổng Quan Docker Ecosystem](#1-tổng-quan-docker-ecosystem)
2. [Dockerfile - Khi Nào Sử Dụng?](#2-dockerfile---khi-nào-sử-dụng)
3. [Docker Image - Cách Tạo và Quản Lý](#3-docker-image---cách-tạo-và-quản-lý)
4. [Container Registry - Lưu Trữ và Chia Sẻ](#4-container-registry---lưu-trữ-và-chia-sẻ)
5. [Docker Compose - Vai Trò Thực Tế](#5-docker-compose---vai-trò-thực-tế)
6. [Workflow Thực Tế Trong Team](#6-workflow-thực-tế-trong-team)
7. [Production Deployment](#7-production-deployment)
8. [Best Practices](#8-best-practices)

---

## 1. Tổng Quan Docker Ecosystem

### 1.1 Các Thành Phần Chính

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCKER ECOSYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   📄 Dockerfile          →    🖼️ Docker Image    →    📦 Container     │
│   (Source Code)               (Build Artifact)        (Running Instance)│
│                                                                         │
│                                    ↓                                    │
│                          🏪 Container Registry                          │
│                    (Docker Hub, ECR, GCR, ACR...)                       │
│                                                                         │
│   📋 docker-compose.yml  →    🎭 Multi-Container Orchestration          │
│   (Service Definition)        (Dev/Test Environment)                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Mối Quan Hệ Giữa Các Thành Phần

| Thành Phần         | Vai Trò                      | Tương Tự Với                |
| ------------------ | ---------------------------- | --------------------------- |
| **Dockerfile**     | "Recipe" để build image      | Source code                 |
| **Docker Image**   | "Snapshot" của application   | Compiled binary/JAR         |
| **Container**      | Instance đang chạy của image | Running process             |
| **Registry**       | Nơi lưu trữ images           | npm registry, Maven Central |
| **docker-compose** | Định nghĩa multi-container   | Infrastructure as Code      |

---

## 2. Dockerfile - Khi Nào Sử Dụng?

### 2.1 Dockerfile Là Gì?

Dockerfile là một **text file chứa các instructions** để Docker build một image. Nó giống như một "recipe" mô tả:

- Base image (OS, runtime)
- Dependencies cần cài đặt
- Source code cần copy
- Commands để chạy application

### 2.2 Khi Nào CẦN Dockerfile?

#### ✅ **Trường Hợp 1: Custom Application**

Khi bạn có application tự viết (như NestJS API này):

```dockerfile
# Dockerfile cho NestJS Ecommerce API
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

#### ✅ **Trường Hợp 2: Customize Official Image**

Khi cần thêm tools/config vào official image:

```dockerfile
FROM postgres:17-alpine
# Thêm extensions
RUN apk add --no-cache postgresql-contrib
COPY init-scripts/ /docker-entrypoint-initdb.d/
```

#### ✅ **Trường Hợp 3: Multi-stage Build**

Khi cần optimize image size:

```dockerfile
# Stage 1: Build
FROM node:20 AS build
# ... build steps

# Stage 2: Production (chỉ copy artifacts cần thiết)
FROM node:20-alpine AS production
# ... chỉ copy dist và node_modules
```

### 2.3 Khi Nào KHÔNG CẦN Dockerfile?

#### ❌ **Sử dụng Official Images trực tiếp**

```yaml
# docker-compose.yml - Không cần Dockerfile
services:
  postgres:
    image: postgres:17-alpine # Dùng trực tiếp từ Docker Hub
  redis:
    image: redis:7-alpine # Dùng trực tiếp từ Docker Hub
```

---

## 3. Docker Image - Cách Tạo và Quản Lý

### 3.1 Build Image từ Dockerfile

```bash
# Cú pháp cơ bản
docker build -t <image-name>:<tag> <path-to-dockerfile>

# Ví dụ thực tế
docker build -t nestjs-ecommerce-api:1.0.0 .
docker build -t nestjs-ecommerce-api:latest .

# Build với build arguments
docker build \
  --build-arg NODE_ENV=production \
  --build-arg API_VERSION=1.0.0 \
  -t nestjs-ecommerce-api:1.0.0 .
```

### 3.2 Image Layers và Caching

```
┌─────────────────────────────────────────┐
│ Layer 5: CMD ["node", "dist/main.js"]   │  ← Thay đổi ít
├─────────────────────────────────────────┤
│ Layer 4: COPY dist/ ./dist/             │  ← Thay đổi mỗi build
├─────────────────────────────────────────┤
│ Layer 3: RUN pnpm install               │  ← Cache nếu package.json không đổi
├─────────────────────────────────────────┤
│ Layer 2: COPY package*.json ./          │  ← Thay đổi khi thêm dependency
├─────────────────────────────────────────┤
│ Layer 1: FROM node:20-alpine            │  ← Base image (cached)
└─────────────────────────────────────────┘
```

### 3.3 Tagging Strategy

```bash
# Semantic Versioning
docker tag nestjs-api:latest myregistry/nestjs-api:1.0.0
docker tag nestjs-api:latest myregistry/nestjs-api:1.0
docker tag nestjs-api:latest myregistry/nestjs-api:1

# Git-based Tagging
docker tag nestjs-api:latest myregistry/nestjs-api:$(git rev-parse --short HEAD)
docker tag nestjs-api:latest myregistry/nestjs-api:main-abc1234

# Environment-based
docker tag nestjs-api:latest myregistry/nestjs-api:staging
docker tag nestjs-api:latest myregistry/nestjs-api:production
```

---

## 4. Container Registry - Lưu Trữ và Chia Sẻ

### 4.1 Registry Là Gì?

Container Registry là **"kho lưu trữ" cho Docker images**, tương tự như:

- **npm registry** cho Node.js packages
- **Maven Central** cho Java libraries
- **PyPI** cho Python packages

### 4.2 Các Loại Registry Phổ Biến

| Registry                         | Provider     | Use Case                   | Pricing            |
| -------------------------------- | ------------ | -------------------------- | ------------------ |
| **Docker Hub**                   | Docker Inc.  | Public images, small teams | Free tier + Paid   |
| **Amazon ECR**                   | AWS          | AWS ecosystem              | Pay per usage      |
| **Google GCR/Artifact Registry** | Google Cloud | GCP ecosystem              | Pay per usage      |
| **Azure ACR**                    | Microsoft    | Azure ecosystem            | Pay per usage      |
| **GitHub Container Registry**    | GitHub       | GitHub integration         | Free for public    |
| **GitLab Container Registry**    | GitLab       | GitLab CI/CD               | Included           |
| **Harbor**                       | CNCF         | Self-hosted, Enterprise    | Free (Open Source) |
| **JFrog Artifactory**            | JFrog        | Enterprise, Multi-format   | Paid               |

### 4.3 Push Image Lên Registry

```bash
# 1. Login vào registry
docker login                                    # Docker Hub
docker login <account-id>.dkr.ecr.<region>.amazonaws.com  # AWS ECR
docker login ghcr.io                            # GitHub Container Registry

# 2. Tag image với registry prefix
docker tag nestjs-api:1.0.0 mycompany/nestjs-api:1.0.0

# 3. Push lên registry
docker push mycompany/nestjs-api:1.0.0

# 4. Team members pull về
docker pull mycompany/nestjs-api:1.0.0
```

### 4.4 Private vs Public Registry

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REGISTRY TYPES                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🌍 PUBLIC REGISTRY (Docker Hub Public)                                 │
│  ├── Ai cũng có thể pull                                                │
│  ├── Phù hợp: Open source projects, public tools                        │
│  └── Ví dụ: postgres:17, redis:7, node:20                               │
│                                                                          │
│  🔒 PRIVATE REGISTRY (ECR, GCR, Private Docker Hub)                     │
│  ├── Cần authentication để pull/push                                    │
│  ├── Phù hợp: Company applications, proprietary code                    │
│  └── Ví dụ: mycompany/nestjs-api:1.0.0                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Docker Compose - Vai Trò Thực Tế

### 5.1 Docker Compose Là Gì?

Docker Compose là tool để **định nghĩa và chạy multi-container applications**. Nó giải quyết vấn đề:

- Chạy nhiều containers cùng lúc
- Định nghĩa networking giữa containers
- Quản lý volumes và environment variables
- Reproducible development environment

### 5.2 Khi Nào Sử Dụng Docker Compose?

#### ✅ **Development Environment (Phổ biến nhất)**

```yaml
# docker-compose.yml - Development
services:
  api:
    build: . # Build từ Dockerfile local
    ports:
      - '3000:3000'
    volumes:
      - .:/app # Hot reload
      - /app/node_modules # Exclude node_modules
    environment:
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:17-alpine # Dùng official image
    environment:
      POSTGRES_DB: ecom_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
```

#### ✅ **Testing Environment**

```yaml
# docker-compose.test.yml
services:
  api:
    build:
      context: .
      target: test # Multi-stage build target
    command: pnpm test:integration
    depends_on:
      postgres-test:
        condition: service_healthy

  postgres-test:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: test_db
    tmpfs:
      - /var/lib/postgresql/data # In-memory for speed
```

#### ✅ **Local Production Simulation**

```yaml
# docker-compose.prod.yml
services:
  api:
    image: mycompany/nestjs-api:1.0.0 # Pull từ registry
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
```

### 5.3 Khi Nào KHÔNG Dùng Docker Compose?

| Scenario                         | Thay Thế Bằng                                   |
| -------------------------------- | ----------------------------------------------- |
| **Production với nhiều servers** | Kubernetes, Docker Swarm, ECS                   |
| **Single container đơn giản**    | `docker run` trực tiếp                          |
| **Cloud-native deployment**      | AWS ECS, Google Cloud Run, Azure Container Apps |
| **Large-scale orchestration**    | Kubernetes (K8s)                                |

---

## 6. Workflow Thực Tế Trong Team

### 6.1 Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  👨‍💻 Developer A                                                         │
│  │                                                                       │
│  ├── 1. Clone repo (có Dockerfile + docker-compose.yml)                 │
│  │                                                                       │
│  ├── 2. docker-compose up -d                                            │
│  │      → Tự động build image từ Dockerfile                             │
│  │      → Pull postgres, redis từ Docker Hub                            │
│  │      → Start tất cả services                                         │
│  │                                                                       │
│  ├── 3. Develop features với hot reload                                 │
│  │                                                                       │
│  └── 4. Commit code (KHÔNG commit image)                                │
│                                                                          │
│  👩‍💻 Developer B                                                         │
│  │                                                                       │
│  ├── 1. Pull latest code                                                │
│  │                                                                       │
│  └── 2. docker-compose up -d                                            │
│         → Cùng environment như Developer A                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 CI/CD Workflow (Production)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CI/CD PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📝 Developer pushes code to main branch                                │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────┐                            │
│  │         CI SERVER (GitHub Actions)       │                            │
│  │                                          │                            │
│  │  1. Checkout code                        │                            │
│  │  2. Run tests                            │                            │
│  │  3. docker build -t api:$SHA .           │                            │
│  │  4. docker push registry/api:$SHA        │                            │
│  │  5. docker push registry/api:latest      │                            │
│  └─────────────────────────────────────────┘                            │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────┐                            │
│  │       CONTAINER REGISTRY (ECR/GCR)       │                            │
│  │                                          │                            │
│  │  📦 api:abc1234                          │                            │
│  │  📦 api:latest                           │                            │
│  │  📦 api:1.0.0                            │                            │
│  └─────────────────────────────────────────┘                            │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────┐                            │
│  │      PRODUCTION (K8s/ECS/Cloud Run)      │                            │
│  │                                          │                            │
│  │  kubectl set image deployment/api        │                            │
│  │    api=registry/api:abc1234              │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 GitHub Actions Example

```yaml
# .github/workflows/docker-build.yml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            mycompany/nestjs-api:${{ github.sha }}
            mycompany/nestjs-api:latest
```

---

## 7. Production Deployment

### 7.1 Docker Compose KHÔNG Dùng Cho Production Thực Sự

**Lý do:**

- Không có auto-scaling
- Không có self-healing (restart failed containers)
- Không có rolling updates
- Single point of failure
- Không có load balancing built-in

### 7.2 Production Alternatives

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ORCHESTRATION OPTIONS                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🎯 KUBERNETES (K8s)                                                    │
│  ├── Industry standard                                                  │
│  ├── Auto-scaling, self-healing, rolling updates                        │
│  ├── Complex setup, steep learning curve                                │
│  └── Best for: Large-scale, microservices                               │
│                                                                         │
│  ☁️ AWS ECS (Elastic Container Service)                                 │
│  ├── AWS-native, simpler than K8s                                       │
│  ├── Fargate (serverless) or EC2 launch types                           │
│  └── Best for: AWS-centric teams                                        │
│                                                                         │
│  🚀 Google Cloud Run                                                    │
│  ├── Serverless containers                                              │
│  ├── Scale to zero, pay per request                                     │
│  └── Best for: Stateless APIs, cost optimization                        │
│                                                                         │
│  🔷 Azure Container Apps                                                │
│  ├── Serverless Kubernetes                                              │
│  ├── Built-in Dapr support                                              │
│  └── Best for: Azure ecosystem                                          │
│                                                                         │
│  🐝 Docker Swarm                                                        │
│  ├── Simple orchestration                                               │
│  ├── Built into Docker                                                  │
│  └── Best for: Small teams, simple deployments                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Kubernetes Deployment Example

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nestjs-api
  template:
    metadata:
      labels:
        app: nestjs-api
    spec:
      containers:
        - name: api
          image: mycompany/nestjs-api:1.0.0
          ports:
            - containerPort: 3000
          resources:
            limits:
              memory: '512Mi'
              cpu: '500m'
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
---
apiVersion: v1
kind: Service
metadata:
  name: nestjs-api-service
spec:
  selector:
    app: nestjs-api
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

---

## 8. Best Practices

### 8.1 Dockerfile Best Practices

```dockerfile
# ✅ GOOD: Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
# Chỉ copy những gì cần thiết
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# ✅ Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 8.2 .dockerignore

```dockerignore
# .dockerignore
node_modules
npm-debug.log
dist
.git
.gitignore
.env
.env.*
*.md
test
coverage
.nyc_output
```

### 8.3 Security Best Practices

| Practice                 | Mô Tả                                       |
| ------------------------ | ------------------------------------------- |
| **Use specific tags**    | `node:20.11.0-alpine` thay vì `node:latest` |
| **Non-root user**        | Chạy container với user không phải root     |
| **Scan images**          | Dùng `docker scout`, `trivy`, `snyk`        |
| **Minimal base image**   | Alpine, distroless, scratch                 |
| **No secrets in image**  | Dùng environment variables, secrets manager |
| **Read-only filesystem** | `--read-only` flag khi có thể               |

### 8.4 Image Size Optimization

```bash
# So sánh image sizes
node:20           ~1GB
node:20-slim      ~200MB
node:20-alpine    ~130MB
distroless/nodejs ~100MB
```

---

## 9. Tổng Kết

### 9.1 Trả Lời Câu Hỏi Của Bạn

| Câu Hỏi                           | Trả Lời                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Dockerfile dùng khi nào?**      | Khi cần build custom image cho application của bạn                                                             |
| **Có dùng docker-compose không?** | ✅ Development: Có (rất phổ biến) <br> ❌ Production: Không (dùng K8s, ECS...)                                 |
| **Từ Dockerfile tạo ra image?**   | Đúng! `docker build` → Image                                                                                   |
| **Image lưu vào hub?**            | Đúng! Push lên registry (Docker Hub, ECR, GCR...)                                                              |
| **Share cho team?**               | ✅ Development: Share Dockerfile + docker-compose.yml (qua Git) <br> ✅ Production: Share Image (qua Registry) |

### 9.2 Workflow Tóm Tắt

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📁 SOURCE CODE                                                         │
│  ├── Dockerfile              ← Định nghĩa cách build                    │
│  ├── docker-compose.yml      ← Định nghĩa dev environment               │
│  └── .dockerignore           ← Exclude files không cần                  │
│           │                                                              │
│           │ git push                                                     │
│           ▼                                                              │
│  🔄 CI/CD PIPELINE                                                      │
│  ├── docker build            ← Tạo image                                │
│  ├── docker push             ← Push lên registry                        │
│           │                                                              │
│           ▼                                                              │
│  📦 CONTAINER REGISTRY                                                  │
│  ├── mycompany/api:1.0.0     ← Versioned image                          │
│  ├── mycompany/api:latest    ← Latest image                             │
│           │                                                              │
│           │ docker pull (by orchestrator)                               │
│           ▼                                                              │
│  🚀 PRODUCTION                                                          │
│  └── Kubernetes / ECS / Cloud Run                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Áp Dụng Cho Dự Án NestJS Ecommerce API

Dự án hiện tại đã có:

- ✅ `Dockerfile` - Để build NestJS API image
- ✅ `docker-compose.yml` - Để chạy dev environment (API + PostgreSQL + Redis)

**Để deploy production:**

1. Setup CI/CD (GitHub Actions)
2. Push image lên registry (ECR/GCR/Docker Hub)
3. Deploy lên Kubernetes/ECS/Cloud Run

---

## 10. Câu Hỏi Thường Gặp (FAQ)

### Q1: Tại sao không commit Docker image vào Git?

**A:** Docker images rất lớn (hàng trăm MB đến GB), không phù hợp để lưu trong Git. Thay vào đó:

- Commit **Dockerfile** (text file nhỏ)
- Build image trong CI/CD
- Push image lên **Container Registry**

### Q2: Development có cần push image lên registry không?

**A:** Không cần! Trong development:

- Mỗi developer tự build image local từ Dockerfile
- `docker-compose up` sẽ tự động build
- Chỉ push lên registry khi deploy production

### Q3: Khi nào dùng `docker run` vs `docker-compose`?

**A:**

- **`docker run`**: Chạy 1 container đơn lẻ, quick test
- **`docker-compose`**: Chạy nhiều containers, có dependencies, development environment

### Q4: Production có dùng docker-compose không?

**A:** Thường là **KHÔNG** cho production thực sự vì:

- Không có auto-scaling
- Không có high availability
- Không có rolling updates

Thay vào đó dùng: **Kubernetes, AWS ECS, Google Cloud Run, Azure Container Apps**

### Q5: Image tag `latest` có nên dùng không?

**A:**

- ✅ Development: OK để dùng
- ❌ Production: **KHÔNG NÊN** - luôn dùng specific version (1.0.0, abc1234)

---

**Tài liệu này được tạo để giải thích Docker workflow trong thực tế. Nếu có thắc mắc, hãy hỏi thêm!** 🐳
