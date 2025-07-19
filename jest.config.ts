import type { Config } from 'jest'

const config: Config = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test discovery - loại bỏ integration tests khỏi mặc định
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'test/integration/', 'test/e2e/'],
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },

  // Module resolution - fix để support src/* imports
  rootDir: '.',
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.(t|j)s?(x)',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.model.ts',
    '!src/**/*.error.ts',
    '!src/**/*.constant.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 4,
      lines: 30,
      statements: 30,
    },
  },

  // Setup files for unit tests
  setupFilesAfterEnv: ['<rootDir>/test/setup.unit.ts'],

  // Test timeout
  testTimeout: 30000,

  // Force exit để tránh worker process hang
  forceExit: true,
  detectOpenHandles: true,

  // Parallel execution
  maxWorkers: '50%',

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
}

export default config
