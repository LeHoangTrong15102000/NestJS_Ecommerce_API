# 🎯 Backend NestJS Core Knowledge — Deep Dive Toàn Diện

> **Mục đích**: Tổng hợp kiến thức nền tảng cần thiết cho một Backend NestJS Developer, bao gồm: Dependency Injection, Blocking/Non-blocking, TypeScript Advanced Types, và SQL/ORM Concepts. Mỗi phần đều có ví dụ thực tế từ dự án NestJS Ecommerce API.
>
> **Tài liệu liên quan**: [ZZ_8 - DI & IoC](./ZZ_8_DEPENDENCY_INJECTION_VA_IOC_TRONG_NESTJS.md) | [ZZ_36 - Blocking/Non-blocking](./ZZ_36_BLOCKING_VS_NON_BLOCKING_NODEJS_CHI_TIET.md) | [ZZ_81 - Event Loop](./ZZ_81_EVENT_LOOP_ASYNC_PERFORMANCE_DEEP_DIVE.md) | [ZZ_21 - ACID & Transaction](./ZZ_21_ACID_VA_ISOLATE_CHUYEN_SAU_CHI_TIET.md) | [ZZ_30 - Prisma Schema](./ZZ_30_PRIORITY_GIAI_THICH_CHI_TIET_SCHEMA_PRISMA.md)

---

## 📋 MỤC LỤC

- [PHẦN 1: NestJS Dependency Injection — Module, Provider, Service, Scope](#phần-1-nestjs-dependency-injection--module-provider-service-scope)
  - [1.1 Dependency Injection Là Gì? — Tại Sao Cần?](#11-dependency-injection-là-gì--tại-sao-cần)
  - [1.2 Module System — Cách NestJS Tổ Chức Code](#12-module-system--cách-nestjs-tổ-chức-code)
  - [1.3 Provider & Service — Injectable Dependencies](#13-provider--service--injectable-dependencies)
  - [1.4 DI Scope — DEFAULT, REQUEST, TRANSIENT](#14-di-scope--default-request-transient)
  - [1.5 Custom Providers — useClass, useValue, useFactory, useExisting](#15-custom-providers--useclass-usevalue-usefactory-useexisting)
  - [1.6 Circular Dependencies — Vấn Đề & Giải Pháp](#16-circular-dependencies--vấn-đề--giải-pháp)
- [PHẦN 2: Blocking vs Non-Blocking Code — async/await, Promise](#phần-2-blocking-vs-non-blocking-code--asyncawait-promise)
  - [2.1 Blocking Code — Tại Sao Nguy Hiểm Trong Node.js?](#21-blocking-code--tại-sao-nguy-hiểm-trong-nodejs)
  - [2.2 Non-Blocking Code — Callback, Promise, async/await](#22-non-blocking-code--callback-promise-asyncawait)
  - [2.3 Event Loop — Cơ Chế Cốt Lõi](#23-event-loop--cơ-chế-cốt-lõi)
  - [2.4 Promise.all vs Sequential — Khi Nào Dùng Gì?](#24-promiseall-vs-sequential--khi-nào-dùng-gì)
  - [2.5 Common Pitfalls Trong NestJS](#25-common-pitfalls-trong-nestjs)
- [PHẦN 3: TypeScript Advanced Types — Generics, Union, Intersection, Type Narrowing](#phần-3-typescript-advanced-types--generics-union-intersection-type-narrowing)
  - [3.1 Generics — Tái Sử Dụng Code Với Type Safety](#31-generics--tái-sử-dụng-code-với-type-safety)
  - [3.2 Union Types — "Hoặc Cái Này Hoặc Cái Kia"](#32-union-types--hoặc-cái-này-hoặc-cái-kia)
  - [3.3 Intersection Types — "Kết Hợp Tất Cả"](#33-intersection-types--kết-hợp-tất-cả)
  - [3.4 Type Narrowing — Thu Hẹp Kiểu Dữ Liệu](#34-type-narrowing--thu-hẹp-kiểu-dữ-liệu)
  - [3.5 Utility Types Thường Dùng Trong NestJS](#35-utility-types-thường-dùng-trong-nestjs)
- [PHẦN 4: SQL & ORM Concepts — Entity, Relation, Transaction](#phần-4-sql--orm-concepts--entity-relation-transaction)
  - [4.1 Entity — Bảng Dữ Liệu Trong Code](#41-entity--bảng-dữ-liệu-trong-code)
  - [4.2 Relation Types — OneToOne, OneToMany, ManyToMany](#42-relation-types--onetoone-onetomany-manytomany)
  - [4.3 Transaction — Đảm Bảo Tính Toàn Vẹn Dữ Liệu](#43-transaction--đảm-bảo-tính-toàn-vẹn-dữ-liệu)
  - [4.4 TypeORM vs Prisma — So Sánh Cách Tiếp Cận](#44-typeorm-vs-prisma--so-sánh-cách-tiếp-cận)
  - [4.5 Migration & Schema Management](#45-migration--schema-management)
- [PHẦN 5: Tổng Kết & Cross-References](#phần-5-tổng-kết--cross-references)

---


## PHẦN 1: NestJS Dependency Injection — Module, Provider, Service, Scope

### 1.1 Dependency Injection Là Gì? — Tại Sao Cần?

**Dependency Injection (DI)** là một design pattern trong đó một object nhận dependencies từ bên ngoài thay vì tự tạo chúng. NestJS sử dụng DI làm nền tảng kiến trúc.

#### Không có DI (Tight Coupling) — ❌

```typescript
// ❌ BAD: Service tự tạo dependencies
class UserService {
  private db: PrismaClient

  constructor() {
    this.db = new PrismaClient() // ← Tự tạo, không thể thay thế
  }

  async findUser(id: number) {
    return this.db.user.findUnique({ where: { id } })
  }
}

// Vấn đề:
// 1. Không thể mock PrismaClient khi test
// 2. Không thể thay đổi database implementation
// 3. Mỗi UserService tạo 1 PrismaClient riêng → lãng phí connection
```

#### Có DI (Loose Coupling) — ✅

```typescript
// ✅ GOOD: Dependencies được inject từ bên ngoài
// src/routes/user/user.service.ts (dự án thực tế)
@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,           // ← Inject từ bên ngoài
    private readonly hashingService: HashingService, // ← Inject từ bên ngoài
  ) {}

  async createUser(data: CreateUserBodyType) {
    const hashedPassword = await this.hashingService.hash(data.password)
    return this.userRepo.create({ ...data, password: hashedPassword })
  }
}

// Lợi ích:
// 1. Test: Mock UserRepo và HashingService dễ dàng
// 2. Flexible: Thay đổi implementation mà không sửa UserService
// 3. Singleton: NestJS quản lý lifecycle, 1 instance dùng chung
```

#### Quá trình DI trong NestJS

```
┌─────────────────────────────────────────────────────────────────┐
│              NestJS DI CONTAINER — LIFECYCLE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① SCANNING PHASE (Khởi động app)                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NestJS quét tất cả @Module(), @Injectable(), @Controller │   │
│  │  → Tìm ra dependency graph                                │   │
│  │                                                            │   │
│  │  AppModule                                                 │   │
│  │    ├── SharedModule (PrismaService, HashingService, ...)   │   │
│  │    ├── AuthModule (AuthService, AuthRepository)            │   │
│  │    ├── UserModule (UserService, UserRepo)                  │   │
│  │    └── ProductModule (ProductService, ProductRepo)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ② REGISTRATION PHASE                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Đăng ký tất cả providers vào DI Container                │   │
│  │                                                            │   │
│  │  Container = {                                             │   │
│  │    PrismaService: <pending>,                               │   │
│  │    HashingService: <pending>,                              │   │
│  │    UserRepo: <pending>,                                    │   │
│  │    UserService: <pending>,                                 │   │
│  │    UserController: <pending>,                              │   │
│  │  }                                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ③ RESOLUTION PHASE (Topological Sort)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Phân giải dependency graph, tạo instances theo thứ tự:   │   │
│  │                                                            │   │
│  │  1. PrismaService = new PrismaService()     // Không deps  │   │
│  │  2. HashingService = new HashingService()   // Không deps  │   │
│  │  3. UserRepo = new UserRepo(prismaService)  // Cần Prisma  │   │
│  │  4. UserService = new UserService(          // Cần 2 deps  │   │
│  │       userRepo, hashingService)                            │   │
│  │  5. UserController = new UserController(    // Cần Service │   │
│  │       userService)                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ④ INJECTION PHASE                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Inject instances vào constructors → App sẵn sàng!        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```


### 1.2 Module System — Cách NestJS Tổ Chức Code

Module là đơn vị tổ chức cơ bản trong NestJS. Mỗi module đóng gói một business domain.

```typescript
// src/routes/user/user.module.ts
@Module({
  providers: [UserService, UserRepo],  // Đăng ký providers cho module này
  controllers: [UserController],        // Đăng ký controllers
})
export class UserModule {}

// src/shared/shared.module.ts — Global Module
@Global()  // ← Tất cả modules đều dùng được providers này
@Module({
  providers: [PrismaService, HashingService, TokenService, EmailService, S3Service,
              SharedUserRepository, SharedRoleRepository],
  exports:   [PrismaService, HashingService, TokenService, EmailService, S3Service,
              SharedUserRepository, SharedRoleRepository],
  imports: [JwtModule],
})
export class SharedModule {}
// 💡 Nhờ @Global(), UserModule không cần import SharedModule
//    mà vẫn inject được PrismaService, HashingService, v.v.
```

| Thành phần | Mục đích | Ví dụ |
|---|---|---|
| `providers` | Đăng ký services, repos, factories | `[UserService, UserRepo]` |
| `controllers` | Đăng ký HTTP controllers | `[UserController]` |
| `imports` | Import modules khác để dùng providers của chúng | `[SharedModule]` |
| `exports` | Chia sẻ providers cho modules khác | `[UserService]` |

### 1.3 Provider & Service — Injectable Dependencies

**Provider** = bất kỳ class nào có `@Injectable()`. **Service** là loại provider phổ biến nhất.

```typescript
@Injectable()
export class UserService { ... }         // Service — business logic
@Injectable()
export class UserRepo { ... }            // Repository — data access
@Injectable()
export class HashingService { ... }      // Utility — hashing passwords
@Injectable()
export class AuthenticationGuard { ... } // Guard — authentication

// NestJS dùng TypeScript metadata để biết constructor cần inject gì:
@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,
    //  TypeScript emit metadata: "parameter 0 cần type UserRepo"
    //  NestJS tìm trong DI Container → Tìm thấy → Inject vào
    private readonly hashingService: HashingService,
  ) {}
}
```

### 1.4 DI Scope — DEFAULT, REQUEST, TRANSIENT

NestJS hỗ trợ 3 loại scope cho providers, quyết định **khi nào instance được tạo** và **sống bao lâu**:

```
┌─────────────────────────────────────────────────────────────────┐
│              3 LOẠI SCOPE TRONG NESTJS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── DEFAULT (Singleton) ──────────────────────────────────┐   │
│  │                                                            │   │
│  │  @Injectable()  // mặc định = Scope.DEFAULT                │   │
│  │  export class PrismaService { ... }                        │   │
│  │                                                            │   │
│  │  • CHỈ 1 instance cho TOÀN BỘ application                 │   │
│  │  • Tạo khi app khởi động, sống đến khi app tắt            │   │
│  │  • ✅ Hiệu năng tốt nhất (không tạo lại mỗi request)     │   │
│  │  • ⚠️ KHÔNG lưu state per-request (shared giữa requests)  │   │
│  │                                                            │   │
│  │  Request A ──┐                                             │   │
│  │  Request B ──┼──► Cùng 1 PrismaService instance            │   │
│  │  Request C ──┘                                             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── REQUEST ──────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │  @Injectable({ scope: Scope.REQUEST })                     │   │
│  │  export class AuditService {                               │   │
│  │    constructor(@Inject(REQUEST) private request: Request) {}│   │
│  │  }                                                         │   │
│  │                                                            │   │
│  │  • Tạo instance MỚI cho MỖI HTTP request                  │   │
│  │  • Tự động destroy khi request kết thúc                    │   │
│  │  • Dùng cho: User context, audit logging, multi-tenant     │   │
│  │  • ⚠️ Chậm hơn Singleton (tạo/destroy mỗi request)       │   │
│  │  • ⚠️ "Bubble up": Nếu A inject B (REQUEST scope),        │   │
│  │       thì A cũng BỊ BUỘC trở thành REQUEST scope!         │   │
│  │                                                            │   │
│  │  Request A ──► AuditService instance #1 (destroy sau)      │   │
│  │  Request B ──► AuditService instance #2 (destroy sau)      │   │
│  │  Request C ──► AuditService instance #3 (destroy sau)      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── TRANSIENT ────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │  @Injectable({ scope: Scope.TRANSIENT })                   │   │
│  │  export class LoggerService { ... }                        │   │
│  │                                                            │   │
│  │  • Tạo instance MỚI mỗi khi được INJECT                   │   │
│  │  • Mỗi consumer nhận instance riêng                        │   │
│  │  • Dùng cho: Per-consumer logger, stateful helpers         │   │
│  │  • ⚠️ Tốn memory nhất (nhiều instances cùng lúc)          │   │
│  │                                                            │   │
│  │  UserService inject ──► LoggerService instance #1          │   │
│  │  AuthService inject ──► LoggerService instance #2          │   │
│  │  (Khác instance dù cùng 1 request!)                        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Ví dụ thực tế — REQUEST scope

```typescript
// Khi cần lưu user context cho mỗi request (audit logging, multi-tenant)
@Injectable({ scope: Scope.REQUEST })
export class UserContextService {
  private user: UserType

  setUser(user: UserType) { this.user = user }
  getUser(): UserType { return this.user }
}

// Inject request object trực tiếp
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(@Inject(REQUEST) private request: Request) {}

  async logAction(action: string) {
    const userId = this.request.user?.id
    await this.auditRepo.create({ userId, action, timestamp: new Date() })
  }
}
```

#### ⚠️ "Bubble Up" Effect — Cẩn thận!

```
Nếu RequestScopedService có scope: REQUEST
→ Bất kỳ provider nào INJECT nó cũng bị ép thành REQUEST scope

UserService (Singleton) inject RequestScopedService (REQUEST)
→ UserService BỊ BUỘC thành REQUEST scope!
→ UserController inject UserService → cũng bị REQUEST scope!
→ Cả chain bị ảnh hưởng → Performance giảm đáng kể

📊 Dự án này: 99% providers dùng DEFAULT (Singleton)
   PrismaService, HashingService, TokenService, UserRepo... đều Singleton
   Không có REQUEST/TRANSIENT scope → hiệu năng tối ưu
```

### 1.5 Custom Providers — useClass, useValue, useFactory, useExisting

Ngoài cách khai báo provider đơn giản (`providers: [UserService]`), NestJS hỗ trợ 4 loại custom providers:

#### ① useClass — Thay đổi implementation dựa trên điều kiện

```typescript
// Dạng shorthand (NestJS tự hiểu):
providers: [UserService]
// Tương đương dạng đầy đủ:
providers: [{ provide: UserService, useClass: UserService }]

// Ứng dụng: Swap implementation theo môi trường
@Module({
  providers: [
    {
      provide: 'IUserRepository',
      useClass: process.env.NODE_ENV === 'test'
        ? InMemoryUserRepository   // Test: dùng in-memory
        : DatabaseUserRepository,  // Production: dùng database
    },
  ],
})

// Ví dụ thực tế từ dự án — Global Providers trong app.module.ts:
providers: [
  { provide: APP_PIPE,        useClass: CustomZodValidationPipe },    // Validation
  { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },   // Output serialization
  { provide: APP_FILTER,      useClass: HttpExceptionFilter },        // Error handling
  { provide: APP_GUARD,       useClass: AuthenticationGuard },        // Authentication
]
// → NestJS dùng token APP_PIPE, APP_GUARD... để biết đây là global providers
```

#### ② useValue — Inject một giá trị cố định

```typescript
// Inject config object
@Module({
  providers: [
    {
      provide: 'APP_CONFIG',
      useValue: { apiUrl: 'https://api.example.com', timeout: 5000 },
    },
  ],
})

// Sử dụng với @Inject()
@Injectable()
export class ApiService {
  constructor(@Inject('APP_CONFIG') private config: { apiUrl: string; timeout: number }) {}
}

// Ứng dụng phổ biến: mock trong testing
const mockUserRepo = { create: jest.fn(), findUnique: jest.fn() }
Test.createTestingModule({
  providers: [
    UserService,
    { provide: UserRepo, useValue: mockUserRepo },  // ← Mock repo
  ],
})
```

#### ③ useFactory — Tạo provider bằng factory function (có thể async)

```typescript
// Ví dụ thực tế từ dự án — CacheModule trong app.module.ts:
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => {
    const logger = new Logger('CacheModule')
    const store = createKeyv({
      url: envConfig.REDIS_URL,          // ← envConfig từ module scope
      socket: {
        connectTimeout: 15000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Cache Redis: max retries reached')
            return new Error('Max retries reached')
          }
          return Math.min(retries * 200, 5000)
        },
      },
    })
    return { stores: [store] }
  },
})

// Factory với dependencies (inject parameter)
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (config: ConfigService) => {
        return await createDatabaseConnection(config.get('DB_URL'))
      },
      inject: [ConfigService],  // ← Dependencies cho factory function
    },
  ],
})
```

#### ④ useExisting — Alias cho provider đã có

```typescript
// Tạo alias: 2 tokens trỏ đến CÙNG 1 instance
@Module({
  providers: [
    UserService,
    { provide: 'IUserService', useExisting: UserService },
    // 'IUserService' và UserService → CÙNG instance
  ],
})

// Sử dụng: inject bằng token nào cũng được
@Injectable()
export class OrderService {
  constructor(
    @Inject('IUserService') private userService: UserService,
    // Hoặc: private userService: UserService  ← cùng instance
  ) {}
}
```

#### So sánh 4 loại Custom Providers

```
┌──────────────┬──────────────────────────────────────────────────┐
│ Loại         │ Khi nào dùng?                                    │
├──────────────┼──────────────────────────────────────────────────┤
│ useClass     │ Swap implementation (test/prod, strategy pattern) │
│ useValue     │ Inject constants, config, mock objects            │
│ useFactory   │ Async init, dynamic config, complex setup         │
│ useExisting  │ Alias tokens, backward compatibility              │
└──────────────┴──────────────────────────────────────────────────┘
```

### 1.6 Circular Dependencies — Vấn Đề & Giải Pháp

Circular dependency xảy ra khi **A phụ thuộc B** và **B phụ thuộc A** → NestJS không biết tạo cái nào trước!

```
❌ VẤN ĐỀ: Circular Dependency

  AuthService cần UserService để verify user
  UserService cần AuthService để hash password khi tạo user

  AuthService ──depends──► UserService
       ▲                        │
       └────────depends─────────┘

  NestJS: "Tạo AuthService trước? Nhưng cần UserService..."
          "Tạo UserService trước? Nhưng cần AuthService..."
          → 💥 Error: Nest can't resolve dependencies
```

#### Giải pháp 1: forwardRef() — Quick Fix

```typescript
// Module level
@Module({
  imports: [forwardRef(() => UserModule)],  // ← Lazy reference
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

// Service level
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))  // ← Lazy inject
    private userService: UserService,
  ) {}
}

// ⚠️ Nhược điểm: Code khó đọc, khó debug, dễ tạo thêm circular
```

#### Giải pháp 2: Shared Module Pattern — Tốt hơn (dự án này dùng)

```typescript
// Tách logic chung ra SharedModule → phá vỡ vòng tròn
// Ví dụ thực tế: Chat system trong dự án (ZZ_52.9)

// TRƯỚC (Circular):
// WebsocketModule ↔ ConversationModule → 💥 Error

// SAU (Clean):
// WebsocketModule → SharedChatModule → ConversationModule ✅

@Global()
@Module({
  providers: [SharedChatService],
  exports: [SharedChatService],
})
export class SharedChatModule {}

// Handler chỉ depend on SharedChatService (1 dependency)
@Injectable()
export class ChatTypingHandler {
  constructor(
    private readonly chatService: SharedChatService,  // ✅ Clean
    private readonly redisService: ChatRedisService,
  ) {}
}
```

#### Giải pháp 3: Event-Driven — Tốt nhất cho complex cases

```typescript
// Thay vì inject trực tiếp → emit event
@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(userData: CreateUserBodyType) {
    const user = await this.userRepo.create(userData)
    this.eventEmitter.emit('user.created', { user })  // ← Fire & forget
    return user
  }
}

@Injectable()
export class OrderService {
  @OnEvent('user.created')
  handleUserCreated(payload: { user: UserType }) {
    // Xử lý hoàn toàn độc lập, không circular dependency
  }
}
```

#### So sánh 3 giải pháp

```
┌─────────────────────────────────────────────────────────────────┐
│  GIẢI QUYẾT CIRCULAR DEPENDENCY — BEST PRACTICES                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① forwardRef()                                                 │
│     ✅ Nhanh, ít code thay đổi                                  │
│     ❌ Code khó đọc, che giấu vấn đề kiến trúc                 │
│     → Dùng khi: Hotfix, prototype, circular đơn giản            │
│                                                                 │
│  ② Shared Module Pattern (dự án này dùng)                       │
│     ✅ Clean architecture, dễ test, dễ maintain                  │
│     ❌ Cần refactor, tạo thêm module/service                    │
│     → Dùng khi: Production code, long-term maintenance          │
│                                                                 │
│  ③ Event-Driven (EventEmitter2)                                 │
│     ✅ Hoàn toàn decoupled, scalable                            │
│     ❌ Khó debug, eventual consistency                          │
│     → Dùng khi: Cross-domain communication, fire-and-forget     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 📖 **Deep dive**: Xem [ZZ_8 - DI & IoC chi tiết](./ZZ_8_DEPENDENCY_INJECTION_VA_IOC_TRONG_NESTJS.md) để tìm hiểu thêm về Abstract Class Tokens, Injection Tokens. Xem [ZZ_52.9 - Chat Dependency Resolution](./ZZ_52.9_CHAT_DEPENDENCY_RESOLUTION_FINAL.md) để xem case study thực tế giải quyết circular dependency trong Chat system.

---

## PHẦN 2: Blocking vs Non-Blocking Code — async/await, Promise

### 2.1 Blocking Code — Tại Sao Nguy Hiểm Trong Node.js?

**Blocking code** = code chiếm giữ Call Stack, **không cho Event Loop xử lý request khác** cho đến khi xong.

Node.js chạy JavaScript trên **1 thread duy nhất**. Nếu thread đó bị block → toàn bộ server đứng yên.

```typescript
// ❌ BLOCKING — Server chết cứng
import { readFileSync } from 'fs'
import { pbkdf2Sync } from 'crypto'

@Injectable()
export class DangerousService {
  // ❌ Đọc file đồng bộ — block Event Loop
  getConfig() {
    const data = readFileSync('config.json')  // ← BLOCK 50ms
    return JSON.parse(data.toString())
    // Trong 50ms này, KHÔNG request nào khác được xử lý!
  }

  // ❌ CPU-intensive — block Event Loop
  hashPassword(password: string) {
    return pbkdf2Sync(password, 'salt', 100000, 64, 'sha512')
    // ← BLOCK 200-500ms! Server đông cứng!
  }

  // ❌ Vòng lặp nặng — block Event Loop
  processLargeData(items: any[]) {
    let result = 0
    for (let i = 0; i < 10_000_000; i++) {  // 10 triệu iterations
      result += Math.sqrt(items[i % items.length])
    }
    return result  // ← BLOCK vài trăm ms
  }
}
```

#### Hậu quả của Blocking Code trong Server

```
Timeline khi có blocking code (readFileSync mất 50ms):

T=0ms:   UserA request → readFileSync() bắt đầu
         ┌──────────── BLOCKED ────────────┐
T=10ms:  │ UserB request → PHẢI CHỜ        │
T=20ms:  │ UserC request → PHẢI CHỜ        │
T=30ms:  │ UserD request → PHẢI CHỜ        │
T=50ms:  └─────────────────────────────────┘ readFileSync xong
T=50ms:  UserA nhận response
T=51ms:  UserB bắt đầu xử lý...
T=52ms:  UserC vẫn chờ...

→ 4 users chờ 50ms cho 1 file read!
→ Nếu 1000 users → thảm họa!
```

### 2.2 Non-Blocking Code — Callback, Promise, async/await

**Non-blocking code** = gửi tác vụ I/O đi, **trả quyền điều khiển lại cho Event Loop ngay**, khi I/O xong thì callback/Promise resolve.

#### Tiến hóa: Callback → Promise → async/await

```typescript
// ① CALLBACK (cách cũ — "Callback Hell")
fs.readFile('config.json', (err, data) => {
  if (err) return handleError(err)
  db.query('SELECT * FROM users', (err, users) => {
    if (err) return handleError(err)
    sendEmail(users[0].email, (err, result) => {
      if (err) return handleError(err)
      console.log('Done!')  // ← 3 levels deep, khó đọc!
    })
  })
})

// ② PROMISE (tốt hơn — chain được)
readFile('config.json')
  .then(data => db.query('SELECT * FROM users'))
  .then(users => sendEmail(users[0].email))
  .then(result => console.log('Done!'))
  .catch(err => handleError(err))  // ← 1 chỗ catch lỗi

// ③ ASYNC/AWAIT (tốt nhất — đọc như synchronous)
async function process() {
  try {
    const data = await readFile('config.json')
    const users = await db.query('SELECT * FROM users')
    await sendEmail(users[0].email)
    console.log('Done!')
  } catch (err) {
    handleError(err)  // ← try/catch quen thuộc
  }
}
```

#### async/await thực chất là gì?

```typescript
// Hai đoạn code này HOÀN TOÀN TƯƠNG ĐƯƠNG:

// Async/Await version (syntax sugar)
async function getUser(id: number) {
  const user = await prisma.user.findFirst({ where: { id } })
  return user
}

// Promise version (compiler biến async/await thành dạng này)
function getUser(id: number) {
  return prisma.user.findFirst({ where: { id } }).then(user => user)
}

// 💡 async/await KHÔNG biến code thành synchronous!
//    Nó vẫn là async, chỉ là VIẾT giống sync cho dễ đọc.
//    Khi gặp `await`, hàm TẠM DỪNG và trả quyền cho Event Loop.
```

#### Ví dụ thực tế từ dự án — Non-blocking patterns

```typescript
// src/routes/user/user.service.ts — async/await pattern
@Injectable()
export class UserService {
  async createUser({ data, createdById, createdByRoleName }) {
    try {
      // await → tạm dừng, Event Loop xử lý request khác
      const hashedPassword = await this.hashingService.hash(data.password)
      // await → tạm dừng, Event Loop xử lý request khác
      return await this.userRepo.create({ data: { ...data, password: hashedPassword }, createdById })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw UserAlreadyExistsException
      }
      throw error
    }
  }
}

// src/routes/media/media.service.ts — Promise.all pattern
async uploadFile(files: Array<Express.Multer.File>) {
  // Upload TẤT CẢ files ĐỒNG THỜI lên S3
  const result = await Promise.all(
    files.map(file => this.s3Service.uploadedFile({
      filename: 'images/' + file.filename,
      filepath: file.path,
      contentType: file.mimetype,
    }).then(res => ({ url: String(res.Location) })))
  )
  // Xóa TẤT CẢ temp files ĐỒNG THỜI
  await Promise.all(files.map(file => unlink(file.path)))
  return { data: result }
}
```

### 2.3 Event Loop — Cơ Chế Cốt Lõi

Event Loop là "trái tim" của Node.js — nó liên tục kiểm tra các hàng đợi (queue) và thực thi callbacks khi I/O hoàn thành.

```
┌─────────────────────────────────────────────────────────────────┐
│              EVENT LOOP — CƠ CHẾ HOẠT ĐỘNG                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │  CALL STACK  │ ← JavaScript chạy ở đây (1 thread duy nhất)  │
│  │  (V8 Engine) │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MICROTASK QUEUE (ưu tiên CAO NHẤT)                      │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │ 1. process.nextTick()  ← Ưu tiên #1            │     │   │
│  │  │ 2. Promise.then/catch  ← Ưu tiên #2            │     │   │
│  │  │    (async/await phần sau await = Promise)       │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  EVENT LOOP PHASES (6 phases, lặp vô hạn)               │   │
│  │                                                          │   │
│  │  ① Timers ──────► setTimeout, setInterval                │   │
│  │       ↓                                                  │   │
│  │  ② Pending ─────► System callbacks (TCP errors, etc.)    │   │
│  │       ↓                                                  │   │
│  │  ③ Idle/Prepare → Internal use                           │   │
│  │       ↓                                                  │   │
│  │  ④ Poll ────────► I/O callbacks (DB queries, HTTP, file) │   │
│  │       ↓           ← PHẦN LỚN code NestJS chạy ở đây     │   │
│  │  ⑤ Check ───────► setImmediate()                         │   │
│  │       ↓                                                  │   │
│  │  ⑥ Close ───────► socket.on('close'), cleanup            │   │
│  │       ↓                                                  │   │
│  │  ← Quay lại ① (loop tiếp)                               │   │
│  │                                                          │   │
│  │  💡 SAU MỖI PHASE → xử lý TOÀN BỘ Microtask Queue      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LIBUV (C++ library)                                     │   │
│  │  ┌─────────────────┐  ┌────────────────────────────┐     │   │
│  │  │  Thread Pool     │  │  OS Kernel Async           │     │   │
│  │  │  (4 threads)     │  │  (epoll/kqueue/IOCP)       │     │   │
│  │  │                  │  │                            │     │   │
│  │  │  • File I/O      │  │  • Network I/O (TCP/UDP)   │     │   │
│  │  │  • DNS lookup    │  │  • Database queries (TCP)   │     │   │
│  │  │  • crypto        │  │  • HTTP requests            │     │   │
│  │  │  • zlib          │  │  • Timers                   │     │   │
│  │  └─────────────────┘  └────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Thứ tự thực thi — Ví dụ minh họa

```javascript
console.log('1: Synchronous')                              // ① Call Stack

setTimeout(() => console.log('5: setTimeout'), 0)          // ④ Timers phase

Promise.resolve().then(() => console.log('3: Promise'))    // ② Microtask

process.nextTick(() => console.log('2: nextTick'))         // ② Microtask (#1)

setImmediate(() => console.log('6: setImmediate'))         // ⑤ Check phase

console.log('4: Synchronous cuối')                         // ① Call Stack

// Output:
// 1: Synchronous
// 4: Synchronous cuối
// 2: nextTick          ← Microtask (ưu tiên cao nhất)
// 3: Promise           ← Microtask (sau nextTick)
// 5: setTimeout        ← Timers phase
// 6: setImmediate      ← Check phase
```

#### Tại sao NestJS xử lý được hàng ngàn requests đồng thời?

```
3 requests đến cùng lúc — Event Loop xử lý:

T=0ms:  UserA → POST /order
        → Event Loop chạy code sync (validate body, etc.)
        → Gặp `await prisma.query(...)` → gửi SQL qua TCP
        → YIELD! Event Loop rảnh ngay lập tức

T=1ms:  UserB → GET /profile
        → Event Loop chạy code sync
        → Gặp `await prisma.user.findFirst(...)` → gửi SQL qua TCP
        → YIELD!

T=2ms:  UserC → PUT /cart
        → Event Loop chạy code sync
        → Gặp `await prisma.cart.update(...)` → gửi SQL qua TCP
        → YIELD!

T=15ms: PostgreSQL trả kết quả cho UserB (query đơn giản)
        → Event Loop nhận callback → tiếp tục xử lý UserB → trả response

T=25ms: PostgreSQL trả kết quả cho UserC
        → Event Loop tiếp tục UserC → trả response

T=50ms: PostgreSQL trả kết quả cho UserA (query phức tạp)
        → Event Loop tiếp tục UserA → trả response

💡 KEY: Database queries đi qua TCP = Network I/O
   → Dùng OS Kernel async (IOCP trên Windows, epoll trên Linux)
   → KHÔNG chiếm thread nào trong Thread Pool
   → Event Loop hoàn toàn rảnh trong lúc chờ DB
```

### 2.4 Promise.all vs Sequential — Khi Nào Dùng Gì?

#### ❌ Sequential (Tuần tự) — Chậm khi các tác vụ KHÔNG phụ thuộc nhau

```typescript
// ❌ BAD: 3 queries chạy tuần tự — tổng 600ms
async function getPageData() {
  const users    = await fetchUsers()       // 200ms → chờ xong
  const products = await fetchProducts()    // 300ms → rồi mới chạy cái này
  const orders   = await fetchOrders()      // 100ms → rồi mới chạy cái này
  return { users, products, orders }
}
// Tổng: 200 + 300 + 100 = 600ms 😱
```

#### ✅ Parallel (Song song) — Nhanh khi các tác vụ ĐỘC LẬP

```typescript
// ✅ GOOD: 3 queries chạy song song — tổng 300ms
async function getPageData() {
  const [users, products, orders] = await Promise.all([
    fetchUsers(),       // 200ms ─┐
    fetchProducts(),    // 300ms ─┤ Chạy ĐỒNG THỜI
    fetchOrders(),      // 100ms ─┘
  ])
  return { users, products, orders }
}
// Tổng: max(200, 300, 100) = 300ms 🚀 (nhanh gấp 2!)
```

#### Ví dụ thực tế từ dự án — Pagination Pattern

```typescript
// src/routes/user/user.repo.ts — ✅ Parallel queries cho pagination
async getListUser(pagination: GetUsersQueryType): Promise<GetUsersResType> {
  const skip = (pagination.page - 1) * pagination.limit
  const take = pagination.limit

  // ✅ count và findMany chạy ĐỒNG THỜI — không phụ thuộc nhau
  const [totalItems, data] = await Promise.all([
    this.prismaService.user.count({ where: { deletedAt: null } }),
    this.prismaService.user.findMany({
      where: { deletedAt: null },
      skip, take,
      include: { role: true },
    }),
  ])

  return { data, totalItems, page: pagination.page, limit: pagination.limit,
           totalPages: Math.ceil(totalItems / pagination.limit) } as any
}
// Pattern này được dùng ở: UserRepo, RoleRepo, PermissionRepo,
// BrandRepo, VoucherRepo, AddressRepo, ConversationRepo...
```

#### Khi nào PHẢI dùng Sequential?

```typescript
// src/routes/order/order.service.ts — Sequential vì CÓ PHỤ THUỘC
async create(userId: number, body: CreateOrderBodyType) {
  // Bước 1: Validate cart items → CẦN kết quả này cho bước 2
  const { cartItems, cartItemMap } = await this.orderRepo.fetchAndValidateCartItems(userId, body)

  // Bước 2: Tính discount → CẦN cartItemMap từ bước 1
  const ordersWithCalculations = await this.calculateOrderDiscounts(body, cartItemMap)

  // Bước 3: Tạo order → CẦN kết quả từ bước 1 + 2
  const result = await this.orderRepo.create(userId, body, cartItems, ordersWithCalculations)

  return result
}
// → PHẢI sequential vì mỗi bước phụ thuộc kết quả bước trước!
```

#### Promise API — Chọn đúng tool

```
┌──────────────────┬──────────────────────────────────────────────┐
│ API              │ Hành vi                                       │
├──────────────────┼──────────────────────────────────────────────┤
│ Promise.all()    │ Chạy song song, FAIL NGAY khi 1 cái reject  │
│                  │ → Dùng khi cần TẤT CẢ thành công            │
│                  │                                               │
│ Promise.allSettled() │ Chạy song song, CHỜ TẤT CẢ xong        │
│                  │ → Dùng khi cần biết trạng thái từng cái     │
│                  │                                               │
│ Promise.race()   │ Trả về cái XONG ĐẦU TIÊN (dù success/fail) │
│                  │ → Dùng cho timeout pattern                   │
│                  │                                               │
│ Promise.any()    │ Trả về cái THÀNH CÔNG ĐẦU TIÊN              │
│                  │ → Dùng cho fallback servers                  │
└──────────────────┴──────────────────────────────────────────────┘
```

### 2.5 Common Pitfalls Trong NestJS

#### Pitfall 1: await trong vòng lặp (N+1 Problem)

```typescript
// ❌ BAD: N+1 queries — mỗi iteration chờ cái trước xong
async function getOrdersWithDetails(orderIds: number[]) {
  const results = []
  for (const id of orderIds) {
    const order = await orderRepo.findById(id)  // Chạy tuần tự!
    results.push(order)
  }
  return results  // 100 orders → 100 queries tuần tự → RẤT CHẬM
}

// ✅ GOOD: Batch query hoặc Promise.all
async function getOrdersWithDetails(orderIds: number[]) {
  // Cách 1: Batch query (tốt nhất — 1 query duy nhất)
  return prisma.order.findMany({ where: { id: { in: orderIds } } })

  // Cách 2: Promise.all (nếu không có batch API)
  return Promise.all(orderIds.map(id => orderRepo.findById(id)))
}
```

#### Pitfall 2: Quên await — Promise bị "trôi"

```typescript
// ❌ BAD: Quên await → lỗi không được catch, data không đúng
@Injectable()
export class UserService {
  async deleteUser(userId: number) {
    this.userRepo.softDelete(userId)  // ← QUÊN AWAIT!
    // → Promise chạy ngầm, không biết thành công hay thất bại
    // → Hàm return trước khi delete xong
    // → Nếu delete fail → UnhandledPromiseRejection!
  }
}

// ✅ GOOD: Luôn await hoặc return Promise
async deleteUser(userId: number) {
  await this.userRepo.softDelete(userId)  // ← Có await
}
// Hoặc:
deleteUser(userId: number) {
  return this.userRepo.softDelete(userId)  // ← Return promise
}
```

#### Pitfall 3: try/catch không đúng chỗ

```typescript
// ❌ BAD: catch quá rộng — nuốt hết lỗi
async createUser(data: CreateUserBodyType) {
  try {
    const user = await this.userRepo.create(data)
    await this.emailService.sendWelcome(user.email)
    return user
  } catch (error) {
    console.log('Something went wrong')  // ← Nuốt lỗi!
    return null  // ← Caller không biết lỗi gì
  }
}

// ✅ GOOD: Catch cụ thể, re-throw khi cần
// src/routes/user/user.service.ts (pattern thực tế trong dự án)
async createUser({ data, createdById, createdByRoleName }) {
  try {
    return await this.userRepo.create({ data, createdById })
  } catch (error) {
    if (isUniqueConstraintPrismaError(error)) {
      throw UserAlreadyExistsException  // ← Business error cụ thể
    }
    throw error  // ← Re-throw lỗi không mong đợi
  }
}
```

#### Pitfall 4: Blocking Event Loop với CPU-intensive code

```typescript
// ❌ BAD: JSON.parse file lớn trên main thread
async processLargeFile() {
  const data = await readFile('huge-data.json')
  const parsed = JSON.parse(data.toString())  // ← BLOCK nếu file 100MB!
  return parsed
}

// ✅ GOOD: Dùng Worker Thread cho CPU-intensive tasks
// Hoặc stream cho file lớn
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

async processLargeFile() {
  const stream = createReadStream('huge-data.json')
  // Xử lý từng chunk, không block Event Loop
}
```

#### Pitfall 5: Controller return Promise mà không await

```typescript
// 💡 Trong NestJS, cả 2 cách đều OK:

// Cách 1: return trực tiếp (NestJS tự await)
@Get()
getListUser(@Query() query: GetUsersQueryDTO) {
  return this.userService.getListUser(query)  // ← NestJS tự resolve Promise
}

// Cách 2: async/await (tường minh hơn)
@Get()
async getListUser(@Query() query: GetUsersQueryDTO) {
  return await this.userService.getListUser(query)
}

// ⚠️ Cách 1 tốt hơn vì:
// - Ít overhead hơn (không tạo thêm microtask)
// - Code ngắn gọn hơn
// - Dự án này dùng cách 1 ở hầu hết controllers
```

#### Tóm tắt Best Practices

```
┌─────────────────────────────────────────────────────────────────┐
│  ASYNC/AWAIT BEST PRACTICES TRONG NESTJS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ DO:                                                         │
│  • Dùng Promise.all() cho tác vụ độc lập (pagination, uploads) │
│  • Luôn await hoặc return Promise (không để "trôi")             │
│  • Catch lỗi cụ thể, re-throw lỗi không mong đợi              │
│  • Dùng async API thay vì sync (readFile vs readFileSync)       │
│  • Stream cho file/data lớn                                     │
│                                                                 │
│  ❌ DON'T:                                                      │
│  • await trong vòng lặp (dùng Promise.all hoặc batch query)    │
│  • Quên await (UnhandledPromiseRejection)                       │
│  • CPU-intensive code trên main thread (dùng Worker Threads)    │
│  • catch quá rộng nuốt hết lỗi                                 │
│  • readFileSync, pbkdf2Sync trong server code                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 📖 **Deep dive**: Xem [ZZ_36 - Blocking vs Non-Blocking chi tiết](./ZZ_36_BLOCKING_VS_NON_BLOCKING_NODEJS_CHI_TIET.md) và [ZZ_81 - Event Loop & Async Performance](./ZZ_81_EVENT_LOOP_ASYNC_PERFORMANCE_DEEP_DIVE.md) để tìm hiểu sâu hơn về Event Loop phases, libuv Thread Pool, và performance optimization patterns.

---

## PHẦN 3: TypeScript Advanced Types — Generics, Union, Intersection, Type Narrowing

### 3.1 Generics — Tái Sử Dụng Code Với Type Safety

#### Khái niệm cơ bản

Generic = "type parameter" — cho phép viết code 1 lần, dùng cho nhiều types. Thay vì viết nhiều function cho từng type, ta viết 1 function với "placeholder type" (thường là `T`).

```
┌─────────────────────────────────────────────────────────────────┐
│  Generic = "Khuôn mẫu" có thể điền type vào                     │
│                                                                 │
│  Array<T>:                                                      │
│    Array<number>   → [1, 2, 3]                                  │
│    Array<string>   → ["a", "b", "c"]                            │
│    Array<UserType> → [{ id: 1, email: "..." }, ...]             │
│                                                                 │
│  Promise<T>:                                                    │
│    Promise<UserType>   → resolve với UserType                   │
│    Promise<void>       → resolve không trả gì                   │
│    Promise<string[]>   → resolve với mảng string                │
│                                                                 │
│  z.infer<T>:                                                    │
│    z.infer<typeof UserSchema>    → UserType                     │
│    z.infer<typeof ProductSchema> → ProductType                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Zod Schema Inference (pattern dùng KHẮP dự án)

```typescript
// ✅ Pattern dùng ở mọi model file trong dự án
// src/shared/models/shared-user.model.ts
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  roleId: z.number().positive(),
})

export type UserType = z.infer<typeof UserSchema>
// z.infer<T> là Generic! T = typeof UserSchema
// → TypeScript tự suy ra UserType = { id: number; email: string; name: string; roleId: number }
```

#### PrismaService.transactionWithTimeout (Generic function)

```typescript
// src/shared/services/prisma.service.ts
async transactionWithTimeout<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  // T có thể là bất kỳ type nào — tùy vào fn trả về gì
  return await this.$transaction(fn, {
    timeout: options?.timeout || 30000,
    maxWait: options?.maxWait || 10000,
  })
}

// ✅ Sử dụng — TypeScript tự suy ra type từ Generic:
const result = await prisma.transactionWithTimeout<Order>(async (tx) => {
  return tx.order.create({ data: orderData })
})
// → result có type Order (TypeScript biết nhờ Generic T)

// ✅ Hoặc để TypeScript tự infer:
const user = await prisma.transactionWithTimeout(async (tx) => {
  return tx.user.findUnique({ where: { id: 1 } })
})
// → user có type User | null (TypeScript tự suy từ return type của fn)
```

#### createZodDto Generic (NestJS-Zod integration)

```typescript
// nestjs-zod library định nghĩa:
export function createZodDto<T extends ZodType>(schema: T) { ... }

// ✅ Dự án dùng:
export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}
// T = typeof CreateUserBodySchema → DTO tự có validation + type safety

// ❌ Không dùng Generic — phải viết lại cho mỗi schema:
export class CreateUserBodyDTO { /* manual validation */ }
export class CreateProductBodyDTO { /* manual validation */ }
// → Lặp code, dễ sai, không type-safe
```

---

### 3.2 Union Types — "Hoặc Cái Này Hoặc Cái Kia"

#### Khái niệm

`A | B` = giá trị có thể là type A **HOẶC** type B. Union cho phép một biến chấp nhận nhiều types khác nhau.

#### Status Enums (dùng khắp dự án)

```typescript
// src/shared/constants/auth.constant.ts
export const AuthType = {
  Bearer: 'Bearer',
  None: 'None',
  PaymentAPIKey: 'PaymentAPIKey',
} as const

export type AuthTypeType = (typeof AuthType)[keyof typeof AuthType]
// → 'Bearer' | 'None' | 'PaymentAPIKey'  (Union of string literals)

// ✅ Sử dụng:
function authenticate(type: AuthTypeType) {
  // type chỉ có thể là 1 trong 3 giá trị trên
}
authenticate('Bearer')     // ✅ OK
authenticate('Invalid')    // ❌ TypeScript error!
```

#### Zod Enum (Union under the hood)

```typescript
// src/shared/models/shared-order.model.ts
export const OrderStatusSchema = z.enum([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PENDING_PICKUP,
  OrderStatus.PENDING_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.RETURNED,
  OrderStatus.CANCELLED,
])

// Inferred type: 'PENDING_PAYMENT' | 'PENDING_PICKUP' | ... (Union!)
type OrderStatusType = z.infer<typeof OrderStatusSchema>
```

#### Nullable types (Union with null)

```typescript
// Prisma schema: deletedAt DateTime?
// → TypeScript: deletedAt: Date | null  (Union!)

// Zod equivalents:
z.string().nullable()   // → string | null
z.number().optional()   // → number | undefined
z.string().nullish()    // → string | null | undefined

// ✅ Ví dụ thực tế trong dự án:
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  deletedAt: z.date().nullable(),  // Date | null
  totpSecret: z.string().nullable(),  // string | null
})
```

---

### 3.3 Intersection Types — "Kết Hợp Tất Cả"

#### Khái niệm

`A & B` = giá trị **PHẢI** có **TẤT CẢ** properties của cả A và B. Intersection dùng để "merge" nhiều types lại với nhau.

```
┌─────────────────────────────────────────────────────────────────┐
│  Union (|) vs Intersection (&):                                 │
│                                                                 │
│  Union: A | B = "A HOẶC B"                                      │
│    string | number → có thể là "hello" hoặc 42                  │
│    UserType | null → có thể là user object hoặc null            │
│                                                                 │
│  Intersection: A & B = "A VÀ B"                                 │
│    UserType & { role: RoleType } → user object + thêm field role│
│    BaseEntity & AuditFields → có cả base fields + audit fields  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### User with Role and Permissions

```typescript
// src/shared/repositories/shared-user.repo.ts
export type UserIncludeRolePermissionsType =
  UserType & { role: RoleType & { permissions: PermissionType[] } }

// ✅ Kết quả: object có TẤT CẢ fields của UserType
//    + thêm field role (cũng là intersection: RoleType + permissions)

// Ví dụ giá trị:
const user: UserIncludeRolePermissionsType = {
  // Từ UserType:
  id: 1,
  email: 'admin@example.com',
  name: 'Admin',
  roleId: 1,
  // Từ Intersection:
  role: {
    // Từ RoleType:
    id: 1,
    name: 'Admin',
    // Từ { permissions: ... }:
    permissions: [{ id: 1, name: 'user:create', ... }]
  }
}
```

#### Zod .extend() (tương đương Intersection)

```typescript
// src/shared/models/shared-role.model.ts
export const RolePermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema),
})

// ✅ Kết quả: RoleType + { permissions: PermissionType[] }
// Giống: RoleType & { permissions: PermissionType[] }

export type RolePermissionsType = z.infer<typeof RolePermissionsSchema>
```

---

### 3.4 Type Narrowing — Thu Hẹp Kiểu Dữ Liệu

#### Khái niệm

TypeScript bắt đầu với type rộng → thu hẹp dần qua các checks. Sau mỗi check, TypeScript "biết" type cụ thể hơn.

```
┌─────────────────────────────────────────────────────────────────┐
│  Type Narrowing Flow:                                           │
│                                                                 │
│  error: any                                                     │
│    │                                                            │
│    ├── if (isUniqueConstraintPrismaError(error))                │
│    │     → error: PrismaClientKnownRequestError  (thu hẹp!)     │
│    │                                                            │
│    ├── else if (error instanceof PrismaClientUnknownRequestError)│
│    │     → error: PrismaClientUnknownRequestError  (thu hẹp!)   │
│    │                                                            │
│    └── else                                                     │
│          → error: any  (không thu hẹp được)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Custom Type Guards (pattern quan trọng nhất trong dự án)

```typescript
// src/shared/helpers.ts — Type Predicate (is keyword)
export function isUniqueConstraintPrismaError(
  error: any
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export function isNotFoundPrismaError(
  error: any
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

// ✅ Sử dụng — TypeScript tự thu hẹp type sau if:
try {
  await this.userRepo.create(data)
} catch (error) {
  // error: any (type rộng)
  if (isUniqueConstraintPrismaError(error)) {
    // error: Prisma.PrismaClientKnownRequestError (type hẹp!)
    // → TypeScript biết error có .code, .meta, .message
    throw UserAlreadyExistsException
  }
  throw error  // error vẫn là any ở đây
}
```

#### instanceof narrowing

```typescript
// src/shared/services/prisma.service.ts
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // ✅ TypeScript biết error có .code
    this.logger.error(`Transaction failed with code ${error.code}: ${error.message}`)
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // ✅ TypeScript biết error có .message
    this.logger.error(`Unknown transaction error: ${error.message}`)
  } else {
    // error: unknown — không biết type cụ thể
    this.logger.error('Transaction failed', error)
  }
  throw error
}
```

#### Truthiness narrowing

```typescript
// src/routes/order/order.service.ts
if (voucherId) {
  // ✅ voucherId: number (đã loại bỏ null/undefined)
  const voucherResult = await this.voucherRepository.findById(voucherId)

  if (voucherResult) {
    // ✅ voucherResult: VoucherType (đã loại bỏ null)
    if (voucherResult.type === 'PERCENTAGE') {
      // Áp dụng giảm giá theo phần trăm
    }
  }
}

// ❌ Không check — TypeScript báo lỗi:
const voucher = await this.voucherRepository.findById(voucherId)
voucher.type  // Error: voucher có thể là null!
```

---

### 3.5 Utility Types Thường Dùng Trong NestJS

#### Bảng tổng hợp

| Utility Type | Ý nghĩa | Ví dụ từ dự án |
|---|---|---|
| `Pick<T, K>` | Chọn một số fields | `Pick<UserType, 'email' \| 'name'>` |
| `Omit<T, K>` | Bỏ một số fields | `Omit<UserType, 'password' \| 'totpSecret'>` |
| `Partial<T>` | Tất cả fields optional | `Partial<UserType>` cho update operations |
| `Required<T>` | Tất cả fields required | `Required<Partial<UserType>>` |
| `Record<K, V>` | Object với key type K, value type V | `Record<string, CanActivate>` cho guard map |
| `ReturnType<T>` | Lấy return type của function | `ReturnType<typeof createZodDto>` |

#### TypeScript Utility Types vs Zod Methods

```typescript
// ✅ TypeScript Utility Types vs Zod Methods — tương đương nhau:
// Pick<UserType, 'email' | 'name'>  ↔  UserSchema.pick({ email: true, name: true })
// Omit<UserType, 'password'>        ↔  UserSchema.omit({ password: true })
// Partial<UserType>                 ↔  UserSchema.partial()

// ✅ Ví dụ thực tế trong dự án:
// src/routes/user/user.model.ts
export const CreateUserResSchema = UserSchema.omit({
  password: true,
  totpSecret: true,
})
export type CreateUserResType = z.infer<typeof CreateUserResSchema>
// → Tương đương: Omit<UserType, 'password' | 'totpSecret'>

// ✅ Pick — chọn fields cần thiết:
export const UserPublicSchema = UserSchema.pick({
  id: true,
  name: true,
  avatar: true,
})
// → Tương đương: Pick<UserType, 'id' | 'name' | 'avatar'>

// ✅ Partial — cho update operations:
export const UpdateUserBodySchema = CreateUserBodySchema.partial()
// → Tất cả fields trở thành optional
```

#### Record type trong dự án

```typescript
// src/routes/auth/guards/authentication.guard.ts
private readonly authTypeGuardMap: Record<string, CanActivate | CanActivate[]> = {
  [AuthType.Bearer]: this.accessTokenGuard,
  [AuthType.None]: { canActivate: () => true },
  [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
}

// Record<string, CanActivate | CanActivate[]> nghĩa là:
// - Key: string (tên auth type)
// - Value: CanActivate hoặc mảng CanActivate
```

> 📖 **Deep dive**: Xem TypeScript Handbook — [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html), [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). Dự án này dùng Zod schemas thay vì TypeScript interfaces thuần túy — xem [ZZ_30 - Prisma Schema](./ZZ_30_PRIORITY_GIAI_THICH_CHI_TIET_SCHEMA_PRISMA.md) để hiểu cách Zod + Prisma tạo type safety end-to-end.


---

## PHẦN 4: SQL & ORM Concepts — Entity, Relation, Transaction

### 4.1 Entity — Bảng Dữ Liệu Trong Code

**Entity = Bảng trong database, được biểu diễn bằng code**. Thay vì viết SQL thủ công, ta định nghĩa cấu trúc bảng bằng code và ORM sẽ tự động tạo/quản lý bảng.

#### Prisma Model vs SQL Table

```prisma
// prisma/schema.prisma — Entity "User"
model User {
  id          Int        @id @default(autoincrement())  // PRIMARY KEY, auto-increment
  email       String                                     // VARCHAR
  name        String     @db.VarChar(500)                // VARCHAR(500)
  password    String                                     // VARCHAR
  phoneNumber String                                     // VARCHAR
  avatar      String?                                    // VARCHAR, NULLABLE
  totpSecret  String?                                    // VARCHAR, NULLABLE
  status      UserStatus @default(INACTIVE)              // ENUM, default INACTIVE
  roleId      Int                                        // FOREIGN KEY → Role

  // Audit trail (mọi entity trong dự án đều có)
  createdById Int?
  updatedById Int?
  deletedById Int?
  createdAt   DateTime   @default(now())                 // DEFAULT NOW()
  updatedAt   DateTime   @updatedAt                      // AUTO UPDATE
  deletedAt   DateTime?                                  // SOFT DELETE

  // Relations
  role        Role       @relation(fields: [roleId], references: [id], onDelete: NoAction)

  @@index([deletedAt])                                   // INDEX cho soft delete filter
}
```

#### SQL tương đương

```sql
CREATE TABLE "User" (
  "id"          SERIAL PRIMARY KEY,
  "email"       VARCHAR NOT NULL,
  "name"        VARCHAR(500) NOT NULL,
  "password"    VARCHAR NOT NULL,
  "status"      "UserStatus" DEFAULT 'INACTIVE',
  "roleId"      INTEGER NOT NULL REFERENCES "Role"("id"),
  "createdAt"   TIMESTAMP DEFAULT NOW(),
  "updatedAt"   TIMESTAMP,
  "deletedAt"   TIMESTAMP
);
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
```

#### TypeORM style (so sánh)

```typescript
// TypeORM style (so sánh)
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  email: string

  @Column({ type: 'varchar', length: 500 })
  name: string

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INACTIVE })
  status: UserStatus

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'roleId' })
  role: Role

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt: Date | null
}
```

### 4.2 Relation Types — OneToOne, OneToMany, ManyToMany

Có 4 loại quan hệ chính trong database. Dự án này sử dụng Prisma để định nghĩa relations.

#### OneToMany (1-N) — Phổ biến nhất

```prisma
// 1 User có nhiều Address
model User {
  id        Int       @id @default(autoincrement())
  addresses Address[] @relation("UserAddresses")
}

model Address {
  id     Int  @id @default(autoincrement())
  userId Int
  user   User @relation("UserAddresses", fields: [userId], references: [id])
  @@index([userId])
}
```

#### ManyToMany (N-N) — Implicit join table

```prisma
// Role ↔ Permission (nhiều-nhiều)
model Role {
  id          Int          @id @default(autoincrement())
  permissions Permission[] @relation("PermissionToRole")
}

model Permission {
  id    Int    @id @default(autoincrement())
  roles Role[] @relation("PermissionToRole")
}
// Prisma tự tạo bảng trung gian _PermissionToRole
```

#### Self-Referencing — Tree structure

```prisma
// Category tự tham chiếu chính nó (cây danh mục)
model Category {
  id                 Int        @id @default(autoincrement())
  parentCategoryId   Int?
  parentCategory     Category?  @relation("ParentCategoryCategories",
                                         fields: [parentCategoryId], references: [id])
  childrenCategories Category[] @relation("ParentCategoryCategories")
}
```

#### Sơ đồ quan hệ

```
RELATION TYPES:

OneToMany (1-N):
  User ──────< Address
  1 user có nhiều addresses
  Address có userId (FK) trỏ về User

ManyToMany (N-N):
  Role >──────< Permission
  1 role có nhiều permissions
  1 permission thuộc nhiều roles
  → Bảng trung gian: _PermissionToRole

Self-Referencing:
  Category ──┐
       ↑     │
       └─────┘
  parentCategoryId trỏ về chính Category
  → Tạo cây: Electronics → Phones → iPhone
```

### 4.3 Transaction — Đảm Bảo Tính Toàn Vẹn Dữ Liệu

**Transaction = nhóm operations phải THÀNH CÔNG HẾT hoặc THẤT BẠI HẾT**. Nếu 1 operation fail, tất cả đều rollback về trạng thái ban đầu.

#### ACID Properties

```
A - Atomicity:  Tất cả hoặc không gì cả
C - Consistency: Dữ liệu luôn hợp lệ
I - Isolation:  Transactions không ảnh hưởng nhau
D - Durability: Dữ liệu đã commit không mất
```

#### Interactive Transaction (phổ biến nhất)

```typescript
// src/shared/repositories/shared-payment.repo.ts
async completePayment(paymentId: number, orderId: number) {
  return this.prismaService.$transaction(async (tx) => {
    // Tất cả operations dùng `tx` thay vì `prismaService`
    // Nếu BẤT KỲ operation nào fail → ROLLBACK TẤT CẢ

    // 1. Update order status
    await tx.order.updateMany({
      where: { id: orderId },
      data: { status: 'PENDING_PICKUP' },
    })

    // 2. Giảm stock cho từng SKU
    await Promise.all(
      skuUpdates.map(sku => tx.sKU.update({
        where: { id: sku.id },
        data: { stock: { decrement: sku.quantity } },
      }))
    )

    // 3. Update payment status
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'COMPLETED' },
    })

    // Nếu đến đây không lỗi → COMMIT tất cả
    // Nếu bất kỳ await nào throw → ROLLBACK tất cả
  })
}
```

#### Sequential Transaction (batch operations)

```typescript
// src/routes/voucher/voucher.repo.ts
await this.prismaService.$transaction([
  // Array syntax: chạy tuần tự, rollback nếu 1 cái fail
  this.prismaService.voucher.update({
    where: { id: voucherId },
    data: { usedCount: { increment: 1 } },
  }),
  this.prismaService.userVoucher.update({
    where: { userId_voucherId: { userId, voucherId } },
    data: { usedCount: { increment: 1 }, usedAt: new Date() },
  }),
])
```

#### Transaction with Timeout (custom helper)

```typescript
// src/shared/services/prisma.service.ts
async transactionWithTimeout<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  const timeout = options?.timeout || 30000   // 30s timeout
  const maxWait = options?.maxWait || 10000   // 10s max wait for lock
  return await this.$transaction(fn, { timeout, maxWait })
}
```

#### Transaction Flow Diagram

```
TRANSACTION FLOW:

BEGIN TRANSACTION
  │
  ├── ✅ Update Order → success
  ├── ✅ Update SKU stock → success
  ├── ❌ Update Payment → FAIL!
  │
  └── ROLLBACK! ← Tất cả changes bị hủy
      Order: vẫn như cũ
      SKU stock: vẫn như cũ
      Payment: vẫn như cũ

vs. Không có Transaction:
  ├── ✅ Update Order → đã lưu vào DB
  ├── ✅ Update SKU stock → đã lưu vào DB
  ├── ❌ Update Payment → FAIL!
  │
  └── 💥 DỮ LIỆU KHÔNG NHẤT QUÁN!
      Order: đã thay đổi (sai!)
      SKU stock: đã giảm (sai!)
      Payment: chưa update
```

### 4.4 TypeORM vs Prisma — So Sánh Cách Tiếp Cận

```
┌──────────────────┬──────────────────────────┬──────────────────────────┐
│ Tiêu chí         │ TypeORM                  │ Prisma (dự án này)       │
├──────────────────┼──────────────────────────┼──────────────────────────┤
│ Định nghĩa Model │ Decorators (@Entity,     │ Schema file              │
│                  │ @Column, @ManyToOne)     │ (prisma/schema.prisma)   │
│                  │                          │                          │
│ Type Safety      │ Trung bình (runtime)     │ Cao (generated types)    │
│                  │                          │                          │
│ Query Builder    │ QueryBuilder + Raw SQL   │ Prisma Client (type-safe)│
│                  │                          │                          │
│ Migration        │ Auto-generate hoặc manual│ prisma migrate dev       │
│                  │                          │                          │
│ Relations        │ Decorators               │ Schema relations         │
│                  │ (@OneToMany, @ManyToMany)│ (fields, references)     │
│                  │                          │                          │
│ Transaction      │ EntityManager hoặc       │ $transaction() callback  │
│                  │ QueryRunner              │ hoặc array syntax        │
│                  │                          │                          │
│ Validation       │ class-validator          │ Zod schemas              │
│                  │                          │                          │
│ Pattern          │ Active Record hoặc       │ Data Mapper              │
│                  │ Data Mapper              │ (Repository pattern)     │
└──────────────────┴──────────────────────────┴──────────────────────────┘
```

### 4.5 Migration & Schema Management

Migration là cách quản lý thay đổi cấu trúc database theo thời gian, giúp đồng bộ schema giữa các môi trường (dev, staging, production).

```
Prisma Migration Workflow:

1. Sửa schema.prisma
   model User {
     + avatar String?    ← Thêm field mới
   }

2. Tạo migration
   $ npx prisma migrate dev --name add-user-avatar
   → Tạo file: prisma/migrations/20250101_add_user_avatar/migration.sql
   → Nội dung: ALTER TABLE "User" ADD COLUMN "avatar" VARCHAR;

3. Apply migration
   $ npx prisma migrate deploy    (production)
   $ npx prisma migrate dev       (development — tự apply)

4. Generate Prisma Client
   $ npx prisma generate
   → Update node_modules/.prisma/client
   → TypeScript types tự động cập nhật
```

> 📖 **Deep dive**: Xem [ZZ_21 - ACID & Transaction chuyên sâu](./ZZ_21_ACID_VA_ISOLATE_CHUYEN_SAU_CHI_TIET.md) để hiểu Isolation Levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable). Xem [ZZ_30 - Prisma Schema chi tiết](./ZZ_30_PRIORITY_GIAI_THICH_CHI_TIET_SCHEMA_PRISMA.md) để hiểu toàn bộ schema design của dự án.

---

## PHẦN 5: Tổng Kết & Cross-References

### Kiến Thức Cốt Lõi — Tóm Tắt 1 Trang

```
┌─────────────────────────────────────────────────────────────────┐
│          BACKEND NESTJS CORE KNOWLEDGE — TÓM TẮT                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📦 PHẦN 1: DEPENDENCY INJECTION                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ • DI = inject dependencies từ bên ngoài (loose coupling)│    │
│  │ • Module = đơn vị tổ chức (providers, controllers,     │     │
│  │   imports, exports)                                     │     │
│  │ • @Global() SharedModule → dùng chung PrismaService,   │     │
│  │   HashingService, TokenService...                       │     │
│  │ • Scope: DEFAULT (99%), REQUEST (per-request),          │     │
│  │   TRANSIENT (per-inject)                                │     │
│  │ • Custom Providers: useClass, useValue, useFactory,     │     │
│  │   useExisting                                           │     │
│  │ • Circular Deps → Shared Pattern hoặc Event-Driven     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ⚡ PHẦN 2: BLOCKING / NON-BLOCKING                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ • Node.js = 1 thread → blocking = server chết          │     │
│  │ • async/await = syntax sugar cho Promise                │     │
│  │ • Event Loop: Call Stack → Microtasks → Macrotasks      │     │
│  │ • Promise.all() cho tác vụ độc lập (pagination, upload) │    │
│  │ • Sequential await khi có dependency chain (order flow) │     │
│  │ • Pitfalls: await trong loop, quên await, catch rộng   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  🔷 PHẦN 3: TYPESCRIPT ADVANCED TYPES                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ • Generics: z.infer<T>, Promise<T>,                    │     │
│  │   transactionWithTimeout<T>                             │     │
│  │ • Union: 'A' | 'B' | 'C' (enums, nullable, status)    │     │
│  │ • Intersection: A & B (UserType & { role: RoleType })  │     │
│  │ • Type Narrowing: type guards (is keyword), instanceof │     │
│  │ • Utility: Pick, Omit, Partial, Record ↔ Zod methods  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  🗄️ PHẦN 4: SQL & ORM CONCEPTS                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ • Entity = Model = Bảng (Prisma schema → SQL table)    │     │
│  │ • Relations: 1-N, N-N, Self-referencing                │     │
│  │ • Transaction: ACID, $transaction() callback/array     │     │
│  │ • Prisma vs TypeORM: Schema-first vs Decorator-based   │     │
│  │ • Migration: prisma migrate dev → auto SQL generation  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cross-References — Tài Liệu Liên Quan

| Chủ đề | Tài liệu | Mô tả |
|---|---|---|
| DI & IoC chi tiết | [ZZ_8](./ZZ_8_DEPENDENCY_INJECTION_VA_IOC_TRONG_NESTJS.md) | Abstract Class Tokens, Injection Tokens, DI patterns |
| Blocking vs Non-Blocking | [ZZ_36](./ZZ_36_BLOCKING_VS_NON_BLOCKING_NODEJS_CHI_TIET.md) | Libuv, Thread Pool, Best Practices chi tiết |
| Event Loop Deep Dive | [ZZ_81](./ZZ_81_EVENT_LOOP_ASYNC_PERFORMANCE_DEEP_DIVE.md) | 6 phases, microtask/macrotask, V8 memory, performance |
| ACID & Transaction | [ZZ_21](./ZZ_21_ACID_VA_ISOLATE_CHUYEN_SAU_CHI_TIET.md) | Isolation Levels, Deadlock, Optimistic/Pessimistic Locking |
| Prisma Schema | [ZZ_30](./ZZ_30_PRIORITY_GIAI_THICH_CHI_TIET_SCHEMA_PRISMA.md) | Toàn bộ schema design, indexes, relations |
| Clean Architecture | [ZZ_11](./ZZ_11_CLEAN_ARCHITECTURE_TRONG_NESTJS.md) | Layered architecture, separation of concerns |
| Error Handling | [ZZ_48](./ZZ_48_ERROR_HANDLING_SYSTEM_ANALYSIS.md) | Exception filters, domain errors, Prisma error handling |
| Interview Questions | [ZZ_25](./ZZ_25_NESTJS_INTERVIEW_COMPLETE_GUIDE.md) | Tổng hợp câu hỏi phỏng vấn NestJS |
| Chat Dependency Resolution | [ZZ_52.9](./ZZ_52.9_CHAT_DEPENDENCY_RESOLUTION_FINAL.md) | Case study giải quyết circular dependency |
| Closure trong NestJS | [ZZ_82](./ZZ_82_CLOSURE_JAVASCRIPT_TRONG_NESTJS_PROJECT.md) | Closure patterns: useFactory, decorators, guards |
| Performance Optimization | [ZZ_58](./ZZ_58_QUAN_TRỌNG_CẢI_THIỆN_PERFORMANCE_OPTIMIZATION_ANALYSIS_2025.md) | N+1 queries, caching, database optimization |

### Lộ Trình Học Tập Đề Xuất

```
Beginner → Intermediate → Advanced:

① Bắt đầu:
   DI & Module (Phần 1) → Blocking/Non-blocking (Phần 2)
   → Hiểu cách NestJS tổ chức code và xử lý async

② Nâng cao:
   TypeScript Types (Phần 3) → SQL & ORM (Phần 4)
   → Viết code type-safe và hiểu database operations

③ Chuyên sâu:
   ZZ_81 (Event Loop) → ZZ_21 (ACID) → ZZ_11 (Clean Architecture)
   → Hiểu internals và thiết kế hệ thống

④ Phỏng vấn:
   ZZ_25 (Interview Guide) → ZZ_13 (Câu hỏi tổng hợp)
   → Chuẩn bị cho phỏng vấn Backend NestJS
```

---

**Tài liệu này được tạo dựa trên dự án NestJS Ecommerce API thực tế. Mọi code examples đều lấy từ codebase.**

**Last Updated**: 2025-03-04
**Version**: 1.0.0