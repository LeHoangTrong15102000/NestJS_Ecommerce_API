import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Auth Flow Integration', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Complete Registration Flow', () => {
    const testUser = {
      email: 'integration@test.com',
      name: 'Integration Test User',
      phoneNumber: '0987654321',
      password: 'password123',
      confirmPassword: 'password123',
    }

    it('should complete full registration workflow', async () => {
      // Step 1: Send OTP for registration
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/otp')
        .send({
          email: testUser.email,
          type: 'REGISTER',
        })
        .expect(200)

      expect(otpResponse.body.message).toBe('Gửi mã OTP thành công')

      // Step 2: Get OTP code from database (simulation)
      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      expect(verificationCode).toBeDefined()
      expect(verificationCode?.code).toHaveLength(6)

      // Step 3: Register with OTP
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser,
          code: verificationCode?.code,
        })
        .expect(201)

      expect(registerResponse.body).toMatchObject({
        id: expect.any(Number),
        email: testUser.email,
        name: testUser.name,
        phoneNumber: testUser.phoneNumber,
        status: 'INACTIVE',
      })

      // Verify password is not returned
      expect(registerResponse.body.password).toBeUndefined()

      // Step 4: Verify user exists in database
      const createdUser = await prisma.user.findFirst({
        where: { email: testUser.email },
        include: { role: true },
      })

      expect(createdUser).toBeDefined()
      expect(createdUser?.email).toBe(testUser.email)
      expect(createdUser?.role.name).toBe('CLIENT')

      // Step 5: Verify OTP is deleted after use
      const usedVerificationCode = await prisma.verificationCode.findFirst({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      expect(usedVerificationCode).toBeNull()
    })

    it('should reject registration with expired OTP', async () => {
      // Step 1: Send OTP
      await request(app.getHttpServer())
        .post('/auth/otp')
        .send({
          email: testUser.email,
          type: 'REGISTER',
        })
        .expect(200)

      // Step 2: Manually expire the OTP
      await prisma.verificationCode.updateMany({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
        data: {
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      })

      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          email: testUser.email,
          type: 'REGISTER',
        },
      })

      // Step 3: Try to register with expired OTP
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser,
          code: verificationCode?.code,
        })
        .expect(400)

      expect(registerResponse.body.message).toContain('OTP đã hết hạn')
    })

    it('should reject duplicate email registration', async () => {
      // Step 1: Create existing user
      const existingUser = await prisma.user.create({
        data: {
          email: testUser.email,
          name: 'Existing User',
          phoneNumber: '0111111111',
          password: 'hashedPassword',
          roleId: 1,
          status: 'ACTIVE',
        },
      })

      // Step 2: Try to send OTP for existing email
      const otpResponse = await request(app.getHttpServer())
        .post('/auth/otp')
        .send({
          email: testUser.email,
          type: 'REGISTER',
        })
        .expect(400)

      expect(otpResponse.body.message).toContain('Email đã tồn tại')
    })
  })

  describe('Complete Login Flow', () => {
    const testUser = {
      email: 'login@test.com',
      password: 'password123',
    }

    beforeEach(async () => {
      // Create test user for login tests
      await prisma.user.create({
        data: {
          email: testUser.email,
          name: 'Login Test User',
          phoneNumber: '0123456789',
          password: '$2b$10$hashedPasswordExample', // Pre-hashed password
          roleId: 1,
          status: 'ACTIVE',
        },
      })
    })

    it('should login successfully and return tokens', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      expect(loginResponse.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })

      // Verify device is created
      const device = await prisma.device.findFirst({
        where: {
          userAgent: 'test-agent',
        },
      })

      expect(device).toBeDefined()
      expect(device?.isActive).toBe(true)

      // Verify refresh token is stored
      const refreshToken = await prisma.refreshToken.findFirst({
        where: {
          userId: device?.userId,
          deviceId: device?.id,
        },
      })

      expect(refreshToken).toBeDefined()
    })

    it('should logout successfully and invalidate tokens', async () => {
      // Step 1: Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      const { refreshToken } = loginResponse.body

      // Step 2: Logout
      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({
          refreshToken,
        })
        .expect(200)

      expect(logoutResponse.body.message).toContain('Đăng xuất thành công')

      // Step 3: Verify refresh token is deleted
      const deletedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
        },
      })

      expect(deletedToken).toBeNull()

      // Step 4: Verify device is deactivated
      const device = await prisma.device.findFirst({
        where: {
          userAgent: 'test-agent',
        },
      })

      expect(device?.isActive).toBe(false)
    })

    it('should refresh tokens successfully', async () => {
      // Step 1: Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      const { refreshToken: oldRefreshToken } = loginResponse.body

      // Step 2: Wait a moment to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Step 3: Refresh tokens
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({
          refreshToken: oldRefreshToken,
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      expect(refreshResponse.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      })

      // Verify new tokens are different
      expect(refreshResponse.body.refreshToken).not.toBe(oldRefreshToken)

      // Verify old refresh token is deleted
      const oldToken = await prisma.refreshToken.findFirst({
        where: {
          token: oldRefreshToken,
        },
      })

      expect(oldToken).toBeNull()

      // Verify new refresh token exists
      const newToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshResponse.body.refreshToken,
        },
      })

      expect(newToken).toBeDefined()
    })
  })

  describe('2FA Flow', () => {
    let testUserId: number
    let accessToken: string

    beforeEach(async () => {
      // Create test user and login
      const user = await prisma.user.create({
        data: {
          email: '2fa@test.com',
          name: '2FA Test User',
          phoneNumber: '0123456789',
          password: '$2b$10$hashedPasswordExample',
          roleId: 1,
          status: 'ACTIVE',
        },
      })

      testUserId = user.id

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'password123',
        })
        .set('User-Agent', 'test-agent')
        .expect(200)

      accessToken = loginResponse.body.accessToken
    })

    it('should enable 2FA successfully', async () => {
      const enable2FAResponse = await request(app.getHttpServer())
        .post('/auth/2fa/enable')
        .send({})
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(enable2FAResponse.body).toMatchObject({
        qrCode: expect.any(String),
        secret: expect.any(String),
      })

      // Verify user has TOTP secret in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
      })

      expect(updatedUser?.totpSecret).toBeDefined()
      expect(updatedUser?.totpSecret).not.toBeNull()
    })
  })
})
