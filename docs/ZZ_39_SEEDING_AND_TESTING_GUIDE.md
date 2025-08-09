### Tổng quan

Tài liệu này tóm tắt phân tích và hướng dẫn seeding dữ liệu mẫu cho các module `Language`, `Brand`, `Category`, `Product` (kèm `CategoryTranslation`, `ProductTranslation`, `SKU`) và cung cấp Postman collection để test API.

### Phân tích nhanh kiến trúc liên quan

- **Model chính**: `Product`, `Category`, `Brand`, `Language` cùng bảng translation tương ứng (`ProductTranslation`, `CategoryTranslation`, `BrandTranslation`).
- **Ràng buộc**:
  - `Product` bắt buộc thuộc `brandId`, có quan hệ n-n với `Category`, chứa `variants` (JSON), `images` (string[]) và `skus` (1-n).
  - Translation phụ thuộc `languageId` (bảng `Language`).
  - Các API public: `GET /products`, `GET /products/:productId`, `GET /categories`, `GET /categories/:categoryId` (tham chiếu i18n qua query `?lang=` hoặc header `Accept-Language`).
- **I18n**: cấu hình `I18nModule` dùng `QueryResolver('lang')` và `AcceptLanguageResolver` (mặc định `fallbackLanguage: 'en'`).

### Script seeding đã có sẵn

- `initialScript/add-languages.ts`: Thêm các ngôn ngữ phổ biến (id: `vi`, `en`, ...).
- `initialScript/add-brands.ts`: Thêm các thương hiệu nổi tiếng kèm translations (lọc theo `languages` có trong DB).
- `initialScript/add-sample-data.ts`: Orchestration cho Languages → Brands.

### Script seeding mới được thêm

- `initialScript/add-categories.ts`:
  - Thêm cây danh mục mẫu (Electronics → Phones/Laptops/Accessories; Fashion → Men/Women; Home & Kitchen → Kitchen) kèm translations `vi`/`en` (nếu tồn tại trong DB).
  - Hỗ trợ danh mục con đệ quy.

- `initialScript/add-products.ts`:
  - Thêm sản phẩm mẫu (iPhone 15, Galaxy S24, MacBook Air M3). Kết nối theo `brandName` và `categoryNames` (match tên category). Tự sinh `SKUs` theo tổ hợp `variants` nếu chưa khai báo sẵn (đồng bộ với logic generate trong `product.model.ts`).
  - Thiết lập `publishedAt` cho sản phẩm public.
  - Thêm `ProductTranslation` theo `vi`/`en` nếu language có trong DB.

- `initialScript/add-catalog-sample.ts`:
  - Orchestration: Languages → Brands → Categories → Products.
  - In ra thống kê tổng.

### Cách chạy seed

1. Cấu hình `.env` hợp lệ (đặc biệt `DATABASE_URL`).
2. Chạy theo từng bước hoặc toàn bộ:

```bash
pnpm ts-node initialScript/add-languages.ts
pnpm ts-node initialScript/add-brands.ts
pnpm ts-node initialScript/add-categories.ts
pnpm ts-node initialScript/add-products.ts

# Hoặc chạy gói tổng
pnpm ts-node initialScript/add-catalog-sample.ts
```

Ngoài ra đã thêm sẵn lệnh trong `package.json`:

```json
{
  "scripts": {
    "add-categories": "ts-node initialScript/add-categories.ts",
    "add-products": "ts-node initialScript/add-products.ts",
    "add-catalog-sample": "ts-node initialScript/add-catalog-sample.ts"
  }
}
```

### Postman collection

File: `docs/postman/NestJS_Ecommerce_API.postman_collection.json`

- Base URL: `http://localhost:3000`
- Sử dụng ngôn ngữ: thêm query `?lang=vi` hoặc header `Accept-Language: vi`.
- Nhóm chính:
  - Auth: `POST /auth/login`, `POST /auth/refresh-token`, `POST /auth/logout`, `POST /auth/otp`, `POST /auth/register`.
  - Categories: `GET /categories`, `GET /categories/:categoryId`, `POST/PUT/DELETE` (cần token).
  - Category Translations: `GET/POST/PUT/DELETE /category-translations` (cần token).
  - Products (public): `GET /products`, `GET /products/:productId`.
  - Manage Products (cần token): `GET/POST/PUT/DELETE /manage-product/products`.

Import JSON vào Postman để test nhanh. Với các endpoint yêu cầu token, dùng `POST /auth/login` để lấy `accessToken` và set vào header `Authorization: Bearer <token>`.

### Lưu ý khi test

- Seed theo đúng order: `Languages` → `Brands` → `Categories` → `Products`.
- Khi gọi `GET /products`/`GET /products/:id` mà không thấy bản dịch, kiểm tra tham số `?lang=` có khớp với `languageId` đã seed (`vi`, `en`, hoặc dùng `all`).
- `products` public yêu cầu `publishedAt` khác null và `<= now()`. Script đã set cho iPhone/Galaxy.
