import envConfig from 'src/shared/config'
import { RoleName } from 'src/shared/constants/role.constant'
import { HashingService } from 'src/shared/services/hashing.service'
import { PrismaService } from 'src/shared/services/prisma.service'

// Tạo ra một cái instance từ Prisma để mà sử dụng
const prisma = new PrismaService()
const hasingService = new HashingService()

const main = async () => {
  // Đếm coi thử xem có bao nhiêu cái Role nếu mà có rồi thì sẽ không chạy nữa
  const roleCount = await prisma.role.count()
  // Cái script này nó đã được chạy rồi
  if (roleCount > 0) {
    throw new Error('Role already exists')
  }
  // createMany nó chỉ return về số lượng chứ nó không return về một cái array items
  const roles = await prisma.role.createMany({
    data: [
      {
        name: RoleName.Admin,
        description: 'Admin role',
      },
      {
        name: RoleName.Client,
        description: 'Client role',
      },
      {
        name: RoleName.Seller,
        description: 'Seller role',
      },
    ],
  })
  // tạo ra user admin
  const adminRole = await prisma.role.findFirstOrThrow({
    where: {
      name: RoleName.Admin,
    },
  })

  const hashedPassword = await hasingService.hash(envConfig.ADMIN_PASSWORD)
  const adminUser = await prisma.user.create({
    data: {
      email: envConfig.ADMIN_EMAIL,
      password: hashedPassword,
      name: envConfig.ADMIN_NAME,
      phoneNumber: envConfig.ADMIN_PHONENUMBER,
      roleId: adminRole.id,
    },
  })

  return {
    createdRoleCount: roles.count,
    adminUser,
  }
}

// Chạy cái file main này
main()
  .then(({ adminUser, createdRoleCount }) => {
    console.log(`Created ${createdRoleCount} roles`)
    console.log(`Created admin user: ${adminUser.email}`)
  })
  .catch(console.error)
