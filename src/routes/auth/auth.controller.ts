import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Query, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { ZodResponse } from 'nestjs-zod'
import {
  DisableTwoFactorBodyDTO,
  ExchangeCodeBodyDTO,
  ForgotPasswordBodyDTO,
  GetAuthorizationUrlResDTO,
  LoginBodyDTO,
  LoginResDTO,
  LogoutBodyDTO,
  RefreshTokenBodyDTO,
  RefreshTokenResDTO,
  RegisterBodyDTO,
  RegisterResDTO,
  SendOTPBodyDTO,
  TwoFactorEnableResDTO,
} from 'src/routes/auth/auth.dto'
import { AuthService } from 'src/routes/auth/auth.service'
import { GoogleService } from 'src/routes/auth/google.service'
import envConfig from 'src/shared/config'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { UserAgent } from 'src/shared/decorators/user-agent.decorator'
import { EmptyBodyDTO } from 'src/shared/dtos/request.dto'
import { MessageResDTO } from 'src/shared/dtos/response.dto'
import { RateLimit } from 'src/rate-limit/decorators/rate-limit.decorator'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectPinoLogger(AuthController.name) private readonly logger: PinoLogger,
    private readonly authService: AuthService,
    private readonly googleService: GoogleService,
  ) {}

  @RateLimit('auth')
  @Post('register')
  @ZodResponse({ type: RegisterResDTO })
  @IsPublic()
  @ApiOperation({ summary: 'Register a new user account' })
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }

  @RateLimit('auth')
  @Post('otp')
  @ZodResponse({ type: MessageResDTO })
  @IsPublic()
  @ApiOperation({ summary: 'Send OTP to email for verification' })
  sendOTP(@Body() body: SendOTPBodyDTO) {
    return this.authService.sendOTP(body)
  }

  @RateLimit('auth')
  @Post('login')
  @ZodResponse({ type: LoginResDTO })
  @IsPublic()
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() body: LoginBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.login({
      ...body,
      userAgent,
      ip,
    })
  }

  @Post('refresh-token')
  @ZodResponse({ type: RefreshTokenResDTO })
  @HttpCode(HttpStatus.OK)
  @IsPublic()
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refreshToken(@Body() body: RefreshTokenBodyDTO, @UserAgent() userAgent: string, @Ip() ip: string) {
    return this.authService.refreshToken({
      refreshToken: body.refreshToken,
      userAgent,
      ip,
    })
  }

  @Post('logout')
  @ZodResponse({ type: MessageResDTO })
  @IsPublic()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(@Body() body: LogoutBodyDTO) {
    return this.authService.logout(body.refreshToken)
  }

  @Get('google-link')
  @IsPublic()
  @ZodResponse({ type: GetAuthorizationUrlResDTO })
  @ApiOperation({ summary: 'Get Google OAuth2 authorization URL' })
  getAuthorizationUrl(@UserAgent() userAgent: string, @Ip() ip: string) {
    return this.googleService.getAuthorizationUrl({ userAgent, ip })
  }

  @Get('google/callback')
  @IsPublic()
  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      const data = await this.googleService.googleCallback({ code, state })

      // Security: Never expose tokens in URL query params (logged by proxies/CDN/browser history).
      // Use a short-lived authorization code that the client exchanges via POST for tokens.
      const authCode = await this.authService.createAuthorizationCode(data)

      return res.redirect(`${envConfig.GOOGLE_CLIENT_REDIRECT_URI}?code=${authCode}`)
    } catch (error) {
      this.logger.error({ err: error }, 'Google callback failed')
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi khi đăng nhập bằng google, vui lòng thử lại bằng cách khác'

      return res.redirect(`${envConfig.GOOGLE_CLIENT_REDIRECT_URI}?errorMessage=${encodeURIComponent(errorMessage)}`)
    }
  }

  @RateLimit('auth')
  @Post('google/exchange-code')
  @ZodResponse({ type: LoginResDTO })
  @IsPublic()
  @ApiOperation({ summary: 'Exchange Google OAuth authorization code for tokens' })
  exchangeGoogleCode(@Body() body: ExchangeCodeBodyDTO) {
    return this.authService.exchangeAuthorizationCode(body.code)
  }

  @RateLimit('auth')
  @Post('forgot-password')
  @IsPublic()
  @ZodResponse({ type: MessageResDTO })
  @ApiOperation({ summary: 'Send password reset email' })
  forgotPassword(@Body() body: ForgotPasswordBodyDTO) {
    return this.authService.forgotPassword(body)
  }

  @Post('2fa/enable')
  @ZodResponse({ type: TwoFactorEnableResDTO })
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  enableTwoFactorAuth(@Body() _: EmptyBodyDTO, @ActiveUser('userId') userId: number) {
    return this.authService.enableTwoFactorAuth(userId)
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ type: MessageResDTO })
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  disableTwoFactorAuth(@Body() body: DisableTwoFactorBodyDTO, @ActiveUser('userId') userId: number) {
    return this.authService.disableTwoFactorAuth({
      ...body,
      userId,
    })
  }
}
