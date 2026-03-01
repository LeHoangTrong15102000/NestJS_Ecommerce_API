import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { OrderController } from 'src/routes/order/order.controller'
import { OrderProducer } from 'src/routes/order/order.producer'
import { VoucherModule } from 'src/routes/voucher/voucher.module'
import { PAYMENT_QUEUE_NAME } from 'src/shared/constants/queue.constant'
import { OrderRepo } from './order.repo'
import { OrderService } from './order.service'

@Module({
  imports: [
    BullModule.registerQueue({
      name: PAYMENT_QUEUE_NAME,
    }),
    VoucherModule,
  ],
  providers: [OrderService, OrderRepo, OrderProducer],
  controllers: [OrderController],
})
export class OrderModule {}
