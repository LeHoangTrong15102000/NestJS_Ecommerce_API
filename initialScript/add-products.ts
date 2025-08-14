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
    skus: [],
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
  {
    name: 'Galaxy Book Pro',
    brandName: 'Samsung',
    categoryNames: ['Laptops'],
    basePrice: 1100,
    virtualPrice: 1299,
    images: ['https://images.unsplash.com/photo-1699999999-galaxy-book'],
    variants: [
      { value: 'Color', options: ['Silver', 'Black'] },
      { value: 'RAM', options: ['8GB', '16GB'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Galaxy Book Pro', description: 'Laptop Samsung cao cấp với màn hình AMOLED tuyệt đẹp.' },
      en: { name: 'Galaxy Book Pro', description: 'Premium Samsung laptop with beautiful AMOLED display.' },
    },
  },
  {
    name: 'AirPods Pro',
    brandName: 'Apple',
    categoryNames: ['Accessories'],
    basePrice: 250,
    virtualPrice: 299,
    images: ['https://images.unsplash.com/photo-1699999999-airpods-pro'],
    variants: [{ value: 'Color', options: ['White'] }],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'AirPods Pro', description: 'Tai nghe không dây cao cấp với chống ồn chủ động.' },
      en: { name: 'AirPods Pro', description: 'Premium wireless earbuds with active noise cancellation.' },
    },
  },
  {
    name: 'Galaxy Buds Pro',
    brandName: 'Samsung',
    categoryNames: ['Accessories'],
    basePrice: 200,
    virtualPrice: 249,
    images: ['https://images.unsplash.com/photo-1699999999-galaxy-buds'],
    variants: [{ value: 'Color', options: ['Black', 'White', 'Purple'] }],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Galaxy Buds Pro', description: 'Tai nghe Samsung với âm thanh chất lượng cao.' },
      en: { name: 'Galaxy Buds Pro', description: 'Samsung earbuds with high-quality sound.' },
    },
  },
  {
    name: 'Nike Air Max 270',
    brandName: 'Nike',
    categoryNames: ['Men'],
    basePrice: 150,
    virtualPrice: 180,
    images: ['https://images.unsplash.com/photo-1699999999-nike-airmax'],
    variants: [
      { value: 'Color', options: ['Black', 'White', 'Red'] },
      { value: 'Size', options: ['7', '8', '9', '10', '11'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Nike Air Max 270', description: 'Giày thể thao Nike với công nghệ Air Max tiên tiến.' },
      en: { name: 'Nike Air Max 270', description: 'Nike sports shoes with advanced Air Max technology.' },
    },
  },
  {
    name: 'Adidas Ultraboost',
    brandName: 'Adidas',
    categoryNames: ['Men'],
    basePrice: 180,
    virtualPrice: 220,
    images: ['https://images.unsplash.com/photo-1699999999-adidas-ultraboost'],
    variants: [
      { value: 'Color', options: ['Black', 'White', 'Blue'] },
      { value: 'Size', options: ['7', '8', '9', '10', '11'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Adidas Ultraboost', description: 'Giày chạy bộ Adidas với công nghệ Boost.' },
      en: { name: 'Adidas Ultraboost', description: 'Adidas running shoes with Boost technology.' },
    },
  },
  {
    name: 'Nike Air Force 1',
    brandName: 'Nike',
    categoryNames: ['Women'],
    basePrice: 100,
    virtualPrice: 120,
    images: ['https://images.unsplash.com/photo-1699999999-nike-airforce'],
    variants: [
      { value: 'Color', options: ['White', 'Pink', 'Purple'] },
      { value: 'Size', options: ['5', '6', '7', '8', '9'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Nike Air Force 1', description: 'Giày thể thao cổ điển Nike cho phái đẹp.' },
      en: { name: 'Nike Air Force 1', description: 'Classic Nike sports shoes for women.' },
    },
  },
  {
    name: 'Sony WH-1000XM4',
    brandName: 'Sony',
    categoryNames: ['Accessories'],
    basePrice: 350,
    virtualPrice: 399,
    images: ['https://images.unsplash.com/photo-1699999999-sony-wh1000xm4'],
    variants: [{ value: 'Color', options: ['Black', 'Silver'] }],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Sony WH-1000XM4', description: 'Tai nghe chống ồn Sony cao cấp.' },
      en: { name: 'Sony WH-1000XM4', description: 'Premium Sony noise-cancelling headphones.' },
    },
  },
  {
    name: 'LG OLED TV C3',
    brandName: 'LG',
    categoryNames: ['Home & Kitchen'],
    basePrice: 1500,
    virtualPrice: 1799,
    images: ['https://images.unsplash.com/photo-1699999999-lg-oled'],
    variants: [{ value: 'Size', options: ['55"', '65"', '77"'] }],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'LG OLED TV C3', description: 'TV OLED LG với chất lượng hình ảnh tuyệt vời.' },
      en: { name: 'LG OLED TV C3', description: 'LG OLED TV with excellent picture quality.' },
    },
  },
  {
    name: 'Coca-Cola Classic',
    brandName: 'Coca-Cola',
    categoryNames: ['Home & Kitchen'],
    basePrice: 2,
    virtualPrice: 3,
    images: ['https://images.unsplash.com/photo-1699999999-coca-cola'],
    variants: [
      { value: 'Size', options: ['330ml', '500ml', '1L', '2L'] },
      { value: 'Type', options: ['Regular', 'Zero Sugar', 'Diet'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Coca-Cola Classic', description: 'Nước giải khát Coca-Cola hương vị truyền thống.' },
      en: { name: 'Coca-Cola Classic', description: 'Traditional Coca-Cola soft drink.' },
    },
  },
  {
    name: 'Microsoft Surface Pro',
    brandName: 'Microsoft',
    categoryNames: ['Laptops'],
    basePrice: 1000,
    virtualPrice: 1199,
    images: ['https://images.unsplash.com/photo-1699999999-surface-pro'],
    variants: [
      { value: 'Color', options: ['Platinum', 'Black'] },
      { value: 'Storage', options: ['128GB', '256GB', '512GB'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Microsoft Surface Pro', description: 'Máy tính bảng 2 trong 1 của Microsoft.' },
      en: { name: 'Microsoft Surface Pro', description: 'Microsoft 2-in-1 tablet computer.' },
    },
  },
  {
    name: 'Google Pixel 8',
    brandName: 'Google',
    categoryNames: ['Phones'],
    basePrice: 700,
    virtualPrice: 799,
    images: ['https://images.unsplash.com/photo-1699999999-pixel-8'],
    variants: [
      { value: 'Color', options: ['Obsidian', 'Rose', 'Hazel'] },
      { value: 'Storage', options: ['128GB', '256GB'] },
    ],
    skus: [],
    published: true,
    translations: {
      vi: { name: 'Google Pixel 8', description: 'Smartphone Google với camera AI tiên tiến.' },
      en: { name: 'Google Pixel 8', description: 'Google smartphone with advanced AI camera.' },
    },
  },
  {
    name: 'Tesla Model 3',
    brandName: 'Tesla',
    categoryNames: ['Home & Kitchen'],
    basePrice: 40000,
    virtualPrice: 45000,
    images: ['https://images.unsplash.com/photo-1699999999-tesla-model3'],
    variants: [
      { value: 'Color', options: ['Pearl White', 'Solid Black', 'Midnight Silver'] },
      { value: 'Range', options: ['Standard Range', 'Long Range', 'Performance'] },
    ],
    skus: [],
    published: false,
    translations: {
      vi: { name: 'Tesla Model 3', description: 'Xe điện Tesla Model 3 với hiệu năng cao.' },
      en: { name: 'Tesla Model 3', description: 'Tesla Model 3 electric car with high performance.' },
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
        skus: { createMany: { data: input.skus.map((sku) => ({ ...sku, createdById: 1 })) } },
        createdById: 1,
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
