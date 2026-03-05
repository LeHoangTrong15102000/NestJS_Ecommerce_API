# 🌐 Deep Dive: HTTP vs SSE vs WebSocket — Cơ Chế Hoạt Động Bên Trong & So Sánh Chuyên Sâu

> **Mục đích**: Phân tích chuyên sâu cơ chế hoạt động ở mức protocol, TCP handshake, TLS overhead, WebSocket upgrade, SSE streaming, và áp dụng thực tế trong dự án NestJS Ecommerce.
> **Tài liệu liên quan**: [ZZ_78 - WebSocket/Socket.IO/Firebase Comparison](./ZZ_78_WEBSOCKET_SOCKETIO_FIREBASE_COMPARISON.md) | [ZZ_35 - SSE vs WebSocket NestJS](./ZZ_35_SSE_VS_WEBSOCKET_NESTJS_CHUYEN_SAU.md) | [ZZ_56 - WebSocket Patterns](./ZZ_56_KIẾN_THỨC_QUAN_TRỌNG_WEBSOCKET_PATTERNS_EXPLANATION.md)

---

## 📋 MỤC LỤC

- [Tóm Tắt Flow 3 Giao Thức](#tóm-tắt-flow-3-giao-thức)
- [PHẦN 1: HTTP — Tại Sao Phải "Mở Mới Mỗi Lần"?](#phần-1-http--tại-sao-phải-mở-mới-mỗi-lần)
  - [1.1 TCP 3-Way Handshake — Chi Phí Thiết Lập Kết Nối](#11-tcp-3-way-handshake--chi-phí-thiết-lập-kết-nối)
  - [1.2 TLS Handshake — Chi Phí Bảo Mật](#12-tls-handshake--chi-phí-bảo-mật)
  - [1.3 HTTP Headers Overhead — Chi Phí Mỗi Request](#13-http-headers-overhead--chi-phí-mỗi-request)
  - [1.4 HTTP Keep-Alive vs HTTP/2 — Giải Pháp Tối Ưu](#14-http-keep-alive-vs-http2--giải-pháp-tối-ưu)
  - [1.5 Tổng Chi Phí Tích Lũy — Timing Diagram](#15-tổng-chi-phí-tích-lũy--timing-diagram)
- [PHẦN 2: WebSocket Handshake — HTTP Upgrade → Protocol Switch](#phần-2-websocket-handshake--http-upgrade--protocol-switch)
  - [2.1 HTTP Upgrade Request — Bước Đầu Tiên](#21-http-upgrade-request--bước-đầu-tiên)
  - [2.2 101 Switching Protocols — Server Đồng Ý](#22-101-switching-protocols--server-đồng-ý)
  - [2.3 Sec-WebSocket-Key & Accept — Cơ Chế Bảo Mật](#23-sec-websocket-key--accept--cơ-chế-bảo-mật)
  - [2.4 WebSocket Frame Format — Sau Khi Upgrade](#24-websocket-frame-format--sau-khi-upgrade)
  - [2.5 Ping/Pong Heartbeat — Giữ Kết Nối Sống](#25-pingpong-heartbeat--giữ-kết-nối-sống)
  - [2.6 Socket.IO Handshake — Thêm 1 Lớp Nữa](#26-socketio-handshake--thêm-1-lớp-nữa)
- [PHẦN 3: SSE Trong Dự Án AI Assistant — Tại Sao Chọn SSE?](#phần-3-sse-trong-dự-án-ai-assistant--tại-sao-chọn-sse)
  - [3.1 Use Case Cụ Thể — AI Text Streaming](#31-use-case-cụ-thể--ai-text-streaming)
  - [3.2 Cách SSE Hoạt Động Trong ai-assistant.controller.ts](#32-cách-sse-hoạt-động-trong-ai-assistantcontrollerts)
  - [3.3 Tại Sao KHÔNG Dùng WebSocket Cho AI Streaming?](#33-tại-sao-không-dùng-websocket-cho-ai-streaming)
  - [3.4 Auto-Reconnect & Error Handling](#34-auto-reconnect--error-handling)
- [PHẦN 4: So Sánh Performance Thực Tế — HTTP vs SSE vs WebSocket](#phần-4-so-sánh-performance-thực-tế--http-vs-sse-vs-websocket)
  - [4.1 Memory Footprint Per Connection](#41-memory-footprint-per-connection)
  - [4.2 Latency — Connection Establishment vs Message Delivery](#42-latency--connection-establishment-vs-message-delivery)
  - [4.3 Overhead Per Message — Bytes Thực Tế](#43-overhead-per-message--bytes-thực-tế)
  - [4.4 Scalability & Connection Limits](#44-scalability--connection-limits)
  - [4.5 Benchmark Scenarios Thực Tế](#45-benchmark-scenarios-thực-tế)
- [PHẦN 5: Rooms & Namespaces Trong Socket.IO — Quản Lý Conversations](#phần-5-rooms--namespaces-trong-socketio--quản-lý-conversations)
  - [5.1 Namespace Là Gì? — Tách Biệt Logic](#51-namespace-là-gì--tách-biệt-logic)
  - [5.2 Room Là Gì? — Nhóm Connections](#52-room-là-gì--nhóm-connections)
  - [5.3 Cách Dự Án Quản Lý Conversations Qua 1 Connection](#53-cách-dự-án-quản-lý-conversations-qua-1-connection)
  - [5.4 Room Lifecycle — Join, Leave, Cleanup](#54-room-lifecycle--join-leave-cleanup)
  - [5.5 Event Routing — Gửi Message Đến Đúng Người](#55-event-routing--gửi-message-đến-đúng-người)
  - [5.6 Redis Adapter — Scale Across Multiple Servers](#56-redis-adapter--scale-across-multiple-servers)
- [PHẦN 6: Tổng Kết & Decision Framework](#phần-6-tổng-kết--decision-framework)

---

## Tóm Tắt Flow 3 Giao Thức

```
HTTP:       Mở → Hỏi → Trả → ĐÓNG → Mở lại → Hỏi → Trả → ĐÓNG → ...
SSE:        Mở → Hỏi → Trả ... Trả ... Trả → ĐÓNG (server gửi liên tục, client chỉ nhận)
WebSocket:  Mở → Gửi/Nhận/Gửi/Nhận/Gửi/Nhận ... → ĐÓNG (cả 2 bên tự do, 1 kết nối duy nhất)
```

**Giải thích:**

- **HTTP**: Mỗi lần client muốn hỏi server, phải mở connection mới (hoặc reuse qua keep-alive), gửi request, nhận response, rồi connection có thể đóng. Muốn gửi câu hỏi mới → phải tạo HTTP request MỚI.
- **SSE**: Client mở 1 HTTP connection, server giữ connection mở và liên tục gửi data về. Client KHÔNG THỂ gửi ngược lại qua connection này. Muốn gửi câu hỏi mới → phải tạo HTTP request MỚI (POST riêng).
- **WebSocket**: Sau handshake ban đầu, cả 2 bên tự do gửi/nhận data BẤT KỲ LÚC NÀO qua 1 kết nối duy nhất. Không cần mở connection mới.

---

## PHẦN 1: HTTP — Tại Sao Phải "Mở Mới Mỗi Lần"?

### 1.1 TCP 3-Way Handshake — Chi Phí Thiết Lập Kết Nối

Mỗi HTTP request (nếu không có keep-alive) đều phải thiết lập TCP connection mới. Quá trình này gọi là **3-Way Handshake**:

```
Client                                    Server
  │                                          │
  │  ① SYN (seq=x)                          │
  │  ─────────────────────────────────────►  │   ~0.5 RTT
  │  "Tôi muốn kết nối, số thứ tự của       │
  │   tôi bắt đầu từ x"                     │
  │                                          │
  │  ② SYN-ACK (seq=y, ack=x+1)            │
  │  ◄─────────────────────────────────────  │   ~0.5 RTT
  │  "OK, tôi đồng ý. Số thứ tự của tôi    │
  │   bắt đầu từ y, tôi đã nhận x"          │
  │                                          │
  │  ③ ACK (ack=y+1)                        │
  │  ─────────────────────────────────────►  │   ~0.5 RTT
  │  "Tôi xác nhận đã nhận y"               │
  │                                          │
  │  ═══ TCP Connection ESTABLISHED ═══      │
  │                                          │
  │  Bây giờ mới bắt đầu gửi HTTP request   │
  │  ─────────────────────────────────────►  │
  │                                          │
```

**Chi phí thời gian:**

| Khoảng cách | RTT (Round-Trip Time) | TCP Handshake |
|---|---|---|
| Cùng data center | ~0.5ms | ~0.75ms |
| Cùng thành phố | ~5ms | ~7.5ms |
| Cùng quốc gia | ~20ms | ~30ms |
| Xuyên lục địa | ~100ms | ~150ms |
| Qua CDN | ~10-30ms | ~15-45ms |

> 💡 **Điểm mấu chốt**: TCP handshake tốn **1.5 RTT** (1 round trip rưỡi). Nếu server ở xa (100ms RTT), mỗi connection mới tốn **150ms** chỉ để thiết lập — chưa gửi data gì cả!

### 1.2 TLS Handshake — Chi Phí Bảo Mật

Nếu dùng HTTPS (bắt buộc trong production), sau TCP handshake còn phải thêm **TLS handshake**:

```
Client                                    Server
  │                                          │
  │  ═══ TCP 3-Way Handshake (1.5 RTT) ═══  │
  │                                          │
  │  ④ ClientHello                           │
  │  ─────────────────────────────────────►  │   ~0.5 RTT
  │  • TLS version (1.2 hoặc 1.3)           │
  │  • Cipher suites được hỗ trợ            │
  │  • Client random number                  │
  │  • SNI (Server Name Indication)          │
  │                                          │
  │  ⑤ ServerHello + Certificate + Done      │
  │  ◄─────────────────────────────────────  │   ~0.5 RTT
  │  • Cipher suite được chọn               │
  │  • Server certificate (X.509)            │
  │  • Server random number                  │
  │  • Server key exchange params            │
  │                                          │
  │  ⑥ Client Key Exchange + Finished        │
  │  ─────────────────────────────────────►  │   ~0.5 RTT
  │  • Pre-master secret (encrypted)         │
  │  • Change cipher spec                    │
  │  • Finished (encrypted verify)           │
  │                                          │
  │  ⑦ Server Change Cipher + Finished       │
  │  ◄─────────────────────────────────────  │   ~0.5 RTT
  │  • Change cipher spec                    │
  │  • Finished (encrypted verify)           │
  │                                          │
  │  ═══ TLS Session ESTABLISHED ═══         │
  │                                          │
  │  Bây giờ mới gửi HTTP request (encrypted)│
  │  ─────────────────────────────────────►  │
  │                                          │
```

**So sánh TLS versions:**

| TLS Version | Handshake RTT | Tổng (TCP + TLS) | Ghi chú |
|---|---|---|---|
| TLS 1.2 | 2 RTT | 3.5 RTT | Phổ biến, đang dần thay thế |
| TLS 1.3 | 1 RTT | 2.5 RTT | Nhanh hơn, an toàn hơn |
| TLS 1.3 (0-RTT) | 0 RTT | 1.5 RTT | Resumption, có risk replay attack |

**Ví dụ thực tế với RTT = 50ms (server ở Singapore, client ở Việt Nam):**

```
TLS 1.2:  TCP(75ms) + TLS(100ms) + HTTP Request(25ms) = 200ms trước khi nhận byte đầu tiên
TLS 1.3:  TCP(75ms) + TLS(50ms)  + HTTP Request(25ms) = 150ms trước khi nhận byte đầu tiên
```

> ⚠️ **Quan trọng**: Đây là chi phí cho MỖI connection mới. Nếu HTTP không dùng keep-alive, mỗi request đều phải trả chi phí này!

### 1.3 HTTP Headers Overhead — Chi Phí Mỗi Request

Ngay cả khi đã có TCP + TLS connection sẵn, mỗi HTTP request vẫn phải gửi **headers** — và headers này KHÔNG nhỏ:

#### Request Headers — Ví dụ thực tế từ dự án

```http
GET /api/v1/products?page=1&limit=10 HTTP/1.1
Host: api.ecommerce.com
Connection: keep-alive
Accept: application/json, text/plain, */*
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVJZCI6MSwi
  ZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTcwOTI4MDAwMCwiZXhwIjoxNzA5MzY2NDAwfQ.abc123
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)
  Chrome/122.0.0.0 Safari/537.36
Accept-Language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7
Accept-Encoding: gzip, deflate, br
Cookie: _ga=GA1.1.123456789.1709280000; _gid=GA1.1.987654321.1709280000;
  session_id=abc123def456; preferences=theme%3Ddark%26lang%3Dvi
Referer: https://ecommerce.com/products
Origin: https://ecommerce.com
Cache-Control: no-cache
If-None-Match: "etag-abc123"
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

#### Response Headers — Ví dụ thực tế

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 4523
Date: Mon, 04 Mar 2026 10:30:00 GMT
Server: nginx/1.24.0
X-Powered-By: NestJS
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-Response-Time: 45ms
Cache-Control: public, max-age=60
ETag: "etag-def456"
Vary: Accept-Encoding, Authorization
Access-Control-Allow-Origin: https://ecommerce.com
Access-Control-Allow-Credentials: true
Set-Cookie: _tracking=xyz789; Path=/; HttpOnly; Secure; SameSite=Lax
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

#### Kích thước Headers thực tế

| Loại | Kích thước trung bình | Ghi chú |
|---|---|---|
| Request headers (không cookie) | ~400-600 bytes | Host, Accept, User-Agent, Auth... |
| Request headers (có cookie) | ~800-2000 bytes | Cookies có thể rất lớn |
| Request headers (có JWT) | ~600-1200 bytes | JWT token thường 200-500 bytes |
| Response headers | ~300-800 bytes | Content-Type, Cache, CORS, Security... |
| **Tổng 1 request-response** | **~700-2800 bytes** | **Chỉ riêng headers, chưa tính body** |

#### So sánh với WebSocket

```
┌─────────────────────────────────────────────────────────────────┐
│              OVERHEAD PER MESSAGE COMPARISON                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Request (gửi {"page":1}):                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Headers: ~800 bytes                                      │   │
│  │  Body:    ~12 bytes   {"page":1}                          │   │
│  │  ─────────────────────                                    │   │
│  │  TỔNG:    ~812 bytes  (98.5% là overhead!)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  WebSocket Frame (gửi {"page":1}):                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Frame header: 2-6 bytes (opcode + length + mask)         │   │
│  │  Payload:      12 bytes  {"page":1}                       │   │
│  │  ─────────────────────                                    │   │
│  │  TỔNG:         14-18 bytes (86% là data thực!)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SSE Event (server gửi {"stock":5}):                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SSE format: "data: " (6 bytes) + "\n\n" (2 bytes)       │   │
│  │  Payload:    ~12 bytes  {"stock":5}                       │   │
│  │  ─────────────────────                                    │   │
│  │  TỔNG:       ~20 bytes (60% là data thực)                 │   │
│  │  ⚠️ Nhưng: connection ban đầu vẫn có HTTP headers         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 Nếu gửi 1000 messages nhỏ:                                 │
│  HTTP:      ~800,000 bytes overhead (headers lặp lại mỗi lần)  │
│  WebSocket: ~6,000 bytes overhead   (chỉ frame headers)        │
│  SSE:       ~8,000 bytes overhead   (chỉ "data: \n\n")         │
│                                                                 │
│  → WebSocket tiết kiệm ~99.25% overhead so với HTTP!            │
│  → SSE tiết kiệm ~99% overhead so với HTTP (cho server→client) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 💡 **Kết luận**: HTTP headers overhead là lý do chính tại sao WebSocket và SSE hiệu quả hơn nhiều cho real-time communication. Với messages nhỏ và tần suất cao, HTTP overhead chiếm đến 98-99% bandwidth!

### 1.4 HTTP Keep-Alive vs HTTP/2 — Giải Pháp Tối Ưu

HTTP đã phát triển qua nhiều phiên bản để giảm chi phí connection. Hiểu rõ sự khác biệt giúp bạn biết khi nào HTTP đủ tốt và khi nào cần WebSocket/SSE.

#### HTTP/1.0 — Không có Keep-Alive (mặc định)

```
Client                                    Server
  │                                          │
  │  ── TCP Handshake (1.5 RTT) ──────────  │
  │  ── TLS Handshake (1-2 RTT) ──────────  │
  │  GET /api/products ────────────────────► │  Request 1
  │  ◄──────────────────── 200 OK + data     │
  │  ✖ CONNECTION ĐÓNG                       │
  │                                          │
  │  ── TCP Handshake (1.5 RTT) ──────────  │  ← Lại phải handshake!
  │  ── TLS Handshake (1-2 RTT) ──────────  │  ← Lại phải TLS!
  │  GET /api/cart ────────────────────────► │  Request 2
  │  ◄──────────────────── 200 OK + data     │
  │  ✖ CONNECTION ĐÓNG                       │
  │                                          │
  │  → 5 requests = 5 lần TCP + TLS = CỰC KỲ LÃNG PHÍ
  │
```

#### HTTP/1.1 — Keep-Alive (mặc định BẬT)

```
Client                                    Server
  │                                          │
  │  ── TCP Handshake (1.5 RTT) ──────────  │  ← Chỉ 1 lần
  │  ── TLS Handshake (1-2 RTT) ──────────  │  ← Chỉ 1 lần
  │                                          │
  │  GET /api/products ────────────────────► │  Request 1
  │  ◄──────────────────── 200 OK + data     │
  │  ═══ Connection giữ mở (keep-alive) ═══ │
  │                                          │
  │  GET /api/cart ────────────────────────► │  Request 2
  │  ◄──────────────────── 200 OK + data     │
  │  ═══ Connection giữ mở ═══              │
  │                                          │
  │  GET /api/user/profile ────────────────► │  Request 3
  │  ◄──────────────────── 200 OK + data     │
  │                                          │
  │  → Tiết kiệm TCP + TLS handshake cho requests sau
  │
  │  ⚠️ NHƯNG: Head-of-Line Blocking!
  │  Request 2 PHẢI ĐỢI Request 1 hoàn thành
  │  Không thể gửi song song trên cùng 1 connection
  │
  │  Giải pháp: Browser mở 6 connections song song
  │  Connection 1: GET /products ──────────────────►
  │  Connection 2: GET /cart ──────────────────────►
  │  Connection 3: GET /user ──────────────────────►
  │  Connection 4: GET /categories ────────────────►
  │  Connection 5: GET /brands ────────────────────►
  │  Connection 6: GET /reviews ───────────────────►
  │  ⚠️ Giới hạn 6 connections/domain!
  │
```

#### HTTP/2 — Multiplexing (Giải pháp triệt để)

```
Client                                    Server
  │                                          │
  │  ── TCP Handshake (1.5 RTT) ──────────  │  ← Chỉ 1 lần
  │  ── TLS Handshake (1 RTT - TLS 1.3) ──  │  ← Chỉ 1 lần
  │  ── ALPN: h2 negotiation ──────────────  │  ← Trong TLS handshake
  │                                          │
  │  ═══ 1 TCP Connection DUY NHẤT ═══      │
  │                                          │
  │  Stream 1: GET /products ──────────────► │  ┐
  │  Stream 2: GET /cart ──────────────────► │  │ Tất cả gửi
  │  Stream 3: GET /user ──────────────────► │  │ ĐỒNG THỜI
  │  Stream 4: GET /categories ────────────► │  │ trên 1 connection!
  │  Stream 5: GET /brands ────────────────► │  ┘
  │                                          │
  │  ◄──── Stream 3: 200 OK (user - nhỏ)    │  ← Trả về theo
  │  ◄──── Stream 2: 200 OK (cart)           │     thứ tự hoàn thành
  │  ◄──── Stream 5: 200 OK (brands)         │     KHÔNG phải thứ tự
  │  ◄──── Stream 4: 200 OK (categories)     │     gửi đi!
  │  ◄──── Stream 1: 200 OK (products - lớn) │
  │                                          │
  │  ✅ Không Head-of-Line Blocking (ở HTTP layer)
  │  ✅ 1 connection cho tất cả requests
  │  ✅ Header compression (HPACK)
  │  ✅ Server Push (server gửi trước khi client hỏi)
  │
```

#### So sánh tổng quan

| Tính năng | HTTP/1.0 | HTTP/1.1 | HTTP/2 |
|---|---|---|---|
| Keep-Alive | ❌ Không | ✅ Mặc định | ✅ Luôn luôn |
| Multiplexing | ❌ | ❌ | ✅ |
| Header Compression | ❌ | ❌ | ✅ HPACK |
| Server Push | ❌ | ❌ | ✅ |
| Connections/domain | Nhiều | Max 6 | 1 (đủ) |
| Head-of-Line Blocking | ✅ Có | ✅ Có | ❌ Không (HTTP layer) |
| Binary Protocol | ❌ Text | ❌ Text | ✅ Binary frames |
| SSE connection limit | Nghiêm trọng | 6 max | Không giới hạn |

#### HPACK Header Compression — HTTP/2

```
┌─────────────────────────────────────────────────────────────────┐
│              HPACK HEADER COMPRESSION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Request 1: GET /api/products                                   │
│  Headers gửi đi: ~800 bytes (đầy đủ)                           │
│                                                                 │
│  Request 2: GET /api/cart (cùng connection)                     │
│  Headers gửi đi: ~50 bytes! 🎉                                 │
│                                                                 │
│  Tại sao? HPACK dùng:                                           │
│  ① Static Table: 61 headers phổ biến có sẵn (index)            │
│     :method GET → chỉ gửi index "2" (1 byte)                   │
│     :scheme https → chỉ gửi index "7" (1 byte)                 │
│                                                                 │
│  ② Dynamic Table: Headers đã gửi trước đó được cache           │
│     Authorization: Bearer eyJ... → lần 2 chỉ gửi index         │
│     Cookie: session=abc → lần 2 chỉ gửi index                  │
│                                                                 │
│  ③ Huffman Encoding: Nén giá trị header                         │
│     "application/json" → mã Huffman ngắn hơn                   │
│                                                                 │
│  Kết quả: Request thứ 2+ giảm 85-95% header size!              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 💡 **Kết luận**: HTTP/2 giải quyết phần lớn vấn đề overhead của HTTP/1.1. Tuy nhiên, nó vẫn KHÔNG thay thế được WebSocket cho two-way real-time communication, và vẫn KHÔNG hiệu quả bằng WebSocket cho high-frequency messaging (vì vẫn có HTTP semantics overhead).

### 1.5 Tổng Chi Phí Tích Lũy — Timing Diagram

Giờ hãy gộp tất cả lại để thấy bức tranh toàn cảnh. Giả sử RTT = 50ms (server Singapore, client Việt Nam):

#### Scenario: Client gửi 5 API requests liên tiếp

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TIMING DIAGRAM: 5 REQUESTS — HTTP/1.1 vs HTTP/2 vs WebSocket vs SSE  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Giả định: RTT = 50ms, TLS 1.3, Server xử lý = 10ms/request           │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════     │
│  HTTP/1.1 (1 connection, keep-alive, tuần tự)                           │
│  ═══════════════════════════════════════════════════════════════════     │
│                                                                         │
│  0ms    75ms   125ms  185ms  245ms  305ms  365ms  425ms  485ms          │
│  │──TCP──│─TLS──│─R1───│─R2───│─R3───│─R4───│─R5───│                    │
│  │ 75ms  │ 50ms │ 60ms │ 60ms │ 60ms │ 60ms │ 60ms │                    │
│                                                                         │
│  TCP Handshake:  75ms  (1.5 RTT)                                        │
│  TLS Handshake:  50ms  (1 RTT, TLS 1.3)                                │
│  Mỗi Request:   60ms  (1 RTT request/response + 10ms server)           │
│  Headers/req:   ~1600 bytes (request + response headers)                │
│                                                                         │
│  TỔNG THỜI GIAN: 125ms (setup) + 300ms (5 requests) = 425ms            │
│  TỔNG OVERHEAD:  75ms + 50ms + (5 × ~1600 bytes headers) = ~8000 bytes │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════     │
│  HTTP/1.1 (6 connections song song)                                     │
│  ═══════════════════════════════════════════════════════════════════     │
│                                                                         │
│  0ms    75ms   125ms  185ms                                             │
│  │──TCP──│─TLS──│─R1───│                                                │
│  │──TCP──│─TLS──│─R2───│  ← 5 requests chạy song song                  │
│  │──TCP──│─TLS──│─R3───│    trên 5 connections khác nhau                │
│  │──TCP──│─TLS──│─R4───│                                                │
│  │──TCP──│─TLS──│─R5───│                                                │
│                                                                         │
│  TỔNG THỜI GIAN: 125ms + 60ms = 185ms (nhanh hơn!)                     │
│  TỔNG OVERHEAD:  5 × (75ms + 50ms) + 5 × ~1600 bytes = ~8000 bytes     │
│  ⚠️ NHƯNG: 5 TCP connections = 5× memory, 5× TLS state trên server     │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════     │
│  HTTP/2 (1 connection, multiplexed)                                     │
│  ═══════════════════════════════════════════════════════════════════     │
│                                                                         │
│  0ms    75ms   125ms  185ms                                             │
│  │──TCP──│─TLS──│─ALL──│                                                │
│  │ 75ms  │ 50ms │      │                                                │
│  │       │      │ Stream 1: R1 ──►  ◄── 200 OK                         │
│  │       │      │ Stream 2: R2 ──►  ◄── 200 OK  (đồng thời!)           │
│  │       │      │ Stream 3: R3 ──►  ◄── 200 OK                         │
│  │       │      │ Stream 4: R4 ──►  ◄── 200 OK                         │
│  │       │      │ Stream 5: R5 ──►  ◄── 200 OK                         │
│                                                                         │
│  TỔNG THỜI GIAN: 125ms + 60ms = 185ms                                  │
│  TỔNG OVERHEAD:  75ms + 50ms + ~1600 + 4×~200 bytes = ~2400 bytes      │
│  ✅ 1 connection, HPACK nén headers từ request thứ 2+                   │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════     │
│  WebSocket (1 connection, persistent)                                   │
│  ═══════════════════════════════════════════════════════════════════     │
│                                                                         │
│  0ms    75ms   125ms  150ms 175ms 200ms 225ms 250ms                     │
│  │──TCP──│─TLS──│─UPG──│─M1─│─M2─│─M3─│─M4─│─M5─│                     │
│  │ 75ms  │ 50ms │ 25ms │    │    │    │    │    │                       │
│  │       │      │      │ Mỗi message: ~25ms (0.5 RTT + 10ms server)    │
│                                                                         │
│  TCP Handshake:     75ms                                                │
│  TLS Handshake:     50ms                                                │
│  WS Upgrade:        25ms  (1 HTTP request/response)                     │
│  Mỗi Message:      ~25ms  (0.5 RTT + server processing)                │
│  Headers/msg:      ~6 bytes (frame header only!)                        │
│                                                                         │
│  TỔNG THỜI GIAN: 150ms (setup) + 125ms (5 messages) = 275ms            │
│  TỔNG OVERHEAD:  75ms + 50ms + 25ms + (5 × ~6 bytes) = ~30 bytes       │
│                                                                         │
│  ⚠️ Setup chậm hơn HTTP/2 (thêm WS upgrade)                            │
│  ✅ NHƯNG: Messages sau đó CỰC NHANH và CỰC NHẸ                       │
│  ✅ Và: Client có thể GỬI bất kỳ lúc nào (không cần request mới)       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Biểu đồ chi phí tích lũy theo số lượng messages

```
┌─────────────────────────────────────────────────────────────────┐
│  TỔNG OVERHEAD (bytes) THEO SỐ LƯỢNG MESSAGES                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Overhead                                                       │
│  (bytes)                                                        │
│  │                                                              │
│  │                                              HTTP/1.1        │
│  │                                           ╱  (mỗi msg       │
│  80K│                                       ╱    ~1600 bytes)   │
│  │                                       ╱                      │
│  │                                    ╱                          │
│  │                                 ╱                             │
│  60K│                           ╱                                │
│  │                           ╱                                   │
│  │                        ╱                                      │
│  │                     ╱                                         │
│  40K│               ╱                                            │
│  │               ╱          HTTP/2                               │
│  │            ╱          ╱  (HPACK: ~200 bytes/msg sau lần 1)   │
│  │         ╱          ╱                                          │
│  20K│   ╱          ╱                                             │
│  │   ╱        ╱                                                  │
│  │╱        ╱                                                     │
│  │      ╱     SSE (~20 bytes/msg)                                │
│  │   ╱  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                │
│  │╱═══════════════════════════════════════════ WebSocket          │
│  └──────────────────────────────────────────── (~6 bytes/msg)   │
│  0    10    20    30    40    50   Messages                      │
│                                                                 │
│  📊 Tại 50 messages:                                            │
│  HTTP/1.1:  ~80,000 bytes overhead                              │
│  HTTP/2:    ~11,400 bytes overhead (85% ít hơn HTTP/1.1)        │
│  SSE:       ~1,000 bytes overhead  (98.75% ít hơn HTTP/1.1)    │
│  WebSocket: ~300 bytes overhead    (99.6% ít hơn HTTP/1.1)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Khi nào HTTP đủ tốt? Khi nào cần WebSocket/SSE?

```
┌─────────────────────────────────────────────────────────────────┐
│              DECISION MATRIX DỰA TRÊN CHI PHÍ                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ HTTP/2 ĐỦ TỐT khi:                                         │
│  • Request-Response pattern (client hỏi, server trả lời)       │
│  • Tần suất thấp (< 1 request/giây)                            │
│  • Không cần server push data chủ động                          │
│  • Ví dụ: REST API, CRUD operations, form submissions          │
│  • Trong dự án: GET /products, POST /orders, PATCH /users      │
│                                                                 │
│  ✅ SSE TỐT HƠN khi:                                            │
│  • Server cần push data liên tục → client                       │
│  • One-way communication (server → client)                      │
│  • Text-based streaming                                         │
│  • Cần auto-reconnect                                           │
│  • Ví dụ: AI streaming, live scores, stock prices               │
│  • Trong dự án: AI Assistant streaming responses                │
│                                                                 │
│  ✅ WebSocket TỐT NHẤT khi:                                     │
│  • Two-way real-time communication                              │
│  • High-frequency messaging (> 1 msg/giây)                      │
│  • Cần latency cực thấp (gaming, trading)                       │
│  • Cần rooms/namespaces để group connections                    │
│  • Ví dụ: Chat, notifications, collaborative editing            │
│  • Trong dự án: Chat system, Payment notifications              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> 📊 **Tóm tắt PHẦN 1**: HTTP truyền thống có 3 loại chi phí chính: (1) TCP/TLS handshake cho mỗi connection mới, (2) Headers overhead cho mỗi request, (3) Head-of-Line blocking. HTTP/2 giải quyết phần lớn nhưng vẫn không thay thế được WebSocket/SSE cho real-time use cases. Hiểu rõ chi phí này giúp bạn chọn đúng công nghệ cho từng feature.

