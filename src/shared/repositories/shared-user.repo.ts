import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { PermissionType } from 'src/shared/models/shared-permission.model'
import { RoleType } from 'src/shared/models/shared-role.model'
import { UserType } from 'src/shared/models/shared-user.model'

export type UserIncludeRolePermissionsType = UserType & { role: RoleType & { permissions: PermissionType[] } }

export type WhereUniqueUserType = { id: number } | { email: string }

@Injectable()
export class SharedUserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findUnique(uniqueObject: WhereUniqueUserType): Promise<UserType | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...uniqueObject,
        deletedAt: null,
      },
    })
  }

  findUniqueIncludeRolePermissions(uniqueObject: WhereUniqueUserType): Promise<UserIncludeRolePermissionsType | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...uniqueObject,
        deletedAt: null,
      },
      include: {
        role: {
          include: {
            permissions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    })
  }

  // Chỗ này không cần dùng email thì chúng ta chỉ cần quy định id là được
  updateUser(uniqueObject: { id: number }, data: Partial<UserType>): Promise<UserType | null> {
    return this.prismaService.user.update({
      where: {
        ...uniqueObject,
        deletedAt: null,
      },
      data,
    })
  }

  // Thêm methods cần thiết cho chat system
  findById(id: number): Promise<UserType | null> {
    return this.findUnique({ id })
  }

  findByIds(ids: number[]): Promise<UserType[]> {
    return this.prismaService.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    })
  }

  findMany(options?: { skip?: number; take?: number; where?: any; orderBy?: any }): Promise<UserType[]> {
    return this.prismaService.user.findMany({
      where: {
        deletedAt: null,
        ...options?.where,
      },
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    })
  }
}
