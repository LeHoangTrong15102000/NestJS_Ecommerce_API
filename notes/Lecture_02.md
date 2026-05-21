# Khóa học NestJS Super - API Ecommerce toàn diện nhất hiện tại

---

## 🎯 **Bài 56: Logic cơ bản chức năng Login [Login part 1]**

### **Mục tiêu**

Xây dựng logic cơ bản cho chức năng đăng nhập

### **Model Setup**

#### **LoginBodySchema Creation:**

```typescript
// Tạo model Login cho chức năng login
const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().optional(), // Sẽ được xử lý trong flow
})
```

#### **LoginBodyDTO:**

```typescript
export type LoginBodyDTO = z.infer<typeof LoginBodySchema>
```

### **Câu hỏi thiết kế quan trọng**

🤔 **Vấn đề:** Flow `Login` và `RefreshToken` sẽ lấy `deviceId` từ đâu?

**Các lựa chọn:**

1. **Client tự generate:** Frontend tạo deviceId và gửi lên
2. **Server generate:** Backend tạo deviceId dựa trên thông tin client
3. **Hybrid approach:** Kết hợp cả hai phương pháp

---

## 🎯 **Bài 57: Cách lấy IP và UserAgent của client [Login part 2]**

### **Mục tiêu**

Thu thập thông tin `IP` và `UserAgent` khi user đăng nhập

### **Implementation**

#### **1. Cài đặt thư viện:**

```bash
npm install request-ip
npm install @types/request-ip
```

#### **2. Tạo Decorator để lấy IP:**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import * as requestIp from 'request-ip'

export const GetClientIp = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest()
  return requestIp.getClientIp(request) || 'unknown'
})
```

#### **3. Tạo Decorator để lấy UserAgent:**

```typescript
export const GetUserAgent = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest()
  return request.headers['user-agent'] || 'unknown'
})
```

#### **4. Sử dụng trong Controller:**

```typescript
@Post('login')
async login(
  @Body() body: LoginBodyDTO,
  @GetClientIp() ip: string,
  @GetUserAgent() userAgent: string,
) {
  return this.authService.login(body, ip, userAgent);
}
```

### **⚠️ Lưu ý quan trọng**

🚀 **Production Deployment:**

- Khi deploy lên VPS/server, cần config thêm cho reverse proxy
- **Nginx:** Cần config `X-Real-IP` header
- **Load Balancer:** Cần config `X-Forwarded-For`

### **Example Nginx Configuration:**

```nginx
location / {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
}
```

---

## 🎯 **Bài 58: Một số cập nhật nhỏ**

### **Vấn đề Token Collision**

#### **Nguyên nhân:**

- 2 yêu cầu tạo token cùng lúc với cùng payload
- Có thể tạo ra token trùng nhau

#### **Giải pháp:**

```typescript
import { v4 as uuidv4 } from 'uuid'

// Thêm UUID vào payload để đảm bảo unique
const payload = {
  userId,
  roleId,
  roleName,
  jti: uuidv4(), // JSON Token Identifier
}
```

#### **Lưu ý:**

- `jti` không cần khai báo trong interface
- Chỉ dùng để đảm bảo tính unique của token
- Không sử dụng `jti` trong business logic

### **Model và Type Declarations**

#### **Mục tiêu:**

- 📋 Khai báo thêm Model và Type cho dự án
- ⚡ Tăng tốc độ development
- 🔧 Type safety tốt hơn

#### **Best Practices:**

```typescript
// Tạo types cho các response thường dùng
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export interface UserInfo {
  id: string
  email: string
  name: string
  role: RoleInfo
}
```

---

## 🎯 **Bài 59: Chức năng Refresh Token**

### **Mục tiêu**

Xây dựng chức năng refresh access token

### **Database Query Strategy**

#### **Phương án 1: Nested Join**

```sql
-- RefreshToken → User → Role
SELECT rt.*, u.*, r.*
FROM refresh_tokens rt
JOIN users u ON rt.userId = u.id
JOIN roles r ON u.roleId = r.id
WHERE rt.token = ?
```

#### **Phương án 2: Sequential Queries**

```typescript
// 1. Tìm RefreshToken
const refreshToken = await findRefreshToken(token)

// 2. Từ userId tìm User + Role
const user = await findUserWithRole(refreshToken.userId)
```

**🎯 Lựa chọn:** Sử dụng phương án 1 (JOIN) để tối ưu performance

### **Parallel Processing với Promise.all**

#### **3 tác vụ có thể chạy song song:**

```typescript
const [$updateDevice, $deleteOldRefreshToken, $newTokens] = await Promise.all([
  // 1. Cập nhật thông tin Device
  updateDevice({
    deviceId,
    userAgent,
    ip,
    lastActive: new Date(),
    isActive: true,
  }),

  // 2. Xóa RefreshToken cũ
  deleteRefreshToken(oldToken),

  // 3. Generate tokens mới
  generateTokens({ userId, roleId, roleName }),
])
```

#### **💡 Naming Convention:**

- Biến sử dụng `Promise.all` prefix với `$`
- Phân biệt với biến thông thường
- Dễ đọc, dễ maintain

### **Token Expiration Strategy**

#### **Yêu cầu đặc biệt:**

```typescript
// RefreshToken mới sử dụng expiration của RefreshToken cũ
const newRefreshToken = generateRefreshToken({
  ...payload,
  exp: oldRefreshToken.exp, // Giữ nguyên thời gian hết hạn
})
```

**🎯 Lý do:** Duy trì session time consistency

---

## 🎯 **Bài 60: Chức năng Logout**

### **Mục tiêu**

Thực hiện chức năng đăng xuất an toàn

### **Authentication Requirements**

#### **Bearer Token Validation:**

```typescript
@Post('logout')
@UseGuards(AccessTokenGuard) // Yêu cầu xác thực
async logout(
  @ActiveUser() user: ActiveUserData,
  @Headers('authorization') authHeader: string,
) {
  const token = this.extractTokenFromHeader(authHeader);
  return this.authService.logout(user.userId, token);
}
```

### **Logout Process**

#### **Các bước thực hiện:**

1. **Validate AccessToken:** Đảm bảo token hợp lệ
2. **Extract userId:** Từ decoded token
3. **Cleanup:**
   ```typescript
   await Promise.all([
     // Xóa RefreshToken khỏi database
     this.deleteRefreshTokenByUserId(userId),

     // Đánh dấu Device inactive (optional)
     this.updateDeviceStatus(deviceId, { isActive: false }),

     // Blacklist AccessToken (nếu cần)
     this.addToBlacklist(accessToken),
   ])
   ```

### **Security Considerations**

#### **Token Blacklisting (Optional):**

- **Pros:** Ngăn chặn sử dụng token đã logout
- **Cons:** Tăng complexity, cần storage cho blacklist
- **Alternative:** Dựa vào expiration time ngắn của AccessToken

#### **Device Management:**

- Đánh dấu device `isActive = false`
- Lưu thời gian logout
- Theo dõi pattern đăng nhập bất thường

---

## 🎯 **Bài 61: Return message cho sendOTP và tạo Decorator @IsPublic**

### **Mục tiêu**

Tối ưu response cho sendOTP và tạo decorator cho public endpoints

### **Response Optimization cho sendOTP**

#### **Trước:**

```typescript
// Không có response message rõ ràng
return { success: true }
```

#### **Sau:**

```typescript
return {
  success: true,
  message: 'OTP đã được gửi đến email của bạn',
  expiresIn: '5 phút',
  type: 'REGISTER',
}
```

### **@IsPublic Decorator**

#### **Vấn đề:**

- Một số endpoints không cần authentication
- Cần cách đánh dấu public endpoints
- Tránh áp dụng guards không cần thiết

#### **Implementation:**

```typescript
// decorators/is-public.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true)
```

#### **Sử dụng trong Controller:**

```typescript
@Controller('auth')
export class AuthController {
  @Post('register')
  @IsPublic() // Không cần authentication
  async register(@Body() body: RegisterDTO) {
    return this.authService.register(body)
  }

  @Post('otp')
  @IsPublic() // Public endpoint
  async sendOTP(@Body() body: SendOTPDTO) {
    return this.authService.sendOTP(body)
  }

  @Get('profile')
  // Cần authentication (không có @IsPublic)
  async getProfile(@ActiveUser() user: ActiveUserData) {
    return this.authService.getProfile(user.userId)
  }
}
```

#### **Guard Integration:**

```typescript
// guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Kiểm tra xem endpoint có được đánh dấu @IsPublic không
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true // Skip authentication
    }

    // Thực hiện authentication bình thường
    return this.validateToken(context)
  }
}
```

### **Lợi ích**

- ✅ **Rõ ràng:** Dễ phân biệt public vs protected endpoints
- ✅ **Maintainable:** Dễ quản lý và cập nhật
- ✅ **Performance:** Không áp dụng guards không cần thiết
- ✅ **Security:** Tránh quên bảo vệ sensitive endpoints

---

## 🎯 **Bài 62: Bài tập OAuth 2.0 với Google**

### **Mục tiêu**

Tìm hiểu và chuẩn bị cho tích hợp Google OAuth 2.0

### **OAuth 2.0 Flow Overview**

```
1. User click "Login with Google"
2. Redirect to Google Authorization Server
3. User login + consent on Google
4. Google redirect back with authorization code
5. Exchange code for access token
6. Use access token to get user info
7. Create/login user in our system
```

### **Chuẩn bị**

- 📋 Google Cloud Console project
- 🔑 OAuth 2.0 credentials
- 🌐 Authorized redirect URIs
- 📱 Client ID và Client Secret

---

## 🎯 **Bài 63: Tạo dự án trên Google Console Cloud**

### **Mục tiêu**

Setup Google Cloud project cho OAuth integration

### **Các bước thực hiện**

#### **1. Tạo Project:**

- Truy cập [Google Cloud Console](https://console.cloud.google.com)
- Tạo project mới hoặc chọn project existing
- Enable Google+ API

#### **2. Configure OAuth Consent Screen:**

- **Application name:** Tên ứng dụng của bạn
- **Authorized domains:** Domain của website
- **Scopes:** email, profile, openid

#### **3. Create OAuth 2.0 Credentials:**

- **Application type:** Web application
- **Name:** Tên cho credential
- **Authorized JavaScript origins:**
  ```
  http://localhost:3000 (development)
  https://yourdomain.com (production)
  ```
- **Authorized redirect URIs:**
  ```
  http://localhost:3000/auth/google/callback
  https://yourdomain.com/auth/google/callback
  ```

#### **4. Lấy Credentials:**

```bash
# Environment variables
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### **⚠️ Lưu ý bảo mật**

- 🔒 **Client Secret:** Không expose ra frontend
- 🌐 **Redirect URI:** Phải chính xác 100%
- 🛡️ **Domain verification:** Cần verify domain cho production

---

## 🎯 **Bài 64: Tạo Google Authorized URL bằng googleapis**

### **Mục tiêu**

Sử dụng thư viện `googleapis` để tạo URL đăng nhập Google

### **Installation**

```bash
npm install googleapis
npm install @types/google-auth-library
```

### **Implementation**

#### **1. Setup Google OAuth Client:**

```typescript
import { google } from 'googleapis'

export class GoogleService {
  private oauth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )
  }
}
```

#### **2. Generate Authorization URL:**

```typescript
async generateAuthUrl(ip: string, userAgent: string): Promise<string> {
  // Tạo state để truyền thông tin client
  const state = Buffer.from(
    JSON.stringify({ userAgent, ip })
  ).toString('base64');

  const authUrl = this.oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    state: state, // Truyền IP và UserAgent
    prompt: 'consent'
  });

  return authUrl;
}
```

#### **3. Controller Implementation:**

```typescript
@Get('google')
@IsPublic()
async googleAuth(
  @GetClientIp() ip: string,
  @GetUserAgent() userAgent: string
): Promise<{ url: string }> {
  const url = await this.googleService.generateAuthUrl(ip, userAgent);
  return { url };
}
```

### **Flow hoạt động**

#### **Tại sao cần Browser → Server → Google?**

1. **Browser request đến Server:** Lấy IP và UserAgent
2. **Server tạo URL với state:** Chứa thông tin client
3. **Browser redirect đến Google:** Với URL đã có state
4. **Google redirect về Server:** Kèm state gốc + auth code
5. **Server xử lý login:** Có đầy đủ thông tin cần thiết

#### **State Management:**

```typescript
// Encode state
const state = Buffer.from(
  JSON.stringify({
    userAgent: 'Mozilla/5.0...',
    ip: '192.168.1.1',
  }),
).toString('base64')

// Decode state (trong callback)
const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
```

### **Security Benefits**

- 🛡️ **State verification:** Ngăn chặn CSRF attacks
- 📍 **IP tracking:** Phát hiện đăng nhập bất thường
- 🖥️ **Device fingerprinting:** Theo dõi thiết bị

### **Kết quả**

✅ **Hoàn thành:** Tạo Google Authorization URL thành công  
⏭️ **Tiếp theo:** Tích hợp Frontend để test chức năng

---

## 🎯 **Bài 65: Source Frontend Vite React để test chức năng Login với Google**

### **Mục tiêu**

Tạo frontend đơn giản để test Google OAuth flow

### **Frontend Setup**

#### **1. Vite React Project:**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios
```

#### **2. OAuth Component:**

```typescript
// components/GoogleLogin.tsx
import { useState } from 'react';
import axios from 'axios';

export default function GoogleLogin() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. Lấy Google Auth URL từ server
      const response = await axios.get('http://localhost:3000/auth/google');
      const { url } = response.data;

      // 2. Redirect đến Google
      window.location.href = url;
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGoogleLogin} disabled={loading}>
        {loading ? 'Redirecting...' : 'Login with Google'}
      </button>
    </div>
  );
}
```

#### **3. Callback Handler:**

```typescript
// components/OAuthCallback.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function OAuthCallback() {
  const location = useLocation();

  useEffect(() => {
    // URL sẽ có dạng: /auth/oauth-google-callback?code=...&state=...
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
      // Process login với server
      handleGoogleCallback(code, state);
    }
  }, [location]);

  const handleGoogleCallback = async (code: string, state: string) => {
    try {
      const response = await axios.post('http://localhost:3000/auth/google/callback', {
        code,
        state
      });

      const { accessToken, refreshToken } = response.data;

      // Lưu tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Redirect đến dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Callback failed:', error);
    }
  };

  return <div>Processing login...</div>;
}
```

### **Complete Flow**

```
1. User clicks "Login with Google" → Frontend
2. Frontend calls GET /auth/google → Backend
3. Backend returns Google Auth URL → Frontend
4. Frontend redirects to Google → Google
5. User login on Google → Google
6. Google redirects to callback → Backend
7. Backend processes & redirects → Frontend callback page
8. Frontend gets tokens from URL → Complete
```

### **Kết quả**

✅ **Hoàn thành:** Frontend test environment cho Google OAuth  
🔄 **Flow:** Browser → Server → Google → Server → Frontend callback
