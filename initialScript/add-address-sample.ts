import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { RoleName } from 'src/shared/constants/role.constant'

const prisma = new PrismaService()
const hashingService = new HashingService()

export const addAddressSample = async () => {
  console.log('🏠 Bắt đầu tạo dữ liệu mẫu cho Address...\n')

  try {
    // Idempotency check: skip if addresses already exist
    const existingAddressCount = await prisma.address.count()
    if (existingAddressCount > 0) {
      console.log(`⏭️  Đã có ${existingAddressCount} address trong database. Bỏ qua việc tạo mới.`)
      return { skipped: true, existingCount: existingAddressCount }
    }

    // Bước 1: Kiểm tra và tạo Client role nếu chưa có
    console.log('📝 BƯỚC 1: Kiểm tra và tạo Client role...')

    let clientRole = await prisma.role.findFirst({
      where: { name: RoleName.Client },
    })
    if (!clientRole) {
      clientRole = await prisma.role.create({
        data: {
          name: RoleName.Client,
          description: 'Client role',
        },
      })
      console.log('✅ Đã tạo role Client')
    } else {
      console.log('✅ Role Client đã tồn tại')
    }

    // Bước 2: Kiểm tra và tạo users mẫu nếu chưa có
    console.log('\n👥 BƯỚC 2: Kiểm tra và tạo users mẫu...')

    const addressUsers: any[] = []
    const userNames = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E']

    for (let i = 0; i < userNames.length; i++) {
      let user = await prisma.user.findFirst({
        where: { email: `addressuser${i + 1}@example.com` },
      })

      if (!user) {
        const hashedPassword = await hashingService.hash('User@123')
        user = await prisma.user.create({
          data: {
            email: `addressuser${i + 1}@example.com`,
            name: userNames[i],
            password: hashedPassword,
            phoneNumber: `090123456${i}`,
            status: UserStatus.ACTIVE,
            roleId: clientRole.id,
          },
        })
        console.log(`✅ Đã tạo user: ${user.email}`)
      } else {
        console.log(`✅ User đã tồn tại: ${user.email}`)
      }
      addressUsers.push(user)
    }

    console.log(`✅ Tổng số users cho address: ${addressUsers.length}`)

    // Bước 3: Tạo address cho các users
    console.log('\n🏠 BƯỚC 3: Tạo address mẫu...')

    const addressData = [
      // User 1 - Hồ Chí Minh (2 addresses)
      {
        userId: addressUsers[0].id,
        name: 'Nguyễn Văn A',
        phone: '0901234567',
        provinceId: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtId: '760',
        districtName: 'Quận 1',
        wardId: '26734',
        wardName: 'Phường Bến Nghé',
        detail: '123 Đường Nguyễn Huệ',
        fullAddress: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
        isDefault: true,
      },
      {
        userId: addressUsers[0].id,
        name: 'Nguyễn Văn A (Công ty)',
        phone: '0901234567',
        provinceId: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtId: '770',
        districtName: 'Quận Tân Bình',
        wardId: '27127',
        wardName: 'Phường 2',
        detail: '456 Đường Hoàng Văn Thụ',
        fullAddress: '456 Đường Hoàng Văn Thụ, Phường 2, Quận Tân Bình, Thành phố Hồ Chí Minh',
        isDefault: false,
      },
      // User 2 - Hà Nội
      {
        userId: addressUsers[1].id,
        name: 'Trần Thị B',
        phone: '0912345678',
        provinceId: '01',
        provinceName: 'Thành phố Hà Nội',
        districtId: '001',
        districtName: 'Quận Ba Đình',
        wardId: '00001',
        wardName: 'Phường Phúc Xá',
        detail: '789 Đường Hoàng Hoa Thám',
        fullAddress: '789 Đường Hoàng Hoa Thám, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội',
        isDefault: true,
      },
      // User 3 - Đà Nẵng
      {
        userId: addressUsers[2].id,
        name: 'Lê Văn C',
        phone: '0923456789',
        provinceId: '48',
        provinceName: 'Thành phố Đà Nẵng',
        districtId: '490',
        districtName: 'Quận Hải Châu',
        wardId: '20194',
        wardName: 'Phường Hải Châu I',
        detail: '321 Đường Trần Phú',
        fullAddress: '321 Đường Trần Phú, Phường Hải Châu I, Quận Hải Châu, Thành phố Đà Nẵng',
        isDefault: true,
      },
      // User 4 - Cần Thơ (2 addresses)
      {
        userId: addressUsers[3].id,
        name: 'Phạm Thị D',
        phone: '0934567890',
        provinceId: '92',
        provinceName: 'Thành phố Cần Thơ',
        districtId: '916',
        districtName: 'Quận Ninh Kiều',
        wardId: '31117',
        wardName: 'Phường An Hòa',
        detail: '654 Đường 3 Tháng 2',
        fullAddress: '654 Đường 3 Tháng 2, Phường An Hòa, Quận Ninh Kiều, Thành phố Cần Thơ',
        isDefault: true,
      },
      {
        userId: addressUsers[3].id,
        name: 'Phạm Thị D (Nhà riêng)',
        phone: '0934567890',
        provinceId: '92',
        provinceName: 'Thành phố Cần Thơ',
        districtId: '917',
        districtName: 'Quận Bình Thủy',
        wardId: '31144',
        wardName: 'Phường Bình Thủy',
        detail: '987 Đường Nguyễn Văn Cừ',
        fullAddress: '987 Đường Nguyễn Văn Cừ, Phường Bình Thủy, Quận Bình Thủy, Thành phố Cần Thơ',
        isDefault: false,
      },
      // User 5 - Hồ Chí Minh (Quận 7)
      {
        userId: addressUsers[4].id,
        name: 'Hoàng Văn E',
        phone: '0945678901',
        provinceId: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtId: '778',
        districtName: 'Quận 7',
        wardId: '27538',
        wardName: 'Phường Tân Phú',
        detail: '111 Đường Nguyễn Thị Thập',
        fullAddress: '111 Đường Nguyễn Thị Thập, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh',
        isDefault: true,
      },
    ]

    const createdAddresses = await prisma.address.createMany({
      data: addressData,
    })

    console.log(`✅ Đã tạo ${createdAddresses.count} address mẫu`)

    // Hiển thị thống kê
    const stats = await prisma.address.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { userId: { in: addressUsers.map((u) => u.id) } },
    })

    console.log('\n📊 Thống kê address theo user:')
    for (const stat of stats) {
      const user = addressUsers.find((u) => u.id === stat.userId)
      console.log(`   - ${user?.name}: ${stat._count.id} address`)
    }

    console.log('\n🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu cho Address thành công!')

    return {
      usersCreated: addressUsers.length,
      addressesCreated: createdAddresses.count,
    }
  } catch (error) {
    console.error('❌ Lỗi khi thêm dữ liệu Address:', error)
    throw error
  }
}

const main = async () => {
  try {
    await addAddressSample()
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
