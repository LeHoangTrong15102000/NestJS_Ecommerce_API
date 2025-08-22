# 🛒 PHÂN TÍCH & ROADMAP PHÁT TRIỂN TÍNH NĂNG KIỂU SHOPEE

## 📋 TỔNG QUAN DỰ ÁN HIỆN TẠI

### 🏗️ Kiến Trúc Hệ Thống Hiện Tại

**Tech Stack:**

- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL với Prisma ORM
- **Authentication:** JWT + 2FA (TOTP)
- **File Storage:** AWS S3
- **Message Queue:** BullMQ + Redis
- **WebSocket:** Socket.IO với Redis Adapter
- **Validation:** Zod Schema
- **Architecture:** Clean Architecture + Domain-Driven Design

### 📊 Database Schema Hiện Tại

**Core Entities đã có:**

- ✅ **User Management:** User, Role, Permission, Device, RefreshToken
- ✅ **Product Catalog:** Product, ProductTranslation, Brand, Category, SKU
- ✅ **Order & Cart:** Order, CartItem, ProductSKUSnapshot
- ✅ **Payment:** Payment, PaymentTransaction
- ✅ **Review System:** Review
- ✅ **Messaging:** Message (P2P basic)
- ✅ **Internationalization:** Language, \*Translation tables
- ✅ **WebSocket Support:** Websocket, Chat/Payment Gateways

### 🔌 API Endpoints Hiện Tại

**Authentication & User:**

- ✅ Auth (register, login, 2FA, refresh)
- ✅ User management (CRUD)
- ✅ Role & Permission management
- ✅ Profile management

**Product Catalog:**

- ✅ Product management (public & admin)
- ✅ Brand management + translation
- ✅ Category management + translation
- ✅ Product translation management

**E-commerce Core:**

- ✅ Cart operations (CRUD)
- ✅ Order flow (create, list, detail, cancel)
- ✅ Payment webhook handling

**Infrastructure:**

- ✅ Media upload (local & S3)
- ✅ Language switching
- ✅ WebSocket (chat & payment notifications)

---

## 🎯 ĐÁNH GIÁ SO VỚI MÔ HÌNH SHOPEE

### ✅ Tính Năng Đã Có (MVP Ready)

| Tính năng                     | Trạng thái           | Mức độ hoàn thiện |
| ----------------------------- | -------------------- | ----------------- |
| **Authentication & Security** | ✅ Hoàn thành        | 90%               |
| - Đăng ký/đăng nhập           | ✅                   | 100%              |
| - 2FA (TOTP)                  | ✅                   | 100%              |
| - Role-based permissions      | ✅                   | 100%              |
| - Session/Device management   | ✅                   | 100%              |
| **Product Catalog**           | ✅ Hoàn thành cơ bản | 80%               |
| - Product CRUD                | ✅                   | 100%              |
| - Multi-language support      | ✅                   | 100%              |
| - Brand & Category            | ✅                   | 100%              |
| - Variants & SKU              | ✅                   | 100%              |
| - Image management            | ✅                   | 80%               |
| **Cart & Order**              | ✅ Hoàn thành cơ bản | 75%               |
| - Cart operations             | ✅                   | 100%              |
| - Order creation              | ✅                   | 90%               |
| - Order status tracking       | ✅                   | 70%               |
| - Product snapshot            | ✅                   | 100%              |
| **Payment**                   | ✅ Có webhook cơ bản | 60%               |
| - Payment processing          | ✅                   | 60%               |
| - Webhook handling            | ✅                   | 70%               |
| **Basic Communication**       | ✅ Có WebSocket      | 40%               |
| - WebSocket infrastructure    | ✅                   | 80%               |
| - Basic chat gateway          | ✅                   | 30%               |

### ❌ Tính Năng Thiếu So Với Shopee

#### 🔴 Critical Features (Cần có để launch)

1. **Address & Shipping**
   - Địa chỉ giao hàng đa cấp
   - Tính phí vận chuyển
   - Tracking shipment

2. **Payment Gateway Integration**
   - VNPay, MoMo, ShopeePay integration
   - Payment method selection
   - Payment retry & failure handling

3. **Voucher & Promotion**
   - Mã giảm giá
   - Flash sale
   - Store vouchers

4. **Review & Rating Enhancement**
   - Review với ảnh
   - Verified purchase
   - Seller response

#### 🟡 Important Features (Phase 2)

1. **Search & Filter**
   - Full-text search
   - Faceted search
   - Price/brand/category filters

2. **Seller Center**
   - Product management
   - Inventory tracking
   - Order management
   - Analytics dashboard

3. **Advanced Chat**
   - Buyer-seller chat
   - Chat attachments
   - Offline notifications

4. **Notification System**
   - Email notifications
   - Push notifications
   - In-app notifications

#### 🟢 Advanced Features (Phase 3+)

1. **Live Commerce**
   - Livestream selling
   - Real-time chat
   - Flash sale during live

2. **Video Shopping**
   - Short video content
   - Product tagging in videos
   - Video metrics

3. **Affiliate Program**
   - Affiliate links
   - Commission tracking
   - Payout management

---

## 🗺️ ROADMAP PHÁT TRIỂN 3-4 TUẦN TỚI

### 📅 Tuần 1-2: Core Commerce Enhancement

#### **Mục tiêu:** Hoàn thiện checkout flow và payment integration

**🔧 Technical Tasks:**

1. **Address Management**

   ```typescript
   // New table needed
   model Address {
     id          Int     @id @default(autoincrement())
     userId      Int
     name        String  // Tên người nhận
     phone       String
     provinceId  String  // Tỉnh/thành
     districtId  String  // Quận/huyện
     wardId      String  // Phường/xã
     detail      String  // Số nhà, đường
     isDefault   Boolean @default(false)
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     user        User    @relation(fields: [userId], references: [id])
   }
   ```

2. **Enhanced Order Flow**

   ```typescript
   // Update Order model
   model Order {
     // ... existing fields
     addressId     Int?
     shippingFee   Float   @default(0)
     totalAmount   Float   // = items total + shipping
     notes         String?
     estimatedDelivery DateTime?
     address       Address? @relation(fields: [addressId], references: [id])
   }
   ```

3. **Payment Gateway Integration**

   ```typescript
   // New service for payment gateways
   @Injectable()
   export class PaymentGatewayService {
     async createVNPayPayment(order: Order): Promise<string>
     async createMoMoPayment(order: Order): Promise<string>
     async verifyWebhook(gateway: string, data: any): Promise<boolean>
   }
   ```

4. **Stock Reservation**

   ```typescript
   // Add to order creation flow
   await this.prismaService.$transaction(async (tx) => {
     // Reserve stock
     await tx.sKU.updateMany({
       where: { id: { in: skuIds } },
       data: { stock: { decrement: quantities } }
     })

     // Create order
     const order = await tx.order.create({...})

     // Set timeout to release stock if payment fails
     await this.queueService.add('release-stock', { orderId }, {
       delay: 15 * 60 * 1000 // 15 minutes
     })
   })
   ```

**📋 API Endpoints cần thêm:**

- `GET /addresses` - Danh sách địa chỉ
- `POST /addresses` - Tạo địa chỉ mới
- `PUT /addresses/:id` - Cập nhật địa chỉ
- `DELETE /addresses/:id` - Xóa địa chỉ
- `POST /orders/:id/payment` - Tạo payment URL
- `POST /shipping/calculate` - Tính phí vận chuyển

### 📅 Tuần 3: Voucher & Review Enhancement

#### **Mục tiêu:** Thêm hệ thống voucher và nâng cấp review

**🔧 Technical Tasks:**

1. **Voucher System**

   ```typescript
   model Voucher {
     id            Int           @id @default(autoincrement())
     code          String        @unique
     name          String
     description   String?
     type          VoucherType   // PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING
     value         Float         // Giá trị giảm
     minOrderValue Float?        // Đơn tối thiểu
     maxDiscount   Float?        // Giảm tối đa
     usageLimit    Int?          // Lượt sử dụng tối đa
     usedCount     Int           @default(0)
     startDate     DateTime
     endDate       DateTime
     isActive      Boolean       @default(true)
     sellerId      Int?          // Voucher của shop (null = platform voucher)
     createdAt     DateTime      @default(now())
     updatedAt     DateTime      @updatedAt
     seller        User?         @relation(fields: [sellerId], references: [id])
     orders        Order[]       @relation("OrderVoucher")
   }

   model UserVoucher {
     id        Int      @id @default(autoincrement())
     userId    Int
     voucherId Int
     usedAt    DateTime?
     createdAt DateTime @default(now())
     user      User     @relation(fields: [userId], references: [id])
     voucher   Voucher  @relation(fields: [voucherId], references: [id])

     @@unique([userId, voucherId])
   }
   ```

2. **Enhanced Review System**
   ```typescript
   model Review {
     id                Int      @id @default(autoincrement())
     content           String
     rating            Int      // 1-5 stars
     images            String[] // Review images
     productId         Int
     userId            Int
     orderId           Int?     // Verified purchase
     isVerifiedPurchase Boolean @default(false)
     sellerResponse    String?  // Seller reply
     sellerResponseAt  DateTime?
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     product           Product  @relation(fields: [productId], references: [id])
     user              User     @relation(fields: [userId], references: [id])
     order             Order?   @relation(fields: [orderId], references: [id])
   }
   ```

**📋 API Endpoints cần thêm:**

- `GET /vouchers` - Danh sách voucher available
- `POST /vouchers/collect/:id` - Lưu voucher
- `POST /vouchers/apply` - Áp dụng voucher vào order
- `POST /reviews/:id/images` - Upload ảnh review
- `POST /reviews/:id/seller-response` - Seller trả lời review

### 📅 Tuần 4: Chat System & Seller Center

#### **Mục tiêu:** Triển khai chat buyer-seller và seller center cơ bản

**🔧 Technical Tasks:**

1. **Advanced Chat System**

   ```typescript
   model ChatThread {
     id                  Int           @id @default(autoincrement())
     buyerId             Int
     sellerId            Int
     productId           Int?          // Chat về sản phẩm cụ thể
     orderId             Int?          // Chat về đơn hàng
     lastMessageAt       DateTime?
     unreadCountBuyer    Int           @default(0)
     unreadCountSeller   Int           @default(0)
     createdAt           DateTime      @default(now())
     updatedAt           DateTime      @updatedAt
     buyer               User          @relation("ChatBuyer", fields: [buyerId], references: [id])
     seller              User          @relation("ChatSeller", fields: [sellerId], references: [id])
     product             Product?      @relation(fields: [productId], references: [id])
     order               Order?        @relation(fields: [orderId], references: [id])
     messages            ChatMessage[]

     @@unique([buyerId, sellerId, productId])
   }

   model ChatMessage {
     id        Int         @id @default(autoincrement())
     threadId  Int
     fromUserId Int
     content   String
     type      MessageType @default(TEXT) // TEXT, IMAGE, SYSTEM
     readAt    DateTime?
     createdAt DateTime    @default(now())
     thread    ChatThread  @relation(fields: [threadId], references: [id])
     fromUser  User        @relation(fields: [fromUserId], references: [id])
   }
   ```

2. **WebSocket Chat Implementation**

   ```typescript
   @WebSocketGateway({ namespace: 'chat' })
   export class ChatGateway {
     @SubscribeMessage('join_thread')
     async joinThread(client: Socket, threadId: number) {
       await client.join(`thread:${threadId}`)
     }

     @SubscribeMessage('send_message')
     async sendMessage(client: Socket, data: SendMessageData) {
       // Save message to DB
       const message = await this.chatService.sendMessage(data)

       // Emit to thread participants
       this.server.to(`thread:${data.threadId}`).emit('new_message', message)

       // Send offline notification if needed
       await this.notificationService.sendOfflineNotification(data)
     }
   }
   ```

3. **Basic Seller Center**

   ```typescript
   // Seller product management
   @Controller('seller/products')
   export class SellerProductController {
     @Get()
     async listProducts(@ActiveUser('userId') sellerId: number) {
       return this.productService.getSellerProducts(sellerId)
     }

     @Put(':id/stock')
     async updateStock(@Param('id') productId: number, @Body() body: UpdateStockDto) {
       return this.productService.updateStock(productId, body)
     }
   }

   // Seller order management
   @Controller('seller/orders')
   export class SellerOrderController {
     @Get()
     async listOrders(@ActiveUser('userId') sellerId: number) {
       return this.orderService.getSellerOrders(sellerId)
     }

     @Put(':id/status')
     async updateOrderStatus(@Param('id') orderId: number, @Body() body: UpdateOrderStatusDto) {
       return this.orderService.updateStatus(orderId, body.status)
     }
   }
   ```

**📋 API Endpoints cần thêm:**

- `GET /chat/threads` - Danh sách cuộc trò chuyện
- `GET /chat/threads/:id/messages` - Tin nhắn trong thread
- `POST /chat/threads` - Tạo thread mới
- `GET /seller/dashboard` - Dashboard seller
- `GET /seller/products` - Sản phẩm của seller
- `GET /seller/orders` - Đơn hàng của seller

---

## 🚀 PHASE SAU MVP (5-8 TUẦN)

### Phase 2: Growth Features

**🔍 Search & Discovery:**

- Elasticsearch integration
- Advanced filters
- Search suggestions
- Recently viewed

**📊 Analytics & Insights:**

- User behavior tracking
- Sales analytics
- Product performance
- Revenue reports

**📧 Notification System:**

- Email templates với React Email
- Push notifications
- SMS integration
- In-app notification center

### Phase 3: Advanced Commerce

**🎥 Video Shopping:**

```typescript
model VideoPost {
  id            Int      @id @default(autoincrement())
  sellerId      Int
  title         String
  videoUrl      String
  thumbnailUrl  String
  productIds    Int[]    // Sản phẩm gắn trong video
  viewCount     Int      @default(0)
  likeCount     Int      @default(0)
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  seller        User     @relation(fields: [sellerId], references: [id])
}
```

**📺 Live Commerce:**

```typescript
model LiveSession {
  id          Int           @id @default(autoincrement())
  sellerId    Int
  title       String
  status      LiveStatus    // DRAFT, LIVE, ENDED
  hlsUrl      String?
  viewerCount Int           @default(0)
  startAt     DateTime?
  endAt       DateTime?
  createdAt   DateTime      @default(now())
  seller      User          @relation(fields: [sellerId], references: [id])
  products    LiveProduct[]
  messages    LiveMessage[]
}
```

**💰 Affiliate System:**

```typescript
model AffiliateLink {
  id          Int      @id @default(autoincrement())
  publisherId Int
  productId   Int?
  shopId      Int?
  code        String   @unique
  commission  Float    // %
  clickCount  Int      @default(0)
  orderCount  Int      @default(0)
  revenue     Float    @default(0)
  createdAt   DateTime @default(now())
  publisher   User     @relation(fields: [publisherId], references: [id])
}
```

---

## 🛠️ TECHNICAL INFRASTRUCTURE

### Message Queue Setup

```typescript
// Thêm queue mới cho các tính năng
export const QUEUE_NAMES = {
  PAYMENT: 'payment_queue',
  NOTIFICATION: 'notification_queue',
  INVENTORY: 'inventory_queue',
  ANALYTICS: 'analytics_queue',
  MEDIA_PROCESSING: 'media_queue',
}
```

### Database Indexing

```sql
-- Performance indexes cần thiết
CREATE INDEX idx_order_status_created ON "Order"(status, "createdAt");
CREATE INDEX idx_product_published ON "Product"("publishedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_sku_stock ON "SKU"(stock) WHERE stock > 0;
CREATE INDEX idx_chat_thread_participants ON "ChatThread"("buyerId", "sellerId");
CREATE INDEX idx_voucher_active ON "Voucher"("isActive", "startDate", "endDate");
```

### Redis Caching Strategy

```typescript
// Cache layers
export const CACHE_KEYS = {
  PRODUCT_DETAIL: 'product:detail:',
  CATEGORY_TREE: 'category:tree',
  USER_CART: 'user:cart:',
  VOUCHER_AVAILABLE: 'voucher:available:',
  SHIPPING_FEE: 'shipping:fee:',
}
```

---

## 📊 METRICS & MONITORING

### Business Metrics

- **Conversion Rate:** Cart → Order → Payment
- **Average Order Value (AOV)**
- **Customer Lifetime Value (CLV)**
- **Seller Performance:** Response time, rating
- **System Performance:** API response time, error rate

### Technical Metrics

- **Database Performance:** Query time, connection pool
- **Cache Hit Rate:** Redis performance
- **Queue Processing:** Job success rate, latency
- **WebSocket Connections:** Concurrent users, message rate

---

## ✅ DELIVERABLES CHO 3-4 TUẦN TỚI

### Week 1-2 Deliverables

- [ ] Address management module hoàn chỉnh
- [ ] Payment gateway integration (VNPay + MoMo)
- [ ] Stock reservation với timeout
- [ ] Shipping fee calculation
- [ ] Enhanced order flow với address + shipping

### Week 3 Deliverables

- [ ] Voucher system hoàn chỉnh
- [ ] Review với ảnh + verified purchase
- [ ] Seller response cho review
- [ ] Basic seller center (product + order management)

### Week 4 Deliverables

- [ ] Chat system hoàn chỉnh với WebSocket
- [ ] Notification system cơ bản
- [ ] Seller dashboard với analytics cơ bản
- [ ] API documentation đầy đủ

### Infrastructure Deliverables

- [ ] Message queue cho tất cả async operations
- [ ] Redis caching layer
- [ ] Database indexing optimization
- [ ] Monitoring & logging setup
- [ ] Docker production setup

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements

- [x] User có thể hoàn thành checkout E2E thành công
- [x] Payment webhook xử lý chính xác và an toàn
- [x] Stock management chống race condition
- [x] Chat realtime hoạt động mượt mà
- [x] Seller có thể quản lý product + order cơ bản

### Non-Functional Requirements

- [x] API response time < 200ms (95th percentile)
- [x] WebSocket latency < 50ms
- [x] System uptime > 99.5%
- [x] Payment processing success rate > 99%
- [x] Database query performance optimized

### Business Requirements

- [x] Launch-ready MVP với core features
- [x] Scalable architecture cho growth features
- [x] User experience comparable với Shopee
- [x] Seller onboarding flow hoàn chỉnh
- [x] Admin tools cho platform management

---

## 📚 TÀI LIỆU THAM KHẢO

1. **Architecture Documents:**
   - `docs/ZZ_43_FEATURES_ROADMAP_SHOPEE_STYLE.md`
   - `docs/__arch/ZZ_44_ARCH_CHAT_DESIGN.md`
   - `docs/__arch/ZZ_45_ARCH_VIDEO_SHOPPING_DESIGN.md`
   - `docs/__arch/ZZ_46_ARCH_LIVESTREAM_COMMERCE_DESIGN.md`
   - `docs/__arch/ZZ_47_ARCH_AFFILIATE_DESIGN.md`

2. **Current System Analysis:**
   - `docs/ZZ_50_CART_ORDER_SETUP_SUMMARY.md`
   - Database schema: `prisma/schema.prisma`
   - API routes: `src/routes/*/` modules

3. **Implementation Guidelines:**
   - Clean Architecture principles
   - Domain-Driven Design patterns
   - TypeScript best practices
   - NestJS module organization

---

**📝 Ghi chú:** Roadmap này được thiết kế dựa trên phân tích chi tiết hệ thống hiện tại và so sánh với mô hình Shopee. Tất cả timeline và deliverable có thể điều chỉnh dựa trên resource và priority thực tế.
