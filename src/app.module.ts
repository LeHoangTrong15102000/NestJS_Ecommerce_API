import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SharedModule } from 'src/shared/shared.module'
import { AuthModule } from 'src/routes/auth/auth.module'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import CustomZodValidationPipe from 'src/shared/pipes/custom-zod-validation.pipe'
import { ZodOutputInterceptor } from 'src/shared/interceptors/zod-output.interceptor'
import { HttpExceptionFilter } from 'src/shared/filters/http-exception.filter'
import { CatchEverythingFilter } from 'src/shared/filters/catch-everything.filter'
import { LanguageModule } from 'src/routes/language/language.module'
import { RoleModule } from 'src/routes/role/role.module'
import { PermissionModule } from 'src/routes/permission/permission.module'
import { ProfileModule } from 'src/routes/profile/profile.module'
import { UserModule } from 'src/routes/user/user.module'
import { MediaModule } from 'src/routes/media/media.module'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import path from 'path'
import { BrandModule } from 'src/routes/brand/brand.module'
import { BrandTranslationModule } from 'src/routes/brand/brand-translation/brand-translation.module'
import { ProductModule } from 'src/routes/product/product.module'
import { ProductTranslationModule } from 'src/routes/product/product-translation/product-translation.module'
import { CartModule } from 'src/routes/cart/cart.module'
import { OrderModule } from 'src/routes/order/order.module'
import { WebsocketModule } from 'src/websockets/websocket.module'
import { PaymentModule } from 'src/routes/payment/payment.module'
import { ConversationModule } from 'src/routes/conversation/conversation.module'
import { SharedChatModule } from 'src/shared/modules/shared-chat.module'
import { BullModule } from '@nestjs/bullmq'
import envConfig from 'src/shared/config'
import { PaymentConsumer } from 'src/queues/payment.consumer'
import { ThrottlerBehindProxyGuard } from 'src/shared/guards/throttler-behind-proxy.guard'
import { ReviewModule } from 'src/routes/review/review.module'
import { ThrottlerModule } from '@nestjs/throttler'
import { ZodSerializerInterceptor } from 'nestjs-zod'

// console.log(path.resolve('src/i18n/'))

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: envConfig.REDIS_URL,
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en', // Nếu không có truyền cái gì lên thì nó sẽ tự động lấy là `en`
      loaderOptions: {
        path: path.resolve('src/i18n/'),
        watch: true,
      },
      // Cái chỗ này chúng ta có thể custom lại cái resolvers bằng cách sử dụng HeaderResolver và nhận vào cái options là ['Accept-Language1'] chẳng hạn
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
      typesOutputPath: path.resolve('src/generated/i18n.generated.ts'),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 60000, // 1 minute
          limit: 5,
        },
        {
          name: 'long',
          ttl: 120000, // 2 minutes
          limit: 7,
        },
      ],
    }),
    SharedChatModule,
    WebsocketModule,
    SharedModule,
    AuthModule,
    LanguageModule,
    RoleModule,
    PermissionModule,
    ProfileModule,
    UserModule,
    MediaModule,
    BrandModule,
    BrandTranslationModule,
    ProductModule,
    ProductTranslationModule,
    CartModule,
    OrderModule,
    PaymentModule,
    ConversationModule,
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Thằng Pipe dùng để biến đổi cấu trúc lỗi trả về, chỉ chạy trước cái route handler
    {
      provide: APP_PIPE,
      useClass: CustomZodValidationPipe,
    },
    // Sử dụng cho output validation. Còn cái Interceptor này dùng để mà chuẩn hóa dữ liệu trả về(theo đúng cái ResDTO mà chúng ta cung cấp ở mỗi endpoint), -> Thì khi mà dữ liệu trả về mà không đúng với cái ResDTO mà chúng ta khai báo ở dây thì nó sẽ nhảy xuống cái `Filter` bên dưới và quăng ra lỗi
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    // Khi mà có lỗi liên quan đến validate thì nó sẽ chạy vào thằng Filter này của Zod và quăng ra lỗi
    // Mỗi
    // Khi mà validation bị lỗi thì nó sẽ chạy vào cái HttpExceptionFilter này và nó sẽ show cái lỗi ra terminal -> Thì đây là cái công dụng của HttpExceptionFilter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    // Thằng CatchEverythingFilter này sẽ trả về format lỗi cho chúng ta khi mà bị lỗi
    // {
    //   provide: APP_FILTER,
    //   useClass: CatchEverythingFilter,
    // },
    PaymentConsumer, // test xem khi mà Order xong thì nó đưa vào cái Queue rồi nó có chạy cái hàm ở trong PaymentConsumer hay không
  ],
})
export class AppModule {}
