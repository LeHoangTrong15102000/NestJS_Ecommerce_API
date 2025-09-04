import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from '../auth.service'
import { AuthRepository } from '../auth.repo'
import { HashingService } from '../../../shared/services/hashing.service'
import { TokenService } from '../../../shared/services/token.service'
import { EmailService } from '../../../shared/services/email.service'
import { TwoFactorService } from '../../../shared/services/2fa.service'
import { SharedUserRepository } from '../../../shared/repositories/shared-user.repo'
import { SharedRoleRepository } from '../../../shared/repositories/shared-role.repo'
import {
  EmailAlreadyExistsException,
  EmailNotFoundException,
  InvalidOTPException,
  OTPExpiredException,
  TOTPNotEnabledException,
} from '../auth.error'
import { TypeOfVerificationCode } from '../../../shared/constants/auth.constant'
import { isUniqueConstraintPrismaError } from '../../../shared/helpers'

const mockIsUniqueConstraintPrismaError = isUniqueConstraintPrismaError as jest.MockedFunction<
  typeof isUniqueConstraintPrismaError
>

// Simple test data factory để tránh memory leak
const createTestData = {
  verificationCode: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    code: '123456',
    type: TypeOfVerificationCode.REGISTER,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    phoneNumber: '0123456789',
    password: 'hashedPassword123',
    roleId: 2,
    status: 'ACTIVE' as const,
    avatar: null,
    totpSecret: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  role: (overrides = {}) => ({
    id: 1,
    name: 'CLIENT',
    description: 'Client role',
    isActive: true,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: [],
    ...overrides,
  }),

  tokens: (overrides = {}) => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    ...overrides,
  }),
}

describe('AuthService', () => {
  let service: AuthService
  let module: TestingModule
  let mockAuthRepo: jest.Mocked<AuthRepository>
  let mockHashingService: jest.Mocked<HashingService>
  let mockTokenService: jest.Mocked<TokenService>
  let mockEmailService: jest.Mocked<EmailService>
  let mockTwoFactorService: jest.Mocked<TwoFactorService>
  let mockSharedUserRepo: jest.Mocked<SharedUserRepository>
  let mockSharedRoleRepo: jest.Mocked<SharedRoleRepository>

  beforeEach(async () => {
    // Create mocks with proper typing - tối ưu hóa để tránh memory leak
    mockAuthRepo = {
      findUniqueVerificationCode: jest.fn(),
      createUser: jest.fn(),
      deleteVerificationCode: jest.fn(),
      createVerificationCode: jest.fn(),
      findUniqueUserIncludeRole: jest.fn(),
      createDevice: jest.fn(),
      createRefreshToken: jest.fn(),
    } as any

    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any

    mockTokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      decodeRefreshToken: jest.fn(),
    } as any

    mockEmailService = {
      sendOTP: jest.fn(),
    } as any

    mockTwoFactorService = {
      verifyTOTP: jest.fn(),
    } as any

    mockSharedUserRepo = {
      findUnique: jest.fn(),
    } as any

    mockSharedRoleRepo = {
      getClientRoleId: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: HashingService, useValue: mockHashingService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: SharedUserRepository, useValue: mockSharedUserRepo },
        { provide: SharedRoleRepository, useValue: mockSharedRoleRepo },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('validateVerificationCode', () => {
    it('should validate verification code successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const mockVerificationCode = createTestData.verificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 phút từ bây giờ
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)

      // Act - Thực hiện test
      const result = await service.validateVerificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
      })

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockVerificationCode)
      expect(mockAuthRepo.findUniqueVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: 'test@example.com',
          type: TypeOfVerificationCode.REGISTER,
        },
      })
    })

    it('should throw error when verification code not found', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(
        service.validateVerificationCode({
          email: 'test@example.com',
          code: '123456',
          type: TypeOfVerificationCode.REGISTER,
        }),
      ).rejects.toThrow()
    })

    it('should throw error when verification code is expired', async () => {
      // Arrange - Chuẩn bị mã xác thực đã hết hạn
      const expiredVerificationCode = createTestData.verificationCode({
        email: 'test@example.com',
        code: '123456',
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 phút trước (đã hết hạn)
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(expiredVerificationCode)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(
        service.validateVerificationCode({
          email: 'test@example.com',
          code: '123456',
          type: TypeOfVerificationCode.REGISTER,
        }),
      ).rejects.toThrow()
    })
  })

  describe('register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      name: 'Test User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
      code: '123456',
    }

    it('should register user successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const mockVerificationCode = createTestData.verificationCode({
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      const mockUser = createTestData.user({
        email: validRegisterData.email,
        name: validRegisterData.name,
        phoneNumber: validRegisterData.phoneNumber,
      })

      const mockDeletedVerificationCode = createTestData.verificationCode({
        id: 1,
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashedPassword')
      mockAuthRepo.createUser.mockResolvedValue(mockUser as any)
      mockAuthRepo.deleteVerificationCode.mockResolvedValue(mockDeletedVerificationCode as any)

      // Act - Thực hiện đăng ký
      const result = await service.register(validRegisterData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUser)
      expect(mockHashingService.hash).toHaveBeenCalledWith(validRegisterData.password)
      expect(mockAuthRepo.createUser).toHaveBeenCalledWith({
        email: validRegisterData.email,
        name: validRegisterData.name,
        phoneNumber: validRegisterData.phoneNumber,
        password: 'hashedPassword',
        roleId: 1,
      })
      expect(mockAuthRepo.deleteVerificationCode).toHaveBeenCalledWith({
        email_type: {
          email: validRegisterData.email,
          type: TypeOfVerificationCode.REGISTER,
        },
      })
    })

    it('should throw EmailAlreadyExistsException on unique constraint violation', async () => {
      // Arrange - Chuẩn bị dữ liệu test với lỗi unique constraint
      const mockVerificationCode = createTestData.verificationCode({
        email: validRegisterData.email,
        code: validRegisterData.code,
        type: TypeOfVerificationCode.REGISTER,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      mockAuthRepo.findUniqueVerificationCode.mockResolvedValue(mockVerificationCode)
      mockSharedRoleRepo.getClientRoleId.mockResolvedValue(1)
      mockHashingService.hash.mockResolvedValue('hashedPassword')

      // Mock Prisma unique constraint error
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      mockAuthRepo.createUser.mockRejectedValue(uniqueError)
      mockIsUniqueConstraintPrismaError.mockReturnValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.register(validRegisterData)).rejects.toThrow(EmailAlreadyExistsException)
    })
  })

  describe('sendOTP', () => {
    it('should send OTP successfully for new user registration', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi OTP cho user mới
      const otpData = {
        email: 'newuser@example.com',
        type: TypeOfVerificationCode.REGISTER,
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(null) // User chưa tồn tại
      mockAuthRepo.createVerificationCode.mockResolvedValue(
        createTestData.verificationCode({
          email: otpData.email,
          type: otpData.type,
        }),
      )
      mockEmailService.sendOTP.mockResolvedValue({
        data: { id: 'test-id' },
        error: null,
      })

      // Act - Thực hiện gửi OTP
      const result = await service.sendOTP(otpData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Gửi mã OTP thành công' })
      expect(mockSharedUserRepo.findUnique).toHaveBeenCalledWith({
        email: otpData.email,
      })
      expect(mockAuthRepo.createVerificationCode).toHaveBeenCalled()
      expect(mockEmailService.sendOTP).toHaveBeenCalled()
    })

    it('should throw error when user already exists for registration', async () => {
      // Arrange - Chuẩn bị dữ liệu với user đã tồn tại
      const otpData = {
        email: 'existing@example.com',
        type: TypeOfVerificationCode.REGISTER,
      }

      const existingUser = createTestData.user({
        email: otpData.email,
        name: 'Existing User',
      })

      mockSharedUserRepo.findUnique.mockResolvedValue(existingUser)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.sendOTP(otpData)).rejects.toThrow()
    })

    it('should throw EmailNotFoundException when user does not exist for forgot password', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại cho quên mật khẩu
      const otpData = {
        email: 'nonexistent@example.com',
        type: TypeOfVerificationCode.FORGOT_PASSWORD,
      }

      mockSharedUserRepo.findUnique.mockResolvedValue(null) // User không tồn tại

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.sendOTP(otpData)).rejects.toThrow(EmailNotFoundException)
    })
  })

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123',
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    }

    it('should login successfully without 2FA', async () => {
      // Arrange - Chuẩn bị dữ liệu đăng nhập không có 2FA
      const mockUser = {
        ...createTestData.user(),
        totpSecret: null, // Không bật 2FA
        role: createTestData.role({
          id: 1,
          name: 'CLIENT',
        }),
      }

      const mockTokens = createTestData.tokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })

      const mockDevice = { id: 1, userId: mockUser.id, userAgent: 'test-agent' }
      const mockRefreshToken = mockTokens.refreshToken

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)
      mockAuthRepo.createDevice.mockResolvedValue(mockDevice as any)
      mockAuthRepo.createRefreshToken.mockResolvedValue({
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        token: mockRefreshToken,
        userId: mockUser.id,
        deviceId: mockDevice.id,
      } as any)
      mockTokenService.signAccessToken.mockImplementation(() => mockTokens.accessToken)
      mockTokenService.signRefreshToken.mockImplementation(() => mockRefreshToken)
      // Mock verifyRefreshToken để trả về exp time
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        userId: mockUser.id,
      } as any)

      // Act - Thực hiện đăng nhập
      const result = await service.login(validLoginData)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockTokens)
      expect(mockAuthRepo.findUniqueUserIncludeRole).toHaveBeenCalledWith({
        email: validLoginData.email,
      })
      expect(mockHashingService.compare).toHaveBeenCalledWith(validLoginData.password, mockUser.password)
    })

    it('should throw EmailNotFoundException when user does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu với user không tồn tại
      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(null)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(validLoginData)).rejects.toThrow(EmailNotFoundException)
    })

    it('should throw TOTPNotEnabledException when user provides 2FA code but 2FA is not enabled', async () => {
      // Arrange - Chuẩn bị dữ liệu với mã 2FA nhưng chưa bật 2FA
      const loginDataWith2FA = {
        ...validLoginData,
        totpCode: '123456',
      }

      const mockUser = {
        ...createTestData.user(),
        totpSecret: null, // Chưa bật 2FA
        role: createTestData.role({ id: 1, name: 'CLIENT' }),
      }

      mockAuthRepo.findUniqueUserIncludeRole.mockResolvedValue(mockUser as any)
      mockHashingService.compare.mockResolvedValue(true)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.login(loginDataWith2FA)).rejects.toThrow(TOTPNotEnabledException)
    })
  })
})
