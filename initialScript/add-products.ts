import { PrismaService } from 'src/shared/services/prisma.service'
import { Prisma } from '@prisma/client'

const prisma = new PrismaService()

type ProductSeed = {
  name: string
  brandName: string
  categoryNames: string[] // will connect by name
  basePrice: number
  virtualPrice: number
  images: string[]
  variants: { value: string; options: string[] }[]
  skus: { value: string; price: number; stock: number; image: string }[]
  published?: boolean
  translations?: Record<string, { name: string; description: string }>
}

// Helper to generate combinations in the same order as product.model.ts
const combinations = (arrays: string[][]): string[] =>
  arrays.reduce((acc, curr) => acc.flatMap((x) => curr.map((y) => `${x}${x ? '-' : ''}${y}`)), [''])

const productsData: ProductSeed[] = [
  {
    name: 'iPhone 15',
    brandName: 'Apple',
    categoryNames: ['Phones'],
    basePrice: 900,
    virtualPrice: 1100,
    images: ['https://images.unsplash.com/photo-1696446707958-iphone15'],
    variants: [
      { value: 'Color', options: ['Black', 'Blue'] },
      { value: 'Storage', options: ['128GB', '256GB'] },
    ],
    skus: [], // will be filled to match combinations
    published: true,
    translations: {
      vi: { name: 'iPhone 15', description: 'iPhone 15 mới với hiệu năng mạnh mẽ và camera tuyệt vời.' },
      en: { name: 'iPhone 15', description: 'New iPhone 15 with powerful performance and great cameras.' },
    },
  },
  {
    name: 'Galaxy S24',
    brandName: 'Samsung',
    categoryNames: ['Phones'],
    basePrice: 800,
    virtualPrice: 999,
    images: ['https://images.unsplash.com/photo-1696433333-galaxy-s24'],
    variants: [
      { value: 'Color', options: ['Black', 'Silver'] },
      { value: 'Storage', options: ['128GB', '256GB'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Galaxy S24', description: 'Galaxy S24 với màn hình đẹp và pin bền bỉ.' },
      en: { name: 'Galaxy S24', description: 'Galaxy S24 with beautiful screen and long battery life.' },
    },
  },
  {
    name: 'MacBook Air M3',
    brandName: 'Apple',
    categoryNames: ['Laptops'],
    basePrice: 1200,
    virtualPrice: 1499,
    images: ['https://images.unsplash.com/photo-1699999999-macbook-m3'],
    variants: [
      { value: 'Color', options: ['Silver', 'Midnight'] },
      { value: 'RAM', options: ['8GB', '16GB'] },
    ],
    skus: [],
    published: false,
    translations: {
      vi: { name: 'MacBook Air M3', description: 'MacBook Air M3 mỏng nhẹ, hiệu năng mạnh mẽ.' },
      en: { name: 'MacBook Air M3', description: 'Lightweight MacBook Air M3 with strong performance.' },
    },
  },
]

const ensureSKUs = (p: ProductSeed): ProductSeed => {
  const combo = combinations(p.variants.map((v) => v.options))
  if (p.skus.length && p.skus.length !== combo.length) {
    throw new Error(`SKUs count must be ${combo.length} for product ${p.name}`)
  }
  if (!p.skus.length) {
    p.skus = combo.map((value) => ({ value, price: p.basePrice, stock: 100, image: p.images[0] ?? '' }))
  }
  return p
}

const addProducts = async () => {
  const existingCount = await prisma.product.count({ where: { deletedAt: null } })
  if (existingCount > 0) {
    console.log(`Đã có ${existingCount} sản phẩm trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
    return
  }

  const languages = await prisma.language.findMany({ where: { deletedAt: null }, select: { id: true } })
  if (languages.length === 0) {
    console.log('⚠️  Chưa có ngôn ngữ nào. Vui lòng chạy script add-languages.ts trước.')
    return
  }

  const brands = await prisma.brand.findMany({ where: { deletedAt: null } })
  if (brands.length === 0) {
    console.log('⚠️  Chưa có brand nào. Vui lòng chạy script add-brands.ts trước.')
    return
  }

  const categories = await prisma.category.findMany({ where: { deletedAt: null } })
  if (categories.length === 0) {
    console.log('⚠️  Chưa có category nào. Vui lòng chạy script add-categories.ts trước.')
    return
  }

  let createdProducts = 0
  let createdTranslations = 0
  let createdSKUs = 0

  for (const input of productsData.map(ensureSKUs)) {
    const brand = brands.find((b) => b.name === input.brandName)
    if (!brand) {
      console.log(`⚠️  Bỏ qua sản phẩm ${input.name} do không tìm thấy brand ${input.brandName}`)
      continue
    }

    const categoryIds = categories.filter((c) => input.categoryNames.includes(c.name)).map((c) => c.id)
    if (categoryIds.length === 0) {
      console.log(`⚠️  Bỏ qua sản phẩm ${input.name} do không tìm thấy category phù hợp`)
      continue
    }

    const product = await prisma.product.create({
      data: {
        name: input.name,
        basePrice: input.basePrice,
        virtualPrice: input.virtualPrice,
        brandId: brand.id,
        images: input.images,
        variants: input.variants as unknown as { value: string; options: string[] }[],
        publishedAt: input.published ? new Date() : null,
        categories: { connect: categoryIds.map((id) => ({ id })) },
        skus: { createMany: { data: input.skus } },
      },
    })
    createdProducts += 1

    const translations = Object.entries(input.translations ?? {})
      .filter(([languageId]) => languages.some((l) => l.id === languageId))
      .map(([languageId, t]) => ({
        productId: product.id,
        languageId,
        name: t.name,
        description: t.description,
      }))

    if (translations.length > 0) {
      const result = await prisma.productTranslation.createMany({ data: translations })
      createdTranslations += result.count
    }

    const skuCount = await prisma.sKU.count({ where: { productId: product.id, deletedAt: null } })
    createdSKUs += skuCount
  }

  console.log('\n🎉 HOÀN THÀNH!')
  console.log(`✅ Đã tạo ${createdProducts} sản phẩm`)
  console.log(`✅ Đã tạo ${createdSKUs} SKU`)
  console.log(`✅ Đã tạo ${createdTranslations} bản dịch sản phẩm`)
}

const main = async () => {
  try {
    await addProducts()
  } catch (error) {
    console.error('❌ Lỗi khi thêm Product:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('🏁 Script thêm Product hoàn thành!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('💥 Script thất bại:', err)
      process.exit(1)
    })
}

export { addProducts }
