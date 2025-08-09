### Cách dùng Postman

- Mở Postman, Import file: `docs/postman/NestJS_Ecommerce_API.postman_collection.json`.
- Set biến: `accessToken`, `refreshToken` trong tab Variables của collection (tạm thời để trống).
- Tạo token:
  1. `POST /auth/login` với email/mật khẩu trong `.env` (ví dụ `admin@example.com` / `ADMIN_PASSWORD`).
  2. Copy `accessToken` từ response và set vào biến `accessToken` của collection.

- Test danh mục: `GET /categories?lang=vi`, `GET /categories/:id?lang=vi`.
- Test sản phẩm public: `GET /products?lang=vi`, `GET /products/:id?lang=vi`.
- Test manage products: dùng các request trong folder Manage Products (cần header Authorization).
