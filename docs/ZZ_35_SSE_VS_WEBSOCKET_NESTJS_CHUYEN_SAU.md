# So sánh chuyên sâu SSE (Server-Sent Events) và WebSocket (socket.io) trong NestJS

## 1. Tổng quan về SSE và WebSocket

### SSE (Server-Sent Events)

- **Định nghĩa:** SSE là một kỹ thuật truyền dữ liệu một chiều từ server về client thông qua HTTP, sử dụng header `text/event-stream`.
- **Cơ chế:** Client (thường là trình duyệt) mở một kết nối HTTP dài tới server, server liên tục gửi dữ liệu mới về client khi có sự kiện.
- **Chuẩn:** Thuộc chuẩn HTML5, hỗ trợ tốt trên trình duyệt hiện đại.
- **Hạn chế:** Chỉ truyền dữ liệu từ server về client (one-way), client không gửi dữ liệu ngược lại qua cùng kết nối SSE.

### WebSocket (socket.io)

- **Định nghĩa:** WebSocket là một giao thức mạng cho phép thiết lập kết nối hai chiều (full-duplex) giữa client và server trên một TCP connection duy nhất.
- **Cơ chế:** Sau khi handshake qua HTTP, kết nối được "nâng cấp" lên WebSocket, cho phép gửi/nhận dữ liệu real-time cả hai chiều.
- **socket.io:** Là một thư viện phổ biến giúp hiện thực WebSocket (và fallback các transport khác nếu cần), hỗ trợ nhiều tính năng nâng cao như rooms, namespaces, reconnection...
- **Hạn chế:** Cần hỗ trợ đặc biệt ở phía server và client, không phải mọi môi trường đều hỗ trợ tốt như HTTP.

---

## 2. Cách hoạt động trong NestJS

### SSE trong NestJS

- **Cài đặt:** Sử dụng decorator `@Sse()` trong controller để trả về stream sự kiện.
- **Ví dụ:**
  ```typescript
  @Sse('events')
  sendEvents(@Req() req: Request): Observable<MessageEvent> {
    return interval(1000).pipe(map(() => ({ data: { time: new Date() } })));
  }
  ```
- **Client:** Dùng `EventSource` API trên trình duyệt để lắng nghe sự kiện.
  ```js
  const eventSource = new EventSource('/events')
  eventSource.onmessage = (event) => {
    console.log(event.data)
  }
  ```

### WebSocket (socket.io) trong NestJS

- **Cài đặt:** Sử dụng module `@nestjs/websockets` và adapter cho socket.io.
- **Ví dụ:**
  ```typescript
  @WebSocketGateway()
  export class EventsGateway {
    @SubscribeMessage('message')
    handleMessage(client: Socket, payload: any): string {
      return 'Hello world!'
    }
  }
  ```
- **Client:** Dùng thư viện `socket.io-client` để kết nối và gửi/nhận sự kiện.
  ```js
  const socket = io('http://localhost:3000')
  socket.emit('message', { foo: 'bar' })
  socket.on('message', (data) => {
    console.log(data)
  })
  ```

---

## 3. So sánh chi tiết SSE vs WebSocket (socket.io)

| Tiêu chí               | SSE (Server-Sent Events)         | WebSocket (socket.io)              |
| ---------------------- | -------------------------------- | ---------------------------------- |
| **Kết nối**            | HTTP (long-lived, keep-alive)    | TCP (nâng cấp từ HTTP lên WS)      |
| **Chiều dữ liệu**      | Một chiều (server → client)      | Hai chiều (client ↔ server)       |
| **Chuẩn trình duyệt**  | Hỗ trợ tốt, native EventSource   | Cần thư viện JS, không native      |
| **Giao thức**          | HTTP/1.1, HTTP/2                 | WebSocket protocol riêng           |
| **Khả năng mở rộng**   | Tốt với load balancer HTTP       | Phức tạp hơn, cần sticky session   |
| **Firewall/Proxy**     | Dễ vượt qua (HTTP)               | Có thể bị chặn, cần cấu hình thêm  |
| **Reconnection**       | Tự động (EventSource)            | socket.io hỗ trợ tự động reconnect |
| **Truyền file/binary** | Không (chỉ text)                 | Có (hỗ trợ binary)                 |
| **Bảo mật**            | Dùng HTTPS như HTTP thông thường | Cần ws/wss, bảo mật riêng          |
| **Streaming**          | Tốt cho push event liên tục      | Tốt cho real-time, chat, game      |
| **Sử dụng phổ biến**   | Push notification, live feed     | Chat, game, collaborative app      |
| **Hạn chế**            | Không gửi từ client lên server   | Phức tạp hơn, cần nhiều resource   |

---

## 4. Ưu điểm & Nhược điểm

### SSE (Server-Sent Events)

- **Ưu điểm:**
  - Đơn giản, dễ triển khai với HTTP
  - Hỗ trợ tốt trên trình duyệt hiện đại
  - Tự động reconnect, giữ thứ tự sự kiện
  - Dễ scale với hạ tầng HTTP (load balancer, proxy)
- **Nhược điểm:**
  - Chỉ truyền dữ liệu một chiều (server → client)
  - Không hỗ trợ truyền binary
  - Không phù hợp cho ứng dụng cần real-time hai chiều (chat, game)
  - Không hỗ trợ tốt trên một số trình duyệt cũ

### WebSocket (socket.io)

- **Ưu điểm:**
  - Hai chiều, real-time mạnh mẽ
  - Hỗ trợ truyền binary, file
  - Nhiều tính năng nâng cao (rooms, namespaces, ack, middleware)
  - Phù hợp cho ứng dụng chat, game, collaborative
- **Nhược điểm:**
  - Cần cấu hình server, client phức tạp hơn
  - Khó scale out, cần sticky session hoặc giải pháp chuyên biệt
  - Có thể bị firewall/proxy chặn
  - Không phải mọi môi trường đều hỗ trợ tốt

---

## 5. Khi nào nên dùng SSE, khi nào nên dùng WebSocket?

- **Dùng SSE khi:**
  - Chỉ cần push dữ liệu từ server về client (notification, live feed, log...)
  - Muốn tận dụng hạ tầng HTTP sẵn có, dễ scale
  - Ứng dụng không cần gửi dữ liệu real-time từ client lên server qua cùng kết nối

- **Dùng WebSocket (socket.io) khi:**
  - Cần giao tiếp hai chiều real-time (chat, game, collaborative...)
  - Ứng dụng cần truyền file, binary, hoặc các tính năng nâng cao
  - Chấp nhận cấu hình phức tạp hơn, cần hiệu năng real-time cao

---

## 6. Kết luận

- **SSE** phù hợp cho các ứng dụng cần push dữ liệu một chiều, đơn giản, dễ scale, tận dụng hạ tầng HTTP.
- **WebSocket (socket.io)** phù hợp cho các ứng dụng real-time hai chiều, nhiều tương tác, cần truyền dữ liệu phức tạp.
- **NestJS** hỗ trợ cả hai giải pháp, tuỳ vào nhu cầu thực tế mà lựa chọn công nghệ phù hợp.

> **Lưu ý:** Có thể kết hợp cả hai trong hệ thống lớn: SSE cho notification, WebSocket cho chat/game.

---

## 7. Tài liệu tham khảo

- [NestJS - SSE](https://docs.nestjs.com/techniques/streams#server-sent-events-sse)
- [NestJS - WebSockets](https://docs.nestjs.com/websockets/gateways)
- [MDN - Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN - WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [socket.io Documentation](https://socket.io/docs/)
