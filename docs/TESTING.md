# 🧪 Testing Guide - NestJS Ecommerce API

## 📋 Overview

Hướng dẫn testing toàn diện cho dự án NestJS Ecommerce API với focus vào test quality, coverage và maintainability.

## 🚀 Quick Start

### Setup Testing Environment

```bash
# Install dependencies
pnpm install

# Setup test database
npm run test:db:setup

# Run all tests
npm test

# Run with coverage
npm run test:cov

# Watch mode for development
npm run test:watch
```

## 📂 Testing Structure

```
test/
├── setup.ts                 # Global test setup
├── helpers/
│   └── test-helpers.ts      # Test utilities & factories
├── integration/             # Integration tests
│   ├── auth-flow.integration.spec.ts
│   └── user-management.integration.spec.ts
└── e2e/                     # End-to-end tests
    ├── auth.e2e-spec.ts
    └── user-crud.e2e-spec.ts

src/
├── shared/services/__tests__/     # Unit tests for shared services
├── routes/auth/__tests__/         # Auth module tests
├── routes/user/__tests__/         # User module tests
└── ...
```

## 🎯 Testing Strategy

### Phase 1: Core Infrastructure (Week 1-2)

- ✅ Shared Services (PrismaService, HashingService, TokenService)
- ✅ Guards & Middleware
- ✅ Validation Pipes

### Phase 2: Authentication System (Week 3-4)

- ✅ Auth Service & Repository
- ✅ JWT Token handling
- ✅ OAuth integration
- ✅ 2FA functionality

### Phase 3: Business Logic (Week 5-6)

- User Management CRUD
- Role & Permission system
- Product & Order management
- Payment processing

### Phase 4: Integration & E2E (Week 7-8)

- Complete user journeys
- API endpoint testing
- Database integration
- External service mocking

## 📊 Coverage Goals

### Target Thresholds

```javascript
// jest.config.ts
coverageThreshold: {
  global: {
    branches: 80,
    functions: 85,
    lines: 80,
    statements: 80,
  }
}
```

### Priority Areas

- 🔴 **Critical (95%+)**: Auth, Security, Payments
- 🟡 **High (85%+)**: Business Logic, User Management
- 🟢 **Medium (75%+)**: Controllers, Utilities

## 🛠️ Testing Commands

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov

# Debug tests
npm run test:debug

# CI/CD pipeline
npm run test:ci
```

## ✅ Testing Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
it('should hash password successfully', async () => {
  // Arrange
  const plainPassword = 'password123'

  // Act
  const hashedPassword = await service.hash(plainPassword)

  // Assert
  expect(hashedPassword).toBeDefined()
  expect(hashedPassword).not.toBe(plainPassword)
})
```

### 2. Descriptive Test Names

```typescript
// ✅ Good
it('should throw EmailAlreadyExistsException when registering with existing email')

// ❌ Bad
it('should fail registration')
```

### 3. Mock External Dependencies

```typescript
const mockEmailService = {
  sendOTP: jest.fn().mockResolvedValue({ success: true }),
}
```

### 4. Test Data Factories

```typescript
const testDataFactory = {
  user: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  }),
}
```

### 5. Error Testing

```typescript
it('should throw InvalidOTPException for expired code', async () => {
  // Setup expired code
  await expect(service.validateOTP(expiredCode)).rejects.toThrow(InvalidOTPException)
})
```

## 🔧 Configuration Files

### jest.config.ts

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  // ... other config
}
```

### Test Database Setup

```typescript
// test/setup.ts
beforeAll(async () => {
  // Create test database
  // Run migrations
  // Setup global mocks
})

afterAll(async () => {
  // Cleanup database
  // Close connections
})
```

## 📈 Coverage Reports

### Generate Reports

```bash
# HTML report
npm run test:cov
open coverage/lcov-report/index.html

# JSON report for CI
npm run test:ci
```

### Coverage Targets by Module

- `src/routes/auth/`: 95%+
- `src/shared/services/`: 90%+
- `src/routes/user/`: 85%+
- `src/routes/product/`: 80%+

## 🐛 Debugging Tests

### Debug Single Test

```bash
npm run test:debug -- --testNamePattern="should hash password"
```

### VSCode Debug Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## 🚨 Common Issues & Solutions

### Issue 1: Database Connection in Tests

```typescript
// ✅ Solution: Use test database
beforeEach(async () => {
  await resetDatabase()
})
```

### Issue 2: Async Test Timeouts

```typescript
// ✅ Solution: Increase timeout
it('should handle slow operation', async () => {
  // test logic
}, 10000) // 10 second timeout
```

### Issue 3: Mock Not Working

```typescript
// ✅ Solution: Clear mocks
afterEach(() => {
  jest.clearAllMocks()
})
```

## 📝 Example Test Files

### Unit Test Example

```typescript
// src/shared/services/__tests__/hashing.service.spec.ts
describe('HashingService', () => {
  let service: HashingService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [HashingService],
    }).compile()

    service = module.get(HashingService)
  })

  it('should hash password successfully', async () => {
    const password = 'password123'
    const hash = await service.hash(password)

    expect(hash).toBeDefined()
    expect(hash).not.toBe(password)
  })
})
```

### Integration Test Example

```typescript
// test/integration/auth-flow.integration.spec.ts
describe('Auth Flow Integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  it('should complete registration workflow', async () => {
    // Multi-step integration test
  })
})
```

## 🎓 Learning Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 📞 Support

Nếu gặp vấn đề với testing:

1. Check existing test examples
2. Review error messages carefully
3. Use debug mode để troubleshoot
4. Consult team members

---

**Happy Testing! 🧪✨**
