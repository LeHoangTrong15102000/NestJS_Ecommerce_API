import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { TokenService } from '../../src/shared/services/token.service'
import { cleanupDatabase, seedTestData } from '../setup'
import { PrismaClient } from '@prisma/client'

/**
 * Reset database by truncating all tables
 */
export const resetDatabase = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Disable foreign key checks and truncate all tables
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.device.deleteMany(),
    prisma.verificationCode.deleteMany(),
    prisma.userTranslation.deleteMany(),
    prisma.user.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.language.deleteMany(),
  ])
}

/**
 * Create test NestJS application
 */
export const createTestApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(global.__GLOBAL_PRISMA__)
    .compile()

  const app = moduleFixture.createNestApplication()
  await app.init()

  return app
}

/**
 * Test data factories
 */
export const testDataFactory = {
  user: (overrides: Partial<any> = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashedPassword123',
    roleId: 2, // Client role
    status: 'ACTIVE' as const,
    avatar: null,
    totpSecret: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  role: (overrides: Partial<any> = {}) => ({
    id: 1,
    name: 'CLIENT',
    description: 'Client role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: [],
    ...overrides,
  }),

  permission: (overrides: Partial<any> = {}) => ({
    id: 1,
    name: 'users.read',
    description: 'Read users',
    path: '/users',
    method: 'GET' as const,
    module: 'USERS',
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  verificationCode: (overrides: Partial<any> = {}) => ({
    id: 1,
    email: 'test@example.com',
    code: '123456',
    type: 'REGISTER' as const,
    expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  tokens: (overrides: Partial<any> = {}) => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    ...overrides,
  }),
}

/**
 * Create test user with authentication
 */
export const createTestUser = async (
  prisma: PrismaClient,
  tokenService: TokenService,
  hashingService: HashingService,
  userData: Partial<any> = {},
) => {
  // Create role if not exists
  let role = await prisma.role.findFirst({
    where: { name: 'CLIENT' },
  })

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'CLIENT',
        description: 'Client role',
      },
    })
  }

  const defaultUserData = {
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'password123',
    roleId: role.id,
    status: 'ACTIVE' as const,
  }

  const finalUserData = { ...defaultUserData, ...userData }

  // Hash password
  const hashedPassword = await hashingService.hash(finalUserData.password)

  // Create user
  const user = await prisma.user.create({
    data: {
      ...finalUserData,
      password: hashedPassword,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  })

  // Generate tokens
  const accessToken = tokenService.signAccessToken({
    userId: user.id,
    roleId: user.roleId,
    deviceId: 1,
    roleName: user.role.name,
  })

  const refreshToken = tokenService.signRefreshToken({
    userId: user.id,
  })

  return {
    user,
    accessToken,
    refreshToken,
  }
}

/**
 * Utility function to expect errors with proper typing
 */
export const expectError = async (fn: () => Promise<any>, expectedErrorClass: new (...args: any[]) => Error) => {
  await expect(fn()).rejects.toThrow(expectedErrorClass)
}

/**
 * Mock service factory
 */
export const createMockService = <T>(serviceMethods: (keyof T)[]): jest.Mocked<T> => {
  const mock = {} as jest.Mocked<T>

  serviceMethods.forEach((method) => {
    mock[method] = jest.fn() as any
  })

  return mock
}
