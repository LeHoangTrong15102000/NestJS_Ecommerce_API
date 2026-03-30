# 🏗️ SOLID Principles Trong Lập Trình Module — NestJS Deep Dive

> **Mục đích**: Giải thích chi tiết 5 nguyên tắc SOLID được áp dụng **ở cấp độ Module** trong NestJS — khác biệt hoàn toàn so với SOLID truyền thống trong OOP (class-level). Lấy ví dụ trực tiếp từ dự án NestJS Ecommerce API.
>
> **Dự án**: NestJS Ecommerce API | **Ngày tạo**: 2026-03-29
>
> **Tham khảo chéo**: `ZZ_84_1_TONG_HOP_ARCHITECTURE_DOCKER_CLOUD_DEEP_DIVE.md` (SOLID ở class-level)

---

## 📋 MỤC LỤC

1. [Tại Sao SOLID Không Chỉ Dành Cho OOP?](#1-tại-sao-solid-không-chỉ-dành-cho-oop)
2. [SOLID Ở Class-Level vs Module-Level — Bảng So Sánh](#2-solid-ở-class-level-vs-module-level--bảng-so-sánh)
3. [S — Single Responsibility Principle (SRP) Ở Cấp Module](#3-s--single-responsibility-principle-srp-ở-cấp-module)
4. [O — Open/Closed Principle (OCP) Ở Cấp Module](#4-o--openclosed-principle-ocp-ở-cấp-module)
5. [L — Liskov Substitution Principle (LSP) Ở Cấp Module](#5-l--liskov-substitution-principle-lsp-ở-cấp-module)
6. [I — Interface Segregation Principle (ISP) Ở Cấp Module](#6-i--interface-segregation-principle-isp-ở-cấp-module)
7. [D — Dependency Inversion Principle (DIP) Ở Cấp Module](#7-d--dependency-inversion-principle-dip-ở-cấp-module)
8. [Bản Đồ Module — Dự Án NestJS Ecommerce API](#8-bản-đồ-module--dự-án-nestjs-ecommerce-api)
9. [SOLID Module Cheat Sheet](#9-solid-module-cheat-sheet)
10. [Anti-Patterns Thường Gặp Ở Module-Level](#10-anti-patterns-thường-gặp-ở-module-level)
11. [Kết Luận](#11-kết-luận)

---

## 1. Tại Sao SOLID Không Chỉ Dành Cho OOP?

SOLID được Robert C. Martin (Uncle Bob) đề xuất ban đầu cho **Object-Oriented Design**. Nhưng bản chất SOLID là về **quản lý sự phụ thuộc** (dependency management) và **phân tách trách nhiệm** (separation of concerns) — hai vấn đề tồn tại ở **mọi cấp độ** trong kiến trúc phần mềm:

```
┌─────────────────────────────────────────────────────┐
│                  CẤP ĐỘ ÁP DỤNG                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Function level    →  mỗi hàm 1 việc (SRP)        │
│         ↓                                           │
│   Class level       →  SOLID truyền thống (OOP)     │
│         ↓                                           │
│   Module level      →  ★ BÀI NÀY ★                 │
│         ↓                                           │
│   Service level     →  Microservices boundaries     │
│         ↓                                           │
│   System level      →  Distributed architecture     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Trong NestJS, **Module** (`@Module()`) là đơn vị tổ chức cốt lõi. Mỗi module quyết định:

- **Providers** nào nó tạo ra (services, repos, guards…)
- **Exports** nào nó chia sẻ ra ngoài
- **Imports** nào nó phụ thuộc vào
- **Controllers** nào nó đăng ký

Đây chính là **ranh giới kiến trúc** (architectural boundary). Và SOLID hoạt động ở ranh giới này **mạnh mẽ hơn** so với class-level, vì sai lầm ở module-level ảnh hưởng cả hệ thống chứ không chỉ 1 class.

### OOP vs Module — Sự Khác Biệt Cốt Lõi

| Khía cạnh   | OOP (Class)                               | Module                                       |
| ----------- | ----------------------------------------- | -------------------------------------------- |
| Đơn vị      | Class, Interface                          | `@Module()` decorator                        |
| Kế thừa     | `extends`, `implements`                   | `imports` (module dependency)                |
| Đóng gói    | `private`, `protected`, `public`          | `providers` (private) vs `exports` (public)  |
| Đa hình     | Method override, interface implementation | Module swap (thay thế module implementation) |
| Composition | Dependency Injection trong class          | Module `imports` + `exports` chain           |

---

## 2. SOLID Ở Class-Level vs Module-Level — Bảng So Sánh

| Nguyên tắc  | Class-Level (OOP truyền thống)                      | Module-Level (NestJS)                                                                            |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **S** — SRP | Mỗi **class** có 1 lý do thay đổi                   | Mỗi **module** đại diện cho 1 domain/feature                                                     |
| **O** — OCP | **Class** mở rộng qua inheritance/composition       | **Module** mở rộng bằng cách thêm module mới, không sửa module cũ                                |
| **L** — LSP | **Subclass** thay thế parent class                  | **Module** có thể swap mà không phá vỡ module consumer                                           |
| **I** — ISP | **Interface** nhỏ, chuyên biệt                      | Module chỉ **export** những gì consumer thực sự cần                                              |
| **D** — DIP | Class phụ thuộc vào **abstraction**, không concrete | Module phụ thuộc vào **module interface** (exports), không phụ thuộc vào internal implementation |

---

## 3. S — Single Responsibility Principle (SRP) Ở Cấp Module

### Định nghĩa Module-Level

> **Mỗi module chỉ nên đại diện cho MỘT domain/feature nghiệp vụ, và chỉ có MỘT lý do để thay đổi.**

Ở class-level, SRP nói: "mỗi class có 1 trách nhiệm". Ở module-level, SRP nói: **mỗi module sở hữu 1 bounded context** — tất cả logic, data access, và API endpoints liên quan đến 1 feature nằm trong 1 module.

### Ví dụ Tuân Thủ SRP — Dự Án Hiện Tại

```
src/routes/
├── auth/          ← AuthModule: CHỈ lo authentication (register, login, OTP, 2FA)
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.repo.ts
│   └── google.service.ts
│
├── product/       ← ProductModule: CHỈ lo product CRUD
│   ├── product.module.ts
│   ├── product.controller.ts
│   ├── product.service.ts
│   ├── product.repo.ts
│   ├── manage-product.controller.ts    ← Tách thêm admin controller riêng
│   └── manage-product.service.ts       ← Tách thêm admin service riêng
│
├── cart/           ← CartModule: CHỈ lo giỏ hàng
│   ├── cart.module.ts
│   ├── cart.controller.ts
│   ├── cart.service.ts
│   └── cart.repo.ts
│
├── order/          ← OrderModule: CHỈ lo đặt hàng
│   ├── order.module.ts
│   ├── order.controller.ts
│   ├── order.service.ts
│   ├── order.repo.ts
│   └── order.producer.ts              ← Background job producer
│
└── payment/        ← PaymentModule: CHỈ lo thanh toán
    ├── payment.module.ts
    ├── payment.controller.ts
    ├── payment.service.ts
    ├── payment.repo.ts
    └── payment.producer.ts
```

Mỗi module trên tuân thủ SRP ở module-level:

```typescript
// ✅ TUÂN THỦ SRP — CartModule CHỈ lo cart
@Module({
  providers: [CartService, CartRepo],
  controllers: [CartController],
})
export class CartModule {}

// ✅ TUÂN THỦ SRP — AuthModule CHỈ lo authentication
@Module({
  providers: [AuthService, AuthRepository, GoogleService],
  controllers: [AuthController],
})
export class AuthModule {}
```

**Tại sao đây là SRP module-level?**

- `CartModule` chỉ thay đổi khi logic giỏ hàng thay đổi
- `AuthModule` chỉ thay đổi khi logic đăng nhập/đăng ký thay đổi
- Thêm tính năng wishlist? → Tạo `WishlistModule` mới, **không sửa** CartModule hay ProductModule

### Vi Phạm SRP — God Module

```typescript
// ❌ VI PHẠM SRP — "God Module" làm quá nhiều việc
@Module({
  providers: [
    // Authentication
    AuthService,
    AuthRepository,
    GoogleService,
    // Products
    ProductService,
    ProductRepo,
    // Cart
    CartService,
    CartRepo,
    // Orders
    OrderService,
    OrderRepo,
    // Payments
    PaymentService,
    PaymentRepo,
    // Reviews
    ReviewService,
    ReviewRepo,
    // ... 20 services khác
  ],
  controllers: [
    AuthController,
    ProductController,
    CartController,
    OrderController,
    PaymentController,
    ReviewController,
    // ... 10 controllers khác
  ],
})
export class EverythingModule {}
// → Module này có 10+ lý do để thay đổi
// → Sửa 1 tính năng → phải test lại toàn bộ module
// → 2 developers cùng sửa 2 features khác nhau → merge conflict
```

### SRP Đặc Biệt: SharedModule — Module Hạ Tầng

`SharedModule` trong dự án hiện tại trông như vi phạm SRP (nhiều services), nhưng thực ra **tuân thủ SRP ở mức khái niệm khác**:

```typescript
// ✅ SRP: SharedModule có 1 trách nhiệm = "cung cấp hạ tầng chung"
@Global()
@Module({
  providers: [
    PrismaService, // Database access
    HashingService, // Password hashing
    TokenService, // JWT management
    EmailService, // Email sending
    S3Service, // File storage
    TwoFactorService, // 2FA
    SharedUserRepository, // Cross-module user queries
    SharedRoleRepository, // Cross-module role queries
    // ...guards
  ],
  exports: [
    /* tất cả shared services */
  ],
})
export class SharedModule {}
```

**Trách nhiệm duy nhất**: Cung cấp **shared infrastructure** cho toàn bộ hệ thống. Nó chỉ thay đổi khi **hạ tầng chung** thay đổi (đổi database, đổi email provider, đổi storage). Nó KHÔNG thay đổi khi business logic của auth, product, hay order thay đổi.

### Quy Tắc Phân Biệt

```
Module có đang SRP không?

Hỏi: "Module này thay đổi khi nào?"

✅ SRP: "Khi logic giỏ hàng thay đổi" (CartModule — 1 lý do)
✅ SRP: "Khi hạ tầng shared thay đổi" (SharedModule — 1 lý do ở infrastructure layer)
❌ Vi phạm: "Khi auth thay đổi, HOẶC khi product thay đổi, HOẶC khi cart thay đổi"
    → Module có nhiều lý do thay đổi → tách ra
```

---

## 4. O — Open/Closed Principle (OCP) Ở Cấp Module

### Định nghĩa Module-Level

> **Hệ thống module nên MỞ cho việc thêm module mới, nhưng ĐÓNG cho việc sửa module hiện tại.**

Ở class-level, OCP dùng inheritance/strategy pattern. Ở module-level, OCP nghĩa là: **thêm feature mới = thêm module mới + đăng ký vào AppModule, KHÔNG sửa code bên trong module cũ.**

### Ví dụ Tuân Thủ OCP — Dự Án Hiện Tại

Khi dự án cần thêm tính năng mới (Wishlist, AI Assistant, Voucher), cách làm là:

```typescript
// AppModule — CHỈ CẦN THÊM IMPORT, không sửa code cũ
@Module({
  imports: [
    // ─── Modules hiện tại (KHÔNG THAY ĐỔI) ───
    SharedModule,
    AuthModule,
    ProductModule,
    CartModule,
    OrderModule,
    PaymentModule,

    // ─── Modules MỚI (CHỈ CẦN THÊM VÀO ĐÂY) ───
    VoucherModule, // ✅ Thêm voucher — không sửa OrderModule
    WishlistModule, // ✅ Thêm wishlist — không sửa ProductModule
    AIAssistantModule, // ✅ Thêm AI — không sửa module nào khác
    ReviewModule, // ✅ Thêm reviews — không sửa ProductModule
  ],
})
export class AppModule {}
```

**Chuỗi sự kiện thực tế trong dự án:**

```
Timeline thêm features:
───────────────────────────────────────────────────────

Phase 1: Auth, Product, Cart, Order, Payment
         → Xong. Không ai đụng lại.

Phase 2: + ReviewModule
         → Tạo module mới. CartModule, ProductModule: KHÔNG SỬA.

Phase 3: + VoucherModule
         → Tạo module mới. OrderModule import VoucherModule
           (thêm dependency, không sửa logic cũ trong OrderModule).

Phase 4: + WishlistModule
         → Tạo module mới. ProductModule: KHÔNG SỬA.

Phase 5: + AIAssistantModule
         → Tạo module mới. Không module cũ nào bị sửa.

═══════════════════════════════════════════════════════
OCP: Mỗi phase CHỈ THÊM module mới, KHÔNG SỬA module cũ.
```

### OCP Trong Guard System — Strategy Pattern Ở Module-Level

`AuthenticationGuard` trong dự án là ví dụ hoàn hảo:

```typescript
// authentication.guard.ts — KHÔNG BAO GIỜ SỬA khi thêm auth strategy mới
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authTypeGuardMap: Record<string, CanActivate>

  constructor(
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly paymentAPIKeyGuard: PaymentAPIKeyGuard,
  ) {
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
      [AuthType.None]: { canActivate: () => true },
    }
  }
}
```

Muốn thêm auth strategy mới (ví dụ: OAuth2, API Key v2)?

```typescript
// ✅ OCP: Chỉ cần tạo guard mới + đăng ký vào map
// KHÔNG SỬA logic canActivate, handleOrCondition, handleAndCondition

// Bước 1: Tạo guard mới
@Injectable()
export class OAuth2Guard implements CanActivate {
  /* ... */
}

// Bước 2: Thêm vào enum
enum AuthType {
  Bearer,
  PaymentAPIKey,
  None,
  OAuth2,
} // ← thêm OAuth2

// Bước 3: Đăng ký vào map
this.authTypeGuardMap = {
  [AuthType.Bearer]: this.accessTokenGuard,
  [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
  [AuthType.OAuth2]: this.oauth2Guard, // ← chỉ thêm dòng này
  [AuthType.None]: { canActivate: () => true },
}
```

### Vi Phạm OCP

```typescript
// ❌ VI PHẠM OCP — Sửa module cũ mỗi khi thêm feature
@Module({
  providers: [
    ProductService,
    ProductRepo,
    // Mỗi lần thêm feature mới, phải nhét vào đây
    WishlistService, // ← Sửa ProductModule để thêm wishlist
    ReviewService, // ← Sửa ProductModule để thêm review
    ComparisonService, // ← Sửa ProductModule để thêm comparison
  ],
})
export class ProductModule {}
// → Mỗi feature mới = sửa ProductModule = risk regression = vi phạm OCP
```

---

## 5. L — Liskov Substitution Principle (LSP) Ở Cấp Module

### Định nghĩa Module-Level

> **Một module có thể được thay thế bằng module khác (cùng interface/exports) mà không phá vỡ các module phụ thuộc vào nó.**

Ở class-level, LSP nói: "subclass thay thế parent class không hỏng". Ở module-level, LSP nói: **nếu ModuleA exports ServiceX, thì ModuleB cũng export ServiceX (hoặc compatible interface), ta có thể swap ModuleA → ModuleB mà consumer không biết.**

### Ví dụ: Swap Module Trong Thực Tế

Giả sử dự án muốn chuyển từ `EmailService` (gửi email qua SMTP) sang `SendGridEmailService` (dùng SendGrid API):

```typescript
// ✅ LSP Module-Level: Swap implementation mà consumer không biết

// === TRƯỚC: SharedModule dùng SMTP ===
@Global()
@Module({
  providers: [{ provide: EmailService, useClass: SmtpEmailService }],
  exports: [EmailService],
})
export class SharedModule {}

// === SAU: SharedModule dùng SendGrid ===
@Global()
@Module({
  providers: [{ provide: EmailService, useClass: SendGridEmailService }],
  exports: [EmailService],
})
export class SharedModule {}

// AuthModule — KHÔNG CẦN SỬA, vẫn inject EmailService
@Injectable()
export class AuthService {
  constructor(private readonly emailService: EmailService) {}
  // emailService.send() vẫn hoạt động dù backend là SMTP hay SendGrid
}
```

**Tại sao đây là LSP?** Vì `SendGridEmailService` thay thế `SmtpEmailService`:

- Cùng public interface (`send()`, `sendBulk()`, v.v.)
- Cùng input/output contract (nhận `to, subject, body` → trả `Promise<void>`)
- Consumer (`AuthService`) **không biết** và **không cần biết** backend thay đổi

### LSP Trong Dự Án: Database Layer

```typescript
// Hiện tại: PrismaService (Prisma ORM)
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedModule {}

// Tương lai: Nếu chuyển sang TypeORM hoặc Drizzle
// → Tạo adapter class cùng interface → swap trong SharedModule
// → Tất cả modules consumer (Auth, Product, Cart...) KHÔNG CẦN SỬA
```

### Vi Phạm LSP

```typescript
// ❌ VI PHẠM LSP — Module mới thay đổi behavior contract

// Module cũ: VoucherModule exports VoucherService.apply() → trả VoucherResult
// Module mới: VoucherModuleV2 exports VoucherService.apply() → throw exception khi discount = 0%

// Consumer (OrderModule) gọi voucherService.apply() và expect nó return result
// VoucherModuleV2 throw exception → OrderModule bị hỏng
// → Vi phạm LSP vì module mới phá vỡ contract của module cũ
```

### Quy Tắc LSP Module-Level

```
Module B có thể thay thế Module A không?

Checklist:
☐ Exports cùng token/interface (hoặc superset)
☐ Mỗi exported service có cùng method signatures
☐ Cùng behavior contract (cùng input → cùng output type)
☐ Không throw exception mới mà consumer không expect
☐ Không bỏ export mà consumer đang dùng
```

---

## 6. I — Interface Segregation Principle (ISP) Ở Cấp Module

### Định nghĩa Module-Level

> **Module chỉ nên EXPORT những gì consumer thực sự cần. Không ép consumer phụ thuộc vào services mà nó không dùng.**

Ở class-level, ISP nói: "chia interface lớn thành interfaces nhỏ". Ở module-level, ISP nói: **kiểm soát `exports` array — chỉ export đúng cái consumer cần, không export tất cả.**

### Ví dụ Tuân Thủ ISP — Dự Án Hiện Tại

```typescript
// ✅ ISP: VoucherModule chỉ export đúng cái OrderModule cần
@Module({
  controllers: [VoucherController],
  providers: [VoucherService, VoucherRepository],
  exports: [VoucherService, VoucherRepository], // ← Chỉ export service + repo
  // KHÔNG export VoucherController (consumer không cần controller của module khác)
})
export class VoucherModule {}

// OrderModule import VoucherModule, chỉ dùng VoucherService
@Module({
  imports: [VoucherModule], // ← Chỉ thấy VoucherService + VoucherRepository
  providers: [OrderService, OrderRepo, OrderProducer],
  controllers: [OrderController],
})
export class OrderModule {}
```

### ISP Đặc Biệt: ConversationModule Selective Export

```typescript
// ✅ ISP: ConversationModule export services mà ChatModule cần
@Module({
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRepository, MessageService, MessageRepository],
  exports: [ConversationService, ConversationRepository, MessageService, MessageRepository],
  // ChatModule cần tất cả 4 providers này → export hết
  // Nhưng KHÔNG export ConversationController → ChatModule không cần
})
export class ConversationModule {}
```

### Vi Phạm ISP — "Fat Export"

```typescript
// ❌ VI PHẠM ISP — Export mọi thứ, kể cả consumer không cần
@Module({
  providers: [
    ProductService,
    ProductRepo,
    ProductSearchService,
    ProductAnalyticsService,
    ProductImportService,
    ProductExportService,
    ProductImageProcessor,
    ProductRecommendationEngine,
  ],
  exports: [
    // Export TẤT CẢ — consumer phải "nhìn thấy" cả 8 services
    ProductService,
    ProductRepo,
    ProductSearchService,
    ProductAnalyticsService,
    ProductImportService,
    ProductExportService,
    ProductImageProcessor,
    ProductRecommendationEngine,
  ],
})
export class ProductModule {}

// CartModule chỉ cần ProductService để check product existence
// Nhưng bị ÉP phụ thuộc vào toàn bộ 8 services
// → Fat dependency → slower startup → harder testing → ISP violation
```

```typescript
// ✅ TUÂN THỦ ISP — Tách thành sub-modules
@Module({
  providers: [ProductService, ProductRepo],
  exports: [ProductService], // ← Chỉ export cái cần thiết
})
export class ProductCoreModule {}

@Module({
  providers: [ProductSearchService],
  exports: [ProductSearchService],
})
export class ProductSearchModule {}

@Module({
  providers: [ProductAnalyticsService],
  exports: [ProductAnalyticsService],
})
export class ProductAnalyticsModule {}

// CartModule CHỈ import ProductCoreModule
// SearchModule CHỈ import ProductSearchModule
// AdminDashboardModule CHỈ import ProductAnalyticsModule
```

### ISP vs SRP — Khác Nhau Như Thế Nào?

```
SRP: Module có BAO NHIÊU trách nhiệm? → Nên có 1
ISP: Module LỘRA bao nhiêu? → Chỉ lộ cái consumer cần

SRP hướng vào BÊN TRONG module (internal cohesion)
ISP hướng vào RANH GIỚI module (external surface area)

Ví dụ:
- Module có 1 trách nhiệm (SRP ✅) nhưng export 20 services (ISP ❌)
- Module export ít (ISP ✅) nhưng bên trong làm 5 việc khác domain (SRP ❌)
```

---

## 7. D — Dependency Inversion Principle (DIP) Ở Cấp Module

### Định nghĩa Module-Level

> **Module cấp cao (business logic) không nên phụ thuộc trực tiếp vào module cấp thấp (infrastructure). Cả hai nên phụ thuộc vào abstractions (interface/token).**

Ở class-level, DIP nói: "inject interface, không inject concrete class". Ở module-level, DIP nói: **business module import shared module qua abstraction layer, không hardcode infrastructure.**

### Tầng Module Trong Dự Án

```
┌─────────────────────────────────────────────────────┐
│                HIGH-LEVEL MODULES                   │
│              (Business Logic Layer)                 │
│                                                     │
│  AuthModule   ProductModule   CartModule            │
│  OrderModule  PaymentModule   WishlistModule        │
│                                                     │
│  → Chứa business rules, không biết DB là gì,       │
│    email gửi bằng gì, file lưu ở đâu               │
├──────────────────── ↕ DIP ──────────────────────────┤
│                                                     │
│                ABSTRACTION LAYER                    │
│           (Shared Services Interface)               │
│                                                     │
│  PrismaService    →  "database access"              │
│  EmailService     →  "email sending"                │
│  S3Service        →  "file storage"                 │
│  HashingService   →  "password hashing"             │
│  TokenService     →  "JWT management"               │
│                                                     │
├──────────────────── ↕ DIP ──────────────────────────┤
│                                                     │
│                LOW-LEVEL MODULES                    │
│            (Infrastructure Layer)                   │
│                                                     │
│  Prisma ORM → PostgreSQL                            │
│  Nodemailer → SMTP Server                           │
│  AWS SDK    → S3 Bucket                             │
│  bcrypt     → OS crypto                             │
│  jsonwebtoken → JWT spec                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### DIP Trong Dự Án — SharedModule Là Abstraction Layer

```typescript
// ✅ DIP: SharedModule đóng vai trò abstraction layer
@Global()
@Module({
  providers: [
    PrismaService, // Abstraction cho database
    HashingService, // Abstraction cho hashing
    TokenService, // Abstraction cho JWT
    EmailService, // Abstraction cho email
    S3Service, // Abstraction cho file storage
  ],
  exports: [
    /* tất cả */
  ],
})
export class SharedModule {}

// Business module (AuthModule) phụ thuộc vào ABSTRACTION (SharedModule exports)
// KHÔNG phụ thuộc vào INFRASTRUCTURE (Prisma, bcrypt, jsonwebtoken...)
@Module({
  // Không import PrismaModule, BcryptModule, JwtLibraryModule...
  // Chỉ dùng services từ SharedModule (auto-injected vì @Global)
  providers: [AuthService, AuthRepository, GoogleService],
  controllers: [AuthController],
})
export class AuthModule {}
```

**Dòng chảy phụ thuộc:**

```
AuthModule
    │
    │ inject (DIP — qua DI token, không qua concrete)
    ▼
HashingService (abstraction)        ← AuthModule chỉ biết đến đây
    │
    │ internally uses (implementation detail)
    ▼
bcrypt (concrete library)           ← AuthModule KHÔNG biết bcrypt tồn tại
```

### Vi Phạm DIP

```typescript
// ❌ VI PHẠM DIP — Business module phụ thuộc trực tiếp vào infrastructure
import * as bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class AuthService {
  private prisma = new PrismaClient() // ← Hardcode Prisma

  async register(dto: RegisterDto) {
    const hash = await bcrypt.hash(dto.password, 10) // ← Hardcode bcrypt
    return this.prisma.user.create({ data: { ...dto, password: hash } })
  }
}
// → Đổi database? Sửa AuthService.
// → Đổi hashing algorithm? Sửa AuthService.
// → AuthService (business) bị buộc vào infrastructure
```

```typescript
// ✅ TUÂN THỦ DIP — Business module phụ thuộc vào abstraction
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService, // ← Abstraction
    private readonly authRepo: AuthRepository, // ← Abstraction
  ) {}

  async register(dto: RegisterDto) {
    const hash = await this.hashingService.hash(dto.password)
    return this.authRepo.createUser({ ...dto, password: hash })
  }
}
// → Đổi database? Sửa HashingService implementation, AuthService KHÔNG SỬA.
// → Đổi hashing? Sửa HashingService implementation, AuthService KHÔNG SỬA.
```

### NestJS DI Container — DIP Engine

NestJS DI Container chính là **cỗ máy thực thi DIP** ở module-level:

```
1. Module KHAI BÁO provider   →  { provide: TOKEN, useClass: ConcreteClass }
2. Consumer INJECT bằng TOKEN →  constructor(private service: TOKEN)
3. DI Container TỰ ĐỘNG nối   →  TOKEN ──▶ ConcreteClass instance

Consumer không biết ConcreteClass là gì.
Muốn swap? Đổi useClass, consumer không sửa gì.
```

---

## 8. Bản Đồ Module — Dự Án NestJS Ecommerce API

```
                              ┌──────────────┐
                              │  AppModule   │ (Root Orchestrator)
                              └──────┬───────┘
                                     │ imports
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
    ┌────▼────┐               ┌──────▼──────┐            ┌──────▼──────┐
    │ Shared  │ @Global       │   Feature   │            │Infrastructure│
    │ Module  │               │   Modules   │            │   Modules   │
    └────┬────┘               └──────┬──────┘            └──────┬──────┘
         │                           │                           │
    ┌────┴────────────┐    ┌─────────┼─────────┐         ┌──────┴──────┐
    │ PrismaService   │    │         │         │         │ BullModule  │
    │ HashingService  │    │    ┌────┴────┐    │         │ CacheModule │
    │ TokenService    │    │    │         │    │         │ ThrottlerMod│
    │ EmailService    │    │    ▼         ▼    │         │ I18nModule  │
    │ S3Service       │    │ AuthMod  CartMod  │         │ LoggerModule│
    │ TwoFactorSvc    │    │ ProductM OrderMod │         │ ScheduleMod │
    │ SharedUserRepo  │    │ PaymentM ReviewM  │         └─────────────┘
    │ SharedRoleRepo  │    │ VoucherM WishlistM│
    │ SharedPaymentR  │    │ ProfileM UserMod  │
    │ SharedWebsockR  │    │ MediaMod BrandMod │
    └─────────────────┘    │ CategoryM LangMod │
                           │ AddressM PermMod  │
         ┌─────────────┐   │ ConversationMod   │
         │  Websocket   │   │ AIAssistantMod    │
         │   Module     │   └───────────────────┘
         │  ├ ChatModule│
         │  ├ ChatGW    │
         │  ├ PaymentGW │
         │  └ EnhChatGW │
         └─────────────┘

SOLID ở Module-Level:
━━━━━━━━━━━━━━━━━━━
S: Mỗi feature module = 1 bounded context
O: Thêm module mới, không sửa module cũ
L: SharedModule có thể swap implementation (PrismaService → TypeORMService)
I: Mỗi module chỉ export cái consumer cần (VoucherModule exports 2, không phải 10)
D: Feature modules → SharedModule (abstraction) → Infrastructure (concrete)
```

---

## 9. SOLID Module Cheat Sheet

| Nguyên tắc  | Câu hỏi kiểm tra                             | ✅ Đúng                                             | ❌ Sai                                              |
| ----------- | -------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| **S** — SRP | "Module này thay đổi khi nào?"               | "Khi logic cart thay đổi" (1 lý do)                 | "Khi cart, product, HOẶC order thay đổi" (3 lý do)  |
| **O** — OCP | "Thêm feature mới, sửa module cũ không?"     | Tạo module mới, import vào AppModule                | Nhét service mới vào module cũ                      |
| **L** — LSP | "Swap module có hỏng consumer không?"        | Swap SmtpEmail → SendGridEmail: consumer không biết | Swap VoucherModule → VoucherV2Module: throw lỗi mới |
| **I** — ISP | "Module export thừa không?"                  | Export 2 services mà consumer thật sự dùng          | Export 10 services, consumer chỉ dùng 1             |
| **D** — DIP | "Business module biết infrastructure không?" | AuthService inject HashingService (abstraction)     | AuthService import bcrypt trực tiếp (concrete)      |

---

## 10. Anti-Patterns Thường Gặp Ở Module-Level

### 10.1. God Module (Vi phạm SRP)

```
Triệu chứng: 1 module có 20+ providers, 10+ controllers
Nguyên nhân: Lười tách module, "thêm vào đây cho nhanh"
Hậu quả: Merge conflict, test chậm, khó hiểu module làm gì
Fix: Tách theo domain boundary
```

### 10.2. Circular Dependency (Vi phạm DIP)

```
Triệu chứng: ModuleA imports ModuleB, ModuleB imports ModuleA
Nguyên nhân: 2 modules phụ thuộc lẫn nhau → thiếu abstraction layer
Hậu quả: Runtime error, NestJS throw "Circular dependency detected"
Fix: Trích shared logic vào SharedModule hoặc dùng forwardRef()
```

### 10.3. Leaky Module (Vi phạm ISP)

```
Triệu chứng: Module export mọi thứ bên trong
Nguyên nhân: "Export hết cho chắc"
Hậu quả: Consumer phụ thuộc vào internal implementation
          → Refactor internal = break consumer
Fix: Chỉ export public API (services consumer thật sự inject)
```

### 10.4. Hardwired Module (Vi phạm OCP + DIP)

```
Triệu chứng: Module import concrete library trực tiếp trong service
Nguyên nhân: Không tạo abstraction layer
Hậu quả: Đổi library = sửa tất cả modules
Fix: Wrap library trong service, export service
```

### 10.5. Copy-Paste Module (Vi phạm LSP)

```
Triệu chứng: 2 modules gần giống nhau, copy code giữa chúng
Nguyên nhân: Không nhận ra chúng cùng implement 1 contract
Hậu quả: Fix bug 1 chỗ, quên chỗ còn lại
Fix: Abstract thành base module/service, hoặc dùng module composition
```

---

## 11. Kết Luận

### SOLID Trong OOP vs SOLID Trong Module — Tóm Tắt

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  OOP (Class-level):                                                 │
│  "Thiết kế CLASS tốt để code dễ maintain"                           │
│  → Mỗi class 1 việc, kế thừa đúng cách, interface nhỏ,              │
│    inject abstraction                                               │
│                                                                     │
│  Module-level:                                                      │
│  "Thiết kế MODULE tốt để KIẾN TRÚC dễ maintain"                     │
│  → Mỗi module 1 domain, thêm module không sửa module cũ,            │
│    swap module không hỏng consumer, export tối thiểu,               │
│    business không biết infrastructure                               │
│                                                                     │
│  Cùng 5 nguyên tắc, khác CẤP ĐỘ ÁP DỤNG.                            │
│  Class-level sai → 1 file khó maintain.                             │
│  Module-level sai → CẢ HỆ THỐNG khó maintain.                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Trong Dự Án NestJS Ecommerce API

| Nguyên tắc | Áp dụng thực tế                                                                               |
| ---------- | --------------------------------------------------------------------------------------------- |
| **SRP**    | 19 feature modules, mỗi module 1 domain. SharedModule riêng cho infrastructure.               |
| **OCP**    | Thêm feature (Wishlist, AI, Voucher) = thêm module mới, modules cũ không sửa.                 |
| **LSP**    | SharedModule có thể swap PrismaService, EmailService mà business modules không biết.          |
| **ISP**    | VoucherModule exports 2 (Service + Repo). CartModule exports 2. Không "export hết".           |
| **DIP**    | Business modules inject shared services (abstraction). Không import bcrypt, prisma trực tiếp. |

---

> **Tài liệu tham khảo chéo:**
>
> - SOLID ở class-level: `ZZ_84_1` — Mục 1 (SOLID Principles Chuyên Sâu)
> - Clean Architecture: `ZZ_11_CLEAN_ARCHITECTURE_TRONG_NESTJS.md`
> - Design Patterns: `ZZ_87_DESIGN_PATTERNS_ANALYSIS.md`
> - CQRS & Event-Driven: `cqrs-payment-architecture.md`
