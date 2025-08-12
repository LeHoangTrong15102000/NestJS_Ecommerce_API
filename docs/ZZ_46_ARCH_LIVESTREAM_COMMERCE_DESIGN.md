### Thiết kế Livestream Commerce (Shopee Live) cho NestJS Ecommerce

Mục tiêu: phát trực tiếp, chat realtime, ghim sản phẩm, flash sale, add-to-cart trực tiếp từ live; thu thập metrics realtime.

---

## 1) Mục tiêu chức năng

- Host tạo phiên live, chọn sản phẩm, giá ưu đãi theo khung giờ.
- Người xem tham gia, chat, bấm mua; cập nhật tồn kho/giá flash theo thời gian thực.
- Thu thập metrics: người xem, peak concurrent, click, add-to-cart, purchase.

---

## 2) Kiến trúc khuyến nghị

- Video ingest & delivery: dùng dịch vụ HLS/LL-HLS có sẵn (Cloudflare Stream, Mux, AWS IVS) để giảm độ phức tạp ban đầu.
- Backend NestJS:
  - WebSocket namespace `/live` cho chat và tín hiệu realtime (pin sản phẩm, cập nhật flash price, tồn kho).
  - REST để quản lý phiên: tạo/kết thúc live, cấu hình flash sale, danh sách sản phẩm pin.
- MQ:
  - `live.metrics` (viewer join/leave, click), `inventory_jobs_q` (reserve/release), `notification_q`.

---

## 3) Mô hình dữ liệu đề xuất

- LiveSession: `id`, `sellerId`, `title`, `status(draft|live|ended)`, `hlsUrl`, `startAt`, `endAt`, `createdAt`.
- LiveProduct: `id`, `liveSessionId`, `productId`, `flashPrice`, `quantityLimit`, `position`, `createdAt`.
- LiveMessage: `id`, `liveSessionId`, `userId`, `content`, `createdAt`.
- LiveMetric: `id`, `liveSessionId`, `userId?`, `event` (join/leave/click/add_to_cart/purchase), `metadata`, `createdAt`.

---

## 4) Đồng bộ tồn kho & flash sale

- Bấm mua từ live: tạo `CartItem`/`Order` với giá từ `LiveProduct.flashPrice` → snapshot trong `ProductSKUSnapshot`.
- Reserve stock qua MQ để chống tranh chấp (race). Khi hết hàng, phát sự kiện WS tới người xem.

---

## 5) Bảo mật & vận hành

- Chống spam chat (rate-limit, moderation, từ khóa cấm).
- Chống bot view (token, TTL, device fingerprint cơ bản).
- Scale WS bằng Redis adapter; cân nhắc sharding theo `liveSessionId`.
