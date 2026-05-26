import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

/**
 * Global setup — runs once before all test suites.
 * Ensures the test database schema is up-to-date by running prisma migrate deploy.
 * This runs in a separate Node.js context from the test files.
 */
export default async function globalSetup() {
  // Run prisma migrate deploy to ensure schema is current
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
      },
    })
  } catch (error) {
    console.error('Failed to run prisma migrate deploy:', error)
    throw error
  }

  // Verify database connectivity
  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    await prisma.$disconnect()
  } catch (error) {
    console.error('Failed to connect to test database:', error)
    throw error
  }
}
