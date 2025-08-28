# 🔌 Giải Thích WebSocket Patterns Trong Hệ Thống

## 📋 Tổng Quan Vấn Đề

Bạn đã thắc mắc về sự khác biệt trong cách sử dụng `@WebSocketGateway` decorator giữa các file:

1. **`enhanced-chat.gateway.ts`** - Có `@WebSocketGateway({namespace: '/chat'})`
2. **`conversation.service.ts`** - Không có `@WebSocketGateway`
3. **`message.service.ts`** - Không có `@WebSocketGateway`
4. **`payment.service.ts`** - Có `@WebSocketGateway({namespace: 'payment'})`
5. **`payment.gateway.ts`** - Có `@WebSocketGateway({namespace: 'payment'})`

## 🏗️ Kiến Trúc WebSocket Trong NestJS

### 1. **Gateway vs Service Pattern**

#### **Gateway (Khuyến khích)**

```typescript
@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class EnhancedChatGateway {
  @WebSocketServer()
  server: Server

  @SubscribeMessage('send_message')
  handleMessage() {
    // Xử lý WebSocket events
  }
}
```

#### **Service với WebSocket (Không khuyến khích)**

```typescript
@Injectable()
@WebSocketGateway({ namespace: 'payment' })
export class PaymentService {
  @WebSocketServer()
  server: Server

  // Vừa làm business logic vừa làm WebSocket
}
```

### 2. **Tại Sao Có Sự Khác Biệt Này?**

#### **A. Enhanced Chat Gateway (Đúng Pattern)**

```typescript
// enhanced-chat.gateway.ts
@WebSocketGateway({
  namespace: '/chat', // ✅ Chuyên biệt cho WebSocket
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class EnhancedChatGateway {
  constructor(
    private readonly messageHandler: ChatMessageHandler, // ✅ Delegate business logic
    private readonly interactionHandler: ChatInteractionHandler,
  ) {}

  @SubscribeMessage('send_message')
  async handleSendMessage(client: AuthenticatedSocket, data: SendMessageData) {
    return this.messageHandler.handleSendMessage(this.server, client, data)
    //     ^^^^^^^^^^^^^^^^ Business logic ở handler riêng biệt
  }
}
```

**Lý do:**

- ✅ **Separation of Concerns**: Gateway chỉ lo WebSocket, business logic ở service
- ✅ **Testability**: Dễ test riêng Gateway và Service
- ✅ **Maintainability**: Code sạch sẽ, dễ maintain
- ✅ **Scalability**: Có thể có nhiều Gateway cùng dùng 1 Service

#### **B. Conversation & Message Services (Đúng Pattern)**

```typescript
// conversation.service.ts
@Injectable()
export class ConversationService {
  // ✅ KHÔNG có @WebSocketGateway
  // ✅ Chỉ lo business logic thuần túy

  async createDirectConversation(userId: number, recipientId: number) {
    // Pure business logic
    return this.conversationRepo.create(...)
  }
}
```

**Lý do:**

- ✅ **Single Responsibility**: Service chỉ lo business logic
- ✅ **Reusability**: Service có thể dùng cho REST API, GraphQL, WebSocket
- ✅ **Clean Architecture**: Tách biệt transport layer và business layer

#### **C. Payment Service (Anti-Pattern)**

```typescript
// payment.service.ts - ❌ Vi phạm nguyên tắc
@Injectable()
@WebSocketGateway({ namespace: 'payment' })  // ❌ Service không nên là Gateway
export class PaymentService {
  @WebSocketServer()
  server: Server

  async receiver(body: WebhookPaymentBodyType) {
    // Business logic + WebSocket emission
    this.server.to(generateRoomUserId(userId)).emit('payment', {...})
    //  ^^^^^^ Mixing concerns
  }
}
```

**Vấn đề:**

- ❌ **Mixed Responsibilities**: Vừa business logic vừa WebSocket
- ❌ **Hard to Test**: Khó test riêng business logic
- ❌ **Coupling**: WebSocket tightly coupled với business logic

### 3. **Pattern Đúng Cho Payment Module**

#### **Cách hiện tại (Anti-pattern):**

```
payment.service.ts (@WebSocketGateway)
payment.gateway.ts (@WebSocketGateway)
```

→ **Vấn đề:** Duplicate WebSocket setup, confusing

#### **Cách nên làm:**

```typescript
// payment.gateway.ts - WebSocket handling
@WebSocketGateway({ namespace: 'payment' })
export class PaymentGateway {
  constructor(private readonly paymentService: PaymentService) {}

  @SubscribeMessage('payment_status')
  handlePaymentStatus() {
    return this.paymentService.getPaymentStatus(...)
  }
}

// payment.service.ts - Pure business logic
@Injectable()
export class PaymentService {
  // NO @WebSocketGateway

  async receiver(body: WebhookPaymentBodyType) {
    const result = await this.paymentRepo.receiver(body)

    // Emit thông qua Gateway hoặc Event Emitter
    this.eventEmitter.emit('payment.success', { userId, status })

    return result
  }
}
```

## 🎯 Câu Trả Lời Chi Tiết Cho Thắc Mắc

### **Câu hỏi 1: Tại sao enhanced-chat.gateway.ts có @WebSocketGateway mà conversation.service.ts thì không?**

**Trả lời:**

- **`enhanced-chat.gateway.ts`**: Là **Gateway** - chuyên xử lý WebSocket connections, events, real-time communication
- **`conversation.service.ts`**: Là **Service** - chuyên xử lý business logic thuần túy, không quan tâm đến transport layer

### **Câu hỏi 2: Tại sao payment.service.ts lại có @WebSocketGateway?**

**Trả lời:**
Đây là **anti-pattern**, không nên làm vậy. Lý do có thể là:

- Legacy code
- Developer không hiểu rõ về separation of concerns
- Quick fix mà chưa refactor

### **Câu hỏi 3: Khi nào các hàm trong enhanced-chat.gateway.ts được chạy?**

**Trả lời:**

```typescript
// Client kết nối WebSocket
socket.connect('ws://localhost:3000/chat')

// Client emit event
socket.emit('send_message', {
  conversationId: 'abc123',
  content: 'Hello'
})

// Server nhận event và chạy handler
@SubscribeMessage('send_message')  // ← Trigger khi client emit 'send_message'
async handleSendMessage(client, data) {
  // Function này chạy khi client emit 'send_message' event
}
```

**Khác với REST API:**

- REST API: Trigger khi HTTP request đến endpoint
- WebSocket: Trigger khi client emit specific event

### **Câu hỏi 4: payment.service.receiver() có chạy handleEvent() không?**

**Trả lời:**
**KHÔNG**. Đây là 2 hoàn toàn khác nhau:

```typescript
// payment.service.ts
async receiver(body: WebhookPaymentBodyType) {
  // ← Chạy khi webhook từ payment provider gọi vào
  this.server.emit('payment', {...})  // Emit event TO clients
}

// payment.gateway.ts
@SubscribeMessage('send-money')
handleEvent(data: string) {
  // ← Chỉ chạy khi CLIENT emit 'send-money' event
}
```

**Flow thực tế:**

```
Webhook → receiver() → emit('payment') → Clients nhận notification
Client emit → handleEvent() → process client request
```

## 🛠️ Best Practices & Recommendations

### **1. Cấu Trúc Đề Xuất**

```
src/
├── websockets/
│   ├── chat.gateway.ts         # WebSocket handlers
│   ├── payment.gateway.ts      # WebSocket handlers
│   └── handlers/              # WebSocket-specific logic
├── routes/
│   ├── conversation/
│   │   ├── conversation.service.ts  # Business logic
│   │   └── conversation.controller.ts
│   └── payment/
│       ├── payment.service.ts      # Business logic
│       └── payment.controller.ts
```

### **2. Event-Driven Architecture**

```typescript
// Service emits events
@Injectable()
export class PaymentService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async receiver(body: WebhookPaymentBodyType) {
    const result = await this.processPayment(body)

    // Emit event instead of direct WebSocket
    this.eventEmitter.emit('payment.completed', {
      userId: result.userId,
      status: 'success',
    })

    return result
  }
}

// Gateway listens to events
@WebSocketGateway()
export class PaymentGateway {
  @OnEvent('payment.completed')
  handlePaymentCompleted(payload: any) {
    this.server.to(`user-${payload.userId}`).emit('payment', payload)
  }
}
```

### **3. Clean Code Principles**

```typescript
// ✅ GOOD: Single Responsibility
@Injectable()
export class ConversationService {
  // Only business logic
}

@WebSocketGateway()
export class ChatGateway {
  // Only WebSocket handling
}

// ❌ BAD: Mixed Responsibilities
@Injectable()
@WebSocketGateway()
export class ConversationService {
  // Business logic + WebSocket = Violation
}
```

## 🔄 Migration Plan Cho Payment Module

### **Current State (Bad):**

```typescript
@Injectable()
@WebSocketGateway({ namespace: 'payment' })
export class PaymentService {
  @WebSocketServer() server: Server
  // Mixed concerns
}
```

### **Target State (Good):**

```typescript
// payment.service.ts
@Injectable()
export class PaymentService {
  // Pure business logic
  async processPayment() { ... }
}

// payment.gateway.ts
@WebSocketGateway({ namespace: 'payment' })
export class PaymentGateway {
  constructor(private paymentService: PaymentService) {}

  @SubscribeMessage('payment_status')
  handlePaymentStatus() {
    return this.paymentService.getStatus(...)
  }
}
```

## 📊 Summary Table

| File                       | Pattern | WebSocket?   | Responsibility       | Status              |
| -------------------------- | ------- | ------------ | -------------------- | ------------------- |
| `enhanced-chat.gateway.ts` | Gateway | ✅ Correct   | WebSocket handling   | ✅ Good             |
| `conversation.service.ts`  | Service | ❌ Correct   | Business logic       | ✅ Good             |
| `message.service.ts`       | Service | ❌ Correct   | Business logic       | ✅ Good             |
| `payment.gateway.ts`       | Gateway | ✅ Correct   | WebSocket handling   | ✅ Good             |
| `payment.service.ts`       | Service | ❌ **Wrong** | Business + WebSocket | ❌ **Anti-pattern** |

## 🎯 Kết Luận

1. **Enhanced Chat System**: Đã áp dụng đúng pattern, tách biệt Gateway và Service
2. **Payment System**: Đang có anti-pattern, cần refactor
3. **Conversation/Message Services**: Đúng pattern, chỉ lo business logic
4. **WebSocket Trigger**: Chỉ khi client emit events, không phải từ REST API calls
5. **Best Practice**: Gateway cho WebSocket, Service cho business logic, Event-driven cho communication

---

**Recommendation**: Refactor Payment Service để remove `@WebSocketGateway` và apply Event-driven pattern như Enhanced Chat System đã làm.
