# Cheat Sheet Phỏng Vấn: PostgreSQL vs MySQL

> Ôn trong 15 phút trước phỏng vấn. Mỗi câu trả lời 2-4 câu — đủ ngắn để nhớ, đủ sâu để gây ấn tượng.

---

## PHẦN 1: CÂU HỎI HAY GẶP NHẤT (Level 1)

---

### Q1: "PostgreSQL và MySQL khác nhau cơ bản nhất ở đâu?"

**Trả lời:**

> 3 khác biệt cốt lõi:
> 1. **Kiến trúc:** PG = multi-process (1 connection = 1 process, nặng ~5-10MB), MySQL = multi-thread (1 connection = 1 thread, nhẹ ~1-2MB)
> 2. **MVCC:** PG lưu old versions trong cùng table (cần VACUUM dọn), MySQL lưu trong undo log riêng (purge thread tự dọn)
> 3. **Triết lý:** PG = feature-rich, standards-compliant. MySQL = simple, fast, easy to use

**Bonus nếu hỏi thêm:** PG gần như bắt buộc dùng connection pooler (PgBouncer) vì mỗi process nặng. MySQL chịu được nhiều connections hơn native.

---

### Q2: "MVCC là gì? Giải thích đơn giản."

**Trả lời:**

> MVCC (Multi-Version Concurrency Control) cho phép nhiều transactions đọc/ghi đồng thời mà không block nhau, bằng cách giữ **nhiều versions** của cùng 1 row. Người đọc thấy version phù hợp với thời điểm họ bắt đầu, người ghi tạo version mới — không ai phải đợi ai.

**Khác biệt PG vs MySQL:**

| | PostgreSQL | MySQL InnoDB |
|--|-----------|--------------|
| Old versions ở đâu? | Trong cùng table (heap) | Trong undo log riêng |
| Dọn dẹp | VACUUM (cần tune) | Purge thread (tự động) |
| Rủi ro | Table bloat nếu VACUUM chậm | Undo log phình nếu long TX |

---

### Q3: "UPDATE hoạt động thế nào internally?"

**Trả lời:**

> **PostgreSQL:** Tạo tuple MỚI + đánh dấu tuple cũ là "dead" (set xmax). Tất cả indexes phải update trỏ đến tuple mới (trừ HOT update). Write amplification cao hơn.
>
> **MySQL:** Update IN-PLACE trong clustered index + ghi version cũ vào undo log. Chỉ indexes có column thay đổi mới cần update. Write amplification thấp hơn.

---

### Q4: "VACUUM là gì? Tại sao MySQL không cần?"

**Trả lời:**

> VACUUM dọn dead tuples (rows cũ đã bị update/delete) trong PostgreSQL. Vì PG lưu old versions trong cùng table, chúng chiếm space cho đến khi VACUUM giải phóng.
>
> MySQL không cần vì old versions nằm trong undo log riêng — purge thread tự động dọn khi không còn transaction nào cần đọc version cũ.
>
> **Rủi ro nếu VACUUM chậm:** Table bloat — table chiếm nhiều disk hơn cần thiết, query chậm vì scan qua nhiều dead tuples.

---

### Q5: "Long-running transaction nguy hiểm thế nào?"

**Trả lời:**

> **PostgreSQL:** Long TX giữ snapshot cũ → VACUUM không dọn được dead tuples tạo sau thời điểm đó → table bloat tích tụ → performance degradation.
>
> **MySQL:** Long TX → undo log không được purge → undo tablespace phình to → read performance giảm (phải traverse dài hơn để dựng old versions).
>
> **Giải pháp:** Set `idle_in_transaction_session_timeout`, monitor `n_dead_tup` (PG) hoặc History list length (MySQL).

---

### Q6: "Clustered Index là gì? PG có không?"

**Trả lời:**

> Clustered Index = data được **sắp xếp vật lý** theo Primary Key. Trong MySQL InnoDB, PK chính là cách data được tổ chức trên disk (leaf nodes của B+Tree chứa row data).
>
> PostgreSQL **không có** clustered index — data lưu kiểu heap (không theo thứ tự). Index trỏ đến vị trí vật lý (page, offset).
>
> **Hệ quả:** MySQL lookup by PK cực nhanh (data nằm ngay trong index). Nhưng secondary index cần "double lookup" (secondary → PK → data).

---

## PHẦN 2: CÂU HỎI SENIOR/FINTECH (Level 2)

---

### Q7: "Isolation levels khác nhau thế nào giữa PG và MySQL?"

**Trả lời:**

| | PostgreSQL | MySQL InnoDB |
|--|-----------|--------------|
| **Default** | READ COMMITTED | REPEATABLE READ |
| **RR mechanism** | MVCC snapshot thuần (không lock) | MVCC + Gap Lock |
| **Phantom read ở RR** | Có thể xảy ra | Không (Gap Lock ngăn) |
| **Write conflict ở RR** | Detect + ERROR (first-updater-wins) | Không detect (last-writer-wins) |
| **SERIALIZABLE** | SSI — optimistic, non-blocking reads | Pessimistic — mọi SELECT thêm shared lock |

**Câu kết:** PG SERIALIZABLE phù hợp OLTP hơn vì throughput cao (không lock khi đọc). MySQL SERIALIZABLE chậm vì shared locks everywhere.

---

### Q8: "Gap Lock là gì? Tại sao gây deadlock?"

**Trả lời:**

> Gap Lock (MySQL only) khóa **khoảng trống giữa 2 index records** để ngăn INSERT mới vào range đó — mục đích ngăn phantom reads.
>
> **Gây deadlock vì:** Gap Locks không conflict với nhau (2 TX cùng lock 1 gap được). Nhưng khi cả 2 muốn INSERT vào gap đó → Insert Intention Lock conflict với Gap Lock của TX kia → deadlock.

```
TX1: SELECT WHERE user_id=7 FOR UPDATE → lock gap (5,10)
TX2: SELECT WHERE user_id=8 FOR UPDATE → lock gap (5,10) ← OK, gap locks compatible
TX1: INSERT user_id=7 → chờ TX2's gap lock
TX2: INSERT user_id=8 → chờ TX1's gap lock → DEADLOCK!
```

> **PostgreSQL không có vấn đề này** vì dùng MVCC snapshot thay vì physical locks để ngăn phantom.

---

### Q9: "Lost Update là gì? Database nào ngăn được?"

**Trả lời:**

> Lost Update: 2 TX đọc cùng row, cả 2 tính toán dựa trên giá trị cũ, TX commit sau ghi đè kết quả TX commit trước.

```
Balance = 1000
TX1 đọc 1000, tính 1000-100=900, ghi 900
TX2 đọc 1000, tính 1000-50=950, ghi 950 ← MẤT update TX1, đáng lẽ = 850
```

> **PostgreSQL RR:** Phát hiện conflict → ERROR "could not serialize access" → app retry.
> **MySQL RR:** KHÔNG phát hiện → cần dùng `SELECT FOR UPDATE` để lock row trước khi đọc.
>
> **Trong banking:** Đây là lý do PG an toàn hơn — database tự bảo vệ, không phụ thuộc developer nhớ thêm FOR UPDATE.

---

### Q10: "READ COMMITTED vs REPEATABLE READ — chọn cái nào?"

**Trả lời:**

| Scenario | Chọn | Lý do |
|----------|------|-------|
| **CRUD web app thông thường** | READ COMMITTED (PG default) | Đơn giản, ít conflict, không cần retry logic |
| **Banking/financial transactions** | REPEATABLE READ hoặc SERIALIZABLE | Cần consistency, ngăn lost update |
| **Report/analytics** | REPEATABLE READ | Đọc data consistent trong suốt report |
| **High-throughput OLTP** | READ COMMITTED + SELECT FOR UPDATE khi cần | Ít lock contention |

---

### Q11: "Partial Index là gì? Khi nào dùng?"

**Trả lời:**

> PostgreSQL only — index chỉ rows thỏa điều kiện WHERE. Ví dụ: nếu 95% orders đã completed, chỉ 5% pending → index chỉ pending orders nhỏ hơn 20x.

```sql
CREATE INDEX idx_pending ON orders(created_at) WHERE status = 'PENDING';
```

> **Khi nào dùng:** Khi query thường xuyên filter theo 1 giá trị chiếm tỷ lệ nhỏ trong table. Tiết kiệm disk, RAM, và write overhead.
>
> **MySQL không có** — phải dùng composite index toàn bộ rows.

---

### Q12: "Row-Level Security (RLS) quan trọng thế nào?"

**Trả lời:**

> PostgreSQL RLS enforce data isolation **ở database level** — dù developer quên WHERE clause, data vẫn được filter tự động theo policy.

```sql
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::INT);
```

> **Quan trọng cho multi-tenant SaaS/Fintech:** Nếu chỉ rely on app code → 1 bug = data leak giữa tenants. RLS = safety net ở tầng cuối cùng.
>
> **MySQL KHÔNG CÓ RLS** — phải enforce hoàn toàn bằng application code.

---

### Q13: "Connection Pooling — tại sao PG cần hơn MySQL?"

**Trả lời:**

> PostgreSQL: mỗi connection = 1 OS process (~5-10MB RAM). 500 connections = 2.5-5GB RAM chỉ cho connections. Thực tế chỉ nên 200-500 connections → **bắt buộc** dùng PgBouncer/Pgpool-II.
>
> MySQL: mỗi connection = 1 thread (~1-2MB). Chịu được 1000-5000 connections native. Vẫn nên dùng ProxySQL nhưng không bắt buộc.

---

### Q14: "Trong Banking/Fintech, chọn database nào? Tại sao?"

**Trả lời:**

> **PostgreSQL**, vì:
> 1. **RLS** → data isolation ở DB level (multi-tenant banking)
> 2. **SSI** → serializable với throughput cao (không lock reads)
> 3. **Write conflict detection** → ngăn lost update tự động
> 4. **Advisory Locks** → distributed locking patterns
> 5. **Partial indexes** → optimize hot paths (pending transactions)
> 6. **JSONB** → flexible audit logs, event sourcing
>
> MySQL phù hợp khi: read-heavy, simple CRUD, cần horizontal scale (Vitess), hoặc team đã quen MySQL.

---

## PHẦN 3: CÂU HỎI NHANH (trả lời 1 câu)

| Câu hỏi | Trả lời |
|----------|---------|
| PG default isolation? | READ COMMITTED |
| MySQL default isolation? | REPEATABLE READ |
| PG page size? | 8KB |
| MySQL page size? | 16KB |
| PG cần gì để scale connections? | PgBouncer |
| MySQL equivalent? | ProxySQL |
| PG sharding? | Citus extension |
| MySQL sharding? | Vitess / PlanetScale |
| PG replication mechanism? | WAL streaming |
| MySQL replication mechanism? | Binlog |
| PG có Gap Lock? | KHÔNG |
| MySQL có RLS? | KHÔNG |
| PG có Clustered Index? | KHÔNG (heap-based) |
| MySQL secondary index cần gì? | Double lookup (secondary → PK → data) |
| PG SERIALIZABLE dùng gì? | SSI (optimistic) |
| MySQL SERIALIZABLE dùng gì? | Implicit shared locks (pessimistic) |

---

## PHẦN 4: TEMPLATE TRẢ LỜI "SO SÁNH PG vs MySQL"

Nếu interviewer hỏi chung chung "so sánh PostgreSQL và MySQL", dùng framework này:

```
1. Kiến trúc: process vs thread → ảnh hưởng memory, connection scaling
2. Storage: heap vs clustered index → ảnh hưởng read/write patterns
3. MVCC: in-heap vs undo log → ảnh hưởng maintenance (VACUUM vs purge)
4. Concurrency: snapshot-only vs gap locks → ảnh hưởng deadlock frequency
5. Use case: PG cho complex/fintech, MySQL cho simple/read-heavy/scale
```

Trả lời theo 5 điểm này, mỗi điểm 1-2 câu = câu trả lời hoàn hảo ~2 phút.

---

## PHẦN 5: SAI LẦM HAY GẶP KHI TRẢ LỜI

| Sai | Đúng |
|-----|------|
| "PG tốt hơn MySQL" | Tùy use case — PG cho complex, MySQL cho simple + scale |
| "MVCC = không cần lock" | MVCC giảm lock nhưng write vẫn cần lock (row-level) |
| "VACUUM = downtime" | autovacuum chạy background, không gây downtime (trừ VACUUM FULL) |
| "MySQL không có MVCC" | MySQL InnoDB CÓ MVCC (undo log-based), chỉ khác cách implement |
| "Gap Lock = xấu" | Gap Lock ngăn phantom reads — trade-off, không phải bug |
| "SERIALIZABLE = chậm" | PG SERIALIZABLE (SSI) khá nhanh — chỉ MySQL SERIALIZABLE mới chậm |

---

*File này extract từ `ZZ_90_2_SO_SANH_POSTGRESQL_VS_MYSQL_CHUYEN_SAU.md`. Đọc file gốc + file giải thích thuật ngữ để hiểu sâu hơn.*
