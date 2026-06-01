# Auth Flow

## Overview

The API uses JWT-based authentication with access tokens (short-lived) and refresh tokens (long-lived). Every route requires a valid Bearer token by default. Public routes opt out with `@IsPublic()`.

## Token Lifecycle

```
User logs in
    │
    ▼
POST /v1/auth/login
    │
    ├── Returns accessToken  (15 minutes, configurable via ACCESS_TOKEN_EXPIRES_IN)
    └── Returns refreshToken (7 days, configurable via REFRESH_TOKEN_EXPIRES_IN)

Client uses accessToken in Authorization header:
    Authorization: Bearer <accessToken>

When accessToken expires:
    │
    ▼
POST /v1/auth/refresh-token
    Body: { refreshToken: "<token>" }
    │
    ├── Validates refreshToken (not expired, not already used)
    ├── Rotates: old refreshToken is invalidated (stored in DB as used)
    └── Returns new accessToken + new refreshToken
```

Refresh tokens are stored in the database (`RefreshToken` table). Each token can only be used once — reuse of an already-used refresh token throws `Error.RefreshTokenAlreadyUsed` (401).

## Guard Chain

Guards are registered globally in `AppModule` and execute in this order:

```
Request
  │
  ▼
RateLimitGuard          — per-IP rate limiting (checked first, before auth)
  │
  ▼
AuthenticationGuard     — reads @Auth() decorator metadata from route handler
  │
  ├── AuthType.Bearer        → AccessTokenGuard
  ├── AuthType.PaymentAPIKey → PaymentAPIKeyGuard
  └── AuthType.None          → passthrough (always true)
```

### AuthenticationGuard

`src/shared/guards/authentication.guard.ts`

Central dispatch guard. Reads `@Auth()` decorator metadata via `Reflector`. Default (no decorator): `AuthType.Bearer` with `ConditionGuard.And`.

Supports AND/OR conditions:

- `ConditionGuard.And` — all guards must pass (default)
- `ConditionGuard.Or` — at least one guard must pass

### AccessTokenGuard

`src/shared/guards/access-token.guard.ts`

1. Extracts Bearer token from `Authorization` header
2. Verifies JWT signature and expiry via `TokenService`
3. Attaches decoded payload to `request[REQUEST_USER_KEY]`
4. Loads role + permissions from cache (key: `role:<roleId>`, TTL: 1 hour) or DB
5. Checks that the role has a permission matching `path:method`
6. Throws `ForbiddenException('Error.PermissionDenied')` if no matching permission

### PaymentAPIKeyGuard

`src/shared/guards/payment-api-key.guard.ts`

Validates `x-api-key` header against `SECRET_API_KEY` env var. Used for payment webhook endpoints.

## Decorators

### `@IsPublic()`

`src/shared/decorators/auth.decorator.ts`

Marks a route as public — no authentication required. Equivalent to `@Auth([AuthType.None])`.

```typescript
@Get('products')
@IsPublic()
async listProducts() { ... }
```

### `@Auth(authTypes, options?)`

Low-level decorator. Use `@IsPublic()` for public routes. Use `@Auth([AuthType.PaymentAPIKey])` for webhook endpoints.

```typescript
@Post('webhook')
@Auth([AuthType.PaymentAPIKey])
async handleWebhook() { ... }
```

### `@ActiveUser(field?)`

`src/shared/decorators/active-user.decorator.ts`

Extracts the authenticated user's payload from the request. Reads from `request[REQUEST_USER_KEY]` set by `AccessTokenGuard`.

```typescript
@Get('profile')
async getProfile(@ActiveUser('userId') userId: number) { ... }

// Or get the full payload:
@Get('me')
async getMe(@ActiveUser() user: AccessTokenPayload) { ... }
```

### `@Roles(...roles)`

`src/shared/decorators/roles.decorator.ts`

Attaches role metadata to a route handler via `SetMetadata`. **Currently a runtime no-op** — no guard in the codebase reads `ROLES_KEY`, so this decorator does not restrict access at runtime. It is scaffolded for future role-based enforcement but has no effect until a guard is wired up to consume the metadata.

## Authentication Flows

### Credentials (Email + Password)

```
1. POST /v1/auth/send-otp   { email, type: "REGISTER" }
   → Sends OTP to email via Resend

2. POST /v1/auth/register   { name, email, password, code }
   → Validates OTP, creates user with CLIENT role
   → Emits UserRegisteredEvent (sends welcome email)

3. POST /v1/auth/login      { email, password }
   → Returns { accessToken, refreshToken }
   → If 2FA enabled: returns { totpRequired: true } instead
```

### Two-Factor Authentication (TOTP)

```
Setup:
1. POST /v1/auth/2fa/setup
   → Returns { secret, qrCode } — scan with authenticator app

2. POST /v1/auth/2fa/enable  { totpCode }
   → Validates TOTP code, enables 2FA on account

Login with 2FA:
1. POST /v1/auth/login       { email, password }
   → Returns { totpRequired: true }

2. POST /v1/auth/login       { email, password, totpCode }
   → Returns { accessToken, refreshToken }

Disable:
1. POST /v1/auth/2fa/disable { totpCode, code }
   → Requires both TOTP code and email OTP
```

### Google OAuth

```
1. GET  /v1/auth/google
   → Redirects to Google consent screen

2. GET  /v1/auth/google/callback?code=...
   → Google redirects here after consent
   → Creates or finds user by Google email
   → Redirects to GOOGLE_CLIENT_REDIRECT_URI with tokens as query params
```

### Token Refresh

```
POST /v1/auth/refresh-token
Body: { refreshToken: "<token>" }

→ Validates token (not expired, not already used)
→ Rotates: marks old token as used, issues new pair
→ Returns { accessToken, refreshToken }
```

### Logout

```
POST /v1/auth/logout
Authorization: Bearer <accessToken>
Body: { refreshToken: "<token>" }

→ Deletes the refresh token from DB
→ Client should discard both tokens
```

### Forgot Password

```
1. POST /v1/auth/send-otp         { email, type: "FORGOT_PASSWORD" }
   → Sends OTP to email

2. POST /v1/auth/forgot-password  { email, code, newPassword }
   → Validates OTP, updates password hash
```

## RBAC (Role-Based Access Control)

Permissions are stored in the `Permission` table as `(path, method)` pairs. Each role has a many-to-many relationship with permissions.

The `AccessTokenGuard` checks `role.permissions[path:method]` on every request. Role permissions are cached in Redis for 1 hour to avoid repeated DB queries.

Admin users have a special `ADMIN` role that bypasses permission checks (all permissions are assigned to it during seeding).

## Security Notes

- Access tokens are short-lived (15m) to limit exposure if leaked
- Refresh token rotation prevents token reuse attacks
- Passwords are hashed with bcrypt
- TOTP uses the `otpauth` library (RFC 6238 compliant)
- Rate limiting is applied before auth to prevent brute-force attacks
