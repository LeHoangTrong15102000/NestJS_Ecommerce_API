import { UserStatus } from '@prisma/client'
import { TypeOfVerificationCode } from 'src/shared/constants/auth.constant'
import { UserSchema } from 'src/shared/models/shared-user.model'
import { z } from 'zod'

// Tạo ra RegisterBodySchema -> Đây là cách mà tạo ra một RegisterBodySchema
export const RegisterBodySchema = UserSchema.pick({
  email: true,
  password: true,
  name: true,
  phoneNumber: true,
})
  .extend({
    confirmPassword: z.string().min(6).max(100),
    code: z.string().length(6),
  })
  .strict()
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password and confirm password must match.',
        path: ['confirmPassword'], // path chỉ ra là thằng nào là thằng bị lỗi ở đây, là một cái array
      })
    }
  })

// Đưa cái schema vào để mà tạo ra cái type tương ứng của nó
export type RegisterBodyType = z.infer<typeof RegisterBodySchema>

// Khai báo thêm thằng này để mà chuẩn hóa dữ liệu trả về cho RegisterRes
export const RegisterResSchema = UserSchema.omit({
  password: true,
  totpSecret: true,
})
export type RegisterResType = z.infer<typeof RegisterResSchema>

// Khai báo Schema cho VerificationCode
export const VerificationCodeSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  code: z.string().length(6),
  type: z.enum([TypeOfVerificationCode.REGISTER, TypeOfVerificationCode.FORGOT_PASSWORD]),
  expiresAt: z.date(),
  createdAt: z.date(),
})

// Khai báo type cho VerificationCode
export type VerificationCodeType = z.infer<typeof VerificationCodeSchema>

export const SendOTPBodySchema = VerificationCodeSchema.pick({
  email: true,
  type: true,
})

export type SendOTPBodyType = z.infer<typeof SendOTPBodySchema>

export const LoginBodySchema = UserSchema.pick({
  email: true,
  password: true,
}).strict()

export type LoginBodyType = z.infer<typeof LoginBodySchema>

// Thì thường cái res sẽ không thêm cờ `strict()` vào cho nó để mà làm gì cả
export const LoginResSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})
export type LoginResType = z.infer<typeof LoginResSchema>

export const RefreshTokenBodySchema = z
  .object({
    refreshToken: z.string(),
  })
  .strict()

export type RefreshTokenBodyType = z.infer<typeof RefreshTokenBodySchema>
export const RefreshTokenResSchema = LoginResSchema
export type RefreshTokenResType = LoginResType // chỗ này cũng có thể ghi là z.infer đều được hết.

export const DeviceSchema = z.object({
  id: z.number(),
  userId: z.number(),
  userAgent: z.string(),
  ip: z.string(),
  lastActive: z.date(),
  createdAt: z.date(),
  isActive: z.boolean(),
})
export type DeviceType = z.infer<typeof DeviceSchema>

export const RoleSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
})
export type RoleType = z.infer<typeof RoleSchema>

// export const LogoutBodySchema = z.object({
//   refreshToken: z.string(),
// })
// export type LogoutBodyType = z.infer<typeof LogoutBodySchema>

// export const ForgotPasswordBodySchema = z.object({
//   email: z.string().email(),
// })
// export type ForgotPasswordBodyType = z.infer<typeof ForgotPasswordBodySchema>

// export const ResetPasswordBodySchema = z.object({
//   email: z.string().email(),
//   code: z.string().length(6),
//   newPassword: z.string().min(6).max(100),
// }).strict()
// export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>

// export const TwoFactorSetupBodySchema  = z.object({})
// export type TwoFactorSetupBodyType = z.infer<typeof TwoFactorSetupBodySchema>

// export const TwoFactorSetupResSChema  = z.object({})
// export type TwoFactorSetupResType = z.infer<typeof TwoFactorSetupResSchema>

// export const TwoFactorVerifyBodySchema  = z.object({})
//  export type TwoFactorVerifyBodyType = z.infer<typeof TwoFactorVerifyBodySchema>

// export const DisableTwoFactorBodySchema = z.object({})
// export type DisableTwoFactorBodyType = z.infer<typeof DisableTwoFactorBodySchema>
