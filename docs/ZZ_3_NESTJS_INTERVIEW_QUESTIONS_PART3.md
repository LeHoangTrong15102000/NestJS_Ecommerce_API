# 🎯 Câu Hỏi Phỏng Vấn NestJS - Phần 3 (System Design & DevOps)

## 9. System Design

### **Câu hỏi 9.1:** Thiết kế một microservices architecture cho e-commerce platform. Explain service boundaries và communication patterns?

**Trả lời:**

**Service Boundaries Design:**

```typescript
// 1. User Service - Identity & Authentication
interface UserService {
  // Authentication
  login(credentials: LoginDto): Promise<AuthResult>
  register(userData: RegisterDto): Promise<User>
  refreshToken(token: string): Promise<AuthResult>

  // User Management
  getUserProfile(userId: number): Promise<UserProfile>
  updateProfile(userId: number, data: UpdateProfileDto): Promise<UserProfile>

  // Authorization
  getUserPermissions(userId: number): Promise<Permission[]>
  hasPermission(userId: number, resource: string, action: string): Promise<boolean>
}

// 2. Product Service - Catalog Management
interface ProductService {
  // Product CRUD
  createProduct(data: CreateProductDto): Promise<Product>
  getProduct(id: string): Promise<Product>
  searchProducts(query: ProductSearchDto): Promise<ProductSearchResult>
  updateInventory(productId: string, quantity: number): Promise<void>

  // Category Management
  getCategories(): Promise<Category[]>
  getProductsByCategory(categoryId: string): Promise<Product[]>
}

// 3. Order Service - Order Management
interface OrderService {
  // Order Processing
  createOrder(data: CreateOrderDto): Promise<Order>
  getOrder(orderId: string): Promise<Order>
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>

  // Order History
  getUserOrders(userId: number): Promise<Order[]>
  getOrderAnalytics(dateRange: DateRange): Promise<OrderAnalytics>
}

// 4. Payment Service - Payment Processing
interface PaymentService {
  // Payment Processing
  initiatePayment(data: InitiatePaymentDto): Promise<PaymentResult>
  processPayment(paymentId: string): Promise<PaymentStatus>
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>

  // Payment Methods
  addPaymentMethod(userId: number, method: PaymentMethodDto): Promise<PaymentMethod>
  getPaymentMethods(userId: number): Promise<PaymentMethod[]>
}

// 5. Notification Service - Communications
interface NotificationService {
  sendEmail(to: string, template: string, data: any): Promise<void>
  sendSMS(to: string, message: string): Promise<void>
  sendPushNotification(userId: number, notification: PushNotificationDto): Promise<void>

  // Bulk notifications
  sendBulkEmail(recipients: string[], template: string, data: any): Promise<void>
}
```

**Inter-Service Communication:**

```typescript
// 1. Synchronous Communication - HTTP/REST
@Injectable()
export class UserServiceClient {
  constructor(private readonly httpService: HttpService) {}

  async getUserProfile(userId: number): Promise<UserProfile> {
    try {
      const response = await this.httpService.axiosRef.get(`${USER_SERVICE_URL}/users/${userId}`, {
        timeout: 5000, // 5 second timeout
        headers: {
          Authorization: `Bearer ${await this.getServiceToken()}`,
          'X-Service-Name': 'order-service',
        },
      })
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException('User not found')
      }
      throw new ServiceUnavailableException('User service unavailable')
    }
  }

  private async getServiceToken(): Promise<string> {
    // Service-to-service authentication
    return this.jwtService.sign(
      {
        service: 'order-service',
        iat: Date.now(),
      },
      {
        secret: process.env.SERVICE_SECRET,
        expiresIn: '1h',
      },
    )
  }
}

// 2. Asynchronous Communication - Event-Driven
interface DomainEvent {
  eventType: string
  aggregateId: string
  eventData: any
  timestamp: Date
  version: number
}

@Injectable()
export class EventBus {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.redis.publish(`events:${event.eventType}`, JSON.stringify(event))

      this.logger.log(`Event published: ${event.eventType}`, {
        aggregateId: event.aggregateId,
        eventType: event.eventType,
      })
    } catch (error) {
      this.logger.error('Failed to publish event', error)
      throw error
    }
  }

  async subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    await this.redis.subscribe(`events:${eventType}`)

    this.redis.on('message', async (channel, message) => {
      if (channel === `events:${eventType}`) {
        try {
          const event: DomainEvent = JSON.parse(message)
          await handler(event)
        } catch (error) {
          this.logger.error(`Error handling event ${eventType}`, error)
        }
      }
    })
  }
}

// Event Handlers
@Injectable()
export class OrderEventHandler {
  constructor(
    private readonly paymentService: PaymentServiceClient,
    private readonly inventoryService: InventoryServiceClient,
    private readonly notificationService: NotificationServiceClient,
  ) {}

  @EventHandler('OrderCreated')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // 1. Reserve inventory
    await this.inventoryService.reserveItems(event.orderItems)

    // 2. Process payment
    const paymentResult = await this.paymentService.initiatePayment({
      orderId: event.orderId,
      amount: event.totalAmount,
      currency: event.currency,
      paymentMethod: event.paymentMethod,
    })

    // 3. Send confirmation email
    await this.notificationService.sendEmail(event.userEmail, 'order-confirmation', {
      orderNumber: event.orderNumber,
      items: event.orderItems,
    })
  }

  @EventHandler('PaymentCompleted')
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    // Update order status
    await this.orderRepository.updateStatus(event.orderId, OrderStatus.PAID)

    // Trigger fulfillment
    await this.eventBus.publish(new OrderReadyForFulfillmentEvent(event.orderId))
  }
}
```

**Circuit Breaker Pattern:**

```typescript
@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitBreakerState>()

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName, options)

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime < circuit.timeout) {
        throw new ServiceUnavailableException(`Circuit breaker is OPEN for ${serviceName}`)
      } else {
        circuit.state = 'HALF_OPEN'
      }
    }

    try {
      const result = await operation()

      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED'
        circuit.failureCount = 0
      }

      return result
    } catch (error) {
      circuit.failureCount++
      circuit.lastFailureTime = Date.now()

      if (circuit.failureCount >= circuit.threshold) {
        circuit.state = 'OPEN'
      }

      throw error
    }
  }

  private getOrCreateCircuit(serviceName: string, options: CircuitBreakerOptions): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        threshold: options.threshold || 5,
        timeout: options.timeout || 60000,
        lastFailureTime: 0,
      })
    }
    return this.circuits.get(serviceName)!
  }
}

interface CircuitBreakerState {
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  failureCount: number
  threshold: number
  timeout: number
  lastFailureTime: number
}
```

### **Câu hỏi 9.2:** Design một event-driven architecture cho real-time notifications và order processing?

**Trả lời:**

**Event Sourcing & CQRS for Orders:**

```typescript
// Order Events
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: number,
    public readonly items: OrderItem[],
    public readonly totalAmount: number,
    public readonly shippingAddress: Address,
  ) {
    super()
  }
}

export class OrderPaymentProcessedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly paymentId: string,
    public readonly status: PaymentStatus,
  ) {
    super()
  }
}

export class OrderShippedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly carrier: string,
    public readonly estimatedDelivery: Date,
  ) {
    super()
  }
}

// Order Aggregate
export class Order {
  private _events: DomainEvent[] = []

  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly items: OrderItem[],
    public status: OrderStatus,
    public readonly shippingAddress: Address,
    public paymentId?: string,
    public trackingNumber?: string,
  ) {}

  static create(userId: number, items: OrderItem[], shippingAddress: Address): Order {
    const order = new Order(uuidv4(), userId, items, OrderStatus.PENDING, shippingAddress)

    order.addEvent(
      new OrderCreatedEvent(order.id, order.userId, order.items, order.calculateTotal(), order.shippingAddress),
    )

    return order
  }

  processPayment(paymentId: string, status: PaymentStatus): void {
    this.paymentId = paymentId

    if (status === PaymentStatus.COMPLETED) {
      this.status = OrderStatus.PAID
    } else if (status === PaymentStatus.FAILED) {
      this.status = OrderStatus.PAYMENT_FAILED
    }

    this.addEvent(new OrderPaymentProcessedEvent(this.id, paymentId, status))
  }

  ship(trackingNumber: string, carrier: string, estimatedDelivery: Date): void {
    if (this.status !== OrderStatus.PAID) {
      throw new Error('Order must be paid before shipping')
    }

    this.status = OrderStatus.SHIPPED
    this.trackingNumber = trackingNumber

    this.addEvent(new OrderShippedEvent(this.id, trackingNumber, carrier, estimatedDelivery))
  }
}

// Order Saga - Orchestrates the order process
@Injectable()
export class OrderProcessingSaga {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly notificationService: NotificationService,
    private readonly shippingService: ShippingService,
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

  @EventHandler('OrderPaymentProcessed')
  async handlePaymentProcessed(event: OrderPaymentProcessedEvent): Promise<void> {
    if (event.status === PaymentStatus.COMPLETED) {
      // Confirm inventory reservation
      await this.inventoryService.confirmReservation(event.orderId)

      // Create shipping label
      const shippingResult = await this.shippingService.createShipment({
        orderId: event.orderId,
      })

      await this.eventBus.publish(
        new OrderShippedEvent(
          event.orderId,
          shippingResult.trackingNumber,
          shippingResult.carrier,
          shippingResult.estimatedDelivery,
        ),
      )

      // Send confirmation
      await this.notificationService.sendOrderConfirmation(event.orderId)
    } else {
      // Release inventory reservation
      await this.inventoryService.releaseReservation(event.orderId)

      // Send payment failure notification
      await this.notificationService.sendPaymentFailureNotification(event.orderId)
    }
  }
}
```

**Real-time Notifications:**

```typescript
// WebSocket Gateway for real-time updates
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private connectedUsers = new Map<number, string[]>() // userId -> socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token
      const payload = await this.jwtService.verifyAsync(token)

      client.data.userId = payload.sub

      // Track user connections
      const userSockets = this.connectedUsers.get(payload.sub) || []
      userSockets.push(client.id)
      this.connectedUsers.set(payload.sub, userSockets)

      // Join user-specific room
      client.join(`user:${payload.sub}`)

      this.logger.log(`User ${payload.sub} connected with socket ${client.id}`)
    } catch (error) {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId
    if (userId) {
      const userSockets = this.connectedUsers.get(userId) || []
      const updatedSockets = userSockets.filter((id) => id !== client.id)

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(userId)
      } else {
        this.connectedUsers.set(userId, updatedSockets)
      }
    }
  }

  // Send notification to specific user
  sendToUser(userId: number, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, data)
  }

  // Send notification to all connected users
  broadcast(event: string, data: any): void {
    this.server.emit(event, data)
  }

  // Check if user is online
  isUserOnline(userId: number): boolean {
    return this.connectedUsers.has(userId)
  }
}

// Notification Service
@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
    private readonly pushService: PushNotificationService,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async sendOrderUpdate(userId: number, orderUpdate: OrderUpdateDto): Promise<void> {
    // Create notification record
    const notification = await this.notificationRepository.create({
      userId,
      type: 'ORDER_UPDATE',
      title: 'Order Status Updated',
      message: `Your order #${orderUpdate.orderNumber} is now ${orderUpdate.status}`,
      data: orderUpdate,
      channels: ['websocket', 'email', 'push'],
    })

    // Send via WebSocket if user is online
    if (this.notificationGateway.isUserOnline(userId)) {
      this.notificationGateway.sendToUser(userId, 'order_update', {
        notificationId: notification.id,
        ...orderUpdate,
      })
    }

    // Send via email
    await this.emailService.sendOrderUpdate(userId, orderUpdate)

    // Send push notification if user has mobile app
    const user = await this.getUserWithDevices(userId)
    if (user.mobileDevices.length > 0) {
      await this.pushService.sendToDevices(
        user.mobileDevices.map((d) => d.fcmToken),
        {
          title: 'Order Update',
          body: notification.message,
          data: { orderId: orderUpdate.orderId },
        },
      )
    }
  }

  // Event-driven notification handling
  @EventHandler('OrderShipped')
  async handleOrderShipped(event: OrderShippedEvent): Promise<void> {
    const order = await this.orderService.getOrder(event.orderId)

    await this.sendOrderUpdate(order.userId, {
      orderId: event.orderId,
      orderNumber: order.orderNumber,
      status: 'SHIPPED',
      trackingNumber: event.trackingNumber,
      carrier: event.carrier,
      estimatedDelivery: event.estimatedDelivery,
    })
  }

  @EventHandler('PaymentCompleted')
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    const payment = await this.paymentService.getPayment(event.paymentId)

    await this.sendOrderUpdate(payment.userId, {
      orderId: payment.orderId,
      status: 'PAYMENT_CONFIRMED',
      amount: payment.amount,
      currency: payment.currency,
    })
  }
}
```

---

## 10. DevOps & Deployment

### **Câu hỏi 10.1:** Setup CI/CD pipeline cho NestJS application với Docker và Kubernetes?

**Trả lời:**

**Docker Multi-stage Build:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy package files and install production dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Set user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
```

**GitHub Actions CI/CD:**

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup test database
        run: |
          cp .env.example .env.test
          echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db" >> .env.test
          pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

      - name: Run linting
        run: pnpm run lint

      - name: Run unit tests
        run: pnpm run test:unit

      - name: Run integration tests
        run: pnpm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Run e2e tests
        run: pnpm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

      - name: Generate coverage report
        run: pnpm run test:cov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level high

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build-and-push:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Set up Kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config

      - name: Deploy to Kubernetes
        run: |
          envsubst < k8s/deployment.yaml | kubectl apply -f -
          kubectl rollout status deployment/nestjs-app -n production
        env:
          IMAGE_TAG: ${{ github.sha }}
```

**Kubernetes Deployment:**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-app
  namespace: production
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
    metadata:
      labels:
        app: nestjs-app
    spec:
      containers:
        - name: nestjs-app
          image: ghcr.io/yourorg/nestjs-app:${IMAGE_TAG}
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: jwt-secret
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
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 15']

---
apiVersion: v1
kind: Service
metadata:
  name: nestjs-service
  namespace: production
spec:
  selector:
    app: nestjs-app
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nestjs-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/force-ssl-redirect: 'true'
    cert-manager.io/cluster-issuer: 'letsencrypt-prod'
spec:
  tls:
    - hosts:
        - api.yourdomain.com
      secretName: api-tls
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nestjs-service
                port:
                  number: 80
```

### **Câu hỏi 10.2:** Implement monitoring, logging và observability cho production environment?

**Trả lời:**

**Application Monitoring:**

```typescript
// Health Check Implementation
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
      version: process.env.npm_package_version,
    }
  }

  @Get('ready')
  async readiness(): Promise<ReadinessStatus> {
    const checks = await Promise.allSettled([this.checkDatabase(), this.checkRedis(), this.checkExternalServices()])

    const isReady = checks.every((check) => check.status === 'fulfilled')

    return {
      status: isReady ? 'ready' : 'not ready',
      checks: {
        database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
        redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
        external: checks[2].status === 'fulfilled' ? 'ok' : 'error',
      },
    }
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping()
  }

  private async checkExternalServices(): Promise<void> {
    // Check external APIs, payment gateways, etc.
    const promises = [this.checkPaymentGateway(), this.checkEmailService(), this.checkS3Service()]

    await Promise.all(promises)
  }
}

// Metrics Collection
@Injectable()
export class MetricsService {
  private readonly metrics = new Map<string, any>()

  constructor() {
    // Initialize Prometheus metrics
    this.initializeMetrics()
  }

  private initializeMetrics() {
    // HTTP request metrics
    this.metrics.set(
      'http_requests_total',
      new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      }),
    )

    this.metrics.set(
      'http_request_duration',
      new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      }),
    )

    // Database metrics
    this.metrics.set(
      'db_query_duration',
      new Histogram({
        name: 'db_query_duration_seconds',
        help: 'Database query duration in seconds',
        labelNames: ['operation', 'table'],
      }),
    )

    // Business metrics
    this.metrics.set(
      'orders_created_total',
      new Counter({
        name: 'orders_created_total',
        help: 'Total number of orders created',
      }),
    )

    this.metrics.set(
      'payments_processed_total',
      new Counter({
        name: 'payments_processed_total',
        help: 'Total number of payments processed',
        labelNames: ['status'],
      }),
    )
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name)
    if (metric) {
      metric.inc(labels)
    }
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name)
    if (metric) {
      metric.observe(labels, value)
    }
  }

  getMetrics(): string {
    return register.metrics()
  }
}

// Metrics Interceptor
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const startTime = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, context, startTime, 'success')
        },
        error: (error) => {
          this.recordMetrics(request, context, startTime, 'error')
        },
      }),
    )
  }

  private recordMetrics(request: any, context: ExecutionContext, startTime: number, status: string): void {
    const duration = (Date.now() - startTime) / 1000
    const method = request.method
    const route = request.route?.path || 'unknown'
    const statusCode = context.switchToHttp().getResponse().statusCode

    this.metricsService.incrementCounter('http_requests_total', {
      method,
      route,
      status_code: statusCode.toString(),
    })

    this.metricsService.observeHistogram('http_request_duration', duration, {
      method,
      route,
    })
  }
}
```

**Structured Logging:**

```typescript
// Custom Logger
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
        new winston.transports.Console({
          format:
            process.env.NODE_ENV === 'development'
              ? winston.format.combine(winston.format.colorize(), winston.format.simple())
              : winston.format.json(),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    })

    if (process.env.NODE_ENV === 'production') {
      // Add external logging service (e.g., CloudWatch, ELK Stack)
      this.winston.add(
        new winston.transports.Http({
          host: process.env.LOG_SERVICE_HOST,
          port: process.env.LOG_SERVICE_PORT,
          path: '/logs',
        }),
      )
    }
  }

  log(message: string, context?: string, meta?: any): void {
    this.winston.info(message, {
      context,
      ...meta,
    })
  }

  error(message: string, trace?: string, context?: string, meta?: any): void {
    this.winston.error(message, {
      context,
      trace,
      ...meta,
    })
  }

  warn(message: string, context?: string, meta?: any): void {
    this.winston.warn(message, {
      context,
      ...meta,
    })
  }

  debug(message: string, context?: string, meta?: any): void {
    this.winston.debug(message, {
      context,
      ...meta,
    })
  }
}

// Request Context Logger
@Injectable()
export class RequestContextLogger {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>()

  run<T>(context: RequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback)
  }

  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore()
  }

  log(level: string, message: string, meta?: any): void {
    const context = this.getContext()
    const logger = new AppLogger()

    const logData = {
      ...meta,
      requestId: context?.requestId,
      userId: context?.userId,
      ip: context?.ip,
      userAgent: context?.userAgent,
    }

    logger[level](message, 'RequestContext', logData)
  }
}

interface RequestContext {
  requestId: string
  userId?: number
  ip: string
  userAgent: string
  startTime: number
}
```

**APM Integration (Application Performance Monitoring):**

```typescript
// main.ts - APM setup
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 1.0,
})

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Add Sentry error handling
  app.use(Sentry.Handlers.requestHandler())
  app.use(Sentry.Handlers.tracingHandler())
  app.use(Sentry.Handlers.errorHandler())

  await app.listen(3000)
}

// Custom Sentry Integration
@Injectable()
export class SentryService {
  captureException(error: Error, context?: any): void {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    })
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
    Sentry.captureMessage(message, level)
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb)
  }

  setUser(user: { id: number; email: string }): void {
    Sentry.setUser(user)
  }

  setTag(key: string, value: string): void {
    Sentry.setTag(key, value)
  }

  withScope(callback: (scope: Sentry.Scope) => void): void {
    Sentry.withScope(callback)
  }
}
```

---

## 🎯 Tổng Kết

Những câu hỏi này cover toàn bộ spectrum của một Senior NestJS Developer với 2+ years experience. Các key points cần nhớ:

### **Technical Excellence:**

- **Architecture**: Module design, DI, CQRS, Event Sourcing
- **Security**: Authentication, Authorization, Data validation
- **Performance**: Caching, Query optimization, File handling
- **Testing**: Unit, Integration, E2E testing strategies

### **System Design:**

- **Microservices**: Service boundaries, Communication patterns
- **Scalability**: Load balancing, Horizontal scaling
- **Reliability**: Circuit breakers, Retry mechanisms
- **Observability**: Monitoring, Logging, Alerting

### **DevOps & Production:**

- **Containerization**: Docker multi-stage builds
- **Orchestration**: Kubernetes deployments
- **CI/CD**: Automated testing and deployment
- **Monitoring**: APM, Metrics, Health checks

### **Best Practices:**

- **Clean Code**: SOLID principles, Design patterns
- **Error Handling**: Global filters, Custom exceptions
- **Documentation**: API docs, Code comments
- **Security**: Input validation, Rate limiting, Audit trails

Chuẩn bị thật kỹ những topics này và bạn sẽ tự tin trong mọi cuộc phỏng vấn NestJS! 🚀
