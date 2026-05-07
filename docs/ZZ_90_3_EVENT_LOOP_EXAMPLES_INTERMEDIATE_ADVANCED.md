# Event Loop: Ví dụ Trung bình → Nâng cao

> Bổ sung cho ZZ_81 — Các bài tập giúp hiểu sâu hơn về Event Loop trong Node.js

---

## Bài 1 (Trung bình): async/await ẩn giấu microtask như thế nào?

```javascript
async function foo() {
  console.log('foo start');
  await bar();
  console.log('foo end');
}

async function bar() {
  console.log('bar start');
  await Promise.resolve();
  console.log('bar end');
}

console.log('script start');
foo();
console.log('script end');
```

<details>
<summary>Đáp án</summary>

```
script start
foo start
bar start
script end
bar end
foo end
```

**Giải thích:**

`await` thực chất là syntax sugar cho `.then()`. Khi gặp `await`, phần code SAU `await` được đẩy vào microtask queue.

1. `script start` — sync
2. Gọi `foo()` → `foo start` — sync
3. `await bar()` → gọi `bar()` → `bar start` — sync
4. `await Promise.resolve()` trong `bar` → `bar end` được schedule vào microtask queue. `bar()` return pending promise.
5. Vì `bar()` return pending promise, `foo end` cũng bị schedule (chờ `bar()` resolve trước).
6. `script end` — sync (call stack quay về main)
7. Microtask: `bar end` (Promise.resolve() đã resolved)
8. `bar()` hoàn thành → `foo end` được schedule vào microtask
9. Microtask: `foo end`

**Key insight:** Mỗi `await` tạo ra ít nhất 1 microtask boundary. Code sau `await` KHÔNG chạy ngay — nó chờ đến khi microtask queue được xử lý.

</details>

---

## Bài 2 (Trung bình): Timer accuracy và Event Loop blocking

```javascript
const start = Date.now();

setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 100);

setTimeout(() => {
  console.log(`Timer 2: ${Date.now() - start}ms`);
}, 200);

// Simulate CPU-bound work (block Event Loop 150ms)
const blockUntil = Date.now() + 150;
while (Date.now() < blockUntil) {}

console.log(`Blocking done: ${Date.now() - start}ms`);
```

<details>
<summary>Đáp án</summary>

```
Blocking done: ~150ms
Timer 1: ~150ms    (đáng lẽ 100ms!)
Timer 2: ~200ms
```

**Giải thích:**

1. `setTimeout(100)` và `setTimeout(200)` được đăng ký.
2. While loop block Event Loop 150ms — KHÔNG phase nào được chạy.
3. Sau 150ms, call stack trống → Event Loop bắt đầu.
4. Timers phase: Timer 1 đã quá hạn (100ms < 150ms) → chạy ngay. Thời gian thực tế ~150ms, KHÔNG phải 100ms.
5. Timer 2 chưa đến hạn (200ms > 150ms) → chờ.
6. Vòng loop tiếp: khi đủ 200ms → Timer 2 chạy.

**Key insight:** `setTimeout(fn, N)` nghĩa là "chạy SAU ÍT NHẤT N ms". Nếu Event Loop bị block, timer sẽ bị trễ. Đây là lý do KHÔNG BAO GIỜ nên có CPU-bound work trên main thread.

</details>

---

## Bài 3 (Trung bình-Nâng cao): Thứ tự giữa nhiều I/O callbacks và timers

```javascript
const fs = require('fs');

setTimeout(() => console.log('timeout 1'), 0);
setTimeout(() => console.log('timeout 2'), 0);

setImmediate(() => console.log('immediate 1'));
setImmediate(() => console.log('immediate 2'));

fs.readFile(__filename, () => {
  console.log('file read');
  setTimeout(() => console.log('timeout in IO'), 0);
  setImmediate(() => console.log('immediate in IO'));
  process.nextTick(() => console.log('nextTick in IO'));
  Promise.resolve().then(() => console.log('promise in IO'));
});

process.nextTick(() => console.log('nextTick 1'));
Promise.resolve().then(() => console.log('promise 1'));
```

<details>
<summary>Đáp án</summary>

```
nextTick 1
promise 1
timeout 1
timeout 2
immediate 1
immediate 2
file read
nextTick in IO
promise in IO
immediate in IO
timeout in IO
```

**Giải thích từng bước:**

**Bước 1 — Microtasks (trước khi vào phase đầu tiên):**
- `nextTick 1` (nextTick queue)
- `promise 1` (promise queue)

**Bước 2 — Timers phase:**
- `timeout 1`, `timeout 2` (cả hai đều 0ms, đã expired)

**Bước 3 — Poll phase:**
- Nếu file chưa đọc xong → chờ hoặc đi tiếp

**Bước 4 — Check phase:**
- `immediate 1`, `immediate 2`

**Bước 5 — (vòng loop sau) Poll phase khi file đọc xong:**
- `file read`
- Microtasks ngay sau callback: `nextTick in IO`, `promise in IO`

**Bước 6 — Check phase (cùng vòng):**
- `immediate in IO` (setImmediate trong I/O callback LUÔN chạy trước setTimeout 0)

**Bước 7 — Timers phase (vòng tiếp):**
- `timeout in IO`

**Key insight:** Trong I/O callback, `setImmediate` LUÔN chạy trước `setTimeout(fn, 0)` vì sau Poll phase là Check phase (setImmediate), rồi mới quay lại Timers phase ở vòng loop tiếp.

</details>

---

## Bài 4 (Nâng cao): Event Loop starvation với recursive microtasks

```javascript
let count = 0;

function scheduleWork() {
  if (count < 5) {
    count++;
    console.log(`nextTick ${count}`);
    process.nextTick(scheduleWork);
  }
}

setTimeout(() => console.log('setTimeout fires!'), 0);
setImmediate(() => console.log('setImmediate fires!'));

scheduleWork();

// Câu hỏi: Nếu thay count < 5 thành count < Infinity, chuyện gì xảy ra?
```

<details>
<summary>Đáp án</summary>

```
nextTick 1
nextTick 2
nextTick 3
nextTick 4
nextTick 5
setTimeout fires!
setImmediate fires!
```

**Giải thích:**

1. `scheduleWork()` chạy sync → `nextTick 1`, schedule nextTick tiếp.
2. Microtask queue: [scheduleWork]. Xử lý → `nextTick 2`, schedule tiếp.
3. Lặp lại cho đến `nextTick 5`. Sau đó count = 5, không schedule nữa.
4. Microtask queue trống → Event Loop tiếp tục.
5. Timers: `setTimeout fires!`
6. Check: `setImmediate fires!`

**Nếu count < Infinity:**
- `process.nextTick` liên tục schedule chính nó.
- Microtask queue KHÔNG BAO GIỜ trống.
- Event Loop KHÔNG BAO GIỜ chuyển sang phase tiếp theo.
- `setTimeout` và `setImmediate` KHÔNG BAO GIỜ chạy.
- → **Event Loop Starvation** (bỏ đói).
- Process sẽ chạy mãi, memory tăng dần, cuối cùng crash.

**Key insight:** `process.nextTick` recursive = nguy hiểm. Nếu cần schedule nhiều async work, dùng `setImmediate` thay vì `process.nextTick` — vì `setImmediate` chạy ở Check phase, cho phép các phase khác (Timers, Poll) được xử lý.

```javascript
// ✅ Safe alternative:
function safeRecursive() {
  setImmediate(() => {
    doWork();
    safeRecursive(); // Event Loop vẫn xử lý được timers, I/O giữa các lần gọi
  });
}
```

</details>

---

## Bài 5 (Nâng cao): Promise.resolve() vs new Promise() và timing

```javascript
console.log('1');

new Promise((resolve) => {
  console.log('2');
  resolve();
  console.log('3');
}).then(() => {
  console.log('4');
});

Promise.resolve().then(() => {
  console.log('5');
}).then(() => {
  console.log('6');
});

new Promise((resolve) => {
  console.log('7');
  setTimeout(() => {
    resolve();
    console.log('8');
  }, 0);
}).then(() => {
  console.log('9');
});

console.log('10');
```

<details>
<summary>Đáp án</summary>

```
1
2
3
7
10
4
5
6
8
9
```

**Giải thích:**

**Sync phase:**
- `1` — sync
- `new Promise(executor)` — executor chạy SYNC! → `2`
- `resolve()` — đánh dấu promise resolved, nhưng `.then()` callback vào microtask queue
- `3` — sync (resolve() KHÔNG dừng executor!)
- `Promise.resolve().then(...)` — schedule `5` vào microtask queue
- `new Promise(executor)` — executor chạy SYNC! → `7`
- `setTimeout` — schedule vào Timers queue (resolve chưa được gọi!)
- `10` — sync

**Microtask phase:**
- `4` — .then() của promise đầu tiên (đã resolved)
- `5` — .then() của Promise.resolve()
- `6` — .then() chain tiếp theo (scheduled bởi `5` resolve)

**Timers phase:**
- setTimeout callback chạy: `resolve()` → schedule `9` vào microtask, rồi `8`
- Microtask: `9`

**Key insights:**
1. `new Promise(executor)` — executor chạy ĐỒNG BỘ ngay lập tức.
2. `resolve()` không dừng execution — code sau resolve vẫn chạy.
3. `.then()` callback chỉ vào microtask queue SAU KHI promise resolved.
4. Promise chưa resolved (chờ setTimeout) → `.then()` callback chờ cho đến khi resolve được gọi.

</details>

---

## Bài 6 (Nâng cao): Real-world — Event Loop trong NestJS request lifecycle

```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// Simulate NestJS middleware + guard + handler pipeline
async function handleRequest() {
  console.log('1: Middleware start');

  // Simulate auth guard (async - DB lookup)
  await new Promise(resolve => {
    process.nextTick(() => {
      console.log('2: Auth guard (nextTick)');
      resolve();
    });
  });

  console.log('3: After auth guard');

  // Simulate parallel DB queries
  const [user, permissions] = await Promise.all([
    new Promise(resolve => setTimeout(() => {
      console.log('4: User fetched');
      resolve({ id: 1 });
    }, 10)),
    new Promise(resolve => setTimeout(() => {
      console.log('5: Permissions fetched');
      resolve(['read', 'write']);
    }, 5)),
  ]);

  console.log('6: Both queries done');

  // Emit event (synchronous!)
  emitter.emit('request:complete', user);

  console.log('8: Handler done');
}

emitter.on('request:complete', (user) => {
  console.log('7: Event listener (sync!)');
  // Schedule async side-effect
  setImmediate(() => console.log('9: Async side-effect'));
});

console.log('0: Before request');
handleRequest().then(() => console.log('10: Promise resolved'));
console.log('11: After handleRequest() call');
```

<details>
<summary>Đáp án</summary>

```
0: Before request
1: Middleware start
11: After handleRequest() call
2: Auth guard (nextTick)
3: After auth guard
5: Permissions fetched
4: User fetched
6: Both queries done
7: Event listener (sync!)
8: Handler done
10: Promise resolved
9: Async side-effect
```

**Giải thích:**

1. `0` — sync
2. `handleRequest()` bắt đầu → `1` — sync
3. Gặp `await` đầu tiên → function suspend, return pending promise
4. `11` — sync (main script tiếp tục)
5. Microtask: nextTick resolve → `2`, rồi `3` (sau await)
6. Gặp `await Promise.all(...)` → chờ cả 2 setTimeout
7. Timer 5ms xong trước → `5: Permissions fetched`
8. Timer 10ms xong → `4: User fetched`
9. Cả hai resolved → `6: Both queries done`
10. `emitter.emit()` là ĐỒNG BỘ → `7` chạy ngay trong cùng call stack
11. `8` — sync (sau emit)
12. `handleRequest()` return → `.then()` callback vào microtask → `10`
13. Check phase: `9` (setImmediate từ event listener)

**Key insights:**
1. `EventEmitter.emit()` là ĐỒNG BỘ — listeners chạy ngay, block caller.
2. `await` suspend function nhưng KHÔNG block Event Loop — main script tiếp tục.
3. `Promise.all` chờ TẤT CẢ resolve, nhưng callbacks chạy theo thứ tự hoàn thành (5ms trước 10ms).
4. Pattern thực tế: dùng `setImmediate` trong event listener để tránh block request pipeline.

</details>

---

## Bài 7 (Nâng cao): queueMicrotask vs process.nextTick vs Promise.resolve

```javascript
// Node.js 11+ có queueMicrotask (Web API standard)
queueMicrotask(() => {
  console.log('queueMicrotask 1');
  queueMicrotask(() => console.log('queueMicrotask 2'));
});

process.nextTick(() => {
  console.log('nextTick 1');
  process.nextTick(() => console.log('nextTick 2'));
});

Promise.resolve().then(() => {
  console.log('promise 1');
  queueMicrotask(() => console.log('queueMicrotask 3'));
  process.nextTick(() => console.log('nextTick 3'));
});
```

<details>
<summary>Đáp án</summary>

```
nextTick 1
nextTick 2
queueMicrotask 1
promise 1
queueMicrotask 2
queueMicrotask 3
nextTick 3
```

**Giải thích:**

Thứ tự ưu tiên microtasks trong Node.js:
1. **process.nextTick queue** — cao nhất, drain hết trước khi chuyển sang queue khác
2. **Promise microtask queue** (bao gồm `queueMicrotask` và `.then()`) — cùng queue

`queueMicrotask` và `Promise.resolve().then()` nằm CÙNG queue (promise microtask queue). Chúng chạy theo thứ tự FIFO trong queue đó.

**Bước 1:** Drain nextTick queue:
- `nextTick 1` → schedule `nextTick 2`
- `nextTick 2` (drain hết nextTick trước)

**Bước 2:** Drain promise microtask queue:
- `queueMicrotask 1` → schedule `queueMicrotask 2`
- `promise 1` → schedule `queueMicrotask 3` và `nextTick 3`

**Bước 3:** Có nextTick mới → drain nextTick trước:
- Chờ... thực ra Node.js xử lý hết promise queue hiện tại trước khi check nextTick lại.
- `queueMicrotask 2` (đã trong queue)
- `queueMicrotask 3` (đã trong queue)

**Bước 4:** Check nextTick:
- `nextTick 3`

**Key insight:** `queueMicrotask` = cùng priority với `Promise.then()`. Dùng `queueMicrotask` khi muốn microtask behavior mà không cần tạo Promise object (nhẹ hơn). `process.nextTick` vẫn ưu tiên cao nhất.

</details>

---

## Tổng kết — Mental Model

```
Khi Call Stack trống, Node.js xử lý theo thứ tự:

┌─────────────────────────────────────────────────────┐
│  1. process.nextTick queue (drain ALL)               │  ← Cao nhất
│  2. Promise microtask queue (drain ALL)              │
│     (bao gồm queueMicrotask + .then())              │
│  3. Nếu có nextTick mới từ bước 2 → quay lại 1     │
├─────────────────────────────────────────────────────┤
│  4. Event Loop phase tiếp theo:                      │
│     Timers → Pending → Poll → Check → Close         │
│                                                      │
│  SAU MỖI CALLBACK trong mỗi phase:                  │
│     → drain nextTick queue                           │
│     → drain promise microtask queue                  │
│     → rồi mới chạy callback tiếp theo               │
└─────────────────────────────────────────────────────┘
```

**Quy tắc vàng để trả lời phỏng vấn:**
1. Sync code chạy trước hết (call stack)
2. `process.nextTick` > `Promise.then`/`queueMicrotask` > `setTimeout(0)` > `setImmediate`
3. Trong I/O callback: `setImmediate` LUÔN trước `setTimeout(0)`
4. Microtasks drain HOÀN TOÀN giữa mỗi macrotask callback
5. `await` = `.then()` = tạo microtask boundary
6. `new Promise(executor)` — executor chạy SYNC
7. `EventEmitter.emit()` — chạy SYNC
