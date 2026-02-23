import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

const VIETNAMESE_ADDRESSES = [
  '123 Nguyễn Huệ, Quận 1, TP.HCM',
  '456 Lê Lợi, Quận 1, TP.HCM',
  '789 Trần Hưng Đạo, Quận 5, TP.HCM',
  '101 Điện Biên Phủ, Quận 3, TP.HCM',
  '202 Võ Văn Tần, Quận 3, TP.HCM',
  '303 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
  '404 Lý Tự Trọng, Quận 1, TP.HCM',
  '505 Hai Bà Trưng, Quận 1, TP.HCM',
  '606 Pasteur, Quận 3, TP.HCM',
  '707 Nam Kỳ Khởi Nghĩa, Quận 3, TP.HCM',
]

const ENGLISH_ADDRESSES = [
  '123 Nguyen Hue, District 1, HCMC',
  '456 Le Loi, District 1, HCMC',
  '789 Tran Hung Dao, District 5, HCMC',
  '101 Dien Bien Phu, District 3, HCMC',
  '202 Vo Van Tan, District 3, HCMC',
  '303 Nguyen Thi Minh Khai, District 1, HCMC',
  '404 Ly Tu Trong, District 1, HCMC',
  '505 Hai Ba Trung, District 1, HCMC',
  '606 Pasteur, District 3, HCMC',
  '707 Nam Ky Khoi Nghia, District 3, HCMC',
]

const VIETNAMESE_DESCRIPTIONS = [
  'Khách hàng thân thiết từ năm 2024',
  'Thành viên VIP của hệ thống',
  'Khách hàng ưu tiên cao',
  'Người dùng tích cực trên nền tảng',
  'Khách hàng đã xác minh danh tính',
  'Thành viên chương trình khách hàng thân thiết',
  'Khách hàng mua sắm thường xuyên',
  'Người dùng đánh giá sản phẩm tích cực',
  'Khách hàng được giới thiệu bởi bạn bè',
  'Thành viên từ ngày đầu ra mắt',
]

const ENGLISH_DESCRIPTIONS = [
  'Loyal customer since 2024',
  'VIP member of the system',
  'High priority customer',
  'Active user on the platform',
  'Identity verified customer',
  'Loyalty program member',
  'Frequent shopper',
  'Active product reviewer',
  'Referred by friends',
  'Member since launch day',
]

export const addUserTranslationsData = async () => {
  console.log('🌐 Starting to add sample data for UserTranslation...\n')

  try {
    // Check if UserTranslation data already exists
    const existingCount = await prisma.userTranslation.count()
    if (existingCount > 0) {
      console.log(`Already have ${existingCount} user translations in database. Skipping sample data.`)
      return
    }

    // Fetch existing users
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    })

    if (users.length === 0) {
      console.log('⚠️  No users found. Please run user creation scripts first.')
      return
    }

    // Fetch existing languages (vi, en at minimum)
    const languages = await prisma.language.findMany({
      where: {
        deletedAt: null,
        id: { in: ['vi', 'en'] },
      },
      select: { id: true },
    })

    if (languages.length === 0) {
      console.log('⚠️  No languages found. Please run add-languages.ts script first.')
      return
    }

    console.log(`📊 Found ${users.length} users and ${languages.length} languages`)

    // Build translation data for all users and languages
    const translationsData: Array<{
      userId: number
      languageId: string
      address: string
      description: string
    }> = []

    users.forEach((user, index) => {
      languages.forEach((language) => {
        const addressIndex = index % VIETNAMESE_ADDRESSES.length
        const descIndex = index % VIETNAMESE_DESCRIPTIONS.length

        if (language.id === 'vi') {
          translationsData.push({
            userId: user.id,
            languageId: language.id,
            address: VIETNAMESE_ADDRESSES[addressIndex],
            description: VIETNAMESE_DESCRIPTIONS[descIndex],
          })
        } else if (language.id === 'en') {
          translationsData.push({
            userId: user.id,
            languageId: language.id,
            address: ENGLISH_ADDRESSES[addressIndex],
            description: ENGLISH_DESCRIPTIONS[descIndex],
          })
        }
      })
    })

    // Use createMany for batch operation
    const result = await prisma.userTranslation.createMany({
      data: translationsData,
      skipDuplicates: true,
    })

    console.log('\n🎉 COMPLETED!')
    console.log(`✅ Successfully created ${result.count} user translations`)
    console.log(`📊 Users processed: ${users.length}`)
    console.log(`📊 Languages used: ${languages.map((l) => l.id).join(', ')}`)
  } catch (error) {
    console.error('❌ Error adding user translations:', error)
    throw error
  }
}

const main = async () => {
  try {
    await addUserTranslationsData()
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

