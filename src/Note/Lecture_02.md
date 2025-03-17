# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Bài 56 Logic cơ bản chức năng Login [Login part 1]

- Đầu tiên cần phải tạo model Login cho chức năng login , khi mà đã tạo xong `LoginBodySchema` thì chúng ta qua `LoginBodyDTO` để mà tạo thêm cho nó nữa

- Nhưng mà cái flow `Login` và `RefreshToken` thì chúng ta sẽ lấy cái `deviceId` ở đâu ra bây giờ

## Bài 57 Cách lấy IP và UserAgent của client [Login part 2]

- Lấy `IP` và `UserAgent` của người dùng khi mà đăng nhập `login` vào hệ thống

- Khi mà tạo thư viện là `Request-ip` thì khi mà sau này có deploy lên VPS hay một cái server nào đó thì cần phải config thêm cái cấu hình cho nó thì nó mới nhận được cái `IP`,ví dụ như là chúng ta sử dụng `NginX` thì cần phải config thêm `X-Real-IP`

## Bài 58 Một số cập nhật nhỏ

- Thực hiện một số cập nhật nhỏ ở Lấy IP của người dùng

- Nếu cùng một cái payload, ví dụ 2 cái yêu cầu tạo token trong cùng một dây nếu mà nó có cùng một cái payload thì có thể là nó sẽ bị trùng `Token`, để mà tránh bị trùng `token` thì chúng ta cần phải thêm một cái `ID` riêng cho nó là nó không bị trùng -> tải `UUID` để mà giải quyết cái vấn đề này

- Khi mà thêm vào `payload` đó thì không cần phải khai báo lại kiểu `interface` cho cái `payload` đó, bởi vì là chúng ta không có sử dụng cái `Uuid` đó làm cái gì cả

- Sẽ khai báo thêm một số `Model` và `Type` khác cho cái dự án của chúng ta để mà chúng ta làm việc nó lẹ hơn nhiều.

## Bài 59 Chức năng Refresh Token

- Thực hiện chức năng `RefreshToken` cho ứng dụng của chúng ta

-

## Bài 60 Chức nắng Logout

- Thực hiện chức năng `Logout` cho cái ứng dụng của chúng ta

## Bài 61 Return message cho sendOTP và tạo Decorator `@IsPublic`

- Tạo thêm một cái decorator là `@IsPublic`

## Bài 62 Bài tạp Oauth 2.0 với Google

## Bài 63 Tạo dự án trên Google Console Cloud

## Bài 64 Tạo Google Authorized Url bằng googleapis

## Bài 65 Source Frontend Vite React để mà test chức năng Login với Google
