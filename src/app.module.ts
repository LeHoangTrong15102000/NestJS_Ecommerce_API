import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SharedModule } from 'src/shared/shared.module'
import { AuthModule } from 'src/routes/auth/auth.module'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import CustomZodValidationPipe from 'src/shared/pipes/custom-zod-validation.pipe'
import { ZodSerializerInterceptor } from 'nestjs-zod'
import { HttpExceptionFilter } from 'src/shared/filters/http-exception.filter'
import { CatchEverythingFilter } from 'src/shared/filters/catch-everything.filter'

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [AppController],
  providers: [
    AppService,
    // Khi mà có lỗi liên quan đến validate thì nó sẽ chạy vào thằng Pipe custom này của Zod và quăng ra lỗi
    // Khi mà validation bị lỗi thì nó sẽ chạy vào cái CustomZodValidationPipe này và nó sẽ show cái lỗi ra terminal -> Thì đây là cái công dụng của ValidationPipe
    {
      provide: APP_PIPE,
      useClass: CustomZodValidationPipe,
    },
    // Sử dụng cho output validation. Còn cái Interceptor này dùng để mà chuẩn hóa dữ liệu trả về(theo đúng cái ResDTO mà chúng ta cung cấp ở mỗi endpoint)
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Thằng CatchEverythingFilter này sẽ trả về format lỗi cho chúng ta khi mà bị lỗi
    // {
    //   provide: APP_FILTER,
    //   useClass: CatchEverythingFilter,
    // },
  ],
})
export class AppModule {}
