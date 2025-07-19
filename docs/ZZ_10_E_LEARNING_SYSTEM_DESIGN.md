# 🎓 HỆ THỐNG E-LEARNING - THIẾT KẾ HOÀN CHỈNH

## 📋 TỔNG QUAN DỰ ÁN

**Dự án**: E-Learning Platform (Tương tự Udemy)  
**Tech Stack**: NestJS, TypeScript, PostgreSQL, Drizzle ORM  
**Kiến trúc**: Domain-Driven Design, CQRS Pattern, Microservices Ready

## 🎯 MỤC TIÊU HỆ THỐNG

### Tính năng chính:

- **Quản lý khóa học**: Tạo, chỉnh sửa, xuất bản khóa học
- **Học tập tương tác**: Video, quiz, assignment, discussion
- **Thanh toán & Enrollment**: Mua khóa học, track progress
- **Chứng chỉ**: Cấp certificate sau khi hoàn thành
- **Community**: Review, rating, Q&A, forum
- **Analytics**: Thống kê học tập, doanh thu cho instructor

---

## 🗺️ LỘ TRÌNH PHÁT TRIỂN (Development Phases)

## Phase 1: Core Foundation & User Management (Tuần 1-4) 🏗️

### Mục tiêu:

Xây dựng nền tảng authentication, authorization và user management cơ bản

### Tính năng:

✅ **User Authentication & Authorization** (Đã có sẵn - sử dụng lại)

- Đăng ký, đăng nhập, 2FA
- Role-based permissions (Student, Instructor, Admin)
- JWT tokens, refresh tokens

🆕 **Extended User Profiles**

- Student profiles với learning preferences
- Instructor profiles với teaching credentials
- Portfolio & experience management

🆕 **Course Categories & Tags**

- Hierarchical category system
- Tag management cho course discovery
- Search & filtering system

### Database Changes:

```sql
-- Extend User với learning/teaching profiles
ALTER TABLE "User" ADD COLUMN "user_type" "UserType" DEFAULT 'STUDENT';
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "website" VARCHAR(500);
ALTER TABLE "User" ADD COLUMN "social_links" JSONB;

-- Course Categories (sử dụng lại category structure hiện có)
-- Tag system mới
CREATE TABLE "CourseTag" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Phase 2: Course Management System (Tuần 5-8) 📚

### Mục tiêu:

Xây dựng hệ thống quản lý khóa học cơ bản

### Tính năng:

🆕 **Course Creation & Management**

- Course CRUD với rich content editor
- Curriculum builder (sections & lectures)
- Draft/Published status management
- Price & discount management

🆕 **Content Management**

- Video upload & streaming
- Document/resource uploads
- Quiz builder với multiple question types
- Assignment creation

🆕 **Course Discovery**

- Search với full-text search
- Filter by category, level, price, rating
- Featured courses & recommendations

### Database Design:

```sql
-- Course Tables
CREATE TABLE "Course" (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(1000),
  description TEXT,
  instructor_id INTEGER REFERENCES "User"(id),
  category_id INTEGER REFERENCES "Category"(id),
  level "CourseLevel" DEFAULT 'BEGINNER',
  language_id VARCHAR(10) REFERENCES "Language"(id),
  price DECIMAL(10,2) DEFAULT 0,
  discount_price DECIMAL(10,2),
  thumbnail VARCHAR(1000),
  preview_video VARCHAR(1000),
  status "CourseStatus" DEFAULT 'DRAFT',
  duration_minutes INTEGER DEFAULT 0,
  enrollment_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE "CourseSection" (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES "Course"(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Lecture" (
  id SERIAL PRIMARY KEY,
  section_id INTEGER REFERENCES "CourseSection"(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content_type "LectureContentType", -- VIDEO, ARTICLE, QUIZ, ASSIGNMENT
  video_url VARCHAR(1000),
  video_duration INTEGER, -- seconds
  article_content TEXT,
  resources JSONB, -- downloadable files
  order_index INTEGER NOT NULL,
  is_preview BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Quiz" (
  id SERIAL PRIMARY KEY,
  lecture_id INTEGER REFERENCES "Lecture"(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER,
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "QuizQuestion" (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES "Quiz"(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type "QuestionType", -- MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER
  options JSONB, -- for multiple choice
  correct_answer TEXT,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL
);

-- Course Tags relationship
CREATE TABLE "CourseTagRelation" (
  course_id INTEGER REFERENCES "Course"(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES "CourseTag"(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, tag_id)
);

-- Enums
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LectureContentType" AS ENUM ('VIDEO', 'ARTICLE', 'QUIZ', 'ASSIGNMENT', 'LIVE_SESSION');
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER');
```

---

## Phase 3: Learning Experience & Progress (Tuần 9-12) 🎯

### Mục tiêu:

Xây dựng trải nghiệm học tập và tracking progress

### Tính năng:

🆕 **Course Enrollment & Access Control**

- Course purchase flow
- Free course enrollment
- Access management (lifetime, time-limited)
- Coupon & discount system

🆕 **Learning Progress Tracking**

- Lecture completion tracking
- Course progress percentage
- Learning streak & achievements
- Bookmark & notes system

🆕 **Interactive Learning**

- Video player với speed control, captions
- Note-taking trong video
- Quiz attempts & scoring
- Assignment submission & grading

### Database Design:

```sql
-- Enrollment & Progress
CREATE TABLE "Enrollment" (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES "User"(id),
  course_id INTEGER REFERENCES "Course"(id),
  enrolled_at TIMESTAMP DEFAULT NOW(),
  access_expires_at TIMESTAMP, -- NULL for lifetime access
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  completed_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  total_time_spent INTEGER DEFAULT 0, -- minutes
  certificate_issued BOOLEAN DEFAULT false
);

CREATE TABLE "LectureProgress" (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES "Enrollment"(id) ON DELETE CASCADE,
  lecture_id INTEGER REFERENCES "Lecture"(id),
  is_completed BOOLEAN DEFAULT false,
  last_position INTEGER DEFAULT 0, -- for video position in seconds
  time_spent INTEGER DEFAULT 0, -- minutes
  completed_at TIMESTAMP,
  first_accessed_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "StudentNote" (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES "Enrollment"(id) ON DELETE CASCADE,
  lecture_id INTEGER REFERENCES "Lecture"(id),
  content TEXT NOT NULL,
  video_timestamp INTEGER, -- for video notes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "QuizAttempt" (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES "Enrollment"(id) ON DELETE CASCADE,
  quiz_id INTEGER REFERENCES "Quiz"(id),
  score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  answers JSONB, -- student answers
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  is_passed BOOLEAN DEFAULT false
);

-- Bookmarks
CREATE TABLE "Bookmark" (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES "User"(id),
  lecture_id INTEGER REFERENCES "Lecture"(id),
  video_timestamp INTEGER,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Coupons & Discounts
CREATE TABLE "Coupon" (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type "CouponType", -- PERCENTAGE, FIXED_AMOUNT
  value DECIMAL(10,2) NOT NULL,
  minimum_amount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES "User"(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
```

---

## Phase 4: Payment & Transaction System (Tuần 13-16) 💳

### Mục tiêu:

Xây dựng hệ thống thanh toán và quản lý giao dịch

### Tính năng:

🆕 **Payment Integration**

- Multiple payment gateways (VNPay, PayPal, Stripe)
- Shopping cart cho multiple courses
- Invoice generation
- Refund management

🆕 **Revenue Management**

- Instructor revenue sharing
- Automatic payout system
- Revenue analytics & reporting
- Tax calculation & reporting

🆕 **Subscription Management** (Optional)

- Monthly/Yearly subscription plans
- Premium content access
- Auto-renewal management

### Database Design:

```sql
-- Orders & Payments (mở rộng từ hệ thống hiện có)
CREATE TABLE "CourseOrder" (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES "User"(id),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  coupon_id INTEGER REFERENCES "Coupon"(id),
  payment_status "PaymentStatus" DEFAULT 'PENDING',
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  transaction_id VARCHAR(255),
  invoice_url VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE TABLE "OrderItem" (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES "CourseOrder"(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES "Course"(id),
  original_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  instructor_id INTEGER REFERENCES "User"(id)
);

-- Revenue Sharing
CREATE TABLE "InstructorRevenue" (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES "User"(id),
  order_item_id INTEGER REFERENCES "OrderItem"(id),
  gross_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  fee_percentage DECIMAL(5,2) DEFAULT 30.00,
  status "RevenueStatus" DEFAULT 'PENDING',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Payout" (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES "User"(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'VND',
  payment_method VARCHAR(50),
  reference_number VARCHAR(255),
  status "PayoutStatus" DEFAULT 'PENDING',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "RevenueStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
```

---

## Phase 5: Community & Social Features (Tuần 17-20) 👥

### Mục tiêu:

Xây dựng tính năng cộng đồng và tương tác xã hội

### Tính năng:

🆕 **Review & Rating System**

- Course reviews với rating 1-5 sao
- Review moderation
- Helpful votes cho reviews
- Response từ instructors

🆕 **Q&A System**

- Student questions trong lectures
- Instructor & community answers
- Upvote/downvote system
- Best answer selection

🆕 **Discussion Forums**

- Course-specific forums
- General discussion areas
- Announcement system từ instructors

### Database Design:

```sql
-- Reviews & Ratings
CREATE TABLE "CourseReview" (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES "Course"(id),
  student_id INTEGER REFERENCES "User"(id),
  enrollment_id INTEGER REFERENCES "Enrollment"(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  content TEXT,
  helpful_count INTEGER DEFAULT 0,
  reported_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

CREATE TABLE "ReviewHelpful" (
  review_id INTEGER REFERENCES "CourseReview"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "User"(id),
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id)
);

-- Q&A System
CREATE TABLE "Question" (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES "Course"(id),
  lecture_id INTEGER REFERENCES "Lecture"(id),
  student_id INTEGER REFERENCES "User"(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  video_timestamp INTEGER,
  upvote_count INTEGER DEFAULT 0,
  answer_count INTEGER DEFAULT 0,
  has_instructor_answer BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Answer" (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES "Question"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "User"(id),
  content TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_best_answer BOOLEAN DEFAULT false,
  is_instructor_answer BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "QuestionUpvote" (
  question_id INTEGER REFERENCES "Question"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "User"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE "AnswerUpvote" (
  answer_id INTEGER REFERENCES "Answer"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "User"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (answer_id, user_id)
);

-- Announcements
CREATE TABLE "CourseAnnouncement" (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES "Course"(id) ON DELETE CASCADE,
  instructor_id INTEGER REFERENCES "User"(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  is_email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Phase 6: Certificates & Achievements (Tuần 21-24) 🏆

### Mục tiêu:

Xây dựng hệ thống chứng chỉ và thành tích

### Tính năng:

🆕 **Certificate System**

- Auto-generate certificates khi hoàn thành course
- Custom certificate templates
- Certificate verification system
- PDF generation với digital signature

🆕 **Achievement & Badges**

- Learning milestones
- Streak achievements
- Special badges (first course, 100 courses, etc.)
- Public profile với achievements

🆕 **Learning Paths**

- Curated course sequences
- Progress tracking across multiple courses
- Completion certificates cho learning paths

### Database Design:

```sql
-- Certificates
CREATE TABLE "Certificate" (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES "Enrollment"(id),
  student_id INTEGER REFERENCES "User"(id),
  course_id INTEGER REFERENCES "Course"(id),
  certificate_number VARCHAR(50) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  pdf_url VARCHAR(1000),
  verification_code VARCHAR(100) UNIQUE NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  template_id INTEGER
);

-- Achievements & Badges
CREATE TABLE "Badge" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  criteria JSONB, -- achievement criteria
  points INTEGER DEFAULT 0,
  rarity "BadgeRarity" DEFAULT 'COMMON',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "UserBadge" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "User"(id),
  badge_id INTEGER REFERENCES "Badge"(id),
  earned_at TIMESTAMP DEFAULT NOW(),
  progress JSONB, -- progress towards achievement
  UNIQUE(user_id, badge_id)
);

-- Learning Paths
CREATE TABLE "LearningPath" (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  thumbnail VARCHAR(1000),
  level "CourseLevel",
  estimated_hours INTEGER,
  enrollment_count INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES "User"(id),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "LearningPathCourse" (
  id SERIAL PRIMARY KEY,
  path_id INTEGER REFERENCES "LearningPath"(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES "Course"(id),
  order_index INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true
);

CREATE TABLE "PathEnrollment" (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES "User"(id),
  path_id INTEGER REFERENCES "LearningPath"(id),
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TYPE "BadgeRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');
```

---

## Phase 7: Analytics & Reporting (Tuần 25-28) 📊

### Mục tiêu:

Xây dựng hệ thống analytics và reporting

### Tính năng:

🆕 **Student Analytics**

- Learning progress dashboard
- Time spent analytics
- Performance metrics
- Learning streak tracking

🆕 **Instructor Analytics**

- Course performance metrics
- Student engagement analytics
- Revenue analytics
- Student feedback insights

🆕 **Admin Analytics**

- Platform-wide metrics
- Revenue reporting
- User growth analytics
- Content performance analysis

### Database Design:

```sql
-- Analytics Tables
CREATE TABLE "UserActivity" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "User"(id),
  activity_type "ActivityType",
  resource_type VARCHAR(50), -- course, lecture, quiz, etc.
  resource_id INTEGER,
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "LectureView" (
  id SERIAL PRIMARY KEY,
  lecture_id INTEGER REFERENCES "Lecture"(id),
  student_id INTEGER REFERENCES "User"(id),
  enrollment_id INTEGER REFERENCES "Enrollment"(id),
  watch_duration INTEGER, -- seconds
  completion_percentage DECIMAL(5,2),
  view_date DATE DEFAULT CURRENT_DATE,
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP
);

CREATE TABLE "CourseAnalytics" (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES "Course"(id),
  date DATE DEFAULT CURRENT_DATE,
  total_enrollments INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, date)
);

CREATE TYPE "ActivityType" AS ENUM (
  'LOGIN', 'LOGOUT', 'COURSE_VIEW', 'LECTURE_VIEW',
  'QUIZ_ATTEMPT', 'ENROLLMENT', 'CERTIFICATE_EARNED',
  'REVIEW_SUBMITTED', 'QUESTION_ASKED', 'ANSWER_SUBMITTED'
);
```

---

## Phase 8: Advanced Features & Optimization (Tuần 29-32) ⚡

### Mục tiêu:

Tối ưu hóa hiệu suất và thêm tính năng nâng cao

### Tính năng:

🆕 **Live Learning**

- Live streaming classes
- Interactive whiteboard
- Real-time chat
- Recording & replay

🆕 **Mobile App Support**

- Offline content download
- Push notifications
- Mobile-optimized player

🆕 **AI-Powered Features**

- Course recommendations
- Auto-generated subtitles
- Content moderation
- Personalized learning paths

🆕 **Performance Optimization**

- CDN integration cho videos
- Caching strategies
- Database indexing optimization
- API rate limiting

### Database Optimization:

```sql
-- Performance Indexes
CREATE INDEX CONCURRENTLY idx_enrollment_student_course ON "Enrollment"(student_id, course_id);
CREATE INDEX CONCURRENTLY idx_lecture_progress_enrollment ON "LectureProgress"(enrollment_id, lecture_id);
CREATE INDEX CONCURRENTLY idx_course_status_published ON "Course"(status) WHERE status = 'PUBLISHED';
CREATE INDEX CONCURRENTLY idx_course_rating_popularity ON "Course"(rating_average DESC, enrollment_count DESC);
CREATE INDEX CONCURRENTLY idx_user_activity_date ON "UserActivity"(created_at DESC);

-- Partitioning cho large tables
CREATE TABLE "UserActivity_2024" PARTITION OF "UserActivity"
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Materialized views cho reporting
CREATE MATERIALIZED VIEW course_stats AS
SELECT
  c.id,
  c.title,
  c.instructor_id,
  COUNT(e.id) as total_enrollments,
  AVG(cr.rating) as avg_rating,
  SUM(co.total_amount) as total_revenue
FROM "Course" c
LEFT JOIN "Enrollment" e ON c.id = e.course_id
LEFT JOIN "CourseReview" cr ON c.id = cr.course_id
LEFT JOIN "OrderItem" oi ON c.id = oi.course_id
LEFT JOIN "CourseOrder" co ON oi.order_id = co.id AND co.payment_status = 'COMPLETED'
GROUP BY c.id, c.title, c.instructor_id;

-- Refresh materialized view daily
CREATE OR REPLACE FUNCTION refresh_course_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY course_stats;
END;
$$ LANGUAGE plpgsql;
```

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

### Domain Structure (NestJS Modules)

```
src/
├── app.module.ts
├── shared/
│   ├── config/
│   ├── database/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── services/
├── domains/
│   ├── auth/                 # Phase 1 ✅
│   ├── user/                 # Phase 1 ✅
│   ├── course/               # Phase 2 🆕
│   │   ├── course.module.ts
│   │   ├── course.controller.ts
│   │   ├── course.service.ts
│   │   ├── course.repository.ts
│   │   └── dto/
│   ├── content/              # Phase 2 🆕
│   │   ├── lecture/
│   │   ├── quiz/
│   │   └── resource/
│   ├── enrollment/           # Phase 3 🆕
│   ├── progress/             # Phase 3 🆕
│   ├── payment/              # Phase 4 ✅ (mở rộng)
│   ├── community/            # Phase 5 🆕
│   │   ├── review/
│   │   ├── qna/
│   │   └── forum/
│   ├── certificate/          # Phase 6 🆕
│   ├── achievement/          # Phase 6 🆕
│   ├── analytics/            # Phase 7 🆕
│   ├── notification/         # Phase 8 🆕
│   └── streaming/            # Phase 8 🆕
└── infrastructure/
    ├── database/
    ├── file-storage/
    ├── email/
    ├── payment-gateways/
    └── video-processing/
```

### API Endpoints Structure

```typescript
// Course Management
GET    /api/courses                    # List courses with filters
POST   /api/courses                    # Create course (instructor)
GET    /api/courses/:id                # Course details
PUT    /api/courses/:id                # Update course (instructor)
DELETE /api/courses/:id                # Delete course (instructor)
POST   /api/courses/:id/publish        # Publish course
GET    /api/courses/:id/analytics      # Course analytics (instructor)

// Course Content
GET    /api/courses/:id/curriculum     # Course curriculum
POST   /api/courses/:id/sections       # Add section
PUT    /api/sections/:id               # Update section
DELETE /api/sections/:id               # Delete section
POST   /api/sections/:id/lectures      # Add lecture
PUT    /api/lectures/:id               # Update lecture
DELETE /api/lectures/:id               # Delete lecture

// Enrollment & Learning
POST   /api/enrollments                # Enroll in course
GET    /api/enrollments                # My enrollments
GET    /api/enrollments/:id/progress   # Enrollment progress
POST   /api/lectures/:id/complete      # Mark lecture complete
POST   /api/quizzes/:id/attempt        # Submit quiz attempt
GET    /api/learning/dashboard         # Learning dashboard

// Community
POST   /api/courses/:id/reviews        # Submit review
GET    /api/courses/:id/reviews        # Get course reviews
POST   /api/courses/:id/questions      # Ask question
GET    /api/courses/:id/questions      # Get Q&A
POST   /api/questions/:id/answers      # Submit answer
PUT    /api/answers/:id/best           # Mark as best answer

// Payments
POST   /api/cart/add                   # Add to cart
GET    /api/cart                       # Get cart items
POST   /api/checkout                   # Checkout process
GET    /api/orders                     # Order history
POST   /api/coupons/apply              # Apply coupon

// Certificates & Achievements
GET    /api/certificates               # My certificates
GET    /api/certificates/:id/verify    # Verify certificate
GET    /api/achievements               # My achievements
GET    /api/learning-paths             # Available learning paths
POST   /api/learning-paths/:id/enroll  # Enroll in learning path
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### Drizzle ORM Schema Example

```typescript
// schema/course.ts
import { pgTable, serial, varchar, text, timestamp, integer, decimal, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './user'
import { categories } from './category'

export const courseStatusEnum = pgEnum('course_status', ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED'])
export const courseLevelEnum = pgEnum('course_level', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'])

export const courses = pgTable('Course', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  subtitle: varchar('subtitle', { length: 1000 }),
  description: text('description'),
  instructorId: integer('instructor_id').references(() => users.id),
  categoryId: integer('category_id').references(() => categories.id),
  level: courseLevelEnum('level').default('BEGINNER'),
  price: decimal('price', { precision: 10, scale: 2 }).default('0'),
  discountPrice: decimal('discount_price', { precision: 10, scale: 2 }),
  thumbnail: varchar('thumbnail', { length: 1000 }),
  previewVideo: varchar('preview_video', { length: 1000 }),
  status: courseStatusEnum('status').default('DRAFT'),
  durationMinutes: integer('duration_minutes').default(0),
  enrollmentCount: integer('enrollment_count').default(0),
  ratingAverage: decimal('rating_average', { precision: 3, scale: 2 }).default('0'),
  ratingCount: integer('rating_count').default(0),
  isFree: boolean('is_free').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  publishedAt: timestamp('published_at'),
  deletedAt: timestamp('deleted_at'),
})

export const courseRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  sections: many(courseSections),
  enrollments: many(enrollments),
  reviews: many(courseReviews),
}))
```

### Service Layer Example (CQRS Pattern)

```typescript
// course/commands/create-course.command.ts
export class CreateCourseCommand {
  constructor(
    public readonly instructorId: number,
    public readonly title: string,
    public readonly description: string,
    public readonly categoryId: number,
    public readonly level: CourseLevel,
    public readonly price: number,
  ) {}
}

@Injectable()
export class CreateCourseHandler implements ICommandHandler<CreateCourseCommand> {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateCourseCommand): Promise<Course> {
    // Validate instructor permissions
    // Create course entity
    // Save to database
    // Publish domain event
    // Return result
  }
}
```

---

## 📝 BEST PRACTICES

### 1. Code Organization

- **Domain-Driven Design**: Tổ chức code theo business domain
- **CQRS Pattern**: Tách biệt read và write operations
- **Repository Pattern**: Abstraction layer cho data access
- **Event-Driven Architecture**: Loose coupling between modules

### 2. Database Design

- **Soft Delete**: Sử dụng `deletedAt` cho tất cả entities quan trọng
- **Audit Trail**: Track `createdBy`, `updatedBy`, `deletedBy`
- **Indexing Strategy**: Optimize cho các queries thường dùng
- **Partitioning**: Cho các bảng có data lớn (analytics)

### 3. Performance Optimization

- **Caching**: Redis cho session, course data, user profiles
- **CDN**: Cho video và static assets
- **Lazy Loading**: Cho course content
- **Background Jobs**: Cho video processing, email sending

### 4. Security

- **JWT Authentication**: Với refresh token rotation
- **Role-Based Access Control**: Fine-grained permissions
- **Input Validation**: Zod schemas cho tất cả inputs
- **Rate Limiting**: Protect APIs khỏi abuse

### 5. Testing Strategy

- **Unit Tests**: Service layer business logic
- **Integration Tests**: Database operations
- **E2E Tests**: Critical user journeys
- **Performance Tests**: Load testing cho video streaming

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   NestJS API    │────│   PostgreSQL    │
│    (nginx)      │    │    Cluster      │    │    Primary      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Cache   │    │   File Storage  │
                       │    Cluster      │    │   (AWS S3/MinIO) │
                       └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Video CDN     │    │   Email Service │
                       │  (Cloudflare)   │    │    (Resend)     │
                       └─────────────────┘    └─────────────────┘
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Environment Configuration

```typescript
// config/app.config.ts
export const appConfig = {
  port: parseInt(process.env.PORT || '3000'),
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
  payment: {
    vnpay: {
      tmnCode: process.env.VNPAY_TMN_CODE,
      hashSecret: process.env.VNPAY_HASH_SECRET,
    },
    stripe: {
      publicKey: process.env.STRIPE_PUBLIC_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
    },
  },
}
```

---

## 📊 SUCCESS METRICS

### Technical KPIs

- **API Response Time**: < 200ms cho 95% requests
- **Database Query Time**: < 50ms cho 90% queries
- **Video Loading Time**: < 3s cho 1080p content
- **Uptime**: 99.9% availability
- **Error Rate**: < 0.1% for critical endpoints

### Business KPIs

- **Course Completion Rate**: > 60%
- **Student Retention**: > 70% monthly retention
- **Instructor Satisfaction**: > 4.5/5 rating
- **Revenue Growth**: 20% monthly growth
- **Customer Support**: < 2h response time

---

## 🎯 KẾT LUẬN

Hệ thống E-Learning này được thiết kế với kiến trúc scalable, maintainable và performance-optimized. Mỗi phase được chia nhỏ để dễ dàng develop và test. Sử dụng patterns và best practices từ codebase hiện tại để đảm bảo consistency và quality.

**Timeline tổng cộng**: 32 tuần (8 tháng)
**Effort estimate**: 2-3 developers full-time
**Budget estimate**: Depending on team size và infrastructure costs

Hệ thống này có thể scale để phục vụ hàng triệu students và instructors, với architecture linh hoạt để thêm features mới trong tương lai.
