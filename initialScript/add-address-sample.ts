import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏠 Bắt đầu tạo dữ liệu mẫu cho Address...')

  // Lấy danh sách user hiện có (trừ admin)
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: {
        name: { not: 'ADMIN' },
      },
    },
    take: 5, // Lấy 5 user đầu tiên
  })

  if (users.length === 0) {
    console.log('❌ Không tìm thấy user nào để tạo address')
    return
  }

  const addressData = [
    // User 1 - Hồ Chí Minh
    {
      userId: users[0]?.id,
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
      userId: users[0]?.id,
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
      userId: users[1]?.id,
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
      userId: users[2]?.id,
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

    // User 4 - Cần Thơ
    {
      userId: users[3]?.id,
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
      userId: users[3]?.id,
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
  ]

  // Lọc ra những address có userId hợp lệ
  const validAddresses = addressData.filter((addr) => addr.userId)

  if (validAddresses.length === 0) {
    console.log('❌ Không có address hợp lệ để tạo')
    return
  }

  try {
    // Xóa address cũ nếu có
    await prisma.address.deleteMany({
      where: {
        userId: { in: users.map((u) => u.id) },
      },
    })

    // Tạo address mới
    const createdAddresses = await prisma.address.createMany({
      data: validAddresses,
    })

    console.log(`✅ Đã tạo ${createdAddresses.count} address mẫu`)

    // Hiển thị thống kê
    const stats = await prisma.address.groupBy({
      by: ['userId'],
      _count: {
        id: true,
      },
      where: {
        userId: { in: users.map((u) => u.id) },
      },
    })

    console.log('📊 Thống kê address theo user:')
    for (const stat of stats) {
      const user = users.find((u) => u.id === stat.userId)
      console.log(`   - ${user?.name}: ${stat._count.id} address`)
    }
  } catch (error) {
    console.error('❌ Lỗi khi tạo address:', error)
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
