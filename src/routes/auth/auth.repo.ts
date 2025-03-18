import { Injectable } from '@nestjs/common'
import {
  DeviceType,
  RefreshTokenType,
  RegisterBodyType,
  RoleType,
  VerificationCodeType,
} from 'src/routes/auth/auth.model'
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

  //  Tạo token ko dùng transaction
  async createRefreshToken(data: { token: string; userId: number; expiresAt: Date; deviceId: number }) {
    return this.prismaService.refreshToken.create({
      data,
    })
  }

  async deleteRefreshToken(uniqueObject: { token: string }): Promise<RefreshTokenType> {
    // Sẽ trả về một bản ghi bị xóa dưới dạng object
    return this.prismaService.refreshToken.delete({
      where: uniqueObject,
    })
  }

  async createDevice(
    data: Pick<DeviceType, 'userId' | 'userAgent' | 'ip'> & Partial<Pick<DeviceType, 'lastActive' | 'isActive'>>,
  ) {
    return this.prismaService.device.create({
      data,
    })
  }

  async updateDevice(deviceId: number, data: Partial<DeviceType>): Promise<DeviceType> {
    return this.prismaService.device.update({
      where: {
        id: deviceId,
      },
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

  // Thằng này nó sẽ không có throw ra lỗi vì nó tìm ko thấy thì nó sẽ trả về là null
  async findUniqueRefreshTokenIncludeUserRole(uniqueObject: {
    token: string
  }): Promise<(RefreshTokenType & { user: UserType & { role: RoleType } }) | null> {
    return this.prismaService.refreshToken.findUnique({
      where: uniqueObject,
      // Ở trong record refreshToken lấy ra user và sau đó lấy ra role, thì câu lệnh include chính là cái việc chúng ta JOIN bảng với nhau
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    })
  }

  async updateDeviceWithTransaction(
    deviceId: number,
    data: Partial<DeviceType>,
    prisma?: PrismaService,
  ): Promise<DeviceType> {
    const db = prisma ?? this.prismaService

    return db.device.update({
      where: {
        id: deviceId,
      },
      data,
    })
  }

  // Tạo refreshToken có sử dụng transaction
  async createRefreshTokenWithTransaction(
    data: { token: string; userId: number; deviceId: number; expiresAt: Date },
    prisma?: PrismaService,
  ): Promise<RefreshTokenType> {
    const db = prisma ?? this.prismaService
    return db.refreshToken.create({
      data,
    })
  }

  // Xóa refreshToken có sử dụng transaction
  async deleteRefreshTokenWithTransaction(token: string, prisma?: PrismaService): Promise<void> {
    const db = prisma ?? this.prismaService
    await db.refreshToken.delete({
      where: { token },
    })
  }
}
