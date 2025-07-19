# Script Tạo Dữ Liệu Mẫu cho Brand và Language

## 📝 Tóm Tắt

Tôi đã tạo ra các script để tự động thêm dữ liệu mẫu cho 2 module **Brand** và **Language** trong hệ thống NestJS Ecommerce API. Các script này giúp tạo ra dữ liệu test một cách nhanh chóng và thuận tiện.

## 📁 Cấu Trúc File

```
initialScript/
├── add-languages.ts          # Script thêm dữ liệu mẫu cho Language
├── add-brands.ts            # Script thêm dữ liệu mẫu cho Brand (bao gồm BrandTranslation)
├── add-sample-data.ts       # Script tổng hợp chạy cả 2 script trên
└── index.ts                 # Script gốc tạo role và admin user
```

## 🔧 Chức Năng Các Script

### 1. `add-languages.ts`

- **Mục đích**: Thêm 15 ngôn ngữ phổ biến vào database
- **Dữ liệu bao gồm**:
  - Tiếng Việt (vi), English (en), 中文 (zh), 日本語 (ja)
  - 한국어 (ko), Français (fr), Deutsch (de), Español (es)
  - Italiano (it), Русский (ru), Português (pt), العربية (ar)
  - हिन्दी (hi), ไทย (th), Bahasa Indonesia (id)
- **Tính năng**:
  - ✅ Kiểm tra xem đã có dữ liệu chưa để tránh duplicate
  - ✅ Error handling và thông báo chi tiết
  - ✅ Hiển thị danh sách ngôn ngữ đã thêm

### 2. `add-brands.ts`

- **Mục đích**: Thêm 10 thương hiệu nổi tiếng và bản dịch đa ngôn ngữ
- **Dữ liệu bao gồm**:
  - **Thương hiệu**: Apple, Samsung, Nike, Adidas, Sony, LG, Coca-Cola, Microsoft, Google, Tesla
  - **Logo**: Sử dụng Clearbit API để lấy logo chất lượng cao
  - **Bản dịch**: Mỗi brand có mô tả bằng 2-4 ngôn ngữ khác nhau
- **Tính năng**:
  - ✅ Kiểm tra dependency với Language (phải có ngôn ngữ trước)
  - ✅ Tạo cả Brand và BrandTranslation
  - ✅ Mapping thông minh với các ngôn ngữ có sẵn
  - ✅ Progress tracking cho từng brand

### 3. `add-sample-data.ts`

- **Mục đích**: Script tổng hợp chạy cả 2 script trên theo đúng thứ tự
- **Tính năng**:
  - ✅ Chạy tuần tự: Languages → Brands
  - ✅ Báo cáo tóm tắt kết quả cuối cùng
  - ✅ Error handling toàn diện

## 🚀 Cách Sử dụng

### Chạy từng script riêng lẻ:

```bash
# 1. Thêm ngôn ngữ trước
npx ts-node initialScript/add-languages.ts

# 2. Sau đó thêm thương hiệu
npx ts-node initialScript/add-brands.ts
```

### Chạy script tổng hợp (Khuyến nghị):

```bash
# Chạy tất cả một lần
npx ts-node initialScript/add-sample-data.ts
```

## 📊 Dữ Liệu Được Tạo

### Languages (15 ngôn ngữ):

| ID  | Tên Ngôn Ngữ           |
| --- | ---------------------- |
| vi  | Tiếng Việt             |
| en  | English                |
| zh  | 中文 (Chinese)         |
| ja  | 日本語 (Japanese)      |
| ko  | 한국어 (Korean)        |
| fr  | Français (French)      |
| de  | Deutsch (German)       |
| es  | Español (Spanish)      |
| it  | Italiano (Italian)     |
| ru  | Русский (Russian)      |
| pt  | Português (Portuguese) |
| ar  | العربية (Arabic)       |
| hi  | हिन्दी (Hindi)         |
| th  | ไทย (Thai)             |
| id  | Bahasa Indonesia       |

### Brands (10 thương hiệu):

| Thương Hiệu | Ngôn Ngữ Hỗ Trợ | Logo Source  |
| ----------- | --------------- | ------------ |
| Apple       | vi, en, zh, ja  | Clearbit API |
| Samsung     | vi, en, zh, ko  | Clearbit API |
| Nike        | vi, en, zh, es  | Clearbit API |
| Adidas      | vi, en, de, fr  | Clearbit API |
| Sony        | vi, en, ja, zh  | Clearbit API |
| LG          | vi, en, ko, zh  | Clearbit API |
| Coca-Cola   | vi, en, es, zh  | Clearbit API |
| Microsoft   | vi, en, zh, de  | Clearbit API |
| Google      | vi, en, zh, ja  | Clearbit API |
| Tesla       | vi, en, zh, de  | Clearbit API |

## 🛡️ Tính Năng An Toàn

- ✅ **Kiểm tra Duplicate**: Không thêm dữ liệu nếu đã tồn tại
- ✅ **Dependency Check**: Kiểm tra Language trước khi tạo Brand
- ✅ **Error Handling**: Xử lý lỗi chi tiết và rollback an toàn
- ✅ **Database Connection**: Tự động đóng kết nối Prisma
- ✅ **Process Exit**: Exit code chính xác cho CI/CD

## 🔍 Log và Monitoring

Các script có hệ thống log chi tiết:

```
🚀 Bắt đầu thêm dữ liệu mẫu cho Language và Brand...

📝 BƯỚC 1: Thêm dữ liệu mẫu cho Language...
✅ Đã thêm thành công 15 ngôn ngữ vào database
📋 Danh sách ngôn ngữ đã thêm:
1. vi - Tiếng Việt
2. en - English
...

🏷️ BƯỚC 2: Thêm dữ liệu mẫu cho Brand...
📦 Đang tạo thương hiệu: Apple...
  ✅ Đã tạo 4 bản dịch cho Apple
📦 Đang tạo thương hiệu: Samsung...
  ✅ Đã tạo 4 bản dịch cho Samsung
...

📊 TÓM TẮT KẾT QUẢ:
✅ Tổng số ngôn ngữ: 15
✅ Tổng số thương hiệu: 10
✅ Tổng số bản dịch thương hiệu: 35

🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu thành công!
```

## 📈 Performance và Tối Ưu

- **Sequential Processing**: Tạo Brand tuần tự để tránh race condition
- **Batch Creation**: Sử dụng `createMany` cho translations
- **Memory Efficient**: Không load tất cả dữ liệu vào memory cùng lúc
- **Error Recovery**: Có thể chạy lại script mà không bị lỗi

## 🔧 Customization

Để thêm dữ liệu mẫu mới:

### Thêm ngôn ngữ mới:

```typescript
// Trong add-languages.ts
const languages = [
  // ... existing languages
  {
    id: 'new_lang',
    name: 'New Language Name',
  },
]
```

### Thêm thương hiệu mới:

```typescript
// Trong add-brands.ts
const brandsData = [
  // ... existing brands
  {
    name: 'New Brand',
    logo: 'https://logo.clearbit.com/newbrand.com',
    translations: {
      vi: { name: 'Tên tiếng Việt', description: 'Mô tả tiếng Việt' },
      en: { name: 'English name', description: 'English description' },
    },
  },
]
```

## 🎯 Kết Luận

Các script này cung cấp:

- ✅ **Dữ liệu test phong phú** cho development và testing
- ✅ **Tự động hóa** quá trình setup database
- ✅ **Đa ngôn ngữ** với translation support
- ✅ **An toàn và tin cậy** với error handling tốt
- ✅ **Dễ mở rộng** và customization

Giúp developers tiết kiệm thời gian và có dữ liệu chất lượng để phát triển và test ứng dụng!
