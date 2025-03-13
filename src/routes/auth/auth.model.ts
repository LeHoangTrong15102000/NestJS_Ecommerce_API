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
export const VerificationCode = z.object({
  id: z.number(),
  email: z.string().email(),
  code: z.string().length(6),
  type: z.enum([TypeOfVerificationCode.REGISTER, TypeOfVerificationCode.FORGOT_PASSWORD]),
  expiresAt: z.date(),
  createdAt: z.date(),
})

// Khai báo type cho VerificationCode
export type VerificationCodeType = z.infer<typeof VerificationCode>

export const SendOTPBodySchema = VerificationCode.pick({
  email: true,
  type: true,
})

export type SendOTPBodyType = z.infer<typeof SendOTPBodySchema>
