# 🔒 CLOSURE TRONG JAVASCRIPT/TYPESCRIPT — PHÂN TÍCH THỰC TẾ TỪ DỰ ÁN NESTJS ECOMMERCE API

> **Mục đích:** Giúp developer hiểu rõ Closure là gì, cách nó hoạt động, và nhận diện Closure ngay trong code thực tế của dự án NestJS Ecommerce API.
>
> **Tại sao cần biết?** Closure là một trong những câu hỏi phỏng vấn phổ biến nhất cho vị trí Node.js Developer. Hiểu Closure giúp bạn viết code tốt hơn, debug dễ hơn, và tự tin hơn khi phỏng vấn.

---

## 📑 MỤC LỤC

1. [Closure là gì?](#1-closure-là-gì)
2. [Lexical Scope — Nền tảng của Closure](#2-lexical-scope--nền-tảng-của-closure)
3. [Cách Closure hoạt động — Giải thích bằng hình ảnh](#3-cách-closure-hoạt-động--giải-thích-bằng-hình-ảnh)
4. [9 Closure Patterns thực tế trong dự án](#4-9-closure-patterns-thực-tế-trong-dự-án)
   - 4.1 [Serialize/SerializeAll Decorator — Closure giữ lại method gốc](#41-serializeserializeall-decorator)
   - 4.2 [Auth/Roles/ZodResponseOnly Decorator — Closure giữ lại tham số](#42-authroleszodresponseonly-decorator)
   - 4.3 [ActiveUser/ActiveRolePermissions — Closure trong createParamDecorator](#43-activeuseractiverolepermissions)
   - 4.4 [CacheModule useFactory — Closure lồng nhau (Nested Closure)](#44-cachemodule-usefactory)
   - 4.5 [BullModule retryStrategy — Closure trong callback](#45-bullmodule-retrystrategy)
   - 4.6 [Interceptors — Closure trong RxJS operators](#46-interceptors--closure-trong-rxjs-operators)
   - 4.7 [CustomZodValidationPipe — Closure trong Factory Function](#47-customzodvalidationpipe)
   - 4.8 [PrismaService setupQueryLogging — Closure giữ lại hằng số](#48-prismaservice-setupquerylogging)
   - 4.9 [AuthenticationGuard — Closure inline trong object literal](#49-authenticationguard)
5. [Tổng hợp: Bảng so sánh tất cả Closure Patterns](#5-tổng-hợp-bảng-so-sánh)
6. [Best Practices & Lưu ý khi dùng Closure](#6-best-practices--lưu-ý)
7. [Câu hỏi phỏng vấn thường gặp về Closure](#7-câu-hỏi-phỏng-vấn-thường-gặp)
8. [Tóm tắt Flow — Closure trong vòng đời Request NestJS](#8-tóm-tắt-flow--closure-trong-vòng-đời-request-nestjs)
9. [Closure vs Hoisting vs Scope — So sánh chi tiết](#9-closure-vs-hoisting-vs-scope--so-sánh-chi-tiết)
10. [Currying và Partial Application — Liên hệ với Closure](#10-currying-và-partial-application--liên-hệ-với-closure)
    - 10.1 [Lý thuyết: Currying vs Partial Application](#101-lý-thuyết)
    - 10.2 [Patterns thực tế trong dự án](#102-patterns-thực-tế-trong-dự-án)
    - 10.3 [Cơ hội cải thiện code với Currying](#103-cơ-hội-cải-thiện-code)
11. [Closure Patterns trong WebSocket Gateway & CQRS](#11-closure-patterns-trong-websocket-gateway--cqrs)
    - 11.1 [WebSocket Gateway Closures](#111-websocket-gateway-closures)
    - 11.2 [Handler & Service Closures](#112-handler--service-closures)
    - 11.3 [Queue Consumer Closures](#113-queue-consumer-closures)
    - 11.4 [Tổng hợp 17 Closure Patterns](#114-tổng-hợp-17-closure-patterns)

---

## 1. Closure là gì?

### Định nghĩa đơn giản nhất

> **Closure = Hàm + Môi trường nơi hàm được tạo ra**

Khi một hàm được tạo ra bên trong một hàm khác, hàm bên trong sẽ **"nhớ"** được tất cả các biến của hàm bên ngoài — ngay cả khi hàm bên ngoài đã chạy xong và return rồi.

### Ví dụ cơ bản nhất

```typescript
function taoBoNhoDem() {
  let soLanDem = 0  // ← Biến này sẽ được "nhớ" bởi closure

  return function dem() {
    soLanDem++       // ← Hàm bên trong truy cập biến của hàm bên ngoài
    return soLanDem
  }
}

const dem = taoBoNhoDem()
console.log(dem()) // 1
console.log(dem()) // 2
console.log(dem()) // 3
// soLanDem vẫn "sống" dù taoBoNhoDem() đã chạy xong!
```

### Tại sao `soLanDem` không bị mất?

Bình thường, khi một hàm chạy xong, tất cả biến cục bộ sẽ bị **garbage collector** dọn dẹp. Nhưng khi có closure, JavaScript engine nhận ra rằng hàm `dem()` vẫn đang **tham chiếu** đến `soLanDem`, nên nó **giữ lại** biến đó trong bộ nhớ.

```
┌─────────────────────────────────────────────┐
│  taoBoNhoDem() đã chạy xong                │
│  ┌─────────────────────────────────────┐    │
│  │  soLanDem = 3  ← VẪN CÒN SỐNG!    │    │
│  │  (vì dem() vẫn tham chiếu đến nó)  │    │
│  └─────────────────────────────────────┘    │
│                    ▲                        │
│                    │ tham chiếu              │
│              ┌─────┴─────┐                  │
│              │  dem()     │                  │
│              │  (closure) │                  │
│              └───────────┘                  │
└─────────────────────────────────────────────┘
```

---

## 2. Lexical Scope — Nền tảng của Closure

### Lexical Scope là gì?

**Lexical Scope** (hay Static Scope) nghĩa là: **phạm vi của biến được xác định tại thời điểm viết code, KHÔNG phải tại thời điểm chạy code.**

```typescript
const tenApp = 'NestJS Ecommerce' // ← Scope toàn cục (Global Scope)

function hamNgoai() {
  const caiTen = 'Hàm Ngoài'      // ← Scope của hamNgoai

  function hamTrong() {
    const tuoi = 25                // ← Scope của hamTrong
    // hamTrong có thể truy cập: tuoi, caiTen, tenApp
    console.log(tenApp, caiTen, tuoi)
  }

  // hamNgoai có thể truy cập: caiTen, tenApp
  // hamNgoai KHÔNG thể truy cập: tuoi
  hamTrong()
}
```

### Scope Chain — Chuỗi tìm kiếm biến

Khi JavaScript cần tìm một biến, nó sẽ tìm theo thứ tự:

```
hamTrong scope → hamNgoai scope → Global scope
     ↑                ↑               ↑
  Tìm ở đây      Không thấy?     Không thấy?
  trước tiên      Tìm tiếp ở đây  Tìm tiếp ở đây
```

> **Closure chính là cơ chế mà hàm bên trong "nhớ" được toàn bộ scope chain này, ngay cả khi hàm bên ngoài đã kết thúc.**

---

## 3. Cách Closure hoạt động — Giải thích bằng hình ảnh

### 3 bước hình thành Closure

```
Bước 1: Hàm bên ngoài được gọi → tạo ra scope mới
┌──────────────────────────────┐
│  hamNgoai() scope            │
│  ┌────────────────────────┐  │
│  │ biến_A = 'xin chào'   │  │
│  │ biến_B = 42            │  │
│  └────────────────────────┘  │
│                              │
│  function hamTrong() { ... } │ ← Hàm bên trong được TẠO RA ở đây
└──────────────────────────────┘

Bước 2: Hàm bên ngoài return hàm bên trong
┌──────────────────────────────┐
│  hamNgoai() → return hamTrong│
│  (hamNgoai kết thúc)         │
└──────────────────────────────┘
         │
         ▼
   hamTrong mang theo "ba lô" chứa biến_A và biến_B

Bước 3: Hàm bên trong được gọi → vẫn truy cập được biến cũ
┌──────────────────────────────┐
│  hamTrong() được gọi         │
│  ┌────────────────────────┐  │
│  │ 🎒 Ba lô Closure:     │  │
│  │   biến_A = 'xin chào' │  │

---

## 4. 9 Closure Patterns thực tế trong dự án

> Phần này sẽ chỉ ra **chính xác** những chỗ trong source code dự án NestJS Ecommerce API đang sử dụng Closure, kèm giải thích chi tiết.

---

### 4.1 Serialize/SerializeAll Decorator

**📁 File:** `src/shared/decorators/serialize.decorator.ts`

**🎯 Mục đích:** Tự động serialize (chuyển đổi) kết quả trả về của method thành plain JSON object, loại bỏ các thuộc tính không serialize được (như function, Symbol...).

#### Code thực tế:

```typescript
// src/shared/decorators/serialize.decorator.ts

// ===== CLOSURE #1: Method Decorator =====
export function Serialize() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value  // ← LƯU LẠI method gốc vào closure

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)  // ← GỌI method gốc từ closure
      if (result === null || result === undefined) {
        return result
      }
      return JSON.parse(JSON.stringify(result))
    }

    return descriptor
  }
}

// ===== CLOSURE #2: Class Decorator =====
export function SerializeAll(excludeMethods: string[] = []) {
  //                         ↑ excludeMethods được capture bởi closure
  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    const prototype = constructor.prototype

    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor'
        && typeof prototype[name] === 'function'
        && !excludeMethods.includes(name)  // ← SỬ DỤNG excludeMethods từ closure
    )

    methodNames.forEach((methodName) => {
      const originalMethod = prototype[methodName]  // ← LƯU method gốc vào closure

      prototype[methodName] = async function (...args: any[]) {
        const result = await originalMethod.apply(this, args)  // ← GỌI từ closure
        if (result === null || result === undefined) {
          return result
        }
        return JSON.parse(JSON.stringify(result))
      }
    })

    return constructor
  }
}
```

#### 🔍 Phân tích Closure chi tiết:

**Closure trong `Serialize()`:**

```
┌─ Serialize() scope ──────────────────────────────────┐
│                                                       │
│  return function(target, propertyName, descriptor) {  │
│    ┌─ Closure scope ──────────────────────────────┐   │
│    │  const method = descriptor.value  ← CAPTURED │   │
│    │                                              │   │
│    │  descriptor.value = async (...args) => {     │   │
│    │    ┌─ Inner Closure ──────────────────────┐  │   │
│    │    │  await method.apply(this, args)      │  │   │
│    │    │        ↑                             │  │   │
│    │    │  method được "nhớ" từ scope bên ngoài│  │   │
│    │    └──────────────────────────────────────┘  │   │
│    │  }                                           │   │
│    └──────────────────────────────────────────────┘   │
│  }                                                    │
└───────────────────────────────────────────────────────┘
```

**Biến được capture:**
- `method` — tham chiếu đến method gốc ban đầu
- `excludeMethods` (trong SerializeAll) — mảng tên method cần bỏ qua
- `originalMethod` (trong forEach) — mỗi vòng lặp tạo một closure riêng, giữ lại method gốc tương ứng

**Tại sao cần Closure ở đây?**
- Decorator cần **thay thế** method gốc bằng method mới
- Method mới cần **gọi lại** method gốc → phải "nhớ" method gốc qua closure
- Nếu không có closure, sau khi `descriptor.value` bị ghi đè, method gốc sẽ bị mất vĩnh viễn

---

### 4.2 Auth/Roles/ZodResponseOnly Decorator

**📁 Files:**
- `src/shared/decorators/auth.decorator.ts`
- `src/shared/decorators/roles.decorator.ts`
- `src/shared/decorators/zod-response-only.decorator.ts`

**🎯 Mục đích:** Gắn metadata lên controller/method để hệ thống Guard và Interceptor đọc được.

#### Code thực tế:

```typescript
// src/shared/decorators/auth.decorator.ts
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  //                  ↑ authTypes được capture     ↑ options được capture
  return SetMetadata(AUTH_TYPE_KEY, {
    authTypes,   // ← SỬ DỤNG từ closure
    options: options ?? { condition: ConditionGuard.And }  // ← SỬ DỤNG từ closure
  })
}

// Tái sử dụng — IsPublic() gọi Auth() → tạo closure mới
export const IsPublic = () => Auth([AuthType.None])

// src/shared/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
//                      ↑ roles được capture bởi closure bên trong SetMetadata

// src/shared/decorators/zod-response-only.decorator.ts
export const ZodResponseOnly = (options: ZodResponseOnlyOptions) =>
  SetMetadata(ZOD_RESPONSE_ONLY_KEY, options)
//                                    ↑ options được capture
```

#### 🔍 Phân tích Closure:

```typescript
// Khi bạn viết:
@Auth([AuthType.Bearer, AuthType.PaymentAPIKey], { condition: ConditionGuard.Or })

// Thực chất là:
// 1. Auth() được gọi với authTypes = [AuthType.Bearer, AuthType.PaymentAPIKey]
// 2. Auth() return một decorator function
// 3. Decorator function đó "nhớ" authTypes và options qua closure
// 4. Khi NestJS apply decorator, nó gọi SetMetadata với giá trị từ closure
```

**Biến được capture:** `authTypes`, `options`, `roles`, `options` (tùy decorator)

**Tại sao cần Closure?**
- Decorator trong TypeScript là **factory function** — hàm trả về hàm
- Tham số truyền vào decorator (`@Auth([...])`) cần được **"nhớ"** để dùng sau khi decorator được apply
- Mỗi lần dùng `@Auth(...)` tạo ra một closure riêng biệt với giá trị riêng


---

### 4.3 ActiveUser/ActiveRolePermissions

**📁 Files:**
- `src/shared/decorators/active-user.decorator.ts`
- `src/shared/decorators/active-role-permissions.decorator.ts`
- `src/shared/decorators/user-agent.decorator.ts`

**🎯 Mục đích:** Tạo custom parameter decorator để extract dữ liệu từ request object (user info, role permissions, user-agent).

#### Code thực tế:

```typescript
// src/shared/decorators/active-user.decorator.ts
export const ActiveUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
    //     ↑ field được capture từ khi decorator được gọi
  },
)

// src/shared/decorators/active-role-permissions.decorator.ts
export const ActiveRolePermissions = createParamDecorator(
  (field: keyof RolePermissionsType | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const rolePermissions: RolePermissionsType | undefined = request[REQUEST_ROLE_PERMISSIONS]
    return field ? rolePermissions?.[field] : rolePermissions
  },
)

// src/shared/decorators/user-agent.decorator.ts
export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.headers['user-agent'] as string
  },
)
```

#### 🔍 Phân tích Closure:

```typescript
// Khi bạn viết trong controller:
@Get('profile')
getProfile(@ActiveUser('userId') userId: number) { ... }

// Bên trong NestJS, createParamDecorator hoạt động như sau:
function createParamDecorator(factory) {
  // factory = (field, context) => { ... }
  return (data) => {
    //  ↑ data = 'userId' khi dùng @ActiveUser('userId')
    // NestJS lưu factory + data vào metadata
    // Khi request đến, NestJS gọi: factory(data, executionContext)
    //                                       ↑ data được "nhớ" qua closure
  }
}
```

**Biến được capture:**
- `field` / `data` — tên field cần extract (ví dụ: `'userId'`, `'roleId'`)
- `REQUEST_USER_KEY`, `REQUEST_ROLE_PERMISSIONS` — constants từ module scope (closure over module scope)

**Tại sao cần Closure?**
- `createParamDecorator` tạo ra một **factory** mà NestJS sẽ gọi **sau này** khi có request
- Giá trị `field` truyền vào lúc khai báo (`@ActiveUser('userId')`) cần được **"nhớ"** đến khi request thực sự đến
- Mỗi parameter decorator tạo closure riêng: `@ActiveUser('userId')` và `@ActiveUser('roleId')` là 2 closure khác nhau

---

### 4.4 CacheModule useFactory

**📁 File:** `src/app.module.ts` (dòng 88-114)

**🎯 Mục đích:** Khởi tạo Redis Cache với cấu hình động, bao gồm retry strategy.

#### Code thực tế:

```typescript
// src/app.module.ts
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => {
    const logger = new Logger('CacheModule')  // ← Biến cục bộ trong useFactory
    const store = createKeyv(
      {
        url: envConfig.REDIS_URL,  // ← envConfig từ module scope (closure)
        socket: {
          connectTimeout: 15000,
          reconnectStrategy: (retries: number) => {
            // ↑ Đây là CLOSURE LỒNG NHAU (Nested Closure)!
            // Hàm này "nhớ" được biến `logger` từ useFactory scope
            if (retries > 10) {
              logger.error('Cache Redis: max retries reached, stopping reconnection')
              //  ↑ logger được capture từ useFactory scope
              return new Error('Cache Redis: max retries reached')
            }
            logger.warn(`Cache Redis: reconnecting, attempt ${retries}`)
            return Math.min(retries * 200, 5000)
          },
        },
      },
      {
        useUnlink: true,
        throwOnConnectError: process.env.NODE_ENV === 'production',
      },
    )
    return { stores: [store] }
  },
}),
```

#### 🔍 Phân tích Closure — Nested Closure (Closure lồng nhau):

```
┌─ Module Scope ──────────────────────────────────────────┐
│  envConfig (từ src/shared/config.ts)  ← CAPTURED        │
│                                                          │
│  ┌─ useFactory() scope ──────────────────────────────┐   │
│  │  const logger = new Logger('CacheModule') ← LOCAL │   │
│  │                                                   │   │
│  │  ┌─ reconnectStrategy() scope ─────────────────┐  │   │
│  │  │  (retries: number) => {                     │  │   │
│  │  │    logger.error(...)  ← CLOSURE! (từ tầng 2)│  │   │
│  │  │    envConfig.REDIS_URL ← CLOSURE! (từ tầng 1)│ │   │
│  │  │  }                                          │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Biến được capture:**
- `logger` — instance Logger, được tạo trong useFactory, dùng trong reconnectStrategy
- `envConfig` — config object từ module scope, dùng cho `REDIS_URL`

**Điểm đặc biệt — Nested Closure:**
- `reconnectStrategy` là closure bên trong `useFactory` — tức là closure lồng trong closure
- `reconnectStrategy` được Redis client gọi **nhiều lần** khi mất kết nối
- Mỗi lần gọi, nó vẫn truy cập được `logger` — vì closure giữ tham chiếu

---

### 4.5 BullModule retryStrategy

**📁 File:** `src/app.module.ts` (dòng 117-128)

**🎯 Mục đích:** Cấu hình chiến lược retry khi BullMQ mất kết nối Redis.

#### Code thực tế:

```typescript
// src/app.module.ts
BullModule.forRoot({
  connection: {
    url: envConfig.REDIS_URL,
    connectTimeout: 15000,
    commandTimeout: 10000,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    retryStrategy: (times: number) => {
      // ↑ Closure! Hàm này được Redis client gọi mỗi khi cần retry
      // `times` là tham số, nhưng hàm này cũng capture envConfig từ module scope
      if (times > 10) return null  // Dừng retry sau 10 lần
      return Math.min(times * 200, 5000)  // Exponential backoff, max 5s
    },
  },
  // ...
}),
```

#### 🔍 Phân tích Closure:

**Biến được capture:**
- `envConfig` — từ module scope (dùng cho `REDIS_URL` ở dòng trên)
- Hàm `retryStrategy` tuy đơn giản nhưng vẫn là closure vì nó được **định nghĩa** trong context của `BullModule.forRoot()` và được **gọi** bởi Redis client ở thời điểm khác

**So sánh với CacheModule reconnectStrategy:**
- Cả hai đều là closure callback cho Redis retry
- CacheModule có nested closure (capture `logger`), BullModule đơn giản hơn
- Pattern giống nhau: **hàm được định nghĩa ở một nơi, gọi ở nơi khác**

---

### 4.6 Interceptors — Closure trong RxJS operators

**📁 Files:**
- `src/shared/interceptor/transform.interceptor.ts`
- `src/shared/interceptor/logging.interceptor.ts`
- `src/shared/interceptors/zod-output.interceptor.ts`

**🎯 Mục đích:** Transform response data, logging, và validate output với Zod schema.

#### Code thực tế:

```typescript
// ===== TransformInterceptor =====
// src/shared/interceptor/transform.interceptor.ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // ↑ Arrow function này là CLOSURE!
        // Nó capture biến `context` từ intercept() scope
        const ctx = context.switchToHttp()  // ← context từ closure
        const response = ctx.getResponse()
        const statusCode = response.statusCode
        return { data, statusCode }
      }),
    )
  }
}

// ===== LoggingInterceptor =====
// src/shared/interceptor/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name)
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((data) => {
        // ↑ CLOSURE! Capture `this.logger` từ class instance
        this.logger.log({ body: data })
      }),
    )
  }
}

// ===== ZodOutputInterceptor =====
// src/shared/interceptors/zod-output.interceptor.ts
@Injectable()
export class ZodOutputInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZodOutputInterceptor.name)
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()    // ← Biến cục bộ
    const controller = context.getClass()   // ← Biến cục bộ

    return next.handle().pipe(
      map((data) => {
        // ↑ CLOSURE! Capture: handler, controller, this.reflector, this.logger
        const zodResponseOptions = this.reflector.get<{ type: any }>(
          ZOD_RESPONSE_ONLY_KEY, handler  // ← handler từ closure
        )
        if (zodResponseOptions?.type) {
          try {
            const schema = zodResponseOptions.type
            if (schema && typeof schema.parse === 'function') {
              return schema.parse(data)
            }
          } catch (error) {
            this.logger.warn(  // ← this.logger từ closure
              `Zod output validation failed for ${controller.name}.${handler.name}`
              //                                   ↑ controller từ closure
            )
          }
        }
        return data
      }),
    )
  }
}
```

#### 🔍 Phân tích Closure — Tại sao RxJS operators luôn tạo Closure?

```
Thời điểm 1: intercept() được gọi
┌─ intercept() scope ─────────────────────────┐
│  context = ExecutionContext                   │
│  handler = context.getHandler()              │
│  controller = context.getClass()             │
│                                              │
│  return next.handle().pipe(                  │
│    map((data) => {                           │
│      // Hàm này CHƯA chạy!                  │
│      // Nó chỉ được ĐĂNG KÝ vào Observable  │
│    })                                        │
│  )                                           │
└──────────────────────────────────────────────┘

Thời điểm 2: Response data đến → map() callback được gọi
┌─ map() callback scope ──────────────────────┐
│  data = response data (tham số)              │
│                                              │
│  🎒 Closure "ba lô":                        │
│    context ← từ intercept() scope            │
│    handler ← từ intercept() scope            │
│    controller ← từ intercept() scope         │
│    this.reflector ← từ class instance        │
│    this.logger ← từ class instance           │
└──────────────────────────────────────────────┘
```

**Biến được capture:**
- `context`, `handler`, `controller` — từ `intercept()` method scope
- `this.reflector`, `this.logger` — từ class instance (qua `this` binding)

**Tại sao cần Closure ở đây?**
- RxJS `map()` và `tap()` nhận callback function
- Callback này chạy **BẤT ĐỒNG BỘ** — sau khi `intercept()` đã return
- Callback cần truy cập `context`, `handler` → phải "nhớ" qua closure
- Đây là pattern **cực kỳ phổ biến** trong NestJS vì mọi interceptor đều dùng RxJS

---

### 4.7 CustomZodValidationPipe

**📁 File:** `src/shared/pipes/custom-zod-validation.pipe.ts`

**🎯 Mục đích:** Tùy chỉnh cách format lỗi validation khi request body/query không hợp lệ.

#### Code thực tế:

```typescript
// src/shared/pipes/custom-zod-validation.pipe.ts
const CustomZodValidationPipe: typeof ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    // ↑ Đây là CLOSURE!
    // Hàm callback này được truyền vào createZodValidationPipe
    // và sẽ được gọi SAU NÀY mỗi khi có validation error

    return new UnprocessableEntityException(
      error.issues.map((issue) => {
        // ↑ Closure lồng! Arrow function trong .map() capture `error` từ scope ngoài
        return {
          message: issue.message,
          path: issue.path.join('.'),
          code: issue.code,
        }
      }),
    )
  },
})
```

#### 🔍 Phân tích Closure:

```
┌─ createZodValidationPipe() ──────────────────────────────┐
│  Nhận config object chứa createValidationException       │
│                                                           │
│  ┌─ createValidationException(error) ─────────────────┐  │
│  │  error = ZodError instance  ← THAM SỐ              │  │
│  │                                                     │  │
│  │  error.issues.map((issue) => {                      │  │
│  │    ┌─ .map() callback ──────────────────────────┐   │  │
│  │    │  issue = từng lỗi  ← THAM SỐ              │   │  │
│  │    │  error ← CLOSURE (từ scope ngoài)          │   │  │
│  │    │  UnprocessableEntityException ← MODULE SCOPE│  │  │
│  │    └────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  → Return: CustomZodValidationPipe class                  │
│  → createValidationException được "nhớ" bên trong class   │
└───────────────────────────────────────────────────────────┘
```

**Biến được capture:**
- `error` — ZodError object, được capture bởi `.map()` callback
- `UnprocessableEntityException` — import từ `@nestjs/common` (module scope)

**Tại sao cần Closure?**
- `createZodValidationPipe` là **factory function** — nó tạo ra một Pipe class
- `createValidationException` callback được **lưu lại** bên trong Pipe class
- Mỗi khi có validation error, Pipe gọi callback này → callback "nhớ" cách format lỗi qua closure

---

### 4.8 PrismaService setupQueryLogging

**📁 File:** `src/shared/services/prisma.service.ts` (dòng 26-34)

**🎯 Mục đích:** Log các query chậm (slow query) trong môi trường development.

#### Code thực tế:

```typescript
// src/shared/services/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({ /* ... */ })
    if (process.env.NODE_ENV === 'development') {
      this.setupQueryLogging()
    }
  }

  private setupQueryLogging() {
    const SLOW_QUERY_THRESHOLD_MS = 1000  // ← Hằng số cục bộ

    ;(this as any).$on('query', (e: Prisma.QueryEvent) => {
      // ↑ CLOSURE! Callback này capture:
      //   - SLOW_QUERY_THRESHOLD_MS từ setupQueryLogging() scope
      //   - this.logger từ class instance
      if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`)
        //                                       ↑ SLOW_QUERY_THRESHOLD_MS từ closure
      }
    })
  }
}
```

#### 🔍 Phân tích Closure:

```
┌─ setupQueryLogging() scope ──────────────────────────────┐
│  const SLOW_QUERY_THRESHOLD_MS = 1000  ← LOCAL VARIABLE  │
│                                                           │
│  this.$on('query', (e) => {                              │
│    ┌─ Event callback (CLOSURE) ────────────────────────┐  │
│    │  e = QueryEvent  ← THAM SỐ                       │  │
│    │                                                   │  │
│    │  🎒 Closure "ba lô":                              │  │
│    │    SLOW_QUERY_THRESHOLD_MS = 1000 ← từ scope ngoài│  │
│    │    this.logger ← từ class instance                │  │
│    │                                                   │  │
│    │  if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {     │  │
│    │    this.logger.warn(...)                           │  │
│    │  }                                                │  │
│    └───────────────────────────────────────────────────┘  │
│  })                                                       │
│                                                           │
│  setupQueryLogging() KẾT THÚC                            │
│  Nhưng SLOW_QUERY_THRESHOLD_MS VẪN SỐNG                  │
│  vì event callback vẫn tham chiếu đến nó!                │
└───────────────────────────────────────────────────────────┘
```

**Biến được capture:**
- `SLOW_QUERY_THRESHOLD_MS` — hằng số ngưỡng query chậm (1000ms)
- `this` (implicit) — tham chiếu đến PrismaService instance, dùng cho `this.logger`

**Tại sao cần Closure?**
- `$on('query', callback)` đăng ký event listener — callback sẽ được gọi **mỗi khi có query**
- `setupQueryLogging()` chạy **một lần** trong constructor, nhưng callback chạy **nhiều lần**
- `SLOW_QUERY_THRESHOLD_MS` cần tồn tại suốt vòng đời ứng dụng → closure giữ nó sống

---

### 4.9 AuthenticationGuard

**📁 File:** `src/shared/guards/authentication.guard.ts` (dòng 16-21)

**🎯 Mục đích:** Map auth type sang guard tương ứng, bao gồm một inline closure cho `AuthType.None`.

#### Code thực tế:

```typescript
// src/shared/guards/authentication.guard.ts
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authTypeGuardMap: Record<string, CanActivate>

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly paymentAPIKeyGuard: PaymentAPIKeyGuard,
  ) {
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
      [AuthType.None]: { canActivate: () => true },
      //                               ↑ CLOSURE INLINE!
      // Arrow function này luôn return true
      // Nó capture `this` từ constructor scope (implicit)
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypeValue = this.getAuthTypeValue(context)
    const guards = authTypeValue.authTypes.map(
      (authType) => this.authTypeGuardMap[authType]
      // ↑ Arrow function capture `this` từ canActivate scope
    )

    return authTypeValue.options.condition === ConditionGuard.And
      ? this.handleAndCondition(guards, context)
      : this.handleOrCondition(guards, context)
  }
}
```

#### 🔍 Phân tích Closure:

```typescript
// Dòng quan trọng nhất:
[AuthType.None]: { canActivate: () => true }

// Đây là closure đơn giản nhất trong project:
// - Arrow function `() => true` không capture biến nào đặc biệt
// - Nhưng nó VẪN LÀ closure vì nó được tạo trong constructor scope
// - Nó "nhớ" được `this` (implicit trong arrow function)
// - Nó được lưu vào authTypeGuardMap và gọi SAU NÀY khi có request
```

**Biến được capture:**
- `this` (implicit) — arrow function kế thừa `this` từ constructor

**Tại sao cần Closure?**
- `AuthType.None` cần một "guard giả" luôn cho phép truy cập
- Thay vì tạo một class riêng, dùng inline closure `() => true` gọn hơn nhiều
- Pattern này gọi là **Null Object Pattern** kết hợp với closure

---

## 5. Tổng hợp: Bảng so sánh tất cả Closure Patterns

| # | Pattern | File | Biến được Capture | Loại Closure |
|---|---------|------|-------------------|--------------|
| 1 | Serialize/SerializeAll | `serialize.decorator.ts` | `method`, `originalMethod`, `excludeMethods` | Decorator Factory |
| 2 | Auth/Roles/ZodResponseOnly | `auth.decorator.ts`, `roles.decorator.ts` | `authTypes`, `options`, `roles` | Decorator Factory |
| 3 | ActiveUser/ActiveRolePermissions | `active-user.decorator.ts` | `field`, `REQUEST_USER_KEY` | Param Decorator |
| 4 | CacheModule useFactory | `app.module.ts` | `logger`, `envConfig` | Nested Closure |
| 5 | BullModule retryStrategy | `app.module.ts` | `envConfig` | Callback Closure |
| 6 | Interceptors (Transform/Logging/Zod) | `transform.interceptor.ts`, etc. | `context`, `handler`, `controller` | RxJS Operator Closure |
| 7 | CustomZodValidationPipe | `custom-zod-validation.pipe.ts` | `error`, `UnprocessableEntityException` | Factory Callback |
| 8 | PrismaService setupQueryLogging | `prisma.service.ts` | `SLOW_QUERY_THRESHOLD_MS`, `this.logger` | Event Listener Closure |
| 9 | AuthenticationGuard | `authentication.guard.ts` | `this` (implicit) | Inline/Null Object |

### Phân loại theo mức độ phức tạp:

```
Đơn giản ──────────────────────────────────────── Phức tạp

() => true     Roles(...)     Serialize()     CacheModule
(Pattern 9)    (Pattern 2)    (Pattern 1)     useFactory
                                              (Pattern 4)
   │               │              │               │
   ▼               ▼              ▼               ▼
Không capture   Capture       Capture +       Nested closure
biến nào        tham số       thay thế        + capture
đặc biệt       decorator     method gốc      nhiều tầng
```

---

## 6. Best Practices & Lưu ý

### ✅ Khi nào NÊN dùng Closure trong NestJS

1. **Decorator Factory** — Khi cần tạo decorator có tham số
   ```typescript
   // ✅ Tốt: Closure giữ lại tham số decorator
   export const Auth = (authTypes: AuthTypeType[]) => SetMetadata(AUTH_TYPE_KEY, authTypes)
   ```

2. **Event Listener / Callback** — Khi cần truy cập biến từ scope ngoài
   ```typescript
   // ✅ Tốt: Closure giữ lại threshold
   const THRESHOLD = 1000
   this.$on('query', (e) => {
     if (e.duration >= THRESHOLD) { /* ... */ }
   })
   ```

3. **RxJS Operators** — Khi cần context trong pipe chain
   ```typescript
   // ✅ Tốt: Closure giữ lại context
   return next.handle().pipe(
     map((data) => {
       const ctx = context.switchToHttp() // context từ closure
       return { data, statusCode: ctx.getResponse().statusCode }
     })
   )
   ```

### ⚠️ Lưu ý quan trọng

#### 1. Memory Leak — Rò rỉ bộ nhớ

```typescript
// ❌ NGUY HIỂM: Closure giữ tham chiếu đến object lớn
function processData() {
  const hugeData = loadGigabyteFile()  // 1GB data

  return function getSize() {
    return hugeData.length  // Closure giữ hugeData → 1GB không bao giờ được giải phóng!
  }
}

// ✅ AN TOÀN: Chỉ capture giá trị cần thiết
function processData() {
  const hugeData = loadGigabyteFile()
  const size = hugeData.length  // Lấy giá trị cần thiết

  return function getSize() {
    return size  // Chỉ capture `size` (number) → hugeData được giải phóng
  }
}
```

#### 2. Closure trong vòng lặp — Bẫy kinh điển

```typescript
// ❌ SAI: Tất cả closure cùng tham chiếu đến biến `i`
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100)
}
// Output: 3, 3, 3 (không phải 0, 1, 2!)

// ✅ ĐÚNG cách 1: Dùng `let` (block scope)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100)
}
// Output: 0, 1, 2

// ✅ ĐÚNG cách 2: Dùng IIFE tạo scope mới
for (var i = 0; i < 3; i++) {
  ((j) => {
    setTimeout(() => console.log(j), 100)
  })(i)
}
// Output: 0, 1, 2
```

> **Trong dự án này**, `SerializeAll` dùng `forEach` + `const` nên KHÔNG gặp vấn đề này:
> ```typescript
> methodNames.forEach((methodName) => {
>   const originalMethod = prototype[methodName]  // ← const trong mỗi iteration
>   // Mỗi closure có originalMethod riêng biệt ✅
> })
> ```

#### 3. Performance — Closure có chậm không?

```
Tạo closure:     ~0.001ms (không đáng kể)
Truy cập biến:   Giống như truy cập biến thường
Memory overhead:  Chỉ giữ các biến được tham chiếu, KHÔNG giữ toàn bộ scope

→ Kết luận: Closure KHÔNG ảnh hưởng performance đáng kể trong NestJS
→ V8 engine tối ưu hóa closure rất tốt
```

---

## 7. Câu hỏi phỏng vấn thường gặp về Closure

### Câu 1: "Closure là gì? Giải thích bằng lời đơn giản."

> **Trả lời mẫu:** Closure là khi một hàm được tạo bên trong hàm khác, và hàm bên trong có thể truy cập các biến của hàm bên ngoài — ngay cả khi hàm bên ngoài đã chạy xong. Nói đơn giản, closure giống như một hàm mang theo "ba lô" chứa các biến từ nơi nó được sinh ra.

### Câu 2: "Cho ví dụ thực tế về Closure trong dự án của bạn."

> **Trả lời mẫu:** Trong dự án NestJS của tôi, closure được dùng rất nhiều. Ví dụ rõ nhất là custom decorator `@Serialize()`. Decorator này cần thay thế method gốc bằng method mới có thêm logic serialize. Method mới cần gọi lại method gốc, nên nó phải "nhớ" method gốc qua closure:
>
> ```typescript
> export function Serialize() {
>   return function (target, propertyName, descriptor) {
>     const method = descriptor.value  // Lưu method gốc
>     descriptor.value = async function (...args) {
>       const result = await method.apply(this, args)  // Gọi method gốc từ closure
>       return JSON.parse(JSON.stringify(result))
>     }
>   }
> }
> ```

### Câu 3: "Closure có thể gây memory leak không? Cho ví dụ."

> **Trả lời mẫu:** Có. Closure giữ tham chiếu đến biến từ scope ngoài, nên nếu biến đó là object lớn mà closure tồn tại lâu, object đó sẽ không được garbage collect. Ví dụ: nếu event listener closure tham chiếu đến một mảng lớn, mảng đó sẽ tồn tại suốt đời ứng dụng. Cách khắc phục: chỉ capture giá trị cần thiết, không capture toàn bộ object.

### Câu 4: "Sự khác nhau giữa Closure và Scope?"

> **Trả lời mẫu:**
> - **Scope** là phạm vi mà biến có thể được truy cập — được xác định lúc viết code (lexical scope)
> - **Closure** là cơ chế mà hàm "nhớ" được scope nơi nó được tạo ra — ngay cả khi scope đó đã kết thúc
> - Scope là "luật", Closure là "khả năng nhớ luật"

### Câu 5: "Output của đoạn code sau là gì?"

```typescript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0)
}
```

> **Trả lời:** Output là `3, 3, 3`. Vì `var` có function scope (không phải block scope), tất cả 3 closure cùng tham chiếu đến **một biến `i` duy nhất**. Khi setTimeout callback chạy, vòng lặp đã kết thúc và `i = 3`. Sửa bằng cách dùng `let` thay `var`.

### Câu 6: "Trong NestJS, chỗ nào dùng Closure nhiều nhất?"

> **Trả lời mẫu:** Closure xuất hiện ở khắp nơi trong NestJS:
> 1. **Decorators** — Mọi decorator factory đều tạo closure (`@Auth()`, `@Roles()`, `@Serialize()`)
> 2. **Interceptors** — Callback trong `map()`, `tap()` của RxJS đều là closure
> 3. **useFactory providers** — Factory function capture dependencies
> 4. **Event listeners** — Callback trong `$on()` của Prisma, Redis reconnect strategy
> 5. **Guards** — Inline function trong object literal (`canActivate: () => true`)

---

## 8. Tóm tắt Flow — Closure trong vòng đời Request NestJS

```
Request đến
    │
    ▼
┌─ Guard (AuthenticationGuard) ─────────────────────────────────┐
│  authTypeGuardMap[AuthType.None] = { canActivate: () => true }│
│                                                    ↑ Closure  │
│  guards.map((authType) => this.authTypeGuardMap[authType])    │
│              ↑ Closure (capture this)                         │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Pipe (CustomZodValidationPipe) ──────────────────────────────┐
│  createValidationException: (error) => {                      │
│    error.issues.map((issue) => ({ ... }))                     │
│                  ↑ Closure (capture error)                    │
│  }                                                            │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Controller ──────────────────────────────────────────────────┐
│  @Auth([AuthType.Bearer])  ← Closure giữ authTypes           │
│  @ActiveUser('userId')     ← Closure giữ field='userId'      │
│  @Roles('ADMIN')           ← Closure giữ roles=['ADMIN']     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Service → Repository → Prisma ───────────────────────────────┐
│  PrismaService.$on('query', (e) => {                          │
│    if (e.duration >= SLOW_QUERY_THRESHOLD_MS) { ... }         │
│                      ↑ Closure giữ threshold                  │
│  })                                                           │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Interceptor (Response) ──────────────────────────────────────┐
│  next.handle().pipe(                                          │
│    map((data) => {                                            │
│      context.switchToHttp()  ← Closure giữ context            │
│      handler.name            ← Closure giữ handler            │
│    })                                                         │
│  )                                                            │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
Response trả về
```

---

## 9. Closure vs Hoisting vs Scope — So sánh chi tiết

> Ba khái niệm **Closure**, **Hoisting**, và **Scope** thường bị nhầm lẫn hoặc hiểu sai mối quan hệ. Phần này sẽ giải thích rõ từng khái niệm và cách chúng **tương tác với nhau** trong JavaScript/TypeScript.

### 9.1 Định nghĩa nhanh

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXECUTION CONTEXT                            │
│                                                                     │
│  ┌─── HOISTING ───┐   ┌─── SCOPE ────┐   ┌─── CLOSURE ────┐      │
│  │ Đưa khai báo   │   │ Phạm vi      │   │ Hàm + Môi      │      │
│  │ lên đầu scope  │   │ truy cập     │   │ trường nơi     │      │
│  │ TRƯỚC khi      │   │ biến trong   │   │ hàm được       │      │
│  │ code chạy      │   │ code         │   │ tạo ra         │      │
│  └────────────────┘   └──────────────┘   └────────────────┘      │
│         ↓                    ↓                    ↓                │
│     KHI NÀO?           Ở ĐÂU?             GIỮ LẠI GÌ?           │
│  (Compile phase)     (Runtime access)    (Persistent reference)   │
└─────────────────────────────────────────────────────────────────────┘
```

| Khái niệm | Định nghĩa | Thời điểm | Ví dụ nhanh |
|-----------|------------|-----------|-------------|
| **Hoisting** | JS engine "nâng" khai báo biến/hàm lên đầu scope trước khi chạy code | Compile phase | `var x` → khai báo ở đầu, gán giá trị tại chỗ |
| **Scope** | Phạm vi mà biến có thể được truy cập | Runtime | `{ let x = 1 }` → `x` chỉ tồn tại trong `{}` |
| **Closure** | Hàm "nhớ" được biến từ scope nơi nó được tạo ra | Runtime (persistent) | Hàm con truy cập biến hàm cha sau khi cha đã return |

### 9.2 Ba loại Scope trong JavaScript

```typescript
// 1️⃣ GLOBAL SCOPE — Truy cập được ở mọi nơi
const APP_NAME = 'NestJS Ecommerce API'

// 2️⃣ FUNCTION SCOPE — Chỉ truy cập trong hàm
function createUser() {
  var tempToken = 'abc123'  // var → function scope
  let userId = 1            // let → block scope (nhưng ở đây = function scope)
}
// ❌ tempToken không tồn tại ở đây
// ❌ userId không tồn tại ở đây

// 3️⃣ BLOCK SCOPE — Chỉ truy cập trong block {}
if (true) {
  let blockVar = 'only here'
  const blockConst = 'also only here'
  var functionVar = 'escapes block!'  // ⚠️ var KHÔNG bị giới hạn bởi block
}
// ❌ blockVar → ReferenceError
// ❌ blockConst → ReferenceError
// ✅ functionVar → 'escapes block!' (var chỉ bị giới hạn bởi function)
```

### 9.3 Hoisting — Chi tiết cách hoạt động

```typescript
// ═══════════════════════════════════════════════
// HOISTING VỚI var, let, const, function
// ═══════════════════════════════════════════════

// 🔴 var — Hoisted + initialized = undefined
console.log(a)  // undefined (không lỗi, nhưng chưa có giá trị)
var a = 10

// 🔴 let/const — Hoisted nhưng KHÔNG initialized → TDZ (Temporal Dead Zone)
console.log(b)  // ❌ ReferenceError: Cannot access 'b' before initialization
let b = 20

// 🟢 function declaration — Hoisted HOÀN TOÀN (cả tên + body)
sayHello()  // ✅ "Hello!" — chạy được trước khi khai báo
function sayHello() { console.log('Hello!') }

// 🔴 function expression — KHÔNG hoisted (vì gán vào biến)
greet()  // ❌ TypeError: greet is not a function
var greet = function() { console.log('Hi!') }

// 🔴 arrow function — KHÔNG hoisted (vì gán vào biến)
welcome()  // ❌ ReferenceError (nếu dùng let/const)
const welcome = () => console.log('Welcome!')
```

### 9.4 Temporal Dead Zone (TDZ) — Vùng chết tạm thời

```
┌─────────────────────────────────────────┐
│ {                                       │
│   // ← TDZ bắt đầu cho biến 'x'       │
│   console.log(x)  // ❌ ReferenceError  │
│   // ← TDZ vẫn đang active             │
│   let x = 10      // ← TDZ kết thúc    │
│   console.log(x)  // ✅ 10             │
│ }                                       │
└─────────────────────────────────────────┘
```

> **TDZ** là khoảng từ đầu block đến dòng khai báo `let`/`const`. Biến đã được hoisted (JS engine biết nó tồn tại) nhưng chưa được initialized → truy cập sẽ bị lỗi.

### 9.5 Mối quan hệ giữa Hoisting, Scope và Closure

```typescript
// ═══════════════════════════════════════════════
// BA KHÁI NIỆM TƯƠNG TÁC VỚI NHAU
// ═══════════════════════════════════════════════

function outerFunction() {
  // HOISTING: khai báo 'counter' được nâng lên đầu function scope
  // SCOPE: 'counter' thuộc function scope của outerFunction
  let counter = 0

  function innerFunction() {
    // CLOSURE: innerFunction "nhớ" biến 'counter' từ scope cha
    // SCOPE: innerFunction có thể truy cập scope của outerFunction (lexical scope)
    counter++
    return counter
  }

  return innerFunction
  // Sau khi return, outerFunction kết thúc
  // Nhưng 'counter' KHÔNG bị garbage collected
  // Vì innerFunction (closure) vẫn giữ reference đến nó
}

const increment = outerFunction()
increment()  // 1 — closure giữ counter sống
increment()  // 2 — counter vẫn tồn tại nhờ closure
```

### 9.6 Ví dụ thực tế từ dự án — Ba khái niệm cùng hoạt động

```typescript
// File: src/shared/decorators/serialize.decorator.ts
// ═══════════════════════════════════════════════════

export function SerializeAll(excludeMethods: string[] = []) {
  // SCOPE: excludeMethods thuộc function scope của SerializeAll
  // HOISTING: excludeMethods được khai báo như parameter → hoisted trong function scope

  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    // CLOSURE #1: Hàm này "nhớ" excludeMethods từ scope cha

    const prototype = constructor.prototype
    // SCOPE: prototype thuộc block scope của hàm này

    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor'
        && typeof prototype[name] === 'function'
        && !excludeMethods.includes(name)
        //  ↑ CLOSURE: truy cập excludeMethods từ scope cha
    )

    methodNames.forEach((methodName) => {
      const originalMethod = prototype[methodName]
      // SCOPE: originalMethod thuộc block scope của forEach callback

      prototype[methodName] = async function (...args: any[]) {
        // CLOSURE #2: Hàm này "nhớ" originalMethod từ scope cha
        const result = await originalMethod.apply(this, args)
        //                    ↑ CLOSURE: truy cập originalMethod

        if (result === null || result === undefined) {
          return result
        }
        return JSON.parse(JSON.stringify(result))
      }
    })

    return constructor
  }
}
```

### 9.7 Bảng so sánh tổng hợp

| Tiêu chí | Hoisting | Scope | Closure |
|----------|----------|-------|---------|
| **Là gì?** | Cơ chế nâng khai báo | Phạm vi truy cập biến | Hàm + môi trường tạo ra nó |
| **Xảy ra khi nào?** | Compile phase (trước khi chạy) | Được xác định khi viết code (lexical) | Khi hàm được tạo bên trong hàm khác |
| **Ảnh hưởng gì?** | Thứ tự khai báo vs sử dụng | Biến nào truy cập được ở đâu | Biến nào được "giữ sống" |
| **var** | ✅ Hoisted + `undefined` | Function scope | Có thể bị capture bởi closure |
| **let/const** | ✅ Hoisted nhưng TDZ | Block scope | Có thể bị capture bởi closure |
| **function** | ✅ Hoisted hoàn toàn | Function scope | Chính nó có thể là closure |
| **arrow function** | ❌ Không hoisted | Block scope (vì let/const) | Chính nó có thể là closure |
| **Lỗi phổ biến** | Dùng var trong vòng lặp | Truy cập biến ngoài scope | Memory leak do closure giữ reference |

### 9.8 Gotcha kinh điển — Closure + var + Hoisting trong vòng lặp

```typescript
// ❌ BUG KINH ĐIỂN: var + closure trong vòng lặp
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i)  // Closure capture biến 'i'
  }, 100)
}
// Output: 3, 3, 3 (không phải 0, 1, 2!)
// Lý do: var i → function scope → chỉ có 1 biến i
//         Closure capture REFERENCE, không capture VALUE
//         Khi setTimeout chạy, i đã = 3

// ✅ FIX 1: Dùng let (block scope → mỗi iteration có biến riêng)
for (let i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i)  // Mỗi closure capture biến i riêng
  }, 100)
}
// Output: 0, 1, 2 ✅

// ✅ FIX 2: Dùng IIFE tạo scope mới (cách cũ trước ES6)
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => {
      console.log(j)  // Closure capture j (copy của i)
    }, 100)
  })(i)
}
// Output: 0, 1, 2 ✅
```

### 9.9 Câu hỏi phỏng vấn kết hợp cả 3 khái niệm

**Câu hỏi:** Output của đoạn code sau là gì? Giải thích tại sao.

```typescript
function createFunctions() {
  var result = []

  for (var i = 0; i < 3; i++) {
    result.push(function() { return i })
  }

  return result
}

const funcs = createFunctions()
console.log(funcs[0]())  // ?
console.log(funcs[1]())  // ?
console.log(funcs[2]())  // ?
```

**Trả lời:**

```
Output: 3, 3, 3

Giải thích:
1. HOISTING: var i được hoisted lên đầu function createFunctions
2. SCOPE: var i thuộc function scope → chỉ có MỘT biến i cho cả vòng lặp
3. CLOSURE: Mỗi function trong result capture CÙNG MỘT biến i
4. Khi vòng lặp kết thúc, i = 3
5. Khi gọi funcs[0](), closure truy cập i → i đã = 3

Fix: Đổi var thành let → mỗi iteration tạo block scope riêng → mỗi closure capture biến i riêng
```

---

## 10. Currying và Partial Application — Liên hệ với Closure

> **Currying** và **Partial Application** là hai kỹ thuật lập trình hàm (functional programming) mà **Closure là nền tảng** để chúng hoạt động. Trong dự án NestJS Ecommerce API, hai kỹ thuật này xuất hiện **rất nhiều** — đặc biệt trong decorators, DTOs, và schema composition.

### 10.1 Lý thuyết: Currying vs Partial Application

#### Currying là gì?

> **Currying** = Biến một hàm nhận nhiều tham số thành chuỗi các hàm, mỗi hàm nhận **đúng 1 tham số**.

```typescript
// Hàm bình thường: nhận 3 tham số cùng lúc
function add(a: number, b: number, c: number): number {
  return a + b + c
}
add(1, 2, 3)  // 6

// Curried version: mỗi hàm nhận 1 tham số
function curriedAdd(a: number) {
  return function(b: number) {       // ← Closure #1: nhớ 'a'
    return function(c: number) {     // ← Closure #2: nhớ 'a' và 'b'
      return a + b + c
    }
  }
}
curriedAdd(1)(2)(3)  // 6

// Có thể tạo hàm trung gian
const add1 = curriedAdd(1)       // Hàm nhớ a=1
const add1and2 = add1(2)         // Hàm nhớ a=1, b=2
const result = add1and2(3)       // 6
```

#### Partial Application là gì?

> **Partial Application** = "Điền trước" một số tham số của hàm, trả về hàm mới nhận các tham số còn lại.

```typescript
// Partial Application: điền trước 1 hoặc nhiều tham số
function multiply(a: number, b: number, c: number): number {
  return a * b * c
}

// Partial apply: điền trước a=2
function multiplyBy2(b: number, c: number): number {
  return multiply(2, b, c)  // ← Closure: nhớ giá trị 2
}

multiplyBy2(3, 4)  // 24

// Hoặc dùng bind()
const multiplyBy2v2 = multiply.bind(null, 2)
multiplyBy2v2(3, 4)  // 24
```

#### So sánh Currying vs Partial Application

```
┌──────────────────────────────────────────────────────────────────┐
│                    CURRYING vs PARTIAL APPLICATION                │
│                                                                  │
│  Currying:           f(a, b, c) → f(a)(b)(c)                   │
│                      Luôn trả về hàm nhận 1 tham số             │
│                                                                  │
│  Partial Application: f(a, b, c) → g(c)  (đã điền a, b)       │
│                       Trả về hàm nhận CÁC tham số còn lại      │
│                                                                  │
│  Điểm chung: Cả hai đều dùng CLOSURE để "nhớ" tham số đã điền  │
└──────────────────────────────────────────────────────────────────┘
```

| Tiêu chí | Currying | Partial Application |
|----------|---------|-------------------|
| **Số tham số mỗi lần** | Luôn 1 | Có thể nhiều |
| **Kết quả** | Chuỗi hàm unary | Hàm với ít tham số hơn |
| **Linh hoạt** | Cao (tái sử dụng từng bước) | Trung bình (cố định tham số) |
| **Closure** | Nhiều tầng closure lồng nhau | Thường 1 tầng closure |
| **Ví dụ trong dự án** | `createParamDecorator` | `createZodDto()`, Error factories |

### 10.2 Patterns thực tế trong dự án

#### Pattern 1: Error Factory — Partial Application của Exception Constructor

```typescript
// File: src/routes/auth/auth.error.ts
// ═══════════════════════════════════════════════

// Partial Application: UnprocessableEntityException được gọi với tham số cố định
// Kết quả: Một instance exception "đã điền sẵn" message và path
export const InvalidOTPException = new UnprocessableEntityException([
  {
    message: 'Error.InvalidOTP',
    path: 'code',
  },
])

export const OTPExpiredException = new UnprocessableEntityException([
  {
    message: 'Error.OTPExpired',
    path: 'code',
  },
])

// File: src/shared/error.ts
// ═══════════════════════════════════════════════

// Factory function — tiền đề cho currying
export function createErrorObject(error: { message: string; statusCode: number; errorCode: string }) {
  return {
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
  }
}

// File: src/routes/address/address.error.ts — Sử dụng factory
export const ADDRESS_ERRORS = {
  ADDRESS_NOT_FOUND: createErrorObject({
    message: 'Địa chỉ không tồn tại',
    statusCode: HttpStatus.NOT_FOUND,
    errorCode: 'ADDRESS_NOT_FOUND',
  }),
  ADDRESS_ACCESS_DENIED: createErrorObject({
    message: 'Bạn không có quyền truy cập địa chỉ này',
    statusCode: HttpStatus.FORBIDDEN,
    errorCode: 'ADDRESS_ACCESS_DENIED',
  }),
}
```

> **Closure ở đâu?** Mỗi error constant capture giá trị message/path trong closure của constructor. Khi throw exception, giá trị đã được "đóng gói" sẵn.

#### Pattern 2: createZodDto() — Partial Application của Zod Schema

```typescript
// File: src/routes/user/user.dto.ts
// ═══════════════════════════════════════════════

// createZodDto là higher-order function:
// Input: Zod schema → Output: DTO class (đã "nhớ" schema trong closure)

export class GetUsersResDTO extends createZodDto(GetUsersResSchema) {}
export class GetUsersQueryDTO extends createZodDto(GetUsersQuerySchema) {}
export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}
export class UpdateUserBodyDTO extends createZodDto(UpdateUserBodySchema) {}

// Bên trong createZodDto hoạt động như thế nào?
// (Simplified version)
function createZodDto(schema: ZodSchema) {
  // CLOSURE: class này "nhớ" schema
  return class {
    static schema = schema  // ← Partial Application: schema đã được điền

    static validate(data: unknown) {
      return schema.parse(data)  // ← Closure: truy cập schema từ scope cha
    }
  }
}
```

> **Tại sao đây là Partial Application?** `createZodDto(GetUsersResSchema)` "điền trước" schema vào class. Class trả về đã có sẵn schema để validate — không cần truyền schema mỗi lần dùng.

#### Pattern 3: Decorator Currying — Auth, Roles, ZodResponseOnly

```typescript
// File: src/shared/decorators/auth.decorator.ts
// ═══════════════════════════════════════════════

// Auth() là curried function:
// Bước 1: Auth([AuthType.Bearer]) → trả về decorator function
// Bước 2: Decorator function được NestJS gọi với target class/method

export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  // CLOSURE: hàm trả về "nhớ" authTypes và options
  return SetMetadata(AUTH_TYPE_KEY, {
    authTypes,
    options: options ?? { condition: ConditionGuard.And }
  })
}

// IsPublic = Partial Application của Auth với AuthType.None đã điền sẵn
export const IsPublic = () => Auth([AuthType.None])
//                             ↑ Partial Application: authTypes = [AuthType.None]

// File: src/shared/decorators/roles.decorator.ts
// ═══════════════════════════════════════════════

// Variadic currying: nhận bao nhiêu roles cũng được
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
//                    ↑ Closure: capture roles array

// Sử dụng:
@Auth([AuthType.Bearer])     // Currying: điền authTypes
@Roles('ADMIN', 'MANAGER')  // Currying: điền roles
class UserController { }
```

#### Pattern 4: createParamDecorator — Currying với Field Selection

```typescript
// File: src/shared/decorators/active-user.decorator.ts
// ═══════════════════════════════════════════════════════

export const ActiveUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    // CLOSURE: capture field và context
    const request = context.switchToHttp().getRequest()
    const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
    //     ↑ Currying: nếu truyền field → trả về giá trị cụ thể
    //                 nếu không → trả về toàn bộ user object
  },
)

// Sử dụng — Currying trong action:
@ActiveUser()           // Không điền field → trả về toàn bộ user
@ActiveUser('userId')   // Điền field='userId' → chỉ trả về userId
@ActiveUser('email')    // Điền field='email' → chỉ trả về email
```

> **Đây là Currying vì:** `@ActiveUser('userId')` tạo ra một decorator đã "nhớ" field='userId'. Khi NestJS gọi decorator này, nó tự động truyền `context` → hoàn thành chuỗi currying.

#### Pattern 5: Zod Schema Composition — Functional Composition Chain

```typescript
// File: src/routes/auth/auth.model.ts
// ═══════════════════════════════════════════════

// Chuỗi functional composition: .pick() → .extend() → .strict()
// Mỗi method trả về schema MỚI, capture schema trước đó trong closure

export const RegisterBodySchema = UserSchema
  .pick({                          // Bước 1: Chọn fields từ UserSchema
    email: true,
    password: true,
    name: true,
    phoneNumber: true,
  })
  .extend({                        // Bước 2: Thêm fields mới
    confirmPassword: z.string().min(6).max(100),
    code: z.string().length(6),
  })
  .strict()                        // Bước 3: Không cho phép fields thừa

// File: src/routes/cart/cart.model.ts — Deep composition
// ═══════════════════════════════════════════════════════

export const CartItemDetailSchema = z.object({
  shop: UserSchema.pick({ id: true, name: true, avatar: true }),
  //     ↑ Partial Application: chỉ lấy 3 fields từ UserSchema
  cartItems: z.array(
    CartItemSchema.extend({
      sku: SKUSchema.extend({
        product: ProductSchema.extend({
          productTranslations: z.array(
            ProductTranslationSchema.omit({
              createdById: true, updatedById: true, deletedById: true,
              deletedAt: true, createdAt: true, updatedAt: true,
            }),
            // ↑ Partial Application: loại bỏ audit fields
          ),
        }),
      }),
    }),
  ),
})
```

#### Pattern 6: Serialize Decorator — Higher-Order Function + Closure

```typescript
// File: src/shared/decorators/serialize.decorator.ts
// ═══════════════════════════════════════════════════════

// SerializeAll là curried function 2 tầng:
// Tầng 1: SerializeAll(excludeMethods) → trả về class decorator
// Tầng 2: Class decorator(constructor) → wrap tất cả methods

export function SerializeAll(excludeMethods: string[] = []) {
  // CLOSURE tầng 1: nhớ excludeMethods
  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    // CLOSURE tầng 2: nhớ constructor + excludeMethods

    const methodNames = Object.getOwnPropertyNames(constructor.prototype)
      .filter((name) =>
        name !== 'constructor'
        && typeof constructor.prototype[name] === 'function'
        && !excludeMethods.includes(name)
        //  ↑ CLOSURE: truy cập excludeMethods từ tầng 1
      )

    methodNames.forEach((methodName) => {
      const originalMethod = constructor.prototype[methodName]
      // CLOSURE tầng 3: mỗi wrapped method nhớ originalMethod riêng

      constructor.prototype[methodName] = async function (...args: any[]) {
        const result = await originalMethod.apply(this, args)
        //                    ↑ CLOSURE: truy cập originalMethod
        return result ? JSON.parse(JSON.stringify(result)) : result
      }
    })

    return constructor
  }
}

// Sử dụng:
@SerializeAll()                    // Wrap TẤT CẢ methods
@SerializeAll(['rawQuery'])        // Wrap tất cả NGOẠI TRỪ rawQuery
```

### 10.3 Cơ hội cải thiện code với Currying

Dưới đây là 3 ví dụ cho thấy code hiện tại có thể được cải thiện bằng currying/partial application:

#### Cơ hội 1: ID Generator — Currying cho template reuse

```typescript
// ═══════════════════════════════════════════════
// HIỆN TẠI (src/shared/helpers.ts) — Lặp lại pattern
// ═══════════════════════════════════════════════
export const generateCancelPaymentJobId = (paymentId: number) => {
  return `paymentId-${paymentId}`
}

export const generateRoomUserId = (userId: number) => {
  return `userId-${userId}`
}

// ═══════════════════════════════════════════════
// CẢI THIỆN VỚI CURRYING — DRY hơn
// ═══════════════════════════════════════════════
const generateId = (prefix: string) => (id: number) => `${prefix}-${id}`
//                  ↑ Currying tầng 1    ↑ Currying tầng 2

const generateCancelPaymentJobId = generateId('paymentId')
const generateRoomUserId = generateId('userId')
const generateSessionId = generateId('session')  // Dễ dàng thêm mới

// Sử dụng:
generateCancelPaymentJobId(123)  // 'paymentId-123'
generateRoomUserId(456)          // 'userId-456'
```

#### Cơ hội 2: Error Factory — Curried Error Creator

```typescript
// ═══════════════════════════════════════════════
// HIỆN TẠI — Lặp lại cấu trúc error
// ═══════════════════════════════════════════════
export const InvalidOTPException = new UnprocessableEntityException([
  { message: 'Error.InvalidOTP', path: 'code' },
])
export const OTPExpiredException = new UnprocessableEntityException([
  { message: 'Error.OTPExpired', path: 'code' },
])

// ═══════════════════════════════════════════════
// CẢI THIỆN VỚI CURRYING — Tạo factory theo path
// ═══════════════════════════════════════════════
const createFieldError = (path: string) => (message: string) =>
  new UnprocessableEntityException([{ message, path }])
//  ↑ Currying: điền path trước, message sau

const codeError = createFieldError('code')
const emailError = createFieldError('email')
const passwordError = createFieldError('password')

// Sử dụng:
export const InvalidOTPException = codeError('Error.InvalidOTP')
export const OTPExpiredException = codeError('Error.OTPExpired')
export const EmailExistsException = emailError('Error.EmailAlreadyExists')
export const WeakPasswordException = passwordError('Error.WeakPassword')
```

#### Cơ hội 3: Test Data Factory — Curried Builder

```typescript
// ═══════════════════════════════════════════════
// HIỆN TẠI (test/helpers/test-helpers.ts)
// ═══════════════════════════════════════════════
export const testDataFactory = {
  user: (overrides: Partial<any> = {}) => ({
    id: 1, email: 'test@example.com', name: 'Test User',
    roleId: 2, status: 'ACTIVE', ...overrides,
  }),
}

// ═══════════════════════════════════════════════
// CẢI THIỆN VỚI CURRYING — Pre-configured factories
// ═══════════════════════════════════════════════
const createFactory = <T>(defaults: T) => (overrides: Partial<T> = {}) => ({
  ...defaults,
  ...overrides,
})

const createUser = createFactory({
  id: 1, email: 'test@example.com', name: 'Test User',
  roleId: 2, status: 'ACTIVE' as const,
})

// Partial Application: tạo factory cho role cụ thể
const createAdmin = (overrides: Partial<any> = {}) =>
  createUser({ roleId: 1, ...overrides })
const createClient = (overrides: Partial<any> = {}) =>
  createUser({ roleId: 2, ...overrides })

// Sử dụng:
const admin = createAdmin({ name: 'Admin User' })
const client = createClient({ email: 'client@test.com' })
```

### 10.4 Bảng tổng hợp Currying & Partial Application trong dự án

| # | Pattern | Loại | File | Closure capture gì? |
|---|---------|------|------|---------------------|
| 1 | Error Factories | Partial Application | `*.error.ts` | message, path, statusCode |
| 2 | `createZodDto()` | Partial Application | `*.dto.ts` | Zod schema |
| 3 | `Auth()` / `Roles()` | Currying | `auth.decorator.ts` | authTypes, roles |
| 4 | `createParamDecorator` | Currying | `active-user.decorator.ts` | field selector |
| 5 | Zod `.pick()/.omit()/.extend()` | Functional Composition | `*.model.ts` | Schema transformations |
| 6 | `SerializeAll()` | Higher-Order + Currying | `serialize.decorator.ts` | excludeMethods, originalMethod |
| 7 | `createZodValidationPipe()` | Partial Application | `custom-zod-validation.pipe.ts` | Error factory function |
| 8 | `IsPublic()` | Partial Application of `Auth()` | `auth.decorator.ts` | `AuthType.None` |
| 9 | Test Data Factories | Partial Application | `test-helpers.ts` | Default test data |
| 10 | `useFactory` DI | Factory + Closure | `app.module.ts` | envConfig, logger |

---

## 11. Closure Patterns trong WebSocket Gateway & CQRS

> Phần này phân tích **17 closure patterns** được tìm thấy trong WebSocket gateways, handlers, Redis services, và queue consumers của dự án. Đây là những closure patterns **phức tạp nhất** trong toàn bộ codebase vì chúng liên quan đến async operations, event-driven architecture, và state management.

### 11.1 WebSocket Gateway Closures

#### Pattern 1: setInterval Cleanup — Closure giữ reference đến service

```typescript
// File: src/websockets/enhanced-chat.gateway.ts (dòng 80-82)
// ═══════════════════════════════════════════════════════════

// Trong constructor:
this.cleanupIntervalId = setInterval(() => {
  void this.typingHandler.cleanupExpiredTypingIndicators()
}, 30000)
```

```
┌─ Constructor Scope ──────────────────────────────────────┐
│                                                          │
│  this.typingHandler = injected service                   │
│                          │                               │
│  setInterval( ─────────────────────────────────────┐     │
│    () => {              │                          │     │
│      this.typingHandler.cleanup...()  ← CLOSURE    │     │
│    }                                               │     │
│  , 30000)                                          │     │
│                                                    │     │
│  ← Hàm callback chạy mỗi 30s, "nhớ" this.typing  │     │
└──────────────────────────────────────────────────────────┘
```

**Biến bị capture:** `this.typingHandler` (instance property)

**Tại sao là closure:** Arrow function truyền vào `setInterval` capture `this.typingHandler` từ constructor scope. Hàm này chạy mỗi 30 giây — lâu sau khi constructor đã hoàn thành — nhưng vẫn truy cập được `typingHandler` nhờ closure.

**⚠️ Lưu ý quan trọng:** Phải `clearInterval(this.cleanupIntervalId)` trong `onModuleDestroy()` để tránh memory leak!

#### Pattern 2: Rate Limiting — Closure capture tham số hàm

```typescript
// File: src/websockets/enhanced-chat.gateway.ts (dòng 132-145)
// ═══════════════════════════════════════════════════════════════

private checkRateLimit(client: AuthenticatedSocket, eventName: string): boolean {
  const result = this.rateLimiter.consume(client.id, eventName)
  //    ↑ Biến local — sẽ bị capture bởi closure bên dưới

  if (!result.allowed) {
    client.emit('rate_limited', {
      event: eventName,           // ← CLOSURE: capture eventName từ parameter
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded for ${eventName}. Try again later.`,
      //                                   ↑ CLOSURE: capture eventName
      retryAfterMs: result.retryAfterMs,
      //             ↑ CLOSURE: capture result từ local scope
      timestamp: new Date(),
    })
    return false
  }
  return true
}
```

**Biến bị capture:** `eventName` (parameter), `result` (local variable)

**Lợi ích:** Object literal truyền vào `client.emit()` capture các biến từ function scope, cho phép tạo error response động dựa trên context.

#### Pattern 3: Online User Filtering — Closure trong Array.filter()

```typescript
// File: src/websockets/enhanced-chat.gateway.ts (dòng 245-262)
// ═══════════════════════════════════════════════════════════════

async getOnlineUsersInConversation(conversationId: string): Promise<number[]> {
  const members = await this.conversationRepo.getConversationMembers(conversationId)
  const memberUserIds = members.map((m) => m.userId)

  const onlineStatusMap = await this.redisService.areUsersOnline(memberUserIds)
  //    ↑ Biến local — sẽ bị capture

  return memberUserIds.filter((userId) => onlineStatusMap.get(userId))
  //                          ↑ CLOSURE: arrow function capture onlineStatusMap
  //                            từ scope của async function cha
}
```

**Biến bị capture:** `onlineStatusMap` (Map object từ async function scope)

**Tại sao là closure:** Callback trong `.filter()` cần truy cập `onlineStatusMap` — một biến được tạo ra trong scope cha. Đây là pattern rất phổ biến khi dùng Array methods.

### 11.2 Handler & Service Closures

#### Pattern 4: setTimeout Typing Timeout — Closure capture nhiều biến

```typescript
// File: src/websockets/handlers/chat-typing.handler.ts (dòng 78-83)
// ═══════════════════════════════════════════════════════════════════

// Đây là closure PHỨC TẠP NHẤT trong WebSocket code
const key = this.getTypingKey(validData.conversationId, client.userId)

const timeoutId = setTimeout(() => {
  // CLOSURE capture 5 biến từ scope cha:
  this.typingTimeouts.delete(key)          // ← capture: this.typingTimeouts + key
  void this.handleTypingStopInternal(      // ← capture: this (instance)
    server,                                // ← capture: server (parameter)
    client,                                // ← capture: client (parameter)
    validData.conversationId               // ← capture: validData (parameter)
  )
}, 10000)
```

```
┌─ handleTypingStart() Scope ──────────────────────────────┐
│                                                          │
│  server ─────────────────────────────────┐               │
│  client ─────────────────────────────────┤               │
│  validData ──────────────────────────────┤               │
│  key = getTypingKey(...)                 │               │
│                                          ▼               │
│  setTimeout( ──────────────────────────────────────┐     │
│    () => {                                         │     │
│      this.typingTimeouts.delete(key)    ← CLOSURE  │     │
│      this.handleTypingStopInternal(                │     │
│        server, client, validData.conversationId    │     │
│      )                                  ← CLOSURE  │     │
│    }                                               │     │
│  , 10000)  ← Chạy sau 10 giây                     │     │
└──────────────────────────────────────────────────────────┘
```

**⚠️ Pitfall:** Nếu không `clearTimeout(timeoutId)` khi user disconnect, closure vẫn giữ reference đến `client` và `server` → memory leak!

#### Pattern 5: Event Notification — Closure trong forEach

```typescript
// File: src/websockets/handlers/chat-interaction.handler.ts (dòng 264-269)
// ═══════════════════════════════════════════════════════════════════════════

// Closure capture 3 biến từ scope cha
conversations.forEach((conversationId) => {
  server.to(`conversation:${conversationId}`).emit(event, {
    ...eventData,       // ← CLOSURE: capture eventData (spread operator)
    conversationId,     // ← Tham số forEach, KHÔNG phải closure
  })
  // server ← CLOSURE: capture từ method parameter
  // event  ← CLOSURE: capture từ local variable
})
```

**Biến bị capture:** `server`, `event`, `eventData` (từ method scope)

**Lợi ích:** Cho phép broadcast cùng một event đến nhiều conversations mà không cần lặp lại logic.

#### Pattern 6: Offline Notification Filter — Closure chain

```typescript
// File: src/websockets/handlers/chat-message.handler.ts (dòng 169-174)
// ═══════════════════════════════════════════════════════════════════════

const offlineMembers = eligibleMembers
  .filter((member) => !onlineStatusMap.get(member.userId))
  //                   ↑ CLOSURE: capture onlineStatusMap
  .map((member) => ({
    userId: member.userId,
    name: member.user.name,
  }))
  // Không có closure trong .map() — chỉ transform data từ parameter
```

**Biến bị capture:** `onlineStatusMap` (chỉ trong `.filter()`)

**Pattern:** Closure chain — `.filter()` dùng closure, `.map()` thì không. Đây là cách phổ biến để kết hợp filtering (cần external data) với transformation (chỉ cần item data).

#### Pattern 7: WebSocket Adapter — Promise với Nested Closures

```typescript
// File: src/websockets/websocket.adapter.ts (dòng 51-73)
// ═══════════════════════════════════════════════════════

// Đây là ví dụ PHỨC TẠP NHẤT về nested closures trong dự án
const waitForReady = (client: Redis, name: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // CLOSURE tầng 1: capture client, name từ outer function

    if (client.status === 'ready') {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      // CLOSURE tầng 2: capture client, name, reject từ tầng 1
      client.removeAllListeners('ready')
      reject(new Error(`${name} Redis connection timeout`))
    }, REDIS_CONNECT_TIMEOUT)

    client.once('ready', () => {
      // CLOSURE tầng 3: capture timer, resolve từ tầng 1
      clearTimeout(timer)
      resolve()
    })

    client.once('error', (err) => {
      // CLOSURE tầng 4: capture timer, reject, name từ tầng 1
      clearTimeout(timer)
      reject(new Error(`${name} Redis connection error: ${err.message}`))
    })
  })
}
```

```
┌─ waitForReady(client, name) ─────────────────────────────────────┐
│                                                                  │
│  new Promise((resolve, reject) => {                              │
│    │                                                             │
│    ├─ setTimeout(() => {                                         │
│    │    client.removeAllListeners('ready')  ← Closure: client    │
│    │    reject(...)                         ← Closure: reject    │
│    │  })                                                         │
│    │  ↑ timer                                                    │
│    │                                                             │
│    ├─ client.once('ready', () => {                               │
│    │    clearTimeout(timer)                ← Closure: timer      │
│    │    resolve()                          ← Closure: resolve    │
│    │  })                                                         │
│    │                                                             │
│    └─ client.once('error', (err) => {                            │
│         clearTimeout(timer)                ← Closure: timer      │
│         reject(...)                        ← Closure: reject     │
│       })                                                         │
│  })                                                              │
└──────────────────────────────────────────────────────────────────┘
```

**4 closures lồng nhau**, tất cả chia sẻ biến từ Promise executor scope. Đây là pattern chuẩn khi wrap callback-based API thành Promise.

#### Pattern 8: Redis Provider — Factory với Event Handler Closures

```typescript
// File: src/websockets/providers/chat-redis.provider.ts (dòng 22-56)
// ═══════════════════════════════════════════════════════════════════

// useFactory tạo ra closure scope cho tất cả event handlers
useFactory: () => {
  const logger = new Logger('ChatRedisProvider')
  //    ↑ Biến local — sẽ bị capture bởi TẤT CẢ closures bên dưới

  const redis = new Redis({
    // ...config
    retryStrategy: (times: number) => {
      // CLOSURE #1: capture logger
      if (times > 10) {
        logger.error(`Chat Redis: max retries reached`)
        return null
      }
      const delay = Math.min(times * 200, 5000)
      logger.warn(`Chat Redis: retry attempt ${times}`)
      return delay
    },
  })

  // CLOSURE #2-6: Tất cả event handlers capture logger
  redis.on('connect', () => { logger.log('Chat Redis connected') })
  redis.on('ready', () => { logger.log('Chat Redis ready') })
  redis.on('error', (error) => { logger.error('Chat Redis error:', error) })
  redis.on('close', () => { logger.warn('Chat Redis connection closed') })
  redis.on('reconnecting', () => { logger.log('Chat Redis reconnecting...') })

  return redis
}
```

**Biến bị capture:** `logger` (bởi 6 closures khác nhau)

**Pattern:** Factory function tạo shared scope — tất cả closures bên trong chia sẻ cùng một `logger` instance. Đây là cách hiệu quả để inject dependencies vào callbacks.

### 11.3 Queue Consumer Closures

#### Pattern 9: Wishlist Price Check — Closure trong vòng lặp với shared state

```typescript
// File: src/queues/wishlist.consumer.ts (dòng 56-100)
// ═══════════════════════════════════════════════════

// processedAlerts và alertsSent là shared state — bị capture bởi closure trong vòng lặp
const processedAlerts = new Set<string>()
let alertsSent = 0

for (const item of items) {
  try {
    const currentPrice = item.sku?.price || item.product?.basePrice || 0
    const priceAlert = item.priceAlerts[0]
    if (!priceAlert) continue

    const alertKey = `${item.user.id}-${item.product.id}`

    if (processedAlerts.has(alertKey)) {
      //  ↑ CLOSURE: capture processedAlerts (Set) từ scope cha
      this.logger.debug(`Skipping duplicate alert...`)
      continue
    }

    const priceDropPercentage =
      ((priceAlert.originalPrice - currentPrice) / priceAlert.originalPrice) * 100

    const shouldAlert =
      priceDropPercentage >= 5 ||
      (priceAlert.targetPrice && currentPrice <= priceAlert.targetPrice)

    if (shouldAlert) {
      processedAlerts.add(alertKey)
      //  ↑ CLOSURE: mutate processedAlerts — ảnh hưởng iterations sau
      alertsSent++
      //  ↑ CLOSURE: mutate alertsSent — đếm tổng alerts
      await this.wishlistProducer.addSendPriceAlertJob({ /* ... */ })
    }
  } catch (error) {
    this.logger.error(`Error checking price for item ${item.id}:`, error)
  }
}
```

**Biến bị capture:** `processedAlerts` (Set), `alertsSent` (counter)

**⚠️ Đặc biệt:** Đây là closure **mutate shared state** — mỗi iteration của vòng lặp đọc và ghi vào cùng `processedAlerts` Set. Điều này hoạt động đúng vì JavaScript là single-threaded, nhưng cần cẩn thận nếu refactor sang async parallel.

#### Pattern 10: Payment Consumer — Switch Block Closure

```typescript
// File: src/queues/payment.consumer.ts (dòng 19-32)
// ═══════════════════════════════════════════════════

async process(job: Job<{ paymentId: number }>): Promise<any> {
  switch (job.name) {
    case CANCEL_PAYMENT_JOB_NAME: {
      const paymentId = job.data.paymentId
      //    ↑ Block scope variable — KHÔNG phải closure

      this.logger.log(`Cancelling payment with ID: ${paymentId}`)
      await this.sharedPaymentRepo.cancelPaymentAndOrder(paymentId)
      //        ↑ CLOSURE: capture this.sharedPaymentRepo từ class instance
      this.logger.log(`Successfully cancelled payment with ID: ${paymentId}`)
      return { success: true, paymentId }
    }
    default: {
      const errorMessage = `Unknown job name: ${job.name}`
      //                                       ↑ CLOSURE: capture job từ parameter
      this.logger.error(errorMessage)
      throw new Error(errorMessage)
    }
  }
}
```

**Biến bị capture:** `job` (parameter), `this.sharedPaymentRepo`, `this.logger` (instance properties)

**Pattern:** Switch case blocks tạo block scope riêng, nhưng vẫn closure-capture biến từ method scope.

### 11.4 Tổng hợp 17 Closure Patterns

| # | Pattern | File | Biến capture | Loại Closure |
|---|---------|------|-------------|-------------|
| 1 | setInterval Cleanup | `enhanced-chat.gateway.ts` | `this.typingHandler` | Timer Closure |
| 2 | Rate Limiting | `enhanced-chat.gateway.ts` | `eventName`, `result` | Parameter Closure |
| 3 | Online User Filter | `enhanced-chat.gateway.ts` | `onlineStatusMap` | Array Method Closure |
| 4 | Typing Timeout | `chat-typing.handler.ts` | `key`, `server`, `client`, `validData` | Multi-variable Timer |
| 5 | Remove User Typing | `chat-typing.handler.ts` | `this.typingTimeouts` | forEach Closure |
| 6 | Offline Notification | `chat-message.handler.ts` | `onlineStatusMap` | Filter Chain Closure |
| 7 | Event Notification | `chat-interaction.handler.ts` | `server`, `event`, `eventData` | forEach Closure |
| 8 | Redis Pipeline | `chat-redis.service.ts` | `this.KEYS.ONLINE_USERS` | Template Literal |
| 9 | Key Scanning | `chat-redis.service.ts` | `keys`, `pattern` | Loop Closure |
| 10 | Typing Cleanup | `chat-redis.service.ts` | `conversationId`, `members`, `results` | Pipeline Closure |
| 11 | getOnlineUsers | `chat-redis.service.ts` | (pure transformation) | Array Method |
| 12 | areUsersOnline | `chat-redis.service.ts` | `this.KEYS` | Instance Property |
| 13 | waitForReady | `websocket.adapter.ts` | `client`, `name`, `timer`, `resolve`, `reject` | Nested Promise |
| 14 | Auth Middleware | `websocket.adapter.ts` | `this.authMiddleware`, `socket`, `next` | Middleware Closure |
| 15 | Redis Event Handlers | `chat-redis.provider.ts` | `logger` | Factory Shared Scope |
| 16 | Wishlist Price Check | `wishlist.consumer.ts` | `processedAlerts`, `alertsSent` | Mutable State Closure |
| 17 | Payment Process | `payment.consumer.ts` | `job`, `this.sharedPaymentRepo` | Switch Block Closure |

### 11.5 Phân loại theo mức độ phức tạp

```
Đơn giản ──────────────────────────────────────────────── Phức tạp

Array.filter()    forEach()      setTimeout()     Promise + Nested
(Pattern 3,6)     (Pattern 5,7)  (Pattern 1,4)    Closures
                                                   (Pattern 13)
    │                │               │                │
    ▼                ▼               ▼                ▼
Capture 1 biến   Capture 2-3     Capture nhiều    4+ closures lồng
từ scope cha     biến            biến + timer     nhau, chia sẻ
                                 management       resolve/reject
```

### 11.6 Lưu ý về CQRS trong dự án

> **Quan trọng:** Mặc dù tài liệu kiến trúc (`architecture.md`) mô tả chi tiết về CQRS pattern với Commands và Queries, **hiện tại dự án chưa implement CQRS handlers thực tế**. Tất cả business logic vẫn nằm trong Services (pattern truyền thống).
>
> Khi CQRS được implement trong tương lai, closure sẽ xuất hiện ở:
> - **Command Handlers**: Closure trong event publishing callbacks
> - **Query Handlers**: Closure trong cache lookup/store callbacks
> - **Event Bus**: Closure trong event subscriber registration
> - **Saga Pattern**: Closure trong compensation logic (rollback)

### 11.7 Best Practices cho Closure trong WebSocket & Async Code

| Quy tắc | Ví dụ | Lý do |
|---------|-------|-------|
| **Luôn cleanup timers** | `clearInterval()` trong `onModuleDestroy()` | Tránh memory leak khi module bị destroy |
| **Cẩn thận với mutable state** | `processedAlerts.add()` trong vòng lặp | Closure capture reference, không copy value |
| **Dùng WeakMap/WeakRef khi có thể** | Thay `Map<string, Socket>` bằng `WeakMap` | Cho phép GC thu hồi socket đã disconnect |
| **Tránh capture toàn bộ object lớn** | Destructure trước: `const { id } = user` | Giảm memory footprint của closure |
| **Log khi closure giữ state lâu** | `logger.debug('Timer still active')` | Dễ debug memory issues |

---

**Tài liệu này được tạo:** 2025-02-27
**Phiên bản:** 2.0.0 — Bổ sung 3 phần mới (Closure vs Hoisting vs Scope, Currying & Partial Application, WebSocket & CQRS Closures)
**Tác giả:** AI Assistant phân tích từ source code thực tế của dự án NestJS Ecommerce API