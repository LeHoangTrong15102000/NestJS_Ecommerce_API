# Error Catalog

> Auto-generated on 2026-06-01 from `*.error.ts` files.
> Run `pnpm run docs:errors` to regenerate.

**Total errors:** 72 across 14 modules

## Table of Contents

- [address](#address) (8 errors)
- [auth](#auth) (11 errors)
- [brand-translation](#brand-translation) (1 errors)
- [cart](#cart) (5 errors)
- [category-translation](#category-translation) (1 errors)
- [language](#language) (1 errors)
- [order](#order) (6 errors)
- [permission](#permission) (1 errors)
- [product-translation](#product-translation) (1 errors)
- [role](#role) (2 errors)
- [shared](#shared) (2 errors)
- [user](#user) (6 errors)
- [voucher](#voucher) (22 errors)
- [wishlist](#wishlist) (5 errors)

## address

Source: `src/routes/address/address.error.ts`

| Export Name                                     | Error Code                       | HTTP Status | Message                                                                      |
| ----------------------------------------------- | -------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `ADDRESS_ERRORS.ADDRESS_NOT_FOUND`              | `ADDRESS_NOT_FOUND`              | 404         | Địa chỉ không tồn tại                                                        |
| `ADDRESS_ERRORS.ADDRESS_ACCESS_DENIED`          | `ADDRESS_ACCESS_DENIED`          | 403         | Bạn không có quyền truy cập địa chỉ này                                      |
| `ADDRESS_ERRORS.CANNOT_DELETE_DEFAULT_ADDRESS`  | `CANNOT_DELETE_DEFAULT_ADDRESS`  | 400         | Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước |
| `ADDRESS_ERRORS.MAX_ADDRESSES_EXCEEDED`         | `MAX_ADDRESSES_EXCEEDED`         | 400         | Bạn đã đạt giới hạn tối đa số lượng địa chỉ (10 địa chỉ)                     |
| `ADDRESS_ERRORS.INVALID_ADDRESS_DATA`           | `INVALID_ADDRESS_DATA`           | 400         | Dữ liệu địa chỉ không hợp lệ                                                 |
| `ADDRESS_ERRORS.CANNOT_SET_INACTIVE_AS_DEFAULT` | `CANNOT_SET_INACTIVE_AS_DEFAULT` | 400         | Không thể đặt địa chỉ không hoạt động làm mặc định                           |
| `ADDRESS_ERRORS.PROVINCE_DISTRICT_MISMATCH`     | `PROVINCE_DISTRICT_MISMATCH`     | 400         | Quận/huyện không thuộc tỉnh/thành đã chọn                                    |
| `ADDRESS_ERRORS.DISTRICT_WARD_MISMATCH`         | `DISTRICT_WARD_MISMATCH`         | 400         | Phường/xã không thuộc quận/huyện đã chọn                                     |

## auth

Source: `src/routes/auth/auth.error.ts`

| Export Name                        | Error Code                         | HTTP Status | Message                       |
| ---------------------------------- | ---------------------------------- | ----------- | ----------------------------- |
| `InvalidOTPException`              | `InvalidOTPException`              | 422         | Error.InvalidOTP              |
| `OTPExpiredException`              | `OTPExpiredException`              | 422         | Error.OTPExpired              |
| `FailedToSendOTPException`         | `FailedToSendOTPException`         | 422         | Error.FailedToSendOTP         |
| `EmailAlreadyExistsException`      | `EmailAlreadyExistsException`      | 422         | Error.EmailAlreadyExists      |
| `EmailNotFoundException`           | `EmailNotFoundException`           | 422         | Error.EmailNotFound           |
| `TOTPAlreadyEnabledException`      | `TOTPAlreadyEnabledException`      | 422         | Error.TOTPAlreadyEnabled      |
| `TOTPNotEnabledException`          | `TOTPNotEnabledException`          | 422         | Error.TOTPNotEnabled          |
| `InvalidTOTPAndCodeException`      | `InvalidTOTPAndCodeException`      | 422         | Error.InvalidTOTPAndCode      |
| `InvalidTOTPException`             | `InvalidTOTPException`             | 422         | Error.InvalidTOTP             |
| `RefreshTokenAlreadyUsedException` | `RefreshTokenAlreadyUsedException` | 401         | Error.RefreshTokenAlreadyUsed |
| `UnauthorizedAccessException`      | `UnauthorizedAccessException`      | 401         | Error.UnauthorizedAccess      |

## brand-translation

Source: `src/routes/brand/brand-translation/brand-translation.error.ts`

| Export Name                              | Error Code                               | HTTP Status | Message                             |
| ---------------------------------------- | ---------------------------------------- | ----------- | ----------------------------------- |
| `BrandTranslationAlreadyExistsException` | `BrandTranslationAlreadyExistsException` | 422         | Error.BrandTranslationAlreadyExists |

## cart

Source: `src/routes/cart/cart.error.ts`

| Export Name                 | Error Code                  | HTTP Status | Message                        |
| --------------------------- | --------------------------- | ----------- | ------------------------------ |
| `NotFoundSKUException`      | `NotFoundSKUException`      | 404         | Error.SKU.NotFound             |
| `OutOfStockSKUException`    | `OutOfStockSKUException`    | 400         | Error.SKU.OutOfStock           |
| `ProductNotFoundException`  | `ProductNotFoundException`  | 404         | Error.Product.NotFound         |
| `NotFoundCartItemException` | `NotFoundCartItemException` | 404         | Error.CartItem.NotFound        |
| `InvalidQuantityException`  | `InvalidQuantityException`  | 400         | Error.CartItem.InvalidQuantity |

## category-translation

Source: `src/routes/category/category-translation/category-translation.error.ts`

| Export Name                                 | Error Code                                  | HTTP Status | Message                                |
| ------------------------------------------- | ------------------------------------------- | ----------- | -------------------------------------- |
| `CategoryTranslationAlreadyExistsException` | `CategoryTranslationAlreadyExistsException` | 422         | Error.CategoryTranslationAlreadyExists |

## language

Source: `src/routes/language/language.error.ts`

| Export Name                      | Error Code                       | HTTP Status | Message                     |
| -------------------------------- | -------------------------------- | ----------- | --------------------------- |
| `LanguageAlreadyExistsException` | `LanguageAlreadyExistsException` | 422         | Error.LanguageAlreadyExists |

## order

Source: `src/routes/order/order.error.ts`

| Export Name                   | Error Code                    | HTTP Status | Message                  |
| ----------------------------- | ----------------------------- | ----------- | ------------------------ |
| `OrderNotFoundException`      | `OrderNotFoundException`      | 404         | Error.OrderNotFound      |
| `ProductNotFoundException`    | `ProductNotFoundException`    | 404         | Error.ProductNotFound    |
| `OutOfStockSKUException`      | `OutOfStockSKUException`      | 400         | Error.OutOfStockSKU      |
| `NotFoundCartItemException`   | `NotFoundCartItemException`   | 404         | Error.NotFoundCartItem   |
| `SKUNotBelongToShopException` | `SKUNotBelongToShopException` | 400         | Error.SKUNotBelongToShop |
| `CannotCancelOrderException`  | `CannotCancelOrderException`  | 400         | Error.CannotCancelOrder  |

## permission

Source: `src/routes/permission/permission.error.ts`

| Export Name                        | Error Code                         | HTTP Status | Message                       |
| ---------------------------------- | ---------------------------------- | ----------- | ----------------------------- |
| `PermissionAlreadyExistsException` | `PermissionAlreadyExistsException` | 422         | Error.PermissionAlreadyExists |

## product-translation

Source: `src/routes/product/product-translation/product-translation.error.ts`

| Export Name                                | Error Code                                 | HTTP Status | Message                               |
| ------------------------------------------ | ------------------------------------------ | ----------- | ------------------------------------- |
| `ProductTranslationAlreadyExistsException` | `ProductTranslationAlreadyExistsException` | 422         | Error.ProductTranslationAlreadyExists |

## role

Source: `src/routes/role/role.error.ts`

| Export Name                           | Error Code                            | HTTP Status | Message                          |
| ------------------------------------- | ------------------------------------- | ----------- | -------------------------------- |
| `RoleAlreadyExistsException`          | `RoleAlreadyExistsException`          | 422         | Error.RoleAlreadyExists          |
| `ProhibitedActionOnBaseRoleException` | `ProhibitedActionOnBaseRoleException` | 403         | Error.ProhibitedActionOnBaseRole |

## shared

Source: `src/shared/error.ts`

| Export Name                | Error Code                 | HTTP Status | Message               |
| -------------------------- | -------------------------- | ----------- | --------------------- |
| `InvalidPasswordException` | `InvalidPasswordException` | 422         | Error.InvalidPassword |
| `NotFoundRecordException`  | `NotFoundRecordException`  | 404         | Error.NotFound        |

## user

Source: `src/routes/user/user.error.ts`

| Export Name                             | Error Code                              | HTTP Status | Message                            |
| --------------------------------------- | --------------------------------------- | ----------- | ---------------------------------- |
| `UserAlreadyExistsException`            | `UserAlreadyExistsException`            | 422         | Error.UserAlreadyExists            |
| `RoleNotFoundException`                 | `RoleNotFoundException`                 | 422         | Error.RoleNotFound                 |
| `CannotUpdateAdminUserException`        | `CannotUpdateAdminUserException`        | 403         | Error.CannotUpdateAdminUser        |
| `CannotDeleteAdminUserException`        | `CannotDeleteAdminUserException`        | 403         | Error.CannotDeleteAdminUser        |
| `CannotSetAdminRoleToUserException`     | `CannotSetAdminRoleToUserException`     | 403         | Error.CannotSetAdminRoleToUser     |
| `CannotUpdateOrDeleteYourselfException` | `CannotUpdateOrDeleteYourselfException` | 403         | Error.CannotUpdateOrDeleteYourself |

## voucher

Source: `src/routes/voucher/voucher.error.ts`

| Export Name                                         | Error Code                           | HTTP Status | Message                                                |
| --------------------------------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------ |
| `VOUCHER_ERRORS.VOUCHER_NOT_FOUND`                  | `VOUCHER_NOT_FOUND`                  | 404         | Voucher không tồn tại                                  |
| `VOUCHER_ERRORS.VOUCHER_CODE_NOT_FOUND`             | `VOUCHER_CODE_NOT_FOUND`             | 404         | Mã voucher không tồn tại                               |
| `VOUCHER_ERRORS.VOUCHER_ACCESS_DENIED`              | `VOUCHER_ACCESS_DENIED`              | 403         | Bạn không có quyền truy cập voucher này                |
| `VOUCHER_ERRORS.VOUCHER_CODE_EXISTS`                | `VOUCHER_CODE_EXISTS`                | 400         | Mã voucher đã tồn tại                                  |
| `VOUCHER_ERRORS.INVALID_VOUCHER_DATES`              | `INVALID_VOUCHER_DATES`              | 400         | Ngày bắt đầu phải trước ngày kết thúc                  |
| `VOUCHER_ERRORS.INVALID_PERCENTAGE_VALUE`           | `INVALID_PERCENTAGE_VALUE`           | 400         | Giá trị giảm giá theo % phải từ 1-100                  |
| `VOUCHER_ERRORS.VOUCHER_ALREADY_COLLECTED`          | `VOUCHER_ALREADY_COLLECTED`          | 400         | Bạn đã lưu voucher này rồi                             |
| `VOUCHER_ERRORS.VOUCHER_USAGE_LIMIT_EXCEEDED`       | `VOUCHER_USAGE_LIMIT_EXCEEDED`       | 400         | Voucher đã hết lượt sử dụng                            |
| `VOUCHER_ERRORS.VOUCHER_EXPIRED`                    | `VOUCHER_EXPIRED`                    | 400         | Voucher đã hết hạn                                     |
| `VOUCHER_ERRORS.VOUCHER_NOT_STARTED`                | `VOUCHER_NOT_STARTED`                | 400         | Voucher chưa có hiệu lực                               |
| `VOUCHER_ERRORS.VOUCHER_INACTIVE`                   | `VOUCHER_INACTIVE`                   | 400         | Voucher đã bị vô hiệu hóa                              |
| `VOUCHER_ERRORS.VOUCHER_NOT_COLLECTED`              | `VOUCHER_NOT_COLLECTED`              | 400         | Bạn chưa lưu voucher này                               |
| `VOUCHER_ERRORS.USER_VOUCHER_LIMIT_EXCEEDED`        | `USER_VOUCHER_LIMIT_EXCEEDED`        | 400         | Bạn đã sử dụng hết lượt voucher này                    |
| `VOUCHER_ERRORS.ORDER_VALUE_TOO_LOW`                | `ORDER_VALUE_TOO_LOW`                | 400         | Giá trị đơn hàng chưa đủ điều kiện sử dụng voucher     |
| `VOUCHER_ERRORS.PRODUCTS_NOT_APPLICABLE`            | `PRODUCTS_NOT_APPLICABLE`            | 400         | Sản phẩm trong đơn hàng không áp dụng được voucher này |
| `VOUCHER_ERRORS.PRODUCTS_EXCLUDED`                  | `PRODUCTS_EXCLUDED`                  | 400         | Đơn hàng chứa sản phẩm không được áp dụng voucher      |
| `VOUCHER_ERRORS.INVALID_VOUCHER_TYPE`               | `INVALID_VOUCHER_TYPE`               | 400         | Loại voucher không hợp lệ                              |
| `VOUCHER_ERRORS.INVALID_VOUCHER_VALUE`              | `INVALID_VOUCHER_VALUE`              | 400         | Giá trị voucher không hợp lệ                           |
| `VOUCHER_ERRORS.INVALID_USAGE_LIMIT`                | `INVALID_USAGE_LIMIT`                | 400         | Giới hạn sử dụng không hợp lệ                          |
| `VOUCHER_ERRORS.SELLER_CANNOT_USE_PLATFORM_VOUCHER` | `SELLER_CANNOT_USE_PLATFORM_VOUCHER` | 400         | Seller không thể sử dụng voucher hệ thống              |
| `VOUCHER_ERRORS.CANNOT_EDIT_USED_VOUCHER`           | `CANNOT_EDIT_USED_VOUCHER`           | 400         | Không thể chỉnh sửa voucher đã được sử dụng            |
| `VOUCHER_ERRORS.CANNOT_DELETE_USED_VOUCHER`         | `CANNOT_DELETE_USED_VOUCHER`         | 400         | Không thể xóa voucher đã được sử dụng                  |

## wishlist

Source: `src/routes/wishlist/wishlist.error.ts`

| Export Name                           | Error Code                      | HTTP Status | Message                                                 |
| ------------------------------------- | ------------------------------- | ----------- | ------------------------------------------------------- |
| `WishlistItemNotFoundException`       | `WISHLIST_ITEM_NOT_FOUND`       | 404         | Wishlist item not found                                 |
| `WishlistCollectionNotFoundException` | `WISHLIST_COLLECTION_NOT_FOUND` | 404         | Wishlist collection not found                           |
| `WishlistItemAlreadyExistsException`  | `WISHLIST_ITEM_ALREADY_EXISTS`  | 409         | Product already in wishlist                             |
| `NoSKUSelectedException`              | `NO_SKU_SELECTED`               | 400         | Cannot add to cart: No SKU selected for this product    |
| `UnauthorizedWishlistAccessException` | `UNAUTHORIZED_WISHLIST_ACCESS`  | 403         | You do not have permission to access this wishlist item |
