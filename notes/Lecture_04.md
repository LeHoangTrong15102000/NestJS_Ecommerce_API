# Khóa học NestJS Super - API Ecommerce toàn diện nhất hiện tại

---

## 📚 **Chương 6: Chức năng Language**

### 🎯 **Bài 76: Tối ưu Language Schema và index deletedAt**

#### **Mục tiêu**

Tối ưu schema Prisma của `Language` trước khi bắt tay vào việc code.

#### **Phân tích và giải pháp**

**1. Tối ưu khóa chính cho Language:**

- **Vấn đề hiện tại:** Frontend thường lưu `Language Code` và gửi lên API thông qua Header
- **Flow hiện tại:**
  ```
  Frontend gửi Language Code → API query schema Language → Tìm languageId → Tìm translation phù hợp
  ```
- **Giải pháp tối ưu:**
  - Xóa trường `code`
  - Chuyển trường `id` thành `String` (giới hạn 10 ký tự) làm khóa chính
  - Lợi ích: Loại bỏ bước query trung gian, truy xuất trực tiếp

**2. Tối ưu index cho deletedAt:**

- **Lý do:** Khi query tất cả language với điều kiện `deletedAt = null`
- **Giải pháp:** Đánh index cho trường `deletedAt`
  ```prisma
  @@index([deletedAt])
  ```

#### **Lưu ý quan trọng**

⚠️ Khi sửa `Language` như này, mỗi lần tạo `Language` cần cung cấp trường `Id` (không có default).

---

### 🎯 **Bài 77: Bài tập CRUD Language**

#### **Nhiệm vụ**

✅ Thực hiện bài tập CRUD cho `Language`  
✅ **Trạng thái:** Đã hoàn thành

---

### 🎯 **Bài 78: Hướng dẫn làm chức năng Language**

#### **Kết quả**

✅ **Trạng thái:** Đã hoàn thành việc CRUD cho `Language`

---

## 📚 **Chương 7: Prisma Migrate**

### 🎯 **Bài 79: Vấn đề của Prisma db push**

#### **Khái niệm Single Source of Truth (SSOT)**

> **SSOT:** Nơi duy nhất chứa thông tin của database. Mọi thứ đều được sinh ra từ đây.

#### **Cách hoạt động của `prisma db push`**

1. **So sánh:** Prisma so sánh schema trong `schema.prisma` với trạng thái hiện tại của database
2. **Áp dụng:** Nếu có khác biệt, Prisma tự động áp dụng thay đổi
3. **Không tạo file migration:** Thay đổi được áp dụng trực tiếp

#### **Ưu và nhược điểm**

| **Ưu điểm** ✅                 | **Nhược điểm** ❌              |
| ------------------------------ | ------------------------------ |
| • Migrate nhanh chóng          | • Không thể rollback migration |
| • Không cần tạo file migration | • Không lưu lịch sử migration  |
| • Phù hợp cho development      | • Khó theo dõi thay đổi        |
| • Tốt cho giai đoạn thử nghiệm | • Giới hạn tính năng database  |

---

### 🎯 **Bài 80: Chuyển đổi từ prisma db push sang prisma migrate**

#### **Các bước thực hiện**

**1. Đồng bộ `schema.prisma` với database hiện tại**

```bash
# Nếu chưa có schema.prisma
prisma db pull

# Nếu đã có schema.prisma
prisma db push
```

**2. Tạo baseline migration**

```bash
# Tạo thư mục migration
mkdir -p prisma/migrations/0_init

# Tạo file migration từ schema
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# Đánh dấu migration đã được áp dụng
npx prisma migrate resolve --applied 0_init
```

**3. Thay đổi SSOT**

- **Trước:** Single Source of Truth = `schema.prisma`
- **Sau:** Single Source of Truth = `migrations files`

**4. Hoàn tất**
✅ Commit `schema.prisma` và thư mục `prisma/migrations` lên git

---

### 🎯 **Bài 81: Thêm chức năng Partial Unique Index bằng Prisma Migrate**

#### **Vấn đề cần giải quyết**

Schema `Permission` cần unique cặp `(path, method)` nhưng với soft-delete gặp vấn đề:

- Xóa mềm → không cho phép tạo lại cùng `path + method`
- PostgreSQL coi `deletedAt = null` là các giá trị khác nhau

#### **Giải pháp: Partial Unique Index**

**Mục tiêu:** Unique chỉ khi `deletedAt = null`

```sql
-- Cú pháp mong muốn (Prisma không hỗ trợ)
@@unique([path,method], {where: {deletedAt: null}})

-- SQL thực tế
CREATE UNIQUE INDEX permission_path_method_unique
ON "Permission" (path, method)
WHERE "deletedAt" IS NULL;
```

#### **Quy trình thực hiện**

**Bước 1:** Tạo migration rỗng

```bash
npx prisma migrate dev --create-only
```

**Bước 2:** Chỉnh sửa file migration

```sql
CREATE UNIQUE INDEX permission_path_method_unique
ON "Permission" (path, method)
WHERE "deletedAt" IS NULL;
```

**Bước 3:** Áp dụng migration

```bash
npx prisma migrate dev
```

---

### 🎯 **Bài 82: Custom Migration**

#### **Workflow migration đúng**

1. **Tạo migration:** `npx prisma migrate dev --create-only`
2. **Sửa file migration:** Chỉnh sửa nội dung theo nhu cầu
3. **Áp dụng migration:** `npx prisma migrate dev`

#### **Ví dụ: Rename column thay vì Drop + Add**

❌ **Sai:** (Gây mất dữ liệu)

```sql
ALTER TABLE "Permission" DROP COLUMN "description",
ADD COLUMN "content" TEXT NOT NULL;
```

✅ **Đúng:** (Giữ nguyên dữ liệu)

```sql
ALTER TABLE "Permission" RENAME COLUMN "description" TO "content";
```

#### **Xử lý khi migration failed**

**1. Đánh dấu rollback**

```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

**2. Sửa file migration**

**3. Redeploy migration**

```bash
npx prisma migrate deploy
```

#### **⚠️ Lưu ý quan trọng**

> Đừng tự ý sửa trực tiếp trên database. Nếu sửa trực tiếp, phải thêm câu lệnh vào migration file để đồng bộ.

---

### 🎯 **Bài 83: Fix lỗi "The migration was modified after it was applied" và thêm deletedById**

#### **Nguyên nhân lỗi**

- Database sử dụng `checksum` để phân biệt file migration đã được chỉnh sửa
- Checksum trong database khác với checksum trong file migration

#### **Giải pháp**

1. **Xóa file migration bị lỗi trong database** (không dùng `prisma migrate reset` để tránh mất data)
2. **Thêm deletedById vào schema.prisma**

---

## 📚 **Chương 8: Chức năng Role-Permission**

### 🎯 **Bài 84-85: CRUD Permission**

#### **Nhiệm vụ**

✅ Thực hiện CRUD permission với hỗ trợ phân trang  
✅ Truyền phân trang qua query params: `page` và `limit`  
✅ **Trạng thái:** Đã hoàn thành

---

### 🎯 **Bài 86: Tạo script Create Permission hàng loạt**

#### **Mục tiêu**

Viết script tạo Permission hàng loạt dựa trên List API Endpoint

#### **Lưu ý**

- Script tự động exit sau khi hoàn thành
- Chạy lại sẽ gặp lỗi `Unique Constraints Path Method`

---

### 🎯 **Bài 87: Script xóa/tạo Permission dựa trên endpoint hiện có**

#### **Logic hoạt động**

1. **So sánh:** Permission trong database vs Source code
2. **Xóa:** Permission không tồn tại trong source code
3. **Thêm:** Route trong source code chưa có permission

#### **Cách thức**

- Tạo object với key là `method-path` để so sánh thuận lợi
- Chỉnh sửa trực tiếp file `create-permissions` thay vì tạo file mới

---

### 🎯 **Bài 88: Down migration và CRUD Roles**

#### **Tối ưu Role schema**

Cho unique `name` của Role khi `deletedAt = null` (tương tự Permission)

#### **Quy trình revert migration**

**1. Tạo migration revert**

```bash
npx prisma migrate dev --create-only
```

**2. Viết câu lệnh revert**

```sql
-- Revert ví dụ
DROP INDEX Role_name_unique;
```

**3. Áp dụng và dọn dẹp**

```bash
npx prisma migrate dev
# Sau đó xóa 2 file migration đã bù trừ nhau
```

#### **Lưu ý cho team**

Sau khi pull code về:

1. `npx prisma migrate deploy` - Áp dụng migration chưa có
2. `npx prisma migrate dev` - Sync với database

---

### 🎯 **Bài 89: QueryRaw và CRUD Roles**

#### **Vấn đề với Partial Unique Name**

- Prisma không hiểu Partial Unique Index
- Không generate type chính xác
- **Giải pháp:** Sử dụng `QueryRaw`

#### **Cú pháp QueryRaw**

```sql
-- Lưu ý sử dụng dấu nháy kép thay vì nháy đơn
SELECT * FROM "Role"
WHERE name = ${RoleName.Client}
AND "deletedAt" IS NULL
LIMIT 1;
```

#### **Tips quan trọng**

- Sử dụng `IS` khi so sánh với `true/false/null`
- Các trường hợp khác dùng toán tử `=`
- Method không tự chạy khi start app, cần gọi thủ công

---

### 🎯 **Bài 90: Cập nhật Zod Schema và giải thích Index**

#### **Cập nhật schema cho Permission và Role**

- Role trả về thêm mã `permission` cho client hiển thị
- Cập nhật permission: truyền `permissionIds` array

#### **Giải thích Index SQL**

**Test performance với `EXPLAIN ANALYZE`:**

| Kết quả               | Ý nghĩa                  |
| --------------------- | ------------------------ |
| `Seq Scan`            | Quét tuần tự từng record |
| Index không được dùng | Do số lượng item quá ít  |

**Khi nào Index hiệu quả:**

- Số lượng records ≥ 10,000
- Database tự động chọn giải pháp tối ưu
- Ở số lượng ít, `Seq Scan` hiệu quả hơn

---

### 🎯 **Bài 91: Fix bug Permission đã xóa mềm nhưng vẫn còn trong Role**

#### **Bug 1: Role Detail hiển thị Permission đã xóa**

**Nguyên nhân:** Include permission bị soft-deleted  
**Giải pháp:** Thêm điều kiện `where: {deletedAt: null}`

#### **Bug 2: Update Role với Permission đã xóa**

**Vấn đề:** API không báo lỗi khi truyền permissionId đã xóa mềm  
**Giải pháp:** Kiểm tra trước khi update, quăng lỗi nếu permission đã bị xóa

```typescript
// Kiểm tra permission còn tồn tại
const validPermissions = await this.checkPermissionsExist(permissionIds)
if (validPermissions.length !== permissionIds.length) {
  throw new Error('Some permissions have been deleted')
}
```

---

### 🎯 **Bài 92: Script add Permissions vào Admin Role**

#### **Mục tiêu**

Mỗi lần chạy script `create-permissions`, Role Admin tự động cập nhật danh sách permissions

#### **Giải pháp lỗi where name**

- **Vấn đề:** `name` không còn là unique index
- **Lựa chọn:**
  1. Chuyển thành `queryRaw`
  2. Sử dụng `id` của AdminRole (chọn phương án này cho dễ đọc)

#### **Tối ưu hiệu suất**

- **Hiện tại:** Số lượng ít, chưa cần tối ưu
- **Tương lai:** Khi permissions ≥ 1000-2000 records
  - Giảm thuộc tính trả về cho client
  - Áp dụng phân trang cho RoleDetail

---

### 🎯 **Bài 93: Kiểm tra Role Permission khi request**

#### **Flow middleware kiểm tra quyền**

```
1. Kiểm tra Access Token → Lấy userId, roleId
2. Query database → Lấy danh sách permissions của Role
3. Kiểm tra quyền → So sánh với endpoint được request
```

#### **Implementation trong AccessTokenGuard**

```typescript
// Sau khi verify AccessToken thành công
if (isValidAccessToken) {
  // Query permissions của role
  const permissions = await this.getPermissionsByRole(payload.roleId)

  // Lấy path và method của request hiện tại
  const requestPath = request.url
  const requestMethod = request.method

  // Kiểm tra quyền truy cập
  const hasPermission = this.checkPermission(permissions, requestPath, requestMethod)

  if (!hasPermission) {
    throw new ForbiddenException()
  }
}
```

#### **Lưu ý**

- Guard chỉ chạy với routes yêu cầu authentication
- Routes public không bị ảnh hưởng
- Cần phân biệt lỗi `Unauthorized` vs `Forbidden`

---

### 🎯 **Bài 94: Refactor Authentication Guard**

#### **Mục tiêu tối ưu**

Refactor `canActivate` method cho gọn gàng hơn

#### **Cách tiếp cận**

Tách 2 điều kiện thành 2 functions riêng biệt:

1. **OR function:** Xử lý logic hoặc
2. **AND function:** Xử lý logic và

---

### 🎯 **Bài 95: Ngăn chặn User thao tác trên Base Role**

#### **Quy tắc bảo mật hệ thống**

**1. Không cho phép xóa 3 role cơ bản:**

- `ADMIN`
- `CLIENT`
- `SELLER`

**Lý do:** Các role này được sử dụng nhiều trong code (ví dụ: register auto role CLIENT)

**2. Không cho phép cập nhật role ADMIN:**

- Kể cả user với role ADMIN
- **Mục đích:** Tránh ADMIN thay đổi permission làm mất quyền kiểm soát hệ thống

---

### 🎯 **Bài 96: Thêm cột Module vào Permission để gom nhóm**

#### **Mục tiêu**

Gom nhóm permissions theo module thay vì hiển thị hàng trăm permission rời rạc

#### **Giải pháp**

Thêm column `module` vào Permission schema thay vì tạo bảng Module riêng

#### **Logic lấy module name**

```typescript
// Từ path "/auth/login" → module = "auth"
const getModuleName = (path: string) => {
  return path.split('/')[1] || 'root'
}
```

#### **Lợi ích**

- **UI/UX:** Frontend dễ dàng group permissions theo module
- **Quản lý:** Dễ dàng tổ chức và tìm kiếm permissions
- **Hiệu suất:** Giảm số lượng items hiển thị trên một màn hình

---

### 🎯 **Bài 97: Fix Bug Role bị vô hiệu hóa & Không cho chỉnh sửa Base Role**

#### **Bug cần fix**

1. **Role bị vô hiệu hóa** vẫn cho phép request
2. **Base Role** vẫn có thể bị chỉnh sửa

#### **Giải pháp**

1. **Kiểm tra trạng thái Role:** Từ chối request nếu role bị disable
2. **Bảo vệ Base Role:** Ngăn chặn mọi thao tác chỉnh sửa/xóa đối với ADMIN, CLIENT, SELLER

---

## 📚 **Chương 9: Chức năng Profile**

### 🎯 **Bài 98-99: CRUD Profile**

#### **Nhiệm vụ**

✅ Thực hiện bài tập CRUD cho Profile  
✅ **Trạng thái:** Đã hoàn thành

---

### 🎯 **Bài 100: Fix bug error message và refactor auth**

#### **Nội dung**

✅ Fix bug error message bên API Role  
✅ Refactor lại một số file bên auth

---

## 📚 **Chương 10: Chức năng User - Quản lý User**

### 🎯 **Bài 101: Refactor RolesService trong auth**

#### **Kết quả**

✅ **Trạng thái:** Đã refactor xong RolesService

---

### 🎯 **Bài 102: CRUD User**

#### **Quy tắc phân quyền**

**Quản lý cấp cao:**

- **Admin:** Quyền hạn quản lý cao nhất (như `root` hoặc `superuser`)
- **Manager/Sub-admin:** Quản lý user với một số hạn chế

#### **API Endpoints và quy tắc**

**1. Tạo user: `POST /users`**

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

- ⚠️ **Chỉ Role Admin được tạo user với roleId là admin**

**2. Cập nhật user: `PUT /users/:userId`**

- ⚠️ **Chỉ Role Admin được:**
  - Cập nhật user với roleId là admin
  - Lên cấp role thành admin
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

#### **Setup cơ bản**

```typescript
import { MulterModule } from '@nestjs/platform-express'
import { diskStorage } from 'multer'

// Cấu hình storage
const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})
```

#### **Controller Implementation**

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', { storage }))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  return {
    message: 'File uploaded successfully',
    filename: file.filename,
    path: file.path,
    url: `${process.env.BASE_URL}/media/static/${file.filename}`
  };
}
```

#### **Lưu ý**

- ⚠️ **Filename:** Tự động đổi tên để tránh trùng lặp
- 📁 **Storage:** Tự động tạo thư mục uploads nếu chưa có
- 🔧 **Extension:** Sử dụng `path.extname()` để lấy đuôi file

---

### 🎯 **Bài 107: File validation**

#### **Mục tiêu**

Validation file upload an toàn và chặt chẽ

#### **Validation Setup**

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        new FileTypeValidator({ fileType: /\.(jpg|jpeg|png|gif|webp)$/i }),
      ],
    }),
  ) file: Express.Multer.File,
) {
  return this.mediaService.uploadFile(file);
}
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

#### **Custom Validation**

- 📏 **Size limit:** 5MB tối đa
- 🖼️ **File types:** Chỉ chấp nhận image formats
- 🛡️ **Security:** Kiểm tra MIME type và extension

---

### 🎯 **Bài 108: Upload Array of Files và Serve Static**

#### **Upload Multiple Files**

```typescript
@Post('upload-multiple')
@UseInterceptors(FilesInterceptor('files', 10)) // Tối đa 10 files
async uploadFiles(
  @UploadedFiles(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        new FileTypeValidator({ fileType: /\.(jpg|jpeg|png|gif|webp)$/i }),
      ],
    }),
  ) files: Express.Multer.File[],
) {
  return {
    message: `${files.length} files uploaded successfully`,
    files: files.map(file => ({
      filename: file.filename,
      url: `${process.env.BASE_URL}/media/static/${file.filename}`
    }))
  };
}
```

#### **Serve Static Files**

```typescript
// main.ts
const app = await NestFactory.create<NestExpressApplication>(AppModule)
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/media/static/',
})
```

#### **Custom Static File Serving với Guards**

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

---

### 🎯 **Bài 109: Hướng dẫn tạo và kết nối với AWS S3**

#### **AWS S3 Setup**

1. **Tạo S3 Bucket trên AWS Console**
2. **Configure IAM User với S3 permissions**
3. **Lấy Access Key ID và Secret Access Key**

#### **Environment Variables**

```bash
AWS_S3_ACCESS_KEY_ID=your_access_key
AWS_S3_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_REGION=ap-southeast-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

#### **Alternative Providers**

- 🌊 **Digital Ocean Spaces:** Tương thích với AWS S3 SDK
- 🇻🇳 **VN Data Cloud Storage:** Sử dụng S3-compatible API
- ☁️ **Tất cả đều dùng:** Cùng thư viện AWS SDK

---

### 🎯 **Bài 110: Upload file lên S3**

#### **Installation**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

#### **S3 Service Implementation**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

@Injectable()
export class S3Service {
  private s3Client: S3Client

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      },
    })
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const key = `images/${uuidv4()}-${file.originalname}`

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fs.readFileSync(file.path),
        ContentType: file.mimetype,
      },
    })

    const result = await upload.done()

    // Xóa file local sau khi upload thành công
    fs.unlinkSync(file.path)

    return result.Location // URL của file trên S3
  }
}
```

#### **Key Points**

- 🔑 **Key:** Đường dẫn file trong S3 bucket (có thể có folder)
- 📄 **Body:** File content (buffer hoặc stream)
- 🏷️ **ContentType:** MIME type để browser hiển thị đúng
- 🧹 **Cleanup:** Xóa file local sau khi upload S3 thành công

---

### 🎯 **Bài 111: Fix bug upload file nhưng không xóa file**

#### **Vấn đề**

File upload fail ở `ParseFilePipe` nhưng vẫn tạo file trong thư mục uploads

#### **Giải pháp: Custom ParseFilePipe**

```typescript
export class ParseFilePipeWithUnlink extends ParseFilePipe {
  async transform(value: any, metadata: ArgumentMetadata) {
    try {
      return await super.transform(value, metadata)
    } catch (error) {
      // Xóa file nếu validation fail
      if (Array.isArray(value)) {
        value.forEach((file) => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        })
      } else if (value && value.path && fs.existsSync(value.path)) {
        fs.unlinkSync(value.path)
      }
      throw error
    }
  }
}
```

#### **Usage**

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(
  @UploadedFile(
    new ParseFilePipeWithUnlink({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        new FileTypeValidator({ fileType: /\.(jpg|jpeg|png|gif|webp)$/i }),
      ],
    }),
  ) file: Express.Multer.File,
) {
  return this.mediaService.uploadFile(file);
}
```

---

### 🎯 **Bài 112: Upload file với Presigned URL**

#### **Presigned URL Strategy**

**Lợi ích:**

- ⚡ **Performance:** Client upload trực tiếp lên S3
- 🔒 **Security:** URL có thời hạn sử dụng
- 💰 **Cost:** Giảm bandwidth cho server

#### **Flow**

```
1. Client request presigned URL từ server
2. Server generate presigned URL (5 phút hết hạn)
3. Client upload file trực tiếp lên S3 bằng presigned URL
4. Client báo server về việc upload thành công
```

#### **Implementation**

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

async getPresignedUrl(filename: string): Promise<string> {
  const key = `images/${uuidv4()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    ContentType: mime.lookup(filename) || 'application/octet-stream',
  });

  const presignedUrl = await getSignedUrl(this.s3Client, command, {
    expiresIn: 300, // 5 phút
  });

  return {
    presignedUrl,
    key,
    expiresIn: 300
  };
}
```

---

### 🎯 **Bài 113: Dùng React upload file với Presigned URL**

#### **Frontend Implementation**

```typescript
const uploadFile = async (file: File) => {
  try {
    // 1. Lấy presigned URL
    const { presignedUrl, key } = await getPresignedUrl(file.name)

    // 2. Upload file trực tiếp lên S3
    await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    // 3. Thông báo server upload thành công
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    console.log('File uploaded:', fileUrl)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}
```

---

### 🎯 **Bài 114: Validate file khi dùng Presigned URL**

#### **Giải pháp 1: AWS Lambda (Recommended)**

```typescript
// Lambda function tự động trigger khi có file mới upload
export const validateUploadedFile = async (event) => {
  const { bucket, key } = event.Records[0].s3

  try {
    // Validate file size, type, etc.
    const validation = await validateFile(bucket, key)

    if (!validation.isValid) {
      // Xóa file không hợp lệ
      await deleteObject(bucket, key)
      console.log(`Deleted invalid file: ${key}`)
    }
  } catch (error) {
    console.error('Validation failed:', error)
  }
}
```

#### **Giải pháp 2: Server-side Validation**

```typescript
@Post('presigned-url')
async getPresignedUrl(@Body() body: GetPresignedUrlDTO) {
  const { filename, fileSize } = body;

  // Validate trước khi tạo presigned URL
  if (fileSize > 5 * 1024 * 1024) {
    throw new BadRequestException('File size too large');
  }

  const ext = path.extname(filename).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    throw new BadRequestException('Invalid file type');
  }

  return this.s3Service.getPresignedUrl(filename);
}
```

---

### 🎯 **Bài 115: Hướng dẫn dùng S3 storage của VN Data**

#### **VN Data Configuration**

```bash
# Environment variables cho VN Data
S3_ENDPOINT=https://hcm-1.vndata.vn
S3_ACCESS_KEY_ID=your_vndata_access_key
S3_SECRET_ACCESS_KEY=your_vndata_secret_key
S3_BUCKET_NAME=your-bucket-name
S3_REGION=hcm-1
```

#### **S3 Client Setup**

```typescript
this.s3Client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT, // Chỉ cần cho non-AWS providers
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Cần thiết cho một số providers
})
```

#### **CORS Configuration**

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

#### **Lưu ý**

- 🔧 **Endpoint:** Bắt buộc cho non-AWS S3 providers
- 🔄 **forcePathStyle:** Một số provider yêu cầu
- 🌐 **CORS:** Cần config để frontend có thể upload

---

## 📚 **Chương 12: Chức năng Product**

### 🎯 **Bài 116-117: CRUD Brand và đa ngôn ngữ**

#### **Kết quả**

✅ **CRUD Brand và Brand Translation** đã hoàn thành  
✅ **NestJS i18n** đã được tích hợp cho đa ngôn ngữ

---

### 🎯 **Bài 118-130: Product Management**

#### **Tình trạng phát triển**

🚧 **Đang trong quá trình phát triển:**

- CRUD Category và Category Translation
- Product Schema Migration
- SKU Generation Algorithm
- Product Models và JSON Types
- Product Repository Methods
- API Testing và Schema Validation

---

## 📚 **Các Chương tiếp theo**

### **🔮 Roadmap phát triển**

- 📦 **Chương 13:** Cart và Order Management
- 💳 **Chương 14:** Payment Integration
- ⭐ **Chương 15:** Review System
- 💬 **Chương 16:** Chat Functionality
- 🚀 **Chương 17:** Advanced Features
- 🎯 **Chương 18:** Production Deployment

### **🎯 Mục tiêu hiện tại**

Hoàn thành Module Booking trong hệ thống AIRide của business trong tháng này
