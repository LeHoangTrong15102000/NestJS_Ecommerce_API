# 🛒 Xử Lý Race Condition: 5 Người Mua 1 Sản Phẩm - NestJS + Prisma

> **Tình huống**: Sản phẩm chỉ còn 1 chiếc, nhưng có 5 người cùng lúc nhấn "Mua ngay". Làm sao để chỉ 1 người mua được?

---

## 📋 MỤC LỤC

1. [Thiết Kế Database Đơn Giản](#1-thiết-kế-database-đơn-giản)
2. [Vấn Đề Race Condition](#2-vấn-đề-race-condition)
3. [Giải Pháp 1: Pessimistic Locking](#3-giải-pháp-1-pessimistic-locking)
4. [Giải Pháp 2: Optimistic Locking](#4-giải-pháp-2-optimistic-locking)
5. [Giải Pháp 3: Database Transaction](#5-giải-pháp-3-database-transaction)
6. [Testing & Demo](#6-testing--demo)
7. [So Sánh Các Giải Pháp](#7-so-sánh-các-giải-pháp)

---

## 1. Thiết Kế Database Đơn Giản

### **Prisma Schema**

```prisma
// schema.prisma
model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  stock       Int      // Số lượng tồn kho
  version     Int      @default(1) // Cho optimistic locking
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  cartItems   CartItem[]
  orderItems  OrderItem[]
}

model Cart {
  id        Int      @id @default(autoincrement())
  userId    Int?     // NULL cho guest
  sessionId String?  // Cho guest users
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items     CartItem[]
}

model CartItem {
  id        Int      @id @default(autoincrement())
  cartId    Int
  productId Int
  quantity  Int

  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id])

  @@unique([cartId, productId]) // 1 sản phẩm chỉ 1 lần trong cart
}

model Order {
  id        Int      @id @default(autoincrement())
  userId    Int
  status    String   @default("PENDING")
  total     Float
  createdAt DateTime @default(now())

  items     OrderItem[]
}

model OrderItem {
  id          Int      @id @default(autoincrement())
  orderId     Int
  productId   Int
  quantity    Int
  price       Float    // Giá tại thời điểm mua
  productName String   // Tên sản phẩm tại thời điểm mua

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product  @relation(fields: [productId], references: [id])
}
```

### **Tạo Sample Data**

```typescript
// seed.ts - Tạo dữ liệu mẫu
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Tạo sản phẩm chỉ còn 1 chiếc
  const product = await prisma.product.create({
    data: {
      name: 'iPhone 15 Pro Max - Màu Xanh',
      price: 29990000,
      stock: 1, // ⚠️ Chỉ còn 1 chiếc!
    },
  })

  console.log('Đã tạo sản phẩm:', product)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## 2. Vấn Đề Race Condition

### **Code Có Vấn đề (❌ WRONG)**

```typescript
// ❌ Code này sẽ gây ra overselling!
@Injectable()
export class OrderService {
  constructor(private prisma: PrismaClient) {}

  async buyProduct(userId: number, productId: number, quantity: number = 1) {
    // Bước 1: Đọc stock hiện tại
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      throw new Error('Sản phẩm không tồn tại')
    }

    // Bước 2: Kiểm tra stock
    if (product.stock < quantity) {
      throw new Error(`Không đủ hàng! Chỉ còn ${product.stock} sản phẩm`)
    }

    // ⚠️ VẤN ĐỀ: Giữa lúc check và update, có thể có người khác mua trước!

    // Bước 3: Trừ stock
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: product.stock - quantity },
    })

    // Bước 4: Tạo order
    const order = await this.prisma.order.create({
      data: {
        userId,
        total: product.price * quantity,
        items: {
          create: {
            productId,
            quantity,
            price: product.price,
            productName: product.name,
          },
        },
      },
    })

    return order
  }
}
```

### **Tại Sao Có Vấn đề?**

```
Thời điểm T1: User A đọc stock = 1 ✅
Thời điểm T2: User B đọc stock = 1 ✅ (vẫn chưa bị trừ)
Thời điểm T3: User A update stock = 0 ✅
Thời điểm T4: User B update stock = 0 ✅ (nhưng thực tế là -1!)

Kết quả: Cả 2 người đều mua được, stock = 0 hoặc -1 ❌
```

---

## 3. Giải Pháp 1: Pessimistic Locking

### **Nguyên Lý**

- **Lock** record trong database để không ai khác đọc/sửa được
- Sử dụng `SELECT ... FOR UPDATE`
- An toàn 100% nhưng có thể chậm

### **Code Implementation**

```typescript
// ✅ Giải pháp 1: Pessimistic Locking
@Injectable()
export class OrderService {
  constructor(private prisma: PrismaClient) {}

  async buyProductWithLocking(userId: number, productId: number, quantity: number = 1) {
    return await this.prisma.$transaction(async (tx) => {
      // Bước 1: LOCK sản phẩm (chặn mọi thao tác khác)
      const product = await tx.$queryRaw<Product[]>`
        SELECT * FROM "Product" 
        WHERE id = ${productId} 
        FOR UPDATE
      `

      if (!product[0]) {
        throw new Error('Sản phẩm không tồn tại')
      }

      const currentProduct = product[0]

      // Bước 2: Kiểm tra stock (an toàn vì đã lock)
      if (currentProduct.stock < quantity) {
        throw new Error(`Không đủ hàng! Chỉ còn ${currentProduct.stock} sản phẩm`)
      }

      // Bước 3: Trừ stock (atomic operation)
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: currentProduct.stock - quantity },
      })

      // Bước 4: Tạo order
      const order = await tx.order.create({
        data: {
          userId,
          total: currentProduct.price * quantity,
          items: {
            create: {
              productId,
              quantity,
              price: currentProduct.price,
              productName: currentProduct.name,
            },
          },
        },
      })

      return {
        success: true,
        order,
        message: 'Đặt hàng thành công!',
        remainingStock: updatedProduct.stock,
      }
    })
  }
}
```

### **Cách Hoạt Động**

```
User A gọi buyProductWithLocking():
├── LOCK Product id=1 🔒
├── Kiểm tra stock = 1 ✅
├── Update stock = 0 ✅
├── Tạo order ✅
└── UNLOCK 🔓

User B gọi buyProductWithLocking():
├── Chờ LOCK được giải phóng... ⏳
├── LOCK Product id=1 🔒
├── Kiểm tra stock = 0 ❌
├── Throw error: "Không đủ hàng!"
└── UNLOCK 🔓
```

---

## 4. Giải Pháp 2: Optimistic Locking

### **Nguyên Lý**

- Sử dụng **version** field để detect conflicts
- Không lock, nhưng check version trước khi update
- Nhanh hơn nhưng có thể phải retry

### **Code Implementation**

```typescript
// ✅ Giải pháp 2: Optimistic Locking
@Injectable()
export class OrderService {
  async buyProductWithVersion(userId: number, productId: number, quantity: number = 1, maxRetries: number = 3) {
    let attempts = 0

    while (attempts < maxRetries) {
      try {
        attempts++

        return await this.prisma.$transaction(async (tx) => {
          // Bước 1: Đọc sản phẩm và version hiện tại
          const product = await tx.product.findUnique({
            where: { id: productId },
          })

          if (!product) {
            throw new Error('Sản phẩm không tồn tại')
          }

          // Bước 2: Kiểm tra stock
          if (product.stock < quantity) {
            throw new Error(`Không đủ hàng! Chỉ còn ${product.stock} sản phẩm`)
          }

          // Bước 3: Update với version check
          const updateResult = await tx.product.updateMany({
            where: {
              id: productId,
              version: product.version, // ⚠️ Chỉ update nếu version chưa thay đổi
            },
            data: {
              stock: product.stock - quantity,
              version: product.version + 1, // Tăng version
            },
          })

          // Bước 4: Kiểm tra có update được không
          if (updateResult.count === 0) {
            throw new Error('CONFLICT_VERSION') // Có người khác đã thay đổi
          }

          // Bước 5: Tạo order
          const order = await tx.order.create({
            data: {
              userId,
              total: product.price * quantity,
              items: {
                create: {
                  productId,
                  quantity,
                  price: product.price,
                  productName: product.name,
                },
              },
            },
          })

          return {
            success: true,
            order,
            message: 'Đặt hàng thành công!',
            remainingStock: product.stock - quantity,
            attempts,
          }
        })
      } catch (error) {
        if (error.message === 'CONFLICT_VERSION' && attempts < maxRetries) {
          // Retry với delay ngẫu nhiên
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 100))
          continue
        }
        throw error
      }
    }

    throw new Error(`Không thể đặt hàng sau ${maxRetries} lần thử. Vui lòng thử lại!`)
  }
}
```

---

## 5. Giải Pháp 3: Database Transaction + Atomic Update

### **Nguyên Lý**

- Sử dụng **atomic update** trực tiếp trong SQL
- Combine check và update trong 1 query
- Đơn giản và hiệu quả nhất

### **Code Implementation**

```typescript
// ✅ Giải pháp 3: Atomic Update (Tốt nhất!)
@Injectable()
export class OrderService {
  async buyProductAtomic(userId: number, productId: number, quantity: number = 1) {
    return await this.prisma.$transaction(async (tx) => {
      // Bước 1: Update stock với điều kiện (atomic operation)
      const updateResult = await tx.$executeRaw`
        UPDATE "Product" 
        SET stock = stock - ${quantity}
        WHERE id = ${productId} 
        AND stock >= ${quantity}
      `

      // Bước 2: Kiểm tra có update được không
      if (updateResult === 0) {
        // Kiểm tra sản phẩm có tồn tại không
        const product = await tx.product.findUnique({
          where: { id: productId },
        })

        if (!product) {
          throw new Error('Sản phẩm không tồn tại')
        }

        throw new Error(`Không đủ hàng! Chỉ còn ${product.stock} sản phẩm`)
      }

      // Bước 3: Lấy thông tin sản phẩm sau khi update
      const updatedProduct = await tx.product.findUnique({
        where: { id: productId },
      })

      // Bước 4: Tạo order
      const order = await tx.order.create({
        data: {
          userId,
          total: updatedProduct.price * quantity,
          items: {
            create: {
              productId,
              quantity,
              price: updatedProduct.price,
              productName: updatedProduct.name,
            },
          },
        },
      })

      return {
        success: true,
        order,
        message: 'Đặt hàng thành công!',
        remainingStock: updatedProduct.stock,
      }
    })
  }
}
```

### **Tại Sao Giải Pháp Này Tốt Nhất?**

```sql
-- Query này là ATOMIC - không thể bị race condition
UPDATE "Product"
SET stock = stock - 1
WHERE id = 1
AND stock >= 1  -- ⚠️ Chỉ update nếu đủ hàng
```

**Kết quả:**

- Nếu `stock >= 1`: Update thành công, trả về `updateResult = 1`
- Nếu `stock < 1`: Không update, trả về `updateResult = 0`
- **Atomic**: Không có khoảng trống giữa check và update

---

## 6. Testing & Demo

### **Controller để Test**

```typescript
// order.controller.ts
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post('buy-locking')
  async buyWithLocking(@Body() dto: BuyProductDto) {
    return this.orderService.buyProductWithLocking(dto.userId, dto.productId, dto.quantity)
  }

  @Post('buy-version')
  async buyWithVersion(@Body() dto: BuyProductDto) {
    return this.orderService.buyProductWithVersion(dto.userId, dto.productId, dto.quantity)
  }

  @Post('buy-atomic')
  async buyAtomic(@Body() dto: BuyProductDto) {
    return this.orderService.buyProductAtomic(dto.userId, dto.productId, dto.quantity)
  }
}

interface BuyProductDto {
  userId: number
  productId: number
  quantity: number
}
```

### **Test Script (Mô Phỏng 5 Người Mua Cùng Lúc)**

```typescript
// test-race-condition.ts
async function testRaceCondition() {
  const productId = 1 // Sản phẩm chỉ còn 1 chiếc

  // Tạo 5 request cùng lúc
  const promises = []
  for (let i = 1; i <= 5; i++) {
    promises.push(
      fetch('http://localhost:3000/orders/buy-atomic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: i,
          productId: productId,
          quantity: 1,
        }),
      }).then((res) => res.json()),
    )
  }

  // Chờ tất cả request hoàn thành
  const results = await Promise.allSettled(promises)

  console.log('=== KẾT QUẢ TEST ===')
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`User ${index + 1}: ✅ ${result.value.message}`)
    } else {
      console.log(`User ${index + 1}: ❌ ${result.reason}`)
    }
  })
}

// Chạy test
testRaceCondition()
```

### **Kết Quả Mong Đợi**

```
=== KẾT QUẢ TEST ===
User 1: ✅ Đặt hàng thành công!
User 2: ❌ Không đủ hàng! Chỉ còn 0 sản phẩm
User 3: ❌ Không đủ hàng! Chỉ còn 0 sản phẩm
User 4: ❌ Không đủ hàng! Chỉ còn 0 sản phẩm
User 5: ❌ Không đủ hàng! Chỉ còn 0 sản phẩm
```

---

## 7. So Sánh Các Giải Pháp

| Giải Pháp               | Ưu Điểm                                    | Nhược Điểm                       | Khi Nào Dùng                           |
| ----------------------- | ------------------------------------------ | -------------------------------- | -------------------------------------- |
| **Pessimistic Locking** | ✅ An toàn 100%<br>✅ Dễ hiểu              | ❌ Chậm<br>❌ Có thể deadlock    | High-value items<br>Low concurrency    |
| **Optimistic Locking**  | ✅ Nhanh<br>✅ Không deadlock              | ❌ Phải retry<br>❌ Phức tạp hơn | Medium concurrency<br>Acceptable retry |
| **Atomic Update**       | ✅ Nhanh nhất<br>✅ Đơn giản<br>✅ An toàn | ❌ Ít flexible hơn               | **Khuyên dùng**<br>Most cases          |

### **Khuyến Nghị**

🥇 **Atomic Update**: Dùng cho hầu hết trường hợp  
🥈 **Optimistic Locking**: Khi cần retry logic phức tạp  
🥉 **Pessimistic Locking**: Khi cần đảm bảo tuyệt đối

---

## 8. Bonus: Real-time Notification

### **WebSocket để Thông Báo Stock Thay Đổi**

```typescript
// stock.gateway.ts
@WebSocketGateway()
export class StockGateway {
  @WebSocketServer()
  server: Server

  // Thông báo khi stock thay đổi
  notifyStockChange(productId: number, newStock: number) {
    this.server.emit('stockUpdated', {
      productId,
      stock: newStock,
      timestamp: new Date()
    })
  }
}

// Trong OrderService
async buyProductAtomic(userId: number, productId: number, quantity: number = 1) {
  const result = await this.prisma.$transaction(/* ... */)

  // Thông báo stock mới cho tất cả clients
  this.stockGateway.notifyStockChange(productId, result.remainingStock)

  return result
}
```

### **Frontend React Hook**

```typescript
// useStock.ts
function useStock(productId: number) {
  const [stock, setStock] = useState<number>(0)

  useEffect(() => {
    const socket = io('http://localhost:3000')

    socket.on('stockUpdated', (data) => {
      if (data.productId === productId) {
        setStock(data.stock)
      }
    })

    return () => socket.disconnect()
  }, [productId])

  return stock
}

// Component
function ProductPage({ productId }: { productId: number }) {
  const stock = useStock(productId)

  return (
    <div>
      <h1>iPhone 15 Pro Max</h1>
      <p>Còn lại: {stock} sản phẩm</p>
      <button disabled={stock === 0}>
        {stock > 0 ? 'Mua ngay' : 'Hết hàng'}
      </button>
    </div>
  )
}
```

---

## 9. Tổng Kết

### **Key Takeaways**

1. **Race Condition** là vấn đề nghiêm trọng trong e-commerce
2. **Atomic Update** là giải pháp tốt nhất cho hầu hết trường hợp
3. **Database Transaction** đảm bảo data consistency
4. **Testing** với concurrent requests là cần thiết
5. **Real-time notification** cải thiện UX

### **Code Hoàn Chỉnh Có Thể Copy**

```typescript
// order.service.ts - FINAL VERSION
@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private stockGateway: StockGateway,
  ) {}

  async buyProduct(userId: number, productId: number, quantity: number = 1) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Atomic update với condition
        const updateResult = await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = stock - ${quantity}
          WHERE id = ${productId} 
          AND stock >= ${quantity}
        `

        if (updateResult === 0) {
          const product = await tx.product.findUnique({
            where: { id: productId },
          })

          if (!product) {
            throw new Error('Sản phẩm không tồn tại')
          }

          throw new Error(`Không đủ hàng! Chỉ còn ${product.stock} sản phẩm`)
        }

        // Lấy product info
        const product = await tx.product.findUnique({
          where: { id: productId },
        })

        // Tạo order
        const order = await tx.order.create({
          data: {
            userId,
            total: product.price * quantity,
            items: {
              create: {
                productId,
                quantity,
                price: product.price,
                productName: product.name,
              },
            },
          },
          include: { items: true },
        })

        return { order, remainingStock: product.stock }
      })

      // Notify real-time stock change
      this.stockGateway.notifyStockChange(productId, result.remainingStock)

      return {
        success: true,
        message: 'Đặt hàng thành công!',
        order: result.order,
        remainingStock: result.remainingStock,
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      }
    }
  }
}
```

**🎉 Bây giờ bạn có thể handle 1000 người mua cùng lúc mà không lo overselling!**
