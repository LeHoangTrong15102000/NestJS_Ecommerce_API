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

## Bài 83 Fix lỗi `The migration was modified after it was applied" và add thêm deletedById vào schema.prisma`

- Sẽ thực hiện fix cái vấn đề này

- Thì cái thằng `checksum` ở trong database nó sẽ phân biệt, checksum ở trong database `table migration` để mà biết cái file này nó đã được chỉnh sửa hay chưa nó có khác với cái file kia hay không thì nó dựa vào cái `checksum` -> Có thể thấy được là cùng một cái name migration đầu tiên nhưng mà có tới 2 cái file migration

  - Thì cái prisma nó check trong database có cái `checksum` `6a` nhưng trong cái `folder migration` thì t ko thấy có cái file nào là 6a hết

  - Trong cái trường hợp này thì chúng ta cần xóa cái `file migration` mà bị lỗi ở trong `database` -> Thì chỉ cần xóa cái `file migration bị lỗi` ở trong database đi là được mà thôi không cần phải sử dụng câu lệnh `npx prisma migrate reset` vì dùng câu lệnh này nó sẽ xóa hết data ở trong `database` của chúng ta -> Đây là một bài học

## Chương 8 Chức năng `Role-Permission`

## Bài 84 Bài tập CRUD permission

- Thực hiện `CRUD permission` có hỗ trợ phân trang -> Truyền phân trang thông qua `query` với `page và limit`

## Bài 85 Hướng đẫn làm CRUD `Permission`

- Đã hoàn thành việc CRUD cho `Permission`

## Bài 86 Tạo script Create `Permission` hàng loạt

- Viết script để mà tạo ra `Permission` hàng loạt dựa trên cái `List API Endpoint` của chúng ta -> Thì chúng ta cần phải `list` ra được các cái `API endpoint` đã -> Thì chúng ta sẽ lên `google` và `search` để mà tìm cách xử lý cái vấn đề đó

- Thì sau khi mà lên `google search` thì chúng ta sẽ tìm thấy được kết quả mà thôi -> Chúng ta mong muốn là khi mà nó chạy tạo permission thì nó sẽ exit ra khỏi cái `terminal` luôn -> Khi mà đã tạo xong thì chạy lại nó sẽ xảy ra lỗi đó là `Unique Constrants Path Method`

## Bài 87 Tạo script xóa hoặc tạo `Permission` dựa trên các endpoint hiện có

- Tạo script xóa hoặc là tạo `Permission` dựa trên các `Endpoint` hiện có

- Nếu mà cái `permission` trong `database` mà nó không tồn tại trong cái source code của mình thì chúng ta sẽ xóa nó đi và ngược lại, nếu mà trong source code chứa những cái route mà nó không tồn tại trong permission trong database thì chúng ta sẽ add vào -> Thì đó là 2 cái nhiệm vụ mà chúng ta cần phải làm -> Thì chúng ta sẽ chỉnh sửa trực tiếp trong cái file `create permissions` mà không cần phải tạo cái file mới

- Sẽ tiến hành so sánh để mà cái việc so sánh nó thuận lợi thì chúng ta sẽ tạo ra một cái object có cái key là `method-path`

## Bài 88 Hướng dẫn down migration và bài tập CRUD `Roles`

- Chúng ta sẽ cho unique cái `name` của `Role` khi mà `deletedAt` là null, nó cũng sẽ giống với khi mà chúng ta làm với thằng `permission`

- Thì bây giờ chúng ta sẽ xoá đi cái key `@unique` của cái field là `name` trong `Role` đi

- Khi mà migrate bị nhầm thì chúng ta sẽ làm như thế nào -> Thì bây giờ chúng ta sẽ cùng giải quyết luôn cái vấn đề đó

- Thì ban đầu chúng ta sẽ revert lại cái thằng `prisma`, chúng ta sẽ chạy câu lệnh `npx prisma migrate dev --create-only`

  - Thì ở trong cái `migration` chúng ta mới tạo này thì chúng ta sẽ thực hiện câu lệnh revert lại cái câu lệnh mà chúng ta viết sai ở trong `file migration` trước

  ```sql
    CREATE UNIQUE INDEX Role_name_unique
    ON "Role" (name)
    WHERE "deletedAt" IS NULL;

    revert lại thành
    DROP INDEX Role_name_unique (chỗ này sẽ tuỳ nơi mà ghi tên cái index cho nó đúng)
  ```

  - Sau đó chúng ta chạy câu lệnh `npx prisma migrate dev`

  -> Thì đến lúc này cái database của chúng ta coi như là đã revert thành công -> Thì 2 thằng migration ở bên trong dự án nó đã bù trừ cho nhau rồi -> Đến đây thì chúng ta có thể xoá nó đi được

  -> Sau khi mà xoá 2 cái `file migration` đi thì lúc này chúng ta sẽ tạo lại cái `migration` mới và `migrate` nó lên lại `database` là được

  -> Từ cái source code của chúng ta sau khi mà pull về thì cần chạy `npx prisma migrate deploy` để mà nó đưa các file migration chưa có lên database -> Sau đó thì cần `npx prisma migrate dev` để mà nó `sync` với database về cấu trúc và dữ liệu

## Bài 89 Hướng dẫn QueryRaw và CRUD `Roles`

- Thực hiện `QueryRaw` và `CRUD` `Roles`

- Hiện tại là nó đang bị lỗi ở cái chỗ đó là `where và truyền vào RoleName.Client` ở `RolesSevice` -> Do chúng ta làm `Partial Unique Name` khi mà cái `deletedAt là Null` cái chức năng này prisma nó không thiểu -> Bơi vì là nó không hỗ trợ nên là nó sẽ không hiểu được cái vấn đề này -> Khi mà nó không hiểu thì nó sẽ không có generate ra cái kiểu `type` cho nó đúng được.

  -> Nên là trong cái trường hợp này chúng ta cần phải sử dụng một cái `Method` là `QueryRaw`

- Khi mà sử dụng QueryRaw thì những cái biến ở bên ngoài truyền vào thì không cần sử dụng dấu nháy đơn `như này` là được

  - Sử dụng `IS` khi mà so sánh nó với `true` `false` hay là null not null đồ chẳng hạn -> Còn các trường hợp còn lại thì sử dụng toán tử là `=`

  - Khi mà chúng ta start cái app lên thì cái method register này nó đâu có chạy đâu

  - cái Method `getClientRoleId` này nó không có chạy khi mà chúng ta `start` cái app lên

  ```sql

    SELECT * FROM "Role" WHERE name = ${RoleName.Client} AND 'deletedAt' IS NULL LIMIT 1;
    Khi mà viết câu `queryRaw` như thế này thì nên sử dụng dấu `nháy kép` thay vì dấu `nháy đơn`.
  ```

- Ngoài cái roleItem ra thì chúng ta còn trả về mã `permission` nữa để mà cho thằng client nó hiển thị cho nó dễ

- Thì khi mà cập nhật `permission` ở trong role thì chúng ta sẽ truyển lên là `permissionIds` một cái mảng array chứa các `id` của `permission` -> Để mà client biết được rằng ở bên trong cái role này có chứa các `permission` nào thì chúng ta để `id` của các permission đó vào trong `permissionIds`

## Bài 90 Cập nhật Zod Schema cho `Permission Role` và giải thích vì sao query không dùng Index

- Cập nhật Zod Schema cho `Permission và Role` và sẽ giải thích về `Index SQL` khi mà chúng ta query trên cái database

- Bây giờ chúng ta sẽ mở cái database lên và sẽ test cái việc là cái database của chúng ta có sử dụng `Index` khi mà nó `query` hay không -> Sẽ query vào trong table Role để mà xem là nó có đang sử dụng `Index-name-unique-partial` hay không -> Thì chúng ta sử dụng cái từ khóa đó là `explain analyze`

  - Khi mà nó hiển thị ra là `Seq scan` có nghĩa là nó đang quét tuần tự là nó sẽ chạy từ thằng số 1, 2, 3, ... Chứ không phải là nó dùng `Index` để mà nó lấy ra

  - Thì khi mà thêm `"deletedAt" IS NULL` vào thì nó vẫn là `seq scan` có nghĩa là nó vẫn không sử dụng `Index` để mà nó `query` -> Thì lí giải cho cái việc này đó là số lượng Item của chúng ta đang quá ít, khi mà nó đang quá ít thì nó sẽ sử dụng `seq scan` để mà nó lấy ra cái item đó -> SỐ lượng nhi ều khoảng 10000 thì Index nó mới trở nên hiệu quả, vì vậy ở số lượng ít nhất vậy thì cái database nó sẽ tự động chọn giải pháp để mà query cho nó hiệu quả -> Nên là ở đây nó sử dụng `Seq Scan`.

  - Khi mà chúng ta query bằng `Id` thì nó vẫn sử dụng `Seq Scan` để mà nó query item.

-

## Bài 91 Fix bug Permission đã được xóa mềm nhưng vẫn còn trong `Role`

- Fig bug vấn đề đó là `Permission` đã được xóa mềm rồi nhưng mà vẫn còn trong `Role` -> Nói chung là khi mà phát triển một dự án thì vấn đề bug là đều không tránh khỏi được -> Tại vì chúng ta vẫn còn include cái `permission` do là `soft-deleted` nên là cái item đó vẫn còn ở trong database -> nên là chúng ta cần phải thêm một cái điều kiện nữa là `where: {deletedAt: null}` như thế này là được -> Ok như vậy là đã fix xong cái vấn đề đó khi xóa mềm `permission` `Role Detail` không cập nhật lại danh sách các `permission` rồi

- Đến cái lỗi thứ 2 là chúng ta cập nhật danh sách các permission ở trong `Role` -> Nếu chúng ta cố tính truyền vào `permissionId` đã được xóa mềm rồi thì cái API của chúng ta nó không quăng ra lỗi, đáng lẽ chỗ này nó nên quăng ra lỗi(không quăng ra lỗi cũng không sao mặc dù ki mà trả về một cái đối tượng permission thì chúng ta cũng đâu có trả về những permissionId đã bị xóa đâu) nhưng mà ở trong database nó vẫn được `add` vào thì cái điều này nó không hay cho lắm.

  - Nên là lúc này chúng ta sẽ coi thử cái `permissionId` nào đã được xóa mềm rồi thì chúng ta sẽ quăng ra lỗi -> Và chúng ta sẽ không thực hiện cái thành động `updated` tại đó

  - Còn nếu mà đã delete thật sự thì chỗ cập nhật nó sẽ quăng ra lỗi, còn nếu chỉ soft-deleted thì chỗ hàm `update` nó sẽ không có phát hiện nên là chúng ta cần phải kiểm tra trước

  - Thường thì mấy lỗi này thì trên FE chúng ta mới bị lỗi mà thôi, khi mà chúng ta xóa một cái permission nào đó rồi mà bằng cách nào đó trên UI chúng ta vẫn còn hiển thị để cho cái thằng `Role` chúng ta add vào thì nó ra mấy cái lỗi như thế này mà thôi. -> Xử lý xong vấn đề về update `Role` khi `Permission` đã bị xóa

## Bài 92 Cập nhật script add `Permisisons` vào `Admin Role`

- Thực hiện add script `Permissions` vào `Admin Role` -> Hiện tại cái `Role Admin` `list permission` nó đang là rỗng và bây giờ chúng ta mong muốn rằng đó là mỗi lần chạy lại cái `script create-permissions` thì cái `Role Admin` nó sẽ cập nhật lại cái danh sách `permissions`.

- Sau khi mà `query` để mà cập nhật lại cái `permissions` ở trong `AdminRole` thì sẽ bị lỗi trong câu `where` do cái `name` của chúng ta không còn là `index unique` nữa -> Cách để mà fix cái trường hợp này đó là chúng ta có thể chuyển nó thành `queryRaw` hoặc là chúng ta sẽ sử dụng `id` ứng với cái `AdminRole` -> Nên là ở trong cái fileScript này chúng ta sẽ sử dụng theo cái tính dễ đọc hơn là tốt độ `truy vấn` bởi vì cái filescript này chúng ta chỉ chạy có một vài lần mà thôi

- Sau này khi mà permissions ở trong Role nó phình to lên thì cái giải pháp cuối cùng chúng ta sẽ là `phân trang cái RoleDetail này`, cái giải pháp đầu tiên là chúng ta sẽ `Giảm số lượng thuộc tính trả về cho client`

  - Khi nào mà số lượng nó lên đến `1000-2000` thì chúng ta sẽ nghĩ tới cái giải pháp phân trang cho cái trường hợp đó

## Bài 93 Kiểm tra `Role Permission` khi request

- Sẽ thực hiện kiểm tra `Role-Permission` khi mà thực hiện một cái request -> Sẽ thực hiện nâng cấp cái core của chúng ta lên để mà check được liệu là người dùng có quyền truy cập vào cái `Route` hay không.

> Flow middleware

Mỗi request đi qua chúng ta sẽ:

1. Kiểm tra xem AT có hợp lệ hay không, còn hạn hay không. Từ đó lấy ra `userId` và `roleId`
2. Dựa vào `roleId` vào để query database lấy danh sách `permission` của cái `Role` đó
3. Kiểm tra danh sách `permission` của `role` đó có quyền truy cập vào endpoint đó không

-> Thì bây giờ chúng ta cần phải implement cái bước thứ 2 ở cái Guard nào bây giờ -> THì bây giờ cái `AuthenticationGuard` nó chỉ `canActive` của từng cái Guard mà thôi chứ nó không có `query database` gì cả, bên này cũng không có lấy `AccessToken` luôn nên là chúng ta cần phải thực hiện cái vấn đề này ở

- Rồi thì chúng ta sẽ qua xem cái `AccessTokenGuard` -> Thì rõ ràng chúng ta sẽ implement cái đoạn `query database` ở cái `AccessTokenGuard` này vì ở đây nó có lấy ra cái `AccessToken` để mà lấy ra được cái `userId` và `roleId` được

  - Nếu như mà người dùng gửi lên cái `accessToken` mà nó hợp lệ và còn `thời hạn` thì chúng ta thực hiện `query database`
    -> Nếu accessToken còn hợp lệ thì thực hiện query database tại khu vực này
    -> Cái Guard này nó chỉ chạy khi mà những cái route nó yêu cầu cái accessTokenGuard này chạy thôi, còn những route `public` thì nó sẽ không có chạy

  - Khi mà chọn qua được cái client rồi thì nó ko được request tới những cái API như là `getListRole` `getListPermission` chẳng hạn như thế là sai -> Thì bây giờ việc cửa chúng ta cần làm đó là `handle` cái phần này thì mới được

  - Thì sau khi mà người dùng gửi cái request lên cho server thì chúng ta có thể lấy ra được cái path để mà kiểm tra xem người dùng có quyền truy cập vào cái `APIEndpoint` đó hay không -> Thì khi mà lấy ra được cái `path` như thế này thì nó rất là khớp với cái `permission` mà chúng ta đã add vào bên trong cái mảng `permissions` của từng `Role` của người dùng, và thêm nữa là chúng ta cần phải lấy ra thêm cái `method` của cái `route` thì mới được

  - Sau khi mà lấy ra được một cái `permission` từ cái `role` của người dùng rồi thì chúng ta sẽ tiền hành kiểm tra nó luôn, cái vấn đề mà tại sao nó không quăng ra cái lỗi `Forbidden` mà lại quăng ra `Unauthorized` thì cái vấn đề này chúng ta sẽ giải quyết sau.

## Bài 94 Refactor `Authentication Guard`/

- Sẽ thực hiện Refactor lại `Authentication Guard` của chúng ta ở bên trong cái core dự án này

- Chúng ta sẽ tiền hành refactor lại cái canActive nó cho nó gọn lại

  - 2 cái câu điều kiện ở bên trong `canActive` thì chúng ta sẽ tách nó ra thành 2 cái function: 1 cái func là `OR` và 1 cái function là `AND`

## Bài 95 Ngăn chặn User thao tác trên `Base Role`

> Để mà cái hệ thống chúng ta ổn định thì chúng ta nên:

- Không cho phép ai có thể xóa 3 role cơ bản này: ADMIN, CLIENT, SELLER. Vì 3 role này chúng ta dùng trong code rất là nhiều, ví dụ register auto role `CLIENT`

- Không cho bất kì ai cập nhật role `ADMIN`, kể cả user với role là `ADMIN` đi chăng nữa. Tránh `ADMIN` này thay đổi `permission` tầm bậy làm mất quyền kiểm soát hệ thống.

## Bài 96 Thêm cột `Module` vào `Permission` để mà `gom nhóm`

- Sẽ thực hiện thêm cột `module` vào `permission` để mà gom nhóm -> Sẽ thực hiện gom nhóm các `permission` lại, thay vì phải thực hiện show hàng trăm cái `permission` ra bên ngoài thì trong nó không được đẹp lắm nên là bây giờ chúng ta sẽ nhóm nó lại theo `module/group` -> Như thế thì nó sẽ tăng về mặt `UI/UX` cho thằng người dùng hơn rất là nhiều

- Để mà làm cái vấn đề này thì chúng ta có nhiều cách để mà làm

  - Tạo một cái bảng `Module`, nhưng mà đơn giản hơn là chúng ta có thể add một cái column `Module` vào `permission schema` là được

- Lúc mà chúng ta tạo ra cái `permission` thì chúng ta truyền thêm cái trường `module` nữa rồi thì khi mà trả về cho `client` thì thằng `client` nó sẽ dựa vào cái `module` như này để mà nó `render` ra được cái `UI` như thiết kế là được

  - Chút nữa chúng ta sẽ biết được là bên client nó render ra như thế nào

- Cái mà chúng ta cần chỉnh sửa tiếp theo đó là file `create-permissions` thì chúng ta sẽ lấy ra được cái `module name` dựa vào cái path `/auth/login` thì sẽ lấy ra được cái module là `/auth` -> Sẽ lấy nó ra ở trong cái hàm `availableRoute`

- Thì bây giờ thằng FE có thể gom nhóm `permission` dựa vào cái `module` được thì bây giờ chúng ta sẽ xử lý giả dụ cái trường hợp khi mà chúng ta là một `FE Developer`

## Bài 97 Fix Bug khi `Role` bị vô hiệu hóa thì nên từ chối `request` & Không cho phép User chỉnh sửa `Base Role`

- Fix cái vấn đề đó `Role` bị vô hiệu hóa nên là từ chối `request`
