# 🎯 Câu Hỏi Phỏng Vấn NestJS - System Design & DevOps

## 9. System Design

### **Câu hỏi 9.1:** Thiết kế microservices architecture cho e-commerce. Explain service boundaries?

**Trả lời:**

**Service Boundaries:**

```typescript
// 1. User Service - Authentication & User Management
interface UserService {
  login(credentials: LoginDto): Promise<AuthResult>
  register(userData: RegisterDto): Promise<User>
  getUserProfile(userId: number): Promise<UserProfile>
  getUserPermissions(userId: number): Promise<Permission[]>
}

// 2. Product Service - Catalog Management
interface ProductService {
  createProduct(data: CreateProductDto): Promise<Product>
  searchProducts(query: ProductSearchDto): Promise<ProductSearchResult>
  updateInventory(productId: string, quantity: number): Promise<void>
}

// 3. Order Service - Order Processing
interface OrderService {
  createOrder(data: CreateOrderDto): Promise<Order>
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>
  getUserOrders(userId: number): Promise<Order[]>
}

// 4. Payment Service - Payment Processing
interface PaymentService {
  initiatePayment(data: InitiatePaymentDto): Promise<PaymentResult>
  processPayment(paymentId: string): Promise<PaymentStatus>
  refundPayment(paymentId: string): Promise<RefundResult>
}
```

**Inter-Service Communication:**

```typescript
// HTTP Client for sync communication
@Injectable()
export class UserServiceClient {
  constructor(private readonly httpService: HttpService) {}

  async getUserProfile(userId: number): Promise<UserProfile> {
    try {
      const response = await this.httpService.axiosRef.get(`${USER_SERVICE_URL}/users/${userId}`, {
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${await this.getServiceToken()}`,
        },
      })
      return response.data
    } catch (error) {
      throw new ServiceUnavailableException('User service unavailable')
    }
  }
}

// Event Bus for async communication
@Injectable()
export class EventBus {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.redis.publish(`events:${event.eventType}`, JSON.stringify(event))
  }

  async subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    await this.redis.subscribe(`events:${eventType}`)
    this.redis.on('message', async (channel, message) => {
      if (channel === `events:${eventType}`) {
        const event: DomainEvent = JSON.parse(message)
        await handler(event)
      }
    })
  }
}
```

### **Câu hỏi 9.2:** Design event-driven architecture cho order processing?

**Trả lời:**

**Order Saga Pattern:**

```typescript
@Injectable()
export class OrderProcessingSaga {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly eventBus: EventBus,
  ) {}

  @EventHandler('OrderCreated')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      // Step 1: Reserve inventory
      const reservationResult = await this.inventoryService.reserveItems(event.items)

      if (!reservationResult.success) {
        await this.eventBus.publish(
          new OrderInventoryReservationFailedEvent(event.orderId, reservationResult.unavailableItems),
        )
        return
      }

      // Step 2: Process payment
      const paymentResult = await this.paymentService.processPayment({
        orderId: event.orderId,
        amount: event.totalAmount,
        userId: event.userId,
      })

      await this.eventBus.publish(
        new OrderPaymentProcessedEvent(event.orderId, paymentResult.paymentId, paymentResult.status),
      )
    } catch (error) {
      await this.eventBus.publish(new OrderProcessingFailedEvent(event.orderId, error.message))
    }
  }
}
```

---

## 10. DevOps & Deployment

### **Câu hỏi 10.1:** Setup CI/CD với Docker và Kubernetes?

**Trả lời:**

**Multi-stage Dockerfile:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nestjs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
```

**GitHub Actions Pipeline:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports: [5432:5432]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm install -g pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
      - run: pnpm run test:unit
      - run: pnpm run test:e2e

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
```

**Kubernetes Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: nestjs-app
  template:
    spec:
      containers:
        - name: nestjs-app
          image: ghcr.io/yourorg/nestjs-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
```

### **Câu hỏi 10.2:** Implement monitoring và observability?

**Trả lời:**

**Health Checks:**

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get()
  async health(): Promise<HealthStatus> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  }

  @Get('ready')
  async readiness(): Promise<ReadinessStatus> {
    const checks = await Promise.allSettled([this.checkDatabase(), this.checkRedis()])

    const isReady = checks.every((check) => check.status === 'fulfilled')
    return {
      status: isReady ? 'ready' : 'not ready',
      checks: {
        database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
        redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
      },
    }
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping()
  }
}
```

**Structured Logging:**

```typescript
@Injectable()
export class AppLogger extends Logger {
  private readonly winston: winston.Logger

  constructor() {
    super()
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: {
        service: 'nestjs-ecommerce',
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV,
      },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    })
  }

  log(message: string, context?: string, meta?: any): void {
    this.winston.info(message, { context, ...meta })
  }

  error(message: string, trace?: string, context?: string, meta?: any): void {
    this.winston.error(message, { context, trace, ...meta })
  }
}
```

**Metrics Collection:**

```typescript
@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  })

  private readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5],
  })

  incrementRequestCounter(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() })
  }

  observeRequestDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route }, duration)
  }

  getMetrics(): string {
    return register.metrics()
  }
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const startTime = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000
        const response = context.switchToHttp().getResponse()

        this.metricsService.incrementRequestCounter(
          request.method,
          request.route?.path || 'unknown',
          response.statusCode,
        )

        this.metricsService.observeRequestDuration(request.method, request.route?.path || 'unknown', duration)
      }),
    )
  }
}
```

---

## 🎯 Tổng Kết & Tips Phỏng Vấn

### **Cách Trả Lời Hiệu Quả:**

1. **Structure câu trả lời:**

   - Giải thích concept/pattern
   - Đưa ra code example từ dự án
   - Explain trade-offs và alternatives
   - Mention best practices

2. **Highlight experience:**

   - "Trong dự án của tôi, tôi đã implement..."
   - "Khi gặp vấn đề X, tôi đã solve bằng cách..."
   - "So với approach Y, tôi choose Z vì..."

3. **Show problem-solving skills:**
   - Đưa ra multiple solutions
   - Explain khi nào dùng approach nào
   - Mention performance implications
   - Discuss scalability considerations

### **Key Technical Areas Cần Master:**

**Core NestJS:**

- Module architecture & DI
- Guards, Interceptors, Pipes, Filters
- Custom decorators
- Exception handling
- Validation strategies

**Database & ORM:**

- Prisma advanced patterns
- Query optimization
- Transaction handling
- Migration strategies
- Soft delete implementation

**Security:**

- JWT authentication
- RBAC authorization
- Rate limiting
- Input validation
- Audit logging

**Testing:**

- Unit testing with mocks
- Integration testing
- E2E testing
- Test database setup
- Coverage strategies

**Performance:**

- Caching strategies
- File upload optimization
- Database indexing
- Query optimization
- Memory management

**System Design:**

- Microservices architecture
- Event-driven design
- CQRS implementation
- Circuit breaker pattern
- Distributed systems

**DevOps:**

- Docker containerization
- Kubernetes deployment
- CI/CD pipelines
- Monitoring & logging
- Health checks

### **Red Flags Cần Tránh:**

❌ Không explain được trade-offs của solutions
❌ Không biết khi nào nên dùng pattern nào
❌ Không understand security implications
❌ Không có experience với production deployment
❌ Không biết debug performance issues
❌ Không understand database optimization
❌ Không có testing strategy

### **Câu Hỏi Ngược Lại Cho Interviewer:**

1. "Team hiện tại đang face những technical challenges gì?"
2. "Architecture hiện tại như thế nào? Có plans để migrate không?"
3. "Testing strategy và deployment process ra sao?"
4. "Team size và collaboration process?"
5. "Growth opportunities cho senior developers?"

Chúc bạn phỏng vấn thành công! 🚀
