import { NestFactory } from '@nestjs/core'
import { AppModule } from 'src/app.module'
import { HTTPMethod, RoleName } from 'src/shared/constants/role.constant'
import { PrismaService } from 'src/shared/services/prisma.service'

const SellerModule = ['AUTH', 'MEDIA', 'MANAGE-PRODUCT', 'PRODUCT-TRANSLATION', 'PROFILE']
const ClientModule = ['AUTH', 'MEDIA', 'PROFILE', 'CART', 'ORDERS', 'REVIEWS']
const prisma = new PrismaService()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(3003)
  const server = app.getHttpAdapter().getInstance()
  const router = server.router

  const permissionsInDb = await prisma.permission.findMany({
    where: {
      deletedAt: null,
    },
  })

  const availableRoutes: { path: string; method: keyof typeof HTTPMethod; name: string; module: string }[] =
    router.stack
      .map((layer) => {
        if (layer.route) {
          const path = layer.route?.path
          const method = String(layer.route?.stack[0].method).toUpperCase() as keyof typeof HTTPMethod
          const moduleName = String(path.split('/')[1]).toUpperCase() // Lấy ra cái tên ModuleName
          return {
            path,
            method,
            name: method + '' + path,
            module: moduleName,
          }
        }
      })
      .filter((item) => item !== undefined)

  // Tạo object permissionInDbMap với cái key là [method-path]
  const permissionInDbMap: Record<string, (typeof permissionsInDb)[0]> = permissionsInDb.reduce((acc, item) => {
    acc[`${item.method}-${item.path}`] = item
    return acc
  }, {})
  // Tạo object availableRoutesMap với key là [`method-path`]
  const availableRoutesMap: Record<string, (typeof availableRoutes)[0]> = availableRoutes.reduce((acc, item) => {
    acc[`${item.method}-${item.path}`] = item
    return acc
  }, {})

  // 1.1 Tìm permissions trong database mà không tồn tại trong availableRoutes -> Thì chúng ta cần filter từ permissionsInDb sau đó so sánh với availableRoutesMap -> Rồi sau đó remove ra khỏi database
  const permissionsToDelete = permissionsInDb.filter((item) => {
    return !availableRoutesMap[`${item.method}-${item.path}`]
  })

  // 1.2 Xóa permission không tồn tại trong availableRoutes
  if (permissionsToDelete.length > 0) {
    const deletedResult = await prisma.permission.deleteMany({
      where: {
        id: {
          // sẽ truyền vào danh sách bằng cú pháp là in, thì cái mảng bên dưới sẽ là một cái array `id`
          in: permissionsToDelete.map((item) => item.id),
        },
      },
    })
    console.log('Deleted Permission', deletedResult.count)
  } else {
    console.log('No permission to delete')
  }

  // 2.1 Tìm permissions trong availableRoutes mà không tồn tại trong permssionsInDb -> Thì chúng ta cần filter từ availableRoutes sau đó so sánh với PermissionsInDbMap -> rồi sau đó add vào database `thêm các route dưới dạng permission database`
  const routesToAdd = availableRoutes.filter((item) => {
    // Sẽ return về cái array mà không có các item ở bên trong permissionsInDbMap(nghĩa là nó có ở bên trong thằng availableRoutes)
    return !permissionInDbMap[`${item.method}-${item.path}`]
  })

  // 2.1 Thêm permission vào bên trong database nếu mà routes đó không tồn tai
  if (routesToAdd.length > 0) {
    const permissionsToAdd = await prisma.permission.createMany({
      data: routesToAdd,
      skipDuplicates: true,
    })

    console.log('Permissions to add', permissionsToAdd.count)
  } else {
    console.log('No permission to add')
  }

  // Lấy lại permission ở trong database sau khi đã thêm mới hoặc là bị xóa
  const updatedPermissionsInDb = await prisma.permission.findMany({
    where: {
      deletedAt: null,
    },
  })

  const adminPermissionIds = updatedPermissionsInDb.map((item) => ({ id: item.id }))
  const sellerPermissionIds = updatedPermissionsInDb
    .filter((item) => SellerModule.includes(item.module))
    .map((item) => ({ id: item.id }))
  const clientPermissionIds = updatedPermissionsInDb
    .filter((item) => ClientModule.includes(item.module))
    .map((item) => ({ id: item.id }))

  await Promise.all([
    updateRole(adminPermissionIds, RoleName.Admin),
    updateRole(sellerPermissionIds, RoleName.Seller),
    updateRole(clientPermissionIds, RoleName.Client),
  ])

  // console.log(availableRoutes) // Nó sẽ list Available Routes có sẵn hiện tại của chúng ta
  // Sẽ tiến hành add vào trong database

  // const result = await prisma.permission.createMany({
  //   data: availableRoutes,
  //   skipDuplicates: true, // trong trường hợp mà đã có rồi thì nó sẽ skip qua và sẽ không báo lỗi nữa
  // })
  // console.log('Result', result)

  //  Khi mà nó chạy xong hết và nó sẽ thoát ra
  process.exit(0)
}

const updateRole = async (permissionIds: { id: number }[], roleName: string) => {
  // Ưu tiên tính dễ đọc hơn là hiệu suất truy vấn
  const role = await prisma.role.findFirstOrThrow({
    where: {
      name: roleName,
      deletedAt: null,
    },
  })
  // Cập nhật lại các permissions trong Admin Role
  await prisma.role.update({
    where: {
      id: role.id,
    },
    data: {
      permissions: {
        // Sẽ lấy ra một array các object id -> Thì khi mà getDetailRole của AdminRole thì prisma nó sẽ tự động map tới đối tượng permission dựa theo cái `id`
        set: permissionIds,
      },
    },
  })
}

bootstrap()
