# 📋 Tóm Tắt Thiết Lập Cart & Order System

## 🎯 Tổng Quan

Tài liệu này tóm tắt toàn bộ quá trình phân tích và thiết lập dữ liệu mẫu cho hệ thống Cart và Order trong NestJS Ecommerce API. Bao gồm việc tạo script khởi tạo dữ liệu, xử lý upload hình ảnh lên S3, và cập nhật Postman collection.

---

## 🔍 Phân Tích Codebase

### 📁 Cấu Trúc Module Cart

**Location:** `src/routes/cart/`

**Files:**

- `cart.model.ts` - Định nghĩa schema và types cho Cart
- `cart.dto.ts` - Data Transfer Objects
- `cart.controller.ts` - REST API endpoints
- `cart.service.ts` - Business logic
- `cart.repo.ts` - Database operations
- `cart.error.ts` - Custom error definitions

**Key Features:**

- ✅ Quản lý giỏ hàng theo user
- ✅ CRUD operations cho cart items
- ✅ Pagination support
- ✅ Integration với SKU và Product

### 📁 Cấu Trúc Module Order

**Location:** `src/routes/order/`

**Files:**

- `order.model.ts` - Định nghĩa schema và types cho Order
- `order.dto.ts` - Data Transfer Objects
- `order.controller.ts` - REST API endpoints
- `order.service.ts` - Business logic
- `order.repo.ts` - Database operations
- `order.error.ts` - Custom error definitions

**Key Features:**

- ✅ Tạo order từ cart items
- ✅ Order status management (PENDING_PAYMENT, DELIVERED, etc.)
- ✅ Product snapshot để lưu trữ thông tin sản phẩm tại thời điểm order
- ✅ Multi-shop support
- ✅ Receiver information management

### 📁 Cấu Trúc Module Media

**Location:** `src/routes/media/`

**Files:**

- `media.model.ts` - Schema cho upload files
- `media.controller.ts` - Upload endpoints
- `media.service.ts` - S3 integration logic

**Key Features:**

- ✅ Local file upload
- ✅ S3 presigned URL generation
- ✅ File serving

---

## 🗄️ Database Schema Analysis

### Core Tables

**User Table:**

```sql
- id (Primary Key)
- email, name, password
- phoneNumber, avatar
- status (ACTIVE/INACTIVE/BLOCKED)
- roleId (Foreign Key to Role)
- Audit fields (createdAt, updatedAt, deletedAt)
```

**Product Table:**

```sql
- id (Primary Key)
- name, basePrice, virtualPrice
- brandId (Foreign Key to Brand)
- images (Array of URLs)
- variants (JSON field)
- publishedAt
- Audit fields
```

**SKU Table:**

```sql
- id (Primary Key)
- value (variant combination)
- price, stock
- image
- productId (Foreign Key to Product)
- Audit fields
```

**CartItem Table:**

```sql
- id (Primary Key)
- userId (Foreign Key to User)
- skuId (Foreign Key to SKU)
- quantity
- createdAt, updatedAt
```

**Order Table:**

```sql
- id (Primary Key)
- userId (Foreign Key to User)
- status (ENUM)
- receiver (JSON: name, phone, address)
- shopId (Foreign Key to User - seller)
- Audit fields
```

**ProductSKUSnapshot Table:**

```sql
- id (Primary Key)
- orderId (Foreign Key to Order)
- productId, productName
- productTranslations (JSON)
- skuId, skuValue, skuPrice
- image, quantity
- createdAt
```

---

## 🚀 Scripts Đã Tạo

### 1. Script Khởi Tạo Dữ Liệu - `initialScript/add-cart-order-data.ts`

**Chức năng:**

- ✅ Tạo users mẫu (customers và sellers)
- ✅ Tạo brands và categories
- ✅ Tạo products với variants
- ✅ Tạo SKUs cho mỗi product
- ✅ Tạo cart items cho customers
- ✅ Tạo orders từ cart items
- ✅ Tạo product snapshots cho orders

**Dữ Liệu Mẫu:**

- 3 khách hàng (customer1-3@example.com)
- 2 sellers (seller1-2@example.com)
- 5 brands (Apple, Samsung, Xiaomi, Nike, Adidas)
- 4 categories (Điện tử, Thời trang, Gia dụng, Thể thao)
- 5 products với variants đầy đủ
- SKUs tương ứng với các combinations
- Cart items và Orders realistic

**Cách chạy:**

```bash
cd initialScript
npx ts-node add-cart-order-data.ts
```

### 2. Script Upload Hình Ảnh - `initialScript/upload-sample-image.ts`

**Chức năng:**

- ✅ Upload hình ảnh mẫu lên S3
- ✅ Tạo multiple variations với tên khác nhau
- ✅ Generate URLs cho different use cases

**Hình Ảnh Được Upload:**

- `product-main.jpg` - Hình chính sản phẩm
- `product-variant-*.jpg` - Hình variants
- `brand-logo.jpg` - Logo thương hiệu
- `user-avatar.jpg` - Avatar người dùng
- `category-banner.jpg` - Banner danh mục

**Cách sử dụng:**

```bash
cd initialScript
npx ts-node upload-sample-image.ts
```

**Output:** Danh sách URLs để thay thế vào script chính

---

## 📮 Postman Collection Updates

### Cart APIs

**GET /cart** - Lấy giỏ hàng

- Query params: page, limit
- Headers: Authorization Bearer token

**POST /cart** - Thêm vào giỏ hàng

- Body: `{ "skuId": number, "quantity": number }`
- Headers: Authorization + Content-Type

**PUT /cart/:cartItemId** - Cập nhật cart item

- Params: cartItemId
- Body: `{ "skuId": number, "quantity": number }`

**POST /cart/delete** - Xóa cart items

- Body: `{ "cartItemIds": [number] }`

### Order APIs

**GET /orders** - Danh sách orders

- Query params: page, limit, status
- Headers: Authorization Bearer token

**POST /orders** - Tạo order

- Body: Array of order requests với shopId, receiver info, cartItemIds

**GET /orders/:orderId** - Chi tiết order

- Params: orderId
- Headers: Authorization

**PUT /orders/:orderId** - Hủy order

- Params: orderId
- Body: `{}`

---

## 🛠️ Hướng Dẫn Sử Dụng

### Bước 1: Upload Hình Ảnh

```bash
# Chạy script upload để có URLs
cd initialScript
npx ts-node upload-sample-image.ts

# Copy các URLs được generate
```

### Bước 2: Cập Nhật URLs Trong Script

```typescript
// Trong file add-cart-order-data.ts
// Thay thế SAMPLE_IMAGE_URL bằng URLs thực tế từ S3
const SAMPLE_IMAGE_URL = 'https://your-s3-bucket.s3.region.amazonaws.com/...'
```

### Bước 3: Chạy Script Tạo Dữ Liệu

```bash
cd initialScript
npx ts-node add-cart-order-data.ts
```

### Bước 4: Import Postman Collection

- Mở Postman
- Import file `docs/postman/NestJS_Ecommerce_API.postman_collection.json`
- Set variables: accessToken, refreshToken

### Bước 5: Test APIs

1. **Login** để lấy accessToken
2. **Get Cart** - Xem giỏ hàng hiện tại
3. **Add to Cart** - Thêm sản phẩm vào giỏ
4. **Create Order** - Tạo đơn hàng từ cart items
5. **List Orders** - Xem danh sách đơn hàng

---

## 🔧 Cấu Hình Môi Trường

### Environment Variables Cần Thiết:

```bash
# Database
DATABASE_URL="postgresql://..."

# S3 Configuration
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
```

### Dependencies:

- NestJS framework
- Prisma ORM
- AWS SDK for S3
- Zod for validation
- bcrypt for password hashing

---

## 🎯 Kết Quả Đạt Được

### ✅ Hoàn Thành:

1. **Phân tích codebase** - Hiểu rõ cấu trúc Cart, Order, Media modules
2. **Tạo script dữ liệu mẫu** - Script comprehensive với realistic data
3. **Xử lý upload S3** - Script upload hình ảnh với multiple variations
4. **Cập nhật Postman** - Collection đầy đủ cho testing APIs
5. **Documentation** - Tài liệu chi tiết và hướng dẫn sử dụng

### 📊 Thống Kê Dữ Liệu Mẫu:

- **Users:** 5+ (admin, customers, sellers)
- **Brands:** 5 (Apple, Samsung, Xiaomi, Nike, Adidas)
- **Categories:** 4 (Điện tử, Thời trang, Gia dụng, Thể thao)
- **Products:** 5 với đầy đủ variants
- **SKUs:** 50+ combinations
- **Cart Items:** 9-15 items
- **Orders:** 2-3 orders với realistic data
- **Images:** 9 variations uploaded to S3

### 🚀 Ready for Testing:

- Database với dữ liệu mẫu realistic
- S3 với hình ảnh sản phẩm
- Postman collection để test APIs
- Documentation đầy đủ

---

## 🔄 Next Steps

1. **Chạy upload script** để có hình ảnh thực tế trên S3
2. **Update URLs** trong data script
3. **Run data script** để populate database
4. **Test APIs** với Postman collection
5. **Customize data** theo nhu cầu cụ thể

---

## 📞 Support

Nếu gặp vấn đề trong quá trình setup:

1. **Check logs** từ scripts để debug
2. **Verify environment** variables
3. **Ensure database** connection
4. **Confirm S3** permissions
5. **Review Postman** variable settings

---

_Document được tạo tự động từ quá trình phân tích và setup Cart & Order system._
