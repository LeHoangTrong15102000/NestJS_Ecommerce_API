import { PrismaService } from 'src/shared/services/prisma.service'

const prisma = new PrismaService()

// Sample ecommerce chat messages in Vietnamese
const ECOMMERCE_MESSAGES = {
  customerQuestions: [
    'Chào shop, sản phẩm này còn hàng không ạ?',
    'Cho mình hỏi ship về Hà Nội mất bao lâu?',
    'Sản phẩm này có bảo hành không shop?',
    'Mình muốn đổi size được không?',
    'Shop ơi, giá này có giảm thêm được không ạ?',
    'Sản phẩm này có màu khác không shop?',
    'Cho mình hỏi size M với size L khác nhau như nào ạ?',
    'Shop có ship COD không ạ?',
    'Mình đặt hàng rồi, khi nào shop gửi ạ?',
    'Sản phẩm này chất liệu gì vậy shop?',
    'Có thể gửi thêm hình thật được không shop?',
    'Mình mua 2 cái có được freeship không?',
    'Shop ơi, đơn hàng của mình đến đâu rồi ạ?',
    'Sản phẩm này có hộp đựng không shop?',
    'Cho mình hỏi cách sử dụng sản phẩm này với ạ',
  ],
  sellerResponses: [
    'Dạ còn hàng bạn nhé, bạn muốn đặt size nào?',
    'Khoảng 3-5 ngày bạn nhé',
    'Dạ có bảo hành 12 tháng chính hãng ạ',
    'Được bạn nhé, bạn gửi lại trong 7 ngày',
    'Dạ giá này đã là giá tốt nhất rồi ạ, bạn mua 2 shop giảm thêm 5% nhé',
    'Dạ có nhiều màu lắm bạn ơi, bạn xem trong album shop nhé',
    'Size M: 50-55kg, Size L: 55-65kg bạn nhé',
    'Dạ shop có ship COD toàn quốc ạ',
    'Dạ shop gửi trong hôm nay luôn bạn nhé',
    'Chất liệu cotton 100% bạn nhé, mát và thấm hút mồ hôi tốt',
    'Dạ bạn chờ shop gửi thêm hình nhé',
    'Dạ mua 2 cái shop freeship luôn cho bạn nhé',
    'Dạ đơn đang trên đường giao rồi bạn ơi, khoảng 1-2 ngày nữa nhé',
    'Dạ có hộp đựng đẹp lắm bạn, phù hợp làm quà tặng',
    'Dạ bạn xem hướng dẫn trong hộp nhé, có gì thắc mắc inbox shop ạ',
  ],
  thankYouMessages: [
    'Cảm ơn shop nhiều!',
    'Ok shop, mình đặt nhé',
    'Dạ không có gì ạ, cảm ơn bạn đã ủng hộ shop!',
    'Shop tư vấn nhiệt tình quá, cảm ơn shop!',
    'Mình sẽ ủng hộ shop dài dài nhé!',
    'Hàng đẹp lắm shop ơi, lần sau mình mua tiếp!',
    'Cảm ơn bạn đã tin tưởng shop ạ!',
    'Chúc bạn mua sắm vui vẻ!',
  ],
}

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Generate random date within last 30 days
const getRandomDateInLast30Days = (): Date => {
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo))
}

// Generate a conversation between two users
const generateConversation = (
  user1Id: number,
  user2Id: number,
  messageCount: number,
): Array<{ fromUserId: number; toUserId: number; content: string; readAt: Date | null; createdAt: Date }> => {
  const messages: Array<{
    fromUserId: number
    toUserId: number
    content: string
    readAt: Date | null
    createdAt: Date
  }> = []

  let baseTime = getRandomDateInLast30Days()

  for (let i = 0; i < messageCount; i++) {
    const isUser1Sender = i % 2 === 0
    const fromUserId = isUser1Sender ? user1Id : user2Id
    const toUserId = isUser1Sender ? user2Id : user1Id

    let content: string
    if (i === 0) {
      content = pickRandom(ECOMMERCE_MESSAGES.customerQuestions)
    } else if (i === messageCount - 1) {
      content = pickRandom(ECOMMERCE_MESSAGES.thankYouMessages)
    } else if (isUser1Sender) {
      content = pickRandom(ECOMMERCE_MESSAGES.customerQuestions)
    } else {
      content = pickRandom(ECOMMERCE_MESSAGES.sellerResponses)
    }

    // Add random time gap between messages (1 minute to 2 hours)
    baseTime = new Date(baseTime.getTime() + (1 + Math.random() * 119) * 60 * 1000)

    // 70% of messages are read, 30% are unread (more recent ones tend to be unread)
    const isRead = Math.random() < 0.7 || i < messageCount - 2
    const readAt = isRead ? new Date(baseTime.getTime() + Math.random() * 30 * 60 * 1000) : null

    messages.push({
      fromUserId,
      toUserId,
      content,
      readAt,
      createdAt: baseTime,
    })
  }

  return messages
}

export const addMessagesData = async () => {
  console.log('💬 Starting to add sample data for legacy Message table (1-1 direct messages)...\n')

  try {
    // Check if Message data already exists
    const existingMessageCount = await prisma.message.count()
    if (existingMessageCount > 0) {
      console.log(`⏭️  Already have ${existingMessageCount} messages in database. Skipping seed.`)
      return
    }

    // Fetch existing users (not deleted)
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      take: 20,
    })

    if (users.length < 2) {
      console.log('⚠️  Need at least 2 users to create messages. Please run user seed scripts first.')
      return
    }

    console.log(`👥 Found ${users.length} users for creating messages`)

    // Generate message data for different user pairs
    const allMessages: Array<{
      fromUserId: number
      toUserId: number
      content: string
      readAt: Date | null
      createdAt: Date
    }> = []

    // Create conversations between different user pairs
    const conversationPairs: Array<[number, number]> = []
    const pairCount = Math.min(Math.floor(users.length / 2) + 3, 10)

    for (let i = 0; i < pairCount; i++) {
      const user1 = users[i % users.length]
      const user2 = users[(i + 1) % users.length]
      if (user1.id !== user2.id) {
        conversationPairs.push([user1.id, user2.id])
      }
    }

    console.log(`📝 Creating ${conversationPairs.length} conversation pairs...`)

    // Generate 5-12 messages per conversation
    for (const [user1Id, user2Id] of conversationPairs) {
      const messageCount = 5 + Math.floor(Math.random() * 8)
      const conversationMessages = generateConversation(user1Id, user2Id, messageCount)
      allMessages.push(...conversationMessages)
    }

    // Batch create all messages
    console.log(`📨 Creating ${allMessages.length} messages in batch...`)

    await prisma.message.createMany({
      data: allMessages.map((msg) => ({
        fromUserId: msg.fromUserId,
        toUserId: msg.toUserId,
        content: msg.content,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
    })

    // Summary
    const finalCount = await prisma.message.count()
    const unreadCount = await prisma.message.count({ where: { readAt: null } })

    console.log('\n📊 SUMMARY:')
    console.log(`✅ Total messages created: ${finalCount}`)
    console.log(`✅ Conversation pairs: ${conversationPairs.length}`)
    console.log(`✅ Read messages: ${finalCount - unreadCount}`)
    console.log(`✅ Unread messages: ${unreadCount}`)
    console.log('\n🎉 Successfully added sample data for legacy Message table!')
  } catch (error) {
    console.error('❌ Error adding messages data:', error)
    throw error
  }
}

const main = async () => {
  try {
    await addMessagesData()
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

