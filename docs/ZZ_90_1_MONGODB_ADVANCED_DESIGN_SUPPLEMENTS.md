# MongoDB Advanced Design — Nội Dung Bổ Sung

> **Tài liệu bổ sung cho**: [ZZ_90_MONGODB_COLLECTION_DESIGN_PRINCIPLES.md](./ZZ_90_MONGODB_COLLECTION_DESIGN_PRINCIPLES.md)
>
> File gốc đã cover tốt phần cơ bản đến intermediate. File này bổ sung **các chủ đề nâng cao** còn thiếu, hướng đến production-grade MongoDB design.

---

## Mục Lục

1. [Schema Validation (JSON Schema)](#1-schema-validation-json-schema)
2. [Time Series Collections (MongoDB 5.0+)](#2-time-series-collections-mongodb-50)
3. [Aggregation Pipeline Design Considerations](#3-aggregation-pipeline-design-considerations)
4. [Change Streams & Real-time Data](#4-change-streams--real-time-data)
5. [Atlas Search vs Native Text Index](#5-atlas-search-vs-native-text-index)
6. [Advanced Design Patterns Bổ Sung](#6-advanced-design-patterns-bổ-sung)
7. [Indexing Nâng Cao](#7-indexing-nâng-cao)
8. [Sharding Nâng Cao](#8-sharding-nâng-cao)
9. [Transaction & Consistency Nâng Cao](#9-transaction--consistency-nâng-cao)
10. [Multi-tenancy Schema Design](#10-multi-tenancy-schema-design)
11. [Data Archival & Lifecycle Management](#11-data-archival--lifecycle-management)
12. [Performance Sizing Guidelines](#12-performance-sizing-guidelines)
13. [Real-world E-commerce Case Study](#13-real-world-e-commerce-case-study)

---

## 1. Schema Validation (JSON Schema)

File gốc nói "NoSQL ≠ không cần schema" nhưng **không đề cập Schema Validation** — tính năng cho phép enforce schema rules ở tầng database, đảm bảo data integrity mà không phụ thuộc hoàn toàn vào application logic.

### 1.1. Tại sao cần Schema Validation?

MongoDB flexible schema là ưu điểm, nhưng cũng là rủi ro:

```
Application A ghi: { "price": 29990000, "status": "active" }
Application B ghi: { "price": "29990000", "status": 1 }
Script import ghi: { "price": 29990000 }  ← typo field name
```

Không có validation → 3 dạng data khác nhau trong cùng collection → query sai, aggregation sai, application crash.

**Schema Validation giải quyết**: Enforce rules ở tầng database — bất kể data đến từ đâu (app, script, admin tool), đều phải tuân thủ.

### 1.2. Cú pháp cơ bản

```javascript
db.createCollection('products', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      title: 'Product Validation',
      required: ['name', 'price', 'category_id', 'status', 'created_at'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'Tên sản phẩm — bắt buộc, string, 1-500 ký tự',
        },
        price: {
          bsonType: 'number',
          minimum: 0,
          description: 'Giá sản phẩm — bắt buộc, số không âm',
        },
        category_id: {
          bsonType: 'objectId',
          description: 'ID category — bắt buộc',
        },
        status: {
          bsonType: 'string',
          enum: ['draft', 'active', 'inactive', 'deleted'],
          description: 'Trạng thái — chỉ chấp nhận 4 giá trị',
        },
        tags: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          maxItems: 50,
          uniqueItems: true,
          description: 'Tags — array of unique strings, tối đa 50',
        },
        specifications: {
          bsonType: 'object',
          description: 'Thông số kỹ thuật — flexible object',
        },
        created_at: {
          bsonType: 'date',
          description: 'Ngày tạo — bắt buộc',
        },
      },
      additionalProperties: false, // Không cho phép fields ngoài danh sách
    },
  },
  validationLevel: 'strict', // Áp dụng cho cả insert lẫn update
  validationAction: 'error', // Reject document không hợp lệ (thay vì chỉ warning)
})
```

### 1.3. Validation cho Nested Documents

```javascript
// Validation cho embedded address
{
  $jsonSchema: {
    bsonType: "object",
    required: ["name", "email"],
    properties: {
      name: { bsonType: "string" },
      email: {
        bsonType: "string",
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      },
      addresses: {
        bsonType: "array",
        maxItems: 10,
        items: {
          bsonType: "object",
          required: ["street", "city"],
          properties: {
            label: { bsonType: "string", enum: ["home", "office", "other"] },
            street: { bsonType: "string", minLength: 1 },
            ward: { bsonType: "string" },
            district: { bsonType: "string" },
            city: { bsonType: "string", minLength: 1 },
            is_default: { bsonType: "bool" }
          }
        }
      }
    }
  }
}
```

### 1.4. validationLevel & validationAction

| `validationLevel`     | Hành vi                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `"strict"` (mặc định) | Validate tất cả inserts VÀ updates                                                                              |
| `"moderate"`          | Validate inserts + chỉ validate updates trên documents đã hợp lệ sẵn. Documents cũ không hợp lệ vẫn update được |

| `validationAction`   | Hành vi                                                  |
| -------------------- | -------------------------------------------------------- |
| `"error"` (mặc định) | Reject document không hợp lệ                             |
| `"warn"`             | Cho phép insert/update nhưng ghi warning vào MongoDB log |

**Migration strategy**: Khi thêm validation vào collection có sẵn data cũ không hợp lệ:

```javascript
// Bước 1: Dùng "moderate" + "warn" để phát hiện data cũ không hợp lệ
db.runCommand({
  collMod: 'products',
  validator: {
    $jsonSchema: {
      /* ... */
    },
  },
  validationLevel: 'moderate',
  validationAction: 'warn',
})

// Bước 2: Fix data cũ dần dần (lazy hoặc batch migration)

// Bước 3: Chuyển sang "strict" + "error" khi data đã clean
db.runCommand({
  collMod: 'products',
  validator: {
    $jsonSchema: {
      /* ... */
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
})
```

### 1.5. Khi nào KHÔNG nên dùng Schema Validation

- **Polymorphic collections** có nhiều document types khác nhau → validation quá phức tạp hoặc làm mất tính flexible. Có thể validate ở application level.
- **Staging/import collections** nhận raw data từ nhiều nguồn → validate ở application trước khi move sang production collection.
- **Schema thay đổi rất thường xuyên** trong giai đoạn early development → validation trở thành overhead.

---

## 2. Time Series Collections (MongoDB 5.0+)

File gốc có Bucket Pattern (section 6.1) nhưng **không đề cập Time Series Collections** — tính năng native của MongoDB 5.0+ được tối ưu riêng cho time-series data, trong nhiều trường hợp **thay thế hoàn toàn Bucket Pattern**.

### 2.1. Bucket Pattern vs Time Series Collections

```
Trước MongoDB 5.0:
  → Developer tự implement Bucket Pattern (thủ công, error-prone)

Từ MongoDB 5.0:
  → MongoDB tự động "bucket" bên trong engine (tối ưu hơn, zero-effort)
```

| So sánh            | Bucket Pattern (thủ công)            | Time Series Collection (native)                       |
| ------------------ | ------------------------------------ | ----------------------------------------------------- |
| Setup              | Developer tự viết logic gom bucket   | `db.createCollection({ timeseries: ... })`            |
| Compression        | Không                                | Tự động columnar compression (tiết kiệm 90%+ storage) |
| Insert logic       | Developer phải check bucket → upsert | Insert bình thường, engine tự tối ưu                  |
| Query optimization | Developer tự thêm summary fields     | Engine tự optimize aggregation trên time-series       |
| Maintenance        | Phải tự manage bucket lifecycle      | Automatic                                             |

### 2.2. Tạo Time Series Collection

```javascript
db.createCollection('sensor_readings', {
  timeseries: {
    timeField: 'timestamp', // BẮT BUỘC: field chứa thời gian
    metaField: 'metadata', // TÙY CHỌN: field chứa metadata (sensor_id, location...)
    granularity: 'seconds', // TÙY CHỌN: "seconds" | "minutes" | "hours"
  },
  expireAfterSeconds: 2592000, // TÙY CHỌN: auto-delete sau 30 ngày (TTL)
})
```

### 2.3. Ví dụ thực tế: IoT Sensor Monitoring

```javascript
// Insert — giống collection bình thường
db.sensor_readings.insertMany([
  {
    timestamp: ISODate('2025-01-15T10:30:00.123Z'),
    metadata: { sensor_id: 'temp_01', location: 'warehouse_A', type: 'temperature' },
    value: 22.5,
    unit: 'celsius',
  },
  {
    timestamp: ISODate('2025-01-15T10:30:01.456Z'),
    metadata: { sensor_id: 'temp_01', location: 'warehouse_A', type: 'temperature' },
    value: 22.6,
    unit: 'celsius',
  },
  {
    timestamp: ISODate('2025-01-15T10:30:00.789Z'),
    metadata: { sensor_id: 'humid_01', location: 'warehouse_A', type: 'humidity' },
    value: 65.2,
    unit: 'percent',
  },
])

// Query — giống collection bình thường
db.sensor_readings
  .find({
    'metadata.sensor_id': 'temp_01',
    timestamp: {
      $gte: ISODate('2025-01-15T10:00:00Z'),
      $lt: ISODate('2025-01-15T11:00:00Z'),
    },
  })
  .sort({ timestamp: 1 })

// Aggregation — MongoDB tự tối ưu cho time-series
db.sensor_readings.aggregate([
  {
    $match: {
      'metadata.sensor_id': 'temp_01',
      timestamp: { $gte: ISODate('2025-01-15'), $lt: ISODate('2025-01-16') },
    },
  },
  {
    $group: {
      _id: { $dateTrunc: { date: '$timestamp', unit: 'hour' } },
      avg_value: { $avg: '$value' },
      min_value: { $min: '$value' },
      max_value: { $max: '$value' },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
])
```

### 2.4. Chọn Granularity đúng

`granularity` ảnh hưởng đến cách MongoDB gom data vào internal buckets:

| Granularity | Bucket time span | Phù hợp cho                                       |
| ----------- | ---------------- | ------------------------------------------------- |
| `"seconds"` | 1 giờ            | IoT sensor (data mỗi giây/mili-giây)              |
| `"minutes"` | 24 giờ           | Application metrics, stock prices (data mỗi phút) |
| `"hours"`   | 30 ngày          | Weather data, daily reports (data mỗi giờ/ngày)   |

**Nguyên tắc**: Chọn granularity **bằng hoặc nhỏ hơn** khoảng cách thời gian giữa 2 data points liên tiếp từ **cùng 1 source** (cùng `metaField`).

### 2.5. Giới hạn cần biết

- **Không hỗ trợ** multi-document transactions
- `metaField` và `timeField` **không thể thay đổi** sau khi tạo collection
- **Không hỗ trợ** `$graphLookup`, `$merge` (output), `$out` trên time-series collection
- **Insert-only optimized**: Update và delete hoạt động nhưng **không được tối ưu** — nếu cần update thường xuyên, dùng collection bình thường + Bucket Pattern
- Từ **MongoDB 6.0**: Hỗ trợ secondary indexes trên time-series, cải thiện query trên `metaField`
- Từ **MongoDB 7.0**: Hỗ trợ compound indexes đầy đủ trên time-series

### 2.6. Khi nào dùng cái nào?

```
Time Series Collection khi:
  ✓ Data chủ yếu insert-only (append)
  ✓ Query theo time range + metadata filter
  ✓ Cần auto-TTL (tự xóa data cũ)
  ✓ Muốn storage compression tối đa

Bucket Pattern thủ công khi:
  ✓ MongoDB < 5.0
  ✓ Cần update/modify measurements sau khi insert
  ✓ Cần custom summary/aggregation fields trong bucket document
  ✓ Logic bucket phức tạp (bucket theo event type, không chỉ theo thời gian)
```

---

## 3. Aggregation Pipeline Design Considerations

File gốc không đề cập cách thiết kế schema sao cho **tối ưu cho aggregation pipelines** — điều này ảnh hưởng lớn đến performance trên production.

### 3.1. Nguyên tắc quan trọng nhất: $match + $sort đầu tiên

```javascript
// KHÔNG TỐI ƯU: $unwind trước → expand data → rồi mới filter
db.orders.aggregate([
  { $unwind: '$items' }, // 1 order 10 items → 10 documents
  { $match: { 'items.sku': 'IPH15' } },
  { $group: { _id: '$customer_id', total: { $sum: '$items.subtotal' } } },
])
// Nếu 1M orders × 10 items = 10M documents đi qua pipeline!

// TỐI ƯU: $match trước → giảm data sớm
db.orders.aggregate([
  { $match: { 'items.sku': 'IPH15' } }, // Filter trước → chỉ orders chứa sku đó
  { $unwind: '$items' }, // Unwind ít documents hơn
  { $match: { 'items.sku': 'IPH15' } }, // Filter lần 2 sau unwind
  { $group: { _id: '$customer_id', total: { $sum: '$items.subtotal' } } },
])
```

**Quy tắc**: `$match` và `$sort` **đầu pipeline** có thể sử dụng index. Sau `$unwind`, `$group`, `$project` → không dùng index được nữa.

### 3.2. $unwind — Hiểu rõ trước khi dùng

`$unwind` "tháo" array thành nhiều documents → **nhân số lượng documents lên** → ảnh hưởng lớn đến memory và performance.

```javascript
// Document gốc
{ _id: 1, tags: ["a", "b", "c"] }

// Sau $unwind: { $unwind: "$tags" }
{ _id: 1, tags: "a" }
{ _id: 1, tags: "b" }
{ _id: 1, tags: "c" }
// 1 document → 3 documents!
```

**Khi nào cần $unwind:**

- Cần group/sort theo element trong array
- Cần join ($lookup) trên giá trị trong array

**Khi nào TRÁNH $unwind:**

- Chỉ cần filter array → dùng `$filter` trong `$project`
- Chỉ cần 1 element → dùng `$arrayElemAt`
- Chỉ cần aggregate array → dùng `$reduce`, `$sum`, `$avg` trực tiếp trên array

```javascript
// THAY VÌ $unwind → $group để tính tổng:
db.orders.aggregate([{ $unwind: '$items' }, { $group: { _id: '$_id', total: { $sum: '$items.subtotal' } } }])

// DÙNG $reduce (không cần $unwind):
db.orders.aggregate([
  {
    $project: {
      total: {
        $reduce: {
          input: '$items',
          initialValue: 0,
          in: { $add: ['$$value', '$$this.subtotal'] },
        },
      },
    },
  },
])
```

### 3.3. $lookup — Tương đương JOIN nhưng tốn hơn

```javascript
// Basic $lookup
db.orders.aggregate([
  {
    $lookup: {
      from: 'users',
      localField: 'customer_id',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: '$customer' }, // vì $lookup trả về array
])

// Pipeline $lookup (mạnh hơn, cho phép filter/project trong lookup)
db.orders.aggregate([
  {
    $lookup: {
      from: 'products',
      let: { productIds: '$items.product_id' },
      pipeline: [
        { $match: { $expr: { $in: ['$_id', '$$productIds'] } } },
        { $project: { name: 1, price: 1, thumbnail: 1 } }, // chỉ lấy fields cần
      ],
      as: 'product_details',
    },
  },
])
```

**Best practices cho $lookup:**

1. **$match trước $lookup** — giảm số documents cần join
2. **Pipeline $lookup** — filter/project trong lookup để giảm data truyền
3. **Index trên foreignField** — `$lookup` cần index trên `foreignField` của collection "from"
4. **Limit nested $lookup** — tránh $lookup lồng nhau (A lookup B lookup C) → performance rất tệ

### 3.4. $facet — Nhiều aggregations song song

Khi cần tính nhiều kết quả khác nhau trên cùng input data:

```javascript
// E-commerce: Product listing page cần đồng thời: results + total count + filters
db.products.aggregate([
  { $match: { category_id: ObjectId('cat_01'), status: 'active' } },
  {
    $facet: {
      // Nhánh 1: Paginated results
      results: [
        { $sort: { created_at: -1 } },
        { $skip: 0 },
        { $limit: 20 },
        { $project: { name: 1, price: 1, thumbnail: 1, rating_avg: 1 } },
      ],
      // Nhánh 2: Total count (cho pagination)
      total_count: [{ $count: 'count' }],
      // Nhánh 3: Available filters
      price_ranges: [
        {
          $bucket: {
            groupBy: '$price',
            boundaries: [0, 1000000, 5000000, 10000000, 50000000],
            default: '50M+',
            output: { count: { $sum: 1 } },
          },
        },
      ],
      brands: [{ $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }],
    },
  },
])
```

**Lưu ý**: Mỗi nhánh trong `$facet` đều process toàn bộ input → nếu input lớn, `$facet` tốn memory. Đặt `$match` **trước** `$facet` để giảm input.

### 3.5. Memory limit: 100MB per stage

Mỗi stage trong pipeline có giới hạn **100MB RAM**. Vượt quá → error.

```javascript
// Cho phép dùng disk cho stages tốn memory:
db.orders.aggregate([{ $group: { _id: '$customer_id', total: { $sum: '$total_amount' } } }, { $sort: { total: -1 } }], {
  allowDiskUse: true,
})
```

**Cách giảm memory usage:**

- `$project` sớm để loại bỏ fields không cần
- `$match` sớm để giảm document count
- Tránh `$unwind` trên large arrays khi không cần thiết
- Dùng `$merge` hoặc `$out` để viết kết quả aggregate lớn ra collection riêng

### 3.6. Schema Design ảnh hưởng đến Aggregation

| Schema choice                        | Aggregation impact                                            |
| ------------------------------------ | ------------------------------------------------------------- |
| Embed array (items trong order)      | Cần `$unwind` để aggregate trên individual items → tốn memory |
| Reference (items tách collection)    | Cần `$lookup` để join → tốn I/O                               |
| Computed fields (pre-computed stats) | Không cần aggregate runtime → nhanh nhất                      |
| Bucket pattern (time-series)         | Aggregate trên summary fields → giảm documents processed      |

**Khuyến nghị**: Nếu aggregation query chạy **thường xuyên** (mỗi page load), hãy **pre-compute** kết quả vào document (Computed Pattern) thay vì aggregate mỗi lần.

---

## 4. Change Streams & Real-time Data

### 4.1. Change Streams là gì?

Change Streams cho phép application **subscribe** vào thay đổi trên collection/database/deployment — giống event listener trên database level.

```javascript
// Watch tất cả thay đổi trên collection orders
const changeStream = db.orders.watch()

changeStream.on('change', (change) => {
  console.log('Change detected:', change)
  // {
  //   operationType: "insert" | "update" | "delete" | "replace",
  //   fullDocument: { ... },      // document sau thay đổi (nếu có)
  //   documentKey: { _id: ... },
  //   updateDescription: {        // chỉ cho "update"
  //     updatedFields: { status: "shipped" },
  //     removedFields: []
  //   },
  //   clusterTime: Timestamp(...)
  // }
})
```

### 4.2. Use cases thực tế

```
1. Real-time notifications
   Order status thay đổi → push notification đến user

2. Cache invalidation
   Product price thay đổi → invalidate Redis cache

3. Search index sync
   Document thay đổi → update Elasticsearch/Atlas Search index

4. Analytics pipeline
   Mọi write operation → stream vào analytics service

5. Cross-service sync (microservices)
   Service A update data → Service B react thông qua change stream
```

### 4.3. Filtered Change Streams

```javascript
// Chỉ watch order status changes
const pipeline = [
  {
    $match: {
      operationType: 'update',
      'updateDescription.updatedFields.status': { $exists: true },
    },
  },
]

const changeStream = db.orders.watch(pipeline)

// Chỉ watch insert của orders có total > 10 triệu
const bigOrderStream = db.orders.watch(
  [
    {
      $match: {
        operationType: 'insert',
        'fullDocument.total_amount': { $gte: 10000000 },
      },
    },
  ],
  { fullDocument: 'updateLookup' },
)
```

### 4.4. Resume Token — Xử lý disconnect

```javascript
let resumeToken = null

const changeStream = db.orders.watch([], {
  fullDocument: 'updateLookup',
  // Resume từ điểm dừng nếu có
  ...(resumeToken ? { resumeAfter: resumeToken } : {}),
})

changeStream.on('change', (change) => {
  // Lưu resume token sau mỗi event
  resumeToken = change._id
  saveResumeTokenToStorage(resumeToken) // Lưu vào Redis/file/DB

  processChange(change)
})

changeStream.on('error', (error) => {
  // Reconnect + resume từ token đã lưu
  const savedToken = loadResumeTokenFromStorage()
  reconnectWithToken(savedToken)
})
```

### 4.5. Schema Design cho Change Streams

**Nguyên tắc**: Thiết kế schema sao cho số change events **có ý nghĩa** — tránh quá nhiều events không cần thiết.

```javascript
// KHÔNG TỐT: Embed activity log trong user document
// → Mỗi lần user activity → update user document → change event cho TOÀN BỘ user document
{
  _id: ObjectId("user_001"),
  name: "Nguyễn A",
  activity_log: [ /* ... mỗi action thêm 1 entry */ ]
}

// TỐT: Tách activity ra collection riêng
// → Change stream trên activities collection chỉ nhận events liên quan
// → Change stream trên users collection nhận events thực sự quan trọng (profile update)
// Collection: users
{ _id: ObjectId("user_001"), name: "Nguyễn A" }

// Collection: activities
{ user_id: ObjectId("user_001"), action: "login", timestamp: ISODate("...") }
```

**Granularity of change events**: Embed có nghĩa là mọi thay đổi trên sub-document đều trigger change event cho parent. Nếu bạn chỉ muốn react khi **một field cụ thể** thay đổi → dùng pipeline filter trong `watch()`.

### 4.6. Giới hạn & Performance

- Change Streams **yêu cầu Replica Set** (hoặc sharded cluster) — không hoạt động trên standalone
- Oplog window: change stream chỉ có thể resume trong **oplog retention window** (mặc định ~72 giờ). Nếu app down quá lâu → mất events
- **Pre-image** (document trước khi thay đổi) cần bật riêng: `db.runCommand({ collMod: "orders", changeStreamPreAndPostImages: { enabled: true } })`
- Pre/post images tốn thêm storage và I/O → chỉ bật khi thực sự cần

---

## 5. Atlas Search vs Native Text Index

File gốc section 7.2 chỉ đề cập `text index` native — đây là giải pháp basic cho full-text search. Atlas Search (Lucene-based) mạnh hơn rất nhiều cho production.

### 5.1. So sánh

| Tiêu chí          | Native Text Index  | Atlas Search                                       |
| ----------------- | ------------------ | -------------------------------------------------- |
| Engine            | MongoDB native     | Apache Lucene                                      |
| Fuzzy search      | Không              | Có (autocomplete, typo tolerance)                  |
| Faceted search    | Không              | Có                                                 |
| Scoring/relevance | Basic (TF-IDF)     | Advanced (BM25, custom scoring)                    |
| Synonyms          | Không              | Có                                                 |
| Highlighting      | Không              | Có (highlight matched text)                        |
| Analyzers         | 1 (per collection) | Nhiều (per field, custom analyzers)                |
| Compound queries  | Hạn chế            | Full boolean logic (must, should, mustNot, filter) |
| Autocomplete      | Không              | Có (edge ngram, search-as-you-type)                |
| Availability      | Tất cả deployments | Chỉ MongoDB Atlas                                  |
| Cost              | Miễn phí           | Tính theo search tier                              |

### 5.2. Native Text Index — Khi nào đủ dùng

```javascript
// Tạo text index
db.products.createIndex(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 }, default_language: 'none' },
)

// Search
db.products.find({ $text: { $search: 'iPhone Pro Max' } }).sort({ score: { $meta: 'textScore' } })
```

**Đủ dùng khi:**

- Search nội bộ (admin tool)
- Search đơn giản (exact keywords)
- Không cần fuzzy/autocomplete
- Không chạy trên Atlas

### 5.3. Atlas Search — Cho production search

```javascript
// Tạo Atlas Search Index (trong Atlas UI hoặc CLI)
{
  "name": "product_search",
  "analyzer": "lucene.standard",
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "name_autocomplete": {
        "type": "autocomplete",
        "tokenization": "edgeGram",
        "minGrams": 2,
        "maxGrams": 15
      },
      "description": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "category": {
        "type": "stringFacet"
      },
      "brand": {
        "type": "stringFacet"
      },
      "price": {
        "type": "number"
      }
    }
  }
}

// Search query dùng $search stage trong aggregation pipeline
db.products.aggregate([
  { $search: {
    index: "product_search",
    compound: {
      must: [
        { text: { query: "iPhone", path: "name", fuzzy: { maxEdits: 1 } } }
      ],
      filter: [
        { range: { path: "price", gte: 10000000, lte: 50000000 } }
      ]
    },
    highlight: { path: "name" }
  }},
  { $limit: 20 },
  { $project: {
    name: 1,
    price: 1,
    score: { $meta: "searchScore" },
    highlights: { $meta: "searchHighlights" }
  }}
])

// Autocomplete query
db.products.aggregate([
  { $search: {
    index: "product_search",
    autocomplete: {
      query: "iPho",
      path: "name_autocomplete",
      fuzzy: { maxEdits: 1 }
    }
  }},
  { $limit: 10 },
  { $project: { name: 1, price: 1, thumbnail: 1 } }
])
```

### 5.4. Schema Design cho Search

- **Denormalize cho search**: Embed tên category, tên brand trực tiếp trong product document (thay vì chỉ giữ ID) → search không cần `$lookup`
- **Separate search fields**: Tạo fields riêng cho search (ví dụ: `name_search` với lowercase, bỏ dấu) nếu dùng native text index
- **Computed search fields**: Pre-compute searchable text: `search_text: "iPhone 15 Pro Apple Điện thoại Electronics"`

---

## 6. Advanced Design Patterns Bổ Sung

File gốc có 6 patterns (Bucket, Computed, Subset, Outlier, Polymorphic, Schema Versioning). Bổ sung thêm 4 patterns quan trọng.

### 6.1. Attribute Pattern

**Vấn đề**: Sản phẩm có nhiều attributes khác nhau tùy loại, và bạn cần **index + query** trên bất kỳ attribute nào.

Với Polymorphic Pattern (file gốc section 6.5), attributes lưu dạng key-value trong object:

```json
{
  "attributes": {
    "screen_size": "6.1 inch",
    "storage": "256GB",
    "ram": "8GB"
  }
}
```

Vấn đề: Muốn query `attributes.screen_size = "6.1 inch"` → cần wildcard index. Muốn range query `attributes.ram >= "8GB"` → wildcard index **không hỗ trợ** range trên heterogeneous fields.

**Giải pháp — Attribute Pattern**: Chuyển key-value thành **array of {k, v}**:

```json
{
  "_id": ObjectId("prod_phone"),
  "name": "iPhone 15 Pro",
  "type": "phone",
  "attrs": [
    { "k": "screen_size", "v": "6.1", "unit": "inch" },
    { "k": "storage",     "v": "256", "unit": "GB" },
    { "k": "ram",         "v": "8",   "unit": "GB" },
    { "k": "battery",     "v": "3274", "unit": "mAh" },
    { "k": "color",       "v": "Black" }
  ]
}
```

```javascript
// 1 compound index cho TẤT CẢ attributes!
db.products.createIndex({ 'attrs.k': 1, 'attrs.v': 1 })

// Query: tìm tất cả phone có RAM >= 8GB
db.products.find({
  type: 'phone',
  attrs: { $elemMatch: { k: 'ram', v: { $gte: '8' } } },
})

// Query: tìm sản phẩm có color = "Black"
db.products.find({
  attrs: { $elemMatch: { k: 'color', v: 'Black' } },
})
```

**Lợi ích**:

- Chỉ cần **1 compound index** thay vì wildcard index hoặc nhiều single-field indexes
- Hỗ trợ range queries trên attributes
- Dễ thêm attribute mới mà không cần thay đổi index

**Trade-off**: Query syntax phức tạp hơn (`$elemMatch` thay vì dot notation). Application layer thường wrap thành helper.

### 6.2. Tree / Graph Patterns

**Vấn đề**: Lưu trữ dữ liệu phân cấp — categories (Electronics > Phones > Smartphones), comment threads, tổ chức phòng ban, menu navigation.

MongoDB không có native tree support. Có **4 patterns** chính:

#### Pattern A: Parent Reference

```json
// Collection: categories
{ "_id": "electronics",  "name": "Electronics",   "parent_id": null }
{ "_id": "phones",       "name": "Phones",        "parent_id": "electronics" }
{ "_id": "smartphones",  "name": "Smartphones",   "parent_id": "phones" }
{ "_id": "laptops",      "name": "Laptops",       "parent_id": "electronics" }
```

```javascript
// Tìm children trực tiếp
db.categories.find({ parent_id: 'electronics' })

// Tìm toàn bộ descendants → cần $graphLookup
db.categories.aggregate([
  { $match: { _id: 'electronics' } },
  {
    $graphLookup: {
      from: 'categories',
      startWith: '$_id',
      connectFromField: '_id',
      connectToField: 'parent_id',
      as: 'descendants',
      maxDepth: 10,
    },
  },
])
```

**Ưu điểm**: Đơn giản, insert/move node dễ.
**Nhược điểm**: Tìm ancestors hoặc full path cần nhiều queries hoặc `$graphLookup`.

#### Pattern B: Materialized Path

```json
// Collection: categories
{ "_id": "electronics",  "name": "Electronics",  "path": ",electronics," }
{ "_id": "phones",       "name": "Phones",       "path": ",electronics,phones," }
{ "_id": "smartphones",  "name": "Smartphones",  "path": ",electronics,phones,smartphones," }
{ "_id": "iphone",       "name": "iPhone",        "path": ",electronics,phones,smartphones,iphone," }
```

```javascript
// Index trên path
db.categories.createIndex({ path: 1 })

// Tìm TẤT CẢ descendants của electronics (dùng regex prefix)
db.categories.find({ path: /^,electronics,/ })

// Tìm TẤT CẢ ancestors của iphone
// Path = ",electronics,phones,smartphones,iphone,"
// → Parse ra: ["electronics", "phones", "smartphones"]
db.categories.find({ _id: { $in: ['electronics', 'phones', 'smartphones'] } })
```

**Ưu điểm**: Tìm subtree rất nhanh (1 regex query). Tìm ancestors dễ (parse path string).
**Nhược điểm**: Di chuyển node (reparent) phải update path của TẤT CẢ descendants.

#### Pattern C: Array of Ancestors

```json
// Collection: categories
{ "_id": "electronics",  "name": "Electronics",  "ancestors": [] }
{ "_id": "phones",       "name": "Phones",       "ancestors": ["electronics"] }
{ "_id": "smartphones",  "name": "Smartphones",  "ancestors": ["electronics", "phones"] }
{ "_id": "iphone",       "name": "iPhone",        "ancestors": ["electronics", "phones", "smartphones"] }
```

```javascript
// Index
db.categories.createIndex({ ancestors: 1 })

// Tìm tất cả descendants
db.categories.find({ ancestors: 'electronics' })

// Tìm đường đi (breadcrumb) — ancestors đã có sẵn trong document!
const cat = db.categories.findOne({ _id: 'iphone' })
// cat.ancestors = ["electronics", "phones", "smartphones"]
```

**Ưu điểm**: Tìm subtree = 1 query. Breadcrumb đã có sẵn. Multikey index.
**Nhược điểm**: Di chuyển node phải update ancestors array của tất cả descendants.

#### Pattern D: Nested Sets (ít dùng trong MongoDB)

Phù hợp cho read-heavy, very rarely modified trees. Phức tạp trong MongoDB, thường dùng trong SQL nhiều hơn. Không khuyến khích trừ khi tree **hầu như không bao giờ thay đổi**.

#### Chọn pattern nào?

| Nhu cầu                                              | Pattern khuyến nghị                           |
| ---------------------------------------------------- | --------------------------------------------- |
| Tree thay đổi thường xuyên (thêm/xóa/di chuyển node) | Parent Reference                              |
| Cần query subtree nhanh, tree ít thay đổi            | Materialized Path hoặc Array of Ancestors     |
| Cần breadcrumb/path thường xuyên                     | Array of Ancestors                            |
| Comment threads (tree + pagination)                  | Parent Reference + Materialized Path (hybrid) |
| Category navigation (e-commerce)                     | Array of Ancestors                            |

### 6.3. Document Versioning Pattern

**Khác với Schema Versioning** (file gốc section 6.6) — Schema Versioning track schema format changes. Document Versioning track **nội dung data changes** — giữ lịch sử mọi thay đổi của document (audit trail).

**Vấn đề**: Cần biết ai đã thay đổi gì, khi nào. Ví dụ: product price history, order status history, content editing history.

```json
// Collection: products (current version — always latest)
{
  "_id": ObjectId("prod_001"),
  "name": "iPhone 15 Pro",
  "price": 28990000,
  "status": "active",
  "version": 3,
  "updated_at": ISODate("2025-03-15T10:00:00Z"),
  "updated_by": ObjectId("admin_001")
}

// Collection: products_history (all previous versions)
{
  "_id": ObjectId("history_001"),
  "document_id": ObjectId("prod_001"),
  "version": 1,
  "data": {
    "name": "iPhone 15 Pro",
    "price": 31990000,
    "status": "draft"
  },
  "changed_fields": ["price", "status"],
  "changed_at": ISODate("2025-01-10T08:00:00Z"),
  "changed_by": ObjectId("admin_002"),
  "change_reason": "Initial creation"
}
{
  "_id": ObjectId("history_002"),
  "document_id": ObjectId("prod_001"),
  "version": 2,
  "data": {
    "name": "iPhone 15 Pro",
    "price": 29990000,
    "status": "active"
  },
  "changed_fields": ["price"],
  "changed_at": ISODate("2025-02-20T14:30:00Z"),
  "changed_by": ObjectId("admin_001"),
  "change_reason": "Giảm giá Tết"
}
```

```javascript
// Application logic: update product + lưu version cũ
async function updateProduct(productId, updates, userId, reason) {
  const session = client.startSession()
  session.startTransaction()

  try {
    const current = await db.products.findOne({ _id: productId }, { session })

    // Lưu version hiện tại vào history
    await db.products_history.insertOne(
      {
        document_id: productId,
        version: current.version,
        data: current,
        changed_fields: Object.keys(updates),
        changed_at: new Date(),
        changed_by: userId,
        change_reason: reason,
      },
      { session },
    )

    // Update document sang version mới
    await db.products.updateOne(
      { _id: productId },
      {
        $set: { ...updates, updated_at: new Date(), updated_by: userId },
        $inc: { version: 1 },
      },
      { session },
    )

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  }
}

// Query: xem lịch sử giá sản phẩm
db.products_history
  .find({ document_id: ObjectId('prod_001') })
  .sort({ version: -1 })
  .project({ version: 1, 'data.price': 1, changed_at: 1, changed_by: 1 })
```

**Index cho history collection:**

```javascript
db.products_history.createIndex({ document_id: 1, version: -1 })
db.products_history.createIndex({ changed_at: 1 }) // TTL nếu cần auto-delete history cũ
```

### 6.4. Approximation Pattern

**Vấn đề**: Tracking exact counts rất tốn write throughput. Ví dụ: page views, like counts trên bài viết popular → hàng ngàn concurrent increments.

**Giải pháp**: Chấp nhận **approximate values** — chỉ update sau mỗi N lần hoặc theo interval.

```javascript
// KHÔNG TỐI ƯU: Update count mỗi page view
// → 10,000 views/giây = 10,000 writes/giây cho 1 document!
db.articles.updateOne({ _id: articleId }, { $inc: { view_count: 1 } })

// TỐI ƯU: Approximation — chỉ update mỗi ~100 views (random)
function trackPageView(articleId) {
  // Chỉ 1% requests thực sự update database
  if (Math.random() < 0.01) {
    db.articles.updateOne(
      { _id: articleId },
      { $inc: { view_count: 100 } }, // increment by batch size
    )
  }
}

// HOẶC: Buffer trong Redis, flush mỗi phút
// 1. Mỗi page view → INCR redis key "views:{articleId}"
// 2. Cron job mỗi phút → read all keys → batch update MongoDB → delete keys
```

**Lợi ích**: Giảm write load lên MongoDB **100x** mà view count chỉ sai ±100 — chấp nhận được cho hầu hết use cases (YouTube views, article reads...).

**Khi nào KHÔNG dùng**: Payment amounts, inventory count, bất kỳ số liệu nào đòi hỏi **chính xác tuyệt đối**.

---

## 7. Indexing Nâng Cao

Bổ sung cho file gốc section 7.

### 7.1. Index Intersection

MongoDB **có thể** combine kết quả từ 2 single-field indexes thay vì dùng compound index:

```javascript
// Có 2 indexes:
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ customer_id: 1 })

// Query:
db.orders.find({ status: 'pending', customer_id: ObjectId('user_001') })
// MongoDB CÓ THỂ dùng index intersection để combine 2 indexes
```

**Tuy nhiên**: Index intersection **hầu như không hiệu quả bằng compound index**:

```javascript
// COMPOUND INDEX — luôn tốt hơn:
db.orders.createIndex({ status: 1, customer_id: 1 })
```

**Khi nào index intersection hữu ích:**

- Queries có nhiều **combinations khác nhau** của filter fields → tạo compound index cho mọi combination thì quá nhiều indexes
- Temporary solution khi chưa biết query pattern chính xác

**Nguyên tắc**: Không nên **dựa vào** index intersection. Luôn ưu tiên compound index cho queries quan trọng. Dùng `explain()` để verify MongoDB thực sự sử dụng intersection.

### 7.2. Hidden Indexes (MongoDB 4.4+)

Trước khi drop index, **ẩn** nó trước để test impact — nếu performance giảm, unhide lại ngay.

```javascript
// Bước 1: Ẩn index — MongoDB sẽ KHÔNG dùng index này cho queries
db.orders.hideIndex('status_1_created_at_-1')

// Bước 2: Monitor performance vài giờ/ngày
// → Nếu performance OK → drop index
// → Nếu performance tệ → unhide lại

// Bước 3a: Drop (nếu không cần)
db.orders.dropIndex('status_1_created_at_-1')

// Bước 3b: Unhide (nếu vẫn cần)
db.orders.unhideIndex('status_1_created_at_-1')
```

**Rất hữu ích khi**: Nghi ngờ index không được dùng nhưng sợ drop sẽ ảnh hưởng performance. Hide trước → an toàn → quyết định sau.

### 7.3. Index Size Monitoring

```javascript
// Xem tổng size tất cả indexes của collection
db.orders.totalIndexSize()
// → 2147483648 (2GB)

// Xem chi tiết từng index
db.orders.stats().indexSizes
// {
//   "_id_": 52428800,
//   "user_id_1_created_at_-1": 1073741824,
//   "status_1": 20971520,
//   ...
// }

// Xem usage stats của từng index
db.orders.aggregate([{ $indexStats: {} }])
// [
//   { name: "user_id_1_created_at_-1", accesses: { ops: 1523456, since: ISODate("...") } },
//   { name: "status_1", accesses: { ops: 0, since: ISODate("...") } }
//   // ← ops = 0 → index này chưa bao giờ được dùng → candidate for removal!
// ]
```

**Monitoring checklist:**

- Total index size nên < 50% RAM (để còn chỗ cho working set)
- Indexes với `accesses.ops = 0` sau vài tuần → candidate for removal (ẩn trước, drop sau)
- Index size tăng bất thường → kiểm tra xem có unbounded array nào đang grow không

### 7.4. Hinted Indexes

Khi query optimizer chọn sai index (hiếm, nhưng xảy ra):

```javascript
// Force MongoDB dùng index cụ thể
db.orders
  .find({ status: 'pending', created_at: { $gte: startDate } })
  .hint({ status: 1, created_at: -1 })
  .explain('executionStats')

// So sánh performance với index khác
db.orders
  .find({ status: 'pending', created_at: { $gte: startDate } })
  .hint({ created_at: -1 })
  .explain('executionStats')
```

**Lưu ý**: `hint()` nên là **biện pháp cuối cùng**. Nếu optimizer chọn sai, thường là do index design chưa tối ưu → sửa index thay vì dùng hint.

---

## 8. Sharding Nâng Cao

Bổ sung cho file gốc section 10.

### 8.1. Zone Sharding (Geographic Distribution)

Phân data theo **vùng địa lý** — data của user Việt Nam lưu trên shard ở Singapore, data user Mỹ lưu trên shard ở US.

```javascript
// Bước 1: Gán zones cho các shards
sh.addShardTag('shard-sg01', 'APAC') // Shard ở Singapore
sh.addShardTag('shard-sg02', 'APAC')
sh.addShardTag('shard-us01', 'AMERICAS') // Shard ở US
sh.addShardTag('shard-eu01', 'EMEA') // Shard ở EU

// Bước 2: Shard collection theo region
sh.shardCollection('ecommerce.users', { region: 1, _id: 1 })

// Bước 3: Define zone ranges
sh.addTagRange('ecommerce.users', { region: 'APAC', _id: MinKey }, { region: 'APAC', _id: MaxKey }, 'APAC')
sh.addTagRange('ecommerce.users', { region: 'AMERICAS', _id: MinKey }, { region: 'AMERICAS', _id: MaxKey }, 'AMERICAS')
sh.addTagRange('ecommerce.users', { region: 'EMEA', _id: MinKey }, { region: 'EMEA', _id: MaxKey }, 'EMEA')
```

**Use cases:**

- **Data residency compliance**: GDPR yêu cầu data EU citizens phải lưu trong EU
- **Latency optimization**: User APAC read/write đến shard gần nhất
- **Multi-geo e-commerce**: Mỗi region có warehouse riêng, inventory riêng

### 8.2. Resharding (MongoDB 5.0+)

Trước MongoDB 5.0, **không thể thay đổi shard key** sau khi shard. Từ 5.0, có thể resharding mà **không cần downtime**.

```javascript
// Shard key cũ: { user_id: "hashed" }
// Nhận ra query pattern mới cần filter theo region + user_id

// Resharding sang compound shard key
db.adminCommand({
  reshardCollection: 'ecommerce.orders',
  key: { region: 1, user_id: 1 },
})
```

**Quy trình resharding nội bộ:**

1. MongoDB tạo temporary collection mới với shard key mới
2. Copy tất cả data sang collection mới (background)
3. Đồng thời apply oplog entries (writes tiếp tục hoạt động)
4. Cutover: swap collection names → zero downtime

**Lưu ý quan trọng:**

- Resharding **tốn thời gian** (tùy data size, có thể vài giờ đến vài ngày)
- **Tốn I/O** — chạy off-peak hours
- Từ **MongoDB 7.0**: Có thể reshard khi đang có **writes** mà không ảnh hưởng performance đáng kể

### 8.3. Jumbo Chunks

**Vấn đề**: Khi shard key có cardinality thấp hoặc data skew → 1 chunk chứa **quá nhiều data** → MongoDB không thể split → chunk đó trở thành "jumbo" → shard overloaded.

```javascript
// Kiểm tra jumbo chunks
db.adminCommand({ balancerCollectionStatus: "ecommerce.orders" })

// Hoặc
use config
db.chunks.find({ jumbo: true })
```

**Nguyên nhân phổ biến:**

- Shard key `{ status: 1 }` → chỉ 5 giá trị → mỗi chunk chứa 20% data → 1 chunk có thể rất lớn
- Shard key `{ created_at: 1 }` → hot spot ở chunk mới nhất

**Giải pháp:**

1. **Chọn shard key tốt hơn** (high cardinality) → prevention
2. **clearJumboFlag** nếu chunk thực sự đủ nhỏ nhưng bị flag sai:
   ```javascript
   db.adminCommand({
     clearJumboFlag: 'ecommerce.orders',
     bounds: [
       {
         /* min key */
       },
       {
         /* max key */
       },
     ],
   })
   ```
3. **Resharding** (MongoDB 5.0+) nếu shard key design sai từ đầu

### 8.4. Targeted Queries vs Scatter-Gather

```
                    ┌─────────────┐
                    │   mongos    │
                    │   (router)  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Shard 1   │ │   Shard 2   │ │   Shard 3   │
    │ user_id:    │ │ user_id:    │ │ user_id:    │
    │ A-F         │ │ G-P         │ │ Q-Z         │
    └─────────────┘ └─────────────┘ └─────────────┘

Targeted Query (tốt):
  query: { user_id: "Alice" }
  → mongos biết Alice ở Shard 1 → chỉ query Shard 1
  → Latency = 1 shard trip

Scatter-Gather Query (tệ):
  query: { status: "pending" }  ← không có shard key!
  → mongos không biết data ở shard nào → query TẤT CẢ shards → merge results
  → Latency = max(Shard 1, Shard 2, Shard 3) + merge overhead
```

**Quy tắc**: Queries quan trọng nhất (high frequency, low latency requirements) **phải include shard key** → targeted query. Nếu không → performance sẽ giảm tuyến tính khi thêm shards (ngược lại mục đích sharding).

---

## 9. Transaction & Consistency Nâng Cao

Bổ sung cho file gốc section 11.

### 9.1. Retryable Writes (MongoDB 3.6+)

Khi network blip xảy ra giữa client và server, write operation có thể:

- **Thực hiện thành công** nhưng client không nhận response → client retry → **duplicate write!**

Retryable writes giải quyết bằng cách đảm bảo retry cùng operation → **idempotent** (không duplicate).

```javascript
// Bật retryable writes (mặc định từ MongoDB 4.2)
const client = new MongoClient(uri, { retryWrites: true })

// Các operations được hỗ trợ retryable:
// ✓ insertOne, insertMany
// ✓ updateOne, updateMany
// ✓ deleteOne, deleteMany
// ✓ findOneAndUpdate, findOneAndReplace, findOneAndDelete
// ✓ bulkWrite

// MongoDB tự retry 1 lần nếu gặp network error
// Application code KHÔNG CẦN tự retry
```

**Cơ chế**: Client gửi kèm `lsid` (session ID) + `txnNumber` (transaction number) trong mỗi write. Nếu server nhận duplicate `txnNumber` → trả lại response cũ thay vì execute lại.

### 9.2. Retryable Reads (MongoDB 4.2+)

```javascript
const client = new MongoClient(uri, { retryReads: true })

// Tự động retry read operations khi gặp transient network error
// ✓ find, findOne
// ✓ aggregate (non-write stages)
// ✓ countDocuments, estimatedDocumentCount
// ✓ distinct
```

### 9.3. Causal Consistency

**Vấn đề**: Trong replica set, writes đi đến primary nhưng reads có thể đi đến secondary → có thể **read stale data** (đọc data cũ hơn write vừa thực hiện).

```
Timeline:
  T1: Client writes to primary:    order.status = "shipped"
  T2: Client reads from secondary: order.status = "confirmed"  ← STALE!
  (secondary chưa replicate kịp)
```

**Giải pháp — Causal Consistency Sessions**:

```javascript
const session = client.startSession({ causalConsistency: true })

// Write 1: Update order status
await db.orders.updateOne({ _id: orderId }, { $set: { status: 'shipped' } }, { session })

// Read 1: Đọc lại order — GUARANTEED thấy write ở trên
const order = await db.orders.findOne({ _id: orderId }, { session, readPreference: 'secondary' })
// order.status === "shipped" ← GUARANTEED!
```

**Cơ chế**: Session track `operationTime` → mỗi read trong session yêu cầu secondary **phải có data ≥ operationTime** trước khi trả kết quả.

**Lưu ý**: Causal consistency chỉ đảm bảo **trong cùng 1 session**. 2 sessions khác nhau vẫn có thể thấy data ở thời điểm khác nhau.

### 9.4. Transaction Best Practices

```javascript
// ✓ DO: Keep transactions SHORT
const session = client.startSession()
session.startTransaction({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  maxCommitTimeMS: 5000, // Timeout 5 giây — fail fast
})

// ✗ DON'T: Transactions quá dài
// → Lock contention tăng
// → Oplog pressure tăng
// → Nếu transaction > 60 giây (default) → tự động abort

// ✓ DO: Minimize round trips trong transaction
// Gom operations thành batch thay vì gọi nhiều lần

// ✗ DON'T: Chạy aggregation nặng trong transaction
// → Tốn time → timeout → abort

// ✓ DO: Handle TransientTransactionError
async function runWithRetry(txnFunc) {
  const session = client.startSession()
  try {
    session.startTransaction()
    await txnFunc(session)
    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    // TransientTransactionError → retry toàn bộ transaction
    if (error.hasErrorLabel('TransientTransactionError')) {
      return runWithRetry(txnFunc)
    }
    // UnknownTransactionCommitResult → retry commit
    if (error.hasErrorLabel('UnknownTransactionCommitResult')) {
      await session.commitTransaction() // retry commit
    }
    throw error
  } finally {
    session.endSession()
  }
}
```

---

## 10. Multi-tenancy Schema Design

File gốc section 10 nhắc đến `tenant_id` nhưng không có pattern riêng. Multi-tenancy là kiến trúc quan trọng cho SaaS applications.

### 10.1. Ba chiến lược chính

```
Strategy A: Database per Tenant
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ DB: tenant_1 │  │ DB: tenant_2 │  │ DB: tenant_3 │
  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
  │ │ orders   │ │  │ │ orders   │ │  │ │ orders   │ │
  │ │ products │ │  │ │ products │ │  │ │ products │ │
  │ │ users    │ │  │ │ users    │ │  │ │ users    │ │
  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
  └──────────────┘  └──────────────┘  └──────────────┘

Strategy B: Collection per Tenant
  ┌──────────────────────────────────┐
  │ DB: saas_app                     │
  │ ┌────────────┐  ┌────────────┐  │
  │ │ t1_orders  │  │ t2_orders  │  │
  │ │ t1_products│  │ t2_products│  │
  │ │ t1_users   │  │ t2_users   │  │
  │ └────────────┘  └────────────┘  │
  └──────────────────────────────────┘

Strategy C: Shared Collection with tenant_id
  ┌──────────────────────────────────┐
  │ DB: saas_app                     │
  │ ┌───────────────────────────┐    │
  │ │ Collection: orders        │    │
  │ │ { tenant_id, order_data } │    │
  │ │ { tenant_id, order_data } │    │
  │ └───────────────────────────┘    │
  └──────────────────────────────────┘
```

### 10.2. So sánh chi tiết

| Tiêu chí                 | Database/Tenant            | Collection/Tenant          | Shared Collection                 |
| ------------------------ | -------------------------- | -------------------------- | --------------------------------- |
| **Data isolation**       | Hoàn toàn (vật lý)         | Trung bình                 | Thấp (logic)                      |
| **Security**             | Rất tốt                    | Trung bình                 | Cần cẩn thận (`tenant_id` filter) |
| **Scalability**          | Tệ (>1000 tenants)         | Trung bình                 | Tốt (hàng triệu tenants)          |
| **Resource efficiency**  | Thấp (mỗi DB có overhead)  | Trung bình                 | Cao (shared indexes, connections) |
| **Customization/schema** | Mỗi tenant có schema riêng | Mỗi tenant có schema riêng | Shared schema                     |
| **Backup/restore**       | Per tenant                 | Per tenant (phức tạp hơn)  | All tenants cùng lúc              |
| **Monitoring**           | Per tenant                 | Phức tạp                   | Tập trung                         |
| **Ops complexity**       | O(n) với n tenants         | O(n)                       | O(1)                              |

### 10.3. Chiến lược phổ biến nhất: Shared Collection + tenant_id

```javascript
// Schema design
// Mọi collection đều có tenant_id
{
  "_id": ObjectId("ord_001"),
  "tenant_id": ObjectId("tenant_shopA"),    // BẮT BUỘC mọi document
  "order_number": "ORD-001",
  "customer_id": ObjectId("cust_001"),
  "total": 500000
}

// Index: tenant_id PHẢI LÀ PREFIX của mọi compound index
db.orders.createIndex({ tenant_id: 1, created_at: -1 })
db.orders.createIndex({ tenant_id: 1, status: 1 })
db.orders.createIndex({ tenant_id: 1, customer_id: 1 })

// Query: LUÔN filter theo tenant_id
db.orders.find({
  tenant_id: ObjectId("tenant_shopA"),  // MANDATORY
  status: "pending"
})
```

**Application layer enforcement:**

```javascript
// Middleware: inject tenant_id vào mọi query
function tenantMiddleware(req, res, next) {
  const tenantId = req.user.tenant_id

  // Override MongoDB collection methods to always include tenant_id
  req.db = {
    find: (collection, query) => {
      return db.collection(collection).find({ ...query, tenant_id: tenantId })
    },
    insertOne: (collection, doc) => {
      return db.collection(collection).insertOne({ ...doc, tenant_id: tenantId })
    },
  }

  next()
}
```

**Rủi ro lớn nhất**: **Quên filter `tenant_id`** → data leak giữa tenants. Phải enforce ở middleware/ORM level, không dựa vào developer nhớ thêm filter.

### 10.4. Sharding cho Multi-tenant

```javascript
// Shard key BẮT ĐẦU bằng tenant_id → đảm bảo targeted queries
sh.shardCollection('saas.orders', { tenant_id: 1, _id: 1 })

// Kết hợp Zone Sharding nếu cần:
// Tenant enterprise → dedicated shard (performance isolation)
// Tenant free tier → shared shard
sh.addShardTag('shard-premium', 'PREMIUM')
sh.addShardTag('shard-shared01', 'FREE')
```

---

## 11. Data Archival & Lifecycle Management

File gốc checklist nhắc "archival cho historical data" nhưng không có hướng dẫn chi tiết.

### 11.1. Data Temperature Model

```
┌─────────────────────────────────────────────────┐
│           HOT DATA (RAM + SSD)                  │
│   Last 30 days                                  │
│   Active orders, current inventory              │
│   Fast queries, full indexes                    │
│   → Main collection                             │
├─────────────────────────────────────────────────┤
│           WARM DATA (SSD)                        │
│   31 days - 1 year                              │
│   Completed orders, historical analytics        │
│   Occasional queries, reduced indexes           │
│   → Archive collection (same cluster)           │
├─────────────────────────────────────────────────┤
│           COLD DATA (Object Storage / Atlas)     │
│   > 1 year                                      │
│   Compliance retention, audit trail             │
│   Rare queries, minimal indexes                 │
│   → Atlas Online Archive / S3 export            │
└─────────────────────────────────────────────────┘
```

### 11.2. TTL Index cho Auto-Expiry

```javascript
// Tự động xóa sessions sau 24h
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 86400 })

// Tự động xóa OTP/verification codes sau 5 phút
db.verification_codes.createIndex({ created_at: 1 }, { expireAfterSeconds: 300 })

// Tự động xóa logs sau 90 ngày
db.application_logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 7776000 }, // 90 * 24 * 60 * 60
)
```

**Lưu ý**: TTL index chạy **background task** mỗi 60 giây → document có thể tồn tại **vài phút sau** khi hết hạn. Không dùng cho expiry cần chính xác đến giây (ví dụ: flash sale).

### 11.3. Archive Strategy: Move to Archive Collection

```javascript
// Cron job: move completed orders older than 90 days to archive
async function archiveOldOrders() {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const cursor = db.orders
    .find({
      status: { $in: ['delivered', 'cancelled', 'refunded'] },
      updated_at: { $lt: cutoffDate },
    })
    .batchSize(1000)

  while (await cursor.hasNext()) {
    const batch = []
    for (let i = 0; i < 1000 && (await cursor.hasNext()); i++) {
      batch.push(await cursor.next())
    }

    // Insert vào archive collection
    await db.orders_archive.insertMany(batch, { ordered: false })

    // Delete từ main collection
    const ids = batch.map((doc) => doc._id)
    await db.orders.deleteMany({ _id: { $in: ids } })
  }
}

// Archive collection có ÍT indexes hơn main collection
// Chỉ index cho queries thực sự cần
db.orders_archive.createIndex({ customer_id: 1, created_at: -1 })
// KHÔNG cần index cho status, payment_method... vì hiếm khi query
```

### 11.4. Atlas Online Archive (Atlas only)

MongoDB Atlas cung cấp **Online Archive** — tự động move data cũ sang cloud object storage (S3) nhưng vẫn query được qua Atlas Data Federation.

```javascript
// Cấu hình trong Atlas UI:
{
  "dbName": "ecommerce",
  "collName": "orders",
  "criteria": {
    "type": "DATE",
    "dateField": "created_at",
    "dateFormat": "ISODATE",
    "expireAfterDays": 90
  },
  "partitionFields": [
    { "fieldName": "status", "order": 0 },
    { "fieldName": "created_at", "order": 1 }
  ]
}
// Data > 90 ngày tự động archive
// Vẫn query được qua Atlas Data Federation (chậm hơn nhưng rẻ hơn)
```

---

## 12. Performance Sizing Guidelines

### 12.1. Document Size Guidelines

| Metric                | Guideline        | Lý do                                                     |
| --------------------- | ---------------- | --------------------------------------------------------- |
| Average document size | 2-10 KB lý tưởng | Vừa đủ chứa data cần, không phình                         |
| Maximum document size | Cố gắng < 100 KB | 16MB là hard limit nhưng > 100KB đã ảnh hưởng working set |
| Embedded array items  | < 500 elements   | > 500 → tách collection. > 5000 → chắc chắn tách          |

### 12.2. Working Set & RAM

```
Working Set = hot data + indexes cần thiết

Quy tắc: Working Set nên fit trong RAM

RAM allocation guideline:
  50-60% RAM → WiredTiger cache (MongoDB tự quản lý)
  20-30% RAM → OS file system cache
  10-20% RAM → OS + other processes

Ví dụ: Server 64GB RAM
  → WiredTiger cache: ~32GB (mặc định 50% RAM - 1GB)
  → Cần đảm bảo: hot data + hot indexes < 32GB
```

```javascript
// Kiểm tra collection stats
db.orders.stats()
// {
//   size: 52428800000,        // 50GB total data
//   storageSize: 8589934592,  // 8GB on disk (after compression)
//   totalIndexSize: 2147483648, // 2GB indexes
//   count: 10000000           // 10M documents
// }

// Ước tính document size trung bình
db.orders.stats().avgObjSize
// → 5242 bytes (~5KB/document) ← tốt

// WiredTiger cache usage
db.serverStatus().wiredTiger.cache
// {
//   "bytes currently in the cache": 17179869184,  // 16GB đang dùng
//   "maximum bytes configured": 34359738368,       // 32GB max
//   "tracked dirty bytes in the cache": 1073741824 // 1GB dirty pages
// }
```

### 12.3. Khi nào cần Sharding?

| Signal                 | Threshold                        | Action                            |
| ---------------------- | -------------------------------- | --------------------------------- |
| Single collection size | > 500GB                          | Cân nhắc sharding                 |
| Write throughput       | > 5000 writes/s sustained        | Cần sharding cho write scaling    |
| Working set > RAM      | Không fit trong WiredTiger cache | Sharding hoặc upgrade RAM         |
| CPU utilization        | > 80% sustained                  | Sharding hoặc read replicas       |
| Query latency          | p99 > 100ms trên indexed queries | Investigate, then shard if needed |

**Trước khi shard, thử:**

1. Optimize queries + indexes (explain analysis)
2. Upgrade hardware (vertical scaling) — thường rẻ hơn
3. Read preferences → secondary reads cho analytics queries
4. Computed/Subset patterns → giảm data cần load

Sharding thêm **operational complexity** đáng kể — chỉ shard khi vertical scaling thực sự không đủ.

### 12.4. Connection Pool Sizing

```javascript
// Mặc định MongoDB driver: maxPoolSize = 100
const client = new MongoClient(uri, {
  maxPoolSize: 50, // Connections per mongos/mongod
  minPoolSize: 10, // Keep minimum connections warm
  maxIdleTimeMS: 60000, // Close idle connections after 60s
  waitQueueTimeoutMS: 5000, // Timeout nếu không có connection available
})
```

**Sizing formula:**

```
maxPoolSize per app instance ≈
  (peak concurrent DB operations) / (number of app instances)
  + 10% buffer

Ví dụ: 200 concurrent DB ops, 4 app instances
  → maxPoolSize = 200/4 + 10% ≈ 55

Total connections = maxPoolSize × number of app instances
  → 55 × 4 = 220 connections to MongoDB

MongoDB Atlas M10: max 1500 connections
MongoDB Atlas M30: max 3000 connections
→ Phải đảm bảo total connections < server limit
```

---

## 13. Real-world E-commerce Case Study

Thiết kế schema cho hệ thống e-commerce hoàn chỉnh: dựa trên tất cả nguyên tắc từ file gốc + file bổ sung này.

### 13.1. Overview — Collections cần thiết

```
┌────────────────────────────────────────────────────────────────┐
│                    E-COMMERCE SCHEMA MAP                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐    ┌───────────┐    ┌──────────────┐            │
│  │  users   │───▶│  orders   │───▶│  payments    │            │
│  └────┬─────┘    └─────┬─────┘    └──────────────┘            │
│       │                │                                       │
│       │          ┌─────▼─────┐                                │
│       │          │ order_    │                                  │
│       │          │ items     │  (embedded in orders)           │
│       │          └───────────┘                                 │
│       │                                                        │
│  ┌────▼─────┐    ┌───────────┐    ┌──────────────┐            │
│  │ reviews  │───▶│ products  │◀──▶│  categories  │            │
│  └──────────┘    └─────┬─────┘    └──────────────┘            │
│                        │                                       │
│                  ┌─────▼─────┐    ┌──────────────┐            │
│                  │ inventory │    │   coupons    │             │
│                  └───────────┘    └──────────────┘            │
│                                                                │
│  ┌──────────┐    ┌───────────┐                                │
│  │  carts   │    │ addresses │  (embedded in users)            │
│  └──────────┘    └───────────┘                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 13.2. Collection: users

```json
{
  "_id": ObjectId("user_001"),
  "schema_version": 1,
  "email": "nguyen.a@gmail.com",
  "email_lower": "nguyen.a@gmail.com",
  "phone": "+84901234567",
  "password_hash": "$2b$12$...",
  "profile": {
    "first_name": "Nguyễn",
    "last_name": "Văn A",
    "avatar_url": "/avatars/user_001.jpg",
    "date_of_birth": ISODate("1990-05-15")
  },
  "addresses": [
    {
      "_id": ObjectId("addr_001"),
      "label": "home",
      "full_name": "Nguyễn Văn A",
      "phone": "+84901234567",
      "street": "123 Nguyễn Huệ",
      "ward": "Bến Nghé",
      "district": "Quận 1",
      "city": "TP.HCM",
      "postal_code": "700000",
      "is_default": true
    }
  ],
  "preferences": {
    "language": "vi",
    "currency": "VND",
    "notification_channels": ["email", "push"]
  },
  "status": "active",
  "roles": ["customer"],
  "created_at": ISODate("2025-01-01T00:00:00Z"),
  "updated_at": ISODate("2025-01-15T10:30:00Z"),
  "last_login_at": ISODate("2025-03-20T08:00:00Z")
}
```

**Rationale:**

- `addresses`: Embed (1-Few, luôn đọc cùng user, < 10 addresses)
- `profile`: Embed (1-1, luôn đọc cùng)
- `email_lower`: Pre-lowercase cho case-insensitive unique index
- `login_history`, `activity_log`: **TÁCH** ra collection riêng (unbounded, ít cần)

```javascript
// Indexes
db.users.createIndex({ email_lower: 1 }, { unique: true })
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true })
db.users.createIndex({ status: 1, created_at: -1 })
```

### 13.3. Collection: products

```json
{
  "_id": ObjectId("prod_001"),
  "schema_version": 1,
  "sku": "IPH15P-256-BLK",
  "name": "iPhone 15 Pro 256GB Black Titanium",
  "slug": "iphone-15-pro-256gb-black-titanium",
  "type": "phone",
  "brand": "Apple",
  "brand_slug": "apple",
  "category_id": ObjectId("cat_smartphones"),
  "category_path": ["electronics", "phones", "smartphones"],

  "pricing": {
    "base_price": 28990000,
    "sale_price": 27490000,
    "sale_start": ISODate("2025-03-01"),
    "sale_end": ISODate("2025-03-31"),
    "currency": "VND"
  },

  "inventory_snapshot": {
    "total_quantity": 150,
    "is_in_stock": true,
    "last_synced": ISODate("2025-03-20T10:00:00Z")
  },

  "media": {
    "thumbnail": "/images/products/iph15p-thumb.jpg",
    "images": [
      "/images/products/iph15p-1.jpg",
      "/images/products/iph15p-2.jpg"
    ],
    "video_url": null
  },

  "attrs": [
    { "k": "screen_size", "v": "6.1", "unit": "inch", "label": "Kích thước màn hình" },
    { "k": "storage", "v": "256", "unit": "GB", "label": "Bộ nhớ trong" },
    { "k": "ram", "v": "8", "unit": "GB", "label": "RAM" },
    { "k": "battery", "v": "3274", "unit": "mAh", "label": "Dung lượng pin" },
    { "k": "color", "v": "Black Titanium", "label": "Màu sắc" }
  ],

  "review_stats": {
    "total_count": 1247,
    "average_rating": 4.6,
    "rating_distribution": { "5": 823, "4": 256, "3": 98, "2": 45, "1": 25 }
  },

  "recent_reviews": [
    {
      "user_name": "Trần B",
      "rating": 5,
      "content": "Sản phẩm rất tốt...",
      "created_at": ISODate("2025-03-18")
    }
  ],

  "tags": ["iphone", "apple", "flagship", "5g"],
  "status": "active",
  "created_at": ISODate("2025-01-10"),
  "updated_at": ISODate("2025-03-20")
}
```

**Rationale — Kết hợp nhiều patterns:**

- `review_stats`: **Computed Pattern** — pre-computed aggregation, tránh $lookup + $group mỗi request
- `recent_reviews`: **Subset Pattern** — 5-10 reviews mới nhất, full reviews trong collection riêng
- `attrs`: **Attribute Pattern** — flexible attributes, 1 compound index cho tất cả
- `category_path`: **Array of Ancestors** — breadcrumb sẵn có, không cần traverse
- `inventory_snapshot`: **Extended Reference** — snapshot cho product listing, real-time stock check từ inventory collection
- `pricing`: Embed (1-1, luôn đọc cùng)

```javascript
// Indexes
db.products.createIndex({ sku: 1 }, { unique: true })
db.products.createIndex({ slug: 1 }, { unique: true })
db.products.createIndex({ category_id: 1, status: 1, 'pricing.base_price': 1 })
db.products.createIndex({ 'attrs.k': 1, 'attrs.v': 1 })
db.products.createIndex({ tags: 1 })
db.products.createIndex({ brand_slug: 1, status: 1 })
db.products.createIndex({ name: 'text', tags: 'text' }, { weights: { name: 10, tags: 5 } })
```

### 13.4. Collection: orders

```json
{
  "_id": ObjectId("ord_001"),
  "schema_version": 1,
  "order_number": "ORD-20250315-001",
  "customer_id": ObjectId("user_001"),
  "customer_snapshot": {
    "name": "Nguyễn Văn A",
    "email": "nguyen.a@gmail.com",
    "phone": "+84901234567"
  },

  "items": [
    {
      "product_id": ObjectId("prod_001"),
      "product_snapshot": {
        "name": "iPhone 15 Pro 256GB",
        "sku": "IPH15P-256-BLK",
        "thumbnail": "/images/products/iph15p-thumb.jpg",
        "price_at_purchase": 27490000
      },
      "quantity": 1,
      "unit_price": 27490000,
      "subtotal": 27490000
    }
  ],

  "shipping_address": {
    "full_name": "Nguyễn Văn A",
    "phone": "+84901234567",
    "street": "123 Nguyễn Huệ",
    "ward": "Bến Nghé",
    "district": "Quận 1",
    "city": "TP.HCM",
    "postal_code": "700000"
  },

  "pricing": {
    "subtotal": 27490000,
    "shipping_fee": 0,
    "discount_amount": 500000,
    "tax_amount": 0,
    "total": 26990000,
    "currency": "VND"
  },

  "coupon": {
    "code": "SALE500K",
    "discount_type": "fixed",
    "discount_value": 500000
  },

  "payment": {
    "method": "credit_card",
    "status": "paid",
    "transaction_id": "txn_abc123",
    "paid_at": ISODate("2025-03-15T10:35:00Z")
  },

  "shipping": {
    "method": "express",
    "carrier": "GHN",
    "tracking_number": "GHN123456789",
    "estimated_delivery": ISODate("2025-03-17"),
    "shipped_at": ISODate("2025-03-15T14:00:00Z"),
    "delivered_at": null
  },

  "status": "shipped",
  "status_history": [
    { "status": "pending",   "at": ISODate("2025-03-15T10:30:00Z"), "by": "system" },
    { "status": "confirmed", "at": ISODate("2025-03-15T10:35:00Z"), "by": "system" },
    { "status": "shipping",  "at": ISODate("2025-03-15T14:00:00Z"), "by": "admin_01" },
    { "status": "shipped",   "at": ISODate("2025-03-15T14:05:00Z"), "by": "system" }
  ],

  "notes": "Giao giờ hành chính",
  "created_at": ISODate("2025-03-15T10:30:00Z"),
  "updated_at": ISODate("2025-03-15T14:05:00Z")
}
```

**Rationale:**

- `items` + `product_snapshot`: **Extended Reference** — giữ snapshot giá + tên tại thời điểm mua
- `customer_snapshot`: **Extended Reference** — hiển thị nhanh không cần $lookup
- `shipping_address`: **Embed** copy từ user addresses — snapshot tại thời điểm đặt, không reference
- `status_history`: **Embed** (bounded, thường < 10 entries, cần atomicity với status update)
- `payment`: **Embed** (1-1, luôn đọc cùng order). Nếu cần payment records riêng → tách collection

```javascript
// Indexes
db.orders.createIndex({ order_number: 1 }, { unique: true })
db.orders.createIndex({ customer_id: 1, created_at: -1 })
db.orders.createIndex({ status: 1, created_at: -1 })
db.orders.createIndex({ 'payment.transaction_id': 1 }, { sparse: true })
db.orders.createIndex({ 'shipping.tracking_number': 1 }, { sparse: true })
```

### 13.5. Collection: reviews (riêng biệt)

```json
{
  "_id": ObjectId("rev_001"),
  "product_id": ObjectId("prod_001"),
  "user_id": ObjectId("user_042"),
  "order_id": ObjectId("ord_005"),
  "user_snapshot": {
    "name": "Trần Minh B",
    "avatar_url": "/avatars/user_042.jpg"
  },
  "rating": 5,
  "title": "Sản phẩm tuyệt vời",
  "content": "Pin trâu, camera đẹp, Face ID nhanh...",
  "images": ["/reviews/rev_001_1.jpg", "/reviews/rev_001_2.jpg"],
  "helpful_count": 23,
  "is_verified_purchase": true,
  "status": "approved",
  "created_at": ISODate("2025-02-10T08:00:00Z"),
  "updated_at": ISODate("2025-02-10T08:00:00Z")
}
```

**Rationale**: Tách collection vì 1 product có thể có **hàng ngàn** reviews, cần **query/filter/sort/paginate** độc lập.

```javascript
// Indexes
db.reviews.createIndex({ product_id: 1, status: 1, created_at: -1 })
db.reviews.createIndex({ user_id: 1, created_at: -1 })
db.reviews.createIndex({ product_id: 1, rating: 1 })
```

### 13.6. Collection: inventory (riêng biệt)

```json
{
  "_id": ObjectId("inv_001"),
  "product_id": ObjectId("prod_001"),
  "sku": "IPH15P-256-BLK",
  "warehouse_id": ObjectId("wh_hcm_01"),
  "quantity": 85,
  "reserved_quantity": 12,
  "available_quantity": 73,
  "reorder_point": 20,
  "reorder_quantity": 100,
  "last_restocked_at": ISODate("2025-03-10"),
  "updated_at": ISODate("2025-03-20T10:00:00Z")
}
```

**Rationale**: Tách khỏi products vì:

- **Write-heavy** (mỗi order update inventory)
- Cần **real-time accuracy** (khác product info có thể cached)
- Cần **atomicity** cho quantity updates (tránh overselling)
- Có thể có **nhiều warehouses** cho cùng 1 product

```javascript
// Indexes
db.inventory.createIndex({ product_id: 1, warehouse_id: 1 }, { unique: true })
db.inventory.createIndex({ sku: 1 })

// Atomic decrement — tránh overselling
db.inventory.updateOne(
  {
    product_id: productId,
    warehouse_id: warehouseId,
    available_quantity: { $gte: orderQty }, // CHECK trước khi trừ
  },
  {
    $inc: {
      available_quantity: -orderQty,
      reserved_quantity: orderQty,
    },
  },
)
```

### 13.7. Collection: categories (Tree structure)

```json
{
  "_id": ObjectId("cat_smartphones"),
  "name": "Smartphones",
  "slug": "smartphones",
  "parent_id": ObjectId("cat_phones"),
  "ancestors": [
    { "_id": ObjectId("cat_electronics"), "name": "Electronics", "slug": "electronics" },
    { "_id": ObjectId("cat_phones"), "name": "Phones", "slug": "phones" }
  ],
  "level": 2,
  "sort_order": 1,
  "image_url": "/categories/smartphones.jpg",
  "is_active": true,
  "product_count": 342
}
```

**Rationale**:

- `ancestors`: **Array of Ancestors Pattern** — breadcrumb sẵn có
- `product_count`: **Computed Pattern** — đếm sẵn, không cần count mỗi request
- `parent_id`: Giữ lại cho tree operations (thêm/xóa/di chuyển node)

### 13.8. Tổng kết Case Study

| Collection | Avg Doc Size | Growth      | Access Pattern          | Key Design Decisions                            |
| ---------- | ------------ | ----------- | ----------------------- | ----------------------------------------------- |
| users      | ~2 KB        | Slow        | Read-heavy              | Embed addresses, profile                        |
| products   | ~5 KB        | Slow        | Read-heavy              | Computed + Subset + Attribute patterns          |
| orders     | ~3 KB        | Fast        | Write then read         | Extended Reference snapshots                    |
| reviews    | ~1 KB        | Fast        | Read-heavy, independent | Separate collection, computed stats in products |
| inventory  | ~0.5 KB      | Fast writes | Write-heavy             | Separate for atomicity + real-time accuracy     |
| categories | ~0.5 KB      | Very slow   | Read-heavy              | Array of Ancestors for breadcrumb               |

---

## Tài Liệu Tham Khảo Bổ Sung

- [MongoDB Time Series Collections](https://www.mongodb.com/docs/manual/core/timeseries-collections/)
- [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/)
- [Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [Atlas Search](https://www.mongodb.com/docs/atlas/atlas-search/)
- [Building with Patterns — Complete Series](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [MongoDB Performance Best Practices](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Multi-tenancy with MongoDB](https://www.mongodb.com/docs/manual/tutorial/model-data-for-multi-tenancy/)
- [Data Modeling — Tree Structures](https://www.mongodb.com/docs/manual/applications/data-models-tree-structures/)
- [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
- [Causal Consistency Sessions](https://www.mongodb.com/docs/manual/core/causal-consistency-read-write-guarantees/)
- [Zone Sharding](https://www.mongodb.com/docs/manual/tutorial/manage-shard-zone/)
- [Resharding a Collection](https://www.mongodb.com/docs/manual/core/sharding-reshard-a-collection/)
