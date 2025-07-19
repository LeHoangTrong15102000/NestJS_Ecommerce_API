import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

const addLanguages = async () => {
  // Kiểm tra xem đã có languages nào chưa
  const existingLanguageCount = await prisma.language.count()

  if (existingLanguageCount > 0) {
    console.log(`Đã có ${existingLanguageCount} ngôn ngữ trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
    return
  }

  // Dữ liệu mẫu cho các ngôn ngữ phổ biến
  const languages = [
    {
      id: 'vi',
      name: 'Tiếng Việt',
    },
    {
      id: 'en',
      name: 'English',
    },
    {
      id: 'zh',
      name: '中文 (Chinese)',
    },
    {
      id: 'ja',
      name: '日本語 (Japanese)',
    },
    {
      id: 'ko',
      name: '한국어 (Korean)',
    },
    {
      id: 'fr',
      name: 'Français (French)',
    },
    {
      id: 'de',
      name: 'Deutsch (German)',
    },
    {
      id: 'es',
      name: 'Español (Spanish)',
    },
    {
      id: 'it',
      name: 'Italiano (Italian)',
    },
    {
      id: 'ru',
      name: 'Русский (Russian)',
    },
    {
      id: 'pt',
      name: 'Português (Portuguese)',
    },
    {
      id: 'ar',
      name: 'العربية (Arabic)',
    },
    {
      id: 'hi',
      name: 'हिन्दी (Hindi)',
    },
    {
      id: 'th',
      name: 'ไทย (Thai)',
    },
    {
      id: 'id',
      name: 'Bahasa Indonesia',
    },
  ]

  try {
    const result = await prisma.language.createMany({
      data: languages,
    })

    console.log(`✅ Đã thêm thành công ${result.count} ngôn ngữ vào database`)
    console.log('📋 Danh sách ngôn ngữ đã thêm:')
    languages.forEach((lang, index) => {
      console.log(`${index + 1}. ${lang.id} - ${lang.name}`)
    })
  } catch (error) {
    console.error('❌ Lỗi khi thêm ngôn ngữ:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addLanguages()
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

export { addLanguages }
