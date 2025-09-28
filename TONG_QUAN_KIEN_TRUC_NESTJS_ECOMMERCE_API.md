# 📋 TỔNG QUAN KIẾN TRÚC NESTJS ECOMMERCE API

## 🏗️ Kiến Trúc Tổng Quan

Đây là một hệ thống E-commerce API được xây dựng với NestJS framework, sử dụng kiến trúc modular và layered architecture với các thành phần chính sau:

### 🌟 Tech Stack Chính

- **Framework**: NestJS v11 (Node.js/TypeScript)
- **Database**: PostgreSQL với Prisma ORM v6.13
- **Authentication**: JWT + 2FA (TOTP)
- **Real-time**: WebSocket (Socket.IO) + Redis Adapter
- **File Storage**: AWS S3 + Presigned URLs
- **Queue System**: BullMQ + Redis
- **Internationalization**: nestjs-i18n (15 ngôn ngữ)
- **Email**: React Email + Resend
- **Testing**: Jest (Unit + Integration + E2E)
- **Validation**: Zod v4
- **Logging**: Pino Logger
- **Caching**: Cache Manager + Redis

## 📁 Cấu Trúc Thư Mục

```
src/
├── routes/               # Các API modules chính
│   ├── auth/            # Xác thực & phân quyền
│   ├── user/            # Quản lý người dùng
│   ├── product/         # Sản phẩm & SKU
│   ├── cart/            # Giỏ hàng
│   ├── order/           # Đơn hàng
│   ├── payment/         # Thanh toán
│   ├── voucher/         # Mã giảm giá
│   ├── review/          # Đánh giá sản phẩm
│   ├── address/         # Địa chỉ giao hàng
│   ├── conversation/    # Chat real-time
│   ├── ai-assistant/    # Trợ lý AI (Anthropic Claude)
│   ├── brand/           # Thương hiệu
│   ├── category/        # Danh mục sản phẩm
│   ├── language/        # Đa ngôn ngữ
│   ├── role/            # Vai trò
│   ├── permission/      # Quyền hạn
│   ├── profile/         # Hồ sơ người dùng
│   └── media/           # Upload file
├── shared/              # Shared services & utilities
│   ├── services/        # Prisma, JWT, Email, S3, etc.
│   ├── guards/          # Authentication & Authorization
│   ├── pipes/           # Custom validation pipes
│   ├── interceptors/    # Request/Response interceptors
│   ├── filters/         # Exception filters
│   └── repositories/    # Shared repository patterns
├── websockets/          # WebSocket Gateway & Handlers
├── queues/              # Background job consumers
├── cronjobs/            # Scheduled tasks
├── i18n/                # Đa ngôn ngữ (15 languages)
└── generated/           # Auto-generated types
```

## 🗄️ Database Schema & Models

### 👤 Quản Lý Người Dùng

- **User**: Thông tin cơ bản + 2FA
- **UserTranslation**: Đa ngôn ngữ cho user
- **Role & Permission**: RBAC system
- **Device & RefreshToken**: Multi-device session management
- **VerificationCode**: Email verification

### 🛍️ E-commerce Core

- **Product**: Sản phẩm với variant system (JSON)
- **ProductTranslation**: Đa ngôn ngữ sản phẩm
- **SKU**: Stock Keeping Unit với pricing
- **Brand & BrandTranslation**: Thương hiệu đa ngôn ngữ
- **Category & CategoryTranslation**: Danh mục đa ngôn ngữ

### 🛒 Shopping Flow

- **CartItem**: Giỏ hàng theo user + SKU
- **Order**: Đơn hàng với status workflow
- **ProductSKUSnapshot**: Lưu trữ thông tin tại thời điểm đặt hàng
- **Payment**: Xử lý thanh toán
- **Address**: Địa chỉ giao hàng

### 🎟️ Promotion System

- **Voucher**: Mã giảm giá (4 loại)
  - PERCENTAGE: Giảm theo %
  - FIXED_AMOUNT: Giảm số tiền cố định
  - FREE_SHIPPING: Miễn phí vận chuyển
  - BUY_X_GET_Y: Mua X tặng Y
- **UserVoucher**: Theo dõi việc sử dụng voucher

### ⭐ Review System

- **Review**: Đánh giá với rating 1-5 sao
- **ReviewMedia**: Hình ảnh/video đánh giá
- Enhanced features: Verified purchase, seller response

### 💬 Chat System (Real-time)

- **Conversation**: Chat 1-1 hoặc nhóm
- **ConversationMember**: Thành viên với roles
- **ConversationMessage**: Tin nhắn với reply support
- **MessageAttachment**: File đính kèm
- **MessageReaction**: Emoji reactions
- **MessageReadReceipt**: Tracking đã đọc
- **TypingIndicator**: Hiển thị đang gõ

### 🤖 AI Assistant System

- **AIConversation**: Cuộc trò chuyện với AI
- **AIMessage**: Tin nhắn AI với token tracking
- **AIKnowledge**: Knowledge base cho AI

## 🏛️ Kiến Trúc Layers

### 1. **Presentation Layer** (Controllers)

- REST API endpoints với Swagger documentation
- Input validation với Zod schemas
- Response serialization với DTO patterns

### 2. **Business Logic Layer** (Services)

- Domain logic và business rules
- Use case implementations
- Cross-cutting concerns (caching, logging)

### 3. **Data Access Layer** (Repositories)

- Prisma ORM với custom repository patterns
- Shared repositories cho common operations
- Database transaction management

### 4. **Infrastructure Layer** (Shared Services)

- External service integrations
- File storage (S3)
- Email service
- Authentication & Authorization

## 🔐 Security & Authentication

### Authentication Flow

1. **Login**: Email/Password + Optional 2FA
2. **JWT Tokens**: Access + Refresh token strategy
3. **Multi-device Support**: Device tracking
4. **Social Auth**: Google OAuth integration

### Authorization

- **RBAC**: Role-Based Access Control
- **Guards**: Route-level protection
- **API Key**: Payment webhook authentication

### Security Features

- Password hashing với bcrypt
- Rate limiting với Throttler
- CORS configuration
- Helmet for security headers

## 🌐 Internationalization (i18n)

### Supported Languages (15)

Vietnamese, English, Chinese, Japanese, Korean, French, German, Spanish, Italian, Russian, Portuguese, Arabic, Hindi, Thai, Indonesian

### Implementation

- `nestjs-i18n` cho backend translation
- Language resolver từ query param hoặc Accept-Language header
- Translation cho User, Product, Brand, Category entities

## 🚀 Real-time Features

### WebSocket System

- **Socket.IO** với Redis Adapter
- **Chat System**: Real-time messaging
- **Typing Indicators**: Live typing status
- **Online Presence**: User online/offline tracking

### Queue System

- **BullMQ** cho background jobs
- **Payment Processing**: Async payment handling
- **Email Sending**: Queue-based email delivery

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests**: Services & Controllers
   - Jest với mocking
   - Coverage tracking
2. **Integration Tests**: API endpoints
   - Database integration
   - Real HTTP requests
3. **E2E Tests**: Complete user flows
   - End-to-end scenarios

### Test Coverage Areas

- Authentication flow
- Cart → Order → Payment flow
- Product → Review flow
- Voucher system
- Chat system

## 📊 Monitoring & Logging

### Logging System

- **Pino Logger** cho high-performance logging
- Structured JSON logs
- Request/Response logging với interceptors

### Error Handling

- Global exception filters
- Custom error types
- Validation error formatting

## 🔄 Data Seeding & Scripts

### Initial Setup Scripts

```bash
npm run init-seed-data        # Tạo roles & admin user
npm run add-languages         # 15 ngôn ngữ
npm run add-brands           # 10 thương hiệu nổi tiếng
npm run add-categories       # Danh mục sản phẩm
npm run add-products         # Sản phẩm mẫu
npm run add-voucher-sample   # Voucher mẫu
```

## 📈 Performance Optimization

### Caching Strategy

- **Redis** cho session storage
- **Cache Manager** cho API responses
- **Prisma** query optimization

### Database Optimization

- Proper indexing strategy
- Soft delete pattern
- Audit fields (createdBy, updatedBy, deletedBy)

## 🛠️ Development Tools

### Code Quality

- **ESLint** + **Prettier** cho code formatting
- **TypeScript** strict mode
- **Zod** cho runtime type validation

### Development Scripts

```bash
npm run start:dev         # Development mode
npm run test             # Unit tests
npm run test:integration # Integration tests
npm run test:e2e         # E2E tests
npm run lint             # Code linting
```

## 🔮 Future Roadmap

### Planned Features

1. **Microservices Migration**: CQRS pattern implementation
2. **Advanced Analytics**: User behavior tracking
3. **ML Recommendations**: Product recommendation engine
4. **Mobile Push Notifications**: Firebase integration
5. **Advanced Search**: Elasticsearch integration

### Scalability Considerations

- Database sharding strategy
- CDN integration cho static assets
- Load balancing preparation
- Monitoring & alerting system

---

## 📝 Kết Luận

Đây là một hệ thống E-commerce toàn diện với kiến trúc hiện đại, bao gồm đầy đủ các tính năng từ cơ bản đến nâng cao:

- ✅ **Complete E-commerce Flow**: Product → Cart → Order → Payment
- ✅ **Advanced Features**: Real-time chat, AI assistant, multi-language
- ✅ **Enterprise-ready**: Security, testing, monitoring
- ✅ **Scalable Architecture**: Modular design, clean separation
- ✅ **Developer Experience**: Type safety, comprehensive testing

Hệ thống được thiết kế để dễ dàng mở rộng và bảo trì, tuân thủ các best practices của NestJS và enterprise development patterns.
