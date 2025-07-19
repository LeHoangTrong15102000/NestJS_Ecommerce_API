# Cách Cấu Hình Config và useFactory trong NestJS

## Mục lục

1. [Tổng quan về cấu hình Config trong dự án](#tổng-quan-về-cấu-hình-config-trong-dự-án)
2. [So sánh với cách tiêu chuẩn sử dụng ConfigModule](#so-sánh-với-cách-tiêu-chuẩn-sử-dụng-configmodule)
3. [useFactory là gì và cách sử dụng](#usefactory-là-gì-và-cách-sử-dụng)
4. [Ví dụ thực tế useFactory trong dự án](#ví-dụ-thực-tế-usefactory-trong-dự-án)
5. [Best Practices](#best-practices)

## Tổng quan về cấu hình Config trong dự án

### Cách hiện tại trong dự án

Dự án này **KHÔNG sử dụng ConfigModule của NestJS** mà thay vào đó sử dụng một cách tiếp cận custom với **Zod validation**.

#### File `src/shared/config.ts`:

```typescript
import z from 'zod'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

// Load environment variables từ file .env
config({
  path: '.env',
})

// Kiểm tra xem file .env có tồn tại không
if (!fs.existsSync(path.resolve('.env'))) {
  console.log('Không tìm thấy file .env')
  process.exit(1)
}

// Định nghĩa schema validation bằng Zod
const configSchema = z.object({
  DATABASE_URL: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  SECRET_API_KEY: z.string(),
  ADMIN_NAME: z.string(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_EMAIL: z.string(),
  ADMIN_PHONENUMBER: z.string(),
  OTP_EXPIRES_IN: z.string(),
  RESEND_API_KEY: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  GOOGLE_CLIENT_REDIRECT_URI: z.string(),
  APP_NAME: z.string(),
  PREFIX_STATIC_ENDPOINT: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET_NAME: z.string(),
})

// Validate environment variables
const configServer = configSchema.safeParse(process.env)
if (!configServer.success) {
  console.log('Các giá trị khai báo trong file env không hợp lệ')
  console.error(configServer.error)
  process.exit(1)
}

// Export validated config
const envConfig = configServer.data
export default envConfig
```

#### Cách sử dụng trong các service:

```typescript
// src/shared/services/token.service.ts
import envConfig from 'src/shared/config'

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AccessTokenPayloadCreate) {
    return this.jwtService.sign(
      { ...payload, uuid: uuidv4() },
      {
        secret: envConfig.ACCESS_TOKEN_SECRET, // ✅ Sử dụng trực tiếp
        expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN, // ✅ Type-safe
        algorithm: 'HS256',
      },
    )
  }
}
```

```typescript
// src/shared/guards/api-key.guard.ts
import envConfig from 'src/shared/config'

@Injectable()
export class APIKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const xAPIKey = request.headers['x-api-key']

    if (xAPIKey !== envConfig.SECRET_API_KEY) {
      // ✅ Sử dụng trực tiếp
      throw new UnauthorizedException()
    }
    return true
  }
}
```

### Ưu điểm của cách tiếp cận này:

1. **Type Safety**: Zod cung cấp type safety mạnh mẽ
2. **Validation**: Tự động validate tất cả env variables khi khởi động
3. **Early Failure**: App fail ngay khi start nếu config không hợp lệ
4. **Simple Import**: Chỉ cần import và sử dụng trực tiếp
5. **No Dependency**: Không cần dependency injection

### Nhược điểm:

1. **Không sử dụng DI**: Không tận dụng được IoC container của NestJS
2. **Khó test**: Khó mock config trong unit test
3. **Không dynamic**: Không thể thay đổi config runtime
4. **Global state**: Config trở thành global state

## So sánh với cách tiêu chuẩn sử dụng ConfigModule

### Cách tiêu chuẩn với ConfigModule:

```typescript
// app.module.ts - Cách tiêu chuẩn
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        // Validation logic
        const schema = z.object({
          DATABASE_URL: z.string(),
          JWT_SECRET: z.string(),
          // ... other fields
        })
        return schema.parse(config)
      },
    }),
    // ... other modules
  ],
})
export class AppModule {}

// Usage trong service
@Injectable()
export class TokenService {
  constructor(private configService: ConfigService) {}

  signAccessToken(payload: any) {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN'),
    })
  }
}
```

### So sánh chi tiết:

| Tiêu chí                 | Cách hiện tại (Custom Zod) | Cách tiêu chuẩn (ConfigModule) |
| ------------------------ | -------------------------- | ------------------------------ |
| **Type Safety**          | ✅ Rất tốt (Zod)           | ⚠️ Phụ thuộc vào generic types |
| **Validation**           | ✅ Tự động với Zod         | ✅ Có thể custom validate      |
| **Dependency Injection** | ❌ Không sử dụng           | ✅ Hoàn toàn                   |
| **Testing**              | ❌ Khó mock                | ✅ Dễ mock                     |
| **Performance**          | ✅ Nhanh (no DI overhead)  | ⚠️ Có overhead nhẹ             |
| **Flexibility**          | ❌ Static                  | ✅ Dynamic                     |
| **Maintainability**      | ⚠️ Trung bình              | ✅ Tốt                         |

## useFactory là gì và cách sử dụng

### Khái niệm useFactory

`useFactory` là một loại **Factory Provider** trong NestJS cho phép bạn tạo ra providers động bằng cách sử dụng một factory function.

### Syntax cơ bản:

```typescript
{
  provide: 'TOKEN_NAME',
  useFactory: (dep1: Service1, dep2: Service2) => {
    // Logic để tạo ra instance
    return new SomeService(dep1, dep2)
  },
  inject: [Service1, Service2], // Dependencies cho factory function
}
```

### Các trường hợp sử dụng useFactory:

#### 1. **Conditional Provider Creation**

```typescript
{
  provide: 'DATABASE_CONNECTION',
  useFactory: (configService: ConfigService) => {
    const dbType = configService.get('DB_TYPE')

    if (dbType === 'mysql') {
      return new MySQLConnection(configService.get('MYSQL_URL'))
    } else if (dbType === 'postgres') {
      return new PostgreSQLConnection(configService.get('POSTGRES_URL'))
    }

    throw new Error('Unsupported database type')
  },
  inject: [ConfigService],
}
```

#### 2. **Async Provider Creation**

```typescript
{
  provide: 'ASYNC_CONFIG',
  useFactory: async (httpService: HttpService) => {
    const response = await httpService.get('https://api.example.com/config')
    return response.data
  },
  inject: [HttpService],
}
```

#### 3. **Complex Object Creation**

```typescript
{
  provide: 'CACHE_SERVICE',
  useFactory: (configService: ConfigService) => {
    const cacheConfig = {
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      ttl: configService.get('CACHE_TTL'),
    }

    return new Redis(cacheConfig)
  },
  inject: [ConfigService],
}
```

#### 4. **Third-party Library Integration**

```typescript
{
  provide: 'LOGGER',
  useFactory: (configService: ConfigService) => {
    const winston = require('winston')

    return winston.createLogger({
      level: configService.get('LOG_LEVEL'),
      format: winston.format.json(),
      transports: [
        new winston.transports.File({
          filename: configService.get('LOG_FILE')
        }),
      ],
    })
  },
  inject: [ConfigService],
}
```

## Ví dụ thực tế useFactory trong dự án

Mặc dù dự án hiện tại không sử dụng useFactory nhiều, nhưng có một số ví dụ trong AppModule:

### 1. Global Providers trong AppModule:

```typescript
// src/app.module.ts
@Module({
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: CustomZodValidationPipe, // ✅ useClass
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor, // ✅ useClass
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter, // ✅ useClass
    },
  ],
})
export class AppModule {}
```

### 2. Ví dụ useFactory để cải thiện dự án:

#### A. Database Connection Factory:

```typescript
// shared/shared.module.ts - Improved version
@Global()
@Module({
  providers: [
    // ... existing providers
    {
      provide: 'DATABASE_CONFIG',
      useFactory: () => {
        return {
          url: envConfig.DATABASE_URL,
          log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
          errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
        }
      },
    },
    {
      provide: PrismaService,
      useFactory: (dbConfig: any) => {
        return new PrismaService(dbConfig)
      },
      inject: ['DATABASE_CONFIG'],
    },
  ],
})
export class SharedModule {}
```

#### B. Email Service Factory:

```typescript
{
  provide: 'EMAIL_SERVICE',
  useFactory: () => {
    const emailProvider = envConfig.EMAIL_PROVIDER // 'resend' | 'sendgrid' | 'nodemailer'

    switch (emailProvider) {
      case 'resend':
        return new ResendEmailService(envConfig.RESEND_API_KEY)
      case 'sendgrid':
        return new SendGridEmailService(envConfig.SENDGRID_API_KEY)
      case 'nodemailer':
        return new NodemailerEmailService(envConfig.SMTP_CONFIG)
      default:
        throw new Error(`Unsupported email provider: ${emailProvider}`)
    }
  },
}
```

#### C. S3 Service Factory:

```typescript
// src/shared/shared.module.ts - Enhanced version
{
  provide: 'STORAGE_SERVICE',
  useFactory: () => {
    const storageType = process.env.STORAGE_TYPE || 'local'

    if (storageType === 's3') {
      return new S3Service({
        region: envConfig.S3_REGION,
        accessKeyId: envConfig.S3_ACCESS_KEY_ID,
        secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
        bucketName: envConfig.S3_BUCKET_NAME,
      })
    } else if (storageType === 'local') {
      return new LocalStorageService({
        uploadDir: './uploads',
      })
    }

    throw new Error(`Unsupported storage type: ${storageType}`)
  },
}
```

### 3. Dynamic Module với useFactory:

```typescript
// cache/cache.module.ts
export interface CacheModuleOptions {
  ttl: number
  max: number
  type: 'memory' | 'redis'
  redisUrl?: string
}

@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions): DynamicModule {
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
            if (opts.type === 'redis' && opts.redisUrl) {
              return new RedisCacheService({
                url: opts.redisUrl,
                ttl: opts.ttl,
                max: opts.max,
              })
            } else {
              return new MemoryCacheService({
                ttl: opts.ttl,
                max: opts.max,
              })
            }
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
    CacheModule.forRoot({
      ttl: 3600,
      max: 1000,
      type: 'redis',
      redisUrl: envConfig.REDIS_URL,
    }),
  ],
})
export class AppModule {}
```

### 4. JWT Module với useFactory:

```typescript
// shared/shared.module.ts - Using useFactory for JWT
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: envConfig.ACCESS_TOKEN_SECRET,
        signOptions: {
          expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN,
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  // ... other providers
})
export class SharedModule {}
```

## Khi nào nên sử dụng useFactory?

### ✅ Nên sử dụng useFactory khi:

1. **Conditional Logic**: Cần tạo provider khác nhau tùy theo điều kiện
2. **Complex Configuration**: Cần logic phức tạp để tạo config object
3. **Async Initialization**: Cần load data bất đồng bộ
4. **Third-party Integration**: Cần khởi tạo thư viện bên ngoài
5. **Environment-based**: Cần provider khác nhau theo môi trường

### ❌ Không nên sử dụng useFactory khi:

1. **Simple Cases**: Chỉ cần tạo instance đơn giản
2. **Static Values**: Chỉ cần inject giá trị tĩnh (dùng `useValue`)
3. **Standard Classes**: Class thông thường có thể dùng `useClass`

## Best Practices

### 1. **Type Safety với useFactory**

```typescript
// Define interface for factory return type
interface ICacheService {
  get(key: string): Promise<any>
  set(key: string, value: any, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}

// Use interface in factory
{
  provide: 'CACHE_SERVICE',
  useFactory: (): ICacheService => {
    // Implementation
  },
}

// Inject with proper typing
@Injectable()
export class UserService {
  constructor(
    @Inject('CACHE_SERVICE')
    private cacheService: ICacheService, // ✅ Type-safe
  ) {}
}
```

### 2. **Error Handling trong Factory**

```typescript
{
  provide: 'DATABASE_CONNECTION',
  useFactory: async (configService: ConfigService) => {
    try {
      const dbUrl = configService.get<string>('DATABASE_URL')
      if (!dbUrl) {
        throw new Error('DATABASE_URL is required')
      }

      const connection = await createConnection(dbUrl)
      await connection.authenticate()

      return connection
    } catch (error) {
      console.error('Database connection failed:', error)
      throw error
    }
  },
  inject: [ConfigService],
}
```

### 3. **Testing với useFactory**

```typescript
describe('UserService', () => {
  let service: UserService
  let mockCacheService: jest.Mocked<ICacheService>

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: 'CACHE_SERVICE',
          useValue: mockCacheService, // ✅ Mock the factory result
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
  })

  // Tests...
})
```

### 4. **Async Factory với Cleanup**

```typescript
{
  provide: 'REDIS_CLIENT',
  useFactory: async (): Promise<Redis> => {
    const redis = new Redis(process.env.REDIS_URL)

    // Setup connection event handlers
    redis.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    // Wait for connection
    await new Promise((resolve, reject) => {
      redis.on('ready', resolve)
      redis.on('error', reject)
      setTimeout(reject, 5000) // 5s timeout
    })

    return redis
  },
}
```

### 5. **Factory với Configuration Validation**

```typescript
interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
}

{
  provide: 'DATABASE_CONNECTION',
  useFactory: (config: ConfigService): Promise<Connection> => {
    const dbConfig: DatabaseConfig = {
      host: config.get<string>('DB_HOST'),
      port: config.get<number>('DB_PORT'),
      database: config.get<string>('DB_NAME'),
      username: config.get<string>('DB_USER'),
      password: config.get<string>('DB_PASS'),
    }

    // Validate configuration
    const configSchema = z.object({
      host: z.string().min(1),
      port: z.number().min(1).max(65535),
      database: z.string().min(1),
      username: z.string().min(1),
      password: z.string().min(1),
    })

    const validatedConfig = configSchema.parse(dbConfig)

    return createConnection(validatedConfig)
  },
  inject: [ConfigService],
}
```

## Kết luận

### Về Config trong dự án hiện tại:

1. **Ưu điểm**: Type safety tốt, validation mạnh mẽ, đơn giản sử dụng
2. **Nhược điểm**: Không tận dụng DI, khó test, không linh hoạt
3. **Khuyến nghị**: Có thể giữ nguyên nếu dự án nhỏ, hoặc migrate sang ConfigModule nếu cần tính linh hoạt cao hơn

### Về useFactory:

1. **Công cụ mạnh mẽ** để tạo providers phức tạp trong NestJS
2. **Phù hợp** cho việc tạo providers có điều kiện, async initialization
3. **Cần chú ý** type safety và error handling
4. **Kết hợp tốt** với ConfigModule để tạo ra architecture linh hoạt

useFactory là một pattern quan trọng trong NestJS giúp bạn tạo ra các providers động và linh hoạt, đặc biệt hữu ích khi cần logic phức tạp để khởi tạo dependencies.
