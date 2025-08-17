# 🚀 QUICK START - TESTING SETUP

## Bước 1: Cài Đặt Môi Trường Test

### 1.1 Tạo Test Database

```bash
# Copy file environment
cp .env .env.test

# Sửa DATABASE_URL trong .env.test (ví dụ):
# DATABASE_URL="postgresql://username:password@localhost:5432/ecommerce_test"
```

### 1.2 Setup Database Schema

```bash
# Chạy migration cho test database
DATABASE_URL="postgresql://username:password@localhost:5432/ecommerce_test" npx prisma db push --force-reset

# Hoặc sử dụng env file
npx dotenv -e .env.test -- npx prisma db push --force-reset
```

## Bước 2: Chạy Tests

### 2.1 Chạy Test Cơ Bản

```bash
# Chạy tất cả tests
pnpm test

# Chạy với coverage
pnpm test:coverage

# Chạy tests ở watch mode
pnpm test:watch
```

### 2.2 Chạy Test Theo Loại

```bash
# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# CI tests (với coverage và timeout)
pnpm test:ci
```

### 2.3 Chạy Test Specific File

```bash
# Test một file cụ thể
pnpm test src/shared/services/__tests__/hashing.service.spec.ts

# Test với pattern
pnpm test --testNamePattern="should hash password"
```

## Bước 3: Kiểm Tra Kết Quả

### 3.1 Coverage Report

```bash
# Tạo coverage report
pnpm test:coverage

# Mở report trong browser
open coverage/lcov-report/index.html
```

### 3.2 Debug Tests

```bash
# Chạy test với verbose output
pnpm test --verbose

# Debug một test specific
pnpm test --testNamePattern="should register user successfully"
```

## 📋 CHECKLIST TRƯỚC KHI CHẠY TEST

- [ ] ✅ Test database được tạo và kết nối thành công
- [ ] ✅ File `.env.test` đã được config đúng
- [ ] ✅ Dependencies đã được install (`pnpm install`)
- [ ] ✅ Prisma schema đã được sync (`npx prisma db push`)

## 🔥 TESTS HIỆN TẠI

### ✅ Tests Đã Hoàn Thành

- **HashingService** - Unit test hoàn chỉnh
- **Auth Flow Integration** - Registration workflow
- **User Management E2E** - CRUD operations

### 🔄 Tests Đang Triển Khai

- **AuthService** - Unit test (có một số lỗi ESLint minor)
- **TokenService** - Chưa implement
- **Security Guards** - Chưa implement

### ⏳ Tests Sắp Triển Khai

- **Role & Permission Logic**
- **Payment Integration**
- **File Upload**
- **Performance Tests**

## 🐛 TROUBLESHOOTING

### Lỗi Database Connection

```bash
# Kiểm tra database có chạy không
pg_isready -h localhost -p 5432

# Kiểm tra connection string
echo $DATABASE_URL
```

### Lỗi Port Already in Use

```bash
# Kill process đang dùng port
lsof -ti:3000 | xargs kill -9

# Hoặc thay đổi port trong test
export PORT=3001
```

### Lỗi Permission

```bash
# Đảm bảo user có quyền tạo database
psql -h localhost -U username -c "CREATE DATABASE ecommerce_test;"
```

### Tests Fail Random

```bash
# Chạy tests sequential (không parallel)
pnpm test --runInBand

# Increase timeout cho slow tests
pnpm test --testTimeout=30000
```

## 📊 KỲ VỌNG KẾT QUẢ

Sau khi setup xong, bạn sẽ thấy output như này:

```
 PASS  src/shared/services/__tests__/hashing.service.spec.ts
 PASS  test/integration/auth-flow.integration.spec.ts
 PASS  test/e2e/user-management.e2e-spec.ts

Test Suites: 3 passed, 3 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        10.5 s
Ran all test suites.

Coverage Summary:
Statements   : 75% ( 120/160 )
Branches     : 70% ( 35/50 )
Functions    : 80% ( 40/50 )
Lines        : 75% ( 115/153 )
```

## 🎯 NEXT STEPS

1. **Chạy HashingService test** để validate setup
2. **Implement TokenService tests**
3. **Fix AuthService ESLint warnings**
4. **Thêm Security tests**
5. **Triển khai Business Logic tests**

---

💡 **Tip**: Bắt đầu với `pnpm test src/shared/services/__tests__/hashing.service.spec.ts` để đảm bảo mọi thứ hoạt động đúng!
