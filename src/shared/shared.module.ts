import { Global, Module } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from './services/hashing.service'
import { TokenService } from './services/token.service'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from 'src/shared/guards/access-token.guard'
import { APIKeyGuard } from 'src/shared/guards/api-key.guard'
import { APP_GUARD } from '@nestjs/core'
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { EmailService } from 'src/shared/services/email.service'
import { TwoFactorService } from 'src/shared/services/2fa.service'
import { SharedRoleRepository } from 'src/shared/repositories/shared-role.repo'
import { S3Service } from 'src/shared/services/s3.service'

const sharedServices = [
  PrismaService,
  HashingService,
  TokenService,
  SharedUserRepository,
  EmailService,
  TwoFactorService,
  S3Service,
  SharedRoleRepository,
]

// Module này được coi là import toàn cục rồi, nên là những cái  Service shared chung thì chỉ cần import vào trong đây là được
@Global()
@Module({
  providers: [
    ...sharedServices,
    // 2 thằng Guard này cần phải được khai báo để mà sử dụng được ở bên trong AuthenticationGuard
    AccessTokenGuard,
    APIKeyGuard,
    // Thằng AuthenticationGuard được khai báo toàn cục rồi nên là đã được sử dụng toàn App
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: sharedServices,
  imports: [JwtModule],
})
export class SharedModule {}
