import { z } from 'zod'

// Nếu sau này có method chuyền lên empty body rỗng thì có thể sử dụng lại cái schema này
export const EmptyBodySchema = z.object({}).strict()

export type EmptyBodyType = z.infer<typeof EmptyBodySchema>
