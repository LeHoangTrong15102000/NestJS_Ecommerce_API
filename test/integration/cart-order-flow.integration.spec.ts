import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { CartService } from 'src/routes/cart/cart.service'
import { OrderService } from 'src/routes/order/order.service'
import { CartRepo } from 'src/routes/cart/cart.repo'
import { OrderRepo } from 'src/routes/order/order.repo'
import { PrismaService } from 'src/shared/services/prisma.service'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { OrderStatus } from 'src/shared/constants/order.constant'

/**
 * Cart-Order Flow Integration Tests
 *
 * Tập integration tests này kiểm tra workflow hoàn chỉnh từ Cart đến Order:
 * 1. User thêm sản phẩm vào cart
 * 2. User cập nhật quantity trong cart
 * 3. User tạo order từ cart items
 * 4. User xem order details
 * 5. User hủy order (nếu cần)
 * 6. Cleanup cart sau khi tạo order
 */

describe('Cart-Order Flow Integration Tests', () => {
  let app: INestApplication
  let cartService: CartService
  let orderService: OrderService
  let prismaService: PrismaService
  let userRepo: SharedUserRepository

  // Test data
  const testUserId = 1
  const testShopId = 1
  const testSKUId = 1

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        OrderService,
        CartRepo,
        OrderRepo,
        PrismaService,
        SharedUserRepository,
        // Mock các dependencies khác nếu cần
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    cartService = moduleFixture.get<CartService>(CartService)
    orderService = moduleFixture.get<OrderService>(OrderService)
    prismaService = moduleFixture.get<PrismaService>(PrismaService)
    userRepo = moduleFixture.get<SharedUserRepository>(SharedUserRepository)
  })

  afterAll(async () => {
    // Cleanup test data
    cleanupTestData()
    await app.close()
  })

  beforeEach(() => {
    // Setup fresh test data cho mỗi test
    setupTestData()
  })

  afterEach(() => {
    // Cleanup sau mỗi test
    cleanupTestData()
  })

  describe('Complete Cart to Order Workflow', () => {
    it('should complete full cart-to-order flow successfully', async () => {
      // STEP 1: User thêm sản phẩm vào cart
      const addToCartResult = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 2,
      })

      expect(addToCartResult).toBeDefined()
      expect(addToCartResult.skuId).toBe(testSKUId)
      expect(addToCartResult.quantity).toBe(2)
      expect(addToCartResult.userId).toBe(testUserId)

      // STEP 2: User cập nhật quantity trong cart
      const updateCartResult = await cartService.updateCartItem({
        userId: testUserId,
        cartItemId: addToCartResult.id,
        body: {
          skuId: testSKUId,
          quantity: 3,
        },
      })

      expect(updateCartResult).toBeDefined()
      expect(updateCartResult.quantity).toBe(3)
      expect(updateCartResult.id).toBe(addToCartResult.id)

      // STEP 3: User xem cart để confirm
      const cartList = await cartService.getCart(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(cartList).toBeDefined()
      expect(cartList.data).toHaveLength(1)
      expect(cartList.data[0].cartItems).toHaveLength(1)
      expect(cartList.data[0].cartItems[0].quantity).toBe(3)

      // STEP 4: User tạo order từ cart items
      const createOrderResult = await orderService.create(testUserId, [
        {
          shopId: testShopId,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [updateCartResult.id],
        },
      ])

      expect(createOrderResult).toBeDefined()
      expect(createOrderResult.orders).toHaveLength(1)
      expect(createOrderResult.orders[0].userId).toBe(testUserId)
      expect(createOrderResult.orders[0].shopId).toBe(testShopId)
      expect(createOrderResult.orders[0].status).toBe(OrderStatus.PENDING_PAYMENT)
      expect(createOrderResult.paymentId).toBeDefined()

      // STEP 5: User xem order details
      const orderDetail = await orderService.detail(testUserId, createOrderResult.orders[0].id)

      expect(orderDetail).toBeDefined()
      expect(orderDetail.id).toBe(createOrderResult.orders[0].id)
      expect(orderDetail.userId).toBe(testUserId)
      expect(orderDetail.items).toBeDefined()
      expect(orderDetail.items.length).toBeGreaterThan(0)

      // STEP 6: Verify cart được cleanup sau khi tạo order (cart item bị xóa)
      const cartAfterOrder = await cartService.getCart(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(cartAfterOrder.data).toHaveLength(0) // Cart should be empty
      expect(cartAfterOrder.totalItems).toBe(0)

      // STEP 7: User check order list để verify
      const orderList = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(orderList).toBeDefined()
      expect(orderList.data).toHaveLength(1)
      expect(orderList.data[0].id).toBe(createOrderResult.orders[0].id)
      expect(orderList.data[0].status).toBe(OrderStatus.PENDING_PAYMENT)
    })

    it('should handle multiple cart items from different shops', async () => {
      // STEP 1: Thêm items từ shop 1
      const cartItem1 = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 1,
      })

      // STEP 2: Thêm items từ shop 2 (giả sử có SKU từ shop khác)
      const cartItem2 = await cartService.addToCart(testUserId, {
        skuId: testSKUId + 1, // SKU từ shop khác
        quantity: 2,
      })

      // STEP 3: Tạo order cho cả 2 shops
      const createOrderResult = await orderService.create(testUserId, [
        {
          shopId: testShopId,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [cartItem1.id],
        },
        {
          shopId: testShopId + 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [cartItem2.id],
        },
      ])

      expect(createOrderResult).toBeDefined()
      expect(createOrderResult.orders).toHaveLength(2)
      expect(createOrderResult.orders[0].shopId).toBe(testShopId)
      expect(createOrderResult.orders[1].shopId).toBe(testShopId + 1)

      // STEP 4: Verify order list có 2 orders
      const orderList = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(orderList.data).toHaveLength(2)
    })

    it('should handle order cancellation workflow', async () => {
      // STEP 1: Tạo cart item và order
      const cartItem = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 1,
      })

      const createOrderResult = await orderService.create(testUserId, [
        {
          shopId: testShopId,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [cartItem.id],
        },
      ])

      expect(createOrderResult.orders[0].status).toBe(OrderStatus.PENDING_PAYMENT)

      // STEP 2: User hủy order
      const cancelResult = await orderService.cancel(testUserId, createOrderResult.orders[0].id)

      expect(cancelResult).toBeDefined()
      expect(cancelResult.status).toBe(OrderStatus.CANCELLED)
      expect(cancelResult.id).toBe(createOrderResult.orders[0].id)

      // STEP 3: Verify order status trong order list
      const orderList = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(orderList.data[0].status).toBe(OrderStatus.CANCELLED)

      // STEP 4: Verify order detail cũng có status cancelled
      const orderDetail = await orderService.detail(testUserId, createOrderResult.orders[0].id)
      expect(orderDetail.status).toBe(OrderStatus.CANCELLED)
    })
  })

  describe('Cart Management Edge Cases', () => {
    it('should handle cart item quantity updates', async () => {
      // STEP 1: Thêm cart item
      const cartItem = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 1,
      })

      // STEP 2: Update quantity nhiều lần
      const update1 = await cartService.updateCartItem({
        userId: testUserId,
        cartItemId: cartItem.id,
        body: {
          skuId: testSKUId,
          quantity: 5,
        },
      })
      expect(update1.quantity).toBe(5)

      const update2 = await cartService.updateCartItem({
        userId: testUserId,
        cartItemId: cartItem.id,
        body: {
          skuId: testSKUId,
          quantity: 3,
        },
      })
      expect(update2.quantity).toBe(3)

      // STEP 3: Verify trong cart list
      const cartList = await cartService.getCart(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(cartList.data[0].cartItems[0].quantity).toBe(3)
    })

    it('should handle cart item deletion', async () => {
      // STEP 1: Thêm multiple cart items
      const cartItem1 = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 1,
      })

      const cartItem2 = await cartService.addToCart(testUserId, {
        skuId: testSKUId + 1,
        quantity: 2,
      })

      // STEP 2: Verify có 2 items trong cart
      const cartBefore = await cartService.getCart(testUserId, {
        page: 1,
        limit: 10,
      })
      const totalItemsBefore = cartBefore.data.reduce((sum, shop) => sum + shop.cartItems.length, 0)
      expect(totalItemsBefore).toBe(2)

      // STEP 3: Xóa 1 cart item
      const deleteResult = await cartService.deleteCart(testUserId, {
        cartItemIds: [cartItem1.id],
      })

      expect(deleteResult.message).toBe('1 item(s) deleted from cart')

      // STEP 4: Verify chỉ còn 1 item
      const cartAfter = await cartService.getCart(testUserId, {
        page: 1,
        limit: 10,
      })
      const totalItemsAfter = cartAfter.data.reduce((sum, shop) => sum + shop.cartItems.length, 0)
      expect(totalItemsAfter).toBe(1)
    })
  })

  describe('Order Management Edge Cases', () => {
    it('should handle order filtering by status', async () => {
      // STEP 1: Tạo multiple orders
      const cartItem1 = await cartService.addToCart(testUserId, {
        skuId: testSKUId,
        quantity: 1,
      })

      const cartItem2 = await cartService.addToCart(testUserId, {
        skuId: testSKUId + 1,
        quantity: 1,
      })

      const order1 = await orderService.create(testUserId, [
        {
          shopId: testShopId,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [cartItem1.id],
        },
      ])

      const order2 = await orderService.create(testUserId, [
        {
          shopId: testShopId,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [cartItem2.id],
        },
      ])

      // STEP 2: Cancel 1 order
      await orderService.cancel(testUserId, order1.orders[0].id)

      // STEP 3: Filter by PENDING status
      const pendingOrders = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
        status: OrderStatus.PENDING_PAYMENT,
      })

      expect(pendingOrders.data).toHaveLength(1)
      expect(pendingOrders.data[0].id).toBe(order2.orders[0].id)
      expect(pendingOrders.data[0].status).toBe(OrderStatus.PENDING_PAYMENT)

      // STEP 4: Filter by CANCELLED status
      const cancelledOrders = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
        status: OrderStatus.CANCELLED,
      })

      expect(cancelledOrders.data).toHaveLength(1)
      expect(cancelledOrders.data[0].id).toBe(order1.orders[0].id)
      expect(cancelledOrders.data[0].status).toBe(OrderStatus.CANCELLED)
    })

    it('should handle pagination in order list', async () => {
      // STEP 1: Tạo multiple orders (>10 orders)
      const orderPromises: Promise<any>[] = []
      for (let i = 0; i < 15; i++) {
        const cartItem = await cartService.addToCart(testUserId, {
          skuId: testSKUId,
          quantity: 1,
        })

        orderPromises.push(
          orderService.create(testUserId, [
            {
              shopId: testShopId,
              receiver: {
                name: `User ${i}`,
                phone: '0123456789',
                address: `Address ${i}`,
              },
              cartItemIds: [cartItem.id],
            },
          ]),
        )
      }

      await Promise.all(orderPromises)

      // STEP 2: Test pagination
      const page1 = await orderService.list(testUserId, {
        page: 1,
        limit: 10,
      })

      expect(page1.data).toHaveLength(10)
      expect(page1.page).toBe(1)
      expect(page1.totalItems).toBe(15)
      expect(page1.totalPages).toBe(2)

      const page2 = await orderService.list(testUserId, {
        page: 2,
        limit: 10,
      })

      expect(page2.data).toHaveLength(5)
      expect(page2.page).toBe(2)
      expect(page2.totalItems).toBe(15)
      expect(page2.totalPages).toBe(2)
    })
  })

  /**
   * Helper functions để setup và cleanup test data
   */
  function setupTestData() {
    // Setup test user, products, SKUs, etc.
    // Thực tế sẽ cần setup data trong database
    // Đây chỉ là placeholder
    try {
      // Ensure test user exists
      // Ensure test products/SKUs exist
      // Reset cart cho test user
    } catch (error) {
      console.warn('Setup test data warning:', error.message)
    }
  }

  function cleanupTestData() {
    // Cleanup test data sau mỗi test
    try {
      // Delete test orders
      // Delete test cart items
      // Reset state
    } catch (error) {
      console.warn('Cleanup test data warning:', error.message)
    }
  }
})
