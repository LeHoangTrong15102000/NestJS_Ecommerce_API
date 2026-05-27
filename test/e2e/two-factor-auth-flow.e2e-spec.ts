import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { TwoFactorService } from '../../src/shared/services/2fa.service'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { UserFactory } from '../factories'
import {
  createAuthenticatedUser,
  enable2FA,
  generateTOTPCode,
  resetDatabase,
  sendOTPAndGetCode,
} from '../helpers/test-helpers'
import { TypeOfVerificationCode } from '../../src/shared/constants/auth.constant'

describe('2FA Complete Flow E2E', () => {
  let app: INestApplication
  let twoFactorService: TwoFactorService

  const mockEmailService = {
    sendOTP: jest.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null }),
    sendEmail: jest.fn().mockResolvedValue({ error: null }),
  }
  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile()

    app = moduleFixture.createNestApplication()
    twoFactorService = moduleFixture.get<TwoFactorService>(TwoFactorService)
    await app.init()
  })

  afterAll(async () => {
    try {
      await app?.close()
    } catch {
      // Ignore cleanup errors during test teardown
    }
  })

  beforeEach(async () => {
    await resetDatabase()
    jest.clearAllMocks()
  })

  describe('Setup TOTP → Enable 2FA → Login with TOTP', () => {
    it('should complete the full 2FA setup and login flow', async () => {
      // Step 1: Create and authenticate a user
      const email = 'twofa-flow@test.com'
      const password = 'Password123!'
      const { accessToken } = await createAuthenticatedUser(app, email, password)

      // Step 2: Enable 2FA — POST /auth/2fa/enable
      const enableRes = await request(app.getHttpServer())
        .post('/auth/2fa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201)

      expect(enableRes.body).toHaveProperty('secret')
      expect(enableRes.body).toHaveProperty('uri')
      const { secret } = enableRes.body

      // Step 3: Verify user now has totpSecret in DB
      const prisma = global.__GLOBAL_PRISMA__!
      const userWithSecret = await prisma.user.findFirst({ where: { email } })
      expect(userWithSecret?.totpSecret).toBeDefined()
      expect(userWithSecret?.totpSecret).not.toBeNull()

      // Step 4: Login without TOTP code — should fail (2FA required)
      const loginWithoutTOTP = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({ email, password })

      // When 2FA is enabled, login without totpCode should require it
      expect([400, 401, 422]).toContain(loginWithoutTOTP.status)

      // Step 5: Generate valid TOTP code from secret
      const totpCode = generateTOTPCode(email, secret, twoFactorService)
      expect(totpCode).toHaveLength(6)

      // Step 6: Login WITH valid TOTP code — should succeed
      const loginWithTOTP = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({ email, password, totpCode })
        .expect(201)

      expect(loginWithTOTP.body).toHaveProperty('accessToken')
      expect(loginWithTOTP.body).toHaveProperty('refreshToken')
      expect(typeof loginWithTOTP.body.accessToken).toBe('string')
    })

    it('should reject login with invalid TOTP code when 2FA is enabled', async () => {
      const email = 'twofa-invalid@test.com'
      const password = 'Password123!'
      const { accessToken } = await createAuthenticatedUser(app, email, password)

      // Enable 2FA
      await enable2FA(app, accessToken)

      // Attempt login with wrong TOTP code
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({ email, password, totpCode: '000000' })

      expect([400, 401, 422]).toContain(res.status)
    })

    it('should allow login without TOTP when 2FA is not enabled', async () => {
      // Create user via factory (no 2FA)
      const user = await UserFactory.create({ email: 'no-2fa@test.com', password: 'Password123!' })

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({ email: user.email, password: 'Password123!' })
        .expect(201)

      expect(res.body).toHaveProperty('accessToken')
    })

    it('should disable 2FA with valid TOTP code', async () => {
      const email = 'twofa-disable@test.com'
      const password = 'Password123!'
      const { accessToken } = await createAuthenticatedUser(app, email, password)

      // Enable 2FA
      const { secret } = await enable2FA(app, accessToken)

      // Generate fresh TOTP code
      const totpCode = generateTOTPCode(email, secret, twoFactorService)

      // Disable 2FA
      const disableRes = await request(app.getHttpServer())
        .post('/auth/2fa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ totpCode })
        .expect(200)

      expect(disableRes.body).toBeDefined()

      // Verify user no longer has totpSecret
      const prisma = global.__GLOBAL_PRISMA__!
      const user = await prisma.user.findFirst({ where: { email } })
      expect(user?.totpSecret).toBeNull()
    })

    it('should allow OTP-based 2FA disable flow', async () => {
      const email = 'twofa-otp-disable@test.com'
      const password = 'Password123!'
      const { accessToken } = await createAuthenticatedUser(app, email, password)

      // Enable 2FA
      await enable2FA(app, accessToken)

      // Request OTP for disable
      const otpCode = await sendOTPAndGetCode(app, email, TypeOfVerificationCode.DISABLE_2FA)
      expect(otpCode).toHaveLength(6)

      // Disable 2FA using OTP
      const disableRes = await request(app.getHttpServer())
        .post('/auth/2fa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: otpCode })
        .expect(200)

      expect(disableRes.body).toBeDefined()
    })
  })
})
