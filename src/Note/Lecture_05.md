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

  - Thằng NestJS nó chỉ có 2 cái `validator File` ở trong `ParseFilePipe` mà thôi còn lại thì chúng ta cần phải tự build lên nếu chúng ta cần những tính năng nâng cao hơn nữa ở trong cái hệ thống của chúng ta.

## Bài 108 Upload Array of Files và Serve Static

- Khi mà `upload nhiều file` thì ở bên trong NestJS nó sẽ có 2 loại

  - Đó là chúng ta có thể dùng một cái `key` sau đó đưa nhiều file vào trong cái key đó, chúng ta có thể đưa nhiều file vào trong cái key rất là bình thường -> Thì đây gọi là `Arrays of file`

  - Cái loại thứ 2 là `Multiple File` chúng ta dùng nhiều `key` khác nhau, mỗi `key` chúng ta có thêm vào 1 hoặc là nhiều file khác nhau. -> thì cái `Multiple File` nó chỉ khác `Array of File` như vậy thôi còn cấu hình là nó không có khác gì mấy.

  - Thì ở trong phần này thì chúng ta sẽ tập trung xử lý `Array of File` còn cái `Multiple File` thì cũng tương tự mà thôi.

- Sau khi mà upload thành công rồi thì nên trả về cho người dùng cái đường link sau khi mà `upload` người dùng có thể click vào cái đường link đó để mà view được cái hình ảnh

  - Cái đường link chúng ta muốn nó có dạng như là: `localhost:3000/media/static/{tên-file}`

  - Để mà sử dụng được `useStaticAssets` thì chúng ta cần phải truyền cái `GenericType` là `NestExpressApplication` -> Rồi sau đó chúng ta sẽ cái đường dẫn đến cái `folder upload` của chúng ta là được

  - Bây giờ nó sẽ nảy ra một cái trường hợp nữa đó là đôi khi chúng ta muốn thiết lập cái `Guard` cho cái `media` thì làm sao -> Hiện tại chúng ta chưa làm cái `guard` cho cái media nên là khi mà enter vào thì nó nhảy vào luôn, Cho dù chúng ta có khai báo `route` là `media/static` endpoint ở bên trong `controller` đi chăng nữa thì nó cũng không có bắt được

  - Bây giờ quay trở lại cái vấn đề đó là cái thằng static này nó không thiết lập cái `guard` được

  - Cái thằng `StaticAssets` nó là một cái middleware nó đã chạy trước và nó return kết quả về trước luôn rồi nên là nó không nhảy về cái route này được:

    ```ts
      @Get('static/:file')
      serveFile(@Param('file') file: string) {
        console.log(file)
      }

    ```

  - Trong cái trường hợp này chúng ta mà muốn custom một cái `Guard` cho những `static file` -> Nên là phải cần tới cái Guard để không phải là ai có cái đường link đều có thể xem `file ảnh` hay `video` cả chỉ những người đã xác thực `verify AccessToken` rồi thì mới cho vào xem được -> Thì trong những trường hợp như vậy chúng ta sẽ kh ông dùng cái middleware `useStaticAssets` nữa.

  - Thì chúng ta sẽ xử lý ở bên trong cái `API Endpoint` luôn -> Thì ở cái `Route Handler` này thì nó cần phải chạy quá cái `Guard` của chúng ta trước khi mà nó vào cái `API Endpoint` này nên là từ cái bước như này thì chúng ta có thể `custom` được sâu hơn, có thể thêm những cái `Guard Custom` vào cho nó nữa

  - Khi mà chúng ta đưa vào cái đường dẫn file sai thì nó sẽ ra lỗi là `404` bây giờ chúng ta muốn `custom` một cái `message` khác cho nó để mà nó hiển thị ra lỗi tường minh hơn -> Thì cái `sendFile` cái tham số thứ 2 nó xử lý `errBack`

    - Khi mà quy chuẩn lại code thì chúng ta sẽ nhận được kết quả lỗi trả về một cách quy chuẩn như thế này:

      ```JSON
        "message": "File not found",
        "error": "Not Found",
        "statusCode": 404
      ```

## Bài 109 Hướng dẫn tạo và kết nối với AWS S3

- Hướng dẫn tạo và kết nối với `AWS S3`, nếu mà không sử dụng S3 bên AWS thì chúng ta có thể sử dụng S3 ở một số nhà cung cấp khác ví dụ như là `Digital Ocean` thì thằng này nó vẫn dùng thư viện của `AWS` để mà tương tác với `S3` bên `DigitalOcean`, thì ở VN cũng có nhà cung cấp đó là `VNdata` cũng dùng cái `AWS S3` để mà tương tác với `VN Data Cloud Storage` luôn

## Bài 110 Upload file lên S3

- Thực hiện upload file lên `S3 AWS`

- Lỡ mà có quên hay gì đó thì chúng ta có thể tạo mới lại cái `ACCESS_KEY_S3` bình thường, và chúng ta có thể tạo ra nhiều cái `ACESS KEY S3`

- Thì để mà kết nối với S3 thì chúng ta cần phải cài đặt 2 cái thư viện đó là `@aws-sdk/client-s3` và thư viện đó là `@aws-sdk/lib-storage`

## Bài 111 Fix bug upload file nhưng không xóa file

## Bài 112 Upload file với `Presigned URL`

## Bài 113 Dùng React upload file với `Presigned URL`

## Bài 114 Validate file khi dùng `Presigned URL`

## Bài 115 Hướng dẫn dùng S3 storage của `VN Data`

- Thực hiện upload file với `S3 Storage` của `VN Data`

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
