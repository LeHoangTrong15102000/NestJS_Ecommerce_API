import { Module } from '@nestjs/common'
import { PaymentController } from './payment.controller'

// Command Handlers
import { CreatePaymentCommandHandler } from './commands/create-payment.command'
import { ProcessPaymentCommandHandler } from './commands/process-payment.command'

// Query Handlers
import { GetPaymentQueryHandler } from './queries/get-payment.query'
import { ListPaymentsQueryHandler } from './queries/list-payments.query'

// Decorators
import { LoggingCommandDecorator, LoggingQueryDecorator } from './decorators/logging.decorator'
import { ValidationCommandDecorator } from './decorators/validation.decorator'

@Module({
  controllers: [PaymentController],
  providers: [
    // Command Handlers (base implementations)
    CreatePaymentCommandHandler,
    ProcessPaymentCommandHandler,

    // Query Handlers (base implementations)
    GetPaymentQueryHandler,
    ListPaymentsQueryHandler,

    // Decorators for cross-cutting concerns
    LoggingCommandDecorator,
    LoggingQueryDecorator,
    ValidationCommandDecorator,

    // Note: Trong thực tế, bạn sẽ cần register các decorators
    // với DI container và configure chúng đúng cách.
    // Ví dụ sử dụng Scrutor (như trong bài viết) hoặc manual setup
  ],
  exports: [
    CreatePaymentCommandHandler,
    ProcessPaymentCommandHandler,
    GetPaymentQueryHandler,
    ListPaymentsQueryHandler,
  ],
})
export class PaymentModule {}
