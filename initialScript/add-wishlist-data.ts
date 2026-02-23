import { PrismaService } from 'src/shared/services/prisma.service'
import { RoleName } from 'src/shared/constants/role.constant'

const prisma = new PrismaService()

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Dữ liệu mẫu cho wishlist notes
const WISHLIST_NOTES = [
  'Mua cho sinh nhật mẹ',
  'Quà tặng bạn gái',
  'Đợi giảm giá',
  'Cần mua khi có tiền',
  'Sản phẩm yêu thích',
  'Mua cho dịp Tết',
  'Quà tặng đồng nghiệp',
  'Đợi sale cuối năm',
  'Mua khi có khuyến mãi',
  'Cần nghiên cứu thêm',
]

// Tên collections mẫu
const COLLECTION_NAMES = [
  { name: 'Quà sinh nhật', description: 'Danh sách quà tặng sinh nhật cho người thân' },
  { name: 'Đồ điện tử muốn mua', description: 'Các sản phẩm công nghệ đang theo dõi' },
  { name: 'Thời trang yêu thích', description: 'Trang phục và phụ kiện đẹp' },
  { name: 'Đợi sale', description: 'Sản phẩm đang chờ giảm giá' },
  { name: 'Quà Tết', description: 'Quà tặng cho dịp Tết Nguyên Đán' },
  { name: 'Cho bé', description: 'Đồ dùng và đồ chơi cho trẻ em' },
  { name: 'Nội thất', description: 'Đồ nội thất cho nhà mới' },
  { name: 'Sách hay', description: 'Sách muốn đọc' },
]

export const addWishlistData = async () => {
  console.log('💝 Bắt đầu thêm dữ liệu mẫu cho Wishlist...\n')

  try {
    // Kiểm tra xem đã có wishlist items chưa
    const existingWishlistCount = await prisma.wishlistItem.count()
    if (existingWishlistCount > 0) {
      console.log(`Đã có ${existingWishlistCount} wishlist items trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
      return
    }

    // Lấy danh sách users (clients)
    const clientRole = await prisma.role.findFirst({
      where: { name: RoleName.Client },
    })

    if (!clientRole) {
      console.log('⚠️  Không tìm thấy role Client. Vui lòng chạy script khởi tạo roles trước.')
      return
    }

    const users = await prisma.user.findMany({
      where: {
        roleId: clientRole.id,
        deletedAt: null,
      },
      take: 20, // Lấy tối đa 20 users
    })

    if (users.length === 0) {
      console.log('⚠️  Không có user nào. Vui lòng chạy script add-cart-order-data.ts trước.')
      return
    }

    console.log(`👥 Tìm thấy ${users.length} users`)

    // Lấy danh sách products và SKUs
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        publishedAt: { not: null },
      },
      include: {
        skus: {
          where: { deletedAt: null },
          take: 3, // Lấy tối đa 3 SKUs cho mỗi product
        },
      },
      take: 50, // Lấy tối đa 50 products
    })

    if (products.length === 0) {
      console.log('⚠️  Không có product nào. Vui lòng chạy script add-products.ts trước.')
      return
    }

    console.log(`📦 Tìm thấy ${products.length} products`)

    let createdWishlistItemsCount = 0
    let createdCollectionsCount = 0
    let createdPriceAlertsCount = 0

    // Tạo wishlist items cho mỗi user
    console.log('\n💝 Tạo wishlist items...')

    for (const user of users) {
      // Mỗi user có 3-10 wishlist items
      const itemCount = randomInt(3, 10)
      const selectedProducts = [...products].sort(() => 0.5 - Math.random()).slice(0, itemCount)

      for (const product of selectedProducts) {
        // 50% chance chọn SKU cụ thể, 50% chỉ wishlist product
        const sku = product.skus.length > 0 && Math.random() < 0.5 ? pickRandom(product.skus) : null

        // Priority: 70% normal, 20% high, 10% urgent
        const priorityRand = Math.random()
        const priority = priorityRand < 0.7 ? 0 : priorityRand < 0.9 ? 1 : 2

        // 40% có note
        const note = Math.random() < 0.4 ? pickRandom(WISHLIST_NOTES) : null

        try {
          const wishlistItem = await prisma.wishlistItem.create({
            data: {
              userId: user.id,
              productId: product.id,
              skuId: sku?.id || null,
              note,
              priority,
              notifyOnPriceDrops: Math.random() < 0.8, // 80% bật thông báo giảm giá
              notifyOnBackInStock: Math.random() < 0.6, // 60% bật thông báo hết hàng
              notifyOnPromotion: Math.random() < 0.7, // 70% bật thông báo khuyến mãi
            },
          })
          createdWishlistItemsCount++

          // Tạo price alert cho wishlist item
          const currentPrice = sku ? sku.price : product.basePrice
          const originalPrice = currentPrice * randomInt(95, 105) / 100 // Giá gốc dao động ±5%

          // 30% users set target price (giá mong muốn)
          const targetPrice = Math.random() < 0.3 ? currentPrice * randomInt(70, 90) / 100 : null

          await prisma.wishlistPriceAlert.create({
            data: {
              wishlistItemId: wishlistItem.id,
              originalPrice,
              currentPrice,
              targetPrice,
              lastCheckedAt: new Date(),
            },
          })
          createdPriceAlertsCount++
        } catch (error) {
          // Bỏ qua lỗi duplicate (đã wishlist rồi)
          console.log(`  ⚠️  Bỏ qua wishlist item trùng lặp cho user ${user.id} - product ${product.id}`)
        }
      }
    }

    console.log(`✅ Đã tạo ${createdWishlistItemsCount} wishlist items`)
    console.log(`✅ Đã tạo ${createdPriceAlertsCount} price alerts`)

    // Tạo wishlist collections cho một số users
    console.log('\n📁 Tạo wishlist collections...')

    // 50% users tạo collections
    const usersWithCollections = users.filter(() => Math.random() < 0.5)

    for (const user of usersWithCollections) {
      // Mỗi user tạo 1-3 collections
      const collectionCount = randomInt(1, 3)
      const selectedCollectionNames = [...COLLECTION_NAMES]
        .sort(() => 0.5 - Math.random())
        .slice(0, collectionCount)

      for (const collectionData of selectedCollectionNames) {
        // 30% collections là public
        const isPublic = Math.random() < 0.3
        const shareCode = isPublic ? generateShareCode() : null

        const collection = await prisma.wishlistCollection.create({
          data: {
            userId: user.id,
            name: collectionData.name,
            description: collectionData.description,
            isPublic,
            shareCode,
          },
        })
        createdCollectionsCount++

        // Thêm 2-5 wishlist items vào collection
        const userWishlistItems = await prisma.wishlistItem.findMany({
          where: { userId: user.id },
          take: randomInt(2, 5),
        })

        for (const item of userWishlistItems) {
          try {
            await prisma.wishlistCollectionItem.create({
              data: {
                collectionId: collection.id,
                wishlistItemId: item.id,
              },
            })
          } catch (error) {
            // Bỏ qua lỗi duplicate
          }
        }
      }
    }

    console.log(`✅ Đã tạo ${createdCollectionsCount} collections`)

    console.log('\n🎉 HOÀN THÀNH!')
    console.log(`📊 Tổng kết:`)
    console.log(`  - ${createdWishlistItemsCount} wishlist items`)
    console.log(`  - ${createdPriceAlertsCount} price alerts`)
    console.log(`  - ${createdCollectionsCount} collections`)
    console.log(`  - Trung bình ${(createdWishlistItemsCount / users.length).toFixed(1)} items/user`)
  } catch (error) {
    console.error('❌ Lỗi khi thêm wishlist data:', error)
    throw error
  }
}

// Helper function để generate share code
function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addWishlistData()
  } catch (error) {
    console.error('❌ Script thất bại:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Chỉ chạy khi file được execute trực tiếp
if (require.main === module) {
  main()
}

