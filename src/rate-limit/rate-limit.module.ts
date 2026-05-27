import { Global, Module } from '@nestjs/common'
import { RateLimitGuard } from './rate-limit.guard'
import { SlidingWindowService } from './sliding-window.service'

@Global()
@Module({
  providers: [SlidingWindowService, RateLimitGuard],
  exports: [SlidingWindowService, RateLimitGuard],
})
export class RateLimitModule {}
