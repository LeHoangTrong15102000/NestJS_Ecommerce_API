# Dependency Injection và Inversion of Control trong NestJS

## Mục lục

1. [Giới thiệu về IoC và DI](#giới-thiệu-về-ioc-và-di)
2. [Dependency Injection trong NestJS](#dependency-injection-trong-nestjs)
3. [Các loại Provider trong NestJS](#các-loại-provider-trong-nestjs)
4. [Injection Tokens và Custom Providers](#injection-tokens-và-custom-providers)
5. [Scope của Dependencies](#scope-của-dependencies)
6. [Ví dụ thực tế](#ví-dụ-thực-tế)
7. [Best Practices](#best-practices)

## Giới thiệu về IoC và DI

### Inversion of Control (IoC) - Đảo ngược điều khiển

**IoC** là một nguyên lý thiết kế phần mềm trong đó việc điều khiển luồng thực thi và quản lý dependencies được "đảo ngược" từ đối tượng sử dụng sang một thực thể bên ngoài (container).

#### Trước khi có IoC:

```typescript
// ❌ Cách cũ - Tight coupling
class UserService {
  private database: Database

  constructor() {
    this.database = new MySQLDatabase() // Hard-coded dependency
  }
}
```

#### Sau khi áp dụng IoC:

```typescript
// ✅ Cách mới - Loose coupling
class UserService {
  constructor(private database: Database) {
    // Dependency được inject từ bên ngoài
  }
}
```

### Dependency Injection (DI) - Tiêm phụ thuộc

**DI** là một kỹ thuật cụ thể để implement IoC pattern. Thay vì class tự tạo ra dependencies của nó, dependencies sẽ được "tiêm" vào từ bên ngoài.

### Lợi ích của IoC và DI:

1. **Loose Coupling**: Giảm sự phụ thuộc chặt chẽ giữa các class
2. **Testability**: Dễ dàng mock dependencies trong unit test
3. **Flexibility**: Dễ dàng thay đổi implementation
4. **Maintainability**: Code dễ bảo trì và mở rộng

## Dependency Injection trong NestJS

NestJS sử dụng **Decorator-based DI** kết hợp với **TypeScript metadata** để implement IoC container mạnh mẽ.

### 1. Cách hoạt động của DI Container trong NestJS

```typescript
// 1. Khai báo Service với @Injectable()
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany()
  }
}

// 2. Đăng ký trong Module
@Module({
  providers: [UserService, PrismaService], // Đăng ký với DI container
  controllers: [UserController],
})
export class UserModule {}

// 3. Inject vào Controller
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {} // Auto-inject

  @Get()
  findAll() {
    return this.userService.findAll()
  }
}
```

### 2. Quá trình Injection

Khi NestJS khởi động:

1. **Scanning Phase**: Quét tất cả decorators và metadata
2. **Registration Phase**: Đăng ký providers vào DI container
3. **Resolution Phase**: Phân giải dependencies và tạo instances
4. **Injection Phase**: Inject dependencies vào constructors

```typescript
// NestJS tự động làm điều này:
const prismaService = new PrismaService()
const userService = new UserService(prismaService)
const userController = new UserController(userService)
```

## Các loại Provider trong NestJS

### 1. Class Provider (Mặc định)

```typescript
@Module({
  providers: [
    UserService, // Shorthand
    // Hoặc dạng đầy đủ:
    {
      provide: UserService,
      useClass: UserService,
    },
  ],
})
export class UserModule {}
```

### 2. Value Provider

```typescript
const configObject = {
  apiKey: 'secret-key',
  dbUrl: 'postgresql://...',
}

@Module({
  providers: [
    {
      provide: 'CONFIG',
      useValue: configObject,
    },
  ],
})
export class AppModule {}

// Sử dụng:
@Injectable()
export class ApiService {
  constructor(@Inject('CONFIG') private config: any) {}
}
```

### 3. Factory Provider

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (config: ConfigService) => {
        return await createDatabaseConnection(config.get('DB_URL'))
      },
      inject: [ConfigService], // Dependencies cho factory
    },
  ],
})
export class DatabaseModule {}
```

### 4. Async Provider

```typescript
@Module({
  providers: [
    {
      provide: 'ASYNC_CONFIG',
      useFactory: async () => {
        const config = await loadConfigFromRemote()
        return config
      },
    },
  ],
})
export class ConfigModule {}
```

### 5. Class Provider với useClass

```typescript
// Interface
interface IUserRepository {
  findById(id: string): Promise<User>
}

// Implementations
@Injectable()
export class DatabaseUserRepository implements IUserRepository {
  async findById(id: string): Promise<User> {
    // Database implementation
  }
}

@Injectable()
export class InMemoryUserRepository implements IUserRepository {
  async findById(id: string): Promise<User> {
    // In-memory implementation
  }
}

// Module configuration
@Module({
  providers: [
    {
      provide: 'IUserRepository',
      useClass: process.env.NODE_ENV === 'test' ? InMemoryUserRepository : DatabaseUserRepository,
    },
  ],
})
export class UserModule {}

// Usage
@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
  ) {}
}
```

## Injection Tokens và Custom Providers

### 1. String Tokens

```typescript
// Constants file
export const TOKENS = {
  EMAIL_SERVICE: 'EMAIL_SERVICE',
  CACHE_MANAGER: 'CACHE_MANAGER',
} as const

// Provider
@Module({
  providers: [
    {
      provide: TOKENS.EMAIL_SERVICE,
      useClass: NodemailerService,
    },
  ],
})
export class EmailModule {}

// Usage
@Injectable()
export class UserService {
  constructor(
    @Inject(TOKENS.EMAIL_SERVICE)
    private emailService: IEmailService,
  ) {}
}
```

### 2. Symbol Tokens

```typescript
// Tokens
export const EMAIL_SERVICE_TOKEN = Symbol('EMAIL_SERVICE')

// Provider
@Module({
  providers: [
    {
      provide: EMAIL_SERVICE_TOKEN,
      useClass: EmailService,
    },
  ],
})
export class EmailModule {}
```

### 3. Class Tokens

```typescript
// Abstract class as token
export abstract class IPaymentService {
  abstract processPayment(amount: number): Promise<PaymentResult>
}

// Implementation
@Injectable()
export class StripePaymentService implements IPaymentService {
  async processPayment(amount: number): Promise<PaymentResult> {
    // Stripe implementation
  }
}

// Module
@Module({
  providers: [
    {
      provide: IPaymentService,
      useClass: StripePaymentService,
    },
  ],
})
export class PaymentModule {}

// Usage
@Injectable()
export class OrderService {
  constructor(private paymentService: IPaymentService) {}
}
```

## Scope của Dependencies

### 1. Singleton Scope (Mặc định)

```typescript
@Injectable({ scope: Scope.DEFAULT })
export class UserService {
  // Chỉ có 1 instance trong toàn bộ application
}
```

### 2. Request Scope

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  // Tạo instance mới cho mỗi HTTP request
}
```

### 3. Transient Scope

```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {
  // Tạo instance mới mỗi khi được inject
}
```

## Ví dụ thực tế

### Ví dụ 1: Service Layer với Repository Pattern

```typescript
// Domain interface
export interface IUserRepository {
  findById(id: string): Promise<User | null>
  create(user: CreateUserDto): Promise<User>
  update(id: string, user: UpdateUserDto): Promise<User>
  delete(id: string): Promise<void>
}

// Repository implementation
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async create(user: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data: user })
  }

  async update(id: string, user: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: user })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } })
  }
}

// Service layer
@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
    private hashingService: HashingService,
    private emailService: EmailService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Business logic
    const hashedPassword = await this.hashingService.hash(createUserDto.password)

    const user = await this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    })

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email)

    return user
  }
}

// Module configuration
@Module({
  imports: [SharedModule],
  providers: [
    UserService,
    {
      provide: 'IUserRepository',
      useClass: PrismaUserRepository,
    },
  ],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
```

### Ví dụ 2: Configuration Service

```typescript
// Configuration interface
export interface IAppConfig {
  port: number
  database: {
    url: string
    maxConnections: number
  }
  jwt: {
    secret: string
    expiresIn: string
  }
}

// Configuration service
@Injectable()
export class ConfigService {
  private readonly config: IAppConfig

  constructor() {
    this.config = {
      port: parseInt(process.env.PORT || '3000'),
      database: {
        url: process.env.DATABASE_URL!,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      },
      jwt: {
        secret: process.env.JWT_SECRET!,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      },
    }
  }

  get<K extends keyof IAppConfig>(key: K): IAppConfig[K] {
    return this.config[key]
  }
}

// Module
@Module({
  providers: [
    ConfigService,
    {
      provide: 'APP_CONFIG',
      useFactory: (configService: ConfigService) => configService,
      inject: [ConfigService],
    },
  ],
  exports: [ConfigService, 'APP_CONFIG'],
})
export class ConfigModule {}

// Usage in other services
@Injectable()
export class DatabaseService {
  constructor(@Inject('APP_CONFIG') private config: ConfigService) {
    const dbConfig = this.config.get('database')
    console.log(`Connecting to: ${dbConfig.url}`)
  }
}
```

### Ví dụ 3: Dynamic Module với DI

```typescript
// Dynamic module
export interface CacheModuleOptions {
  ttl: number
  max: number
  host?: string
  port?: number
}

@Module({})
export class CacheModule {
  static register(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useValue: options,
        },
        {
          provide: 'CACHE_SERVICE',
          useFactory: (opts: CacheModuleOptions) => {
            if (opts.host && opts.port) {
              return new RedisCacheService(opts)
            }
            return new InMemoryCacheService(opts)
          },
          inject: ['CACHE_OPTIONS'],
        },
      ],
      exports: ['CACHE_SERVICE'],
    }
  }
}

// Usage
@Module({
  imports: [
    CacheModule.register({
      ttl: 3600,
      max: 1000,
      host: 'localhost',
      port: 6379,
    }),
  ],
})
export class AppModule {}
```

## Best Practices

### 1. Sử dụng Interfaces để Loose Coupling

```typescript
// ✅ Good - Sử dụng interface
export interface IEmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>
}

@Injectable()
export class UserService {
  constructor(
    @Inject('IEmailService')
    private emailService: IEmailService,
  ) {}
}

// ❌ Bad - Tight coupling với concrete class
@Injectable()
export class UserService {
  constructor(private emailService: NodemailerService) {}
}
```

### 2. Sử dụng Tokens thay vì Magic Strings

```typescript
// ✅ Good - Constants
export const INJECTION_TOKENS = {
  EMAIL_SERVICE: Symbol('EMAIL_SERVICE'),
  CACHE_SERVICE: Symbol('CACHE_SERVICE'),
  CONFIG: Symbol('CONFIG'),
} as const;

// ❌ Bad - Magic strings
@Inject('EMAIL_SERVICE') // Dễ typo và khó maintain
```

### 3. Tạo Barrel Exports cho Tokens

```typescript
// tokens/index.ts
export const TOKENS = {
  // Services
  EMAIL_SERVICE: Symbol('EMAIL_SERVICE'),
  CACHE_SERVICE: Symbol('CACHE_SERVICE'),

  // Repositories
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  PRODUCT_REPOSITORY: Symbol('PRODUCT_REPOSITORY'),

  // Configuration
  APP_CONFIG: Symbol('APP_CONFIG'),
  DB_CONFIG: Symbol('DB_CONFIG'),
} as const

export type TokenType = (typeof TOKENS)[keyof typeof TOKENS]
```

### 4. Testing với DI

```typescript
// user.service.spec.ts
describe('UserService', () => {
  let service: UserService
  let mockUserRepository: jest.Mocked<IUserRepository>
  let mockEmailService: jest.Mocked<IEmailService>

  beforeEach(async () => {
    // Create mocks
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    mockEmailService = {
      sendEmail: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: TOKENS.USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: TOKENS.EMAIL_SERVICE,
          useValue: mockEmailService,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
  })

  it('should create user and send welcome email', async () => {
    // Arrange
    const createUserDto = { email: 'test@test.com', name: 'Test User' }
    const createdUser = { id: '1', ...createUserDto }

    mockUserRepository.create.mockResolvedValue(createdUser)

    // Act
    const result = await service.createUser(createUserDto)

    // Assert
    expect(mockUserRepository.create).toHaveBeenCalledWith(createUserDto)
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(createUserDto.email, 'Welcome', expect.any(String))
    expect(result).toEqual(createdUser)
  })
})
```

### 5. Circular Dependencies Resolution

```typescript
// ❌ Circular dependency problem
@Injectable()
export class UserService {
  constructor(private orderService: OrderService) {}
}

@Injectable()
export class OrderService {
  constructor(private userService: UserService) {}
}

// ✅ Solution 1: forwardRef
@Injectable()
export class UserService {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {}
}

// ✅ Solution 2: Event-driven architecture
@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(userData: CreateUserDto) {
    const user = await this.userRepository.create(userData)

    // Emit event instead of direct dependency
    this.eventEmitter.emit('user.created', { user })

    return user
  }
}

@Injectable()
export class OrderService {
  @OnEvent('user.created')
  handleUserCreated(payload: { user: User }) {
    // Handle user creation
  }
}
```

## Kết luận

Dependency Injection trong NestJS là một công cụ mạnh mẽ giúp:

1. **Tăng tính linh hoạt**: Dễ dàng thay đổi implementation
2. **Cải thiện khả năng test**: Mock dependencies dễ dàng
3. **Giảm coupling**: Các class ít phụ thuộc vào nhau
4. **Tăng tính tái sử dụng**: Code có thể sử dụng lại ở nhiều nơi
5. **Dễ bảo trì**: Code rõ ràng và có cấu trúc

Hiểu rõ về DI và IoC sẽ giúp bạn viết code NestJS hiệu quả và maintainable hơn.
