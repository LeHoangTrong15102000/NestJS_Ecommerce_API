import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common'
import { ApiExcludeEndpoint } from '@nestjs/swagger'
import { Response } from 'express'
import { IsPublic } from 'src/shared/decorators/auth.decorator'
import { SkipRateLimit } from 'src/rate-limit/decorators/skip-rate-limit.decorator'
import { MetricsService } from './metrics.service'

@Controller({ version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @IsPublic()
  @SkipRateLimit()
  @ApiExcludeEndpoint()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics()
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    res.status(200).send(metrics)
  }
}
