# NestJS trong Microservices

## Tại sao NestJS cho Fintech/Loyalty?

- **Modular Architecture:** Mỗi domain (Payment, Loyalty, User) = 1 module riêng → dễ tách thành microservice
- **Built-in Microservices support:** TCP, Redis, RabbitMQ, Kafka, gRPC, NATS
- **Enterprise patterns:** DI, Guards, Interceptors, Pipes, Filters → clean code, testable
- **TypeScript:** Type safety quan trọng khi xử lý tiền/điểm

## NestJS Microservices Transports

### Cấu hình Hybrid App (HTTP + MQ trong cùng process)
```typescript
// main.ts
const app = await NestFactory.create(AppModule);

// Thêm RabbitMQ microservice vào cùng app
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'loyalty_queue',
    queueOptions: { durable: true },
  },
});

await app.startAllMicroservices();
await app.listen(3000);
```

### So sánh Transports

| Transport | Khi nào dùng | Pattern |
|-----------|-------------|---------|
| **TCP** | Internal services, low latency | Request-Response |
| **Redis** | Pub/Sub, simple messaging | Event-based |
| **RabbitMQ** | Task queue, routing, DLQ support | Both (recommend Event) |
| **Kafka** | Event streaming, high throughput, replay | Event-based |
| **gRPC** | High-perf, strong typing (protobuf), multi-language | Request-Response |

### Message Patterns

#### @EventPattern (Fire-and-forget)
```typescript
// Loyalty Service - Consumer
@EventPattern('payment.completed')
async handlePaymentCompleted(@Payload() data: PaymentEvent, @Ctx() context: RmqContext) {
  const channel = context.getChannelRef();
  const message = context.getMessage();

  try {
    await this.loyaltyService.addPoints(data.userId, data.amount);
    channel.ack(message); // Xác nhận đã xử lý xong
  } catch (error) {
    channel.nack(message, false, false); // Reject → DLQ
  }
}
```

#### @MessagePattern (Request-Response)
```typescript
// User Service
@MessagePattern({ cmd: 'get_user' })
async getUser(@Payload() data: { userId: string }) {
  return this.userService.findById(data.userId);
}

// Caller
const user = await this.userClient.send({ cmd: 'get_user' }, { userId: '123' }).toPromise();
```

### ClientProxy - Gọi sang service khác
```typescript
@Module({
  imports: [
    ClientsModule.register([{
      name: 'LOYALTY_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'loyalty_queue',
      },
    }]),
  ],
})
export class PaymentModule {}

// Trong service
@Injectable()
export class PaymentService {
  constructor(@Inject('LOYALTY_SERVICE') private loyaltyClient: ClientProxy) {}

  async processPayment(data: PaymentDto) {
    // Fire-and-forget event
    this.loyaltyClient.emit('payment.completed', {
      userId: data.userId,
      amount: data.amount,
      transactionId: data.id,
    });
  }
}
```

## Guards, Interceptors, Pipes - Request Lifecycle

```
Request → Middleware → Guard → Interceptor (before) → Pipe → Handler → Interceptor (after) → Filter (if error) → Response
```

### Guard: Kiểm tra quyền truy cập
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.some(role => user.roles.includes(role));
  }
}

// Sử dụng
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('adjust-points')
adjustPoints() { ... }
```

### Interceptor: Transform response, logging, caching
```typescript
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
      tap(() => console.log(`Request took ${Date.now() - start}ms`)),
    );
  }
}
```

### Pipe: Validate & transform input
```typescript
@Injectable()
export class PointsValidationPipe implements PipeTransform {
  transform(value: any) {
    const points = parseInt(value, 10);
    if (isNaN(points) || points < 0) throw new BadRequestException('Invalid points');
    return points;
  }
}

// Hoặc dùng class-validator (recommend)
export class AddPointsDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  points: number;
}
```

## Module Structure cho Loyalty Microservice

```
src/
├── loyalty/
│   ├── loyalty.module.ts
│   ├── loyalty.controller.ts      # HTTP endpoints
│   ├── loyalty.consumer.ts        # @EventPattern handlers
│   ├── loyalty.service.ts         # Business logic
│   ├── dto/
│   │   ├── add-points.dto.ts
│   │   └── redeem-voucher.dto.ts
│   ├── entities/
│   │   ├── point-transaction.entity.ts
│   │   └── user-tier.entity.ts
│   └── guards/
│       └── loyalty-rate-limit.guard.ts
├── payment/
│   ├── payment.module.ts
│   ├── webhooks/
│   │   └── payment-webhook.controller.ts
│   └── payment.service.ts
└── shared/
    ├── interceptors/
    │   └── idempotency.interceptor.ts
    ├── filters/
    │   └── rpc-exception.filter.ts
    └── guards/
        └── hmac-verify.guard.ts
```

## Câu hỏi phỏng vấn

1. **Guard vs Middleware?** → Middleware: chạy trước mọi thứ, không biết handler nào sẽ chạy. Guard: biết ExecutionContext, quyết định allow/deny
2. **Interceptor vs Middleware?** → Interceptor: chạy cả before/after handler, có thể transform response. Middleware: chỉ before
3. **emit vs send?** → `emit`: fire-and-forget (EventPattern). `send`: request-response (MessagePattern), trả về Observable
4. **Hybrid app là gì?** → App vừa serve HTTP vừa listen MQ trong cùng process (connectMicroservice)
5. **Pipe có mấy loại?** → Validation Pipe (validate input) và Transformation Pipe (transform data type)
