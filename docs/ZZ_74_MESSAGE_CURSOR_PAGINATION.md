# Cursor-Based Pagination trong Message Module

## 📋 Tổng Quan

Document này giải thích chi tiết về **cursor-based pagination** implementation trong Message Module của hệ thống chat.

## 🎯 Tại Sao Cursor-Based Pagination?

### Vấn Đề Với Offset-Based Pagination

**Offset-based pagination** (sử dụng `skip` và `take`) có những hạn chế nghiêm trọng:

1. **Performance Issues**:
   - Database phải scan qua tất cả records từ đầu đến offset position
   - Với offset lớn (ví dụ: page 1000), query sẽ rất chậm
   - Không tận dụng được index hiệu quả

2. **Data Inconsistency**:
   - Khi có tin nhắn mới được thêm vào trong khi user đang phân trang
   - User có thể thấy duplicate messages hoặc miss messages
   - Ví dụ: User đang ở page 2, có 10 tin nhắn mới → page 2 bây giờ chứa data của page 1 cũ

3. **Real-time Chat Issues**:
   - Trong chat app, tin nhắn liên tục được thêm vào
   - Offset-based pagination không phù hợp với real-time data stream

### Ưu Điểm Của Cursor-Based Pagination

1. **Consistent Performance**:
   - Sử dụng index trên `createdAt` và `id`
   - Query time không phụ thuộc vào vị trí trong dataset
   - Luôn nhanh, dù fetch trang đầu hay trang cuối

2. **Data Consistency**:
   - Cursor trỏ đến một message cụ thể
   - Không bị ảnh hưởng bởi insertions/deletions
   - User luôn thấy data nhất quán

3. **Perfect For Real-time**:
   - Dễ dàng fetch messages mới hơn (forward) hoặc cũ hơn (backward)
   - Hỗ trợ infinite scroll tự nhiên
   - Phù hợp với WebSocket real-time updates

## 🏗️ Kiến Trúc Implementation

### 1. Repository Layer (`message.repo.ts`)

#### Method: `findConversationMessages()`

**Signature:**
```typescript
async findConversationMessages(
  conversationId: string,
  options: {
    limit: number              // Số lượng messages per page
    cursor?: string            // Message ID để paginate từ đó
    direction?: 'forward' | 'backward'  // Hướng pagination
    type?: string              // Filter by message type
  }
)
```

**Cách Hoạt Động:**

1. **Không có cursor** (first page):
   ```typescript
   // Fetch 50 messages mới nhất
   { limit: 50 }
   
   // Query: SELECT * FROM messages 
   //        WHERE conversationId = '...' 
   //        ORDER BY createdAt DESC 
   //        LIMIT 51  -- Fetch +1 để check hasMore
   ```

2. **Có cursor - Backward** (load older messages):
   ```typescript
   { limit: 50, cursor: 'msg_123', direction: 'backward' }
   
   // Query: SELECT * FROM messages 
   //        WHERE conversationId = '...' 
   //        AND createdAt < (SELECT createdAt FROM messages WHERE id = 'msg_123')
   //        ORDER BY createdAt DESC 
   //        LIMIT 51
   ```

3. **Có cursor - Forward** (load newer messages):
   ```typescript
   { limit: 50, cursor: 'msg_123', direction: 'forward' }
   
   // Query: SELECT * FROM messages 
   //        WHERE conversationId = '...' 
   //        AND createdAt > (SELECT createdAt FROM messages WHERE id = 'msg_123')
   //        ORDER BY createdAt DESC 
   //        LIMIT 51
   ```

**Response Structure:**
```typescript
{
  data: Message[],           // Array of messages (oldest first)
  pagination: {
    limit: 50,
    cursor: 'msg_123',       // Current cursor
    direction: 'backward',
    hasMore: true,           // Còn messages cũ hơn không?
    nextCursor: 'msg_100',   // Cursor để fetch older messages
    prevCursor: 'msg_150'    // Cursor để fetch newer messages
  }
}
```

#### Method: `searchMessages()`

**Signature:**
```typescript
async searchMessages(
  conversationIds: string[],
  query: string,
  options: {
    limit: number
    cursor?: string
    type?: string
    fromUserId?: number
    dateFrom?: Date
    dateTo?: Date
  }
)
```

**Cách Hoạt Động:**

Search luôn paginate **backward** (từ mới nhất về cũ nhất):

```typescript
// First page
{ limit: 20, query: 'hello' }

// Next page
{ limit: 20, cursor: 'msg_50', query: 'hello' }

// Query: SELECT * FROM messages 
//        WHERE conversationId IN (...) 
//        AND content ILIKE '%hello%'
//        AND createdAt < (SELECT createdAt FROM messages WHERE id = 'msg_50')
//        ORDER BY createdAt DESC 
//        LIMIT 21
```

**Response Structure:**
```typescript
{
  data: Message[],
  pagination: {
    limit: 20,
    cursor: 'msg_50',
    hasMore: true,
    nextCursor: 'msg_30'
  },
  facets: {
    byType: { TEXT: 100, IMAGE: 50 },
    byUser: { 123: 80, 456: 70 },
    byConversation: { 'conv_1': 120, 'conv_2': 30 }
  }
}
```

### 2. Service Layer (`message.service.ts`)

Service layer pass-through options từ controller đến repository, và enrich messages với computed fields:

```typescript
async getConversationMessages(conversationId, userId, options) {
  // 1. Verify permissions
  const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
  
  // 2. Fetch messages
  const result = await this.messageRepo.findConversationMessages(conversationId, options)
  
  // 3. Enrich with computed fields
  const enrichedMessages = result.data.map(message => ({
    ...message,
    isReadByCurrentUser: message.readReceipts.some(r => r.userId === userId),
    readByCount: message.readReceipts.length
  }))
  
  return { ...result, data: enrichedMessages }
}
```

### 3. Controller Layer (`conversation.controller.ts`)

Controller nhận query parameters và pass vào service:

```typescript
@Get(':conversationId/messages')
async getMessages(
  @ActiveUser('userId') userId: number,
  @Param() params: ConversationParamsDTO,
  @Query() query: GetMessagesQueryDTO
) {
  return this.messageService.getConversationMessages(
    params.conversationId,
    userId,
    query  // { limit, cursor, direction, type }
  )
}
```

### 4. DTOs (`conversation.dto.ts`)

**Request DTO:**
```typescript
export const GetMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
  direction: z.enum(['forward', 'backward']).default('backward'),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', ...]).optional()
})
```

**Response DTO:**
```typescript
export const MessagesListSchema = z.object({
  data: z.array(ConversationMessageSchema),
  pagination: z.object({
    limit: z.number(),
    cursor: z.string().nullable().optional(),
    direction: z.enum(['forward', 'backward']).optional(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable()
  })
})
```

## 📖 API Usage Examples

### Example 1: Load Initial Messages (First Page)

**Request:**
```http
GET /conversations/conv_123/messages?limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "msg_100",
      "content": "Oldest message in this page",
      "createdAt": "2025-01-01T10:00:00Z",
      ...
    },
    ...
    {
      "id": "msg_150",
      "content": "Newest message in this page",
      "createdAt": "2025-01-01T12:00:00Z",
      ...
    }
  ],
  "pagination": {
    "limit": 50,
    "cursor": null,
    "direction": "backward",
    "hasMore": true,
    "nextCursor": "msg_100",  // Use this to load older messages
    "prevCursor": "msg_150"   // Use this to load newer messages
  }
}
```

### Example 2: Load Older Messages (Scroll Up)

**Request:**
```http
GET /conversations/conv_123/messages?limit=50&cursor=msg_100&direction=backward
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "msg_50",
      "content": "Older message",
      "createdAt": "2025-01-01T08:00:00Z",
      ...
    },
    ...
    {
      "id": "msg_99",
      "content": "Message right before cursor",
      "createdAt": "2025-01-01T09:59:00Z",
      ...
    }
  ],
  "pagination": {
    "limit": 50,
    "cursor": "msg_100",
    "direction": "backward",
    "hasMore": true,
    "nextCursor": "msg_50",
    "prevCursor": "msg_99"
  }
}
```

### Example 3: Load Newer Messages (New Messages Arrived)

**Request:**
```http
GET /conversations/conv_123/messages?limit=50&cursor=msg_150&direction=forward
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "msg_151",
      "content": "New message 1",
      "createdAt": "2025-01-01T12:01:00Z",
      ...
    },
    {
      "id": "msg_152",
      "content": "New message 2",
      "createdAt": "2025-01-01T12:02:00Z",
      ...
    }
  ],
  "pagination": {
    "limit": 50,
    "cursor": "msg_150",
    "direction": "forward",
    "hasMore": false,  // No more newer messages
    "nextCursor": null,
    "prevCursor": "msg_152"
  }
}
```

### Example 4: Search Messages

**Request:**
```http
GET /conversations/messages/search?q=hello&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "cursor": null,
    "hasMore": true,
    "nextCursor": "msg_80"
  },
  "facets": {
    "byType": { "TEXT": 100, "IMAGE": 20 },
    "byUser": { "123": 80, "456": 40 },
    "byConversation": { "conv_1": 100, "conv_2": 20 }
  }
}
```

**Next Page:**
```http
GET /conversations/messages/search?q=hello&limit=20&cursor=msg_80
```

## 🔧 Implementation Details

### Prisma Query Construction

**Backward Pagination:**
```typescript
const messages = await prisma.conversationMessage.findMany({
  where: {
    conversationId,
    isDeleted: false,
    createdAt: cursor ? { lt: cursorMessage.createdAt } : undefined
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1  // Fetch +1 to check hasMore
})

const hasMore = messages.length > limit
const resultMessages = hasMore ? messages.slice(0, limit) : messages
```

**Forward Pagination:**
```typescript
const messages = await prisma.conversationMessage.findMany({
  where: {
    conversationId,
    isDeleted: false,
    createdAt: { gt: cursorMessage.createdAt }
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1
})
```

### Cursor Generation

```typescript
// nextCursor = ID của message cũ nhất trong page (để load older)
const nextCursor = hasMore && resultMessages.length > 0 
  ? resultMessages[resultMessages.length - 1].id 
  : null

// prevCursor = ID của message mới nhất trong page (để load newer)
const prevCursor = resultMessages.length > 0 
  ? resultMessages[0].id 
  : null
```

### Data Ordering

Messages được return theo **chronological order** (oldest first):

```typescript
return {
  data: normalizedMessages.reverse(),  // Reverse để oldest first
  pagination: { ... }
}
```

## ⚠️ Edge Cases

### 1. First Page (No Cursor)

```typescript
if (!cursor) {
  // Fetch latest messages
  // hasMore = true if there are older messages
}
```

### 2. Last Page (No More Data)

```typescript
if (messages.length <= limit) {
  // This is the last page
  hasMore = false
  nextCursor = null
}
```

### 3. Invalid Cursor

```typescript
if (cursor) {
  const cursorMessage = await prisma.conversationMessage.findUnique({
    where: { id: cursor }
  })
  
  if (!cursorMessage) {
    throw new Error('Invalid cursor: Message not found')
  }
}
```

### 4. Empty Results

```typescript
if (conversationIds.length === 0) {
  return {
    data: [],
    pagination: {
      limit,
      cursor: null,
      hasMore: false,
      nextCursor: null
    }
  }
}
```

## 🚀 Performance Benefits

### Database Query Performance

**Offset-based (BAD):**
```sql
-- Page 1000 với limit 50
SELECT * FROM messages 
WHERE conversationId = '...' 
ORDER BY createdAt DESC 
OFFSET 49950 LIMIT 50;

-- Database phải scan 50,000 rows!
-- Execution time: ~500ms
```

**Cursor-based (GOOD):**
```sql
-- Bất kỳ page nào
SELECT * FROM messages 
WHERE conversationId = '...' 
AND createdAt < '2025-01-01T10:00:00Z'
ORDER BY createdAt DESC 
LIMIT 51;

-- Database sử dụng index, chỉ scan 51 rows
-- Execution time: ~5ms
```

### Index Optimization

Cần tạo composite index:

```sql
CREATE INDEX idx_messages_conversation_created 
ON conversation_messages(conversationId, createdAt DESC, id);
```

## 📊 So Sánh Offset vs Cursor

| Aspect | Offset-Based | Cursor-Based |
|--------|-------------|--------------|
| **Performance** | Chậm dần theo page number | Luôn nhanh, constant time |
| **Consistency** | Bị duplicate/missing data | Luôn consistent |
| **Real-time** | Không phù hợp | Perfect cho real-time |
| **Implementation** | Đơn giản | Phức tạp hơn một chút |
| **Use Case** | Static data, reports | Chat, feeds, real-time streams |

## 🎓 Best Practices

1. **Luôn fetch +1 record** để check `hasMore`
2. **Return data theo chronological order** (oldest first) cho chat UI
3. **Validate cursor** trước khi sử dụng
4. **Handle empty results** gracefully
5. **Use composite index** trên `(conversationId, createdAt, id)`
6. **Default direction = backward** (load older messages)
7. **Limit max page size** (ví dụ: 100 messages)

## 🔗 Related Files

- `src/routes/conversation/message.repo.ts` - Repository implementation
- `src/routes/conversation/message.service.ts` - Service layer
- `src/routes/conversation/conversation.controller.ts` - API endpoints
- `src/routes/conversation/conversation.dto.ts` - Request/Response DTOs
- `test/integration/conversation-integration.spec.ts` - Integration tests

---

**Last Updated:** 2025-10-25  
**Author:** Augment Agent  
**Version:** 1.0.0

