// Architecture: producer/consumer split pattern.
// Producers live in feature modules (e.g. src/routes/payment/payment.producer.ts), co-located
// with the business logic that enqueues jobs. Consumers live here in src/queues/ as standalone
// workers. Queue and job name constants are centralized in src/shared/constants/queue.constant.ts.
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { Job } from 'bullmq'
import { CANCEL_PAYMENT_JOB_NAME, PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { SharedPaymentRepository } from 'src/shared/repositories/shared-payment.repo'
import { PaymentFailedEvent } from 'src/events/definitions'

@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  constructor(
    @InjectPinoLogger(PaymentConsumer.name) private readonly logger: PinoLogger,
    private readonly sharedPaymentRepo: SharedPaymentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super()
  }

  async process(job: Job<{ paymentId: number }, any, string>): Promise<any> {
    this.logger.info(`Processing job ${job.name} with ID ${job.id}, attempt ${job.attemptsMade + 1}`)

    try {
      switch (job.name) {
        case CANCEL_PAYMENT_JOB_NAME: {
          const paymentId = job.data.paymentId
          this.logger.info(`Cancelling payment with ID: ${paymentId}`)
          const { userId } = await this.sharedPaymentRepo.cancelPaymentAndOrder(paymentId)
          this.logger.info(`Successfully cancelled payment with ID: ${paymentId}`)

          // Emit domain event — decoupled from WebSocket notification
          this.eventEmitter.emit(
            'payment.failed',
            new PaymentFailedEvent(paymentId, userId, 'Payment timeout — cancelled after 24 hours'),
          )

          return { success: true, paymentId }
        }
        default: {
          const errorMessage = `Unknown job name: ${job.name}`
          this.logger.error(errorMessage)
          throw new Error(errorMessage)
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process job ${job.name} (ID: ${job.id}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      )
      // Re-throw to let BullMQ handle retry logic
      throw error
    }
  }
}
