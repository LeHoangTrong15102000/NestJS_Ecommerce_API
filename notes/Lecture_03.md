# Khóa học NestJS Super - API Ecommerce toàn diện nhất hiện tại

---

## 📚 **Chương 5: Chức năng User Authentication**

### 🎯 **Bài 66: Tạo Route Google Callback hoàn thiện chức năng Google Login**

#### **Mục tiêu**

Hoàn thiện flow đăng nhập Google bằng cách xử lý callback từ Google

#### **Route Implementation**

**Endpoint:** `GET /auth/google/callback`

```typescript
@Get('google/callback')
@IsPublic()
async googleCallback(
  @Query('code') code: string,
  @Query('state') state: string,
  @Res() response: Response
) {
  try {
    // 1. Decode state để lấy thông tin client ban đầu
    const clientInfo = this.decodeState(state);

    // 2. Exchange authorization code for tokens
    const googleUser = await this.googleService.getUserInfo(code);

    // 3. Xử lý login/register user
    const result = await this.authService.googleLogin(
      googleUser,
      clientInfo.ip,
      clientInfo.userAgent
    );

    // 4. Redirect về frontend với tokens
    return response.redirect(
      `${process.env.FRONTEND_URL}/auth/oauth-google-callback?` +
      `accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`
    );
  } catch (error) {
    // Redirect về frontend với error
    return response.redirect(
      `${process.env.FRONTEND_URL}/auth/oauth-google-callback?error=${error.message}`
    );
  }
}
```

#### **State Decoding với Error Handling**

```typescript
private decodeState(state: string): { ip: string; userAgent: string } {
  try {
    // Decode base64 state
    const decoded = Buffer.from(state, 'base64').toString();
    return JSON.parse(decoded);
  } catch (error) {
    // Handle corrupted or invalid state
    throw new BadRequestException('Invalid state parameter');
  }
}
```

**⚠️ Lý do cần try-catch:**

- URL có thể bị thay đổi trong quá trình truyền tải
- Base64 string có thể thiếu/dư ký tự
- JSON.parse có thể fail với invalid format
- Bảo vệ ứng dụng khỏi crash

#### **Google User Registration Logic**

```typescript
async googleLogin(
  googleUser: GoogleUserInfo,
  ip: string,
  userAgent: string
): Promise<LoginResult> {

  // 1. Tìm user existing bằng email
  let user = await this.findUserByEmail(googleUser.email);

  if (!user) {
    // 2. Tạo user mới cho Google login
    user = await this.createUserFromGoogle({
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      emailVerified: true, // Google đã verify email
      roleId: this.getClientRoleId(), // Auto assign CLIENT role
    });
  }

  // 3. Generate tokens và update device info
  return this.generateLoginResponse(user, ip, userAgent);
}
```

**💡 Lưu ý quan trọng:**

- Tài khoản Google đã được verify email → Bỏ qua bước xác thực OTP
- Auto assign role CLIENT cho user đăng ký qua Google
- Cần tạo method `createUserFromGoogle` include role information

---

### 🎯 **Bài 67: Publish Production Google Cloud Console**

#### **Mục tiêu**

Cấu hình Google Cloud Console cho môi trường production

#### **Production Configuration Steps**

**1. OAuth Consent Screen:**

- ✅ Verify domain ownership
- ✅ Add production logo và privacy policy
- ✅ Update authorized domains
- ✅ Submit for verification (nếu cần)

**2. Credentials Update:**

```bash
# Production Environment Variables
GOOGLE_CLIENT_ID=production_client_id
GOOGLE_CLIENT_SECRET=production_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
FRONTEND_URL=https://yourdomain.com
```

**3. Authorized Redirect URIs:**

```
Production: https://yourdomain.com/auth/google/callback
Staging: https://staging.yourdomain.com/auth/google/callback
Development: http://localhost:3000/auth/google/callback
```

#### **Kết quả**

✅ **Hoàn thành:** Google Cloud Console đã được publish cho production

---

### 🎯 **Bài 68: Refactor Error và vấn đề về đa ngôn ngữ**

#### **Mục tiêu**

Refactor cách xử lý lỗi và implement đa ngôn ngữ

#### **Chiến lược Error Handling**

**Trước khi refactor:**

```typescript
// Trả về message cố định
throw new BadRequestException('Email already exists')
```

**Sau khi refactor:**

```typescript
// Trả về error key cho đa ngôn ngữ
throw new BadRequestException('ERROR.EMAIL_ALREADY_EXISTS')
```

#### **2 Phương pháp Đa ngôn ngữ**

**1. Server-side Translation:**

```typescript
// Client gửi header Accept-Language
@Get('users')
async getUsers(@Headers('accept-language') lang: string) {
  const message = this.i18n.t('user.welcome', { lang });
  return { message, data: users };
}
```

**2. Client-side Translation (Recommended):**

```typescript
// Server trả về error key
return {
  success: false,
  error: {
    code: 'EMAIL_ALREADY_EXISTS',
    key: 'error.email_already_exists',
    field: 'email',
  },
}
```

**Frontend xử lý:**

```typescript
// Client dựa vào language hiện tại để render
const errorMessage = i18n.t(error.key)
// Tiếng Việt: "Email đã tồn tại"
// English: "Email already exists"
```

#### **Error Key Structure**

**File: `src/i18n/en/error.json`**

```json
{
  "email_already_exists": "Email already exists",
  "invalid_credentials": "Invalid email or password",
  "otp_expired": "OTP code has expired",
  "permission_denied": "You don't have permission to perform this action"
}
```

**File: `src/i18n/vi/error.json`**

```json
{
  "email_already_exists": "Email đã tồn tại",
  "invalid_credentials": "Email hoặc mật khẩu không đúng",
  "otp_expired": "Mã OTP đã hết hạn",
  "permission_denied": "Bạn không có quyền thực hiện hành động này"
}
```

#### **Lợi ích phương pháp Client-side:**

- ✅ **Performance:** Server không cần xử lý translation
- ✅ **Flexibility:** Client tự quyết định ngôn ngữ
- ✅ **Caching:** Error messages có thể cache ở client
- ✅ **Offline:** Hoạt động khi mất kết nối

---

### 🎯 **Bài 69: Fix bug truyền sai RoleName khi tạo token**

#### **Bug Description**

Khi tạo RefreshToken, roleName bị truyền sai giá trị

#### **Root Cause Analysis**

```typescript
// Bug: Truyền sai tham số
const payload = {
  userId: user.id,
  roleId: user.roleId,
  roleName: user.roleId, // ❌ Sai: đang truyền roleId thay vì roleName
}
```

#### **Fix Implementation**

```typescript
// Fix: Truyền đúng roleName
const payload = {
  userId: user.id,
  roleId: user.roleId,
  roleName: user.role.name, // ✅ Đúng: truyền roleName từ relation
}
```

#### **Prevention Strategy**

```typescript
// Sử dụng TypeScript interface để tránh lỗi
interface TokenPayload {
  userId: string
  roleId: string
  roleName: string // Explicitly define type
}

// Validation trong runtime
const validatePayload = (payload: TokenPayload) => {
  if (typeof payload.roleName !== 'string') {
    throw new Error('roleName must be string')
  }
  if (payload.roleName === payload.roleId) {
    throw new Error('roleName should not equal roleId')
  }
}
```

#### **Kết quả**

✅ **Hoàn thành:** Fixed bug truyền sai roleName trong token payload

---

### 🎯 **Bài 70: Chức năng quên mật khẩu**

#### **Mục tiêu**

Xây dựng flow reset password hoàn chỉnh

#### **Forgot Password Flow**

```
1. User nhập email → Send OTP
2. User nhập OTP + new password → Verify & Reset
3. System confirm → Password updated
```

#### **API Design**

**1. Request Password Reset:**

```typescript
@Post('forgot-password')
@IsPublic()
async forgotPassword(@Body() body: ForgotPasswordDTO) {
  const { email } = body;

  // 1. Kiểm tra email tồn tại
  const user = await this.findUserByEmail(email);
  if (!user) {
    throw new NotFoundException('EMAIL_NOT_FOUND');
  }

  // 2. Generate và gửi OTP
  await this.sendOTP(email, 'FORGOT_PASSWORD');

  return {
    success: true,
    message: 'OTP_SENT_TO_EMAIL'
  };
}
```

**2. Reset Password:**

```typescript
@Post('reset-password')
@IsPublic()
async resetPassword(@Body() body: ResetPasswordDTO) {
  const { email, code, newPassword } = body;

  // 1. Verify OTP code
  await this.verifyOTP(email, code, 'FORGOT_PASSWORD');

  // 2. Update password
  const hashedPassword = await this.hashingService.hash(newPassword);
  await this.updateUserPassword(email, hashedPassword);

  // 3. Cleanup: Xóa OTP đã sử dụng
  await this.deleteUsedOTP(email, 'FORGOT_PASSWORD');

  return {
    success: true,
    message: 'PASSWORD_RESET_SUCCESS'
  };
}
```

#### **Shared OTP Verification Method**

```typescript
// Tạo method dùng chung cho cả Register và ForgotPassword
async verifyOTP(
  email: string,
  code: string,
  type: 'REGISTER' | 'FORGOT_PASSWORD'
): Promise<void> {
  const verification = await this.findVerificationCode({
    email,
    code,
    type,
    expiresAt: { gt: new Date() } // Chưa hết hạn
  });

  if (!verification) {
    throw new BadRequestException('INVALID_OR_EXPIRED_OTP');
  }
}
```

#### **sendOTP Method Enhancement**

```typescript
// Cập nhật method sendOTP để xử lý cả 2 cases
async sendOTP(email: string, type: 'REGISTER' | 'FORGOT_PASSWORD') {
  if (type === 'REGISTER') {
    // Kiểm tra email chưa tồn tại
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }
  } else if (type === 'FORGOT_PASSWORD') {
    // Kiểm tra email phải tồn tại
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException('EMAIL_NOT_FOUND');
    }
  }

  // Generate và gửi OTP
  const code = this.generateOTPCode();
  await this.saveVerificationCode({ email, code, type });
  await this.emailService.sendOTP(email, code, type);
}
```

#### **Security Enhancements**

- 🔒 **Rate Limiting:** Giới hạn số lần request OTP
- ⏰ **OTP Expiration:** 5 phút cho forgot password
- 🧹 **Cleanup:** Tự động xóa OTP cũ khi tạo mới
- 📧 **Email Template:** Khác nhau cho Register vs ForgotPassword

---

### 🎯 **Bài 71: Phân tích chức năng 2FA**

#### **Mục tiêu**

Thiết kế và phân tích hệ thống Two-Factor Authentication

#### **2FA Overview**

**Time-based One-Time Password (TOTP):**

- 📱 **Authenticator Apps:** Google Authenticator, Authy, Microsoft Authenticator
- ⏱️ **Time-based:** Mã thay đổi mỗi 30 giây
- 🔑 **Secret-based:** Dựa vào shared secret (base32 format)

#### **TOTP Algorithm Components**

**Core Parameters:**

```typescript
const totpConfig = {
  secret: 'base32_encoded_secret', // Quan trọng nhất
  algorithm: 'SHA1', // Thuật toán hash
  digits: 6, // Số chữ số (thường là 6)
  period: 30, // Chu kỳ thay đổi (30 giây)
  label: 'YourApp:user@email.com', // Label hiển thị
  issuer: 'YourApp', // Tên ứng dụng
}
```

**Thư viện sử dụng:**

```bash
npm install otpauth
```

#### **API Design**

**1. Setup 2FA:**

```typescript
@Post('2fa/setup')
@UseGuards(AccessTokenGuard)
async setup2FA(@ActiveUser() user: ActiveUserData) {
  // 1. Generate secret key
  const secret = generateBase32Secret();

  // 2. Create TOTP instance
  const totp = new TOTP({
    secret,
    label: `YourApp:${user.email}`,
    issuer: 'YourApp'
  });

  // 3. Generate QR Code URI
  const uri = totp.toString();

  // 4. Save secret (temporary, chưa enable)
  await this.saveTempSecret(user.id, secret);

  return {
    uri,           // Để tạo QR code
    secret,        // Backup key cho user
    setupComplete: false
  };
}
```

**2. Disable 2FA:**

```typescript
@Post('2fa/disable')
@UseGuards(AccessTokenGuard)
async disable2FA(
  @ActiveUser() user: ActiveUserData,
  @Body() body: Disable2FADTO
) {
  const { totpCode, code } = body;

  // Validate: Chỉ được truyền 1 trong 2
  if ((totpCode && code) || (!totpCode && !code)) {
    throw new BadRequestException('PROVIDE_EITHER_TOTP_OR_OTP');
  }

  if (totpCode) {
    // Verify TOTP code
    await this.verify2FACode(user.id, totpCode);
  } else {
    // Verify OTP from email
    await this.verifyOTP(user.email, code, 'DISABLE_2FA');
  }

  // Remove totpSecret from user
  await this.removeUserTOTPSecret(user.id);

  return { success: true, message: '2FA_DISABLED' };
}
```

#### **Login Flow với 2FA**

```typescript
@Post('login')
@IsPublic()
async login(@Body() body: LoginWithOTPDTO) {
  const { email, password, totpCode, otpCode } = body;

  // 1. Validate credentials
  const user = await this.validateCredentials(email, password);

  // 2. Check if 2FA enabled
  if (user.totpSecret) {
    // User has 2FA enabled
    if (!totpCode && !otpCode) {
      throw new BadRequestException('2FA_CODE_REQUIRED');
    }

    if (totpCode) {
      await this.verify2FACode(user.id, totpCode);
    } else if (otpCode) {
      await this.verifyOTP(email, otpCode, 'LOGIN_BACKUP');
    }
  }

  // 3. Generate login tokens
  return this.generateLoginResponse(user);
}
```

#### **Backup Strategy**

**OTP Backup cho 2FA:**

- 🔑 **Khi nào cần:** User mất điện thoại/app authenticator
- 📧 **Phương thức:** Gửi OTP qua email như backup
- ⚠️ **Security trade-off:** Giảm security nhưng tăng usability

**Implementation:**

```typescript
// User có thể dùng OTP email thay cho TOTP
if (!totpCode) {
  // Generate OTP và gửi email
  await this.sendOTP(email, 'LOGIN_BACKUP')
  throw new AcceptableException('OTP_SENT_FOR_BACKUP_LOGIN')
}
```

---

### 🎯 **Bài 72: Cập nhật Schema Model DTO cho chức năng 2FA**

#### **Mục tiêu**

Cập nhật database schema và DTOs cho 2FA functionality

#### **Database Schema Updates**

**User Model Enhancement:**

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?
  totpSecret    String?   // Base32 encoded secret cho 2FA
  // ... other fields

  @@map("users")
}
```

**VerificationCode Model Updates:**

```prisma
model VerificationCode {
  id        String                    @id @default(cuid())
  email     String                    // Không thể unique vì có nhiều type
  code      String
  type      VerificationCodeType
  expiresAt DateTime
  createdAt DateTime                  @default(now())

  @@unique([email, type]) // Unique combination
  @@map("verification_codes")
}

enum VerificationCodeType {
  REGISTER
  FORGOT_PASSWORD
  DISABLE_2FA
  LOGIN_BACKUP
}
```

#### **DTO Definitions**

**Setup 2FA DTO:**

```typescript
// Request không cần body (lấy user từ token)
export class Setup2FADTO {
  // Empty body - user info từ @ActiveUser()
}

// Response
export interface Setup2FAResponse {
  uri: string // QR code URI
  secret: string // Backup secret key
  setupComplete: boolean
}
```

**Disable 2FA DTO:**

```typescript
export class Disable2FADTO {
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string // 6-digit TOTP code

  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string // 6-digit OTP from email

  // Custom validation: exactly one must be provided
  @ValidateIf((o) => !o.totpCode && !o.code)
  @IsNotEmpty({ message: 'Either totpCode or code must be provided' })
  _validator?: any
}
```

**Login với 2FA DTO:**

```typescript
export class LoginWith2FADTO extends LoginBodyDTO {
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string // TOTP from authenticator app

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpCode?: string // OTP from email backup
}
```

#### **Validation Rules**

**Disable 2FA Validation:**

```typescript
// Custom validator để đảm bảo chỉ truyền 1 trong 2
export function ValidateEitherTotpOrOtp(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validateEitherTotpOrOtp',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any
          const { totpCode, code } = obj

          // Exactly one must be provided
          return (totpCode && !code) || (!totpCode && code)
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either totpCode or code must be provided, but not both'
        },
      },
    })
  }
}
```

#### **Key Design Decisions**

**1. VerificationCode không unique email:**

- **Lý do:** Cùng email có thể có nhiều type khác nhau
- **Giải pháp:** Unique combination `[email, type]`

**2. User.totpSecret nullable:**

- **null:** User chưa enable 2FA
- **string:** User đã enable 2FA với secret key

**3. Empty request body cho Setup:**

- **Lý do:** Chỉ cần user info từ AccessToken
- **Benefits:** Đơn giản, secure

---

### 🎯 **Bài 73: Tạo mã 2FA**

#### **Mục tiêu**

Implement tính năng tạo và setup 2FA cho user

#### **Implementation**

**1. Setup TOTP Service:**

```typescript
import { TOTP } from 'otpauth'

@Injectable()
export class TwoFactorService {
  generateSecret(): string {
    // Generate random base32 secret
    return TOTP.generateSecret()
  }

  createTOTP(secret: string, email: string): TOTP {
    return new TOTP({
      secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      label: `YourApp:${email}`,
      issuer: 'YourApp',
    })
  }

  generateQRCodeURI(secret: string, email: string): string {
    const totp = this.createTOTP(secret, email)
    return totp.toString() // URI format for QR code
  }

  verifyToken(secret: string, token: string): boolean {
    const totp = this.createTOTP(secret, '') // Email not needed for verification
    return totp.validate({ token, window: 1 }) !== null
  }
}
```

**2. Setup 2FA Controller:**

```typescript
@Post('2fa/setup')
@UseGuards(AccessTokenGuard)
async setup2FA(@ActiveUser() user: ActiveUserData) {
  // 1. Check if user already has 2FA enabled
  const currentUser = await this.userService.findById(user.userId);
  if (currentUser.totpSecret) {
    throw new ConflictException('2FA_ALREADY_ENABLED');
  }

  // 2. Generate new secret
  const secret = this.twoFactorService.generateSecret();

  // 3. Create QR code URI
  const uri = this.twoFactorService.generateQRCodeURI(secret, currentUser.email);

  // 4. Temporarily save secret (not activated yet)
  await this.userService.updateTempTOTPSecret(user.userId, secret);

  return {
    uri,
    secret,
    setupComplete: false,
    message: 'Scan QR code with authenticator app and verify with a code'
  };
}
```

**3. Verify và Activate 2FA:**

```typescript
@Post('2fa/verify-setup')
@UseGuards(AccessTokenGuard)
async verifySetup(
  @ActiveUser() user: ActiveUserData,
  @Body() body: { totpCode: string }
) {
  // 1. Get temp secret
  const currentUser = await this.userService.findById(user.userId);
  const tempSecret = currentUser.tempTotpSecret;

  if (!tempSecret) {
    throw new BadRequestException('NO_SETUP_IN_PROGRESS');
  }

  // 2. Verify TOTP code
  const isValid = this.twoFactorService.verifyToken(tempSecret, body.totpCode);
  if (!isValid) {
    throw new BadRequestException('INVALID_2FA_CODE');
  }

  // 3. Activate 2FA
  await this.userService.activateTOTP(user.userId, tempSecret);

  return {
    success: true,
    message: '2FA_ENABLED_SUCCESSFULLY'
  };
}
```

#### **Database Updates**

**Temporary Secret Storage:**

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  totpSecret      String?   // Activated 2FA secret
  tempTotpSecret  String?   // Temporary secret during setup
  // ... other fields
}
```

**Service Methods:**

```typescript
// User Service
async updateTempTOTPSecret(userId: string, secret: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { tempTotpSecret: secret }
  });
}

async activateTOTP(userId: string, secret: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      tempTotpSecret: null // Clear temp secret
    }
  });
}
```

#### **Security Flow**

**Setup Process:**

```
1. User requests setup → Generate secret + QR
2. User scans QR → Add to authenticator app
3. User enters TOTP code → Verify code
4. If valid → Activate 2FA
5. If invalid → Keep temp secret, allow retry
```

**Security Benefits:**

- 🔐 **Two-step activation:** Đảm bảo user có thể generate code
- 🔄 **Retry capability:** Cho phép thử lại nếu setup fail
- 🧹 **Cleanup:** Xóa temp secret sau khi activate

---

### 🎯 **Bài 74: Cập nhật xác thực 2 lớp cho Login**

#### **Mục tiêu**

Tích hợp 2FA validation vào login flow

#### **Enhanced Login Flow**

```typescript
@Post('login')
@IsPublic()
async login(
  @Body() body: LoginWith2FADTO,
  @GetClientIp() ip: string,
  @GetUserAgent() userAgent: string
) {
  const { email, password, totpCode, otpCode } = body;

  // 1. Basic authentication
  const user = await this.authService.validateCredentials(email, password);

  // 2. Check 2FA requirement
  if (user.totpSecret) {
    // User has 2FA enabled - require additional verification
    await this.validate2FACode(user, totpCode, otpCode, email);
  }

  // 3. Complete login
  return this.authService.generateLoginTokens(user, ip, userAgent);
}

private async validate2FACode(
  user: User,
  totpCode?: string,
  otpCode?: string,
  email?: string
) {
  // Must provide exactly one verification method
  if ((!totpCode && !otpCode) || (totpCode && otpCode)) {
    throw new BadRequestException('PROVIDE_EITHER_TOTP_OR_OTP');
  }

  if (totpCode) {
    // Verify TOTP from authenticator app
    const isValid = this.twoFactorService.verifyToken(user.totpSecret, totpCode);
    if (!isValid) {
      throw new UnauthorizedException('INVALID_2FA_CODE');
    }
  } else if (otpCode) {
    // Verify OTP backup from email
    await this.verifyOTP(email, otpCode, 'LOGIN_BACKUP');
  }
}
```

#### **Backup OTP for 2FA**

**Request Backup OTP:**

```typescript
@Post('2fa/backup-code')
@IsPublic()
async requestBackupCode(@Body() body: { email: string }) {
  // 1. Verify user exists and has 2FA enabled
  const user = await this.userService.findByEmail(body.email);
  if (!user || !user.totpSecret) {
    throw new BadRequestException('2FA_NOT_ENABLED');
  }

  // 2. Generate and send backup OTP
  await this.sendOTP(body.email, 'LOGIN_BACKUP');

  return {
    success: true,
    message: 'BACKUP_CODE_SENT_TO_EMAIL'
  };
}
```

#### **Error Handling Strategy**

**2FA Specific Errors:**

```typescript
export const TwoFactorAuthErrors = {
  CODE_REQUIRED: '2FA_CODE_REQUIRED',
  INVALID_CODE: 'INVALID_2FA_CODE',
  NOT_ENABLED: '2FA_NOT_ENABLED',
  ALREADY_ENABLED: '2FA_ALREADY_ENABLED',
  BACKUP_CODE_SENT: 'BACKUP_CODE_SENT_TO_EMAIL',
} as const
```

**Frontend Handling:**

```typescript
// Frontend login logic
try {
  const result = await login({ email, password })
  // Success - redirect to dashboard
} catch (error) {
  if (error.code === '2FA_CODE_REQUIRED') {
    // Show 2FA input form
    setShow2FAForm(true)
  } else if (error.code === 'INVALID_2FA_CODE') {
    // Show error, allow retry
    setError('Invalid 2FA code')
  }
}
```

#### **Database Query Optimization**

**Include totpSecret in user lookup:**

```typescript
async validateCredentials(email: string, password: string): Promise<User> {
  const user = await this.userRepo.findByEmail(email, {
    include: {
      role: true // Also include role for token generation
    }
  });

  if (!user) {
    throw new UnauthorizedException('INVALID_CREDENTIALS');
  }

  const isPasswordValid = await this.hashingService.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('INVALID_CREDENTIALS');
  }

  return user; // Include totpSecret in response
}
```

#### **Security Enhancements**

**Rate Limiting for 2FA:**

```typescript
// Implement rate limiting cho 2FA attempts
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5 attempts per minute
@Post('login')
async login(...) {
  // Login logic
}
```

**Audit Logging:**

```typescript
// Log 2FA events for security monitoring
await this.auditService.log({
  userId: user.id,
  action: '2FA_LOGIN_ATTEMPT',
  success: isValid,
  ip,
  userAgent,
  timestamp: new Date(),
})
```

---

### 🎯 **Bài 75: Chức năng tắt mã 2FA**

#### **Mục tiêu**

Implement tính năng disable 2FA một cách an toàn

#### **Disable 2FA Implementation**

```typescript
@Post('2fa/disable')
@UseGuards(AccessTokenGuard)
async disable2FA(
  @ActiveUser() user: ActiveUserData,
  @Body() body: Disable2FADTO
) {
  const { totpCode, code } = body;

  // 1. Verify user has 2FA enabled
  const currentUser = await this.userService.findById(user.userId);
  if (!currentUser.totpSecret) {
    throw new BadRequestException('2FA_NOT_ENABLED');
  }

  // 2. Validate exactly one verification method
  if ((!totpCode && !code) || (totpCode && code)) {
    throw new BadRequestException('PROVIDE_EITHER_TOTP_OR_OTP');
  }

  // 3. Verify the provided code
  if (totpCode) {
    const isValid = this.twoFactorService.verifyToken(
      currentUser.totpSecret,
      totpCode
    );
    if (!isValid) {
      throw new UnauthorizedException('INVALID_2FA_CODE');
    }
  } else if (code) {
    await this.verifyOTP(currentUser.email, code, 'DISABLE_2FA');
  }

  // 4. Remove TOTP secret from user
  await this.userService.removeTOTPSecret(user.userId);

  // 5. Audit log
  await this.auditService.log({
    userId: user.userId,
    action: '2FA_DISABLED',
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });

  return {
    success: true,
    message: '2FA_DISABLED_SUCCESSFULLY'
  };
}
```

#### **Request Disable OTP**

```typescript
@Post('2fa/request-disable-code')
@UseGuards(AccessTokenGuard)
async requestDisableCode(@ActiveUser() user: ActiveUserData) {
  // 1. Verify user has 2FA enabled
  const currentUser = await this.userService.findById(user.userId);
  if (!currentUser.totpSecret) {
    throw new BadRequestException('2FA_NOT_ENABLED');
  }

  // 2. Send OTP for disable verification
  await this.sendOTP(currentUser.email, 'DISABLE_2FA');

  return {
    success: true,
    message: 'DISABLE_CODE_SENT_TO_EMAIL'
  };
}
```

#### **Database Service**

```typescript
// User Service method
async removeTOTPSecret(userId: string): Promise<void> {
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      tempTotpSecret: null // Also clear any temp secret
    }
  });
}
```

#### **Security Considerations**

**1. Double Verification:**

- Yêu cầu AccessToken (user đã đăng nhập)
- Yêu cầu TOTP code hoặc email OTP
- Không cho phép disable 2FA mà không xác thực

**2. Backup Method:**

```typescript
// Nếu user mất authenticator app
if (!totpCode) {
  // Gửi OTP qua email như phương án backup
  await this.sendOTP(currentUser.email, 'DISABLE_2FA')
  throw new AcceptableException({
    code: 'OTP_SENT_FOR_DISABLE',
    message: 'Check your email for disable code',
  })
}
```

**3. Audit Trail:**

```typescript
// Log tất cả disable 2FA events
const auditData = {
  userId: user.userId,
  action: '2FA_DISABLE_ATTEMPT',
  method: totpCode ? 'TOTP' : 'EMAIL_OTP',
  success: true,
  ip: getClientIp(request),
  userAgent: request.headers['user-agent'],
  timestamp: new Date(),
}
```

#### **Frontend Integration**

```typescript
// React component example
const Disable2FA = () => {
  const [method, setMethod] = useState('totp'); // 'totp' or 'email'
  const [code, setCode] = useState('');

  const handleDisable = async () => {
    try {
      if (method === 'email') {
        // First request OTP
        await requestDisableCode();
        setShowEmailInput(true);
      } else {
        // Use TOTP directly
        await disable2FA({ totpCode: code });
        setSuccess('2FA disabled successfully');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div>
      <h3>Disable Two-Factor Authentication</h3>

      <div>
        <label>
          <input
            type="radio"
            value="totp"
            checked={method === 'totp'}
            onChange={(e) => setMethod(e.target.value)}
          />
          Use Authenticator App
        </label>
        <label>
          <input
            type="radio"
            value="email"
            checked={method === 'email'}
            onChange={(e) => setMethod(e.target.value)}
          />
          Use Email Verification
        </label>
      </div>

      <input
        type="text"
        placeholder={method === 'totp' ? 'Enter 6-digit code' : 'Email code'}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <button onClick={handleDisable}>
        Disable 2FA
      </button>
    </div>
  );
};
```

#### **Kết quả**

✅ **Hoàn thành:** Chức năng disable 2FA an toàn  
🔐 **Bảo mật:** Double verification required  
📧 **Backup:** Email OTP khi mất authenticator app  
📊 **Audit:** Log tất cả disable events
