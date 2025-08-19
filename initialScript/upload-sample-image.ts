import { S3Service } from 'src/shared/services/s3.service'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'
import { lookup as lookupMime } from 'mime-types'

const s3Service = new S3Service()

// Nguồn hình ảnh mẫu: có thể là đường dẫn local hoặc URL http(s)
const SAMPLE_IMAGE_PATH =
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/e001301b-245b-49f1-952c-be74426e9de1.jpg'

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value)

async function ensureLocalFile(source: string): Promise<{ filepath: string; filename: string; contentType: string }> {
  if (!isHttpUrl(source)) {
    if (!fs.existsSync(source)) {
      throw new Error(`Không tìm thấy file hình ảnh tại: ${source}`)
    }
    const filename = path.basename(source)
    const contentType = (lookupMime(filename) as string) || 'image/jpeg'
    return { filepath: source, filename, contentType }
  }

  const res = await fetch(source)
  if (!res.ok) throw new Error(`Tải hình ảnh từ URL thất bại: ${res.status} ${res.statusText}`)
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const urlExt = path.extname(new URL(source).pathname) || '.jpg'
  const filename = `sample-src-${Date.now()}${urlExt}`
  const filepath = path.join(tmpdir(), filename)
  fs.writeFileSync(filepath, buffer)
  const contentType = (res.headers.get('content-type') as string) || 'image/jpeg'
  return { filepath, filename, contentType }
}

export const uploadSampleImage = async (): Promise<string> => {
  console.log('📸 Bắt đầu upload hình ảnh mẫu lên S3...\n')

  try {
    const { filepath, filename, contentType } = await ensureLocalFile(SAMPLE_IMAGE_PATH)

    const key = `sample-products/ava-${Date.now()}${path.extname(filename) || '.jpg'}`
    console.log(`📁 File: ${filename}`)
    console.log(`🏷️ Key trên S3: ${key}`)

    // Upload lên S3 bằng service có sẵn
    const result = await s3Service.uploadedFile({ filename: key, filepath, contentType })
    const url = `https://${process.env.S3_BUCKET_NAME || ''}.s3.${process.env.S3_REGION || ''}.amazonaws.com/${key}`
    console.log('✅ Upload thành công!')
    console.log(`🔗 URL (ước lượng): ${url}`)
    return url
  } catch (error) {
    console.error('❌ Lỗi khi upload hình ảnh:', error)
    throw error
  }
}

// Script để upload nhiều variations của hình ảnh
export const uploadMultipleSampleImages = async (): Promise<string[]> => {
  console.log('📸 Bắt đầu upload nhiều hình ảnh mẫu lên S3...\n')

  try {
    const { filepath, filename, contentType } = await ensureLocalFile(SAMPLE_IMAGE_PATH)
    const uploadedUrls: string[] = []

    // Upload cùng một hình với tên khác nhau để simulate nhiều sản phẩm
    const imageVariations = [
      'sample-products/product-main.jpg',
      'sample-products/product-variant-1.jpg',
      'sample-products/product-variant-2.jpg',
      'sample-products/product-variant-3.jpg',
      'sample-products/product-detail-1.jpg',
      'sample-products/product-detail-2.jpg',
      'sample-products/brand-logo.jpg',
      'sample-products/category-banner.jpg',
      'sample-products/user-avatar.jpg',
    ]

    for (const key of imageVariations) {
      console.log(`⬆️ Đang upload: ${key}`)
      await s3Service.uploadedFile({ filename: key, filepath, contentType })
      const url = `https://${process.env.S3_BUCKET_NAME || ''}.s3.${process.env.S3_REGION || ''}.amazonaws.com/${key}`
      uploadedUrls.push(url)
      console.log(`✅ Upload thành công: ${url}`)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(`\n🎉 Đã upload thành công ${uploadedUrls.length} hình ảnh!`)
    return uploadedUrls
  } catch (error) {
    console.error('❌ Lỗi khi upload nhiều hình ảnh:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    console.log('🚀 Bắt đầu quá trình upload hình ảnh mẫu...\n')
    const uploadedUrls = await uploadMultipleSampleImages()
    console.log('\n📋 DANH SÁCH CÁC URL ĐÃ UPLOAD:')
    uploadedUrls.forEach((url, index) => console.log(`${index + 1}. ${url}`))
    console.log('\n💡 HƯỚNG DẪN SỬ DỤNG:')
    console.log('1. Copy các URL trên và thay thế vào script add-cart-order-data.ts')
    console.log('2. Dùng các URL khác nhau cho product/brand/avatar/category như đã liệt kê ở trên')
  } catch (error) {
    console.error('❌ Script upload thất bại:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🏁 Script upload hoàn thành thành công!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script upload thất bại:', error)
      process.exit(1)
    })
}
