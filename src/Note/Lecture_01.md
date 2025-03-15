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

- Đã thực hiện việc áp dụng Repository Pattern vào trong dự án rồi

## Bài 46 Phân tích flow OTP code và khai báo endpoint

- Phân tích cái flow OTP code và triển khai nó thôi

- Để tránh trường hợp mà người dùng spam email giả hoặc là tài khoản không đúng, nên là chúng ta sẽ xác thực email trước khi mà người dùng đăng ký để mà tiết kiệm được tài nguyên.

- Nên là cái chỗ nhập mã OTP code để mà xác thực email sẽ có một cái button nhập vào để mà send OTP code qua email của người dùng luôn(tránh email rác từ người dùng quá nhiều), Với trước khi mà nhấn đăng ký thì cần phải check cái mã code để mà xem cái mã đó có đúng hay không hay là có còn hạn sử dụng hay không

- Phân tích một tí xíu về cái `VerificationCode` Schema

- Để mà migration không bị vấn đề gì thì chúng ta cần phải xóa hết dự liệu của `VerificationCode` đi thì nó sẽ không có bị xóa hết dữ liệu của database khi mà chúng ta `migration` đi, trong trường hợp mà chúng ta không có item nào cả thì `migration` nó bình thường

- `expiresAt` chúng ta muốn là sau bao nhiêu phút đó thì cái OTP nó sẽ hết hạn nên là chúng ta cần khai báo thêm env nữa

- Để mà xử lý mấy cái giây giờ cho nó tiện thì chúng ta sẽ cài đặt thư viện là `ms` để mà xử lý cho nó tiện, thì cái thằng thư viện này nó sẽ `convert string` thời gian ra thành `milisecond`

- Qua `AuthModel` khai báo `Schema VerificationCode`.

- Thì bây giờ chúng ta sẽ khai báo cái `Endpoint` cho cái VerificationCode như thế nào -> Ví dụ như bây giờ ta khai báo 2 cái endpoint `sendOtpRegister` và `sendOtpForgotPassword` thì nó lại không hay cho lắm, vì 2 cái này làm cùng nhiệm vụ mà chúng ta làm thành 2 cái `Endpoint` thì nó không hay cho lắm -> Thì chỉ thiết kế một cái `OTPendpoint` có URL là `/auth/otp` và body của nó là người dùng sẽ gửi lên cái `email` và `type`.

- Nếu email đã tồn tại rồi thì thông báo là email đã tồn tại còn nếu email chưa tồn tại thì mới send OTP đến cho người dùng. -> Chúng ta có thể viết một cái hàm là `findUserByEmail` nhưng mà chúng ta suy nghĩ thêm là cái func này sẽ được sử dụng ở khá nhiều nơi -> Nên là không nên khai báo nó ở trong cái `AuthRepo`, nếu muốn import chéo hay gì đấy thì chúng ta khai báo nó ở trong `SharedModule` rồi từ đó import vào

- Thằng `Shared` chỉ nên import quanh quanh của cái thằng `SharedModule` mà thôi không nên import từ một module khác ở bên ngoài để khi mà thằng module đó bị xóa thì thằng `SharedModule` sẽ không bị ảnh hưởng -> Nên là cần phải tách biệt nó ra

## Bài 47 Code logic tạo OTP khi đăng ký

- Thực hiện code logic cho tạo OTP khi mà đăng ký thành công

- Chúng ta không muốn throw ra một `UnprocessableEntity` hơn là `ConflictException` để mà chỉ ra cái field nào là cái field lỗi trong quá trình gửi `OTP`

- Sau này mấy cái lỗi chung chung như thế này sẽ gom lại để mà tái sử dụng được

- Bởi vì cái `VerificationCodeRepo` chúng ta chỉ có thực hiện vài bước thôi đó là tạo và xóa thôi nên là chúng ta sẽ đưa nó vào `AuthRepo` luôn.

- Khi mà người ta nhấn gửi lại cái code chúng ta cần cập nhật lại cái code chứ không phải là tạo mới cái code đó -> Nên là cần phải chỉnh sửa lại ở trong cái `AuthRepo` của chúng ta `(thì lúc này cái code cũ nó sẽ bị vô hiệu hóa đi)`

- Tạm thời đã hoàn thành được việc đăng kí OTP -> Còn logic verifyOTP sẽ để ở những lần sau

## Bài 48 Cập nhật xác thực OTP cho chức năng đăng ký

- Cập nhật xác thực OTP cho chức năng đăng ký -> Sẽ thực hiện cập nhật OTP cho API `register` của chúng ta, thiếu cái chứng năng `verify` cái mã `code` của chúng ta là nó có đúng hay không và nó đã hết hạn hay chưa -> Thì cần phải query đến với database nhưng mà để mà query đến `database` thì cần phải query những trường mà được đánh index thì nó mới nhanh được -> Do chúng ta có để index là theo cụm `([code , email, type])` thì cần phải tìm theo cái cụm này thì nó mới nhanh được.

- Đã thực hiện xác thực code `VerificationCode` khi mà người dùng đăng ký thành công

## Bài 49 Gửi OTP đến email bằng Resend

- Gửi OTP đến email bằng Resend -> Trong phần này chúng ta sẽ thực hiện việc gửi email đến người dùng bằng `Resend`

## Bài 50 Xác thực domain trên Resend

- Xác thực domain trên Resend

## Bài 51 Gửi email bằng template HTML

- Gửi email bằng template HTML

## Bài 52 Giới thiệu về React email

- Giới thiệu về React email cho việc gửi email của người dùng

## Bài 53 Sử dụng React email làm email template

- Sử dụng React email làm email template cho dự án

## Bài 54 Tư duy về thiết kế Authentication và Authorization cho website

## Bài 55 Thêm model Device và hướng dẫn migrate
