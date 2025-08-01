import { Injectable } from '@nestjs/common'
import { ChangePasswordBodyType, UpdateMeBodyType } from 'src/routes/profile/profile.model'
import { InvalidPasswordException, NotFoundRecordException } from 'src/shared/error'
import { isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { HashingService } from 'src/shared/services/hashing.service'

@Injectable()
export class ProfileService {
  constructor(
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly hashingService: HashingService,
  ) {}

  async getProfile(userId: number) {
    // Tìm ra user theo id và chưa bị xóa
    const user = await this.sharedUserRepository.findUniqueIncludeRolePermissions({ id: userId })
    if (!user) {
      throw NotFoundRecordException
    }

    return user
  }

  async updateProfile({ userId, body }: { userId: number; body: UpdateMeBodyType }) {
    try {
      return await this.sharedUserRepository.updateUser(
        { id: userId },
        {
          ...body,
          updatedById: userId,
        },
      )
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw NotFoundRecordException
      }
      throw error
    }
  }

  async changePassword({ userId, body }: { userId: number; body: Omit<ChangePasswordBodyType, 'confirmNewPassword'> }) {
    try {
      const { password, newPassword } = body
      const user = await this.sharedUserRepository.findUnique({ id: userId })
      if (!user) {
        throw NotFoundRecordException
      }
      const isPasswordMatch = await this.hashingService.compare(password, user.password)
      if (!isPasswordMatch) {
        throw InvalidPasswordException
      }

      const hashedPassword = await this.hashingService.hash(newPassword)
      await this.sharedUserRepository.updateUser(
        { id: userId },
        {
          password: hashedPassword,
          updatedById: userId,
        },
      )

      return {
        message: 'Password changed successfully',
      }
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw NotFoundRecordException
      }
      throw error
    }
  }
}
