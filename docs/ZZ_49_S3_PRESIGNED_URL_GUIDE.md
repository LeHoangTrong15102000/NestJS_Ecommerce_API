# 🚀 Hướng Dẫn Chi Tiết Về Kỹ Thuật Pre-Signed URL trong AWS S3

## 📋 Mục Lục

1. [Tổng Quan Về Pre-Signed URL](#tổng-quan-về-pre-signed-url)
2. [Phân Tích Source Code](#phân-tích-source-code)
3. [So Sánh Hai Phương Pháp Upload](#so-sánh-hai-phương-pháp-upload)
4. [Cách Hoạt Động Chi Tiết](#cách-hoạt-động-chi-tiết)
5. [Lợi Ích Và Nhược Điểm](#lợi-ích-và-nhược-điểm)
6. [Best Practices](#best-practices)
7. [Kết Luận](#kết-luận)

---

## 🎯 Tổng Quan Về Pre-Signed URL

### Pre-Signed URL là gì?

**Pre-Signed URL** là một URL đặc biệt được AWS S3 tạo ra với các đặc điểm:

- ✅ **Có thời hạn sử dụng** (expiration time)
- ✅ **Chứa thông tin xác thực** được mã hóa trong URL
- ✅ **Cho phép thực hiện các thao tác** (GET, PUT, DELETE) mà không cần AWS credentials
- ✅ **Bảo mật cao** vì chỉ có thể sử dụng trong thời gian giới hạn

### Tại sao cần Pre-Signed URL?

Trong dự án của bạn, có **2 cách upload file**:

#### 🔄 Cách 1: Upload Truyền Thống (qua Server)

```
Client → Server (NestJS) → AWS S3
```

#### ⚡ Cách 2: Upload Với Pre-Signed URL (Direct Upload)

```
Client → AWS S3 (trực tiếp)
```

---

## 🔍 Phân Tích Source Code

### 1. S3Service - Cấu Hình AWS S3

```typescript
@Injectable()
export class S3Service {
  private s3: S3

  constructor() {
    this.s3 = new S3({
      region: envConfig.S3_REGION,
      credentials: {
        accessKeyId: envConfig.S3_ACCESS_KEY_ID,
        secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
      },
    })
  }
```

**Giải thích:**

- Khởi tạo S3 client với credentials từ server
- Chỉ server mới có quyền truy cập AWS credentials
- Client không bao giờ biết được AWS credentials

### 2. Upload Truyền Thống - Method `uploadedFile`

```typescript
uploadedFile({ filename, filepath, contentType }: { filename: string; filepath: string; contentType: string }) {
  const parallelUploads3 = new Upload({
    client: this.s3,
    params: {
      Bucket: envConfig.S3_BUCKET_NAME,
      Key: filename,
      Body: readFileSync(filepath), // Đọc file từ disk server
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 1024 * 1024 * 5, // 5MB chunks
    leavePartsOnError: false,
  })

  return parallelUploads3.done()
}
```

**Flow hoạt động:**

1. Client upload file lên server NestJS
2. Server lưu file tạm thời vào disk (`readFileSync(filepath)`)
3. Server đọc file từ disk và upload lên S3
4. Server xóa file tạm thời sau khi upload thành công

### 3. Pre-Signed URL - Method `createPresignedUrlWithClient`

```typescript
createPresignedUrlWithClient(filename: string) {
  const contentType = mime.lookup(filename) || 'application/octet-stream'
  const command = new PutObjectCommand({
    Bucket: envConfig.S3_BUCKET_NAME,
    Key: filename,
    ContentType: contentType
  })

  return getSignedUrl(this.s3, command, { expiresIn: 10 }) // 10 giây
}
```

**Flow hoạt động:**

1. Client yêu cầu pre-signed URL từ server
2. Server tạo URL có chứa thông tin xác thực
3. Client sử dụng URL này để upload trực tiếp lên S3
4. Không cần server làm trung gian

### 4. MediaService - Logic Xử Lý

```typescript
async getPresignedUrl(body: PresignedUploadFileBodyType) {
  const randomFilname = generateRandomFileName(body.filename)
  const presignedUrl = await this.s3Service.createPresignedUrlWithClient(randomFilname)
  const url = presignedUrl.split('?')[0] // URL file sau khi upload thành công

  return { presignedUrl, url }
}
```

**Ý nghĩa:**

- `presignedUrl`: URL để upload (có chứa signature, expires)
- `url`: URL public để truy cập file sau khi upload thành công

---

## ⚖️ So Sánh Hai Phương Pháp Upload

| Tiêu Chí              | Upload Truyền Thống           | Pre-Signed URL            |
| --------------------- | ----------------------------- | ------------------------- |
| **Hiệu Suất**         | ❌ Chậm (2 lần transfer)      | ✅ Nhanh (1 lần transfer) |
| **Băng Thông Server** | ❌ Tốn nhiều                  | ✅ Tiết kiệm              |
| **Độ Phức Tạp**       | ✅ Đơn giản                   | ❌ Phức tạp hơn           |
| **Bảo Mật**           | ✅ Server kiểm soát hoàn toàn | ⚠️ Cần cấu hình CORS      |
| **Khả Năng Mở Rộng**  | ❌ Hạn chế                    | ✅ Tốt                    |
| **Cost**              | ❌ Tốn phí bandwidth          | ✅ Tiết kiệm              |

---

## 🔧 Cách Hoạt Động Chi Tiết

### Pre-Signed URL Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as NestJS Server
    participant S3 as AWS S3

    Note over C,S3: 1. Yêu cầu Pre-Signed URL
    C->>S: POST /media/images/upload/presigned-url
    Note over C,S: Body: { filename: "image.jpg", filesize: 1024 }

    Note over S,S3: 2. Server tạo Pre-Signed URL
    S->>S: generateRandomFileName()
    S->>S: createPresignedUrlWithClient()
    S->>C: { presignedUrl, url }

    Note over C,S3: 3. Client upload trực tiếp lên S3
    C->>S3: PUT presignedUrl
    Note over C,S3: Body: File binary data
    S3->>C: 200 OK

    Note over C,S3: 4. Thông báo thành công (optional)
    C->>S: POST /notify-upload-success
    Note over C,S: Body: { url, metadata }
```

### Cấu Trúc Pre-Signed URL

Một pre-signed URL điển hình trông như thế này:

```
https://my-bucket.s3.amazonaws.com/images/abc123.jpg?
X-Amz-Algorithm=AWS4-HMAC-SHA256&
X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20230101%2Fus-east-1%2Fs3%2Faws4_request&
X-Amz-Date=20230101T120000Z&
X-Amz-Expires=300&
X-Amz-SignedHeaders=host&
X-Amz-Signature=abcd1234...
```

**Thành phần:**

- `X-Amz-Algorithm`: Thuật toán mã hóa
- `X-Amz-Credential`: Thông tin credential
- `X-Amz-Date`: Thời gian tạo URL
- `X-Amz-Expires`: Thời gian hết hạn (giây)
- `X-Amz-Signature`: Chữ ký số để xác thực

---

## 🎁 Lợi Ích Và Nhược Điểm

### ✅ Lợi Ích

#### 1. **Hiệu Suất Cao**

- Client upload trực tiếp lên S3, không qua server
- Giảm 50% thời gian upload so với phương pháp truyền thống
- Server không bị bottleneck bởi việc xử lý file

#### 2. **Tiết Kiệm Chi Phí**

- Giảm bandwidth server
- Giảm CPU usage trên server
- Tận dụng CDN của AWS S3

#### 3. **Khả Năng Mở Rộng**

- Server có thể xử lý nhiều request hơn
- Không bị giới hạn bởi memory/disk server

#### 4. **Bảo Mật**

- URL có thời hạn (trong code của bạn là 10 giây)
- Client không cần biết AWS credentials
- Có thể giới hạn loại file, kích thước

#### 5. **Trải Nghiệm Người Dùng**

- Upload nhanh hơn
- Có thể hiển thị progress bar chính xác
- Ít bị timeout

### ❌ Nhược Điểm

#### 1. **Độ Phức Tạp**

- Cần hiểu về AWS S3, CORS
- Frontend phức tạp hơn
- Khó debug khi có lỗi

#### 2. **Kiểm Soát Hạn Chế**

- Không thể validate file content trước khi upload
- Khó implement virus scanning real-time
- Cần cơ chế cleanup file rác

#### 3. **Dependency**

- Phụ thuộc vào AWS S3
- Cần cấu hình CORS đúng
- Cần handle network errors

---

## 💡 Best Practices

### 1. **Thời Gian Hết Hạn**

```typescript
// ❌ Quá ngắn - user không kịp upload
expiresIn: 10 // 10 giây

// ✅ Vừa phải cho file nhỏ
expiresIn: 300 // 5 phút

// ✅ Cho file lớn
expiresIn: 3600 // 1 giờ
```

### 2. **Validation Kép**

```typescript
// Client-side validation
const validateFile = (file: File) => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File quá lớn')
  }
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('File type không hợp lệ')
  }
}

// Server-side validation (khi tạo pre-signed URL)
export const PresignedUploadFileBodySchema = z
  .object({
    filename: z.string(),
    filesize: z.number().max(1 * 1024 * 1024), // 1MB
  })
  .strict()
```

### 3. **Error Handling**

```typescript
const uploadWithPresignedUrl = async (file: File, presignedUrl: string) => {
  try {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    return response
  } catch (error) {
    // Fallback to traditional upload
    return uploadViaServer(file)
  }
}
```

### 4. **CORS Configuration**

```typescript
// Trong S3Service constructor (code của bạn đã comment)
this.s3.putBucketCors({
  Bucket: envConfig.S3_BUCKET_NAME,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT'],
        AllowedOrigins: ['https://yourdomain.com'], // Chỉ định domain cụ thể
        ExposeHeaders: [],
      },
    ],
  },
})
```

### 5. **File Naming Strategy**

```typescript
// ✅ Tốt - tránh conflict, có thể organize
const generateFileName = (originalName: string) => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  const extension = path.extname(originalName)
  return `images/${timestamp}-${random}${extension}`
}

// ✅ Tốt hơn - có thể group theo user/date
const generateFileName = (originalName: string, userId: string) => {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const uuid = uuidv4()
  const extension = path.extname(originalName)
  return `users/${userId}/${date}/${uuid}${extension}`
}
```

### 6. **Monitoring & Cleanup**

```typescript
// Tạo job cleanup file không sử dụng
@Cron('0 2 * * *') // Chạy lúc 2h sáng hàng ngày
async cleanupUnusedFiles() {
  // Logic cleanup files được upload nhưng không được sử dụng
}

// Log upload activity
async getPresignedUrl(body: PresignedUploadFileBodyType) {
  const result = await this.s3Service.createPresignedUrlWithClient(filename)

  // Log để tracking
  this.logger.log(`Pre-signed URL created for ${filename}`, {
    filename,
    filesize: body.filesize,
    expiresIn: 300,
  })

  return result
}
```

---

## 🔄 Kịch Bản Sử Dụng Thực Tế

### 1. **Upload Avatar Người Dùng**

```typescript
// 1. Client request pre-signed URL
const { presignedUrl, url } = await api.post('/media/images/upload/presigned-url', {
  filename: 'avatar.jpg',
  filesize: file.size,
})

// 2. Upload trực tiếp lên S3
await fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
})

// 3. Update user profile với URL mới
await api.patch('/users/me', {
  avatar: url,
})
```

### 2. **Upload Nhiều Ảnh Sản Phẩm**

```typescript
const uploadMultipleImages = async (files: File[]) => {
  // 1. Lấy multiple pre-signed URLs
  const urls = await Promise.all(
    files.map((file) =>
      api.post('/media/images/upload/presigned-url', {
        filename: file.name,
        filesize: file.size,
      }),
    ),
  )

  // 2. Upload parallel
  const uploadPromises = files.map((file, index) =>
    fetch(urls[index].presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    }),
  )

  await Promise.all(uploadPromises)

  // 3. Return public URLs
  return urls.map((u) => u.url)
}
```

---

## 🎯 Kết Luận

### Khi Nào Nên Sử Dụng Pre-Signed URL?

#### ✅ **Nên Sử Dụng Khi:**

- File size > 1MB
- Có nhiều user upload cùng lúc
- Cần tối ưu performance
- Muốn giảm chi phí server
- Upload file media (ảnh, video)

#### ❌ **Không Nên Sử Dụng Khi:**

- File nhỏ (< 100KB)
- Cần validate nội dung file trước khi lưu
- Hệ thống đơn giản, ít user
- Cần audit log chi tiết mọi thao tác

### Tóm Tắt Lợi Ích Chính

1. **⚡ Performance**: Tăng tốc độ upload 2-3 lần
2. **💰 Cost**: Giảm 70% bandwidth server
3. **🔧 Scalability**: Server có thể handle nhiều request hơn
4. **🔒 Security**: URL có thời hạn, không lộ credentials
5. **👥 User Experience**: Upload nhanh, ít bị timeout

### Source Code Của Bạn

Code của bạn đã implement khá tốt với:

- ✅ Sử dụng `mime.lookup()` để detect content type
- ✅ Random filename để tránh conflict
- ✅ Validation file size và type
- ✅ Có cả 2 phương pháp upload (traditional + pre-signed)

**Gợi ý cải thiện:**

- Tăng `expiresIn` từ 10 giây lên 300 giây (5 phút)
- Thêm error handling cho trường hợp S3 service down
- Implement cleanup job cho unused files
- Thêm monitoring và logging chi tiết

---

_Hy vọng tài liệu này giúp bạn hiểu rõ hơn về kỹ thuật Pre-Signed URL! 🚀_
