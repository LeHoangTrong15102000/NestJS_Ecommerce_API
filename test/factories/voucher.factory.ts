import { PrismaClient, Voucher } from '@prisma/client'

export interface VoucherFactoryOptions {
  code?: string
  name?: string
  description?: string
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y'
  value?: number
  minOrderValue?: number | null
  maxDiscount?: number | null
  usageLimit?: number | null
  userUsageLimit?: number | null
  startDate?: Date
  endDate?: Date
  isActive?: boolean
  sellerId?: number | null
  createdById?: number | null
  applicableProducts?: number[]
  excludedProducts?: number[]
  /** Shorthand: create an already-expired voucher */
  expired?: boolean
  /** Shorthand: set usedCount equal to usageLimit (fully used up) */
  fullyUsed?: boolean
}

/**
 * DB-writing factory for Voucher records.
 * Supports configurable discount rules and convenience shorthands for edge cases.
 * Uses global.__GLOBAL_PRISMA__ to write directly to the test database.
 */
export const VoucherFactory = {
  /**
   * Create a voucher with configurable rules.
   * Defaults to an active PERCENTAGE voucher valid for 30 days.
   */
  async create(overrides: VoucherFactoryOptions = {}): Promise<Voucher> {
    const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

    const now = new Date()
    const isExpired = overrides.expired === true

    const startDate =
      overrides.startDate ?? (isExpired ? new Date(now.getTime() - 60 * 86400000) : new Date(now.getTime() - 86400000))
    const endDate =
      overrides.endDate ?? (isExpired ? new Date(now.getTime() - 86400000) : new Date(now.getTime() + 30 * 86400000))

    const usageLimit = overrides.usageLimit !== undefined ? overrides.usageLimit : 100
    const usedCount = overrides.fullyUsed ? (usageLimit ?? 100) : 0

    const code = overrides.code ?? `VOUCHER-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    return prisma.voucher.create({
      data: {
        code,
        name: overrides.name ?? `Test Voucher ${code}`,
        description: overrides.description ?? null,
        type: overrides.type ?? 'PERCENTAGE',
        value: overrides.value ?? 10,
        minOrderValue: overrides.minOrderValue !== undefined ? overrides.minOrderValue : null,
        maxDiscount: overrides.maxDiscount !== undefined ? overrides.maxDiscount : null,
        usageLimit,
        usedCount,
        userUsageLimit: overrides.userUsageLimit !== undefined ? overrides.userUsageLimit : 1,
        startDate,
        endDate,
        isActive: overrides.isActive !== undefined ? overrides.isActive : true,
        sellerId: overrides.sellerId ?? null,
        createdById: overrides.createdById ?? null,
        applicableProducts: overrides.applicableProducts ?? [],
        excludedProducts: overrides.excludedProducts ?? [],
      },
    })
  },

  /**
   * Create an expired voucher (endDate in the past).
   */
  async createExpired(overrides: VoucherFactoryOptions = {}): Promise<Voucher> {
    return VoucherFactory.create({ ...overrides, expired: true })
  },

  /**
   * Create a voucher that has reached its usage limit.
   */
  async createFullyUsed(overrides: VoucherFactoryOptions = {}): Promise<Voucher> {
    return VoucherFactory.create({ ...overrides, fullyUsed: true, usageLimit: overrides.usageLimit ?? 10 })
  },

  /**
   * Create a voucher with a minimum order value requirement.
   */
  async createWithMinAmount(minOrderValue: number, overrides: VoucherFactoryOptions = {}): Promise<Voucher> {
    return VoucherFactory.create({ ...overrides, minOrderValue })
  },
}
