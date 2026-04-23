# Monolith vs Microservices — So Sánh Toàn Diện

> **Context**: Dự án NestJS Ecommerce API hiện tại là **Monolith** (1 NestJS app, 1 Postgres DB, 1 Redis). Tài liệu này giúp hiểu rõ trade-off để quyết định khi nào cần chuyển sang Microservices.

---

## 1. Định Nghĩa

### Monolith
Toàn bộ logic nghiệp vụ (auth, product, order, payment, chat...) nằm trong **một process duy nhất**, deploy cùng nhau, share cùng database.

```
┌─────────────────────────────────────────────┐
│              NestJS App (1 process)          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │ Auth │ │Product│ │Order │ │ Payment  │  │
│  └──────┘ └──────┘ └──────┘ └──────────┘  │
│               ↓ dùng chung                  │
│          PostgreSQL + Redis                  │
└─────────────────────────────────────────────┘
```

### Microservices
Mỗi nghiệp vụ là **một service độc lập**: process riêng, database riêng, deploy riêng, giao tiếp qua network (HTTP/gRPC/MQ).

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Auth Svc  │  │Product   │  │Order Svc │  │Payment   │
│:3001     │  │Svc :3002 │  │:3003     │  │Svc :3004 │
│  PG DB1  │  │  PG DB2  │  │  PG DB3  │  │  PG DB4  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     └──────────────┴─────────────┴──────────────┘
                     RabbitMQ / Kafka
                     API Gateway (:80)
```

---

## 2. So Sánh Trực Tiếp

### 2.1. Kiến Trúc & Triển Khai

| Tiêu chí | Monolith | Microservices |
|---|---|---|
| **Số process** | 1 | N (mỗi service 1+) |
| **Database** | Dùng chung (1 DB) | Mỗi service có DB riêng |
| **Deploy** | Deploy toàn bộ | Deploy từng service độc lập |
| **Scaling** | Scale toàn bộ app | Scale từng service cần thiết |
| **Communication** | Function call (in-process) | HTTP / gRPC / Message Queue |
| **Transaction** | ACID đầy đủ (`$transaction`) | Eventual consistency (Saga) |
| **Discovery** | Không cần | Cần Service Registry (Consul, k8s) |
| **Observability** | 1 log stream, 1 trace | Distributed tracing (Jaeger, Zipkin) |

### 2.2. Development Experience

| Tiêu chí | Monolith | Microservices |
|---|---|---|
| **Setup môi trường** | `npm install && npm run start:dev` | Docker Compose với 5-20+ containers |
| **Debug** | Breakpoint trực tiếp, 1 stack trace | Phải trace qua nhiều services |
| **Refactor** | Rename function → IDE tự xử lý | Phải update API contract + versioning |
| **Onboarding dev mới** | Clone 1 repo, chạy ngay | Cần hiểu toàn bộ service topology |
| **Code reuse** | Import trực tiếp | Phải tạo shared library / duplicate |
| **Testing** | Unit + Integration dễ | Integration test phức tạp hơn nhiều |
| **Local dev** | Chạy 1 process | Cần chạy nhiều service + infra |

### 2.3. Vận Hành & Độ Tin Cậy

| Tiêu chí | Monolith | Microservices |
|---|---|---|
| **Single point of failure** | App crash → toàn bộ down | Service crash → service khác còn sống |
| **Fault isolation** | Kém — bug 1 module ảnh hưởng tất cả | Tốt — circuit breaker giới hạn lỗi |
| **Rolling update** | Cần downtime hoặc blue/green deploy | Có thể deploy 1 service không downtime |
| **Rollback** | Rollback toàn bộ | Rollback từng service độc lập |
| **Infrastructure cost** | Thấp | Cao (nhiều container, load balancer, MQ) |
| **Operational overhead** | Thấp | Cao (k8s, service mesh, tracing...) |

### 2.4. Performance

| Tiêu chí | Monolith | Microservices |
|---|---|---|
| **Latency nội bộ** | ~0ms (function call) | 0.5-5ms per hop (network) |
| **Throughput** | Bị giới hạn bởi 1 máy | Scale horizontal per service |
| **Database query** | JOIN đơn giản cross-domain | Không thể JOIN cross-DB → cần data denorm |
| **Caching** | Dễ — dùng chung Redis | Phức tạp — cache invalidation cross-service |
| **Bottleneck** | Cả app scale khi 1 module bận | Chỉ scale service bị bottleneck |

---

## 3. Pros & Cons Chi Tiết

### Monolith

**Ưu điểm:**
- ✅ **Đơn giản** — 1 codebase, 1 deploy pipeline, 1 database
- ✅ **ACID transactions** — `$transaction` đảm bảo consistency tuyệt đối
- ✅ **Tốc độ phát triển cao** — không overhead network, contract, versioning
- ✅ **Debug dễ** — 1 stack trace, 1 log stream
- ✅ **Chi phí infra thấp** — 1 server là chạy được
- ✅ **Phù hợp team nhỏ** — 2-8 người có thể manage tốt
- ✅ **Ít moving parts** — ít thứ có thể fail

**Nhược điểm:**
- ❌ **Scale toàn bộ** — không thể chỉ scale 1 module
- ❌ **Deploy risk cao** — bug nhỏ → rollback toàn bộ
- ❌ **Tech stack bị lock** — không thể dùng Python cho 1 module khi cả app là Node.js
- ❌ **Codebase lớn theo thời gian** — khó maintain nếu thiếu discipline
- ❌ **Team conflict** — nhiều người cùng merge vào 1 repo → conflicts nhiều
- ❌ **Startup time** — app càng lớn, start càng chậm

### Microservices

**Ưu điểm:**
- ✅ **Scale độc lập** — chỉ scale Order service khi traffic order tăng
- ✅ **Fault isolation** — Payment service down không ảnh hưởng Product service
- ✅ **Tech diversity** — Auth dùng Node.js, AI service dùng Python, Search dùng Go
- ✅ **Team autonomy** — mỗi team own 1-2 services, deploy độc lập
- ✅ **Deploy nhanh** — thay đổi nhỏ → deploy 1 service, không ảnh hưởng toàn hệ thống
- ✅ **Phù hợp org lớn** — Conway's Law: system mirror org structure

**Nhược điểm:**
- ❌ **Distributed system complexity** — network failures, timeouts, partial failures
- ❌ **Không có ACID cross-service** — phải dùng Saga pattern (phức tạp hơn nhiều)
- ❌ **Latency tăng** — mỗi service call qua network
- ❌ **Operational overhead cao** — k8s, service mesh, distributed tracing, API gateway...
- ❌ **Data consistency khó** — eventual consistency, data duplication giữa services
- ❌ **Testing phức tạp** — cần contract testing, integration test với nhiều service
- ❌ **Chi phí cao hơn** — nhiều server, nhiều container, nhiều engineer vận hành

---

## 4. Khi Nào Chọn Cái Nào?

### Chọn Monolith khi:
```
✅ Team < 10 người
✅ Product còn đang tìm product-market fit
✅ Traffic < 10,000 req/s trên toàn hệ thống
✅ Domain chưa được define rõ ràng (sẽ refactor nhiều)
✅ Budget/timeline eo hẹp
✅ Startup giai đoạn early
✅ Chưa có SRE / DevOps team
```

### Chọn Microservices khi:
```
✅ Team > 20 người, chia thành nhiều squad
✅ Các domain rõ ràng, ít thay đổi boundary
✅ Cần scale khác nhau per domain (ví dụ: Search scale x10 so với Admin)
✅ Có SRE team vận hành infra
✅ Regulatory yêu cầu isolate data (PCI-DSS cho Payment)
✅ Different reliability SLA per service (Payment: 99.99% vs Report: 99%)
✅ Đã có Monolith hoạt động tốt và identify được bottleneck
```

---

## 5. Migration Path: Monolith → Microservices

Không bao giờ bắt đầu bằng microservices. Hãy theo **Strangler Fig Pattern**:

```
Phase 0 (Hiện tại): Monolith tốt
─────────────────────────────────
[NestJS Monolith] → [PostgreSQL] + [Redis] + [BullMQ]
Tất cả domain trong 1 app. Domain boundaries rõ ràng qua modules.

Phase 1: Tách service đầu tiên (chọn service ít dependency nhất)
─────────────────────────────────────────────────────────────────
[NestJS Monolith] ←HTTP→ [Notification Service] (email/SMS)
Monolith vẫn là core. Notification tách ra vì:
  - Không cần ACID với domain khác
  - Có thể fail mà không crash main app
  - Scale độc lập khi cần

Phase 2: Tách service có traffic lớn
─────────────────────────────────────
[API Gateway]
     ↓
[NestJS Monolith] ←RabbitMQ→ [Search Service] (Elasticsearch)
                             [Notification Service]

Phase 3: Tách dần core domains khi team lớn đủ
────────────────────────────────────────────────
[API Gateway]
     ↓            ↓              ↓              ↓
[Auth Svc]  [Product Svc]  [Order Svc]  [Payment Svc]
     ↓            ↓              ↓              ↓
  [DB Auth]  [DB Product]  [DB Order]  [DB Payment]
```

**Quy tắc tách service:**
1. Tách theo **business domain**, không theo technical layer
2. Service nào **ít dependency nhất** → tách trước
3. Phải có **test coverage tốt** trước khi tách
4. **Database tách sau** khi code tách ổn định
5. Dùng **Feature Flag** để rollback nếu có vấn đề

---

## 6. Patterns Quan Trọng Khi Dùng Microservices

### 6.1. Communication Patterns

```
Synchronous (Request-Reply):
  Client → [API Gateway] → [Service A] → [Service B] → response
  Dùng: HTTP REST hoặc gRPC
  Khi nào: Cần response ngay, user đang chờ

Asynchronous (Event-Driven):
  [Order Service] → publish event → [RabbitMQ] → [Payment Service]
                                               → [Notification Service]
  Dùng: RabbitMQ, Kafka
  Khi nào: Fire-and-forget, background processing, fan-out
```

### 6.2. Data Consistency

```
Monolith (đơn giản):
  await prisma.$transaction([
    prisma.order.create(...),
    prisma.stock.decrement(...),
    prisma.payment.create(...)
  ]) // ACID, all-or-nothing

Microservices (Saga Pattern - phức tạp):
  1. Order Service: create order (status: PENDING)
  2. → publish OrderCreated event
  3. Payment Service: charge card
     → success: publish PaymentSucceeded
     → fail: publish PaymentFailed
  4. Order Service: listen PaymentSucceeded → update CONFIRMED
     hoặc: listen PaymentFailed → compensate (cancel order)
  5. Inventory Service: listen OrderConfirmed → decrement stock
```

### 6.3. Service Discovery & API Gateway

```
Không dùng API Gateway:
  Client biết IP từng service → tightly coupled, không scale

Dùng API Gateway:
  Client → [API Gateway :80]
               ↓ route theo path
     /api/auth/* → [Auth Service :3001]
     /api/products/* → [Product Service :3002]
     /api/orders/* → [Order Service :3003]

  API Gateway còn làm: Auth, Rate limiting, Load balancing, SSL termination
```

---

## 7. Tổng Kết — Decision Framework

```
Câu hỏi 1: Team bao nhiêu người?
  < 10 → Monolith
  > 20 → Cân nhắc Microservices

Câu hỏi 2: Domain đã stable chưa?
  Chưa (đang pivot) → Monolith (microservices sẽ làm refactor chậm 10x)
  Stable → Microservices có thể là option

Câu hỏi 3: Có bottleneck cụ thể chưa?
  Chưa → Monolith (premature optimization)
  Có (ví dụ: Search làm chậm cả app) → Tách riêng service đó

Câu hỏi 4: Có SRE/DevOps team không?
  Không → Monolith (microservices sẽ crash production)
  Có → Microservices là feasible

Câu hỏi 5: Yêu cầu compliance/isolation?
  PCI-DSS, HIPAA, GDPR per domain → Microservices bắt buộc
  Không có → Monolith đủ
```

### Rule of thumb cuối cùng:
> **"Bắt đầu bằng Monolith với domain boundaries rõ ràng. Tách Microservices khi có lý do cụ thể, không phải vì trend."**
>
> — Martin Fowler, Sam Newman (Building Microservices)

---

## 8. Áp Dụng Cho Dự Án NestJS Ecommerce Này

```
Hiện trạng (Phase 0 — Monolith):
  ✅ 1 NestJS app với modules: Auth, Product, Order, Payment, Chat, Wishlist...
  ✅ 1 PostgreSQL DB
  ✅ Redis + BullMQ cho async jobs
  ✅ Domain boundaries rõ qua NestJS modules
  
Điểm mạnh hiện tại:
  ✅ ACID transactions (order + stock + payment trong 1 $transaction)
  ✅ Dễ develop và debug
  ✅ Chi phí infra thấp

Khi nào nên tách service đầu tiên:
  → Notification (email/SMS): service đầu tiên để tách vì ít dependency nhất
  → Search (nếu dùng Elasticsearch): tách khi cần full-text search phức tạp
  → Payment: tách khi cần PCI-DSS compliance riêng

Chưa cần tách khi:
  → Chưa có bottleneck performance cụ thể
  → Team còn nhỏ (< 10 người)
  → Domain boundaries vẫn đang thay đổi
```

---

*Tài liệu liên quan:*
- `ZZ_42_ARCH_MQ_RABBITMQ_KAFKA_DECISION_AND_PLAN.md` — MQ trong Monolith vs Microservices
- `ZZ_86_DEEP_DIVE_MESSAGE_BROKER_VA_ASYNC_COMMUNICATION.md` — Saga pattern, async communication
- `ZZ_24_MICROSERVICES_AUTHENTICATION_AUTHORIZATION.md` — Auth trong Microservices
- `ZZ_84_1_TONG_HOP_ARCHITECTURE_DOCKER_CLOUD_DEEP_DIVE.md` — Docker & deployment
