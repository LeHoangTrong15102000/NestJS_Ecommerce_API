import { NestFactory } from '@nestjs/core'
import { AppModule } from 'src/app.module'
import { HTTPMethod } from 'src/shared/constants/auth.constant'
import { PrismaService } from 'src/shared/services/prisma.service'

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

  const availableRoutes: { path: string; method: keyof typeof HTTPMethod; name: string }[] = router.stack
    .map((layer) => {
      const path = layer.route?.path
      const method = String(layer.route?.stack[0].method).toUpperCase() as keyof typeof HTTPMethod
      if (layer.route) {
        return {
          path,
          method,
          name: method + '' + path,
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

bootstrap()
