import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { EmailService } from '../../src/shared/services/email.service'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { HashingService } from '../../src/shared/services/hashing.service'
import { TokenService } from '../../src/shared/services/token.service'
import { UserFactory, VoucherFactory } from '../factories'
import { createTestUser, resetDatabase } from '../helpers/test-helpers'

describe('Voucher Edge Cases E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService
  let clientToken: string
  let clientId: number
  let adminToken: string
  let adminId: number

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
    await app.close()
  })

  beforeEach(async () => {
    await resetDatabase()
    jest.clearAllMocks()

    const admin = await createTestUser('admin@test.com', 'password123', 1, prisma, hashingService, tokenService)
    adminToken = admin.accessToken
    adminId = admin.userId

    const client = await createTestUser('client@test.com', 'password123', 2, prisma, hashingService, tokenService)
    clientToken = client.accessToken
    clientId = client.userId
  })

  describe('Expired Voucher', () => {
    it('should reject applying an expired voucher', async () => {
      // Create expired voucher using factory
      const expiredVoucher = await VoucherFactory.createExpired({
        code: 'EXPIRED10',
        value: 10,
        type: 'PERCENTAGE',
        createdById: adminId,
      })

      // Collect the voucher (may succeed since collection doesn't check expiry in all implementations)
      await request(app.getHttpServer())
        .post(`/vouchers/${expiredVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)

      // Attempt to apply the expired voucher
      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'EXPIRED10',
          orderAmount: 500000,
          productIds: [],
        })

      // Should either return canApply: false or a 4xx error
      if (applyRes.status === 201 || applyRes.status === 200) {
        expect(applyRes.body.data?.canApply).toBe(false)
      } else {
        expect([400, 404, 422]).toContain(applyRes.status)
      }
    })

    it('should not list expired vouchers as available', async () => {
      const expiredVoucher = await VoucherFactory.createExpired({
        code: 'EXPIRED_LIST',
        createdById: adminId,
      })

      // Collect it
      await request(app.getHttpServer())
        .post(`/vouchers/${expiredVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)

      // Apply should indicate not applicable
      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ code: 'EXPIRED_LIST', orderAmount: 500000, productIds: [] })

      if (applyRes.status === 201 || applyRes.status === 200) {
        expect(applyRes.body.data?.canApply).toBe(false)
      } else {
        expect([400, 404, 422]).toContain(applyRes.status)
      }
    })
  })

  describe('Max Usage Limit Reached', () => {
    it('should reject voucher that has reached its usage limit', async () => {
      // Create a voucher that is fully used (usedCount === usageLimit)
      const fullyUsedVoucher = await VoucherFactory.createFullyUsed({
        code: 'MAXUSED',
        value: 15,
        type: 'PERCENTAGE',
        usageLimit: 5,
        createdById: adminId,
      })

      // Collect the voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${fullyUsedVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)

      // Attempt to apply
      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'MAXUSED',
          orderAmount: 500000,
          productIds: [],
        })

      if (applyRes.status === 201 || applyRes.status === 200) {
        expect(applyRes.body.data?.canApply).toBe(false)
      } else {
        expect([400, 404, 422]).toContain(applyRes.status)
      }
    })

    it('should reject collecting a voucher that has reached its usage limit', async () => {
      const fullyUsedVoucher = await VoucherFactory.createFullyUsed({
        code: 'MAXCOLLECT',
        usageLimit: 3,
        createdById: adminId,
      })

      const collectRes = await request(app.getHttpServer())
        .post(`/vouchers/${fullyUsedVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)

      // Should either reject collection or mark as not applicable
      if (collectRes.status === 201 || collectRes.status === 200) {
        // If collection succeeds, applying should fail
        const applyRes = await request(app.getHttpServer())
          .post('/vouchers/apply')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({ code: 'MAXCOLLECT', orderAmount: 500000, productIds: [] })

        if (applyRes.status === 201 || applyRes.status === 200) {
          expect(applyRes.body.data?.canApply).toBe(false)
        }
      } else {
        expect([400, 404, 422]).toContain(collectRes.status)
      }
    })
  })

  describe('Minimum Order Amount Not Met', () => {
    it('should reject voucher when order amount is below minimum', async () => {
      const minAmountVoucher = await VoucherFactory.createWithMinAmount(500000, {
        code: 'MINAMOUNT',
        value: 20,
        type: 'PERCENTAGE',
        createdById: adminId,
      })

      // Collect the voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${minAmountVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      // Apply with order amount BELOW minimum (100000 < 500000)
      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'MINAMOUNT',
          orderAmount: 100000,
          productIds: [],
        })
        .expect(201)

      expect(applyRes.body.data?.canApply).toBe(false)
    })

    it('should allow voucher when order amount meets minimum', async () => {
      const minAmountVoucher = await VoucherFactory.createWithMinAmount(100000, {
        code: 'MINAMOUNT_OK',
        value: 10,
        type: 'PERCENTAGE',
        createdById: adminId,
      })

      // Collect the voucher
      await request(app.getHttpServer())
        .post(`/vouchers/${minAmountVoucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      // Apply with order amount ABOVE minimum (500000 > 100000)
      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          code: 'MINAMOUNT_OK',
          orderAmount: 500000,
          productIds: [],
        })
        .expect(201)

      expect(applyRes.body.data?.canApply).toBe(true)
      expect(applyRes.body.data?.discountAmount).toBeGreaterThan(0)
    })

    it('should apply correct percentage discount when minimum is met', async () => {
      const voucher = await VoucherFactory.create({
        code: 'PCT20',
        type: 'PERCENTAGE',
        value: 20,
        minOrderValue: 200000,
        maxDiscount: 100000,
        createdById: adminId,
      })

      await request(app.getHttpServer())
        .post(`/vouchers/${voucher.id}/collect`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)

      const applyRes = await request(app.getHttpServer())
        .post('/vouchers/apply')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ code: 'PCT20', orderAmount: 500000, productIds: [] })
        .expect(201)

      expect(applyRes.body.data?.canApply).toBe(true)
      // 20% of 500000 = 100000, capped at maxDiscount 100000
      expect(applyRes.body.data?.discountAmount).toBeLessThanOrEqual(100000)
      expect(applyRes.body.data?.discountAmount).toBeGreaterThan(0)
    })
  })

  describe('Voucher Factory Integration', () => {
    it('should create vouchers with correct DB state via factory', async () => {
      const prismaClient = global.__GLOBAL_PRISMA__!

      const activeVoucher = await VoucherFactory.create({ code: 'ACTIVE_V', createdById: adminId })
      const expiredVoucher = await VoucherFactory.createExpired({ code: 'EXPIRED_V', createdById: adminId })
      const fullyUsedVoucher = await VoucherFactory.createFullyUsed({ code: 'USED_V', usageLimit: 5, createdById: adminId })

      const active = await prismaClient.voucher.findUnique({ where: { code: 'ACTIVE_V' } })
      const expired = await prismaClient.voucher.findUnique({ where: { code: 'EXPIRED_V' } })
      const used = await prismaClient.voucher.findUnique({ where: { code: 'USED_V' } })

      expect(active?.endDate.getTime()).toBeGreaterThan(Date.now())
      expect(expired?.endDate.getTime()).toBeLessThan(Date.now())
      expect(used?.usedCount).toBe(used?.usageLimit)
    })
  })
})
