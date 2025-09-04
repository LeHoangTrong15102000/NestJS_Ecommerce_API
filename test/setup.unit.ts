// Mock helpers functions
jest.mock('src/shared/helpers', () => ({
  generateOTP: jest.fn().mockReturnValue('123456'),
  isUniqueConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
}))

// Tăng memory limit cho test environment
process.env.NODE_OPTIONS = '--max-old-space-size=4096'

// Cleanup global objects sau mỗi test
afterEach(() => {
  // Force garbage collection nếu có
  if (global.gc) {
    global.gc()
  }
})
