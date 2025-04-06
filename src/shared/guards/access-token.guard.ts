import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { HTTPMethod } from 'src/shared/constants/role.constant'
import { PrismaService } from 'src/shared/services/prisma.service'
import { TokenService } from 'src/shared/services/token.service'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    // Extract and validate access token from request header
    const decodedAccessToken = await this.extractAndValidateToken(request)

    // Check user permissions based on the access token payload
    await this.validateUserPermission(decodedAccessToken, request)

    return true
  }

  private async extractAndValidateToken(request: any): Promise<AccessTokenPayload> {
    const accessToken = this.extractAccessTokenFromHeader(request)
    try {
      const decodedAccessToken = await this.tokenService.verifyAccessToken(accessToken)

      request[REQUEST_USER_KEY] = decodedAccessToken
      return decodedAccessToken
    } catch (error) {
      throw new UnauthorizedException('Error.InvalidAccessToken')
    }
  }

  private extractAccessTokenFromHeader(request: any): string {
    const accessToken = request.headers.authorization?.split(' ')[1]
    if (!accessToken) {
      throw new UnauthorizedException('Error.MissingAccessToken')
    }
    return accessToken
  }

  // func Validate user permission
  private async validateUserPermission(decodedAccessToken: AccessTokenPayload, request: any): Promise<void> {
    const roleId: number = decodedAccessToken.roleId
    const path: string = request.route.path
    const method = request.method as keyof typeof HTTPMethod
    const role = await this.prismaService.role
      .findUniqueOrThrow({
        where: {
          id: roleId,
          deletedAt: null,
        },
        include: {
          // Nếu mà lấy ra như này thì nó sẽ lấy ra hết cái permission nên là chúng ta thêm path và method vào để mà nó chỉ lấy ra được một cái permission duy nhất mà thôi
          permissions: {
            where: {
              deletedAt: null,
              path,
              method,
            },
          },
        },
      })
      .catch(() => {
        // hay vì prisma tự động quăng ra lỗi thông thường thì chúng ta sẽ chủ động quăng ra lỗi
        throw new ForbiddenException()
      })

    // console.log('role permission', role.permissions.length)
    // const canAccess = role.permissions.some((permission) => permission.method === method && permission.path === path)
    // Ở đây chúng ta có thể check theo độ dài của cái permissions mà không cần phải query thêm vào làm gì
    const canAccess = role.permissions.length > 0 // Chỉ cần như này là được
    if (!canAccess) {
      throw new ForbiddenException('Error.PermissionDenied')
    }
  }
}
