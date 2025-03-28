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

- Chúng ta sẽ bàn luận về vấn đề của `prisma migrate` -> Từ phần đầu đến giờ chúng ta luôn sử dụng câu lệnh `prisma db push` với `Single Source of Truth (SSOT)` là file `schema.prisma`

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

> > > > Thì cái câu lệnh trên nó tạo ra một cái file là `migration.sql` được generate ra từ cái file `schema.prisma` của chúng ta.

3. Đánh dấu là file `0_init/migration.sql` đã được áp dụng. Câu lệnh dưới đây sẽ không thay đổi cấu trúc database, nó chỉ cập nhật dữ liệu trong table `_prisma_migrations`.

   ```bash
   npx prisma migrate resolve --applied 0_init
   ```

> Tại sao chúng ta cần phải đánh dấu là nó `đã được áp dụng` -> Bởi vì tứ trước đến nay cái `schema.prisma` nó đã đồng bộ với cái thằng database của chúng ta rồi có nghĩa là cái `migration - 0_init` nó đã được chạy ở trong database rồi thì chúng ta cần phải đánh dấu nó `đã được áp dụng` -> Nên là cần chạy câu lệnh ở trên

- Thì cái câu lệnh ở trên `npx prisma migrate resolve --applied 0_init` nó chỉ cập nhật dự liệu trong cái table `_prisma_migrations`

- Và bây giờ cái `single source of truth (SSOT)` nó sẽ không còn phụ thuộc vào `schema.prisma` nữa mà nó sẽ phụ thuộc vào file `migrations`

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

## Bài 80 Chuyển đổi prisma db push sang prisma migrate

- Thực hiện chuyển đổi prisma db push sang prisma migrate thành công

## Bài 81 Thêm chức năng Partial Unique Index bằng Prisma Migrate

- Thực hiện thêm tính năng `Partial Unique Index` bằng `Prisma Migrate` -> Sẽ tìm hiểu và thực việc này

- Thì chúng ta sẽ coi lại cái schema `Permission` một chút đó là chúng ta mong muốn cái field `path` và `method - HTTP` nó phải unique theo cái cặp value của chúng ta -> Vì chúng ta không muốn người dùng phải tạo ra cái API là `permissions và method` giống như vậy nữa -> Nên là chúng ta sẽ đánh index cái cặp value `path và method` -> nhưng khi mà sử dụng cái cách này thì nó lại nảy sinh ra cái vấn đề mới đó là chúng ta đang sử dụng cái `soft-delete` -> Nên khi là chúng ta xóa cái API đó đi thì nó lại không cho phép chúng ta tạo lại cái `path - method` tương tự như vậy bởi vì chúng ta chỉ mới `soft - delete` mà thôi

  - Thì lúc đó chúng ta sẽ nghĩ rằng chúng ta sẽ thêm cái `deletedAt` vào trong để nhóm `@@unique` lại thì lúc này chúng ta lại nghĩ là những thằng chúng ta đã xóa thì `deletedAt` nó có giá trị -> Nên là chúng ta sẽ thử tạo lại cùng cái `path` và `method` giống như cái ban đầu chúng ta đã xóa -> Nghĩ rằng như thế là nó sẽ cho phép chúng tạo -> Nhưng không ở trong thằng `postgresql` nó coi `deletedAt=null` là giá trị khác nhau.

    - Ví dụ chúng ta tạo ra một cái `path=permission và method=GET deletedAt=null` và sau đó chúng ta lại tạo ra một `path=permission và method=GET deletedAt=null` nữa thì nó vẫn cho phép vì nó coi `deletedAt ở thằng item 1` và `deletedAt ở thằng item 2` là khác nhau -> Thế nó mới đau

    - Trong cái trường hợp này chúng ta sẽ áp dụng cái kỹ thuật là `Partial Unique Index` -> Thì chúng ta sẽ đánh `Unique Index` trên cái field `path` và `method` kèm theo điều kiện đó là `@@unique([path,method], {where: {deletedAt: null}})` có nghĩa là khi mà `deletedAt=null` thì chúng ta mới đánh cái `uniqueIndex` là `path và method` -> Điều này đảm bảo là những cái item mà tạo mới nó sẽ ko được trùng nhau về cái `path và method`

      - Còn những cái item đã bị xóa đi thì chúng ta không cần quan tâm về `path và method` nữa -> Thì ở trong cái thằng prisma nó lại không hỗ trợ cái kĩ thuật này -> Nên là để làm cái kĩ thuật này thì chúng ta cần phải `custom` cái file `migration`

- Nên là bây giờ chúng ta sẽ đi vào cái vấn đề là sẽ thêm vào một số tính năng mà `prisma.schema` nó không có hỗ trợ mình

  - Để mà làm được thì cái `schema` của chúng ta phải `sync` với `database` hiện tại -> Thì hiện tại chúng ta đã sync với database rồi và hiện tại chúng ta cũng đang sử dụng `prisma migrate`

  - Chúng ta có thể thêm bằng cách chỉnh sửa `migration` như sau:

    - Đầu tiên chúng ta sẽ tạo ra một file `migration` bằng câu lệnh đó là `npx prisma migrate dev --create-only` `--create-only` là tùy chọn nó sẽ giới hạn `thành động` của cái câu lệnh này `chỉ ở cái bước là tạo file migration thôi` mà nó sẽ không có `apply` vào bên trong database của chúng ta -> Thì ở cái bước này cái thằng `prisma` nó sẽ kiểm tra cái `file schema.prisma` với cái database để mà tạo ra cái file `migration` nếu như mà cái file `prisma.schema` nó đang được `đồng bộ` với database thì nó sẽ tạo ra được một cái `file migration rỗng`.

    - Thì cái cú pháp:

      ```ts
        @@unique([path,method], {where: {deletedAt: null}})
      ```

      Thì nó sẽ như bên dưới

      ```sql
      @@unique([path,method], {where: {deletedAt: null}})
      CREATE UNIQUE INDEX permission_path_method_unique ON "Permission" (path, method) WHERE "deletedAt" IS NULL
      ```

- Cái bước thứ 3 là chúng ta chạy câu lệnh `npx prisma migrate dev` thì cái câu lênh này nó sẽ sử dụng cái file `migration` mới nhất để mà nó apply vào bên trong `database` -> `npx prisma migrate dev` -> Thì lúc này khi mà refresh lại cái database thì chúng ta đã thấy được cái `Unique` vào bên trong cái bảng `Permission` được rồi

## Bài 82 Custom Migration

- Thực hiện `Custom Migration` ở trong `schema.prisma` của chúng ta

- Sẽ thực hiện demo thêm một số trường hợp khi mà chúng ta thao tác với `prisma migrate`

- Trong một số trường hợp khi mà thay đổi schema, nếu thực hiện migrate sẽ bị mất data. Để xử lý trường hợp này, chúng ta cần phải edit lại `file migration` trước khi mà chúng ta thực hiện lại câu lệnh `npx prisma migrate dev`

- Workflow migration đúng:

  - Chạy `npx prisma migrate dev --create-only` để tạo file migration mới
  - Sửa file migration mới tạo
  - Chạy `npx prisma migrate dev` để áp dụng migration

- Trong trường hợp chúng ta không sửa hoặc là sửa sai, dẫn đến việc `migration failed` thì chúng ta sẽ xử lý như thế nào

- Xử lý khi mà `Migration Failed`

```sql
ALTER TABLE "Permission" DROP COLUMN "description",
ADD COLUMN     "content" TEXT NOT NULL;
```

- Thì nếu mà chúng ta thực hiện như thế này thì chúng ta sẽ bị mất data -> Ở đây việc của chúng ta chỉ là rename `description` thành `content` cần việc gì mà chúng ta phải đi `drop column` rồi `add column`

  - Nên là chúng ta sẽ sửa cái câu lệnh lại đó là

  ```sql
    ALTER TABLE "Permission" RENAME COLUMN "description" TO "content"
  ```

  - Xong rồi sau đó chạy câu lệnh là `npx prisma migrate dev` -> Như thế này thì nó sẽ apply vào trong database mà không bị lỗi `reset database`

- Bây giờ chúng ta sẽ xử lý khi mà `migration failed`

  - Chúng ta vẫn sẽ thực hiện những câu lệnh như trên theo trình tự.

  - Chúng ta sẽ thực hiện đánh dấu `rollback migration`

    ```bash
      npx prisma migrate resolve --rolled-back <migration-name>
    ```

    - Sau khi mà nó có cái `rolled-back` rồi thì chúng ta tiến hành sửa cái file `migration` đó
    - Và sau đó chúng ta sẽ thực hiện `Sửa file migration`

    - Rồi tiếp đến chúng ta tiên hành redeploy migration nó lại

    ```bash
      npx prisma migrate deploy
    ```

> Kinh nghiệm đó chính là: Đừng tự ý sửa trực tiếp ở trên database, nếu mà sửa trực tiếp trên database thì phải thêm câu lệnh vào `migration` `Thì Single Source of Truth của chúng ta bây giờ là những cái file migration này` file để đồng bộ với database.

## Bài 83 Fix lỗi "The migration was modified after it was applied" và add thêm deletedById vào schema.prisma

## Chương 8 Chức năng `Role-Permission`

## Bài 84 Bài tập CRUD permission

## Bài 85 Hướng đẫn làm CRUD `Permission`

## Bài 86 Tạo script Create `Permission` hàng loạt

## Bài 87 Tạo script xóa hoặc tạo `Permission` dựa trên các endpoint hiện có

## Bài 88 Hướng dẫn down migration và bài tập CRUD `Roles`

## Bài 89 Hướng dẫn QueryRaw và CRUD `Roles`

## Bài 90 Cập nhật Zod Schema cho `Permission Role` và giải thích vì sao query không dùng Index

## Bài 91 Fix bug Permission đã được xóa mềm nhưng vẫn còn trong `Role`

## Bài 92 Cập nhật script add `Permisisons` vào `Admin Role`

## Bài 93 Kiểm tra `Role Permission` khi request

## Bài 94 Refactor `Authentication Guard`

## Bài 95 Ngăn chặn User thao tác trên `Base Role`

## Bài 96 Thêm cột `Module` vào `Permission` để mà `gom nhóm`

## Bài 97 Fix Bug khi `Role` bị vô hiệu hóa thì nên từ chối `request` & Không cho phép User chỉnh sửa `Base Role`
