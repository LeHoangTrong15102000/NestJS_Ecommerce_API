# Hướng Dẫn Tích Hợp Mux vào NestJS với Dynamic Module Pattern

## Mục Lục

1. [Tổng Quan về Mux](#1-tổng-quan-về-mux)
2. [Setup Mux Dashboard](#2-setup-mux-dashboard)
3. [Cấu Trúc SDK cho NestJS](#3-cấu-trúc-sdk-cho-nestjs)
4. [Implementation Dynamic Module Pattern](#4-implementation-dynamic-module-pattern)
5. [Các Use Cases Thực Tế](#5-các-use-cases-thực-tế)
6. [Testing và Best Practices](#6-testing-và-best-practices)

## 1. Tổng Quan về Mux

### Mux là gì?

Mux là platform xử lý video chuyên nghiệp cung cấp:

- **Video API**: Upload, encode, stream video
- **Live Streaming**: Xử lý livestream
- **Data API**: Analytics và monitoring
- **Player SDK**: Video player tùy chỉnh

### Core Features cần tích hợp:

```
1. Video Upload & Processing
2. Live Streaming
3. Playback URLs Generation
4. Video Analytics
5. Webhooks for Events
```

## 2. Setup Mux Dashboard

### Bước 1: Tạo Mux Account

1. Truy cập [https://www.mux.com](https://www.mux.com)
2. Sign up và verify email
3. Chọn plan phù hợp (có free tier cho development)

### Bước 2: Lấy API Credentials

#### 2.1 Access Token

```bash
Dashboard → Settings → API Access Tokens → Generate new token
```

Bạn sẽ nhận được:

```json
{
```

### 4.8 Export Index File

```typescript
// libs/nest-mux/src/index.ts
export * from './nest-mux.module'
export * from './nest-mux.service'
export * from './services/video.service'
export * from './services/live-stream.service'
export * from './services/data.service'
export * from './services/webhook.service'
export * from './guards/mux-webhook.guard'
export * from './types'
```

## 5. Các Use Cases Thực Tế

### 5.1 Integration vào App Module

```typescript
// apps/your-service/src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestMuxModule } from '@aegisol/nest-mux'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Async configuration với ConfigService
    NestMuxModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        tokenId: configService.get<string>('MUX_TOKEN_ID'),
        tokenSecret: configService.get<string>('MUX_TOKEN_SECRET'),
        webhookSecret: configService.get<string>('MUX_WEBHOOK_SECRET'),
        environment: configService.get<string>('NODE_ENV') as any,
        options: {
          timeout: 30000,
          retryConfig: {
            retries: 3,
            retryDelay: 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 5.2 Video Upload Controller

```typescript
// apps/your-service/src/controllers/video.controller.ts
import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { MuxVideoService, NestMuxService } from '@aegisol/nest-mux'
import { AuthGuard } from '@nestjs/passport'

@Controller('videos')
@UseGuards(AuthGuard('jwt'))
export class VideoController {
  constructor(
    private readonly muxVideoService: MuxVideoService,
    private readonly muxService: NestMuxService,
  ) {}

  // Create upload URL for client
  @Post('upload-url')
  async createUploadUrl(
    @Body() body: { metadata?: Record<string, string>; videoQuality?: 'basic' | 'plus' | 'premium' },
  ) {
    const uploadData = await this.muxVideoService.createUploadUrl({
      corsOrigin: process.env.CLIENT_URL,
      newAssetSettings: {
        playbackPolicy: ['public'],
        videoQuality: body.videoQuality || 'basic',
        mp4Support: 'standard',
        metadata: body.metadata,
        passthrough: JSON.stringify({
          userId: 'user-id', // Get from JWT
          timestamp: Date.now(),
        }),
      },
      timeout: 3600, // 1 hour
    })

    return {
      uploadUrl: uploadData.url,
      uploadId: uploadData.uploadId,
      timeout: uploadData.timeout,
    }
  }

  // Create asset from URL
  @Post('create-from-url')
  async createFromUrl(@Body() body: { url: string; metadata?: Record<string, string> }) {
    const asset = await this.muxVideoService.createAsset({
      url: body.url,
      playbackPolicy: ['public'],
      videoQuality: 'basic',
      metadata: body.metadata,
    })

    return asset
  }

  // Get asset details
  @Get(':assetId')
  async getAsset(@Param('assetId') assetId: string) {
    const asset = await this.muxVideoService.getAsset(assetId)

    // Generate playback URLs
    const playbackId = asset.playbackIds?.[0]?.id
    if (playbackId) {
      const urls = this.muxVideoService.getPlaybackUrl(playbackId)
      return {
        ...asset,
        playbackUrls: urls,
      }
    }

    return asset
  }

  // Get signed playback URL
  @Get(':assetId/playback-url')
  async getPlaybackUrl(@Param('assetId') assetId: string) {
    const asset = await this.muxVideoService.getAsset(assetId)
    const playbackId = asset.playbackIds?.[0]?.id

    if (!playbackId) {
      throw new Error('No playback ID found')
    }

    // For signed playback
    const token = await this.muxService.generatePlaybackToken(playbackId, {
      type: 'video',
      expiration: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    })

    return this.muxVideoService.getPlaybackUrl(playbackId, { token })
  }

  // Delete asset
  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAsset(@Param('assetId') assetId: string) {
    await this.muxVideoService.deleteAsset(assetId)
  }

  // Get upload status
  @Get('upload/:uploadId/status')
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return await this.muxVideoService.getUploadStatus(uploadId)
  }
}
```

### 5.3 Live Stream Controller

```typescript
// apps/your-service/src/controllers/live-stream.controller.ts
import { Controller, Post, Get, Delete, Param, Body, Patch } from '@nestjs/common'
import { MuxLiveStreamService } from '@aegisol/nest-mux'

@Controller('live-streams')
export class LiveStreamController {
  constructor(private readonly liveStreamService: MuxLiveStreamService) {}

  // Create live stream
  @Post()
  async createLiveStream(
    @Body() body: { latencyMode?: 'standard' | 'reduced' | 'low'; metadata?: Record<string, string> },
  ) {
    const stream = await this.liveStreamService.createLiveStream({
      playbackPolicy: ['public'],
      latencyMode: body.latencyMode || 'standard',
      reconnectWindow: 60,
      metadata: body.metadata,
    })

    // Generate playback URL
    const playbackUrl = this.liveStreamService.getPlaybackUrl(stream.playbackIds[0].id)

    return {
      ...stream,
      playbackUrl: playbackUrl.hls,
      rtmpUrl: stream.rtmpUrl,
      streamKey: stream.streamKey,
    }
  }

  // Get live stream
  @Get(':streamId')
  async getLiveStream(@Param('streamId') streamId: string) {
    const stream = await this.liveStreamService.getLiveStream(streamId)

    if (stream.playbackIds?.[0]) {
      const playbackUrl = this.liveStreamService.getPlaybackUrl(stream.playbackIds[0].id)
      return {
        ...stream,
        playbackUrl: playbackUrl.hls,
      }
    }

    return stream
  }

  // Enable/Disable stream
  @Patch(':streamId/:action')
  async toggleStream(@Param('streamId') streamId: string, @Param('action') action: 'enable' | 'disable') {
    return await this.liveStreamService.updateLiveStreamStatus(streamId, action)
  }

  // Reset stream key
  @Post(':streamId/reset-key')
  async resetStreamKey(@Param('streamId') streamId: string) {
    return await this.liveStreamService.resetStreamKey(streamId)
  }

  // Delete live stream
  @Delete(':streamId')
  async deleteLiveStream(@Param('streamId') streamId: string) {
    return await this.liveStreamService.deleteLiveStream(streamId)
  }
}
```

### 5.4 Webhook Controller

```typescript
// apps/your-service/src/controllers/webhook.controller.ts
import { Controller, Post, Body, Headers, UseGuards, RawBodyRequest, Req } from '@nestjs/common'
import { MuxWebhookService, MuxWebhookGuard } from '@aegisol/nest-mux'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: MuxWebhookService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('mux')
  @UseGuards(MuxWebhookGuard)
  async handleMuxWebhook(@Req() req: RawBodyRequest<Request>, @Body() body: any) {
    const event = this.webhookService.parseWebhookEvent(body)

    // Handle different event types
    switch (event.type) {
      case 'video.asset.created':
        await this.handleAssetCreated(event.data)
        break

      case 'video.asset.ready':
        await this.handleAssetReady(event.data)
        break

      case 'video.asset.errored':
        await this.handleAssetError(event.data)
        break

      case 'video.asset.deleted':
        await this.handleAssetDeleted(event.data)
        break

      case 'video.live_stream.created':
        await this.handleLiveStreamCreated(event.data)
        break

      case 'video.live_stream.connected':
        await this.handleLiveStreamConnected(event.data)
        break

      case 'video.live_stream.recording':
        await this.handleLiveStreamRecording(event.data)
        break

      case 'video.live_stream.disconnected':
        await this.handleLiveStreamDisconnected(event.data)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return { received: true }
  }

  private async handleAssetCreated(data: any) {
    // Update database với asset mới
    this.eventEmitter.emit('mux.asset.created', {
      assetId: data.id,
      status: data.status,
      createdAt: data.created_at,
    })
  }

  private async handleAssetReady(data: any) {
    // Asset đã sẵn sàng để phát
    this.eventEmitter.emit('mux.asset.ready', {
      assetId: data.id,
      duration: data.duration,
      resolution: data.max_stored_resolution,
      playbackIds: data.playback_ids,
    })
  }

  private async handleAssetError(data: any) {
    // Xử lý lỗi
    this.eventEmitter.emit('mux.asset.error', {
      assetId: data.id,
      errors: data.errors,
    })
  }

  private async handleAssetDeleted(data: any) {
    // Cleanup database
    this.eventEmitter.emit('mux.asset.deleted', {
      assetId: data.id,
    })
  }

  private async handleLiveStreamCreated(data: any) {
    this.eventEmitter.emit('mux.stream.created', {
      streamId: data.id,
      streamKey: data.stream_key,
    })
  }

  private async handleLiveStreamConnected(data: any) {
    this.eventEmitter.emit('mux.stream.connected', {
      streamId: data.id,
    })
  }

  private async handleLiveStreamRecording(data: any) {
    this.eventEmitter.emit('mux.stream.recording', {
      streamId: data.id,
    })
  }

  private async handleLiveStreamDisconnected(data: any) {
    this.eventEmitter.emit('mux.stream.disconnected', {
      streamId: data.id,
      newAssetIds: data.recent_asset_ids,
    })
  }
}
```

### 5.5 Client-side Upload Implementation

```typescript
// client/hooks/useMuxUpload.ts
import { useState, useCallback } from 'react';
import * as UpChunk from '@mux/upchunk';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (upload: any) => void;
  onError?: (error: Error) => void;
}

export function useMuxUpload(options: UploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(async (file: File, metadata?: Record<string, string>) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Get upload URL from backend
      const response = await fetch('/api/videos/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ metadata }),
      });

      const { uploadUrl, uploadId } = await response.json();

      // Start upload với UpChunk
      const upload = UpChunk.createUpload({
        endpoint: uploadUrl,
        file: file,
        chunkSize: 5120, // 5MB chunks
      });

      upload.on('progress', (progress) => {
        setProgress(progress.detail);
        options.onProgress?.(progress.detail);
      });

      upload.on('success', () => {
        setUploading(false);
        setProgress(100);
        options.onSuccess?.({ uploadId });
      });

      upload.on('error', (error) => {
        setError(error.detail);
        setUploading(false);
        options.onError?.(error.detail);
      });

      return upload;
    } catch (err) {
      setError(err as Error);
      setUploading(false);
      options.onError?.(err as Error);
    }
  }, [options]);

  return {
    upload,
    uploading,
    progress,
    error,
  };
}

// Usage trong React component
function VideoUploadComponent() {
  const { upload, uploading, progress } = useMuxUpload({
    onSuccess: (data) => {
      console.log('Upload complete:', data.uploadId);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      upload(file, {
        title: 'My Video',
        description: 'Video description',
      });
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileSelect} disabled={uploading} />
      {uploading && (
        <div>
          <progress value={progress} max={100} />
          <span>{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
```

### 5.6 Video Player Implementation

```typescript
// client/components/MuxPlayer.tsx
import React from 'react';
import MuxPlayer from '@mux/mux-player-react';

interface VideoPlayerProps {
  playbackId: string;
  token?: string;
  metadata?: {
    video_title?: string;
    viewer_user_id?: string;
  };
}

export function VideoPlayer({ playbackId, token, metadata }: VideoPlayerProps) {
  return (
    <MuxPlayer
      streamType="on-demand"
      playbackId={playbackId}
      tokens={{ playback: token }}
      metadata={metadata}
      autoPlay={false}
      controls
      style={{ width: '100%', maxWidth: '800px' }}
    />
  );
}

// Live stream player
export function LiveStreamPlayer({ playbackId, token }: VideoPlayerProps) {
  return (
    <MuxPlayer
      streamType="live"
      playbackId={playbackId}
      tokens={{ playback: token }}
      autoPlay
      controls
      style={{ width: '100%', maxWidth: '800px' }}
    />
  );
}
```

## 6. Testing và Best Practices

### 6.1 Unit Testing

```typescript
// libs/nest-mux/src/nest-mux.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { NestMuxService } from './nest-mux.service'
import { NEST_MUX_CLIENT, NEST_MUX_CONFIG } from './types'

describe('NestMuxService', () => {
  let service: NestMuxService
  const mockMuxClient = {
    video: {
      assets: {
        create: jest.fn(),
        retrieve: jest.fn(),
        delete: jest.fn(),
      },
      uploads: {
        create: jest.fn(),
      },
    },
  }

  const mockConfig = {
    tokenId: 'test-token-id',
    tokenSecret: 'test-token-secret',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NestMuxService,
        {
          provide: NEST_MUX_CLIENT,
          useValue: mockMuxClient,
        },
        {
          provide: NEST_MUX_CONFIG,
          useValue: mockConfig,
        },
      ],
    }).compile()

    service = module.get<NestMuxService>(NestMuxService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return mux client', () => {
    expect(service.getClient()).toBe(mockMuxClient)
  })

  it('should return config', () => {
    expect(service.getConfig()).toBe(mockConfig)
  })
})
```

### 6.2 Integration Testing

```typescript
// e2e/mux-integration.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Mux Integration (e2e)', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('/videos/upload-url (POST)', () => {
    return request(app.getHttpServer())
      .post('/videos/upload-url')
      .set('Authorization', 'Bearer test-token')
      .send({
        metadata: { title: 'Test Video' },
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('uploadUrl')
        expect(res.body).toHaveProperty('uploadId')
      })
  })
})
```

### 6.3 Environment Variables

```bash
# .env.development
MUX_TOKEN_ID=your-dev-token-id
MUX_TOKEN_SECRET=your-dev-token-secret
MUX_WEBHOOK_SECRET=your-webhook-secret
NODE_ENV=development

# .env.production
MUX_TOKEN_ID=your-prod-token-id
MUX_TOKEN_SECRET=your-prod-token-secret
MUX_WEBHOOK_SECRET=your-prod-webhook-secret
NODE_ENV=production
```

### 6.4 Best Practices

#### 1. **Error Handling**

```typescript
// Wrap Mux operations với try-catch và logging
try {
  const asset = await this.muxVideoService.createAsset(input)
  this.logger.log(`Asset created: ${asset.assetId}`)
  return asset
} catch (error) {
  this.logger.error(`Failed to create asset: ${error.message}`, error.stack)

  // Re-throw với custom error
  throw new BadRequestException('Failed to process video upload')
}
```

#### 2. **Rate Limiting**

```typescript
// Implement rate limiting cho upload URLs
import { ThrottlerGuard } from '@nestjs/throttler'

@Controller('videos')
@UseGuards(ThrottlerGuard)
export class VideoController {
  @Throttle(5, 60) // 5 requests per minute
  @Post('upload-url')
  async createUploadUrl() {
    // ...
  }
}
```

#### 3. **Caching**

```typescript
// Cache asset metadata
import { CacheInterceptor } from '@nestjs/cache-manager'

@Controller('videos')
@UseInterceptors(CacheInterceptor)
export class VideoController {
  @Get(':assetId')
  @CacheTTL(300) // Cache for 5 minutes
  async getAsset(@Param('assetId') assetId: string) {
    // ...
  }
}
```

#### 4. **Security**

```typescript
// Validate upload permissions
@Post('upload-url')
@UseGuards(AuthGuard(), PermissionGuard('video.upload'))
async createUploadUrl(@CurrentUser() user: User) {
  // Check user quota
  const uploadCount = await this.getUploadCount(user.id);
  if (uploadCount >= user.uploadLimit) {
    throw new ForbiddenException('Upload limit reached');
  }

  // Create upload URL với user metadata
  return await this.muxVideoService.createUploadUrl({
    newAssetSettings: {
      metadata: {
        userId: user.id,
        userEmail: user.email,
      },
    },
  });
}
```

#### 5. **Monitoring**

```typescript
// Track metrics với Prometheus
import { PrometheusModule } from '@willsoto/nestjs-prometheus'

@Injectable()
export class MuxMetricsService {
  private uploadCounter: Counter<string>

  constructor() {
    this.uploadCounter = new Counter({
      name: 'mux_uploads_total',
      help: 'Total number of video uploads',
      labelNames: ['status'],
    })
  }

  incrementUpload(status: 'success' | 'failed') {
    this.uploadCounter.inc({ status })
  }
}
```

## 7. Troubleshooting

### Common Issues

#### 1. **CORS Issues**

```typescript
// Configure CORS trong main.ts
app.enableCors({
  origin: process.env.CLIENT_URL,
  credentials: true,
})
```

#### 2. **Large File Uploads**

```typescript
// Increase body size limit
app.use(json({ limit: '50mb' }))
app.use(urlencoded({ extended: true, limit: '50mb' }))
```

#### 3. **Webhook Signature Validation**

```typescript
// Ensure raw body is available
app.use('/webhooks/mux', raw({ type: 'application/json' }))
```

## 8. Resources

- [Mux Documentation](https://docs.mux.com)
- [Mux Node SDK](https://github.com/muxinc/mux-node-sdk)
- [UpChunk](https://github.com/muxinc/upchunk)
- [Mux Player](https://docs.mux.com/guides/video/mux-player)

## Tóm Tắt

Đây là hướng dẫn đầy đủ để tích hợp Mux vào NestJS với Dynamic Module Pattern. Các bước chính:

1. **Setup Dashboard**: Lấy credentials và configure settings
2. **Tạo Dynamic Module**: Implement pattern với forRoot/forRootAsync
3. **Services**: Video, Live Stream, Data, Webhook services
4. **Controllers**: RESTful APIs cho các operations
5. **Client Integration**: Upload và playback
6. **Testing & Best Practices**: Unit tests, security, monitoring

Module này có thể tái sử dụng trong nhiều services và dễ dàng configure cho các môi trường khác nhau."TOKEN_ID": "your-token-id-here",
"TOKEN_SECRET": "your-token-secret-here"
}

````

#### 2.2 Webhook Signing Secret
```bash
Dashboard → Settings → Webhooks → Create new webhook endpoint
````

```json
{
  "WEBHOOK_ENDPOINT": "https://your-api.com/webhooks/mux",
  "SIGNING_SECRET": "whsec_xxxxxxxxxxxxx"
}
```

#### 2.3 Environment Configuration

```bash
Dashboard → Settings → Environments
```

Tạo các environments:

- `development`
- `staging`
- `production`

### Bước 3: Configure Upload Settings

```bash
Dashboard → Settings → Upload → Direct Uploads
```

Cấu hình:

```json
{
  "cors_domains": ["http://localhost:3000", "https://your-domain.com"],
  "new_asset_settings": {
    "playback_policy": ["public"],
    "video_quality": "basic",
    "mp4_support": "standard"
  }
}
```

## 3. Cấu Trúc SDK cho NestJS

### 3.1 Cài đặt Dependencies

```bash
# Core Mux SDK
npm install @mux/mux-node

# Optional - Player SDK
npm install @mux/mux-player-react # nếu dùng React
npm install @mux/mux-player # vanilla JS

# Development
npm install --save-dev @types/node
```

### 3.2 Tạo Module Structure

```
libs/
└── nest-mux/
    ├── src/
    │   ├── index.ts
    │   ├── nest-mux.module.ts
    │   ├── nest-mux.service.ts
    │   ├── types/
    │   │   ├── index.ts
    │   │   ├── mux.types.ts
    │   │   └── webhook.types.ts
    │   ├── services/
    │   │   ├── video.service.ts
    │   │   ├── live-stream.service.ts
    │   │   ├── data.service.ts
    │   │   └── webhook.service.ts
    │   ├── decorators/
    │   │   └── mux-webhook.decorator.ts
    │   └── guards/
    │       └── mux-webhook.guard.ts
    ├── package.json
    └── README.md
```

## 4. Implementation Dynamic Module Pattern

### 4.1 Types Definition

```typescript
// libs/nest-mux/src/types/mux.types.ts
import { ModuleMetadata, Type } from '@nestjs/common'

export const NEST_MUX_CONFIG = Symbol('NEST_MUX_CONFIG')
export const NEST_MUX_CLIENT = Symbol('NEST_MUX_CLIENT')

export interface MuxModuleOptions {
  tokenId: string
  tokenSecret: string
  webhookSecret?: string
  environment?: 'development' | 'staging' | 'production'
  options?: {
    baseUrl?: string
    timeout?: number
    retryConfig?: {
      retries?: number
      retryDelay?: number
    }
  }
}

export interface MuxModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string
  useFactory: (...args: any[]) => Promise<MuxModuleOptions> | MuxModuleOptions
  inject?: any[]
}

export interface MuxVideoOptions {
  playbackPolicy?: ('public' | 'signed')[]
  videoQuality?: 'basic' | 'plus' | 'premium'
  mp4Support?: 'none' | 'standard' | 'audio-only'
  maxResolutionTier?: '720p' | '1080p' | '1440p' | '2160p'
  encodingTier?: 'baseline' | 'smart'
  test?: boolean
}

export interface MuxUploadOptions {
  corsOrigin?: string
  newAssetSettings?: MuxVideoOptions
  timeout?: number
}

export interface MuxLiveStreamOptions {
  playbackPolicy?: ('public' | 'signed')[]
  latencyMode?: 'standard' | 'reduced' | 'low'
  reconnectWindow?: number
  maxContinuousDuration?: number
  simulcastTargets?: Array<{
    url: string
    streamKey: string
  }>
}
```

### 4.2 Main Module Implementation

```typescript
// libs/nest-mux/src/nest-mux.module.ts
import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import Mux from '@mux/mux-node'
import { MuxModuleOptions, MuxModuleAsyncOptions, NEST_MUX_CONFIG, NEST_MUX_CLIENT } from './types'
import { NestMuxService } from './nest-mux.service'
import { MuxVideoService } from './services/video.service'
import { MuxLiveStreamService } from './services/live-stream.service'
import { MuxDataService } from './services/data.service'
import { MuxWebhookService } from './services/webhook.service'

@Global()
@Module({})
export class NestMuxModule {
  static forRoot(options: MuxModuleOptions): DynamicModule {
    const muxProvider: Provider = {
      provide: NEST_MUX_CLIENT,
      useValue: new Mux({
        tokenId: options.tokenId,
        tokenSecret: options.tokenSecret,
        ...(options.options || {}),
      }),
    }

    const configProvider: Provider = {
      provide: NEST_MUX_CONFIG,
      useValue: options,
    }

    return {
      module: NestMuxModule,
      providers: [
        muxProvider,
        configProvider,
        NestMuxService,
        MuxVideoService,
        MuxLiveStreamService,
        MuxDataService,
        MuxWebhookService,
      ],
      exports: [NestMuxService, MuxVideoService, MuxLiveStreamService, MuxDataService, MuxWebhookService],
    }
  }

  static forRootAsync(options: MuxModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options)

    return {
      module: NestMuxModule,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        NestMuxService,
        MuxVideoService,
        MuxLiveStreamService,
        MuxDataService,
        MuxWebhookService,
      ],
      exports: [NestMuxService, MuxVideoService, MuxLiveStreamService, MuxDataService, MuxWebhookService],
    }
  }

  private static createAsyncProviders(options: MuxModuleAsyncOptions): Provider[] {
    return [
      {
        provide: NEST_MUX_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: NEST_MUX_CLIENT,
        useFactory: (config: MuxModuleOptions) => {
          return new Mux({
            tokenId: config.tokenId,
            tokenSecret: config.tokenSecret,
            ...(config.options || {}),
          })
        },
        inject: [NEST_MUX_CONFIG],
      },
    ]
  }
}
```

### 4.3 Core Service Implementation

```typescript
// libs/nest-mux/src/nest-mux.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common'
import Mux from '@mux/mux-node'
import { NEST_MUX_CLIENT, NEST_MUX_CONFIG, MuxModuleOptions } from './types'

@Injectable()
export class NestMuxService {
  private readonly logger = new Logger(NestMuxService.name)

  constructor(
    @Inject(NEST_MUX_CLIENT) private readonly muxClient: Mux,
    @Inject(NEST_MUX_CONFIG) private readonly config: MuxModuleOptions,
  ) {
    this.logger.log('Mux Service initialized successfully')
  }

  getClient(): Mux {
    return this.muxClient
  }

  getConfig(): MuxModuleOptions {
    return this.config
  }

  // Helper method to generate JWT for signed playback
  async generatePlaybackToken(
    playbackId: string,
    options?: {
      type?: 'video' | 'thumbnail' | 'gif' | 'storyboard'
      expiration?: number
    },
  ): Promise<string> {
    const { JWT } = this.muxClient

    const payload = {
      sub: playbackId,
      aud: options?.type || 'video',
      exp: options?.expiration || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    }

    return JWT.sign(payload, {
      keyId: this.config.tokenId,
      keySecret: this.config.tokenSecret,
    })
  }
}
```

### 4.4 Video Service Implementation

```typescript
// libs/nest-mux/src/services/video.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import Mux from '@mux/mux-node'
import { NEST_MUX_CLIENT } from '../types'

@Injectable()
export class MuxVideoService {
  private readonly logger = new Logger(MuxVideoService.name)
  private video: Mux.Video
  private uploads: Mux.DirectUploads

  constructor(@Inject(NEST_MUX_CLIENT) private readonly muxClient: Mux) {
    this.video = muxClient.video
    this.uploads = muxClient.video.uploads
  }

  // Create direct upload URL for client-side uploads
  async createUploadUrl(options?: {
    corsOrigin?: string
    newAssetSettings?: {
      playbackPolicy?: ('public' | 'signed')[]
      videoQuality?: 'basic' | 'plus' | 'premium'
      mp4Support?: 'none' | 'standard'
      passthrough?: string
      metadata?: Record<string, string>
    }
    timeout?: number
  }) {
    try {
      const upload = await this.uploads.create({
        cors_origin: options?.corsOrigin || '*',
        new_asset_settings: {
          playback_policy: options?.newAssetSettings?.playbackPolicy || ['public'],
          video_quality: options?.newAssetSettings?.videoQuality || 'basic',
          mp4_support: options?.newAssetSettings?.mp4Support || 'standard',
          ...(options?.newAssetSettings?.passthrough && {
            passthrough: options.newAssetSettings.passthrough,
          }),
          ...(options?.newAssetSettings?.metadata && {
            metadata: options.newAssetSettings.metadata,
          }),
        },
        ...(options?.timeout && { timeout: options.timeout }),
      })

      this.logger.log(`Created upload URL with ID: ${upload.id}`)

      return {
        uploadId: upload.id,
        url: upload.url,
        timeout: upload.timeout,
        status: upload.status,
        assetId: upload.asset_id,
      }
    } catch (error) {
      this.logger.error(`Failed to create upload URL: ${error.message}`, error.stack)
      throw error
    }
  }

  // Create asset from URL
  async createAsset(input: {
    url: string
    playbackPolicy?: ('public' | 'signed')[]
    videoQuality?: 'basic' | 'plus' | 'premium'
    mp4Support?: 'none' | 'standard'
    metadata?: Record<string, string>
    passthrough?: string
  }) {
    try {
      const asset = await this.video.assets.create({
        input: input.url,
        playback_policy: input.playbackPolicy || ['public'],
        video_quality: input.videoQuality || 'basic',
        mp4_support: input.mp4Support || 'standard',
        ...(input.metadata && { metadata: input.metadata }),
        ...(input.passthrough && { passthrough: input.passthrough }),
      })

      this.logger.log(`Created asset with ID: ${asset.id}`)

      return {
        assetId: asset.id,
        status: asset.status,
        playbackId: asset.playback_ids?.[0]?.id,
        duration: asset.duration,
        aspectRatio: asset.aspect_ratio,
        resolution: asset.max_stored_resolution,
        createdAt: asset.created_at,
      }
    } catch (error) {
      this.logger.error(`Failed to create asset: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get asset details
  async getAsset(assetId: string) {
    try {
      const asset = await this.video.assets.retrieve(assetId)

      return {
        id: asset.id,
        status: asset.status,
        playbackIds: asset.playback_ids,
        duration: asset.duration,
        aspectRatio: asset.aspect_ratio,
        resolution: asset.max_stored_resolution,
        tracks: asset.tracks,
        metadata: asset.metadata,
        createdAt: asset.created_at,
        mp4Support: asset.mp4_support,
      }
    } catch (error) {
      this.logger.error(`Failed to get asset ${assetId}: ${error.message}`, error.stack)
      throw error
    }
  }

  // Update asset
  async updateAsset(
    assetId: string,
    updates: {
      passthrough?: string
      metadata?: Record<string, string>
      mp4Support?: 'none' | 'standard'
    },
  ) {
    try {
      const asset = await this.video.assets.update(assetId, updates)
      this.logger.log(`Updated asset: ${assetId}`)
      return asset
    } catch (error) {
      this.logger.error(`Failed to update asset ${assetId}: ${error.message}`, error.stack)
      throw error
    }
  }

  // Delete asset
  async deleteAsset(assetId: string) {
    try {
      await this.video.assets.delete(assetId)
      this.logger.log(`Deleted asset: ${assetId}`)
      return { success: true, assetId }
    } catch (error) {
      this.logger.error(`Failed to delete asset ${assetId}: ${error.message}`, error.stack)
      throw error
    }
  }

  // Create playback ID for existing asset
  async createPlaybackId(assetId: string, policy: 'public' | 'signed' = 'public') {
    try {
      const playbackId = await this.video.assets.createPlaybackId(assetId, {
        policy,
      })

      this.logger.log(`Created playback ID for asset ${assetId}`)
      return playbackId
    } catch (error) {
      this.logger.error(`Failed to create playback ID: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get upload status
  async getUploadStatus(uploadId: string) {
    try {
      const upload = await this.uploads.retrieve(uploadId)

      return {
        id: upload.id,
        status: upload.status,
        assetId: upload.asset_id,
        error: upload.error,
        url: upload.url,
        timeout: upload.timeout,
      }
    } catch (error) {
      this.logger.error(`Failed to get upload status: ${error.message}`, error.stack)
      throw error
    }
  }

  // Generate thumbnail URL
  generateThumbnailUrl(
    playbackId: string,
    options?: {
      time?: number
      width?: number
      height?: number
      fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad'
      rotate?: 0 | 90 | 180 | 270
    },
  ) {
    const params = new URLSearchParams()

    if (options?.time !== undefined) params.append('time', options.time.toString())
    if (options?.width) params.append('width', options.width.toString())
    if (options?.height) params.append('height', options.height.toString())
    if (options?.fitMode) params.append('fit_mode', options.fitMode)
    if (options?.rotate) params.append('rotate', options.rotate.toString())

    const queryString = params.toString()
    return `https://image.mux.com/${playbackId}/thumbnail.jpg${queryString ? '?' + queryString : ''}`
  }

  // Generate animated GIF URL
  generateGifUrl(
    playbackId: string,
    options?: {
      start?: number
      end?: number
      width?: number
      height?: number
      fps?: number
    },
  ) {
    const params = new URLSearchParams()

    if (options?.start !== undefined) params.append('start', options.start.toString())
    if (options?.end !== undefined) params.append('end', options.end.toString())
    if (options?.width) params.append('width', options.width.toString())
    if (options?.height) params.append('height', options.height.toString())
    if (options?.fps) params.append('fps', options.fps.toString())

    const queryString = params.toString()
    return `https://image.mux.com/${playbackId}/animated.gif${queryString ? '?' + queryString : ''}`
  }

  // Get playback URL
  getPlaybackUrl(
    playbackId: string,
    options?: {
      domain?: string
      token?: string
    },
  ) {
    const baseUrl = options?.domain || 'https://stream.mux.com'
    const tokenParam = options?.token ? `?token=${options.token}` : ''

    return {
      hls: `${baseUrl}/${playbackId}.m3u8${tokenParam}`,
      thumbnail: this.generateThumbnailUrl(playbackId),
      gif: this.generateGifUrl(playbackId),
    }
  }
}
```

### 4.5 Live Stream Service Implementation

```typescript
// libs/nest-mux/src/services/live-stream.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import Mux from '@mux/mux-node'
import { NEST_MUX_CLIENT } from '../types'

@Injectable()
export class MuxLiveStreamService {
  private readonly logger = new Logger(MuxLiveStreamService.name)
  private liveStreams: Mux.LiveStreams

  constructor(@Inject(NEST_MUX_CLIENT) private readonly muxClient: Mux) {
    this.liveStreams = muxClient.video.liveStreams
  }

  // Create live stream
  async createLiveStream(options?: {
    playbackPolicy?: ('public' | 'signed')[]
    latencyMode?: 'standard' | 'reduced' | 'low'
    reconnectWindow?: number
    maxContinuousDuration?: number
    metadata?: Record<string, string>
    passthrough?: string
    simulcastTargets?: Array<{
      url: string
      streamKey: string
    }>
  }) {
    try {
      const liveStream = await this.liveStreams.create({
        playback_policy: options?.playbackPolicy || ['public'],
        latency_mode: options?.latencyMode || 'standard',
        reconnect_window: options?.reconnectWindow || 60,
        ...(options?.maxContinuousDuration && {
          max_continuous_duration: options.maxContinuousDuration,
        }),
        ...(options?.metadata && { metadata: options.metadata }),
        ...(options?.passthrough && { passthrough: options.passthrough }),
        ...(options?.simulcastTargets && {
          simulcast_targets: options.simulcastTargets,
        }),
        new_asset_settings: {
          playback_policy: options?.playbackPolicy || ['public'],
        },
      })

      this.logger.log(`Created live stream with ID: ${liveStream.id}`)

      return {
        id: liveStream.id,
        streamKey: liveStream.stream_key,
        status: liveStream.status,
        playbackIds: liveStream.playback_ids,
        rtmpUrl: `rtmps://global-live.mux.com/live`,
        createdAt: liveStream.created_at,
      }
    } catch (error) {
      this.logger.error(`Failed to create live stream: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get live stream details
  async getLiveStream(liveStreamId: string) {
    try {
      const liveStream = await this.liveStreams.retrieve(liveStreamId)

      return {
        id: liveStream.id,
        streamKey: liveStream.stream_key,
        status: liveStream.status,
        playbackIds: liveStream.playback_ids,
        recentAssetIds: liveStream.recent_asset_ids,
        createdAt: liveStream.created_at,
        latencyMode: liveStream.latency_mode,
        reconnectWindow: liveStream.reconnect_window,
        maxContinuousDuration: liveStream.max_continuous_duration,
      }
    } catch (error) {
      this.logger.error(`Failed to get live stream: ${error.message}`, error.stack)
      throw error
    }
  }

  // Delete live stream
  async deleteLiveStream(liveStreamId: string) {
    try {
      await this.liveStreams.delete(liveStreamId)
      this.logger.log(`Deleted live stream: ${liveStreamId}`)
      return { success: true, liveStreamId }
    } catch (error) {
      this.logger.error(`Failed to delete live stream: ${error.message}`, error.stack)
      throw error
    }
  }

  // Enable/Disable live stream
  async updateLiveStreamStatus(liveStreamId: string, action: 'enable' | 'disable') {
    try {
      if (action === 'disable') {
        await this.liveStreams.disable(liveStreamId)
      } else {
        await this.liveStreams.enable(liveStreamId)
      }

      this.logger.log(`${action}d live stream: ${liveStreamId}`)
      return { success: true, liveStreamId, action }
    } catch (error) {
      this.logger.error(`Failed to ${action} live stream: ${error.message}`, error.stack)
      throw error
    }
  }

  // Reset stream key
  async resetStreamKey(liveStreamId: string) {
    try {
      const liveStream = await this.liveStreams.resetStreamKey(liveStreamId)

      this.logger.log(`Reset stream key for: ${liveStreamId}`)
      return {
        id: liveStream.id,
        newStreamKey: liveStream.stream_key,
      }
    } catch (error) {
      this.logger.error(`Failed to reset stream key: ${error.message}`, error.stack)
      throw error
    }
  }

  // Create simulcast target
  async createSimulcastTarget(
    liveStreamId: string,
    target: {
      url: string
      streamKey: string
      passthrough?: string
    },
  ) {
    try {
      const simulcastTarget = await this.liveStreams.createSimulcastTarget(liveStreamId, {
        url: target.url,
        stream_key: target.streamKey,
        ...(target.passthrough && { passthrough: target.passthrough }),
      })

      this.logger.log(`Created simulcast target for stream: ${liveStreamId}`)
      return simulcastTarget
    } catch (error) {
      this.logger.error(`Failed to create simulcast target: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get playback URL for live stream
  getPlaybackUrl(
    playbackId: string,
    options?: {
      domain?: string
      token?: string
    },
  ) {
    const baseUrl = options?.domain || 'https://stream.mux.com'
    const tokenParam = options?.token ? `?token=${options.token}` : ''

    return {
      hls: `${baseUrl}/${playbackId}.m3u8${tokenParam}`,
    }
  }
}
```

### 4.6 Webhook Service & Guard

```typescript
// libs/nest-mux/src/services/webhook.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import * as crypto from 'crypto'
import { NEST_MUX_CONFIG, MuxModuleOptions } from '../types'

@Injectable()
export class MuxWebhookService {
  private readonly logger = new Logger(MuxWebhookService.name)

  constructor(@Inject(NEST_MUX_CONFIG) private readonly config: MuxModuleOptions) {}

  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.config.webhookSecret) {
      this.logger.warn('Webhook secret not configured')
      return false
    }

    const expectedSignature = this.generateSignature(payload, timestamp, this.config.webhookSecret)

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  private generateSignature(payload: string, timestamp: string, secret: string): string {
    const message = `${timestamp}.${payload}`
    return crypto.createHmac('sha256', secret).update(message).digest('hex')
  }

  parseWebhookEvent(body: any) {
    return {
      type: body.type,
      data: body.data,
      id: body.id,
      createdAt: body.created_at,
      environment: body.environment?.name,
      object: body.object,
    }
  }
}

// libs/nest-mux/src/guards/mux-webhook.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { MuxWebhookService } from '../services/webhook.service'

@Injectable()
export class MuxWebhookGuard implements CanActivate {
  constructor(private readonly webhookService: MuxWebhookService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const signature = request.headers['mux-signature']
    const timestamp = request.headers['mux-timestamp']
    const rawBody = request.rawBody || JSON.stringify(request.body)

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing webhook signature or timestamp')
    }

    const isValid = this.webhookService.verifyWebhookSignature(rawBody, signature, timestamp)

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature')
    }

    return true
  }
}
```

### 4.7 Data/Analytics Service

```typescript
// libs/nest-mux/src/services/data.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import Mux from '@mux/mux-node'
import { NEST_MUX_CLIENT } from '../types'

@Injectable()
export class MuxDataService {
  private readonly logger = new Logger(MuxDataService.name)
  private data: Mux.Data

  constructor(@Inject(NEST_MUX_CLIENT) private readonly muxClient: Mux) {
    this.data = muxClient.data
  }

  // Get video views
  async getVideoViews(options?: { filters?: string[]; timeframe?: [number, number]; page?: number; limit?: number }) {
    try {
      const views = await this.data.videoViews.list({
        ...(options?.filters && { filters: options.filters }),
        ...(options?.timeframe && { timeframe: options.timeframe }),
        ...(options?.page && { page: options.page }),
        ...(options?.limit && { limit: options.limit }),
      })

      return {
        data: views.data,
        totalRows: views.total_row_count,
        timeframe: views.timeframe,
      }
    } catch (error) {
      this.logger.error(`Failed to get video views: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get metrics
  async getMetrics(options: {
    metricId: string
    timeframe?: [number, number]
    filters?: string[]
    dimension?: string
    value?: string
  }) {
    try {
      const metrics = await this.data.metrics.list({
        metric_id: options.metricId,
        ...(options.timeframe && { timeframe: options.timeframe }),
        ...(options.filters && { filters: options.filters }),
        ...(options.dimension && { dimension: options.dimension }),
        ...(options.value && { value: options.value }),
      })

      return metrics
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get real-time metrics
  async getRealTimeMetrics() {
    try {
      const metrics = await this.data.realTime.dimensions()
      return metrics
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics: ${error.message}`, error.stack)
      throw error
    }
  }
}
```
