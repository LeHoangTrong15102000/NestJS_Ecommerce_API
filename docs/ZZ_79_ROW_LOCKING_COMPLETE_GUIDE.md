# 🔒 ROW LOCKING — Hướng Dẫn Toàn Diện Cho Backend Developer

> **Tài liệu này giải thích chi tiết về Row Locking (Khóa hàng) trong PostgreSQL, kết hợp phân tích source code NestJS Ecommerce API và kiến thức từ các chuyên gia hàng đầu.**

---

## 📋 MỤC LỤC

1. [Row Locking Là Gì? Tại Sao Cần?](#1-row-locking-là-gì-tại-sao-cần)
2. [4 Loại Row Lock Trong PostgreSQL](#2-4-loại-row-lock-trong-postgresql)
3. [Pessimistic Locking vs Optimistic Locking](#3-pessimistic-locking-vs-optimistic-locking)
4. [Atomic Update — Giải Pháp Thứ 3 (Tốt Nhất Cho Nhiều Trường Hợp)](#4-atomic-update--giải-pháp-thứ-3)
5. [Cách Implement Với Prisma ORM + NestJS](#5-cách-implement-với-prisma-orm--nestjs)
6. [Phân Tích Source Code Ecommerce API Hiện Tại](#6-phân-tích-source-code-ecommerce-api-hiện-tại)
7. [Deadlock — Nguyên Nhân và Cách Phòng Tránh](#7-deadlock--nguyên-nhân-và-cách-phòng-tránh)
8. [Distributed Locking Với Redis](#8-distributed-locking-với-redis)
9. [Monitoring & Debug Lock Trong PostgreSQL](#9-monitoring--debug-lock-trong-postgresql)
10. [Bảng So Sánh Tổng Hợp — Khi Nào Dùng Gì?](#10-bảng-so-sánh-tổng-hợp)
11. [Câu Hỏi Phỏng Vấn Thường Gặp](#11-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. ROW LOCKING LÀ GÌ? TẠI SAO CẦN?

### 1.1 Định Nghĩa

**Row Locking** (Khóa hàng) là cơ chế kiểm soát đồng thời (concurrency control) trong database, cho phép **khóa từng dòng dữ liệu riêng lẻ** để ngăn các transaction khác đọc hoặc sửa đổi dòng đó theo cách gây xung đột.

### 1.2 Tại Sao Cần Row Locking?

Hãy tưởng tượng tình huống thực tế trong hệ thống e-commerce:

```
Sản phẩm iPhone 16 Pro — Tồn kho: 1 chiếc

Thời điểm T1: User A đọc stock = 1 ✅
Thời điểm T2: User B đọc stock = 1 ✅ (chưa bị trừ!)
Thời điểm T3: User A trừ stock → stock = 0 ✅
Thời điểm T4: User B trừ stock → stock = -1 ❌ OVERSELLING!

Kết quả: Cả 2 người đều mua được, nhưng chỉ có 1 chiếc!
```

Đây chính là **Race Condition** — vấn đề kinh điển khi nhiều transaction cùng truy cập một dòng dữ liệu.

### 1.3 Row Lock vs Table Lock

| Đặc điểm | Row Lock | Table Lock |
|-----------|----------|------------|
| Phạm vi | Chỉ khóa 1 dòng | Khóa toàn bộ bảng |
| Concurrency | Cao — các dòng khác vẫn truy cập được | Thấp — chặn mọi truy cập |
| Performance | Tốt cho OLTP | Chỉ dùng cho DDL, maintenance |
| Use case | UPDATE, DELETE cụ thể | ALTER TABLE, VACUUM FULL |

**PostgreSQL sử dụng MVCC** (Multi-Version Concurrency Control), nghĩa là:
- `SELECT` bình thường **KHÔNG BAO GIỜ** bị block bởi `UPDATE`
- `UPDATE` **KHÔNG BAO GIỜ** block `SELECT` bình thường
- Row lock chỉ block các **writer khác** và các **explicit lock** trên cùng dòng

### 1.4 Khi Nào Cần Row Locking?

- ✅ Trừ tồn kho khi đặt hàng (inventory decrement)
- ✅ Chuyển tiền giữa các tài khoản (bank transfer)
- ✅ Đặt chỗ/đặt vé (seat reservation)
- ✅ Xử lý thanh toán (payment processing)
- ✅ Flash sale với số lượng giới hạn
- ✅ Bất kỳ thao tác **đọc → tính toán → ghi** mà kết quả ghi phụ thuộc vào giá trị đọc

---

## 2. 4 LOẠI ROW LOCK TRONG POSTGRESQL

PostgreSQL có chính xác **4 loại row-level lock**, từ yếu nhất đến mạnh nhất:

### 2.1 Bảng Xung Đột (Conflict Matrix)

| Yêu cầu ↓ \ Đang giữ → | FOR KEY SHARE | FOR SHARE | FOR NO KEY UPDATE | FOR UPDATE |
|--------------------------|:---:|:---:|:---:|:---:|
| **FOR KEY SHARE** | ✅ | ✅ | ✅ | ❌ |
| **FOR SHARE** | ✅ | ✅ | ❌ | ❌ |
| **FOR NO KEY UPDATE** | ✅ | ❌ | ❌ | ❌ |
| **FOR UPDATE** | ❌ | ❌ | ❌ | ❌ |

> ✅ = Tương thích (cả 2 có thể giữ cùng lúc)
> ❌ = Xung đột (phải đợi)


### 2.2 FOR UPDATE — Khóa Độc Quyền (Mạnh Nhất)

```sql
SELECT * FROM "Product" WHERE id = 1 FOR UPDATE;
```

**Đặc điểm:**
- Block **TẤT CẢ** các loại lock khác trên cùng dòng
- Block `UPDATE`, `DELETE`, và mọi `SELECT FOR ...` trên cùng dòng
- Tự động được acquire bởi `DELETE` và `UPDATE` thay đổi cột trong unique/FK index

**Khi nào dùng:** Khi bạn cần đọc một dòng, tính toán, rồi ghi lại — và **không ai khác được chạm vào** dòng đó trong lúc bạn đang xử lý.

**Ví dụ thực tế:** Trừ tồn kho khi đặt hàng

```sql
BEGIN;
SELECT stock, price FROM "SKU" WHERE id = 42 FOR UPDATE;
-- Dòng bị khóa, mọi transaction khác phải ĐỢI

-- Kiểm tra stock an toàn (vì đã khóa)
-- Nếu stock >= quantity → trừ stock
UPDATE "SKU" SET stock = stock - 1 WHERE id = 42;
COMMIT;
-- Giải phóng lock, transaction tiếp theo mới được chạy
```

### 2.3 FOR NO KEY UPDATE — Khóa Gần Độc Quyền

```sql
SELECT * FROM "Product" WHERE id = 1 FOR NO KEY UPDATE;
```

**Đặc điểm:**
- Yếu hơn `FOR UPDATE` — cho phép `FOR KEY SHARE` cùng tồn tại
- Tự động được acquire bởi `UPDATE` **KHÔNG** thay đổi cột key (unique/FK)
- Block `FOR SHARE`, `FOR NO KEY UPDATE`, và `FOR UPDATE`

**Khi nào dùng:** Update các cột không phải key (ví dụ: update `name`, `description`) trong khi vẫn cho phép foreign key check chạy song song.

**Ví dụ:** PostgreSQL tự động dùng loại lock này khi bạn chạy:
```sql
UPDATE "Product" SET name = 'iPhone 16 Pro Max' WHERE id = 1;
-- Chỉ update cột name (không phải key) → FOR NO KEY UPDATE
-- Các transaction khác vẫn có thể check FK reference đến Product id=1
```

### 2.4 FOR SHARE — Khóa Chia Sẻ

```sql
SELECT * FROM "Product" WHERE id = 1 FOR SHARE;
```

**Đặc điểm:**
- **Shared lock** — nhiều transaction có thể giữ `FOR SHARE` trên cùng dòng cùng lúc
- Block `UPDATE`, `DELETE`, `FOR UPDATE`, và `FOR NO KEY UPDATE`
- **KHÔNG** block `FOR SHARE` hoặc `FOR KEY SHARE` khác

**Khi nào dùng:** Đảm bảo dòng tham chiếu không bị xóa/sửa trong khi bạn đang đọc.

**Ví dụ:** Kiểm tra Brand tồn tại trước khi tạo Product

```sql
BEGIN;
-- Đảm bảo Brand không bị xóa trong lúc tạo Product
SELECT * FROM "Brand" WHERE id = 5 FOR SHARE;

-- An toàn tạo Product vì Brand chắc chắn vẫn tồn tại
INSERT INTO "Product" ("brandId", name) VALUES (5, 'New Product');
COMMIT;
```

### 2.5 FOR KEY SHARE — Khóa Yếu Nhất

```sql
SELECT * FROM "Product" WHERE id = 1 FOR KEY SHARE;
```

**Đặc điểm:**
- Chỉ block `FOR UPDATE` (và `DELETE` / key-modifying `UPDATE`)
- Cho phép `FOR SHARE`, `FOR NO KEY UPDATE`, và `FOR KEY SHARE` cùng tồn tại
- PostgreSQL **tự động** sử dụng khi kiểm tra foreign key

**Khi nào dùng:** Hiếm khi dùng trực tiếp. PostgreSQL dùng nội bộ cho FK checks.

### 2.6 Biến Thể Quan Trọng: NOWAIT và SKIP LOCKED

#### FOR UPDATE NOWAIT — Thất Bại Ngay Thay Vì Đợi

```sql
SELECT * FROM "Product" WHERE id = 1 FOR UPDATE NOWAIT;
-- Nếu dòng đang bị lock → LỖI NGAY LẬP TỨC (error 55P03)
-- Không đợi, không block
```

**Use case:** Khi bạn muốn fail fast thay vì để user đợi.

#### FOR UPDATE SKIP LOCKED — Bỏ Qua Dòng Đang Bị Khóa

```sql
SELECT * FROM "Order"
WHERE status = 'PENDING'
ORDER BY "createdAt" ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- Bỏ qua các dòng đang bị lock, lấy dòng tiếp theo chưa bị lock
```

**Use case:** Job queue pattern — nhiều worker xử lý song song, mỗi worker lấy task chưa bị lock.

---

## 3. PESSIMISTIC LOCKING VS OPTIMISTIC LOCKING

### 3.1 Pessimistic Locking (Khóa Bi Quan)

> "Tôi **GIẢ ĐỊNH** xung đột **SẼ XẢY RA**, nên tôi khóa dòng ngay từ đầu."

**Cách hoạt động:**

```
User A:                              User B:
BEGIN;                               BEGIN;
SELECT ... FOR UPDATE; 🔒            SELECT ... FOR UPDATE;
-- Đọc stock = 1                     -- ⏳ ĐANG ĐỢI (bị block)
-- Kiểm tra: 1 >= 1 ✅               --
UPDATE stock = 0;                    --
COMMIT; 🔓                           -- 🔒 Bây giờ mới được đọc
                                     -- Đọc stock = 0
                                     -- Kiểm tra: 0 >= 1 ❌
                                     -- Throw: "Hết hàng!"
                                     ROLLBACK; 🔓
```

**Ưu điểm:**
- ✅ Đảm bảo 100% tính chính xác
- ✅ Logic đơn giản, dễ hiểu
- ✅ Không cần retry logic

**Nhược điểm:**
- ❌ Hiệu suất thấp khi traffic cao (các transaction phải xếp hàng đợi)
- ❌ Có thể xảy ra deadlock
- ❌ User B phải đợi User A hoàn thành

### 3.2 Optimistic Locking (Khóa Lạc Quan)

> "Tôi **GIẢ ĐỊNH** xung đột **HIẾM KHI XẢY RA**, nên tôi chỉ kiểm tra lúc ghi."

**Cách hoạt động:**

```
User A:                              User B:
Đọc: stock=1, version=5             Đọc: stock=1, version=5

UPDATE ... WHERE version=5;          UPDATE ... WHERE version=5;
-- ✅ Thành công! version → 6        -- ❌ 0 rows affected (version đã là 6)
                                     -- Retry lần 1...
                                     -- Đọc lại: stock=0, version=6
                                     -- Kiểm tra: 0 >= 1 ❌
                                     -- Throw: "Hết hàng!"
```

**Ưu điểm:**
- ✅ Hiệu suất cao (không block)
- ✅ Scalability tốt
- ✅ Không có deadlock

**Nhược điểm:**
- ❌ Cần retry logic (phức tạp hơn)
- ❌ Khi conflict nhiều → retry storm → performance tệ
- ❌ Không phù hợp cho flash sale (100 người cùng mua 1 sản phẩm)

### 3.3 Bảng So Sánh Chi Tiết

| Tiêu chí | Pessimistic (FOR UPDATE) | Optimistic (version field) |
|-----------|:---:|:---:|
| **Concurrency** | Thấp — block transaction khác | Cao — không block |
| **Tỷ lệ conflict cao** | ✅ Xử lý tốt | ❌ Retry storm |
| **Tỷ lệ conflict thấp** | ❌ Overkill | ✅ Hoàn hảo |
| **Độ phức tạp code** | Đơn giản | Cần retry logic |
| **Deadlock risk** | Có | Không |
| **Flash sale (100 user, 5 item)** | ✅ Serialize access | ❌ Massive retries |
| **Update profile user** | ❌ Overkill | ✅ Hiếm conflict |
| **Payment processing** | ✅ An toàn tuyệt đối | ⚠️ Rủi ro cho tài chính |
| **Inventory decrement** | ✅ Ngăn overselling | ⚠️ Cần retry cẩn thận |
| **Cart update** | ❌ Mỗi user 1 cart | ✅ Không conflict |

### 3.4 Quy Tắc Vàng

> **Dùng Pessimistic khi:** Chi phí xung đột CAO (tiền bạc, tồn kho giới hạn, dữ liệu tài chính)
>
> **Dùng Optimistic khi:** Xung đột HIẾM và retry RẺ (profile, settings, content editing)

---

## 4. ATOMIC UPDATE — GIẢI PHÁP THỨ 3

Ngoài Pessimistic và Optimistic, còn có **Atomic Update** — giải pháp đơn giản nhất và thường là tốt nhất cho nhiều trường hợp.

### 4.1 Nguyên Lý

Thay vì **đọc → kiểm tra → ghi** (2 bước, có khoảng trống cho race condition), ta gộp tất cả vào **1 câu SQL duy nhất**:

```sql
-- ATOMIC: Không có khoảng trống giữa check và update
UPDATE "Product"
SET stock = stock - 1
WHERE id = 1
AND stock >= 1;  -- Chỉ update nếu đủ hàng
```

**Tại sao an toàn?**
- PostgreSQL tự động acquire **row-level exclusive lock** khi thực thi `UPDATE`
- Câu `WHERE stock >= 1` và `SET stock = stock - 1` được thực thi **atomic** (không thể bị chen ngang)
- Nếu `stock < 1` → 0 rows affected → biết ngay là hết hàng
- **Không cần** `FOR UPDATE` explicit vì `UPDATE` tự lock

### 4.2 So Sánh 3 Giải Pháp

```
Pessimistic:  SELECT ... FOR UPDATE → check → UPDATE → COMMIT
              (2 round-trips, explicit lock)

Optimistic:   SELECT → check → UPDATE WHERE version=X → retry nếu fail
              (2+ round-trips, no lock, cần retry)

Atomic:       UPDATE ... WHERE condition → check affected rows
              (1 round-trip, implicit lock, đơn giản nhất)
```

| Tiêu chí | Pessimistic | Optimistic | Atomic Update |
|-----------|:---:|:---:|:---:|
| Số round-trips | 2 | 2+ (retry) | 1 |
| Explicit lock | Có | Không | Không (implicit) |
| Retry logic | Không | Có | Không |
| Phức tạp | Trung bình | Cao | **Thấp nhất** |
| Performance | Trung bình | Cao (low conflict) | **Cao nhất** |
| Khi nào dùng | Cần đọc trước khi quyết định | Conflict hiếm | **Mặc định nên dùng** |

### 4.3 Khi Nào KHÔNG Dùng Được Atomic Update?

Atomic Update **không phù hợp** khi:
- Cần đọc nhiều cột để tính toán phức tạp trước khi update
- Logic business phức tạp (ví dụ: kiểm tra nhiều điều kiện từ nhiều bảng)
- Cần trả về giá trị cũ trước khi update

Trong những trường hợp đó, dùng **Pessimistic Locking** (`FOR UPDATE`).

---

## 5. CÁCH IMPLEMENT VỚI PRISMA ORM + NESTJS

### 5.1 Vấn Đề: Prisma Không Hỗ Trợ FOR UPDATE Native

Prisma **KHÔNG CÓ** clause `FOR UPDATE` trong query builder. Bạn **không thể** viết:

```typescript
// ❌ KHÔNG TỒN TẠI trong Prisma API
await prisma.product.findUnique({
  where: { id: 1 },
  forUpdate: true, // ← Không có option này!
})
```

**Giải pháp:** Dùng `$queryRaw` và `$executeRaw` bên trong **Interactive Transaction**.

### 5.2 Interactive Transaction — Nền Tảng Của Mọi Thứ

Prisma cung cấp 2 loại transaction:

| Loại | Cú pháp | Khi nào dùng |
|------|---------|-------------|
| **Sequential** | `prisma.$transaction([query1, query2])` | Nhiều query độc lập, không cần logic giữa chúng |
| **Interactive** | `prisma.$transaction(async (tx) => { ... })` | Cần logic phức tạp, cần đọc rồi ghi, cần row lock |

**Interactive Transaction** là loại bạn sẽ dùng cho row locking:

```typescript
const result = await this.prismaService.$transaction(async (tx) => {
  // tx là một Prisma client đặc biệt — mọi query qua tx đều nằm trong cùng 1 transaction
  // Khi function kết thúc → COMMIT
  // Khi throw error → ROLLBACK

  const product = await tx.product.findUnique({ where: { id: 1 } })
  // ... logic ...
  await tx.product.update({ where: { id: 1 }, data: { stock: { decrement: 1 } } })

  return product
}, {
  maxWait: 5000,   // Tối đa 5s đợi lấy connection từ pool
  timeout: 10000,  // Tối đa 10s cho toàn bộ transaction (sau đó auto ROLLBACK)
})
```

**⚠️ Quan trọng:** `maxWait` và `timeout` là **safety net** — nếu transaction chạy quá lâu (ví dụ: deadlock), Prisma tự động rollback thay vì treo mãi.

### 5.3 `$queryRaw` + FOR UPDATE — Pessimistic Locking

Khi cần **đọc dữ liệu VÀ khóa dòng** cùng lúc:

```typescript
// Ví dụ: Mua sản phẩm với pessimistic locking
async buyProduct(userId: number, skuId: number, quantity: number) {
  return this.prismaService.$transaction(async (tx) => {
    // Bước 1: SELECT + LOCK dòng SKU
    const [sku] = await tx.$queryRaw<SKUType[]>`
      SELECT id, stock, price
      FROM "SKU"
      WHERE id = ${skuId}
      AND "deletedAt" IS NULL
      FOR UPDATE
    `
    // ↑ Từ thời điểm này, mọi transaction khác SELECT ... FOR UPDATE
    //   trên cùng dòng SKU sẽ phải ĐỢI cho đến khi transaction này COMMIT/ROLLBACK

    if (!sku) throw new NotFoundException('SKU not found')
    if (sku.stock < quantity) throw new BadRequestException('Insufficient stock')

    // Bước 2: Update an toàn (vì đã lock, không ai chen ngang được)
    await tx.sKU.update({
      where: { id: skuId },
      data: { stock: { decrement: quantity } },
    })

    // Bước 3: Tạo order
    return tx.order.create({
      data: { userId, /* ... */ },
    })
  }) // ← COMMIT ở đây → giải phóng lock
}
```

**Lưu ý về `$queryRaw`:**
- Trả về **mảng** (luôn luôn), kể cả khi chỉ có 1 dòng → dùng destructuring `const [row] = ...`
- Dùng **tagged template literal** (backtick) để tự động parameterize → **an toàn SQL injection**
- Tên bảng và cột phải dùng **double quotes** theo convention PostgreSQL: `"SKU"`, `"deletedAt"`

### 5.4 `$executeRaw` — Atomic Update (Không Cần Explicit Lock)

Khi chỉ cần **update có điều kiện** mà không cần đọc trước:

```typescript
// Ví dụ: Trừ stock atomic — KHÔNG cần FOR UPDATE
async decrementStock(skuId: number, quantity: number): Promise<boolean> {
  const rowsAffected = await this.prismaService.$executeRaw`
    UPDATE "SKU"
    SET stock = stock - ${quantity},
        "updatedAt" = NOW()
    WHERE id = ${skuId}
    AND stock >= ${quantity}
    AND "deletedAt" IS NULL
  `
  return rowsAffected > 0  // false = hết hàng hoặc không tìm thấy
}
```

**Khác biệt `$queryRaw` vs `$executeRaw`:**

| | `$queryRaw` | `$executeRaw` |
|---|---|---|
| **Trả về** | Mảng dữ liệu (rows) | Số dòng bị ảnh hưởng (number) |
| **Dùng cho** | SELECT, SELECT ... FOR UPDATE | UPDATE, DELETE, INSERT |
| **Khi nào** | Cần đọc dữ liệu | Chỉ cần thay đổi dữ liệu |

### 5.5 FOR UPDATE NOWAIT & SKIP LOCKED Với Prisma

#### NOWAIT — Fail Fast

```typescript
// Ví dụ: Thử mua sản phẩm, nếu đang bị lock → báo lỗi ngay
async tryBuyProduct(skuId: number, quantity: number) {
  return this.prismaService.$transaction(async (tx) => {
    try {
      const [sku] = await tx.$queryRaw<SKUType[]>`
        SELECT id, stock, price
        FROM "SKU"
        WHERE id = ${skuId}
        FOR UPDATE NOWAIT
      `
      // Nếu dòng đang bị lock → PostgreSQL throw error 55P03 ngay lập tức
      // Không đợi, không block

      if (!sku || sku.stock < quantity) {
        throw new BadRequestException('Insufficient stock')
      }

      await tx.$executeRaw`
        UPDATE "SKU" SET stock = stock - ${quantity} WHERE id = ${skuId}
      `
      return sku
    } catch (error) {
      // Error 55P03: could_not_obtain_lock
      if (error.code === '55P03' || error.message?.includes('could not obtain lock')) {
        throw new ConflictException('Sản phẩm đang được xử lý bởi người khác. Vui lòng thử lại.')
      }
      throw error
    }
  })
}
```

#### SKIP LOCKED — Job Queue Pattern

```typescript
// Ví dụ: Worker xử lý đơn hàng pending — nhiều worker chạy song song
async processNextPendingOrder() {
  return this.prismaService.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<OrderType[]>`
      SELECT id, status, "userId", "totalAmount"
      FROM "Order"
      WHERE status = 'PENDING_PAYMENT'
      AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `
    // ↑ Nếu dòng đầu tiên đang bị lock bởi worker khác → BỎ QUA, lấy dòng tiếp theo
    // Không đợi, không block, không lỗi

    if (!order) return null // Không còn order nào cần xử lý

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PROCESSING' },
    })

    return order
  })
}
```

### 5.6 Optimistic Locking Với Prisma (Version Field)

```typescript
// Cần thêm cột version vào Prisma schema:
// model Product {
//   id      Int @id @default(autoincrement())
//   stock   Int
//   version Int @default(0)
// }

async purchaseOptimistic(productId: number, quantity: number) {
  const MAX_RETRIES = 3

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Bước 1: Đọc (KHÔNG lock)
    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
    })

    if (!product || product.stock < quantity) {
      throw new BadRequestException('Insufficient stock')
    }

    // Bước 2: Update CHỈ KHI version khớp
    const result = await this.prismaService.product.updateMany({
      where: {
        id: productId,
        version: product.version, // ← Điều kiện version
      },
      data: {
        stock: { decrement: quantity },
        version: { increment: 1 }, // ← Tăng version
      },
    })

    if (result.count > 0) return // ✅ Thành công!
    // Nếu count = 0 → version đã thay đổi → retry
  }

  throw new ConflictException('Quá nhiều conflict. Vui lòng thử lại.')
}
```

### 5.7 Helper: Transaction Với Timeout Tùy Chỉnh

Trong source code Ecommerce API, `PrismaService` đã có sẵn helper method:

```typescript
// src/shared/services/prisma.service.ts
async transactionWithTimeout<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  const timeout = options?.timeout || 30000   // Default 30s
  const maxWait = options?.maxWait || 10000    // Default 10s

  try {
    return await this.$transaction(fn, { timeout, maxWait })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Transaction failed with code ${error.code}: ${error.message}`)
    }
    throw error
  }
}
```

**Sử dụng:**

```typescript
// Cho payment processing — cần timeout dài hơn vì gọi payment gateway
await this.prismaService.transactionWithTimeout(
  async (tx) => {
    // ... logic thanh toán ...
  },
  { timeout: 60000, maxWait: 15000 } // 60s timeout, 15s max wait
)
```

### 5.8 Tổng Hợp: Khi Nào Dùng Gì Trong Prisma?

```
Cần lock dòng rồi đọc?          → $queryRaw`SELECT ... FOR UPDATE`
Chỉ cần update có điều kiện?    → $executeRaw`UPDATE ... WHERE condition`
Conflict hiếm, cần scalability? → Optimistic (version field + updateMany)
Job queue, nhiều worker?         → $queryRaw`SELECT ... FOR UPDATE SKIP LOCKED`
Cần fail fast?                   → $queryRaw`SELECT ... FOR UPDATE NOWAIT`
```