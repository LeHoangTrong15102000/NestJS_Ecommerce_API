import { PrismaService } from 'src/shared/services/prisma.service'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { HashingService } from 'src/shared/services/hashing.service'
import { RoleName } from 'src/shared/constants/role.constant'
import { PaymentStatus } from 'src/shared/constants/payment.constant'

const prisma = new PrismaService()
const hashingService = new HashingService()

// URL hình ảnh S3 mẫu (dùng nhiều ảnh để dữ liệu phong phú hơn)
const SAMPLE_IMAGE_URL =
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/e001301b-245b-49f1-952c-be74426e9de1.jpg'
const SAMPLE_IMAGE_URLS = [
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/d79f483f-61d7-42dc-83ef-0e5b9037a275.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/a1affb40-aafc-4de1-a808-6efe7a41e85a.png',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/19ac0360-d1cd-496b-9cb9-f2aea4e440df.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/a1bf30cd-647f-4699-9765-8053f2e75a72.jpg',
]

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const pickImagesForProduct = (): string[] => {
  // Lấy 3-4 ảnh ngẫu nhiên không trùng nhau (nếu đủ)
  const shuffled = [...SAMPLE_IMAGE_URLS].sort(() => 0.5 - Math.random())
  const count = Math.min(4, Math.max(3, Math.floor(Math.random() * 4)))
  return shuffled.slice(0, count)
}

export const addCartOrderData = async () => {
  console.log('🛒 Bắt đầu thêm dữ liệu mẫu cho Cart và Order...\n')

  try {
    // Bước 1: Tạo dữ liệu cơ bản nếu chưa có
    console.log('📝 BƯỚC 1: Kiểm tra và tạo dữ liệu cơ bản...')

    // Kiểm tra và tạo Language
    const languages = await prisma.language.findMany()
    if (languages.length === 0) {
      await prisma.language.createMany({
        data: [
          { id: 'vi', name: 'Tiếng Việt' },
          { id: 'en', name: 'English' },
        ],
      })
      console.log('✅ Đã tạo ngôn ngữ mẫu')
    }

    // Kiểm tra và tạo Role
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
    }

    let sellerRole = await prisma.role.findFirst({
      where: { name: RoleName.Seller },
    })
    if (!sellerRole) {
      sellerRole = await prisma.role.create({
        data: {
          name: RoleName.Seller,
          description: 'Seller role',
        },
      })
      console.log('✅ Đã tạo role Seller')
    }

    // Bước 2: Tạo users (khách hàng và seller)
    console.log('\n👥 BƯỚC 2: Tạo users mẫu...')

    // Tạo khách hàng
    const clientUsers: any[] = []
    for (let i = 1; i <= 8; i++) {
      const hashedPassword = await hashingService.hash('User@123')
      let user = await prisma.user.findFirst({ where: { email: `customer${i}@example.com` } })
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `customer${i}@example.com`,
            name: `Khách hàng ${i}`,
            password: hashedPassword,
            phoneNumber: `090000000${i}`,
            avatar: SAMPLE_IMAGE_URL,
            status: UserStatus.ACTIVE,
            roleId: clientRole.id,
          },
        })
      }
      clientUsers.push(user)
    }

    // Tạo sellers (shop owners)
    const sellerUsers: any[] = []
    for (let i = 1; i <= 4; i++) {
      const hashedPassword = await hashingService.hash('Seller@123')
      let user = await prisma.user.findFirst({ where: { email: `seller${i}@example.com` } })
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `seller${i}@example.com`,
            name: `Shop ${i}`,
            password: hashedPassword,
            phoneNumber: `091000000${i}`,
            avatar: SAMPLE_IMAGE_URL,
            status: UserStatus.ACTIVE,
            roleId: sellerRole.id,
          },
        })
      }
      sellerUsers.push(user)
    }

    console.log(`✅ Đã tạo ${clientUsers.length} khách hàng và ${sellerUsers.length} seller`)

    // Bước 3: Tạo Brand
    console.log('\n🏷️ BƯỚC 3: Tạo brands mẫu...')

    const brands: any[] = []
    const brandNames = [
      'Apple',
      'Samsung',
      'Xiaomi',
      'Nike',
      'Adidas',
      'Sony',
      'LG',
      'Canon',
      'Dell',
      'HP',
      'Lenovo',
      'Asus',
      'MSI',
      'Razer',
      'Logitech',
    ]

    for (const brandName of brandNames) {
      let brand = await prisma.brand.findFirst({ where: { name: brandName } })
      if (!brand) {
        brand = await prisma.brand.create({
          data: { name: brandName, logo: SAMPLE_IMAGE_URL, createdById: sellerUsers[0].id },
        })
      }
      brands.push(brand)
    }

    console.log(`✅ Đã tạo ${brands.length} brands`)

    // Bước 4: Tạo Categories
    console.log('\n📂 BƯỚC 4: Tạo categories mẫu...')

    const categories: any[] = []
    const categoryData = [
      { name: 'Điện tử', logo: SAMPLE_IMAGE_URL },
      { name: 'Thời trang', logo: SAMPLE_IMAGE_URL },
      { name: 'Gia dụng', logo: SAMPLE_IMAGE_URL },
      { name: 'Thể thao', logo: SAMPLE_IMAGE_URL },
      { name: 'Sách', logo: SAMPLE_IMAGE_URL },
      { name: 'Nhà cửa', logo: SAMPLE_IMAGE_URL },
      { name: 'Làm đẹp', logo: SAMPLE_IMAGE_URL },
      { name: 'Đồ chơi', logo: SAMPLE_IMAGE_URL },
      { name: 'Ô tô', logo: SAMPLE_IMAGE_URL },
      { name: 'Thực phẩm', logo: SAMPLE_IMAGE_URL },
    ]

    for (const catData of categoryData) {
      let category = await prisma.category.findFirst({ where: { name: catData.name } })
      if (!category) {
        category = await prisma.category.create({
          data: {
            name: catData.name,
            logo: catData.logo,
            parentCategoryId: null,
            createdById: sellerUsers[0].id,
          },
        })
      }
      categories.push(category)

      // Tạo category translation
      const existedTrans = await prisma.categoryTranslation.findFirst({
        where: { categoryId: category.id, languageId: 'vi' },
      })
      if (!existedTrans) {
        await prisma.categoryTranslation.create({
          data: {
            categoryId: category.id,
            languageId: 'vi',
            name: catData.name,
            description: `Mô tả cho ${catData.name}`,
            createdById: sellerUsers[0].id,
          },
        })
      }
    }

    console.log(`✅ Đã tạo ${categories.length} categories`)

    // Bước 5: Tạo Products
    console.log('\n📦 BƯỚC 5: Tạo products mẫu...')

    const products: any[] = []
    const productData = [
      {
        name: 'iPhone 15 Pro Max',
        basePrice: 25000000,
        virtualPrice: 30000000,
        brandId: brands.find((b) => b.name === 'Apple')?.id || brands[0].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xanh'] },
          { value: 'Dung lượng', options: ['128GB', '256GB', '512GB'] },
        ],
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        basePrice: 22000000,
        virtualPrice: 26000000,
        brandId: brands.find((b) => b.name === 'Samsung')?.id || brands[1].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'Màu sắc', options: ['Đen', 'Xám', 'Tím'] },
          { value: 'Dung lượng', options: ['256GB', '512GB', '1TB'] },
        ],
      },
      {
        name: 'Áo thun Nike Dri-FIT',
        basePrice: 850000,
        virtualPrice: 1200000,
        brandId: brands.find((b) => b.name === 'Nike')?.id || brands[3].id,
        categoryIds: [categories[1].id, categories[3].id], // Thời trang & Thể thao
        variants: [
          { value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xanh', 'Đỏ'] },
          { value: 'Kích cỡ', options: ['S', 'M', 'L', 'XL', 'XXL'] },
        ],
      },
      {
        name: 'Giày chạy bộ Adidas Ultraboost',
        basePrice: 3500000,
        virtualPrice: 4200000,
        brandId: brands.find((b) => b.name === 'Adidas')?.id || brands[4].id,
        categoryIds: [categories[1].id, categories[3].id], // Thời trang & Thể thao
        variants: [
          { value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xanh'] },
          { value: 'Kích cỡ', options: ['39', '40', '41', '42', '43', '44'] },
        ],
      },
      {
        name: 'Xiaomi Mi 13',
        basePrice: 12000000,
        virtualPrice: 15000000,
        brandId: brands.find((b) => b.name === 'Xiaomi')?.id || brands[2].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xanh'] },
          { value: 'Dung lượng', options: ['128GB', '256GB'] },
        ],
      },
      {
        name: 'Sony WH-1000XM5',
        basePrice: 8500000,
        virtualPrice: 9500000,
        brandId: brands.find((b) => b.name === 'Sony')?.id || brands[5].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [{ value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xanh'] }],
      },
      {
        name: 'LG OLED C3 65"',
        basePrice: 35000000,
        virtualPrice: 40000000,
        brandId: brands.find((b) => b.name === 'LG')?.id || brands[6].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [{ value: 'Kích thước', options: ['55"', '65"', '77"'] }],
      },
      {
        name: 'Canon EOS R6 Mark II',
        basePrice: 45000000,
        virtualPrice: 50000000,
        brandId: brands.find((b) => b.name === 'Canon')?.id || brands[7].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'Màu sắc', options: ['Đen'] },
          { value: 'Kit Lens', options: ['Có', 'Không'] },
        ],
      },
      {
        name: 'Dell XPS 13 Plus',
        basePrice: 28000000,
        virtualPrice: 32000000,
        brandId: brands.find((b) => b.name === 'Dell')?.id || brands[8].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'CPU', options: ['i5', 'i7', 'i9'] },
          { value: 'RAM', options: ['8GB', '16GB', '32GB'] },
        ],
      },
      {
        name: 'HP Spectre x360',
        basePrice: 25000000,
        virtualPrice: 29000000,
        brandId: brands.find((b) => b.name === 'HP')?.id || brands[9].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'Màu sắc', options: ['Bạc', 'Đen', 'Xanh'] },
          { value: 'Màn hình', options: ['13"', '14"', '15"'] },
        ],
      },
      {
        name: 'Lenovo ThinkPad X1 Carbon',
        basePrice: 32000000,
        virtualPrice: 36000000,
        brandId: brands.find((b) => b.name === 'Lenovo')?.id || brands[10].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'CPU', options: ['i5', 'i7'] },
          { value: 'RAM', options: ['8GB', '16GB'] },
        ],
      },
      {
        name: 'Asus ROG Strix G15',
        basePrice: 22000000,
        virtualPrice: 25000000,
        brandId: brands.find((b) => b.name === 'Asus')?.id || brands[11].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'GPU', options: ['RTX 4060', 'RTX 4070', 'RTX 4080'] },
          { value: 'RAM', options: ['16GB', '32GB'] },
        ],
      },
      {
        name: 'MSI GE76 Raider',
        basePrice: 35000000,
        virtualPrice: 40000000,
        brandId: brands.find((b) => b.name === 'MSI')?.id || brands[12].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'GPU', options: ['RTX 4070', 'RTX 4080', 'RTX 4090'] },
          { value: 'Màn hình', options: ['15.6"', '17.3"'] },
        ],
      },
      {
        name: 'Razer Blade 15',
        basePrice: 38000000,
        virtualPrice: 42000000,
        brandId: brands.find((b) => b.name === 'Razer')?.id || brands[13].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [
          { value: 'GPU', options: ['RTX 4060', 'RTX 4070', 'RTX 4080'] },
          { value: 'Màn hình', options: ['QHD 165Hz', 'QHD 240Hz'] },
        ],
      },
      {
        name: 'Logitech MX Master 3S',
        basePrice: 2500000,
        virtualPrice: 3000000,
        brandId: brands.find((b) => b.name === 'Logitech')?.id || brands[14].id,
        categoryIds: [categories[0].id], // Điện tử
        variants: [{ value: 'Màu sắc', options: ['Đen', 'Trắng', 'Xám'] }],
      },
    ]

    for (const prodData of productData) {
      const product = await prisma.product.create({
        data: {
          name: prodData.name,
          basePrice: prodData.basePrice,
          virtualPrice: prodData.virtualPrice,
          brandId: prodData.brandId,
          images: pickImagesForProduct(),
          variants: prodData.variants,
          publishedAt: new Date(),
          createdById: sellerUsers[0].id,
          categories: {
            connect: prodData.categoryIds.map((id) => ({ id })),
          },
        },
      })

      // Tạo product translation
      await prisma.productTranslation.create({
        data: {
          productId: product.id,
          languageId: 'vi',
          name: prodData.name,
          description: `Mô tả chi tiết cho ${prodData.name}. Sản phẩm chất lượng cao với nhiều tính năng ưu việt.`,
          createdById: sellerUsers[0].id,
        },
      })

      products.push(product)
    }

    console.log(`✅ Đã tạo ${products.length} products`)

    // Bước 6: Tạo SKUs cho mỗi product
    console.log('\n🏷️ BƯỚC 6: Tạo SKUs cho products...')

    const skus: any[] = []

    for (const product of products) {
      const variants = product.variants as any[]
      if (variants && variants.length > 0) {
        // Tạo SKU combinations
        const firstVariant = variants[0]
        const secondVariant = variants[1] || null

        for (const option1 of firstVariant.options) {
          if (secondVariant) {
            for (const option2 of secondVariant.options) {
              const skuValue = `${option1} - ${option2}`
              const sku = await prisma.sKU.create({
                data: {
                  value: skuValue,
                  price: product.basePrice + Math.floor(Math.random() * 1000000), // Random price variation
                  stock: Math.floor(Math.random() * 100) + 10, // Random stock 10-109
                  image: pickRandom(SAMPLE_IMAGE_URLS),
                  productId: product.id,
                  createdById: sellerUsers[0].id,
                },
              })
              skus.push(sku)
            }
          } else {
            const sku = await prisma.sKU.create({
              data: {
                value: option1,
                price: product.basePrice + Math.floor(Math.random() * 500000), // Random price variation
                stock: Math.floor(Math.random() * 100) + 10, // Random stock 10-109
                image: pickRandom(SAMPLE_IMAGE_URLS),
                productId: product.id,
                createdById: sellerUsers[0].id,
              },
            })
            skus.push(sku)
          }
        }
      }
    }

    console.log(`✅ Đã tạo ${skus.length} SKUs`)

    // Bước 7: Tạo Cart Items
    console.log('\n🛒 BƯỚC 7: Tạo cart items mẫu...')

    const cartItems: any[] = []

    // Mỗi khách hàng sẽ có một số items trong giỏ hàng
    for (const customer of clientUsers) {
      // Random 5-12 items per customer (tăng số lượng)
      const numItems = Math.floor(Math.random() * 8) + 5
      const selectedSkus = skus.sort(() => 0.5 - Math.random()).slice(0, numItems)

      for (const sku of selectedSkus) {
        const cartItem = await prisma.cartItem.create({
          data: {
            skuId: sku.id,
            userId: customer.id,
            quantity: Math.floor(Math.random() * 5) + 1, // 1-5 quantity (tăng số lượng)
          },
        })
        cartItems.push(cartItem)
      }
    }

    console.log(`✅ Đã tạo ${cartItems.length} cart items`)

    // Bước 8: Tạo Orders từ một số cart items
    console.log('\n📋 BƯỚC 8: Tạo orders mẫu...')

    const orders: any[] = []

    // Tạo orders cho tất cả khách hàng (tăng số lượng orders)
    for (let i = 0; i < clientUsers.length; i++) {
      const customer = clientUsers[i]

      // Lấy một số cart items của customer này để tạo order
      const customerCartItems = cartItems.filter((item) => item.userId === customer.id)
      // Tạo 2-4 orders cho mỗi customer
      const numOrders = Math.floor(Math.random() * 3) + 2

      for (let orderIndex = 0; orderIndex < numOrders; orderIndex++) {
        // Chia cart items thành các order khác nhau
        const itemsPerOrder = Math.floor(customerCartItems.length / numOrders)
        const startIndex = orderIndex * itemsPerOrder
        const endIndex = orderIndex === numOrders - 1 ? customerCartItems.length : startIndex + itemsPerOrder
        const orderCartItems = customerCartItems.slice(startIndex, endIndex)

        if (orderCartItems.length > 0) {
          // Group cart items by seller (shop)
          const itemsByShop = new Map()

          for (const cartItem of orderCartItems) {
            const sku = skus.find((s) => s.id === cartItem.skuId)
            const product = products.find((p) => p.id === sku?.productId)
            const shopId = sellerUsers[0].id // Simplified: all products belong to first seller

            if (!itemsByShop.has(shopId)) {
              itemsByShop.set(shopId, [])
            }
            itemsByShop.get(shopId).push(cartItem)
          }

          // Tạo order cho mỗi shop
          for (const [shopId, items] of itemsByShop.entries()) {
            // Tính tổng tiền cho order
            let totalAmount = 0
            for (const cartItem of items) {
              const sku = skus.find((s) => s.id === cartItem.skuId)
              totalAmount += (sku?.price || 0) * cartItem.quantity
            }

            // Tạo payment trước
            const payment = await prisma.payment.create({
              data: {
                status: [PaymentStatus.PENDING, PaymentStatus.SUCCESS, PaymentStatus.FAILED][
                  Math.floor(Math.random() * 3)
                ],
              },
            })

            const order = await prisma.order.create({
              data: {
                userId: customer.id,
                status: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_PICKUP, OrderStatus.DELIVERED][
                  Math.floor(Math.random() * 3)
                ],
                receiver: {
                  name: customer.name,
                  phone: customer.phoneNumber,
                  address: `${123 + i} Đường ABC, Quận ${i + 1}, TP.HCM`,
                },
                shopId: shopId,
                paymentId: payment.id,
                createdById: customer.id,
              },
            })

            // Tạo ProductSKUSnapshot cho order
            for (const cartItem of items) {
              const sku = skus.find((s) => s.id === cartItem.skuId)
              const product = products.find((p) => p.id === sku?.productId)
              const productTranslation = await prisma.productTranslation.findFirst({
                where: { productId: product?.id, languageId: 'vi' },
              })

              await prisma.productSKUSnapshot.create({
                data: {
                  productId: product?.id || null,
                  productName: product?.name || 'Unknown Product',
                  productTranslations: productTranslation
                    ? [
                        {
                          id: productTranslation.id,
                          name: productTranslation.name,
                          description: productTranslation.description,
                          languageId: productTranslation.languageId,
                        },
                      ]
                    : [],
                  skuPrice: sku?.price || 0,
                  image: sku?.image || pickRandom(SAMPLE_IMAGE_URLS),
                  skuValue: sku?.value || 'Unknown',
                  skuId: sku?.id || null,
                  orderId: order.id,
                  quantity: cartItem.quantity,
                },
              })
            }

            orders.push(order)

            // Xóa cart items đã được order
            await prisma.cartItem.deleteMany({
              where: {
                id: { in: items.map((item) => item.id) },
              },
            })
          }
        }
      }
    }

    console.log(`✅ Đã tạo ${orders.length} orders`)

    // Hiển thị tóm tắt kết quả
    console.log('\n📊 TÓM TẮT KẾT QUẢ:')

    const finalStats = {
      users: await prisma.user.count({ where: { deletedAt: null } }),
      brands: await prisma.brand.count({ where: { deletedAt: null } }),
      categories: await prisma.category.count({ where: { deletedAt: null } }),
      products: await prisma.product.count({ where: { deletedAt: null } }),
      skus: await prisma.sKU.count({ where: { deletedAt: null } }),
      cartItems: await prisma.cartItem.count(),
      orders: await prisma.order.count({ where: { deletedAt: null } }),
      productSnapshots: await prisma.productSKUSnapshot.count(),
      payments: await prisma.payment.count(),
    }

    console.log(`✅ Tổng số users: ${finalStats.users}`)
    console.log(`✅ Tổng số brands: ${finalStats.brands}`)
    console.log(`✅ Tổng số categories: ${finalStats.categories}`)
    console.log(`✅ Tổng số products: ${finalStats.products}`)
    console.log(`✅ Tổng số SKUs: ${finalStats.skus}`)
    console.log(`✅ Tổng số cart items: ${finalStats.cartItems}`)
    console.log(`✅ Tổng số orders: ${finalStats.orders}`)
    console.log(`✅ Tổng số product snapshots: ${finalStats.productSnapshots}`)
    console.log(`✅ Tổng số payments: ${finalStats.payments}`)

    console.log('\n🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu cho Cart và Order thành công!')

    return finalStats
  } catch (error) {
    console.error('❌ Lỗi khi thêm dữ liệu Cart và Order:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addCartOrderData()
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
      console.log('\n🏁 Script hoàn thành thành công!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script thất bại:', error)
      process.exit(1)
    })
}
