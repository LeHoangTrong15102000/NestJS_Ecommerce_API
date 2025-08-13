### Thiết kế Affiliate (Hoa hồng giới thiệu) cho NestJS Ecommerce

Mục tiêu: tạo link theo dõi, gán đơn hàng cho publisher, tính hoa hồng, đối soát và chi trả. Phù hợp mô hình Shopee Affiliate.

---

## 1) Mục tiêu chức năng

- Publisher tạo link cho sản phẩm/cửa hàng; có thể đặt mức hoa hồng theo danh mục/sản phẩm/campaign.
- Theo dõi click → add-to-cart → purchase; xác nhận dựa trên đơn thành công (trừ hủy/hoàn).
- Bảng điều khiển cho publisher và cho admin/seller.

---

## 2) Mô hình dữ liệu đề xuất

- AffiliatePublisher: `id`, `userId`, `status`, `createdAt`.
- AffiliateCampaign: `id`, `name`, `startAt`, `endAt`, `commissionType` (percent/fixed), `rate`, `rules(jsonb)`.
- AffiliateLink: `id`, `campaignId`, `publisherId`, `targetType` (product/shop), `targetId`, `code`, `createdAt`.
- AffiliateClick: `id`, `linkId`, `userId?`, `sessionId`, `ip`, `ua`, `createdAt`.
- AffiliateAttribution: `id`, `orderId`, `linkId`, `publisherId`, `campaignId`, `status(pending|approved|rejected)`, `commissionAmount`, `createdAt`.
- AffiliatePayout: `id`, `publisherId`, `amount`, `status(pending|processing|paid|failed)`, `period`, `createdAt`.

Ghi chú: `Attribution` được tạo khi đơn chuyển `DELIVERED` (hoặc sau thời gian hoàn hàng) để tránh gian lận.

---

## 3) Luồng theo dõi và gán công

- Click: redirect qua `/aff/:code` → set cookie/session `aff_code` → chuyển đến `product/shop`.
- Đặt hàng: nếu có `aff_code`, lưu vào `Order.metadata` hoặc bảng mapping tạm.
- Khi `Order` thành công (hoặc sau hoàn hàng): tạo `AffiliateAttribution` và tính `commissionAmount` theo `Campaign.rules`.
- Tạo `Payout` định kỳ theo tháng/tuần.

---

## 4) MQ & chống gian lận

- Sự kiện: `affiliate.click`, `order.delivered`, `order.returned`, `payout.requested`.
- Luật chống gian lận: giới hạn nhiều click cùng IP trong thời gian ngắn; kiểm tra hoàn/hủy; blacklist domain ref.

---

## 5) API tối thiểu

- Publisher: tạo link, xem thống kê (click, conversion, commission), yêu cầu payout.
- Admin/Seller: quản lý campaign, rate, phê duyệt/điều chỉnh attribution, xuất báo cáo.
