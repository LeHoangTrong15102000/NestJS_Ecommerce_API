# MySQL ACID & Transaction Isolation Levels — Banking Domain

> **Mục tiêu:** Nắm chắc 4 tính chất ACID, 4 mức cô lập giao dịch, và 3 loại anomaly trong ngữ cảnh hệ thống tài chính (Banking / Finance / Insurance). Đây là kiến thức BẮT BUỘC khi phỏng vấn vào các công ty banking.

---

## Mục lục

1. [Tại sao Banking cần ACID nghiêm ngặt?](#1-tại-sao-banking-cần-acid-nghiêm-ngặt)
2. [4 Tính chất ACID](#2-4-tính-chất-acid)
3. [3 Anomaly trong Concurrent Transactions](#3-3-anomaly-trong-concurrent-transactions)
4. [4 Mức Isolation Level](#4-4-mức-isolation-level)
5. [MySQL vs PostgreSQL: Điểm khác biệt quan trọng](#5-mysql-vs-postgresql-điểm-khác-biệt-quan-trọng)
6. [Chọn Isolation Level nào cho Banking?](#6-chọn-isolation-level-nào-cho-banking)
7. [Câu hỏi phỏng vấn thường gặp](#7-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Tại sao Banking cần ACID nghiêm ngặt?

Trong e-commerce thông thường, nếu stock bị sai vài giây rồi tự sửa → người dùng chỉ khó chịu.  
Trong **banking/finance**, nếu số dư bị sai 1ms → **tiền biến mất / tiền nhân đôi → vi phạm pháp lý**.

```
Kịch bản ngân hàng:
  Tài khoản A: 1,000,000 VND
  Tài khoản B: 500,000 VND

  T1: Chuyển 500,000 từ A → B
  T2: Đồng thời, T2 đọc số dư A để kiểm tra giới hạn

  Nếu T2 đọc số dư A = 1,000,000 (TRƯỚC khi T1 trừ) → hiển thị sai
  Nếu T2 đọc số dư A = 500,000 (SAU khi T1 trừ, nhưng T1 chưa COMMIT) → có thể bị rollback
  → Cả 2 trường hợp đều có thể gây quyết định sai (approve/deny giao dịch)
```

---

## 2. 4 Tính chất ACID

### 2.1 Atomicity — Tính nguyên tử

**"All or nothing"** — Giao dịch hoặc thành công toàn bộ, hoặc rollback toàn bộ.

```sql
-- Chuyển tiền: 2 bước PHẢI đi cùng nhau
BEGIN;
  UPDATE accounts SET balance = balance - 500000 WHERE id = 1;  -- Trừ A
  UPDATE accounts SET balance = balance + 500000 WHERE id = 2;  -- Cộng B
COMMIT;
-- Nếu bước 2 fail → cả 2 đều ROLLBACK, tiền A không bị mất
```

**Câu hỏi hay bị hỏi:**
> "Nếu server crash giữa 2 câu UPDATE thì sao?"
> → MySQL dùng **Redo Log + Undo Log**. Khi restart, MySQL xem log: transaction chưa COMMIT → tự ROLLBACK. Tiền không bị mất.

---

### 2.2 Consistency — Tính nhất quán

Sau mỗi transaction, DB phải ở **trạng thái hợp lệ** (thỏa mãn tất cả constraints).

```sql
-- Constraint ràng buộc: balance không được âm
ALTER TABLE accounts ADD CONSTRAINT chk_balance CHECK (balance >= 0);

-- Nếu chuyển 2,000,000 từ tài khoản chỉ có 1,000,000:
BEGIN;
  UPDATE accounts SET balance = balance - 2000000 WHERE id = 1;
  -- ERROR: CHECK constraint violated (balance sẽ = -1,000,000)
ROLLBACK; -- Auto rollback do vi phạm constraint
```

---

### 2.3 Isolation — Tính cô lập *(Phần khó và quan trọng nhất)*

Các transaction đồng thời **không được ảnh hưởng lẫn nhau**.

> Đây là tính chất gây ra nhiều vấn đề nhất trong hệ thống banking high-concurrency. Chi tiết ở mục 3 và 4.

---

### 2.4 Durability — Tính bền vững

Sau khi COMMIT, dữ liệu được **ghi xuống disk vĩnh viễn**, dù server crash ngay sau đó.

```
MySQL InnoDB đảm bảo Durability qua:
  - Redo Log (Write-Ahead Log): ghi log TRƯỚC khi ghi data
  - innodb_flush_log_at_trx_commit = 1 (default):
      → Mỗi COMMIT đều flush redo log xuống disk
      → Đảm bảo 100% durability, nhưng chậm hơn
      
  - innodb_flush_log_at_trx_commit = 2:
      → Flush mỗi giây, không phải mỗi COMMIT
      → Nhanh hơn nhưng có thể mất tối đa 1 giây data khi crash
      → KHÔNG nên dùng cho banking
```

---

## 3. 3 Anomaly trong Concurrent Transactions

### 3.1 Dirty Read — Đọc dữ liệu bẩn

**Định nghĩa:** Đọc được dữ liệu của transaction **chưa COMMIT** (uncommitted data). Nếu transaction kia ROLLBACK → dữ liệu vừa đọc trở thành "ma".

```sql
-- Banking scenario: Kiểm tra số dư trước khi approve giao dịch

-- Transaction A (Chuyển tiền, chưa commit)
BEGIN;
  UPDATE accounts SET balance = balance - 1000000 WHERE id = 1;
  -- Chưa COMMIT

-- Transaction B (Đồng thời - đọc số dư để kiểm tra)
-- Nếu isolation = READ UNCOMMITTED:
  SELECT balance FROM accounts WHERE id = 1;
  -- Đọc được balance đã bị trừ 1,000,000 (UNCOMMITTED DATA!)
  
-- Transaction A bị lỗi, ROLLBACK:
ROLLBACK;
-- balance quay về giá trị gốc

-- Kết quả: Transaction B đã quyết định dựa trên dữ liệu không hợp lệ!
-- Ví dụ: B approve giao dịch thứ 2 vì nghĩ A đã chuyển tiền → NGUY HIỂM
```

**Mức độ nguy hiểm trong banking:** ⚠️ **CỰC KỲ NGUY HIỂM** — Không bao giờ được chấp nhận.

---

### 3.2 Non-Repeatable Read — Đọc không nhất quán

**Định nghĩa:** Trong cùng 1 transaction, đọc cùng 1 row 2 lần cho **kết quả khác nhau** (do transaction khác đã UPDATE và COMMIT).

```sql
-- Banking scenario: Kiểm tra điều kiện rồi thực hiện giao dịch

-- Transaction A (Kiểm tra số dư để quyết định)
BEGIN;
  -- Lần đọc 1: số dư = 5,000,000
  SELECT balance FROM accounts WHERE id = 1;
  -- → Điều kiện: balance > 1,000,000 → TRUE → Tiếp tục xử lý

  -- Transaction B (đồng thời - rút tiền ATM)
  UPDATE accounts SET balance = balance - 4,500,000 WHERE id = 1;
  COMMIT;

  -- Transaction A tiếp tục:
  -- Lần đọc 2 (để confirm trước khi thực hiện):
  SELECT balance FROM accounts WHERE id = 1;
  -- → Số dư = 500,000 ← KHÁC lần đọc đầu!
  -- → Logic quyết định sai: approve giao dịch dựa trên 5,000,000
  --   nhưng thực tế chỉ còn 500,000 → THỪA CHI
COMMIT;
```

**Mức độ nguy hiểm trong banking:** ⚠️ **NGUY HIỂM** — Có thể gây overdraft.

---

### 3.3 Phantom Read — Đọc bóng ma

**Định nghĩa:** Trong cùng 1 transaction, chạy cùng 1 query 2 lần nhưng lần sau **xuất hiện thêm row mới** (do transaction khác INSERT và COMMIT).

```sql
-- Banking scenario: Đếm số giao dịch để kiểm tra giới hạn

-- Transaction A (Kiểm tra giới hạn 5 giao dịch/ngày)
BEGIN;
  -- Lần kiểm tra 1:
  SELECT COUNT(*) FROM transactions 
  WHERE account_id = 1 AND DATE(created_at) = CURDATE();
  -- → COUNT = 4 → Còn được phép thêm 1 giao dịch nữa

  -- Transaction B (Đồng thời - giao dịch từ mobile app khác)
  INSERT INTO transactions (account_id, amount) VALUES (1, 100000);
  COMMIT;

  -- Transaction A tiếp tục, approve giao dịch của mình:
  INSERT INTO transactions (account_id, amount) VALUES (1, 200000);
  
  -- Lần kiểm tra 2 (cuối transaction):
  SELECT COUNT(*) FROM transactions 
  WHERE account_id = 1 AND DATE(created_at) = CURDATE();
  -- → COUNT = 6! → ĐÃ VỢT GIỚI HẠN
COMMIT;
-- Kết quả: Tài khoản có 6 giao dịch/ngày, vượt giới hạn 5
```

**Mức độ nguy hiểm trong banking:** ⚠️ **NGUY HIỂM** — Vi phạm business rules.

---

## 4. 4 Mức Isolation Level

### Bảng tổng quan

| Isolation Level    | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|--------------------|:----------:|:-------------------:|:------------:|:-----------:|
| READ UNCOMMITTED   | ✅ Xảy ra  | ✅ Xảy ra           | ✅ Xảy ra    | Cao nhất    |
| READ COMMITTED     | ❌ Ngăn    | ✅ Xảy ra           | ✅ Xảy ra    | Cao         |
| REPEATABLE READ    | ❌ Ngăn    | ❌ Ngăn             | ✅ Xảy ra*   | Trung bình  |
| SERIALIZABLE       | ❌ Ngăn    | ❌ Ngăn             | ❌ Ngăn      | Thấp nhất   |

> *MySQL InnoDB dùng Next-Key Lock, Phantom Read ít xảy ra hơn ở RR, nhưng không bảo đảm 100%.

---

### 4.1 READ UNCOMMITTED

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- Đặc điểm:
-- ❌ KHÔNG ngăn Dirty Read
-- ❌ KHÔNG ngăn Non-Repeatable Read  
-- ❌ KHÔNG ngăn Phantom Read
-- ✅ Hiệu suất cao nhất (không có lock overhead)

-- Khi nào dùng trong banking?
-- → KHÔNG BAO GIỜ dùng cho giao dịch tài chính
-- → Chỉ phù hợp: dashboard reporting approximate (không cần chính xác tuyệt đối)
```

---

### 4.2 READ COMMITTED

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- MySQL: không phải default (PostgreSQL default là READ COMMITTED)

-- Đặc điểm:
-- ✅ Ngăn Dirty Read: chỉ đọc data đã COMMIT
-- ❌ Vẫn có Non-Repeatable Read
-- ❌ Vẫn có Phantom Read

-- Khi nào dùng trong banking?
-- → Queries đọc-only (báo cáo, dashboard) không cần consistent snapshot
-- → Thao tác UPDATE đơn lẻ không phụ thuộc nhiều lần đọc
-- → KHÔNG phù hợp cho: đọc số dư → quyết định → ghi lại
```

---

### 4.3 REPEATABLE READ *(MySQL Default)*

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Đây là DEFAULT của MySQL InnoDB

-- Đặc điểm:
-- ✅ Ngăn Dirty Read
-- ✅ Ngăn Non-Repeatable Read: đọc cùng row nhiều lần → cùng kết quả
-- ⚠️ Có thể có Phantom Read (nhưng MySQL InnoDB giảm thiểu bằng Next-Key Lock)

-- Cơ chế: Snapshot Read (MVCC)
-- → Lúc BEGIN transaction, MySQL chụp "snapshot" hiện tại
-- → Mọi SELECT trong transaction đọc từ snapshot đó
-- → Không thấy các thay đổi COMMIT bởi transaction khác

-- Khi nào dùng trong banking?
-- ✅ Giao dịch chuyển tiền thông thường
-- ✅ Kiểm tra số dư + thực hiện giao dịch (kết hợp SELECT ... FOR UPDATE)
-- ✅ Đủ cho 90% use case banking
```

**Lưu ý quan trọng với REPEATABLE READ:**

```sql
-- Snapshot Read (không lock):
SELECT balance FROM accounts WHERE id = 1; 
-- → Đọc từ snapshot, không block

-- Locking Read (có lock - dùng khi cần update sau đó):
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- → Đọc data HIỆN TẠI (không từ snapshot), đồng thời lock row
-- → Transaction khác phải ĐỢI trước khi update row này
```

---

### 4.4 SERIALIZABLE

```sql
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Đặc điểm:
-- ✅ Ngăn tất cả anomalies
-- ✅ Các transaction như chạy tuần tự (không đồng thời)
-- ❌ Hiệu suất thấp nhất, nhiều lock nhất, deadlock cao hơn

-- Cơ chế: Tự động convert mọi SELECT thành SELECT ... FOR SHARE
-- → Mọi đọc đều đặt shared lock → ghi phải đợi → deadlock dễ xảy ra

-- Khi nào dùng trong banking?
-- ✅ Đối soát cuối ngày (end-of-day reconciliation)
-- ✅ Tính lãi suất batch (không chấp nhận bất kỳ sai sót nào)
-- ✅ Giao dịch đặc biệt cần chính xác tuyệt đối
-- ❌ Không dùng cho OLTP thông thường → quá chậm
```

---

## 5. MySQL vs PostgreSQL: Điểm khác biệt quan trọng

> **Quan trọng khi phỏng vấn banking!** Nhiều công ty dùng MySQL, nhưng kiến thức phổ biến thường nghiêng về PostgreSQL.

| Điểm | MySQL InnoDB | PostgreSQL |
|------|-------------|------------|
| **Default Isolation** | REPEATABLE READ | READ COMMITTED |
| **Phantom Read tại RR** | Giảm thiểu (Next-Key Lock) | Vẫn xảy ra (MVCC thuần) |
| **Locking khi UPDATE** | Row-level lock + Gap Lock | Row-level lock (MVCC) |
| **SELECT mặc định** | Snapshot read (không lock) | Snapshot read (không lock) |
| **FOR UPDATE** | Lock row + Gap (Next-Key) | Lock row chỉ |
| **Deadlock detection** | Có (auto rollback victim) | Có (auto rollback victim) |

### MySQL Gap Lock & Next-Key Lock (đặc trưng của MySQL)

```sql
-- Tại MySQL REPEATABLE READ, khi dùng range query:
SELECT * FROM transactions WHERE amount BETWEEN 100 AND 500 FOR UPDATE;

-- MySQL không chỉ lock các rows đang tồn tại,
-- mà còn lock cả "khoảng trống" (gap) giữa các rows
-- → Ngăn INSERT vào khoảng 100-500 → ngăn Phantom Read

-- Next-Key Lock = Row Lock + Gap Lock (trước row đó)
-- Ví dụ với rows có amount: 100, 300, 500
-- → Lock row 100, 300, 500 VÀ lock gap (-∞,100), (100,300), (300,500), (500,+∞)
```

---

## 6. Chọn Isolation Level nào cho Banking?

```
┌─────────────────────────────┬──────────────────────────────────────────┐
│ Use case                    │ Isolation Level được khuyến nghị         │
├─────────────────────────────┼──────────────────────────────────────────┤
│ Chuyển tiền (transfer)      │ REPEATABLE READ + SELECT ... FOR UPDATE  │
│ Kiểm tra & ghi số dư        │ REPEATABLE READ + SELECT ... FOR UPDATE  │
│ Đọc lịch sử giao dịch       │ READ COMMITTED (read-only, báo cáo)     │
│ Dashboard số liệu realtime  │ READ COMMITTED (chấp nhận approximate)   │
│ Đối soát cuối ngày          │ SERIALIZABLE                             │
│ Tính lãi suất batch         │ SERIALIZABLE hoặc RR + explicit lock     │
│ Kiểm tra giới hạn giao dịch │ REPEATABLE READ + FOR UPDATE (atomic)   │
└─────────────────────────────┴──────────────────────────────────────────┘
```

### Pattern chuẩn cho Banking Transaction:

```sql
-- Pattern: Read-then-Write với Pessimistic Lock
BEGIN;
  -- 1. Lock row ngay từ đầu (FOR UPDATE)
  SELECT balance, version FROM accounts WHERE id = ? FOR UPDATE;
  
  -- 2. Kiểm tra điều kiện business
  -- (biết chắc không ai thay đổi row này vì đã lock)
  
  -- 3. Thực hiện giao dịch
  UPDATE accounts SET balance = balance - ?, updated_at = NOW() WHERE id = ?;
  
  -- 4. Ghi lịch sử
  INSERT INTO transactions (account_id, amount, type, created_at) VALUES (?, ?, ?, NOW());
COMMIT;
```

---

## 7. Câu hỏi phỏng vấn thường gặp

**Q1: "Mức isolation mặc định của MySQL là gì? Tại sao MySQL chọn mức đó?"**
> A: MySQL InnoDB mặc định là **REPEATABLE READ**. Vì khi MySQL bắt đầu hỗ trợ replication, binlog format dựa trên statement (STATEMENT-based), và READ COMMITTED có thể gây ra non-deterministic replication. REPEATABLE READ an toàn hơn với replication truyền thống.

**Q2: "Dirty Read là gì? Nó nguy hiểm thế nào trong banking?"**
> A: Dirty Read là đọc dữ liệu của transaction chưa COMMIT. Trong banking: nếu transaction A trừ tiền (chưa commit) và transaction B đọc số dư đó, rồi A rollback → B đã quyết định dựa trên tiền không tồn tại. Có thể approve giao dịch sai, gây double-spend hoặc overdraft.

**Q3: "Phantom Read khác Non-Repeatable Read như thế nào?"**
> A: Non-Repeatable Read: đọc cùng 1 **row** 2 lần → kết quả khác (do UPDATE/DELETE). Phantom Read: đọc cùng 1 **tập hợp rows** (range query) 2 lần → xuất hiện thêm rows mới (do INSERT).

**Q4: "Tại sao SERIALIZABLE ít được dùng trong OLTP banking?"**
> A: SERIALIZABLE biến mọi SELECT thành SELECT FOR SHARE, gây ra nhiều shared locks → khi có transaction ghi, nhiều transaction đọc bị chặn → throughput giảm mạnh. Hệ thống banking OLTP có hàng nghìn giao dịch/giây không chịu được latency này. Thay vào đó dùng REPEATABLE READ + SELECT FOR UPDATE ở những điểm quan trọng.

**Q5: "MySQL và PostgreSQL khác nhau gì về Phantom Read?"**
> A: MySQL InnoDB ở REPEATABLE READ dùng Next-Key Lock (Gap Lock + Row Lock) nên ngăn được Phantom Read trong nhiều trường hợp. PostgreSQL ở REPEATABLE READ chỉ dùng MVCC snapshot read, không có gap lock nên Phantom Read vẫn xảy ra — muốn ngăn phải lên SERIALIZABLE.
