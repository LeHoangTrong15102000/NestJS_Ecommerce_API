# 🎯 Câu Hỏi Phỏng Vấn NestJS - Giải Đáp Chi Tiết

_Tài liệu này được tạo dựa trên phân tích kỹ lưỡng source code dự án NestJS Ecommerce API_

## 📋 Mục Lục

1. [Thiết Kế Database cho Hệ Thống Comment Lồng Nhau](#1-thiết-kế-database-cho-hệ-thống-comment-lồng-nhau)
2. [Kiến Trúc Module trong NestJS](#2-kiến-trúc-module-trong-nestjs)
3. [Các Loại Decorator trong NestJS](#3-các-loại-decorator-trong-nestjs)
4. [Sự Khác Nhau giữa Controller và Service](#4-sự-khác-nhau-giữa-controller-và-service)

---

## 1. Thiết Kế Database cho Hệ Thống Comment Lồng Nhau

### 🎯 Yêu Cầu

Thiết kế một feature cho phép:

- Một bài post có nhiều comment
- Mỗi comment có thể có nhiều comment con (nested comments)
- Hỗ trợ cả PostgreSQL và MongoDB

### 🗄️ Thiết Kế PostgreSQL (Relational Database)

#### **Cách 1: Adjacency List Model (Đơn giản nhất)**

```sql
-- Bảng Posts
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

-- Bảng Comments với cấu trúc tự tham chiếu
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER NULL REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    level INTEGER DEFAULT 0, -- Cấp độ lồng nhau (0 = comment gốc, 1 = reply level 1, ...)
    path TEXT, -- Đường dẫn đầy đủ: "1.5.12" (comment 1 > comment 5 > comment 12)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    -- Indexes để tối ưu performance
    INDEX idx_comments_post_id (post_id),
    INDEX idx_comments_parent_id (parent_comment_id),
    INDEX idx_comments_path (path),
    INDEX idx_comments_deleted_at (deleted_at)
);
```

#### **Cách 2: Materialized Path Model (Tối ưu cho truy vấn)**

```sql
-- Bảng Comments với Materialized Path
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER NULL REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,

    -- Materialized Path - Lưu đường dẫn đầy đủ
    path VARCHAR(1000) NOT NULL, -- Ví dụ: "001.003.007" (comment 1 > comment 3 > comment 7)
    level INTEGER NOT NULL DEFAULT 0, -- Cấp độ lồng nhau
    sort_order INTEGER NOT NULL DEFAULT 0, -- Thứ tự sắp xếp trong cùng level

    -- Metadata
    replies_count INTEGER DEFAULT 0, -- Số lượng replies trực tiếp
    total_replies_count INTEGER DEFAULT 0, -- Tổng số replies (bao gồm nested)

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    -- Indexes
    INDEX idx_comments_post_path (post_id, path),
    INDEX idx_comments_parent_level (parent_comment_id, level),
    INDEX idx_comments_deleted_at (deleted_at)
);
```

#### **Prisma Schema Implementation**

```prisma
// Dựa trên cấu trúc hiện tại của dự án
model Post {
  id        Int      @id @default(autoincrement())
  title     String   @db.VarChar(500)
  content   String
  authorId  Int
  author    User     @relation("PostAuthor", fields: [authorId], references: [id])
  comments  Comment[]

  createdById Int?
  createdBy   User? @relation("PostCreatedBy", fields: [createdById], references: [id])
  updatedById Int?
  updatedBy   User? @relation("PostUpdatedBy", fields: [updatedById], references: [id])
  deletedById Int?
  deletedBy   User? @relation("PostDeletedBy", fields: [deletedById], references: [id])

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([deletedAt])
}

model Comment {
  id              Int      @id @default(autoincrement())
  postId          Int
  post            Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentCommentId Int?
  parentComment   Comment? @relation("CommentReplies", fields: [parentCommentId], references: [id], onDelete: Cascade)
  replies         Comment[] @relation("CommentReplies")
  content         String
  authorId        Int
  author          User     @relation("CommentAuthor", fields: [authorId], references: [id])

  // Materialized Path fields
  path            String   @db.VarChar(1000) // "001.003.007"
  level           Int      @default(0)        // Cấp độ lồng nhau
  sortOrder       Int      @default(0)        // Thứ tự sắp xếp
  repliesCount    Int      @default(0)        // Số replies trực tiếp
  totalReplies    Int      @default(0)        // Tổng số replies

  createdById Int?
  createdBy   User? @relation("CommentCreatedBy", fields: [createdById], references: [id])
  updatedById Int?
  updatedBy   User? @relation("CommentUpdatedBy", fields: [updatedById], references: [id])
  deletedById Int?
  deletedBy   User? @relation("CommentDeletedBy", fields: [deletedById], references: [id])

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([postId, path])
  @@index([parentCommentId, level])
  @@index([deletedAt])
}
```

### 🍃 Thiết Kế MongoDB (Document Database)

#### **Cách 1: Embedded Documents (Tối ưu cho đọc)**

```javascript
// Collection: posts
{
  _id: ObjectId("..."),
  title: "Bài viết mẫu",
  content: "Nội dung bài viết...",
  authorId: ObjectId("..."),
  comments: [
    {
      _id: ObjectId("..."),
      content: "Comment gốc 1",
      authorId: ObjectId("..."),
      createdAt: ISODate("..."),
      replies: [
        {
          _id: ObjectId("..."),
          content: "Reply cho comment 1",
          authorId: ObjectId("..."),
          createdAt: ISODate("..."),
          replies: [
            {
              _id: ObjectId("..."),
              content: "Reply level 2",
              authorId: ObjectId("..."),
              createdAt: ISODate("..."),
              replies: [] // Có thể tiếp tục nested
            }
          ]
        }
      ]
    },
    {
      _id: ObjectId("..."),
      content: "Comment gốc 2",
      authorId: ObjectId("..."),
      createdAt: ISODate("..."),
      replies: []
    }
  ],
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### **Cách 2: Separate Collection với Path (Tối ưu cho ghi)**

```javascript
// Collection: posts
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  title: "Bài viết mẫu",
  content: "Nội dung bài viết...",
  authorId: ObjectId("507f1f77bcf86cd799439012"),
  commentsCount: 15,
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}

// Collection: comments
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  postId: ObjectId("507f1f77bcf86cd799439011"),
  parentCommentId: null, // null = comment gốc
  content: "Đây là comment gốc",
  authorId: ObjectId("507f1f77bcf86cd799439012"),
  path: "507f1f77bcf86cd799439013", // Đường dẫn từ root
  level: 0,
  sortOrder: 1,
  repliesCount: 2,
  createdAt: ISODate("2024-01-15T10:31:00Z")
}

{
  _id: ObjectId("507f1f77bcf86cd799439014"),
  postId: ObjectId("507f1f77bcf86cd799439011"),
  parentCommentId: ObjectId("507f1f77bcf86cd799439013"),
  content: "Reply cho comment gốc",
  authorId: ObjectId("507f1f77bcf86cd799439015"),
  path: "507f1f77bcf86cd799439013.507f1f77bcf86cd799439014",
  level: 1,
  sortOrder: 1,
  repliesCount: 0,
  createdAt: ISODate("2024-01-15T10:32:00Z")
}
```

### 💻 Implementation trong NestJS

#### **Service Layer cho PostgreSQL**

```typescript
// comment.service.ts
@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly prisma: PrismaService,
  ) {}

  // Tạo comment mới
  async createComment(data: CreateCommentDto): Promise<Comment> {
    const { postId, parentCommentId, content, authorId } = data

    let path = ''
    let level = 0
    let sortOrder = 1

    if (parentCommentId) {
      // Lấy thông tin parent comment
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { path: true, level: true },
      })

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found')
      }

      level = parentComment.level + 1

      // Giới hạn độ sâu (ví dụ: tối đa 5 levels)
      if (level > 5) {
        throw new BadRequestException('Maximum nesting level exceeded')
      }

      // Tạo path mới
      const newCommentId = await this.getNextCommentId()
      path = `${parentComment.path}.${newCommentId.toString().padStart(3, '0')}`

      // Tính sort order
      const lastReply = await this.prisma.comment.findFirst({
        where: { parentCommentId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      sortOrder = (lastReply?.sortOrder || 0) + 1
    } else {
      // Comment gốc
      const newCommentId = await this.getNextCommentId()
      path = newCommentId.toString().padStart(3, '0')

      const lastRootComment = await this.prisma.comment.findFirst({
        where: { postId, parentCommentId: null },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      sortOrder = (lastRootComment?.sortOrder || 0) + 1
    }

    // Tạo comment trong transaction
    return await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          postId,
          parentCommentId,
          content,
          authorId,
          path,
          level,
          sortOrder,
          createdById: authorId,
        },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
        },
      })

      // Cập nhật repliesCount của parent
      if (parentCommentId) {
        await tx.comment.update({
          where: { id: parentCommentId },
          data: {
            repliesCount: { increment: 1 },
            totalReplies: { increment: 1 },
          },
        })

        // Cập nhật totalReplies của tất cả ancestors
        await this.updateAncestorsCounts(tx, parentCommentId, 1)
      }

      return comment
    })
  }

  // Lấy comments với cấu trúc tree
  async getCommentsTree(postId: number, options: GetCommentsOptions = {}): Promise<CommentTree[]> {
    const { limit = 20, offset = 0, maxLevel = 3 } = options

    // Lấy comments với path sorting
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
        level: { lte: maxLevel },
      },
      orderBy: [{ level: 'asc' }, { path: 'asc' }, { createdAt: 'asc' }],
      skip: offset,
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // Chuyển đổi thành cấu trúc tree
    return this.buildCommentsTree(comments)
  }

  // Xóa comment (soft delete)
  async deleteComment(commentId: number, userId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { parentCommentId: true, totalReplies: true },
      })

      if (!comment) {
        throw new NotFoundException('Comment not found')
      }

      // Soft delete comment và tất cả replies
      await tx.comment.updateMany({
        where: {
          OR: [{ id: commentId }, { path: { startsWith: comment.path } }],
        },
        data: {
          deletedAt: new Date(),
          deletedById: userId,
        },
      })

      // Cập nhật counts của parent
      if (comment.parentCommentId) {
        await tx.comment.update({
          where: { id: comment.parentCommentId },
          data: {
            repliesCount: { decrement: 1 },
            totalReplies: { decrement: comment.totalReplies + 1 },
          },
        })

        await this.updateAncestorsCounts(tx, comment.parentCommentId, -(comment.totalReplies + 1))
      }
    })
  }

  // Helper methods
  private async getNextCommentId(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval(pg_get_serial_sequence('comments', 'id'))
    `
    return Number(result[0].nextval)
  }

  private buildCommentsTree(comments: Comment[]): CommentTree[] {
    const commentMap = new Map<number, CommentTree>()
    const rootComments: CommentTree[] = []

    // Tạo map tất cả comments
    comments.forEach((comment) => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
      })
    })

    // Xây dựng tree structure
    comments.forEach((comment) => {
      const commentNode = commentMap.get(comment.id)!

      if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
        const parent = commentMap.get(comment.parentCommentId)!
        parent.replies.push(commentNode)
      } else if (!comment.parentCommentId) {
        rootComments.push(commentNode)
      }
    })

    return rootComments
  }

  private async updateAncestorsCounts(tx: any, commentId: number, increment: number): Promise<void> {
    // Cập nhật totalReplies của tất cả ancestors
    const ancestors = await tx.comment.findMany({
      where: {
        path: {
          in: await this.getAncestorPaths(commentId),
        },
      },
      select: { id: true },
    })

    await tx.comment.updateMany({
      where: {
        id: { in: ancestors.map((a) => a.id) },
      },
      data: {
        totalReplies: { increment },
      },
    })
  }
}
```

#### **Service Layer cho MongoDB**

```typescript
// comment-mongo.service.ts
@Injectable()
export class CommentMongoService {
  constructor(
    @InjectModel('Comment') private commentModel: Model<CommentDocument>,
    @InjectModel('Post') private postModel: Model<PostDocument>,
  ) {}

  // Tạo comment mới (Separate Collection approach)
  async createComment(data: CreateCommentDto): Promise<CommentDocument> {
    const { postId, parentCommentId, content, authorId } = data

    let path = ''
    let level = 0

    if (parentCommentId) {
      const parentComment = await this.commentModel.findById(parentCommentId)
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found')
      }

      level = parentComment.level + 1
      if (level > 5) {
        throw new BadRequestException('Maximum nesting level exceeded')
      }

      path = `${parentComment.path}.${new Types.ObjectId()}`
    } else {
      path = new Types.ObjectId().toString()
    }

    const session = await this.commentModel.db.startSession()

    try {
      await session.withTransaction(async () => {
        // Tạo comment
        const comment = new this.commentModel({
          postId,
          parentCommentId,
          content,
          authorId,
          path,
          level,
          repliesCount: 0,
          createdAt: new Date(),
        })

        await comment.save({ session })

        // Cập nhật parent repliesCount
        if (parentCommentId) {
          await this.commentModel.updateOne({ _id: parentCommentId }, { $inc: { repliesCount: 1 } }, { session })
        }

        // Cập nhật post commentsCount
        await this.postModel.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }, { session })

        return comment
      })
    } finally {
      await session.endSession()
    }
  }

  // Lấy comments tree
  async getCommentsTree(postId: string, options: GetCommentsOptions = {}): Promise<any[]> {
    const { limit = 20, maxLevel = 3 } = options

    const comments = await this.commentModel.aggregate([
      {
        $match: {
          postId: new Types.ObjectId(postId),
          level: { $lte: maxLevel },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { name: 1, avatar: 1 } }],
        },
      },
      {
        $unwind: '$author',
      },
      {
        $sort: { path: 1, createdAt: 1 },
      },
      {
        $limit: limit,
      },
    ])

    return this.buildMongoCommentsTree(comments)
  }

  // Embedded approach - Thêm comment vào post document
  async addEmbeddedComment(postId: string, data: CreateCommentDto): Promise<void> {
    const { parentCommentPath, content, authorId } = data

    const updatePath = parentCommentPath ? `comments.${parentCommentPath}.replies` : 'comments'

    await this.postModel.updateOne(
      { _id: postId },
      {
        $push: {
          [updatePath]: {
            _id: new Types.ObjectId(),
            content,
            authorId,
            createdAt: new Date(),
            replies: [],
          },
        },
      },
    )
  }

  private buildMongoCommentsTree(comments: any[]): any[] {
    // Similar tree building logic như PostgreSQL
    return comments // Simplified
  }
}
```

### 📊 So Sánh Các Approaches

| Tiêu Chí               | PostgreSQL Adjacency List | PostgreSQL Materialized Path | MongoDB Embedded | MongoDB Separate |
| ---------------------- | ------------------------- | ---------------------------- | ---------------- | ---------------- |
| **Đơn giản**           | ⭐⭐⭐⭐⭐                | ⭐⭐⭐                       | ⭐⭐⭐⭐         | ⭐⭐⭐           |
| **Performance đọc**    | ⭐⭐                      | ⭐⭐⭐⭐⭐                   | ⭐⭐⭐⭐⭐       | ⭐⭐⭐           |
| **Performance ghi**    | ⭐⭐⭐⭐                  | ⭐⭐⭐                       | ⭐⭐             | ⭐⭐⭐⭐         |
| **Flexible queries**   | ⭐⭐                      | ⭐⭐⭐⭐⭐                   | ⭐⭐             | ⭐⭐⭐⭐         |
| **Storage efficiency** | ⭐⭐⭐⭐                  | ⭐⭐⭐                       | ⭐⭐⭐⭐⭐       | ⭐⭐⭐           |
| **Scalability**        | ⭐⭐⭐                    | ⭐⭐⭐⭐                     | ⭐⭐             | ⭐⭐⭐⭐⭐       |

### 🎯 Khuyến Nghị

**Chọn PostgreSQL Materialized Path nếu:**

- Cần performance đọc cao
- Queries phức tạp (tìm tất cả descendants, ancestors)
- Có nhiều operations phân tích dữ liệu

**Chọn MongoDB Embedded nếu:**

- Comments ít, không quá deep nesting
- Luôn cần load toàn bộ comments của post
- Ưu tiên performance đọc tuyệt đối

**Chọn MongoDB Separate nếu:**

- Cần flexibility cao
- Comments có thể rất nhiều
- Cần pagination, filtering phức tạp

---

## 2. Kiến Trúc Module trong NestJS

### 🏗️ Tổng Quan về Module Architecture

Dựa trên phân tích source code dự án, NestJS sử dụng **kiến trúc module** như một cách tổ chức ứng dụng thành các khối chức năng riêng biệt, mỗi module đóng gói related functionality.

### 🎯 Cách Module Hoạt Động

#### **1. Module Definition**

```typescript
// Ví dụ từ src/routes/auth/auth.module.ts
@Module({
  providers: [AuthService, AuthRepository, GoogleService],
  controllers: [AuthController],
})
export class AuthModule {}
```

**Các thành phần chính:**

- **providers**: Services, repositories, factories (có thể inject được)
- **controllers**: Xử lý HTTP requests
- **imports**: Modules khác cần sử dụng
- **exports**: Providers được chia sẻ cho modules khác

#### **2. Root Module - AppModule**

```typescript
// src/app.module.ts
@Module({
  imports: [
    I18nModule.forRoot({...}),
    SharedModule,        // Global shared services
    AuthModule,          // Authentication domain
    LanguageModule,      // Language management
    RoleModule,          // Role management
    PermissionModule,    // Permission management
    ProfileModule,       // User profile
    UserModule,          // User management
    MediaModule,         // File management
    BrandModule,         // Brand management
    BrandTranslationModule, // Brand translations
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Providers
    { provide: APP_PIPE, useClass: CustomZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

#### **3. Shared Module - Global Services**

```typescript
// src/shared/shared.module.ts
@Global() // ← Quan trọng: Làm module có sẵn toàn bộ app
@Module({
  providers: [
    // Infrastructure Services
    PrismaService,
    HashingService,
    TokenService,
    SharedUserRepository,
    EmailService,
    TwoFactorService,
    S3Service,
    SharedRoleRepository,

    // Security Guards
    AccessTokenGuard,
    APIKeyGuard,

    // Global Guard
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: [
    // Export để các module khác sử dụng
    PrismaService,
    HashingService,
    TokenService,
    SharedUserRepository,
    EmailService,
    TwoFactorService,
    S3Service,
    SharedRoleRepository,
  ],
  imports: [JwtModule], // Import JWT module
})
export class SharedModule {}
```

### 🔄 Vòng Đời Module

#### **1. Module Scanning Phase**

```typescript
// NestJS tự động scan và register modules
async function bootstrap() {
  const app = await NestFactory.create(AppModule) // ← Bắt đầu từ root module

  // NestJS sẽ:
  // 1. Scan AppModule
  // 2. Scan tất cả imported modules
  // 3. Register providers vào DI container
  // 4. Resolve dependencies

  await app.listen(3000)
}
```

#### **2. Dependency Resolution**

```typescript
// Ví dụ: UserService cần các dependencies
@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepo, // Local provider
    private hashingService: HashingService, // From SharedModule
    private sharedUserRepository: SharedUserRepository, // From SharedModule
    private sharedRoleRepository: SharedRoleRepository, // From SharedModule
  ) {}
}

// NestJS DI Container tự động:
// 1. Tạo instance của HashingService (từ SharedModule)
// 2. Tạo instance của UserRepo (từ UserModule)
// 3. Inject tất cả vào UserService constructor
// 4. UserService sẵn sàng sử dụng
```

#### **3. Module Organization Patterns**

**Feature Module Pattern:**

```typescript
// Mỗi domain/feature có module riêng
routes/
├── auth/           # Authentication & Authorization
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.repo.ts
│   └── auth.dto.ts
├── user/           # User Management
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.repo.ts
└── brand/          # Brand Management
    ├── brand.module.ts
    ├── brand.controller.ts
    ├── brand.service.ts
    └── brand.repo.ts
```

### 🎯 Các Loại Module

#### **1. Feature Modules**

```typescript
// Domain-specific modules
@Module({
  providers: [UserService, UserRepo],
  controllers: [UserController],
  exports: [UserService], // Export service để modules khác dùng
})
export class UserModule {}
```

#### **2. Shared Modules**

```typescript
// Services dùng chung
@Global() // Tự động available mọi nơi
@Module({
  providers: [PrismaService, HashingService],
  exports: [PrismaService, HashingService],
})
export class SharedModule {}
```

#### **3. Configuration Modules**

```typescript
// Dynamic configuration
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.resolve('src/i18n/'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
  ],
})
export class AppModule {}
```

### ⚡ Module Lifecycle Hooks

```typescript
// Module có thể implement lifecycle hooks
@Module({...})
export class AuthModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('AuthModule has been initialized');
    // Setup logic, connect to external services, etc.
  }

  async onModuleDestroy() {
    console.log('AuthModule is being destroyed');
    // Cleanup logic, close connections, etc.
  }
}
```

### 🔐 Module Encapsulation

#### **Private vs Public Providers**

```typescript
@Module({
  providers: [
    AuthService, // Private - chỉ dùng trong module
    AuthRepository, // Private
    GoogleService, // Private
  ],
  controllers: [AuthController],
  exports: [AuthService], // Public - có thể import ở modules khác
})
export class AuthModule {}

// Modules khác chỉ có thể inject AuthService, không thể inject AuthRepository
@Injectable()
export class SomeOtherService {
  constructor(
    private authService: AuthService, // ✅ OK - được export
    // private authRepo: AuthRepository, // ❌ Error - không được export
  ) {}
}
```

### 🌟 Advanced Module Patterns

#### **1. Dynamic Modules**

```typescript
// Module tự config dựa trên parameters
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
      global: true,
    }
  }
}

// Sử dụng
@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
    }),
  ],
})
export class AppModule {}
```

#### **2. Circular Dependencies**

```typescript
// Giải quyết circular dependencies
@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {}
}
```

### 🎯 Best Practices từ Dự Án

#### **1. Domain-Driven Organization**

- Mỗi module đại diện cho một business domain
- Clear separation of concerns
- Single responsibility principle

#### **2. Global Module for Infrastructure**

- SharedModule chứa infrastructure services
- Sử dụng @Global() để tránh import lặp lại
- Export common utilities

#### **3. Proper Dependency Management**

- Chỉ export những gì cần thiết
- Tránh circular dependencies
- Sử dụng interfaces để loose coupling

#### **4. Consistent Module Structure**

```
module/
├── module.ts        # Module definition
├── controller.ts    # HTTP layer
├── service.ts       # Business logic
├── repo.ts         # Data access
├── dto.ts          # Data transfer objects
├── model.ts        # Domain models
└── error.ts        # Domain-specific errors
```

---

## 3. Các Loại Decorator trong NestJS

### 🎯 Tổng Quan về Decorators

Dựa trên phân tích source code, dự án sử dụng rất nhiều loại decorators khác nhau. Decorators trong NestJS là **metadata annotations** cho phép attach additional information và behavior vào classes, methods, properties.

### 📝 Phân Loại Decorators

#### **1. Class Decorators**

**@Module - Module Definition**

```typescript
// src/app.module.ts
@Module({
  imports: [SharedModule, AuthModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**@Controller - Route Controller**

```typescript
// src/routes/auth/auth.controller.ts
@Controller('auth') // Base path: /auth
export class AuthController {
  // Methods xử lý routes
}
```

**@Injectable - Service Provider**

```typescript
// src/routes/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(private hashingService: HashingService) {}
}
```

**@Global - Global Module**

```typescript
// src/shared/shared.module.ts
@Global() // Module này available toàn bộ app
@Module({
  providers: [PrismaService, HashingService],
  exports: [PrismaService, HashingService],
})
export class SharedModule {}
```

#### **2. Method Decorators**

**HTTP Method Decorators**

```typescript
// src/routes/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('register') // POST /auth/register
  @Get('profile') // GET /auth/profile
  @Put('update') // PUT /auth/update
  @Delete('account') // DELETE /auth/account
  @Patch('status') // PATCH /auth/status
  async register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }
}
```

**Response Status**

```typescript
@Post('login')
@HttpCode(HttpStatus.OK) // Override default 201 → 200
async login(@Body() body: LoginBodyDTO) {
  return this.authService.login(body);
}
```

**Custom Route Decorators từ Dự Án**

```typescript
// src/shared/decorators/auth.decorator.ts
@Post('login')
@IsPublic() // Bypass authentication
async login(@Body() body: LoginBodyDTO) {
  return this.authService.login(body);
}

// Authentication required (mặc định)
@Get('profile')
async getProfile(@ActiveUser() user: ActiveUserData) {
  return this.authService.getProfile(user.userId);
}
```

#### **3. Parameter Decorators**

**Built-in Parameter Decorators**

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  async login(
    @Body() body: LoginBodyDTO, // Request body
    @Query() query: any, // Query parameters
    @Param('id') id: string, // Route parameters
    @Headers() headers: any, // Request headers
    @Req() request: Request, // Raw request object
    @Res() response: Response, // Raw response object
    @Ip() ip: string, // Client IP
  ) {}
}
```

**Custom Parameter Decorators từ Dự Án**

```typescript
// src/shared/decorators/active-user.decorator.ts
export const ActiveUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY];
    return field ? user?.[field] : user;
  },
);

// Usage
@Get('profile')
async getProfile(
  @ActiveUser() user: ActiveUserData,        // Lấy toàn bộ user
  @ActiveUser('userId') userId: number,      // Chỉ lấy userId
) {
  return this.authService.getProfile(userId);
}
```

```typescript
// src/shared/decorators/user-agent.decorator.ts
export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['user-agent'] as string;
  }
);

// Usage
@Post('login')
async login(
  @Body() body: LoginBodyDTO,
  @UserAgent() userAgent: string,    // Lấy user agent
  @Ip() ip: string,
) {
  return this.authService.login({ ...body, userAgent, ip });
}
```

```typescript
// src/shared/decorators/active-role-permissions.decorator.ts
export const ActiveRolePermissions = createParamDecorator(
  (field: keyof RolePermissionsType | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const rolePermissions: RolePermissionsType | undefined = request[REQUEST_ROLE_PERMISSIONS];
    return field ? rolePermissions?.[field] : rolePermissions;
  },
);

// Usage
@Get('admin-data')
async getAdminData(
  @ActiveRolePermissions() permissions: RolePermissionsType,
) {
  // Logic với permissions
}
```

#### **4. Property Decorators**

**Dependency Injection**

```typescript
@Injectable()
export class AuthService {
  // Constructor injection (recommended)
  constructor(
    private readonly hashingService: HashingService,
    private readonly tokenService: TokenService,
  ) {}

  // Property injection (alternative)
  @Inject('CACHE_MANAGER')
  private cacheManager: Cache
}
```

#### **5. Validation Decorators**

**Zod Serialization (từ nestjs-zod)**

```typescript
// src/routes/auth/auth.controller.ts
@Post('register')
@ZodSerializerDto(RegisterResDTO) // Validate & serialize output
async register(@Body() body: RegisterBodyDTO) {
  return this.authService.register(body);
}

@Get('users')
@ZodSerializerDto(GetUsersResDTO) // Đảm bảo response đúng format
async getUsers(@Query() query: GetUsersQueryDTO) {
  return this.userService.list(query);
}
```

#### **6. Guard Decorators**

**Authentication & Authorization**

```typescript
// src/shared/decorators/auth.decorator.ts
export const Auth = (authTypes: AuthTypeType[], options?: { condition: ConditionGuardType }) => {
  return SetMetadata(AUTH_TYPE_KEY, {
    authTypes,
    options: options ?? { condition: ConditionGuard.And }
  });
}

// Usage - Multiple auth strategies
@Post('sensitive-action')
@Auth([AuthType.Bearer, AuthType.ApiKey], { condition: ConditionGuard.And })
async sensitiveAction() {
  // Cần cả Bearer token VÀ API key
}

@Get('public-or-authenticated')
@Auth([AuthType.Bearer, AuthType.None], { condition: ConditionGuard.Or })
async flexibleAccess() {
  // Có thể authenticated HOẶC anonymous
}
```

#### **7. Interceptor & Filter Decorators**

**Exception Handling**

```typescript
// Global level (trong AppModule)
{
  provide: APP_FILTER,
  useClass: HttpExceptionFilter,
}

// Method level
@Post('upload')
@UseFilters(new HttpExceptionFilter())
async uploadFile() {}
```

**Response Transformation**

```typescript
// Global level (trong AppModule)
{
  provide: APP_INTERCEPTOR,
  useClass: ZodSerializerInterceptor,
}

// Method level
@Get('data')
@UseInterceptors(TransformInterceptor)
async getData() {}
```

#### **8. Pipe Decorators**

**Validation & Transformation**

```typescript
// Global level (trong AppModule)
{
  provide: APP_PIPE,
  useClass: CustomZodValidationPipe,
}

// Parameter level
@Get('user/:id')
async getUser(
  @Param('id', ParseIntPipe) id: number,    // Auto parse to number
  @Query('include', new DefaultValuePipe('')) include: string,
) {}
```

#### **9. CQRS Decorators (từ Payment Module)**

**Command & Query Handlers**

```typescript
// src/routes/payment/decorators/logging.decorator.ts
@Injectable()
export class LoggingCommandDecorator<TCommand extends ICommand<TResponse>, TResponse>
  implements ICommandHandler<TCommand, TResponse>
{
  constructor(private readonly innerHandler: ICommandHandler<TCommand, TResponse>) {}

  async handle(command: TCommand): Promise<Result<TResponse>> {
    const commandName = command.constructor.name
    const startTime = Date.now()

    this.logger.log(`[COMMAND] Starting execution: ${commandName}`)

    try {
      const result = await this.innerHandler.handle(command)
      const duration = Date.now() - startTime

      this.logger.log(`[COMMAND] Completed: ${commandName} (${duration}ms)`)
      return result
    } catch (error) {
      this.logger.error(`[COMMAND] Failed: ${commandName}`, error)
      throw error
    }
  }
}
```

#### **10. Metadata Decorators**

**SetMetadata - Custom Metadata**

```typescript
// Define metadata key
export const AUTH_TYPE_KEY = 'authType'
export const IS_PUBLIC_KEY = 'isPublic'

// Set metadata
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true)
export const Auth = (authTypes: AuthTypeType[]) => SetMetadata(AUTH_TYPE_KEY, authTypes)

// Read metadata trong Guard
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    const authTypes = this.reflector.getAllAndOverride<AuthTypeType[]>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Authentication logic...
  }
}
```

### 🔧 Custom Decorators trong Dự Án

#### **1. Authentication Decorator**

```typescript
// Combining multiple decorators
export const Auth = (authTypes: AuthTypeType[], options?: AuthOptions) => {
  return applyDecorators(SetMetadata(AUTH_TYPE_KEY, { authTypes, options }), UseGuards(AuthenticationGuard))
}
```

#### **2. Public Route Decorator**

```typescript
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true)

// Usage
@Controller('auth')
export class AuthController {
  @Post('login')
  @IsPublic() // Không cần authentication
  async login() {}

  @Get('profile')
  // Authentication required (mặc định)
  async getProfile() {}
}
```

#### **3. Validation & Serialization Combo**

```typescript
// Combine validation + serialization
export const ValidatedRoute = (inputDto: any, outputDto: any) => {
  return applyDecorators(
    UsePipes(new ZodValidationPipe(inputDto)),
    ZodSerializerDto(outputDto),
  );
};

// Usage
@Post('create-user')
@ValidatedRoute(CreateUserBodyDTO, CreateUserResDTO)
async createUser(@Body() body: CreateUserBodyDTO) {
  return this.userService.create(body);
}
```

### 📊 Decorator Execution Order

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @IsPublic() // 1. Metadata
  @ZodSerializerDto(LoginResDTO) // 2. Interceptor setup
  @HttpCode(HttpStatus.OK) // 3. Response config
  async login(
    @Body() body: LoginBodyDTO, // 4. Parameter extraction
    @UserAgent() userAgent: string, // 5. Custom parameter
  ) {
    // Method execution
  }
}
```

**Execution Flow:**

1. **Guards** → Authentication/Authorization
2. **Pipes** → Validation/Transformation
3. **Controller Method** → Business logic
4. **Interceptors** → Response transformation
5. **Filters** → Exception handling

### 🎯 Best Practices từ Dự Án

#### **1. Consistent Naming**

```typescript
// Good - Clear intention
@IsPublic()
@ActiveUser()
@UserAgent()

// Avoid - Ambiguous
@Public()
@User()
@UA()
```

#### **2. Compose Complex Decorators**

```typescript
// Instead of repeating multiple decorators
export const AuthenticatedRoute = () =>
  applyDecorators(UseGuards(AuthenticationGuard), UseInterceptors(LoggingInterceptor))
```

#### **3. Type Safety**

```typescript
// Custom decorator with proper typing
export const ActiveUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    // Implementation with type safety
  },
)
```

#### **4. Documentation**

```typescript
/**
 * Marks a route as public, bypassing authentication
 * @example
 * @Post('login')
 * @IsPublic()
 * async login() {}
 */
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true)
```

---

## 4. Sự Khác Nhau giữa Controller và Service

### 🎯 Tổng Quan

Dựa trên phân tích source code dự án, **Controller** và **Service** có vai trò và trách nhiệm hoàn toàn khác nhau trong kiến trúc NestJS, tuân theo nguyên tắc **Separation of Concerns**.

### 🏗️ Controller Layer - Interface Adapter

#### **Trách Nhiệm của Controller**

**1. HTTP Request/Response Handling**

```typescript
// src/routes/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleService: GoogleService,
  ) {}

  @Post('register')
  @ZodSerializerDto(RegisterResDTO) // Output validation
  @IsPublic() // Security config
  register(@Body() body: RegisterBodyDTO) {
    // Input binding
    return this.authService.register(body) // Delegate to service
  }

  @Post('login')
  @ZodSerializerDto(LoginResDTO)
  @IsPublic()
  @HttpCode(HttpStatus.OK) // HTTP status config
  login(
    @Body() body: LoginBodyDTO,
    @UserAgent() userAgent: string, // Extract metadata
    @Ip() ip: string,
  ) {
    return this.authService.login({ ...body, userAgent, ip })
  }
}
```

**2. Request Transformation**

```typescript
// src/routes/user/user.controller.ts
@Controller('users')
export class UserController {
  @Get()
  @ZodSerializerDto(GetUsersResDTO)
  list(@Query() query: GetUsersQueryDTO) {
    // Transform query parameters
    return this.userService.list({
      page: query.page,
      limit: query.limit,
    })
  }

  @Post()
  @ZodSerializerDto(CreateUserResDTO)
  create(
    @Body() body: CreateUserBodyDTO,
    @ActiveUser('userId') currentUserId: number, // Extract from context
  ) {
    // Combine body data with context
    return this.userService.create({
      data: body,
      createdById: currentUserId,
    })
  }
}
```

**3. Route Configuration**

```typescript
@Controller('brands')
export class BrandController {
  @Get()
  @IsPublic() // Public endpoint
  @ZodSerializerDto(GetBrandsResDTO)
  list(@Query() query: PaginationQueryDTO) {
    return this.brandService.list(query)
  }

  @Get(':brandId')
  @IsPublic() // Public endpoint
  @ZodSerializerDto(GetBrandDetailResDTO)
  findById(@Param() params: GetBrandParamsDTO) {
    return this.brandService.findById(params.brandId)
  }

  @Delete(':brandId')
  @ZodSerializerDto(MessageResDTO) // Authenticated endpoint (default)
  delete(@Param() params: GetBrandParamsDTO, @ActiveUser('userId') userId: number) {
    return this.brandService.delete({
      id: params.brandId,
      deletedById: userId,
    })
  }
}
```

### ⚙️ Service Layer - Business Logic

#### **Trách Nhiệm của Service**

**1. Business Logic Implementation**

```typescript
// src/routes/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,
    private readonly authRepository: AuthRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly sharedRoleRepository: SharedRoleRepository,
  ) {}

  async register(body: RegisterBodyType) {
    // 1. Business Rule: Validate verification code
    await this.validateVerificationCode({
      code: body.code,
      email: body.email,
      type: TypeOfVerificationCode.REGISTER,
    })

    // 2. Business Rule: Get default role for new users
    const clientRoleId = await this.sharedRoleRepository.getClientRoleId()

    // 3. Security: Hash password
    const hashedPassword = await this.hashingService.hash(body.password)

    // 4. Database Operation: Create user
    try {
      const newUser = await this.authRepository.createUser({
        ...body,
        password: hashedPassword,
        roleId: clientRoleId,
      })

      // 5. Business Logic: Generate tokens for immediate login
      const tokens = await this.generateTokens({
        userId: newUser.id,
        roleId: newUser.roleId,
        roleName: newUser.role.name,
        refreshTokenExpiresIn: ms('7d'),
      })

      return { user: newUser, ...tokens }
    } catch (error) {
      // 6. Error Handling: Transform database errors to business errors
      if (isUniqueConstraintPrismaError(error)) {
        throw new EmailAlreadyExistsException()
      }
      throw error
    }
  }
}
```

**2. Data Orchestration**

```typescript
// src/routes/user/user.service.ts
@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepo,
    private hashingService: HashingService,
    private sharedUserRepository: SharedUserRepository,
    private sharedRoleRepository: SharedRoleRepository,
  ) {}

  async create(data: CreateUserParamsType) {
    // 1. Business Validation
    const existingUser = await this.sharedUserRepository.findUnique({
      email: data.data.email,
    })

    if (existingUser) {
      throw new EmailAlreadyExistsException()
    }

    // 2. Data Processing
    const hashedPassword = await this.hashingService.hash(data.data.password)

    // 3. Default Business Rules
    const clientRoleId = await this.sharedRoleRepository.getClientRoleId()

    // 4. Coordinate Multiple Operations
    try {
      const user = await this.userRepo.create({
        ...data.data,
        password: hashedPassword,
        roleId: data.data.roleId || clientRoleId,
        createdById: data.createdById,
      })

      // 5. Post-creation Business Logic
      await this.sendWelcomeEmail(user.email, user.name)

      return user
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw new EmailAlreadyExistsException()
      }
      throw error
    }
  }

  async list(params: GetUsersParamsType) {
    // Business Logic: Apply default filters and sorting
    const { page, limit, search, roleId } = params

    return this.userRepo.list({
      page: page || 1,
      limit: Math.min(limit || 10, 100), // Business rule: max 100 items
      where: {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(roleId && { roleId }),
        deletedAt: null, // Business rule: don't show deleted users
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
```

**3. External Service Integration**

```typescript
// Service handles complex integrations
async sendOTP(body: SendOTPBodyType) {
  // 1. Business Rule: Rate limiting
  const recentOtp = await this.authRepository.findRecentOTP(body.email);
  if (recentOtp && !isOTPExpired(recentOtp)) {
    throw new TOTPRequestTooFrequentException();
  }

  // 2. Generate OTP
  const code = generateOTP();
  const expiresAt = addMilliseconds(new Date(), ms('5m'));

  // 3. Database Transaction
  await this.authRepository.createVerificationCode({
    email: body.email,
    code,
    type: body.type,
    expiresAt,
  });

  // 4. External Service Call
  try {
    await this.emailService.sendOTP({
      to: body.email,
      code,
      expiresIn: '5 minutes',
    });
  } catch (error) {
    throw new FailedToSendOTPException();
  }

  return { message: 'OTP sent successfully' };
}
```

### 🔄 Interaction Pattern

#### **Request Flow Example**

```typescript
// 1. HTTP Request → Controller
@Post('users')
@ZodSerializerDto(CreateUserResDTO)
async create(
  @Body() body: CreateUserBodyDTO,           // ← Validation happens here
  @ActiveUser('userId') currentUserId: number,
) {
  // 2. Controller → Service (với data transformation)
  return this.userService.create({
    data: body,                              // ← Data from request
    createdById: currentUserId,              // ← Context from auth
  });
}

// 3. Service processes business logic
async create(data: CreateUserParamsType) {
  // - Validate business rules
  // - Hash password
  // - Set default role
  // - Save to database
  // - Send welcome email
  // - Return user data
}

// 4. Response → Controller → HTTP Response (với serialization)
```

### 🚫 Tại Sao KHÔNG Nên Gộp Controller và Service?

#### **1. Violation of Single Responsibility Principle**

```typescript
// ❌ BAD: Controller với business logic
@Controller('auth')
export class BadAuthController {
  @Post('register')
  async register(@Body() body: RegisterBodyDTO) {
    // HTTP concerns mixed với business logic
    const existingUser = await this.prisma.user.findUnique({
      where: { email: body.email },
    })

    if (existingUser) {
      throw new BadRequestException('Email already exists')
    }

    const hashedPassword = await bcrypt.hash(body.password, 10)
    const role = await this.prisma.role.findFirst({
      where: { name: 'CLIENT' },
    })

    const user = await this.prisma.user.create({
      data: {
        ...body,
        password: hashedPassword,
        roleId: role.id,
      },
    })

    // Generate tokens...
    // Send welcome email...

    return user
  }
}
```

**Problems:**

- Controller quá phức tạp và khó test
- Không thể reuse business logic
- Vi phạm separation of concerns
- Khó maintain và scale

#### **2. Poor Testability**

```typescript
// ❌ Hard to test - phải mock HTTP context
describe('BadAuthController', () => {
  it('should register user', async () => {
    // Phải setup toàn bộ HTTP context, mocks cho Prisma, bcrypt, v.v.
    const mockRequest = createMockRequest()
    const mockResponse = createMockResponse()
    // ... rất nhiều setup
  })
})

// ✅ Easy to test - chỉ test business logic
describe('AuthService', () => {
  it('should register user', async () => {
    const userData = { email: 'test@test.com', password: 'password123' }
    const result = await authService.register(userData)
    expect(result.user.email).toBe(userData.email)
  })
})
```

#### **3. Difficult Code Reuse**

```typescript
// ❌ Cannot reuse logic
class BadAuthController {
  @Post('register')
  async register() {
    // Business logic here - không thể reuse
  }
}

class BadAdminController {
  @Post('create-user')
  async createUser() {
    // Phải duplicate business logic từ register
  }
}

// ✅ Reusable service
class AuthService {
  async register(userData) {
    // Business logic
  }
}

class AuthController {
  @Post('register')
  register(@Body() body) {
    return this.authService.register(body) // Reuse
  }
}

class AdminController {
  @Post('create-user')
  createUser(@Body() body) {
    return this.authService.register(body) // Reuse same logic
  }
}
```

### ✅ Lợi Ích của Separation

#### **1. Clear Responsibilities**

```typescript
// Controller: HTTP layer
@Controller('auth')
export class AuthController {
  // Chỉ quan tâm:
  // - Route definitions
  // - HTTP status codes
  // - Request/response transformation
  // - Input validation
  // - Output serialization
}

// Service: Business layer
@Injectable()
export class AuthService {
  // Chỉ quan tâm:
  // - Business rules
  // - Data orchestration
  // - External service calls
  // - Error handling
  // - Domain logic
}
```

#### **2. Better Testing Strategy**

```typescript
// Unit test Service (business logic)
describe('AuthService', () => {
  beforeEach(() => {
    // Mock only dependencies (repos, external services)
  })

  it('should hash password before saving', async () => {
    // Test business rule
  })

  it('should assign default role to new users', async () => {
    // Test business rule
  })
})

// Integration test Controller (HTTP layer)
describe('AuthController (e2e)', () => {
  it('POST /auth/register should return 201', async () => {
    return request(app).post('/auth/register').send(validUserData).expect(201)
  })
})
```

#### **3. Independent Evolution**

```typescript
// Có thể thay đổi HTTP interface mà không ảnh hưởng business logic
@Controller('v2/authentication') // New API version
export class AuthV2Controller {
  @Post('signup') // Different endpoint name
  async signup(@Body() body: NewRegisterDTO) {
    // Different DTO
    // Same business logic
    return this.authService.register(this.transformToOldFormat(body))
  }
}

// Có thể thay đổi business logic mà không ảnh hưởng HTTP interface
@Injectable()
export class AuthService {
  async register(userData) {
    // Add new business rule: email verification required
    await this.verifyEmailFirst(userData.email)

    // Rest of logic remains same
  }
}
```

#### **4. Dependency Injection Benefits**

```typescript
// Service có thể inject dependencies dễ dàng
@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService, // Crypto operations
    private readonly emailService: EmailService, // External service
    private readonly authRepository: AuthRepository, // Data access
    private readonly configService: ConfigService, // Configuration
  ) {}
}

// Controller chỉ cần service
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService, // Single dependency
  ) {}
}
```

### 🎯 Best Practices từ Dự Án

#### **1. Keep Controllers Thin**

```typescript
// ✅ Good - Controller chỉ handle HTTP concerns
@Post('register')
@ZodSerializerDto(RegisterResDTO)
@IsPublic()
register(@Body() body: RegisterBodyDTO) {
  return this.authService.register(body); // Delegate immediately
}
```

#### **2. Keep Services Focused**

```typescript
// ✅ Good - Service focus on business logic
async register(body: RegisterBodyType) {
  // 1. Validate business rules
  // 2. Process data
  // 3. Coordinate operations
  // 4. Return result
}
```

#### **3. Consistent Error Handling**

```typescript
// Service throws business exceptions
if (existingUser) {
  throw new EmailAlreadyExistsException() // Business error
}

// Controller lets global filter handle it
// No try-catch needed in controller
```

#### **4. Proper Abstraction Levels**

```typescript
// Controller: HTTP abstraction
@Get('users')
async getUsers(@Query() query: GetUsersQueryDTO) {
  return this.userService.list(query);
}

// Service: Business abstraction
async list(params: GetUsersParamsType) {
  return this.userRepo.findManyWithPagination(params);
}

// Repository: Data abstraction
async findManyWithPagination(params) {
  return this.prisma.user.findMany({ /* SQL logic */ });
}
```

### 📊 Tóm Tắt So Sánh

| Aspect               | Controller         | Service                         |
| -------------------- | ------------------ | ------------------------------- |
| **Primary Role**     | HTTP Interface     | Business Logic                  |
| **Concerns**         | Request/Response   | Domain Rules                    |
| **Dependencies**     | Minimal (Services) | Multiple (Repos, External APIs) |
| **Testing**          | Integration/E2E    | Unit Tests                      |
| **Reusability**      | HTTP-specific      | Highly reusable                 |
| **Complexity**       | Simple, thin       | Complex, rich                   |
| **Change Frequency** | API evolution      | Business evolution              |

---

## 🎯 Kết Luận

Qua việc phân tích chi tiết source code dự án NestJS Ecommerce API, chúng ta có thể thấy rằng:

1. **Database Design**: Cần cân nhắc kỹ giữa performance và complexity khi thiết kế nested structures
2. **Module Architecture**: NestJS modules cung cấp powerful organization và DI system
3. **Decorators**: Rất đa dạng và linh hoạt, là backbone của NestJS
4. **Controller vs Service**: Separation rất quan trọng cho maintainability và testability

Dự án này là một excellent example của NestJS best practices và clean architecture implementation.
