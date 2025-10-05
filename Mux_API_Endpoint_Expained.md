# Giải Thích Chi Tiết Các API Endpoints của Mux

## Mục Lục

1. [Assets APIs](#1-assets-apis)
2. [Playback IDs APIs](#2-playback-ids-apis)
3. [Direct Upload APIs](#3-direct-upload-apis)
4. [Asset Tracks APIs](#4-asset-tracks-apis)
5. [Static Renditions APIs](#5-static-renditions-apis)
6. [Use Cases thực tế](#6-use-cases-thực-tế)
7. [Best Practices](#7-best-practices)

---

## 1. Assets APIs

### 1.1 Create Asset - `POST /video/v1/assets`

**Công dụng:** Tạo một video asset mới từ URL có sẵn hoặc từ direct upload.

**Khi nào sử dụng:**

- User upload video từ URL (YouTube, Vimeo, S3, etc.)
- Tích hợp với existing video storage
- Bulk import videos từ external sources
- Migrate videos từ platform khác

**Ví dụ thực tế:**

```typescript
// User paste YouTube URL để convert sang Mux
const asset = await muxService.createAsset({
  input: 'https://youtube.com/watch?v=abc123',
  playback_policy: ['public'],
  video_quality: 'plus',
  mp4_support: 'standard',
  metadata: {
    title: 'Product Demo Video',
    category: 'marketing',
    uploaded_by: 'john@company.com',
  },
})

// Business use case: E-learning platform import video từ CDN
const learningAsset = await muxService.createAsset({
  input: 'https://cdn.company.com/courses/lesson-01.mp4',
  playback_policy: ['signed'], // Private content
  video_quality: 'premium',
  normalize_audio: true, // Better quality cho education
  passthrough: JSON.stringify({
    course_id: 'course_123',
    lesson_id: 'lesson_01',
    student_tier: 'premium',
  }),
})
```

**Response quan trọng:**

- `id`: Asset ID để reference sau này
- `status`: `preparing` → `ready` → `errored`
- `playback_ids`: Array chứa playback URLs
- `duration`: Video length (seconds)
- `tracks`: Video/audio tracks info

---

### 1.2 List Assets - `GET /video/v1/assets`

**Công dụng:** Lấy danh sách tất cả video assets với pagination và filtering.

**Khi nào sử dụng:**

- Admin dashboard hiển thị all videos
- User profile page (videos của user đó)
- Content management system
- Analytics và reporting
- Bulk operations (delete, update, etc.)

**Filtering options:**

```typescript
// Admin view: All videos in system
const allAssets = await muxService.listAssets({
  limit: 50,
  page: 1,
})

// Filter by upload method
const directUploads = await muxService.listAssets({
  upload_id: 'upload_123', // Only from specific upload
  limit: 25,
})

// Filter by live stream
const liveStreamAssets = await muxService.listAssets({
  live_stream_id: 'stream_456', // Only from specific live stream
})
```

**Business cases:**

- **E-commerce**: Show all product videos
- **Education**: List course videos by category
- **Social media**: User's uploaded videos
- **Corporate**: Training videos library

---

### 1.3 Retrieve Asset - `GET /video/v1/assets/{ASSET_ID}`

**Công dụng:** Lấy thông tin chi tiết của một video asset cụ thể.

**Khi nào sử dụng:**

- Video player page - cần playback info
- Video details/edit page
- Check processing status
- Get metadata và technical specs
- Generate playback URLs

**Thông tin quan trọng từ response:**

```typescript
const asset = await muxService.getAsset('asset_123')

// Check if ready for playback
if (asset.status === 'ready') {
  const playbackId = asset.playback_ids[0].id
  const hlsUrl = muxService.generateHlsUrl(playbackId)

  // Display video player with:
  console.log({
    duration: asset.duration, // Video length
    aspectRatio: asset.aspect_ratio, // 16:9, 4:3, etc.
    resolution: asset.max_stored_resolution, // HD, FHD, UHD
    playbackUrl: hlsUrl,
    thumbnailUrl: muxService.generateThumbnailUrl(playbackId),
  })
}

// Check tracks for subtitles/captions
const hasSubtitles = asset.tracks?.some((track) => track.type === 'text' && track.text_type === 'subtitles')
```

---

### 1.4 Update Asset - `PATCH /video/v1/assets/{ASSET_ID}`

**Công dụng:** Cập nhật metadata và settings của asset.

**Khi nào sử dụng:**

- User edit video title/description
- Change privacy settings
- Update categories/tags
- Modify MP4 download permissions
- Change master access

**Examples:**

```typescript
// User updates video info
await muxService.updateAsset('asset_123', {
  metadata: {
    title: 'Updated Video Title',
    description: 'New description',
    tags: 'tutorial,education,webinar',
  },
})

// Admin enables MP4 downloads
await muxService.updateAsset('asset_123', {
  mp4_support: 'standard',
})

// Change to private content
await muxService.updateAsset('asset_123', {
  master_access: 'temporary', // Enable download for 24h
})
```

---

### 1.5 Delete Asset - `DELETE /video/v1/assets/{ASSET_ID}`

**Công dụng:** Xóa asset vĩnh viễn (không thể khôi phục).

**⚠️ CẢNH BÁO:** Thao tác này không thể hoàn tác!

**Khi nào sử dụng:**

- User delete their own videos
- Admin remove inappropriate content
- Cleanup old/unused videos
- GDPR compliance (user data deletion)
- Storage optimization

**Best practices:**

```typescript
// Always confirm before deletion
async deleteVideoWithConfirmation(assetId: string, userId: string) {
  // 1. Check ownership
  const asset = await this.getAssetWithOwnership(assetId, userId);
  if (!asset.canDelete) {
    throw new ForbiddenException('Cannot delete this video');
  }

  // 2. Soft delete first (mark as deleted)
  await this.markAssetAsDeleted(assetId);

  // 3. Schedule actual deletion (after 30 days)
  await this.scheduleAssetDeletion(assetId, 30);

  // 4. Only delete from Mux when really needed
  // await muxService.deleteAsset(assetId);
}
```

---

### 1.6 Retrieve Asset Input Info - `GET /video/v1/assets/{ASSET_ID}/input-info`

**Công dụng:** Xem thông tin kỹ thuật của file video gốc.

**Khi nào sử dụng:**

- Debug video processing issues
- Display technical specs cho users
- Quality assurance checks
- Analyze video characteristics
- Troubleshooting encoding problems

**Thông tin có thể lấy:**

```typescript
const inputInfo = await muxService.getAssetInputInfo('asset_123')

// File info
console.log({
  container: inputInfo[0].file.container_format, // mp4, mov, avi
  originalSize: inputInfo[0].settings.url, // Original file URL
})

// Video track info
const videoTrack = inputInfo[0].file.tracks.find((t) => t.type === 'video')
console.log({
  originalWidth: videoTrack.width,
  originalHeight: videoTrack.height,
  originalFrameRate: videoTrack.frame_rate,
  encoding: videoTrack.encoding, // h264, hevc, etc.
})

// Audio track info
const audioTrack = inputInfo[0].file.tracks.find((t) => t.type === 'audio')
console.log({
  sampleRate: audioTrack.sample_rate,
  channels: audioTrack.channels,
  audioEncoding: audioTrack.encoding,
})
```

**Use cases:**

- **Video analytics**: Show original vs processed quality
- **Debugging**: Why video failed to process
- **Quality control**: Verify input meets requirements
- **User feedback**: "Your video was processed from 4K to 1080p"

---

## 2. Playback IDs APIs

### 2.1 Create Playback ID - `POST /video/v1/assets/{ASSET_ID}/playback-ids`

**Công dụng:** Tạo URL để stream video với policy khác nhau.

**Khi nào sử dụng:**

- Tạo private video (signed URLs)
- Multiple access levels cho same video
- Separate playback for different user tiers
- DRM protected content

**Public vs Signed:**

```typescript
// Public playback - anyone can watch
const publicPlayback = await muxService.createPlaybackId('asset_123', {
  policy: 'public',
})
// URL: https://stream.mux.com/{playback_id}.m3u8

// Signed playback - need token to watch
const privatePlayback = await muxService.createPlaybackId('asset_123', {
  policy: 'signed',
  drm_configuration_id: 'drm_config_123', // Optional DRM
})
// URL: https://stream.mux.com/{playback_id}.m3u8?token={JWT_TOKEN}
```

**Business use cases:**

- **Education**: Free vs premium course content
- **Corporate**: Internal vs public training videos
- **Media**: Subscription-based content
- **Events**: Paid webinar access

---

### 2.2 Retrieve Playback ID - `GET /video/v1/assets/{ASSET_ID}/playback-ids/{PLAYBACK_ID}`

**Công dụng:** Lấy thông tin về playback ID cụ thể.

**Khi nào sử dụng:**

- Check playback policy
- Verify DRM configuration
- Debug playback issues
- Audit access controls

---

### 2.3 Delete Playback ID - `DELETE /video/v1/assets/{ASSET_ID}/playback-ids/{PLAYBACK_ID}`

**Công dụng:** Xóa playback ID (revoke access).

**Khi nào sử dụng:**

- User subscription expired
- Revoke access to leaked content
- Change from public to private
- Security incident response

```typescript
// Revoke access when subscription ends
async handleSubscriptionExpired(userId: string) {
  const userAssets = await this.getUserPrivateAssets(userId);

  for (const asset of userAssets) {
    const signedPlaybacks = asset.playback_ids.filter(p => p.policy === 'signed');

    for (const playback of signedPlaybacks) {
      await muxService.deletePlaybackId(asset.id, playback.id);
    }
  }
}
```

---

### 2.4 Retrieve Asset or Live Stream ID - `GET /video/v1/playback-ids/{PLAYBACK_ID}`

**Công dụng:** Reverse lookup - từ playback ID tìm asset hoặc live stream.

**Khi nào sử dụng:**

- Analytics tracking từ player
- Debugging từ playback URL
- Link playback events với content
- Security audit logs

```typescript
// From player analytics event
const playbackInfo = await muxService.getPlaybackIdInfo('playback_123')

console.log({
  type: playbackInfo.object.type, // 'asset' or 'live_stream'
  id: playbackInfo.object.id, // asset_xxx or live_stream_xxx
  policy: playbackInfo.policy, // 'public' or 'signed'
})

// Use case: Track which video was watched
if (playbackInfo.object.type === 'asset') {
  await this.recordVideoView(playbackInfo.object.id, userId)
}
```

---

## 3. Direct Upload APIs

### 3.1 Create Direct Upload URL - `POST /video/v1/uploads`

**Công dụng:** Tạo signed URL để client upload video trực tiếp lên Mux.

**Khi nào sử dụng:**

- User upload từ web/mobile app
- Avoid proxying large files through server
- Better upload performance
- Reduce server bandwidth costs

**Flow hoạt động:**

```typescript
// Step 1: Frontend request upload URL
const uploadInfo = await muxService.createDirectUpload({
  cors_origin: 'https://myapp.com',
  timeout: 3600, // 1 hour
  new_asset_settings: {
    playback_policy: ['public'],
    video_quality: 'plus',
    metadata: {
      uploaded_by: userId,
      upload_source: 'web_app',
    },
  },
})

// Step 2: Return to frontend
return {
  uploadUrl: uploadInfo.url, // Frontend uploads here
  uploadId: uploadInfo.id, // Track upload status
}

// Step 3: Frontend uploads directly to Mux
// Uses @mux/upchunk or similar library
```

**Configuration options:**

```typescript
// Basic upload
const basicUpload = await muxService.createDirectUpload()

// Advanced configuration
const advancedUpload = await muxService.createDirectUpload({
  cors_origin: 'https://app.company.com',
  timeout: 7200, // 2 hours for large files
  new_asset_settings: {
    playback_policy: ['signed'], // Private videos
    video_quality: 'premium', // Best quality
    mp4_support: 'standard', // Enable downloads
    normalize_audio: true, // Audio normalization
    metadata: {
      user_id: 'user_123',
      category: 'education',
      title: 'Lesson 1',
    },
    passthrough: JSON.stringify({
      course_id: 'course_456',
      chapter: 1,
    }),
  },
  test: false, // Production upload
})
```

---

### 3.2 List Direct Uploads - `GET /video/v1/uploads`

**Công dụng:** Lấy danh sách tất cả upload sessions.

**Khi nào sử dụng:**

- Admin monitor upload activity
- User's upload history
- Debug failed uploads
- Analytics về upload patterns
- Cleanup abandoned uploads

```typescript
// Admin dashboard
const recentUploads = await muxService.listDirectUploads({
  limit: 100,
  page: 1,
})

// Group by status for monitoring
const uploadStats = {
  waiting: recentUploads.data.filter((u) => u.status === 'waiting').length,
  completed: recentUploads.data.filter((u) => u.status === 'asset_created').length,
  failed: recentUploads.data.filter((u) => u.status === 'errored').length,
  cancelled: recentUploads.data.filter((u) => u.status === 'cancelled').length,
}
```

---

### 3.3 Get Direct Upload - `GET /video/v1/uploads/{UPLOAD_ID}`

**Công dụng:** Check trạng thái upload cụ thể.

**Khi nào sử dụng:**

- Polling upload progress từ frontend
- Check if upload completed successfully
- Get asset ID sau khi upload xong
- Debug upload issues

**Upload status flow:**

```typescript
// Frontend polling function
async pollUploadStatus(uploadId: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;

  while (attempts < maxAttempts) {
    const upload = await muxService.getDirectUpload(uploadId);

    switch (upload.status) {
      case 'waiting':
        // Still uploading, continue polling
        break;

      case 'asset_created':
        // Success! Return asset ID
        return upload.asset_id;

      case 'errored':
        throw new Error(`Upload failed: ${upload.error?.messages?.join(', ')}`);

      case 'cancelled':
        throw new Error('Upload was cancelled');

      case 'timed_out':
        throw new Error('Upload timed out');

      default:
        throw new Error(`Unknown upload status: ${upload.status}`);
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Upload polling timed out');
}
```

---

### 3.4 Cancel Direct Upload - `PUT /video/v1/uploads/{UPLOAD_ID}/cancel`

**Công dụng:** Hủy upload đang pending.

**Khi nào sử dụng:**

- User cancel upload từ UI
- Cleanup abandoned uploads
- Free up upload quotas
- Handle upload errors

```typescript
// User cancels upload
async cancelUpload(uploadId: string, userId: string) {
  // Verify ownership
  const upload = await muxService.getDirectUpload(uploadId);
  if (upload.metadata?.user_id !== userId) {
    throw new ForbiddenException('Cannot cancel this upload');
  }

  // Only cancel if still in progress
  if (upload.status === 'waiting') {
    await muxService.cancelDirectUpload(uploadId);

    // Cleanup local records
    await this.removeUploadRecord(uploadId);
  }
}

// Cleanup cron job for abandoned uploads
@Cron('0 */6 * * *') // Every 6 hours
async cleanupAbandonedUploads() {
  const oldUploads = await muxService.listDirectUploads();

  const abandonedUploads = oldUploads.data.filter(upload => {
    const uploadAge = Date.now() - new Date(upload.created_at).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return upload.status === 'waiting' && uploadAge > maxAge;
  });

  for (const upload of abandonedUploads) {
    await muxService.cancelDirectUpload(upload.id);
  }
}
```

---

## 4. Asset Tracks APIs

### 4.1 Create Asset Track - `POST /video/v1/assets/{ASSET_ID}/tracks`

**Công dụng:** Thêm subtitle, captions, hoặc alternative audio tracks.

**Khi nào sử dụng:**

- Add subtitles cho accessibility
- Multiple language support
- Closed captions compliance
- Alternative audio tracks
- Enhanced user experience

**Examples:**

```typescript
// Add Vietnamese subtitles
const viSubtitles = await muxService.createAssetTrack('asset_123', {
  url: 'https://cdn.company.com/subtitles/video_vi.srt',
  type: 'text',
  text_type: 'subtitles',
  language_code: 'vi', // BCP 47 code
  name: 'Tiếng Việt',
  closed_captions: false,
})

// Add English closed captions (for hearing impaired)
const enCaptions = await muxService.createAssetTrack('asset_123', {
  url: 'https://cdn.company.com/captions/video_en.srt',
  type: 'text',
  text_type: 'subtitles',
  language_code: 'en-US',
  name: 'English (Closed Captions)',
  closed_captions: true, // Includes sound effects, music, etc.
})

// Add alternative audio track (commentary, different language)
const audioTrack = await muxService.createAssetTrack('asset_123', {
  url: 'https://cdn.company.com/audio/commentary.mp3',
  type: 'audio',
  language_code: 'en',
  name: 'Director Commentary',
  passthrough: 'audio_type:commentary',
})
```

**Business use cases:**

- **Education**: Multi-language course content
- **Corporate**: Compliance với accessibility laws
- **Entertainment**: Multiple audio tracks, subtitles
- **Global content**: Localization support

---

### 4.2 Delete Asset Track - `DELETE /video/v1/assets/{ASSET_ID}/tracks/{TRACK_ID}`

**Công dụng:** Xóa track không cần thiết.

**Khi nào sử dụng:**

- Remove poor quality subtitles
- Delete wrong language tracks
- Cleanup unused tracks
- Replace with better versions

```typescript
// Replace poor quality subtitles
async updateSubtitles(assetId: string, oldTrackId: string, newSubtitleUrl: string) {
  // 1. Delete old track
  await muxService.deleteAssetTrack(assetId, oldTrackId);

  // 2. Add new track
  await muxService.createAssetTrack(assetId, {
    url: newSubtitleUrl,
    type: 'text',
    text_type: 'subtitles',
    language_code: 'en',
    name: 'English (Updated)'
  });
}
```

---

### 4.3 Generate Track Subtitles - `POST /video/v1/assets/{ASSET_ID}/tracks/{TRACK_ID}/generate-subtitles`

**Công dụng:** Tự động tạo subtitles bằng AI speech recognition.

**Khi nào sử dụng:**

- Automatically generate subtitles
- Bootstrap subtitle creation
- Quick accessibility compliance
- Reduce manual transcription costs

```typescript
// Generate multiple language subtitles
await muxService.generateTrackSubtitles('asset_123', 'audio_track_id', {
  generated_subtitles: [
    {
      language_code: 'en',
      name: 'English (Auto-generated)',
      passthrough: 'auto_generated:true'
    },
    {
      language_code: 'es',
      name: 'Español (Generado automáticamente)',
      passthrough: 'auto_generated:true'
    }
  ]
});

// Generate subtitles cho education platform
async generateSubtitlesForCourse(courseId: string) {
  const courseAssets = await this.getCourseAssets(courseId);

  for (const asset of courseAssets) {
    const audioTrack = asset.tracks.find(t => t.type === 'audio');

    if (audioTrack && !this.hasSubtitles(asset)) {
      await muxService.generateTrackSubtitles(asset.id, audioTrack.id, {
        generated_subtitles: [{
          language_code: 'en',
          name: 'English (Auto-generated)',
          passthrough: JSON.stringify({
            course_id: courseId,
            auto_generated: true,
            confidence_threshold: 0.8
          })
        }]
      });
    }
  }
}
```

**⚠️ Lưu ý về AI subtitles:**

- Quality varies based on audio clarity
- May need human review/editing
- Better for clear speech vs music/effects
- Consider confidence scores
- Test with your specific content type

---

## 5. Static Renditions APIs

### 5.1 Create Static Rendition - `POST /video/v1/assets/{ASSET_ID}/static-renditions`

**Công dụng:** Tạo MP4 files với resolution cố định để download.

**Khi nào sử dụng:**

- Allow video downloads
- Offline viewing capabilities
- Archive/backup purposes
- Integration với external systems
- Better caching strategies

**Resolution options:**

```typescript
// Create downloadable MP4 versions
const renditions = [
  { resolution: '1080p' }, // Full HD
  { resolution: '720p' },  // HD
  { resolution: '480p' },  // SD
  { resolution: 'audio-only' } // Audio podcast version
];

for (const config of renditions) {
  await muxService.createStaticRendition('asset_123', {
    ...config,
    passthrough: `resolution:${config.resolution}`
  });
}

// Business use case: Premium downloads
async enablePremiumDownloads(assetId: string, userTier: string) {
  const resolutions = {
    'basic': ['480p'],
    'premium': ['480p', '720p', '1080p'],
    'enterprise': ['480p', '720p', '1080p', 'highest', 'audio-only']
  };

  const allowedResolutions = resolutions[userTier] || ['480p'];

  for (const resolution of allowedResolutions) {
    await muxService.createStaticRendition(assetId, {
      resolution: resolution as any,
      passthrough: JSON.stringify({
        user_tier: userTier,
        download_enabled: true
      })
    });
  }
}
```

**Use cases:**

- **Education**: Download lectures for offline study
- **Corporate**: Training materials download
- **Media**: Premium subscriber benefits
- **Mobile apps**: Offline video caching

---

### 5.2 Delete Static Rendition - `DELETE /video/v1/assets/{ASSET_ID}/static-renditions/{STATIC_RENDITION_ID}`

**Công dụng:** Xóa static rendition không cần thiết.

**Khi nào sử dụng:**

- User tier downgrade (remove HD downloads)
- Storage optimization
- Policy changes (disable downloads)
- Security (prevent leaks)

```typescript
// Remove downloads when subscription expires
async handleSubscriptionDowngrade(userId: string, fromTier: string, toTier: string) {
  const userAssets = await this.getUserAssets(userId);

  const tierResolutions = {
    'basic': ['480p'],
    'premium': ['480p', '720p', '1080p']
  };

  const removedResolutions = tierResolutions[fromTier].filter(
    res => !tierResolutions[toTier].includes(res)
  );

  for (const asset of userAssets) {
    const renditionsToRemove = asset.static_renditions?.files?.filter(
      rendition => removedResolutions.includes(rendition.resolution)
    );

    for (const rendition of renditionsToRemove || []) {
      await muxService.deleteStaticRendition(asset.id, rendition.id);
    }
  }
}
```

---

### 5.3 Update Master Access - `PUT /video/v1/assets/{ASSET_ID}/master-access`

**Công dụng:** Cho phép access tới master (highest quality) version để download.

**Khi nào sử dụng:**

- Temporary high-quality access
- Content creator downloads
- Archive purposes
- Quality assurance checks

```typescript
// Enable 24h master access for content creator
async grantMasterAccess(assetId: string, creatorId: string) {
  // Enable temporary access
  await muxService.updateMasterAccess(assetId, 'temporary');

  // Schedule automatic revocation after 24h
  setTimeout(async () => {
    await muxService.updateMasterAccess(assetId, 'none');
  }, 24 * 60 * 60 * 1000);

  // Log for audit
  await this.logMasterAccess(assetId, creatorId, 'granted');
}

// Use case: Content review workflow
async enableContentReview(assetId: string) {
  // Grant master access for review
  await muxService.updateMasterAccess(assetId, 'temporary');

  // Notify review team
  await this.notifyReviewers(assetId);

  // Auto-revoke after review period
  await this.scheduleAccessRevocation(assetId, 72); // 72 hours
}
```

---

## 6. Use Cases Thực Tế

### 6.1 E-learning Platform

```typescript
class ElearningVideoService {
  // Student uploads assignment video
  async uploadAssignment(studentId: string, courseId: string, file: File) {
    // 1. Create upload URL
    const upload = await muxService.createDirectUpload({
      cors_origin: 'https://learning.edu',
      new_asset_settings: {
        playback_policy: ['signed'], // Private
        video_quality: 'basic', // Lower cost for assignments
        metadata: {
          student_id: studentId,
          course_id: courseId,
          type: 'assignment',
        },
      },
    })

    return upload
  }

  // Teacher creates course video
  async createCourseVideo(teacherId: string, videoUrl: string) {
    const asset = await muxService.createAsset({
      input: videoUrl,
      playback_policy: ['signed'], // Enrolled students only
      video_quality: 'premium', // Best quality for education
      mp4_support: 'standard', // Enable downloads
      metadata: {
        teacher_id: teacherId,
        type: 'lecture',
        downloadable: true,
      },
    })

    // Auto-generate subtitles for accessibility
    const audioTrack = asset.tracks?.find((t) => t.type === 'audio')
    if (audioTrack) {
      await muxService.generateTrackSubtitles(asset.id, audioTrack.id, {
        generated_subtitles: [
          {
            language_code: 'en',
            name: 'English Subtitles',
          },
        ],
      })
    }

    return asset
  }
}
```

### 6.2 Social Media Platform

```typescript
class SocialVideoService {
  // User uploads public video
  async uploadPublicVideo(userId: string, file: File) {
    const upload = await muxService.createDirectUpload({
      cors_origin: 'https://social.app',
      new_asset_settings: {
        playbook_policy: ['public'], // Anyone can view
        video_quality: 'plus', // Good quality
        normalize_audio: true, // Better social media experience
        metadata: {
          user_id: userId,
          visibility: 'public',
          created_at: new Date().toISOString(),
        },
      },
    })

    return upload
  }

  // Create multiple renditions for different devices
  async optimizeForPlatform(assetId: string) {
    // Mobile-optimized version
    await muxService.createStaticRendition(assetId, {
      resolution: '720p',
      passthrough: 'device:mobile',
    })

    // Desktop version
    await muxService.createStaticRendition(assetId, {
      resolution: '1080p',
      passthrough: 'device:desktop',
    })

    // Generate thumbnail for feed
    const asset = await muxService.getAsset(assetId)
    const playbackId = asset.playback_ids[0].id

    return {
      mobile: muxService.generateHlsUrl(playbackId),
      desktop: muxService.generateHlsUrl(playbackId),
      thumbnail: muxService.generateThumbnailUrl(playbackId, {
        time: 2, // 2 seconds in
        width: 640,
        height: 360,
      }),
    }
  }
}
```

### 6.3 Corporate Training Platform

```typescript
class TrainingVideoService {
  // Upload internal training video
  async uploadTrainingVideo(managerId: string, videoData: any) {
    const asset = await muxService.createAsset({
      input: videoData.url,
      playback_policy: ['signed'], // Internal only
      video_quality: 'premium',
      mp4_support: 'standard', // Allow downloads
      metadata: {
        manager_id: managerId,
        department: videoData.department,
        classification: 'internal',
        mandatory: videoData.mandatory,
      },
    })

    // Add multiple language subtitles
    if (videoData.subtitles) {
      for (const subtitle of videoData.subtitles) {
        await muxService.createAssetTrack(asset.id, {
          url: subtitle.url,
          type: 'text',
          text_type: 'subtitles',
          language_code: subtitle.language,
          name: subtitle.name,
        })
      }
    }

    return asset
  }

  // Employee compliance tracking
  async trackVideoCompletion(assetId: string, employeeId: string, watchTime: number) {
    const asset = await muxService.getAsset(assetId)
    const completionThreshold = (asset.duration || 0) * 0.8 // 80% completion

    if (watchTime >= completionThreshold) {
      await this.markTrainingComplete(employeeId, assetId)

      // Generate completion certificate
      if (asset.metadata?.mandatory === 'true') {
        await this.generateComplianceCertificate(employeeId, assetId)
      }
    }
  }
}
```

---

## 7. Best Practices

### 7.1 Error Handling

```typescript
async createAssetWithRetry(input: CreateAssetRequest, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await muxService.createAsset(input);
    } catch (error) {
      if (error.statusCode === 429) {
        // Rate limited - wait before retry
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (error.statusCode >= 500 && attempt < maxRetries) {
        // Server error - retry
        continue;
      }

      // Client error or final attempt - throw
      throw error;
    }
  }
}
```

### 7.2 Cost Optimization

```typescript
// Optimize costs based on use case
function getOptimalSettings(useCase: string, userTier: string) {
  const settings = {
    // Free tier: Basic quality, public only
    free: {
      video_quality: 'basic',
      playback_policy: ['public'],
      mp4_support: 'none',
      encoding_tier: 'baseline',
    },

    // Premium: Better quality, downloads
    premium: {
      video_quality: 'plus',
      playback_policy: ['signed'],
      mp4_support: 'standard',
      encoding_tier: 'smart',
    },

    // Enterprise: Best quality, all features
    enterprise: {
      video_quality: 'premium',
      playback_policy: ['signed'],
      mp4_support: 'capped-1080p',
      encoding_tier: 'smart',
      normalize_audio: true,
    },
  }

  return settings[userTier] || settings.free
}
```

### 7.3 Security

```typescript
// Generate signed URLs với appropriate expiration
async generateSecurePlaybackUrl(assetId: string, userId: string, duration = 3600) {
  const asset = await muxService.getAsset(assetId);

  // Verify user has access
  if (!await this.userHasAccess(userId, assetId)) {
    throw new ForbiddenException('Access denied');
  }

  const signedPlayback = asset.playback_ids?.find(p => p.policy === 'signed');
  if (!signedPlayback) {
    throw new NotFoundException('No signed playback available');
  }

  // Generate JWT token
  const token = await this.generateJWT(signedPlayback.id, {
    user_id: userId,
    expires_in: duration,
    permissions: await this.getUserPermissions(userId, assetId)
  });

  return muxService.generateHlsUrl(signedPlayback.id, token);
}
```

### 7.4 Monitoring & Analytics

```typescript
// Track API usage và costs
class MuxAnalytics {
  async trackApiCall(endpoint: string, assetId?: string, cost?: number) {
    await this.metrics.increment('mux.api.calls', 1, {
      endpoint,
      asset_id: assetId,
    })

    if (cost) {
      await this.metrics.histogram('mux.api.cost', cost, {
        endpoint,
      })
    }
  }

  async generateUsageReport(startDate: Date, endDate: Date) {
    return {
      totalAssets: await this.countAssets(startDate, endDate),
      totalUploads: await this.countUploads(startDate, endDate),
      totalStreamingMinutes: await this.calculateStreamingTime(startDate, endDate),
      estimatedCost: await this.calculateCosts(startDate, endDate),
    }
  }
}
```

---

Tóm lại, mỗi API endpoint của Mux đều có vai trò cụ thể trong video workflow. Hiểu rõ công dụng và cách sử dụng phù hợp sẽ giúp bạn xây dựng video platform hiệu quả, tiết kiệm chi phí và đáp ứng tốt needs của users.
