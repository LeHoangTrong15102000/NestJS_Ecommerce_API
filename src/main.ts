import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { UPLOAD_DIR } from 'src/shared/constants/other.constant'
import { WebsocketAdapter } from 'src/websockets/websocket.adapter'
import helmet from 'helmet'
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
// import { patchNestJsSwagger } from 'nestjs-zod'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.enableCors() // Enable CORS for all routes
  app.use(helmet())
  // patchNestJsSwagger()
  // Cái này nó giới hạn dựa trên cái địa chỉ IP của client
  app.set('trust proxy', 'loopback') // Trust requests from the loopback address
  // Tạm thời comment Swagger để tránh lỗi với Zod v4
  // TODO: Mở lại khi nestjs-zod cập nhật tương thích với Zod v4
  /*
  const config = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription('The API for the ecommerce application')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        name: 'authorization',
        type: 'apiKey',
      },
      'payment-api-key',
    )
    .build()

  // Tắt OpenAPI metadata generation từ Zod để tránh lỗi với z.iso.datetime()
  const documentFactory = SwaggerModule.createDocument(app, config, {
    extraModels: [], // Không tự động tạo models từ Zod
    ignoreGlobalPrefix: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey, // Đơn giản hóa operation ID
  })

  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
  */
  // app.useWebSocketAdapter(new WebsocketAdapter(app))
  const websocketAdapter = new WebsocketAdapter(app)
  await websocketAdapter.connectToRedis()
  app.useWebSocketAdapter(websocketAdapter)
  // app.useStaticAssets(UPLOAD_DIR, {
  //   prefix: '/media/static',
  // })
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()

// A Văn ơi e có cái này muốn nói hồi chiều với a
