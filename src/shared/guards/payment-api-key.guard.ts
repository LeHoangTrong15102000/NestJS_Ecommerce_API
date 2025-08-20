import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import envConfig from 'src/shared/config'

@Injectable()
export class PaymentAPIKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const paymentAPIKey = request.headers['payment-api-key']
    if (paymentAPIKey !== envConfig.PAYMENT_API_KEY) {
      throw new UnauthorizedException()
    }
    return true
  }
}
