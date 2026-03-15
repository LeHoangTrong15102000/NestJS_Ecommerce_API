# Deep Dive: Event Loop và Concurrency trong Node.js

> Tài liệu này giải thích chi tiết 5 chủ đề nâng cao liên quan đến Event Loop, concurrency, và cách Node.js xử lý nhiều request đồng thời — sử dụng code thực tế từ project NestJS Ecommerce API.

---

## Mục lục

1. [Cluster Mode & Worker Threads](#1-cluster-mode--worker-threads)
2. [Connection Pooling trong Prisma](#2-connection-pooling-trong-prisma)
3. [Backpressure](#3-backpressure)
4. [So sánh với Multi-thread Model](#4-so-sánh-với-multi-thread-model-java-spring-net)
5. [Deep Dive vào $transaction trong order.repo.ts](#5-deep-dive-vào-transaction-trong-orderrepots)

---

## 1. Cluster Mode & Worker Threads

### Vấn đề: 1 Event Loop không đủ

Node.js chạy trên **1 thread duy nhất**. Nếu server có 8 CPU cores, bạn chỉ đang dùng **1 core**. 7 cores còn lại nằm không.

### Giải pháp 1: Cluster Mode (nhiều process)

Cluster mode tạo ra **nhiều bản sao** của ứng dụng, mỗi bản chạy trên 1 CPU core riêng.

```
                    ┌─────────────────────┐
                    │    Master Process    │
                    │  (không xử lý req)  │
                    └──────────┬──────────┘
                               │ fork()
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │  Worker 1      │ │  Worker 2      │ │  Worker 3      │
     │  (CPU Core 1)  │ │  (CPU Core 2)  │ │  (CPU Core 3)  │
     │  Port 3000     │ │  Port 3000     │ │  Port 3000     │
     │  Event Loop    │ │  Event Loop    │ │  Event Loop    │
     │  riêng         │ │  riêng         │ │  riêng         │
     └────────────────┘ └────────────────┘ └────────────────┘
```

**Cách triển khai với NestJS:**

```typescript
// cluster.ts
import * as cluster from 'cluster'
import * as os from 'os'

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length
  console.log(`Master process ${process.pid} is running`)
  console.log(`Forking ${numCPUs} workers...`)

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`)
    cluster.fork() // Tự động restart worker bị crash
  })
} else {
  // Mỗi worker chạy bootstrap() riêng
  import('./main') // ← file main.ts của project bạn
}
```

**Trong thực tế, dùng PM2 đơn giản hơn:**

```bash
# Chạy trên tất cả CPU cores
pm2 start dist/main.js -i max

# Hoặc chỉ định số instances
pm2 start dist/main.js -i 4
```

**Ưu điểm:**
- Tận dụng được tất cả CPU cores
- Nếu 1 worker crash, các worker khác vẫn chạy
- Đơn giản, không cần thay đổi code

**Nhược điểm:**
- Mỗi worker là 1 process riêng → **không chia sẻ memory**
- Nếu dùng in-memory cache, mỗi worker có cache riêng → không đồng bộ
- Tốn RAM hơn (mỗi worker ~50-100MB)

### Giải pháp 2: Worker Threads (nhiều thread trong 1 process)

Worker Threads cho phép chạy **JavaScript trên thread riêng** nhưng vẫn trong cùng 1 process.

```
┌──────────────────────────────────────────────┐
│              Main Thread (Process)            │
│  ┌──────────────────────────────────────┐    │
│  │  Event Loop (xử lý HTTP requests)   │    │
│  └──────────────┬───────────────────────┘    │
│                 │                             │
│    ┌────────────┼────────────┐               │
│    ▼            ▼            ▼               │
│  ┌──────┐  ┌──────┐  ┌──────┐               │
│  │Thread│  │Thread│  │Thread│               │
│  │  1   │  │  2   │  │  3   │               │
│  │(CPU  │  │(CPU  │  │(CPU  │               │
│  │heavy)│  │heavy)│  │heavy)│               │
│  └──────┘  └──────┘  └──────┘               │
│                                              │
│  SharedArrayBuffer (chia sẻ memory)          │
└──────────────────────────────────────────────┘
```

**Khi nào dùng Worker Threads:**

```typescript
// Ví dụ: Nếu trong project bạn cần xử lý ảnh hoặc tính toán nặng
import { Worker } from 'worker_threads'

// Trong service
async processHeavyTask(data: any) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-computation.worker.js', {
      workerData: data,
    })
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}
```

**Khi nào dùng cái nào?**

```
┌──────────────────────┬─────────────────────┬──────────────────────┐
│                      │  Cluster Mode       │  Worker Threads      │
├──────────────────────┼─────────────────────┼──────────────────────┤
│ Use case chính       │ Scale HTTP server   │ CPU-heavy tasks      │
│                      │ (nhiều requests)    │ (image processing,   │
│                      │                     │  crypto, ML)         │
├──────────────────────┼─────────────────────┼──────────────────────┤
│ Chia sẻ memory       │ KHÔNG               │ CÓ (SharedArray      │
│                      │                     │  Buffer)             │
├──────────────────────┼─────────────────────┼──────────────────────┤
│ Isolation            │ Cao (process riêng) │ Thấp (cùng process)  │
├──────────────────────┼─────────────────────┼──────────────────────┤
│ Phù hợp với project  │ ✅ Production       │ ✅ Nếu cần xử lý    │
│ Ecommerce của bạn    │ deployment          │ ảnh, báo cáo nặng   │
└──────────────────────┴─────────────────────┴──────────────────────┘
```

**Với project Ecommerce của bạn**, giải pháp tốt nhất trong production:

```yaml
# docker-compose.prod.yml — chạy nhiều replicas
services:
  api:
    image: ecommerce-api
    deploy:
      replicas: 4  # 4 instances, mỗi cái 1 event loop
    # Hoặc dùng PM2 bên trong container
    command: pm2-runtime start dist/main.js -i max
```

---

## 2. Connection Pooling trong Prisma

### Vấn đề: Database có giới hạn connections

PostgreSQL mặc định cho phép **100 connections đồng thời**. Nếu 200 request đến cùng lúc, mỗi request mở 1 connection → **100 request bị từ chối**.

### Prisma Connection Pool hoạt động như thế nào

Prisma tự động quản lý một **connection pool** — một tập hợp các connections được tạo sẵn và tái sử dụng.

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Application                    │
│                                                         │
│  Request A ──┐                                          │
│  Request B ──┤                                          │
│  Request C ──┤    ┌──────────────────────────────┐      │
│  Request D ──┼───►│     Prisma Connection Pool   │      │
│  Request E ──┤    │                              │      │
│  Request F ──┤    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐│      │
│  Request G ──┘    │  │Conn│ │Conn│ │Conn│ │Conn││      │
│                   │  │ 1  │ │ 2  │ │ 3  │ │ 4  ││      │
│                   │  └──┬─┘ └──┬─┘ └──┬─┘ └──┬─┘│      │
│                   └─────┼──────┼──────┼──────┼───┘      │
│                         │      │      │      │          │
└─────────────────────────┼──────┼──────┼──────┼──────────┘
                          │      │      │      │
                    ┌─────▼──────▼──────▼──────▼─────┐
                    │        PostgreSQL               │
                    │    (max 100 connections)        │
                    └────────────────────────────────┘
```

**Trong project của bạn**, `prisma.service.ts` khởi tạo PrismaClient:

```typescript
// src/shared/services/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Prisma mặc định: connection_limit = num_cpus * 2 + 1
      // Trên máy 4 cores → pool size = 9
    })
  }

  async onModuleInit() {
    await this.$connect() // Mở pool connections
  }

  async onModuleDestroy() {
    await this.$disconnect() // Đóng tất cả connections
  }
}
```

### Flow chi tiết khi nhiều request đồng thời

Giả sử pool size = 5, có 8 request đến cùng lúc:

```
t=0ms: 8 requests đến cùng lúc
  │
  ├─ Request 1 → Lấy Connection 1 từ pool → Query DB
  ├─ Request 2 → Lấy Connection 2 từ pool → Query DB
  ├─ Request 3 → Lấy Connection 3 từ pool → Query DB
  ├─ Request 4 → Lấy Connection 4 từ pool → Query DB
  ├─ Request 5 → Lấy Connection 5 từ pool → Query DB
  │
  ├─ Request 6 → Pool hết connection → XẾP HÀNG CHỜ
  ├─ Request 7 → Pool hết connection → XẾP HÀNG CHỜ
  └─ Request 8 → Pool hết connection → XẾP HÀNG CHỜ

t=50ms: Request 2 query xong
  │
  ├─ Connection 2 được TRẢ VỀ pool
  └─ Request 6 → Lấy Connection 2 → Query DB

t=80ms: Request 1 query xong
  │
  ├─ Connection 1 được TRẢ VỀ pool
  └─ Request 7 → Lấy Connection 1 → Query DB

... và cứ thế tiếp tục
```

### Cấu hình connection pool qua DATABASE_URL

Trong `.env.example` của project bạn:

```bash
# Mặc định — Prisma tự tính pool size
DATABASE_URL="postgresql://postgres:password@localhost:5432/ecommerce_dev?schema=public"

# Tùy chỉnh pool size
DATABASE_URL="postgresql://postgres:password@localhost:5432/ecommerce_dev?schema=public&connection_limit=20"

# Khi dùng PgBouncer (external connection pooler) — như trong .env.example của bạn
DATABASE_URL="postgresql://postgres.xxx:password@pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### Ví dụ thực tế: Tại sao pool quan trọng với order.repo.ts

Khi UserA tạo order, `$transaction` trong `order.repo.ts:117` giữ **1 connection** suốt thời gian transaction:

```typescript
// order.repo.ts:117-184
const [paymentId, orders] = await this.prismaService.$transaction(async (tx) => {
  // Connection bị LOCK cho transaction này
  // Tất cả operations bên trong dùng CÙNG 1 connection
  const payment = await tx.payment.create(...)
  const orders$ = Promise.all(ordersWithCalculations.map(...))
  const cartItem$ = tx.cartItem.deleteMany(...)
  const sku$ = Promise.all(cartItems.map(...))
  const voucher$ = Promise.all(...)
  const addCancelPaymentJob$ = this.orderProducer.addCancelPaymentJob(...)

  await Promise.all([orders$, cartItem$, sku$, voucher$, addCancelPaymentJob$])
  // Connection chỉ được TRẢ VỀ pool sau khi transaction COMMIT hoặc ROLLBACK
})
```

Nếu pool size = 5 và có 5 users tạo order cùng lúc → **pool cạn kiệt** → request thứ 6 phải chờ.

### Khuyến nghị cho production

```
Pool size = (Số CPU cores * 2) + 1

Ví dụ:
- Server 2 cores  → pool size = 5
- Server 4 cores  → pool size = 9
- Server 8 cores  → pool size = 17

Nếu chạy Cluster Mode với 4 workers:
- Mỗi worker có pool riêng
- Tổng connections = 4 workers × 9 connections = 36
- PostgreSQL max_connections phải >= 36
```

---

## 3. Backpressure

### Vấn đề: 10,000 request cùng lúc, event loop có bị overwhelm không?

Câu trả lời ngắn: **Có**, nếu không có cơ chế bảo vệ.

### Event Loop bị overwhelm như thế nào

```
10,000 requests đến cùng lúc
        │
        ▼
┌──────────────────────────────────────┐
│           Event Loop                  │
│                                      │
│  Callback Queue:                     │
│  [req1] [req2] [req3] ... [req10000] │
│                                      │
│  Mỗi request cần:                    │
│  - Parse body (~0.1ms)               │
│  - Validate (~0.2ms)                 │
│  - Auth middleware (~0.5ms)           │
│  - Business logic (~1ms)             │
│  = ~1.8ms synchronous work           │
│                                      │
│  10,000 × 1.8ms = 18 GIÂY           │
│  chỉ riêng phần sync!               │
└──────────────────────────────────────┘
```

Request thứ 10,000 phải chờ **18 giây** chỉ để event loop đến lượt nó — chưa tính thời gian query DB.

### Các cơ chế bảo vệ

#### 3.1. Rate Limiting (giới hạn số request)

Trong project của bạn, `main.ts:58` đã set `trust proxy` cho rate limiting:

```typescript
// main.ts:58
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback')
```

Thêm rate limiting với NestJS:

```typescript
import { ThrottlerModule } from '@nestjs/throttler'

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,   // 60 giây
          limit: 100,   // Tối đa 100 requests / 60 giây / IP
        },
      ],
    }),
  ],
})
export class AppModule {}
```

#### 3.2. Connection Pool Backpressure (Prisma tự xử lý)

Khi pool hết connection, Prisma **xếp hàng** request thay vì crash:

```
Request 1-5:  Lấy connection ngay → query DB
Request 6-20: Xếp hàng trong Prisma pool queue
              ↓
              Nếu chờ quá lâu (mặc định 10 giây)
              → Prisma throw PrismaClientKnownRequestError
              → "Timed out fetching a new connection from the connection pool"
```

Trong `prisma.service.ts:51-73` của bạn, `transactionWithTimeout` đã handle điều này:

```typescript
async transactionWithTimeout<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  const timeout = options?.timeout || 30000  // Transaction timeout: 30s
  const maxWait = options?.maxWait || 10000  // Chờ connection tối đa: 10s
  // ...
}
```

#### 3.3. OS-level Backpressure (TCP backlog)

Trước khi request đến Node.js, OS đã có cơ chế bảo vệ:

```
Client gửi request
      │
      ▼
┌─────────────────────┐
│  OS TCP Backlog      │  ← Hàng đợi ở tầng OS
│  (mặc định 511)     │     Nếu đầy → client nhận
│                     │     "Connection refused"
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Node.js HTTP Server │  ← Event loop xử lý
└─────────────────────┘
```

#### 3.4. Reverse Proxy (Nginx) — Tuyến phòng thủ đầu tiên

```nginx
# nginx.conf
upstream nodejs {
    server 127.0.0.1:3000;
    # Giới hạn connections đến Node.js
    keepalive 64;
}

server {
    # Giới hạn request rate
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://nodejs;

        # Giới hạn concurrent connections per IP
        limit_conn addr 10;
    }
}
```

### Tổng kết các tầng bảo vệ

```
Client Request
    │
    ▼
[Tầng 1] Nginx Rate Limiting (10 req/s/IP)
    │
    ▼
[Tầng 2] OS TCP Backlog (511 pending connections)
    │
    ▼
[Tầng 3] NestJS ThrottlerGuard (100 req/60s/IP)
    │
    ▼
[Tầng 4] Prisma Connection Pool (queue + timeout)
    │
    ▼
[Tầng 5] PostgreSQL max_connections (100)
```

---

## 4. So sánh với Multi-thread Model (Java Spring, .NET)

### Thread-per-request Model (Java Spring, .NET, PHP)

```
┌──────────────────────────────────────────────────┐
│              Java Spring Application              │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           Thread Pool (200 threads)       │    │
│  │                                          │    │
│  │  Request A → Thread 1 ████████░░░░░░░░   │    │
│  │                        ▲ chạy  ▲ chờ DB  │    │
│  │                        │       │         │    │
│  │  Request B → Thread 2 ████████░░░░░░░░   │    │
│  │                                          │    │
│  │  Request C → Thread 3 ████████░░░░░░░░   │    │
│  │                                          │    │
│  │  ...                                     │    │
│  │                                          │    │
│  │  Request 200 → Thread 200 ████░░░░░░░░   │    │
│  │                                          │    │
│  │  Request 201 → XẾP HÀNG CHỜ (no thread) │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ████ = Thread đang chạy code (dùng CPU)         │
│  ░░░░ = Thread đang CHỜ I/O (LÃNG PHÍ CPU!)     │
└──────────────────────────────────────────────────┘
```

**Vấn đề**: Mỗi thread chiếm ~1MB RAM. 200 threads = 200MB chỉ cho thread stack. Và khi thread chờ DB response, nó **không làm gì** nhưng vẫn chiếm memory.

### Event Loop Model (Node.js)

```
┌──────────────────────────────────────────────────┐
│              Node.js Application                  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           1 Thread, 1 Event Loop          │    │
│  │                                          │    │
│  │  t=0ms:  [Req A: parse body]             │    │
│  │  t=1ms:  [Req A: validate] → query DB    │    │
│  │          → NHẢY SANG                     │    │
│  │  t=2ms:  [Req B: parse body]             │    │
│  │  t=3ms:  [Req B: validate] → query DB    │    │
│  │          → NHẢY SANG                     │    │
│  │  t=4ms:  [Req C: parse body]             │    │
│  │  t=5ms:  [Req C: validate] → query DB    │    │
│  │          → NHẢY SANG                     │    │
│  │  ...                                     │    │
│  │  t=50ms: [Req A: DB done!] → tiếp tục   │    │
│  │  t=51ms: [Req B: DB done!] → tiếp tục   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Thread KHÔNG BAO GIỜ ngồi chờ                   │
│  Luôn luôn đang làm việc gì đó                   │
└──────────────────────────────────────────────────┘
```

### So sánh chi tiết

```
┌────────────────────┬──────────────────────┬──────────────────────┐
│                    │  Java Spring         │  Node.js             │
│                    │  (Thread-per-req)    │  (Event Loop)        │
├────────────────────┼──────────────────────┼──────────────────────┤
│ 10,000 concurrent  │ 10,000 threads       │ 1 thread             │
│ connections         │ = ~10GB RAM          │ = ~50MB RAM          │
├────────────────────┼──────────────────────┼──────────────────────┤
│ CPU utilization    │ Thấp khi I/O-bound   │ Cao (không lãng phí) │
│ khi chờ DB         │ (threads ngồi chờ)   │                      │
├────────────────────┼──────────────────────┼──────────────────────┤
│ CPU-heavy tasks    │ ✅ Tốt (multi-thread)│ ❌ Block event loop  │
│ (image processing) │                      │ (cần Worker Threads) │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Context switching  │ Nhiều (OS scheduler) │ Ít (1 thread)        │
│ overhead           │                      │                      │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Complexity         │ Thread safety,       │ Callback hell,       │
│                    │ deadlocks, race      │ async/await           │
│                    │ conditions           │ (đơn giản hơn)       │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Phù hợp cho       │ CPU-intensive apps,  │ I/O-intensive apps,  │
│                    │ enterprise systems   │ real-time, APIs      │
└────────────────────┴──────────────────────┴──────────────────────┘
```

### Tại sao Node.js chọn Single-thread Event Loop?

**Lý do 1: Phần lớn web apps là I/O-bound**

Project Ecommerce của bạn là ví dụ hoàn hảo. Nhìn vào `order.service.ts`:

```typescript
async create(userId: number, body: CreateOrderBodyType) {
  // 95% thời gian = CHỜ I/O (database queries)
  const { cartItems } = await this.orderRepo.fetchAndValidateCartItems(userId, body)  // I/O
  const calculations = await this.calculateOrderDiscounts(body, cartItemMap)           // I/O (voucher lookup)
  const result = await this.orderRepo.create(userId, body, cartItems, calculations)    // I/O

  // 5% thời gian = CPU (validate, tính toán)
  // → Không cần multi-thread cho 5% CPU work
}
```

**Lý do 2: Không có race conditions**

Với Java multi-thread, nếu 2 threads cùng update stock:

```java
// Java — CẦN synchronized/lock
synchronized(skuLock) {
    int stock = sku.getStock();        // Thread 1 đọc: stock = 10
    // Thread 2 cũng đọc: stock = 10  ← RACE CONDITION!
    sku.setStock(stock - 1);           // Cả 2 set stock = 9 thay vì 8
}
```

Với Node.js single-thread, vấn đề này **không tồn tại** ở tầng application. Tuy nhiên, bạn vẫn cần xử lý ở tầng database — và bạn đã làm đúng trong `order.repo.ts:142-149`:

```typescript
// Node.js — Dùng atomic SQL operation thay vì read-then-write
const result = await tx.$executeRaw`
  UPDATE "SKU"
  SET stock = stock - ${item.quantity}  -- Atomic operation ở tầng DB
  WHERE id = ${item.sku.id}
  AND stock >= ${item.quantity}          -- Kiểm tra đủ stock
`
if (result === 0) {
  throw OutOfStockSKUException  // Không đủ stock
}
```

**Lý do 3: Đơn giản hơn cho developer**

```
Java: Thread pool + synchronized + locks + deadlock prevention + thread-safe collections
Node.js: async/await + Promise.all → xong
```

### Lưu ý: Java cũng đang chuyển sang Event Loop model

Java 21 có **Virtual Threads (Project Loom)** — kết hợp ưu điểm của cả hai:

```java
// Java 21 — Virtual Threads (giống async/await nhưng vẫn multi-thread)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> handleRequest(request));
    // Hàng triệu virtual threads, mỗi cái chỉ tốn ~1KB
}
```

---

## 5. Deep Dive vào $transaction trong order.repo.ts

### Transaction là gì và tại sao cần nó?

Khi tạo order, bạn cần thực hiện **nhiều operations phải thành công CÙNG LÚC**:

1. Tạo payment record
2. Tạo order records
3. Xóa cart items
4. Giảm stock SKU
5. Cập nhật voucher usage
6. Thêm cancel payment job

Nếu bước 4 fail (hết stock) nhưng bước 1-3 đã thành công → **dữ liệu không nhất quán** (payment tồn tại nhưng không có stock).

Transaction đảm bảo: **Tất cả thành công, hoặc tất cả rollback**.

### Phân tích chi tiết order.repo.ts:117-184

```typescript
const [paymentId, orders] = await this.prismaService.$transaction(async (tx) => {
  // ┌─────────────────────────────────────────────────────────┐
  // │ TẤT CẢ code bên trong đây dùng CÙNG 1 DB connection    │
  // │ PostgreSQL giữ một transaction lock                     │
  // └─────────────────────────────────────────────────────────┘

  // Bước 1: Tạo payment (tuần tự — cần payment.id cho bước 2)
  const payment = await tx.payment.create({
    data: { status: PaymentStatus.PENDING },
  })

  // Bước 2-6: Chạy ĐỒNG THỜI (không phụ thuộc nhau)
  const orders$ = Promise.all(
    ordersWithCalculations.map(({ item, ... }) =>
      tx.order.create({ data: this.buildOrderCreateData(..., payment.id, ...) })
    ),
  )

  const cartItem$ = tx.cartItem.deleteMany({
    where: { id: { in: allBodyCartItemIds } },
  })

  const sku$ = Promise.all(
    cartItems.map(async (item) => {
      const result = await tx.$executeRaw`
        UPDATE "SKU" SET stock = stock - ${item.quantity}
        WHERE id = ${item.sku.id} AND stock >= ${item.quantity}
      `
      if (result === 0) throw OutOfStockSKUException
    }),
  )

  const voucher$ = Promise.all(...)
  const addCancelPaymentJob$ = this.orderProducer.addCancelPaymentJob(payment.id)

  // Chờ TẤT CẢ 5 operations xong
  const [orders] = await Promise.all([orders$, cartItem$, sku$, voucher$, addCancelPaymentJob$])

  return [payment.id, orders]
  // ← Nếu không có error → COMMIT
  // ← Nếu có error bất kỳ → ROLLBACK tất cả
})
```

### Transaction Lock ảnh hưởng đến Concurrency như thế nào?

#### Scenario: 2 users mua cùng 1 sản phẩm (stock = 1)

```
Timeline:
═══════════════════════════════════════════════════════════►

UserA: POST /orders (mua SKU #100, quantity: 1)
UserB: POST /orders (mua SKU #100, quantity: 1)

t=0ms: UserA bắt đầu transaction
  │
  ├─ BEGIN TRANSACTION (Isolation: Read Committed — mặc định PostgreSQL)
  ├─ INSERT INTO Payment ...
  ├─ INSERT INTO Order ...
  ├─ UPDATE SKU SET stock = stock - 1 WHERE id = 100 AND stock >= 1
  │   └─ PostgreSQL đặt ROW LOCK trên SKU #100
  │      (row này bị lock cho đến khi transaction kết thúc)

t=5ms: UserB bắt đầu transaction
  │
  ├─ BEGIN TRANSACTION
  ├─ INSERT INTO Payment ...  ← OK (khác row)
  ├─ INSERT INTO Order ...    ← OK (khác row)
  ├─ UPDATE SKU SET stock = stock - 1 WHERE id = 100 AND stock >= 1
  │   └─ PostgreSQL: "Row #100 đang bị LOCK bởi UserA"
  │      → UserB PHẢI CHỜ tại đây
  │      → Event loop nhả thread, xử lý request khác

t=20ms: UserA transaction COMMIT
  │
  ├─ stock: 1 → 0 (thành công)
  ├─ ROW LOCK được giải phóng
  │
  └─ UserB tiếp tục:
     ├─ UPDATE SKU SET stock = stock - 1 WHERE id = 100 AND stock >= 1
     │   → stock hiện tại = 0, điều kiện stock >= 1 KHÔNG thỏa
     │   → result = 0 (0 rows affected)
     │
     ├─ if (result === 0) throw OutOfStockSKUException
     │
     └─ Transaction ROLLBACK
        → Payment, Order của UserB bị xóa sạch
        → UserB nhận error: "Sản phẩm đã hết hàng"
```

### Các loại Lock trong PostgreSQL

```
┌─────────────────────┬──────────────────────────────────────────────┐
│ Lock Type           │ Khi nào xảy ra trong code của bạn           │
├─────────────────────┼──────────────────────────────────────────────┤
│ ROW LOCK            │ UPDATE SKU SET stock = stock - 1             │
│ (FOR UPDATE)        │ → Lock chỉ row SKU đang update              │
│                     │ → Các row SKU khác KHÔNG bị ảnh hưởng       │
├─────────────────────┼──────────────────────────────────────────────┤
│ ROW LOCK            │ tx.voucher.update({ where: { id: ... } })   │
│ (implicit)          │ → Lock row voucher đang update               │
├─────────────────────┼──────────────────────────────────────────────┤
│ NO LOCK             │ tx.payment.create(...)                       │
│                     │ → INSERT không lock existing rows            │
│                     │ → Nhiều users tạo payment đồng thời OK      │
├─────────────────────┼──────────────────────────────────────────────┤
│ NO LOCK             │ tx.order.create(...)                         │
│                     │ → INSERT mới, không conflict                 │
└─────────────────────┴──────────────────────────────────────────────┘
```

### Điểm quan trọng: Promise.all BÊN TRONG Transaction

```typescript
// Bên trong transaction, Promise.all gửi 5 queries ĐỒNG THỜI
// NHƯNG tất cả đều đi qua CÙNG 1 DB connection

await Promise.all([orders$, cartItem$, sku$, voucher$, addCancelPaymentJob$])
```

```
┌─────────────────────────────────────────────────┐
│            1 DB Connection (Transaction)         │
│                                                 │
│  Query 1: INSERT orders    ──────►  PostgreSQL  │
│  Query 2: DELETE cartItems ──────►  xử lý      │
│  Query 3: UPDATE SKU stock ──────►  tuần tự    │
│  Query 4: UPDATE voucher   ──────►  trên cùng  │
│  Query 5: Redis job (khác) ──────►  connection  │
│                                                 │
│  PostgreSQL xử lý queries trên 1 connection     │
│  theo thứ tự nhận được (pipelining)             │
│  NHƯNG event loop không bị block                │
└─────────────────────────────────────────────────┘
```

**Lưu ý quan trọng**: Mặc dù bạn dùng `Promise.all` để gửi queries đồng thời từ phía Node.js, PostgreSQL xử lý chúng **tuần tự trên cùng 1 connection** (vì transaction). Tuy nhiên, điều này vẫn có lợi vì:

1. Node.js event loop không bị block
2. Network latency được overlap (gửi query 2 trong khi chờ query 1)
3. `addCancelPaymentJob$` gửi đến Redis (khác server) → thực sự song song

### Deadlock — Khi nào xảy ra?

```
UserA transaction: UPDATE SKU #100 → chờ lock SKU #200
UserB transaction: UPDATE SKU #200 → chờ lock SKU #100

→ DEADLOCK! Cả 2 chờ nhau mãi mãi.
→ PostgreSQL tự detect và kill 1 transaction sau timeout.
```

Trong code của bạn, deadlock **ít xảy ra** vì:
- Mỗi user thường mua SKU khác nhau
- Nếu mua cùng SKU, PostgreSQL xử lý tuần tự (chờ lock)
- `transactionWithTimeout` trong `prisma.service.ts:51-73` có timeout 30s để tránh chờ vô hạn

---

## Tổng kết

```
1. Cluster Mode    → Scale lên nhiều CPU cores (nhiều process)
2. Connection Pool → Tái sử dụng DB connections (tránh cạn kiệt)
3. Backpressure    → Nhiều tầng bảo vệ (Nginx → Throttler → Pool → DB)
4. vs Multi-thread → Node.js tối ưu cho I/O-bound (như Ecommerce API)
5. $transaction    → Đảm bảo data consistency, row-level locking
```
