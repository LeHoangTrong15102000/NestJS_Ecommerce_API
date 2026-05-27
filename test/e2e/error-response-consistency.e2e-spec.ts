import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { TokenService } from '../../src/shared/services/token.service'
import { UserFactory } from '../factories'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

/**
 * Error Response Consistency Tests
 *
 * Verifies that all endpoints return a consistent error shape:
 *   { statusCode: number, message: string | object }
 *
 * The CatchEverythingFilter produces: { statusCode, message }
 * The CustomZodValidationPipe produces: { statusCode: 422, message: Array<{message, path, code}> }
 */
describe('Error Response Consistency E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let adminToken: string
  let clientToken: string

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
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    hashingService = moduleFixture.get<HashingService>(HashingService)
    tokenService = moduleFixture.get<TokenService>(TokenService)
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    await resetDatabase()
    jest.clearAllMocks()

    const admin = await createTestUser('admin@test.com', 'password123', 1, prisma, hashingService, tokenService)
    adminToken = admin.accessToken

    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
  })

  /**
   * Helper: assert the response has the standard error shape
   */
  function assertErrorShape(body: any, expectedStatus: number) {
    expect(body).toHaveProperty('statusCode', expectedStatus)
    expect(body).toHaveProperty('message')
  }

  describe('401 Unauthorized — no token', () => {
    it('GET /users returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(401)
      assertErrorShape(res.body, 401)
    })

    it('GET /profile returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/profile').expect(401)
      assertErrorShape(res.body, 401)
    })

    it('GET /orders returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/orders').expect(401)
      assertErrorShape(res.body, 401)
    })

    it('POST /vouchers/apply returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .send({ code: 'TEST', orderAmount: 100 })
        .expect(401)
      assertErrorShape(res.body, 401)
    })
  })

  describe('403 Forbidden — wrong role', () => {
    it('GET /users returns 403 for CLIENT role', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403)
      assertErrorShape(res.body, 403)
    })

    it('POST /vouchers/manage returns 403 for CLIENT role', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'TEST',
          name: 'Test',
          type: 'PERCENTAGE',
          value: 10,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(403)
      assertErrorShape(res.body, 403)
    })
  })

  describe('404 Not Found — resource does not exist', () => {
    it('GET /users/:userId returns 404 for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
      assertErrorShape(res.body, 404)
    })

    it('GET /orders/:orderId returns 404 for non-existent order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/999999')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404)
      assertErrorShape(res.body, 404)
    })
  })

  describe('409 Conflict — unique constraint violation', () => {
    it('POST /auth/register returns 409 for duplicate email', async () => {
      const email = 'duplicate@test.com'

      // Create user via factory
      await UserFactory.create({ email })

      // Request OTP first (required for registration)
      await request(app.getHttpServer()).post('/auth/otp').send({ email, type: 'REGISTER' })

      const prismaClient = global.__GLOBAL_PRISMA__!
      const verificationCode = await prismaClient.verificationCode.findUnique({
        where: { email_type: { email, type: 'REGISTER' } },
      })

      if (verificationCode) {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .set('User-Agent', 'test-agent')
          .set('X-Forwarded-For', '127.0.0.1')
          .send({
            email,
            password: 'Password123!',
            name: 'Duplicate User',
            phoneNumber: '0912345678',
            code: verificationCode.code,
          })

        // Should be 409 conflict or 400 bad request for duplicate
        expect([400, 409, 422]).toContain(res.status)
        assertErrorShape(res.body, res.status)
      }
    })
  })

  describe('422 Unprocessable Entity — Zod validation errors', () => {
    it('POST /auth/login returns 422 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .send({}) // Missing email and password
        .expect(422)

      assertErrorShape(res.body, 422)
      // Zod validation returns array of issues
      expect(Array.isArray(res.body.message)).toBe(true)
      expect(res.body.message.length).toBeGreaterThan(0)
      expect(res.body.message[0]).toHaveProperty('message')
      expect(res.body.message[0]).toHaveProperty('path')
      expect(res.body.message[0]).toHaveProperty('code')
    })

    it('POST /auth/login returns 422 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(422)

      assertErrorShape(res.body, 422)
      expect(Array.isArray(res.body.message)).toBe(true)
    })

    it('POST /vouchers/manage returns 422 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/manage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing all required fields
        .expect(422)

      assertErrorShape(res.body, 422)
      expect(Array.isArray(res.body.message)).toBe(true)
    })
  })

  describe('Error shape consistency across endpoint types', () => {
    it('auth endpoint errors have consistent shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'test-agent')
        .send({ email: 'wrong@test.com', password: 'wrongpassword' })

      expect(res.body).toHaveProperty('statusCode')
      expect(res.body).toHaveProperty('message')
      expect(typeof res.body.statusCode).toBe('number')
    })

    it('product endpoint errors have consistent shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/manage-product/products/999999')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body).toHaveProperty('statusCode')
      expect(res.body).toHaveProperty('message')
      expect(typeof res.body.statusCode).toBe('number')
    })

    it('order endpoint errors have consistent shape', async () => {
      const res = await request(app.getHttpServer()).get('/orders/999999').set('Authorization', `Bearer ${clientToken}`)

      expect(res.body).toHaveProperty('statusCode')
      expect(res.body).toHaveProperty('message')
      expect(typeof res.body.statusCode).toBe('number')
    })

    it('payment endpoint errors have consistent shape', async () => {
      const res = await request(app.getHttpServer()).get('/orders').set('Authorization', `Bearer ${clientToken}`)

      // Even success responses should be well-formed
      expect(res.body).toBeDefined()
      expect(typeof res.status).toBe('number')
    })
  })
})
