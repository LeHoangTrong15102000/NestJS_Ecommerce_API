import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { CANCEL_PAYMENT_JOB_NAME, PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'

@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  // Cái  Consumer khi mà đến cái thời gian nó chạy thì nó sẽ chạy, chạy xong thì nó sẽ remove khỏi cái Queue
  async process(job: Job<{ paymentId: number }, any, string>): Promise<any> {
    switch (job.name) {
      case CANCEL_PAYMENT_JOB_NAME: {
        // Sẽ tiến hành cancel cái payment và order dựa trên cái paymentId
        const paymentId = job.data.paymentId
        return
      }
      default: {
        break
      }
    }
  }
}
