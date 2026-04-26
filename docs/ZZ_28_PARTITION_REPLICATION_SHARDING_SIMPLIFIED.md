# Partitioning vs Replication vs Sharding — Giải Thích Siêu Đơn Giản

> Đọc file này một lần để không bao giờ nhầm lẫn nữa.

---

## Tóm Tắt Nhanh (TL;DR)

| Khái niệm | Một câu giải thích | Giải quyết vấn đề gì |
|---|---|---|
| **Partitioning** | Chia một cái bàn to thành nhiều ngăn kéo nhỏ — **trong cùng một căn phòng** | Query chậm vì bảng quá lớn |
| **Replication** | Nhân bản toàn bộ căn phòng ra nhiều bản sao — **mỗi bản sao có đầy đủ mọi thứ** | Server chết thì cả hệ thống chết; quá nhiều người đọc cùng lúc |
| **Sharding** | Chia đồ đạc ra nhiều căn phòng khác nhau — **mỗi phòng chứa một phần khác nhau** | Dữ liệu quá nhiều/ghi quá nhiều cho một server đơn lẻ |

---

## Phần 1: Hình Ảnh Trực Quan

Hãy tưởng tượng bạn có một **thư viện sách khổng lồ**. Dưới đây là 3 cách khác nhau để tổ chức nó:

### Partitioning — Chia Ngăn Trong Cùng Một Kho

```
TRƯỚC KHI Partition:
┌────────────────────────────────────────┐
│          KHO SÁCH (1 server)           │
│                                        │
│  [Sách 2020][Sách 2021][Sách 2022]    │
│  [Sách 2023][Sách 2024][Sách 2025]    │
│  → Tìm sách 2025? Phải lục toàn bộ!  │
└────────────────────────────────────────┘

SAU KHI Partition (Range by năm):
┌────────────────────────────────────────┐
│          KHO SÁCH (vẫn 1 server)       │
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │Ngăn 2020 │  │Ngăn 2021 │           │
│  │(partition│  │(partition│           │
│  │   _2020) │  │   _2021) │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │Ngăn 2024 │  │Ngăn 2025 │           │
│  └──────────┘  └──────────┘           │
│  → Tìm sách 2025? Chỉ mở ngăn 2025!  │
└────────────────────────────────────────┘

KẾT QUẢ: Vẫn 1 server, nhưng query nhanh hơn nhiều
```

### Replication — Nhân Bản Toàn Bộ Kho

```
┌──────────────┐     sao chép     ┌──────────────┐
│  KHO CHÍNH   │ ─────────────→  │  KHO BẢN SAO │
│  (Primary)   │                  │  (Replica 1) │
│              │                  │              │
│ TOÀN BỘ SÁCH│                  │ TOÀN BỘ SÁCH│
│              │ ─────────────→  ┌──────────────┐
│  Chỉ nhận   │                  │  KHO BẢN SAO │
│  GHI mới    │                  │  (Replica 2) │
└──────────────┘                  │              │
                                  │ TOÀN BỘ SÁCH│
                                  └──────────────┘

- Kho Chính: Nhận GHI (INSERT/UPDATE/DELETE)
- Kho Bản Sao: Phục vụ ĐỌC (SELECT)
- Nếu Kho Chính cháy → Bản Sao lên thay thế ngay

KẾT QUẢ: Nhiều server, MỖI server có đầy đủ mọi sách
```

### Sharding — Chia Sách Ra Nhiều Kho Khác Nhau

```
                    ┌──────────────┐
                    │  ROUTER      │
                    │ (Ai tới đây  │
                    │  tôi dẫn    │
                    │  tới kho    │
                    │  phù hợp)   │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │    KHO 1     │ │    KHO 2     │ │    KHO 3     │
  │  (Shard 1)   │ │  (Shard 2)   │ │  (Shard 3)   │
  │              │ │              │ │              │
  │ Sách A → M  │ │ Sách N → S  │ │ Sách T → Z  │
  │              │ │              │ │              │
  │ (1/3 dữ liệu)│ │ (1/3 dữ liệu)│ │ (1/3 dữ liệu)│
  └──────────────┘ └──────────────┘ └──────────────┘

KẾT QUẢ: Nhiều server, MỖI server chỉ có MỘT PHẦN sách
```

---

## Phần 2: Sự Khác Biệt Cốt Lõi

### Câu hỏi nhanh để phân biệt

**Hỏi 1**: Dữ liệu có nằm trên nhiều máy server khác nhau không?
- **KHÔNG** → Đó là **Partitioning** (vẫn 1 server)
- **CÓ** → Tiếp tục câu hỏi 2

**Hỏi 2**: Mỗi server có giống nhau (cùng dữ liệu) không?
- **CÓ** (mỗi server đều có toàn bộ data) → Đó là **Replication**
- **KHÔNG** (mỗi server có phần data riêng) → Đó là **Sharding**

```
Dữ liệu nằm trên nhiều server không?
        │
        ├── KHÔNG ──→ PARTITIONING
        │             (1 server, nhiều ngăn)
        │
        └── CÓ ──→ Mỗi server có data giống nhau không?
                        │
                        ├── CÓ ──→ REPLICATION
                        │          (N servers, cùng data)
                        │
                        └── KHÔNG ──→ SHARDING
                                       (N servers, khác data)
```

### Bảng So Sánh Đầy Đủ

| Tiêu chí | Partitioning | Replication | Sharding |
|---|---|---|---|
| **Số server** | 1 server | Nhiều server | Nhiều server |
| **Data trên mỗi server** | Toàn bộ | Toàn bộ (bản sao) | Chỉ một phần |
| **Mục tiêu chính** | Query nhanh hơn | Không downtime + đọc nhiều | Ghi nhiều + data quá lớn |
| **Scale WRITE** | Không | Không (chỉ 1 server nhận ghi) | Có (mỗi shard nhận ghi) |
| **Scale READ** | Có (pruning) | Có (nhiều replica) | Có (mỗi shard xử lý) |
| **Nếu server chết** | Toàn bộ chết | Replica lên thay | Chỉ 1/N users bị ảnh hưởng |
| **Complexity** | Thấp | Trung bình | Rất cao |
| **ACID transactions** | Đầy đủ | Đầy đủ (trên primary) | Chỉ trong cùng shard |
| **Khi nào dùng** | Bảng lớn, query chậm | Cần HA + read scaling | Server đơn lẻ không đủ |

---

## Phần 3: Mục Đích Thực Sự Của Từng Cái

### Partitioning giải quyết: "Query chậm vì bảng quá to"

**Ví dụ thực tế:** Bảng `Order` có 100 triệu bản ghi. Mỗi lần query đơn hàng tháng 12/2025, database phải quét 100 triệu rows để tìm.

**Sau partitioning:** Tạo partition riêng cho mỗi tháng. Query tháng 12/2025 chỉ quét `orders_2025_12` — vài trăm nghìn rows thay vì 100 triệu.

```
KHÔNG CÓ partition:
SELECT * FROM orders WHERE created_at >= '2025-12-01'
→ Quét 100,000,000 rows... chậm!

CÓ partition (range by month):
SELECT * FROM orders WHERE created_at >= '2025-12-01'
→ PostgreSQL thấy partition key → chỉ quét orders_2025_12
→ 500,000 rows thay vì 100M → nhanh hơn 200 lần!
```

**Partitioning KHÔNG giúp được:**
- Server bị quá tải CPU/RAM → cần Replication/Sharding
- Server chết → cần Replication
- Dữ liệu quá nhiều cho 1 ổ cứng → cần Sharding

---

### Replication giải quyết: "Server chết là toàn bộ ngừng hoạt động" và "Quá nhiều người đọc cùng lúc"

**Ví dụ thực tế 1 — High Availability:**
```
KHÔNG có replication:
  Primary server chết → Website chết → Mất tiền, mất khách hàng

CÓ replication (1 primary + 2 replicas):
  Primary server chết → Replica 1 tự động "lên ngôi" làm Primary mới
  → Downtime: chỉ 10-30 giây, không phải vài tiếng
```

**Ví dụ thực tế 2 — Read Scaling:**
```
E-commerce: 85% traffic là ĐỌC (browse sản phẩm, xem đơn hàng...)
            15% traffic là GHI (đặt hàng, thanh toán...)

KHÔNG có replication:
  Primary server gánh cả 1,500 reads/giây + 200 writes/giây
  → Quá tải → Chậm → User tức giận

CÓ replication (1 primary + 2 replicas):
  Primary: chỉ xử lý 200 writes/giây
  Replica 1: xử lý 750 reads/giây
  Replica 2: xử lý 750 reads/giây
  → Primary được "giải phóng" → Mọi thứ nhanh hơn
```

**Replication KHÔNG giúp được:**
- Quá nhiều WRITE (vẫn chỉ 1 primary nhận write) → cần Sharding
- Dữ liệu quá nhiều cho 1 server → cần Sharding

---

### Sharding giải quyết: "1 server đã to nhất vẫn không đủ"

**Ví dụ thực tế:**
```
Shopee/Lazada ở mức enterprise:
  - 100 triệu users
  - 500 triệu đơn hàng
  - 20,000 writes/giây (flash sale)
  - Database size: 10 TB

→ Máy chủ to nhất thế giới (128 CPU, 4TB RAM) vẫn không đủ!
→ Giải pháp: Chia data ra 16 shards, mỗi shard ~625 GB
→ Flash sale 20,000 writes/giây = mỗi shard chịu 1,250 writes/giây (dễ thở hơn)
```

**Sharding KHÔNG phải lúc nào cũng cần:**
```
Dự án của bạn hiện tại (NestJS Ecommerce API):
  - ~3.6M đơn hàng sau 3 năm
  - ~50-100 GB database
  - ~200 writes/giây
  
→ CHƯA CẦN SHARDING
→ Partitioning + Replication là quá đủ
→ Sharding sẽ làm code phức tạp không cần thiết
```

---

## Phần 4: Hiểu Sâu Hơn — Điều Gì Xảy Ra Bên Trong

### Partitioning — Bên Trong PostgreSQL

```
Từ góc nhìn application: Bạn chỉ biết có 1 bảng "Order"
Từ góc nhìn PostgreSQL: Thực ra là nhiều bảng con

                Application
                    │
                    ▼
           ┌────────────────┐
           │   Bảng "Order" │  ← Application query vào đây
           │  (parent table)│
           └────────┬───────┘
                    │ PostgreSQL tự quyết định
                    │ đọc/ghi vào partition nào
           ┌────────┼────────┐
           ▼        ▼        ▼
    ┌──────────┐ ┌──────┐ ┌──────────┐
    │Order_2025│ │Order │ │Order_2024│
    │   _12    │ │_2025 │ │   _01    │
    │          │ │ _11  │ │          │
    └──────────┘ └──────┘ └──────────┘
    
Khi query: WHERE created_at >= '2025-12-01'
PostgreSQL: "Ồ, partition key là created_at,
             chỉ cần đọc Order_2025_12 thôi"
            → Partition Pruning (loại bỏ partitions không cần thiết)
```

### Replication — Cơ Chế WAL Streaming

```
WAL = Write-Ahead Log = Nhật ký ghi lại mọi thay đổi

User → INSERT INTO orders... → PRIMARY
                                  │
                          1. Ghi vào WAL
                          2. Apply vào data
                          3. Gửi WAL stream
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                REPLICA 1     REPLICA 2     REPLICA 3
                    │             │             │
              Nhận WAL       Nhận WAL       Nhận WAL
              Replay WAL     Replay WAL     Replay WAL
              (data giống    (data giống    (data giống
               primary)       primary)       primary)

Replication Lag = thời gian từ lúc Primary commit
                  đến lúc Replica apply xong
                = thường chỉ vài milliseconds
```

### Sharding — Shard Router Quyết Định Đi Đâu

```
Application → Shard Router → Shard nào?
                  │
                  │  Logic: shard_id = hash(user_id) % 4
                  │
    user_id=100 → hash=... % 4 = 2 → Shard 2
    user_id=200 → hash=... % 4 = 0 → Shard 0
    user_id=300 → hash=... % 4 = 1 → Shard 1

Query: "Xem đơn hàng của user 100"
  → Router: user 100 → Shard 2
  → Query CHỈ đến Shard 2
  → Nhanh! (Shard 2 chỉ có 25% tổng data)

Query: "Top 10 sản phẩm bán chạy nhất" (KHÔNG có user_id)
  → Router: Không biết shard nào, phải hỏi TẤT CẢ
  → Scatter: Gửi query đến Shard 0, 1, 2, 3 cùng lúc
  → Gather: Thu kết quả, merge lại, sort lại
  → Chậm hơn! (Scatter-Gather)
```

---

## Phần 5: Replication Lag — "Cái Bẫy Tinh Vi"

Đây là khái niệm hay bị hiểu nhầm nhất trong Replication.

```
Scenario thực tế:
  T0: User A đặt hàng → INSERT vào PRIMARY
  T1: PRIMARY commit → Trả về "Đặt hàng thành công!"
  T2: User A click vào "Đơn hàng của tôi" → Query đến REPLICA
  T3: REPLICA chưa nhận WAL xong → Không thấy đơn hàng!

  User: "Vừa đặt hàng mà sao không thấy???" 😡
```

**Giải pháp: Read-Your-Writes Consistency**

```typescript
// Sau khi user ghi → đánh dấu vào cache
await cache.set(`recent_write:${userId}:order`, true, 5_000); // TTL 5 giây

// Khi user đọc → kiểm tra xem họ vừa ghi chưa
const recentWrite = await cache.get(`recent_write:${userId}:order`);
if (recentWrite) {
  // Đọc từ PRIMARY để đảm bảo thấy data vừa ghi
  return primaryDb.order.findMany({ where: { userId } });
} else {
  // Đọc từ REPLICA (đã sync xong)
  return replicaDb.order.findMany({ where: { userId } });
}
```

**Synchronous vs Asynchronous Replication:**

```
Asynchronous (mặc định):
  PRIMARY commit ngay → trả response → Sau đó mới gửi WAL cho replica
  
  Ưu điểm: Nhanh (không đợi replica)
  Nhược điểm: Nếu primary chết ngay sau commit → data mất!
  Dùng cho: Product views, cart browsing, search

Synchronous:
  PRIMARY gửi WAL cho replica → Đợi replica ACK → Rồi mới commit → Trả response
  
  Ưu điểm: KHÔNG mất data dù primary chết ngay lập tức
  Nhược điểm: Mỗi write chậm hơn (thêm network roundtrip)
  Dùng cho: Payment transactions, financial data

Timeline minh họa:
  Async:  [Client Write] → [Primary WAL] → [Primary COMMIT ✓] ~~> [Replica Apply]
  Sync:   [Client Write] → [Primary WAL] → [Replica WAL] → [Replica ACK] → [Primary COMMIT ✓]
```

---

## Phần 6: Cross-Shard Challenges — "Cái Đau Đầu Của Sharding"

Đây là lý do tại sao Sharding là "giải pháp cuối cùng":

### ACID Transactions bị phá vỡ

```
Trong 1 database:
  BEGIN;
    UPDATE accounts SET balance = balance - 100 WHERE user_id = 42; -- Ghi OK
    UPDATE accounts SET balance = balance + 100 WHERE user_id = 17; -- Ghi OK
  COMMIT; -- Hoặc ROLLBACK cả 2
  → ATOMIC: hoặc cả 2 thành công, hoặc cả 2 thất bại

Với Sharding (user 42 ở Shard 1, user 17 ở Shard 3):
  → Shard 1 và Shard 3 là 2 database server KHÁC NHAU
  → Không thể COMMIT/ROLLBACK cùng lúc trên 2 server!
  → Nếu Shard 1 thành công nhưng Shard 3 thất bại → Mất 100 đồng!
```

**Giải pháp: Saga Pattern**

```
Thay vì 1 transaction lớn cross-shard:
→ Chia thành nhiều local transactions nhỏ
→ Mỗi step có compensating transaction (bước hoàn tác nếu lỗi)

Order Payment Saga:
  Step 1: Trừ tiền ví user (Shard của user)
    → Thành công → tiếp tục Step 2
    → Thất bại → DONE (không có gì để hoàn tác)

  Step 2: Xử lý payment (Payment Service)
    → Thành công → tiếp tục Step 3
    → Thất bại → COMPENSATE: Hoàn tiền ví (Step 1 ngược lại)

  Step 3: Cập nhật trạng thái đơn hàng (Shard của user)
    → Thành công → DONE
    → Thất bại → COMPENSATE: Hoàn tiền ví + Hủy payment
```

### Cross-Shard Queries phải Scatter-Gather

```
Query: "Tổng doanh thu tháng này" (không có shard key)

Shard Router:
  → Gửi query đến Shard 0, 1, 2, 3 ĐỒNG THỜI
  → Đợi tất cả trả kết quả (latency = max của các shards)
  → Merge: tổng hợp, cộng lại, sort lại
  → Trả về client

Giải pháp tốt hơn: CQRS (Command Query Responsibility Segregation)
  → Mỗi khi có đơn hàng mới → Gửi event đến Analytics DB (không sharded)
  → Query analytics → Chỉ đến Analytics DB (1 query, nhanh)
  → Analytics DB có thể lag 1-2 giây so với shards (chấp nhận được)
```

---

## Phần 7: Kết Hợp Cả 3 — Real-World Production

Trong thực tế, các hệ thống lớn dùng cả 3 cùng lúc:

```
Hệ thống E-commerce cỡ enterprise:

Shard 1 (Users 0 → 999,999):
├── PRIMARY Server
│   ├── Bảng "Order" được PARTITIONED theo tháng
│   │   ├── orders_2025_10
│   │   ├── orders_2025_11
│   │   └── orders_2025_12
│   └── Bảng "User" (chỉ users có ID 0-999,999)
├── REPLICA 1 (Read scaling, HA)
└── REPLICA 2 (Reporting, DR)

Shard 2 (Users 1,000,000 → 1,999,999):
├── PRIMARY Server
│   ├── Bảng "Order" (PARTITIONED)
│   └── Bảng "User" (chỉ users có ID 1M-2M)
├── REPLICA 1
└── REPLICA 2

Shard 3 (Users 2,000,000+):
├── PRIMARY Server
│   └── ...tương tự...
└── ...

Tóm lại:
  SHARDING → Chia data theo user_id ra 3 server riêng biệt
  PARTITIONING → Chia bảng Order to ra theo tháng trong mỗi shard
  REPLICATION → Mỗi shard có 2 replicas để HA và read scaling
```

---

## Phần 8: Khi Nào Dùng Cái Gì — Decision Checklist

### Bắt đầu với Partitioning khi:

```
□ Bảng của bạn có hơn vài chục triệu rows
□ Query chậm dù đã có index tốt
□ Phần lớn queries đều có thể filter theo một tiêu chí rõ ràng
  (ví dụ: theo ngày, theo user_id, theo status)
□ Cần xóa data cũ nhanh (DROP PARTITION thay vì DELETE millions rows)
□ Còn ở trên 1 server duy nhất
```

### Thêm Replication khi:

```
□ Uptime của hệ thống quan trọng (không được chết quá lâu)
□ Tỷ lệ đọc/ghi > 3:1 (nhiều reads hơn writes)
□ Muốn chạy analytics/reporting mà không ảnh hưởng production
□ Cần backup realtime ở region khác
□ Server hiện tại vẫn đủ capacity, chỉ cần high availability
```

### Xem xét Sharding khi (và CHỈ khi):

```
□ Đã thử hết: index tốt + query optimization
□ Đã thử: Read replicas + caching (Redis)
□ Đã thử: Vertical scaling (máy to hơn)
□ Đã thử: Table partitioning
□ VÀ vẫn không đủ vì:
  □ Write throughput > 10,000-20,000 TPS
  □ Database size > 2-5 TB
  □ Máy chủ lớn nhất vẫn không đủ

Sharding là GIẢI PHÁP CUỐI CÙNG — nó thêm permanent complexity
vào hệ thống, nên chỉ dùng khi thực sự cần.
```

---

## Phần 9: Áp Dụng Cho Dự Án Hiện Tại

### Trạng thái hiện tại (NestJS Ecommerce API)

```
Ước tính sau 3 năm hoạt động:
  - Orders:           ~3.6M rows
  - Database size:    ~50-100 GB
  - Peak Write TPS:   ~200
  - Peak Read TPS:    ~1,500

→ CẦN: Partitioning (cho các bảng lớn)
→ CẦN: Replication (cho HA + read scaling)
→ KHÔNG CẦN: Sharding (data nhỏ, write ít)
```

### Roadmap Thực Tế

```
Giai đoạn 1 — Ngay bây giờ:
  Partitioning cho:
    - Bảng Order → Range by created_at (monthly)
    - Bảng PaymentTransaction → Range by transactionDate (monthly)
    - Bảng ProductSKUSnapshot → Range by createdAt (monthly)

Giai đoạn 2 — Khi có traffic thực:
  Replication:
    - 1 Primary (nhận writes)
    - 2 Replicas (phân tải reads, HA failover)
    - Implement Read/Write splitting trong code

Giai đoạn 3 — Nếu scale lên 100x (enterprise level):
  Sharding:
    - Shard key: user_id
    - Dùng Citus extension cho PostgreSQL
    - Co-locate: Orders + CartItems + Reviews của cùng user → cùng shard
    - Reference tables (Brand, Category, Language) → Replicate tới tất cả shards
```

---

## Phần 10: Tổng Kết — Bảng Nhớ Nhanh

```
╔══════════════════╦══════════════════╦══════════════════╦══════════════════╗
║                  ║   PARTITIONING   ║   REPLICATION    ║     SHARDING     ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Ẩn dụ           ║ Ngăn kéo trong   ║ Nhân bản toàn    ║ Chia đồ đạc ra   ║
║                  ║ cùng 1 căn phòng ║ bộ căn phòng     ║ nhiều phòng      ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Số server        ║ 1                ║ Nhiều (bản sao)  ║ Nhiều (khác data)║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Giải quyết       ║ Query chậm       ║ Server chết /    ║ 1 server         ║
║                  ║ vì bảng lớn      ║ quá nhiều reads  ║ không đủ         ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Write scaling    ║ KHÔNG            ║ KHÔNG            ║ CÓ               ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Read scaling     ║ CÓ (pruning)     ║ CÓ (replicas)    ║ CÓ (per shard)   ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Availability     ║ Không cải thiện  ║ CẢI THIỆN (HA)   ║ Fault isolation  ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Complexity       ║ THẤP             ║ TRUNG BÌNH       ║ RẤT CAO          ║
╠══════════════════╬══════════════════╬══════════════════╬══════════════════╣
║ Khi nào dùng     ║ Bảng > vài       ║ Cần HA +         ║ CHỈ KHI đã thử  ║
║                  ║ chục triệu rows  ║ read scaling     ║ hết các cách khác║
╚══════════════════╩══════════════════╩══════════════════╩══════════════════╝
```

### Câu Thần Chú Để Nhớ

> **Partitioning** = Tổ chức lại trong 1 nhà  
> **Replication** = Nhân bản nhiều ngôi nhà giống hệt nhau  
> **Sharding** = Chia tài sản ra ở nhiều ngôi nhà khác nhau

---

*Tài liệu này được tổng hợp từ:*
- *`ZZ_26_DATABASE_PARTITIONING_COMPLETE_GUIDE.md`*
- *`ZZ_27_1_DATABASE_REPLICATION_COMPLETE_GUIDE.md`*
- *`ZZ_27_2_DATABASE_SHARDING_COMPLETE_GUIDE.md`*
