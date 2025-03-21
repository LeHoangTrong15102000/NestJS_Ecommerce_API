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

- Từ userId tìm ra được `User` sau đó `JOIN` với thằng `Role` để mà lấy ra được cái `roleName`.

- Hoặc là cái bước tìm `RefreshToken` chúng ta thực hiện luôn câu lệnh `JOIN` để mà lấy ra được cái `roleId` `roleName` -> Thì ở đây chúng ta sẽ suy nghĩ rằng nên là sử dụng phương án nào cho nó tối ưu nhất.

- `RefreshToken` `JOIN` với `User` rồi từ `User` `JOIN` tiếp với thằng `Role` -> Thì chúng ta làm theo cách nào cũng được.

- 3 cái thằng `UpdateDevice` `DeleteRefreshToken` và `GenerateTokens` nó không cần phải chạy tuần tự nên là chúng ta có thể dùng `Promise.all` cho cả 3 thằng này được

- Thường khi mà khai báo một cái biến má có sử dụng Promise.all thì chúng ta sẽ sử dụng dấu `$` ở đầu để phân biệt được với một cái biến thông thường

- Nhưng mà lúc này thì chúng ta lại muốn là `RefreshToken new` lấy lại cái `exp` của cái `RefreshToken old` nên là ở cái phần logic này chúng ta sẽ xử lý lại cái chỗ đó

## Bài 60 Chức nắng Logout

- Thực hiện chức năng `Logout` cho cái ứng dụng của chúng ta

- Ở cái phần logout này thì chúng ta cũng cần phải check `Bearer Token` được gửi lên từ `Header Authorization` của người dùng nữa

## Bài 61 Return message cho sendOTP và tạo Decorator `@IsPublic`

- Tạo thêm một cái decorator là `@IsPublic`

- Xử lý về vấn đề `Public API endpoint` khi mà không cần phải xác thực quyền

## Bài 62 Bài tạp Oauth 2.0 với Google

## Bài 63 Tạo dự án trên Google Console Cloud

- `Authorized redirect URIs` là cái URL mà google nó `redirect` về cái server của chúng ta -> `http://localhost:3000/auth/google/callback`

## Bài 64 Tạo Google Authorized Url bằng googleapis

- Sẽ thực hiện tạo `Google Authorized Url` bằng `googleapis`

- Từ server của chúng ta redirect về `URL FE` trả về cho phía FE là `AT` và `RT` thì 2 cái thằng này thì FE nó sẽ nhận thông qua cái `query params` và nó sẽ lưu vào `localStorage` ở bên phía client của nó, lưu vào cookies hay localStorage thì tùy thằng FE nó sẽ xử lý cái việc đấy.

- Thì ở trong đây cái `URL` khi mà người dùng nhấn vào cái button sẽ được `Server-BE` của chúng ta tạo ra

  - Vì nếu browser không req đến server ở ở server ko lấy được `IP` và `UserAgent` của browser được mà method Login của chúng ta lại yêu cầu `IP` và `UserAgent` cho nên là

  - Do cái thằng server nó đảm nhận nhiệm vụ tạo ra cái `URL` nên là bắt buộc thằng `browser` nó gọi đến thằng `server` để mà lấy về cái `URL` này thì trong lúc gọi đấy chúng ta sẽ lấy cái `IP` và `UserAgent` của Browser, sau khi mà lấy xong rồi thì chúng ta sẽ đưa nó vào cái `URL-accounts.google` và trả về cho Browser, trong cái URL nó sẽ chứa `IP và UserAgent` sao khi mà `Browser` nó mở cái `URL` lên rồi thì nó sẽ chọn login với `Google`

  - Thằng Google ngoài cái việc nó gửi thông tin của google thì nó cũng gửi lại chính cái `IP` và `UserAgent` ở trên URL về cho `server backend` -> Thì cái đó gọi là `State` -> Bây giờ chúng ta sẽ cài đặt thư viện `googleapis` để mà xử lý cái việc đăng nhập với google này

  - Bây giờ chúng ta sẽ sử dụng cái thư viện `googleapis` để tìm hiểu về cái chức năng đăng nhập với `google` này

  - Khi mà tạo ra một cái `string` từ cái Object bằng cú pháp `JSON.stringify({userAgent, ip})` thì rất có nhiều khả năng là chúng ta sẽ bị gặp lỗi vì nó vẫn có khả năng xuất hiện những cái kí tự `{}` xuất hiện trên URL -> Nên là vì vậy để tránh cái trường hợp đó thì chúng ta sẽ chuyển nó thành `base64` thì chúng ta sẽ sử dụng cú pháp như sau `Buffer.from(JSON.stringify({userAgent, ip})).toString('base64')` -> Thì đây là cú pháp tạo ra string trên `URL` hoặc không thì chúng ta có thể sử dụng thư viện để mà hỗ trợ.

  - Sau khi mà đã khai báo xong thì bây giờ chúng ta sẽ test thử cái tính năng tạo ra URL từ `googleapis` -> Thì đây chính là cái thư viện chính chủ của google nên là chúng ta không cần phải sợ gì hết

  - Và bài sau sẽ tích hợp cái FE vite vào để mà test chức năng `Login` với `Google`

  - Ok đã get đường dẫn của `googleAuth` rồi -> Bây giờ tiến hành thực hiện các logic tiếp theo của chức năng mà thôi.

## Bài 65 Source Frontend Vite React để mà test chức năng Login với Google

- Sau khi mà nhảy tới cái link login của `google` -> Sau khi thằng google Login thành công thì nó sẽ Redirect về `server` và server sẽ chuyển tiếp về cái trang `/auth/oauh-google-callback` chính là cái component `Oauth` của chúng ta
