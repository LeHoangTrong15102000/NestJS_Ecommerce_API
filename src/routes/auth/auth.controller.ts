import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'

import { AuthService } from 'src/routes/auth/auth.service'
// import { LoginBodyDTO, RegisterBodyDTO, RegisterResDTO, SendOTPBodyDTO } from './auth.dto'
import { ZodSerializerDto } from 'nestjs-zod'
import { LoginBodyDTO, RegisterBodyDTO, RegisterResDTO, SendOTPBodyDTO } from 'src/routes/auth/auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Nếu mà sử dụng cái RegisterBodyDTO như thế kia thì cần phải vào cái AppModule khai báo thêm thằng APP_PIPE vào để mà sử dụng global -> Cách mà team Zod recommend
  @Post('register')
  @ZodSerializerDto(RegisterResDTO)
  // Ở controller này thì chúng ta cần phải khai báo DTO nhưng bên service thì cần phải dùng @type để mà biểu thị cái params
  async register(@Body() body: RegisterBodyDTO) {
    return await this.authService.register(body)
  }

  @Post('otp')
  sendOTP(@Body() body: SendOTPBodyDTO) {
    return this.authService.sendOTP(body)
  }

  @Post('login')
  async login(@Body() body: LoginBodyDTO & { userAgent: string; ip: string }) {
    return await this.authService.login(body)
  }

  // @Post('refresh-token')
  // @HttpCode(HttpStatus.OK)
  // async refreshToken(@Body() body: any) {
  //   return await this.authService.refreshToken(body.refreshToken)
  // }

  // @Post('logout')
  // async logout(@Body() body: any) {
  //   return await this.authService.logout(body.refreshToken)
  // }

  // @Post('oauth/google')
  // async googleLogin(@Body() body: any) {
  //   return await this.authService.googleLogin(body.token)
  // }
}
