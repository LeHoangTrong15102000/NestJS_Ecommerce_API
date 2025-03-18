import { UnprocessableEntityException } from '@nestjs/common'
import { createZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'

const CustomZodValidationPipe = createZodValidationPipe({
  // Provide custom validation exception factory
  createValidationException: (error: ZodError) => {
    console.log('Checkkkk error', error.errors)
    // Nếu mà cái path trả về là một cái  Array thì chúng ta sẽ join các giá trị bên trong `path` thành một cái chuỗi string
    return new UnprocessableEntityException(
      error.errors.map((error) => {
        return {
          ...error,
          path: error.path.join('.'),
        }
      }),
    )
  },
})

export default CustomZodValidationPipe
