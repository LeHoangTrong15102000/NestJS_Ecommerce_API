import { Order, Payment, PrismaClient, ProductSKUSnapshot, User } from '@prisma/client'
import { ProductFactory } from './product.factory'
import { UserFactory } from './user.factory'

export interface OrderFactoryOptions {
  userId?: number
  shopId?: number
  skuId?: number
  productId?: number
  quantity?: number
  status?: 'PENDING_PAYMENT' | 'PENDING_PICKUP' | 'PENDING_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'
  paymentStatus?: 'PENDING' | 'SUCCESS' | 'FAILED'
  voucherId?: number | null
  discountAmount?: number
  shippingFee?: number
  notes?: string
}

export interface OrderFactoryResult {
  order: Order
  payment: Payment
  items: ProductSKUSnapshot[]
  user: User
}

/**
 * DB-writing factory for Order records.
 * Auto-creates all required relations: User, Payment, Product/SKU, ProductSKUSnapshot items.
 * Uses global.__GLOBAL_PRISMA__ to write directly to the test database.
 */
export const OrderFactory = {
  /**
   * Create an order with payment and items.
   * Returns the order, payment, snapshot items, and buyer user.
   */
  async create(overrides: OrderFactoryOptions = {}): Promise<OrderFactoryResult> {
    const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

    // Create or reuse buyer user
    let userId = overrides.userId
    let user: User
    if (!userId) {
      user = await UserFactory.create({
        email: `buyer-${Date.now()}-${Math.floor(Math.random() * 10000)}@factory.test`,
      })
      userId = user.id
    } else {
      user = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })) as User
    }

    // Create or reuse product/SKU
    let skuId = overrides.skuId
    let productId = overrides.productId
    let skuPrice = 100000
    let productName = 'Factory Product'
    let skuValue = 'Standard'
    let skuImage = 'https://example.com/sku-image.jpg'

    if (!skuId) {
      const { product, sku } = await ProductFactory.create()
      skuId = sku.id
      productId = product.id
      skuPrice = sku.price
      productName = product.name
      skuValue = sku.value
      skuImage = sku.image
    } else {
      const sku = await prisma.sKU.findUniqueOrThrow({ where: { id: skuId } })
      const product = await prisma.product.findUniqueOrThrow({ where: { id: sku.productId } })
      productId = product.id
      skuPrice = sku.price
      productName = product.name
      skuValue = sku.value
      skuImage = sku.image
    }

    const quantity = overrides.quantity ?? 1
    const shippingFee = overrides.shippingFee ?? 0
    const discountAmount = overrides.discountAmount ?? 0
    const totalAmount = skuPrice * quantity + shippingFee - discountAmount

    // Create payment first (Order requires paymentId)
    const payment = await prisma.payment.create({
      data: {
        status: overrides.paymentStatus ?? 'PENDING',
      },
    })

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        shopId: overrides.shopId ?? null,
        paymentId: payment.id,
        status: overrides.status ?? 'PENDING_PAYMENT',
        receiver: {
          name: user.name,
          phone: user.phoneNumber,
          address: '123 Test Street',
        },
        shippingFee,
        totalAmount,
        discountAmount,
        voucherId: overrides.voucherId ?? null,
        notes: overrides.notes ?? null,
      },
    })

    // Create ProductSKUSnapshot items
    const snapshot = await prisma.productSKUSnapshot.create({
      data: {
        orderId: order.id,
        skuId,
        productId,
        productName,
        skuPrice,
        skuValue,
        image: skuImage,
        quantity,
        productTranslations: [],
      },
    })

    return { order, payment, items: [snapshot], user }
  },
}
