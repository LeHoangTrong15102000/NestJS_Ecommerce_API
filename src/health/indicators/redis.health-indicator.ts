import { Injectable } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import Redis from 'ioredis'
import envConfig from 'src/shared/config'

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly client: Redis

  constructor() {
    super()
    this.client = new Redis(envConfig.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    })

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
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }
}
