import { Injectable, Logger } from '@nestjs/common'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'
import { MessageService } from 'src/routes/conversation/message.service'

@Injectable()
export class SharedChatService {
  private readonly logger = new Logger(SharedChatService.name)

  constructor(
    private readonly conversationService: ConversationService,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageService: MessageService,
  ) {}

  // ===== CONVERSATION OPERATIONS =====

  async isUserInConversation(conversationId: string, userId: number): Promise<boolean> {
    return this.conversationService.isUserInConversation(conversationId, userId)
  }

  async getConversationById(conversationId: string, userId: number) {
    return this.conversationService.getConversationById(conversationId, userId)
  }

  async getUserConversations(userId: number, options: { page: number; limit: number }) {
    return this.conversationService.getUserConversations(userId, options)
  }

  // ===== MESSAGE OPERATIONS =====

  async sendMessage(userId: number, data: any) {
    return this.messageService.sendMessage(userId, data)
  }

  async editMessage(messageId: string, userId: number, content: string) {
    return this.messageService.editMessage(messageId, userId, content)
  }

  async deleteMessage(messageId: string, userId: number, forEveryone: boolean = false) {
    return this.messageService.deleteMessage(messageId, userId, forEveryone)
  }

  async getMessageById(messageId: string, userId: number) {
    return this.messageService.getMessageById(messageId, userId)
  }

  async markAsRead(conversationId: string, userId: number, messageId?: string) {
    return this.messageService.markAsRead(conversationId, userId, messageId)
  }

  async reactToMessage(messageId: string, userId: number, emoji: string) {
    return this.messageService.reactToMessage(messageId, userId, emoji)
  }

  async removeReaction(messageId: string, userId: number, emoji: string) {
    return this.messageService.removeReaction(messageId, userId, emoji)
  }

  // ===== TYPING OPERATIONS =====

  async setTypingIndicator(conversationId: string, userId: number): Promise<void> {
    try {
      await this.conversationRepo.setTypingIndicator(conversationId, userId)
    } catch (error) {
      this.logger.error(`Error setting typing indicator: ${error.message}`)
    }
  }

  async removeTypingIndicator(conversationId: string, userId: number): Promise<void> {
    try {
      await this.conversationRepo.removeTypingIndicator(conversationId, userId)
    } catch (error) {
      this.logger.error(`Error removing typing indicator: ${error.message}`)
    }
  }

  async cleanupExpiredTypingIndicators(): Promise<void> {
    try {
      await this.conversationRepo.cleanupExpiredTypingIndicators()
    } catch (error) {
      this.logger.error(`Error cleaning up typing indicators: ${error.message}`)
    }
  }

  // ===== MEMBER OPERATIONS =====

  async getUserRole(conversationId: string, userId: number) {
    return this.conversationRepo.getUserRole(conversationId, userId)
  }

  async isUserMember(conversationId: string, userId: number): Promise<boolean> {
    return this.conversationRepo.isUserMember(conversationId, userId)
  }
}
