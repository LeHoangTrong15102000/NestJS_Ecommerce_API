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
        children: [
          {
            name: 'Smartphones',
            translations: {
              vi: {
                name: 'Điện thoại thông minh',
                description: 'iPhone, Samsung, Google Pixel và các thương hiệu khác.',
              },
              en: { name: 'Smartphones', description: 'iPhone, Samsung, Google Pixel and other brands.' },
            },
          },
          {
            name: 'Phone Accessories',
            translations: {
              vi: { name: 'Phụ kiện điện thoại', description: 'Ốp lưng, sạc, cáp và phụ kiện khác.' },
              en: { name: 'Phone Accessories', description: 'Cases, chargers, cables and other accessories.' },
            },
          },
        ],
      },
      {
        name: 'Laptops',
        translations: {
          vi: { name: 'Laptop', description: 'Máy tính xách tay cho công việc và giải trí.' },
          en: { name: 'Laptops', description: 'Laptops for work and entertainment.' },
        },
        children: [
          {
            name: 'Gaming Laptops',
            translations: {
              vi: { name: 'Laptop Gaming', description: 'Laptop chuyên dụng cho game với hiệu năng cao.' },
              en: { name: 'Gaming Laptops', description: 'Gaming laptops with high performance.' },
            },
          },
          {
            name: 'Business Laptops',
            translations: {
              vi: { name: 'Laptop Văn phòng', description: 'Laptop cho công việc văn phòng.' },
              en: { name: 'Business Laptops', description: 'Laptops for office work.' },
            },
          },
        ],
      },
      {
        name: 'Accessories',
        translations: {
          vi: { name: 'Phụ kiện', description: 'Tai nghe, sạc, ốp lưng và nhiều hơn nữa.' },
          en: { name: 'Accessories', description: 'Headphones, chargers, cases and more.' },
        },
        children: [
          {
            name: 'Audio',
            translations: {
              vi: { name: 'Âm thanh', description: 'Tai nghe, loa, microphone.' },
              en: { name: 'Audio', description: 'Headphones, speakers, microphones.' },
            },
          },
          {
            name: 'Charging',
            translations: {
              vi: { name: 'Sạc', description: 'Sạc dây, sạc không dây, powerbank.' },
              en: { name: 'Charging', description: 'Cables, wireless chargers, powerbanks.' },
            },
          },
        ],
      },
      {
        name: 'Gaming',
        translations: {
          vi: { name: 'Gaming', description: 'Thiết bị và phụ kiện chơi game.' },
          en: { name: 'Gaming', description: 'Gaming devices and accessories.' },
        },
        children: [
          {
            name: 'Consoles',
            translations: {
              vi: { name: 'Máy chơi game', description: 'PlayStation, Xbox, Nintendo Switch.' },
              en: { name: 'Consoles', description: 'PlayStation, Xbox, Nintendo Switch.' },
            },
          },
          {
            name: 'Gaming Accessories',
            translations: {
              vi: { name: 'Phụ kiện Gaming', description: 'Tay cầm, bàn phím, chuột gaming.' },
              en: { name: 'Gaming Accessories', description: 'Controllers, gaming keyboards, mice.' },
            },
          },
        ],
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
        children: [
          {
            name: 'Men Clothing',
            translations: {
              vi: { name: 'Quần áo Nam', description: 'Áo thun, quần jean, áo sơ mi nam.' },
              en: { name: 'Men Clothing', description: 'T-shirts, jeans, shirts for men.' },
            },
          },
          {
            name: 'Men Shoes',
            translations: {
              vi: { name: 'Giày Nam', description: 'Giày thể thao, giày công sở nam.' },
              en: { name: 'Men Shoes', description: 'Sports shoes, formal shoes for men.' },
            },
          },
        ],
      },
      {
        name: 'Women',
        translations: {
          vi: { name: 'Nữ', description: 'Thời trang nữ.' },
          en: { name: 'Women', description: 'Womens fashion.' },
        },
        children: [
          {
            name: 'Women Clothing',
            translations: {
              vi: { name: 'Quần áo Nữ', description: 'Váy, áo, quần nữ thời trang.' },
              en: { name: 'Women Clothing', description: 'Dresses, tops, pants for women.' },
            },
          },
          {
            name: 'Women Shoes',
            translations: {
              vi: { name: 'Giày Nữ', description: 'Giày cao gót, giày thể thao nữ.' },
              en: { name: 'Women Shoes', description: 'Heels, sports shoes for women.' },
            },
          },
        ],
      },
      {
        name: 'Kids',
        translations: {
          vi: { name: 'Trẻ em', description: 'Thời trang cho trẻ em.' },
          en: { name: 'Kids', description: 'Fashion for children.' },
        },
        children: [
          {
            name: 'Boys',
            translations: {
              vi: { name: 'Bé trai', description: 'Quần áo và giày cho bé trai.' },
              en: { name: 'Boys', description: 'Clothes and shoes for boys.' },
            },
          },
          {
            name: 'Girls',
            translations: {
              vi: { name: 'Bé gái', description: 'Quần áo và giày cho bé gái.' },
              en: { name: 'Girls', description: 'Clothes and shoes for girls.' },
            },
          },
        ],
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
        children: [
          {
            name: 'Cookware',
            translations: {
              vi: { name: 'Dụng cụ nấu ăn', description: 'Nồi, chảo, dao, thớt.' },
              en: { name: 'Cookware', description: 'Pots, pans, knives, cutting boards.' },
            },
          },
          {
            name: 'Appliances',
            translations: {
              vi: { name: 'Thiết bị bếp', description: 'Máy xay, lò vi sóng, tủ lạnh.' },
              en: { name: 'Appliances', description: 'Blenders, microwaves, refrigerators.' },
            },
          },
        ],
      },
      {
        name: 'Furniture',
        translations: {
          vi: { name: 'Nội thất', description: 'Bàn, ghế, tủ, giường.' },
          en: { name: 'Furniture', description: 'Tables, chairs, cabinets, beds.' },
        },
        children: [
          {
            name: 'Living Room',
            translations: {
              vi: { name: 'Phòng khách', description: 'Sofa, bàn trà, kệ tivi.' },
              en: { name: 'Living Room', description: 'Sofas, coffee tables, TV stands.' },
            },
          },
          {
            name: 'Bedroom',
            translations: {
              vi: { name: 'Phòng ngủ', description: 'Giường, tủ quần áo, bàn trang điểm.' },
              en: { name: 'Bedroom', description: 'Beds, wardrobes, dressing tables.' },
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Sports & Outdoors',
    logo: 'https://cdn-icons-png.flaticon.com/512/857/857455.png',
    translations: {
      vi: { name: 'Thể thao & Ngoài trời', description: 'Dụng cụ thể thao, đồ dã ngoại.' },
      en: { name: 'Sports & Outdoors', description: 'Sports equipment, outdoor gear.' },
    },
    children: [
      {
        name: 'Fitness',
        translations: {
          vi: { name: 'Thể dục', description: 'Dụng cụ tập thể dục, yoga.' },
          en: { name: 'Fitness', description: 'Exercise equipment, yoga gear.' },
        },
        children: [
          {
            name: 'Gym Equipment',
            translations: {
              vi: { name: 'Dụng cụ Gym', description: 'Tạ, máy tập, thảm yoga.' },
              en: { name: 'Gym Equipment', description: 'Weights, exercise machines, yoga mats.' },
            },
          },
          {
            name: 'Sports Wear',
            translations: {
              vi: { name: 'Đồ thể thao', description: 'Quần áo tập, giày thể thao.' },
              en: { name: 'Sports Wear', description: 'Workout clothes, sports shoes.' },
            },
          },
        ],
      },
      {
        name: 'Outdoor',
        translations: {
          vi: { name: 'Ngoài trời', description: 'Đồ dã ngoại, leo núi, cắm trại.' },
          en: { name: 'Outdoor', description: 'Camping, hiking, outdoor gear.' },
        },
        children: [
          {
            name: 'Camping',
            translations: {
              vi: { name: 'Cắm trại', description: 'Lều, túi ngủ, dụng cụ cắm trại.' },
              en: { name: 'Camping', description: 'Tents, sleeping bags, camping gear.' },
            },
          },
          {
            name: 'Hiking',
            translations: {
              vi: { name: 'Leo núi', description: 'Ba lô, giày leo núi, dụng cụ.' },
              en: { name: 'Hiking', description: 'Backpacks, hiking shoes, equipment.' },
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    logo: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    translations: {
      vi: { name: 'Làm đẹp & Chăm sóc cá nhân', description: 'Mỹ phẩm, đồ chăm sóc da, nước hoa.' },
      en: { name: 'Beauty & Personal Care', description: 'Cosmetics, skincare, perfumes.' },
    },
    children: [
      {
        name: 'Skincare',
        translations: {
          vi: { name: 'Chăm sóc da', description: 'Kem dưỡng, serum, mặt nạ.' },
          en: { name: 'Skincare', description: 'Moisturizers, serums, face masks.' },
        },
        children: [
          {
            name: 'Face Care',
            translations: {
              vi: { name: 'Chăm sóc mặt', description: 'Sữa rửa mặt, kem dưỡng ẩm.' },
              en: { name: 'Face Care', description: 'Facial cleansers, moisturizers.' },
            },
          },
          {
            name: 'Body Care',
            translations: {
              vi: { name: 'Chăm sóc cơ thể', description: 'Sữa tắm, kem dưỡng thể.' },
              en: { name: 'Body Care', description: 'Body wash, body lotions.' },
            },
          },
        ],
      },
      {
        name: 'Makeup',
        translations: {
          vi: { name: 'Trang điểm', description: 'Son môi, phấn, mascara.' },
          en: { name: 'Makeup', description: 'Lipsticks, powders, mascaras.' },
        },
        children: [
          {
            name: 'Face Makeup',
            translations: {
              vi: { name: 'Trang điểm mặt', description: 'Kem nền, phấn phủ, phấn má.' },
              en: { name: 'Face Makeup', description: 'Foundations, powders, blushes.' },
            },
          },
          {
            name: 'Eye Makeup',
            translations: {
              vi: { name: 'Trang điểm mắt', description: 'Mascara, eyeliner, phấn mắt.' },
              en: { name: 'Eye Makeup', description: 'Mascara, eyeliner, eyeshadows.' },
            },
          },
        ],
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
