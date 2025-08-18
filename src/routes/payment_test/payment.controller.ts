import { Body, Controller, Get, Param, Post, Put, Query, HttpStatus, HttpException } from '@nestjs/common'
import { CreatePaymentCommand, CreatePaymentCommandHandler } from './commands/create-payment.command'
import { ProcessPaymentCommand, ProcessPaymentCommandHandler } from './commands/process-payment.command'
import { GetPaymentQuery, GetPaymentQueryHandler } from './queries/get-payment.query'
import { ListPaymentsQuery, ListPaymentsQueryHandler, PaymentListResult } from './queries/list-payments.query'
import { Payment, PaymentMethod, PaymentStatus } from './models/payment.model'
import { Result } from './types/result.type'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'

// DTOs for HTTP requests/responses
export class CreatePaymentDto {
  orderId: string
  amount: number
  currency: string
  method: PaymentMethod
  metadata?: Record<string, any>
}

export class ListPaymentsDto {
  page?: number = 1
  limit?: number = 10
  status?: PaymentStatus
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

@Controller('payments')
export class PaymentController {
  constructor(
    // Inject command handlers
    private readonly createPaymentHandler: CreatePaymentCommandHandler,
    private readonly processPaymentHandler: ProcessPaymentCommandHandler,
    // Inject query handlers
    private readonly getPaymentHandler: GetPaymentQueryHandler,
    private readonly listPaymentsHandler: ListPaymentsQueryHandler,
  ) {}

  /**
   * COMMAND: Tạo payment mới
   * POST /payments
   */
  @Post()
  async createPayment(@Body() dto: CreatePaymentDto, @ActiveUser('userId') userId: number): Promise<Payment> {
    // Tạo command từ input
    const command = new CreatePaymentCommand(userId, dto.orderId, dto.amount, dto.currency, dto.method, dto.metadata)

    // Execute command handler
    const result = await this.createPaymentHandler.handle(command)

    // Handle result
    if (Result.isSuccess(result)) {
      return result.data
    } else {
      throw new HttpException(result.error?.message || 'Unknown error', HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * COMMAND: Process payment
   * PUT /payments/:id/process
   */
  @Put(':id/process')
  async processPayment(@Param('id') paymentId: string, @ActiveUser('userId') userId: number): Promise<Payment> {
    // Tạo command
    const command = new ProcessPaymentCommand(paymentId, userId)

    // Execute command handler
    const result = await this.processPaymentHandler.handle(command)

    // Handle result
    if (Result.isSuccess(result)) {
      return result.data
    } else {
      throw new HttpException(result.error?.message || 'Unknown error', HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * QUERY: Lấy payment detail
   * GET /payments/:id
   */
  @Get(':id')
  async getPayment(@Param('id') paymentId: string, @ActiveUser('userId') userId: number): Promise<Payment> {
    // Tạo query
    const query = new GetPaymentQuery(paymentId, userId)

    // Execute query handler
    const payment = await this.getPaymentHandler.handle(query)

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND)
    }

    return payment
  }

  /**
   * QUERY: List payments với filters và pagination
   * GET /payments
   */
  @Get()
  async listPayments(@Query() dto: ListPaymentsDto, @ActiveUser('userId') userId: number): Promise<PaymentListResult> {
    // Convert query parameters
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : undefined
    const dateTo = dto.dateTo ? new Date(dto.dateTo) : undefined

    // Tạo query
    const query = new ListPaymentsQuery(
      userId,
      dto.page || 1,
      dto.limit || 10,
      dto.status,
      dto.orderId,
      dateFrom,
      dateTo,
    )

    // Execute query handler
    return await this.listPaymentsHandler.handle(query)
  }
}
