/**
 * SEED ALL - Master script to run all seed data in the correct dependency order
 *
 * Seed execution order (sorted by dependency):
 * 1. Languages (no dependencies)
 * 2. Roles & Admin User (no dependencies)
 * 3. Brands (depends on languages)
 * 4. Categories (depends on languages)
 * 5. Products (depends on brands, categories, languages)
 * 6. User Translations (depends on users, languages)
 * 7. Addresses (depends on users)
 * 8. Vouchers (depends on users)
 * 9. Cart & Orders (depends on users, products)
 * 10. Payment Transactions (depends on orders, payments)
 * 11. Reviews (depends on orders)
 * 12. Wishlists (depends on users, products)
 * 13. Messages (depends on users)
 * 14. Conversations (depends on users)
 * 15. AI Assistant (depends on users)
 */

import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

// Import seed functions
import { addLanguages } from './add-languages'
import { addBrands } from './add-brands'
import { addCategories } from './add-categories'
import { addProducts } from './add-products'
import { addUserTranslationsData } from './add-user-translations-data'
import { addAddressSample } from './add-address-sample'
import { addVoucherSample } from './add-voucher-sample'
import { addCartOrderData } from './add-cart-order-data'
import { addPaymentTransactionsData } from './add-payment-transactions-data'
import { addReviewsData } from './add-reviews-data'
import { addWishlistData } from './add-wishlist-data'
import { addMessagesData } from './add-messages-data'
import { addConversationsData } from './add-conversations-data'
import { addAIAssistantData } from './add-ai-assistant-data'

// Import seed roles & users (runs index.ts to create roles and admin user)
import './index'

interface SeedStep {
  name: string
  description: string
  fn: () => Promise<void>
  required: boolean // true = bắt buộc, false = optional (có thể skip nếu lỗi)
}

const SEED_STEPS: SeedStep[] = [
  {
    name: 'Languages',
    description: 'Add supported languages',
    fn: addLanguages,
    required: true,
  },
  {
    name: 'Roles & Admin User',
    description: 'Create roles and admin user',
    fn: async () => {
      // index.ts runs automatically on import, no need to call a function
      console.log('✅ Roles and Admin User created from index.ts')
    },
    required: true,
  },
  {
    name: 'Brands',
    description: 'Add sample brands',
    fn: addBrands,
    required: true,
  },
  {
    name: 'Categories',
    description: 'Add product categories',
    fn: addCategories,
    required: true,
  },
  {
    name: 'Products',
    description: 'Add products and SKUs',
    fn: addProducts,
    required: true,
  },
  {
    name: 'User Translations',
    description: 'Add user profile translations (vi/en)',
    fn: addUserTranslationsData,
    required: false,
  },
  {
    name: 'Addresses',
    description: 'Add sample addresses for users',
    fn: addAddressSample,
    required: false,
  },
  {
    name: 'Vouchers',
    description: 'Add promotional vouchers',
    fn: addVoucherSample,
    required: false,
  },
  {
    name: 'Cart & Orders',
    description: 'Add cart items and sample orders',
    fn: addCartOrderData,
    required: true,
  },
  {
    name: 'Payment Transactions',
    description: 'Add payment transaction records (bank webhooks)',
    fn: addPaymentTransactionsData,
    required: false,
  },
  {
    name: 'Reviews',
    description: 'Add product reviews and media',
    fn: addReviewsData,
    required: false,
  },
  {
    name: 'Wishlists',
    description: 'Add wishlist items and collections',
    fn: addWishlistData,
    required: false,
  },
  {
    name: 'Messages (Legacy)',
    description: 'Add legacy 1-1 direct messages',
    fn: addMessagesData,
    required: false,
  },
  {
    name: 'Conversations',
    description: 'Add chat conversations (real-time system)',
    fn: addConversationsData,
    required: false,
  },
  {
    name: 'AI Assistant',
    description: 'Add AI conversations and knowledge base',
    fn: addAIAssistantData,
    required: false,
  },
]

const seedAll = async () => {
  console.log('🌱 BẮT ĐẦU SEED TẤT CẢ DỮ LIỆU MẪU\n')
  console.log('=' .repeat(60))
  console.log(`Tổng số bước: ${SEED_STEPS.length}`)
  console.log('=' .repeat(60))
  console.log()

  const startTime = Date.now()
  let successCount = 0
  let failedCount = 0
  let skippedCount = 0

  const results: Array<{
    step: string
    status: 'success' | 'failed' | 'skipped'
    duration: number
    error?: string
  }> = []

  for (let i = 0; i < SEED_STEPS.length; i++) {
    const step = SEED_STEPS[i]
    const stepNumber = i + 1

    console.log(`\n[${ stepNumber}/${SEED_STEPS.length}] ${step.name}`)
    console.log(`📝 ${step.description}`)
    console.log('-'.repeat(60))

    const stepStartTime = Date.now()

    try {
      await step.fn()
      const duration = Date.now() - stepStartTime

      results.push({
        step: step.name,
        status: 'success',
        duration,
      })

      successCount++
      console.log(`✅ Hoàn thành trong ${(duration / 1000).toFixed(2)}s`)
    } catch (error) {
      const duration = Date.now() - stepStartTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (step.required) {
        // Nếu là bước bắt buộc, dừng lại
        results.push({
          step: step.name,
          status: 'failed',
          duration,
          error: errorMessage,
        })

        failedCount++
        console.error(`❌ LỖI (bước bắt buộc): ${errorMessage}`)
        console.error('\n⚠️  Dừng seed do lỗi ở bước bắt buộc!')
        break
      } else {
        // Nếu là bước optional, skip và tiếp tục
        results.push({
          step: step.name,
          status: 'skipped',
          duration,
          error: errorMessage,
        })

        skippedCount++
        console.warn(`⚠️  Bỏ qua (optional): ${errorMessage}`)
      }
    }
  }

  const totalDuration = Date.now() - startTime

  // In báo cáo tổng kết
  console.log('\n\n')
  console.log('=' .repeat(60))
  console.log('🎉 KẾT QUẢ SEED DATA')
  console.log('=' .repeat(60))
  console.log(`✅ Thành công: ${successCount}/${SEED_STEPS.length}`)
  console.log(`❌ Thất bại: ${failedCount}/${SEED_STEPS.length}`)
  console.log(`⚠️  Bỏ qua: ${skippedCount}/${SEED_STEPS.length}`)
  console.log(`⏱️  Tổng thời gian: ${(totalDuration / 1000).toFixed(2)}s`)
  console.log()

  // Chi tiết từng bước
  console.log('📊 CHI TIẾT:')
  console.log('-'.repeat(60))
  results.forEach((result, index) => {
    const icon =
      result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️'
    const duration = (result.duration / 1000).toFixed(2)
    console.log(`${icon} [${index + 1}] ${result.step} (${duration}s)`)
    if (result.error) {
      console.log(`    └─ ${result.error}`)
    }
  })

  console.log()
  console.log('=' .repeat(60))

  if (failedCount > 0) {
    console.log('⚠️  Một số bước seed thất bại. Vui lòng kiểm tra lỗi ở trên.')
    console.log('💡 Bạn có thể chạy lại từng bước riêng lẻ bằng npm scripts.')
  } else if (skippedCount > 0) {
    console.log('✅ Seed hoàn thành với một số bước bị bỏ qua.')
    console.log('💡 Các bước bị bỏ qua là optional và không ảnh hưởng hệ thống.')
  } else {
    console.log('🎊 TẤT CẢ CÁC BƯỚC SEED ĐÃ HOÀN THÀNH THÀNH CÔNG!')
  }

  console.log()
  console.log('📚 Hướng dẫn sử dụng:')
  console.log('  - Chạy lại toàn bộ: npm run seed-all')
  console.log('  - Chạy từng bước: npm run add-languages, npm run add-brands, ...')
  console.log('  - Xóa dữ liệu: Sử dụng Prisma Studio hoặc reset database')
  console.log()
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await seedAll()
  } catch (error) {
    console.error('\n❌ SEED THẤT BẠI:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Chỉ chạy khi file được execute trực tiếp
if (require.main === module) {
  main()
}

