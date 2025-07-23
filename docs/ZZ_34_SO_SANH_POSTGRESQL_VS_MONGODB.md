# So sánh chuyên sâu PostgreSQL vs MongoDB

## 1. Tổng quan về PostgreSQL và MongoDB

### PostgreSQL

- **Loại:** Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS)
- **Kiểu dữ liệu:** Bảng (table), dòng (row), cột (column), quan hệ (relationship)
- **Chuẩn:** Tuân thủ SQL (Structured Query Language)
- **Tính năng nổi bật:** ACID, transaction, join, trigger, view, stored procedure, schema mạnh mẽ

### MongoDB

- **Loại:** Hệ quản trị cơ sở dữ liệu NoSQL (document-oriented)
- **Kiểu dữ liệu:** Document (tài liệu) dạng BSON (JSON mở rộng), collection
- **Chuẩn:** Không dùng SQL, truy vấn bằng cú pháp riêng (Mongo Query Language)
- **Tính năng nổi bật:** Schema linh hoạt, horizontal scaling, lưu trữ dữ liệu phi cấu trúc

---

## 2. Kiến trúc dữ liệu & Schema

| Đặc điểm          | PostgreSQL (SQL)                      | MongoDB (NoSQL)                        |
| ----------------- | ------------------------------------- | -------------------------------------- |
| **Kiểu lưu trữ**  | Bảng (table), dòng, cột               | Collection, document (BSON/JSON)       |
| **Schema**        | Bắt buộc, chặt chẽ, định nghĩa trước  | Linh hoạt, không bắt buộc, dynamic     |
| **Quan hệ**       | Rõ ràng (foreign key, join)           | Không có join thực sự, dùng embed/link |
| **Tính toàn vẹn** | Ràng buộc mạnh (constraint, type, FK) | Yếu hơn, validation ở app hoặc schema  |

### Phân tích:

- **PostgreSQL**: Mọi dữ liệu phải tuân thủ schema định nghĩa trước, giúp kiểm soát dữ liệu, phát hiện lỗi sớm, phù hợp hệ thống phức tạp, nhiều quan hệ.
- **MongoDB**: Cho phép mỗi document trong cùng collection có cấu trúc khác nhau, dễ thay đổi, phù hợp dữ liệu phi cấu trúc, phát triển nhanh, nhưng dễ sinh lỗi dữ liệu nếu không kiểm soát tốt.

---

## 3. Truy vấn & Ngôn ngữ thao tác dữ liệu

| Đặc điểm              | PostgreSQL                      | MongoDB                               |
| --------------------- | ------------------------------- | ------------------------------------- |
| **Ngôn ngữ truy vấn** | SQL chuẩn, mạnh mẽ              | Mongo Query Language (JSON-like)      |
| **Join**              | Hỗ trợ join nhiều bảng phức tạp | Không join thực sự, phải aggregate    |
| **Transaction**       | ACID, multi-statement, nested   | Từ v4.0 có multi-document transaction |
| **Stored Procedure**  | Có (PL/pgSQL, PL/Python, ...)   | Không hỗ trợ stored procedure         |
| **Index**             | Đa dạng, mạnh mẽ                | Đơn giản hơn, chủ yếu single field    |

### Phân tích:

- **PostgreSQL**: Truy vấn phức tạp, join nhiều bảng, subquery, aggregate, transaction mạnh, phù hợp nghiệp vụ phức tạp, tài chính, kế toán.
- **MongoDB**: Truy vấn đơn giản, thao tác nhanh với document, join hạn chế (lookup), aggregate pipeline mạnh cho analytics, nhưng không phù hợp nghiệp vụ nhiều quan hệ.

---

## 4. Tính nhất quán & Transaction

| Đặc điểm        | PostgreSQL                             | MongoDB                                                                           |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| **ACID**        | Đảm bảo tuyệt đối                      | Chỉ đảm bảo ở mức document, từ v4.0 hỗ trợ multi-document nhưng hiệu năng giảm    |
| **Transaction** | Đa bảng, đa thao tác, rollback toàn bộ | Trước v4.0 chỉ 1 document, từ v4.0 hỗ trợ nhiều document nhưng không mạnh như SQL |
| **Consistency** | Rất cao, kiểm soát tốt                 | Tùy cấu hình, eventual consistency                                                |

### Phân tích:

- **PostgreSQL**: Đảm bảo dữ liệu luôn nhất quán, rollback toàn bộ khi lỗi, phù hợp hệ thống tài chính, ngân hàng, ERP.
- **MongoDB**: Mặc định chỉ đảm bảo atomicity ở mức document, multi-document transaction có nhưng hiệu năng giảm, phù hợp hệ thống cần tốc độ, chấp nhận eventual consistency.

---

## 5. Khả năng mở rộng (Scalability)

| Đặc điểm               | PostgreSQL                              | MongoDB                       |
| ---------------------- | --------------------------------------- | ----------------------------- |
| **Vertical scaling**   | Tốt, scale up server                    | Tốt                           |
| **Horizontal scaling** | Khó, cần sharding/phân mảnh phức tạp    | Rất mạnh, built-in sharding   |
| **Replication**        | Có, master-slave, streaming replication | Replica set, sharding dễ dàng |

### Phân tích:

- **PostgreSQL**: Chủ yếu scale up (nâng cấp máy chủ), scale out (phân mảnh) phức tạp, cần tool ngoài (Citus, sharding extension).
- **MongoDB**: Thiết kế để scale out, sharding, replica set dễ dàng, phù hợp big data, hệ thống phân tán, microservices.

---

## 6. Hiệu năng & Tình huống sử dụng thực tế

### PostgreSQL

- **Ưu điểm:**
  - Truy vấn phức tạp, join nhiều bảng, nghiệp vụ logic phức tạp
  - Dữ liệu cần tính nhất quán cao, transaction mạnh
  - Báo cáo, analytics, stored procedure
- **Nhược điểm:**
  - Schema cứng, thay đổi khó
  - Scale out phức tạp
- **Tình huống phù hợp:**
  - Hệ thống tài chính, ngân hàng, ERP, CRM, e-commerce lớn
  - Ứng dụng cần kiểm soát dữ liệu chặt chẽ

### MongoDB

- **Ưu điểm:**
  - Schema linh hoạt, phát triển nhanh
  - Scale out dễ dàng, phù hợp big data, IoT
  - Lưu trữ dữ liệu phi cấu trúc, log, analytics
- **Nhược điểm:**
  - Không phù hợp nghiệp vụ nhiều quan hệ, cần join phức tạp
  - Tính nhất quán thấp hơn, transaction hạn chế
- **Tình huống phù hợp:**
  - Ứng dụng startup, MVP, microservices
  - Hệ thống log, analytics, social network, IoT

---

## 7. Bảng so sánh tổng hợp

| Tiêu chí         | PostgreSQL (SQL)               | MongoDB (NoSQL)                     |
| ---------------- | ------------------------------ | ----------------------------------- |
| Kiểu dữ liệu     | Quan hệ (table)                | Document (BSON/JSON)                |
| Schema           | Cứng, định nghĩa trước         | Linh hoạt, dynamic                  |
| Join             | Mạnh, nhiều bảng               | Hạn chế, chủ yếu embed/link         |
| Transaction      | ACID, mạnh                     | Chỉ mạnh ở mức document             |
| Scale out        | Khó, cần tool ngoài            | Dễ, built-in sharding               |
| Phù hợp          | Tài chính, ERP, e-commerce lớn | Big data, log, social, IoT, startup |
| Hiệu năng        | Tốt với truy vấn phức tạp      | Tốt với dữ liệu lớn, phi cấu trúc   |
| Stored procedure | Có                             | Không                               |
| Index            | Đa dạng, mạnh                  | Đơn giản hơn                        |

---

## 8. Kết luận & Lời khuyên chọn lựa

- **Chọn PostgreSQL khi:**
  - Hệ thống cần kiểm soát dữ liệu chặt chẽ, nhiều quan hệ, nghiệp vụ phức tạp
  - Cần transaction mạnh, báo cáo, analytics, stored procedure
  - Dữ liệu không thay đổi cấu trúc thường xuyên

- **Chọn MongoDB khi:**
  - Dữ liệu phi cấu trúc, thay đổi linh hoạt
  - Cần scale out lớn, lưu trữ big data, log, IoT
  - Phát triển nhanh, MVP, microservices

> **Lưu ý:** Có thể kết hợp cả hai (polyglot persistence) cho hệ thống lớn: PostgreSQL cho nghiệp vụ core, MongoDB cho log, analytics, dữ liệu phi cấu trúc.

---

## 9. Ví dụ thực tế

### Ví dụ 1: E-commerce

- **PostgreSQL:** Lưu trữ user, order, payment, inventory (cần join, transaction)
- **MongoDB:** Lưu log truy cập, lịch sử tìm kiếm, sản phẩm recommendation (dữ liệu lớn, phi cấu trúc)

### Ví dụ 2: Social Network

- **PostgreSQL:** Lưu user, quan hệ bạn bè, transaction
- **MongoDB:** Lưu post, comment, like, activity stream

---

## 10. Tài liệu tham khảo

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [Martin Fowler - Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html)
