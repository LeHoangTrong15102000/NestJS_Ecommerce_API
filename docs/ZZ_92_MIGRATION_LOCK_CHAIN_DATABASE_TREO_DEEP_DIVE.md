# 🧊 MIGRATION LOCK CHAIN — Một Migration Nhỏ Có Thể Làm Database Bị Treo Như Thế Nào?

> **Phân tích chuyên sâu bài viết của Bùi Tài Tuấn (devops.vn, 01/06/2026)**, kết hợp bổ sung kiến thức lock mode/lock queue mà bài viết bỏ qua, và liên hệ trực tiếp với codebase **NestJS Ecommerce API (Prisma + PostgreSQL)**.
>
> 📎 Nguồn: https://devops.vn/posts/mot-migration-nho-co-the-lam-database-bi-treo-nhu-the-nao/
> 🔗 Tài liệu liên quan trong project: [`ZZ_79_ROW_LOCKING_COMPLETE_GUIDE.md`](./ZZ_79_ROW_LOCKING_COMPLETE_GUIDE.md), [`ZZ_91_POSTGRESQL_INDEXING_DEEP_DIVE.md`](./ZZ_91_POSTGRESQL_INDEXING_DEEP_DIVE.md), [`ZZ_37_MIGRATION_SYNC_GUIDE.md`](./ZZ_37_MIGRATION_SYNC_GUIDE.md), [`MIGRATIONS.md`](../MIGRATIONS.md)

---

## 📋 MỤC LỤC

1. [Luận Điểm Cốt Lõi Của Bài Viết](#1-luận-điểm-cốt-lõi-của-bài-viết)
2. [Lock Chain Là Gì? — Cơ Chế Chờ Dây Chuyền](#2-lock-chain-là-gì--cơ-chế-chờ-dây-chuyền)
3. [Vì Sao CPU Thấp Mà Hệ Thống Vẫn Sập?](#3-vì-sao-cpu-thấp-mà-hệ-thống-vẫn-sập)
4. [Bộ Công Cụ Chẩn Đoán Lock Trong PostgreSQL](#4-bộ-công-cụ-chẩn-đoán-lock-trong-postgresql)
5. [Phân Loại Migration Nguy Hiểm](#5-phân-loại-migration-nguy-hiểm)
6. [Giải Pháp An Toàn — 4 Nguyên Tắc](#6-giải-pháp-an-toàn--4-nguyên-tắc)
7. [Xử Lý Sự Cố — Đừng Restart App Đầu Tiên](#7-xử-lý-sự-cố--đừng-restart-app-đầu-tiên)
8. [Bổ Sung: Lock Modes & Lock Queue FIFO (Bài Viết Bỏ Qua)](#8-bổ-sung-lock-modes--lock-queue-fifo)
9. [Liên Hệ Trực Tiếp Với Project NestJS Ecommerce](#9-liên-hệ-trực-tiếp-với-project-nestjs-ecommerce)
10. [Checklist Review Migration Cho Project](#10-checklist-review-migration-cho-project)
11. [Đánh Giá Tổng Thể Bài Viết](#11-đánh-giá-tổng-thể-bài-viết)
12. [Câu Hỏi Phỏng Vấn Thường Gặp](#12-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. LUẬN ĐIỂM CỐT LÕI CỦA BÀI VIẾT

Bài viết phá vỡ một niềm tin sai phổ biến của nhiều developer:

> ❌ **"Migration nhỏ → rủi ro nhỏ"**

Thông điệp trung tâm:

> ✅ **Database không chỉ chết khi quá tải. Nó còn chết khi một migration nhỏ bắt cả hệ thống phải đứng chờ lock.**

Điều nguy hiểm nhất: lúc sự cố xảy ra, **database trông như đang "rảnh"** — CPU thấp, disk thấp, network bình thường — khiến đội kỹ thuật điều tra **sai hướng**, đi soi ingress / autoscale / app / network, trong khi thủ phạm thật sự vẫn nằm trong database.

### 1.1 Sai lầm phổ biến: "Staging chạy nhanh nên production cũng ổn"

Bài viết chỉ ra lý do staging đánh lừa:

- Staging **không có traffic thật**.
- Không có hàng nghìn request đọc/ghi cùng lúc.
- Không có report job đang mở transaction lâu.
- Không có connection pool từ nhiều service cùng đổ vào.
- Không có bảng 100 triệu dòng với traffic liên tục cả ngày.

> 💡 Trong production, migration **không** chỉ được đánh giá bằng "chạy nhanh hay chậm". Câu hỏi quan trọng hơn là: **Câu SQL này cần loại lock nào, và nó ảnh hưởng gì đến bảng đang có traffic thật?**

---

## 2. LOCK CHAIN LÀ GÌ? — CƠ CHẾ CHỜ DÂY CHUYỀN

**Lock chain** là tình huống một truy vấn đang chờ một lock, nhưng chính truy vấn đang chờ đó lại vô tình làm các truy vấn khác phía sau phải chờ tiếp. Nói đơn giản: **một chuỗi chờ dây chuyền trong database.**

### 2.1 Sơ đồ cơ chế

```
Transaction cũ (report job)  ──giữ lock trên bảng orders──┐
                                                          │ block
        Migration: ALTER TABLE orders ADD COLUMN ─────────┤ (đang CHỜ lock)
                                                          │ block
        SELECT / UPDATE / INSERT mới đổ vào orders ───────┘ (kẹt phía sau migration)
```

### 2.2 Chuỗi nhân quả 6 bước

Kịch bản thực tế bài viết mô tả:

1. Một transaction cũ đang giữ lock liên quan đến bảng `orders`.
2. Migration muốn lấy lock nhưng **chưa lấy được** → xếp hàng chờ.
3. Request mới vẫn tiếp tục đi vào bảng `orders`.
4. Các request mới **bị kẹt phía sau migration** (vì migration đang ở đầu hàng đợi lock).
5. Connection pool của app bắt đầu đầy.
6. API timeout hàng loạt.

> Một session chờ một session khác → các query mới lại chờ sau session migration → cuối cùng cả bảng traffic cao bị "đóng băng".

### 2.3 Điểm tinh tế nhất

Migration **không cần giữ lock lâu**. Nó chỉ cần **đứng chờ ở sai vị trí trong hàng đợi lock**.

Một khi migration vào hàng đợi xin lock mạnh, **mọi query đến sau** — kể cả `SELECT` đơn giản — đều phải xếp hàng sau nó. Một thao tác lẽ ra chỉ mili-giây biến thành sự cố kéo dài nhiều phút. (Cơ chế hàng đợi FIFO này được giải thích kỹ ở [Phần 8](#8-bổ-sung-lock-modes--lock-queue-fifo).)

---

## 3. VÌ SAO CPU THẤP MÀ HỆ THỐNG VẪN SẬP?

Đây là phần giá trị nhất của bài viết. Bảng đối chiếu hai loại sự cố:

| Triệu chứng | Quá tải thật | **Lock chain** |
| ----------- | ------------ | -------------- |
| CPU         | Cao          | **Thấp**       |
| Disk I/O    | Cao          | Không cao      |
| Query       | Chạy lâu     | Treo           |
| Connection  | —            | **Tăng vọt**   |
| App         | Chậm         | **Timeout**    |
| Throughput  | Giảm         | Gần như đứng   |

**Lý do cốt lõi:** query _chờ lock_ thì **chưa thực sự chạy** → chưa bước vào phần xử lý chính của truy vấn → **không tốn CPU**.

> ⚠️ **CPU thấp KHÔNG đủ để loại database khỏi danh sách nghi vấn.**

Và một insight quan trọng về **slow query log**:

> Query không chậm vì _chạy lâu_. Nó chậm vì **chưa được chạy**. → Nhìn slow query log dễ bỏ sót hoàn toàn nguyên nhân, vì không có query nào "nặng" cả.

### Ví dụ minh hoạ của tác giả

Bảng `orders` ~100 triệu dòng, traffic cao. Migration `ALTER TABLE orders ADD COLUMN note text;` chạy trên staging rất nhanh. Nhưng trên production, đúng lúc đó có một **report job đang mở transaction** đọc dữ liệu từ `orders`. Sau vài phút:

- API `/orders` timeout
- Connection pool full
- P99 latency tăng mạnh
- **CPU database chỉ 15%**
- Slow query log không chỉ ra query nào quá nặng

---

## 4. BỘ CÔNG CỤ CHẨN ĐOÁN LOCK TRONG POSTGRESQL

Quy trình chẩn đoán theo đúng thứ tự bài viết khuyến nghị.

### Bước 1 — Xem ai đang chờ lock

```sql
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS query_age,
  left(query, 120) AS query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start;
```

Dấu hiệu lock chain — nhiều dòng `wait_event_type = Lock`:

```
pid   state   wait_event_type  wait_event  query_age   query
8121  active  Lock             relation    00:04:12    ALTER TABLE orders ADD COLUMN note text
8129  active  Lock             relation    00:03:58    SELECT * FROM orders WHERE user_id = $1
8130  active  Lock             relation    00:03:57    UPDATE orders SET status = $1 WHERE id = $2
```

### Bước 2 — Xem ai block ai (mấu chốt)

```sql
SELECT
  pid,
  pg_blocking_pids(pid) AS blocking_pids,
  wait_event_type,
  wait_event,
  left(query, 120) AS query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

Output mẫu:

```
pid   blocking_pids  wait_event_type  query
8121  {7710}         Lock             ALTER TABLE orders ADD COLUMN note text
8129  {8121}         Lock             SELECT * FROM orders WHERE user_id = $1
8130  {8121}         Lock             UPDATE orders SET status = $1 WHERE id = $2
```

**Cách đọc:**

- `PID 7710` (report job) đang block migration.
- Migration `8121` lại block các query ứng dụng phía sau (`8129`, `8130`).
- Request của user bị treo dây chuyền → **lock chain điển hình.**

> `pg_blocking_pids()` là hàm "thần thánh" để dựng cây phụ thuộc khoá chỉ trong một câu lệnh.

---

## 5. PHÂN LOẠI MIGRATION NGUY HIỂM

Không phải migration nào cũng nguy hiểm như nhau. Với bảng traffic cao, 4 nhóm sau cần review rất kỹ.

| #   | Loại                                           | Mức rủi ro        | Ghi chú quan trọng                                                                                                     |
| --- | ---------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `ALTER TABLE` (ADD / ALTER TYPE / DROP COLUMN) | 🔴 Cao            | Lock có thể _ngắn_, nhưng không lấy được ngay → nghẽn dây chuyền                                                       |
| 2   | `ADD COLUMN ... DEFAULT 'web'`                 | 🟡 Trung bình     | PG mới tối ưu constant default (không rewrite toàn bảng), **nhưng vẫn cần lock metadata** — đừng hiểu là "không lock"  |
| 3   | `CREATE INDEX` thường                          | 🔴 Cao (bảng lớn) | Nên dùng `CONCURRENTLY` — nhưng không phải thuốc tiên: chạy lâu hơn, nhiều phase, có thể fail để lại **invalid index** |
| 4   | Backfill `UPDATE` trong 1 transaction lớn      | 🔴 Cao            | Làm tăng lock wait, WAL, replication, autovacuum                                                                       |

### 5.1 Ví dụ các câu nguy hiểm

```sql
-- Nhóm 1: ALTER TABLE
ALTER TABLE orders ADD COLUMN source text;
ALTER TABLE orders ALTER COLUMN status TYPE varchar(50);
ALTER TABLE orders DROP COLUMN old_field;

-- Nhóm 2: ADD COLUMN DEFAULT
ALTER TABLE orders ADD COLUMN source text DEFAULT 'web';

-- Nhóm 3: CREATE INDEX
CREATE INDEX idx_orders_created_at ON orders(created_at);            -- ❌ khoá ghi
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at); -- ✅ an toàn hơn
```

### 5.2 Kiểm tra index sau khi chạy CONCURRENTLY

```sql
SELECT
  indexrelid::regclass AS index_name,
  indisvalid,
  indisready
FROM pg_index
WHERE indexrelid::regclass::text = 'idx_orders_created_at';
```

Nếu `indisvalid = false` → index lỗi, cần `DROP INDEX` rồi tạo lại.

---

## 6. GIẢI PHÁP AN TOÀN — 4 NGUYÊN TẮC

### ① `lock_timeout` — "Fail nhanh thay vì treo"

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN source text;
COMMIT;
```

Nếu sau 3 giây không lấy được lock → migration **fail** thay vì đứng chờ kéo cả production die theo.

> 💡 Triết lý: **Một migration fail trong pipeline dễ xử lý hơn rất nhiều so với một migration treo trong production làm cả hệ thống timeout.**

### ② `statement_timeout` — Chặn SQL chạy quá lâu

```sql
SET statement_timeout = '5min';
```

- `lock_timeout` → tránh **chờ lock** quá lâu.
- `statement_timeout` → tránh **câu SQL chạy** quá lâu ngoài dự kiến.

Không nên để migration chạy vô hạn trong production.

### ③ Tách schema change và data backfill (Expand/Contract Pattern)

❌ **KHÔNG nên** gộp tất cả vào một transaction lớn:

```sql
BEGIN;
ALTER TABLE orders ADD COLUMN source text;
UPDATE orders SET source = 'web' WHERE source IS NULL;  -- backfill 100tr dòng trong cùng tx!
COMMIT;
```

✅ **Cách đúng** (4 bước, tách rời):

1. **Add column nullable** (schema change nhẹ).
2. **Deploy app** ghi dữ liệu mới vào column mới.
3. **Backfill dữ liệu cũ theo batch nhỏ:**
   ```sql
   UPDATE orders
   SET source = 'web'
   WHERE id >= 100000
     AND id < 200000
     AND source IS NULL;
   -- lặp lại theo từng dải id
   ```
4. **Sau khi ổn định** mới thêm constraint (NOT NULL / DEFAULT) nếu cần.

> Backfill trong 1 transaction lớn dễ làm tăng lock wait, WAL, replication và autovacuum. Backfill theo batch giữ mỗi transaction ngắn → không giữ lock lâu.

### ④ Đừng chạy migration trong giờ cao điểm

Nghe đơn giản nhưng rất nhiều sự cố đến từ đây. Nếu migration chạm bảng traffic cao:

- Chạy lúc traffic thấp.
- Có người trực.
- Có sẵn query kiểm tra lock.
- Có kế hoạch dừng nhanh nếu thấy bất thường.

> Migration **không nên** là thứ "merge xong pipeline tự chạy lúc nào cũng được" với mọi loại thay đổi.

---

## 7. XỬ LÝ SỰ CỐ — ĐỪNG RESTART APP ĐẦU TIÊN

Phản xạ sai phổ biến khi thấy app timeout là **restart pod / restart service**. Nhưng nếu nguyên nhân là database lock:

> ⚠️ Restart app làm **app reconnect hàng loạt** → tăng áp lực connection lên database → **tệ hơn**.

### Thứ tự xử lý đúng

**Bước 1 — Xác nhận lock:**

```sql
SELECT
  pid, wait_event_type, wait_event,
  now() - query_start AS age,
  left(query, 120) AS query
FROM pg_stat_activity
WHERE wait_event_type IS NOT NULL
ORDER BY age DESC;
```

**Bước 2 — Tìm blocking PID:** (dùng query `pg_blocking_pids` ở [Phần 4](#4-bộ-công-cụ-chẩn-đoán-lock-trong-postgresql)).

**Bước 3 — Cancel (nhẹ, ưu tiên):**

```sql
SELECT pg_cancel_backend(<pid>);   -- huỷ query hiện tại, giữ connection
```

**Bước 4 — Terminate (mạnh, chỉ khi cần):**

```sql
SELECT pg_terminate_backend(<pid>); -- kill cả connection
```

> 🚫 **Tuyệt đối không kill bừa.** Trước khi terminate phải biết session đó là gì: migration, report job, autovacuum, hay replication process. Kill nhầm autovacuum/replication có thể gây hậu quả nặng hơn.

---

## 8. BỔ SUNG: LOCK MODES & LOCK QUEUE FIFO

> 📌 Phần này **không có trong bài gốc** — nhưng là gốc rễ giải thích "vì sao đến `SELECT` cũng bị kẹt". Bổ sung để tài liệu hoàn chỉnh.

### 8.1 8 chế độ table-level lock của PostgreSQL

| Lock Mode                | Lệnh tiêu biểu                              | Xung đột với                      |
| ------------------------ | ------------------------------------------- | --------------------------------- |
| `ACCESS SHARE`           | `SELECT`                                    | chỉ `ACCESS EXCLUSIVE`            |
| `ROW SHARE`              | `SELECT ... FOR UPDATE`                     | `EXCLUSIVE`, `ACCESS EXCLUSIVE`   |
| `ROW EXCLUSIVE`          | `INSERT`, `UPDATE`, `DELETE`                | `SHARE` trở lên                   |
| `SHARE UPDATE EXCLUSIVE` | `CREATE INDEX CONCURRENTLY`, `VACUUM`       | chính nó trở lên                  |
| `SHARE`                  | `CREATE INDEX` (thường)                     | chặn ghi                          |
| `SHARE ROW EXCLUSIVE`    | một số constraint                           | hầu hết                           |
| `EXCLUSIVE`              | hiếm                                        | gần như tất cả trừ `ACCESS SHARE` |
| **`ACCESS EXCLUSIVE`**   | **`ALTER TABLE`, `DROP TABLE`, `TRUNCATE`** | **TẤT CẢ — kể cả `SELECT`**       |

**Mấu chốt:** `ALTER TABLE` cần `ACCESS EXCLUSIVE` — chế độ **mạnh nhất**, xung đột với **mọi** lock khác, kể cả `ACCESS SHARE` mà một `SELECT` đơn giản cũng cần. Đây chính là lý do migration làm "kẹt cả SELECT".

### 8.2 Vì sao migration đang CHỜ lại chặn được SELECT? — Lock Queue FIFO

Câu hỏi tinh tế: `SELECT` (ACCESS SHARE) **không** xung đột với `SELECT` đang giữ lock (report job cũng ACCESS SHARE). Vậy tại sao `SELECT` mới vẫn bị kẹt?

Vì PostgreSQL xếp hàng lock theo **FIFO (first-in-first-out)**:

```
Hàng đợi lock trên bảng orders:

[ĐANG GIỮ]  Report job          → ACCESS SHARE  (SELECT)
   ↓
[CHỜ #1]    Migration           → ACCESS EXCLUSIVE  ← xung đột với report job → phải chờ
   ↓
[CHỜ #2]    SELECT mới của user → ACCESS SHARE      ← KHÔNG xung đột report job,
                                                       NHƯNG đứng SAU migration trong hàng đợi
                                                       → BỊ CHẶN THEO
```

> 🔑 PostgreSQL **không cho query nhảy hàng**. Dù `SELECT` mới về lý thuyết tương thích với report job đang giữ lock, nó vẫn phải đợi migration phía trước được xử lý xong. Một `ACCESS EXCLUSIVE` đang chờ ở giữa hàng đợi sẽ "đóng băng" toàn bộ query đến sau.

Đây là lời giải thích sâu nhất cho cơ chế lock chain ở [Phần 2.3](#23-điểm-tinh-tế-nhất).

### 8.3 Đính chính một điểm bài viết gộp hơi thô

- **`DROP COLUMN` thực ra rất nhanh** — PostgreSQL chỉ đánh dấu cột là "đã xoá" trong catalog (`ATTRIBUTE ... attisdropped`), **không** rewrite bảng. Cái chậm/nguy hiểm là _lấy được_ `ACCESS EXCLUSIVE`, chứ không phải bản thân thao tác.
- **`ADD COLUMN` có DEFAULT:** từ **PostgreSQL 11+**, default hằng số được lưu metadata → **không rewrite bảng** (rất nhanh). Trên **PG < 11**, nó rewrite **toàn bộ** bảng dưới `ACCESS EXCLUSIVE` → cực kỳ nguy hiểm với bảng lớn. Bài viết nói đúng tinh thần nhưng không nêu mốc phiên bản này.
- **`ALTER COLUMN ... TYPE`** hầu như luôn rewrite bảng + rebuild index → nguy hiểm nhất nhóm 1.

---

## 9. LIÊN HỆ TRỰC TIẾP VỚI PROJECT NESTJS ECOMMERCE

Project này **đúng y kịch bản bài viết**: **Prisma + PostgreSQL**, có đủ các bảng traffic cao mà bài cảnh báo — `Order`, `Payment`, `PaymentTransaction`, `User`, `Product`, `CartItem`, `SKU`, `ProductTranslation` (xem `prisma/schema.prisma`).

### 9.1 Rủi ro cụ thể trong stack hiện tại

| Vấn đề                                                | Chi tiết trong project                                                                                                                                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prisma không tự set timeout**                       | `prisma migrate deploy` chạy migration trong transaction nhưng **không** đặt `lock_timeout`/`statement_timeout`. Nếu CI/CD auto-chạy migration lúc deploy mà gặp transaction đang giữ lock trên `Order` → đúng lock chain. |
| **Không hỗ trợ `CREATE INDEX CONCURRENTLY` natively** | Khi thêm `@@index` vào model lớn, Prisma sinh `CREATE INDEX` **thường** (lock SHARE → chặn ghi). Đã thấy migration `20250808095816_index_productid_on_product_translation`.                                                |
| **`ALTER TABLE` trên bảng traffic cao**               | Các migration `20250802053206_refactor_product`, `20250814102304_update_order` thuộc nhóm rủi ro #1 (ACCESS EXCLUSIVE).                                                                                                    |
| **`directUrl` (pooler/Supabase)**                     | Migration đi qua `DIRECT_URL`. Cần đảm bảo role này cũng được áp timeout, nếu không sẽ treo y hệt.                                                                                                                         |

### 9.2 Migration đã có trong project (đối chiếu rủi ro)

```
20250802053206_refactor_product                    → 🔴 ALTER TABLE bảng Product
20250808095816_index_productid_on_product_translation → 🔴 CREATE INDEX bảng lớn
20250812095810_adjust_relation_between_product_and_order → 🔴 ALTER + FK
20250814102304_update_order                        → 🔴 ALTER TABLE Order (traffic cao)
20250814104208_unique_userid_skuid_in_cartitem     → 🟡 UNIQUE INDEX trên CartItem
```

> Các migration trên hiện đã chạy xong nên không còn rủi ro. Nhưng **mọi migration TƯƠNG LAI** chạm các bảng này đều cần áp dụng checklist ở [Phần 10](#10-checklist-review-migration-cho-project).

### 9.3 Cách áp `lock_timeout` cho Prisma trong project này

Prisma không có flag built-in, nhưng có 3 cách thực dụng:

**Cách A — Đặt mặc định ở DB role dùng cho migration (khuyến nghị):**

```sql
-- chạy 1 lần, role mà DIRECT_URL dùng để migrate
ALTER ROLE migration_role SET lock_timeout = '3s';
ALTER ROLE migration_role SET statement_timeout = '5min';
```

**Cách B — Wrapper script trước `prisma migrate deploy`:**

```bash
# scripts/safe-migrate.sh
psql "$DIRECT_URL" -c "SET lock_timeout='3s'; SET statement_timeout='5min';"
pnpm prisma migrate deploy
```

**Cách C — Migration thủ công cho index lớn (dùng CONCURRENTLY):**

```sql
-- prisma/migrations/<timestamp>_add_idx_orders_created_at/migration.sql
-- KHÔNG bọc trong transaction (CONCURRENTLY không chạy trong tx)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at
  ON "Order" ("createdAt");
```

> Lưu ý: Prisma bọc mỗi migration trong transaction mặc định. Với `CONCURRENTLY` phải tách file riêng và chạy ngoài transaction (hoặc dùng `--skip-generate` + apply thủ công rồi `migrate resolve`).

---

## 10. CHECKLIST REVIEW MIGRATION CHO PROJECT

Áp dụng cho mọi PR có thay đổi `prisma/schema.prisma` chạm các bảng traffic cao (`Order`, `Payment`, `PaymentTransaction`, `User`, `Product`, `CartItem`, `SKU`).

**Trước khi merge:**

- [ ] Migration này cần **lock mode** nào? (`ALTER TABLE` = ACCESS EXCLUSIVE → review kỹ)
- [ ] Có chạm bảng traffic cao không? Nếu có → bắt buộc có `lock_timeout`.
- [ ] Có `CREATE INDEX` trên bảng lớn không? → đổi sang `CONCURRENTLY` (file thủ công).
- [ ] Có gộp schema change + backfill trong cùng migration không? → **tách ra**.
- [ ] Backfill có theo **batch** không? (không UPDATE toàn bảng 1 phát)
- [ ] `ADD COLUMN ... DEFAULT` — PG version ≥ 11? (project dùng PG nào?)

**Khi deploy:**

- [ ] Chạy lúc **traffic thấp**, có người trực.
- [ ] Đã set `lock_timeout` + `statement_timeout` cho migration role / wrapper.
- [ ] Có sẵn 2 query chẩn đoán lock (Phần 4) trong tay.
- [ ] Có kế hoạch `pg_cancel_backend` nếu treo.

**Khi sự cố (app timeout, connection pool full):**

- [ ] ❌ KHÔNG restart app/pod đầu tiên.
- [ ] ✅ Chạy `pg_stat_activity` xác nhận lock.
- [ ] ✅ Chạy `pg_blocking_pids()` tìm root PID.
- [ ] ✅ `pg_cancel_backend()` → chỉ `pg_terminate_backend()` khi đã xác định rõ session.

---

## 11. ĐÁNH GIÁ TỔNG THỂ BÀI VIẾT

### ✅ Điểm mạnh

- **Rất chắc về kỹ thuật, sát thực chiến.** Phần "CPU thấp vẫn sập" và "query chậm vì _chưa được chạy_" là insight đắt giá, đúng tâm lý debug sai hướng của nhiều team.
- Bộ query `pg_blocking_pids()` + quy trình cancel/terminate là chuẩn production runbook.
- Triết lý **"fail nhanh > treo lâu"** (`lock_timeout`) là tư duy đúng cho migration.
- Cảnh báo "đừng restart app đầu tiên" rất giá trị — đây là lỗi vận hành kinh điển.

### ⚠️ Điểm có thể bổ sung (đã thêm ở Phần 8)

- Không nêu **tên lock mode cụ thể** (`ACCESS EXCLUSIVE`, `SHARE`...) và bảng xung đột — đây mới là gốc rễ "vì sao SELECT cũng kẹt".
- Không nhắc cơ chế **lock queue FIFO** — phần giải thích sâu nhất cho lock chain.
- Gộp chung `DROP COLUMN` / `ADD COLUMN DEFAULT` hơi thô, thiếu mốc **PostgreSQL 11** (ranh giới rewrite vs metadata-only).

### 🎯 Kết luận

> **Database không chỉ die khi quá tải. Nó cũng có thể die khi một migration nhỏ làm cả hệ thống phải đứng chờ lock.**

Một bài case-study chất lượng cao, đáng đưa vào runbook vận hành. Với project Prisma + PostgreSQL này, các nguyên tắc của bài **áp dụng được ngay** — chỉ cần bổ sung lớp `lock_timeout`/`statement_timeout` và tách backfill theo batch.

---

## 12. CÂU HỎI PHỎNG VẤN THƯỜNG GẶP

**Q1: Migration chỉ "ADD COLUMN" thôi mà sao làm sập production?**

> Vì `ALTER TABLE` cần `ACCESS EXCLUSIVE` — lock mạnh nhất, xung đột cả `SELECT`. Nếu một transaction cũ đang giữ lock, migration phải xếp hàng chờ; mọi query đến sau bị kẹt theo cơ chế FIFO → lock chain.

**Q2: Database CPU chỉ 15% mà API timeout hàng loạt, nghi gì đầu tiên?**

> Lock wait. Query chờ lock thì chưa chạy nên không tốn CPU. CPU thấp KHÔNG loại được database. Chạy `pg_stat_activity` + `pg_blocking_pids()` để xác nhận.

**Q3: Vì sao một `SELECT` đơn giản lại bị một migration đang _chờ_ chặn?**

> PostgreSQL xếp hàng lock FIFO, không cho nhảy hàng. Migration (ACCESS EXCLUSIVE) đang chờ ở giữa hàng đợi sẽ chặn mọi request đến sau, kể cả request vốn tương thích với lock đang được giữ.

**Q4: `lock_timeout` khác `statement_timeout` thế nào?**

> `lock_timeout` giới hạn thời gian _chờ lấy lock_. `statement_timeout` giới hạn thời gian _thực thi câu lệnh_. Migration production nên đặt cả hai.

**Q5: Khi app timeout do DB lock, vì sao KHÔNG nên restart app trước?**

> Restart làm app reconnect hàng loạt → tăng áp lực connection lên DB đang kẹt → tệ hơn. Phải gỡ lock ở DB trước (cancel/terminate đúng session).

**Q6: Cách tạo index trên bảng lớn mà không khoá ghi?**

> Dùng `CREATE INDEX CONCURRENTLY`. Nhưng nó chạy lâu hơn, nhiều phase, có thể fail để lại invalid index → phải kiểm tra `pg_index.indisvalid` sau khi chạy.

**Q7: `pg_cancel_backend` khác `pg_terminate_backend` ra sao?**

> `pg_cancel_backend` huỷ query hiện tại nhưng giữ connection (nhẹ). `pg_terminate_backend` kill cả connection (mạnh). Ưu tiên cancel trước; chỉ terminate khi đã biết rõ session là gì.

---

> 📚 **Tài liệu liên quan trong project:**
>
> - [`ZZ_79_ROW_LOCKING_COMPLETE_GUIDE.md`](./ZZ_79_ROW_LOCKING_COMPLETE_GUIDE.md) — Row lock (bổ trợ: bài này là table/DDL lock)
> - [`ZZ_91_POSTGRESQL_INDEXING_DEEP_DIVE.md`](./ZZ_91_POSTGRESQL_INDEXING_DEEP_DIVE.md) — Index nội bộ
> - [`ZZ_37_MIGRATION_SYNC_GUIDE.md`](./ZZ_37_MIGRATION_SYNC_GUIDE.md) — Quy trình migration với Prisma
> - [`ZZ_21_ACID_VÀ_ISOLATE_CHUYÊN_SÂU_CHI_TIẾT.md`](./ZZ_21_ACID_VÀ_ISOLATE_CHUYÊN_SÂU_CHI_TIẾT.md) — Transaction & isolation
> - [`MIGRATIONS.md`](../MIGRATIONS.md) — Migration runbook của project
