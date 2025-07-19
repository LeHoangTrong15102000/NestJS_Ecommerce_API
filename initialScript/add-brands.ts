import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

const addBrands = async () => {
  // Kiểm tra xem đã có brands nào chưa
  const existingBrandCount = await prisma.brand.count()

  if (existingBrandCount > 0) {
    console.log(`Đã có ${existingBrandCount} thương hiệu trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
    return
  }

  // Kiểm tra xem có ngôn ngữ nào trong database chưa
  const languages = await prisma.language.findMany({
    where: { deletedAt: null },
  })

  if (languages.length === 0) {
    console.log('⚠️  Chưa có ngôn ngữ nào trong database. Vui lòng chạy script add-languages.ts trước.')
    return
  }

  // Dữ liệu mẫu cho các thương hiệu nổi tiếng
  const brandsData = [
    {
      name: 'Apple',
      logo: 'https://logo.clearbit.com/apple.com',
      translations: {
        vi: {
          name: 'Apple',
          description:
            'Công ty công nghệ hàng đầu thế giới, chuyên sản xuất iPhone, iPad, MacBook và các sản phẩm điện tử cao cấp.',
        },
        en: {
          name: 'Apple',
          description:
            "World's leading technology company, specializing in iPhone, iPad, MacBook and premium electronics.",
        },
        zh: { name: '苹果', description: '世界领先的科技公司，专业生产iPhone、iPad、MacBook和高端电子产品。' },
        ja: {
          name: 'アップル',
          description:
            '世界をリードするテクノロジー企業で、iPhone、iPad、MacBookなどのプレミアム電子機器を専門としています。',
        },
      },
    },
    {
      name: 'Samsung',
      logo: 'https://logo.clearbit.com/samsung.com',
      translations: {
        vi: {
          name: 'Samsung',
          description:
            'Tập đoàn điện tử đa quốc gia Hàn Quốc, sản xuất smartphone, TV, tủ lạnh và nhiều thiết bị gia dụng.',
        },
        en: {
          name: 'Samsung',
          description:
            'South Korean multinational electronics corporation, manufacturing smartphones, TVs, refrigerators and home appliances.',
        },
        zh: { name: '三星', description: '韩国跨国电子公司，制造智能手机、电视、冰箱和家用电器。' },
        ko: { name: '삼성', description: '한국의 다국적 전자 기업으로 스마트폰, TV, 냉장고 및 가전제품을 제조합니다.' },
      },
    },
    {
      name: 'Nike',
      logo: 'https://logo.clearbit.com/nike.com',
      translations: {
        vi: {
          name: 'Nike',
          description:
            'Thương hiệu thể thao hàng đầu thế giới, chuyên sản xuất giày dép, quần áo và phụ kiện thể thao.',
        },
        en: {
          name: 'Nike',
          description: "World's leading sports brand, specializing in athletic footwear, apparel, and accessories.",
        },
        zh: { name: '耐克', description: '世界领先的体育品牌，专门生产运动鞋、服装和配件。' },
        es: {
          name: 'Nike',
          description: 'La marca deportiva líder mundial, especializada en calzado deportivo, ropa y accesorios.',
        },
      },
    },
    {
      name: 'Adidas',
      logo: 'https://logo.clearbit.com/adidas.com',
      translations: {
        vi: {
          name: 'Adidas',
          description:
            'Thương hiệu thể thao Đức nổi tiếng với 3 sọc đặc trưng, sản xuất giày thể thao và trang phục thể thao.',
        },
        en: {
          name: 'Adidas',
          description: 'German sports brand famous for its three stripes, manufacturing athletic shoes and sportswear.',
        },
        de: {
          name: 'Adidas',
          description:
            'Deutsche Sportmarke, berühmt für ihre drei Streifen, die Sportschuhe und Sportbekleidung herstellt.',
        },
        fr: {
          name: 'Adidas',
          description:
            'Marque de sport allemande célèbre pour ses trois bandes, fabricant de chaussures de sport et de vêtements de sport.',
        },
      },
    },
    {
      name: 'Sony',
      logo: 'https://logo.clearbit.com/sony.com',
      translations: {
        vi: {
          name: 'Sony',
          description:
            'Tập đoàn giải trí và công nghệ Nhật Bản, sản xuất PlayStation, camera, tai nghe và thiết bị điện tử.',
        },
        en: {
          name: 'Sony',
          description:
            'Japanese entertainment and technology corporation, manufacturing PlayStation, cameras, headphones and electronics.',
        },
        ja: {
          name: 'ソニー',
          description:
            '日本のエンターテインメントおよびテクノロジー企業で、PlayStation、カメラ、ヘッドフォン、電子機器を製造しています。',
        },
        zh: { name: '索尼', description: '日本娱乐和技术公司，制造PlayStation、相机、耳机和电子设备。' },
      },
    },
    {
      name: 'LG',
      logo: 'https://logo.clearbit.com/lg.com',
      translations: {
        vi: {
          name: 'LG',
          description: 'Tập đoàn điện tử Hàn Quốc, chuyên sản xuất TV, tủ lạnh, máy giặt và smartphone.',
        },
        en: {
          name: 'LG',
          description:
            'South Korean electronics corporation, specializing in TVs, refrigerators, washing machines and smartphones.',
        },
        ko: { name: 'LG', description: '한국의 전자 기업으로 TV, 냉장고, 세탁기, 스마트폰을 전문으로 제조합니다.' },
        zh: { name: 'LG', description: '韩国电子公司，专门制造电视、冰箱、洗衣机和智能手机。' },
      },
    },
    {
      name: 'Coca-Cola',
      logo: 'https://logo.clearbit.com/coca-cola.com',
      translations: {
        vi: {
          name: 'Coca-Cola',
          description:
            'Thương hiệu nước giải khát nổi tiếng nhất thế giới, sản xuất Coca-Cola, Sprite, Fanta và nhiều đồ uống khác.',
        },
        en: {
          name: 'Coca-Cola',
          description: "World's most famous beverage brand, producing Coca-Cola, Sprite, Fanta and many other drinks.",
        },
        es: {
          name: 'Coca-Cola',
          description:
            'La marca de bebidas más famosa del mundo, que produce Coca-Cola, Sprite, Fanta y muchas otras bebidas.',
        },
        zh: { name: '可口可乐', description: '世界上最著名的饮料品牌，生产可口可乐、雪碧、芬达和许多其他饮料。' },
      },
    },
    {
      name: 'Microsoft',
      logo: 'https://logo.clearbit.com/microsoft.com',
      translations: {
        vi: {
          name: 'Microsoft',
          description: 'Công ty công nghệ hàng đầu, phát triển Windows, Office, Xbox và các dịch vụ đám mây Azure.',
        },
        en: {
          name: 'Microsoft',
          description: 'Leading technology company, developing Windows, Office, Xbox and Azure cloud services.',
        },
        zh: { name: '微软', description: '领先的技术公司，开发Windows、Office、Xbox和Azure云服务。' },
        de: {
          name: 'Microsoft',
          description:
            'Führendes Technologieunternehmen, das Windows, Office, Xbox und Azure-Cloud-Services entwickelt.',
        },
      },
    },
    {
      name: 'Google',
      logo: 'https://logo.clearbit.com/google.com',
      translations: {
        vi: {
          name: 'Google',
          description:
            'Công ty công nghệ toàn cầu, cung cấp dịch vụ tìm kiếm, Gmail, YouTube, Android và Google Cloud.',
        },
        en: {
          name: 'Google',
          description:
            'Global technology company, providing search services, Gmail, YouTube, Android and Google Cloud.',
        },
        zh: { name: '谷歌', description: '全球技术公司，提供搜索服务、Gmail、YouTube、Android和Google Cloud。' },
        ja: {
          name: 'グーグル',
          description:
            '世界的なテクノロジー企業で、検索サービス、Gmail、YouTube、Android、Google Cloudを提供しています。',
        },
      },
    },
    {
      name: 'Tesla',
      logo: 'https://logo.clearbit.com/tesla.com',
      translations: {
        vi: {
          name: 'Tesla',
          description: 'Công ty xe điện hàng đầu thế giới, sản xuất xe điện cao cấp và hệ thống năng lượng tái tạo.',
        },
        en: {
          name: 'Tesla',
          description:
            "World's leading electric vehicle company, manufacturing premium electric cars and renewable energy systems.",
        },
        zh: { name: '特斯拉', description: '世界领先的电动汽车公司，制造高端电动汽车和可再生能源系统。' },
        de: {
          name: 'Tesla',
          description:
            'Weltweit führendes Elektrofahrzeugunternehmen, das Premium-Elektroautos und erneuerbare Energiesysteme herstellt.',
        },
      },
    },
  ]

  try {
    let createdBrandsCount = 0
    let createdTranslationsCount = 0

    // Tạo từng brand và translations một cách tuần tự để có thể handle lỗi tốt hơn
    for (const brandData of brandsData) {
      console.log(`📦 Đang tạo thương hiệu: ${brandData.name}...`)

      // Tạo brand
      const brand = await prisma.brand.create({
        data: {
          name: brandData.name,
          logo: brandData.logo,
        },
      })
      createdBrandsCount++

      // Tạo translations cho brand này
      const translations = Object.entries(brandData.translations)
        .filter(([langId]) => languages.some((lang) => lang.id === langId))
        .map(([langId, translation]) => ({
          brandId: brand.id,
          languageId: langId,
          name: translation.name,
          description: translation.description,
        }))

      if (translations.length > 0) {
        const result = await prisma.brandTranslation.createMany({
          data: translations,
        })
        createdTranslationsCount += result.count
        console.log(`  ✅ Đã tạo ${result.count} bản dịch cho ${brandData.name}`)
      }
    }

    console.log('\n🎉 HOÀN THÀNH!')
    console.log(`✅ Đã tạo thành công ${createdBrandsCount} thương hiệu`)
    console.log(`✅ Đã tạo thành công ${createdTranslationsCount} bản dịch thương hiệu`)
    console.log('\n📋 Danh sách thương hiệu đã thêm:')
    brandsData.forEach((brand, index) => {
      console.log(`${index + 1}. ${brand.name}`)
    })
  } catch (error) {
    console.error('❌ Lỗi khi thêm thương hiệu:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addBrands()
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
      console.log('🎉 Script hoàn thành thành công!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script thất bại:', error)
      process.exit(1)
    })
}

export { addBrands }
