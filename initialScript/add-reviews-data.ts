import { MediaType } from 'src/shared/constants/media.constant'
import { OrderStatus } from 'src/shared/constants/order.constant'
import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

// Dữ liệu mẫu cho reviews
const REVIEW_CONTENTS = [
  {
    rating: 5,
    contents: [
      'Sản phẩm tuyệt vời! Chất lượng vượt mong đợi, đóng gói cẩn thận. Rất hài lòng với lần mua hàng này.',
      'Đánh giá 5 sao! Sản phẩm chính hãng, giao hàng nhanh, shop tư vấn nhiệt tình. Sẽ ủng hộ shop lâu dài.',
      'Quá hài lòng với sản phẩm này! Chất lượng tốt, giá cả hợp lý. Đã giới thiệu cho bạn bè rồi.',
      'Sản phẩm đúng như mô tả, chất lượng cao cấp. Giao hàng nhanh chóng. Rất đáng mua!',
      'Tuyệt vời! Sản phẩm chất lượng, đóng gói đẹp. Shop phục vụ tận tình. 10 điểm cho shop!',
    ],
  },
  {
    rating: 4,
    contents: [
      'Sản phẩm tốt, đúng mô tả. Giao hàng hơi chậm một chút nhưng vẫn chấp nhận được.',
      'Chất lượng ổn, giá hợp lý. Trừ 1 sao vì đóng gói chưa cẩn thận lắm.',
      'Sản phẩm khá tốt, đáng giá tiền. Giao hàng đúng hẹn. Sẽ mua lại nếu có nhu cầu.',
      'Hài lòng với sản phẩm. Chất lượng tốt nhưng màu sắc hơi khác một chút so với hình.',
      'Sản phẩm ok, giao hàng nhanh. Trừ 1 sao vì không có quà tặng kèm như mô tả.',
    ],
  },
  {
    rating: 3,
    contents: [
      'Sản phẩm tạm được, chất lượng trung bình. Giá hơi cao so với chất lượng.',
      'Bình thường, không có gì đặc biệt. Giao hàng chậm hơn dự kiến.',
      'Sản phẩm ổn nhưng không xuất sắc. Có thể cân nhắc shop khác lần sau.',
      'Chất lượng tạm ổn, đúng giá tiền. Giao hàng hơi lâu.',
      'Sản phẩm như mô tả nhưng chất lượng không ấn tượng lắm.',
    ],
  },
  {
    rating: 2,
    contents: [
      'Sản phẩm không như mong đợi. Chất lượng kém hơn hình ảnh quảng cáo.',
      'Hơi thất vọng với sản phẩm. Giao hàng chậm, đóng gói không cẩn thận.',
      'Chất lượng không tốt lắm. Giá hơi cao so với chất lượng thực tế.',
      'Không hài lòng lắm. Sản phẩm có vài lỗi nhỏ, shop xử lý chậm.',
      'Sản phẩm tạm được nhưng có nhiều điểm chưa ưng ý.',
    ],
  },
  {
    rating: 1,
    contents: [
      'Rất thất vọng! Sản phẩm kém chất lượng, không giống hình. Không khuyến khích mua.',
      'Tệ! Giao hàng chậm, sản phẩm bị lỗi. Shop không hỗ trợ đổi trả.',
      'Chất lượng quá tệ, không đáng đồng tiền bát gạo. Rất thất vọng!',
      'Không nên mua! Sản phẩm kém, shop không chịu trách nhiệm.',
      'Tệ nhất từng mua! Sản phẩm lỗi, shop không giải quyết.',
    ],
  },
]

const SELLER_RESPONSES = [
  'Cảm ơn bạn đã tin tưởng và ủng hộ shop! Chúc bạn sử dụng sản phẩm vui vẻ ạ.',
  'Shop rất vui khi bạn hài lòng với sản phẩm. Mong bạn tiếp tục ủng hộ shop!',
  'Cảm ơn bạn đã đánh giá 5 sao! Shop sẽ cố gắng phục vụ tốt hơn nữa.',
  'Shop xin lỗi vì sự bất tiện này. Chúng tôi sẽ cải thiện dịch vụ tốt hơn.',
  'Cảm ơn góp ý của bạn! Shop sẽ khắc phục và phục vụ tốt hơn trong lần sau.',
  'Shop rất tiếc vì trải nghiệm chưa tốt của bạn. Vui lòng liên hệ shop để được hỗ trợ đổi trả.',
]

// URLs hình ảnh mẫu cho review media
const REVIEW_IMAGE_URLS = [
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/d79f483f-61d7-42dc-83ef-0e5b9037a275.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/a1affb40-aafc-4de1-a808-6efe7a41e85a.png',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/19ac0360-d1cd-496b-9cb9-f2aea4e440df.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/a1bf30cd-647f-4699-9765-8053f2e75a72.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/e001301b-245b-49f1-952c-be74426e9de1.jpg',
]

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export const addReviewsData = async () => {
  console.log('⭐ Bắt đầu thêm dữ liệu mẫu cho Reviews...\n')

  try {
    // Kiểm tra xem đã có reviews chưa
    const existingReviewCount = await prisma.review.count()
    if (existingReviewCount > 0) {
      console.log(`Đã có ${existingReviewCount} reviews trong database. Bỏ qua việc thêm dữ liệu mẫu.`)
      return
    }

    // Lấy tất cả orders đã DELIVERED (chỉ orders đã giao mới có thể review)
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        deletedAt: null,
      },
      include: {
        items: {
          select: {
            productId: true,
          },
        },
        user: true,
        shop: true,
      },
    })

    if (deliveredOrders.length === 0) {
      console.log('⚠️  Không có order nào đã DELIVERED. Vui lòng chạy script add-cart-order-data.ts trước.')
      return
    }

    console.log(`📦 Tìm thấy ${deliveredOrders.length} orders đã giao hàng`)

    let createdReviewsCount = 0
    let createdMediaCount = 0

    // Tạo reviews cho một số orders (không phải tất cả, để giống thực tế)
    // Khoảng 60-70% orders sẽ có review
    const ordersToReview = deliveredOrders.filter(() => Math.random() < 0.7)

    console.log(`\n⭐ Tạo reviews cho ${ordersToReview.length} orders...`)

    for (const order of ordersToReview) {
      // Lấy danh sách products trong order (loại bỏ trùng lặp)
      const productIds = [...new Set(order.items.map((item) => item.productId).filter((id) => id !== null))]

      // Review một số hoặc tất cả products trong order
      const productsToReview = productIds.filter(() => Math.random() < 0.8) // 80% products được review

      for (const productId of productsToReview) {
        if (!productId) continue

        // Chọn rating ngẫu nhiên (thiên về rating cao hơn - giống thực tế)
        const ratingWeights = [0.05, 0.1, 0.15, 0.25, 0.45] // 1-5 stars
        const rand = Math.random()
        let rating = 5
        let cumulative = 0
        for (let i = 0; i < ratingWeights.length; i++) {
          cumulative += ratingWeights[i]
          if (rand < cumulative) {
            rating = i + 1
            break
          }
        }

        // Lấy nội dung review tương ứng với rating
        const reviewData = REVIEW_CONTENTS.find((r) => r.rating === rating)
        const content = reviewData ? pickRandom(reviewData.contents) : 'Sản phẩm tốt!'

        try {
          // Tạo review
          const review = await prisma.review.create({
            data: {
              content,
              rating,
              productId,
              orderId: order.id,
              userId: order.userId,
              isVerifiedPurchase: true, // Vì mua từ order nên là verified
              helpfulCount: randomInt(0, 50), // Random số lượt "hữu ích"
            },
          })
          createdReviewsCount++

          // Thêm review media (60% reviews có hình ảnh)
          if (Math.random() < 0.6) {
            const mediaCount = randomInt(1, 3) // 1-3 hình ảnh
            const mediaUrls: string[] = []
            for (let i = 0; i < mediaCount; i++) {
              mediaUrls.push(pickRandom(REVIEW_IMAGE_URLS))
            }

            const medias = await prisma.reviewMedia.createMany({
              data: mediaUrls.map((url) => ({
                url,
                type: MediaType.IMAGE,
                reviewId: review.id,
              })),
            })
            createdMediaCount += medias.count
          }

          // Seller response (40% reviews có phản hồi từ seller)
          if (order.shop && Math.random() < 0.4) {
            await prisma.review.update({
              where: { id: review.id },
              data: {
                sellerResponse: pickRandom(SELLER_RESPONSES),
                sellerResponseAt: new Date(Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000), // 1-7 ngày sau
                sellerId: order.shopId,
              },
            })
          }
        } catch (error) {
          // Bỏ qua lỗi duplicate (đã review rồi)
          console.log(`  ⚠️  Bỏ qua review trùng lặp cho order ${order.id} - product ${productId}`)
        }
      }
    }

    console.log('\n🎉 HOÀN THÀNH!')
    console.log(`✅ Đã tạo thành công ${createdReviewsCount} reviews`)
    console.log(`✅ Đã tạo thành công ${createdMediaCount} review media (hình ảnh)`)
    console.log(`📊 Tỷ lệ review: ${((createdReviewsCount / deliveredOrders.length) * 100).toFixed(1)}%`)
  } catch (error) {
    console.error('❌ Lỗi khi thêm reviews:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addReviewsData()
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
