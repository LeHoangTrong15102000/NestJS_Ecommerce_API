import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'

// Global test database setup
declare global {
  var __GLOBAL_PRISMA__: PrismaClient | undefined
}

// Test database name with random suffix to avoid conflicts
const testDbName = `test_ecommerce_${randomBytes(8).toString('hex')}`

/**
 * Setup test database before all tests
 */
beforeAll(async () => {
  // Create test database
  const originalDbUrl = process.env.DATABASE_URL
  const testDbUrl = originalDbUrl?.replace(/\/[^\/]+$/, `/${testDbName}`)

  // Set test database URL
  process.env.DATABASE_URL = testDbUrl

  // Create database and run migrations
  execSync(`npx prisma db push --force-reset`, { stdio: 'inherit' })

  // Initialize global Prisma client
  global.__GLOBAL_PRISMA__ = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  })

  await global.__GLOBAL_PRISMA__.$connect()
})

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  if (global.__GLOBAL_PRISMA__) {
    await global.__GLOBAL_PRISMA__.$disconnect()
  }

  // Drop test database
  try {
    execSync(`npx prisma db execute --command "DROP DATABASE IF EXISTS ${testDbName}"`, {
      stdio: 'inherit',
    })
  } catch (error) {
    console.warn(`Failed to drop test database: ${error}`)
  }
})

/**
 * Clean up data between tests (keep schema)
 */
export const cleanupDatabase = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Get all table names
  const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `

  // Disable foreign key checks and truncate all tables
  await prisma.$transaction(
    tableNames.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE`)),
  )
}

/**
 * Seed basic data for testing
 */
export const seedTestData = async () => {
  if (!global.__GLOBAL_PRISMA__) return

  const prisma = global.__GLOBAL_PRISMA__

  // Create basic roles
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Administrator role',
    },
  })

  const clientRole = await prisma.role.create({
    data: {
      name: 'CLIENT',
      description: 'Client role',
    },
  })

  // Create basic permissions
  const permissions = await prisma.permission.createMany({
    data: [
      {
        name: 'users.read',
        description: 'Read users',
        path: '/users',
        method: 'GET',
        module: 'USERS',
      },
      {
        name: 'users.create',
        description: 'Create users',
        path: '/users',
        method: 'POST',
        module: 'USERS',
      },
    ],
  })

  return { adminRole, clientRole, permissions }
}
