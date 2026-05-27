import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { HealthCheckResult } from '@nestjs/terminus'
import { Response } from 'express'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { SkipRateLimit } from 'src/rate-limit/decorators/skip-rate-limit.decorator'
import { HealthService } from './health.service'

@ApiTags('Health')
@SkipRateLimit()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @IsPublic()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the application and its dependencies (database, Redis)',
  })
  @ApiResponse({
    status: 200,
    description: 'All services are healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
        uptime: { type: 'number', example: 123.456 },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                responseTime: { type: 'number', example: 5 },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                responseTime: { type: 'number', example: 2 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services are unhealthy',
  })
  async check(@Res() res: Response): Promise<void> {
    const health = await this.healthService.checkAll()
    const statusCode = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE
    res.status(statusCode).json(health)
  }

  @Get('liveness')
  @IsPublic()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 immediately, confirming the process is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Process is alive',
    schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } },
  })
  async liveness(): Promise<{ status: string }> {
    return this.healthService.checkLiveness()
  }

  @Get('readiness')
  @IsPublic()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Runs all health indicators and returns 200 when all pass or 503 when any fail',
  })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unhealthy' })
  async readiness(): Promise<HealthCheckResult> {
    return this.healthService.checkReadiness()
  }
}
