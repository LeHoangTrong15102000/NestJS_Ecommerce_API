import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { CANCEL_PAYMENT_JOB_NAME, PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { Queue } from 'bullmq'
import { generateCancelPaymentJobId } from 'src/shared/helpers'

@Injectable()
export class OrderProducer {
  constructor(@InjectQueue(PAYMENT_QUEUE_NAME) private paymentQueue: Queue) {
    // Check xem job đã được add vào queue hay chưa
    // this.paymentQueue.getJobs().then((jobs) => {
    //   console.log(jobs)
    // })
  }

  async addCancelPaymentJob(paymentId: number) {
    return this.paymentQueue.add(
      CANCEL_PAYMENT_JOB_NAME,
      { paymentId },
      {
        delay: 1000 * 60 * 60 * 24,
        // Và cần phải cung cấp một cái jobId, chỉ nhận vào string mà thôi
        jobId: generateCancelPaymentJobId(paymentId),
        removeOnComplete: true, // khi mà cái job được chạy thành công thì nó sẽ được xoá ra khỏi hàng đợi
        removeOnFail: true,
      },
    )
  }
}
