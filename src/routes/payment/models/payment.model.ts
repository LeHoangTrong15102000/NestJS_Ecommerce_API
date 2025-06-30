// Payment domain models
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
}

export interface Payment {
  id: string
  userId: number
  orderId: string
  amount: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  processedAt?: Date
  failedReason?: string
  transactionId?: string
}

export interface PaymentEvent {
  id: string
  paymentId: string
  eventType: string
  eventData: Record<string, any>
  createdAt: Date
  userId: number
}
