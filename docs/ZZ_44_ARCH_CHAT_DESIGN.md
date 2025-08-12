### Thiết kế Chat Buyer–Seller cho NestJS Ecommerce

Định nghĩa kiến trúc chat realtime tương thích với schema hiện tại, mở rộng dần từ P2P đơn giản tới thread/hộp thoại theo đơn hàng, hỗ trợ offline notification, và có lộ trình mở rộng cho live & video shopping.

---

## 1) Mục tiêu chức năng

- Realtime 1-1 giữa người mua và người bán (seller account).
- Lưu lịch sử chat, trạng thái đã đọc, typing, đính kèm ảnh.
- Push thông báo khi offline, chống spam, rate-limit.
- Tích hợp vào detail sản phẩm, trang đơn hàng, và Seller Center.

---

## 2) Mô hình dữ liệu đề xuất

- `ChatThread`:
  - `id`, `buyerId`, `sellerId`, `productId?`, `orderId?`, `lastMessageAt`, `unreadCountBuyer`, `unreadCountSeller`, `createdAt`, `updatedAt`.
- `ChatMessage`:
  - `id`, `threadId`, `fromUserId`, `content`, `type(text|image|system)`, `readAt?`, `createdAt`.
- Mapping từ `Message` hiện tại: tách riêng cho domain chat để mở rộng.

Index: `@@index([threadId, createdAt])`, `@@index([buyerId, sellerId])` để load nhanh.

---

## 3) Giao thức realtime (WebSocket)

- Namespace: `/chat`.
- Rooms: `thread:<threadId>`, `user:<userId>`.
- Events:
  - Client → Server: `join`, `leave`, `send_message`, `mark_read`, `typing`.
  - Server → Client: `message_new`, `message_sent_ack`, `message_read`, `typing`, `thread_updated`.

Xác thực: JWT trong `handshake.auth.token`. Áp dụng rate-limit per socket.

---

## 4) Luồng nghiệp vụ chính

- Gửi tin: validate quyền trong `thread`, tạo `ChatMessage`, đẩy `message_new` tới room, tăng `unread` phía đối tác; publish `message.sent` ra MQ để xử lý offline push.
- Đọc tin: cập nhật `readAt`, reset `unread` tương ứng, phát `message_read`.
- Ảnh/file: upload S3, lưu URL vào `ChatMessage` với `type=image`.

---

## 5) Tích hợp MQ

- Publish sự kiện: `chat.message.sent` với payload `{threadId, messageId, fromUserId, toUserId}`.
- Consumer `notification` gửi email/push nếu user offline, lưu notification log.

---

## 6) API tối thiểu

- REST:
  - `GET /chat/threads` (list của user, pagination)
  - `GET /chat/threads/:id/messages` (pagination, before/after)
  - `POST /chat/threads` (khởi tạo thread từ product/order)

---

## 7) Bảo mật & vận hành

- Kiểm soát quyền: chỉ buyer/seller tương ứng truy cập thread.
- Ẩn email/số điện thoại trong chat (chống giao dịch ngoài sàn).
- Moderation: flag/ban từ khóa nhạy cảm. Log đầy đủ.
- Scale WS: sticky session + Redis adapter; cân nhắc NATS/socket cluster nếu lớn.

---

## 8) Lộ trình mở rộng

- Nhóm chat (CSKH nhiều người), template trả lời nhanh.
- Tích hợp bot FAQs.
- Kết nối sang Livestream chat (re-use gateway, khác namespace).
