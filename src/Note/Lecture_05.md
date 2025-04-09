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

- Khi mà email nó không còn là `unique` thì chúng ta không thể nào mà sử dụng được cái hàm `findUnique` được nữa -> Nên là để mà linh động hơn chúng ta sẽ dùng một cái method khác đó chính là `findFirst` nếu chúng truyền đúng cái `value` mà nó đã được `index` thì nó sẽ tìm ra cái `valueIndex` đó `Nó vẫn tận dụng được cái Index bình thường`, còn nếu mà chúng ta truyền `value` nó linh hoạt thì tất nhiên là nó không có tận dụng được cái `Index của thằng findFirst trong prisma rồi`

- Chúng ta vẫn sử dụng lại cái `uniqueObject` để mà đảm bảo là người dùng ngta truyền đúng cái `valueIndex` vào -> Thay vì phải sử dụng `queryRaw` nó khá là rối thì chúng ta sẽ sử dụng `findFirst` cho nó khỏe

## Chương 11 Chức năng `Media`

## Bài 106 Upload single file

- Thực hiện chức năng `upload file`

- Sao đó chúng ta sẽ copy cái example của nó như thế là chúng ta có thể `request` được cái `API upload` rồi -> Khi mà đã `upload` thành công rồi thì làm sao để mà chúng ta có thể thấy được cái file mà chúng ta vừa mới upload được bây giờ -> Thì chúng ta cần vào đọc lại cái `documents` của nó, thì chúng ta cần phải thêm vào cái đường dẫn để mà chứa các cái file upload của người dùng nữa thì mới được.

- Chúng ta thấy được là cái file của chúng ta upload lên nó đã đổi tên rồi nhưng mà nó thiếu cái phần mở rộng, cái đuôi file của chúng ta đó là `image/jpeg`

  - Chúng ta sẽ để một cái đường dẫn tuyệt đối luôn cho nó

  - Đến cái phần file name chúng ta sẽ sử dụng cái hàm Random cho `fileName`, phần mở rộng của cái `filename` thì chúng ta cần sử dụng cái method là `path.extname(filename)` -> Là có thể lấy được phần mở rộng của cái `filename` đó

## Bài 107 File validation

- `File Vaidation` -> sẽ thực hiện validation cho file đầu vào, nếu chúng ta muốn custom thì chúng ta sẽ sử dụng cái cú pháp giống như ở trên document của `NestJS`, còn hông thì chúng ta sẽ sử dụng `validation sẵn có` của NestJS cũng được

  - Thì cái hàm `parseFilePipe` này chúng ta sẽ đưa nó vào trong cái `upload file`

    ```ts
      new ParseFilePipe({
        validators: [],
      }),
      Và chúng ta sẽ để những cái validation ở bên trong đó
    ```

  - Với một cái vấn đề nữa là khi mà chúng ta xóa cái thư mục upload mà chúng ta lại custom một cái `Storage` ở bên trong `MulterModule` thì nó sẽ bị lỗi

  - Nên là chúng ta sẽ thêm vào cái `constructor()` ở chỗ này để khi mà nó chạy tới cái `MediaModule` thì nó sẽ khởi tạo cái `folder` `upload` nếu như mà chưa có cái folder đó

  - Tiếp theo là chúng ta có thể validate đó là `FileTypeValidator` đó là chúng ta `validator` về kiểu `file` đầu vào mà ng dùng gửi lên `server` -> Thường thì sẽ chuyển cái đầu vào là `Regex` để mà nó nhận được các đuôi file như là `jpeg/png/jpg/webp...`

  - Thì ngoài ra ở bên trong cái thằng `FileInterceptor` ngoài nhận vào tham só là `filename` thì nó còn nhận vào một options thứ 2 đó là `localOptions: MulterOptions` thì khi mà `validate` một cái file đầu vào thì nó sẽ chạy cái hàm ở bên trong `MulterOptions` trước sau đó thì nó mới chạy xuống các hàm `validate` ở dưới `ParseFilePipe` sau -> Thì nó cũng giống như cái `lifeCycle` của `NestJS` mà thôi

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

## Bài 121 Tạo `Model` liên quan đến `Product`

## Bài 122 Khai báo type cho `JSON` trong `prisma`

## Bài 123 Khai báo method `findById` và `delete` trong `ProductRepo`

## Bài 124 Tạo method `Create` trong `ProductRepo`

## Bài 125 Tạo method `Update` trong `ProductRepo`

## Bài 126 Test CRUD `API Product` và cập nhật `schema Validation`

## Bài 127

## Bài 128

## Bài 129

## Bài 130

## Bài 131

## Chương 13 Tìm hiểu về `Review`

## Chương 13.1 Chức năng

## Chương 14 Áp dụng các design pattern vào bên trong dự án

## Chương 15 Thực hiện `Websocket` ở bên trong dự án

## Chương 16 Thực hiện xử lý `Review` cho từng dự án

## Chương 17 Thực hiện xử lý `Message` cho dự án

## Chương 18 Thực hiện các tính năng tiếp theo của dự án

## Thực hiện các chức năng `Advanced` ở bên trong dự án
