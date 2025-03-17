import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common'

import { AuthService } from 'src/routes/auth/auth.service'
// import { LoginBodyDTO, RegisterBodyDTO, RegisterResDTO, SendOTPBodyDTO } from './auth.dto'
import { ZodSerializerDto } from 'nestjs-zod'
import {
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Nếu mà sử dụng cái RegisterBodyDTO như thế kia thì cần phải vào cái AppModule khai báo thêm thằng APP_PIPE vào để mà sử dụng global -> Cách mà team Zod recommend
  @Post('register')
  @ZodSerializerDto(RegisterResDTO)
  // Ở controller này thì chúng ta cần phải khai báo DTO nhưng bên service thì cần phải dùng @type để mà biểu thị cái params
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }

  @Post('otp')
  sendOTP(@Body() body: SendOTPBodyDTO) {
    return this.authService.sendOTP(body)
  }

  // Dùng Decorator userAgent và IP của người dùng
  @Post('login')
  @ZodSerializerDto(LoginResDTO)
  login(@Body() body: LoginBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.login({
      ...body,
      userAgent,
      ip,
    })
  }

  @Post('refresh-token')
  @ZodSerializerDto(RefreshTokenResDTO)
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() body: RefreshTokenBodyDTO) {
    return this.authService.refreshToken(body.refreshToken)
  }

  @Post('logout')
  // Do thằng logout chỉ trả về message mà thôi
  @ZodSerializerDto(MessageResDTO)
  logout(@Body() body: LogoutBodyDTO) {
    // return this.authService.logout(body.refreshToken)
  }

  // @Post('oauth/google')
  // async googleLogin(@Body() body: any) {
  //   return await this.authService.googleLogin(body.token)
  // }

  // @Post('change-password)

  // @Post('forgot-password)

  // @Post('reset-password)

  // @Post('2fa/setup)

  // @Post('2fa/enable)

  // @Post('2fa/disable)
}
