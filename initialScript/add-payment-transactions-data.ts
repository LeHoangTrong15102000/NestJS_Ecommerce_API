import { PrismaService } from 'src/shared/services/prisma.service'
import { PREFIX_PAYMENT_CODE } from 'src/shared/constants/other.constant'
import { PaymentStatus } from 'src/shared/constants/payment.constant'

const prisma = new PrismaService()

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// Gateway providers for payment transactions
const GATEWAYS = ['Casso', 'SePay', 'VNPay', 'MoMo']

// Vietnamese bank account numbers (realistic format)
const BANK_ACCOUNTS = [
  { accountNumber: '0123456789', subAccount: 'VCB-0123456789', bank: 'Vietcombank' },
  { accountNumber: '9876543210', subAccount: 'TCB-9876543210', bank: 'Techcombank' },
  { accountNumber: '1234567890', subAccount: 'ACB-1234567890', bank: 'ACB' },
  { accountNumber: '0987654321', subAccount: 'VTB-0987654321', bank: 'Vietinbank' },
  { accountNumber: '1122334455', subAccount: 'MBB-1122334455', bank: 'MB Bank' },
  { accountNumber: '5566778899', subAccount: 'BID-5566778899', bank: 'BIDV' },
]

// Transaction content templates
const TRANSACTION_CONTENTS = [
  (code: string) => `${code} Thanh toan don hang`,
  (code: string) => `${code} TT don hang online`,
  (code: string) => `Chuyen khoan ${code}`,
  (code: string) => `${code} Payment for order`,
  (code: string) => `TT ${code} qua app`,
]

// Generate realistic bank reference number
const generateReferenceNumber = (gateway: string): string => {
  const prefix = gateway === 'VNPay' ? 'VNP' : gateway === 'MoMo' ? 'MOMO' : 'FT'
  const year = new Date().getFullYear().toString().slice(-2)
  const randomPart = randomInt(100000000, 999999999)
  return `${prefix}${year}${randomPart}`
}

// Generate random date within the last 30 days
const generateRandomDate = (): Date => {
  const now = new Date()
  const daysAgo = randomInt(0, 30)
  const hoursAgo = randomInt(0, 23)
  const minutesAgo = randomInt(0, 59)
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000)
}

export const addPaymentTransactionsData = async () => {
  console.log('💳 Starting to add sample data for PaymentTransaction...\n')

  try {
    // Check if PaymentTransaction data already exists
    const existingCount = await prisma.paymentTransaction.count()
    if (existingCount > 0) {
      console.log(`✅ Already have ${existingCount} payment transactions in database. Skipping seed.`)
      return
    }

    // Fetch existing orders with their payments
    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        payment: true,
        items: {
          select: {
            skuPrice: true,
            quantity: true,
          },
        },
      },
      take: 30,
    })

    if (orders.length === 0) {
      console.log('⚠️  No orders found. Please run add-cart-order-data.ts script first.')
      return
    }

    console.log(`📦 Found ${orders.length} orders to create payment transactions`)

    const paymentTransactionsData: Array<{
      gateway: string
      transactionDate: Date
      accountNumber: string
      subAccount: string
      amountIn: number
      amountOut: number
      accumulated: number
      code: string
      transactionContent: string
      referenceNumber: string
      body: string
    }> = []

    let accumulatedBalance = randomInt(10000000, 50000000) // Starting balance

    for (const order of orders) {
      // Calculate order total from items
      const orderTotal = order.items.reduce((sum, item) => sum + item.skuPrice * item.quantity, 0)

      // Only create transaction for orders with successful payments or pending payments
      if (order.payment.status === PaymentStatus.FAILED) {
        continue
      }

      const gateway = pickRandom(GATEWAYS)
      const bankAccount = pickRandom(BANK_ACCOUNTS)
      const transactionDate = generateRandomDate()
      const code = `${PREFIX_PAYMENT_CODE}${order.id}`
      const contentTemplate = pickRandom(TRANSACTION_CONTENTS)
      const referenceNumber = generateReferenceNumber(gateway)

      // For successful payments, amountIn equals order total
      const amountIn = order.payment.status === PaymentStatus.SUCCESS ? orderTotal : 0
      accumulatedBalance += amountIn

      const transactionBody = JSON.stringify({
        id: randomInt(100000, 999999),
        gateway,
        transactionDate: transactionDate.toISOString(),
        accountNumber: bankAccount.accountNumber,
        subAccount: bankAccount.subAccount,
        transferType: 'in',
        transferAmount: amountIn,
        accumulated: accumulatedBalance,
        code,
        content: contentTemplate(code),
        referenceCode: referenceNumber,
        description: `Payment for order ${order.id}`,
      })

      paymentTransactionsData.push({
        gateway,
        transactionDate,
        accountNumber: bankAccount.accountNumber,
        subAccount: bankAccount.subAccount,
        amountIn,
        amountOut: 0,
        accumulated: accumulatedBalance,
        code,
        transactionContent: contentTemplate(code),
        referenceNumber,
        body: transactionBody,
      })
    }

    // Create payment transactions using createMany
    console.log(`\n💳 Creating ${paymentTransactionsData.length} payment transactions...`)

    const result = await prisma.paymentTransaction.createMany({
      data: paymentTransactionsData,
      skipDuplicates: true,
    })

    console.log(`✅ Successfully created ${result.count} payment transactions`)

    // Display summary
    console.log('\n📊 SUMMARY:')
    const gatewayStats = paymentTransactionsData.reduce(
      (acc, tx) => {
        acc[tx.gateway] = (acc[tx.gateway] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    Object.entries(gatewayStats).forEach(([gateway, count]) => {
      console.log(`  - ${gateway}: ${count} transactions`)
    })

    const totalAmountIn = paymentTransactionsData.reduce((sum, tx) => sum + tx.amountIn, 0)
    console.log(`\n💰 Total amount received: ${totalAmountIn.toLocaleString('vi-VN')} VND`)

    console.log('\n🎉 COMPLETED! Successfully added payment transaction sample data!')
  } catch (error) {
    console.error('❌ Error adding payment transactions:', error)
    throw error
  }
}

const main = async () => {
  try {
    await addPaymentTransactionsData()
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

