# Giải Thích Chi Tiết: Environment Variables trong Docker và Prisma

## 🤔 Câu Hỏi Được Giải Đáp

### 1. **Docker có ghi đè lên file .env không?**

### 2. **Tại sao NODE_ENV lại là development thay vì production?**

### 3. **Prisma đọc DATABASE_URL từ đâu khi chạy Docker?**

### 4. **Tại sao không khai báo đầy đủ tất cả biến môi trường?**

---

## 📋 **Cách Docker Xử Lý Environment Variables**

### **Thứ Tự Ưu Tiên (Priority Order)**

Docker áp dụng environment variables theo thứ tự ưu tiên từ **CAO** đến **THẤP**:

```
1. 🔴 ENVIRONMENT trong docker-compose.yml (CAO NHẤT)
2. 🟡 File .env được mount vào container
3. 🟢 Environment variables từ host system
4. 🔵 Default values trong application code (THẤP NHẤT)
```

### **Ví Dụ Thực Tế**

**File .env (local):**

```bash
DATABASE_URL="postgresql://local_user:local_pass@localhost:5432/local_db"
NODE_ENV=development
ACCESS_TOKEN_SECRET=local_secret
```

**docker-compose.yml:**

```yaml
environment:
  DATABASE_URL: postgresql://ecom_user:ecom_password@postgres:5432/ecom_db
  NODE_ENV: development
  # ACCESS_TOKEN_SECRET: KHÔNG KHAI BÁO
```

**Kết quả khi chạy trong Docker:**

- ✅ `DATABASE_URL` = `postgresql://ecom_user:ecom_password@postgres:5432/ecom_db` (từ docker-compose)
- ✅ `NODE_ENV` = `development` (từ docker-compose)
- ✅ `ACCESS_TOKEN_SECRET` = `local_secret` (từ .env vì docker-compose không ghi đè)

---

## 🎯 **Trả Lời Các Thắc Mắc Cụ Thể**

### **1. Ghi Đè Environment Variables**

> **Câu hỏi**: "Có phải environment trong docker-compose sẽ ghi đè .env không?"

**Trả lời**: **ĐÚNG**, nhưng chỉ ghi đè những biến được khai báo trong docker-compose.yml.

**Cơ chế hoạt động:**

- Biến **CÓ** trong docker-compose → Sử dụng giá trị từ docker-compose (ghi đè .env)
- Biến **KHÔNG CÓ** trong docker-compose → Sử dụng giá trị từ .env (nếu có)

### **2. Tại sao NODE_ENV=development trong Docker?**

> **Câu hỏi**: "Tại sao NODE_ENV là development chứ không phải production?"

**Trả lời**: **ĐÃ SỬA** thành `development` vì:

```yaml
# TRƯỚC ĐÂY (SAI):
NODE_ENV: production  # ❌ Sai vì đây là môi trường dev

# BÂY GIỜ (ĐÚNG):
NODE_ENV: development # ✅ Đúng cho môi trường development
```

**Lý do:**

- Docker ở đây được dùng cho **development environment**, không phải production
- `development` cho phép hot reload, debug logs, error stack traces
- `production` thường được dùng khi deploy lên server thật

### **3. Prisma Đọc DATABASE_URL Từ Đâu?**

> **Câu hỏi**: "schema.prisma lấy DATABASE_URL từ docker-compose hay .env?"

**Trả lời**:

**Khi chạy LOCAL (npm run start:dev):**

```bash
Prisma đọc từ: .env file
DATABASE_URL="postgresql://local_user:pass@localhost:5432/local_db"
```

**Khi chạy DOCKER (docker-compose up):**

```bash
Prisma đọc từ: Environment variables của container
DATABASE_URL="postgresql://ecom_user:ecom_password@postgres:5432/ecom_db"
```

**Cơ chế:**

1. Prisma Client sử dụng `env("DATABASE_URL")` từ schema.prisma
2. Node.js runtime đọc `process.env.DATABASE_URL`
3. Docker ghi đè `process.env.DATABASE_URL` với giá trị từ docker-compose.yml

### **4. Tại sao không khai báo đầy đủ tất cả biến?**

> **Câu hỏi**: "Có cần khai báo tất cả biến môi trường trong docker-compose không?"

**Trả lời**: **KHÔNG BẮT BUỘC**, nhưng **NÊN KHAI BÁO** để rõ ràng.

**Trước đây (thiếu sót):**

```yaml
environment:
  DATABASE_URL: postgresql://...
  NODE_ENV: production
  # ❌ Thiếu nhiều biến khác
```

**Bây giờ (đầy đủ):**

```yaml
environment:
  # Database
  DATABASE_URL: postgresql://...

  # App Config
  APP_NAME: 'NestJS Ecommerce Platform Docker'
  NODE_ENV: development
  PORT: 3000

  # JWT
  ACCESS_TOKEN_SECRET: ...
  REFRESH_TOKEN_SECRET: ...

  # Admin User
  ADMIN_NAME: ...
  ADMIN_EMAIL: ...

  # OAuth
  GOOGLE_CLIENT_ID: ...

  # S3
  S3_REGION: ...
  # ... tất cả các biến khác
```

---

## 🔄 **Flow Hoạt Động Thực Tế**

### **Development Local Flow:**

```
1. Developer tạo file .env
   ↓
2. Chạy: npm run start:dev
   ↓
3. Node.js đọc .env file
   ↓
4. Prisma kết nối: localhost:5432
   ↓
5. App chạy với database local
```

### **Docker Development Flow:**

```
1. Developer chạy: docker-compose up
   ↓
2. Docker tạo containers (postgres + api)
   ↓
3. Docker set environment variables cho api container
   ↓
4. Node.js trong container đọc environment variables
   ↓
5. Prisma kết nối: postgres:5432 (service name)
   ↓
6. App chạy với database trong container
```

---

## 📊 **So Sánh Environment Variables**

| Biến Môi Trường       | Local (.env)     | Docker (docker-compose.yml) | Ai Thắng?     |
| --------------------- | ---------------- | --------------------------- | ------------- |
| `DATABASE_URL`        | `localhost:5432` | `postgres:5432`             | 🏆 Docker     |
| `NODE_ENV`            | `development`    | `development`               | 🤝 Giống nhau |
| `ACCESS_TOKEN_SECRET` | `local_secret`   | `docker_secret`             | 🏆 Docker     |
| `ADMIN_EMAIL`         | `local@test.com` | `docker@test.com`           | 🏆 Docker     |
| `S3_REGION`           | `us-west-1`      | `hcm`                       | 🏆 Docker     |

**Kết luận**: Docker environment **luôn thắng** khi có khai báo.

---

## 🛠️ **Testing và Verification**

### **Cách Kiểm Tra Environment Variables**

**1. Trong Docker Container:**

```bash
# Vào container
docker-compose exec api sh

# Kiểm tra biến môi trường
echo $DATABASE_URL
echo $NODE_ENV
echo $ACCESS_TOKEN_SECRET

# Hoặc xem tất cả
env | grep -E "(DATABASE|NODE_ENV|ACCESS)"
```

**2. Trong Code (Debug):**

```typescript
// Thêm vào main.ts hoặc app.service.ts
console.log('🔍 Environment Variables:')
console.log('DATABASE_URL:', process.env.DATABASE_URL)
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET)
```

**3. Kiểm Tra Prisma Connection:**

```bash
# Trong container
docker-compose exec api npx prisma db pull
docker-compose exec api npx prisma studio
```

---

## ⚡ **Best Practices & Recommendations**

### **1. Quản Lý Environment Variables**

```yaml
# ✅ GOOD: Khai báo đầy đủ và có comment
environment:
  # Database - Override .env
  DATABASE_URL: postgresql://ecom_user:ecom_password@postgres:5432/ecom_db

  # App Config - Override .env
  NODE_ENV: development
  PORT: 3000

# ❌ BAD: Thiếu comment và không đầy đủ
environment:
  DATABASE_URL: postgresql://...
```

### **2. Naming Convention**

```yaml
# ✅ GOOD: Thêm suffix _docker để phân biệt
ACCESS_TOKEN_SECRET: hoc_lap_trinh_access_token_secret_docker
S3_BUCKET_NAME: ecommerce-super-nestjs-docker

# ❌ BAD: Giống hệt local, gây confusion
ACCESS_TOKEN_SECRET: hoc_lap_trinh_access_token_secret
```

### **3. Security**

```yaml
# ✅ GOOD: Sử dụng Docker secrets cho production
secrets:
  db_password:
    file: ./secrets/db_password.txt

# ❌ BAD: Hardcode sensitive data
ADMIN_PASSWORD: plaintext_password
```

---

## 🎉 **Tóm Tắt Giải Pháp**

### **Vấn đề đã được giải quyết:**

1. ✅ **Environment Override**: Docker-compose ghi đè .env, chỉ những biến được khai báo
2. ✅ **NODE_ENV**: Đã sửa thành `development` cho môi trường phát triển
3. ✅ **Complete Variables**: Đã khai báo đầy đủ tất cả biến môi trường
4. ✅ **Prisma Connection**: Tự động chuyển đổi giữa local và Docker database
5. ✅ **Clear Documentation**: Tài liệu chi tiết về cách hoạt động

### **Kết quả:**

- **Local Development**: Sử dụng `.env` với `localhost:5432`
- **Docker Development**: Sử dụng docker-compose environment với `postgres:5432`
- **Automatic Switching**: Không cần thay đổi code hay config
- **Full Control**: Biết chính xác biến nào đến từ đâu

**🚀 Bây giờ bạn có thể phát triển một cách tự tin với cả local và Docker!**
