# ACID và Isolation - Kiến thức chuyên sâu cho Backend Developer

## Mục lục

1. [Tổng quan về ACID](#1-tổng-quan-về-acid)
2. [Atomicity - Tính nguyên tử](#2-atomicity---tính-nguyên-tử)
3. [Consistency - Tính nhất quán](#3-consistency---tính-nhất-quán)
4. [Isolation - Tính cô lập (Phần quan trọng nhất)](#4-isolation---tính-cô-lập)
5. [Durability - Tính bền vững](#5-durability---tính-bền-vững)
6. [Giải quyết bài toán thực tế: Race Condition trong E-commerce](#6-giải-quyết-bài-toán-thực-tế)
7. [Best Practices và Monitoring](#7-best-practices-và-monitoring)

---

## 1. Tổng quan về ACID

**ACID** là viết tắt của 4 tính chất cơ bản mà một hệ quản trị cơ sở dữ liệu (DBMS) cần đảm bảo để xử lý các giao dịch (transaction) một cách an toàn và đáng tin cậy:

- **A**tomicity (Tính nguyên tử)
- **C**onsistency (Tính nhất quán)
- **I**solation (Tính cô lập) - **Phần khó nhất và quan trọng nhất**
- **D**urability (Tính bền vững)

### Tại sao ACID quan trọng?

- Đảm bảo tính toàn vẹn dữ liệu
- Xử lý các tình huống đồng thời (concurrency)
- Khôi phục dữ liệu khi có sự cố
- Xây dựng hệ thống đáng tin cậy

---

## 2. Atomicity - Tính nguyên tử

### Khái niệm

Atomicity đảm bảo rằng một transaction phải được thực hiện **toàn bộ hoặc không thực hiện gì cả**. Không có trạng thái trung gian.

### Ví dụ: Chuyển tiền ngân hàng

```sql
-- Chuyển 100$ từ tài khoản A sang tài khoản B
BEGIN TRANSACTION;
    UPDATE accounts SET balance = balance - 100 WHERE account_id = 'A';
    UPDATE accounts SET balance = balance + 100 WHERE account_id = 'B';
COMMIT;
```

**Trường hợp thành công:** Cả hai câu lệnh UPDATE đều thực hiện thành công

**Trường hợp thất bại:** Nếu câu lệnh thứ 2 bị lỗi, hệ thống sẽ ROLLBACK, trả về trạng thái ban đầu

### Code thực tế trong Node.js

```javascript
async function transferMoney(fromAccount, toAccount, amount) {
  const transaction = await db.beginTransaction()
  try {
    // Trừ tiền từ tài khoản nguồn
    await db.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, fromAccount], { transaction })

    // Cộng tiền vào tài khoản đích
    await db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toAccount], { transaction })

    await transaction.commit()
    return { success: true, message: 'Chuyển tiền thành công!' }
  } catch (error) {
    await transaction.rollback()
    throw new Error('Chuyển tiền thất bại: ' + error.message)
  }
}
```

### Tại sao quan trọng?

- Tránh tình trạng dữ liệu bị "rời rạc" (inconsistent)
- Đảm bảo tính toàn vẹn của dữ liệu trong các thao tác phức tạp
- Xử lý lỗi một cách an toàn

---

## 3. Consistency - Tính nhất quán

### Khái niệm

Consistency đảm bảo rằng mọi transaction đều tuân thủ các **quy tắc ràng buộc** (constraints) đã được định nghĩa trong database.

### Các loại ràng buộc

#### 3.1 Primary Key Constraints

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL
);
```

#### 3.2 Foreign Key Constraints

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

#### 3.3 Check Constraints

```sql
CREATE TABLE products (
    id INT PRIMARY KEY,
    price DECIMAL(10,2) CHECK (price > 0),
    quantity INT CHECK (quantity >= 0)
);
```

#### 3.4 Business Rules

```sql
-- Ví dụ: Một khách hàng không thể có quá 5 đơn hàng đang chờ xử lý
CREATE TRIGGER check_pending_orders
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    DECLARE pending_count INT;
    SELECT COUNT(*) INTO pending_count
    FROM orders
    WHERE customer_id = NEW.customer_id AND status = 'pending';

    IF pending_count >= 5 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Khách hàng có quá nhiều đơn hàng đang chờ xử lý';
    END IF;
END;
```

### Ví dụ vi phạm Consistency

```sql
-- Thử insert một order với total_amount âm
INSERT INTO orders (customer_id, total_amount) VALUES (123, -100);
-- Error: Check constraint violation
```

### Tại sao quan trọng?

- Đảm bảo dữ liệu luôn hợp lệ
- Tránh các lỗi logic trong ứng dụng
- Duy trì tính toàn vẹn tham chiếu

---

## 4. Isolation - Tính cô lập

> **Đây là phần khó nhất và quan trọng nhất của ACID!**

### Tại sao Isolation lại khó?

Isolation phức tạp vì nó phải giải quyết **3 vấn đề cơ bản** của concurrency:

#### 4.1 Dirty Read (Đọc dữ liệu bẩn)

```sql
-- Transaction A
BEGIN;
UPDATE products SET quantity = 0 WHERE id = 1;
-- Chưa COMMIT

-- Transaction B (đồng thời)
SELECT quantity FROM products WHERE id = 1; -- Đọc được 0 (dữ liệu bẩn!)

-- Transaction A
ROLLBACK; -- quantity trở về 1
```

**Vấn đề:** Transaction B đọc được dữ liệu chưa được commit, có thể bị rollback.

#### 4.2 Non-Repeatable Read (Đọc không lặp lại)

```sql
-- Transaction A
BEGIN;
SELECT quantity FROM products WHERE id = 1; -- Kết quả: 5

-- Transaction B (đồng thời)
UPDATE products SET quantity = 3 WHERE id = 1;
COMMIT;

-- Transaction A
SELECT quantity FROM products WHERE id = 1; -- Kết quả: 3 (khác lần đầu!)
COMMIT;
```

**Vấn đề:** Trong cùng một transaction, đọc cùng một row nhiều lần cho kết quả khác nhau.

#### 4.3 Phantom Read (Đọc ma)

```sql
-- Transaction A
BEGIN;
SELECT COUNT(*) FROM products WHERE category = 'laptop'; -- Kết quả: 10

-- Transaction B (đồng thời)
INSERT INTO products (name, category) VALUES ('New Laptop', 'laptop');
COMMIT;

-- Transaction A
SELECT COUNT(*) FROM products WHERE category = 'laptop'; -- Kết quả: 11 (xuất hiện "ma"!)
COMMIT;
```

**Vấn đề:** Các row mới xuất hiện trong kết quả query của cùng một transaction.

### 4.4 Các mức độ Isolation

#### Level 0: READ UNCOMMITTED

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
```

- **Có thể gặp:** Dirty Read, Non-Repeatable Read, Phantom Read
- **Hiệu suất:** Cao nhất
- **Sử dụng:** Chỉ cho reporting không quan trọng tính chính xác

#### Level 1: READ COMMITTED

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

- **Giải quyết:** Dirty Read
- **Vẫn có:** Non-Repeatable Read, Phantom Read
- **Sử dụng:** Default của PostgreSQL, SQL Server
- **Phù hợp:** Hầu hết ứng dụng web

#### Level 2: REPEATABLE READ

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

- **Giải quyết:** Dirty Read, Non-Repeatable Read
- **Vẫn có:** Phantom Read
- **Sử dụng:** Default của MySQL
- **Phù hợp:** Ứng dụng cần đọc consistent trong transaction

#### Level 3: SERIALIZABLE

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

- **Giải quyết:** Tất cả vấn đề
- **Hiệu suất:** Thấp nhất
- **Sử dụng:** Financial transactions, critical operations

### 4.5 So sánh các mức độ Isolation

| Level            | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
| ---------------- | ---------- | ------------------- | ------------ | ----------- |
| READ UNCOMMITTED | ✓          | ✓                   | ✓            | Cao nhất    |
| READ COMMITTED   | ✗          | ✓                   | ✓            | Cao         |
| REPEATABLE READ  | ✗          | ✗                   | ✓            | Trung bình  |
| SERIALIZABLE     | ✗          | ✗                   | ✗            | Thấp nhất   |

---

## 5. Durability - Tính bền vững

### Khái niệm

Durability đảm bảo rằng một khi transaction đã được **COMMIT**, dữ liệu sẽ được lưu trữ **vĩnh viễn** và không bị mất ngay cả khi hệ thống gặp sự cố.

### Cách thực hiện

#### 5.1 Write-Ahead Logging (WAL)

```sql
-- PostgreSQL WAL example
-- Ghi log trước khi thay đổi dữ liệu
BEGIN;
INSERT INTO orders (customer_id, total_amount) VALUES (123, 500.00);
COMMIT; -- Từ thời điểm này, dữ liệu được đảm bảo không bị mất
```

#### 5.2 Checkpoint Mechanism

```sql
-- PostgreSQL checkpoint
CHECKPOINT; -- Đồng bộ dữ liệu từ memory xuống disk
```

#### 5.3 Backup và Recovery

```bash
# PostgreSQL backup
pg_dump -h localhost -U username -d database_name > backup.sql

# Recovery
psql -h localhost -U username -d database_name < backup.sql
```

### Tại sao quan trọng?

- Bảo vệ dữ liệu khỏi mất mát do sự cố hardware/software
- Đảm bảo tính tin cậy của hệ thống
- Hỗ trợ disaster recovery

---

## 6. Giải quyết bài toán thực tế

### Bài toán: E-commerce Race Condition

**Kịch bản:**

- Sản phẩm iPhone chỉ còn 1 chiếc (quantity = 1)
- User A và User B cùng lúc nhấn "Mua ngay"
- Chỉ 1 người được mua thành công

### Vấn đề nếu không xử lý đúng

```sql
-- User A
SELECT quantity FROM products WHERE id = 1; -- Kết quả: 1 ✓

-- User B (cùng lúc)
SELECT quantity FROM products WHERE id = 1; -- Kết quả: 1 ✓

-- User A
UPDATE products SET quantity = quantity - 1 WHERE id = 1; -- quantity = 0
INSERT INTO orders (user_id, product_id, quantity) VALUES (1, 1, 1);

-- User B
UPDATE products SET quantity = quantity - 1 WHERE id = 1; -- quantity = -1 ❌
INSERT INTO orders (user_id, product_id, quantity) VALUES (2, 1, 1);
```

**Kết quả:** Cả 2 đều mua được, sản phẩm bị oversold! 😱

### Solution 1: Pessimistic Locking (Khóa bi quan)

#### Cách hoạt động:

- Lock row ngay từ đầu
- User khác phải đợi cho đến khi transaction hoàn thành
- Đảm bảo 100% tính chính xác

#### SQL Implementation:

```sql
BEGIN;
SELECT quantity FROM products WHERE id = 1 FOR UPDATE;
-- Row bị lock, User B phải đợi

IF quantity > 0 THEN
    UPDATE products SET quantity = quantity - 1 WHERE id = 1;
    INSERT INTO orders (user_id, product_id, quantity) VALUES (1, 1, 1);
    COMMIT; -- User B mới được tiếp tục
ELSE
    ROLLBACK;
END IF;
```

#### Node.js Implementation:

```javascript
async function purchaseProductPessimistic(userId, productId, requestedQty) {
  const transaction = await db.beginTransaction()
  try {
    // Lock row để tránh race condition
    const [product] = await db.query('SELECT quantity FROM products WHERE id = ? FOR UPDATE', [productId], {
      transaction,
    })

    if (product.quantity >= requestedQty) {
      // Có đủ hàng
      await db.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [requestedQty, productId], {
        transaction,
      })

      await db.query(
        'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, productId, requestedQty],
        { transaction },
      )

      await transaction.commit()
      return { success: true, message: 'Đặt hàng thành công!' }
    } else {
      // Hết hàng
      await transaction.rollback()
      return { success: false, message: 'Sản phẩm đã hết hàng!' }
    }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
```

#### Ưu và nhược điểm:

**Ưu điểm:**

- Đảm bảo 100% tính chính xác
- Logic đơn giản, dễ hiểu
- Không cần retry logic

**Nhược điểm:**

- Hiệu suất thấp với traffic cao
- Có thể xảy ra deadlock
- User B phải đợi User A hoàn thành

### Solution 2: Optimistic Locking (Khóa lạc quan)

#### Cách hoạt động:

- Không lock ngay từ đầu
- Sử dụng version/timestamp để detect conflicts
- Retry khi có conflict

#### Database Schema:

```sql
-- Thêm version column
ALTER TABLE products ADD COLUMN version INT DEFAULT 0;
```

#### SQL Implementation:

```sql
-- Đọc current state
SELECT quantity, version FROM products WHERE id = 1;

-- Update với version check
UPDATE products
SET quantity = quantity - 1, version = version + 1
WHERE id = 1 AND version = @current_version AND quantity > 0;

-- Kiểm tra affected rows
IF @@ROWCOUNT = 0 THEN
    -- Có conflict hoặc hết hàng
    ROLLBACK;
ELSE
    -- Thành công
    INSERT INTO orders...
    COMMIT;
END IF;
```

#### Node.js Implementation:

```javascript
async function purchaseProductOptimistic(userId, productId, requestedQty, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await db.beginTransaction()
    try {
      // Đọc current state
      const [product] = await db.query('SELECT quantity, version FROM products WHERE id = ?', [productId])

      if (product.quantity < requestedQty) {
        await transaction.rollback()
        return { success: false, message: 'Sản phẩm đã hết hàng!' }
      }

      // Cố gắng update với version check
      const updateResult = await db.query(
        `UPDATE products 
                 SET quantity = quantity - ?, version = version + 1 
                 WHERE id = ? AND version = ? AND quantity >= ?`,
        [requestedQty, productId, product.version, requestedQty],
        { transaction },
      )

      if (updateResult.affectedRows === 0) {
        // Có conflict, retry
        await transaction.rollback()
        if (attempt === maxRetries) {
          return {
            success: false,
            message: 'Hệ thống đang bận, vui lòng thử lại!',
          }
        }

        // Wait before retry với exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
        continue
      }

      // Thành công, tạo order
      await db.query(
        'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, productId, requestedQty],
        { transaction },
      )

      await transaction.commit()
      return { success: true, message: 'Đặt hàng thành công!' }
    } catch (error) {
      await transaction.rollback()
      if (attempt === maxRetries) throw error
    }
  }
}
```

#### Ưu và nhược điểm:

**Ưu điểm:**

- Hiệu suất cao hơn Pessimistic Locking
- Không block other transactions
- Phù hợp với high traffic
- Scalable tốt

**Nhược điểm:**

- Logic phức tạp hơn
- Cần retry mechanism
- Có thể fail nếu conflict nhiều
- Cần xử lý exponential backoff

### Solution 3: Database Constraints + Exception Handling

#### Cách hoạt động:

- Sử dụng database constraints để prevent invalid state
- Xử lý exceptions để handle conflicts

#### Database Setup:

```sql
-- Thêm CHECK constraint
ALTER TABLE products ADD CONSTRAINT quantity_non_negative
CHECK (quantity >= 0);

-- Hoặc sử dụng trigger
CREATE TRIGGER prevent_oversell
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    IF NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Không thể bán quá số lượng tồn kho';
    END IF;
END;
```

#### Node.js Implementation:

```javascript
async function purchaseProductWithConstraint(userId, productId, requestedQty) {
  const transaction = await db.beginTransaction()
  try {
    await db.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [requestedQty, productId], {
      transaction,
    })

    await db.query(
      'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [userId, productId, requestedQty],
      { transaction },
    )

    await transaction.commit()
    return { success: true, message: 'Đặt hàng thành công!' }
  } catch (error) {
    await transaction.rollback()

    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return { success: false, message: 'Sản phẩm đã hết hàng!' }
    }
    throw error
  }
}
```

#### Ưu và nhược điểm:

**Ưu điểm:**

- Logic đơn giản
- Hiệu suất cao
- Database đảm bảo consistency

**Nhược điểm:**

- Không friendly với user (exception-based)
- Khó kiểm soát behavior
- Error handling phức tạp

### Solution 4: Redis Distributed Lock (Cho Microservices)

#### Cách hoạt động:

- Sử dụng Redis như một distributed lock manager
- Phù hợp cho kiến trúc microservices
- Đảm bảo chỉ một instance xử lý tại một thời điểm

#### Node.js Implementation:

```javascript
const Redis = require('ioredis')
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
})

async function purchaseWithDistributedLock(userId, productId, requestedQty) {
  const lockKey = `product_lock:${productId}`
  const lockValue = `${userId}_${Date.now()}_${Math.random()}`
  const lockTTL = 10000 // 10 seconds

  try {
    // Acquire lock với NX (only if not exists) và PX (expire in milliseconds)
    const acquired = await redis.set(lockKey, lockValue, 'PX', lockTTL, 'NX')
    if (!acquired) {
      return {
        success: false,
        message: 'Sản phẩm đang được xử lý bởi người khác, vui lòng thử lại!',
      }
    }

    // Critical section - chỉ 1 request được vào
    const transaction = await db.beginTransaction()
    try {
      const [product] = await db.query('SELECT quantity FROM products WHERE id = ?', [productId])

      if (product.quantity >= requestedQty) {
        await db.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [requestedQty, productId], {
          transaction,
        })

        await db.query(
          'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [userId, productId, requestedQty],
          { transaction },
        )

        await transaction.commit()
        return { success: true, message: 'Đặt hàng thành công!' }
      } else {
        await transaction.rollback()
        return { success: false, message: 'Sản phẩm đã hết hàng!' }
      }
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } finally {
    // Release lock một cách an toàn (chỉ xóa nếu đúng lockValue)
    const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `
    await redis.eval(script, 1, lockKey, lockValue)
  }
}
```

#### Advanced Distributed Lock với auto-renewal:

```javascript
class DistributedLock {
  constructor(redis, key, ttl = 10000) {
    this.redis = redis
    this.key = key
    this.ttl = ttl
    this.value = `${process.pid}_${Date.now()}_${Math.random()}`
    this.renewalInterval = null
  }

  async acquire() {
    const acquired = await this.redis.set(this.key, this.value, 'PX', this.ttl, 'NX')
    if (acquired) {
      // Auto-renewal để tránh lock expire giữa chừng
      this.renewalInterval = setInterval(async () => {
        await this.renew()
      }, this.ttl / 3)
    }
    return !!acquired
  }

  async renew() {
    const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("PEXPIRE", KEYS[1], ARGV[2])
            else
                return 0
            end
        `
    return await this.redis.eval(script, 1, this.key, this.value, this.ttl)
  }

  async release() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval)
      this.renewalInterval = null
    }

    const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `
    return await this.redis.eval(script, 1, this.key, this.value)
  }
}

// Sử dụng
async function purchaseWithAdvancedLock(userId, productId, requestedQty) {
  const lock = new DistributedLock(redis, `product_lock:${productId}`)

  const acquired = await lock.acquire()
  if (!acquired) {
    return { success: false, message: 'Sản phẩm đang được xử lý!' }
  }

  try {
    // Business logic here
    return await purchaseLogic(userId, productId, requestedQty)
  } finally {
    await lock.release()
  }
}
```

#### Ưu và nhược điểm:

**Ưu điểm:**

- Phù hợp cho microservices
- Scalable across multiple instances
- Có thể auto-renewal
- Fine-grained control

**Nhược điểm:**

- Thêm dependency (Redis)
- Network latency
- Phức tạp hơn single-database solutions
- Cần xử lý Redis failures

### So sánh các Solutions

| Solution            | Độ chính xác | Hiệu suất  | Độ phức tạp | Scalability | Use case                           |
| ------------------- | ------------ | ---------- | ----------- | ----------- | ---------------------------------- |
| Pessimistic Locking | 100%         | Thấp       | Đơn giản    | Kém         | Low traffic, critical data         |
| Optimistic Locking  | 99.9%        | Cao        | Trung bình  | Tốt         | High traffic, acceptable retry     |
| DB Constraints      | 100%         | Cao        | Đơn giản    | Tốt         | Simple cases                       |
| Distributed Lock    | 100%         | Trung bình | Phức tạp    | Rất tốt     | Microservices, distributed systems |

---

## 7. Best Practices và Monitoring

### 7.1 Hybrid Approaches

#### Kết hợp nhiều techniques:

```javascript
async function smartPurchase(userId, productId, requestedQty) {
  // Kiểm tra loại sản phẩm
  const product = await getProductInfo(productId)

  if (product.isFlashSale || product.quantity < 10) {
    // Sử dụng distributed lock cho flash sale hoặc sản phẩm ít
    return await purchaseWithDistributedLock(userId, productId, requestedQty)
  } else if (product.category === 'electronics') {
    // Sử dụng pessimistic lock cho đồ điện tử
    return await purchaseProductPessimistic(userId, productId, requestedQty)
  } else {
    // Sử dụng optimistic lock cho sản phẩm thông thường
    return await purchaseProductOptimistic(userId, productId, requestedQty)
  }
}
```

#### Load balancing strategy:

```javascript
async function distributedPurchase(userId, productId, requestedQty) {
  const hash = hashFunction(productId)
  const shardId = hash % numberOfShards

  // Route request đến shard phù hợp để giảm contention
  return await purchaseOnShard(shardId, userId, productId, requestedQty)
}
```

### 7.2 Pre-allocation Strategies

#### Inventory Reservation:

```javascript
// Giảm contention bằng cách pre-allocate inventory
async function reserveInventory(userId, productId, quantity) {
  const reservationId = uuidv4()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  const transaction = await db.beginTransaction()
  try {
    // Check availability
    const [product] = await db.query('SELECT quantity FROM products WHERE id = ? FOR UPDATE', [productId], {
      transaction,
    })

    if (product.quantity >= quantity) {
      // Reserve inventory
      await db.query(
        `INSERT INTO inventory_reservations 
                 (id, user_id, product_id, quantity, expires_at) 
                 VALUES (?, ?, ?, ?, ?)`,
        [reservationId, userId, productId, quantity, expiresAt],
        { transaction },
      )

      await db.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [quantity, productId], { transaction })

      await transaction.commit()

      // Schedule cleanup job
      scheduleReservationCleanup(reservationId, expiresAt)

      return { success: true, reservationId }
    } else {
      await transaction.rollback()
      return { success: false, message: 'Không đủ hàng' }
    }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

// Confirm reservation
async function confirmReservation(reservationId) {
  const transaction = await db.beginTransaction()
  try {
    const [reservation] = await db.query(
      `SELECT * FROM inventory_reservations 
             WHERE id = ? AND expires_at > NOW()`,
      [reservationId],
    )

    if (!reservation) {
      await transaction.rollback()
      return { success: false, message: 'Reservation đã hết hạn' }
    }

    // Create order
    await db.query(
      'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [reservation.user_id, reservation.product_id, reservation.quantity],
      { transaction },
    )

    // Remove reservation
    await db.query('DELETE FROM inventory_reservations WHERE id = ?', [reservationId], { transaction })

    await transaction.commit()
    return { success: true, message: 'Đặt hàng thành công!' }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
```

### 7.3 Queue-based Approaches

#### Message Queue Implementation:

```javascript
const Bull = require('bull')
const purchaseQueue = new Bull('purchase queue', {
  redis: {
    host: 'localhost',
    port: 6379,
  },
})

// Producer - API endpoint
app.post('/purchase', async (req, res) => {
  const { userId, productId, quantity } = req.body

  const job = await purchaseQueue.add(
    'purchase',
    {
      userId,
      productId,
      quantity,
      timestamp: Date.now(),
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  )

  res.json({
    jobId: job.id,
    status: 'processing',
    message: 'Đơn hàng đang được xử lý',
  })
})

// Consumer - Queue processor
purchaseQueue.process('purchase', async (job) => {
  const { userId, productId, quantity } = job.data

  try {
    const result = await purchaseProductOptimistic(userId, productId, quantity)

    // Notify user về kết quả
    await notifyUser(userId, result)

    return result
  } catch (error) {
    console.error('Purchase failed:', error)
    throw error
  }
})

// Check job status
app.get('/purchase/:jobId/status', async (req, res) => {
  const job = await purchaseQueue.getJob(req.params.jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  const state = await job.getState()
  res.json({
    jobId: job.id,
    state,
    progress: job.progress(),
    result: job.returnvalue,
  })
})
```

### 7.4 Monitoring và Debugging

#### Deadlock Detection và Logging:

```sql
-- PostgreSQL: Monitor locks
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity
    ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- MySQL: Show processlist
SHOW PROCESSLIST;

-- Show InnoDB status for deadlock info
SHOW ENGINE INNODB STATUS;
```

#### Application-level Monitoring:

```javascript
class TransactionMonitor {
  constructor() {
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageExecutionTime: 0,
      deadlockCount: 0,
      retryCount: 0,
    }
  }

  async monitorTransaction(transactionFn, ...args) {
    const startTime = Date.now()
    this.metrics.totalTransactions++

    try {
      const result = await transactionFn(...args)
      this.metrics.successfulTransactions++

      const executionTime = Date.now() - startTime
      this.updateAverageExecutionTime(executionTime)

      this.logTransaction({
        type: 'success',
        executionTime,
        args,
        result,
      })

      return result
    } catch (error) {
      this.metrics.failedTransactions++

      if (error.code === 'ER_LOCK_DEADLOCK') {
        this.metrics.deadlockCount++
      }

      this.logTransaction({
        type: 'error',
        executionTime: Date.now() - startTime,
        args,
        error: error.message,
      })

      throw error
    }
  }

  updateAverageExecutionTime(newTime) {
    const total = this.metrics.successfulTransactions + this.metrics.failedTransactions
    this.metrics.averageExecutionTime = (this.metrics.averageExecutionTime * (total - 1) + newTime) / total
  }

  logTransaction(data) {
    console.log({
      timestamp: new Date().toISOString(),
      ...data,
    })
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: (this.metrics.successfulTransactions / this.metrics.totalTransactions) * 100,
    }
  }
}

// Sử dụng
const monitor = new TransactionMonitor()

async function monitoredPurchase(userId, productId, quantity) {
  return await monitor.monitorTransaction(purchaseProductOptimistic, userId, productId, quantity)
}
```

#### Performance Metrics Dashboard:

```javascript
// Express endpoint cho metrics
app.get('/metrics', (req, res) => {
  const metrics = monitor.getMetrics()

  res.json({
    database_transactions: {
      total: metrics.totalTransactions,
      success_rate: metrics.successRate,
      average_execution_time_ms: metrics.averageExecutionTime,
      deadlock_count: metrics.deadlockCount,
      retry_count: metrics.retryCount,
    },
    inventory_status: {
      low_stock_products: getLowStockProducts(),
      oversold_products: getOversoldProducts(),
      reservation_count: getActiveReservations(),
    },
  })
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1')

    // Check Redis connection (nếu sử dụng)
    await redis.ping()

    const metrics = monitor.getMetrics()

    res.json({
      status: 'healthy',
      database: 'connected',
      redis: 'connected',
      performance: {
        success_rate: metrics.successRate,
        average_response_time: metrics.averageExecutionTime,
      },
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    })
  }
})
```

### 7.5 Testing Strategies

#### Load Testing cho Concurrency:

```javascript
// Jest test cho race conditions
describe('Concurrency Tests', () => {
  test('should handle multiple concurrent purchases correctly', async () => {
    const productId = 1
    const initialQuantity = 10
    const concurrentUsers = 15 // Nhiều hơn số lượng available

    // Setup initial state
    await db.query('UPDATE products SET quantity = ? WHERE id = ?', [initialQuantity, productId])

    // Create concurrent purchase promises
    const purchasePromises = Array.from({ length: concurrentUsers }, (_, i) =>
      purchaseProductOptimistic(i + 1, productId, 1),
    )

    // Execute all purchases concurrently
    const results = await Promise.allSettled(purchasePromises)

    // Count successful purchases
    const successCount = results.filter((result) => result.status === 'fulfilled' && result.value.success).length

    // Verify exactly initialQuantity purchases succeeded
    expect(successCount).toBe(initialQuantity)

    // Verify final quantity is 0
    const [finalProduct] = await db.query('SELECT quantity FROM products WHERE id = ?', [productId])
    expect(finalProduct.quantity).toBe(0)
  })
})

// Stress test script
async function stressTest() {
  const concurrency = 100
  const iterations = 1000

  for (let i = 0; i < iterations; i++) {
    const promises = Array.from({ length: concurrency }, () =>
      purchaseProductOptimistic(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 10) + 1, 1),
    )

    await Promise.allSettled(promises)

    if (i % 100 === 0) {
      console.log(`Completed ${i}/${iterations} iterations`)
      console.log('Current metrics:', monitor.getMetrics())
    }
  }
}
```

---

## Kết luận

### Những điều cần nhớ về Isolation:

1. **Isolation là phần khó nhất của ACID** vì phải giải quyết các vấn đề concurrency phức tạp

2. **Không có giải pháp "one-size-fits-all"** - cần chọn approach phù hợp với từng use case

3. **Trade-off giữa Consistency và Performance** luôn tồn tại

4. **Testing và Monitoring** là cực kỳ quan trọng để đảm bảo hệ thống hoạt động đúng

5. **Hiểu rõ business requirements** để chọn isolation level và locking strategy phù hợp

### Lời khuyên cho Backend Developers:

- **Bắt đầu với Optimistic Locking** cho hầu hết use cases
- **Sử dụng Pessimistic Locking** cho critical operations
- **Implement comprehensive monitoring** để detect issues sớm
- **Test thoroughly** với concurrent load
- **Prepare for failures** với proper retry và fallback mechanisms

Nắm vững những kiến thức này sẽ giúp bạn trở thành một backend developer giỏi, có thể xử lý các tình huống phức tạp trong production systems!
