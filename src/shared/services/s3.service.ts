import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Injectable } from '@nestjs/common'
import { readFileSync } from 'fs'
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
        Key: filename,
        Body: readFileSync(filepath),
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

    parallelUploads3.on('httpUploadProgress', (progress) => {
      console.log(progress)
    })

    return parallelUploads3.done()
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
