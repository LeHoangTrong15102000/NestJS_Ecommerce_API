import { PrismaClient, VoucherType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🎫 Bắt đầu tạo dữ liệu mẫu cho Voucher...')

  // Lấy admin user để làm creator
  const adminUser = await prisma.user.findFirst({
    where: {
      role: { name: 'ADMIN' },
      deletedAt: null,
    },
  })

  // Lấy seller users
  const sellerUsers = await prisma.user.findMany({
    where: {
      role: { name: 'SELLER' },
      deletedAt: null,
    },
    take: 2, // Lấy 2 seller đầu tiên
  })

  if (!adminUser) {
    console.log('❌ Không tìm thấy admin user')
    return
  }

  console.log(`👤 Tìm thấy ${sellerUsers.length} seller user(s)`)

  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const voucherData = [
    // Platform Vouchers (Admin tạo)
    {
      code: 'WELCOME10',
      name: 'Voucher chào mừng thành viên mới',
      description: 'Giảm 10% cho đơn hàng đầu tiên, tối đa 50.000đ',
      type: VoucherType.PERCENTAGE,
      value: 10,
      minOrderValue: 200000,
      maxDiscount: 50000,
      usageLimit: 1000,
      userUsageLimit: 1,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      createdById: adminUser.id,
      sellerId: null, // Platform voucher
      applicableProducts: [],
      excludedProducts: [],
    },
    {
      code: 'FREESHIP50',
      name: 'Miễn phí vận chuyển',
      description: 'Miễn phí ship cho đơn từ 300.000đ',
      type: VoucherType.FREE_SHIPPING,
      value: 25000, // Giá trị phí ship được miễn
      minOrderValue: 300000,
      maxDiscount: null,
      usageLimit: 500,
      userUsageLimit: 3,
      startDate: now,
      endDate: nextWeek,
      isActive: true,
      createdById: adminUser.id,
      sellerId: null,
      applicableProducts: [],
      excludedProducts: [],
    },
    {
      code: 'SAVE100K',
      name: 'Giảm 100K cho đơn từ 1 triệu',
      description: 'Voucher giảm cố định 100.000đ',
      type: VoucherType.FIXED_AMOUNT,
      value: 100000,
      minOrderValue: 1000000,
      maxDiscount: null,
      usageLimit: 100,
      userUsageLimit: 1,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      createdById: adminUser.id,
      sellerId: null,
      applicableProducts: [],
      excludedProducts: [],
    },
    {
      code: 'FLASHSALE20',
      name: 'Flash Sale 20%',
      description: 'Giảm 20% trong khung giờ vàng',
      type: VoucherType.PERCENTAGE,
      value: 20,
      minOrderValue: 500000,
      maxDiscount: 200000,
      usageLimit: 50,
      userUsageLimit: 1,
      startDate: tomorrow,
      endDate: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000), // 2 giờ
      isActive: true,
      createdById: adminUser.id,
      sellerId: null,
      applicableProducts: [],
      excludedProducts: [],
    },
  ]

  // Seller Vouchers
  const sellerVoucherData: any[] = []

  // Seller 1 vouchers (nếu có seller đầu tiên)
  if (sellerUsers[0]) {
    sellerVoucherData.push(
      {
        code: 'SHOP1SALE15',
        name: 'Sale cuối tuần',
        description: 'Giảm 15% cho tất cả sản phẩm shop',
        type: VoucherType.PERCENTAGE,
        value: 15,
        minOrderValue: 150000,
        maxDiscount: 100000,
        usageLimit: 200,
        userUsageLimit: 2,
        startDate: now,
        endDate: nextWeek,
        isActive: true,
        createdById: sellerUsers[0].id,
        sellerId: sellerUsers[0].id,
        applicableProducts: [],
        excludedProducts: [],
      },
      {
        code: 'SHOP1NEW50',
        name: 'Sản phẩm mới',
        description: 'Giảm 50K cho sản phẩm mới ra mắt',
        type: VoucherType.FIXED_AMOUNT,
        value: 50000,
        minOrderValue: 200000,
        maxDiscount: null,
        usageLimit: 100,
        userUsageLimit: 1,
        startDate: now,
        endDate: nextMonth,
        isActive: true,
        createdById: sellerUsers[0].id,
        sellerId: sellerUsers[0].id,
        applicableProducts: [], // Có thể add specific product IDs sau
        excludedProducts: [],
      },
    )
  }

  // Seller 2 vouchers (nếu có seller thứ hai)
  if (sellerUsers[1]) {
    sellerVoucherData.push({
      code: 'SHOP2VIP25',
      name: 'VIP Member 25%',
      description: 'Voucher độc quyền cho thành viên VIP',
      type: VoucherType.PERCENTAGE,
      value: 25,
      minOrderValue: 800000,
      maxDiscount: 300000,
      usageLimit: 50,
      userUsageLimit: 1,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      createdById: sellerUsers[1].id,
      sellerId: sellerUsers[1].id,
      applicableProducts: [],
      excludedProducts: [],
    })
  }

  // Vouchers sắp hết hạn (để test)
  const expiredVoucherData = [
    {
      code: 'EXPIRED10',
      name: 'Voucher đã hết hạn',
      description: 'Voucher này đã hết hạn để test',
      type: VoucherType.PERCENTAGE,
      value: 10,
      minOrderValue: 100000,
      maxDiscount: 30000,
      usageLimit: 100,
      userUsageLimit: 1,
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 ngày trước
      endDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 ngày trước
      isActive: true,
      createdById: adminUser.id,
      sellerId: null,
      applicableProducts: [],
      excludedProducts: [],
    },
  ]

  // Vouchers chưa bắt đầu (để test)
  const futureVoucherData = [
    {
      code: 'FUTURE30',
      name: 'Voucher tương lai',
      description: 'Voucher sẽ có hiệu lực trong tương lai',
      type: VoucherType.PERCENTAGE,
      value: 30,
      minOrderValue: 500000,
      maxDiscount: 150000,
      usageLimit: 200,
      userUsageLimit: 2,
      startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 ngày sau
      endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 ngày sau
      isActive: true,
      createdById: adminUser.id,
      sellerId: null,
      applicableProducts: [],
      excludedProducts: [],
    },
  ]

  const allVoucherData = [
    ...voucherData,
    ...sellerVoucherData, // Đã filter ở trên rồi
    ...expiredVoucherData,
    ...futureVoucherData,
  ]

  try {
    // Xóa voucher cũ nếu có
    await prisma.userVoucher.deleteMany({})
    await prisma.voucher.deleteMany({})

    // Tạo voucher mới
    const createdVouchers: any[] = []
    for (const voucherInfo of allVoucherData) {
      const voucher = await prisma.voucher.create({
        data: voucherInfo,
      })
      createdVouchers.push(voucher)
    }

    console.log(`✅ Đã tạo ${createdVouchers.length} voucher mẫu`)

    // Tạo một số UserVoucher để test (user collect voucher)
    const regularUsers = await prisma.user.findMany({
      where: {
        role: { name: { not: 'ADMIN' } },
        deletedAt: null,
      },
      take: 3,
    })

    if (regularUsers.length > 0) {
      const userVoucherData: any[] = []

      // Mỗi user collect một số voucher
      for (const user of regularUsers) {
        // Collect 2-3 voucher đầu tiên
        for (let i = 0; i < Math.min(3, createdVouchers.length); i++) {
          userVoucherData.push({
            userId: user.id,
            voucherId: createdVouchers[i].id,
            usedCount: Math.random() > 0.7 ? 1 : 0, // 30% chance đã sử dụng
            usedAt: Math.random() > 0.7 ? new Date() : null,
          })
        }
      }

      if (userVoucherData.length > 0) {
        await prisma.userVoucher.createMany({
          data: userVoucherData,
        })
        console.log(`✅ Đã tạo ${userVoucherData.length} user voucher mẫu`)
      }
    }

    // Hiển thị thống kê
    const stats = {
      total: await prisma.voucher.count(),
      active: await prisma.voucher.count({ where: { isActive: true } }),
      platform: await prisma.voucher.count({ where: { sellerId: null } }),
      seller: await prisma.voucher.count({ where: { sellerId: { not: null } } }),
      expired: await prisma.voucher.count({
        where: { endDate: { lt: now } },
      }),
      future: await prisma.voucher.count({
        where: { startDate: { gt: now } },
      }),
      collected: await prisma.userVoucher.count(),
      used: await prisma.userVoucher.count({ where: { usedCount: { gt: 0 } } }),
    }

    console.log('📊 Thống kê voucher:')
    console.log(`   - Tổng số voucher: ${stats.total}`)
    console.log(`   - Voucher đang hoạt động: ${stats.active}`)
    console.log(`   - Voucher platform: ${stats.platform}`)
    console.log(`   - Voucher seller: ${stats.seller}`)
    console.log(`   - Voucher đã hết hạn: ${stats.expired}`)
    console.log(`   - Voucher tương lai: ${stats.future}`)
    console.log(`   - Voucher đã được lưu: ${stats.collected}`)
    console.log(`   - Voucher đã sử dụng: ${stats.used}`)

    // Hiển thị danh sách voucher codes
    console.log('\n🎫 Danh sách mã voucher có thể test:')
    for (const voucher of createdVouchers) {
      const status =
        voucher.startDate > now ? '⏳ Chưa bắt đầu' : voucher.endDate < now ? '❌ Hết hạn' : '✅ Đang hoạt động'
      console.log(`   - ${voucher.code}: ${voucher.name} ${status}`)
    }
  } catch (error) {
    console.error('❌ Lỗi khi tạo voucher:', error)
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
