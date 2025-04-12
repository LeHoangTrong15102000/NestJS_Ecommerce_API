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

- Cái `filename` là cái mà nó sẽ đưa vào cái `s3 Bucket` này

  - Cái `Key` sẽ là một cái đường dẫn - dẫn tới cái file của chúng ta ở trong cái `Bucket`, ví dụ như cái `Key` của chúng ta là `images/123.png` thì `images` là cái folder

  - `Body` nó có thể nhận vào là `buffer` hoặc là `readable` cái kiểu của nó có thể là `ReadableStreamOptionalType` | `BlobOptionalType` -> Sẽ sử dụng cái method là `readFileSync` nó sẽ đọc cái file bằng cái đường dẫn -> Khi mà đọc thì nó sẽ trả về `buffer` thì nó sẽ phù hợp với kiểu dữ liệu cửa thằng `Body`

  - `filepath` là đường đẫn đến cái file của chúng ta, thì sau khi mà upload lên trên cái server của chúng ta rồi thì sẽ có đường dẫn đến cái `file`, thì từ cái đường dẫn của cái `file` này ở trên server của chúng ta sẽ lấy cái `file` đó `upload` trên `S3 Bucket` -> Giống như là chúng ta sẽ sử dụng cái `server` của chúng ta làm một cái server `trung gian`

- Khi mà `upload` một cái `Array file` thì chúng ta sẽ có thể lấy ra được cái `path` và từ cái `path` đó thì chúng ta sẽ

- Bây giờ chúng ta sẽ không `uploadFile` lên trên máy nữa mà chúng ta sẽ upload lên S3 luôn -> Nên là ở hàm `uploadFile` chúng ta sẽ đẩy lên S3 luôn

- Khi mà upload file thành công thì nó sẽ trả về `Key` và `Location`

  - `Location` sẽ dẫn đến cái đường link sau khi mà chúng ta đã `upload` lên -> Thì bây giờ chúng ta sẽ trả về cái `Location` này cho người dùng

  - Vấn đề bây giờ là chúng ta chưa có thể xem được cái đường dẫn file được lưu trong `AWS S3` mà thôi nên là bây giờ chúng ta sẽ config để mà coi được cái đó

    - Việc đầu tiên là cần `Edit S3 block Public Access settings`

    - Và sau đó là cứ làm theo hướng dẫn như ở trên `docs` của thằng `AWS` là được mà thôi

  -> Và sau đó khi mà nhấn vào cái đường link thì chúng ta đã có thể coi được cái tấm ảnh với cái đường dẫn trên server của `AWS S3` rồi

  - Tại sao khi mà chúng ta nhấn vào cái đường link trên `AWS` thì nó lại `down` luôn cả cái `file` về luôn hoặc là nó không có view cái ảnh đúng -> Do là khi chung ta upload một cái file ảnh lên trên mà chúng ta không truyền cái `contentType: mimetype` vào nên là nó tự động download cái file đó về khi mà chúng ta nhấn vào cái đường dẫn của file đó

  - Chúng ta vẫn còn thiếu một bước đó là xóa cái file ở thư mục `upload` của dự án sau khi mà đã `upload` lên `S3 Bucket` luôn, nên là chúng ta sẽ xử lý cái vấn đề đó ở bên trong cái `MediaService` luôn.

## Bài 111 Fix bug upload file nhưng không xóa file

- Sẽ fix bug cái vấn đề đó là `Upload file` nhưng mà không xóa cái `file` của chúng ta

  - Nếu chúng ta upload file bị fail ngay tại cái bước `FilesInterceptor` thì nó sẽ không có cái `file` trong upload là đúng, còn nếu nó mà fail ở bên trong cái `ParseFilePipe` thì nó xuất hiện cái file trong thư mục `upload` thì đây rõ ràng là bug rồi

  - `FilesInterceptor` là của multer xử lý -> Sau khi mà nó qua được cái `FilesInterceptor` rồi thì nó sẽ tới cái thằng `ParseFilePipe` thì cái cách để mà fix được trong cái trường hợp này là chúng ta sẽ can thiệp vào bên trong cái `ParseFilePipe` nhưng mà đây là một cái `build-in` của NestJS rồi -> Nên là chúng ta sẽ tạo ra một cái `class` mới kế thừa cái `class - ParseFilePipe` đó

  - `ParseFilePipe` có thằng `transform` nên là chúng ta sẽ xử lý ở bên trong cái thằng `transform` đó -> Thì cái value của chúng ta chính là cái file `Array<Express.Multer.File>`

  - Với cái `Value là một Array file` thì chúng ta có thể tìm đến cái `path` của mấy cái `file` đó để mà xóa

## Bài 112 Upload file với `Presigned URL`

- Thực hiện `Upload file` với `Presigned URL` -> Chúng ta sẽ sử dụng cái kĩ thuật này để mà upload ảnh lên trên S3 hoặc là các `Storage` khác

  - Client -> Server -> S3 -> Thì cái `flow` này thì `server` là một nơi trung gian chứa cái file tạm -> Thì cái `flow` này chúng ta sẽ toàn quyền quản lí được cái file đó, cũng như là `validate` được cái `request` mà từ `client` gửi lên `server` nó có đủ quyền hạn hay không

    - Nhưng mà nhược diểm đó là nó sẽ tăng cái gánh nặng lên trên `server` -> Nếu như mà nhiều người cùng upload thì `server` chúng ta nó sẽ sập là chắc chắn, cùng với đó là server của chúng ta nó không đủ dung lượng để mà lưu trữ

  - Client -> S3 -> Nếu mà sử dụng cái trường hợp này thì chúng ta cần phải cung cấp `SECRET_KEY` và `ACCESS_KEY` nhưng mà cung cấp 2 cái giá trị là điều không nên cho thằng client rồi -> Kẻ gian nó sẽ lợi dụng và phá cái hệ thống của chúng ta -> Cho nên cái phương án này là không được.

    -> Vì vậy chúng ta cần cung cấp cái giải pháp để mà trung hòa được 2 cái thằng ở trên -> Đó là chúng ta sẽ sử dụng `Presigned URL`

  - Client -> Server để lấy `presigned URL` của `AWS S3`, với cái presigned URL này AWS nó cho phép chúng ta config cái thời gian sử dụng của Presigned URL là bao nhiêu giây đó, trong thời gian đó thì thằng client cần phải gửi file lên trên S3, nếu mà hết thời gian đó thì client nó không sử dụng được nữa, thì nó đảm bảo được việc là `Client` -> gửi trực tiếp lên trên S3 mà không thông qua `Server`, giảm workload lên server

    - Nhược điểm đó chính là cái S3 không có khả năng `validate` cái `file`, không có khả năng `validate` cái `request` -> Vì thể chúng ta để cái `presigned url` ngắn để mà khi thằng `client` nó nhận về thì nó phải `upload` ngay -> Sau này đi làm đa số đều sử dụng cái kĩ thuật này cả

  - Client -> Server để lấy Presigned URL ->

    Client -> S3 bằng Presigned URL

- Cái thư viện mime-types với cái thư viện này thì chúng ta có thể lấy cái `content-type` từ cái extentions của cái file `exp: mime.lookup(json) //'application/json'` hoặc là `exp:  mime.lookup('file.html') // 'text/html'`

- Client nó cần phải gửi lên `filename` không nhỉ ? để mà cho nó truyền lên filename hoặc là ext name cũng được -> mà thôi cứ cho nó truyền lên `filename` đi, truyền `filename` thì `client` không cần phải xử lý cái gì nhiều cả, truyền ext thì phải xử lý thêm nữa -> Khi mà có filename rồi thì chúng ta cần phải `random` cái filename đó

  -> Sau đó sẽ trả về cho người dùng là `PresignedURL`

  -> Thì sau khi mà thực hiện cái `method` `getPresignedUrl` thì chúng ta sẽ lấy được cái `PresignedURL` đó -> Thì lúc này chúng ta sẽ sử dụng cái `PresignedUrl` đó để mà `upload`, khi mà chúng ta random một cái file là `jpg` thì chúng ta cũng phải cần lấy một file đuôi `jpg` để mà `upload` lên theo

  - Thì khi mà upload lên `AWS` thì nó không cho phép chúng ta sử dụng cái `Auth` nào hết nên là chúng ta sẽ sử dụng cái `No Auth` ở phần upload lên người dùng, cái Method để mà upload thì chúng ta sử dụng method là `PUT`, và cái body chúng ta gửi lên thì chúng ta sẽ chọn `Binary` -> Thì cái `link` chính là cái `PresignedUrl` của chúng ta -> Thì cái link nó sẽ trả về như thế này cho chúng ta `https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/e001301b-245b-49f1-952c-be74426e9de1.jpg`

- Nên là ở cái method `getPresignedUrl` chúng ta sẽ return về cái link cho `client` luôn -> Oke đó chính là lý do mà chúng ta cần phải trả về cái `url` cho người dùng -> Lưu ý rằng là cái này chỉ upload được một file mà thôi, để mà upload dược nhiều file thì chúng ta cần phải get ra nhiều cái `PresignedURL` khác nhau

## Bài 113 Dùng React upload file với `Presigned URL`

- Dùng React để demo việc upload hình ảnh lên phía `AWS S3` cho người dùng

## Bài 114 Validate file khi dùng `Presigned URL`

- Sẽ có 2 cách để mà giải quyết phần nào đấy cái `issue` này

  - Cách đầu tiền là sử dụng `AWS lambda` tưởng tượng nó như là một cái func chạy trên `AWS` -> Mỗi là mà chúng ta `upload file` -> thì nó sẽ chạy để mà nó kiểm tra cái file đấy có đúng cái định dạng yêu cầu hay không, nếu mà sai thì nó sẽ xóa cái file đó

  - Cách thứ 2 là chúng ta sẽ validate cái `filesize` tại cái bước mà nó gọi đến cái server để mà lấy -> Thì ở đây client cần phải truyền lên cái `filesize` thì với cái cách này chúng ta có thể validate được cái filename và filesize -> Nhưng mà cách này nó sẽ không hiểu quả hơn là cách sử dụng `func lambda` ở trên vì thằng client có thể fake được cái `filesize`, nói chung là xác suất đó cũng thấp mà thôi, quan trong là chúng ta giải quyết được phần nào đó

    -> Tóm lại thì khi mà thằng client nó gọi tới để mà lấy cái `presignedUrl` thì chúng ta sẽ `validate` cái `file size` ngay tại cái bước đó

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
