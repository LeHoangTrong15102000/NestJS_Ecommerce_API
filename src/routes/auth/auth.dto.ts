import { UserStatus } from '@prisma/client'
import { createZodDto } from 'nestjs-zod'
import { RegisterBodySchema, RegisterResSchema, SendOTPBodySchema } from 'src/routes/auth/auth.model'
import { z } from 'zod'

// Sẽ có cái strict nếu mà người dùng gửi lên dữ liệu bị thừa thì mình sẽ báo lỗi với người ta
// Để mà xem được là cái confirmPassword nó có match với cái password hay không thì sử dụng superRefine
// const RegisterBodySchema = z
//   .object({
//     email: z.string().email(),
//     password: z.string().min(6).max(100),
//     name: z.string().min(1).max(100),
//     confirmPassword: z.string().min(6).max(100),
//     phoneNumber: z.string().min(9).max(15),
//   })
//   .strict()
//   .superRefine(({ confirmPassword, password }, ctx) => {
//     if (confirmPassword !== password) {
//       ctx.addIssue({
//         code: 'custom',
//         message: 'Password and confirm password must match.',
//         path: ['confirmPassword'], // path chỉ ra là thằng nào là thằng bị lỗi ở đây, là một cái array
//       })
//     }
//   })

// Extends createZodDto để mà tạo ra RegisterBodyDto từ RegisterBodySchema, phải cung cấp vào cái schema để mà tạo ra cái DTO tương ứng
export class RegisterBodyDTO extends createZodDto(RegisterBodySchema) {}

// Tạo ra RegisterResĐTO để mà serialization output validation
export class RegisterResDTO extends createZodDto(RegisterResSchema) {}

export class SendOTPBodyDTO extends createZodDto(SendOTPBodySchema) {}
