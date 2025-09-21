import { Test, TestingModule } from '@nestjs/testing'
import { OrderService } from '../order.service'
import { OrderRepo } from '../order.repo'
import { CreateOrderBodyType, GetOrderListQueryType } from '../order.model'
import { OrderStatus } from 'src/shared/constants/order.constant'

// Test data factory để tạo dữ liệu test
const createTestData = {
  orderListQuery: (overrides = {}): GetOrderListQueryType => ({
    page: 1,
    limit: 10,
    ...overrides,
  }),

  createOrderBody: (overrides = {}): CreateOrderBodyType => [
    {
      shopId: 1,
      receiver: {
        name: 'Nguyễn Văn A',
        phone: '0123456789',
        address: '123 Đường ABC, Quận 1, TP.HCM',
      },
      cartItemIds: [1, 2],
      ...overrides,
    },
  ],

  order: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.PENDING_PAYMENT,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  orderListResponse: (overrides = {}) => ({
    data: [
      {
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
        totalAmount: 100000,
        paymentId: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 1,
            productId: 1,
            productName: 'Test Product',
            productTranslations: [
              {
                id: 1,
                name: 'Test Product',
                description: 'Test Description',
                languageId: 'vi',
              },
            ],
            skuPrice: 50000,
            image: 'test-image.jpg',
            skuValue: 'Size: M, Color: Red',
            skuId: 1,
            orderId: 1,
            quantity: 2,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ],
    totalItems: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  }),

  createOrderResponse: (overrides = {}) => ({
    paymentId: 1,
    orders: [
      {
        id: 1,
        userId: 1,
        shopId: 1,
        status: OrderStatus.PENDING_PAYMENT,
        totalAmount: 100000,
        receiver: {
          name: 'Nguyễn Văn A',
          phone: '0123456789',
          address: '123 Đường ABC, Quận 1, TP.HCM',
        },
        paymentId: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: null,
        updatedById: null,
        deletedById: null,
        deletedAt: null,
      },
    ],
    ...overrides,
  }),

  orderDetail: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.PENDING_PAYMENT,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    items: [
      {
        id: 1,
        productId: 1,
        productName: 'Test Product',
        productTranslations: [
          {
            id: 1,
            name: 'Test Product',
            description: 'Test Description',
            languageId: 'vi',
          },
        ],
        skuPrice: 50000,
        image: 'test-image.jpg',
        skuValue: 'Size: M, Color: Red',
        skuId: 1,
        orderId: 1,
        quantity: 2,
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  }),

  cancelOrderResponse: (overrides = {}) => ({
    id: 1,
    userId: 1,
    shopId: 1,
    status: OrderStatus.CANCELLED,
    totalAmount: 100000,
    receiver: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
    },
    paymentId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    ...overrides,
  }),
}

describe('OrderService', () => {
  let service: OrderService
  let module: TestingModule
  let mockOrderRepo: jest.Mocked<OrderRepo>

  beforeEach(async () => {
    // Tạo mock cho OrderRepo với tất cả methods cần thiết
    mockOrderRepo = {
      list: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      detail: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [OrderService, { provide: OrderRepo, useValue: mockOrderRepo }],
    }).compile()

    service = module.get<OrderService>(OrderService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('list', () => {
    it('should get order list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const userId = 1
      const query = createTestData.orderListQuery({
        page: 1,
        limit: 10,
      })
      const mockOrderListResponse = createTestData.orderListResponse()

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
      expect(mockOrderRepo.list).toHaveBeenCalledTimes(1)
    })

    it('should handle order list with status filter', async () => {
      // Arrange - Chuẩn bị dữ liệu test với filter status
      const userId = 1
      const query = createTestData.orderListQuery({
        page: 1,
        limit: 10,
        status: OrderStatus.DELIVERED,
      })
      const mockOrderListResponse = createTestData.orderListResponse({
        data: [
          {
            ...createTestData.orderListResponse().data[0],
            status: OrderStatus.DELIVERED,
          },
        ],
      })

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.data[0].status).toBe(OrderStatus.DELIVERED)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle different pagination parameters', async () => {
      // Arrange - Chuẩn bị dữ liệu test với pagination khác
      const userId = 2
      const query = createTestData.orderListQuery({
        page: 2,
        limit: 5,
      })
      const mockOrderListResponse = createTestData.orderListResponse({
        page: 2,
        limit: 5,
        totalPages: 3,
      })

      mockOrderRepo.list.mockResolvedValue(mockOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderListResponse)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(5)
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle empty order list', async () => {
      // Arrange - Chuẩn bị dữ liệu order list trống
      const userId = 1
      const query = createTestData.orderListQuery()
      const emptyOrderListResponse = createTestData.orderListResponse({
        data: [],
        totalItems: 0,
        totalPages: 0,
      })

      mockOrderRepo.list.mockResolvedValue(emptyOrderListResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(emptyOrderListResponse)
      expect(result.data).toHaveLength(0)
      expect(result.totalItems).toBe(0)
    })
  })

  describe('create', () => {
    it('should create order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order
      const userId = 1
      const body = createTestData.createOrderBody()
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(mockOrderRepo.create).toHaveBeenCalledWith(userId, body)
      expect(mockOrderRepo.create).toHaveBeenCalledTimes(1)
    })

    it('should create order with multiple shops', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với nhiều shop
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1, 2],
        },
        {
          shopId: 2,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [3, 4],
        },
      ]
      const mockCreateOrderResponse = createTestData.createOrderResponse({
        orders: [
          createTestData.createOrderResponse().orders[0],
          {
            ...createTestData.createOrderResponse().orders[0],
            id: 2,
            shopId: 2,
          },
        ],
      })

      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(result.orders).toHaveLength(2)
      expect(result.orders[0].shopId).toBe(1)
      expect(result.orders[1].shopId).toBe(2)
      expect(mockOrderRepo.create).toHaveBeenCalledWith(userId, body)
    })

    it('should create order with different receiver information', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với thông tin receiver khác
      const userId = 2
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Trần Thị B',
            phone: '0987654321',
            address: '456 Đường XYZ, Quận 2, TP.HCM',
          },
          cartItemIds: [5, 6],
        },
      ]
      const mockCreateOrderResponse = createTestData.createOrderResponse({
        orders: [
          {
            ...createTestData.createOrderResponse().orders[0],
            userId: 2,
            receiver: {
              name: 'Trần Thị B',
              phone: '0987654321',
              address: '456 Đường XYZ, Quận 2, TP.HCM',
            },
          },
        ],
      })

      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(result.orders[0].receiver.name).toBe('Trần Thị B')
      expect(result.orders[0].receiver.phone).toBe('0987654321')
      expect(mockOrderRepo.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle single cart item order', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo order với 1 cart item
      const userId = 1
      const body: CreateOrderBodyType = [
        {
          shopId: 1,
          receiver: {
            name: 'Nguyễn Văn A',
            phone: '0123456789',
            address: '123 Đường ABC, Quận 1, TP.HCM',
          },
          cartItemIds: [1],
        },
      ]
      const mockCreateOrderResponse = createTestData.createOrderResponse()

      mockOrderRepo.create.mockResolvedValue(mockCreateOrderResponse)

      // Act - Thực hiện tạo order
      const result = await service.create(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCreateOrderResponse)
      expect(body[0].cartItemIds).toHaveLength(1)
      expect(mockOrderRepo.create).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order
      const userId = 1
      const orderId = 1
      const mockCancelOrderResponse = createTestData.cancelOrderResponse()

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.status).toBe(OrderStatus.CANCELLED)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
      expect(mockOrderRepo.cancel).toHaveBeenCalledTimes(1)
    })

    it('should handle cancel different orders', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order khác
      const userId = 2
      const orderId = 5
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        id: 5,
        userId: 2,
      })

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.id).toBe(5)
      expect(result.userId).toBe(2)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle cancel order with different user', async () => {
      // Arrange - Chuẩn bị dữ liệu hủy order với user khác
      const userId = 3
      const orderId = 1
      const mockCancelOrderResponse = createTestData.cancelOrderResponse({
        userId: 3,
      })

      mockOrderRepo.cancel.mockResolvedValue(mockCancelOrderResponse)

      // Act - Thực hiện hủy order
      const result = await service.cancel(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockCancelOrderResponse)
      expect(result.userId).toBe(3)
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })
  })

  describe('detail', () => {
    it('should get order detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order
      const userId = 1
      const orderId = 1
      const mockOrderDetail = createTestData.orderDetail()

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(orderId)
      expect(result.userId).toBe(userId)
      expect(result.items).toBeDefined()
      expect(result.items).toHaveLength(1)
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
      expect(mockOrderRepo.detail).toHaveBeenCalledTimes(1)
    })

    it('should handle different order details', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết order khác
      const userId = 2
      const orderId = 3
      const mockOrderDetail = createTestData.orderDetail({
        id: 3,
        userId: 2,
        status: OrderStatus.DELIVERED,
        totalAmount: 200000,
      })

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.id).toBe(3)
      expect(result.userId).toBe(2)
      expect(result.status).toBe(OrderStatus.DELIVERED)
      // expect(result.totalAmount).toBe(200000) // totalAmount not in response type
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle order detail with multiple items', async () => {
      // Arrange - Chuẩn bị dữ liệu order có nhiều items
      const userId = 1
      const orderId = 1
      const mockOrderDetail = createTestData.orderDetail({
        items: [
          createTestData.orderDetail().items[0],
          {
            ...createTestData.orderDetail().items[0],
            id: 2,
            productName: 'Test Product 2',
            skuPrice: 75000,
            quantity: 1,
          },
        ],
        totalAmount: 175000, // 50000*2 + 75000*1
      })

      mockOrderRepo.detail.mockResolvedValue(mockOrderDetail)

      // Act - Thực hiện lấy chi tiết order
      const result = await service.detail(userId, orderId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockOrderDetail)
      expect(result.items).toHaveLength(2)
      expect(result.items[0].productName).toBe('Test Product')
      expect(result.items[1].productName).toBe('Test Product 2')
      // expect(result.totalAmount).toBe(175000) // totalAmount not in response type
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle repository errors in list', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const query = createTestData.orderListQuery()
      const repositoryError = new Error('Database connection failed')

      mockOrderRepo.list.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.list(userId, query)).rejects.toThrow('Database connection failed')
      expect(mockOrderRepo.list).toHaveBeenCalledWith(userId, query)
    })

    it('should handle repository errors in create', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const body = createTestData.createOrderBody()
      const repositoryError = new Error('Cart item not found')

      mockOrderRepo.create.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.create(userId, body)).rejects.toThrow('Cart item not found')
      expect(mockOrderRepo.create).toHaveBeenCalledWith(userId, body)
    })

    it('should handle repository errors in cancel', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const orderId = 1
      const repositoryError = new Error('Order not found')

      mockOrderRepo.cancel.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.cancel(userId, orderId)).rejects.toThrow('Order not found')
      expect(mockOrderRepo.cancel).toHaveBeenCalledWith(userId, orderId)
    })

    it('should handle repository errors in detail', async () => {
      // Arrange - Chuẩn bị lỗi từ repository
      const userId = 1
      const orderId = 1
      const repositoryError = new Error('Order not found')

      mockOrderRepo.detail.mockRejectedValue(repositoryError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(service.detail(userId, orderId)).rejects.toThrow('Order not found')
      expect(mockOrderRepo.detail).toHaveBeenCalledWith(userId, orderId)
    })

    it('should pass through repository responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo service không modify data
      const userId = 1
      const query = createTestData.orderListQuery()
      const originalResponse = createTestData.orderListResponse()

      mockOrderRepo.list.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách orders
      const result = await service.list(userId, query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })
  })
})
