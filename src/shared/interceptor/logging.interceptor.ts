import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@InjectPinoLogger(LoggingInterceptor.name) private readonly logger: PinoLogger) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // log res header
    // const request = context.switchToHttp().getRequest()
    // const response = context.switchToHttp().getResponse()
    // this.logger.info(request.headers)

    // const now = Date.now()
    return next.handle().pipe(
      tap((data) => {
        this.logger.info({
          body: data,
        })
      }),
    )
  }
}
