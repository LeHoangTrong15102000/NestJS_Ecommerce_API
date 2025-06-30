// Mock bcrypt globally để tránh lỗi native binding trong unit tests
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

// Mock helpers functions
jest.mock('src/shared/helpers', () => ({
  generateOTP: jest.fn().mockReturnValue('123456'),
  isUniqueConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
}))
