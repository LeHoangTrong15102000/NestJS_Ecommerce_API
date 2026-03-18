# Phân Tích Toàn Bộ Design Patterns Trong NestJS Ecommerce API

> Tài liệu phân tích chi tiết tất cả các Design Patterns được sử dụng trong hệ thống NestJS Ecommerce API, kèm code minh họa thực tế từ source code.

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Creational Patterns (Nhóm Khởi Tạo)](#2-creational-patterns-nhóm-khởi-tạo)
   - 2.1 [Singleton Pattern](#21-singleton-pattern)
   - 2.2 [Factory Pattern](#22-factory-pattern)
   - 2.3 [Dependency Injection Pattern](#23-dependency-injection-pattern)
3. [Structural Patterns (Nhóm Cấu Trúc)](#3-structural-patterns-nhóm-cấu-trúc)
   - 3.1 [Adapter Pattern](#31-adapter-pattern)
   - 3.2 [Decorator Pattern](#32-decorator-pattern)
   - 3.3 [Proxy Pattern](#33-proxy-pattern)
   - 3.4 [Facade Pattern](#34-facade-pattern)
   - 3.5 [Repository Pattern](#35-repository-pattern)
   - 3.6 [Module Pattern](#36-module-pattern)
4. [Behavioral Patterns (Nhóm Hành Vi)](#4-behavioral-patterns-nhóm-hành-vi)
   - 4.1 [Strategy Pattern](#41-strategy-pattern)
   - 4.2 [Chain of Responsibility Pattern](#42-chain-of-responsibility-pattern)
   - 4.3 [Observer / Pub-Sub Pattern](#43-observer--pub-sub-pattern)
   - 4.4 [Template Method Pattern](#44-template-method-pattern)
   - 4.5 [Mediator Pattern](#45-mediator-pattern)
   - 4.6 [Command / Handler Pattern](#46-command--handler-pattern)
5. [Enterprise & Concurrency Patterns](#5-enterprise--concurrency-patterns)
   - 5.1 [Producer-Consumer Pattern (Message Queue)](#51-producer-consumer-pattern-message-queue)
   - 5.2 [Scheduled Task / Cron Pattern](#52-scheduled-task--cron-pattern)
   - 5.3 [Cache-Aside Pattern](#53-cache-aside-pattern)
   - 5.4 [Token Bucket Rate Limiting Pattern](#54-token-bucket-rate-limiting-pattern)
   - 5.5 [Gateway Pattern](#55-gateway-pattern)
   - 5.6 [Global Module Pattern](#56-global-module-pattern)
   - 5.7 [DTO (Data Transfer Object) Pattern](#57-dto-data-transfer-object-pattern)
   - 5.8 [Lifecycle Hook Pattern](#58-lifecycle-hook-pattern)
6. [Sơ Đồ Tổng Hợp](#6-sơ-đồ-tổng-hợp)
7. [Câu Hỏi & Gợi Ý Tiếp Theo](#7-câu-hỏi--gợi-ý-tiếp-theo)

---

## 1. Tổng Quan Kiến Trúc

Hệ thống NestJS Ecommerce API được xây dựng theo kiến trúc **Layered Architecture (N-Tier)** kết hợp **Modular Architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser/App)                  │
├─────────────────────────────────────────────────────────┤
│  Guards → Interceptors → Pipes → Controllers → Filters  │  ← Request Pipeline
├─────────────────────────────────────────────────────────┤
│                    Service Layer                         │  ← Business Logic
├─────────────────────────────────────────────────────────┤
│                   Repository Layer                       │  ← Data Access
├─────────────────────────────────────────────────────────┤
│              Prisma ORM + PostgreSQL + Redis             │  ← Persistence
└─────────────────────────────────────────────────────────┘
```

**Thống kê source code:**
- 33 Module files | 38 Service files | 29 Controller files
- 26 Repository files | 27 DTO files | 36 Model files
- 4 Guard files | 8 Decorator files | 3 Interceptor files
- 2 Filter files | 2 Pipe files | 3 Gateway files
- 4 Handler files | 3 Producer files | 2 Consumer files | 2 Cronjob files

---

## 2. Creational Patterns (Nhóm Khởi Tạo)

### 2.1 Singleton Pattern

**Khái niệm:** Đảm bảo một class chỉ có duy nhất một instance trong toàn bộ ứng dụng.

**Vị trí:** Tất cả các service được đánh dấu `@Injectable()` trong NestJS mặc định là Singleton.

**File minh họa:** `src/shared/services/prisma.service.ts`

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : ['info', 'warn', 'error'],
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Database connection established')
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Database connection closed')
  }
}
```

**Giải thích:** `PrismaService` chỉ được tạo MỘT LẦN DUY NHẤT khi ứng dụng khởi động. Mọi service/repository inject `PrismaService` đều nhận cùng một instance → chia sẻ chung một database connection pool.

**Các Singleton khác trong hệ thống:**
- `TokenService` — quản lý JWT tokens
- `HashingService` — mã hóa password
- `EmailService` — gửi email
- `S3Service` — upload file lên AWS S3
- `TwoFactorService` — xác thực 2FA

---

### 2.2 Factory Pattern

**Khái niệm:** Tạo object mà không cần chỉ định class cụ thể, thay vào đó dùng một hàm factory để quyết định cách tạo.

**File minh họa:** `src/websockets/providers/chat-redis.provider.ts`

```typescript
export const ChatRedisProvider = {
  provide: CHAT_REDIS,
  useFactory: (): Redis => {
    const redis = new Redis(envConfig.REDIS_URL, {
      connectTimeout: 15000,
      commandTimeout: 10000,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error(`Chat Redis: max retries (${times}) reached, stopping reconnection`)
          return null
        }
        const delay = Math.min(times * 200, 5000)
        logger.warn(`Chat Redis: retry attempt ${times}, next retry in ${delay}ms`)
        return delay
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    redis.on('connect', () => logger.log('Chat Redis connected'))
    redis.on('ready', () => logger.log('Chat Redis ready'))
    redis.on('error', (error) => logger.error('Chat Redis error:', error))

    return redis
  },
}
```

**File minh họa 2:** `src/app.module.ts` — CacheModule factory

```typescript
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => {
    const logger = new Logger('CacheModule')
    const store = createKeyv({
      url: envConfig.REDIS_URL,
      socket: {
        connectTimeout: 15000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Cache Redis: max retries reached')
            return new Error('Cache Redis: max retries reached')
          }
          return Math.min(retries * 200, 5000)
        },
      },
    })
    return { stores: [store] }
  },
})
```

**Giải thích:** `useFactory` cho phép NestJS gọi hàm factory để tạo ra instance Redis/Cache với cấu hình phức tạp (retry strategy, timeout, event listeners). Điều này không thể làm được với `useClass` đơn giản.

---

### 2.3 Dependency Injection Pattern

**Khái niệm:** Các dependency được "tiêm" vào class thông qua constructor thay vì class tự tạo dependency.

**File minh họa:** `src/routes/auth/auth.service.ts`

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,       // Tiêm service mã hóa
    private readonly authRepository: AuthRepository,       // Tiêm repository xác thực
    private readonly sharedUserRepository: SharedUserRepository, // Tiêm repository user
    private readonly tokenService: TokenService,           // Tiêm service JWT
    private readonly emailService: EmailService,           // Tiêm service email
    private readonly twoFactorService: TwoFactorService,   // Tiêm service 2FA
    private readonly sharedRoleRepository: SharedRoleRepository, // Tiêm repository role
  ) {}

  async login(body: LoginBodyType & { userAgent: string; ip: string }) {
    const user = await this.validateCredentials(body.email, body.password)
    await this.validate2FA(user, body)
    // ... sử dụng các service đã được inject
  }
}
```

**Inject bằng token tùy chỉnh:** `src/shared/guards/access-token.guard.ts`

```typescript
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache, // Inject bằng token
  ) {}
}
```

**Giải thích:** NestJS IoC Container tự động resolve và inject tất cả dependency. `AuthService` không cần biết cách tạo `HashingService` hay `TokenService` — nó chỉ cần khai báo trong constructor. Điều này giúp:
- **Loose coupling** — các class không phụ thuộc trực tiếp vào nhau
- **Dễ test** — có thể mock dependency khi unit test
- **Dễ thay thế** — đổi implementation mà không ảnh hưởng code sử dụng

---

## 3. Structural Patterns (Nhóm Cấu Trúc)

### 3.1 Adapter Pattern

**Khái niệm:** Chuyển đổi interface của một class thành interface khác mà client mong đợi. Cho phép các class không tương thích có thể làm việc cùng nhau.

**File minh họa:** `src/websockets/websocket.adapter.ts`

```typescript
export class WebsocketAdapter extends IoAdapter {
  private readonly logger = new Logger(WebsocketAdapter.name)
  private readonly sharedWebsocketRepository: SharedWebsocketRepository
  private readonly tokenService: TokenService
  private adapterConstructor: ReturnType<typeof createAdapter>

  constructor(app: INestApplicationContext) {
    super(app)
    this.app = app
    this.sharedWebsocketRepository = app.get(SharedWebsocketRepository)
    this.tokenService = app.get(TokenService)
  }

  async connectToRedis(): Promise<void> {
    const pubClient: Redis = this.app.get(CHAT_REDIS)
    const subClient = pubClient.duplicate()
    // ... kết nối Redis pub/sub
    this.adapterConstructor = createAdapter(pubClient, subClient)
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server: Server = super.createIOServer(port, {
      ...options,
      pingInterval: 25000,
      pingTimeout: 10000,
      cors: { origin: getCorsOrigins(), credentials: true },
    })

    // Apply auth middleware cho tất cả namespaces
    server.use((socket, next) => {
      this.authMiddleware(socket, next).then(() => {}).catch(() => {})
    })

    return server
  }

  async authMiddleware(socket: Socket, next: (err?: any) => void) {
    const authorization = socket.handshake.auth?.authorization
    const accessToken = authorization?.split(' ')[1]
    const { userId } = await this.tokenService.verifyAccessToken(accessToken)
    socket.data.userId = userId
    await socket.join(generateRoomUserId(userId))
    next()
  }
}
```

**Giải thích:** `WebsocketAdapter` **adapt** (chuyển đổi) interface mặc định của Socket.IO (`IoAdapter`) thành một phiên bản tùy chỉnh có:
- Tích hợp Redis pub/sub cho distributed WebSocket
- Authentication middleware tự động xác thực JWT
- CORS configuration linh hoạt theo môi trường

Đây là Adapter Pattern kinh điển: class con kế thừa và mở rộng class cha để "adapt" hành vi cho phù hợp với yêu cầu hệ thống.

---

### 3.2 Decorator Pattern

**Khái niệm:** Thêm chức năng mới cho object mà không thay đổi cấu trúc gốc. Trong NestJS, pattern này được hiện thực hóa qua TypeScript decorators.

**File minh họa 1:** `src/shared/decorators/auth.decorator.ts` — Metadata Decorator

```typescript
export const AUTH_TYPE_KEY = 'authType'

export type AuthTypeDecoratorPayload = {
  authTypes: AuthTypeType[]
  options: { condition: ConditionGuardType }
}

// Decorator gắn metadata xác thực lên controller/method
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  return SetMetadata(AUTH_TYPE_KEY, {
    authTypes,
    options: options ?? { condition: ConditionGuard.And },
  })
}

// Tái sử dụng: đánh dấu route là public (không cần xác thực)
export const IsPublic = () => Auth([AuthType.None])
```

**File minh họa 2:** `src/shared/decorators/active-user.decorator.ts` — Parameter Decorator

```typescript
export const ActiveUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
  },
)
```

**File minh họa 3:** `src/shared/decorators/serialize.decorator.ts` — Method & Class Decorator

```typescript
// Method decorator: tự động serialize return value
export function Serialize() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)
      if (result === null || result === undefined) return result
      return JSON.parse(JSON.stringify(result))
    }
    return descriptor
  }
}

// Class decorator: apply @Serialize() cho TẤT CẢ methods
export function SerializeAll(excludeMethods: string[] = []) {
  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    const prototype = constructor.prototype
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function'
        && !excludeMethods.includes(name),
    )
    methodNames.forEach((methodName) => {
      const originalMethod = prototype[methodName]
      prototype[methodName] = async function (...args: any[]) {
        const result = await originalMethod.apply(this, args)
        if (result === null || result === undefined) return result
        return JSON.parse(JSON.stringify(result))
      }
    })
    return constructor
  }
}
```

**Sử dụng thực tế:** `src/routes/address/address.repo.ts`

```typescript
@Injectable()
@SerializeAll()  // ← Tự động serialize tất cả methods
export class AddressRepository {
  constructor(private readonly prismaService: PrismaService) {}
  // Tất cả methods đều được tự động serialize output
}
```

**Tổng hợp tất cả Custom Decorators:**

| Decorator | File | Chức năng |
|-----------|------|-----------|
| `@Auth()` | `auth.decorator.ts` | Gắn metadata xác thực (Bearer, APIKey, None) |
| `@IsPublic()` | `auth.decorator.ts` | Đánh dấu route public |
| `@ActiveUser()` | `active-user.decorator.ts` | Lấy thông tin user từ request |
| `@ActiveRolePermissions()` | `active-role-permissions.decorator.ts` | Lấy role & permissions |
| `@Roles()` | `roles.decorator.ts` | Gắn metadata roles cho RBAC |
| `@UserAgent()` | `user-agent.decorator.ts` | Lấy User-Agent header |
| `@Serialize()` | `serialize.decorator.ts` | Serialize output của method |
| `@SerializeAll()` | `serialize.decorator.ts` | Serialize output tất cả methods |
| `@ZodResponseOnly()` | `zod-response-only.decorator.ts` | Validate output bằng Zod schema |

---

### 3.3 Proxy Pattern

**Khái niệm:** Cung cấp một đối tượng đại diện (proxy) để kiểm soát quyền truy cập đến đối tượng gốc.

**File minh họa:** `src/shared/guards/throttler-behind-proxy.guard.ts`

```typescript
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Extract IP từ proxy headers (req.ips) hoặc fallback về direct IP (req.ip)
    // req.ips được Express populate khi trust proxy được bật
    const tracker = req.ips?.length ? req.ips[0] : req.ip
    return Promise.resolve(tracker)
  }
}
```

**Giải thích:** `ThrottlerBehindProxyGuard` đóng vai trò **Proxy** cho `ThrottlerGuard` gốc. Khi ứng dụng chạy sau reverse proxy (Nginx, CloudFlare), IP thực của client nằm trong header `X-Forwarded-For` chứ không phải `req.ip`. Guard này override method `getTracker` để trích xuất đúng IP, đảm bảo rate limiting hoạt động chính xác.

---

### 3.4 Facade Pattern

**Khái niệm:** Cung cấp một interface đơn giản cho một hệ thống con phức tạp.

**File minh họa:** `src/routes/product/manage-product.service.ts`

```typescript
@Injectable()
export class ManageProductService {
  constructor(private productRepo: ProductRepo) {}

  // Facade method: ẩn đi logic kiểm tra quyền phức tạp
  validatePrivilege({ userIdRequest, roleNameRequest, createdById }: {
    userIdRequest: number
    roleNameRequest: string
    createdById: number | undefined | null
  }) {
    if (userIdRequest !== createdById && roleNameRequest !== RoleName.Admin) {
      throw new ForbiddenException()
    }
    return true
  }

  // Facade: gom kiểm tra quyền + query data + i18n vào một method đơn giản
  async list(props: {
    query: GetManageProductsQueryType
    userIdRequest: number
    roleNameRequest: string
  }) {
    this.validatePrivilege({
      userIdRequest: props.userIdRequest,
      roleNameRequest: props.roleNameRequest,
      createdById: props.query.createdById,
    })
    return this.productRepo.list({
      page: props.query.page,
      limit: props.query.limit,
      languageId: I18nContext.current()?.lang as string,
      // ... nhiều params khác
    })
  }

  // Facade: gom tìm sản phẩm + kiểm tra quyền + xử lý lỗi
  async update({ productId, data, updatedById, roleNameRequest }) {
    const product = await this.productRepo.findById(productId)
    if (!product) throw NotFoundRecordException
    this.validatePrivilege({ userIdRequest: updatedById, roleNameRequest, createdById: product.createdById })
    return this.productRepo.update({ id: productId, updatedById, data })
  }
}
```

**Giải thích:** `ManageProductService` đóng vai trò **Facade** — Controller chỉ cần gọi một method duy nhất (ví dụ `update()`), còn bên trong service tự xử lý: tìm sản phẩm → kiểm tra quyền → cập nhật → xử lý lỗi. Controller không cần biết chi tiết logic phức tạp bên trong.

---

### 3.5 Repository Pattern

**Khái niệm:** Tách biệt logic truy cập dữ liệu khỏi business logic, cung cấp interface trừu tượng cho data access.

**File minh họa:** `src/routes/address/address.repo.ts`

```typescript
@Injectable()
@SerializeAll()
export class AddressRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: number, data: CreateAddressBody) {
    const fullAddress = `${data.detail}, ${data.wardName}, ${data.districtName}, ${data.provinceName}`
    if (data.isDefault) {
      await this.prismaService.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }
    return this.prismaService.address.create({ data: { userId, ...data, fullAddress } })
  }

  findById(id: number, userId: number) {
    return this.prismaService.address.findFirst({
      where: { id, userId, isActive: true },
    })
  }

  async findMany(userId: number, query: ListAddressesQuery) {
    const { page = 1, limit = 10, isActive, search } = query
    const offset = (page - 1) * limit
    const where: Prisma.AddressWhereInput = { userId, ...(isActive !== undefined && { isActive }) }
    const [data, total] = await Promise.all([
      this.prismaService.address.findMany({ where, skip: offset, take: limit }),
      this.prismaService.address.count({ where }),
    ])
    return { data, total, page, limit }
  }

  // Soft delete
  delete(id: number, userId: number) {
    return this.prismaService.address.update({
      where: { id, userId },
      data: { isActive: false },
    })
  }

  // Transaction: đặt địa chỉ mặc định
  async setDefault(id: number, userId: number) {
    await this.prismaService.$transaction([
      this.prismaService.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prismaService.address.update({
        where: { id, userId },
        data: { isDefault: true },
      }),
    ])
    return this.findById(id, userId)
  }
}
```

**Giải thích:** Hệ thống có **26 repository files** (*.repo.ts), mỗi repository đóng gói toàn bộ logic truy cập database cho một entity. Service layer chỉ gọi repository methods mà không cần biết chi tiết Prisma query. Lợi ích:
- **Tái sử dụng** — Shared repositories (`shared-user.repo.ts`, `shared-role.repo.ts`) được dùng chung giữa nhiều modules
- **Dễ test** — Mock repository khi test service
- **Tách biệt concerns** — Thay đổi database query không ảnh hưởng business logic

---

### 3.6 Module Pattern

**Khái niệm:** Tổ chức code thành các module độc lập, mỗi module đóng gói một nhóm chức năng liên quan.

**File minh họa:** `src/app.module.ts`

```typescript
@Module({
  imports: [
    SharedModule,        // Module chia sẻ chung (Global)
    AuthModule,          // Xác thực
    ProductModule,       // Sản phẩm
    CartModule,          // Giỏ hàng
    OrderModule,         // Đơn hàng
    PaymentModule,       // Thanh toán
    WebsocketModule,     // Real-time
    ConversationModule,  // Chat
    ReviewModule,        // Đánh giá
    WishlistModule,      // Danh sách yêu thích
    VoucherModule,       // Mã giảm giá
    // ... 27+ modules tổng cộng
  ],
  providers: [
    { provide: APP_PIPE, useClass: CustomZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: CatchEverythingFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
})
export class AppModule {}
```

**Giải thích:** Mỗi feature được đóng gói trong một module riêng biệt (Auth, Product, Cart, Order...). Module khai báo rõ ràng: imports (phụ thuộc), providers (services), controllers (endpoints), exports (chia sẻ ra ngoài). Kiến trúc này giúp:
- **Separation of Concerns** — mỗi module chỉ lo một domain
- **Lazy loading** — có thể load module theo nhu cầu
- **Dễ maintain** — thêm/xóa feature chỉ cần thêm/xóa module

---

## 4. Behavioral Patterns (Nhóm Hành Vi)

### 4.1 Strategy Pattern

**Khái niệm:** Định nghĩa một nhóm thuật toán, đóng gói từng thuật toán, và cho phép chúng có thể thay thế lẫn nhau tại runtime.

**File minh họa:** `src/shared/guards/authentication.guard.ts`

```typescript
@Injectable()
export class AuthenticationGuard implements CanActivate {
  // Map chứa các "strategy" xác thực khác nhau
  private readonly authTypeGuardMap: Record<string, CanActivate>

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly paymentAPIKeyGuard: PaymentAPIKeyGuard,
  ) {
    // Đăng ký các strategy
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,        // Strategy 1: JWT Bearer Token
      [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard, // Strategy 2: Payment API Key
      [AuthType.None]: { canActivate: () => true },     // Strategy 3: Không xác thực
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypeValue = this.getAuthTypeValue(context)
    // Lấy danh sách guards tương ứng với auth types được khai báo
    const guards = authTypeValue.authTypes.map((authType) => this.authTypeGuardMap[authType])

    // Chọn chiến lược kết hợp: AND (tất cả phải pass) hoặc OR (một cái pass là đủ)
    return authTypeValue.options.condition === ConditionGuard.And
      ? this.handleAndCondition(guards, context)
      : this.handleOrCondition(guards, context)
  }

  // Strategy OR: chỉ cần MỘT guard pass là được
  private async handleOrCondition(guards: CanActivate[], context: ExecutionContext) {
    for (const guard of guards) {
      try {
        if (await guard.canActivate(context)) return true
      } catch (error) { /* tiếp tục thử guard tiếp theo */ }
    }
    throw new UnauthorizedException()
  }

  // Strategy AND: TẤT CẢ guards phải pass
  private async handleAndCondition(guards: CanActivate[], context: ExecutionContext) {
    for (const guard of guards) {
      if (!(await guard.canActivate(context))) throw new UnauthorizedException()
    }
    return true
  }
}
```

**Cách sử dụng trong Controller:**

```typescript
// Route chỉ cần Bearer token (mặc định)
@Get('profile')
getProfile() { ... }

// Route public, không cần xác thực
@IsPublic()
@Get('products')
getProducts() { ... }

// Route chấp nhận Bearer HOẶC Payment API Key
@Auth([AuthType.Bearer, AuthType.PaymentAPIKey], { condition: ConditionGuard.Or })
@Post('webhook')
handleWebhook() { ... }
```

**Giải thích:** `AuthenticationGuard` là một Strategy Pattern hoàn chỉnh:
- **Context** = `AuthenticationGuard` (quyết định dùng strategy nào)
- **Strategy Interface** = `CanActivate` (interface chung)
- **Concrete Strategies** = `AccessTokenGuard`, `PaymentAPIKeyGuard`, `{ canActivate: () => true }`

Tại runtime, dựa vào metadata từ decorator `@Auth()`, guard tự động chọn strategy phù hợp.

---

### 4.2 Chain of Responsibility Pattern

**Khái niệm:** Cho phép một request đi qua một chuỗi các handler, mỗi handler quyết định xử lý hoặc chuyển tiếp cho handler tiếp theo.

**Trong NestJS Ecommerce API, có 4 chuỗi xử lý:**

```
Request Flow:
┌──────────┐   ┌──────────────────┐   ┌────────────────────┐   ┌──────────┐   ┌────────────┐
│  Guards   │ → │   Interceptors   │ → │       Pipes        │ → │Controller│ → │   Filters  │
│  (before) │   │    (before)      │   │   (validation)     │   │ (handler)│   │  (errors)  │
└──────────┘   └──────────────────┘   └────────────────────┘   └──────────┘   └────────────┘
```

**Chuỗi 1 — Guard Chain:** `src/app.module.ts`

```typescript
// Guard 1: Rate Limiting (chạy TRƯỚC)
{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
// Guard 2: Authentication (chạy SAU)
{ provide: APP_GUARD, useClass: AuthenticationGuard },
```

→ Request phải vượt qua rate limit TRƯỚC, rồi mới kiểm tra xác thực.

**Chuỗi 2 — Filter Chain (xử lý lỗi):**

```typescript
// Filter 1: Đăng ký TRƯỚC → chạy CUỐI (fallback cho mọi exception)
{ provide: APP_FILTER, useClass: CatchEverythingFilter },
// Filter 2: Đăng ký SAU → chạy TRƯỚC (xử lý HttpException)
{ provide: APP_FILTER, useClass: HttpExceptionFilter },
```

**File:** `src/shared/filters/catch-everything.filter.ts`

```typescript
@Catch()  // Bắt TẤT CẢ exception
export class CatchEverythingFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal Server Error'

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus()
      message = exception.getResponse()
    } else if (isUniqueConstraintPrismaError(exception)) {
      httpStatus = HttpStatus.CONFLICT
      message = 'Record already exists'
    } else if (isForeignKeyConstraintPrismaError(exception)) {
      httpStatus = HttpStatus.BAD_REQUEST
      message = 'Referenced record does not exist'
    } else if (isNotFoundPrismaError(exception)) {
      httpStatus = HttpStatus.NOT_FOUND
      message = 'Record not found'
    }
    // ... trả về response
  }
}
```

**Chuỗi 3 — Interceptor Chain:**

```typescript
{ provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
```

**File:** `src/shared/interceptor/transform.interceptor.ts`

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse()
        return { data, statusCode: response.statusCode }
      }),
    )
  }
}
```

**Giải thích:** Mỗi request đi qua một "chuỗi trách nhiệm":
1. `ThrottlerBehindProxyGuard` → kiểm tra rate limit → pass/reject
2. `AuthenticationGuard` → kiểm tra xác thực → pass/reject
3. `ZodSerializerInterceptor` → validate output → pass/throw
4. `CustomZodValidationPipe` → validate input → pass/throw
5. Controller handler → xử lý business logic
6. `HttpExceptionFilter` → bắt HttpException
7. `CatchEverythingFilter` → bắt mọi exception còn lại

---

### 4.3 Observer / Pub-Sub Pattern

**Khái niệm:** Khi một object thay đổi trạng thái, tất cả các object phụ thuộc (observers/subscribers) sẽ được thông báo tự động.

**File minh họa:** `src/websockets/enhanced-chat.gateway.ts`

```typescript
@WebSocketGateway({ namespace: '/chat' })
export class EnhancedChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  // Subscribe: lắng nghe event 'send_message' từ client
  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    if (!this.checkRateLimit(client, 'send_message')) return
    return this.messageHandler.handleSendMessage(this.server, client, data)
  }

  // Subscribe: lắng nghe event 'typing_start'
  @SubscribeMessage('typing_start')
  async handleTypingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    return this.typingHandler.handleTypingStart(this.server, client, data)
  }

  // Subscribe: lắng nghe event 'react_to_message'
  @SubscribeMessage('react_to_message')
  async handleReactToMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: unknown) {
    return this.interactionHandler.handleReactToMessage(this.server, client, data)
  }
}
```

**Publish (phát sự kiện):** `src/websockets/handlers/chat-message.handler.ts`

```typescript
async handleSendMessage(server: Server, client: AuthenticatedSocket, data: unknown) {
  const message = await this.messageService.sendMessage(client.userId, { ... })

  // Publish: phát sự kiện 'new_message' đến TẤT CẢ members trong conversation
  server.to(`conversation:${validData.conversationId}`).emit('new_message', {
    message,
    tempId: validData.tempId,
    timestamp: new Date(),
  })

  // Publish: phát xác nhận đến người gửi
  client.emit('message_sent', { message, tempId: validData.tempId, timestamp: new Date() })
}
```

**Redis Pub/Sub cho Distributed WebSocket:** `src/websockets/websocket.adapter.ts`

```typescript
async connectToRedis(): Promise<void> {
  const pubClient: Redis = this.app.get(CHAT_REDIS)
  const subClient = pubClient.duplicate()
  // Redis adapter cho phép nhiều server instances chia sẻ WebSocket events
  this.adapterConstructor = createAdapter(pubClient, subClient)
}
```

**Giải thích:** Hệ thống sử dụng Observer/Pub-Sub ở 2 tầng:
1. **Application level** — `@SubscribeMessage()` lắng nghe events từ client, `server.emit()` phát events đến clients
2. **Infrastructure level** — Redis pub/sub cho phép nhiều server instances đồng bộ WebSocket events (horizontal scaling)

---

### 4.4 Template Method Pattern

**Khái niệm:** Định nghĩa "khung xương" của một thuật toán trong class cha, cho phép class con override các bước cụ thể mà không thay đổi cấu trúc tổng thể.

**File minh họa 1:** `src/queues/payment.consumer.ts`

```typescript
@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  // WorkerHost định nghĩa template: nhận job → gọi process() → xử lý kết quả
  // PaymentConsumer chỉ cần override method process()

  async process(job: Job<{ paymentId: number }, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.name} with ID ${job.id}`)

    switch (job.name) {
      case CANCEL_PAYMENT_JOB_NAME: {
        const paymentId = job.data.paymentId
        await this.sharedPaymentRepo.cancelPaymentAndOrder(paymentId)
        return { success: true, paymentId }
      }
      default:
        throw new Error(`Unknown job name: ${job.name}`)
    }
  }
}
```

**File minh họa 2:** `src/routes/media/parse-file-pipe-with-unlink.pipe.ts`

```typescript
export class ParseFilePipeWithUnlink extends ParseFilePipe {
  constructor(options?: ParseFileOptions) {
    super(options)
  }

  // Override template method: thêm logic cleanup khi validation thất bại
  async transform(files: Array<Express.Multer.File>): Promise<any> {
    return super.transform(files).catch(async (error) => {
      // Xóa files đã upload nếu validation fail
      await Promise.all(files.map((file) => unlink(file.path)))
      throw error
    })
  }
}
```

**File minh họa 3:** `src/shared/filters/http-exception.filter.ts`

```typescript
@Catch(HttpException)
export class HttpExceptionFilter extends BaseExceptionFilter {
  // Override template method catch() từ BaseExceptionFilter
  catch(exception: HttpException, host: ArgumentsHost) {
    // Thêm logic logging cho ZodSerializationException
    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError()
      this.logger.error(`ZodSerializationException: ${zodError.message}`)
    }
    // Gọi lại template gốc
    super.catch(exception, host)
  }
}
```

**Giải thích:** Template Method Pattern xuất hiện ở 3 nơi:
- `WorkerHost.process()` — BullMQ định nghĩa flow xử lý job, consumer chỉ override `process()`
- `ParseFilePipe.transform()` — NestJS định nghĩa flow validate file, pipe con thêm cleanup logic
- `BaseExceptionFilter.catch()` — NestJS định nghĩa flow xử lý exception, filter con thêm logging

---

### 4.5 Mediator Pattern

**Khái niệm:** Giảm sự phụ thuộc trực tiếp giữa các object bằng cách đưa giao tiếp qua một object trung gian (mediator).

**File minh họa:** `src/routes/auth/auth.service.ts`

```typescript
@Injectable()
export class AuthService {
  // AuthService là MEDIATOR giữa 7 dependencies
  constructor(
    private readonly hashingService: HashingService,
    private readonly authRepository: AuthRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly sharedRoleRepository: SharedRoleRepository,
  ) {}

  // Mediator điều phối flow đăng ký: validate OTP → hash password → tạo user → xóa OTP
  async register(body: RegisterBodyType) {
    await this.validateVerificationCode({ code: body.code, email: body.email, type: 'REGISTER' })
    const clientRoleId = await this.sharedRoleRepository.getClientRoleId()
    const hashedPassword = await this.hashingService.hash(body.password)
    const [user] = await Promise.all([
      this.authRepository.createUser({ email: body.email, password: hashedPassword, roleId: clientRoleId }),
      this.authRepository.deleteVerificationCode({ email_type: { email: body.email, type: 'REGISTER' } }),
    ])
    return user
  }

  // Mediator điều phối flow login: validate credentials → validate 2FA → tạo device → tạo tokens
  async login(body: LoginBodyType & { userAgent: string; ip: string }) {
    const user = await this.validateCredentials(body.email, body.password)
    await this.validate2FA(user, body)
    const device = await this.authRepository.createDevice({ userId: user.id, userAgent: body.userAgent, ip: body.ip })
    return this.generateTokens({ userId: user.id, deviceId: device.id, roleId: user.roleId, roleName: user.role.name })
  }
}
```

**Giải thích:** `AuthService` là Mediator — nó điều phối giao tiếp giữa `HashingService`, `TokenService`, `EmailService`, `TwoFactorService`, và các repositories. Không service nào giao tiếp trực tiếp với nhau; tất cả đều thông qua `AuthService`.

---

### 4.6 Command / Handler Pattern

**Khái niệm:** Đóng gói một request thành một object, cho phép tham số hóa, xếp hàng, và log các request.

**File minh họa:** `src/websockets/handlers/` — Tách handler thành các class riêng biệt

```
EnhancedChatGateway (Invoker)
    ├── ChatConnectionHandler   → xử lý connect/disconnect
    ├── ChatMessageHandler      → xử lý send/edit/delete message
    ├── ChatTypingHandler       → xử lý typing indicators
    └── ChatInteractionHandler  → xử lý reactions, read receipts, join/leave
```

**Gateway (Invoker):** `src/websockets/enhanced-chat.gateway.ts`

```typescript
export class EnhancedChatGateway {
  constructor(
    private readonly connectionHandler: ChatConnectionHandler,   // Handler 1
    private readonly messageHandler: ChatMessageHandler,         // Handler 2
    private readonly typingHandler: ChatTypingHandler,           // Handler 3
    private readonly interactionHandler: ChatInteractionHandler, // Handler 4
  ) {}

  // Delegate command đến handler tương ứng
  @SubscribeMessage('send_message')
  async handleSendMessage(client, data) {
    return this.messageHandler.handleSendMessage(this.server, client, data)
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(client, data) {
    return this.typingHandler.handleTypingStart(this.server, client, data)
  }

  @SubscribeMessage('react_to_message')
  async handleReactToMessage(client, data) {
    return this.interactionHandler.handleReactToMessage(this.server, client, data)
  }
}
```

**Giải thích:** Gateway nhận "command" từ client (WebSocket events) và delegate cho handler phù hợp. Mỗi handler đóng gói logic xử lý cho một nhóm commands liên quan. Điều này giúp:
- **Single Responsibility** — mỗi handler chỉ lo một nhóm chức năng
- **Dễ mở rộng** — thêm handler mới mà không sửa gateway
- **Dễ test** — test từng handler độc lập

---

## 5. Enterprise & Concurrency Patterns

### 5.1 Producer-Consumer Pattern (Message Queue)

**Khái niệm:** Tách biệt việc tạo task (producer) và xử lý task (consumer) thông qua một hàng đợi (queue), cho phép xử lý bất đồng bộ.

**Producer:** `src/routes/payment/payment.producer.ts`

```typescript
@Injectable()
export class PaymentProducer {
  constructor(@InjectQueue(PAYMENT_QUEUE_NAME) private paymentQueue: Queue) {}

  async removeJob(paymentId: number): Promise<boolean> {
    const jobId = generateCancelPaymentJobId(paymentId)
    const job = await this.paymentQueue.getJob(jobId)
    if (!job) return false
    const state = await job.getState()
    if (state === 'waiting' || state === 'delayed') {
      await job.remove()
      return true
    }
    return false
  }
}
```

**Consumer:** `src/queues/payment.consumer.ts`

```typescript
@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  constructor(private readonly sharedPaymentRepo: SharedPaymentRepository) { super() }

  async process(job: Job<{ paymentId: number }>): Promise<any> {
    switch (job.name) {
      case CANCEL_PAYMENT_JOB_NAME: {
        await this.sharedPaymentRepo.cancelPaymentAndOrder(job.data.paymentId)
        return { success: true, paymentId: job.data.paymentId }
      }
      default:
        throw new Error(`Unknown job name: ${job.name}`)
    }
  }
}
```

**Consumer 2:** `src/queues/wishlist.consumer.ts`

```typescript
@Processor(WISHLIST_QUEUE_NAME)
export class WishlistConsumer extends WorkerHost {
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case PRICE_CHECK_JOB_NAME:
        return this.handlePriceCheck()       // Kiểm tra giá sản phẩm
      case SEND_PRICE_ALERT_JOB_NAME:
        return this.handleSendPriceAlert(job.data) // Gửi email thông báo giảm giá
    }
  }

  private async handlePriceCheck() {
    const items = await this.wishlistRepo.getItemsForPriceCheck()
    for (const item of items) {
      // Tính % giảm giá → nếu >= 5% → queue job gửi email
      if (shouldAlert) {
        await this.wishlistProducer.addSendPriceAlertJob({ userId, productName, priceDropPercentage })
      }
    }
  }
}
```

**Flow:**

```
Producer (API request) → Redis Queue (BullMQ) → Consumer (Background worker)
                                                      ↓
Payment: Tạo job hủy thanh toán → Queue → Consumer hủy payment + order
Wishlist: Cron trigger → Queue → Consumer check giá → Queue → Consumer gửi email
```

**Giải thích:** Sử dụng BullMQ + Redis để:
- **Xử lý bất đồng bộ** — hủy thanh toán sau timeout, gửi email thông báo giá
- **Retry tự động** — job thất bại sẽ được retry (exponential backoff)
- **Horizontal scaling** — nhiều consumer instances có thể xử lý song song

---

### 5.2 Scheduled Task / Cron Pattern

**Khái niệm:** Tự động thực thi task theo lịch trình định sẵn.

**File minh họa 1:** `src/cronjobs/remove-refresh-token.cronjob.ts`

```typescript
@Injectable()
export class RemoveRefreshTokenCronjob {
  private isRunning = false  // Mutex: ngăn chạy đồng thời

  constructor(private prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)  // Chạy mỗi ngày lúc 1 giờ sáng
  async handleCron() {
    if (this.isRunning) return  // Ngăn concurrent execution
    this.isRunning = true
    try {
      const result = await this.prismaService.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
      this.logger.log(`Removed ${result.count} expired tokens`)
    } finally {
      this.isRunning = false
    }
  }
}
```

**File minh họa 2:** `src/cronjobs/wishlist-price-check.cronjob.ts`

```typescript
@Injectable()
export class WishlistPriceCheckCronjob {
  private isRunning = false

  @Cron(CronExpression.EVERY_DAY_AT_2AM)  // Chạy mỗi ngày lúc 2 giờ sáng
  async handlePriceCheck() {
    if (this.isRunning) return
    this.isRunning = true
    try {
      await this.wishlistProducer.addPriceCheckJob()  // Đẩy job vào queue
    } finally {
      this.isRunning = false
    }
  }
}
```

**Giải thích:** Cron jobs kết hợp với Producer-Consumer pattern:
- **1:00 AM** — Dọn dẹp refresh tokens hết hạn (trực tiếp xóa database)
- **2:00 AM** — Trigger kiểm tra giá wishlist (đẩy vào queue để consumer xử lý)
- Cả hai đều có **mutex flag** (`isRunning`) để ngăn chạy đồng thời

---

### 5.3 Cache-Aside Pattern

**Khái niệm:** Ứng dụng kiểm tra cache trước, nếu miss thì query database rồi lưu kết quả vào cache.

**File minh họa:** `src/shared/guards/access-token.guard.ts`

```typescript
private async validateUserPermission(decodedAccessToken: AccessTokenPayload, request: any) {
  const roleId = decodedAccessToken.roleId
  const cacheKey = `role:${roleId}`

  // 1. Thử lấy từ cache TRƯỚC
  let cachedRole = await this.cacheManager.get<CachedRole>(cacheKey)

  // 2. Cache MISS → query database
  if (cachedRole === null) {
    const role = await this.prismaService.role.findUniqueOrThrow({
      where: { id: roleId, deletedAt: null, isActive: true },
      include: { permissions: { where: { deletedAt: null } } },
    })

    // Transform permissions thành object để lookup O(1)
    const permissionObject = keyBy(role.permissions, (p) => `${p.path}:${p.method}`)
    cachedRole = { ...role, permissions: permissionObject }

    // 3. Lưu vào cache (TTL: 1 giờ)
    await this.cacheManager.set(cacheKey, cachedRole, 1000 * 60 * 60)
  }

  // 4. Kiểm tra quyền truy cập O(1) lookup
  const canAccess = cachedRole?.permissions[`${path}:${method}`]
  if (!canAccess) throw new ForbiddenException('Error.PermissionDenied')
}
```

**Flow:**

```
Request → AccessTokenGuard
              ↓
         Cache.get(role:123)
              ↓
    ┌─── Cache HIT ───┐     ┌─── Cache MISS ───┐
    │  Return cached   │     │  Query Database   │
    │  role+permissions│     │  Transform data   │
    └────────┬─────────┘     │  Cache.set(1h)    │
             │               └────────┬──────────┘
             ↓                        ↓
         Check permission[path:method]
              ↓
         Allow / Deny
```

**Giải thích:** Mỗi request cần kiểm tra quyền. Thay vì query database mỗi lần, guard cache role+permissions trong Redis với TTL 1 giờ. Permissions được transform thành object để lookup O(1) thay vì O(n) array scan.

---

### 5.4 Token Bucket Rate Limiting Pattern

**Khái niệm:** Giới hạn tốc độ request bằng cách sử dụng "token bucket" — mỗi bucket chứa một số token, mỗi request tiêu thụ 1 token, tokens được bổ sung theo thời gian.

**File minh họa:** `src/websockets/utils/rate-limiter.ts`

```typescript
export class TokenBucketRateLimiter {
  // Map: socketId → Map: eventName → TokenBucket
  private readonly buckets = new Map<string, Map<string, TokenBucket>>()

  constructor(private readonly limits: Map<string, RateLimitConfig>) {}

  consume(socketId: string, eventName: string): { allowed: boolean; retryAfterMs: number } {
    const config = this.limits.get(eventName)
    if (!config) return { allowed: true, retryAfterMs: 0 }

    const now = Date.now()
    let bucket = this.getBucket(socketId, eventName)

    // Refill tokens dựa trên thời gian đã trôi qua
    const elapsed = now - bucket.lastRefill
    if (elapsed >= config.intervalMs) {
      bucket.tokens = config.tokens  // Full refill
    } else {
      bucket.tokens = Math.min(config.tokens, bucket.tokens + (elapsed / config.intervalMs) * config.tokens)
    }
    bucket.lastRefill = now

    // Tiêu thụ 1 token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, retryAfterMs: 0 }
    }

    // Rate limited
    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / config.tokens) * config.intervalMs)
    return { allowed: false, retryAfterMs }
  }

  cleanup(socketId: string): void {
    this.buckets.delete(socketId)
  }
}
```

**Cấu hình rate limits:** `src/websockets/enhanced-chat.gateway.ts`

```typescript
const rateLimits = new Map<string, RateLimitConfig>([
  ['send_message',     { tokens: 10, intervalMs: 60_000 }],  // 10 tin nhắn/phút
  ['typing_start',     { tokens: 30, intervalMs: 60_000 }],  // 30 typing events/phút
  ['react_to_message', { tokens: 20, intervalMs: 60_000 }],  // 20 reactions/phút
  ['edit_message',     { tokens: 10, intervalMs: 60_000 }],  // 10 edits/phút
  ['delete_message',   { tokens: 10, intervalMs: 60_000 }],  // 10 deletes/phút
])
```

---

### 5.5 Gateway Pattern

**Khái niệm:** Cung cấp một điểm truy cập duy nhất (gateway) cho một hệ thống con, xử lý routing và protocol translation.

**File minh họa:** `src/websockets/payment.gateway.ts`

```typescript
@WebSocketGateway({ namespace: 'payment' })
export class PaymentGateway {
  @WebSocketServer()
  server: Server

  @SubscribeMessage('send-money')
  handleEvent(@MessageBody() data: string): string {
    this.server.emit('receive-money', { data: `Money: ${data}` })
    return data
  }

  // Được gọi từ service khác để notify user qua WebSocket
  emitPaymentSuccess(userId: number): void {
    this.server.to(generateRoomUserId(userId)).emit('payment', { status: 'success' })
  }
}
```

**Giải thích:** `PaymentGateway` là gateway cho payment events qua WebSocket. Nó bridge giữa HTTP services (payment processing) và WebSocket clients (real-time notifications).

---

### 5.6 Global Module Pattern

**Khái niệm:** Đăng ký module một lần và tự động available cho toàn bộ ứng dụng.

**File minh họa:** `src/shared/shared.module.ts`

```typescript
@Global()  // ← Đánh dấu là Global Module
@Module({
  providers: [
    PrismaService,
    HashingService,
    TokenService,
    SharedUserRepository,
    EmailService,
    TwoFactorService,
    S3Service,
    SharedRoleRepository,
    SharedWebsocketRepository,
    SharedPaymentRepository,
    AccessTokenGuard,
    PaymentAPIKeyGuard,
    AuthenticationGuard,
  ],
  exports: [/* tất cả services trên */],
  imports: [JwtModule],
})
export class SharedModule {}
```

**Giải thích:** `@Global()` decorator biến `SharedModule` thành module toàn cục. Bất kỳ module nào trong ứng dụng đều có thể inject `PrismaService`, `TokenService`, `EmailService`... mà KHÔNG cần import `SharedModule` trong `imports` array.

---

### 5.7 DTO (Data Transfer Object) Pattern

**Khái niệm:** Sử dụng object chuyên biệt để truyền dữ liệu giữa các layer, kèm validation.

Hệ thống sử dụng **Zod schemas** thay vì class-validator cho DTO validation:

```typescript
// Pipe tùy chỉnh để format lỗi validation
const CustomZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    return new UnprocessableEntityException(
      error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join('.'),
        code: issue.code,
      })),
    )
  },
})
```

**Giải thích:** Mỗi route có DTO riêng (27 DTO files) để validate input/output. Zod schemas cung cấp type-safe validation với TypeScript inference tự động.

---

### 5.8 Lifecycle Hook Pattern

**Khái niệm:** Cho phép object thực thi logic tại các thời điểm cụ thể trong vòng đời của nó.

**File minh họa:** `src/shared/services/prisma.service.ts`

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()           // Kết nối database khi module khởi tạo
  }

  async onModuleDestroy() {
    await this.$disconnect()        // Ngắt kết nối khi module bị hủy
  }
}
```

**File minh họa 2:** `src/websockets/providers/chat-redis.provider.ts`

```typescript
@Injectable()
export class ChatRedisShutdownService implements OnModuleDestroy {
  constructor(@Inject(CHAT_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()         // Graceful shutdown Redis connection
  }
}
```

**Giải thích:** NestJS cung cấp lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`, `OnApplicationBootstrap`...) cho phép services thực thi logic tại các thời điểm quan trọng: khởi tạo connection, cleanup resources, graceful shutdown.

---

## 6. Sơ Đồ Tổng Hợp

### Bảng tổng hợp tất cả Design Patterns

| # | Design Pattern | Nhóm | Vị trí chính | Mô tả ngắn |
|---|---------------|-------|--------------|-------------|
| 1 | **Singleton** | Creational | Tất cả `@Injectable()` services | Mỗi service chỉ có 1 instance |
| 2 | **Factory** | Creational | `chat-redis.provider.ts`, `app.module.ts` | Tạo Redis/Cache instances với config phức tạp |
| 3 | **Dependency Injection** | Creational | Toàn bộ hệ thống | Constructor injection qua NestJS IoC |
| 4 | **Adapter** | Structural | `websocket.adapter.ts` | Adapt IoAdapter → custom WebSocket + Redis |
| 5 | **Decorator** | Structural | `shared/decorators/` (8 files) | Custom decorators cho auth, user, serialize |
| 6 | **Proxy** | Structural | `throttler-behind-proxy.guard.ts` | Proxy IP extraction cho rate limiting |
| 7 | **Facade** | Structural | `manage-product.service.ts` | Ẩn logic phức tạp sau interface đơn giản |
| 8 | **Repository** | Structural | 26 files `*.repo.ts` | Tách biệt data access khỏi business logic |
| 9 | **Module** | Structural | 33 files `*.module.ts` | Tổ chức code theo feature modules |
| 10 | **Strategy** | Behavioral | `authentication.guard.ts` | Chọn auth strategy tại runtime |
| 11 | **Chain of Responsibility** | Behavioral | Guards → Interceptors → Pipes → Filters | Request pipeline qua chuỗi handlers |
| 12 | **Observer / Pub-Sub** | Behavioral | WebSocket gateways + Redis pub/sub | Real-time events & distributed messaging |
| 13 | **Template Method** | Behavioral | `WorkerHost`, `ParseFilePipe`, `BaseExceptionFilter` | Override bước cụ thể trong flow chung |
| 14 | **Mediator** | Behavioral | Service layer (AuthService, etc.) | Điều phối giao tiếp giữa dependencies |
| 15 | **Command / Handler** | Behavioral | `websockets/handlers/` (4 files) | Tách handler theo nhóm chức năng |
| 16 | **Producer-Consumer** | Enterprise | `*.producer.ts` + `*.consumer.ts` | Background job processing qua BullMQ |
| 17 | **Scheduled Task** | Enterprise | `cronjobs/` (2 files) | Tự động chạy task theo lịch |
| 18 | **Cache-Aside** | Enterprise | `access-token.guard.ts` | Cache role/permissions trong Redis |
| 19 | **Token Bucket Rate Limiting** | Enterprise | `rate-limiter.ts` | Giới hạn tốc độ WebSocket events |
| 20 | **Gateway** | Enterprise | `payment.gateway.ts`, `enhanced-chat.gateway.ts` | Điểm truy cập WebSocket |
| 21 | **Global Module** | Enterprise | `shared.module.ts` | Module available toàn cục |
| 22 | **DTO** | Enterprise | 27 files `*.dto.ts` + Zod schemas | Validate & transfer data giữa layers |
| 23 | **Lifecycle Hook** | Enterprise | `PrismaService`, `ChatRedisShutdownService` | Logic tại init/destroy |

### Sơ đồ flow tổng thể

```
                              ┌─────────────────────────────────────┐
                              │           CLIENT REQUEST            │
                              └──────────────┬──────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              HTTP Request            WebSocket Event           Cron Trigger
                    │                        │                        │
                    ▼                        ▼                        ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │ ThrottlerGuard  │    │ WebsocketAdapter │    │  Cron Scheduler  │
          │ (Proxy Pattern) │    │(Adapter Pattern) │    │ (Scheduled Task) │
          └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘
                   │                      │                       │
                   ▼                      ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │AuthenticationGrd│    │  Chat Gateway    │    │    Producer      │
          │(Strategy Pattern│    │(Observer Pattern)│    │(Producer-Consumer│
          └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘
                   │                      │                       │
                   ▼                      ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │  Interceptors   │    │    Handlers      │    │   Redis Queue    │
          │(Chain of Resp.) │    │(Command Pattern) │    │   (BullMQ)       │
          └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘
                   │                      │                       │
                   ▼                      ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │   Pipes (Zod)   │    │    Services      │    │    Consumer      │
          │  (DTO Pattern)  │    │(Mediator Pattern)│    │(Template Method) │
          └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘
                   │                      │                       │
                   ▼                      ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │   Controllers   │    │  Repositories    │    │  Repositories    │
          │ (Facade Pattern)│    │(Repository Ptrn) │    │(Repository Ptrn) │
          └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘
                   │                      │                       │
                   ▼                      ▼                       ▼
          ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │    Services     │    │  Prisma + Redis  │    │  Prisma + Redis  │
          │(Mediator+DI)    │    │(Singleton+Cache) │    │(Singleton+Cache) │
          └────────┬────────┘    └──────────────────┘    └──────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Repositories   │
          │(Repository Ptrn)│
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Prisma + Redis │
          │(Singleton+Cache)│
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   Filters       │
          │(Chain of Resp.) │
          └─────────────────┘
```

---

## 7. Câu Hỏi & Gợi Ý Tiếp Theo

Dựa trên phân tích trên, đây là các hướng đi tiếp theo bạn có thể chọn:

1. **Phân tích sâu một pattern cụ thể** — Ví dụ: Strategy Pattern trong Authentication, hoặc Producer-Consumer trong Payment flow
2. **So sánh với các design patterns chưa được áp dụng** — Ví dụ: CQRS, Event Sourcing, Specification Pattern, State Pattern
3. **Đánh giá chất lượng implementation** — Review xem các patterns đã được implement đúng cách chưa, có anti-patterns nào không
4. **Đề xuất cải tiến kiến trúc** — Thêm patterns mới hoặc refactor patterns hiện tại để tối ưu hơn
5. **Tạo diagram UML chi tiết** — Vẽ class diagram, sequence diagram cho từng pattern
6. **Viết unit test cho các patterns** — Test Strategy Pattern, Chain of Responsibility, Producer-Consumer
7. **Tất cả các mục trên** — Phân tích toàn diện từ 1 đến 6

Hãy chọn số thứ tự hoặc mô tả yêu cầu cụ thể để tôi tiếp tục phân tích sâu hơn.
