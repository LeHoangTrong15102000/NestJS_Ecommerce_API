import { PrismaClient } from '@prisma/client'

/**
 * Global teardown — runs once after all test suites complete.
 * Disconnects the Prisma client to cleanly release database connections.
 * This runs in a separate Node.js context from the test files.
 */
export default async function globalTeardown() {
  // Disconnect any lingering Prisma connections
  const prisma = new PrismaClient()
  try {
    await prisma.$disconnect()
  } catch {
    // Ignore disconnect errors during teardown
  }
}
