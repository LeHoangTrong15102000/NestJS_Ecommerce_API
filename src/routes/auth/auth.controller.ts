import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common'

import { AuthService } from 'src/routes/auth/auth.service'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  GetAuthorizationUrlResDTO,
  LoginBodyDTO,
  LoginResDTO,
  LogoutBodyDTO,
  RefreshTokenBodyDTO,
  RefreshTokenResDTO,
  RegisterBodyDTO,
  RegisterResDTO,
  SendOTPBodyDTO,
} from 'src/routes/auth/auth.dto'
import { UserAgent } from 'src/shared/decorators/user-agent.decorator'
import { MessageResDTO } from 'src/shared/dtos/response.dto'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { GoogleService } from 'src/routes/auth/google.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleService: GoogleService,
  ) {}

  // Nếu mà sử dụng cái ZodSerializerDto(RegisterBodyDTO) như thế kia thì cần phải vào cái AppModule khai báo thêm thằng APP_PIPE vào để mà sử dụng global -> Cách mà team Zod recommend chúng ta sử dụng theo
  @Post('register')
  // Sử dụng ZodSerializerDto để mà validation output của APIendpoint, nó sẽ chuẩn hóa dữ liệu, ví dụ như là RegisterRes chúng ta không muốn trả về `password` mà trong res lại có password thì nó sẽ báo lỗi và xử lý chỗ này
  // Nên là khi mà thêm ZodSerializerDto này vào thì nó sẽ chuẩn hóa dữ liệu(output) trả về cho chúng ta theo đúng cái class ví dụ `RegisterResDTO` mà chúng ta cung cấp
  @ZodSerializerDto(RegisterResDTO)
  // Ở controller này thì chúng ta cần phải khai báo DTO nhưng bên service thì cần phải dùng @type để mà biểu thị cái params
  @IsPublic()
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }

  @Post('otp')
  @ZodSerializerDto(MessageResDTO)
  @IsPublic()
  sendOTP(@Body() body: SendOTPBodyDTO) {
    return this.authService.sendOTP(body)
  }

  // Dùng Decorator userAgent và IP của người dùng
  @Post('login')
  @ZodSerializerDto(LoginResDTO)
  @IsPublic()
  login(@Body() body: LoginBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.login({
      ...body,
      userAgent,
      ip,
    })
  }

  // Khi mà mình không strict thì nếu dữ liệu trả về cho người dùng nó có bị dư hay cái gì đó thì nó vẫn không gây ra lỗi.
  @Post('refresh-token')
  @ZodSerializerDto(RefreshTokenResDTO)
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() body: RefreshTokenBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.refreshToken({
      refreshToken: body.refreshToken,
      userAgent,
      ip,
    })
  }

  @Post('logout')
  // Do thằng logout chỉ trả về message mà thôi
  @ZodSerializerDto(MessageResDTO)
  logout(@Body() body: LogoutBodyDTO) {
    return this.authService.logout(body.refreshToken)
  }

  // Khai báo method GET để mà lấy về cái google link
  @Get('google-link')
  @IsPublic()
  // Thằng này trả về URL
  @ZodSerializerDto(GetAuthorizationUrlResDTO)
  // Lấy vào cái userAgent và ip của người dùng
  getAuthorizationUrl(@UserAgent() userAgent: string, @Ip() ip: string) {
    return this.googleService.getAuthorizationUrl({ userAgent, ip })
  }

  // @Post('change-password)
  // @ZodSerializerDto(ChangePasswordBodyDTO)
  // async changePassword(@Body() body: ChangePasswordBodyDTO) {}

  // @Post('forgot-password)
  // async forgotPassword(@Body() body: ForgotPasswordBodyDTO) {
  //   return await this.authService.forgotPassword(body.email)}

  // @Post('reset-password)
  // async resetPassword(@Body() body: ResetPasswordBodyDTO) {}

  // @Post('oauth/google')
  // async googleLogin(@Body() body: any) {
  //   return await this.authService.googleLogin(body.token)
  // }

  // @Post('2fa/setup)
  // async setupTwoFactor(@Body() body: any) {}

  // @Post('2fa/enable)
  // async enableTwoFactor(@Body() body: any) {}

  // @Post('2fa/disable)
  // async disableTwoFactor(@Body() body: any) {}
}
