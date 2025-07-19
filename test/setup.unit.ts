// Mock helpers functions
jest.mock('src/shared/helpers', () => ({
  generateOTP: jest.fn().mockReturnValue('123456'),
  isUniqueConstraintPrismaError: jest.fn(),
  isNotFoundPrismaError: jest.fn(),
}))
