import { addLanguages } from './add-languages'
import { addBrands } from './add-brands'
import { addCategories } from './add-categories'
import { addProducts } from './add-products'
import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

const clearExistingData = async () => {
  console.log('🧹 Bắt đầu xóa dữ liệu cũ...')

  try {
    // Xóa dữ liệu theo thứ tự để tránh lỗi foreign key
    const deleteResults = await Promise.all([
      prisma.productTranslation.deleteMany({}),
      prisma.sKU.deleteMany({}),
      prisma.product.deleteMany({}),
      prisma.categoryTranslation.deleteMany({}),
      prisma.category.deleteMany({}),
      prisma.brandTranslation.deleteMany({}),
      prisma.brand.deleteMany({}),
      prisma.language.deleteMany({}),
    ])

    console.log('✅ Đã xóa dữ liệu cũ thành công:')
    console.log(`   - Product Translations: ${deleteResults[0].count}`)
    console.log(`   - SKUs: ${deleteResults[1].count}`)
    console.log(`   - Products: ${deleteResults[2].count}`)
    console.log(`   - Category Translations: ${deleteResults[3].count}`)
    console.log(`   - Categories: ${deleteResults[4].count}`)
    console.log(`   - Brand Translations: ${deleteResults[5].count}`)
    console.log(`   - Brands: ${deleteResults[6].count}`)
    console.log(`   - Languages: ${deleteResults[7].count}`)
  } catch (error) {
    console.error('❌ Lỗi khi xóa dữ liệu cũ:', error)
    throw error
  }
}

const addCatalogSample = async () => {
  console.log('🚀 Bắt đầu thêm dữ liệu mẫu cho Language → Brand → Category → Product...\n')

  try {
    // Xóa dữ liệu cũ trước khi tạo mới
    await clearExistingData()
    console.log('')

    console.log('📝 BƯỚC 1: Thêm Language...')
    await addLanguages()
    console.log('✅ Hoàn thành Language\n')

    console.log('🏷️  BƯỚC 2: Thêm Brand...')
    await addBrands()
    console.log('✅ Hoàn thành Brand\n')

    console.log('📂 BƯỚC 3: Thêm Category...')
    await addCategories()
    console.log('✅ Hoàn thành Category\n')

    console.log('📦 BƯỚC 4: Thêm Product...')
    await addProducts()
    console.log('✅ Hoàn thành Product\n')

    const [languageCount, brandCount, categoryCount, productCount, skuCount, productTransCount, categoryTransCount] =
      await Promise.all([
        prisma.language.count({ where: { deletedAt: null } }),
        prisma.brand.count({ where: { deletedAt: null } }),
        prisma.category.count({ where: { deletedAt: null } }),
        prisma.product.count({ where: { deletedAt: null } }),
        prisma.sKU.count({ where: { deletedAt: null } }),
        prisma.productTranslation.count({ where: { deletedAt: null } }),
        prisma.categoryTranslation.count({ where: { deletedAt: null } }),
      ])

    console.log('\n📊 TÓM TẮT KẾT QUẢ:')
    console.log(`✅ Ngôn ngữ: ${languageCount}`)
    console.log(`✅ Thương hiệu: ${brandCount}`)
    console.log(`✅ Danh mục: ${categoryCount}`)
    console.log(`✅ Sản phẩm: ${productCount}`)
    console.log(`✅ SKU: ${skuCount}`)
    console.log(`✅ Bản dịch Product: ${productTransCount}`)
    console.log(`✅ Bản dịch Category: ${categoryTransCount}`)

    console.log('\n🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu thành công!')
  } catch (error) {
    console.error('❌ Lỗi khi thêm dữ liệu mẫu:', error)
    throw error
  }
}

const main = async () => {
  try {
    await addCatalogSample()
  } catch (error) {
    console.error('❌ Script thất bại:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

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

export { addCatalogSample }
