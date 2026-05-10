# Giải Thích Thuật Ngữ Database — Dành Cho Người Mới Đào Sâu

> File này giải thích các thuật ngữ khó trong `ZZ_90_2_SO_SANH_POSTGRESQL_VS_MYSQL_CHUYEN_SAU.md`
> Mỗi thuật ngữ đều có ví dụ đời thường để dễ hình dung.

---

## Mục lục

1. [Kiến trúc cơ bản](#1-kiến-trúc-cơ-bản)
2. [Storage — Cách lưu trữ dữ liệu](#2-storage--cách-lưu-trữ-dữ-liệu)
3. [MVCC — Xử lý đồng thời](#3-mvcc--xử-lý-đồng-thời)
4. [Locking — Khóa dữ liệu](#4-locking--khóa-dữ-liệu)
5. [Isolation Levels — Mức độ cô lập](#5-isolation-levels--mức-độ-cô-lập)
6. [Indexing — Đánh chỉ mục](#6-indexing--đánh-chỉ-mục)
7. [Replication & Scalability](#7-replication--scalability)

---

## 1. Kiến trúc cơ bản

### Process vs Thread (Tiến trình vs Luồng)

**Ví dụ đời thường:**
- **Process (tiến trình)** = mỗi khách hàng được phục vụ bởi 1 nhân viên riêng, ngồi phòng riêng. Nếu 1 nhân viên ngất, các nhân viên khác không bị ảnh hưởng. Nhưng tốn nhiều phòng (RAM).
- **Thread (luồng)** = tất cả nhân viên ngồi chung 1 phòng lớn, chia sẻ tài nguyên. Nhẹ hơn, nhưng nếu 1 người làm đổ cà phê lên server chung → cả phòng bị ảnh hưởng.

**Trong database:**
- PostgreSQL = multi-process: mỗi connection tạo 1 process riêng (~5-10MB RAM/connection)
- MySQL = multi-thread: mỗi connection tạo 1 thread trong cùng process (~1-2MB RAM/connection)

### Context Switching (Chuyển đổi ngữ cảnh)

Khi CPU phải chuyển từ xử lý task A sang task B, nó phải "lưu lại trạng thái A, load trạng thái B". Giống như bạn đang đọc sách A, phải đánh dấu trang, cất đi, lấy sách B ra đọc.

- Process switching = nặng hơn (phải lưu nhiều thứ hơn vì mỗi process có bộ nhớ riêng)
- Thread switching = nhẹ hơn (các thread chia sẻ bộ nhớ nên ít thứ phải lưu/load)

### Connection Pooling (Bể kết nối)

**Ví dụ:** Thay vì mỗi khách đến quán phải xây 1 bàn mới (tạo connection mới = tốn thời gian), quán chuẩn bị sẵn 20 bàn. Khách đến → ngồi bàn trống. Khách đi → bàn được dọn cho khách tiếp theo.

**Trong database:** Tạo connection tốn tài nguyên. Connection pool giữ sẵn N connections, ứng dụng "mượn" connection khi cần, "trả" khi xong. PostgreSQL gần như bắt buộc dùng (PgBouncer) vì mỗi connection = 1 process nặng.

### Shared Memory / Buffer Pool

**Ví dụ:** Giống bộ nhớ đệm (cache) chung của cả nhà hàng. Thay vì mỗi lần cần nguyên liệu phải chạy ra kho (đọc từ ổ cứng), nhà hàng để sẵn nguyên liệu hay dùng trên kệ gần bếp (RAM).

- PostgreSQL: `shared_buffers` = vùng RAM chung chứa các page data hay truy cập
- MySQL: `InnoDB Buffer Pool` = vùng RAM chứa data + index pages

---

## 2. Storage — Cách lưu trữ dữ liệu

### Heap-based Storage (PostgreSQL)

**Ví dụ:** Giống 1 cuốn sổ ghi chép — bạn ghi dữ liệu theo thứ tự thời gian, không sắp xếp. Muốn tìm gì phải dùng mục lục (index) để biết "trang nào, dòng nào".

- Data được ghi vào "pages" (trang) 8KB, không theo thứ tự nào cả
- Index trỏ đến vị trí chính xác: (page số mấy, offset bao nhiêu)

### Clustered Index (MySQL InnoDB)

**Ví dụ:** Giống từ điển — dữ liệu được SẮP XẾP theo Primary Key. Bản thân cách sắp xếp đó chính là index. Bạn tìm từ "Apple" → lật đến phần chữ A → data nằm ngay đó.

- Primary Key = cách tổ chức data trên ổ cứng (data nằm trong leaf nodes của B+Tree)
- Secondary Index (index phụ) → chỉ chứa giá trị PK → phải "nhảy" thêm 1 bước để lấy data thật

### B+Tree

**Ví dụ:** Giống cây phả hệ ngược — gốc ở trên, lá ở dưới.

```
         [50]              ← Root (gốc)
        /    \
    [20,30]  [70,80]       ← Internal nodes (nhánh)
    / | \    / | \
  [data] [data] [data]    ← Leaf nodes (lá) — chứa data thật
```

Muốn tìm giá trị 25: Root → đi trái (vì 25 < 50) → node [20,30] → đi giữa → tìm thấy. Chỉ cần 3 bước dù có hàng triệu rows.

### Page (Trang dữ liệu)

Database không đọc/ghi từng row — nó đọc/ghi theo "page" (khối). Giống như ổ cứng đọc theo sector, database đọc theo page.
- PostgreSQL: 8KB/page
- MySQL: 16KB/page

### WAL (Write-Ahead Log)

**Ví dụ:** Trước khi sửa sổ cái (data file), bạn ghi vào sổ nhật ký trước: "Tôi sắp sửa dòng X thành Y". Nếu mất điện giữa chừng, khi bật lại máy, database đọc nhật ký để biết cần hoàn thành hay hủy thao tác nào.

- "Write-Ahead" = ghi log TRƯỚC, ghi data SAU
- Đảm bảo data không bị hỏng khi crash
- PostgreSQL gọi là WAL, MySQL gọi là Redo Log (cùng concept)

### Tuple (Bộ dữ liệu)

Đơn giản là 1 row (hàng) trong table. PostgreSQL gọi mỗi row là "tuple". Mỗi tuple có:
- Header: metadata (ai tạo, khi nào, còn sống không)
- Data: giá trị các cột

---

## 3. MVCC — Xử lý đồng thời

### MVCC là gì? (Multi-Version Concurrency Control)

**Vấn đề:** 2 người cùng đọc/sửa 1 row → xung đột.

**Giải pháp MVCC:** Thay vì khóa row lại (không ai được đọc khi người khác đang sửa), database giữ NHIỀU PHIÊN BẢN của cùng 1 row. Mỗi người đọc phiên bản phù hợp với thời điểm họ bắt đầu.

**Ví dụ đời thường:** Google Docs — bạn đang đọc version 3 của tài liệu, người khác sửa thành version 4. Bạn vẫn thấy version 3 cho đến khi refresh. Không ai bị block.

### Snapshot (Ảnh chụp)

Khi transaction bắt đầu, database "chụp ảnh" trạng thái hiện tại. Transaction đó chỉ thấy data tại thời điểm chụp ảnh, không thấy thay đổi của người khác sau đó.

### Transaction ID (TX ID / xmin / xmax)

Mỗi transaction được gán 1 số ID tăng dần. Giống số thứ tự xếp hàng.
- `xmin` = "ai tạo ra row này" (TX ID của người INSERT/UPDATE tạo version này)
- `xmax` = "ai xóa/update row này" (TX ID của người DELETE/UPDATE làm version này "chết")

### Dead Tuple (Tuple chết)

Khi UPDATE 1 row trong PostgreSQL, nó KHÔNG sửa row cũ. Nó:
1. Tạo row MỚI (version mới)
2. Đánh dấu row CŨ là "dead" (chết)

Row cũ vẫn nằm đó chiếm chỗ cho đến khi VACUUM dọn.

### VACUUM (Hút bụi)

**Ví dụ:** Giống dọn nhà — những row "chết" (dead tuples) vẫn chiếm chỗ trong table. VACUUM đi qua, kiểm tra "row này còn ai cần đọc không?", nếu không → đánh dấu chỗ đó là trống, có thể tái sử dụng.

- `autovacuum`: PostgreSQL tự động chạy VACUUM định kỳ
- Nếu VACUUM chậm/không chạy kịp → table phình to (bloat)

### Table Bloat (Phình bảng)

Khi dead tuples tích tụ quá nhiều mà VACUUM không dọn kịp → table chiếm nhiều disk hơn cần thiết → query chậm vì phải scan qua nhiều "rác".

**Ví dụ:** Tủ quần áo có 50% đồ không mặc nữa nhưng chưa vứt → tìm đồ lâu hơn, tủ đầy nhưng thực tế ít đồ dùng được.

### Undo Log (MySQL)

**Ví dụ:** Thay vì giữ nhiều bản copy trong cùng tủ (như PostgreSQL), MySQL giữ bản MỚI NHẤT trong tủ chính, còn các bản CŨ được cất vào "hộp lưu trữ" (undo log) riêng.

- Khi ai đó cần đọc version cũ → MySQL đi ngược từ version hiện tại qua undo log để "dựng lại" version cũ
- Purge Thread tự động dọn undo log khi không ai cần nữa

### Write Amplification (Khuếch đại ghi)

**Ví dụ:** Bạn chỉ muốn sửa 1 chữ trong 1 trang sách, nhưng hệ thống bắt bạn phải photocopy nguyên trang mới rồi sửa trên bản copy. Ghi 1 byte data nhưng thực tế phải ghi nhiều hơn.

PostgreSQL bị nhiều hơn vì mỗi UPDATE = tạo tuple mới + update tất cả indexes trỏ đến row đó.

### HOT Update (Heap-Only Tuple Update)

Tối ưu của PostgreSQL: nếu UPDATE không thay đổi cột nào được index, và page còn chỗ → tạo tuple mới TRONG CÙNG PAGE, không cần update index. Giảm write amplification đáng kể.

---

## 4. Locking — Khóa dữ liệu

### Lock là gì?

**Ví dụ:** Giống khóa phòng tắm — khi bạn vào, bạn khóa lại. Người khác phải đợi bạn ra mới vào được. Database dùng lock để ngăn 2 người sửa cùng 1 data đồng thời.

### Row Lock vs Table Lock

- **Row lock**: khóa 1 hàng cụ thể. Người khác vẫn đọc/sửa hàng khác bình thường.
- **Table lock**: khóa cả bảng. Không ai làm gì được cho đến khi unlock.

### Shared Lock (S) vs Exclusive Lock (X)

- **Shared Lock (S)**: "Tôi đang ĐỌC, bạn cũng được đọc, nhưng không ai được SỬA"
  - Nhiều người cùng giữ shared lock được (nhiều người cùng đọc)
- **Exclusive Lock (X)**: "Tôi đang SỬA, không ai được đọc hay sửa"
  - Chỉ 1 người giữ exclusive lock tại 1 thời điểm

### Gap Lock (Khóa khoảng trống) — MySQL only

**Ví dụ:** Bạn có dãy ghế số 10, 20, 30. Gap Lock khóa KHOẢNG TRỐNG giữa các ghế (11-19, 21-29). Không ai được THÊM ghế mới vào khoảng đó.

**Tại sao cần?** Để ngăn "phantom read" — ngăn người khác INSERT row mới vào range bạn đang query.

**Vấn đề:** 2 transactions cùng lock gap → cả 2 đều muốn INSERT vào gap đó → deadlock!

### Next-Key Lock = Record Lock + Gap Lock

Khóa 1 record CỤ THỂ + khoảng trống TRƯỚC nó. Ví dụ: Next-Key Lock trên record 20 = lock record 20 + lock gap (10, 20).

### Deadlock (Bế tắc)

**Ví dụ:** 2 người đứng ở 2 cửa hẹp, mỗi người chặn đường người kia. Cả 2 đều đợi người kia nhường → không ai đi được.

```
TX1 giữ lock A, muốn lock B
TX2 giữ lock B, muốn lock A
→ Cả 2 đợi nhau mãi mãi → Database phải "giết" 1 transaction
```

### Advisory Lock (Khóa tư vấn)

Lock "tự nguyện" — database không tự động dùng, mà developer chủ động gọi. Giống như bạn tự đặt biển "đang bận" trên bàn làm việc. Database không enforce gì, nhưng code của bạn kiểm tra biển đó trước khi làm.

Dùng cho: distributed locking, rate limiting, job scheduling...

### Intention Lock (IS, IX)

**Ví dụ:** Trước khi khóa 1 phòng trong tòa nhà, bạn treo biển ở sảnh: "Tôi sắp khóa phòng 301". Để người khác biết "có ai đó đang dùng row lock bên trong table này" mà không cần kiểm tra từng row.

---

## 5. Isolation Levels — Mức độ cô lập

### Transaction là gì?

Một nhóm thao tác được thực hiện "tất cả hoặc không gì cả". Ví dụ chuyển tiền:
1. Trừ tài khoản A: -100
2. Cộng tài khoản B: +100

Nếu bước 2 fail → bước 1 cũng phải rollback. Đó là transaction.

### Dirty Read (Đọc bẩn)

Đọc data mà transaction khác CHƯA COMMIT (chưa xác nhận). Nếu transaction đó rollback → bạn đã đọc data "ma" không tồn tại.

**Ví dụ:** Bạn nhìn thấy ai đó viết "balance = 1000" nhưng họ chưa ấn Save. Họ ấn Cancel → balance thực ra vẫn là 500.

### Non-repeatable Read (Đọc không lặp lại)

Đọc cùng 1 row 2 lần trong 1 transaction, nhưng kết quả khác nhau (vì người khác đã UPDATE và COMMIT giữa 2 lần đọc).

### Phantom Read (Đọc ma)

Query cùng 1 điều kiện 2 lần, lần sau có THÊM rows mới (vì người khác INSERT và COMMIT).

**Ví dụ:** Bạn đếm "có bao nhiêu đơn hàng status=PENDING?" → 10. Một lúc sau đếm lại → 11. Row thứ 11 là "phantom" (ma).

### Các mức Isolation (từ yếu → mạnh):

| Level | Dirty Read | Non-repeatable | Phantom |
|-------|-----------|----------------|---------|
| READ UNCOMMITTED | Có thể | Có thể | Có thể |
| READ COMMITTED | Không | Có thể | Có thể |
| REPEATABLE READ | Không | Không | Có thể* |
| SERIALIZABLE | Không | Không | Không |

*MySQL RR ngăn phantom bằng Gap Lock, PostgreSQL RR vẫn có thể bị phantom ở một số case.

### SSI (Serializable Snapshot Isolation) — PostgreSQL

**Cách tiếp cận lạc quan (optimistic):** Cho mọi người đọc/ghi thoải mái (không lock), nhưng khi COMMIT → kiểm tra "có conflict không?". Nếu có → abort 1 transaction, bắt retry.

**Ưu điểm:** Throughput cao vì không ai bị block khi đọc.

### MySQL SERIALIZABLE

**Cách tiếp cận bi quan (pessimistic):** Mọi SELECT đều tự động thêm lock (FOR SHARE). An toàn tuyệt đối nhưng chậm vì ai cũng phải đợi lock.

### Lost Update (Mất cập nhật)

```
Balance = 1000
TX1 đọc: 1000, tính: 1000 - 100 = 900
TX2 đọc: 1000, tính: 1000 - 50 = 950
TX1 ghi: balance = 900
TX2 ghi: balance = 950  ← MẤT update của TX1!
```

Đáng lẽ balance = 850, nhưng thành 950. PostgreSQL RR phát hiện và báo lỗi. MySQL RR không phát hiện (cần dùng SELECT FOR UPDATE).

---

## 6. Indexing — Đánh chỉ mục

### Index là gì?

**Ví dụ:** Mục lục cuối sách. Thay vì đọc 500 trang để tìm từ "MVCC", bạn mở mục lục → "MVCC: trang 146" → lật thẳng đến.

Không có index → database phải scan TOÀN BỘ table (Sequential Scan / Full Table Scan).

### B-Tree Index (mặc định)

Cấu trúc cây cân bằng, tìm kiếm O(log n). Phù hợp: =, <, >, BETWEEN, ORDER BY.

### Partial Index (Index một phần) — PostgreSQL only

**Ví dụ:** Thay vì đánh mục lục cho TẤT CẢ 10,000 đơn hàng, chỉ đánh mục lục cho 500 đơn "PENDING" (vì chỉ query đơn pending thường xuyên).

```sql
CREATE INDEX idx ON orders(created_at) WHERE status = 'PENDING';
-- Index nhỏ hơn 20 lần → nhanh hơn, tốn ít RAM hơn
```

### GIN Index (Generalized Inverted Index)

**Ví dụ:** Giống index ở cuối sách kỹ thuật — mỗi từ khóa → danh sách các trang chứa từ đó.

Phù hợp cho: arrays, JSONB, full-text search. Khi bạn hỏi "tìm sản phẩm có tag 'electronics'" → GIN biết ngay rows nào chứa tag đó.

### BRIN Index (Block Range Index)

**Ví dụ:** Thay vì ghi "row 12345 ở page 67", BRIN chỉ ghi "page 1-10 chứa dates từ Jan 1 đến Jan 10". Cực kỳ nhỏ gọn nhưng kém chính xác hơn.

Phù hợp cho: data có thứ tự tự nhiên (time-series, logs — data mới luôn có timestamp lớn hơn data cũ).

### GiST Index (Generalized Search Tree)

Index cho data "không truyền thống": hình học (điểm, đường, polygon), range types, full-text. PostGIS dùng GiST để tìm "tất cả nhà hàng trong bán kính 5km".

### Covering Index / Index-Only Scan

Khi index chứa ĐỦ data bạn cần → database không cần "nhảy" về table để lấy thêm. Giống mục lục sách ghi luôn tóm tắt nội dung → không cần lật đến trang đó.

### Secondary Index → Double Lookup (MySQL)

Trong MySQL, secondary index chỉ chứa giá trị Primary Key. Nên khi query dùng secondary index:
1. Tìm trong secondary index → lấy PK value
2. Dùng PK value tìm trong clustered index → lấy row data

= 2 lần tìm kiếm (double lookup). PostgreSQL không bị vì index trỏ thẳng đến vị trí physical.

### Visibility Map (PostgreSQL)

Bản đồ đánh dấu "page nào chỉ chứa tuples mà TẤT CẢ transactions đều thấy". Nếu page "all-visible" → index-only scan không cần kiểm tra từng tuple có visible không.

---

## 7. Replication & Scalability

### Replication (Sao chép)

**Ví dụ:** Bạn có 1 cuốn sổ gốc (Primary/Source). Bạn photocopy ra nhiều bản (Replica/Standby). Mỗi khi sổ gốc thay đổi → các bản copy được cập nhật theo.

**Mục đích:**
- Read scaling: query đọc đi vào replicas, giảm tải cho primary
- High availability: primary chết → replica lên thay

### WAL Streaming (PostgreSQL)

Primary ghi mọi thay đổi vào WAL → stream WAL đến Standby → Standby "replay" WAL để có data giống Primary.

### Binlog (MySQL)

Binary Log ghi lại mọi thay đổi data. Source gửi binlog events → Replica nhận qua IO Thread → ghi vào Relay Log → SQL Thread replay.

### Synchronous vs Asynchronous Replication

- **Async**: Primary ghi xong → trả kết quả cho client → replica cập nhật sau. Nhanh nhưng có thể mất data nếu primary crash trước khi replica nhận.
- **Sync**: Primary đợi replica xác nhận đã nhận → mới trả kết quả. Chậm hơn nhưng không mất data.

### Sharding (Phân mảnh)

**Ví dụ:** 1 tủ sách quá lớn → chia thành 10 tủ, mỗi tủ chứa sách theo chữ cái (A-C, D-F...). Query phải biết "data ở tủ nào" để đi đúng chỗ.

- PostgreSQL: Citus extension
- MySQL: Vitess, PlanetScale

### Partitioning (Phân vùng)

Giống sharding nhưng trong CÙNG 1 database. Chia 1 table lớn thành nhiều "partition" nhỏ hơn. Ví dụ: orders chia theo tháng → query tháng 3 chỉ scan partition tháng 3.

---

## 8. Các thuật ngữ khác

### Row-Level Security (RLS) — PostgreSQL only

Database tự động filter data theo user. Dù developer viết `SELECT * FROM orders` (không có WHERE), database tự thêm filter "chỉ trả orders của tenant hiện tại".

**Ví dụ:** Giống Google Drive — bạn chỉ thấy files được share cho bạn, dù folder chứa files của tất cả mọi người.

### Purge Thread (MySQL)

Background thread tự động dọn undo log records khi không còn transaction nào cần đọc version cũ. Giống nhân viên dọn dẹp tự động — không cần gọi thủ công như VACUUM.

### JIT Compilation (Just-In-Time)

PostgreSQL có thể compile query thành machine code lúc chạy (dùng LLVM). Giống như thay vì đọc từng dòng script mỗi lần, compile thành chương trình chạy thẳng → nhanh hơn cho query phức tạp.

### Full-Text Search (Tìm kiếm toàn văn)

Tìm kiếm "thông minh" trong text — hiểu từ đồng nghĩa, bỏ qua từ phổ biến (the, a, is), tìm theo gốc từ (running → run).

- **tsvector**: text đã được "tokenize" (tách từ, chuẩn hóa)
- **tsquery**: câu query tìm kiếm
- **pg_trgm**: tìm kiếm gần đúng (typo-tolerant) bằng trigram (nhóm 3 ký tự)

### OLTP vs OLAP

- **OLTP** (Online Transaction Processing): nhiều transactions nhỏ, nhanh. Ví dụ: app đặt hàng, chuyển tiền.
- **OLAP** (Online Analytical Processing): query phức tạp, scan nhiều data. Ví dụ: báo cáo doanh thu tháng, phân tích xu hướng.

---

## Tóm tắt: Đọc file gốc theo thứ tự nào?

Nếu bạn mới bắt đầu, đọc theo thứ tự này:

1. **Section 1-2** (Tổng quan + Kiến trúc): Hiểu process vs thread, cách data được lưu
2. **Section 6** (Indexing): Hiểu index trước vì nó liên quan đến mọi thứ
3. **Section 3** (MVCC): Đây là phần QUAN TRỌNG NHẤT — cách database xử lý nhiều người dùng cùng lúc
4. **Section 5** (Isolation): Hiểu các mức "an toàn" khi nhiều transaction chạy song song
5. **Section 4** (Locking): Hiểu khi nào database phải "khóa" và hệ quả
6. **Còn lại**: Đọc khi cần, không cần nhớ hết

---

## Tips khi đi phỏng vấn

1. **Không cần nhớ hết** — hiểu CONCEPT quan trọng hơn nhớ chi tiết
2. **3 điểm khác biệt cốt lõi** cần nhớ:
   - MVCC: PostgreSQL giữ versions trong heap (cần VACUUM) vs MySQL giữ trong undo log (tự purge)
   - Locking: PostgreSQL không có Gap Lock vs MySQL dùng Gap Lock (gây deadlock)
   - Serializable: PostgreSQL dùng SSI (optimistic) vs MySQL dùng locking (pessimistic)
3. **Khi được hỏi "chọn cái nào"** → trả lời theo USE CASE, không nói cái nào "tốt hơn"
