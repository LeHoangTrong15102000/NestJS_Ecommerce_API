### Tại sao đặt Message Queue giữa Database và Redis Cache?

Phân tích pattern **Cache Invalidation via Message Queue** — mô hình mà các Tech Lead tại các hệ thống lớn (Shopee, Tiki, Lazada, ...) thường áp dụng để giữ dữ liệu nhất quán giữa Database và Redis Cache khi có nhiều service, nhiều instance cùng đọc/ghi.

> Tài liệu này bổ sung cho [ZZ_42_ARCH_MQ_RABBITMQ_KAFKA_DECISION_AND_PLAN.md](./ZZ_42_ARCH_MQ_RABBITMQ_KAFKA_DECISION_AND_PLAN.md), đi sâu vào **một use case cụ thể**: vai trò của MQ trong việc đồng bộ Cache.

---

## 1) Đọc hiểu flow trong hình minh họa

Hình minh họa thể hiện pattern **Write-Behind Cache Invalidation** với 2 actor:

- **CR7** = Writer (người ghi dữ liệu)
- **M10** = Reader (người đọc dữ liệu)
- **MySQL** = Database chính (source of truth)
- **Redis** = Cache layer
- **Ký hiệu ở giữa MySQL và Redis** = Message Queue (RabbitMQ / Kafka / internal pub-sub)

### Flow từng bước:

```
CR7 (Writer)                          M10 (Reader)
    │                                      │
    │ 1. set db (CR7)                      │
    │────────────────► MySQL               │
    │                    │                 │
    │ 2. del cache       │                 │
    │────────────────► Redis               │
    │                    │                 │ 3. miss cache
    │                    │                 │──────────► Redis (MISS!)
    │                    │                 │
    │                    │   ┌─────────┐   │ 4. read db
    │                    │   │   MQ    │   │──────────► MySQL
    │                    │   │ (giữa   │   │
    │                    │   │ DB và   │   │
    │                    │   │ Redis)  │   │ 5. set cache (CR7)
    │                    │   └─────────┘   │──────────► Redis (SET mới)
    │                    │                 │
```

**Diễn giải:**

| Bước | Hành động | Actor | Mục đích |
|---|---|---|---|
| 1 | `set db (CR7)` | CR7 → MySQL | Ghi dữ liệu mới vào DB |
| 2 | `del cache` | CR7 → Redis | Xóa cache cũ (invalidate) |
| 3 | `miss cache` | M10 → Redis | M10 đọc cache → không có (vì CR7 vừa xóa) |
| 4 | `read db` | M10 → MySQL | Đọc DB để lấy dữ liệu mới nhất |
| 5 | `set cache (CR7)` | M10 → Redis | Cache lại dữ liệu mới đọc được |

Nhưng flow trên là **lý tưởng**. Thực tế ở hệ thống lớn, nó sẽ gặp rất nhiều race condition.

---

## 2) Vấn đề: Tại sao "del cache rồi read db" đơn giản không đủ?

### Race condition cơ bản (Cache Inconsistency)

```
Timeline:

T1  CR7: UPDATE MySQL SET name = "Ronaldo"
T2  CR7: DEL Redis key "user:7"
T3  M10: GET Redis key "user:7"  → MISS
T4  M10: SELECT FROM MySQL       → "Ronaldo" ✅
T5  M10: SET Redis key "user:7"  → "Ronaldo" ✅
```

Trường hợp trên hoạt động tốt. Nhưng xem trường hợp **concurrent write + read**:

```
Timeline (race condition):

T1  CR7: UPDATE MySQL SET name = "Ronaldo"
T2  M10: GET Redis key "user:7"  → "Messi" (cache cũ, chưa bị del)
T3  CR7: DEL Redis key "user:7"
T4  ---  (M10 đã nhận "Messi" — dữ liệu cũ, sai!) ---
```

Hoặc tệ hơn — **double write race**:

```
Timeline (double write):

T1  CR7: UPDATE MySQL SET name = "Ronaldo"
T2  CR7: DEL Redis key "user:7"
T3  Neymar: UPDATE MySQL SET name = "Neymar"
T4  M10: SELECT FROM MySQL → "Neymar"
T5  M10: SET Redis key "user:7" → "Neymar"
T6  Neymar: DEL Redis key "user:7"
T7  Old reader: SET Redis key "user:7" → "Ronaldo" ← !!!SAI!!!
```

**Kết quả**: Redis chứa "Ronaldo" nhưng MySQL đã là "Neymar". Cache không nhất quán.

### Vấn đề lớn hơn trong hệ thống phân tán

| Vấn đề | Mô tả |
|---|---|
| **Nhiều instance** cùng ghi | 3 pod của Order Service cùng update DB, mỗi pod del cache riêng → race condition |
| **Cross-service** | Payment Service update trạng thái → Order Service cần invalidate cache Order → không biết khi nào |
| **Network latency** | Del cache thất bại (Redis timeout) nhưng DB đã commit → cache stale vĩnh viễn |
| **Retry gây duplicate** | Del cache retry → del nhầm cache mới vừa được set bởi reader khác |
| **Không có ordering** | Không đảm bảo thứ tự del cache giữa các writer → cache cuối cùng có thể chứa data cũ |

---

## 3) Giải pháp: Đặt Message Queue giữa Database và Cache

Đây là pattern mà trong hình thể hiện — **MQ ngồi giữa MySQL và Redis**. Thay vì service trực tiếp del/set cache, service **ghi một message vào MQ**, và một **Cache Worker** chuyên trách nhận message đó rồi xử lý cache.

### Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────────┐
│                         Application Services                      │
│   (Order, Payment, Inventory, Product, ...)                       │
│                                                                   │
│   Khi write DB:                                                   │
│   1. BEGIN TRANSACTION                                            │
│   2. UPDATE table SET ...                                         │
│   3. INSERT INTO Outbox (event)        ← ghi event cùng TX       │
│   4. COMMIT                                                       │
│                                                                   │
│   KHÔNG trực tiếp del/set Redis cache                             │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Message Queue                               │
│                  (RabbitMQ / Kafka / NATS)                          │
│                                                                    │
│   Queue/Topic: cache.invalidation                                  │
│   Message: { entity: "user", id: "7", action: "update", v: 42 }   │
│                                                                    │
│   Đảm bảo:                                                        │
│   ✓ Ordering (FIFO per partition/queue)                            │
│   ✓ At-least-once delivery                                        │
│   ✓ Persistence (không mất message)                                │
│   ✓ Retry nếu consumer fail                                       │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Cache Worker (Consumer)                       │
│                                                                    │
│   Nhận message → xử lý cache:                                     │
│                                                                    │
│   Option A: DEL Redis key (invalidate — let reader re-fill)       │
│   Option B: READ DB → SET Redis key (refresh — proactive fill)    │
│   Option C: DEL + SET with version check (idempotent refresh)     │
│                                                                    │
│   Đảm bảo:                                                        │
│   ✓ Xử lý tuần tự theo entity (tránh race)                       │
│   ✓ Idempotent (cùng message xử lý 2 lần không sai)              │
│   ✓ Version check (chỉ update cache nếu version >= current)       │
└────────────────────────────────────────────────────────────────────┘
```

### Tại sao pattern này giải quyết được vấn đề?

| Vấn đề | Giải pháp qua MQ |
|---|---|
| Race condition giữa nhiều writer | MQ đảm bảo **ordering** — message xử lý tuần tự theo entity |
| Cross-service invalidation | Service A publish event → Cache Worker invalidate → tất cả service hưởng cache mới |
| Del cache thất bại | MQ có **retry** — message không mất, sẽ được xử lý lại |
| Duplicate del | **Idempotent consumer** — dùng version/timestamp, del 2 lần không sao |
| Không biết cache nào cần invalidate | Event mang đầy đủ thông tin: entity, id, action → Cache Worker biết chính xác |

---

## 4) Ba chiến lược Cache Invalidation qua MQ

### Chiến lược A: Delete-only (Lazy Invalidation)

```
Writer: UPDATE DB → Publish event → MQ
Cache Worker: Nhận event → DEL Redis key
Reader: GET Redis → MISS → READ DB → SET Redis
```

**Ưu điểm**: Đơn giản nhất, cache chỉ chứa data khi có reader thật sự cần.
**Nhược điểm**: Reader đầu tiên sau invalidation phải chịu latency (cache miss + DB read).
**Phù hợp**: Data không hot (ít đọc), hoặc chấp nhận occasional latency spike.

### Chiến lược B: Refresh-through (Proactive Rebuild)

```
Writer: UPDATE DB → Publish event → MQ
Cache Worker: Nhận event → READ DB (data mới) → SET Redis key
Reader: GET Redis → HIT (data mới, đã được worker refresh)
```

**Ưu điểm**: Reader luôn hit cache, không bao giờ phải đợi.
**Nhược điểm**: Cache Worker đọc DB thêm (nhưng chỉ 1 lần per event thay vì N reader đọc).
**Phù hợp**: Data hot (đọc nhiều) — product detail, user profile, SKU stock.

### Chiến lược C: Versioned Refresh (Idempotent + Conflict-free)

```
Writer: UPDATE DB (version++) → Publish event { id, version: 42 } → MQ
Cache Worker: Nhận event →
  1. GET Redis key → check current version
  2. Nếu cached_version >= 42 → SKIP (đã mới hơn)
  3. Nếu cached_version < 42 → READ DB → SET Redis { data, version: 42 }
```

**Ưu điểm**: Giải quyết hoàn toàn race condition và duplicate processing.
**Nhược điểm**: Cần version field trong DB và cache.
**Phù hợp**: Data critical có nhiều writer concurrent — order status, payment state, stock count.

### So sánh 3 chiến lược

| Tiêu chí | A: Delete-only | B: Refresh-through | C: Versioned Refresh |
|---|---|---|---|
| Độ phức tạp | Thấp | Trung bình | Cao |
| Cache hit rate sau write | Thấp (miss lần đầu) | Cao (luôn hit) | Cao (luôn hit) |
| Race condition safe | Không hoàn toàn | Có thể race | An toàn hoàn toàn |
| Idempotent | Có (del idempotent) | Không (có thể set data cũ) | Có (version check) |
| Phù hợp cho | Data ít đọc | Data hot đọc nhiều | Data critical + hot |

---

## 5) Áp dụng vào dự án NestJS Ecommerce

### Mapping chiến lược theo domain

| Domain | Data pattern | Chiến lược | Lý do |
|---|---|---|---|
| **Product detail** | Đọc cực nhiều, ghi ít | B: Refresh-through | Hot data — proactive rebuild giữ cache luôn warm |
| **SKU stock** | Đọc nhiều, ghi nhiều (concurrent) | C: Versioned Refresh | Race condition cao khi flash sale — cần version check |
| **Order status** | Đọc nhiều, state machine | C: Versioned Refresh | State thay đổi qua nhiều bước — cần ordering + version |
| **User profile** | Đọc nhiều, ghi ít | A: Delete-only | Ít ghi, chấp nhận 1 miss sau update |
| **Cart** | Đọc/ghi cân bằng, per-user | A: Delete-only | Dữ liệu per-user, ít concurrent write |
| **Category/Brand** | Gần như static | A: Delete-only | Hiếm khi thay đổi |
| **Review rating** | Aggregated, eventual OK | B: Refresh-through | Rebuild aggregate score, chấp nhận delay nhỏ |
| **Flash sale price** | Đọc cực nhiều, timing critical | C: Versioned Refresh | Consistency quan trọng — giá sai = thiệt hại tiền |

### Flow cụ thể: SKU Stock trong Flash Sale

Đây là case phức tạp nhất — minh họa tại sao cần MQ giữa DB và Cache:

```
Flash Sale bắt đầu: 1000 user đồng thời mua cùng 1 sản phẩm

Không có MQ (cách cũ — race condition):
─────────────────────────────────────────
User1: UPDATE stock=99 → DEL cache
User2: UPDATE stock=98 → DEL cache
User3: SELECT stock → 98 → SET cache=98
User1: (slow reader) SELECT stock → 99 → SET cache=99 ← SAI!!! DB=98 nhưng cache=99

Có MQ (Versioned Refresh):
────────────────────────────
User1: UPDATE stock=99, version=2 → Outbox { sku:1, stock:99, v:2 } → MQ
User2: UPDATE stock=98, version=3 → Outbox { sku:1, stock:98, v:3 } → MQ
Cache Worker:
  Nhận v:2 → check cache version=1 < 2 → SET cache { stock:99, v:2 }
  Nhận v:3 → check cache version=2 < 3 → SET cache { stock:98, v:3 } ✅ ĐÚNG!

Nếu MQ deliver v:3 trước v:2 (out of order):
  Nhận v:3 → check cache version=1 < 3 → SET cache { stock:98, v:3 }
  Nhận v:2 → check cache version=3 >= 2 → SKIP ✅ VẪN ĐÚNG!
```

### Pseudo-code tích hợp NestJS

```ts
// === 1. Service ghi DB + Outbox (trong cùng transaction) ===

@Injectable()
export class SkuService {
  constructor(private prisma: PrismaService) {}

  async reserveStock(skuId: string, qty: number) {
    return this.prisma.$transaction(async (tx) => {
      const sku = await tx.sku.update({
        where: { id: skuId },
        data: {
          stock: { decrement: qty },
          version: { increment: 1 },
        },
      })

      await tx.outbox.create({
        data: {
          aggregateType: 'SKU',
          aggregateId: skuId,
          eventType: 'sku.stock_changed',
          payload: { skuId, stock: sku.stock, version: sku.version },
        },
      })

      return sku
    })
  }
}

// === 2. Outbox Worker → publish vào RabbitMQ ===

@Injectable()
export class OutboxWorker {
  @Cron(CronExpression.EVERY_SECOND)
  async publishPending() {
    const events = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    for (const event of events) {
      await this.rabbitClient.emit(event.eventType, event.payload)
      await this.prisma.outbox.update({
        where: { id: event.id },
        data: { publishedAt: new Date() },
      })
    }
  }
}

// === 3. Cache Worker (Consumer) — Versioned Refresh ===

@Controller()
export class CacheInvalidationConsumer {
  @EventPattern('sku.stock_changed')
  async handleStockChanged(payload: {
    skuId: string
    stock: number
    version: number
  }) {
    const cacheKey = `sku:${payload.skuId}`
    const cached = await this.redis.get(cacheKey)

    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed.version >= payload.version) {
        return // already newer — skip
      }
    }

    const fresh = await this.prisma.sku.findUnique({
      where: { id: payload.skuId },
    })

    await this.redis.set(
      cacheKey,
      JSON.stringify({ ...fresh, version: fresh.version }),
      'EX',
      3600,
    )
  }
}
```

---

## 6) So sánh: MQ nào phù hợp cho cache invalidation?

| MQ | Phù hợp? | Lý do |
|---|---|---|
| **RabbitMQ** | Tốt cho Phase 1 | Ordering per queue, DLQ, dễ setup, đủ cho cache invalidation |
| **Kafka** | Tốt cho Phase 2+ | Ordering per partition (key = entity_id), replay, nhiều consumer group |
| **NATS** | Có thể dùng | Nhẹ, nhanh, nhưng ít durability hơn — phù hợp nếu chấp nhận eventual |
| **Redis Streams** | Cẩn thận | Dùng Redis để invalidate chính Redis → single point of failure |
| **AWS SQS** | Có thể dùng | FIFO queue đảm bảo ordering, nhưng vendor lock-in |
| **BullMQ** | Không lý tưởng | Không có fanout, khó cross-service, dùng chung Redis instance |

**Khuyến nghị cho dự án này**: Dùng **RabbitMQ** (đã quyết định ở Phase 1) với queue `cache.invalidation` riêng. Nếu sau này lên Kafka, chuyển sang topic `cache-invalidation` với partition key = `entity_type:entity_id`.

---

## 7) Tại sao không dùng Redis Pub/Sub thay MQ?

Nhiều người hỏi: Redis đã có Pub/Sub, tại sao không dùng luôn?

| Tiêu chí | Redis Pub/Sub | MQ (RabbitMQ/Kafka) |
|---|---|---|
| **Persistence** | Không — message mất nếu subscriber offline | Có — message persist trên disk |
| **Retry** | Không — fire-and-forget | Có — requeue nếu consumer fail |
| **Ordering** | Không đảm bảo khi scale | Đảm bảo (per queue/partition) |
| **At-least-once** | Không — nếu subscriber miss thì mất luôn | Có — message giữ cho đến khi ACK |
| **DLQ** | Không có | Có — message thất bại chuyển DLQ |
| **Backpressure** | Không — subscriber chậm thì mất message | Có — message queue lên, consumer xử lý theo tốc |

**Kết luận**: Redis Pub/Sub phù hợp cho real-time notification (chat, presence), **KHÔNG phù hợp** cho cache invalidation vì **không đảm bảo delivery**. Nếu message invalidation bị mất → cache stale vĩnh viễn cho đến khi TTL expire.

---

## 8) Edge cases và cách xử lý

### Cache Stampede (Thundering Herd)

```
Vấn đề: MQ gửi DEL cache → 1000 reader đồng thời miss cache → 1000 query DB cùng lúc

Giải pháp:
1. Dùng Refresh-through (B hoặc C) thay vì Delete-only (A) cho hot data
   → Cache Worker rebuild trước, reader luôn hit
2. Nếu dùng Delete-only: singleflight / distributed lock
   → Chỉ 1 reader được rebuild cache, các reader khác chờ
```

```ts
async getWithSingleflight(key: string, fetcher: () => Promise<any>) {
  const cached = await this.redis.get(key)
  if (cached) return JSON.parse(cached)

  const lockKey = `lock:${key}`
  const acquired = await this.redis.set(lockKey, '1', 'NX', 'EX', 5)

  if (acquired) {
    const data = await fetcher()
    await this.redis.set(key, JSON.stringify(data), 'EX', 3600)
    await this.redis.del(lockKey)
    return data
  }

  // Lock held by someone else — wait and retry
  await new Promise((r) => setTimeout(r, 100))
  return this.getWithSingleflight(key, fetcher)
}
```

### Outbox table grows forever

```
Giải pháp: Cron job xóa Outbox records đã publish (published_at IS NOT NULL)
sau 7 ngày (giữ lại cho audit trail ngắn hạn).

DELETE FROM "Outbox" WHERE published_at IS NOT NULL AND published_at < NOW() - INTERVAL '7 days';
```

### MQ down — Cache Worker không nhận được message

```
Giải pháp: TTL trên cache key.
Dù MQ down và cache không bị invalidate,
TTL đảm bảo cache sẽ expire sau thời gian nhất định.

Hot data: TTL = 5 phút (chấp nhận stale 5 phút max)
Warm data: TTL = 1 giờ
Cold data: TTL = 24 giờ
```

### Event arrive out of order (MQ không FIFO)

```
Đã giải quyết bằng Chiến lược C (Versioned Refresh):
Version check đảm bảo data cũ không ghi đè data mới.
```

---

## 9) Tóm tắt: Tại sao MQ nằm giữa DB và Cache?

```
Không có MQ:
  Service ──── ghi DB ────┐
                           ├── del cache ──── Redis    ← race condition, mất message
  Service ──── ghi DB ────┘

Có MQ:
  Service ──── ghi DB + Outbox ──── MQ ──── Cache Worker ──── Redis
                                     │
                                     ├── Ordering ✓
                                     ├── Retry ✓
                                     ├── At-least-once ✓
                                     ├── Idempotent ✓
                                     └── Cross-service ✓
```

**Một câu tóm tắt**: MQ giữa DB và Cache đóng vai trò **bộ điều phối (coordinator)** — đảm bảo mọi thay đổi trên DB sẽ **chắc chắn** được phản ánh lên Cache, theo **đúng thứ tự**, **không mất**, **không trùng**, và **không race condition** — dù hệ thống có bao nhiêu service/instance đang chạy.

---

## 10) Checklist áp dụng cho dự án

- [ ] Thêm field `version` (Int, auto-increment on update) vào các model hot: `SKU`, `Order`, `Product`.
- [ ] Thiết kế Outbox event cho cache invalidation: `{ aggregateType, aggregateId, version }`.
- [ ] Tạo RabbitMQ queue: `cache.invalidation` (durable, DLQ).
- [ ] Viết Cache Worker consumer với versioned refresh cho SKU stock và Order status.
- [ ] Đặt TTL hợp lý: hot data 5 phút, warm data 1 giờ, cold data 24 giờ.
- [ ] Implement singleflight cho hot key (tránh cache stampede).
- [ ] Cron job cleanup Outbox records > 7 ngày đã publish.
