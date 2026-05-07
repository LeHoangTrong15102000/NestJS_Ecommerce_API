# So Sánh Chuyên Sâu: PostgreSQL vs MySQL

> Tài liệu phỏng vấn Backend/Fintech — So sánh toàn diện hai RDBMS phổ biến nhất

---

## Mục lục

1. [Tổng quan & Lịch sử](#1-tổng-quan--lịch-sử)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [MVCC & Concurrency Control](#3-mvcc--concurrency-control)
4. [Locking Mechanisms](#4-locking-mechanisms)
5. [Isolation Levels](#5-isolation-levels)
6. [Indexing](#6-indexing)
7. [Data Types](#7-data-types)
8. [JSON Support](#8-json-support)
9. [Full-Text Search](#9-full-text-search)
10. [Partitioning](#10-partitioning)
11. [Replication](#11-replication)
12. [Stored Procedures & Functions](#12-stored-procedures--functions)
13. [Performance Characteristics](#13-performance-characteristics)
14. [Scalability](#14-scalability)
15. [Security](#15-security)
16. [Ecosystem & Tooling](#16-ecosystem--tooling)
17. [Khi nào chọn cái nào?](#17-khi-nào-chọn-cái-nào)
18. [Câu hỏi phỏng vấn thường gặp](#18-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Tổng quan & Lịch sử

| Tiêu chí | PostgreSQL | MySQL |
|----------|-----------|-------|
| **Năm ra đời** | 1996 (gốc từ POSTGRES 1986) | 1995 |
| **Tổ chức phát triển** | PostgreSQL Global Development Group (cộng đồng) | Oracle Corporation (từ 2010) |
| **License** | PostgreSQL License (permissive, tương tự MIT/BSD) | GPL v2 (Community) / Commercial (Enterprise) |
| **Triết lý** | Feature-rich, standards-compliant, extensible | Simple, fast, reliable, easy to use |
| **SQL Compliance** | Rất cao (gần đầy đủ SQL:2016) | Trung bình (nhiều extension riêng) |
| **Phiên bản mới nhất** | PostgreSQL 16 (2023), 17 (2024) | MySQL 8.0 (LTS), 8.4 (Innovation) |

### Điểm mạnh cốt lõi:

**PostgreSQL:**
- Extensibility (custom types, operators, index methods)
- Advanced query optimizer
- Rich data types (JSONB, arrays, hstore, range types)
- True MVCC without undo logs
- Standards compliance

**MySQL (InnoDB):**
- Đơn giản, dễ học, dễ triển khai
- Read performance tốt (đặc biệt simple queries)
- Ecosystem rộng lớn (WordPress, Drupal, Magento...)
- Replication đơn giản và ổn định
- Thread-per-connection → nhẹ hơn về memory cho nhiều connections ngắn

---

## 2. Kiến trúc hệ thống

### 2.1 Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL (Multi-Process)                   │
├─────────────────────────────────────────────────────────────────┤
│  Client ──→ Postmaster (main process)                            │
│                 │                                                 │
│                 ├── Backend Process 1 (1 connection = 1 process)  │
│                 ├── Backend Process 2                             │
│                 ├── Backend Process 3                             │
│                 │                                                 │
│                 ├── Background Writer                             │
│                 ├── WAL Writer                                    │
│                 ├── Checkpointer                                  │
│                 ├── Autovacuum Launcher                           │
│                 └── Stats Collector                               │
│                                                                   │
│  Shared Memory: shared_buffers, WAL buffers, lock tables         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      MySQL (Multi-Thread)                         │
├─────────────────────────────────────────────────────────────────┤
│  Client ──→ mysqld (single process)                              │
│                 │                                                 │
│                 ├── Connection Thread 1 (1 connection = 1 thread) │
│                 ├── Connection Thread 2                           │
│                 ├── Connection Thread 3                           │
│                 │                                                 │
│                 ├── InnoDB Background Threads                     │
│                 │     ├── Page Cleaner Thread                     │
│                 │     ├── Purge Thread                            │
│                 │     ├── Redo Log Thread                         │
│                 │     └── Insert Buffer Thread                    │
│                 │                                                 │
│                 └── Replication Threads (IO + SQL)                │
│                                                                   │
│  Shared: InnoDB Buffer Pool, Query Cache (removed 8.0),          │
│          Thread Cache, Table Cache                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 So sánh kiến trúc

| Tiêu chí | PostgreSQL | MySQL (InnoDB) |
|----------|-----------|----------------|
| **Process model** | Multi-process (fork per connection) | Multi-thread (thread per connection) |
| **Memory overhead/connection** | ~5-10 MB/process | ~1-2 MB/thread |
| **Context switching** | OS-level (nặng hơn) | User-level threads (nhẹ hơn) |
| **Crash isolation** | Process crash không ảnh hưởng process khác | Thread crash có thể crash toàn bộ mysqld |
| **Connection pooling** | Gần như bắt buộc (PgBouncer, Pgpool-II) | Ít cần hơn nhưng vẫn nên dùng (ProxySQL) |
| **Max connections thực tế** | 200-500 (cần pooler cho hơn) | 1000-5000 (nhẹ hơn per connection) |
| **Storage engine** | Chỉ 1 (heap-based, tích hợp) | Pluggable (InnoDB default, MyISAM, Memory...) |

### 2.3 Storage Architecture

**PostgreSQL — Heap-based storage:**
```
Table File (heap) → Pages (8KB mỗi page)
  └── Tuple (row) chứa: header + data + xmin/xmax (transaction IDs)

Index → trỏ đến (page_number, offset) trong heap
```

**MySQL InnoDB — Clustered Index (B+Tree):**
```
Primary Key (Clustered Index) = Data storage
  └── Leaf nodes chứa toàn bộ row data

Secondary Index → leaf nodes chứa Primary Key value
  └── Cần "double lookup": Secondary Index → PK → Clustered Index → Row
```

| Đặc điểm | PostgreSQL | MySQL InnoDB |
|----------|-----------|--------------|
| **Data organization** | Heap (unordered) | Clustered by PK (ordered) |
| **Index lookup** | Index → TID (direct pointer) | Secondary → PK → Data (double lookup) |
| **Table without PK** | Hoạt động bình thường | InnoDB tự tạo hidden PK (6 bytes) |
| **HOT update** | Có (Heap-Only Tuple) — update không cần update index | Không có concept tương đương |
| **Dead tuples** | Cần VACUUM để dọn | Purge thread tự dọn undo log |
| **Page size** | 8 KB (default) | 16 KB (default) |

---

## 3. MVCC & Concurrency Control

### 3.1 PostgreSQL MVCC — Snapshot-based

```
PostgreSQL lưu multiple versions của row TRONG CÙNG TABLE (heap):

Row v1: xmin=100, xmax=200  ← "dead" (đã bị update bởi TX 200)
Row v2: xmin=200, xmax=∞    ← "live" (version hiện tại)

Mỗi transaction có snapshot chứa:
- xmin: TX ID nhỏ nhất còn active
- xmax: TX ID tiếp theo sẽ được cấp
- xip_list: danh sách TX IDs đang active

Visibility check: row visible nếu:
  1. xmin đã committed VÀ xmin < snapshot.xmax VÀ xmin không trong xip_list
  2. xmax chưa set HOẶC xmax chưa committed HOẶC xmax > snapshot.xmax
```

### 3.2 MySQL InnoDB MVCC — Undo Log-based

```
MySQL InnoDB lưu CURRENT version trong clustered index,
OLD versions trong Undo Log (rollback segment):

Clustered Index: Row (current) → roll_pointer → Undo Log
                                                    │
                                    Undo Record v2 → roll_pointer → Undo Record v1

Mỗi row có hidden columns:
- DB_TRX_ID: TX ID cuối cùng modify row
- DB_ROLL_PTR: pointer đến undo log record
- DB_ROW_ID: hidden PK (nếu không có explicit PK)

Read View (tương đương snapshot):
- m_low_limit_id: TX ID tiếp theo sẽ được cấp
- m_up_limit_id: TX ID nhỏ nhất còn active
- m_ids: danh sách TX IDs đang active khi tạo Read View
- m_creator_trx_id: TX ID tạo Read View này
```

### 3.3 So sánh MVCC

| Tiêu chí | PostgreSQL | MySQL InnoDB |
|----------|-----------|--------------|
| **Nơi lưu old versions** | Trong heap (cùng table) | Undo Log (riêng biệt) |
| **Cleanup mechanism** | VACUUM (background + manual) | Purge Thread (tự động) |
| **Bloat risk** | Có (table bloat nếu VACUUM chậm) | Ít hơn (undo log tách biệt) |
| **Read performance khi có nhiều versions** | Có thể chậm (scan qua dead tuples) | Tốt hơn (current version luôn ở index) |
| **Write amplification** | Cao hơn (mỗi UPDATE = INSERT new + mark old dead) | Thấp hơn (update in-place + write undo) |
| **Index maintenance khi UPDATE** | Phải update TẤT CẢ indexes (trừ HOT) | Chỉ update indexes có column thay đổi |
| **Long-running TX impact** | Ngăn VACUUM → table bloat | Undo log tăng → purge lag |

### 3.4 Hệ quả thực tế

**PostgreSQL:**
```sql
-- Table bloat scenario:
-- Long-running transaction giữ snapshot → VACUUM không thể dọn dead tuples
-- Giải pháp: monitor pg_stat_user_tables.n_dead_tup, tune autovacuum

-- Kiểm tra bloat:
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

**MySQL InnoDB:**
```sql
-- Undo log growth scenario:
-- Long-running TX → undo log không được purge → ibdata1 tăng (trước 5.7)
-- MySQL 8.0+: undo tablespace riêng, có thể truncate

-- Kiểm tra:
SHOW ENGINE INNODB STATUS\G
-- Xem section "TRANSACTIONS" → History list length (số undo records chưa purge)
```

---

## 4. Locking Mechanisms

### 4.1 PostgreSQL Locking

```
Lock Levels (từ yếu → mạnh):
1. ACCESS SHARE          ← SELECT
2. ROW SHARE             ← SELECT FOR UPDATE/SHARE
3. ROW EXCLUSIVE         ← INSERT/UPDATE/DELETE
4. SHARE UPDATE EXCLUSIVE ← VACUUM, CREATE INDEX CONCURRENTLY
5. SHARE                 ← CREATE INDEX (non-concurrent)
6. SHARE ROW EXCLUSIVE   ← CREATE TRIGGER
7. EXCLUSIVE             ← REFRESH MATERIALIZED VIEW CONCURRENTLY
8. ACCESS EXCLUSIVE      ← ALTER TABLE, DROP TABLE, VACUUM FULL

Row-level locks:
- FOR UPDATE: exclusive row lock
- FOR NO KEY UPDATE: weaker exclusive (không block FOR KEY SHARE)
- FOR SHARE: shared row lock
- FOR KEY SHARE: weakest shared (chỉ block FOR UPDATE)

Advisory Locks:
- pg_advisory_lock(key): session-level
- pg_try_advisory_lock(key): non-blocking
- pg_advisory_xact_lock(key): transaction-level
```

### 4.2 MySQL InnoDB Locking

```
Lock Types:
1. Shared Lock (S): SELECT ... FOR SHARE (trước 8.0: LOCK IN SHARE MODE)
2. Exclusive Lock (X): SELECT ... FOR UPDATE, INSERT, UPDATE, DELETE

Row Lock Algorithms (ĐẶC TRƯNG MySQL):
┌─────────────────────────────────────────────────────────────┐
│ Record Lock: lock chính xác 1 index record                   │
│ Gap Lock: lock khoảng trống GIỮA 2 index records            │
│ Next-Key Lock = Record Lock + Gap Lock (trước record đó)     │
│ Insert Intention Lock: gap lock đặc biệt cho INSERT          │
└─────────────────────────────────────────────────────────────┘

Ví dụ với index values: 10, 20, 30
- Record Lock on 20: chỉ lock record 20
- Gap Lock (10, 20): lock khoảng trống, ngăn INSERT giá trị 11-19
- Next-Key Lock (10, 20]: lock gap + record 20
- Insert Intention Lock: cho phép multiple INSERTs vào cùng gap
  (nếu không conflict actual value)

Table-level:
- LOCK TABLES ... READ/WRITE
- Intention Locks (IS, IX): signal row-level lock existence
- AUTO-INC Lock: cho auto_increment columns
```

### 4.3 So sánh Locking

| Tiêu chí | PostgreSQL | MySQL InnoDB |
|----------|-----------|--------------|
| **Gap Lock** | KHÔNG CÓ | Có (đặc trưng, ngăn phantom reads) |
| **Next-Key Lock** | KHÔNG CÓ | Có (default ở REPEATABLE READ) |
| **Phantom Read prevention** | Dùng MVCC snapshot (không lock) | Dùng Gap Lock (physical lock) |
| **Deadlock từ gap lock** | Không xảy ra | Phổ biến (gap lock conflicts) |
| **Advisory Lock** | Có (rất mạnh, flexible) | Có (GET_LOCK/RELEASE_LOCK, đơn giản hơn) |
| **Predicate Lock** | Có (ở SERIALIZABLE) | Không có (dùng gap lock thay thế) |
| **Lock escalation** | Không có | Không có |
| **Row lock granularity** | 4 levels (UPDATE/NO KEY UPDATE/SHARE/KEY SHARE) | 2 levels (S/X) |

### 4.4 Ví dụ thực tế — Tại sao Gap Lock gây deadlock

```sql
-- MySQL: 2 transactions INSERT vào cùng range → deadlock
-- Table: orders (id PK, user_id INDEX, amount)
-- Existing rows: user_id = 1, 5, 10

-- TX1:
BEGIN;
SELECT * FROM orders WHERE user_id = 7 FOR UPDATE;
-- Lock gap (5, 10) — không tìm thấy row nhưng vẫn lock gap

-- TX2:
BEGIN;
SELECT * FROM orders WHERE user_id = 8 FOR UPDATE;
-- Cũng lock gap (5, 10) — Gap locks KHÔNG conflict với nhau!

-- TX1:
INSERT INTO orders (user_id, amount) VALUES (7, 100);
-- Chờ TX2's gap lock (Insert Intention Lock conflict với Gap Lock)

-- TX2:
INSERT INTO orders (user_id, amount) VALUES (8, 200);
-- Chờ TX1's gap lock → DEADLOCK!

-- PostgreSQL: KHÔNG có vấn đề này vì không có gap lock
-- Cả 2 INSERT đều thành công song song
```

---

## 5. Isolation Levels

### 5.1 Bảng so sánh

| Isolation Level | PostgreSQL | MySQL InnoDB |
|----------------|-----------|--------------|
| **READ UNCOMMITTED** | Có nhưng = READ COMMITTED (không cho dirty read) | Có (cho phép dirty read) |
| **READ COMMITTED** | **DEFAULT** — mỗi statement lấy snapshot mới | Có — mỗi statement lấy Read View mới |
| **REPEATABLE READ** | Snapshot cố định từ đầu TX, dùng MVCC thuần | **DEFAULT** — Read View cố định + Gap Lock |
| **SERIALIZABLE** | SSI (Serializable Snapshot Isolation) — optimistic | S2PL-like (mọi SELECT → SELECT FOR SHARE) |

### 5.2 Chi tiết khác biệt quan trọng

**REPEATABLE READ:**

| Behavior | PostgreSQL RR | MySQL RR |
|----------|--------------|----------|
| **Phantom Read** | CÓ THỂ XẢY RA (MVCC snapshot chỉ thấy data tại thời điểm snapshot) | KHÔNG xảy ra cho locking reads (Gap Lock ngăn INSERT) |
| **Non-repeatable read** | Không xảy ra | Không xảy ra |
| **Write conflict** | ERROR nếu 2 TX update cùng row (first-updater-wins) | TX2 chờ lock, rồi update (last-writer-wins) |
| **Lost update** | Ngăn được (serialization failure) | CÓ THỂ xảy ra nếu không dùng FOR UPDATE |

```sql
-- PostgreSQL RR: Write conflict detection
-- TX1: UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- TX2: UPDATE accounts SET balance = balance - 50 WHERE id = 1;
-- TX2 nhận ERROR: could not serialize access due to concurrent update
-- → Application phải RETRY

-- MySQL RR: No write conflict detection
-- TX1: UPDATE accounts SET balance = balance - 100 WHERE id = 1; (lock row)
-- TX2: UPDATE accounts SET balance = balance - 50 WHERE id = 1; (WAIT for lock)
-- TX1 COMMIT → TX2 proceeds, updates based on TX1's committed value
-- → Không cần retry nhưng cần SELECT FOR UPDATE để đọc latest
```

**SERIALIZABLE:**

| Behavior | PostgreSQL SERIALIZABLE | MySQL SERIALIZABLE |
|----------|------------------------|-------------------|
| **Mechanism** | SSI (Serializable Snapshot Isolation) | Implicit LOCK IN SHARE MODE on all SELECTs |
| **Blocking** | Non-blocking reads (optimistic) | Blocking reads (pessimistic) |
| **Performance** | Tốt hơn (ít lock contention) | Kém hơn (shared locks everywhere) |
| **Failure mode** | Serialization failure → retry | Deadlock/lock wait timeout |
| **Throughput** | Cao hơn đáng kể | Thấp (không phù hợp OLTP cao tải) |

---

## 6. Indexing

### 6.1 Index Types

| Index Type | PostgreSQL | MySQL InnoDB |
|-----------|-----------|--------------|
| **B-Tree** | Default, rất tối ưu | Default (Clustered + Secondary) |
| **Hash** | Có (WAL-logged từ PG 10) | Adaptive Hash Index (tự động, internal) |
| **GiST** | Có (Generalized Search Tree) | Không |
| **GIN** | Có (Generalized Inverted Index) | Không |
| **BRIN** | Có (Block Range Index) | Không |
| **SP-GiST** | Có (Space-Partitioned GiST) | Không |
| **Full-text** | GIN-based (tsvector/tsquery) | FULLTEXT index (InnoDB từ 5.6) |
| **Spatial/GIS** | PostGIS extension (GiST/SP-GiST) | Spatial index (R-Tree via InnoDB) |
| **Partial Index** | Có (WHERE clause) | Không |
| **Expression Index** | Có (index on function result) | Functional index (MySQL 8.0+) |
| **Covering Index** | INCLUDE clause (PG 11+) | Implicit (secondary index + PK) |
| **Invisible Index** | Không | Có (MySQL 8.0+) |
| **Descending Index** | Có (từ lâu) | Có (MySQL 8.0+) |
| **Multi-value Index** | GIN on arrays/JSONB | Multi-Valued Index (8.0.17+ cho JSON arrays) |

### 6.2 Partial Index (PostgreSQL exclusive)

```sql
-- PostgreSQL: chỉ index rows thỏa điều kiện
CREATE INDEX idx_orders_pending ON orders(created_at)
WHERE status = 'PENDING';
-- Chỉ ~5% rows được index → index nhỏ hơn 20x
-- Query: SELECT * FROM orders WHERE status = 'PENDING' ORDER BY created_at;
-- → Dùng idx_orders_pending (rất nhanh)

-- MySQL: KHÔNG CÓ partial index
-- Phải index toàn bộ: CREATE INDEX idx_status_created ON orders(status, created_at);
```

### 6.3 GIN & BRIN Index (PostgreSQL exclusive)

```sql
-- GIN: Inverted index — tối ưu cho arrays, JSONB, full-text search
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_meta ON products USING GIN(metadata jsonb_path_ops);

-- BRIN: Block Range Index — cực nhỏ, cho time-series/append-only data
CREATE INDEX idx_logs_created ON logs USING BRIN(created_at);
-- Size: ~0.1% so với B-Tree tương đương
-- Trade-off: kém chính xác hơn nhưng cực kỳ nhỏ gọn
```

### 6.4 Index và MVCC

| Behavior | PostgreSQL | MySQL InnoDB |
|----------|-----------|--------------|
| **Index contains dead tuples?** | Có (cho đến khi VACUUM) | Không (purge dọn undo) |
| **Index-only scan** | Cần check visibility map | Luôn có thể (covering index) |
| **HOT update** | Có (update không cần update index) | Không có concept này |
| **Online index creation** | CREATE INDEX CONCURRENTLY | ALTER TABLE ALGORITHM=INPLACE |

---

## 7. Data Types

| Category | PostgreSQL | MySQL |
|----------|-----------|-------|
| **Integer** | smallint, integer, bigint | TINYINT, SMALLINT, MEDIUMINT, INT, BIGINT |
| **Serial/Auto** | SERIAL, IDENTITY | AUTO_INCREMENT |
| **String** | varchar(n), text (unlimited) | VARCHAR(65535), TEXT, MEDIUMTEXT, LONGTEXT |
| **Boolean** | boolean (true/false) | BOOLEAN = TINYINT(1) |
| **JSON** | json, **jsonb** (binary, indexable) | JSON (binary internally) |
| **UUID** | uuid (native type) | Không native (CHAR(36) hoặc BINARY(16)) |
| **Array** | integer[], text[], etc. | KHÔNG CÓ |
| **Range** | int4range, tsrange, daterange | KHÔNG CÓ |
| **Network** | inet, cidr, macaddr | KHÔNG CÓ |
| **Composite** | CREATE TYPE AS (...) | KHÔNG CÓ |
| **Enum** | CREATE TYPE AS ENUM | ENUM column-level |
| **hstore** | key-value pairs | KHÔNG CÓ |

**PostgreSQL arrays — ví dụ:**
```sql
CREATE TABLE products (id SERIAL PRIMARY KEY, tags TEXT[], prices NUMERIC[]);
INSERT INTO products (tags, prices) VALUES (ARRAY['electronics','sale'], ARRAY[999.99, 899.99]);
SELECT * FROM products WHERE 'electronics' = ANY(tags);
SELECT * FROM products WHERE tags @> ARRAY['electronics'];
CREATE INDEX idx_tags ON products USING GIN(tags);
```

---

## 8. JSON Support

| Feature | PostgreSQL (JSONB) | MySQL (JSON) |
|---------|-------------------|--------------|
| **Storage** | Binary (decomposed, sorted keys) | Binary (DOM-like, preserved order) |
| **Indexing** | GIN index trên toàn bộ JSONB | Generated columns + B-Tree, Multi-Valued Index |
| **Partial update** | Không (full rewrite) | Có (JSON_SET, MySQL 8.0+) |
| **Operators** | @>, <@, ?, ?&, ?|, ->, ->>, #>, @? | ->, ->>, JSON_EXTRACT, JSON_CONTAINS |
| **Path query** | jsonpath (SQL/JSON, PG 12+) | JSON_EXTRACT('$.path') |
| **Schema validation** | CHECK + IS JSON | JSON_SCHEMA_VALID (8.0.17+) |

```sql
-- PostgreSQL: GIN index cho toàn bộ JSONB
CREATE INDEX idx_data ON events USING GIN(data);
SELECT * FROM events WHERE data @> '{"type": "purchase"}';
SELECT * FROM events WHERE data @? '$.items[*] ? (@.price > 50)';

-- MySQL: cần generated column cho index
ALTER TABLE events ADD COLUMN event_type VARCHAR(50)
  GENERATED ALWAYS AS (data->>'$.type') STORED;
CREATE INDEX idx_type ON events(event_type);
```

---

## 9. Full-Text Search

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Mechanism** | tsvector + tsquery + GIN | FULLTEXT index |
| **Languages** | 30+ dictionaries | Hạn chế |
| **Ranking** | ts_rank, ts_rank_cd | MATCH AGAINST score |
| **Fuzzy search** | pg_trgm (trigram similarity) | Không native |
| **Custom dictionaries** | Có (thesaurus, synonym) | Không |
| **Highlighting** | ts_headline() | Không native |
| **Weights** | A, B, C, D (setweight) | Không |

```sql
-- PostgreSQL: weighted full-text search + fuzzy
CREATE EXTENSION pg_trgm;
ALTER TABLE products ADD COLUMN search_vector tsvector;
UPDATE products SET search_vector =
  setweight(to_tsvector('english', name), 'A') ||
  setweight(to_tsvector('english', description), 'B');
CREATE INDEX idx_fts ON products USING GIN(search_vector);
CREATE INDEX idx_trgm ON products USING GIN(name gin_trgm_ops);

-- Exact search
SELECT * FROM products WHERE search_vector @@ to_tsquery('english', 'wireless & headphone');
-- Fuzzy search (typo-tolerant)
SELECT * FROM products WHERE name % 'wireles headfone';

-- MySQL: simpler but less powerful
ALTER TABLE products ADD FULLTEXT INDEX ft_idx(name, description);
SELECT * FROM products
WHERE MATCH(name, description) AGAINST('+wireless +headphone' IN BOOLEAN MODE);
```

---

## 10. Partitioning

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Declarative partitioning** | Có (PG 10+) | Có |
| **Partition types** | RANGE, LIST, HASH (PG 11+) | RANGE, LIST, HASH, KEY |
| **Sub-partitioning** | Có (composite) | Có |
| **Partition pruning** | Có (automatic) | Có (automatic) |
| **Max partitions** | Không giới hạn cứng | 8192 |
| **Foreign keys on partitioned table** | Có (PG 12+) | KHÔNG (major limitation) |
| **Attach/Detach** | ALTER TABLE ATTACH/DETACH PARTITION | ALTER TABLE EXCHANGE PARTITION |

```sql
-- PostgreSQL declarative partitioning
CREATE TABLE orders (
  id BIGSERIAL, created_at TIMESTAMPTZ NOT NULL, amount NUMERIC
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_q1 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

-- MySQL partitioning (lưu ý: KHÔNG hỗ trợ FK!)
CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT, created_at DATETIME NOT NULL, amount DECIMAL(10,2),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
  PARTITION p2024q1 VALUES LESS THAN (202404),
  PARTITION p2024q2 VALUES LESS THAN (202407)
);
```

---

## 11. Replication

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Mechanism** | WAL (Write-Ahead Log) streaming | Binary Log (binlog) |
| **Physical replication** | Có (byte-level WAL) | Không |
| **Logical replication** | Có (PG 10+, pub/sub) | Có (binlog-based) |
| **Synchronous replication** | Có (quorum commit) | Có (semi-sync, Group Replication) |
| **Multi-source** | Không native | Có (replica nhận từ nhiều sources) |
| **Failover** | Patroni, repmgr | InnoDB Cluster, orchestrator |
| **GTID** | LSN-based | GTID (Global Transaction ID) |

```
PostgreSQL: Primary → WAL stream → Standby (hot standby = read queries)
MySQL: Source → binlog dump → Replica (IO Thread → Relay Log → SQL Thread)
```

---

## 12. Stored Procedures & Functions

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Languages** | PL/pgSQL, PL/Python, PL/Perl, PL/V8 | SQL, PL/SQL-like only |
| **FUNCTION vs PROCEDURE** | Cả hai (PROCEDURE từ PG 11) | Cả hai |
| **Transaction control** | Có (COMMIT/ROLLBACK trong procedure) | Có |
| **Return TABLE** | Có (RETURNS TABLE) | Không (dùng result set) |
| **Custom aggregates** | Có | Không |
| **C extensions** | Có | UDF (limited) |

---

## 13. Performance Characteristics

| Workload | PostgreSQL | MySQL InnoDB |
|----------|-----------|--------------|
| **Simple SELECT by PK** | Nhanh | Nhanh hơn (clustered index) |
| **Complex queries (JOIN, CTE)** | Tốt hơn (optimizer mạnh) | Kém hơn |
| **UPDATE-heavy** | Kém hơn (write amplification) | Tốt hơn (in-place update) |
| **OLAP/Analytics** | Tốt hơn (parallel query, JIT) | Kém hơn |
| **High connection count** | Cần pooler | Tốt hơn native |
| **JSON workload** | Tốt hơn (JSONB + GIN) | Kém hơn |

**Query Optimizer:**

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Join algorithms** | Nested Loop, Hash Join, Merge Join | Nested Loop, Hash Join (8.0.18+) |
| **Parallel query** | Có (PG 9.6+) | Hạn chế |
| **JIT compilation** | Có (PG 11+, LLVM) | Không |
| **Histograms** | Có (built-in) | Có (MySQL 8.0+, manual ANALYZE) |

---

## 14. Scalability

| Strategy | PostgreSQL | MySQL |
|----------|-----------|-------|
| **Vertical** | Tốt (parallel query) | Tốt |
| **Read replicas** | WAL streaming | Binlog replication |
| **Connection pooling** | PgBouncer, Pgpool-II | ProxySQL, MySQL Router |
| **Sharding** | Citus extension | Vitess, PlanetScale |
| **Distributed SQL** | CockroachDB, YugabyteDB (PG-compatible) | TiDB (MySQL-compatible) |
| **Multi-master** | BDR extension, Citus | Group Replication, NDB Cluster |
| **Serverless** | Neon, Supabase | PlanetScale |

---

## 15. Security

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| **Row-Level Security (RLS)** | Có (native, policy-based) | KHÔNG CÓ |
| **Column-level privileges** | Có | Có |
| **Authentication** | scram-sha-256, cert, GSSAPI, LDAP | caching_sha2_password, LDAP |
| **Audit** | pgAudit extension (free) | Enterprise Audit (paid) |
| **Encryption at rest** | TDE (extensions) | InnoDB tablespace encryption |
| **Roles** | Hierarchical, INHERIT | Có (MySQL 8.0+) |

```sql
-- PostgreSQL RLS (MySQL KHÔNG CÓ equivalent)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::INT);
-- Mọi query tự động filtered — dù developer quên WHERE clause!
```

---

## 16. Ecosystem & Tooling

| Category | PostgreSQL | MySQL |
|----------|-----------|-------|
| **ORM** | Prisma, TypeORM, Sequelize, Drizzle | Prisma, TypeORM, Sequelize, Drizzle |
| **GUI** | pgAdmin, DBeaver, DataGrip | MySQL Workbench, phpMyAdmin, DBeaver |
| **Monitoring** | pg_stat_statements, pgBadger | Performance Schema, PMM |
| **Backup** | pg_dump, pgBackRest, Barman | mysqldump, XtraBackup |
| **Extensions** | PostGIS, TimescaleDB, pgvector, pg_trgm | Plugins (limited) |
| **CMS adoption** | Django, Rails | WordPress, Drupal, Magento |
| **Cloud** | Supabase, Neon, Aurora PG | PlanetScale, Aurora MySQL |

---

## 17. Khi nào chọn cái nào?

### Chọn PostgreSQL khi:

| Use case | Lý do |
|----------|-------|
| **Fintech/Banking** | RLS, SSI, advisory locks, data integrity |
| **Complex queries, analytics** | Superior optimizer, parallel query, JIT |
| **Geospatial (GIS)** | PostGIS (industry standard) |
| **Full-text search** | tsvector + GIN + pg_trgm |
| **JSON-heavy** | JSONB + GIN indexing |
| **Multi-tenant SaaS** | Row-Level Security |
| **AI/ML vector search** | pgvector extension |
| **Time-series** | TimescaleDB extension |

### Chọn MySQL khi:

| Use case | Lý do |
|----------|-------|
| **Simple CRUD web apps** | Đơn giản, nhanh, dễ deploy |
| **WordPress/CMS** | Ecosystem requirement |
| **Read-heavy, simple queries** | Clustered index, fast PK lookup |
| **Massive horizontal scale** | Vitess/PlanetScale |
| **High connection count** | Thread-based, nhẹ per connection |
| **Team familiarity** | Phổ biến, nhiều tài liệu |

### Banking/Fintech → Tại sao PostgreSQL:

```
1. Row-Level Security → multi-tenant isolation ở DB level
2. SSI → optimistic serializable, throughput cao hơn MySQL SERIALIZABLE
3. Advisory Locks → distributed locking patterns
4. Better write conflict detection → ngăn lost updates
5. Partial indexes → optimize hot paths
6. Range types → date/amount ranges native
7. JSONB → flexible audit logs, event sourcing
```

---

## 18. Câu hỏi phỏng vấn thường gặp

**Q1: "PostgreSQL và MySQL khác nhau cơ bản nhất ở điểm nào?"**
> A: Kiến trúc (multi-process vs multi-thread), MVCC (heap-based vs undo log), triết lý (feature-rich vs simplicity). PostgreSQL lưu old versions trong heap cần VACUUM, MySQL lưu trong undo log tự purge.

**Q2: "Tại sao MySQL dùng Gap Lock còn PostgreSQL thì không?"**
> A: PostgreSQL dùng MVCC snapshot thuần — phantom read "không thấy" ở read level. MySQL muốn ngăn phantom hoàn toàn (kể cả locking reads) nên dùng Gap Lock physically ngăn INSERT. Trade-off: Gap Lock gây deadlock nhiều hơn.

**Q3: "UPDATE internally khác nhau thế nào?"**
> A: PostgreSQL: INSERT tuple mới + mark cũ dead → tất cả indexes update (trừ HOT). MySQL: update in-place + ghi undo log → chỉ indexes có column thay đổi update. MySQL ít write amplification hơn.

**Q4: "Khi nào cần VACUUM và tại sao MySQL không cần?"**
> A: PostgreSQL: dead tuples trong heap chiếm space, VACUUM dọn. MySQL: old versions trong undo log riêng, purge thread tự dọn. Trade-off: PG bị table bloat nếu VACUUM chậm; MySQL bị undo log growth nếu long TX.

**Q5: "So sánh Serializable giữa hai database?"**
> A: PostgreSQL SSI: optimistic, non-blocking reads, detect conflicts khi commit. MySQL: pessimistic, mọi SELECT → FOR SHARE, shared locks everywhere → throughput thấp. PG SERIALIZABLE phù hợp OLTP hơn.

**Q6: "Row-Level Security quan trọng thế nào?"**
> A: PostgreSQL RLS enforce data isolation ở DB level — dù developer quên WHERE, data vẫn safe. MySQL không có, phải rely on app code → error-prone, security risk trong multi-tenant systems.

**Q7: "Trong banking, chọn database nào?"**
> A: PostgreSQL: SSI (serializable + high throughput), RLS (data isolation), advisory locks, write conflict detection, JSONB audit trails, partial indexes. MySQL phù hợp read-heavy CRUD hoặc khi cần Vitess horizontal scale.

**Q8: "Partial index là gì?"**
> A: PostgreSQL only — index chỉ rows thỏa WHERE condition. Ví dụ: index orders WHERE status='PENDING' → nếu 5% orders pending, index nhỏ 20x. MySQL không có, phải composite index toàn bộ rows.

---

## Tổng kết

```
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL vs MySQL — TL;DR                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PostgreSQL = "Swiss Army Knife"                                 │
│  ✅ Feature-rich, extensible, standards-compliant                │
│  ✅ Complex queries, analytics, JSON, GIS, FTS                   │
│  ✅ Better concurrency (SSI, no gap lock deadlocks)              │
│  ✅ RLS, partial indexes, rich data types                        │
│  ⚠️  Needs VACUUM tuning, connection pooler                      │
│                                                                   │
│  MySQL = "Reliable Workhorse"                                    │
│  ✅ Simple, fast for basic ops, easy to learn                    │
│  ✅ Read-heavy, high connection count                            │
│  ✅ Vitess for horizontal scale                                  │
│  ✅ Less maintenance (no VACUUM)                                 │
│  ⚠️  Gap lock deadlocks, weaker optimizer, no RLS               │
│                                                                   │
│  Banking/Fintech → PostgreSQL                                    │
│  Simple Web App → MySQL                                          │
│  Horizontal Scale → Both (Citus vs Vitess)                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```