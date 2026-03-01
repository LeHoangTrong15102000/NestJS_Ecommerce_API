# Khắc phục lỗi RustDesk bị khóa & cấu hình truy cập không cần đăng nhập (Mac + Windows)

Tài liệu này dùng khi RustDesk báo lỗi: **"Login error – Too many wrong attempts"** và mục tiêu sau khi sửa là:

- ✅ Reset trạng thái khóa
- ✅ Kết nối lại bình thường
- ✅ Cấu hình truy cập **không cần xác nhận** / không bị khóa về sau

---

## PHẦN 1 – Reset RustDesk trên máy bị khóa (Mac)

> Áp dụng cho máy ở công ty (Mac) đang bị khóa vì nhập sai quá nhiều lần

### Bước 1: Thoát RustDesk hoàn toàn

1. Bấm: **Command + Option + ESC**
2. Chọn **RustDesk**
3. Chọn **Force Quit**

---

### Bước 2: Xóa dữ liệu cũ của RustDesk (Reset khóa)

1. Mở **Finder**

2. Bấm **Command + Shift + G**

3. Dán vào đường dẫn:

   ```
   ~/Library/Application Support/RustDesk
   ```

4. **Xóa toàn bộ thư mục `RustDesk`**

> Nếu không thấy thư mục trên thì dùng đường dẫn thứ hai:

```
Macintosh HD → Library → Application Support → RustDesk
```

→ Xóa thư mục này luôn.

---

### Bước 3: Mở lại RustDesk

- Mở RustDesk lại
- Tại đây nó sẽ tạo:
  - ID mới
  - Password mới

**Chụp ảnh và gửi ID + Password cho tôi**

---

## PHẦN 2 – Kết nối lại từ máy cá nhân (Windows)

1. Nhập **ID mới của máy Mac**
2. Nhập **Password mới**
3. Nếu bên Mac hỏi → Bấm **Accept**

✅ Lúc này bạn đã vào được lại máy Mac.

---

## PHẦN 3 – Cấu hình để sau này KHÔNG cần đăng nhập nữa

> Làm các bước sau khi bạn đã truy cập được vào máy Mac

### Mục tiêu:

- Không cần ai bấm Accept
- Không bị khóa vì sai mật khẩu
- Không phụ thuộc người ở công ty

---

### Bước 1: Bật quyền truy cập không giám sát (Unattended Access)

Trên máy Mac:

1. Mở **RustDesk**
2. Vào: **Settings → Security**
3. Bật:
   - ✅ Enable Unattended Access

---

### Bước 2: Cài **Permanent Password** (quan trọng)

Tại cùng mục **Security**:

1. Ở phần **Permanent Password**
2. Tạo mật khẩu mạnh nhưng dễ nhớ ví dụ:

```
Mac@Company2025
```

3. Save lại.

---

### Bước 3: TẮT giới hạn khóa đăng nhập

Trong mục **Security**, tắt hết các mục (nếu có):

- ❌ Lock after failed attempts
- ❌ Block brute-force
- ❌ Auto deny incoming sessions

---

## PHẦN 4 – Test lại

1. Thoát RustDesk trên máy Mac
2. Mở lại
3. Bạn dùng máy Windows kết nối lại mà:
   - Không cần ai bấm Accept
   - Không còn bị báo khóa

✅ Nghĩa là đã setup thành công.

---

## PHẦN 5 – chống mất máy lần nữa (cực kỳ khuyên dùng)

Sau khi mọi thứ OK, hãy làm thêm:

✅ 1. Cài thêm **AnyDesk** hoặc **Chrome Remote Desktop** (làm phương án dự phòng)
✅ 2. Ghi ID + Password ra nơi an toàn
✅ 3. Không nhập sai quá 3 lần liên tục

---

Nếu bạn muốn, sau khi bạn lên công ty và làm tới bước 3, chỉ cần gửi tôi ảnh màn hình phần:

> `RustDesk → Settings → Security`

Tôi sẽ hỗ trợ bạn cấu hình phần còn lại **từ xa cho bạn**.
