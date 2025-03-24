# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Chương 5 Chức năng User: Auth

## Bài 66 Tạo Route Google Callback hoàn thiện chức năng Google Login

- Tạo Route Google Callback để mà hoàn thiện chức năng đăng nhập với `Google`

- Sẽ làm cái Route từ `Google` nó `redirect` về server của chúng ta thì cái Route của nó sẽ là `/auth/google/callback`

- Thì cái state khi mà `Google` `redirect` về server của chúng ta thì cũng được thằng google nó chuyền lại cho chúng ta -> Nên là

- Tại sao chúng ta cần phải try-catch cái đoạn này bởi vì chúng ta chưa chắc cái base64 này nó chính xác lỡ như mà nó thiếu xót một vài kí tự nào đó đi(không có gì đảm bảo được là cái URL nó sẽ chính xác), nếu mà chuyền thông qua Get Post này kia thì còn có thể đảm bảo được, trên URL lỡ có một cái gì đấy nó thay đổi thì nó lại làm không chính xác -> Vì thế chúng ta cần phải `try-catch` khi mà thực hiện cái `JSON.parse`

- Khi mà người ta đăng kí bằng google thì chắc chắn được là tài khỏan người ta đã tồn tại rồi -> Nên là chúng ta không cần phải xác thực `OTP` cái bước này là được.

- Do cái hàm `findUniqueUserIncludeRole` trả về user có bao gồm cả `Role` của user ở trong đó nữa -> Nên là chúng ta cần phải tạo ra cái hàm mới tạo ra `user` bao gồm cả `role` ở trong đó nữa.

## Bài 67 Publish Production Google Cloud Console

- Đã hoàn thành việc Publish Production Google Cloud Console

## Bài 68 Refactor Error và vấn đề về đa ngôn ngữ

- Thực hiện các `refactor` lại vấn đề mà quăng lỗi khi mà thực hiện các logic nghiệp vụ `dự án`

- Đa ngôn ngữ ở đây thì sẽ có 2 trường phái đó là người dùng ngta gửi lên header ngôn ngữ gì

- Thay vì trả về tiếng Anh hay tiếng Nhật hay tiếng gì đó cố định thì chúng ta sẽ trả về cái `key` thì cái `key` này sẽ được thằng `client` nó dựa vào cái ngôn ngữ hiện tại của nó để mà nó render ra(Ví dụ như cái ngôn ngữ hiện tại của thằng client là Tiếng Anh thì nó sẽ trả về lỗi là tiếng Anh).

- Khi mà tạo như thế này thì nhớ nói cho client biết là để mà tạo ra các `file JSON` có đúng các `key` lỗi mà chúng ta đã trả về

## Bài 69 Fix bug truyền sai RoleName khi mà tạo token

- Đã fix bug truyền sai `roleName` vào bên trong khi mà tạo `refreshToken`

## Bài 70 Chức năng quên mật khẩu

- Thực hiện chức năng quên mật khẩu

- Khai báo một method dùng chung để mà kiểm tra mã `OTP` của người dùng có hợp lệ hay không.

- Ngày xửa thì chúng ta chỉ sử dụng cái hàm sendOTP cho cái trường hợp là `Register` mà thôi bây giờ thêm cái trường hợp là `ForgotPassword` thì nó lại hơi khác một tí xíu nữa -> Nên là chỗ này cần phải chỉnh sửa lại nữa

## Bài 71 Phân tích chức năng 2FA

- Phân tích chức năng 2FA cho người dùng, sẽ thực hiện phân tích tính năng 2FA của người dùng -> Và thực hiện cái tính năng này sao cho phù hợp với đa số người dùng nhất có thể.

- Thì cái thư viện `OTPAuth` dùng để generate ra cái `2FA` đó -> Cái thư viện này nó cũng cung cấp cho chúng ta cái đường link để mà chúng ta test cái `2FA` này

- Thì cái totp code nó được generate ra thì nó phụ thuộc quan trọng nhất là thằng `Secret(định dạng base32)` còn mấy thằng khác thì chỉ có nhiệm vụ là `label` hiển thị trên cái app của chúng ta mà thôi -> Chứ nó không có ảnh hưởng đến cái logic `generate` ra cái `OTP code` của chúng ta, chỉ phụ thuộc vào `secret` và `thuật toán` của nó mà thôi, ngoài ra phụ thuộc vào `con số - digits` và `chu kì -period`

- Chúng ta sẽ đi vào phân tích và đưa nó vào bên trong dự án như thế nào

  - Thì chúng ta sẽ tạo ra 2 cái API đó là `@Post('/2fa/setup')` và `@Post('/2fa/disable')`

  - Thì cái `2fa/setup` chúng ta sẽ trả về cho client một cái `URI` thì thằng client nó sẽ dựa vào cái `URI` này và kết hợp với thư viện tạo ra `QR code` để mà tạo ra một cái `QR 2fa`. Ngoài ra chúng ta còn trả về cho người dùng cái `secret key` nữ thì người dùng sẽ lưu cái này vào đâu đấy, trong trường hợp mà nó không có dùng được mã `2fa - digits` thì nó có thể dùng cái `secret key` này để backup cho cái chuyện mà không sử dụng được `digits` từ ứng dụng `Authenticator` của người dùng

  - Khi mà đã tạo mã `2FA` rồi thì khi mà `Login` chúng ta bắt người dùng phải xác thực mã `2FA` đó rồi thì mới được đăng nhập vào bên trong ứng dụng. Trong cái trường hợp này chúng ta có thể phòng bằng cách cho phép người dùng nhập `OTP code` thông qua email lỡ mà người dùng có bỏ quên điện thoại hoặc là mất điện thoại(nên là phải cho người ta một cái backup là OTP code thông qua email của họ).

  - Cái API thứ 2 đó là `2fa/disable` - vô hiệu hóa, thì cái trường hợp mà người ta không cần cái `2FA` nữa thì chúng ta sẽ xóa đi cái `totpSecret` ở bên trong database là được.

  - Tới cái bước là `Xác thực 2FA` hoặc là `OTP code`

    - Thì cái trường hợp này xảy ra ở `API Login` hoặc là `API vô hiệu hóa 2FA` -> Thì trong 2 cái trường hợp này thì chúng ta đều có thể truyền lên `mã 2FA` hoặc là `OTP code` đều được.

    - Mặc dù đã Login vào rồi nhưng mà cũng cần phải truyền lại mã `2FA` để mà `disable` cái mã 2FA đó đi

## Bài 72 Cập nhật Schema Model DTO cho chức năng 2FA

- Tiến hành cập nhật `Schema Model DTO` cho chức năng `2FA`

- Thực hiện phần `Schema Model DTO` cho chức năng `2FA` của chúng ta

- Cái `verificationCode` bây giờ nó có rất là nhiều cái `item` có cùng cái email nhưng mà cái type nó khác nhau, nên là cái trường `email` ở trong cái bảng `Verificat ionCode` chúng ta không thể nào để `unique` được.

- Khi mà disable thì chúng ta cần check cái `rule` như sau:

  - Người dùng có thể truyền lên `totoCode` hoặc là `code`, người dùng không được truyền cả 2 thằng lên.

-Cần phải tạo thêm cái `request` và `DTO` để mà gửi lên cái body là một cái `JSON` `rỗng` -> Vì khi mà tạo thì chúng ta có thể dựa vào cái `AccessToken` người ta gửi lên từ `Header` nên là không cần phải truyền cái dự liệu gì vào `bodyCode` cả

## Bài 73 Tạo mã 2FA

- Thực hiện tạo mã 2FA cho người dùng

- Sẽ thực hiện tạo mã 2FA cho chức năng của người dùng

- Ban đầu chúng ta sẽ tạo ra cái `TOTP object` từ cái totp này thì chúng ta có thể sẽ generate ra được cái `URI string` để mà trả về lại cho người dùng -> Nhằm mục đích đó là tạo ra cái `QR code`

## Bài 74 Cập nhật xác thực 2 lớp cho Login

- Cập nhật xác thực 2 lớp cho Login

## Bài 75 Chức năng tắt mã 2FA

- Thực hiện chức năng tắt mã 2FA của người dùng
