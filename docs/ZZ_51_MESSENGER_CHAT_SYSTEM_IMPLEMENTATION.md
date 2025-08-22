# 🔥 Hệ Thống Chat Real-time Như Facebook Messenger

## 📋 Tổng quan dự án

Đây là documentation chi tiết về việc implement hệ thống chat real-time giống Facebook Messenger cho dự án NestJS Ecommerce API. Hệ thống hỗ trợ:

- **Chat 1-1** (Direct Messages)
- **Group Chat** (Nhiều người tham gia)
- **Real-time messaging** với Socket.io
- **Message reactions** (emoji reactions)
- **Read receipts** (đã đọc tin nhắn)
- **Typing indicators** (đang gõ)
- **File attachments** (đính kèm file)
- **Message editing/deleting**
- **Online/offline status**

---

## 🏗️ Kiến trúc hệ thống

### 1. Database Schema (Prisma)

#### **Conversation Model**

```prisma
model Conversation {
  id                String                @id @default(cuid())
  type              ConversationType      @default(DIRECT) // DIRECT or GROUP
  name              String?               @db.VarChar(500) // Group name
  description       String?               // Group description
  avatar            String?               @db.VarChar(1000) // Group avatar
  ownerId           Int?                  // Group owner
  lastMessage       String?               // Preview của tin nhắn cuối
  lastMessageAt     DateTime?             // Thời gian tin nhắn cuối
  isArchived        Boolean               @default(false)
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  // Relations
  owner             User?                 @relation("ConversationOwner", fields: [ownerId], references: [id])
  members           ConversationMember[]
  messages          Message[]
}
```

#### **ConversationMember Model**

```prisma
model ConversationMember {
  id             String                @id @default(cuid())
  conversationId String
  userId         Int
  role           ConversationRole      @default(MEMBER) // ADMIN, MODERATOR, MEMBER
  joinedAt       DateTime              @default(now())
  lastReadAt     DateTime?             // Lần cuối đọc tin nhắn
  unreadCount    Int                   @default(0)      // Số tin nhắn chưa đọc
  isActive       Boolean               @default(true)   // Còn trong nhóm không
  isMuted        Boolean               @default(false)  // Tắt thông báo
  mutedUntil     DateTime?
}
```

#### **Enhanced Message Model**

```prisma
model Message {
  id             String              @id @default(cuid())
  conversationId String
  fromUserId     Int
  content        String?             // Nội dung text (null cho attachment-only)
  type           MessageType         @default(TEXT) // TEXT, IMAGE, FILE, SYSTEM, etc.
  replyToId      String?             // Reply to message
  isEdited       Boolean             @default(false)
  editedAt       DateTime?
  isDeleted      Boolean             @default(false)
  deletedAt      DateTime?
  deletedForEveryone Boolean          @default(false)
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  // Relations
  conversation   Conversation        @relation(fields: [conversationId], references: [id])
  fromUser       User                @relation("SentMessages", fields: [fromUserId], references: [id])
  replyTo        Message?            @relation("MessageReplies", fields: [replyToId], references: [id])
  replies        Message[]           @relation("MessageReplies")
  attachments    MessageAttachment[]
  reactions      MessageReaction[]
  readReceipts   MessageReadReceipt[]
}
```

#### **Supporting Models**

- **MessageAttachment**: File đính kèm (images, videos, documents)
- **MessageReaction**: Emoji reactions (👍, ❤️, 😂, etc.)
- **MessageReadReceipt**: Tracking ai đã đọc tin nhắn nào
- **TypingIndicator**: Theo dõi ai đang gõ

### 2. Module Structure

```
src/routes/conversation/
├── conversation.module.ts          # Main module
├── conversation.controller.ts      # REST API endpoints
├── conversation.service.ts         # Business logic for conversations
├── conversation.repo.ts           # Database operations for conversations
├── conversation.dto.ts            # Request/Response DTOs
├── message.service.ts             # Business logic for messages
├── message.repo.ts               # Database operations for messages
└── enhanced-chat.gateway.ts      # WebSocket handlers
```

---

## 🚀 Core Features Implementation

### 1. Conversation Management

#### **Tạo Direct Conversation (1-1 Chat)**

```typescript
@Post('direct')
async createDirectConversation(
  @ActiveUser('userId') userId: number,
  @Body() body: CreateDirectConversationBodyDTO,
) {
  return this.conversationService.createDirectConversation(userId, body.recipientId)
}
```

**Logic:**

- Kiểm tra user và recipient có tồn tại không
- Tìm xem conversation đã tồn tại chưa
- Nếu chưa có, tạo mới với type='DIRECT'

#### **Tạo Group Conversation**

```typescript
@Post('group')
async createGroupConversation(
  @ActiveUser('userId') userId: number,
  @Body() body: CreateGroupConversationBodyDTO,
) {
  return this.conversationService.createGroupConversation(userId, body)
}
```

**Logic:**

- Validate tất cả members tồn tại
- Tạo conversation với type='GROUP'
- Người tạo tự động thành ADMIN
- Tối thiểu 2 thành viên

### 2. Real-time Messaging với Socket.io

#### **WebSocket Events**

**Connection & Authentication:**

```typescript
async handleConnection(client: Socket) {
  // Verify JWT token
  const token = client.handshake.auth.authorization?.split(' ')[1]
  const payload = await this.tokenService.verifyAccessToken(token)

  // Attach user info to socket
  client.userId = payload.userId
  client.user = payload

  // Track online status
  this.onlineUsers.set(payload.userId, client.id)

  // Join personal room
  await client.join(`user:${payload.userId}`)
}
```

**Send Message:**

```typescript
@SubscribeMessage('send_message')
async handleSendMessage(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: SendMessageData,
) {
  // Validate membership
  const isMember = await this.conversationRepo.isUserMember(data.conversationId, client.userId)

  // Create message
  const message = await this.messageService.sendMessage(client.userId, data)

  // Emit to conversation members
  this.server.to(`conversation:${data.conversationId}`).emit('new_message', { message })

  // Send offline notifications
  await this.sendOfflineNotifications(data.conversationId, message, client.userId)
}
```

**Typing Indicators:**

```typescript
@SubscribeMessage('typing_start')
async handleTypingStart(client: AuthenticatedSocket, data: TypingData) {
  // Add to typing list
  this.typingUsers.get(data.conversationId)?.add(client.userId)

  // Notify others
  client.to(`conversation:${data.conversationId}`).emit('user_typing', {
    userId: client.userId,
    user: client.user,
  })

  // Auto-remove after 10s
  setTimeout(() => this.removeUserFromTyping(data.conversationId, client.userId), 10000)
}
```

### 3. Message Features

#### **Message Reactions**

```typescript
@SubscribeMessage('react_to_message')
async handleReactToMessage(client: AuthenticatedSocket, data: ReactToMessageData) {
  const reaction = await this.messageService.reactToMessage(data.messageId, client.userId, data.emoji)

  // Emit to conversation
  this.server.to(`conversation:${message.conversationId}`).emit('message_reaction_added', {
    messageId: data.messageId,
    reaction,
  })
}
```

#### **Read Receipts**

```typescript
@SubscribeMessage('mark_as_read')
async handleMarkAsRead(client: AuthenticatedSocket, data: MarkAsReadData) {
  await this.messageService.markAsRead(data.conversationId, client.userId, data.messageId)

  // Notify conversation members
  client.to(`conversation:${data.conversationId}`).emit('message_read', {
    userId: client.userId,
    conversationId: data.conversationId,
    readAt: new Date(),
  })
}
```

### 4. Advanced Features

#### **Message Editing**

- Chỉ author mới có thể edit
- Không edit được tin nhắn > 24h
- Không edit được system messages
- Mark `isEdited = true` và `editedAt`

#### **Message Deletion**

- **Delete for self**: Chỉ ẩn với người xóa
- **Delete for everyone**: Admin hoặc author có thể xóa cho tất cả

#### **File Attachments**

- Support IMAGE, VIDEO, AUDIO, DOCUMENT
- Store file metadata: fileName, fileSize, mimeType
- Generate thumbnails cho images/videos

---

## 📡 REST API Endpoints

### Conversation Management

```
GET    /conversations              # Danh sách conversations
GET    /conversations/:id          # Chi tiết conversation
POST   /conversations/direct       # Tạo direct conversation
POST   /conversations/group        # Tạo group conversation
PUT    /conversations/:id          # Update conversation info
DELETE /conversations/:id          # Leave conversation

POST   /conversations/:id/members  # Add members (group only)
DELETE /conversations/:id/members/:memberId # Remove member
```

### Message Management

```
GET    /conversations/:id/messages # Lấy messages (pagination)
POST   /conversations/messages     # Send message
PUT    /conversations/messages/:id # Edit message
DELETE /conversations/messages/:id # Delete message

POST   /conversations/messages/read        # Mark as read
POST   /conversations/messages/:id/react   # React to message
DELETE /conversations/messages/:id/react   # Remove reaction
```

---

## 🔐 Security & Authorization

### 1. WebSocket Authentication

```typescript
// JWT token trong handshake
const token = socket.handshake.auth.authorization?.split(' ')[1]
const payload = await this.tokenService.verifyAccessToken(token)
```

### 2. Conversation Access Control

- **Direct conversations**: Chỉ 2 thành viên
- **Group conversations**: Check membership trước mọi action
- **Admin permissions**: Chỉ admin mới có thể:
  - Update conversation info
  - Add/remove members
  - Delete messages of others

### 3. Message Permissions

- **Send**: Phải là member của conversation
- **Edit**: Chỉ author, trong vòng 24h
- **Delete for everyone**: Admin hoặc author
- **React**: Phải là member

---

## ⚡ Performance Optimizations

### 1. Database Indexing

```prisma
@@index([conversationId, createdAt])  // Messages pagination
@@index([userId, isActive])           // Active members
@@index([lastMessageAt])              // Conversation sorting
```

### 2. Caching Strategy

- **Redis**: Cache online users, typing indicators
- **Socket.io Redis Adapter**: Scale across multiple instances
- **Conversation metadata**: Cache thông tin conversation thường dùng

### 3. Pagination & Limits

- **Messages**: Cursor-based pagination với `before`/`after`
- **Conversations**: Offset-based pagination
- **File uploads**: Size limits và compression

---

## 🔄 Real-time Events Flow

### Gửi tin nhắn (Send Message)

```
Client A                    Server                     Client B
   |                          |                          |
   |--- send_message -------->|                          |
   |                          |-- Save to DB             |
   |                          |-- Update conversation    |
   |<--- message_sent --------|                          |
   |                          |--- new_message --------->|
   |                          |-- Send offline push ---->| (if offline)
```

### Typing Indicators

```
Client A                    Server                     Client B
   |                          |                          |
   |--- typing_start -------->|                          |
   |                          |--- user_typing --------->|
   |                          |                          |
   | (after 10s or send)      |                          |
   |--- typing_stop --------->|                          |
   |                          |--- user_stopped_typing ->|
```

### Read Receipts

```
Client B                    Server                     Client A
   |                          |                          |
   |--- mark_as_read -------->|                          |
   |                          |-- Update read receipts   |
   |                          |--- message_read -------->|
   |                          |-- Update unread count    |
```

---

## 🚀 Installation & Setup

### 1. Update Prisma Schema

```bash
# Add new models to prisma/schema.prisma
npx prisma db push
npx prisma generate
```

### 2. Install Dependencies

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @socket.io/redis-adapter redis
```

### 3. Update App Module

```typescript
// src/app.module.ts
imports: [
  // ... existing modules
  ConversationModule,
]
```

### 4. Update WebSocket Adapter

```typescript
// src/main.ts
app.useWebSocketAdapter(new WebsocketAdapter(app))
```

### 5. Environment Variables

```env
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:3000
```

---

## 🧪 Testing Strategy

### 1. Unit Tests

- Service methods
- Repository methods
- DTO validation

### 2. Integration Tests

- REST API endpoints
- WebSocket events
- Database operations

### 3. E2E Tests

- Complete chat flows
- Multi-user scenarios
- Error handling

---

## 📱 Client Integration Examples

### React/Vue.js Integration

```javascript
import io from 'socket.io-client'

const socket = io('/chat', {
  auth: {
    authorization: `Bearer ${accessToken}`,
  },
})

// Join conversation
socket.emit('join_conversation', { conversationId: 'conv_123' })

// Send message
socket.emit('send_message', {
  conversationId: 'conv_123',
  content: 'Hello world!',
  tempId: 'temp_' + Date.now(), // For deduplication
})

// Listen for new messages
socket.on('new_message', (data) => {
  console.log('New message:', data.message)
  // Update UI
})

// Typing indicators
socket.on('user_typing', (data) => {
  console.log(`${data.user.name} is typing...`)
})
```

### Mobile App Integration

```javascript
// React Native with socket.io-client
import io from 'socket.io-client'

const ChatService = {
  socket: null,

  connect(token) {
    this.socket = io('ws://localhost:3000/chat', {
      auth: { authorization: `Bearer ${token}` },
    })

    this.socket.on('connect', () => {
      console.log('Connected to chat')
    })
  },

  sendMessage(conversationId, content) {
    this.socket.emit('send_message', {
      conversationId,
      content,
      tempId: Date.now().toString(),
    })
  },
}
```

---

## 🔮 Future Enhancements

### Phase 1: Core Chat ✅

- [x] Direct messaging
- [x] Group chat
- [x] Real-time delivery
- [x] Read receipts
- [x] Typing indicators
- [x] Message reactions

### Phase 2: Advanced Features

- [ ] Voice messages
- [ ] Video calls (WebRTC)
- [ ] Message threading
- [ ] @mentions với notifications
- [ ] Message search với Elasticsearch
- [ ] Chat themes/customization

### Phase 3: Business Features

- [ ] Chat với customer support
- [ ] Bot integration (chatbots)
- [ ] Message translation
- [ ] Chat analytics
- [ ] Moderation tools

### Phase 4: Scale & Performance

- [ ] Message archiving
- [ ] Database sharding
- [ ] CDN cho file attachments
- [ ] Advanced caching strategies

---

## 🎯 Best Practices Được Áp Dụng

### 1. **Clean Architecture**

- Domain models tách biệt
- Service layer xử lý business logic
- Repository pattern cho data access
- DTO validation với Zod

### 2. **Real-time Optimization**

- Room-based broadcasting
- Efficient event handling
- Connection pooling
- Graceful disconnection handling

### 3. **Security**

- JWT authentication
- Permission-based access control
- Input validation
- SQL injection prevention

### 4. **Scalability**

- Redis adapter cho multi-instance
- Database indexing
- Pagination cho large datasets
- File size limits

### 5. **User Experience**

- Optimistic UI updates
- Offline notification support
- Error handling với retry logic
- Smooth typing indicators

---

## 🔧 Troubleshooting

### Common Issues

**1. Socket disconnection:**

```javascript
// Client-side reconnection
socket.on('disconnect', () => {
  console.log('Disconnected, attempting to reconnect...')
  setTimeout(() => socket.connect(), 1000)
})
```

**2. Memory leaks với typing indicators:**

```typescript
// Clear timeouts on disconnect
handleDisconnect(client) {
  this.removeUserFromAllTyping(client.userId)
  clearTimeout(this.typingTimeouts[client.id])
}
```

**3. Database performance:**

```sql
-- Add missing indexes
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_members_user_active ON conversation_members(user_id, is_active);
```

---

## 📊 Monitoring & Analytics

### Metrics to Track

- **Active connections**: Số user online
- **Message throughput**: Tin nhắn/giây
- **Response time**: API và WebSocket latency
- **Error rates**: Failed deliveries, connection drops
- **Database performance**: Query times, connection pool

### Logging Strategy

```typescript
// Structured logging
this.logger.log('Message sent', {
  userId: client.userId,
  conversationId: data.conversationId,
  messageType: data.type,
  timestamp: new Date().toISOString(),
})
```

---

## 🎉 Kết luận

Hệ thống chat real-time này được thiết kế theo các best practices hiện đại, có thể scale và maintain dễ dàng. Key features:

✅ **Giống Facebook Messenger**: Đầy đủ tính năng chat modern
✅ **Real-time**: Socket.io với Redis scaling
✅ **Secure**: JWT auth + permission control  
✅ **Performant**: Optimized queries + caching
✅ **Maintainable**: Clean architecture + TypeScript
✅ **Extensible**: Dễ dàng thêm features mới

Với kiến trúc này, bạn có thể dễ dàng mở rộng thêm các tính năng như video call, bot integration, hay chat với customer support trong tương lai.

**Happy coding! 🚀**
