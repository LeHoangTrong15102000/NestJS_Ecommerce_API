import { addLanguages } from './add-languages'
import { addBrands } from './add-brands'
import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

const addSampleData = async () => {
  console.log('🚀 Bắt đầu thêm dữ liệu mẫu cho Language và Brand...\n')

  try {
    // Bước 1: Thêm languages trước
    console.log('📝 BƯỚC 1: Thêm dữ liệu mẫu cho Language...')
    await addLanguages()
    console.log('✅ Hoàn thành thêm Language\n')

    // Bước 2: Thêm brands và brand translations
    console.log('🏷️  BƯỚC 2: Thêm dữ liệu mẫu cho Brand...')
    await addBrands()
    console.log('✅ Hoàn thành thêm Brand\n')

    // Hiển thị tóm tắt kết quả
    console.log('📊 TÓM TẮT KẾT QUẢ:')

    const languageCount = await prisma.language.count({
      where: { deletedAt: null },
    })

    const brandCount = await prisma.brand.count({
      where: { deletedAt: null },
    })

    const brandTranslationCount = await prisma.brandTranslation.count({
      where: { deletedAt: null },
    })

    console.log(`✅ Tổng số ngôn ngữ: ${languageCount}`)
    console.log(`✅ Tổng số thương hiệu: ${brandCount}`)
    console.log(`✅ Tổng số bản dịch thương hiệu: ${brandTranslationCount}`)

    console.log('\n🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu thành công!')
  } catch (error) {
    console.error('❌ Lỗi khi thêm dữ liệu mẫu:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addSampleData()
  } catch (error) {
    console.error('❌ Script thất bại:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Chỉ chạy khi file này được execute trực tiếp
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🏁 Script hoàn thành thành công!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script thất bại:', error)
      process.exit(1)
    })
}

export { addSampleData }
