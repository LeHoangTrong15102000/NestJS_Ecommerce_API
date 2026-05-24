import { Injectable } from '@nestjs/common'
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus'
import { parse as parsePath } from 'path'
import { BullMQHealthIndicator } from './indicators/bullmq.health-indicator'
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator'
import { RedisHealthIndicator } from './indicators/redis.health-indicator'

export interface ServiceStatus {
  status: 'up' | 'down'
  responseTime?: number
  error?: string
}

export interface HealthCheckResponse {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  checks: {
    database: ServiceStatus
    redis: ServiceStatus
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly bullmqIndicator: BullMQHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  async checkLiveness(): Promise<{ status: string }> {
    return { status: 'ok' }
  }

  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.bullmqIndicator.isHealthy('bullmq'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB
      () => this.disk.checkStorage('storage', { path: parsePath(process.cwd()).root, thresholdPercent: 0.9 }),
    ])
  }

  async checkAll(): Promise<HealthCheckResponse> {
    const startDb = Date.now()
    let databaseStatus: ServiceStatus
    try {
      await this.prismaIndicator.isHealthy('database')
      databaseStatus = { status: 'up', responseTime: Date.now() - startDb }
    } catch {
      databaseStatus = { status: 'down', responseTime: Date.now() - startDb, error: 'Database unreachable' }
    }

    const startRedis = Date.now()
    let redisStatus: ServiceStatus
    try {
      await this.redisIndicator.isHealthy('redis')
      redisStatus = { status: 'up', responseTime: Date.now() - startRedis }
    } catch {
      redisStatus = { status: 'down', responseTime: Date.now() - startRedis, error: 'Redis unreachable' }
    }

    const allHealthy = databaseStatus.status === 'up' && redisStatus.status === 'up'

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: databaseStatus,
        redis: redisStatus,
      },
    }
  }
}
