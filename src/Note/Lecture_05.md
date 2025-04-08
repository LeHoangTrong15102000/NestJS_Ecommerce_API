# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Chương 9 Chức năng `Profile`

## Bài 98 Bài tập `Profile`

- Thực hiện bài tập CRUD cho `Profile`

## Bài 99 Hướng dẫn làm `Profile`

- Làm bài tập CRUD với `Profile`

## Bài 100 Fix bug error message bên `API Role` và refactor lại một số file bên auth

- Fix bug và thực hiện rafactor lại mốt số file bên auth

## Chương 10 Chức năng `User: Quản lý User`

## Bài 101 Refactor `RolesService` trong auth

- Đã refactor lại cái file `RolesService` ở bên trong phần `Auth` rồi

## Bài 102 Bài tập CRUD `User`

- Bài tập CRUD với thằng User

- Thì ở đây sẽ có những cái lưu ý như sau thì chỉ có `roleAdmin` mới có thể add được user mà thôi, còn những cái role khác chúng ta không cho nó quyền để mà add được `user` -> Do đó chỉ có `roleAdmin` mới có đặc quyền như vậy mà thôi

Hệ thống chúng ta coi Admin là quyền hạn quản lý cao nhất, giống như `root` hay `superuser` trong một số hệ thống khác.

Nếu bạn muốn quản lý người dùng, có thể dùng role admin hoặc giải pháp an toàn hơn là bạn tạo thêm một role `manager` hoặc `sub-admin` để quản lý user. Cho dù các role này bạn add full permissions thì vẫn bị một số hạn chế không được như role admin.

Mọi Role có permissions đến các API user đều có thể gọi nhưng có 1 số lưu ý

### Tạo user: POST /users

```json
{
  "email": "duthanhduoc14@gmail.com",
  "name": "Dư Thanh Được",
  "phoneNumber": "123098123",
  "avatar": "google.com",
  "password": "123456",
  "roleId": 1,
  "status": "ACTIVE"
}
```

- Chỉ có Role Admin mới được tạo user với roleId là admin

### Cập nhật user: PUT /users/:userId

body tương tự như tạo user

```json
{
  "email": "duthanhduoc12@gmail.com",
  "name": "Dư Thanh Được",
  "phoneNumber": "123098123",
  "avatar": "google.com",
  "password": "123456",
  "roleId": 2,
  "status": "ACTIVE"
}
```

- Chỉ có Role Admin mới được cập nhật user với roleId là admin, hoặc lên cấp role thành admin
- Bạn không thể cập nhật chính mình

### Xóa user: DELETE /users/:userId

- Chỉ có Role Admin mới được xóa user với roleId là admin
- Bạn không thể xóa chính mình

### Lấy danh sách user: GET /users

- Hỗ trợ phân trang
- Trả về kết quả kèm role name trong từng user

### Lấy thông tin user: GET /users/:userId

- Trả về kết quả tương tự api get profile cá nhân

## Bài 103 Hướng dẫn CRUD `User`

- Hướng dẫn CRUD với `User` sau đó là thực hiện các API liên quan đến `User` của người dùng

## Bài 104 Migrate `unique` `email` và `totpSecret`

- Sẽ thực hiện Unique `Email` và `TotpSecret`

- Chúng ta sẽ bỏ đánh index cho cái `totpSecret` vì nó là chuỗi `base32` nên là nó sẽ không quá dài, và có khả năng cao là nó sẽ bị trùng nếu mà `user` quá nhiều -> Nên là chúng ta không cần phải đánh `index unique` cho `totpSecret` làm gì

## Bài 105 Fix lỗi prisma liên quan đến `Unique email`

## Chương 11 Chức năng `Media`

## Bài 106 Upload single file

## Bài 107 File validation

## Bài 108 Upload Array of Files và Serve Static

## Bài 109 Hướng dẫn tạo và kết nối với AWS S3

## Bài 110 Upload file lên S3

## Bài 111 Fix bug upload file nhưng không xóa file

## Bài 112 Upload file với `Presigned URL`

## Bài 113 Dùng React upload file với `Presigned URL`

## Bài 114 Validate file khi dùng `Presigned URL`

## Bài 115 Hướng dẫn dùng S3 storoge của `VN Data`

## Chương 12 Chức năng `Product`

## Bài 116 CRUD `Brand` và `Brand Translation`

## Bài 117 Đa ngôn ngữ với `NestJS i18n`

## Bài 118 CRUD `Category` và `Category Translation`

## Bài 119 Migrate Product

## Bài 120 Tạo thuật toán generate SKU

## Chương 13 Tìm hiểu về `Redis`

## Chương 14 Áp dụng các design pattern vào bên trong dự án

## Chương 15 Thực hiện `Websocket` ở bên trong dự án

## Chương 16 Thực hiện xử lý `Review` cho từng dự án

## Chương 17 Thực hiện xử lý `Message` cho dự án

## Chương 18 Thực hiện các tính năng tiếp theo của dự án

## Thực hiện các chức năng `Advanced` ở bên trong dự án
