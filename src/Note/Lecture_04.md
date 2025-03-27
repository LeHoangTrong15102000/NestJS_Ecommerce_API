# Khoá học NestJS Super - API Ecommerce toàn diện nhất hiện tại

## Chương 6 Chức năng `Language`

## Bài 76 Tối ưu `Language` Schema và index deletedAt

- Sẽ tối ưu một chút xíu về cái `schema Prisma` của `Language` trước khi mà chúng ta bắt tay vào việc code.

- Thường thì ở phía FE nó sẽ lưu cái `Language Code` tức nhiên là nó lưu cái `LanguageId` cũng được nhưng mà thường sẽ lưu là cái `Language Code` và nó sẽ gửi cái `Language Code` lên cái API của chúng ta thông qua cái `Header` -> Nhận được cái `Language Code` thì chúng ta sẽ thực hiện câu lệnh query đầu tiên đến `schema Language` để mà tìm ra được cái `languageId` thì từ cái này chúng ta sẽ tìm ra được cái `translation` phù hợp của cái languageId đó

- Ở đây chúng ta có thể caching cái `language` này vì cái language này vài năm chúng ta có thể sẽ không đụng vào -> Nhờ vậy mà chúng ta có thể lấy ra ngay lập tức cái `language` đó -> Thì cách này cũng được -> Nhưng mà có một cách nó đơn giản hơn đó là chúng ta cái `Code của language` này thành khóa chính luôn

  - Thì ở đây chúng ta sẽ xóa đi cái trường `code` và lấy trường `id` làm trường `code` luôn để mà khỏi phải sửa -> Thì nó sẽ kiểu dữ liệu là `String` và giới hạn là 10 kí tự

  - Thì khi mà sửa cái `Language` lại như thế này thì mỗi lần mà chúng ta tạo cái `Language` thì chúng ta cần phải cung cấp cái trường `Id` cho nó chứ nó không có default được.

  - Thì khi mà sửa lại như thế này rồi thì những cái schema nào mà đang có `languageId Int` thì cần sửa lại là `languageId String` là được -> Thế là chỉnh sửa xong cái phần khóa chính trường `language`

- Tiếp theo nữa là về thằng deletedAt thì khi chúng ta query tất cả các language thì chúng ta sẽ query với `deletedAt` là `null` khi mà query như vậy thì chúng ta nên đánh `index` trường `deletedAt` này để mà query cho nó nhanh. -> `@@index([deletedAt])` đánh index như thế này cho nó là được

## Bài 77 Bài tập CRUD `Language`

- Thực hiện bài tập CRUD cho `Language`

- Đã hoàn thành việc CRUD cho `Language` rồi

## Bài 78 Hướng đẫn làm chức năng `Language`

- Đã hoàn thành việc CRUD cho `Language` rồi

## Chương 7 `Prisma Migrate`

## Bài 79 Vấn đề của Prisma db push

- Chúng ta sẽ bàn luận về vấn đề của `prisma migrate` -> Từ phần đầu đến giờ chúng ta luôn sử dụng câu lệnh `prisma db push` với `Single Source of Truth` (SSOT) là file `schema.prisma`

> Single Source of Truth (SSOT) ở đây có thể hiểu là cái nơi duy nhất chứa thông tin của database. Mọi thứ đều được sinh ra ở đây.

### Cách hoạt động

- Prisma so sánh schema trong file schema.prisma với trạng thái hiện tại của cơ sở dữ liệu.

- Nếu có sự khác biệt (ví dụ: thêm bảng, thay đổi kiểu dữ liệu), Prisma tự động áp dụng các thay đổi cần thiết.

- Không tạo file migration: Thay đổi được áp dụng trực tiếp mà không lưu lại lịch sử dưới dạng script SQL.

### Ưu nhược điểm

**Ưu điểm**:

- Migrate nhanh chóng, không cần phải tạo các file migration (`.sql`).

- Từ đó phù hợp cho giai đoạn phát thảo và thử nghiệm schema database, nên được sử dụng trong môi trường không quan trọng dữ liệu như development.

**Nhược điểm**:

- Không thể migration rollback (down migration), chỉ có thể push forward (Thực ra là có thể rollback thủ công bằng cách sửa lại file `schema.prisma` và push lại, nhưng đôi khi không push được đòi hỏi bạn phải sửa nhiều lần)

- Không lưu lịch sử migration, khó theo dõi thay đổi

- Cấu trúc database phụ thuộc vào prisma schema, nhưng prisma schema lại không có những tính năng đặc biệt của database như Partial Unique Indexes, Partial Indexes trên Postgresql. Vì vậy bạn bị giới hạn tính năng của database.

## 2. Thêm Prisma Migrate vào một database có sẵn

Có thể gọi là chuyển đổi từ cách dùng `prisma db push` sang `prisma migrate`.

Tham khảo: [Adding Prisma Migrate to an existing project](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#adding-prisma-migrate-to-an-existing-project)

Các bước thực hiện

### 1. Đồng bộ `schema.prisma` với database hiện tại

Nếu chưa có file `schema.prisma`, hãy tạo 1 file `schema.prisma` cơ bản kết nối với database hiện tại và chạy câu lệnh sau để prisma đọc database và cập nhật file `schema.prisma`:

```bash
prisma db pull
```

Nếu bạn đã có sẵn file `schema.prisma` do đang sử dụng cách `prisma db push`, thì hãy chạy lại câu lệnh `prisma db push` 1 lần nữa để chắc chắn là file `schema.prisma` đồng bộ với database hiện tại.

### 2. Tạo baseline migration

1. Tạo thư mục `prisma/migrations/0_init`
2. Dựa vào file `schema.prisma`, tạo file migration bằng câu lệnh sau

   ```bash
   npx prisma migrate diff \
   --from-empty \
   --to-schema-datamodel prisma/schema.prisma \
   --script > prisma/migrations/0_init/migration.sql
   ```

3. Đánh dấu là file `0_init/migration.sql` đã được áp dụng. Câu lệnh dưới đây sẽ không thay đổi cấu trúc database, nó chỉ cập nhật dữ liệu trong table `_prisma_migrations`

   ```bash
   npx prisma migrate resolve --applied 0_init
   ```

4. Bây giờ có thể coi là chúng ta đã chuyển từ `prisma db push` sang `prisma migrate` thành công. Commit lại file `schema.prisma` và thư mục `prisma/migrations` lên git.

## 3. Thêm một tính năng mà Prisma Schema không hỗ trợ

Để làm thì schema của các bạn phải sync với database hiện tại và dự án phải sử dụng `prisma migrate` thay vì `prisma db push`

Ví dụ mình muốn thêm Partial Unique Indexes vào một table trên Postgresql. Prisma Schema không hỗ trợ tính năng này, nhưng chúng ta có thể thêm bằng cách sửa file migration.

1. Tạo một file migration `npx prisma migrate dev --create-only`. Câu lệnh này yêu cầu Prisma kiểm tra **lịch sử các file migration**, **schema.prisma** với **trạng thái database** để tạo ra file migration mới. `--create-only` Tùy chọn này giới hạn hành động của lệnh chỉ ở bước tạo file migration, mà không thực hiện bước áp dụng (apply) migration vào cơ sở dữ liệu. Ở bước này thì nó sẽ tạo ra file sql rỗng

2. Paste nội dung sau vào file migration mới tạo

   ```sql
   CREATE UNIQUE INDEX permission_path_method_unique
   ON "Permission" (path, method)
   WHERE "deletedAt" IS NULL;
   ```

3. Chạy migration `npx prisma migrate dev`

## 4. Edit Custom Migration

Trong nhiều trường hợp khi thay đổi schema, nếu thực hiện migrate sẽ bị mất data. Để xử lý trường hợp này, chúng ta cần phải edit lại file migration

Tham khảo: [Customizing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)

### Workflow migration đúng

- Chạy `npx prisma migrate dev --create-only` để tạo file migration mới
- Sửa file migration mới tạo
- Chạy `npx prisma migrate dev` để áp dụng migration

Trong trường hợp bạn không sửa hoặc sửa sai, dẫn đến migration failed thì xem tiếp phần dưới

### Xử lý khi migration failed

- Đánh dấu rollback migration

  ```bash
  npx prisma migrate resolve --rolled-back <migration-name>
  ```

- Sửa file migration
- Redeploy migration

  ```bash
  npx prisma migrate deploy
  ```

> 🙏🏻Kinh nghiệm: Đừng tự ý sửa trực tiếp trên database, nếu bạn sửa trực tiếp trên database thì phải thêm câu lệnh vào migration file để đồng bộ với database

## Chương 8 Chức năng `Role-Permission`
