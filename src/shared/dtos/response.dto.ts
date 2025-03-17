import { createZodDto } from 'nestjs-zod'
import { MessageResSchema } from 'src/shared/models/response.model'

// Giành cho các API trả về message thì dùng DTO như thế này
export class MessageResDTO extends createZodDto(MessageResSchema) {}
