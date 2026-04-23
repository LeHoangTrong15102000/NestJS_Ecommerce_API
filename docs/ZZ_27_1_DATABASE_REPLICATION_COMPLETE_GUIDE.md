# 🔄 DATABASE REPLICATION - Hướng Dẫn Toàn Diện

> **Dự án tham khảo**: NestJS Ecommerce API - Áp dụng Replication cho High Availability & Performance

---

## 📋 MỤC LỤC

1. [Tổng Quan về Database Replication](#1-tổng-quan-về-database-replication)
2. [Tại Sao Cần Replication trong E-commerce](#2-tại-sao-cần-replication-trong-e-commerce)
3. [Các Mô Hình Replication](#3-các-mô-hình-replication)
4. [Synchronous vs Asynchronous Replication](#4-synchronous-vs-asynchronous-replication)
5. [Implement Replication cho PostgreSQL](#5-implement-replication-cho-postgresql)
6. [Replication Lag & Consistency Patterns](#6-replication-lag--consistency-patterns)
7. [Failover & High Availability](#7-failover--high-availability)
8. [Integration với NestJS Application](#8-integration-với-nestjs-application)
9. [Monitoring & Troubleshooting](#9-monitoring--troubleshooting)
10. [Best Practices & Production Checklist](#10-best-practices--production-checklist)

---

## 1. TỔNG QUAN VỀ DATABASE REPLICATION

### 🎯 Định Nghĩa

**Database Replication** là quá trình **sao chép và đồng bộ dữ liệu** từ một database server (primary/master) sang một hoặc nhiều database server khác (replicas/slaves), nhằm đảm bảo **tính sẵn sàng cao** (high availability), **phân tải đọc** (read scaling) và **khả năng khôi phục sau thảm họa** (disaster recovery).

### 🔑 Khái Niệm Cơ Bản

#### Primary (Master) Node

- **Định nghĩa**: Server xử lý **tất cả write operations** (INSERT, UPDATE, DELETE)
- **Vai trò**: Nguồn sự thật duy nhất (single source of truth) cho dữ liệu
- **Trách nhiệm**: Ghi WAL (Write-Ahead Log), broadcast changes tới replicas

#### Replica (Slave/Standby) Node

- **Định nghĩa**: Server nhận dữ liệu từ primary và phục vụ **read-only queries**
- **Hot Standby**: Replica cho phép kết nối và đọc dữ liệu trong khi đang replicate
- **Warm Standby**: Replica không cho phép kết nối cho đến khi được promote lên primary

#### Write-Ahead Log (WAL)

- **Định nghĩa**: Log ghi lại mọi thay đổi dữ liệu **trước khi** thay đổi thực sự được áp dụng vào database
- **Vai trò trong replication**: WAL được stream từ primary sang replicas để đồng bộ dữ liệu
- **Trong PostgreSQL**: WAL là nền tảng cho cả crash recovery và streaming replication

#### Replication Lag

- **Định nghĩa**: Khoảng thời gian trễ giữa lúc dữ liệu được ghi trên primary và xuất hiện trên replica
- **Phạm vi**: Từ vài milliseconds (mạng nội bộ) đến vài phút (cross-region, tải cao)

### 🚀 Lợi Ích

✅ **High Availability**: Nếu primary chết, replica có thể promote lên thay thế  
✅ **Read Scaling**: Phân tải read queries sang nhiều replicas, giảm áp lực cho primary  
✅ **Disaster Recovery**: Dữ liệu được sao lưu realtime trên server khác/region khác  
✅ **Geographic Distribution**: Đặt replicas gần user để giảm latency  
✅ **Zero-downtime Maintenance**: Upgrade primary trong khi replicas vẫn phục vụ traffic  
✅ **Reporting Isolation**: Chạy các analytics/reporting queries nặng trên replica mà không ảnh hưởng production

### ⚠️ Nhược Điểm

❌ **Complexity**: Thêm infra, monitoring, failover logic  
❌ **Replication Lag**: Read-after-write có thể trả về stale data  
❌ **Cost**: Mỗi replica là một database server đầy đủ  
❌ **Write Bottleneck**: Tất cả writes vẫn đi qua single primary (trong single-master)  
❌ **Split-Brain Risk**: Khi primary và replica đều nghĩ mình là primary  
❌ **Consistency Trade-offs**: Phải chọn giữa performance và data freshness

---

## 2. TẠI SAO CẦN REPLICATION TRONG E-COMMERCE

### 📊 Phân Tích Traffic Patterns

Dựa trên schema của dự án NestJS Ecommerce API, traffic patterns điển hình:

```
Read/Write Ratio cho E-commerce:
┌─────────────────────────┐
│  READ Operations: ~85%  │  → Product listing, search, reviews, cart display
│  WRITE Operations: ~15% │  → Order creation, cart updates, payments
└─────────────────────────┘
```

#### Read-Heavy Operations (Cần scale bằng replicas)

```sql
-- Product browsing (rất cao frequency)
SELECT p.*, pt.name, pt.description FROM "Product" p
JOIN "ProductTranslation" pt ON p.id = pt."productId"
WHERE p."deletedAt" IS NULL AND pt."languageId" = 'vi';

-- Product search (cao frequency, complex queries)
SELECT p.*, b.name as brand_name FROM "Product" p
JOIN "Brand" b ON p."brandId" = b.id
WHERE p.base_price BETWEEN 100000 AND 500000;

-- Review listing (trung bình frequency)
SELECT r.*, u.name as reviewer_name FROM "Review" r
JOIN "User" u ON r."userId" = u.id
WHERE r."productId" = 123;

-- Order history (trung bình frequency)
SELECT o.*, pss."productName", pss.price FROM "Order" o
JOIN "ProductSKUSnapshot" pss ON o.id = pss."orderId"
WHERE o."userId" = 456 AND o."deletedAt" IS NULL;
```

#### Write-Critical Operations (Phải đi qua primary)

```sql
-- Order creation (cần ACID, race condition protection)
INSERT INTO "Order" ("userId", status, "createdAt") VALUES (456, 'PENDING_CONFIRMATION', NOW());
UPDATE "SKU" SET stock = stock - 1 WHERE id = 789;

-- Payment processing (cần atomicity)
INSERT INTO "PaymentTransaction" (gateway, "transactionDate", "amountIn") VALUES (...);

-- Cart updates (high frequency nhưng lightweight)
INSERT INTO "CartItem" ("userId", "skuId", quantity) VALUES (456, 789, 2);
```

### 🎯 Business Requirements cho Replication

| Requirement | Mô tả | Giải pháp Replication |
| --- | --- | --- |
| **99.9% Uptime** | E-commerce không thể chết vào giờ cao điểm | Primary + 2 replicas + auto failover |
| **< 100ms Product listing** | User kỳ vọng browse nhanh | Read replicas phân tải queries |
| **Order không mất** | RPO = 0 cho payment transactions | Synchronous replication cho critical data |
| **Multi-region** | User VN, SG, US cần latency thấp | Geographic replicas ở mỗi region |
| **Reporting không ảnh hưởng** | Analytics queries rất nặng | Dedicated reporting replica |

### 📈 Capacity Planning

```
Ước tính traffic cho 1 năm hoạt động:
┌──────────────────────────────────────────────────────┐
│ Daily Active Users:     50,000                       │
│ Product Views/day:      500,000 reads                │
│ Orders/day:             2,000 writes                 │
│ Cart Updates/day:       100,000 writes               │
│ Reviews/day:            500 writes                   │
│ Payment Transactions:   3,000 writes/day             │
│                                                      │
│ Peak Read QPS:          ~1,500 queries/second        │
│ Peak Write QPS:         ~200 queries/second          │
│                                                      │
│ → Read/Write ratio: ~7.5:1                           │
│ → 2 read replicas có thể xử lý 3x read capacity     │
└──────────────────────────────────────────────────────┘
```

---

## 3. CÁC MÔ HÌNH REPLICATION

### 🏗️ 3.1 Single-Master (Primary-Replica) Replication

**Mô hình phổ biến nhất, được recommend cho hầu hết ứng dụng.**

```
                    ┌──────────────┐
     ALL WRITES ──→ │   PRIMARY    │ ←── Source of truth
                    │  (Master)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ REPLICA 1│ │ REPLICA 2│ │ REPLICA 3│
       │  (Read)  │ │  (Read)  │ │(Reporting)│
       └──────────┘ └──────────┘ └──────────┘
              ▲            ▲            ▲
              │            │            │
              └────────────┼────────────┘
                           │
                    READ QUERIES
```

#### Đặc điểm

- **Writes**: Chỉ primary xử lý
- **Reads**: Phân tải sang replicas
- **Data flow**: Một chiều (primary → replicas)
- **Conflict resolution**: Không cần (chỉ 1 write point)
- **Consistency**: Strong (sync) hoặc Eventual (async)

#### Khi nào dùng

- Read/write ratio > 5:1
- Cần đơn giản, dễ maintain
- Chấp nhận brief write downtime khi failover
- Hầu hết web applications, e-commerce

#### Ví dụ cấu hình cho dự án E-commerce

```
Production Setup:
┌─────────────────────────────────────────────────┐
│ Primary (Write)          : 16 CPU, 64GB RAM     │
│ Replica 1 (Read - API)   : 8 CPU, 32GB RAM      │
│ Replica 2 (Read - API)   : 8 CPU, 32GB RAM      │
│ Replica 3 (Reporting)    : 16 CPU, 64GB RAM     │
│ Replica 4 (DR - Region 2): 8 CPU, 32GB RAM      │
└─────────────────────────────────────────────────┘
```

### 🏗️ 3.2 Multi-Master (Active-Active) Replication

**Cho phép writes trên nhiều nodes đồng thời.**

```
     WRITES (Region VN)          WRITES (Region SG)
           │                            │
           ▼                            ▼
    ┌──────────────┐             ┌──────────────┐
    │   MASTER 1   │◄──────────►│   MASTER 2   │
    │  (Vietnam)   │  bi-direct │  (Singapore) │
    └──────┬───────┘  replicate └──────┬───────┘
           │                            │
     ┌─────┴─────┐                ┌─────┴─────┐
     ▼           ▼                ▼           ▼
  ┌────────┐ ┌────────┐     ┌────────┐ ┌────────┐
  │Replica │ │Replica │     │Replica │ │Replica │
  │  VN-1  │ │  VN-2  │     │  SG-1  │ │  SG-2  │
  └────────┘ └────────┘     └────────┘ └────────┘
```

#### Đặc điểm

- **Writes**: Bất kỳ master nào cũng nhận writes
- **Data flow**: Hai chiều (bi-directional)
- **Conflict resolution**: BẮT BUỘC phải có strategy
- **Complexity**: Cao hơn single-master rất nhiều

#### Conflict Resolution Strategies

```
Khi 2 masters đồng thời update cùng 1 row:

1. Last-Write-Wins (LWW):
   Master VN: UPDATE users SET name = 'Nguyễn A' WHERE id = 1  (timestamp: T1)
   Master SG: UPDATE users SET name = 'Nguyen A' WHERE id = 1  (timestamp: T2)
   → T2 > T1 → 'Nguyen A' wins
   → ⚠️ Có thể mất data silently

2. Application-Level Resolution:
   → Conflict được gửi về application logic
   → Developer quyết định merge strategy
   → Phức tạp nhưng chính xác nhất

3. CRDTs (Conflict-Free Replicated Data Types):
   → Dữ liệu được thiết kế để merge tự động
   → Ví dụ: Counter chỉ tăng, Set chỉ thêm
   → Không cần coordination giữa các nodes
```

#### Khi nào dùng

- Cần writes ở nhiều geographic regions
- Không chấp nhận write downtime (zero write downtime)
- Traffic quá cao cho single primary
- **⚠️ KHUYẾN CÁO**: Chỉ dùng khi thực sự cần thiết, vì operational complexity rất cao

### 🏗️ 3.3 Cascading Replication

**Replica replicate từ replica khác, không trực tiếp từ primary.**

```
    ┌──────────┐
    │ PRIMARY  │
    └────┬─────┘
         │
    ┌────┴─────┐
    │REPLICA 1 │ ← Nhận WAL trực tiếp từ primary
    └────┬─────┘
         │
    ┌────┴─────┐
    │REPLICA 2 │ ← Nhận WAL từ Replica 1 (không từ primary)
    └────┬─────┘
         │
    ┌────┴─────┐
    │REPLICA 3 │ ← Nhận WAL từ Replica 2
    └──────────┘
```

#### Khi nào dùng

- Có nhiều replicas (5+) và không muốn primary bị quá tải bởi WAL streaming
- Cross-region replication: Primary → Regional replica → Local replicas
- Giảm network bandwidth từ primary

### 📊 So Sánh Các Mô Hình

| Đặc điểm | Single-Master | Multi-Master | Cascading |
| --- | --- | --- | --- |
| **Complexity** | Thấp | Rất cao | Trung bình |
| **Write scalability** | Không (single point) | Có | Không |
| **Read scalability** | Có | Có | Có |
| **Conflict resolution** | Không cần | BẮT BUỘC | Không cần |
| **Consistency** | Strong/Eventual | Eventual | Eventual (lag tích lũy) |
| **Failover** | Cần promote replica | Tự động (master khác) | Cần reconfigure chain |
| **Network load on primary** | Cao (nếu nhiều replicas) | Trung bình | Thấp |
| **Use case** | Hầu hết applications | Multi-region writes | Nhiều replicas, cross-region |
| **Recommendation** | ✅ Default choice | ⚠️ Khi thực sự cần | 🔧 Tối ưu hóa |

---

## 4. SYNCHRONOUS VS ASYNCHRONOUS REPLICATION

### ⚡ 4.1 Asynchronous Replication

**Primary commit ngay, không đợi replica.**

```
Timeline:
  T0: Client gửi INSERT
  T1: Primary ghi vào WAL
  T2: Primary COMMIT → trả response cho client ✓
  T3: WAL được gửi tới replica (background)
  T4: Replica nhận WAL
  T5: Replica apply changes

  ┌────┐    ┌──────────┐    ┌─────────┐
  │User│──→ │ PRIMARY  │    │ REPLICA │
  │    │    │          │    │         │
  │    │    │ T1: WAL  │    │         │
  │    │◄── │ T2: ACK  │    │         │
  │    │    │ T3: Send ─────→ T4: Recv│
  │    │    │          │    │ T5: Apply│
  └────┘    └──────────┘    └─────────┘
  
  Window T2→T5: Replication lag
  Nếu primary chết ở T3 → data loss!
```

#### Đặc điểm

| Aspect | Giá trị |
| --- | --- |
| **Write latency** | Thấp nhất (chỉ local write) |
| **Data loss risk** | Có thể mất transactions chưa kịp replicate |
| **RPO** | > 0 (vài giây đến vài phút) |
| **Replica lag** | Milliseconds → Minutes (tùy tải) |
| **Primary availability** | Không bị block nếu replica chết |

#### Khi nào dùng

- Performance là ưu tiên số 1
- Chấp nhận mất một vài transactions gần nhất khi primary chết
- Product views, cart browsing, search logs
- Reporting replicas

### 🔒 4.2 Synchronous Replication

**Primary đợi ít nhất 1 replica confirm trước khi commit.**

```
Timeline:
  T0: Client gửi INSERT
  T1: Primary ghi vào WAL
  T2: Primary gửi WAL tới replica
  T3: Replica nhận WAL
  T4: Replica ghi vào disk
  T5: Replica gửi ACK → Primary
  T6: Primary COMMIT → trả response cho client ✓

  ┌────┐    ┌──────────┐    ┌─────────┐
  │User│──→ │ PRIMARY  │    │ REPLICA │
  │    │    │          │    │         │
  │    │    │ T1: WAL  │    │         │
  │    │    │ T2: Send ─────→ T3: Recv│
  │    │    │          │    │ T4: Disk│
  │    │    │ T5: ACK ◄───── T5: ACK │
  │    │◄── │ T6: COMMIT│    │         │
  └────┘    └──────────┘    └─────────┘
  
  NO data loss window!
  Nhưng: latency = local_write + network_roundtrip + replica_write
```

#### Đặc điểm

| Aspect | Giá trị |
| --- | --- |
| **Write latency** | Cao hơn (thêm network roundtrip + replica write) |
| **Data loss risk** | ZERO (RPO = 0) |
| **RPO** | = 0 |
| **Primary availability** | BỊ BLOCK nếu tất cả sync replicas chết |
| **Network dependency** | Rất nhạy cảm với network latency |

#### Khi nào dùng

- Zero data loss là bắt buộc
- Payment transactions, financial data
- Order creation (nếu business yêu cầu)
- Legal/compliance requirements

### 🔀 4.3 Semi-Synchronous Replication

**Đợi ít nhất 1 replica (không phải tất cả) confirm trước khi commit.**

```
  ┌────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
  │User│──→ │ PRIMARY  │    │REPLICA 1│    │REPLICA 2│
  │    │    │          │    │ (sync)  │    │ (async) │
  │    │    │ WAL Send ─────→ ACK ✓   │    │         │
  │    │◄── │ COMMIT   │    │         │    │         │
  │    │    │ WAL Send ─────────────────────→ (later) │
  └────┘    └──────────┘    └─────────┘    └─────────┘

  Chỉ cần 1 replica ACK → commit
  Các replicas còn lại nhận async
```

#### PostgreSQL Configuration

```sql
-- synchronous_standby_names xác định replicas nào phải sync
-- FIRST 1: chỉ cần 1 trong list ACK
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (replica1, replica2)';

-- ANY 1: bất kỳ 1 replica nào ACK là đủ
ALTER SYSTEM SET synchronous_standby_names = 'ANY 1 (replica1, replica2, replica3)';
```

### 📊 So Sánh Chi Tiết

| Tiêu chí | Asynchronous | Semi-Synchronous | Synchronous |
| --- | --- | --- | --- |
| **Write latency** | ~1-5ms | ~5-20ms (LAN) | ~10-50ms (LAN) |
| **Data loss on failover** | Có thể (last N transactions) | Rất thấp | ZERO |
| **RPO** | Seconds-Minutes | ~0 | 0 |
| **RTO** | 10-30s (auto failover) | 10-30s | 10-30s |
| **Primary blocked khi replica down** | KHÔNG | Chuyển sang async tạm | CÓ |
| **Network sensitivity** | Thấp | Trung bình | Cao |
| **Cross-region viable** | ✅ Có | ⚠️ Với replica gần | ❌ Latency quá cao |
| **PostgreSQL default** | ✅ Mặc định | Cần config | Cần config |
| **Use case** | General purpose | Balanced | Financial, compliance |

### 🎯 Recommendation cho E-commerce

```
Chiến lược Hybrid (Recommended):

┌──────────────────────────────────────────────────────────┐
│                     PRIMARY SERVER                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐  SYNCHRONOUS   ┌────────────────┐   │
│  │ Payment &      │ ──────────────→│ Replica 1      │   │
│  │ Order writes   │   (zero loss)  │ (HA Standby)   │   │
│  └────────────────┘                └────────────────┘   │
│                                                          │
│  ┌────────────────┐  ASYNCHRONOUS  ┌────────────────┐   │
│  │ Product, Cart, │ ──────────────→│ Replica 2      │   │
│  │ Review writes  │   (fast)       │ (Read scaling) │   │
│  └────────────────┘                └────────────────┘   │
│                                                          │
│  ┌────────────────┐  ASYNCHRONOUS  ┌────────────────┐   │
│  │ All writes     │ ──────────────→│ Replica 3      │   │
│  │                │   (dedicated)  │ (Reporting/DR) │   │
│  └────────────────┘                └────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 5. IMPLEMENT REPLICATION CHO POSTGRESQL

### 🚀 Phase 1: Streaming Replication Setup

#### Step 1: Cấu hình Primary Server

```ini
# postgresql.conf trên PRIMARY

# Bật WAL level cho replication
wal_level = replica

# Số lượng concurrent replication connections tối đa
max_wal_senders = 10

# Replication slots ngăn WAL bị xóa trước khi replica consume
max_replication_slots = 10

# Giữ WAL segments như safety net (1GB)
wal_keep_size = 1GB

# Cho phép read queries trên standby
hot_standby = on

# Bật WAL log hints cho pg_rewind
wal_log_hints = on

# Archive WAL cho point-in-time recovery
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

```ini
# pg_hba.conf trên PRIMARY - cho phép replication connections

# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    replication     replicator      10.0.0.0/24             scram-sha-256
host    replication     replicator      192.168.1.0/24          scram-sha-256
```

```sql
-- Tạo replication user
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'secure_replication_password';

-- Tạo replication slot cho mỗi replica
-- Slot ngăn primary xóa WAL segments chưa được replica consume
SELECT pg_create_physical_replication_slot('replica1_slot');
SELECT pg_create_physical_replication_slot('replica2_slot');
SELECT pg_create_physical_replication_slot('replica3_slot');
```

#### Step 2: Khởi tạo Replica từ Primary

```bash
# Trên REPLICA server - tạo base backup từ primary
pg_basebackup \
  -h primary_host \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -Fp \                    # Format plain
  -Xs \                    # Stream WAL during backup
  -P \                     # Show progress
  -R \                     # Tự động tạo standby.signal và primary_conninfo
  -S replica1_slot \       # Sử dụng replication slot
  -C                       # Tạo slot nếu chưa có
```

#### Step 3: Cấu hình Replica Server

```ini
# postgresql.conf trên REPLICA

# Connection tới primary
primary_conninfo = 'host=primary_host port=5432 user=replicator password=secure_replication_password application_name=replica1'

# Sử dụng replication slot
primary_slot_name = 'replica1_slot'

# Cho phép read queries
hot_standby = on

# Feedback cho primary về query conflicts
hot_standby_feedback = on

# Recovery target (optional - cho point-in-time recovery)
# recovery_target_time = '2025-01-15 14:30:00'

# Max standby delay trước khi cancel conflicting queries
max_standby_streaming_delay = 30s
max_standby_archive_delay = 60s
```

```bash
# Tạo standby signal file (nếu pg_basebackup chưa tạo)
touch /var/lib/postgresql/16/main/standby.signal

# Start replica
pg_ctl start -D /var/lib/postgresql/16/main
```

#### Step 4: Verify Replication

```sql
-- Trên PRIMARY: kiểm tra replication status
SELECT
    client_addr,
    application_name,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sync_state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes,
    pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS replication_lag_pretty
FROM pg_stat_replication;

-- Kết quả mong đợi:
-- client_addr | application_name | state     | sync_state | replication_lag_pretty
-- 10.0.0.12   | replica1         | streaming | async      | 128 bytes
-- 10.0.0.13   | replica2         | streaming | async      | 0 bytes

-- Trên REPLICA: xác nhận đang ở recovery mode
SELECT pg_is_in_recovery();
-- Kết quả: true (đang là standby)

-- Trên REPLICA: kiểm tra lag
SELECT
    CASE
        WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0
        ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
    END AS replication_lag_seconds;
```

### 🚀 Phase 2: Synchronous Replication cho Critical Data

```ini
# postgresql.conf trên PRIMARY

# Chỉ cần 1 replica trong list ACK trước khi commit
synchronous_standby_names = 'FIRST 1 (replica1, replica2)'

# Mức độ synchronous commit
# on: đợi replica flush WAL vào disk
# remote_apply: đợi replica APPLY changes (strict nhất)
# remote_write: đợi replica write vào OS buffer (nhanh hơn on)
synchronous_commit = on
```

```sql
-- Kiểm tra sync status
SELECT application_name, sync_state
FROM pg_stat_replication;

-- Kết quả:
-- application_name | sync_state
-- replica1         | sync       ← Synchronous replica
-- replica2         | potential  ← Sẵn sàng trở thành sync nếu replica1 chết
-- replica3         | async      ← Luôn async
```

#### Transaction-Level Synchronous Control

```sql
-- Cho phép set synchronous commit ở transaction level
-- Rất hữu ích: chỉ sync cho critical operations

-- Payment transaction: BẮT BUỘC sync (zero data loss)
BEGIN;
SET LOCAL synchronous_commit = on;
INSERT INTO "PaymentTransaction" (gateway, "transactionDate", "amountIn")
VALUES ('VNPAY', NOW(), 500000);
COMMIT; -- Đợi replica ACK

-- Cart update: async OK (performance first)
BEGIN;
SET LOCAL synchronous_commit = local;
UPDATE "CartItem" SET quantity = 3 WHERE id = 123;
COMMIT; -- Không đợi replica
```

### 🚀 Phase 3: Logical Replication (Selective Table Replication)

```sql
-- Logical replication cho phép replicate từng table cụ thể
-- Hữu ích cho: partial replication, cross-version, data warehouse feeding

-- Trên PRIMARY: tạo publication
CREATE PUBLICATION ecommerce_products FOR TABLE
    "Product",
    "ProductTranslation",
    "Brand",
    "BrandTranslation",
    "Category",
    "CategoryTranslation",
    "SKU";

CREATE PUBLICATION ecommerce_orders FOR TABLE
    "Order",
    "ProductSKUSnapshot",
    "PaymentTransaction";

-- Trên SUBSCRIBER (reporting database, data warehouse, etc.):
CREATE SUBSCRIPTION sub_products
    CONNECTION 'host=primary_host dbname=ecommerce user=replicator password=...'
    PUBLICATION ecommerce_products;

CREATE SUBSCRIPTION sub_orders
    CONNECTION 'host=primary_host dbname=ecommerce user=replicator password=...'
    PUBLICATION ecommerce_orders;

-- Kiểm tra subscription status
SELECT subname, received_lsn, latest_end_lsn,
       pg_size_pretty(pg_wal_lsn_diff(latest_end_lsn, received_lsn)) AS lag
FROM pg_stat_subscription;
```

---

## 6. REPLICATION LAG & CONSISTENCY PATTERNS

### ⏱️ 6.1 Hiểu về Replication Lag

```
Replication Lag là kẻ thù ngầm của mọi hệ thống có replicas.

Scenario thực tế trong E-commerce:
  T0: User A đặt hàng → INSERT vào PRIMARY
  T1: PRIMARY commit → trả response "Đặt hàng thành công!"
  T2: User A refresh trang "Đơn hàng của tôi" → query đọc từ REPLICA
  T3: REPLICA chưa nhận WAL → KHÔNG thấy đơn hàng mới!

  User: "Vừa đặt hàng xong mà không thấy???" 😡
```

#### Nguyên nhân Replication Lag tăng

```
1. Primary write throughput cao → Replica apply không kịp
2. Network latency/bandwidth giữa primary và replica
3. Replica CPU/IO bị bottleneck (nếu chạy heavy queries)
4. Long-running transactions trên replica block apply
5. Large transactions (bulk INSERT/UPDATE)
6. Cross-region replication (vật lý xa)
```

### 🔧 6.2 Consistency Patterns

#### Pattern 1: Read-Your-Writes Consistency

**Sau khi user write, đảm bảo user đó đọc được data mình vừa write.**

```typescript
// src/shared/services/read-routing.service.ts
@Injectable()
export class ReadRoutingService {
  constructor(
    @Inject('PRIMARY_DB') private primaryDb: PrismaClient,
    @Inject('REPLICA_DB') private replicaDb: PrismaClient,
    private cacheManager: Cache,
  ) {}

  async getDbForRead(userId: number, entity: string): Promise<PrismaClient> {
    const lastWriteKey = `last_write:${userId}:${entity}`;
    const lastWriteTimestamp = await this.cacheManager.get<number>(lastWriteKey);

    if (lastWriteTimestamp) {
      const elapsed = Date.now() - lastWriteTimestamp;
      // Nếu user vừa write trong 5 giây gần nhất → đọc từ primary
      if (elapsed < 5000) {
        return this.primaryDb;
      }
    }

    return this.replicaDb;
  }

  async markWrite(userId: number, entity: string): Promise<void> {
    const lastWriteKey = `last_write:${userId}:${entity}`;
    // TTL 10 giây - sau đó safe để đọc từ replica
    await this.cacheManager.set(lastWriteKey, Date.now(), 10);
  }
}

// Sử dụng trong Order Service
@Injectable()
export class OrderService {
  constructor(
    private readRouting: ReadRoutingService,
    @Inject('PRIMARY_DB') private primaryDb: PrismaClient,
  ) {}

  async createOrder(userId: number, items: CreateOrderItem[]): Promise<Order> {
    // Write luôn đi qua primary
    const order = await this.primaryDb.order.create({
      data: { userId, status: 'PENDING_CONFIRMATION' },
    });

    // Đánh dấu user vừa write
    await this.readRouting.markWrite(userId, 'order');
    return order;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    // Tự động chọn primary hoặc replica
    const db = await this.readRouting.getDbForRead(userId, 'order');
    return db.order.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

#### Pattern 2: Monotonic Reads

**Đảm bảo user không bao giờ đọc data cũ hơn lần đọc trước.**

```typescript
// Sticky session - luôn route user tới cùng 1 replica
@Injectable()
export class MonotonicReadService {
  constructor(
    @Inject('REPLICA_POOL') private replicaPool: PrismaClient[],
  ) {}

  getReplicaForUser(userId: number): PrismaClient {
    // Consistent hashing: cùng userId luôn đến cùng replica
    const replicaIndex = userId % this.replicaPool.length;
    return this.replicaPool[replicaIndex];
  }
}
```

#### Pattern 3: Causal Consistency

**Nếu operation B phụ thuộc vào kết quả của operation A, thì B phải thấy data từ A.**

```typescript
// Truyền LSN (Log Sequence Number) giữa các requests
@Injectable()
export class CausalConsistencyService {
  constructor(
    @Inject('PRIMARY_DB') private primaryDb: PrismaClient,
    @Inject('REPLICA_DB') private replicaDb: PrismaClient,
  ) {}

  async writeAndGetLSN(operation: () => Promise<any>): Promise<{ result: any; lsn: string }> {
    const result = await operation();

    // Lấy current WAL LSN sau khi write
    const [{ lsn }] = await this.primaryDb.$queryRaw<[{ lsn: string }]>`
      SELECT pg_current_wal_lsn()::text AS lsn
    `;

    return { result, lsn };
  }

  async readAfterLSN(lsn: string, query: () => Promise<any>): Promise<any> {
    // Đợi replica catch up tới LSN cụ thể
    const [{ caught_up }] = await this.replicaDb.$queryRaw<[{ caught_up: boolean }]>`
      SELECT pg_last_wal_replay_lsn() >= ${lsn}::pg_lsn AS caught_up
    `;

    if (caught_up) {
      return query(); // Safe để đọc từ replica
    }

    // Replica chưa catch up → fallback về primary
    return query(); // Với primary DB context
  }
}
```

---

## 7. FAILOVER & HIGH AVAILABILITY

### 🔄 7.1 Manual Failover

```sql
-- Step 1: Verify primary is truly down
-- (Không promote nếu chỉ là network blip!)
SELECT pg_is_in_recovery(); -- Chạy trên primary → phải false

-- Step 2: Kiểm tra replica lag trước khi promote
-- Trên REPLICA:
SELECT
    pg_last_wal_receive_lsn(),
    pg_last_wal_replay_lsn(),
    pg_last_xact_replay_timestamp(),
    EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) AS lag_seconds;

-- Step 3: Promote replica
-- Method 1: SQL (PostgreSQL 12+)
SELECT pg_promote();

-- Method 2: pg_ctl
-- pg_ctl promote -D /var/lib/postgresql/16/main

-- Step 4: Verify promotion
SELECT pg_is_in_recovery(); -- Phải trả về false (không còn recovery mode)

-- Step 5: Reconfigure applications để point tới new primary
-- (Update connection strings, DNS, load balancer, etc.)
```

### 🤖 7.2 Automated Failover với Patroni

```yaml
# /etc/patroni/patroni.yml
scope: ecommerce-cluster
namespace: /db/
name: pg-node1

restapi:
  listen: 0.0.0.0:8008
  connect_address: 10.0.0.11:8008

etcd:
  hosts: 10.0.0.1:2379,10.0.0.2:2379,10.0.0.3:2379

bootstrap:
  dcs:
    ttl: 30                          # Leader lock TTL
    loop_wait: 10                    # Interval giữa các health check
    retry_timeout: 10                # Timeout cho DCS operations
    maximum_lag_on_failover: 1048576 # 1MB - không promote replica lag > 1MB
    postgresql:
      use_pg_rewind: true            # Cho phép pg_rewind khi rejoin
      use_slots: true                # Dùng replication slots
      parameters:
        wal_level: replica
        max_wal_senders: 10
        max_replication_slots: 10
        hot_standby: on
        wal_log_hints: on
        wal_keep_size: 1GB

  initdb:
    - encoding: UTF8
    - data-checksums

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.0.11:5432
  data_dir: /var/lib/postgresql/16/main
  authentication:
    superuser:
      username: postgres
      password: secure_password
    replication:
      username: replicator
      password: replication_password
  parameters:
    shared_buffers: 4GB
    effective_cache_size: 12GB
    work_mem: 256MB
    maintenance_work_mem: 1GB
```

#### Patroni Operations

```bash
# Xem cluster status
patronictl -c /etc/patroni/patroni.yml list ecommerce-cluster
# +----------+----------+---------+---------+----+-----------+
# | Member   | Host     | Role    | State   | TL | Lag in MB |
# +----------+----------+---------+---------+----+-----------+
# | pg-node1 | 10.0.0.11| Leader  | running | 5  |         0 |
# | pg-node2 | 10.0.0.12| Replica | running | 5  |       0.1 |
# | pg-node3 | 10.0.0.13| Replica | running | 5  |       0.0 |
# +----------+----------+---------+---------+----+-----------+

# Planned switchover (zero downtime)
patronictl -c /etc/patroni/patroni.yml switchover ecommerce-cluster \
  --master pg-node1 \
  --candidate pg-node2 \
  --force

# Emergency failover (khi leader down)
patronictl -c /etc/patroni/patroni.yml failover ecommerce-cluster \
  --candidate pg-node2 \
  --force

# Reinitialize node (sau failover, rejoin old primary as replica)
patronictl -c /etc/patroni/patroni.yml reinit ecommerce-cluster pg-node1
```

### 🌐 7.3 HAProxy cho Connection Routing

```
# haproxy.cfg - Route connections dựa trên Patroni REST API

global
    maxconn 1000

defaults
    mode tcp
    timeout connect 5s
    timeout client 30s
    timeout server 30s

# Frontend cho WRITE operations → chỉ tới Leader
listen postgresql_write
    bind *:5432
    option httpchk GET /primary
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server pg-node1 10.0.0.11:5432 check port 8008
    server pg-node2 10.0.0.12:5432 check port 8008
    server pg-node3 10.0.0.13:5432 check port 8008

# Frontend cho READ operations → tới bất kỳ Replica nào
listen postgresql_read
    bind *:5433
    balance roundrobin
    option httpchk GET /replica
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server pg-node1 10.0.0.11:5432 check port 8008
    server pg-node2 10.0.0.12:5432 check port 8008
    server pg-node3 10.0.0.13:5432 check port 8008
```

### 📊 Failover Decision Tree

```
Primary Unresponsive?
├── Có
│   ├── Verify: Primary thực sự down? (không chỉ network blip)
│   │   ├── Có: Primary down confirmed
│   │   │   ├── Check Replica Lag
│   │   │   │   ├── Lag < 1MB (maximum_lag_on_failover)
│   │   │   │   │   └── ✅ Promote replica (minimal/no data loss)
│   │   │   │   └── Lag > 1MB
│   │   │   │       ├── Wait 30s cho replica catch up
│   │   │   │       │   ├── Caught up → ✅ Promote
│   │   │   │       │   └── Không catch up
│   │   │   │       │       └── ⚠️ Business decision: accept data loss?
│   │   │   │       │           ├── Có → Promote (mất data)
│   │   │   │       │           └── Không → Wait / fix primary
│   │   │   └── Network partition possible?
│   │   │       ├── Có → Fencing (STONITH) primary trước khi promote
│   │   │       └── Không → Proceed with promotion
│   │   └── Không: Transient failure
│   │       └── Wait and retry (đừng failover vội)
│   └── Patroni/pg_auto_failover: Tự động xử lý
└── Không
    └── Investigate root cause
        └── Consider planned switchover nếu cần maintenance
```

---

## 8. INTEGRATION VỚI NESTJS APPLICATION

### 🔌 8.1 Database Connection Setup

```typescript
// src/shared/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const PRIMARY_DB_TOKEN = 'PRIMARY_DB';
const REPLICA_DB_TOKEN = 'REPLICA_DB';

@Global()
@Module({
  providers: [
    {
      provide: PRIMARY_DB_TOKEN,
      useFactory: () => {
        const prisma = new PrismaClient({
          datasources: {
            db: {
              // HAProxy write port hoặc direct primary
              url: process.env.DATABASE_PRIMARY_URL,
            },
          },
        });
        prisma.$connect();
        return prisma;
      },
    },
    {
      provide: REPLICA_DB_TOKEN,
      useFactory: () => {
        const prisma = new PrismaClient({
          datasources: {
            db: {
              // HAProxy read port hoặc direct replica
              url: process.env.DATABASE_REPLICA_URL,
            },
          },
        });
        prisma.$connect();
        return prisma;
      },
    },
  ],
  exports: [PRIMARY_DB_TOKEN, REPLICA_DB_TOKEN],
})
export class DatabaseModule {}
```

### 🔌 8.2 Read/Write Splitting Service

```typescript
// src/shared/services/database-routing.service.ts
@Injectable()
export class DatabaseRoutingService {
  constructor(
    @Inject('PRIMARY_DB') private primaryDb: PrismaClient,
    @Inject('REPLICA_DB') private replicaDb: PrismaClient,
    private cacheManager: Cache,
  ) {}

  get writer(): PrismaClient {
    return this.primaryDb;
  }

  get reader(): PrismaClient {
    return this.replicaDb;
  }

  async smartReader(userId?: number, entity?: string): Promise<PrismaClient> {
    if (!userId || !entity) return this.replicaDb;

    const recentWriteKey = `recent_write:${userId}:${entity}`;
    const hasRecentWrite = await this.cacheManager.get(recentWriteKey);

    // User vừa write → đọc từ primary để tránh stale data
    if (hasRecentWrite) return this.primaryDb;

    return this.replicaDb;
  }

  async trackWrite(userId: number, entity: string): Promise<void> {
    await this.cacheManager.set(
      `recent_write:${userId}:${entity}`,
      true,
      10, // TTL 10 seconds
    );
  }

  async healthCheck(): Promise<{
    primary: boolean;
    replica: boolean;
    replicaLag: number;
  }> {
    let primaryOk = false;
    let replicaOk = false;
    let lag = -1;

    try {
      await this.primaryDb.$queryRaw`SELECT 1`;
      primaryOk = true;
    } catch {}

    try {
      const [result] = await this.replicaDb.$queryRaw<[{ lag: number }]>`
        SELECT EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) AS lag
      `;
      replicaOk = true;
      lag = result.lag;
    } catch {}

    return { primary: primaryOk, replica: replicaOk, replicaLag: lag };
  }
}
```

### 🔌 8.3 Repository Pattern với Read/Write Splitting

```typescript
// src/routes/product/product.repo.ts
@Injectable()
export class ProductRepository {
  constructor(private db: DatabaseRoutingService) {}

  // READ operations → replica
  async findMany(filter: ProductFilter): Promise<Product[]> {
    return this.db.reader.product.findMany({
      where: {
        deletedAt: null,
        ...(filter.brandId && { brandId: filter.brandId }),
        ...(filter.minPrice && { base_price: { gte: filter.minPrice } }),
      },
      include: {
        productTranslations: {
          where: { languageId: filter.languageId || 'vi' },
        },
        brand: true,
      },
    });
  }

  // READ operations → replica
  async findById(id: number, languageId: string = 'vi'): Promise<Product | null> {
    return this.db.reader.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        productTranslations: { where: { languageId } },
        brand: true,
        SKUs: { where: { deletedAt: null } },
      },
    });
  }

  // WRITE operations → primary
  async create(data: CreateProductInput, userId: number): Promise<Product> {
    const product = await this.db.writer.product.create({
      data: {
        base_price: data.basePrice,
        virtual_price: data.virtualPrice,
        brandId: data.brandId,
        createdById: userId,
      },
    });

    await this.db.trackWrite(userId, 'product');
    return product;
  }

  // WRITE operations → primary
  async update(id: number, data: UpdateProductInput, userId: number): Promise<Product> {
    const product = await this.db.writer.product.update({
      where: { id },
      data: {
        ...data,
        updatedById: userId,
      },
    });

    await this.db.trackWrite(userId, 'product');
    return product;
  }
}
```

### 🔌 8.4 Order Service với Smart Routing

```typescript
// src/routes/order/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private db: DatabaseRoutingService,
    private readonly logger: Logger,
  ) {}

  async createOrder(userId: number, items: CreateOrderDto): Promise<Order> {
    // WRITE → primary (atomic transaction)
    const order = await this.db.writer.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          status: 'PENDING_CONFIRMATION',
          createdById: userId,
        },
      });

      for (const item of items.items) {
        const sku = await tx.sKU.findUnique({
          where: { id: item.skuId },
          include: { product: { include: { productTranslations: true } } },
        });

        if (!sku || sku.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for SKU ${item.skuId}`);
        }

        await tx.sKU.update({
          where: { id: sku.id },
          data: { stock: sku.stock - item.quantity },
        });

        await tx.productSKUSnapshot.create({
          data: {
            orderId: newOrder.id,
            skuId: sku.id,
            productName: sku.product.productTranslations[0]?.name || 'Unknown',
            price: sku.price,
            images: sku.images,
            skuValue: sku.value,
          },
        });
      }

      return newOrder;
    });

    // Track write cho read-your-writes consistency
    await this.db.trackWrite(userId, 'order');
    return order;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    // Smart read: primary nếu user vừa tạo order, replica nếu không
    const db = await this.db.smartReader(userId, 'order');

    return db.order.findMany({
      where: { userId, deletedAt: null },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: number, userId: number): Promise<Order> {
    const db = await this.db.smartReader(userId, 'order');

    return db.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include: {
        items: true,
      },
    });
  }

  // Analytics queries → luôn dùng replica (không cần fresh data)
  async getOrderStatistics(startDate: Date, endDate: Date): Promise<OrderStats> {
    const result = await this.db.reader.$queryRaw<[OrderStats]>`
      SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(pss.price), 0) AS total_revenue,
        COUNT(DISTINCT "userId")::int AS unique_customers
      FROM "Order" o
      LEFT JOIN "ProductSKUSnapshot" pss ON o.id = pss."orderId"
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" < ${endDate}
        AND o."deletedAt" IS NULL
        AND o.status IN ('DELIVERED', 'PENDING_DELIVERY')
    `;

    return result[0];
  }
}
```

---

## 9. MONITORING & TROUBLESHOOTING

### 📊 9.1 Essential Monitoring Queries

```sql
-- 1. Replication lag (chạy trên PRIMARY)
CREATE VIEW replication_monitor AS
SELECT
    client_addr,
    application_name,
    state,
    sync_state,
    pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS lag_bytes,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS total_lag,
    EXTRACT(EPOCH FROM now() - reply_time)::int AS last_reply_seconds_ago,
    write_lag,
    flush_lag,
    replay_lag
FROM pg_stat_replication;

-- 2. Replication slot health (ngăn WAL bloat)
CREATE VIEW replication_slot_monitor AS
SELECT
    slot_name,
    slot_type,
    active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal,
    pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS retained_wal_bytes
FROM pg_replication_slots
ORDER BY retained_wal_bytes DESC;

-- 3. WAL generation rate
SELECT
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0'::pg_lsn)
    ) AS total_wal_generated,
    pg_size_pretty(
        pg_wal_lsn_diff(
            pg_current_wal_lsn(),
            (SELECT sent_lsn FROM pg_stat_replication ORDER BY sent_lsn ASC LIMIT 1)
        )
    ) AS max_unsent_wal;

-- 4. Conflict monitoring trên replica
SELECT
    datname,
    confl_tablespace,
    confl_lock,
    confl_snapshot,
    confl_bufferpin,
    confl_deadlock
FROM pg_stat_database_conflicts;
```

### 📊 9.2 NestJS Monitoring Service

```typescript
// src/shared/services/replication-monitor.service.ts
@Injectable()
export class ReplicationMonitorService {
  constructor(
    @Inject('PRIMARY_DB') private primaryDb: PrismaClient,
    @Inject('REPLICA_DB') private replicaDb: PrismaClient,
    private readonly logger: Logger,
  ) {}

  @Cron('*/30 * * * * *') // Mỗi 30 giây
  async checkReplicationHealth(): Promise<void> {
    try {
      const status = await this.getReplicationStatus();

      for (const replica of status) {
        if (replica.lagBytes > 10 * 1024 * 1024) { // > 10MB
          this.logger.warn(
            `High replication lag: ${replica.applicationName} lag=${replica.lagPretty}`,
            'ReplicationMonitor',
          );
        }

        if (!replica.active) {
          this.logger.error(
            `Replica disconnected: ${replica.applicationName}`,
            'ReplicationMonitor',
          );
        }
      }

      // Check inactive replication slots (WAL bloat risk)
      const slots = await this.getSlotStatus();
      for (const slot of slots) {
        if (!slot.active && slot.retainedBytes > 1024 * 1024 * 1024) { // > 1GB
          this.logger.error(
            `Inactive slot retaining ${slot.retainedPretty} WAL: ${slot.slotName}`,
            'ReplicationMonitor',
          );
        }
      }
    } catch (error) {
      this.logger.error(`Replication health check failed: ${error.message}`, 'ReplicationMonitor');
    }
  }

  async getReplicationStatus(): Promise<ReplicationStatus[]> {
    return this.primaryDb.$queryRaw<ReplicationStatus[]>`
      SELECT
        client_addr AS "clientAddr",
        application_name AS "applicationName",
        state,
        sync_state AS "syncState",
        state = 'streaming' AS active,
        pg_wal_lsn_diff(sent_lsn, replay_lsn)::bigint AS "lagBytes",
        pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS "lagPretty"
      FROM pg_stat_replication
    `;
  }

  async getSlotStatus(): Promise<SlotStatus[]> {
    return this.primaryDb.$queryRaw<SlotStatus[]>`
      SELECT
        slot_name AS "slotName",
        active,
        pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)::bigint AS "retainedBytes",
        pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS "retainedPretty"
      FROM pg_replication_slots
    `;
  }
}
```

### 🔍 9.3 Troubleshooting Common Issues

#### Issue 1: Replication Lag tăng liên tục

```sql
-- Kiểm tra WAL generation rate vs apply rate
SELECT
    pg_current_wal_lsn() AS current_wal,
    (SELECT replay_lsn FROM pg_stat_replication LIMIT 1) AS replica_replay,
    pg_size_pretty(pg_wal_lsn_diff(
        pg_current_wal_lsn(),
        (SELECT replay_lsn FROM pg_stat_replication LIMIT 1)
    )) AS gap;

-- Kiểm tra long-running queries trên replica block WAL apply
-- Chạy trên REPLICA:
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '1 minute'
ORDER BY duration DESC;

-- Giải pháp:
-- 1. Cancel long queries: SELECT pg_cancel_backend(pid);
-- 2. Tăng max_standby_streaming_delay
-- 3. Dùng dedicated reporting replica cho heavy queries
```

#### Issue 2: Replication Slot WAL Bloat

```sql
-- Slot inactive giữ lại quá nhiều WAL → disk full risk
SELECT slot_name, active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots
WHERE NOT active;

-- Drop inactive slot để giải phóng WAL
SELECT pg_drop_replication_slot('dead_replica_slot');
```

#### Issue 3: Split-Brain (2 nodes nghĩ mình là primary)

```
Triệu chứng: Cả 2 nodes nhận writes → data diverge!

Nguyên nhân:
- Network partition giữa primary và replica
- Replica được promote sai thời điểm
- Patroni/failover tool misconfigured

Giải pháp:
1. Dùng fencing (STONITH - Shoot The Other Node In The Head)
   → Force shutdown old primary trước khi promote replica
2. Patroni with etcd quorum: cần majority nodes đồng ý
3. HAProxy health checks: chỉ route traffic tới verified leader
```

---

## 10. BEST PRACTICES & PRODUCTION CHECKLIST

### ✅ Production Checklist

#### Infrastructure

- [ ] Minimum 1 primary + 2 replicas (cho HA)
- [ ] Replicas trên physical servers/AZ khác primary
- [ ] Replication slots được tạo cho mỗi replica
- [ ] WAL archiving enabled cho point-in-time recovery
- [ ] HAProxy/PgBouncer cho connection routing
- [ ] Patroni hoặc pg_auto_failover cho automated failover

#### Configuration

- [ ] `wal_level = replica`
- [ ] `max_wal_senders >= 10`
- [ ] `max_replication_slots >= số replicas + buffer`
- [ ] `wal_keep_size = 1GB` (hoặc phù hợp với traffic)
- [ ] `hot_standby = on` trên replicas
- [ ] `hot_standby_feedback = on` trên replicas
- [ ] `synchronous_commit` phù hợp với RPO requirements
- [ ] `max_standby_streaming_delay` cho reporting replicas

#### Application

- [ ] Read/write splitting implemented
- [ ] Read-your-writes consistency cho user-facing operations
- [ ] Connection retry logic khi failover
- [ ] Circuit breaker cho database connections
- [ ] Health check endpoint bao gồm replication status

#### Monitoring

- [ ] Replication lag alerting (> 10MB → warning, > 100MB → critical)
- [ ] Replication slot WAL retention alerting (> 5GB → warning)
- [ ] Replica disconnection alerting
- [ ] WAL disk usage monitoring
- [ ] Query performance trên replicas

#### Testing

- [ ] Failover test hàng quý (quarterly)
- [ ] Planned switchover test hàng tháng
- [ ] Replica lag behavior under load test
- [ ] Network partition simulation
- [ ] Application behavior during failover test

### 🎯 Key Takeaways

1. **Start với Single-Master**: Async replication + read replicas xử lý được hầu hết use cases
2. **Read/Write Splitting là must-have**: Giảm load primary, tận dụng replicas
3. **Read-your-writes Consistency**: Giải quyết 90% user-facing stale data issues
4. **Sync Replication chỉ khi cần**: Chỉ cho financial/payment data, không phải everything
5. **Automate Failover**: Patroni + etcd là gold standard cho PostgreSQL HA
6. **Monitor Replication Lag liên tục**: Lag tăng là early warning cho nhiều vấn đề
7. **Test Failover TRƯỚC KHI cần**: Không bao giờ test failover lần đầu trong production outage
8. **Watch Replication Slots**: Inactive slots có thể fill disk rất nhanh

---

## 📚 TÀI LIỆU THAM KHẢO

- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [PostgreSQL High Availability Documentation](https://www.postgresql.org/docs/current/high-availability.html)
- [Patroni - PostgreSQL HA](https://patroni.readthedocs.io/en/latest/)
- [pg_auto_failover](https://pg-auto-failover.readthedocs.io/en/latest/)
- [HAProxy for PostgreSQL](https://www.haproxy.org/)
- [Database Replication Best Practices - Zylos Research](https://zylos.ai/research/2026-02-13-database-replication)
- [System Design: Replication Patterns - Application Architect](https://www.application-architect.com/posts/system-design-replication-patterns-master-slave-multi-master/)
- [PostgreSQL HA with Patroni - Zalando](https://github.com/zalando/patroni)
