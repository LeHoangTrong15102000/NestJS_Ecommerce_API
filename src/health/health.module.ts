import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'
import { BullMQHealthIndicator } from './indicators/bullmq.health-indicator'
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator'
import { RedisHealthIndicator } from './indicators/redis.health-indicator'

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    PrismaHealthIndicator,
    RedisHealthIndicator,
    BullMQHealthIndicator,
  ],
  exports: [HealthService],
})
export class HealthModule {}
