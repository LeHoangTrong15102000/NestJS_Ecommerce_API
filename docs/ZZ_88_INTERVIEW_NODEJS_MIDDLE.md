# Câu Hỏi Phỏng Vấn NodeJS Middle Level

> Tài liệu này tổng hợp các câu hỏi phỏng vấn kỹ thuật cho vị trí **NodeJS Middle Developer**, được xây dựng dựa trên yêu cầu tuyển dụng thực tế: 2+ năm kinh nghiệm, NodeJS, SQL/NoSQL, ExpressJS/KOA, Queue, Docker, RESTful API, SSL, Firebase, PostgreSQL, MongoDB, Redis, Blockchain/Bitcoin.

---

## Mục Lục

1. [NodeJS Core & Architecture](#1-nodejs-core--architecture)
2. [Asynchronous Programming](#2-asynchronous-programming)
3. [ExpressJS & KOA](#3-expressjs--koa)
4. [Queue & Xử Lý Đa Luồng](#4-queue--xử-lý-đa-luồng)
5. [Cơ Sở Dữ Liệu: SQL vs NoSQL](#5-cơ-sở-dữ-liệu-sql-vs-nosql)
6. [PostgreSQL](#6-postgresql)
7. [MongoDB](#7-mongodb)
8. [Redis](#8-redis)
9. [Firebase](#9-firebase)
10. [RESTful API & SSL/HTTPS](#10-restful-api--sslhttps)
11. [Docker & Deployment](#11-docker--deployment)
12. [Thiết Kế Cấu Trúc Dữ Liệu & System Design](#12-thiết-kế-cấu-trúc-dữ-liệu--system-design)
13. [Blockchain & Bitcoin](#13-blockchain--bitcoin)
14. [Security Best Practices](#14-security-best-practices)
15. [GitHub, Git Workflow, JIRA, Bitbucket](#15-github-git-workflow-jira-bitbucket)
16. [Câu Hỏi Tình Huống Thực Tế](#16-câu-hỏi-tình-huống-thực-tế)

---

## 1. NodeJS Core & Architecture

### Q1: NodeJS là gì và nó hoạt động như thế nào?

**Trả lời:**
NodeJS là runtime environment cho JavaScript chạy phía server, được xây dựng trên V8 engine của Chrome. NodeJS sử dụng kiến trúc **event-driven, non-blocking I/O** cho phép xử lý nhiều request đồng thời mà không cần tạo nhiều thread.

Điểm quan trọng cần nhấn mạnh:

- Single-threaded nhưng non-blocking nhờ **libuv** và **Event Loop**
- Phù hợp với I/O-intensive tasks (API, chat, streaming)
- Không phù hợp với CPU-intensive tasks (video encoding, complex calculations)

---

### Q2: Giải thích Event Loop trong NodeJS. Các phase của Event Loop là gì?

**Trả lời:**
Event Loop là cơ chế cho phép NodeJS thực hiện non-blocking I/O mặc dù JavaScript là single-threaded.

**6 Phase của Event Loop:**

```
┌──────────────────────────────┐
│           timers             │  ← setTimeout, setInterval callbacks
│  pending callbacks           │  ← I/O callbacks bị defer từ vòng trước
│  idle, prepare               │  ← nội bộ
│           poll               │  ← nhận I/O events mới, chờ nếu cần
│           check              │  ← setImmediate callbacks
│      close callbacks         │  ← ví dụ: socket.on('close')
└──────────────────────────────┘
```

**Thứ tự ưu tiên:**

1. `process.nextTick()` — chạy TRƯỚC khi event loop tiếp tục (microtask queue)
2. `Promise.then()` — microtask queue
3. `setImmediate()` — phase Check
4. `setTimeout(fn, 0)` — phase Timers

```javascript
console.log('1')
setTimeout(() => console.log('setTimeout'), 0)
setImmediate(() => console.log('setImmediate'))
process.nextTick(() => console.log('nextTick'))
Promise.resolve().then(() => console.log('Promise'))
console.log('2')

// Output: 1 → 2 → nextTick → Promise → setTimeout → setImmediate
```

---

### Q3: NodeJS xử lý concurrency như thế nào khi chỉ có 1 thread?

**Trả lời:**
NodeJS có **1 main thread** nhưng libuv có **thread pool** (mặc định 4 threads) xử lý các blocking operations (file I/O, crypto, DNS lookup).

Các cách scale NodeJS:

1. **cluster module**: fork nhiều process, mỗi process = 1 CPU core
2. **worker_threads**: dùng cho CPU-intensive tasks trong cùng process
3. **PM2 cluster mode**: process manager tự động fork

```javascript
// cluster module example
const cluster = require('cluster')
const os = require('os')

if (cluster.isMaster) {
  const numCPUs = os.cpus().length
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
} else {
  require('./app') // worker chạy app
}
```

---

### Q4: Sự khác biệt giữa `require()` và `import` trong NodeJS?

**Trả lời:**

| Tiêu chí        | `require()` (CommonJS) | `import` (ES Modules)          |
| --------------- | ---------------------- | ------------------------------ |
| Loading         | Synchronous            | Asynchronous                   |
| Tree shaking    | Không hỗ trợ           | Hỗ trợ                         |
| Dynamic import  | `require(variable)`    | `import()` (dynamic)           |
| Top-level await | Không                  | Có                             |
| File extension  | `.js` (default)        | `.mjs` hoặc `"type": "module"` |

---

### Q5: Memory leak trong NodeJS là gì? Làm sao phát hiện và xử lý?

**Trả lời:**
Memory leak xảy ra khi bộ nhớ được cấp phát nhưng không được garbage collected.

**Nguyên nhân phổ biến:**

- Global variables không cần thiết
- Event listeners không được remove
- Closures giữ reference đến objects lớn
- Circular references
- setInterval không được clearInterval

**Cách phát hiện:**

```bash
# Profile với --inspect
node --inspect app.js
# Mở Chrome DevTools > Memory > Take Heap Snapshot
```

**Fix ví dụ:**

```javascript
// ❌ Sai - listener không được remove
emitter.on('data', handler)

// ✅ Đúng - remove khi không cần
emitter.on('data', handler)
// khi xong:
emitter.off('data', handler)
// hoặc dùng once:
emitter.once('data', handler)
```

---

## 2. Asynchronous Programming

### Q6: Giải thích callback hell và cách tránh?

**Trả lời:**
Callback hell (pyramid of doom) xảy ra khi nested callbacks quá sâu, khó đọc và debug.

```javascript
// ❌ Callback hell
getData(id, (err, user) => {
  getOrders(user.id, (err, orders) => {
    getProducts(orders[0].id, (err, product) => {
      saveLog(product, (err, result) => {
        // ... sâu hơn nữa
      })
    })
  })
})

// ✅ Giải pháp 1: Promises
getData(id)
  .then((user) => getOrders(user.id))
  .then((orders) => getProducts(orders[0].id))
  .then((product) => saveLog(product))
  .catch((err) => console.error(err))

// ✅ Giải pháp 2: async/await (tốt nhất)
async function process(id) {
  try {
    const user = await getData(id)
    const orders = await getOrders(user.id)
    const product = await getProducts(orders[0].id)
    const result = await saveLog(product)
    return result
  } catch (err) {
    console.error(err)
  }
}
```

---

### Q7: Promise.all vs Promise.allSettled vs Promise.race?

**Trả lời:**

```javascript
// Promise.all — chờ TẤT CẢ resolve, 1 reject là fail hết
const [user, orders, products] = await Promise.all([getUser(id), getOrders(id), getProducts()])

// Promise.allSettled — chờ TẤT CẢ hoàn thành, kể cả reject
const results = await Promise.allSettled([getUser(id), getOrders(id)])
results.forEach((result) => {
  if (result.status === 'fulfilled') console.log(result.value)
  else console.error(result.reason)
})

// Promise.race — lấy kết quả của promise NHANH NHẤT
const fastest = await Promise.race([fetchFromServer1(), fetchFromServer2()])

// Promise.any — lấy kết quả THÀNH CÔNG đầu tiên (khác race)
const first = await Promise.any([fetchFromPrimary(), fetchFromFallback()])
```

---

### Q8: Streams trong NodeJS là gì? Khi nào dùng?

**Trả lời:**
Streams xử lý dữ liệu theo từng chunk thay vì load toàn bộ vào memory — cực kỳ hiệu quả cho file lớn, video streaming, real-time data.

**4 loại Stream:**

- `Readable`: đọc dữ liệu (fs.createReadStream)
- `Writable`: ghi dữ liệu (fs.createWriteStream)
- `Duplex`: đọc và ghi (TCP socket)
- `Transform`: biến đổi dữ liệu khi đi qua (zlib compression)

```javascript
// ❌ Không dùng Stream — load toàn bộ file vào RAM
const data = fs.readFileSync('largefile.csv') // có thể OOM

// ✅ Dùng Stream — xử lý từng chunk
const readable = fs.createReadStream('largefile.csv')
const writable = fs.createWriteStream('output.csv')

readable
  .pipe(transform) // transform từng chunk
  .pipe(writable)

// Biết khi nào xong
writable.on('finish', () => console.log('Done'))
```

---

## 3. ExpressJS & KOA

### Q9: ExpressJS middleware là gì? Giải thích middleware pipeline.

**Trả lời:**
Middleware là functions có access vào `req`, `res`, `next` — có thể thực thi code, modify request/response, kết thúc cycle, hoặc chuyển sang middleware tiếp theo.

**Middleware pipeline:**

```
Request → [Logger MW] → [Auth MW] → [Validate MW] → [Route Handler] → Response
               ↓(next)        ↓(next)        ↓(next)
```

```javascript
// Custom middleware
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url} - ${Date.now()}`)
  next() // QUAN TRỌNG: phải gọi next() hoặc kết thúc request
}

// Error-handling middleware (4 arguments)
const errorHandler = (err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message })
}

app.use(logger)
app.use('/api', router)
app.use(errorHandler) // phải đặt CUỐI CÙNG
```

---

### Q10: So sánh ExpressJS và KOA. Khi nào chọn KOA?

**Trả lời:**

| Tiêu chí        | ExpressJS                                | KOA                          |
| --------------- | ---------------------------------------- | ---------------------------- |
| Tác giả         | TJ Holowaychuk                           | TJ Holowaychuk (rebuild)     |
| Async support   | Callback-based (có thể dùng async/await) | Native async/await từ đầu    |
| Middleware      | Cơ chế linear                            | Cơ chế "onion" (cascade)     |
| Built-in Router | Có                                       | Không (cần koa-router)       |
| Bundle size     | Nặng hơn                                 | Nhỏ hơn, modular             |
| Error handling  | try/catch trong mỗi route                | Centralized trong middleware |
| Ecosystem       | Lớn hơn, nhiều package                   | Nhỏ hơn                      |

**Chọn KOA khi:**

- Project mới cần clean async/await
- Muốn kiến trúc modular, tự chọn components
- Cần cascade middleware behavior

```javascript
// KOA middleware (onion model)
app.use(async (ctx, next) => {
  console.log('1 → trước')
  await next() // gọi middleware tiếp theo
  console.log('1 ← sau') // chạy SAU KHI middleware con xong
})

app.use(async (ctx, next) => {
  console.log('2 → trước')
  await next()
  console.log('2 ← sau')
})

// Output: 1→ 2→ 2← 1←   (onion layers)
```

---

### Q11: Làm sao handle errors trong Express đúng cách?

**Trả lời:**

```javascript
// Wrapper cho async routes (tránh viết try/catch ở mỗi route)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Custom Error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
  }
}

// Routes
router.get(
  '/user/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new AppError('User not found', 404)
    res.json(user)
  }),
)

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    status: 'error',
    message: err.isOperational ? err.message : 'Something went wrong',
  })
})
```

---

## 4. Queue & Xử Lý Đa Luồng

### Q12: Message Queue là gì? Khi nào cần dùng Queue trong backend?

**Trả lời:**
Message Queue là middleware cho phép các service giao tiếp bất đồng bộ. Producer gửi message vào queue, Consumer xử lý theo tốc độ của nó.

**Use cases cần Queue:**

- Gửi email/SMS sau khi đặt hàng (không cần block response)
- Xử lý ảnh/video upload (time-consuming)
- Distributed systems — service A giao việc cho service B
- Rate limiting và throttling
- Retry logic khi external service down

**Các Queue systems phổ biến:**

- **BullMQ** (Redis-based, phổ biến với NodeJS)
- **RabbitMQ** (AMQP protocol)
- **Apache Kafka** (high-throughput event streaming)
- **AWS SQS** (managed queue)

```javascript
// BullMQ example với Redis
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis()

// Producer — thêm job vào queue
const emailQueue = new Queue('email', { connection })

await emailQueue.add(
  'sendWelcome',
  {
    to: 'user@example.com',
    subject: 'Welcome!',
  },
  {
    attempts: 3, // retry 3 lần nếu fail
    backoff: { type: 'exponential', delay: 1000 },
  },
)

// Consumer/Worker — xử lý job
const worker = new Worker(
  'email',
  async (job) => {
    await sendEmail(job.data.to, job.data.subject)
  },
  { connection, concurrency: 5 },
)

worker.on('completed', (job) => console.log(`Job ${job.id} done`))
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed: ${err.message}`))
```

---

### Q13: Worker Threads vs Cluster trong NodeJS — khác nhau như thế nào?

**Trả lời:**

| Tiêu chí      | `cluster`                   | `worker_threads`                          |
| ------------- | --------------------------- | ----------------------------------------- |
| Mục đích      | Scale theo số CPU cores     | CPU-intensive tasks                       |
| Bộ nhớ        | Mỗi process có memory riêng | Shared memory (SharedArrayBuffer)         |
| Communication | IPC (inter-process)         | MessageChannel, SharedArrayBuffer         |
| Overhead      | Cao hơn (tạo process)       | Thấp hơn (tạo thread)                     |
| Use case      | HTTP server scaling         | Image processing, crypto, data processing |

```javascript
// worker_threads cho CPU-intensive task
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

if (isMainThread) {
  // Main thread — gửi task cho worker
  const worker = new Worker(__filename, {
    workerData: { array: [1, 2, 3, 4, 5, ...largeArray] },
  })
  worker.on('message', (result) => console.log('Result:', result))
} else {
  // Worker thread — xử lý CPU-heavy task
  const result = workerData.array.reduce((sum, n) => sum + n, 0)
  parentPort.postMessage(result)
}
```

---

### Q14: Làm sao limit concurrency khi xử lý nhiều async tasks?

**Trả lời:**

```javascript
// Ví dụ: process 1000 items nhưng chỉ 10 tại một lúc
async function processWithConcurrencyLimit(items, limit, processor) {
  const results = []
  const executing = []

  for (const item of items) {
    const promise = processor(item).then((result) => {
      executing.splice(executing.indexOf(promise), 1)
      return result
    })

    results.push(promise)
    executing.push(promise)

    if (executing.length >= limit) {
      await Promise.race(executing) // chờ 1 trong số đang chạy xong
    }
  }

  return Promise.all(results)
}

// Sử dụng
await processWithConcurrencyLimit(userIds, 10, async (id) => {
  return await sendNotification(id)
})
```

---

## 5. Cơ Sở Dữ Liệu: SQL vs NoSQL

### Q15: Khi nào dùng SQL (PostgreSQL) và khi nào dùng NoSQL (MongoDB)?

**Trả lời:**

**Chọn SQL (PostgreSQL) khi:**

- Dữ liệu có cấu trúc rõ ràng, relationships phức tạp
- Cần ACID transactions (banking, e-commerce orders)
- Cần complex queries với JOINs
- Data integrity quan trọng

**Chọn NoSQL (MongoDB) khi:**

- Schema flexible, hay thay đổi
- Horizontal scaling dễ dàng
- Document-based data (blog posts, product catalogs)
- High write throughput

**Ví dụ thực tế (e-commerce):**

- `users`, `orders`, `payments` → PostgreSQL (ACID, relationships)
- `product_catalog`, `user_sessions`, `logs` → MongoDB (flexible schema)
- `cart`, `real-time stock` → Redis (fast, in-memory)

---

### Q16: N+1 problem là gì và cách fix?

**Trả lời:**
N+1 problem: query 1 lần lấy N records, rồi query thêm N lần để lấy related data.

```javascript
// ❌ N+1 problem
const orders = await Order.find({}) // 1 query → 100 orders
for (const order of orders) {
  order.user = await User.findById(order.userId) // 100 queries!
}
// Total: 101 queries

// ✅ Fix với populate (MongoDB/Mongoose)
const orders = await Order.find({}).populate('userId') // 2 queries

// ✅ Fix với JOIN (SQL/TypeORM)
const orders = await orderRepo.find({
  relations: ['user'], // 1 query với JOIN
})

// ✅ Fix với DataLoader (GraphQL)
const userLoader = new DataLoader(async (userIds) => {
  const users = await User.find({ _id: { $in: userIds } }) // 1 batch query
  return userIds.map((id) => users.find((u) => u.id === id))
})
```

---

## 6. PostgreSQL

### Q17: Index trong PostgreSQL hoạt động như thế nào? Khi nào nên tạo index?

**Trả lời:**
Index là cấu trúc dữ liệu phụ (B-tree mặc định) giúp tăng tốc queries.

**Nên tạo index khi:**

- Cột thường xuyên xuất hiện trong WHERE, JOIN, ORDER BY
- Cột có high cardinality (nhiều giá trị unique)

**Không nên tạo index khi:**

- Bảng nhỏ
- Cột thường xuyên UPDATE/INSERT (index làm chậm write)
- Low cardinality columns (boolean, status với ít giá trị)

```sql
-- Single column index
CREATE INDEX idx_users_email ON users(email);

-- Composite index (thứ tự cột quan trọng!)
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- Partial index (tiết kiệm space)
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- Check index usage
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@test.com';
```

---

### Q18: Transaction trong PostgreSQL là gì? ACID là gì?

**Trả lời:**
Transaction là nhóm operations được thực thi như một đơn vị — tất cả thành công hoặc tất cả rollback.

**ACID:**

- **A**tomicity: Tất cả hoặc không có gì
- **C**onsistency: DB luôn ở trạng thái hợp lệ
- **I**solation: Transactions không ảnh hưởng lẫn nhau
- **D**urability: Sau commit, data được lưu vĩnh viễn

```javascript
// Transaction với node-postgres
const client = await pool.connect()
try {
  await client.query('BEGIN')

  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromAccountId])
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toAccountId])

  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
}
```

---

## 7. MongoDB

### Q19: Aggregation Pipeline trong MongoDB là gì?

**Trả lời:**
Aggregation pipeline xử lý documents qua nhiều stages, mỗi stage transform data.

```javascript
// Tính tổng doanh thu theo tháng
const revenue = await Order.aggregate([
  // Stage 1: Filter
  {
    $match: {
      status: 'completed',
      createdAt: { $gte: new Date('2024-01-01') },
    },
  },

  // Stage 2: Group
  {
    $group: {
      _id: { $month: '$createdAt' },
      totalRevenue: { $sum: '$totalAmount' },
      orderCount: { $count: {} },
    },
  },

  // Stage 3: Sort
  { $sort: { _id: 1 } },

  // Stage 4: Project (chọn fields output)
  {
    $project: {
      month: '$_id',
      totalRevenue: 1,
      orderCount: 1,
      _id: 0,
    },
  },
])
```

---

### Q20: Indexing trong MongoDB và khi nào dùng?

**Trả lời:**

```javascript
// Single field index
db.users.createIndex({ email: 1 }) // 1 = ascending

// Compound index
db.orders.createIndex({ userId: 1, createdAt: -1 })

// Text index (full-text search)
db.products.createIndex({ name: 'text', description: 'text' })

// TTL index (auto-delete sau N giây)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

// Wildcard index
db.products.createIndex({ 'metadata.$**': 1 })

// Explain để check index
db.orders.find({ userId: '123' }).explain('executionStats')
```

---

## 8. Redis

### Q21: Redis là gì? Những use case phổ biến trong NodeJS backend?

**Trả lời:**
Redis là in-memory data store, sử dụng như cache, session store, message broker, rate limiter.

**Use cases:**

1. **Caching** — giảm load DB
2. **Session storage** — lưu user sessions
3. **Rate limiting** — giới hạn API calls
4. **Job queues** — BullMQ chạy trên Redis
5. **Real-time features** — Pub/Sub, leaderboards
6. **Distributed locks** — tránh race conditions

```javascript
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// Cache-aside pattern
async function getUserWithCache(userId) {
  const cacheKey = `user:${userId}`

  // 1. Check cache
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // 2. Cache miss → query DB
  const user = await User.findById(userId)

  // 3. Save to cache (TTL = 1 giờ)
  await redis.setEx(cacheKey, 3600, JSON.stringify(user))

  return user
}

// Rate limiter với sliding window
async function rateLimit(userId, limit = 100, windowSeconds = 60) {
  const key = `rate:${userId}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  return count <= limit
}
```

---

### Q22: Redis Pub/Sub là gì? Ứng dụng thực tế?

**Trả lời:**
Pub/Sub là pattern messaging: Publisher gửi message vào channel, Subscriber lắng nghe channel đó.

```javascript
// Publisher (ví dụ: khi có order mới)
const publisher = createClient()
await publisher.connect()

await publisher.publish(
  'order:created',
  JSON.stringify({
    orderId: '123',
    userId: 'user456',
    total: 150000,
  }),
)

// Subscriber (ví dụ: notification service)
const subscriber = createClient()
await subscriber.connect()

await subscriber.subscribe('order:created', (message) => {
  const order = JSON.parse(message)
  sendOrderConfirmationEmail(order)
  sendSMS(order)
})
```

---

## 9. Firebase

### Q23: Firebase Realtime Database vs Firestore — khác nhau như thế nào?

**Trả lời:**

| Tiêu chí        | Realtime Database      | Firestore                    |
| --------------- | ---------------------- | ---------------------------- |
| Data model      | JSON tree              | Document/Collection          |
| Queries         | Hạn chế                | Phong phú hơn                |
| Offline support | Có                     | Có                           |
| Scalability     | Hạn chế                | Tốt hơn                      |
| Pricing         | Data transfer          | Read/Write/Delete ops        |
| Use case        | Simple real-time, chat | Complex queries, large scale |

```javascript
// Firestore với NodeJS Admin SDK
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp()
const db = getFirestore()

// Real-time listener
const unsubscribe = db
  .collection('orders')
  .where('status', '==', 'pending')
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log('New order:', change.doc.data())
        processNewOrder(change.doc.data())
      }
    })
  })
```

---

## 10. RESTful API & SSL/HTTPS

### Q24: Giải thích REST principles. Sự khác biệt giữa PUT và PATCH?

**Trả lời:**
**REST (Representational State Transfer)** — 6 nguyên tắc:

1. **Client-Server**: tách biệt UI và data storage
2. **Stateless**: mỗi request chứa đủ thông tin, server không lưu state
3. **Cacheable**: responses nên có cache headers
4. **Uniform Interface**: resource identifier + standard methods
5. **Layered System**: client không biết nó connect trực tiếp hay qua proxy
6. **Code on Demand** (optional): server có thể gửi executable code

**PUT vs PATCH:**

```
PUT /users/123
Body: { "name": "John", "email": "john@test.com", "age": 25 }
→ Replace TOÀN BỘ resource (thiếu field = null)

PATCH /users/123
Body: { "email": "newemail@test.com" }
→ Update CHỈ các fields được gửi
```

**HTTP Status Codes cần biết:**

- `200 OK` — thành công
- `201 Created` — tạo resource mới
- `204 No Content` — thành công nhưng không có body (DELETE)
- `400 Bad Request` — request sai format
- `401 Unauthorized` — chưa authenticate
- `403 Forbidden` — đã authenticate nhưng không có quyền
- `404 Not Found` — không tìm thấy resource
- `409 Conflict` — conflict với state hiện tại (duplicate)
- `422 Unprocessable Entity` — validation error
- `429 Too Many Requests` — rate limit
- `500 Internal Server Error` — lỗi server

---

### Q25: SSL/TLS hoạt động như thế nào? HTTPS khác HTTP như thế nào?

**Trả lời:**
SSL/TLS tạo **encrypted tunnel** giữa client và server.

**TLS Handshake process:**

```
Client                          Server
  |                               |
  |--- ClientHello (TLS version,  |
  |    cipher suites, random) --->|
  |                               |
  |<-- ServerHello (chosen cipher,|
  |    certificate) --------------|
  |                               |
  |--- Verify certificate         |
  |--- Generate pre-master secret |
  |    (encrypted với server key)->|
  |                               |
  |<---- Finished (session keys) -|
  |                               |
  |===== Encrypted Data =========|
```

**NodeJS HTTPS server:**

```javascript
import https from 'https'
import fs from 'fs'

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
}

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS server running on port 443')
})
```

---

### Q26: JWT là gì? Làm sao implement authentication với JWT?

**Trả lời:**
JWT (JSON Web Token) gồm 3 phần: `header.payload.signature`, được base64 encoded.

```javascript
import jwt from 'jsonwebtoken'

// Tạo token khi login
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }, // access token ngắn
  )

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }, // refresh token dài hơn
  )

  return { accessToken, refreshToken }
}

// Middleware verify token
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'No token' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

---

## 11. Docker & Deployment

### Q27: Docker là gì? Image vs Container?

**Trả lời:**

- **Image**: Blueprint read-only, chứa OS + dependencies + app code
- **Container**: Instance đang chạy của image, isolated

**Viết Dockerfile tốt cho NodeJS:**

```dockerfile
# Multi-stage build để giảm image size
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS production
# Security: không chạy root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Không copy development files
RUN rm -rf tests/ .env.example

USER appuser
EXPOSE 3000

CMD ["node", "dist/main.js"]
```

---

### Q28: Docker Compose là gì? Viết docker-compose cho NodeJS app?

**Trả lời:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

### Q29: Làm sao handle zero-downtime deployment?

**Trả lời:**
Các strategies:

1. **Rolling update**: thay dần containers mới, giữ một số containers cũ
2. **Blue-Green**: chạy 2 environments, switch traffic ngay lập tức
3. **Canary**: route một phần nhỏ traffic đến version mới

```javascript
// Graceful shutdown trong NodeJS — QUAN TRỌNG cho zero-downtime
const server = app.listen(3000)

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')

  // 1. Stop accepting new connections
  server.close(async () => {
    // 2. Finish current requests
    // 3. Close DB connections
    await db.close()
    await redis.quit()

    console.log('Shutdown complete')
    process.exit(0)
  })

  // Force exit after 30s
  setTimeout(() => process.exit(1), 30000)
})
```

---

## 12. Thiết Kế Cấu Trúc Dữ Liệu & System Design

### Q30: Thiết kế schema cho hệ thống e-commerce. Bạn sẽ làm như thế nào?

**Trả lời:**
Đây là câu hỏi system design — cần thảo luận trade-offs.

**PostgreSQL tables:**

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  category_id UUID REFERENCES categories(id)
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, shipped, delivered
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL  -- snapshot giá lúc mua
);
```

**Redis usage:**

```
user:session:{token}    → session data (TTL: 24h)
cart:{userId}           → shopping cart (Hash)
product:stock:{id}      → real-time stock (DECR khi order)
rate:api:{userId}       → rate limiting (INCR + TTL)
```

---

### Q31: Làm sao xử lý race condition khi nhiều user cùng mua sản phẩm cuối cùng?

**Trả lời:**
Đây là câu hỏi thực tế quan trọng với e-commerce.

```javascript
// ❌ Sai — race condition
async function buyProduct(productId, userId) {
  const product = await Product.findById(productId)
  if (product.stock > 0) {
    await Product.update({ stock: product.stock - 1 }) // 2 users có thể pass check!
    await Order.create({ productId, userId })
  }
}

// ✅ Fix 1: Pessimistic locking (SQL)
async function buyProduct(productId, userId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // SELECT FOR UPDATE — lock row, chặn concurrent reads
    const { rows } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId])
    const product = rows[0]
    if (product.stock <= 0) throw new Error('Out of stock')
    await client.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [productId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

// ✅ Fix 2: Optimistic locking với version
await Product.update(
  { stock: sequelize.literal('stock - 1'), version: product.version + 1 },
  { where: { id: productId, version: product.version, stock: { $gt: 0 } } },
)

// ✅ Fix 3: Redis atomic operation
const stock = await redis.decr(`product:stock:${productId}`)
if (stock < 0) {
  await redis.incr(`product:stock:${productId}`) // rollback
  throw new Error('Out of stock')
}
```

---

## 13. Blockchain & Bitcoin

### Q32: Blockchain là gì? Giải thích cơ bản về cơ chế hoạt động?

**Trả lời:**
Blockchain là chuỗi các blocks, mỗi block chứa data + hash của block trước → immutable, transparent, decentralized.

**Key concepts:**

- **Hash**: SHA-256 digest, bất kỳ thay đổi nhỏ nào đều tạo hash khác
- **Block**: gồm index + timestamp + transactions + previousHash + hash
- **Chain**: mỗi block link với block trước qua previousHash
- **Consensus**: Proof of Work (Bitcoin), Proof of Stake (Ethereum 2.0)
- **Smart Contract**: code tự thực thi trên blockchain

```javascript
// Đơn giản hóa cách block hoạt động
import crypto from 'crypto'

class Block {
  constructor(index, data, previousHash) {
    this.index = index
    this.timestamp = Date.now()
    this.data = data
    this.previousHash = previousHash
    this.hash = this.calculateHash()
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash)
      .digest('hex')
  }
}

// Bất kỳ thay đổi nào → hash thay đổi → chain invalid
```

---

### Q33: Tích hợp Bitcoin/crypto payments vào NodeJS như thế nào?

**Trả lời:**

```javascript
// Sử dụng Web3.js cho Ethereum
import Web3 from 'web3'

const web3 = new Web3(process.env.INFURA_URL)

// Kiểm tra transaction đã được confirm chưa
async function verifyPayment(txHash, expectedAmount) {
  const tx = await web3.eth.getTransaction(txHash)
  const receipt = await web3.eth.getTransactionReceipt(txHash)

  // Kiểm tra: đúng địa chỉ nhận, đủ số tiền, đã confirm
  const isValid =
    receipt.status &&
    tx.to.toLowerCase() === WALLET_ADDRESS.toLowerCase() &&
    BigInt(tx.value) >= BigInt(web3.utils.toWei(expectedAmount, 'ether'))

  return isValid
}

// Bitcoin với bitcoinjs-lib
import * as bitcoin from 'bitcoinjs-lib'

function generateBitcoinAddress() {
  const keyPair = bitcoin.ECPair.makeRandom()
  const { address } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
  })
  return { address, privateKey: keyPair.toWIF() }
}
```

---

## 14. Security Best Practices

### Q34: Các lỗ hổng bảo mật phổ biến trong NodeJS và cách phòng tránh?

**Trả lời:**

**1. SQL Injection:**

```javascript
// ❌ Sai
const query = `SELECT * FROM users WHERE email = '${email}'`

// ✅ Đúng — parameterized query
const query = 'SELECT * FROM users WHERE email = $1'
await db.query(query, [email])
```

**2. NoSQL Injection (MongoDB):**

```javascript
// ❌ Sai
const user = await User.findOne({ email: req.body.email })
// Attacker gửi: { "email": { "$gt": "" } } → bypass!

// ✅ Đúng — validate input
import { isEmail } from 'validator'
if (!isEmail(req.body.email)) throw new Error('Invalid email')
```

**3. XSS Prevention:**

```javascript
import helmet from 'helmet'
app.use(helmet()) // sets security headers bao gồm CSP
```

**4. Rate Limiting:**

```javascript
import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 attempts
  message: 'Too many login attempts',
})

app.post('/auth/login', loginLimiter, loginController)
```

**5. Environment variables:**

```javascript
// KHÔNG bao giờ hardcode secrets
// ❌ const SECRET = 'my-super-secret-key';
// ✅ const SECRET = process.env.JWT_SECRET;
```

---

## 15. GitHub, Git Workflow, JIRA, Bitbucket

### Q35: Git workflow bạn thường dùng trong team?

**Trả lời:**
**Gitflow workflow** (phổ biến):

```
main (production)
  └── develop (staging)
        ├── feature/user-authentication
        ├── feature/payment-integration
        └── hotfix/fix-login-bug → merge vào cả main và develop
```

**GitHub Flow** (đơn giản hơn, CI/CD friendly):

```
main
  ├── feature/add-search
  ├── fix/cart-bug
  └── chore/update-deps
```

**Conventional Commits:**

```bash
feat: add user authentication
fix: resolve cart item count bug
docs: update API documentation
refactor: optimize database queries
test: add unit tests for auth service
chore: update dependencies
```

---

### Q36: Code review process — bạn review code như thế nào?

**Trả lời:**

- Kiểm tra logic correctness trước
- Security issues (SQL injection, auth bypass, data exposure)
- Performance (N+1 queries, missing indexes, memory leaks)
- Error handling (edge cases, unhandled promises)
- Code style và naming conventions
- Tests coverage

**JIRA workflow tiêu chuẩn:**

```
Backlog → In Progress → Code Review → Testing → Done
```

---

## 16. Câu Hỏi Tình Huống Thực Tế

### Q37: "API của bạn đang bị chậm, bạn sẽ debug như thế nào?"

**Trả lời (structured approach):**

```
1. MEASURE — xác định chính xác bottleneck
   → New Relic / Datadog / console.time()
   → Xác định: DB query? External API? CPU? Memory?

2. PROFILE
   → node --prof app.js → phân tích CPU usage
   → EXPLAIN ANALYZE cho SQL queries chậm

3. FIX theo bottleneck tìm được:
   → N+1 query → eager loading / DataLoader
   → Missing index → CREATE INDEX
   → No caching → Redis cache-aside
   → Sync blocking → async/stream
   → Large payload → pagination / compression
```

---

### Q38: "Làm sao thiết kế hệ thống notification realtime cho 100K users?"

**Trả lời:**

```
Architecture:
┌─────────┐     ┌──────────┐     ┌─────────┐
│  Client │<──> │   Load   │<──> │  App    │
│(WebSocket│     │ Balancer │     │ Servers │
│ /SSE)   │     └──────────┘     └────┬────┘
└─────────┘                           │
                                  ┌───▼────┐
                               ┌──┤ Redis  ├──┐
                               │  │Pub/Sub │  │
                               │  └────────┘  │
                            Server1         Server2

Flow:
1. Client connect WebSocket đến App Server
2. Redis lưu: userId → serverId mapping
3. Khi có event → publish vào Redis channel
4. Mỗi App Server subscribe → push đến connected clients
```

```javascript
// WebSocket với Redis Pub/Sub
import { WebSocketServer } from 'ws'
import { createClient } from 'redis'

const wss = new WebSocketServer({ port: 8080 })
const connections = new Map() // userId → ws

const sub = createClient()
await sub.connect()

// Subscribe to notifications channel
await sub.subscribe('notifications', (message) => {
  const { userId, data } = JSON.parse(message)
  const ws = connections.get(userId)
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
})

wss.on('connection', (ws, req) => {
  const userId = extractUserIdFromToken(req)
  connections.set(userId, ws)

  ws.on('close', () => connections.delete(userId))
})
```

---

### Q39: "Bạn xử lý lỗi uncaught exception trong production như thế nào?"

**Trả lời:**

```javascript
// Phân loại errors
// Operational errors: có thể predict (DB timeout, validation fail) → handle gracefully
// Programmer errors: bugs, logic errors → crash process, let PM2 restart

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
  // Log to monitoring (Sentry, Datadog)
  logger.fatal({ err }, 'Uncaught exception - process will exit')
  // Graceful shutdown
  process.exit(1) // PM2 sẽ restart
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason)
  // Trong production: crash và restart
  throw reason
})

// PM2 ecosystem.config.js để auto-restart
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/main.js',
      instances: 'max', // cluster mode
      exec_mode: 'cluster',
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
}
```

---

## Tips Phỏng Vấn Cuối Cùng

### Cấu trúc trả lời kỹ thuật (STAR method cho tech):

1. **Situation**: giải thích vấn đề/context
2. **Technical concept**: giải thích theory
3. **Code example**: minh họa bằng code cụ thể
4. **Trade-offs**: nêu ưu/nhược điểm
5. **Real-world experience**: kể về dự án đã làm nếu có

### Từ khóa thường xuất hiện trong câu hỏi Middle level:

- "Tại sao" → giải thích cơ chế bên dưới
- "So sánh" → biết trade-offs
- "Khi nào" → biết chọn đúng tool cho đúng use case
- "Làm sao xử lý" → practical problem solving
- "Thiết kế" → system design thinking

### Checklist chuẩn bị:

- [x] Event Loop & async patterns
- [x] Express middleware chain
- [x] Database indexing & query optimization
- [x] Redis caching patterns
- [x] Docker basics & Dockerfile
- [x] JWT authentication flow
- [x] REST best practices
- [x] Git workflow
- [x] Một system design scenario (e-commerce / chat / notification)

---

_Tài liệu được tổng hợp dựa trên research từ InterviewBit, GeeksforGeeks, Turing, CoderPad và yêu cầu tuyển dụng thực tế — April 2026_
