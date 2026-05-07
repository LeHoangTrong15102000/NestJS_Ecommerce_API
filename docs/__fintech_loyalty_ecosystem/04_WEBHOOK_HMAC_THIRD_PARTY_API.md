# Third-Party API Integration: Webhook, HMAC, Timeout/Retry

## Webhook là gì?

Webhook = HTTP callback. Thay vì app polling "thanh toán xong chưa?", payment gateway **gọi ngược** về app khi có event.

```
User → App → Payment Gateway (VNPay/MoMo)
                    ↓ (thanh toán xong)
              Webhook POST → App endpoint /webhooks/payment
                    ↓
              App verify signature → Cộng điểm loyalty
```

### Webhook Controller trong NestJS
```typescript
@Controller('webhooks')
export class WebhookController {
  @Post('payment')
  async handlePayment(@Req() req, @Res() res) {
    // 1. Verify signature TRƯỚC
    const isValid = this.verifyHMAC(req);
    if (!isValid) return res.status(401).send('Invalid signature');

    // 2. Idempotency check
    const processed = await this.redis.get(`webhook:${req.body.transactionId}`);
    if (processed) return res.status(200).send('Already processed');

    // 3. Process event
    await this.processPayment(req.body);

    // 4. Mark as processed
    await this.redis.set(`webhook:${req.body.transactionId}`, '1', 'EX', 86400);

    // 5. LUÔN trả 200 nhanh nhất có thể (gateway có timeout ngắn)
    return res.status(200).send('OK');
  }
}
```

**Lưu ý quan trọng:**
- Trả 200 nhanh, xử lý nặng đẩy vào Queue
- Nếu trả non-2xx → gateway sẽ retry → phải idempotent
- Log mọi webhook request để debug

## HMAC Signature Verification

### HMAC là gì?
Hash-based Message Authentication Code: dùng shared secret key để tạo hash từ payload → verify request đến từ đúng nguồn.

### Flow
```
Payment Gateway:
  payload + secretKey → HMAC-SHA256 → signature
  POST /webhook { payload, signature: "abc123..." }

Your Server:
  payload + secretKey → HMAC-SHA256 → expected_signature
  Compare signature === expected_signature
```

### Implementation
```typescript
import * as crypto from 'crypto';

function verifyHMAC(payload: string, receivedSignature: string, secretKey: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison (chống timing attack)
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}
```

### VNPay: HMAC-SHA512
```typescript
// VNPay dùng SHA512 và sort params trước khi hash
const sortedParams = sortObject(vnpParams);
const signData = querystring.stringify(sortedParams);
const hmac = crypto.createHmac('sha512', secretKey).update(signData).digest('hex');
```

### MoMo: HMAC-SHA256
```typescript
const rawSignature = `accessKey=${accessKey}&amount=${amount}&orderId=${orderId}&...`;
const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
```

**Security Tips:**
- LUÔN dùng `timingSafeEqual` thay vì `===` (chống timing attack)
- Secret key lưu trong env variable, KHÔNG hardcode
- Validate payload structure trước khi process
- Rate limit webhook endpoint

## Timeout & Retry khi gọi API bên ngoài

### Retry Strategy: Exponential Backoff + Jitter
```typescript
async function callExternalAPI(url: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 5000 }); // 5s timeout
      return response.data;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Non-retryable errors: 400, 401, 403, 404
      if (error.response?.status >= 400 && error.response?.status < 500) throw error;

      // Exponential backoff + jitter
      const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 1000;
      await sleep(baseDelay + jitter);
    }
  }
}
```

### Circuit Breaker Pattern
Khi API bên ngoài liên tục fail → ngừng gọi tạm thời → tránh cascade failure.

```
CLOSED (bình thường) → Gọi API
  ↓ (fail > threshold, vd: 5 fails liên tiếp)
OPEN (ngừng gọi) → Trả fallback/error ngay, không gọi API
  ↓ (sau timeout, vd: 30s)
HALF-OPEN (thử lại) → Gọi 1 request thử
  ↓ success → CLOSED
  ↓ fail → OPEN
```

```typescript
// NestJS với nestjs-opossum hoặc tự implement
class CircuitBreaker {
  private failCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextRetryTime: number;

  async call(fn: () => Promise<any>) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextRetryTime) throw new Error('Circuit is OPEN');
      this.state = 'HALF_OPEN';
    }
    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (err) {
      this.failCount++;
      if (this.failCount >= 5) {
        this.state = 'OPEN';
        this.nextRetryTime = Date.now() + 30000;
      }
      throw err;
    }
  }
}
```

### Timeout Best Practices

| Loại timeout | Giá trị | Lý do |
|-------------|---------|-------|
| Connect timeout | 3-5s | Nếu không connect được trong 5s → server down |
| Read timeout | 10-30s | Tùy API, payment gateway thường chậm hơn |
| Webhook response | < 5s | Gateway timeout ngắn, xử lý nặng đẩy vào queue |

## Câu hỏi phỏng vấn

1. **Tại sao cần verify HMAC cho webhook?** → Đảm bảo request đến từ đúng payment gateway, không bị giả mạo
2. **Webhook fail thì sao?** → Gateway retry, server phải idempotent. Nếu fail nhiều lần → alert team, check DLQ
3. **Tại sao dùng timingSafeEqual?** → So sánh `===` dừng sớm khi gặp ký tự khác → attacker đo thời gian đoán từng ký tự
4. **Circuit breaker vs retry?** → Retry: thử lại vài lần. Circuit breaker: ngừng hẳn khi detect service down, tránh overload
