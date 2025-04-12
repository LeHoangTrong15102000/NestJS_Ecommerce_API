import { PutObjectCommand, S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable } from '@nestjs/common'
import { readFileSync } from 'fs'
import mime from 'mime-types'
import envConfig from 'src/shared/config'

@Injectable()
export class S3Service {
  private s3: S3
  constructor() {
    this.s3 = new S3({
      region: envConfig.S3_REGION,
      credentials: {
        accessKeyId: envConfig.S3_ACCESS_KEY_ID,
        secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
      },
    })
    // this.s3.listBuckets({}).then((res) => {
    //   console.log(res)
    // })
  }

  uploadedFile({ filename, filepath, contentType }: { filename: string; filepath: string; contentType: string }) {
    const parallelUploads3 = new Upload({
      client: this.s3,
      params: {
        Bucket: envConfig.S3_BUCKET_NAME,
        Key: filename, // Sẽ là đường dẫn, dẫn tới cái file của chúng ta ở trong Bucket
        Body: readFileSync(filepath), // readFileAsync chuyển nó thành buffer rồi truyền vào cái body
        ContentType: contentType,
      },
      tags: [],
      // (optional) concurrency configuration
      queueSize: 4,
      // (optional) size of each part, in bytes, at least 5MB
      // Nó sẽ chia cái file ra thành các thành phần nhỏ để mà nó upload lên
      partSize: 1024 * 1024 * 5,
      // (optional) when true, do not automatically call AbortMultipartUpload when
      // a multipart upload fails to complete. You should then manually handle
      // the leftover parts.
      leavePartsOnError: false,
    })

    // parallelUploads3.on('httpUploadProgress', (progress) => {
    //   console.log(progress)
    // })

    // return về promise
    return parallelUploads3.done()
  }

  // ContentType lấy ra từ cái filename
  createPresignedUrlWithClient(filename: string) {
    // 'application/octet-stream' này là một cái binary data mà không có định dạng nhất định giống như là unknown vậy
    const contentType = mime.lookup(filename) || 'application/octet-stream'
    const command = new PutObjectCommand({ Bucket: envConfig.S3_BUCKET_NAME, Key: filename, ContentType: contentType })
    //  expiresIn nó sẽ nhận vào là giây
    return getSignedUrl(this.s3, command, { expiresIn: 10 })
  }
}

// const s3Instance = new S3Service()
// s3Instance
//   .uploadedFile({
//     filename: 'images/test.jpg',
//     filepath:
//       'D:/_A_Course_Pro_DuThanhDuoc/_A_NestJS_Super_2025/_NestJS_Super_Ecommerce_API/upload/4334a06c-e737-4b62-b5de-bc0a5244bb6e.jpg',
//     contentType: 'image/jpg',
//   })
//   .then(console.log)
//   .catch(console.error)
