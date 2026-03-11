# 🏗️ TỔNG HỢP: Software Architecture, Docker, CI/CD & Cloud — Deep Dive

> **Mục đích**: Tài liệu tổng hợp toàn diện, tóm gọn nội dung đã có từ các file ZZ_11, ZZ_16, ZZ_75, ZZ_76, ZZ_77, ZZ_80 và bổ sung các phần còn thiếu: SOLID Principles, Clean Code, Cloud Services, Docker Networking, Kubernetes chuyên sâu, 12-Factor App.
>
> **Dự án**: NestJS Ecommerce API | **Ngày tạo**: 2026-03-11

---

## 📋 MỤC LỤC

### PHẦN A — SOFTWARE ARCHITECTURE & CLEAN CODE (BỔ SUNG MỚI)
1. [SOLID Principles Chuyên Sâu](#1-solid-principles-chuyên-sâu)
2. [Clean Code Principles (DRY, KISS, YAGNI, LoD)](#2-clean-code-principles)
3. [12-Factor App Methodology](#3-12-factor-app-methodology)

### PHẦN B — ARCHITECTURE PATTERNS (TÓM GỌN TỪ ZZ_11, ZZ_7, ZZ_20, ZZ_25)
4. [Clean Architecture — Tóm Tắt](#4-clean-architecture--tóm-tắt)
5. [Design Patterns Trong NestJS — Tóm Tắt](#5-design-patterns-trong-nestjs--tóm-tắt)
6. [CQRS & Event-Driven — Tóm Tắt](#6-cqrs--event-driven--tóm-tắt)

### PHẦN C — DOCKER & CONTAINERIZATION (TÓM GỌN ZZ_16, ZZ_75, ZZ_76, ZZ_77 + BỔ SUNG)
7. [Docker Core Concepts — Tóm Tắt](#7-docker-core-concepts--tóm-tắt)
8. [Dockerfile & Multi-Stage Build — Tóm Tắt](#8-dockerfile--multi-stage-build--tóm-tắt)
9. [Docker Networking Chuyên Sâu (MỚI)](#9-docker-networking-chuyên-sâu)
10. [Docker Compose Nâng Cao (MỚI)](#10-docker-compose-nâng-cao)

### PHẦN D — CI/CD & DEVOPS (TÓM GỌN ZZ_80 + BỔ SUNG)
11. [CI/CD Pipeline — Tóm Tắt](#11-cicd-pipeline--tóm-tắt)
12. [Deployment Strategies — Tóm Tắt](#12-deployment-strategies--tóm-tắt)

### PHẦN E — CLOUD & INFRASTRUCTURE (BỔ SUNG MỚI)
13. [Cloud Services Tổng Quan (AWS/GCP/Azure)](#13-cloud-services-tổng-quan)
14. [Kubernetes Chuyên Sâu (MỚI)](#14-kubernetes-chuyên-sâu)
15. [Infrastructure as Code & GitOps — Tóm Tắt](#15-infrastructure-as-code--gitops--tóm-tắt)

### PHẦN F — ÁP DỤNG CHO DỰ ÁN
16. [Áp Dụng Cho NestJS Ecommerce API](#16-áp-dụng-cho-nestjs-ecommerce-api)
17. [Tài Liệu Tham Khảo Chéo](#17-tài-liệu-tham-khảo-chéo)

---

# PHẦN A — SOFTWARE ARCHITECTURE & CLEAN CODE

---

## 1. SOLID Principles Chuyên Sâu

> SOLID là 5 nguyên tắc thiết kế hướng đối tượng bởi Robert C. Martin (Uncle Bob), giúp code dễ maintain, extend và test.

### 1.1. S — Single Responsibility Principle (SRP)

**Định nghĩa**: Mỗi class/module chỉ nên có MỘT lý do để thay đổi.

**Tại sao quan trọng?**
- Giảm coupling giữa các concerns
- Dễ test từng phần riêng biệt
- Khi requirements thay đổi, chỉ cần sửa 1 nơi

**Ví dụ trong dự án NestJS Ecommerce:**

```typescript
// ❌ VI PHẠM SRP — AuthService làm quá nhiều việc
@Injectable()
export class AuthService {
  async register(dto: RegisterDto) { /* ... */ }
  async login(dto: LoginDto) { /* ... */ }
  async sendOtpEmail(email: string) { /* ... */ }     // ← Email concern
  async hashPassword(password: string) { /* ... */ }   // ← Hashing concern
  async generateToken(user: User) { /* ... */ }        // ← Token concern
  async uploadAvatar(file: File) { /* ... */ }         // ← File concern
}

// ✅ TUÂN THỦ SRP — Tách thành các service riêng
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,     // Hashing concern
    private readonly tokenService: TokenService,         // Token concern
    private readonly emailService: EmailService,         // Email concern
    private readonly authRepo: AuthRepository,           // Data access concern
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await this.hashingService.hash(dto.password)
    const user = await this.authRepo.createUser({ ...dto, password: hashedPassword })
    const tokens = await this.tokenService.generateTokens(user)
    return { user, tokens }
  }
}
```

**Trong dự án hiện tại đã áp dụng SRP:**
- `HashingService` — chỉ lo hash/verify passwords
- `TokenService` — chỉ lo generate/verify JWT tokens
- `EmailService` — chỉ lo gửi email
- `S3Service` — chỉ lo upload/delete files trên S3
- Mỗi route module có `*.service.ts`, `*.repo.ts`, `*.controller.ts` riêng biệt

### 1.2. O — Open/Closed Principle (OCP)

**Định nghĩa**: Software entities nên OPEN for extension nhưng CLOSED for modification.

**Tại sao quan trọng?**
- Thêm tính năng mới mà không sửa code cũ
- Giảm risk regression bugs
- Code ổn định hơn theo thời gian

```typescript
// ❌ VI PHẠM OCP — Phải sửa code mỗi khi thêm payment method
@Injectable()
export class PaymentService {
  async processPayment(method: string, amount: number) {
    if (method === 'stripe') {
      // Stripe logic
    } else if (method === 'vnpay') {
      // VNPay logic
    } else if (method === 'momo') {  // ← Phải sửa class này mỗi khi thêm method
      // MoMo logic
    }
  }
}

// ✅ TUÂN THỦ OCP — Strategy Pattern
interface PaymentStrategy {
  processPayment(amount: number): Promise<PaymentResult>
}

@Injectable()
export class StripePaymentStrategy implements PaymentStrategy {
  async processPayment(amount: number) { /* Stripe logic */ }
}

@Injectable()
export class VNPayPaymentStrategy implements PaymentStrategy {
  async processPayment(amount: number) { /* VNPay logic */ }
}

// Thêm MoMo? Chỉ cần tạo class mới, KHÔNG sửa code cũ
@Injectable()
export class MoMoPaymentStrategy implements PaymentStrategy {
  async processPayment(amount: number) { /* MoMo logic */ }
}


```

**Trong dự án:** NestJS Guards sử dụng OCP — `AuthenticationGuard` delegate cho các strategy (Bearer, API Key, None) mà không cần sửa guard chính.

### 1.3. L — Liskov Substitution Principle (LSP)

**Định nghĩa**: Subclass phải có thể thay thế parent class mà không làm hỏng chương trình.

```typescript
// ❌ VI PHẠM LSP
class Bird {
  fly(): void { console.log('Flying') }
}
class Penguin extends Bird {
  fly(): void { throw new Error('Penguins cannot fly!') } // ← Phá vỡ contract
}

// ✅ TUÂN THỦ LSP — Tách interface
interface Flyable { fly(): void }
interface Swimmable { swim(): void }

class Eagle implements Flyable {
  fly(): void { console.log('Flying') }
}
class Penguin implements Swimmable {
  swim(): void { console.log('Swimming') }
}
```

**Trong dự án:** Tất cả Repository classes tuân thủ LSP — `AuthRepository`, `UserRepository` đều có thể thay thế nhau trong context data access mà không phá vỡ contract.

### 1.4. I — Interface Segregation Principle (ISP)

**Định nghĩa**: Client không nên bị ép phụ thuộc vào interface mà nó không sử dụng.

```typescript
// ❌ VI PHẠM ISP — Interface quá lớn
interface CRUDRepository<T> {
  create(data: T): Promise<T>
  findAll(): Promise<T[]>
  findById(id: string): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
  export(): Promise<Buffer>           // ← Không phải module nào cũng cần
  generateReport(): Promise<Report>   // ← Không phải module nào cũng cần
}

// ✅ TUÂN THỦ ISP — Tách thành interfaces nhỏ
interface Readable<T> {
  findAll(): Promise<T[]>
  findById(id: string): Promise<T>
}
interface Writable<T> {
  create(data: T): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
}
interface SoftDeletable {
  softDelete(id: string): Promise<void>
  restore(id: string): Promise<void>
}
```

### 1.5. D — Dependency Inversion Principle (DIP)

**Định nghĩa**: High-level modules không nên phụ thuộc vào low-level modules. Cả hai nên phụ thuộc vào abstractions.

```typescript
// ❌ VI PHẠM DIP
@Injectable()
export class OrderService {
  private prisma = new PrismaClient()  // ← Phụ thuộc trực tiếp
}

// ✅ TUÂN THỦ DIP — Injection
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,  // ← Abstraction
  ) {}
}
```

**Trong dự án:** NestJS DI Container tự động handle DIP — tất cả services nhận dependencies qua constructor injection.

### 1.6. SOLID Cheat Sheet

| Principle | Tóm tắt | Keyword |
|-----------|---------|---------|
| **S**RP | Mỗi class chỉ có 1 lý do thay đổi | "One reason to change" |
| **O**CP | Mở cho extension, đóng cho modification | "Extend, don't modify" |
| **L**SP | Subclass thay thế parent không hỏng | "Substitutable" |
| **I**SP | Interface nhỏ, chuyên biệt | "Don't force unused methods" |
| **D**IP | Phụ thuộc vào abstraction | "Depend on abstractions" |

---

## 2. Clean Code Principles

### 2.1. DRY — Don't Repeat Yourself

Mỗi piece of knowledge chỉ nên có MỘT representation duy nhất.

**Trong dự án:** `SharedModule` chứa `PrismaService`, `HashingService`, `TokenService` — tránh duplicate logic. Pagination logic được abstract thành shared helper.

### 2.2. KISS — Keep It Simple, Stupid

Giải pháp đơn giản nhất thường là tốt nhất. Đừng over-engineer.

```typescript
// ❌ Over-engineered — Abstract Factory cho 1 use case
class PaymentProcessorAbstractFactoryBuilder {
  private strategies = new Map()
  withStrategy(name, strategy) { this.strategies.set(name, strategy); return this }
  build() { return new PaymentProcessorFactory(this.strategies) }
}

// ✅ KISS — Đơn giản, rõ ràng
@Injectable()
export class PaymentService {
  async processStripePayment(amount: number) {
    return this.stripe.charges.create({ amount })
  }
}
```

### 2.3. YAGNI — You Aren't Gonna Need It

Không implement tính năng cho đến khi thực sự cần.

```typescript
// ❌ YAGNI — Thêm GraphQL support "phòng khi cần"
@Module({
  imports: [GraphQLModule.forRoot({ /* config */ })],  // Chưa ai dùng GraphQL
})

// ✅ YAGNI — Chỉ implement REST API đang cần
@Module({
  imports: [/* chỉ những gì đang dùng */],
})
```

### 2.4. Law of Demeter (LoD) — Principle of Least Knowledge

Một object chỉ nên giao tiếp với "bạn bè trực tiếp", không nên "nói chuyện với người lạ".

```typescript
// ❌ Vi phạm LoD — Chain quá sâu
const city = order.getCustomer().getAddress().getCity()

// ✅ Tuân thủ LoD — Delegate
const city = order.getShippingCity()  // Order tự biết cách lấy city
```

### 2.5. Composition over Inheritance

Ưu tiên composition (has-a) hơn inheritance (is-a).

```typescript
// ❌ Deep inheritance chain
class Animal { }
class Mammal extends Animal { }
class Dog extends Mammal { }
class GuideDog extends Dog { }  // 4 levels deep!

// ✅ Composition — NestJS Mixins pattern
const TimeStampMixin = <T extends Constructor>(Base: T) =>
  class extends Base {
    createdAt = new Date()
    updatedAt = new Date()
  }

const SoftDeleteMixin = <T extends Constructor>(Base: T) =>
  class extends Base {
    deletedAt: Date | null = null
    softDelete() { this.deletedAt = new Date() }
  }
```

### 2.6. Clean Code Cheat Sheet

| Principle | Khi nào áp dụng | Anti-pattern |
|-----------|-----------------|-------------|
| **DRY** | Thấy copy-paste code | Shotgun surgery |
| **KISS** | Thiết kế solution | Over-engineering |
| **YAGNI** | Planning features | Gold plating |
| **LoD** | Object communication | Train wreck (a.b.c.d) |
| **Composition > Inheritance** | Code reuse | Deep inheritance |

---

## 3. 12-Factor App Methodology

> 12-Factor App là methodology cho building SaaS apps, đặc biệt quan trọng cho cloud-native và containerized applications.

| # | Factor | Mô tả | Áp dụng trong dự án |
|---|--------|-------|---------------------|
| 1 | **Codebase** | Một codebase trong VCS, nhiều deploys | ✅ Git repo, deploy dev/staging/prod |
| 2 | **Dependencies** | Khai báo explicit, isolate | ✅ `pnpm-lock.yaml`, `--frozen-lockfile` |
| 3 | **Config** | Lưu config trong environment | ✅ `.env`, `docker-compose.yml` env vars |
| 4 | **Backing Services** | Treat as attached resources | ✅ PostgreSQL, Redis qua `DATABASE_URL`, `REDIS_URL` |
| 5 | **Build, Release, Run** | Tách biệt 3 stages | ⚠️ Cần CI/CD pipeline (ZZ_80) |
| 6 | **Processes** | Stateless processes | ✅ NestJS API stateless, session trong Redis |
| 7 | **Port Binding** | Export services via port | ✅ `EXPOSE 3000` trong Dockerfile |
| 8 | **Concurrency** | Scale out via process model | ⚠️ Cần Kubernetes/ECS horizontal scaling |
| 9 | **Disposability** | Fast startup, graceful shutdown | ⚠️ Cần `dumb-init` + graceful shutdown |
| 10 | **Dev/Prod Parity** | Keep environments similar | ✅ Docker đảm bảo consistency |
| 11 | **Logs** | Treat logs as event streams | ✅ NestJS Logger → stdout → Docker captures |
| 12 | **Admin Processes** | Run admin tasks as one-off | ✅ `initialScript/` cho seeding, `prisma migrate` |

**Các factor cần cải thiện:**
- Factor 5: Implement CI/CD pipeline (xem ZZ_80)
- Factor 8: Setup Kubernetes horizontal pod autoscaler
- Factor 9: Thêm `dumb-init` vào Dockerfile, implement graceful shutdown

---

# PHẦN B — ARCHITECTURE PATTERNS (TÓM GỌN)

---

## 4. Clean Architecture — Tóm Tắt

> Chi tiết đầy đủ: [ZZ_11_CLEAN_ARCHITECTURE_TRONG_NESTJS.md](./ZZ_11_CLEAN_ARCHITECTURE_TRONG_NESTJS.md)

```
┌─────────────────────────────────────────────────────┐
│                 CLEAN ARCHITECTURE                    │
│                                                       │
│   ┌───────────────────────────────────────────┐      │
│   │         Frameworks & Drivers               │      │
│   │   Prisma, Express, Socket.IO, BullMQ      │      │
│   │   ┌───────────────────────────────────┐   │      │
│   │   │      Interface Adapters            │   │      │
│   │   │   Controllers, DTOs, Guards        │   │      │
│   │   │   ┌───────────────────────────┐   │   │      │
│   │   │   │     Use Cases              │   │   │      │
│   │   │   │   Services (Business)      │   │   │      │
│   │   │   │   ┌───────────────────┐   │   │   │      │
│   │   │   │   │    Entities        │   │   │   │      │
│   │   │   │   │  Domain Models     │   │   │   │      │
│   │   │   │   └───────────────────┘   │   │   │      │
│   │   │   └───────────────────────────┘   │   │      │
│   │   └───────────────────────────────────┘   │      │
│   └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
  Dependencies point INWARD → Inner layers don't know outer
```

**Request Flow trong dự án:**

```
HTTP Request → Controller → DTO Validation → Service → Repository → Prisma → Database
                                                                              ↓
HTTP Response ← Controller ← Response DTO ← Service ← Repository ← Prisma ← Result
```

**Áp dụng trong dự án:**
- **Entities Layer**: Domain models (`*.model.ts`)
- **Use Cases Layer**: Services (`*.service.ts`) — business logic
- **Interface Adapters**: Controllers (`*.controller.ts`), DTOs (`*.dto.ts`), Guards
- **Frameworks**: Prisma ORM, Express, Socket.IO

---

## 5. Design Patterns Trong NestJS — Tóm Tắt

> Chi tiết: [ZZ_7](./ZZ_7_NESTJS_INTERVIEW_COMPREHENSIVE_GUIDE.md), [ZZ_25](./ZZ_25_NESTJS_INTERVIEW_COMPLETE_GUIDE.md)

| Pattern | Sử dụng trong dự án | Ví dụ |
|---------|---------------------|-------|
| **Dependency Injection** | Toàn bộ project | Constructor injection qua NestJS IoC |
| **Repository** | Data access layer | `AuthRepository`, `UserRepository`, `ProductRepository` |
| **Strategy** | Authentication | `BearerStrategy`, `ApiKeyStrategy`, `NoneStrategy` |
| **Decorator** | Cross-cutting concerns | `@Auth()`, `@ActiveUser()`, `@IsPublic()` |
| **Observer** | Events & WebSocket | Socket.IO events, BullMQ job events |
| **Factory** | Dynamic providers | `useFactory` trong module configs |
| **Singleton** | Service instances | NestJS default scope = singleton |
| **Chain of Responsibility** | Request pipeline | Middleware → Guard → Interceptor → Pipe → Handler → Filter |
| **CQRS** | Payment module | Commands (write) vs Queries (read) tách biệt |
| **Module** | Code organization | Mỗi domain = 1 NestJS module |

---

## 6. CQRS & Event-Driven — Tóm Tắt

> Chi tiết: [ZZ_20](./ZZ_20_BLOG_CQRS_PATTERN_NESTJS_IMPLEMENTATION.md), [cqrs-payment-architecture.md](./cqrs-payment-architecture.md)

```
CQRS Pattern:
  ┌─────────────┐     ┌──────────────────┐
  │   Command    │────▶│  Command Handler │────▶ Write DB
  │ (CreateOrder)│     │  (Business Logic)│
  └─────────────┘     └──────────────────┘

  ┌─────────────┐     ┌──────────────────┐
  │    Query     │────▶│  Query Handler   │────▶ Read DB (có thể khác)
  │ (GetOrders)  │     │  (Read Logic)    │
  └─────────────┘     └──────────────────┘
```

**Khi nào dùng CQRS?**
- Read/Write patterns khác nhau đáng kể
- Cần optimize read và write riêng biệt
- Domain phức tạp (Payment, Order)
- Cần audit trail cho mọi thay đổi

---

# PHẦN C — DOCKER & CONTAINERIZATION

> Tóm gọn từ: [ZZ_16](./ZZ_16_DOCKER_DATABASE_SETUP.md), [ZZ_75](./ZZ_75_DOCKERFILE_ENTERPRISE_DEEP_DIVE_VI.md), [ZZ_76](./ZZ_76_DOCKER_WORKFLOW_EXPLAINED.md), [ZZ_77](./ZZ_77_DOCKER_INTERVIEW_QUESTIONS_EXPLAINED.md) + Bổ sung Docker Networking & Compose nâng cao.

---

## 7. Docker Core Concepts — Tóm Tắt

> Chi tiết: [ZZ_77](./ZZ_77_DOCKER_INTERVIEW_QUESTIONS_EXPLAINED.md)

### 7.1. Kiến Trúc Docker

```
Docker Client (CLI)  ──REST API──▶  Docker Daemon (dockerd)
                                        │
                                        ├── Images
                                        ├── Containers
                                        ├── Networks
                                        └── Volumes
                                        │
                                        ▼
                                Docker Registry
                          (Docker Hub, ECR, GCR, ACR)
```

| Thành phần | Vai trò | Tương tự |
|------------|---------|----------|
| **Dockerfile** | Recipe để build image | Source code |
| **Image** | Snapshot read-only của app | Compiled binary |
| **Container** | Instance đang chạy của image | Running process |
| **Registry** | Lưu trữ & phân phối images | npm registry |
| **Volume** | Persistent storage | Mounted disk |
| **Network** | Kết nối giữa containers | Virtual LAN |

### 7.2. Docker vs Virtual Machine

```
Container:                          Virtual Machine:
┌──────────┐ ┌──────────┐          ┌──────────┐ ┌──────────┐
│   App A  │ │   App B  │          │   App A  │ │   App B  │
├──────────┤ ├──────────┤          ├──────────┤ ├──────────┤
│  Bins/Libs│ │ Bins/Libs│          │  Bins/Libs│ │ Bins/Libs│
├──────────┴─┴──────────┤          ├──────────┤ ├──────────┤
│    Container Engine    │          │ Guest OS │ │ Guest OS │
├────────────────────────┤          ├──────────┴─┴──────────┤
│       Host OS          │          │      Hypervisor       │
├────────────────────────┤          ├────────────────────────┤
│      Hardware          │          │      Hardware          │
└────────────────────────┘          └────────────────────────┘
  Startup: ~giây                      Startup: ~phút
  Size: ~MB                           Size: ~GB
  Isolation: Process-level            Isolation: Full OS
```

**Tại sao doanh nghiệp chọn Docker?**
- **Consistency**: Dev, staging, production giống hệt nhau → hết "works on my machine"
- **Speed**: Build 2-3 phút, deploy 5 phút, rollback tức thì
- **Scalability**: Auto-scaling dễ dàng với K8s
- **Cost**: Image nhỏ (1GB → 100MB), tiết kiệm bandwidth & storage

### 7.3. Image Layers & Caching

```
Layer 5: CMD ["node", "dist/main.js"]        ← Thay đổi ít
Layer 4: COPY . .                             ← Thay đổi thường xuyên
Layer 3: RUN pnpm install --frozen-lockfile   ← Cache nếu package.json không đổi
Layer 2: COPY package.json pnpm-lock.yaml ./  ← Thay đổi khi thêm dependency
Layer 1: FROM node:18-alpine                  ← Base image, ít thay đổi
```

**Nguyên tắc tối ưu cache:**
- Đặt lệnh ít thay đổi lên trước (FROM, WORKDIR)
- Copy package files trước, install, rồi mới copy source code
- Mỗi lệnh RUN, COPY, ADD tạo 1 layer mới
- Khi 1 layer thay đổi → tất cả layers sau bị rebuild

### 7.4. Container Lifecycle

```
docker create → Created
docker start  → Running ←──── docker restart
docker pause  → Paused  ──── docker unpause → Running
docker stop   → Stopped ──── docker start   → Running
docker rm     → Deleted
```

---

## 8. Dockerfile & Multi-Stage Build — Tóm Tắt

> Chi tiết: [ZZ_75](./ZZ_75_DOCKERFILE_ENTERPRISE_DEEP_DIVE_VI.md)

### 8.1. Dockerfile Hiện Tại Của Dự Án (Single-Stage)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
RUN chown -R nestjs:nodejs /app
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm run start:prod"]
```

**Vấn đề**: Image chứa cả devDependencies, source code, build tools → nặng & kém bảo mật.

### 8.2. Multi-Stage Build — Enterprise Pattern

```dockerfile
# ── Stage 1: Dependencies ──
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@8 && pnpm install --frozen-lockfile

# ── Stage 2: Builder ──
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx pnpm build
RUN npx pnpm prune --prod   # Xóa devDependencies

# ── Stage 3: Runner (Production) ──
FROM node:18-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init curl
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

**Lợi ích Multi-Stage:**

| Metric | Single-Stage | Multi-Stage |
|--------|-------------|-------------|
| Image size | ~800MB | ~200MB |
| Attack surface | Lớn (có build tools) | Nhỏ (chỉ runtime) |
| Build cache | Kém | Tốt (tách deps/build) |
| Security | devDeps trong image | Chỉ prod deps |

### 8.3. CMD vs ENTRYPOINT

```dockerfile
# CMD — Dễ override khi docker run
CMD ["node", "dist/main.js"]
# docker run myapp node dist/seed.js  → chạy seed thay vì main

# ENTRYPOINT — Luôn chạy, CMD thành arguments
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
# docker run myapp node dist/seed.js  → dumb-init -- node dist/seed.js
```

**Best practice**: Dùng ENTRYPOINT cho process manager (dumb-init), CMD cho app command.

### 8.4. .dockerignore Của Dự Án

```dockerignore
node_modules          # Không copy host node_modules
dist                  # Build lại trong container
.git                  # Không cần VCS history
.env                  # Secrets không vào image!
.env.*
coverage              # Test artifacts
*.log
.vscode / .idea       # IDE configs
```

**Tại sao quan trọng?** Giảm build context size → build nhanh hơn, image nhỏ hơn, không leak secrets.

---

## 9. Docker Networking Chuyên Sâu (MỚI)

### 9.1. Các Loại Network Driver

| Driver | Mô tả | Use case |
|--------|--------|----------|
| **bridge** | Default, tạo virtual bridge | Container cùng host giao tiếp |
| **host** | Dùng network stack của host | Performance-critical (không port mapping) |
| **overlay** | Multi-host networking | Docker Swarm / multi-node |
| **macvlan** | Gán MAC address riêng | Container cần IP trên physical network |
| **none** | Không có network | Isolated containers |

### 9.2. Bridge Network — Dự Án Đang Dùng

```yaml
# docker-compose.yml
networks:
  ecom-network:
    driver: bridge    # ← Dự án dùng bridge network
```

```
┌─────────────────── ecom-network (bridge) ───────────────────┐
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ ecom-api │    │ postgres │    │  redis   │              │
│  │ :3000    │───▶│ :5432    │    │ :6379    │              │
│  │          │───▶│          │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│  DNS Resolution: api gọi "postgres" → resolve IP tự động    │
│  DNS Resolution: api gọi "redis"    → resolve IP tự động    │
└──────────────────────────────────────────────────────────────┘
```

**Cách containers giao tiếp:**
- Cùng network → gọi nhau bằng **service name** (DNS tự động)
- `DATABASE_URL: postgresql://...@postgres:5432/ecom_db` — `postgres` là service name
- `REDIS_HOST: redis` — `redis` là service name
- Khác network → không thể giao tiếp (isolation)

### 9.3. Port Mapping

```yaml
ports:
  - '3000:3000'    # host_port:container_port
  - '5432:5432'    # Expose PostgreSQL ra host (dev only!)
  - '6379:6379'    # Expose Redis ra host (dev only!)
```

```
Host Machine                    Docker Network
┌────────────┐                 ┌────────────────┐
│ :3000 ─────┼────────────────▶│ ecom-api:3000  │
│ :5432 ─────┼────────────────▶│ postgres:5432  │
│ :6379 ─────┼────────────────▶│ redis:6379     │
└────────────┘                 └────────────────┘
```

**Production**: Chỉ expose port API (3000), KHÔNG expose DB/Redis ra ngoài.

### 9.4. Network Security Best Practices

```yaml
# Production: Tách frontend/backend network
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true    # ← Không có internet access

services:
  api:
    networks: [frontend, backend]   # Cầu nối 2 networks
  postgres:
    networks: [backend]             # Chỉ backend, không expose ra ngoài
  redis:
    networks: [backend]
  nginx:
    networks: [frontend]            # Chỉ frontend
```

---

## 10. Docker Compose Nâng Cao (MỚI)

### 10.1. Docker Compose Hiện Tại Của Dự Án

```yaml
services:
  postgres:                          # Database
    image: postgres:17-alpine
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ecom_user -d ecom_db']
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:                             # Cache & BullMQ
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory-policy noeviction
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']

  api:                               # NestJS Application
    build: .
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://ecom_user:ecom_password@postgres:5432/ecom_db
      REDIS_HOST: redis
    volumes:
      - ./uploads:/app/uploads       # Persist uploaded files
      - ./prisma:/app/prisma         # Sync Prisma schema

volumes:
  postgres_data:
  redis_data:

networks:
  ecom-network:
    driver: bridge
```

### 10.2. Health Checks — Tại Sao Quan Trọng?

```yaml
# PostgreSQL health check
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U ecom_user -d ecom_db']
  interval: 10s      # Kiểm tra mỗi 10 giây
  timeout: 5s        # Timeout sau 5 giây
  retries: 5         # Thử lại 5 lần trước khi unhealthy

# Redis health check
healthcheck:
  test: ['CMD', 'redis-cli', 'ping']
  interval: 10s
  timeout: 5s
  retries: 5
```

**Kết hợp với `depends_on`:**
```yaml
depends_on:
  postgres:
    condition: service_healthy    # Chờ DB healthy rồi mới start API
  redis:
    condition: service_healthy    # Chờ Redis healthy
```

→ Đảm bảo API không start khi DB/Redis chưa sẵn sàng, tránh connection errors.

### 10.3. Volumes — Persistent Data

```yaml
volumes:
  # Named volumes — Docker quản lý, persist qua restart
  postgres_data:        # DB data sống sót khi container bị xóa
  redis_data:           # Redis AOF data

  # Bind mounts — Map thư mục host ↔ container
  - ./uploads:/app/uploads    # Upload files persist trên host
  - ./prisma:/app/prisma      # Sync schema giữa host và container
```

| Loại | Syntax | Quản lý bởi | Use case |
|------|--------|-------------|----------|
| **Named volume** | `postgres_data:` | Docker | Database, persistent data |
| **Bind mount** | `./src:/app/src` | Host filesystem | Dev hot-reload, config files |
| **tmpfs** | `tmpfs: /tmp` | Memory | Temp data, test DB (fast) |

### 10.4. Environment Variables Strategy

```
Thứ tự ưu tiên (cao → thấp):
1. environment trong docker-compose.yml    ← Dự án dùng cách này
2. env_file trong docker-compose.yml
3. .env file ở cùng thư mục docker-compose.yml
4. Default values trong application code
```

**Dự án hiện tại**: Hardcode env trong docker-compose.yml (OK cho dev, KHÔNG OK cho production).

**Production pattern:**
```yaml
# docker-compose.prod.yml
services:
  api:
    env_file:
      - .env.production    # Secrets trong file riêng, KHÔNG commit vào git
```

### 10.5. Multi-Environment Compose Files

```bash
# Development (mặc định)
docker compose up -d

# Production — override/merge
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Testing — DB in-memory cho speed
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

```yaml
# docker-compose.prod.yml (override)
services:
  api:
    environment:
      NODE_ENV: production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G
  postgres:
    ports: []    # Xóa port mapping, không expose DB ra ngoài
  redis:
    ports: []    # Xóa port mapping
```

### 10.6. Useful Docker Commands

```bash
# Lifecycle
docker compose up -d              # Start tất cả services (detached)
docker compose down               # Stop & remove containers
docker compose down -v            # Stop & xóa cả volumes (reset data)
docker compose restart api        # Restart 1 service

# Monitoring
docker compose ps                 # Xem status tất cả services
docker compose logs -f api        # Follow logs của API
docker compose top                # Xem processes trong containers

# Debugging
docker compose exec api sh        # Shell vào container API
docker compose exec postgres psql -U ecom_user -d ecom_db  # Vào psql

# Build
docker compose build --no-cache   # Rebuild image (không cache)
docker compose up -d --build      # Rebuild + restart
```

---

# PHẦN D — CI/CD & DEVOPS

> Tóm gọn từ: [ZZ_80](./ZZ_80_CI_CD_ENTERPRISE_PIPELINE_GUIDE.md) + Bổ sung deployment strategies.

---

## 11. CI/CD Pipeline — Tóm Tắt

> Chi tiết đầy đủ: [ZZ_80](./ZZ_80_CI_CD_ENTERPRISE_PIPELINE_GUIDE.md)

### 11.1. CI/CD Là Gì?

```
CI (Continuous Integration):
  Developer push code → Auto build → Auto test → Báo kết quả ngay

CD (Continuous Delivery):
  CI pass → Đóng gói artifact → Deploy staging → Sẵn sàng production (1 click)

CD (Continuous Deployment):
  CI pass → Auto deploy production (không cần approve)
  Amazon deploy mỗi 11.7 giây — đây là Continuous Deployment
```

### 11.2. Pipeline Đề Xuất Cho Dự Án

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Lint   │──▶│  Build  │──▶│  Test   │──▶│ Security │──▶│ Docker   │──▶│ Deploy   │
│Type-check│   │         │   │Unit+Int │   │SAST, SCA │   │Build+Push│   │Staging→  │
│(song song)│   │         │   │(song song)│   │          │   │          │   │Production│
└─────────┘   └─────────┘   └─────────┘   └──────────┘   └──────────┘   └──────────┘
```

**Trạng thái hiện tại của dự án:**
- ✅ Có: Dockerfile, docker-compose.yml, test scripts, ESLint config
- ❌ Chưa có: `.github/workflows/`, pre-commit hooks, security scanning, coverage enforcement

### 11.3. GitHub Actions Pipeline Đề Xuất (Tóm Gọn)

```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  # Stage 1: Lint + Type Check (song song, ~1 phút)
  lint:        # pnpm lint
  type-check:  # tsc --noEmit

  # Stage 2: Build (~2 phút)
  build:
    needs: [lint, type-check]
    # pnpm install → prisma generate → pnpm build

  # Stage 3: Tests (song song, ~3 phút)
  unit-test:        # pnpm test:unit --coverage
  integration-test: # pnpm test:integration (cần PostgreSQL + Redis services)

  # Stage 4: Security (song song với tests)
  security:   # gitleaks + pnpm audit

  # Stage 5: Docker Build + Push (chỉ main branch)
  docker:
    needs: [unit-test, integration-test, security]
    if: github.ref == 'refs/heads/main'
    # docker/build-push-action → ghcr.io
```

### 11.4. DevSecOps — Security Trong Pipeline

```
Shift-Left Security: Phát hiện lỗ hổng sớm = fix rẻ hơn 100x

Lớp 1: Pre-Commit     → gitleaks (scan secrets trước khi commit)
Lớp 2: CI - SAST      → Semgrep (scan source code tĩnh)
Lớp 3: CI - SCA       → pnpm audit, Snyk (scan dependencies)
Lớp 4: CI - Container → Trivy (scan Docker image)
Lớp 5: Staging - DAST → OWASP ZAP (test app đang chạy)
```

### 11.5. DORA Metrics — Đo Hiệu Quả DevOps

| Metric | Định nghĩa | Elite Target |
|--------|-----------|-------------|
| Deployment Frequency | Bao lâu deploy 1 lần? | Nhiều lần/ngày |
| Lead Time for Changes | Commit → production? | < 1 giờ |
| Change Failure Rate | % deploy gây incident? | 0-15% |
| Mean Time to Recovery | Thời gian recover? | < 1 giờ |

---

## 12. Deployment Strategies — Tóm Tắt

### 12.1. So Sánh 3 Chiến Lược Chính

```
Blue-Green:
  [Blue v1.0] ←── Load Balancer ──→ [Green v1.1]
  Switch traffic tức thì. Rollback = switch ngược.

Canary:
  [v1.0 - 95%] ←── Load Balancer ──→ [v1.1 - 5%]
  Tăng dần: 5% → 25% → 50% → 100%. Metrics xấu → rollback.

Rolling:
  [Pod1-v2] [Pod2-v1] [Pod3-v1] [Pod4-v1]  ← Thay từng pod
  [Pod1-v2] [Pod2-v2] [Pod3-v1] [Pod4-v1]
  [Pod1-v2] [Pod2-v2] [Pod3-v2] [Pod4-v2]  ← Done!
```

| Tiêu chí | Blue-Green | Canary | Rolling |
|----------|-----------|--------|---------|
| Downtime | Zero | Zero | Near-zero |
| Rollback speed | Instant (giây) | Nhanh (phút) | Chậm (phút) |
| Extra infra | 2x | +5-10% | Không |
| Blast radius | 0% hoặc 100% | 1-5% ban đầu | Tăng dần |
| Complexity | Trung bình | Cao | Thấp |
| Best for | Critical apps | High-traffic | Standard apps |

### 12.2. Recommendation Cho Dự Án

```
Giai đoạn đầu:  Rolling Deployment (đơn giản, K8s native)
Traffic tăng:   Canary Deployment (validate với real users)
Critical:       Blue-Green (zero-risk switching)
```

### 12.3. Feature Flags — Deploy ≠ Release

```typescript
// Tách deployment (đưa code lên prod) khỏi release (bật feature)
if (await featureFlags.isEnabled('new-stripe-checkout', {
  userId: order.userId,
  percentage: 10,  // Chỉ 10% users
})) {
  return this.processWithNewStripeCheckout(order)
}
return this.processWithLegacyPayment(order)
// Rollback = tắt flag (milliseconds), code vẫn ở production
```

**Progressive Delivery (Ring-based):**
```
Ring 0: Internal team (50 users)        → 1-2 ngày
Ring 1: Early adopters (5,000 users)    → 3-5 ngày
Ring 2: 10% production (100,000 users)  → 5-7 ngày
Ring 3: 50% production                  → 7 ngày
Ring 4: Full rollout 100%
Metrics xấu ở bất kỳ ring nào → STOP
```

---

# PHẦN E — CLOUD & INFRASTRUCTURE

> Bổ sung mới: Cloud Services tổng quan, Kubernetes chuyên sâu, Infrastructure as Code & GitOps.

---

## 13. Cloud Services Tổng Quan

### 13.1. Cloud Services Dự Án Đang Dùng

| Service | Provider | Mục đích trong dự án |
|---------|----------|---------------------|
| **S3** | AWS | Upload/storage hình ảnh sản phẩm, presigned URLs |
| **PostgreSQL** | Local/Docker (có thể migrate → RDS) | Database chính |
| **Redis** | Local/Docker (có thể migrate → ElastiCache) | Caching, BullMQ job queue |
| **Resend** | Resend.com | Gửi email OTP |
| **Mux** | Mux.com | Video streaming/processing |
| **Anthropic** | Anthropic API | AI Assistant |

### 13.2. AWS Services Mapping Cho Dự Án

```
NestJS Ecommerce API — AWS Architecture:

┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                             │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Route 53 │───▶│ ALB / API GW │───▶│ ECS / EKS    │       │
│  │ (DNS)    │    │ (Load Bal.)  │    │ (Containers) │       │
│  └──────────┘    └──────────────┘    └──────┬───────┘       │
│                                              │               │
│                    ┌─────────────────────────┼──────┐        │
│                    │                         │      │        │
│              ┌─────▼─────┐  ┌────────────┐  │  ┌───▼────┐   │
│              │ RDS       │  │ ElastiCache│  │  │ S3     │   │
│              │ PostgreSQL│  │ Redis      │  │  │ Storage│   │
│              └───────────┘  └────────────┘  │  └────────┘   │
│                                              │               │
│              ┌───────────┐  ┌────────────┐  │               │
│              │ SES       │  │ CloudWatch │  │               │
│              │ Email     │  │ Monitoring │  │               │
│              └───────────┘  └────────────┘  │               │
│                                              │               │
│              ┌───────────┐  ┌────────────┐  │               │
│              │ Secrets   │  │ ECR        │  │               │
│              │ Manager   │  │ Registry   │  │               │
│              └───────────┘  └────────────┘  │               │
└─────────────────────────────────────────────────────────────┘
```

### 13.3. So Sánh Cloud Providers

| Service | AWS | GCP | Azure |
|---------|-----|-----|-------|
| Compute (Container) | ECS / EKS | Cloud Run / GKE | ACI / AKS |
| Database (PostgreSQL) | RDS | Cloud SQL | Azure DB for PostgreSQL |
| Cache (Redis) | ElastiCache | Memorystore | Azure Cache for Redis |
| Object Storage | S3 | Cloud Storage | Blob Storage |
| Container Registry | ECR | Artifact Registry | ACR |
| Secret Management | Secrets Manager | Secret Manager | Key Vault |
| Monitoring | CloudWatch | Cloud Monitoring | Azure Monitor |
| CI/CD | CodePipeline | Cloud Build | Azure DevOps |

### 13.4. Managed vs Self-Hosted — Khi Nào Dùng Gì?

| Tiêu chí | Managed (RDS, ElastiCache) | Self-Hosted (Docker) |
|----------|---------------------------|---------------------|
| Setup | Vài click/Terraform | Tự cài, tự config |
| Maintenance | Provider lo | Tự lo patches, upgrades |
| Backup | Tự động | Tự setup |
| HA/Failover | Built-in | Tự config replication |
| Cost | Cao hơn | Thấp hơn (nhưng tốn effort) |
| Best for | Production | Development, small projects |

**Recommendation cho dự án:**
- **Dev**: Docker Compose (hiện tại) — đủ tốt
- **Production**: Managed services (RDS + ElastiCache + ECS/EKS + S3)

---

## 14. Kubernetes Chuyên Sâu (MỚI)

### 14.1. Kubernetes Là Gì?

Container orchestration platform — quản lý hàng trăm/nghìn containers tự động:
- **Scheduling**: Quyết định container chạy trên node nào
- **Scaling**: Tự động tăng/giảm số replicas theo load
- **Self-healing**: Container crash → tự restart
- **Service discovery**: Containers tìm nhau qua DNS
- **Rolling updates**: Deploy version mới không downtime

### 14.2. K8s Architecture

```
┌─────────────────── Kubernetes Cluster ───────────────────┐
│                                                           │
│  ┌─────────── Control Plane ───────────┐                 │
│  │  API Server ← kubectl, CI/CD        │                 │
│  │  etcd (cluster state database)      │                 │
│  │  Scheduler (assign pods to nodes)   │                 │
│  │  Controller Manager (desired state) │                 │
│  └─────────────────────────────────────┘                 │
│                      │                                    │
│         ┌────────────┼────────────┐                      │
│         ▼            ▼            ▼                      │
│  ┌──── Node 1 ────┐ ┌── Node 2 ──┐ ┌── Node 3 ──┐     │
│  │ kubelet        │ │ kubelet    │ │ kubelet    │     │
│  │ kube-proxy     │ │ kube-proxy │ │ kube-proxy │     │
│  │ ┌────┐ ┌────┐ │ │ ┌────┐    │ │ ┌────┐    │     │
│  │ │Pod1│ │Pod2│ │ │ │Pod3│    │ │ │Pod4│    │     │
│  │ │API │ │API │ │ │ │API │    │ │ │API │    │     │
│  │ └────┘ └────┘ │ │ └────┘    │ │ └────┘    │     │
│  └────────────────┘ └───────────┘ └───────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 14.3. K8s Objects Cho Dự Án

| Object | Mục đích | Ví dụ trong dự án |
|--------|---------|-------------------|
| **Pod** | Đơn vị nhỏ nhất, chứa 1+ containers | 1 pod = 1 NestJS API instance |
| **Deployment** | Quản lý replicas, rolling updates | 3 replicas API |
| **Service** | Expose pods ra network, load balancing | ClusterIP cho internal, LoadBalancer cho external |
| **ConfigMap** | Config không nhạy cảm | APP_NAME, NODE_ENV, CORS origins |
| **Secret** | Config nhạy cảm (encrypted) | DATABASE_URL, JWT secrets, S3 keys |
| **Ingress** | HTTP routing, SSL termination | api.example.com → API Service |
| **HPA** | Horizontal Pod Autoscaler | Scale 3→10 pods khi CPU > 70% |
| **PVC** | Persistent Volume Claim | Upload storage |

### 14.4. Deployment Manifest Cho Dự Án

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-ecommerce-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # Thêm tối đa 1 pod mới
      maxUnavailable: 0    # Không pod nào down
  selector:
    matchLabels:
      app: nestjs-api
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/yourorg/nestjs-ecommerce:${IMAGE_TAG}
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: { name: api-secrets, key: database-url }
            - name: REDIS_URL
              valueFrom:
                secretKeyRef: { name: api-secrets, key: redis-url }
          resources:
            requests: { memory: '256Mi', cpu: '250m' }
            limits:   { memory: '512Mi', cpu: '500m' }
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 30
          readinessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 5
```

### 14.5. Probes — Tại Sao Quan Trọng?

```
livenessProbe:   "Container còn sống không?"
  → Fail → K8s restart container
  → Dùng cho: deadlock detection, memory leak

readinessProbe:  "Container sẵn sàng nhận traffic không?"
  → Fail → K8s ngừng gửi traffic đến pod (nhưng không restart)
  → Dùng cho: DB connection chưa sẵn sàng, warming up cache

startupProbe:    "Container đã start xong chưa?"
  → Dùng cho: app cần thời gian khởi động lâu
  → Khi startup probe pass → liveness/readiness bắt đầu check
```

### 14.6. HPA — Auto Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nestjs-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nestjs-ecommerce-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Resource
      resource:
        name: memory
        target: { type: Utilization, averageUtilization: 80 }
```

### 14.7. Docker Compose vs Kubernetes

| Tiêu chí | Docker Compose | Kubernetes |
|----------|---------------|------------|
| Use case | Dev, small projects | Production, enterprise |
| Scaling | Manual (`replicas:`) | Auto (HPA) |
| Self-healing | Restart policy only | Full (reschedule, replace) |
| Rolling updates | Không | Native |
| Load balancing | Không built-in | Service + Ingress |
| Secret management | .env files | Encrypted Secrets |
| Multi-node | Không | Có |
| Learning curve | Thấp | Cao |

---

## 15. Infrastructure as Code & GitOps — Tóm Tắt

### 15.1. IaC — Quản Lý Infrastructure Bằng Code

```
ClickOps (truyền thống):
  Login AWS Console → Click tạo EC2 → Click tạo RDS → Click tạo S3
  ❌ Không reproducible, không version control, không review

IaC:
  Viết Terraform code → Git commit → PR review → Apply tự động
  ✅ Reproducible, version controlled, peer reviewed
```

**Tại sao enterprise BẮT BUỘC dùng IaC?**
1. **Reproducibility**: Tạo lại toàn bộ infra từ code trong vài phút
2. **Audit trail**: Mọi thay đổi đều có Git history
3. **Disaster recovery**: Infra bị xóa? `terraform apply` lại
4. **Consistency**: Dev/staging/production dùng cùng code (khác variables)

### 15.2. Terraform — Ví Dụ Cho Dự Án

```hcl
# infrastructure/main.tf

# PostgreSQL Database
resource "aws_db_instance" "postgres" {
  engine               = "postgres"
  engine_version       = "17"
  instance_class       = "db.t3.medium"
  allocated_storage    = 50
  db_name              = "ecommerce"
  storage_encrypted    = true
  deletion_protection  = true
  backup_retention_period = 7
}

# Redis Cache
resource "aws_elasticache_cluster" "redis" {
  cluster_id      = "ecommerce-redis"
  engine          = "redis"
  engine_version  = "7.0"
  node_type       = "cache.t3.medium"
  num_cache_nodes = 1
}

# S3 Bucket (đã dùng trong dự án)
resource "aws_s3_bucket" "media" {
  bucket = "ecommerce-media-${var.environment}"
}
```

**Terraform PR Automation (Atlantis):**
```
Developer tạo PR thay đổi infra
  → Atlantis bot chạy `terraform plan`
  → Comment kết quả lên PR: "Plan: 2 to add, 1 to change"
  → Reviewer approve → `atlantis apply`
  → Infrastructure updated, PR merged
```

### 15.3. GitOps — Git Là Single Source of Truth

```
GitOps Flow:
  Developer push code
    → CI build Docker image
    → Push image tag to Git (k8s manifests repo)
    → ArgoCD detect Git change
    → Auto-sync K8s cluster to match Git state
    → Cluster state = Git state (always)
```

**Nguyên tắc GitOps:**
- **Declarative**: Mô tả desired state, không phải steps
- **Versioned**: Mọi thay đổi qua Git (PR, review, history)
- **Automated**: Agent tự động sync cluster với Git
- **Self-healing**: Ai đó `kubectl edit` trực tiếp → agent revert về Git state

### 15.4. ArgoCD vs Flux

| Tiêu chí | ArgoCD | Flux |
|----------|--------|------|
| UI | Web UI đẹp, trực quan | CLI only |
| Learning curve | Dễ hơn (có UI) | Khó hơn |
| Multi-cluster | Tốt | Rất tốt |
| Best for | Teams cần visibility | Teams muốn pure GitOps |

**Recommendation**: ArgoCD cho hầu hết teams (UI giúp debug và onboard nhanh).

### 15.5. Drift Detection

```
Drift = Trạng thái thực tế ≠ Trạng thái trong code

Ví dụ:
  Terraform code: instance_type = "t3.medium"
  AWS thực tế:    instance_type = "t3.large"   ← Ai đó đã sửa trên console!

Phát hiện:
  - Terraform: `terraform plan` chạy scheduled (mỗi giờ) → alert nếu drift
  - ArgoCD: Tự động detect → hiển thị "OutOfSync"
  - Crossplane: Continuous reconciliation (tự fix drift)
```

### 15.6. IaC Tools So Sánh

| Tool | Ngôn ngữ | Provider | Best for |
|------|---------|----------|----------|
| **Terraform** | HCL | Multi-cloud | Phổ biến nhất, multi-cloud |
| **Pulumi** | TypeScript/Python/Go | Multi-cloud | Dev-friendly (dùng ngôn ngữ quen) |
| **CloudFormation** | YAML/JSON | AWS only | AWS-native, deep integration |
| **CDK** | TypeScript/Python | AWS (chuyển sang CF) | AWS + type-safe |
| **Crossplane** | YAML (K8s CRDs) | Multi-cloud | K8s-native IaC |