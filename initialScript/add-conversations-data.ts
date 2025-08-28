import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { UserStatus } from 'src/shared/constants/auth.constant'
import { RoleName } from 'src/shared/constants/role.constant'

const prisma = new PrismaService()
const hashingService = new HashingService()

// URL hình ảnh S3 mẫu
const SAMPLE_IMAGE_URLS = [
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/d79f483f-61d7-42dc-83ef-0e5b9037a275.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/a1affb40-aafc-4de1-a808-6efe7a41e85a.png',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/19ac0360-d1cd-496b-9cb9-f2aea4e440df.jpg',
  'https://ecommerce-super-nestjs.s3.ap-southeast-1.amazonaws.com/images/a1bf30cd-647f-4699-9765-8053f2e75a72.jpg',
]

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// Các sample message content
const SAMPLE_MESSAGES = [
  'Xin chào mọi người! 👋',
  'Hôm nay thế nào?',
  'Có ai online không?',
  'Gửi file cho mọi người xem nhé',
  'Meeting lúc 2h chiều nhé',
  'Đã hoàn thành task rồi ✅',
  'Cần hỗ trợ một chút',
  'Cảm ơn mọi người nhiều!',
  'Hẹn gặp lại sau',
  'Chúc mọi người ngày tốt lành! 🌟',
  'Có cập nhật mới về dự án',
  'Deadline là ngày mai nhé',
  'Đã review code xong',
  'Bug này đã fix rồi',
  'Tài liệu ở đây: https://docs.example.com',
  'Ai có thể help review không?',
  'Coffee break lúc 3h? ☕',
  'Presentation slides đã sẵn sàng',
  'Khách hàng feedback tích cực',
  'Release version mới thành công! 🎉',
  'Cần reschedule meeting',
  'Database backup hoàn tất',
  'Server performance tốt',
  'New feature đã deploy',
  'Testing phase bắt đầu',
  'User training vào thứ 2',
  'Documentation cần update',
  'Security audit passed',
  'Team building event sắp tới',
  'Happy Friday everyone! 🎊',
]

const SAMPLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '💯', '😊']

const GROUP_NAMES = [
  'Team Development',
  'Marketing Squad',
  'Design Team',
  'Project Alpha',
  'Sales Force',
  'QA Testing',
  'DevOps Engineers',
  'Product Management',
  'Customer Support',
  'Research & Innovation',
  'Backend Developers',
  'Frontend Masters',
  'Mobile Team',
  'Data Analytics',
  'Security Team',
  'Nhóm Học Tập',
  'Coffee Lovers',
  'Weekend Warriors',
  'Tech Enthusiasts',
  'Game Zone',
]

const GROUP_DESCRIPTIONS = [
  'Nhóm thảo luận công việc hàng ngày',
  'Chia sẻ ý tưởng và brainstorming',
  'Hỗ trợ kỹ thuật và giải đáp thắc mắc',
  'Theo dõi tiến độ dự án',
  'Thảo luận về xu hướng công nghệ mới',
  'Review code và best practices',
  'Planning và estimation',
  'Bug reports và fixes',
  'User feedback và improvements',
  'Team building activities',
]

// Enum types để match với Prisma schema
const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'SYSTEM', 'LOCATION', 'CONTACT'] as const
const ATTACHMENT_TYPES = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] as const

export const addConversationsData = async () => {
  console.log('💬 Bắt đầu thêm dữ liệu mẫu cho Conversations và Messages...\n')

  try {
    // Bước 1: Kiểm tra và tạo dữ liệu cơ bản
    console.log('📝 BƯỚC 1: Kiểm tra và tạo dữ liệu cơ bản...')

    // Kiểm tra role Client
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
    }

    // Bước 2: Tạo users để test chat
    console.log('\n👥 BƯỚC 2: Tạo users mẫu để test chat...')

    const chatUsers: any[] = []
    const userNames = [
      'Nguyễn Văn A',
      'Trần Thị B',
      'Lê Văn C',
      'Phạm Thị D',
      'Hoàng Văn E',
      'Vũ Thị F',
      'Đỗ Văn G',
      'Ngô Thị H',
      'Bùi Văn I',
      'Dương Thị K',
      'Lý Văn L',
      'Võ Thị M',
      'Phan Văn N',
      'Mai Thị O',
      'Chu Văn P',
    ]

    for (let i = 0; i < userNames.length; i++) {
      const hashedPassword = await hashingService.hash('User@123')
      let user = await prisma.user.findFirst({
        where: { email: `chatuser${i + 1}@example.com` },
      })

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `chatuser${i + 1}@example.com`,
            name: userNames[i],
            password: hashedPassword,
            phoneNumber: `090000${(i + 1).toString().padStart(2, '0')}`,
            avatar: pickRandom(SAMPLE_IMAGE_URLS),
            status: UserStatus.ACTIVE,
            roleId: clientRole.id,
          },
        })
      }
      chatUsers.push(user)
    }

    console.log(`✅ Đã tạo ${chatUsers.length} users cho chat`)

    // Bước 3: Tạo Direct Conversations (Chat 1-1)
    console.log('\n💬 BƯỚC 3: Tạo Direct Conversations...')

    const directConversations: any[] = []

    // Tạo 20 direct conversations ngẫu nhiên
    for (let i = 0; i < 20; i++) {
      const user1 = pickRandom(chatUsers)
      let user2 = pickRandom(chatUsers)

      // Đảm bảo không tạo conversation với chính mình
      while (user2.id === user1.id) {
        user2 = pickRandom(chatUsers)
      }

      // Kiểm tra xem đã có conversation giữa 2 user này chưa
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          members: {
            every: {
              userId: { in: [user1.id, user2.id] },
            },
          },
        },
      })

      if (!existingConversation) {
        const conversation = await prisma.conversation.create({
          data: {
            type: 'DIRECT',
            members: {
              create: [
                {
                  userId: user1.id,
                  role: 'MEMBER',
                  isActive: true,
                },
                {
                  userId: user2.id,
                  role: 'MEMBER',
                  isActive: true,
                },
              ],
            },
          },
        })
        directConversations.push(conversation)
      }
    }

    console.log(`✅ Đã tạo ${directConversations.length} direct conversations`)

    // Bước 4: Tạo Group Conversations
    console.log('\n👥 BƯỚC 4: Tạo Group Conversations...')

    const groupConversations: any[] = []

    for (let i = 0; i < GROUP_NAMES.length; i++) {
      const owner = pickRandom(chatUsers)
      const groupName = GROUP_NAMES[i]
      const description = pickRandom(GROUP_DESCRIPTIONS)

      // Chọn ngẫu nhiên 3-8 members cho group
      const memberCount = Math.floor(Math.random() * 6) + 3 // 3-8 members
      const selectedMembers = [owner] // Owner luôn là member

      // Thêm members ngẫu nhiên (không trùng với owner)
      while (selectedMembers.length < memberCount) {
        const randomUser = pickRandom(chatUsers)
        if (!selectedMembers.find((m) => m.id === randomUser.id)) {
          selectedMembers.push(randomUser)
        }
      }

      const conversation = await prisma.conversation.create({
        data: {
          type: 'GROUP',
          name: groupName,
          description: description,
          ownerId: owner.id,
          avatar: pickRandom(SAMPLE_IMAGE_URLS),
          members: {
            create: selectedMembers.map((member, index) => ({
              userId: member.id,
              role: index === 0 ? 'ADMIN' : Math.random() > 0.8 ? 'MODERATOR' : 'MEMBER',
              isActive: true,
            })),
          },
        },
      })

      groupConversations.push(conversation)
    }

    console.log(`✅ Đã tạo ${groupConversations.length} group conversations`)

    // Bước 5: Tạo Messages cho các conversations
    console.log('\n📨 BƯỚC 5: Tạo Messages mẫu...')

    const allConversations = [...directConversations, ...groupConversations]
    let totalMessages = 0

    for (const conversation of allConversations) {
      // Lấy danh sách members của conversation
      const members = await prisma.conversationMember.findMany({
        where: {
          conversationId: conversation.id,
          isActive: true,
        },
        include: { user: true },
      })

      // Tạo 10-50 messages cho mỗi conversation
      const messageCount = Math.floor(Math.random() * 41) + 10 // 10-50 messages

      for (let i = 0; i < messageCount; i++) {
        const sender = pickRandom(members) as any
        const content = pickRandom(SAMPLE_MESSAGES)

        // Random message type
        const messageTypes = ['TEXT', 'TEXT', 'TEXT', 'TEXT', 'IMAGE', 'FILE'] // TEXT nhiều hơn
        const messageType = pickRandom(messageTypes) as any

        // Tạo attachments cho message không phải TEXT
        const attachments =
          messageType !== 'TEXT'
            ? [
                {
                  type: messageType === 'IMAGE' ? 'IMAGE' : 'DOCUMENT',
                  fileName: messageType === 'IMAGE' ? `image-${i}.jpg` : `document-${i}.pdf`,
                  fileUrl: messageType === 'IMAGE' ? pickRandom(SAMPLE_IMAGE_URLS) : 'https://example.com/document.pdf',
                  fileSize: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
                  mimeType: messageType === 'IMAGE' ? 'image/jpeg' : 'application/pdf',
                  width: messageType === 'IMAGE' ? 1920 : undefined,
                  height: messageType === 'IMAGE' ? 1080 : undefined,
                },
              ]
            : []

        // Tạo message với timestamp trong quá khứ
        const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Trong vòng 7 ngày qua

        const message = await prisma.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            fromUserId: sender.userId,
            content: messageType === 'TEXT' ? content : attachments.length > 0 ? 'Gửi file đính kèm' : content,
            type: messageType,
            createdAt: createdAt,
            attachments: {
              create: attachments as any,
            },
          },
        })

        // Random tạo reactions cho một số messages
        if (Math.random() > 0.7) {
          // 30% messages có reactions
          const reactorCount = Math.floor(Math.random() * Math.min(members.length, 5)) + 1
          const reactors = members.sort(() => 0.5 - Math.random()).slice(0, reactorCount)

          for (const reactor of reactors) {
            if ((reactor as any).userId !== sender.userId) {
              // Không react message của chính mình
              await prisma.messageReaction.create({
                data: {
                  messageId: message.id,
                  userId: (reactor as any).userId,
                  emoji: pickRandom(SAMPLE_REACTIONS),
                },
              })
            }
          }
        }

        // Random tạo read receipts
        for (const member of members) {
          if ((member as any).userId !== sender.userId && Math.random() > 0.3) {
            // 70% chance đã đọc
            await prisma.messageReadReceipt.create({
              data: {
                messageId: message.id,
                userId: (member as any).userId,
                readAt: new Date(createdAt.getTime() + Math.random() * 60 * 60 * 1000), // Đọc trong vòng 1h sau khi gửi
              },
            })
          }
        }

        totalMessages++
      }

      // Cập nhật lastMessage và lastMessageAt cho conversation
      const lastMessage = await prisma.conversationMessage.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
      })

      if (lastMessage) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessage: lastMessage.content?.substring(0, 100) || 'File đính kèm',
            lastMessageAt: lastMessage.createdAt,
          },
        })
      }

      // Cập nhật unread count cho members
      for (const member of members) {
        const unreadCount = await prisma.conversationMessage.count({
          where: {
            conversationId: conversation.id,
            fromUserId: { not: member.userId },
            readReceipts: {
              none: { userId: member.userId },
            },
          },
        })

        await prisma.conversationMember.update({
          where: { id: member.id },
          data: { unreadCount },
        })
      }
    }

    console.log(`✅ Đã tạo ${totalMessages} messages`)

    // Bước 6: Tạo một số Typing Indicators mẫu
    console.log('\n⌨️  BƯỚC 6: Tạo Typing Indicators mẫu...')

    let typingCount = 0
    // Tạo typing indicators cho 5 conversations ngẫu nhiên
    const randomConversations = allConversations.sort(() => 0.5 - Math.random()).slice(0, 5)

    for (const conversation of randomConversations) {
      const members = await prisma.conversationMember.findMany({
        where: {
          conversationId: conversation.id,
          isActive: true,
        },
      })

      const typingUser = pickRandom(members) as any
      await prisma.typingIndicator.create({
        data: {
          conversationId: conversation.id,
          userId: typingUser.userId,
          expiresAt: new Date(Date.now() + 10000), // Hết hạn sau 10 giây
        },
      })
      typingCount++
    }

    console.log(`✅ Đã tạo ${typingCount} typing indicators`)

    // Hiển thị tóm tắt kết quả
    console.log('\n📊 TÓM TẮT KẾT QUẢ:')

    const finalStats = {
      users: chatUsers.length,
      directConversations: directConversations.length,
      groupConversations: groupConversations.length,
      totalConversations: allConversations.length,
      totalMessages: totalMessages,
      messageReactions: await prisma.messageReaction.count(),
      readReceipts: await prisma.messageReadReceipt.count(),
      typingIndicators: await prisma.typingIndicator.count(),
      messageAttachments: await prisma.messageAttachment.count(),
    }

    console.log(`✅ Tổng số users chat: ${finalStats.users}`)
    console.log(`✅ Direct conversations: ${finalStats.directConversations}`)
    console.log(`✅ Group conversations: ${finalStats.groupConversations}`)
    console.log(`✅ Tổng conversations: ${finalStats.totalConversations}`)
    console.log(`✅ Tổng messages: ${finalStats.totalMessages}`)
    console.log(`✅ Message reactions: ${finalStats.messageReactions}`)
    console.log(`✅ Read receipts: ${finalStats.readReceipts}`)
    console.log(`✅ Typing indicators: ${finalStats.typingIndicators}`)
    console.log(`✅ Message attachments: ${finalStats.messageAttachments}`)

    console.log('\n🎉 HOÀN THÀNH! Đã thêm tất cả dữ liệu mẫu cho Conversation System thành công!')
    console.log('\n📱 Bây giờ bạn có thể test các API conversation với dữ liệu phong phú!')
    console.log('💡 Gợi ý: Hãy login với các user chatuser1@example.com đến chatuser15@example.com để test')

    return finalStats
  } catch (error) {
    console.error('❌ Lỗi khi thêm dữ liệu Conversation:', error)
    throw error
  }
}

// Chạy script và xử lý kết quả
const main = async () => {
  try {
    await addConversationsData()
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

// Export function để sử dụng trong index.ts
