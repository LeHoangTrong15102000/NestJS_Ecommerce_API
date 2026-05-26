import { PrismaClient, User } from '@prisma/client'
import bcrypt from 'bcryptjs'

export interface UserFactoryOptions {
  email?: string
  name?: string
  password?: string
  phoneNumber?: string
  roleId?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  totpSecret?: string | null
  avatar?: string | null
}

/**
 * DB-writing factory for User records.
 * Uses global.__GLOBAL_PRISMA__ to write directly to the test database.
 * Handles password hashing automatically using bcryptjs (same as HashingService).
 */
export const UserFactory = {
  /**
   * Create a user with a hashed password in the database.
   * Defaults to an ACTIVE CLIENT user.
   */
  async create(overrides: UserFactoryOptions = {}): Promise<User> {
    const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

    const email = overrides.email ?? `user-${Date.now()}-${Math.floor(Math.random() * 10000)}@factory.test`
    const rawPassword = overrides.password ?? 'Password123!'
    const hashedPassword = await bcrypt.hash(rawPassword, 10)

    return prisma.user.create({
      data: {
        email,
        name: overrides.name ?? email.split('@')[0],
        password: hashedPassword,
        phoneNumber: overrides.phoneNumber ?? `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        roleId: overrides.roleId ?? 2, // CLIENT role
        status: overrides.status ?? 'ACTIVE',
        totpSecret: overrides.totpSecret ?? null,
        avatar: overrides.avatar ?? null,
      },
    })
  },

  /**
   * Create an admin user (roleId: 1).
   */
  async createAdmin(overrides: UserFactoryOptions = {}): Promise<User> {
    return UserFactory.create({ roleId: 1, ...overrides })
  },

  /**
   * Create a seller user (roleId: 3).
   */
  async createSeller(overrides: UserFactoryOptions = {}): Promise<User> {
    return UserFactory.create({ roleId: 3, ...overrides })
  },
}
