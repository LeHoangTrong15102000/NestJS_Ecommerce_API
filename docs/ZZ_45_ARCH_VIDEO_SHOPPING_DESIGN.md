### Thiết kế Video Mua Hàng (Short/Feed) cho NestJS Ecommerce

Mục tiêu: cho phép người bán đăng video ngắn gắn sản phẩm, người mua xem và thêm vào giỏ trực tiếp; thu thập số liệu view/click để tối ưu đề xuất.

---

## 1) Mục tiêu chức năng

- Upload video ngắn (<= 60s), tạo thumbnail, gắn danh sách `productIds`.
- Hiển thị feed video, thêm vào giỏ từ video.
- Thu thập metrics: `view`, `like`, `share`, `add_to_cart`, `purchase_from_video`.

---

## 2) Mô hình dữ liệu đề xuất

- `VideoPost`:
  - `id`, `sellerId`, `title`, `videoUrl`, `thumbnailUrl`, `productIds[]`, `publishedAt`, `createdAt`.
- `VideoMetric` (append-only hoặc aggregated):
  - `id`, `videoId`, `userId?`, `event` (view/like/share/add_to_cart/purchase), `metadata(jsonb)`, `createdAt`.

Lưu trữ file: S3. Transcoding: job nền (FFmpeg) qua MQ.

---

## 3) Luồng xử lý

- Upload: nhận file → lưu S3 → publish `video.uploaded` → worker transcoding tạo thumbnail → cập nhật `VideoPost`.
- View: client gửi `video.view` (debounce) → đẩy MQ → consumer ghi `VideoMetric` (hoặc Kafka phase 2).
- Add to cart/purchase: bắn sự kiện gắn nguồn `ref=video:<id>` để quy kết hiệu quả.

---

## 4) API tối thiểu

- `POST /videos` (seller): metadata + presigned upload.
- `GET /videos/feed` (buyer): pagination, filter theo quan tâm.
- `POST /videos/:id/metrics` (client fire-and-forget, authenticated optional).

---

## 5) MQ & Analytics

- Phase 1: RabbitMQ queues `media_jobs_q` (transcode), `metrics_q` (gộp, ghi DB định kỳ batch).
- Phase 2: chuyển metrics sang Kafka để scale reprocessing/BI.

---

## 6) Vận hành & tối ưu

- CDN cho video/thumbnail.
- Rate-limit metrics, chống spam.
- Xóa/ẩn video vi phạm, compliance lưu trữ.
