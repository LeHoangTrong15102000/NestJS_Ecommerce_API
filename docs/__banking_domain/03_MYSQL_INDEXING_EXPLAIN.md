# MySQL Indexing & EXPLAIN — Banking Domain

> **Mục tiêu:** Hiểu B-Tree Index, Composite Index, cách đọc `EXPLAIN` để phát hiện Full Table Scan, và chiến lược tối ưu index cho bảng giao dịch tài chính.

---

## Mục lục

1. [B-Tree Index — Cấu trúc nền tảng](#1-b-tree-index--cấu-trúc-nền-tảng)
2. [Single vs Composite Index](#2-single-vs-composite-index)
3. [Quy tắc Leftmost Prefix](#3-quy-tắc-leftmost-prefix)
4. [Covering Index — Tối ưu đọc nhanh](#4-covering-index--tối-ưu-đọc-nhanh)
5. [EXPLAIN — Đọc query plan MySQL](#5-explain--đọc-query-plan-mysql)
6. [Chiến lược Index cho Banking Workload](#6-chiến-lược-index-cho-banking-workload)
7. [Câu hỏi phỏng vấn thường gặp](#7-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. B-Tree Index — Cấu trúc nền tảng

### 1.1 Cấu trúc B-Tree

MySQL InnoDB dùng **B+ Tree** (biến thể của B-Tree) cho tất cả index.

```
Ví dụ: Index trên cột account_id

                    [50]
                   /    \
              [20, 35]   [70, 85]
             /  |   \    /   |   \
          [10] [25] [40] [60] [75] [90]
           ↓    ↓    ↓    ↓    ↓    ↓
         Rows  Rows  Rows Rows Rows Rows

Đặc điểm B+ Tree:
  - Data chỉ lưu ở leaf nodes (nút lá)
  - Leaf nodes được liên kết thành Linked List → hiệu quả cho range scan
  - Chiều cao thấp → O(log n) cho mọi lookup
  - Một B+ Tree cao 3 tầng có thể chứa hàng triệu records
```

### 1.2 Tại sao B-Tree hiệu quả hơn full scan?

```
Bảng transactions có 10,000,000 rows
Tìm kiếm: WHERE account_id = 12345

Không có index (Full Table Scan):
  → Đọc TẤT CẢ 10M rows
  → 10M × random disk I/O → RẤT CHẬM

Có B-Tree Index trên account_id:
  → 3-4 bước tra cứu tree (O(log n))
  → Tìm được ngay leaf node chứa rows có account_id = 12345
  → Chỉ đọc vài dozen rows → NHANH HƠN HỠN
```

### 1.3 Primary Key Index vs Secondary Index

```
Clustered Index (Primary Key) — InnoDB:
  - Data rows được lưu THEO THỨ TỰ của Primary Key
  - Primary Key IS the index → không cần tra cứu thêm
  - Rất nhanh khi query theo PK

Secondary Index (tất cả index khác):
  - Lưu (indexed_column_value, primary_key_value)
  - Khi query, cần 2 bước:
    1. Lookup secondary index → lấy PK
    2. Lookup clustered index với PK → lấy row đầy đủ (Index Seek)
  → Chậm hơn Primary Key lookup
  → Giải pháp: Covering Index (xem mục 4)
```

---

## 2. Single vs Composite Index

### 2.1 Single Column Index

```sql
-- Bảng giao dịch ngân hàng
CREATE TABLE transactions (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id  BIGINT NOT NULL,
  amount      DECIMAL(15, 2) NOT NULL,
  type        ENUM('DEBIT', 'CREDIT') NOT NULL,
  status      ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL,
  created_at  DATETIME NOT NULL,
  reference   VARCHAR(100)
);

-- Single index
CREATE INDEX idx_account_id ON transactions(account_id);

-- Query sử dụng được index:
SELECT * FROM transactions WHERE account_id = 12345;
-- → Index scan trên idx_account_id → FAST ✅

-- Query KHÔNG sử dụng được index:
SELECT * FROM transactions WHERE account_id = 12345 AND status = 'SUCCESS';
-- → MySQL dùng idx_account_id để filter account_id=12345
-- → Rồi phải scan TẤT CẢ rows của account đó để filter status
-- → Nếu account có 50,000 giao dịch → scan 50,000 rows → CHẬM
```

### 2.2 Composite Index (Index nhiều cột)

```sql
-- Composite index phù hợp cho banking query patterns
CREATE INDEX idx_account_status_date ON transactions(account_id, status, created_at);

-- Queries tận dụng tốt index này:
-- 1. Lấy tất cả giao dịch của account:
SELECT * FROM transactions WHERE account_id = 12345;

-- 2. Lấy giao dịch SUCCESS của account:
SELECT * FROM transactions WHERE account_id = 12345 AND status = 'SUCCESS';

-- 3. Giao dịch SUCCESS trong khoảng thời gian:
SELECT * FROM transactions 
WHERE account_id = 12345 AND status = 'SUCCESS' AND created_at >= '2025-01-01';

-- Query KHÔNG tận dụng được:
SELECT * FROM transactions WHERE status = 'FAILED';
-- → Thiếu account_id (cột đầu) → Full Table Scan
-- → Xem mục 3: Leftmost Prefix Rule
```

---

## 3. Quy tắc Leftmost Prefix

> **Quy tắc:** Index `(A, B, C)` có thể dùng cho query filter trên `A`, `A+B`, hoặc `A+B+C`. KHÔNG dùng được nếu thiếu cột đầu tiên A.

```sql
-- Index: (account_id, status, created_at)

-- ✅ Dùng được:
WHERE account_id = 1                           -- Dùng cột A
WHERE account_id = 1 AND status = 'SUCCESS'    -- Dùng A+B
WHERE account_id = 1 AND status = 'SUCCESS' AND created_at > '2025-01-01' -- A+B+C

-- ❌ KHÔNG dùng được (thiếu account_id):
WHERE status = 'SUCCESS'                        -- Chỉ B (bỏ A)
WHERE created_at > '2025-01-01'                 -- Chỉ C
WHERE status = 'SUCCESS' AND created_at > '...' -- B+C (bỏ A)

-- ⚠️ Dùng được một phần:
WHERE account_id = 1 AND created_at > '2025-01-01'
-- → Dùng được phần A, B bị bỏ qua
-- → MySQL dùng index cho account_id rồi scan để filter created_at

-- Range trên cột giữa sẽ DỪNG index:
WHERE account_id = 1 AND status LIKE 'S%' AND created_at > '2025-01-01'
-- → Dùng A+B (prefix match), created_at KHÔNG được dùng index
-- → Vì status là range condition (LIKE) → MySQL dừng ở đó
```

### Ví dụ thực tế — Banking queries thường gặp

```sql
-- Use case 1: Xem lịch sử giao dịch của tài khoản
-- Query: account + time range
CREATE INDEX idx_acc_time ON transactions(account_id, created_at);
SELECT * FROM transactions 
WHERE account_id = 1 AND created_at BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY created_at DESC
LIMIT 20;

-- Use case 2: Kiểm tra giao dịch pending cần xử lý
-- Query: status + time (hot query cho payment processor)
CREATE INDEX idx_status_time ON transactions(status, created_at);
SELECT * FROM transactions 
WHERE status = 'PENDING' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
ORDER BY created_at ASC
LIMIT 100;

-- Use case 3: Tìm giao dịch theo reference number
-- Query: reference number (unique)
CREATE UNIQUE INDEX idx_reference ON transactions(reference);
SELECT * FROM transactions WHERE reference = 'TXN20250101001';

-- Use case 4: Đối soát theo loại giao dịch + ngày
-- Query: type + date (cho reconciliation)
CREATE INDEX idx_type_date ON transactions(type, DATE(created_at));
-- Lưu ý: function-based index (MySQL 5.7+ hỗ trợ)
```

---

## 4. Covering Index — Tối ưu đọc nhanh

### 4.1 Khái niệm

**Covering Index** = Index chứa TẤT CẢ các cột mà query cần → không cần đọc row từ table chính.

```sql
-- Câu query phổ biến: Lấy danh sách giao dịch để hiển thị
SELECT account_id, amount, type, created_at 
FROM transactions 
WHERE account_id = 12345 AND status = 'SUCCESS'
ORDER BY created_at DESC
LIMIT 10;

-- Index thông thường: (account_id, status)
-- → Tìm rows qua index, rồi đọc lại table để lấy amount, type, created_at
-- → 2 lookups

-- Covering Index: (account_id, status, created_at, amount, type)
-- → Index ĐÃ CÓ TẤT CẢ cột cần → không cần đọc table
-- → 1 lookup → NHANH HƠN ~2-3x
CREATE INDEX idx_covering_txn 
ON transactions(account_id, status, created_at, amount, type);
```

### 4.2 Nhận biết Covering Index trong EXPLAIN

```
EXPLAIN output:
  Extra: Using index  ← Đây là dấu hiệu covering index đang được dùng
  → MySQL chỉ đọc từ index, không cần đọc table data
```

---

## 5. EXPLAIN — Đọc query plan MySQL

### 5.1 Chạy EXPLAIN

```sql
EXPLAIN SELECT * FROM transactions 
WHERE account_id = 12345 AND status = 'SUCCESS'
ORDER BY created_at DESC
LIMIT 20;
```

### 5.2 Các cột quan trọng trong EXPLAIN output

```
+----+-------------+--------------+------+---------+------+---------+-------+
| id | select_type | table        | type | key     | rows | filtered| Extra |
+----+-------------+--------------+------+---------+------+---------+-------+
|  1 | SIMPLE      | transactions | ref  | idx_acc | 1234 |   10.00 | ...   |
+----+-------------+--------------+------+---------+------+---------+-------+
```

#### Cột `type` — Quan trọng nhất (từ tệt → tốt)

| type | Ý nghĩa | Trong banking |
|------|---------|---------------|
| `ALL` | **Full Table Scan** — đọc TẤT CẢ rows | ❌ NGUY HIỂM với bảng giao dịch hàng triệu rows |
| `index` | Full Index Scan — scan toàn bộ index | ❌ Tệ, cần xem xét lại |
| `range` | Index Range Scan — scan khoảng | ⚠️ OK với range nhỏ, xem thêm `rows` |
| `ref` | Index Lookup — dùng index để tìm | ✅ Tốt |
| `eq_ref` | Index Lookup — mỗi row chỉ 1 match | ✅ Rất tốt (JOIN với unique) |
| `const` | Query bằng Primary Key = const | ✅ Tốt nhất |
| `system` | Bảng chỉ có 1 row | ✅ Tốt nhất |

#### Cột `key` — Index thực sự được dùng

```sql
-- key = NULL → Không dùng index nào → cần thêm index!
-- key = idx_account_id → đang dùng index này
-- key = PRIMARY → đang dùng primary key index
```

#### Cột `rows` — Số rows MySQL ước tính sẽ đọc

```sql
-- rows = 10,000,000 với type = ALL → Full Table Scan 10M rows → QUÁ CHẬM
-- rows = 25 với type = ref → Chỉ đọc 25 rows → NHANH

-- Quy tắc: rows × filtered / 100 = số rows kết quả ước tính
-- Ví dụ: rows=1000, filtered=10.00 → khoảng 100 rows kết quả
```

#### Cột `Extra` — Thông tin bổ sung

| Extra | Ý nghĩa |
|-------|---------|
| `Using index` | Covering Index ✅ (không đọc table) |
| `Using where` | Filter thêm ở server sau khi đọc từ index |
| `Using filesort` | ❌ Sort không dùng index → tốn memory/disk |
| `Using temporary` | ❌ Tạo bảng tạm → rất chậm với data lớn |
| `Using index condition` | ICP (Index Condition Pushdown) ✅ |

### 5.3 Ví dụ đọc EXPLAIN thực tế — Banking

```sql
-- Query tìm giao dịch pending
EXPLAIN SELECT id, amount, created_at 
FROM transactions 
WHERE status = 'PENDING' 
  AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
ORDER BY created_at ASC
LIMIT 100;

-- Kết quả không có index:
-- type: ALL, key: NULL, rows: 50000000, Extra: Using where; Using filesort
-- → ĐỌC 50 TRIỆU ROWS + SORT = HẾT HỒN

-- Thêm index:
CREATE INDEX idx_status_created ON transactions(status, created_at);

-- Kết quả sau khi có index:
-- type: range, key: idx_status_created, rows: 523, Extra: Using index condition
-- → Chỉ đọc 523 rows → NHANH ✅
```

### 5.4 EXPLAIN ANALYZE — Chi tiết hơn (MySQL 8.0+)

```sql
EXPLAIN ANALYZE 
SELECT account_id, SUM(amount) as total
FROM transactions
WHERE created_at >= '2025-01-01' AND type = 'DEBIT'
GROUP BY account_id;

-- Output bao gồm actual timing:
-- -> Table scan on transactions (cost=X rows=Y) (actual time=Z..W rows=R loops=1)
-- → Biết chính xác số rows thực tế, không phải ước tính
-- → Hữu ích khi ước tính EXPLAIN không chính xác (statistics cũ)
```

---

## 6. Chiến lược Index cho Banking Workload

### 6.1 Bảng giao dịch — Transaction Table

```sql
CREATE TABLE transactions (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id    BIGINT NOT NULL,
  counterpart_id BIGINT,                    -- Tài khoản đối ứng
  amount        DECIMAL(15, 2) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'VND',
  type          ENUM('DEBIT', 'CREDIT', 'TRANSFER') NOT NULL,
  status        ENUM('PENDING', 'SUCCESS', 'FAILED', 'REVERSED') NOT NULL,
  reference     VARCHAR(100) UNIQUE,         -- Mã tham chiếu duy nhất
  description   VARCHAR(500),
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME,
  
  -- Index 1: Lịch sử giao dịch theo account + thời gian
  INDEX idx_account_time (account_id, created_at),
  
  -- Index 2: Xử lý pending payments
  INDEX idx_status_time (status, created_at),
  
  -- Index 3: Đối soát (reconciliation) theo type + ngày
  INDEX idx_type_date (type, created_at),
  
  -- Index 4: Tra cứu theo mã tham chiếu (reference)
  UNIQUE INDEX idx_reference (reference)
);
```

### 6.2 Trade-off: Index nhiều vs Index ít

```
Thêm index → READ nhanh hơn, nhưng WRITE chậm hơn:

Mỗi INSERT/UPDATE/DELETE:
  → MySQL phải update TẤT CẢ indexes của bảng
  → 4 indexes → 4 lần cập nhật index structure

Banking có 1M giao dịch/ngày:
  → Nếu có 10 indexes → 10M index operations/ngày
  → Tăng write latency đáng kể

Quy tắc:
  ✅ Thêm index khi query THỰC SỰ chậm (EXPLAIN cho thấy Full Scan)
  ✅ Ưu tiên index cho queries thường xuyên, data lớn
  ❌ Đừng thêm index "phòng ngừa" cho mọi cột
  ❌ Đừng giữ index không còn được dùng
```

### 6.3 Kiểm tra index nào không được dùng

```sql
-- MySQL 8.0+: Tìm unused indexes
SELECT object_schema, object_name, index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL
  AND count_star = 0
  AND object_schema = 'banking_db'
ORDER BY object_name;

-- Xóa index không dùng để giảm write overhead
DROP INDEX idx_unused ON transactions;
```

### 6.4 Index cho Reporting / Reconciliation

```sql
-- Đối soát cuối ngày: Tổng số tiền theo loại giao dịch
SELECT type, SUM(amount), COUNT(*) 
FROM transactions 
WHERE DATE(created_at) = '2025-01-15'
  AND status = 'SUCCESS'
GROUP BY type;

-- Index tối ưu (covering):
CREATE INDEX idx_reconcile 
ON transactions(status, created_at, type, amount);
-- → Covering index: không cần đọc table
-- → type và amount nằm trong index → EXPLAIN Extra: Using index
```

---

## 7. Câu hỏi phỏng vấn thường gặp

**Q1: "B-Tree Index là gì? Tại sao MySQL dùng B-Tree thay vì Hash Index?"**
> A: B-Tree Index là cấu trúc cây cân bằng cho phép tìm kiếm O(log n). MySQL dùng B-Tree vì nó hỗ trợ cả **equality** (`=`) lẫn **range** (`<`, `>`, `BETWEEN`, `LIKE 'abc%'`). Hash Index chỉ hỗ trợ equality (`=`, `IN`), không dùng được cho range queries — trong banking, range query rất phổ biến (lấy giao dịch theo khoảng thời gian).

**Q2: "Composite Index `(A, B, C)` có thể dùng cho query `WHERE B = 1` không?"**
> A: Không. Đây là Leftmost Prefix Rule — phải có cột đầu tiên (A). Query `WHERE B = 1` không dùng được index `(A, B, C)`. Nếu cần query thường xuyên theo B, phải tạo thêm index riêng `(B)` hoặc `(B, C)`.

**Q3: "EXPLAIN cho thấy `type = ALL`. Bạn xử lý thế nào?"**
> A: `type = ALL` là Full Table Scan — nguy hiểm với bảng lớn. Tôi sẽ: (1) xem cột `key = NULL` → chưa có index phù hợp, (2) phân tích WHERE clause để tạo index đúng, (3) nếu đã có index mà vẫn ALL → kiểm tra xem MySQL có bỏ qua index vì data skew hay function trên cột không (ví dụ `WHERE YEAR(created_at) = 2025` vô hiệu hóa index), (4) dùng `FORCE INDEX` để verify.

**Q4: "Khi nào KHÔNG nên dùng index?"**
> A: (1) Bảng nhỏ (< vài nghìn rows) — Full Scan còn nhanh hơn index lookup. (2) Cột có ít distinct values (ví dụ `gender: M/F`) — MySQL không dùng index vì selectivity thấp. (3) Ghi nhiều hơn đọc — index làm chậm INSERT/UPDATE. (4) Queries chỉ chạy một lần (ad-hoc report).
