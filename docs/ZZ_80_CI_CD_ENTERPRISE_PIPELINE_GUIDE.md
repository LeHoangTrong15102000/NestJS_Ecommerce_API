# CI/CD Pipeline Trong Enterprise — Hướng Dẫn Chuyên Sâu Từ Thực Tế

> Tài liệu này tổng hợp kiến thức CI/CD pipeline từ các kỹ sư giỏi tại Netflix, Spotify, Google, Amazon, Atlassian và cộng đồng DevOps toàn cầu. Được phân tích cụ thể cho dự án NestJS Ecommerce API.

---

## Mục Lục

1. [CI/CD Là Gì Và Tại Sao Enterprise Cần Nó?](#1-cicd-là-gì-và-tại-sao-enterprise-cần-nó)
2. [Quy Trình Phân Tích Vấn Đề Trước Khi Thiết Kế Pipeline](#2-quy-trình-phân-tích-vấn-đề-trước-khi-thiết-kế-pipeline)
3. [Các Enterprise Lớn Thiết Kế Pipeline Như Thế Nào?](#3-các-enterprise-lớn-thiết-kế-pipeline-như-thế-nào)
4. [Các Stage Trong Enterprise CI/CD Pipeline](#4-các-stage-trong-enterprise-cicd-pipeline)
5. [Chiến Lược Deployment Trong Thực Tế](#5-chiến-lược-deployment-trong-thực-tế)
6. [Bảo Mật Trong CI/CD Pipeline (DevSecOps)](#6-bảo-mật-trong-cicd-pipeline-devsecops)
7. [Infrastructure as Code (IaC) Và GitOps](#7-infrastructure-as-code-iac-và-gitops)
8. [Monitoring, Observability Và DORA Metrics](#8-monitoring-observability-và-dora-metrics)
9. [Feature Flags Và Progressive Delivery](#9-feature-flags-và-progressive-delivery)
10. [Các Anti-Pattern Cần Tránh](#10-các-anti-pattern-cần-tránh)
11. [Tối Ưu Chi Phí Và Tốc Độ Pipeline](#11-tối-ưu-chi-phí-và-tốc-độ-pipeline)
12. [Áp Dụng Cho Dự Án NestJS Ecommerce API](#12-áp-dụng-cho-dự-án-nestjs-ecommerce-api)
13. [Lộ Trình Triển Khai CI/CD Cho Dự Án](#13-lộ-trình-triển-khai-cicd-cho-dự-án)
14. [Nguồn Tham Khảo](#14-nguồn-tham-khảo)

---

## 1. CI/CD Là Gì Và Tại Sao Enterprise Cần Nó?

### 1.1 Định Nghĩa Cốt Lõi

**CI (Continuous Integration)** — Mỗi khi developer push code, hệ thống tự động:
- Pull code mới nhất
- Build ứng dụng
- Chạy toàn bộ test suite
- Báo cáo kết quả ngay lập tức

**CD (Continuous Delivery)** — Sau khi CI pass, code tự động được:
- Đóng gói thành artifact (Docker image, binary...)
- Deploy lên staging environment
- Sẵn sàng deploy production bất cứ lúc nào (cần 1 click approve)

**CD (Continuous Deployment)** — Bước tiến xa hơn:
- Code tự động deploy lên production KHÔNG cần approve thủ công
- Yêu cầu test coverage cực cao và monitoring tốt
- Amazon deploy mỗi 11.7 giây — đây là Continuous Deployment

### 1.2 Tại Sao Enterprise Cần CI/CD?

Hãy tưởng tượng một team 50 developer cùng làm việc trên 1 codebase:

**Không có CI/CD:**
- Developer A merge code → break build → Developer B, C, D không biết → tiếp tục code trên nền bị lỗi
- Deploy thủ công → quên bước → production down → mất 4 tiếng fix
- "Trên máy tôi chạy được" — câu nói kinh điển

**Có CI/CD:**
- Developer A push code → 5 phút sau biết ngay code có lỗi hay không
- Deploy tự động, nhất quán, có thể rollback trong vài phút
- Mọi environment đều giống nhau (Docker)

**Số liệu thực tế từ Atlassian (9,000+ engineers):**
- Pipeline build time giảm 75% (6 giờ → 1.5 giờ)
- Lead time giảm 96% (2 ngày → 1.5 giờ)
- Developer satisfaction tăng từ 68% → 90%
- Decommission 20+ CI/CD servers cũ

> *Nguồn: Atlassian — "1 Billion Build Minutes" case study*

### 1.3 Sự Khác Biệt Giữa CI/CD Ở Startup vs Enterprise

| Khía cạnh | Startup | Enterprise |
|-----------|---------|------------|
| Pipeline | 1 pipeline đơn giản | Hàng trăm pipeline phức tạp |
| Compliance | Không cần | SOC2, HIPAA, PCI-DSS bắt buộc |
| Approval | Tự động hoàn toàn | Có approval gates cho production |
| Security | npm audit cơ bản | SAST + DAST + SCA + Container Scan |
| Environments | dev + prod | dev + staging + UAT + pre-prod + prod |
| Rollback | Redeploy manual | Automated rollback trong vài phút |
| Monitoring | Basic logs | Full observability (traces, metrics, logs) |

---

## 2. Quy Trình Phân Tích Vấn Đề Trước Khi Thiết Kế Pipeline

Đây là phần quan trọng nhất mà nhiều team bỏ qua. Trước khi viết 1 dòng YAML nào, enterprise phải trả lời các câu hỏi sau:

### 2.1 Framework Phân Tích "5W1H" Cho CI/CD

#### WHO — Ai sẽ sử dụng pipeline?
- Bao nhiêu developer? (10 người vs 500 người → thiết kế khác nhau hoàn toàn)
- Có team QA riêng không? (ảnh hưởng đến approval gates)
- Có team Security riêng không? (ảnh hưởng đến security scanning stages)
- Có team Platform/DevOps riêng không? (ai maintain pipeline?)

#### WHAT — Hệ thống gồm những gì?
- Monolith hay Microservices? (1 pipeline vs nhiều pipeline)
- Ngôn ngữ/framework gì? (Node.js, Java, Go... mỗi cái có best practice riêng)
- Database gì? (migration strategy ảnh hưởng deployment)
- Có external dependencies không? (Redis, S3, third-party APIs...)

#### WHERE — Deploy ở đâu?
- Cloud nào? (AWS, GCP, Azure → tool ecosystem khác nhau)
- Kubernetes hay serverless? (deployment strategy khác nhau)
- Multi-region hay single region? (phức tạp hơn nhiều)
- On-premise hay cloud? (network, security constraints)

#### WHEN — Khi nào cần deploy?
- Deploy frequency mong muốn? (ngày 1 lần vs nhiều lần/ngày)
- Có maintenance window không? (regulated industries)
- Timezone nào? (global team → cần automated, không phụ thuộc người)

#### WHY — Tại sao cần thay đổi?
- Pain points hiện tại là gì? (deploy chậm? hay bug lọt production?)
- Compliance requirements? (audit trail, approval workflows)
- Business requirements? (time-to-market, reliability SLAs)

#### HOW — Làm như thế nào?
- Budget bao nhiêu? (self-hosted vs managed CI/CD)
- Team có kinh nghiệm DevOps không? (learning curve)
- Có legacy systems cần integrate không?



### 2.2 Đánh Giá Mức Độ Trưởng Thành (Maturity Assessment)

Enterprise thường đánh giá mức độ trưởng thành CI/CD theo 5 cấp:

```
Level 1: Manual          → Build và deploy hoàn toàn thủ công
Level 2: Scripted        → Có scripts nhưng chạy manual
Level 3: CI              → Auto build + test khi push code
Level 4: CD (Delivery)   → Auto deploy staging, manual approve production
Level 5: CD (Deployment) → Auto deploy production, auto rollback
```

**Cách đánh giá:**

| Câu hỏi | Level thấp | Level cao |
|----------|-----------|-----------|
| Mất bao lâu từ commit → production? | Ngày/tuần | Phút/giờ |
| Bao nhiêu % test tự động? | < 30% | > 80% |
| Deploy có cần SSH vào server? | Có | Không bao giờ |
| Rollback mất bao lâu? | Giờ | Phút |
| Có biết ai deploy gì khi nào? | Không rõ | Audit trail đầy đủ |
| Pipeline config ở đâu? | UI của CI tool | Version-controlled trong repo |

### 2.3 Xác Định Pain Points Cụ Thể

Trước khi thiết kế, hãy liệt kê pain points theo mức độ nghiêm trọng:

**Critical (phải fix ngay):**
- Production down do deploy sai → cần automated rollback
- Security breach do hardcoded secrets → cần secret scanning
- Data loss do migration sai → cần migration testing

**High (fix trong sprint tới):**
- Deploy mất 2 giờ → cần parallel stages, caching
- Bug lọt production → cần thêm test stages
- Không biết ai deploy gì → cần audit trail

**Medium (cải thiện dần):**
- Build chậm → cần caching, parallel jobs
- Flaky tests → cần test stability monitoring
- Developer phải chờ pipeline → cần tối ưu feedback loop

---

## 3. Các Enterprise Lớn Thiết Kế Pipeline Như Thế Nào?

### 3.1 Netflix — Canary-First, Automated Analysis

Netflix xử lý 50,000+ deployments mỗi ngày với kiến trúc:

```
Code Commit
    ↓
Jenkins Build (compile, unit test)
    ↓
Bake AMI / Build Container Image
    ↓
Spinnaker Pipeline
    ↓
Canary Deploy (5% traffic)
    ↓
Automated Canary Analysis (ACA)
    ├── Metrics OK → Promote to 100%
    └── Metrics BAD → Auto Rollback
```

**Điểm đặc biệt:**
- **Automated Canary Analysis (ACA):** So sánh metrics (error rate, latency, CPU) giữa canary và baseline tự động. Không cần người quyết định promote hay rollback.
- **Immutable Infrastructure:** Mỗi deploy tạo AMI/container mới, không bao giờ sửa server đang chạy.
- **Rollback trong vài phút:** Chỉ cần redirect traffic về version cũ.

**Bài học:** Đầu tư vào automated analysis thay vì manual QA approval. Máy phân tích metrics nhanh và chính xác hơn người.

### 3.2 Spotify — Golden Paths & Backstage

Spotify không ép buộc 1 pipeline duy nhất. Thay vào đó, họ tạo "Golden Paths" — con đường được trải sẵn:

```
Developer tạo service mới
    ↓
Backstage Software Template
    ↓
Auto-scaffold:
    ├── Source code skeleton
    ├── CI/CD pipeline (pre-configured)
    ├── Kubernetes manifests
    ├── Monitoring dashboards
    └── Documentation
    ↓
Developer chỉ cần viết business logic
```

**Điểm đặc biệt:**
- **Backstage (CNCF Incubating):** Internal developer portal — tất cả tools, pipelines, docs ở 1 nơi.
- **Golden Path:** Pipeline mặc định quá dễ dùng nên team tự nguyện adopt, không cần ép buộc.

**Bài học:** Tạo template pipeline tốt 1 lần, reuse cho mọi service. Developer experience quan trọng hơn pipeline phức tạp.

### 3.3 Google — Monorepo & Bazel

```
Code Change (trong monorepo)
    ↓
Bazel xác định affected targets
    ↓
Chỉ build + test những gì bị ảnh hưởng
    ↓
Aggressive caching (remote build cache)
    ↓
Trunk-based development (merge vào main)
    ↓
Progressive rollout với traffic splitting
```

**Điểm đặc biệt:**
- **Selective testing:** Thay đổi 1 file → chỉ test những module phụ thuộc vào file đó.
- **Hermetic builds:** Build reproducible 100% — cùng input luôn cho cùng output.
- **Remote build cache:** Build result được cache, developer khác không cần build lại.

**Bài học:** Selective testing là game-changer. Không cần chạy 500 tests khi chỉ sửa 1 file.

### 3.4 Amazon — "You Build It, You Run It"

```
Mỗi team sở hữu:
    ├── Source code
    ├── CI/CD pipeline riêng
    ├── Monitoring riêng
    └── On-call rotation riêng

Deploy flow:
    Code Push → CodeBuild → CodeDeploy
    ↓
    CloudWatch Alarms monitoring
    ├── Alarm triggered → Auto Rollback
    └── No alarm → Deploy complete
```

**Deploy mỗi 11.7 giây** trung bình toàn công ty. Team nào build thì team đó vận hành.

### 3.5 So Sánh Tổng Quan

| Công ty | Pattern chính | Tool chính | Triết lý |
|---------|--------------|-----------|----------|
| Netflix | Canary-first, auto analysis | Spinnaker | Immutable infra, auto-rollback |
| Spotify | Golden Paths, developer portal | Backstage | Developer experience first |
| Google | Monorepo, selective build | Bazel | Trunk-based dev, build caching |
| Amazon | Pipeline-per-service | AWS CodePipeline | Team ownership, small deploys |

---

## 4. Các Stage Trong Enterprise CI/CD Pipeline

Dựa trên GitLab Ultimate Guide và kinh nghiệm từ các enterprise, một pipeline hoàn chỉnh gồm 8 stages:

### Stage 1: Source / Pre-Commit

```
Developer viết code
    ↓
Pre-commit hooks chạy:
    ├── Lint check (ESLint, Prettier)
    ├── Secret scanning (gitleaks)
    ├── Conventional commit check
    └── Type check (tsc --noEmit)
    ↓
Push to remote → Trigger pipeline
```

**Tại sao cần?** Bắt lỗi TRƯỚC KHI code vào pipeline, tiết kiệm compute và thời gian chờ. Nếu lint fail ở local, developer fix ngay thay vì chờ 5 phút pipeline fail.

**Tools:** Husky (Git hooks), lint-staged, commitlint, gitleaks

### Stage 2: Build

```yaml
# Ví dụ GitHub Actions
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'                    # Cache pnpm store
    - run: pnpm install --frozen-lockfile # Deterministic install
    - run: npx prisma generate            # Generate Prisma client
    - run: pnpm run build                 # nest build
    - uses: actions/upload-artifact@v4    # Lưu build output
      with:
        name: dist
        path: dist/
```

**Tại sao cần?** Đảm bảo code compile thành công. `--frozen-lockfile` đảm bảo mọi CI run dùng cùng dependency versions.

**Quan trọng:** Dùng `pnpm install --frozen-lockfile` (hoặc `npm ci`) thay vì `pnpm install`. Lý do: `--frozen-lockfile` fail nếu lockfile không match package.json, ngăn dependency drift.

### Stage 3: Test

```yaml
test:
  needs: [build]
  strategy:
    matrix:
      test-type: [unit, integration]
  steps:
    - name: Unit Tests
      if: matrix.test-type == 'unit'
      run: pnpm test:unit --coverage --ci

    - name: Integration Tests
      if: matrix.test-type == 'integration'
      services:
        postgres:
          image: postgres:17-alpine
          env:
            POSTGRES_DB: test_db
            POSTGRES_USER: test_user
            POSTGRES_PASSWORD: test_pass
        redis:
          image: redis:7-alpine
      run: pnpm test:integration
```

**Tại sao tách unit và integration?** Unit tests chạy nhanh (không cần DB), integration tests chạy chậm hơn (cần DB thật). Chạy song song tiết kiệm thời gian.

**Coverage thresholds theo enterprise standard:**

| Module type | Target |
|------------|--------|
| Auth, Security, Payment | 95%+ |
| Business Logic, User Management | 85%+ |
| Controllers, Utilities | 75%+ |

### Stage 4: Security Scanning

```yaml
security:
  needs: [build]
  steps:
    - name: Secret Scanning
      run: gitleaks detect --source . --verbose

    - name: Dependency Audit
      run: pnpm audit --audit-level=high

    - name: SAST (Static Analysis)
      run: semgrep --config=auto src/

    - name: Container Image Scan
      run: trivy image myapp:${{ github.sha }}
```

| Tool Type | Chức năng | Khi nào chạy | Ví dụ |
|-----------|----------|--------------|-------|
| SAST | Phân tích source code tìm lỗ hổng | Build stage | SonarQube, Semgrep |
| SCA | Scan dependencies tìm CVE | Build stage | Snyk, npm audit |
| DAST | Test ứng dụng đang chạy | Staging stage | OWASP ZAP |
| Container Scan | Scan Docker image | Build stage | Trivy, Grype |
| Secret Scan | Tìm hardcoded secrets | Pre-commit | GitLeaks, TruffleHog |

**Tại sao cần?** Theo Wiz State of Code Security 2025: 35% enterprise dùng self-hosted runners với config yếu, tạo attack vector. CI/CD pipeline là mục tiêu giá trị cao cho attacker.

### Stage 5: Quality Gates

```yaml
quality-gate:
  needs: [test, security]
  steps:
    - name: Check Coverage Threshold
      run: |
        COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage $COVERAGE% is below 80% threshold"
          exit 1
        fi

    - name: Check Security Vulnerabilities
      run: |
        CRITICAL=$(trivy image --severity CRITICAL --format json myapp | jq '.Results | length')
        if [ "$CRITICAL" -gt "0" ]; then
          echo "Found $CRITICAL critical vulnerabilities"
          exit 1
        fi
```

**Quality gates là "cửa chặn" tự động.** Nếu không đạt tiêu chuẩn → pipeline fail → code không được deploy. Không cần người review từng metric.

### Stage 6: Deploy Staging

```yaml
deploy-staging:
  needs: [quality-gate]
  environment: staging
  steps:
    - name: Deploy to Staging
      run: |
        docker push myregistry/myapp:${{ github.sha }}
        kubectl set image deployment/myapp myapp=myregistry/myapp:${{ github.sha }}
        kubectl rollout status deployment/myapp --timeout=300s

    - name: Smoke Tests
      run: |
        curl -f https://staging.myapp.com/health || exit 1
        pnpm test:e2e --config test/jest-e2e.json
```

**Tại sao cần staging?** Staging mirror production — cùng infrastructure, cùng config (trừ data). Nếu staging OK, production có xác suất cao cũng OK.

### Stage 7: Deploy Production

```yaml
deploy-production:
  needs: [deploy-staging]
  environment: production    # Requires manual approval
  steps:
    - name: Canary Deploy (5%)
      run: |
        kubectl apply -f k8s/canary-deployment.yaml
        sleep 300  # Wait 5 minutes

    - name: Check Canary Metrics
      run: |
        ERROR_RATE=$(curl -s prometheus/api/v1/query?query=error_rate_canary)
        if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
          echo "Canary error rate too high: $ERROR_RATE"
          kubectl rollout undo deployment/myapp-canary
          exit 1
        fi

    - name: Full Rollout
      run: kubectl set image deployment/myapp myapp=myregistry/myapp:${{ github.sha }}
```

### Stage 8: Post-Deployment

```yaml
post-deploy:
  needs: [deploy-production]
  steps:
    - name: Health Check
      run: curl -f https://api.myapp.com/health

    - name: Notify Team
      run: |
        curl -X POST $SLACK_WEBHOOK -d '{
          "text": "✅ Deployed v${{ github.sha }} to production"
        }'

    - name: Tag Release
      run: |
        git tag v$(date +%Y%m%d-%H%M%S)
        git push --tags
```

**Tại sao cần post-deploy?** Đóng feedback loop. Team biết ngay deploy thành công hay thất bại. Release tag giúp trace version nào đang chạy trên production.

---

## 5. Chiến Lược Deployment Trong Thực Tế

Deployment strategy quyết định cách code mới được đưa lên production. Chọn sai strategy → downtime, mất doanh thu, mất user trust. Chọn đúng → zero-downtime, rollback nhanh, user không biết gì.

### 5.1 Blue-Green Deployment

```
                    Load Balancer
                    /           \
            [Blue - v1.0]    [Green - v1.1]
            (đang serve)     (đang deploy)

Bước 1: Deploy v1.1 lên Green (Blue vẫn serve traffic)
Bước 2: Test Green thoroughly
Bước 3: Switch Load Balancer → Green serve traffic
Bước 4: Blue trở thành standby (rollback target)
```

**Cách hoạt động:**
- Duy trì 2 môi trường production giống hệt nhau (Blue và Green)
- Tại mọi thời điểm, chỉ 1 môi trường serve traffic
- Deploy lên môi trường idle → test → switch traffic
- Rollback = switch traffic ngược lại (vài giây)

**Ưu điểm:**
- Zero downtime — user không bị ảnh hưởng
- Instant rollback — chỉ cần switch load balancer
- Full testing trên production-like environment trước khi switch

**Nhược điểm:**
- Tốn gấp đôi infrastructure (2x servers, 2x databases nếu cần)
- Database migration phức tạp (cả 2 version phải compatible với cùng DB schema)
- Chi phí cao cho small teams

**Khi nào dùng?** Ứng dụng cần zero-downtime tuyệt đối, có budget cho 2x infrastructure, database schema changes ít.

### 5.2 Canary Deployment

```
                    Load Balancer
                   /      |       \
            [v1.0]    [v1.0]    [v1.1 - Canary]
            (47.5%)   (47.5%)   (5% traffic)

Timeline:
  T+0:   Deploy canary (5% traffic)
  T+5m:  Check metrics (error rate, latency, CPU)
  T+15m: Promote to 25% (nếu metrics OK)
  T+30m: Promote to 50%
  T+60m: Full rollout 100%

Bất kỳ lúc nào metrics xấu → Auto rollback canary
```

**Cách hoạt động:**
- Deploy version mới cho một phần nhỏ traffic (thường 1-5%)
- Monitor metrics so sánh canary vs baseline
- Tăng dần traffic nếu metrics tốt
- Rollback ngay nếu metrics xấu

**Netflix Automated Canary Analysis (ACA):**
Netflix không để người quyết định promote hay rollback. Hệ thống ACA tự động:
1. Thu thập metrics từ canary và baseline (error rate, latency p50/p99, CPU, memory)
2. So sánh thống kê (Mann-Whitney U test)
3. Score từ 0-100 (dưới 50 = fail)
4. Tự động promote hoặc rollback

**Ưu điểm:**
- Blast radius nhỏ — chỉ 5% user bị ảnh hưởng nếu có bug
- Data-driven decisions — metrics quyết định, không phải cảm tính
- Phát hiện issues mà staging không catch được (real traffic patterns)

**Nhược điểm:**
- Cần monitoring infrastructure tốt
- Phức tạp hơn blue-green
- Cần đủ traffic để metrics có ý nghĩa thống kê

**Khi nào dùng?** Hệ thống có traffic lớn, cần validate với real users, có monitoring infrastructure.

### 5.3 Rolling Deployment

```
Cluster: [Pod1-v1] [Pod2-v1] [Pod3-v1] [Pod4-v1]

Step 1:   [Pod1-v2] [Pod2-v1] [Pod3-v1] [Pod4-v1]  ← Pod1 updated
Step 2:   [Pod1-v2] [Pod2-v2] [Pod3-v1] [Pod4-v1]  ← Pod2 updated
Step 3:   [Pod1-v2] [Pod2-v2] [Pod3-v2] [Pod4-v1]  ← Pod3 updated
Step 4:   [Pod1-v2] [Pod2-v2] [Pod3-v2] [Pod4-v2]  ← Done!
```

**Cách hoạt động:**
- Thay thế từng instance một (hoặc batch)
- Kubernetes native — `maxSurge` và `maxUnavailable` control tốc độ
- Không cần extra infrastructure

```yaml
# Kubernetes Rolling Update config
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # Tối đa 1 pod mới thêm
      maxUnavailable: 0    # Không pod nào bị down
```

**Ưu điểm:**
- Không cần extra infrastructure
- Kubernetes native, dễ setup
- Gradual rollout giảm risk

**Nhược điểm:**
- Rollback chậm hơn (phải rolling ngược lại)
- Có thời điểm 2 versions chạy song song (compatibility issues)
- Khó debug khi có vấn đề (version nào gây lỗi?)

### 5.4 So Sánh Deployment Strategies

| Tiêu chí | Blue-Green | Canary | Rolling |
|----------|-----------|--------|---------|
| Downtime | Zero | Zero | Near-zero |
| Rollback speed | Instant (giây) | Nhanh (phút) | Chậm (phút) |
| Extra infrastructure | 2x | +5-10% | Không |
| Blast radius | 0% hoặc 100% | 1-5% ban đầu | Tăng dần |
| Complexity | Trung bình | Cao | Thấp |
| Best for | Critical apps | High-traffic apps | Standard apps |
| Database migration | Phức tạp | Phức tạp | Đơn giản hơn |

**Recommendation cho NestJS Ecommerce API:**
- **Giai đoạn đầu:** Rolling Deployment (đơn giản, Kubernetes native)
- **Khi traffic tăng:** Canary Deployment (validate với real users)
- **Critical releases:** Blue-Green (zero-risk switching)

---

## 6. Bảo Mật Trong CI/CD Pipeline (DevSecOps)

> "Security is not a stage in the pipeline — it's a property of the entire pipeline." — OWASP

### 6.1 DevSecOps Là Gì?

DevSecOps = Development + Security + Operations. Thay vì security review ở cuối (waterfall), security được tích hợp vào MỌI stage của pipeline.

```
Truyền thống:
  Dev → Build → Test → [Security Review cuối cùng] → Deploy
  ↑ Phát hiện lỗ hổng ở đây = tốn kém, delay release

DevSecOps:
  Dev [Security] → Build [Security] → Test [Security] → Deploy [Security]
  ↑ Phát hiện lỗ hổng sớm = fix rẻ, không delay
```

**Shift-Left Security:** Di chuyển security checks sang trái (sớm hơn) trong pipeline. Bug phát hiện ở development stage rẻ hơn 100x so với production.

### 6.2 Các Lớp Bảo Mật Trong Pipeline

#### Lớp 1: Pre-Commit (Developer Machine)

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    hooks:
      - id: gitleaks    # Scan secrets trước khi commit

  - repo: https://github.com/pre-commit/pre-commit-hooks
    hooks:
      - id: detect-private-key    # Phát hiện private keys
      - id: detect-aws-credentials # Phát hiện AWS credentials
```

**Mục đích:** Ngăn secrets (API keys, passwords, tokens) bị commit vào repo. Một khi secret vào Git history, nó ở đó MÃI MÃI (kể cả khi xóa commit).

#### Lớp 2: CI Pipeline — Static Analysis (SAST)

```yaml
sast:
  runs-on: ubuntu-latest
  steps:
    - name: Semgrep SAST
      uses: semgrep/semgrep-action@v1
      with:
        config: >-
          p/javascript
          p/typescript
          p/nodejs
          p/owasp-top-ten
      env:
        SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
```

**SAST (Static Application Security Testing)** phân tích source code mà KHÔNG cần chạy ứng dụng:
- SQL Injection patterns
- XSS vulnerabilities
- Insecure deserialization
- Hardcoded credentials
- Path traversal

**Tools phổ biến:** Semgrep (free, fast), SonarQube (comprehensive), CodeQL (GitHub native)

#### Lớp 3: Dependency Scanning (SCA)

```yaml
sca:
  steps:
    - name: pnpm audit
      run: pnpm audit --audit-level=high

    - name: Snyk Security Check
      uses: snyk/actions/node@master
      with:
        command: test
        args: --severity-threshold=high
```

**SCA (Software Composition Analysis)** scan dependencies tìm CVE (Common Vulnerabilities and Exposures):
- Kiểm tra tất cả packages trong `pnpm-lock.yaml`
- So sánh với database CVE (NVD, GitHub Advisory)
- Alert khi dependency có known vulnerability

**Thực tế đáng sợ:** 80%+ code trong ứng dụng đến từ dependencies. Bạn chỉ viết 20%, nhưng chịu trách nhiệm 100%.

#### Lớp 4: Container Image Scanning

```yaml
container-scan:
  steps:
    - name: Build Docker Image
      run: docker build -t myapp:${{ github.sha }} .

    - name: Trivy Container Scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: myapp:${{ github.sha }}
        severity: CRITICAL,HIGH
        exit-code: 1    # Fail pipeline nếu có CRITICAL
```

**Scan Docker image tìm:**
- OS-level vulnerabilities (Alpine, Debian packages)
- Application dependencies
- Misconfigurations (running as root, exposed ports)
- Secrets baked into image layers

#### Lớp 5: Dynamic Testing (DAST) — Staging

```yaml
dast:
  needs: [deploy-staging]
  steps:
    - name: OWASP ZAP Scan
      uses: zaproxy/action-full-scan@v0.10.0
      with:
        target: https://staging.myapp.com
        rules_file_name: .zap/rules.tsv
```

**DAST (Dynamic Application Security Testing)** test ứng dụng ĐANG CHẠY:
- Gửi malicious requests thật
- Test authentication bypass
- Test injection attacks
- Test CORS misconfigurations

### 6.3 Security Best Practices Cho CI/CD Pipeline

**1. Least Privilege Principle:**
```yaml
# GitHub Actions — chỉ cấp quyền cần thiết
permissions:
  contents: read      # Chỉ đọc code
  packages: write     # Chỉ push images
  # KHÔNG cấp: admin, write contents, etc.
```

**2. Immutable Artifacts:**
- Docker image một khi build xong → KHÔNG bao giờ sửa
- Dùng SHA digest thay vì mutable tags (`myapp@sha256:abc...` thay vì `myapp:latest`)

**3. Secret Management:**
- KHÔNG BAO GIỜ hardcode secrets trong code hoặc pipeline YAML
- Dùng GitHub Secrets, AWS Secrets Manager, HashiCorp Vault
- Rotate secrets định kỳ (90 ngày)

**4. Pipeline Security:**
- Pin action versions bằng SHA (`uses: actions/checkout@abc123` thay vì `@v4`)
- Audit third-party actions trước khi dùng
- Self-hosted runners phải isolated và hardened

> **Theo Wiz State of Code Security 2025:** 35% enterprise dùng self-hosted CI/CD runners với configuration yếu, tạo attack vector nghiêm trọng. CI/CD pipeline là mục tiêu giá trị cao cho attacker vì có access đến source code, secrets, và production infrastructure.

---

## 7. Infrastructure as Code (IaC) Và GitOps

### 7.1 IaC — Tại Sao Không Bao Giờ Click Trên Console Nữa?

**Infrastructure as Code** = Quản lý infrastructure bằng code thay vì click trên cloud console.

```
Truyền thống (ClickOps):
  DevOps login AWS Console → Click tạo EC2 → Click tạo RDS → Click tạo S3
  ↑ Không reproducible, không version control, không review

IaC:
  Viết Terraform code → Git commit → PR review → Apply tự động
  ↑ Reproducible, version controlled, peer reviewed
```

**Tại sao enterprise BẮT BUỘC dùng IaC?**
1. **Reproducibility:** Tạo lại toàn bộ infrastructure từ code trong vài phút
2. **Audit trail:** Mọi thay đổi infrastructure đều có Git history
3. **Disaster recovery:** Infrastructure bị xóa? `terraform apply` lại
4. **Consistency:** Dev, staging, production dùng cùng code (khác variables)
5. **Compliance:** Auditor hỏi "ai thay đổi gì khi nào?" → Git log trả lời

### 7.2 Terraform — IaC Tool Phổ Biến Nhất

```hcl
# infrastructure/main.tf — Ví dụ cho NestJS Ecommerce API

# PostgreSQL Database
resource "aws_db_instance" "postgres" {
  engine               = "postgres"
  engine_version       = "17"
  instance_class       = "db.t3.medium"
  allocated_storage    = 50
  db_name              = "ecommerce"

  # Security
  storage_encrypted    = true
  deletion_protection  = true

  # Backup
  backup_retention_period = 7
  backup_window          = "03:00-04:00"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Redis Cache
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ecommerce-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 1

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

**Terraform PR Automation với Atlantis:**

```
Developer tạo PR thay đổi infrastructure
    ↓
Atlantis bot tự động chạy `terraform plan`
    ↓
Comment kết quả plan lên PR:
    "Plan: 2 to add, 1 to change, 0 to destroy"
    ↓
Reviewer approve PR
    ↓
Comment `atlantis apply` → Atlantis apply changes
    ↓
Infrastructure updated, PR merged
```

**Lợi ích:** Mọi infrastructure change đều qua PR review. Không ai có thể thay đổi production infrastructure mà không có approval.

### 7.3 GitOps — Git Là Single Source of Truth

**GitOps** = Dùng Git repository làm single source of truth cho cả application code VÀ infrastructure/deployment config.

```
GitOps Flow:
  Developer push code → CI build Docker image → Push image tag to Git
      ↓
  GitOps operator (ArgoCD/Flux) detect Git change
      ↓
  Auto-sync Kubernetes cluster to match Git state
      ↓
  Cluster state = Git state (always)
```

**Nguyên tắc GitOps:**
1. **Declarative:** Mô tả desired state, không phải steps
2. **Versioned:** Mọi thay đổi qua Git (PR, review, history)
3. **Automated:** Agent tự động sync cluster với Git
4. **Self-healing:** Nếu ai đó `kubectl edit` trực tiếp → agent revert về Git state

### 7.4 ArgoCD vs Flux — So Sánh

| Tiêu chí | ArgoCD | Flux |
|----------|--------|------|
| UI | Web UI đẹp, trực quan | Không có UI (CLI only) |
| Learning curve | Dễ hơn (có UI) | Khó hơn (pure GitOps) |
| Multi-cluster | Tốt | Rất tốt |
| Helm support | Native | Native |
| Kustomize | Native | Native |
| Community | CNCF Graduated | CNCF Graduated |
| Best for | Teams cần visibility | Teams muốn pure GitOps |

**Recommendation:** ArgoCD cho hầu hết teams (UI giúp debug và onboard nhanh). Flux cho teams đã mature với GitOps.

### 7.5 Drift Detection — Phát Hiện Thay Đổi Ngoài Ý Muốn

```
Drift = Trạng thái thực tế ≠ Trạng thái trong code

Ví dụ:
  Terraform code: instance_type = "t3.medium"
  AWS thực tế:    instance_type = "t3.large"   ← Ai đó đã thay đổi trên console!
```

**Cách phát hiện:**
- Terraform: `terraform plan` chạy scheduled (mỗi giờ) → alert nếu có drift
- ArgoCD: Tự động detect và hiển thị "OutOfSync" status
- Crossplane: Continuous reconciliation (tự fix drift)

**Enterprise practice:** Chạy drift detection mỗi giờ. Nếu phát hiện drift → alert Slack → investigate. Nếu drift là intentional → update code. Nếu unauthorized → revert.

---

## 8. Monitoring, Observability Và DORA Metrics

### 8.1 Tại Sao Monitoring CI/CD Pipeline?

Pipeline không chỉ cần chạy — nó cần chạy NHANH và ĐÁNG TIN CẬY. Nếu pipeline mất 45 phút, developer sẽ:
- Chuyển sang task khác → context switching → giảm productivity
- Batch nhiều changes vào 1 commit → khó debug khi fail
- Skip pipeline (push thẳng) → bugs lọt production

### 8.2 DORA Metrics — Đo Lường Hiệu Quả DevOps

DORA (DevOps Research and Assessment) định nghĩa 4 metrics đo lường hiệu quả software delivery:

| Metric | Định nghĩa | Elite | High | Medium | Low |
|--------|-----------|-------|------|--------|-----|
| Deployment Frequency | Bao lâu deploy 1 lần? | On-demand (nhiều lần/ngày) | 1 lần/tuần - 1 lần/tháng | 1 lần/tháng - 6 tháng | > 6 tháng |
| Lead Time for Changes | Từ commit → production mất bao lâu? | < 1 giờ | 1 ngày - 1 tuần | 1 tuần - 1 tháng | > 1 tháng |
| Change Failure Rate | Bao nhiêu % deploy gây incident? | 0-15% | 16-30% | 31-45% | > 45% |
| Mean Time to Recovery | Mất bao lâu để recover từ failure? | < 1 giờ | < 1 ngày | 1 ngày - 1 tuần | > 1 tuần |

**Cách đo:**
```yaml
# GitHub Actions — Track deployment metrics
deploy-metrics:
  steps:
    - name: Record Deployment
      run: |
        curl -X POST $METRICS_ENDPOINT/deployments \
          -d '{
            "commit_sha": "${{ github.sha }}",
            "deployed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "environment": "production",
            "lead_time_seconds": "'$(($(date +%s) - $(git log -1 --format=%ct)))'",
            "status": "success"
          }'
```

### 8.3 CI/CD Observability Với OpenTelemetry

**OpenTelemetry** (OTel) không chỉ cho application — nó cũng dùng cho CI/CD pipeline:

```
Pipeline Run
    ├── Trace: Toàn bộ pipeline execution
    │   ├── Span: checkout (2s)
    │   ├── Span: install (45s)
    │   ├── Span: build (30s)
    │   ├── Span: test-unit (120s)
    │   │   ├── Span: test-auth (15s)
    │   │   ├── Span: test-user (20s)
    │   │   └── Span: test-payment (85s)  ← Bottleneck!
    │   ├── Span: test-integration (180s)
    │   └── Span: deploy (60s)
    └── Total: 437s
```

**Lợi ích:**
- Biết chính xác stage nào chậm nhất
- Track trends theo thời gian (pipeline ngày càng chậm?)
- Alert khi pipeline time vượt threshold

### 8.4 Developer Productivity Engineering (DPE)

Gradle (công ty đứng sau Gradle build tool) đề xuất khái niệm DPE 2.0:

```
DPE Focus Areas:
    ├── Build time optimization
    │   ├── Remote build cache hit rate
    │   ├── Incremental build effectiveness
    │   └── Parallel execution efficiency
    │
    ├── Test optimization
    │   ├── Flaky test detection & quarantine
    │   ├── Test distribution across machines
    │   └── Predictive test selection
    │
    └── Developer feedback loop
        ├── Time from push → first feedback
        ├── Time from push → merge-ready
        └── Developer wait time per day
```

**Key insight:** Đo "developer wait time per day" — tổng thời gian developer chờ pipeline mỗi ngày. Nếu > 30 phút/ngày → cần tối ưu pipeline.

### 8.5 Dashboard Metrics Cần Theo Dõi

| Metric | Target | Alert threshold |
|--------|--------|----------------|
| Pipeline success rate | > 95% | < 90% |
| Average pipeline duration | < 10 phút | > 15 phút |
| Flaky test rate | < 2% | > 5% |
| Build cache hit rate | > 70% | < 50% |
| Deployment frequency | Daily | < Weekly |
| Lead time | < 4 giờ | > 24 giờ |
| Change failure rate | < 15% | > 25% |
| MTTR | < 1 giờ | > 4 giờ |

---

## 9. Feature Flags Và Progressive Delivery

### 9.1 Feature Flags — Deploy ≠ Release

**Khái niệm quan trọng nhất:** Tách biệt deployment (đưa code lên production) khỏi release (bật feature cho users).

```
Truyền thống:
  Deploy code = Feature live cho tất cả users
  ↑ Rủi ro cao, không thể rollback feature mà không rollback code

Feature Flags:
  Deploy code (feature ẩn sau flag) → Bật flag cho 1% users → 10% → 50% → 100%
  ↑ Rollback = tắt flag (milliseconds), code vẫn ở production
```

```typescript
// Ví dụ trong NestJS Ecommerce API
@Injectable()
export class PaymentService {
  constructor(
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async processPayment(order: OrderType) {
    // Feature flag kiểm soát payment method mới
    if (await this.featureFlags.isEnabled('new-stripe-checkout', {
      userId: order.userId,
      percentage: 10,  // Chỉ 10% users
    })) {
      return this.processWithNewStripeCheckout(order)
    }

    return this.processWithLegacyPayment(order)
  }
}
```

### 9.2 Progressive Delivery — Triển Khai Từng Bước

Progressive Delivery kết hợp feature flags + canary deployment + automated analysis:

```
Ring-based Deployment (Microsoft model):

Ring 0: Internal team (dogfooding)     → 50 users
Ring 1: Early adopters (opt-in beta)   → 5,000 users
Ring 2: Fast ring (10% production)     → 100,000 users
Ring 3: Slow ring (50% production)     → 500,000 users
Ring 4: Full rollout (100%)            → 1,000,000 users

Mỗi ring chạy 1-7 ngày. Metrics xấu ở bất kỳ ring nào → STOP, không promote.
```

**Microsoft dùng model này cho Windows, Office, Azure.** Mỗi feature đi qua 5 rings trước khi đến tất cả users.

**GitHub cũng tương tự:**
- Staff ships (GitHub employees dùng trước)
- Internal beta → External beta → GA (General Availability)
- Mỗi stage có metrics gates tự động

### 9.3 Các Loại Feature Flags

| Loại | Mục đích | Lifetime | Ví dụ |
|------|---------|----------|-------|
| Release flag | Kiểm soát feature rollout | Ngắn (remove sau GA) | `new-checkout-flow` |
| Experiment flag | A/B testing | Trung bình | `pricing-page-variant-b` |
| Ops flag | Kill switch cho features | Dài | `enable-heavy-report` |
| Permission flag | Feature gating theo plan | Vĩnh viễn | `premium-analytics` |

### 9.4 Flag Debt — Vấn Đề Ít Ai Nói Đến

```
Cảnh báo: Feature flags tạo technical debt!

Mỗi flag = 1 if/else trong code = 2 code paths cần test

10 flags = 2^10 = 1,024 possible combinations!
```

**Best practices quản lý flag debt:**
1. **Expiry date:** Mỗi flag PHẢI có expiry date khi tạo
2. **Flag review:** Monthly review — remove flags đã GA > 30 ngày
3. **Flag limit:** Giới hạn số active flags (ví dụ: max 20 per service)
4. **Automated cleanup:** CI check fail nếu flag quá hạn chưa remove

### 9.5 OpenFeature — Standard Mở Cho Feature Flags

**OpenFeature** (CNCF Sandbox) là standard API cho feature flags, tránh vendor lock-in:

```typescript
// OpenFeature — vendor-agnostic API
import { OpenFeature } from '@openfeature/server-sdk'

// Có thể swap provider mà không đổi code
OpenFeature.setProvider(new LaunchDarklyProvider(sdkKey))
// hoặc: OpenFeature.setProvider(new FlagsmithProvider(apiKey))
// hoặc: OpenFeature.setProvider(new UnleashProvider(config))

const client = OpenFeature.getClient()
const showNewCheckout = await client.getBooleanValue(
  'new-checkout-flow',
  false,  // default value
  { userId: user.id }
)
```

**Lợi ích:** Bắt đầu với Flagsmith (free, self-hosted) → migrate sang LaunchDarkly khi scale → không đổi application code.

---

## 10. Các Anti-Pattern Cần Tránh

> Dựa trên kinh nghiệm từ REA Group (3,500 pipelines, 2,000+ builds/ngày) và cộng đồng DevOps.

### Anti-Pattern 1: Pipeline Không Phải Code (Pipeline Not as Code)

```
❌ Sai: Config pipeline trên UI của Jenkins/CircleCI
   → Không version control
   → Không review được
   → Không reproduce được
   → "Ai đã thay đổi pipeline?" → Không ai biết

✅ Đúng: Pipeline config trong repo (.github/workflows/, Jenkinsfile)
   → Version controlled
   → PR review
   → Reproducible
   → Git blame cho biết ai thay đổi gì
```

### Anti-Pattern 2: Pipeline Chậm (Slow Pipeline)

```
❌ Sai: Pipeline mất 45 phút
   → Developer chờ → context switch → productivity giảm
   → Developer batch changes → khó debug
   → Developer skip pipeline → bugs lọt production

✅ Đúng: Pipeline < 10 phút
   → Parallel stages
   → Caching (pnpm store, Docker layers, build cache)
   → Selective testing (chỉ test affected modules)
   → Fail fast (lint trước, test sau)
```

**REA Group đã giảm pipeline time từ 30 phút → 8 phút bằng:**
1. Parallel test execution
2. Docker layer caching
3. Selective testing based on changed files
4. Moving lint/type-check to pre-commit hooks

### Anti-Pattern 3: Flaky Tests (Tests Không Ổn Định)

```
❌ Flaky test: Pass 90% thời gian, fail 10% ngẫu nhiên
   → Developer mất trust vào pipeline
   → "Pipeline fail? Chắc flaky test, re-run thôi"
   → Real bugs bị ignore vì tưởng flaky
   → Pipeline trở thành noise, không phải signal

✅ Đúng: Quarantine flaky tests
   → Track flaky rate per test
   → Auto-quarantine tests fail > 3 lần trong 7 ngày
   → Quarantined tests chạy riêng (không block pipeline)
   → Fix hoặc delete quarantined tests trong 2 tuần
```

### Anti-Pattern 4: Không Có Rollback Strategy

```
❌ Sai: Deploy xong mới nghĩ cách rollback
   → Production down → panic → hotfix → thêm bugs
   → "Rollback bằng cách nào?" → Không ai biết

✅ Đúng: Rollback là phần của deployment strategy
   → Mỗi deploy có rollback plan
   → Rollback được test định kỳ (chaos engineering)
   → Automated rollback khi metrics xấu
   → Rollback < 5 phút
```

### Anti-Pattern 5: Shared Mutable State Giữa Pipeline Runs

```
❌ Sai: Pipeline runs share filesystem, database, cache
   → Run A để lại file → Run B đọc file cũ → kết quả sai
   → Run A và B cùng write database → race condition

✅ Đúng: Mỗi pipeline run là isolated
   → Fresh workspace mỗi run
   → Isolated test database (hoặc transaction rollback)
   → Unique artifact names (dùng commit SHA)
```

### Anti-Pattern 6: Manual Steps Trong Pipeline

```
❌ Sai: "Sau khi pipeline pass, SSH vào server và restart"
   → Quên bước → production không update
   → Làm sai bước → production down
   → Không reproducible

✅ Đúng: Pipeline tự động từ đầu đến cuối
   → Chỉ 1 manual step cho phép: production approval gate
   → Mọi thứ khác phải automated
```

### Anti-Pattern 7: Không Monitor Pipeline Health

```
❌ Sai: Pipeline fail → không ai biết → code stuck
   → "Tại sao feature chưa deploy?" → "À, pipeline fail 3 ngày rồi"

✅ Đúng: Pipeline health là first-class metric
   → Alert Slack/Teams khi pipeline fail
   → Dashboard hiển thị pipeline success rate
   → Weekly review pipeline metrics
```

### Anti-Pattern 8: Monolithic Pipeline (Một Pipeline Làm Tất Cả)

```
❌ Sai: 1 pipeline chạy build + test + security + deploy cho tất cả services
   → Thay đổi 1 service → chạy test tất cả services
   → Pipeline mất 2 giờ
   → 1 service fail → block tất cả services

✅ Đúng: Pipeline per service (hoặc per domain)
   → Mỗi service có pipeline riêng
   → Thay đổi service A → chỉ chạy pipeline A
   → Service A fail → không ảnh hưởng service B
```

---

## 11. Tối Ưu Chi Phí Và Tốc Độ Pipeline

### 11.1 Chi Phí CI/CD — Con Số Thực Tế

CI/CD không miễn phí. GitHub Actions tính tiền theo phút compute:

| Runner type | Giá/phút | 1000 builds × 10 phút |
|------------|---------|----------------------|
| Linux | $0.008 | $80/tháng |
| Windows | $0.016 | $160/tháng |
| macOS | $0.08 | $800/tháng |
| Large runner (8 cores) | $0.032 | $320/tháng |

**Atlassian case study:** Tiết kiệm $4 triệu/năm bằng cách tối ưu CI/CD pipeline:
- Dynamic pipelines (chỉ chạy stages cần thiết)
- Aggressive caching
- Selective testing
- Decommission 20+ CI servers cũ

### 11.2 Caching — Vũ Khí Số 1

```yaml
# GitHub Actions — Cache pnpm store
- uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules/.cache
    key: pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pnpm-

# Docker layer caching
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Hiệu quả caching:**

| Loại cache | Không cache | Có cache | Tiết kiệm |
|-----------|------------|---------|-----------|
| pnpm install | 45s | 5s | 89% |
| Docker build | 120s | 15s | 87% |
| Prisma generate | 10s | 2s | 80% |
| TypeScript build | 30s | 8s | 73% |

### 11.3 Selective Testing — Chỉ Test Những Gì Thay Đổi

```yaml
# Xác định files thay đổi
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      auth:
        - 'src/routes/auth/**'
      user:
        - 'src/routes/user/**'
      payment:
        - 'src/routes/payment/**'
      shared:
        - 'src/shared/**'

# Chỉ chạy test cho modules bị ảnh hưởng
- name: Test Auth
  if: steps.changes.outputs.auth == 'true' || steps.changes.outputs.shared == 'true'
  run: pnpm test src/routes/auth/

- name: Test Payment
  if: steps.changes.outputs.payment == 'true' || steps.changes.outputs.shared == 'true'
  run: pnpm test src/routes/payment/
```

**Kết quả:** Thay đổi 1 module → chạy test 1 module (30s) thay vì tất cả (5 phút). Tiết kiệm 90% compute cho small changes.

### 11.4 Parallel Execution

```yaml
# Chạy song song thay vì tuần tự
jobs:
  lint:          # ─┐
    ...          #  ├── Chạy song song (không phụ thuộc nhau)
  type-check:    #  │
    ...          #  │
  unit-test:     #  │
    ...          # ─┘

  security:      # ─── Chạy song song với test
    ...

  integration:   # ─── Cần build xong mới chạy
    needs: [lint, type-check]
    ...

  deploy:        # ─── Cần tất cả pass
    needs: [unit-test, integration, security]
    ...
```

**Trước:** lint → type-check → unit-test → security → integration = 15 phút (tuần tự)
**Sau:** (lint + type-check + unit-test + security) → integration = 7 phút (song song)

### 11.5 Fail Fast — Dừng Sớm Khi Biết Fail

```
Nguyên tắc: Chạy checks nhanh nhất trước, chậm nhất sau.

Thứ tự tối ưu:
  1. Lint check (5s)        ← Fail nhanh nhất
  2. Type check (10s)       ← Fail nhanh
  3. Unit tests (60s)       ← Fail trung bình
  4. Build (30s)            ← Cần cho integration
  5. Integration tests (180s) ← Chậm nhất, chạy cuối
  6. Security scan (120s)   ← Chạy song song với tests
```

**Nếu lint fail ở giây thứ 5 → pipeline dừng ngay.** Không cần chờ 5 phút chạy hết tests rồi mới biết có lỗi syntax.

### 11.6 Autoscaling Runners

```yaml
# GitHub Actions — Larger runners cho builds nặng
heavy-build:
  runs-on: ubuntu-latest-8-cores  # 8 cores thay vì 2
  steps:
    - run: pnpm test --maxWorkers=6  # Tận dụng nhiều cores
```

**Khi nào dùng larger runners?**
- Test suite > 500 tests → parallel execution cần nhiều cores
- Docker build phức tạp → nhiều RAM
- Monorepo build → nhiều CPU

**Cost-per-build metric:** Theo dõi chi phí trung bình mỗi build. Nếu tăng → investigate. Target: < $0.10/build cho small projects, < $1.00/build cho enterprise.

---

## 12. Áp Dụng Cho Dự Án NestJS Ecommerce API

### 12.1 Phân Tích Hiện Trạng Dự Án

**Tech Stack hiện tại:**
- Runtime: Node.js 18 (Alpine)
- Framework: NestJS 11
- Database: PostgreSQL 17 (Prisma 6.13 ORM)
- Cache: Redis 7
- Queue: BullMQ
- WebSocket: Socket.IO 4.8
- Validation: Zod 4 + nestjs-zod
- Package Manager: pnpm 10.6.5
- Testing: Jest 29 (unit + integration + e2e)
- Linting: ESLint 9 + Prettier

**Cấu trúc hiện tại:**
```
NestJS_Ecommerce_API/
├── src/routes/          # 19 domain modules (auth, user, product, payment...)
├── prisma/schema.prisma # 1064 lines, ~30 models
├── Dockerfile           # Single-stage build, node:18-alpine
├── docker-compose.yml   # PostgreSQL + Redis + API
├── jest.config.ts       # Unit test config, coverage thresholds
├── package.json         # Scripts: test, test:unit, test:integration, build
└── .env                 # Environment variables
```

**Những gì ĐÃ CÓ:**
- ✅ Docker containerization (Dockerfile + docker-compose)
- ✅ Test infrastructure (Jest unit + integration + e2e)
- ✅ Linting (ESLint 9 + Prettier)
- ✅ TypeScript strict mode
- ✅ Health check endpoint
- ✅ Non-root user trong Docker

**Những gì CHƯA CÓ (Gaps):**
- ❌ CI/CD pipeline files (không có `.github/workflows/`)
- ❌ Multi-stage Docker build (image size chưa tối ưu)
- ❌ Security scanning (SAST, SCA, container scan)
- ❌ Pre-commit hooks (Husky, lint-staged)
- ❌ Conventional commits
- ❌ Coverage enforcement trong CI
- ❌ Database migration testing trong CI
- ❌ Environment-specific configs

### 12.2 Pipeline Đề Xuất Cho Dự Án

```yaml
# .github/workflows/ci.yml — CI Pipeline cho NestJS Ecommerce API
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10'

jobs:
  # ═══════════════════════════════════════
  # Stage 1: Lint + Type Check (song song)
  # ═══════════════════════════════════════
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: pnpm run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: npx tsc --noEmit

  # ═══════════════════════════════════════
  # Stage 2: Build
  # ═══════════════════════════════════════
  build:
    needs: [lint, type-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: pnpm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  # ═══════════════════════════════════════
  # Stage 3: Tests (song song)
  # ═══════════════════════════════════════
  unit-test:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: pnpm test:unit --coverage --ci --maxWorkers=2
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  integration-test:
    needs: [build]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: ecommerce_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test_user:test_password@localhost:5432/ecommerce_test
      REDIS_HOST: localhost
      REDIS_PORT: 6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: pnpm test:integration --ci

  # ═══════════════════════════════════════
  # Stage 4: Security (song song với tests)
  # ═══════════════════════════════════════
  security:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Secret Scanning
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Dependency Audit
        run: pnpm audit --audit-level=high
        continue-on-error: true  # Warn but don't block

  # ═══════════════════════════════════════
  # Stage 5: Docker Build + Push
  # ═══════════════════════════════════════
  docker:
    needs: [unit-test, integration-test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 12.3 Multi-Stage Dockerfile Đề Xuất

Dockerfile hiện tại dùng single-stage build. Đề xuất multi-stage để giảm image size:

```dockerfile
# ═══════════════════════════════════════
# Stage 1: Dependencies
# ═══════════════════════════════════════
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ═══════════════════════════════════════
# Stage 2: Build
# ═══════════════════════════════════════
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

# ═══════════════════════════════════════
# Stage 3: Production (minimal image)
# ═══════════════════════════════════════
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Generate Prisma client in production image
RUN npx prisma generate

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

**So sánh image size:**

| Dockerfile | Image size | Layers |
|-----------|-----------|--------|
| Single-stage (hiện tại) | ~500MB | 15+ |
| Multi-stage (đề xuất) | ~200MB | 8 |

**Lợi ích multi-stage:**
- Image nhỏ hơn 60% → pull nhanh hơn → deploy nhanh hơn
- Không có devDependencies trong production image
- Không có source code trong production image (chỉ có compiled JS)
- Attack surface nhỏ hơn

### 12.4 Pre-Commit Hooks Đề Xuất

```json
// package.json — thêm scripts
{
  "scripts": {
    "prepare": "husky",
    "lint-staged": "lint-staged"
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit $1
```

**Conventional Commits format:**
```
feat(payment): add Stripe checkout integration
fix(auth): resolve JWT token expiration issue
test(user): add unit tests for user service
chore(deps): update NestJS to v11.1
```

### 12.5 Coverage Thresholds Đề Xuất

Dựa trên architecture rules của dự án:

```typescript
// jest.config.ts — coverage thresholds nâng cao
export default {
  coverageThreshold: {
    // Global minimum
    global: {
      branches: 30,
      functions: 40,
      lines: 50,
      statements: 50,
    },
    // Critical modules — higher thresholds
    './src/routes/auth/': {
      branches: 80,
      functions: 90,
      lines: 90,
    },
    './src/routes/payment/': {
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
}
```

---

## 13. Lộ Trình Triển Khai CI/CD Cho Dự Án

### Phase 1: Foundation (Tuần 1-2) — "Chạy Được"

**Mục tiêu:** Có CI pipeline cơ bản chạy trên mỗi PR.

```
Checklist:
  □ Tạo .github/workflows/ci.yml
  □ Setup lint + type-check jobs
  □ Setup unit test job với coverage
  □ Setup pnpm caching
  □ Tạo branch protection rules (require CI pass trước khi merge)
```

**Kết quả mong đợi:**
- Mỗi PR tự động chạy lint + type-check + unit tests
- Developer biết ngay code có lỗi hay không trong 5 phút
- Không ai merge code mà chưa pass CI

**Maturity Level:** 2 → 3 (Manual → CI)

### Phase 2: Quality (Tuần 3-4) — "Chạy Tốt"

**Mục tiêu:** Thêm integration tests, security scanning, coverage enforcement.

```
Checklist:
  □ Setup integration test job (PostgreSQL + Redis services)
  □ Setup database migration testing
  □ Thêm pnpm audit cho dependency scanning
  □ Thêm gitleaks cho secret scanning
  □ Setup coverage thresholds (fail nếu dưới threshold)
  □ Setup Husky + lint-staged cho pre-commit hooks
  □ Setup commitlint cho conventional commits
```

**Kết quả mong đợi:**
- Integration tests chạy với real database trong CI
- Secrets không bao giờ lọt vào repo
- Coverage được enforce tự động
- Commit messages nhất quán

**Maturity Level:** 3 → 3.5

### Phase 3: Delivery (Tuần 5-8) — "Deploy Được"

**Mục tiêu:** Tự động build Docker image và deploy staging.

```
Checklist:
  □ Chuyển sang multi-stage Dockerfile
  □ Setup Docker build + push to registry (GHCR)
  □ Setup staging environment
  □ Setup auto-deploy staging khi merge vào main
  □ Setup smoke tests sau deploy staging
  □ Setup Slack notifications
```

**Kết quả mong đợi:**
- Merge vào main → tự động deploy staging
- Docker image tối ưu (~200MB thay vì ~500MB)
- Team biết ngay khi deploy thành công/thất bại

**Maturity Level:** 3.5 → 4 (CD - Delivery)

### Phase 4: Production (Tuần 9-12) — "Deploy An Toàn"

**Mục tiêu:** Production deployment với approval gates và rollback.

```
Checklist:
  □ Setup production environment với manual approval
  □ Setup rolling deployment trên Kubernetes
  □ Setup health check monitoring sau deploy
  □ Setup automated rollback khi health check fail
  □ Setup DORA metrics tracking
  □ Trivy container scanning
```

**Kết quả mong đợi:**
- Production deploy cần 1 click approve
- Automated rollback nếu có vấn đề
- DORA metrics được track

**Maturity Level:** 4 → 4.5

### Phase 5: Excellence (Tuần 13+) — "Deploy Xuất Sắc"

**Mục tiêu:** Canary deployment, feature flags, full observability.

```
Checklist:
  □ Setup canary deployment (5% → 25% → 100%)
  □ Integrate feature flags (Flagsmith/OpenFeature)
  □ Setup OpenTelemetry cho CI/CD observability
  □ Setup selective testing (chỉ test affected modules)
  □ Setup DAST scanning trên staging
  □ Optimize pipeline < 10 phút
```

**Kết quả mong đợi:**
- Canary deployment với automated analysis
- Feature flags cho safe releases
- Pipeline < 10 phút
- Full observability

**Maturity Level:** 4.5 → 5 (CD - Deployment)

### Timeline Tổng Quan

```
Tuần 1-2:   [████████] Phase 1: Foundation (CI cơ bản)
Tuần 3-4:   [████████] Phase 2: Quality (tests + security)
Tuần 5-8:   [████████████████] Phase 3: Delivery (staging deploy)
Tuần 9-12:  [████████████████] Phase 4: Production (prod deploy)
Tuần 13+:   [████████████████████████] Phase 5: Excellence (canary + flags)
```

---

## 14. Nguồn Tham Khảo

### Enterprise Case Studies

1. **Netflix** — "Full Cycle Developers at Netflix" — Netflix Tech Blog
2. **Netflix** — "Automated Canary Analysis at Netflix" — Netflix Tech Blog
3. **Spotify** — "Backstage: An Open Platform for Developer Portals" — backstage.io
4. **Google** — "Why Google Stores Billions of Lines of Code in a Single Repository" — Communications of the ACM
5. **Amazon** — "Automating safe, hands-off deployments" — Amazon Builders' Library
6. **Atlassian** — "1 Billion Build Minutes: Scaling CI/CD at Atlassian" — Atlassian Engineering Blog

### DevOps & CI/CD Best Practices

7. **DORA** — "Accelerate: State of DevOps Report" — dora.dev
8. **GitLab** — "The Ultimate Guide to CI/CD Pipeline Stages" — GitLab Docs
9. **GitHub** — "GitHub Actions Documentation" — docs.github.com
10. **Martin Fowler** — "Continuous Integration" — martinfowler.com
11. **Jez Humble & David Farley** — "Continuous Delivery" (Book) — continuousdelivery.com

### Security & DevSecOps

12. **OWASP** — "DevSecOps Guideline" — owasp.org
13. **Wiz** — "State of Code Security 2025" — wiz.io
14. **Snyk** — "State of Open Source Security" — snyk.io
15. **NIST** — "Secure Software Development Framework (SSDF)" — csrc.nist.gov

### Infrastructure & GitOps

16. **HashiCorp** — "Terraform Best Practices" — developer.hashicorp.com
17. **ArgoCD** — "GitOps with ArgoCD" — argo-cd.readthedocs.io
18. **CNCF** — "GitOps Principles" — opengitops.dev
19. **Crossplane** — "Infrastructure as Code, Reimagined" — crossplane.io

### Developer Productivity

20. **Gradle** — "Developer Productivity Engineering (DPE)" — gradle.com/developer-productivity-engineering
21. **REA Group** — "CI/CD Anti-Patterns at Scale" — REA Group Tech Blog
22. **Flo Health** — "900% Deployment Velocity Boost" — Flo Health Engineering Blog
23. **OpenFeature** — "Feature Flag Standard" — openfeature.dev

### NestJS & Node.js Specific

24. **NestJS** — "Official Documentation" — docs.nestjs.com
25. **Prisma** — "Deployment Guides" — prisma.io/docs/guides/deployment
26. **Docker** — "Best Practices for Node.js Docker Images" — docs.docker.com

---

> **Tài liệu này được viết cho dự án NestJS Ecommerce API.**
> Cập nhật lần cuối: 2026-02-24
> Phiên bản: 1.0.0