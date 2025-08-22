import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { MessageRepository } from './message.repo'
import { ConversationRepository } from './conversation.repo'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly userRepo: SharedUserRepository,
  ) {}

  // ===== MESSAGE MANAGEMENT =====

  async getConversationMessages(
    conversationId: string,
    userId: number,
    options: {
      page: number
      limit: number
      before?: string
      after?: string
      type?: string
    },
  ) {
    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem tin nhắn của cuộc trò chuyện này')
    }

    const result = await this.messageRepo.findConversationMessages(conversationId, options)

    // Enrich messages with computed fields
    const enrichedMessages = result.data.map((message) => {
      const isReadByCurrentUser = message.readReceipts.some((receipt) => receipt.userId === userId)
      const readByCount = message.readReceipts.length

      return {
        ...message,
        isReadByCurrentUser,
        readByCount,
      }
    })

    return {
      ...result,
      data: enrichedMessages,
    }
  }

  async sendMessage(
    userId: number,
    data: {
      conversationId: string
      content?: string
      type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'LOCATION' | 'CONTACT'
      replyToId?: string
      attachments?: Array<{
        type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
        fileName: string
        fileUrl: string
        fileSize?: number
        mimeType?: string
        thumbnail?: string
        width?: number
        height?: number
        duration?: number
      }>
    },
  ) {
    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(data.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này')
    }

    // Validate message content
    const hasContent = data.content && data.content.trim().length > 0
    const hasAttachments = data.attachments && data.attachments.length > 0

    if (!hasContent && !hasAttachments) {
      throw new BadRequestException('Tin nhắn phải có nội dung hoặc file đính kèm')
    }

    // Validate content length
    if (hasContent && data.content!.trim().length > 10000) {
      throw new BadRequestException('Nội dung tin nhắn không được vượt quá 10,000 ký tự')
    }

    // Validate attachments
    if (hasAttachments) {
      if (data.attachments!.length > 10) {
        throw new BadRequestException('Không thể đính kèm quá 10 file')
      }

      for (const attachment of data.attachments!) {
        if (!attachment.fileName || !attachment.fileUrl) {
          throw new BadRequestException('File đính kèm phải có tên và URL')
        }

        // Validate file size (100MB limit)
        if (attachment.fileSize && attachment.fileSize > 100 * 1024 * 1024) {
          throw new BadRequestException('Kích thước file không được vượt quá 100MB')
        }
      }
    }

    // Validate reply message exists and belongs to same conversation
    if (data.replyToId) {
      const replyMessage = await this.messageRepo.findById(data.replyToId)
      if (!replyMessage || replyMessage.conversationId !== data.conversationId) {
        throw new BadRequestException('Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này')
      }

      if (replyMessage.isDeleted && replyMessage.deletedForEveryone) {
        throw new BadRequestException('Không thể trả lời tin nhắn đã bị xóa')
      }
    }

    // Create message
    const message = await this.messageRepo.create({
      conversationId: data.conversationId,
      fromUserId: userId,
      content: hasContent ? data.content!.trim() : null,
      type: data.type || 'TEXT',
      replyToId: data.replyToId,
      attachments: data.attachments,
    })

    // Update conversation last message and timestamp
    const lastMessagePreview = this.generateMessagePreview(message)
    await this.conversationRepo.update(data.conversationId, {
      lastMessage: lastMessagePreview,
      lastMessageAt: new Date(),
    })

    // Increment unread count for other members
    await this.conversationRepo.incrementUnreadCount(data.conversationId, userId)

    // Auto-mark as read for sender
    await this.messageRepo.markAsRead(message.id, userId)

    return message
  }

  async editMessage(messageId: string, userId: number, content: string) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is the author
    if (message.fromUserId !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình')
    }

    // Cannot edit deleted messages
    if (message.isDeleted) {
      throw new BadRequestException('Không thể chỉnh sửa tin nhắn đã bị xóa')
    }

    // Cannot edit system messages
    if (message.type === 'SYSTEM') {
      throw new BadRequestException('Không thể chỉnh sửa tin nhắn hệ thống')
    }

    // Cannot edit messages with attachments only
    if (!message.content && message.attachments.length > 0) {
      throw new BadRequestException('Không thể chỉnh sửa tin nhắn chỉ có file đính kèm')
    }

    // Cannot edit messages older than 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    if (message.createdAt < dayAgo) {
      throw new BadRequestException('Không thể chỉnh sửa tin nhắn quá 24 giờ')
    }

    // Validate new content
    if (!content.trim()) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống')
    }

    if (content.trim().length > 10000) {
      throw new BadRequestException('Nội dung tin nhắn không được vượt quá 10,000 ký tự')
    }

    // Check if content actually changed
    if (content.trim() === message.content?.trim()) {
      return message // No change needed
    }

    const updatedMessage = await this.messageRepo.update(messageId, {
      content: content.trim(),
      isEdited: true,
      editedAt: new Date(),
    })

    // Update conversation last message if this was the latest
    const conversation = await this.conversationRepo.findById(message.conversationId)
    const lastMessage = await this.messageRepo.getLastMessage(message.conversationId)

    if (lastMessage && lastMessage.id === messageId) {
      const lastMessagePreview = this.generateMessagePreview(updatedMessage)
      await this.conversationRepo.update(message.conversationId, {
        lastMessage: lastMessagePreview,
      })
    }

    return updatedMessage
  }

  async deleteMessage(messageId: string, userId: number, forEveryone: boolean = false) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user permissions
    if (message.fromUserId !== userId) {
      if (forEveryone) {
        // Check if user is admin in the conversation
        const userRole = await this.conversationRepo.getUserRole(message.conversationId, userId)
        if (userRole !== 'ADMIN') {
          throw new ForbiddenException(
            'Chỉ tác giả tin nhắn hoặc quản trị viên mới có thể xóa tin nhắn cho tất cả mọi người',
          )
        }
      } else {
        throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của chính mình')
      }
    }

    // Cannot delete already deleted messages
    if (message.isDeleted) {
      throw new BadRequestException('Tin nhắn đã bị xóa')
    }

    // For admin deletion, check time limit (24 hours)
    if (forEveryone && message.fromUserId !== userId) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (message.createdAt < dayAgo) {
        throw new BadRequestException('Không thể xóa tin nhắn quá 24 giờ cho tất cả mọi người')
      }
    }

    const deletedMessage = await this.messageRepo.delete(messageId, forEveryone)

    // Update conversation last message if this was the latest
    const lastMessage = await this.messageRepo.getLastMessage(message.conversationId)
    let lastMessagePreview = 'Tin nhắn đã bị xóa'
    let lastMessageAt = message.createdAt

    if (lastMessage && lastMessage.id !== messageId) {
      lastMessagePreview = this.generateMessagePreview(lastMessage)
      lastMessageAt = lastMessage.createdAt
    }

    await this.conversationRepo.update(message.conversationId, {
      lastMessage: lastMessagePreview,
      lastMessageAt,
    })

    return deletedMessage
  }

  // ===== MESSAGE INTERACTIONS =====

  async markAsRead(conversationId: string, userId: number, messageId?: string) {
    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền đánh dấu tin nhắn đã đọc')
    }

    let markedCount = 0

    if (messageId) {
      // Mark specific message as read
      const message = await this.messageRepo.findById(messageId)
      if (!message || message.conversationId !== conversationId) {
        throw new NotFoundException('Tin nhắn không tồn tại trong cuộc trò chuyện này')
      }

      if (message.fromUserId !== userId) {
        // Don't mark own messages
        await this.messageRepo.markAsRead(messageId, userId)
        markedCount = 1
      }
    } else {
      // Mark all messages as read
      markedCount = await this.messageRepo.markConversationAsRead(conversationId, userId)
    }

    // Update user's last read timestamp and reset unread count
    await this.conversationRepo.updateMemberLastRead(conversationId, userId, new Date())

    return { markedCount }
  }

  async reactToMessage(messageId: string, userId: number, emoji: string) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(message.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền thêm reaction cho tin nhắn này')
    }

    // Cannot react to deleted messages
    if (message.isDeleted && message.deletedForEveryone) {
      throw new BadRequestException('Không thể react tin nhắn đã bị xóa')
    }

    // Validate emoji
    if (!this.isValidEmoji(emoji)) {
      throw new BadRequestException('Emoji không hợp lệ')
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find((r) => r.userId === userId && r.emoji === emoji)
    if (existingReaction) {
      // Remove existing reaction (toggle behavior)
      await this.messageRepo.removeReaction(messageId, userId, emoji)
      return { action: 'removed', emoji }
    } else {
      // Add new reaction
      const reaction = await this.messageRepo.addReaction(messageId, userId, emoji)
      return { action: 'added', reaction }
    }
  }

  async removeReaction(messageId: string, userId: number, emoji: string) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(message.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xóa reaction này')
    }

    await this.messageRepo.removeReaction(messageId, userId, emoji)
    return { message: 'Đã xóa reaction' }
  }

  // ===== MESSAGE SEARCH & UTILITY =====

  async searchMessages(
    userId: number,
    query: string,
    options: {
      page: number
      limit: number
      type?: string
      fromUserId?: number
      dateFrom?: Date
      dateTo?: Date
      conversationId?: string
    },
  ) {
    // Get user's conversations
    const userConversations = await this.conversationRepo.findUserConversations(userId, {
      page: 1,
      limit: 1000, // Get all user conversations
    })

    let conversationIds = userConversations.data.map((c) => c.id)

    // Filter by specific conversation if provided
    if (options.conversationId) {
      if (!conversationIds.includes(options.conversationId)) {
        throw new ForbiddenException('Bạn không có quyền tìm kiếm trong cuộc trò chuyện này')
      }
      conversationIds = [options.conversationId]
    }

    if (conversationIds.length === 0) {
      return {
        data: [],
        pagination: {
          page: options.page,
          limit: options.limit,
          total: 0,
          totalPages: 0,
        },
      }
    }

    return this.messageRepo.searchMessages(conversationIds, query, options)
  }

  async getMessageById(messageId: string, userId: number) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(message.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem tin nhắn này')
    }

    const isReadByCurrentUser = message.readReceipts.some((receipt) => receipt.userId === userId)
    const readByCount = message.readReceipts.length

    return {
      ...message,
      isReadByCurrentUser,
      readByCount,
    }
  }

  async getMessageStats(conversationId: string, userId: number) {
    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem thống kê tin nhắn')
    }

    return this.messageRepo.getMessageStats(conversationId)
  }

  async getReactionStats(messageId: string, userId: number) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is member of conversation
    const isMember = await this.conversationRepo.isUserMember(message.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem thống kê reaction')
    }

    return this.messageRepo.getReactionStats(messageId)
  }

  async getReadReceiptStats(messageId: string, userId: number) {
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundException('Tin nhắn không tồn tại')
    }

    // Verify user is author or member with admin rights
    const isMember = await this.conversationRepo.isUserMember(message.conversationId, userId)
    if (!isMember) {
      throw new ForbiddenException('Bạn không có quyền xem thống kê đã đọc')
    }

    const userRole = await this.conversationRepo.getUserRole(message.conversationId, userId)
    if (message.fromUserId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ tác giả tin nhắn hoặc quản trị viên mới có thể xem thống kê đã đọc')
    }

    return this.messageRepo.getReadReceiptStats(messageId)
  }

  // ===== PRIVATE HELPER METHODS =====

  private generateMessagePreview(message: any): string {
    if (message.isDeleted) {
      return 'Tin nhắn đã bị xóa'
    }

    if (message.content) {
      return message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content
    }

    if (message.attachments.length > 0) {
      const attachment = message.attachments[0]
      switch (attachment.type) {
        case 'IMAGE':
          return '📷 Hình ảnh'
        case 'VIDEO':
          return '🎥 Video'
        case 'AUDIO':
          return '🎵 Audio'
        case 'DOCUMENT':
          return '📄 Tài liệu'
        default:
          return '📎 File đính kèm'
      }
    }

    switch (message.type) {
      case 'STICKER':
        return '😊 Sticker'
      case 'LOCATION':
        return '📍 Vị trí'
      case 'CONTACT':
        return '👤 Liên hệ'
      case 'SYSTEM':
        return message.content || 'Thông báo hệ thống'
      default:
        return 'Tin nhắn'
    }
  }

  private isValidEmoji(emoji: string): boolean {
    // Basic emoji validation - you might want to use a more sophisticated library
    const emojiRegex =
      /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u
    const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉', '💯']

    return emojiRegex.test(emoji) || commonEmojis.includes(emoji)
  }
}
