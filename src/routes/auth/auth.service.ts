import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common'
import { RolesService } from 'src/routes/auth/roles.service'
import { generateOTP, isNotFoundPrismaError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { HashingService } from 'src/shared/services/hashing.service'
import { TokenService } from 'src/shared/services/token.service'
import {
  DisableTwoFactorBodyType,
  ForgotPasswordBodyType,
  LoginBodyType,
  RefreshTokenBodyType,
  RegisterBodyType,
  SendOTPBodyType,
} from 'src/routes/auth/auth.model'
import { AuthRepository } from 'src/routes/auth/auth.repo'
import { addMilliseconds, isThisSecond } from 'date-fns'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import ms from 'ms'
import envConfig from 'src/shared/config'
import { TypeOfVerificationCode, TypeOfVerificationCodeType } from 'src/shared/constants/auth.constant'
import { EmailService } from 'src/shared/services/email.service'
import { AccessTokenPayloadCreate } from 'src/shared/types/jwt.type'
import { JsonWebTokenError } from '@nestjs/jwt'
import {
  EmailAlreadyExistsException,
  EmailNotFoundException,
  FailedToSendOTPException,
  InvalidOTPException,
  InvalidPasswordException,
  InvalidTOTPAndCodeException,
  InvalidTOTPException,
  OTPExpiredException,
  RefreshTokenAlreadyUsedException,
  TOTPAlreadyEnabledException,
  TOTPNotEnabledException,
} from 'src/routes/auth/error.model'
import { TwoFactorService } from 'src/shared/services/2fa.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,
    private readonly authRepository: AuthRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly tokenService: TokenService,
    private readonly rolesService: RolesService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async validateVerificationCode({
    code,
    email,
    type,
  }: {
    email: string
    code: string
    type: TypeOfVerificationCodeType
  }) {
    const verificationCode = await this.authRepository.findUniqueVerificationCode({
      email_code_type: {
        email,
        code,
        type,
      },
    })

    if (!verificationCode) {
      throw InvalidOTPException
    }
    // Kiểm tra expiresAt của mã OTP
    if (verificationCode.expiresAt <= new Date()) {
      throw OTPExpiredException
    }

    //  return về verification Code phòng cái trường hợp mà chúng ta cần dùng
    return verificationCode
  }

  async register(body: RegisterBodyType) {
    try {
      await this.validateVerificationCode({ code: body.code, email: body.email, type: TypeOfVerificationCode.REGISTER })

      const clientRoleId = await this.rolesService.getClientRoleId()
      const hashedPassword = await this.hashingService.hash(body.password)
      // Sau khi mà xác thực xong rồi thì xóa code

      // response về user thì cần phải omit `code` của người dùng
      const [user] = await Promise.all([
        this.authRepository.createUser({
          email: body.email,
          name: body.name,
          phoneNumber: body.phoneNumber,
          password: hashedPassword,
          // TypeScript không coi việc truyền thêm các thuộc tính dư thừa (excess properties) là lỗi trong trường hợp này khi sử dụng spread operator (...body). Đây là một hành vi được thiết kế để linh hoạt, nhưng nó có thể dẫn đến rủi ro nếu bạn không kiểm soát chặt chẽ dữ liệu đầu vào.
          roleId: clientRoleId,
        }),
        this.authRepository.deleteVerificationCode({
          email_code_type: {
            email: body.email,
            code: body.code,
            type: TypeOfVerificationCode.REGISTER,
          },
        }),
      ])

      return user
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw EmailAlreadyExistsException
      }
      throw error
    }
  }

  async sendOTP(body: SendOTPBodyType) {
    // 1. Kiểm tra email đã tồn tại trong database hay chưa
    const user = await this.sharedUserRepository.findUnique({
      email: body.email,
    })
    if (body.type === TypeOfVerificationCode.REGISTER && user) {
      throw EmailAlreadyExistsException
    }
    if (body.type === TypeOfVerificationCode.FORGOT_PASSWORD && !user) {
      throw EmailNotFoundException
    }
    // 2. Tạo mã OTP, Do là chỉ có một mã OTP trong một record verification nên là trường hợp mà 2 người cùng email send OTP thì sẽ không được(và chỉ có một người nhập đúng mã OTP mà thôi)
    const otpCode = generateOTP()
    await this.authRepository.createVerificationCode({
      email: body.email,
      code: otpCode,
      type: body.type,
      // addMiliseconds nó cung cấp cho chúng ta một cái Date object phù hợp với đầu vào của thằng expiresAt truyền vào mốc thời gian hiện tại cộng với bao nhiêu thì chúng ta sử dụng thư viện `ms` thì nó sẽ tự động convert ra miliseconds.
      expiresAt: addMilliseconds(new Date(), ms(envConfig.OTP_EXPIRES_IN)),
    })
    // 3. Gửi mã OTP đến email của người dùng
    const { error } = await this.emailService.sendOTP({ email: body.email, code: otpCode })
    if (error) {
      throw FailedToSendOTPException
    }
    return {
      message: 'Gửi mã OTP thành công',
    }
  }

  // Xử lý logic Login cho người dùng
  async login(body: LoginBodyType & { userAgent: string; ip: string }) {
    // Do cái thằng user trong đây ko có trả về role nên là đây là trường hợp cá biệt không dùng chung cái thằng sharedUserRepository được
    // Kiểm tra user có tồn tại hay không
    const user = await this.authRepository.findUniqueUserIncludeRole({
      email: body.email,
    })
    if (!user) {
      throw EmailNotFoundException
    }

    const isPasswordMatch = await this.hashingService.compare(body.password, user.password)
    if (!isPasswordMatch) {
      throw InvalidPasswordException
    }

    // Nếu user đẫ bật 2FA thì kiểm tra mã 2FA TOTP code hoặc là OTP code(email)
    // Thực hiện verify mã 2FA của người dùng
    if (user.totpSecret) {
      // Nếu không có mã TOTP code và code thì thông báo cho client biết
      if (!body.totpCode && !body.code) {
        throw InvalidTOTPAndCodeException
      }
      // Kiểm tra TOTP code có hợp lệ hay không
      if (body.totpCode) {
        const isValid = this.twoFactorService.verifyTOTP({
          email: user.email,
          secret: user.totpSecret,
          token: body.totpCode,
        })
        if (!isValid) {
          throw InvalidTOTPException
        }
      } else if (body.code) {
        // Kiểm tra OTP code có hợp lệ hay không
        await this.validateVerificationCode({
          email: user.email,
          code: body.code,
          type: TypeOfVerificationCode.LOGIN,
        })
        await this.authRepository.deleteVerificationCode({
          email_code_type: {
            email: user.email,
            code: body.code,
            type: TypeOfVerificationCode.LOGIN,
          },
        })
      }
    }

    // 3. Tạo một cái record device mới
    const device = await this.authRepository.createDevice({
      userId: user.id,
      userAgent: body.userAgent,
      ip: body.ip,
    })

    // 4. Sau đó mới tạo tokens trả về cho người dùng
    const tokens = await this.generateTokens({
      userId: user.id,
      deviceId: device.id,
      roleId: user.roleId,
      roleName: user.role.name,
    })
    return tokens
  }

  // Hàm tạo ra accessToken và refreshToken
  async generateTokens({
    userId,
    roleId,
    deviceId,
    roleName,
    refreshTokenExpiresIn,
  }: AccessTokenPayloadCreate & { refreshTokenExpiresIn?: number }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken({
        userId,
        roleId,
        deviceId,
        roleName,
      }),
      this.tokenService.signRefreshToken({ userId }, refreshTokenExpiresIn),
    ])
    const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)
    const expiresAt = refreshTokenExpiresIn
      ? new Date(Date.now() + refreshTokenExpiresIn * 1000)
      : new Date(decodedRefreshToken.exp * 1000)

    await this.authRepository.createRefreshToken({
      token: refreshToken,
      userId,
      expiresAt, // Đổi ra ms
      deviceId,
    })

    return {
      accessToken,
      refreshToken,
    }
  }

  // Xử lý Refresh Token không bao giờ hết hạn
  // async refreshToken({ refreshToken, userAgent, ip }: RefreshTokenBodyType & { userAgent: string; ip: string }) {
  //   try {
  //     // 1. Kiểm tra xem RefreshToken có hợp lệ hay không(Chỉ cần không tồn tại thì nó sẽ quăng ra lỗi ở đây luôn), nết mà RT hết hạn(expiresIn) thì nó sẽ quăng ra lỗi luôn
  //     const { userId } = await this.tokenService.verifyRefreshToken(refreshToken)
  //     // 2. Kiểm trả refreshToken có tồn tại trong database không, chỉ nên verifyToken một lần
  //     // const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)
  //     const refreshTokenInDb = await this.authRepository.findUniqueRefreshTokenIncludeUserRole({
  //       token: refreshToken,
  //     })
  //     // Trường hợp đã refresh token rồi, hãy thông báo cho user biết
  //     // refresh token của họ đã bị đánh cắp
  //     if (!refreshTokenInDb) {
  //       throw new UnauthorizedException('Refresh token has been stealed or revoked')
  //     }

  //     // 3. Cần phải cập nhật device cho người dùng nữa
  //     // Việc cập nhật Device ở trong RT là do:
  //     /**
  //      * userAgent và ip: Cập nhật lại thông tin thiết bị (ví dụ: trình duyệt, địa chỉ IP) để đảm bảo rằng server luôn có dữ liệu mới nhất về thiết bị đang sử dụng RT. Điều này hữu ích trong việc theo dõi hoặc phát hiện các hành vi bất thường (ví dụ: IP thay đổi bất ngờ có thể là dấu hiệu của tấn công).
  //      * lastActive: Cập nhật thời gian hoạt động cuối cùng của thiết bị để phản ánh rằng thiết bị này vẫn đang "sống" và được sử dụng. Điều này giúp quản lý các thiết bị đang hoạt động một cách chính xác, đặc biệt khi bạn muốn hiển thị danh sách thiết bị đăng nhập cho người dùng.
  //      * isActive=true: Xác nhận lại rằng thiết bị này vẫn đang trong trạng thái đăng nhập hợp lệ. Nếu trước đó thiết bị bị đánh dấu isActive=false (ví dụ: do bị đăng xuất từ xa), bước này có thể không được thực hiện, tùy thuộc vào logic của hệ thống.
  //      */

  //     // Tại sao cần phải cập nhật Device
  //     /**
  //      * Theo dõi trạng thái thiết bị: Nếu không cập nhật lastActive, bạn sẽ không biết liệu thiết bị đó có còn đang thực sự hoạt động hay không. Điều này quan trọng khi bạn triển khai chức năng như "Xem danh sách thiết bị đang đăng nhập" hoặc "Đăng xuất thiết bị từ xa".
  //      * Tăng cường bảo mật: Việc cập nhật userAgent và ip giúp phát hiện các thay đổi bất thường. Ví dụ, nếu RT được gửi từ một IP hoàn toàn khác so với lần đăng nhập trước, hệ thống có thể nghi ngờ và yêu cầu xác thực bổ sung.
  //      * Hỗ trợ quản lý nhiều thiết bị: Khi người dùng đăng nhập trên nhiều thiết bị, việc cập nhật thông tin Device mỗi khi refresh token giúp hệ thống luôn có dữ liệu mới nhất để hiển thị hoặc xử lý (ví dụ: "Thiết bị này hoạt động lần cuối lúc 15:30").
  //      */
  //     const {
  //       deviceId,
  //       user: {
  //         roleId,
  //         role: { name: roleName },
  //       },
  //     } = refreshTokenInDb
  //     const $updateDevice = this.authRepository.updateDevice(deviceId, {
  //       userAgent,
  //       ip,
  //     })

  //     // 4. Xoá refreshToken cũ
  //     const $deleteRefreshToken = this.authRepository.deleteRefreshToken({
  //       token: refreshToken,
  //     })
  //     const $tokens = this.generateTokens({ userId, deviceId, roleId, roleName })

  //     // 5. Tạo mới accessToken và refreshToken
  //     //
  //     const [, , tokens] = await Promise.all([$updateDevice, $deleteRefreshToken, $tokens])

  //     return tokens
  //   } catch (error) {
  //     // if (isNotFoundPrismaError(error)) {
  //     //   throw new UnauthorizedException('Refresh token has been revoked')
  //     // }
  //     if (error instanceof HttpException) {
  //       throw error
  //     }
  //     throw new UnauthorizedException()
  //   }
  // }

  // Xử lý RefreshToken có hết hạn

  async refreshToken({ refreshToken, userAgent, ip }: RefreshTokenBodyType & { userAgent: string; ip: string }) {
    try {
      // 1. Kiểm tra xem refreshToken có hợp lệ hay không, nếu mà gửi
      const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)
      const { userId } = decodedRefreshToken

      // 2. Kiểm tra refreshToken có tồn tại trong database hay không
      const refreshTokenInDb = await this.authRepository.findUniqueRefreshTokenIncludeUserRole({
        token: refreshToken,
      })
      // Do trên đây chúng ta throw cái lỗi nên là nó sẽ nhảy xuống cái catch
      if (!refreshTokenInDb) {
        throw RefreshTokenAlreadyUsedException
      }

      // 3. Cập nhật device
      const {
        deviceId,
        user: {
          roleId,
          role: { name: roleName },
        },
      } = refreshTokenInDb
      const $updateDevice = this.authRepository.updateDevice(deviceId, {
        userAgent,
        ip,
      })
      const remainingTimeInSeconds = decodedRefreshToken.exp - Math.floor(Date.now() / 1000)
      // 4. Xóa refreshToken cũ
      const $deleteRefreshToken = this.authRepository.deleteRefreshToken({ token: refreshToken })
      // 5. Tao accessToken và refreshToken mới
      const $tokens = this.generateTokens({
        userId,
        deviceId,
        roleId,
        roleName,
        refreshTokenExpiresIn: remainingTimeInSeconds,
      })

      // const newAccessToken = this.tokenService.signAccessToken({ userId, deviceId, roleId, roleName })
      // const newRefreshToken = this.tokenService.signRefreshToken({ userId }, remainingTimeInSeconds)
      // // Có thể xử lý Transaction để đảm bảo toàn vẹn dữ liệu
      // await this.prismaService.$transaction(async (prisma) => {
      //   await this.authRepository.updateDeviceWithTransaction(
      //     deviceId,
      //     {
      //       userAgent,
      //       ip,
      //     },
      //     prisma,
      //   )
      //   await this.authRepository.deleteRefreshTokenWithTransaction(refreshToken, prisma)
      //   await this.authRepository.createRefreshTokenWithTransaction(
      //     {
      //       token: newRefreshToken,
      //       userId,
      //       deviceId,
      //       expiresAt: new Date(decodedRefreshToken.exp * 1000),
      //     },
      //     prisma,
      //   )
      // })

      const [, , tokens] = await Promise.all([$updateDevice, $deleteRefreshToken, $tokens])

      return tokens
    } catch (error) {
      // Trường hợp đã refresh token rồi, hãy thông báo cho user biết
      // refresh token của họ đã bị đánh cắp
      if (error instanceof JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Refresh token has expired')
        }
        throw new UnauthorizedException('Invalid refresh token')
      }
      // Nếu mà chúng ta throw những cái mã lỗi là instanceof HttpExcetion ở try thì nó sẽ nhảy vào cái dòng if ở đây và quăng ra lỗi -> Là những cái exception mà chúng ta chủ động throw thì nó đều là instanceof HttpException cả -> thì nó sẽ nhảy vào trong đây
      if (error instanceof HttpException) {
        throw error
      }
      // Còn không thì có cho nó throw ra UnauthorizedException như bên dưới này là được
      throw UnauthorizedException
    }
  }

  async logout(refreshToken: string) {
    try {
      // 1. Kiểm tra xem refreshToken có hợp lệ hay không
      await this.tokenService.verifyRefreshToken(refreshToken)
      // 2. Xoá refreshToken trong database
      const deletedRefreshToken = await this.authRepository.deleteRefreshToken({ token: refreshToken })
      // 3. Cập nhật device là đã logout ra rồi
      await this.authRepository.updateDevice(deletedRefreshToken.deviceId, {
        isActive: false, // cập nhật lại cái isActive của cái device đó
      })

      return {
        message: 'Đăng xuất thành công',
      }
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Refresh token has expired')
        }
        throw new UnauthorizedException('Invalid refresh token')
      }
      // Trường hợp JsonWebToken
      // Trường hợp đã refresh token rồi hoặc là cập nhật device thất bại thì nó sẽ quăng ra cái lỗi này, hãy thông báo cho user biết
      // refresh token của họ đã bị đánh cắp
      if (isNotFoundPrismaError(error)) {
        throw new UnauthorizedException('Refresh token has been used or revoked')
      }
      throw new UnauthorizedException('An error occurred during logout device')
    }
  }

  async forgotPassword(body: ForgotPasswordBodyType) {
    const { email, code, newPassword } = body
    // 1. Kiểm tra email đã tồn tại trong database hay chưa
    const user = await this.sharedUserRepository.findUnique({ email })
    if (!user) {
      throw EmailNotFoundException
    }

    // 2. Kiểm tra mã OTP có hợp lệ hay không
    await this.validateVerificationCode({
      email,
      code,
      type: TypeOfVerificationCode.FORGOT_PASSWORD,
    })

    // 3. Cập nhật lại mật khẩu và xóa đi OTP
    const hashedPassword = await this.hashingService.hash(newPassword)

    // Cả 2 thằng này nó đều không phụ thuộc lẫn nhau thì có thể dùng promise.all để mà tối ưu cái vấn đề đó được
    await Promise.all([
      this.authRepository.updateUser({ id: user.id }, { password: hashedPassword }),
      this.authRepository.deleteVerificationCode({
        email_code_type: {
          email: body.email,
          code: body.code,
          type: TypeOfVerificationCode.FORGOT_PASSWORD,
        },
      }),
    ])

    return {
      message: 'Đổi mật khẩu thành công.',
    }
  }

  // async changePassword() {}

  // async resetPassword(body: resetPasswordBodyType) {
  //   return
  // }

  async enableTwoFactorAuth(userId: number) {
    // 1. Lấy thông tin user, kiểm tra xem user có tồn tại hay không, và xem họ đã bật 2FA hay chưa
    const user = await this.sharedUserRepository.findUnique({ id: userId })
    if (!user) {
      throw EmailNotFoundException
    }
    if (user.totpSecret) {
      throw TOTPAlreadyEnabledException
    }

    // 2. Tạo ra secret và uri
    // Cái uri(để mà tạo ra QR code ở phía client) là để ng dùng sử dụng app Authenticator để mà quét để nhận mã 2FA qua ứng dụng, và sẽ dùng cái mã đó để mà đăng nhập mỗi lần login vào ứng dụng
    const { secret, uri } = this.twoFactorService.generateTOTPSecret(user.email)

    // 3. Cập nhật secret vào  user trong database của chúng ta
    await this.authRepository.updateUser(
      { id: userId },
      {
        totpSecret: secret,
      },
    )

    // 4. Trả về secret và uri
    return {
      secret,
      uri,
    }
  }

  async disableTwoFactorAuth(data: DisableTwoFactorBodyType & { userId: number }) {
    const { userId, totpCode, code } = data
    // 1. Lấy thông tin user và kiểm tra xem là họ đã bật 2FA hay chưa
    const user = await this.sharedUserRepository.findUnique({ id: userId })
    if (!user) {
      throw EmailNotFoundException
    }
    if (!user.totpSecret) {
      throw TOTPNotEnabledException
    }

    // 2. Kiểm tra mã TOTP có hợp lệ hay không
    if (totpCode) {
      const isValid = this.twoFactorService.verifyTOTP({
        email: user.email,
        secret: user.totpSecret,
        token: totpCode,
      })
      if (!isValid) {
        throw InvalidTOTPException
      }
    } else if (code) {
      await this.authRepository.findUniqueVerificationCode({
        email_code_type: {
          email: user.email,
          code,
          type: TypeOfVerificationCode.DISABLE_2FA,
        },
      })
    }

    // 3. Nếu đã kiểm tra hợp lệ rồi thì chúng ta sẽ tiến hành xóa secret ở bên trong database thành null
    await this.authRepository.updateUser({ id: userId }, { totpSecret: null })

    return {
      message: 'Tắt 2FA thành công',
    }
  }
}
