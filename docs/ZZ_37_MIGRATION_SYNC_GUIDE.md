# Hướng Dẫn Đồng Bộ Migration Database - NestJS + Prisma

## Tổng Quan

Khi làm việc với dự án NestJS sử dụng Prisma ORM, việc đồng bộ migration giữa các máy local khác nhau là rất quan trọng để đảm bảo tính nhất quán của database schema. Hướng dẫn này sẽ giúp bạn xử lý các tình huống khi pull code từ GitHub về máy local mới mà database chưa có các migration mới.

## Tình Huống Gặp Phải

Bạn đã làm việc trên máy local A, tạo migration và push lên GitHub. Sau đó bạn pull code về máy local B, nhưng database ở máy B chưa có các migration mới này.

## Các Bước Xử Lý

### 1. Kiểm Tra Trạng Thái Hiện Tại

Trước tiên, hãy kiểm tra trạng thái migration hiện tại:

```bash
# Kiểm tra migration status
npx prisma migrate status

# Hoặc sử dụng pnpm (vì dự án dùng pnpm)
pnpm prisma migrate status
```

### 2. Kiểm Tra Database URL

Đảm bảo file `.env` của bạn có cấu hình database đúng:

```bash
# Kiểm tra file .env
cat .env | grep DATABASE_URL
```

**Lưu ý quan trọng**: Dự án này hỗ trợ 2 cấu hình database:

- **Local PostgreSQL**: `postgresql://username:password@localhost:5432/database_name?schema=public`
- **Docker PostgreSQL**: `postgresql://ecom_user:ecom_password@postgres:5432/ecom_db?schema=public`

### 3. Đồng Bộ Migration

#### Phương Pháp 1: Sử Dụng Prisma Migrate (Khuyến Nghị)

```bash
# Bước 1: Pull các migration mới từ GitHub
git pull origin main

# Bước 2: Đồng bộ database với migration mới nhất
npx prisma migrate deploy

# Bước 3: Generate Prisma Client
npx prisma generate

# Bước 4: Kiểm tra lại trạng thái
npx prisma migrate status
```

#### Phương Pháp 2: Reset Database (Chỉ dùng cho Development)

**⚠️ CẢNH BÁO**: Phương pháp này sẽ xóa toàn bộ dữ liệu trong database!

```bash
# Chỉ sử dụng khi bạn chắc chắn muốn reset database
npx prisma migrate reset

# Sau đó chạy lại seed data nếu cần
pnpm run init-seed-data
```

### 4. Xử Lý Lỗi Thường Gặp

#### Lỗi 1: Migration History Không Khớp

```bash
# Kiểm tra migration history trong database
npx prisma migrate status

# Nếu có lỗi, có thể cần reset
npx prisma migrate reset --force
```

#### Lỗi 2: Database Không Tồn Tại

```bash
# Tạo database mới (PostgreSQL)
createdb your_database_name

# Hoặc sử dụng psql
psql -U postgres -c "CREATE DATABASE your_database_name;"
```

#### Lỗi 3: Kết Nối Database Thất Bại

```bash
# Kiểm tra kết nối database
npx prisma db pull

# Kiểm tra cấu hình trong .env
cat .env | grep DATABASE_URL
```

### 5. Workflow Hoàn Chỉnh

#### Khi Pull Code Về Máy Local Mới:

```bash
# 1. Pull code từ GitHub
git pull origin main

# 2. Cài đặt dependencies
pnpm install

# 3. Copy file environment
cp env.example .env
# Chỉnh sửa .env với thông tin database của bạn

# 4. Đồng bộ database
npx prisma migrate deploy

# 5. Generate Prisma Client
npx prisma generate

# 6. Chạy seed data (nếu cần)
pnpm run init-seed-data

# 7. Khởi động ứng dụng
pnpm run start:dev
```

### 6. Sử Dụng Docker (Nếu Có)

Nếu bạn sử dụng Docker cho database:

```bash
# Khởi động database container
docker-compose up -d postgres

# Đợi database khởi động xong, sau đó chạy migration
npx prisma migrate deploy
```

### 7. Kiểm Tra Sau Khi Đồng Bộ

```bash
# Kiểm tra migration status
npx prisma migrate status

# Kiểm tra database schema
npx prisma db pull

# Test kết nối database
npx prisma studio
```

## Các Lệnh Prisma Hữu Ích

```bash
# Xem trạng thái migration
npx prisma migrate status

# Tạo migration mới (khi thay đổi schema)
npx prisma migrate dev --name your_migration_name

# Deploy migration lên production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# Mở Prisma Studio để xem database
npx prisma studio

# Pull schema từ database
npx prisma db pull

# Push schema lên database (development only)
npx prisma db push
```

## Best Practices

### 1. Luôn Commit Migration Files

```bash
# Đảm bảo commit tất cả migration files
git add prisma/migrations/
git commit -m "Add new migration: description"
git push origin main
```

### 2. Backup Database Trước Khi Reset

```bash
# Backup database (PostgreSQL)
pg_dump your_database_name > backup.sql

# Restore database
psql your_database_name < backup.sql
```

### 3. Sử Dụng Environment Variables

```bash
# Luôn sử dụng .env cho cấu hình database
# Không hardcode database URL trong code
```

### 4. Kiểm Tra Migration Trước Khi Deploy

```bash
# Luôn kiểm tra migration status trước khi deploy
npx prisma migrate status
```

## Troubleshooting

### Vấn Đề Thường Gặp

1. **Migration History Không Khớp**: Sử dụng `npx prisma migrate reset`
2. **Database Connection Failed**: Kiểm tra DATABASE_URL trong .env
3. **Permission Denied**: Kiểm tra quyền truy cập database
4. **Schema Drift**: Sử dụng `npx prisma db pull` để đồng bộ

### Lệnh Debug

```bash
# Debug Prisma
DEBUG=prisma:* npx prisma migrate deploy

# Xem log chi tiết
npx prisma migrate deploy --verbose
```

## Kết Luận

Việc đồng bộ migration database là một phần quan trọng trong quy trình phát triển. Luôn đảm bảo:

1. **Commit migration files** lên Git
2. **Pull code mới nhất** trước khi làm việc
3. **Chạy migration deploy** sau khi pull
4. **Kiểm tra trạng thái** database thường xuyên
5. **Backup dữ liệu** quan trọng trước khi reset

Với hướng dẫn này, bạn sẽ có thể xử lý các tình huống đồng bộ migration một cách hiệu quả và an toàn.
