# 📚 Hướng Dẫn Chi Tiết: Normalization vs Denormalization trong Database

> **Tài liệu tham khảo**: Phân tích kỹ thuật database dựa trên schema NestJS Ecommerce API

---

## 📋 Mục Lục

1. [Khái Niệm Cơ Bản](#khái-niệm-cơ-bản)
2. [Normalization - Chuẩn Hóa Dữ Liệu](#normalization---chuẩn-hóa-dữ-liệu)
3. [Denormalization - Phi Chuẩn Hóa](#denormalization---phi-chuẩn-hóa)
4. [Ví Dụ Thực Tế Từ Dự Án](#ví-dụ-thực-tế-từ-dự-án)
5. [Khái Niệm Chuyên Sâu](#khái-niệm-chuyên-sâu)
6. [Pattern Thiết Kế Nâng Cao](#pattern-thiết-kế-nâng-cao)
7. [Performance & Optimization](#performance--optimization)
8. [Best Practices](#best-practices)

---

## 🎯 Khái Niệm Cơ Bản

### Normalization (Chuẩn hóa dữ liệu)

**Định nghĩa**: Quá trình tổ chức dữ liệu để **giảm thiểu redundancy** (dư thừa) và **đảm bảo data integrity** (tính toàn vẹn).

### Denormalization (Phi chuẩn hóa)

**Định nghĩa**: Quá trình **cố tình thêm redundancy** để **cải thiện performance** đọc dữ liệu.

---

## 🔄 Normalization - Chuẩn Hóa Dữ Liệu

### Các Dạng Chuẩn Hóa

#### 1️⃣ 1NF (First Normal Form)

- **Quy tắc**: Mỗi cell chỉ chứa một giá trị đơn
- **Không được**: Nhóm lặp lại, arrays trong một field

```sql
-- ❌ Vi phạm 1NF
CREATE TABLE products_bad (
  id INT PRIMARY KEY,
  name VARCHAR(500),
  colors VARCHAR(500) -- "red,blue,green" - Vi phạm 1NF
);

-- ✅ Tuân thủ 1NF
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(500)
);

CREATE TABLE product_colors (
  product_id INT,
  color VARCHAR(100)
);
```

#### 2️⃣ 2NF (Second Normal Form)

- **Quy tắc**: Đạt 1NF + loại bỏ **partial dependency**
- **Áp dụng**: Với composite primary key

```sql
-- ❌ Vi phạm 2NF (Partial Dependency)
CREATE TABLE order_items_bad (
  order_id INT,
  product_id INT,
  quantity INT,
  product_name VARCHAR(500), -- Chỉ phụ thuộc product_id
  product_price DECIMAL,     -- Chỉ phụ thuộc product_id
  PRIMARY KEY (order_id, product_id)
);

-- ✅ Tuân thủ 2NF
CREATE TABLE order_items (
  order_id INT,
  product_id INT,
  quantity INT,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(500),
  price DECIMAL
);
```

#### 3️⃣ 3NF (Third Normal Form)

- **Quy tắc**: Đạt 2NF + loại bỏ **transitive dependency**
- **Không được**: Non-key attributes phụ thuộc vào nhau

```sql
-- ❌ Vi phạm 3NF (Transitive Dependency)
CREATE TABLE employees_bad (
  id INT PRIMARY KEY,
  name VARCHAR(500),
  department_id INT,
  department_name VARCHAR(500), -- Phụ thuộc vào department_id
  department_location VARCHAR(500) -- Phụ thuộc vào department_id
);

-- ✅ Tuân thủ 3NF
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(500),
  department_id INT
);

CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(500),
  location VARCHAR(500)
);
```

### Ưu Điểm Normalization

✅ **Data Integrity**: Giảm thiểu data inconsistency  
✅ **Storage Efficiency**: Tiết kiệm dung lượng  
✅ **Update Efficiency**: Chỉ cần update ở một nơi  
✅ **Flexibility**: Dễ mở rộng và thay đổi cấu trúc

### Nhược Điểm Normalization

❌ **Query Complexity**: Cần nhiều JOIN operations  
❌ **Read Performance**: Chậm hơn khi đọc dữ liệu phức tạp  
❌ **Development Overhead**: Code phức tạp hơn

---

## 🚀 Denormalization - Phi Chuẩn Hóa

### Khi Nào Sử Dụng Denormalization

- **OLAP systems** (Online Analytical Processing)
- **Data Warehousing** và **Reporting systems**
- Ưu tiên **read performance**
- **High-traffic applications** cần response time nhanh
- **Caching layers** hoặc **materialized views**

### Các Dạng Denormalization

#### 1️⃣ Redundant Data Storage

```sql
-- Thêm thông tin redundant để tránh JOIN
model Product {
  id            Int    @id @default(autoincrement())
  name          String
  brandId       Int
  brandName     String -- ❗ Redundant data để tránh JOIN với Brand table
}
```

#### 2️⃣ Counter Caching

```sql
-- Lưu trữ aggregated data
model Product {
  id           Int   @id @default(autoincrement())
  name         String
  reviewCount  Int   @default(0)    -- ❗ Cached counter
  averageRating Float @default(0)   -- ❗ Cached calculation
}
```

#### 3️⃣ Snapshot Pattern

```sql
-- Lưu trữ data tại thời điểm cụ thể
model OrderSnapshot {
  id          Int    @id @default(autoincrement())
  productName String -- ❗ Product name tại thời điểm order
  price       Float  -- ❗ Price tại thời điểm order
  orderId     Int
}
```

### Ưu Điểm Denormalization

✅ **Read Performance**: Truy vấn nhanh hơn, ít JOIN  
✅ **Simplicity**: Query đơn giản hơn  
✅ **Availability**: Giảm dependency giữa các bảng

### Nhược Điểm Denormalization

❌ **Data Redundancy**: Tốn storage space  
❌ **Update Complexity**: Phải update nhiều nơi  
❌ **Data Inconsistency Risk**: Dễ xảy ra data corruption  
❌ **Maintenance Cost**: Khó maintain và debug

---

## 📊 Ví Dụ Thực Tế Từ Dự Án

### Migration Analysis

Dựa trên migration history của dự án, chúng ta có thể thấy các quyết định thiết kế thực tế:

#### 1️⃣ Brand Name Denormalization

**Migration**: `20250422132310_add_brand_name`

```sql
-- Migration: Thêm trường name vào Brand table
ALTER TABLE "Brand" ADD COLUMN "name" VARCHAR(500) NOT NULL;
```

**Phân tích quyết định**:

```sql
-- ✅ TRƯỚC (Normalized)
Brand.id → BrandTranslation.name (qua brandId + languageId)

-- ❗ SAU (Denormalized)
Brand.id → Brand.name          -- Direct access
Brand.id → BrandTranslation.name -- Vẫn giữ cho đa ngôn ngữ
```

**Lý do denormalize**:

- **Performance**: Tránh JOIN với BrandTranslation
- **Default fallback**: Khi không có translation, dùng Brand.name
- **API simplicity**: Dễ lấy tên brand mặc định

#### 2️⃣ Soft Delete với Unique Constraints

**Migration**: `20250408145825_remove_user_unique_email`

```sql
-- Thay vì unique constraint thông thường
DROP INDEX "User_email_key";

-- Tạo unique constraint có điều kiện
CREATE UNIQUE INDEX "User_email_unique"
ON "User" (email)
WHERE "deletedAt" IS NULL;
```

**Lợi ích**:

- Cho phép tái sử dụng email sau khi soft delete
- Maintain referential integrity
- Audit trail cho compliance

#### 3️⃣ Product Translation Pattern

**Schema hiện tại**:

```sql
-- Product table (normalized core data)
model Product {
  id                  Int                  @id @default(autoincrement())
  base_price          Float
  virtual_price       Float
  brandId             Int
  brand               Brand                @relation(fields: [brandId])
  productTranslations ProductTranslation[] -- Đa ngôn ngữ
}

-- Translation table (normalized multilingual data)
model ProductTranslation {
  id          Int      @id @default(autoincrement())
  productId   Int
  product     Product  @relation(fields: [productId])
  languageId  String
  language    Language @relation(fields: [languageId])
  name        String   @db.VarChar(500)
  description String
}
```

**Ưu điểm pattern này**:

- Hỗ trợ đa ngôn ngữ mà không duplicate core data
- Dễ thêm ngôn ngữ mới
- Flexible cho từng market

#### 4️⃣ ProductSKUSnapshot - Event Sourcing Pattern

**Schema**:

```sql
model ProductSKUSnapshot {
  id          Int      @id @default(autoincrement())
  productName String   @db.VarChar(500)  -- ❗ Denormalized
  price       Float                       -- ❗ Denormalized
  images      String[]                    -- ❗ Denormalized
  skuValue    String   @db.VarChar(500)  -- ❗ Denormalized
  skuId       Int?     -- Reference để truy vết
  orderId     Int?
}
```

**Tại sao denormalize ở đây**:

- **Immutable history**: Đơn hàng không thay đổi theo thời gian
- **Legal compliance**: Hóa đơn phải chính xác như thời điểm mua
- **Price protection**: Giá thay đổi không ảnh hưởng đơn cũ

---

## 🧠 Khái Niệm Chuyên Sâu

### 1️⃣ Functional Dependencies (Phụ thuộc hàm)

**Định nghĩa**: Nếu A → B, nghĩa là biết A thì xác định được B

**Ví dụ trong dự án**:

```sql
-- Functional Dependencies trong Product
Product.id → Product.base_price     ✅
Product.id → Product.brandId        ✅
Product.brandId → Brand.name        ✅
Product.brandId → Brand.logo        ✅

-- Sau khi thêm Brand.name (denormalization)
Product.brandId → Brand.name        ✅ (Direct)
Product.brandId → BrandTranslation.name ✅ (Indirect)
```

### 2️⃣ BCNF (Boyce-Codd Normal Form)

**Quy tắc**: Mọi determinant phải là candidate key

**Ví dụ vi phạm BCNF**:

```sql
-- ❌ Vi phạm BCNF
model CourseSchedule {
  studentId   Int
  courseCode  String
  teacherId   Int
  teacherName String  -- teacherId → teacherName (teacherId không phải candidate key)
  room        String
}

-- ✅ Tuân thủ BCNF
model CourseSchedule {
  studentId  Int
  courseCode String
  teacherId  Int
  room       String
}

model Teacher {
  id   Int    @id
  name String
}
```

### 3️⃣ Composite Keys và Partial Dependencies

**Trong BrandTranslation**:

```sql
model BrandTranslation {
  brandId     Int      -- Part of composite key
  languageId  String   -- Part of composite key
  name        String   -- Depends on BOTH brandId + languageId ✅
  description String   -- Depends on BOTH brandId + languageId ✅

  -- Nếu có field như này thì vi phạm 2NF:
  -- brandLogo String  -- Chỉ depends on brandId ❌
}
```

---

## 🎯 Pattern Thiết Kế Nâng Cao

### 1️⃣ Temporal Tables (Versioning)

```sql
-- Mở rộng cho tracking lịch sử thay đổi
model ProductHistory {
  id           Int      @id @default(autoincrement())
  productId    Int      -- Reference to current product
  base_price   Float    -- Price tại version này
  virtual_price Float   -- Virtual price tại version này
  validFrom    DateTime @default(now())
  validTo      DateTime?
  changeReason String?  -- Lý do thay đổi

  @@index([productId, validFrom, validTo])
}
```

### 2️⃣ CQRS (Command Query Responsibility Segregation)

```sql
-- Write Model (Normalized - cho operations)
model ProductWrite {
  id         Int    @id @default(autoincrement())
  base_price Float
  brandId    Int
  // Minimal fields for writes
}

-- Read Model (Denormalized - cho queries)
model ProductRead {
  id              Int     @id
  base_price      Float
  brand_name      String  -- Denormalized
  category_path   String  -- Denormalized hierarchy
  review_count    Int     -- Denormalized counter
  average_rating  Float   -- Denormalized calculation
  // Optimized for reads
}
```

### 3️⃣ Audit Trail Pattern

**Schema hiện tại đã implement rất tốt**:

```sql
-- Pattern tracking cho mọi entity
createdById Int?
createdBy   User? @relation("ProductCreatedBy")
updatedById Int?
updatedBy   User? @relation("ProductUpdatedBy")
deletedById Int?
deletedBy   User? @relation("ProductDeletedBy")

deletedAt DateTime? -- Soft delete
createdAt DateTime  @default(now())
updatedAt DateTime  @updatedAt
```

**Lợi ích**:

- Full audit trail cho compliance
- Traceability cho debugging
- User accountability

---

## ⚡ Performance & Optimization

### 1️⃣ Query Performance Analysis

```sql
-- Query normalized (nhiều JOINs)
EXPLAIN ANALYZE
SELECT p.id, pt.name, bt.name as brand_name
FROM "Product" p
JOIN "ProductTranslation" pt ON p.id = pt."productId"
JOIN "Brand" b ON p."brandId" = b.id
JOIN "BrandTranslation" bt ON b.id = bt."brandId"
WHERE pt."languageId" = 'vi' AND bt."languageId" = 'vi';

-- Query denormalized (sau khi thêm Brand.name)
EXPLAIN ANALYZE
SELECT p.id, pt.name, b.name as brand_name
FROM "Product" p
JOIN "ProductTranslation" pt ON p.id = pt."productId"
JOIN "Brand" b ON p."brandId" = b.id
WHERE pt."languageId" = 'vi';
```

### 2️⃣ Index Strategy

```sql
-- Compound indexes cho performance
CREATE INDEX idx_product_brand_performance
ON "Product" ("brandId", "base_price", "deletedAt")
WHERE "deletedAt" IS NULL;

-- Covering index cho translations
CREATE INDEX idx_product_translations_covering
ON "ProductTranslation" ("productId", "languageId")
INCLUDE ("name", "description")
WHERE "deletedAt" IS NULL;

-- Unique constraints với soft delete
CREATE UNIQUE INDEX "User_email_unique"
ON "User" (email)
WHERE "deletedAt" IS NULL;
```

### 3️⃣ Materialized Views

```sql
-- Thống kê sản phẩm (denormalized reporting)
CREATE MATERIALIZED VIEW product_statistics AS
SELECT
  p.id,
  p.base_price,
  b.name as brand_name,
  COUNT(r.id) as review_count,
  AVG(r.rating) as average_rating,
  SUM(ci.quantity) as total_cart_items
FROM "Product" p
JOIN "Brand" b ON p."brandId" = b.id
LEFT JOIN "Review" r ON p.id = r."productId"
LEFT JOIN "SKU" s ON p.id = s."productId"
LEFT JOIN "CartItem" ci ON s.id = ci."skuId"
WHERE p."deletedAt" IS NULL
GROUP BY p.id, p.base_price, b.name;

-- Refresh strategy
REFRESH MATERIALIZED VIEW product_statistics;
```

### 4️⃣ Counter Caching Implementation

```sql
-- Thêm counters vào Product
ALTER TABLE "Product"
ADD COLUMN "reviewCount" INT DEFAULT 0,
ADD COLUMN "averageRating" DECIMAL(3,2) DEFAULT 0;

-- Trigger để maintain counters
CREATE OR REPLACE FUNCTION update_product_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Product"
    SET
      "reviewCount" = "reviewCount" + 1,
      "averageRating" = (
        SELECT AVG(rating) FROM "Review"
        WHERE "productId" = NEW."productId"
      )
    WHERE id = NEW."productId";
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Product"
    SET
      "reviewCount" = "reviewCount" - 1,
      "averageRating" = (
        SELECT COALESCE(AVG(rating), 0) FROM "Review"
        WHERE "productId" = OLD."productId"
      )
    WHERE id = OLD."productId";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_stats
AFTER INSERT OR DELETE ON "Review"
FOR EACH ROW EXECUTE FUNCTION update_product_stats();
```

---

## 🚨 Các Bẫy Thường Gặp & Cách Tránh

### 1️⃣ Cascade Delete Issues

```sql
-- ❌ Nguy hiểm: Delete brand có thể làm mất historical data
DELETE FROM "Brand" WHERE id = 1;
-- ProductSKUSnapshot vẫn cần brand info cho orders cũ!

-- ✅ Giải pháp: Soft delete + cleanup job
UPDATE "Brand" SET "deletedAt" = NOW() WHERE id = 1;

-- Background job cleanup an toàn
DELETE FROM "Brand"
WHERE "deletedAt" < NOW() - INTERVAL '1 year'
AND NOT EXISTS (
  SELECT 1 FROM "ProductSKUSnapshot" pss
  JOIN "SKU" s ON pss."skuId" = s.id
  JOIN "Product" p ON s."productId" = p.id
  WHERE p."brandId" = "Brand".id
);
```

### 2️⃣ Data Synchronization Race Conditions

```sql
-- ❌ Race condition khi update denormalized data
-- Thread 1: Update Brand.name = 'Nike Pro'
-- Thread 2: Update Brand.name = 'Nike Sport'
-- Result: Inconsistent data

-- ✅ Giải pháp: Database transactions + proper locking
BEGIN;
SELECT * FROM "Brand" WHERE id = 1 FOR UPDATE; -- Lock row
UPDATE "Brand" SET name = 'Nike Pro' WHERE id = 1;
UPDATE "BrandTranslation"
SET name = 'Nike Pro'
WHERE "brandId" = 1 AND "languageId" = 'en';
COMMIT;
```

### 3️⃣ Migration Data Integrity

```sql
-- ❌ Unsafe migration
ALTER TABLE "Product" ADD COLUMN "reviewCount" INT NOT NULL;
-- Fails nếu table có data!

-- ✅ Safe migration approach
-- Step 1: Add nullable column
ALTER TABLE "Product" ADD COLUMN "reviewCount" INT;

-- Step 2: Populate existing data
UPDATE "Product"
SET "reviewCount" = (
  SELECT COUNT(*) FROM "Review"
  WHERE "Review"."productId" = "Product".id
);

-- Step 3: Make it NOT NULL
ALTER TABLE "Product" ALTER COLUMN "reviewCount" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "reviewCount" SET DEFAULT 0;
```

---

## 📊 Monitoring & Metrics

### 1️⃣ Performance Monitoring

```sql
-- Monitor slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query LIKE '%Product%' OR query LIKE '%Brand%'
ORDER BY total_time DESC
LIMIT 20;
```

### 2️⃣ Storage Analysis

```sql
-- Analyze table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
  ROUND(100 * pg_total_relation_size(schemaname||'.'||tablename) / pg_database_size(current_database())) as percent_of_db
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3️⃣ Data Consistency Checks

```sql
-- Check denormalized data consistency
SELECT
  p.id,
  p."reviewCount" as stored_count,
  COUNT(r.id) as actual_count,
  p."averageRating" as stored_rating,
  AVG(r.rating) as actual_rating
FROM "Product" p
LEFT JOIN "Review" r ON p.id = r."productId"
GROUP BY p.id, p."reviewCount", p."averageRating"
HAVING p."reviewCount" != COUNT(r.id)
   OR ABS(p."averageRating" - COALESCE(AVG(r.rating), 0)) > 0.01;
```

---

## 💡 Best Practices

### 🎯 Khi Nào Nên Normalize

- **OLTP systems** với nhiều write operations
- **Development phase** khi requirements thay đổi thường xuyên
- Khi **data consistency** quan trọng hơn performance
- **Storage cost** là constraint chính

### 🚀 Khi Nào Nên Denormalize

- **OLAP systems** với focus vào analytics
- **Read-heavy applications** (read/write ratio > 10:1)
- **Real-time reporting** requirements
- **API response time** là critical factor

### ⚖️ Hybrid Approach (Recommended)

```sql
-- Core business entities: Normalized
User ← Role ← Permission
Product ← Category ← Brand

-- Performance-critical paths: Denormalized
ProductSKUSnapshot (for orders)
ProductStatistics (for listings)
UserProfile (for quick access)

-- Audit & History: Specialized patterns
AuditLog, VersionHistory, EventSourcing
```

### 🔧 Implementation Guidelines

1. **Measure First**: Dùng `EXPLAIN ANALYZE` trước khi optimize
2. **Document Decisions**: Ghi lại lý do và trade-offs
3. **Monitor Continuously**: Setup alerts cho performance regression
4. **Plan for Rollback**: Thiết kế để dễ revert nếu cần
5. **Test Thoroughly**: Load testing cho denormalized paths

### 📝 Migration Strategy

```sql
-- 1. Phân tích current performance
-- 2. Identify bottlenecks
-- 3. Design denormalization plan
-- 4. Implement với feature flags
-- 5. A/B test performance
-- 6. Monitor và adjust
-- 7. Document lessons learned
```

---

## 🎉 Kết Luận

Database design là một **art of balance** giữa:

- **Performance** vs **Consistency**
- **Storage** vs **Speed**
- **Simplicity** vs **Flexibility**
- **Present needs** vs **Future scalability**

Schema hiện tại của dự án đã implement rất tốt cả hai approaches:

✅ **Normalized core**: Product, User, Permission relationships  
✅ **Denormalized optimization**: ProductSKUSnapshot, Brand.name  
✅ **Smart indexing**: Soft delete constraints, composite indexes  
✅ **Audit trail**: Full tracking với created/updated/deleted by

**Key takeaway**: Không có "one-size-fits-all" solution. Hãy **measure, analyze, và optimize** dựa trên actual usage patterns của application! 🚀

---

## 📚 Tài Liệu Tham Khảo

- [Database Normalization Theory](https://en.wikipedia.org/wiki/Database_normalization)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Prisma Schema Design](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
