import { Controller, Get, Res } from '@nestjs/common'
import { ApiExcludeEndpoint } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { Response } from 'express'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { MetricsService } from './metrics.service'

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @IsPublic()
  @SkipThrottle({ short: true, long: true })
  @ApiExcludeEndpoint()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics()
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    res.status(200).send(metrics)
  }
}
