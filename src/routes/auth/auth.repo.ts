import { Injectable } from '@nestjs/common'
import { DeviceType, RegisterBodyType, RoleType, VerificationCodeType } from 'src/routes/auth/auth.model'
import { TypeOfVerificationCodeType } from 'src/shared/constants/auth.constant'
import { UserType } from 'src/shared/models/shared-user.model'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // Đây là chúng ta đã tách ra được cái logic truy vấn dữ liệu sang Repository được rồi
  // AuthRepository này nó cũng giống như là các Service ở trong một module của chúng ta vậy đó
  // Tách ra như thế này để mà sau này khi mà có muốn thay đổi ORM hoặc thay đổi logic truy vấn và nó không ảnh hưởng đến cái logic nghiệp vụ ở bên kia
  createUser(
    user: Omit<RegisterBodyType, 'confirmPassword' | 'code'> & Pick<UserType, 'roleId'>,
  ): Promise<Omit<UserType, 'password' | 'totpSecret'>> {
    // Mục đích có kiểu trả về như vậy là bởi vì sau này chúng ta có thay thể nó thành Drizzle TypeORM, Sequelize,... hay gì đó thì chúng ta cũng cần phải về cái dữ liệu tương tư như cái chúng ta quy định thì cái service nó mới không bị lỗi được
    return this.prismaService.user.create({
      data: user,
      omit: {
        password: true,
        totpSecret: true,
      },
    })
  }

  // func tạo ra verificationCode
  createVerificationCode(
    payload: Pick<VerificationCodeType, 'email' | 'code' | 'type' | 'expiresAt'>,
  ): Promise<VerificationCodeType> {
    return this.prismaService.verificationCode.upsert({
      where: {
        email: payload.email,
      },
      create: payload,
      update: {
        code: payload.code,
        expiresAt: payload.expiresAt,
      },
    })
  }

  // func tìm ra verificationCode để mà xác thực
  // Trong đây do thằng type là enum nên là nên để cái type của VerificatioCode vào cho nó
  async findUniqueVerificationCode(
    uniqueValue:
      | { email: string }
      | { id: number }
      | {
          email: string
          code: string
          type: TypeOfVerificationCodeType
        },
  ): Promise<VerificationCodeType | null> {
    return this.prismaService.verificationCode.findUnique({
      where: uniqueValue,
    })
  }

  async createRefreshToken(data: { token: string; userId: number; expiresAt: Date; deviceId: number }) {
    return this.prismaService.refreshToken.create({
      data,
    })
  }

  async createDevice(
    data: Pick<DeviceType, 'userId' | 'userAgent' | 'ip'> & Partial<Pick<DeviceType, 'lastActive' | 'isActive'>>,
  ) {
    return this.prismaService.device.create({
      data,
    })
  }

  async findUniqueUserIncludeRole(
    uniqueObject: { email: string } | { id: number },
  ): Promise<(UserType & { role: RoleType }) | null> {
    return this.prismaService.user.findUnique({
      where: uniqueObject,
      include: {
        role: true,
      },
    })
  }
}
