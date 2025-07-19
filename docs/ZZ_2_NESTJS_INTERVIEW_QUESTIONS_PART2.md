# 🎯 Câu Hỏi Phỏng Vấn NestJS - Phần 2

## 6. Performance & Optimization

### **Câu hỏi 6.1:** Implement caching strategies cho user permissions và database queries?

**Trả lời:**

**Redis Caching Implementation:**

```typescript
@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key)
    return value ? JSON.parse(value) : null
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
}

// Permission caching service
@Injectable()
export class PermissionCacheService {
  private readonly TTL = 900 // 15 minutes

  constructor(
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async getUserPermissions(userId: number): Promise<Permission[]> {
    const cacheKey = `user:${userId}:permissions`

    // Try cache first
    let permissions = await this.cacheService.get<Permission[]>(cacheKey)
    if (permissions) {
      return permissions
    }

    // Query from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    })

    permissions = user?.role.permissions || []

    // Cache result
    await this.cacheService.set(cacheKey, permissions, this.TTL)

    return permissions
  }

  async invalidateUserCache(userId: number): Promise<void> {
    await this.cacheService.del(`user:${userId}:permissions`)
  }

  async invalidateRoleCache(roleId: number): Promise<void> {
    // Get all users with this role
    const users = await this.prisma.user.findMany({
      where: { roleId },
      select: { id: true },
    })

    // Invalidate all affected users
    const promises = users.map((user) => this.invalidateUserCache(user.id))

    await Promise.all(promises)
  }
}
```

**Query Result Caching Decorator:**

```typescript
export function CacheResult(ttl: number = 300, keyPrefix?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService

      if (!cacheService) {
        return method.apply(this, args)
      }

      // Generate cache key
      const argsKey = JSON.stringify(args)
      const cacheKey = `${keyPrefix || target.constructor.name}:${propertyName}:${argsKey}`

      // Try cache
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return cached
      }

      // Execute method
      const result = await method.apply(this, args)

      // Cache result
      await cacheService.set(cacheKey, result, ttl)

      return result
    }
  }
}

// Usage example
@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  @CacheResult(600, 'products') // Cache for 10 minutes
  async getFeaturedProducts(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { featured: true, deletedAt: null },
      include: { category: true, brand: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
  }
}
```

### **Câu hỏi 6.2:** Optimize file uploads với AWS S3 và implement pre-signed URLs?

**Trả lời:**

**S3 Service Implementation:**

```typescript
@Injectable()
export class S3Service {
  private readonly s3Client: S3Client
  private readonly bucketName: string

  constructor() {
    this.s3Client = new S3Client({
      region: envConfig.S3_REGION,
      credentials: {
        accessKeyId: envConfig.S3_ACCESS_KEY_ID,
        secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
      },
    })
    this.bucketName = envConfig.S3_BUCKET_NAME
  }

  // Direct upload for small files
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    const key = `${folder}/${uuidv4()}-${file.originalname}`

    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    }

    try {
      await this.s3Client.send(new PutObjectCommand(uploadParams))
      return `https://${this.bucketName}.s3.${envConfig.S3_REGION}.amazonaws.com/${key}`
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  // Pre-signed URL for large files
  async generatePresignedUploadUrl(
    fileName: string,
    contentType: string,
    folder: string = 'uploads',
    expiresIn: number = 3600, // 1 hour
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    const key = `${folder}/${uuidv4()}-${fileName}`

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    })

    const fileUrl = `https://${this.bucketName}.s3.${envConfig.S3_REGION}.amazonaws.com/${key}`

    return { uploadUrl, fileUrl, key }
  }

  // Pre-signed URL for downloads
  async generatePresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    return getSignedUrl(this.s3Client, command, { expiresIn })
  }

  // Multipart upload for very large files
  async initiateMultipartUpload(
    fileName: string,
    contentType: string,
    folder: string = 'uploads',
  ): Promise<{ uploadId: string; key: string }> {
    const key = `${folder}/${uuidv4()}-${fileName}`

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    })

    const response = await this.s3Client.send(command)

    return {
      uploadId: response.UploadId!,
      key,
    }
  }

  async generateMultipartUploadUrls(key: string, uploadId: string, partCount: number): Promise<string[]> {
    const urls: string[] = []

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      })

      urls.push(url)
    }

    return urls
  }
}
```

**Media Controller với File Validation:**

```typescript
@Controller('media')
export class MediaController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @Auth([AuthType.Bearer])
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeWithUnlink({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @ActiveUser() user: ActiveUserData,
  ) {
    try {
      const fileUrl = await this.s3Service.uploadFile(file, 'user-uploads')

      // Save to database
      const mediaRecord = await this.prisma.media.create({
        data: {
          url: fileUrl,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedById: user.sub,
        },
      })

      return {
        success: true,
        data: mediaRecord,
      }
    } catch (error) {
      throw new BadRequestException('File upload failed')
    }
  }

  @Post('presigned-upload')
  @Auth([AuthType.Bearer])
  async getPresignedUploadUrl(@Body() body: { fileName: string; contentType: string; fileSize: number }) {
    // Validate file size and type
    if (body.fileSize > 100 * 1024 * 1024) {
      // 100MB
      throw new BadRequestException('File too large')
    }

    if (!body.contentType.startsWith('image/')) {
      throw new BadRequestException('Invalid file type')
    }

    const { uploadUrl, fileUrl, key } = await this.s3Service.generatePresignedUploadUrl(body.fileName, body.contentType)

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn: 3600,
    }
  }

  @Post('multipart-upload')
  @Auth([AuthType.Bearer])
  async initiateMultipartUpload(
    @Body() body: { fileName: string; contentType: string; fileSize: number; partSize: number },
  ) {
    const partCount = Math.ceil(body.fileSize / body.partSize)

    if (partCount > 1000) {
      // AWS limit
      throw new BadRequestException('Too many parts')
    }

    const { uploadId, key } = await this.s3Service.initiateMultipartUpload(body.fileName, body.contentType)

    const uploadUrls = await this.s3Service.generateMultipartUploadUrls(key, uploadId, partCount)

    return {
      uploadId,
      key,
      uploadUrls,
      partCount,
    }
  }
}
```

---

## 7. Security Best Practices

### **Câu hỏi 7.1:** Implement rate limiting và API security measures?

**Trả lời:**

**Rate Limiting với Redis:**

```typescript
@Injectable()
export class RateLimitService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    identifier?: string,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const redisKey = `rate_limit:${key}:${window}${identifier ? `:${identifier}` : ''}`

    const current = await this.redis.incr(redisKey)

    if (current === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000))
    }

    const remaining = Math.max(0, limit - current)
    const resetTime = (window + 1) * windowMs

    return {
      allowed: current <= limit,
      remaining,
      resetTime,
    }
  }
}

// Rate limiting decorator
export function RateLimit(limit: number, windowMs: number = 60000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const request = args.find((arg) => arg?.ip && arg?.headers)
      if (!request) return method.apply(this, args)

      const rateLimitService: RateLimitService = this.rateLimitService
      const userKey = request.user?.id || request.ip

      const result = await rateLimitService.checkRateLimit(
        `${target.constructor.name}:${propertyName}`,
        limit,
        windowMs,
        userKey,
      )

      if (!result.allowed) {
        throw new TooManyRequestsException({
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        })
      }

      // Add rate limit headers
      if (request.res) {
        request.res.setHeader('X-RateLimit-Limit', limit)
        request.res.setHeader('X-RateLimit-Remaining', result.remaining)
        request.res.setHeader('X-RateLimit-Reset', result.resetTime)
      }

      return method.apply(this, args)
    }
  }
}

// Usage example
@Controller('auth')
export class AuthController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Post('login')
  @RateLimit(5, 15 * 60 * 1000) // 5 attempts per 15 minutes
  async login(@Body() body: LoginDto, @Req() request: Request) {
    return this.authService.login(body)
  }

  @Post('otp')
  @RateLimit(3, 5 * 60 * 1000) // 3 OTP requests per 5 minutes
  async sendOTP(@Body() body: SendOTPDto) {
    return this.authService.sendOTP(body)
  }
}
```

**API Security Measures:**

```typescript
// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

// CORS configuration
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://yourdomain.com', 'https://admin.yourdomain.com']

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
})

// Request sanitization
@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    // Sanitize request body
    if (request.body) {
      request.body = this.sanitizeObject(request.body)
    }

    // Sanitize query parameters
    if (request.query) {
      request.query = this.sanitizeObject(request.query)
    }

    return next.handle()
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? this.sanitizeString(obj) : obj
    }

    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => this.sanitizeObject(item))
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value)
      } else {
        sanitized[key] = this.sanitizeObject(value)
      }
    }
    return sanitized
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/[<>]/g, '') // Remove < and >
      .trim()
  }
}
```

### **Câu hỏi 7.2:** Implement audit logging và security monitoring?

**Trả lời:**

**Audit Logging System:**

```typescript
interface AuditLogEntry {
  id: string
  userId?: number
  action: string
  resource: string
  resourceId?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
  status: 'SUCCESS' | 'FAILURE'
  errorMessage?: string
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date(),
    }

    // Store in database for persistence
    await this.prisma.auditLog.create({
      data: auditEntry,
    })

    // Also store in Redis for real-time monitoring
    await this.redis.lpush('audit_logs:recent', JSON.stringify(auditEntry))

    // Keep only last 1000 entries in Redis
    await this.redis.ltrim('audit_logs:recent', 0, 999)

    // Alert on suspicious activities
    await this.checkSuspiciousActivity(auditEntry)
  }

  private async checkSuspiciousActivity(entry: AuditLogEntry): Promise<void> {
    // Check for multiple failed login attempts
    if (entry.action === 'LOGIN' && entry.status === 'FAILURE') {
      const recentFailures = await this.prisma.auditLog.count({
        where: {
          userId: entry.userId,
          action: 'LOGIN',
          status: 'FAILURE',
          timestamp: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      })

      if (recentFailures >= 5) {
        await this.sendSecurityAlert({
          type: 'MULTIPLE_FAILED_LOGINS',
          userId: entry.userId,
          count: recentFailures,
          ipAddress: entry.ipAddress,
        })
      }
    }

    // Check for privilege escalation
    if (entry.action === 'UPDATE_USER_ROLE') {
      await this.sendSecurityAlert({
        type: 'PRIVILEGE_ESCALATION',
        userId: entry.userId,
        targetUser: entry.resourceId,
        changes: entry.newValues,
      })
    }
  }

  private async sendSecurityAlert(alert: any): Promise<void> {
    // Send to security monitoring system
    await this.redis.publish(
      'security_alerts',
      JSON.stringify({
        ...alert,
        timestamp: new Date(),
        severity: this.getSeverityLevel(alert.type),
      }),
    )
  }
}

// Audit decorator
export function Audit(action: string, resource: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const auditService: AuditService = this.auditService
      const request = args.find((arg) => arg?.ip && arg?.headers)
      const user = request?.user

      let oldValues: any
      let resourceId: string
      let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
      let errorMessage: string

      try {
        // Capture old values for UPDATE operations
        if (action.includes('UPDATE') || action.includes('DELETE')) {
          const id = args.find((arg) => typeof arg === 'number' || (typeof arg === 'string' && !isNaN(Number(arg))))
          if (id) {
            resourceId = id.toString()
            // Fetch current state before modification
            // oldValues = await this.findCurrentState(resource, id);
          }
        }

        const result = await method.apply(this, args)

        // Capture new values
        const newValues = action.includes('CREATE') || action.includes('UPDATE') ? result : undefined

        await auditService.log({
          userId: user?.id,
          action,
          resource,
          resourceId,
          oldValues,
          newValues,
          ipAddress: request?.ip || 'unknown',
          userAgent: request?.headers?.['user-agent'] || 'unknown',
          status,
        })

        return result
      } catch (error) {
        status = 'FAILURE'
        errorMessage = error.message

        await auditService.log({
          userId: user?.id,
          action,
          resource,
          resourceId,
          ipAddress: request?.ip || 'unknown',
          userAgent: request?.headers?.['user-agent'] || 'unknown',
          status,
          errorMessage,
        })

        throw error
      }
    }
  }
}

// Usage example
@Injectable()
export class UserService {
  constructor(private readonly auditService: AuditService) {}

  @Audit('CREATE_USER', 'USER')
  async createUser(userData: CreateUserDto, @Req() request: Request): Promise<User> {
    return this.userRepository.create(userData)
  }

  @Audit('UPDATE_USER_ROLE', 'USER')
  async updateUserRole(userId: number, roleId: number, @Req() request: Request): Promise<User> {
    return this.userRepository.update(userId, { roleId })
  }
}
```

---

## 8. Design Patterns

### **Câu hỏi 8.1:** Implement CQRS pattern với Event Sourcing cho payment system?

**Trả lời:**

**CQRS Implementation:**

```typescript
// Command interfaces
export interface ICommand<TResponse = void> {
  readonly _commandBrand?: never
}

export interface ICommandHandler<TCommand extends ICommand<TResponse>, TResponse = void> {
  handle(command: TCommand): Promise<Result<TResponse>>
}

// Query interfaces
export interface IQuery<TResponse = void> {
  readonly _queryBrand?: never
}

export interface IQueryHandler<TQuery extends IQuery<TResponse>, TResponse = void> {
  handle(query: TQuery): Promise<TResponse>
}

// Result pattern
export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly value?: T,
    public readonly error?: Error,
  ) {}

  static success<T>(value: T): Result<T> {
    return new Result(true, value)
  }

  static failure<T>(error: Error): Result<T> {
    return new Result(false, undefined, error)
  }

  static isSuccess<T>(result: Result<T>): result is Result<T> & { value: T } {
    return result.isSuccess
  }
}

// Payment domain events
export abstract class DomainEvent {
  public readonly occurredOn: Date
  public readonly eventId: string

  constructor() {
    this.occurredOn = new Date()
    this.eventId = uuidv4()
  }
}

export class PaymentCreatedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly userId: number,
    public readonly amount: number,
    public readonly currency: string,
    public readonly method: PaymentMethod,
  ) {
    super()
  }
}

export class PaymentProcessedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly status: PaymentStatus,
    public readonly gatewayTransactionId?: string,
  ) {
    super()
  }
}

// Payment aggregate root
export class Payment {
  private _events: DomainEvent[] = []

  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly method: PaymentMethod,
    public status: PaymentStatus,
    public readonly metadata?: Record<string, any>,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public gatewayTransactionId?: string,
  ) {}

  static create(
    userId: number,
    orderId: string,
    amount: number,
    currency: string,
    method: PaymentMethod,
    metadata?: Record<string, any>,
  ): Payment {
    const payment = new Payment(uuidv4(), userId, orderId, amount, currency, method, PaymentStatus.PENDING, metadata)

    payment.addEvent(
      new PaymentCreatedEvent(payment.id, payment.userId, payment.amount, payment.currency, payment.method),
    )

    return payment
  }

  process(gatewayTransactionId: string): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error('Payment can only be processed when pending')
    }

    this.status = PaymentStatus.PROCESSING
    this.gatewayTransactionId = gatewayTransactionId
    this.updatedAt = new Date()

    this.addEvent(new PaymentProcessedEvent(this.id, this.status, gatewayTransactionId))
  }

  complete(): void {
    if (this.status !== PaymentStatus.PROCESSING) {
      throw new Error('Payment must be processing to complete')
    }

    this.status = PaymentStatus.COMPLETED
    this.updatedAt = new Date()

    this.addEvent(new PaymentProcessedEvent(this.id, this.status))
  }

  fail(reason?: string): void {
    this.status = PaymentStatus.FAILED
    this.updatedAt = new Date()

    if (reason) {
      this.metadata = { ...this.metadata, failureReason: reason }
    }

    this.addEvent(new PaymentProcessedEvent(this.id, this.status))
  }

  private addEvent(event: DomainEvent): void {
    this._events.push(event)
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this._events]
  }

  markEventsAsCommitted(): void {
    this._events = []
  }
}
```

**Command Handlers:**

```typescript
// Create Payment Command
export class CreatePaymentCommand implements ICommand<Payment> {
  constructor(
    public readonly userId: number,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly method: PaymentMethod,
    public readonly metadata?: Record<string, any>,
  ) {}
}

@Injectable()
export class CreatePaymentCommandHandler implements ICommandHandler<CreatePaymentCommand, Payment> {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly eventBus: EventBus,
  ) {}

  async handle(command: CreatePaymentCommand): Promise<Result<Payment>> {
    try {
      // Business rule validation
      if (command.amount <= 0) {
        return Result.failure(new Error('Amount must be greater than 0'))
      }

      // Create payment aggregate
      const payment = Payment.create(
        command.userId,
        command.orderId,
        command.amount,
        command.currency,
        command.method,
        command.metadata,
      )

      // Persist to event store
      await this.paymentRepository.save(payment)

      // Publish domain events
      const events = payment.getUncommittedEvents()
      for (const event of events) {
        await this.eventBus.publish(event)
      }

      payment.markEventsAsCommitted()

      return Result.success(payment)
    } catch (error) {
      return Result.failure(error as Error)
    }
  }
}

// Process Payment Command
export class ProcessPaymentCommand implements ICommand<void> {
  constructor(
    public readonly paymentId: string,
    public readonly gatewayTransactionId: string,
  ) {}
}

@Injectable()
export class ProcessPaymentCommandHandler implements ICommandHandler<ProcessPaymentCommand, void> {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentGateway: PaymentGatewayService,
    private readonly eventBus: EventBus,
  ) {}

  async handle(command: ProcessPaymentCommand): Promise<Result<void>> {
    try {
      // Load payment aggregate
      const payment = await this.paymentRepository.findById(command.paymentId)
      if (!payment) {
        return Result.failure(new Error('Payment not found'))
      }

      // Process payment
      payment.process(command.gatewayTransactionId)

      // Call external payment gateway
      const gatewayResult = await this.paymentGateway.processPayment({
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        transactionId: command.gatewayTransactionId,
      })

      // Update payment based on gateway response
      if (gatewayResult.success) {
        payment.complete()
      } else {
        payment.fail(gatewayResult.errorMessage)
      }

      // Save changes
      await this.paymentRepository.save(payment)

      // Publish events
      const events = payment.getUncommittedEvents()
      for (const event of events) {
        await this.eventBus.publish(event)
      }

      payment.markEventsAsCommitted()

      return Result.success()
    } catch (error) {
      return Result.failure(error as Error)
    }
  }
}
```

**Event Store Repository:**

```typescript
interface EventStore {
  id: string
  aggregateId: string
  aggregateType: string
  eventType: string
  eventData: any
  eventMetadata: any
  version: number
  timestamp: Date
}

@Injectable()
export class PaymentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventMapper: EventMapper,
  ) {}

  async save(payment: Payment): Promise<void> {
    const events = payment.getUncommittedEvents()

    await this.prisma.$transaction(async (tx) => {
      // Get current version
      const currentVersion = await tx.eventStore.count({
        where: { aggregateId: payment.id },
      })

      // Save events
      for (let i = 0; i < events.length; i++) {
        const event = events[i]
        await tx.eventStore.create({
          data: {
            id: event.eventId,
            aggregateId: payment.id,
            aggregateType: 'Payment',
            eventType: event.constructor.name,
            eventData: JSON.stringify(event),
            eventMetadata: JSON.stringify({
              timestamp: event.occurredOn,
              userId: payment.userId,
            }),
            version: currentVersion + i + 1,
            timestamp: event.occurredOn,
          },
        })
      }

      // Update read model (projection)
      await this.updateReadModel(payment, tx)
    })
  }

  async findById(id: string): Promise<Payment | null> {
    const events = await this.prisma.eventStore.findMany({
      where: {
        aggregateId: id,
        aggregateType: 'Payment',
      },
      orderBy: { version: 'asc' },
    })

    if (events.length === 0) {
      return null
    }

    return this.replayEvents(events)
  }

  private replayEvents(eventRecords: EventStore[]): Payment {
    let payment: Payment | null = null

    for (const record of eventRecords) {
      const event = this.eventMapper.deserialize(record.eventType, record.eventData)

      if (event instanceof PaymentCreatedEvent) {
        payment = new Payment(
          event.paymentId,
          event.userId,
          '', // orderId will be set from event data
          event.amount,
          event.currency,
          event.method,
          PaymentStatus.PENDING,
        )
      } else if (event instanceof PaymentProcessedEvent && payment) {
        if (event.status === PaymentStatus.PROCESSING) {
          payment.status = PaymentStatus.PROCESSING
        } else if (event.status === PaymentStatus.COMPLETED) {
          payment.status = PaymentStatus.COMPLETED
        } else if (event.status === PaymentStatus.FAILED) {
          payment.status = PaymentStatus.FAILED
        }
      }
    }

    return payment!
  }

  private async updateReadModel(payment: Payment, tx: any): Promise<void> {
    // Update read model for queries
    await tx.paymentReadModel.upsert({
      where: { id: payment.id },
      create: {
        id: payment.id,
        userId: payment.userId,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
      update: {
        status: payment.status,
        updatedAt: payment.updatedAt,
      },
    })
  }
}
```

---

Đây là phần 2 của file markdown. Bạn có muốn tôi tiếp tục với các phần còn lại (System Design, DevOps, etc.) không?
