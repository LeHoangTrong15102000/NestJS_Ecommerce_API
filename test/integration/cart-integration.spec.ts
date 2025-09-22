import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/shared/services/prisma.service'
import { resetDatabase } from '../helpers/test-helpers'

describe('Cart Integration Tests', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let testUserId: number
  let testSKUId: number

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(global.__GLOBAL_PRISMA__)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true }))
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()
  })

  beforeEach(async () => {
    await resetDatabase()

    // Tạo test user và login để lấy access token
    const testUser = {
      email: 'cart-test@example.com',
      name: 'Cart Test User',
      phoneNumber: '0123456789',
      password: 'password123',
      confirmPassword: 'password123',
    }

    // Send OTP
    await request(app.getHttpServer()).post('/auth/otp').send({
      email: testUser.email,
      type: 'REGISTER',
    })

    // Get OTP code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: testUser.email,
        type: 'REGISTER',
      },
    })

    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...testUser,
        code: verificationCode?.code,
      })

    testUserId = registerResponse.body.id

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .set('User-Agent', 'cart-test-agent')

    accessToken = loginResponse.body.accessToken

    // Tạo test data (SKU, Product, etc.)
    await setupTestData()
  })

  afterAll(async () => {
    await app.close()
  })

  async function setupTestData() {
    // Tạo category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        logo: 'test-logo.png',
        createdById: testUserId,
      },
    })

    // Tạo brand
    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        logo: 'test-brand.png',
        createdById: testUserId,
      },
    })

    // Tạo product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        brandId: brand.id,
        images: ['test-product.png'],
        basePrice: 100000,
        virtualPrice: 100000,
        variants: [],
        publishedAt: new Date(),
        createdById: testUserId,
        categories: {
          connect: { id: category.id },
        },
      },
    })

    // Tạo SKU
    const sku = await prisma.sKU.create({
      data: {
        productId: product.id,
        value: 'Size: M, Color: Blue',
        price: 100000,
        stock: 50,
        image: 'test-sku.png',
        createdById: testUserId,
      },
    })

    testSKUId = sku.id
  }

  describe('Cart Management Flow', () => {
    it('should complete full cart management workflow', async () => {
      // STEP 1: Get empty cart initially
      const emptyCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(emptyCartResponse.body.data).toHaveLength(0)
      expect(emptyCartResponse.body.totalItems).toBe(0)

      // STEP 2: Add item to cart
      const addToCartResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      expect(addToCartResponse.body).toMatchObject({
        skuId: testSKUId,
        quantity: 2,
        userId: testUserId,
      })

      const cartItemId = addToCartResponse.body.id

      // STEP 3: Get cart with items
      const cartWithItemsResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(cartWithItemsResponse.body.data).toHaveLength(1)
      expect(cartWithItemsResponse.body.data[0].cartItems).toHaveLength(1)
      expect(cartWithItemsResponse.body.data[0].cartItems[0]).toMatchObject({
        id: cartItemId,
        quantity: 2,
        skuId: testSKUId,
      })

      // STEP 4: Update cart item quantity
      const updateCartResponse = await request(app.getHttpServer())
        .put(`/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 5,
        })
        .expect(200)

      expect(updateCartResponse.body).toMatchObject({
        id: cartItemId,
        skuId: testSKUId,
        quantity: 5,
        userId: testUserId,
      })

      // STEP 5: Verify updated cart
      const updatedCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(updatedCartResponse.body.data[0].cartItems[0].quantity).toBe(5)

      // STEP 6: Delete cart item
      const deleteCartResponse = await request(app.getHttpServer())
        .post('/cart/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cartItemIds: [cartItemId],
        })
        .expect(200)

      expect(deleteCartResponse.body.message).toBe('1 item(s) deleted from cart')

      // STEP 7: Verify cart is empty after deletion
      const finalCartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(finalCartResponse.body.data).toHaveLength(0)
      expect(finalCartResponse.body.totalItems).toBe(0)
    })

    it('should handle multiple cart items from different products', async () => {
      // Tạo SKU thứ 2
      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['test-product-2.png'],
          basePrice: 150000,
          virtualPrice: 150000,
          variants: [],
          publishedAt: new Date(),
          createdById: testUserId,
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const sku2 = await prisma.sKU.create({
        data: {
          productId: product2.id,
          value: 'Size: L, Color: Red',
          price: 150000,
          stock: 30,
          image: 'test-sku-2.png',
          createdById: testUserId,
        },
      })

      // STEP 1: Add first item
      const addFirstItemResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      // STEP 2: Add second item
      const addSecondItemResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: sku2.id,
          quantity: 3,
        })
        .expect(201)

      // STEP 3: Verify cart has both items
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      // Tính tổng số cart items trong tất cả shops
      const totalCartItems = cartResponse.body.data.reduce((sum: number, shop: any) => sum + shop.cartItems.length, 0)
      expect(totalCartItems).toBe(2)

      // STEP 4: Delete multiple items
      const deleteResponse = await request(app.getHttpServer())
        .post('/cart/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cartItemIds: [addFirstItemResponse.body.id, addSecondItemResponse.body.id],
        })
        .expect(200)

      expect(deleteResponse.body.message).toBe('2 item(s) deleted from cart')
    })

    it('should handle cart pagination', async () => {
      // Thêm nhiều items vào cart
      const cartItems: number[] = []
      for (let i = 0; i < 15; i++) {
        const addResponse = await request(app.getHttpServer())
          .post('/cart')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            skuId: testSKUId,
            quantity: 1,
          })
          .expect(201)

        cartItems.push(addResponse.body.id)
      }

      // Test pagination - page 1
      const page1Response = await request(app.getHttpServer())
        .get('/cart?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(page1Response.body.page).toBe(1)
      expect(page1Response.body.limit).toBe(10)
      expect(page1Response.body.totalItems).toBeGreaterThanOrEqual(15)

      // Test pagination - page 2
      const page2Response = await request(app.getHttpServer())
        .get('/cart?page=2&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(page2Response.body.page).toBe(2)
      expect(page2Response.body.limit).toBe(10)
    })
  })

  describe('Cart Validation Tests', () => {
    it('should reject invalid add to cart request', async () => {
      // Test missing skuId
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 2,
        })
        .expect(400)

      // Test invalid quantity (negative)
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: -1,
        })
        .expect(400)

      // Test invalid quantity (zero)
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 0,
        })
        .expect(400)

      // Test invalid skuId (non-existent)
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: 99999,
          quantity: 2,
        })
        .expect(404)
    })

    it('should reject update cart with invalid data', async () => {
      // Add item to cart first
      const addResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      const cartItemId = addResponse.body.id

      // Test invalid quantity
      await request(app.getHttpServer())
        .put(`/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: -1,
        })
        .expect(400)

      // Test non-existent cart item
      await request(app.getHttpServer())
        .put('/cart/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 3,
        })
        .expect(404)
    })

    it('should require authentication for cart operations', async () => {
      // Test without authorization header
      await request(app.getHttpServer()).get('/cart').expect(401)

      await request(app.getHttpServer())
        .post('/cart')
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(401)

      // Test with invalid token
      await request(app.getHttpServer()).get('/cart').set('Authorization', 'Bearer invalid-token').expect(401)
    })
  })

  describe('Cart Business Logic Tests', () => {
    it('should handle stock validation when adding to cart', async () => {
      // Tạo SKU với stock thấp
      const lowStockProduct = await prisma.product.create({
        data: {
          name: 'Low Stock Product',
          brandId: (await prisma.brand.findFirst())!.id,
          images: ['low-stock.png'],
          basePrice: 50000,
          virtualPrice: 50000,
          variants: [],
          publishedAt: new Date(),
          createdById: testUserId,
          categories: {
            connect: { id: (await prisma.category.findFirst())!.id },
          },
        },
      })

      const lowStockSKU = await prisma.sKU.create({
        data: {
          productId: lowStockProduct.id,
          value: 'Size: S, Color: Black',
          price: 50000,
          stock: 3, // Chỉ có 3 sản phẩm
          image: 'low-stock-sku.png',
          createdById: testUserId,
        },
      })

      // Test thêm quantity vượt quá stock
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: lowStockSKU.id,
          quantity: 5, // Vượt quá stock (3)
        })
        .expect(400)

      // Test thêm quantity hợp lệ
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: lowStockSKU.id,
          quantity: 2, // Trong phạm vi stock
        })
        .expect(201)
    })

    it('should handle duplicate SKU additions correctly', async () => {
      // STEP 1: Add item to cart
      const firstAddResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      // STEP 2: Add same SKU again (should update quantity, not create new item)
      const secondAddResponse = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 3,
        })

      // Verify behavior based on business logic
      // (Could either update existing item or create new item - depends on implementation)
      const cartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      // Count total items for this SKU
      let totalQuantityForSKU = 0
      cartResponse.body.data.forEach((shop: any) => {
        shop.cartItems.forEach((item: any) => {
          if (item.skuId === testSKUId) {
            totalQuantityForSKU += item.quantity
          }
        })
      })

      // Should have total quantity of 5 (2+3) regardless of implementation
      expect(totalQuantityForSKU).toBe(5)
    })

    it("should handle user isolation (users should not see other users' carts)", async () => {
      // Tạo user thứ 2
      const testUser2 = {
        email: 'cart-test-2@example.com',
        name: 'Cart Test User 2',
        phoneNumber: '0987654321',
        password: 'password123',
        confirmPassword: 'password123',
      }

      // Register user 2
      await request(app.getHttpServer()).post('/auth/otp').send({
        email: testUser2.email,
        type: 'REGISTER',
      })

      const verificationCode2 = await prisma.verificationCode.findFirst({
        where: {
          email: testUser2.email,
          type: 'REGISTER',
        },
      })

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser2,
          code: verificationCode2?.code,
        })

      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser2.email,
          password: testUser2.password,
        })
        .set('User-Agent', 'cart-test-agent-2')

      const accessToken2 = loginResponse2.body.accessToken

      // User 1 adds item to cart
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: testSKUId,
          quantity: 2,
        })
        .expect(201)

      // User 2 should see empty cart
      const user2CartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken2}`)
        .expect(200)

      expect(user2CartResponse.body.data).toHaveLength(0)
      expect(user2CartResponse.body.totalItems).toBe(0)

      // User 1 should still see their cart
      const user1CartResponse = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(user1CartResponse.body.totalItems).toBeGreaterThan(0)
    })
  })

  describe('Cart Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test với SKU ID không tồn tại
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          skuId: 999999,
          quantity: 2,
        })
        .expect(404)
    })

    it('should handle malformed requests', async () => {
      // Test với invalid JSON
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send('invalid-json')
        .expect(400)

      // Test với missing content-type
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid-data')
        .expect(400)
    })
  })
})
