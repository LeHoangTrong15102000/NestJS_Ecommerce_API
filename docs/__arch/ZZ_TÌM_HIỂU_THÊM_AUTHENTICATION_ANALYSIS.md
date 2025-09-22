# Phân Tích Chi Tiết Hệ Thống Authentication

## Tổng Quan Kiến Trúc

Hệ thống của bạn được xây dựng theo mô hình **Microservices** với **BFF (Backend for Frontend)** pattern:

```
Client → BFF Service → SSO Service
                    → Talent Service
```

### Các Service chính:

- **BFF Service** (Port: không rõ): Gateway/Proxy layer cho frontend
- **SSO Service** (Port: 5051): Xử lý authentication và user management
- **Talent Service**: Xử lý business logic liên quan đến talent

## Vấn Đề Hiện Tại Với Authentication Flow

### 1. Cấu Trúc Authentication Hiện Tại

#### BFF Service Auth Guard (`apps/bff-service/src/modules/guard/auth.guard.ts`)

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  // 1. Kiểm tra public routes
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);

  if (isPublic) {
    return true;
  }

  // 2. Lấy token từ Authorization header
  const request = context.switchToHttp().getRequest();
  const token = request.headers.authorization.split(' ')[1];

  if (!token) {
    return false;
  }

  // 3. Verify token qua SSO Service
  const decoded = await this.ssoClientService.verifyToken({ token });

  // 4. Gán user info vào request
  request.user = {
    id: decoded.sub,
    email: decoded.email,
  };

  return true;
}
```

### 2. Vấn Đề Chính: Token Không Được Forward

**🚨 VẤN ĐỀ:** Khi BFF Service gọi các service khác (như Talent Service), token không được tự động forward, dẫn đến:

1. **Talent Service không nhận được token** để authenticate user
2. **Mất context của user** khi gọi downstream services
3. **Phải implement authentication logic riêng** cho mỗi service

### 3. Phân Tích Chi Tiết SSO Client Library

#### SSO Client Service (`libs/sso-client/src/sso-client.service.ts`)

```typescript
@Injectable()
export class SsoClientService {
  constructor(
    private readonly userApi: UserApi,
    private readonly authApi: AuthApi,
  ) {}

  // Các methods: createUser, login, verifyToken
  // ❌ THIẾU: Method để forward token cho downstream services
}
```

#### Configuration (`libs/sso-client/src/utils/providers.ts`)

```typescript
useFactory: (httpService: HttpService) => {
  const config = new Configuration({
    basePath: 'http://localhost:5051', // Hardcoded SSO Service URL
  });

  return new ApiClass(config, config.basePath, httpService.axiosRef);
};
```

**🔍 Phân tích:**

- SSO Client được config để gọi SSO Service tại `localhost:5051`
- Sử dụng generated API client từ OpenAPI spec
- **THIẾU**: Mechanism để attach token vào outgoing requests

### 4. Vấn Đề Với Auth Module Trong BFF Service

#### Auth Controller (`apps/bff-service/src/modules/auth/auth.controller.ts`)

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly ssoClientService: SsoClientService) {}

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return this.ssoClientService.login(body); // ✅ Proxy login request
  }
}
```

**🤔 Vấn đề thiết kế:**

- BFF có Auth Module riêng nhưng chỉ làm proxy
- Tạo ra duplicate endpoint `/auth/login`
- Có thể gây confusion về responsibility

## Giải Pháp Đề Xuất

### 1. Implement Token Forwarding trong SSO Client

#### Tạo Interceptor cho HTTP Requests

```typescript
// libs/sso-client/src/interceptors/token-forwarding.interceptor.ts
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export class TokenForwardingInterceptor {
  constructor() {}

  // Interceptor để attach token vào requests
  requestInterceptor = (config: AxiosRequestConfig) => {
    // Get token from current context (AsyncLocalStorage hoặc từ request context)
    const token = this.getCurrentToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  };

  responseInterceptor = (response: AxiosResponse) => {
    return response;
  };

  errorInterceptor = (error: any) => {
    // Handle token expiry, refresh logic
    return Promise.reject(error);
  };

  private getCurrentToken(): string | null {
    // Implementation to get current token from context
    // Có thể sử dụng AsyncLocalStorage hoặc request-scoped provider
    return null;
  }
}
```

#### Modify SSO Client Module

```typescript
// libs/sso-client/src/sso-client.module.ts
@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (tokenInterceptor: TokenForwardingInterceptor) => ({
        headers: { 'Content-Type': 'application/json' },
        // Setup interceptors
      }),
      inject: [TokenForwardingInterceptor],
    }),
  ],
  providers: [
    SsoClientService,
    TokenForwardingInterceptor,
    injectApiProvider(UserApi),
    injectApiProvider(AuthApi),
  ],
  exports: [SsoClientService],
})
export class SsoClientModule {}
```

### 2. Cải Thiện Auth Guard để Support Token Forwarding

```typescript
// apps/bff-service/src/modules/guard/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SsoClientService } from '@nnpp/sso-client';
import { TokenContextService } from './token-context.service'; // New service

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly ssoClientService: SsoClientService,
    private readonly reflector: Reflector,
    private readonly tokenContextService: TokenContextService, // Inject new service
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return false;
    }

    try {
      const decoded = await this.ssoClientService.verifyToken({ token });

      // Set user context
      request.user = {
        id: decoded.sub,
        email: decoded.email,
      };

      // 🔥 NEW: Store token in context for forwarding
      this.tokenContextService.setToken(token);

      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 3. Token Context Service

```typescript
// apps/bff-service/src/modules/guard/token-context.service.ts
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST }) // Request-scoped để mỗi request có context riêng
export class TokenContextService {
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken(): void {
    this.token = null;
  }
}
```

### 4. HTTP Client Service cho Downstream Services

```typescript
// libs/shared/src/http/authenticated-http.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TokenContextService } from '../context/token-context.service';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class AuthenticatedHttpService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tokenContextService: TokenContextService,
  ) {}

  // Wrapper methods that automatically include token
  async get(url: string, config?: AxiosRequestConfig) {
    return this.httpService.get(url, this.addAuthHeader(config));
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.httpService.post(url, data, this.addAuthHeader(config));
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.httpService.put(url, data, this.addAuthHeader(config));
  }

  async delete(url: string, config?: AxiosRequestConfig) {
    return this.httpService.delete(url, this.addAuthHeader(config));
  }

  private addAuthHeader(config?: AxiosRequestConfig): AxiosRequestConfig {
    const token = this.tokenContextService.getToken();

    if (!config) {
      config = {};
    }

    if (!config.headers) {
      config.headers = {};
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }
}
```

## Vấn Đề Bảo Mật Cần Lưu Ý

### 1. Token Validation Strategy

**Hiện tại:** BFF Service verify token với SSO Service cho mỗi request

```
Client → BFF → SSO (verify) → BFF → Process Request
```

**Vấn đề:**

- **Performance**: Mỗi request đều phải gọi SSO service
- **Latency**: Thêm network roundtrip
- **Single Point of Failure**: SSO service down → toàn bộ hệ thống không hoạt động

**Giải pháp đề xuất:**

1. **JWT Signature Verification**: BFF tự verify JWT signature thay vì gọi SSO
2. **Token Caching**: Cache token validation results với TTL ngắn
3. **Circuit Breaker**: Implement fallback mechanism khi SSO service unavailable

### 2. Token Expiry Handling

```typescript
// libs/sso-client/src/interceptors/token-refresh.interceptor.ts
@Injectable()
export class TokenRefreshInterceptor {
  async handleTokenExpiry(error: any, originalRequest: AxiosRequestConfig) {
    if (error.response?.status === 401) {
      // Option 1: Return 401 to client để client refresh
      // Option 2: Attempt to refresh token (nếu có refresh token)
      // Option 3: Redirect to login
    }

    return Promise.reject(error);
  }
}
```

### 3. Service-to-Service Authentication

**Vấn đề:** Khi BFF gọi Talent Service, cần đảm bảo:

1. **Token validation**: Talent Service cũng cần verify token
2. **User context**: Talent Service biết user nào đang request
3. **Authorization**: Check permissions cho specific resources

**Giải pháp:**

```typescript
// Talent Service cũng cần Auth Guard tương tự
@Injectable()
export class TalentServiceAuthGuard implements CanActivate {
  constructor(private readonly ssoClientService: SsoClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      return false;
    }

    // Verify với SSO Service hoặc local JWT verification
    const decoded = await this.ssoClientService.verifyToken({ token });

    request.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    return true;
  }
}
```

## Best Practices Đề Xuất

### 1. Centralized Configuration

```typescript
// libs/shared/src/config/services.config.ts
export const SERVICES_CONFIG = {
  SSO_SERVICE: {
    baseUrl: process.env.SSO_SERVICE_URL || 'http://localhost:5051',
    timeout: 5000,
  },
  TALENT_SERVICE: {
    baseUrl: process.env.TALENT_SERVICE_URL || 'http://localhost:5052',
    timeout: 5000,
  },
};
```

### 2. Error Handling Strategy

```typescript
// libs/shared/src/exceptions/auth.exceptions.ts
export class TokenExpiredException extends UnauthorizedException {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super('Invalid token', 'INVALID_TOKEN');
  }
}

export class ServiceUnavailableException extends ServiceUnavailableException {
  constructor(serviceName: string) {
    super(`${serviceName} is currently unavailable`, 'SERVICE_UNAVAILABLE');
  }
}
```

### 3. Monitoring và Logging

```typescript
// libs/shared/src/interceptors/logging.interceptor.ts
@Injectable()
export class AuthLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuthLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;

    // Log authentication attempts
    this.logger.log(`Auth attempt: ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`Auth success: ${method} ${url}`);
      }),
      catchError((error) => {
        this.logger.error(`Auth failed: ${method} ${url} - ${error.message}`);
        throw error;
      }),
    );
  }
}
```

## Vấn Đề Quan Trọng: Mismatch Giữa OpenAPI Spec và Implementation

### 🚨 VẤN ĐỀ CHÍNH: API Endpoint Không Khớp

Sau khi phân tích chi tiết, tôi phát hiện ra một **vấn đề nghiêm trọng** trong hệ thống của bạn:

#### 1. OpenAPI Specification (`libs/sso-client/src/utils/oas.yml`)

```yaml
paths:
  /api/users:
    post:
      operationId: createUser # ← Tên operation là "createUser"
      summary: Create a new user
```

#### 2. Generated API Client (`libs/sso-client/src/client/generated/api.ts`)

```typescript
export class UserApi extends BaseAPI {
  public createUser(
    requestParameters: UserApiCreateUserRequest,
    options?: RawAxiosRequestConfig,
  ) {
    // Gọi endpoint POST /api/users với operationId: createUser
    return UserApiFp(this.configuration)
      .createUser(requestParameters.createUserRequest, options)
      .then((request) => request(this.axios, this.basePath));
  }
}
```

#### 3. SSO Service Implementation (`apps/sso-service/src/modules/user/user.controller.ts`)

```typescript
@Controller('users')
export class UserController {
  @Post()
  register(@Body() body: CreateUserDto) {
    // ← Tên method là "register", KHÔNG phải "createUser"
    return this.userService.register(body);
  }
}
```

### 🔍 Phân Tích Chi Tiết

**Vấn đề:** Có sự **mismatch** giữa:

1. **OpenAPI Spec**: Định nghĩa operation `createUser` cho endpoint `POST /api/users`
2. **Generated Client**: Tạo method `createUser()` gọi endpoint `POST /api/users`
3. **SSO Service**: Implement method `register()` cho endpoint `POST /api/users`

**Kết quả:**

- BFF Service gọi `ssoClientService.createUser()`
- Generated client gọi `POST /api/users` với operationId `createUser`
- SSO Service nhận request nhưng method handler là `register()`

### ✅ Tại Sao Vẫn Hoạt Động?

**Lý do:** NestJS routing dựa trên **HTTP method + path**, không phải tên method:

```typescript
// Cả hai đều map đến cùng endpoint
@Post()                    // POST /api/users
register(@Body() body) { } // ← Method name không ảnh hưởng đến routing

@Post()                    // POST /api/users
createUser(@Body() body) { } // ← Cũng sẽ hoạt động tương tự
```

**NestJS routing logic:**

1. Client gửi `POST /api/users`
2. NestJS tìm controller có `@Controller('users')`
3. Tìm method có `@Post()` (không quan tâm tên method)
4. Gọi method `register()` vì nó có `@Post()` decorator

### 🛠️ Giải Pháp Đề Xuất

#### Option 1: Sửa OpenAPI Spec (Khuyến nghị)

```yaml
# libs/sso-client/src/utils/oas.yml
paths:
  /api/users:
    post:
      operationId: register # ← Đổi từ "createUser" thành "register"
      summary: Register a new user
```

Sau đó regenerate client:

```bash
# Trong thư mục libs/sso-client/src/client/generated/
./git_push.sh  # Hoặc script tương tự để regenerate
```

#### Option 2: Sửa SSO Service Implementation

```typescript
// apps/sso-service/src/modules/user/user.controller.ts
@Controller('users')
export class UserController {
  @Post()
  createUser(@Body() body: CreateUserDto) {
    // ← Đổi tên method
    return this.userService.register(body); // ← Vẫn gọi service.register()
  }
}
```

#### Option 3: Thêm Alias Method

```typescript
// apps/sso-service/src/modules/user/user.controller.ts
@Controller('users')
export class UserController {
  @Post()
  register(@Body() body: CreateUserDto) {
    return this.userService.register(body);
  }

  // Thêm alias method để match với OpenAPI spec
  @Post('create')
  createUser(@Body() body: CreateUserDto) {
    return this.register(body); // Delegate to register method
  }
}
```

### 📋 Cập Nhật OpenAPI Spec

Nếu chọn Option 1, cần cập nhật OpenAPI spec:

```yaml
# libs/sso-client/src/utils/oas.yml
paths:
  /api/users:
    post:
      tags:
        - User
      operationId: register # ← Thay đổi này
      summary: Register a new user # ← Cập nhật summary
      description: Register a new user with the provided information
      # ... rest of the spec remains the same
```

### 🔄 Flow Hoạt Động Hiện Tại

```
1. BFF Service: ssoClientService.createUser(data)
   ↓
2. Generated Client: UserApi.createUser()
   ↓
3. HTTP Request: POST /api/users với body data
   ↓
4. SSO Service: UserController.register() nhận request
   ↓
5. UserService: userService.register(body) xử lý logic
   ↓
6. Response: Trả về user object
```

**Kết luận:** Hệ thống vẫn hoạt động vì NestJS routing không phụ thuộc vào tên method, nhưng có sự **inconsistency** giữa spec và implementation có thể gây confusion.

## Kết Luận

### Vấn đề chính cần giải quyết:

1. **API Naming Inconsistency**: Sửa mismatch giữa OpenAPI spec và implementation
2. **Token Forwarding**: Implement mechanism để forward token từ BFF đến downstream services
3. **Performance Optimization**: Giảm số lần verify token với SSO service
4. **Error Handling**: Xử lý token expiry và service unavailability
5. **Security**: Đảm bảo token không bị leak và được validate properly

### Thứ tự triển khai đề xuất:

1. **FIX API NAMING**: Sửa OpenAPI spec hoặc SSO service implementation
2. Implement `TokenContextService` (request-scoped)
3. Modify `AuthGuard` để store token trong context
4. Tạo `AuthenticatedHttpService` cho downstream calls
5. Implement token caching và refresh logic
6. Add comprehensive error handling và monitoring

### Lưu ý quan trọng:

- **API Consistency**: Đảm bảo OpenAPI spec match với implementation
- **Không hardcode URLs**: Sử dụng environment variables
- **Implement Circuit Breaker**: Để handle service failures
- **Add comprehensive logging**: Để debug authentication issues
- **Consider JWT local verification**: Để giảm dependency vào SSO service

Hệ thống authentication của bạn đã có foundation tốt, nhưng cần sửa API naming inconsistency và thêm token forwarding mechanism để hoàn thiện.
