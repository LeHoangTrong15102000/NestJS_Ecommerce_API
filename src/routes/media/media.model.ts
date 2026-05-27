import { z } from 'zod'

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|svg)$/i

export const PresignedUploadFileBodySchema = z
  .object({
    filename: z
      .string()
      .max(255)
      .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('..'), {
        message: 'Filename must not contain path separators',
      })
      .refine((name) => ALLOWED_EXTENSIONS.test(name), {
        message: 'Only image files are allowed (jpg, jpeg, png, webp, gif, svg)',
      }),
    filesize: z.number().max(1 * 1024 * 1024), // 1MB validate filesize
  })
  .strict()

export const UploadFilesResSchema = z.object({
  data: z.array(
    z.object({
      url: z.string(),
    }),
  ),
})

export const PresignedUploadFileResSchema = z.object({
  presignedUrl: z.string(),
  url: z.string(),
})

export type PresignedUploadFileBodyType = z.infer<typeof PresignedUploadFileBodySchema>
