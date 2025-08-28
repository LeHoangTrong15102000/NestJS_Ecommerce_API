# 🧪 Hướng Dẫn Test API Conversation Trong Postman

## 📋 Tổng Quan

Hướng dẫn này sẽ giúp bạn test toàn bộ hệ thống Conversation API một cách chi tiết, từ cơ bản đến nâng cao. Tất cả các bước được thiết kế để bạn có thể thực hiện tuần tự và hiểu rõ flow hoạt động.

## 🔐 Bước 1: Chuẩn Bị Authentication

### 1.1 Login để lấy Access Token

**Endpoint:** `POST /auth/login`

```json
{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

**Kết quả:** Copy `accessToken` từ response và paste vào Variables trong Postman:

- Key: `accessToken`
- Value: `eyJ0eXAiOiJKV1QiLCJhbGc...` (token từ response)

### 1.2 Tạo thêm User để test

**Endpoint:** `POST /users`

```json
{
  "email": "user1@example.com",
  "name": "User Test 1",
  "phoneNumber": "0900000001",
  "avatar": null,
  "status": "ACTIVE",
  "password": "User@123",
  "roleId": 2
}
```

Tạo thêm vài user nữa với email khác nhau (user2@, user3@, ...) để có đủ người test conversation.

## 💬 Bước 2: Test Conversation Management

### 2.1 Xem danh sách conversations (ban đầu sẽ trống)

**Endpoint:** `GET /conversations`

**Query Parameters:**

- `page`: 1
- `limit`: 10
- `type`: DIRECT (hoặc GROUP)
- `search`: (để trống)
- `isArchived`: false

**Mong đợi:** Danh sách trống hoặc rất ít conversations

### 2.2 Tạo Direct Conversation (Chat 1-1)

**Endpoint:** `POST /conversations/direct`

```json
{
  "recipientId": 2
}
```

**Mong đợi:** Response trả về conversation object với:

- `type`: "DIRECT"
- `members`: 2 thành viên
- `name`: Tên của user đối phương

**Lưu ý:** Copy `id` của conversation và set vào Variable:

- Key: `conversationId`
- Value: `cm123...` (ID từ response)

### 2.3 Tạo Group Conversation

**Endpoint:** `POST /conversations/group`

```json
{
  "name": "Nhóm Test API",
  "description": "Nhóm để test API conversation",
  "memberIds": [2, 3, 4],
  "avatar": "https://example.com/group-avatar.jpg"
}
```

**Mong đợi:** Response trả về group conversation với:

- `type`: "GROUP"
- `name`: "Nhóm Test API"
- `members`: 4 thành viên (bao gồm owner)
- `ownerId`: ID của user hiện tại

### 2.4 Xem chi tiết conversation

**Endpoint:** `GET /conversations/{{conversationId}}`

**Mong đợi:** Thông tin chi tiết conversation với đầy đủ members, roles, stats

### 2.5 Cập nhật thông tin group

**Endpoint:** `PUT /conversations/{{conversationId}}`

```json
{
  "name": "Nhóm Test API - Updated",
  "description": "Mô tả đã được cập nhật",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Mong đợi:** Thông tin group được cập nhật thành công

## 👥 Bước 3: Test Member Management

### 3.1 Xem danh sách thành viên

**Endpoint:** `GET /conversations/{{conversationId}}/members`

**Mong đợi:** Danh sách tất cả members với role và status

### 3.2 Thêm thành viên mới (chỉ với group)

**Endpoint:** `POST /conversations/{{conversationId}}/members`

```json
{
  "memberIds": [5, 6]
}
```

**Mong đợi:** Thành viên mới được thêm thành công

### 3.3 Cập nhật role thành viên

**Endpoint:** `PUT /conversations/{{conversationId}}/members/{{memberId}}/role`

```json
{
  "role": "ADMIN"
}
```

**Lưu ý:** Set `memberId` variable trước = ID của member muốn cập nhật

### 3.4 Xóa thành viên

**Endpoint:** `DELETE /conversations/{{conversationId}}/members/{{memberId}}`

**Mong đợi:** Thành viên bị xóa khỏi group

## 📨 Bước 4: Test Message Management

### 4.1 Gửi tin nhắn text đơn giản

**Endpoint:** `POST /conversations/messages`

```json
{
  "conversationId": "{{conversationId}}",
  "content": "Xin chào! Đây là tin nhắn test đầu tiên",
  "type": "TEXT",
  "replyToId": null,
  "attachments": []
}
```

**Mong đợi:** Tin nhắn được tạo thành công
**Lưu ý:** Copy `id` của message và set vào variable:

- Key: `messageId`
- Value: `msg123...`

### 4.2 Gửi tin nhắn với file đính kèm

**Endpoint:** `POST /conversations/messages`

```json
{
  "conversationId": "{{conversationId}}",
  "content": "Gửi hình ảnh cho mọi người",
  "type": "IMAGE",
  "attachments": [
    {
      "type": "IMAGE",
      "fileName": "test-image.jpg",
      "fileUrl": "https://example.com/images/test.jpg",
      "fileSize": 1024000,
      "mimeType": "image/jpeg",
      "width": 1920,
      "height": 1080
    }
  ]
}
```

### 4.3 Gửi tin nhắn reply

Trước tiên gửi một tin nhắn bình thường, sau đó:

```json
{
  "conversationId": "{{conversationId}}",
  "content": "Đây là reply cho tin nhắn trước",
  "type": "TEXT",
  "replyToId": "{{messageId}}"
}
```

### 4.4 Xem danh sách tin nhắn

**Endpoint:** `GET /conversations/{{conversationId}}/messages`

**Query Parameters:**

- `page`: 1
- `limit`: 20
- `before`: (để trống)
- `after`: (để trống)
- `type`: TEXT

**Mong đợi:** Danh sách tin nhắn theo thứ tự thời gian

### 4.5 Chỉnh sửa tin nhắn

**Endpoint:** `PUT /conversations/messages/{{messageId}}`

```json
{
  "content": "Nội dung tin nhắn đã được chỉnh sửa"
}
```

**Mong đợi:** Tin nhắn được cập nhật, `isEdited`: true

### 4.6 Xóa tin nhắn (chỉ cho mình)

**Endpoint:** `DELETE /conversations/messages/{{messageId}}?forEveryone=false`

### 4.7 Xóa tin nhắn (cho tất cả mọi người)

**Endpoint:** `DELETE /conversations/messages/{{messageId}}?forEveryone=true`

## 🎯 Bước 5: Test Message Interactions

### 5.1 Đánh dấu tin nhắn đã đọc

**Endpoint:** `POST /conversations/messages/read`

```json
{
  "conversationId": "{{conversationId}}",
  "messageId": "{{messageId}}"
}
```

### 5.2 Đánh dấu tất cả tin nhắn đã đọc

**Endpoint:** `POST /conversations/messages/read`

```json
{
  "conversationId": "{{conversationId}}"
}
```

### 5.3 Thêm reaction cho tin nhắn

**Endpoint:** `POST /conversations/messages/{{messageId}}/react`

```json
{
  "emoji": "👍"
}
```

**Test thêm:** Thử với các emoji khác nhau: "❤️", "😂", "😮", "😢", "😡"

### 5.4 Xóa reaction

**Endpoint:** `DELETE /conversations/messages/{{messageId}}/react?emoji=👍`

### 5.5 Xem thống kê reaction

**Endpoint:** `GET /conversations/messages/{{messageId}}/reactions/stats`

### 5.6 Xem thống kê đã đọc

**Endpoint:** `GET /conversations/messages/{{messageId}}/read-receipts/stats`

## 🔍 Bước 6: Test Advanced Features

### 6.1 Tìm kiếm tin nhắn

**Endpoint:** `GET /conversations/messages/search`

**Query Parameters:**

- `q`: "test" (từ khóa tìm kiếm)
- `page`: 1
- `limit`: 10
- `type`: TEXT
- `fromUserId`: 2 (tìm tin nhắn từ user cụ thể)
- `dateFrom`: 2024-01-01
- `dateTo`: 2024-12-31

### 6.2 Xem thống kê conversation

**Endpoint:** `GET /conversations/stats`

### 6.3 Xem thống kê tin nhắn

**Endpoint:** `GET /conversations/{{conversationId}}/messages/stats`

### 6.4 Archive conversation

**Endpoint:** `POST /conversations/{{conversationId}}/archive`

### 6.5 Unarchive conversation

**Endpoint:** `POST /conversations/{{conversationId}}/unarchive`

### 6.6 Rời khỏi conversation

**Endpoint:** `DELETE /conversations/{{conversationId}}/leave`

## 🧪 Bước 7: Test Cases Đặc Biệt

### 7.1 Test Error Handling

**Test case 1:** Tạo conversation với người dùng không tồn tại

```json
{
  "recipientId": 99999
}
```

**Mong đợi:** Error 404 "Người dùng không tồn tại"

**Test case 2:** Gửi tin nhắn vào conversation không có quyền

```json
{
  "conversationId": "invalid-id",
  "content": "Test message"
}
```

**Mong đợi:** Error 403 "Bạn không có quyền gửi tin nhắn"

**Test case 3:** Gửi tin nhắn trống

```json
{
  "conversationId": "{{conversationId}}",
  "content": "",
  "attachments": []
}
```

**Mong đợi:** Error 400 "Tin nhắn phải có nội dung hoặc file đính kèm"

### 7.2 Test Permission

**Test case 1:** Cập nhật group với user không phải admin

- Login với user khác (không phải owner)
- Thử cập nhật thông tin group
- **Mong đợi:** Error 403

**Test case 2:** Xóa member với user không phải admin

- Login với user thường
- Thử xóa member khỏi group
- **Mong đợi:** Error 403

### 7.3 Test Validation

**Test case 1:** Tạo group với tên quá dài

```json
{
  "name": "A".repeat(1000),
  "memberIds": [2, 3]
}
```

**Test case 2:** Gửi tin nhắn quá dài

```json
{
  "conversationId": "{{conversationId}}",
  "content": "A".repeat(20000)
}
```

## 📊 Bước 8: Monitoring & Debugging

### 8.1 Kiểm tra Response Status

Với mỗi request, kiểm tra:

- **200/201:** Success
- **400:** Bad Request (lỗi validation)
- **401:** Unauthorized (thiếu token)
- **403:** Forbidden (không có quyền)
- **404:** Not Found (resource không tồn tại)

### 8.2 Kiểm tra Response Structure

Đảm bảo response có structure chuẩn:

```json
{
  "message": "string",
  "data": {},
  "pagination": {} // chỉ với list endpoints
}
```

### 8.3 Performance Testing

- Test với large dataset (100+ messages)
- Test concurrent requests
- Test với file attachments lớn

## 🎯 Checklist Hoàn Thành

- [ ] ✅ Authentication successful
- [ ] ✅ Tạo được direct conversation
- [ ] ✅ Tạo được group conversation
- [ ] ✅ Cập nhật thông tin conversation
- [ ] ✅ Quản lý members (add/remove/update role)
- [ ] ✅ Gửi tin nhắn text
- [ ] ✅ Gửi tin nhắn với attachments
- [ ] ✅ Reply tin nhắn
- [ ] ✅ Chỉnh sửa tin nhắn
- [ ] ✅ Xóa tin nhắn
- [ ] ✅ Đánh dấu đã đọc
- [ ] ✅ Reaction tin nhắn
- [ ] ✅ Tìm kiếm tin nhắn
- [ ] ✅ Archive/unarchive conversation
- [ ] ✅ Leave conversation
- [ ] ✅ Error handling test
- [ ] ✅ Permission test
- [ ] ✅ Validation test

## 📝 Lưu Ý Quan Trọng

1. **Variables:** Luôn update các variables (conversationId, messageId, memberId) sau mỗi request tạo mới
2. **Authorization:** Đảm bảo token không hết hạn trong quá trình test
3. **Test Data:** Sử dụng data realistic để test tốt hơn
4. **Error Messages:** Tất cả error messages đều bằng tiếng Việt
5. **Real-time:** API này tích hợp với WebSocket, sẽ có notification real-time khi test thành công

---

**Chúc bạn testing thành công! 🚀**
