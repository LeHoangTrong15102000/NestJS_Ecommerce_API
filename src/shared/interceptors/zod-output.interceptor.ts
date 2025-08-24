import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { z } from 'zod'
import { ZOD_RESPONSE_ONLY_KEY } from '../decorators/zod-response-only.decorator'

@Injectable()
export class ZodOutputInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Lấy metadata từ ZodResponseOnly decorator
        const zodResponseOptions = this.reflector.get<{ type: any }>(ZOD_RESPONSE_ONLY_KEY, context.getHandler())

        if (zodResponseOptions?.type) {
          try {
            // Thực hiện output validation với Zod schema
            const schema = zodResponseOptions.type
            if (schema && typeof schema.parse === 'function') {
              return schema.parse(data)
            }
          } catch (error) {
            // Log lỗi validation nhưng không throw để tránh crash app
            console.warn('Zod output validation failed:', error.message)
          }
        }

        return data
      }),
    )
  }
}
