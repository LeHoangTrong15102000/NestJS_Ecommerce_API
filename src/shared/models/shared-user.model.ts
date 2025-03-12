// Sẽ khai báo hết column của User và sẽ quy định cái type cho nó luôn

import { UserStatus } from 'src/shared/constants/auth.constant'
import { z } from 'zod'

// Chứ schema nó chỉ là một cái object mà thôi
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  phoneNumber: z.string().min(9).max(15),
  avatar: z.string().nullable(), // vẫn để là nullable
  totpSecret: z.string().nullable(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.BLOCKED]), // tương đương với cách ở dưới
  // status: z.nativeEnum(UserStatus),
  roleId: z.number().positive(),
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
})

export type UserType = z.infer<typeof UserSchema>
