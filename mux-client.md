# Mux Client Integration Guide

## 1. Types Definition

```typescript
// libs/nest-mux/src/types/mux.types.ts
export interface MuxConfig {
  tokenId: string
  tokenSecret: string
  baseUrl?: string
  timeout?: number
}

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

// Asset Types
export interface CreateAssetRequest {
  input?:
    | string
    | Array<{
        url: string
        overlay_settings?: any
        generated_subtitles?: any[]
      }>
  playback_policy?: ('public' | 'signed')[]
  video_quality?: 'basic' | 'plus' | 'premium'
  encoding_tier?: 'baseline' | 'smart'
  mp4_support?: 'none' | 'standard' | 'capped-1080p' | 'audio-only' | 'audio-only-capped-1080p'
  normalize_audio?: boolean
  master_access?: 'none' | 'temporary'
  test?: boolean
  passthrough?: string
  metadata?: Record<string, string>
}

export interface Asset {
  id: string
  status: 'preparing' | 'ready' | 'errored'
  created_at: string
  aspect_ratio?: string
  duration?: number
  max_stored_resolution?: string
  max_stored_frame_rate?: number
  resolution_tier?: string
  encoding_tier?: string
  max_resolution_tier?: string
  video_quality?: string
  playback_ids?: PlaybackId[]
  tracks?: Track[]
  mp4_support?: string
  master_access?: string
  test?: boolean
  passthrough?: string
  metadata?: Record<string, string>
  static_renditions?: {
    status: 'preparing' | 'ready' | 'errored'
    files: StaticRendition[]
  }
  upload_id?: string
  ingest_type?: string
}

export interface PlaybackId {
  id: string
  policy: 'public' | 'signed'
  drm_configuration_id?: string
}

export interface Track {
  type: 'video' | 'audio' | 'text'
  max_width?: number
  max_height?: number
  max_frame_rate?: number
  id: string
  duration?: number
  max_channels?: number
  text_type?: 'subtitles'
  text_source?: 'uploaded' | 'embedded' | 'generated'
  language_code?: string
  name?: string
  closed_captions?: boolean
  passthrough?: string
}

export interface DirectUpload {
  id: string
  timeout: number
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out'
  new_asset_settings?: {
    playback_policy?: ('public' | 'signed')[]
    video_quality?: 'basic' | 'plus' | 'premium'
  }
  asset_id?: string
  error?: {
    type: string
    messages: string[]
  }
  cors_origin?: string
  url: string
  test?: boolean
}

export interface StaticRendition {
  id: string
  type: 'standard'
  ext: string
  status: 'preparing' | 'ready' | 'errored'
  resolution: string
  name: string
}

export const NEST_MUX_CONFIG = Symbol('NEST_MUX_CONFIG')
export const NEST_MUX_CLIENT = Symbol('NEST_MUX_CLIENT')
```

## 2. Mux Client Provider

```typescript
// libs/nest-mux/src/providers/mux-client.provider.ts
import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { MuxConfig } from '../types/mux.types'

@Injectable()
export class MuxClientProvider {
  private readonly logger = new Logger(MuxClientProvider.name)
  private readonly httpClient: AxiosInstance

  constructor(private readonly config: MuxConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.mux.com',
      timeout: config.timeout || 30000,
      auth: {
        username: config.tokenId,
        password: config.tokenSecret,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NestJS-Mux-Client/1.0.0',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making ${config.method?.toUpperCase()} request to ${config.url}`)

        // Mask sensitive data in logs
        const logConfig = { ...config }
        if (logConfig.auth) {
          logConfig.auth = { username: '***', password: '***' }
        }

        return config
      },
      (error) => {
        this.logger.error('Request interceptor error:', error)
        return Promise.reject(error)
      },
    )

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received from ${response.config.url} with status ${response.status}`)
        return response
      },
      (error) => {
        if (error.response) {
          this.logger.error(`HTTP Error: ${error.response.status} - ${error.response.statusText}`, error.response.data)
        } else if (error.request) {
          this.logger.error('Network Error:', error.message)
        } else {
          this.logger.error('Request Setup Error:', error.message)
        }
        return Promise.reject(error)
      },
    )
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.httpClient.get<T>(url, config)
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.httpClient.post<T>(url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.httpClient.put<T>(url, data, config)
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.httpClient.patch<T>(url, data, config)
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.httpClient.delete<T>(url, config)
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/video/v1/assets', {
        params: { limit: 1 },
      })
      return response.status === 200
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return false
    }
  }

  // Get client instance for advanced usage
  getClient(): AxiosInstance {
    return this.httpClient
  }
}
```

## 3. Mux Service

```typescript
// libs/nest-mux/src/services/mux.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import { MuxClientProvider } from '../providers/mux-client.provider'
import {
  CreateAssetRequest,
  Asset,
  PlaybackId,
  DirectUpload,
  Track,
  StaticRendition,
  NEST_MUX_CONFIG,
  MuxModuleOptions,
} from '../types/mux.types'

@Injectable()
export class MuxService {
  private readonly logger = new Logger(MuxService.name)

  constructor(
    @Inject(NEST_MUX_CONFIG) private readonly config: MuxModuleOptions,
    private readonly muxClient: MuxClientProvider,
  ) {}

  // ===============================
  // ASSETS METHODS
  // ===============================

  /**
   * Create a new video asset
   * @param data Asset creation parameters
   * @returns Created asset information
   */
  async createAsset(data: CreateAssetRequest): Promise<Asset> {
    try {
      const response = await this.muxClient.post('/video/v1/assets', data)
      return response.data.data
    } catch (error) {
      this.logger.error('Failed to create asset:', error)
      throw error
    }
  }

  /**
   * List all assets
   * @param options Pagination and filtering options
   * @returns List of assets
   */
  async listAssets(options?: {
    limit?: number
    page?: number
    live_stream_id?: string
    upload_id?: string
  }): Promise<{ data: Asset[] }> {
    try {
      const response = await this.muxClient.get('/video/v1/assets', {
        params: options,
      })
      return response.data
    } catch (error) {
      this.logger.error('Failed to list assets:', error)
      throw error
    }
  }

  /**
   * Get a specific asset by ID
   * @param assetId Asset ID
   * @returns Asset information
   */
  async getAsset(assetId: string): Promise<Asset> {
    try {
      const response = await this.muxClient.get(`/video/v1/assets/${assetId}`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to get asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Update an existing asset
   * @param assetId Asset ID
   * @param data Update parameters
   * @returns Updated asset information
   */
  async updateAsset(
    assetId: string,
    data: {
      passthrough?: string
      metadata?: Record<string, string>
      mp4_support?: string
      master_access?: string
    },
  ): Promise<Asset> {
    try {
      const response = await this.muxClient.patch(`/video/v1/assets/${assetId}`, data)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to update asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Delete an asset
   * @param assetId Asset ID
   */
  async deleteAsset(assetId: string): Promise<void> {
    try {
      await this.muxClient.delete(`/video/v1/assets/${assetId}`)
      this.logger.log(`Asset ${assetId} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Get asset input information
   * @param assetId Asset ID
   * @returns Input information
   */
  async getAssetInputInfo(assetId: string): Promise<any[]> {
    try {
      const response = await this.muxClient.get(`/video/v1/assets/${assetId}/input-info`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to get input info for asset ${assetId}:`, error)
      throw error
    }
  }

  // ===============================
  // PLAYBACK ID METHODS
  // ===============================

  /**
   * Create a playback ID for an asset
   * @param assetId Asset ID
   * @param data Playback ID parameters
   * @returns Created playback ID
   */
  async createPlaybackId(
    assetId: string,
    data: {
      policy: 'public' | 'signed'
      drm_configuration_id?: string
    },
  ): Promise<PlaybackId> {
    try {
      const response = await this.muxClient.post(`/video/v1/assets/${assetId}/playback-ids`, data)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to create playback ID for asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Get a specific playback ID
   * @param assetId Asset ID
   * @param playbackId Playback ID
   * @returns Playback ID information
   */
  async getPlaybackId(assetId: string, playbackId: string): Promise<PlaybackId> {
    try {
      const response = await this.muxClient.get(`/video/v1/assets/${assetId}/playback-ids/${playbackId}`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to get playback ID ${playbackId}:`, error)
      throw error
    }
  }

  /**
   * Delete a playback ID
   * @param assetId Asset ID
   * @param playbackId Playback ID
   */
  async deletePlaybackId(assetId: string, playbackId: string): Promise<void> {
    try {
      await this.muxClient.delete(`/video/v1/assets/${assetId}/playback-ids/${playbackId}`)
      this.logger.log(`Playback ID ${playbackId} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete playback ID ${playbackId}:`, error)
      throw error
    }
  }

  /**
   * Get playback ID information (asset or live stream)
   * @param playbackId Playback ID
   * @returns Playback ID info
   */
  async getPlaybackIdInfo(playbackId: string): Promise<any> {
    try {
      const response = await this.muxClient.get(`/video/v1/playback-ids/${playbackId}`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to get playback ID info for ${playbackId}:`, error)
      throw error
    }
  }

  // ===============================
  // ASSET TRACKS METHODS
  // ===============================

  /**
   * Create an asset track (subtitles, captions, etc.)
   * @param assetId Asset ID
   * @param data Track data
   * @returns Created track
   */
  async createAssetTrack(
    assetId: string,
    data: {
      url: string
      type: 'text' | 'audio'
      text_type?: 'subtitles'
      language_code?: string
      name?: string
      closed_captions?: boolean
      passthrough?: string
    },
  ): Promise<Track> {
    try {
      const response = await this.muxClient.post(`/video/v1/assets/${assetId}/tracks`, data)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to create track for asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Delete an asset track
   * @param assetId Asset ID
   * @param trackId Track ID
   */
  async deleteAssetTrack(assetId: string, trackId: string): Promise<void> {
    try {
      await this.muxClient.delete(`/video/v1/assets/${assetId}/tracks/${trackId}`)
      this.logger.log(`Track ${trackId} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete track ${trackId}:`, error)
      throw error
    }
  }

  /**
   * Generate subtitles for a track
   * @param assetId Asset ID
   * @param trackId Track ID
   * @param data Subtitle generation parameters
   * @returns Updated track
   */
  async generateTrackSubtitles(
    assetId: string,
    trackId: string,
    data: {
      generated_subtitles: Array<{
        language_code: string
        name?: string
        passthrough?: string
      }>
    },
  ): Promise<Track> {
    try {
      const response = await this.muxClient.post(
        `/video/v1/assets/${assetId}/tracks/${trackId}/generate-subtitles`,
        data,
      )
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to generate subtitles for track ${trackId}:`, error)
      throw error
    }
  }

  // ===============================
  // STATIC RENDITIONS METHODS
  // ===============================

  /**
   * Create a static rendition for an asset
   * @param assetId Asset ID
   * @param data Rendition data
   * @returns Created static rendition
   */
  async createStaticRendition(
    assetId: string,
    data: {
      resolution: 'highest' | 'audio-only' | '2160p' | '1440p' | '1080p' | '720p' | '540p' | '360p' | '270p'
      passthrough?: string
    },
  ): Promise<StaticRendition> {
    try {
      const response = await this.muxClient.post(`/video/v1/assets/${assetId}/static-renditions`, data)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to create static rendition for asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Delete a static rendition
   * @param assetId Asset ID
   * @param renditionId Static rendition ID
   */
  async deleteStaticRendition(assetId: string, renditionId: string): Promise<void> {
    try {
      await this.muxClient.delete(`/video/v1/assets/${assetId}/static-renditions/${renditionId}`)
      this.logger.log(`Static rendition ${renditionId} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete static rendition ${renditionId}:`, error)
      throw error
    }
  }

  /**
   * Update master access for an asset
   * @param assetId Asset ID
   * @param masterAccess Master access level
   * @returns Updated asset
   */
  async updateMasterAccess(assetId: string, masterAccess: 'temporary' | 'none'): Promise<Asset> {
    try {
      const response = await this.muxClient.put(`/video/v1/assets/${assetId}/master-access`, {
        master_access: masterAccess,
      })
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to update master access for asset ${assetId}:`, error)
      throw error
    }
  }

  // ===============================
  // DIRECT UPLOADS METHODS
  // ===============================

  /**
   * Create a direct upload URL
   * @param data Upload parameters
   * @returns Direct upload information
   */
  async createDirectUpload(data?: {
    timeout?: number
    cors_origin?: string
    new_asset_settings?: {
      playback_policy?: ('public' | 'signed')[]
      video_quality?: 'basic' | 'plus' | 'premium'
    }
    test?: boolean
  }): Promise<DirectUpload> {
    try {
      const response = await this.muxClient.post('/video/v1/uploads', data)
      return response.data.data
    } catch (error) {
      this.logger.error('Failed to create direct upload:', error)
      throw error
    }
  }

  /**
   * List direct uploads
   * @param options Pagination options
   * @returns List of uploads
   */
  async listDirectUploads(options?: { limit?: number; page?: number }): Promise<{ data: DirectUpload[] }> {
    try {
      const response = await this.muxClient.get('/video/v1/uploads', {
        params: options,
      })
      return response.data
    } catch (error) {
      this.logger.error('Failed to list direct uploads:', error)
      throw error
    }
  }

  /**
   * Get a specific direct upload
   * @param uploadId Upload ID
   * @returns Upload information
   */
  async getDirectUpload(uploadId: string): Promise<DirectUpload> {
    try {
      const response = await this.muxClient.get(`/video/v1/uploads/${uploadId}`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to get direct upload ${uploadId}:`, error)
      throw error
    }
  }

  /**
   * Cancel a direct upload
   * @param uploadId Upload ID
   * @returns Updated upload information
   */
  async cancelDirectUpload(uploadId: string): Promise<DirectUpload> {
    try {
      const response = await this.muxClient.put(`/video/v1/uploads/${uploadId}/cancel`)
      return response.data.data
    } catch (error) {
      this.logger.error(`Failed to cancel direct upload ${uploadId}:`, error)
      throw error
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Generate HLS playback URL
   * @param playbackId Playback ID
   * @param token Optional JWT token for signed playback
   * @returns HLS URL
   */
  generateHlsUrl(playbackId: string, token?: string): string {
    const baseUrl = 'https://stream.mux.com'
    const tokenParam = token ? `?token=${token}` : ''
    return `${baseUrl}/${playbackId}.m3u8${tokenParam}`
  }

  /**
   * Generate thumbnail URL
   * @param playbackId Playback ID
   * @param options Thumbnail options
   * @returns Thumbnail URL
   */
  generateThumbnailUrl(
    playbackId: string,
    options?: {
      time?: number
      width?: number
      height?: number
      fit_mode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad'
      rotate?: 0 | 90 | 180 | 270
    },
  ): string {
    const baseUrl = 'https://image.mux.com'
    const params = new URLSearchParams()

    if (options?.time !== undefined) params.append('time', options.time.toString())
    if (options?.width) params.append('width', options.width.toString())
    if (options?.height) params.append('height', options.height.toString())
    if (options?.fit_mode) params.append('fit_mode', options.fit_mode)
    if (options?.rotate) params.append('rotate', options.rotate.toString())

    const queryString = params.toString()
    return `${baseUrl}/${playbackId}/thumbnail.jpg${queryString ? '?' + queryString : ''}`
  }

  /**
   * Generate animated GIF URL
   * @param playbackId Playback ID
   * @param options GIF options
   * @returns Animated GIF URL
   */
  generateGifUrl(
    playbackId: string,
    options?: {
      start?: number
      end?: number
      width?: number
      height?: number
      fps?: number
    },
  ): string {
    const baseUrl = 'https://image.mux.com'
    const params = new URLSearchParams()

    if (options?.start !== undefined) params.append('start', options.start.toString())
    if (options?.end !== undefined) params.append('end', options.end.toString())
    if (options?.width) params.append('width', options.width.toString())
    if (options?.height) params.append('height', options.height.toString())
    if (options?.fps) params.append('fps', options.fps.toString())

    const queryString = params.toString()
    return `${baseUrl}/${playbackId}/animated.gif${queryString ? '?' + queryString : ''}`
  }

  /**
   * Health check
   * @returns Whether the Mux API is accessible
   */
  async healthCheck(): Promise<boolean> {
    return this.muxClient.healthCheck()
  }
}
```

## 4. Dynamic Module Implementation

```typescript
// libs/nest-mux/src/nest-mux.module.ts
import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { MuxClientProvider } from './providers/mux-client.provider'
import { MuxService } from './services/mux.service'
import { MuxModuleOptions, MuxModuleAsyncOptions, NEST_MUX_CONFIG, NEST_MUX_CLIENT } from './types/mux.types'

@Global()
@Module({})
export class NestMuxModule {
  static forRoot(options: MuxModuleOptions): DynamicModule {
    const configProvider: Provider = {
      provide: NEST_MUX_CONFIG,
      useValue: options,
    }

    const clientProvider: Provider = {
      provide: NEST_MUX_CLIENT,
      useFactory: (config: MuxModuleOptions) => {
        return new MuxClientProvider({
          tokenId: config.tokenId,
          tokenSecret: config.tokenSecret,
          baseUrl: config.options?.baseUrl,
          timeout: config.options?.timeout,
        })
      },
      inject: [NEST_MUX_CONFIG],
    }

    return {
      module: NestMuxModule,
      providers: [
        configProvider,
        clientProvider,
        {
          provide: MuxService,
          useFactory: (config: MuxModuleOptions, client: MuxClientProvider) => {
            return new MuxService(config, client)
          },
          inject: [NEST_MUX_CONFIG, NEST_MUX_CLIENT],
        },
      ],
      exports: [MuxService],
    }
  }

  static forRootAsync(options: MuxModuleAsyncOptions): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: NEST_MUX_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: NEST_MUX_CLIENT,
        useFactory: (config: MuxModuleOptions) => {
          return new MuxClientProvider({
            tokenId: config.tokenId,
            tokenSecret: config.tokenSecret,
            baseUrl: config.options?.baseUrl,
            timeout: config.options?.timeout,
          })
        },
        inject: [NEST_MUX_CONFIG],
      },
      {
        provide: MuxService,
        useFactory: (config: MuxModuleOptions, client: MuxClientProvider) => {
          return new MuxService(config, client)
        },
        inject: [NEST_MUX_CONFIG, NEST_MUX_CLIENT],
      },
    ]

    return {
      module: NestMuxModule,
      imports: options.imports || [],
      providers: [...asyncProviders],
      exports: [MuxService],
    }
  }
}
```

## 5. Module Index Export

```typescript
// libs/nest-mux/src/index.ts
export * from './nest-mux.module'
export * from './services/mux.service'
export * from './providers/mux-client.provider'
export * from './types/mux.types'
```

## 6. Usage in Application

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestMuxModule } from '@aegisol/nest-mux'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Async configuration
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

## 7. Service Usage Example

```typescript
// video.service.ts
import { Injectable } from '@nestjs/common'
import { MuxService } from '@aegisol/nest-mux'

@Injectable()
export class VideoService {
  constructor(private readonly muxService: MuxService) {}

  async uploadVideo(videoUrl: string) {
    // Create asset from URL
    const asset = await this.muxService.createAsset({
      input: videoUrl,
      playback_policy: ['public'],
      video_quality: 'plus',
      mp4_support: 'standard',
    })

    return {
      assetId: asset.id,
      status: asset.status,
      playbackId: asset.playback_ids?.[0]?.id,
      hlsUrl: asset.playback_ids?.[0] ? this.muxService.generateHlsUrl(asset.playback_ids[0].id) : null,
    }
  }

  async createUploadUrl() {
    const upload = await this.muxService.createDirectUpload({
      cors_origin: process.env.CLIENT_URL,
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: 'plus',
      },
      timeout: 3600, // 1 hour
    })

    return {
      uploadUrl: upload.url,
      uploadId: upload.id,
    }
  }
}
```

## 8. Environment Variables

```bash
# .env
MUX_TOKEN_ID=your-token-id
MUX_TOKEN_SECRET=your-token-secret
MUX_WEBHOOK_SECRET=your-webhook-secret
NODE_ENV=development
```

This implementation provides a complete, type-safe wrapper around the Mux Video API with support for all major operations including assets, playback IDs, direct uploads, and utility functions for generating URLs.
