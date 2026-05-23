import { Prisma } from '@prisma/client'

export type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>

export type UserWithoutSensitiveFields = Prisma.UserGetPayload<{
  omit: { password: true; totpSecret: true }
}>

export type RefreshTokenWithUserRole = Prisma.RefreshTokenGetPayload<{
  include: { user: { include: { role: true } } }
}>
