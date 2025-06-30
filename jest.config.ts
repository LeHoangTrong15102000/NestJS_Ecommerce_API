import type { Config } from 'jest'

const config: Config = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test discovery
  testRegex: '.*\\.spec\\.ts$',
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
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup files for unit tests
  setupFilesAfterEnv: ['<rootDir>/test/setup.unit.ts'],

  // Test timeout
  testTimeout: 10000,

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
