import { createKeyv } from '@keyv/redis'
import { BullModule } from '@nestjs/bullmq'
import { CacheModule } from '@nestjs/cache-manager'
import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { IncomingMessage, ServerResponse } from 'http'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import { LoggerModule } from 'nestjs-pino'
import { ZodSerializerInterceptor } from 'nestjs-zod'
import path from 'path'
import pino from 'pino'
import { RemoveRefreshTokenCronjob } from 'src/cronjobs/remove-refresh-token.cronjob'
import { WishlistPriceCheckCronjob } from 'src/cronjobs/wishlist-price-check.cronjob'
import { HealthModule } from 'src/health/health.module'
import { PaymentConsumer } from 'src/queues/payment.consumer'
import { WishlistConsumer } from 'src/queues/wishlist.consumer'
import { AddressModule } from 'src/routes/address/address.module'
import { AIAssistantModule } from 'src/routes/ai-assistant/ai-assistant.module'
import { AuthModule } from 'src/routes/auth/auth.module'
import { BrandTranslationModule } from 'src/routes/brand/brand-translation/brand-translation.module'
import { BrandModule } from 'src/routes/brand/brand.module'
import { CartModule } from 'src/routes/cart/cart.module'
import { CategoryTranslationModule } from 'src/routes/category/category-translation/category-translation.module'
import { CategoryModule } from 'src/routes/category/category.module'
import { ConversationModule } from 'src/routes/conversation/conversation.module'
import { LanguageModule } from 'src/routes/language/language.module'
import { MediaModule } from 'src/routes/media/media.module'
import { OrderModule } from 'src/routes/order/order.module'
import { PaymentModule } from 'src/routes/payment/payment.module'
import { PermissionModule } from 'src/routes/permission/permission.module'
import { ProductTranslationModule } from 'src/routes/product/product-translation/product-translation.module'
import { ProductModule } from 'src/routes/product/product.module'
import { ProfileModule } from 'src/routes/profile/profile.module'
import { ReviewModule } from 'src/routes/review/review.module'
import { RoleModule } from 'src/routes/role/role.module'
import { UserModule } from 'src/routes/user/user.module'
import { VoucherModule } from 'src/routes/voucher/voucher.module'
import { WishlistModule } from 'src/routes/wishlist/wishlist.module'
import envConfig from 'src/shared/config'
import { CatchEverythingFilter } from 'src/shared/filters/catch-everything.filter'
import { HttpExceptionFilter } from 'src/shared/filters/http-exception.filter'
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard'
import { DeprecationMiddleware } from 'src/shared/middleware/deprecation.middleware'
import { MetricsInterceptor } from 'src/shared/metrics/metrics.interceptor'
import { MetricsModule } from 'src/shared/metrics/metrics.module'
import CustomZodValidationPipe from 'src/shared/pipes/custom-zod-validation.pipe'
import { SharedModule } from 'src/shared/shared.module'
import { WebsocketModule } from 'src/websockets/websocket.module'
import { RateLimitGuard } from 'src/rate-limit/rate-limit.guard'
import { RateLimitModule } from 'src/rate-limit/rate-limit.module'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: IncomingMessage) => {
          const incoming = req.headers['x-request-id']
          if (incoming) {
            return Array.isArray(incoming) ? incoming[0] : incoming
          }
          return crypto.randomUUID()
        },
        customProps: (req: IncomingMessage & { id?: string }) => {
          return { reqId: req.id }
        },
        customLogLevel: (_req: IncomingMessage, res: { statusCode: number }, _err: Error | undefined) => {
          if (res.statusCode >= 500) return 'error'
          if (res.statusCode >= 400) return 'warn'
          return 'info'
        },
        serializers: {
          req(req: pino.SerializedRequest) {
            return {
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
            }
          },
          res(res: pino.SerializedResponse) {
            return {
              statusCode: res.statusCode,
            }
          },
        },
        ...(process.env.NODE_ENV === 'development'
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                },
              },
            }
          : {}),
      },
    }),
    // Redis Cache - using Redis Cloud
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const logger = new Logger('CacheModule')
        const store = createKeyv(
          {
            url: envConfig.REDIS_URL,
            socket: {
              connectTimeout: 15000,
              reconnectStrategy: (retries: number) => {
                if (retries > 10) {
                  logger.error('Cache Redis: max retries reached, stopping reconnection')
                  return new Error('Cache Redis: max retries reached')
                }
                logger.warn(`Cache Redis: reconnecting, attempt ${retries}`)
                return Math.min(retries * 200, 5000)
              },
            },
          },
          {
            useUnlink: true,
            throwOnConnectError: process.env.NODE_ENV === 'production',
          },
        )
        return { stores: [store] }
      },
    }),
    ScheduleModule.forRoot({}),
    // BullMQ for background job processing
    BullModule.forRoot({
      connection: {
        url: envConfig.REDIS_URL,
        connectTimeout: 15000,
        commandTimeout: 10000,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        retryStrategy: (times: number) => {
          if (times > 10) return null
          return Math.min(times * 200, 5000)
        },
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
          count: 5000,
        },
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
    RateLimitModule,
    WebsocketModule,
    SharedModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    LanguageModule,
    RoleModule,
    PermissionModule,
    ProfileModule,
    UserModule,
    MediaModule,
    BrandModule,
    BrandTranslationModule,
    CategoryModule,
    CategoryTranslationModule,
    ProductModule,
    ProductTranslationModule,
    CartModule,
    OrderModule,
    PaymentModule,
    ConversationModule,
    ReviewModule,
    AddressModule,
    VoucherModule,
    AIAssistantModule,
    WishlistModule,
  ],
  controllers: [],
  providers: [
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
    // Global metrics interceptor — records HTTP request counts, durations, and in-flight gauge
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // Filters - NestJS executes filters in REVERSE order of registration
    // CatchEverythingFilter registered FIRST → executes LAST (fallback for non-HTTP exceptions including Prisma errors)
    {
      provide: APP_FILTER,
      useClass: CatchEverythingFilter,
    },
    // HttpExceptionFilter registered SECOND → executes FIRST (handles HttpException + ZodSerializationException logging)
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Guards - RateLimitGuard FIRST (rate limit), then AuthenticationGuard (auth)
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: AuthenticationGuard,
    },
    // Queue Architecture: Producers live in feature modules (order, payment, wishlist) co-located
    // with the business logic that enqueues jobs. Consumers live here in src/queues/ as standalone
    // workers. All queue/job name constants are centralized in src/shared/constants/queue.constant.ts.
    // Background job consumers (requires Redis)
    PaymentConsumer, // Process payment jobs from queue
    WishlistConsumer, // Process wishlist background jobs (price check, alerts)
    RemoveRefreshTokenCronjob,
    WishlistPriceCheckCronjob, // Daily price check cron job
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        // Echo x-request-id in response (pino-http assigns req.id before NestJS middleware runs)
        (req: IncomingMessage & { id?: string }, res: ServerResponse, next: () => void) => {
          if (req.id) {
            res.setHeader('x-request-id', req.id)
          }
          next()
        },
        DeprecationMiddleware,
      )
      .forRoutes('*')
  }
}
