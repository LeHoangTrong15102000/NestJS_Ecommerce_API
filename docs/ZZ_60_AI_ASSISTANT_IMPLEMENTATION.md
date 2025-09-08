# 🤖 AI Assistant Implementation - NestJS E-commerce API

## 📋 Tổng quan

Đây là documentation chi tiết về việc implement hệ thống **AI Assistant** cho dự án NestJS E-commerce API sử dụng **Anthropic Claude SDK**. Hệ thống được thiết kế để hỗ trợ khách hàng trong quá trình mua sắm, tư vấn sản phẩm, và giải đáp các câu hỏi liên quan đến e-commerce.

### ✨ Tính năng chính

- **🧠 AI Chatbot thông minh**: Sử dụng Claude 3 Haiku của Anthropic
- **💬 Conversation Management**: Quản lý cuộc trò chuyện với context
- **📡 Real-time Streaming**: Streaming response giống ChatGPT
- **🔍 Search & Analytics**: Tìm kiếm tin nhắn và thống kê
- **🛡️ Fallback System**: Hoạt động ngay cả khi không có API key
- **🚀 Production Ready**: Tuân thủ best practices và scalable

---

## 🏗️ Kiến trúc hệ thống

### 1. Database Schema

#### **AI Conversation Model**

```prisma
model AIConversation {
  id          String    @id @default(cuid())
  userId      Int       // User sở hữu conversation
  title       String?   @db.VarChar(500) // Tiêu đề auto-generated
  context     Json?     // Context data cho AI
  isActive    Boolean   @default(true)
  isArchived  Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  user        User        @relation("UserAIConversations")
  messages    AIMessage[] @relation("AIConversationMessages")
}
```

#### **AI Message Model**

```prisma
model AIMessage {
  id               String        @id @default(cuid())
  conversationId   String
  role             AIMessageRole // USER, ASSISTANT, SYSTEM
  content          String        // Nội dung tin nhắn
  tokenCount       Int?          // Số tokens consumed
  responseTime     Int?          // Response time (ms)
  model            String?       // AI model used
  error            String?       // Error message
  contextUsed      Json?         // Context data used
  createdAt        DateTime      @default(now())

  conversation AIConversation @relation("AIConversationMessages")
}
```

#### **AI Knowledge Base Model**

```prisma
model AIKnowledge {
  id          String          @id @default(cuid())
  type        AIKnowledgeType // PRODUCT, FAQ, POLICY, etc.
  title       String          @db.VarChar(500)
  content     String          // Nội dung kiến thức
  keywords    String[]        // Keywords để search
  isActive    Boolean         @default(true)
  priority    Int             @default(0)
  productId   Int?            // Link đến product
  categoryId  Int?            // Link đến category
  // ... audit fields
}
```

### 2. Module Structure

```
src/routes/ai-assistant/
├── ai-assistant.controller.ts    # REST endpoints
├── ai-assistant.service.ts       # Core business logic
├── ai-assistant.repo.ts         # Database operations
├── ai-assistant.dto.ts          # Validation schemas
├── ai-assistant.model.ts        # Type definitions
└── ai-assistant.module.ts       # NestJS module
```

---

## 🔧 Implementation Details

### 1. AI Service Core Features

#### **System Prompt**

```typescript
private getSystemPrompt(): string {
  return `Bạn là trợ lý ảo thông minh cho hệ thống E-commerce. Nhiệm vụ của bạn:

🛍️ HỖ TRỢ MUA SẮM:
- Tư vấn sản phẩm phù hợp với nhu cầu
- So sánh sản phẩm, giá cả, chất lượng
- Giải thích tính năng, thông số kỹ thuật
- Gợi ý sản phẩm tương tự hoặc phụ kiện

📦 HỖ TRỢ ĐỚN HÀNG:
- Hướng dẫn đặt hàng, thanh toán
- Tra cứu trạng thái đơn hàng
- Chính sách đổi trả, bảo hành
- Phí vận chuyển, thời gian giao hàng

💡 NGUYÊN TẮC TRẢ LỜI:
- Trả lời bằng tiếng Việt thân thiện, chuyên nghiệp
- Sử dụng emoji phù hợp để tạo cảm xúc
- Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin
- Ưu tiên giải pháp cụ thể, hữu ích`
}
```

#### **Fallback System**

```typescript
private getFallbackResponse(userMessage: string, errorType: string = 'general'): string {
  const lowerMessage = userMessage.toLowerCase()

  if (errorType === 'quota') {
    return 'Xin lỗi, hệ thống AI hiện đang quá tải. Vui lòng liên hệ CSKH!'
  }

  if (lowerMessage.includes('xin chào')) {
    return 'Xin chào! Tôi là trợ lý ảo của shop. Bạn cần hỗ trợ gì? 😊'
  }
  // ... more fallback responses
}
```

#### **Streaming Response**

```typescript
async generateStreamingResponse(
  previousMessages: any[],
  userMessage: string,
  callbacks: StreamingCallbacks
): Promise<void> {
  const stream = await this.anthropic.messages.stream({
    model: 'claude-3-haiku-20240307',
    max_tokens: 200,
    temperature: 0.7,
    system: this.getSystemPrompt(),
    messages: this.formatMessagesForAnthropic(allMessages),
  })

  stream.on('text', (chunk: string) => callbacks.onChunk(chunk))
  stream.on('end', () => callbacks.onComplete())
  stream.on('error', (error: any) => callbacks.onError(error.message))
}
```

### 2. REST API Endpoints

| Method   | Endpoint                                   | Description                  | Auth |
| -------- | ------------------------------------------ | ---------------------------- | ---- |
| `GET`    | `/ai-assistant/test`                       | Test AI (no auth)            | ❌   |
| `GET`    | `/ai-assistant/test-stream`                | Test streaming               | ❌   |
| `POST`   | `/ai-assistant/conversations`              | Tạo conversation             | ✅   |
| `GET`    | `/ai-assistant/conversations`              | Danh sách conversations      | ✅   |
| `GET`    | `/ai-assistant/conversations/:id`          | Chi tiết conversation        | ✅   |
| `POST`   | `/ai-assistant/conversations/:id/messages` | Gửi tin nhắn                 | ✅   |
| `GET`    | `/ai-assistant/conversations/:id/stream`   | Streaming trong conversation | ✅   |
| `PATCH`  | `/ai-assistant/conversations/:id/archive`  | Archive conversation         | ✅   |
| `DELETE` | `/ai-assistant/conversations/:id`          | Xóa conversation             | ✅   |
| `GET`    | `/ai-assistant/search`                     | Tìm kiếm tin nhắn            | ✅   |
| `GET`    | `/ai-assistant/stats`                      | Thống kê AI usage            | ✅   |

### 3. Streaming Implementation

#### **Controller Streaming Handler**

```typescript
@Get('test-stream')
async testAIStreaming(@Query() query: TestStreamingQueryDto, @Res() res: Response) {
  // Setup Server-Sent Events headers
  res.writeHead(HttpStatus.OK, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  let fullResponse = ''
  const callbacks = {
    onChunk: (chunk: string) => {
      fullResponse += chunk
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        content: chunk,
        fullContent: fullResponse,
      })}\n\n`)
    },
    onComplete: () => {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        fullResponse,
        timestamp: new Date().toISOString(),
      })}\n\n`)
      res.end()
    },
    onError: (error: string) => {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error,
        fallback: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
      })}\n\n`)
      res.end()
    },
  }

  await this.aiAssistantService.generateStreamingResponse([], query.message, callbacks)
}
```

---

## 📱 Frontend Integration

### Test HTML Interface

Đã tạo sẵn `test-streaming.html` với các tính năng:

- **🎨 Modern UI**: Giao diện đẹp với gradient và animations
- **⚡ Real-time Streaming**: Hiển thị response từng chunk
- **📊 Metrics Tracking**: Response time, tokens, chunks count
- **🔄 Auto-retry**: Xử lý lỗi và fallback
- **💡 Example Questions**: Gợi ý câu hỏi mẫu

#### **JavaScript EventSource Integration**

```javascript
const eventSource = new EventSource(`/ai-assistant/test-stream?message=${message}`)

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'start':
      updateStatus('🤖 AI đang suy nghĩ...', 'info')
      break
    case 'chunk':
      contentDiv.innerHTML = data.fullContent + '<span class="cursor">|</span>'
      break
    case 'complete':
      contentDiv.innerHTML = data.fullResponse
      updateStatus('✅ Hoàn tất!', 'success')
      break
  }
}
```

---

## 🔧 Configuration & Setup

### 1. Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxx
```

### 2. Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.61.0"
  }
}
```

### 3. Database Migration

```bash
# Chạy migration để tạo AI tables
npx prisma migrate dev --name add-ai-assistant-system
```

### 4. Module Registration

```typescript
// app.module.ts
import { AIAssistantModule } from 'src/routes/ai-assistant/ai-assistant.module'

@Module({
  imports: [
    // ... other modules
    AIAssistantModule,
  ],
})
export class AppModule {}
```

---

## 📋 Usage Examples

### 1. Test AI Basic

```bash
curl "http://localhost:3000/ai-assistant/test?message=Xin chào!"
```

**Response:**

```json
{
  "success": true,
  "message": "Test AI Assistant thành công",
  "data": {
    "userMessage": "Xin chào!",
    "aiResponse": "Xin chào! Tôi là trợ lý ảo của shop. Bạn cần hỗ trợ gì hôm nay? 😊",
    "timestamp": "2024-09-07T09:45:00.000Z"
  }
}
```

### 2. Create Conversation

```bash
curl -X POST http://localhost:3000/ai-assistant/conversations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "userPreferences": {
        "categories": ["electronics", "smartphones"]
      }
    }
  }'
```

### 3. Send Message

```bash
curl -X POST http://localhost:3000/ai-assistant/conversations/conv_123/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tôi muốn mua iPhone 15 Pro Max"
  }'
```

---

## 🧪 Testing

### 1. Test với Postman

Import collection từ `docs/postman/NestJS_Ecommerce_API.postman_collection.json`

**AI Assistant Collection bao gồm:**

- Test endpoints (no auth)
- Conversation management
- Message sending
- Streaming tests
- Search & stats

### 2. Test với HTML Interface

1. Mở `test-streaming.html` trong browser
2. Nhập câu hỏi và click "Gửi"
3. Xem real-time streaming response
4. Kiểm tra metrics (response time, tokens, etc.)

### 3. Manual Testing Examples

```typescript
// Test scenarios
const testCases = [
  'Xin chào! Tôi cần hỗ trợ.',
  'Tôi muốn tìm laptop cho học sinh',
  'Làm sao để kiểm tra đơn hàng?',
  'Chính sách đổi trả như thế nào?',
  'So sánh iPhone 15 và Samsung Galaxy S24',
]
```

---

## 🚀 Performance & Optimization

### 1. Response Time Optimization

- **Model**: Claude 3 Haiku (fastest & cheapest)
- **Max Tokens**: 200 (balance speed vs quality)
- **Temperature**: 0.7 (creative but focused)
- **Timeout**: 15 seconds

### 2. Fallback Strategy

```typescript
// 3-tier fallback system
1. Anthropic API → Full AI response
2. API Error → Smart fallback responses
3. System Error → Basic error messages
```

### 3. Database Optimization

- **Indexing**: userId, createdAt, conversationId
- **Pagination**: Limit 20 items per page
- **Soft Delete**: isActive flag thay vì hard delete

### 4. Cost Management

- **Token Tracking**: Lưu tokenCount cho mỗi response
- **Usage Analytics**: Theo dõi usage per user
- **Rate Limiting**: Built-in NestJS throttling

---

## 🛡️ Security & Best Practices

### 1. Authentication

- **JWT Guards**: Bảo vệ authenticated endpoints
- **User Isolation**: Chỉ truy cập conversations của chính user
- **Test Endpoints**: Không auth cho testing

### 2. Input Validation

```typescript
// Zod validation schemas
export const SendAIMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Tin nhắn không được để trống')
    .max(2000, 'Tin nhắn không được quá 2000 ký tự')
    .transform((str) => str.trim()),
})
```

### 3. Error Handling

- **Graceful Degradation**: Fallback responses
- **Error Logging**: Comprehensive logging với Winston/Pino
- **User-Friendly Messages**: Không expose internal errors

### 4. Rate Limiting

```typescript
// Built-in NestJS throttling
@ThrottlerGuard()
@Get('test-stream')
// Limits: 5 requests/minute for test endpoints
```

---

## 📊 Analytics & Monitoring

### 1. Metrics Tracked

- **Response Time**: Thời gian phản hồi
- **Token Usage**: Tokens consumed per request
- **Error Rate**: Tỷ lệ lỗi API calls
- **User Activity**: Conversations và messages per user

### 2. Performance Monitoring

```typescript
interface AIConversationStats {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  avgResponseTime: number
  recentActivity: number
}
```

### 3. Cost Tracking

- Token consumption tracking
- API call success/failure rates
- Usage trends per user/time period

---

## 🔮 Future Enhancements

### 1. Advanced Features

- **🧠 Context Enhancement**: Product catalog integration
- **🔍 Semantic Search**: Vector embeddings cho knowledge base
- **📱 Mobile SDK**: React Native/Flutter integration
- **🌍 Multi-language**: i18n support

### 2. AI Improvements

- **📚 Knowledge Base**: Structured product information
- **🎯 Personalization**: User behavior-based responses
- **📈 Learning**: Feedback loop để improve responses
- **🤖 Multi-modal**: Image, voice input support

### 3. Integration Features

- **📦 Order Integration**: Real-time order status
- **💳 Payment Integration**: Payment guidance
- **📞 Escalation**: Handoff to human agents
- **📊 Analytics Dashboard**: Admin analytics interface

---

## ✅ Checklist Implementation

- ✅ **Database Schema**: AI models designed và migrated
- ✅ **Core Service**: Anthropic SDK integration với fallback
- ✅ **REST API**: Complete endpoints với authentication
- ✅ **Streaming**: Real-time SSE implementation
- ✅ **Validation**: Zod schemas cho input validation
- ✅ **Testing**: HTML interface và Postman collection
- ✅ **Documentation**: Comprehensive docs
- ✅ **Error Handling**: Graceful degradation
- ✅ **Performance**: Optimized for production
- ✅ **Security**: JWT authentication và input validation

---

## 🎯 Kết luận

Hệ thống **AI Assistant** đã được implement hoàn chỉnh với:

### 🏆 **Ưu điểm chính:**

1. **🚀 Production Ready**: Scalable architecture, proper error handling
2. **⚡ Real-time Experience**: Streaming response giống ChatGPT
3. **🛡️ Robust Fallback**: Hoạt động ngay cả khi không có API key
4. **📱 Developer Friendly**: Complete testing tools và documentation
5. **🔧 Maintainable**: Clean code structure, proper separation of concerns
6. **💰 Cost Effective**: Efficient token usage và rate limiting

### 🎪 **Ready to Use:**

- **Backend**: Fully implemented với NestJS best practices
- **Database**: Optimized schema với proper indexing
- **API**: RESTful endpoints với comprehensive validation
- **Testing**: HTML interface và Postman collection
- **Documentation**: Chi tiết từ setup đến deployment

### 🚀 **Next Steps:**

1. Deploy lên production environment
2. Configure ANTHROPIC_API_KEY
3. Test với real users
4. Monitor performance và cost
5. Iterate based on user feedback

**🎉 AI Assistant system sẵn sàng để enhance customer experience cho e-commerce platform!**
