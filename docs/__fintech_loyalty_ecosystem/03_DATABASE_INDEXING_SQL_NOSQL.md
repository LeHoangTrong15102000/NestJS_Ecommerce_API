# Database: Indexing, SQL vs NoSQL

## Khi nào SQL, khi nào NoSQL?

| Tiêu chí | SQL (PostgreSQL/MySQL) | NoSQL (MongoDB/DynamoDB) |
|-----------|----------------------|--------------------------|
| **Dùng khi** | Giao dịch tiền/điểm (cần ACID), quan hệ phức tạp | Log, analytics, catalog linh hoạt, high write |
| **ACID** | Full support | Eventual consistency (trừ MongoDB 4.0+ có transaction) |
| **Schema** | Strict, migration required | Flexible, schema-less |
| **Scale** | Vertical (+ read replica) | Horizontal (sharding built-in) |
| **Join** | Native, hiệu quả | Không có / phải aggregate |

### Trong Loyalty/Fintech:
- **SQL:** User balance, transaction history, point ledger (cần ACID, audit trail)
- **NoSQL:** Activity log, product catalog, notification history (high write, flexible schema)

## Database Indexing

### B-Tree Index (mặc định PostgreSQL/MySQL)
- Sorted tree structure → tìm kiếm O(log n)
- Hỗ trợ: `=`, `<`, `>`, `BETWEEN`, `LIKE 'abc%'` (prefix only)
- KHÔNG hỗ trợ: `LIKE '%abc'` (suffix search)

### Các loại Index

| Loại | Khi nào dùng |
|------|-------------|
| **Single column** | Query filter trên 1 column |
| **Composite** | Query filter trên nhiều columns (tuân thủ Leftmost Prefix) |
| **Covering** | Index chứa tất cả columns cần → không cần đọc table |
| **Partial** | Index chỉ 1 subset rows `WHERE status = 'active'` |
| **GIN** | Full-text search, JSONB, array |
| **GiST** | Geospatial, range types |

### Leftmost Prefix Rule (Composite Index)
```sql
CREATE INDEX idx_user_date ON transactions(user_id, created_at, type);

-- SỬ DỤNG được index:
WHERE user_id = 1                          -- ✓ (leftmost)
WHERE user_id = 1 AND created_at > '2024'  -- ✓
WHERE user_id = 1 AND created_at > '2024' AND type = 'earn' -- ✓

-- KHÔNG sử dụng được:
WHERE created_at > '2024'                  -- ✗ (skip user_id)
WHERE type = 'earn'                        -- ✗ (skip user_id, created_at)
WHERE user_id = 1 AND type = 'earn'        -- Partial ✓ (chỉ dùng user_id)
```

### EXPLAIN để phân tích query
```sql
EXPLAIN ANALYZE SELECT * FROM transactions WHERE user_id = 1 AND created_at > '2024-01-01';

-- Kết quả quan trọng:
-- Seq Scan → BAD (full table scan, cần thêm index)
-- Index Scan → GOOD (dùng index)
-- Index Only Scan → BEST (covering index, không cần đọc table)
-- Bitmap Index Scan → OK (nhiều rows match)
```

### Index Strategy cho Loyalty System
```sql
-- Points transaction: query theo user + thời gian
CREATE INDEX idx_points_user_date ON point_transactions(user_id, created_at DESC);

-- Leaderboard: query top N theo points
CREATE INDEX idx_user_points ON users(total_points DESC);

-- Voucher redemption: check duplicate
CREATE UNIQUE INDEX idx_voucher_user ON voucher_redemptions(voucher_id, user_id);

-- Partial index: chỉ active users (tiết kiệm space)
CREATE INDEX idx_active_users ON users(tier) WHERE status = 'active';
```

## Tối ưu Query lớn

### 1. Pagination
```sql
-- OFFSET-based (chậm khi offset lớn):
SELECT * FROM transactions ORDER BY id LIMIT 20 OFFSET 10000; -- scan 10020 rows

-- Cursor-based (nhanh, consistent):
SELECT * FROM transactions WHERE id > :last_id ORDER BY id LIMIT 20; -- scan 20 rows
```

### 2. Covering Index (tránh table lookup)
```sql
-- Query chỉ cần user_id và points:
CREATE INDEX idx_covering ON point_transactions(user_id, points, created_at);
-- → Index Only Scan, không cần đọc table
```

### 3. Connection Pooling
```
App → PgBouncer (pool 20 connections) → PostgreSQL (max_connections = 100)
```
Tránh mỗi request mở 1 connection mới.

## ACID trong Fintech

| Property | Ý nghĩa | VD trong Loyalty |
|----------|---------|-----------------|
| **Atomicity** | All or nothing | Trừ điểm + tạo order phải cùng thành công hoặc cùng fail |
| **Consistency** | Data luôn valid | Points không bao giờ âm |
| **Isolation** | Transaction không ảnh hưởng nhau | 2 user redeem cùng voucher → chỉ 1 thành công |
| **Durability** | Committed = persisted | Sau khi cộng điểm, restart DB vẫn còn |

### Isolation Levels
```
READ UNCOMMITTED → dirty read (KHÔNG BAO GIỜ dùng cho tiền/điểm)
READ COMMITTED   → default PostgreSQL, no dirty read
REPEATABLE READ  → no phantom read, dùng cho balance check
SERIALIZABLE     → strictest, dùng cho critical financial ops
```

## Câu hỏi phỏng vấn

1. **Khi nào dùng SQL vs NoSQL cho Loyalty?** → Giao dịch điểm/tiền: SQL (ACID). Activity log, catalog: NoSQL (flexible, high write)
2. **Index có nhược điểm gì?** → Tốn disk space, slow down INSERT/UPDATE (phải update index), cần maintain
3. **Composite index (a, b, c) - query WHERE b = 1 có dùng index không?** → Không, vi phạm leftmost prefix rule
4. **Làm sao biết query chậm?** → EXPLAIN ANALYZE, check Seq Scan, check rows scanned vs returned
