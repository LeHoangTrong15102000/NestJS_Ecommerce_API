# Redis & Caching Strategies cho High-Traffic

## Redis không chỉ là set/get

### Data Structures quan trọng

| Structure | Use case trong Loyalty/Fintech |
|-----------|-------------------------------|
| **String** | Cache user profile, session token, idempotency key |
| **Hash** | User points balance `HSET user:123 points 5000 tier Gold` |
| **Sorted Set** | Leaderboard điểm loyalty `ZADD leaderboard 5000 user:123` |
| **Set** | Danh sách voucher đã dùng `SADD used_vouchers:user123 V001` |
| **List** | Recent transactions log (LPUSH + LTRIM giới hạn size) |
| **HyperLogLog** | Đếm unique visitors (ước lượng, tiết kiệm memory) |

### Pub/Sub & Stream
- **Pub/Sub:** Real-time notification khi user được cộng điểm
- **Stream:** Event log persistent (tương tự Kafka nhưng nhẹ hơn)

## 4 Chiến lược Cache

### 1. Cache-Aside (Lazy Loading) ← phổ biến nhất
```
Read: Cache hit? → return. Cache miss? → query DB → set cache → return
Write: Update DB → delete cache (hoặc invalidate)
```
**Ưu:** Chỉ cache data thực sự được đọc. **Nhược:** Cache miss đầu tiên chậm.

### 2. Write-Through
```
Write: Update cache → cache tự sync xuống DB
Read: Luôn đọc từ cache
```
**Ưu:** Data luôn consistent. **Nhược:** Write chậm hơn (phải qua cache).

### 3. Write-Behind (Write-Back)
```
Write: Update cache → async batch write xuống DB (vd: mỗi 5s)
```
**Ưu:** Write cực nhanh. **Nhược:** Risk mất data nếu cache crash trước khi flush.

### 4. Read-Through
```
Read: App chỉ gọi cache. Cache tự query DB nếu miss.
```
**Ưu:** App code đơn giản. **Nhược:** Cần cache middleware hỗ trợ.

### Khi nào dùng cái nào trong Loyalty?

| Scenario | Strategy |
|----------|----------|
| User profile, tier info | Cache-Aside |
| Points balance (read-heavy) | Cache-Aside + short TTL |
| Leaderboard (write-heavy) | Write-Behind batch vào Sorted Set |
| Session/Auth token | Write-Through |

## Cache Stampede (Thundering Herd)

**Vấn đề:** Cache hết hạn → hàng ngàn request đồng thời gọi DB → DB overload.

**VD thực tế:** Flash sale Loyalty, cache voucher list hết hạn → 10K request cùng lúc query DB.

### Giải pháp

#### 1. Distributed Lock (Singleflight)
```typescript
async function getWithLock(key: string) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Chỉ 1 request được rebuild cache
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);

  if (acquired) {
    const data = await db.query(...);
    await redis.set(key, JSON.stringify(data), 'EX', 3600);
    await redis.del(lockKey);
    return data;
  }

  // Các request khác chờ rồi retry
  await sleep(100);
  return getWithLock(key);
}
```

#### 2. Stale-While-Revalidate
Cache có 2 TTL: soft TTL (serve stale) + hard TTL (delete).
Khi soft TTL hết → serve stale data + async rebuild cache.

#### 3. Probabilistic Early Expiration
Mỗi request tính xác suất rebuild trước khi hết hạn:
```
shouldRecompute = (currentTime - (expiry - delta * beta * log(random()))) > 0
```
TTL càng gần hết → xác suất rebuild càng cao → chỉ 1 request rebuild sớm.

## Cache Invalidation Patterns

| Pattern | Cách làm | Risk |
|---------|----------|------|
| **TTL-based** | Set expiry time | Stale data trong TTL window |
| **Event-based** | MQ publish event khi data thay đổi → consumer xóa cache | Cần MQ infrastructure |
| **Delete on write** | Sau khi write DB → `DEL cache_key` | Race condition giữa read và write |
| **Version tag** | `cache:user:123:v5` → increment version khi update | Cần manage version |

## Redis trong Distributed System

### Distributed Lock (Redlock)
```typescript
// Dùng cho: tránh double-spend điểm, concurrent order processing
const lock = await redlock.acquire(['lock:order:123'], 5000);
try {
  // critical section: trừ điểm, tạo order
} finally {
  await lock.release();
}
```

### Rate Limiting
```typescript
// Sliding window: max 100 requests/phút
const key = `ratelimit:${userId}:${minute}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 100) throw new TooManyRequestsException();
```

## Câu hỏi phỏng vấn

1. **Cache-Aside vs Write-Through?** → Cache-Aside: lazy, chỉ cache khi đọc. Write-Through: eager, mọi write đều qua cache
2. **Làm sao xử lý cache stampede?** → Distributed lock (singleflight) hoặc stale-while-revalidate
3. **Redis single-threaded mà sao nhanh?** → In-memory, I/O multiplexing (epoll), không context switch, data structure tối ưu
4. **Khi nào KHÔNG nên cache?** → Data thay đổi liên tục (real-time stock price), data quá lớn, security-sensitive data
