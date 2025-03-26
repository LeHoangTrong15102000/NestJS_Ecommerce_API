# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Chương 6 Chức năng `Language`

## Bài 76 Tối ưu `Language` Schema và index deletedAt

- Sẽ tối ưu một chút xíu về cái `schema Prisma` của `Language` trước khi mà chúng ta bắt tay vào việc code.

- Thường thì ở phía FE nó sẽ lưu cái `Language Code` tức nhiên là nó lưu cái `LanguageId` cũng được nhưng mà thường sẽ lưu là cái `Language Code` và nó sẽ gửi cái `Language Code` lên cái API của chúng ta thông qua cái `Header` -> Nhận được cái `Language Code` thì chúng ta sẽ thực hiện câu lệnh query đầu tiên đến `schema Language` để mà tìm ra được cái `languageId` thì từ cái này chúng ta sẽ tìm ra được cái `translation` phù hợp của cái languageId đó

- Ở đây chúng ta có thể caching cái `language` này vì cái language này vài năm chúng ta có thể sẽ không đụng vào -> Nhờ vậy mà chúng ta có thể lấy ra ngay lập tức cái `language` đó -> Thì cách này cũng được -> Nhưng mà có một cách nó đơn giản hơn đó là chúng ta cái `Code của language` này thành khóa chính luôn

  - Thì ở đây chúng ta sẽ xóa đi cái trường `code` và lấy trường `id` làm trường `code` luôn để mà khỏi phải sửa -> Thì nó sẽ kiểu dữ liệu là `String` và giới hạn là 10 kí tự

  - Thì khi mà sửa cái `Language` lại như thế này thì mỗi lần mà chúng ta tạo cái `Language` thì chúng ta cần phải cung cấp cái trường `Id` cho nó chứ nó không có default được.

  - Thì khi mà sửa lại như thế này rồi thì những cái schema nào mà đang có `languageId Int` thì cần sửa lại là `languageId String` là được -> Thế là chỉnh sửa xong cái phần khóa chính trường `language`

- Tiếp theo nữa là về thằng deletedAt thì khi chúng ta query tất cả các language thì chúng ta sẽ query với `deletedAt` là `null` khi mà query như vậy thì chúng ta nên đánh `index` trường `deletedAt` này để mà query cho nó nhanh. -> `@@index([deletedAt])` đánh index như thế này cho nó là được

## Bài 77 Bài tập CRUD `Language`

- Thực hiện bài tập CRUD cho `Language`

## Bài 78 Hướng đẫn làm chức năng `Language`

## Chương 7 `Prisma Migrate`

## Chương 8 Chức năng `Role-Permission`
