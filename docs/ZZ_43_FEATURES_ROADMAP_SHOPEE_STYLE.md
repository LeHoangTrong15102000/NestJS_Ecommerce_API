### Roadmap tính năng kiểu Shopee cho dự án NestJS Ecommerce

Mục tiêu: liệt kê các tính năng cốt lõi của một sàn TMĐT giống Shopee, đối chiếu với schema hiện tại, đề xuất thứ tự ưu tiên triển khai trong 3-4 tuần tới và các phase tiếp theo để sẵn sàng launch.

---

## 1) Nhóm tính năng cốt lõi (MVP để launch)

- **Tài khoản & Bảo mật**
  - Đăng ký/đăng nhập, 2FA (đã có trường `totpSecret`), quên mật khẩu, session/device management (`Device`, `RefreshToken`).
  - Phân quyền: `Role`, `Permission` (đã có). Chuẩn hóa route guards.

- **Danh mục & Sản phẩm**
  - `Product`, `Brand`, `Category` + `Translation` đa ngôn ngữ (đã có `Language`, `*Translation`).
  - Ảnh, biến thể, `SKU` có `stock`, `price`, `image`. Index tối ưu truy vấn.

- **Giỏ hàng & Thanh toán**
  - `CartItem` (đã có), thêm Guest Cart (session) nếu cần.
  - `Order`, `ProductSKUSnapshot` để chốt giá thời điểm mua (đã có).
  - Tích hợp cổng thanh toán (ShopeePay/VNPay/MoMo) qua `PaymentTransaction` + webhook.

- **Vận chuyển & Trạng thái đơn**
  - Trạng thái `OrderStatus` (đã có). Bổ sung thông tin giao hàng (địa chỉ, phí ship, nhà vận chuyển) ở phase kế tiếp.

- **Đánh giá**
  - `Review` (đã có). Bổ sung ảnh review, verified purchase.

---

## 2) Nhóm tính năng tăng trưởng (Phase sau MVP)

- **Voucher/Mã giảm giá**: storewide, seller voucher, free shipping, coin/reward.
- **Search/Filter/Sort**: full-text, facets; có thể đồng bộ catalog ra Elasticsearch.
- **Notification**: email, push, in-app (WebSocket/SSE), tích hợp với MQ.
- **Seller Center cơ bản**: quản lý sản phẩm, tồn kho, đơn, khuyến mãi.
- **Khiếu nại/Hoàn hàng**: quy trình return/refund.

---

## 3) Nhóm tính năng tương tác cao (Theo Shopee)

- **Chat người mua - người bán**: realtime message, seen, typing, offline push.
- **Shopee Live (Livestream)**: xem trực tiếp, chat, pin sản phẩm, add-to-cart từ live, flash sale.
- **Video mua hàng (Short/Feed)**: video ngắn, gắn sản phẩm, đo lường view/click.
- **Affiliate**: link theo dõi, hoa hồng, xác nhận theo đơn thành công, dashboard.
- **Marketing Center**: ads nội sàn, broadcast, voucher campaign.

---

## 4) Đối chiếu với schema hiện tại và bổ sung cần thiết

- Cần bổ sung bảng:
  - `Address` (user shipping), `Shipment`/`Logistics` (theo dõi vận chuyển)
  - `Voucher`/`Promotion`, `AffiliateLink`, `AffiliatePayout`
  - `ChatThread`, `ChatMessage` (thay cho `Message` P2P cơ bản), `LiveSession`, `LiveMessage`, `LiveOrder`
  - `Payment` riêng có `status`, link `orderId` (hiện `PaymentTransaction` chưa liên kết `Order`/`status`)
  - `Outbox` cho MQ

---

## 5) Ưu tiên 3-4 tuần (khả thi để launch bản đầu)

Tuần 1-2:

- Hoàn thiện Checkout: Reserve stock (transaction), tạo `Order` + snapshot, tích hợp thanh toán 1 cổng (VNPay/MoMo) + webhook → đổi `Order.status`.
- Bổ sung Address, Shipment (tối thiểu), Email/Notification cơ bản.
- Thêm RabbitMQ + Outbox cho `order.created`, `payment.succeeded/failed`, `inventory.reserve/release`.

Tuần 3:

- Review có ảnh + verified purchase.
- Seller Center tối thiểu: CRUD sản phẩm, quản lý tồn, đơn.
- Voucher đơn giản (mã tay, theo %/số tiền). Ràng buộc cơ bản.

Tuần 4:

- Chat cơ bản (buyer-seller) qua WebSocket (namespace `/chat`), lưu DB; offline push qua MQ.
- Logging, metrics, alert cơ bản; hardening bảo mật; backup & migrations.

---

## 6) Phase tiếp theo

- Livestream + Video mua hàng (kỹ thuật ở tài liệu riêng).
- Affiliate (kỹ thuật ở tài liệu riêng).
- Search/Recommend (đồng bộ Kafka → Elastic/Vector DB), phân tích hành vi.

---

## 7) Checklist sẵn sàng launch (tối thiểu)

- [ ] Checkout E2E thành công, retry an toàn, idempotent.
- [ ] Webhook payment an toàn (signature, replay-protection).
- [ ] Stock chống race condition (transaction/locking).
- [ ] MQ + Outbox hoạt động, DLQ theo dõi.
- [ ] Log/Audit cho hành động quan trọng.
- [ ] Tối ưu index Prisma đã có `@@index([deletedAt])` + bổ sung theo truy vấn.
- [ ] Docker compose đầy đủ: postgres, redis, api, rabbitmq.
