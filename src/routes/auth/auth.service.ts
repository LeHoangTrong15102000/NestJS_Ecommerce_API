import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'
import { RolesService } from 'src/routes/auth/roles.service'
import { generateOTP, isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { HashingService } from 'src/shared/services/hashing.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import { LoginBodyType, RegisterBodyType, SendOTPBodyType } from 'src/routes/auth/auth.model'
import { AuthRepository } from 'src/routes/auth/auth.repo'
import { addMilliseconds, isThisSecond } from 'date-fns'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import ms from 'ms'
import envConfig from 'src/shared/config'
import { TypeOfVerificationCode } from 'src/shared/constants/auth.constant'
import { EmailService } from 'src/shared/services/email.service'
import { AccessTokenPayloadCreate } from 'src/shared/types/jwt.type'

@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,
    private readonly authRepository: AuthRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly tokenService: TokenService,
    private readonly rolesService: RolesService,
    private readonly emailService: EmailService,
  ) {}

  async register(body: RegisterBodyType) {
    try {
      const verificationCode = await this.authRepository.findUniqueVerificationCode({
        email: body.email,
        code: body.code,
        type: TypeOfVerificationCode.REGISTER,
      })
      if (!verificationCode) {
        throw new UnprocessableEntityException([
          {
            message: 'Mã OTP không hợp lệ',
            path: 'code',
          },
        ])
      }
      if (verificationCode.expiresAt <= new Date()) {
        throw new UnprocessableEntityException([
          {
            message: 'Mã OTP đã hết hạn',
            path: 'code',
          },
        ])
      }
      const clientRoleId = await this.rolesService.getClientRoleId()
      const hashedPassword = await this.hashingService.hash(body.password)
      // response về user thì cần phải omit `code` của người dùng
      return await this.authRepository.createUser({
        email: body.email,
        name: body.name,
        phoneNumber: body.phoneNumber,
        password: hashedPassword,
        // TypeScript không coi việc truyền thêm các thuộc tính dư thừa (excess properties) là lỗi trong trường hợp này khi sử dụng spread operator (...body). Đây là một hành vi được thiết kế để linh hoạt, nhưng nó có thể dẫn đến rủi ro nếu bạn không kiểm soát chặt chẽ dữ liệu đầu vào.
        roleId: clientRoleId,
      })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw new UnprocessableEntityException([
          {
            // Cấu trúc của nó nên giống với Zod khi mà nó validate
            message: 'Email đã tồn tại',
            path: 'email',
          },
        ])
      }
      throw error
    }
  }

  async sendOTP(body: SendOTPBodyType) {
    // 1. Kiểm tra email đã tồn tại trong database hay chưa
    const user = await this.sharedUserRepository.findUnique({
      email: body.email,
    })
    if (user) {
      throw new UnprocessableEntityException([
        {
          // Cấu trúc của nó nên giống với Zod khi mà nó validate
          message: 'Email đã tồn tại',
          path: 'email',
        },
      ])
    }
    // 2. Tạo mã OTP
    const otpCode = generateOTP()
    const verificationCode = this.authRepository.createVerificationCode({
      email: body.email,
      code: otpCode,
      type: body.type,
      // addMiliseconds nó cung cấp cho chúng ta một cái Date object phù hợp với đầu vào của thằng expiresAt truyền vào mốc thời gian hiện tại cộng với bao nhiêu thì chúng ta sử dụng thư viện `ms` thì nó sẽ tự động convert ra miliseconds.
      expiresAt: addMilliseconds(new Date(), ms(envConfig.OTP_EXPIRES_IN)),
    })
    // 3. Gửi mã OTP đến email của người dùng
    const { error } = await this.emailService.sendOTP({ email: body.email, code: otpCode })
    if (error) {
      throw new UnprocessableEntityException([
        {
          message: 'Gửi mã OTP thất bại',
          path: 'code',
        },
      ])
    }
    return verificationCode
  }

  // Xử lý logic Login cho người dùng
  async login(body: LoginBodyType & { userAgent: string; ip: string }) {
    // Do cái thằng user trong đây ko có trả về role nên là đây là trường hợp cá biệt không dùng chung cái thằng sharedUserRepository được
    const user = await this.authRepository.findUniqueUserIncludeRole({
      email: body.email,
    })

    if (!user) {
      throw new UnprocessableEntityException([
        {
          message: 'Email không tồn tại',
          path: 'email',
        },
      ])
    }

    const isPasswordMatch = await this.hashingService.compare(body.password, user.password)
    if (!isPasswordMatch) {
      throw new UnprocessableEntityException([
        {
          field: 'password',
          error: 'Mật khẩu không đúng',
        },
      ])
    }
    // Tạo một cái record device mới
    const device = await this.authRepository.createDevice({
      userId: user.id,
      userAgent: body.userAgent,
      ip: body.ip,
    })

    // Sau đó mới tạo tokens trả về cho người dùng
    const tokens = await this.generateTokens({
      userId: user.id,
      deviceId: device.id,
      roleId: user.roleId,
      roleName: user.role.name,
    })
    return tokens
  }

  // Hàm tạo ra accessToken và refreshToken
  async generateTokens({ userId, roleId, deviceId, roleName }: AccessTokenPayloadCreate) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken({
        userId,
        roleId,
        deviceId,
        roleName,
      }),
      this.tokenService.signRefreshToken({ userId }),
    ])
    const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)
    await this.authRepository.createRefreshToken({
      token: refreshToken,
      userId,
      expiresAt: new Date(decodedRefreshToken.exp * 1000), // Đổi ra ms
      deviceId,
    })

    return {
      accessToken,
      refreshToken,
    }
  }

  // Xử lý Refresh Token cho người dùng
  async refreshToken(refreshToken: string) {
    try {
      const { userId } = await this.tokenService.verifyRefreshToken(refreshToken)
      // 1. Kiểm trả refreshToken có tồn tại trong database không
      // Lấy ra exp của refreshToken cũ
      const refreshTokenDoc = await this.prismaService.refreshToken.findUniqueOrThrow({
        where: {
          token: refreshToken,
        },
      })
      const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)

      // 2. Tính toán thời gian còn lại refreshToken

      // 3. Tạo mới accessToken và refreshToken
      // const createdTokens = await this.generateTokens({ userId })
      const newAccessToken = this.tokenService.signAccessToken({ userId })
      const newRefreshToken = this.tokenService.signRefreshToken({ userId }, decodedRefreshToken.exp)

      // 4. Xoá refreshToken cũ
      await this.prismaService.refreshToken.delete({
        where: {
          token: refreshToken,
        },
      })

      // 5. Thêm refreshToken mới vào database
      await this.prismaService.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId,
          // EpochTime là tính theo dây nên là trước khi lưu xuống database thì * 1000
          expiresAt: new Date(decodedRefreshToken.exp * 1000),
        },
      })

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    } catch (error) {
      // Trường hợp đã refresh token rồi, hãy thông báo cho user biết
      // refresh token của họ đã bị đánh cắp
      if (isNotFoundPrismaError(error)) {
        throw new UnauthorizedException('Refresh token has been revoked')
      }
      throw new UnauthorizedException()
    }
  }

  // async logout(refreshToken: string) {
  //   try {
  //     // 1. Kiểm tra xem refreshToken có hợp lệ hay không
  //     await this.tokenService.verifyRefreshToken(refreshToken)
  //     // 2. Xoá refreshToken trong database
  //     await this.prismaService.refreshToken.delete({
  //       where: {
  //         token: refreshToken,
  //       },
  //     })

  //     return {
  //       message: 'Logout successfully',
  //     }
  //   } catch (error) {
  //     // Trường hợp đã refresh token rồi, hãy thông báo cho user biết
  //     // refresh token của họ đã bị đánh cắp
  //     if (isNotFoundPrismaError(error)) {
  //       throw new UnauthorizedException('Refresh token has been revoked')
  //     }
  //     throw new UnauthorizedException()
  //   }
  // }

  // async verifyEmail () {}

  // async changePassword() {}

  // async forgotPassword

  // async resetPassword

  // async updateProfile

  // async oauthWithGoogle

  // async loginGoogle

  // async twoFactorSetup
}
