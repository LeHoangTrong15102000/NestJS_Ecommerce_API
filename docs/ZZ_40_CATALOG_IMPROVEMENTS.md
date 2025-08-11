# Cải Tiến Hệ Thống Catalog

## Tổng Quan

Tài liệu này mô tả các cải tiến đã được thực hiện cho hệ thống catalog.

## Vấn Đề Được Giải Quyết

### 1. Trùng lặp dữ liệu

- **Vấn đề**: Script tạo thêm dữ liệu mới thay vì sử dụng dữ liệu hiện có
- **Giải pháp**: Thêm logic xóa dữ liệu cũ trước khi tạo mới

### 2. Dữ liệu mẫu ít

- **Vấn đề**: Products và Categories có quá ít dữ liệu mẫu
- **Giải pháp**: Tăng cường đáng kể số lượng dữ liệu mẫu

## Các Thay Đổi Đã Thực Hiện

### 1. Cải Tiến add-catalog-sample.ts

- Thêm function `clearExistingData()` để xóa dữ liệu cũ
- Xóa theo thứ tự foreign key để tránh lỗi
- Hiển thị thống kê chi tiết

### 2. Tăng Cường Products

- Từ 3 sản phẩm → 15 sản phẩm
- Đa dạng thương hiệu: Apple, Samsung, Nike, Adidas, Sony, LG, Coca-Cola, Microsoft, Google, Tesla
- Đa dạng danh mục: Phones, Laptops, Accessories, Men, Women, Home & Kitchen

### 3. Tăng Cường Categories

- Từ 3 danh mục gốc → 6 danh mục gốc
- Thêm: Sports & Outdoors, Beauty & Personal Care
- Cấu trúc phân cấp chi tiết với 31 danh mục tổng cộng

## Thống Kê Dữ Liệu

### Trước cải tiến:

- Products: 3 sản phẩm
- Categories: 8 danh mục

### Sau cải tiến:

- Products: 15 sản phẩm (tăng 400%)
- Categories: 31 danh mục (tăng 287%)

## Cách Sử Dụng

```bash
npm run seed:catalog
# hoặc
npx ts-node initialScript/add-catalog-sample.ts
```

## Lợi Ích

1. **Không còn trùng lặp dữ liệu**
2. **Dữ liệu phong phú hơn**
3. **Dễ dàng testing và development**
4. **Chỉ cần chạy 1 script**

## Ghi Chú

- Script sẽ xóa toàn bộ dữ liệu cũ trước khi tạo mới
- Chỉ sử dụng trong môi trường development/testing
- Có thể chạy nhiều lần mà không gây trùng lặp
