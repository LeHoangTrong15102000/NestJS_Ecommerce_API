import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

type CategorySeed = {
  name: string
  logo?: string
  children?: CategorySeed[]
  translations?: Record<string, { name: string; description: string }>
}

const categoriesData: CategorySeed[] = [
  {
    name: 'Electronics',
    logo: 'https://cdn-icons-png.flaticon.com/512/3514/3514491.png',
    translations: {
      vi: { name: 'Điện tử', description: 'Thiết bị điện tử, smartphone, laptop, phụ kiện.' },
      en: { name: 'Electronics', description: 'Electronic devices, smartphones, laptops, accessories.' },
    },
    children: [
      {
        name: 'Phones',
        translations: {
          vi: { name: 'Điện thoại', description: 'Điện thoại thông minh và phụ kiện.' },
          en: { name: 'Phones', description: 'Smartphones and accessories.' },
        },
      },
      {
        name: 'Laptops',
        translations: {
          vi: { name: 'Laptop', description: 'Máy tính xách tay cho công việc và giải trí.' },
          en: { name: 'Laptops', description: 'Laptops for work and entertainment.' },
        },
      },
      {
        name: 'Accessories',
        translations: {
          vi: { name: 'Phụ kiện', description: 'Tai nghe, sạc, ốp lưng và nhiều hơn nữa.' },
          en: { name: 'Accessories', description: 'Headphones, chargers, cases and more.' },
        },
      },
    ],
  },
  {
    name: 'Fashion',
    logo: 'https://cdn-icons-png.flaticon.com/512/892/892458.png',
    translations: {
      vi: { name: 'Thời trang', description: 'Quần áo, giày dép và phụ kiện thời trang.' },
      en: { name: 'Fashion', description: 'Clothes, shoes and fashion accessories.' },
    },
    children: [
      {
        name: 'Men',
        translations: {
          vi: { name: 'Nam', description: 'Thời trang nam.' },
          en: { name: 'Men', description: 'Mens fashion.' },
        },
      },
      {
        name: 'Women',
        translations: {
          vi: { name: 'Nữ', description: 'Thời trang nữ.' },
          en: { name: 'Women', description: 'Womens fashion.' },
        },
      },
    ],
  },
  {
    name: 'Home & Kitchen',
    logo: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
    translations: {
      vi: { name: 'Nhà cửa & Bếp', description: 'Đồ gia dụng, bếp núc, nội thất.' },
      en: { name: 'Home & Kitchen', description: 'Home appliances, kitchen, furniture.' },
    },
    children: [
      {
        name: 'Kitchen',
        translations: {
          vi: { name: 'Bếp', description: 'Dụng cụ nhà bếp và thiết bị nấu ăn.' },
          en: { name: 'Kitchen', description: 'Kitchen tools and cookware.' },
        },
      },
    ],
  },
]

const createCategoryRecursively = async (
  data: CategorySeed,
  languages: { id: string }[],
  parentCategoryId: number | null = null,
) => {
  const category = await prisma.category.create({
    data: {
      name: data.name,
      logo: data.logo ?? null,
      parentCategoryId,
    },
  })

  const translations = Object.entries(data.translations ?? {})
    .filter(([languageId]) => languages.some((l) => l.id === languageId))
    .map(([languageId, t]) => ({
      categoryId: category.id,
      languageId,
      name: t.name,
      description: t.description,
    }))

  if (translations.length > 0) {
    await prisma.categoryTranslation.createMany({ data: translations })
  }

  if (data.children?.length) {
    for (const child of data.children) {
      await createCategoryRecursively(child, languages, category.id)
    }
  }
  return category
}

const addCategories = async () => {
  const existingCount = await prisma.category.count({ where: { deletedAt: null } })
  if (existingCount > 0) {
    console.log(`Đã có ${existingCount} category trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
    return
  }

  const languages = await prisma.language.findMany({ where: { deletedAt: null }, select: { id: true } })
  if (languages.length === 0) {
    console.log('⚠️  Chưa có ngôn ngữ nào. Vui lòng chạy script add-languages.ts trước.')
    return
  }

  let createdCount = 0
  for (const root of categoriesData) {
    await createCategoryRecursively(root, languages, null)
    createdCount += 1
  }
  console.log('🎉 HOÀN THÀNH!')
  console.log(`✅ Đã tạo ${createdCount} danh mục gốc cùng các danh mục con và bản dịch.`)
}

const main = async () => {
  try {
    await addCategories()
  } catch (error) {
    console.error('❌ Lỗi khi thêm Category:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('🏁 Script thêm Category hoàn thành!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('💥 Script thất bại:', err)
      process.exit(1)
    })
}

export { addCategories }
