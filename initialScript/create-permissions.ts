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

  const availableRoutes: [] = router.stack
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
  console.log(availableRoutes) // Nó sẽ list Available Routes có sẵn hiện tại của chúng ta
  // Sẽ tiến hành add vào trong database

  const result = await prisma.permission.createMany({
    data: availableRoutes,
    skipDuplicates: true, // trong trường hợp mà đã có rồi thì nó sẽ skip qua và sẽ không báo lỗi nữa
  })
  console.log('Result', result)

  //  Khi mà nó chạy xong hết và nó sẽ thoát ra
  process.exit(0)
}

bootstrap()
