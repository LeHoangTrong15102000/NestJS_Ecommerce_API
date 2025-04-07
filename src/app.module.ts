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
import { LanguageModule } from 'src/routes/language/language.module'
import { RoleModule } from 'src/routes/role/role.module'
import { PermissionModule } from 'src/routes/permission/permission.module'
import { MediaModule } from 'src/routes/media/media.module'
import { ProfileModule } from 'src/routes/profile/profile.module'

@Module({
  imports: [SharedModule, AuthModule, LanguageModule, RoleModule, PermissionModule, MediaModule, ProfileModule],
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
    // Thằng CatchEverythingFilter này sẽ trả về format lỗi cho chúng ta khi mà bị lỗi
    // {
    //   provide: APP_FILTER,
    //   useClass: CatchEverythingFilter,
    // },
  ],
})
export class AppModule {}
