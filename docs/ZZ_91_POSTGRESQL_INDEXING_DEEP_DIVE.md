# PostgreSQL Indexing — Deep Dive Toàn Diện

> **Mục tiêu:** Hiểu sâu từ cấu trúc nội tại đến chiến lược thực chiến cho hệ thống production (E-commerce, Fintech, Loyalty).
>
> **Cấp độ:** Foundation → Advanced → Expert
>
> **Ngôn ngữ:** Vietnamese + SQL/technical English

---

## Mục lục

1. [Tại sao cần Index?](#1-tại-sao-cần-index)
2. [Cấu trúc nội tại B-Tree Index](#2-cấu-trúc-nội-tại-b-tree-index)
3. [Tất cả loại Index trong PostgreSQL](#3-tất-cả-loại-index-trong-postgresql)
4. [Các thuộc tính Index (Modifiers)](#4-các-thuộc-tính-index-modifiers)
5. [Composite Index & Leftmost Prefix Rule](#5-composite-index--leftmost-prefix-rule)
6. [EXPLAIN ANALYZE — Đọc hiểu hoàn toàn](#6-explain-analyze--đọc-hiểu-hoàn-toàn)
7. [Planner Statistics — Cách PostgreSQL ra quyết định](#7-planner-statistics--cách-postgresql-ra-quyết-định)
8. [Index Maintenance — Bloat, VACUUM, REINDEX](#8-index-maintenance--bloat-vacuum-reindex)
9. [Monitoring Indexes trong Production](#9-monitoring-indexes-trong-production)
10. [Chiến lược Index thực chiến theo Domain](#10-chiến-lược-index-thực-chiến-theo-domain)
11. [Anti-patterns — Những lỗi phổ biến](#11-anti-patterns--những-lỗi-phổ-biến)
12. [Benchmark: Trước vs Sau khi thêm Index](#12-benchmark-trước-vs-sau-khi-thêm-index)
13. [Câu hỏi phỏng vấn chuyên sâu](#13-câu-hỏi-phỏng-vấn-chuyên-sâu)

---

## 1. Tại sao cần Index?

### 1.1 Vấn đề: Sequential Scan (Seq Scan)

Khi không có index, PostgreSQL phải đọc **toàn bộ bảng** từ đầu đến cuối để tìm rows phù hợp — gọi là **Sequential Scan** hay **Full Table Scan**.

```
Bảng users (10 triệu rows, ~2GB):
┌──────────────────────────────────────────────┐
│ Page 1  │ Page 2  │ Page 3  │ ... │ Page N   │
│ row 1-5 │ row 6-10│ row 11-5│     │ row N-5  │
└──────────────────────────────────────────────┘
     ↑          ↑         ↑                ↑
  đọc hết    đọc hết   đọc hết   ...   đọc hết
```

**Query không có index:**
```sql
SELECT * FROM users WHERE email = 'alice@example.com';
-- PostgreSQL phải scan 10 triệu rows → 3-10 giây
```

**Chi phí thực tế:**
- Disk I/O: đọc 2GB dữ liệu từ đĩa
- Memory: cần đủ buffer cache
- CPU: so sánh điều kiện với mọi row

### 1.2 Giải pháp: Index Scan

Index là **cấu trúc dữ liệu phụ** — được duy trì song song với bảng chính — cho phép PostgreSQL tìm rows theo giá trị cụ thể mà **không cần đọc toàn bộ bảng**.

```
Index idx_users_email (B-Tree):
┌────────────────────────────────────────────────┐
│ 'alice@..' → (page 1234, slot 3)               │
│ 'bob@...' → (page 5678, slot 1)                │
│ ...                                            │
└────────────────────────────────────────────────┘
         ↓ lookup O(log n)
┌─────────────────┐
│ Heap (bảng gốc) │
│ page 1234, sl 3 │ ← chỉ đọc đúng page này
└─────────────────┘
```

**Cùng query với index:**
```sql
SELECT * FROM users WHERE email = 'alice@example.com';
-- B-Tree lookup: O(log 10,000,000) ≈ 23 bước → <1ms
```

### 1.3 Trade-off của Index

Index không phải miễn phí. Mỗi index đều có chi phí:

| Khía cạnh | Chi phí |
|-----------|---------|
| **Disk space** | Index chiếm 10-30% kích thước bảng (B-Tree), có thể nhiều hơn (GIN) |
| **INSERT** | Phải thêm entry vào mọi index trên bảng |
| **UPDATE** | Nếu indexed column thay đổi → phải xóa entry cũ, thêm entry mới |
| **DELETE** | Phải mark entry trong index là dead (dọn bởi VACUUM sau) |
| **Maintenance** | VACUUM phải dọn dead index entries, autovacuum tốn CPU |

**Nguyên tắc vàng:**
- Index **đúng** khi: query thường xuyên, bảng lớn (>10K rows), column có **high cardinality** (nhiều giá trị unique).
- Index **sai** khi: bảng nhỏ, column có ít giá trị (boolean, status), write-heavy với ít read.

---

## 2. Cấu trúc nội tại B-Tree Index

### 2.1 B+ Tree — Không phải Binary Tree

PostgreSQL B-Tree thực chất là **B+ Tree** (biến thể của B-Tree):

```
                    ┌─────────────────────────────┐
                    │      ROOT NODE              │
                    │   [50]  [150]  [300]        │
                    └─────┬─────┬──────┬──────────┘
                          │     │      │
          ┌───────────────┘     │      └───────────────────┐
          ↓                     ↓                          ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  BRANCH NODE     │  │  BRANCH NODE     │  │  BRANCH NODE     │
│ [10][25][40]     │  │ [60][90][120]    │  │ [200][250][280]  │
└────┬──┬──┬───────┘  └──┬──┬──┬────────┘  └──┬──┬──┬─────────┘
     │  │  │             │  │  │              │  │  │
     ↓  ↓  ↓             ↓  ↓  ↓              ↓  ↓  ↓
┌───────┐ ┌───────┐  ┌───────┐ ┌───────┐  ┌───────┐ ┌───────┐
│ LEAF  │→│ LEAF  │→ │ LEAF  │→│ LEAF  │→ │ LEAF  │→│ LEAF  │
│ 1,2,5 │ │10,12  │  │60,65  │ │90,95  │  │200,210│ │280,290│
│ +TID  │ │ +TID  │  │ +TID  │ │ +TID  │  │ +TID  │ │ +TID  │
└───────┘ └───────┘  └───────┘ └───────┘  └───────┘ └───────┘
                Linked list ←→←→←→←→←→←→←→←→
```

**Đặc điểm quan trọng:**
- **Root + Branch nodes:** chứa keys để điều hướng (navigation)
- **Leaf nodes:** chứa keys + **TID (Tuple ID)** = địa chỉ row trong heap (page_number, slot_offset)
- **Leaf nodes được liên kết thành linked list** → hỗ trợ range scan hiệu quả
- **Cân bằng:** mọi leaf node đều cùng depth từ root → O(log n) guaranteed

### 2.2 Page Layout (8KB per page)

PostgreSQL lưu trữ theo **pages** (blocks), mỗi page = **8KB** (default):

```
┌───────────────────────────────────────────────┐  8KB
│  Page Header (24 bytes)                       │
│  - lsn, checksum, flags, lower, upper, special│
├───────────────────────────────────────────────┤
│  Item Pointers (4 bytes each)                 │
│  → trỏ đến vị trí của từng index entry       │
├───────────────────────────────────────────────┤
│         FREE SPACE                            │
├───────────────────────────────────────────────┤
│  Index Tuples (stored from bottom up)         │
│  → (key_value, TID)                           │
├───────────────────────────────────────────────┤
│  Special Space (cho leaf: prev/next page ptr) │
└───────────────────────────────────────────────┘
```

### 2.3 Cách lookup hoạt động

**Point lookup:** `WHERE email = 'alice@example.com'`

```
1. Đọc root node → so sánh 'alice..' với các keys → biết đi nhánh nào
2. Đọc branch node → tiếp tục thu hẹp
3. Đến leaf node → tìm 'alice..' → lấy TID = (page 1234, slot 3)
4. Đọc heap page 1234 → lấy row ở slot 3
5. Kiểm tra visibility (MVCC) → trả về row nếu visible

Số I/O: height_of_tree + 1 heap fetch
         ≈ log_B(n)      + 1
Với B=200 entries/page, n=10M rows: log_200(10M) ≈ 3-4 levels
→ Tổng: 4-5 page reads
```

**Range scan:** `WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'`

```
1. Traverse đến leaf node chứa '2024-01-01'
2. Follow linked list sang phải cho đến '2024-12-31'
3. Với mỗi TID tìm được → fetch heap page tương ứng
→ Hiệu quả vì leaf nodes là sequential linked list
```

### 2.4 HOT Update (Heap-Only Tuple)

PostgreSQL có optimization đặc biệt: **HOT (Heap-Only Tuple)**

```
Khi UPDATE không thay đổi indexed column:

Row cũ:  (id=1, name='Alice', email='alice@..')
Row mới: (id=1, name='Alice Updated', email='alice@..')
                        ↑ không thay đổi email

→ HOT: row mới được đặt trong CÙNG HEAP PAGE với row cũ
→ Index KHÔNG được cập nhật → chỉ có redirect chain trong heap
→ Tiết kiệm đáng kể cho write-heavy workloads
```

**HOT không áp dụng khi:**
- UPDATE thay đổi giá trị của indexed column
- Không còn free space trong heap page hiện tại (fillfactor đầy)

---

## 3. Tất cả loại Index trong PostgreSQL

### 3.1 B-Tree Index (Default)

**Tạo:**
```sql
CREATE INDEX idx_users_email ON users(email);
-- hoặc explicit:
CREATE INDEX idx_users_email ON users USING btree(email);
```

**Operators được hỗ trợ:**
```
=   <   <=   >   >=   BETWEEN   IN   IS NULL   IS NOT NULL
LIKE 'prefix%'   (chỉ prefix, KHÔNG hỗ trợ '%suffix' hay '%middle%')
```

**Khi nào dùng B-Tree:**
- Primary key (PostgreSQL tự tạo B-Tree cho PK)
- Foreign key (nên tạo thủ công cho FK để tránh sequential scan khi JOIN/DELETE)
- Columns thường xuyên trong WHERE, ORDER BY, GROUP BY
- High-cardinality columns: email, username, user_id, created_at

```sql
-- Ví dụ thực tế
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
```

---

### 3.2 Hash Index

**Tạo:**
```sql
CREATE INDEX idx_users_session_token ON sessions USING hash(token);
```

**Cơ chế:**
```
token → hash_function → bucket_id → list of TIDs

'abc123xyz' → hash() → bucket 4821 → [(page 5, slot 2), (page 9, slot 1)]
```

**Chỉ hỗ trợ `=` (equality):**
```sql
-- ✅ Hash index ĐƯỢC dùng:
WHERE token = 'abc123xyz'

-- ❌ Hash index KHÔNG được dùng:
WHERE token > 'abc123xyz'   -- range
WHERE token LIKE 'abc%'      -- prefix
ORDER BY token               -- sort
```

**Khi nào Hash nhanh hơn B-Tree:**
- Lookup `=` thuần túy trên string/binary dài (session tokens, UUIDs)
- B-Tree so sánh full string; Hash chỉ so sánh hash value → nhỏ hơn, nhanh hơn

**Lưu ý:** Từ PostgreSQL 10+, Hash index được WAL-logged (crash-safe). Trước PG 10: KHÔNG dùng Hash trong production.

---

### 3.3 GIN — Generalized Inverted Index

**Cấu trúc:**
```
GIN lưu inverted index: mỗi "element" → list of TIDs chứa element đó

Bảng: products
Row 1: tags = ['electronics', 'sale', 'iphone']
Row 2: tags = ['electronics', 'laptop']
Row 3: tags = ['sale', 'clothing']

GIN index on tags:
'clothing'    → [Row 3]
'electronics' → [Row 1, Row 2]
'iphone'      → [Row 1]
'laptop'      → [Row 2]
'sale'        → [Row 1, Row 3]
```

**Dùng cho:**
```sql
-- 1. Arrays
CREATE INDEX idx_products_tags ON products USING GIN(tags);
SELECT * FROM products WHERE tags @> ARRAY['electronics', 'sale'];
-- @> = "contains"

-- 2. JSONB
CREATE INDEX idx_events_data ON events USING GIN(data);
SELECT * FROM events WHERE data @> '{"type": "purchase", "status": "completed"}';

-- Chỉ index một path cụ thể (tiết kiệm space):
CREATE INDEX idx_events_type ON events USING GIN((data->'type'));

-- jsonb_path_ops (operator class nhỏ hơn, chỉ hỗ trợ @>):
CREATE INDEX idx_events_data_path ON events USING GIN(data jsonb_path_ops);

-- 3. Full-text search
CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);
SELECT * FROM articles WHERE search_vector @@ to_tsquery('english', 'postgresql & index');

-- 4. pg_trgm (trigram similarity - typo tolerance)
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
SELECT * FROM products WHERE name % 'iphon';  -- % = similarity operator
SELECT * FROM products WHERE name ILIKE '%iphone%'; -- GIN trgm cũng accelerate ILIKE
```

**Trade-off GIN:**
| | Tốt | Kém |
|--|-----|-----|
| **Lookup speed** | ✅ Rất nhanh (inverted lookup) | |
| **Build time** | | ❌ Chậm hơn B-Tree khi build lần đầu |
| **Update speed** | | ❌ Chậm khi UPDATE (nhiều posting list updates) |
| **Size** | | ❌ Lớn hơn B-Tree đáng kể |
| **Pending list** | GIN dùng "pending list" để batch updates | Cần `gin_clean_pending_list()` định kỳ |

---

### 3.4 GiST — Generalized Search Tree

GiST là **framework** cho phép tạo index cho bất kỳ data type nào với custom operators.

**Dùng cho:**
```sql
-- 1. Geospatial (PostGIS)
CREATE EXTENSION postgis;
CREATE INDEX idx_locations_geom ON locations USING GIST(geom);

-- Nearest neighbor (KNN):
SELECT * FROM locations
ORDER BY geom <-> ST_MakePoint(106.7, 10.8)  -- <-> = distance operator
LIMIT 10;

-- Contains:
SELECT * FROM locations WHERE geom && ST_MakeEnvelope(106.5, 10.5, 107.0, 11.0);

-- 2. Range types
CREATE INDEX idx_bookings_period ON bookings USING GIST(period);
-- period là tstzrange (timestamp with timezone range)

SELECT * FROM bookings
WHERE period && '[2024-01-01, 2024-01-31]'::tstzrange;  -- overlap
SELECT * FROM bookings
WHERE period @> '2024-01-15'::timestamptz;              -- contains point

-- 3. Full-text search (alternative to GIN)
CREATE INDEX idx_articles_fts ON articles USING GIST(search_vector);
-- GiST cho FTS: build nhanh hơn GIN, lookup chậm hơn GIN
-- Dùng GiST khi: update thường xuyên, build speed quan trọng hơn lookup speed
```

**GiST vs GIN cho Full-text Search:**

| | GiST | GIN |
|--|------|-----|
| **Lookup speed** | Chậm hơn | Nhanh hơn |
| **Build time** | Nhanh hơn | Chậm hơn |
| **Update speed** | Nhanh hơn | Chậm hơn |
| **Size** | Nhỏ hơn | Lớn hơn |
| **Chọn khi** | Update nhiều, insert nhiều | Read nhiều, update ít |

---

### 3.5 SP-GiST — Space-Partitioned GiST

SP-GiST hỗ trợ **non-balanced** partitioned search structures: quadtrees, k-d trees, radix trees.

```sql
-- Point data (quadtree)
CREATE INDEX idx_points ON locations USING SPGIST(point);

-- Text prefix matching (radix tree)
CREATE INDEX idx_phone_prefix ON customers USING SPGIST(phone_number);
SELECT * FROM customers WHERE phone_number LIKE '0901%';

-- Inet addresses (radix tree)
CREATE INDEX idx_ip ON access_logs USING SPGIST(ip_address);
SELECT * FROM access_logs WHERE ip_address << '192.168.1.0/24'::inet;
```

**Khi nào SP-GiST tốt hơn GiST:** Data có tính phân vùng tự nhiên (points trên map, IP ranges), query tập trung vào một vùng cụ thể.

---

### 3.6 BRIN — Block Range Index

BRIN lưu trữ **min/max values** cho từng range of pages (block range), không phải từng row.

```
Bảng: events (1 tỷ rows, insert theo thứ tự thời gian)

Block 1-128:    created_at từ '2020-01-01' đến '2020-03-31'
Block 129-256:  created_at từ '2020-04-01' đến '2020-06-30'
Block 257-384:  created_at từ '2020-07-01' đến '2020-09-30'
...

BRIN index (pages_per_range = 128):
[range 1]: min='2020-01-01', max='2020-03-31'
[range 2]: min='2020-04-01', max='2020-06-30'
[range 3]: min='2020-07-01', max='2020-09-30'
```

**Query:**
```sql
SELECT * FROM events WHERE created_at = '2020-05-15';
-- BRIN: skip range 1 (max < '2020-05-15'), skip range 3 (min > '2020-05-15')
-- Chỉ scan range 2 → tiết kiệm đáng kể I/O
```

**Tạo BRIN:**
```sql
-- Default pages_per_range = 128
CREATE INDEX idx_events_created_brin ON events USING BRIN(created_at);

-- Tùy chỉnh range size (nhỏ hơn = chính xác hơn nhưng tốn space hơn)
CREATE INDEX idx_events_created_brin ON events
USING BRIN(created_at) WITH (pages_per_range = 32);
```

**BRIN vs B-Tree:**

| | BRIN | B-Tree |
|--|------|--------|
| **Index size** | Cực nhỏ (~kilobytes cho tỷ rows) | Lớn hơn nhiều |
| **Lookup chính xác** | ❌ Chỉ loại trừ ranges | ✅ Chính xác đến row |
| **Hiệu quả khi** | Data **có thứ tự tự nhiên** theo thời gian insert | Mọi trường hợp |
| **Điển hình** | Log tables, time-series, append-only | Hầu hết use cases |
| **Maintenance** | Gần như không cần | Cần VACUUM định kỳ |

---

### 3.7 Bloom Filter Index

Bloom filter là **probabilistic data structure** — có thể có false positives nhưng không có false negatives.

```sql
CREATE EXTENSION bloom;

-- Hữu ích khi có nhiều equality conditions trên nhiều columns
CREATE INDEX idx_orders_bloom ON orders
USING bloom(status, payment_method, region, channel)
WITH (length=80, col1=2, col2=2, col3=2, col4=2);

SELECT * FROM orders
WHERE status = 'COMPLETED'
  AND payment_method = 'CARD'
  AND region = 'HCM'
  AND channel = 'MOBILE';
```

**Khi nào dùng Bloom:**
- Nhiều equality conditions (4+ columns)
- Không có pattern query nào đủ phổ biến để làm composite index
- Space-constrained environments

---

## 4. Các thuộc tính Index (Modifiers)

### 4.1 UNIQUE Index

```sql
-- Tự động tạo khi khai báo UNIQUE constraint hoặc PRIMARY KEY
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Unique trên composite:
CREATE UNIQUE INDEX idx_voucher_redemptions ON voucher_redemptions(user_id, voucher_id);

-- Unique partial (chỉ enforce unique trên subset):
CREATE UNIQUE INDEX idx_users_email_active ON users(email)
WHERE deleted_at IS NULL;
-- → Cho phép nhiều users có cùng email nếu đã bị soft-delete
-- → Chỉ enforce unique cho active users
```

### 4.2 Partial Index (WHERE clause)

**Tính năng PostgreSQL-exclusive** — index chỉ rows thỏa điều kiện.

```sql
-- Scenario: 99% orders có status = 'COMPLETED', chỉ 1% là 'PENDING'
-- Chỉ cần index rows PENDING (nhỏ hơn 100x)
CREATE INDEX idx_orders_pending ON orders(created_at)
WHERE status = 'PENDING';

-- Query PHẢI có điều kiện khớp với WHERE clause của index:
SELECT * FROM orders WHERE status = 'PENDING' ORDER BY created_at;
-- → Planner dùng idx_orders_pending ✅

SELECT * FROM orders WHERE status = 'COMPLETED' ORDER BY created_at;
-- → Planner KHÔNG dùng idx_orders_pending (không match WHERE clause) ❌

-- Ví dụ Loyalty System:
CREATE INDEX idx_points_unprocessed ON point_events(user_id, created_at)
WHERE processed = false;

CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
WHERE read_at IS NULL;

CREATE INDEX idx_vouchers_active ON vouchers(expiry_date)
WHERE status = 'ACTIVE' AND deleted_at IS NULL;
```

**Lợi ích Partial Index:**
- Index nhỏ hơn → fits trong RAM (shared_buffers) tốt hơn
- Maintenance nhanh hơn (ít entries hơn)
- Lookup nhanh hơn (ít levels hơn trong tree)

### 4.3 Covering Index — INCLUDE clause (PostgreSQL 11+)

Thay vì chỉ lưu key columns trong index, INCLUDE cho phép thêm extra columns vào **leaf nodes** — tránh cần phải fetch heap.

```sql
-- Không có INCLUDE: cần 2 lookups (index + heap)
CREATE INDEX idx_orders_user ON orders(user_id);
SELECT user_id, status, total_amount FROM orders WHERE user_id = 123;
-- → Index Scan: tìm user_id=123 trong index
--            + fetch heap để lấy status, total_amount

-- Với INCLUDE: Index Only Scan
CREATE INDEX idx_orders_user_covering ON orders(user_id)
INCLUDE (status, total_amount);
SELECT user_id, status, total_amount FROM orders WHERE user_id = 123;
-- → Index Only Scan: mọi thứ cần đều có trong index leaf node ✅
-- Lưu ý: status, total_amount trong INCLUDE KHÔNG ảnh hưởng ordering/filtering
```

**INCLUDE vs composite key:**
```sql
-- Sai: đưa extra columns vào key
CREATE INDEX idx_wrong ON orders(user_id, status, total_amount);
-- → status và total_amount trở thành key → ảnh hưởng tree ordering
-- → Query WHERE user_id = 123 AND status = 'X' mới tận dụng được

-- Đúng: dùng INCLUDE cho non-key extra columns
CREATE INDEX idx_correct ON orders(user_id) INCLUDE (status, total_amount);
-- → Key chỉ là user_id → lookup WHERE user_id = 123 là đủ
-- → status, total_amount chỉ ở leaf → Index Only Scan khi SELECT cần chúng
```

### 4.4 Expression Index (Functional Index)

Index trên kết quả của một **biểu thức/hàm** thay vì raw column value.

```sql
-- Case-insensitive email lookup
CREATE INDEX idx_users_email_lower ON users(lower(email));
-- Query PHẢI dùng cùng expression:
SELECT * FROM users WHERE lower(email) = lower('Alice@Example.COM');
-- ✅ Dùng index

SELECT * FROM users WHERE email = 'alice@example.com';
-- ❌ KHÔNG dùng index (khác expression)

-- Extracted JSON field
CREATE INDEX idx_events_user_id ON events((payload->>'user_id'));
SELECT * FROM events WHERE payload->>'user_id' = '12345';

-- Date truncation (query by month)
CREATE INDEX idx_orders_month ON orders(date_trunc('month', created_at));
SELECT * FROM orders WHERE date_trunc('month', created_at) = '2024-01-01';

-- Computed value
CREATE INDEX idx_products_discount ON products((original_price - sale_price));
SELECT * FROM products WHERE (original_price - sale_price) > 100000;
```

### 4.5 Descending Index và NULLS ordering

```sql
-- Descending index cho ORDER BY ... DESC queries
CREATE INDEX idx_orders_created_desc ON orders(created_at DESC);

-- NULLS FIRST / NULLS LAST
CREATE INDEX idx_tasks_deadline ON tasks(deadline ASC NULLS LAST);
-- Khớp với: ORDER BY deadline ASC NULLS LAST

-- Composite với mixed directions
CREATE INDEX idx_leaderboard ON users(tier ASC, total_points DESC NULLS LAST);
-- Khớp với: ORDER BY tier ASC, total_points DESC NULLS LAST
```

### 4.6 CREATE INDEX CONCURRENTLY

**Vấn đề:** `CREATE INDEX` thông thường yêu cầu **SHARE lock** — block mọi INSERT/UPDATE/DELETE trong thời gian build.

```sql
-- ❌ Nguy hiểm trong production (block writes):
CREATE INDEX idx_orders_user ON orders(user_id);

-- ✅ An toàn trong production (không block writes):
CREATE INDEX CONCURRENTLY idx_orders_user ON orders(user_id);
```

**Cơ chế CONCURRENTLY:**
1. Scan bảng lần 1, build index từ snapshot
2. Chờ tất cả transactions đang chạy kết thúc
3. Scan bảng lần 2, bắt kịp changes trong khoảng thời gian giữa 2 lần scan
4. Đánh dấu index là VALID

**Lưu ý:**
- Build lâu hơn ~2x so với thông thường
- Nếu bị interrupt → để lại **INVALID index** (phải `DROP INDEX ... CONCURRENTLY` rồi tạo lại)
- Không thể dùng trong transaction block

---

## 5. Composite Index & Leftmost Prefix Rule

### 5.1 Leftmost Prefix Rule — Chi tiết

Composite index `(a, b, c)` tạo ra ordering: sắp xếp theo `a`, cùng `a` thì sắp xếp theo `b`, cùng `a` và `b` thì sắp xếp theo `c`.

```sql
CREATE INDEX idx_transactions ON transactions(user_id, created_at, type);
```

**Cấu trúc B-Tree leaf level:**
```
(user_id=1, created_at='2024-01-01', type='earn') → TID
(user_id=1, created_at='2024-01-02', type='burn') → TID
(user_id=1, created_at='2024-01-02', type='earn') → TID
(user_id=2, created_at='2024-01-01', type='earn') → TID
(user_id=2, created_at='2024-02-15', type='burn') → TID
...
```

**Các query patterns:**
```sql
-- ✅ Dùng đầy đủ index (equality + range + equality)
WHERE user_id = 1 AND created_at > '2024-01-01' AND type = 'earn'
-- Tìm điểm bắt đầu: user_id=1, created_at='2024-01-01'
-- Scan forward: lấy tất cả rows của user_id=1, created_at > '2024-01-01'
-- Filter type='earn' (index scan nhưng filter bằng type)
-- Lưu ý: sau range condition (created_at), các columns sau không dùng được để skip

-- ✅ Dùng index một phần (chỉ user_id)
WHERE user_id = 1

-- ✅ Dùng index hai cột đầu (equality + equality)
WHERE user_id = 1 AND created_at = '2024-01-01'

-- ✅ Dùng index hai cột đầu (equality + range)
WHERE user_id = 1 AND created_at BETWEEN '2024-01-01' AND '2024-12-31'

-- ❌ KHÔNG dùng index (skip leftmost column)
WHERE created_at > '2024-01-01'
WHERE type = 'earn'
WHERE created_at > '2024-01-01' AND type = 'earn'

-- ✅ Có thể dùng index (chỉ user_id, type bị skip)
WHERE user_id = 1 AND type = 'earn'
-- → Planner dùng index để locate user_id=1, rồi filter type='earn' qua index
-- → Hiệu quả hơn Seq Scan nhưng kém hơn dùng đủ 3 columns
```

### 5.2 Equality trước, Range sau

Nguyên tắc quan trọng: đặt **equality conditions trước**, **range conditions sau** trong composite index.

```sql
-- ❌ Thứ tự sai
CREATE INDEX idx_orders_bad ON orders(created_at, status);
WHERE status = 'PENDING' AND created_at > '2024-01-01'
-- → created_at là range → chỉ dùng được created_at của index
-- → status không được dùng để narrow down

-- ✅ Thứ tự đúng
CREATE INDEX idx_orders_good ON orders(status, created_at);
WHERE status = 'PENDING' AND created_at > '2024-01-01'
-- → status = 'PENDING' (equality) → thu hẹp xuống còn 5% rows
-- → created_at > '2024-01-01' (range) → thu hẹp tiếp
-- → Hiệu quả hơn nhiều!
```

### 5.3 Selectivity — Chọn thứ tự column

Đặt column có **selectivity cao** (nhiều giá trị unique) lên đầu trong composite index.

```sql
-- Bảng users:
-- role: 3 values (admin/seller/buyer) → low selectivity
-- status: 2 values (active/inactive) → very low selectivity
-- country: 50 values → medium selectivity
-- user_id: millions values → very high selectivity

-- ❌ Thứ tự kém (low selectivity trước)
CREATE INDEX idx_bad ON users(status, role, country);

-- ✅ Thứ tự tốt hơn (higher selectivity trước)
CREATE INDEX idx_good ON users(country, role, status);
```

**Xem selectivity thực tế:**
```sql
SELECT
    attname AS column,
    n_distinct,
    CASE
        WHEN n_distinct > 0 THEN n_distinct
        WHEN n_distinct < 0 THEN round(abs(n_distinct) * reltuples)
    END AS estimated_distinct_values
FROM pg_stats ps
JOIN pg_class pc ON pc.relname = ps.tablename
WHERE tablename = 'orders'
ORDER BY n_distinct DESC;
```

---

## 6. EXPLAIN ANALYZE — Đọc hiểu hoàn toàn

### 6.1 Cú pháp đầy đủ

```sql
EXPLAIN (
    ANALYZE,     -- thực thi query thật, đo thời gian thực tế
    BUFFERS,     -- hiển thị buffer cache hits/misses
    FORMAT TEXT  -- hoặc JSON, XML, YAML
)
SELECT u.id, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.email
ORDER BY order_count DESC
LIMIT 20;
```

**⚠️ Lưu ý:** `EXPLAIN ANALYZE` thực sự chạy query! Với INSERT/UPDATE/DELETE, bọc trong transaction rồi rollback:
```sql
BEGIN;
EXPLAIN ANALYZE DELETE FROM orders WHERE status = 'TEST';
ROLLBACK;
```

### 6.2 Đọc output — Ví dụ thực tế

```
Limit  (cost=12543.21..12543.26 rows=20 width=68)
        (actual time=89.123..89.129 rows=20 loops=1)
  ->  Sort  (cost=12543.21..12618.21 rows=30000 width=68)
             (actual time=89.120..89.122 rows=20 loops=1)
        Sort Key: (count(o.id)) DESC
        Sort Method: top-N heapsort  Memory: 27kB
        ->  HashAggregate  (cost=10043.21..10343.21 rows=30000 width=68)
                            (actual time=82.456..86.234 rows=28945 loops=1)
              Group Key: u.id, u.email
              Batches: 1  Memory Usage: 7185kB
              ->  Hash Left Join  (cost=2543.21..8793.21 rows=250000 width=44)
                                   (actual time=25.123..65.456 rows=245000 loops=1)
                    Hash Cond: (o.user_id = u.id)
                    ->  Seq Scan on orders o  (cost=0..5000 rows=250000 width=8)
                                               (actual time=0.012..25.456 rows=245000 loops=1)
                    ->  Hash  (cost=2100..2100 rows=35417 width=36)
                               (actual time=24.789..24.789 rows=35000 loops=1)
                          Buckets: 65536  Batches: 1  Memory Usage: 2497kB
                          ->  Index Scan using idx_users_created
                                on users u  (cost=0.43..2100 rows=35417 width=36)
                                             (actual time=0.034..18.234 rows=35000 loops=1)
                                Index Cond: (created_at > '2024-01-01'::date)
                    Buffers: shared hit=1234 read=567 dirtied=0 written=0
Planning Time: 2.345 ms
Execution Time: 89.456 ms
```

### 6.3 Giải thích từng thành phần

**Format chung:**
```
Node Name  (cost=startup..total rows=estimated_rows width=row_bytes_width)
           (actual time=startup..total rows=actual_rows loops=number_of_executions)
```

**cost=startup..total:**
- `startup cost`: cost để trả về row ĐẦU TIÊN (đơn vị tương đối)
- `total cost`: cost để trả về TẤT CẢ rows
- Đây là **ước tính** của planner, không phải thời gian thực

**actual time=startup..total:**
- Thời gian **thực tế** (milliseconds)
- `loops=N`: node này được chạy N lần (trong Nested Loop, inner node chạy nhiều lần)

**Rows mismatch — dấu hiệu cần ANALYZE:**
```
rows=35417 (estimated) vs rows=35000 (actual)  → chênh lệch nhỏ ✅
rows=100 (estimated) vs rows=50000 (actual)    → chênh lệch lớn ❌ → cần ANALYZE
```

**Buffers:**
```
shared hit=1234    → 1234 pages từ shared_buffers (RAM) — nhanh
shared read=567    → 567 pages phải đọc từ disk — chậm
```

### 6.4 Tất cả các loại Scan

#### Seq Scan (Sequential Scan)
```
Seq Scan on orders  (cost=0..5000 rows=250000 width=8)
                     (actual time=0.012..25.456 rows=245000 loops=1)
  Filter: (status = 'PENDING')
  Rows Removed by Filter: 232890
```
- Đọc toàn bộ bảng từ đầu đến cuối
- **Khi nào Seq Scan là ĐÚNG:** selectivity thấp, trả về nhiều rows (>10-20% bảng), bảng nhỏ
- **Khi nào Seq Scan là SAI:** bảng lớn, query chỉ cần ít rows → thiếu index

#### Index Scan
```
Index Scan using idx_orders_user_id on orders
    (cost=0.43..8.45 rows=1 width=68)
    (actual time=0.034..0.041 rows=1 loops=1)
  Index Cond: (user_id = 12345)
```
- Traverse B-Tree → lấy TID → fetch heap page cho từng TID
- Tốt cho: query trả về ít rows, high selectivity
- **Nhược điểm:** nếu nhiều rows match và scattered khắp heap → nhiều random I/O

#### Index Only Scan ⭐
```
Index Only Scan using idx_orders_user_covering on orders
    (cost=0.43..4.45 rows=10 width=20)
    (actual time=0.020..0.025 rows=10 loops=1)
  Index Cond: (user_id = 12345)
  Heap Fetches: 0  ← PERFECT: không cần đọc heap
```
- Tất cả columns cần đều có trong index leaf → không cần đọc heap
- `Heap Fetches: 0` → hoàn hảo (visibility map cho biết page 100% visible)
- `Heap Fetches: N > 0` → một số pages phải check heap (visibility map chưa được cập nhật, cần `VACUUM`)

#### Bitmap Index Scan + Bitmap Heap Scan
```
Bitmap Heap Scan on orders
    (cost=234.56..2345.67 rows=12000 width=68)
    (actual time=5.234..45.678 rows=11890 loops=1)
  Recheck Cond: (user_id = ANY ('{1,2,3,...,100}'::integer[]))
  Heap Blocks: exact=8901
  ->  Bitmap Index Scan on idx_orders_user_id
          (cost=0..231.56 rows=12000 width=0)
          (actual time=4.123..4.123 rows=11890 loops=1)
        Index Cond: (user_id = ANY ('{1,2,3,...,100}'::integer[]))
```
- **Phase 1 (Bitmap Index Scan):** scan toàn bộ index, tạo bitmap (mỗi bit = 1 heap page)
- **Phase 2 (Bitmap Heap Scan):** đọc heap pages theo thứ tự vật lý (sequential-ish) → tránh random I/O
- Tốt cho: query trả về nhiều rows (vài %) nhưng chưa đến mức cần Seq Scan

**Khi nào dùng loại scan nào:**
```
Rows returned ratio:
< 1%:     Index Scan         (random I/O acceptable, lookup chính xác)
1% - 15%: Bitmap Index Scan  (batch I/O, sorted page access)
> 15%:    Seq Scan            (sequential read toàn bộ, cache-friendly)
```

### 6.5 Các chỉ số quan trọng khác

**Sort Methods:**
```
Sort Method: quicksort    Memory: 1234kB  → sort xảy ra trong memory ✅
Sort Method: external merge  Disk: 5678kB → sort tràn ra disk ❌ → tăng work_mem
Sort Method: top-N heapsort  Memory: 27kB → LIMIT query, chỉ giữ top N ✅
```

**Hash Join Batches:**
```
Hash Join  ...
  Batches: 1  Memory Usage: 2497kB  → toàn bộ trong memory ✅
  Batches: 8  Memory Usage: 8193kB  → hash tràn ra disk ❌ → tăng work_mem
```

**Node đắt nhất — tìm bottleneck:**
```sql
-- Chạy EXPLAIN với FORMAT JSON, sau đó phân tích
EXPLAIN (ANALYZE, FORMAT JSON) SELECT ...;
-- Tìm node có "Actual Total Time" cao nhất → đó là bottleneck
```

---

## 7. Planner Statistics — Cách PostgreSQL ra quyết định

### 7.1 Query Planner là gì?

Mỗi query SQL có nhiều **execution plans** có thể. Planner chọn plan **ước tính rẻ nhất** dựa trên statistics về data distribution.

```
SELECT * FROM orders o JOIN users u ON o.user_id = u.id WHERE u.country = 'VN';

Plan A: Seq Scan users → Hash Join với orders → cost 15000
Plan B: Index Scan users(country) → Nested Loop với orders → cost 800  ← CHỌN NÀY
Plan C: Seq Scan orders → Merge Join với users → cost 20000
```

### 7.2 pg_stats — Xem statistics của columns

```sql
SELECT
    tablename,
    attname AS column_name,
    n_distinct,         -- số distinct values (âm = fraction của total rows)
    correlation,        -- -1 đến +1: physical ordering correlation
    most_common_vals,   -- array các giá trị phổ biến nhất
    most_common_freqs,  -- frequency tương ứng
    histogram_bounds    -- boundaries của histogram buckets
FROM pg_stats
WHERE tablename = 'orders'
  AND attname IN ('user_id', 'status', 'created_at')
ORDER BY attname;
```

**Giải thích n_distinct:**
```
n_distinct = 1000     → có chính xác 1000 distinct values
n_distinct = -0.05    → ~5% của tổng rows là distinct (= 50K distinct nếu 1M rows)
n_distinct = -1       → mọi row đều unique (như primary key)
```

**Giải thích correlation:**
```
correlation = 1.0     → physical order = logical order (BRIN rất hiệu quả)
correlation = -1.0    → hoàn toàn ngược chiều
correlation = 0.0     → random (BRIN kém hiệu quả)
```

### 7.3 ANALYZE command

`ANALYZE` cập nhật statistics về data distribution — cho phép planner đưa ra quyết định chính xác hơn.

```sql
-- Analyze toàn bộ database
ANALYZE;

-- Analyze một bảng cụ thể
ANALYZE orders;

-- Analyze một column cụ thể
ANALYZE orders(user_id, status, created_at);
```

**Khi nào cần chạy ANALYZE thủ công:**
- Sau khi import lượng lớn data (`COPY`, `INSERT ... SELECT`)
- Sau khi `DELETE` xóa nhiều rows
- Khi `EXPLAIN ANALYZE` cho thấy rows estimated ≠ actual (chênh lệch lớn)
- Sau khi tạo index mới trên bảng chưa được ANALYZE gần đây

### 7.4 Tăng Statistics Target

Mặc định PostgreSQL sample **300 rows** per column (default_statistics_target = 100). Với skewed data, tăng target để có statistics chính xác hơn.

```sql
-- Tăng global (ảnh hưởng mọi columns)
SET default_statistics_target = 200;  -- session-level

-- Tăng cho column cụ thể (persistent)
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE users ALTER COLUMN country SET STATISTICS 300;

-- Sau khi thay đổi, chạy ANALYZE để cập nhật
ANALYZE orders(status);
ANALYZE users(country);
```

---

## 8. Index Maintenance — Bloat, VACUUM, REINDEX

### 8.1 Index Bloat là gì?

Khi DELETE hoặc UPDATE xảy ra:
1. Old row version được **mark as dead** (không xóa ngay) — MVCC
2. Index entries trỏ đến dead rows vẫn còn trong index → **dead index entries**
3. Theo thời gian, index chứa nhiều dead entries → **index bloat**

```
Index B-Tree (bị bloat):
Leaf page 1: [live][dead][dead][live][dead] → 60% dead
Leaf page 2: [dead][dead][live][dead][live] → 60% dead
...
→ Index lớn hơn cần thiết → đọc thêm pages → chậm hơn
```

### 8.2 VACUUM và Index

`VACUUM` dọn dead tuples khỏi heap VÀ đánh dấu dead index entries là recyclable:

```sql
-- Manual VACUUM
VACUUM orders;

-- VACUUM VERBOSE: xem chi tiết
VACUUM (VERBOSE, ANALYZE) orders;

-- Output mẫu:
-- INFO: vacuuming "public.orders"
-- INFO: index "idx_orders_user_id" now contains 245000 row versions in 2034 pages
--       245000 index row versions were removed
--       0 index pages were newly deleted
--       0 index pages currently deleted
```

**autovacuum** tự động chạy dựa trên:
```
autovacuum_vacuum_threshold = 50        (số rows dead tối thiểu)
autovacuum_vacuum_scale_factor = 0.2    (20% bảng)
→ Trigger khi: dead_rows > 50 + 0.2 * table_size
```

### 8.3 Phát hiện Index Bloat

```sql
-- Query phát hiện index bloat (từ pgstattuple extension)
CREATE EXTENSION pgstattuple;

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    pgstattuple.free_percent || '%' AS bloat_percent
FROM pg_stat_user_indexes
CROSS JOIN LATERAL pgstattuple(indexrelid::regclass) AS pgstattuple
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Query ước tính bloat mà không cần pgstattuple (nhanh hơn):
SELECT
    nspname || '.' || relname AS index_name,
    pg_size_pretty(pg_relation_size(c.oid)) AS current_size,
    round(100 * (1 - avg_leaf_density / fillfactor)::numeric, 1) || '%' AS est_bloat
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_stat_user_indexes si ON si.indexrelid = i.indexrelid
CROSS JOIN (SELECT 90 AS fillfactor) ff  -- assume fillfactor=90
WHERE nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(c.oid) DESC;
```

### 8.4 REINDEX

Khi index bloat quá nặng, rebuild index từ đầu:

```sql
-- ❌ Lock table (tránh trong production):
REINDEX INDEX idx_orders_user_id;
REINDEX TABLE orders;  -- rebuild tất cả indexes

-- ✅ An toàn trong production (PostgreSQL 12+):
REINDEX INDEX CONCURRENTLY idx_orders_user_id;
REINDEX TABLE CONCURRENTLY orders;
```

**REINDEX CONCURRENTLY** tạo index mới song song với index cũ, sau đó swap atomic.

### 8.5 fillfactor — Dành space cho HOT updates

`fillfactor` quy định % space được fill khi tạo page index (leaf nodes). Phần còn lại dành cho future inserts/HOT updates trong cùng page.

```sql
-- Default fillfactor = 90 (10% free space dành cho HOT)
CREATE INDEX idx_orders_user ON orders(user_id)
WITH (fillfactor = 70);  -- 30% free → nhiều HOT updates hơn

-- Khi nào giảm fillfactor:
-- → Bảng có nhiều UPDATE trên indexed columns
-- → Muốn tối ưu HOT để giảm index maintenance

-- Khi nào tăng fillfactor về 100:
-- → Bảng append-only (chỉ INSERT, không UPDATE)
-- → Tiết kiệm disk space tối đa
```

---

## 9. Monitoring Indexes trong Production

### 9.1 Xem tất cả indexes

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 9.2 Phát hiện Unused Indexes ⚠️

Đây là một trong những lỗi production nghiêm trọng nhất — index không dùng vẫn tốn disk và làm chậm writes.

```sql
SELECT
    schemaname || '.' || tablename AS table,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_scanned,
    idx_tup_read AS rows_read_via_index,
    idx_tup_fetch AS rows_fetched_from_heap
FROM pg_stat_user_indexes
JOIN pg_indexes USING (schemaname, tablename, indexname)
WHERE idx_scan = 0                          -- chưa từng được dùng
  AND schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'           -- loại trừ primary keys
ORDER BY pg_relation_size(indexrelid) DESC;
```

**⚠️ Lưu ý:** `pg_stat_user_indexes` reset khi restart PostgreSQL. Chỉ kết luận "unused" sau khi monitor **ít nhất 1-2 tuần** production traffic.

### 9.3 Index Usage Stats

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan                    AS index_scans,
    idx_tup_read                AS index_entries_read,
    idx_tup_fetch               AS heap_tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    CASE WHEN idx_scan = 0 THEN 'UNUSED ⚠️'
         WHEN idx_scan < 10 THEN 'RARELY USED'
         WHEN idx_scan < 1000 THEN 'MODERATE'
         ELSE 'HEAVILY USED ✅'
    END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 9.4 Missing Indexes (từ Sequential Scans)

```sql
-- Tìm bảng đang bị Seq Scan nhiều nhất (có thể thiếu index)
SELECT
    schemaname,
    relname AS tablename,
    seq_scan,
    idx_scan,
    round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS seq_scan_pct,
    n_live_tup AS estimated_rows,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND n_live_tup > 10000      -- bỏ qua bảng nhỏ
  AND schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;
```

### 9.5 Index Hit Rate

```sql
-- Tỷ lệ cache hit của indexes (nên > 95%)
SELECT
    sum(idx_blks_hit) AS index_blocks_hit,
    sum(idx_blks_read) AS index_blocks_read,
    round(
        100.0 * sum(idx_blks_hit) /
        NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0),
        2
    ) AS index_cache_hit_ratio
FROM pg_statio_user_indexes;
```

---

## 10. Chiến lược Index thực chiến theo Domain

### 10.1 E-commerce / Loyalty System

```sql
-- ============================================================
-- USERS TABLE
-- ============================================================

-- Lookup bởi email (login, check duplicate)
CREATE UNIQUE INDEX idx_users_email
ON users(email)
WHERE deleted_at IS NULL;

-- Lookup bởi phone number
CREATE UNIQUE INDEX idx_users_phone
ON users(phone_number)
WHERE phone_number IS NOT NULL AND deleted_at IS NULL;

-- Leaderboard theo loyalty tier + points
CREATE INDEX idx_users_leaderboard
ON users(tier ASC, total_points DESC NULLS LAST)
WHERE status = 'ACTIVE';

-- Admin: filter users theo created date + status
CREATE INDEX idx_users_admin
ON users(created_at DESC)
INCLUDE (email, status, tier)
WHERE deleted_at IS NULL;


-- ============================================================
-- POINT TRANSACTIONS TABLE
-- ============================================================

-- Query lịch sử điểm của một user theo thời gian
CREATE INDEX idx_point_tx_user_date
ON point_transactions(user_id, created_at DESC);

-- Query tổng điểm theo loại trong khoảng thời gian
CREATE INDEX idx_point_tx_user_type_date
ON point_transactions(user_id, type, created_at DESC);

-- Aggregate query: tổng điểm mỗi tháng (covering index)
CREATE INDEX idx_point_tx_covering
ON point_transactions(user_id, created_at DESC)
INCLUDE (points, type, reference_id);

-- Unprocessed events (partial index, cực nhỏ)
CREATE INDEX idx_point_tx_pending
ON point_transactions(user_id, created_at)
WHERE processed = false;


-- ============================================================
-- VOUCHERS / REDEMPTIONS TABLE
-- ============================================================

-- Check duplicate redemption (unique partial)
CREATE UNIQUE INDEX idx_redemptions_unique
ON voucher_redemptions(user_id, voucher_id)
WHERE status != 'CANCELLED';

-- Active vouchers của một user
CREATE INDEX idx_vouchers_user_active
ON user_vouchers(user_id, expiry_date ASC)
WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- Lookup voucher by code
CREATE UNIQUE INDEX idx_vouchers_code
ON vouchers(lower(code))  -- case-insensitive
WHERE status = 'ACTIVE';


-- ============================================================
-- ORDERS TABLE
-- ============================================================

-- Lịch sử orders của user (most common query)
CREATE INDEX idx_orders_user_date
ON orders(user_id, created_at DESC)
INCLUDE (status, total_amount);

-- Filter orders theo status (partial indexes thay vì 1 composite)
CREATE INDEX idx_orders_pending
ON orders(created_at)
WHERE status = 'PENDING';

CREATE INDEX idx_orders_processing
ON orders(user_id, created_at)
WHERE status IN ('PAID', 'PREPARING', 'SHIPPED');

-- Revenue analytics theo ngày
CREATE INDEX idx_orders_analytics
ON orders(date_trunc('day', created_at), status)
INCLUDE (total_amount)
WHERE status = 'COMPLETED';


-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================

-- Unread notifications của user (partial: chỉ unread)
CREATE INDEX idx_notifications_unread
ON notifications(user_id, created_at DESC)
WHERE read_at IS NULL;

-- Tất cả notifications (read + unread)
CREATE INDEX idx_notifications_user
ON notifications(user_id, created_at DESC)
INCLUDE (type, title, read_at);


-- ============================================================
-- PRODUCTS TABLE (E-commerce)
-- ============================================================

-- Full-text search với GIN
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX idx_products_fts
ON products USING GIN(search_vector);

-- JSONB attributes search
CREATE INDEX idx_products_attributes
ON products USING GIN(attributes jsonb_path_ops);

-- Price range filter
CREATE INDEX idx_products_price
ON products(base_price)
WHERE deleted_at IS NULL AND published_at IS NOT NULL;

-- Brand + price (faceted search)
CREATE INDEX idx_products_brand_price
ON products(brand_id, base_price)
WHERE deleted_at IS NULL AND published_at IS NOT NULL;
```

### 10.2 Fintech / Banking

```sql
-- ============================================================
-- ACCOUNTS TABLE
-- ============================================================

-- Lookup account by number (critical path)
CREATE UNIQUE INDEX idx_accounts_number
ON accounts(account_number)
WHERE closed_at IS NULL;

-- Customer's accounts
CREATE INDEX idx_accounts_customer
ON accounts(customer_id, account_type)
WHERE closed_at IS NULL;


-- ============================================================
-- TRANSACTIONS TABLE (high-volume)
-- ============================================================

-- Core query: transactions của account theo thời gian
CREATE INDEX idx_txn_account_date
ON financial_transactions(account_id, created_at DESC);

-- Double-spend / idempotency check
CREATE UNIQUE INDEX idx_txn_idempotency
ON financial_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Reconciliation: transactions theo ngày chưa reconciled
CREATE INDEX idx_txn_reconcile
ON financial_transactions(transaction_date, status)
WHERE reconciled = false;

-- BRIN index cho audit log (huge table, time-series)
CREATE INDEX idx_audit_log_brin
ON audit_log USING BRIN(created_at)
WITH (pages_per_range = 64);


-- ============================================================
-- BALANCE TRACKING
-- ============================================================

-- Optimistic locking pattern
CREATE INDEX idx_balances_account_version
ON account_balances(account_id, version DESC);
```

### 10.3 Chat / Messaging System

```sql
-- Messages: query N messages mới nhất trong conversation
CREATE INDEX idx_messages_conversation
ON messages(conversation_id, created_at DESC)
INCLUDE (sender_id, content_preview, read_at)
WHERE deleted_at IS NULL;

-- Unread count per user per conversation
CREATE INDEX idx_messages_unread
ON messages(conversation_id, sender_id)
WHERE read_at IS NULL AND deleted_at IS NULL;

-- Full-text search trong messages
CREATE INDEX idx_messages_fts
ON messages USING GIN(to_tsvector('simple', content))
WHERE deleted_at IS NULL;

-- Cursor-based pagination (keyset pagination)
CREATE INDEX idx_messages_cursor
ON messages(conversation_id, id DESC)
WHERE deleted_at IS NULL;
```

---

## 11. Anti-patterns — Những lỗi phổ biến

### 11.1 Index trên Low-Cardinality Column

```sql
-- ❌ Sai: status chỉ có 3 values → index scan KHÔNG hiệu quả
CREATE INDEX idx_orders_status ON orders(status);

-- PostgreSQL sẽ ưu thích Seq Scan vì:
-- Index Scan: random I/O cho 33% rows (status='COMPLETED') → chậm hơn Seq Scan
-- Planner estimate: rows = 33% * 10M = 3.3M → quá nhiều cho Index Scan

-- ✅ Đúng: Partial index chỉ cho minority values
CREATE INDEX idx_orders_pending ON orders(created_at) WHERE status = 'PENDING';
-- status='PENDING' chỉ ~1% rows → Index Scan hiệu quả
```

### 11.2 Wrapping Indexed Column trong Function

```sql
-- ❌ Function wrap phá vỡ index
SELECT * FROM users WHERE UPPER(email) = 'ALICE@EXAMPLE.COM';
-- → PostgreSQL không thể dùng index trên column email
-- → Seq Scan!

-- ✅ Giải pháp 1: Expression index
CREATE INDEX idx_users_email_upper ON users(UPPER(email));
SELECT * FROM users WHERE UPPER(email) = 'ALICE@EXAMPLE.COM';

-- ✅ Giải pháp 2: Store normalized value
CREATE INDEX idx_users_email ON users(email);
-- Normalize khi insert/update: luôn lower-case email trước khi lưu
SELECT * FROM users WHERE email = lower('ALICE@EXAMPLE.COM');

-- ❌ Các trường hợp tương tự:
WHERE DATE(created_at) = '2024-01-01'       -- dùng DATE() → phá index
WHERE created_at::date = '2024-01-01'       -- cast → phá index
WHERE YEAR(created_at) = 2024               -- MySQL syntax, nhưng tương tự
WHERE LENGTH(description) > 100            -- hàm trên indexed column

-- ✅ Cách viết đúng:
WHERE created_at >= '2024-01-01' AND created_at < '2024-01-02'
```

### 11.3 Implicit Type Casting

```sql
-- Bảng: orders.user_id là INTEGER
-- Query:
SELECT * FROM orders WHERE user_id = '12345';  -- string '12345'

-- PostgreSQL phải cast '12345'::text → integer cho mọi row
-- → Index có thể không được dùng (tùy version và operator)

-- ✅ Luôn dùng đúng type:
SELECT * FROM orders WHERE user_id = 12345;  -- integer literal
```

### 11.4 Quá nhiều Index

```sql
-- ❌ Anti-pattern: index mọi column
CREATE INDEX idx1 ON orders(user_id);
CREATE INDEX idx2 ON orders(status);
CREATE INDEX idx3 ON orders(created_at);
CREATE INDEX idx4 ON orders(payment_method);
CREATE INDEX idx5 ON orders(shipping_address_id);
-- → 5 indexes × UPDATE mọi row = 5x chi phí write

-- ✅ Phân tích query patterns thực tế, tạo composite index:
CREATE INDEX idx_orders_main ON orders(user_id, created_at DESC)
INCLUDE (status, payment_method);
-- 1 index covering nhiều query patterns
```

### 11.5 NULL Handling

```sql
-- B-Tree INDEX bao gồm NULL values
-- Tuy nhiên:

-- Query này KHÔNG dùng index (thường)
SELECT * FROM users WHERE phone IS NULL;
-- NULL-only queries thường không selective → Seq Scan

-- ✅ Partial index nếu cần query NULL
CREATE INDEX idx_users_no_phone ON users(id)
WHERE phone IS NULL;

-- Và trong composite index, NULL ordering quan trọng:
CREATE INDEX idx_tasks_due ON tasks(due_date ASC NULLS LAST);
-- Đảm bảo ORDER BY due_date NULLS LAST dùng được index
```

### 11.6 Không ANALYZE sau khi Load Data

```sql
-- ❌ Load data mà không ANALYZE
COPY orders FROM '/tmp/orders.csv';
-- pg_stats vẫn cũ → planner đưa ra plan sai → query chậm

-- ✅ Luôn ANALYZE sau bulk load
COPY orders FROM '/tmp/orders.csv';
ANALYZE orders;
-- Hoặc:
VACUUM ANALYZE orders;  -- dọn dead tuples + cập nhật stats cùng lúc
```

### 11.7 Dùng OFFSET lớn

```sql
-- ❌ OFFSET lớn → scan và discard nhiều rows
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
-- Phải scan 10020 rows, discard 10000

-- ✅ Keyset pagination (cursor-based)
-- Lần đầu:
SELECT id, created_at, total_amount
FROM orders
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- → Lấy được last_created_at, last_id từ response

-- Lần sau:
SELECT id, created_at, total_amount
FROM orders
WHERE (created_at, id) < (last_created_at, last_id)  -- composite comparison
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- → Index scan chỉ 20 rows!

-- Index hỗ trợ keyset pagination:
CREATE INDEX idx_orders_keyset ON orders(created_at DESC, id DESC);
```

---

## 12. Benchmark: Trước vs Sau khi thêm Index

### 12.1 Setup test

```sql
-- Tạo bảng test với 5 triệu rows
CREATE TABLE benchmark_orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    status      VARCHAR(20) NOT NULL,
    total_amount DECIMAL(12,2),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    payload     JSONB
);

-- Insert 5 triệu rows
INSERT INTO benchmark_orders (user_id, status, total_amount, created_at, payload)
SELECT
    (random() * 100000)::int + 1,
    (ARRAY['PENDING','PAID','SHIPPED','COMPLETED','CANCELLED'])[ceil(random()*5)],
    (random() * 5000000)::numeric(12,2),
    NOW() - (random() * interval '365 days'),
    jsonb_build_object('channel', (ARRAY['WEB','MOBILE','API'])[ceil(random()*3)])
FROM generate_series(1, 5000000);

ANALYZE benchmark_orders;
```

### 12.2 Query 1: Single column lookup

```sql
-- Query: tìm orders của user_id = 12345
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM benchmark_orders WHERE user_id = 12345;

-- TRƯỚC INDEX:
-- Seq Scan on benchmark_orders
-- actual time=0.023..1823.456   ← ~1.8 giây
-- rows=50  (trả về 50 rows trong 5M)
-- Buffers: shared read=68943    ← đọc 68943 pages từ disk

-- Tạo index:
CREATE INDEX idx_bench_user_id ON benchmark_orders(user_id);

-- SAU INDEX:
-- Index Scan using idx_bench_user_id
-- actual time=0.034..0.312      ← ~0.3ms (6000x faster!)
-- Buffers: shared hit=5 read=3  ← chỉ 8 pages
```

### 12.3 Query 2: Composite + ORDER BY

```sql
-- Query: lịch sử orders của user, 20 gần nhất
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, total_amount, created_at
FROM benchmark_orders
WHERE user_id = 12345
ORDER BY created_at DESC
LIMIT 20;

-- TRƯỚC INDEX (chỉ có idx_bench_user_id):
-- Index Scan (user_id) + Sort
-- actual time=0.034..1.234
-- Sort Method: quicksort Memory: 29kB  (sort 50 rows trong memory - OK)

-- Tạo composite + covering index:
CREATE INDEX idx_bench_user_date_covering
ON benchmark_orders(user_id, created_at DESC)
INCLUDE (status, total_amount);

-- SAU INDEX:
-- Index Only Scan
-- actual time=0.021..0.034      ← không cần fetch heap!
-- Heap Fetches: 0
-- rows=20
```

### 12.4 Query 3: Partial Index

```sql
-- Query: unprocessed orders cần xử lý
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, created_at
FROM benchmark_orders
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 100;

-- TRƯỚC: Seq Scan (~1% rows là PENDING = 50K rows)
-- actual time=0.023..450.123

-- Tạo partial index:
CREATE INDEX idx_bench_pending
ON benchmark_orders(created_at)
WHERE status = 'PENDING';

-- SAU:
-- Index Scan using idx_bench_pending
-- actual time=0.021..0.145    ← 3000x faster!
-- Index size: ~500KB (vs ~180MB cho full B-Tree trên status+created_at)
```

### 12.5 Bảng tóm tắt benchmark

| Query | Không có index | Sau index tối ưu | Speedup |
|-------|---------------|-----------------|---------|
| `WHERE user_id = ?` | 1823ms | 0.3ms | **6100x** |
| `WHERE user_id = ? ORDER BY created_at DESC LIMIT 20` | 1.2ms | 0.034ms | **35x** |
| `WHERE status = 'PENDING' ORDER BY created_at` | 450ms | 0.145ms | **3100x** |
| Full-text search với ILIKE | 1500ms | 15ms (GIN) | **100x** |
| JSONB field lookup | 800ms | 8ms (GIN) | **100x** |

---

## 13. Câu hỏi phỏng vấn chuyên sâu

### Q1: "Giải thích tại sao Seq Scan đôi khi tốt hơn Index Scan?"

> **Trả lời:** Index Scan sinh ra **random I/O** — mỗi TID trỏ đến một heap page khác nhau, có thể phải đọc hàng nghìn pages ở các vị trí ngẫu nhiên trên disk. Ngược lại, Seq Scan đọc **toàn bộ file theo thứ tự tuần tự** — rất hiệu quả với HDD (sequential read ~200MB/s vs random read ~0.5MB/s) và được tối ưu bởi OS prefetching. Do đó, khi query trả về >10-20% tổng số rows, planner thường chọn Seq Scan. Trên SSD thì threshold cao hơn vì random I/O không chênh nhiều so với sequential.

---

### Q2: "Index Only Scan hoạt động thế nào? Tại sao Heap Fetches > 0?"

> **Trả lời:** Index Only Scan lấy data hoàn toàn từ index leaf nodes, không cần fetch heap. Tuy nhiên, PostgreSQL vẫn phải đảm bảo **visibility** (MVCC). Nó dùng **visibility map** — một bitmap lưu pages nào đã "all-visible" (mọi tuples đều visible cho mọi transactions). Nếu page chưa được đánh dấu all-visible (vì VACUUM chưa chạy), PostgreSQL phải fetch heap page để check xmin/xmax của từng tuple → `Heap Fetches > 0`. Giải pháp: chạy `VACUUM` để cập nhật visibility map.

---

### Q3: "Khi nào nên dùng GIN thay vì GiST cho full-text search?"

> **Trả lời:** Chọn **GIN** khi workload read-heavy (lookup nhanh hơn), dữ liệu ít update. Chọn **GiST** khi insert/update thường xuyên (GiST cập nhật nhanh hơn vì không có posting lists), hoặc cần KNN (nearest neighbor) — GiST hỗ trợ KNN còn GIN thì không. Trong thực tế production với search-heavy system, GIN là lựa chọn phổ biến hơn.

---

### Q4: "INCLUDE clause trong index khác gì composite key?"

> **Trả lời:** Columns trong **key** tham gia vào B-Tree ordering và filtering. Columns trong **INCLUDE** chỉ tồn tại ở leaf nodes — không ảnh hưởng tree structure, không dùng để filter hay sort, chỉ dùng để tránh heap fetch. Ví dụ: `CREATE INDEX ON orders(user_id) INCLUDE (status)` → chỉ filter/sort được theo `user_id`; `status` chỉ để Index Only Scan. Ngược lại `CREATE INDEX ON orders(user_id, status)` → có thể filter/sort theo cả hai, nhưng tree sẽ có nhiều unique keys hơn (vì key bao gồm cả status).

---

### Q5: "Explain rows mismatch trong EXPLAIN ANALYZE có nghĩa gì?"

> **Trả lời:** Khi `estimated rows` ≠ `actual rows` đáng kể (ví dụ estimated=100 actual=50000), planner đang đưa ra quyết định sai. Nguyên nhân: statistics lỗi thời (chưa ANALYZE sau khi data thay đổi nhiều), hoặc column có data skewed mà default statistics target (100) không đủ mịn. Giải pháp: `ANALYZE table_name` và/hoặc `ALTER TABLE t ALTER COLUMN c SET STATISTICS 500` rồi ANALYZE lại.

---

### Q6: "Tại sao không nên index tất cả columns?"

> **Trả lời:** Mỗi index có chi phí: (1) **Write amplification** — INSERT/UPDATE/DELETE phải cập nhật mọi index → N indexes = N lần overhead. Với bảng có 10 indexes, một UPDATE thay đổi 5 columns có thể phải cập nhật 5 indexes. (2) **Disk space** — mỗi B-Tree index ~30-50% kích thước bảng. (3) **autovacuum pressure** — nhiều index entries dead → autovacuum phải làm nhiều việc hơn, chiếm I/O và CPU. (4) **Planner confusion** — quá nhiều index options có thể làm planner mất thêm thời gian để chọn plan tối ưu.

---

### Q7: "BRIN index có thể thay thế B-Tree cho timestamp column không?"

> **Trả lời:** Phụ thuộc vào pattern data. BRIN **chỉ hiệu quả** khi data có **correlation cao** giữa thứ tự vật lý (heap) và thứ tự logical của column (correlation gần 1.0 trong `pg_stats`). Với bảng log append-only, `created_at` correlation ≈ 1.0 → BRIN rất hiệu quả, size nhỏ gọn (vài KB cho tỷ rows). Nhưng với bảng có UPDATE thường xuyên làm rows dịch chuyển ngẫu nhiên, correlation thấp → BRIN kém hiệu quả hơn B-Tree nhiều. Kiểm tra: `SELECT correlation FROM pg_stats WHERE tablename = 't' AND attname = 'created_at'`.

---

### Q8: "HOT update là gì và tại sao nó quan trọng?"

> **Trả lời:** **HOT (Heap-Only Tuple)** là optimization của PostgreSQL: khi UPDATE không thay đổi indexed columns VÀ còn free space trong cùng heap page (vì fillfactor), new row version được đặt trong cùng page và index **không được cập nhật** — chỉ có redirect chain trong heap. Điều này tiết kiệm đáng kể I/O với write-heavy workloads, vì không phải cập nhật index B-Tree. Để tận dụng HOT, giảm fillfactor của index xuống 70-80%, và tránh UPDATE các indexed columns khi không cần thiết.

---

### Q9: "Làm sao debug query chậm một cách có hệ thống?"

> **Trả lời (systematic approach):**
> ```
> 1. EXPLAIN (ANALYZE, BUFFERS) query_chậm
>    → Tìm node có "actual time" cao nhất (bottleneck)
>
> 2. Kiểm tra scan type:
>    Seq Scan trên bảng lớn → thiếu index
>    Index Scan với rows mismatch → cần ANALYZE
>    Sort với Disk → tăng work_mem
>    Hash Batches > 1 → tăng work_mem
>
> 3. Kiểm tra pg_stat_user_tables:
>    seq_scan cao → thiếu index
>    n_dead_tup cao → cần VACUUM
>
> 4. Kiểm tra pg_stat_user_indexes:
>    idx_scan = 0 → index không được dùng (wrong type, implicit cast, etc.)
>
> 5. Kiểm tra pg_stats:
>    estimated ≠ actual rows nhiều → cần ANALYZE hoặc tăng statistics target
> ```

---

## Tóm tắt nhanh (Quick Reference)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHỌN LOẠI INDEX                                      │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Use case                     │ Index type                              │
├──────────────────────────────┼──────────────────────────────────────────┤
│ =, <, >, BETWEEN, LIKE 'x%'  │ B-Tree (default)                        │
│ Chỉ = (token, UUID dài)      │ Hash                                    │
│ Arrays, JSONB, full-text     │ GIN                                     │
│ Geospatial, Range types, KNN │ GiST                                    │
│ Time-series append-only      │ BRIN                                    │
│ Multiple = conditions        │ Bloom                                   │
├──────────────────────────────┼──────────────────────────────────────────┤
│                    THUỘC TÍNH INDEX                                     │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Chỉ subset rows              │ Partial (WHERE clause)                  │
│ Tránh heap fetch             │ Covering (INCLUDE clause)               │
│ Index trên computed value    │ Expression index                        │
│ Enforce uniqueness           │ UNIQUE                                  │
│ Không block production       │ CONCURRENTLY                            │
├──────────────────────────────┼──────────────────────────────────────────┤
│                    KHI NÀO INDEX KHÔNG ĐƯỢC DÙNG                       │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Function wrap column         │ WHERE UPPER(col) = ... → dùng expr idx  │
│ Implicit type cast           │ WHERE int_col = '123' → cast đúng type  │
│ Skip leftmost column         │ Composite (a,b,c) + WHERE b=1           │
│ Low selectivity              │ status=X khi X chiếm 40% rows → skip    │
│ No ANALYZE sau bulk load     │ Stats lỗi thời → plan sai               │
└──────────────────────────────┴──────────────────────────────────────────┘
```

---

*Tài liệu tổng hợp cho hệ thống NestJS E-commerce / Fintech / Loyalty*
*Cập nhật: 2026 — PostgreSQL 15/16*
