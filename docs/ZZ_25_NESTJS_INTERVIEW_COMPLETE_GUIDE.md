# Hướng dẫn toàn diện NestJS từ cơ bản đến nâng cao

## MỤC LỤC
1. [Cấp độ Cơ bản](#cấp-độ-cơ-bản)
2. [Cấp độ Trung cấp](#cấp-độ-trung-cấp)
3. [Cấp độ Nâng cao](#cấp-độ-nâng-cao)
4. [Patterns và Best Practices](#patterns-và-best-practices)
5. [Tích hợp bên thứ ba](#tích-hợp-bên-thứ-ba)
6. [Ví dụ thực tế](#ví-dụ-thực-tế)

---

## CẤP ĐỘ CƠ BẢN

### 1. Giới thiệu về NestJS và kiến trúc

NestJS là một framework Node.js hiện đại được xây dựng trên TypeScript, giúp phát triển các ứng dụng server-side hiệu quả, có khả năng mở rộng và dễ bảo trì. Framework này kết hợp các yếu tố của OOP (Object-Oriented Programming), FP (Functional Programming) và FRP (Functional Reactive Programming).

**Kiến trúc NestJS:**
```
Request → Middleware → Guards → Interceptors → Pipes → Controller → Service → Database
                                                              ↓
Response ← Filters ← Interceptors ← Controller ← Service ← Database
```

### 2. Thiết lập môi trường phát triển

**Yêu cầu hệ thống:**
- Node.js >= 16.x (khuyến nghị phiên bản LTS mới nhất)
- npm hoặc yarn hoặc pnpm
- Editor: VS Code với NestJS extension

**Cài đặt và khởi tạo dự án:**
```bash
# Cài đặt NestJS CLI toàn cục
npm install -g @nestjs/cli

# Tạo project mới
nest new my-nestjs-app

# Chạy ứng dụng
npm run start:dev
```

### 3. Controllers, Services và Modules cơ bản

**Controllers** chịu trách nhiệm xử lý HTTP requests và trả về responses:

```typescript
// users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserData: CreateUserDto) {
    return this.usersService.create(createUserData);
  }
}
```

**Services** chứa business logic:

```typescript
// users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly users = [];

  findAll() {
    return this.users;
  }

  findOne(id: number) {
    return this.users.find(user => user.id === id);
  }

  create(userData: any) {
    const newUser = {
      id: this.users.length + 1,
      ...userData
    };
    this.users.push(newUser);
    return newUser;
  }
}
```

**Modules** tổ chức code thành các đơn vị logic:

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
```

### 4. Xử lý Request và Routing

**Trích xuất dữ liệu từ Request:**

```typescript
@Controller('products')
export class ProductsController {
  // Route Parameters
  @Get(':id')
  findOne(@Param('id') id: string) {
    return `Product ID: ${id}`;
  }

  // Query Parameters
  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    return { page: parseInt(page), limit: parseInt(limit) };
  }

  // Request Body
  @Post()
  create(@Body() createProductDto: any) {
    return createProductDto;
  }

  // Headers
  @Get('profile')
  getProfile(@Headers('authorization') auth: string) {
    return `Authorization: ${auth}`;
  }
}
```

### 5. Data Transfer Objects (DTOs)

DTOs định nghĩa cấu trúc dữ liệu được chuyển giữa các layer:

```typescript
// dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsInt({ message: 'Tuổi phải là số nguyên' })
  @Min(18, { message: 'Tuổi phải ít nhất 18' })
  age: number;

  @IsOptional()
  phone?: string;
}
```

### 6. Validation và Pipes

**Thiết lập Global Validation:**

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(3000);
}
```

**Built-in Pipes:**

```typescript
@Controller('products')
export class ProductsController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return `Product ID: ${id} (type: ${typeof id})`;
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
  ) {
    return { page };
  }
}
```

### 7. Exception Handling

**Built-in HTTP Exceptions:**

```typescript
@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    const user = this.usersService.findOne(id);

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng có ID ${id}`);
    }

    return user;
  }
}
```

**Custom Exception Filter:**

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}
```

---

## CẤP ĐỘ TRUNG CẤP

### 1. Hệ thống Dependency Injection chi tiết

Dependency Injection (DI) là một design pattern quan trọng trong NestJS, cho phép tạo và quản lý các dependencies một cách tự động.

**Provider Scopes:**

```typescript
// DEFAULT - Singleton (mặc định)
@Injectable()
export class AppService {}

// REQUEST - Mỗi request tạo instance mới
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {}

// TRANSIENT - Mỗi lần inject tạo instance mới
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

### 2. Custom Providers

**useValue Provider:**

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONFIG',
      useValue: {
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password'
      },
    },
  ],
})
export class AppModule {}
```

**useFactory Provider:**

```typescript
const databaseProvider = {
  provide: 'DATABASE_CONNECTION',
  useFactory: async (configService: ConfigService) => {
    const config = {
      host: configService.get('DB_HOST'),
      port: configService.get('DB_PORT'),
    };

    const connection = await createConnection(config);
    return connection;
  },
  inject: [ConfigService],
};
```

### 3. Guards và Authentication

**JWT Authentication Guard:**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token không tìm thấy');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

**Role-based Guard:**

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}
```

### 4. Interceptors và Middleware

**Logging Interceptor:**

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(`${method} ${url} - ${duration}ms`);
      }),
    );
  }
}
```

### 5. Tích hợp cơ sở dữ liệu

**TypeORM Integration:**

```typescript
// app.module.ts
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
    }),
  ],
})
export class AppModule {}
```

**Entity và Repository:**

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }
}
```

### 6. Configuration Management

```typescript
// Configuration với validation
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_HOST: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
  ],
})
export class AppModule {}
```

### 7. Testing Strategies

**Unit Testing:**

```typescript
describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should return an array of users', async () => {
    const mockUsers = [{ id: 1, email: 'test@example.com' }];
    jest.spyOn(repository, 'find').mockResolvedValue(mockUsers as User[]);

    const result = await service.findAll();
    expect(result).toEqual(mockUsers);
  });
});
```

---

## CẤP ĐỘ NÂNG CAO

### 1. Dynamic Modules chi tiết

Dynamic modules cho phép tạo ra các module có thể cấu hình tại runtime:

```typescript
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    const providers = [
      {
        provide: 'LOGGER_OPTIONS',
        useValue: options,
      },
      LoggerService,
    ];

    return {
      module: LoggerModule,
      providers,
      exports: [LoggerService],
      global: true,
    };
  }

  static forRootAsync(options: {
    inject: any[];
    useFactory: (...args: any[]) => Promise<LoggerModuleOptions>;
  }): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: 'LOGGER_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        LoggerService,
      ],
      exports: [LoggerService],
    };
  }
}
```

### 2. Microservices Architecture

**gRPC Microservice:**

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'user',
        protoPath: join(__dirname, 'user.proto'),
        url: '0.0.0.0:5000',
      },
    },
  );

  await app.listen();
}
```

**API Gateway Pattern:**

```typescript
@Controller('api/v1')
export class ApiGatewayController {
  constructor(
    @Inject('USER_SERVICE') private userService: ClientGrpc,
    @Inject('ORDER_SERVICE') private orderService: ClientGrpc,
  ) {}

  @Get('users/:id/orders')
  async getUserOrders(@Param('id') userId: string) {
    const [user, orders] = await Promise.all([
      this.userServiceClient.findById({ id: userId }).toPromise(),
      this.orderServiceClient.findByUserId({ userId }).toPromise(),
    ]);

    return { user, orders: orders.orders };
  }
}
```

### 3. GraphQL Integration

**Code-First Approach:**

```typescript
@Resolver(() => User)
export class UserResolver {
  constructor(
    private userService: UserService,
    private dataLoader: DataLoaderService,
  ) {}

  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  async users(@Args() args: GetUsersArgs): Promise<User[]> {
    return this.userService.findMany(args);
  }

  @ResolveField(() => [Post])
  async posts(@Parent() user: User): Promise<Post[]> {
    return this.dataLoader.loadUserPosts(user.id);
  }

  @Mutation(() => User)
  async createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.userService.create(input);
  }

  @Subscription(() => User)
  userUpdated(@Args('userId') userId: string) {
    return this.pubSub.asyncIterator('userUpdated');
  }
}
```

### 4. WebSocket Implementation

**Advanced WebSocket Gateway:**

```typescript
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, { socketId: string; userId: string }>();

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    const user = await this.authService.validateToken(token);

    if (!user) {
      client.disconnect();
      return;
    }

    this.connectedUsers.set(client.id, { socketId: client.id, userId: user.id });
    client.join(`user_${user.id}`);
    this.server.emit('user_online', { userId: user.id });
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ): Promise<void> {
    const message = await this.chatService.createMessage(data);
    const receiverSocketId = await this.cacheManager.get(`ws_${data.receiverId}`);

    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('newMessage', message);
    }

    client.emit('messageSent', { messageId: message.id, status: 'delivered' });
  }
}
```

### 5. Custom Decorators và Metadata

**Advanced Parameter Decorators:**

```typescript
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext): User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);

// Usage
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}

@Get('profile/email')
getProfileEmail(@CurrentUser('email') email: string) {
  return { email };
}
```

### 6. Performance Optimization

**Database Query Optimization:**

```typescript
@Injectable()
export class OptimizedUserService {
  async findUsersWithPosts(limit: number = 10): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.posts', 'post')
      .select(['user.id', 'user.name', 'user.email', 'post.id', 'post.title'])
      .orderBy('user.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async findUserById(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);

    if (cached) return cached;

    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'createdAt'],
    });

    if (user) {
      await this.cacheManager.set(cacheKey, user, { ttl: 300 });
    }

    return user;
  }
}
```

### 7. Caching Strategies

**Multi-Level Caching:**

```typescript
@Injectable()
export class CachingService {
  private inMemoryCache = new Map<string, { value: any; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    // L1 Cache check
    const inMemory = this.inMemoryCache.get(key);
    if (inMemory && inMemory.expires > Date.now()) {
      return inMemory.value;
    }

    // L2 Cache check (Redis)
    const cached = await this.cacheManager.get<T>(key);
    if (cached) {
      this.inMemoryCache.set(key, {
        value: cached,
        expires: Date.now() + 60000,
      });
      return cached;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    this.inMemoryCache.set(key, {
      value,
      expires: Date.now() + Math.min(ttl * 1000, 60000),
    });

    await this.cacheManager.set(key, value, { ttl });
  }
}
```

---

## PATTERNS VÀ BEST PRACTICES

### 1. Repository Pattern

```typescript
// Interface
export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User>;
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}

// Implementation
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repository.find();
  }

  async findById(id: string): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async create(data: CreateUserDto): Promise<User> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }
}
```

### 2. CQRS Pattern

```typescript
// Commands
export class CreateUserCommand {
  constructor(public readonly data: CreateUserDto) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(command: CreateUserCommand): Promise<User> {
    const { data } = command;
    return this.userRepository.create(data);
  }
}

// Queries
export class GetUsersQuery {
  constructor(public readonly filters?: any) {}
}

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(query: GetUsersQuery): Promise<User[]> {
    return this.userRepository.findAll(query.filters);
  }
}
```

### 3. Event-driven Architecture

```typescript
// Event
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly timestamp: Date,
  ) {}
}

// Event Handler
@EventsHandler(UserCreatedEvent)
export class UserCreatedHandler implements IEventHandler<UserCreatedEvent> {
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {}

  async handle(event: UserCreatedEvent) {
    this.logger.log(`User created: ${event.userId}`);
    await this.emailService.sendWelcomeEmail(event.email);
  }
}
```

### 4. Factory Pattern cho Providers

```typescript
@Injectable()
export class PaymentProviderFactory {
  private providers = new Map<string, PaymentProvider>();

  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paypalProvider: PaypalProvider,
  ) {
    this.providers.set('stripe', stripeProvider);
    this.providers.set('paypal', paypalProvider);
  }

  getProvider(type: string): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider ${type} not found`);
    }
    return provider;
  }
}
```

### 5. Strategy Pattern

```typescript
interface ShippingStrategy {
  calculateCost(weight: number, distance: number): number;
}

@Injectable()
export class FedExStrategy implements ShippingStrategy {
  calculateCost(weight: number, distance: number): number {
    return weight * 0.5 + distance * 0.1;
  }
}

@Injectable()
export class DHLStrategy implements ShippingStrategy {
  calculateCost(weight: number, distance: number): number {
    return weight * 0.6 + distance * 0.08;
  }
}

@Injectable()
export class ShippingService {
  private strategies = new Map<string, ShippingStrategy>();

  constructor(
    private fedexStrategy: FedExStrategy,
    private dhlStrategy: DHLStrategy,
  ) {
    this.strategies.set('fedex', fedexStrategy);
    this.strategies.set('dhl', dhlStrategy);
  }

  calculateShippingCost(
    carrier: string,
    weight: number,
    distance: number,
  ): number {
    const strategy = this.strategies.get(carrier);
    if (!strategy) {
      throw new Error(`Unknown carrier: ${carrier}`);
    }
    return strategy.calculateCost(weight, distance);
  }
}
```

### 6. Async Providers và Circular Dependencies

```typescript
// Giải quyết circular dependencies
@Injectable()
export class UserService {
  constructor(
    @Inject(forwardRef(() => PostService))
    private postService: PostService
  ) {}
}

@Injectable()
export class PostService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService
  ) {}
}
```

---

## TÍCH HỢP BÊN THỨ BA

### 1. Database Integrations

**PostgreSQL với TypeORM:**

```typescript
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      extra: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000,
      },
    }),
  ],
})
export class DatabaseModule {}
```

### 2. Redis Integration

```typescript
@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }
}
```

### 3. JWT Authentication

```typescript
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
```

### 4. File Upload với Multer

```typescript
@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return {
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

### 5. Docker Containerization

```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
```

### 6. AWS Services Integration

```typescript
@Injectable()
export class AwsService {
  private s3: AWS.S3;
  private ses: AWS.SES;

  constructor() {
    AWS.config.update({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.s3 = new AWS.S3();
    this.ses = new AWS.SES();
  }

  async uploadToS3(file: Buffer, key: string): Promise<string> {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file,
      ContentType: 'application/octet-stream',
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const params = {
      Destination: { ToAddresses: [to] },
      Message: {
        Body: { Text: { Data: body } },
        Subject: { Data: subject },
      },
      Source: process.env.SES_FROM_EMAIL,
    };

    await this.ses.sendEmail(params).promise();
  }
}
```

### 7. Message Queues (Bull)

```typescript
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailProcessor],
})
export class QueueModule {}

@Processor('email')
export class EmailProcessor {
  @Process()
  async handleSendEmail(job: Job<any>) {
    const { to, subject, body } = job.data;
    await this.emailService.send(to, subject, body);
  }

  @OnQueueFailed()
  handleFailed(job: Job, err: Error) {
    console.error(`Job ${job.id} failed:`, err);
  }
}
```

### 8. Payment Gateway (Stripe)

```typescript
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'usd') {
    return this.stripe.paymentIntents.create({
      amount: amount * 100,
      currency,
      automatic_payment_methods: { enabled: true },
    });
  }

  async createCheckoutSession(items: any[]) {
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/success`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
    });
  }
}
```

### 9. Swagger/OpenAPI Documentation

```typescript
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('NestJS API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}

// DTO với decorators
export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'password123', minimum: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
```

---

## VÍ DỤ THỰC TẾ

### 1. REST API hoàn chỉnh

**Cấu trúc dự án với pagination và filtering:**

```typescript
@Injectable()
export class UsersService {
  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where('user.name LIKE :search OR user.email LIKE :search',
        { search: `%${search}%` });
    }

    const total = await queryBuilder.getCount();
    const users = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: users,
      total,
      page,
      lastPage: Math.ceil(total / limit)
    };
  }
}
```

### 2. Authentication và Authorization System

**JWT với Refresh Token:**

```typescript
@Injectable()
export class AuthService {
  async login(user: any) {
    const payload = { email: user.email, sub: user.id };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = { email: payload.email, sub: payload.sub };

      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
```

### 3. Real-time Chat Application

**WebSocket Gateway với Room Management:**

```typescript
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(data.roomId);

    const messages = await this.chatService.getRoomMessages(data.roomId);
    client.emit('message_history', messages);

    client.to(data.roomId).emit('user_joined', {
      userId: client.id,
      roomId: data.roomId
    });
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() client: Socket
  ) {
    const message = await this.chatService.createMessage(data);

    this.server.to(data.roomId).emit('receive_message', message);
  }
}
```

### 4. E-commerce Backend

**Order Processing với Payment:**

```typescript
@Injectable()
export class OrderService {
  async createOrder(userId: string, items: OrderItemDto[]) {
    const order = this.orderRepository.create({
      userId,
      items,
      status: 'pending',
      total: this.calculateTotal(items),
    });

    const savedOrder = await this.orderRepository.save(order);

    // Create payment intent
    const paymentIntent = await this.stripeService.createPaymentIntent(
      order.total,
      'usd'
    );

    return {
      order: savedOrder,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async processPayment(orderId: string, paymentIntentId: string) {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      await this.orderRepository.update(orderId, { status: 'paid' });
      await this.inventoryService.reduceStock(orderId);
      await this.emailService.sendOrderConfirmation(orderId);

      return { success: true };
    }

    throw new BadRequestException('Payment failed');
  }
}
```

### 5. File Management System

**S3 Integration với Image Processing:**

```typescript
@Injectable()
export class FileService {
  async uploadImage(file: Express.Multer.File): Promise<string> {
    // Process image
    const processedImage = await sharp(file.buffer)
      .resize(800, 600, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate thumbnail
    const thumbnail = await sharp(file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 60 })
      .toBuffer();

    // Upload to S3
    const fileName = `${Date.now()}-${file.originalname}`;
    const [mainUrl, thumbUrl] = await Promise.all([
      this.s3Service.upload(processedImage, `images/${fileName}`),
      this.s3Service.upload(thumbnail, `thumbnails/${fileName}`),
    ]);

    // Save metadata to database
    await this.fileRepository.save({
      fileName,
      url: mainUrl,
      thumbnailUrl: thumbUrl,
      size: file.size,
      mimeType: file.mimetype,
    });

    return mainUrl;
  }
}
```

### 6. Monitoring và Logging Setup

**Winston với Multiple Transports:**

```typescript
export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
};
```

**Prometheus Metrics:**

```typescript
@Injectable()
export class MetricsService {
  private readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
  });

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);
  }
}
```

---

## KẾT LUẬN VÀ LƯU Ý QUAN TRỌNG

### Best Practices tổng hợp:

1. **Luôn sử dụng DTOs** cho validation và documentation
2. **Tách biệt business logic** vào services
3. **Sử dụng TypeScript interfaces** cho type safety
4. **Xử lý lỗi đúng cách** với custom exceptions
5. **Tổ chức code theo modules** để dễ bảo trì
6. **Implement proper logging** và monitoring
7. **Write comprehensive tests** cho tất cả các layer
8. **Use environment variables** cho configuration
9. **Implement security best practices** (helmet, cors, rate limiting)
10. **Optimize performance** với caching và database indexing

### Common Pitfalls và cách tránh:

1. **Quên khai báo trong Module**: Luôn nhớ import module và declare providers
2. **Circular Dependencies**: Sử dụng forwardRef hoặc refactor code
3. **Memory Leaks**: Cleanup resources trong OnModuleDestroy
4. **N+1 Query Problem**: Sử dụng DataLoader hoặc query optimization
5. **Security Vulnerabilities**: Validate input, sanitize output, use parameterized queries

### Troubleshooting Guide:

- **CORS Issues**: Configure CORS properly trong main.ts
- **Database Connection**: Check connection string và network access
- **JWT Errors**: Verify secret key và token expiration
- **WebSocket Connection**: Check namespace và authentication
- **File Upload**: Verify file size limits và MIME types

### Tài liệu tham khảo:

**Vietnamese Resources:**
- [NestJS - framework thần thánh cho Nodejs](https://viblo.asia/p/nestjs-framework-than-thanh-cho-nodejs-RQqKLL7OK7z)
- [Tìm hiểu về NestJS](https://viblo.asia/p/tim-hieu-ve-nestjs-phan-1-3P0lP0ymlox)
- [Hướng dẫn về Nest.js](https://nbtt.github.io/nestjs-instructions/vi/Tutorial-Windows.html)
- [JWT Authentication với NestJS](https://viblo.asia/p/setup-boilerplate-cho-du-an-nestjs-phan-4-jwtpassport-authentication-voi-thuat-toan-bat-doi-xung-tu-nodecrypto-zXRJ82YNVGq)

**GitHub Repositories:**
- [NestJS RealWorld Example](https://github.com/lujakob/nestjs-realworld-example-app)
- [NestJS Chat App](https://github.com/luthfiarifin/nestjs-chat-app)
- [E-commerce Backend](https://github.com/amrmuhamedd/e-commerce-nestjs)
- [NestJS Project Structure](https://github.com/CatsMiaow/nestjs-project-structure)
- [Awesome NestJS Collection](https://github.com/nestjs/awesome-nestjs)

Hướng dẫn này cung cấp kiến thức toàn diện về NestJS từ cơ bản đến nâng cao, với các ví dụ thực tế và best practices được áp dụng trong các dự án production. Hãy thực hành từng phần một cách có hệ thống để nắm vững framework mạnh mẽ này!