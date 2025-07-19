# Khóa học NestJS Super - API Ecommerce toàn diện nhất hiện tại

---

## 🎯 **Bài 43: Tích hợp ZodValidation và Serialization**

### **Mục tiêu**

Tùy chỉnh ZodValidation và thêm Serialization cho output

### **Yêu cầu kỹ thuật**

#### **1. Custom ZodValidation**

- 📋 **Nhiệm vụ:** Tạo riêng file custom ValidationPipe
- 🎯 **Mục tiêu:** Trả về mã lỗi `422` cho validation errors
- 🔧 **Thực hiện:** Chuyển array lỗi của Zod thành string

#### **2. ZodSerializationInterceptor**

- 📋 **Nhiệm vụ:** Thêm output validation
- 🎯 **Mục tiêu:** Lược bỏ những field không cần thiết (như password)
- ✅ **Kết quả:** Serialization thành công khi không trả về password

#### **3. Strict Mode trong Zod**

- ⚠️ **Lưu ý với strict():**
  - **Có strict():** Dữ liệu gửi từ user có dư field sẽ gây lỗi
  - **Không strict():** Dữ liệu dư sẽ được bỏ qua không gây lỗi
  - **Cân nhắc:** Cần cân nhắc kỹ khi sử dụng `strict()`

#### **4. Exception Handling**

- 🛠️ **Giải pháp:** Tạo `exceptionFilter` để xử lý lỗi Serialization output
- 📊 **Mục đích:** Xem cụ thể lỗi gì khi kết quả trả về bị lỗi

---

## 🎯 **Bài 44: Hạn chế Try-Catch với CatchEverythingFilter**

### **Giải pháp tối ưu**

- 🔧 **Công cụ:** Sử dụng built-in `CatchEverythingFilter` của NestJS
- 💡 **Lợi ích:** Giảm thiểu việc sử dụng try-catch thủ công
- ✨ **Kết quả:** Code sạch hơn, xử lý lỗi tập trung

---

## 🎯 **Bài 45: Áp dụng Repository Pattern**

### **Kết quả**

✅ **Trạng thái:** Đã hoàn thành việc áp dụng Repository Pattern vào dự án

### **Lợi ích**

- 🔄 **Tách biệt:** Logic business và data access
- 🧪 **Testing:** Dễ dàng mock data cho unit test
- 🔧 **Bảo trì:** Code dễ maintain và mở rộng

---

## 🎯 **Bài 46: Phân tích flow OTP code và khai báo endpoint**

### **Mục tiêu**

Phân tích và triển khai flow OTP code cho hệ thống

### **Chiến lược chống spam**

🛡️ **Bảo vệ hệ thống:**

- **Vấn đề:** Người dùng spam email giả hoặc tài khoản không đúng
- **Giải pháp:** Xác thực email trước khi đăng ký để tiết kiệm tài nguyên

### **Flow OTP Design**

```
1. User nhập email → Kiểm tra email hợp lệ
2. Gửi OTP code qua email → User nhận mã
3. User nhập OTP code → Xác thực mã
4. Cho phép đăng ký → Hoàn tất quy trình
```

### **VerificationCode Schema Analysis**

#### **Cấu trúc dữ liệu:**

- `email`: Email người dùng
- `code`: Mã OTP (6 số)
- `type`: Loại OTP (REGISTER, FORGOT_PASSWORD)
- `expiresAt`: Thời gian hết hạn
- `createdAt`: Thời gian tạo

#### **Cấu hình thời gian:**

```typescript
// Environment variable
OTP_EXPIRES_IN=5m  // 5 phút

// Sử dụng thư viện 'ms' để convert
const expiresIn = ms(process.env.OTP_EXPIRES_IN); // Convert string → milliseconds
```

### **API Endpoint Design**

#### **Thiết kế tối ưu:**

❌ **Không nên:**

```
POST /auth/sendOtpRegister
POST /auth/sendOtpForgotPassword
```

✅ **Nên sử dụng:**

```
POST /auth/otp
Body: {
  "email": "user@example.com",
  "type": "REGISTER" | "FORGOT_PASSWORD"
}
```

### **Logic xử lý:**

```typescript
if (type === 'REGISTER') {
  // Kiểm tra email đã tồn tại chưa
  if (emailExists) {
    throw new ConflictException('Email đã tồn tại')
  }
  // Gửi OTP
} else if (type === 'FORGOT_PASSWORD') {
  // Xử lý quên mật khẩu
}
```

### **Shared Module Strategy**

🏗️ **Kiến trúc:**

- **findUserByEmail:** Đặt trong SharedModule (dùng chung nhiều nơi)
- **Nguyên tắc:** SharedModule chỉ import dependencies của chính nó
- **Lợi ích:** Tránh circular dependency, dễ maintain

---

## 🎯 **Bài 47: Code logic tạo OTP khi đăng ký**

### **Implementation Details**

#### **Error Handling Strategy**

- 🎯 **Mục tiêu:** Sử dụng `UnprocessableEntity` thay vì `ConflictException`
- 📋 **Lý do:** Chỉ rõ field nào bị lỗi trong quá trình gửi OTP
- 🔄 **Tương lai:** Gom các lỗi chung để tái sử dụng

#### **Repository Organization**

- 📁 **Quyết định:** Đưa `VerificationCodeRepo` vào `AuthRepo`
- 🎯 **Lý do:** Chỉ thực hiện vài thao tác cơ bản (create, delete)
- ⚡ **Lợi ích:** Giảm complexity, code gọn gàng hơn

#### **Logic cập nhật OTP**

```typescript
// Khi người dùng nhấn "Gửi lại mã"
// → Cập nhật code cũ thay vì tạo mới
// → Code cũ bị vô hiệu hóa
await updateVerificationCode({
  email,
  type,
  newCode: generateNewOTP(),
  expiresAt: new Date(Date.now() + OTP_EXPIRES_IN),
})
```

### **Kết quả**

✅ **Hoàn thành:** Logic đăng ký OTP  
⏳ **Tiếp theo:** Logic verify OTP (bài sau)

---

## 🎯 **Bài 48: Cập nhật xác thực OTP cho chức năng đăng ký**

### **Mục tiêu**

Thêm tính năng verify OTP code cho API register

### **Database Query Optimization**

#### **Index Strategy:**

```prisma
// Composite Index để query nhanh
@@index([code, email, type])
```

#### **Query Logic:**

```typescript
// Phải tìm theo cụm index để tận dụng performance
const verification = await findVerificationCode({
  code,
  email,
  type,
  expiresAt: { gt: new Date() }, // Chưa hết hạn
})
```

### **Validation Process**

1. **Tìm kiếm:** Query theo composite index `(code, email, type)`
2. **Kiểm tra hạn:** `expiresAt > now()`
3. **Xác thực:** Code có đúng không
4. **Cleanup:** Xóa code sau khi verify thành công

### **Kết quả**

✅ **Hoàn thành:** Xác thực VerificationCode khi đăng ký thành công

---

## 🎯 **Bài 49: Gửi OTP đến email bằng Resend**

### **Mục tiêu**

Tích hợp service gửi email với Resend

### **Setup Resend**

```typescript
// Environment
RESEND_API_KEY = your_api_key_here

// Service Implementation
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
```

### **Email Template**

- 📧 **Sender:** your-app@domain.com
- 🎯 **Subject:** "Mã xác thực OTP"
- 📝 **Content:** HTML template với mã OTP

---

## 🎯 **Bài 50: Xác thực domain trên Resend**

### **Domain Verification**

- 🌐 **Mục tiêu:** Xác thực domain để gửi email từ domain riêng
- 🔧 **Quy trình:** Thêm DNS records theo hướng dẫn Resend
- ✅ **Kết quả:** Có thể gửi email từ địa chỉ chuyên nghiệp

---

## 🎯 **Bài 51: Gửi email bằng template HTML**

### **HTML Template Strategy**

- 📄 **Format:** Sử dụng HTML template cho email đẹp mắt
- 🎨 **Design:** Responsive, professional looking
- 🔧 **Variables:** Dynamic content với OTP code

---

## 🎯 **Bài 52: Giới thiệu về React email**

### **React Email Overview**

- ⚛️ **Technology:** React-based email template system
- 💡 **Lợi ích:** Component-based, reusable, maintainable
- 🛠️ **So sánh:** Tốt hơn Handlebars template

---

## 🎯 **Bài 53: Sử dụng React email làm email template**

### **Implementation**

#### **Setup React Email:**

```bash
npm install react-email
npm install @react-email/components
```

#### **Template Component:**

```tsx
// emails/otp.tsx
import { Html, Head, Body, Container, Text } from '@react-email/components'

export default function OTPEmail({ code }: { code: string }) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Mã OTP của bạn là: {code}</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

#### **Integration với Resend:**

```typescript
import { render } from '@react-email/render'
import OTPEmail from '../emails/otp'

// Render component thành HTML string
const htmlContent = render(OTPEmail({ code: otpCode }))

// Hoặc truyền trực tiếp component (Resend hỗ trợ)
await resend.emails.send({
  from: 'sender@domain.com',
  to: userEmail,
  subject: 'Mã xác thực OTP',
  react: OTPEmail({ code: otpCode }),
})
```

### **Lợi ích**

- ⚡ **Tiện lợi:** Chỉnh sửa template dễ dàng trong JSX
- 🔄 **Reusable:** Component có thể tái sử dụng
- 🎨 **Professional:** Email đẹp mắt, responsive

### **Kết quả**

✅ **Hoàn thành:** Sử dụng React Email để gửi email thành công

---

## 🎯 **Bài 54: Tư duy về thiết kế Authentication và Authorization**

### **Authentication Flow Design**

#### **RefreshToken Flow:**

```
1. Client gửi RefreshToken → Server
2. Server validate RT → Kiểm tra hợp lệ
3. Nếu hợp lệ → Cập nhật Device info:
   - userAgent
   - ip
   - lastActive
   - isActive = true
4. Trả về AccessToken mới
```

#### **Database Load Optimization:**

- 🎯 **Chiến lược:** Chấp nhận không logout thiết bị ngay lập tức
- 💡 **Lý do:** Giảm gánh nặng database
- ⚖️ **Trade-off:** Performance vs Real-time logout

#### **Security Considerations:**

- 🔐 **Device tracking:** Theo dõi thiết bị đăng nhập
- 📍 **IP monitoring:** Phát hiện đăng nhập bất thường
- ⏰ **Session management:** Quản lý phiên làm việc hiệu quả

---

## 🎯 **Bài 55: Thêm model Device và hướng dẫn migrate**

### **Device Model Design**

#### **Schema Structure:**

```prisma
model Device {
  id          String   @id @default(cuid())
  userId      String
  deviceId    String   @unique
  userAgent   String?
  ip          String?
  lastActive  DateTime
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  user        User     @relation(fields: [userId], references: [id])

  @@map("devices")
}
```

#### **Migration Impact:**

- ✅ **Thêm table mới:** Không ảnh hưởng migration
- ⚠️ **Scalar types:** Chỉ ảnh hưởng khi thêm/sửa columns
- 🔧 **Best practice:** Chỉ lo lắng khi xóa/cập nhật table existing

### **Key Points:**

- 📊 **Tracking:** Theo dõi thiết bị người dùng
- 🔄 **Session:** Quản lý phiên đăng nhập
- 🛡️ **Security:** Phát hiện đăng nhập bất thường
