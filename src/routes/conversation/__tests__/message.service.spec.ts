import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { SharedUserRepository } from '../../../shared/repositories/shared-user.repo'
import { ConversationRepository } from '../conversation.repo'
import { MessageRepository } from '../message.repo'
import { MessageService } from '../message.service'

// Test data factory để tạo dữ liệu test
const createTestData = {
  user: (overrides = {}) => ({
    id: 1,
    name: 'Nguyễn Văn A',
    email: 'test@example.com',
    avatar: 'avatar.jpg',
    status: 'ACTIVE' as const,
    ...overrides,
  }),

  message: (overrides = {}) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    fromUserId: 1,
    content: 'Xin chào',
    type: 'TEXT' as const,
    replyToId: null,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    deletedForEveryone: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    fromUser: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    replyTo: null,
    attachments: [],
    reactions: [],
    readReceipts: [],
    conversation: undefined,
    ...overrides,
  }),

  messageWithAttachments: (overrides = {}) => ({
    id: 'msg-2',
    conversationId: 'conv-1',
    fromUserId: 1,
    content: null,
    type: 'IMAGE' as const,
    replyToId: null,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    deletedForEveryone: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    fromUser: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    replyTo: null,
    attachments: [
      {
        id: 'att-1',
        type: 'IMAGE' as const,
        fileName: 'image.jpg',
        fileUrl: 'https://example.com/image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        thumbnail: 'https://example.com/thumb.jpg',
        width: 800,
        height: 600,
        duration: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ],
    reactions: [],
    readReceipts: [],
    conversation: undefined,
    ...overrides,
  }),

  reaction: (overrides = {}) => ({
    id: 'reaction-1',
    messageId: 'msg-1',
    userId: 1,
    emoji: '👍',
    createdAt: new Date('2024-01-01'),
    user: {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
      status: 'ACTIVE' as const,
    },
    ...overrides,
  }),

  readReceipt: (overrides = {}) => ({
    id: 'receipt-1',
    messageId: 'msg-1',
    userId: 2,
    readAt: new Date('2024-01-01'),
    user: {
      id: 2,
      name: 'Nguyễn Văn B',
      email: 'test2@example.com',
      avatar: 'avatar2.jpg',
      status: 'ACTIVE' as const,
    },
    ...overrides,
  }),

  conversation: (overrides = {}) => ({
    id: 'conv-1',
    type: 'DIRECT' as const,
    name: null,
    description: null,
    avatar: null,
    ownerId: null,
    lastMessage: 'Xin chào',
    lastMessageAt: new Date('2024-01-01'),
    isArchived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }),

  messagesListResult: (overrides = {}) => ({
    data: [createTestData.message()],
    pagination: {
      limit: 20,
      cursor: null,
      direction: 'backward' as const,
      hasMore: false,
      nextCursor: null,
      prevCursor: null,
    },
    ...overrides,
  }),

  searchResult: (overrides = {}) => ({
    data: [createTestData.message()],
    pagination: {
      limit: 20,
      cursor: null,
      hasMore: false,
      nextCursor: null,
    },
    facets: {
      byType: { TEXT: 1 },
      byUser: { '1': 1 },
      byConversation: { 'conv-1': 1 },
    },
    ...overrides,
  }),
}

describe('MessageService', () => {
  let service: MessageService
  let module: TestingModule
  let mockMessageRepo: any
  let mockConversationRepo: any
  let mockUserRepo: any

  beforeEach(async () => {
    // Tạo mock cho tất cả dependencies
    mockMessageRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findConversationMessages: jest.fn(),
      searchMessages: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addReaction: jest.fn(),
      removeReaction: jest.fn(),
      markAsRead: jest.fn(),
      markConversationAsRead: jest.fn(),
      getLastMessage: jest.fn(),
      getUnreadCount: jest.fn(),
      getMessageStats: jest.fn(),
      getReactionStats: jest.fn(),
      getReadReceiptStats: jest.fn(),
    } as any

    mockConversationRepo = {
      isUserMember: jest.fn(),
      getUserRole: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      incrementUnreadCount: jest.fn(),
      updateMemberLastRead: jest.fn(),
      findUserConversations: jest.fn(),
      getUserConversations: jest.fn(),
    } as any

    mockUserRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: MessageRepository, useValue: mockMessageRepo },
        { provide: ConversationRepository, useValue: mockConversationRepo },
        { provide: SharedUserRepository, useValue: mockUserRepo },
      ],
    }).compile()

    service = module.get<MessageService>(MessageService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    if (module) {
      await module.close()
    }
  })

  describe('getConversationMessages', () => {
    it('should get conversation messages successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn
      const conversationId = 'conv-1'
      const userId = 1
      const options = { limit: 20, cursor: undefined, direction: 'backward' as const }
      const mockResult = createTestData.messagesListResult()

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findConversationMessages.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getConversationMessages(conversationId, userId, options)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveProperty('isReadByCurrentUser')
      expect(result.data[0]).toHaveProperty('readByCount')
      expect(mockConversationRepo.isUserMember).toHaveBeenCalledWith(conversationId, userId)
      expect(mockMessageRepo.findConversationMessages).toHaveBeenCalledWith(conversationId, options)
    })

    it('should generate preview for deleted message', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn đã xóa
      const conversationId = 'conv-1'
      const userId = 1
      const options = { limit: 20 }
      const mockDeletedMessage = createTestData.message({ isDeleted: true, deletedForEveryone: true, content: null })
      const mockResult = {
        data: [mockDeletedMessage],
        pagination: { hasMore: false },
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findConversationMessages.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getConversationMessages(conversationId, userId, options)

      // Assert - Kiểm tra preview được generate
      expect(result.data).toHaveLength(1)
    })

    it('should generate preview for messages with different attachment types', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn với attachments
      const conversationId = 'conv-1'
      const userId = 1
      const options = { limit: 20 }
      const mockMessages = [
        createTestData.message({
          id: 'msg-1',
          type: 'IMAGE',
          content: null,
          attachments: [{ type: 'IMAGE', fileName: 'img.jpg', fileUrl: 'url', fileSize: 1024 }],
        }),
        createTestData.message({
          id: 'msg-2',
          type: 'VIDEO',
          content: null,
          attachments: [{ type: 'VIDEO', fileName: 'vid.mp4', fileUrl: 'url', fileSize: 1024 }],
        }),
        createTestData.message({
          id: 'msg-3',
          type: 'AUDIO',
          content: null,
          attachments: [{ type: 'AUDIO', fileName: 'audio.mp3', fileUrl: 'url', fileSize: 1024 }],
        }),
        createTestData.message({
          id: 'msg-4',
          type: 'FILE',
          content: null,
          attachments: [{ type: 'DOCUMENT', fileName: 'doc.pdf', fileUrl: 'url', fileSize: 1024 }],
        }),
      ]
      const mockResult = {
        data: mockMessages,
        pagination: { hasMore: false },
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findConversationMessages.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getConversationMessages(conversationId, userId, options)

      // Assert - Kiểm tra preview được generate cho tất cả types
      expect(result.data).toHaveLength(4)
    })

    it('should generate preview for special message types', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn đặc biệt
      const conversationId = 'conv-1'
      const userId = 1
      const options = { limit: 20 }
      const mockMessages = [
        createTestData.message({ id: 'msg-1', type: 'STICKER', content: null, attachments: [] }),
        createTestData.message({ id: 'msg-2', type: 'LOCATION', content: null, attachments: [] }),
        createTestData.message({ id: 'msg-3', type: 'CONTACT', content: null, attachments: [] }),
        createTestData.message({ id: 'msg-4', type: 'SYSTEM', content: 'System message', attachments: [] }),
        createTestData.message({ id: 'msg-5', type: 'SYSTEM', content: null, attachments: [] }),
      ]
      const mockResult = {
        data: mockMessages,
        pagination: { hasMore: false },
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findConversationMessages.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getConversationMessages(conversationId, userId, options)

      // Assert - Kiểm tra preview được generate cho tất cả special types
      expect(result.data).toHaveLength(5)
    })

    it('should generate preview for unknown attachment and message types', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn với type không xác định
      const conversationId = 'conv-1'
      const userId = 1
      const options = { limit: 20 }
      const mockMessages = [
        createTestData.message({
          id: 'msg-1',
          type: 'TEXT',
          content: null,
          attachments: [{ type: 'UNKNOWN' as any, fileName: 'file.xyz', fileUrl: 'url', fileSize: 1024 }],
        }),
        createTestData.message({ id: 'msg-2', type: 'UNKNOWN' as any, content: null, attachments: [] }),
      ]
      const mockResult = {
        data: mockMessages,
        pagination: { hasMore: false },
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findConversationMessages.mockResolvedValue(mockResult)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getConversationMessages(conversationId, userId, options)

      // Assert - Kiểm tra preview được generate cho unknown types
      expect(result.data).toHaveLength(2)
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const conversationId = 'conv-1'
      const userId = 999
      const options = { limit: 20 }

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getConversationMessages(conversationId, userId, options)).rejects.toThrow(ForbiddenException)
      await expect(service.getConversationMessages(conversationId, userId, options)).rejects.toThrow(
        'Bạn không có quyền xem tin nhắn của cuộc trò chuyện này',
      )
    })
  })

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi tin nhắn text
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'Hello world',
        type: 'TEXT' as const,
      }
      const mockMessage = createTestData.message({ content: 'Hello world' })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.create.mockResolvedValue(mockMessage)
      mockConversationRepo.update.mockResolvedValue({})
      mockConversationRepo.incrementUnreadCount.mockResolvedValue({})
      mockMessageRepo.markAsRead.mockResolvedValue({})

      // Act - Thực hiện gửi tin nhắn
      const result = await service.sendMessage(userId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockConversationRepo.isUserMember).toHaveBeenCalledWith(data.conversationId, userId)
      expect(mockMessageRepo.create).toHaveBeenCalledWith({
        conversationId: data.conversationId,
        fromUserId: userId,
        content: 'Hello world',
        type: 'TEXT',
        replyToId: undefined,
        attachments: undefined,
      })
      expect(mockConversationRepo.update).toHaveBeenCalled()
      expect(mockConversationRepo.incrementUnreadCount).toHaveBeenCalledWith(data.conversationId, userId)
      expect(mockMessageRepo.markAsRead).toHaveBeenCalledWith(mockMessage.id, userId)
    })

    it('should send message with attachments successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi tin nhắn có attachments
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        type: 'IMAGE' as const,
        attachments: [
          {
            type: 'IMAGE' as const,
            fileName: 'image.jpg',
            fileUrl: 'https://example.com/image.jpg',
            fileSize: 1024,
            mimeType: 'image/jpeg',
          },
        ],
      }
      const mockMessage = createTestData.messageWithAttachments()

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.create.mockResolvedValue(mockMessage)
      mockConversationRepo.update.mockResolvedValue({})
      mockConversationRepo.incrementUnreadCount.mockResolvedValue({})
      mockMessageRepo.markAsRead.mockResolvedValue({})

      // Act - Thực hiện gửi tin nhắn
      const result = await service.sendMessage(userId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageRepo.create).toHaveBeenCalledWith({
        conversationId: data.conversationId,
        fromUserId: userId,
        content: null,
        type: 'IMAGE',
        replyToId: undefined,
        attachments: data.attachments,
      })
    })

    it('should send reply message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu gửi tin nhắn trả lời
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'Reply message',
        replyToId: 'msg-original',
      }
      const mockOriginalMessage = createTestData.message({ id: 'msg-original' })
      const mockReplyMessage = createTestData.message({ content: 'Reply message', replyToId: 'msg-original' })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockOriginalMessage)
      mockMessageRepo.create.mockResolvedValue(mockReplyMessage)
      mockConversationRepo.update.mockResolvedValue({})
      mockConversationRepo.incrementUnreadCount.mockResolvedValue({})
      mockMessageRepo.markAsRead.mockResolvedValue({})

      // Act - Thực hiện gửi tin nhắn trả lời
      const result = await service.sendMessage(userId, data)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockReplyMessage)
      expect(mockMessageRepo.findById).toHaveBeenCalledWith('msg-original')
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const userId = 999
      const data = {
        conversationId: 'conv-1',
        content: 'Hello',
      }

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(ForbiddenException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow(
        'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này',
      )
    })

    it('should throw BadRequestException when message has no content and no attachments', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn rỗng
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: '',
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow('Tin nhắn phải có nội dung hoặc file đính kèm')
    })

    it('should throw BadRequestException when content exceeds 10000 characters', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn quá dài
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'a'.repeat(10001),
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow(
        'Nội dung tin nhắn không được vượt quá 10,000 ký tự',
      )
    })

    it('should throw BadRequestException when too many attachments', async () => {
      // Arrange - Chuẩn bị dữ liệu với quá nhiều attachments
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'Files',
        type: 'FILE' as const,
        attachments: Array(11)
          .fill(null)
          .map((_, i) => ({
            type: 'DOCUMENT' as const,
            fileName: `file${i}.pdf`,
            fileUrl: `https://example.com/file${i}.pdf`,
            fileSize: 1024,
          })),
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow('Không thể đính kèm quá 10 file')
    })

    it('should throw BadRequestException when attachment missing fileName or fileUrl', async () => {
      // Arrange - Chuẩn bị dữ liệu với attachment thiếu thông tin
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'File',
        type: 'FILE' as const,
        attachments: [
          {
            type: 'DOCUMENT' as const,
            fileName: '',
            fileUrl: '',
            fileSize: 1024,
          },
        ],
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow('File đính kèm phải có tên và URL')
    })

    it('should throw BadRequestException when attachment exceeds 100MB', async () => {
      // Arrange - Chuẩn bị dữ liệu với file quá lớn
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'File',
        type: 'FILE' as const,
        attachments: [
          {
            type: 'DOCUMENT' as const,
            fileName: 'large.pdf',
            fileUrl: 'https://example.com/large.pdf',
            fileSize: 101 * 1024 * 1024, // 101MB
          },
        ],
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow('Kích thước file không được vượt quá 100MB')
    })

    it('should throw BadRequestException when replyTo message is deleted for everyone', async () => {
      // Arrange - Chuẩn bị dữ liệu reply tin nhắn đã xóa
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'Reply',
        type: 'TEXT' as const,
        replyToId: 'msg-deleted',
      }
      const mockDeletedMessage = createTestData.message({
        id: 'msg-deleted',
        isDeleted: true,
        deletedForEveryone: true,
      })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockDeletedMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow('Không thể trả lời tin nhắn đã bị xóa')
    })

    it('should throw BadRequestException when replyTo message not in same conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu reply tin nhắn khác conversation
      const userId = 1
      const data = {
        conversationId: 'conv-1',
        content: 'Reply',
        type: 'TEXT' as const,
        replyToId: 'msg-other',
      }
      const mockOtherMessage = createTestData.message({
        id: 'msg-other',
        conversationId: 'conv-2', // Different conversation
      })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockOtherMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.sendMessage(userId, data)).rejects.toThrow(BadRequestException)
      await expect(service.sendMessage(userId, data)).rejects.toThrow(
        'Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này',
      )
    })
  })

  describe('editMessage', () => {
    it('should edit message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu chỉnh sửa tin nhắn
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'Updated content'
      const recentDate = new Date() // Use current date to pass 24-hour check
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, createdAt: recentDate })
      const mockUpdatedMessage = createTestData.message({
        id: messageId,
        content: newContent,
        isEdited: true,
        editedAt: new Date(),
      })
      const mockConversation = createTestData.conversation()
      const mockLastMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockMessageRepo.update.mockResolvedValue(mockUpdatedMessage)
      mockConversationRepo.findById.mockResolvedValue(mockConversation)
      mockMessageRepo.getLastMessage.mockResolvedValue(mockLastMessage)
      mockConversationRepo.update.mockResolvedValue({})

      // Act - Thực hiện chỉnh sửa
      const result = await service.editMessage(messageId, userId, newContent)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedMessage)
      expect(mockMessageRepo.update).toHaveBeenCalledWith(messageId, {
        content: newContent,
        isEdited: true,
        editedAt: expect.any(Date),
      })
    })

    it('should throw NotFoundException when message does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1
      const newContent = 'Updated content'

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(NotFoundException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when user is not author', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải tác giả
      const messageId = 'msg-1'
      const userId = 999
      const newContent = 'Updated content'
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(ForbiddenException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình',
      )
    })

    it('should throw BadRequestException when editing deleted message', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn đã bị xóa
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'Updated content'
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, isDeleted: true })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Không thể chỉnh sửa tin nhắn đã bị xóa',
      )
    })

    it('should throw BadRequestException when editing message older than 24 hours', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn quá 24 giờ
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'Updated content'
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, createdAt: oldDate })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Không thể chỉnh sửa tin nhắn quá 24 giờ',
      )
    })

    it('should throw BadRequestException when editing SYSTEM message', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn hệ thống
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'Updated content'
      const recentDate = new Date()
      const mockMessage = createTestData.message({
        id: messageId,
        fromUserId: userId,
        type: 'SYSTEM',
        createdAt: recentDate,
      })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Không thể chỉnh sửa tin nhắn hệ thống',
      )
    })

    it('should throw BadRequestException when editing message with only attachments', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn chỉ có attachments
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'Updated content'
      const recentDate = new Date()
      const mockMessage = createTestData.messageWithAttachments()
      mockMessage.id = messageId
      mockMessage.fromUserId = userId
      mockMessage.content = null // No content, only attachments
      mockMessage.createdAt = recentDate

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Không thể chỉnh sửa tin nhắn chỉ có file đính kèm',
      )
    })

    it('should throw BadRequestException when new content is empty', async () => {
      // Arrange - Chuẩn bị dữ liệu nội dung mới rỗng
      const messageId = 'msg-1'
      const userId = 1
      const newContent = '   ' // Empty after trim
      const recentDate = new Date()
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, createdAt: recentDate })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Nội dung tin nhắn không được để trống',
      )
    })

    it('should throw BadRequestException when new content exceeds 10000 characters', async () => {
      // Arrange - Chuẩn bị dữ liệu nội dung quá dài
      const messageId = 'msg-1'
      const userId = 1
      const newContent = 'a'.repeat(10001)
      const recentDate = new Date()
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, createdAt: recentDate })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(BadRequestException)
      await expect(service.editMessage(messageId, userId, newContent)).rejects.toThrow(
        'Nội dung tin nhắn không được vượt quá 10,000 ký tự',
      )
    })

    it('should return original message when content has not changed', async () => {
      // Arrange - Chuẩn bị dữ liệu nội dung không thay đổi
      const messageId = 'msg-1'
      const userId = 1
      const content = 'Same content'
      const recentDate = new Date() // Use current date to pass 24-hour check
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, content, createdAt: recentDate })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act - Thực hiện chỉnh sửa
      const result = await service.editMessage(messageId, userId, content)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockMessage)
      expect(mockMessageRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa tin nhắn
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId })
      const mockDeletedMessage = createTestData.message({ id: messageId, isDeleted: true })
      const mockLastMessage = createTestData.message({ id: 'msg-2' })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockMessageRepo.delete.mockResolvedValue(mockDeletedMessage)
      mockMessageRepo.getLastMessage.mockResolvedValue(mockLastMessage)
      mockConversationRepo.update.mockResolvedValue({})

      // Act - Thực hiện xóa
      const result = await service.deleteMessage(messageId, userId, false)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeletedMessage)
      expect(mockMessageRepo.delete).toHaveBeenCalledWith(messageId, false)
    })

    it('should delete message for everyone when user is admin', async () => {
      // Arrange - Chuẩn bị dữ liệu admin xóa tin nhắn
      const messageId = 'msg-1'
      const userId = 2 // Admin
      const recentDate = new Date() // Use current date to pass 24-hour check
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1, createdAt: recentDate })
      const mockDeletedMessage = createTestData.message({ id: messageId, isDeleted: true, deletedForEveryone: true })
      const mockLastMessage = createTestData.message({ id: 'msg-2' })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockMessageRepo.delete.mockResolvedValue(mockDeletedMessage)
      mockMessageRepo.getLastMessage.mockResolvedValue(mockLastMessage)
      mockConversationRepo.update.mockResolvedValue({})

      // Act - Thực hiện xóa
      const result = await service.deleteMessage(messageId, userId, true)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDeletedMessage)
      expect(mockConversationRepo.getUserRole).toHaveBeenCalledWith(mockMessage.conversationId, userId)
      expect(mockMessageRepo.delete).toHaveBeenCalledWith(messageId, true)
    })

    it('should throw NotFoundException when message does not exist', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-not-found'
      const userId = 1

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow(NotFoundException)
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when non-author tries to delete for others', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải tác giả
      const messageId = 'msg-1'
      const userId = 999
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow(ForbiddenException)
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow(
        'Bạn chỉ có thể xóa tin nhắn của chính mình',
      )
    })

    it('should throw ForbiddenException when non-admin tries to delete for everyone', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải admin
      const messageId = 'msg-1'
      const userId = 2
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      // Act & Assert - Kiểm tra lỗi
      await expect(service.deleteMessage(messageId, userId, true)).rejects.toThrow(ForbiddenException)
      await expect(service.deleteMessage(messageId, userId, true)).rejects.toThrow(
        'Chỉ tác giả tin nhắn hoặc quản trị viên mới có thể xóa tin nhắn cho tất cả mọi người',
      )
    })

    it('should throw BadRequestException when message already deleted', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn đã xóa
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId, isDeleted: true })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow(BadRequestException)
      await expect(service.deleteMessage(messageId, userId, false)).rejects.toThrow('Tin nhắn đã bị xóa')
    })

    it('should throw BadRequestException when admin tries to delete old message for everyone', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn quá 24 giờ
      const messageId = 'msg-1'
      const userId = 2 // Admin
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1, createdAt: oldDate })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')

      // Act & Assert - Kiểm tra lỗi
      await expect(service.deleteMessage(messageId, userId, true)).rejects.toThrow(BadRequestException)
      await expect(service.deleteMessage(messageId, userId, true)).rejects.toThrow(
        'Không thể xóa tin nhắn quá 24 giờ cho tất cả mọi người',
      )
    })
  })

  describe('markAsRead', () => {
    it('should mark specific message as read successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu tin nhắn đã đọc
      const conversationId = 'conv-1'
      const userId = 1
      const messageId = 'msg-1'
      const mockMessage = createTestData.message({ id: messageId, conversationId, fromUserId: 2 })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockMessageRepo.markAsRead.mockResolvedValue({})
      mockConversationRepo.updateMemberLastRead.mockResolvedValue({})

      // Act - Thực hiện đánh dấu đã đọc
      const result = await service.markAsRead(conversationId, userId, messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ markedCount: 1 })
      expect(mockMessageRepo.findById).toHaveBeenCalledWith(messageId)
      expect(mockMessageRepo.markAsRead).toHaveBeenCalledWith(messageId, userId)
      expect(mockConversationRepo.updateMemberLastRead).toHaveBeenCalledWith(conversationId, userId, expect.any(Date))
    })

    it('should mark all messages in conversation as read', async () => {
      // Arrange - Chuẩn bị dữ liệu đánh dấu tất cả tin nhắn đã đọc
      const conversationId = 'conv-1'
      const userId = 1

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.markConversationAsRead.mockResolvedValue(5)
      mockConversationRepo.updateMemberLastRead.mockResolvedValue({})

      // Act - Thực hiện đánh dấu tất cả đã đọc
      const result = await service.markAsRead(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ markedCount: 5 })
      expect(mockMessageRepo.markConversationAsRead).toHaveBeenCalledWith(conversationId, userId)
      expect(mockConversationRepo.updateMemberLastRead).toHaveBeenCalledWith(conversationId, userId, expect.any(Date))
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const conversationId = 'conv-1'
      const userId = 999

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.markAsRead(conversationId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.markAsRead(conversationId, userId)).rejects.toThrow(
        'Bạn không có quyền đánh dấu tin nhắn đã đọc',
      )
    })

    it('should not mark own messages as read', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn của chính user
      const conversationId = 'conv-1'
      const userId = 1
      const messageId = 'msg-1'
      const mockMessage = createTestData.message({ id: messageId, conversationId, fromUserId: userId })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.updateMemberLastRead.mockResolvedValue({})

      // Act - Thực hiện đánh dấu đã đọc
      const result = await service.markAsRead(conversationId, userId, messageId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ markedCount: 0 })
      expect(mockMessageRepo.markAsRead).not.toHaveBeenCalled()
    })

    it('should throw NotFoundException when message not in conversation', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không thuộc conversation
      const conversationId = 'conv-1'
      const userId = 1
      const messageId = 'msg-1'
      const mockMessage = createTestData.message({ id: messageId, conversationId: 'conv-2' })

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.findById.mockResolvedValue(mockMessage)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.markAsRead(conversationId, userId, messageId)).rejects.toThrow(NotFoundException)
      await expect(service.markAsRead(conversationId, userId, messageId)).rejects.toThrow(
        'Tin nhắn không tồn tại trong cuộc trò chuyện này',
      )
    })
  })

  describe('reactToMessage', () => {
    it('should add reaction to message successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm reaction
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'
      const mockMessage = createTestData.message({ id: messageId, reactions: [] })
      const mockReaction = createTestData.reaction({ emoji })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.addReaction.mockResolvedValue(mockReaction)

      // Act - Thực hiện thêm reaction
      const result = await service.reactToMessage(messageId, userId, emoji)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ action: 'added', reaction: mockReaction })
      expect(mockMessageRepo.addReaction).toHaveBeenCalledWith(messageId, userId, emoji)
    })

    it('should toggle reaction (remove if already exists)', async () => {
      // Arrange - Chuẩn bị dữ liệu reaction đã tồn tại
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'
      const existingReaction = createTestData.reaction({ userId, emoji })
      const mockMessage = createTestData.message({ id: messageId, reactions: [existingReaction] })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.removeReaction.mockResolvedValue({})

      // Act - Thực hiện toggle reaction
      const result = await service.reactToMessage(messageId, userId, emoji)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ action: 'removed', emoji })
      expect(mockMessageRepo.removeReaction).toHaveBeenCalledWith(messageId, userId, emoji)
    })

    it('should throw NotFoundException when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1
      const emoji = '👍'

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow(NotFoundException)
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw BadRequestException for invalid emoji', async () => {
      // Arrange - Chuẩn bị dữ liệu emoji không hợp lệ
      const messageId = 'msg-1'
      const userId = 1
      const invalidEmoji = 'invalid'
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.reactToMessage(messageId, userId, invalidEmoji)).rejects.toThrow(BadRequestException)
      await expect(service.reactToMessage(messageId, userId, invalidEmoji)).rejects.toThrow('Emoji không hợp lệ')
    })

    it('should throw BadRequestException when reacting to deleted message', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn đã xóa
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'
      const mockMessage = createTestData.message({ id: messageId, isDeleted: true, deletedForEveryone: true })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow(BadRequestException)
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow(
        'Không thể react tin nhắn đã bị xóa',
      )
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const messageId = 'msg-1'
      const userId = 999
      const emoji = '👍'
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow(ForbiddenException)
      await expect(service.reactToMessage(messageId, userId, emoji)).rejects.toThrow(
        'Bạn không có quyền thêm reaction cho tin nhắn này',
      )
    })
  })

  describe('removeReaction', () => {
    it('should remove reaction successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa reaction
      const messageId = 'msg-1'
      const userId = 1
      const emoji = '👍'
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.removeReaction.mockResolvedValue({})

      // Act - Thực hiện xóa reaction
      const result = await service.removeReaction(messageId, userId, emoji)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({ message: 'Đã xóa reaction' })
      expect(mockMessageRepo.removeReaction).toHaveBeenCalledWith(messageId, userId, emoji)
    })

    it('should throw NotFoundException when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1
      const emoji = '👍'

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.removeReaction(messageId, userId, emoji)).rejects.toThrow(NotFoundException)
      await expect(service.removeReaction(messageId, userId, emoji)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const messageId = 'msg-1'
      const userId = 999
      const emoji = '👍'
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.removeReaction(messageId, userId, emoji)).rejects.toThrow(ForbiddenException)
      await expect(service.removeReaction(messageId, userId, emoji)).rejects.toThrow(
        'Bạn không có quyền xóa reaction này',
      )
    })
  })

  describe('searchMessages', () => {
    it('should search messages with query successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm
      const userId = 1
      const query = 'test'
      const options = { limit: 20 }
      const mockConversations = [createTestData.conversation({ id: 'conv-1' })]
      const mockSearchResult = createTestData.searchResult()

      mockConversationRepo.findUserConversations.mockResolvedValue({
        data: mockConversations,
        pagination: { total: 1, hasMore: false },
      })
      mockMessageRepo.searchMessages.mockResolvedValue(mockSearchResult)

      // Act - Thực hiện tìm kiếm
      const result = await service.searchMessages(userId, query, options)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockSearchResult)
      expect(mockMessageRepo.searchMessages).toHaveBeenCalledWith(['conv-1'], query, options)
    })

    it('should throw ForbiddenException when searching in conversation user is not member of', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm conversation không có quyền
      const userId = 1
      const query = 'test'
      const options = { limit: 20, conversationId: 'conv-2' }
      const mockConversations = [createTestData.conversation({ id: 'conv-1' })]

      mockConversationRepo.findUserConversations.mockResolvedValue({
        data: mockConversations,
        pagination: { total: 1, hasMore: false },
      })

      // Act & Assert - Kiểm tra lỗi
      await expect(service.searchMessages(userId, query, options)).rejects.toThrow(ForbiddenException)
      await expect(service.searchMessages(userId, query, options)).rejects.toThrow(
        'Bạn không có quyền tìm kiếm trong cuộc trò chuyện này',
      )
    })

    it('should filter by specific conversation ID', async () => {
      // Arrange - Chuẩn bị dữ liệu tìm kiếm với filter
      const userId = 1
      const query = 'test'
      const options = { limit: 20, conversationId: 'conv-1' }
      const mockConversations = [createTestData.conversation({ id: 'conv-1' })]
      const mockSearchResult = createTestData.searchResult()

      mockConversationRepo.findUserConversations.mockResolvedValue({
        data: mockConversations,
        pagination: { total: 1, hasMore: false },
      })
      mockMessageRepo.searchMessages.mockResolvedValue(mockSearchResult)

      // Act - Thực hiện tìm kiếm
      const result = await service.searchMessages(userId, query, options)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockSearchResult)
      expect(mockMessageRepo.searchMessages).toHaveBeenCalledWith(['conv-1'], query, options)
    })

    it('should return empty results when no conversations', async () => {
      // Arrange - Chuẩn bị dữ liệu không có conversation
      const userId = 1
      const query = 'test'
      const options = { limit: 20 }

      mockConversationRepo.findUserConversations.mockResolvedValue({
        data: [],
        pagination: { total: 0, hasMore: false },
      })

      // Act - Thực hiện tìm kiếm
      const result = await service.searchMessages(userId, query, options)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        data: [],
        pagination: {
          limit: 20,
          cursor: null,
          hasMore: false,
          nextCursor: null,
        },
      })
      expect(mockMessageRepo.searchMessages).not.toHaveBeenCalled()
    })
  })

  describe('getMessageById', () => {
    it('should get message by ID successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy tin nhắn
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)

      // Act - Thực hiện lấy tin nhắn
      const result = await service.getMessageById(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toBeDefined()
      expect(result.id).toBe(messageId)
      expect(result.isReadByCurrentUser).toBeDefined()
      expect(result.readByCount).toBeDefined()
    })

    it('should throw NotFoundException when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getMessageById(messageId, userId)).rejects.toThrow(NotFoundException)
      await expect(service.getMessageById(messageId, userId)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const messageId = 'msg-1'
      const userId = 999
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getMessageById(messageId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getMessageById(messageId, userId)).rejects.toThrow('Bạn không có quyền xem tin nhắn này')
    })
  })

  describe('getMessageStats', () => {
    it('should get message statistics successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê tin nhắn
      const conversationId = 'conv-1'
      const userId = 1
      const mockStats = {
        total: 100,
        byType: [
          { type: 'TEXT', count: 80 },
          { type: 'IMAGE', count: 20 },
        ],
        mediaCount: 20,
      }

      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.getMessageStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await service.getMessageStats(conversationId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockMessageRepo.getMessageStats).toHaveBeenCalledWith(conversationId)
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const conversationId = 'conv-1'
      const userId = 999

      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getMessageStats(conversationId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getMessageStats(conversationId, userId)).rejects.toThrow(
        'Bạn không có quyền xem thống kê tin nhắn',
      )
    })
  })

  describe('getReactionStats', () => {
    it('should get reaction statistics successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê reaction
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId })
      const mockStats = [
        { emoji: '👍', count: 5 },
        { emoji: '❤️', count: 3 },
      ]

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.getReactionStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await service.getReactionStats(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockMessageRepo.getReactionStats).toHaveBeenCalledWith(messageId)
    })

    it('should throw NotFoundException when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getReactionStats(messageId, userId)).rejects.toThrow(NotFoundException)
      await expect(service.getReactionStats(messageId, userId)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const messageId = 'msg-1'
      const userId = 999
      const mockMessage = createTestData.message({ id: messageId })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getReactionStats(messageId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getReactionStats(messageId, userId)).rejects.toThrow(
        'Bạn không có quyền xem thống kê reaction',
      )
    })
  })

  describe('getReadReceiptStats', () => {
    it('should get read receipt statistics successfully as author', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê đã đọc (tác giả)
      const messageId = 'msg-1'
      const userId = 1
      const mockMessage = createTestData.message({ id: messageId, fromUserId: userId })
      const mockStats = {
        readCount: 5,
        totalMembers: 10,
        readPercentage: 50,
      }

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockMessageRepo.getReadReceiptStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await service.getReadReceiptStats(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockMessageRepo.getReadReceiptStats).toHaveBeenCalledWith(messageId)
    })

    it('should get read receipt statistics successfully as admin', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê đã đọc (admin)
      const messageId = 'msg-1'
      const userId = 2
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })
      const mockStats = {
        readCount: 5,
        totalMembers: 10,
        readPercentage: 50,
      }

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockConversationRepo.getUserRole.mockResolvedValue('ADMIN')
      mockMessageRepo.getReadReceiptStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await service.getReadReceiptStats(messageId, userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockStats)
      expect(mockConversationRepo.getUserRole).toHaveBeenCalledWith(mockMessage.conversationId, userId)
    })

    it('should throw NotFoundException when message not found', async () => {
      // Arrange - Chuẩn bị dữ liệu tin nhắn không tồn tại
      const messageId = 'msg-nonexistent'
      const userId = 1

      mockMessageRepo.findById.mockResolvedValue(null)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow(NotFoundException)
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow('Tin nhắn không tồn tại')
    })

    it('should throw ForbiddenException when user is not member', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải thành viên
      const messageId = 'msg-1'
      const userId = 999
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(false)

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow(
        'Bạn không có quyền xem thống kê đã đọc',
      )
    })

    it('should throw ForbiddenException when user is not author or admin', async () => {
      // Arrange - Chuẩn bị dữ liệu user không phải tác giả hoặc admin
      const messageId = 'msg-1'
      const userId = 999
      const mockMessage = createTestData.message({ id: messageId, fromUserId: 1 })

      mockMessageRepo.findById.mockResolvedValue(mockMessage)
      mockConversationRepo.isUserMember.mockResolvedValue(true)
      mockConversationRepo.getUserRole.mockResolvedValue('MEMBER')

      // Act & Assert - Kiểm tra lỗi
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getReadReceiptStats(messageId, userId)).rejects.toThrow(
        'Chỉ tác giả tin nhắn hoặc quản trị viên mới có thể xem thống kê đã đọc',
      )
    })
  })
})
