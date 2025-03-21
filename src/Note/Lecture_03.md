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

## Bài 68 Refactor Error và vấn đề về đa ngôn ngữ

## Bài 69 Fix bug truyền sai RoleName khi mà tạo token

## Bài 70 Chức năng quên mật khẩu

## Bài 71 Phân tích chức năng 2FA

## Bài 72 Cập nhật Schema Model DTO cho chức năng 2FA

## Bài 73 Tạo mã 2FA

## Bài 74 Cập nhật xác thực 2 lớp cho Login

## Bài 75 Chức năng tắt mã 2FA
