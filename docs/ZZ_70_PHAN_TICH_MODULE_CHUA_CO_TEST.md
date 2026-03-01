# PHÂN TÍCH CÁC MODULE CHƯA CÓ TEST VÀ ĐỀ XUẤT CHIẾN LƯỢC TESTING

## 📊 TỔNG QUAN TÌNH TRẠNG TESTING

### ✅ Modules ĐÃ CÓ TESTS (Unit + Integration)

| Module           | Unit Tests                 | Integration Tests                  | Trạng Thái     |
| ---------------- | -------------------------- | ---------------------------------- | -------------- |
| **Auth**         | ✅ `__tests__/`            | ✅ `auth-flow.integration.spec.ts` | **HOÀN CHỈNH** |
| **Address**      | ✅ `__tests__/` (55 tests) | ❌                                 | **TỐT**        |
| **Cart**         | ✅ `__tests__/`            | ✅ `cart-integration.spec.ts`      | **HOÀN CHỈNH** |
| **Conversation** | ✅ `__tests__/` (62 tests) | ❌                                 | **TỐT**        |
| **Order**        | ✅ `__tests__/`            | ✅ `order-integration.spec.ts`     | **HOÀN CHỈNH** |
| **Product**      | ✅ `__tests__/`            | ❌                                 | **TỐT**        |
| **Review**       | ✅ `__tests__/`            | ❌                                 | **TỐT**        |
| **Voucher**      | ✅ `__tests__/`            | ✅ `voucher-integration.spec.ts`   | **HOÀN CHỈNH** |

### ❌ Modules CHƯA CÓ TESTS (Cần Ưu Tiên)

| Module           | Độ Ưu Tiên        | Lý Do                                        | Độ Phức Tạp    |
| ---------------- | ----------------- | -------------------------------------------- | -------------- |
| **Wishlist**     | 🔴 **CAO**        | Module mới, có background jobs, price alerts | **Cao**        |
| **AI Assistant** | 🔴 **CAO**        | Module mới, tích hợp Anthropic Claude        | **Cao**        |
| **Payment**      | 🔴 **CAO**        | Critical business logic, Stripe integration  | **Rất Cao**    |
| **Brand**        | 🟡 **TRUNG BÌNH** | CRUD cơ bản, có translation                  | **Trung Bình** |
| **Category**     | 🟡 **TRUNG BÌNH** | CRUD cơ bản, có translation, tree structure  | **Trung Bình** |
| **Language**     | 🟢 **THẤP**       | CRUD đơn giản                                | **Thấp**       |
| **Media**        | 🟡 **TRUNG BÌNH** | S3 upload, presigned URLs                    | **Trung Bình** |
| **Permission**   | 🟡 **TRUNG BÌNH** | RBAC system                                  | **Trung Bình** |
| **Profile**      | 🟢 **THẤP**       | User profile management                      | **Thấp**       |
| **Role**         | 🟡 **TRUNG BÌNH** | RBAC system, cache                           | **Trung Bình** |
| **User**         | 🔴 **CAO**        | Core business logic, RBAC                    | **Cao**        |

---

## 🎯 PHÂN TÍCH CHI TIẾT CÁC MODULE CHƯA CÓ TEST

### 1. 🔴 WISHLIST MODULE (Ưu Tiên Cao)

#### **Tại sao cần test:**

- Module mới được implement gần đây
- Có background jobs (price check, alerts)
- Tích hợp với BullMQ queue
- Có cron job chạy hàng ngày
- Business logic phức tạp (price alerts, collections, notifications)

#### **Các tính năng cần test:**

**Service Layer (`wishlist.service.ts`):**

- ✅ Add item to wishlist (upsert pattern)
- ✅ Get wishlist items (pagination, filtering)
- ✅ Update wishlist item (note, priority, notifications)
- ✅ Remove item from wishlist
- ✅ Move item to cart
- ✅ Get wishlist count (with caching)
- ✅ Check if product is wishlisted
- ✅ Set target price for price alerts
- ✅ Collection management (create, update, delete)
- ✅ Add/remove items from collection

**Repository Layer (`wishlist.repo.ts`):**

- ✅ Database operations với Prisma
- ✅ Complex queries với includes (product, sku, brand, priceAlerts)
- ✅ Transaction handling
- ✅ Unique constraint handling (userId_productId_skuId)

**Queue/Background Jobs (`wishlist.producer.ts`, `wishlist.consumer.ts`):**

- ✅ Price check job (daily cron)
- ✅ Send price alert email job
- ✅ Job retry logic
- ✅ Error handling trong queue

**Controller Layer (`wishlist.controller.ts`):**

- ✅ 12 endpoints cần test
- ✅ Authentication/Authorization
- ✅ DTO validation
- ✅ Response formatting

#### **Test Cases Đề Xuất:**

**Unit Tests:**

```typescript
// wishlist.service.spec.ts
describe('WishlistService', () => {
  describe('addItem', () => {
    it('should add new item to wishlist')
    it('should update existing item if already wishlisted')
    it('should set price alert with current price')
    it('should invalidate cache after adding')
  })

  describe('getItems', () => {
    it('should return paginated wishlist items')
    it('should filter by collection')
    it('should sort by priority/addedAt')
    it('should include product, sku, brand details')
  })

  describe('setTargetPrice', () => {
    it('should create price alert')
    it('should update existing price alert')
    it('should validate target price > 0')
  })

  describe('moveToCart', () => {
    it('should add item to cart and remove from wishlist')
    it('should handle out of stock items')
  })
})

// wishlist.consumer.spec.ts
describe('WishlistConsumer', () => {
  describe('handlePriceCheck', () => {
    it('should check prices for all wishlist items')
    it('should detect price drops')
    it('should queue email alerts for price drops')
  })

  describe('handleSendPriceAlert', () => {
    it('should send email notification')
    it('should retry on failure')
  })
})
```

**Integration Tests:**

```typescript
// test/integration/wishlist-integration.spec.ts
describe('Wishlist Integration', () => {
  it('should complete full wishlist workflow')
  it('should handle price alert workflow')
  it('should handle collection management')
  it('should integrate with cart module')
})
```

---

### 2. 🔴 AI ASSISTANT MODULE (Ưu Tiên Cao)

#### **Tại sao cần test:**

- Module mới, tích hợp với Anthropic Claude API
- Critical cho user experience
- Có rate limiting và quota management
- Error handling phức tạp

#### **Các tính năng cần test:**

**Service Layer (`ai-assistant.service.ts`):**

- ✅ Chat với AI (streaming & non-streaming)
- ✅ System prompt configuration
- ✅ Rate limiting per user
- ✅ Error handling (quota exceeded, timeout, auth failed)
- ✅ Fallback mechanism
- ✅ Token usage tracking

**Repository Layer (`ai-assistant.repo.ts`):**

- ✅ Save conversation history
- ✅ Get conversation history
- ✅ Track AI usage statistics

**Controller Layer (`ai-assistant.controller.ts`):**

- ✅ Test endpoint
- ✅ Chat endpoint
- ✅ Streaming chat endpoint
- ✅ Get conversation history

#### **Test Cases Đề Xuất:**

**Unit Tests:**

```typescript
// ai-assistant.service.spec.ts
describe('AIAssistantService', () => {
  describe('chat', () => {
    it('should send message to Claude API')
    it('should handle API errors gracefully')
    it('should enforce rate limiting')
    it('should save conversation history')
    it('should use fallback on error if enabled')
  })

  describe('streamChat', () => {
    it('should stream responses from Claude')
    it('should handle stream errors')
  })

  describe('getConversationHistory', () => {
    it('should return paginated history')
    it('should filter by userId')
  })
})
```

**Integration Tests:**

```typescript
// test/integration/ai-assistant-integration.spec.ts
describe('AI Assistant Integration', () => {
  it('should complete chat workflow with real API (mocked)')
  it('should handle rate limiting across requests')
  it('should save and retrieve conversation history')
})
```

---

### 3. 🔴 PAYMENT MODULE (Ưu Tiên Cao)

#### **Tại sao cần test:**

- Critical business logic
- Tích hợp với Stripe
- Có webhook handling
- Background job processing
- Financial transactions

#### **Các tính năng cần test:**

**Service Layer (`payment.service.ts`):**

- ✅ Create payment intent
- ✅ Process payment
- ✅ Handle webhook events
- ✅ Refund processing
- ✅ Payment status updates

**Queue/Background Jobs (`payment.producer.ts`, `payment.consumer.ts`):**

- ✅ Payment processing job
- ✅ Webhook event processing
- ✅ Retry logic

---

### 4. 🟡 BRAND MODULE (Ưu Tiên Trung Bình)

#### **Tại sao cần test:**

- CRUD cơ bản nhưng có translation
- Được sử dụng bởi nhiều module khác (Product)

#### **Test Cases Đề Xuất:**

**Unit Tests:**

```typescript
// brand.service.spec.ts
describe('BrandService', () => {
  it('should list brands with pagination')
  it('should get brand by id with translations')
  it('should create brand')
  it('should update brand')
  it('should delete brand (soft delete)')
  it('should handle unique constraint errors')
})

// brand.controller.spec.ts
describe('BrandController', () => {
  it('should handle GET /brands')
  it('should handle GET /brands/:id')
  it('should handle POST /brands (admin only)')
  it('should handle PUT /brands/:id (admin only)')
  it('should handle DELETE /brands/:id (admin only)')
})
```

---

### 5. 🟡 CATEGORY MODULE (Ưu Tiên Trung Bình)

#### **Tại sao cần test:**

- Tree structure (parent-child relationships)
- Translation support
- Được sử dụng bởi Product module

#### **Test Cases Đề Xuất:**

**Unit Tests:**

```typescript
// category.service.spec.ts
describe('CategoryService', () => {
  it('should list categories with tree structure')
  it('should get category by id with translations')
  it('should create category with parent')
  it('should update category')
  it('should delete category and handle children')
  it('should prevent circular parent-child relationships')
})
```

---

### 6. 🟡 USER MODULE (Ưu Tiên Cao)

#### **Tại sao cần test:**

- Core business logic
- RBAC integration
- Password hashing
- Complex permission checks

#### **Test Cases Đề Xuất:**

**Unit Tests:**

```typescript
// user.service.spec.ts
describe('UserService', () => {
  it('should list users with pagination')
  it('should create user with hashed password')
  it('should prevent creating admin user by non-admin')
  it('should update user')
  it('should prevent updating own account')
  it('should delete user (soft delete)')
  it('should prevent deleting admin user by non-admin')
})
```

---

## 📋 KẾ HOẠCH TRIỂN KHAI TESTING

### **Phase 1: Critical Modules (Tuần 1-2)**

1. ✅ **Wishlist Module**
   - Unit tests: Service, Repository, Consumer
   - Integration tests: Full workflow
   - Ước tính: 80-100 test cases

2. ✅ **AI Assistant Module**
   - Unit tests: Service, Repository
   - Integration tests: API mocking
   - Ước tính: 40-50 test cases

3. ✅ **Payment Module**
   - Unit tests: Service, Webhook handling
   - Integration tests: Stripe mocking
   - Ước tính: 60-80 test cases

### **Phase 2: Core Business Logic (Tuần 3-4)**

4. ✅ **User Module**
   - Unit tests: Service, RBAC logic
   - Integration tests: User management flow
   - Ước tính: 50-60 test cases

5. ✅ **Role & Permission Modules**
   - Unit tests: Service, Cache handling
   - Integration tests: RBAC flow
   - Ước tính: 40-50 test cases

### **Phase 3: Supporting Modules (Tuần 5-6)**

6. ✅ **Brand & Category Modules**
   - Unit tests: CRUD operations
   - Integration tests: Translation flow
   - Ước tính: 60-70 test cases

7. ✅ **Media Module**
   - Unit tests: S3 upload, Presigned URLs
   - Integration tests: File upload flow
   - Ước tính: 30-40 test cases

8. ✅ **Language & Profile Modules**
   - Unit tests: Basic CRUD
   - Ước tính: 30-40 test cases

---

## 🎯 MỤC TIÊU COVERAGE

### **Target Coverage Thresholds:**

```javascript
// jest.config.ts
coverageThreshold: {
  global: {
    branches: 80,
    functions: 85,
    lines: 80,
    statements: 80,
  }
}
```

### **Priority Coverage:**

- 🔴 **Critical (95%+)**: Payment, User, Wishlist, AI Assistant
- 🟡 **High (85%+)**: Brand, Category, Role, Permission
- 🟢 **Medium (75%+)**: Language, Media, Profile

---

## 📝 TEMPLATE TEST STRUCTURE

### **Unit Test Template:**

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { ModuleService } from '../module.service'
import { ModuleRepo } from '../module.repo'

describe('ModuleService', () => {
  let service: ModuleService
  let mockRepo: jest.Mocked<ModuleRepo>

  beforeEach(async () => {
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [ModuleService, { provide: ModuleRepo, useValue: mockRepo }],
    }).compile()

    service = module.get<ModuleService>(ModuleService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      const input = {}
      const expected = {}
      mockRepo.methodName.mockResolvedValue(expected)

      // Act
      const result = await service.methodName(input)

      // Assert
      expect(result).toEqual(expected)
      expect(mockRepo.methodName).toHaveBeenCalledWith(input)
    })
  })
})
```

---

## 🚀 NEXT STEPS

### **Hành Động Tiếp Theo:**

1. **Chọn module để bắt đầu** (từ danh sách ưu tiên cao)
2. **Tạo test files** theo cấu trúc template
3. **Viết test cases** theo checklist đã phân tích
4. **Chạy tests** và đảm bảo pass
5. **Kiểm tra coverage** và cải thiện
6. **Lặp lại** cho module tiếp theo

### **Commands để chạy tests:**

```bash
# Unit tests cho một module cụ thể
pnpm test src/routes/wishlist/__tests__

# Integration tests
pnpm test:integration

# Coverage report
pnpm test:cov

# Watch mode
pnpm test:watch
```

---

## 📊 TỔNG KẾT

- **Tổng số modules:** 20
- **Đã có tests:** 8 modules (40%)
- **Chưa có tests:** 12 modules (60%)
- **Ước tính tổng test cases cần viết:** 400-500 tests
- **Thời gian ước tính:** 6-8 tuần (với 1-2 developers)

**Lợi ích khi hoàn thành:**

- ✅ Đảm bảo code quality
- ✅ Phát hiện bugs sớm
- ✅ Dễ dàng refactor
- ✅ Documentation tự động
- ✅ Confidence khi deploy

---

## 🎯 CÂU HỎI CHO DEVELOPER - CHỌN HÀNH ĐỘNG TIẾP THEO

Dựa trên phân tích chi tiết ở trên, bạn có thể chọn một trong các hành động sau:

### **Option 1: Viết Test Cho Wishlist Module (Ưu Tiên Cao)** 🔴

- Module mới nhất, có background jobs phức tạp
- Ước tính: 95-115 test cases
- Thời gian: 1-2 tuần
- **Lợi ích:** Đảm bảo tính năng wishlist hoạt động ổn định, price alerts chính xác

### **Option 2: Viết Test Cho AI Assistant Module (Ưu Tiên Cao)** 🔴

- Module mới, tích hợp với Anthropic Claude
- Ước tính: 60-80 test cases
- Thời gian: 1 tuần
- **Lợi ích:** Đảm bảo AI chatbot hoạt động đúng, rate limiting hiệu quả

### **Option 3: Viết Test Cho Payment Module (Critical)** 🔴

- Critical business logic, Stripe integration
- Ước tính: 80-100 test cases
- Thời gian: 1-2 tuần
- **Lợi ích:** Đảm bảo thanh toán an toàn, webhook handling chính xác

### **Option 4: Viết Test Cho User Module (Core Business)** 🔴

- Core business logic, RBAC system
- Ước tính: 70-90 test cases
- Thời gian: 1-2 tuần
- **Lợi ích:** Đảm bảo user management và phân quyền chính xác

### **Option 5: Viết Test Cho Brand & Category Modules (Supporting)** 🟡

- CRUD cơ bản, translation support
- Ước tính: 95-135 test cases (cả 2 modules)
- Thời gian: 1-2 tuần
- **Lợi ích:** Đảm bảo catalog management ổn định

### **Option 6: Viết Test Cho Role & Permission Modules (RBAC)** 🟡

- RBAC system, cache handling
- Ước tính: 90-130 test cases (cả 2 modules)
- Thời gian: 1-2 tuần
- **Lợi ích:** Đảm bảo hệ thống phân quyền chính xác

### **Option 7: Viết Test Cho Media, Language, Profile Modules (Basic)** 🟢

- CRUD đơn giản, S3 upload
- Ước tính: 80-140 test cases (cả 3 modules)
- Thời gian: 1-2 tuần
- **Lợi ích:** Hoàn thiện coverage cho các module cơ bản

### **Option 8: Viết Test Cho TẤT CẢ Modules (Comprehensive)** 🌟

- Tất cả 12 modules chưa có test
- Ước tính: 570-790 test cases
- Thời gian: 6-8 tuần
- **Lợi ích:** Đạt coverage > 85% cho toàn bộ dự án

### **Option 9: Chỉ Viết Integration Tests (Quick Win)** ⚡

- Tập trung vào integration tests cho các module critical
- Ước tính: 100-150 test cases
- Thời gian: 2-3 tuần
- **Lợi ích:** Nhanh chóng có test coverage cho các workflow quan trọng

### **Option 10: Custom - Chọn Modules Cụ Thể** 🎨

- Bạn chọn các modules cụ thể muốn viết test
- Thời gian và số lượng test tùy thuộc vào lựa chọn

---

## 📝 HƯỚNG DẪN SỬ DỤNG

**Sau khi chọn option, tôi sẽ:**

1. ✅ Tạo chi tiết test files với đầy đủ test cases
2. ✅ Cung cấp mock data và test helpers
3. ✅ Viết integration tests nếu cần
4. ✅ Hướng dẫn chạy tests và kiểm tra coverage
5. ✅ Tạo documentation cho test suite

**Vui lòng cho tôi biết bạn muốn chọn option nào (1-10) để tôi bắt đầu viết test chi tiết!**

---

## 📚 TÀI LIỆU THAM KHẢO

- [SCRIPT_VIET_TEST_CHO_MODULE.md](./SCRIPT_VIET_TEST_CHO_MODULE.md) - Script chi tiết để viết test
- [QUAN_TRONG_CHIEN_LUOC_TESTING.md](./QUAN_TRONG_CHIEN_LUOC_TESTING.md) - Chiến lược testing tổng thể
- [QUAN_TRONG_QUICK_START_TESTING.md](./QUAN_TRONG_QUICK_START_TESTING.md) - Hướng dẫn nhanh chạy tests
- [TESTING.md](./TESTING.md) - Testing documentation chính thức
