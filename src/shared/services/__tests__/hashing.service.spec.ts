import { Test, TestingModule } from '@nestjs/testing'
import { HashingService } from '../hashing.service'

// Mock bcrypt để tránh lỗi native binding
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { hash, compare } from 'bcrypt'

const mockHash = hash as jest.MockedFunction<any>
const mockCompare = compare as jest.MockedFunction<any>

describe('HashingService', () => {
  let service: HashingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashingService],
    }).compile()

    service = module.get<HashingService>(HashingService)

    // Reset mocks trước mỗi test
    jest.clearAllMocks()
  })

  describe('hash', () => {
    it('should hash a password successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const plainPassword = 'password123'
      const hashedPassword = 'hashedPassword123'
      mockHash.mockResolvedValue(hashedPassword)

      // Act - Thực hiện hash
      const result = await service.hash(plainPassword)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(hashedPassword)
      expect(mockHash).toHaveBeenCalledWith(plainPassword, 10)
    })

    it('should generate different hashes for same password', async () => {
      // Arrange - Chuẩn bị mock để trả về hash khác nhau
      const plainPassword = 'password123'
      mockHash.mockResolvedValueOnce('hashedPassword1').mockResolvedValueOnce('hashedPassword2')

      // Act - Thực hiện hash 2 lần
      const hash1 = await service.hash(plainPassword)
      const hash2 = await service.hash(plainPassword)

      // Assert - Kiểm tra hash khác nhau (do salt)
      expect(hash1).not.toBe(hash2)
      expect(mockHash).toHaveBeenCalledTimes(2)
    })

    it('should handle empty string', async () => {
      // Arrange - Chuẩn bị chuỗi rỗng
      const emptyPassword = ''
      const hashedEmpty = 'hashedEmpty'
      mockHash.mockResolvedValue(hashedEmpty)

      // Act - Thực hiện hash chuỗi rỗng
      const result = await service.hash(emptyPassword)

      // Assert - Kiểm tra kết quả
      expect(result).toBe(hashedEmpty)
      expect(mockHash).toHaveBeenCalledWith('', 10)
    })
  })

  describe('compare', () => {
    it('should return true for correct password', async () => {
      // Arrange - Chuẩn bị dữ liệu so sánh đúng
      const plainPassword = 'password123'
      const hashedPassword = 'hashedPassword123'
      mockCompare.mockResolvedValue(true)

      // Act - Thực hiện so sánh
      const result = await service.compare(plainPassword, hashedPassword)

      // Assert - Kiểm tra kết quả đúng
      expect(result).toBe(true)
      expect(mockCompare).toHaveBeenCalledWith(plainPassword, hashedPassword)
    })

    it('should return false for incorrect password', async () => {
      // Arrange - Chuẩn bị dữ liệu so sánh sai
      const plainPassword = 'password123'
      const wrongPassword = 'wrongpassword'
      const hashedPassword = 'hashedPassword123'
      mockCompare.mockResolvedValue(false)

      // Act - Thực hiện so sánh với mật khẩu sai
      const result = await service.compare(wrongPassword, hashedPassword)

      // Assert - Kiểm tra kết quả sai
      expect(result).toBe(false)
      expect(mockCompare).toHaveBeenCalledWith(wrongPassword, hashedPassword)
    })

    it('should return false for empty password', async () => {
      // Arrange - Chuẩn bị mật khẩu rỗng
      const hashedPassword = 'hashedPassword123'
      mockCompare.mockResolvedValue(false)

      // Act - Thực hiện so sánh với mật khẩu rỗng
      const result = await service.compare('', hashedPassword)

      // Assert - Kiểm tra kết quả sai
      expect(result).toBe(false)
      expect(mockCompare).toHaveBeenCalledWith('', hashedPassword)
    })

    it('should handle invalid hash gracefully', async () => {
      // Arrange - Chuẩn bị hash không hợp lệ
      const plainPassword = 'password123'
      const invalidHash = 'invalid-hash'
      const error = new Error('Invalid hash format')
      mockCompare.mockRejectedValue(error)

      // Act & Assert - Thực hiện so sánh và kiểm tra lỗi
      await expect(service.compare(plainPassword, invalidHash)).rejects.toThrow('Invalid hash format')
      expect(mockCompare).toHaveBeenCalledWith(plainPassword, invalidHash)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in password', async () => {
      // Arrange - Chuẩn bị mật khẩu có ký tự đặc biệt
      const specialPassword = '!@#$%^&*()_+-=[]{}|;":,./<>?'
      const hashedSpecial = 'hashedSpecial'
      mockHash.mockResolvedValue(hashedSpecial)
      mockCompare.mockResolvedValue(true)

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(specialPassword)
      const isMatch = await service.compare(specialPassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBe(hashedSpecial)
      expect(isMatch).toBe(true)
    })

    it('should handle unicode characters', async () => {
      // Arrange - Chuẩn bị mật khẩu có ký tự unicode
      const unicodePassword = 'password123🔒'
      const hashedUnicode = 'hashedUnicode'
      mockHash.mockResolvedValue(hashedUnicode)
      mockCompare.mockResolvedValue(true)

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(unicodePassword)
      const isMatch = await service.compare(unicodePassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBe(hashedUnicode)
      expect(isMatch).toBe(true)
    })

    it('should handle very long passwords', async () => {
      // Arrange - Chuẩn bị mật khẩu rất dài
      const longPassword = 'a'.repeat(1000)
      const hashedLong = 'hashedLong'
      mockHash.mockResolvedValue(hashedLong)
      mockCompare.mockResolvedValue(true)

      // Act - Thực hiện hash và so sánh
      const hashedPassword = await service.hash(longPassword)
      const isMatch = await service.compare(longPassword, hashedPassword)

      // Assert - Kiểm tra kết quả
      expect(hashedPassword).toBe(hashedLong)
      expect(isMatch).toBe(true)
    })
  })
})
