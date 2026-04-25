# Thiết Kế Collection Trong MongoDB - Nguyên Tắc & Best Practices

> **Tài liệu tham khảo gốc**: [Thiết kế cơ sở dữ liệu bằng MongoDB sao cho chuẩn - Dư Thanh Được](https://duthanhduoc.com/blog/thiet-ke-co-so-du-lieu-voi-mongodb)
>
> **Bổ sung & phân tích chuyên sâu**: Dựa trên MongoDB Official Documentation, MongoDB University M320 Data Modeling, và kinh nghiệm thực tế với hệ thống production.

---

## Mục Lục

1. [Tại Sao MongoDB Cần Nguyên Tắc Thiết Kế?](#1-tại-sao-mongodb-cần-nguyên-tắc-thiết-kế)
2. [Tư Duy Thiết Kế: SQL vs MongoDB](#2-tư-duy-thiết-kế-sql-vs-mongodb)
3. [Embed vs Reference - Quyết Định Cốt Lõi](#3-embed-vs-reference---quyết-định-cốt-lõi)
4. [Các Loại Quan Hệ Trong MongoDB](#4-các-loại-quan-hệ-trong-mongodb)
5. [5 Quy Tắc Vàng Khi Thiết Kế Schema](#5-5-quy-tắc-vàng-khi-thiết-kế-schema)
6. [Advanced Design Patterns](#6-advanced-design-patterns)
7. [Indexing Strategy](#7-indexing-strategy)
8. [Schema Versioning & Migration](#8-schema-versioning--migration)
9. [Anti-Patterns Cần Tránh](#9-anti-patterns-cần-tránh)
10. [Sharding Key Selection](#10-sharding-key-selection)
11. [Transaction & Consistency Considerations](#11-transaction--consistency-considerations)
12. [Đánh Giá Bài Viết Gốc & Tổng Kết](#12-đánh-giá-bài-viết-gốc--tổng-kết)

---

## 1. Tại Sao MongoDB Cần Nguyên Tắc Thiết Kế?

Nhiều người nghĩ "NoSQL = không cần schema = muốn thiết kế sao cũng được". Điều này **hoàn toàn sai**.

MongoDB linh hoạt hơn SQL ở chỗ **không ép buộc schema ở tầng database**, nhưng:

- **Document có thể phình to** vượt giới hạn 16MB BSON → crash application
- **Query không có index** trên collection lớn → full collection scan → timeout
- **Sharding key chọn sai** → hot spot → 1 shard chịu 90% traffic trong khi các shard khác idle
- **Embed sai chỗ** → dữ liệu duplicate hàng triệu bản → update 1 field phải update hàng triệu document
- **Working set vượt RAM** → disk I/O tăng vọt → latency tăng gấp 100 lần

**Nói cách khác**: SQL database bắt bạn thiết kế đúng từ đầu (qua schema enforcement). MongoDB cho bạn tự do, nhưng tự do đi kèm trách nhiệm — nếu thiết kế sai, hệ thống sẽ "chết" từ từ khi data scale lên.

---

## 2. Tư Duy Thiết Kế: SQL vs MongoDB

### 2.1. Cách tiếp cận SQL (Data-Driven)

Với SQL, bạn thiết kế dựa trên **bản chất dữ liệu** — normalize hết mức có thể, loại bỏ redundancy.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Users      │     │  Professions │     │     Cars     │
├─────────────┤     ├──────────────┤     ├──────────────┤
│ id          │◄────│ user_id (FK) │     │ user_id (FK) │
│ first_name  │     │ profession   │     │ model        │
│ surname     │     └──────────────┘     │ year         │
│ cell        │                          └──────────────┘
│ city        │
└─────────────┘
```

Muốn lấy đầy đủ thông tin user → JOIN 3 bảng.

### 2.2. Cách tiếp cận MongoDB (Application-Driven)

Với MongoDB, bạn thiết kế dựa trên **cách ứng dụng sử dụng dữ liệu** — data mà luôn được đọc cùng nhau thì lưu cùng nhau.

```json
// Collection: users
{
  "_id": ObjectId("64a7b..."),
  "first_name": "Paul",
  "surname": "Miller",
  "cell": "447557505611",
  "city": "London",
  "location": [45.123, 47.232],
  "professions": ["banking", "finance", "trader"],
  "cars": [
    { "model": "Bentley", "year": 1973 },
    { "model": "Rolls Royce", "year": 1965 }
  ]
}
```

Chỉ **1 query** → lấy được tất cả data cần thiết cho trang profile user.

### 2.3. Câu hỏi cốt lõi trước khi thiết kế

Trước khi tạo bất kỳ collection nào, hãy trả lời 4 câu hỏi:

| Câu hỏi | Ảnh hưởng đến quyết định |
|---|---|
| Ứng dụng **đọc nhiều** hay **ghi nhiều**? | Read-heavy → ưu tiên embed (1 query). Write-heavy → ưu tiên reference (tránh update document lớn) |
| Dữ liệu nào **luôn được đọc cùng nhau**? | Data cùng access pattern → embed vào cùng document |
| **Cardinality** (số lượng) của quan hệ là bao nhiêu? | 1-Few → embed. 1-Thousands → reference. 1-Millions → parent reference |
| Dữ liệu **thay đổi thường xuyên** không? | Thay đổi ít → embed OK. Thay đổi nhiều → reference (tránh update cascading) |

---

## 3. Embed vs Reference - Quyết Định Cốt Lõi

Đây là quyết định quan trọng nhất khi thiết kế MongoDB schema. Mọi thứ khác đều xoay quanh nó.

### 3.1. Embedding (Nhúng)

Đưa toàn bộ data liên quan vào **trong cùng 1 document**.

```json
// Collection: orders
{
  "_id": ObjectId("ord_001"),
  "order_number": "ORD-2025-001",
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@gmail.com",
    "phone": "0901234567"
  },
  "items": [
    {
      "product_name": "iPhone 15 Pro",
      "sku": "IPH15P-256-BLK",
      "quantity": 1,
      "unit_price": 28990000,
      "subtotal": 28990000
    },
    {
      "product_name": "AirPods Pro 2",
      "sku": "APP2-WHT",
      "quantity": 2,
      "unit_price": 5990000,
      "subtotal": 11980000
    }
  ],
  "shipping_address": {
    "street": "123 Nguyễn Huệ",
    "ward": "Bến Nghé",
    "district": "Quận 1",
    "city": "TP.HCM"
  },
  "total_amount": 40970000,
  "status": "confirmed",
  "created_at": ISODate("2025-01-15T10:30:00Z")
}
```

**Khi nào nên embed:**

| Điều kiện | Giải thích |
|---|---|
| Data luôn được đọc cùng nhau | Khi load order → luôn cần items, address |
| Quan hệ 1-1 hoặc 1-Few | Customer info, shipping address, vài items |
| Data ít thay đổi sau khi tạo | Order items không đổi sau khi đặt hàng |
| Cần atomicity | Update cả order + items trong 1 operation |

**Ưu điểm:**
- 1 read operation lấy hết data
- Atomic update ở mức document (không cần transaction)
- Không cần `$lookup` (tốn performance)

**Hạn chế:**
- Document có thể phình to (limit 16MB)
- Data duplicate nếu cùng entity được embed ở nhiều nơi
- Không thể query/access embedded entity một cách độc lập

### 3.2. Referencing (Tham chiếu)

Lưu data ở **collection riêng biệt**, liên kết qua ObjectId.

```json
// Collection: products
{
  "_id": ObjectId("prod_001"),
  "name": "iPhone 15 Pro",
  "brand": "Apple",
  "category_id": ObjectId("cat_electronics"),
  "base_price": 28990000,
  "description": "...",
  "specifications": { "..." : "..." }
}

// Collection: reviews
{
  "_id": ObjectId("rev_001"),
  "product_id": ObjectId("prod_001"),    // <-- reference
  "user_id": ObjectId("user_042"),       // <-- reference
  "rating": 5,
  "title": "Sản phẩm tuyệt vời",
  "content": "Pin trâu, camera đẹp...",
  "helpful_count": 23,
  "created_at": ISODate("2025-02-10T08:00:00Z")
}
```

**Khi nào nên reference:**

| Điều kiện | Giải thích |
|---|---|
| Cần truy cập entity **độc lập** | Reviews hiển thị riêng, filter riêng, sort riêng |
| Cardinality **cao** (hundreds+) | 1 sản phẩm có hàng ngàn reviews |
| Data **thay đổi thường xuyên** | User đổi tên → nếu embed phải update tất cả orders |
| **Nhiều document** reference đến cùng 1 entity | Nhiều orders cùng reference đến 1 product |

**Ưu điểm:**
- Document nhỏ gọn, không lo vượt 16MB
- Không duplicate data
- Query/filter/sort entity độc lập dễ dàng

**Hạn chế:**
- Cần `$lookup` hoặc nhiều query để lấy data liên quan
- Không có atomicity tự nhiên giữa các collection (cần transaction)

### 3.3. Hybrid: Extended Reference Pattern

Trong thực tế, **nhiều khi bạn cần cả hai** — embed một phần data thường xuyên dùng, reference đến document đầy đủ.

```json
// Collection: orders
{
  "_id": ObjectId("ord_001"),
  "customer_id": ObjectId("user_042"),   // reference đến full user document
  "customer_snapshot": {                  // embed thông tin cần hiển thị
    "name": "Nguyễn Văn A",
    "email": "a@gmail.com"
  },
  "items": [
    {
      "product_id": ObjectId("prod_001"),  // reference đến full product
      "product_snapshot": {                 // embed thông tin tại thời điểm đặt hàng
        "name": "iPhone 15 Pro",
        "price_at_purchase": 28990000,
        "image_url": "/images/iph15pro.jpg"
      },
      "quantity": 1
    }
  ]
}
```

Tại sao? Vì khi hiển thị danh sách đơn hàng, bạn cần tên khách + tên sản phẩm ngay lập tức (không muốn `$lookup`), nhưng vẫn giữ reference để khi cần xem chi tiết đầy đủ thì có thể truy vấn.

**Đặc biệt quan trọng cho e-commerce**: Giá sản phẩm có thể thay đổi, nhưng order phải giữ nguyên giá tại thời điểm mua → `price_at_purchase` là snapshot, không phải live data.

---

## 4. Các Loại Quan Hệ Trong MongoDB

### 4.1. Quan hệ 1-1 (One-to-One)

**Pattern**: Embed trực tiếp dưới dạng key-value hoặc sub-document.

```json
// Collection: users
{
  "_id": ObjectId("user_001"),
  "name": "Trần Minh B",
  "email": "b@gmail.com",
  "driving_license": {
    "license_number": "079123456789",
    "class": "B2",
    "issued_date": ISODate("2020-06-15"),
    "expiry_date": ISODate("2030-06-15"),
    "issued_by": "Sở GTVT TP.HCM"
  }
}
```

Mỗi user chỉ có 1 bằng lái, mỗi bằng lái thuộc về 1 user → embed luôn.

**Ngoại lệ**: Nếu sub-document rất lớn (ví dụ: user profile 500 fields) nhưng hiếm khi cần đọc cùng → tách ra collection riêng để giữ document chính nhỏ gọn (giảm working set).

### 4.2. Quan hệ 1-Few (One-to-Few) — dưới ~20 items

**Pattern**: Embed array trong parent document.

```json
// Collection: users
{
  "_id": ObjectId("user_001"),
  "name": "Trần Minh B",
  "addresses": [
    {
      "label": "home",
      "street": "456 Lê Lợi",
      "ward": "Bến Thành",
      "district": "Quận 1",
      "city": "TP.HCM",
      "is_default": true
    },
    {
      "label": "office",
      "street": "789 Điện Biên Phủ",
      "ward": "Đa Kao",
      "district": "Quận 1",
      "city": "TP.HCM",
      "is_default": false
    }
  ]
}
```

Một user thường có 2-5 địa chỉ → embed. Khi load user profile luôn cần hiển thị danh sách địa chỉ.

### 4.3. Quan hệ 1-Many (One-to-Many) — hàng trăm đến hàng ngàn

**Pattern**: Tách collection riêng, **parent giữ array ObjectId references** hoặc **child giữ parent reference**.

**Cách 1: Parent giữ array references** (khi child count < vài ngàn)

```json
// Collection: products
{
  "_id": ObjectId("prod_bike"),
  "name": "Xe đạp Trek X-Caliber 8",
  "manufacturer": "Trek",
  "part_ids": [
    ObjectId("part_001"),
    ObjectId("part_002"),
    ObjectId("part_003")
    // ... có thể đến vài trăm parts
  ]
}

// Collection: parts
{
  "_id": ObjectId("part_001"),
  "part_number": "WHL-26-BLK",
  "name": "Bánh xe 26 inch",
  "category": "wheel",
  "cost": 1500000,
  "supplier": "Shimano"
}
```

**Cách 2: Child giữ parent reference** (khi child count rất lớn hoặc cần query children độc lập)

```json
// Collection: products
{
  "_id": ObjectId("prod_001"),
  "name": "iPhone 15 Pro"
}

// Collection: reviews  
{
  "_id": ObjectId("rev_001"),
  "product_id": ObjectId("prod_001"),  // child giữ reference đến parent
  "user_id": ObjectId("user_042"),
  "rating": 5,
  "content": "Rất hài lòng..."
}
```

Tại sao dùng cách 2 cho reviews? Vì 1 product có thể có **hàng ngàn reviews** → nếu lưu array ObjectId trong product → array phình to. Và review cần được query độc lập (filter by rating, sort by date, paginate...).

### 4.4. Quan hệ 1-Zillions (One-to-Millions)

**Pattern**: **Chỉ child giữ parent reference**. Tuyệt đối KHÔNG lưu array trong parent.

```json
// Collection: hosts
{
  "_id": ObjectId("host_web01"),
  "name": "web-server-01.production.com",
  "ip": "10.0.1.50",
  "os": "Ubuntu 22.04"
}

// Collection: logs (hàng triệu/tỷ documents)
{
  "_id": ObjectId("log_abc123"),
  "host_id": ObjectId("host_web01"),   // reference ngược lên parent
  "timestamp": ISODate("2025-01-15T10:30:00.123Z"),
  "level": "ERROR",
  "message": "Connection timeout to database pool",
  "metadata": {
    "service": "order-service",
    "trace_id": "abc-123-def"
  }
}
```

1 server có thể sinh ra **hàng tỷ log entries**. Nếu lưu array log_ids trong hosts document → vượt 16MB ngay lập tức. Giải pháp duy nhất: log document giữ `host_id` để reference ngược.

**Index quan trọng**: Phải tạo index trên `host_id` + `timestamp` để query logs theo server hiệu quả:

```javascript
db.logs.createIndex({ host_id: 1, timestamp: -1 })
```

### 4.5. Quan hệ Many-to-Many

**Pattern**: **Tham chiếu hai chiều** — mỗi bên giữ array ObjectId của bên kia.

```json
// Collection: students
{
  "_id": ObjectId("student_001"),
  "name": "Lê Văn C",
  "email": "c@university.edu",
  "enrolled_course_ids": [
    ObjectId("course_CS101"),
    ObjectId("course_MATH201"),
    ObjectId("course_ENG102")
  ]
}

// Collection: courses
{
  "_id": ObjectId("course_CS101"),
  "title": "Nhập môn Lập trình",
  "instructor": "PGS. Nguyễn D",
  "credits": 3,
  "student_ids": [
    ObjectId("student_001"),
    ObjectId("student_002"),
    ObjectId("student_015")
    // ... tối đa vài trăm students/class
  ]
}
```

1 student có thể đăng ký nhiều courses, 1 course có nhiều students.

**Lưu ý quan trọng**: Tham chiếu 2 chiều tạo ra **risk mất đồng bộ** — thêm student vào course nhưng quên thêm course vào student. Cần đảm bảo cả 2 bên được update trong cùng 1 transaction hoặc qua application logic.

**Alternative cho Many-to-Many quy mô lớn**: Dùng **junction collection** (giống junction table trong SQL):

```json
// Collection: enrollments (junction collection)
{
  "_id": ObjectId("enr_001"),
  "student_id": ObjectId("student_001"),
  "course_id": ObjectId("course_CS101"),
  "enrolled_at": ISODate("2025-01-10"),
  "grade": null,
  "status": "active"
}
```

Cách này tốt hơn khi:
- Quan hệ chứa **metadata riêng** (ngày đăng ký, điểm, trạng thái...)
- Cả 2 phía đều có **cardinality cao** (ngàn students × ngàn courses)
- Cần **query trên quan hệ** (tìm tất cả enrollments trong tháng 1, filter by grade...)

---

## 5. 5 Quy Tắc Vàng Khi Thiết Kế Schema

Đây là 5 quy tắc từ bài viết gốc, tôi giữ nguyên và bổ sung giải thích sâu hơn:

### Quy tắc 1: Ưu tiên embed trừ khi có lý do thuyết phục để không làm

```
Mặc định → embed
Chỉ reference khi: document quá lớn / cần truy cập độc lập / data thay đổi thường xuyên
```

**Lý do**: MongoDB được tối ưu cho single-document read. 1 read duy nhất lấy hết data từ 1 document luôn nhanh hơn 2 reads + `$lookup`.

### Quy tắc 2: Khi cần truy cập entity độc lập → không embed

Nếu entity có **lifecycle riêng** (tạo, update, delete, query riêng) → tách collection.

```
Reviews: cần filter by rating, sort by date, paginate → tách collection
Addresses: chỉ hiển thị cùng user profile → embed trong user
```

### Quy tắc 3: Tránh `$lookup` nếu có thể, nhưng đừng sợ nếu nó cho schema tốt hơn

`$lookup` (tương đương JOIN) trong MongoDB **tốn performance hơn JOIN trong SQL** vì MongoDB không được thiết kế để optimize cross-collection joins. Nhưng đôi khi reference + `$lookup` vẫn tốt hơn embed sai chỗ.

### Quy tắc 4: Array không nên phát triển vô hạn

| Cardinality | Chiến lược | Ví dụ |
|---|---|---|
| < 20 items | Embed array trực tiếp | User addresses |
| 20 - vài trăm | Embed hoặc array ObjectId references | Product variants, order items |
| Vài trăm - vài ngàn | Array ObjectId references trong parent | Product parts |
| > vài ngàn | Child giữ parent reference (KHÔNG dùng array trong parent) | Logs, reviews, comments |

### Quy tắc 5: Thiết kế phụ thuộc vào cách ứng dụng sử dụng dữ liệu

Đây là quy tắc **quan trọng nhất**. 2 ứng dụng khác nhau sử dụng cùng loại data nhưng có thể có schema hoàn toàn khác:

```
App A (E-commerce): Hiển thị product page → cần product + reviews + ratings cùng lúc
  → Có thể embed tóm tắt reviews (top 3 recent) trong product

App B (Review platform): Focus vào reviews → cần search, filter, sort reviews
  → Bắt buộc tách reviews thành collection riêng
```

---

## 6. Advanced Design Patterns

Phần này **không có trong bài viết gốc** nhưng cực kỳ quan trọng cho hệ thống production.

### 6.1. Bucket Pattern

**Vấn đề**: Dữ liệu time-series (IoT sensor data, stock prices, analytics events) — mỗi data point 1 document thì quá nhiều documents, index quá lớn.

**Giải pháp**: Gom nhiều data points vào 1 "bucket" document theo khoảng thời gian.

```json
// KHÔNG nên: 1 document / measurement → hàng tỷ documents
{ "sensor_id": "temp_01", "timestamp": "2025-01-15T10:00:00Z", "value": 22.5 }
{ "sensor_id": "temp_01", "timestamp": "2025-01-15T10:00:01Z", "value": 22.6 }
// ... hàng tỷ documents ...

// NÊN: Bucket Pattern → 1 document / sensor / giờ
// Collection: sensor_readings
{
  "_id": ObjectId("bucket_001"),
  "sensor_id": "temp_01",
  "bucket_start": ISODate("2025-01-15T10:00:00Z"),
  "bucket_end": ISODate("2025-01-15T10:59:59Z"),
  "measurement_count": 3600,
  "measurements": [
    { "timestamp": ISODate("2025-01-15T10:00:00Z"), "value": 22.5 },
    { "timestamp": ISODate("2025-01-15T10:00:01Z"), "value": 22.6 },
    // ... 3600 measurements trong 1 giờ
  ],
  "summary": {
    "avg": 22.8,
    "min": 21.2,
    "max": 24.1
  }
}
```

**Lợi ích**:
- Giảm số documents từ hàng tỷ → hàng triệu (÷3600)
- Giảm index size tương ứng
- Pre-computed `summary` → query aggregate nhanh hơn nhiều lần
- Phù hợp cho: IoT, analytics, monitoring, time-series data

### 6.2. Computed Pattern

**Vấn đề**: Phải tính toán aggregate data mỗi lần query (đếm reviews, tính average rating...) → tốn CPU mỗi read.

**Giải pháp**: Pre-compute và lưu kết quả vào document, cập nhật khi data thay đổi.

```json
// Collection: products
{
  "_id": ObjectId("prod_001"),
  "name": "iPhone 15 Pro",
  "price": 28990000,
  
  // Computed fields — cập nhật mỗi khi có review mới
  "review_stats": {
    "total_count": 1247,
    "average_rating": 4.6,
    "rating_distribution": {
      "5": 823,
      "4": 256,
      "3": 98,
      "2": 45,
      "1": 25
    },
    "last_updated": ISODate("2025-01-15T12:00:00Z")
  }
}
```

Khi user thêm review mới → atomic update:

```javascript
db.products.updateOne(
  { _id: ObjectId("prod_001") },
  {
    $inc: { 
      "review_stats.total_count": 1,
      "review_stats.rating_distribution.5": 1  
    },
    $set: { "review_stats.last_updated": new Date() }
    // average_rating cần tính lại hoặc dùng incremental average
  }
)
```

**Lợi ích**: Trang product listing hiển thị rating ngay lập tức, không cần `$lookup` + `$group` trên collection reviews mỗi request.

### 6.3. Subset Pattern

**Vấn đề**: Document chứa quá nhiều data nhưng ứng dụng thường chỉ cần một phần nhỏ → toàn bộ document phải load vào memory (working set).

**Giải pháp**: Giữ subset (phần nhỏ hay dùng) trong main document, phần còn lại ở collection riêng.

```json
// Collection: products (main — luôn trong working set)
{
  "_id": ObjectId("prod_001"),
  "name": "iPhone 15 Pro",
  "price": 28990000,
  "thumbnail": "/images/iph15pro-thumb.jpg",
  "rating_avg": 4.6,
  "rating_count": 1247,
  
  // Subset: chỉ giữ 10 reviews mới nhất
  "recent_reviews": [
    {
      "user_name": "Nguyễn A",
      "rating": 5,
      "content": "Pin trâu, camera đẹp...",
      "created_at": ISODate("2025-01-15")
    }
    // ... tối đa 10 reviews
  ]
}

// Collection: reviews (full — chỉ load khi user click "Xem tất cả reviews")
{
  "_id": ObjectId("rev_001"),
  "product_id": ObjectId("prod_001"),
  "user_id": ObjectId("user_042"),
  "user_name": "Nguyễn A",
  "rating": 5,
  "content": "Pin trâu, camera đẹp...",
  "created_at": ISODate("2025-01-15"),
  "helpful_count": 23,
  "images": ["url1", "url2"]
}
```

**Lợi ích**: Product document nhỏ gọn, load nhanh. Khi hiển thị product page → đã có sẵn 10 reviews mới nhất. Chỉ khi user muốn xem thêm mới query collection reviews.

### 6.4. Outlier Pattern

**Vấn đề**: Phần lớn documents có cardinality thấp nhưng **một số ít** có cardinality cực cao (ví dụ: 99% users có < 50 followers, nhưng celebrity có 10 triệu followers).

**Giải pháp**: Embed cho trường hợp thường, overflow sang collection riêng cho outliers.

```json
// Collection: users — trường hợp thường (99% users)
{
  "_id": ObjectId("user_normal"),
  "name": "Người bình thường",
  "follower_ids": [
    ObjectId("u1"), ObjectId("u2"), ObjectId("u3")
    // ... < 50 followers → embed OK
  ],
  "has_overflow": false
}

// Collection: users — celebrity (outlier)
{
  "_id": ObjectId("user_celebrity"),
  "name": "Sơn Tùng MTP",
  "follower_ids": [
    // Chỉ giữ 50 followers gần nhất
  ],
  "has_overflow": true    // flag báo hiệu có overflow
}

// Collection: followers_overflow (chỉ cho outliers)
{
  "_id": ObjectId("overflow_001"),
  "user_id": ObjectId("user_celebrity"),
  "follower_ids": [
    // batch 1000 followers
  ],
  "batch_number": 1
}
```

**Application logic**: Check `has_overflow` flag → nếu `true` thì query thêm `followers_overflow` collection.

### 6.5. Polymorphic Pattern

**Vấn đề**: Nhiều entity có cấu trúc **gần giống nhau** nhưng không hoàn toàn giống (ví dụ: các loại sản phẩm khác nhau — điện thoại có `screen_size`, áo có `size/color`, sách có `isbn`).

**Giải pháp**: Lưu tất cả trong **cùng 1 collection**, phân biệt bằng field `type`.

```json
// Collection: products — Polymorphic
// Document 1: Điện thoại
{
  "_id": ObjectId("prod_phone"),
  "type": "phone",
  "name": "iPhone 15 Pro",
  "brand": "Apple",
  "price": 28990000,
  "attributes": {
    "screen_size": "6.1 inch",
    "storage": "256GB",
    "ram": "8GB",
    "battery": "3274mAh",
    "os": "iOS 17"
  }
}

// Document 2: Quần áo
{
  "_id": ObjectId("prod_shirt"),
  "type": "clothing",
  "name": "Áo thun unisex",
  "brand": "Uniqlo",
  "price": 299000,
  "attributes": {
    "size": ["S", "M", "L", "XL"],
    "color": ["Trắng", "Đen", "Xám"],
    "material": "Cotton 100%"
  }
}

// Document 3: Sách
{
  "_id": ObjectId("prod_book"),
  "type": "book",
  "name": "Clean Code",
  "brand": "Robert C. Martin",
  "price": 450000,
  "attributes": {
    "isbn": "978-0132350884",
    "pages": 464,
    "language": "English",
    "publisher": "Prentice Hall"
  }
}
```

**Lợi ích**: Query tất cả products cùng 1 collection, filter by `type` khi cần. Tận dụng được MongoDB schema flexibility — mỗi type có attributes khác nhau mà không cần tạo collection riêng.

### 6.6. Schema Versioning Pattern

**Vấn đề**: Schema thay đổi theo thời gian, nhưng documents cũ vẫn tồn tại trong collection với schema cũ.

**Giải pháp**: Thêm field `schema_version` vào mỗi document.

```json
// Version 1 — ban đầu
{
  "_id": ObjectId("user_old"),
  "schema_version": 1,
  "name": "Nguyễn Văn A",
  "address": "123 Nguyễn Huệ, Q1, TP.HCM"   // string đơn giản
}

// Version 2 — sau khi refactor
{
  "_id": ObjectId("user_new"),
  "schema_version": 2,
  "first_name": "Nguyễn",
  "last_name": "Văn A",
  "address": {                                 // structured object
    "street": "123 Nguyễn Huệ",
    "district": "Quận 1",
    "city": "TP.HCM"
  }
}
```

**Application logic**: Check `schema_version` → transform data tương ứng. Có thể migrate dần (lazy migration: update document khi nó được read) hoặc batch migration.

---

## 7. Indexing Strategy

**Bài viết gốc không đề cập indexing** — đây là thiếu sót lớn vì schema design và indexing strategy phải đi cùng nhau.

### 7.1. ESR Rule (Equality → Sort → Range)

Thứ tự fields trong compound index ảnh hưởng trực tiếp đến performance:

```javascript
// Query phổ biến: tìm orders của 1 user, sort theo ngày, trong khoảng thời gian
db.orders.find({
  user_id: ObjectId("user_001"),        // Equality
  created_at: { $gte: startDate, $lte: endDate }  // Range
}).sort({ created_at: -1 })             // Sort

// Index tối ưu theo ESR Rule:
db.orders.createIndex({ 
  user_id: 1,       // E - Equality first
  created_at: -1    // S & R - Sort + Range cùng field → 1 field đủ
})
```

### 7.2. Các loại index quan trọng

```javascript
// 1. Single Field Index
db.users.createIndex({ email: 1 }, { unique: true })

// 2. Compound Index (đa trường)
db.products.createIndex({ category_id: 1, price: 1, rating_avg: -1 })

// 3. Multikey Index (cho array fields)
db.products.createIndex({ "tags": 1 })
// Tự động index mỗi element trong array tags

// 4. Text Index (full-text search)
db.products.createIndex({ 
  name: "text", 
  description: "text" 
}, {
  weights: { name: 10, description: 5 }   // name quan trọng hơn
})

// 5. TTL Index (auto-delete documents sau N giây)
db.sessions.createIndex(
  { created_at: 1 }, 
  { expireAfterSeconds: 86400 }  // tự xóa sau 24h
)

// 6. Partial Index (chỉ index documents thỏa điều kiện)
db.orders.createIndex(
  { status: 1, created_at: -1 },
  { partialFilterExpression: { status: "pending" } }
  // Chỉ index orders có status "pending" → index nhỏ hơn nhiều
)

// 7. Wildcard Index (cho dynamic schema)
db.products.createIndex({ "attributes.$**": 1 })
// Index tất cả fields bên trong attributes object
```

### 7.3. Covered Query — Query không cần đọc document

Khi tất cả fields trong query + projection đều nằm trong index → MongoDB trả kết quả chỉ từ index, không cần đọc document từ disk.

```javascript
// Index:
db.products.createIndex({ category_id: 1, name: 1, price: 1 })

// Covered query — chỉ cần data từ index:
db.products.find(
  { category_id: ObjectId("cat_01") },
  { name: 1, price: 1, _id: 0 }           // projection chỉ lấy fields trong index
)
// executionStats.totalDocsExamined = 0 ← không đọc document nào!
```

### 7.4. Explain — Luôn kiểm tra query plan

```javascript
db.orders.find({ user_id: ObjectId("user_001") })
  .sort({ created_at: -1 })
  .explain("executionStats")

// Quan tâm:
// - winningPlan.stage: nên là "IXSCAN" (không phải "COLLSCAN")
// - totalDocsExamined / totalKeysExamined: càng gần nDocsReturned càng tốt
// - executionTimeMillis: thời gian thực thi
```

---

## 8. Schema Versioning & Migration

### 8.1. Lazy Migration

Không migrate tất cả documents cùng lúc. Thay vào đó, **migrate mỗi document khi nó được read**.

```javascript
// Application logic
function getUser(userId) {
  const user = db.users.findOne({ _id: userId });
  
  if (user.schema_version === 1) {
    // Transform V1 → V2
    const migrated = migrateUserV1toV2(user);
    db.users.updateOne({ _id: userId }, { $set: migrated });
    return migrated;
  }
  
  return user;
}
```

**Ưu điểm**: Không cần downtime, migration diễn ra dần dần.
**Nhược điểm**: Application code phải handle nhiều versions cùng lúc.

### 8.2. Background Migration

Chạy script migration trong background cho documents cũ:

```javascript
// Migration script — chạy off-peak hours
const cursor = db.users.find({ schema_version: 1 }).batchSize(1000);

while (cursor.hasNext()) {
  const batch = [];
  for (let i = 0; i < 1000 && cursor.hasNext(); i++) {
    const user = cursor.next();
    batch.push({
      updateOne: {
        filter: { _id: user._id, schema_version: 1 },
        update: { $set: migrateUserV1toV2(user) }
      }
    });
  }
  db.users.bulkWrite(batch, { ordered: false });
}
```

---

## 9. Anti-Patterns Cần Tránh

**Bài viết gốc không đề cập** — nhưng biết anti-patterns quan trọng không kém biết best practices.

### 9.1. Massive Arrays (Mảng khổng lồ)

```json
// ANTI-PATTERN: Lưu tất cả follower_ids trong user document
{
  "_id": ObjectId("celebrity"),
  "name": "Sơn Tùng MTP",
  "follower_ids": [
    // 10 triệu ObjectIds × 12 bytes = ~120MB → VƯỢT 16MB limit!
  ]
}
```

**Hậu quả**:
- Vượt 16MB BSON limit → write fail
- Mỗi update (thêm/xóa 1 follower) phải rewrite toàn bộ array → slow
- Document quá lớn → working set bị ăn hết RAM

**Fix**: Child reference (follower giữ `following_id`) hoặc Outlier Pattern.

### 9.2. Unnecessary Indexes

```javascript
// ANTI-PATTERN: Index mọi field "phòng hờ"
db.users.createIndex({ name: 1 })
db.users.createIndex({ email: 1 })
db.users.createIndex({ phone: 1 })
db.users.createIndex({ city: 1 })
db.users.createIndex({ created_at: 1 })
db.users.createIndex({ name: 1, email: 1 })
db.users.createIndex({ email: 1, name: 1 })  // khác thứ tự = khác index!
```

**Hậu quả**:
- Mỗi write (insert/update/delete) phải update TẤT CẢ indexes → write chậm
- Index chiếm RAM → giảm RAM cho working set → read cũng chậm

**Fix**: Chỉ tạo index cho queries thực tế. Dùng `db.collection.getIndexes()` và loại bỏ unused indexes.

### 9.3. Bloated Documents (Document phình to)

```json
// ANTI-PATTERN: Embed quá nhiều data ít dùng
{
  "_id": ObjectId("user_001"),
  "name": "Nguyễn A",
  "email": "a@gmail.com",
  // ... 50 fields user info thường dùng ...
  
  // Ít khi cần nhưng lưu trong document:
  "login_history": [ /* 10,000 login records */ ],
  "notification_settings": { /* 200 lines of config */ },
  "activity_log": [ /* 50,000 activity entries */ ]
}
```

**Hậu quả**: Mỗi lần đọc user (ví dụ chỉ cần name + email) → phải load toàn bộ document ~5MB vào RAM.

**Fix**: Tách `login_history`, `activity_log` ra collection riêng. Giữ document chính nhỏ gọn.

### 9.4. Case-Sensitive Duplicates

```json
// ANTI-PATTERN: Không normalize trước khi lưu
{ "email": "John@Gmail.COM" }
{ "email": "john@gmail.com" }
// → 2 documents cho cùng 1 user!
```

**Fix**: Normalize (lowercase) trước khi insert. Dùng collation cho case-insensitive unique index:

```javascript
db.users.createIndex(
  { email: 1 }, 
  { unique: true, collation: { locale: "en", strength: 2 } }
)
```

### 9.5. Separating Data That Is Accessed Together

```json
// ANTI-PATTERN: Tách quá mức (kiểu SQL) trong MongoDB
// Collection: users
{ "_id": ObjectId("u1"), "name": "Nguyễn A" }

// Collection: user_emails  
{ "user_id": ObjectId("u1"), "email": "a@gmail.com" }

// Collection: user_phones
{ "user_id": ObjectId("u1"), "phone": "0901234567" }
```

User profile page cần cả 3 → 3 queries thay vì 1. Đây là **mang tư duy SQL sang MongoDB** — bài viết gốc đã cảnh báo đúng về điều này.

**Fix**: Embed email + phone trực tiếp trong user document.

---

## 10. Sharding Key Selection

Khi collection đủ lớn cần horizontal scaling, **chọn shard key** là quyết định không thể thay đổi sau này (trước MongoDB 5.0) và ảnh hưởng cực lớn đến performance.

### 10.1. Tiêu chí chọn shard key tốt

| Tiêu chí | Giải thích | Ví dụ tốt | Ví dụ xấu |
|---|---|---|---|
| **High cardinality** | Nhiều giá trị unique → phân tán đều | `user_id`, `order_id` | `status` (chỉ 5 giá trị), `country` |
| **Write distribution** | Writes phân tán đều các shards | `hashed(_id)` | `created_at` (monotonic → hot spot) |
| **Query isolation** | Queries thường filter theo shard key → chỉ hit 1 shard | `tenant_id` (multi-tenant app) | Random field không dùng trong query |

### 10.2. Ví dụ thực tế

```javascript
// E-commerce orders — chọn shard key

// XẤU: shard theo created_at → inserts dồn vào shard mới nhất (hot spot)
sh.shardCollection("ecommerce.orders", { created_at: 1 })

// TỐT: shard theo user_id (hashed) → phân tán đều
sh.shardCollection("ecommerce.orders", { user_id: "hashed" })

// TỐT NHẤT: compound shard key phù hợp query pattern
// Nếu queries thường filter: user_id + created_at
sh.shardCollection("ecommerce.orders", { user_id: 1, created_at: 1 })
```

---

## 11. Transaction & Consistency Considerations

### 11.1. Single Document Atomicity

MongoDB đảm bảo **atomicity ở mức single document** — đây là lý do lớn nhất để ưu tiên embed.

```javascript
// Atomic: update order status + add status history trong cùng 1 document
db.orders.updateOne(
  { _id: orderId },
  {
    $set: { status: "shipped" },
    $push: { 
      status_history: {
        status: "shipped",
        changed_at: new Date(),
        changed_by: "system"
      }
    }
  }
)
// → Hoặc cả 2 thay đổi đều apply, hoặc không thay đổi gì cả
```

### 11.2. Multi-Document Transaction (từ MongoDB 4.0+)

Khi phải update nhiều documents across collections:

```javascript
const session = client.startSession();
session.startTransaction();

try {
  // Trừ inventory
  await db.inventory.updateOne(
    { product_id: productId, quantity: { $gte: orderQty } },
    { $inc: { quantity: -orderQty } },
    { session }
  );
  
  // Tạo order
  await db.orders.insertOne({
    product_id: productId,
    quantity: orderQty,
    status: "confirmed"
  }, { session });
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**Chi phí transaction**: Multi-document transactions trong MongoDB **tốn performance hơn** single-document operations. Nếu có thể thiết kế schema để tránh cần transaction → hãy làm. Đây là lý do embed được ưu tiên.

### 11.3. Read/Write Concern

| Level | Read Concern | Write Concern | Trade-off |
|---|---|---|---|
| Nhanh nhất | `"local"` | `{ w: 1 }` | Có thể đọc data chưa replicate, write có thể mất nếu primary crash |
| Cân bằng | `"majority"` | `{ w: "majority" }` | Đảm bảo data đã replicate đến majority of nodes |
| An toàn nhất | `"linearizable"` | `{ w: "majority", j: true }` | Chậm nhất, nhưng đảm bảo consistency tuyệt đối |

Đối với e-commerce:
- **Payment, inventory**: `w: "majority"` — không chấp nhận mất data
- **Analytics, logs**: `w: 1` — chấp nhận mất vài records để đổi lấy throughput

---

## 12. Đánh Giá Bài Viết Gốc & Tổng Kết

### 12.1. Đánh giá bài viết của Dư Thanh Được

| Tiêu chí | Đánh giá | Chi tiết |
|---|---|---|
| **Nền tảng cơ bản** | Rất tốt | 5 quy tắc vàng rõ ràng, dễ hiểu, đúng chất MongoDB |
| **Phân loại quan hệ** | Xuất sắc | 1-1, 1-Few, 1-Many, 1-Zillions, Many-to-Many — đầy đủ các trường hợp |
| **Ví dụ minh họa** | Tốt | Ví dụ cụ thể, dễ hình dung (user, products, parts, log) |
| **Embed vs Reference** | Tốt | Nêu rõ ưu/nhược, tuy nhiên chưa có pattern Hybrid (Extended Reference) |
| **Advanced Patterns** | Thiếu | Không có Bucket, Computed, Subset, Outlier, Polymorphic, Schema Versioning |
| **Indexing Strategy** | Thiếu | Không đề cập — đây là yếu tố quyết định performance ngang với schema design |
| **Anti-patterns** | Thiếu | Không cảnh báo các lỗi phổ biến (massive arrays, bloated docs...) |
| **Transaction** | Thiếu | Không giải thích tại sao single-document atomicity là lý do lớn để embed |
| **Sharding** | Thiếu | Không đề cập shard key selection — crucial cho horizontal scaling |
| **Production readiness** | Chưa đủ | Bài viết phù hợp cho beginner, cần bổ sung nhiều cho production |

**Tổng quan**: Bài viết gốc là **nền tảng tốt cho người mới bắt đầu** với MongoDB. 5 quy tắc và cách phân loại quan hệ rất dễ hiểu và áp dụng. Tuy nhiên, khi đưa vào production với hệ thống lớn, cần bổ sung thêm kiến thức về Advanced Patterns, Indexing, Anti-patterns, và Scaling considerations.

### 12.2. Decision Flowchart — Tóm tắt quyết định thiết kế

```
                    ┌─────────────────────┐
                    │  Có quan hệ giữa    │
                    │  2 loại data?        │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │  Cardinality?        │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────────┐
              │              │                   │
         1-1 / 1-Few    1-Many             1-Zillions
              │         (100~1000s)         (millions+)
              │              │                   │
              ▼              │                   ▼
        ┌──────────┐        │          ┌────────────────┐
        │  EMBED   │        │          │ Child giữ      │
        │  trực    │        │          │ parent ref     │
        │  tiếp    │        │          │ (KHÔNG array   │
        └──────────┘        │          │ trong parent)  │
                            │          └────────────────┘
                   ┌────────▼────────────┐
                   │ Cần truy cập child  │
                   │ độc lập?            │
                   └────────┬────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                   YES              NO
                    │               │
                    ▼               ▼
            ┌──────────────┐  ┌──────────┐
            │  Reference   │  │  Embed   │
            │  (collection │  │  array   │
            │  riêng)      │  │  trong   │
            └──────────────┘  │  parent  │
                              └──────────┘
```

### 12.3. Checklist trước khi deploy schema

- [ ] Mỗi document < 16MB (tính cả growth theo thời gian)
- [ ] Không có array nào grow unbounded
- [ ] Có index cho mọi query pattern phổ biến
- [ ] Đã chạy `.explain()` cho top 10 queries quan trọng nhất
- [ ] Working set (hot data) fit trong RAM
- [ ] Schema versioning field có sẵn cho migration sau này
- [ ] Write concern phù hợp cho mỗi loại data (critical vs non-critical)
- [ ] Shard key đã chọn (nếu cần sharding) có high cardinality và phù hợp query pattern
- [ ] Không embed data thay đổi thường xuyên ở nhiều nơi (tránh update cascading)
- [ ] Có strategy cho data growth: TTL index cho expiring data, archival cho historical data

---

## Tài Liệu Tham Khảo

- [Thiết kế cơ sở dữ liệu bằng MongoDB sao cho chuẩn — Dư Thanh Được](https://duthanhduoc.com/blog/thiet-ke-co-so-du-lieu-voi-mongodb)
- [MongoDB Data Modeling Official Documentation](https://www.mongodb.com/docs/manual/data-modeling/)
- [MongoDB University — M320: Data Modeling](https://university.mongodb.com/)
- [Building with Patterns — MongoDB Blog Series](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [6 Rules of Thumb for MongoDB Schema Design](https://www.mongodb.com/blog/post/6-rules-of-thumb-for-mongodb-schema-design-part-1)
- [MongoDB Schema Design Anti-Patterns](https://www.mongodb.com/developer/products/mongodb/schema-design-anti-pattern-summary/)
- [Performance Best Practices: Indexing](https://www.mongodb.com/blog/post/performance-best-practices-indexing)
