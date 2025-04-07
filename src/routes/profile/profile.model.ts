import { z } from 'zod'
import { UserSchema } from 'src/shared/models/shared-user.model'

export const UpdateMeBodySchema = UserSchema.pick({
  name: true,
  phoneNumber: true,
  avatar: true,
}).strict()

export const ChangePasswordBodySchema = UserSchema.pick({
  password: true,
})
  .extend({
    newPassword: z.string().min(6).max(100),
    confirmNewPassword: z.string().min(6).max(100),
  })
  .strict()
  .superRefine(({ password, newPassword, confirmNewPassword }, ctx) => {
    // kiểm tra newPassword và confirmNewPassword phải giống nhau
    if (newPassword !== confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Error.ConfirmPasswordNotMatch',
        path: ['confirmNewPassword'],
      })
    }

    // Kiểm tra password và newPassword không được trùng nhau
    if (password === newPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Error.NewPasswordMustBeDifferent',
        path: ['newPassword'],
      })
    }
  })

export type UpdateMeBodyType = z.infer<typeof UpdateMeBodySchema>
export type ChangePasswordBodyType = z.infer<typeof ChangePasswordBodySchema>
