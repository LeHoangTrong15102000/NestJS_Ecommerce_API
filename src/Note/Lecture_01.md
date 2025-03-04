# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Bài 43 Tích hợp ZodValidation và Serialization

- Muốn custom một cái zoValidation thì chúng ta cần tạo riêng một cái file để mà custom được cái ValidationPipe đó

- Những cái lỗi validation như thế này chúng ta mong muốn là trả về `mã lỗi` là `422` -> Bây giờ chúng ta sẽ sử dụng `CustomValidationPipe` -> Thì cần phải chuyển cái `array` lỗi mà Zod trả về thành một `string`

- Và sử dụng thêm `ZodSerializationInterceptor` cho `output validation` nữa luôn cho nó đủ bộ -> Serilization thì chúng ta chỉ lược bỏ những cái field không cần thiết thôi không cần phải validate từng cái field

- Nếu mà bỏ cái `omit password` đi mà nó không trả về `password` thì có nghĩa là nó đã work rồi thì giờ chúng ta đã `Serialization` được output trả về rồi.

- Khi mà dự liệu mà chúng ta trả về cho ng dừng mà ko có `strict()` thì khi dự liệu gửi về từ người dùng mà nó có dư hay gì đó thì nó vẫn không gây ra lỗi.

- Khi mà có lỗi(sử dụng method strict() trong zod) mà chúng ta đang muốn biết là lỗi gì khi mà kết quả trả về từ việc `Serialization output` bị lỗi -> Vẫn có cách để mà xử lý cái vấn đề bị lỗi đó -> Thì chúng ta sẽ tạo ra một cái `exceptionFilter` để mà xem kết quả trả về bị lỗi thì cụ thể sẽ là bị lỗi gì. -> Nên là khi muốn thêm `strict()` hay không thì cũng cần phải cân nhắc rất là kĩ

## Bài 44 Hạn chế Try-Catch với CatchEverythingFilter

- Thì chúng ta có thẻ sử dụng cái func built-in có sẵn của NestJS đó là `CatchEverythingFilter`

## Bài 45 Áp dụng Repository Pattern

## Bài 46 Phân tích flow OTP code và khai báo endpoint

## Bài 47 Code logic tạo OTP khi đăng ký

## Bài 48 Cập nhật xác thực OTP cho chức năng đăng ký

## Bài 49 Gửi OTP đến email bằng Resend

## Bài 50 Xác thực domain trên Resend

## Bài 51 Gửi email bằng template HTML

## Bài 52 Giới thiệu về React email

## Bài 53 Sử dụng React email làm email template

## Bài 54 Tư duy về thiết kế Authentication và Authorization cho website

## Bài 55 Thêm model Device và hướng dẫn migrate
