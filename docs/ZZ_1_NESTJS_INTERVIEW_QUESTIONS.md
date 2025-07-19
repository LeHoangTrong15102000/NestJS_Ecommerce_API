# 🎯 Câu Hỏi Phỏng Vấn NestJS Backend Developer (2+ Years Experience)

## 📋 Mục Lục

1. [Module Architecture & Dependency Injection](#1-module-architecture--dependency-injection)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Database & ORM Patterns](#3-database--orm-patterns)
4. [Error Handling & Validation](#4-error-handling--validation)
5. [Testing Strategies](#5-testing-strategies)
6. [Performance & Optimization](#6-performance--optimization)
7. [Security Best Practices](#7-security-best-practices)
8. [Design Patterns](#8-design-patterns)
9. [System Design](#9-system-design)
10. [DevOps & Deployment](#10-devops--deployment)

---

## 1. Module Architecture & Dependency Injection

### **Câu hỏi 1.1:** Giải thích cách bạn organize modules trong một dự án NestJS lớn? Tại sao lại sử dụng `@Global()` decorator?

**Trả lời:**

Trong dự án của tôi, tôi organize modules theo domain-driven approach:

```typescript
// src/app.module.ts
@Module({
  imports: [
    SharedModule, // Global services
    AuthModule, // Authentication domain
    UserModule, // User management domain
    ProductModule, // Product domain
    OrderModule, // Order domain
    PaymentModule, // Payment domain
  ],
})
export class AppModule {}
```

**SharedModule với @Global():**

```typescript
@Global()
@Module({
  providers: [
    PrismaService,
    HashingService,
    TokenService,
    EmailService,
    S3Service,
    // Global guards
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: [PrismaService, HashingService, TokenService, EmailService, S3Service],
})
export class SharedModule {}
```

**Lý do sử dụng @Global():**

- **Tránh import lặp lại:** Các service như PrismaService, HashingService được sử dụng ở nhiều modules
- **Consistent instance:** Đảm bảo singleton pattern cho database connection
- **Simplified DI:** Không cần re-import SharedModule ở mọi feature module
- **Global guards:** Authentication guard cần áp dụng toàn application

### **Câu hỏi 1.2:** Explain dependency injection scopes trong NestJS. Khi nào nên sử dụng REQUEST scope?

**Trả lời:**

NestJS có 3 injection scopes:

1. **SINGLETON (default):** One instance per application
2. **REQUEST:** New instance per HTTP request
3. **TRANSIENT:** New instance mỗi lần inject

```typescript
// REQUEST scope example - cho user context
@Injectable({ scope: Scope.REQUEST })
export class UserContextService {
  private user: UserType

  setUser(user: UserType) {
    this.user = user
  }

  getUser(): UserType {
    return this.user
  }
}

// Inject request object để access user info
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(@Inject(REQUEST) private request: Request) {}

  async logAction(action: string) {
    const userId = this.request.user?.id
    await this.auditRepo.create({
      userId,
      action,
      timestamp: new Date(),
    })
  }
}
```

**Khi nào sử dụng REQUEST scope:**

- User context services
- Request-specific logging
- Multi-tenant applications
- Request tracing/audit

---

## 2. Authentication & Authorization

### **Câu hỏi 2.1:** Implement một authentication system với multiple strategies (JWT, API Key). Làm thế nào để combine guards?

**Trả lời:**

Trong dự án của tôi, tôi implement composite authentication pattern:

```typescript
// Auth decorator với multiple types
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  return SetMetadata(AUTH_TYPE_KEY, {
    authTypes,
    options: options ?? { condition: ConditionGuard.And }
  });
}

// Usage examples
@Auth([AuthType.Bearer])  // JWT only
@Auth([AuthType.APIKey])  // API Key only
@Auth([AuthType.Bearer, AuthType.APIKey], { condition: ConditionGuard.Or })  // Either
```

**AuthenticationGuard implementation:**

```typescript
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authTypeGuardMap: Record<string, CanActivate>

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly apiKeyGuard: APIKeyGuard,
  ) {
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.APIKey]: this.apiKeyGuard,
      [AuthType.None]: { canActivate: () => true },
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authConfig = this.reflector.getAllAndOverride<AuthTypeDecoratorPayload>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!authConfig) return true

    const { authTypes, options } = authConfig
    const { condition } = options

    if (condition === ConditionGuard.And) {
      // Tất cả guards phải pass
      for (const authType of authTypes) {
        const guard = this.authTypeGuardMap[authType]
        const result = await guard.canActivate(context)
        if (!result) return false
      }
      return true
    } else {
      // Chỉ cần 1 guard pass
      for (const authType of authTypes) {
        try {
          const guard = this.authTypeGuardMap[authType]
          const result = await guard.canActivate(context)
          if (result) return true
        } catch (error) {
          continue // Try next guard
        }
      }
      return false
    }
  }
}
```

### **Câu hỏi 2.2:** Thiết kế hệ thống RBAC dynamic với database. Làm thế nào để check permissions real-time?

**Trả lời:**

**Database Schema Design:**

```sql
-- Users belong to roles
User {
  id: number
  roleId: number
  role: Role
}

-- Roles have many permissions
Role {
  id: number
  name: string
  permissions: Permission[]
}

-- Permissions define granular access
Permission {
  id: number
  name: string
  path: string      -- API endpoint path
  method: HTTPMethod -- GET, POST, PUT, DELETE
  module: string    -- Group permissions by module
  roles: Role[]
}
```

**Permission Check Implementation:**

```typescript
@Injectable()
export class AccessTokenGuard implements CanActivate {
  async validateUserPermission(decodedToken: AccessTokenPayload, request: any): Promise<void> {
    const { roleId } = decodedToken
    const path = request.route.path
    const method = request.method as HTTPMethod

    // Query role với permissions
    const role = await this.prismaService.role.findUniqueOrThrow({
      where: {
        id: roleId,
        deletedAt: null,
        isActive: true, // Role deactivation check
      },
      include: {
        permissions: {
          where: {
            deletedAt: null,
            path,
            method,
          },
        },
      },
    })

    // Check permission exists
    const hasPermission = role.permissions.length > 0
    if (!hasPermission) {
      throw new ForbiddenException('Error.PermissionDenied')
    }

    // Attach role to request for further use
    request[REQUEST_ROLE_PERMISSIONS] = role
  }
}
```

**Performance Optimization với Caching:**

```typescript
@Injectable()
export class PermissionCacheService {
  constructor(private redis: RedisService) {}

  async getUserPermissions(userId: number): Promise<Permission[]> {
    const cacheKey = `user:${userId}:permissions`

    // Try cache first
    let permissions = await this.redis.get(cacheKey)
    if (permissions) {
      return JSON.parse(permissions)
    }

    // Query from database
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    })

    permissions = user.role.permissions

    // Cache for 15 minutes
    await this.redis.setex(cacheKey, 900, JSON.stringify(permissions))

    return permissions
  }

  async invalidateUserPermissions(userId: number): Promise<void> {
    await this.redis.del(`user:${userId}:permissions`)
  }
}
```

### **Câu hỏi 2.3:** Implement JWT refresh token rotation với device tracking. Handle security concerns?

**Trả lời:**

**Device Tracking Schema:**

```typescript
// Device table để track multiple logins
model Device {
  id: number
  userId: number
  user: User
  userAgent: string
  ip: string
  lastActive: DateTime
  isActive: boolean
  refreshTokens: RefreshToken[] // One device can have multiple refresh tokens
}

model RefreshToken {
  token: string // UUID
  userId: number
  deviceId: number
  device: Device
  expiresAt: DateTime
  createdAt: DateTime
}
```

**Token Generation Strategy:**

```typescript
@Injectable()
export class AuthService {
  async login(body: LoginBodyType & { userAgent: string; ip: string }) {
    // ... validate credentials ...

    // Create or update device
    const device = await this.authRepository.createDevice({
      userId: user.id,
      userAgent: body.userAgent,
      ip: body.ip,
      isActive: true,
    })

    // Generate tokens
    return this.generateTokens({
      userId: user.id,
      roleId: user.roleId,
      deviceId: device.id,
      roleName: user.role.name,
    })
  }

  async generateTokens({ userId, roleId, deviceId, roleName }: TokenPayload) {
    const accessTokenPayload = { userId, roleId, deviceId, roleName }
    const refreshTokenPayload = { userId, deviceId }

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(accessTokenPayload),
      this.tokenService.signRefreshToken(refreshTokenPayload),
    ])

    // Store refresh token trong database
    await this.authRepository.createRefreshToken({
      token: refreshToken,
      userId,
      deviceId,
      expiresAt: new Date(Date.now() + ms(envConfig.REFRESH_TOKEN_EXPIRES_IN)),
    })

    return { accessToken, refreshToken }
  }
}
```

**Refresh Token Rotation:**

```typescript
async refreshToken({ refreshToken, userAgent, ip }: RefreshTokenBodyType) {
  // Verify refresh token
  const decoded = await this.tokenService.verifyRefreshToken(refreshToken);

  // Check if token exists and is valid
  const storedToken = await this.authRepository.findUniqueRefreshTokenIncludeUserRole({
    token: refreshToken,
  });

  if (!storedToken) {
    throw new UnauthorizedException('Refresh token not found');
  }

  // Security: Check if token is already used (potential attack)
  if (storedToken.expiresAt <= new Date()) {
    await this.authRepository.deleteRefreshToken({ token: refreshToken });
    throw new UnauthorizedException('Refresh token expired');
  }

  // Transaction: Delete old token and create new ones
  await this.prismaService.$transaction(async (prisma) => {
    // Delete old refresh token
    await this.authRepository.deleteRefreshTokenWithTransaction(refreshToken, prisma);

    // Update device activity
    await this.authRepository.updateDeviceWithTransaction(
      decoded.deviceId,
      { lastActive: new Date(), ip, userAgent },
      prisma
    );

    // Generate new tokens
    const newTokens = await this.generateTokensWithTransaction({
      userId: storedToken.userId,
      roleId: storedToken.user.roleId,
      deviceId: decoded.deviceId,
      roleName: storedToken.user.role.name,
    }, prisma);

    return newTokens;
  });
}
```

**Security Measures:**

1. **Token Rotation:** Mỗi refresh invalidates old token
2. **Device Binding:** Token tied to specific device
3. **IP Tracking:** Detect suspicious activity
4. **Automatic Cleanup:** Remove expired tokens
5. **Rate Limiting:** Prevent brute force on refresh endpoint
6. **Logout All Devices:** Admin capability

---

## 3. Database & ORM Patterns

### **Câu hỏi 3.1:** Explain Repository pattern trong NestJS với Prisma. Khi nào nên sử dụng?

**Trả lời:**

Repository pattern cung cấp abstraction layer giữa business logic và data access:

```typescript
// Repository interface for testability
interface IAuthRepository {
  createUser(data: CreateUserData): Promise<UserType>
  findUserByEmail(email: string): Promise<UserType | null>
  createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenType>
}

// Concrete implementation
@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createUser(
    user: Pick<UserType, 'email' | 'name' | 'password' | 'phoneNumber' | 'roleId'>,
  ): Promise<Omit<UserType, 'password' | 'totpSecret'>> {
    return this.prismaService.user.create({
      data: user,
      omit: {
        password: true,
        totpSecret: true,
      },
    })
  }

  async findUniqueUserIncludeRole(uniqueObject: WhereUniqueUserType): Promise<(UserType & { role: RoleType }) | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...uniqueObject,
        deletedAt: null, // Global soft delete filter
      },
      include: {
        role: true,
      },
    })
  }

  // Transaction support
  async createRefreshTokenWithTransaction(
    data: CreateRefreshTokenData,
    prisma?: PrismaService,
  ): Promise<RefreshTokenType> {
    const db = prisma ?? this.prismaService
    return db.refreshToken.create({ data })
  }
}
```

**Service sử dụng Repository:**

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly hashingService: HashingService,
  ) {}

  async register(body: RegisterBodyType) {
    const hashedPassword = await this.hashingService.hash(body.password)

    // Business logic separated from data access
    const user = await this.authRepository.createUser({
      ...body,
      password: hashedPassword,
      roleId: await this.getDefaultRoleId(),
    })

    return user
  }
}
```

**Khi nào sử dụng Repository Pattern:**

- **Complex queries:** Multiple joins, aggregations
- **Testability:** Easy to mock data layer
- **ORM abstraction:** Có thể switch từ Prisma sang TypeORM
- **Business logic separation:** Domain logic không mix với SQL
- **Caching strategy:** Centralized cache logic

### **Câu hỏi 3.2:** Implement soft delete strategy với audit trail. Handle relationships?

**Trả lời:**

**Global Soft Delete Strategy:**

```typescript
// Base model với audit fields
interface BaseModel {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  // Audit trail
  createdById?: number;
  updatedById?: number;
  deletedById?: number;
  createdBy?: User;
  updatedBy?: User;
  deletedBy?: User;
}

// Prisma schema pattern
model User {
  id: number @id @default(autoincrement())
  email: string
  name: string

  // Audit fields
  createdById: number?
  createdBy: User? @relation("UserCreatedBy", fields: [createdById], references: [id])
  updatedById: number?
  updatedBy: User? @relation("UserUpdatedBy", fields: [updatedById], references: [id])
  deletedById: number?
  deletedBy: User? @relation("UserDeletedBy", fields: [deletedById], references: [id])

  // Self-referential relations
  createdUsers: User[] @relation("UserCreatedBy")
  updatedUsers: User[] @relation("UserUpdatedBy")
  deletedUsers: User[] @relation("UserDeletedBy")

  deletedAt: DateTime?
  createdAt: DateTime @default(now())
  updatedAt: DateTime @updatedAt

  @@index([deletedAt]) // Performance optimization
}
```

**Service Implementation:**

```typescript
@Injectable()
export class BaseService<T extends BaseModel> {
  constructor(
    protected readonly model: any, // Prisma model
    protected readonly currentUserId: number,
  ) {}

  async findMany(where?: any): Promise<T[]> {
    return this.model.findMany({
      where: {
        ...where,
        deletedAt: null, // Always filter deleted records
      },
    })
  }

  async softDelete(id: number): Promise<T> {
    return this.model.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: this.currentUserId,
      },
    })
  }

  async restore(id: number): Promise<T> {
    return this.model.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        updatedById: this.currentUserId,
      },
    })
  }

  async hardDelete(id: number): Promise<T> {
    // Chỉ admin mới được hard delete
    return this.model.delete({
      where: { id },
    })
  }
}
```

**Relationship Handling:**

```typescript
// Cascade soft delete for related entities
async deleteUserWithRelations(userId: number): Promise<void> {
  await this.prismaService.$transaction(async (prisma) => {
    // Soft delete user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletedById: this.currentUserId,
      },
    });

    // Soft delete related entities
    await prisma.userTranslation.updateMany({
      where: { userId },
      data: {
        deletedAt: new Date(),
        deletedById: this.currentUserId,
      },
    });

    // Deactivate devices instead of delete
    await prisma.device.updateMany({
      where: { userId },
      data: {
        isActive: false,
        updatedById: this.currentUserId,
      },
    });
  });
}
```

### **Câu hỏi 3.3:** Optimize N+1 queries trong Prisma. Explain include vs select strategy?

**Trả lời:**

**N+1 Problem Example:**

```typescript
// ❌ BAD: N+1 query problem
async getBadUserPosts(): Promise<any[]> {
  const users = await this.prisma.user.findMany(); // 1 query

  const result = [];
  for (const user of users) {
    const posts = await this.prisma.post.findMany({ // N queries
      where: { userId: user.id }
    });
    result.push({ ...user, posts });
  }
  return result;
}
```

**✅ GOOD: Include Strategy:**

```typescript
async getGoodUserPosts(): Promise<any[]> {
  return this.prisma.user.findMany({
    include: {
      posts: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          createdAt: true,
          // Không include unnecessary fields
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    where: {
      deletedAt: null,
    },
  }); // Chỉ 1 query với JOINs
}
```

**Select vs Include Strategy:**

```typescript
// SELECT: Specify exact fields needed
async getUsersMinimal() {
  return this.prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });
}

// INCLUDE: Add relations to base model
async getUsersFull() {
  return this.prisma.user.findMany({
    include: {
      role: true,
      posts: {
        include: {
          comments: true,
        },
      },
    },
  });
}
```

**Advanced Optimization Techniques:**

```typescript
// Pagination với cursor-based
async getUsersPaginated(cursor?: number, take = 10) {
  return this.prisma.user.findMany({
    take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      role: true,
    },
    orderBy: {
      id: 'asc',
    },
  });
}

// Aggregation queries
async getUserStats() {
  return this.prisma.user.aggregate({
    _count: {
      id: true,
    },
    _avg: {
      age: true,
    },
    where: {
      deletedAt: null,
    },
  });
}

// Raw queries cho complex cases
async getComplexUserData() {
  return this.prisma.$queryRaw`
    SELECT u.*, r.name as role_name, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, r.name
    ORDER BY post_count DESC
  `;
}
```

---

## 4. Error Handling & Validation

### **Câu hỏi 4.1:** Implement global exception handling với custom error responses và i18n support?

**Trả lời:**

**Custom Exception Hierarchy:**

```typescript
// Base custom exception
export abstract class BaseCustomException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    statusCode: HttpStatus,
    public readonly context?: any,
  ) {
    super(message, statusCode)
  }
}

// Specific exceptions
export class EmailAlreadyExistsException extends BaseCustomException {
  constructor() {
    super('EMAIL_ALREADY_EXISTS', 'Error.EmailAlreadyExists', HttpStatus.BAD_REQUEST)
  }
}

export class InvalidOTPException extends BaseCustomException {
  constructor() {
    super('INVALID_OTP', 'Error.InvalidOTP', HttpStatus.BAD_REQUEST)
  }
}
```

**Global Exception Filter:**

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let errorCode = 'INTERNAL_ERROR'
    let errors: any[] = []

    // Handle different exception types
    if (exception instanceof BaseCustomException) {
      status = exception.getStatus()
      errorCode = exception.errorCode

      // Translate message based on request language
      message = this.i18n.translate(exception.message, {
        lang: request.headers['accept-language'] || 'en',
      })
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const response = exception.getResponse()

      if (typeof response === 'object' && 'message' in response) {
        message = Array.isArray(response.message) ? response.message.join(', ') : response.message
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY
      errorCode = 'VALIDATION_ERROR'
      errors = exception.errors.map((error) => ({
        field: error.path.join('.'),
        message: error.message,
        code: error.code,
      }))
    }

    // Log error for monitoring
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status}`,
      exception instanceof Error ? exception.stack : exception,
    )

    // Standardized error response
    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(errors.length > 0 && { errors }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    }

    response.status(status).json(errorResponse)
  }
}
```

**Custom Validation Pipe:**

```typescript
const CustomZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    const formattedErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: 'received' in err ? err.received : undefined,
    }))

    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: formattedErrors,
    })
  },
})
```

### **Câu hỏi 4.2:** Implement internationalization (i18n) cho error messages và responses?

**Trả lời:**

**I18n Configuration:**

```typescript
// app.module.ts
I18nModule.forRoot({
  fallbackLanguage: 'en',
  loaderOptions: {
    path: path.resolve('src/i18n/'),
    watch: true,
  },
  resolvers: [
    { use: QueryResolver, options: ['lang'] }, // ?lang=vi
    AcceptLanguageResolver, // Accept-Language header
  ],
  typesOutputPath: path.resolve('src/generated/i18n.generated.ts'),
})
```

**Error Message Files:**

```json
// src/i18n/en/error.json
{
  "EmailAlreadyExists": "Email address already exists in the system",
  "InvalidOTP": "The OTP code is invalid or expired",
  "PermissionDenied": "You don't have permission to access this resource",
  "UserNotFound": "User not found with the provided credentials"
}

// src/i18n/vi/error.json
{
  "EmailAlreadyExists": "Địa chỉ email đã tồn tại trong hệ thống",
  "InvalidOTP": "Mã OTP không hợp lệ hoặc đã hết hạn",
  "PermissionDenied": "Bạn không có quyền truy cập tài nguyên này",
  "UserNotFound": "Không tìm thấy người dùng với thông tin đăng nhập"
}
```

**Service with I18n:**

```typescript
@Injectable()
export class AuthService {
  constructor(private readonly i18n: I18nService) {}

  async validateUser(email: string): Promise<void> {
    const user = await this.findUserByEmail(email)

    if (!user) {
      throw new NotFoundException(await this.i18n.translate('error.UserNotFound'))
    }
  }

  // Custom method với context
  private async throwLocalizedError(key: string, args?: Record<string, any>, lang?: string) {
    const message = await this.i18n.translate(`error.${key}`, {
      lang: lang || 'en',
      args,
    })

    throw new BadRequestException(message)
  }
}
```

**Controller với Language Context:**

```typescript
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @I18nLang() lang: string, // Auto-resolved language
  ) {
    try {
      return await this.authService.login(body)
    } catch (error) {
      // Re-throw with localized message
      if (error instanceof BaseCustomException) {
        const localizedMessage = await this.i18n.translate(`error.${error.errorCode}`, { lang })
        throw new HttpException(localizedMessage, error.getStatus())
      }
      throw error
    }
  }
}
```

---

## 5. Testing Strategies

### **Câu hỏi 5.1:** Viết comprehensive unit tests cho AuthService với proper mocking strategies?

**Trả lời:**

**Test Setup với Mocking:**

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockAuthRepo: jest.Mocked<AuthRepository>;
  let mockHashingService: jest.Mocked<HashingService>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    // Create typed mocks
    mockAuthRepo = {
      findUniqueVerificationCode: jest.fn(),
      createUser: jest.fn(),
      deleteVerificationCode: jest.fn(),
      createVerificationCode: jest.fn(),
      findUniqueUserIncludeRole: jest.fn(),
    } as any;

    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any;

    mockTokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: HashingService, useValue: mockHashingService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
```

**Test Data Factory:**

```typescript
// test/helpers/test-helpers.ts
export const testDataFactory = {
  user: (overrides: Partial<UserType> = {}): UserType => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashedPassword',
    roleId: 1,
    status: UserStatus.ACTIVE,
    avatar: null,
    totpSecret: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  verificationCode: (overrides: Partial<VerificationCodeType> = {}): VerificationCodeType => ({
    id: 1,
    email: 'test@example.com',
    code: '123456',
    type: TypeOfVerificationCode.REGISTER,
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    ...overrides,
  }),
}
```

**Comprehensive Test Cases:**

```typescript
describe('validateVerificationCode', () => {
  it('should validate verification code successfully', async () => {
    // Arrange
    const mockCode = testDataFactory.verificationCode({
      email: 'test@example.com',
      code: '123456',
      type: TypeOfVerificationCode.REGISTER,
      expiresAt: new Date(Date.now() + 60000),
    })

    mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockCode)

    // Act
    const result = await service.validateVerificationCode({
      email: 'test@example.com',
      code: '123456',
      type: TypeOfVerificationCode.REGISTER,
    })

    // Assert
    expect(result).toEqual(mockCode)
    expect(mockAuthRepo.findUniqueVerificationCode).toHaveBeenCalledWith({
      email_code_type: {
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
      },
    })
  })

  it('should throw InvalidOTPException when code not found', async () => {
    // Arrange
    mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

    // Act & Assert
    await expect(
      service.validateVerificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
      }),
    ).rejects.toThrow(InvalidOTPException)
  })

  it('should throw OTPExpiredException when code is expired', async () => {
    // Arrange
    const expiredCode = testDataFactory.verificationCode({
      expiresAt: new Date(Date.now() - 60000), // 1 minute ago
    })

    mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredCode)

    // Act & Assert
    await expect(
      service.validateVerificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
      }),
    ).rejects.toThrow(OTPExpiredException)
  })
})

describe('register', () => {
  const validRegisterData = {
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'password123',
    confirmPassword: 'password123',
    code: '123456',
  }

  it('should register user successfully', async () => {
    // Arrange
    const mockVerificationCode = testDataFactory.verificationCode({
      email: validRegisterData.email,
      code: validRegisterData.code,
    })

    const mockUser = testDataFactory.user({
      email: validRegisterData.email,
      name: validRegisterData.name,
    })

    mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
    mockHashingService.hash.mockResolvedValue('hashedPassword')
    mockAuthRepo.createUser.mockResolvedValue(mockUser as any)
    mockAuthRepo.deleteVerificationCode.mockResolvedValue(mockVerificationCode as any)

    // Act
    const result = await service.register(validRegisterData)

    // Assert
    expect(result).toEqual(mockUser)
    expect(mockHashingService.hash).toHaveBeenCalledWith(validRegisterData.password)
    expect(mockAuthRepo.createUser).toHaveBeenCalledWith({
      email: validRegisterData.email,
      name: validRegisterData.name,
      phoneNumber: validRegisterData.phoneNumber,
      password: 'hashedPassword',
      roleId: expect.any(Number),
    })
  })

  it('should handle unique constraint error', async () => {
    // Arrange
    const mockVerificationCode = testDataFactory.verificationCode()
    mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)

    const uniqueConstraintError = new Error('Unique constraint failed')
    ;(uniqueConstraintError as any).code = 'P2002'

    mockAuthRepo.createUser.mockRejectedValue(uniqueConstraintError)

    // Mock the helper function
    jest.mocked(isUniqueConstraintPrismaError).mockReturnValue(true)

    // Act & Assert
    await expect(service.register(validRegisterData)).rejects.toThrow(EmailAlreadyExistsException)
  })
})
```

### **Câu hỏi 5.2:** Setup integration tests với test database và realistic data scenarios?

**Trả lời:**

**Test Database Setup:**

```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var __GLOBAL_PRISMA__: PrismaClient
}

let prisma: PrismaClient

beforeAll(async () => {
  // Create test database connection
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL,
      },
    },
  })

  await prisma.$connect()
  global.__GLOBAL_PRISMA__ = prisma
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

**Test Helpers:**

```typescript
// test/helpers/test-helpers.ts
export const resetDatabase = async () => {
  const prisma = global.__GLOBAL_PRISMA__

  // Clean tables in correct order (respect foreign keys)
  await prisma.refreshToken.deleteMany()
  await prisma.device.deleteMany()
  await prisma.verificationCode.deleteMany()
  await prisma.userTranslation.deleteMany()
  await prisma.user.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()

  // Reset auto-increment sequences
  await prisma.$executeRaw`ALTER SEQUENCE users_id_seq RESTART WITH 1`
  await prisma.$executeRaw`ALTER SEQUENCE roles_id_seq RESTART WITH 1`
}

export const seedTestData = async () => {
  const prisma = global.__GLOBAL_PRISMA__

  // Create default roles
  const clientRole = await prisma.role.create({
    data: {
      name: 'CLIENT',
      description: 'Default client role',
    },
  })

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Administrator role',
    },
  })

  // Create test permissions
  await prisma.permission.createMany({
    data: [
      {
        name: 'Read Users',
        path: '/users',
        method: 'GET',
        module: 'USER',
      },
      {
        name: 'Create Users',
        path: '/users',
        method: 'POST',
        module: 'USER',
      },
    ],
  })

  return { clientRole, adminRole }
}
```

**Integration Test Example:**

```typescript
// test/integration/auth-flow.integration.spec.ts
describe('Auth Flow Integration', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
    await seedTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Complete Registration Flow', () => {
    const testUser = {
      email: 'integration@test.com',
      name: 'Integration Test User',
      phoneNumber: '0987654321',
      password: 'password123',
      confirmPassword: 'password123',
    }

    it('should complete full registration workflow', async () => {
      // Step 1: Send OTP
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/otp')
        .send({
          email: testUser.email,
          type: 'REGISTER',
        })
        .expect(200)

      expect(otpResponse.body.message).toBe('Gửi mã OTP thành công')

      // Step 2: Get OTP from database
      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      expect(verificationCode).toBeDefined()
      expect(verificationCode?.code).toHaveLength(6)

      // Step 3: Register with OTP
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser,
          code: verificationCode?.code,
        })
        .expect(201)

      expect(registerResponse.body).toMatchObject({
        id: expect.any(Number),
        email: testUser.email,
        name: testUser.name,
        status: 'INACTIVE',
      })

      // Verify password not returned
      expect(registerResponse.body.password).toBeUndefined()

      // Step 4: Verify user in database
      const createdUser = await prisma.user.findFirst({
        where: { email: testUser.email },
        include: { role: true },
      })

      expect(createdUser?.role.name).toBe('CLIENT')

      // Step 5: Verify OTP cleanup
      const usedCode = await prisma.verificationCode.findFirst({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      expect(usedCode).toBeNull()
    })

    it('should handle concurrent registration attempts', async () => {
      // Send multiple OTP requests concurrently
      const otpPromises = Array.from({ length: 3 }, () =>
        request(app.getHttpServer()).post('/auth/otp').send({
          email: testUser.email,
          type: 'REGISTER',
        }),
      )

      await Promise.all(otpPromises)

      // Should only have one verification code
      const codes = await prisma.verificationCode.findMany({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      expect(codes).toHaveLength(1)
    })
  })

  describe('Authentication Flow', () => {
    beforeEach(async () => {
      // Create test user
      await prisma.user.create({
        data: {
          email: 'auth@test.com',
          name: 'Auth Test User',
          phoneNumber: '0123456789',
          password: await new HashingService().hash('password123'),
          roleId: 1,
          status: 'ACTIVE',
        },
      })
    })

    it('should login and refresh tokens correctly', async () => {
      // Step 1: Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'auth@test.com',
          password: 'password123',
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      const { accessToken, refreshToken } = loginResponse.body
      expect(accessToken).toBeDefined()
      expect(refreshToken).toBeDefined()

      // Step 2: Access protected route
      const protectedResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(protectedResponse.body.email).toBe('auth@test.com')

      // Step 3: Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .set('User-Agent', 'test-agent')
        .expect(200)

      const { accessToken: newAccessToken } = refreshResponse.body
      expect(newAccessToken).toBeDefined()
      expect(newAccessToken).not.toBe(accessToken)

      // Step 4: Old refresh token should be invalid
      await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401)
    })
  })
})
```

---

Đây là phần đầu của file markdown. Do giới hạn về độ dài, tôi sẽ tiếp tục với các phần còn lại. Bạn có muốn tôi tiếp tục với các sections còn lại không?
