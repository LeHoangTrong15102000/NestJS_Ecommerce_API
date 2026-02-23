import { PrismaService } from 'src/shared/services/prisma.service'
import { AIMessageRole, AIKnowledgeType } from '@prisma/client'
import { RoleName } from 'src/shared/constants/role.constant'

const prisma = new PrismaService()

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Dữ liệu mẫu cho AI conversations
const CONVERSATION_SAMPLES = [
  {
    userMessages: [
      'Cho tôi xem các sản phẩm điện thoại iPhone mới nhất',
      'Tôi muốn tìm laptop cho sinh viên, giá khoảng 15 triệu',
      'Sản phẩm này có bảo hành bao lâu?',
    ],
    assistantResponses: [
      'Chúng tôi có các dòng iPhone mới nhất như iPhone 15 Pro Max, iPhone 15 Pro, và iPhone 15. Bạn quan tâm đến dòng nào?',
      'Với ngân sách 15 triệu, tôi gợi ý cho bạn MacBook Air M1 hoặc các dòng laptop Dell Inspiron. Bạn ưu tiên hiệu năng hay tính di động?',
      'Sản phẩm của chúng tôi đều có bảo hành chính hãng 12 tháng. Một số sản phẩm cao cấp có bảo hành lên đến 24 tháng.',
    ],
  },
  {
    userMessages: [
      'Làm sao để theo dõi đơn hàng của tôi?',
      'Tôi muốn đổi trả sản phẩm',
      'Chính sách giao hàng của shop như thế nào?',
    ],
    assistantResponses: [
      'Bạn có thể theo dõi đơn hàng bằng cách vào mục "Đơn hàng của tôi" trong tài khoản. Mã đơn hàng của bạn là gì để tôi kiểm tra giúp?',
      'Chúng tôi hỗ trợ đổi trả trong vòng 7 ngày kể từ khi nhận hàng. Sản phẩm cần còn nguyên tem, hộp và chưa qua sử dụng. Bạn cần đổi trả sản phẩm nào?',
      'Chúng tôi giao hàng toàn quốc trong 2-5 ngày. Miễn phí ship cho đơn hàng trên 500k. Bạn ở khu vực nào để tôi tư vấn cụ thể hơn?',
    ],
  },
  {
    userMessages: [
      'Có khuyến mãi gì không?',
      'Tôi có thể thanh toán bằng cách nào?',
      'Sản phẩm này còn hàng không?',
    ],
    assistantResponses: [
      'Hiện tại chúng tôi đang có chương trình giảm giá 20% cho các sản phẩm điện tử và voucher freeship cho đơn hàng đầu tiên. Bạn quan tâm sản phẩm nào?',
      'Chúng tôi hỗ trợ thanh toán qua thẻ tín dụng, chuyển khoản ngân hàng, ví điện tử (Momo, ZaloPay) và COD. Bạn muốn thanh toán bằng hình thức nào?',
      'Để kiểm tra tình trạng còn hàng, bạn vui lòng cho tôi biết tên hoặc mã sản phẩm. Tôi sẽ kiểm tra ngay cho bạn.',
    ],
  },
]

// Dữ liệu mẫu cho AI Knowledge Base
const KNOWLEDGE_BASE_DATA = [
  // FAQs
  {
    type: AIKnowledgeType.FAQ,
    title: 'Làm thế nào để đặt hàng?',
    content:
      'Để đặt hàng, bạn chỉ cần: 1) Chọn sản phẩm và thêm vào giỏ hàng, 2) Điền thông tin giao hàng, 3) Chọn phương thức thanh toán, 4) Xác nhận đơn hàng. Chúng tôi sẽ gửi email xác nhận ngay sau khi đơn hàng được tạo thành công.',
    keywords: ['đặt hàng', 'mua hàng', 'order', 'checkout', 'thanh toán'],
    priority: 10,
  },
  {
    type: AIKnowledgeType.FAQ,
    title: 'Thời gian giao hàng là bao lâu?',
    content:
      'Thời gian giao hàng phụ thuộc vào khu vực: Nội thành Hà Nội/HCM: 1-2 ngày, Các tỉnh thành khác: 2-5 ngày, Vùng xa: 5-7 ngày. Chúng tôi sẽ thông báo cụ thể khi xác nhận đơn hàng.',
    keywords: ['giao hàng', 'ship', 'delivery', 'thời gian', 'bao lâu'],
    priority: 9,
  },
  {
    type: AIKnowledgeType.FAQ,
    title: 'Phí vận chuyển là bao nhiêu?',
    content:
      'Phí vận chuyển: Miễn phí cho đơn hàng từ 500.000đ trở lên, Dưới 500.000đ: 30.000đ (nội thành), 50.000đ (ngoại thành). Phí có thể thay đổi tùy khu vực và khối lượng đơn hàng.',
    keywords: ['phí ship', 'phí vận chuyển', 'shipping fee', 'miễn phí'],
    priority: 8,
  },
  // Policies
  {
    type: AIKnowledgeType.POLICY,
    title: 'Chính sách đổi trả',
    content:
      'Chúng tôi chấp nhận đổi trả trong vòng 7 ngày kể từ ngày nhận hàng với điều kiện: Sản phẩm còn nguyên tem, hộp, chưa qua sử dụng, có đầy đủ phụ kiện kèm theo. Khách hàng chịu phí ship đổi trả (trừ trường hợp lỗi từ nhà sản xuất).',
    keywords: ['đổi trả', 'hoàn tiền', 'return', 'refund', 'bảo hành'],
    priority: 10,
  },
  {
    type: AIKnowledgeType.POLICY,
    title: 'Chính sách bảo mật thông tin',
    content:
      'Chúng tôi cam kết bảo mật tuyệt đối thông tin cá nhân của khách hàng. Thông tin chỉ được sử dụng cho mục đích xử lý đơn hàng và không chia sẻ cho bên thứ ba. Dữ liệu được mã hóa và lưu trữ an toàn.',
    keywords: ['bảo mật', 'privacy', 'thông tin cá nhân', 'security'],
    priority: 7,
  },
  // Guides
  {
    type: AIKnowledgeType.GUIDE,
    title: 'Hướng dẫn thanh toán online',
    content:
      'Để thanh toán online: 1) Chọn phương thức thanh toán (thẻ/ví điện tử), 2) Nhập thông tin thanh toán, 3) Xác nhận OTP, 4) Hoàn tất. Giao dịch được mã hóa SSL 256-bit đảm bảo an toàn tuyệt đối.',
    keywords: ['thanh toán', 'payment', 'online', 'thẻ', 'ví điện tử'],
    priority: 8,
  },
  {
    type: AIKnowledgeType.GUIDE,
    title: 'Cách theo dõi đơn hàng',
    content:
      'Bạn có thể theo dõi đơn hàng qua: 1) Đăng nhập tài khoản > Đơn hàng của tôi, 2) Kiểm tra email xác nhận đơn hàng, 3) Liên hệ hotline với mã đơn hàng. Trạng thái đơn hàng được cập nhật realtime.',
    keywords: ['theo dõi', 'tracking', 'đơn hàng', 'order status'],
    priority: 7,
  },
  // Promotions
  {
    type: AIKnowledgeType.PROMOTION,
    title: 'Chương trình khuyến mãi tháng này',
    content:
      'Ưu đãi đặc biệt: Giảm 20% toàn bộ sản phẩm điện tử, Freeship cho đơn hàng đầu tiên, Voucher 100k cho đơn từ 1 triệu, Tặng quà cho đơn hàng trên 5 triệu. Áp dụng đến hết tháng.',
    keywords: ['khuyến mãi', 'giảm giá', 'promotion', 'sale', 'voucher'],
    priority: 9,
  },
]

export const addAIAssistantData = async () => {
  console.log('🤖 Bắt đầu thêm dữ liệu mẫu cho AI Assistant...\n')

  try {
    // Kiểm tra xem đã có AI conversations chưa
    const existingConversationCount = await prisma.aIConversation.count()
    if (existingConversationCount > 0) {
      console.log(
        `Đã có ${existingConversationCount} AI conversations trong database. Bỏ qua việc thêm dữ liệu mẫu.`,
      )
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
      take: 15, // Lấy tối đa 15 users
    })

    if (users.length === 0) {
      console.log('⚠️  Không có user nào. Vui lòng chạy script add-cart-order-data.ts trước.')
      return
    }

    console.log(`👥 Tìm thấy ${users.length} users`)

    let createdConversationsCount = 0
    let createdMessagesCount = 0

    // Tạo AI conversations cho một số users (60% users có conversations)
    console.log('\n💬 Tạo AI conversations...')

    const usersWithConversations = users.filter(() => Math.random() < 0.6)

    for (const user of usersWithConversations) {
      // Mỗi user có 1-3 conversations
      const conversationCount = randomInt(1, 3)

      for (let i = 0; i < conversationCount; i++) {
        const conversationSample = pickRandom(CONVERSATION_SAMPLES)

        // Tạo conversation
        const conversation = await prisma.aIConversation.create({
          data: {
            userId: user.id,
            title: `Conversation ${i + 1}`,
            context: {
              userPreferences: {
                language: 'vi',
                interests: ['electronics', 'fashion'],
              },
            },
            isActive: Math.random() < 0.8, // 80% active
            isArchived: Math.random() < 0.1, // 10% archived
          },
        })
        createdConversationsCount++

        // Tạo messages cho conversation (2-6 messages)
        const messageCount = Math.min(
          randomInt(2, 6),
          conversationSample.userMessages.length * 2,
        )

        for (let j = 0; j < messageCount; j += 2) {
          const messageIndex = Math.floor(j / 2)
          if (messageIndex >= conversationSample.userMessages.length) break

          // User message
          await prisma.aIMessage.create({
            data: {
              conversationId: conversation.id,
              role: AIMessageRole.USER,
              content: conversationSample.userMessages[messageIndex],
              createdAt: new Date(Date.now() - (messageCount - j) * 60 * 60 * 1000), // Stagger messages
            },
          })
          createdMessagesCount++

          // Assistant response
          await prisma.aIMessage.create({
            data: {
              conversationId: conversation.id,
              role: AIMessageRole.ASSISTANT,
              content: conversationSample.assistantResponses[messageIndex],
              tokenCount: randomInt(50, 200),
              responseTime: randomInt(500, 2000),
              model: 'claude-3-haiku-20240307',
              contextUsed: conversation.context,
              createdAt: new Date(Date.now() - (messageCount - j - 1) * 60 * 60 * 1000),
            },
          })
          createdMessagesCount++
        }

        // Update conversation title based on first message
        if (conversationSample.userMessages.length > 0) {
          await prisma.aIConversation.update({
            where: { id: conversation.id },
            data: {
              title: conversationSample.userMessages[0].substring(0, 50) + '...',
            },
          })
        }
      }
    }

    console.log(`✅ Đã tạo ${createdConversationsCount} AI conversations`)
    console.log(`✅ Đã tạo ${createdMessagesCount} AI messages`)

    // Tạo AI Knowledge Base
    console.log('\n📚 Tạo AI Knowledge Base...')

    let createdKnowledgeCount = 0

    // Lấy admin user để làm creator
    const adminRole = await prisma.role.findFirst({
      where: { name: RoleName.Admin },
    })
    const adminUser = adminRole
      ? await prisma.user.findFirst({
          where: { roleId: adminRole.id },
        })
      : null

    for (const knowledgeData of KNOWLEDGE_BASE_DATA) {
      await prisma.aIKnowledge.create({
        data: {
          type: knowledgeData.type,
          title: knowledgeData.title,
          content: knowledgeData.content,
          keywords: knowledgeData.keywords,
          isActive: true,
          priority: knowledgeData.priority,
          createdById: adminUser?.id || null,
        },
      })
      createdKnowledgeCount++
    }

    console.log(`✅ Đã tạo ${createdKnowledgeCount} knowledge base entries`)

    console.log('\n🎉 HOÀN THÀNH!')
    console.log(`📊 Tổng kết:`)
    console.log(`  - ${createdConversationsCount} AI conversations`)
    console.log(`  - ${createdMessagesCount} AI messages`)
    console.log(`  - ${createdKnowledgeCount} knowledge base entries`)
    console.log(
      `  - Trung bình ${(createdMessagesCount / createdConversationsCount).toFixed(1)} messages/conversation`,
    )
  } catch (error) {
    console.error('❌ Lỗi khi thêm AI assistant data:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addAIAssistantData()
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

