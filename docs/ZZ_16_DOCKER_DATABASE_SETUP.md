# Hướng Dẫn Setup Database với Docker và Prisma

## Vấn Đề Được Giải Quyết

Khi phát triển ứng dụng NestJS với Prisma, bạn sẽ gặp phải tình huống:

- **Development**: Database PostgreSQL chạy local, kết nối qua `localhost:5432`
- **Docker**: Database PostgreSQL chạy trong container, kết nối qua service name `postgres:5432`

Vấn đề là `schema.prisma` chỉ có thể đọc một `DATABASE_URL` từ file `.env`, nhưng URL này khác nhau giữa môi trường development và Docker.

## Giải Pháp Được Áp Dụng

### 1. Cách Hoạt Động của Environment Variables trong Docker

Docker Compose có thể ghi đè environment variables theo thứ tự ưu tiên:

1. **Environment trong docker-compose.yml** (cao nhất)
2. File .env được mount
3. Environment variables từ host system
4. Default values trong application

### 2. Cấu Hình Môi Trường Development

**Bước 1**: Tạo file `.env` cho development local:

```bash
# Database cho PostgreSQL local
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Các config khác...
APP_NAME='NestJS Ecommerce Platform'
NODE_ENV=development
PORT=3000
ACCESS_TOKEN_SECRET='your_secret'
# ... các config khác
```

**Bước 2**: Chạy development:

```bash
# Prisma sẽ đọc DATABASE_URL từ .env
npx prisma migrate dev
npx prisma generate
pnpm run start:dev
```

### 3. Cấu Hình Docker Environment

**Trong docker-compose.yml**, environment variables được định nghĩa trực tiếp:

```yaml
api:
  build: .
  container_name: ecom-api
  environment:
    # Database cho Docker - GHI ĐÈ .env
    DATABASE_URL: postgresql://ecom_user:ecom_password@postgres:5432/ecom_db
    NODE_ENV: production
    # ... các config khác
```

**Lưu ý quan trọng**: Environment variables trong `docker-compose.yml` sẽ **ghi đè** bất kỳ giá trị nào từ file `.env`.

### 4. Dockerfile Được Tối Ưu

```dockerfile
# Sử dụng pnpm thay vì npm cho tốc độ tốt hơn
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Tạo user non-root cho security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
RUN chown -R nestjs:nodejs /app
USER nestjs

# Chạy migration và start app
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm run start:prod"]
```

## Cách Sử Dụng

### Phát Triển Local (Development)

1. **Tạo file .env**:

```bash
cp env.example .env
# Chỉnh sửa DATABASE_URL cho database local của bạn
```

2. **Setup database local**:

```bash
npx prisma migrate dev
npx prisma generate
pnpm run start:dev
```

### Chạy với Docker

1. **Build và chạy containers**:

```bash
# Build và start tất cả services
docker-compose up --build

# Hoặc chạy detached mode
docker-compose up -d --build
```

2. **Database được tự động setup**:
   - PostgreSQL container sẽ được tạo với credentials từ docker-compose.yml
   - API container sẽ tự động chạy `prisma migrate deploy` khi start
   - Không cần file `.env` vì environment variables đã được định nghĩa trong docker-compose.yml

### Kiểm Tra Kết Nối Database

```bash
# Kiểm tra container đang chạy
docker-compose ps

# Xem logs của API container
docker-compose logs api

# Kết nối vào database container
docker-compose exec postgres psql -U ecom_user -d ecom_db
```

## Debugging

### Nếu Gặp Lỗi Database Connection

1. **Kiểm tra container status**:

```bash
docker-compose ps
```

2. **Kiểm tra logs**:

```bash
docker-compose logs postgres
docker-compose logs api
```

3. **Restart containers**:

```bash
docker-compose down
docker-compose up --build
```

### Nếu Muốn Reset Database

```bash
# Xóa containers và volumes
docker-compose down -v

# Rebuild từ đầu
docker-compose up --build
```

## Lưu Ý Quan Trọng

1. **File .env**: Chỉ cần cho development local, không được commit vào Git
2. **env.example**: Template file, có thể commit vào Git
3. **Docker Environment**: Được định nghĩa trực tiếp trong docker-compose.yml
4. **Database URL**: Khác nhau giữa `localhost:5432` (local) và `postgres:5432` (Docker)
5. **Migration**: Tự động chạy trong Docker qua command `prisma migrate deploy`

## Kiến Trúc Tổng Quan

```
Development Environment:
┌─────────────┐    ┌─────────────────┐
│   NestJS    │───▶│  PostgreSQL     │
│   (local)   │    │   localhost     │
│   port:3000 │    │   port:5432     │
└─────────────┘    └─────────────────┘
       ▲
       │ .env file
   DATABASE_URL=localhost:5432

Docker Environment:
┌─────────────┐    ┌─────────────────┐
│   NestJS    │───▶│  PostgreSQL     │
│ (container) │    │  (container)    │
│   port:3000 │    │   port:5432     │
└─────────────┘    └─────────────────┘
       ▲
       │ docker-compose.yml
   DATABASE_URL=postgres:5432
```

Cách này đảm bảo:

- ✅ Development local hoạt động bình thường
- ✅ Docker containers kết nối đúng database
- ✅ Không cần thay đổi code
- ✅ Environment variables được quản lý đúng cách
- ✅ Security và best practices được áp dụng
