# 🛒 Thiết Kế Giỏ Hàng Đơn Giản Cho Hệ Thống E-commerce

> **Mục tiêu:** Đưa ra thiết kế database giỏ hàng đơn giản, dễ hiểu, dễ mở rộng, phù hợp cho mọi hệ thống bán hàng online.

---

## 1. Phân Tích Yêu Cầu Cơ Bản

- **Product**: Sản phẩm bán ra, có thể có nhiều thuộc tính (tên, giá, hình ảnh...)
- **Cart**: Giỏ hàng của từng người dùng (hoặc guest), lưu các sản phẩm mà user muốn mua
- **CartItem**: Mỗi dòng trong giỏ hàng, đại diện cho 1 sản phẩm cụ thể và số lượng
- **ProductSnapshot** (tuỳ chọn): Lưu lại thông tin sản phẩm tại thời điểm thêm vào giỏ (tránh thay đổi giá/sản phẩm sau này)

---

## 2. Thiết Kế Database (SQL)

### **Bảng Product**

```sql
CREATE TABLE product (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(1000),
    -- Có thể thêm các trường khác như: description, stock, ...
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Bảng Cart**

```sql
CREATE TABLE cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- NULL nếu là guest
    session_id VARCHAR(255), -- Cho guest (nếu cần)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
    -- Có thể thêm trường expires_at để auto xóa cart cũ
);
```

### **Bảng CartItem**

```sql
CREATE TABLE cart_item (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES product(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    -- Snapshot giá và tên sản phẩm tại thời điểm thêm vào giỏ
    product_name VARCHAR(255) NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    product_image_url VARCHAR(1000),
    added_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cart_id, product_id) -- 1 sản phẩm chỉ xuất hiện 1 lần trong 1 cart
);
```

### **(Tuỳ chọn) Bảng ProductSnapshot**

Nếu muốn lưu lịch sử thay đổi sản phẩm hoặc bảo toàn thông tin khi sản phẩm bị xoá/sửa:

```sql
CREATE TABLE product_snapshot (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(1000),
    snapshotted_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Giải Thích Từng Trường

- **product**: Lưu thông tin sản phẩm gốc
- **cart**: Đại diện cho 1 giỏ hàng (của user hoặc guest)
- **cart_item**: Mỗi dòng là 1 sản phẩm trong giỏ, có snapshot giá/tên để không bị ảnh hưởng khi product thay đổi
- **product_snapshot**: (tuỳ chọn) Lưu lại lịch sử sản phẩm, dùng cho các hệ thống cần audit hoặc rollback

---

## 4. Luồng Thao Tác Cơ Bản

1. **User thêm sản phẩm vào giỏ:**
   - Nếu chưa có cart, tạo mới (theo user_id hoặc session_id)
   - Nếu sản phẩm đã có trong giỏ, tăng quantity
   - Nếu chưa có, tạo mới cart_item, lưu snapshot giá/tên
2. **User cập nhật/xoá sản phẩm trong giỏ:**
   - Cập nhật quantity hoặc xoá cart_item
3. **Khi checkout:**
   - Dùng thông tin snapshot trong cart_item để tính tiền, không lấy lại từ bảng product

---

## 5. Ưu Điểm Thiết Kế Này

- **Đơn giản, dễ hiểu, dễ mở rộng**
- **Không bị ảnh hưởng khi sản phẩm thay đổi giá/tên**
- **Hỗ trợ cả user đăng nhập và guest**
- **Dễ dàng cleanup cart cũ (dựa vào created_at/updated_at/expired_at)**
- **Có thể mở rộng thêm coupon, voucher, shipping info... nếu cần**

---

## 6. Ví Dụ Truy Vấn Thường Gặp

- **Lấy giỏ hàng của user:**

```sql
SELECT * FROM cart_item WHERE cart_id = (SELECT id FROM cart WHERE user_id = 123);
```

- **Cập nhật số lượng:**

```sql
UPDATE cart_item SET quantity = 5 WHERE cart_id = 1 AND product_id = 10;
```

- **Xoá sản phẩm khỏi giỏ:**

```sql
DELETE FROM cart_item WHERE cart_id = 1 AND product_id = 10;
```

---

## 7. Gợi Ý Mở Rộng

- Thêm trường `expires_at` vào cart để tự động xoá cart cũ
- Thêm bảng `cart_coupon` nếu muốn áp dụng mã giảm giá
- Thêm trường `is_active` vào cart_item để soft delete
- Thêm trường `note` vào cart_item cho user ghi chú

---

## 8. Tổng Kết

Thiết kế này phù hợp cho mọi hệ thống bán hàng online nhỏ đến vừa, dễ maintain, dễ migrate, và dễ tích hợp với các hệ thống lớn hơn về sau.

---

_Bạn có thể copy-paste trực tiếp các đoạn SQL trên để tạo bảng mẫu cho hệ thống của mình!_
