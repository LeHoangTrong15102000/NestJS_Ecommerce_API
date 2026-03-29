# 🏗️ Design Patterns Sinh Ra Để Phục Vụ SOLID — Phân Tích Chuyên Sâu Trong NestJS

> **Mục đích**: Phân tích mối quan hệ **nhân quả** giữa Design Patterns và SOLID Principles — chứng minh rằng mỗi Design Pattern tồn tại để giải quyết MỘT hoặc NHIỀU nguyên tắc SOLID. Lấy evidence trực tiếp từ dự án NestJS Ecommerce API.
>
> **Dự án**: NestJS Ecommerce API | **Ngày tạo**: 2026-03-29
>
> **Tham khảo chéo**:
> - `ZZ_84_1` — SOLID ở class-level
> - `ZZ_84_2` — SOLID ở module-level
> - `ZZ_87` — Design Patterns Analysis

---

## 📋 MỤC LỤC

1. [Câu Hỏi Gốc: Design Patterns Sinh Ra Để Làm Gì?](#1-câu-hỏi-gốc-design-patterns-sinh-ra-để-làm-gì)
2. [Ma Trận: Pattern × SOLID — Ai Phục Vụ Ai?](#2-ma-trận-pattern--solid--ai-phục-vụ-ai)
3. [Strategy Pattern → OCP + DIP + LSP](#3-strategy-pattern--ocp--dip--lsp)
4. [Repository Pattern → SRP + DIP](#4-repository-pattern--srp--dip)
5. [Decorator Pattern (NestJS Decorators) → OCP + SRP](#5-decorator-pattern-nestjs-decorators--ocp--srp)
6. [Chain of Responsibility → SRP + OCP + ISP](#6-chain-of-responsibility--srp--ocp--isp)
7. [Factory Pattern → DIP + OCP](#7-factory-pattern--dip--ocp)
8. [Observer Pattern → OCP + SRP](#8-observer-pattern--ocp--srp)
9. [Dependency Injection (IoC Container) → DIP + SRP + OCP](#9-dependency-injection-ioc-container--dip--srp--ocp)
10. [Module Pattern (NestJS @Module) → Toàn Bộ SOLID](#10-module-pattern-nestjs-module--toàn-bộ-solid)
11. [Facade Pattern → ISP + SRP](#11-facade-pattern--isp--srp)
12. [Producer-Consumer Pattern → SRP + OCP](#12-producer-consumer-pattern--srp--ocp)
13. [Bản Đồ Tổng Hợp: Từ Vấn Đề → SOLID → Pattern](#13-bản-đồ-tổng-hợp-từ-vấn-đề--solid--pattern)
14. [Kết Luận](#14-kết-luận)

---

## 1. Câu Hỏi Gốc: Design Patterns Sinh Ra Để Làm Gì?

### Hiểu Sai Phổ Biến

Nhiều developer nghĩ Design Patterns là "kỹ thuật code hay" — học thuộc GoF 23 patterns rồi áp dụng. Đó là hiểu **ngược**.

### Sự Thật

Design Patterns sinh ra vì developers gặp **vấn đề lặp đi lặp lại** khi cố gắng **tuân thủ SOLID**. Pattern là **giải pháp đã được chứng minh** cho từng loại vi phạm SOLID.

```
Dòng chảy nhân quả:

Vấn đề thực tế
    │
    ▼
Cố gắng tuân thủ SOLID Principles
    │
    │  "Làm sao để SRP mà vẫn hoạt động được?"
    │  "Làm sao để OCP mà không cần sửa code cũ?"
    │  "Làm sao để DIP mà vẫn inject đúng class?"
    │
    ▼
Design Patterns ← giải pháp cho từng câu hỏi trên
```

**Analogia**: SOLID là **luật giao thông**. Design Patterns là **các ngã tư, vòng xoay, cầu vượt** — chúng tồn tại vì luật giao thông yêu cầu xe phải đi đúng làn, rẽ đúng hướng, không đâm nhau. Không có luật giao thông → không cần vòng xoay.

### Trong NestJS: Framework Bắt Buộc Bạn Dùng Pattern

NestJS **nhúng Design Patterns vào trong framework**, khiến developer tuân thủ SOLID **mà không cần biết tên SOLID**:

```
NestJS buộc bạn dùng         → Để tuân thủ
─────────────────────────────────────────────
@Module()                    → SRP, ISP (module-level)
constructor injection        → DIP
Guards / Interceptors / Pipes → Chain of Responsibility → SRP, OCP
@Injectable() + providers    → Factory + DI → DIP, OCP
```

---

## 2. Ma Trận: Pattern × SOLID — Ai Phục Vụ Ai?

| Design Pattern | S | O | L | I | D | Nguyên tắc CHÍNH |
|----------------|---|---|---|---|---|-------------------|
| **Strategy** | | ★ | ★ | | ★ | OCP — thêm strategy mới không sửa context |
| **Repository** | ★ | | | | ★ | SRP — tách data access khỏi business |
| **Decorator (NestJS)** | ★ | ★ | | | | OCP — thêm behavior không sửa class |
| **Chain of Responsibility** | ★ | ★ | | ★ | | SRP — mỗi handler 1 việc |
| **Factory** | | ★ | | | ★ | DIP — tạo object qua abstraction |
| **Observer** | ★ | ★ | | | | OCP — thêm listener không sửa emitter |
| **DI Container** | ★ | ★ | | | ★ | DIP — core engine |
| **Module** | ★ | ★ | ★ | ★ | ★ | Toàn bộ SOLID ở module-level |
| **Facade** | | | | ★ | | ISP — interface đơn giản cho hệ thống phức tạp |
| **Producer-Consumer** | ★ | ★ | | | | SRP — tách tạo job và xử lý job |

★ = nguyên tắc mà pattern **trực tiếp phục vụ**

---

## 3. Strategy Pattern → OCP + DIP + LSP

### Vấn Đề SOLID Mà Strategy Giải Quyết

```
Không có Strategy:
────────────────────────────────────────
class AuthenticationGuard {
  canActivate(context) {
    if (type === 'bearer') {
      // 50 dòng Bearer logic
    } else if (type === 'api-key') {
      // 40 dòng API Key logic
    } else if (type === 'oauth2') {         // ← SỬA CLASS CŨ (vi phạm OCP)
      // 60 dòng OAuth2 logic               // ← CLASS LÀM NHIỀU VIỆC (vi phạm SRP)
    }                                        // ← HARDCODE CONCRETE (vi phạm DIP)
  }
}
```

### Cách Strategy Giải Quyết — Evidence Từ Dự Án

```
File: src/shared/guards/authentication.guard.ts
```

```typescript
// AuthenticationGuard — STRATEGY PATTERN
@Injectable()
export class AuthenticationGuard implements CanActivate {
  // Strategy map: AuthType → Guard implementation
  private readonly authTypeGuardMap: Record<string, CanActivate>

  constructor(
    private readonly accessTokenGuard: AccessTokenGuard,       // Strategy 1
    private readonly paymentAPIKeyGuard: PaymentAPIKeyGuard,   // Strategy 2
  ) {
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,      // ← DIP: inject abstraction
      [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
      [AuthType.None]: { canActivate: () => true },  // ← LSP: cùng interface
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Context KHÔNG CẦN BIẾT strategy nào chạy
    const guards = authTypeValue.authTypes.map(
      (authType) => this.authTypeGuardMap[authType]
    )
    // Chạy guard(s) theo condition (And/Or)
  }
}
```

### SOLID Breakdown

```
OCP ✅  Thêm auth type mới (OAuth2)?
        → Tạo OAuth2Guard implements CanActivate
        → Thêm vào authTypeGuardMap
        → AuthenticationGuard.canActivate() KHÔNG SỬA

DIP ✅  AuthenticationGuard phụ thuộc vào CanActivate (interface)
        → Không phụ thuộc vào AccessTokenGuard hay PaymentAPIKeyGuard (concrete)

LSP ✅  AccessTokenGuard, PaymentAPIKeyGuard, { canActivate: () => true }
        → Tất cả implement CanActivate
        → Thay thế lẫn nhau mà không hỏng
        → AuthenticationGuard không cần biết đang chạy guard nào
```

### Sơ Đồ Nhân Quả

```
Vấn đề: "Mỗi lần thêm auth type → sửa AuthenticationGuard"
    │
    ├─▶ Vi phạm OCP (sửa code cũ)
    ├─▶ Vi phạm SRP (1 class handle nhiều auth logic)
    └─▶ Vi phạm DIP (hardcode concrete logic)
         │
         ▼
    GIẢI PHÁP: Strategy Pattern
         │
         ├─▶ Mỗi auth type = 1 class riêng (SRP ✅)
         ├─▶ Thêm type = thêm class, không sửa context (OCP ✅)
         ├─▶ Inject qua interface CanActivate (DIP ✅)
         └─▶ Mọi guard thay thế nhau được (LSP ✅)
```

---

## 4. Repository Pattern → SRP + DIP

### Vấn Đề SOLID Mà Repository Giải Quyết

```
Không có Repository:
────────────────────────────────────────
class AuthService {
  async register(body) {
    // Business logic VÀ database logic TRỘN LẪN
    const hashedPassword = await bcrypt.hash(body.password, 10)     // Business
    const user = await prisma.user.create({ data: { ... } })        // Database
    const token = jwt.sign({ userId: user.id }, secret)             // Business
    await prisma.refreshToken.create({ data: { ... } })             // Database
    await transporter.sendMail({ ... })                             // Email
    return { user, token }
  }
}
// → SRP vi phạm: AuthService biết cả business, DB, email, hashing
// → DIP vi phạm: AuthService phụ thuộc trực tiếp vào Prisma, bcrypt
```

### Cách Repository Giải Quyết — Evidence Từ Dự Án

```
File: src/routes/auth/auth.service.ts:40-50
```

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,        // ← Abstraction cho hashing
    private readonly authRepository: AuthRepository,        // ← Abstraction cho DB
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly tokenService: TokenService,            // ← Abstraction cho JWT
    private readonly emailService: EmailService,            // ← Abstraction cho email
    private readonly twoFactorService: TwoFactorService,
    private readonly sharedRoleRepository: SharedRoleRepository,
  ) {}

  async register(body: RegisterBodyType) {
    // AuthService CHỈ LO business logic orchestration
    await this.validateVerificationCode({ ... })                     // Gọi abstraction
    const hashedPassword = await this.hashingService.hash(body.password)  // Gọi abstraction
    const user = await this.authRepository.createUser({ ... })            // Gọi abstraction
    return user
  }
}
```

### SOLID Breakdown

```
SRP ✅  AuthService: chỉ lo business orchestration
        AuthRepository: chỉ lo database queries
        HashingService: chỉ lo hash/verify
        TokenService: chỉ lo JWT
        EmailService: chỉ lo email

        → Mỗi class 1 lý do thay đổi
        → Đổi database (Prisma → TypeORM)? Chỉ sửa Repository
        → Đổi hashing (bcrypt → argon2)? Chỉ sửa HashingService
        → AuthService: KHÔNG SỬA

DIP ✅  AuthService phụ thuộc vào AuthRepository (abstraction)
        AuthService KHÔNG import Prisma, không gọi prisma.user.create()
        → Đổi ORM = sửa Repository implementation, không sửa Service
```

### Sơ Đồ

```
  AuthService (Business Logic)
       │
       │  inject (DIP)
       │
  ┌────┼────────────┬───────────────┬────────────────┐
  │    ▼            ▼               ▼                ▼
  │ AuthRepo    HashingService  TokenService    EmailService
  │ (DB layer)  (Crypto layer)  (JWT layer)    (Mail layer)
  │    │            │               │                │
  │    ▼            ▼               ▼                ▼
  │ Prisma       bcrypt          jsonwebtoken    Nodemailer
  │ (concrete)   (concrete)      (concrete)     (concrete)
  │
  └── SRP: mỗi layer 1 trách nhiệm
      DIP: business → abstraction → concrete
```

---

## 5. Decorator Pattern (NestJS Decorators) → OCP + SRP

### Vấn Đề SOLID

"Làm sao thêm behavior cho method (validation, auth, rate limit, serialization) mà **không sửa method**?"

### Evidence Từ Dự Án

```
File: src/routes/auth/auth.controller.ts:36-45
```

```typescript
@Throttle({ short: { limit: 3, ttl: 60000 } })   // ← Rate limit behavior (OCP: thêm không sửa)
@Post('register')                                   // ← Route binding
@ZodResponse({ type: RegisterResDTO })              // ← Output validation (SRP: controller không lo validation)
@IsPublic()                                         // ← Auth bypass (OCP: thêm không sửa guard logic)
register(@Body() body: RegisterBodyDTO) {
  return this.authService.register(body)
  // ← Method body CHỈ LO 1 VIỆC: gọi service
  // ← Tất cả cross-cutting concerns nằm ở decorators
}
```

### SOLID Breakdown

```
OCP ✅  Thêm rate limiting? → Thêm @Throttle() decorator
        Thêm output validation? → Thêm @ZodResponse() decorator
        Thêm caching? → Thêm @CacheKey() decorator
        → Method register() KHÔNG BAO GIỜ SỬA

SRP ✅  Controller method: chỉ lo gọi service
        @Throttle: chỉ lo rate limiting
        @ZodResponse: chỉ lo output serialization
        @IsPublic: chỉ lo auth configuration
        → Mỗi decorator 1 trách nhiệm, tách biệt hoàn toàn
```

### Decorator @IsPublic() — Evidence Chi Tiết

```
File: src/shared/decorators/auth.decorator.ts
```

```typescript
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  return SetMetadata(AUTH_TYPE_KEY, { authTypes, options: options ?? { condition: ConditionGuard.And } })
}

export const IsPublic = () => Auth([AuthType.None])
```

```
Dòng chảy:

@IsPublic()
    │
    ▼ SetMetadata(AUTH_TYPE_KEY, { authTypes: [AuthType.None] })
    │
    ▼ AuthenticationGuard.getAuthTypeValue()       ← đọc metadata
    │
    ▼ authTypeGuardMap[AuthType.None]              ← Strategy Pattern
    │
    ▼ { canActivate: () => true }                  ← Bypass auth

→ Không sửa AuthenticationGuard
→ Không sửa controller method
→ Chỉ THÊM decorator = OCP thuần túy
```

---

## 6. Chain of Responsibility → SRP + OCP + ISP

### Vấn Đề SOLID

"Request đi qua nhiều bước xử lý (validation → auth → rate limit → handler → serialization → error handling). Làm sao để mỗi bước tách biệt?"

### NestJS Request Pipeline = Chain of Responsibility

```
File: src/app.module.ts:197-234
```

```typescript
// Mỗi "mắt xích" trong chain là 1 provider riêng biệt
providers: [
  // PIPE: Input validation
  { provide: APP_PIPE, useClass: CustomZodValidationPipe },

  // INTERCEPTOR: Output serialization
  { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },

  // FILTER 1: Fallback error handler (LAST to execute)
  { provide: APP_FILTER, useClass: CatchEverythingFilter },

  // FILTER 2: HTTP exception handler (FIRST to execute)
  { provide: APP_FILTER, useClass: HttpExceptionFilter },

  // GUARD 1: Rate limiting
  { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },

  // GUARD 2: Authentication
  { provide: APP_GUARD, useClass: AuthenticationGuard },
]
```

### Sơ Đồ Chain

```
REQUEST ──▶ ThrottlerGuard ──▶ AuthenticationGuard ──▶ ZodValidationPipe
              (rate limit)       (auth check)           (input validation)
                │                    │                       │
                │ SRP ✅            │ SRP ✅               │ SRP ✅
                │ Chỉ lo            │ Chỉ lo               │ Chỉ lo
                │ rate limit        │ auth                  │ validation
                │                    │                       │
                ▼                    ▼                       ▼
           ┌─────────────────────────────────────────────────────┐
           │              Controller Handler                      │
           │         (chỉ lo gọi service — SRP ✅)              │
           └─────────────────────────────────┬───────────────────┘
                                             │
                                             ▼
RESPONSE ◀── HttpExceptionFilter ◀── ZodSerializerInterceptor
               (error handling)         (output serialization)
                │ SRP ✅               │ SRP ✅
                │ Chỉ lo               │ Chỉ lo
                │ format lỗi           │ output format
```

### SOLID Breakdown

```
SRP ✅  Mỗi mắt xích 1 trách nhiệm:
        - CustomZodValidationPipe: chỉ validate input
        - AuthenticationGuard: chỉ check auth
        - ThrottlerBehindProxyGuard: chỉ rate limit
        - ZodSerializerInterceptor: chỉ serialize output
        - HttpExceptionFilter: chỉ format HTTP errors
        - CatchEverythingFilter: chỉ catch non-HTTP errors

OCP ✅  Thêm logging? → Thêm LoggingInterceptor vào chain
        Thêm CORS? → Thêm middleware vào chain
        → KHÔNG SỬA bất kỳ mắt xích nào đang có

ISP ✅  Mỗi mắt xích chỉ "thấy" interface nó cần:
        - Guard implements CanActivate (chỉ biết canActivate())
        - Pipe implements PipeTransform (chỉ biết transform())
        - Filter implements ExceptionFilter (chỉ biết catch())
        - Interceptor implements NestInterceptor (chỉ biết intercept())
        → Không ai bị ÉP implement method mà nó không dùng
```

### Evidence: HttpExceptionFilter vs CatchEverythingFilter — ISP Trong Thực Tế

```typescript
// HttpExceptionFilter: CHỈ catch HttpException (ISP ✅)
@Catch(HttpException)
export class HttpExceptionFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // Chỉ handle HttpException + ZodSerializationException
  }
}

// CatchEverythingFilter: CHỈ catch "everything else" (ISP ✅)
@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Handle HttpException, Prisma errors, unknown errors
  }
}
```

Hai filters **tách biệt** theo ISP — mỗi filter chỉ handle exception type mà nó chuyên trách, không bị ép handle loại mà nó không cần.

---

## 7. Factory Pattern → DIP + OCP

### Trong NestJS: DI Container = Abstract Factory

NestJS DI Container **là** một Factory Pattern ở quy mô lớn. Khi bạn viết:

```typescript
@Module({
  providers: [AuthService, AuthRepository, GoogleService],
})
export class AuthModule {}
```

NestJS **tự động**:
1. Scan constructor parameters của `AuthService`
2. Tìm provider matching cho `HashingService`, `AuthRepository`, `TokenService`...
3. Tạo instance theo đúng thứ tự dependency
4. Inject vào constructor

### useFactory — Factory Pattern Tường Minh

```
File: src/app.module.ts:89-115
```

```typescript
// CacheModule sử dụng Factory Pattern để tạo Redis connection
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => {
    const store = createKeyv({
      url: envConfig.REDIS_URL,
      socket: {
        connectTimeout: 15000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) return new Error('max retries reached')
          return Math.min(retries * 200, 5000)
        },
      },
    })
    return { stores: [store] }
  },
})
```

### SOLID Breakdown

```
DIP ✅  Consumer (bất kỳ service nào) inject CACHE_MANAGER token
        → Không biết backend là Redis, Memcached hay in-memory
        → Factory tạo đúng implementation dựa trên config

OCP ✅  Đổi cache backend?
        → Sửa useFactory, return store khác
        → TẤT CẢ consumers KHÔNG SỬA
```

---

## 8. Observer Pattern → OCP + SRP

### Trong Dự Án: WebSocket Gateway = Observer

```
File: src/websockets/chat.module.ts
```

```typescript
@Module({
  imports: [ConversationModule],
  providers: [
    ChatRedisService,          // Shared state (Subject)
    ChatConnectionHandler,     // Observer 1: connection events
    ChatMessageHandler,        // Observer 2: message events
    ChatTypingHandler,         // Observer 3: typing events
    ChatInteractionHandler,    // Observer 4: reaction events
  ],
})
export class ChatModule {}
```

### SOLID Breakdown

```
SRP ✅  Mỗi handler 1 loại event:
        - ChatConnectionHandler: chỉ lo connect/disconnect
        - ChatMessageHandler: chỉ lo send/receive message
        - ChatTypingHandler: chỉ lo typing indicator
        - ChatInteractionHandler: chỉ lo reactions

OCP ✅  Thêm event type mới (ví dụ: ChatPresenceHandler)?
        → Tạo handler mới
        → Đăng ký vào ChatModule providers
        → KHÔNG SỬA handler cũ
```

---

## 9. Dependency Injection (IoC Container) → DIP + SRP + OCP

### DI Là Pattern Nền Tảng Nhất Trong NestJS

DI Container **không phải 1 pattern** — nó là **infrastructure cho mọi pattern khác**. Mọi pattern trong NestJS đều hoạt động **thông qua** DI.

### Evidence: AuthService Constructor

```
File: src/routes/auth/auth.service.ts:42-50
```

```typescript
constructor(
  private readonly hashingService: HashingService,        // DIP: abstraction
  private readonly authRepository: AuthRepository,        // DIP: abstraction
  private readonly sharedUserRepository: SharedUserRepository,
  private readonly tokenService: TokenService,            // DIP: abstraction
  private readonly emailService: EmailService,            // DIP: abstraction
  private readonly twoFactorService: TwoFactorService,
  private readonly sharedRoleRepository: SharedRoleRepository,
)
```

### DI = Cỗ Máy Thực Thi DIP

```
KHÔNG có DI (vi phạm DIP):
──────────────────────────
class AuthService {
  private hashingService = new BcryptHashingService()     // ← Hardcode concrete
  private authRepo = new PrismaAuthRepository()           // ← Hardcode concrete
  private tokenService = new JwtTokenService()            // ← Hardcode concrete
}
// → Đổi bcrypt? Sửa AuthService.
// → Đổi Prisma? Sửa AuthService.
// → AuthService phụ thuộc vào CONCRETE

CÓ DI (tuân thủ DIP):
──────────────────────
class AuthService {
  constructor(
    private readonly hashingService: HashingService,       // ← Interface/Token
    private readonly authRepo: AuthRepository,             // ← Interface/Token
    private readonly tokenService: TokenService,           // ← Interface/Token
  ) {}
}
// → DI Container tự động tạo và inject concrete implementation
// → AuthService phụ thuộc vào ABSTRACTION
// → Đổi bcrypt? Đổi provider trong Module, AuthService KHÔNG SỬA
```

### Tại Sao DI Phục Vụ Cả SRP và OCP

```
SRP: DI cho phép tách class thành nhiều class nhỏ
     → Không cần 1 class làm tất cả
     → Mỗi class inject dependencies nó cần

OCP: DI cho phép swap implementation
     → Thay provider trong Module
     → Consumer không sửa
     → Thêm behavior mới = thêm provider mới

DIP: DI là MECHANISM thực thi DIP
     → Constructor nhận abstraction
     → Container cung cấp concrete
     → Separation hoàn hảo
```

---

## 10. Module Pattern (NestJS @Module) → Toàn Bộ SOLID

### Module Pattern Là "Meta-Pattern"

`@Module()` trong NestJS **không chỉ là 1 pattern** — nó là **container cho tất cả patterns khác** và phục vụ **toàn bộ 5 nguyên tắc SOLID** ở module-level (đã phân tích chi tiết trong `ZZ_84_2`).

```typescript
// Một @Module() duy nhất thể hiện TẤT CẢ 5 nguyên tắc SOLID
@Module({
  imports: [VoucherModule],                                    // DIP: phụ thuộc abstraction
  providers: [OrderService, OrderRepo, OrderProducer],         // SRP: mỗi provider 1 việc
  controllers: [OrderController],                              // ISP: chỉ expose cần thiết
  // exports: []  ← Không export = OCP (module khác không phụ thuộc internal)
})
export class OrderModule {}
// LSP: Có thể swap OrderModule với OrderModuleV2 nếu cùng exports
```

---

## 11. Facade Pattern → ISP + SRP

### Trong Dự Án: Controller Là Facade

Controller trong NestJS đóng vai trò **Facade** — giao diện đơn giản che giấu hệ thống phức tạp bên trong.

```typescript
// AuthController là Facade cho hệ thống Auth phức tạp
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,       // Phía sau: 7 services
    private readonly googleService: GoogleService,   // Phía sau: OAuth2 flow
  ) {}

  // Client chỉ thấy API đơn giản
  @Post('register')
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }
  // Phía sau register():
  // → validateVerificationCode (AuthRepository → Prisma)
  // → getClientRoleId (SharedRoleRepository → Prisma)
  // → hash password (HashingService → bcrypt)
  // → createUser (AuthRepository → Prisma)
  // → deleteVerificationCode (AuthRepository → Prisma)
}
```

### SOLID Breakdown

```
ISP ✅  Client (HTTP consumer) chỉ thấy:
        POST /auth/register { email, password, name, ... }
        → Không biết bên trong có 7 services
        → Không bị ép biết HashingService, TokenService...
        → Interface tối thiểu cho consumer

SRP ✅  Controller: chỉ lo nhận request, gọi service, trả response
        Service: chỉ lo business orchestration
        Repository: chỉ lo database
        → Facade không LÀM việc, nó DELEGATE việc
```

---

## 12. Producer-Consumer Pattern → SRP + OCP

### Evidence Từ Dự Án

```
File: src/routes/payment/payment.module.ts
```

```typescript
@Module({
  imports: [
    BullModule.registerQueue({ name: PAYMENT_QUEUE_NAME }),
  ],
  providers: [
    PaymentService,     // Business logic
    PaymentRepo,        // Database
    PaymentProducer,    // ← Producer: tạo job
    PaymentGateway,     // WebSocket
  ],
})
export class PaymentModule {}
```

```
File: src/app.module.ts:230-231
```

```typescript
providers: [
  PaymentConsumer,   // ← Consumer: xử lý job (ở AppModule level)
  WishlistConsumer,  // ← Consumer khác
]
```

### SOLID Breakdown

```
SRP ✅  PaymentProducer: CHỈ tạo job, đẩy vào queue
        PaymentConsumer: CHỈ lấy job từ queue, xử lý
        → Tách biệt "ai tạo" và "ai xử lý"

OCP ✅  Thêm job type mới?
        → Thêm method trong Producer
        → Thêm case trong Consumer
        → PaymentService (business) KHÔNG SỬA queue logic
```

---

## 13. Bản Đồ Tổng Hợp: Từ Vấn Đề → SOLID → Pattern

```
┌────────────────────────────┬───────────────────────┬──────────────────────────────┐
│         VẤN ĐỀ             │    SOLID BỊ VI PHẠM   │     PATTERN GIẢI QUYẾT       │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Class làm quá nhiều việc   │ SRP                   │ Repository, Facade,          │
│                            │                       │ Chain of Responsibility      │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Thêm feature = sửa code   │ OCP                   │ Strategy, Decorator,         │
│ cũ                         │                       │ Observer, Module Pattern     │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Swap implementation hỏng   │ LSP                   │ Strategy (cùng interface),   │
│ consumer                   │                       │ Module swap                  │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Interface quá lớn, ép      │ ISP                   │ Facade, Chain of Resp,       │
│ dùng method không cần      │                       │ Module exports               │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Business biết              │ DIP                   │ DI Container, Factory,       │
│ infrastructure             │                       │ Repository, Module imports   │
├────────────────────────────┼───────────────────────┼──────────────────────────────┤
│ Tạo job và xử lý job       │ SRP + OCP             │ Producer-Consumer            │
│ trộn lẫn                   │                       │                              │
└────────────────────────────┴───────────────────────┴──────────────────────────────┘
```

### Sơ Đồ Nhân Quả Tổng Thể

```
                    SOLID PRINCIPLES
                    (Nguyên tắc gốc)
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
     "Làm sao để    "Làm sao để       "Làm sao để
      SRP?"          OCP?"              DIP?"
          │              │                  │
          ▼              ▼                  ▼
    ┌───────────┐  ┌───────────┐     ┌───────────┐
    │Repository │  │ Strategy  │     │    DI     │
    │Chain of R │  │ Decorator │     │ Container │
    │ Facade    │  │ Observer  │     │ Factory   │
    │Prod-Cons  │  │ Module    │     │ Repository│
    └───────────┘  └───────────┘     └───────────┘
         │              │                  │
         └──────────────┼──────────────────┘
                        │
                        ▼
              DESIGN PATTERNS
           (Giải pháp đã chứng minh)
```

---

## 14. Kết Luận

### Trả Lời Câu Hỏi Gốc

**"Các Design Patterns sinh ra là để tuân thủ SOLID phải không?"**

**Đúng, nhưng cần nói chính xác hơn:**

1. **SOLID là NGUYÊN TẮC** — nó nói "code NÊN thế nào" nhưng **không nói HOW**
2. **Design Patterns là GIẢI PHÁP** — nó nói "đây là CÁCH để tuân thủ nguyên tắc đó"
3. **Mối quan hệ là nhân quả**: SOLID đặt ra vấn đề → Pattern giải quyết vấn đề

### Trong NestJS: Framework Là Bộ Sưu Tập Patterns

NestJS đặc biệt vì framework **buộc** bạn dùng Design Patterns:

| NestJS Feature | Design Pattern | SOLID được tuân thủ |
|---------------|---------------|---------------------|
| `@Module()` | Module Pattern | S, O, L, I, D (toàn bộ) |
| `constructor(private service)` | DI Container | D, S, O |
| `@Injectable()` + providers | Factory | D, O |
| Guards / Pipes / Interceptors / Filters | Chain of Responsibility | S, O, I |
| `@Decorator()` trên methods | Decorator Pattern | O, S |
| Guard map trong AuthenticationGuard | Strategy Pattern | O, D, L |
| WebSocket handlers | Observer / Command | S, O |
| BullMQ Producer/Consumer | Producer-Consumer | S, O |

### Thứ Tự Tư Duy Đúng

```
❌ SAI: "Học 23 GoF patterns → áp dụng vào code"
   → Dẫn đến over-engineering, dùng pattern không cần thiết

✅ ĐÚNG: "Hiểu SOLID → nhận ra code vi phạm nguyên tắc nào → chọn pattern phù hợp"
   → Pattern là CÔNG CỤ, SOLID là TIÊU CHÍ đánh giá code tốt/xấu
```

```
SOLID = Bản đồ (chỉ hướng đi đúng)
Design Pattern = Phương tiện (giúp đi đến đó)

Biết bản đồ mà không có phương tiện → biết đúng nhưng không làm được
Có phương tiện mà không có bản đồ → làm nhanh nhưng đi sai hướng
CẢ HAI → đi đúng hướng VÀ đi nhanh
```

---

> **Tài liệu tham khảo chéo:**
> - SOLID ở class-level: `ZZ_84_1` — Mục 1
> - SOLID ở module-level: `ZZ_84_2` — Toàn bộ
> - Design Patterns chi tiết: `ZZ_87_DESIGN_PATTERNS_ANALYSIS.md`
> - CQRS Pattern: `cqrs-payment-architecture.md`
