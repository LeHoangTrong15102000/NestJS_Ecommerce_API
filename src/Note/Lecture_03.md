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

-

## Bài 72 Cập nhật Schema Model DTO cho chức năng 2FA

- Tiến hành cập nhật `Schema Model DTO` cho chức năng `2FA`

## Bài 73 Tạo mã 2FA

- Thực hiện tạo mã 2FA cho người dùng

## Bài 74 Cập nhật xác thực 2 lớp cho Login

- Cập nhật xác thực 2 lớp cho Login

## Bài 75 Chức năng tắt mã 2FA

- Thực hiện chức năng tắt mã 2FA của người dùng
