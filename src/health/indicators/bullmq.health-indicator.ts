import { Injectable } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import Redis, { RedisOptions } from 'ioredis'
import envConfig from 'src/shared/config'

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  private readonly client: Redis

  constructor() {
    super()
    const options: RedisOptions = {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      lazyConnect: true,
    }
    this.client = new Redis(envConfig.REDIS_URL, options)

    this.client.on('error', () => {
      // Suppress connection errors — health check handles them
    })
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect()
      }
      await this.client.ping()
      return this.getStatus(key, true)
    } catch (error) {
      throw new HealthCheckError(
        'BullMQ health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit()
      } else {
        this.client.disconnect()
      }
    } catch {
      // Ignore cleanup errors during shutdown
    }
  }
}
