# Khóa học NestJS Super - API Ecommerce toàn diện nhất hiện tại

---

## 📚 **Chương 9: Chức năng Profile**

### 🎯 **Bài 98: Bài tập Profile**

#### **Mục tiêu**

✅ Thực hiện bài tập CRUD cho `Profile`

#### **Yêu cầu chức năng**

- 📝 **Create:** Tạo profile cho user
- 📖 **Read:** Lấy thông tin profile
- ✏️ **Update:** Cập nhật thông tin profile
- 🗑️ **Delete:** Xóa profile (soft delete)

---

### 🎯 **Bài 99: Hướng dẫn làm Profile**

#### **Kết quả**

✅ **Trạng thái:** Đã hoàn thành bài tập CRUD với Profile

---

### 🎯 **Bài 100: Fix bug error message và refactor auth**

#### **Nội dung thực hiện**

✅ Fix bug error message bên API Role  
✅ Refactor lại một số file bên auth module

---

## 📚 **Chương 10: Chức năng User - Quản lý User**

### 🎯 **Bài 101: Refactor RolesService trong auth**

#### **Kết quả**

✅ **Trạng thái:** Đã refactor file `RolesService` trong phần Auth

---

### 🎯 **Bài 102: Bài tập CRUD User**

#### **Mục tiêu**

Xây dựng hệ thống quản lý User với phân quyền chặt chẽ

#### **Kiến trúc phân quyền**

**Hệ thống Admin:**

- 👑 **Admin:** Quyền hạn quản lý cao nhất (như `root` hoặc `superuser`)
- 🛡️ **Manager/Sub-admin:** Quản lý user với hạn chế nhất định
- ⚠️ **Nguyên tắc:** Chỉ Admin có đặc quyền tạo user

#### **Chiến lược bảo mật**

💡 **Gợi ý:** Tạo role `manager` hoặc `sub-admin` để quản lý user an toàn hơn việc cấp quyền Admin trực tiếp.

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
- ❌ **Không thể cập nhật chính mình**

**3. Xóa user: `DELETE /users/:userId`**

- ⚠️ **Chỉ Role Admin được xóa user với roleId là admin**
- ❌ **Không thể xóa chính mình**

**4. Lấy danh sách user: `GET /users`**

- ✅ Hỗ trợ phân trang
- ✅ Trả về kèm role name trong từng user

**5. Lấy thông tin user: `GET /users/:userId`**

- ✅ Trả về tương tự API get profile cá nhân

---

### 🎯 **Bài 103: Hướng dẫn CRUD User**

#### **Kết quả**

✅ **Trạng thái:** Đã hoàn thành hướng dẫn và thực hiện các API liên quan đến User

---

### 🎯 **Bài 104: Migrate unique email và totpSecret**

#### **Quyết định thiết kế**

- ✅ **Email:** Thực hiện unique
- ❌ **TotpSecret:** Không unique do:
  - Là chuỗi base32 không quá dài
  - Có khả năng cao bị trùng khi user nhiều
  - Không cần thiết cho logic nghiệp vụ

---

### 🎯 **Bài 105: Fix lỗi prisma liên quan đến Unique email**

#### **Vấn đề**

Khi email không còn unique, không thể sử dụng `findUnique`

#### **Giải pháp**

**Chuyển từ `findUnique` sang `findFirst`:**

- ✅ **Lợi ích:** Linh hoạt hơn, vẫn tận dụng được Index
- ⚠️ **Lưu ý:** Phải truyền đúng value đã được index

```typescript
// Thay vì
const user = await prisma.user.findUnique({ where: { email } })

// Sử dụng
const user = await prisma.user.findFirst({ where: { email } })
```

#### **Đảm bảo tính chính xác**

Vẫn sử dụng `uniqueObject` để đảm bảo người dùng truyền đúng value Index

---

## 📚 **Chương 11: Chức năng Media**

### 🎯 **Bài 106: Upload single file**

#### **Mục tiêu**

Thực hiện chức năng upload file đơn lẻ

#### **Quy trình thực hiện**

1. **Setup API endpoint:** Tạo endpoint để nhận file upload
2. **Configure storage:** Thiết lập đường dẫn lưu trữ file
3. **File naming:** Đổi tên file để tránh trùng lặp
4. **Serve static:** Thiết lập đường dẫn truy cập file

#### **Chi tiết implementation**

**File extension handling:**

```typescript
// Lấy phần mở rộng của filename
const extension = path.extname(originalname)
const randomName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`
```

**Storage configuration:**

- 📁 **Đường dẫn:** Sử dụng đường dẫn tuyệt đối cho stability
- 🔄 **Random filename:** Tránh trùng lặp và xung đột
- 📝 **Extension preservation:** Giữ nguyên đuôi file gốc

---

### 🎯 **Bài 107: File validation**

#### **Mục tiêu**

Thực hiện validation cho file upload an toàn và chặt chẽ

#### **ParseFilePipe Implementation**

```typescript
new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
    new FileTypeValidator({ fileType: /\.(jpg|jpeg|png|gif|webp)$/i }),
  ],
})
```

#### **Auto-create Upload Directory**

```typescript
// Trong constructor của MediaModule
constructor() {
  const uploadDir = './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}
```

#### **Validation Lifecycle**

**Flow xử lý:**

1. **MulterOptions validation** → Chạy trước (như middleware)
2. **ParseFilePipe validators** → Chạy sau (NestJS lifecycle)

#### **Built-in Validators**

**NestJS cung cấp:**

- ✅ **FileTypeValidator:** Validate kiểu file qua regex
- ✅ **MaxFileSizeValidator:** Giới hạn kích thước file

**Custom validators:**

- 🔧 **Advanced features:** Cần tự build nếu yêu cầu phức tạp
- 📝 **Extension:** Có thể extend built-in validators

---

### 🎯 **Bài 108: Upload Array of Files và Serve Static**

#### **Mục tiêu**

Xử lý upload nhiều file và serve static files với guards

#### **2 loại Multiple File Upload**

**1. Array of Files:**

- 📝 **Concept:** Một key chứa nhiều files
- 🔧 **Usage:** `FilesInterceptor('files', 10)`
- ✅ **Recommendation:** Sử dụng approach này

**2. Multiple Fields:**

- 📝 **Concept:** Nhiều keys, mỗi key có 1 hoặc nhiều files
- 🔧 **Usage:** `FileFieldsInterceptor([...])`
- 📊 **Use case:** Form phức tạp với nhiều loại file

#### **Response URL Structure**

**Desired format:**

```
localhost:3000/media/static/{filename}
```

#### **Static Assets với Guards**

**Vấn đề với `useStaticAssets`:**

- ⚠️ **Middleware priority:** Static middleware chạy trước Guards
- ❌ **Cannot protect:** Không thể áp dụng authentication
- 🔄 **Alternative:** Custom endpoint với Guards

**Giải pháp Custom Endpoint:**

```typescript
@Get('static/:filename')
@UseGuards(AccessTokenGuard) // Yêu cầu authentication
async serveFile(
  @Param('filename') filename: string,
  @Res() res: Response
) {
  const filePath = join(process.cwd(), 'uploads', filename);

  res.sendFile(filePath, (err) => {
    if (err) {
      throw new NotFoundException('File not found');
    }
  });
}
```

#### **Error Handling**

**Standardized Error Response:**

```json
{
  "message": "File not found",
  "error": "Not Found",
  "statusCode": 404
}
```

#### **Benefits của Custom Approach**

- 🛡️ **Security:** Có thể thêm authentication/authorization
- 🔧 **Flexibility:** Custom logic trước khi serve file
- 📊 **Monitoring:** Track file access patterns
- ⚡ **Caching:** Implement custom caching strategies

---

### 🎯 **Bài 109: Hướng dẫn tạo và kết nối với AWS S3**

#### **Mục tiêu**

Setup và kết nối với AWS S3 để lưu trữ file cloud

#### **AWS S3 Compatible Providers**

**AWS Official:**

- ☁️ **Amazon S3:** Original service từ AWS
- 🌍 **Global:** Có nhiều regions trên toàn thế giới

**Alternative Providers:**

- 🌊 **Digital Ocean Spaces:** S3-compatible API
- 🇻🇳 **VN Data Cloud Storage:** Provider Việt Nam
- 📦 **Wasabi:** Cost-effective alternative
- 🔄 **Compatibility:** Tất cả đều sử dụng AWS SDK

#### **Setup Requirements**

**AWS Console Steps:**

1. **Create S3 Bucket:** Tạo bucket với unique name
2. **IAM User:** Tạo user với S3 permissions
3. **Access Keys:** Generate Access Key ID và Secret Key
4. **Bucket Policy:** Configure public/private access

#### **Environment Configuration**

```bash
AWS_S3_ACCESS_KEY_ID=your_access_key
AWS_S3_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_REGION=ap-southeast-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

#### **Key Benefits**

- 💰 **Cost-effective:** Pay per usage
- 🔄 **Scalability:** Unlimited storage capacity
- 🛡️ **Security:** Built-in encryption and access control
- 🌐 **CDN Integration:** Integrate với CloudFront
- 📊 **Analytics:** Usage tracking and monitoring

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

### Bài 113 Dùng React upload file với `Presigned URL`

- Dùng React để demo việc upload hình ảnh lên phía `AWS S3` cho người dùng

### Bài 114 Validate file khi dùng `Presigned URL`

- Sẽ có 2 cách để mà giải quyết phần nào đấy cái `issue` này
  - Cách đầu tiền là sử dụng `AWS lambda` tưởng tượng nó như là một cái func chạy trên `AWS` -> Mỗi là mà chúng ta `upload file` -> thì nó sẽ chạy để mà nó kiểm tra cái file đấy có đúng cái định dạng yêu cầu hay không, nếu mà sai thì nó sẽ xóa cái file đó

  - Cách thứ 2 là chúng ta sẽ validate cái `filesize` tại cái bước mà nó gọi đến cái server để mà lấy -> Thì ở đây client cần phải truyền lên cái `filesize` thì với cái cách này chúng ta có thể validate được cái filename và filesize -> Nhưng mà cách này nó sẽ không hiểu quả hơn là cách sử dụng `func lambda` ở trên vì thằng client có thể fake được cái `filesize`, nói chung là xác suất đó cũng thấp mà thôi, quan trong là chúng ta giải quyết được phần nào đó

    -> Tóm lại thì khi mà thằng client nó gọi tới để mà lấy cái `presignedUrl` thì chúng ta sẽ `validate` cái `file size` ngay tại cái bước đó

### Bài 115 Hướng dẫn dùng S3 storage của `VN Data`

- Thực hiện upload file với `S3 Storage` của `VN Data`

- Khi mà khơi động lên thì VNDATA nó sẽ báo lỗi là `-3008` gì đó xong rồi mã code là `ENOTFOUND` -> Thì cần cung cấp thêm `S3_ENDPOINT` thì cái này chỉ dùng đối với những S3 ngoài AWS mà thôi

  -> Thì lúc này chúng ta vẫn có thể `upload` được file nhưng mà chúng ta không xem được cái `file` đó
  -> Cách fix thì lên trang của VNDATA để mà tìm hiểu, coi cách để mà fix cái vấn đề này là như thế nào -> Thì chúng ta sẽ cấu hình cái CORS và cái Policy giống như là ở bên `AWS S3` vậy
  -> Đã cấu hình xong và chạy được cái `Cloud S3 Storage` của `VNData` rồi

- Làm thể nào để mà chúng ta tạo ra cái `Policy` `CORS` ấy khi mà chúng ta không có cái UI -> Thì chúng ta sẽ sử dụng cái `SDK` để mà thiết lập ở bên trong cái source code hoặc là có thể sử dụng `REST API` cũng được -> Nhưng mà cũng nên sử dụng `SDK`

### Bài 120

- Người dùng thì họ sẽ mua trên cái SKU chứ cái Variant và VariantOption nó đâu có bị ảnh hưởng gì đâu và chúng ta chỉ có thể sắp xếp theo cái kiểu thằng nào tạo trước thằng nào tạo sau thì chúng ta sẽ sắp xếp chứ chúng ta không thể sắp xếp theo cái kiểu tùy biến được
- Ví dụ chúng ta sắp xếp các cái thằng Variant ở bên trong Product thì chúng ta cần phải có cái trường ở bên trong cái model Product -> Thì chúng ta cần phải có cái trường gọi là `VariantOrder` thì cái giá trị này sẽ là một cái mảng Array chứa các `Id` của thằng Variant thì khi mà trả về cái danh sách `variant` cho người dùng thì chúng ta cần phải sắp xếp lại cái `variant` dựa trên cái `VariantOrder` ở bên trong Product vậy, và khi ở cái thằng `VariantOptions` thì chúng ta cũng cần phải có thêm cho nó cái `VariantOptionsOrder` thì cái chỗ này nó lại làm cho chúng ta phức tạp hơn rồi đấy, nhưng mà khi chúng ta sử dụng với cái thằng `MongoDB` thì nó giải quyết khá là nhanh vì nó có hỗ trợ `JSON` cho chúng ta, và cũng may mắn là cái thằng Postgresql nó cũng hỗ trợ JSON nên là ở cái chỗ này chúng ta sẽ làm theo cái kiểu là JSON chứ không làm theo kiểu quan hệ giữa `Variant` và `VariantOptions` nữa

- Tiếp theo cần phải cập nhật đó là `productId` và `languageId` nó phải là unique khi mà deletedAt nó là null cùng với đó ở bên trong cái model SKU thì cái `value` và `productId` nó cũng phải là unique khi mà `deletedAt` là null -> Thì các cái thằng này thì chúng ta cần phải chỉnh sửa thông quá cái file `migration` của chúng ta mà thôi

- Trong postgresql nó có hỗ trợ JSON và JSONB nhưng mặc định thì cái thằng prisma nó sẽ chọn JSONB vì JSONB nó có nhiều cái mới hơn.

### Bài 121 Tạo thuật toán generate SKU

### Bài 122 Tạo model liên quan Product

### Bài 123 Khai báo type cho JSON trong prisma

### Bài 124 Tạo method findById và delete trong ProductRepo

### Bài 125 Tạo method create trong ProductRepo

### Bài 126 Tạo method update trong ProductRepo

### Bài 127 Test CRUD cho API Product và cập nhật schema validate

### Bài 128 Cập nhật create-permissions tự động thêm permissions cho seller

### Bài 129 [P1] Refactor Product - Cập nhật product repo

### Bài 130 [P2] Refactor Product - Tách product ra product và manage product

### Bài 131 Test API Product và fix bug isPublic

### Bài 132 Filter Product

### Bài 133 orderBy và sortBy Product

## 📚 **Chương 13: Chức năng Cart và Order**

### Bài 134 Migrate CartItem và khai báo cart zod schema

### Bài 135 Tạo Repo Service Controller cho Cart

### Bài 136 Gom nhóm CartItem theo shop

### Bài 137 Cập nhật createdById của SKU

### Bài 138 Sử dụng các function của Postgresql để gom nhóm CartItem

### Bài 139 Migrate Order và ProductSKUSnapshot

### Bài 140 Fix bug thêm cùng sản phẩm vào Cart và sắp xếp CartItem

### Bài 141 Tạo model dto error Order

### Bài 142 Tạo list order

### Bài 143 Tạo Order

### Bài 144 Detail và Cancel Order

### Bài 145 Validate cộng dồn quantity CartItem vượt quá stock khi add cart

## 📚 **Chương 14: Chức năng thanh toán online**

### Bài 146 Giới thiệu flow và khai báo Model Payment

### Bài 147 Tạo Webhook API Payment Receiver

### Bài 148 Bảo vệ webhook bằng API Key

### Bài 149 Setup Redis và BullMQ để làm Queue

- Setup cái Redis và Queue để mà xoá cái order và cái payment của người dùng khi mà họ không thực hiện thanh toán cho cái đơn hàng của họ

- Hướng dẫn setup trên redis local và redis cloud luôn

### Bài 150 Tạo Producer và Consumer cho Queue

### Bài 151 Tự động tính năng tự động cancel payment sau 24h không thanh toán

### Bài 152 Xóa job cancel payment khi thanh toán thành công

### Bài 153 Rollback update khi mà Queue bị lỗi

### Bài 154 Đăng ký sepay và liên kết bank

### Bài 155 Cài đặt Webhook Sepay

## 📚 **Chương 15: Websocket**

### Bài 156 Implement Websocket vào dự án

### Bài 157 Namespace trong Websocket

### Bài 158 Custom Websocket Adapter

### Bài 159 Lifecycle và middleware Websocket

### Bài 160 Lưu Socket Id vào bên trong database

### Bài 161 Emit sự kiện về cho client khi mà thanh toán thành công

### Bài 162 Emit đén nhiều client bằng Room

### Bài 163 Sử dụng Redis Adapter cho multiple server

## 📚 **Chương 16: Chương nâng cao**

### Bài 164 Swagger

### Bài 165 Rate Limit

### Bài 166 Migrate Review

### Bài 167 Logic Review

### Bài 168 Dùng CronJob tự xóa refreshToken hết hạn

### Bài 169 Fix lỗi unique email code type trên VerificationCode

### Bài 170 Cache role khi validate permissions

### Bài 171 Xóa cache khi cập nhật hoặc là sửa role permission

### Bài 172 Redis caching

### Bài 173 Sử dụng Postgresql trên DigitalOcean

### Bài 174 Helmet

### Bài 175 Logger

### Bài 176 Logger với Pino

### Bài 177 Giả lập với Race Condition

### Bài 178 Thực hành Pessimistic lock trên terminal

### Bài 179 Thực hành Pessimistic lock trên mã nguồn dự án

### Bài 180 Thực hành Optimistic lock trên mã nguồn dự án

### Bài 181 Sử dụng RedLock

### Bài 182 So sánh 3 kỹ thuật lock

**Các bài 110-115:** Đã được format chi tiết trong Lecture_04.md

---

## 📚 **Chương 12: Chức năng Product**

### 🎯 **Bài 116: CRUD Brand và Brand Translation**

#### **Kết quả**

✅ **Trạng thái:** Đã hoàn thành CRUD cho Brand và Brand Translation

---

### 🎯 **Bài 117: Đa ngôn ngữ với NestJS i18n**

#### **2 Strategies đa ngôn ngữ**

**1. Client-side Translation:**

- 📤 **Server response:** Trả về key-message pairs
- 🔄 **Client handling:** Frontend tự render theo ngôn ngữ hiện tại
- ✅ **Lợi ích:** Performance tốt, flexible

**2. Server-side Translation:**

- 📥 **Client request:** Gửi language preference qua header/query
- 🔧 **Server processing:** Render message theo language requested
- 📋 **Headers:** `Accept-Language: vi` hoặc `?lang=vi`

#### **NestJS i18n Setup**

**Configuration:**

```typescript
I18nModule.forRoot({
  fallbackLanguage: 'en',
  loaderOptions: {
    path: path.join(__dirname, '/i18n/'),
    watch: true,
  },
  resolvers: [
    { use: QueryResolver, options: ['lang'] }, // Priority 1
    AcceptLanguageResolver, // Priority 2
  ],
}),
```

**Usage trong Controller:**

```typescript
@Get('brands')
async listBrands(@I18nLang() lang: string) {
  // lang = 'all' → trả về tất cả languages
  // lang = 'vi' → chỉ trả về Vietnamese
  return this.brandService.findAll(lang);
}
```

---

### 🎯 **Bài 118-126: Product Development**

#### **Tình trạng phát triển**

🚧 **Đã hoàn thành:**

- ✅ CRUD Category và Category Translation
- ✅ Product Schema Migration
- ✅ SKU Generation Algorithm
- ✅ Product Models và JSON Types
- ✅ Product Repository Methods (findById, create, update, delete)
- ✅ API Testing và Schema Validation

#### **AIRide Integration Project**

🎯 **Current Focus:** Module Booking trong hệ thống AIRide

- **Tech Stack:** Fastify + Prisma
- **Timeline:** Hoàn thành trong tháng này
- **Mindset:** Cơ hội học hỏi và phát triển

---

### 🎯 **Bài 127-131: Advanced Features**

#### **Nội dung**

🔄 **Đang phát triển:** Các tính năng nâng cao cho Product management

---

## 📚 **Roadmap các Chương tiếp theo**

### **🔮 Kế hoạch phát triển**

**📦 Chương 13:** Cart và Order Management

- Shopping cart functionality
- Order processing workflow
- Inventory management

**💳 Chương 14:** Payment Integration

- Online payment gateways
- Transaction processing
- Payment security

**⭐ Chương 15:** Review System

- User reviews và ratings
- Review moderation
- Analytics dashboard

**💬 Chương 16:** Chat Functionality

- Real-time messaging
- Customer support chat
- WebSocket implementation

**🚀 Chương 17:** Advanced Features

- Search optimization
- Caching strategies
- Performance monitoring

**🎯 Chương 18:** Production Deployment

- CI/CD pipelines
- Monitoring và logging
- Scaling strategies

---

### **💡 Key Takeaways**

- 🎓 **Learning:** Continuous improvement through real projects
- 🚀 **Opportunity:** AIRide project = practical experience
- ⏰ **Timeline:** Focus on completion over perfection
- 🔧 **Tech Growth:** Fastify + Prisma = valuable skills
