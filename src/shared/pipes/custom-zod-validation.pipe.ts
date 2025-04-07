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

// interface CustomZodError extends Error {
//   path: string
//   code: string
//   [key: string]: any
// }

// const NormalZodValidationPipe = createZodValidationPipe({
//   // Provide custom validation exception factory
//   createValidationException: (error: ZodError) => {
//     console.log('Checkkkk error', error.errors)
//     // Nếu mà cái path trả về là một cái  Array thì chúng ta sẽ join các giá trị bên trong `path` thành một cái chuỗi string
//     return error.errors.map((error) => {
//       const customError: CustomZodError = {
//         ...error,
//         path: error.path.join('.'),
//         message: error.message.replace('expected ', `Missing or invalid value for ${error.path.join('.')}: `),
//         name: error.code,
//         code: error.code,
//       }

//       // {
//       //   ...error,
//       //   path: error.path.join('.'),
//       //   message: error.message.replace('expected ', `Missing or invalid value for ${error.path.join('.')}: `),
//       //   name: error.code,
//       // }
//       return customError
//     })
//   },
// })

// export class CustomZodValidationPipe extends NormalZodValidationPipe {
//   transform(value: any, metadata: ArgumentMetadata) {
//     try {
//       const result = super.transform(value, metadata)
//       return result
//     } catch (error) {
//       if (metadata.type === 'query') {
//         throw new BadRequestException(error)
//       }
//       throw new UnprocessableEntityException(error)
//     }
//   }
// }

// export default CustomZodValidationPipe
