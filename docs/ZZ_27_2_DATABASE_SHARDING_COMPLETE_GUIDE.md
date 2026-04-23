# ⚡ DATABASE SHARDING - Hướng Dẫn Toàn Diện

> **Dự án tham khảo**: NestJS Ecommerce API - Chiến lược Sharding cho Horizontal Scaling

---

## 📋 MỤC LỤC

1. [Tổng Quan về Database Sharding](#1-tổng-quan-về-database-sharding)
2. [Sharding vs Partitioning vs Replication](#2-sharding-vs-partitioning-vs-replication)
3. [Khi Nào Cần Sharding](#3-khi-nào-cần-sharding)
4. [Các Chiến Lược Sharding](#4-các-chiến-lược-sharding)
5. [Consistent Hashing - Thuật Toán Cốt Lõi](#5-consistent-hashing---thuật-toán-cốt-lõi)
6. [Shard Key Selection - Quyết Định Quan Trọng Nhất](#6-shard-key-selection---quyết-định-quan-trọng-nhất)
7. [Cross-Shard Challenges & Solutions](#7-cross-shard-challenges--solutions)
8. [Implement Sharding cho E-commerce](#8-implement-sharding-cho-e-commerce)
9. [Resharding & Operations](#9-resharding--operations)
10. [Monitoring, Tools & Best Practices](#10-monitoring-tools--best-practices)

---

## 1. TỔNG QUAN VỀ DATABASE SHARDING

### 🎯 Định Nghĩa

**Database Sharding** (hay **Horizontal Scaling**) là kỹ thuật chia dữ liệu của một database thành nhiều **phần nhỏ hơn** (gọi là **shards**), mỗi shard nằm trên một **database server riêng biệt**. Mỗi shard chứa một **subset** của tổng dữ liệu, và tất cả shards kết hợp lại tạo thành dataset hoàn chỉnh.

### 🔑 Khái Niệm Cơ Bản

#### Shard

- **Định nghĩa**: Một database instance độc lập chứa một phần (subset) của tổng dữ liệu
- **Đặc điểm**: Mỗi shard là một PostgreSQL/MySQL server đầy đủ, có thể có replicas riêng
- **Ví dụ**: Shard 1 chứa users có ID 1-1M, Shard 2 chứa users có ID 1M-2M

#### Shard Key (Partition Key)

- **Định nghĩa**: Column hoặc tập hợp columns quyết định dữ liệu thuộc shard nào
- **Tầm quan trọng**: Quyết định quan trọng nhất khi thiết kế sharding. **Chọn sai shard key = thiết kế lại toàn bộ**
- **Ví dụ**: `user_id`, `tenant_id`, `order_id`

#### Shard Router (Query Router)

- **Định nghĩa**: Layer trung gian quyết định query đi tới shard nào dựa trên shard key
- **Có thể là**: Application logic, middleware (Vitess, Citus), hoặc proxy layer

#### Scatter-Gather

- **Định nghĩa**: Khi query không chứa shard key, router phải gửi query tới **tất cả shards** rồi merge kết quả
- **Vấn đề**: Latency = slowest shard response. Tuyệt đối tránh trên user-facing paths

### 🚀 Lợi Ích

✅ **Horizontal Scalability**: Thêm shard = thêm capacity (gần như vô hạn)  
✅ **Write Scaling**: Mỗi shard xử lý writes độc lập (không bottleneck single primary)  
✅ **Fault Isolation**: 1 shard chết chỉ ảnh hưởng subset users, không phải toàn hệ thống  
✅ **Data Locality**: Đặt shard gần users (geographic sharding)  
✅ **Performance**: Mỗi shard chỉ chứa fraction of data → indexes nhỏ hơn, queries nhanh hơn  
✅ **Cost Efficiency**: Dùng nhiều commodity servers thay vì 1 super-expensive server

### ⚠️ Nhược Điểm

❌ **Complexity cực cao**: Thêm distributed systems challenges  
❌ **Cross-shard queries đắt đỏ**: JOIN, aggregation across shards rất chậm  
❌ **ACID bị phá vỡ**: Transactions không thể span multiple shards dễ dàng  
❌ **Resharding đau đớn**: Thay đổi shard count/key = migration nightmare  
❌ **Operational overhead**: Monitor, backup, upgrade N servers thay vì 1  
❌ **Application complexity**: Code phải aware về sharding logic

### ⚠️ Quan Trọng: Khi Nào KHÔNG Nên Shard

```
KHÔNG SHARD nếu chưa thử hết các giải pháp đơn giản hơn:

1. Vertical Scaling     → Nâng CPU, RAM, SSD cho server hiện tại
2. Read Replicas        → Phân tải read queries (xem doc Replication)
3. Connection Pooling   → PgBouncer/PgPool giảm connection overhead
4. Query Optimization   → EXPLAIN ANALYZE, index tuning, query rewrite
5. Caching              → Redis/Memcached cho hot data
6. Table Partitioning   → Chia table trong cùng 1 server (xem doc Partitioning)
7. Archive Old Data     → Move cold data sang storage rẻ hơn

Sharding là GIẢI PHÁP CUỐI CÙNG. Nó thêm permanent complexity vào hệ thống.
```

---

## 2. SHARDING VS PARTITIONING VS REPLICATION

### 📊 So Sánh Chi Tiết

```
┌─────────────────────────────────────────────────────────┐
│                    PARTITIONING                          │
│  Một server, nhiều partitions trong cùng database        │
│  ┌──────────┐                                           │
│  │PostgreSQL│                                           │
│  │ Server   │                                           │
│  │ ┌──────┐ │                                           │
│  │ │Part_1│ │ Orders Jan 2025                           │
│  │ ├──────┤ │                                           │
│  │ │Part_2│ │ Orders Feb 2025                           │
│  │ ├──────┤ │                                           │
│  │ │Part_3│ │ Orders Mar 2025                           │
│  │ └──────┘ │                                           │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    REPLICATION                           │
│  Nhiều servers, MỖI server chứa TOÀN BỘ data           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ PRIMARY  │  │ REPLICA 1│  │ REPLICA 2│              │
│  │ ALL DATA │→ │ ALL DATA │  │ ALL DATA │              │
│  │ (R + W)  │  │ (R only) │  │ (R only) │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    SHARDING                              │
│  Nhiều servers, MỖI server chứa PHẦN KHÁC NHAU         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ SHARD 1  │  │ SHARD 2  │  │ SHARD 3  │              │
│  │Users 1-1M│  │Users 1M+ │  │Users 2M+ │              │
│  │ (R + W)  │  │ (R + W)  │  │ (R + W)  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  Mỗi shard có thể có replicas riêng:                    │
│  Shard 1: Primary + 2 Replicas                          │
│  Shard 2: Primary + 2 Replicas                          │
│  Shard 3: Primary + 2 Replicas                          │
└─────────────────────────────────────────────────────────┘
```

| Tiêu chí | Partitioning | Replication | Sharding |
| --- | --- | --- | --- |
| **Scope** | 1 database server | Nhiều servers, cùng data | Nhiều servers, khác data |
| **Goal** | Query performance, maintenance | High availability, read scaling | Write scaling, capacity beyond 1 server |
| **Write scaling** | ❌ Không | ❌ Không (single primary) | ✅ Có (mỗi shard nhận writes) |
| **Read scaling** | ✅ (partition pruning) | ✅ (read replicas) | ✅ (mỗi shard xử lý reads) |
| **Max data size** | Giới hạn bởi 1 server | Giới hạn bởi 1 server | Gần như vô hạn |
| **Complexity** | Thấp | Trung bình | Rất cao |
| **ACID** | ✅ Đầy đủ | ✅ (trên primary) | ⚠️ Chỉ trong cùng shard |
| **Application changes** | Minimal/None | Minimal (read routing) | Significant (shard routing) |
| **When to use** | Table > vài GB, query patterns rõ | Need HA + read scaling | Single server không đủ capacity |

### 🏗️ Kết Hợp Cả 3 (Real-world Production)

```
Hệ thống production thường kết hợp cả 3:

Shard 1 (Users 1-1M):
├── Primary Server
│   ├── Table: Orders (PARTITIONED by month)
│   │   ├── orders_2025_01
│   │   ├── orders_2025_02
│   │   └── orders_2025_03
│   └── Table: Users (subset 1-1M)
├── Replica 1 (REPLICATED từ Primary)
└── Replica 2 (REPLICATED từ Primary)

Shard 2 (Users 1M-2M):
├── Primary Server
│   ├── Table: Orders (PARTITIONED by month)
│   └── Table: Users (subset 1M-2M)
├── Replica 1
└── Replica 2

→ SHARDING chia data theo user_id
→ PARTITIONING chia bảng lớn trong mỗi shard
→ REPLICATION cung cấp HA và read scaling cho mỗi shard
```

---

## 3. KHI NÀO CẦN SHARDING

### 📊 Decision Framework

```
Hệ thống của bạn có dấu hiệu nào sau đây?

┌────────────────────────────────────────────────────────────┐
│ LEVEL 1: Optimization (Chưa cần shard)                     │
│ □ Slow queries? → EXPLAIN ANALYZE, thêm indexes            │
│ □ High read load? → Thêm read replicas + caching           │
│ □ Connection bottleneck? → PgBouncer connection pooling     │
│ □ Large tables? → Table partitioning                        │
│ □ Old data? → Archive/purge strategy                        │
├────────────────────────────────────────────────────────────┤
│ LEVEL 2: Vertical Scaling                                   │
│ □ CPU maxed? → Upgrade CPU (cheaper than sharding)          │
│ □ RAM full? → Tăng RAM (shared_buffers, effective_cache)    │
│ □ Disk I/O saturated? → NVMe SSD, RAID configuration       │
│ □ Storage full? → Larger disks hoặc storage expansion       │
├────────────────────────────────────────────────────────────┤
│ LEVEL 3: Bạn CẦN SHARDING khi tất cả ở trên đã thử       │
│ ☑ Single server đã maxed out (lớn nhất available)          │
│ ☑ Write throughput vượt quá khả năng 1 server              │
│ ☑ Data volume quá lớn cho 1 disk (multi-TB)                │
│ ☑ Cần geographic data locality (multi-region writes)       │
│ ☑ Tenant isolation requirements (multi-tenant SaaS)        │
└────────────────────────────────────────────────────────────┘
```

### 📈 Thresholds Gợi Ý (PostgreSQL)

| Metric | Threshold cần xem xét Sharding | Giải pháp thay thế |
| --- | --- | --- |
| **Table rows** | > 500M-1B rows | Partitioning + archival trước |
| **Database size** | > 2-5 TB | Larger disk + partitioning trước |
| **Write TPS** | > 10,000-20,000 TPS | Query optimization + connection pooling trước |
| **Read TPS** | > 50,000 TPS | Read replicas + caching trước |
| **Connection count** | > 5,000 concurrent | PgBouncer trước |
| **Query latency (p99)** | > 500ms after optimization | Index + query optimization trước |

### 🎯 Phân Tích cho Dự Án E-commerce

```
Dự án NestJS Ecommerce API hiện tại:

Ước tính data sau 3 năm:
┌──────────────────────────────────────────────────────┐
│ Orders:              ~3.6M rows (10K/tháng × 36)     │
│ ProductSKUSnapshot:  ~18M rows (5 items/order avg)   │
│ PaymentTransaction:  ~7.2M rows                      │
│ Users:               ~500K rows                      │
│ CartItem:            ~36M rows (high churn)          │
│ Reviews:             ~1.8M rows                      │
│ Messages:            ~3.6M rows                      │
│                                                      │
│ Total database size: ~50-100 GB                      │
│ Peak Write TPS:      ~200                            │
│ Peak Read TPS:       ~1,500                          │
│                                                      │
│ → CHƯA CẦN SHARDING ở giai đoạn này                 │
│ → Partitioning + Replication là đủ                   │
│ → Chuẩn bị sharding-ready architecture cho tương lai │
└──────────────────────────────────────────────────────┘

Nếu scale lên 100x (enterprise/marketplace level):
┌──────────────────────────────────────────────────────┐
│ Orders:              ~360M rows                      │
│ ProductSKUSnapshot:  ~1.8B rows                      │
│ PaymentTransaction:  ~720M rows                      │
│ Users:               ~50M rows                       │
│ Database size:       ~5-10 TB                        │
│ Peak Write TPS:      ~20,000                         │
│ Peak Read TPS:       ~150,000                        │
│                                                      │
│ → CẦN SHARDING cho Orders, PaymentTransaction       │
│ → Shard key: user_id (co-locate user's data)        │
│ → Products/Categories: Reference tables (replicate)  │
└──────────────────────────────────────────────────────┘
```

---

## 4. CÁC CHIẾN LƯỢC SHARDING

### 🔢 4.1 Hash-Based Sharding

**Áp dụng hash function lên shard key để xác định shard.**

```
Algorithm: shard_id = hash(shard_key) % number_of_shards

Ví dụ với 4 shards:
  user_id = 123  → hash(123) % 4 = 3 → Shard 3
  user_id = 456  → hash(456) % 4 = 0 → Shard 0
  user_id = 789  → hash(789) % 4 = 1 → Shard 1
  user_id = 1000 → hash(1000) % 4 = 0 → Shard 0
```

```typescript
// Shard router implementation
class HashShardRouter {
  private shardCount: number;

  constructor(shardCount: number) {
    this.shardCount = shardCount;
  }

  getShardId(key: number | string): number {
    const hash = this.hashFunction(String(key));
    return hash % this.shardCount;
  }

  private hashFunction(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Sử dụng
const router = new HashShardRouter(4);
router.getShardId(123);  // → Shard 3
router.getShardId(456);  // → Shard 0
```

#### Ưu điểm

✅ Phân bố đều (nếu hash function tốt)  
✅ Đơn giản, dễ implement  
✅ Không cần metadata/lookup table  
✅ O(1) routing performance

#### Nhược điểm

❌ **Resharding nightmare**: Thêm shard → `hash % 5` thay vì `hash % 4` → **gần như toàn bộ data phải di chuyển**  
❌ **Range queries không hiệu quả**: `WHERE user_id BETWEEN 100 AND 200` phải scatter tới tất cả shards  
❌ **Không có data ordering**: Không thể tận dụng thứ tự tự nhiên của key

### 📊 4.2 Range-Based Sharding

**Chia data theo khoảng giá trị của shard key.**

```
Ví dụ: Shard theo user_id ranges

Shard 0: user_id     1 -   999,999
Shard 1: user_id 1,000,000 - 1,999,999
Shard 2: user_id 2,000,000 - 2,999,999
Shard 3: user_id 3,000,000+

Ví dụ: Shard theo time ranges

Shard 0: orders created   2024-01 → 2024-06
Shard 1: orders created   2024-07 → 2024-12
Shard 2: orders created   2025-01 → 2025-06
Shard 3: orders created   2025-07 → 2025-12
```

```sql
-- PostgreSQL: Range-based sharding config
-- Mỗi shard là một database server riêng biệt

-- Shard routing table (stored in application hoặc config server)
CREATE TABLE shard_config (
    shard_id    INT PRIMARY KEY,
    range_start BIGINT NOT NULL,
    range_end   BIGINT NOT NULL,
    host        VARCHAR(255) NOT NULL,
    port        INT DEFAULT 5432,
    db_name     VARCHAR(100) NOT NULL
);

INSERT INTO shard_config VALUES
    (0, 1,       999999,  'shard0.db.internal', 5432, 'ecommerce'),
    (1, 1000000, 1999999, 'shard1.db.internal', 5432, 'ecommerce'),
    (2, 2000000, 2999999, 'shard2.db.internal', 5432, 'ecommerce'),
    (3, 3000000, 9999999, 'shard3.db.internal', 5432, 'ecommerce');
```

#### Ưu điểm

✅ **Range queries hiệu quả**: `WHERE created_at BETWEEN ... AND ...` chỉ hit 1-2 shards  
✅ **Resharding dễ hơn**: Split 1 range thành 2 ranges, chỉ move subset data  
✅ **Data ordering**: Tận dụng được sequential access patterns

#### Nhược điểm

❌ **Hotspot risk cao**: Shard cuối cùng (latest data) thường nhận traffic nhiều nhất  
❌ **Uneven distribution**: Nếu data không phân bố đều theo ranges  
❌ **Time-based gotcha**: Shard mới nhất luôn hot, shards cũ gần như idle

### 📋 4.3 Directory-Based Sharding

**Dùng lookup table để map mỗi entity tới shard cụ thể.**

```
Lookup Table (stored centrally):
┌───────────┬──────────┐
│ entity_id │ shard_id │
├───────────┼──────────┤
│ user_1    │ shard_0  │
│ user_2    │ shard_2  │
│ user_3    │ shard_1  │
│ user_4    │ shard_0  │
│ tenant_A  │ shard_3  │
│ tenant_B  │ shard_1  │
└───────────┴──────────┘
```

```typescript
// Directory-based shard router
class DirectoryShardRouter {
  constructor(private lookupDb: PrismaClient) {}

  async getShardForEntity(entityId: string): Promise<ShardConfig> {
    let assignment = await this.lookupDb.shardAssignment.findUnique({
      where: { entityId },
    });

    if (!assignment) {
      // New entity → assign to least-loaded shard
      const targetShard = await this.getLeastLoadedShard();
      assignment = await this.lookupDb.shardAssignment.create({
        data: { entityId, shardId: targetShard.id },
      });
    }

    return this.getShardConfig(assignment.shardId);
  }

  async moveEntity(entityId: string, targetShardId: number): Promise<void> {
    await this.lookupDb.shardAssignment.update({
      where: { entityId },
      data: { shardId: targetShardId },
    });
  }
}
```

#### Ưu điểm

✅ **Maximum flexibility**: Move bất kỳ entity nào tới bất kỳ shard nào  
✅ **Handle hotspots**: Di chuyển hot entities sang shard riêng  
✅ **Multi-tenant isolation**: Mỗi tenant trên shard riêng nếu cần  
✅ **Resharding dễ**: Chỉ update lookup table + migrate data

#### Nhược điểm

❌ **Lookup latency**: Mỗi query thêm 1 lookup operation  
❌ **Single point of failure**: Lookup service chết = toàn bộ system chết  
❌ **Scaling concern**: Lookup table cũng có thể trở thành bottleneck  
❌ **Storage overhead**: Phải store mapping cho mỗi entity

### 📊 So Sánh Tổng Hợp

| Tiêu chí | Hash-Based | Range-Based | Directory-Based | Consistent Hashing |
| --- | --- | --- | --- | --- |
| **Distribution** | Đều | Phụ thuộc data | Flexible | Đều |
| **Range queries** | ❌ Scatter-gather | ✅ Single shard | Phụ thuộc mapping | ❌ Scatter-gather |
| **Resharding cost** | 🔴 Rất cao (rehash all) | 🟡 Trung bình (split) | 🟢 Thấp (update map) | 🟢 Thấp (K/N keys) |
| **Hotspot risk** | Thấp | Cao | Thấp (nếu monitor) | Thấp |
| **Lookup overhead** | O(1) hash | O(log n) search | O(1) + network | O(log n) ring |
| **Best for** | Random ID access | Time-series, ranges | Multi-tenant SaaS | Elastic scaling |
| **Worst for** | Range scans | Monotonic keys | Small datasets | Range queries |

---

## 5. CONSISTENT HASHING - THUẬT TOÁN CỐT LÕI

### 🎯 Vấn Đề với Simple Hashing

```
Simple modulo hashing: shard = hash(key) % N

Khi N = 4 shards:
  key "user_1" → hash = 100 → 100 % 4 = 0 → Shard 0
  key "user_2" → hash = 201 → 201 % 4 = 1 → Shard 1
  key "user_3" → hash = 302 → 302 % 4 = 2 → Shard 2
  key "user_4" → hash = 403 → 403 % 4 = 3 → Shard 3

Thêm 1 shard (N = 5):
  key "user_1" → hash = 100 → 100 % 5 = 0 → Shard 0  ✓ (không đổi)
  key "user_2" → hash = 201 → 201 % 5 = 1 → Shard 1  ✓ (không đổi)
  key "user_3" → hash = 302 → 302 % 5 = 2 → Shard 2  ✓ (không đổi)
  key "user_4" → hash = 403 → 403 % 5 = 3 → Shard 3  ✓ (không đổi)

  Nhưng đa số keys KHÁC sẽ thay đổi shard!
  key "user_5" → hash = 150 → 150 % 4 = 2, nhưng 150 % 5 = 0  ❌ PHẢI MIGRATE
  
  → ~80% data phải di chuyển khi thêm 1 shard! KHÔNG THỂ CHẤP NHẬN.
```

### 🔄 Consistent Hashing Giải Quyết Như Thế Nào

```
Ý tưởng: Thay vì modulo, đặt cả shards và keys lên một "vòng tròn" (hash ring).
Key sẽ thuộc về shard GẦN NHẤT theo chiều kim đồng hồ.

Hash Ring (0 → 2^32 - 1):

         0
         │
    ┌────┴────┐
    │  Shard A │ (position: 500)
    │          │
    │   key_1 ●│ (hash: 350) → đi theo chiều CW → Shard A ✓
    │          │
    ├──────────┤
    │  Shard B │ (position: 1500)
    │          │
    │   key_2 ●│ (hash: 1200) → đi theo chiều CW → Shard B ✓
    │          │
    ├──────────┤
    │  Shard C │ (position: 3000)
    │          │
    │   key_3 ●│ (hash: 2500) → đi theo chiều CW → Shard C ✓
    │          │
    └──────────┘

Khi THÊM Shard D (position: 2000):
  - key_1 (350)  → vẫn Shard A ✓ (không đổi)
  - key_2 (1200) → vẫn Shard B ✓ (không đổi)
  - key_3 (2500) → bây giờ Shard C... KHÔNG! → Shard D nếu 2000 < 2500 < 3000
  
  Chỉ keys giữa Shard B (1500) và Shard D (2000) cần migrate!
  → Chỉ ~K/N data di chuyển (K = total keys, N = shard count)
  → Với 4 shards, chỉ ~25% data di chuyển thay vì ~80%!
```

### 💻 Implementation

```typescript
// src/shared/services/consistent-hash-ring.ts
import * as crypto from 'crypto';

interface ShardNode {
  id: string;
  host: string;
  port: number;
  dbName: string;
}

class ConsistentHashRing {
  private ring: Map<number, string> = new Map();  // hash → shard_id
  private sortedKeys: number[] = [];
  private shards: Map<string, ShardNode> = new Map();
  private virtualNodesPerShard: number;

  constructor(virtualNodesPerShard: number = 150) {
    this.virtualNodesPerShard = virtualNodesPerShard;
  }

  private hash(key: string): number {
    const md5 = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(md5.substring(0, 8), 16);
  }

  addShard(shard: ShardNode): void {
    this.shards.set(shard.id, shard);

    // Thêm virtual nodes cho shard này trên ring
    for (let i = 0; i < this.virtualNodesPerShard; i++) {
      const virtualKey = `${shard.id}:vnode:${i}`;
      const hashValue = this.hash(virtualKey);
      this.ring.set(hashValue, shard.id);
      this.sortedKeys.push(hashValue);
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  removeShard(shardId: string): void {
    this.shards.delete(shardId);

    for (let i = 0; i < this.virtualNodesPerShard; i++) {
      const virtualKey = `${shardId}:vnode:${i}`;
      const hashValue = this.hash(virtualKey);
      this.ring.delete(hashValue);
    }

    this.sortedKeys = this.sortedKeys.filter(k => this.ring.has(k));
  }

  getShardForKey(key: string): ShardNode {
    if (this.ring.size === 0) {
      throw new Error('No shards available');
    }

    const hashValue = this.hash(key);

    // Binary search: tìm vị trí đầu tiên trên ring >= hashValue
    let low = 0;
    let high = this.sortedKeys.length - 1;

    if (hashValue > this.sortedKeys[high]) {
      // Wrap around: quay về shard đầu tiên trên ring
      const shardId = this.ring.get(this.sortedKeys[0])!;
      return this.shards.get(shardId)!;
    }

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedKeys[mid] < hashValue) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const shardId = this.ring.get(this.sortedKeys[low])!;
    return this.shards.get(shardId)!;
  }

  // Kiểm tra distribution evenness
  getDistribution(sampleSize: number = 100000): Map<string, number> {
    const distribution = new Map<string, number>();

    for (let i = 0; i < sampleSize; i++) {
      const shard = this.getShardForKey(`test_key_${i}`);
      distribution.set(shard.id, (distribution.get(shard.id) || 0) + 1);
    }

    return distribution;
  }
}

// Sử dụng
const ring = new ConsistentHashRing(150);

ring.addShard({ id: 'shard-0', host: 'shard0.db.internal', port: 5432, dbName: 'ecommerce' });
ring.addShard({ id: 'shard-1', host: 'shard1.db.internal', port: 5432, dbName: 'ecommerce' });
ring.addShard({ id: 'shard-2', host: 'shard2.db.internal', port: 5432, dbName: 'ecommerce' });
ring.addShard({ id: 'shard-3', host: 'shard3.db.internal', port: 5432, dbName: 'ecommerce' });

// Routing
const shard = ring.getShardForKey('user_12345');
console.log(`User 12345 → ${shard.host}`);

// Thêm shard mới: chỉ ~25% keys cần migrate
ring.addShard({ id: 'shard-4', host: 'shard4.db.internal', port: 5432, dbName: 'ecommerce' });
```

### 📊 Virtual Nodes: Tại Sao Cần

```
Không có Virtual Nodes (3 shards trên ring):

Ring: ───A─────────────────────B──────C───
      ▲                        ▲      ▲
   Shard A                  Shard B  Shard C

→ Shard A chứa ~70% data (khoảng cách lớn trước nó)
→ Shard C chứa ~5% data (khoảng cách nhỏ)
→ PHÂN BỐ CỰC KỲ KHÔNG ĐỀU!

Với Virtual Nodes (3 shards × 150 vnodes = 450 points trên ring):

Ring: ─A₁─C₃─B₂─A₅─B₁─C₁─A₃─B₄─C₂─A₂─B₃─A₄─C₄─B₅─...
       ▲                                            ▲
    Mỗi shard có 150 điểm rải đều trên ring

→ Distribution gần như hoàn hảo
→ Mỗi shard chứa ~33% ± 2% data
→ 100-200 virtual nodes per shard là sweet spot
```

---

## 6. SHARD KEY SELECTION - QUYẾT ĐỊNH QUAN TRỌNG NHẤT

### 🎯 Tiêu Chí Chọn Shard Key

```
Shard key TỐT phải thỏa mãn:

1. HIGH CARDINALITY (Nhiều giá trị khác nhau)
   ✅ user_id: hàng triệu giá trị → phân bố đều
   ❌ gender: chỉ 2-3 giá trị → shard rất không đều
   ❌ country_code: 200 giá trị nhưng 1 country có thể chiếm 80% data

2. EVEN DISTRIBUTION (Phân bố đều)
   ✅ user_id với hash: gần như hoàn hảo
   ❌ created_at: shard mới nhất luôn hot
   ❌ product_category: electronics có thể gấp 10x toys

3. QUERY PATTERN ALIGNMENT (Phù hợp với query patterns)
   ✅ user_id: 90% queries filter by user_id → single-shard lookup
   ❌ random_uuid: không ai query by random_uuid → mọi query scatter

4. IMMUTABLE (Không thay đổi)
   ✅ user_id: không bao giờ thay đổi
   ❌ email: user có thể đổi email → phải migrate giữa shards
   ❌ status: thay đổi liên tục

5. FREQUENTLY IN WHERE CLAUSE (Xuất hiện trong hầu hết queries)
   ✅ user_id: SELECT * FROM orders WHERE user_id = 123
   ❌ description: SELECT * FROM products WHERE description LIKE '...'
```

### 📊 Phân Tích Shard Key cho E-commerce

| Candidate | Cardinality | Distribution | Query Alignment | Immutable | Score |
| --- | --- | --- | --- | --- | --- |
| **user_id** | ✅ Cao | ✅ Đều (hash) | ✅ 80% queries | ✅ Không đổi | ⭐⭐⭐⭐⭐ |
| **tenant_id** | ✅ Cao (multi-tenant) | ✅ Đều | ✅ 100% queries | ✅ Không đổi | ⭐⭐⭐⭐⭐ |
| **order_id** | ✅ Cao | ✅ Đều | ⚠️ 40% queries | ✅ Không đổi | ⭐⭐⭐ |
| **product_id** | ✅ Cao | ⚠️ Hotspot products | ⚠️ 30% queries | ✅ Không đổi | ⭐⭐⭐ |
| **created_at** | ✅ Cao | ❌ Latest = hot | ⚠️ Range queries | ✅ Không đổi | ⭐⭐ |
| **country_code** | ❌ Thấp (~200) | ❌ Rất lệch | ⚠️ Ít queries | ✅ Không đổi | ⭐ |

### 🏆 Recommended: user_id là Shard Key

```
Tại sao user_id là lựa chọn tốt nhất cho E-commerce:

1. Co-location: Tất cả data của 1 user nằm trên cùng shard
   → Orders, CartItems, Reviews, Messages
   → Mọi "user dashboard" queries = single-shard lookup
   → KHÔNG cần cross-shard JOIN

2. Even distribution: Users phân bố đều (dùng hash)
   → Không có single user gây hotspot (trừ extreme cases)

3. Natural access pattern:
   → "Xem đơn hàng của tôi" → WHERE user_id = X → 1 shard
   → "Thêm vào giỏ hàng" → WHERE user_id = X → 1 shard
   → "Đánh giá sản phẩm" → WHERE user_id = X → 1 shard

4. Immutable: user_id không bao giờ thay đổi

Ngoại lệ - cần xử lý riêng:
   → Product catalog: Reference table, replicate tới tất cả shards
   → Admin analytics: Scatter-gather hoặc CQRS read model
   → Global search: Elasticsearch (separate service)
```

---

## 7. CROSS-SHARD CHALLENGES & SOLUTIONS

### ⚡ 7.1 Cross-Shard Queries

**Vấn đề lớn nhất khi sharding.**

```
Scenario: Admin cần "Top 10 products by revenue last month"

Không có sharding:
  SELECT product_name, SUM(price) as revenue
  FROM orders JOIN order_items ...
  GROUP BY product_name
  ORDER BY revenue DESC LIMIT 10;
  → 1 query, 1 database, ~200ms ✓

Với sharding (4 shards):
  Router → Shard 0: Top 10 products → kết quả R0
  Router → Shard 1: Top 10 products → kết quả R1
  Router → Shard 2: Top 10 products → kết quả R2
  Router → Shard 3: Top 10 products → kết quả R3
  Router → Merge R0 + R1 + R2 + R3 → Re-sort → Take top 10
  → 4 queries song song + merge, latency = max(shard latencies)
  → Nếu 1 shard chậm → toàn bộ query chậm
```

#### Giải pháp

**1. Denormalization - Embed data cần thiết ngay trong shard**

```sql
-- TRƯỚC: Orders reference Products (cross-shard JOIN needed)
-- orders shard by user_id, products shard by product_id

-- SAU: Embed product info vào order (ProductSKUSnapshot pattern!)
-- Dự án đã implement đúng pattern này!
CREATE TABLE "ProductSKUSnapshot" (
    id          SERIAL PRIMARY KEY,
    "orderId"   INT NOT NULL,
    "skuId"     INT,
    "productName" VARCHAR(500),  -- Embedded! Không cần JOIN Products
    price       FLOAT,           -- Embedded! Price tại thời điểm order
    images      TEXT[],          -- Embedded!
    "skuValue"  VARCHAR(500)     -- Embedded!
);

-- Query chỉ cần 1 shard (user's shard):
SELECT o.*, pss."productName", pss.price
FROM "Order" o
JOIN "ProductSKUSnapshot" pss ON o.id = pss."orderId"
WHERE o."userId" = 123;
-- → Single shard! No cross-shard JOIN!
```

**2. Reference Tables - Replicate small tables tới tất cả shards**

```
Reference tables = small, slowly-changing, needed by all shards

Candidates trong dự án:
  - Brand           (~100 rows)   → Replicate to all shards
  - Category        (~50 rows)    → Replicate to all shards
  - Language         (~10 rows)    → Replicate to all shards
  - Permission       (~200 rows)   → Replicate to all shards
  - Role             (~10 rows)    → Replicate to all shards

KHÔNG replicate:
  - User             (large, sharded)
  - Order            (large, sharded)
  - Product          (medium, có thể replicate nếu < 100K)
```

**3. CQRS Read Model - Dedicated read database cho analytics**

```typescript
// Mô hình CQRS cho cross-shard analytics
// Write path: Sharded databases
// Read path: Consolidated analytics database

// Event listener: khi order được tạo trên bất kỳ shard nào
@OnEvent('order.created')
async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
  // Gửi event tới analytics database (consolidated, non-sharded)
  await this.analyticsDb.orderAnalytics.create({
    data: {
      orderId: event.orderId,
      userId: event.userId,
      totalAmount: event.totalAmount,
      productIds: event.productIds,
      createdAt: event.createdAt,
      shardId: event.shardId,
    },
  });
}

// Analytics queries chạy trên consolidated database
async getTopProducts(startDate: Date, endDate: Date): Promise<TopProduct[]> {
  return this.analyticsDb.$queryRaw`
    SELECT product_name, SUM(amount) as revenue, COUNT(*) as orders
    FROM order_analytics
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY product_name
    ORDER BY revenue DESC
    LIMIT 10
  `;
}
```

### ⚡ 7.2 Distributed Transactions

**ACID transactions không hoạt động across shards.**

```
Scenario: Transfer money from User A (Shard 1) to User B (Shard 3)

Lý tưởng (nhưng KHÔNG THỂ):
  BEGIN TRANSACTION
    UPDATE accounts SET balance = balance - 100 WHERE user_id = 42  -- Shard 1
    UPDATE accounts SET balance = balance + 100 WHERE user_id = 17  -- Shard 3
  COMMIT
  → 2 database servers khác nhau KHÔNG THỂ coordinate atomicity!
```

#### Giải pháp 1: Thiết kế để tránh cross-shard transactions

```
Nguyên tắc: Mọi mutations của 1 business transaction nên nằm trên CÙNG 1 SHARD.

E-commerce example:
  Order creation = user's shard
    - Create order         (user's shard) ✓
    - Create snapshots     (user's shard) ✓
    - Update cart          (user's shard) ✓
    - Deduct inventory     → ⚠️ Product's shard? 
      → Giải pháp: Mỗi shard giữ local inventory counter
      → Sync back to central inventory async
```

#### Giải pháp 2: Saga Pattern (Recommended)

```
Saga = chuỗi local transactions + compensating transactions

Order Payment Saga:
  Step 1: Deduct from buyer's wallet (Shard 1 - local transaction)
    → Success: emit "FundsDebited" event
    → Fail: emit "DebitFailed" → DONE (no compensation needed)

  Step 2: Process payment (Payment Service)
    → Success: emit "PaymentProcessed" event
    → Fail: emit "PaymentFailed"
      → Compensate: Refund buyer's wallet (Shard 1)

  Step 3: Update order status (Shard 1 - local transaction)
    → Success: emit "OrderConfirmed" event
    → Fail: emit "OrderFailed"
      → Compensate: Refund buyer + reverse payment

  Tất cả steps là LOCAL transactions - không có distributed lock!
```

```typescript
// Saga implementation
@Injectable()
export class OrderPaymentSaga {
  constructor(
    private shardRouter: ShardRouterService,
    private eventBus: EventBus,
  ) {}

  async execute(userId: number, orderId: number, amount: number): Promise<void> {
    const userShard = this.shardRouter.getShardForUser(userId);

    // Step 1: Debit wallet (local transaction on user's shard)
    try {
      await userShard.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });
    } catch (error) {
      throw new InsufficientFundsError();
    }

    // Step 2: Process payment
    try {
      await this.eventBus.emit('payment.process', { orderId, amount });
    } catch (error) {
      // Compensate Step 1: refund wallet
      await userShard.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });
      throw error;
    }

    // Step 3: Confirm order
    try {
      await userShard.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });
    } catch (error) {
      // Compensate Step 1 & 2
      await userShard.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });
      await this.eventBus.emit('payment.reverse', { orderId, amount });
      throw error;
    }
  }
}
```

#### Giải pháp 3: Eventual Consistency (Cho non-critical operations)

```
Chấp nhận data sẽ eventually consistent:

Inventory update across shards:
  1. User buys product → Deduct from local shard inventory (instant)
  2. Emit "InventoryChanged" event to message queue
  3. Central inventory service processes event (async, seconds later)
  4. Sync updated inventory back to all shards

→ Milliseconds of inconsistency
→ Acceptable cho inventory (oversell protection ở application layer)
→ NOT acceptable cho financial transactions
```

---

## 8. IMPLEMENT SHARDING CHO E-COMMERCE

### 🏗️ 8.1 Architecture Overview

```
                         ┌─────────────┐
                         │   Client    │
                         └──────┬──────┘
                                │
                         ┌──────┴──────┐
                         │  API Gateway│
                         │  (NestJS)   │
                         └──────┬──────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
             ┌──────┴────┐ ┌───┴─────┐ ┌───┴─────┐
             │ Shard     │ │ Ref DB  │ │Analytics│
             │ Router    │ │(Products│ │   DB    │
             │           │ │ Brands) │ │ (CQRS)  │
             └─────┬─────┘ └─────────┘ └─────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   ┌────┴────┐┌───┴────┐┌───┴────┐
   │ Shard 0 ││Shard 1 ││Shard 2 │
   │Users 0-N││Users N+ ││Users 2N│
   │+Primary ││+Primary ││+Primary│
   │+Replicas││+Replicas││+Replicas│
   └─────────┘└────────┘└────────┘
```

### 🔌 8.2 Shard Router Service

```typescript
// src/shared/services/shard-router.service.ts
@Injectable()
export class ShardRouterService {
  private hashRing: ConsistentHashRing;
  private shardConnections: Map<string, PrismaClient> = new Map();

  constructor(private configService: ConfigService) {
    this.hashRing = new ConsistentHashRing(150);
    this.initializeShards();
  }

  private initializeShards(): void {
    const shardConfigs = this.configService.get<ShardConfig[]>('database.shards');

    for (const config of shardConfigs) {
      this.hashRing.addShard({
        id: config.id,
        host: config.host,
        port: config.port,
        dbName: config.dbName,
      });

      const prisma = new PrismaClient({
        datasources: {
          db: { url: `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.dbName}` },
        },
      });
      prisma.$connect();
      this.shardConnections.set(config.id, prisma);
    }
  }

  getShardForUser(userId: number): PrismaClient {
    const shard = this.hashRing.getShardForKey(`user:${userId}`);
    return this.shardConnections.get(shard.id)!;
  }

  getShardForOrder(orderId: number, userId: number): PrismaClient {
    // Orders co-located với user → dùng user_id để route
    return this.getShardForUser(userId);
  }

  getAllShards(): PrismaClient[] {
    return Array.from(this.shardConnections.values());
  }

  // Scatter-gather: query tất cả shards rồi merge
  async scatterGather<T>(
    queryFn: (shard: PrismaClient) => Promise<T[]>,
    mergeFn: (results: T[][]) => T[],
  ): Promise<T[]> {
    const shards = this.getAllShards();
    const results = await Promise.all(shards.map(queryFn));
    return mergeFn(results);
  }
}
```

### 🔌 8.3 Sharded Repository Pattern

```typescript
// src/routes/order/order.repo.ts
@Injectable()
export class ShardedOrderRepository {
  constructor(
    private shardRouter: ShardRouterService,
    private referenceDb: PrismaClient, // Non-sharded reference DB
  ) {}

  // Single-shard operation (fast!)
  async createOrder(userId: number, items: CreateOrderItem[]): Promise<Order> {
    const shard = this.shardRouter.getShardForUser(userId);

    return shard.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING_CONFIRMATION',
          createdById: userId,
        },
      });

      for (const item of items) {
        // Product info from reference DB (replicated)
        const product = await this.referenceDb.product.findUnique({
          where: { id: item.productId },
          include: { productTranslations: true },
        });

        await tx.productSKUSnapshot.create({
          data: {
            orderId: order.id,
            skuId: item.skuId,
            productName: product?.productTranslations[0]?.name || 'Unknown',
            price: item.price,
            images: [],
            skuValue: item.skuValue,
          },
        });
      }

      return order;
    });
  }

  // Single-shard operation (fast!)
  async getUserOrders(userId: number, limit: number = 20): Promise<Order[]> {
    const shard = this.shardRouter.getShardForUser(userId);

    return shard.order.findMany({
      where: { userId, deletedAt: null },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Cross-shard operation (slow, use for admin/analytics only)
  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    return this.shardRouter.scatterGather(
      // Query each shard
      (shard) => shard.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit, // Get more than needed from each shard
      }),
      // Merge results
      (shardResults) => {
        const allOrders = shardResults.flat();
        allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return allOrders.slice(0, limit);
      },
    );
  }

  // Cross-shard aggregation (use CQRS read model in production)
  async getOrderStats(startDate: Date, endDate: Date): Promise<OrderStats> {
    const shardResults = await Promise.all(
      this.shardRouter.getAllShards().map(shard =>
        shard.$queryRaw<[{ count: bigint; revenue: number }]>`
          SELECT COUNT(*)::bigint as count, COALESCE(SUM(pss.price), 0) as revenue
          FROM "Order" o
          LEFT JOIN "ProductSKUSnapshot" pss ON o.id = pss."orderId"
          WHERE o."createdAt" >= ${startDate}
            AND o."createdAt" < ${endDate}
            AND o."deletedAt" IS NULL
        `,
      ),
    );

    return shardResults.reduce(
      (acc, [result]) => ({
        totalOrders: acc.totalOrders + Number(result.count),
        totalRevenue: acc.totalRevenue + result.revenue,
      }),
      { totalOrders: 0, totalRevenue: 0 },
    );
  }
}
```

---

## 9. RESHARDING & OPERATIONS

### 🔄 9.1 Resharding: Thêm Shard Mới

```
Resharding là operation phức tạp nhất trong sharded system.
Mục tiêu: zero-downtime migration.

Chiến lược: Dual-Write + Backfill + Switch

Timeline:
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Dual Write (days 1-3)                          │
│ - Mọi WRITES đi tới CẢ old routing VÀ new routing     │
│ - READS vẫn từ old routing                              │
│ - New shard bắt đầu nhận writes                         │
├─────────────────────────────────────────────────────────┤
│ Phase 2: Backfill (days 3-7)                            │
│ - Background job copy historical data sang new shard     │
│ - Rate-limited: 20-30% I/O capacity                     │
│ - READS vẫn từ old routing                              │
├─────────────────────────────────────────────────────────┤
│ Phase 3: Verify (days 7-8)                              │
│ - Checksum comparison old vs new                         │
│ - Fix bất kỳ discrepancy nào                            │
├─────────────────────────────────────────────────────────┤
│ Phase 4: Switch (day 8)                                 │
│ - Flip reads sang new routing                            │
│ - Stop dual writes                                       │
│ - Cleanup old data từ source shards                      │
└─────────────────────────────────────────────────────────┘
```

```typescript
// Resharding migration job
@Injectable()
export class ReshardingService {
  async addNewShard(newShardConfig: ShardConfig): Promise<void> {
    // Phase 1: Add new shard to ring (starts receiving new writes)
    this.shardRouter.addShard(newShardConfig);
    this.logger.log('Phase 1: New shard added to ring, dual-write active');

    // Phase 2: Backfill historical data
    const keysToMigrate = await this.identifyKeysForNewShard(newShardConfig.id);
    this.logger.log(`Phase 2: ${keysToMigrate.length} keys to migrate`);

    for (const batch of this.batchify(keysToMigrate, 1000)) {
      await this.migrateBatch(batch, newShardConfig.id);
      // Rate limit: sleep between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Phase 3: Verify consistency
    const isConsistent = await this.verifyConsistency(newShardConfig.id);
    if (!isConsistent) {
      this.logger.error('Phase 3: Consistency check FAILED');
      throw new Error('Resharding consistency check failed');
    }
    this.logger.log('Phase 3: Consistency verified');

    // Phase 4: Cleanup old copies
    await this.cleanupOldCopies(keysToMigrate);
    this.logger.log('Phase 4: Resharding complete');
  }
}
```

### 🔧 9.2 Handling Hot Shards

```
Hot shard = 1 shard nhận traffic nhiều hơn hẳn các shard khác.

Nguyên nhân:
- Celebrity user / viral product trên 1 shard
- Time-based sharding: shard mới nhất luôn hot
- Uneven hash distribution

Detection:
- Monitor QPS per shard
- Monitor CPU/memory per shard
- Alert khi 1 shard > 2x average load

Giải pháp:
1. Move hot entity sang dedicated shard (directory-based)
2. Split hot shard thành 2 shards
3. Add caching layer trước hot shard
4. Read replicas cho hot shard (absorb reads)
```

---

## 10. MONITORING, TOOLS & BEST PRACTICES

### 📊 10.1 Monitoring Essentials

```typescript
// Per-shard monitoring metrics
interface ShardMetrics {
  shardId: string;
  queryCount: number;       // QPS
  avgLatencyMs: number;     // Query latency
  dataSize: number;         // Bytes
  rowCount: number;         // Estimated rows
  cpuUsage: number;         // Percentage
  connectionCount: number;  // Active connections
  replicationLag: number;   // If shard has replicas
}

@Injectable()
export class ShardMonitorService {
  @Cron('*/30 * * * * *')
  async collectMetrics(): Promise<void> {
    const metrics: ShardMetrics[] = [];

    for (const [shardId, client] of this.shardConnections) {
      const [stats] = await client.$queryRaw<[any]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
          pg_database_size(current_database()) as db_size,
          (SELECT sum(n_live_tup) FROM pg_stat_user_tables) as total_rows
      `;

      metrics.push({
        shardId,
        queryCount: stats.active_queries,
        dataSize: stats.db_size,
        rowCount: stats.total_rows,
        avgLatencyMs: 0, // From application metrics
        cpuUsage: 0,     // From OS metrics
        connectionCount: stats.active_queries,
        replicationLag: 0,
      });
    }

    // Detect hotspots
    const avgQPS = metrics.reduce((s, m) => s + m.queryCount, 0) / metrics.length;
    for (const m of metrics) {
      if (m.queryCount > avgQPS * 2) {
        this.logger.warn(`Hot shard detected: ${m.shardId} (${m.queryCount} QPS vs avg ${avgQPS})`);
      }
    }
  }
}
```

### 🛠️ 10.2 Sharding Tools & Technologies

| Tool | Database | Sharding Type | Features | Best For |
| --- | --- | --- | --- | --- |
| **Citus** | PostgreSQL | Hash/Range | Auto-sharding, distributed queries, CDC | PostgreSQL-native sharding |
| **Vitess** | MySQL | Hash/Range | VReplication, online resharding, VDiff | Large-scale MySQL (Slack, GitHub) |
| **ShardingSphere** | Any SQL | All types | Middleware proxy, encrypt, shadow DB | Multi-database support |
| **CockroachDB** | Native | Automatic | Transparent sharding, auto range split | NewSQL, no manual sharding |
| **TiDB** | MySQL-compatible | Automatic | Auto-sharding, TiFlash columnar | MySQL-compatible auto-scaling |
| **YugabyteDB** | PostgreSQL-compatible | Hash/Range | Automatic tablet splitting | PostgreSQL-compatible distributed |

#### Citus cho PostgreSQL (Recommended cho dự án)

```sql
-- Citus extension biến PostgreSQL thành distributed database
CREATE EXTENSION citus;

-- Designate coordinator và worker nodes
SELECT citus_set_coordinator_host('coordinator.db.internal', 5432);
SELECT * FROM citus_add_node('worker1.db.internal', 5432);
SELECT * FROM citus_add_node('worker2.db.internal', 5432);
SELECT * FROM citus_add_node('worker3.db.internal', 5432);

-- Distribute tables by shard key
SELECT create_distributed_table('Order', 'userId');
SELECT create_distributed_table('CartItem', 'userId');
SELECT create_distributed_table('ProductSKUSnapshot', 'orderId');

-- Co-locate related tables (same shard for same user)
SELECT create_distributed_table('CartItem', 'userId', colocate_with => 'Order');

-- Reference tables (replicated to all shards)
SELECT create_reference_table('Brand');
SELECT create_reference_table('Category');
SELECT create_reference_table('Language');
SELECT create_reference_table('Permission');
SELECT create_reference_table('Role');

-- Queries work TRANSPARENTLY!
-- Citus tự động route và distribute
SELECT * FROM "Order" WHERE "userId" = 123;
-- → Routed to single shard

SELECT COUNT(*) FROM "Order" WHERE status = 'DELIVERED';
-- → Scatter-gather, aggregated automatically
```

### ✅ 10.3 Best Practices & Production Checklist

#### Design Phase

- [ ] **Exhaust alternatives first**: Vertical scaling → read replicas → caching → partitioning → THEN shard
- [ ] **Choose shard key carefully**: High cardinality, even distribution, aligned with queries, immutable
- [ ] **Plan for cross-shard operations**: Identify queries that will scatter, design CQRS read models
- [ ] **Co-locate related data**: Orders + OrderItems + Snapshots trên cùng shard
- [ ] **Identify reference tables**: Small, read-heavy tables replicated to all shards
- [ ] **Design for resharding from day 1**: Use consistent hashing, start with 4-8 shards

#### Implementation Phase

- [ ] **Start with 4-8 shards**: Allows halving/doubling without too much migration
- [ ] **Use consistent hashing**: 100-200 virtual nodes per shard
- [ ] **Implement circuit breakers**: Graceful degradation khi shard down
- [ ] **Connection pooling per shard**: PgBouncer trên mỗi shard
- [ ] **Replication per shard**: Mỗi shard primary + 2 replicas
- [ ] **Automated failover per shard**: Patroni cho mỗi shard cluster

#### Operations Phase

- [ ] **Monitor per-shard metrics**: QPS, latency, data size, CPU, connections
- [ ] **Detect hotspots**: Alert khi shard load > 2x average
- [ ] **Test resharding procedures**: Practice trước khi cần
- [ ] **Backup per shard**: Independent backup schedules
- [ ] **Cross-shard query budgets**: Set latency budgets, alert on breach
- [ ] **Disaster recovery**: Test shard failure → recovery regularly

### 🎯 Key Takeaways

1. **Sharding là giải pháp cuối cùng**: Exhaust mọi alternative đơn giản hơn trước
2. **Shard key là quyết định quan trọng nhất**: user_id cho hầu hết e-commerce use cases
3. **Consistent hashing là must-have**: Giảm data migration khi thêm/bớt shards
4. **Co-locate related data**: Orders, cart, reviews của user trên cùng shard
5. **Reference tables replicate**: Products, brands, categories copy tới tất cả shards
6. **Cross-shard queries là expensive**: Thiết kế để minimize, dùng CQRS cho analytics
7. **Saga pattern thay cho distributed transactions**: Không bao giờ dùng 2PC
8. **Monitor per-shard**: Aggregate metrics che giấu hotspots
9. **Plan for resharding**: Thiết kế hệ thống để có thể thêm shard mà không downtime
10. **Citus cho PostgreSQL**: Nếu dùng PostgreSQL, Citus là tool tốt nhất để bắt đầu

---

## 📚 TÀI LIỆU THAM KHẢO

- [Database Sharding Strategies - Zylos Research](https://zylos.ai/research/2026-02-15-database-sharding)
- [Database Sharding: Architecting for Infinite Scale - Medium](https://medium.com/@manishkumar-fse/database-sharding-architecting-for-infinite-scale-7aa4d69d9317)
- [Consistent Hashing with Bounded Loads - Google Research](https://research.googleblog.com/2017/04/consistent-hashing-with-bounded-loads.html)
- [Citus - Distributed PostgreSQL](https://www.citusdata.com/product/community)
- [Vitess - MySQL Sharding](https://vitess.io/)
- [How to Create Database Sharding Strategies - OneUptime](https://oneuptime.com/blog/post/2026-01-30-database-sharding-strategies/view)
- [Database Sharding Strategies - knowledgelib.io](https://knowledgelib.io/software/system-design/database-sharding/2026)
- [Avoid Cross-Shard Data Movement - DZone](https://dzone.com/articles/avoid-cross-shard-data-movement)
- [PostgreSQL Partitioning Documentation](https://www.postgresql.org/docs/current/ddl-partitioning.html)
