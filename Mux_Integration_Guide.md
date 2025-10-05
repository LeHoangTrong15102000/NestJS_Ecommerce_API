# Hướng Dẫn Tích Hợp Mux vào NestJS - Từ Setup Dashboard Đến Implementation

## Mục Lục

1. [Tổng Quan Về Mux](#1-tổng-quan-về-mux)
2. [Setup Mux Dashboard](#2-setup-mux-dashboard)
3. [Hiểu Về Mux API Endpoints](#3-hiểu-về-mux-api-endpoints)
4. [Tạo Dynamic Module cho NestJS](#4-tạo-dynamic-module-cho-nestjs)
5. [Implementation Guide](#5-implementation-guide)
6. [Testing và Best Practices](#6-testing-và-best-practices)
7. [Troubleshooting](#7-troubleshooting)

## 1. Tổng Quan Về Mux

### Mux là gì?

Mux là một platform video infrastructure cung cấp APIs để:

- **Video Encoding & Streaming**: Upload, encode và stream video với chất lượng cao
- **Live Streaming**: Tạo và quản lý livestream
- **Video Analytics**: Thu thập dữ liệu về video performance
- **Direct Uploads**: Upload trực tiếp từ client/browser
- **Playback Control**: Quản lý quyền truy cập video (public/signed URLs)

### Key Concepts

#### 1. **Assets**

- Là video files được upload và xử lý bởi Mux
- Mỗi asset có unique ID (format: `asset_id`)
- Trạng thái: `preparing` → `ready` → `errored`

#### 2. **Playback IDs**

- Unique identifier để stream video
- Có thể là `public` (ai cũng xem được) hoặc `signed` (cần token)
- Format URL: `https://stream.mux.com/{playback_id}.m3u8`

#### 3. **Direct Uploads**

- Cho phép upload trực tiếp từ client/browser
- Tạo signed URL để upload an toàn
- Auto create asset sau khi upload xong

#### 4. **Tracks**

- Subtitle, captions, audio tracks
- Support multiple languages
- Auto-generated subtitles với AI

## 2. Setup Mux Dashboard

### Bước 1: Tạo Mux Account

1. **Truy cập trang đăng ký**

   ```
   https://mux.com/
   ```

2. **Click "Start building for free"**
3. **Điền thông tin đăng ký:**
   - Business email
   - Company name
   - Full name
   - Password

4. **Verify email** được gửi đến inbox

5. **Complete profile setup:**
   - Company size
   - Use case (Video streaming, Live streaming, etc.)
   - Technical role

### Bước 2: Tạo Environment

1. **Login vào Dashboard**
2. **Navigate to Environments:**

   ```
   Dashboard → Settings → Environments
   ```

3. **Tạo environments:**

   ```
   Development (cho dev/test)
   Staging (cho UAT)
   Production (cho live)
   ```

4. **Chọn environment hiện tại** ở header dashboard

### Bước 3: Lấy API Credentials

#### 3.1 Tạo Access Token

1. **Navigate to API Access:**

   ```
   Dashboard → Settings → API Access Tokens
   ```

2. **Click "Generate new token"**

3. **Cấu hình token:**

   ```
   Name: NestJS-Backend-{Environment}
   Environment: Development/Staging/Production
   Permissions:
   ✅ Mux Video (Full Access)
   ✅ Mux Data (Read Access)
   ✅ System (Read Access)
   ```

4. **Copy credentials:**

   ```json
   {
     "TOKEN_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
     "TOKEN_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```

   ⚠️ **QUAN TRỌNG**: Copy ngay vì chỉ hiển thị 1 lần!

#### 3.2 Setup Webhook (Optional)

1. **Navigate to Webhooks:**

   ```
   Dashboard → Settings → Webhooks
   ```

2. **Create webhook endpoint:**

   ```
   URL: https://your-api.domain.com/webhooks/mux
   Events:
   ✅ video.asset.created
   ✅ video.asset.ready
   ✅ video.asset.errored
   ✅ video.asset.deleted
   ✅ video.upload.asset_created
   ✅ video.upload.cancelled
   ✅ video.upload.errored
   ```

3. **Copy Signing Secret:**
   ```
   SIGNING_SECRET: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Bước 4: Configure Upload Settings

1. **Navigate to Direct Uploads:**

   ```
   Dashboard → Settings → Upload
   ```

2. **Configure CORS domains:**

   ```
   Development: http://localhost:3000, http://localhost:3001
   Staging: https://staging.yourdomain.com
   Production: https://yourdomain.com
   ```

3. **Default Asset Settings:**
   ```json
   {
     "playback_policy": ["public"],
     "video_quality": "plus",
     "mp4_support": "standard",
     "normalize_audio": true
   }
   ```

### Bước 5: Test API Connection

1. **Test với cURL:**

   ```bash
   curl --request GET \
     --url https://api.mux.com/video/v1/assets \
     --header 'accept: application/json' \
     --user 'TOKEN_ID:TOKEN_SECRET'
   ```

2. **Expected response:**
   ```json
   {
     "data": [],
     "total_row_count": 0,
     "timeframe": [...]
   }
   ```

## 3. Hiểu Về Mux API Endpoints

### 3.1 Assets APIs

#### **Create Asset** - `POST /video/v1/assets`

**Công dụng**: Tạo video asset mới từ URL hoặc upload

```javascript
// Use case: User upload video từ URL có sẵn
const asset = await muxService.createAsset({
  input: 'https://example.com/video.mp4',
  playback_policy: ['public'],
  video_quality: 'plus',
})
```

#### **List Assets** - `GET /video/v1/assets`

**Công dụng**: Lấy danh sách tất cả video assets

```javascript
// Use case: Admin page hiển thị all videos
const assets = await muxService.listAssets({
  limit: 25,
  page: 1,
})
```

#### **Get Asset** - `GET /video/v1/assets/{ASSET_ID}`

**Công dụng**: Lấy thông tin chi tiết 1 asset

```javascript
// Use case: Hiển thị video detail page
const asset = await muxService.getAsset('asset_id')
console.log(asset.status) // preparing/ready/errored
```

#### **Update Asset** - `PATCH /video/v1/assets/{ASSET_ID}`

**Công dụng**: Cập nhật metadata, settings của asset

```javascript
// Use case: User update video title/description
await muxService.updateAsset('asset_id', {
  metadata: {
    title: 'New Title',
    description: 'Updated description',
  },
})
```

#### **Delete Asset** - `DELETE /video/v1/assets/{ASSET_ID}`

**Công dụng**: Xóa asset vĩnh viễn (không thể khôi phục)

```javascript
// Use case: Admin delete inappropriate content
await muxService.deleteAsset('asset_id')
```

#### **Get Asset Input Info** - `GET /video/v1/assets/{ASSET_ID}/input-info`

**Công dụng**: Xem thông tin file gốc (resolution, format, duration...)

```javascript
// Use case: Display video technical specs
const inputInfo = await muxService.getAssetInputInfo('asset_id')
console.log(inputInfo[0].file.tracks) // video/audio tracks info
```

### 3.2 Playback IDs APIs

#### **Create Playback ID** - `POST /video/v1/assets/{ASSET_ID}/playback-ids`

**Công dụng**: Tạo URL để stream video (public hoặc signed)

```javascript
// Use case: Tạo private video cần token để xem
const playbackId = await muxService.createPlaybackId('asset_id', {
  policy: 'signed',
})
```

#### **Get Playback ID** - `GET /video/v1/assets/{ASSET_ID}/playback-ids/{PLAYBACK_ID}`

**Công dụng**: Lấy thông tin playback ID

```javascript
// Use case: Check playback policy setting
const playbackId = await muxService.getPlaybackId('asset_id', 'playback_id')
```

#### **Delete Playback ID** - `DELETE /video/v1/assets/{ASSET_ID}/playback-ids/{PLAYBACK_ID}`

**Công dụng**: Xóa playback ID (revoke access)

```javascript
// Use case: Revoke access to premium video
await muxService.deletePlaybackId('asset_id', 'playback_id')
```

### 3.3 Direct Upload APIs

#### **Create Upload URL** - `POST /video/v1/uploads`

**Công dụng**: Tạo signed URL để client upload trực tiếp

```javascript
// Use case: User upload video từ mobile/web app
const upload = await muxService.createDirectUpload({
  cors_origin: 'https://app.yourdomain.com',
  timeout: 3600, // 1 hour
  new_asset_settings: {
    playback_policy: ['public'],
    video_quality: 'plus',
  },
})
// Returns: { url: 'signed-upload-url', id: 'upload_id' }
```

#### **List Uploads** - `GET /video/v1/uploads`

**Công dụng**: Xem tất cả upload sessions

```javascript
// Use case: Admin monitor upload activities
const uploads = await muxService.listDirectUploads({
  limit: 50,
})
```

#### **Get Upload** - `GET /video/v1/uploads/{UPLOAD_ID}`

**Công dụng**: Check trạng thái upload

```javascript
// Use case: Polling upload progress
const upload = await muxService.getDirectUpload('upload_id')
console.log(upload.status) // waiting/asset_created/errored
```

#### **Cancel Upload** - `PUT /video/v1/uploads/{UPLOAD_ID}/cancel`

**Công dụng**: Hủy upload đang pending

```javascript
// Use case: User cancel upload
await muxService.cancelDirectUpload('upload_id')
```

### 3.4 Asset Tracks APIs

#### **Create Asset Track** - `POST /video/v1/assets/{ASSET_ID}/tracks`

**Công dụng**: Thêm subtitle/captions vào video

```javascript
// Use case: Add Vietnamese subtitles
await muxService.createAssetTrack('asset_id', {
  url: 'https://example.com/subtitles-vi.srt',
  type: 'text',
  text_type: 'subtitles',
  language_code: 'vi',
  name: 'Vietnamese Subtitles',
})
```

#### **Generate Subtitles** - `POST /video/v1/assets/{ASSET_ID}/tracks/{TRACK_ID}/generate-subtitles`

**Công dụng**: Auto-generate subtitles bằng AI

```javascript
// Use case: Generate English subtitles automatically
await muxService.generateTrackSubtitles('asset_id', 'track_id', {
  generated_subtitles: [
    {
      language_code: 'en',
      name: 'English (Auto-generated)',
    },
  ],
})
```

### 3.5 Static Renditions APIs

#### **Create Static Rendition** - `POST /video/v1/assets/{ASSET_ID}/static-renditions`

**Công dụng**: Tạo MP4 files với resolution cố định để download

```javascript
// Use case: Allow download 1080p MP4 version
await muxService.createStaticRendition('asset_id', {
  resolution: '1080p',
})
```

## 4. Tạo Dynamic Module cho NestJS

### Bước 1: Cấu trúc thư mục

```
libs/nest-mux/
├── src/
│   ├── index.ts
│   ├── nest-mux.module.ts
│   ├── types/
│   │   └── mux.types.ts
│   ├── providers/
│   │   └── mux-client.provider.ts
│   └── services/
│       └── mux.service.ts
├── package.json
└── README.md
```

### Bước 2: Environment Variables

```bash
# .env.development
MUX_TOKEN_ID=your-dev-token-id
MUX_TOKEN_SECRET=your-dev-token-secret
MUX_WEBHOOK_SECRET=whsec_dev_secret
NODE_ENV=development

# .env.production
MUX_TOKEN_ID=your-prod-token-id
MUX_TOKEN_SECRET=your-prod-token-secret
MUX_WEBHOOK_SECRET=whsec_prod_secret
NODE_ENV=production
```

### Bước 3: Install Dependencies

```bash
# Core dependencies
npm install axios @nestjs/common @nestjs/core

# Dev dependencies
npm install --save-dev @types/node typescript
```

### Bước 4: Implementation (Xem chi tiết trong mux-client.md)

```typescript
// app.module.ts
@Module({
  imports: [
    NestMuxModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        tokenId: configService.get<string>('MUX_TOKEN_ID'),
        tokenSecret: configService.get<string>('MUX_TOKEN_SECRET'),
        webhookSecret: configService.get<string>('MUX_WEBHOOK_SECRET'),
        environment: configService.get<string>('NODE_ENV') as any,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## 5. Implementation Guide

### 5.1 Video Upload Flow

```typescript
// video.controller.ts
@Controller('videos')
export class VideoController {
  constructor(private readonly muxService: MuxService) {}

  // Step 1: Create upload URL for client
  @Post('upload-url')
  async createUploadUrl(@Body() body: { corsOrigin: string; videoQuality?: 'basic' | 'plus' | 'premium' }) {
    const upload = await this.muxService.createDirectUpload({
      cors_origin: body.corsOrigin,
      timeout: 3600, // 1 hour
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: body.videoQuality || 'plus',
      },
    })

    return {
      uploadUrl: upload.url,
      uploadId: upload.id,
      timeout: upload.timeout,
    }
  }

  // Step 2: Check upload status
  @Get('upload/:uploadId/status')
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    const upload = await this.muxService.getDirectUpload(uploadId)

    return {
      status: upload.status,
      assetId: upload.asset_id,
      error: upload.error,
    }
  }

  // Step 3: Get video for playback
  @Get(':assetId')
  async getVideo(@Param('assetId') assetId: string) {
    const asset = await this.muxService.getAsset(assetId)

    if (asset.status !== 'ready') {
      throw new BadRequestException('Video is still processing')
    }

    const playbackId = asset.playback_ids?.[0]?.id
    if (!playbackId) {
      throw new NotFoundException('No playback ID found')
    }

    return {
      assetId: asset.id,
      status: asset.status,
      duration: asset.duration,
      aspectRatio: asset.aspect_ratio,
      playbackId: playbackId,
      hlsUrl: this.muxService.generateHlsUrl(playbackId),
      thumbnailUrl: this.muxService.generateThumbnailUrl(playbackId),
      metadata: asset.metadata,
    }
  }
}
```

### 5.2 Client-side Upload Implementation

```typescript
// Frontend: upload.service.ts
import { Injectable } from '@angular/core'
import * as UpChunk from '@mux/upchunk'

@Injectable()
export class UploadService {
  async uploadVideo(file: File): Promise<string> {
    // Step 1: Get upload URL from backend
    const { uploadUrl, uploadId } = await this.http
      .post('/api/videos/upload-url', {
        corsOrigin: window.location.origin,
      })
      .toPromise()

    // Step 2: Upload directly to Mux
    return new Promise((resolve, reject) => {
      const upload = UpChunk.createUpload({
        endpoint: uploadUrl,
        file: file,
        chunkSize: 5120, // 5MB chunks
      })

      upload.on('progress', (progress) => {
        console.log(`Upload progress: ${Math.round(progress.detail)}%`)
      })

      upload.on('success', async () => {
        // Step 3: Poll for asset creation
        const assetId = await this.pollForAsset(uploadId)
        resolve(assetId)
      })

      upload.on('error', (error) => {
        reject(error.detail)
      })
    })
  }

  private async pollForAsset(uploadId: string): Promise<string> {
    const maxAttempts = 30
    let attempts = 0

    while (attempts < maxAttempts) {
      const status = await this.http.get(`/api/videos/upload/${uploadId}/status`).toPromise()

      if (status.assetId) {
        return status.assetId
      }

      if (status.status === 'errored') {
        throw new Error('Upload failed')
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2s
      attempts++
    }

    throw new Error('Timeout waiting for asset creation')
  }
}
```

### 5.3 Webhook Handler

```typescript
// webhook.controller.ts
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly muxService: MuxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('mux')
  @RawBody()
  async handleMuxWebhook(
    @Req() req: Request,
    @Headers('mux-signature') signature: string,
    @Headers('mux-timestamp') timestamp: string,
  ) {
    // Verify webhook signature
    if (!this.verifySignature(req.body, signature, timestamp)) {
      throw new UnauthorizedException('Invalid webhook signature')
    }

    const event = req.body

    switch (event.type) {
      case 'video.asset.ready':
        await this.handleAssetReady(event.data)
        break

      case 'video.asset.errored':
        await this.handleAssetError(event.data)
        break

      case 'video.upload.asset_created':
        await this.handleUploadCompleted(event.data)
        break

      default:
        console.log(`Unhandled event: ${event.type}`)
    }

    return { received: true }
  }

  private async handleAssetReady(assetData: any) {
    this.eventEmitter.emit('mux.asset.ready', {
      assetId: assetData.id,
      playbackIds: assetData.playback_ids,
      duration: assetData.duration,
    })

    // Update database, send notifications, etc.
  }
}
```

## 6. Testing và Best Practices

### 6.1 Unit Testing

```typescript
// mux.service.spec.ts
describe('MuxService', () => {
  let service: MuxService
  let mockClient: jest.Mocked<MuxClientProvider>

  beforeEach(async () => {
    const mockClientProvider = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MuxService,
        {
          provide: NEST_MUX_CONFIG,
          useValue: { tokenId: 'test', tokenSecret: 'test' },
        },
        {
          provide: MuxClientProvider,
          useValue: mockClientProvider,
        },
      ],
    }).compile()

    service = module.get<MuxService>(MuxService)
    mockClient = module.get(MuxClientProvider)
  })

  describe('createAsset', () => {
    it('should create asset successfully', async () => {
      const mockAsset = { id: 'asset_123', status: 'preparing' }
      mockClient.post.mockResolvedValue({ data: { data: mockAsset } })

      const result = await service.createAsset({
        input: 'https://example.com/video.mp4',
      })

      expect(result).toEqual(mockAsset)
      expect(mockClient.post).toHaveBeenCalledWith('/video/v1/assets', {
        input: 'https://example.com/video.mp4',
      })
    })
  })
})
```

### 6.2 Error Handling

```typescript
// Custom error classes
export class MuxApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public muxError?: any
  ) {
    super(message);
  }
}

// In service
async createAsset(data: CreateAssetRequest): Promise<Asset> {
  try {
    const response = await this.muxClient.post('/video/v1/assets', data);
    return response.data.data;
  } catch (error) {
    if (error.response) {
      throw new MuxApiError(
        `Failed to create asset: ${error.response.data.error?.messages?.[0] || error.message}`,
        error.response.status,
        error.response.data
      );
    }
    throw new MuxApiError(`Network error: ${error.message}`, 500);
  }
}
```

### 6.3 Rate Limiting

```typescript
// Implement rate limiting
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

@Controller('videos')
@UseGuards(ThrottlerGuard)
export class VideoController {
  @Post('upload-url')
  @Throttle(10, 60) // 10 requests per minute
  async createUploadUrl() {
    // ...
  }
}
```

### 6.4 Caching

```typescript
// Cache asset metadata
import { CacheInterceptor } from '@nestjs/cache-manager'

@Controller('videos')
@UseInterceptors(CacheInterceptor)
export class VideoController {
  @Get(':assetId')
  @CacheTTL(300) // Cache for 5 minutes
  async getVideo(@Param('assetId') assetId: string) {
    // ...
  }
}
```

## 7. Troubleshooting

### 7.1 Common Issues

#### Issue 1: "Invalid credentials"

```bash
# Check environment variables
echo $MUX_TOKEN_ID
echo $MUX_TOKEN_SECRET

# Test with curl
curl -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  https://api.mux.com/video/v1/assets
```

#### Issue 2: "CORS error on upload"

```typescript
// Make sure CORS origin matches exactly
const upload = await this.muxService.createDirectUpload({
  cors_origin: 'https://yourdomain.com', // Must match exactly
})
```

#### Issue 3: "Asset stuck in preparing"

```typescript
// Check asset input info for errors
const inputInfo = await this.muxService.getAssetInputInfo(assetId)
console.log('Input info:', inputInfo)

// Check for unsupported formats or corrupted files
```

#### Issue 4: "Webhook signature verification failed"

```typescript
// Make sure to use raw body for webhook verification
app.use('/webhooks/mux', express.raw({ type: 'application/json' }))
```

### 7.2 Monitoring

```typescript
// Add metrics tracking
import { Histogram, Counter } from 'prom-client'

const requestDuration = new Histogram({
  name: 'mux_api_request_duration_seconds',
  help: 'Duration of Mux API requests',
  labelNames: ['method', 'endpoint', 'status'],
})

const requestCount = new Counter({
  name: 'mux_api_requests_total',
  help: 'Total Mux API requests',
  labelNames: ['method', 'endpoint', 'status'],
})
```

### 7.3 Health Checks

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(private readonly muxService: MuxService) {}

  @Get('mux')
  async checkMux() {
    const isHealthy = await this.muxService.healthCheck()

    if (!isHealthy) {
      throw new ServiceUnavailableException('Mux API is unavailable')
    }

    return { status: 'ok', service: 'mux' }
  }
}
```

## 8. Security Considerations

### 8.1 Environment Variables

```typescript
// Validate required environment variables on startup
export class ConfigValidation {
  @IsString()
  @IsNotEmpty()
  MUX_TOKEN_ID: string

  @IsString()
  @IsNotEmpty()
  MUX_TOKEN_SECRET: string

  @IsString()
  @IsOptional()
  MUX_WEBHOOK_SECRET?: string
}
```

### 8.2 Signed URLs for Private Content

```typescript
// Generate JWT token for signed playback
import * as JWT from 'jsonwebtoken';

async generateSignedPlaybackToken(playbackId: string, expiresIn = '24h') {
  const payload = {
    sub: playbackId,
    aud: 'v', // video
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };

  return JWT.sign(payload, {
    keyId: this.config.tokenId,
    keySecret: this.config.tokenSecret,
    algorithm: 'RS256',
  });
}
```

### 8.3 Input Validation

```typescript
// Validate upload requests
import { IsUrl, IsEnum, IsOptional } from 'class-validator'

export class CreateAssetDto {
  @IsUrl()
  input: string

  @IsEnum(['public', 'signed'])
  @IsOptional()
  playbackPolicy?: 'public' | 'signed'

  @IsEnum(['basic', 'plus', 'premium'])
  @IsOptional()
  videoQuality?: 'basic' | 'plus' | 'premium'
}
```

Hướng dẫn này cung cấp đầy đủ từ setup dashboard đến implementation hoàn chỉnh. Bạn có thể follow từng bước để tích hợp Mux vào dự án NestJS của mình một cách chuyên nghiệp và an toàn.
