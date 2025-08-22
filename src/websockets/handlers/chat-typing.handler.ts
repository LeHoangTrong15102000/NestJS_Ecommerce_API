import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { SharedChatService } from 'src/shared/services/chat.service'
import { ChatRedisService } from '../services/chat-redis.service'
import { AuthenticatedSocket } from './chat-connection.handler'

export interface TypingData {
  conversationId: string
}

@Injectable()
export class ChatTypingHandler {
  private readonly logger = new Logger(ChatTypingHandler.name)

  constructor(
    private readonly chatService: SharedChatService,
    private readonly redisService: ChatRedisService,
  ) {}

  /**
   * Xử lý bắt đầu typing
   */
  async handleTypingStart(server: Server, client: AuthenticatedSocket, data: TypingData): Promise<void> {
    try {
      // Verify user is member
      const isMember = await this.chatService.isUserInConversation(data.conversationId, client.userId)
      if (!isMember) return

      // Add user to typing list in Redis (10 giây TTL)
      await this.redisService.setUserTyping(data.conversationId, client.userId, 10)

      // Update database typing indicator
      await this.chatService.setTypingIndicator(data.conversationId, client.userId)

      // Notify others in conversation (exclude sender)
      client.to(`conversation:${data.conversationId}`).emit('user_typing', {
        conversationId: data.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      // Auto-remove after 10 seconds
      setTimeout(() => {
        void this.handleTypingStop(server, client, data)
      }, 10000)
    } catch (error) {
      this.logger.error(`Typing start error: ${error.message}`)
    }
  }

  /**
   * Xử lý dừng typing
   */
  async handleTypingStop(server: Server, client: AuthenticatedSocket, data: TypingData): Promise<void> {
    try {
      // Remove user from typing list in Redis
      await this.redisService.removeUserTyping(data.conversationId, client.userId)

      // Remove from database
      await this.chatService.removeTypingIndicator(data.conversationId, client.userId)

      // Notify others that user stopped typing
      server.to(`conversation:${data.conversationId}`).emit('user_stopped_typing', {
        conversationId: data.conversationId,
        userId: client.userId,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Typing stop error: ${error.message}`)
    }
  }

  /**
   * Remove user khỏi tất cả typing khi disconnect
   */
  async removeUserFromAllTyping(server: Server, userId: number): Promise<void> {
    try {
      // Lấy tất cả conversations mà user đang typing
      const onlineUsers = await this.redisService.getOnlineUsers()

      // Remove từ Redis
      await this.redisService.removeUserFromAllTyping(userId)

      // Cleanup database typing indicators
      // Note: Database cleanup sẽ được handle bởi cleanup task

      this.logger.log(`Removed user ${userId} from all typing indicators`)
    } catch (error) {
      this.logger.error(`Error removing user ${userId} from all typing:`, error)
    }
  }

  /**
   * Lấy danh sách users đang typing trong conversation
   */
  async getTypingUsers(conversationId: string): Promise<number[]> {
    try {
      return this.redisService.getTypingUsers(conversationId)
    } catch (error) {
      this.logger.error(`Error getting typing users for conversation ${conversationId}:`, error)
      return []
    }
  }

  /**
   * Cleanup expired typing indicators (call định kỳ)
   */
  async cleanupExpiredTypingIndicators(): Promise<void> {
    try {
      // Database cleanup
      await this.chatService.cleanupExpiredTypingIndicators()

      // Redis tự cleanup với TTL, nhưng có thể force nếu cần
      this.logger.log('Cleaned up expired typing indicators')
    } catch (error) {
      this.logger.error('Error cleaning up typing indicators:', error)
    }
  }
}
