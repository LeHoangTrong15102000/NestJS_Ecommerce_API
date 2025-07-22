# 🛒 TRẢ LỜI CÂU HỎI VỀ DATABASE & EVENT LOOP - E-COMMERCE

> **Phân tích chi tiết**: Xử lý race condition, thiết kế database giỏ hàng, và event loop JavaScript

---

## 📋 MỤC LỤC

1. [Xử Lý Race Condition - 5 Người Mua 1 Sản Phẩm](#1-xử-lý-race-condition---5-người-mua-1-sản-phẩm)
2. [Thiết kế Database Giỏ Hàng E-commerce](#2-thiết-kế-database-giỏ-hàng-e-commerce)
3. [Event Loop JavaScript - Thứ Tự Thực Hiện](#3-event-loop-javascript---thứ-tự-thực-hiện)

---

## 1. XỬ LÝ RACE CONDITION - 5 NGƯỜI MUA 1 SẢN PHẨM

### 🎯 Vấn Đề

**Tình huống**: Sản phẩm chỉ còn **1 chiếc** trong kho, nhưng có **5 người cùng lúc** nhấn nút "Mua ngay".

**Vấn đề chính**:

- **Race Condition**: Nhiều transaction cùng đọc stock = 1
- **Overselling**: Có thể bán nhiều hơn số lượng có sẵn
- **Data Inconsistency**: Stock có thể thành số âm

### 🔧 Giải Pháp Dựa Trên Source Code Hiện Tại

Dựa trên schema trong `prisma/schema.prisma` và stored procedures trong `docs/ZZ_27_STORED_PROCEDURES_COMPLETE_GUIDE.md`:

#### **Phương Pháp 1: Pessimistic Locking với SELECT FOR UPDATE**

```sql
-- Stored procedure xử lý race condition an toàn
CREATE OR REPLACE FUNCTION purchase_product_safe(
    p_user_id INTEGER,
    p_sku_id INTEGER,
    p_quantity INTEGER DEFAULT 1
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    order_id INTEGER,
    remaining_stock INTEGER
) AS $$
DECLARE
    v_current_stock INTEGER;
    v_sku_price FLOAT;
    v_order_id INTEGER;
    v_product_name VARCHAR(500);
BEGIN
    -- 1. LOCK SKU record để prevent concurrent access
    SELECT stock, price
    INTO v_current_stock, v_sku_price
    FROM "SKU" s
    JOIN "Product" p ON s."productId" = p.id
    WHERE s.id = p_sku_id
      AND s."deletedAt" IS NULL
      AND p."deletedAt" IS NULL
    FOR UPDATE; -- 🔒 CRITICAL: Locks the row

    -- 2. Kiểm tra stock availability
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Sản phẩm không tồn tại', NULL::INTEGER, 0;
        RETURN;
    END IF;

    IF v_current_stock < p_quantity THEN
        RETURN QUERY SELECT
            false,
            format('Không đủ hàng! Chỉ còn %s sản phẩm', v_current_stock),
            NULL::INTEGER,
            v_current_stock;
        RETURN;
    END IF;

    -- 3. Tạo order trước khi trừ stock
    INSERT INTO "Order" ("userId", status, "createdAt", "updatedAt")
    VALUES (p_user_id, 'PENDING_CONFIRMATION', NOW(), NOW())
    RETURNING id INTO v_order_id;

    -- 4. Tạo snapshot sản phẩm
    SELECT pt.name INTO v_product_name
    FROM "Product" p
    JOIN "ProductTranslation" pt ON p.id = pt."productId"
    WHERE p.id = (SELECT "productId" FROM "SKU" WHERE id = p_sku_id)
      AND pt."languageId" = 'vi'
    LIMIT 1;

    INSERT INTO "ProductSKUSnapshot" (
        "orderId", "skuId", "productName", price,
        "skuValue", "createdAt"
    )
    SELECT
        v_order_id, s.id, COALESCE(v_product_name, 'Unknown Product'),
        s.price, s.value, NOW()
    FROM "SKU" s
    WHERE s.id = p_sku_id;

    -- 5. Trừ stock ATOMICALLY
    UPDATE "SKU"
    SET
        stock = stock - p_quantity,
        "updatedAt" = NOW(),
        "updatedById" = p_user_id
    WHERE id = p_sku_id;

    -- 6. Double check stock không âm (extra safety)
    SELECT stock INTO v_current_stock
    FROM "SKU" WHERE id = p_sku_id;

    IF v_current_stock < 0 THEN
        RAISE EXCEPTION 'Stock concurrency error detected';
    END IF;

    -- 7. Return success
    RETURN QUERY SELECT
        true,
        'Đặt hàng thành công!',
        v_order_id,
        v_current_stock;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            false,
            format('Lỗi hệ thống: %s', SQLERRM),
            NULL::INTEGER,
            0;
END;
$$ LANGUAGE plpgsql;
```

#### **Phương Pháp 2: Optimistic Locking với Version Control**

```sql
-- Thêm version column vào SKU table
ALTER TABLE "SKU" ADD COLUMN version INTEGER DEFAULT 1;

-- Function với optimistic locking
CREATE OR REPLACE FUNCTION purchase_with_optimistic_lock(
    p_user_id INTEGER,
    p_sku_id INTEGER,
    p_quantity INTEGER,
    p_expected_version INTEGER -- Client gửi version họ thấy
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    order_id INTEGER,
    current_version INTEGER
) AS $$
DECLARE
    v_current_stock INTEGER;
    v_current_version INTEGER;
    v_order_id INTEGER;
BEGIN
    -- 1. Kiểm tra version và stock cùng lúc
    SELECT stock, version
    INTO v_current_stock, v_current_version
    FROM "SKU"
    WHERE id = p_sku_id AND "deletedAt" IS NULL;

    -- 2. Version mismatch = có người khác đã thay đổi
    IF v_current_version != p_expected_version THEN
        RETURN QUERY SELECT
            false,
            'Sản phẩm đã được cập nhật bởi người khác. Vui lòng thử lại!',
            NULL::INTEGER,
            v_current_version;
        RETURN;
    END IF;

    -- 3. Kiểm tra stock
    IF v_current_stock < p_quantity THEN
        RETURN QUERY SELECT
            false,
            format('Không đủ hàng! Chỉ còn %s sản phẩm', v_current_stock),
            NULL::INTEGER,
            v_current_version;
        RETURN;
    END IF;

    -- 4. Update với version check
    UPDATE "SKU"
    SET
        stock = stock - p_quantity,
        version = version + 1,
        "updatedAt" = NOW()
    WHERE id = p_sku_id
      AND version = p_expected_version; -- Chỉ update nếu version match

    -- 5. Kiểm tra có update được không
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            false,
            'Version conflict! Vui lòng thử lại.',
            NULL::INTEGER,
            v_current_version + 1;
        RETURN;
    END IF;

    -- 6. Tạo order sau khi update thành công
    INSERT INTO "Order" ("userId", status, "createdAt")
    VALUES (p_user_id, 'PENDING_CONFIRMATION', NOW())
    RETURNING id INTO v_order_id;

    RETURN QUERY SELECT
        true,
        'Đặt hàng thành công!',
        v_order_id,
        v_current_version + 1;

END;
$$ LANGUAGE plpgsql;
```

#### **Phương Pháp 3: Queue System với Redis**

```typescript
// src/services/inventory-queue.service.ts
@Injectable()
export class InventoryQueueService {
  constructor(
    private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async purchaseProduct(userId: number, skuId: number, quantity: number = 1) {
    const queueKey = `purchase_queue:${skuId}`
    const requestId = `${userId}_${Date.now()}`

    try {
      // 1. Thêm request vào queue
      await this.redis.lpush(
        queueKey,
        JSON.stringify({
          requestId,
          userId,
          skuId,
          quantity,
          timestamp: Date.now(),
        }),
      )

      // 2. Process queue sequentially
      return await this.processQueueItem(queueKey, requestId)
    } catch (error) {
      throw new Error(`Purchase failed: ${error.message}`)
    }
  }

  private async processQueueItem(queueKey: string, requestId: string) {
    // Lock processing với Redis
    const lockKey = `${queueKey}:lock`
    const lock = await this.redis.set(lockKey, requestId, 'PX', 30000, 'NX')

    if (!lock) {
      // Đợi turn của mình
      return await this.waitForTurn(queueKey, requestId)
    }

    try {
      // Process từng item trong queue
      const item = await this.redis.rpop(queueKey)
      if (!item) return null

      const request = JSON.parse(item)

      // Gọi stored procedure để xử lý
      const result = await this.prisma.$queryRaw`
        SELECT * FROM purchase_product_safe(
          ${request.userId}, 
          ${request.skuId}, 
          ${request.quantity}
        )
      `

      return result[0]
    } finally {
      // Release lock
      await this.redis.del(lockKey)
    }
  }
}
```

### 🎯 Kết Quả Với 5 Người Cùng Mua

**Scenario**: SKU có stock = 1, 5 người cùng click "Mua"

```
Thời điểm T0: Stock = 1
├── User A click "Mua" ✅ → Stock = 0, Order created
├── User B click "Mua" ❌ → "Không đủ hàng! Chỉ còn 0 sản phẩm"
├── User C click "Mua" ❌ → "Không đủ hàng! Chỉ còn 0 sản phẩm"
├── User D click "Mua" ❌ → "Không đủ hàng! Chỉ còn 0 sản phẩm"
└── User E click "Mua" ❌ → "Không đủ hàng! Chỉ còn 0 sản phẩm"

Kết quả: Chỉ 1 người mua được, 4 người nhận thông báo hết hàng
```

### 🛡️ Các Biện Pháp Bổ Sung

#### **1. Frontend Prevention**

```typescript
// Disable button sau khi click để tránh double-click
const handlePurchase = async () => {
  setIsLoading(true)
  try {
    const result = await purchaseAPI(skuId, quantity)
    if (result.success) {
      router.push(`/orders/${result.order_id}`)
    } else {
      toast.error(result.message)
    }
  } finally {
    setIsLoading(false)
  }
}
```

#### **2. Real-time Stock Updates**

```typescript
// WebSocket để update stock real-time
@WebSocketGateway()
export class StockGateway {
  @SubscribeMessage('watchStock')
  handleWatchStock(client: Socket, skuId: number) {
    client.join(`stock_${skuId}`)
  }

  // Gửi update khi stock thay đổi
  async notifyStockChange(skuId: number, newStock: number) {
    this.server.to(`stock_${skuId}`).emit('stockUpdated', {
      skuId,
      stock: newStock,
      timestamp: Date.now(),
    })
  }
}
```

---

## 2. THIẾT KẾ DATABASE GIỎ HÀNG E-COMMERCE

### 🎯 Phân Tích Requirements

Dựa trên schema hiện tại trong `prisma/schema.prisma`, cần thiết kế lại để tối ưu:

#### **Vấn Đề Hiện Tại**

```prisma
model CartItem {
  id       Int  @id @default(autoincrement())
  quantity Int
  skuId    Int
  sku      SKU  @relation(fields: [skuId], references: [id])
  userId   Int
  user     User @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Thiếu sót**:

- Không có session support cho guest users
- Không handle expired items
- Không có price snapshot
- Thiếu unique constraint
- Không có soft delete

### 🏗️ Thiết Kế Database Mới

#### **1. Enhanced Cart Schema**

```sql
-- Bảng Cart chính (support cả user và guest)
CREATE TABLE "Cart" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- Cho guest users
    currency VARCHAR(3) DEFAULT 'VND',
    total_items INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    expires_at TIMESTAMP, -- TTL cho guest carts
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Ràng buộc: hoặc user_id hoặc session_id
    CONSTRAINT cart_owner_check CHECK (
        (user_id IS NOT NULL AND session_id IS NULL) OR
        (user_id IS NULL AND session_id IS NOT NULL)
    )
);

-- Bảng CartItem với đầy đủ thông tin
CREATE TABLE "CartItem" (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES "Cart"(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES "SKU"(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),

    -- Price snapshot để tránh thay đổi giá
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,

    -- Product snapshot cho performance
    product_name VARCHAR(500) NOT NULL,
    product_image VARCHAR(1000),
    sku_value VARCHAR(500) NOT NULL,

    -- Availability tracking
    is_available BOOLEAN DEFAULT true,
    availability_message TEXT,

    -- Timestamps
    added_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint: 1 SKU per cart
    UNIQUE(cart_id, sku_id)
);

-- Bảng lưu saved items (wishlist trong cart)
CREATE TABLE "SavedCartItem" (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES "Cart"(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES "SKU"(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,

    UNIQUE(cart_id, sku_id)
);

-- Bảng coupon áp dụng cho cart
CREATE TABLE "CartCoupon" (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES "Cart"(id) ON DELETE CASCADE,
    coupon_code VARCHAR(50) NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- PERCENTAGE, FIXED_AMOUNT
    discount_value DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(cart_id, coupon_code)
);
```

#### **2. Indexes cho Performance**

```sql
-- Indexes cho Cart table
CREATE INDEX idx_cart_user_id ON "Cart"(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_cart_session_id ON "Cart"(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_cart_expires_at ON "Cart"(expires_at) WHERE expires_at IS NOT NULL;

-- Indexes cho CartItem table
CREATE INDEX idx_cartitem_cart_id ON "CartItem"(cart_id);
CREATE INDEX idx_cartitem_sku_id ON "CartItem"(sku_id);
CREATE INDEX idx_cartitem_availability ON "CartItem"(is_available, updated_at);

-- Composite index cho queries phổ biến
CREATE INDEX idx_cartitem_cart_available ON "CartItem"(cart_id, is_available);
```

#### **3. Stored Procedures cho Cart Operations**

```sql
-- Function thêm item vào cart
CREATE OR REPLACE FUNCTION add_to_cart(
    p_user_id INTEGER DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_sku_id INTEGER,
    p_quantity INTEGER DEFAULT 1
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    cart_item_id INTEGER,
    cart_total_items INTEGER,
    cart_total_amount DECIMAL(10,2)
) AS $$
DECLARE
    v_cart_id INTEGER;
    v_sku_record RECORD;
    v_existing_quantity INTEGER := 0;
    v_new_quantity INTEGER;
    v_cart_item_id INTEGER;
    v_total_items INTEGER;
    v_total_amount DECIMAL(10,2);
BEGIN
    -- 1. Validate SKU exists và có stock
    SELECT s.id, s.stock, s.price, s.value, p.id as product_id, pt.name as product_name
    INTO v_sku_record
    FROM "SKU" s
    JOIN "Product" p ON s."productId" = p.id
    LEFT JOIN "ProductTranslation" pt ON p.id = pt."productId" AND pt."languageId" = 'vi'
    WHERE s.id = p_sku_id
      AND s."deletedAt" IS NULL
      AND p."deletedAt" IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Sản phẩm không tồn tại', NULL::INTEGER, 0, 0::DECIMAL(10,2);
        RETURN;
    END IF;

    -- 2. Tìm hoặc tạo cart
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_cart_id FROM "Cart" WHERE user_id = p_user_id;

        IF NOT FOUND THEN
            INSERT INTO "Cart" (user_id, created_at, updated_at)
            VALUES (p_user_id, NOW(), NOW())
            RETURNING id INTO v_cart_id;
        END IF;
    ELSE
        SELECT id INTO v_cart_id FROM "Cart"
        WHERE session_id = p_session_id AND (expires_at IS NULL OR expires_at > NOW());

        IF NOT FOUND THEN
            INSERT INTO "Cart" (session_id, expires_at, created_at, updated_at)
            VALUES (p_session_id, NOW() + INTERVAL '30 days', NOW(), NOW())
            RETURNING id INTO v_cart_id;
        END IF;
    END IF;

    -- 3. Kiểm tra item đã có trong cart chưa
    SELECT quantity INTO v_existing_quantity
    FROM "CartItem"
    WHERE cart_id = v_cart_id AND sku_id = p_sku_id;

    v_new_quantity := COALESCE(v_existing_quantity, 0) + p_quantity;

    -- 4. Kiểm tra stock đủ không
    IF v_new_quantity > v_sku_record.stock THEN
        RETURN QUERY SELECT
            false,
            format('Không đủ hàng! Chỉ còn %s sản phẩm', v_sku_record.stock),
            NULL::INTEGER, 0, 0::DECIMAL(10,2);
        RETURN;
    END IF;

    -- 5. Insert hoặc update cart item
    IF v_existing_quantity IS NOT NULL THEN
        -- Update existing item
        UPDATE "CartItem"
        SET
            quantity = v_new_quantity,
            total_price = v_new_quantity * v_sku_record.price,
            updated_at = NOW()
        WHERE cart_id = v_cart_id AND sku_id = p_sku_id
        RETURNING id INTO v_cart_item_id;
    ELSE
        -- Insert new item
        INSERT INTO "CartItem" (
            cart_id, sku_id, quantity, unit_price, total_price,
            product_name, sku_value, added_at, updated_at
        )
        VALUES (
            v_cart_id, p_sku_id, v_new_quantity, v_sku_record.price,
            v_new_quantity * v_sku_record.price,
            COALESCE(v_sku_record.product_name, 'Unknown Product'),
            v_sku_record.value, NOW(), NOW()
        )
        RETURNING id INTO v_cart_item_id;
    END IF;

    -- 6. Update cart totals
    SELECT
        SUM(quantity),
        SUM(total_price)
    INTO v_total_items, v_total_amount
    FROM "CartItem"
    WHERE cart_id = v_cart_id AND is_available = true;

    UPDATE "Cart"
    SET
        total_items = v_total_items,
        total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_cart_id;

    -- 7. Return success
    RETURN QUERY SELECT
        true,
        'Đã thêm vào giỏ hàng',
        v_cart_item_id,
        v_total_items,
        v_total_amount;

END;
$$ LANGUAGE plpgsql;
```

#### **4. Cart Cleanup & Maintenance**

```sql
-- Function dọn dẹp cart expired
CREATE OR REPLACE FUNCTION cleanup_expired_carts()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Xóa guest carts đã expired
    DELETE FROM "Cart"
    WHERE session_id IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Xóa cart items của SKU đã bị xóa
    DELETE FROM "CartItem"
    WHERE sku_id IN (
        SELECT id FROM "SKU" WHERE "deletedAt" IS NOT NULL
    );

    -- Update availability cho items có stock = 0
    UPDATE "CartItem"
    SET
        is_available = false,
        availability_message = 'Sản phẩm tạm hết hàng'
    WHERE sku_id IN (
        SELECT id FROM "SKU" WHERE stock <= 0 AND "deletedAt" IS NULL
    ) AND is_available = true;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job chạy mỗi giờ
SELECT cron.schedule('cleanup-expired-carts', '0 * * * *', 'SELECT cleanup_expired_carts();');
```

### 🔧 NestJS Implementation

#### **Cart Service**

```typescript
// src/services/cart.service.ts
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async addToCart(userId?: number, sessionId?: string, skuId: number, quantity: number = 1): Promise<AddToCartResult> {
    const result = await this.prisma.$queryRaw<[AddToCartResult]>`
      SELECT * FROM add_to_cart(${userId}, ${sessionId}, ${skuId}, ${quantity})
    `

    const cartResult = result[0]

    if (!cartResult.success) {
      throw new BadRequestException(cartResult.message)
    }

    return cartResult
  }

  async getCart(userId?: number, sessionId?: string): Promise<CartWithItems> {
    const whereCondition = userId ? { user_id: userId } : { session_id: sessionId }

    const cart = await this.prisma.cart.findFirst({
      where: whereCondition,
      include: {
        items: {
          where: { is_available: true },
          include: {
            sku: {
              include: {
                product: {
                  include: {
                    productTranslations: {
                      where: { languageId: 'vi' },
                    },
                  },
                },
              },
            },
          },
          orderBy: { added_at: 'desc' },
        },
        coupons: true,
      },
    })

    return cart
  }

  async updateQuantity(cartItemId: number, quantity: number, userId?: number, sessionId?: string): Promise<void> {
    // Validate ownership
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: userId ? { user_id: userId } : { session_id: sessionId },
      },
      include: { sku: true },
    })

    if (!cartItem) {
      throw new NotFoundException('Cart item not found')
    }

    if (quantity > cartItem.sku.stock) {
      throw new BadRequestException(`Only ${cartItem.sku.stock} items available`)
    }

    if (quantity <= 0) {
      await this.removeFromCart(cartItemId, userId, sessionId)
      return
    }

    await this.prisma.$transaction(async (tx) => {
      // Update cart item
      await tx.cartItem.update({
        where: { id: cartItemId },
        data: {
          quantity,
          total_price: quantity * cartItem.unit_price,
          updated_at: new Date(),
        },
      })

      // Recalculate cart totals
      await this.recalculateCartTotals(cartItem.cart_id, tx)
    })
  }

  async mergeCarts(userId: number, sessionId: string): Promise<void> {
    // Merge guest cart vào user cart khi login
    await this.prisma.$transaction(async (tx) => {
      const userCart = await tx.cart.findFirst({
        where: { user_id: userId },
      })

      const guestCart = await tx.cart.findFirst({
        where: { session_id: sessionId },
        include: { items: true },
      })

      if (!guestCart || guestCart.items.length === 0) return

      let targetCartId = userCart?.id

      if (!userCart) {
        // Convert guest cart thành user cart
        await tx.cart.update({
          where: { id: guestCart.id },
          data: {
            user_id: userId,
            session_id: null,
            expires_at: null,
          },
        })
        return
      }

      // Merge items từ guest cart vào user cart
      for (const item of guestCart.items) {
        const existingItem = await tx.cartItem.findFirst({
          where: {
            cart_id: targetCartId,
            sku_id: item.sku_id,
          },
        })

        if (existingItem) {
          // Update quantity
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + item.quantity,
              total_price: (existingItem.quantity + item.quantity) * item.unit_price,
            },
          })
        } else {
          // Move item to user cart
          await tx.cartItem.update({
            where: { id: item.id },
            data: { cart_id: targetCartId },
          })
        }
      }

      // Delete guest cart
      await tx.cart.delete({
        where: { id: guestCart.id },
      })

      // Recalculate totals
      await this.recalculateCartTotals(targetCartId, tx)
    })
  }

  private async recalculateCartTotals(cartId: number, tx: any): Promise<void> {
    const totals = await tx.cartItem.aggregate({
      where: {
        cart_id: cartId,
        is_available: true,
      },
      _sum: {
        quantity: true,
        total_price: true,
      },
    })

    await tx.cart.update({
      where: { id: cartId },
      data: {
        total_items: totals._sum.quantity || 0,
        total_amount: totals._sum.total_price || 0,
        updated_at: new Date(),
      },
    })
  }
}

interface AddToCartResult {
  success: boolean
  message: string
  cart_item_id: number
  cart_total_items: number
  cart_total_amount: number
}
```

### 📱 Frontend Integration

#### **Cart Context với Real-time Updates**

```typescript
// contexts/CartContext.tsx
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const addToCart = async (skuId: number, quantity: number = 1) => {
    setLoading(true);
    try {
      const result = await cartAPI.addToCart({
        skuId,
        quantity,
        userId: user?.id,
        sessionId: !user ? getSessionId() : undefined
      });

      setCart(result.cart);
      toast.success(result.message);

      // Track analytics
      analytics.track('Add to Cart', {
        sku_id: skuId,
        quantity,
        cart_total: result.cart.total_amount
      });

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    try {
      await cartAPI.updateQuantity(itemId, quantity);
      await refreshCart();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const refreshCart = async () => {
    try {
      const cart = await cartAPI.getCart({
        userId: user?.id,
        sessionId: !user ? getSessionId() : undefined
      });
      setCart(cart);
    } catch (error) {
      console.error('Failed to refresh cart:', error);
    }
  };

  // Auto-refresh cart khi login/logout
  useEffect(() => {
    refreshCart();
  }, [user]);

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      addToCart,
      updateQuantity,
      refreshCart
    }}>
      {children}
    </CartContext.Provider>
  );
};
```

### 🎯 Best Practices Áp Dụng

#### **1. Performance Optimization**

- **Connection Pooling**: Tối ưu connection pool cho high traffic
- **Query Optimization**: Index đầy đủ cho các query patterns
- **Caching**: Redis cache cho cart data thường xuyên truy cập
- **Batch Operations**: Bulk update cho multiple items

#### **2. Security**

- **Input Validation**: Validate quantity, SKU exists
- **Rate Limiting**: Prevent cart spam
- **Session Security**: Secure session ID generation
- **SQL Injection**: Parameterized queries

#### **3. User Experience**

- **Real-time Updates**: WebSocket cho stock changes
- **Optimistic UI**: Update UI trước, rollback nếu fail
- **Error Handling**: Clear error messages
- **Loading States**: Show loading indicators

#### **4. Business Logic**

- **Stock Validation**: Always check stock before add/update
- **Price Consistency**: Snapshot prices to handle changes
- **Expiration**: Auto-cleanup expired carts
- **Merge Logic**: Smart cart merging on login

---

## 3. EVENT LOOP JAVASCRIPT - THỨ TỰ THỰC HIỆN

### 🎯 Hiểu về Event Loop

Event Loop là cơ chế giúp JavaScript xử lý **asynchronous operations** trong môi trường **single-threaded**. Nó quyết định **thứ tự thực hiện** các tác vụ.

### 🔄 Các Thành Phần Chính

#### **1. Call Stack**

- Nơi chứa các function đang thực thi
- LIFO (Last In, First Out)
- Synchronous operations

#### **2. Web APIs / Node APIs**

- setTimeout, setInterval
- DOM events, HTTP requests
- Promise resolvers

#### **3. Task Queue (Macrotask Queue)**

- setTimeout, setInterval callbacks
- DOM events
- I/O operations

#### **4. Microtask Queue**

- Promise.then/catch/finally
- async/await
- queueMicrotask()

### 📝 Scenario 1: Thứ Tự Gốc

```javascript
console.log('1. Synchronous log')

setTimeout(() => {
  console.log('2. setTimeout 3s')
}, 3000)

// Giả sử callAPI mất 6 giây
fetch('/api/data')
  .then((response) => response.json())
  .then((data) => {
    console.log('3. API call completed (6s)')
  })

console.log('4. Another synchronous log')
```

#### **Thứ Tự Thực Hiện:**

```
Timeline:
T=0ms:    "1. Synchronous log"        (Call Stack)
T=0ms:    "4. Another synchronous log" (Call Stack)
T=3000ms: "2. setTimeout 3s"          (Task Queue → Call Stack)
T=6000ms: "3. API call completed (6s)" (Microtask Queue → Call Stack)
```

**Giải thích chi tiết:**

1. **T=0ms**:
   - `console.log("1. Synchronous log")` thực thi ngay lập tức
   - `setTimeout` đăng ký timer 3s với Web API
   - `fetch` bắt đầu HTTP request với Web API
   - `console.log("4. Another synchronous log")` thực thi ngay lập tức

2. **T=3000ms**:
   - Timer 3s hoàn thành, callback được đưa vào **Task Queue**
   - Event Loop kiểm tra Call Stack trống → chuyển callback vào Call Stack
   - `console.log("2. setTimeout 3s")` thực thi

3. **T=6000ms**:
   - HTTP request hoàn thành, Promise resolve
   - `.then()` callback được đưa vào **Microtask Queue**
   - Event Loop ưu tiên Microtask Queue → thực thi callback
   - `console.log("3. API call completed (6s)")` thực thi

### 📝 Scenario 2: Đảo Ngược Thứ Tự

```javascript
console.log('1. Synchronous log')

// Đảo ngược: callAPI lên trên
fetch('/api/data')
  .then((response) => response.json())
  .then((data) => {
    console.log('2. API call completed (6s)')
  })

setTimeout(() => {
  console.log('3. setTimeout 3s')
}, 3000)

console.log('4. Another synchronous log')
```

#### **Thứ Tự Thực Hiện:**

```
Timeline:
T=0ms:    "1. Synchronous log"        (Call Stack)
T=0ms:    "4. Another synchronous log" (Call Stack)
T=3000ms: "3. setTimeout 3s"          (Task Queue → Call Stack)
T=6000ms: "2. API call completed (6s)" (Microtask Queue → Call Stack)
```

### 🔍 Kết Quả So Sánh

| Aspect            | Scenario 1                                                     | Scenario 2         |
| ----------------- | -------------------------------------------------------------- | ------------------ |
| **Thứ tự code**   | setTimeout → fetch                                             | fetch → setTimeout |
| **Thứ tự output** | Giống nhau!                                                    | Giống nhau!        |
| **Lý do**         | Thời gian hoàn thành quyết định thứ tự, không phải vị trí code |                    |

### 🎯 Tại Sao Kết Quả Giống Nhau?

#### **Nguyên tắc Event Loop:**

1. **Synchronous Code First**: Tất cả code đồng bộ chạy trước
2. **Async Operations**: Đăng ký với Web APIs song song
3. **Completion Time**: Thời gian hoàn thành quyết định thứ tự callback
4. **Queue Priority**: Microtasks > Macrotasks

#### **Chi Tiết Luồng Xử Lý:**

```javascript
// Bất kể thứ tự nào, luồng đều như sau:

// Phase 1: Synchronous Execution (0ms)
console.log('1. Synchronous log') // ✅ Executed
// setTimeout registered with Web API     // ⏳ Timer starts (3000ms)
// fetch registered with Web API         // ⏳ HTTP request starts (6000ms)
console.log('4. Another synchronous log') // ✅ Executed

// Phase 2: Event Loop Monitoring
// T=3000ms: Timer completes → Task Queue → Call Stack
console.log('setTimeout message') // ✅ Executed

// T=6000ms: HTTP completes → Microtask Queue → Call Stack
console.log('API call message') // ✅ Executed
```

### 🧪 Ví Dụ Phức Tạp Hơn

```javascript
console.log('Start')

setTimeout(() => console.log('Timer 1'), 0)

Promise.resolve().then(() => console.log('Promise 1'))

setTimeout(() => console.log('Timer 2'), 0)

Promise.resolve().then(() => console.log('Promise 2'))

console.log('End')
```

#### **Output:**

```
Start
End
Promise 1
Promise 2
Timer 1
Timer 2
```

#### **Giải thích:**

1. **Synchronous**: "Start" → "End"
2. **Microtasks**: Promise 1 → Promise 2 (ưu tiên cao)
3. **Macrotasks**: Timer 1 → Timer 2 (ưu tiên thấp)

### 🎯 Practical Example với React Component

```typescript
// Component minh họa Event Loop
const EventLoopDemo: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${Date.now()}: ${message}`]);
  };

  const runDemo = () => {
    setLogs([]);

    addLog("1. Synchronous start");

    setTimeout(() => {
      addLog("2. setTimeout 1000ms");
    }, 1000);

    fetch('/api/test')
      .then(() => addLog("3. API call completed"))
      .catch(() => addLog("3. API call failed"));

    Promise.resolve().then(() => {
      addLog("4. Promise microtask");
    });

    addLog("5. Synchronous end");
  };

  return (
    <div>
      <button onClick={runDemo}>Run Event Loop Demo</button>
      <div>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};
```

### 🔧 Best Practices

#### **1. Understanding Timing**

```javascript
// ❌ Sai lầm: Nghĩ setTimeout(0) chạy ngay lập tức
setTimeout(() => console.log('This runs later'), 0)
console.log('This runs first')

// ✅ Đúng: Hiểu rằng setTimeout luôn async
```

#### **2. Promise vs setTimeout**

```javascript
// Microtasks (Promises) luôn ưu tiên hơn Macrotasks (setTimeout)
setTimeout(() => console.log('Macrotask'), 0)
Promise.resolve().then(() => console.log('Microtask'))
// Output: Microtask → Macrotask
```

#### **3. Async/Await Behavior**

```javascript
async function demo() {
  console.log('1')

  await Promise.resolve()
  console.log('2') // Microtask

  setTimeout(() => console.log('3'), 0) // Macrotask

  console.log('4')
}

demo()
console.log('5')

// Output: 1 → 5 → 2 → 4 → 3
```

### 🎯 Kết Luận Event Loop

#### **Key Takeaways:**

1. **Thứ tự code ≠ Thứ tự thực thi**: Async operations phụ thuộc vào completion time
2. **Microtasks > Macrotasks**: Promise.then luôn chạy trước setTimeout
3. **Event Loop không đa luồng**: Chỉ có 1 Call Stack duy nhất
4. **Timing matters**: 3s timer sẽ chạy trước 6s API call
5. **Non-blocking**: JavaScript không bị block bởi async operations

#### **Practical Applications:**

- **API Calls**: Hiểu tại sao UI không bị freeze
- **User Interactions**: Event handling và async operations
- **Performance**: Tối ưu thứ tự thực hiện tasks
- **Debugging**: Trace execution flow trong complex apps

---

## 🎉 TÓM TẮT

### 📊 Câu Trả Lời Ngắn Gọn

| Câu Hỏi               | Giải Pháp Chính                               | Kết Quả                                                 |
| --------------------- | --------------------------------------------- | ------------------------------------------------------- |
| **Race Condition**    | Pessimistic Locking + Stored Procedures       | Chỉ 1/5 người mua được, 4 người nhận thông báo hết hàng |
| **Database Giỏ Hàng** | Enhanced schema với Cart + CartItem + indexes | Support guest users, price snapshot, performance tối ưu |
| **Event Loop**        | Microtasks ưu tiên > Macrotasks               | Thứ tự code không ảnh hưởng, completion time quyết định |

### 🎯 Key Learning Points

1. **Database Concurrency**: Luôn sử dụng locking mechanisms cho critical operations
2. **Schema Design**: Thiết kế database phải cover tất cả use cases thực tế
3. **JavaScript Async**: Event Loop hoạt động theo priority queue, không theo thứ tự code

### 🚀 Next Steps

- **Implement**: Áp dụng stored procedures cho inventory management
- **Test**: Load testing với concurrent users
- **Monitor**: Setup alerts cho stock issues
- **Optimize**: Performance tuning cho cart operations

---

_Tài liệu này được tạo dựa trên phân tích chi tiết source code NestJS Ecommerce API và best practices trong ngành._
