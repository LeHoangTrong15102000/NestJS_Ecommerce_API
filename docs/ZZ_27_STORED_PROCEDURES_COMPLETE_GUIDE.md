# 🔧 STORED PROCEDURES - Hướng Dẫn Toàn Diện

> **Dự án tham khảo**: NestJS Ecommerce API - Áp dụng Stored Procedures cho Business Logic & Performance

---

## 📋 MỤC LỤC

1. [Tổng Quan về Stored Procedures](#1-tổng-quan-về-stored-procedures)
2. [Tại Sao Cần Stored Procedures trong E-commerce](#2-tại-sao-cần-stored-procedures-trong-e-commerce)
3. [PostgreSQL Functions & Procedures](#3-postgresql-functions--procedures)
4. [Phân Tích Business Logic Hiện Tại](#4-phân-tích-business-logic-hiện-tại)
5. [Implement Stored Procedures cho Dự Án](#5-implement-stored-procedures-cho-dự-án)
6. [Advanced Stored Procedures Patterns](#6-advanced-stored-procedures-patterns)
7. [Integration với NestJS](#7-integration-với-nestjs)
8. [Performance & Security](#8-performance--security)
9. [Testing & Debugging](#9-testing--debugging)
10. [Best Practices & Maintenance](#10-best-practices--maintenance)

---

## 1. TỔNG QUAN VỀ STORED PROCEDURES

### 🎯 Định Nghĩa

**Stored Procedures** là các **chương trình con** được lưu trữ và thực thi **trực tiếp trên database server**, thay vì trong application code. Chúng có thể chứa **business logic**, **data validation**, và **complex operations**.

### 🔑 Khái Niệm Cơ Bản

#### Functions vs Procedures

```sql
-- FUNCTION: Returns a value, có thể dùng trong SELECT
CREATE OR REPLACE FUNCTION calculate_order_total(order_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN (SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1);
END;
$$ LANGUAGE plpgsql;

-- PROCEDURE: Không return value, dùng cho operations
CREATE OR REPLACE PROCEDURE process_order_payment(
    order_id INTEGER,
    payment_method VARCHAR(50)
) AS $$
BEGIN
    -- Complex business logic here
    UPDATE orders SET status = 'PAID' WHERE id = order_id;
    INSERT INTO payment_logs (order_id, method, processed_at)
    VALUES (order_id, payment_method, NOW());
END;
$$ LANGUAGE plpgsql;
```

#### PL/pgSQL Language Features

- **Variables & Constants**: Declare và sử dụng variables
- **Control Structures**: IF/ELSE, LOOP, FOR, WHILE
- **Exception Handling**: BEGIN/EXCEPTION/END blocks
- **Dynamic SQL**: EXECUTE statements
- **Cursors**: Iterate qua result sets

### 🚀 Lợi Ích

✅ **Performance**: Giảm network roundtrips, pre-compiled execution plans  
✅ **Security**: Parameterized queries, access control  
✅ **Data Integrity**: Complex validations, atomic operations  
✅ **Code Reusability**: Centralized business logic  
✅ **Maintenance**: Single point of change cho business rules  
✅ **Complex Operations**: Multi-step processes với error handling

### ⚠️ Nhược Điểm

❌ **Database Lock-in**: Tied to specific database platform  
❌ **Version Control**: Khó manage changes trong Git  
❌ **Testing**: Khó unit test compared to application code  
❌ **Debugging**: Limited debugging tools  
❌ **Scalability**: Database server becomes bottleneck  
❌ **Team Skills**: Requires SQL/PL-pgSQL expertise

---

## 2. TẠI SAO CẦN STORED PROCEDURES TRONG E-COMMERCE

### 📊 Business Logic Analysis

Dựa trên schema của dự án, các **complex business operations** cần stored procedures:

#### High-Complexity Operations

```typescript
// Current application logic (có thể optimize với stored procedures)

// 1. Order Processing (Multiple tables, complex validation)
async createOrder(userId: number, cartItems: CartItem[]): Promise<Order> {
  // 15+ database queries, complex validation logic
  // Race conditions possible, performance issues
}

// 2. Inventory Management (Race conditions critical)
async updateProductStock(productId: number, quantity: number): Promise<void> {
  // Concurrency issues, data consistency problems
}

// 3. Payment Processing (Multi-step, requires atomicity)
async processPayment(orderId: number, paymentData: PaymentData): Promise<PaymentResult> {
  // Complex state management, error handling
}

// 4. User Permission Checking (Frequent, performance critical)
async checkUserPermissions(userId: number, resource: string): Promise<boolean> {
  // Multiple JOINs, called frequently
}
```

### 🎯 Use Cases cho Stored Procedures

#### 1. **Atomic Business Operations**

- Order creation với inventory updates
- Payment processing với order status changes
- User registration với role assignments

#### 2. **Performance-Critical Operations**

- Permission checking (called frequently)
- Product search với complex filters
- Reporting và analytics queries

#### 3. **Data Integrity Operations**

- Soft delete với cascade updates
- Audit trail maintenance
- Data validation với complex business rules

#### 4. **Batch Processing**

- Cleanup expired tokens/codes
- Generate periodic reports
- Data archival operations

---

## 3. POSTGRESQL FUNCTIONS & PROCEDURES

### 📚 PL/pgSQL Basics

#### Function Structure

```sql
CREATE OR REPLACE FUNCTION function_name(
    parameter1 data_type,
    parameter2 data_type DEFAULT default_value
)
RETURNS return_type AS $$
DECLARE
    -- Variable declarations
    variable_name data_type;
    constant_name CONSTANT data_type := value;
BEGIN
    -- Function body
    -- Business logic here

    RETURN result;
EXCEPTION
    WHEN exception_condition THEN
        -- Error handling
        RAISE EXCEPTION 'Error message: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

#### Advanced Features

**1. Return Types**

```sql
-- Scalar return
RETURNS INTEGER

-- Table return
RETURNS TABLE(id INTEGER, name VARCHAR(500))

-- Record return
RETURNS RECORD

-- Custom type return
CREATE TYPE order_summary AS (
    order_id INTEGER,
    total_amount DECIMAL(10,2),
    item_count INTEGER
);
RETURNS order_summary
```

**2. Control Structures**

```sql
-- Conditional logic
IF condition THEN
    -- statements
ELSIF another_condition THEN
    -- statements
ELSE
    -- statements
END IF;

-- Loops
FOR i IN 1..10 LOOP
    -- statements
END LOOP;

-- While loop
WHILE condition LOOP
    -- statements
END LOOP;

-- For each loop
FOR record_var IN SELECT * FROM table_name LOOP
    -- statements using record_var.column_name
END LOOP;
```

**3. Exception Handling**

```sql
BEGIN
    -- Risky operations
    INSERT INTO orders (user_id, total) VALUES (user_id, total);
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate order detected';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Invalid user_id: %', user_id;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
END;
```

---

## 4. PHÂN TÍCH BUSINESS LOGIC HIỆN TẠI

### 🔍 Code Analysis

Dựa trên schema và patterns trong dự án, identify các operations cần stored procedures:

#### 1. **Order Management** (High Priority)

**Current Application Logic:**

```typescript
// src/routes/order/order.service.ts (hypothetical)
async createOrder(userId: number, items: OrderItem[]): Promise<Order> {
  const transaction = await this.prisma.$transaction(async (tx) => {
    // 1. Validate user exists và active
    const user = await tx.user.findUnique({
      where: { id: userId, deletedAt: null }
    });

    // 2. Validate all SKUs exist và có stock
    for (const item of items) {
      const sku = await tx.sKU.findUnique({
        where: { id: item.skuId, deletedAt: null }
      });
      if (!sku || sku.stock < item.quantity) {
        throw new Error(`Insufficient stock for SKU ${item.skuId}`);
      }
    }

    // 3. Create order
    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING_CONFIRMATION',
        createdById: userId,
      }
    });

    // 4. Create snapshots và update stock
    for (const item of items) {
      const sku = await tx.sKU.findUnique({
        where: { id: item.skuId },
        include: { product: true }
      });

      // Create snapshot
      await tx.productSKUSnapshot.create({
        data: {
          orderId: order.id,
          skuId: sku.id,
          productName: sku.product.name, // Need translation logic
          price: sku.price,
          images: sku.images,
          skuValue: sku.value,
        }
      });

      // Update stock
      await tx.sKU.update({
        where: { id: sku.id },
        data: { stock: sku.stock - item.quantity }
      });
    }

    return order;
  });
}
```

**Issues với current approach:**

- Multiple database roundtrips (N+1 problem)
- Complex transaction logic in application
- Race conditions possible
- Difficult error handling
- Performance issues với large orders

#### 2. **Permission Checking** (High Frequency)

**Current Logic:**

```typescript
// src/shared/guards/authentication.guard.ts (simplified)
async checkUserPermissions(userId: number, path: string, method: string): Promise<boolean> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      role: {
        include: {
          permissions: {
            where: { deletedAt: null }
          }
        }
      }
    }
  });

  return user?.role.permissions.some(p =>
    p.path === path && p.method === method
  ) || false;
}
```

**Issues:**

- Called on every protected route
- Multiple JOINs every time
- No caching at database level
- Performance bottleneck

#### 3. **Inventory Management** (Race Conditions)

**Current Logic:**

```typescript
async updateProductStock(skuId: number, quantityChange: number): Promise<void> {
  const sku = await this.prisma.sKU.findUnique({
    where: { id: skuId }
  });

  const newStock = sku.stock + quantityChange;
  if (newStock < 0) {
    throw new Error('Insufficient stock');
  }

  await this.prisma.sKU.update({
    where: { id: skuId },
    data: { stock: newStock }
  });
}
```

**Issues:**

- Race condition between read và update
- No atomic operation
- Oversell possible trong high concurrency

---

## 5. IMPLEMENT STORED PROCEDURES CHO DỰ ÁN

### 🚀 Phase 1: Order Processing

#### Complex Order Creation Procedure

```sql
-- Custom types for better organization
CREATE TYPE order_item_type AS (
    sku_id INTEGER,
    quantity INTEGER
);

CREATE TYPE order_result_type AS (
    order_id INTEGER,
    total_amount DECIMAL(10,2),
    status VARCHAR(50),
    created_at TIMESTAMP,
    error_message TEXT
);

-- Main order creation procedure
CREATE OR REPLACE FUNCTION create_order_with_items(
    p_user_id INTEGER,
    p_order_items order_item_type[],
    p_created_by_id INTEGER DEFAULT NULL
)
RETURNS order_result_type AS $$
DECLARE
    v_order_id INTEGER;
    v_total_amount DECIMAL(10,2) := 0;
    v_item order_item_type;
    v_sku RECORD;
    v_product RECORD;
    v_product_translation RECORD;
    v_result order_result_type;
    v_default_language VARCHAR(10) := 'vi';
BEGIN
    -- 1. Validate user exists và active
    IF NOT EXISTS (
        SELECT 1 FROM "User"
        WHERE id = p_user_id
          AND status = 'ACTIVE'
          AND "deletedAt" IS NULL
    ) THEN
        v_result.error_message := 'User not found or inactive';
        RETURN v_result;
    END IF;

    -- 2. Validate all items trước khi create order
    FOREACH v_item IN ARRAY p_order_items
    LOOP
        SELECT s.*, p.id as product_id, p."brandId", p.base_price
        INTO v_sku
        FROM "SKU" s
        JOIN "Product" p ON s."productId" = p.id
        WHERE s.id = v_item.sku_id
          AND s."deletedAt" IS NULL
          AND p."deletedAt" IS NULL;

        IF NOT FOUND THEN
            v_result.error_message := format('SKU %s not found', v_item.sku_id);
            RETURN v_result;
        END IF;

        IF v_sku.stock < v_item.quantity THEN
            v_result.error_message := format('Insufficient stock for SKU %s. Available: %s, Requested: %s',
                v_item.sku_id, v_sku.stock, v_item.quantity);
            RETURN v_result;
        END IF;

        v_total_amount := v_total_amount + (v_sku.price * v_item.quantity);
    END LOOP;

    -- 3. Create order (all validations passed)
    INSERT INTO "Order" (
        "userId",
        status,
        "createdById",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        p_user_id,
        'PENDING_CONFIRMATION',
        COALESCE(p_created_by_id, p_user_id),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- 4. Process each item atomically
    FOREACH v_item IN ARRAY p_order_items
    LOOP
        -- Get SKU với product info
        SELECT s.*, p.id as product_id, p."brandId"
        INTO v_sku
        FROM "SKU" s
        JOIN "Product" p ON s."productId" = p.id
        WHERE s.id = v_item.sku_id;

        -- Get product translation (fallback to default language)
        SELECT pt.name, pt.description
        INTO v_product_translation
        FROM "ProductTranslation" pt
        WHERE pt."productId" = v_sku.product_id
          AND pt."languageId" = v_default_language
          AND pt."deletedAt" IS NULL
        LIMIT 1;

        -- Fallback nếu không có translation
        IF NOT FOUND THEN
            v_product_translation.name := 'Product ' || v_sku.product_id;
            v_product_translation.description := '';
        END IF;

        -- Create product snapshot
        INSERT INTO "ProductSKUSnapshot" (
            "orderId",
            "skuId",
            "productName",
            price,
            images,
            "skuValue",
            "createdAt"
        )
        VALUES (
            v_order_id,
            v_sku.id,
            v_product_translation.name,
            v_sku.price,
            v_sku.images,
            v_sku.value,
            NOW()
        );

        -- Update stock atomically
        UPDATE "SKU"
        SET
            stock = stock - v_item.quantity,
            "updatedAt" = NOW(),
            "updatedById" = COALESCE(p_created_by_id, p_user_id)
        WHERE id = v_sku.id;

        -- Double-check stock didn't go negative (race condition protection)
        IF (SELECT stock FROM "SKU" WHERE id = v_sku.id) < 0 THEN
            RAISE EXCEPTION 'Concurrent stock update detected for SKU %', v_sku.id;
        END IF;
    END LOOP;

    -- 5. Prepare successful result
    v_result.order_id := v_order_id;
    v_result.total_amount := v_total_amount;
    v_result.status := 'PENDING_CONFIRMATION';
    v_result.created_at := NOW();
    v_result.error_message := NULL;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error (nếu có logging table)
        INSERT INTO error_logs (
            function_name,
            error_message,
            error_detail,
            occurred_at
        )
        VALUES (
            'create_order_with_items',
            SQLERRM,
            SQLSTATE,
            NOW()
        );

        v_result.error_message := 'Order creation failed: ' || SQLERRM;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

#### Usage in NestJS

```typescript
// src/routes/order/order.repo.ts
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderWithItems(
    userId: number,
    items: { skuId: number; quantity: number }[],
    createdById?: number,
  ): Promise<OrderCreationResult> {
    // Convert items to PostgreSQL array format
    const pgItems = items.map((item) => `(${item.skuId},${item.quantity})`).join(',')

    const result = await this.prisma.$queryRaw<[OrderCreationResult]>`
      SELECT * FROM create_order_with_items(
        ${userId},
        ARRAY[${Prisma.raw(pgItems)}]::order_item_type[],
        ${createdById || null}
      )
    `

    const orderResult = result[0]

    if (orderResult.error_message) {
      throw new BadRequestException(orderResult.error_message)
    }

    return orderResult
  }
}

interface OrderCreationResult {
  order_id: number
  total_amount: number
  status: string
  created_at: Date
  error_message?: string
}
```

### 🚀 Phase 2: Permission Checking

#### High-Performance Permission Function

```sql
-- Optimized permission checking với caching hints
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id INTEGER,
    p_path VARCHAR(1000),
    p_method VARCHAR(10)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- Single query với optimized JOINs
    SELECT EXISTS (
        SELECT 1
        FROM "User" u
        JOIN "Role" r ON u."roleId" = r.id
        JOIN "_PermissionToRole" pr ON r.id = pr."B"
        JOIN "Permission" p ON pr."A" = p.id
        WHERE u.id = p_user_id
          AND u."deletedAt" IS NULL
          AND u.status = 'ACTIVE'
          AND r."deletedAt" IS NULL
          AND r."isActive" = true
          AND p."deletedAt" IS NULL
          AND p.path = p_path
          AND p.method = p_method
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql
STABLE -- Hint for query planner: function result won't change within transaction
PARALLEL SAFE; -- Can be parallelized

-- Create index for optimal performance
CREATE INDEX CONCURRENTLY "idx_permission_path_method_active"
ON "Permission" (path, method, "deletedAt")
WHERE "deletedAt" IS NULL;

-- Composite index for user permission checks
CREATE INDEX CONCURRENTLY "idx_user_role_permission_check"
ON "User" ("roleId", status, "deletedAt")
WHERE "deletedAt" IS NULL AND status = 'ACTIVE';
```

#### Advanced Permission Function với Role Hierarchy

```sql
-- Support role inheritance (nếu có parent roles)
CREATE OR REPLACE FUNCTION check_user_permission_with_hierarchy(
    p_user_id INTEGER,
    p_path VARCHAR(1000),
    p_method VARCHAR(10)
)
RETURNS TABLE(
    has_permission BOOLEAN,
    granted_by_role VARCHAR(500),
    permission_name VARCHAR(500)
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE role_hierarchy AS (
        -- Base case: user's direct role
        SELECT r.id, r.name, r."parentRoleId", 1 as level
        FROM "User" u
        JOIN "Role" r ON u."roleId" = r.id
        WHERE u.id = p_user_id
          AND u."deletedAt" IS NULL
          AND r."deletedAt" IS NULL

        UNION ALL

        -- Recursive case: parent roles (nếu implement role hierarchy)
        SELECT r.id, r.name, r."parentRoleId", rh.level + 1
        FROM "Role" r
        JOIN role_hierarchy rh ON r.id = rh."parentRoleId"
        WHERE rh.level < 10 -- Prevent infinite recursion
          AND r."deletedAt" IS NULL
    )
    SELECT
        true as has_permission,
        rh.name as granted_by_role,
        p.name as permission_name
    FROM role_hierarchy rh
    JOIN "_PermissionToRole" pr ON rh.id = pr."B"
    JOIN "Permission" p ON pr."A" = p.id
    WHERE p.path = p_path
      AND p.method = p_method
      AND p."deletedAt" IS NULL
    ORDER BY rh.level
    LIMIT 1;

    -- If no permission found, return false
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, ''::VARCHAR(500), ''::VARCHAR(500);
    END IF;
END;
$$ LANGUAGE plpgsql
STABLE
PARALLEL SAFE;
```

### 🚀 Phase 3: Inventory Management

#### Race-Condition Safe Stock Updates

```sql
-- Atomic stock update với detailed logging
CREATE OR REPLACE FUNCTION update_sku_stock(
    p_sku_id INTEGER,
    p_quantity_change INTEGER,
    p_operation_type VARCHAR(50) DEFAULT 'MANUAL_ADJUSTMENT',
    p_reference_id INTEGER DEFAULT NULL,
    p_updated_by INTEGER DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    old_stock INTEGER,
    new_stock INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_sku_exists BOOLEAN;
BEGIN
    -- 1. Check if SKU exists và active
    SELECT stock, true
    INTO v_current_stock, v_sku_exists
    FROM "SKU"
    WHERE id = p_sku_id
      AND "deletedAt" IS NULL
    FOR UPDATE; -- Lock row để prevent race conditions

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, format('SKU %s not found or deleted', p_sku_id);
        RETURN;
    END IF;

    -- 2. Calculate new stock
    v_new_stock := v_current_stock + p_quantity_change;

    -- 3. Validate new stock không negative (except for certain operations)
    IF v_new_stock < 0 AND p_operation_type NOT IN ('DAMAGE_WRITEOFF', 'THEFT_ADJUSTMENT') THEN
        RETURN QUERY SELECT false, v_current_stock, v_current_stock,
            format('Insufficient stock. Current: %s, Requested change: %s', v_current_stock, p_quantity_change);
        RETURN;
    END IF;

    -- 4. Update stock atomically
    UPDATE "SKU"
    SET
        stock = v_new_stock,
        "updatedAt" = NOW(),
        "updatedById" = p_updated_by
    WHERE id = p_sku_id;

    -- 5. Log inventory change
    INSERT INTO inventory_changes (
        sku_id,
        operation_type,
        quantity_change,
        old_stock,
        new_stock,
        reference_id,
        created_by,
        created_at
    )
    VALUES (
        p_sku_id,
        p_operation_type,
        p_quantity_change,
        v_current_stock,
        v_new_stock,
        p_reference_id,
        p_updated_by,
        NOW()
    );

    -- 6. Return success result
    RETURN QUERY SELECT true, v_current_stock, v_new_stock, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, 0, 0, format('Stock update failed: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Create inventory_changes table for audit trail
CREATE TABLE IF NOT EXISTS inventory_changes (
    id SERIAL PRIMARY KEY,
    sku_id INTEGER NOT NULL REFERENCES "SKU"(id),
    operation_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    old_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id INTEGER, -- Order ID, Adjustment ID, etc.
    created_by INTEGER REFERENCES "User"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_inventory_changes_sku_date ON inventory_changes(sku_id, created_at);
CREATE INDEX idx_inventory_changes_operation ON inventory_changes(operation_type, created_at);
```

#### Bulk Stock Operations

```sql
-- Bulk stock updates cho performance
CREATE TYPE stock_update_item AS (
    sku_id INTEGER,
    quantity_change INTEGER,
    operation_type VARCHAR(50)
);

CREATE TYPE stock_update_result AS (
    sku_id INTEGER,
    success BOOLEAN,
    old_stock INTEGER,
    new_stock INTEGER,
    error_message TEXT
);

CREATE OR REPLACE FUNCTION bulk_update_stock(
    p_updates stock_update_item[],
    p_updated_by INTEGER DEFAULT NULL,
    p_reference_id INTEGER DEFAULT NULL
)
RETURNS SETOF stock_update_result AS $$
DECLARE
    v_update stock_update_item;
    v_result stock_update_result;
BEGIN
    -- Process each update individually với proper error handling
    FOREACH v_update IN ARRAY p_updates
    LOOP
        SELECT * INTO v_result
        FROM update_sku_stock(
            v_update.sku_id,
            v_update.quantity_change,
            v_update.operation_type,
            p_reference_id,
            p_updated_by
        );

        v_result.sku_id := v_update.sku_id;
        RETURN NEXT v_result;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. ADVANCED STORED PROCEDURES PATTERNS

### 🔄 Complex Business Workflows

#### Order Status Transition Workflow

```sql
-- Define valid status transitions
CREATE TYPE order_status_transition AS (
    from_status "OrderStatus",
    to_status "OrderStatus",
    required_role VARCHAR(50),
    auto_actions TEXT[]
);

-- Order status transition với business rules
CREATE OR REPLACE FUNCTION transition_order_status(
    p_order_id INTEGER,
    p_new_status "OrderStatus",
    p_user_id INTEGER,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    old_status "OrderStatus",
    new_status "OrderStatus",
    auto_actions_performed TEXT[],
    error_message TEXT
) AS $$
DECLARE
    v_current_status "OrderStatus";
    v_user_role VARCHAR(500);
    v_is_valid_transition BOOLEAN := FALSE;
    v_auto_actions TEXT[] := '{}';
    v_order_user_id INTEGER;
BEGIN
    -- 1. Get current order status và validate ownership
    SELECT status, "userId"
    INTO v_current_status, v_order_user_id
    FROM "Order"
    WHERE id = p_order_id
      AND "deletedAt" IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::"OrderStatus", NULL::"OrderStatus",
            '{}'::TEXT[], 'Order not found';
        RETURN;
    END IF;

    -- 2. Get user role
    SELECT r.name INTO v_user_role
    FROM "User" u
    JOIN "Role" r ON u."roleId" = r.id
    WHERE u.id = p_user_id AND u."deletedAt" IS NULL;

    -- 3. Validate transition rules
    v_is_valid_transition := CASE
        -- Customer can only cancel pending orders
        WHEN v_user_role = 'CUSTOMER' AND v_order_user_id = p_user_id THEN
            (v_current_status = 'PENDING_CONFIRMATION' AND p_new_status = 'CANCELLED')

        -- Admin can do any transition
        WHEN v_user_role = 'ADMIN' THEN true

        -- Staff transitions
        WHEN v_user_role = 'STAFF' THEN
            (v_current_status = 'PENDING_CONFIRMATION' AND p_new_status = 'PENDING_PICKUP') OR
            (v_current_status = 'PENDING_PICKUP' AND p_new_status = 'PENDING_DELIVERY') OR
            (v_current_status = 'PENDING_DELIVERY' AND p_new_status = 'DELIVERED') OR
            (p_new_status = 'CANCELLED')

        ELSE false
    END;

    IF NOT v_is_valid_transition THEN
        RETURN QUERY SELECT false, v_current_status, v_current_status,
            '{}'::TEXT[], format('Invalid status transition from %s to %s for role %s',
                v_current_status, p_new_status, v_user_role);
        RETURN;
    END IF;

    -- 4. Perform status update
    UPDATE "Order"
    SET
        status = p_new_status,
        "updatedAt" = NOW(),
        "updatedById" = p_user_id
    WHERE id = p_order_id;

    -- 5. Log status change
    INSERT INTO order_status_history (
        order_id,
        from_status,
        to_status,
        changed_by,
        changed_at,
        notes
    )
    VALUES (
        p_order_id,
        v_current_status,
        p_new_status,
        p_user_id,
        NOW(),
        p_notes
    );

    -- 6. Perform automatic actions based on new status
    CASE p_new_status
        WHEN 'CANCELLED' THEN
            -- Restore inventory
            PERFORM restore_order_inventory(p_order_id);
            v_auto_actions := array_append(v_auto_actions, 'inventory_restored');

        WHEN 'DELIVERED' THEN
            -- Trigger review reminder
            PERFORM schedule_review_reminder(p_order_id);
            v_auto_actions := array_append(v_auto_actions, 'review_reminder_scheduled');

        WHEN 'RETURNED' THEN
            -- Process refund
            PERFORM process_order_refund(p_order_id);
            v_auto_actions := array_append(v_auto_actions, 'refund_initiated');

        ELSE
            -- No automatic actions
    END CASE;

    -- 7. Return success result
    RETURN QUERY SELECT true, v_current_status, p_new_status, v_auto_actions, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, v_current_status, v_current_status,
            '{}'::TEXT[], format('Status transition failed: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Supporting tables
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES "Order"(id),
    from_status "OrderStatus" NOT NULL,
    to_status "OrderStatus" NOT NULL,
    changed_by INTEGER REFERENCES "User"(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
```

### 📊 Reporting & Analytics Functions

#### Advanced Sales Analytics

```sql
-- Comprehensive sales analytics function
CREATE OR REPLACE FUNCTION get_sales_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_group_by VARCHAR(20) DEFAULT 'day', -- day, week, month
    p_user_id INTEGER DEFAULT NULL -- NULL for all users
)
RETURNS TABLE(
    period_start DATE,
    period_end DATE,
    total_orders INTEGER,
    total_revenue DECIMAL(10,2),
    avg_order_value DECIMAL(10,2),
    unique_customers INTEGER,
    top_product_id INTEGER,
    top_product_name VARCHAR(500),
    top_product_sales INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH period_sales AS (
        SELECT
            CASE
                WHEN p_group_by = 'day' THEN DATE_TRUNC('day', o."createdAt")::DATE
                WHEN p_group_by = 'week' THEN DATE_TRUNC('week', o."createdAt")::DATE
                WHEN p_group_by = 'month' THEN DATE_TRUNC('month', o."createdAt")::DATE
                ELSE DATE_TRUNC('day', o."createdAt")::DATE
            END as period_date,
            o.id as order_id,
            o."userId",
            COALESCE(SUM(pss.price), 0) as order_total
        FROM "Order" o
        LEFT JOIN "ProductSKUSnapshot" pss ON o.id = pss."orderId"
        WHERE o."createdAt" >= p_start_date
          AND o."createdAt" <= p_end_date + INTERVAL '1 day'
          AND o."deletedAt" IS NULL
          AND o.status IN ('DELIVERED', 'PENDING_DELIVERY')
          AND (p_user_id IS NULL OR o."userId" = p_user_id)
        GROUP BY o.id, period_date, o."userId"
    ),
    period_aggregates AS (
        SELECT
            period_date,
            COUNT(DISTINCT order_id) as total_orders,
            SUM(order_total) as total_revenue,
            AVG(order_total) as avg_order_value,
            COUNT(DISTINCT "userId") as unique_customers
        FROM period_sales
        GROUP BY period_date
    ),
    top_products AS (
        SELECT DISTINCT ON (ps.period_date)
            ps.period_date,
            pss."productName",
            COUNT(*) as sales_count,
            MIN(pss."skuId") as product_id -- Approximate product ID
        FROM period_sales ps
        JOIN "ProductSKUSnapshot" pss ON ps.order_id = pss."orderId"
        GROUP BY ps.period_date, pss."productName"
        ORDER BY ps.period_date, sales_count DESC
    )
    SELECT
        pa.period_date as period_start,
        CASE
            WHEN p_group_by = 'day' THEN pa.period_date
            WHEN p_group_by = 'week' THEN pa.period_date + INTERVAL '6 days'
            WHEN p_group_by = 'month' THEN (pa.period_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE
            ELSE pa.period_date
        END as period_end,
        pa.total_orders,
        pa.total_revenue,
        pa.avg_order_value,
        pa.unique_customers,
        tp.product_id,
        tp."productName",
        tp.sales_count
    FROM period_aggregates pa
    LEFT JOIN top_products tp ON pa.period_date = tp.period_date
    ORDER BY pa.period_date;
END;
$$ LANGUAGE plpgsql
STABLE;
```

### 🧹 Maintenance & Cleanup Procedures

#### Automated Data Cleanup

```sql
-- Comprehensive cleanup procedure
CREATE OR REPLACE PROCEDURE cleanup_expired_data(
    p_dry_run BOOLEAN DEFAULT true
)
AS $$
DECLARE
    v_expired_tokens INTEGER;
    v_expired_codes INTEGER;
    v_old_cart_items INTEGER;
    v_inactive_devices INTEGER;
    v_cleanup_summary TEXT;
BEGIN
    -- 1. Cleanup expired refresh tokens
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_expired_tokens
        FROM "RefreshToken"
        WHERE "expiresAt" < NOW();
    ELSE
        DELETE FROM "RefreshToken"
        WHERE "expiresAt" < NOW();
        GET DIAGNOSTICS v_expired_tokens = ROW_COUNT;
    END IF;

    -- 2. Cleanup expired verification codes
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_expired_codes
        FROM "VerificationCode"
        WHERE "expiresAt" < NOW();
    ELSE
        DELETE FROM "VerificationCode"
        WHERE "expiresAt" < NOW();
        GET DIAGNOSTICS v_expired_codes = ROW_COUNT;
    END IF;

    -- 3. Cleanup old cart items (older than 30 days)
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_old_cart_items
        FROM "CartItem"
        WHERE "updatedAt" < NOW() - INTERVAL '30 days';
    ELSE
        DELETE FROM "CartItem"
        WHERE "updatedAt" < NOW() - INTERVAL '30 days';
        GET DIAGNOSTICS v_old_cart_items = ROW_COUNT;
    END IF;

    -- 4. Mark inactive devices (not active for 90 days)
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_inactive_devices
        FROM "Device"
        WHERE "lastActive" < NOW() - INTERVAL '90 days'
          AND "isActive" = true;
    ELSE
        UPDATE "Device"
        SET "isActive" = false
        WHERE "lastActive" < NOW() - INTERVAL '90 days'
          AND "isActive" = true;
        GET DIAGNOSTICS v_inactive_devices = ROW_COUNT;
    END IF;

    -- 5. Log cleanup results
    v_cleanup_summary := format(
        'Cleanup completed - Tokens: %s, Codes: %s, Cart Items: %s, Devices: %s',
        v_expired_tokens, v_expired_codes, v_old_cart_items, v_inactive_devices
    );

    INSERT INTO cleanup_logs (
        cleanup_type,
        items_affected,
        dry_run,
        summary,
        performed_at
    )
    VALUES (
        'SCHEDULED_CLEANUP',
        v_expired_tokens + v_expired_codes + v_old_cart_items + v_inactive_devices,
        p_dry_run,
        v_cleanup_summary,
        NOW()
    );

    RAISE NOTICE '%', v_cleanup_summary;

    -- 6. Update table statistics after cleanup
    IF NOT p_dry_run THEN
        ANALYZE "RefreshToken";
        ANALYZE "VerificationCode";
        ANALYZE "CartItem";
        ANALYZE "Device";
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Cleanup procedure failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Supporting table for cleanup logs
CREATE TABLE IF NOT EXISTS cleanup_logs (
    id SERIAL PRIMARY KEY,
    cleanup_type VARCHAR(50) NOT NULL,
    items_affected INTEGER NOT NULL,
    dry_run BOOLEAN NOT NULL,
    summary TEXT,
    performed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. INTEGRATION VỚI NESTJS

### 🔌 Repository Pattern Integration

#### Enhanced Repository với Stored Procedures

```typescript
// src/shared/services/stored-procedure.service.ts
@Injectable()
export class StoredProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async callFunction<T = any>(
    functionName: string,
    params: any[] = [],
    options?: {
      timeout?: number
      retries?: number
    },
  ): Promise<T> {
    const timeout = options?.timeout || 30000 // 30 seconds default
    const retries = options?.retries || 0

    let attempt = 0
    while (attempt <= retries) {
      try {
        // Build parameterized query
        const paramPlaceholders = params.map((_, index) => `$${index + 1}`).join(', ')
        const query = `SELECT * FROM ${functionName}(${paramPlaceholders})`

        // Execute với timeout
        const result = await Promise.race([
          this.prisma.$queryRawUnsafe<T[]>(query, ...params),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Function call timeout')), timeout)),
        ])

        return Array.isArray(result) ? result[0] : result
      } catch (error) {
        attempt++
        if (attempt > retries) {
          throw new InternalServerErrorException(
            `Stored procedure ${functionName} failed after ${attempt} attempts: ${error.message}`,
          )
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  async callProcedure(procedureName: string, params: any[] = []): Promise<void> {
    try {
      const paramPlaceholders = params.map((_, index) => `$${index + 1}`).join(', ')
      const query = `CALL ${procedureName}(${paramPlaceholders})`

      await this.prisma.$executeRawUnsafe(query, ...params)
    } catch (error) {
      throw new InternalServerErrorException(`Stored procedure ${procedureName} failed: ${error.message}`)
    }
  }
}
```

#### Enhanced Order Repository

```typescript
// src/routes/order/order.repo.ts
export class OrderRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storedProc: StoredProcedureService,
  ) {}

  async createOrderWithItems(
    userId: number,
    items: CreateOrderItem[],
    createdById?: number,
  ): Promise<OrderCreationResult> {
    try {
      // Convert items to PostgreSQL format
      const pgItems = items.map((item) => ({ sku_id: item.skuId, quantity: item.quantity }))

      const result = await this.storedProc.callFunction<OrderCreationResult>(
        'create_order_with_items',
        [userId, pgItems, createdById],
        { timeout: 60000, retries: 2 },
      )

      if (result.error_message) {
        throw new BadRequestException(result.error_message)
      }

      return result
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new InternalServerErrorException('Failed to create order with items')
    }
  }

  async transitionOrderStatus(
    orderId: number,
    newStatus: OrderStatus,
    userId: number,
    notes?: string,
  ): Promise<OrderStatusTransitionResult> {
    const result = await this.storedProc.callFunction<OrderStatusTransitionResult>('transition_order_status', [
      orderId,
      newStatus,
      userId,
      notes,
    ])

    if (!result.success) {
      throw new BadRequestException(result.error_message)
    }

    return result
  }

  async getSalesAnalytics(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
    userId?: number,
  ): Promise<SalesAnalytics[]> {
    return this.storedProc.callFunction<SalesAnalytics[]>(
      'get_sales_analytics',
      [startDate, endDate, groupBy, userId],
      { timeout: 120000 }, // 2 minutes for analytics
    )
  }
}

// Type definitions
interface CreateOrderItem {
  skuId: number
  quantity: number
}

interface OrderCreationResult {
  order_id: number
  total_amount: number
  status: string
  created_at: Date
  error_message?: string
}

interface OrderStatusTransitionResult {
  success: boolean
  old_status: OrderStatus
  new_status: OrderStatus
  auto_actions_performed: string[]
  error_message?: string
}

interface SalesAnalytics {
  period_start: Date
  period_end: Date
  total_orders: number
  total_revenue: number
  avg_order_value: number
  unique_customers: number
  top_product_id: number
  top_product_name: string
  top_product_sales: number
}
```

#### Enhanced Permission Guard

```typescript
// src/shared/guards/enhanced-permission.guard.ts
@Injectable()
export class EnhancedPermissionGuard implements CanActivate {
  constructor(
    private readonly storedProc: StoredProcedureService,
    private readonly cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const path = request.route?.path
    const method = request.method

    if (!user || !path || !method) {
      return false
    }

    // Check cache first
    const cacheKey = `permission:${user.id}:${path}:${method}`
    const cachedResult = await this.cacheManager.get<boolean>(cacheKey)

    if (cachedResult !== undefined) {
      return cachedResult
    }

    try {
      // Use stored procedure for permission check
      const hasPermission = await this.storedProc.callFunction<boolean>(
        'check_user_permission',
        [user.id, path, method],
        { timeout: 5000, retries: 1 },
      )

      // Cache result for 5 minutes
      await this.cacheManager.set(cacheKey, hasPermission, 300)

      return hasPermission
    } catch (error) {
      // Log error và default to false
      console.error('Permission check failed:', error)
      return false
    }
  }
}
```

### 🔄 Service Layer Integration

#### Enhanced Order Service

```typescript
// src/routes/order/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async createOrder(userId: number, createOrderDto: CreateOrderDto, currentUser: User): Promise<OrderResponseDto> {
    this.logger.log(`Creating order for user ${userId}`, 'OrderService')

    try {
      // Use stored procedure for atomic order creation
      const result = await this.orderRepo.createOrderWithItems(userId, createOrderDto.items, currentUser.id)

      // Emit event for other services
      this.eventEmitter.emit('order.created', {
        orderId: result.order_id,
        userId,
        totalAmount: result.total_amount,
        createdAt: result.created_at,
      })

      // Transform result to DTO
      return {
        id: result.order_id,
        status: result.status as OrderStatus,
        totalAmount: result.total_amount,
        createdAt: result.created_at,
        message: 'Order created successfully',
      }
    } catch (error) {
      this.logger.error(`Failed to create order for user ${userId}: ${error.message}`, error.stack, 'OrderService')
      throw error
    }
  }

  async updateOrderStatus(
    orderId: number,
    newStatus: OrderStatus,
    currentUser: User,
    notes?: string,
  ): Promise<OrderStatusUpdateResponseDto> {
    this.logger.log(`Updating order ${orderId} status to ${newStatus}`, 'OrderService')

    try {
      const result = await this.orderRepo.transitionOrderStatus(orderId, newStatus, currentUser.id, notes)

      // Emit status change event
      this.eventEmitter.emit('order.status.changed', {
        orderId,
        fromStatus: result.old_status,
        toStatus: result.new_status,
        changedBy: currentUser.id,
        autoActions: result.auto_actions_performed,
      })

      return {
        orderId,
        oldStatus: result.old_status,
        newStatus: result.new_status,
        autoActionsPerformed: result.auto_actions_performed,
        message: 'Order status updated successfully',
      }
    } catch (error) {
      this.logger.error(`Failed to update order ${orderId} status: ${error.message}`, error.stack, 'OrderService')
      throw error
    }
  }

  async getSalesReport(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
    userId?: number,
  ): Promise<SalesReportDto> {
    this.logger.log(`Generating sales report from ${startDate} to ${endDate}`, 'OrderService')

    try {
      const analytics = await this.orderRepo.getSalesAnalytics(startDate, endDate, groupBy, userId)

      // Calculate summary statistics
      const totalRevenue = analytics.reduce((sum, period) => sum + Number(period.total_revenue), 0)
      const totalOrders = analytics.reduce((sum, period) => sum + period.total_orders, 0)
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      return {
        summary: {
          totalRevenue,
          totalOrders,
          avgOrderValue,
          periodCount: analytics.length,
        },
        periods: analytics.map((period) => ({
          periodStart: period.period_start,
          periodEnd: period.period_end,
          totalOrders: period.total_orders,
          totalRevenue: Number(period.total_revenue),
          avgOrderValue: Number(period.avg_order_value),
          uniqueCustomers: period.unique_customers,
          topProduct: {
            id: period.top_product_id,
            name: period.top_product_name,
            sales: period.top_product_sales,
          },
        })),
        generatedAt: new Date(),
        filters: {
          startDate,
          endDate,
          groupBy,
          userId,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to generate sales report: ${error.message}`, error.stack, 'OrderService')
      throw new InternalServerErrorException('Failed to generate sales report')
    }
  }
}
```

---

## 8. PERFORMANCE & SECURITY

### ⚡ Performance Optimization

#### Connection Pooling & Query Optimization

```typescript
// src/shared/config/database.config.ts
export const databaseConfig = {
  // Connection pooling settings
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // Optimize for stored procedure calls
      pool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
    },
  },
  // Query optimization
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
}

// Query performance monitoring
@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('QueryPerformance')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now()
    const request = context.switchToHttp().getRequest()
    const method = request.method
    const url = request.url

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime

        // Log slow queries (> 1 second)
        if (duration > 1000) {
          this.logger.warn(`Slow query detected: ${method} ${url} took ${duration}ms`)
        }

        // Log to metrics service for monitoring
        this.logQueryMetrics(method, url, duration)
      }),
    )
  }

  private logQueryMetrics(method: string, url: string, duration: number) {
    // Implementation depends on monitoring solution
    // Could be Prometheus, DataDog, etc.
  }
}
```

#### Stored Procedure Performance Monitoring

```sql
-- Create performance monitoring table
CREATE TABLE stored_procedure_performance (
    id SERIAL PRIMARY KEY,
    function_name VARCHAR(100) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    parameters_hash VARCHAR(64), -- For caching hints
    executed_at TIMESTAMP DEFAULT NOW(),
    executed_by INTEGER REFERENCES "User"(id)
);

CREATE INDEX idx_sp_performance_function_time
ON stored_procedure_performance(function_name, executed_at);

-- Performance logging function
CREATE OR REPLACE FUNCTION log_sp_performance(
    p_function_name VARCHAR(100),
    p_start_time TIMESTAMP,
    p_parameters_hash VARCHAR(64) DEFAULT NULL,
    p_executed_by INTEGER DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_execution_time INTEGER;
BEGIN
    v_execution_time := EXTRACT(EPOCH FROM (NOW() - p_start_time)) * 1000;

    INSERT INTO stored_procedure_performance (
        function_name,
        execution_time_ms,
        parameters_hash,
        executed_by
    )
    VALUES (
        p_function_name,
        v_execution_time,
        p_parameters_hash,
        p_executed_by
    );

    -- Alert on slow executions (> 5 seconds)
    IF v_execution_time > 5000 THEN
        RAISE WARNING 'Slow stored procedure execution: % took %ms',
            p_function_name, v_execution_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enhanced order creation với performance logging
CREATE OR REPLACE FUNCTION create_order_with_items_monitored(
    p_user_id INTEGER,
    p_order_items order_item_type[],
    p_created_by_id INTEGER DEFAULT NULL
)
RETURNS order_result_type AS $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_result order_result_type;
    v_params_hash VARCHAR(64);
BEGIN
    -- Generate parameters hash for caching hints
    v_params_hash := MD5(p_user_id::TEXT || array_to_string(p_order_items, ','));

    -- Call main function
    SELECT * INTO v_result FROM create_order_with_items(
        p_user_id, p_order_items, p_created_by_id
    );

    -- Log performance
    PERFORM log_sp_performance(
        'create_order_with_items',
        v_start_time,
        v_params_hash,
        p_created_by_id
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### 🔒 Security Best Practices

#### SQL Injection Prevention

```typescript
// src/shared/services/secure-stored-procedure.service.ts
@Injectable()
export class SecureStoredProcedureService extends StoredProcedureService {
  private readonly allowedFunctions = new Set([
    'create_order_with_items',
    'check_user_permission',
    'transition_order_status',
    'update_sku_stock',
    'get_sales_analytics',
  ])

  async callFunction<T = any>(functionName: string, params: any[] = [], options?: any): Promise<T> {
    // Validate function name whitelist
    if (!this.allowedFunctions.has(functionName)) {
      throw new ForbiddenException(`Function ${functionName} is not allowed`)
    }

    // Validate parameters
    this.validateParameters(functionName, params)

    // Call parent method
    return super.callFunction(functionName, params, options)
  }

  private validateParameters(functionName: string, params: any[]): void {
    switch (functionName) {
      case 'create_order_with_items':
        this.validateOrderCreationParams(params)
        break
      case 'check_user_permission':
        this.validatePermissionCheckParams(params)
        break
      // Add other validations...
    }
  }

  private validateOrderCreationParams(params: any[]): void {
    const [userId, items, createdById] = params

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user ID')
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Order items cannot be empty')
    }

    if (items.length > 100) {
      throw new BadRequestException('Too many items in order')
    }

    for (const item of items) {
      if (!Number.isInteger(item.sku_id) || item.sku_id <= 0) {
        throw new BadRequestException('Invalid SKU ID')
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1000) {
        throw new BadRequestException('Invalid quantity')
      }
    }

    if (createdById !== null && (!Number.isInteger(createdById) || createdById <= 0)) {
      throw new BadRequestException('Invalid created by ID')
    }
  }

  private validatePermissionCheckParams(params: any[]): void {
    const [userId, path, method] = params

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user ID')
    }

    if (typeof path !== 'string' || path.length > 1000) {
      throw new BadRequestException('Invalid path')
    }

    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    if (!allowedMethods.includes(method)) {
      throw new BadRequestException('Invalid HTTP method')
    }
  }
}
```

#### Role-Based Access Control

```sql
-- Create roles for stored procedure access
CREATE ROLE sp_user_operations;
CREATE ROLE sp_admin_operations;
CREATE ROLE sp_readonly_operations;

-- Grant specific permissions
GRANT EXECUTE ON FUNCTION check_user_permission TO sp_user_operations;
GRANT EXECUTE ON FUNCTION create_order_with_items TO sp_user_operations;
GRANT EXECUTE ON FUNCTION update_sku_stock TO sp_user_operations;

GRANT EXECUTE ON FUNCTION transition_order_status TO sp_admin_operations;
GRANT EXECUTE ON FUNCTION get_sales_analytics TO sp_admin_operations;
GRANT EXECUTE ON PROCEDURE cleanup_expired_data TO sp_admin_operations;

GRANT EXECUTE ON FUNCTION get_sales_analytics TO sp_readonly_operations;

-- Create application users với appropriate roles
CREATE USER app_user_service WITH PASSWORD 'secure_password';
GRANT sp_user_operations TO app_user_service;

CREATE USER app_admin_service WITH PASSWORD 'secure_password';
GRANT sp_admin_operations TO app_admin_service;

-- Connection string examples
-- User service: postgresql://app_user_service:password@localhost/db
-- Admin service: postgresql://app_admin_service:password@localhost/db
```

---

## 9. TESTING & DEBUGGING

### 🧪 Unit Testing Stored Procedures

#### pgTAP Testing Framework

```sql
-- Install pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Test file: tests/test_order_creation.sql
BEGIN;
SELECT plan(10); -- Number of tests

-- Test 1: Valid order creation
SELECT ok(
    (SELECT success FROM create_order_with_items(
        1, -- user_id
        ARRAY[(1, 2), (2, 1)]::order_item_type[], -- items
        1 -- created_by
    )),
    'Should create order successfully with valid data'
);

-- Test 2: Invalid user ID
SELECT ok(
    (SELECT error_message IS NOT NULL FROM create_order_with_items(
        -1, -- invalid user_id
        ARRAY[(1, 2)]::order_item_type[],
        1
    )),
    'Should fail with invalid user ID'
);

-- Test 3: Insufficient stock
INSERT INTO "SKU" (id, "productId", price, stock, value, "createdAt", "updatedAt")
VALUES (999, 1, 100.00, 1, 'TEST-SKU', NOW(), NOW());

SELECT ok(
    (SELECT error_message LIKE '%Insufficient stock%' FROM create_order_with_items(
        1,
        ARRAY[(999, 5)]::order_item_type[], -- Request more than available
        1
    )),
    'Should fail when requesting more stock than available'
);

-- Test 4: Stock update verification
SELECT is(
    (SELECT stock FROM "SKU" WHERE id = 1),
    (SELECT stock FROM "SKU" WHERE id = 1) - 2, -- After order creation
    'Stock should be decremented correctly'
);

-- Test 5: Order snapshot creation
SELECT ok(
    EXISTS(
        SELECT 1 FROM "ProductSKUSnapshot" pss
        JOIN "Order" o ON pss."orderId" = o.id
        WHERE o."userId" = 1
        AND pss."skuId" = 1
    ),
    'Should create product snapshot for order'
);

-- Cleanup test data
DELETE FROM "ProductSKUSnapshot" WHERE "skuId" = 999;
DELETE FROM "Order" WHERE "userId" = 1;
DELETE FROM "SKU" WHERE id = 999;

SELECT * FROM finish();
ROLLBACK;
```

#### NestJS Integration Tests

```typescript
// test/stored-procedures/order-creation.e2e-spec.ts
describe('Order Creation Stored Procedures (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let orderService: OrderService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
    orderService = moduleFixture.get<OrderService>(OrderService)

    await app.init()
  })

  beforeEach(async () => {
    // Setup test data
    await prisma.$executeRaw`TRUNCATE TABLE "Order" RESTART IDENTITY CASCADE`
    await prisma.$executeRaw`TRUNCATE TABLE "ProductSKUSnapshot" RESTART IDENTITY CASCADE`

    // Create test SKUs với stock
    await prisma.sKU.createMany({
      data: [
        { id: 1, productId: 1, price: 100, stock: 10, value: 'TEST-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, productId: 2, price: 200, stock: 5, value: 'TEST-2', createdAt: new Date(), updatedAt: new Date() },
      ],
    })
  })

  it('should create order successfully with valid data', async () => {
    const createOrderDto = {
      items: [
        { skuId: 1, quantity: 2 },
        { skuId: 2, quantity: 1 },
      ],
    }

    const result = await orderService.createOrder(1, createOrderDto, { id: 1 } as User)

    expect(result.id).toBeDefined()
    expect(result.status).toBe('PENDING_CONFIRMATION')
    expect(result.totalAmount).toBe(400) // (100*2) + (200*1)

    // Verify stock was decremented
    const sku1 = await prisma.sKU.findUnique({ where: { id: 1 } })
    const sku2 = await prisma.sKU.findUnique({ where: { id: 2 } })

    expect(sku1.stock).toBe(8) // 10 - 2
    expect(sku2.stock).toBe(4) // 5 - 1

    // Verify snapshots were created
    const snapshots = await prisma.productSKUSnapshot.findMany({
      where: { orderId: result.id },
    })

    expect(snapshots).toHaveLength(2)
  })

  it('should fail with insufficient stock', async () => {
    const createOrderDto = {
      items: [
        { skuId: 1, quantity: 15 }, // More than available (10)
      ],
    }

    await expect(orderService.createOrder(1, createOrderDto, { id: 1 } as User)).rejects.toThrow('Insufficient stock')

    // Verify no order was created
    const orders = await prisma.order.findMany({ where: { userId: 1 } })
    expect(orders).toHaveLength(0)

    // Verify stock wasn't changed
    const sku1 = await prisma.sKU.findUnique({ where: { id: 1 } })
    expect(sku1.stock).toBe(10)
  })

  it('should handle concurrent order creation', async () => {
    const createOrderDto = {
      items: [{ skuId: 1, quantity: 6 }], // Each order takes 6, total stock is 10
    }

    // Create two concurrent orders
    const promises = [
      orderService.createOrder(1, createOrderDto, { id: 1 } as User),
      orderService.createOrder(2, createOrderDto, { id: 2 } as User),
    ]

    const results = await Promise.allSettled(promises)

    // One should succeed, one should fail
    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    expect(successful).toBe(1)
    expect(failed).toBe(1)

    // Verify final stock state
    const sku1 = await prisma.sKU.findUnique({ where: { id: 1 } })
    expect(sku1.stock).toBe(4) // 10 - 6 from successful order
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await app.close()
  })
})
```

### 🐛 Debugging Techniques

#### Stored Procedure Debugging

```sql
-- Enable detailed logging
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- Debug function với detailed logging
CREATE OR REPLACE FUNCTION debug_create_order_with_items(
    p_user_id INTEGER,
    p_order_items order_item_type[],
    p_created_by_id INTEGER DEFAULT NULL
)
RETURNS order_result_type AS $$
DECLARE
    v_result order_result_type;
    v_item order_item_type;
    v_step TEXT;
BEGIN
    v_step := 'VALIDATION_START';
    RAISE NOTICE 'DEBUG: Starting order creation for user_id=%, items_count=%',
        p_user_id, array_length(p_order_items, 1);

    -- Step-by-step debugging
    v_step := 'USER_VALIDATION';
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = p_user_id AND "deletedAt" IS NULL) THEN
        RAISE NOTICE 'DEBUG: User validation failed for user_id=%', p_user_id;
        v_result.error_message := 'User not found';
        RETURN v_result;
    END IF;
    RAISE NOTICE 'DEBUG: User validation passed';

    v_step := 'ITEM_VALIDATION';
    FOREACH v_item IN ARRAY p_order_items
    LOOP
        RAISE NOTICE 'DEBUG: Validating item sku_id=%, quantity=%', v_item.sku_id, v_item.quantity;

        IF NOT EXISTS (SELECT 1 FROM "SKU" WHERE id = v_item.sku_id AND "deletedAt" IS NULL) THEN
            RAISE NOTICE 'DEBUG: SKU validation failed for sku_id=%', v_item.sku_id;
            v_result.error_message := format('SKU %s not found', v_item.sku_id);
            RETURN v_result;
        END IF;
    END LOOP;
    RAISE NOTICE 'DEBUG: All items validated successfully';

    -- Call main function
    v_step := 'MAIN_EXECUTION';
    SELECT * INTO v_result FROM create_order_with_items(p_user_id, p_order_items, p_created_by_id);

    RAISE NOTICE 'DEBUG: Order creation completed with result: success=%, order_id=%, error=%',
        (v_result.error_message IS NULL), v_result.order_id, v_result.error_message;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'DEBUG: Exception in step=%, error=%', v_step, SQLERRM;
        v_result.error_message := format('Debug: Failed at step %s: %s', v_step, SQLERRM);
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

#### Application-Level Debugging

```typescript
// src/shared/interceptors/stored-procedure-debug.interceptor.ts
@Injectable()
export class StoredProcedureDebugInterceptor implements NestInterceptor {
  private readonly logger = new Logger('StoredProcedureDebug')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const { method, url, body, params, query } = request

    return next.handle().pipe(
      tap({
        next: (result) => {
          this.logger.debug({
            message: 'Stored procedure call successful',
            method,
            url,
            requestBody: body,
            requestParams: params,
            queryParams: query,
            result: this.sanitizeResult(result),
          })
        },
        error: (error) => {
          this.logger.error({
            message: 'Stored procedure call failed',
            method,
            url,
            requestBody: body,
            requestParams: params,
            queryParams: query,
            error: error.message,
            stack: error.stack,
          })
        },
      }),
    )
  }

  private sanitizeResult(result: any): any {
    // Remove sensitive information from logs
    if (typeof result === 'object' && result !== null) {
      const sanitized = { ...result }
      delete sanitized.password
      delete sanitized.token
      delete sanitized.secret
      return sanitized
    }
    return result
  }
}
```

---

## 10. BEST PRACTICES & MAINTENANCE

### 🎯 Development Best Practices

#### 1. Naming Conventions

```sql
-- Function naming: verb_noun_context
create_order_with_items()
update_sku_stock()
check_user_permission()
get_sales_analytics()

-- Procedure naming: action_noun
cleanup_expired_data()
process_payment_batch()
maintain_partitions()

-- Parameter naming: p_parameter_name
p_user_id, p_order_items, p_created_by_id

-- Variable naming: v_variable_name
v_result, v_total_amount, v_item

-- Type naming: noun_type
order_item_type, order_result_type
```

#### 2. Error Handling Standards

```sql
-- Consistent error handling pattern
CREATE OR REPLACE FUNCTION standard_error_handling_example()
RETURNS result_type AS $$
DECLARE
    v_result result_type;
BEGIN
    -- Business logic here

    RETURN v_result;

EXCEPTION
    WHEN check_violation THEN
        v_result.error_message := 'Data validation failed: ' || SQLERRM;
        RETURN v_result;
    WHEN foreign_key_violation THEN
        v_result.error_message := 'Reference constraint violation: ' || SQLERRM;
        RETURN v_result;
    WHEN unique_violation THEN
        v_result.error_message := 'Duplicate data detected: ' || SQLERRM;
        RETURN v_result;
    WHEN OTHERS THEN
        -- Log detailed error for debugging
        INSERT INTO error_logs (function_name, error_code, error_message, occurred_at)
        VALUES ('standard_error_handling_example', SQLSTATE, SQLERRM, NOW());

        v_result.error_message := 'An unexpected error occurred. Please contact support.';
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Documentation Standards

```sql
-- Comprehensive function documentation
/*
 * Function: create_order_with_items
 * Purpose: Atomically create an order with multiple items, updating inventory
 *
 * Parameters:
 *   p_user_id (INTEGER) - ID of user creating the order
 *   p_order_items (order_item_type[]) - Array of items to include in order
 *   p_created_by_id (INTEGER, optional) - ID of user who initiated the creation
 *
 * Returns:
 *   order_result_type - Contains order_id, total_amount, status, created_at, error_message
 *
 * Business Rules:
 *   - User must exist and be active
 *   - All SKUs must exist and have sufficient stock
 *   - Stock is decremented atomically
 *   - Product snapshots are created for historical accuracy
 *
 * Error Conditions:
 *   - User not found or inactive
 *   - SKU not found or deleted
 *   - Insufficient stock
 *   - Concurrent stock updates
 *
 * Performance: O(n) where n is number of items
 * Concurrency: Safe with row-level locking
 *
 * Example Usage:
 *   SELECT * FROM create_order_with_items(
 *     123,
 *     ARRAY[(1, 2), (2, 1)]::order_item_type[],
 *     456
 *   );
 *
 * Version History:
 *   v1.0 - Initial implementation
 *   v1.1 - Added stock validation
 *   v1.2 - Added concurrent update protection
 */
CREATE OR REPLACE FUNCTION create_order_with_items(
    p_user_id INTEGER,
    p_order_items order_item_type[],
    p_created_by_id INTEGER DEFAULT NULL
)
RETURNS order_result_type AS $$
-- Function implementation here
$$ LANGUAGE plpgsql;
```

### 🔄 Maintenance Procedures

#### Version Control Integration

```bash
#!/bin/bash
# scripts/deploy-stored-procedures.sh

set -e

DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-ecommerce_db}
DB_USER=${DB_USER:-postgres}

echo "Deploying stored procedures to $DB_HOST/$DB_NAME..."

# Create deployment log
DEPLOY_LOG="deployments/$(date +%Y%m%d_%H%M%S)_stored_procedures.log"
mkdir -p deployments

# Deploy functions in correct order (dependencies first)
echo "$(date): Starting deployment" >> $DEPLOY_LOG

# 1. Types and helper functions
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/types.sql >> $DEPLOY_LOG 2>&1
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/helper_functions.sql >> $DEPLOY_LOG 2>&1

# 2. Core business functions
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/order_functions.sql >> $DEPLOY_LOG 2>&1
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/inventory_functions.sql >> $DEPLOY_LOG 2>&1
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/permission_functions.sql >> $DEPLOY_LOG 2>&1

# 3. Maintenance procedures
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f sql/maintenance_procedures.sql >> $DEPLOY_LOG 2>&1

# 4. Run tests
echo "$(date): Running tests" >> $DEPLOY_LOG
psql -h $DB_HOST -d $DB_NAME -U $DB_USER -f tests/test_all_functions.sql >> $DEPLOY_LOG 2>&1

echo "$(date): Deployment completed successfully" >> $DEPLOY_LOG
echo "Deployment completed! Log: $DEPLOY_LOG"
```

#### Performance Monitoring

```sql
-- Create monitoring view for stored procedure performance
CREATE VIEW sp_performance_summary AS
SELECT
    function_name,
    COUNT(*) as call_count,
    AVG(execution_time_ms) as avg_execution_time,
    MIN(execution_time_ms) as min_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
    COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_calls
FROM stored_procedure_performance
WHERE executed_at >= NOW() - INTERVAL '24 hours'
GROUP BY function_name
ORDER BY avg_execution_time DESC;

-- Alert on performance degradation
CREATE OR REPLACE FUNCTION check_sp_performance_alerts()
RETURNS void AS $$
DECLARE
    v_alert_record RECORD;
BEGIN
    FOR v_alert_record IN
        SELECT function_name, avg_execution_time, slow_calls
        FROM sp_performance_summary
        WHERE avg_execution_time > 5000 OR slow_calls > 10
    LOOP
        -- Log alert
        INSERT INTO performance_alerts (
            alert_type,
            function_name,
            metric_value,
            threshold_exceeded,
            created_at
        )
        VALUES (
            CASE
                WHEN v_alert_record.avg_execution_time > 5000 THEN 'SLOW_AVERAGE'
                WHEN v_alert_record.slow_calls > 10 THEN 'TOO_MANY_SLOW_CALLS'
            END,
            v_alert_record.function_name,
            v_alert_record.avg_execution_time,
            true,
            NOW()
        );

        -- Could also send notification here
        RAISE NOTICE 'Performance alert: Function % has avg execution time %ms with % slow calls',
            v_alert_record.function_name, v_alert_record.avg_execution_time, v_alert_record.slow_calls;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule performance checks
SELECT cron.schedule('sp-performance-check', '*/15 * * * *', 'SELECT check_sp_performance_alerts();');
```

#### Backup & Recovery Strategy

```bash
#!/bin/bash
# scripts/backup-stored-procedures.sh

BACKUP_DIR="backups/stored-procedures"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Backing up stored procedures..."

# Backup all functions
pg_dump -h $DB_HOST -d $DB_NAME -U $DB_USER \
    --schema-only \
    --no-owner \
    --no-privileges \
    -t 'pg_proc' \
    > "$BACKUP_DIR/functions_$TIMESTAMP.sql"

# Backup custom types
pg_dump -h $DB_HOST -d $DB_NAME -U $DB_USER \
    --schema-only \
    --no-owner \
    --no-privileges \
    -T '*' \
    -t 'pg_type' \
    > "$BACKUP_DIR/types_$TIMESTAMP.sql"

# Create restore script
cat > "$BACKUP_DIR/restore_$TIMESTAMP.sh" << EOF
#!/bin/bash
echo "Restoring stored procedures from backup $TIMESTAMP..."
psql -h \$DB_HOST -d \$DB_NAME -U \$DB_USER -f "$BACKUP_DIR/types_$TIMESTAMP.sql"
psql -h \$DB_HOST -d \$DB_NAME -U \$DB_USER -f "$BACKUP_DIR/functions_$TIMESTAMP.sql"
echo "Restore completed!"
EOF

chmod +x "$BACKUP_DIR/restore_$TIMESTAMP.sh"

echo "Backup completed: $BACKUP_DIR/"
echo "To restore: ./$BACKUP_DIR/restore_$TIMESTAMP.sh"
```

---

## 🎉 KẾT LUẬN

### 📊 Expected Benefits

Implementation stored procedures cho dự án NestJS Ecommerce API sẽ mang lại:

| Aspect               | Before                       | After                        | Improvement             |
| -------------------- | ---------------------------- | ---------------------------- | ----------------------- |
| Order creation time  | 500-800ms (multiple queries) | 50-100ms (single SP call)    | **5-8x faster**         |
| Permission checks    | 50-100ms (JOINs every time)  | 5-10ms (optimized SP)        | **5-10x faster**        |
| Inventory updates    | Race conditions possible     | Atomic operations            | **100% consistency**    |
| Code maintainability | Business logic scattered     | Centralized in database      | **Easier maintenance**  |
| Error handling       | Inconsistent patterns        | Standardized error responses | **Better reliability**  |
| Data integrity       | Application-level validation | Database-level constraints   | **Stronger guarantees** |

### 🎯 Implementation Roadmap

#### Phase 1 (Tuần 1-2): Core Functions

- [ ] Implement order creation stored procedure
- [ ] Create permission checking function
- [ ] Set up basic error handling patterns
- [ ] Write unit tests

#### Phase 2 (Tuần 3-4): Business Logic

- [ ] Inventory management functions
- [ ] Order status transition workflow
- [ ] Payment processing procedures
- [ ] Integration testing

#### Phase 3 (Tuần 5-6): Advanced Features

- [ ] Analytics và reporting functions
- [ ] Maintenance procedures
- [ ] Performance monitoring
- [ ] Security hardening

#### Phase 4 (Tuần 7-8): Production Ready

- [ ] Comprehensive testing
- [ ] Documentation completion
- [ ] Deployment automation
- [ ] Monitoring dashboard

### 💡 Key Takeaways

1. **Start Simple**: Begin với high-impact, low-risk functions như permission checking
2. **Test Thoroughly**: Stored procedures cần comprehensive testing strategy
3. **Monitor Performance**: Track execution times và identify bottlenecks
4. **Document Everything**: Clear documentation essential cho team collaboration
5. **Security First**: Validate inputs, use parameterized queries, implement RBAC
6. **Version Control**: Treat stored procedures như application code
7. **Gradual Migration**: Move logic incrementally, maintain backward compatibility

### ⚠️ Important Considerations

- **Database Lock-in**: Stored procedures tie you to PostgreSQL
- **Team Skills**: Ensure team có SQL/PL-pgSQL expertise
- **Testing Complexity**: Requires specialized testing approaches
- **Debugging Challenges**: Limited debugging tools compared to application code
- **Version Management**: Need proper CI/CD for database changes

Stored Procedures là **powerful tool** có thể significantly improve performance và data integrity, nhưng cần **careful planning** và **proper implementation**. Khi sử dụng đúng cách, chúng sẽ giúp dự án **scale better** và **maintain high data quality**! 🚀

---

## 📚 TÀI LIỆU THAM KHẢO

- [PostgreSQL PL/pgSQL Documentation](https://www.postgresql.org/docs/current/plpgsql.html)
- [PostgreSQL Functions and Procedures](https://www.postgresql.org/docs/current/xfunc.html)
- [pgTAP Testing Framework](https://pgtap.org/)
- [Prisma Raw Database Access](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
