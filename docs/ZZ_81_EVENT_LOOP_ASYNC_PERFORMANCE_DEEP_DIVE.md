# 🧠 Deep Dive: Event Loop, Async Programming & Performance Optimization trong Node.js

> **Mục đích**: Tài liệu chuyên sâu dành cho phỏng vấn Backend (4-6 năm kinh nghiệm)
> **Tài liệu liên quan**: [ZZ_33 - Single Thread vs Concurrency](./ZZ_33_NODEJS_SINGLE_THREAD_VS_CONCURRENCY.md) | [ZZ_36 - Blocking vs Non-Blocking](./ZZ_36_BLOCKING_VS_NON_BLOCKING_NODEJS_CHI_TIET.md) | [ZZ_32 - Giải pháp Read hiệu năng cao](./ZZ_32_GIAI_PHAP_READ_HIEU_NANG_CAO_NODEJS.md)

---

## 📋 MỤC LỤC

- [PHẦN 1: EVENT LOOP - Trái Tim của Node.js](#phần-1-event-loop---trái-tim-của-nodejs)
  - [1.1 Tổng quan kiến trúc Node.js](#11-tổng-quan-kiến-trúc-nodejs)
  - [1.2 Call Stack là gì?](#12-call-stack-là-gì)
  - [1.3 Các Phase của Event Loop](#13-các-phase-của-event-loop)
  - [1.4 Microtask Queue vs Macrotask Queue](#14-microtask-queue-vs-macrotask-queue)
  - [1.5 process.nextTick() vs Promise.then()](#15-processnexttick-vs-promisethen)
  - [1.6 setTimeout vs setImmediate](#16-settimeout-vs-setimmediate)
  - [1.7 libuv và Thread Pool](#17-libuv-và-thread-pool)
  - [1.8 Ví dụ thực hành Event Loop (7 bài)](#18-ví-dụ-thực-hành-event-loop-7-bài)
  - [1.9 Những hiểu lầm phổ biến](#19-những-hiểu-lầm-phổ-biến)
- [PHẦN 2: ASYNC PROGRAMMING - Lập Trình Bất Đồng Bộ](#phần-2-async-programming---lập-trình-bất-đồng-bộ)
  - [2.1 Hành trình tiến hóa: Callback → Promise → Async/Await](#21-hành-trình-tiến-hóa-callback--promise--asyncawait)
  - [2.2 Promise API chuyên sâu](#22-promise-api-chuyên-sâu)
  - [2.3 Error Handling trong Async Code](#23-error-handling-trong-async-code)
  - [2.4 Các Anti-Pattern cần tránh](#24-các-anti-pattern-cần-tránh)
  - [2.5 Best Practices cho Production](#25-best-practices-cho-production)
- [PHẦN 3: PERFORMANCE OPTIMIZATION - Tối Ưu Hiệu Năng](#phần-3-performance-optimization---tối-ưu-hiệu-năng)
  - [3.1 V8 Engine và Memory Management](#31-v8-engine-và-memory-management)
  - [3.2 CPU-bound vs I/O-bound](#32-cpu-bound-vs-io-bound)
  - [3.3 Worker Threads](#33-worker-threads)
  - [3.4 Clustering và Load Balancing](#34-clustering-và-load-balancing)
  - [3.5 Caching Strategies](#35-caching-strategies)
  - [3.6 Database Query Optimization](#36-database-query-optimization)
  - [3.7 Stream Processing](#37-stream-processing)
  - [3.8 Profiling và Monitoring Tools](#38-profiling-và-monitoring-tools)
  - [3.9 Checklist tối ưu Performance](#39-checklist-tối-ưu-performance)
- [PHẦN 4: CÂU HỎI PHỎNG VẤN THƯỜNG GẶP](#phần-4-câu-hỏi-phỏng-vấn-thường-gặp)

---

## PHẦN 1: EVENT LOOP - Trái Tim của Node.js

### 1.1 Tổng quan kiến trúc Node.js

Trước khi đi sâu vào Event Loop, bạn cần hiểu Node.js được cấu tạo từ những thành phần nào:

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                      │
│                  (JavaScript Code)                       │
├─────────────────────────────────────────────────────────┤
│                     NODE.JS API                          │
│          (fs, http, crypto, path, os, ...)               │
├──────────────────────┬──────────────────────────────────┤
│       V8 ENGINE      │           LIBUV                   │
│  (JavaScript Engine) │  (Async I/O, Event Loop,          │
│  - Parsing           │   Thread Pool, Timers,            │
│  - Compiling         │   File System, Network)           │
│  - Executing JS      │                                   │
│  - Memory Mgmt       │                                   │
│  - Garbage Collection│                                   │
├──────────────────────┴──────────────────────────────────┤
│                 OPERATING SYSTEM                          │
│        (Linux: epoll, macOS: kqueue, Win: IOCP)          │
└─────────────────────────────────────────────────────────┘
```

**Giải thích từng thành phần:**

- **V8 Engine** (Google): Biên dịch và thực thi JavaScript. Quản lý bộ nhớ (Heap) và Call Stack.
- **libuv** (C library): Cung cấp Event Loop, Thread Pool, và các API bất đồng bộ. Đây là "bí mật" giúp Node.js xử lý hàng ngàn kết nối đồng thời.
- **Node.js API**: Các module built-in (`fs`, `http`, `crypto`...) là cầu nối giữa JavaScript và libuv/OS.

> 💡 **Điểm mấu chốt**: JavaScript chạy trên 1 thread duy nhất (V8), nhưng I/O được xử lý bởi libuv (multi-thread hoặc OS kernel). Đây là lý do Node.js "single-threaded" nhưng vẫn xử lý concurrent I/O.

---

### 1.2 Call Stack là gì?

**Call Stack** (ngăn xếp gọi hàm) là cấu trúc dữ liệu LIFO (Last In, First Out) mà V8 dùng để theo dõi việc thực thi các hàm.

```javascript
// Ví dụ minh họa Call Stack
function multiply(a, b) {
  return a * b           // 3️⃣ Thực thi → pop ra khỏi stack
}

function square(n) {
  return multiply(n, n)  // 2️⃣ Gọi multiply → push vào stack
}

function printSquare(n) {
  const result = square(n) // 1️⃣ Gọi square → push vào stack
  console.log(result)
}

printSquare(5)
```

**Quá trình Call Stack hoạt động:**

```
Bước 1: printSquare(5)     → Stack: [printSquare]
Bước 2: square(5)          → Stack: [printSquare, square]
Bước 3: multiply(5, 5)     → Stack: [printSquare, square, multiply]
Bước 4: return 25          → Stack: [printSquare, square]  (multiply pop ra)
Bước 5: return 25          → Stack: [printSquare]          (square pop ra)
Bước 6: console.log(25)    → Stack: [printSquare, console.log]
Bước 7: done               → Stack: []                     (tất cả pop ra)
```

> ⚠️ **Quan trọng**: Khi Call Stack đang bận (có hàm đang chạy), Event Loop KHÔNG THỂ đưa callback nào vào. Đây là lý do tại sao code đồng bộ nặng sẽ "block" toàn bộ ứng dụng.

---

### 1.3 Các Phase của Event Loop

Event Loop trong Node.js có **6 phase**, chạy theo thứ tự vòng lặp:

```
   ┌───────────────────────────┐
┌─>│      1. TIMERS            │  ← setTimeout(), setInterval()
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  2. PENDING CALLBACKS     │  ← I/O callbacks bị trì hoãn
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │  3. IDLE, PREPARE         │  ← Nội bộ Node.js (bạn không cần quan tâm)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐      ┌───────────────┐
│  │      4. POLL              │<─────┤  incoming:     │
│  │  (Quan trọng nhất!)       │      │  connections,  │
│  └─────────────┬─────────────┘      │  data, etc.    │
│  ┌─────────────┴─────────────┐      └───────────────┘
│  │      5. CHECK             │  ← setImmediate()
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤  6. CLOSE CALLBACKS       │  ← socket.on('close', ...)
   └───────────────────────────┘
```

**Chi tiết từng phase:**

#### Phase 1: Timers ⏰

Thực thi các callback đã được lên lịch bởi `setTimeout()` và `setInterval()`.

```javascript
// setTimeout KHÔNG đảm bảo chính xác thời gian
setTimeout(() => {
  console.log('Timer callback') // Chạy SAU ít nhất 100ms, có thể lâu hơn
}, 100)
```

> 💡 **Lưu ý quan trọng**: `setTimeout(fn, 100)` nghĩa là callback sẽ được thực thi **SAU ÍT NHẤT 100ms**, không phải chính xác 100ms. Nếu Call Stack đang bận hoặc có nhiều callback trong queue, thời gian thực tế sẽ lâu hơn.

#### Phase 2: Pending Callbacks 📋

Thực thi các I/O callback bị trì hoãn từ vòng lặp trước. Ví dụ: một số callback lỗi TCP.

#### Phase 3: Idle, Prepare 🔧

Chỉ dùng nội bộ bởi Node.js. Bạn không cần quan tâm phase này.

#### Phase 4: Poll 📡 (Quan trọng nhất!)

Đây là phase **quan trọng nhất** của Event Loop:

1. **Tính toán thời gian cần block** để chờ I/O
2. **Xử lý các event trong poll queue** (I/O callbacks)
3. Nếu poll queue trống:
   - Nếu có `setImmediate()` → chuyển sang phase Check
   - Nếu không → chờ callback được thêm vào poll queue

```javascript
const fs = require('fs')

// Callback này sẽ được xử lý trong Poll phase
fs.readFile('file.txt', (err, data) => {
  console.log('File đã đọc xong') // Chạy trong Poll phase
})
```

#### Phase 5: Check ✅

Thực thi callback của `setImmediate()`. Phase này chạy ngay sau Poll phase.

```javascript
setImmediate(() => {
  console.log('setImmediate callback') // Chạy trong Check phase
})
```

#### Phase 6: Close Callbacks 🔒

Xử lý các callback đóng kết nối, ví dụ `socket.on('close', ...)`.

---

### 1.4 Microtask Queue vs Macrotask Queue

Đây là khái niệm **CỰC KỲ QUAN TRỌNG** mà nhiều developer hiểu sai.

```
┌─────────────────────────────────────────────────────────┐
│                    MICROTASK QUEUE                        │
│  (Ưu tiên CAO NHẤT - chạy GIỮA mỗi phase)              │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  1. process.nextTick() Queue  ← Ưu tiên #1     │     │
│  └─────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────┐     │
│  │  2. Promise Queue (.then/.catch/.finally)       │     │
│  │     ← Ưu tiên #2                                │     │
│  └─────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────┤
│                    MACROTASK QUEUE                        │
│  (Các phase của Event Loop)                              │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  3. setTimeout / setInterval  ← Timers phase    │     │
│  └─────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────┐     │
│  │  4. I/O Callbacks             ← Poll phase      │     │
│  └─────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────┐     │
│  │  5. setImmediate              ← Check phase     │     │
│  └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Quy tắc vàng 🏆:**

> **SAU MỖI PHASE (hoặc sau mỗi macrotask), Node.js sẽ xử lý TOÀN BỘ microtask queue trước khi chuyển sang phase tiếp theo.**

Thứ tự ưu tiên:
1. **process.nextTick()** - Cao nhất, chạy trước tất cả
2. **Promise callbacks** (.then, .catch, .finally) - Sau nextTick
3. **Macrotasks** (setTimeout, setImmediate, I/O) - Sau khi microtask queue trống

```javascript
// Minh họa thứ tự ưu tiên
console.log('1: Synchronous')

setTimeout(() => console.log('5: setTimeout (macrotask)'), 0)

Promise.resolve().then(() => console.log('3: Promise (microtask)'))

process.nextTick(() => console.log('2: nextTick (microtask - ưu tiên cao nhất)'))

console.log('4: Synchronous cuối')

// Output:
// 1: Synchronous
// 4: Synchronous cuối
// 2: nextTick (microtask - ưu tiên cao nhất)
// 3: Promise (microtask)
// 5: setTimeout (macrotask)
```

---

### 1.5 process.nextTick() vs Promise.then()

Cả hai đều là microtask, nhưng `process.nextTick()` có **ưu tiên cao hơn**.

```javascript
// Ví dụ chứng minh nextTick ưu tiên hơn Promise
Promise.resolve().then(() => {
  console.log('Promise 1')
  process.nextTick(() => console.log('nextTick bên trong Promise'))
})

process.nextTick(() => {
  console.log('nextTick 1')
  Promise.resolve().then(() => console.log('Promise bên trong nextTick'))
})

// Output:
// nextTick 1
// Promise bên trong nextTick
// Promise 1
// nextTick bên trong Promise
```

**Giải thích:**
1. `nextTick 1` chạy trước vì nextTick queue được xử lý trước Promise queue
2. `Promise bên trong nextTick` chạy tiếp vì nó được thêm vào Promise queue
3. `Promise 1` chạy tiếp
4. `nextTick bên trong Promise` chạy cuối cùng (được thêm vào nextTick queue mới)

> ⚠️ **Cảnh báo**: Nếu bạn gọi `process.nextTick()` đệ quy liên tục, nó sẽ **"starve" (bỏ đói) Event Loop** vì microtask queue không bao giờ trống, các phase khác không bao giờ được chạy!

```javascript
// ❌ NGUY HIỂM: Starving Event Loop
function recursiveNextTick() {
  process.nextTick(recursiveNextTick) // Event Loop bị block vĩnh viễn!
}
recursiveNextTick()

// setTimeout này KHÔNG BAO GIỜ chạy được
setTimeout(() => console.log('Tôi không bao giờ được in ra'), 0)
```

---

### 1.6 setTimeout vs setImmediate

Đây là câu hỏi phỏng vấn **kinh điển**. Thứ tự phụ thuộc vào **ngữ cảnh gọi**.

#### Trường hợp 1: Gọi trong main module (top-level code)

```javascript
// Trong main module → THỨ TỰ KHÔNG XÁC ĐỊNH
setTimeout(() => console.log('setTimeout'), 0)
setImmediate(() => console.log('setImmediate'))

// Output có thể là:
// setTimeout → setImmediate
// HOẶC
// setImmediate → setTimeout
```

**Tại sao không xác định?** Vì `setTimeout(fn, 0)` thực tế là `setTimeout(fn, 1)` (Node.js clamp minimum 1ms). Khi Event Loop bắt đầu, nếu 1ms đã trôi qua → setTimeout chạy trước. Nếu chưa → setImmediate chạy trước (vì Poll phase chuyển sang Check phase).

#### Trường hợp 2: Gọi bên trong I/O callback

```javascript
const fs = require('fs')

fs.readFile(__filename, () => {
  // Bên trong I/O callback → setImmediate LUÔN LUÔN chạy trước
  setTimeout(() => console.log('setTimeout'), 0)
  setImmediate(() => console.log('setImmediate'))
})

// Output LUÔN LUÔN là:
// setImmediate
// setTimeout
```

**Tại sao?** Vì khi đang trong I/O callback (Poll phase), sau khi Poll phase kết thúc, Event Loop chuyển sang Check phase (setImmediate) trước khi quay lại Timers phase (setTimeout).

```
Poll phase (I/O callback đang chạy)
    ↓
Check phase (setImmediate chạy ở đây) ← TRƯỚC
    ↓
Close callbacks phase
    ↓
Timers phase (setTimeout chạy ở đây) ← SAU
```

---

### 1.7 libuv và Thread Pool

**libuv** là thư viện C cung cấp Event Loop và async I/O cho Node.js.

```
┌──────────────────────────────────────────────────────┐
│                      LIBUV                            │
│                                                       │
│  ┌─────────────┐    ┌──────────────────────────────┐ │
│  │ Event Loop  │    │      Thread Pool              │ │
│  │ (1 thread)  │    │  (mặc định 4 threads)        │ │
│  │             │    │                               │ │
│  │ - Timers    │    │  Xử lý các tác vụ:           │ │
│  │ - Poll      │    │  - fs.* (đọc/ghi file)       │ │
│  │ - Check     │    │  - dns.lookup()               │ │
│  │ - Close     │    │  - crypto (pbkdf2, scrypt)    │ │
│  │             │    │  - zlib (nén/giải nén)        │ │
│  └─────────────┘    └──────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │          OS Kernel Async Mechanisms               │ │
│  │  (KHÔNG dùng thread pool)                         │ │
│  │                                                    │ │
│  │  - Network I/O (TCP/UDP/HTTP)                     │ │
│  │  - DNS resolve (dns.resolve, KHÔNG phải lookup)   │ │
│  │  - Pipes                                           │ │
│  │  - Signals                                         │ │
│  │                                                    │ │
│  │  Linux: epoll | macOS: kqueue | Windows: IOCP     │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Điểm quan trọng cần nhớ:**

| Tác vụ | Dùng Thread Pool? | Cơ chế |
|--------|-------------------|--------|
| `fs.readFile()` | ✅ Có | Thread Pool |
| `fs.readFileSync()` | ❌ Không | Block main thread |
| `http.get()` | ❌ Không | OS Kernel (epoll/kqueue) |
| `dns.lookup()` | ✅ Có | Thread Pool |
| `dns.resolve()` | ❌ Không | OS Kernel |
| `crypto.pbkdf2()` | ✅ Có | Thread Pool |
| `zlib.gzip()` | ✅ Có | Thread Pool |

**Tăng kích thước Thread Pool:**

```javascript
// Mặc định: 4 threads
// Tối đa: 1024 threads
// Đặt TRƯỚC khi import bất kỳ module nào
process.env.UV_THREADPOOL_SIZE = '8'

// Hoặc khi chạy:
// UV_THREADPOOL_SIZE=8 node app.js
```

**Ví dụ chứng minh Thread Pool giới hạn:**

```javascript
const crypto = require('crypto')

const start = Date.now()

// Chạy 4 tác vụ crypto song song (= số thread mặc định)
for (let i = 0; i < 4; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
    console.log(`Task ${i + 1}: ${Date.now() - start}ms`)
  })
}

// Output (xấp xỉ):
// Task 1: 85ms   ← Cả 4 chạy song song
// Task 2: 86ms   ← vì có 4 threads
// Task 3: 87ms
// Task 4: 88ms

// Nếu chạy 8 tác vụ:
for (let i = 0; i < 8; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
    console.log(`Task ${i + 1}: ${Date.now() - start}ms`)
  })
}

// Output (xấp xỉ):
// Task 1-4: ~85ms   ← Batch 1 (4 threads)
// Task 5-8: ~170ms  ← Batch 2 (phải chờ batch 1 xong)
```

---

### 1.8 Ví dụ thực hành Event Loop (7 bài)

#### 📝 Bài 1: Cơ bản - Thứ tự thực thi

```javascript
console.log('A')

setTimeout(() => console.log('B'), 0)

Promise.resolve().then(() => console.log('C'))

process.nextTick(() => console.log('D'))

console.log('E')
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
A
E
D
C
B
```

**Giải thích:**
1. `A` - Synchronous, chạy ngay
2. `setTimeout` - Đăng ký vào Timers queue (macrotask)
3. `Promise.then` - Đăng ký vào Promise microtask queue
4. `process.nextTick` - Đăng ký vào nextTick microtask queue
5. `E` - Synchronous, chạy ngay
6. Call Stack trống → xử lý microtasks:
   - `D` (nextTick ưu tiên cao hơn Promise)
   - `C` (Promise)
7. Microtask queue trống → xử lý macrotask:
   - `B` (setTimeout)

</details>

---

#### 📝 Bài 2: Nested microtasks

```javascript
process.nextTick(() => {
  console.log('nextTick 1')
  process.nextTick(() => console.log('nextTick 2'))
  Promise.resolve().then(() => console.log('Promise 1'))
})

Promise.resolve().then(() => {
  console.log('Promise 2')
  process.nextTick(() => console.log('nextTick 3'))
  Promise.resolve().then(() => console.log('Promise 3'))
})
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
nextTick 1
nextTick 2
Promise 1
Promise 2
nextTick 3
Promise 3
```

**Giải thích chi tiết:**
1. Đăng ký: nextTick queue = [cb1], Promise queue = [cb2]
2. Xử lý nextTick queue trước:
   - `nextTick 1` → thêm nextTick 2 vào nextTick queue, thêm Promise 1 vào Promise queue
   - nextTick queue còn [nextTick 2] → xử lý tiếp
   - `nextTick 2`
3. nextTick queue trống → xử lý Promise queue:
   - `Promise 1`
   - `Promise 2` → thêm nextTick 3 vào nextTick queue, thêm Promise 3 vào Promise queue
4. Có nextTick mới → xử lý nextTick trước:
   - `nextTick 3`
5. nextTick trống → tiếp tục Promise queue:
   - `Promise 3`

</details>

---

#### 📝 Bài 3: setTimeout vs setImmediate trong I/O

```javascript
const fs = require('fs')

fs.readFile(__filename, () => {
  console.log('I/O callback')

  setTimeout(() => console.log('setTimeout trong I/O'), 0)
  setImmediate(() => console.log('setImmediate trong I/O'))

  process.nextTick(() => console.log('nextTick trong I/O'))
  Promise.resolve().then(() => console.log('Promise trong I/O'))
})

console.log('Main script')
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
Main script
I/O callback
nextTick trong I/O
Promise trong I/O
setImmediate trong I/O
setTimeout trong I/O
```

**Giải thích:**
1. `Main script` - Synchronous
2. File đọc xong → I/O callback chạy trong Poll phase
3. `I/O callback` - Synchronous trong callback
4. Microtasks chạy trước macrotasks:
   - `nextTick trong I/O` (ưu tiên cao nhất)
   - `Promise trong I/O`
5. Sau Poll → Check phase:
   - `setImmediate trong I/O`
6. Vòng lặp tiếp → Timers phase:
   - `setTimeout trong I/O`

</details>

---

#### 📝 Bài 4: Nhiều setTimeout với delay khác nhau

```javascript
setTimeout(() => console.log('timeout 0ms'), 0)
setTimeout(() => console.log('timeout 10ms'), 10)
setTimeout(() => console.log('timeout 0ms (2)'), 0)

setImmediate(() => console.log('immediate 1'))
setImmediate(() => console.log('immediate 2'))

process.nextTick(() => console.log('nextTick'))
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
nextTick
timeout 0ms
timeout 0ms (2)
immediate 1
immediate 2
timeout 10ms
```

**Giải thích:**
1. `nextTick` - Microtask, chạy đầu tiên
2. Timers phase: `timeout 0ms` và `timeout 0ms (2)` (cả hai đều 0ms/1ms)
3. Poll phase → Check phase: `immediate 1`, `immediate 2`
4. Vòng lặp tiếp, Timers phase: `timeout 10ms` (sau 10ms)

> Lưu ý: Thứ tự `timeout 0ms` vs `immediate 1` có thể thay đổi ở top-level (xem mục 1.6)

</details>

---

#### 📝 Bài 5: async/await và Event Loop

```javascript
async function main() {
  console.log('1: Trước await')

  const result = await Promise.resolve('resolved')
  console.log('2: Sau await -', result)

  console.log('3: Tiếp tục sau await')
}

console.log('4: Trước main()')
main()
console.log('5: Sau main()')

setTimeout(() => console.log('6: setTimeout'), 0)
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
4: Trước main()
1: Trước await
5: Sau main()
2: Sau await - resolved
3: Tiếp tục sau await
6: setTimeout
```

**Giải thích:**
1. `4: Trước main()` - Synchronous
2. Gọi `main()`:
   - `1: Trước await` - Synchronous
   - `await Promise.resolve('resolved')` → tạm dừng hàm, phần còn lại trở thành microtask
3. `5: Sau main()` - Synchronous (main() đã yield control)
4. Call Stack trống → xử lý microtasks:
   - `2: Sau await - resolved` (phần sau await = microtask)
   - `3: Tiếp tục sau await`
5. Macrotask: `6: setTimeout`

> 💡 **Quan trọng**: `await` thực chất là syntax sugar cho `.then()`. Code sau `await` được đưa vào Promise microtask queue.

</details>

---

#### 📝 Bài 6: Bài toán phức tạp - Kết hợp tất cả

```javascript
console.log('1')

setTimeout(() => {
  console.log('2')
  process.nextTick(() => console.log('3'))
  Promise.resolve().then(() => console.log('4'))
}, 0)

Promise.resolve().then(() => {
  console.log('5')
  setTimeout(() => console.log('6'), 0)
})

process.nextTick(() => {
  console.log('7')
  setTimeout(() => console.log('8'), 0)
  process.nextTick(() => console.log('9'))
})

setImmediate(() => {
  console.log('10')
  process.nextTick(() => console.log('11'))
})

console.log('12')
```

<details>
<summary>👉 Bấm để xem đáp án và giải thích</summary>

```
1
12
7
9
5
2
3
4
10
11
6
8
```

**Giải thích từng bước:**

**Bước 1 - Synchronous:**
- `1` và `12` chạy ngay

**Bước 2 - Microtasks (nextTick trước):**
- `7` (nextTick) → đăng ký setTimeout(8) và nextTick(9)
- `9` (nextTick mới, xử lý hết nextTick trước)

**Bước 3 - Microtasks (Promise):**
- `5` (Promise) → đăng ký setTimeout(6)

**Bước 4 - Timers phase:**
- `2` (setTimeout 0ms) → đăng ký nextTick(3) và Promise(4)
- Microtasks giữa phase: `3` (nextTick), `4` (Promise)

**Bước 5 - Check phase:**
- `10` (setImmediate) → đăng ký nextTick(11)
- Microtask: `11` (nextTick)

**Bước 6 - Timers phase (vòng tiếp):**
- `6` và `8` (setTimeout được đăng ký ở bước 2 và 3)

</details>

---

#### 📝 Bài 7: Bài toán thực tế - HTTP Server

```javascript
const http = require('http')
const fs = require('fs')

const server = http.createServer((req, res) => {
  // Mỗi request đến → callback này chạy trong Poll phase

  console.log('1: Request nhận được')

  // Đọc file → giao cho Thread Pool
  fs.readFile('data.json', (err, data) => {
    console.log('2: File đọc xong')

    // Xử lý dữ liệu (synchronous - block Event Loop!)
    const parsed = JSON.parse(data)

    process.nextTick(() => {
      console.log('3: nextTick sau khi đọc file')
    })

    setImmediate(() => {
      console.log('4: setImmediate - gửi response')
      res.end(JSON.stringify(parsed))
    })
  })

  console.log('5: Tiếp tục xử lý request khác')
})

// Thứ tự cho mỗi request:
// 1: Request nhận được
// 5: Tiếp tục xử lý request khác
// 2: File đọc xong
// 3: nextTick sau khi đọc file
// 4: setImmediate - gửi response
```

<details>
<summary>👉 Bấm để xem giải thích chi tiết</summary>

**Đây là cách Node.js xử lý concurrent requests:**

1. Request 1 đến → callback chạy, `fs.readFile` giao cho Thread Pool
2. Request 2 đến → callback chạy ngay (Event Loop không bị block)
3. Request 3 đến → callback chạy ngay
4. File của Request 1 đọc xong → callback vào Poll queue
5. File của Request 2 đọc xong → callback vào Poll queue
6. ...

**Đây chính là sức mạnh của Event Loop**: Một thread duy nhất có thể xử lý hàng ngàn request đồng thời vì I/O không block thread chính.

</details>

---

### 1.9 Những hiểu lầm phổ biến

| # | Hiểu lầm ❌ | Sự thật ✅ |
|---|-------------|-----------|
| 1 | "Node.js là single-threaded" | JavaScript chạy trên 1 thread, nhưng Node.js (libuv) dùng nhiều thread cho I/O |
| 2 | "setTimeout(fn, 0) chạy ngay lập tức" | Nó được lên lịch vào Timers phase, chạy SAU microtasks và SAU ít nhất 1ms |
| 3 | "setImmediate chạy ngay lập tức" | Nó chạy trong Check phase, SAU Poll phase |
| 4 | "process.nextTick là một phần của Event Loop" | Nó được xử lý GIỮA các phase, không thuộc phase nào |
| 5 | "Tất cả async operations dùng Thread Pool" | Chỉ file I/O, dns.lookup, crypto, zlib dùng Thread Pool. Network I/O dùng OS kernel |
| 6 | "Promise nhanh hơn callback" | Hiệu năng tương đương, Promise chỉ cung cấp API tốt hơn |
| 7 | "async/await biến code thành synchronous" | Nó vẫn là async, chỉ là syntax sugar cho Promise |
| 8 | "Event Loop chạy trong một thread riêng" | Event Loop chạy trên CÙNG thread với JavaScript |

---

## PHẦN 2: ASYNC PROGRAMMING - Lập Trình Bất Đồng Bộ

### 2.1 Hành trình tiến hóa: Callback → Promise → Async/Await

#### Giai đoạn 1: Callbacks (Node.js ban đầu)

```javascript
// ❌ Callback Hell - "Pyramid of Doom"
getUser(userId, (err, user) => {
  if (err) return handleError(err)
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err)
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err)
      getPayment(details.paymentId, (err, payment) => {
        if (err) return handleError(err)
        console.log('Payment:', payment)
        // Thêm nữa? Thêm indent nữa... 😱
      })
    })
  })
})
```

**Vấn đề của Callbacks:**
- **Callback Hell**: Code lồng nhau sâu, khó đọc
- **Error handling phức tạp**: Phải check `err` ở mỗi level
- **Inversion of Control**: Bạn "giao" control cho hàm khác, không biết callback có được gọi đúng không
- **Khó compose**: Khó kết hợp nhiều async operations

#### Giai đoạn 2: Promises (ES6 / 2015)

```javascript
// ✅ Promise chain - Phẳng hơn, dễ đọc hơn
getUser(userId)
  .then(user => getOrders(user.id))
  .then(orders => getOrderDetails(orders[0].id))
  .then(details => getPayment(details.paymentId))
  .then(payment => console.log('Payment:', payment))
  .catch(err => handleError(err)) // Một chỗ xử lý lỗi duy nhất!
```

**Promise có 3 trạng thái:**

```
┌──────────┐     resolve(value)     ┌───────────┐
│ PENDING  │ ─────────────────────> │ FULFILLED │
│ (chờ)    │                        │ (thành    │
└──────────┘                        │  công)    │
     │                              └───────────┘
     │         reject(reason)       ┌───────────┐
     └─────────────────────────────>│ REJECTED  │
                                    │ (thất bại)│
                                    └───────────┘
```

> 💡 **Quan trọng**: Promise là **immutable** - một khi đã fulfilled hoặc rejected, trạng thái KHÔNG THỂ thay đổi.

#### Giai đoạn 3: Async/Await (ES2017)

```javascript
// ✅ Async/Await - Đọc như synchronous code
async function processPayment(userId) {
  try {
    const user = await getUser(userId)
    const orders = await getOrders(user.id)
    const details = await getOrderDetails(orders[0].id)
    const payment = await getPayment(details.paymentId)
    console.log('Payment:', payment)
    return payment
  } catch (err) {
    handleError(err) // try/catch quen thuộc
  }
}
```

**Async/Await thực chất là gì?**

```javascript
// Hai đoạn code này HOÀN TOÀN TƯƠNG ĐƯƠNG:

// Async/Await version
async function fetchData() {
  const data = await fetch('/api/data')
  return data.json()
}

// Promise version (compiler biến async/await thành dạng này)
function fetchData() {
  return fetch('/api/data').then(data => data.json())
}
```

---

### 2.2 Promise API chuyên sâu

#### Promise.all() - Chạy song song, fail nhanh

```javascript
// Tất cả chạy ĐỒNG THỜI, trả về khi TẤT CẢ hoàn thành
// Nếu BẤT KỲ promise nào reject → TOÀN BỘ reject ngay lập tức

const [users, products, orders] = await Promise.all([
  fetchUsers(),      // 200ms
  fetchProducts(),   // 300ms
  fetchOrders(),     // 150ms
])
// Tổng thời gian: ~300ms (max của 3 cái), KHÔNG PHẢI 650ms

// ⚠️ Nếu fetchProducts() reject → Promise.all reject ngay
// fetchUsers() và fetchOrders() vẫn chạy nhưng kết quả bị bỏ qua
```

#### Promise.allSettled() - Chạy song song, không fail

```javascript
// Tất cả chạy ĐỒNG THỜI, CHỜ TẤT CẢ hoàn thành (kể cả reject)
const results = await Promise.allSettled([
  fetchUsers(),
  fetchProducts(),   // Giả sử cái này reject
  fetchOrders(),
])

// results = [
//   { status: 'fulfilled', value: [...users] },
//   { status: 'rejected', reason: Error('Product API down') },
//   { status: 'fulfilled', value: [...orders] },
// ]

// Xử lý kết quả
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Task ${index}: Thành công`, result.value)
  } else {
    console.log(`Task ${index}: Thất bại`, result.reason)
  }
})
```

#### Promise.race() - Ai nhanh nhất thắng

```javascript
// Trả về kết quả của promise HOÀN THÀNH ĐẦU TIÊN (fulfilled hoặc rejected)

// Use case: Timeout pattern
async function fetchWithTimeout(url, timeoutMs) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout!')), timeoutMs)
    ),
  ])
}

// Nếu fetch mất > 5000ms → reject với 'Timeout!'
const data = await fetchWithTimeout('/api/data', 5000)
```

#### Promise.any() - Ai thành công đầu tiên thắng

```javascript
// Trả về kết quả của promise FULFILLED ĐẦU TIÊN
// Chỉ reject khi TẤT CẢ đều reject (AggregateError)

// Use case: Fallback servers
async function fetchFromFastestServer() {
  return Promise.any([
    fetch('https://server1.com/api/data'),  // Chậm
    fetch('https://server2.com/api/data'),  // Nhanh nhất → trả về cái này
    fetch('https://server3.com/api/data'),  // Lỗi
  ])
}
```

#### So sánh tổng hợp

| Method | Chờ tất cả? | Fail khi nào? | Use case |
|--------|-------------|---------------|----------|
| `Promise.all()` | Có | 1 reject → fail ngay | Cần TẤT CẢ kết quả |
| `Promise.allSettled()` | Có | Không bao giờ fail | Cần biết trạng thái từng cái |
| `Promise.race()` | Không | Cái đầu tiên reject | Timeout, racing |
| `Promise.any()` | Không | TẤT CẢ reject | Fallback, redundancy |

---

### 2.3 Error Handling trong Async Code

#### Pattern 1: try/catch với async/await (Khuyến nghị)

```javascript
// ✅ Best practice
async function createOrder(userId, items) {
  try {
    const user = await userRepo.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    const order = await orderRepo.create({ userId, items })
    await paymentService.charge(order.totalAmount)
    await emailService.sendConfirmation(user.email, order)

    return order
  } catch (error) {
    // Phân loại lỗi
    if (error instanceof NotFoundException) {
      throw error // Re-throw business errors
    }
    if (error instanceof PaymentError) {
      await orderRepo.markAsFailed(order.id)
      throw new BadRequestException('Payment failed')
    }
    // Lỗi không mong đợi
    logger.error('Unexpected error in createOrder', error)
    throw new InternalServerErrorException('Something went wrong')
  }
}
```

#### Pattern 2: Error-first callback (Legacy)

```javascript
// Cách cũ - vẫn thấy trong nhiều thư viện
fs.readFile('file.txt', (err, data) => {
  if (err) {
    console.error('Lỗi đọc file:', err)
    return
  }
  console.log('Dữ liệu:', data)
})
```

#### Pattern 3: Xử lý Unhandled Promise Rejections

```javascript
// ⚠️ NGUY HIỂM: Promise reject không được catch
async function dangerousFunction() {
  throw new Error('Oops!')
}
dangerousFunction() // UnhandledPromiseRejection!

// ✅ Luôn catch hoặc dùng try/catch
dangerousFunction().catch(err => console.error(err))

// ✅ Global handler (safety net, không nên dựa vào)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
  // Trong production: log và graceful shutdown
})
```

---

### 2.4 Các Anti-Pattern cần tránh

#### Anti-Pattern 1: Sequential await khi có thể chạy song song

```javascript
// ❌ BAD: Chạy tuần tự - tổng 600ms
async function getPageData() {
  const users = await fetchUsers()       // 200ms
  const products = await fetchProducts() // 300ms
  const orders = await fetchOrders()     // 100ms
  return { users, products, orders }
}

// ✅ GOOD: Chạy song song - tổng 300ms (max)
async function getPageData() {
  const [users, products, orders] = await Promise.all([
    fetchUsers(),       // 200ms ─┐
    fetchProducts(),    // 300ms ─┤ Chạy đồng thời
    fetchOrders(),      // 100ms ─┘
  ])
  return { users, products, orders }
}
```

#### Anti-Pattern 2: await trong vòng lặp

```javascript
// ❌ BAD: N+1 queries - mỗi iteration chờ cái trước xong
async function getOrdersWithDetails(orderIds) {
  const results = []
  for (const id of orderIds) {
    const order = await orderRepo.findById(id) // Chạy tuần tự!
    results.push(order)
  }
  return results
}

// ✅ GOOD: Batch query hoặc Promise.all
async function getOrdersWithDetails(orderIds) {
  // Cách 1: Batch query (tốt nhất)
  return orderRepo.findByIds(orderIds)

  // Cách 2: Promise.all (nếu không có batch API)
  return Promise.all(orderIds.map(id => orderRepo.findById(id)))
}
```

#### Anti-Pattern 3: Tạo Promise không cần thiết

```javascript
// ❌ BAD: Wrapping không cần thiết
async function getUser(id) {
  return new Promise((resolve, reject) => {
    try {
      const user = await userRepo.findById(id)
      resolve(user)
    } catch (err) {
      reject(err)
    }
  })
}

// ✅ GOOD: async function đã trả về Promise rồi
async function getUser(id) {
  return userRepo.findById(id)
}
```

#### Anti-Pattern 4: Quên return trong .then()

```javascript
// ❌ BAD: Quên return → promise chain bị đứt
fetchUser(1)
  .then(user => {
    fetchOrders(user.id) // Quên return! → Promise bị "nuốt"
  })
  .then(orders => {
    console.log(orders) // undefined! 😱
  })

// ✅ GOOD: Luôn return trong .then()
fetchUser(1)
  .then(user => {
    return fetchOrders(user.id) // Có return
  })
  .then(orders => {
    console.log(orders) // Có dữ liệu ✅
  })
```

#### Anti-Pattern 5: Mixing async/await với .then()

```javascript
// ❌ BAD: Trộn lẫn hai style
async function processData() {
  const user = await getUser(1)
  return getOrders(user.id).then(orders => {
    return orders.map(o => o.total)
  })
}

// ✅ GOOD: Dùng một style nhất quán
async function processData() {
  const user = await getUser(1)
  const orders = await getOrders(user.id)
  return orders.map(o => o.total)
}
```

---

### 2.5 Best Practices cho Production

```javascript
// 1. Luôn dùng async/await thay vì callbacks/raw promises
// 2. Dùng Promise.all() cho các tác vụ độc lập
// 3. Xử lý lỗi ở mọi nơi (try/catch, .catch(), global handler)
// 4. Tránh blocking Event Loop với tác vụ CPU-intensive
// 5. Dùng AbortController để cancel requests

// ✅ AbortController pattern (Node.js 16+)
async function fetchWithAbort(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    return await response.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Request bị hủy do timeout')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ✅ Concurrency control - Giới hạn số lượng chạy đồng thời
async function processWithConcurrency(items, concurrency, processor) {
  const results = []
  const executing = new Set()

  for (const item of items) {
    const promise = processor(item).then(result => {
      executing.delete(promise)
      return result
    })
    executing.add(promise)
    results.push(promise)

    if (executing.size >= concurrency) {
      await Promise.race(executing) // Chờ 1 cái xong mới tiếp tục
    }
  }

  return Promise.all(results)
}

// Sử dụng: Xử lý 100 items, tối đa 5 cái cùng lúc
await processWithConcurrency(items, 5, async (item) => {
  return processItem(item)
})
```

---

## PHẦN 3: PERFORMANCE OPTIMIZATION - Tối Ưu Hiệu Năng

### 3.1 V8 Engine và Memory Management

#### Cấu trúc bộ nhớ V8

```
┌─────────────────────────────────────────────────────┐
│                    V8 HEAP MEMORY                     │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              NEW SPACE (Young Gen)               │ │
│  │  ┌──────────────┐  ┌──────────────┐             │ │
│  │  │  Semi-space   │  │  Semi-space   │             │ │
│  │  │  (From)       │  │  (To)         │             │ │
│  │  │  1-8 MB       │  │  1-8 MB       │             │ │
│  │  └──────────────┘  └──────────────┘             │ │
│  │  → Scavenge GC (rất nhanh, ~1-2ms)              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              OLD SPACE (Old Gen)                  │ │
│  │  Kích thước: ~700MB (32-bit) / ~1.4GB (64-bit)  │ │
│  │                                                    │ │
│  │  → Mark-Sweep GC (chậm hơn, ~100-200ms)         │ │
│  │  → Mark-Compact GC (chống phân mảnh)             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Large Object Space | Code Space | Map Space      │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Quá trình Garbage Collection:**

1. **Scavenge (Minor GC)**: Dọn New Space, rất nhanh (~1-2ms). Object sống sót 2 lần → chuyển sang Old Space.
2. **Mark-Sweep (Major GC)**: Dọn Old Space, đánh dấu object đang dùng, xóa object không dùng.
3. **Mark-Compact**: Giống Mark-Sweep nhưng thêm bước nén bộ nhớ để chống phân mảnh.

**Tránh Memory Leak:**

```javascript
// ❌ Memory Leak: Global variable tích lũy
const cache = {} // Không bao giờ được dọn!
function processRequest(req) {
  cache[req.id] = req.data // Tích lũy mãi mãi
}

// ✅ Dùng Map với TTL hoặc LRU Cache
const LRU = require('lru-cache')
const cache = new LRU({
  max: 500,        // Tối đa 500 items
  ttl: 1000 * 60,  // TTL 1 phút
})

// ❌ Memory Leak: Event listener không được remove
class UserService {
  constructor(eventEmitter) {
    // Mỗi lần tạo instance → thêm 1 listener (không bao giờ remove!)
    eventEmitter.on('userUpdate', this.handleUpdate)
  }
}

// ✅ Cleanup event listeners
class UserService {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter
    this.handleUpdate = this.handleUpdate.bind(this)
    eventEmitter.on('userUpdate', this.handleUpdate)
  }

  destroy() {
    this.eventEmitter.off('userUpdate', this.handleUpdate)
  }
}

// ❌ Memory Leak: Closure giữ reference
function createHandler() {
  const hugeData = new Array(1000000).fill('x') // 1 triệu phần tử
  return function handler() {
    // hugeData bị giữ trong closure dù không dùng!
    console.log('handling...')
  }
}

// ✅ Không giữ reference không cần thiết
function createHandler() {
  const hugeData = new Array(1000000).fill('x')
  const result = processData(hugeData) // Xử lý xong
  return function handler() {
    console.log('handling with result:', result) // Chỉ giữ result nhỏ
  }
}
```

---

### 3.2 CPU-bound vs I/O-bound

```
┌─────────────────────────────────────────────────────────┐
│                    LOẠI TÁC VỤ                           │
│                                                           │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │    I/O-BOUND          │  │     CPU-BOUND             │ │
│  │                        │  │                            │ │
│  │  ✅ Node.js CỰC MẠNH  │  │  ⚠️ Node.js YẾU           │ │
│  │                        │  │                            │ │
│  │  - Database queries    │  │  - Image processing       │ │
│  │  - HTTP requests       │  │  - Video encoding         │ │
│  │  - File read/write     │  │  - Crypto hashing         │ │
│  │  - Network calls       │  │  - Data compression       │ │
│  │  - Email sending       │  │  - JSON parse (lớn)       │ │
│  │                        │  │  - Sorting (lớn)          │ │
│  │  → Event Loop xử lý   │  │  → Block Event Loop!      │ │
│  │    hàng ngàn đồng thời │  │  → Cần Worker Threads     │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Ví dụ: CPU-bound block Event Loop**

```javascript
// ❌ BAD: Fibonacci đệ quy block Event Loop
function fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

app.get('/fibonacci/:n', (req, res) => {
  const result = fibonacci(parseInt(req.params.n)) // Block 5-10 giây!
  res.json({ result })
  // Trong lúc tính toán, KHÔNG request nào khác được xử lý!
})

// ✅ GOOD: Dùng Worker Thread
const { Worker } = require('worker_threads')

app.get('/fibonacci/:n', (req, res) => {
  const worker = new Worker('./fibonacci-worker.js', {
    workerData: { n: parseInt(req.params.n) },
  })
  worker.on('message', result => res.json({ result }))
  worker.on('error', err => res.status(500).json({ error: err.message }))
  // Event Loop vẫn tự do xử lý request khác!
})
```

---

### 3.3 Worker Threads

Worker Threads cho phép chạy JavaScript trên nhiều thread thực sự.

```javascript
// main.js - Thread chính
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

if (isMainThread) {
  // Đây là main thread
  function runWorker(data) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: data })
      worker.on('message', resolve)
      worker.on('error', reject)
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker stopped with code ${code}`))
      })
    })
  }

  // Chạy 4 workers song song
  async function main() {
    const results = await Promise.all([
      runWorker({ task: 'hash', data: 'password1' }),
      runWorker({ task: 'hash', data: 'password2' }),
      runWorker({ task: 'hash', data: 'password3' }),
      runWorker({ task: 'hash', data: 'password4' }),
    ])
    console.log('Tất cả hoàn thành:', results)
  }

  main()
} else {
  // Đây là worker thread
  const crypto = require('crypto')
  const { task, data } = workerData

  if (task === 'hash') {
    const hash = crypto.pbkdf2Sync(data, 'salt', 100000, 64, 'sha512')
    parentPort.postMessage(hash.toString('hex'))
  }
}
```

**Khi nào dùng Worker Threads?**

| Tình huống | Dùng Worker? | Lý do |
|------------|-------------|-------|
| Đọc file | ❌ | libuv Thread Pool đã xử lý |
| HTTP request | ❌ | OS kernel async |
| Hash password | ✅ | CPU-intensive |
| Image resize | ✅ | CPU-intensive |
| JSON parse lớn (>100MB) | ✅ | Block Event Loop |
| Sorting 1 triệu items | ✅ | CPU-intensive |
| Database query | ❌ | I/O-bound, async tự nhiên |

---

### 3.4 Clustering và Load Balancing

Node.js Cluster module cho phép tạo nhiều process con, mỗi process có Event Loop riêng.

```javascript
const cluster = require('cluster')
const http = require('http')
const numCPUs = require('os').cpus().length

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} đang chạy`)
  console.log(`Tạo ${numCPUs} workers...`)

  // Fork workers = số CPU cores
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} đã chết. Tạo worker mới...`)
    cluster.fork() // Auto-restart
  })
} else {
  // Workers chia sẻ cùng TCP port
  http.createServer((req, res) => {
    res.writeHead(200)
    res.end(`Worker ${process.pid} xử lý request\n`)
  }).listen(3000)

  console.log(`Worker ${process.pid} đã khởi động`)
}

// Với 8 CPU cores:
// Master PID: 1234
// Worker PID: 1235 ─┐
// Worker PID: 1236  │
// Worker PID: 1237  ├─ Tất cả listen port 3000
// Worker PID: 1238  │  OS round-robin phân phối request
// Worker PID: 1239  │
// Worker PID: 1240  │
// Worker PID: 1241  │
// Worker PID: 1242 ─┘
```

> 💡 **Trong production**: Dùng PM2 thay vì tự viết cluster code:
> ```bash
> pm2 start app.js -i max  # Tạo workers = số CPU cores
> ```

---

### 3.5 Caching Strategies

#### Level 1: In-Memory Cache (nhanh nhất, mất khi restart)

```javascript
// Dùng Map hoặc LRU Cache
const LRU = require('lru-cache')

const l1Cache = new LRU({
  max: 1000,           // Tối đa 1000 items
  ttl: 1000 * 60 * 5,  // TTL 5 phút
  maxSize: 50 * 1024 * 1024, // Max 50MB
  sizeCalculation: (value) => JSON.stringify(value).length,
})

async function getProduct(id) {
  // Check L1 cache
  const cached = l1Cache.get(`product:${id}`)
  if (cached) return cached

  // Query DB
  const product = await productRepo.findById(id)
  l1Cache.set(`product:${id}`, product)
  return product
}
```

#### Level 2: Redis Cache (chia sẻ giữa các instances)

```javascript
// NestJS với Redis Cache
@Injectable()
export class ProductService {
  constructor(
    private readonly productRepo: ProductRepo,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getProduct(id: number): Promise<ProductType> {
    const cacheKey = `product:${id}`

    // Check Redis cache
    const cached = await this.cacheManager.get<ProductType>(cacheKey)
    if (cached) return cached

    // Query DB
    const product = await this.productRepo.findById(id)

    // Cache với TTL 1 giờ
    await this.cacheManager.set(cacheKey, product, 3600 * 1000)

    return product
  }

  async updateProduct(id: number, data: UpdateProductType): Promise<ProductType> {
    const product = await this.productRepo.update(id, data)

    // Invalidate cache khi update
    await this.cacheManager.del(`product:${id}`)

    return product
  }
}
```

#### Multi-Level Cache Pattern

```
Request → L1 (In-Memory) → L2 (Redis) → L3 (Database)
           ~0.01ms           ~1ms          ~10-100ms

Cache Miss Flow:
1. Check L1 → Miss
2. Check L2 → Miss
3. Query DB → Got data
4. Set L2 (TTL: 1 hour)
5. Set L1 (TTL: 5 minutes)
6. Return data

Cache Hit Flow:
1. Check L1 → Hit! → Return (~0.01ms)
```

---

### 3.6 Database Query Optimization

```javascript
// ❌ BAD: N+1 Query Problem
async function getOrdersWithProducts() {
  const orders = await prisma.order.findMany() // 1 query

  for (const order of orders) {
    // N queries! Nếu có 100 orders → 100 queries thêm
    order.products = await prisma.product.findMany({
      where: { orderId: order.id },
    })
  }
  return orders
}
// Tổng: 1 + N queries = 101 queries cho 100 orders 😱

// ✅ GOOD: Eager loading với include
async function getOrdersWithProducts() {
  return prisma.order.findMany({
    include: { products: true }, // JOIN trong 1 query
  })
}
// Tổng: 1-2 queries 🚀

// ✅ GOOD: Parallel queries cho pagination
async function getListUser(pagination) {
  const skip = (pagination.page - 1) * pagination.limit
  const take = pagination.limit

  // Chạy song song count và data
  const [totalItems, data] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      skip,
      take,
      include: { role: true },
    }),
  ])

  return {
    data,
    totalItems,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(totalItems / pagination.limit),
  }
}

// ✅ GOOD: Select chỉ những field cần thiết
async function getUserEmails() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      // Không lấy password, avatar, address... → giảm data transfer
    },
    where: { deletedAt: null },
  })
}

// ✅ GOOD: Cursor-based pagination (tốt hơn offset cho dataset lớn)
async function getMessages(conversationId, cursor, limit = 20) {
  return prisma.message.findMany({
    where: { conversationId },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}
```

---

### 3.7 Stream Processing

Streams giúp xử lý dữ liệu lớn mà không cần load toàn bộ vào memory.

```javascript
// ❌ BAD: Load toàn bộ file vào memory
const fs = require('fs')

app.get('/download', async (req, res) => {
  const data = await fs.promises.readFile('huge-file.csv') // 2GB vào RAM!
  res.send(data)
})

// ✅ GOOD: Stream - xử lý từng chunk
app.get('/download', (req, res) => {
  const stream = fs.createReadStream('huge-file.csv')
  stream.pipe(res) // Gửi từng chunk, memory usage ~64KB
})

// ✅ GOOD: Transform stream - xử lý dữ liệu on-the-fly
const { Transform } = require('stream')
const { pipeline } = require('stream/promises')

async function processLargeCSV(inputPath, outputPath) {
  const readStream = fs.createReadStream(inputPath)
  const writeStream = fs.createWriteStream(outputPath)

  const transform = new Transform({
    transform(chunk, encoding, callback) {
      // Xử lý từng chunk (không load toàn bộ vào RAM)
      const processed = chunk.toString().toUpperCase()
      callback(null, processed)
    },
  })

  await pipeline(readStream, transform, writeStream)
  console.log('Xử lý xong!')
}

// So sánh memory usage:
// Không dùng stream: 2GB file → 2GB RAM
// Dùng stream:       2GB file → ~64KB RAM (highWaterMark mặc định)
```

---

### 3.8 Profiling và Monitoring Tools

#### Công cụ phát hiện bottleneck

| Tool | Mục đích | Cách dùng |
|------|----------|-----------|
| `node --inspect` | Debug & profile | `node --inspect app.js` → Chrome DevTools |
| `clinic.js` | Phân tích tổng hợp | `clinic doctor -- node app.js` |
| `0x` | Flame graph (CPU) | `0x app.js` |
| `node --prof` | V8 profiler | `node --prof app.js` → `node --prof-process` |
| `process.memoryUsage()` | Memory snapshot | Gọi trong code |
| `perf_hooks` | Đo thời gian chính xác | Built-in module |

#### Đo performance trong code

```javascript
const { performance, PerformanceObserver } = require('perf_hooks')

// Cách 1: performance.now()
const start = performance.now()
await heavyOperation()
const duration = performance.now() - start
console.log(`Thời gian: ${duration.toFixed(2)}ms`)

// Cách 2: performance.mark() + measure()
performance.mark('db-query-start')
const users = await prisma.user.findMany()
performance.mark('db-query-end')
performance.measure('DB Query', 'db-query-start', 'db-query-end')

// Observer để log tự động
const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 1000) { // Log queries > 1 giây
      console.warn(`⚠️ Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
    }
  }
})
obs.observe({ entryTypes: ['measure'] })

// Cách 3: Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage()
  console.log({
    rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,       // Tổng RAM
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`, // Heap đang dùng
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`, // Heap tổng
    external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,  // C++ objects
  })
}, 30000) // Mỗi 30 giây

// Cách 4: Monitor Event Loop lag
let lastCheck = Date.now()
setInterval(() => {
  const now = Date.now()
  const lag = now - lastCheck - 1000 // Kỳ vọng 1000ms
  if (lag > 100) {
    console.warn(`⚠️ Event Loop lag: ${lag}ms`) // Lag > 100ms = có vấn đề
  }
  lastCheck = now
}, 1000)
```

---

### 3.9 Checklist tối ưu Performance

```
✅ EVENT LOOP
  □ Không có synchronous I/O (readFileSync, execSync...)
  □ Không có CPU-intensive code trên main thread
  □ Dùng Worker Threads cho tác vụ nặng
  □ Event Loop lag < 100ms

✅ ASYNC PROGRAMMING
  □ Dùng Promise.all() cho tác vụ độc lập
  □ Không có await trong vòng lặp
  □ Xử lý tất cả Promise rejections
  □ Dùng AbortController cho timeout

✅ MEMORY
  □ Không có memory leak (global vars, event listeners, closures)
  □ Dùng Stream cho file/data lớn
  □ Dùng LRU Cache thay vì plain object
  □ Monitor memory usage

✅ DATABASE
  □ Không có N+1 queries
  □ Dùng index đúng chỗ
  □ Dùng Promise.all() cho parallel queries
  □ Dùng select/include hợp lý
  □ Dùng cursor pagination cho dataset lớn
  □ Connection pooling

✅ CACHING
  □ Cache hot data (L1: in-memory, L2: Redis)
  □ Cache invalidation strategy
  □ TTL hợp lý cho từng loại data

✅ INFRASTRUCTURE
  □ Clustering (PM2 hoặc Kubernetes)
  □ Rate limiting
  □ Compression (gzip/brotli)
  □ Health checks
  □ Monitoring & alerting
```

---

## PHẦN 4: CÂU HỎI PHỎNG VẤN THƯỜNG GẶP

### 🎯 Event Loop

**Q1: Node.js là single-threaded hay multi-threaded?**
> JavaScript execution là single-threaded (1 Call Stack). Nhưng Node.js sử dụng libuv với Thread Pool (mặc định 4 threads) cho file I/O, crypto, zlib. Network I/O dùng OS kernel async (epoll/kqueue/IOCP). Nên nói chính xác: "JavaScript chạy trên 1 thread, nhưng Node.js runtime là multi-threaded."

**Q2: Giải thích thứ tự thực thi: setTimeout, setImmediate, process.nextTick, Promise.then?**
> 1. Synchronous code chạy trước
> 2. process.nextTick() (microtask, ưu tiên cao nhất)
> 3. Promise.then() (microtask)
> 4. setTimeout/setInterval (Timers phase)
> 5. setImmediate (Check phase)
> Đặc biệt: Trong I/O callback, setImmediate luôn chạy trước setTimeout.

**Q3: Event Loop có bao nhiêu phase? Kể tên?**
> 6 phases: Timers → Pending Callbacks → Idle/Prepare → Poll → Check → Close Callbacks. Microtasks (nextTick + Promise) được xử lý GIỮA mỗi phase.

**Q4: Khi nào Event Loop bị block? Cách khắc phục?**
> Bị block khi: CPU-intensive code (tính toán nặng, JSON parse lớn, regex phức tạp), synchronous I/O (readFileSync). Khắc phục: Worker Threads, child_process, chia nhỏ tác vụ với setImmediate(), dùng async API.

### 🎯 Async Programming

**Q5: Promise.all() vs Promise.allSettled() khác nhau thế nào?**
> `Promise.all()`: Reject ngay khi 1 promise reject. Dùng khi cần TẤT CẢ thành công.
> `Promise.allSettled()`: Chờ tất cả hoàn thành (kể cả reject). Trả về array với status 'fulfilled' hoặc 'rejected'. Dùng khi cần biết trạng thái từng promise.

**Q6: async/await có thực sự biến code thành synchronous không?**
> Không. async/await là syntax sugar cho Promise. Code sau `await` được đưa vào microtask queue. Nó chỉ TRÔNG GIỐNG synchronous nhưng vẫn là non-blocking async.

**Q7: Làm sao xử lý lỗi trong async code?**
> 3 cách: (1) try/catch với async/await, (2) .catch() với Promise chain, (3) Global handler `process.on('unhandledRejection')`. Best practice: Luôn dùng try/catch, phân loại lỗi (business vs system), log đầy đủ.

### 🎯 Performance Optimization

**Q8: Làm sao phát hiện memory leak trong Node.js?**
> Dùng `process.memoryUsage()` để monitor, `node --inspect` + Chrome DevTools Heap Snapshot, `clinic.js heapprofile`. Nguyên nhân phổ biến: global variables tích lũy, event listeners không remove, closures giữ reference lớn.

**Q9: N+1 query problem là gì? Cách giải quyết?**
> Khi query 1 list rồi loop query từng item → N+1 queries. Giải quyết: Eager loading (include/join), batch queries (WHERE IN), DataLoader pattern, hoặc denormalization.

**Q10: Khi nào dùng Worker Threads vs Cluster?**
> Worker Threads: Chia sẻ memory (SharedArrayBuffer), dùng cho CPU-intensive tasks trong cùng process. Cluster: Tạo process riêng biệt, dùng để scale HTTP server trên nhiều CPU cores. Cluster cho web server, Worker Threads cho tác vụ tính toán nặng.

---

## 📚 Tài liệu tham khảo

- [Node.js Official - Event Loop](https://nodejs.org/en/guides/event-loop-timers-and-nexttick)
- [Node.js Official - Don't Block the Event Loop](https://nodejs.org/en/guides/dont-block-the-event-loop)
- [libuv Documentation](https://docs.libuv.org/)
- [V8 Blog - Garbage Collection](https://v8.dev/blog/trash-talk)
- Tài liệu liên quan trong project:
  - [ZZ_33 - Single Thread vs Concurrency](./ZZ_33_NODEJS_SINGLE_THREAD_VS_CONCURRENCY.md)
  - [ZZ_36 - Blocking vs Non-Blocking chi tiết](./ZZ_36_BLOCKING_VS_NON_BLOCKING_NODEJS_CHI_TIET.md)
  - [ZZ_32 - Giải pháp Read hiệu năng cao](./ZZ_32_GIAI_PHAP_READ_HIEU_NANG_CAO_NODEJS.md)
  - [ZZ_58 - Performance Optimization Analysis](./ZZ_58_QUAN_TRỌNG_CẢI_THIỆN_PERFORMANCE_OPTIMIZATION_ANALYSIS_2025.md)

---

> 📝 **Ghi chú**: Tài liệu này được viết để chuẩn bị phỏng vấn Backend Node.js (4-6 năm kinh nghiệm). Nội dung tập trung vào hiểu sâu cơ chế hoạt động, không chỉ biết dùng. Khi phỏng vấn, hãy giải thích bằng ví dụ cụ thể và diagram để thể hiện sự hiểu biết sâu sắc.