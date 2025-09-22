import { Test, TestingModule } from '@nestjs/testing'
import { ConversationController } from '../conversation.controller'
import { ConversationService } from '../conversation.service'
import { MessageService } from '../message.service'
import {
  CreateDirectConversationBodyDTO,
  CreateGroupConversationBodyDTO,
  UpdateConversationBodyDTO,
  AddMembersBodyDTO,
  ConversationParamsDTO,
  MemberParamsDTO,
  GetConversationsQueryDTO,
} from '../conversation.dto'

// Test data factory để tạo dữ liệu test
const createTestData = {
  createDirectConversationBody: (overrides = {}): CreateDirectConversationBodyDTO => ({
    recipientId: 2,
    ...overrides,
  }),

  createGroupConversationBody: (overrides = {}): CreateGroupConversationBodyDTO => ({
    name: 'Nhóm chat',
    description: 'Nhóm thảo luận',
    memberIds: [2, 3],
    avatar: 'group-avatar.jpg',
    ...overrides,
  }),

  updateConversationBody: (overrides = {}): UpdateConversationBodyDTO => ({
    name: 'Tên nhóm mới',
    description: 'Mô tả mới',
    avatar: 'new-avatar.jpg',
    ...overrides,
  }),

  addMembersBody: (overrides = {}): AddMembersBodyDTO => ({
    conversationId: 'conv-1',
    memberIds: [4, 5],
    ...overrides,
  }),

  conversationParams: (overrides = {}): ConversationParamsDTO => ({
    conversationId: 'conv-1',
    ...overrides,
  }),

  memberParams: (overrides = {}): MemberParamsDTO => ({
    conversationId: 'conv-1',
    memberId: 2,
    ...overrides,
  }),

  getConversationsQuery: (overrides = {}): GetConversationsQueryDTO => ({
    page: 1,
    limit: 20,
    type: undefined,
    search: undefined,
    isArchived: false,
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: 1,
    name: 'Nguyễn Văn A',
    email: 'test@example.com',
    avatar: 'avatar.jpg',
    status: 'ACTIVE' as const,
    ...overrides,
  }),

  conversationMember: (overrides = {}) => ({
    id: 'member-1',
    userId: 1,
    conversationId: 'conv-1',
    role: 'MEMBER' as const,
    joinedAt: new Date('2024-01-01'),
    lastReadAt: new Date('2024-01-01'),
    unreadCount: 0,
    isActive: true,
    isMuted: false,
    mutedUntil: null,
    user: createTestData.user(),
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
    owner: null,
    members: [createTestData.conversationMember()],
    unreadCount: 0,
    currentUserRole: 'MEMBER' as const,
    isCurrentUserAdmin: false,
    memberCount: 1,
    ...overrides,
  }),

  groupConversation: (overrides = {}) => ({
    id: 'conv-2',
    type: 'GROUP' as const,
    name: 'Nhóm chat',
    description: 'Nhóm thảo luận',
    avatar: 'group-avatar.jpg',
    ownerId: 1,
    lastMessage: 'Chào mọi người',
    lastMessageAt: new Date('2024-01-01'),
    isArchived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    owner: createTestData.user(),
    members: [
      createTestData.conversationMember({ role: 'ADMIN', userId: 1 }),
      createTestData.conversationMember({ role: 'MEMBER', userId: 2, id: 'member-2' }),
    ],
    unreadCount: 0,
    currentUserRole: 'ADMIN' as const,
    isCurrentUserAdmin: true,
    memberCount: 2,
    ...overrides,
  }),

  conversationsList: (overrides = {}) => ({
    data: [createTestData.conversation()],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
    stats: {
      totalUnread: 5,
      directCount: 3,
      groupCount: 2,
      archivedCount: 1,
    },
    ...overrides,
  }),

  conversationStats: (overrides = {}) => ({
    totalUnread: 5,
    directCount: 3,
    groupCount: 2,
    archivedCount: 1,
    ...overrides,
  }),

  conversationMembers: (overrides = []) => [
    createTestData.conversationMember(),
    createTestData.conversationMember({ userId: 2, id: 'member-2', role: 'MEMBER' }),
    ...overrides,
  ],
}

describe('ConversationController', () => {
  let controller: ConversationController
  let module: TestingModule
  let mockConversationService: jest.Mocked<ConversationService>
  let mockMessageService: jest.Mocked<MessageService>

  beforeEach(async () => {
    // Tạo mock cho tất cả services
    mockConversationService = {
      getUserConversations: jest.fn(),
      getConversationById: jest.fn(),
      createDirectConversation: jest.fn(),
      createGroupConversation: jest.fn(),
      updateConversation: jest.fn(),
      archiveConversation: jest.fn(),
      unarchiveConversation: jest.fn(),
      muteConversation: jest.fn(),
      unmuteConversation: jest.fn(),
      leaveConversation: jest.fn(),
      addMembers: jest.fn(),
      removeMember: jest.fn(),
      updateMemberRole: jest.fn(),
      getConversationMembers: jest.fn(),
      getConversationStats: jest.fn(),
    } as any

    mockMessageService = {
      getConversationMessages: jest.fn(),
      getMessageStats: jest.fn(),
      searchMessages: jest.fn(),
      sendMessage: jest.fn(),
      getMessageById: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      markAsRead: jest.fn(),
      reactToMessage: jest.fn(),
      removeReaction: jest.fn(),
      getReactionStats: jest.fn(),
      getReadReceiptStats: jest.fn(),
    } as any

    module = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockConversationService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile()

    controller = module.get<ConversationController>(ConversationController)
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

  describe('getConversations', () => {
    it('should get conversations list successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách cuộc trò chuyện
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const mockConversationsList = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversationsList)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledTimes(1)
    })

    it('should handle conversations list with type filter', async () => {
      // Arrange - Chuẩn bị dữ liệu với filter type
      const userId = 1
      const query = createTestData.getConversationsQuery({ type: 'GROUP' })
      const mockGroupConversationsList = createTestData.conversationsList({
        data: [createTestData.groupConversation()],
      })

      mockConversationService.getUserConversations.mockResolvedValue(mockGroupConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện nhóm
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result.data[0].type).toBe('GROUP')
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle conversations list with search query', async () => {
      // Arrange - Chuẩn bị dữ liệu với từ khóa tìm kiếm
      const userId = 1
      const query = createTestData.getConversationsQuery({ search: 'test' })
      const mockConversationsList = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện tìm kiếm cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversationsList)
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle conversations list with pagination', async () => {
      // Arrange - Chuẩn bị dữ liệu với pagination
      const userId = 1
      const query = createTestData.getConversationsQuery({ page: 2, limit: 10 })
      const mockConversationsList = createTestData.conversationsList({
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      })

      mockConversationService.getUserConversations.mockResolvedValue(mockConversationsList)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra pagination
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(3)
    })
  })

  describe('getConversationStats', () => {
    it('should get conversation stats successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thống kê cuộc trò chuyện
      const userId = 1
      const mockStats = createTestData.conversationStats()

      mockConversationService.getConversationStats.mockResolvedValue(mockStats)

      // Act - Thực hiện lấy thống kê
      const result = await controller.getConversationStats(userId)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Thống kê cuộc trò chuyện',
        data: mockStats,
      })
      expect(mockConversationService.getConversationStats).toHaveBeenCalledWith(userId)
    })
  })

  describe('getConversation', () => {
    it('should get conversation detail successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy chi tiết cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockConversation = createTestData.conversation()

      mockConversationService.getConversationById.mockResolvedValue(mockConversation)

      // Act - Thực hiện lấy chi tiết cuộc trò chuyện
      const result = await controller.getConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockConversation)
      expect(mockConversationService.getConversationById).toHaveBeenCalledWith(params.conversationId, userId)
      expect(mockConversationService.getConversationById).toHaveBeenCalledTimes(1)
    })

    it('should handle different conversation IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với conversation ID khác
      const userId = 1
      const params = createTestData.conversationParams({ conversationId: 'conv-2' })
      const mockGroupConversation = createTestData.groupConversation({ id: 'conv-2' })

      mockConversationService.getConversationById.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện lấy chi tiết cuộc trò chuyện
      const result = await controller.getConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.id).toBe('conv-2')
      expect(result.type).toBe('GROUP')
      expect(mockConversationService.getConversationById).toHaveBeenCalledWith('conv-2', userId)
    })
  })

  describe('createDirectConversation', () => {
    it('should create direct conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện direct
      const userId = 1
      const body = createTestData.createDirectConversationBody()
      const mockDirectConversation = createTestData.conversation()

      mockConversationService.createDirectConversation.mockResolvedValue(mockDirectConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await controller.createDirectConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDirectConversation)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledWith(userId, body.recipientId)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle creating conversation with different recipients', async () => {
      // Arrange - Chuẩn bị dữ liệu với recipient khác
      const userId = 1
      const body = createTestData.createDirectConversationBody({ recipientId: 3 })
      const mockDirectConversation = createTestData.conversation()

      mockConversationService.createDirectConversation.mockResolvedValue(mockDirectConversation)

      // Act - Thực hiện tạo cuộc trò chuyện direct
      const result = await controller.createDirectConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockDirectConversation)
      expect(mockConversationService.createDirectConversation).toHaveBeenCalledWith(userId, 3)
    })
  })

  describe('createGroupConversation', () => {
    it('should create group conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo cuộc trò chuyện nhóm
      const userId = 1
      const body = createTestData.createGroupConversationBody()
      const mockGroupConversation = createTestData.groupConversation()

      mockConversationService.createGroupConversation.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện tạo cuộc trò chuyện nhóm
      const result = await controller.createGroupConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockGroupConversation)
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledWith(userId, body)
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle creating group with different configurations', async () => {
      // Arrange - Chuẩn bị dữ liệu tạo nhóm với cấu hình khác
      const userId = 1
      const body = createTestData.createGroupConversationBody({
        name: 'Nhóm công việc',
        description: 'Nhóm thảo luận công việc',
        memberIds: [2, 3, 4],
      })
      const mockGroupConversation = createTestData.groupConversation({
        name: 'Nhóm công việc',
        description: 'Nhóm thảo luận công việc',
      })

      mockConversationService.createGroupConversation.mockResolvedValue(mockGroupConversation)

      // Act - Thực hiện tạo cuộc trò chuyện nhóm
      const result = await controller.createGroupConversation(userId, body)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('Nhóm công việc')
      expect(result.description).toBe('Nhóm thảo luận công việc')
      expect(mockConversationService.createGroupConversation).toHaveBeenCalledWith(userId, body)
    })
  })

  describe('updateConversation', () => {
    it('should update conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody()
      const mockUpdatedConversation = createTestData.groupConversation({
        name: body.name,
        description: body.description,
      })

      mockConversationService.updateConversation.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện cập nhật cuộc trò chuyện
      const result = await controller.updateConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedConversation)
      expect(mockConversationService.updateConversation).toHaveBeenCalledWith(params.conversationId, userId, body)
      expect(mockConversationService.updateConversation).toHaveBeenCalledTimes(1)
    })

    it('should handle partial updates', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật một phần
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody({ name: 'Tên mới only' })
      const mockUpdatedConversation = createTestData.groupConversation({ name: 'Tên mới only' })

      mockConversationService.updateConversation.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện cập nhật một phần
      const result = await controller.updateConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result.name).toBe('Tên mới only')
      expect(mockConversationService.updateConversation).toHaveBeenCalledWith(params.conversationId, userId, body)
    })
  })

  describe('archiveConversation', () => {
    it('should archive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lưu trữ cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã lưu trữ cuộc trò chuyện' }

      mockConversationService.archiveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện lưu trữ cuộc trò chuyện
      const result = await controller.archiveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.archiveConversation).toHaveBeenCalledWith(params.conversationId, userId)
      expect(mockConversationService.archiveConversation).toHaveBeenCalledTimes(1)
    })
  })

  describe('unarchiveConversation', () => {
    it('should unarchive conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu khôi phục cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã khôi phục cuộc trò chuyện' }

      mockConversationService.unarchiveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện khôi phục cuộc trò chuyện
      const result = await controller.unarchiveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.unarchiveConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('muteConversation', () => {
    it('should mute conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu tắt thông báo cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const body = { mutedUntil: '2024-12-31T23:59:59.000Z' }
      const mockResponse = { message: 'Đã tắt thông báo cuộc trò chuyện' }

      mockConversationService.muteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện tắt thông báo
      const result = await controller.muteConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.muteConversation).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        new Date(body.mutedUntil),
      )
    })

    it('should mute conversation permanently when no mutedUntil provided', async () => {
      // Arrange - Chuẩn bị dữ liệu tắt thông báo vĩnh viễn
      const userId = 1
      const params = createTestData.conversationParams()
      const body = {}
      const mockResponse = { message: 'Đã tắt thông báo cuộc trò chuyện' }

      mockConversationService.muteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện tắt thông báo vĩnh viễn
      const result = await controller.muteConversation(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.muteConversation).toHaveBeenCalledWith(params.conversationId, userId, undefined)
    })
  })

  describe('unmuteConversation', () => {
    it('should unmute conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu bật thông báo cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã bật thông báo cuộc trò chuyện' }

      mockConversationService.unmuteConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện bật thông báo
      const result = await controller.unmuteConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.unmuteConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('leaveConversation', () => {
    it('should leave conversation successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu rời cuộc trò chuyện
      const userId = 1
      const params = createTestData.conversationParams()
      const mockResponse = { message: 'Đã rời khỏi cuộc trò chuyện' }

      mockConversationService.leaveConversation.mockResolvedValue(mockResponse)

      // Act - Thực hiện rời cuộc trò chuyện
      const result = await controller.leaveConversation(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.leaveConversation).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('getConversationMembers', () => {
    it('should get conversation members successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu lấy danh sách thành viên
      const userId = 1
      const params = createTestData.conversationParams()
      const mockMembers = createTestData.conversationMembers()

      mockConversationService.getConversationMembers.mockResolvedValue(mockMembers)

      // Act - Thực hiện lấy danh sách thành viên
      const result = await controller.getConversationMembers(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual({
        message: 'Danh sách thành viên',
        data: mockMembers,
      })
      expect(mockConversationService.getConversationMembers).toHaveBeenCalledWith(params.conversationId, userId)
    })
  })

  describe('addMembers', () => {
    it('should add members successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu thêm thành viên
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.addMembersBody()
      const mockUpdatedConversation = createTestData.groupConversation()

      mockConversationService.addMembers.mockResolvedValue(mockUpdatedConversation)

      // Act - Thực hiện thêm thành viên
      const result = await controller.addMembers(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockUpdatedConversation)
      expect(mockConversationService.addMembers).toHaveBeenCalledWith(params.conversationId, userId, body.memberIds)
    })
  })

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu xóa thành viên
      const userId = 1
      const params = createTestData.memberParams()
      const mockResponse = { message: 'Đã xóa thành viên khỏi nhóm' }

      mockConversationService.removeMember.mockResolvedValue(mockResponse)

      // Act - Thực hiện xóa thành viên
      const result = await controller.removeMember(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.removeMember).toHaveBeenCalledWith(params.conversationId, userId, params.memberId)
    })
  })

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật vai trò thành viên
      const userId = 1
      const params = createTestData.memberParams()
      const body = { role: 'ADMIN' as const }
      const mockResponse = { message: 'Đã cập nhật vai trò thành viên' }

      mockConversationService.updateMemberRole.mockResolvedValue(mockResponse)

      // Act - Thực hiện cập nhật vai trò
      const result = await controller.updateMemberRole(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.updateMemberRole).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        params.memberId,
        body.role,
      )
    })

    it('should handle different role updates', async () => {
      // Arrange - Chuẩn bị dữ liệu cập nhật vai trò khác
      const userId = 1
      const params = createTestData.memberParams()
      const body = { role: 'MODERATOR' as const }
      const mockResponse = { message: 'Đã cập nhật vai trò thành viên' }

      mockConversationService.updateMemberRole.mockResolvedValue(mockResponse)

      // Act - Thực hiện cập nhật vai trò
      const result = await controller.updateMemberRole(userId, params, body)

      // Assert - Kiểm tra kết quả
      expect(result).toEqual(mockResponse)
      expect(mockConversationService.updateMemberRole).toHaveBeenCalledWith(
        params.conversationId,
        userId,
        params.memberId,
        'MODERATOR',
      )
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle service errors in getConversations', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const serviceError = new Error('Service unavailable')

      mockConversationService.getUserConversations.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getConversations(userId, query)).rejects.toThrow('Service unavailable')
      expect(mockConversationService.getUserConversations).toHaveBeenCalledWith(userId, query)
    })

    it('should handle service errors in createDirectConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createDirectConversationBody()
      const serviceError = new Error('Recipient not found')

      mockConversationService.createDirectConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createDirectConversation(userId, body)).rejects.toThrow('Recipient not found')
    })

    it('should handle service errors in createGroupConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const body = createTestData.createGroupConversationBody()
      const serviceError = new Error('Invalid group name')

      mockConversationService.createGroupConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.createGroupConversation(userId, body)).rejects.toThrow('Invalid group name')
    })

    it('should handle service errors in updateConversation', async () => {
      // Arrange - Chuẩn bị lỗi từ service
      const userId = 1
      const params = createTestData.conversationParams()
      const body = createTestData.updateConversationBody()
      const serviceError = new Error('Permission denied')

      mockConversationService.updateConversation.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.updateConversation(userId, params, body)).rejects.toThrow('Permission denied')
    })

    it('should pass through service responses without modification', async () => {
      // Arrange - Chuẩn bị test để đảm bảo controller không modify data
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const originalResponse = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(originalResponse)

      // Act - Thực hiện lấy danh sách cuộc trò chuyện
      const result = await controller.getConversations(userId, query)

      // Assert - Kiểm tra kết quả không bị thay đổi
      expect(result).toBe(originalResponse) // Same reference
      expect(result).toEqual(originalResponse) // Same content
    })

    it('should handle concurrent requests correctly', async () => {
      // Arrange - Chuẩn bị test concurrent requests
      const userId = 1
      const query = createTestData.getConversationsQuery()
      const mockResponse = createTestData.conversationsList()

      mockConversationService.getUserConversations.mockResolvedValue(mockResponse)

      // Act - Thực hiện multiple concurrent requests
      const promises = Array(3)
        .fill(null)
        .map(() => controller.getConversations(userId, query))
      const results = await Promise.all(promises)

      // Assert - Kiểm tra tất cả requests đều thành công
      results.forEach((result) => {
        expect(result).toEqual(mockResponse)
      })
      expect(mockConversationService.getUserConversations).toHaveBeenCalledTimes(3)
    })

    it('should handle invalid conversation IDs', async () => {
      // Arrange - Chuẩn bị dữ liệu với conversation ID không hợp lệ
      const userId = 1
      const params = createTestData.conversationParams({ conversationId: 'invalid-id' })
      const serviceError = new Error('Conversation not found')

      mockConversationService.getConversationById.mockRejectedValue(serviceError)

      // Act & Assert - Thực hiện test và kiểm tra lỗi
      await expect(controller.getConversation(userId, params)).rejects.toThrow('Conversation not found')
    })

    it('should handle empty member lists', async () => {
      // Arrange - Chuẩn bị dữ liệu danh sách thành viên trống
      const userId = 1
      const params = createTestData.conversationParams()

      mockConversationService.getConversationMembers.mockResolvedValue([])

      // Act - Thực hiện lấy danh sách thành viên
      const result = await controller.getConversationMembers(userId, params)

      // Assert - Kiểm tra kết quả
      expect(result.data).toHaveLength(0)
      expect(result.message).toBe('Danh sách thành viên')
    })
  })
})
