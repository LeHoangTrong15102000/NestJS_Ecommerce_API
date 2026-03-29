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
  async register(dto: RegisterDto) {
    /* ... */
  }
  async login(dto: LoginDto) {
    /* ... */
  }
  async sendOtpEmail(email: string) {
    /* ... */
  } // ← Email concern
  async hashPassword(password: string) {
    /* ... */
  } // ← Hashing concern
  async generateToken(user: User) {
    /* ... */
  } // ← Token concern
  async uploadAvatar(file: File) {
    /* ... */
  } // ← File concern
}

// ✅ TUÂN THỦ SRP — Tách thành các service riêng
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService, // Hashing concern
    private readonly tokenService: TokenService, // Token concern
    private readonly emailService: EmailService, // Email concern
    private readonly authRepo: AuthRepository, // Data access concern
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
    } else if (method === 'momo') {
      // ← Phải sửa class này mỗi khi thêm method
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
  async processPayment(amount: number) {
    /* Stripe logic */
  }
}

@Injectable()
export class VNPayPaymentStrategy implements PaymentStrategy {
  async processPayment(amount: number) {
    /* VNPay logic */
  }
}

// Thêm MoMo? Chỉ cần tạo class mới, KHÔNG sửa code cũ
@Injectable()
export class MoMoPaymentStrategy implements PaymentStrategy {
  async processPayment(amount: number) {
    /* MoMo logic */
  }
}
```

**Trong dự án:** NestJS Guards sử dụng OCP — `AuthenticationGuard` delegate cho các strategy (Bearer, API Key, None) mà không cần sửa guard chính.

### 1.3. L — Liskov Substitution Principle (LSP)

**Định nghĩa**: Subclass phải có thể thay thế parent class mà không làm hỏng chương trình.

```typescript
// ❌ VI PHẠM LSP
class Bird {
  fly(): void {
    console.log('Flying')
  }
}
class Penguin extends Bird {
  fly(): void {
    throw new Error('Penguins cannot fly!')
  } // ← Phá vỡ contract
}

// ✅ TUÂN THỦ LSP — Tách interface
interface Flyable {
  fly(): void
}
interface Swimmable {
  swim(): void
}

class Eagle implements Flyable {
  fly(): void {
    console.log('Flying')
  }
}
class Penguin implements Swimmable {
  swim(): void {
    console.log('Swimming')
  }
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
  export(): Promise<Buffer> // ← Không phải module nào cũng cần
  generateReport(): Promise<Report> // ← Không phải module nào cũng cần
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
  private prisma = new PrismaClient() // ← Phụ thuộc trực tiếp
}

// ✅ TUÂN THỦ DIP — Injection
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository, // ← Abstraction
  ) {}
}
```

**Trong dự án:** NestJS DI Container tự động handle DIP — tất cả services nhận dependencies qua constructor injection.

### 1.6. SOLID Cheat Sheet

| Principle | Tóm tắt                                 | Keyword                      |
| --------- | --------------------------------------- | ---------------------------- |
| **S**RP   | Mỗi class chỉ có 1 lý do thay đổi       | "One reason to change"       |
| **O**CP   | Mở cho extension, đóng cho modification | "Extend, don't modify"       |
| **L**SP   | Subclass thay thế parent không hỏng     | "Substitutable"              |
| **I**SP   | Interface nhỏ, chuyên biệt              | "Don't force unused methods" |
| **D**IP   | Phụ thuộc vào abstraction               | "Depend on abstractions"     |

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
  withStrategy(name, strategy) {
    this.strategies.set(name, strategy)
    return this
  }
  build() {
    return new PaymentProcessorFactory(this.strategies)
  }
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
const city = order.getShippingCity() // Order tự biết cách lấy city
```

### 2.5. Composition over Inheritance

Ưu tiên composition (has-a) hơn inheritance (is-a).

```typescript
// ❌ Deep inheritance chain
class Animal {}
class Mammal extends Animal {}
class Dog extends Mammal {}
class GuideDog extends Dog {} // 4 levels deep!

// ✅ Composition — NestJS Mixins pattern
const TimeStampMixin = <T extends Constructor>(Base: T) =>
  class extends Base {
    createdAt = new Date()
    updatedAt = new Date()
  }

const SoftDeleteMixin = <T extends Constructor>(Base: T) =>
  class extends Base {
    deletedAt: Date | null = null
    softDelete() {
      this.deletedAt = new Date()
    }
  }
```

### 2.6. Clean Code Cheat Sheet

| Principle                     | Khi nào áp dụng      | Anti-pattern          |
| ----------------------------- | -------------------- | --------------------- |
| **DRY**                       | Thấy copy-paste code | Shotgun surgery       |
| **KISS**                      | Thiết kế solution    | Over-engineering      |
| **YAGNI**                     | Planning features    | Gold plating          |
| **LoD**                       | Object communication | Train wreck (a.b.c.d) |
| **Composition > Inheritance** | Code reuse           | Deep inheritance      |

---

## 3. 12-Factor App Methodology

> 12-Factor App là methodology cho building SaaS apps, đặc biệt quan trọng cho cloud-native và containerized applications.

| #   | Factor                  | Mô tả                                 | Áp dụng trong dự án                                  |
| --- | ----------------------- | ------------------------------------- | ---------------------------------------------------- |
| 1   | **Codebase**            | Một codebase trong VCS, nhiều deploys | ✅ Git repo, deploy dev/staging/prod                 |
| 2   | **Dependencies**        | Khai báo explicit, isolate            | ✅ `pnpm-lock.yaml`, `--frozen-lockfile`             |
| 3   | **Config**              | Lưu config trong environment          | ✅ `.env`, `docker-compose.yml` env vars             |
| 4   | **Backing Services**    | Treat as attached resources           | ✅ PostgreSQL, Redis qua `DATABASE_URL`, `REDIS_URL` |
| 5   | **Build, Release, Run** | Tách biệt 3 stages                    | ⚠️ Cần CI/CD pipeline (ZZ_80)                        |
| 6   | **Processes**           | Stateless processes                   | ✅ NestJS API stateless, session trong Redis         |
| 7   | **Port Binding**        | Export services via port              | ✅ `EXPOSE 3000` trong Dockerfile                    |
| 8   | **Concurrency**         | Scale out via process model           | ⚠️ Cần Kubernetes/ECS horizontal scaling             |
| 9   | **Disposability**       | Fast startup, graceful shutdown       | ⚠️ Cần `dumb-init` + graceful shutdown               |
| 10  | **Dev/Prod Parity**     | Keep environments similar             | ✅ Docker đảm bảo consistency                        |
| 11  | **Logs**                | Treat logs as event streams           | ✅ NestJS Logger → stdout → Docker captures          |
| 12  | **Admin Processes**     | Run admin tasks as one-off            | ✅ `initialScript/` cho seeding, `prisma migrate`    |

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

| Pattern                     | Sử dụng trong dự án    | Ví dụ                                                      |
| --------------------------- | ---------------------- | ---------------------------------------------------------- |
| **Dependency Injection**    | Toàn bộ project        | Constructor injection qua NestJS IoC                       |
| **Repository**              | Data access layer      | `AuthRepository`, `UserRepository`, `ProductRepository`    |
| **Strategy**                | Authentication         | `BearerStrategy`, `ApiKeyStrategy`, `NoneStrategy`         |
| **Decorator**               | Cross-cutting concerns | `@Auth()`, `@ActiveUser()`, `@IsPublic()`                  |
| **Observer**                | Events & WebSocket     | Socket.IO events, BullMQ job events                        |
| **Factory**                 | Dynamic providers      | `useFactory` trong module configs                          |
| **Singleton**               | Service instances      | NestJS default scope = singleton                           |
| **Chain of Responsibility** | Request pipeline       | Middleware → Guard → Interceptor → Pipe → Handler → Filter |
| **CQRS**                    | Payment module         | Commands (write) vs Queries (read) tách biệt               |
| **Module**                  | Code organization      | Mỗi domain = 1 NestJS module                               |

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

| Thành phần     | Vai trò                      | Tương tự        |
| -------------- | ---------------------------- | --------------- |
| **Dockerfile** | Recipe để build image        | Source code     |
| **Image**      | Snapshot read-only của app   | Compiled binary |
| **Container**  | Instance đang chạy của image | Running process |
| **Registry**   | Lưu trữ & phân phối images   | npm registry    |
| **Volume**     | Persistent storage           | Mounted disk    |
| **Network**    | Kết nối giữa containers      | Virtual LAN     |

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

| Metric         | Single-Stage         | Multi-Stage           |
| -------------- | -------------------- | --------------------- |
| Image size     | ~800MB               | ~200MB                |
| Attack surface | Lớn (có build tools) | Nhỏ (chỉ runtime)     |
| Build cache    | Kém                  | Tốt (tách deps/build) |
| Security       | devDeps trong image  | Chỉ prod deps         |

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

| Driver      | Mô tả                       | Use case                                  |
| ----------- | --------------------------- | ----------------------------------------- |
| **bridge**  | Default, tạo virtual bridge | Container cùng host giao tiếp             |
| **host**    | Dùng network stack của host | Performance-critical (không port mapping) |
| **overlay** | Multi-host networking       | Docker Swarm / multi-node                 |
| **macvlan** | Gán MAC address riêng       | Container cần IP trên physical network    |
| **none**    | Không có network            | Isolated containers                       |

### 9.2. Bridge Network — Dự Án Đang Dùng

```yaml
# docker-compose.yml
networks:
  ecom-network:
    driver: bridge # ← Dự án dùng bridge network
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
  - '3000:3000' # host_port:container_port
  - '5432:5432' # Expose PostgreSQL ra host (dev only!)
  - '6379:6379' # Expose Redis ra host (dev only!)
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
    internal: true # ← Không có internet access

services:
  api:
    networks: [frontend, backend] # Cầu nối 2 networks
  postgres:
    networks: [backend] # Chỉ backend, không expose ra ngoài
  redis:
    networks: [backend]
  nginx:
    networks: [frontend] # Chỉ frontend
```

---

## 10. Docker Compose Nâng Cao (MỚI)

### 10.1. Docker Compose Hiện Tại Của Dự Án

```yaml
services:
  postgres: # Database
    image: postgres:17-alpine
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ecom_user -d ecom_db']
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis: # Cache & BullMQ
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory-policy noeviction
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']

  api: # NestJS Application
    build: .
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://ecom_user:ecom_password@postgres:5432/ecom_db
      REDIS_HOST: redis
    volumes:
      - ./uploads:/app/uploads # Persist uploaded files
      - ./prisma:/app/prisma # Sync Prisma schema

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
    condition: service_healthy # Chờ DB healthy rồi mới start API
  redis:
    condition: service_healthy # Chờ Redis healthy
```

→ Đảm bảo API không start khi DB/Redis chưa sẵn sàng, tránh connection errors.

### 10.3. Volumes — Persistent Data

```yaml
volumes:
  # Named volumes — Docker quản lý, persist qua restart
  postgres_data: # DB data sống sót khi container bị xóa
  redis_data: # Redis AOF data
    # Bind mounts — Map thư mục host ↔ container
    - ./uploads:/app/uploads # Upload files persist trên host
    - ./prisma:/app/prisma # Sync schema giữa host và container
```

| Loại             | Syntax           | Quản lý bởi     | Use case                     |
| ---------------- | ---------------- | --------------- | ---------------------------- |
| **Named volume** | `postgres_data:` | Docker          | Database, persistent data    |
| **Bind mount**   | `./src:/app/src` | Host filesystem | Dev hot-reload, config files |
| **tmpfs**        | `tmpfs: /tmp`    | Memory          | Temp data, test DB (fast)    |

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
      - .env.production # Secrets trong file riêng, KHÔNG commit vào git
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
    ports: [] # Xóa port mapping, không expose DB ra ngoài
  redis:
    ports: [] # Xóa port mapping
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

- ✅ Có: `.github/workflows/ci.yml` (6 stages), Dockerfile, docker-compose.prod.yml, test scripts, ESLint config
- ✅ Đã implement: Lint, Test, Build, Security Scan, Deploy staging/production
- 📋 TODO: Pre-commit hooks, advanced security scanning (Semgrep), coverage enforcement

### 11.3. GitHub Actions Pipeline Thực Tế (Đã Implement)

**File:** `.github/workflows/ci.yml`

**6 Stages Pipeline:**

```yaml
# Stage 1: Lint (parallel, ~1 phút)
lint:
  runs-on: ubuntu-latest
  steps:
    - Setup pnpm + Node.js 20
    - Install dependencies (with cache)
    - Run ESLint: pnpm run lint
    - Check Prettier: prettier --check "src/**/*.ts"

# Stage 2: Test (parallel với lint, ~3 phút)
test:
  runs-on: ubuntu-latest
  services:
    postgres: postgres:17-alpine (health checks)
    redis: redis:7-alpine (health checks)
  steps:
    - Setup pnpm + Node.js 20
    - Install dependencies
    - Generate Prisma client
    - Run migrations: prisma migrate deploy
    - Run tests with coverage: pnpm run test:cov
    - Upload coverage to Codecov

# Stage 3: Build Docker Image (depends on lint + test, ~4 phút)
build:
  runs-on: ubuntu-latest
  needs: [lint, test]
  if: github.ref == 'refs/heads/master'
  steps:
    - Setup Docker Buildx
    - Login to ghcr.io
    - Extract metadata (tags: SHA, version, latest)
    - Build and push image:
        target: production
        cache: GitHub Actions cache
        tags: ghcr.io/yourorg/nestjs-ecommerce:latest

# Stage 4: Security Scan (depends on build, ~2 phút)
security-scan:
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - Run Trivy vulnerability scanner
    - Scan for CRITICAL and HIGH vulnerabilities
    - Upload results to GitHub Security (SARIF)
    - Display table output

# Stage 5: Deploy to Staging (depends on security-scan)
deploy-staging:
  runs-on: ubuntu-latest
  needs: [security-scan]
  environment: staging
  steps:
    - Setup SSH key
    - SSH to staging server
    - Pull latest image from ghcr.io
    - Run database migrations
    - Rolling update: docker-compose up -d --no-deps api
    - Health check verification
    - Cleanup old images

# Stage 6: Deploy to Production (depends on staging, manual approval)
deploy-production:
  runs-on: ubuntu-latest
  needs: [deploy-staging]
  environment: production # Requires manual approval
  steps:
    - Setup SSH key
    - SSH to production server
    - Pull latest image
    - Run migrations
    - Rolling update with zero-downtime
    - Health check verification
    - Create deployment tag
```

**Key Features:**

- ✅ **Parallel execution**: Lint và Test chạy song song
- ✅ **Dependency caching**: pnpm cache, Docker layer cache
- ✅ **Service containers**: PostgreSQL + Redis cho integration tests
- ✅ **Security scanning**: Trivy scan Docker images
- ✅ **Environment protection**: Production requires manual approval
- ✅ **Zero-downtime deployment**: Rolling update với health checks
- ✅ **Traceability**: Image tags với git SHA + version

**Pipeline Duration:**

- Feature branch (lint + test): ~4 phút
- Master branch (full pipeline): ~15 phút
- Production deployment (with approval): ~20 phút total

### 11.4. DevSecOps — Security Trong Pipeline

**Shift-Left Security:** Phát hiện lỗ hổng sớm = fix rẻ hơn 100x

```
Cost of fixing security issues:
  Development:  $100
  Testing:      $1,000
  Production:   $10,000
  After breach: $1,000,000+
```

**5 Lớp Bảo Mật Trong Pipeline:**

```
┌─────────────────────────────────────────────────────────────┐
│ Lớp 1: Pre-Commit (Local)                                   │
│   → gitleaks: Scan secrets trước khi commit                 │
│   → husky + lint-staged: Auto-format và lint                │
│   Status: 📋 TODO                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Lớp 2: CI - SAST (Static Application Security Testing)      │
│   → Semgrep: Scan source code cho security patterns         │
│   → ESLint security plugins: Detect unsafe patterns         │
│   Status: 📋 TODO (Semgrep), ✅ Done (ESLint)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Lớp 3: CI - SCA (Software Composition Analysis)             │
│   → pnpm audit: Scan npm dependencies                       │
│   → Snyk: Advanced dependency scanning                      │
│   Status: 📋 TODO                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Lớp 4: CI - Container Scanning                              │
│   → Trivy: Scan Docker image cho CVEs                       │
│   → Severity: CRITICAL, HIGH                                │
│   Status: ✅ Done (.github/workflows/ci.yml:178-219)       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Lớp 5: Staging - DAST (Dynamic Application Security Testing)│
│   → OWASP ZAP: Test running application                     │
│   → Penetration testing                                     │
│   Status: 📋 TODO                                           │
└─────────────────────────────────────────────────────────────┘
```

**Trivy Scanning (Đã Implement):**

```yaml
# .github/workflows/ci.yml:199-219
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/yourorg/nestjs-ecommerce:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

**Security Best Practices Đã Áp Dụng:**

- ✅ Non-root user trong container (USER node)
- ✅ Multi-stage build (loại bỏ dev dependencies)
- ✅ Secrets externalized (không hardcode trong code)
- ✅ Resource limits (prevent DoS)
- ✅ Health checks (detect unhealthy containers)
- ✅ Redis authentication (requirepass)
- ✅ PostgreSQL password authentication
- ✅ CORS configuration từ environment

### 11.5. DORA Metrics — Đo Hiệu Quả DevOps

**4 Key Metrics:**

| Metric                    | Định nghĩa             | Elite          | High       | Medium      | Low           | Dự án hiện tại                         |
| ------------------------- | ---------------------- | -------------- | ---------- | ----------- | ------------- | -------------------------------------- |
| **Deployment Frequency**  | Bao lâu deploy 1 lần?  | Nhiều lần/ngày | 1 lần/tuần | 1 lần/tháng | 1 lần/6 tháng | 🎯 **1 lần/tuần** (master merge)       |
| **Lead Time for Changes** | Commit → production?   | < 1 giờ        | < 1 ngày   | < 1 tuần    | > 1 tháng     | 🎯 **~20 phút** (CI + manual approval) |
| **Change Failure Rate**   | % deploy gây incident? | 0-15%          | 16-30%     | 31-45%      | > 45%         | 🎯 **TBD** (cần tracking)              |
| **Mean Time to Recovery** | Thời gian recover?     | < 1 giờ        | < 1 ngày   | < 1 tuần    | > 1 tuần      | 🎯 **~5 phút** (rollback Docker image) |

**Cách Đo Metrics Cho Dự Án:**

```bash
# 1. Deployment Frequency
gh api repos/:owner/:repo/deployments --jq 'length'

# 2. Lead Time for Changes
# Thời gian từ commit đến production
# = CI pipeline time + manual approval time + deployment time
# = 15 phút (CI) + 5 phút (approval) + 2 phút (deploy) = ~22 phút

# 3. Change Failure Rate
# Số deployments gây incident / Tổng số deployments
# Cần implement: incident tracking

# 4. Mean Time to Recovery (MTTR)
# Thời gian từ phát hiện incident đến recover
# Rollback: docker-compose down + pull previous image + up = ~5 phút
```

**Improvement Roadmap:**

```
Current State (Medium):
  - Deployment Frequency: 1 lần/tuần
  - Lead Time: ~20 phút
  - MTTR: ~5 phút (rollback)

Target (High):
  - Deployment Frequency: Nhiều lần/ngày
  - Lead Time: < 10 phút (remove manual approval cho non-critical)
  - Change Failure Rate: < 15% (implement monitoring + alerts)
  - MTTR: < 5 phút (automated rollback)

Actions:
  1. Implement automated rollback based on health checks
  2. Add monitoring + alerting (Prometheus + Grafana)
  3. Implement feature flags (deploy ≠ release)
  4. Add canary deployment cho critical changes
```

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

| Tiêu chí       | Blue-Green     | Canary       | Rolling       |
| -------------- | -------------- | ------------ | ------------- |
| Downtime       | Zero           | Zero         | Near-zero     |
| Rollback speed | Instant (giây) | Nhanh (phút) | Chậm (phút)   |
| Extra infra    | 2x             | +5-10%       | Không         |
| Blast radius   | 0% hoặc 100%   | 1-5% ban đầu | Tăng dần      |
| Complexity     | Trung bình     | Cao          | Thấp          |
| Best for       | Critical apps  | High-traffic | Standard apps |

### 12.2. Recommendation Cho Dự Án

**Hiện tại (Phase 1 - VPS):**

```
Rolling Deployment với Docker Compose:
  docker-compose up -d --no-deps api

Cách hoạt động:
  1. Pull image mới
  2. Stop container cũ
  3. Start container mới
  4. Health check pass → Done
  5. Downtime: ~5-10 giây (acceptable cho startup)
```

**Phase 2 (AWS ECS - 1K-10K users):**

```
Blue-Green Deployment:
  - ECS Service với 2 target groups (Blue + Green)
  - ALB switch traffic từ Blue → Green
  - Rollback = switch ngược lại (instant)
  - Zero downtime
```

**Phase 3 (AWS EKS - 10K+ users):**

```
Canary Deployment với Flagger:
  - Deploy v2 với 5% traffic
  - Monitor metrics (error rate, latency)
  - Tự động tăng: 5% → 25% → 50% → 100%
  - Metrics xấu → auto rollback
```

### 12.3. Feature Flags — Deploy ≠ Release

**Concept:** Tách deployment (đưa code lên prod) khỏi release (bật feature cho users)

```typescript
// Ví dụ: Rollout payment gateway mới
import { FeatureFlagService } from '@/shared/services/feature-flag.service'

@Injectable()
export class PaymentService {
  constructor(private readonly featureFlags: FeatureFlagService) {}

  async processPayment(order: Order) {
    // Check feature flag
    const useNewGateway = await this.featureFlags.isEnabled('new-payment-gateway', {
      userId: order.userId,
      percentage: 10, // Chỉ 10% users
      attributes: {
        country: order.shippingAddress.country,
        orderValue: order.totalAmount,
      },
    })

    if (useNewGateway) {
      // New implementation (deployed nhưng chỉ 10% users dùng)
      return this.processWithNewGateway(order)
    }

    // Legacy implementation (90% users vẫn dùng)
    return this.processWithLegacyGateway(order)
  }
}

// Rollback = tắt flag (milliseconds), không cần redeploy
// featureFlags.disable('new-payment-gateway')
```

**Benefits:**

- ✅ Deploy code mới mà không ảnh hưởng users
- ✅ Rollback instant (tắt flag, không cần redeploy)
- ✅ A/B testing (compare metrics giữa 2 implementations)
- ✅ Gradual rollout (10% → 50% → 100%)
- ✅ Kill switch (tắt feature nếu có bug)

**Implementation Options:**

- **Simple**: Environment variable + config service
- **Advanced**: LaunchDarkly, Unleash, Flagsmith
- **DIY**: Redis-based feature flags

**Progressive Delivery (Ring-based):**

```
Ring 0: Internal team (50 users)        → 1-2 ngày
  - Developers, QA team
  - Phát hiện bugs rõ ràng

Ring 1: Early adopters (5,000 users)    → 3-5 ngày
  - Beta users, power users
  - Feedback về UX, performance

Ring 2: 10% production (100,000 users)  → 5-7 ngày
  - Random sampling
  - Monitor metrics: error rate, latency, conversion

Ring 3: 50% production                  → 7 ngày
  - Majority rollout
  - Final validation

Ring 4: Full rollout 100%
  - Complete deployment
  - Monitor for 24-48h

Metrics xấu ở bất kỳ ring nào → STOP + ROLLBACK
```

**Example: Rollout New Checkout Flow**

```typescript
// Week 1: Ring 0 (Internal)
featureFlags.enable('new-checkout', { percentage: 0, userIds: ['dev-team'] });

// Week 2: Ring 1 (Early adopters)
featureFlags.enable('new-checkout', { percentage: 5 });

// Week 3: Ring 2 (10%)
featureFlags.enable('new-checkout', { percentage: 10 });
// Monitor: conversion rate, error rate, page load time

// Week 4: Ring 3 (50%)
if (metrics.conversionRate > baseline && metrics.errorRate < 1%) {
  featureFlags.enable('new-checkout', { percentage: 50 });
}

// Week 5: Ring 4 (100%)
if (metrics.conversionRate > baseline) {
  featureFlags.enable('new-checkout', { percentage: 100 });
  // Remove old code sau 2 tuần
}
```

### 12.4. Deployment Checklist Cho Dự Án

**Pre-Deployment:**

- [ ] All tests pass (unit + integration)
- [ ] Code review approved
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

**Deployment:**

- [ ] Run database migrations
- [ ] Deploy new version
- [ ] Health check pass
- [ ] Smoke tests pass
- [ ] Monitor logs for errors

**Post-Deployment:**

- [ ] Verify key features working
- [ ] Check error rate (< 1%)
- [ ] Check response time (< 200ms p95)
- [ ] Monitor for 30 minutes
- [ ] Update deployment log

**Rollback Triggers:**

- ❌ Health check fails
- ❌ Error rate > 5%
- ❌ Response time > 500ms p95
- ❌ Critical feature broken
- ❌ Database connection issues

---

# PHẦN E — CLOUD & INFRASTRUCTURE

> Bổ sung mới: Cloud Services tổng quan, Kubernetes chuyên sâu, Infrastructure as Code & GitOps.

---

## 13. Cloud Services Tổng Quan

### 13.1. Cloud Services Dự Án Đang Dùng

| Service        | Provider                                    | Mục đích trong dự án                             |
| -------------- | ------------------------------------------- | ------------------------------------------------ |
| **S3**         | AWS                                         | Upload/storage hình ảnh sản phẩm, presigned URLs |
| **PostgreSQL** | Local/Docker (có thể migrate → RDS)         | Database chính                                   |
| **Redis**      | Local/Docker (có thể migrate → ElastiCache) | Caching, BullMQ job queue                        |
| **Resend**     | Resend.com                                  | Gửi email OTP                                    |
| **Mux**        | Mux.com                                     | Video streaming/processing                       |
| **Anthropic**  | Anthropic API                               | AI Assistant                                     |

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

| Service               | AWS             | GCP               | Azure                   |
| --------------------- | --------------- | ----------------- | ----------------------- |
| Compute (Container)   | ECS / EKS       | Cloud Run / GKE   | ACI / AKS               |
| Database (PostgreSQL) | RDS             | Cloud SQL         | Azure DB for PostgreSQL |
| Cache (Redis)         | ElastiCache     | Memorystore       | Azure Cache for Redis   |
| Object Storage        | S3              | Cloud Storage     | Blob Storage            |
| Container Registry    | ECR             | Artifact Registry | ACR                     |
| Secret Management     | Secrets Manager | Secret Manager    | Key Vault               |
| Monitoring            | CloudWatch      | Cloud Monitoring  | Azure Monitor           |
| CI/CD                 | CodePipeline    | Cloud Build       | Azure DevOps            |

### 13.4. Managed vs Self-Hosted — Khi Nào Dùng Gì?

| Tiêu chí    | Managed (RDS, ElastiCache) | Self-Hosted (Docker)        |
| ----------- | -------------------------- | --------------------------- |
| Setup       | Vài click/Terraform        | Tự cài, tự config           |
| Maintenance | Provider lo                | Tự lo patches, upgrades     |
| Backup      | Tự động                    | Tự setup                    |
| HA/Failover | Built-in                   | Tự config replication       |
| Cost        | Cao hơn                    | Thấp hơn (nhưng tốn effort) |
| Best for    | Production                 | Development, small projects |

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

| Object         | Mục đích                               | Ví dụ trong dự án                                 |
| -------------- | -------------------------------------- | ------------------------------------------------- |
| **Pod**        | Đơn vị nhỏ nhất, chứa 1+ containers    | 1 pod = 1 NestJS API instance                     |
| **Deployment** | Quản lý replicas, rolling updates      | 3 replicas API                                    |
| **Service**    | Expose pods ra network, load balancing | ClusterIP cho internal, LoadBalancer cho external |
| **ConfigMap**  | Config không nhạy cảm                  | APP_NAME, NODE_ENV, CORS origins                  |
| **Secret**     | Config nhạy cảm (encrypted)            | DATABASE_URL, JWT secrets, S3 keys                |
| **Ingress**    | HTTP routing, SSL termination          | api.example.com → API Service                     |
| **HPA**        | Horizontal Pod Autoscaler              | Scale 3→10 pods khi CPU > 70%                     |
| **PVC**        | Persistent Volume Claim                | Upload storage                                    |

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
      maxSurge: 1 # Thêm tối đa 1 pod mới
      maxUnavailable: 0 # Không pod nào down
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
            limits: { memory: '512Mi', cpu: '500m' }
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

| Tiêu chí          | Docker Compose       | Kubernetes                 |
| ----------------- | -------------------- | -------------------------- |
| Use case          | Dev, small projects  | Production, enterprise     |
| Scaling           | Manual (`replicas:`) | Auto (HPA)                 |
| Self-healing      | Restart policy only  | Full (reschedule, replace) |
| Rolling updates   | Không                | Native                     |
| Load balancing    | Không built-in       | Service + Ingress          |
| Secret management | .env files           | Encrypted Secrets          |
| Multi-node        | Không                | Có                         |
| Learning curve    | Thấp                 | Cao                        |

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

| Tiêu chí       | ArgoCD                | Flux                   |
| -------------- | --------------------- | ---------------------- |
| UI             | Web UI đẹp, trực quan | CLI only               |
| Learning curve | Dễ hơn (có UI)        | Khó hơn                |
| Multi-cluster  | Tốt                   | Rất tốt                |
| Best for       | Teams cần visibility  | Teams muốn pure GitOps |

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

| Tool               | Ngôn ngữ             | Provider             | Best for                          |
| ------------------ | -------------------- | -------------------- | --------------------------------- |
| **Terraform**      | HCL                  | Multi-cloud          | Phổ biến nhất, multi-cloud        |
| **Pulumi**         | TypeScript/Python/Go | Multi-cloud          | Dev-friendly (dùng ngôn ngữ quen) |
| **CloudFormation** | YAML/JSON            | AWS only             | AWS-native, deep integration      |
| **CDK**            | TypeScript/Python    | AWS (chuyển sang CF) | AWS + type-safe                   |
| **Crossplane**     | YAML (K8s CRDs)      | Multi-cloud          | K8s-native IaC                    |

---

# PHẦN F — ÁP DỤNG CHO DỰ ÁN

> Tổng hợp cụ thể cách áp dụng tất cả các khái niệm trên vào NestJS Ecommerce API.

---

## 16. Tổng Hợp Áp Dụng Cho NestJS Ecommerce API

### 16.1. Kiến Trúc Hiện Tại

**Tech Stack:**

```
Backend:       NestJS (Node.js 20) + TypeScript
Database:      PostgreSQL 17 (Prisma ORM)
Cache/Queue:   Redis 7 (BullMQ)
Storage:       AWS S3 (presigned URLs)
Email:         Resend API
Video:         Mux API
AI:            Anthropic Claude API
```

**Deployment Stack:**

```
Containerization:  Docker (multi-stage Dockerfile)
Orchestration:     Docker Compose (dev + production)
CI/CD:             GitHub Actions (6-stage pipeline)
Registry:          GitHub Container Registry (ghcr.io)
Monitoring:        Health endpoint (/health)
```

### 16.2. Roadmap Theo Quy Mô

#### Giai Đoạn 1: Startup (0-1,000 users) — HIỆN TẠI ✅

**Infrastructure:**

```
VPS/Cloud VM (2 vCPU, 4GB RAM)
  ├── Docker Compose
  │   ├── NestJS API (1 container)
  │   ├── PostgreSQL (1 container)
  │   └── Redis (1 container)
  └── Nginx reverse proxy
```

**Deployment:**

- SSH-based deployment với GitHub Actions
- Rolling update thủ công (zero-downtime)
- Database migrations trước khi deploy
- Health check sau mỗi deployment

**Cost:** ~$20-50/tháng (VPS + S3 + Resend + Mux)

**Files đã implement:**

- ✅ `Dockerfile` — Multi-stage build (4 stages)
- ✅ `docker-compose.prod.yml` — Production config với secrets externalized
- ✅ `.github/workflows/ci.yml` — CI/CD pipeline 6 stages
- ✅ `src/routes/health/` — Health monitoring module
- ✅ `.env.example` — Environment variables template

---

#### Giai Đoạn 2: Growth (1,000-10,000 users) — 10x TRAFFIC

**Infrastructure:**

```
AWS ECS (Elastic Container Service)
  ├── Application Load Balancer
  ├── ECS Tasks (3-5 replicas, auto-scaling)
  ├── RDS PostgreSQL (Multi-AZ)
  ├── ElastiCache Redis (Cluster mode)
  ├── S3 (đã dùng)
  └── CloudWatch Logs + Metrics
```

**Changes needed:**

```diff
+ Migrate PostgreSQL → RDS (managed, auto-backup, Multi-AZ)
+ Migrate Redis → ElastiCache (managed, cluster mode)
+ Add Application Load Balancer (ALB)
+ Enable ECS auto-scaling (CPU > 70% → scale out)
+ Add CloudWatch alarms (error rate, latency)
+ Implement structured logging (JSON format)
+ Add Prometheus metrics endpoint
```

**Deployment:**

- Blue-Green deployment với ECS
- Database migrations qua ECS Task (init container pattern)
- Canary deployment cho critical features
- Automated rollback nếu health check fail

**Cost:** ~$200-500/tháng

**Files cần tạo:**

- `infrastructure/terraform/ecs.tf` — ECS cluster + task definitions
- `infrastructure/terraform/rds.tf` — RDS PostgreSQL
- `infrastructure/terraform/elasticache.tf` — Redis cluster
- `infrastructure/terraform/alb.tf` — Application Load Balancer
- `.github/workflows/deploy-ecs.yml` — ECS deployment workflow

---

#### Giai Đoạn 3: Scale (10,000-100,000 users) — 100x TRAFFIC

**Infrastructure:**

```
AWS EKS (Kubernetes)
  ├── Ingress Controller (NGINX/ALB)
  ├── API Pods (10-50 replicas, HPA)
  ├── RDS PostgreSQL (Read Replicas)
  ├── ElastiCache Redis (Cluster mode)
  ├── S3 + CloudFront CDN
  ├── Prometheus + Grafana
  └── ELK Stack (Elasticsearch, Logstash, Kibana)
```

**Changes needed:**

```diff
+ Migrate ECS → EKS (Kubernetes)
+ Add Horizontal Pod Autoscaler (HPA)
+ Add read replicas cho PostgreSQL
+ Implement CQRS (read/write separation)
+ Add CDN (CloudFront) cho static assets
+ Implement distributed tracing (Jaeger/Tempo)
+ Add service mesh (Istio) cho advanced routing
+ Implement feature flags (LaunchDarkly/Unleash)
```

**Deployment:**

- GitOps với ArgoCD
- Canary deployment với Flagger
- Progressive delivery (ring-based rollout)
- Automated rollback based on metrics

**Cost:** ~$1,000-3,000/tháng

**Files cần tạo:**

- `k8s/deployment.yaml` — Kubernetes deployment manifest
- `k8s/service.yaml` — Service + Ingress
- `k8s/hpa.yaml` — Horizontal Pod Autoscaler
- `k8s/configmap.yaml` — ConfigMap cho non-sensitive config
- `k8s/secret.yaml` — Sealed Secrets cho sensitive data
- `infrastructure/terraform/eks.tf` — EKS cluster
- `argocd/application.yaml` — ArgoCD application definition

---

### 16.3. Implementation Checklist

#### ✅ Đã Hoàn Thành (Phase 1-4)

- [x] Multi-stage Dockerfile (4 stages: base, dependencies, build, production)
- [x] Production Docker Compose với externalized secrets
- [x] Health monitoring endpoint (`/health`)
- [x] GitHub Actions CI/CD pipeline (6 stages)
- [x] Docker image push to ghcr.io
- [x] Resource limits cho containers
- [x] Redis authentication
- [x] Non-root user trong container
- [x] Health checks cho tất cả services
- [x] Structured logging với Pino
- [x] Environment variable validation

#### 🚧 Đang Triển Khai (Phase 5)

- [ ] Documentation completion (đang làm)
- [ ] Deployment guides
- [ ] Rollback procedures
- [ ] Monitoring dashboards

#### 📋 Backlog (Future Phases)

**Security:**

- [ ] Trivy vulnerability scanning trong CI
- [ ] Secrets scanning với gitleaks
- [ ] SAST với Semgrep
- [ ] Container security hardening (read-only filesystem, drop capabilities)

**Monitoring:**

- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboards
- [ ] CloudWatch alarms
- [ ] Error tracking với Sentry

**Performance:**

- [ ] Database query optimization
- [ ] Redis caching strategy
- [ ] CDN integration
- [ ] Image optimization

**Infrastructure:**

- [ ] Terraform IaC cho AWS resources
- [ ] Kubernetes manifests
- [ ] ArgoCD GitOps setup
- [ ] Multi-region deployment

---

### 16.4. File Structure Tổng Hợp

```
NestJS_Ecommerce_API/
├── .github/
│   └── workflows/
│       └── ci.yml                    # ✅ CI/CD pipeline (6 stages)
├── docs/
│   ├── ZZ_84_TONG_HOP_ARCHITECTURE_DOCKER_CLOUD_DEEP_DIVE.md  # ✅ Tài liệu này
│   ├── DEPLOYMENT.md                 # 📋 TODO: Deployment guide
│   ├── MIGRATIONS.md                 # 📋 TODO: Migration guide
│   └── ROLLBACK.md                   # 📋 TODO: Rollback procedures
├── infrastructure/                   # 📋 TODO: IaC
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── ecs.tf
│   │   ├── rds.tf
│   │   └── elasticache.tf
│   └── k8s/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── hpa.yaml
├── src/
│   ├── routes/
│   │   └── health/                   # ✅ Health monitoring
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       └── health.service.ts
│   └── shared/
│       ├── config/
│       │   └── env.validation.ts     # ✅ Env validation
│       └── logging/
│           └── pino.config.ts        # ✅ Structured logging
├── Dockerfile                        # ✅ Multi-stage production build
├── docker-compose.yml                # ✅ Development
├── docker-compose.prod.yml           # ✅ Production
├── .dockerignore                     # ✅ Exclude unnecessary files
├── .env.example                      # ✅ Environment template
└── package.json                      # ✅ Version for image tagging
```

---

### 16.5. Deployment Commands Tham Khảo

#### Development (Local)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run migrations
docker-compose exec api npx prisma migrate dev

# Stop all services
docker-compose down
```

#### Production (VPS)

```bash
# Pull latest image
docker pull ghcr.io/yourorg/nestjs-ecommerce:latest

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# Deploy with zero-downtime
docker-compose -f docker-compose.prod.yml up -d --no-deps api

# Check health
curl http://localhost:3000/health

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Rollback to previous version
docker-compose -f docker-compose.prod.yml down
docker pull ghcr.io/yourorg/nestjs-ecommerce:v1.2.3
docker-compose -f docker-compose.prod.yml up -d
```

#### CI/CD (GitHub Actions)

```bash
# Trigger manually
gh workflow run ci.yml

# View workflow status
gh run list

# View logs
gh run view <run-id> --log
```

---

### 16.6. Monitoring & Troubleshooting

#### Health Check

```bash
# Check overall health
curl http://localhost:3000/health | jq

# Expected response
{
  "status": "healthy",
  "timestamp": "2026-03-11T10:30:00.000Z",
  "services": {
    "database": { "status": "up", "responseTime": 15 },
    "redis": { "status": "up", "responseTime": 5 },
    "application": { "status": "up" }
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### Common Issues

**Issue 1: Database connection failed**

```bash
# Check PostgreSQL container
docker-compose ps postgres
docker-compose logs postgres

# Check DATABASE_URL
docker-compose exec api env | grep DATABASE_URL

# Test connection
docker-compose exec postgres psql -U ecom_user -d ecom_db -c "SELECT 1"
```

**Issue 2: Redis connection failed**

```bash
# Check Redis container
docker-compose ps redis
docker-compose logs redis

# Test connection (with auth)
docker-compose exec redis redis-cli -a <password> PING

# Check REDIS_URL
docker-compose exec api env | grep REDIS_URL
```

**Issue 3: Container won't start**

```bash
# Check logs
docker-compose logs api

# Check resource usage
docker stats

# Check disk space
df -h

# Rebuild image
docker-compose build --no-cache api
```

**Issue 4: CI/CD pipeline failed**

```bash
# View GitHub Actions logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id>

# Check secrets
gh secret list
```

---

### 16.7. Security Best Practices Đã Áp Dụng

#### Container Security

```dockerfile
# ✅ Non-root user
USER node

# ✅ Health check
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health

# ✅ Minimal base image
FROM node:20-alpine
```

#### Secrets Management

```yaml
# ✅ Externalized secrets
environment:
  DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
  REDIS_PASSWORD: ${REDIS_PASSWORD:?REDIS_PASSWORD is required}

# ✅ Redis authentication
command: redis-server --requirepass ${REDIS_PASSWORD}
```

#### Network Security

```yaml
# ✅ Internal network
networks:
  - ecom-network

# ✅ Only expose necessary ports
ports:
  - '3000:3000' # API only
```

#### Resource Limits

```yaml
# ✅ Prevent resource exhaustion
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

### 16.8. Performance Metrics

#### Current Performance (Phase 1)

| Metric                    | Target  | Actual | Status |
| ------------------------- | ------- | ------ | ------ |
| Docker image size         | < 500MB | ~350MB | ✅     |
| Container startup time    | < 30s   | ~15s   | ✅     |
| Health check response     | < 3s    | ~50ms  | ✅     |
| CI pipeline duration      | < 10min | ~8min  | ✅     |
| API response time (p95)   | < 200ms | ~120ms | ✅     |
| Database query time (p95) | < 100ms | ~60ms  | ✅     |

#### Scaling Targets (Phase 2)

| Metric               | Current | Target (10x) |
| -------------------- | ------- | ------------ |
| Concurrent users     | 100     | 1,000        |
| Requests/second      | 50      | 500          |
| Database connections | 10      | 100          |
| Redis memory         | 256MB   | 2GB          |
| API replicas         | 1       | 3-5          |

---

## 17. Tài Liệu Tham Khảo Chéo

### 17.1. Implementation Files

| Concept                      | Implementation            | File Path                             |
| ---------------------------- | ------------------------- | ------------------------------------- |
| **Multi-stage Docker build** | 4-stage Dockerfile        | `Dockerfile:1-69`                     |
| **Health monitoring**        | NestJS health module      | `src/routes/health/health.service.ts` |
| **CI/CD pipeline**           | GitHub Actions workflow   | `.github/workflows/ci.yml:1-348`      |
| **Production deployment**    | Docker Compose production | `docker-compose.prod.yml:1-213`       |
| **Environment config**       | Environment variables     | `.env.example`                        |
| **Database migrations**      | Prisma migrations         | `prisma/migrations/`                  |
| **Structured logging**       | Pino logger               | `src/main.ts` (Pino config)           |
| **Redis caching**            | BullMQ queues             | `src/shared/queues/`                  |
| **S3 storage**               | S3 service                | `src/shared/services/s3.service.ts`   |
| **Authentication**           | JWT strategy              | `src/shared/guards/jwt-auth.guard.ts` |

### 17.2. Architecture Documentation

| Topic                   | Document     | Section                         |
| ----------------------- | ------------ | ------------------------------- |
| **Clean Architecture**  | ZZ_11        | Layers, dependencies            |
| **Design Patterns**     | ZZ_11        | Factory, Strategy, Observer     |
| **CQRS & Events**       | ZZ_20, ZZ_25 | Command/Query separation        |
| **Docker fundamentals** | ZZ_16, ZZ_75 | Images, containers, volumes     |
| **Docker Compose**      | ZZ_76        | Services, networks, volumes     |
| **Docker networking**   | ZZ_77        | Bridge, host, overlay           |
| **CI/CD**               | ZZ_80        | Pipeline stages, best practices |
| **This document**       | ZZ_84        | Comprehensive overview          |

### 17.3. External Resources

**Docker:**

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Compose](https://docs.docker.com/compose/)

**Kubernetes:**

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [K8s Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Helm Charts](https://helm.sh/docs/)

**CI/CD:**

- [GitHub Actions](https://docs.github.com/en/actions)
- [GitOps with ArgoCD](https://argo-cd.readthedocs.io/)
- [Terraform](https://www.terraform.io/docs)

**NestJS:**

- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Health Checks](https://docs.nestjs.com/recipes/terminus)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)

**Cloud Providers:**

- [AWS ECS](https://docs.aws.amazon.com/ecs/)
- [AWS EKS](https://docs.aws.amazon.com/eks/)
- [AWS RDS](https://docs.aws.amazon.com/rds/)

---

### 17.4. Deployment Guides (TODO)

Các tài liệu sau cần được tạo:

1. **DEPLOYMENT.md** — Step-by-step deployment guide
   - VPS setup
   - Docker installation
   - Environment configuration
   - First deployment
   - Zero-downtime updates

2. **MIGRATIONS.md** — Database migration guide
   - Creating migrations
   - Running migrations in production
   - Rollback procedures
   - Migration best practices

3. **ROLLBACK.md** — Emergency rollback procedures
   - Identifying failed deployments
   - Rolling back Docker images
   - Rolling back database migrations
   - Post-rollback verification

4. **MONITORING.md** — Monitoring and alerting setup
   - Health check monitoring
   - Log aggregation
   - Metrics collection
   - Alert configuration

5. **SECURITY.md** — Security hardening guide
   - Container security
   - Network security
   - Secrets management
   - Vulnerability scanning

---

## 🎯 Kết Luận

Dự án **NestJS Ecommerce API** đã implement thành công **Phase 1-4** của DevOps infrastructure:

✅ **Containerization**: Multi-stage Dockerfile tối ưu (350MB)
✅ **Orchestration**: Docker Compose production-ready
✅ **CI/CD**: GitHub Actions pipeline 6 stages
✅ **Monitoring**: Health endpoint với database + Redis checks
✅ **Security**: Secrets externalized, non-root user, resource limits

**Next Steps:**

1. Complete documentation (DEPLOYMENT.md, MIGRATIONS.md, ROLLBACK.md)
2. Add security scanning (Trivy, gitleaks, Semgrep)
3. Implement Prometheus metrics endpoint
4. Plan migration to AWS ECS (Phase 2)

**Roadmap:**

- **0-1K users**: VPS + Docker Compose (hiện tại) ✅
- **1K-10K users**: AWS ECS + RDS + ElastiCache (Phase 2)
- **10K-100K users**: AWS EKS + Kubernetes + GitOps (Phase 3)

Tài liệu này cung cấp foundation vững chắc để scale từ startup đến enterprise. 🚀
