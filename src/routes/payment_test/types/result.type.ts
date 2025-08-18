// Result type for handling success/failure
export class Result<T = void> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly data?: T,
    public readonly error?: Error,
  ) {}

  static success<T>(data?: T): Result<T> {
    return new Result<T>(true, data)
  }

  static failure<T>(error: Error): Result<T> {
    return new Result<T>(false, undefined, error)
  }

  static isSuccess<T>(result: Result<T>): result is Result<T> & { data: T } {
    return result.isSuccess
  }

  static isFailure<T>(result: Result<T>): result is Result<T> & { error: Error } {
    return !result.isSuccess
  }
}

// Error types for payment
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PaymentError'
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment with ID ${paymentId} not found`, 'PAYMENT_NOT_FOUND')
  }
}

export class InsufficientFundsError extends PaymentError {
  constructor() {
    super('Insufficient funds for this transaction', 'INSUFFICIENT_FUNDS')
  }
}

export class PaymentAlreadyProcessedError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} has already been processed`, 'PAYMENT_ALREADY_PROCESSED')
  }
}
