import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, HttpException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthType, ConditionGuard } from 'src/shared/constants/auth.constant'
import { AUTH_TYPE_KEY, AuthTypeDecoratorPayload } from 'src/shared/decorators/auth.decorator'
import { AccessTokenGuard } from 'src/shared/guards/access-token.guard'
import { PaymentAPIKeyGuard } from 'src/shared/guards/payment-api-key.guard'

/**
 * AuthenticationGuard — central dispatch guard registered as APP_GUARD in AppModule.
 *
 * Dispatch chain:
 *   Every incoming request passes through this guard first. It reads the @Auth()
 *   decorator metadata from the route handler (or controller class) to determine
 *   which concrete guard(s) should validate the request.
 *
 * authTypeGuardMap entries:
 *   - AuthType.Bearer        → AccessTokenGuard   (validates JWT access token in Authorization header)
 *   - AuthType.PaymentAPIKey → PaymentAPIKeyGuard (validates x-api-key header for payment webhooks)
 *   - AuthType.None          → passthrough guard  (always returns true — used for public endpoints
 *                                                   that need no authentication at all)
 *
 * Default auth type:
 *   When no @Auth() decorator is present on the handler or controller, the guard
 *   defaults to { authTypes: [AuthType.Bearer], options: { condition: ConditionGuard.And } }.
 *   This means every route in the project requires a valid Bearer token unless explicitly
 *   opted out via @Auth(AuthType.None) or @IsPublic().
 *
 * AND vs OR condition evaluation:
 *   - ConditionGuard.And — ALL guards in the authTypes array must pass. If any guard
 *     returns false or throws, the request is rejected with 401. This is the default.
 *   - ConditionGuard.Or  — at least ONE guard must pass. Guards are tried in order;
 *     the first successful canActivate() short-circuits the rest. If all guards fail,
 *     the last thrown HttpException is re-thrown (or a generic 401 if none was thrown).
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authTypeGuardMap: Record<string, CanActivate>
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly paymentAPIKeyGuard: PaymentAPIKeyGuard,
  ) {
    // Map each AuthType value to its corresponding guard instance.
    // AuthType.None uses an inline passthrough so no dedicated guard class is needed.
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.PaymentAPIKey]: this.paymentAPIKeyGuard,
      [AuthType.None]: { canActivate: () => true },
    }
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypeValue = this.getAuthTypeValue(context)
    const guards = authTypeValue.authTypes.map((authType) => this.authTypeGuardMap[authType])

    return authTypeValue.options.condition === ConditionGuard.And
      ? this.handleAndCondition(guards, context)
      : this.handleOrCondition(guards, context)
  }

  private getAuthTypeValue(context: ExecutionContext): AuthTypeDecoratorPayload {
    // Mặc định ở trong dự án này là mọi API đều phải có Bearer token nên mặc định sẽ để là AuthType.Bearer, nếu mà API nào mà cung cấp thì sẽ lấy còn không thì lấy mặc định
    // reflector.getAllAndOverride reads the closest @Auth() decorator — handler first, then class.
    // If neither is present, the nullish coalescing fallback enforces Bearer auth by default.
    const authTypeValue = this.reflector.getAllAndOverride<AuthTypeDecoratorPayload | undefined>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { authTypes: [AuthType.Bearer], options: { condition: ConditionGuard.And } }

    return authTypeValue
  }

  private async handleOrCondition(guards: CanActivate[], context: ExecutionContext) {
    let lastError: any = null

    // OR mode: iterate all guards and return true as soon as one passes.
    // Duyệt qua hết các guard, nếu có một guard pass thì return là true
    for (const guard of guards) {
      try {
        if (await guard.canActivate(context)) {
          return true
        }
      } catch (error) {
        lastError = error
      }
    }
    // All guards failed — re-throw the last HttpException for a meaningful error message,
    // or fall back to a generic 401 if no exception was captured.
    if (lastError instanceof HttpException) {
      throw lastError
    }
    throw new UnauthorizedException()
  }

  private async handleAndCondition(guards: CanActivate[], context: ExecutionContext) {
    // AND mode: every guard must pass. The first failure immediately rejects the request.
    for (const guard of guards) {
      try {
        if (!(await guard.canActivate(context))) {
          // còn nếu mà nó return về false thì nó sẽ quăng ra UnauthorizedException
          throw new UnauthorizedException()
        }
      } catch (error) {
        if (error instanceof HttpException) {
          throw error
        }
        throw new UnauthorizedException()
      }
    }

    return true
  }
}
